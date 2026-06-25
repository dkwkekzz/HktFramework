// HktInfra step-0265 — 헤드리스 검증 (정리 #49 인접·선제: svc-guild 트랜잭션 핸들러 믹스인 분리·svc-guild-txn.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gldsplit`.
//   더한 한 조각: GuildService 의 트랜잭션 핸들러(onMsg: guildCreate/Join/Leave/Transfer/Deposit/Withdraw/Query)를 svc-guild-txn.js 믹스인으로 분리(Object.assign prototype). 정의 위치만 이동·기능 0 → 0264 비트 동일(reg). svc-guild.js 29.5KB→24.0KB(30KB 근접 박스 선제 정리).
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `gldsplit`(가설) — create/join/transfer/deposit/withdraw 후 로스터+금고 정합·single-master 보존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { GuildService } = NET;

// step-0265 정리 분할(#49 인접) 검증 — 길드 트랜잭션 핸들러를 svc-guild-txn 믹스인으로 위임한 뒤,
//   *옮긴 onMsg*(create/join/transfer/deposit/withdraw)가 여전히 로스터+금고를 정합 유지하고 single-master 불변을 지키는지 본다.
function gldsplit(seeds) {
  console.log('== gldsplit (0265 분할·#49 인접): 길드 트랜잭션 핸들러(onMsg)를 svc-guild-txn 믹스인으로 위임 — create/join/transfer/deposit/withdraw 후 로스터+금고 정합·single-master 보존·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | master | members | bank | 정합 | 판정');
  for (const seed of seeds) {
    const g = new GuildService({ bank: true });
    const send = (op) => g.onMsg({ from: 'gw', payload: op });
    send({ type: 'guildCreate', guildId: 'G1', master: 'm1', members: ['m1', 'a', 'b'] });
    send({ type: 'guildJoin', guildId: 'G1', member: 'c' });
    send({ type: 'guildTransfer', guildId: 'G1', from: 'm1', to: 'a' });
    send({ type: 'guildDeposit', guildId: 'G1', member: 'a', itemId: 'i1' });
    send({ type: 'guildDeposit', guildId: 'G1', member: 'b', itemId: 'i2' });
    send({ type: 'guildWithdraw', guildId: 'G1', member: 'a', itemId: 'i1' });
    const master = g.masterOf('G1'), mem = g.membersOf('G1'), bank = g.bankOf('G1');
    const ok = check(master === 'a' && mem.length === 4 && bank.length === 1 && bank[0] === 'i2' && g.rosterConsistent() && g.bankConsistent(),
      `seed ${seed}: 정합 위반 (master ${master}·members ${mem.length}·bank [${bank.join(',')}])`);
    console.log(`${pad(seed, 6)} | ${pad(master || '-', 6)} | ${pad(mem.length, 7)} | ${pad(bank.join(',') || '-', 4)} | ${pad(String(g.rosterConsistent() && g.bankConsistent()), 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gldsplit'] = gldsplit;
kit.ORDER.splice(1, 0, 'gldsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
