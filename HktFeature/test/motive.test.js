// ============================================================================
// feature-0018 step 1 — 동기(motive) 층 + 2단 선택 + 사냥 재분류(기회의 해소)
//
// 명제: **욕구(동기)는 줄이려는 상태 차이(결핍)이고, 전략은 그 차이를 줄이는 수단이다.**
//   리트머스 — ctx 로 차이를 잴 수(appraise) 있으면 동기, 없으면 전략. 그래서 채집·식사·사냥은 전략이고,
//   그 셋이 함께 줄이는 차이(허기)가 동기다. 엔진은 2단으로 고른다: ① 어떤 동기가 급한가(appraise 최대)
//   → ② 그 동기의 전략 중 지금 가장 값어치 있는(value=수입−비용≈−거리) 수단.
//
// 핵심 증명(사냥 재분류 = 기회의 해소): emote·priority 주입 없이 **굶주린** 개체가, 밥이 멀고 먹이가
//   가까우면 스스로 **사냥 전략**을 골라 강탈한다 — "기회는 감정이 아니라 전략 선택". 밥이 가까우면 채집으로
//   갈리고, 배부르면(차이 0) 채집·사냥이 함께 잠든다. 전략(감정 무관 늘 수행)과 동기(차이 없으면 잠듦)의 대비.
// 강제: 순수 선택 계층(rng 미사용) → 결정론. 모든 행동은 ledger.transfer → 보존(전 풀 합계 = 10⁹).
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MOTIVES, DESIRE_PROCEDURES, registerMotive, registerDesire } from '../shared/desires.js';
import { POOL, CAUSE, WORLD_SOURCE_INITIAL, DESIRE, MOTIVE, CREATURE_MAX_ENERGY } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  const player = game.addPlayer(conn, '조종자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) { clock.t += 100; game.tick(); } };
  return { game, player, msgs, bal, total, runTicks };
}

// 소유 사냥꾼(큰 몸) — appraise·강탈이 성립하도록 size·용량을 키운다.
function hunter(game, playerId, x, y, z, size = 2) {
  const cre = game.possessCreature(playerId, x, y, z);
  cre.size = size;
  const pool = game.ledger.get(cre.id);
  if (pool) pool.max = CREATURE_MAX_ENERGY * size;
  return cre;
}
function edibleCrystal(game, x, y, z, amount = 4000) { const c = game.spawnFood(x, y, z, 3, amount); return c; }
function preyCreature(game, x, y, z, energy = 800) { const p = game.spawnCreature(x, y, z); game.ledger.transfer(POOL.SOURCE, p.id, energy, 'seed'); return p; }
function bigger(game, x, y, z, size = 4, energy = 3000) { // 나보다 큰 위협/강적
  const v = game.spawnCreature(x, y, z); v.size = size; game.ledger.get(v.id).max = CREATURE_MAX_ENERGY * size;
  game.ledger.transfer(POOL.SOURCE, v.id, energy, 'seed'); return v;
}
// 잔고를 목표치로(보존 유지 — SOURCE 와 주고받는다).
function setBalance(game, id, target) {
  const cur = game.ledger.balance(id);
  if (target > cur) game.ledger.transfer(POOL.SOURCE, id, target - cur, 'seed');
  else if (target < cur) game.ledger.transfer(id, POOL.SOURCE, cur - target, 'drain');
}
// 붙어 놓인 두 재료(raw, tier0) — 제조 조합 쌍(feature-0018 step2 질서). 서로 CRAFT_PAIR_RADIUS(220) 안.
//   조합은 한 번에 끝나므로(둘→하나) 여러 쌍을 겹쳐 두면 여러 틱 이어서 제조한다(추적 관찰용).
function craftPairsAt(game, x, y, z, pairs = 3) {
  for (let i = 0; i < pairs; i++) {
    game.spawnRawFood(x - 40, y + i * 30, z, 2, 3000);
    game.spawnRawFood(x + 40, y + i * 30, z, 7, 3000);
  }
}
// n 틱 돌며 각 틱의 수행 전략을 모은다(전략이 순간적일 수 있어 스냅이 아니라 흔적으로 검증).
function traceStrategies(runTicks, cre, n) {
  const seen = [];
  for (let i = 0; i < n; i++) { runTicks(1); seen.push(cre.activeStrategy); }
  return seen;
}
test('리트머스 — 모든 동기는 appraise 를 갖고 전략 목록을 가리킨다(동기/전략 분리)', () => {
  const names = Object.keys(MOTIVES);
  assert.ok(names.includes(MOTIVE.HUNGER) && names.includes(MOTIVE.SAFETY), '허기·안전 동기가 등록되어 있다');
  for (const name of names) {
    const m = MOTIVES[name];
    assert.equal(typeof m.appraise, 'function', `동기 ${name} 는 appraise(차이 측정)를 갖는다`);
    assert.ok(Array.isArray(m.strategies) && m.strategies.length > 0, `동기 ${name} 는 전략 목록을 갖는다`);
    for (const s of m.strategies) assert.ok(DESIRE_PROCEDURES[s.name], `동기 ${name} 의 전략 ${s.name} 는 등록된 전략(수단)이다`);
  }
  // 허기 = 채집·식사·사냥(같은 결핍을 다른 경로로), 안전 = 회피.
  assert.deepEqual(MOTIVES[MOTIVE.HUNGER].strategies.map(s => s.name), [DESIRE.FORAGE, DESIRE.EAT, DESIRE.HUNT]);
  assert.deepEqual(MOTIVES[MOTIVE.SAFETY].strategies.map(s => s.name), [DESIRE.FLEE]);
});

