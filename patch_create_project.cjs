const fs = require('fs');
let code = fs.readFileSync('src/lib/db/projects.ts', 'utf8');

code = code.replace(
`export const createProject = async (data: Omit<Project, 'id'>): Promise<string> => {
  const rowData = convertProjectToRow(data);`,
`export const createProject = async (data: Omit<Project, 'id'>): Promise<string> => {
  const rowData = convertProjectToRow(data);
  rowData.id = crypto.randomUUID();`
);

fs.writeFileSync('src/lib/db/projects.ts', code);
