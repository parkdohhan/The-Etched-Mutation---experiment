/**
 * FLUX schnell용 프롬프트 시스템
 * (Supabase generate-scene-visual 로직을 Next.js용으로 이식)
 *
 * - 짧고 시각적 묘사가 잘 먹힘
 * - ASCII 변환: 명암 대비, 실루엣, 빛의 방향
 * - multiply blend(오브젝트): 배경 #FFF → 투명, 오브젝트만
 */

const TEMP_TO_LIGHT = {
  차가: 'cold blue-white fluorescent tube light, clinical sterile glow on linoleum',
  서늘: 'pale grey daylight through frosted glass, no direct sun',
  미지근: 'flat overcast light, neutral, neither warm nor cold',
  따뜻: 'warm amber tungsten bulb hanging from ceiling, golden dust particles',
  뜨거: 'harsh overhead halogen, burnt orange, oppressive, sweat on surfaces',
};

const EMOTION_TO_TONE = {
  무서: 'deep black shadows consuming corners, single harsh light, claustrophobic',
  두려: 'deep black shadows consuming corners, single harsh light, claustrophobic',
  공포: 'near-total darkness, one slit of white light from door crack',
  슬프: 'soft grey everything, rain-light diffusion, no contrast, flat and heavy',
  슬픔: 'soft grey everything, rain-light diffusion, no contrast, flat and heavy',
  그리: 'faded sepia warmth like 1990s photograph, edges going soft',
  분노: 'red-shifted shadows, stark overhead light, hard angles, cracked surfaces',
  화가: 'red-shifted shadows, stark overhead light, hard angles, cracked surfaces',
  화남: 'red-shifted shadows, stark overhead light, hard angles, cracked surfaces',
  죄책: 'sickly green fluorescent, institutional, every corner visible, nowhere to hide',
  후회: 'late golden hour fading to cold blue, long shadows stretching east',
  외로: 'vast empty space, single point of distant light, cold blue-grey void',
  고립: 'vast empty space, single point of distant light, cold blue-grey void',
  무감: 'flat white-grey, zero shadows, clinical void, sterile nothingness',
  공허: 'flat white-grey, zero shadows, clinical void, sterile nothingness',
  평화: 'gentle morning light through sheer curtain, dust motes floating',
  안도: 'gentle morning light through sheer curtain, dust motes floating',
  사랑: 'warm backlight glow, soft bokeh circles, intimate shallow focus',
  희망: 'single beam of dawn light cutting diagonally through dark room',
};

const SMELL_TO_SPACE = {
  소독: 'hospital corridor with green linoleum floor and suspended ceiling tiles',
  약: 'hospital ward with curtain dividers and metal IV stands',
  병원: 'hospital waiting area with plastic chairs and vending machine glow',
  풀: 'overgrown vacant lot, cracked concrete with weeds pushing through',
  잔디: 'suburban apartment balcony overlooking identical buildings',
  비: 'narrow alley after rain, wet asphalt reflecting a single streetlamp',
  빗물: 'bus stop shelter with rain streaming down plexiglass walls',
  음식: 'small Korean apartment kitchen, gas range, stained tile, single bulb',
  밥: 'dining table in dim apartment, rice cooker steam, two chairs one empty',
  커피: 'empty cafe corner by foggy window, street blurred outside',
  담배: 'apartment rooftop at night, concrete ledge, city grid lights below',
  바다: 'grey winter shoreline, wet sand, overcast sky dissolving into water',
  꽃: 'memorial space with chrysanthemums, framed portrait, incense rising',
  향: 'temple interior with dark wooden beams, incense haze in dim candlelight',
  나무: 'forest clearing, birch trunks vertical, filtered light through canopy',
  땀: 'gymnasium floor, high windows with bars, chalk dust in air',
  가죽: 'old sedan interior, cracked dashboard, rearview mirror, parking lot',
  먼지: 'abandoned room with sheet-covered furniture, light through broken blind',
};