test('사냥 재분류 = 기회의 해소 — 굶주림+가까운 먹이(밥은 멀리)면 emote 없이 스스로 사냥한다', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1600, 500);   // 밥 = 멀리(거리 600)
  const prey = preyCreature(s.game, 1000, 1120, 500, 800); // 먹이(size1) = 가까이(거리 120, 강탈 사거리 200 안)
  const preyId = prey.id;
  s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1); // **동기만** 준다 — HUNT/FORAGE 전략은 주입하지 않는다
  setBalance(s.game, me.id, 300);                     // 굶주림(용량 2000 의 절반 미만)

  let attackToMe = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.ATTACK && t === me.id) attackToMe += r; return r; };

  s.runTicks(10);
  assert.deepEqual([...me.desires.keys()], [MOTIVE.HUNGER], '스택엔 동기(허기)만 있다 — 사냥 전략은 주입되지 않았다');
  assert.ok(attackToMe > 0, '굶주린 개체가 스스로 사냥 전략을 골라 가까운 먹이를 강탈했다(수입=ATTACK, emote 없이)');
  assert.equal(me.activeStrategy, DESIRE.HUNT, '수행 중 전략 = 사냥(동기 허기가 사냥 수단을 골랐다)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '강탈·이동이 뒤섞여도 보존 불변');
});

