/**
 * TEM Core Systems
 * Phase 1: 핵심 시스템 구현
 *
 * - "왜?" 질문 시스템 (askReason 플래그)
 * - 정렬도 계산 (감정 + 이유 + VOID)
 * - 트루엔딩 판정
 * - 비교 화면 데이터 생성
 */

// =====================
// 상수 정의
// =====================

export const ALIGNMENT_THRESHOLDS = {
    TRUE_ENDING: 0.65,      // 트루엔딩 조건
    HIGH_ALIGNMENT: 0.55,   // 높은 정렬
    PARTIAL_ALIGNMENT: 0.35 // 부분 정렬
};

export const ALIGNMENT_WEIGHTS = {
    EMOTION: 0.4,    // 감정 유사도 가중치
    REASON: 0.4,     // 이유 유사도 가중치
    VOID: 0.2        // VOID 공명 가중치
};

export const REASON_PARAMS = {
    SEMANTIC_SIMILARITY: 0.70,  // 의미적 유사도 임계값
    OBJECT_CONCORDANCE: 0.85,   // 대상 일치도
    CAUSALITY_WEIGHT: 0.30,     // 인과 관계 가중치
    VOID_PENALTY: -0.15         // VOID 불일치 감점
};

// 귀인 방향 키워드
const ATTRIBUTION_KEYWORDS = {
    self_blame: ['내가', '내 탓', '내 잘못', '제가', '내가 그랬어', '미안해', '후회'],
    other_blame: ['때문에', '그 사람이', '엄마가', '아빠가', '그가', '그녀가', '그들이'],
    fate_blame: ['어쩔 수 없', '운명', '그럴 수밖에', '할 수 없었', '그렇게 됐']
};

// 핵심 두려움 키워드
const FEAR_KEYWORDS = {
    abandonment: ['버림', '떠나', '혼자', '외로', '남겨'],
    death: ['죽', '끝', '사라', '없어'],
    rejection: ['싫어', '거부', '거절', '안 받아'],
    failure: ['실패', '못', '안 됐', '틀렸']
};

// VOID 키워드
const VOID_KEYWORDS = {
    emotion: ['모르겠', '잘 모르', '기억 안 나', '생각 안 나', '느껴지지 않'],
    reason: ['왜인지', '이유가 없', '그냥', '말하고 싶지 않', '설명할 수 없']
};

// 위기 키워드 (안전 시스템용)
export const CRISIS_KEYWORDS = [
    '죽고 싶', '자해', '끝내고 싶', '사라지고 싶',
    '자살', '목숨', '죽어버리', '없어지고 싶'
];

// =====================
// 감정 벡터 분석
// =====================

/**
 * 텍스트에서 감정 벡터 추출
 * @param {string} text - 분석할 텍스트
 * @returns {Object} 감정 벡터 {fear, guilt, sadness, anger, longing, numbness, ...}
 */
export function extractEmotionVector(text) {
    const vector = {
        fear: 0,
        guilt: 0,
        sadness: 0,
        anger: 0,
        longing: 0,
        isolation: 0,
        numbness: 0,
        moralPain: 0
    };

    if (!text) return vector;

    const t = text.toLowerCase();

    // 감정 키워드 매칭 (간단한 규칙 기반)
    if (t.includes('무서') || t.includes('두려') || t.includes('떨렸')) vector.fear += 0.5;
    if (t.includes('미안') || t.includes('죄책') || t.includes('잘못')) vector.guilt += 0.5;
    if (t.includes('슬') || t.includes('눈물') || t.includes('울')) vector.sadness += 0.5;
    if (t.includes('화') || t.includes('분노') || t.includes('짜증')) vector.anger += 0.5;
    if (t.includes('그리') || t.includes('보고 싶') || t.includes('그때')) vector.longing += 0.5;
    if (t.includes('혼자') || t.includes('외로') || t.includes('고립')) vector.isolation += 0.5;
    if (t.includes('아무것도') || t.includes('무감각') || t.includes('느껴지지')) vector.numbness += 0.5;
    if (t.includes('해야 했') || t.includes('그래야') || t.includes('옳')) vector.moralPain += 0.5;

    // 정규화
    const total = Object.values(vector).reduce((a, b) => a + b, 0);
    if (total > 0) {
        Object.keys(vector).forEach(k => {
            vector[k] = vector[k] / total;
        });
    }

    return vector;
}

