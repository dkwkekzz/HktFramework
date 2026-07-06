'use strict';
// step-0200 — 길드 금고 arc capstone(bankCapstone·원장+배지 정합 결합·arc 0191~0200 닫기): 0191~0199 에서 길드 금고 박스를 완성했다(예치·인출·발행·영속·스냅샷·배지·배지영속·배지정합·원장정합). 이 step 은 금고 박스 전체를 관통하는 *두 정합층*을 한 진입점으로 결합 단언한다 — bankCapstone(feed) = bankConsistent()(원장 권위 단일 소유·itemId 이중 소유 0·0199) AND feed.bankFeedConsistent(this)(읽기 모델 배지==vault·0198). 풍부한 연산(create/join/deposit/withdraw×두 길드)·세 체제(정상·guild crash→reconstruct·feed crash→reconstruct) 모두서 성립 → 금고 박스가 어떤 연산·고장에도 아이템 권위를 깨지 않고 읽기 모델이 SSOT 와 갈라지지 않음. 거래소 0140·우편 0180·길드 0190 capstone 의 *금고* 판. **guild bank arc(0191~0200) 닫기**. 순수 읽기(권위 0) → 0199 비트 동일(reg). 계층: 3 게임 서비스.
// step-0199 — 길드 금고 원장 정합(bankConsistent·itemId 단일 길드 소유): 0191~0198 에서 금고 박스(예치·인출·발행·영속·스냅샷·배지·배지영속·배지정합)를 세웠다. 이 step 은 금고 원장(vault)의 *척추 ③ 권위 단일 소유*를 명시 단언한다 — bankConsistent(): 어떤 itemId 도 두 길드 금고에 동시에 있지 않고(이중 소유 0·교차 중복 0)·한 금고 안에서 중복 0. rosterConsistent(0190)가 master 권위를 단언하듯, bankConsistent 는 *아이템 권위*를 단언한다. 순수 읽기(권위 0·실행 경로 무변경) → 0198 비트 동일(reg). 거래소 escrow 보존 0120·우편 escrow 0164 의 길드 금고 판.
// step-0195 — 길드 금고 저널 스냅샷 압축(guildSnapshot 의 금고 확장): 0194 의 금고 저널은 *무계 성장*이라 예치/인출이 누적될수록 replay 비용·메모리가 ∝변경 수다(0194 한계). 0185 가 로스터 projection 을 주기 스냅샷+tail replay 로 압축한 그 메커니즘을 vault 에 확장한다: 스냅샷에 로스터뿐 아니라 *vault 도* 담고(bank: [[guildId,[itemId...]]...]), 그 이하 저널은 가지치기 → 저널은 마지막 스냅샷 이후 tail 만 보관(유계). reconstruct 는 스냅샷의 guilds+bank 에서 출발해 tail(seq>upToSeq)만 replay → 전체 저널 replay 와 비트 동일(무손실 압축). guildSnapshot 0(snapInterval 0)이면 압축 0·저널 무계 = 0194 비트 동일(reg).
// step-0194 — 길드 금고 영속·failover(guildPersist 의 금고 확장·변경 저널 replay): 0191~0193 의 금고(vault)는 *휘발*이라 박스 crash 시 예치된 아이템이 전부 소실됐다(영속 0·0193 한계). 0184 가 로스터/마스터십을 변경 저널로 영속시킨 그 메커니즘을 금고에 확장한다: 예치/인출 성사를 *변경 저널*(durable)에 append(kind 'deposit'/'withdraw'), crash(vault 소실) 후 fresh GuildService 가 저널을 seq 순 replay 해 vault projection 을 재구성 → 죽기 전과 비트 동일. crash 가 vault 도 비우고 reconstruct 가 vault 도 복원(로스터와 같은 저널·같은 replay 루프). guildPersist OFF 면 저널 0·crash 후 빈 금고(소실) = 0193 비트 동일(reg).
// step-0193 — 길드 금고 변경 발행(guildBankPublish·svc.guild.bank.changed): 0191~0192 의 예치/인출은 *관측 불가*였다 — 금고에 무엇이 들고 났는지 스트림이 0이었다(0192 한계). 다른 시스템(금고 UI 배지·감사·길드 로그)이 금고 변동을 구독해야 한다. 거래소 체결 발행(0108)·길드 멤버십 변경 발행(0183)의 금고 판: 실제 변경(예치 성사·인출 성사) 시 svc.guild.bank.changed{guildId,kind:deposit|withdraw,itemId,member} 를 버스로 발행 → 발행자 무수정 소비자(audit)가 반응. no-op(중복 예치·없는 인출·비멤버)은 발행 안 함(발행==실 변경). bankPublish OFF·bus 부재면 발행 0 = 0192 비트 동일(reg).
// step-0192 — 길드 금고 withdraw(guildWithdraw): 0191 의 예치(deposit)는 *입금 전용*이라 길드 금고가 단조 증가만 했다 — 멤버가 금고에서 아이템을 도로 꺼낼 길이 없었다(0191 한계). 인출을 더한다: guildWithdraw{guildId,member,itemId} → 금고에 그 itemId 가 있고 요청자가 멤버일 때만 제거(없으면/비멤버면 멱등·graceful no-op). 거래소 buy leg(0118)·우편 fetch(0158)의 길드 금고 판. bank OFF·미주입이면 0191 비트 동일(reg).
// step-0191 — 길드 금고(Guild Bank) deposit(guildBank·guildDeposit): 0181~0190 에서 길드 박스(로스터+마스터십)를 완성했다. 이 arc(0191~0200)는 길드의 *공유 아이템 원장*(금고/vault)을 키운다 — 멤버가 아이템을 길드 금고에 예치/인출하는, 거래소 escrow(0117)·우편 아이템 custody(0157)의 *조직 공유* 판. 첫 조각: guildDeposit{guildId, member, itemId} → 금고가 itemId 를 보유(vault: guildId→[itemId]·집합 의미론·중복 무시 멱등). single-master 와 직교(권위=금고 원장). bank OFF·미주입이면 금고 0 = 0190 비트 동일(reg). 계층: 3 게임 서비스.
// step-0190 — 길드 정합 capstone(rosterConsistent·single-master 불변·arc 0181~0190 닫기): 0181~0189 에서 길드 박스를 세웠다(로스터 SSOT·증분·발행·영속·스냅샷·배지·feed 영속·정합·마스터 이양). 이 step 은 박스 전체를 관통하는 *척추 ③ 권위 단일 소유*의 길드 불변을 명시 단언한다 — rosterConsistent(): 모든 길드는 정확히 한 master(공백 0)·master ∈ members(고아 마스터 0)·멤버 중복 0. 모든 연산(create/join/leave/transfer)·모든 체제(정상·guild crash→reconstruct·feed crash→reconstruct)서 성립 + feedConsistent(0188 배지==로스터)와 결합 → 길드 박스가 결코 single-master 를 깨지 않음을 증명. 순수 읽기(권위 0·실행 경로 무변경) → 0189 비트 동일(reg). 거래소 0140·우편 0180 capstone 의 길드 판.
// step-0189 — 마스터 이양(guildTransfer·single-master 보존 쌍 거래): 0182 master 보호는 마스터를 *영구 고정*했다 — 마스터가 길드를 떠나거나 위임할 길이 없었다(0182 한계). 권위 이동의 정전 패턴(release+acquire 쌍 거래·SPINE §5 ③·존 핸드오프 0006·escrow 거래 0117 의 *마스터십* 판)을 길드에 적용한다: guildTransfer{guildId,from,to} → from 이 현재 master 이고 to 가 멤버일 때만 master 를 to 로 *원자 교체*(공백 0·이중 0). from 은 일반 멤버로 잔류(로스터 크기 불변). to 비-멤버·from 비-마스터면 no-op(거래 거부). 이양도 발행(kind 'transfer'·GuildFeed 는 무시=배지 불변)·저널(영속 replay 동일 적용). guildTransfer 미주입이면 0188 비트 동일(reg).
// step-0186 — 길드 멤버 수 배지 읽기 모델(guildFeed·GuildFeed): 0183 변경 발행은 가입/탈퇴 델타만 노출했다 — 길드 *현재 멤버 수*를 한눈에 보려는 소비자(길드 목록 UI·정원 체크)는 매번 로스터 질의를 해야 했다(0185 한계). 우편 MailFeed 0151·거래소 MarketFeed 0112 의 읽기 모델(발행 스트림 구독·발신 0·권위 0)을 길드에 적용한다: 새 박스 GuildFeed 가 svc.guild.changed 를 구독해 guildId 별 memberCount 배지를 유지(create=초기 로스터 크기·join +1·leave −1). 배지는 로스터 SSOT 와 독립한 *파생 읽기 모델*(CQRS). 정확한 배지를 위해 이 step 은 guildCreate 도 발행(kind 'create'·members) — changePublish ON 일 때만. guildFeed OFF·guild 부재면 박스 0 = 0185 비트 동일.
// step-0185 — 길드 저널 스냅샷 압축(guildSnapshot·snapshot+tail replay): 0184 의 변경 저널은 *무계 성장*이라 가입/탈퇴가 누적될수록 replay 비용·메모리가 ∝변경 수다(0184 한계). 파티 0086(가방 0018·채팅 0022 동일)의 주기 스냅샷+tail replay 를 길드 저널에 적용한다: snapInterval 개 변경마다 현재 로스터 projection 을 스냅샷(upToSeq 기록)하고 그 이하 저널을 가지치기 → 저널은 *마지막 스냅샷 이후 tail* 만 보관(유계). reconstruct 는 스냅샷에서 출발해 tail(seq>upToSeq)만 replay → 전체 저널 replay 와 비트 동일(무손실 압축). guildSnapshot(snapInterval 0) 면 압축 0·저널 무계 = 0184 비트 동일.
// step-0184 — 길드 영속·failover(guildPersist·변경 저널 replay): 0183 까지 GuildService 의 로스터/마스터십은 *휘발*(in-memory)이라 박스 crash 시 결성·가입/탈퇴가 전부 소실됐다(영속 0·0183 한계). 파티 0085 의 event sourcing 을 길드에 적용한다: 로스터를 바꾸는 명령(create/join/leave)을 *변경 저널*(durable)에 append 하고, crash(RAM 소실) 후 fresh GuildService 가 그 저널을 seq 순 replay 해 로스터+마스터십 projection 을 재구성한다 → 죽기 전과 비트 동일. projection(guilds)은 휘발, 저널은 durable. guildPersist OFF 면 저널 0·crash 후 reconstruct 해도 빈 로스터(소실) = 0183 비트 동일(저널 미기록·휴면).
// step-0183 — 길드 멤버십 변경 발행(guildChangePublish·svc.guild.changed): 0182 의 증분 가입/탈퇴는 *관측 불가*였다(누가 언제 들고 났는지 스트림 0·0182 한계). 실제 길드 변경은 다른 시스템(채팅 채널·배지·감사)이 구독해야 한다. 파티 0084 의 변경 발행을 길드에 적용한다: 실제 멤버십 변경(가입/탈퇴) 시 svc.guild.changed{guildId,kind,member} 를 버스로 발행 → 발행자 무수정 소비자(audit)가 반응. 변경 없는 no-op(중복 가입·없는 탈퇴·master 탈퇴 거부)은 발행 안 함(발행==실 변경). guildChangePublish OFF·bus 부재면 발행 0 = 0182 비트 동일(reg).
// step-0182 — 길드 증분 가입/탈퇴(guildJoin/guildLeave·멱등·master 보호): 0181 의 GuildService 는 guildCreate(*전체 로스터 덮어쓰기*)로만 멤버십을 갱신했다 — 한 명 가입/탈퇴에도 전체 목록을 다시 보내야 한다(0181 한계). 파티 0084 의 증분 가입/탈퇴를 길드에 적용한다: guildJoin{guildId,member}(한 멤버 추가·이미 있으면 no-op·멱등)·guildLeave{guildId,member}(한 멤버 제거·없으면 no-op·멱등). **master 보호**: master 의 guildLeave 는 no-op(마스터는 탈퇴 못 함 — 이양 0189 선결) → single-master 불변 보존. 미존재 길드 join 은 graceful 무시(create 선결). 증분 명령 미주입이면 0181 비트 동일(휴면·reg 0).
// step-0181 — 길드(Guild) 서비스 분리(guildService·GuildService): SPINE 계층3 게임 서비스의 마지막 미착수 박스(가방·채팅·거래소·우편·랭킹 ✅, 길드 ⬜). 파티(0075 PartyService)가 *수명 짧은* 그룹 멤버십이라면, 길드는 *오래 사는 명명된 조직* — 마스터(단일 권위 소유자)가 결성하고 로스터(멤버 집합)를 보유한다. 거래소·우편 박스의 계보(escrow/발행/영속/saga)를 따라 이 arc(0181~0190)에서 키운다.
//   분리 이유(SPINE §2 판정): 길드 멤버십·마스터십은 *존 tick 박자와 무관한 오래 사는 게임 상태* → 비동기 서비스(존 tick 밖·onTick 없음·순수 반응형). 클라/라우터는 로스터를 *질의*로만 소비(은닉: 저장 방식 모름·질의 계약만). 0075 파티 멤버십 SSOT 의 *길드* 판 + single-master 권위 불변(척추 ③ 권위 단일 소유의 길드 적용).
//   더한 한 조각(0181): ⒜ guildCreate{guildId, master, members} → 로스터 SSOT 쓰기(master 는 항상 멤버에 포함·중복 제거) ⒝ guildQuery{guildId} → guildRoster{guildId, master, members} 회신(request/reply·SPINE §4 경로3). single-master 불변: 매 길드는 정확히 한 master(권위 단일 소유). guildService OFF → 박스 0 = 0180 비트 동일(reg).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;
// step-0265 분할 — 트랜잭션 핸들러(onMsg) 믹스인(guildCreate/Join/Leave/Transfer/Deposit/Withdraw/Query).
const { GuildTxn } = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./svc-guild-txn.js') : globalThis.__HktNetParts.svc_guild_txn;

