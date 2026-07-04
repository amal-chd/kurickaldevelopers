import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../../core/config/push_config.dart';

/// Calls the serverless push sender (see [PushConfig]). Recipients and content
/// are reconstructed server-side from Firestore — the app only sends ids. All
/// calls are fire-and-forget: a failed push must never break the user action
/// that triggered it.
class PushSender {
  PushSender._();
  static final PushSender instance = PushSender._();

  Future<void> _post(Map<String, dynamic> payload) async {
    if (!PushConfig.isConfigured) return;
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      final token = await user.getIdToken();
      await http
          .post(
            Uri.parse(PushConfig.endpoint),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 10));
    } catch (_) {
      // Ignore — push delivery is best-effort.
    }
  }

  /// New chat message → notify the other channel members.
  Future<void> chatMessage({
    required String channelId,
    required String messageId,
  }) =>
      _post({'event': 'chat', 'channelId': channelId, 'messageId': messageId});

  /// Task assigned (kind = 'assigned') or status changed (kind = 'status').
  Future<void> task({required String taskId, required String kind}) =>
      _post({'event': 'task', 'taskId': taskId, 'kind': kind});

  /// Admin broadcast. Pass [userIds] for specific recipients, or leave null to
  /// reach everyone (optionally filtered by [targetRoleId]).
  Future<void> broadcast({
    required String title,
    required String body,
    List<String>? userIds,
    String? targetRoleId,
  }) =>
      _post({
        'event': 'broadcast',
        'title': title,
        'body': body,
        if (userIds != null) 'userIds': userIds,
        if (targetRoleId != null) 'targetRoleId': targetRoleId,
      });

  /// Delete a user account (Auth and associated Firestore data).
  Future<void> deleteUser({required String targetUid}) async {
    if (!PushConfig.isConfigured) {
      throw Exception('Backend API is not configured');
    }
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();
    
    final res = await http.post(
      Uri.parse(PushConfig.endpoint),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'event': 'delete_user',
        'targetUid': targetUid,
      }),
    ).timeout(const Duration(seconds: 10));

    if (res.statusCode != 200) {
      try {
        final body = jsonDecode(res.body);
        throw Exception(body['error'] ?? 'Failed to delete user account');
      } catch (_) {
        throw Exception('Failed to delete user account (${res.statusCode})');
      }
    }
  }
}