/**
 * 두 감정 벡터의 코사인 유사도 계산
 * @param {Object} vec1 - 첫 번째 감정 벡터
 * @param {Object} vec2 - 두 번째 감정 벡터
 * @returns {number} 0~1 사이의 유사도
 */
export function emotionSimilarity(vec1, vec2) {
    if (!vec1 || !vec2) return 0;

    const keys = ['fear', 'guilt', 'sadness', 'anger', 'longing', 'isolation', 'numbness', 'moralPain'];
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    keys.forEach(key => {
        const v1 = vec1[key] || 0;
        const v2 = vec2[key] || 0;
        dotProduct += v1 * v2;
        mag1 += v1 * v1;
        mag2 += v2 * v2;
    });

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (mag1 * mag2);
}

// =====================
// 이유 벡터 분석
// =====================

/**
 * 텍스트에서 이유 벡터 추출
 * @param {string} text - 분석할 텍스트
 * @returns {Object} 이유 벡터
 */
export function extractReasonVector(text) {
    const vector = {
        attribution: {
            self_blame: 0,
            other_blame: 0,
            fate_blame: 0
        },
        coreFear: {
            abandonment: 0,
            death: 0,
            rejection: 0,
            failure: 0
        },
        void: {
            emotion: false,
            reason: false
        }
    };

    if (!text) {
        vector.void.reason = true;
        return vector;
    }

    const t = text.toLowerCase();

    // 귀인 방향 분석
    Object.entries(ATTRIBUTION_KEYWORDS).forEach(([key, keywords]) => {
        keywords.forEach(kw => {
            if (t.includes(kw)) {
                vector.attribution[key] += 0.3;
            }
        });
    });

    // 핵심 두려움 분석
    Object.entries(FEAR_KEYWORDS).forEach(([key, keywords]) => {
        keywords.forEach(kw => {
            if (t.includes(kw)) {
                vector.coreFear[key] += 0.3;
            }
        });
    });

    // VOID 감지
    VOID_KEYWORDS.emotion.forEach(kw => {
        if (t.includes(kw)) vector.void.emotion = true;
    });
    VOID_KEYWORDS.reason.forEach(kw => {
        if (t.includes(kw)) vector.void.reason = true;
    });

    // 정규화
    const attrTotal = Object.values(vector.attribution).reduce((a, b) => a + b, 0);
    if (attrTotal > 0) {
        Object.keys(vector.attribution).forEach(k => {
            vector.attribution[k] = vector.attribution[k] / attrTotal;
        });
    }

    const fearTotal = Object.values(vector.coreFear).reduce((a, b) => a + b, 0);
    if (fearTotal > 0) {
        Object.keys(vector.coreFear).forEach(k => {
            vector.coreFear[k] = vector.coreFear[k] / fearTotal;
        });
    }

    return vector;
}

/**
 * 두 이유 벡터의 유사도 계산
 * @param {Object} reason1 - 원본 이유 벡터
 * @param {Object} reason2 - 체험자 이유 벡터
 * @returns {number} 0~1 사이의 유사도
 */
export function reasonSimilarity(reason1, reason2) {
    if (!reason1 || !reason2) return 0;

    // 귀인 방향 유사도
    let attrSim = 0;
    const attrKeys = ['self_blame', 'other_blame', 'fate_blame'];
    attrKeys.forEach(key => {
        const v1 = reason1.attribution?.[key] || 0;
        const v2 = reason2.attribution?.[key] || 0;
        attrSim += Math.min(v1, v2);
    });

    // 핵심 두려움 유사도
    let fearSim = 0;
    const fearKeys = ['abandonment', 'death', 'rejection', 'failure'];
    fearKeys.forEach(key => {
        const v1 = reason1.coreFear?.[key] || 0;
        const v2 = reason2.coreFear?.[key] || 0;
        fearSim += Math.min(v1, v2);
    });

    // 종합 (균등 가중)
    return (attrSim + fearSim) / 2;
}

/**
 * VOID 공명도 계산
 * @param {Object} void1 - 원본 VOID 상태
 * @param {Object} void2 - 체험자 VOID 상태
 * @returns {number} 0~1 사이의 공명도
 */
