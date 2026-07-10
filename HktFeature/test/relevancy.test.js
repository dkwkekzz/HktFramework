// ============================================================================
// feature-0016 — 시야 relevancy: 클라는 보이는 것만 처리한다(bot 포함)
//
// 직관: 프레임드랍은 클라가 **온 세계**의 결정·생명체를 매 프레임 훑어서 났다. 서버가
//   결정·생명체 스냅샷을 전 플레이어에게 전량 방송(전역)했기 때문이다. 이제 서버가 각
//   플레이어의 구독 지역(3x3)만 골라 실어보낸다 → 클라의 미러·렌더 부하가 **보이는 것**에만
//   비례한다. 시야 밖은 서버에서 원장(에너지 보존)으로만 계속 굴러가고, 다시 시야에 들면
//   그 지역 스냅샷이 재동기화한다.
// 강제: (1) 시야 밖 엔티티는 스냅샷에 없다 (2) 시야 안·내 소유는 있다 (3) 시야를 옮기면
//   들어온 건 실리고 나간 건 빠진다(재동기화·소멸 없음) (4) 세계 총합(보존)은 시야와 무관하게
//   불변 (5) 부하(실린 셀 수)가 전역이 아니라 시야에 비례한다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, DESIRE, regionNeighbors, materialKey, FIELD_INTERVAL_TICKS,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  const player = game.addPlayer(conn, '관전자');
  const lastCells = (type) => { const f = msgs.filter(m => m.t === type); return f.length ? f.at(-1).cells : null; };
  const lastCrystalSeqs = () => { const c = lastCells(MSG.CRYSTAL); return c ? new Set(c.map(x => x[0])) : null; };
  const lastCreatureSeqs = () => { const c = lastCells(MSG.CREATURE); return c ? new Set(c.map(x => x[0])) : null; };
  // 플레이어의 시야(구독 지역)를 특정 좌표 기준으로 옮긴다 — 비콘 이동을 지역 관점에서 직접 재현.
  const setView = (x, y) => { player.regions = new Set(regionNeighbors(x, y)); };
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  return { game, player, msgs, lastCells, lastCrystalSeqs, lastCreatureSeqs, setView, runTicks, total: () => game.ledger.totalSum() };
}

test('결정 relevancy — 내 시야(지역) 안 결정만 스냅샷에 실린다', () => {
  const s = setup();
  s.setView(1000, 1000); // 지역 2_2 중심 → 1_1..3_3 구독
  const near = s.game.spawnFood(1000, 1000, 500, 3, 5_000); // 지역 2_2 (시야 안)
  const far = s.game.spawnFood(200, 200, 500, 3, 5_000);    // 지역 0_0 (시야 밖)
  s.runTicks(1); // tick 0 flush → CRYSTAL 방송
  const snap = s.lastCrystalSeqs();
  assert.ok(snap.has(near.seq), '시야 안 결정은 실린다');
  assert.ok(!snap.has(far.seq), '시야 밖 결정은 실리지 않는다(클라가 처리하지 않음)');
});

test('생명체 relevancy — 내 시야 안 생명체(봇 포함)만 실린다', () => {
  const s = setup();
  s.setView(1000, 1000);
  const near = s.game.spawnCreature(1000, 1000, 500);      // 시야 안 (봇/야생 생명체)
  s.game.ledger.transfer(POOL.SOURCE, near.id, 1_000, 'seed');
  const far = s.game.spawnCreature(200, 200, 500);         // 시야 밖
  s.game.ledger.transfer(POOL.SOURCE, far.id, 1_000, 'seed');
  s.runTicks(1);
  const snap = s.lastCreatureSeqs();
  assert.ok(snap.has(near.seq), '시야 안 생명체는 실린다');
  assert.ok(!snap.has(far.seq), '시야 밖 생명체는 실리지 않는다');
});

