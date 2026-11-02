/**
 * FLUX schnell용 프롬프트 시스템
 *
 * 핵심 원칙:
 * 1. sceneText가 프롬프트의 첫 문장 (Flux는 앞쪽 토큰에 가중치)
 * 2. 한글 → 영어 번역 (Flux는 영어 전용)
 * 3. 감정/온도/냄새/소리는 보조 수식어 (장소를 덮어쓰면 안 됨)
 */

// ─── 한글 → 영어 번역 ───

const KO_SCENE_TO_EN = {
  병원: 'hospital room',
  병실: 'hospital ward',
  응급실: 'emergency room',
  수술실: 'operating room',
  바다: 'ocean shoreline',
  바닷가: 'beach',
  해변: 'beach',
  방: 'bedroom',
  거실: 'living room',
  부엌: 'kitchen',
  주방: 'kitchen',
  교실: 'classroom',
  학교: 'school',
  공원: 'park',
  옥상: 'rooftop',
  지하: 'basement',
  골목: 'narrow alley',
  길: 'street',
  카페: 'cafe',
  식당: 'restaurant',
  역: 'train station',
  버스: 'bus stop',
  차: 'car interior',
  숲: 'forest',
  산: 'mountain',
  절: 'temple',
  교회: 'church',
  묘지: 'cemetery',
  놀이터: 'playground',
  지하철: 'subway station',
  복도: 'hallway corridor',
  계단: 'stairwell',
  화장실: 'bathroom',
  비: 'rain',
  눈: 'snow',
  밤: 'at night',
  새벽: 'at dawn',
  저녁: 'at dusk',
  아침: 'in the morning',
  오후: 'in the afternoon',
  안개: 'fog',
  창문: 'window',
  문: 'door',
  거울: 'mirror',
  난간: 'railing',
};

const KO_OBJECT_TO_EN = {
  침대: 'hospital bed',
  베개: 'pillow',
  이불: 'blanket',
  액자: 'picture frame',
  사진: 'photograph',
  시계: 'wall clock',
  조개: 'seashell',
  조개껍질: 'seashell',
  의자: 'chair',
  책: 'book',
  책상: 'desk',
  전화기: 'telephone',
  편지: 'letter',
  일기장: 'diary',
  인형: 'doll',
  반지: 'ring',
  목걸이: 'necklace',
  열쇠: 'key',
  가방: 'bag',
  신발: 'shoes',
  우산: 'umbrella',
  컵: 'cup',
  꽃: 'flower',
  촛불: 'candle',
  거울: 'mirror',
  안경: 'glasses',
  모자: 'hat',
  담요: 'blanket',
  약: 'medicine bottle',
  주사기: 'syringe',
  링거: 'IV drip stand',
  붕대: 'bandage',
  목발: 'crutch',
  휠체어: 'wheelchair',
  청진기: 'stethoscope',
  차트: 'medical chart',
  칼: 'knife',
  라이터: 'lighter',
  담배: 'cigarette',
  술병: 'liquor bottle',
  피아노: 'piano',
  기타: 'guitar',
  카세트: 'cassette tape',
  레코드: 'vinyl record',
  TV: 'old television',
  라디오: 'radio',
};

function translateToEn(text, map) {
  if (!text) return '';
  let result = text;
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const found = [];
  for (const ko of keys) {
    if (result.includes(ko)) {
      found.push(map[ko]);
      result = result.replace(new RegExp(ko, 'g'), '');
    }
  }
  return found.join(', ');
}

// ─── 보조 매핑 ───

const TEMP_TO_LIGHT = {
  차가: 'cold blue-white fluorescent light, clinical sterile glow',
  서늘: 'pale grey daylight through frosted glass',
  미지근: 'flat overcast light, neutral',
  따뜻: 'warm amber tungsten bulb, golden dust particles',
  뜨거: 'harsh overhead halogen, burnt orange, oppressive',
};

