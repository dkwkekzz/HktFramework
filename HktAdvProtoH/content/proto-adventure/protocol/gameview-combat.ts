// GameView 확장 — 전투(COMBAT 트랙) 도메인분. 생명·능력치·타격 경위·앎·지목·태도.
//
// 트랙이 자기 파일을 소유한다 (guides/works.md 병렬 규칙) — 아이템 도메인은
// gameview-item.ts, 봉투 재수출과 스냅샷 조립은 gameview.ts 가 맡는다.
// 소비처는 언제나 protocol/gameview 하나만 import 한다.

import type { GameViewPosition } from '../../../engine/protocol-core/gameview';

// 생명 (C007) — 누구의 것이든 관찰된다. 몸 위 기본 표시가 이 값이다.
export interface VitalityView {
  health: number;
  healthMaximum: number;
  downed: boolean; // 참이면 더 이상 행동하지 않고 타격 대상도 되지 않는다
}

// 그 밖의 모든 속성 (C007 R2 → C014 CHANGED).
// 세계가 **무엇이 언제 관찰에 실리는지를 정한다.** 남의 겨루는 힘은 살펴본 뒤에 실리고
// 그 외의 모든 속성은 예전처럼 누구의 것이든 언제나 실린다.
// 그럼에도 세계가 "숨기지 않는다" 는 성질은 잃지 않는다 — 뜻이 옮겨간다:
// 전부 보여준다는 뜻에서 **가린 것이 있으면 가렸다는 사실을 밝힌다**는 뜻으로.
// 실린다고 해서 늘 화면에 띄우라는 뜻은 아니다. 표시 기본값은 View 가 정한다.
// ── 힘의 배분 (C-COMBAT-001 ADDED) ───────────────────────────────────
//
// 지금 자신의 힘을 몸 · 능력 · 인지 중 어디에 몰아 두었는가.
//
// **몫을 함께 싣는다.** View 가 이름을 보고 자기 표에서 몫을 찾아내지 않게 하기
// 위해서다 (DC-WORLD-OWNS-THE-SURFACE-LIST) — 배분을 하나 더 지어도 화면 코드가
// 열리지 않고, 세 몫의 합이 어느 항목에서나 같다는 것도 이 값으로 확인된다.
// 합을 따로 싣지 않는 이유가 그것이다.

/** 지금의 배분 하나 (C-COMBAT-001 ADDED) */
export interface AllocationView {
  id: string; // 배분의 의미 코드 — 표시 이름은 View 책임
  shares: {
    body: number;
    ability: number;
    awareness: number;
  };
}

/**
 * 고를 수 있는 배분 하나 (C-COMBAT-001 ADDED).
 *
 * **소지품(C020) · 적용 자리(C023) 와 나란한 세 번째 목록의 항목이다.** 셋이 답하는
 * 질문이 다르다 — 무엇을 지녔는가 / 몸이 무엇으로 되어 있는가 / 지금 힘을 어디에 두었는가.
 *
 * **네 항목이 언제나 전부 실린다.** 지금 고를 수 없는 것도 실린다 — 못 고른다는 것과
 * 존재하지 않는다는 것은 다르며, 그 구분이 없으면 "기력을 모으면 저것으로 갈 수 있다"
 * 를 사람이 알 수 없다 (C023 이 빈 자리를 싣기로 한 판단 그대로).
 *
 * 내 몸의 것만 실린다 (INTENT-PER-OBSERVER-PROJECTION-001). 남이 무엇으로 바꿀 수
 * 있는지는 세계가 아직 묻지 않는 질문이고, 남이 지금 어디에 두었는지는
 * AttributesView.allocation 이 이미 싣는다.
 */
export interface AllocationChoiceView {
  id: string;
  shares: {
    body: number;
    ability: number;
    awareness: number;
  };
  /**
   * 지금 이것인가. **available 과 별개다** — 지금 있는 자리는 거절이 아니므로
   * available 이 참인 채로 current 도 참이다 (INTENT-CHANGE-ALLOCATION-REFUSAL-001).
   */
  current: boolean;
  /** 치를 기력. current 면 0 이다 — 이미 그 자리에 있는 것에 값을 물리지 않는다 */
  cpCost: number;
  available: boolean;
  /** 불가 사유 코드 (downed | insufficient-cp) — 문구 변환은 View 책임 */
  unavailableReason?: string;
  /** 이 배분으로 가는 요청의 주소 — 화면이 문자열을 지어내지 않는다 */
  interactionId: string;
}

