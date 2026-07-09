// ============================================================================
// feature-0011 — 욕구를 상황에 맞게 절차적으로 수행하며 에너지를 방출한다
//
// 직관: 욕구는 **절차(procedure)**로 수행된다. "밥을 먹고 싶다(EAT)" → 밥(결정)을 찾아 다가가고 → 그대로
//   못 먹으면(날것) **요리(변형)**하고 → 먹는다. 상황에 따라 필요한 단계만 절차적으로 밟는다. 각 단계의
//   수행은 에너지를 필요로 하고 방출된다(이동→국소장 · 요리→심우주 열+국소장 연기 · 타격→심우주 발산).
//   욕구가 무엇이냐에 따라 방출 형태가 다르다. 그리고 이 구조는 **개방**이다 — 어떤 욕구·어떤 절차든
//   registerDesire 로 얹기만 하면 엔진이 그대로 실행한다(엔진 수정 없음).
// 강제: 모든 행동이 ledger.transfer(보존·정수). rng 미사용 → 결정론 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { registerDesire, DESIRE_PROCEDURES } from '../shared/desires.js';
import { POOL, WORLD_SOURCE_INITIAL, DESIRE, dist3 } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  const player = game.addPlayer(conn, '조종자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const txByCause = (cause) => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops).filter(op => op.cause === cause);
  return { game, player, bal, total, runTicks, txByCause };
}

