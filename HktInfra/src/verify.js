// HktInfra step-0142 — 헤드리스 검증 (우편 서비스 분리·MailService — 오프라인 비동기 배송 박스 입금)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: SPINE §2 게임 서비스 *우편*(⬜→🟡). 귓속말(0071~)이 온라인 라우팅이면 우편은 오프라인 배송 — 발신자가 수신자 우편함에 입금(mailSend)하면 수신자가 나중에 수령(0143~). 0142 는 입금 + 우편함(recipient별 Map) 만.
//   검증: ⒜ `reg`(키트) — mail OFF = 0141 비트 동일(박스 0·주입 0). ⒝ `exmail`(가설) — mailSend 입금이 수신자별 우편함에 정확히 적재(sent==입금 통수·held(rcpt)==그 수신자 통수·멱등 재전송 0 이중 적재)·결정론(시드 무관 digest 안정).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

// 우편 입금 op — at tick 에 발신자→수신자 우편함 적재. id 명시(회계 안정·멱등 재전송 검증용).
const SEND = (at, id, from, to, body) => ({ at, op: { type: 'mailSend', id, from, to, body } });
const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, mail: true, ...extra });

function exmail(seeds) {
  console.log('== exmail: 우편 서비스 입금(MailService·mailSend) — 발신자가 수신자 우편함에 우편 1통을 오프라인 적재(수신자 접속 무관). sent==입금 통수·held(rcpt)==그 수신자 보유·멱등 재전송 0 이중 적재·결정론 digest. ==');
  console.log('seed   | sent | held(h1) | held(h3) | totalHeld | dup-재전송 멱등 | digest 결정론 | 판정');
  let digest0 = null;
  for (const seed of seeds) {
    // 5통 입금: h1←(h0,h2,h4 세 통)·h3←(h0 한 통)·dup: m_dup 를 두 번(멱등). 총 distinct 4통 → totalHeld 4.
    const ops = [
      SEND(10, 'm0', 'hero0', 'hero1', 'hi'),
      SEND(12, 'm1', 'hero2', 'hero1', 'yo'),
      SEND(14, 'm_dup', 'hero4', 'hero1', 'dup'),
      SEND(16, 'm_dup', 'hero4', 'hero1', 'dup'),   // 같은 id 재전송 — 멱등(이중 적재 0)
      SEND(18, 'm3', 'hero0', 'hero3', 'sup'),
    ];
    const r = run({ ...base(seed, { mailOps: ops }) });
    const mail = r.mail;
    const sent = mail.sent;             // 멱등 폐기는 sent++ 전이라 sent==distinct 입금 4
    const h1 = mail.held('hero1');      // m0·m1·m_dup = 3
    const h3 = mail.held('hero3');      // m3 = 1
    const total = mail.totalHeld();     // 4
    const dig = mail.digest();
    if (digest0 == null) digest0 = dig; const detOk = (dig === digest0);   // mail 은 난수 무관 → 전 시드 digest 동일(결정론)
    const dupOk = (sent === 4 && h1 === 3);   // 멱등: 5회 발신 중 1회 중복 폐기 → sent 4·h1 3
    const ok =
      check(sent === 4, `seed ${seed}: sent ${sent}!=4`) &&
      check(h1 === 3 && h3 === 1, `seed ${seed}: held h1=${h1}(≠3) h3=${h3}(≠1)`) &&
      check(total === 4, `seed ${seed}: totalHeld ${total}!=4`) &&
      check(dupOk, `seed ${seed}: 멱등 재전송 실패(sent ${sent}·h1 ${h1})`) &&
      check(detOk, `seed ${seed}: digest 비결정론(${dig.toString(16)}≠${digest0.toString(16)})`);
    console.log(`${pad(seed, 6)} | ${pad(sent, 4)} | ${pad(h1, 8)} | ${pad(h3, 8)} | ${pad(total, 9)} | ${pad(dupOk ? '예' : '아니오', 15)} | ${pad(detOk ? '예' : '아니오', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 우편함은 *권위 단일 소유*(MailService)·오프라인 배송(수신자 접속 무관·세계가 세션보다 오래)·존 tick 밖(신성한 tick). 같은 id 재전송은 멱등(이중 적재 0 — 재전송 신뢰성 0145~ 의 토대). mail OFF = 0141 비트 동일(reg).');
  console.log('    다음(0143): 수령(mailFetch) — 수신자가 우편함을 pull, 무손실로 held→fetched 이동(읽음 표시). 회계 sent==held+fetched 로 확장.');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