export interface AttributesView {
  // ── 앎의 상태 (C014 ADDED) — 아는 존재에도 모르는 존재에도 언제나 실린다 ──
  /**
   * C016 CHANGED — 이 존재에 대해 **가려진 자리가 하나도 없는가.**
   * 참이 되는 길은 셋이다: 살펴봤거나 · 통찰이 세 문턱을 모두 넘었거나 · 자기 몸이거나.
   * 일부만 열린 존재에서는 거짓이므로, View 는 이것 하나로 "값이 오는가" 를
   * 판단하지 않는다 — 그 판단은 자리마다 다르다 (04 SEAT NOTE).
   */
  acquainted: boolean;
  /**
   * 지금 이 존재에 대해 **가려진 항목의 이름들**. 전부 열렸으면 빈 배열이다.
   * 이 목록의 단일 출처는 세계다 (world/semantic/acquaintance.ts) —
   * View 가 "가려질 수 있는 것은 이 셋" 을 자기 코드에 적지 않는다
   * (DC-WORLD-OWNS-THE-SURFACE-LIST).
   * C016 CHANGED — **부분 목록**일 수 있다. 통찰이 얕은 자리부터 열기 때문이다.
   * 문턱 값(30·60·90)은 싣지 않는다 — 세계가 이미 답을 싣고 있으므로 View 가
   * 규칙을 자기 안에 복제할 자리가 없다 (04 OBSERVABLE PROJECTION NOTE).
   */
  concealed: string[];
  /** 왜 비어 있는가 (not-observed). 가려진 것이 있을 때만 실린다 */
  unacquaintedReason?: string;
  /**
   * C016 ADDED — 이 존재의 통찰 (0~100). 살펴보지 않고도 얼마나 아는가.
   * 가려지지 않는다 — 겨루는 힘이 아니라 아는 힘이다. 남의 것도 그대로 실린다.
   */
  insight: number;
  /**
   * C-COMBAT-001 ADDED — 지금의 배분 (INTENT-ALLOCATION-IS-OBSERVED-001).
   *
   * **모든 존재에 언제나 실린다. 가려지지 않는다.** 몰아 두는 일은 몸이 드러내는
   * 것이며, 가리면 "얇아진 쪽을 노린다" 가 세계에서 성립하지 않는다. 태도(C018)와
   * 통찰(C016)이 가려지지 않는 자리에 나란히 선다.
   *
   * **그러나 값을 새게 하지는 않는다** — 저 몸의 방어가 배분 때문에 얼마가 되었는지는
   * combatStats 이고 그것은 여전히 문턱 90 뒤다. 보이는 것은 형태이고 값이 아니며,
   * 이 구분이 C016 이 세운 "일부만 안다" 를 지킨다.
   */
  allocation: AllocationView;
  // ── 둘 사이의 태도 (C018 ADDED, INTENT-STANCE-OBSERVE-001) ──────────────
  // **모든 존재에 언제나 둘 다 실린다.** 가려지지 않는다 — 겨루는 힘이 아니라 지금 둘
  // 사이에 있는 일이며, 가리면 물러날 판단 자체가 성립하지 않는다.
  // 둘을 함께 싣는 이유: 해는 어느 한쪽이라도 적대이면 성립하므로(RULE-HARM-GATE-001)
  // 한 방향만으로는 "왜 내가 저것을 칠 수 있는가" 의 답이 절반만 온다.
  // View 는 종류로도 조종 주체로도 태도를 짐작하지 않는다 — 같은 종류라도 값이 다르고
  // 같은 존재라도 시간에 따라 다르다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
  /** 이 존재가 나를 어떻게 대하는가 — hostile | neutral | friendly */
  stanceTowardObserver: string;
  /** 내가 이 존재를 어떻게 대하는가 — 방향값이므로 위와 다를 수 있다 */
  stanceFromObserver: string;
  energy: number;
  energyMaximum: number;
  moveMode: string; // walk | run
  control: string; // player | autonomous
  tempoStats: {
    moveSpeed: number;
    runSpeedMultiplier: number;
    actionSpeed: number;
  };
  modifiers: {
    energyCharge: number;
    energyConsume: number;
    moveSpeed: number;
    actionSpeed: number;
  };
  // 전투 능력치 (C010 ADDED / C012 CHANGED) — 한 방의 크기를 정하는 **네** 값.
  // 어느 둘을 읽을지는 그 타격의 방식이 정한다. 네 값 모두 실린다 —
  // 고르지 않은 쪽도 보여야 "저쪽으로 쳤다면 어땠을까" 를 견줄 수 있다.
  // 두 Multiplier 는 파생값이다. 방어가 체감식이라 수치만 보고는 효과를 알 수 없어
  // "그래서 몇 할로 받는가" 를 함께 싣는다 (0 초과 1 이하 — 0 이 되지 않는다).
  // C013 CHANGED — 관통 둘이 더해져 여섯 값이다. 관통은 공격 쪽 능력이지만
  // **피해를 키우는 값이 아니다** — 하는 일은 상대 방어의 값어치를 떨어뜨리는 것뿐이다.
  // C014 CHANGED — 남의 것은 acquainted 가 참일 때만 실린다. 자기 것은 언제나 실린다.
  combatStats?: {
    physicalAttack: number;
    auraAttack: number;
    armor: number;
    resistance: number;
    armorPenetration: number;
    resistancePenetration: number;
    armorMultiplier: number;
    resistanceMultiplier: number;
    // C015 CHANGED — 여덟 값. Critical 둘은 **치는 쪽의 성질**이다 —
    // 저 존재가 나를 얼마나 크게 칠 수 있는지를 말하며, 내가 저 존재를 칠 때와는 무관하다.
    // 그래서 versusObserver 에는 들어가지 않는다 (판정에 맞는 자의 값이 없다).
    criticalChance: number; // 0~1
    criticalDamage: number; // 1 이상 — 배율
  };
  // 이 존재의 두 방어가 **보는 이의 관통에게** 얼마로 읽히는가 (C013 ADDED).
  // **세계가 계산한 값이다.** View 가 combatStats 와 자기 관통을 곱해
  // 만들어내서는 안 된다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
  // C014 CHANGED — 두 존재 사이의 값이므로 한쪽을 모르는 채로는 성립하지 않는다.
  versusObserver?: {
    armor: number;
    resistance: number;
    armorMultiplier: number;
    resistanceMultiplier: number;
  };
  // 두 방어 중 어느 쪽이 더 단단한가 (C012 ADDED) — physical-tougher | aura-tougher | even.
  // **세계가 계산한 판정이다** (DC-WORLD-OWNS-THE-SURFACE-LIST).
  // C014 CHANGED — 살펴본 뒤에 열린다. 이것이 가려지지 않으면 "무엇으로 칠지" 의
  // 답이 그대로 새어 나가고 살펴봄이 할 일이 없어진다.
  defenseShape?: string;
  // 막기 (C011 ADDED) — 모든 존재에 실린다. guarding 은 state 와 별개다.
  guard: {
    guarding: boolean;
    broken: boolean;
  };
}

