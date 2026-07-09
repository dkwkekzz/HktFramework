// ============================================================================
// 시뮬 — "파이어볼 vs 칼로 내려치기 vs 물어뜯기"의 에너지 흐름을 실제 엔진으로 대조한다 (feature-0010).
//   결론: 무기가 아니라 *종착*이 위상을 정한다. 흡수(강탈=물어뜯기, 종착=나) vs 파괴(참격=칼·파이어볼, 종착=세계).
//   ① 세 능력의 tx 흐름 대조  ② 서버 창세 그대로(포식자+전사+먹이) 라이브 감사 — 실제 방송 계측.
// 실행: node tools/sim-fireball-vs-sword.mjs
// ============================================================================
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { POOL, WORLD_SOURCE_INITIAL, WORLD_HEIGHT, SPAWN_POS, materialKey } from '../shared/constants.js';

function world() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops);
  const makeCreature = (x, y, z, size, fill, melee = 'bite') => {
    const c = game.spawnCreature(x, y, z, { melee });
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 1000 * size; }
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    return c;
  };
  return { game, bal, ops, makeCreature, total: () => game.ledger.totalSum() };
}

function label(id, A, V) {
  if (id === A) return '캐스터(A)';
  if (id === V) return '표적(V)';
  if (id === POOL.SINK) return '심우주(SINK,열)';
  if (id.startsWith(POOL.MATERIAL)) return '국소장(M,연기)';
  if (id.startsWith(POOL.CRYSTAL)) return '결정(I,잔해)';
  return id;
}

function report(title, w, A, V, causes) {
  console.log('\n' + '─'.repeat(76));
  console.log(title);
  const txs = w.ops().filter(o => causes.includes(o.cause));
  const net = {};
  for (const o of txs) {
    console.log(`    ${label(o.from, A, V).padEnd(16)} → ${label(o.to, A, V).padEnd(18)} : ${String(o.amount).padStart(4)}  [${o.cause}]`);
    net[o.from] = (net[o.from] || 0) - o.amount;
    net[o.to] = (net[o.to] || 0) + o.amount;
  }
  const casterGain = net[A] || 0;
  const inbound = txs.some(o => o.to === A); // 표적→나 엣지?
  console.log(`  ▶ 표적→캐스터 엣지: ${inbound ? '있음(먹는다=흡수)' : '없음(부순다=파괴)'}   캐스터 순손익: ${casterGain >= 0 ? '+' : ''}${casterGain}`);
}

console.log('════ 1) 세 능력의 에너지 흐름 대조 (같은 원장 관문, 다른 종착) ════');

{ // 물어뜯기 = 강탈(흡수 근접) — bite
  const w = world();
  const A = w.makeCreature(1000, 1000, 500, 2, 900, 'bite');
  const V = w.makeCreature(1080, 1000, 500, 1, 500, 'bite');
  for (let i = 0; i < 3; i++) w.game.tick();
  report('물어뜯기(강탈·흡수 근접) — 포식자 size2 → 더 작은 먹이 size1', w, A.id, V.id, ['attack', 'burst']);
}
{ // 칼로 내려치기 = 참격(파괴 근접) — slash
  const w = world();
  const A = w.makeCreature(1000, 1000, 500, 2, 900, 'slash');
  const V = w.makeCreature(1080, 1000, 500, 1, 500, 'bite');
  for (let i = 0; i < 3; i++) w.game.tick();
  report('칼로 내려치기(참격·파괴 근접) — 전사 size2 → 표적 size1', w, A.id, V.id, ['strike', 'burst']);
}
{ // 파이어볼 = 방출(파괴 원거리) — fireball
  const w = world();
  const A = w.makeCreature(1000, 1000, 500, 1, 900, 'bite');
  const V = w.makeCreature(1300, 1000, 500, 1, 70, 'bite');
  for (let i = 0; i < 5; i++) w.game.tick();
  report('파이어볼(방출·파괴 원거리) — 캐스터 size1 → 원거리 동급 size1', w, A.id, V.id, ['discharge', 'burst']);
}

console.log('\n\n════ 2) 라이브 감사 — 서버 창세 그대로(포식자+전사+먹이 3군집) 1500틱 실제 방송 계측 ════');
{
  const w = world();
  const dens = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const cx = SPAWN_POS.x + Math.round(Math.cos(a) * 320);
    const cy = SPAWN_POS.y + Math.round(Math.sin(a) * 320);
    const cz = Math.round(WORLD_HEIGHT * 0.5);
    const pred = w.game.spawnCreature(cx, cy, cz);                    // 포식자(bite=흡수)
    pred.size = 2; w.game.ledger.get(pred.id).max = 2000;
    w.game.ledger.transfer(POOL.SOURCE, materialKey(cx, cy, cz), 24000, 'seed');
    dens.push([cx, cy, cz]);
  }
  const ARENA = { x: 1100, y: 1800, z: Math.round(WORLD_HEIGHT * 0.5) }; // 전사 무대(포식자와 >500px)
  const warrior = w.game.spawnCreature(ARENA.x, ARENA.y, ARENA.z, { melee: 'slash' });
  warrior.size = 2; w.game.ledger.get(warrior.id).max = 2000;
  w.game.ledger.transfer(POOL.SOURCE, warrior.id, 1800, 'seed');
  let preyNo = 0;
  for (let t = 0; t < 1500; t++) {
    w.game.tick();
    if ((t + 1) % 50 === 0) {
      for (const [cx, cy, cz] of dens) w.game.ledger.transfer(POOL.SOURCE, materialKey(cx, cy, cz), 9000, 'seed');
      const [cx, cy, cz] = dens[preyNo % dens.length]; preyNo++;
      w.game.spawnCreature(cx + 120, cy + 40, cz);
      w.game.ledger.transfer(POOL.SOURCE, materialKey(cx + 120, cy + 40, cz), 1500, 'seed');
      if (w.game.creatures.has(warrior.id)) {
        w.game.ledger.transfer(POOL.SOURCE, warrior.id, 700, 'seed');
        w.game.spawnCreature(ARENA.x + 120, ARENA.y, ARENA.z);
        w.game.ledger.transfer(POOL.SOURCE, materialKey(ARENA.x + 120, ARENA.y, ARENA.z), 800, 'seed');
      }
    }
  }
  // 관전자에게 방송된 전체 tx 를 cause 별로 집계(msgs 는 누적된다).
  const all = {};
  for (const o of w.ops()) all[o.cause] = (all[o.cause] || 0) + 1;
  console.log('  관전자에게 실제 방송된 tx 누적(cause 별):');
  for (const c of ['attack', 'strike', 'discharge', 'burst', 'harvest', 'forage', 'crystallize', 'react', 'death']) {
    if (all[c]) console.log(`    ${c.padEnd(12)} ${all[c].toLocaleString()}`);
  }
  const strikeToCreature = w.ops().filter(o => o.cause === 'strike' && o.to.startsWith(POOL.CREATURE)).length;
  const attackToCreature = w.ops().filter(o => o.cause === 'attack' && o.to.startsWith(POOL.CREATURE)).length;
  console.log(`\n  ▶ 참격(strike)이 생명체로 간 엣지: ${strikeToCreature} (0 이어야 파괴 = 회수 없음)`);
  console.log(`  ▶ 강탈(attack)이 생명체로 간 엣지: ${attackToCreature} (>0 이어야 흡수 = 먹는다)`);
  console.log(`  ▶ 전 풀 합계 = ${w.total().toLocaleString()} (${w.total() === WORLD_SOURCE_INITIAL ? '보존 ✓' : '보존 위반 ✗'})`);
}
