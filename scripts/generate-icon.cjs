const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SVG_PATH = path.resolve(__dirname, '../build/icon.svg');
const OUT_DIR = path.resolve(__dirname, '../build');

async function generate() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Render SVG at each size using sharp
  const pngBuffers = [];
  for (const size of SIZES) {
    const png = await sharp(svgBuffer, { density: Math.round(size * 72 / 16) })
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(png);
    console.log(`  Rendered ${size}x${size}`);
  }

  // Combine into ICO (to-ico expects largest first or individual sizes)
  // to-ico takes an array of buffers and picks the best sizes
  const ico = await toIco(pngBuffers);

  const icoPath = path.join(OUT_DIR, 'icon.ico');
  fs.writeFileSync(icoPath, ico);
  console.log(`\n  ICO written to build/icon.ico (${ico.length} bytes)`);
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
