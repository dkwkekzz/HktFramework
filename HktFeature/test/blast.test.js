// ============================================================================
// feature-0013 규칙 D — 폭발(detonation): 농축 에너지 덩어리가 저장 질서를 순간에 다채널로 방출한다
//
// 직관(물리): 폭발은 **물질의 사건**이다(생명 무관) — 파이어볼(feature-0009 발산이 만든 투사체)·폭탄·
//   과충전 결정이 터진다. 연소(규칙 A)가 에너지 물질의 *느린* 발열 분해라면, 폭발은 *격렬한* 극단 —
//   같은 규칙엔진 계열이되 방출이 **압력파로 반경에 전파**하는 점이 새롭다. 폭발파는 반경 내에 두 자극을
//   침착하고, 각 물질은 제 속성대로 반응한다:
//     · 열복사(thermal)  — 반경 내 결정 열(H:)에 열을 실어보낸다 → 규칙엔진이 태그로 가른다:
//                          가연성=연소(불 번짐·연쇄 발화=증폭) / 비가연성=용해.
//     · 압력(mechanical) — 물리력이 파괴강도를 넘는 취성 결정을 부순다(파편). 열과 독립된 별개 자극.
//   AoE 는 별도 기능이 아니라 폭발파가 구면으로 퍼지는 본질 — 반경 내 먹을 수 없는 상대(size≥)를 거리 감쇠로 함께 태운다.
//   불속성은 폭발 '전부'가 아니라 열 채널 하나의 증폭원(sympathetic detonation)일 뿐이다.
// 강제: 폭발 전부 ledger.transfer(보존·정수). 회수 없음 — 어떤 흐름도 생명체로 안 간다. 총합 = 10⁹.
// (발산=생명체가 파이어볼을 만드는 행위는 feature-0009 = discharge.test.js. 여기선 그 파이어볼이 *터지는* 사건만 본다.)
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, dist3,
  DISCHARGE_BLAST_RADIUS, DISCHARGE_HEAT, DISCHARGE_POWER,
  isFlammable, ignitionHeat, meltHeat, breakStrength,
} from '../shared/constants.js';

// 종 고르기 — 각 채널이 명확히 갈리게 속성별로.
function pickFlammable() { for (let i = 0; i < 12; i++) if (isFlammable(i) && breakStrength(i) > DISCHARGE_POWER * 2) return i; return 0; } // 가연성 & 물리력으론 안 깨지는(연소만) 종
function pickMeltable()  { for (let i = 0; i < 12; i++) if (!isFlammable(i) && breakStrength(i) > DISCHARGE_POWER * 2 && Number.isFinite(meltHeat(i))) return i; return 1; } // 비가연성 & 안 깨지고 녹는 종
function pickBrittle()   { let s = 0, b = Infinity; for (let i = 0; i < 12; i++) { const v = breakStrength(i); if (v < b) { b = v; s = i; } } return s; } // 가장 잘 깨지는 종

function setup() {
  const game = new GameServer({ now: () => 1_000_000 });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops);
  const txOf = (cause) => ops().filter(o => o.cause === cause);
  // 캐스터: 발산(파이어볼 생성)을 위해 넉넉히. owned=자율 발산/전투 안 하는 표적(반격 없음, 단일 자극원).
  const makeCreature = (x, y, z, size, fill, opts = {}) => {
    const c = game.spawnCreature(x, y, z);
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 4000 * size; }
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    if (opts.owned) c.owner = 'P:ghost';
    return c;
  };
  const spawnCry = (x, y, sp, amt) => game.spawnRawFood(x, y, 500, sp, amt);
  return { game, bal, total, runTicks, ops, txOf, makeCreature, spawnCry };
}

test('AoE — 한 폭발이 착탄점 둘레의 여러 표적을 동시에 태운다(거리 감쇠: 가까울수록 크게)', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 6000);
  const T1 = s.makeCreature(1000, 1200, 500, 2, 3000, { owned: true });                        // 착탄점(가장 가까운 조준 표적)
  const T2 = s.makeCreature(1000, 1200 + Math.round(DISCHARGE_BLAST_RADIUS * 0.6), 500, 2, 3000, { owned: true }); // 폭발 반경 안(더 멀다)
  assert.ok(dist3(1000, 1200, 500, T2.x, T2.y, 500) <= DISCHARGE_BLAST_RADIUS, '설정 확인: T2 도 폭발 반경 안');
  s.runTicks(5);

  const lost = (id) => s.txOf('detonate').filter(o => o.from === id).reduce((a, o) => a + o.amount, 0);
  assert.ok(lost(T1.id) > 0, 'T1(착탄점)이 폭발로 질서를 잃었다');
  assert.ok(lost(T2.id) > 0, 'T2(반경 내 두 번째 표적)도 같은 폭발에 태워졌다 — 단일 타격이 아니라 AoE');
  assert.ok(lost(T1.id) > lost(T2.id), '거리 감쇠 — 착탄점에 가까운 T1 이 더 크게 손상됐다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, 'AoE 폭발에도 보존 불변');
});

