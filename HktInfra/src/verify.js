// HktInfra step-0181 — 헤드리스 검증 (길드 서비스 분리·guildService·GuildService)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guild`.
//   더한 한 조각: GuildService = 길드 로스터+마스터십 SSOT(존 tick 밖·onTick 없음). guildCreate{guildId,master,members}→로스터 쓰기(master∈members 보장)·guildQuery→guildRoster 회신(request/reply). single-master 불변(매 길드 정확히 한 master·권위 단일 소유). 파티 0075 의 *영속 조직* 판. guildService OFF → 박스 0 = 0180 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guildService 미설정 = 0180 비트 동일. ⒝ `guild`(가설) — 결성된 길드의 single-master 불변·master∈members·질의 회신==SSOT·결정론.
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
const GQUERY = (at, guildId, from) => ({ at, from, op: { type: 'guildQuery', guildId } });
const COMMON = { clients: 4, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true };
// 두 길드 결성(g1: master x·멤버 x/c1/c2 · g2: master c3·멤버 c3/c1) + 질의. master 중복/누락은 normalize 가 흡수.
const GUILDS = [
  GCREATE(3, 'g1', 'x', ['x', 'c1', 'c2']),
  GCREATE(4, 'g2', 'c3', ['c3', 'c1']),
  GQUERY(8, 'g1', 'client0'), GQUERY(9, 'g2', 'client0'),
];

function guild(seeds) {
  console.log('== guild: 길드 로스터+마스터십 SSOT. single-master 불변(매 길드 정확히 한 master·master∈members·권위 단일 소유) + 질의 회신==SSOT. 파티 0075 의 영속 조직 판. ==');
  console.log('seed   | 길드 수 | g1 master/멤버 | g2 master/멤버 | 질의/회신 | single-master | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...COMMON, guildOps: GUILDS });
    const g = r.guild;
    // single-master 불변: 모든 길드는 master 1개 + master ∈ members + 멤버 중복 0.
    const singleMaster = [...g.guilds.values()].every(x =>
      x.master != null && x.members.includes(x.master) && new Set(x.members).size === x.members.length);
    // 질의 회신(net.log 의 guildRoster) == SSOT.
    const replies = r.net.log.filter(m => m.payload && m.payload.type === 'guildRoster');
    const replyOk = replies.length === 2 && replies.every(rep => {
      const ssot = g.guilds.get(rep.payload.guildId);
      return ssot && rep.payload.master === ssot.master &&
        JSON.stringify(rep.payload.members) === JSON.stringify(ssot.members);
    });
    const g1 = g.guilds.get('g1'), g2 = g.guilds.get('g2');
    const shapes = g.guilds.size === 2 &&
      g1.master === 'x' && g1.members.length === 3 &&
      g2.master === 'c3' && g2.members.length === 2 &&
      g.queriesRx === 2 && g.repliesSent === 2;
    const ok =
      check(singleMaster, `seed ${seed}: single-master 불변 위반`) &&
      check(replyOk, `seed ${seed}: 질의 회신 != SSOT`) &&
      check(shapes, `seed ${seed}: 기대 로스터/계측 어긋남`);
    console.log(`${pad(seed, 6)} | ${pad(g.guilds.size, 7)} | ${pad(g1.master + '/' + g1.members.length, 14)} | ${pad(g2.master + '/' + g2.members.length, 14)} | ${pad(g.queriesRx + '/' + g.repliesSent, 9)} | ${pad(singleMaster ? '예' : '아니오', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 길드는 *오래 사는 명명된 조직*: 마스터(단일 권위 소유자·척추 ③)가 결성하고 로스터를 보유한다. 존 tick 밖 순수 반응형(onTick 없음). 질의 회신은 SSOT 와 일치(은닉: 소비자는 저장 방식 모름·질의 계약만). 파티(0075 수명 짧은 그룹)의 영속 판 — 증분 가입/탈퇴·발행·영속·배지·마스터 이양은 후속(arc 0181~0190).');
}

kit.MODES['guild'] = guild;
kit.ORDER.splice(1, 0, 'guild');

(async () => { process.exit(await kit.cli(process.argv)); })();