export function voidResonance(void1, void2) {
    if (!void1 || !void2) return 0;

    let resonance = 0;

    // 둘 다 VOID인 경우 높은 공명
    if (void1.emotion && void2.emotion) resonance += 0.5;
    if (void1.reason && void2.reason) resonance += 0.5;

    // 한쪽만 VOID인 경우 불일치 패널티
    if ((void1.emotion && !void2.emotion) || (!void1.emotion && void2.emotion)) {
        resonance += REASON_PARAMS.VOID_PENALTY;
    }
    if ((void1.reason && !void2.reason) || (!void1.reason && void2.reason)) {
        resonance += REASON_PARAMS.VOID_PENALTY;
    }

    return Math.max(0, Math.min(1, resonance));
}

// =====================
// 정렬도 계산
// =====================

/**
 * 종합 정렬도 계산
 * @param {Object} original - 원본 데이터 {emotion, reason, void}
 * @param {Object} experiencer - 체험자 데이터 {emotion, reason, void}
 * @returns {number} 0~1 사이의 정렬도
 */
export function calculateAlignment(original, experiencer) {
    const emotionSim = emotionSimilarity(original.emotion, experiencer.emotion);
    const reasonSim = reasonSimilarity(original.reason, experiencer.reason);
    const voidRes = voidResonance(original.void, experiencer.void);

    const alignment =
        (emotionSim * ALIGNMENT_WEIGHTS.EMOTION) +
        (reasonSim * ALIGNMENT_WEIGHTS.REASON) +
        (voidRes * ALIGNMENT_WEIGHTS.VOID);

    return Math.max(0, Math.min(1, alignment));
}

/**
 * 정렬도 해석
 * @param {number} alignment - 정렬도 값
 * @returns {Object} {level, description, isTrueEnding}
 */
export function interpretAlignment(alignment) {
    if (alignment >= ALIGNMENT_THRESHOLDS.TRUE_ENDING) {
        return {
            level: 'true_ending',
            description: '트루엔딩 조건 충족',
            isTrueEnding: true
        };
    } else if (alignment >= ALIGNMENT_THRESHOLDS.HIGH_ALIGNMENT) {
        return {
            level: 'high',
            description: '높은 정렬',
            isTrueEnding: false
        };
    } else if (alignment >= ALIGNMENT_THRESHOLDS.PARTIAL_ALIGNMENT) {
        return {
            level: 'partial',
            description: '부분 정렬',
            isTrueEnding: false
        };
    } else {
        return {
            level: 'mismatch',
            description: '불일치',
            isTrueEnding: false
        };
    }
}

// =====================
// "왜?" 질문 시스템
// =====================

/**
 * 장면에서 "왜?" 질문을 해야 하는지 확인
 * @param {Object} scene - 장면 객체
 * @returns {boolean} 질문 여부
 */
export function shouldAskReason(scene) {
    if (!scene) return false;

    // askReason 플래그가 명시적으로 설정된 경우
    if (scene.askReason !== undefined) {
        return scene.askReason;
    }

    // sceneType이 branch 또는 ending인 경우
    const sceneType = scene.sceneType || 'normal';
    return sceneType === 'branch' || sceneType === 'ending';
}

/**
 * "왜?" 질문에 대한 기본 선택지 생성
 * @param {Object} scene - 장면 객체
 * @returns {Array} 선택지 배열
 */
export function getReasonChoices(scene) {
    const defaultChoices = [
        { text: '내 잘못인 것 같았어', attribution: 'self_blame' },
        { text: '어쩔 수 없었어', attribution: 'fate_blame' },
        { text: '무서웠어', coreFear: 'death' },
        { text: '말하고 싶지 않아', isVoid: true }  // 항상 존재
    ];

    // 장면 맥락에 따른 커스텀 선택지가 있으면 병합
    if (scene.reasonChoices && Array.isArray(scene.reasonChoices)) {
        // 마지막에 "말하고 싶지 않아" 보장
        const customChoices = scene.reasonChoices.filter(c => !c.isVoid);
        return [...customChoices, { text: '말하고 싶지 않아', isVoid: true }];
    }

    return defaultChoices;
}

// =====================
// 비교 화면 데이터 생성
// =====================

/**
 * 모든 장면의 비교 데이터 생성
 * @param {Array} scenes - 장면 배열
 * @param {Array} userChoices - 사용자 선택 배열 (인덱스)
 * @param {Array} userReasons - 사용자 이유 배열
 * @returns {Array} 비교 데이터 배열
 */
