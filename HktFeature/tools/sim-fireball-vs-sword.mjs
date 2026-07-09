// ============================================================================
// 임시 시뮬 — "파이어볼 vs 칼로 내려치기"의 에너지 흐름을 실제 엔진으로 대조한다.
//   feature-0008(강탈=칼) vs feature-0009(방출=파이어볼)이 같은 원장 관문을 지나면서
//   *종착(어디로 가는가)*만 다른 두 흐름 그래프임을 tx 단위로 보여준다.
// 실행: node tools/sim-fireball-vs-sword.mjs
// ============================================================================
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { POOL, WORLD_SOURCE_INITIAL } from '../shared/constants.js';

function world() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자'); // 스폰 1000,1000 둘레 지역을 구독 → tx 방송 수신
  const bal = (id) => game.ledger.balance(id);
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops);
  const makeCreature = (x, y, z, size, fill) => {
    const c = game.spawnCreature(x, y, z);
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 1000 * size; }
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    return c;
  };
  return { game, bal, ops, makeCreature, total: () => game.ledger.totalSum() };
}

// 이름 붙이기 — 풀 id 를 사람이 읽는 라벨로
function label(id, A, V) {
  if (id === A) return '캐스터(A)';
  if (id === V) return '표적(V)';
  if (id === POOL.SINK) return '심우주(SINK, 열)';
  if (id.startsWith(POOL.MATERIAL)) return '국소장(M, 연기/거름)';
  if (id.startsWith(POOL.CRYSTAL)) return '결정(I, 잔해)';
  if (id === POOL.SOURCE) return '태양(SRC)';
  return id;
}

function report(title, w, A, V, causes) {
  console.log('\n' + '='.repeat(74));
  console.log(title);
  console.log('='.repeat(74));
  const txs = w.ops().filter(o => causes.includes(o.cause));
  if (txs.length === 0) { console.log('  (해당 tx 없음)'); return; }
  console.log('  개별 이체(from → to : amount  [cause]):');
  const net = {};
  for (const o of txs) {
    console.log(`    ${label(o.from, A, V).padEnd(20)} → ${label(o.to, A, V).padEnd(22)} : ${String(o.amount).padStart(4)}  [${o.cause}]`);
    net[o.from] = (net[o.from] || 0) - o.amount;
    net[o.to] = (net[o.to] || 0) + o.amount;
  }
  console.log('\n  풀별 순변화(net Δ):');
  for (const id of Object.keys(net)) {
    const v = net[id];
    console.log(`    ${label(id, A, V).padEnd(24)} ${v >= 0 ? '+' : ''}${v}`);
  }
  // 캐스터가 얻었는가? — 이것이 강탈/방출을 가르는 핵심 명제
  const casterGain = net[A] || 0;
  console.log(`\n  ▶ 캐스터 순손익: ${casterGain >= 0 ? '+' : ''}${casterGain}  →  ${casterGain > 0 ? '수입(먹는다=강탈)' : '순지출(먹지 않는다=파괴)'}`);
}

// ---------------------------------------------------------------------------
// 세계 1 — 칼로 내려치기 = 강탈(포식, feature-0008)
//   근접(사거리 200 안), 표적이 더 작음(size<). 붕괴 에너지 일부가 캐스터로 돌아온다.
// ---------------------------------------------------------------------------
{
  const w = world();
  const A = w.makeCreature(1000, 1000, 500, 2, 900); // 캐스터 size2
  const V = w.makeCreature(1080, 1000, 500, 1, 500); // 표적 size1 (더 작음=먹이), 80px 근접
  const a0 = w.bal(A.id), v0 = w.bal(V.id);
  for (let i = 0; i < 3; i++) w.game.tick(); // tickCount 2 에서 첫 전투 발화
  console.log(`\n[세계 1] 칼로 내려치기 — 캐스터 size2(잔고 ${a0}) 가 근접한 더 작은 표적 size1(잔고 ${v0}) 을 친다`);
  report('feature-0008 강탈(ATTACK/BURST) — 근접·커플링·손실적 회수', w, A.id, V.id, ['attack', 'burst']);
  console.log(`\n  캐스터 잔고 ${a0} → ${w.bal(A.id)},  표적 잔고 ${v0} → ${w.bal(V.id)}`);
  console.log(`  전 풀 합계 = ${w.total()} (${w.total() === WORLD_SOURCE_INITIAL ? '보존 ✓' : '보존 위반 ✗'})`);
}

// ---------------------------------------------------------------------------
// 세계 2 — 파이어볼 = 방출(파괴, feature-0009)
//   원거리(사거리 500), 표적이 먹을 수 없는 상대(size≥). 회수 없음 — 캐스터로 한 푼도 안 온다.
//   표적 잔고를 발사 문턱(cost20+예비60=80) 아래로 두어 반격 못 하게 → 캐스터 한 발만 순수 관측.
// ---------------------------------------------------------------------------
{
  const w = world();
  const A = w.makeCreature(1000, 1000, 500, 1, 900); // 캐스터 size1
  const V = w.makeCreature(1300, 1000, 500, 1, 70);  // 표적 size1(동급=먹을 수 없음), 300px(강탈 밖·방출 안), 반격 불가
  const a0 = w.bal(A.id), v0 = w.bal(V.id);
  for (let i = 0; i < 5; i++) w.game.tick(); // tickCount 4 에서 첫 방출 발화
  console.log(`\n\n[세계 2] 파이어볼 — 캐스터 size1(잔고 ${a0}) 가 원거리(300px) 동급 표적 size1(잔고 ${v0}) 에 발사`);
  report('feature-0009 방출(DISCHARGE/BURST) — 원거리·회수 없음·완전 연소', w, A.id, V.id, ['discharge', 'burst']);
  console.log(`\n  캐스터 잔고 ${a0} → ${w.bal(A.id)},  표적: ${w.game.creatures.has(V.id) ? `잔고 ${w.bal(V.id)}` : '전소해 소멸(잔해 결정 없음)'}`);
  console.log(`  전 풀 합계 = ${w.total()} (${w.total() === WORLD_SOURCE_INITIAL ? '보존 ✓' : '보존 위반 ✗'})`);
}
