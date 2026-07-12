// ============================================================================
// 욕구 절차(procedure) 레지스트리 — 구 feature-0011(현 0018).
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
//          craftPair(tier?) — 조합 가능한 (같은 단계) 쌍 {a,b}. tier 주면 그 단계만 (구 feature-0010(현 0018)·0011 step2 다단계 제조)
//          capacity() · balance() — 자기 상태(용량·잔고). appraise(ctx) 가 굶주림 같은 '차이'를 읽는다(구 feature-0012(현 0018)).
//   행동:  … · craft(a, b) — 두 재료를 산물로 조합(만드는 일=방출, 구 feature-0010(현 0018) step2)
//   행동:  moveToward(target, stop) · eat(crystal) · cook(crystal) · strike(prey) · dissipate(amount, cause)
//          (모든 행동은 에너지를 이동/방출한다 = ledger.transfer)
// ============================================================================

import { DESIRE, MOTIVE, DESIRE_EMOTION_MAX, DESIRE_COMFORT_FRACTION } from './constants.js';

// 전략(strategy) 이름 → { label, release, steps:[{name, applicable(ctx), act(ctx)}] }
//   (구 이름 "욕구 절차" — feature-0018 재분류로 이 레지스트리는 **전략(수단)** 이 되고, 그 위에 동기(MOTIVES)를 얹는다)
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
// 사냥(HUNT) — 발산 갈래: **먹을 수 없는 강적**(size≥, 강탈 불가)이면 파이어볼(feature-0009)을 던진다. 조준 사거리
//   안이면 발사하고, 밖이면 발사 사거리까지 다가간다. "먹으면 강탈, 못 먹으면 폭탄"의 크기 분업을 한 사냥 절차 안에서
//   상황에 맞게 고른다(구 feature-0011(현 0018) 명제 — 상황에 맞게 절차적으로 수행).
const launchFoe = {
  name: 'launch',
  applicable: (x) => { const f = x.nearestFoe(); return !!f && x.inReach(f, x.DISCHARGE_REACH); },
  act: (x) => { const f = x.nearestFoe(); if (f) x.launch(f); },
};
const approachFoe = {
  name: 'approach',
  applicable: (x) => { const f = x.nearestFoe(); return !!f && !x.inReach(f, x.DISCHARGE_REACH); },
  act: (x) => { const f = x.nearestFoe(); if (f) x.moveToward(f, x.DISCHARGE_REACH); },
};

// 회피(FLEE): 더 큰 포식자(위협)에게서 **멀어진다**(구 feature-0012(현 0018) step3). 위협이 감지 반경 안에 있으면 반대로 도망친다.
//   위협이 멀어지면(반경 밖) threatFeeling→0 이라 이 욕구가 저절로 진다(상황이 행동을 거둔다).
const fleeThreat = {
  name: 'flee',
  applicable: (x) => !!x.nearestThreat(),
  act: (x) => { const t = x.nearestThreat(); if (t) x.moveAway(t); },
};

// 제조(CRAFT): 가까이 놓인 두 재료(raw, 미가공) 결정(조합 지점)으로 다가가 → 하나의 산물로 조합한다(구 feature-0010(현 0018) step2).
//   산물을 만드는 일은 에너지를 방출한다(열+연기, 순수 지출). 재료 쌍이 없으면 수행 불가(다음 우선순위로 내려간다).
//   구 feature-0011(현 0018) 의 개방 레지스트리에 **새 욕구를 실제로 얹는 첫 사례** — 엔진은 이 욕구를 모르고 ctx 만으로 실행한다.
//   **다단계(구 feature-0011(현 0018) step2)**: 절차에 단계를 더 얹어 재료(tier0)→중간물(tier1)→완성물(tier2)로 깊어진다 —
//   완성(중간물 두 개) 단계를 먼저, 중간(재료 두 개) 단계를 나중에 둬(첫 적용 단계 규칙) 상황에 맞게 다단계로 수행한다.
const approachCraftSite = {
  name: 'approach',
  applicable: (x) => { const p = x.craftPair(); return !!p && !x.inReach(p.a, x.CRAFT_REACH); },
  act: (x) => { const p = x.craftPair(); if (p) x.moveToward(p.a, x.CRAFT_REACH); },
};
const buildFinished = { // 중간물(tier1) 두 개 → 완성물(tier2). 상위 단계를 먼저 마무리한다.
  name: 'finish',
  applicable: (x) => { const p = x.craftPair(1); return !!p && x.inReach(p.a, x.CRAFT_REACH); },
  act: (x) => { const p = x.craftPair(1); if (p) x.craft(p.a, p.b); },
};
const buildIntermediate = { // 재료(tier0) 두 개 → 중간물(tier1).
  name: 'combine',
  applicable: (x) => { const p = x.craftPair(0); return !!p && x.inReach(p.a, x.CRAFT_REACH); },
  act: (x) => { const p = x.craftPair(0); if (p) x.craft(p.a, p.b); },
};

