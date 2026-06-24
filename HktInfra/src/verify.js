// HktInfra step-0190 — 헤드리스 검증 (길드 정합 capstone·rosterConsistent·single-master·arc 0181~0190 닫기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildcapstone`.
//   더한 한 조각: rosterConsistent() = 전 길드 single-master 불변(공백 0·master∈members·중복 0). feedConsistent(0188)와 결합해 모든 연산(create/join/leave/transfer)·체제(정상·guild crash·feed crash)서 성립. 순수 읽기(권위 0) → 0189 비트 동일(reg). 거래소 0140·우편 0180 capstone 의 길드 판.
//   검증: ⒜ `reg`(키트) — 0189 비트 동일. ⒝ `guildcapstone`(가설) — 풍부한 시나리오(가입/탈퇴/이양)×세 체제서 rosterConsistent AND feedConsistent true.
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
const GJOIN = (at, guildId, member) => ({ at, op: { type: 'guildJoin', guildId, member } });
const GLEAVE = (at, guildId, member) => ({ at, op: { type: 'guildLeave', guildId, member } });
const GXFER = (at, guildId, from, to) => ({ at, op: { type: 'guildTransfer', guildId, from, to } });
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildChangePublish: true, guildFeed: true, guildPersist: true, guildFeedPersist: true };
// 풍부한 시나리오: 두 길드 결성·가입·탈퇴·마스터 이양(성사+거부 섞임).
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1']), GCREATE(3, 'g2', 'c4', ['c4', 'c6']),
  GJOIN(5, 'g1', 'c2'), GJOIN(6, 'g1', 'c3'), GLEAVE(7, 'g1', 'c1'),
  GXFER(8, 'g1', 'x', 'c2'),         // g1 master x→c2(성사).
  GLEAVE(9, 'g1', 'c2'),             // 새 master c2 탈퇴 거부(master 보호·no-op).
  GJOIN(10, 'g2', 'c5'), GXFER(11, 'g2', 'c4', 'c9'),   // g2 이양 거부(c9 비멤버).
];

function guildcapstone(seeds) {
  console.log('== guildcapstone: *capstone* — single-master 불변(rosterConsistent)+배지 정합(feedConsistent). 가입/탈퇴/이양 × 정상·guild crash·feed crash 세 체제. 거래소 0140·우편 0180 의 길드 판. arc 0181~0190 닫기. ==');
  console.log('seed   | g1 master | g2 master | A 정상 | B guild crash | C feed crash | 3체제 정합 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 13, ...COMMON, guildOps: OPS });
    const A = r.guild.rosterConsistent() && r.guildfeed.feedConsistent(r.guild);   // A 정상.
    r.guild.crash(); r.guild.reconstruct();
    const B = r.guild.rosterConsistent() && r.guildfeed.feedConsistent(r.guild);   // B guild crash→reconstruct.
    r.guildfeed.crash(); r.guildfeed.reconstruct();
    const C = r.guild.rosterConsistent() && r.guildfeed.feedConsistent(r.guild);   // C feed crash→reconstruct.
    const g1m = r.guild.masterOf('g1'), g2m = r.guild.masterOf('g2');
    const shapeOk = g1m === 'c2' && g2m === 'c4';   // g1 이양 성사·g2 이양 거부.
    const all3 = A && B && C && shapeOk;
    const ok = check(all3, `seed ${seed}: capstone 위반 (A${A} B${B} C${C}·g1m ${g1m}·g2m ${g2m})`);
    console.log(`${pad(seed, 6)} | ${pad(g1m, 9)} | ${pad(g2m, 9)} | ${pad(A ? '예' : '아니오', 6)} | ${pad(B ? '예' : '아니오', 13)} | ${pad(C ? '예' : '아니오', 12)} | ${pad(all3 ? '예(3/3)' : '아니오', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 길드 박스 전체를 관통하는 척추 ③ 권위 단일 소유의 길드 불변: rosterConsistent(모든 길드 정확히 한 master·master∈members·중복 0) AND feedConsistent(배지==로스터·0188). 풍부한 연산(create/join/leave/transfer)·세 체제(정상·guild crash→reconstruct·feed crash→reconstruct) 모두서 성립 → 길드 박스가 어떤 연산·고장에도 single-master 를 깨지 않고 읽기 모델이 SSOT 와 갈라지지 않음을 증명. 거래소 0140·우편 0180 capstone 의 길드 판 — **guild arc(0181~0190) 닫힘**(SPINE 계층3 길드 박스 골격 완성).');
}

kit.MODES['guildcapstone'] = guildcapstone;
kit.ORDER.splice(1, 0, 'guildcapstone');

(async () => { process.exit(await kit.cli(process.argv)); })();
