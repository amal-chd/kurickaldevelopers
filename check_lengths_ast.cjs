const fs = require('fs');

const lines = fs.readFileSync('all_lengths.txt', 'utf8').split('\n');

const unsafe = lines.filter(line => {
  if (!line.trim()) return false;
  if (line.includes('Object.keys')) return false;
  if (line.includes('Object.values')) return false;
  if (line.includes('filter(') && !line.includes('].length')) return false; 
  if (line.includes('].length') && line.includes('.filter')) return false;
  // If it's Array.from().length it's safe
  if (line.includes('Array.from')) return false;
  
  return true;
});

console.log(unsafe.join('\n'));