// 대기(NONE): 주인 곁으로(수동 이동 = 방향키). 주인 없으면(야생) 아무 단계도 적용 안 됨 → 정지.
const leashOwner = {
  name: 'leash',
  applicable: (x) => { const o = x.ownerPos(); return !!o && !x.inReach(o, x.LEASH_STOP); },
  act: (x) => { const o = x.ownerPos(); if (o) x.moveToward(o, x.LEASH_STOP); },
};

// --- 자율 감정(appraise) — 상황(차이)이 스스로 만드는 중요도 (구 feature-0012(현 0018) step2) ------------
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

// 위협 감정 (구 feature-0012(현 0018) step3) — 더 큰 포식자가 **가까이** 있을수록 회피의 중요도가 스스로 치솟는다. 위협이
//   가까우면 다른 어떤 욕구보다 도망이 이기고, 멀어지면 0 으로 감쇠해 하던 일로 돌아간다(상황이 감정을 만든다).
function threatFeeling(x) {
  const t = x.nearestThreat();
  if (!t) return 0;
  return Math.round(DESIRE_EMOTION_MAX * Math.max(0, (x.SEEK - x.distanceTo(t)) / x.SEEK)); // 가까울수록 ↑ (0..MAX)
}

// 잉여 감정 (feature-0018 step2) — 굶주림 감정의 **거울**. 잔고가 편안 임계(용량 절반) **위**로 오를수록(=잉여가
//   클수록) 오른다. 편안 이하(굶주림)면 0. 그래서 허기(임계 아래)와 질서(임계 위)는 한 축의 두 방향이라 **동시에 켜지지
//   않는다**: 배부르면 허기 0·잉여>0(질서가 깬다), 굶주리면 잉여 0·허기>0(허기로 역전). 질서 동기가 이걸 써서
//   "배부르면 스스로 제조하고 굶주리면 먹으러 간다"를 외부 주입 없이 만든다. 순수 계산(rng 미사용) → 결정론.
function surplusFeeling(x) {
  const cap = x.capacity(), bal = x.balance();
  const comfort = DESIRE_COMFORT_FRACTION * cap;
  const maxSurplus = cap - comfort;
  if (bal <= comfort || maxSurplus <= 0) return 0;
  return Math.round(DESIRE_EMOTION_MAX * (bal - comfort) / maxSurplus); // 잉여(포만)에 비례 (0..MAX)
}

// --- 기본 욕구 등록 (구 feature-0010(현 0018) 이관 + 구 feature-0011(현 0018) 식사 + 구 feature-0012(현 0018) 자율 감정) ----------
//   release = 그 욕구가 주로 방출하는 형태(라벨·문서용). "욕구에 따라 방출 형태가 다르다".
//   appraise = 상황이 스스로 만드는 감정(feeling). 없으면 그 욕구의 중요도는 외생(priority+emotion)만으로 정해진다.
registerDesire(DESIRE.NONE,   { label: '대기', release: '이동→국소장', steps: [leashOwner] });
registerDesire(DESIRE.FORAGE, { label: '채집', release: '이동→국소장', steps: [approachEdibleCrystal, eatEdibleInReach], appraise: hungerFeeling });
registerDesire(DESIRE.EAT,    { label: '식사', release: '요리=열+연기',  steps: [approachAnyCrystal, cookRawInReach, eatAnyInReach], appraise: hungerFeeling });
// 사냥(HUNT) — **완결형 절차**(구 feature-0011(현 0018) 명제: 욕구를 끝까지 절차적으로 수행). 상황에 맞는 무기로 대상을 처치하고
//   전리품까지 획득한다: ① 먹이(size<)가 근접이면 물리 강탈(strike, feature-0008 = 에너지 수입) ② 못 먹는 강적(size≥)이
//   사거리면 파이어볼(launch, feature-0009) ③④ 아니면 각자에게 다가간다 ⑤⑥ 처치 후 그 자리 시체 결정(전리품)을 채집한다
//   (feature-0005 죽음의 결정화 → feature-0007 채집, 채집 단계는 FORAGE 것 재사용). "죽여서 그 재료를 먹는다"가 한 욕구로 닫힌다.
registerDesire(DESIRE.HUNT,   { label: '사냥', release: '강탈+발산→전리품', steps: [strikePrey, launchFoe, approachPrey, approachFoe, approachEdibleCrystal, eatEdibleInReach] });
registerDesire(DESIRE.CRAFT,  { label: '제조', release: '조합=열+연기',  steps: [approachCraftSite, buildFinished, buildIntermediate] }); // 구 feature-0010(현 0018) step2(단일)·0011 step2(다단계)
registerDesire(DESIRE.FLEE,   { label: '회피', release: '이동→국소장',   steps: [fleeThreat], appraise: threatFeeling }); // 구 feature-0012(현 0018) step3 — 위협(더 큰 포식자)이 회피 감정을 스스로 만든다(가까울수록 도망이 이긴다)

