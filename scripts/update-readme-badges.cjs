const fs = require('fs');
const path = require('path');

const README_PATH = path.join(__dirname, '..', 'README.md');
const SRC_DIR = path.join(__dirname, '..', 'src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.mjs', '.cjs']);

function countLines(dir) {
  let total = 0;
  let files = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        const sub = countLines(fullPath);
        total += sub.total;
        files += sub.files;
      } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        total += content.split('\n').length;
        files++;
      }
    }
  } catch { /* ignore */ }
  return { total, files };
}

const { total, files } = countLines(SRC_DIR);
const formatted = total.toLocaleString('en-US');

let readme = fs.readFileSync(README_PATH, 'utf-8');

console.log(`Found ${files} source files with ${formatted} total lines in src/`);

const badgeRegex = /(total--lines-)[^-\s"]+/;
if (badgeRegex.test(readme)) {
  readme = readme.replace(badgeRegex, `$1~${Math.round(total / 1000)}k`);
}

const tableRegex = /(Total Lines \(`src\/`\)[^|]*\|\s*)[^|\r\n]+(?=\s*\|)/;
if (tableRegex.test(readme)) {
  readme = readme.replace(tableRegex, `$1~${formatted}`);
}

const sourceFilesRegex = /(Source Files[^|]*\|\s*)[^|\r\n]+(?=\s*\|)/;
if (sourceFilesRegex.test(readme)) {
  readme = readme.replace(sourceFilesRegex, `$1${files}`);
}

fs.writeFileSync(README_PATH, readme, 'utf-8');