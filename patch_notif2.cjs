const fs = require('fs');
let code = fs.readFileSync('src/lib/db/notifications.ts', 'utf8');

code = code.replace(
`  const insertData = {
    ...data,
    user_id: data.userId,`,
`  const insertData = {
    ...data,
    id: crypto.randomUUID(),
    user_id: data.userId,`
);

fs.writeFileSync('src/lib/db/notifications.ts', code);
