// ============================================================================
// 구 feature-0011(현 0018) — 사냥(HUNT)의 완결형 절차: 상황에 맞는 무기로 대상을 처치하고 전리품까지 획득한다.
//
// 명제(구 feature-0011(현 0018)): 욕구를 상황에 맞게 **절차적으로 끝까지 수행**한다. 사냥의 완결은 "때리기"가 아니라
//   "적을 죽여 그 에너지·재료를 획득"까지다. 그래서 HUNT 절차는 상황에 따라 무기를 고르고, 처치 후 전리품을 먹는다:
//     · 먹을 수 있는 작은 먹이(size<) → 물리 강탈(strike, feature-0008) → 죽으면 시체 결정(feature-0005) → 채집(feature-0007)
//     · 먹을 수 없는 강적(size≥) → 파이어볼(launch, feature-0009 발산) — 못 먹으니 폭탄을 던진다
// 강제: 전부 ledger.transfer(보존·정수). 플레이어 클릭 지정(setTarget)으로 표적을 준다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { POOL, CAUSE, DESIRE, WORLD_SOURCE_INITIAL } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  game.addPlayer({ send() {} }, 'p');
  const pid = [...game.players.keys()][0];
  const bal = (id) => game.ledger.balance(id);
  const runTicks = (n) => { for (let i = 0; i < n; i++) { clock.t += 100; game.tick(); } };
  // 생명체를 원하는 스탯·잔고로. mine=플레이어 소유(사냥꾼) · other=소유 더미(반격 없는 표적).
  const spawn = (x, y, size, fill, owner) => {
    const c = game.spawnCreature(x, y, 500);
    c.owner = owner;
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 2000 * size; }
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    return c;
  };
  return {
    game, pid, bal, runTicks, total: () => game.ledger.totalSum(),
    mine: (x, y, size, fill) => spawn(x, y, size, fill, pid),
    other: (x, y, size, fill) => spawn(x, y, size, fill, 'P:ghost'),
    click: (seq) => game.setTarget(pid, { kind: 'creature', seq }),
  };
}

test('사냥 = 작은 먹이를 물리 강탈로 처치하고 그 자리 시체 결정(전리품)을 채집한다 — 한 욕구로 닫힌다', () => {
  const s = setup();
  const me = s.mine(1000, 1000, 2, 1600);           // 아바타(size2)
  const prey = s.other(1000, 1150, 1, 800);          // 작은 먹이(size1) — 강탈 대상
  const preyId = prey.id;
  // 강탈·채집을 원장 cause 로 계측한다.
  let harvestToMe = 0, deathCrystal = 0;
  const orig = s.game.ledger.transfer.bind(s.game.ledger);
  s.game.ledger.transfer = (f, t, a, c) => {
    const r = orig(f, t, a, c);
    if (c === CAUSE.CRYSTALLIZE && f === preyId) deathCrystal += r;   // 죽음의 결정화(시체 = 전리품)
    if (c === CAUSE.HARVEST && t === me.id) harvestToMe += r;         // 사냥꾼이 결정을 먹음(전리품 획득)
    return r;
  };
  s.click(prey.seq);                                 // 클릭 지정 = HUNT
  assert.equal(me.commandedStrategy, DESIRE.HUNT, '먹이를 지목하면 사냥 명령이 선다(자율 우회)');
  s.runTicks(120);

  assert.equal(s.game.creatures.has(preyId), false, '먹이를 처치했다(강탈로 예비가 무너져 죽음)');
  assert.ok(deathCrystal > 0, '처치된 먹이가 시체 결정(전리품)을 남겼다(feature-0005 죽음의 결정화)');
  assert.ok(harvestToMe > 0, '사냥꾼이 그 시체 결정을 채집했다 — 사냥이 전리품 획득까지 이어졌다(feature-0007)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '강탈·결정화·채집이 뒤섞여도 보존 불변');
});

test('사냥 = 먹을 수 없는 강적(size≥)에게는 파이어볼을 쏜다 — 강탈 대신 발산(feature-0009)', () => {
  const s = setup();
  const me = s.mine(1000, 1000, 2, 1800);            // 아바타(size2)
  const foe = s.other(1000, 1200, 3, 2500);          // 더 큰 강적(size3) = 못 먹음 → 폭탄
  s.click(foe.seq);
  assert.equal(me.commandedStrategy, DESIRE.HUNT, '강적을 지목해도 사냥 명령이 선다(크기 무관)');
  s.runTicks(30);
  assert.ok(s.game.fireballSeq > 0, '강적에게 파이어볼을 발사했다(발산)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '발산·비행·폭발에도 보존 불변');
});

test('무기 선택은 상황이 정한다 — 같은 사냥 욕구라도 먹이면 강탈(수입), 강적이면 발산(지출)', () => {
  // 강탈은 표적에서 내게 에너지가 온다(수입=ATTACK). 발산은 내게 아무것도 안 온다(순수 지출).
  const rob = setup();
  const a = rob.mine(1000, 1000, 2, 1600);
  const prey = rob.other(1000, 1100, 1, 800);
  let attackToMe = 0;
  const o1 = rob.game.ledger.transfer.bind(rob.game.ledger);
  rob.game.ledger.transfer = (f, t, x, c) => { const r = o1(f, t, x, c); if (c === CAUSE.ATTACK && t === a.id) attackToMe += r; return r; };
  rob.click(prey.seq); rob.runTicks(20);
  assert.ok(attackToMe > 0, '먹이 사냥 = 강탈로 표적 에너지가 내게 온다(수입)');

  const cast = setup();
  const b = cast.mine(1000, 1000, 2, 1800);
  const foe = cast.other(1000, 1200, 3, 2500);
  let foeToMe = 0;
  const o2 = cast.game.ledger.transfer.bind(cast.game.ledger);
  cast.game.ledger.transfer = (f, t, x, c) => { const r = o2(f, t, x, c); if (f === foe.id && t === b.id) foeToMe += r; return r; };
  cast.click(foe.seq); cast.runTicks(12);
  assert.ok(cast.game.fireballSeq > 0, '강적 사냥 = 파이어볼을 쏜다');
  assert.equal(foeToMe, 0, '발산은 표적에서 회수가 없다 — 강적 에너지가 내게 오지 않는다(강탈은 표적→나로 오는 것과 결정적 대비)');
});
