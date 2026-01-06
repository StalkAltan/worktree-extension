/**
 * Generate placeholder icons for the Chrome extension
 * These are simple solid-color PNG icons that can be replaced with proper icons later
 * 
 * Run with: bun run scripts/generate-icons.ts
 */

import { mkdir } from "fs/promises";
import { join, dirname } from "path";

const ROOT_DIR = dirname(dirname(import.meta.path));
const ICONS_DIR = join(ROOT_DIR, "public/icons");

// PNG signature and minimal IHDR/IDAT/IEND structure for a solid color image
function createPNG(size: number, r: number, g: number, b: number): Uint8Array {
  // Create raw RGBA pixel data (all pixels same color)
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = 255; // Alpha
  }

  // Create scanlines with filter byte (0 = no filter) for each row
  const scanlines = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    scanlines[y * (size * 4 + 1)] = 0; // Filter byte
    for (let x = 0; x < size * 4; x++) {
      scanlines[y * (size * 4 + 1) + 1 + x] = pixels[y * size * 4 + x];
    }
  }

  // Compress with deflate
  const compressed = Bun.deflateSync(scanlines);

  // CRC32 calculation
  const crcTable = makeCRCTable();
  
  function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeCRCTable(): number[] {
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  }

  // Build PNG
  const chunks: Uint8Array[] = [];
  
  // PNG signature
  chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size, false); // width
  ihdrView.setUint32(4, size, false); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = new Uint8Array(4 + 4 + 13 + 4);
  const ihdrChunkView = new DataView(ihdrChunk.buffer);
  ihdrChunkView.setUint32(0, 13, false); // length
  ihdrChunk.set([73, 72, 68, 82], 4); // "IHDR"
  ihdrChunk.set(ihdr, 8);
  const ihdrCrcData = new Uint8Array(4 + 13);
  ihdrCrcData.set([73, 72, 68, 82], 0);
  ihdrCrcData.set(ihdr, 4);
  ihdrChunkView.setUint32(21, crc32(ihdrCrcData), false);
  chunks.push(ihdrChunk);

  // IDAT chunk
  const idatChunk = new Uint8Array(4 + 4 + compressed.length + 4);
  const idatChunkView = new DataView(idatChunk.buffer);
  idatChunkView.setUint32(0, compressed.length, false); // length
  idatChunk.set([73, 68, 65, 84], 4); // "IDAT"
  idatChunk.set(compressed, 8);
  const idatCrcData = new Uint8Array(4 + compressed.length);
  idatCrcData.set([73, 68, 65, 84], 0);
  idatCrcData.set(compressed, 4);
  idatChunkView.setUint32(8 + compressed.length, crc32(idatCrcData), false);
  chunks.push(idatChunk);

  // IEND chunk
  const iendChunk = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  chunks.push(iendChunk);

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const png = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }

  return png;
}

async function generateIcons() {
  await mkdir(ICONS_DIR, { recursive: true });

  // Git branch color - a nice purple/violet
  const r = 130, g = 80, b = 223;

  const sizes = [16, 32, 48, 128];

  for (const size of sizes) {
    const png = createPNG(size, r, g, b);
    const filePath = join(ICONS_DIR, `icon${size}.png`);
    await Bun.write(filePath, png);
    console.log(`Created ${filePath}`);
  }

  console.log("\nPlaceholder icons generated successfully!");
  console.log("Note: These are simple solid-color placeholders.");
  console.log("Replace them with proper icons for production use.");
}

generateIcons().catch(console.error);