// 스킬 interaction 의 profile (C007 → C012) — 쓰기 전에 알 수 있어야 하는 값.
export interface SkillProfileView {
  baseDamage: number;
  attackRatio: number;
  rawDamage: number;
  charge: number;
  cost: number;
  damageType: string; // physical | aura
  // C019 ADDED — 이 기술의 구간 경계 (행동 진행도의 비율). 고르기 전에 안다.
  // 실시간 길이는 이 값 × 그 기술의 행동 길이다. 세계가 지닌 값이며 View 가
  // 기술 이름으로 자기 표를 만들지 않는다.
  swingBegin: number; // 선딜이 끝나는 지점 — 클수록 오래 준비한다
  swingEnd: number; // 판정이 끝나는 지점 — 이 뒤가 후딜이다
  // C025 ADDED — 이 기술이 닿는 **모양**. 고르기 전에 안다.
  // C019 가 시간 축 둘을 실은 그 자리에 공간 축 셋이 선다 — 같은 이유다:
  // 무엇이 넓고 무엇이 멀리 닿는지를 걸어 보고 아는 것은 늦다.
  // 세계가 지닌 값이며 View 가 기술 이름으로 자기 표를 만들지 않는다
  // (DC-WORLD-OWNS-THE-SURFACE-LIST).
  swingArc: number; // 훑는 전체 각 (rad) — 클수록 옆까지 훑는다
  swingReach: number; // 몸 중심에서 칼끝 중심까지 — 클수록 멀리 닿는다
  swingTipRadius: number; // 칼끝의 굵기 — 닿음의 판정 반경. 거는 동안 swing.radius 로도 온다
  // C-COMBAT-003 ADDED — 이 기술이 지는 **세계의 사정**. 고르기 전에 안다.
  // C019 가 시간 축 둘을, C025 가 공간 축 셋을 실은 그 자리에 사정 둘이 선다 —
  // 같은 이유다: 무엇을 갖춰야 하고 무엇이 그것을 키우는지를 걸어 보고 아는 것은 늦다.
  //
  // **둘은 다른 칸이다.** 못 쓰는 사유와 더 잘 드는 사유는 다른 물음의 답이며,
  // 같은 칸에 실으면 닫힌 기술과 강해진 기술이 구별되지 않는다.
  //
  // 사정을 지지 않는 기술에서는 둘 다 빈 배열이다. 문턱 값은 실리지 않는다 —
  // 세계가 이미 "참인가" 를 답하고 있으므로 View 가 규칙을 복제할 자리가 없다.
  requires: SkillRequirementView[];
  conditions: SkillConditionView[];
}

