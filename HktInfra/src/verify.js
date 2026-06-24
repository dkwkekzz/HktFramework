// HktInfra step-0183 — 헤드리스 검증 (길드 멤버십 변경 발행·guildChangePublish·svc.guild.changed)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildpub`.
//   더한 한 조각: 실 멤버십 변경(가입/탈퇴) 시 svc.guild.changed{guildId,kind,member} 버스 발행 → audit 가 구독(발행자 무수정 소비자). no-op 변경은 발행 안 함. 파티 0084 의 길드 판. guildChangePublish OFF·bus 부재면 발행 0 = 0182 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guildChangePublish OFF = 0182 비트 동일. ⒝ `guildpub`(가설) — published==실 변경 수==audit 수신, no-op 변경(중복/없음/master) 발행 0, OFF 발행 0(비-침습).
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
const COMMON = { clients: 4, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true, guildService: true };
// 실 변경 3건(c2 가입·c3 가입·c2 탈퇴) + no-op 3건(c3 중복가입·c9 없는탈퇴·x master탈퇴). 발행은 실 변경 3건만.
const OPS = [
  GCREATE(3, 'g1', 'x', ['x']),
  GJOIN(5, 'g1', 'c2'), GJOIN(6, 'g1', 'c3'), GJOIN(7, 'g1', 'c3'),   // c2·c3 실가입 / c3 중복(no-op)
  GLEAVE(8, 'g1', 'c2'), GLEAVE(9, 'g1', 'c9'), GLEAVE(10, 'g1', 'x'),  // c2 실탈퇴 / c9 없음(no-op) / x master(거부 no-op)
];

function guildpub(seeds) {
  console.log('== guildpub: 멤버십 변경 발행(svc.guild.changed). published==실 변경==audit 수신, no-op 변경(중복/없음/master) 발행 0. 파티 0084 의 길드 판. ==');
  console.log('seed   | published | audit 수신 | OFF published | 실변경==발행==수신 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 14, ...COMMON, guildChangePublish: true, guildOps: OPS });
    const off = run({ seed, ticks: 14, ...COMMON, guildChangePublish: false, guildOps: OPS });
    const auditCnt = on.audit.seen.get('svc.guild.changed') || 0;
    const pubOk = on.guild.published === 3 && auditCnt === 3;   // 실 변경 3건만 발행·수신.
    const offOk = off.guild.published === 0 && !(off.audit.seen.get('svc.guild.changed'));   // OFF 발행 0(비-침습).
    const ok =
      check(pubOk, `seed ${seed}: published/audit != 3 (pub ${on.guild.published}·audit ${auditCnt})`) &&
      check(offOk, `seed ${seed}: OFF 인데 발행 발생(비-침습 위반)`);
    console.log(`${pad(seed, 6)} | ${pad(on.guild.published, 9)} | ${pad(auditCnt, 10)} | ${pad(off.guild.published, 13)} | ${pad(pubOk ? '예(3/3/3)' : '아니오', 18)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 멤버십 변경을 버스로 노출(svc.guild.changed)해 발행자 무수정 소비자(audit·배지 0186)가 반응한다. 발행 수 == 실 변경 수 == audit 수신(no-op 변경은 발행 안 함 = 발행이 곧 사실). guildChangePublish OFF 면 발행 0(0182 비트 동일·비-침습). 파티 0084 의 길드 판 — 0186 GuildFeed 배지가 이 스트림을 구독한다.');
}

kit.MODES['guildpub'] = guildpub;
kit.ORDER.splice(1, 0, 'guildpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
