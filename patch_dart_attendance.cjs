const fs = require('fs');
let code = fs.readFileSync('mobile_app/lib/data/repositories/attendance_repository.dart', 'utf8');

const replacement = `
Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    if (value == null) return;
    
    if (key == 'checkInLocation') {
      map['check_in_lat'] = (value as dynamic).latitude;
      map['check_in_lng'] = (value as dynamic).longitude;
      return;
    }
    if (key == 'checkOutLocation') {
      map['check_out_lat'] = (value as dynamic).latitude;
      map['check_out_lng'] = (value as dynamic).longitude;
      return;
    }

    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());
    
    if (value is Timestamp) {
      map[snakeKey] = value.toDate().toIso8601String();
    } else if (value is DateTime) {
      map[snakeKey] = value.toIso8601String();
    } else if (value is GeoPoint) {
      // Should not hit here if we intercepted checkInLocation above, but just in case
      map[snakeKey + '_lat'] = value.latitude;
      map[snakeKey + '_lng'] = value.longitude;
    } else {
      map[snakeKey] = value;
    }
  });
  return map;
}
`;

code = code.replace(/Map<String, dynamic> _toSnakeCase[\s\S]*?return map;\n}/, replacement.trim());
fs.writeFileSync('mobile_app/lib/data/repositories/attendance_repository.dart', code);
