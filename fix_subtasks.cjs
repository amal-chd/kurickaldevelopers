const fs = require('fs');
const file = 'src/lib/db/subtasks.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /assignedTo: d\.assigned_to,/g,
  `isDone: d.is_done,
      completedBy: d.completed_by,`
);
code = code.replace(
  /assigned_to: \(data as any\)\.assignedTo,/g,
  `is_done: data.isDone || false,
    completed_by: data.completedBy || null,`
);
code = code.replace(
  /delete \(payload as any\)\.assignedTo;/g,
  `delete (payload as any).isDone;
  delete (payload as any).completedBy;`
);

code = code.replace(
  /if \(payload\.assignedTo !== undefined\) \{[\s\S]*?delete payload\.assignedTo;\s*\}/g,
  `if (payload.isDone !== undefined) {
    payload.is_done = payload.isDone;
    delete payload.isDone;
  }
  if (payload.completedBy !== undefined) {
    payload.completed_by = payload.completedBy;
    delete payload.completedBy;
  }`
);

fs.writeFileSync(file, code);
