// Firebase configuration for Task Pilot.
// Regenerate via `flutterfire configure` if project IDs change.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        return linux;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions not configured for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBV7Ju3tnee5BrG_64V6YravVjb-OCI68A',
    appId: '1:1081889029959:android:39958f0546e18dc1301662',
    messagingSenderId: '1081889029959',
    projectId: 'kurikal-tms-app',
    storageBucket: 'kurikal-tms-app.firebasestorage.app',
    databaseURL:
        'https://kurikal-tms-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBV7Ju3tnee5BrG_64V6YravVjb-OCI68A',
    appId: '1:1081889029959:ios:13917706092dc057301662',
    messagingSenderId: '1081889029959',
    projectId: 'kurikal-tms-app',
    storageBucket: 'kurikal-tms-app.firebasestorage.app',
    iosBundleId: 'com.taskmasterpro.app',
    databaseURL:
        'https://kurikal-tms-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyBV7Ju3tnee5BrG_64V6YravVjb-OCI68A',
    appId: '1:1081889029959:ios:13917706092dc057301662',
    messagingSenderId: '1081889029959',
    projectId: 'kurikal-tms-app',
    storageBucket: 'kurikal-tms-app.firebasestorage.app',
    iosBundleId: 'com.taskmasterpro.app',
    databaseURL:
        'https://kurikal-tms-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyBV7Ju3tnee5BrG_64V6YravVjb-OCI68A',
    appId: '1:1081889029959:web:66bcdcc86ffeaf07301662',
    messagingSenderId: '1081889029959',
    projectId: 'kurikal-tms-app',
    storageBucket: 'kurikal-tms-app.firebasestorage.app',
    authDomain: 'kurikal-tms-app.firebaseapp.com',
    databaseURL:
        'https://kurikal-tms-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  );

  static const FirebaseOptions linux = FirebaseOptions(
    apiKey: 'AIzaSyBV7Ju3tnee5BrG_64V6YravVjb-OCI68A',
    appId: '1:1081889029959:web:66bcdcc86ffeaf07301662',
    messagingSenderId: '1081889029959',
    projectId: 'kurikal-tms-app',
    storageBucket: 'kurikal-tms-app.firebasestorage.app',
    authDomain: 'kurikal-tms-app.firebaseapp.com',
    databaseURL:
        'https://kurikal-tms-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  );

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBV7Ju3tnee5BrG_64V6YravVjb-OCI68A',
    appId: '1:1081889029959:web:66bcdcc86ffeaf07301662',
    messagingSenderId: '1081889029959',
    projectId: 'kurikal-tms-app',
    storageBucket: 'kurikal-tms-app.firebasestorage.app',
    authDomain: 'kurikal-tms-app.firebaseapp.com',
    databaseURL:
        'https://kurikal-tms-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  );
}