test('상황이 전략을 가른다 — 같은 허기라도 밥이 가까우면 채집한다(먹이는 멀리)', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1120, 500);   // 밥 = 가까이(거리 120, 채집 사거리 300 안)
  preyCreature(s.game, 1000, 1600, 500, 800); // 먹이 = 멀리(거리 600)
  s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1);
  setBalance(s.game, me.id, 300);

  let harvestToMe = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.HARVEST && t === me.id) harvestToMe += r; return r; };

  s.runTicks(6);
  assert.ok(harvestToMe > 0, '밥이 가까우면 같은 허기가 채집 전략을 고른다(사냥 아님)');
  assert.equal(me.activeStrategy, DESIRE.FORAGE, '수행 중 전략 = 채집');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('배부르면 동기가 잠든다 — 곁에 밥·먹이가 있어도 채집도 사냥도 하지 않는다(차이 0 = 결핍 없음)', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1120, 500);    // 밥 가까이
  preyCreature(s.game, 1000, 1120, 500, 800); // 먹이 가까이(둘 다 사거리 안)
  s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1);
  setBalance(s.game, me.id, 1900);           // 포만(용량 2000)

  let harvestToMe = 0, attackToMe = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.HARVEST && t === me.id) harvestToMe += r; if (c === CAUSE.ATTACK && t === me.id) attackToMe += r; return r; };

  s.runTicks(8);
  assert.equal(me.desires.get(MOTIVE.HUNGER).feeling, 0, '포만 → 허기 감정 0(차이 없음)');
  assert.equal(harvestToMe, 0, '배부르면 채집하지 않는다');
  assert.equal(attackToMe, 0, '배부르면 사냥하지 않는다 — 허기 전략이 함께 잠든다');
  assert.equal(me.activeStrategy, null, '수행 중 전략 없음(대기)');
});

test('안전 동기 = 회피 — 위협(더 큰 포식자)이 가까우면 스스로 멀어진다', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  const threat = bigger(s.game, 1000, 1100, 500, 4); // 나보다 큰 위협(거리 100)
  s.game.injectDesire(s.player.id, MOTIVE.SAFETY, 1);
  setBalance(s.game, me.id, 1500); // 넉넉(회피는 예비가 있어야 도망)
  const d0 = Math.hypot(me.x - threat.x, me.y - threat.y, me.z - threat.z);
  s.runTicks(5);
  const d1 = Math.hypot(me.x - threat.x, me.y - threat.y, me.z - threat.z);
  assert.ok(me.desires.get(MOTIVE.SAFETY).feeling > 0, '위협 근접이 안전 동기의 자율 감정을 만든다');
  assert.ok(d1 > d0, '안전 동기가 회피 전략을 골라 위협에서 멀어졌다');
  assert.equal(me.activeStrategy, DESIRE.FLEE, '수행 중 전략 = 회피');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('하위 호환 — 전략 이름(legacy)을 직접 주입하면 그 전략을 그대로 수행한다(구 0011·0012 무변경)', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1120, 500);
  s.game.injectDesire(s.player.id, DESIRE.FORAGE, 1); // 전략 이름 직접 주입(동기 없이)
  setBalance(s.game, me.id, 300);
  let harvestToMe = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.HARVEST && t === me.id) harvestToMe += r; return r; };
  s.runTicks(4);
  assert.equal(me.desire, DESIRE.FORAGE, 'legacy 전략 주입은 그 전략이 승자(하위 호환)');
  assert.ok(harvestToMe > 0, 'legacy 채집 전략이 그대로 먹는다');
});

test('개방 — 런타임에 registerMotive 로 얹은 새 동기도 엔진이 2단으로 수행한다(game.js 무수정)', () => {
  const s = setup();
  let ran = false;
  registerDesire('gather-glow', { // 새 전략(수단)
    label: '수집', release: '이동→국소장',
    steps: [{ name: 'do', applicable: () => true, act: () => { ran = true; } }],
  });
  registerMotive('curiosity', { // 새 동기 — 상수 차이(항상 급함)
    label: '호기심', appraise: () => 30,
    strategies: [{ name: 'gather-glow', value: () => 0 }],
  });
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  s.game.injectDesire(s.player.id, 'curiosity', 1);
  s.runTicks(2);
  assert.equal(me.desires.get('curiosity').feeling, 30, '엔진이 새 동기의 appraise 를 부른다(무수정)');
  assert.ok(ran, '엔진이 새 동기의 전략 단계를 2단으로 수행한다(무수정)');
  assert.equal(me.activeStrategy, 'gather-glow', '수행 중 전략 = 새로 얹은 수단');
});

