// HktInfra step-0208 — 헤드리스 검증 (월드 영속 replay 재구성·crash→로그 replay 무손실)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `worldreplay`.
//   더한 한 조각: WorldLog.replay — durable intent 로그 전수 재적용 → 월드 상태 투영 복원. crash(투영 소실) 후 로그만으로 동일 상태(event sourcing). worldLog OFF → 0206 비트 동일(reg).
//   검증: ⒜ `reg`(키트). ⒝ `worldreplay`(가설) — append 4 → replay 상태 vs crash 후 replay 상태 digest 동일·h1 pos 6/sword·h2 pos 8.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const APPEND = (at, intent) => ({ at, op: { type: 'worldAppend', intent } });
const OPS = [
  APPEND(2, { kind: 'move', e: 'h1', to: 5 }), APPEND(3, { kind: 'move', e: 'h2', to: 8 }),
  APPEND(4, { kind: 'pickup', e: 'h1', item: 'sword' }), APPEND(5, { kind: 'move', e: 'h1', to: 6 }),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true, worldOps: OPS };

function worldreplay(seeds) {
  console.log('== worldreplay: 월드 영속 replay 재구성 — durable intent 로그 전수 재적용 → 월드 상태 투영 복원. crash(투영 소실) 후에도 로그만으로 동일 상태(event sourcing·복제=재현). ==');
  console.log('seed   | digest(pre) | digest(post-crash replay) | 무손실 | h1 pos/items | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const w = r.worldlog;
    w.replay();                       // 로그→투영 재구성.
    const pre = w.stateDigest();
    w.crash();                        // 투영 소실(로그는 durable).
    w.replay();                       // 로그만으로 재구성.
    const post = w.stateDigest();
    const h1 = w.stateOf('h1'), h2 = w.stateOf('h2');
    const lossless = pre === post;
    const ok = check(lossless && h1 && h1.pos === 6 && h1.items.join(',') === 'sword' && h2 && h2.pos === 8,
      `seed ${seed}: replay 위반 (pre ${pre}·post ${post}·h1 ${JSON.stringify(h1)})`);
    console.log(`${pad(seed, 6)} | ${pad(pre, 11)} | ${pad(post, 25)} | ${pad(lossless ? '예' : '아니오', 6)} | ${pad((h1 ? h1.pos + '/' + h1.items.join('') : '-'), 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → WorldLog.replay 가 durable 로그를 전수 재적용해 투영(h1 pos 6+sword·h2 pos 8) 복원. crash 로 투영이 소실돼도 *로그가 살아남아* 동일 digest 로 재구성 — 월드 상태는 DB 행이 아니라 로그로 산다(event sourcing 의 무손실 복구·복제=재현). 월드 영속 박스 기본 통신 완비(append 0207 + replay 0208).');
}

kit.MODES['worldreplay'] = worldreplay;
kit.ORDER.splice(1, 0, 'worldreplay');

(async () => { process.exit(await kit.cli(process.argv)); })();
