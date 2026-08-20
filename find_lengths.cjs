const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx}');
const unsafe = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('.length') && !line.includes('?.length')) {
      unsafe.push(`${file}:${i + 1}: ${line.trim()}`);
    }
  }
}

fs.writeFileSync('lengths.txt', unsafe.join('\n'));
