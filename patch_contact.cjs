const fs = require('fs');
let code = fs.readFileSync('src/lib/db/contact_inquiries.ts', 'utf8');

code = code.replace(
`    .insert({
      ...insertData,
      created_at: new Date().toISOString(),`,
`    .insert({
      ...insertData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),`
);

fs.writeFileSync('src/lib/db/contact_inquiries.ts', code);
