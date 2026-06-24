// HktInfra step-0189 — 헤드리스 검증 (마스터 이양·guildTransfer·single-master 보존 쌍 거래)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildtransfer`.
//   더한 한 조각: guildTransfer{guildId,from,to} → from 이 master·to 가 멤버일 때만 master 원자 교체(release+acquire 쌍 거래). from 잔류·로스터 불변·single-master 보존. 거부 시 no-op. 존 핸드오프 0006 의 마스터십 판. 미주입이면 0188 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guildTransfer 미주입 = 0188 비트 동일. ⒝ `guildtransfer`(가설) — 성사 이양 master 교체·from 잔류·로스터 불변·거부 no-op·single-master 보존·영속 replay 후 master 보존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const GCREATE = (at, guildId, master, members) => ({ at, op: { type: 'guildCreate', guildId, master, members } });
const GXFER = (at, guildId, from, to) => ({ at, op: { type: 'guildTransfer', guildId, from, to } });
const COMMON = { clients: 4, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildChangePublish: true, guildPersist: true };
// g1 master x·멤버 [x,c1,c2]. 이양 x→c1(성사)·c9 비멤버 이양(거부)·x 비마스터 이양(거부). 최종 master=c1·로스터 {x,c1,c2}.
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1', 'c2']),
  GXFER(4, 'g1', 'x', 'c1'),     // 성사: master x→c1.
  GXFER(5, 'g1', 'c1', 'c9'),    // 거부: c9 비멤버(no-op).
  GXFER(6, 'g1', 'x', 'c2'),     // 거부: x 더이상 master(no-op).
];

function guildtransfer(seeds) {
  console.log('== guildtransfer: 마스터 이양(release+acquire 쌍 거래). 성사 시 master 원자 교체·from 잔류·로스터 불변·거부 no-op·single-master 보존. 존 핸드오프 0006 의 마스터십 판. ==');
  console.log('seed   | transfers | 최종 master | from 잔류 | 로스터 | persist master | single-master | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...COMMON, guildOps: OPS });
    const g1 = r.guild.guilds.get('g1');
    const masterOk = g1.master === 'c1';                     // x→c1 성사·이후 거부.
    const fromStays = g1.members.includes('x');              // 옛 master x 멤버 잔류.
    const rosterOk = g1.members.slice().sort().join(',') === 'c1,c2,x';   // 로스터 크기 불변(이양은 멤버 안 바꿈).
    const singleMaster = g1.members.includes(g1.master) && new Set(g1.members).size === g1.members.length;
    // 영속: 이양도 저널에 → crash→reconstruct 후 master 보존.
    r.guild.crash(); r.guild.reconstruct();
    const persistOk = r.guild.guilds.get('g1').master === 'c1';
    const ok =
      check(masterOk && fromStays && rosterOk, `seed ${seed}: 이양 결과 어긋남 (master ${g1.master}·roster ${g1.members})`) &&
      check(singleMaster, `seed ${seed}: single-master 위반`) &&
      check(persistOk, `seed ${seed}: reconstruct 후 master 유실`);
    console.log(`${pad(seed, 6)} | ${pad(r.guild.transfers, 9)} | ${pad(g1.master, 11)} | ${pad(fromStays ? '예' : '아니오', 9)} | ${pad(g1.members.slice().sort().join(','), 6)} | ${pad(persistOk ? 'c1' : '유실', 14)} | ${pad(singleMaster ? '예' : '아니오', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 마스터 이양은 권위 이동의 정전 쌍 거래(release+acquire)다: from 이 현재 master·to 가 멤버일 때만 master 를 원자 교체(공백 0·이중 0). from 은 일반 멤버로 잔류해 로스터 크기 불변. 거부(to 비멤버·from 비마스터)는 no-op → single-master 불변(척추 ③) 항상 보존. 이양도 저널에 기록돼 crash→reconstruct 후 master 보존. 존 핸드오프 0006·escrow 0117 의 마스터십 판.');
}

kit.MODES['guildtransfer'] = guildtransfer;
kit.ORDER.splice(1, 0, 'guildtransfer');

(async () => { process.exit(await kit.cli(process.argv)); })();
