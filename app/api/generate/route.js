import Replicate from 'replicate';
import { imageToMatrix, removeWhiteBackground } from '@/lib/imageToMatrix';
import { buildAnchorObjectPrompt } from '@/lib/promptSystem';

async function getImageUrl(output) {
  const getUrl = async (v) => {
    if (typeof v === 'string') return v;
    if (v && typeof v.url === 'function') {
      const u = v.url();
      return typeof u?.then === 'function' ? await u : u;
    }
    if (v && typeof v.url === 'string') return v.url;
    return null;
  };
  const first = Array.isArray(output) && output.length > 0 ? output[0] : output;
  return first ? getUrl(first) : null;
}

function matrixToAsciiString(matrix) {
  const { rows, cols, cells } = matrix;
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const cell = cells[r * cols + c];
      line += cell ? cell.char : ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export async function POST(request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return Response.json(
      { error: 'REPLICATE_API_TOKEN is not configured' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    prompt: rawPrompt,
    anchorKeyword,
    anchorZone,
    sceneText,
    anchorObject,
    emotion,
    temperature,
    smell,
    sound,
  } = body;

  const useSceneMode = !!(sceneText && anchorObject);
  let anchorPrompt;
  if (useSceneMode) {
    anchorPrompt = buildAnchorObjectPrompt({
      anchorObject: String(anchorObject).trim(),
      sceneText: String(sceneText).trim(),
      emotion: emotion ? String(emotion).trim() : undefined,
    });
    console.log('[PROMPT] anchor:', anchorPrompt);
  } else if (rawPrompt && typeof rawPrompt === 'string' && rawPrompt.trim()) {
    // 직접 프롬프트 모드
  } else {
    return Response.json({ error: 'prompt 또는 (sceneText + anchorObject) 필요' }, { status: 400 });
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const runFlux = async (p, aspectRatio = '4:3') => {
    let out;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        out = await replicate.run('black-forest-labs/flux-schnell', {
          input: {
            prompt: p,
            num_outputs: 1,
            aspect_ratio: aspectRatio,
            output_format: 'webp',
            output_quality: 80,
            go_fast: true,
            num_inference_steps: 4,
          },
        });
        break;
      } catch (err) {
        const is429 = err.message?.includes('429') || err.message?.toLowerCase().includes('throttl');
        if (is429 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        throw err;
      }
    }
    return out;
  };

  const toBuffer = async (output) => {
    const first = Array.isArray(output) ? output[0] : output;
    if (Buffer.isBuffer(first) || first instanceof Uint8Array) {
      return Buffer.isBuffer(first) ? first : Buffer.from(first);
    }
    if (first && typeof first.blob === 'function') {
      const blob = await first.blob();
      return Buffer.from(await blob.arrayBuffer());
    }
    if (first && typeof first.arrayBuffer === 'function') {
      return Buffer.from(await first.arrayBuffer());
    }
    const url = await getImageUrl(output);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  };

  if (useSceneMode) {
    const anchorObj = String(anchorObject).trim();

    let anchorOutput;
    try {
      anchorOutput = await runFlux(anchorPrompt, '1:1');
    } catch (err) {
      console.error('Scene mode error:', err);
      return Response.json(
        { error: err.message || '앵커 이미지(Flux) 생성 실패' },
        { status: 502 }
      );
    }

    const anchorBuffer = await toBuffer(anchorOutput);
    if (!anchorBuffer) {
      return Response.json({ error: '앵커 이미지 생성/다운로드 실패' }, { status: 502 });
    }

    // 누끼 적용 (모서리 샘플링 → 투명 PNG)
    const cleanedBuffer = await removeWhiteBackground(anchorBuffer, 60, 40);
    const anchorImageUrl = `data:image/png;base64,${cleanedBuffer.toString('base64')}`;

    // ASCII 변환은 원본 buffer로 (누끼 전 — 투명 영역이 ASCII에 영향주면 안 됨)
    let anchorMatrix;
    try {
      anchorMatrix = await imageToMatrix(anchorBuffer, 48);
    } catch (err) {
      console.error('imageToMatrix error:', err);
      return Response.json({ error: err.message || '앵커 ASCII 변환 실패' }, { status: 500 });
    }
    const anchorAscii = matrixToAsciiString(anchorMatrix);

    const memoryText = [
      String(sceneText).trim(),
      anchorObj,
      emotion && String(emotion).trim(),
      temperature && `${String(temperature).trim()} 공기`,
      smell && `${String(smell).trim()} 냄새`,
      sound && `${String(sound).trim()} 소리`,
    ].filter(Boolean).join(' · ');

    const kw = anchorObj || anchorKeyword || '';
    return Response.json({
      anchorImageUrl,
      anchorAscii,
      anchorKeyword: kw,
      memoryText,
    });
  }

  const prompt = rawPrompt.trim();
  let output;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      output = await runFlux(prompt);
      break;
    } catch (err) {
      if (attempt === 3) {
        return Response.json(
          { error: err.message || 'Image generation failed' },
          { status: 502 }
        );
      }
    }
  }

  const imageBuffer = await toBuffer(output);
  if (!imageBuffer) {
    return Response.json(
      { error: 'Replicate에서 이미지 데이터를 받지 못했습니다.' },
      { status: 502 }
    );
  }

  const finalImageUrl = `data:image/webp;base64,${imageBuffer.toString('base64')}`;
  let matrix;
  try {
    matrix = await imageToMatrix(imageBuffer, 100);
  } catch (err) {
    console.error('imageToMatrix error:', err);
    return Response.json(
      { error: err.message || 'ASCII conversion failed' },
      { status: 500 }
    );
  }

  return Response.json({
    imageUrl: finalImageUrl,
    matrix,
    anchorKeyword: anchorKeyword || '',
    anchorZone: anchorZone || { rStart: 0.3, rEnd: 0.7, cStart: 0.25, cEnd: 0.75 },
  });
}
