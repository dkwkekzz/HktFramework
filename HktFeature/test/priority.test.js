// ============================================================================
// feature-0012 — 욕구는 중첩되고 우선순위가 다르다 (감정=중요도로 증폭)
//
// 직관: "차이는 신호이고, 욕구는 방향이며, 감정은 중요도다." 생명체는 차이를 인지해 욕구를 품고(방향,
//   feature-0010) 절차로 수행한다(feature-0011). 이 feature 는 욕구가 **하나가 아니라 여럿 중첩**됨을 세운다:
//   상황에 따라 지속적으로 욕구가 주입되고, 각 욕구는 **우선순위(중요도)**가 다르며, **감정이 그 우선순위를
//   증폭**한다. 엔진은 매 틱 **가장 높은 유효 우선순위의(지금 수행 가능한) 욕구**를 수행한다 → 우선순위가
//   행동을 정한다. 같은 욕구 재주입은 무의미(idempotent·dedup) — 중첩되지 않고 우선순위만 갱신된다.
// 강제: 모든 행동이 ledger.transfer(보존·정수). rng 미사용 → 결정론 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, DESIRE, CREATURE_MAX_ENERGY,
  DESIRE_BASE_PRIORITY, desireWeight, dist3,
} from '../shared/constants.js';

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
  return { game, player, msgs, bal, total, runTicks, txByCause };
}

// 큰 생명체(사냥 가능) 하나를 쥐어준다 — size 2, 넉넉한 예비.
function bigCreature(game, playerId, x, y, z, size = 2, energy = 1500) {
  const cre = game.possessCreature(playerId, x, y, z);
  cre.size = size;
  const pool = game.ledger.get(cre.id);
  if (pool) pool.max = CREATURE_MAX_ENERGY * size;
  game.ledger.transfer(POOL.SOURCE, cre.id, energy, 'seed');
  return cre;
}
// 먹을 수 있는 결정(밥) 하나 — 채집/식사의 표적.
function edibleCrystal(game, x, y, z, amount = 4000) {
  const c = game.spawnRawFood(x, y, z, 3, amount);
  c.raw = false; // 먹을 수 있게(요리 불필요)
  return c;
}
// 더 작은 먹이(size 1) 하나 — 사냥의 표적.
function preyCreature(game, x, y, z, energy = 600) {
  const p = game.spawnCreature(x, y, z);
  game.ledger.transfer(POOL.SOURCE, p.id, energy, 'seed');
  return p;
}

test('중첩 — 한 생명체가 여러 욕구를 동시에 품는다(스택)', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 1);
  assert.equal(cre.desires.size, 2, '두 욕구가 스택에 동시에 담긴다(중첩)');
  assert.ok(cre.desires.has(DESIRE.EAT) && cre.desires.has(DESIRE.HUNT), '식사·사냥이 함께 품긴다');
});

test('우선순위가 행동을 정한다 — 같은 상황에서 우선순위 높은 욕구의 절차가 수행된다', () => {
  // 사냥이 더 높으면 → 곁의 먹이를 친다(발산 burst). 식사가 더 높으면 → 곁의 밥을 먹는다(harvest).
  const hunt = setup();
  const hunter = bigCreature(hunt.game, hunt.player.id, 1000, 1000, 500);
  edibleCrystal(hunt.game, 1000, 1150, 500);   // 식사 사거리(300) 안
  preyCreature(hunt.game, 1000, 880, 500);     // 타격 사거리(200) 안, 더 작음
  hunt.game.injectDesire(hunt.player.id, DESIRE.EAT, 1);
  hunt.game.injectDesire(hunt.player.id, DESIRE.HUNT, 5); // 사냥 우선
  hunt.runTicks(5);
  assert.ok(hunt.txByCause('burst').some(op => op.from === hunter.id), '사냥이 우선이면 타격(발산 burst)이 일어난다');
  assert.equal(hunt.txByCause('harvest').filter(op => op.to === hunter.id).length, 0, '사냥이 우선이면 내 생명체는 밥을 먹지 않는다');

  const eat = setup();
  const eater = bigCreature(eat.game, eat.player.id, 1000, 1000, 500);
  const cry = edibleCrystal(eat.game, 1000, 1150, 500);
  preyCreature(eat.game, 1000, 880, 500);
  eat.game.injectDesire(eat.player.id, DESIRE.EAT, 5); // 식사 우선
  eat.game.injectDesire(eat.player.id, DESIRE.HUNT, 1);
  eat.runTicks(5);
  assert.ok(eat.txByCause('harvest').some(op => op.to === eater.id), '식사가 우선이면 밥을 먹는다(harvest)');
  assert.ok(eat.bal(cry.id) < 4000, '밥이 줄었다 — 식사가 수행됐다');
});

