// ============================================================================
// feature-0012 step3 — 다른 자율 감정원: 위협(더 큰 포식자) → 회피(FLEE)
//
// 직관: "차이는 신호"(step2)의 개방성을 재증명한다 — 굶주림 말고도 어떤 상황이든 감정을 스스로 만들 수 있다.
//   **위협**: 나보다 큰 포식자가 가까이 있을수록(=차이=근접이 클수록) 회피의 중요도(feeling)가 스스로 치솟아,
//   다른 어떤 욕구보다 도망이 이긴다. 위협이 멀어지면 0 으로 감쇠해 하던 일로 돌아간다. 외부 주입 없이 상황이
//   행동을 정한다. **개방 재증명**: 새 감정원(threatFeeling)·새 지각(nearestThreat)·새 행동(moveAway)을 ctx·레지스트리에
//   얹기만 하면 엔진 무수정으로 새 욕구(FLEE)가 돈다 — 엔진은 '위협'도 '회피'도 모른다.
// 강제: appraise·이동은 순수 계산/클램프(rng 미사용) → 결정론 불변. 이동 소산은 ledger.transfer → 보존.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { registerDesire } from '../shared/desires.js';
import { POOL, WORLD_SOURCE_INITIAL, DESIRE, CREATURE_MAX_ENERGY, CREATURE_SEEK_RADIUS, dist3 } from '../shared/constants.js';

function setup() {
  const game = new GameServer({ now: () => 1_000_000 });
  const msgs = [];
  const player = game.addPlayer({ send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } }, '조종자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const txByCause = (cause) => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops).filter(op => op.cause === cause);
  return { game, player, bal, total, runTicks, txByCause };
}
function controlled(game, playerId, x, y, size = 2) {
  const cre = game.possessCreature(playerId, x, y, 500); cre.size = size;
  const pool = game.ledger.get(cre.id); if (pool) pool.max = CREATURE_MAX_ENERGY * size;
  game.ledger.transfer(POOL.SOURCE, cre.id, CREATURE_MAX_ENERGY * size - game.ledger.balance(cre.id), 'seed'); // 넉넉히(굶주림 감정 0)
  return cre;
}
function predator(game, x, y, size = 3) { // 나보다 큰 포식자 = 위협
  const p = game.spawnCreature(x, y, 500); p.size = size;
  const pool = game.ledger.get(p.id); if (pool) pool.max = CREATURE_MAX_ENERGY * size;
  game.ledger.transfer(POOL.SOURCE, p.id, 2000, 'seed');
  return p;
}

test('위협 감정의 자율 생성 — 큰 포식자가 가까우면 회피 감정이 외부 주입 없이 스스로 오른다', () => {
  const s = setup();
  const cre = controlled(s.game, s.player.id, 1000, 1000);
  predator(s.game, 1000, 1120); // 가까운 위협(120px)
  s.game.injectDesire(s.player.id, DESIRE.FLEE, 1);
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 1); // 동률 base — 감정이 승부를 가른다
  s.runTicks(2);
  assert.ok(cre.desires.get(DESIRE.FLEE).feeling > 0, '위협이 회피의 자율 감정을 스스로 만든다(emote 없이)');
  assert.equal(cre.desire, DESIRE.FLEE, '위협 감정으로 회피가 이긴다(동률 base 를 감정이 가른다)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('회피 = 위협에서 멀어진다 — 도망치며 이동을 국소장으로 지불한다', () => {
  const s = setup();
  const cre = controlled(s.game, s.player.id, 1000, 1000);
  const pred = predator(s.game, 1000, 1150);
  const d0 = dist3(cre.x, cre.y, cre.z, pred.x, pred.y, pred.z);
  s.game.injectDesire(s.player.id, DESIRE.FLEE, 1);
  s.runTicks(4);
  const d1 = dist3(cre.x, cre.y, cre.z, pred.x, pred.y, pred.z);
  assert.ok(d1 > d0, `위협에서 멀어졌다 (${d0}→${d1})`);
  assert.ok(s.txByCause('move').some(op => op.from === cre.id), '회피 이동은 에너지를 국소장으로 소산한다(추적과 동일 회계)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('위협이 멀면 감쇠 — 포식자가 감지 반경 밖이면 회피는 수행되지 않고 하던 일로 돌아간다', () => {
  const s = setup();
  const cre = controlled(s.game, s.player.id, 1000, 1000);
  predator(s.game, 1000, 1000 + CREATURE_SEEK_RADIUS + 200); // 감지 반경 밖(위협 아님)
  const prey = s.game.spawnCreature(1000, 900, 500); s.game.ledger.transfer(POOL.SOURCE, prey.id, 600, 'seed'); // 곁의 먹이(size1)
  s.game.injectDesire(s.player.id, DESIRE.FLEE, 2); // 회피가 우선순위는 높지만…
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 1);
  s.runTicks(3);
  assert.equal(cre.desires.get(DESIRE.FLEE).feeling, 0, '위협이 멀면 회피 감정은 0(감쇠)');
  // 위협이 없으면 회피는 '수행 불가'(nearestThreat 없음)라 엔진이 다음 욕구(사냥)로 내려간다 → 먹이를 친다.
  assert.ok(s.txByCause('burst').some(op => op.from === cre.id), '위협 없으면 회피 대신 사냥이 수행된다(상황이 행동을 거둔다)');
});

test('가까울수록 위협 감정이 크다 — 포식자가 가까운 개체의 회피 feeling 이 더 높다(단조)', () => {
  const read = (predY) => {
    const s = setup();
    const cre = controlled(s.game, s.player.id, 1000, 1000);
    predator(s.game, 1000, predY);
    s.game.injectDesire(s.player.id, DESIRE.FLEE, 1);
    s.runTicks(2); // 욕구 절차는 tickCount>0 부터 — 첫 appraise 는 원위치에서(도망 전) 감정을 잰다
    return cre.desires.get(DESIRE.FLEE).feeling;
  };
  const near = read(1150), far = read(1700); // 가까운(150) vs 먼(700, 반경 안)
  assert.ok(near > far, `가까울수록 위협 감정이 크다 (${near} > ${far})`);
});

test('개방 재증명 — 새 감정원을 얹은 커스텀 욕구를 런타임 등록해도 엔진이 그대로 실행한다', () => {
  const s = setup();
  const cre = controlled(s.game, s.player.id, 1000, 1000);
  predator(s.game, 1000, 1120);
  let ran = false;
  // 엔진·게임 내부를 모르고 ctx 만 쓰는 커스텀 욕구 — 위협을 지각해 감정을 만들고 도망친다(FLEE 와 같은 개방 경계).
  registerDesire('panic', {
    label: '패닉', release: '이동→국소장',
    steps: [{ name: 'bolt', applicable: (x) => !!x.nearestThreat(), act: (x) => { ran = true; const t = x.nearestThreat(); if (t) x.moveAway(t); } }],
    appraise: (x) => (x.nearestThreat() ? 90 : 0),
  });
  s.game.injectDesire(s.player.id, 'panic', 1);
  s.runTicks(2);
  assert.ok(ran, '런타임 등록한 커스텀 욕구를 엔진이 무수정으로 실행했다(개방)');
  assert.equal(cre.desire, 'panic', '커스텀 감정원이 승자가 됐다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});
