// HktInfra step-0227 — 헤드리스 검증 (월드 영속 write-behind 버퍼·worldBuffer/worldFlush)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `worldwb`.
//   더한 한 조각: worldBuffer{intent}→버퍼(비-durable), worldFlush→버퍼를 durable 로그에 일괄 적층(쓰기 지연·배치). 미flush 분은 로그에 없음(crash 윈도). 미주입 → 0226 비트 동일(reg). 3차 고도화 월드영속 #1.
//   검증: ⒜ `reg`(키트). ⒝ `worldwb`(가설) — 2 intent 버퍼→flush→로그 2·버퍼 0, 추가 1 버퍼→로그 불변·replay 가 미flush 분 미반영.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const BUF = (at, intent) => ({ at, op: { type: 'worldBuffer', intent } });
const FLUSH = (at) => ({ at, op: { type: 'worldFlush' } });
// e1·e2 move 버퍼링 → flush(로그 2·버퍼 0) → e1 pickup gold 버퍼(미flush) → 로그 2 불변·replay 가 gold 미반영.
const OPS = [
  BUF(1, { e: 'e1', kind: 'move', to: 11 }), BUF(2, { e: 'e2', kind: 'move', to: 22 }),
  FLUSH(3),
  BUF(4, { e: 'e1', kind: 'pickup', item: 'gold' }),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true, worldOps: OPS };

function worldwb(seeds) {
  console.log('== worldwb: 월드 영속 write-behind 버퍼(worldBuffer/worldFlush) — intent 를 버퍼에 모았다 flush 로 durable 로그에 일괄 적층(쓰기 지연·배치·매 intent 디스크 안 때림=신성한 tick 보호). flush 전(버퍼)은 비-durable — crash 시 소실(write-behind 의 본질적 윈도). 3차 고도화 월드영속 #1. ==');
  console.log('seed   | 로그 | 버퍼 | flushed | e1 gold | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const w = r.worldlog;
    w.replay();                                   // durable 로그만 재구성(미flush 버퍼 제외).
    const e1 = w.stateOf('e1');
    const gold = !!(e1 && e1.items.includes('gold'));
    // flush 로 로그 2·버퍼 0·flushed 2 → 추가 pickup 은 버퍼(1)만(미flush) → 로그 2 불변·replay 에 gold 없음(비-durable).
    const ok = check(w.length() === 2 && w.bufferLength() === 1 && w.flushed === 2 && !gold && e1 && e1.pos === 11,
      `seed ${seed}: write-behind 위반 (로그 ${w.length()}·버퍼 ${w.bufferLength()}·flushed ${w.flushed}·gold ${gold})`);
    console.log(`${pad(seed, 6)} | ${pad(w.length(), 4)} | ${pad(w.bufferLength(), 4)} | ${pad(w.flushed, 7)} | ${pad(gold ? 'yes' : 'no', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 2 intent 를 버퍼링 후 flush 하면 durable 로그 2·버퍼 0(배치 쓰기). 그 뒤 pickup gold 는 버퍼(1)에만 남아(미flush) durable 로그는 2로 불변, replay 에도 gold 미반영 — flush 안 된 분은 비-durable(crash 윈도). 쓰기를 지연·배치해 매 intent 가 디스크를 안 때린다. 월드영속 3차 고도화 #1.');
}

kit.MODES['worldwb'] = worldwb;
kit.ORDER.splice(1, 0, 'worldwb');

(async () => { process.exit(await kit.cli(process.argv)); })();
