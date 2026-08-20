import { supabase } from '../src/lib/supabaseClient';
import { getProjects } from '../src/lib/db/projects';

async function test() {
  console.log("Testing getProjects...");
  try {
    const projects = await getProjects();
    console.log("Projects:", projects.length);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
