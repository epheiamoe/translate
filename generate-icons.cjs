const fs = require('fs');
const path = require('path');

const sourceIcon = path.join(__dirname, 'app图标.png');
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(sourceIcon)) {
  console.error('Source icon not found:', sourceIcon);
  process.exit(1);
}

const sharp = require('sharp');

async function generateIcons() {
  const sourceBuffer = fs.readFileSync(sourceIcon);
  
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  
  for (const size of sizes) {
    const outputPath = path.join(publicDir, `app-icon-${size}.png`);
    await sharp(sourceBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: app-icon-${size}.png`);
  }
  
  await sharp(sourceBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'app-icon-512.png'));
  
  await sharp(sourceBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'app-icon-192.png'));
  
  await sharp(sourceBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'app-icon.png'));
  
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);