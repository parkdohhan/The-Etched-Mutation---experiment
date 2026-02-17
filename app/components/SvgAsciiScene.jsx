'use client';

import { useMemo } from 'react';

const CHAR_W = 5.8;
const CHAR_H = 10;
const SIMPLE_CHARS = '.:;-~|/\\';
const MINIMAL_CHARS = '.: ';

// 0 = 실사(앵커만), 1 = ASCII(앵커), 2 = 텍스트('조개' 등)
function getLevel(alignment) {
  if (alignment >= 0.65) return 0;
  if (alignment >= 0.25) return 1;
  return 2;
}

function isAnchorCell(cell, matrix, anchorZone) {
  const rn = cell.r / matrix.rows;
  const cn = cell.c / matrix.cols;
  return rn >= anchorZone.rStart && rn <= anchorZone.rEnd &&
    cn >= anchorZone.cStart && cn <= anchorZone.cEnd;
}

function brightnessToSimple(brightness) {
  const idx = Math.floor((1 - brightness) * (SIMPLE_CHARS.length - 1));
  return SIMPLE_CHARS[Math.min(Math.max(0, idx), SIMPLE_CHARS.length - 1)];
}

function brightnessToMinimal(brightness) {
  if (brightness > 0.66) return ' ';
  if (brightness > 0.33) return '.';
  return ':';
}

