import 'package:flutter/material.dart';

class FileUtils {
  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1048576) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1073741824) return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    return '${(bytes / 1073741824).toStringAsFixed(1)} GB';
  }

  static IconData iconForMimeType(String mimeType) {
    if (mimeType.contains('pdf')) return Icons.picture_as_pdf_rounded;
    if (mimeType.contains('image')) return Icons.image_rounded;
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return Icons.description_rounded;
    }
    if (mimeType.contains('sheet') || mimeType.contains('excel')) {
      return Icons.table_chart_rounded;
    }
    if (mimeType.contains('presentation') || mimeType.contains('powerpoint')) {
      return Icons.slideshow_rounded;
    }
    return Icons.insert_drive_file_rounded;
  }

  static Color colorForMimeType(String mimeType) {
    if (mimeType.contains('pdf')) return const Color(0xFFEF4444);
    if (mimeType.contains('image')) return const Color(0xFF22C55E);
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return const Color(0xFF2563EB);
    }
    if (mimeType.contains('sheet') || mimeType.contains('excel')) {
      return const Color(0xFF16A34A);
    }
    return const Color(0xFF6B7280);
  }
}
