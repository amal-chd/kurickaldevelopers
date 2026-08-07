import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DocumentCacheManager {
  static const String _cachePrefsKey = 'kurickal_document_cache';
  static const int _maxCacheSize = 20;

  // Hashes the URL to create a safe unique filename
  static String _hashUrl(String url) {
    final bytes = utf8.encode(url);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  // Get file extension from URL or mimeType
  static String _getFileExtension(String url, String mimeType) {
    if (mimeType.contains('pdf')) return 'pdf';
    if (mimeType.contains('png')) return 'png';
    if (mimeType.contains('jpeg') || mimeType.contains('jpg')) return 'jpg';
    if (mimeType.contains('word') || mimeType.contains('document')) return 'docx';
    if (mimeType.contains('sheet') || mimeType.contains('excel')) return 'xlsx';
    if (mimeType.contains('presentation') || mimeType.contains('powerpoint')) return 'pptx';
    if (mimeType.contains('zip')) return 'zip';
    if (mimeType.contains('csv')) return 'csv';
    if (mimeType.contains('json')) return 'json';
    if (mimeType.contains('xml')) return 'xml';
    if (mimeType.contains('text')) return 'txt';
    if (mimeType.contains('video') || mimeType.contains('mp4')) return 'mp4';
    if (mimeType.contains('audio') || mimeType.contains('mp3') || mimeType.contains('mpeg')) return 'mp3';

    // Fallback parsing from URL query parameters or path
    try {
      final uri = Uri.parse(url);
      final pathSegments = uri.pathSegments;
      if (pathSegments.isNotEmpty) {
        final last = pathSegments.last;
        if (last.contains('.')) {
          return last.split('.').last.toLowerCase();
        }
      }
    } catch (_) {}

    return 'tmp';
  }

  /// Get the cached file path if it exists locally, otherwise downloads, caches, and returns it.
  static Future<File> getFile(String url, {required String mimeType}) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheMapString = prefs.getString(_cachePrefsKey);
    Map<String, dynamic> cacheMap = cacheMapString != null ? Map<String, dynamic>.from(json.decode(cacheMapString)) : {};

    final hash = _hashUrl(url);
    final ext = _getFileExtension(url, mimeType);

    final dir = await getTemporaryDirectory();
    final cacheDir = Directory('${dir.path}/document_cache');
    if (!await cacheDir.exists()) {
      await cacheDir.create(recursive: true);
    }

    final localFile = File('${cacheDir.path}/$hash.$ext');

    // If file exists locally and we have it in cacheMap, update its timestamp and return
    if (await localFile.exists() && cacheMap.containsKey(url)) {
      cacheMap[url] = DateTime.now().millisecondsSinceEpoch;
      await prefs.setString(_cachePrefsKey, json.encode(cacheMap));
      return localFile;
    }

    // Download file
    final response = await http.get(Uri.parse(url));
    if (response.statusCode != 200) {
      throw Exception('Failed to download document: status ${response.statusCode}');
    }

    // Write file locally
    await localFile.writeAsBytes(response.bodyBytes);

    // Save metadata
    cacheMap[url] = DateTime.now().millisecondsSinceEpoch;

    // Evict oldest if cache exceeds max size
    if (cacheMap.length > _maxCacheSize) {
      final sortedEntries = cacheMap.entries.toList()
        ..sort((a, b) => (a.value as int).compareTo(b.value as int));
      
      final oldestUrl = sortedEntries.first.key;
      final oldestHash = _hashUrl(oldestUrl);
      
      // Look for the file and delete
      try {
        final files = cacheDir.listSync();
        for (var f in files) {
          if (f is File && f.path.contains(oldestHash)) {
            await f.delete();
          }
        }
      } catch (e) {
        debugPrint('Error evicting file from cache: $e');
      }

      cacheMap.remove(oldestUrl);
    }

    await prefs.setString(_cachePrefsKey, json.encode(cacheMap));
    return localFile;
  }

  /// Manually clears the entire document cache.
  static Future<void> clearCache() async {
    try {
      final dir = await getTemporaryDirectory();
      final cacheDir = Directory('${dir.path}/document_cache');
      if (await cacheDir.exists()) {
        await cacheDir.delete(recursive: true);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_cachePrefsKey);
    } catch (e) {
      debugPrint('Failed to clear document cache: $e');
    }
  }
}
