// ============================================================================
// feature-0013 규칙 D — 과충전 결정 자폭: 폭발은 물질의 사건이다(생명 무관)
//
// 직관(물리): 폭발의 주인은 물질이지 생명이 아니다 — 파이어볼(생명체가 쏜 폭탄)만 터지는 게 아니라,
//   아무도 안 건드려도 **물질이 임계 에너지 밀도를 넘으면 불안정해져 스스로 터진다**(과충전 결정·폭탄).
//   이것이 "발산(생명)≠폭발(물질)" 분리의 진짜 증명이다: 같은 폭발 규칙(#detonate)이 생명 없이도 돈다.
//     · 자폭 — 잔고(에너지 밀도)가 임계를 넘은 자연 결정은 캐스터 없이 터진다(결정→세계, 회수 없음).
//     · blind AoE — 폭탄은 크기를 안 가린다(반경 내 모든 생명을 친다, 발산의 size≥ 분업과 다르다).
//     · 다채널 — 자폭도 열복사(이웃 연소/용해)+압력(이웃 파괴)로 갈린다(같은 규칙 D 재사용).
//     · 안정 물질 면역 — 재료(raw)·산물(crafted)은 임계를 넘어도 안 터진다(반응 면역과 같은 정합).
// 강제: 자폭 전부 ledger.transfer(보존·정수). 총합 = 10⁹ 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL,
  CRYSTAL_DETONATE_THRESHOLD, DISCHARGE_BLAST_RADIUS,
} from '../shared/constants.js';

function setup() {
  const game = new GameServer({ now: () => 1_000_000 });
  const msgs = [];
  game.addPlayer({ send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } }, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops);
  const txOf = (cause) => ops().filter(o => o.cause === cause);
  // 과충전 자연 결정 하나 — spawnRawFood 로 만들고 raw=false(자연) 로 바꾼 뒤 임계 이상으로 채운다.
  const overcharged = (x, y, species, amount) => {
    const c = game.spawnRawFood(x, y, 500, species, amount);
    c.raw = false; // 자연 결정(석출·죽음 결정과 동일) — 자폭 대상
    return c;
  };
  const makeCreature = (x, y, size, fill) => {
    const c = game.spawnCreature(x, y, 500);
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 4000 * size; }
    const cur = bal(c.id); if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    c.owner = 'P:ghost'; // 자율 행동 끔(발산·전투 안 함) — 자폭 효과만 관측
    return c;
  };
  return { game, bal, total, runTicks, ops, txOf, overcharged, makeCreature };
}

test('자폭 = 생명 없이 터진다 — 임계 넘은 자연 결정은 캐스터 없이 스스로 폭발한다(폭발의 주인은 물질)', () => {
  const s = setup();
  const cry = s.overcharged(1000, 1000, 0, CRYSTAL_DETONATE_THRESHOLD + 3000); // 임계 초과
  assert.ok(s.game.crystals.has(cry.id), '처음엔 존재');
  s.runTicks(2); // 자폭 판정은 tickCount>0(두 번째 tick 호출)

  assert.ok(!s.game.crystals.has(cry.id), '과충전 결정이 스스로 터져 사라졌다(생명 아무도 안 건드림)');
  const dt = s.txOf('detonate').filter(o => o.from === cry.id);
  assert.ok(dt.length > 0, '자폭 tx — 결정의 에너지가 폭발로 방출됐다');
  assert.ok(dt.every(o => o.to === POOL.SINK || o.to.startsWith(POOL.MATERIAL)), '종착은 심우주(열)·국소장(연기)뿐 — 회수 없음(생명체 없음)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '자폭에도 보존 불변(에너지는 세계로 흩어졌을 뿐)');
});

test('blind AoE — 과충전 결정 폭탄은 크기를 안 가리고 반경 내 모든 생명을 친다 (발산의 size≥ 분업과 다르다)', () => {
  const s = setup();
  s.overcharged(1000, 1000, 0, CRYSTAL_DETONATE_THRESHOLD + 5000);
  const small = s.makeCreature(1000 + Math.round(DISCHARGE_BLAST_RADIUS * 0.5), 1000, 1, 3000); // 반경 안, 작은 생명
  s.runTicks(2);
  // 파이어볼이면 size≥ 만 치지만, 물질 자폭은 blind — 작은 생명도 폭발에 질서를 잃는다.
  assert.ok(s.txOf('detonate').some(o => o.from === small.id), '작은 생명(size1)도 물질 자폭 폭발에 태워졌다(blind AoE)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('다채널 — 자폭도 이웃 결정을 열복사(가열)+압력(파괴)로 친다 (같은 규칙 D 재사용)', () => {
  const s = setup();
  s.overcharged(1000, 1000, 0, CRYSTAL_DETONATE_THRESHOLD + 6000);
  // 취성 종(파괴강도 낮은 7)을 곁에 둔다 → 자폭 압력에 부서진다.
  const brittle = s.game.spawnRawFood(1050, 1000, 500, 7, 500); brittle.raw = false;
  s.runTicks(2);
  assert.ok(s.txOf('shatter').length > 0, '자폭 압력이 곁의 취성 결정을 부쉈다(규칙 C 유발)');
  assert.ok(s.txOf('heat').some(o => o.to === `${POOL.HEAT}${brittle.seq}`) || !s.game.crystals.has(brittle.id), '자폭 열복사가 이웃을 데우거나 부쉈다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('안정 물질 면역 — 재료(raw)·산물(crafted)은 임계를 넘어도 자폭하지 않는다 (반응 면역과 같은 정합)', () => {
  const s = setup();
  const raw = s.game.spawnRawFood(1000, 1000, 500, 0, CRYSTAL_DETONATE_THRESHOLD + 5000); // raw 유지
  const crafted = s.game.spawnRawFood(1300, 1000, 500, 3, CRYSTAL_DETONATE_THRESHOLD + 5000);
  crafted.raw = false; crafted.crafted = true; // 산물
  s.runTicks(3);
  assert.ok(s.game.crystals.has(raw.id), '재료(raw)는 임계를 넘어도 안정 — 자폭 면역');
  assert.ok(s.game.crystals.has(crafted.id), '산물(crafted)도 안정 — 자폭 면역');
  assert.equal(s.txOf('detonate').length, 0, '안정 물질만 있으면 자폭 폭발이 없다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('임계 미만은 안 터진다 — 자연 결정도 임계 아래면 안정하게 남는다', () => {
  const s = setup();
  const cry = s.overcharged(1000, 1000, 0, CRYSTAL_DETONATE_THRESHOLD - 2000); // 임계 미만
  s.runTicks(3);
  assert.ok(s.game.crystals.has(cry.id), '임계 미만 자연 결정은 안 터진다(안정)');
  assert.equal(s.txOf('detonate').length, 0, '자폭 없음');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('결정론 — 같은 배치면 자폭 결과가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.overcharged(1000, 1000, 0, CRYSTAL_DETONATE_THRESHOLD + 4000);
    s.overcharged(1100, 1000, 5, CRYSTAL_DETONATE_THRESHOLD + 9000);
    s.game.spawnRawFood(1050, 1050, 500, 7, 400).raw = false;
    s.runTicks(4);
    return [...s.game.crystals.values()].sort((a, b) => a.seq - b.seq).map(c => [c.seq, c.species, s.bal(c.id)]);
  };
  assert.deepEqual(run(), run(), '동일 배치 → 비트 단위 동일 자폭');
});