export default function SvgAsciiScene({
  matrix,
  alignment,
  anchorZone,
  anchorKeyword,
  imageUrl,
  anchorImageUrl,
  anchorMatrix,
}) {
  const level = getLevel(alignment);
  const { rows, cols, cells } = matrix;
  const width = cols * CHAR_W;
  const height = rows * CHAR_H;
  const hasSeparateAnchor = !!(anchorImageUrl && anchorMatrix);

  const anchorZonePx = useMemo(() => ({
    x: anchorZone.cStart * cols * CHAR_W,
    y: anchorZone.rStart * rows * CHAR_H,
    w: (anchorZone.cEnd - anchorZone.cStart) * cols * CHAR_W,
    h: (anchorZone.rEnd - anchorZone.rStart) * rows * CHAR_H,
  }), [anchorZone, cols, rows]);

  const backgroundElements = useMemo(() => {
    const out = [];
    for (const cell of cells) {
      if (cell.char === ' ') continue;
      if (isAnchorCell(cell, matrix, anchorZone)) continue;
      const isEdge = cell.edge > 0.25;
      const r = isEdge ? 196 : 140;
      const g = isEdge ? 168 : 145;
      const b = isEdge ? 130 : 155;
      const alpha = 0.2 + cell.brightness * 0.5 + (cell.edge > 0.3 ? 0.15 : 0);
      out.push(
        <text
          key={`${cell.r}-${cell.c}`}
          x={cell.c * CHAR_W}
          y={cell.r * CHAR_H + 8}
          fill={`rgba(${r},${g},${b},${alpha})`}
          fontSize={9}
          fontFamily="'Courier New', monospace"
        >
          {cell.char}
        </text>
      );
    }
    return out;
  }, [cells, matrix, anchorZone]);

  const anchorElementsFromScene = useMemo(() => {
    if (hasSeparateAnchor) return null;
    const anchorCells = cells.filter((c) => isAnchorCell(c, matrix, anchorZone));
    if (level === 0) return null;
    if (level === 2) return null;
    const el = [];
    for (const cell of anchorCells) {
      if (cell.char === ' ') continue;
      const alpha = 0.2 + cell.brightness * 0.6 + (cell.edge > 0.25 ? 0.15 : 0);
      el.push(
        <text
          key={`a-${cell.r}-${cell.c}`}
          x={cell.c * CHAR_W}
          y={cell.r * CHAR_H + 8}
          fill={`rgba(196,168,130,${alpha})`}
          fontSize={9}
          fontFamily="'Courier New', monospace"
        >
          {cell.char}
        </text>
      );
    }
    return el;
  }, [cells, matrix, anchorZone, level, hasSeparateAnchor]);

  const anchorLayerSeparate = useMemo(() => {
    if (!hasSeparateAnchor || !anchorMatrix) return null;
    const { rows: aRows, cols: aCols, cells: aCells } = anchorMatrix;
    const scaleX = anchorZonePx.w / (aCols * CHAR_W);
    const scaleY = anchorZonePx.h / (aRows * CHAR_H);

    if (level === 0) {
      return (
        <g clipPath="url(#anchorClip)">
          <image
            href={anchorImageUrl}
            x={anchorZonePx.x}
            y={anchorZonePx.y}
            width={anchorZonePx.w}
            height={anchorZonePx.h}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      );
    }

    if (level === 2) {
      return (
        <>
          <rect
            x={anchorZonePx.x}
            y={anchorZonePx.y}
            width={anchorZonePx.w}
            height={anchorZonePx.h}
            fill="rgba(0,0,0,0.5)"
          />
          <text
            x={anchorZonePx.x + anchorZonePx.w / 2}
            y={anchorZonePx.y + anchorZonePx.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(196,168,130,0.5)"
            fontSize={Math.min(18, anchorZonePx.h * 0.2)}
            fontFamily="'Cormorant Garamond', Georgia, serif"
            style={{ letterSpacing: '0.2em', animation: 'flicker 1.5s ease-in-out infinite' }}
          >
            {anchorKeyword}
          </text>
        </>
      );
    }

    const el = [];
    for (const cell of aCells) {
      if (cell.char === ' ') continue;
      const alpha = 0.25 + cell.brightness * 0.55 + (cell.edge > 0.25 ? 0.15 : 0);
      el.push(
        <text
          key={`ax-${cell.r}-${cell.c}`}
          x={anchorZonePx.x + cell.c * CHAR_W * scaleX}
          y={anchorZonePx.y + cell.r * CHAR_H * scaleY + 8 * scaleY}
          fill={`rgba(196,168,130,${Math.min(1, alpha)})`}
          fontSize={9 * Math.min(scaleX, scaleY)}
          fontFamily="'Courier New', monospace"
        >
          {cell.char}
        </text>
      );
    }
    return (
      <g clipPath="url(#anchorClip)">
        {el}
      </g>
    );
  }, [hasSeparateAnchor, anchorMatrix, anchorImageUrl, anchorKeyword, level, anchorZonePx]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', background: '#08080e' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="anchorClip">
          <rect x={anchorZonePx.x} y={anchorZonePx.y} width={anchorZonePx.w} height={anchorZonePx.h} />
        </clipPath>
        <linearGradient id="anchorGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(196,168,130,0.2)" />
          <stop offset="100%" stopColor="rgba(196,168,130,0.05)" />
        </linearGradient>
      </defs>

      <g>{backgroundElements}</g>

      {hasSeparateAnchor ? (
        anchorLayerSeparate
      ) : (
        <>
          {level === 0 && (
            <g clipPath="url(#anchorClip)">
              {imageUrl ? (
                <image href={imageUrl} x={0} y={0} width={width} height={height} preserveAspectRatio="none" />
              ) : (
                <>
                  <rect x={anchorZonePx.x} y={anchorZonePx.y} width={anchorZonePx.w} height={anchorZonePx.h} fill="url(#anchorGrad)" />
                  <text
                    x={anchorZonePx.x + anchorZonePx.w / 2}
                    y={anchorZonePx.y + anchorZonePx.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(196,168,130,0.5)"
                    fontSize={12}
                    fontFamily="'Cormorant Garamond', Georgia, serif"
                  >
                    {anchorKeyword}
                  </text>
                </>
              )}
            </g>
          )}
          {level === 1 && <g>{anchorElementsFromScene}</g>}
          {level === 2 && (
            <>
              <rect x={anchorZonePx.x} y={anchorZonePx.y} width={anchorZonePx.w} height={anchorZonePx.h} fill="rgba(0,0,0,0.4)" />
              <text
                x={anchorZonePx.x + anchorZonePx.w / 2}
                y={anchorZonePx.y + anchorZonePx.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(196,168,130,0.3)"
                fontSize={14}
                fontFamily="'Cormorant Garamond', Georgia, serif"
                style={{ letterSpacing: '0.3em', animation: 'flicker 1.5s ease-in-out infinite' }}
              >
                {anchorKeyword}
              </text>
            </>
          )}
        </>
      )}
    </svg>
  );
}
