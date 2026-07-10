// ============================================================================
// feature-0009 — 발산: 생명체가 에너지를 발산해 파이어볼(투사체)을 쏜다 (생명의 행위)
//
// 직관(물리): 발산은 **생명의 행위**다 — 내부 에너지를 폭발적으로 밀어내 비생명 농축 에너지 덩어리
//   (파이어볼)를 만들어 표적 자리로 보낸다. 여기서 생명체의 관여는 끝난다. 그 덩어리가 *터지는* 것
//   (폭발)은 물질의 사건이라 별개다(feature-0013 규칙 D = detonate). 강탈(feature-0008)이 표적 에너지를
//   커플링해 일부 포획(수입)하는 것이라면, 발산은 순수 지출(먹지 않음·회수 없음)이다.
//     · 회수 없음 — 발산·폭발의 어떤 흐름도 캐스터로 돌아가지 않는다(강탈=내가 큼 / 발산=내가 줌).
//     · 조준 = 먹을 수 없는 상대(size ≥ 자신) — 강탈(먹이=size<)과 크기로 겹치지 않게 갈랐다(못 먹으니 폭탄).
//     · 원거리 — 근접 강탈보다 긴 사거리에서 표적을 겨눈다(투사체).
// 강제: 발산 전부 ledger.transfer(보존·정수). 생명체 → 파이어볼(B:) → (폭발) 세계. 총합 = 10⁹ 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, dist3,
  CREATURE_ATTACK_RADIUS, DISCHARGE_RADIUS,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops);
  const txOf = (cause) => ops().filter(o => o.cause === cause);
  // 생명체를 원하는 스탯·잔고로 세팅(백박스). owned=주인 부여(자율 발산/전투 안 함, 반격 없는 표적).
  const makeCreature = (x, y, z, size, fill, opts = {}) => {
    const c = game.spawnCreature(x, y, z);
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 2000 * size; }
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    if (opts.owned) c.owner = 'P:ghost';
    return c;
  };
  return {
    game, bal, total, runTicks, ops, makeCreature,
    emitTxs: () => txOf('emit'), burstTxs: () => txOf('burst'), detonateTxs: () => txOf('detonate'),
  };
}

test('발산 = 생명체가 파이어볼(투사체)을 만들어 쏜다 — 생명체 → 파이어볼(B:) 이체', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 4000);            // 캐스터(야생)
  const T = s.makeCreature(1000, 1200, 500, 2, 3000, { owned: true }); // 먹을 수 없는 표적(size≥, 반격 없음)
  s.runTicks(5); // 첫 발산은 tickCount==4

  const emit = s.emitTxs();
  assert.ok(emit.length > 0, '발산 tx 가 방송된다');
  assert.ok(emit.every(o => o.from === A.id && o.to.startsWith(POOL.FIREBALL)), '발산 = 생명체 → 파이어볼(B:) — 투사체에 에너지를 싣는다');
  assert.ok(s.burstTxs().some(o => o.from === A.id && o.to === POOL.SINK), '발사 비용은 심우주로 지불(만들어 쏘는 일 = 열 손실)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '발산에도 보존 불변');
});

test('회수 없음 — 발산·폭발의 어떤 흐름도 캐스터(생명체)로 돌아가지 않는다 (강탈과의 결정적 대비)', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 4000);
  const T = s.makeCreature(1000, 1200, 500, 2, 3000, { owned: true });
  s.runTicks(5);

  // 발산(emit)·폭발(detonate)·발사(burst) 어떤 tx 도 종착이 캐스터가 아니다 — 순수 지출(먹지 않음).
  const flows = [...s.emitTxs(), ...s.detonateTxs(), ...s.burstTxs()];
  assert.ok(flows.length > 0, '발산·폭발 흐름이 실제로 발생했다');
  assert.equal(flows.filter(o => o.to === A.id).length, 0, '캐스터로 돌아오는 흐름이 없다 — 발산은 순수 지출');
  // 발산은 파이어볼(B:)·심우주·국소장으로만 나간다(생명체로 회수 없음).
  assert.ok(s.emitTxs().every(o => o.to.startsWith(POOL.FIREBALL)), '발산 종착은 파이어볼뿐');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('조준 = 먹을 수 없는 상대(size ≥) — 더 작은 먹이(size<)에는 발산하지 않는다 (강탈과 분업)', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 4000);
  const prey = s.makeCreature(1000, 1150, 500, 1, 3000, { owned: true }); // 더 작음 = 먹이(강탈 몫)
  s.runTicks(5);
  assert.equal(s.emitTxs().length, 0, '더 작은 상대만 있으면 발산하지 않는다(먹이는 강탈 몫)');

  const s2 = setup();
  s2.makeCreature(1000, 1000, 500, 2, 4000);
  s2.makeCreature(1000, 1150, 500, 3, 3000, { owned: true }); // 더 큼 = 먹을 수 없음 → 발산 대상
  s2.runTicks(5);
  assert.ok(s2.emitTxs().length > 0, '먹을 수 없는 상대(size≥)에는 발산한다');
});

