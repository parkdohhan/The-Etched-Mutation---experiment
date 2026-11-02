'use client';

import { useEffect, useRef, useState } from 'react';

const ANCHOR_IMG_SIZE = 120;
const ANCHOR_ASCII_WIDTH = 180;
const ANCHOR_ASCII_HEIGHT = 100;
const ANCHOR_TEXT_PAD = 80;

function getAnchorMode(alignment) {
  if (alignment >= 0.65) return 'image';
  if (alignment >= 0.25) return 'ascii';
  return 'text';
}

function getAnchorSize(mode) {
  if (mode === 'image') return { w: ANCHOR_IMG_SIZE, h: ANCHOR_IMG_SIZE };
  if (mode === 'ascii') return { w: ANCHOR_ASCII_WIDTH, h: ANCHOR_ASCII_HEIGHT };
  return { w: ANCHOR_TEXT_PAD, h: 24 };
}

export default function FloatingAnchor({
  anchorKeyword,
  anchorImageUrl,
  anchorAscii,
  memoryText,
  alignment,
  width = 600,
  height = 500,
}) {
  const mode = getAnchorMode(alignment);
  const size = getAnchorSize(mode);

  const posRef = useRef({ x: width / 2 - size.w / 2, y: height / 2 - size.h / 2 });
  const velRef = useRef({
    vx: 0.4 * (Math.random() > 0.5 ? 1 : -1),
    vy: 0.35 * (Math.random() > 0.5 ? 1 : -1),
  });
  const [, setTick] = useState(0);
  const rafRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const W = width;
    const H = height;

    const loop = () => {
      const modeNow = getAnchorMode(alignment);
      const sizeNow = getAnchorSize(modeNow);
      let { x, y } = posRef.current;
      let { vx, vy } = velRef.current;

      x += vx;
      y += vy;

      if (x <= 0) {
        x = 0;
        vx = Math.abs(vx) * 0.98;
      }
      if (x + sizeNow.w >= W) {
        x = W - sizeNow.w;
        vx = -Math.abs(vx) * 0.98;
      }
      if (y <= 0) {
        y = 0;
        vy = Math.abs(vy) * 0.98;
      }
      if (y + sizeNow.h >= H) {
        y = H - sizeNow.h;
        vy = -Math.abs(vy) * 0.98;
      }

      x = Math.max(0, Math.min(W - sizeNow.w, x));
      y = Math.max(0, Math.min(H - sizeNow.h, y));
      posRef.current = { x, y };
      velRef.current = { vx, vy };
      setTick((n) => n + 1);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [width, height, alignment]);

  const pos = posRef.current;
  const x = pos.x;
  const y = pos.y;

  const filledMemoryText = memoryText
    ? (() => {
        const block = `${memoryText} · `;
        let out = '';
        while (out.length < 3000) out += block;
        return out;
      })()
    : '';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width,
        height,
        background: '#08080e',
        overflow: 'hidden',
        border: '1px solid rgba(196, 168, 130, 0.1)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 20,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            color: 'rgba(196, 168, 130, 0.08)',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 13,
            lineHeight: 1.8,
            wordBreak: 'break-all',
            userSelect: 'none',
            whiteSpace: 'pre-wrap',
          }}
        >
          {filledMemoryText}
        </div>
      </div>

      {mode === 'image' && anchorImageUrl && (
        <img
          src={anchorImageUrl}
          alt=""
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: ANCHOR_IMG_SIZE,
            height: ANCHOR_IMG_SIZE,
            objectFit: 'contain',
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        />
      )}

      {mode === 'ascii' && anchorAscii && (
        <pre
          style={{
            position: 'absolute',
            left: x,
            top: y,
            color: 'rgba(196, 168, 130, 0.7)',
            fontFamily: "'Courier New', monospace",
            fontSize: 6,
            lineHeight: 1,
            letterSpacing: 0,
            whiteSpace: 'pre',
            pointerEvents: 'none',
            margin: 0,
          }}
        >
          {anchorAscii}
        </pre>
      )}

      {mode === 'text' && (
        <span
          style={{
            position: 'absolute',
            left: x,
            top: y,
            color: 'rgba(196, 168, 130, 0.3)',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 18,
            letterSpacing: '0.3em',
            pointerEvents: 'none',
            animation: 'flicker 2s ease-in-out infinite',
          }}
        >
          {anchorKeyword}
        </span>
      )}
    </div>
  );
}
