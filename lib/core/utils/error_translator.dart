import 'package:firebase_auth/firebase_auth.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

class ErrorTranslator {
  static String translate(dynamic error) {
    // ── Apple Sign-In specific errors ──────────────────────────────────
    if (error is SignInWithAppleAuthorizationException) {
      switch (error.code) {
        case AuthorizationErrorCode.canceled:
          return 'Apple sign in was cancelled.';
        case AuthorizationErrorCode.failed:
          return 'Apple sign in failed. Please try again.';
        case AuthorizationErrorCode.invalidResponse:
          return 'Invalid response from Apple. Please try again.';
        case AuthorizationErrorCode.notHandled:
          return 'Apple sign in request was not handled.';
        case AuthorizationErrorCode.notInteractive:
          return 'Apple sign in requires user interaction.';
        case AuthorizationErrorCode.unknown:
          return 'An unknown error occurred with Apple sign in.';
      }
    }

    // ── Firebase general errors ────────────────────────────────────────
    if (error is FirebaseException) {
      switch (error.code) {
        case 'permission-denied':
          return 'You do not have permission to perform this action.';
        case 'unavailable':
          return 'The service is currently unavailable. Please check your connection.';
        case 'not-found':
          return 'The requested resource was not found.';
        case 'already-exists':
          return 'This resource already exists.';
        case 'deadline-exceeded':
          return 'The operation timed out. Please try again.';
        case 'unauthenticated':
          return 'You must be logged in to perform this action.';
        case 'resource-exhausted':
          return 'Quota exceeded. Please try again later.';
        case 'failed-precondition':
          return 'Operation failed: ${error.message ?? 'Missing requirement.'}';
        case 'aborted':
          return 'The operation was aborted. Please try again.';
        case 'out-of-range':
          return 'Operation out of range.';
        case 'internal':
          return 'Internal server error. Please contact support.';
        case 'data-loss':
          return 'Unrecoverable data loss or corruption.';
        default:
          return error.message ?? 'An unexpected database error occurred.';
      }
    }

    // ── Firebase Auth errors ──────────────────────────────────────────
    if (error is FirebaseAuthException) {
      switch (error.code) {
        case 'user-not-found':
          return 'No user found with this email.';
        case 'wrong-password':
          return 'Incorrect password. Please try again.';
        case 'email-already-in-use':
          return 'An account already exists with this email.';
        case 'invalid-email':
          return 'The email address is invalid.';
        case 'weak-password':
          return 'The password is too weak.';
        case 'user-disabled':
          return 'This user account has been disabled.';
        case 'operation-not-allowed':
          return 'Operation not allowed. Please contact support.';
        case 'too-many-requests':
          return 'Too many login attempts. Please try again later.';
        case 'network-request-failed':
          return 'Network error. Please check your internet connection.';
        case 'invalid-credential':
          return 'The email or password is incorrect. Please check your credentials and try again.';
        default:
          return error.message ?? 'An error occurred during authentication.';
      }
    }

    // ── Generic Exception fallback ────────────────────────────────────
    final msg = error.toString();
    // Strip "Exception: " prefix for cleaner user-facing messages
    if (msg.startsWith('Exception: ')) {
      return msg.substring(11);
    }
    return msg;
  }
}

