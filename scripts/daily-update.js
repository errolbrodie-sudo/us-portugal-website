import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target date formatted as "Month Day, Year"
const todayFormatted = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

console.log(`[Daily Refresh] Updating platform data for: ${todayFormatted}`);

// 1. Update JSON files in public/
const publicDir = path.resolve(__dirname, '../public');
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
      console.error(`✖ Error processing ${file}:`, err.message);
    }
  } else {
    if (file === 'insurance-data.json') {
      fs.writeFileSync(filePath, JSON.stringify({ lastUpdated: todayFormatted }, null, 2) + '\n', 'utf8');
      console.log(`✔ Created missing ${file}`);
    }
  }
});

// 2. Scan and update all HTML files in project root
const rootDir = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.html'));

htmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Matches "Last Updated: August 31, 2026", "Last Updated: Loading...", etc.
    const dateRegex = /(Last Updated:\s*(?:<[^>]+>)*)([^<,\n\r]+(?:\s+\d{1,2},\s*\d{4}|Loading\.\.\.))/gi;

    const updatedContent = content.replace(dateRegex, (match, prefix) => {
      return `${prefix}${todayFormatted}`;
    });

    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✔ Updated HTML date in: ${file}`);
    } else {
      console.log(`ℹ No date pattern found in: ${file}`);
    }
  } catch (err) {
    console.error(`✖ Error updating ${file}:`, err.message);
  }
});