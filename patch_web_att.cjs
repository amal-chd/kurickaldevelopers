const fs = require('fs');
let code = fs.readFileSync('src/lib/db/attendance.ts', 'utf8');

const replacement = `
const convertRowToAttendance = (row: any): Attendance => {
  const attendance: any = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const camelKey = toCamelCase(key);
      if (row[key] !== null && (key === 'created_at' || key === 'updated_at' || key === 'timestamp' || (typeof row[key] === 'string' && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/.test(row[key])))) {
        attendance[camelKey] = Timestamp.fromDate(new Date(row[key]));
      } else {
        attendance[camelKey] = row[key];
      }
    }
  }
  
  // Reconstruct GeoPoints
  if (row.check_in_lat != null && row.check_in_lng != null) {
    attendance.checkInLocation = { latitude: row.check_in_lat, longitude: row.check_in_lng };
  }
  if (row.check_out_lat != null && row.check_out_lng != null) {
    attendance.checkOutLocation = { latitude: row.check_out_lat, longitude: row.check_out_lng };
  }
  
  return attendance as Attendance;
};
`;

code = code.replace(/const convertRowToAttendance = [\s\S]*?return attendance as Attendance;\n};/, replacement.trim());
fs.writeFileSync('src/lib/db/attendance.ts', code);