/** 갖춰져야 이 기술이 시작되는 사정 하나 (C-COMBAT-003 ADDED) */
export interface SkillRequirementView {
  id: string; // 사정의 이름 — 문구 변환은 View 책임
  met: boolean; // 지금 갖춰졌는가
  reason: string; // 갖춰지지 않았을 때의 사유 코드 — **갖춰졌어도 실린다**
}

/**
 * 참인 동안 이 기술을 키우는 사정 하나 (C-COMBAT-003 ADDED).
 *
 * `holds` 는 **지금 고른 대상**에 대한 답이며 예고이지 약속이 아니다 — 실제로 닿은
 * 몸이 다르면 그 몸에 대해 다시 세어진다. 고른 대상이 없으면 상대를 읽는 조건은
 * 거짓으로 온다.
 */
export interface SkillConditionView {
  id: string;
  holds: boolean;
  bonus: number; // 계수에 더해지는 몫
}

// 방식이 고른 능력 하나 (C012 ADDED) — 무엇을 얼마로 읽었는가.
export interface TypedStatView {
  // physicalAttack | auraAttack | armor | resistance |
  // armorPenetration | resistancePenetration (C013)
  name: string;
  value: number;
  /**
   * C-COMBAT-001 ADDED — 배분이 이 값에 보탠 몫. 음수일 수 있고 **0 이어도 실린다.**
   *
   * 터지지 않은 치명이 실리는 이유와 같다 (C015) — "이번 한 방에 배분이 아무것도 하지
   * 않았다" 는 사실 역시 관찰이어야, 배분을 바꿀 근거가 생긴다. 음수도 그대로 싣는다:
   * 몰지 않은 축의 값이 얼마나 얇아졌는지가 경위에서 읽혀야 맞바꿈이 눈에 닿는다.
   * 관통에서는 언제나 0 이다 — 관통은 어느 축에도 들지 않는다.
   *
   * **View 가 빼서 만들지 않는다.** 화면이 combatStats 와 배분 표를 견주어 이 수를
   * 계산하는 순간 세계와 화면에 두 개의 진실이 생긴다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
   */
  fromAllocation: number;
  /**
   * C-GROWTH-001 ADDED — **지금 단계가 이 값에 보탠 몫.** 위 fromAllocation 과 나란히
   * 서며 같은 성질이다: 0 이어도 실리고, View 가 빼서 만들지 않는다.
   *
   * 다른 점 둘. **음수가 되지 않는다** — 자라는 것은 얻는 일이지 나누는 일이 아니다.
   * 그리고 이 몫은 국면이 아니라 **이력**에서 온다 — 배분을 되돌리면 사라지지만
   * 자란 것은 되돌아가지 않는다.
   *
   * 관통에서는 언제나 0 이다 (자라지 않는 값이므로). 그래도 자리를 비우지 않는 이유는
   * 세 칸의 생김새가 같아야 화면이 갈래를 짓지 않기 때문이다.
   *
   * GROWTH 트랙이 COMBAT 트랙의 파일에 더한 **한 줄**이다 — 한 방의 경위는 전투의
   * 것이고 그 안에 성장의 몫이 실린다. 기존 줄을 옮기지 않고 끝에만 붙였다
   * (guides/works.md 공유 지점 규칙 · LANES 충돌 칸).
   */
  fromGrowth: number;
}

