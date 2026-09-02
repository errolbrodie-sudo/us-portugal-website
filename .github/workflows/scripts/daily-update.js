import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target date formatted as "Month Day, Year" (e.g. September 2, 2026)
const todayFormatted = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

const publicDir = path.resolve(__dirname, '../public');

// List of all dynamic JSON files in public/
const dataFiles = [
  'shipping-data.json',
  'pet-data.json',
  'education-data.json',
  'visa-data.json',
  'rent-data.json'
];

console.log(`[Daily Refresh] Running daily update for: ${todayFormatted}`);

dataFiles.forEach(file => {
  const filePath = path.join(publicDir, file);

  if (fs.existsSync(filePath)) {
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Update lastUpdated timestamp
      content.lastUpdated = todayFormatted;

      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
      console.log(`✔ Successfully updated ${file}`);
    } catch (err) {
      console.error(`✖ Error processing ${file}:`, err.message);
    }
  } else {
    console.log(`ℹ Skipped ${file} (not found in public/)`);
  }
});

// Also update static date occurrence in index.html
const indexPath = path.resolve(__dirname, '../index.html');
if (fs.existsSync(indexPath)) {
  try {
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    indexHtml = indexHtml.replace(
      /Last Updated:\s*[A-Za-z]+\s+\d{1,2},\s*\d{4}/g,
      `Last Updated: ${todayFormatted}`
    );
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log('✔ Successfully updated index.html');
  } catch (err) {
    console.error('✖ Error processing index.html:', err.message);
  }
}