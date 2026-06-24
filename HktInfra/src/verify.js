// HktInfra step-0207 — 헤드리스 검증 (월드 영속 박스·intent 로그 append·worldLog/worldAppend)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `worldappend`.
//   더한 한 조각: WorldLog 박스 — 월드 상태의 유일 쓰기 경로(intent·SPINE §4 경로1)를 durable 로그로 event sourcing(데이터 3분할 ①). worldLog OFF → 박스 0 → 0206 비트 동일(reg). replay 재구성은 0208.
//   검증: ⒜ `reg`(키트). ⒝ `worldappend`(가설) — intent 4 append → 로그 길이 4·seq 단조 1~4·at(2) 복원.
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
// 시나리오: 월드 intent 4개(이동·이동·픽업·이동) 적층.
const OPS = [
  APPEND(2, { kind: 'move', e: 'h1', to: 5 }), APPEND(3, { kind: 'move', e: 'h2', to: 8 }),
  APPEND(4, { kind: 'pickup', e: 'h1', item: 'sword' }), APPEND(5, { kind: 'move', e: 'h1', to: 6 }),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true, worldOps: OPS };

function worldappend(seeds) {
  console.log('== worldappend: 월드 영속 박스 — intent 로그 append 기본. 세계 상태의 유일 쓰기 경로(intent)를 durable 로그로 event sourcing(로그만으로 재구성·복제=재현). 서비스 저널·캐시와 직교(데이터 3분할). ==');
  console.log('seed   | 로그 길이 | seq 단조 | at(2) | appends | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const w = r.worldlog, len = w.length();
    const seqs = w.journal.map(e => e.seq);
    const mono = seqs.every((s, i) => s === i + 1);
    const at2 = w.at(2);
    const ok = check(len === 4 && mono && at2 && at2.kind === 'move' && at2.e === 'h2' && w.appends === 4,
      `seed ${seed}: 월드로그 위반 (len ${len}·mono ${mono}·appends ${w.appends})`);
    console.log(`${pad(seed, 6)} | ${pad(len, 9)} | ${pad(mono ? '예' : '아니오', 8)} | ${pad(at2 ? at2.kind + ':' + at2.e : '-', 7)} | ${pad(w.appends, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → WorldLog 가 월드 intent 를 append-only 로그로 적층(seq 단조 1~4·길이 4). 월드 상태는 DB 행이 아니라 *intent 로그*로 산다(event sourcing·결정론 덕에 로그+시드만으로 상태 재구성=복제). 데이터 3분할 ①. 기본 통신 — replay 재구성은 0208.');
}

kit.MODES['worldappend'] = worldappend;
kit.ORDER.splice(1, 0, 'worldappend');

(async () => { process.exit(await kit.cli(process.argv)); })();