// ============================================================================
// 동기(motive) 레지스트리 — feature-0018 step 1(재분류).
//
// 명제: **욕구(동기)는 줄이려는 상태 차이(결핍)이고, 전략은 그 차이를 줄이는 수단이다.**
//   리트머스: ctx 로 그 차이를 잴 수(appraise) 있으면 동기, 없으면 전략. 그래서 채집·식사·사냥은 전략이고,
//   그 셋이 함께 줄이는 차이(허기)가 동기다. 동기 하나 = { label, appraise(차이 측정), strategies(그 차이를 줄이는
//   수단 목록) }. 엔진(game.js #performDesire)이 2단으로 고른다:
//     ① 어떤 동기가 급한가(appraise=feeling 최대) → ② 그 동기의 전략 중 지금 가장 값어치 있는(value 최대) 수단.
//   전략(DESIRE_PROCEDURES)·절차·ctx·방출 회계는 **무변경** — 동기는 그 위에 얹는 순수 선택 계층이다(에너지 흐름을 만들지 않음).
//
// **동기의 잠듦**: 차이가 없으면(appraise=0) 그 동기의 전략은 전부 잠든다("결핍 없으면 동기 없음") — 배부르면
//   채집·식사·사냥이 함께 멎는다. 이것이 전략(감정 무관하게 늘 수행)과 동기의 결정적 차이다.
// **개방**: registerMotive 로 새 동기를 얹으면 엔진 무수정 실행(전략 개방 registerDesire 와 같은 결).
// ============================================================================

// 동기 이름 → { label, appraise(ctx), strategies:[{name, value(ctx)}] }
export const MOTIVES = {};

// 개방 등록 — 새 동기를 얹는다(엔진 수정 없음). 같은 이름은 덮어쓴다.
export function registerMotive(name, motive) {
  MOTIVES[name] = motive;
  return motive;
}

// 전략의 지금 값어치(기대 = 수입 − 비용) — 한 동기가 여러 전략 중 하나를 고르는 잣대. 이동 비용은 표적까지
//   거리에 비례하므로 값어치는 대략 **−거리**(가까운 기회일수록 높다). 표적이 없으면 null = 지금 이 전략은 불가.
//   그래서 **같은 허기라도 밥이 가까우면 채집, 먹이가 가까우면 사냥**으로 갈린다 — "기회는 감정이 아니라 전략 선택".
//   순수 계산(rng 미사용) → 결정론. distanceTo 는 ctx 지각(개방 경계) — 엔진은 이 함수의 의미를 모른다.
const forageValue = (x) => { const c = x.nearestCrystal({ edibleOnly: true }); return c ? -Math.round(x.distanceTo(c)) : null; };
const eatValue    = (x) => { const c = x.nearestCrystal();                    return c ? -Math.round(x.distanceTo(c)) - 1 : null; }; // 같은 결정이 익었으면 채집(요리 무비용)이 근소 우위(−1)
const huntValue   = (x) => { const p = x.nearestPrey() || x.nearestFoe();     return p ? -Math.round(x.distanceTo(p)) : null; };
const fleeValue   = (x) => { const t = x.nearestThreat();                     return t ? -Math.round(x.distanceTo(t)) : null; };
const craftValue  = (x) => { const p = x.craftPair();                         return p ? -Math.round(x.distanceTo(p.a)) : null; }; // 조합 쌍이 가까울수록 값어치(feature-0018 step2)

// 허기(hunger) — 결핍(잔고 < 편안 임계). 수입을 원한다. 전략 셋은 같은 결핍을 다른 경로로 채우는 형제다:
//   채집(익은 밥) · 식사(날것도 요리해 먹음) · 사냥(강탈+전리품). appraise=hungerFeeling(전략과 공유하던 그 차이).
registerMotive(MOTIVE.HUNGER, {
  label: '허기', appraise: hungerFeeling,
  strategies: [
    { name: DESIRE.FORAGE, value: forageValue },
    { name: DESIRE.EAT,    value: eatValue },
    { name: DESIRE.HUNT,   value: huntValue },
  ],
});
// 안전(safety) — 손실 회피(위협 근접 = 예상 강제 지출). 유출을 막고 싶다. 전략: 회피. appraise=threatFeeling.
registerMotive(MOTIVE.SAFETY, {
  label: '안전', appraise: threatFeeling,
  strategies: [
    { name: DESIRE.FLEE, value: fleeValue },
  ],
});
// 질서(order) — 잉여 투자(잔고 > 편안 임계). 지출해 질서(산물)를 산다. 전략: 제조. appraise=surplusFeeling(허기의 거울).
//   허기와 한 축의 반대 방향이라 자동 역전한다: 배부르면 질서가 깨어 스스로 제조하고, 굶주리면 잉여 0 으로 잠들며
//   허기가 깨어 먹으러 간다 — 외부 주입 없이 "여유가 있으면 만들고, 아쉬우면 채운다"(feature-0018 step2).
registerMotive(MOTIVE.ORDER, {
  label: '질서', appraise: surplusFeeling,
  strategies: [
    { name: DESIRE.CRAFT, value: craftValue },
  ],
});