test('내 생명체는 시야 밖이어도 항상 실린다 — 카메라·제어가 놓치지 않게', () => {
  const s = setup();
  s.setView(1000, 1000);                                  // 내 시야는 중앙
  const mine = s.game.possessCreature(s.player.id, 200, 200, 500); // 내 생명체는 먼 구석(시야 밖)
  mine.desire = DESIRE.FORAGE;
  s.game.ledger.transfer(POOL.SOURCE, mine.id, 1_000, 'seed');
  s.runTicks(1);
  const snap = s.lastCreatureSeqs();
  assert.ok(snap.has(mine.seq), '소유 생명체는 시야 밖이어도 스냅샷에 실린다(owner 예외)');
});

test('시야 이동 = 재동기화 — 들어온 결정은 실리고 나간 것은 빠진다(소멸 아님)', () => {
  const s = setup();
  const a = s.game.spawnFood(200, 200, 500, 3, 5_000);    // 지역 0_0
  const b = s.game.spawnFood(1800, 1800, 500, 3, 5_000);  // 지역 3_3

  s.setView(200, 200);                                    // 시야를 A 쪽으로
  s.runTicks(1);                                          // tick 0 = 방송 틱
  let snap = s.lastCrystalSeqs();
  assert.ok(snap.has(a.seq) && !snap.has(b.seq), 'A 쪽 시야 — A 만 보인다');

  s.setView(1800, 1800);                                  // 시야를 B 쪽으로 옮김
  s.runTicks(FIELD_INTERVAL_TICKS);                       // 다음 방송 틱까지 진행
  snap = s.lastCrystalSeqs();
  assert.ok(!snap.has(a.seq) && snap.has(b.seq), '시야를 옮기면 A 는 빠지고 B 가 들어온다(재동기화)');

  // 서버에는 둘 다 여전히 살아있다 — 시야에서 빠졌을 뿐 소멸이 아니다(에너지 보존).
  assert.ok(s.game.crystals.has(a.id) && s.game.ledger.balance(a.id) > 0, 'A 는 서버에 그대로 존재(보존)');
});

test('보존은 시야와 무관하게 불변 — 시야 밖 세계도 서버 원장으로 계속 굴러간다', () => {
  const s = setup();
  s.setView(1000, 1000);
  // 시야 밖 먼 구석에 결정·생명체·국소장을 잔뜩 둔다(클라는 못 보지만 서버는 안다).
  s.game.spawnFood(200, 200, 500, 3, 5_000);
  s.game.spawnCreature(200, 300, 500);
  s.game.ledger.transfer(POOL.SOURCE, materialKey(200, 200, 500), 40_000, 'seed');
  const before = s.total();
  s.runTicks(60); // 확산·복사·결정화·대사 … 시야 밖에서도 다 돈다
  assert.equal(s.total(), before, '세계 총합(보존)은 시야와 무관하게 불변');
});

test('부하 = 시야에 비례 (전역 아님) — 온 세계에 결정이 흩어져도 실리는 건 시야 몫뿐', () => {
  const s = setup();
  s.setView(1000, 1000); // 3x3 지역 = 세계(4x4)의 일부
  // 16개 지역 각 중앙에 결정 하나씩(전역 분포).
  let far = 0;
  for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 4; gy++) {
    const x = gx * 500 + 250, y = gy * 500 + 250;
    s.game.spawnFood(x, y, 500, 3, 5_000);
    if (!s.player.regions.has(`${gx}_${gy}`)) far++;
  }
  s.runTicks(1);
  const cells = s.lastCells(MSG.CRYSTAL);
  assert.equal(s.game.crystals.size, 16, '서버엔 온 세계 16개 결정이 다 있다');
  assert.ok(cells.length < 16, `실린 건 전역(16)보다 적다 — 실림 ${cells.length}`);
  assert.equal(cells.length, 16 - far, `실린 건 정확히 내 시야 몫(9)만 — 시야 밖 ${far}개는 제외`);
});
