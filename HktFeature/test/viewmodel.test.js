// ============================================================================
// ViewModel 회귀 — 세계 속성 → Scene(렌더 무관 데이터) 파이프라인이 실제로 도는지 눈 없이 확인한다.
//   불변 원칙 ③: 렌더러는 Scene 만 소비하고 세계 규칙을 재유도하지 않는다. 그 "세계 규칙 해석"
//   (정규화 활력·표적·acting)과 **이펙트 파생**(OPS tx → 타입 있는 서술자·pool→pos·lastPos 캐시)이
//   ViewModel 에서 정확히 나오는지가 이 테스트의 대상이다. 시각(픽셀)은 npm run shot 이 따로 검증.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ClientState } from '../client/state.js';
import { ViewModel } from '../client/viewmodel.js';
import { CREATURE_ATTACK_RADIUS } from '../shared/constants.js';

// 최소 세계를 손으로 세운다: 내 생명체(사냥, 소유) + 더 작은 먹이 + 결정 + 국소장 복셀 + 파이어볼.
function makeWorld() {
  const state = new ClientState();
  state.playerId = 'P:me';
  state.myName = '조종자';
  state.ledger.mirrorSet('P:me', 500, 1000, null);
  // 생명체 5 = 내 것(size2, 잔고 800, 사냥). 생명체 6 = 더 작은 먹이(size1).
  state.creatures.set(5, { seq: 5, x: 100, y: 100, z: 0, balance: 800, size: 2, desire: 'hunt', owner: 'P:me', desires: [['hunt', 1, 0]], cmd: null });
  state.creatures.set(6, { seq: 6, x: 150, y: 100, z: 0, balance: 200, size: 1, desire: 'none', owner: null, desires: [], cmd: null });
  state.crystals.set(12, { x: 300, y: 300, z: 0, balance: 500, species: 3, raw: false, crafted: false, tier: 0, burning: false, hot: 0 });
  state.field.set('1_1_1', 400);
  state.fireballs.set(3, { x: 120, y: 120, z: 10, balance: 400, size: 2 });
  state.fireballsAt = Date.now(); // 갓 받은 방송 — pruneFireballs 가 TTL 로 지우지 않게(실 클라와 동일)
  state.worldTotal = 1_000_000_000; state.worldSrc = 1; state.worldSink = 2;
  state.worldMaterial = 3; state.worldCrystal = 4; state.worldCreature = 5;
  state.checksumStatus = 'OK';
  const sim = { x: 100, y: 100, z: 0 };
  const net = { bytesPerSec: 0 };
  return { state, sim, net };
}

test('Scene 은 정규화된 세계 속성을 담는다 (활력·크기·faction)', () => {
  const { state, sim, net } = makeWorld();
  const scene = new ViewModel(state, sim, net).build(1);

  const mine = scene.creatures.find(c => c.id === 5);
  assert.ok(mine, '내 생명체가 Scene 에 있다');
  assert.equal(mine.faction, 'mine');
  assert.equal(mine.vitality, 0.4);          // 800 / (1000 * size2) = 0.4
  assert.equal(mine.size, 2);
  assert.equal(mine.starving, false);
  assert.equal(mine.energy, 800);

  const cry = scene.crystals.find(c => c.id === 12);
  assert.equal(cry.magnitude, 1);            // 500 / max(500) = 1
  assert.equal(cry.heat, 0);
  assert.equal(cry.species, 3);

  assert.equal(scene.field.length, 1);       // 복셀 하나(magnitude ≥ 0.05)
  assert.equal(scene.fireballs.length, 1);
  assert.equal(scene.self.hasCreature, true);
  assert.equal(scene.self.creature.id, 5);   // 내 생명체 뷰가 self 에 붙는다
  assert.equal(scene.world.total, 1_000_000_000);
});

