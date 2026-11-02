import sharp from 'sharp';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const PROFILES = {
  cinematic: {
    densityRamp: " .,:;irsXA253hMHGS#9B&@",
    edgeRamp: { horizontal: '-', vertical: '|', diagRight: '/', diagLeft: '\\' },
    contrast: 1.3,
    edgeStrength: 0.8,
    edgeThreshold: 0.2,
    dithering: 'fs',
    gammaMode: 'auto',
  },
  harsh: {
    densityRamp: " .'`:!|/({%#@",
    edgeRamp: { horizontal: '=', vertical: '|', diagRight: '/', diagLeft: '\\' },
    contrast: 1.6,
    edgeStrength: 1.5,
    edgeThreshold: 0.12,
    dithering: 'fs',
    gammaMode: 'fixed',
    gamma: 0.6,
  },
};

const DEFAULTS = {
  aspectRatioY: 2.0,
  contrast: 1.3,
  gammaMode: 'auto',
  gamma: 0.72,
  autoGammaTarget: 0.45,
  dithering: 'fs',
  edgeThreshold: 0.15,
  edgeStrength: 1.0,
  styleProfile: 'cinematic',
  densityRamp: null,
  edgeRamp: null,
};

function getOptions(options = {}) {
  const profile = PROFILES[options.styleProfile || DEFAULTS.styleProfile] || PROFILES.cinematic;
  const merged = { ...DEFAULTS, ...profile, ...options };
  return {
    aspectRatioY: merged.aspectRatioY,
    contrast: merged.contrast,
    gammaMode: merged.gammaMode,
    gamma: merged.gamma,
    autoGammaTarget: merged.autoGammaTarget,
    dithering: merged.dithering,
    edgeThreshold: merged.edgeThreshold,
    edgeStrength: merged.edgeStrength,
    densityRamp: merged.densityRamp || profile.densityRamp,
    edgeRamp: merged.edgeRamp || profile.edgeRamp,
  };
}

function angleToEdgeChar(angleRad, edgeRamp) {
  let angle = angleRad;
  if (angle < 0) angle += Math.PI;
  if (angle > Math.PI) angle -= Math.PI;
  const deg = (angle * 180) / Math.PI;
  if (deg <= 22.5 || deg >= 157.5) return edgeRamp.horizontal;
  if (deg <= 67.5) return edgeRamp.diagRight;
  if (deg <= 112.5) return edgeRamp.vertical;
  return edgeRamp.diagLeft;
}

/**
 * 이미지 buffer → ASCII matrix (6계층 파이프라인)
 */
