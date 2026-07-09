// ============================================================================
// feature-0012 step2 — 감정은 상황(차이)에서 자율 생성된다 + 포만하면 감쇠한다
//
// 직관: "차이는 신호다." step1 은 감정을 밖에서 실었다(emote). step2 는 **상황이 감정을 스스로 만든다**:
//   굶주릴수록(=용량과 잔고의 차이가 클수록) 식사의 중요도(feeling)가 치솟고, 배부르면 0 으로 감쇠한다(포만).
//   그래서 같은 중첩 스택이라도 **상황에 따라 우선순위가 스스로 재정렬**된다 — 평소엔 사냥이 우선이어도 굶주리면
//   식사가 이기고(행동이 뒤집힘), 배부르면 다시 사냥으로 넘어간다. 외부 주입 없이 차이가 행동을 정한다.
//   개방: 욕구 절차가 appraise(ctx) 로 자기 감정을 계산 → 어떤 욕구든 자율 감정을 얹을 수 있다(엔진 무수정).
// 강제: appraise 는 순수 계산(rng 미사용) → 결정론 불변. 모든 행동은 ledger.transfer → 보존.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { registerDesire } from '../shared/desires.js';
import { POOL, WORLD_SOURCE_INITIAL, DESIRE, CREATURE_MAX_ENERGY } from '../shared/constants.js';

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

function bigCreature(game, playerId, x, y, z, size = 2) {
  const cre = game.possessCreature(playerId, x, y, z);
  cre.size = size;
  const pool = game.ledger.get(cre.id);
  if (pool) pool.max = CREATURE_MAX_ENERGY * size;
  return cre;
}
function edibleCrystal(game, x, y, z, amount = 4000) { const c = game.spawnRawFood(x, y, z, 3, amount); c.raw = false; return c; }
function preyCreature(game, x, y, z, energy = 600) { const p = game.spawnCreature(x, y, z); game.ledger.transfer(POOL.SOURCE, p.id, energy, 'seed'); return p; }
// 잔고를 목표치로 맞춘다(보존 유지 — SOURCE 와 주고받는다).
function setBalance(game, id, target) {
  const cur = game.ledger.balance(id);
  if (target > cur) game.ledger.transfer(POOL.SOURCE, id, target - cur, 'seed');
  else if (target < cur) game.ledger.transfer(id, POOL.SOURCE, cur - target, 'drain');
}

test('감정의 자율 생성 — 굶주리면 식사의 중요도(feeling)가 외부 주입 없이 스스로 오른다', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 1); // 동률 base — 감정이 승부를 가른다
  setBalance(s.game, cre.id, 300); // 굶주림(용량 2000 의 절반 미만)
  s.runTicks(3);
  assert.ok(cre.desires.get(DESIRE.EAT).feeling > 0, '굶주림이 식사의 자율 감정을 스스로 만든다(emote 없이)');
  assert.equal(cre.desires.get(DESIRE.HUNT).feeling, 0, '사냥은 appraise 가 없어 자율 감정이 0');
  assert.equal(cre.desire, DESIRE.EAT, '자율 감정으로 식사가 사냥을 이긴다(동률 base 를 감정이 가른다)');
});

test('차이가 클수록 감정이 크다 — 더 굶주린 개체의 식사 feeling 이 더 높다(단조)', () => {
  const read = (targetBal) => {
    const s = setup();
    const cre = bigCreature(s.game, s.player.id, 300, 1700, 500); // 결정 없는 외딴 자리(먹지 않아 잔고 유지)
    s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
    setBalance(s.game, cre.id, targetBal);
    s.runTicks(2);
    return cre.desires.get(DESIRE.EAT).feeling;
  };
  const starving = read(300), comfortable = read(800);
  assert.ok(starving > comfortable, '더 굶주릴수록(차이 클수록) 감정이 크다');
});

