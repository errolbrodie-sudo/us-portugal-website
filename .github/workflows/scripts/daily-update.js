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

console.log(`[Daily Refresh] Running daily update for: ${todayFormatted}`);

// 1. Update JSON files in public/
const publicDir = path.resolve(__dirname, '../public');
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
      console.log(`✔ Updated JSON: ${file}`);
    } catch (err) {
      console.error(`✖ Error processing ${file}:`, err.message);
    }
  }
});

// 2. Update all HTML files in project root directly
const rootDir = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.html'));

htmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Matches "Last Updated: August 31, 2026", "Last Updated: Loading...", etc.
    const updatedContent = content.replace(
      /Last Updated:\s*(?:[A-Za-z]+\s+\d{1,2},\s*\d{4}|Loading\.\.\.)/g,
      `Last Updated: ${todayFormatted}`
    );

    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✔ Updated HTML date in: ${file}`);
    }
  } catch (err) {
    console.error(`✖ Error updating ${file}:`, err.message);
  }
});