export async function imageToMatrix(imageBuffer, cols = 100, options = {}) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('imageToMatrix: valid image buffer is required');
  }
  if (typeof cols !== 'number' || cols < 10 || cols > 500) {
    throw new Error('imageToMatrix: cols must be a number between 10 and 500');
  }

  const opts = getOptions(options);
  const stepY = Math.round(opts.aspectRatioY);
  const densityRamp = opts.densityRamp;
  const rampLen = densityRamp.length;

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
  const width = info.width;
  const height = info.height;
  if (!data || width <= 0 || height <= 0) {
    throw new Error('imageToMatrix: invalid dimensions after resize');
  }

  // ─── 계층 1: 샘플링 (박스 평균) ───
  const rows = Math.floor(height / stepY);
  if (rows < 1) {
    throw new Error('imageToMatrix: image too small to sample');
  }

  const lumGrid = [];
  for (let r = 0; r < rows; r++) {
    lumGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      const yStart = r * stepY;
      const yEnd = Math.min(yStart + stepY, height);
      for (let y = yStart; y < yEnd; y++) {
        sum += data[c + y * width];
        count++;
      }
      lumGrid[r][c] = count > 0 ? sum / count / 255 : 0;
    }
  }

  // ─── 계층 2: 톤 (contrast + gamma) ───
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let lum = lumGrid[r][c];
      lum = clamp((lum - 0.5) * opts.contrast + 0.5, 0, 1);
      if (opts.gammaMode === 'fixed') {
        lum = Math.pow(lum, opts.gamma);
      }
      lumGrid[r][c] = clamp(lum, 0, 1);
    }
  }

  if (opts.gammaMode === 'auto') {
    let sum = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) sum += lumGrid[r][c];
    }
    const avgLum = sum / (rows * cols) || 0.5;
    let autoGamma = avgLum > 0 ? Math.log(opts.autoGammaTarget) / Math.log(avgLum) : 1;
    autoGamma = clamp(autoGamma, 0.3, 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        lumGrid[r][c] = clamp(Math.pow(lumGrid[r][c], autoGamma), 0, 1);
      }
    }
  }

  // Sobel용 원본 복사 (디더링 전)
  const lumGridOriginal = lumGrid.map((row) => row.slice());

  // ─── 계층 3: Floyd-Steinberg 디더링 ───
  if (opts.dithering === 'fs') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const oldLum = lumGrid[r][c];
        const rampIndex = Math.round(oldLum * (rampLen - 1));
        const newLum = rampIndex / (rampLen - 1);
        const error = oldLum - newLum;
        lumGrid[r][c] = newLum;

        if (c + 1 < cols) lumGrid[r][c + 1] += error * (7 / 16);
        if (r + 1 < rows && c > 0) lumGrid[r + 1][c - 1] += error * (3 / 16);
        if (r + 1 < rows) lumGrid[r + 1][c] += error * (5 / 16);
        if (r + 1 < rows && c + 1 < cols) lumGrid[r + 1][c + 1] += error * (1 / 16);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        lumGrid[r][c] = clamp(lumGrid[r][c], 0, 1);
      }
    }
  }

  // ─── 계층 4: 엣지 (Sobel on lumGridOriginal) ───
  const edgeMag = [];
  const edgeAngle = [];
  for (let r = 0; r < rows; r++) {
    edgeMag[r] = [];
    edgeAngle[r] = [];
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        edgeMag[r][c] = 0;
        edgeAngle[r][c] = 0;
        continue;
      }
      const gx =
        lumGridOriginal[r - 1][c + 1] + 2 * lumGridOriginal[r][c + 1] + lumGridOriginal[r + 1][c + 1] -
        (lumGridOriginal[r - 1][c - 1] + 2 * lumGridOriginal[r][c - 1] + lumGridOriginal[r + 1][c - 1]);
      const gy =
        lumGridOriginal[r + 1][c - 1] + 2 * lumGridOriginal[r + 1][c] + lumGridOriginal[r + 1][c + 1] -
        (lumGridOriginal[r - 1][c - 1] + 2 * lumGridOriginal[r - 1][c] + lumGridOriginal[r - 1][c + 1]);
      edgeMag[r][c] = Math.sqrt(gx * gx + gy * gy);
      edgeAngle[r][c] = Math.atan2(gy, gx);
    }
  }

  let maxEdge = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (edgeMag[r][c] > maxEdge) maxEdge = edgeMag[r][c];
    }
  }
  const edgeMagNorm = maxEdge > 0 ? edgeMag.map((row) => row.map((v) => v / maxEdge)) : edgeMag.map((row) => row.map(() => 0));

  const edgeCharGrid = [];
  const edgeScoreGrid = [];
  for (let r = 0; r < rows; r++) {
    edgeCharGrid[r] = [];
    edgeScoreGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      const mag = edgeMagNorm[r][c];
      if (mag > opts.edgeThreshold) {
        edgeScoreGrid[r][c] = mag * opts.edgeStrength;
        edgeCharGrid[r][c] = angleToEdgeChar(edgeAngle[r][c], opts.edgeRamp);
      } else {
        edgeScoreGrid[r][c] = 0;
        edgeCharGrid[r][c] = null;
      }
    }
  }

  // ─── 계층 5 & 6: 문자 선택 + 출력 ───
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lum = lumGrid[r][c];
      const edgeScore = edgeScoreGrid[r][c];
      const edgeMagVal = edgeMagNorm[r][c];

      let char;
      if (edgeScore > 0.5 && edgeCharGrid[r][c]) {
        char = edgeCharGrid[r][c];
      } else {
        const rampIdx = Math.round((1 - lum) * (rampLen - 1));
        char = densityRamp[clamp(rampIdx, 0, rampLen - 1)];
      }

      cells.push({
        r,
        c,
        char,
        brightness: lum,
        edge: edgeMagVal,
      });
    }
  }

  return { rows, cols, cells };
}

/**
 * 흰/오프화이트 배경 제거 — 모서리 샘플링 방식
 * 이미지 가장자리 픽셀에서 실제 배경색을 추정하고,
 * 배경색과의 유클리드 거리 기반으로 알파를 제거한다.
 *
 * @param {Buffer} imageBuffer - 입력 이미지 버퍼
 * @param {number} tolerance - 이 거리 이내면 완전 투명 (기본 60)
 * @param {number} fadeRange - tolerance ~ tolerance+fadeRange 구간은 페이드 (기본 40)
 * @returns {Promise<Buffer>} - 배경 제거된 PNG 버퍼
 */
export async function removeWhiteBackground(imageBuffer, tolerance = 60, fadeRange = 40) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);

  // 모서리 샘플링으로 실제 배경색 추정
  // 이미지의 상단, 하단, 좌측, 우측 가장자리 픽셀을 모두 수집
  const samples = [];
  for (let x = 0; x < width; x++) {
    samples.push(x * channels);                              // 상단 행
    samples.push(((height - 1) * width + x) * channels);     // 하단 행
  }
  for (let y = 0; y < height; y++) {
    samples.push((y * width) * channels);                    // 좌측 열
    samples.push((y * width + width - 1) * channels);        // 우측 열
  }

  let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
  for (const off of samples) {
    if (off + 2 < out.length) {
      sumR += out[off];
      sumG += out[off + 1];
      sumB += out[off + 2];
      cnt++;
    }
  }
  const bgR = Math.round(sumR / cnt);
  const bgG = Math.round(sumG / cnt);
  const bgB = Math.round(sumB / cnt);

  // 각 픽셀에 대해 배경색과의 거리 기반으로 알파 조절
  for (let i = 0; i < width * height; i++) {
    const off = i * channels;
    const r = out[off], g = out[off + 1], b = out[off + 2];
    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

    if (dist < tolerance) {
      // 배경색과 충분히 가까움 → 완전 투명
      out[off + 3] = 0;
    } else if (dist < tolerance + fadeRange) {
      // 경계 영역 → 부드럽게 페이드
      const fade = (dist - tolerance) / fadeRange;
      out[off + 3] = Math.round(255 * fade);
    }
    // else: 원본 알파 유지 (255)
  }

  return sharp(out, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}