test('완전 연소 — 폭발로 예비가 무너진 표적은 잔해 결정 없이 전소해 사라진다', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 6000);
  const B = s.makeCreature(1000, 1150, 500, 2, 150, { owned: true }); // 동급 표적(size≥) — 예비 위지만 한 폭발에 붕괴
  const cry0 = (() => { let x = 0; for (const [id, p] of s.game.ledger.pools) if (id.startsWith(POOL.CRYSTAL)) x += p.balance; return x; })();
  s.runTicks(5);
  assert.ok(!s.game.creatures.has(B.id), '표적이 전소해 사라졌다(엔티티 소멸)');
  const cry1 = (() => { let x = 0; for (const [id, p] of s.game.ledger.pools) if (id.startsWith(POOL.CRYSTAL)) x += p.balance; return x; })();
  assert.equal(cry1, cry0, '완전 연소 — 잔해 결정을 남기지 않는다(전부 열+연기로)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '전소에도 보존 불변');
});

test('열복사 채널 → 연소 — 폭발 반경의 가연성 결정이 열을 받아 점화·연소한다', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 6000);
  const target = s.makeCreature(1000, 1150, 500, 2, 3000, { owned: true }); // 조준 표적(착탄점)
  const FL = pickFlammable();
  const cry = s.spawnCry(1000, 1150, FL, 800);   // 착탄점(열 감쇠 최대) — 발화점 넘겨 점화
  assert.ok(DISCHARGE_HEAT * 2 >= ignitionHeat(FL), '설정 확인: 침착 열(HEAT×size2) ≥ 발화점');
  s.runTicks(6);

  const heatToCry = s.txOf('heat').filter(o => o.to === `${POOL.HEAT}${cry.seq}` && o.from.startsWith(POOL.FIREBALL));
  assert.ok(heatToCry.length > 0, '열복사 채널 — 파이어볼이 결정 열(H:)에 열을 실어보냈다(생명체가 아니라 폭발이)');
  const ignitedOrBurned = (s.game.crystals.get(cry.id)?.burning) || !s.game.crystals.has(cry.id) || s.bal(cry.id) < 800;
  assert.ok(ignitedOrBurned, '가연성 결정이 점화되어 스스로 타기 시작했다(연소)');
  assert.ok(s.txOf('combust').some(o => o.from === cry.id), '연소 tx — 결정이 내구도를 열·연기로 방출');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('열복사 채널 → 용해 — 폭발 반경의 비가연성 결정이 열을 받아 녹는다', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 6000);
  const target = s.makeCreature(1000, 1150, 500, 2, 3000, { owned: true });
  const ME = pickMeltable();
  const cry = s.spawnCry(1000, 1150, ME, 800);   // 착탄점 — 녹는점 넘겨 용해
  assert.ok(DISCHARGE_HEAT * 2 >= meltHeat(ME), '설정 확인: 침착 열 ≥ 녹는점');
  s.runTicks(6);

  assert.ok(s.txOf('heat').some(o => o.to === `${POOL.HEAT}${cry.seq}` && o.from.startsWith(POOL.FIREBALL)), '열복사가 결정을 데웠다');
  assert.ok(s.txOf('melt').some(o => o.from === cry.id && o.to.startsWith(POOL.MATERIAL)), '용해 tx — 비가연성 결정이 국소장으로 녹아 흘렀다(같은 열, 다른 반응)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('압력 채널 → 파괴 — 폭발 물리력이 취성 결정을 부순다(열과 독립)', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 6000);
  const target = s.makeCreature(1000, 1150, 500, 2, 3000, { owned: true });
  const BR = pickBrittle();
  assert.ok(DISCHARGE_POWER * 2 >= breakStrength(BR), '설정 확인: 폭발 물리력(POWER×size2) ≥ 파괴강도');
  const cry = s.spawnCry(1050, 1150, BR, 600);   // 착탄점 근처(반경 안)
  s.runTicks(5);

  assert.ok(!s.game.crystals.has(cry.id), '취성 결정이 폭발 압력에 부서져 원본이 사라졌다');
  assert.ok(s.txOf('shatter').length > 0, '파괴(shatter) tx — 파편 + 먼지로 나뉘었다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('다채널 동시 — 한 폭발에 가연성=연소·비가연성=용해·취성=파괴가 태그로 갈린다(한 장면)', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 8000);
  const target = s.makeCreature(1000, 1150, 500, 2, 3000, { owned: true });
  const FL = pickFlammable(), ME = pickMeltable(), BR = pickBrittle();
  const burn = s.spawnCry(1000, 1150, FL, 2000); // 가연성 → 폭발 열로 점화·연소(오래 타는 열원)
  const melt = s.spawnCry(1020, 1150, ME, 800);  // 비가연성(안 깨짐, 착탄점 근접) → 곁의 불에 녹는다(연소열 전파=feature-0013 규칙 B)
  const brk  = s.spawnCry(980, 1150, BR, 600);   // 취성 → 폭발 압력에 부서진다
  s.runTicks(24);                                 // 폭발 점화 후 불이 번져 이웃 비가연성 결정을 녹이기까지

  assert.ok(s.txOf('combust').some(o => o.from === burn.id) || s.game.crystals.get(burn.id)?.burning, '가연성 결정은 연소한다(A)');
  assert.ok(s.txOf('melt').some(o => o.from === melt.id), '비가연성 결정은 용해한다(B)');
  assert.ok(s.txOf('shatter').length > 0 && !s.game.crystals.has(brk.id), '취성 결정은 파괴된다(C)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '세 반응이 한 폭발에서 동시에 갈려도 보존 불변');
});

test('속성 증폭(연쇄 폭발) — 불속성 결정은 받은 열보다 많이 방출한다(sympathetic detonation)', () => {
  const s = setup();
  // 캐스터 예비를 빠듯하게(한 발만 쏘게) — 단 한 번 점화시키고 그 뒤로는 재가열하지 않는다(순수 증폭 관측).
  //   한 발 비용 = 발사(40)+장전(140)+예비(120)=300(size2). 340 이면 tick4 에 한 발 쏘고 이후는 예비 미달로 못 쏜다.
  const A = s.makeCreature(1000, 1000, 500, 2, 340);
  const target = s.makeCreature(1000, 1150, 500, 2, 3000, { owned: true });
  const FL = pickFlammable();
  const cry = s.spawnCry(1000, 1150, FL, 1200);  // 착탄점의 불속성 결정 — 한 번 점화되면 제 내구도를 연쇄로 방출
  s.runTicks(14); // 발화 후 여러 연소 틱

  const heatIn = s.txOf('heat').filter(o => o.to === `${POOL.HEAT}${cry.seq}`).reduce((a, o) => a + o.amount, 0);
  const released = s.txOf('combust').filter(o => o.from === cry.id).reduce((a, o) => a + o.amount, 0); // 결정이 연소로 세계에 흩은 양
  assert.ok(heatIn > 0, '폭발이 결정에 열을 실었다(점화)');
  assert.ok(released > heatIn, `증폭 — 결정이 받은 열(${heatIn})보다 많이 방출했다(${released}): 불속성 아이템이 폭발을 키운다`);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '연쇄 폭발에도 보존 불변(창발한 에너지 없음 — 결정 제 내구도가 풀린 것)');
});

test('회수 없음(다채널) — 열복사·압력 어느 채널도 캐스터(생명체)로 돌아가지 않는다', () => {
  const s = setup();
  const A = s.makeCreature(1000, 1000, 500, 2, 6000);
  const target = s.makeCreature(1000, 1150, 500, 2, 3000, { owned: true });
  const FL = pickFlammable(), BR = pickBrittle();
  s.spawnCry(1000, 1150, FL, 800);
  s.spawnCry(1050, 1150, BR, 600);
  s.runTicks(12);

  // 폭발 계열 어떤 tx 도 종착이 생명체(C:)가 아니다 — 폭발은 순수 지출(먹지 않는다).
  const destructive = [...s.txOf('detonate'), ...s.txOf('heat'), ...s.txOf('combust'), ...s.txOf('melt'), ...s.txOf('shatter'), ...s.txOf('emit'), ...s.txOf('burst')];
  const toCreature = destructive.filter(o => o.to.startsWith(POOL.CREATURE));
  assert.equal(toCreature.length, 0, '다채널 폭발에도 회수 없음 — 어떤 흐름도 캐스터로 안 간다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});
