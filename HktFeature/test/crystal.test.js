// ============================================================================
// feature-0005 step1 — 결정화: 에너지는 응집되어 정적인 형태(결정)가 된다
//
// 직관: 국소장(흩어진 중등급)이 국소적으로 과포화되면 그 일부가 결정 I:<voxel> 로 동결한다.
//   결정은 확산·복사 순회 대상이 아니라 면역이다 — 가만두면 잔고가 불변이다(정적). 반면 같은 자리
//   국소장은 계속 심우주로 샌다. 석출은 자기 제한(장을 포화까지 끌어내리면 멈춘다 = 침전 평형).
// 강제: 석출도 ledger.transfer(보존·정수). 결정은 국소장에서 온 것 — 전 풀 합은 그대로 10⁹.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { POOL, WORLD_SOURCE_INITIAL, CRYSTAL_SATURATION } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const sumPrefix = (prefix) => {
    let s = 0;
    for (const [id, p] of game.ledger.pools) if (id.startsWith(prefix)) s += p.balance;
    return s;
  };
  const matTotal = () => sumPrefix(POOL.MATERIAL);
  const cryTotal = () => sumPrefix(POOL.CRYSTAL);
  // 한 복셀에 에너지를 즉시 주입(테스트 시딩) — 국소장에 몰아넣고 확산·석출을 관찰한다
  const seed = (voxel, amount) => game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}${voxel}`, amount, 'seed');
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const lastCrystalSnapshot = () => {
    const f = msgs.filter(m => m.t === MSG.CRYSTAL);
    const last = f[f.length - 1];
    const map = new Map();
    if (last) for (const [cx, cy, cz, b] of last.cells) map.set(`${cx}_${cy}_${cz}`, b);
    return map;
  };
  return { game, bal, total, matTotal, cryTotal, seed, runTicks, lastCrystalSnapshot };
}

test('창세 — 결정은 비어 시작한다 (석출 전)', () => {
  const { cryTotal, total } = setup();
  assert.equal(cryTotal(), 0, '창세에 결정은 없다');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('과포화 임계 — 포화 이하에서는 결정이 맺히지 않는다', () => {
  const { seed, runTicks, cryTotal, total } = setup();
  seed('0_0_0', Math.floor(CRYSTAL_SATURATION / 2)); // 포화의 절반만 주입 → 과포화 아님
  runTicks(500);                                     // 확산으로 오히려 더 옅어진다
  assert.equal(cryTotal(), 0, '포화 이하에서는 석출이 없다');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('핵생성 — 과포화면 결정이 석출되고, 과포화가 오래 지속될수록 결정이 많다', () => {
  const measure = (inject) => {
    const s = setup();
    s.seed('2_2_2', inject);
    s.runTicks(800);
    return s.cryTotal();
  };
  // 작게 주입하면 확산이 곧 포화 아래로 펼쳐 잠깐만 석출(과포화 일시) → 결정이 조금.
  // 크게 주입하면 오래 과포화가 유지돼 지속 석출 → 결정이 훨씬 많다(에너지 총량 = 과포화 지속의 척도).
  const small = measure(8_000);
  const big = measure(2_000_000);
  assert.ok(small > 0, `과포화면 결정이 맺힌다 (${small})`);
  assert.ok(big > small * 5, `과포화가 오래 지속될수록 결정이 훨씬 많다 (${small} → ${big})`);
});

test('정적성(면역) — 결정은 확산·복사 틱을 아무리 돌려도 불변, 같은 자리 국소장은 샌다', () => {
  const { seed, runTicks, bal, cryTotal, matTotal, total } = setup();
  // hotspot 을 만들되(과포화 → 석출) 전체 에너지는 평형이 포화 아래가 되게(8000/64≈125 < 200) —
  //   확산이 장을 포화 밑으로 펼치면 석출이 멈추고 결정만 남아 얼어붙는다.
  seed('1_1_1', 8_000);
  runTicks(500);                  // 확산이 장을 포화 아래로 펼쳐 석출이 멈출 때까지
  const cry0 = cryTotal();
  assert.ok(cry0 > 0, '과포화(hotspot)에서 결정이 석출됐다');
  const sink0 = bal(POOL.SINK);
  const mat0 = matTotal();

  runTicks(4000);                 // 남은 국소장은 계속 심우주로 복사돼 샌다
  assert.equal(cryTotal(), cry0, '결정은 확산·복사에 면역 — 잔고가 전혀 변하지 않는다(정적)');
  assert.ok(bal(POOL.SINK) > sink0, '같은 동안 국소장은 계속 심우주로 샜다');
  assert.ok(matTotal() < mat0, '국소장(흩어진 등급)은 줄어드는데 결정(동결 등급)만 서 있다');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '보존 불변 — 결정도 결국 태양에서 온 에너지다');
});

test('자기 제한 — 석출은 장을 포화까지 끌어내리면 멈춘다(침전 평형)', () => {
  const { seed, runTicks, game, bal } = setup();
  seed('3_3_3', 8_000);           // 평형(≈125)이 포화 아래가 되는 양 — 확산 뒤엔 과포화가 사라진다
  runTicks(1500);
  // 모든 국소장 복셀이 포화 임계 이하로 내려앉았다 → 더는 석출 방아쇠가 없다(자기 제한)
  for (const id of game.materialKeys) {
    assert.ok(bal(id) <= CRYSTAL_SATURATION, `${id} 국소장이 포화 이하로 안정 (${bal(id)})`);
  }
});

test('결정론 — 같은 시드/이벤트열이면 결정 분포가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.seed('1_1_1', 500_000);
    s.runTicks(400);
    return s.game.crystalCells.map(([, , , , cryId]) => s.bal(cryId));
  };
  assert.deepEqual(run(), run(), '동일 시드 → 비트 단위 동일 결정 분포');
});

test('CRYSTAL 방송 — 석출된 결정이 읽기 전용 스냅샷으로 실린다(뷰어가 마커로 그린다)', () => {
  const { seed, runTicks, lastCrystalSnapshot } = setup();
  seed('1_1_1', 500_000);
  runTicks(300);
  const snap = lastCrystalSnapshot();
  assert.ok(snap.size > 0, '결정 스냅샷에 최소 하나의 결정이 실린다');
  let maxBal = 0;
  for (const b of snap.values()) if (b > maxBal) maxBal = b;
  assert.ok(maxBal > 0, '실린 결정의 잔고가 0 보다 크다');
});
