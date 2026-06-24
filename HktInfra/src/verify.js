// HktInfra step-0182 — 헤드리스 검증 (길드 증분 가입/탈퇴·guildJoin/guildLeave·멱등·master 보호)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildjoin`.
//   더한 한 조각: guildJoin{guildId,member}(증분 추가·멱등)·guildLeave{guildId,member}(증분 제거·멱등·master 탈퇴 no-op). 파티 0084 의 길드 판. 증분 명령 미주입이면 0181 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guild 미주입 = 0181 비트 동일. ⒝ `guildjoin`(가설) — 증분 가입/탈퇴 정확·멱등(중복 가입/없는 탈퇴 no-op)·master 보호(master 탈퇴 거부)·single-master 보존.
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
const COMMON = { clients: 4, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true };
// g1 master x, 멤버 x/c1. 증분: c2 가입·c1 가입(멱등 중복)·c1 탈퇴·c9 탈퇴(없음 no-op)·x 탈퇴(master 거부). 최종 로스터 = [x, c2].
const OPS = [
  GCREATE(3, 'g1', 'x', ['x', 'c1']),
  GJOIN(5, 'g1', 'c2'), GJOIN(6, 'g1', 'c1'),     // c2 추가 / c1 중복(no-op)
  GLEAVE(7, 'g1', 'c1'), GLEAVE(8, 'g1', 'c9'),   // c1 제거 / c9 없음(no-op)
  GLEAVE(9, 'g1', 'x'),                            // master x 탈퇴(거부·no-op)
];

function guildjoin(seeds) {
  console.log('== guildjoin: 증분 가입/탈퇴(guildJoin/guildLeave). 멱등(중복 가입·없는 탈퇴 no-op)·master 보호(master 탈퇴 거부)·single-master 보존. 파티 0084 의 길드 판. ==');
  console.log('seed   | join/leave 호출 | 최종 로스터 | master 유지 | 멱등+보호 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...COMMON, guildOps: OPS });
    const g = r.guild;
    const g1 = g.guilds.get('g1');
    const roster = g1.members.slice().sort();
    // 기대 최종 로스터: master x + c2(c1 가입 후 탈퇴·중복/없는 탈퇴 no-op·master 탈퇴 거부).
    const rosterOk = JSON.stringify(roster) === JSON.stringify(['c2', 'x']);
    const masterOk = g1.master === 'x' && g1.members.includes('x');
    const counts = g.joins === 2 && g.leaves === 3;   // 호출 수(no-op 포함): join 2·leave 3.
    const singleMaster = [...g.guilds.values()].every(x => x.members.includes(x.master) && new Set(x.members).size === x.members.length);
    const ok =
      check(rosterOk, `seed ${seed}: 최종 로스터 != [x,c2] (실제 ${JSON.stringify(roster)})`) &&
      check(masterOk, `seed ${seed}: master 유실(탈퇴 거부 실패)`) &&
      check(counts, `seed ${seed}: join/leave 계측 어긋남`) &&
      check(singleMaster, `seed ${seed}: single-master 불변 위반`);
    console.log(`${pad(seed, 6)} | ${pad(g.joins + '/' + g.leaves, 15)} | ${pad(JSON.stringify(roster), 11)} | ${pad(masterOk ? '예' : '아니오', 11)} | ${pad((rosterOk && masterOk) ? '예' : '아니오', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 증분 가입/탈퇴는 전체 로스터 덮어쓰기 없이 한 멤버 델타만 적용한다. 멱등: 중복 가입·없는 멤버 탈퇴는 no-op(상태 불변). master 보호: master 의 guildLeave 는 거부(no-op) → 마스터 공백 없음(single-master 불변·척추 ③). 마스터 이양(0189)이 master 교체 경로. 파티 0084 의 길드 판.');
}

kit.MODES['guildjoin'] = guildjoin;
kit.ORDER.splice(1, 0, 'guildjoin');

(async () => { process.exit(await kit.cli(process.argv)); })();
