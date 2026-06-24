# ③ 게임 서비스 — tick 과 무관한 책임

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 아이템 거래·채팅 팬아웃·랭킹 집계처럼 *존 tick 과 같은 박자로 돌 필요 없는* 책임을 전부 비동기 서비스로 떼어낸다. 판정 기준: "그 일이 시뮬 tick 박자여야 하나?" 아니면 이 줄로.
>
> 박스가 가장 많은 계층. 서버마다 *무슨 서버 + 필요한 기능 리스트(왜 필요→어떻게→무엇을 했나)* 로 푼다.

---

## 가방(인벤토리) 서버 🟡 자라는 중

**무슨 서버인가**: 아이템 원장을 트랜잭션으로 관리하는 서버(`svc-inventory-core.js`+`-txn.js`). *비유 — 은행 계좌이체*: 한쪽서 빠지고 다른쪽에 들어가는 한 트랜잭션, 총량 보존(복제 0).

**필요한 기능들**:

1. **단일 소유 원장 + 복제 방지** ✅ — 왜: 아이템 연산이 존 tick 을 막으면 안 되고 dupe 0. / 어떻게: 단일 소유 + 쌍 거래(닫힌 장부·복식부기). / 했나: `step-0014`.
2. **영속·failover** ✅ — 왜: 죽으면 원장 소실. / 어떻게: 효과 저널 write-behind + 스냅샷 압축. / 했나: `step-0017~0018`.
3. **신뢰 전달·quorum** ✅ — 왜: 홉에서 흘리면·단일 저장본이면 위험. / 어떻게: NAK·heartbeat·give·mint 복구 → quorum(데이터 계층과 짝). / 했나: `step-0023~0029`.
4. **거래소 saga leg(escrow 실물)** ✅ — 왜: 거래소 escrow 가 실물 아이템으로 빠져야. / 어떻게: escrow custody give + 멱등 dedup. / 했나: `step-0117~0130`(거래소 항목 참조).
5. **회복 자기 공지(svc.inventory.up)** ✅ — 왜: 가방 회복을 거래소가 알아야 saga 를 자동 재개(0136). / 어떻게: 회복 시점(announceUp seam)에 svc.inventory.up 발행→버스→거래소 구독(발행→버스→구독 실 체인·발행자 무수정·decouple). / 했나: `step-0139`(`svc-inventory-txn.js:15`). 단, announceUp 은 *회복 시점 seam*(클러스터 reconstruct 직후 자동 발행은 #9 무대).
6. **멀티프로세스 패리티** ⬜ — 왜: transfers≠base 잔류·announceUp 자동 트리거 미배선. / 했나: 미착수(#9).

**지금 어디 / 다음**: 단일 소유 원장 → 신뢰 전달·quorum·거래소 saga leg·회복 자기 공지까지. 다음 = 멀티프로세스 배선.

## 채팅 서버 🟡 자라는 중

**무슨 서버인가**: 채널 팬아웃(전체/지역/귓속말)을 비동기로 뿌리는 서버(`svc-chat.js`). *비유 — 라디오 채널*: 같은 주파수 구독자에게만, 다른 지역 방송은 안 섞임.

**필요한 기능들**:

1. **구독 팬아웃 + 지역 격리** ✅ — 왜: 대규모 브로드캐스트 대역이 시뮬 대역을 잡아먹음. / 어떻게: 구독 라우팅 + 지역 격리. / 했나: `step-0015`(누설 0).
2. **커맨드 로그 영속** ✅ — 왜: 죽어도 대화가 남아야. / 어떻게: 커맨드 로그 replay + 스냅샷 압축. / 했나: `step-0021~0022`.
3. **per-message ack/홉 신뢰** ⬜ — 왜: 지금은 best-effort 팬아웃. / 했나: 미착수(#7).

**지금 어디 / 다음**: 팬아웃·격리·영속까지. 다음 = 홉 신뢰 전달.

## 랭킹 서버 🟡 자라는 중

**무슨 서버인가**: 발행 스트림을 구독해 순위를 집계하는 *읽기 모델(CQRS)* 서버(`svc-ranking.js`). *비유 — 신문 구독자가 기사를 모아 자기 색인을 만든다*(신문사는 구독자를 모름).

**필요한 기능들**:

1. **구독으로 따라붙기(CQRS)** ✅ — 왜: 집계가 발행자를 직접 건드리면 안 됨. / 어떻게: CQRS 읽기 모델 + late-join 복구. / 했나: `step-0019~0020`.
2. **frontier ack + lease** ✅ — 왜: 버퍼 가지치기·죽음 관리. / 어떻게: frontier ack→min 가지치기→영영 죽으면 lease 축출. / 했나: `step-0044~0045`.
3. **self-healing + 대체 소비자** ✅ — 왜: 사람 개입 없이 되살아나야. / 어떻게: recover 자기 재구독·recoverAck → standby 자기 활성화·저널 reconstruct. / 했나: `step-0056~0057·0061~0062`.
4. **다중 보드·런타임 동적 spawn** ⬜ — 왜: 지금은 사전 등록 standby. / 했나: 미착수.

**지금 어디 / 다음**: 발신 소비자 → 1급 소비자 → self-healing → 대체 소비자 인계까지. 다음 = 런타임 동적 spawn.

## 귓속말/파티 라우터(wrouter) + 수신함(mbox) 서버 🟡 자라는 중

**무슨 서버인가**: "X 에게"·"파티 전원에게" 를 프레즌스 SSOT 로 라우팅하고 *진짜 닿았는지*까지 보장하는 라우터(`svc-whisper-*.js`) + 받은 메시지를 쌓고 비우는 수신함(`svc-mailbox.js`). *비유 — 등기우편*: 주소록(프레즌스)으로 찾아 보내고, 수령 확인 받고, 안 오면 재시도하다 반송/실패 통지하며, 같은 편지를 두 번 안 받게(dedup).

**필요한 기능들** (기능마다 다른 이론에 기댄다):

1. **프레즌스 조회 라우팅 + 1:N 파티** ✅ — 왜: 메시지가 *어디·살아있는지* 모른 채 보내짐. / 어떻게: 프레즌스 질의→전달/반송·failover 재타깃·1:N 팬아웃·멤버십 분리. / 했나: `step-0071~0075`.
2. **전달 신뢰(exactly-once)** ✅ — 왜: 전송은 떨어뜨리니 진짜 닿음을 보장해야. / 어떻게: 영수증→재시도→상한→통지→dedup. / 했나: `step-0076~0080`.
3. **dedup 메모리 두 축 유계화** ✅ — 왜: dedup 기억이 무한히 큼·재시작에 깨짐. / 어떻게: seq 연속 워터마크(O(gap)) + epoch 재시작 펜싱 + grace 유예. / 했나: `step-0081·0089~0091`(`svc-mailbox.js:44`).
4. **세 결말 관측** ✅ — 왜: 결과가 밖에서 안 보임. / 어떻게: 포기(failed)·성공(delivered{tries})·반송(bounced)을 버스 발행. / 했나: `step-0082·0087·0097`(`svc-whisper-handlers.js:57`).
5. **파티 1:N 세 종결** ✅ — 왜: 1:N 이 끝났는지 모호. / 어떻게: done(라우팅)·acked(전원 실수신)·incomplete(일부 영구 실패) + 발행. / 했나: `step-0083·0088·0092~0093·0095`(`svc-whisper-core.js:78`).
6. **멤버별 수신함** ✅ — 왜: 한 수신함에 다 쌓으면 N>1 에서 ack 거짓. / 어떻게: 파티원마다 자기 수신함→모든 up 멤버 ack. / 했나: `step-0096`.
7. **수신함 메모리·수명·관측 완성** ✅ — 왜: 무한 성장·소비 손실 위험. / 어떻게: inbox cap + drainAck 2단계 읽음(exactly-once 소비) + checkout cap + 소비/손실 발행. / 했나: `step-0099~0104`(`svc-mailbox.js:58,69`).
8. **메아리 펜싱(라우터 판)** ✅ — 왜: 지연 공지가 죽은 박스로 역-재타깃. / 어떻게: epoch 가드로 낡은 공지 거부. / 했나: `step-0105~0106`(`svc-whisper-handlers.js:12`).
9. **멀티프로세스 배선·동적 N 수신함·종결 단일성** ⬜ — 했나: 미착수(#9·#27·#25).

**지금 어디 / 다음**: 조회 라우팅 → exactly-once → 유계·관측·재시작 안전 → 파티 종결·멤버별 수신함까지. 다음 = 멀티프로세스 배선 + 게이트웨이 경유 read E2E.

## 파티(멤버십) 서버 🟡 자라는 중 *(수명 짧은 그룹)*

**무슨 서버인가**: *수명 짧은* 파티 멤버십(오래 사는 상태)을 관리하는 서버(`svc-party.js`). 라우팅과 직교한 *멤버십 SSOT*. *비유 — 즉석 동호회 명부*: 한 명 들고 날 때 전체를 다시 안 쓰고(증분) 변경을 게시(발행)하며 사무실이 타도 일지로 복원. (영속 *조직* 판은 아래 길드 서버.)

**필요한 기능들**:

1. **멤버십 SSOT(2단 조회)** ✅ — 왜: 멤버십이 라우팅에 섞이면 안 됨. / 어떻게: 전용 박스·2단 조회. / 했나: `step-0075`.
2. **증분 변경 + 발행** ✅ — 왜: 전체 덮어쓰기는 비효율·남이 변경을 못 봄. / 어떻게: 증분 가입/탈퇴(멱등) + svc.party.changed 발행. / 했나: `step-0084`.
3. **영속·failover** ✅ — 왜: 죽으면 명부 소실. / 어떻게: 변경 저널 replay + 스냅샷+tail 압축(event sourcing). / 했나: `step-0085~0086`.
4. **cluster kill→replay 통합** ⬜ — 왜: 현 in-process. / 했나: 미착수(#9).

**지금 어디 / 다음**: 인메모리 SSOT → 증분·관측·영속까지. 다음 = cluster 통합.

## 길드(Guild) 서버 🟡 자라는 중 *(파티의 영속 조직 판 — single-master 권위)*

**무슨 서버인가**: *오래 사는 명명된 조직*(길드)의 로스터+마스터십 SSOT 서버(`svc-guild.js`) + 멤버 수 배지 읽기 모델(`svc-guildfeed.js`). 파티(0075)가 *수명 짧은 그룹*이면 길드는 *영속 조직* — 마스터(단일 권위 소유자)가 결성하고 로스터를 보유. *비유 — 동아리 회장+회원 명부*: 회장은 정확히 한 명(공백·이중 없음), 이양은 회장→부원 손바뀜(둘이 동시에 회장일 수 없음), 명부 변경은 게시판에 공지되고 사무실이 타도 일지로 복원. 거래소·우편 박스 계보(분리→증분→발행→영속→스냅샷→배지→정합→이양)를 따른다.

**필요한 기능들** (기능마다 다른 이론·파티+우편 패턴 동형 + 길드 고유 single-master):

1. **로스터+마스터십 SSOT + 질의** ✅ — 왜: 멤버십·마스터십이 오래 사는 상태로 라우팅·tick 과 직교. / 어떻게: 전용 박스·`_normalize`(master 항상 멤버·중복 0)·guildQuery→guildRoster request/reply(프레즌스 0069 판). / 했나: `step-0181`(`svc-guild.js:41,99`·single-master 불변 토대).
2. **증분 가입/탈퇴 + master 보호** ✅ — 왜: 전체 덮어쓰기 비효율 + 마스터 공백 방지. / 어떻게: guildJoin/guildLeave 멱등 델타(파티 0084 판) + **master 의 guildLeave 는 no-op**(이양 선결·single-master 보존). / 했나: `step-0182`(`svc-guild.js:84`·`p.member !== g.master` 가드).
3. **멤버십 변경 발행** ✅ — 왜: 변경을 남(배지·감사)이 봐야. / 어떻게: 실 변경 시 svc.guild.changed 발행(no-op 발행 0·발행==실변경·파티 0084 판). / 했나: `step-0183`(`svc-guild.js:_publishChange`·published==audit.seen).
4. **영속·failover + 스냅샷 압축** ✅ — 왜: 죽으면 로스터·마스터십 소실 + 저널 무한 성장. / 어떻게: create/join/leave/transfer op durable 저널 replay(파티 0085·가방 0017 판) + snapInterval 스냅샷+tail 압축(파티 0086·가방 0018 판). / 했나: `step-0184~0185`(`svc-guild.js:47,113`·crash→reconstruct 비트 동일·full 8→tail 2 무손실).
5. **멤버 수 배지 읽기 모델 + 영속 + 정합** ✅ — 왜: 길드 현재 멤버 수를 질의 없이 한눈에. / 어떻게: GuildFeed 가 svc.guild.changed 구독(create=크기·join+1·leave−1·CQRS·발신 0·권위 0·MailFeed 0151 판) + **자기 소비-op 저널 self-persist**(MailFeed #39 와 달리 *자기 저널* replay — 외부 저널 의존 0) + feedConsistent(배지==로스터·고아 0). / 했나: `step-0186~0188`(`svc-guildfeed.js:35,43`·배지==로스터 4체제).
6. **마스터 이양(single-master 보존 쌍 거래)** ✅ — 왜: master 보호(2)가 마스터를 영구 고정 — 위임 길 없음. / 어떻게: guildTransfer{from,to} = release+acquire 쌍 거래(존 핸드오프 0006·escrow 0117 의 *마스터십* 판) — from 이 master·to 가 멤버일 때만 원자 교체(공백 0·이중 0)·from 잔류·거부 no-op·이양도 저널 replay. / 했나: `step-0189`(`svc-guild.js:88-95`·master x→c1·crash 후 보존).
7. **정합 capstone(single-master 불변)** ✅ — 왜: 박스 전체가 권위 단일 소유를 깨지 않음을 증명해야. / 어떻게: rosterConsistent(전 길드 정확히 한 master·master∈members·중복 0)를 모든 연산(create/join/leave/transfer)×세 체제(정상·guild crash·feed crash)서 feedConsistent 와 결합 단언(거래소 0140·우편 0180 판). / 했나: `step-0190`(`svc-guild.js:159`·3체제 3/3).
8. **공유 금고(Guild Bank) — 조직 공유 아이템 원장** 🟡 *자라는 중* — 왜: 길드가 *공유 아이템*(길드 소유 장비·재료)을 멤버끼리 맡기고 꺼내야 — 개인 가방(0014)·거래소 escrow(0117)·우편 custody(0157)의 *조직 공유* 판. / 어떻게(거래소·우편 escrow arc 를 그대로 따른 동형 골격·기능마다 다른 이론):
   - ⒜ **예치/인출(입출금 쌍)** ✅ — guildDeposit{member,itemId}→vault 적재(집합 멱등·중복 0)·guildWithdraw→제거(실재 itemId·멤버만·멱등 graceful no-op). 권위 단일 소유(itemId 금고 1곳). / `step-0191~0192`(`svc-guild.js:117,128`).
   - ⒝ **변경 발행** ✅ — 예치/인출 성사를 svc.guild.bank.changed 발행→audit(no-op 발행 0·발행==실변경·거래소 0108·길드 0183 판). / `step-0193`(`svc-guild.js:76`).
   - ⒞ **영속·failover + 스냅샷 압축** ✅ — deposit/withdraw op durable 저널 replay(0184 로스터 영속의 금고 확장·crash→vault 재구성 비트 동일) + snapInterval 스냅샷에 vault 포함·tail 압축(0185 판·tail 1<full 9 무손실). / `step-0194~0195`(`svc-guild.js:65,180`).
   - ⒟ **금고 아이템 수 배지 + 영속 + 정합** ✅ — GuildFeed 가 svc.guild.bank.changed 구독→bankCount 배지(deposit+1·withdraw−1·CQRS·발신 0·0186 판) + 자기 저널 replay 영속(kind 분기·0187 판) + bankFeedConsistent(배지==vault·0188 판). / `step-0196~0198`(`svc-guildfeed.js:25,61,70`).
   - ⒠ **원장 정합 + arc capstone** ✅ — bankConsistent(itemId 단일 길드 소유·교차/내부 중복 0·rosterConsistent 0190 의 *아이템 권위* 판) + bankCapstone(원장+배지 결합·세 체제 3/3·거래소 0140·우편 0180·길드 0190 의 금고 판). / `step-0199~0200`(`svc-guild.js:150,168`).
   - ⒡ **가방 실연동(escrow 실체화)** ⬜ **2차 대기** — 왜: 현 금고는 itemId *문자열*만 보유 — 예치해도 멤버 가방서 안 빠짐(가짜 escrow·아이템 우편 0157~0160 가 0161~0164 로 닫힌 갭의 길드 판·#46). / 했나: 미착수 — load-bearing 이나 *이미 선 박스의 심화*라 너비 완료 후 2차(거래소 0117~0120/우편 0161~0164 동형·SKILL §3.6).
   - ⒢ **인출 권한 등급·멀티프로세스** ⬜ — 인출이 멤버십만 가드(예치자/rank 무관·#48)·host.js 0(#9)·spine 승격(#16). / 미착수.
9. **길드 종료(disband)·발행 게이트 통합** ⬜ — 왜: 솔로-마스터 길드 해소 길 0(#44)·거래소+우편+길드 발행 일원화. / 미착수.

**지금 어디 / 다음**: 분리→증분/master 보호→발행→영속/스냅샷→배지/feed 영속/정합→마스터 이양→single-master capstone(0181~0190)→**공유 금고 arc(0191~0200·예치/인출/발행/영속/스냅샷/배지/원장정합/capstone)**까지 — 파티+우편 동형 골격 + 길드 고유 single-master 권위 + 거래소/우편 escrow 의 *조직 공유* 금고. SPINE 계층3 길드 박스 골격+금고 *완성*(단, 금고는 아직 가방 미연동=가짜 escrow). **🚦 단계 평결(SKILL §3.6)**: 길드는 0181~0190 에 *기본 통신* 완성 — 0191~0200 금고는 그 위 **과심화**(빈 박스 인스턴스·캐시 두고 새 기능 10 step). **다음은 이 박스 심화가 아니라 빈 박스(인스턴스 spawn/despawn)** — 금고↔가방(#46)·인출 권한(#48)·disband(#44)·박스 분할(#47·29.5KB)·멀티프로세스(#9)·spine(#16)는 **2차 대기**.

## 거래소 서버 🟡 자라는 중 *(실물 거래 → 2-서비스 saga 신뢰 전달·원자성)*

**무슨 서버인가**: *두 당사자* 사이 아이템↔대가 교환을 존 tick 밖에서·이중판매 0 으로 성사시키는 서버(`svc-exchange-core.js`+`-txn.js`). 가방과 *두 서비스 saga* 로 엮인다. *비유 — 중고거래 안전결제*: 물건을 제3자 보관(escrow)에 잡아두고 성사면 구매자에게·실패면 판매자에게 되돌리며, 통신이 끊겨도 같은 결과를 한 번만(멱등).

**필요한 기능들** (기능마다 다른 이론에 기댄다):

1. **escrow 단일 권위 쌍 거래** ✅ — 왜: 존 넘는 거래가 존간 결합 없이·이중판매 0. / 어떻게: escrow 쌍 거래·보존. / 했나: `step-0107`.
2. **체결 발행 + 영속·압축** ✅ — 왜: 결과 관측·죽어도 복구. / 어떻게: svc.exchange.sold 발행 + op 저널 replay + 스냅샷+tail. / 했나: `step-0108~0110`.
3. **수명주기 종결(취소·만료)** ✅ — 왜: 안 팔린 매물이 영영 묶임. / 어떻게: 취소 발행 + 만료 TTL 자동 회수 + 만료 발행(보존식 4종). / 했나: `step-0111·0114~0115`.
4. **가방과 실물 거래(escrow 실체화)** ✅ — 왜: escrow 가 말뿐이면 실물 안 빠짐. / 어떻게: escrow 를 가방 원장 아바타로(인출·입금·반환 = 가방 give) + 2-서비스 보존 단언. / 했나: `step-0117~0120`(open `escrowItemIds` ≡ 가방 escrow 소유).
5. **닫힌 saga 고리(보상)** ✅ — 왜: 두 서비스 give 가 낙관적이면 한쪽 실패가 유령 상태. / 어떻게: give 결과 비동기 수신(replyTo+cause)→실패 보상 롤백→보상 발행. / 했나: `step-0121~0123`(phantom 0).
6. **회신 손실 신뢰 전달** ✅ — 왜: 회신 손실 시 saga 멈춤·오보상. / 어떻게: 미해결 추적(gid·pending)+손실 감지→재전송+멱등 dedup→유계화(saga_done). / 했나: `step-0125~0127`(`svc-inventory-txn.js:65`).
7. **세 정합 층 합류(정확히 한 번 증명)** ✅ — 왜: "정확히 한 번 옮겨졌나"를 증명해야. / 어떻게: 회계 닫힘(sagaConsistent `gives==acked+pending`) + 자동 재전송 + 교차 정합(escrowXfers==giveOks). / 했나: `step-0128~0130`(`svc-exchange-core.js:119`·`svc-inventory-txn.js:74`·물리0120/회계0128/교차0130·#31 해소).
8. **saga liveness 유계화·자율 복구·관측** ✅ — 왜: 회신이 *영구* 손실되면 자동 재전송(0129)이 무한 반복하고, 멈추면 give 가 영영 미해결(0129 §9·#35). 유계하게 재시도·포기하되 손실이 풀리면 되살리고, 안 되면 종결하고, 그 전 생애를 운영이 봐야. / 어떻게(기능마다 다른 이론): ⒜ *재전송 상한* — gid 당 N회 후 포기(0059 recoverMaxRetries 의 saga 판) ⒝ *재admission* — 포기 give 간직→손실 해소 시 retry 재개(0048 lease 재admission 의 saga 판) ⒞ *자동 트리거* — 가방 회복 신호 구독→자동 재개(0056 busPresenceRecover 의 saga 판·decouple) ⒟ *2단 유계* — 재admission 횟수 상한→영구 실패(총 재전송 ≤ sagaMaxRetries×(readmitMax+1)) ⒠ *수명주기 발행* — 포기·재개·종결 3종 버스 발행 ⒡ *liveness 정합 capstone* — pending==pendingGive+abandonedGive+permFailed(분할 불변). / 했나: `step-0131`(sagaMaxRetries·`svc-exchange-core.js:71,101`)·`0132`(abandonPublish svc.exchange.saga_abandoned)·`0134`(exchReadmit·`:89`)·`0135`(readmitPublish)·`0136`(autoReadmit svc.inventory.up 구독·`svc-exchange-txn.js:41`)·`0137`(readmitMax·permFailed·`:81,83`)·`0138`(failPublish svc.exchange.saga_failed)·`0140`(sagaLiveConsistent·`:186`). 4체제(정상·포기·재admission 회복·영구실패)서 분할 불변+open==escrow. **포기/종결도 abort 아님** — give 가 실제 성공했을 수 있어(dedup→escrow 소유) 낙관적 open 유지. #35 해소.
9. **저널 별 PersistStore 박스화·멀티프로세스·buy/cancel leg 보상** ⬜ — 했나: 미착수(#30b·#9). buy-leg 보상은 list-leg compensate(0122)가 phantom 을 막아 무대 자체가 드묾(arc 정합 대기).

**지금 어디 / 다음**: 분리→발행→영속→수명주기→실물 거래→2-서비스 saga 신뢰 전달·교차 정합→**saga liveness 유계화·자율 복구·관측·정합 capstone(0131~0140)**까지. 거래소↔가방 saga 가 *네 정합층*(물리 0120·회계 0128·교차 0130·liveness 0140)에서 닫힘. 다음 = 저널 PersistStore 통합(#30b) + 멀티프로세스 배선(#9). (정리 분할 `step-0124`·`0133` topo-subs.)

## 시세 피드(MarketFeed) 서버 🟡 자라는 중 *(0019 ranking 의 거래소 판)*

**무슨 서버인가**: 거래소 발행을 구독해 item별 시세(체결가·거래량·회전)를 집계하는 *읽기 모델(CQRS)* 서버(`svc-market.js`). *비유 — 증권 시세판*: 거래소가 체결을 내보내면 시세판은 모아 보여줄 뿐, 거래를 일으키지 않음.

**필요한 기능들**:

1. **구독 집계(CQRS·관찰 전용)** ✅ — 왜: 시세는 거래소를 안 건드리고 따라붙어야. / 어떻게: sold+cancelled 구독→item별 {시세·거래량}(권위는 거래소·발신 0). / 했나: `step-0112`.
2. **저널 replay late-join** ✅ — 왜: 다운타임 누락 따라잡기. / 어떻게: 자기 영속 0 이어도 거래소 op 저널 replay 로 복원. / 했나: `step-0113`.
3. **수명주기 3종 반영** ✅ — 왜: 만료도 시세에 흘러야. / 어떻게: svc.exchange.expired 구독 추가(체결·취소·만료). / 했나: `step-0116`(`svc-market.js:29`).
4. **매물 깊이·자기 스냅샷·멀티프로세스** ⬜ — 왜: reconstruct==라이브 가 전-수명주기-발행 ON 전제(#32). / 했나: 미착수(#9).

**지금 어디 / 다음**: 구독 집계→replay 복원→수명주기 반영까지. 다음 = 매물 깊이 + 자기 영속.

## 우편(Mail) 서버 🟡 자라는 중 *(거래소 arc 의 완전한 동형 — 오프라인 배송 + 가방 연동 2-서비스 saga)*

**무슨 서버인가**: 발신자가 수신자 우편함에 우편을 넣으면 수신자가 *나중에 접속해 수령*하는 *오프라인* 배송 서버(`svc-mail-core.js`=원장·헬퍼·accessor / `svc-mail-txn.js`=onMsg 핸들러 / `svc-mail.js`=진입점·0165 분할). 귓속말(wrouter)이 *온라인* 즉시 라우팅이라면 우편은 접속 무관 — "세계가 세션보다 오래 산다". *비유 — 우체통*: 받는 이가 집에 없어도 넣어두면, 돌아와서 꺼내 본다. 아이템 우편은 *등기 소포* — 가방(inventory)에서 실제로 빠져 escrow 를 거쳐 수령자 가방에 들어간다(분실 시 발신자 반환).

**필요한 기능들** (거래소 arc 패턴을 그대로 따른 동형 골격):

1. **입금 + 우편함 단일 권위** ✅ — 왜: 오프라인 배송의 토대(수신자 접속 무관 적재). / 어떻게: recipient별 Map(mailId→mail)·같은 id 재전송 멱등(이중 적재 0). / 했나: `step-0142`(`svc-mail.js:87`).
2. **수령(무손실 이동)** ✅ — 왜: 0142 는 입금만이라 우편함 무한 누적. / 어떻게: pull 시 보유(held)→수령(fetched) 무손실 이동(box.clear 후 read 보관·빈 재수령 0통). / 했나: `step-0143`(`:102`·sent==held+fetched).
3. **수명주기 발행 3종** ✅ — 왜: 발신자/운영이 발송·읽음·만료를 관측해야. / 어떻게: 발행자 무수정 소비자 패턴(거래소 0108·랭킹 0019) — svc.mail.sent/read/expired 발행→audit 구독. / 했나: `step-0144·0147·0149`(`:97,132`·발행=파생 스트림·비-침습·published==audit.seen).
4. **영속·failover** ✅ — 왜: 죽으면 우편함 휘발(0142~0144 자기 영속 0). / 어떻게: send/fetch/expire op 를 durable 저널에 기록·crash(projection 소실) 후 seq 순 replay(event sourcing·가방 0017·거래소 0109 의 우편 판). / 했나: `step-0145`(`:73,140,147`·reconstruct==pre digest·발행은 replay 에서 안 함).
5. **저널 스냅샷 압축** ✅ — 왜: 저널 무압축→무한 성장. / 어떻게: snapInterval 마다 projection 스냅샷+가지치기→tail 만 보관·reconstruct 는 스냅샷+tail(거래소 0110·가방 0018 판). / 했나: `step-0146`(snap+tail==full==live 비트 동일).
6. **만료 TTL(시간 트리거)** ✅ — 왜: 미수령 우편이 영영 쌓임. / 어떻게: mailSweep(now) 가 now−sentAt≥ttl 미수령 우편 자동 회수(보유→만료·거래소 0114 판)·만료 durable op→reconstruct 정합. / 했나: `step-0148`(`:121`).
7. **회계 정합 capstone** ✅ — 왜: "우편 1통이 정확히 한 상태인가"를 증명해야. / 어떻게: mailConsistent(sent==totalHeld+fetched+expired·보유/수령/만료 분할·공백·중복 0)를 4체제(수령만·만료만·혼합·crash 복구)서 단언(거래소 0140 sagaLiveConsistent 의 우편 판). / 했나: `step-0150`(`:180`·4/4·수령만 0/3/0·만료만 0/0/3·혼합 1/2/1).
8. **아이템 첨부 우편(우편이 아이템을 나른다)** ✅ *우편 박스 내 회계* — 왜: 0142~0156 은 *메시지(body)* 만 날랐다 — 선물·전리품 배송(아이템 우편)이 없었다. / 어떻게: mailSend 가 선택 필드 item 을 받아 우편 1통이 아이템 1개를 함께 보유(거래소 escrow 의 우편 판)·아이템도 메시지 회계와 동형으로 보유→수령→만료 전이·itemConsistent(itemSent==itemHeld+itemFetched+itemExpired) capstone. / 했나: `step-0157~0160`(`svc-mail-core.js:itemHeld/itemFetched/itemExpired/itemConsistent`·mailItem 플래그·4체제 0/2/0·0/0/2·1/1/1·crash 복구 보존).
9. **가방 연동 3 레그 + 2-서비스 보존(아이템이 *실제* 가방 간 이동)** ✅ — 왜: 8 은 아이템을 *우편 박스 안 회계*로만 추적(가짜 escrow) — 발신자 가방서 실제로 빠지지도, 수령자 가방에 들어가지도 않았다(#40 load-bearing). / 어떻게: 거래소↔가방 2-서비스 쌍 거래(0117~0120)의 우편 판 — `_custody` 가 가방에 give 요청(가방이 원장 권위·우편은 요청만). leg1 발신=발신자→escrow(0161)·leg2 수령=escrow→수신자(0162)·leg3 만료=escrow→발신자 반환(0163)·escrowItemIds 교차 정합(우편 escrow 집합==가방 'escrow' 소유 집합·0164). / 했나: `step-0161~0164`(`svc-mail-core.js:_custody`·`txn:mailSend/mailFetch/mailSweep`·mailInv 플래그·gives/escrowXfers 일치·소유자 escrow→h1/x·crash 복구 정합).
10. **아이템 give saga(회신 신뢰 전달)** ✅ — 왜: 9 의 give 가 *fire-and-forget* — 성공/실패를 우편이 몰랐다(회신 손실 무대비). / 어떻게: 거래소 saga(0121~0130)의 우편 판 — _custody 가 replyTo+gid 동봉→가방 item_result echo→집계(0166 ackedGives)·미해결 추적 pending+회신 손실 감지(0167 gid)·재전송 mailRetry+가방 sagaDedup 멱등(0168 재실행 0)·회계 정합 sagaConsistent(0169 gives==acked+pending)·전체 닫힘 sagaLiveConsistent + 두 서비스 giveOks==escrowXfers(0170). / 했나: `step-0166~0170`(`svc-mail-core.js:saga/pending/_resendPending/sagaConsistent/sagaLiveConsistent`·mailSaga 플래그·닫힌 고리 4/4·손실[1] pending 1·dedup ON xfers 4 vs OFF 5 hazard·양체제 5/5 합치).
11. **아이템 give saga liveness 유계화·자율 복구·관측·정합 capstone** ✅ — 왜: 10 의 재전송은 *수동 1회*(mailRetry op·#42)였고, 회신이 *영구* 손실되면 자동 재전송이 무한 반복하거나 멈춰 give 가 영영 미해결. 유계하게 재시도·포기하되 손실이 풀리면 되살리고, 안 되면 종결하고, 그 전 생애를 운영이 봐야 — 거래소 0131~0140 liveness arc 의 *완전한 우편 판*. / 어떻게(기능마다 다른 이론·거래소와 1:1): ⒜ *주기 재전송* — mailSweep 피기백 autoRetry(명시 op 없이 기존 주기 신호로 pending drain·거래소 0129 exchSweep 판) ⒝ *재전송 상한* — gid 당 N회 후 포기(거래소 0131·0059 recoverMaxRetries 판·pending 잔존) ⒞ *재admission* — 포기 give 간직→손실 해소 시 retry 재개(거래소 0134·0048 lease 재admission 판) ⒟ *2단 유계* — 재admission 횟수 상한→영구 실패(총 재전송 ≤ maxRetries×(readmitMax+1)·거래소 0137) ⒠ *수명주기 발행 3종* — 포기·재개·종결 버스 발행(거래소 0132/0135/0138 판·audit 무수정 관측) ⒡ *liveness 정합 capstone* — pending==pendingGive+abandonedGive+permFailed(미해결 give 3분할 불변·거래소 0140 판). / 했나: `step-0172`(autoRetry·`svc-mail-txn.js:71`)·`0173`(maxRetries·`svc-mail-core.js:104`)·`0174`(abandonPublish svc.mail.saga_abandoned)·`0176`(mailReadmit `_readmit`·`:125`)·`0177`(readmitPublish svc.mail.saga_readmitted)·`0178`(readmitMax→permFailed·`:107`)·`0179`(failPublish svc.mail.saga_failed)·`0180`(sagaLivenessConsistent·`:162`). 네 체제(정상 0=0+0+0·재전송중 1=1+0+0·abandon대기 1=0+1+0·영구종결 1=0+0+1)서 분할 불변. **포기/종결도 abort 아님** — give 가 실제 성공했을 수 있어 낙관적 pending 유지. #42 해소.
12. **클라 와이어·멀티프로세스** ⬜ — 왜: 입금/수령/give 가 `mailOps`/`invOps` 주입 seam·crash/reconstruct post-run·인프로세스만(#9·host.js 0). / 했나: 미착수(#9).

> **정리(기능 0·박스 유계)**: svc-mail.js 30.9KB → `step-0165` core/txn/entry 분할(core 25.6KB). saga(0166~0170)가 core 를 34.8KB 로 재성장(#34d) → **두 정리로 해소**: `step-0171` 영속·failover 부품(_snapState/_restore/_journal/crash/reconstruct)을 `svc-mail-persist.js` 로 추출(34.8→18.6KB·거래소 0124·가방 svc-inventory-persist 0053 패턴) + `step-0175` 누적 per-step 역사 주석(17KB=파일 절반·각 step-NNNN.md 가 SSOT)을 구조+최근 delta 압축 인덱스로 갈음(34→18.6KB·코드 0 변경·STATE §1~6 압축의 소스 코드 판). saga liveness(0172~0180)가 18.6→25.3KB 로 키웠으나 **30KB 유계 유지**(#34d 닫힘). *단, close-step 은 여전히 src 박스 size 미체크 — 두 번째 재초과를 수동 vigilance 가 잡음(#43 도구 게이트).*

**지금 어디 / 다음**: 분리→수령→발행 3종→영속·압축→만료 TTL→회계 capstone(0142~0150)→아이템 첨부(0157~0160)→가방 연동 3 레그+2-서비스 보존(0161~0164)→아이템 give saga(0166~0170)→**saga liveness 유계화·자율 복구·관측·정합 capstone(0172~0180)**까지 — 거래소 arc(0107~0140)의 *완전한 동형*(2-서비스 saga 신뢰 전달 + liveness 네 정합층까지·#40·#42 해소·정리 0165/0171/0175). 다음 = 클라 와이어·멀티프로세스 배선(#9·우편 saga 포함 host.js 0)·spine 승격(#16·우편 saga ~16 모드)·읽기모델 무압축 전제(#39).

## 우편 미읽음 배지(MailFeed) 서버 🟡 자라는 중 *(0112 MarketFeed 의 우편 판 — 우편 박스의 읽기 모델)*

**무슨 서버인가**: 우편 박스가 발행하는 수명주기(svc.mail.sent/read/expired)를 구독해 *수신자별 미읽음 통수(배지)* 를 집계하는 *읽기 모델(CQRS)* 서버(`svc-mailfeed.js`). 우편함 권위 0·발신 0(reply 제외)·순수 반응형. *비유 — 메일 앱의 안 읽은 메일 N 배지*: 우편함(권위)을 안 건드리고 "안 읽은 게 몇 통" 만 따로 세 보여준다.

**필요한 기능들** (거래소 MarketFeed arc 패턴을 그대로 따른 동형 골격):

1. **입금 구독 집계(CQRS·관찰 전용)** ✅ — 왜: 배지는 우편 권위를 안 건드리고 따라붙어야. / 어떻게: svc.mail.sent 구독→수신자별 unread++(권위는 우편 박스·발신 0·발행자 무수정). / 했나: `step-0151`(`svc-mailfeed.js:onMsg`).
2. **읽음·만료 반영(배지가 줄어든다)** ✅ — 왜: 0151 은 입금만 세 unread 단조 증가(읽어도·만료돼도 안 줌). / 어떻게: svc.mail.read→unread-- (mailFeedRead)·svc.mail.expired→unread-- (mailFeedExpire)·MarketFeed 0116 수명주기 반영의 우편 판. / 했나: `step-0152~0153`(unread==sent−read−expired).
3. **영속·late-join** ✅ — 왜: 자기 영속 0 — crash 시 배지 소실. / 어떻게: 우편 박스 durable op 저널(0145) replay 로 배지 재계산(ranking 0020·MarketFeed 0113 의 우편 판·CQRS late-join). / 했나: `step-0154`(`:reconstruct`·crash 후 digest==라이브). **잔여**: 우편 저널이 스냅샷 압축(0146·mailSnapshot>0)되면 가지친 head 배지 이력 복원 불가 — 완전 복원은 무압축 전제(#39·MarketFeed #32 의 우편 판).
4. **회계 정합 capstone** ✅ — 왜: 배지 회계가 닫혔는지 증명해야. / 어떻게: feedConsistent(모든 수신자 unread==sent−read−expired·unread≥0)를 4체제서 단언(0150 mailConsistent 의 읽기 모델 판). / 했나: `step-0155`(`:feedConsistent`·4/4·totalUnread==우편 totalHeld·crash 복구 정합).
5. **원격 질의 인터페이스(pull)** ✅ — 왜: 배지가 프로세스 내 pull 로만 읽혔다 — 게이트웨이/클라가 원격에서 못 물음. / 어떻게: mailUnreadQuery→mailUnreadReply request/reply over net(프레즌스 0069 presenceQuery 의 우편 판). / 했나: `step-0156`(`:onMsg`·queriesRx==repliesSent·회신==배지).
6. **매물 깊이류 보강·자기 영속·멀티프로세스** ⬜ — 왜: 배지 정렬/페이지네이션·자기 저널·host.js 0(#9). / 했나: 미착수(#9·#39).

**지금 어디 / 다음**: 입금 집계→읽음/만료 반영→영속 late-join→회계 capstone→원격 질의까지(읽기 경로 완비: push 발행 + pull 질의). 다음 = 자기 영속(우편 저널 무압축 의존 해소·#39)·멀티프로세스(#9).

---

> **이 계층 다음 걸음**: 거래소↔가방 2-서비스 saga 가 *원자성·신뢰 전달·교차 정합·**liveness***까지 닫힘(#31·#35·0121~0140·네 정합층). **우편 박스가 거래소 arc 의 *완전한 동형*으로 섰다**: 전용 박스 ✅(0142~0150) + MailFeed 미읽음 배지 ✅(0151~0156) + 아이템 첨부 ✅(0157~0160) + 가방 연동 3 레그+2-서비스 보존 ✅(0161~0164·#40 해소) + 아이템 give saga ✅(0166~0170) + **saga liveness 유계화·자율 복구·관측·정합 capstone ✅(0172~0180·거래소 0131~0140 의 우편 판·#42 해소)** — 메시지·배지·아이템·가방 연동(3레그+saga+liveness) 다섯 축. **정리 2회로 박스 유계 유지**(0171 영속 부품 분할 + 0175 헤더 압축·#34d 해소·core 25.3KB). 남은 견고화: 멀티프로세스 배선(#9·우편 saga liveness 포함·host.js 0)·spine 승격(#16·우편 ~16 모드)·읽기모델 무압축 전제(#39)·거래소 저널 별 PersistStore(#30b)·채팅 홉 신뢰(#7)·close-step src 박스 size 체크(#43)·topo-run 🔴 분할(#34c·0181~0190 가 33.3KB 로 심화). 수신함 동적 N(#27). **길드 전용 박스 ✅ 섰다(0181~0190·파티+우편 동형 + single-master 권위·이양 쌍 거래·SPINE 계층3 길드 박스 골격 완성)** — 다음 큰 걸음: 발행 게이트 통합·길드 bank(escrow).