const EMOTION_TO_TONE = {
  무서: 'deep shadows, single harsh light, claustrophobic',
  두려: 'deep shadows, single harsh light, claustrophobic',
  공포: 'near-total darkness, one slit of light from door crack',
  슬프: 'soft grey, rain-light diffusion, flat and heavy',
  슬픔: 'soft grey, rain-light diffusion, flat and heavy',
  그리: 'faded sepia warmth, edges going soft',
  분노: 'red-shifted shadows, hard angles, cracked surfaces',
  화가: 'red-shifted shadows, hard angles, cracked surfaces',
  화남: 'red-shifted shadows, hard angles, cracked surfaces',
  죄책: 'sickly green fluorescent, institutional, nowhere to hide',
  후회: 'golden hour fading to cold blue, long shadows',
  외로: 'vast empty space, single distant light, cold blue-grey',
  고립: 'vast empty space, single distant light, cold blue-grey',
  무감: 'flat white-grey, zero shadows, clinical void',
  공허: 'flat white-grey, zero shadows, clinical void',
  평화: 'gentle morning light through sheer curtain, dust motes',
  안도: 'gentle morning light through sheer curtain, dust motes',
  사랑: 'warm backlight glow, soft bokeh, intimate',
  희망: 'single beam of dawn light cutting through dark room',
};

const SOUND_TO_DETAIL = {
  빗소리: 'rain streaks on windowpane',
  시계: 'analog wall clock in shadow',
  TV: 'CRT television static glow',
  텔레비전: 'CRT television static glow',
  바람: 'curtain billowing from cracked window',
  새: 'bare tree branch visible through window',
  기계: 'medical monitor LED in dark corner',
  모니터: 'medical monitor LED in dark corner',
  발소리: 'long empty corridor, polished floor',
  울음: 'thin wall, wallpaper peeling',
  물: 'dripping faucet, foggy mirror',
  전화: 'rotary phone on side table',
  사이렌: 'red-blue light pulsing through blinds',
  피아노: 'upright piano, sheet music scattered',
};

function findMatch(input, map) {
  if (!input || typeof input !== 'string') return null;
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (input.includes(key)) return map[key];
  }
  return null;
}

// ─── 프롬프트 빌더 ───

export function buildBackgroundPrompt(p) {
  const { sceneText, anchorObject, emotion, temperature, smell, sound } = p;

  const sceneEn = translateToEn(sceneText, KO_SCENE_TO_EN);
  const anchorEn = translateToEn(anchorObject, KO_OBJECT_TO_EN) || anchorObject;

  const lighting = findMatch(temperature, TEMP_TO_LIGHT) || '';
  const tone = findMatch(emotion, EMOTION_TO_TONE) || 'melancholic stillness, time suspended';
  const detail = findMatch(sound, SOUND_TO_DETAIL) || '';

  const parts = [
    sceneEn
      ? `A ${sceneEn}, empty and desolate.`
      : 'An empty interior room, bare walls, single window.',
    `No ${anchorEn} visible — the space where it would be is empty.`,
    'Black and white 35mm film photograph.',
    lighting || 'single bare bulb casting hard shadows',
    tone,
    detail,
    'Heavy film grain, high contrast, deep blacks. Wide angle, low camera, eye level.',
    'Korean cinema, Lee Chang-dong. Desolate beauty.',
  ].filter(Boolean);

  return parts.join('. ') + '.';
}

export function buildAnchorObjectPrompt(p) {
  const { anchorObject, sceneText, emotion } = p;

  const objectEn = translateToEn(anchorObject, KO_OBJECT_TO_EN) || anchorObject;

  let condition = 'used, worn smooth by years of handling, showing quiet age';
  if (emotion) {
    if (/무서|공포|두려/.test(emotion)) {
      condition = 'damaged, hairline cracks, something slightly wrong';
    } else if (/그리|사랑/.test(emotion)) {
      condition = 'well-loved and faded, softened by years of touch, precious';
    } else if (/분노|화가|화남/.test(emotion)) {
      condition = 'battered, deep scratches, dented, marks of violence';
    } else if (/슬프|슬픔|후회/.test(emotion)) {
      condition = 'abandoned, thin dust layer, intact but clearly left behind';
    } else if (/무감|공허|외로|고립/.test(emotion)) {
      condition = 'sterile, perfectly clean, untouched, disturbingly new';
    } else if (/죄책/.test(emotion)) {
      condition = 'stained, discolored, something spilled never cleaned';
    } else if (/평화|안도|희망/.test(emotion)) {
      condition = 'clean and simple, gentle patina, lived-in comfort';
    }
  }

  return [
    `A single ${objectEn} on pure white background.`,
    `${condition}.`,
    'Centered in frame. Generous white space on all sides.',
    'Soft diffused lighting from above-left. No shadow on background.',
    'Sharp focus on material texture: scratches, grain, imperfection visible.',
    'Muted desaturated color, like a memory losing vividness.',
    '35mm film grain.',
    `Only the ${objectEn}. Pure white void surrounds it.`,
  ].join(' ');
}
