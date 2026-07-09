// ============================================================================
// feature-0007 step1 — 채집·섭취: 생명체가 근접 결정(아이템=에너지의 결정체)을 흡수한다
//
// 직관: 결정은 원래 정적·면역(feature-0005) — 가만두면 잔고가 불변이다. 그러나 생명이 가까이 오면
//   그 정적 질서가 풀린다: 결정 → 생명체로 농축 에너지가 흘러든다(채집). 확산장 갈구가 옅은 에너지를
//   조금씩 긁는 것이라면, 채집은 뭉친 에너지를 크게 들이켜는 것(증폭). 다 먹힌 결정은 소멸한다.
//   생태 루프: 죽음 → 결정(feature-0005/0006) → 다른 생명체가 채집. 한 생명의 죽음이 다른 생명을 먹인다.
// 강제: 채집도 ledger.transfer(보존·정수). 결정도 결국 태양에서 온 에너지 → 전 풀 합 = 10⁹.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, CREATURE_FORAGE_RATE, CREATURE_HARVEST_RADIUS, dist3,
  CREATURE_HARVEST_YIELD, crystalYield,
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
  const alive = (c) => game.creatures.has(c.id) && bal(c.id) > 0;
  // 결정 하나를 그 자리에 떨군다 — 플레이어 죽음의 분해(단단한 잔해가 결정으로, feature-0005/0006)를 이용.
  const dropCrystal = (x, y, z) => {
    const pv = game.addPlayer({ send() {} }, 'v');
    const pl = game.players.get(pv.id); pl.x = x; pl.y = y; pl.z = z;
    game.removePlayer(pv.id);
    let found = null;
    for (const c of game.crystals.values()) if (c.x === x && c.y === y && c.z === z && bal(c.id) > 0) found = c;
    return found;
  };
  const harvestTxs = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops).filter(op => op.cause === 'harvest');
  return { game, bal, total, runTicks, alive, dropCrystal, harvestTxs };
}