test('결정론 — 같은 배치/잔고면 동기의 2단 선택·행동이 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
    edibleCrystal(s.game, 1000, 1500, 500);
    preyCreature(s.game, 1000, 1130, 500, 800);
    s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1);
    setBalance(s.game, me.id, 320);
    s.runTicks(30);
    return [me.x, me.y, me.z, s.bal(me.id), me.activeStrategy, me.desires.get(MOTIVE.HUNGER).feeling, s.total()];
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일(2단 선택 포함)');
});

test('보존 폭풍 — 굶주림·포만이 뒤섞여 동기가 계속 자고 깨도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 5; i++) edibleCrystal(s.game, 500 + i * 120, 800, 500, 2000);
  for (let i = 0; i < 6; i++) {
    const c = hunter(s.game, s.player.id, 520 + i * 110, 850, 500, 2);
    preyCreature(s.game, 540 + i * 110, 900, 500, 400);
    s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1);
    setBalance(s.game, c.id, i % 2 === 0 ? 300 : 1800); // 절반 굶주림·절반 포만
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '동기가 계속 자고 깨며 채집/사냥이 갈려도 총합 불변');
});

// ── step 2 — 잉여 동기(질서): 배부르면 스스로 제조, 굶주리면 허기로 역전 ──────────────────────────

test('질서 동기 = 잉여 제조 — 배부른 개체가 곁의 재료 쌍을 외부 주입 없이 스스로 조합한다', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  craftPairsAt(s.game, 1000, 1080, 500); // 재료 쌍들(사거리 안)
  s.game.injectDesire(s.player.id, MOTIVE.ORDER, 1); // **질서 동기만** — CRAFT 전략은 주입하지 않는다
  setBalance(s.game, me.id, 1900);                    // 포만(잉여 > 0)

  let craftTx = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.CRAFT && f === me.id) craftTx += r; return r; };

  const seen = traceStrategies(s.runTicks, me, 8);
  assert.ok(me.desires.get(MOTIVE.ORDER).feeling > 0, '포만 → 잉여 감정(질서)이 스스로 오른다');
  assert.ok(craftTx > 0, '배부른 개체가 스스로 제조한다(질서 동기가 제조 전략을 골랐다 — CRAFT 주입 없이)');
  assert.ok(seen.includes(DESIRE.CRAFT), '수행 중 전략에 제조가 나타난다');
  assert.ok(!seen.includes(DESIRE.FORAGE) && !seen.includes(DESIRE.HUNT), '배부르니 허기 전략은 나오지 않는다(질서만)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('허기↔질서 역전 — 같은 스택이라도 배부르면 제조(질서)·굶주리면 채집(허기)으로 뒤집힌다', () => {
  const build = (bal) => {
    const s = setup();
    const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
    edibleCrystal(s.game, 1000, 1120, 500);   // 밥(허기 전략 표적)
    craftPairsAt(s.game, 900, 1000, 500);      // 재료 쌍들(질서 전략 표적)
    s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1); // 두 동기 공통 스택
    s.game.injectDesire(s.player.id, MOTIVE.ORDER, 1);
    setBalance(s.game, me.id, bal);
    return traceStrategies(s.runTicks, me, 5).filter(Boolean);
  };
  const full = build(1900), hungry = build(300);
  assert.ok(full.includes(DESIRE.CRAFT) && !full.includes(DESIRE.FORAGE), '배부르면 질서가 깨어 제조한다(허기는 잉여라 잠듦)');
  assert.ok(hungry.includes(DESIRE.FORAGE) && !hungry.includes(DESIRE.CRAFT), '굶주리면 허기가 깨어 채집한다(질서는 잉여 0 이라 잠듦) — 역전');
});

// ── step 3 — 명령 층: 전략 버튼은 자율 동기를 이기고, 소진되면 자율로 복귀한다 ─────────────────────

