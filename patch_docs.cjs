const fs = require('fs');
let code = fs.readFileSync('src/lib/db/documents.ts', 'utf8');

code = code.replace(
`export const createDocument = async (data: Omit<TDocument, 'id'>): Promise<string> => {
  const payload = {
    ...data,`,
`export const createDocument = async (data: Omit<TDocument, 'id'>): Promise<string> => {
  const payload = {
    ...data,
    id: crypto.randomUUID(),`
);

fs.writeFileSync('src/lib/db/documents.ts', code);