test('포만 감쇠 — 같은 스택이라도 굶주리면 식사가, 배부르면 사냥이 이긴다(상황이 행동을 뒤집는다)', () => {
  // 평소엔 사냥이 우선(base 2 > 식사 1). 그러나 굶주리면 식사 감정이 치솟아 식사가 이긴다.
  const hungry = setup();
  const hc = bigCreature(hungry.game, hungry.player.id, 1000, 1000, 500);
  edibleCrystal(hungry.game, 1000, 1150, 500);
  preyCreature(hungry.game, 1000, 880, 500);
  hungry.game.injectDesire(hungry.player.id, DESIRE.EAT, 1);
  hungry.game.injectDesire(hungry.player.id, DESIRE.HUNT, 2);
  setBalance(hungry.game, hc.id, 300); // 굶주림
  hungry.runTicks(3);
  assert.equal(hc.desire, DESIRE.EAT, '굶주리면 식사가 사냥을 이긴다(감정이 우선순위를 뒤집음)');
  assert.ok(hungry.txByCause('harvest').some(op => op.to === hc.id), '굶주린 개체는 밥을 먹는다');

  // 같은 스택인데 배부르면 식사 감정이 0 으로 감쇠 → 사냥(base 2)이 이긴다.
  const full = setup();
  const fc = bigCreature(full.game, full.player.id, 1000, 1000, 500);
  edibleCrystal(full.game, 1000, 1150, 500);
  preyCreature(full.game, 1000, 880, 500);
  full.game.injectDesire(full.player.id, DESIRE.EAT, 1);
  full.game.injectDesire(full.player.id, DESIRE.HUNT, 2);
  setBalance(full.game, fc.id, 1900); // 포만
  full.runTicks(3);
  assert.equal(fc.desire, DESIRE.HUNT, '배부르면(포만 감쇠) 사냥이 이긴다 — 다음 욕구로 넘어간다');
  assert.ok(full.txByCause('burst').some(op => op.from === fc.id), '포만한 개체는 사냥한다(발산 burst)');
});

test('개방성 — 런타임에 appraise 를 얹은 새 욕구도 엔진이 자율 감정을 계산한다(엔진 무수정)', () => {
  const s = setup();
  registerDesire('panic', {
    label: '공황', release: '방출→심우주',
    steps: [{ name: 'idle', applicable: () => false, act: () => {} }], // 행동은 없이 감정만
    appraise: () => 45, // 상황과 무관한 상수 감정(엔진이 부르는지 확인용)
  });
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  s.game.injectDesire(s.player.id, 'panic', 1);
  s.runTicks(3);
  assert.equal(cre.desires.get('panic').feeling, 45, '엔진이 새 욕구의 appraise 를 불러 자율 감정을 채운다(game.js 무수정)');
});

test('결정론 — 같은 배치/잔고면 자율 감정·행동이 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
    edibleCrystal(s.game, 1000, 1200, 500);
    preyCreature(s.game, 1000, 850, 500);
    s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
    s.game.injectDesire(s.player.id, DESIRE.HUNT, 2);
    setBalance(s.game, cre.id, 350);
    s.runTicks(30);
    return [cre.x, cre.y, cre.z, s.bal(cre.id), cre.desire, cre.desires.get(DESIRE.EAT).feeling, s.total()];
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일(자율 감정 포함)');
});

test('보존 폭풍 — 굶주림·포만이 뒤섞여 우선순위가 계속 재정렬돼도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 5; i++) edibleCrystal(s.game, 500 + i * 120, 800, 500, 2000);
  for (let i = 0; i < 6; i++) {
    const c = bigCreature(s.game, s.player.id, 520 + i * 110, 850, 500, 2);
    preyCreature(s.game, 540 + i * 110, 850, 500, 400);
    s.game.injectDesire(s.player.id, DESIRE.EAT, 1);
    s.game.injectDesire(s.player.id, DESIRE.HUNT, 2);
    setBalance(s.game, c.id, i % 2 === 0 ? 300 : 1800); // 절반은 굶주림·절반은 포만
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '자율 감정으로 우선순위가 계속 바뀌어도 총합 불변');
});
