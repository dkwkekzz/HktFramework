// 사냥 진단 — feature 8(강탈·포식)·9(발산=파이어볼)·11(욕구 절차=식사) 이 실제로 발생하는지 계측한다.
//   (A) 야생 세계(index.js 창세와 같은 서식지 시드)를 N틱 돌려 자율 포식/발산 이벤트를 센다.
//   (B) 제어 아레나(플레이어 아바타 + 먹이)를 세워 HUNT 욕구를 걸면 실제 타격이 나는지 본다.
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { CAUSE, POOL, DESIRE, materialKey } from '../shared/constants.js';

const N = Number(process.argv[2] || 3000);

function collectGame() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  game.addPlayer({ send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } }, '관전자');
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops || []);
  return { game, clock, msgs, ops };
}

// ── (A) 야생 세계: index.js 서식지(포식자 size2 + 이따금 먹이) 를 흉내 내 자율 포식/발산을 관찰 ──
function wildAudit() {
  const { game, clock, ops } = collectGame();
  const dens = [];
  for (let i = 0; i < 3; i++) {
    const cx = 500 + i * 300, cy = 500, cz = 500;
    const pred = game.spawnCreature(cx, cy, cz);
    pred.size = 2; game.ledger.get(pred.id).max = 2000;
    game.ledger.transfer(POOL.SOURCE, pred.id, 1500, 'seed');
    game.ledger.transfer(POOL.SOURCE, materialKey(cx, cy, cz), 24_000, 'seed');
    dens.push({ cx, cy, cz });
  }
  let counts = { attack: 0, burst: 0, emit: 0, deaths: 0 };
  for (let tick = 0; tick < N; tick++) {
    // 이따금 각 서식지에 작은 먹이(size1)를 낸다 → 포식 표적
    if (tick % 40 === 0) for (const d of dens) {
      const prey = game.spawnCreature(d.cx + 30, d.cy + 30, d.cz);
      game.ledger.transfer(POOL.SOURCE, prey.id, 700, 'seed');
    }
    clock.t += 100;
    game.tick();
  }
  for (const op of ops()) {
    if (op.cause === CAUSE.ATTACK) counts.attack++;
    else if (op.cause === CAUSE.BURST) counts.burst++;
    else if (op.cause === CAUSE.EMIT) counts.emit++;
  }
  return counts;
}

// ── (B) 제어 아레나: 플레이어 아바타(size2) + 바로 옆 먹이(size1). HUNT 욕구를 걸면 타격이 나는가? ──
function huntCommandAudit() {
  const { game, clock, ops, msgs } = collectGame();
  // 아바타
  const me = game.spawnCreature(1000, 1000, 1000);
  me.size = 2; game.ledger.get(me.id).max = 2000;
  game.ledger.transfer(POOL.SOURCE, me.id, 1600, 'seed');
  // 플레이어에게 소유시킨다
  const pid = [...game.players.keys()][0];
  me.owner = pid;
  // 먹이 — 사거리 근처에 둔다
  const prey = game.spawnCreature(1000, 1120, 1000);
  game.ledger.transfer(POOL.SOURCE, prey.id, 800, 'seed');
  const preyStart = game.ledger.balance(prey.id);
  const meStart = game.ledger.balance(me.id);
  // HUNT 욕구 부여
  game.setDesire(pid, DESIRE.HUNT);
  for (let i = 0; i < 60; i++) { clock.t += 100; game.tick(); }
  const attacks = ops().filter(op => op.cause === CAUSE.ATTACK).length;
  return {
    attacks,
    preyDrained: preyStart - game.ledger.balance(prey.id),
    preyAlive: game.creatures.has(prey.id) && game.ledger.balance(prey.id) > 0,
    meDelta: game.ledger.balance(me.id) - meStart,
  };
}

// ── (C) 발산: 약자가 강자를 못 먹으니 파이어볼을 쏜다 ──
function dischargeAudit() {
  const { game, clock, ops } = collectGame();
  const weak = game.spawnCreature(1000, 1000, 1000);        // 약자(size1)
  game.ledger.transfer(POOL.SOURCE, weak.id, 900, 'seed');
  const strong = game.spawnCreature(1000, 1100, 1000);       // 강자(size3) — 못 먹으니 폭탄
  strong.size = 3; game.ledger.get(strong.id).max = 3000;
  game.ledger.transfer(POOL.SOURCE, strong.id, 2500, 'seed');
  for (let i = 0; i < 40; i++) { clock.t += 100; game.tick(); }
  const emits = ops().filter(op => op.cause === CAUSE.EMIT).length;
  return { emits, fireballsSeen: emits > 0 };
}

console.log('=== 사냥 진단 (feature 8·9·11) ===\n');
const wild = wildAudit();
console.log(`(A) 야생 세계 ${N}틱 자율 관찰:`);
console.log(`    강탈(포식, attack) : ${wild.attack} 회`);
console.log(`    발산 비용(burst)   : ${wild.burst} 회`);
console.log(`    파이어볼 발사(emit): ${wild.emit} 회\n`);

const hunt = huntCommandAudit();
console.log('(B) 플레이어가 HUNT 욕구를 걸었을 때(아바타 size2 → 옆 먹이 size1):');
console.log(`    타격 발생        : ${hunt.attacks} 회`);
console.log(`    먹이가 뜯긴 양   : ${hunt.preyDrained}`);
console.log(`    내 생명체 순증감 : ${hunt.meDelta} (강탈은 손실적이라 이동·발산비용 감안)`);
console.log(`    먹이 생존        : ${hunt.preyAlive}\n`);

const dis = dischargeAudit();
console.log('(C) 약자(size1)가 강자(size3) 옆 → 못 먹으니 발산(파이어볼):');
console.log(`    파이어볼 발사    : ${dis.emits} 회\n`);

const ok8 = wild.attack > 0 || hunt.attacks > 0;
const ok9 = wild.emit > 0 || dis.emits > 0;
console.log('=== 판정 ===');
console.log(`feature 8 (강탈·포식) : ${ok8 ? '작동 ✅' : '관찰 안됨 ❌'}`);
console.log(`feature 9 (발산·파이어볼): ${ok9 ? '작동 ✅' : '관찰 안됨 ❌'}`);
console.log(`feature 11(HUNT 욕구 절차): ${hunt.attacks > 0 ? '작동 ✅' : '관찰 안됨 ❌'}`);