test('명령 > 자율 — 전략 버튼(commandStrategy)이 자율 동기의 선택을 우회한다', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1120, 500);            // 밥 가까이 → 자율 허기라면 채집했을 것
  const prey = preyCreature(s.game, 1000, 1180, 500, 800); // 먹이(조금 더 멀리)
  s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1);  // 자율: 가까운 밥을 채집하려 함
  setBalance(s.game, me.id, 300);

  let attackToMe = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.ATTACK && t === me.id) attackToMe += r; return r; };

  s.game.commandStrategy(s.player.id, DESIRE.HUNT); // **명령: 사냥** — 자율(채집)을 우회
  s.runTicks(8);
  assert.equal(me.commandedStrategy, DESIRE.HUNT, '명령이 걸려 있다');
  assert.equal(me.activeStrategy, DESIRE.HUNT, '자율이 채집을 고를 상황인데 명령대로 사냥한다(명령>자율)');
  assert.ok(attackToMe > 0, '명령한 사냥으로 먹이를 강탈했다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('소진 시 자율 복귀 — 명령한 전략이 표적 없어 수행 불가면 해제되고 자율 동기가 잇는다', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1120, 500);   // 밥(자율 허기의 표적) — 제조 재료는 없다
  s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1);
  setBalance(s.game, me.id, 300);

  let harvestToMe = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.HARVEST && t === me.id) harvestToMe += r; return r; };

  s.game.commandStrategy(s.player.id, DESIRE.CRAFT); // 명령: 제조 — 그러나 재료 쌍이 없다(소진)
  s.runTicks(5);
  assert.equal(me.commandedStrategy, null, '수행 불가(재료 없음) → 명령이 해제된다');
  assert.ok(harvestToMe > 0, '명령 해제 후 자율 허기가 밥을 채집한다(자율 복귀)');
});

test('명령 해제(대기/none) — 명령을 거두면 자율 동기가 곧바로 재개된다', () => {
  const s = setup();
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1120, 500);
  s.game.injectDesire(s.player.id, MOTIVE.HUNGER, 1);
  setBalance(s.game, me.id, 300);
  s.game.commandStrategy(s.player.id, DESIRE.FLEE); // 명령(회피 — 위협 없어 소진될 것)
  s.game.commandStrategy(s.player.id, DESIRE.NONE); // 대기 = 명령 해제
  assert.equal(me.commandedStrategy, null, 'none 명령은 오버라이드를 해제한다');
  s.runTicks(4);
  assert.equal(me.activeStrategy, DESIRE.FORAGE, '명령을 거두면 자율 허기가 채집을 재개한다');
});

test('개방 재증명 — 런타임 등록 동기를 명령이 우회하고, 소진되면 그 동기로 복귀한다(엔진 무수정)', () => {
  const s = setup();
  let idled = false;
  registerDesire('sunbathe', { // 새 전략(항상 수행 가능·행동 없음)
    label: '일광', release: '없음', steps: [{ name: 'bask', applicable: () => true, act: () => { idled = true; } }],
  });
  registerMotive('leisure', { label: '여가', appraise: () => 20, strategies: [{ name: 'sunbathe', value: () => 0 }] });
  const me = hunter(s.game, s.player.id, 1000, 1000, 500, 2);
  edibleCrystal(s.game, 1000, 1120, 500);
  s.game.injectDesire(s.player.id, 'leisure', 1); // 자율: 여가(일광)
  setBalance(s.game, me.id, 1500);
  s.game.commandStrategy(s.player.id, DESIRE.CRAFT); // 명령: 제조 — 재료 없어 소진될 것
  s.runTicks(3);
  assert.equal(me.commandedStrategy, null, '명령이 소진돼 해제된다');
  assert.equal(me.activeStrategy, 'sunbathe', '런타임 등록 동기(여가)로 복귀해 그 전략을 수행한다(game.js 무수정)');
  assert.ok(idled, '엔진이 런타임 동기의 전략을 수행했다');
});
