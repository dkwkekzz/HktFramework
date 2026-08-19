// RULE-CRITICAL-STRIKE-001 — Implements INTENT-CRITICAL-001 · INTENT-WORLD-CHANCE-001 ·
//                            INTENT-CRITICAL-ROLL-001 · INTENT-CRITICAL-AMPLIFY-001 ·
//                            INTENT-DAMAGE-BREAKDOWN-001
// Input          World, 공격자 Actor, FinalDamage (계산이 내놓은 값)
// Preconditions  없음 — 타격이 실제로 대상에게 들어갈 때 반드시 한 번 돈다
// Transition     World.ChanceCursor += 1 (확률이 0 도 1 도 아닐 때만)
// Result         CriticalOutcome
//
//     Step 1  Chance = clamp(공격자.CriticalChance, 0, 1)
//     Step 2  Chance <= 0 → 안 터진다 · 커서 무변경
//             Chance >= 1 → 터진다   · 커서 무변경
//             그 밖       → Roll = ChanceAt(Seed, Cursor) · Cursor += 1 · Roll < Chance
//     Step 3  Multiplier = max(1, 공격자.CriticalDamage)
//             Amplified  = 터졌으면 round(FinalDamage × Multiplier), 아니면 그대로
//
// 이것이 이 세계에서 **우연을 소비하는 유일한 자리**다 (INTENT-WORLD-CHANCE-001).
// 다른 어떤 판정도 ChanceCursor 를 읽지 않는다.
//
// 이 규칙은 공격 능력도, 방어도, 걷힌 방어도, 감쇄율도 읽지 않는다.
// 방식(DamageType)도 읽지 않는다 — 물리든 오라든 같은 판정이 같은 방식으로 돈다.
// 세계 시각도 읽지 않는다 — 언제 쳤는가가 결과를 바꾸면 되짚을 수 없게 된다.
// **맞는 자의 값은 하나도 들어가지 않는다** — 그래서 Input 에 대상 Actor 가 없다.
// Critical 저항·무효 같은 것을 이 층은 만들지 않는다 (01 EXCLUDED).
//
// 판정은 지난 타격을 기억하지 않는다. "몇 번 안 터졌으니 이번엔 터진다" 류의
// 보정 상태를 세우지 않는다 — 판정은 하나다 (INTENT-CRITICAL-ROLL-001).
//
// 이 규칙은 RULE-DAMAGE-CALCULATE-001 **밖에** 선다. 그 계산은 이 Cycle 뒤에도
// 여전히 흔들림을 모르고, 세계를 바꾸지 않으며, ChanceCursor 를 읽지 않는다.
// C011 의 막기가 그랬듯 계산이 내놓은 값에 작용한다 (DC-COMBAT-ONE-FORMULA —
// `Critical → Final Damage 를 증폭한다`).

import type { ActorState } from '../semantic/actor';
import { chanceAt, clamp, type CriticalOutcome } from '../semantic/combat';
import type { WorldState } from '../semantic/world-state';

export interface CriticalStrikeResult {
  outcome: CriticalOutcome;
  /** 증폭이 끝난 최종 피해. 터지지 않았으면 들어온 값 그대로다 */
  amplified: number;
}

export function ruleCriticalStrike(
  state: WorldState,
  attacker: ActorState,
  finalDamage: number,
): CriticalStrikeResult {
  // ── Step 1 — 가능성을 읽는다 ─────────────────────────────────────
  const chance = clamp(attacker.criticalChance, 0, 1);

  // ── Step 2 — 정한다 (세계가 바뀌는 유일한 지점) ──────────────────
  // 두 끝에서 흔들림을 쓰지 않는 것은 편의가 아니라 규칙이다 —
  // **이미 정해진 일에 우연을 쓰지 않는다.** `Roll < chance` 이고 Roll 이 [0,1) 이므로
  // 결과만 보면 이 분기 없이도 같지만, 여기서 갈리는 것은 결과가 아니라 **소비**다.
  // 덕분에 가능성이 0 인 존재들만 있는 세계는 ChanceCursor 가 영원히 0 이고,
  // 그 세계는 이 층이 생기기 전과 완전히 같은 세계다 (Regression 기준).
  let occurred: boolean;
  if (chance <= 0) occurred = false;
  else if (chance >= 1) occurred = true;
  else {
    const roll = chanceAt(state.chanceSeed, state.chanceCursor);
    state.chanceCursor += 1;
    occurred = roll < chance;
  }

  // ── Step 3 — 키운다 ──────────────────────────────────────────────
  // 배율이 1 이상이므로 결과는 들어온 값보다 작아지지 않는다.
  // 들어온 값이 1 이상이면 결과도 1 이상이다 — C010 의 하한이 이 층 뒤에도 깨지지 않는다.
  // 들어온 값이 0 이면(낼 피해가 없으면) 터져도 0 이다 —
  // 없는 피해를 증폭이 만들어내지 않는다.
  const multiplier = Math.max(1, attacker.criticalDamage);
  const amplified = occurred ? Math.round(finalDamage * multiplier) : finalDamage;

  return {
    outcome: { occurred, chance, multiplier, damageBeforeCritical: finalDamage },
    amplified,
  };
}