test('감정으로 증폭 — 낮은 우선순위 욕구도 감정을 실으면 이겨 행동이 바뀐다(감정=중요도)', () => {
  // 감정 없이: 식사(1) < 사냥(3) → 사냥한다(burst).
  const before = setup();
  const bhunter = bigCreature(before.game, before.player.id, 1000, 1000, 500);
  edibleCrystal(before.game, 1000, 1150, 500);
  preyCreature(before.game, 1000, 880, 500);
  before.game.injectDesire(before.player.id, DESIRE.EAT, 1);
  before.game.injectDesire(before.player.id, DESIRE.HUNT, 3);
  before.runTicks(5);
  assert.ok(before.txByCause('burst').some(op => op.from === bhunter.id), '감정 없으면 우선순위대로 사냥한다');
  assert.equal(before.txByCause('harvest').filter(op => op.to === bhunter.id).length, 0, '감정 없으면 내 생명체는 밥을 먹지 않는다');

  // 같은 배치에서 식사에 감정을 실으면: 식사(1+5=6) > 사냥(3) → 밥을 먹는다(harvest). 행동이 뒤집힌다.
  const after = setup();
  const eater = bigCreature(after.game, after.player.id, 1000, 1000, 500);
  edibleCrystal(after.game, 1000, 1150, 500);
  preyCreature(after.game, 1000, 880, 500);
  after.game.injectDesire(after.player.id, DESIRE.EAT, 1);
  after.game.injectDesire(after.player.id, DESIRE.HUNT, 3);
  after.game.emote(after.player.id, DESIRE.EAT, 5); // 감정 증폭 → 식사가 사냥을 이긴다
  assert.equal(eater.desire, DESIRE.EAT, '감정 증폭 후 승자(가장 중요한 욕구)는 식사다');
  after.runTicks(5);
  assert.ok(after.txByCause('harvest').some(op => op.to === eater.id), '감정 실린 식사가 이겨 밥을 먹는다 — 행동이 바뀐다');
});

test('주입은 idempotent(dedup) — 같은 욕구를 다시 주입해도 중첩되지 않고 우선순위만 갱신된다', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
  s.game.emote(s.player.id, DESIRE.EAT, 7);       // 감정을 실어둔다
  s.game.injectDesire(s.player.id, DESIRE.EAT, 9); // 같은 욕구 재주입 — 우선순위만 9 로
  assert.equal(cre.desires.size, 1, '같은 욕구는 중첩되지 않는다(하나로 유지)');
  assert.equal(cre.desires.get(DESIRE.EAT).priority, 9, '우선순위는 갱신된다');
  assert.equal(cre.desires.get(DESIRE.EAT).emotion, 7, '재주입해도 감정(중요도)은 보존된다');
});

test('상황 의존 — 최우선 욕구가 지금 수행 불가면 다음 우선순위 욕구가 수행된다', () => {
  // 사냥이 최우선(10)이지만 먹이가 없다 → 사냥은 수행 불가 → 식사(1)로 내려가 곁의 밥을 먹는다.
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  edibleCrystal(s.game, 1000, 1150, 500); // 밥만 있고 먹이(prey)는 없다
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 10);
  s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
  assert.equal(cre.desire, DESIRE.HUNT, '가장 중요한(원하는) 욕구는 사냥이다');
  s.runTicks(5);
  assert.ok(s.txByCause('harvest').some(op => op.to === cre.id), '사냥이 불가한 상황이라 다음 우선순위(식사)를 수행한다');
  assert.equal(s.txByCause('burst').length, 0, '먹이가 없어 사냥(발산)은 일어나지 않는다');
});