test('원거리 — 근접 강탈 사거리 밖의 표적에도 파이어볼을 쏜다 (투사체)', () => {
  const s = setup();
  const mid = Math.round((CREATURE_ATTACK_RADIUS + DISCHARGE_RADIUS) / 2); // 강탈 밖, 발산 안
  assert.ok(mid > CREATURE_ATTACK_RADIUS && mid < DISCHARGE_RADIUS);
  s.makeCreature(1000, 1000, 500, 2, 4000);
  const T = s.makeCreature(1000, 1000 + mid, 500, 2, 3000, { owned: true });
  s.runTicks(8); // 파이어볼이 원거리 표적까지 몇 틱 날아가 착탄·폭발(feature-0009 비행)
  assert.ok(s.emitTxs().length > 0, `강탈 사거리 밖(${mid}px)에도 발산했다`);
  assert.ok(s.detonateTxs().some(o => o.from === T.id), '날아간 파이어볼이 착탄해 원거리 표적을 폭발로 태웠다');

  // 발산 사거리 밖은 겨누지 못한다(대조)
  const s2 = setup();
  s2.makeCreature(1000, 1000, 500, 2, 4000);
  s2.makeCreature(1000, 1000 + DISCHARGE_RADIUS + 300, 500, 2, 3000, { owned: true });
  s2.runTicks(5);
  assert.equal(s2.emitTxs().length, 0, '발산 사거리 밖이면 쏘지 않음');
});

test('비행 — 파이어볼은 즉발이 아니라 캐스터 자리에서 표적으로 날아가 착탄 시 터진다 (눈에 보이는 투사체)', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 4000);
  const T = s.makeCreature(1000, 1450, 500, 2, 3000, { owned: true }); // 원거리(450px) — 여러 틱 비행
  // tick 하나씩: 파이어볼이 생겨 캐스터 자리에서 표적 쪽으로 나아가는 궤적을 관측한다.
  const trail = [];
  for (let i = 0; i < 8; i++) {
    s.game.tick();
    if (s.game.fireballs.length) { const fb = s.game.fireballs[0]; trail.push([fb.x, fb.y]); }
  }
  assert.ok(trail.length >= 2, '파이어볼이 여러 틱에 걸쳐 존재했다(즉발이 아니라 비행)');
  // 표적까지 남은 거리가 틱마다 줄어든다 = 표적 쪽으로 날아간다.
  const distTo = ([x, y]) => Math.hypot(1000 - x, 1450 - y);
  for (let i = 1; i < trail.length; i++) assert.ok(distTo(trail[i]) < distTo(trail[i - 1]), '틱마다 표적에 가까워진다(비행)');
  assert.ok(trail[0][1] < 1450 && trail[0][1] > 1000, '첫 위치는 캐스터(1000)와 표적(1450) 사이 — 캐스터 자리에서 출발했다');
  // 착탄 후: 파이어볼은 사라지고(터졌다), 표적이 폭발로 질서를 잃는다.
  assert.equal(s.game.fireballs.length, 0, '착탄 후 파이어볼은 사라진다(터졌다)');
  assert.ok(s.detonateTxs().some(o => o.from === T.id), '착탄점에서 터져 표적을 폭발로 태웠다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '비행·폭발에도 보존 불변(비행 중 payload 는 B: 풀에)');
});

test('약자가 강자를 겨눈다 — 발산은 먹을 수 없는 상대(size ≥)를 친다 (포식의 강자→약자 일방을 뚫는다)', () => {
  const s = setup();
  const small = s.makeCreature(1000, 1000, 500, 1, 2000);            // 약자 캐스터
  const big = s.makeCreature(1000, 1150, 500, 3, 3000, { owned: true }); // 강자 표적(사거리 안)
  s.runTicks(5);
  assert.ok(s.emitTxs().some(o => o.from === small.id), '약자가 파이어볼을 쐈다(발산)');
  assert.ok(s.detonateTxs().some(o => o.from === big.id), '강자가 폭발로 질서를 잃었다(약자의 반격)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('결정론 — 같은 배치/이벤트열이면 발산 결과가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.makeCreature(1000, 1000, 500, 2, 3000);
    s.makeCreature(1150, 1000, 500, 2, 2000);
    s.makeCreature(1000, 1150, 500, 2, 2000);
    s.runTicks(40);
    return [...s.game.creatures.values()].sort((a, b) => a.seq - b.seq).map(c => [c.seq, c.size, s.bal(c.id)]);
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 발산 궤적');
});

test('보존 폭풍 — 다수 난전(발산·폭발·완전 연소)에도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 12; i++) {
    const size = 1 + (i % 3);
    s.makeCreature(800 + (i % 4) * 110, 900 + Math.floor(i / 4) * 110, 500, size, 400 + size * 400);
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '발산·폭발·완전 연소가 뒤섞여도 총합 불변(파이어볼은 터지며 소멸)');
});
