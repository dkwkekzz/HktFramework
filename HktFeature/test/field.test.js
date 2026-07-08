// ============================================================================
// feature-0004 step2 — 국소장 확산이 그리드 스냅샷(FIELD)으로 방송되어 시각화된다
//
// 직관: 한 컬럼에 몰린 에너지가 시간이 지나며 이웃 컬럼으로 번지고, 끝내 온 지도로
//   퍼진다(평형). FIELD 방송이 이 전파를 뷰어에 실어 지면 히트맵으로 보이게 한다.
// 강제: FIELD 는 원장 tx 가 아니라 읽기 전용 스냅샷 — 국소장 잔고를 그대로 실어 나른다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { POOL } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  // 그리드 스냅샷만 뽑아 {key: balance} 로
  const fieldsAt = () => {
    const f = msgs.filter(m => m.t === MSG.FIELD);
    const last = f[f.length - 1];
    const map = new Map();
    if (last) for (const [cx, cy, b] of last.cells) map.set(`${cx}_${cy}`, b);
    return map;
  };
  return { game, msgs, fieldsAt };
}

test('FIELD 방송 — 국소장 잔고가 4x4 그리드 스냅샷으로 실린다', () => {
  const { game, fieldsAt } = setup();
  game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}1_1`, 2_000_000, 'seed');
  game.tick(); // tick 0 flush → FIELD 방송
  const f = fieldsAt();
  assert.equal(f.size, 16, '4x4 = 16 컬럼 전부 실린다');
  assert.ok(f.get('1_1') > 1_000_000, '주입한 컬럼이 뜨겁다');
  assert.equal(f.get('3_3'), 0, '반대편 구석은 아직 0');
});

test('전파 — 몰린 에너지가 이웃으로 번지고 끝내 온 지도로 퍼진다', () => {
  const { game, fieldsAt } = setup();
  game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}0_0`, 3_000_000, 'seed'); // 구석에 집중

  game.tick();
  const early = fieldsAt();
  assert.equal(early.get('3_3'), 0, '초기엔 먼 구석에 아직 도달 못함');

  for (let i = 0; i < 300; i++) game.tick(); // 확산 진행
  const late = fieldsAt();
  // 이웃(0_1, 1_0)은 물론 대각 먼 구석(3_3)까지 에너지가 전파됐다
  assert.ok(late.get('0_1') > 0, '이웃 컬럼으로 번졌다');
  assert.ok(late.get('1_0') > 0, '이웃 컬럼으로 번졌다');
  assert.ok(late.get('3_3') > 0, '먼 구석까지 전파됐다 (온 지도로 확산)');

  // 스프레드(최대-최소)가 급감 = 평형으로 수렴
  const vals = [...late.values()];
  const spread = Math.max(...vals) - Math.min(...vals);
  assert.ok(spread < 3_000_000 * 0.25, `균일(평형)로 수렴 (스프레드 ${spread})`);
});