test('욕구 거둠 — 스택에서 빼면 그다음 우선순위가 행동을 잇는다', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 5);
  s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
  assert.equal(cre.desire, DESIRE.HUNT, '처음엔 사냥이 승자');
  s.game.withdrawDesire(s.player.id, DESIRE.HUNT);
  assert.equal(cre.desires.size, 1, '사냥이 스택에서 빠진다');
  assert.equal(cre.desire, DESIRE.EAT, '그다음 우선순위(식사)가 승자가 된다');
});

test('방송 — CREATURE 스냅샷이 승자 욕망 + 중첩 스택(우선순위·감정)을 싣는다', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 3);
  s.game.emote(s.player.id, DESIRE.EAT, 5); // 식사 유효 우선순위 6 > 사냥 3
  s.runTicks(6); // FIELD_INTERVAL 마다 CREATURE 방송
  const last = s.msgs.filter(m => m.t === MSG.CREATURE).at(-1);
  assert.ok(last, 'CREATURE 스냅샷이 방송된다');
  const cell = last.cells.find(c => c[0] === cre.seq);
  assert.ok(cell, '내 생명체가 스냅샷에 있다');
  const [, , , , , , desire, owner, desires] = cell;
  assert.equal(desire, DESIRE.EAT, '승자 욕망(감정 실린 식사)이 실린다');
  assert.equal(owner, s.player.id, '제어자가 실린다');
  assert.equal(desires.length, 2, '중첩 스택 두 욕구가 실린다');
  assert.deepEqual(desires[0].slice(0, 3), [DESIRE.EAT, 1, 5], '스택은 유효 우선순위 내림차순 — 감정 실린 식사가 맨 위');
  assert.equal(desires[0][3], 0, '편안(잘 먹은)하면 자율 감정(feeling)은 0');
  assert.equal(desireWeight(desires[0][1], desires[0][2], desires[0][3]), 6, '식사 유효 우선순위 = 1+5+0');
});

test('결정론 — 같은 배치/주입열이면 우선순위 수행이 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
    edibleCrystal(s.game, 1000, 1200, 500);
    preyCreature(s.game, 1000, 850, 500);
    s.game.injectDesire(s.player.id, DESIRE.EAT, 2);
    s.game.injectDesire(s.player.id, DESIRE.HUNT, 2);
    s.game.emote(s.player.id, DESIRE.EAT, 3);
    s.runTicks(40);
    return [cre.x, cre.y, cre.z, s.bal(cre.id), s.total()];
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 궤적');
});

test('보존 폭풍 — 다수 개체가 중첩 욕구·감정을 뒤섞어도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 5; i++) edibleCrystal(s.game, 500 + i * 120, 800, 500, 2000);
  for (let i = 0; i < 6; i++) {
    const c = bigCreature(s.game, s.player.id, 520 + i * 110, 850, 500, (i % 2) + 1, 900);
    preyCreature(s.game, 540 + i * 110, 850, 500, 400);
    s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
    s.game.injectDesire(s.player.id, DESIRE.HUNT, 1);
    if (i % 2 === 0) s.game.emote(s.player.id, DESIRE.HUNT, 4); else s.game.emote(s.player.id, DESIRE.EAT, 4);
    void c;
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '중첩·감정·우선순위가 뒤섞여도 총합 불변');
});

test('레지스트리·기본값 — 미등록 욕구 주입은 무시되고, 감정은 [0,MAX] 로 클램프된다', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  s.game.injectDesire(s.player.id, '없는욕구', 5);
  assert.equal(cre.desires.size, 0, '미등록 욕구는 스택에 얹히지 않는다(개방 레지스트리 기반)');
  s.game.injectDesire(s.player.id, DESIRE.EAT, DESIRE_BASE_PRIORITY);
  s.game.emote(s.player.id, DESIRE.EAT, 999); // 상한 초과 → 클램프
  assert.ok(desireWeight(1, cre.desires.get(DESIRE.EAT).emotion) <= 1 + 100, '감정은 상한으로 클램프된다(과증폭 방지)');
});
