const fs = require('fs');
let code = fs.readFileSync('src/lib/db/roles.ts', 'utf8');

code = code.replace(
`export const createRole = async (data: Omit<Role, 'id'>): Promise<string> => {
  const { data: inserted, error } = await supabase.from('roles').insert([{ ...data, created_at: new Date().toISOString() }]).select('id').single();`,
`export const createRole = async (data: Omit<Role, 'id'>): Promise<string> => {
  const { data: inserted, error } = await supabase.from('roles').insert([{ ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select('id').single();`
);

fs.writeFileSync('src/lib/db/roles.ts', code);
