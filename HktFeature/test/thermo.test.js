// ============================================================================
// feature-0004 — 엔트로픽 (에너지는 높은 확률로 흩어질 뿐, 세계는 평형으로 향한다)
//
// 직관: 에너지는 세 등급으로 흐른다 — 태양(고)→국소장(중, 흩어짐)→심우주(저, 손실).
//   죽음/이동은 에너지를 "그 자리" 국소장으로 흩고, 국소장은 이웃으로 높은 확률로 확산해
//   균일(평형=최대 엔트로피)로 수렴한다. 일부는 심우주로 복사돼 영영 사라진다(SINK 단조 증가).
// 강제: 모든 흐름은 ledger.transfer(보존·정수). 태양 순환(SINK→SOURCE 텔레포트)은 삭제됐다 —
//   소산은 태양으로 되돌아가지 않는다. 어느 순간에도 자유+태양+국소장+심우주 = 창세 총량.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { mulberry32, randInt } from '../shared/rng.js';
import {
  POOL, WORLD_SOURCE_INITIAL, SPAWN_POS, SPAWN_GRANT,
  WORLD_SIZE, WORLD_HEIGHT, entropicOutProb,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const join = (name) => game.addPlayer({ send() {} }, name);
  const warp = (p, x, y, z = SPAWN_POS.z) => { clock.t += 60_000; game.onMessage(p.id, { t: MSG.BEACON, x, y, z }); };
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const matTotal = () => {
    let s = 0;
    for (const [id, p] of game.ledger.pools) if (id.startsWith(POOL.MATERIAL)) s += p.balance;
    return s;
  };
  const matSpread = () => { // 국소장 최대-최소 (0=완전 균일=평형)
    let lo = Infinity, hi = -Infinity;
    for (const id of game.materialKeys) { const b = bal(id); if (b < lo) lo = b; if (b > hi) hi = b; }
    return hi - lo;
  };
  return { game, join, warp, bal, total, matTotal, matSpread };
}

test('창세 — 태양이 전 에너지를 쥐고 국소장·심우주는 비어 시작', () => {
  const { bal, total, matTotal } = setup();
  assert.equal(bal(POOL.SOURCE), WORLD_SOURCE_INITIAL, '태양이 전 에너지를 쥔다');
  assert.equal(bal(POOL.SINK), 0, '심우주는 비어 시작');
  assert.equal(matTotal(), 0, '국소장도 비어 시작');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('죽음·이동은 국소장으로 흩어진다 — 태양으로 되돌아가지 않는다', () => {
  const { game, join, warp, bal, total, matTotal } = setup();
  const a = join('A'); // 태양: 1e9-300, A: 300
  warp(a, SPAWN_POS.x + 500, SPAWN_POS.y); // 500px 이동 → 소산 floor(500/50)=10 이 국소장으로
  assert.equal(matTotal(), 10, '이동 소산은 국소장으로');
  const srcBefore = bal(POOL.SOURCE);

  game.removePlayer(a.id); // 이탈 = 응집 소멸 → 잔여(290)가 국소장으로 (태양행 아님)
  assert.equal(bal(POOL.SOURCE), srcBefore, '죽음 에너지는 태양으로 가지 않는다');
  assert.equal(matTotal(), SPAWN_GRANT, '스폰분 전부가 국소장으로 흩어졌다(10 이동 + 290 죽음)');
  assert.equal(bal(POOL.SINK), 0, '아직 복사(심우주)는 없다');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('엔트로픽 법칙 — 몰린 국소장이 높은 확률로 이웃으로 흩어져 평형(균일)으로 수렴', () => {
  // 법칙 자체: 고농도에서 나갈 확률이 높고, 농도가 같으면 1/2 (순 흐름 0 = 평형)
  assert.ok(entropicOutProb(100, 0) > 0.99, '고농도→저농도 확률 압도적');
  assert.equal(entropicOutProb(0, 100), 0, '저농도에서 나갈 확률 0');
  assert.equal(entropicOutProb(50, 50), 0.5, '평형에서 1/2 → 순 흐름 0');

  // 통합: 한 국소장에 전부 몰아넣고 확산을 돌리면 스프레드(최대-최소)가 급감한다
  const { game, matSpread } = setup();
  game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}0_0`, 4_000_000, 'seed'); // 한 구석에 집중
  const spread0 = matSpread();
  for (let i = 0; i < 400; i++) game.tick();
  const spread1 = matSpread();
  assert.ok(spread1 < spread0 * 0.2, `확산이 균일로 수렴 (${spread0} → ${spread1})`);
});

test('결정론 — 같은 시드/이벤트열이면 확산 결과가 완전히 동일하다', () => {
  const run = () => {
    const s = setup();
    s.game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}1_1`, 3_000_000, 'seed');
    for (let i = 0; i < 200; i++) s.game.tick();
    return s.game.materialKeys.map(id => s.bal(id));
  };
  assert.deepEqual(run(), run(), '동일 시드 → 비트 단위 동일 국소장 분포');
});

test('엔트로피의 화살 — 심우주(SINK)는 단조 증가한다 (복사는 되돌아오지 않는다)', () => {
  const { game, join, warp, bal, total } = setup();
  const players = [];
  for (let i = 0; i < 6; i++) players.push(join(`P${i}`));
  const rng = mulberry32(2026);

  let prevSink = bal(POOL.SINK);
  for (let cycle = 0; cycle < 8; cycle++) {
    for (let m = 0; m < 40; m++) {
      const p = players[randInt(rng, 0, players.length - 1)];
      warp(p, randInt(rng, 0, WORLD_SIZE), randInt(rng, 0, WORLD_SIZE), randInt(rng, 0, WORLD_HEIGHT));
    }
    for (let i = 0; i < 20; i++) game.tick();
    const sink = bal(POOL.SINK);
    assert.ok(sink >= prevSink, `cycle ${cycle} 심우주는 줄지 않는다 (${prevSink} → ${sink})`);
    prevSink = sink;
    assert.equal(total(), WORLD_SOURCE_INITIAL, `cycle ${cycle} 보존 불변`);
  }
  assert.ok(prevSink > 0, '복사로 실제 에너지가 심우주로 새어나갔다');

  // 어느 순간에도 에너지는 네 곳에만: 자유 + 태양 + 국소장 + 심우주 = 창세 총량
  let free = 0, mat = 0;
  for (const p of players) free += bal(p.id);
  for (const [id, pool] of game.ledger.pools) if (id.startsWith(POOL.MATERIAL)) mat += pool.balance;
  assert.equal(free + bal(POOL.SOURCE) + mat + bal(POOL.SINK), WORLD_SOURCE_INITIAL);
});
