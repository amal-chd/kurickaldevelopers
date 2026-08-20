const fs = require('fs');
let code = fs.readFileSync('mobile_app/lib/data/repositories/attendance_repository.dart', 'utf8');

const replacement = `
Map<String, dynamic> _toCamelCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    if (key.contains('_')) {
      final parts = key.split('_');
      final camelKey = parts.first + parts.skip(1).map((w) => w.substring(0, 1).toUpperCase() + w.substring(1)).join('');
      map[camelKey] = value;
    } else {
      map[key] = value;
    }
  });

  if (data['check_in_time'] != null) map['checkInTime'] = Timestamp.fromDate(DateTime.parse(data['check_in_time']));
  if (data['check_out_time'] != null) map['checkOutTime'] = Timestamp.fromDate(DateTime.parse(data['check_out_time']));
  
  // Reconstruct GeoPoint from lat/lng columns
  if (data['check_in_lat'] != null && data['check_in_lng'] != null) {
    map['checkInLocation'] = GeoPoint((data['check_in_lat'] as num).toDouble(), (data['check_in_lng'] as num).toDouble());
  } else if (data['check_in_location'] is Map) {
    map['checkInLocation'] = GeoPoint((data['check_in_location']['lat'] as num).toDouble(), (data['check_in_location']['lng'] as num).toDouble());
  } else {
    map['checkInLocation'] = const GeoPoint(0, 0); // Safe fallback
  }

  if (data['check_out_lat'] != null && data['check_out_lng'] != null) {
    map['checkOutLocation'] = GeoPoint((data['check_out_lat'] as num).toDouble(), (data['check_out_lng'] as num).toDouble());
  } else if (data['check_out_location'] is Map) {
    map['checkOutLocation'] = GeoPoint((data['check_out_location']['lat'] as num).toDouble(), (data['check_out_location']['lng'] as num).toDouble());
  }

  return map;
}
`;

code = code.replace(/Map<String, dynamic> _toCamelCase[\s\S]*?return map;\n}/, replacement.trim());
fs.writeFileSync('mobile_app/lib/data/repositories/attendance_repository.dart', code);
