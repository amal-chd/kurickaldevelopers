import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/app.dart';
import 'core/config/supabase_config.dart';
import 'core/utils/navigator_key.dart';
import 'data/services/fcm_service.dart';
import 'data/services/offline_sync_service.dart';
import 'firebase_options.dart';

/// Background/terminated push handler. Must be a top-level function and
/// initialise Firebase itself, since it runs in its own isolate. Alert
/// notifications are rendered by the OS automatically; this exists so data
/// messages are still processed, and FCM requires it to be registered before
/// runApp.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    if (e is! FirebaseException || e.code != 'duplicate-app') rethrow;
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    if (e is! FirebaseException || e.code != 'duplicate-app') {
      rethrow;
    }
  }

  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  FirebaseFirestore.instance.settings = const Settings(
    persistenceEnabled: true,
  );

  // Initialise Supabase — used ONLY for file storage (chat files + documents).
  // Skipped silently until real credentials are configured in SupabaseConfig.
  if (SupabaseConfig.isConfigured) {
    try {
      await Supabase.initialize(
        url: SupabaseConfig.url,
        // ignore: deprecated_member_use
        anonKey: SupabaseConfig.anonKey,
      );
    } catch (e) {
      debugPrint('Supabase init failed (uploads will be unavailable): $e');
    }
  }

  FlutterError.onError = (errorDetails) {
    FlutterError.presentError(errorDetails);
    FirebaseCrashlytics.instance.recordFlutterFatalError(errorDetails);
  };

  // Initialise FCM so notifications work for users who already completed
  // onboarding (not just first-run). The navigator key is wired to GoRouter
  // so tapping a notification navigates to the correct screen.
  // Note: We intentionally do NOT await this, because awaiting permission
  // requests or APNs tokens before runApp() causes the app to hang on a white screen.
  FcmService().initialize(appNavigatorKey);

  // Start auto-sync: replay queued offline mutations when connectivity returns.
  OfflineSyncService().startAutoSync();

  // Use the bundled fonts in google_fonts/ instead of fetching from
  // fonts.gstatic.com at runtime. Runtime fetching failed on flaky networks
  // (e.g. the iOS simulator), leaving text unstyled / the screen blank.
  GoogleFonts.config.allowRuntimeFetching = false;

  runApp(const ProviderScope(child: KurickalApp()));
}

