const fs = require('fs');
let code = fs.readFileSync('src/lib/db/site_diary.ts', 'utf8');

code = code.replace(
`export const createSiteDiary = async (data: Omit<SiteDiaryEntry, 'id'>): Promise<string> => {
  const payload = {`,
`export const createSiteDiary = async (data: Omit<SiteDiaryEntry, 'id'>): Promise<string> => {
  const payload = {
    id: crypto.randomUUID(),`
);

fs.writeFileSync('src/lib/db/site_diary.ts', code);