// 이 한 방이 크게 터졌는가와 그 경위 (C015 ADDED).
// **터지지 않은 타격에도 실린다** — 터지지 않았다는 사실 역시 관찰이어야 한다.
// 읽는 법:
//   occurred 거짓 · chance > 0   → 이번엔 운이 없었다
//   occurred 거짓 · chance = 0   → 터질 리 없는 몸이다
//   damageBeforeCritical == finalDamage → 이 숫자는 흔들리지 않았다
// 세계가 지닌 흔들림(뿌리·커서)도, 그 판정의 Roll 값도 여기 실리지 않는다 —
// 실으면 다음 한 방이 터질지가 계산 가능해진다 (04 OBSERVABLE PROJECTION NOTE).
export interface CriticalOutcomeView {
  occurred: boolean;
  chance: number; // 판정에 실제로 쓰인 가능성 (0~1). 0 이어도 실린다
  multiplier: number; // 치는 자의 증폭 성질 (1 이상). 터지지 않아도 실린다
  damageBeforeCritical: number; // 커지기 전의 최종 피해
}

// 막기가 이 한 방에 한 일 (C011 ADDED).
// blocked 와 broken 은 동시에 참이 되지 않는다 — 막았거나 무너졌거나 둘 중 하나다.
export interface GuardOutcomeView {
  blocked: boolean;
  broken: boolean; // 이 타격에 방어가 무너졌다 — 피해는 줄지 않았고 방어는 사라졌다
  cpPaid: number; // 생명 대신 치른 기력 (무너졌으면 0)
  prevented: number; // 막아서 덜 들어간 값 = finalDamage - appliedDamage
}

/** 한 방에서 참이었던 조건 하나와 그 몫 (C-COMBAT-003 ADDED) */
export interface MetConditionView {
  id: string; // 사정의 이름 — 문구 변환은 View 책임
  bonus: number; // 계수에 더해진 몫
}

// 한 방의 크기가 어떻게 나왔는가 (C010 ADDED) — 세계는 결과와 함께 그 경위를 낸다.
export interface DamageBreakdownView {
  damageType: string; // C012 — 이 타격의 방식 (physical | aura)
  /** C-COMBAT-001 — 타격 시점 치는 쪽의 배분 (의미 코드) */
  attackerAllocation: string;
  /** C-COMBAT-001 — 타격 시점 맞는 쪽의 배분 (의미 코드) */
  targetAllocation: string;
  /**
   * C-COMBAT-003 — 이 한 방에서 참이었던 조건들과 각자의 몫.
   *
   * **참인 것이 없어도 빈 배열로 실린다** — `fromAllocation` 이 0 이어도 실리는 것과
   * 같은 이유다: "이번 한 방에 사정이 아무것도 하지 않았다" 는 사실 역시 관찰이어야
   * 사정을 만들러 갈 근거가 생긴다.
   *
   * offenseStat 과 이 값 둘로 되짚기가 성립한다 (UL §35) — 이 한 방이 왜 이만큼인지.
   */
  conditions: MetConditionView[];
  offenseStat: TypedStatView; // C012 — 방식이 고른 공격 능력
  baseDamage: number; // 스킬 자체의 강함
  attackContribution: number; // 고른 공격 능력이 더한 몫 = OffenseStat × AttackRatio
  rawDamage: number; // baseDamage + attackContribution
  // C013 — 걷히기 전 값 (상대가 지닌 방어와 같은 수). 감쇄식에 실제로 들어간 값은
  // effectiveDefense 가 가진다.
  defenseStat: TypedStatView;
  penetrationStat: TypedStatView; // C013 — 이 타격에서 작용한 관통. 0 이어도 실린다
  effectiveDefense: number; // C013 — 걷힌 뒤의 방어. defenseMultiplier 가 실제로 읽은 값
  defenseMultiplier: number; // 걷힌 방어가 남긴 비율 (0 초과 1 이하)
  // C015 CHANGED — "막지 않았다면 들어왔을 값" 이라는 뜻은 그대로이고,
  // 이제 그 값이 증폭을 포함한다. 커지기 전 값은 critical.damageBeforeCritical 이 가진다.
  finalDamage: number;
  critical: CriticalOutcomeView; // C015 ADDED — 언제나 실린다
  appliedDamage: number; // C011 — 실제로 생명에서 빠진 값. amount 와 언제나 같다
  guard?: GuardOutcomeView; // C011 — 막지 않은 타격에는 실리지 않는다
}