test('ViewModel 이 표적·acting 을 미리 계산한다 (렌더러 재유도 금지)', () => {
  const { state, sim, net } = makeWorld();
  const scene = new ViewModel(state, sim, net).build(1);
  const mine = scene.creatures.find(c => c.id === 5);

  // 사냥 표적 = 감지 반경 안 더 작은 생명체(6). 렌더러가 아니라 ViewModel 이 유도한다.
  assert.ok(mine.target, '표적이 계산됐다');
  assert.deepEqual(mine.target.pos, { x: 150, y: 100, z: 0 });
  // 거리 50 ≤ 근접 사거리 → 행동 중(acting).
  assert.ok(50 <= CREATURE_ATTACK_RADIUS);
  assert.equal(mine.motive.acting, true);
  assert.equal(mine.motive.name, 'hunt');
});

test('이펙트 채널: OPS tx → 타입 있는 서술자 + pool→pos 해석', () => {
  const { state, sim, net } = makeWorld();
  const vm = new ViewModel(state, sim, net);

  // 발산(생명체 5 → 파이어볼 3) · 폭발(파이어볼 3 → 심우주). 권위 tx 스트림이 원천이다.
  state.effectTx.push({ from: 'C:5', to: 'B:3', amount: 300, cause: 'emit' });
  state.effectTx.push({ from: 'B:3', to: 'W:SINK', amount: 400, cause: 'detonate' });
  const scene = vm.build(1);

  const emit = scene.effects.find(e => e.cause === 'emit');
  const boom = scene.effects.find(e => e.cause === 'detonate');
  assert.ok(emit && boom, '발산·폭발 이펙트가 파생됐다');
  assert.equal(emit.type, 'emission');
  assert.equal(boom.type, 'explosion');
  // 발산 앵커 = 산물(파이어볼) 자리, 폭발 앵커 = 근원(파이어볼) 자리 → 둘 다 파이어볼 3 위치.
  assert.deepEqual(emit.pos, { x: 120, y: 120, z: 10 });
  assert.deepEqual(boom.pos, { x: 120, y: 120, z: 10 });
  assert.equal(boom.amount, 400);
  // 이펙트로 안 만드는 cause(spawn 등)는 서술자를 내지 않는다.
  state.effectTx.push({ from: 'W:SRC', to: 'P:me', amount: 10, cause: 'spawn' });
  assert.equal(vm.build(1).effects.length, 0);
});

test('lastPos 캐시: 스냅샷에서 빠진 개체의 이펙트도 마지막 위치로 해석된다', () => {
  const { state, sim, net } = makeWorld();
  const vm = new ViewModel(state, sim, net);

  // 1) 파이어볼 3 이 살아있는 프레임 — 위치가 캐시된다.
  vm.build(1);
  // 2) 착탄으로 파이어볼이 스냅샷에서 사라진 뒤 폭발 tx 가 온다 → 캐시된 마지막 위치로 해석.
  state.fireballs.delete(3);
  state.effectTx.push({ from: 'B:3', to: 'W:SINK', amount: 400, cause: 'detonate' });
  const scene = vm.build(2);
  const boom = scene.effects.find(e => e.cause === 'detonate');
  assert.ok(boom, '스냅샷에 없어도 이펙트가 나온다');
  assert.deepEqual(boom.pos, { x: 120, y: 120, z: 10 }); // 마지막 알려진 위치
});

test('tx 피드: 종류·방향을 데이터로 노출(라벨·색은 렌더러 몫)', () => {
  const { state, sim, net } = makeWorld();
  state.txFeed = [
    { from: 'C:5', to: 'W:SINK', amount: 10, cause: 'metabolize' },
    { from: 'W:SRC', to: 'P:me', amount: 20, cause: 'spawn' },
  ];
  const scene = new ViewModel(state, sim, net).build(1);
  assert.equal(scene.txFeed[0].from.kind, 'creature');
  assert.equal(scene.txFeed[0].to.kind, 'sink');
  assert.equal(scene.txFeed[0].dir, 'other');
  assert.equal(scene.txFeed[1].to.kind, 'self'); // 내게 들어오는 = '나'
  assert.equal(scene.txFeed[1].dir, 'in');
});