// ── [게임 서비스] GuildService — 길드 *로스터+마스터십*의 SSOT(SPINE 계층3 길드/소셜). 존 tick 밖 *순수 반응형*(onTick 없음·권위=로스터/마스터만). ──
//   guildCreate: 길드 결성/갱신({guildId, master, members}) → 로스터 SSOT 갱신(master ∈ members 보장). guildQuery: 로스터 질의(request/reply) → guildRoster 회신.
//   single-master 불변: 모든 길드는 정확히 한 master(권위 단일 소유·척추 ③). 마스터 이양은 후속(0189) 쌍 거래.
class GuildService {
  constructor(opts = {}) {
    this.guilds = new Map();      // guildId -> { master, members:[...] } (로스터 SSOT — 오래 사는 상태·master ∈ members).
    this.creates = 0;             // 처리한 guildCreate 수(계측).
    this.queriesRx = 0;           // 받은 guildQuery 수(계측). repliesSent = 보낸 응답 수(1:1).
    this.repliesSent = 0;
    this.joins = 0;               // 처리한 guildJoin 수(step-0182·증분 가입 계측·no-op 포함).
    this.leaves = 0;              // 처리한 guildLeave 수(step-0182·증분 탈퇴 계측·no-op/master 보호 포함).
    this.changePublish = opts.changePublish || false;   // 멤버십 변경 발행(step-0183·guildChangePublish) — 가입/탈퇴를 svc.guild.changed 로. OFF·bus 부재면 발행 0(0182 동일).
    this.bus = opts.bus || null;        // 변경 발행 경로(구독자 주소 무지·은닉). null 이면 발행 못 함.
    this.published = 0;           // svc.guild.changed 발행 수(step-0183·계측). 실 변경과 1:1(no-op 발행 안 함).
    this.transfers = 0;           // 처리한 guildTransfer 수(step-0189·계측·no-op 포함). 성사된 이양만 master 교체.
    this.persist = opts.persist || false;   // 로스터 영속(step-0184·guildPersist) — 변경 명령을 durable 저널에 기록·crash 후 replay 로 재구성. OFF 면 저널 0(0183 동일·휘발).
    this.journal = [];            // durable 변경 저널 [{seq, kind, guildId, master|member}] — projection(guilds)과 분리(crash 시 guilds 만 소실·저널은 영속). 파티 0085 변경 저널의 길드 판.
    this.jseq = 0;                // 저널 시퀀스(단조).
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0185·guildSnapshot) — 이 개수 변경마다 로스터 스냅샷+저널 가지치기. 0 이면 압축 0(0184 동일·무계 저널).
    this.snapshot = null;         // {upToSeq, guilds:[[guildId,{master,members}]...]} — 마지막 압축 스냅샷(이하 저널은 가지쳐짐). reconstruct 의 출발점.
    this.snapshots = 0;           // 찍은 스냅샷 수(step-0185·계측).
    this.bank = opts.bank || false;     // 길드 금고 활성(step-0191·guildBank) — 멤버가 아이템을 길드 공유 원장(vault)에 예치/인출. OFF 면 금고 명령 무시(0190 비트 동일). 거래소 escrow·우편 custody 의 조직 공유 판.
    this.vault = new Map();       // guildId -> [itemId...] (금고 원장 SSOT — 길드가 보유한 아이템 집합·중복 0·권위 단일 소유). 로스터/마스터십과 직교(권위=원장).
    this.deposits = 0;            // 처리한 guildDeposit 수(step-0191·계측·no-op 포함).
    this.withdraws = 0;           // 처리한 guildWithdraw 수(step-0192·계측·no-op 포함).
    this.bankPublish = opts.bankPublish || false;   // 금고 변경 발행(step-0193·guildBankPublish) — 예치/인출을 svc.guild.bank.changed 로. OFF·bus 부재면 발행 0(0192 동일).
    this.bankPublished = 0;       // svc.guild.bank.changed 발행 수(step-0193·계측). 실 변경과 1:1(no-op 발행 안 함).
    // step-0511 — 금고↔가방 escrow 실연동(guildBankInv·#46): 0191~0200 금고 vault 는 itemId *문자열*만 보유(가짜 escrow) — 예치해도 멤버 가방서 안 빠졌다. 거래소 escrow(0117~0120)·우편 custody(0161~0164)의 *조직 공유* 판을 적용: 예치=멤버 가방→escrow give·인출=escrow→멤버 가방 give(가방이 원장 권위·금고는 요청만·은닉). inv/invMode 미주입이면 give 0 = 직전 비트 동일(reg 0).
    this.inv = opts.inv || null;        // 가방(inventory) 주소 — guildBankInv ON 이면 예치/인출이 여기로 give 요청. null 이면 추상 vault(0200 비트 동일).
    this.invMode = opts.invMode || false;   // 금고 escrow 실연동 활성(step-0511·guildBankInv). OFF 면 _custody no-op → give 0(0510 비트 동일).
    this.gives = 0;               // 금고가 가방에 보낸 give 요청 수(step-0511·계측·거래소 gives 의 금고 판).
    this.escrowIds = new Set();   // 금고 escrow 진입 itemId 집합(step-0511·2-서비스 보존 추적 0513·거래소 escrowItemIds 0120·우편 escrowItemIds 0164 의 금고 판). 예치=add·인출=delete.
    this.saga = opts.saga || false;   // 금고 saga 회신 수신(step-0515·guildBankSaga) — ON 이면 give 에 replyTo+gid 를 실어 가방이 item_result 를 echo(2-서비스 피드백). OFF 면 fire-and-forget(0514 비트 동일). 거래소 0121·우편 0166 의 금고 판.
    this.gid = 0;                 // 단조 give id(step-0515) — saga 회신 매칭 키. _custody 가 발급.
    this.ackedGives = 0;          // 가방서 회신(item_result) 받은 give 수(step-0515·무손실서 gives==ackedGives·닫힌 고리 liveness).
    this.giveOks = 0;             // 성공 회신 수(step-0515·0519 giveOks==가방 escrowXfers 교차 정합의 좌변).
    this.giveFails = 0;           // 실패 회신 수(step-0515·sagaConsistent 의 acked==oks+fails 우변).
    this.retries = 0;             // saga 재전송 수(step-0517·guildBankRetry) — 재발신은 gives 무증가·이 별도 계측. 거래소 0126·우편 0168 의 금고 판.
    this.pending = new Set();     // 미해결 give 의 gid 집합(step-0516) — _custody add·item_result 회신이 delete. 정상 0 drain·회신 손실 시 잔존(ack 미수신 격차 가시). 거래소 0125·우편 0167 의 금고 판.
    this.pendingGive = new Map(); // gid -> {itemId,from,to,cause}(step-0516) — 재전송 소스(0517 대비·회신 손실 시 같은 gid 재발신).
    this.ackDrop = opts.ackDrop ? new Set(opts.ackDrop) : null;   // 테스트 seam(step-0516) — 수신 시 *1회* 드롭할 gid(transient 회신 손실 모의). 미제공이면 무손실(production 무영향·reg 0).
    this.ackDropAlways = opts.ackDropAlways ? new Set(opts.ackDropAlways) : null;   // 테스트 seam(step-0516) — 수신 시 *매번* 드롭할 gid(지속 회신 손실 모의). 미제공이면 무손실(production 무영향·reg 0).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 금고 아이템 custody 이동 헬퍼(step-0511·#46) — invMode ON 이고 itemId 있을 때만 가방에 give(from→to). 가방이 원장 권위·금고는 요청만(은닉·명시 인터페이스). 미충족이면 no-op(추상 vault·0200 비트 동일·reg 0). 거래소 _custody(0117)·우편 _custody(0161)의 금고 판. 예치=멤버→'escrow'(leg 진입)·인출='escrow'→멤버(leg 이탈).
  _custody(itemId, from, to, cause) {
    if (!this.invMode || !this.inv || itemId == null || !this.net) return;
    const msg = { type: 'item_req', op: 'give', itemId, fromAvatar: from, toAvatar: to };
    // saga 피드백(step-0515·guildBankSaga) — ON 이면 replyTo(금고 주소)+cause+gid 를 실어 가방이 item_result 를 금고로도 회신. OFF 면 msg 가 0514 와 정확히 같다(키 없음)→가방 echo 휴면=비트 동일(reg 0).
    if (this.saga) {
      const gid = this.gid++;
      msg.replyTo = this.addr; msg.cause = cause; msg.gid = gid;
      this.pending.add(gid);                                                  // 미해결 추적(step-0516) — 회신 도착 시 제거
      this.pendingGive.set(gid, { itemId, from, to, cause });                 // 재전송 소스(step-0516·0517 대비)
    }
    this.net.send(this.addr, this.inv, msg);
    this.gives++;
    if (to === 'escrow') this.escrowIds.add(itemId);          // 예치 인출(leg 진입) — escrow 진입(2-서비스 보존 추적·0513)
    else if (from === 'escrow') this.escrowIds.delete(itemId);   // 인출 입금(leg 이탈) — escrow 이탈
  }
  // 2-서비스 saga 회신 수신(step-0515·거래소 0121·우편 0166 의 금고 판) — _custody 가 replyTo 로 보낸 give 의 item_result echo. 회계 집계(ackedGives·giveOks·giveFails). saga OFF 면 이 메시지가 영영 안 옴(0514 비트 동일).
  _onGiveReply(p) {
    // 회신 손실 주입(step-0516·테스트 seam) — ackDropAlways 는 매번·ackDrop 은 1회 폐기 → 그 gid 는 pending 잔존(ack 미수신 격차 가시). 손실 없으면(seam 미제공) 정상 처리(0515 비트 동일).
    if (this.ackDropAlways && this.ackDropAlways.has(p.gid)) return;
    if (this.ackDrop && this.ackDrop.has(p.gid)) { this.ackDrop.delete(p.gid); return; }
    this.ackedGives++;
    if (p.ok) this.giveOks++; else this.giveFails++;
    this.pending.delete(p.gid); this.pendingGive.delete(p.gid);   // 미해결 추적서 제거(step-0516) — 회신 도착 give 를 정상 drain
  }
  pendingGives() { return this.pending.size; }   // 미해결(회신 미수신) give 수(step-0516) — 정상 0·회신 손실 시 잔존.
  // 미해결 give 재전송(step-0517·guildBankRetry) — pendingGive 에 남은(회신 손실) give 를 *같은 gid* 로 재발신(재실행 아닌 *재회신* 유도·가방 sagaDedup 전제). 재전송이라 gives/escrowIds 무증가·retries++. pendingGive 비었으면 no-op(0516 비트 동일). 거래소 0126·우편 0168 의 금고 판.
  _resendPending() {
    if (!this.invMode || !this.inv || !this.net) return;
    for (const [gid, g] of this.pendingGive) {
      this.net.send(this.addr, this.inv, { type: 'item_req', op: 'give', itemId: g.itemId, fromAvatar: g.from, toAvatar: g.to, replyTo: this.addr, cause: g.cause, gid });
      this.retries++;
    }
  }
  // 로스터 정규화 — master 를 항상 멤버에 포함하고 중복 제거(집합 의미론·결정론적 삽입 순서: master 선두). single-master 불변 보조.
  _normalize(master, members) {
    const out = [master];
    for (const m of (members || [])) if (m !== master && !out.includes(m)) out.push(m);
    return out;
  }
  // 변경 저널 추가(step-0184) — 로스터 변경 명령을 durable 저널에 append. persist OFF 면 no-op(0183 동일). 실 변경 시에만 호출. 파티 0085 _journalChange 의 길드 판.
  _journalChange(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    // 스냅샷 압축(step-0185) — tail 길이가 snapInterval 에 도달하면 현재 로스터를 스냅샷(upToSeq=jseq)하고 그 이하 저널 가지치기. 저널은 마지막 스냅샷 이후 tail 만 보관(유계). snapInterval 0 면 미발화(0184 동일). 파티 0086 의 길드 판.
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, guilds: [...this.guilds].map(([k, v]) => [k, { master: v.master, members: v.members.slice() }]), bank: [...this.vault].map(([k, v]) => [k, v.slice()]) };   // step-0195 — vault 도 스냅샷에 포함(금고 압축).
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만 남김(방금 upToSeq 이하 전부 가지치기 → 0)
      this.snapshots++;
    }
  }
  // 멤버십 변경 발행(step-0183) — 가입/탈퇴 델타를 svc.guild.changed 로. changePublish OFF·bus 부재면 no-op(0182 동일). 실제 변경 시에만 호출(no-op 변경은 발행 안 함). 파티 0084 _publishChange 의 길드 판.
  _publishChange(guildId, kind, member) {
    if (!(this.changePublish && this.bus)) return;
    this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.guild.changed', ev: { guildId, kind, member } }); this.published++;
  }
  // 금고 변경 발행(step-0193) — 예치/인출 성사를 svc.guild.bank.changed 로. bankPublish OFF·bus 부재면 no-op(0192 동일). 실 변경 시에만 호출(no-op 발행 안 함). 거래소 0108·길드 변경 발행 0183 의 금고 판.
  _publishBank(guildId, kind, itemId, member) {
    if (!(this.bankPublish && this.bus)) return;
    this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.guild.bank.changed', ev: { guildId, kind, itemId, member } }); this.bankPublished++;
  }
  membersOf(guildId) { const g = this.guilds.get(guildId); return g ? g.members : []; }
  masterOf(guildId) { const g = this.guilds.get(guildId); return g ? g.master : null; }
  bankOf(guildId) { return this.vault.get(guildId) || []; }   // 금고 원장 읽기(step-0191) — 길드가 보유한 itemId 목록(읽기·권위 0).
  // bankConsistent(step-0199·capstone) — 금고 원장 권위 단일 소유 불변(척추 ③): 어떤 itemId 도 두 길드 금고에 동시에 있지 않고(교차 중복 0=이중 소유 0)·한 금고 안 중복 0. 순수 읽기(권위 0). rosterConsistent(0190·master 권위)의 *아이템 권위* 판. 거래소 escrow 보존 0120·우편 0164 의 길드 금고 판.
  bankConsistent() {
    const owner = new Map();   // itemId -> 보유 guildId(첫 등장). 둘째 등장 = 이중 소유 위반.
    for (const [gid, items] of this.vault) {
      if (new Set(items).size !== items.length) return false;   // 금고 내부 중복 0.
      for (const it of items) { if (owner.has(it)) return false; owner.set(it, gid); }   // itemId 단일 길드 소유(교차 중복 0).
    }
    return true;
  }
  // rosterConsistent(step-0190·capstone) — single-master 불변(척추 ③): 전 길드 정확히 한 master(공백 0)·master ∈ members(고아 0)·멤버 중복 0. 순수 읽기(권위 0). 모든 연산·체제서 성립해야 길드 박스가 권위 단일 소유를 보존. 거래소 0140·우편 0180 capstone 의 길드 판.
  rosterConsistent() {
    for (const g of this.guilds.values()) {
      if (g.master == null) return false;                              // 마스터 공백 0.
      if (!g.members.includes(g.master)) return false;                 // 고아 마스터 0(master ∈ members).
      if (new Set(g.members).size !== g.members.length) return false;  // 멤버 중복 0.
    }
    return true;
  }
  // bankCapstone(step-0200·arc capstone) — 금고 박스 전체 정합을 한 진입점으로 결합 단언: bankConsistent()(원장 권위 단일 소유·0199) AND feed.bankFeedConsistent(this)(읽기 모델 배지==vault·0198). 외부 모니터/감사가 금고 박스 한 줄 건강검진에 쓴다. 순수 읽기(권위 0). 거래소 0140·우편 0180·길드 0190 capstone 의 금고 판. guild bank arc(0191~0200) 닫기.
  bankCapstone(feed) { return this.bankConsistent() && feed.bankFeedConsistent(this); }
  // crash(step-0184) — 박스 RAM 소실의 인프로세스 모델: 로스터 projection·계측만 비운다. *변경 저널은 durable* 이라 보존(파티 0085 의 길드 판).
  crash() { this.guilds = new Map(); this.vault = new Map(); this.creates = 0; this.joins = 0; this.leaves = 0; this.deposits = 0; this.withdraws = 0; }   // step-0194 — vault 도 휘발(저널만 durable). 금고 미사용 시 vault 는 빈 Map → 비우기·복원 모두 빈 Map(0193 비트 동일).
  // reconstruct(step-0184·failover) — fresh 박스가 durable 변경 저널을 seq 순 replay 해 로스터+마스터십 projection 을 재계산. create=설정·join=추가·leave=제거(master 보호 동일) → 죽기 전과 비트 동일. 자기 영속 저널만으로 복원.
  //   0185: 스냅샷이 있으면 그 로스터에서 출발해 tail(seq>upToSeq)만 replay → 스냅샷+tail == 전체 저널(무손실 압축). 스냅샷 없으면 저널 전체 replay(0184).
  reconstruct() {
    const m = new Map();
    const bank = new Map();   // step-0194 — 금고 vault projection 도 같은 저널에서 재구성.
    if (this.snapshot) for (const [k, v] of this.snapshot.guilds) m.set(k, { master: v.master, members: v.members.slice() });
    if (this.snapshot && this.snapshot.bank) for (const [k, v] of this.snapshot.bank) bank.set(k, v.slice());   // step-0195 — 스냅샷의 vault 에서 출발(tail 만 replay).
    const upTo = this.snapshot ? this.snapshot.upToSeq : -1;
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.seq <= upTo) continue;
      if (e.kind === 'create') m.set(e.guildId, { master: e.master, members: this._normalize(e.master, e.members) });
      else if (e.kind === 'join') { const g = m.get(e.guildId); if (g && !g.members.includes(e.member)) g.members.push(e.member); }
      else if (e.kind === 'leave') { const g = m.get(e.guildId); if (g && e.member !== g.master && g.members.includes(e.member)) g.members = g.members.filter(x => x !== e.member); }
      else if (e.kind === 'transfer') { const g = m.get(e.guildId); if (g && g.members.includes(e.master)) g.master = e.master; }   // step-0189 — 이양 replay(master 교체·로스터 불변).
      else if (e.kind === 'deposit') { const v = bank.get(e.guildId) || []; if (!v.includes(e.itemId)) { v.push(e.itemId); bank.set(e.guildId, v); } }   // step-0194 — 예치 replay(금고에 itemId 추가·중복 0).
      else if (e.kind === 'withdraw') { const v = bank.get(e.guildId); if (v && v.includes(e.itemId)) bank.set(e.guildId, v.filter(x => x !== e.itemId)); }   // step-0194 — 인출 replay(금고서 itemId 제거).
    }
    this.guilds = m;
    this.vault = bank;
    // step-0514 — 금고 escrow 집합 재구성(guildBankInv·#46): crash 로 휘발한 escrowIds(가방 escrow 추적)를 복원한 vault 에서 재계산. vault 아이템 = escrow 에 있는 아이템(가방은 별 박스라 crash 무관·여전히 'escrow' 소유)이므로 escrowIds == Σvault → 재구성 후 2-서비스 보존(0513) 유지. invMode OFF 면 skip(escrowIds 무의미·직전 비트 동일·reg 0).
    if (this.invMode) { this.escrowIds = new Set(); for (const v of bank.values()) for (const id of v) this.escrowIds.add(id); }
  }
}

// step-0265 분할 — 트랜잭션 핸들러를 프로토타입에 되섞음(정의 위치만 이동·this 바인딩 동일·reg 0).
Object.assign(GuildService.prototype, GuildTxn);

const __guild = { GuildService };
if (typeof module !== 'undefined' && module.exports) module.exports = __guild;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_guild = __guild;
