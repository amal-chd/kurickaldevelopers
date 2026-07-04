import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/supabase_config.dart';

/// File storage backed by Supabase Storage.
///
/// Scope: chat file uploads and document storage only. Authentication and the
/// database remain on Firebase. Other upload helpers (task photos, avatars)
/// are intentionally left unavailable.
class StorageService {
  SupabaseClient get _client => Supabase.instance.client;

  static const _unavailableMsg =
      'File storage is not configured. Add your Supabase URL and anon key.';

  bool get isReady => SupabaseConfig.isConfigured;

  // Make a safe storage key from a filename, preserving the extension.
  String _safeName(String fileName) {
    final dot = fileName.lastIndexOf('.');
    final ext = dot >= 0 ? fileName.substring(dot).toLowerCase() : '';
    var base = (dot >= 0 ? fileName.substring(0, dot) : fileName)
        .replaceAll(RegExp(r'[^a-zA-Z0-9-_]+'), '_');
    if (base.length > 80) base = base.substring(0, 80);
    if (base.isEmpty) base = 'file';
    return '$base$ext';
  }

  String _key(String folder, String fileName) =>
      '$folder/${DateTime.now().millisecondsSinceEpoch}_${_safeName(fileName)}';

  // ── Documents ──────────────────────────────────────────────────────────────

  Future<String> uploadDocument({
    required String projectId,
    required String fileName,
    required File file,
    required String mimeType,
    required void Function(double) onProgress,
  }) async {
    if (!isReady) throw const _StorageUnavailableException(_unavailableMsg);
    onProgress(0.1);
    final path = _key(projectId.isEmpty ? 'general' : projectId, fileName);
    await _client.storage.from(SupabaseConfig.documentsBucket).upload(
          path,
          file,
          fileOptions: FileOptions(contentType: mimeType, upsert: false),
        );
    onProgress(1.0);
    return _client.storage
        .from(SupabaseConfig.documentsBucket)
        .getPublicUrl(path);
  }

  // ── Chat files ─────────────────────────────────────────────────────────────

  /// Uploads a chat attachment (image or file) and returns its public URL.
  Future<String> uploadChatFile({
    required String channelId,
    required File file,
    String? mimeType,
  }) async {
    if (!isReady) throw const _StorageUnavailableException(_unavailableMsg);
    final fileName = file.path.split('/').last;
    final path = _key(channelId, fileName);
    await _client.storage.from(SupabaseConfig.chatFilesBucket).upload(
          path,
          file,
          fileOptions: FileOptions(contentType: mimeType, upsert: false),
        );
    return _client.storage
        .from(SupabaseConfig.chatFilesBucket)
        .getPublicUrl(path);
  }

  // ── Deletion ───────────────────────────────────────────────────────────────

  /// Best-effort delete of a previously-uploaded file given its public URL.
  Future<void> deleteFile(String url) async {
    if (!isReady || url.isEmpty) return;
    try {
      // Public URL format: .../storage/v1/object/public/<bucket>/<path>
      final marker = '/object/public/';
      final idx = url.indexOf(marker);
      if (idx < 0) return;
      final rest = url.substring(idx + marker.length);
      final slash = rest.indexOf('/');
      if (slash < 0) return;
      final bucket = rest.substring(0, slash);
      final path = Uri.decodeComponent(rest.substring(slash + 1));
      await _client.storage.from(bucket).remove([path]);
    } catch (_) {
      // Ignore — deletion is best-effort.
    }
  }

  // ── Out of scope (intentionally unavailable) ────────────────────────────────

  Future<String> uploadTaskPhoto({
    required String projectId,
    required String taskId,
    required File file,
    required void Function(double) onProgress,
  }) =>
      Future.error(const _StorageUnavailableException(
        'Task photo uploads are not enabled.',
      ));

  Future<String> uploadPhoto({required String projectId, required File file}) =>
      Future.error(const _StorageUnavailableException(
        'Photo uploads are not enabled.',
      ));

  Future<String> uploadAvatar(String uid, File file) =>
      Future.error(const _StorageUnavailableException(
        'Avatar uploads are not enabled.',
      ));
}

class _StorageUnavailableException implements Exception {
  final String message;
  const _StorageUnavailableException(this.message);
  @override
  String toString() => message;
}