// 한 번의 타격이 낳은 결과 (C007) — 맞은 자리에서 잠시 드러났다가 사라진다.
//   amount === breakdown.appliedDamage    항상 참
//   amount === breakdown.finalDamage      막지 않은 타격에서만 참
export interface StrikeEventView {
  attackerId: string;
  targetId: string;
  skill: string; // attack | heavy-attack | aura-strike
  amount: number;
  at: GameViewPosition; // 맞은 몸의 중심
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
  breakdown: DamageBreakdownView; // C010 ADDED
}

// 지금 이 관찰자가 무엇을 고르고 있는가 (C017 ADDED — INTENT-TARGET-OBSERVE-001).
// **늘 실린다** — 고른 것이 없다는 것도 관찰이다 (C011 · C014 가 세운 태도).
//
// Id 하나뿐이다. 이름·생명·지금 행동·가려짐은 여기에 **다시 싣지 않는다** —
// 이미 entities 에 그 존재의 자리로 와 있고, 두 곳에서 오면 사본이 낡는다
// (C014 가 앎에 대해 내린 판단 그대로: 담는 것은 Id 이고 값은 그 순간에 읽는다).
// View 는 이 Id 로 entities 를 짚어 대상 자리를 조립한다 (04 VIEW ASSEMBLY NOTE).
//
// 다른 관찰자가 무엇을 고르는지도, 누가 나를 고르는지도 오지 않는다 —
// 세계에 그런 상태가 없다 (DC-TARGET-IS-INTENT-NOT-AIM).
export interface CurrentTargetView {
  entityId?: string; // 없으면 아무것도 고르지 않은 것이다
}

// 닿았으나 해가 성립하지 않은 접촉 (C018 ADDED — INTENT-UNHARMED-IS-OBSERVABLE-001).
// StrikeEventView 와 **나란한 자리**이며 같은 수명을 가진다. 둘은 섞이지 않는다:
// 타격 결과는 피해 산정 경위를 반드시 지니고 이쪽은 산정 자체가 없다.
// 이것이 없으면 화면에서 무산은 빗나감과 구분되지 않고, 그 구분을 View 가 짐작으로
// 메우기 시작한다. 자율 존재가 낸 무산도 함께 온다 — 관문은 양쪽에 똑같이 서기 때문이다.
export interface UnharmedContactView {
  attackerId: string;
  targetId: string;
  skill: string; // attack | heavy-attack | aura-strike
  at: GameViewPosition; // 닿은 몸의 중심
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
  reason: string; // 사유 코드 (not-hostile) — 문구 변환은 View 책임
}

// 선딜 중에 끊겨 없던 일이 된 기술 (C019 ADDED — INTENT-CANCEL-IS-OBSERVABLE-001).
// StrikeEventView · UnharmedContactView 와 **나란한 자리**이며 같은 수명을 가진다.
// 셋이 답하는 질문이 다르므로 한 자리에 섞지 않는다:
//     strikes    닿았고 해가 성립했다            피해 산정 경위를 지닌다
//     contacts   닿았으나 관계가 막았다          산정이 없다 · 사유가 있다
//     cancels    맞은 쪽의 기술이 사라졌다       산정이 없다
// 캔슬은 strikes 와 **함께** 온다 — 끊은 타격 자체는 성립한 타격이기 때문이다.
// 둘은 같은 순간의 다른 두 사실이며, 화면에서 한 장면으로 그려지더라도 계약에서는
// 합치지 않는다 (04 GameView Spec).
export interface CancelEventView {
  attackerId: string; // 끊은 쪽
  targetId: string; // 끊긴 쪽
  skill: string; // 무엇이 끊겼는가 — attack | heavy-attack | aura-strike
  at: GameViewPosition; // 끊긴 몸의 자리
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
}
