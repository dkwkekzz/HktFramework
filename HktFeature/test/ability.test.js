// ============================================================================
// feature-0010 step1 — 발산의 두 위상: 흡수(수입)와 파괴(지출)를 종착으로 가른다
//
// 직관(물리): 파이어볼과 칼로 내려치기는 *같은 파괴 위상*(회수 0, 종착=세계)이다 — 무기가 아니라
//   에너지가 어디로 가느냐가 흐름을 정한다. 채집·강탈(포식)은 *같은 흡수 위상*(붕괴 에너지 일부가 나에게).
//   그래서 강탈(bite)과 참격(slash)은 같은 근접전이라도 종착이 갈린다:
//     · 강탈(흡수) — 표적→나 엣지가 존재한다(먹는다). 캐스터 순증 가능.
//     · 참격(파괴) — 표적→세계(심우주 열·국소장 연기)뿐, 나에게 오는 엣지가 하나도 없다. 캐스터 순손실만.
// 강제: 전부 ledger.transfer(보존·정수). rng 미사용(순수 클램프) → 확산·성장·전투 결정론 불변.
// 게임 내 검증: tx 피드에서 [참격] 은 생명체(캐스터)로 가는 엣지가 없고 [강탈] 은 있다 — 눈으로 갈린다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { POOL, WORLD_SOURCE_INITIAL, ABILITY } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const alive = (c) => game.creatures.has(c.id) && bal(c.id) > 0;
  const sumPrefix = (prefix) => { let s = 0; for (const [id, p] of game.ledger.pools) if (id.startsWith(prefix)) s += p.balance; return s; };
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops);
  const byCause = (cause) => ops().filter(o => o.cause === cause);
  const makeCreature = (x, y, z, size, fill, melee = 'bite') => {
    const c = game.spawnCreature(x, y, z, { melee });
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 1000 * size; }
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    return c;
  };
  return { game, bal, total, runTicks, alive, makeCreature, byCause, cryTotal: () => sumPrefix(POOL.CRYSTAL) };
}

test('참격은 파괴다 — 회수 없음: 표적 에너지가 캐스터로 흐르는 엣지가 하나도 없다 (칼도 파이어볼처럼 종착=세계)', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 2, 900, 'slash'); // 전사(참격=파괴 근접)
  const V = s.makeCreature(580, 500, 500, 1, 500, 'bite');  // 표적 — 사거리(200) 안
  s.runTicks(3); // 참격 판정은 tickCount 2 에서 첫 발화(interval 2)

  const strikes = s.byCause('strike');
  assert.ok(strikes.length > 0, '참격(파괴) tx 가 방송된다');
  // 참격 흐름의 종착은 심우주(SINK)·국소장(M:)뿐 — 생명체(C:)로 가는 strike tx 는 하나도 없다(강탈과의 대비).
  const toCreature = strikes.filter(o => o.to.startsWith(POOL.CREATURE));
  assert.equal(toCreature.length, 0, '참격은 회수가 없다 — 표적 에너지가 캐스터로 흐르지 않는다');
  assert.ok(strikes.every(o => o.to === POOL.SINK || o.to.startsWith(POOL.MATERIAL)), '종착은 심우주(열)·국소장(연기)뿐');
  // 강탈(attack) tx 는 전혀 없다 — 전사는 먹지 않는다.
  assert.equal(s.byCause('attack').length, 0, '참격 개체는 강탈(먹기) tx 를 내지 않는다');
  assert.ok(s.bal(V.id) < 500, '표적은 참격으로 에너지를 잃었다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '참격에도 보존 불변');
});

