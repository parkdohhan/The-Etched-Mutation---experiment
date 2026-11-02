'use client';

import { useState } from 'react';
import FloatingAnchor from './components/FloatingAnchor';

const PRESETS = {
  hospital: {
    name: '병원',
    sceneText: '병실 창문 밖 비',
    anchorObject: '침대',
    emotion: '슬픔',
    temperature: '차가',
    smell: '',
    sound: '기계',
  },
  beach: {
    name: '바닷가',
    sceneText: '바닷가 밤 달빛',
    anchorObject: '조개껍질',
    emotion: '그리움',
    temperature: '서늘',
    smell: '',
    sound: '',
  },
  room: {
    name: '방',
    sceneText: '방 오후 창문 햇빛',
    anchorObject: '액자',
    emotion: '후회',
    temperature: '따뜻',
    smell: '',
    sound: '시계',
  },
};

const LEVEL_LABELS = ['실사', 'ASCII', '텍스트'];

function getLevel(alignment) {
  if (alignment >= 0.65) return 0;
  if (alignment >= 0.25) return 1;
  return 2;
}

export default function Page() {
  const [mode, setMode] = useState('scene'); // 'prompt' | 'scene'
  const [prompt, setPrompt] = useState('');
  const [anchorKeyword, setAnchorKeyword] = useState('');
  const [sceneText, setSceneText] = useState('');
  const [anchorObject, setAnchorObject] = useState('');
  const [emotion, setEmotion] = useState('');
  const [temperature, setTemperature] = useState('');
  const [smell, setSmell] = useState('');
  const [sound, setSound] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alignment, setAlignment] = useState(0.85);

  const applyPreset = (key) => {
    const p = PRESETS[key];
    setMode('scene');
    setSceneText(p.sceneText);
    setAnchorObject(p.anchorObject);
    setEmotion(p.emotion || '');
    setTemperature(p.temperature || '');
    setSmell(p.smell || '');
    setSound(p.sound || '');
    setAnchorKeyword(p.anchorObject);
    setError(null);
  };

  const handleGenerate = async () => {
    const useScene = mode === 'scene' && sceneText.trim() && anchorObject.trim();
    if (!useScene && !prompt.trim()) {
      setError('프롬프트를 입력하거나 프리셋 선택, 또는 장면 시스템에서 sceneText·anchorObject를 채우세요.');
      return;
    }
    if (useScene && (!sceneText.trim() || !anchorObject.trim())) {
      setError('장면 시스템: sceneText와 anchorObject는 필수입니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = useScene
        ? {
            sceneText: sceneText.trim(),
            anchorObject: anchorObject.trim(),
            emotion: emotion.trim() || undefined,
            temperature: temperature.trim() || undefined,
            smell: smell.trim() || undefined,
            sound: sound.trim() || undefined,
            anchorKeyword: anchorObject.trim(),
          }
        : {
            prompt: prompt.trim(),
            anchorKeyword: anchorKeyword.trim() || 'anchor',
          };
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `생성 실패 (${res.status})`);
      }
      setResult(data);
      setAlignment(0.85);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const level = getLevel(alignment);

  return (
    <main style={{
      maxWidth: 600,
      margin: '0 auto',
      padding: '24px 16px',
    }}>
      <header style={{
        fontSize: 12,
        letterSpacing: '0.2em',
        marginBottom: 24,
        opacity: 0.8,
      }}>
        TEM Anchor Degradation Test
      </header>

      <section style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontSize: 12 }}>모드</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setMode('prompt')}
            style={{
              padding: '6px 12px',
              background: mode === 'prompt' ? 'rgba(196,168,130,0.15)' : 'transparent',
              border: '1px solid rgba(196,168,130,0.15)',
              color: '#c4a882',
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            직접 프롬프트
          </button>
          <button
            type="button"
            onClick={() => setMode('scene')}
            style={{
              padding: '6px 12px',
              background: mode === 'scene' ? 'rgba(196,168,130,0.15)' : 'transparent',
              border: '1px solid rgba(196,168,130,0.15)',
              color: '#c4a882',
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            장면 시스템 (감정/온도/냄새/소리)
          </button>
        </div>
      </section>

      {mode === 'scene' && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>장면 시스템</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 11 }}>sceneText</label>
              <input
                type="text"
                value={sceneText}
                onChange={(e) => setSceneText(e.target.value)}
                placeholder="예: 병실 창문 밖 비"
                style={{ width: '100%', padding: '6px 8px', background: 'rgba(196,168,130,0.03)', border: '1px solid rgba(196,168,130,0.1)', color: '#c4a882', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 11 }}>anchorObject</label>
              <input
                type="text"
                value={anchorObject}
                onChange={(e) => setAnchorObject(e.target.value)}
                placeholder="예: 침대"
                style={{ width: '100%', padding: '6px 8px', background: 'rgba(196,168,130,0.03)', border: '1px solid rgba(196,168,130,0.1)', color: '#c4a882', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <div><label style={{ marginRight: 4, fontSize: 11 }}>감정</label><input type="text" value={emotion} onChange={(e) => setEmotion(e.target.value)} placeholder="슬픔, 그리움..." style={{ width: 80, padding: '4px 6px', background: 'rgba(196,168,130,0.03)', border: '1px solid rgba(196,168,130,0.1)', color: '#c4a882', fontSize: 11 }} /></div>
              <div><label style={{ marginRight: 4, fontSize: 11 }}>온도</label><input type="text" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="차가움, 따뜻..." style={{ width: 80, padding: '4px 6px', background: 'rgba(196,168,130,0.03)', border: '1px solid rgba(196,168,130,0.1)', color: '#c4a882', fontSize: 11 }} /></div>
              <div><label style={{ marginRight: 4, fontSize: 11 }}>냄새</label><input type="text" value={smell} onChange={(e) => setSmell(e.target.value)} placeholder="소독, 커피..." style={{ width: 80, padding: '4px 6px', background: 'rgba(196,168,130,0.03)', border: '1px solid rgba(196,168,130,0.1)', color: '#c4a882', fontSize: 11 }} /></div>
              <div><label style={{ marginRight: 4, fontSize: 11 }}>소리</label><input type="text" value={sound} onChange={(e) => setSound(e.target.value)} placeholder="빗소리, 시계..." style={{ width: 80, padding: '4px 6px', background: 'rgba(196,168,130,0.03)', border: '1px solid rgba(196,168,130,0.1)', color: '#c4a882', fontSize: 11 }} /></div>
            </div>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12, fontSize: 13 }}>프리셋</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid rgba(196,168,130,0.15)',
                color: '#c4a882',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 13,
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(196,168,130,0.08)';
                e.currentTarget.style.borderColor = 'rgba(196,168,130,0.25)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(196,168,130,0.15)';
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>프롬프트</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="장면 설명을 입력하세요..."
          rows={4}
          style={{
            width: '100%',
            padding: 12,
            background: 'rgba(196,168,130,0.03)',
            border: '1px solid rgba(196,168,130,0.1)',
            color: '#c4a882',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 13,
            resize: 'vertical',
          }}
        />
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>Anchor 설정 (직접 프롬프트 모드)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ marginRight: 6, fontSize: 12 }}>키워드</label>
            <input
              type="text"
              value={anchorKeyword}
              onChange={(e) => setAnchorKeyword(e.target.value)}
              placeholder="anchor"
              style={{
                width: 100,
                padding: '6px 8px',
                background: 'rgba(196,168,130,0.03)',
                border: '1px solid rgba(196,168,130,0.1)',
                color: '#c4a882',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 12,
              }}
            />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: '10px 20px',
          background: loading ? 'rgba(196,168,130,0.1)' : 'transparent',
          border: '1px solid rgba(196,168,130,0.15)',
          color: '#c4a882',
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 13,
          letterSpacing: '0.1em',
          cursor: loading ? 'wait' : 'pointer',
        }}
        onMouseOver={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(196,168,130,0.08)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = loading ? 'rgba(196,168,130,0.1)' : 'transparent'; }}
      >
        {loading ? '생성 중...' : '생성'}
      </button>

      {error && (
        <p style={{
          marginTop: 12,
          padding: '10px 12px',
          fontSize: 13,
          color: 'rgba(255,200,200,0.95)',
          background: 'rgba(120,60,60,0.25)',
          border: '1px solid rgba(196,100,100,0.4)',
        }}>
          {error}
          {error.includes('502') && ' (앱 실행한 검은 창 터미널에 자세한 로그가 있을 수 있습니다.)'}
        </p>
      )}

      {result && (
        <section style={{ marginTop: 28 }}>
          <div style={{ marginBottom: 8, fontSize: 12 }}>장면</div>
          <FloatingAnchor
            anchorKeyword={result.anchorKeyword}
            anchorImageUrl={result.anchorImageUrl ?? result.imageUrl ?? null}
            anchorAscii={result.anchorAscii ?? null}
            memoryText={result.memoryText ?? ''}
            alignment={alignment}
            width={580}
            height={450}
          />
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span>정렬도</span>
              <span>{LEVEL_LABELS[level]} ({alignment.toFixed(2)})</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={alignment}
              onChange={(e) => setAlignment(parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#c4a882',
                cursor: 'pointer',
              }}
            />
          </div>
        </section>
      )}
    </main>
  );
}
