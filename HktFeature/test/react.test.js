// ============================================================================
// feature-0005 step3 — 반응(화학): 반경 안의 두 결정이 종에 따라 반응한다
//
// 직관: 결정은 가만히 정적이지만, 서로 가까이 있으면 반응한다 — 같은 종끼리는 융합(순수 응집),
//   다른 종끼리는 새 화합물 종으로 결합하며 반응열 일부를 국소장으로 방출(발열)한다. 쌓인 결정을
//   소비해 개수를 묶고 종 분포를 계속 뒤섞는다(창발). 현실 화학반응의 결.
// 강제: 반응도 전부 ledger.transfer(보존·정수). 결정론(rng 미사용) — 같은 종쌍이면 같은 산물.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import {
  POOL, WORLD_SOURCE_INITIAL, CRYSTAL_SPECIES_COUNT,
  CRYSTAL_REACT_RELEASE_DIVISOR, reactSpecies, materialKey,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const cryList = () => [...game.crystals.values()].filter(c => bal(c.id) > 0);
  const cryCount = () => cryList().length;
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  // 지정 좌표에서 죽는 플레이어 → 그 자리에 결정 하나를 남긴다(백박스 배치).
  const dieAt = (x, y, z) => {
    const p = game.addPlayer({ send() {} }, '희생자');
    const pl = game.players.get(p.id);
    pl.x = x; pl.y = y; pl.z = z;
    game.removePlayer(p.id);
    // 방금 만들어진(가장 큰 seq) 결정을 돌려준다
    let last = null;
    for (const c of game.crystals.values()) if (bal(c.id) > 0 && (!last || c.seq > last.seq)) last = c;
    return last;
  };
  return { game, bal, total, cryList, cryCount, runTicks, dieAt };
}

test('reactSpecies — 가환·결정론적 화합 규칙 (범위 안 정수)', () => {
  for (let a = 0; a < CRYSTAL_SPECIES_COUNT; a++)
    for (let b = 0; b < CRYSTAL_SPECIES_COUNT; b++) {
      const p = reactSpecies(a, b);
      assert.equal(p, reactSpecies(b, a), '순서 무관(가환)');
      assert.ok(Number.isInteger(p) && p >= 0 && p < CRYSTAL_SPECIES_COUNT, '종 범위 안');
    }
});

test('반응 — 반경 안 두 결정이 하나로 합쳐진다 (종 규칙 + 반응열 방출, 보존)', () => {
  const { bal, total, cryList, runTicks, dieAt } = setup();
  // 서로 다른 복셀(각 국소장 150<포화)이되 반경 안(100px)인 두 지점에서 죽어 결정 2개를 만든다
  const c1 = dieAt(450, 300, 500);
  const c2 = dieAt(550, 300, 500);
  assert.notEqual(c1.id, c2.id);
  const s1 = c1.species, s2 = c2.species;
  const e1 = bal(c1.id), e2 = bal(c2.id), sum = e1 + e2;
  const matBefore = bal(materialKey(c1.x, c1.y, c1.z));

  runTicks(6); // 반응 주기(5틱) 통과 → 1회 반응

  const survivors = cryList();
  assert.equal(survivors.length, 1, '두 결정이 하나로 합쳐졌다');
  const A = survivors[0];
  if (s1 === s2) {
    assert.equal(bal(A.id), sum, '같은 종 → 순수 융합(반응열 없음): 에너지 전부 합쳐짐');
    assert.equal(A.species, s1, '융합은 종을 바꾸지 않는다');
  } else {
    const release = Math.floor(sum / CRYSTAL_REACT_RELEASE_DIVISOR);
    assert.equal(A.species, reactSpecies(s1, s2), '다른 종 → 새 화합물 종');
    assert.equal(bal(A.id), sum - release, '반응열만큼 빠진 나머지가 결정에');
    assert.equal(bal(materialKey(A.x, A.y, A.z)), matBefore + release, '반응열은 국소장으로 방출(발열)');
  }
  assert.equal(total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('결정론 — 같은 시드/이벤트열이면 반응 결과가 비트 단위로 동일', () => {
  const run = () => {
    const s = setup();
    for (let i = 0; i < 12; i++) s.dieAt(1000 + (i % 4) * 60, 1000 + Math.floor(i / 4) * 60, 500);
    s.runTicks(60);
    return s.cryList().sort((a, b) => a.seq - b.seq).map(c => [c.species, s.bal(c.id)]);
  };
  assert.deepEqual(run(), run(), '동일 시드 → 비트 단위 동일 반응 산물');
});

test('창발 — 한 곳에 쌓인 결정들이 반응으로 개수가 묶이고 총합은 보존된다', () => {
  const { total, cryCount, runTicks, dieAt } = setup();
  for (let i = 0; i < 16; i++) dieAt(1000, 1000, 500); // 같은 자리 연쇄 사망 → 결정 16개
  const before = cryCount();
  assert.ok(before >= 2, '반응 전 여러 결정이 쌓였다');
  runTicks(120); // 반응이 반복되며 합쳐진다
  const after = cryCount();
  assert.ok(after < before, `반응이 결정을 소비해 개수가 줄었다 (${before} → ${after})`);
  assert.equal(total(), WORLD_SOURCE_INITIAL, '어떤 반응 연쇄에도 보존 불변');
});
