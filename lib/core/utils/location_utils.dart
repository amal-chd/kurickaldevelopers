import 'dart:convert';
import 'package:http/http.dart' as http;

class LocationUtils {
  /// Reverse-geocodes GPS coordinates into a human-readable address using
  /// OpenStreetMap Nominatim (free, no API key).
  /// Returns null on failure so callers can fall back gracefully.
  static Future<String?> getAddressFromCoords(double lat, double lng) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?lat=$lat&lon=$lng&format=json&addressdetails=1',
      );
      final response = await http
          .get(
            uri,
            headers: {
              'User-Agent': 'TaskPilot/1.0',
              'Accept': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final addr = data['address'] as Map<String, dynamic>?;
        if (addr != null) {
          // Build a concise "Road, Area, City" string
          final parts = <String>[
            if (addr['road'] != null) addr['road'] as String,
            if (addr['suburb'] != null)
              addr['suburb'] as String
            else if (addr['neighbourhood'] != null)
              addr['neighbourhood'] as String
            else if (addr['village'] != null)
              addr['village'] as String,
            if (addr['city'] != null)
              addr['city'] as String
            else if (addr['town'] != null)
              addr['town'] as String
            else if (addr['county'] != null)
              addr['county'] as String,
          ];
          if (parts.isNotEmpty) return parts.join(', ');
        }
        // Fallback: full display_name (may be long but better than nothing)
        final full = data['display_name'] as String?;
        if (full != null && full.length > 60) {
          // Trim long Nominatim strings
          final segments = full.split(', ');
          return segments.take(3).join(', ');
        }
        return full;
      }
    } catch (_) {
      // Network error, timeout, etc. — silently return null
    }
    return null;
  }

  /// Returns a compact coordinate string e.g. "10.02345, 76.30123"
  static String formatCoords(double lat, double lng) =>
      '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
}
