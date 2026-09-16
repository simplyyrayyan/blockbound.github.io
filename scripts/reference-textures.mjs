import { PNG } from 'pngjs';

// The reference pack uses both PNG and TGA, including RLE-compressed textures.
export function decodeTexture(bytes) {
  if (bytes[0] === 137 && bytes[1] === 80) return PNG.sync.read(bytes);
  const type = bytes[2], width = bytes.readUInt16LE(12), height = bytes.readUInt16LE(14), channels = bytes[16] / 8;
  if (bytes[1] || ![2, 10].includes(type) || ![3, 4].includes(channels) || !width || !height) throw new Error('Unsupported reference texture');
  const png = new PNG({ width, height }), top = !!(bytes[17] & 32), right = !!(bytes[17] & 16);
  let offset = 18 + bytes[0], pixel = 0;
  const write = source => {
    const x = pixel % width, y = Math.floor(pixel / width), target = ((top ? y : height - y - 1) * width + (right ? width - x - 1 : x)) * 4;
    png.data[target] = bytes[source + 2]; png.data[target + 1] = bytes[source + 1]; png.data[target + 2] = bytes[source]; png.data[target + 3] = channels === 4 ? bytes[source + 3] : 255; pixel++;
  };
  while (pixel < width * height) {
    if (type === 2) { write(offset); offset += channels; continue; }
    const header = bytes[offset++], count = (header & 127) + 1;
    for (let i = 0; i < count && pixel < width * height; i++) { write(offset); if (!(header & 128)) offset += channels; }
    if (header & 128) offset += channels;
  }
  return png;
}