test('종착 대비 — 같은 근접전이라도 강탈(bite)은 표적→나 엣지가 있고 참격(slash)은 없다', () => {
  const mk = (melee) => {
    const s = setup();
    const A = s.makeCreature(500, 500, 500, 2, 900, melee); // 포식자 or 전사
    s.makeCreature(580, 500, 500, 1, 500, 'bite');          // 먹이/표적(더 작음 → bite·slash 둘 다 타격 가능)
    s.runTicks(3);
    // 표적(붕괴 에너지)이 캐스터(A)로 흘러드는 엣지가 있는가?
    const inbound = s.byCause(melee === 'bite' ? 'attack' : 'strike').filter(o => o.to === A.id);
    return inbound.length;
  };
  assert.ok(mk('bite') > 0, '강탈(흡수): 표적→나 엣지가 존재한다(먹는다)');
  assert.equal(mk('slash'), 0, '참격(파괴): 표적→나 엣지가 없다(부순다)');
});

test('참격은 크기를 안 가린다 — 사거리 안이면 더 큰 상대도 벤다 (target=any, 강탈=먹이 size< 와 다름)', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 1, 900, 'slash'); // 약한 전사(size1)
  const big = s.makeCreature(600, 500, 500, 2, 900, 'bite'); // 더 큰 상대(size2) — 사거리 100
  const b0 = s.bal(big.id);
  s.runTicks(3); // tickCount 2: 참격만(파이어볼 interval 4 는 아직) — 순수 관측
  assert.ok(s.byCause('discharge').length === 0, '이 시점엔 방출(파이어볼) 발화 없음 — 참격만 관측');
  assert.ok(s.byCause('strike').some(o => o.from === big.id), '전사가 자기보다 큰 상대를 참격했다(칼은 크기 무관)');
  assert.ok(s.bal(big.id) < b0, '더 큰 상대가 참격으로 질서를 잃었다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('참격 잔해 = 시체(결정) — 완전 연소(파이어볼)와 다르다: 베여 죽으면 결정을 남긴다', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 3, 3000, 'slash'); // 강한 전사(계속 벤다)
  const V = s.makeCreature(560, 500, 500, 1, 300, 'bite');   // 얕은 표적 — 곧 베여 죽는다
  const cry0 = s.cryTotal();
  for (let i = 0; i < 200 && s.alive(V); i++) s.game.tick();
  assert.ok(!s.alive(V), '표적은 참격으로 예비가 말라 죽었다');
  assert.ok(s.cryTotal() > cry0, '참격사한 표적은 결정(시체)을 남긴다 — 파이어볼 완전연소(잔해 0)와 다른 죽음');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '참격사·분해 전 과정에서 보존 불변');
});

test('서술자 정합 — bite=흡수, slash·fireball=파괴 (종착 축이 능력 표에 단일 출처로 있다)', () => {
  assert.equal(ABILITY.bite.family, 'absorb', 'bite(강탈)은 흡수');
  assert.equal(ABILITY.slash.family, 'destroy', 'slash(참격)은 파괴');
  assert.equal(ABILITY.fireball.family, 'destroy', 'fireball(방출)은 파괴');
  assert.ok(ABILITY.bite.capturePct > 0, '흡수만 capturePct>0 (표적→나)');
  assert.ok(ABILITY.slash.capturePct === undefined, '파괴는 capturePct 없음(회수 0)');
});

test('결정론 — 같은 배치/이벤트열이면 참격 결과가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.makeCreature(1000, 1000, 500, 2, 1500, 'slash');
    s.makeCreature(1120, 1000, 500, 1, 400, 'bite');
    s.makeCreature(1000, 1120, 500, 2, 800, 'bite');
    s.runTicks(40);
    return [...s.game.creatures.values()].sort((a, b) => a.seq - b.seq).map(c => [c.seq, c.size, s.bal(c.id), c.melee]);
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 참격 궤적');
});

test('보존 폭풍 — 강탈·참격·방출·완전연소·참격사가 뒤섞인 난전에도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 12; i++) {
    const size = 1 + (i % 3);
    const melee = i % 2 === 0 ? 'bite' : 'slash'; // 포식자·전사 섞어 두 위상을 동시에 돌린다
    s.makeCreature(800 + (i % 4) * 110, 900 + Math.floor(i / 4) * 110, 500, size, 200 + size * 300, melee);
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '두 위상이 뒤섞여도 총합 불변');
});
