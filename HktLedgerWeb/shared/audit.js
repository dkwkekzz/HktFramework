// ============================================================================
// 판정 규칙 — A2 (설계 §5 잔여 리스크 보강)
//
// 클라 위임 판정의 "정답"을 서버·클라가 같은 시드에서 유도하는 결정론 함수.
// 클라는 이 값으로 데미지를 선언(위임)하고, 서버는 표본을 뽑아 이 함수로
// 재시뮬해 조작을 탐지한다. 감사의 표본 추출 자체는 서버 정책이므로 여기 없다.
//
// 서버·클라 공용 순수 모듈 (Node/DOM API 의존 0).
// ============================================================================

import { mulberry32 } from './rng.js';
import { ATTACK_DAMAGE, ATTACK_DAMAGE_VAR } from './constants.js';

// FNV-1a 문자열 해시 → uint32 (id 를 시드에 섞기 위한 순수 정수 유도)
function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// (시드, 공격자, 공격 시퀀스) → 결정론 롤 시드
function rollSeed(seed, attackerId, seq) {
  return (strHash(attackerId) ^ Math.imul((seq + 1) >>> 0, 2654435761) ^ (seed >>> 0)) >>> 0;
}

// 공격 한 번의 "정답" 기본 데미지 — 정수, [ATTACK_DAMAGE - VAR, ATTACK_DAMAGE + VAR].
// 클라·서버가 같은 (seed, attackerId, seq) 에서 같은 값을 얻는다 → 위임·감사의 공통 근거.
export function canonicalDamage(seed, attackerId, seq) {
  const r = mulberry32(rollSeed(seed, attackerId, seq))();
  return ATTACK_DAMAGE - ATTACK_DAMAGE_VAR + Math.floor(r * (ATTACK_DAMAGE_VAR * 2 + 1));
}
