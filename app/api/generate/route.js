import Replicate from 'replicate';
import { imageToMatrix } from '@/lib/imageToMatrix';
import { buildBackgroundPrompt, buildAnchorObjectPrompt } from '@/lib/promptSystem';

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
  let prompt;
  let anchorPrompt;
  if (useSceneMode) {
    prompt = buildBackgroundPrompt({
      sceneText: String(sceneText).trim(),
      anchorObject: String(anchorObject).trim(),
      emotion: emotion ? String(emotion).trim() : undefined,
      temperature: temperature ? String(temperature).trim() : undefined,
      smell: smell ? String(smell).trim() : undefined,
      sound: sound ? String(sound).trim() : undefined,
    });
    anchorPrompt = buildAnchorObjectPrompt({
      anchorObject: String(anchorObject).trim(),
      sceneText: String(sceneText).trim(),
      emotion: emotion ? String(emotion).trim() : undefined,
    });
  } else if (rawPrompt && typeof rawPrompt === 'string' && rawPrompt.trim()) {
    prompt = rawPrompt.trim();
  } else {
    return Response.json({ error: 'prompt 또는 (sceneText + anchorObject) 필요' }, { status: 400 });
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const runFlux = async (p) => {
    let out;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        out = await replicate.run('black-forest-labs/flux-schnell', {
          input: {
            prompt: p,
            num_outputs: 1,
            aspect_ratio: '4:3',
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
    const [sceneOutput, anchorOutput] = await Promise.all([
      runFlux(prompt),
      runFlux(anchorPrompt),
    ]);
    const sceneBuffer = await toBuffer(sceneOutput);
    const anchorBuffer = await toBuffer(anchorOutput);
    if (!sceneBuffer) {
      return Response.json({ error: '배경 이미지 생성/다운로드 실패' }, { status: 502 });
    }
    if (!anchorBuffer) {
      return Response.json({ error: '앵커 이미지 생성/다운로드 실패' }, { status: 502 });
    }
    let matrix;
    let anchorMatrix;
    let sceneImageUrl;
    let anchorImageUrl;
    try {
      matrix = await imageToMatrix(sceneBuffer, 100);
      anchorMatrix = await imageToMatrix(anchorBuffer, 48);
      sceneImageUrl = `data:image/webp;base64,${sceneBuffer.toString('base64')}`;
      anchorImageUrl = `data:image/webp;base64,${anchorBuffer.toString('base64')}`;
    } catch (err) {
      console.error('imageToMatrix error:', err);
      return Response.json({ error: err.message || 'ASCII 변환 실패' }, { status: 500 });
    }
    const kw = (anchorObject && String(anchorObject).trim()) ? String(anchorObject).trim() : (anchorKeyword || '');
    const zone = anchorZone || { rStart: 0.3, rEnd: 0.7, cStart: 0.25, cEnd: 0.75 };
    return Response.json({
      imageUrl: sceneImageUrl,
      matrix,
      anchorImageUrl,
      anchorMatrix,
      anchorKeyword: kw,
      anchorZone: zone,
    });
  }

  let lastError;
  let output;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      output = await runFlux(prompt);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
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
