import 'dart:convert';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class FcmService {
  final _messaging = FirebaseMessaging.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();

  static const _channelId = 'task_pilot_channel';
  static const _channelName = 'Task Pilot';

  GlobalKey<NavigatorState>? navigatorKey;

  Future<void> initialize(GlobalKey<NavigatorState> navKey) async {
    navigatorKey = navKey;

    await _requestPermission();
    await _setupLocalNotifications();

    // iOS shows notifications natively while the app is foregrounded; Android
    // is handled by the local-notification fallback in _handleForegroundMessages.
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    _handleForegroundMessages();
    _handleBackgroundTap();
    _listenToTokenRefresh();

    // Persist the token for whoever is signed in now, and again whenever the
    // auth state changes (login on a fresh device, re-install, account switch).
    await _syncTokenForCurrentUser();
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) _syncTokenForCurrentUser();
    });

    // Cold-start: app launched from terminated state via notification tap
    await _handleInitialMessage();
  }

  Future<void> _requestPermission() async {
    await _messaging.requestPermission(alert: true, badge: true, sound: true);
  }

  Future<String?> getToken() async {
    if (Platform.isIOS) {
      String? apnsToken;
      int attempts = 0;
      while (apnsToken == null && attempts < 10) {
        apnsToken = await _messaging.getAPNSToken();
        if (apnsToken == null) {
          await Future.delayed(const Duration(milliseconds: 500));
          attempts++;
        }
      }
    }
    return _messaging.getToken();
  }

  /// Fetch the current FCM token and store it on the signed-in user's doc.
  /// On iOS the APNs token must be available before getToken() returns, so we
  /// wait for it first to avoid a null token on the first launch after install.
  Future<void> _syncTokenForCurrentUser() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    try {
      final token = await getToken();
      if (token == null) return;
      await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .set({'fcmToken': token}, SetOptions(merge: true));
    } catch (_) {
      // Token will be retried on the next refresh / auth change.
    }
  }

  Future<void> _setupLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);
  }

  void _handleForegroundMessages() {
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification != null) {
        // iOS presents foreground notifications natively (see
        // setForegroundNotificationPresentationOptions), so only Android needs
        // the local-notification fallback. Showing both on iOS would duplicate.
        if (!Platform.isAndroid) return;

        // Encode the full data payload so deep linking works from local
        // notifications (previously only `type` was passed, losing relatedId).
        final payloadJson = jsonEncode(message.data);

        _localNotifications.show(
          notification.hashCode,
          notification.title,
          notification.body,
          NotificationDetails(
            android: AndroidNotificationDetails(
              _channelId,
              _channelName,
              importance: Importance.high,
              priority: Priority.high,
            ),
          ),
          payload: payloadJson,
        );
      }
    });
  }

  void _handleBackgroundTap() {
    FirebaseMessaging.onMessageOpenedApp.listen(_navigateFromMessage);
  }

  /// Handle cold-start: app was terminated, user tapped a notification.
  Future<void> _handleInitialMessage() async {
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      // Defer navigation until the widget tree is built
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _navigateFromMessage(initialMessage);
      });
    }
  }

  void _listenToTokenRefresh() {
    _messaging.onTokenRefresh.listen((fcmToken) {
      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid != null) {
        FirebaseFirestore.instance.collection('users').doc(uid).set({
          'fcmToken': fcmToken,
        }, SetOptions(merge: true));
      }
    });
  }

  void _onNotificationTap(NotificationResponse response) {
    // Decode the full payload JSON
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;

    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      _navigateFromPayload(data['type'], data['relatedId']);
    } catch (_) {
      // Legacy: payload might be just the type string (before this fix)
      _navigateFromPayload(payload, null);
    }
  }

  void _navigateFromMessage(RemoteMessage message) {
    _navigateFromPayload(message.data['type'], message.data['relatedId']);
  }

  void _navigateFromPayload(String? type, [String? relatedId, int attempt = 0]) {
    final context = navigatorKey?.currentContext;
    if (context == null) {
      if (attempt < 30) {
        Future.delayed(const Duration(milliseconds: 150), () {
          _navigateFromPayload(type, relatedId, attempt + 1);
        });
      }
      return;
    }

    switch (type) {
      // Task-related notifications
      case 'task_assigned':
      case 'task_due':
      case 'task_overdue':
      case 'approval_needed':
      case 'mention':
      case 'sla_breach':
        if (relatedId != null && relatedId.isNotEmpty) {
          context.push('/tasks/$relatedId');
        } else {
          context.go('/tasks');
        }
        break;

      // Chat notification → navigate to the channel
      case 'chat_message':
        if (relatedId != null && relatedId.isNotEmpty) {
          context.push('/chat/$relatedId');
        } else {
          context.go('/chat');
        }
        break;

      // Project update → project detail
      case 'project_update':
        if (relatedId != null && relatedId.isNotEmpty) {
          context.push('/projects/$relatedId');
        } else {
          context.go('/projects');
        }
        break;

      // Diary entry → site diary
      case 'diary_entry':
        context.go('/site-diary');
        break;

      // Document uploaded → documents list
      case 'document_uploaded':
        context.go('/documents');
        break;

      // Daily digest → dashboard
      case 'daily_digest':
        context.go('/dashboard');
        break;

      default:
        // Unknown type — go to notifications screen
        context.go('/notifications');
        break;
    }
  }
}