test('식사 절차 — 밥이 날것이면 요리한 뒤 먹는다 (찾기→요리→먹기, 상황에 따라 절차적)', () => {
  const s = setup();
  const cry = s.game.spawnRawFood(1250, 1250, 625, 0, 4000); // 재료(밥) = 날것
  assert.ok(cry.raw, '재료는 날것으로 시작한다(그대로 못 먹는다)');
  const cre = s.game.possessCreature(s.player.id, 700, 1250, 625); // 떨어진 곳(감지 반경 안)
  cre.desire = DESIRE.EAT;
  s.runTicks(45); // 다가가고 → 요리하고 → 먹는다
  assert.ok(s.txByCause('cook').some(op => op.from === cre.id), '날것을 요리(cook)했다 — 변형 단계');
  assert.ok(!cry.raw, '요리 후 밥이 먹을 수 있게 됐다(raw=false)');
  assert.ok(s.txByCause('harvest').some(op => op.to === cre.id), '요리한 밥을 먹었다(harvest) — 욕구가 이뤄진다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '절차 전 과정에서 보존 불변');
});

test('요리는 에너지를 방출한다 — 열(심우주)+연기(국소장), 순수 지출(보존)', () => {
  const s = setup();
  s.game.spawnRawFood(700, 700, 500, 0, 3000);
  const cre = s.game.possessCreature(s.player.id, 700, 700, 500); // 밥 곁(사거리 안) → 바로 요리
  cre.desire = DESIRE.EAT;
  const sink0 = s.bal(POOL.SINK);
  s.runTicks(3);
  const cooks = s.txByCause('cook').filter(op => op.from === cre.id);
  assert.ok(cooks.some(op => op.to === POOL.SINK), '요리 방출 일부가 심우주로(열)');
  assert.ok(cooks.some(op => op.to.startsWith(POOL.MATERIAL)), '요리 방출 나머지가 국소장으로(연기)');
  assert.ok(s.bal(POOL.SINK) > sink0, '심우주가 늘었다 — 요리는 회수 없는 방출(수행의 대가)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('절차의 차이 — 채집(요리 없음)은 날것을 못 먹지만, 식사(요리 포함)는 먹는다', () => {
  // 채집: 날것 곁이어도 못 먹는다(절차에 요리 단계가 없다 = 날것을 다룰 수 없다)
  const a = setup();
  const cryA = a.game.spawnRawFood(600, 600, 500, 0, 3000);
  const forager = a.game.possessCreature(a.player.id, 600, 600, 500);
  forager.desire = DESIRE.FORAGE;
  const balA = a.bal(cryA.id);
  a.runTicks(20);
  assert.equal(a.bal(cryA.id), balA, '채집 욕구는 날것을 건드리지 못한다(결정 잔고 불변)');
  assert.equal(a.txByCause('harvest').filter(op => op.to === forager.id).length, 0, '채집으로는 날것을 못 먹는다');

  // 식사: 같은 날것을 요리해 먹는다 — "절차가 있으면 못 먹던 것도 먹는다"
  const b = setup();
  const cryB = b.game.spawnRawFood(600, 600, 500, 0, 3000);
  const eater = b.game.possessCreature(b.player.id, 600, 600, 500);
  eater.desire = DESIRE.EAT;
  b.runTicks(20);
  assert.ok(b.bal(cryB.id) < 3000, '식사 욕구는 요리해 먹는다(결정 잔고 감소)');
  assert.ok(b.txByCause('harvest').some(op => op.to === eater.id), '식사는 요리한 밥을 먹는다');
});

test('욕구마다 방출 형태가 다르다 — 식사=요리(cook)·사냥=발산(burst)', () => {
  const s = setup();
  // 식사 개체: 날것을 요리 → cook 방출
  s.game.spawnRawFood(700, 700, 500, 0, 3000);
  const eater = s.game.possessCreature(s.player.id, 700, 700, 500);
  eater.desire = DESIRE.EAT;
  // 사냥 개체: 곁의 더 작은 먹이를 타격 → burst 발산
  const hunter = s.game.possessCreature(s.player.id, 1400, 700, 500);
  hunter.size = 2; s.game.ledger.get(hunter.id).max = 2000;
  s.game.ledger.transfer(POOL.SOURCE, hunter.id, 1500, 'seed');
  hunter.desire = DESIRE.HUNT;
  const prey = s.game.spawnCreature(1450, 700, 500);
  s.game.ledger.transfer(POOL.SOURCE, prey.id, 500, 'seed');
  s.runTicks(5);
  assert.ok(s.txByCause('cook').some(op => op.from === eater.id), '식사 개체의 방출 형태 = 요리(cook)');
  assert.ok(s.txByCause('burst').some(op => op.from === hunter.id), '사냥 개체의 방출 형태 = 발산(burst)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('개방성 증명 — 런타임에 새 욕구/절차를 등록하면 엔진이 그대로 실행한다 (엔진 수정 없음)', () => {
  const s = setup();
  // 엔진을 전혀 건드리지 않고 새 욕구 'meditate' 를 등록 — 매 틱 에너지를 방출하는 한 단계짜리 절차.
  //   이것이 "어떤 욕구든 어떤 절차든 추가 가능"의 증명이다: game.js 는 이 이름을 모른다.
  registerDesire('meditate', {
    label: '명상', release: '방출→심우주',
    steps: [{ name: 'emit', applicable: () => true, act: (ctx) => ctx.dissipate(20 * ctx.cre.size, 'meditate') }],
  });
  const cre = s.game.possessCreature(s.player.id, 1000, 1000, 500);
  const applied = s.game.setDesire(s.player.id, 'meditate'); // 인텐트도 레지스트리 기반이라 새 욕구를 받아들인다
  assert.equal(applied, 'meditate', '등록된 새 욕구는 인텐트로 부여된다');
  assert.equal(cre.desire, 'meditate');
  const sink0 = s.bal(POOL.SINK), cre0 = s.bal(cre.id);
  s.runTicks(3);
  assert.ok(s.txByCause('meditate').some(op => op.from === cre.id && op.to === POOL.SINK), '새 욕구의 방출(meditate) tx 가 실제로 일어난다');
  assert.ok(s.bal(POOL.SINK) > sink0, '새 욕구가 심우주로 방출했다 — 엔진 수정 없이 실행됨');
  assert.ok(s.bal(cre.id) < cre0, '생명체가 명상으로 에너지를 소모(방출)했다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '개방 확장에도 보존 불변');
});

test('야생 본능은 날것을 못 먹는다 — 요리(절차)가 없으면 날것은 그대로 남는다', () => {
  const s = setup();
  const cry = s.game.spawnRawFood(300, 1700, 500, 0, 2000);
  s.game.spawnCreature(300, 1700, 500); // 곁의 야생(desire=none) — 자율 채집 본능(그러나 날것은 못 먹는다)
  const cry0 = s.bal(cry.id);
  s.runTicks(20);
  assert.equal(s.bal(cry.id), cry0, '야생 본능(채집)은 날것을 못 먹는다 — 요리할 절차가 없다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('결정론 — 같은 배치/욕구/이벤트열이면 식사 절차가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.game.spawnRawFood(1250, 1250, 625, 0, 4000);
    const c = s.game.possessCreature(s.player.id, 700, 1250, 625); c.desire = DESIRE.EAT;
    s.runTicks(60);
    const cry = [...s.game.crystals.values()][0];
    return [c.x, c.y, c.z, s.bal(c.id), cry ? [s.bal(cry.id), cry.raw, cry.species] : null];
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 식사 궤적');
});

test('보존 폭풍 — 다수 개체가 요리·식사·사냥을 뒤섞어도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 6; i++) s.game.spawnRawFood(400 + i * 140, 700, 500, i % 12, 2000);
  for (let i = 0; i < 8; i++) {
    const c = s.game.possessCreature(s.player.id, 450 + i * 120, 750, 500);
    c.desire = i % 2 === 0 ? DESIRE.EAT : DESIRE.FORAGE;
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '요리·식사·채집·소산이 뒤섞여도 총합 불변');
});

test('레지스트리 — 기본 욕구 절차가 모두 등록돼 있다(대기·채집·식사·사냥)', () => {
  for (const name of [DESIRE.NONE, DESIRE.FORAGE, DESIRE.EAT, DESIRE.HUNT]) {
    assert.ok(DESIRE_PROCEDURES[name], `${name} 절차가 등록돼 있다`);
    assert.ok(Array.isArray(DESIRE_PROCEDURES[name].steps) && DESIRE_PROCEDURES[name].steps.length > 0, `${name} 은 단계가 있다`);
  }
});
