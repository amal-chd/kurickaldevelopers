const fs = require('fs');
let code = fs.readFileSync('src/lib/db/attendance.ts', 'utf8');

const replacement = `
const convertAttendanceToRow = (attendance: any): any => {
  const row: any = {};
  for (const key in attendance) {
    if (key === 'checkInLocation' || key === 'checkOutLocation') continue;
    if (Object.prototype.hasOwnProperty.call(attendance, key)) {
      const snakeKey = toSnakeCase(key);
      if (attendance[key] instanceof Timestamp || (attendance[key] && typeof attendance[key].toDate === 'function')) {
        row[snakeKey] = attendance[key].toDate().toISOString();
      } else {
        row[snakeKey] = attendance[key];
      }
    }
  }
  if (attendance.checkInLocation) {
    row.check_in_lat = attendance.checkInLocation.latitude;
    row.check_in_lng = attendance.checkInLocation.longitude;
  }
  if (attendance.checkOutLocation) {
    row.check_out_lat = attendance.checkOutLocation.latitude;
    row.check_out_lng = attendance.checkOutLocation.longitude;
  }
  return row;
};
`;

code = code.replace(/const convertAttendanceToRow = [\s\S]*?return row;\n};/, replacement.trim());
fs.writeFileSync('src/lib/db/attendance.ts', code);