test('채집 — 근접 결정을 흡수한다 (결정↓·생명체↑, 확산 갈구보다 크게 = 증폭)', () => {
  const s = setup();
  const c = s.dropCrystal(500, 500, 500);
  assert.ok(c && s.bal(c.id) > 0, '죽음이 그 자리에 결정 하나를 남겼다');
  const cre = s.game.spawnCreature(500, 500, 500); // 결정 바로 곁(반경 안)
  const cry0 = s.bal(c.id), cre0 = s.bal(cre.id);
  s.runTicks(2); // 첫 tick(0)은 무동작 → 두 번째 tick에서 채집 1회
  assert.ok(s.bal(c.id) < cry0, `결정이 채집으로 줄었다 (${cry0} → ${s.bal(c.id)})`);
  const gained = s.bal(cre.id) - cre0;
  assert.ok(gained > CREATURE_FORAGE_RATE, `채집으로 확산 갈구(${CREATURE_FORAGE_RATE})보다 크게 흡수했다 (+${gained} = 증폭)`);
  assert.ok(s.harvestTxs().length > 0, 'harvest tx 가 방송된다(근처 시야에 채집이 보인다)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '채집에도 보존 불변');
});

test('소멸 — 다 먹힌 결정은 사라진다 (정적 질서가 풀려 소진)', () => {
  const s = setup();
  const c = s.dropCrystal(500, 500, 500);
  const id = c.id;
  assert.ok(s.game.crystals.has(id), '채집 전 결정이 존재한다');
  s.game.spawnCreature(500, 500, 500);
  s.runTicks(12); // 결정(≈150)을 여러 틱에 걸쳐 다 흡수
  assert.ok(!s.game.crystals.has(id), '다 먹힌 결정은 레지스트리에서 소멸한다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('정적 대비 — 결정은 곁에 생명이 없으면 불변이지만, 생명이 오면 먹힌다', () => {
  const s = setup();
  const c = s.dropCrystal(500, 500, 500);
  const cry0 = s.bal(c.id);
  s.runTicks(50); // 곁에 생명체 없음 → 확산·복사에 면역(feature-0005), 잔고 불변
  assert.equal(s.bal(c.id), cry0, '생명이 없으면 결정은 정적 — 잔고가 그대로다');
  s.game.spawnCreature(500, 500, 500); // 이제 생명이 온다
  s.runTicks(3);
  assert.ok(s.bal(c.id) < cry0, '생명이 오자 정적 질서가 풀려 먹히기 시작한다');
});

test('생태 루프 — 굶어 죽은 생명체의 결정을 다른 생명체가 먹는다', () => {
  const s = setup();
  const a = s.game.spawnCreature(300, 1700, 500); // 외딴 자리, 빈 국소장 → 굶어 죽는다
  for (let i = 0; i < 300 && s.alive(a); i++) s.game.tick();
  assert.ok(!s.alive(a), 'A 는 굶어 죽었다');
  const c = [...s.game.crystals.values()].find(x => dist3(300, 1700, 500, x.x, x.y, x.z) <= CREATURE_HARVEST_RADIUS && s.bal(x.id) > 0);
  assert.ok(c, 'A 의 죽음이 그 자리에 결정(잔해)을 남겼다');
  const cry0 = s.bal(c.id);
  const b = s.game.spawnCreature(300, 1700, 500); // B 가 그 자리에 온다
  const b0 = s.bal(b.id);
  s.runTicks(3);
  assert.ok(s.bal(c.id) < cry0, 'B 가 A 의 잔해(결정)를 먹어 결정이 줄었다 — 한 죽음이 다른 생명을 먹인다');
  assert.ok(s.bal(b.id) > b0, 'B 는 그만큼 에너지를 얻었다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '생태 루프 전 과정에서 보존 불변');
});

// ---- feature-0007 step2: 종별 효과 (아이템이 나의 에너지에 영향을 준다) ----

test('종별 효과 — 흡수 배율이 높은 종의 결정을 더 크게 들이켠다 (같은 잔고라도 아이템 종이 내 에너지에 영향)', () => {
  // 종에서 배율이 갈리는 두 종을 고른다(고효율 vs 저효율). 배열 유도라 결정론적.
  const hiSpecies = CREATURE_HARVEST_YIELD.indexOf(Math.max(...CREATURE_HARVEST_YIELD));
  const loSpecies = CREATURE_HARVEST_YIELD.indexOf(Math.min(...CREATURE_HARVEST_YIELD));
  assert.ok(crystalYield(hiSpecies) > crystalYield(loSpecies), '고효율 종 배율 > 저효율 종 배율');

  const s = setup();
  // 서로 멀리 떨어진(반경 밖) 두 자리에 같은 에너지의 결정을 떨구고 종만 다르게 세팅한다.
  const cHi = s.dropCrystal(300, 300, 500); cHi.species = hiSpecies;
  const cLo = s.dropCrystal(1700, 1700, 500); cLo.species = loSpecies;
  assert.equal(s.bal(cHi.id), s.bal(cLo.id), '두 결정은 같은 잔고에서 출발한다(종만 다르다)');
  const start = s.bal(cHi.id);

  const creHi = s.game.spawnCreature(300, 300, 500); // 고효율 결정 곁
  const creLo = s.game.spawnCreature(1700, 1700, 500); // 저효율 결정 곁
  const hi0 = s.bal(creHi.id), lo0 = s.bal(creLo.id);
  s.runTicks(2); // 첫 tick(0) 무동작 → 한 번의 채집 틱. 고효율은 더 크게 흡수(둘 다 아직 소진 전).

  const gotHi = s.bal(creHi.id) - hi0, gotLo = s.bal(creLo.id) - lo0;
  assert.ok(gotHi > gotLo, `고효율 종 결정을 먹은 생명체가 더 많이 얻는다 (+${gotHi} > +${gotLo}) — 아이템이 내 에너지에 영향`);
  assert.ok(s.bal(cHi.id) < s.bal(cLo.id), `고효율 결정이 더 많이 줄어든다 (${s.bal(cHi.id)} < ${s.bal(cLo.id)}, 시작 ${start})`);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '종별 효과에도 보존 불변(흡수 배율은 흐름 속도일 뿐, 에너지 창발 없음)');
});

test('종별 효과 — 배율은 결정론적으로 종에서 유도된다(범위·안정)', () => {
  for (let sp = -3; sp < 30; sp++) {
    const y = crystalYield(sp);
    assert.ok(Number.isInteger(y) && y >= 1, `종 ${sp} 의 배율은 1 이상 정수 (${y})`);
    assert.equal(crystalYield(sp), crystalYield(sp), '같은 종이면 같은 배율(결정론)');
  }
});

test('결정론 — 같은 배치/이벤트열이면 채집 결과가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.dropCrystal(500, 500, 500);
    s.dropCrystal(560, 480, 520);
    const c1 = s.game.spawnCreature(500, 500, 500);
    const c2 = s.game.spawnCreature(540, 520, 500);
    s.runTicks(30);
    return [
      [...s.game.crystals.values()].map(c => s.bal(c.id)),
      [c1, c2].map(c => (s.game.creatures.has(c.id) ? s.bal(c.id) : -1)),
    ];
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 결정·생명체 잔고');
});
