import sharp from 'sharp';

const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

/**
 * 이미지 buffer를 ASCII 매트릭스 JSON으로 변환
 * @param {Buffer} imageBuffer - PNG/JPEG 이미지 버퍼
 * @param {number} cols - 가로 셀 수 (기본 100)
 * @returns {Promise<{ rows: number, cols: number, cells: Array }>}
 */
export async function imageToMatrix(imageBuffer, cols = 100) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('imageToMatrix: valid image buffer is required');
  }
  if (typeof cols !== 'number' || cols < 10 || cols > 500) {
    throw new Error('imageToMatrix: cols must be a number between 10 and 500');
  }

  let resized;
  try {
    resized = await sharp(imageBuffer)
      .resize({ width: cols })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    throw new Error(`imageToMatrix: failed to process image (${err.message})`);
  }

  const { data, info } = resized;
  const { width, height } = info;

  if (!data || !info || width <= 0 || height <= 0) {
    throw new Error('imageToMatrix: invalid image dimensions after resize');
  }

  const sampleStep = 2;
  const rows = Math.floor(height / sampleStep);
  if (rows < 1) {
    throw new Error('imageToMatrix: image too small to sample');
  }

  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < width; c++) {
      grid[r][c] = data[r * sampleStep * width + c];
    }
  }

  const edges = [];
  for (let r = 0; r < rows; r++) {
    edges[r] = [];
    for (let c = 0; c < width; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === width - 1) {
        edges[r][c] = 0;
        continue;
      }
      const gx = (grid[r - 1][c + 1] + 2 * grid[r][c + 1] + grid[r + 1][c + 1]) -
        (grid[r - 1][c - 1] + 2 * grid[r][c - 1] + grid[r + 1][c - 1]);
      const gy = (grid[r + 1][c - 1] + 2 * grid[r + 1][c] + grid[r + 1][c + 1]) -
        (grid[r - 1][c - 1] + 2 * grid[r - 1][c] + grid[r - 1][c + 1]);
      edges[r][c] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  let maxEdge = 0, minB = 255, maxB = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < width; c++) {
      if (edges[r][c] > maxEdge) maxEdge = edges[r][c];
      if (grid[r][c] < minB) minB = grid[r][c];
      if (grid[r][c] > maxB) maxB = grid[r][c];
    }
  }
  const bRange = maxB - minB || 1;

  const cells = [];
  const gamma = 0.72;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < width; c++) {
      let b = ((grid[r][c] - minB) / bRange) * 255;
      b = Math.pow(b / 255, gamma) * 255;
      const edgeNorm = maxEdge > 0 ? edges[r][c] / maxEdge : 0;
      b = b * (1 - edgeNorm * 0.45);
      b = Math.max(0, Math.min(255, b));

      const charIdx = Math.floor(((255 - b) / 255) * (RAMP.length - 1));
      cells.push({
        r,
        c,
        char: RAMP[Math.min(charIdx, RAMP.length - 1)],
        brightness: b / 255,
        edge: edgeNorm,
      });
    }
  }

  return { rows, cols: width, cells };
}
