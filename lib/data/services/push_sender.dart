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

  /// New document uploaded.
  Future<void> document({required String docId}) =>
      _post({'event': 'document', 'docId': docId});

  /// New site diary entry added.
  Future<void> diaryEntry({required String diaryId}) =>
      _post({'event': 'diary', 'diaryId': diaryId});

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

  /// Create a user account (Auth + Firestore profile) server-side via the Admin
  /// SDK. Doing it on the server keeps the admin's own session intact AND lets
  /// the profile be written with an admin-assigned role — the client SDK cannot,
  /// because the `roleAllowedForSelf` Firestore rule blocks a brand-new user
  /// from self-assigning an arbitrary role. Returns the new user's uid.
  Future<String> createUser({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String roleId,
  }) async {
    if (!PushConfig.isConfigured) {
      throw Exception('Backend API is not configured');
    }
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();

    final res = await http
        .post(
          Uri.parse(PushConfig.endpoint),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'event': 'create_user',
            'name': name,
            'email': email,
            'phone': phone,
            'password': password,
            'roleId': roleId,
          }),
        )
        .timeout(const Duration(seconds: 20));

    if (res.statusCode != 200) {
      String msg = 'Failed to create user (${res.statusCode})';
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map && decoded['error'] != null) {
          msg = decoded['error'].toString();
        }
      } catch (_) {}
      throw Exception(msg);
    }

    final decoded = jsonDecode(res.body);
    return (decoded is Map && decoded['uid'] != null) ? decoded['uid'].toString() : '';
  }

  /// Reset a user account's password (Admin only).
  Future<void> resetUserPassword({
    required String targetUid,
    required String newPassword,
  }) async {
    if (!PushConfig.isConfigured) {
      throw Exception('Backend API is not configured');
    }
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final token = await user.getIdToken();

    final res = await http
        .post(
          Uri.parse(PushConfig.endpoint),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'event': 'reset_password',
            'targetUid': targetUid,
            'newPassword': newPassword,
          }),
        )
        .timeout(const Duration(seconds: 15));

    if (res.statusCode != 200) {
      try {
        final body = jsonDecode(res.body);
        throw Exception(body['error'] ?? 'Failed to reset password');
      } catch (_) {
        throw Exception('Failed to reset password (${res.statusCode})');
      }
    }
  }
}
