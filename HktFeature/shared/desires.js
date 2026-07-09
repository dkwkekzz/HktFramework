// ============================================================================
// 욕구 절차(procedure) 레지스트리 — feature-0011.
//
// 명제: 생명체는 **욕구에 따라 적절한 방식으로 에너지를 방출**한다. 욕구가 무엇이냐에 따라 방출 형태가
//   다르고(이동=국소장 소산 · 요리=열+연기 · 발산=심우주 …), 그 방출에는 **구체적 정책**이 있다 — 정책이 곧
//   이 "절차(procedure)"다. 하나의 욕구 = **우선순위 순서의 단계(step) 목록**. 엔진은 매 틱 **첫 번째로
//   적용 가능한(applicable) 단계**를 실행한다. 그래서 욕구를 상황에 따라 절차적으로 수행한다:
//     밥을 먹고 싶다(EAT) → 밥을 찾아 다가가고(approach) → 그대로 못 먹으면(날것) 요리하고(cook) → 먹는다(eat).
//   각 단계의 실행은 에너지를 필요로 하며 방출된다(모두 ledger.transfer → 보존·정수).
//
// **개방성(핵심 증명)**: 단계는 오직 `ctx`(엔진이 제공하는 지각·행동 API)만 쓴다 — 엔진·게임 내부에
//   의존하지 않는다. 그래서 **어떤 욕구든, 어떤 절차든 `registerDesire` 로 얹기만 하면 되고 엔진은 손대지
//   않는다.** 런타임에 새 욕구를 등록해도 엔진이 그대로 실행한다(test/eat.test.js 가 이를 증명).
//
// ctx 계약 (game.js #desireCtx 가 구현):
//   상수:  EAT_REACH · STRIKE_REACH · LEASH_STOP · CRAFT_REACH (도달 사거리)
//   지각:  nearestCrystal({edibleOnly}?) · nearestPrey() · ownerPos() · inReach(target, radius) · edible(crystal)
//          craftPair() — 조합 가능한 재료 쌍 {a,b} (feature-0010 step2 제조)
//          capacity() · balance() — 자기 상태(용량·잔고). appraise(ctx) 가 굶주림 같은 '차이'를 읽는다(feature-0012).
//   행동:  … · craft(a, b) — 두 재료를 산물로 조합(만드는 일=방출, feature-0010 step2)
//   행동:  moveToward(target, stop) · eat(crystal) · cook(crystal) · strike(prey) · dissipate(amount, cause)
//          (모든 행동은 에너지를 이동/방출한다 = ledger.transfer)
// ============================================================================

import { DESIRE, DESIRE_EMOTION_MAX, DESIRE_COMFORT_FRACTION } from './constants.js';

// 욕구 이름 → { label, release, steps:[{name, applicable(ctx), act(ctx)}] }
export const DESIRE_PROCEDURES = {};

// 개방 등록 — 새 욕구/절차를 얹는다(엔진 수정 없음). 같은 이름은 덮어쓴다.
export function registerDesire(name, procedure) {
  DESIRE_PROCEDURES[name] = procedure;
  return procedure;
}

// --- 단계 조각 ---------------------------------------------------------------

// 채집(FORAGE): **먹을 수 있는** 결정만 다룬다(날것은 못 다뤄 무시). 찾아가 → 먹는다.
const approachEdibleCrystal = {
  name: 'approach',
  applicable: (x) => { const c = x.nearestCrystal({ edibleOnly: true }); return !!c && !x.inReach(c, x.EAT_REACH); },
  act: (x) => { const c = x.nearestCrystal({ edibleOnly: true }); if (c) x.moveToward(c, x.EAT_REACH); },
};
const eatEdibleInReach = {
  name: 'eat',
  applicable: (x) => { const c = x.nearestCrystal({ edibleOnly: true }); return !!c && x.inReach(c, x.EAT_REACH); },
  act: (x) => { const c = x.nearestCrystal({ edibleOnly: true }); if (c) x.eat(c); },
};

// 식사(EAT): **어떤 결정이든** 향한다 — 날것이면 요리(변형)한 뒤 먹는다(절차적·상황 의존). 채집과의 차이가
//   곧 "절차가 있으면 못 먹던 날것도 먹을 수 있다"의 증명이다(같은 결정, 다른 욕구 = 다른 수행·다른 방출).
const approachAnyCrystal = {
  name: 'approach',
  applicable: (x) => { const c = x.nearestCrystal(); return !!c && !x.inReach(c, x.EAT_REACH); },
  act: (x) => { const c = x.nearestCrystal(); if (c) x.moveToward(c, x.EAT_REACH); },
};
const cookRawInReach = {
  name: 'cook',
  applicable: (x) => { const c = x.nearestCrystal(); return !!c && x.inReach(c, x.EAT_REACH) && !x.edible(c); },
  act: (x) => { const c = x.nearestCrystal(); if (c) x.cook(c); },
};
const eatAnyInReach = {
  name: 'eat',
  applicable: (x) => { const c = x.nearestCrystal(); return !!c && x.inReach(c, x.EAT_REACH) && x.edible(c); },
  act: (x) => { const c = x.nearestCrystal(); if (c) x.eat(c); },
};