const SOUND_TO_DETAIL = {
  빗소리: 'rain streaks running down windowpane',
  비: 'rain streaks running down windowpane',
  시계: 'analog wall clock visible in the shadow, pendulum still',
  TV: 'old CRT television static glow illuminating far wall',
  텔레비전: 'old CRT television static glow illuminating far wall',
  바람: 'thin curtain billowing inward from cracked-open window',
  새: 'window open to grey overcast sky, bare tree branch visible',
  기계: 'green LED dots from medical monitor in dark corner',
  모니터: 'green LED dots from medical monitor in dark corner',
  발소리: 'long empty corridor with polished floor reflecting light',
  문: 'heavy door left slightly ajar, light spilling through crack',
  울음: 'thin apartment wall, wallpaper peeling at seam',
  웃음: 'room with balloons deflating on floor, streamers hanging limp',
  물: 'bathroom with dripping faucet, tile floor, foggy mirror',
  전화: 'rotary phone on side table, coiled cord, dim lamp beside it',
  사이렌: 'window with venetian blinds, red-blue light pulsing through slats',
  피아노: 'upright piano against wall, sheet music scattered, bench pushed back',
};

function findMatch(input, map) {
  if (!input || typeof input !== 'string') return null;
  for (const key of Object.keys(map)) {
    if (input.includes(key)) return map[key];
  }
  return null;
}

/**
 * 배경(장면) 프롬프트 생성
 */
export function buildBackgroundPrompt(p) {
  const {
    sceneText,
    anchorObject,
    emotion,
    temperature,
    smell,
    sound,
  } = p;

  const lighting = findMatch(temperature, TEMP_TO_LIGHT) ||
    'single bare bulb casting hard shadows across the room';
  const tone = findMatch(emotion, EMOTION_TO_TONE) ||
    'melancholic stillness, time suspended, dust settling';
  const space = findMatch(smell, SMELL_TO_SPACE) ||
    'empty interior room, bare plaster walls, wooden floor, single window';
  const detail = findMatch(sound, SOUND_TO_DETAIL) || '';

  const parts = [
    'Black and white 35mm film photograph.',
    `${space}${detail ? `, ${detail}` : ''}.`,
    `${lighting}.`,
    `${tone}.`,
    `The center of the room is empty — no ${anchorObject}, just open floor.`,
    'Heavy film grain, high contrast, deep blacks and blown whites.',
    'Wide angle, low camera, eye level. Still and silent.',
    'Korean cinema, Lee Chang-dong, Poetry 2010. Desolate beauty.',
  ];
  return parts.join(' ');
}

/**
 * 앵커 오브젝트 프롬프트 (흰 배경, multiply용)
 */
export function buildAnchorObjectPrompt(p) {
  const { anchorObject, sceneText, emotion } = p;

  let condition = 'used, worn smooth by years of handling, showing quiet age';
  if (emotion) {
    if (/무서|공포|두려/.test(emotion)) {
      condition = 'damaged, hairline cracks, something slightly wrong about it';
    } else if (/그리|사랑/.test(emotion)) {
      condition = 'well-loved and faded, softened by years of touch, precious and fragile';
    } else if (/분노|화가|화남/.test(emotion)) {
      condition = 'battered, deep scratches, dented, rough marks of violence';
    } else if (/슬프|슬픔|후회/.test(emotion)) {
      condition = 'abandoned, thin layer of dust, still perfectly intact but clearly left behind';
    } else if (/무감|공허|외로|고립/.test(emotion)) {
      condition = 'sterile and clinical, perfectly clean, untouched, disturbingly new';
    } else if (/죄책/.test(emotion)) {
      condition = 'stained, discolored, something spilled on it that was never cleaned';
    } else if (/평화|안도|희망/.test(emotion)) {
      condition = 'clean and simple, gentle patina, warm to the touch, lived-in comfort';
    }
  }

  return [
    'Product photograph on pure white background.',
    `A single ${anchorObject}, ${condition}.`,
    'Centered in frame. Generous white space on all sides.',
    'Soft diffused lighting from above-left. No shadow cast on white background.',
    'Sharp focus on material texture: every scratch, fiber, grain, imperfection visible.',
    'Muted desaturated color, like a memory losing its vividness.',
    '35mm film grain. Forensic evidence meets still life photography.',
    `Only the ${anchorObject}. Pure white void surrounds it.`,
  ].join(' ');
}
