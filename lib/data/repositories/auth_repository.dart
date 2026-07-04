import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../core/utils/error_translator.dart';

class AuthRepository {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn? _googleSignIn = kIsWeb ? null : GoogleSignIn();

  Stream<User?> get authStateChanges => _auth.idTokenChanges();

  User? get currentUser => _auth.currentUser;

  // ── Last Login Helper ───────────────────────────────────────────────────

  Future<void> _updateLastLogin(String uid) async {
    try {
      await FirebaseFirestore.instance.collection('users').doc(uid).update({
        'lastLoginAt': FieldValue.serverTimestamp(),
      });
    } catch (_) {
      // Non-fatal — proceed even if update fails.
    }
  }

  // ── Email / Password ────────────────────────────────────────────────────

  Future<UserCredential> signInWithEmail(String email, String password) async {
    try {
      final cred = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      if (cred.user != null) await _updateLastLogin(cred.user!.uid);
      return cred;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Google Sign-In ──────────────────────────────────────────────────────

  Future<UserCredential> signInWithGoogle() async {
    try {
      if (kIsWeb) {
        final provider = GoogleAuthProvider();
        final cred = await _auth.signInWithPopup(provider);
        if (cred.user != null) await _updateLastLogin(cred.user!.uid);
        return cred;
      } else {
        final googleUser = await _googleSignIn!.signIn();
        if (googleUser == null) throw Exception('Google sign in cancelled');
        final googleAuth = await googleUser.authentication;
        final credential = GoogleAuthProvider.credential(
          accessToken: googleAuth.accessToken,
          idToken: googleAuth.idToken,
        );
        final cred = await _auth.signInWithCredential(credential);
        if (cred.user != null) await _updateLastLogin(cred.user!.uid);
        return cred;
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Apple Sign-In ───────────────────────────────────────────────────────

  /// Generates a cryptographically-secure random nonce.
  String _generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)])
        .join();
  }

  /// Returns the SHA-256 hash of [input].
  String _sha256ofString(String input) {
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  Future<UserCredential> signInWithApple() async {
    try {
      // Generate a nonce and compute its SHA-256 for Apple
      final rawNonce = _generateNonce();
      final nonce = _sha256ofString(rawNonce);

      // Request credential from Apple
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: nonce,
      );

      // Create an OAuthCredential from the Apple response
      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        rawNonce: rawNonce,
      );

      // Sign in with Firebase
      final userCredential =
          await _auth.signInWithCredential(oauthCredential);

      // Apple only sends name on FIRST sign-in, so persist it if available
      final displayName = [
        appleCredential.givenName,
        appleCredential.familyName,
      ].where((e) => e != null && e.isNotEmpty).join(' ');

      if (displayName.isNotEmpty &&
          (userCredential.user?.displayName == null ||
              userCredential.user!.displayName!.isEmpty)) {
        await userCredential.user?.updateDisplayName(displayName);
      }

      if (userCredential.user != null) {
        await _updateLastLogin(userCredential.user!.uid);
      }
      return userCredential;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Password Reset ──────────────────────────────────────────────────────

  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Phone Auth ──────────────────────────────────────────────────────────

  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required Function(PhoneAuthCredential) onVerificationCompleted,
    required Function(FirebaseAuthException) onVerificationFailed,
    required Function(String, int?) onCodeSent,
    required Function(String) onCodeAutoRetrievalTimeout,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: onVerificationCompleted,
      verificationFailed: onVerificationFailed,
      codeSent: onCodeSent,
      codeAutoRetrievalTimeout: onCodeAutoRetrievalTimeout,
    );
  }

  Future<UserCredential> confirmOtp(String verificationId, String otp) async {
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: otp,
      );
      final cred = await _auth.signInWithCredential(credential);
      if (cred.user != null) await _updateLastLogin(cred.user!.uid);
      return cred;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Sign Out ────────────────────────────────────────────────────────────

  Future<void> signOut() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cached_permissions');
    } catch (_) {}

    // Best-effort: detach this device's push token so a shared device stops
    // receiving the signed-out user's notifications. Must run BEFORE
    // auth.signOut() while the write is still permitted by the rules.
    try {
      final uid = _auth.currentUser?.uid;
      if (uid != null) {
        await FirebaseFirestore.instance
            .collection('users')
            .doc(uid)
            .set({'fcmToken': ''}, SetOptions(merge: true));
      }
    } catch (_) {}

    if (kIsWeb) {
      await _auth.signOut();
    } else {
      await Future.wait([_auth.signOut(), _googleSignIn!.signOut()]);
    }
  }
}
