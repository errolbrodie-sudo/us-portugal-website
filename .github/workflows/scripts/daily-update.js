import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Current date formatted as "Month Day, Year"
const todayFormatted = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

console.log(`[Daily Refresh] Running refresh for: ${todayFormatted}`);

// Locate root project directory
const rootDir = fs.existsSync(path.resolve(__dirname, '../index.html'))
  ? path.resolve(__dirname, '..')
  : process.cwd();

console.log(`[Daily Refresh] Working directory: ${rootDir}`);

// 1. Update JSON files in public/
const publicDir = path.join(rootDir, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const dataFiles = [
  'shipping-data.json',
  'pet-data.json',
  'education-data.json',
  'visa-data.json',
  'rent-data.json',
  'insurance-data.json'
];

dataFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  if (fs.existsSync(filePath)) {
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      content.lastUpdated = todayFormatted;
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
      console.log(`✔ Updated JSON timestamp: ${file}`);
    } catch (err) {
      console.error(`✖ Error in ${file}:`, err.message);
    }
  } else if (file === 'insurance-data.json') {
    fs.writeFileSync(filePath, JSON.stringify({ lastUpdated: todayFormatted }, null, 2) + '\n', 'utf8');
    console.log(`✔ Created: insurance-data.json`);
  }
});

// 2. Scan and replace "Last Updated: ..." in EVERY .html file
const allFiles = fs.readdirSync(rootDir);
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));

console.log(`[Daily Refresh] Found HTML files: ${htmlFiles.join(', ')}`);

htmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  try {
    const originalContent = fs.readFileSync(filePath, 'utf8');

    // Matches "Last Updated:" followed by any date text up until a tag or newline
    const updatedContent = originalContent.replace(
      /Last Updated:\s*(?:<[^>]+>)*([A-Za-z0-9,.\s]+?)(?=<\/|\n|\r|$)/g,
      `Last Updated: ${todayFormatted}`
    );

    if (originalContent !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✔ Replaced date in: ${file}`);
    } else {
      console.log(`ℹ No "Last Updated:" phrase changed in: ${file}`);
    }
  } catch (err) {
    console.error(`✖ Failed reading ${file}:`, err.message);
  }
});