export function generateComparisonData(scenes, userChoices, userReasons) {
    if (!scenes || !Array.isArray(scenes)) return [];

    const comparisons = [];

    scenes.forEach((scene, index) => {
        const userChoiceIndex = userChoices[index];
        const userReason = userReasons[index] || null;

        const originalChoice = scene.choices?.[scene.originalChoice];
        const userChoice = scene.choices?.[userChoiceIndex];

        const comparison = {
            sceneIndex: index + 1,
            sceneText: scene.text?.substring(0, 50) + '...',
            sceneType: scene.sceneType || 'normal',

            user: {
                choiceText: userChoice?.text || '—',
                choiceIndex: userChoiceIndex,
                reason: userReason
            },

            original: {
                choiceText: originalChoice?.text || '—',
                choiceIndex: scene.originalChoice,
                reason: scene.originalReason || '—'
            },

            isChoiceMatch: userChoiceIndex === scene.originalChoice,

            // 이유 매치는 "왜?" 질문이 있는 장면에서만 계산
            isReasonMatch: null
        };

        // "왜?" 질문이 있는 장면에서 이유 비교
        if (shouldAskReason(scene) && userReason && scene.originalReason) {
            const userReasonVec = extractReasonVector(userReason);
            const origReasonVec = extractReasonVector(scene.originalReason);
            comparison.isReasonMatch = reasonSimilarity(userReasonVec, origReasonVec) > 0.5;
        }

        comparisons.push(comparison);
    });

    return comparisons;
}

/**
 * 비교 요약 생성
 * @param {Array} comparisons - 비교 데이터 배열
 * @returns {Object} 요약 통계
 */
export function summarizeComparisons(comparisons) {
    if (!comparisons || comparisons.length === 0) {
        return { totalScenes: 0, choiceMatches: 0, reasonMatches: 0 };
    }

    const totalScenes = comparisons.length;
    const choiceMatches = comparisons.filter(c => c.isChoiceMatch).length;
    const reasonQuestions = comparisons.filter(c => c.isReasonMatch !== null);
    const reasonMatches = reasonQuestions.filter(c => c.isReasonMatch).length;

    return {
        totalScenes,
        choiceMatches,
        choiceMatchRate: choiceMatches / totalScenes,
        reasonQuestions: reasonQuestions.length,
        reasonMatches,
        reasonMatchRate: reasonQuestions.length > 0 ? reasonMatches / reasonQuestions.length : 0
    };
}

// =====================
// 안전 시스템
// =====================

/**
 * 위기 키워드 감지
 * @param {string} text - 분석할 텍스트
 * @returns {boolean} 위기 상황 여부
 */
export function detectCrisis(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    return CRISIS_KEYWORDS.some(kw => t.includes(kw));
}

/**
 * 안전 메시지 생성
 * @returns {Object} 안전 메시지 데이터
 */
export function getSafetyMessage() {
    return {
        speaker: '또다른 나',
        message: '지금 많이 힘든 것 같아.\n이 이야기는 여기서 멈춰도 괜찮아.',
        resources: [
            { name: '자살예방상담전화', number: '1393', hours: '24시간' },
            { name: '정신건강위기상담', number: '1577-0199', hours: '' }
        ],
        actions: [
            { text: '계속하기', action: 'continue' },
            { text: '나가기', action: 'exit' }
        ]
    };
}

// =====================
// 트루엔딩 보상
// =====================

/**
 * 트루엔딩 달성 시 보상 데이터 생성
 * @param {Object} memory - 기억 객체
 * @param {number} alignment - 정렬도
 * @returns {Object} 보상 데이터
 */
export function getTrueEndingRewards(memory, alignment) {
    if (alignment < ALIGNMENT_THRESHOLDS.TRUE_ENDING) {
        return null;
    }

    return {
        canViewOriginal: true,
        canSendNote: true,
        noteMaxLength: 100,
        message: '당신은 이 기억을 온전히 이해했습니다.'
    };
}

// =====================
// 내보내기
// =====================

export default {
    // 상수
    ALIGNMENT_THRESHOLDS,
    ALIGNMENT_WEIGHTS,
    REASON_PARAMS,
    CRISIS_KEYWORDS,

    // 감정 분석
    extractEmotionVector,
    emotionSimilarity,

    // 이유 분석
    extractReasonVector,
    reasonSimilarity,
    voidResonance,

    // 정렬도
    calculateAlignment,
    interpretAlignment,

    // "왜?" 질문
    shouldAskReason,
    getReasonChoices,

    // 비교 화면
    generateComparisonData,
    summarizeComparisons,

    // 안전
    detectCrisis,
    getSafetyMessage,

    // 트루엔딩
    getTrueEndingRewards
};