// 사냥(HUNT): 더 작은 먹이로 다가가 → 타격(발산으로 질서를 부수고 강탈).
const approachPrey = {
  name: 'approach',
  applicable: (x) => { const p = x.nearestPrey(); return !!p && !x.inReach(p, x.STRIKE_REACH); },
  act: (x) => { const p = x.nearestPrey(); if (p) x.moveToward(p, x.STRIKE_REACH); },
};
const strikePrey = {
  name: 'strike',
  applicable: (x) => { const p = x.nearestPrey(); return !!p && x.inReach(p, x.STRIKE_REACH); },
  act: (x) => { const p = x.nearestPrey(); if (p) x.strike(p); },
};

// 제조(CRAFT): 가까이 놓인 두 재료(raw, 미가공) 결정(조합 지점)으로 다가가 → 하나의 산물로 조합한다(feature-0010 step2).
//   산물을 만드는 일은 에너지를 방출한다(열+연기, 순수 지출). 재료 쌍이 없으면 수행 불가(다음 우선순위로 내려간다).
//   feature-0011 의 개방 레지스트리에 **새 욕구를 실제로 얹는 첫 사례** — 엔진은 이 욕구를 모르고 ctx 만으로 실행한다.
const approachCraftSite = {
  name: 'approach',
  applicable: (x) => { const p = x.craftPair(); return !!p && !x.inReach(p.a, x.CRAFT_REACH); },
  act: (x) => { const p = x.craftPair(); if (p) x.moveToward(p.a, x.CRAFT_REACH); },
};
const craftHere = {
  name: 'craft',
  applicable: (x) => { const p = x.craftPair(); return !!p && x.inReach(p.a, x.CRAFT_REACH); },
  act: (x) => { const p = x.craftPair(); if (p) x.craft(p.a, p.b); },
};

// 대기(NONE): 주인 곁으로(수동 이동 = 방향키). 주인 없으면(야생) 아무 단계도 적용 안 됨 → 정지.
const leashOwner = {
  name: 'leash',
  applicable: (x) => { const o = x.ownerPos(); return !!o && !x.inReach(o, x.LEASH_STOP); },
  act: (x) => { const o = x.ownerPos(); if (o) x.moveToward(o, x.LEASH_STOP); },
};

// --- 자율 감정(appraise) — 상황(차이)이 스스로 만드는 중요도 (feature-0012 step2) ------------
//   "차이는 신호". 욕구 절차는 appraise(ctx) 로 지금 이 상황이 그 욕구를 얼마나 중요하게 느끼는지(feeling)를
//   스스로 계산한다. 오직 ctx 만 쓰므로(개방 경계) 어떤 욕구든 자기 감정을 정의할 수 있다. 엔진은 이름을 모른다.

// 굶주림 감정 — 잔고가 편안 임계(용량의 절반) 아래로 떨어질수록(=차이가 클수록) 오른다. 편안하면 0(포만 →
//   감정 감쇠 → 다음 욕구로). 식사·채집이 공유한다: 굶주리면 먹는 욕구의 중요도가 스스로 치솟는다.
function hungerFeeling(x) {
  const cap = x.capacity(), bal = x.balance();
  const comfort = DESIRE_COMFORT_FRACTION * cap;
  if (bal >= comfort || comfort <= 0) return 0;
  return Math.round(DESIRE_EMOTION_MAX * (comfort - bal) / comfort); // 차이(굶주림)에 비례 (0..MAX)
}

// --- 기본 욕구 등록 (feature-0010 이관 + feature-0011 식사 + feature-0012 자율 감정) ----------
//   release = 그 욕구가 주로 방출하는 형태(라벨·문서용). "욕구에 따라 방출 형태가 다르다".
//   appraise = 상황이 스스로 만드는 감정(feeling). 없으면 그 욕구의 중요도는 외생(priority+emotion)만으로 정해진다.
registerDesire(DESIRE.NONE,   { label: '대기', release: '이동→국소장', steps: [leashOwner] });
registerDesire(DESIRE.FORAGE, { label: '채집', release: '이동→국소장', steps: [approachEdibleCrystal, eatEdibleInReach], appraise: hungerFeeling });
registerDesire(DESIRE.EAT,    { label: '식사', release: '요리=열+연기',  steps: [approachAnyCrystal, cookRawInReach, eatAnyInReach], appraise: hungerFeeling });
registerDesire(DESIRE.HUNT,   { label: '사냥', release: '발산→심우주',   steps: [approachPrey, strikePrey] }); // 사냥의 중요도는 외생(우선순위)만 — 포만하면 이쪽이 이긴다
registerDesire(DESIRE.CRAFT,  { label: '제조', release: '조합=열+연기',  steps: [approachCraftSite, craftHere] }); // feature-0010 step2 — 새 욕구를 레지스트리에 얹는 첫 사례
