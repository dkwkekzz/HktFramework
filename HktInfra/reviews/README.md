# reviews/ — 회고·서사 레이어 (왜·정합성·진척을 step 위로)

> HktInfra 시리즈의 닫힌 step 을 *위 고도*에서 본다. step 문서가 *한 조각을 어떻게 구현했나*라면, reviews 는 *왜·정합한가·목표에 얼마나 왔나*를 푼다. 방법·포맷은 `.claude/skills/infra-review/SKILL.md`.
>
> 판정은 PASS 주장이 아니라 **실물 코드(현재 `../src/*.js` + `../engine/*.js`, 필요시 git 델타) + run.js 재현**으로. 닫힌 문서는 불변(역사) — 단 §2 열린 이슈 원장만 갱신(해소분 떨굼).
>
> 권위 분리: 현재·다음 = [../STATE.md](../STATE.md) · 척추 = [../SPINE.md](../SPINE.md) · 6계층 arc = SPINE §6. reviews 는 **읽기 회고 + 전방 권고**일 뿐 STATE 를 대체하지 않는다. 찾은 load-bearing 이슈는 §2 원장에 권고로 쌓이고, step-loop(`infra-step`)이 그걸 *읽어* STATE §2/§3 로 승급·구현한다(전파 고리, §2).

---

## 0. 네 고도 (각자 다른 질문 — 늘어나는 곳을 가른다)

| 문서 | 답하는 질문 | 단위 | 늘어남 |
|---|---|---|---|
| [FOUNDATIONS.md](FOUNDATIONS.md) | 왜 이 인프라? (분리·5불변·검증 4기둥) | 프로젝트 | ❌ 동결 |
| **[progress/](progress/)** | 6계층 박스별: step 에서 어디까지 왔나? (직관) | 박스 (주제=계층별 파일) | ❌ 덮어쓰기 |
| **review-NNNN-MMMM.md** | 이 10 step: 척추 지켰나·이슈? | 묶음 | 묶음당 1편 |
| `../step-NNNN.md` | 이 한 조각: 어떻게 구현? | step | step당 1편 |

> 늘어나는 건 *아래 두 고도*(묶음·step)다. 위 둘은 거의 동결·덮어쓰기 — FOUNDATIONS 는 step 표를 두지 않고, **[progress/](progress/)** 는 *주제(6계층)당 파일 1개·그 안 박스별 항목*으로 매 리뷰가 건드린 박스만 덮어 갱신(누적 0).

> **큰 줄기 진행 서사 = [progress/](progress/)** — 한 파일에 몰지 않고 *계층별 파일*로 쪼개 각 박스가 step 에서 어디까지 왔나를 직관적으로 그린다. 매 리뷰가 이번 묶음이 건드린 박스 항목을 갱신(조건·트리거 없음). 점적 정합 판정은 묶음 감사(§1), 진행 권위 마커는 [../STATE.md](../STATE.md) §5. 방법은 `.claude/skills/infra-review/SKILL.md` §3.5.

## 1. 묶음 감사 인덱스 (한 줄/묶음)

> 10 step = 1 묶음·십진 경계 정렬(0001–0010 · 0011–0020 · …). 닫힌 step 만 다룬다(STATE NOW 가 가리키는 미닫힘 step 제외). 닫힌 **0100** 까지 → **0001~0100 열 묶음 감사 완료**(박스별 진행은 [progress/](progress/) 가 0100 까지 반영).

| 묶음 | 범위 | 호(arc) | 척추 판정 | 열린 이슈 |
|---|---|---|---|---|
| [review-0001-0010](review-0001-0010.md) | 0001~0010 | 헤드리스 토대 — 4박스 → 복제·핸드오프·failover → 멀티프로세스 IPC | ①✅ ②🟡 ③✅강화 ④✅ ⑤🟡 | #1 결정론 이원화 · #2 실 전송/버스 · #4 broker lockstep (+#3·#5·#6) |
| [review-0011-0020](review-0011-0020.md) | 0011~0020 | 와이어 현실화(TCP·토픽 버스·진짜 kill) → 게임 서비스 분리(가방·채팅) → 버스 의미 → 데이터 영속(저널·스냅샷·CQRS late-join) | ①✅강력 ②🟡 ③✅확장 ④✅확장 ⑤✅현실화 | #2·#5 ✅해소 · #1·#3·#4·#6 유지 · #7 채팅 신뢰전달·#8 panel-kit Math.random(신규) |
| [review-0021-0030](review-0021-0030.md) | 0021~0030 | 서비스 영속 완성(채팅 커맨드 로그·압축) → write-behind 신뢰성 4부작(NAK·heartbeat·give·mint) → PersistStore quorum(이중쓰기·N복제·write ack) → 박스 분할 정리 | ①✅ ②🟡 ③✅강화 ④✅ ⑤✅ | #1·#3·#4·#6·#7·#8 유지 · #9 give-resend 견고성(신규) |
| [review-0031-0040](review-0031-0040.md) | 0031~0040 | 정합성 윈도 해소(quorum-fill·유계 sweep) → 버스 동적 구독·failover·양경로 producer replay 무손실 → replay 버퍼 유계·ack 자기-크기조정 → 정리 2건(cluster·topology 분할) | ①✅ ②🟡 ③✅강화 ④✅ ⑤✅ | #1·#3·#4·#6·#7·#8·#9 유지 · #10 give×result-ahead(신규) |
| [review-0041-0050](review-0041-0050.md) | 0041~0050 | 버스 replay 자기-크기조정(결과/seen ack 워터마크·K 추정 폐기) → 다중 소비자 min-워터마크 → 소비자 lease lifecycle(축출·재admission·적응) → 정리 2건(가방 분할·src/ 전환) | ①✅ ②✅(🟡#8) ③✅ ④✅(🟡#11) ⑤✅(🟡#9) | 묶음내 자체해소 6사슬(리뷰가 0047·0048 견인) · #4·#8·#9·#10 유지 · #11 다중GW per-producer ack·#12 cadence EWMA/prior(신규) |
| [review-0051-0060](review-0051-0060.md) | 0051~0060 | cadence 적응 정밀화(grace prior·윈도 감쇠) → 정리(txn 추출) → lease 생애 관측→프레즌스 SSOT→**self-healing 제어 루프**(반응·확인·재시도·상한·발행) | ①✅ ②✅(🟡#8) ③✅ ④✅ ⑤✅(🟡#9·#13) | #12 ✅해소(0051·0052) · #13 전용 프레즌스/치유 박스·#14 대체 소비자 spawn·#15 적응 lease 정밀화(신규) · #9 확장·#4·#8·#10·#11 유지 |
| [review-0061-0070](review-0061-0070.md) | 0061~0070 | 대체 소비자(spawnReplace·reconstruct) → presmon 관측 → **전용 프레즌스 박스 호**(분리→보고 버스화→shadow→failover 승격→사망 자율 감지→질의→질의 failover·쓰기·발행·읽기 전 경로 failover-safe) | ①✅ ②✅ ③✅ ④✅ ⑤✅ | #13 절반해소(0064)·#14 ✅해소(0061/0062) · #16 bespoke 가설 누적 회귀 미승격·#17 self-hb 메아리/재타깃 윈도(신규) · #9 확장·#4·#8·#10·#11·#15 유지 |
| [review-0071-0080](review-0071-0080.md) | 0071~0080 | 프레즌스 질의의 첫 라우팅 소비자(귓속말 라우터)→failover 재타깃·파티 1:N·윈도 재시도·멤버십 SSOT → **전달 신뢰 호**(영수증→재시도→상한→통지→exactly-once dedup·기존 신뢰성 패턴의 전달 판) | ①✅(주석 편차) ②✅ ③✅ ④✅ ⑤✅ | #17(b) ✅해소(0074) · #18 전달 신뢰 1:1 한정·#19 파티 멤버십 영속·#20 dedup 무계+실패 발행·#21 헤더 주석 stale(신규) · #16·#9 확장·#17(a)·#4·#7·#8·#10·#11·#13·#15 유지 |
| [review-0081-0090](review-0081-0090.md) | 0081~0090 | 라우터/수신함/멤버십 위에 **전달 dedup 유계화(seq·epoch 직교)·전달 관측(성공/실패 발행)·파티 1:N 영수증/ack 집계·멤버십 영속(증분·저널·압축)** → 0071-0080 의 #18·#19·#20 메움 | ①✅ ②✅ ③✅ ④✅ ⑤✅ | #18·#19·#20 ✅해소 · #22 박스 30KB 근접·#23 멤버별 Mailbox·#24 epoch straggler(신규) · #9·#16 확장 · #4·#7·#8·#10·#11·#13·#15·#17a 유지 |
| [review-0091-0100](review-0091-0100.md) | 0091~0100 | **파티 전송 세 종결**(done·acked·incomplete)+발행 양 끝(complete/incomplete)·**전달 결말 셋째**(bounced 발행)·**멤버별 수신함**(0088 §9 해소)·**수신함 메모리 3차원 유계화**(seq·epoch·inbox cap+drain) + 정리 2건(svc-whisper·topo-build 분할) | ①✅ ②✅ ③✅ ④✅(은닉 watch) ⑤✅(부분 #9) | #21·#22·#23·#24 ✅해소 · #25 종결 단일성·#26 inbox 드레인 영수증·#27 동적 수신함/은닉(신규) · #16·#9 확장 · #1·#3·#4·#6·#7·#8·#10·#11·#13·#15·#17a 유지 |

## 2. 열린 이슈 원장 (교차-배치 이월 — **유일하게 갱신**)

> **전파 고리**: 이슈는 *과거 step 수정*이 아니라 *이후 게이트 step*으로 반영된다(플래그=0 → 회귀 0). 이미 해소면 그 step 을 가리키고(여기서 제거·기록만), 미해소면 열린 채로 두고 ① **목적지**(STATE §2 NEXT=무르익음 / §3 OPEN GAPS=경미·백로그) ② **게이트 형태**(어떤 플래그·끄면 회귀 0) ③ **arc 정합**(SPINE §6 6계층 순서)을 명시. step-loop(`infra-step`)이 이 원장을 읽어 승급·구현한다 — 원장은 review 가 쓰고, STATE 는 step-loop 이 쓴다.
> 한 줄 = `#번호 | 이슈 | 항 | 발견 묶음 | 상태 | 목적지 → 게이트/해소`.

### 열림 🔴 / 부분 🟡 (다음 묶음 리뷰가 재점검 → 코드 변경 보면 ✅떨굼)

- **#1 | 결정론 이원화** | ② | 0001-0010 | 🟡 설계 수용(load-bearing) — 0005 부터 월드=위치맵+AOI(비트-결정론 VM 제거·더미 재현성만) | **목적지 STATE §3** → 게이트: ISimCore(0003 동결) 뒤 C++ HktCore 승격(UE-모듈-free 분리·headless shim 선결)·교체 시 인프라 무수정 E2E 비트 동일 기대
- **#3 | cross-zone AOI 지연 ↔ idle 대역 긴장** | ④/성능 | 0001-0010 | 🟡 watch — 경계 ghost 1 tick + 뷰 2홉 ≈ 3 tick·증분 정지 대역 0(0007) ↔ heartbeat idle 대역 증가(0008) | **목적지 STATE §3** → 게이트: 증분 ghost·heartbeat 적응(끄면 현 거동=회귀 0). 0011-0020 미착수(와이어/서비스만)
- **#4 | broker lockstep = 강제 동기** | ① | 0001-0010 | 🟡 열림(load-bearing) — broker 가 E2E 비트 동일 위해 전 프로세스 tick 배리어(검증용·자유 실행 아님)·0011~0013 진짜 kill 의 벽시계 비결정도 lockstep 흡수(미해제) | **목적지 STATE §2** → 게이트: 비동기 실행 + 논리/벡터 클럭·인과 순서로 결정론 복원(끄면 lockstep=회귀 0)
- **#6 | 동적 경계·N 존 오케스트레이션 부재** | ③/성능 | 0001-0010 | 🟡 열림 — 현재 2 존 정적·전 존 브로드캐스트 | **목적지 STATE §3** → 게이트: 오케스트레이터 동적 배치·존 spawn(SPINE §2 코디네이션 계층). 0011-0020 미착수
- **#7 | 채팅 best-effort — per-message ack/resend·홉 신뢰 부재** | 서비스 | 0011-0020 | 🟡 유지 — 0015 채팅=fire-and-forget 팬아웃·0021/0022 가 *영속·압축*은 더했으나 *전달 신뢰*(홉 ack/resend)는 미적용·0023/0024 신뢰화는 가방 홉 한정(0024 §9 ⓒ) | **목적지 STATE §3**(이미 "채팅 in-flight/홉 신뢰 미적용" 추적) → 게이트: 채널 시퀀스·ack/resend(0008/0023 복원 패턴의 채팅 판·끄면 회귀 0)
- **#8 | `engine/panel-kit.js:29` Math.random** | ②/정리 | 0011-0020 | 🟡 신규(경미) — 브라우저 DOM 컨트롤 위젯 id 생성·헤드리스 verify/`compute()` 경로 밖(다이제스트 무관)이나 공유 `engine/` 의 결정론-금지 잠복 foot-gun | **목적지 STATE §3 OPEN GAPS**(정리성) → 게이트: 시드 카운터/결정론 id 로 교체(끄면 시각 위젯만 영향=회귀 0)
- **#9 | give-resend 견고성 + 멀티프로세스 패리티 갭** | ③/⑤ | 0021-0030 | 🟡 유지(범위 확장) — 0025 §9 ⓕⓖ: ⒜ `_confirmGive` in-order 의존(재정렬 시 seed 1234 itemDesync 2) ⒝ `clientResync`/`resendGives` 인프로세스 `run()` 에만. **+0031-0040: 버스 failover replay 인프로세스만**·**+0051-0060: self-healing arc 인프로세스만**·**+0061-0070: 프레즌스 박스 호 전체 인프로세스 전용**·**+0071-0080: wrouter/mbox/pservice 라우팅·전달 신뢰 호 전체 인프로세스 전용**·**+0081-0090: 멤버십 영속(0085 crash/reconstruct)·epoch restart(0089)까지 전부 인프로세스 전용**(`src/host.js` 박스 0·`grep mailbox|whisper|pservice|party host.js`=0·주입은 `src/topology.js:174~181` run 루프만) | **목적지 STATE §3** → 게이트: opSeq 키 매칭 + 멀티프로세스 failover/heal/라우팅/restart 핸드셰이크(현 시나리오 FIFO·인프로세스라 미발현=회귀 0)
- **#13 | orch 三역할 겸함 → 전용 프레즌스/치유 박스 분리** | ⑤/정리 | 0051-0060 | 🟡 **절반 해소** — 프레즌스 SSOT+발행 ✅ **0064**(PresenceService 분리·`src/svc-presence.js`)+0065(보고 버스화·orch 주소 무지). **잔여**: 치유(recover/retry/giveup)는 아직 orch(`src/orchestrator.js`) 내 | **목적지 STATE §3** → 게이트: HealService 추출(정리 step·기능 0·reg 0)
- **#16 | bespoke 가설 모드가 누적 회귀(verify-kit)에 미승격** | ②/⑤/정리 | 0061-0070 | 🔴 **확장**(+0091-0100·총 ~30 모드) — verify-kit ORDER 가설 모드는 `reliable·tail·inflight`(~0024)에서 멈춤(`engine/verify-kit.js:702`). 0033+ 버스/lease/heal/프레즌스/라우팅 + 0081~0090 전달 유계화/관측/파티 집계 + **0091~0100 파티 종결/발행·멤버별 수신함·inbox 유계화(10 모드)** 의 *ON-경로 의미*는 close 시 1회만 단언·spine 은 reg-0 만 보증 → ON-의미 미보증 빚이 호 길이에 비례 누적 | **목적지 STATE §3 OPEN GAPS**(정리성) → 게이트: 안정 호를 verify-kit 승격(또는 wrouter/mbox/pservice 스모크 1~2 모드·끄면 현 spine=회귀 0)
- **#17 | self-hb 메아리 + 재타깃 윈도 질의 손실** | ④/⑤ | 0061-0070 | 🟡 **(b) 재타깃 윈도 질의 ✅해소 0074** — **잔여 (a) self-hb 메아리**: 0068 승격된 active 가 자기 svc.presence.hb 를 유일 구독자로 되받음(`hbRecv` 부풀음·무해·`src/topo-build.js`) | **목적지 STATE §3** → 게이트: active 자기-hb 제외(다중 standby/연쇄 failover 기반·끄면 단일 standby 현 거동=회귀 0)
- **#25 | 파티 종결 이벤트 단일성 미강제** | 서비스 | 0091-0100 | 🟡 신규(경미·watch) — complete(0095)·incomplete(0093) 가 같은 partyId 에 상호 배타 강제 없음·현 토폴로지 동시 참 불가라 무발현 | **목적지 STATE §3** → 게이트: 파티당 정확히 한 종결 이벤트 보장(끄면 현 거동=회귀 0)
- **#26 | inbox 드레인 읽음 영수증 부재** | 서비스 | 0091-0100 | 🟡 신규(경미) — 0100 drain 은 전량 비움·읽음 ack 없음(드레인 손실 시 재드레인 정합 무보장)·실 클라 게이트웨이 경유 read E2E 부재(0099 cap·0100 drain 인프로세스 훅) | **목적지 STATE §3** → 게이트: drain→ack→안전 제거(0076 영수증의 inbox 판·끄면 현 거동=회귀 0)
- **#27 | 멤버별 수신함 고정 2개·consumer=수신함 주소 가정** | ④/서비스 | 0091-0100 | 🟡 신규(경미·#6 family) — 0096 mailbox2 는 고정 2개(동적 N 아님)·멤버를 `p.consumer`(수신함 주소)로 직결(member→session→mailbox 한 겹 부재 → ④ 은닉 긴장) | **목적지 STATE §3** → 게이트: 파티 크기별 동적 수신함 + 세션 간접(동적 토폴로지 #6 무대·끄면 현 2-mbox=회귀 0)
- **#10 | give 요청 × result-ahead 결합 미해소(transfers≠base)** | 서비스/버스 | 0031-0040 | 🟡 신규 — 0037/0039/0040 §9: 버스 gap 에 떨군 give 요청 재발행 시 결과 미수신 클라가 재-give → 원 give 재도달 시 owner 바뀌어 실패(failedOps) → *다른 유효 결과*로 수렴(원장 자기-정합·desync 0 이나 transfers≠base) | **목적지 STATE §2/§3**(이미 "give×result-ahead 0037 §9" 추적) → 게이트: 0025 클라 give-resend × 버스 요청 replay 통합 복구
- **#11 | per-producer ack 워터마크 + 다중 게이트웨이 풀 토폴로지** | ④/⑤ | 0041-0050 | 🟡 신규 — 0046~0048 §9: 0046 이 요청 dedup *네임스페이스*(복합키)만 분리·둘째 게이트웨이는 버스 producer seam 으로 대표(클라-대면 풀 와이어 아님)·ack/seen 의 producer 키잉 미착수(단일 게이트웨이라 미발현) | **목적지 STATE §3** → 게이트: busAck/busSeenBound 를 (producer,reqId) 별로 키잉 + 게이트웨이 군 배치(끄면 단일 게이트웨이 현 거동=회귀 0) |
- **#15 | 적응형 lease 정밀화 — 둘째-결함 민감도·주기 인지·마진 jitter** | ④ | 0051-0060 | 🟡 신규(#12 잔여 흡수) — full-max/윈도(0050/0052) 둘 다 한 번의 긴 outage 가 *둘째 동일 결함* 감지 억제(0057 §9 반복 사이클 좌절)·윈도 주기성 맹점(0052 §9)·마진(leaseSpan) 고정(jitter 적응 0) | **목적지 STATE §3** → 게이트: cadence EWMA 분포/주기 인지 + busLeaseMarginAdapt(끄면 현 거동=회귀 0)

### 해소 ✅ (인덱스에서 제거 — 기록만)

- **#22 | 박스 30KB 예산 근접** (0081-0090 발견) → ✅ **0094** svc-whisper 분할(core/handlers/entry·`src/svc-whisper-core.js`)+**0098** topo-build 분할(`src/topo-actors.js`로 makeActor/routeFilters). Object.assign 프로토타입·verbatim·reg 0 → 박스 전부 ≤30KB.
- **#23 | 멤버별 Mailbox 토폴로지 부재** (0081-0090 발견) → ✅ **0096** mailbox2(`src/topo-build.js:68`·둘째 수신함). up 멤버 둘 다 ack→delivered 2/acked true. 잔여(동적 N·게이트웨이 은닉)=#27 로 승계.
- **#24 | epoch 가지치기 straggler 가정** (0081-0090 발견) → ✅ **0091** deliverEpochGrace(`src/svc-mailbox.js:35`·최근 N개 닫힌 epoch 유예→straggler dedup). 잔여(N 초과 straggler)=watch(현 토폴로지 1-epoch 지연 상한이라 N=1 충분).
- **#21 | svc-whisper 헤더 주석 stale** (0071-0080 발견) → ✅ **0094** 분할이 헤더 재작성(`src/svc-whisper-core.js:5` "onTick 은 라우터 제어평면 timeout"·코드 정합).
- **#18 | 전달 신뢰 1:1 한정 → 파티 1:N 집계** (0071-0080 발견) → ✅ **0083** partyReceipt(라우팅 결정 집계·routed/bounced·done·`src/svc-whisper.js:66`) + **0088** partyAckTally(영수증 집계·delivered·acked·`:70`). 잔여(멤버별 *수신함* 토폴로지)는 #23 로 승계.
- **#19 | 파티 멤버십 영속·증분 가입/탈퇴** (0071-0080 발견) → ✅ **0084** partyJoin/Leave 델타+svc.party.changed 발행 + **0085** partyPersist(변경 저널 crash→reconstruct·`src/svc-party.js:72`) + **0086** partySnapshot(스냅샷+tail 압축). 잔여(cluster kill→replay 통합)는 #9 로 흡수.
- **#20 | dedup seen 무계 + 전달 실패 발행** (0071-0080 발견) → ✅ **0081** deliverDedupBound(연속 워터마크 O(gap)·`src/svc-mailbox.js:49`) + **0082** failedPublish(svc.whisper.failed→audit) + **0087** deliveredPublish(성공+tries 발행). epoch 차원 유계는 **0089/0090** 으로 확장.
- **#14 | 대체 소비자 spawn(permanentDown→새 소비자)** (0051-0060 발견) → ✅ **0061** spawnReplace(사전 등록 standby ranking2 가 svc.presence permanent 에 자기 활성화·svc.item.out 자기 재구독·`src/svc-ranking.js:50`) + **0062** spawnReconstruct(활성화 후 저널 replay 로 다운타임 갭 복원·투영==원장). 형태 한정: *런타임 동적 액터 생성*은 아님(0061 §9) — 그 잔여는 #6 동적 토폴로지 family 로 흡수.

- **#2 | 실 전송/버스 부재** (0001-0010 발견) → ✅ **0011**(IPC→실 TCP 소켓·spawn IPC 0·프레이밍) + **0012**(직접 주소지정→토픽 pub/sub 버스) + **0016**(ServiceBus 발행/구독 의미·직접결합 409→0). 잔여=물리 다중-브로커 분산(STATE 백로그).
- **#5 | failover 펜싱·split-brain 미검증** (0001-0010 발견) → ✅ **0012**(링크 분단+재연결 fence·split-brain 0) + **0013**(진짜 child.kill·epoch 펜싱·거짓 사망=진짜 사망 비트 동일·재-provisioning N≥2·divergence 0).
- (기록만·후속 게이트가 메운 0011-0020 신규) write-behind 윈도(0017~0020) → 0023~0026 신뢰성 완결 · ServiceBus 단일점·정적 구독(0016) → 0033 동적 구독+0034 failover.
- (기록만·후속 게이트가 메운 0021-0030 신규) 정합성 윈도 해소 부재(0029 §9 — durableSeq 감지만) → 0031 quorum-fill + 0032 유계 sweep/retry.
- (기록만·후속 게이트가 메운 0031-0040 신규) 결과 outBuffer ack-가지치기 부재(0040 §9 ⒜) → 0041 busOutAck · seenReqs 무계(0040 §9 ⒝) → 0042 busSeenBound + 0047 busSeenNs.
- **#12 | 적응형 lease cadence EWMA 감쇠·시작 grace prior** (0041-0050 발견) → ✅ **0051** busLeaseGrace(시작 cadence prior floor·bootstrap 1회 오축출 ev 1→0) + **0052** busCadenceWindow(최근 K gap max·단조 증가 해소·일시 stall 후 죽음 감지 회복). 잔여(EWMA 분포·주기 인지·마진 jitter·둘째-결함 민감도)=#15 로 승계.
- (기록만·후속 게이트가 메운 0051-0060 신규) orch lease 반응 미착수(0054 §9) → 0055 busLeasePresence(consumerDown SSOT)+0056 busPresenceRecover(self-healing) · 프레즌스 상태·행동 0(0055 §9) → 0056 · recover fire-and-forget(0056 §9) → 0057 recoverAck · 영구 분실 무한 재시도(0058 §9) → 0059 recoverMaxRetries · core 30KB 초과(0052 §9) → 0053 txn 추출.

---

## 3. 묶음 경계 규칙

- **10 step = 1 리뷰·십진 경계 정렬**(0001–0010 · … · 0031–0040 · 0041–0050 …). 한 묶음은 NNN1~NNN0 십진 단위로 끊는다.
- 리뷰는 **닫힌 step 만** 다룬다(STATE NOW 가 가리키는 미닫힘 step 제외).
- HktInfra 는 코드를 단일 살아있는 소스 `../src/`(박스 1개=파일 1개) 한 곳에서 *제자리 수정*한다(0049 전환·이후 archive 폐기). 알리바이는 *현재 코드*를 가리킨다 — 불변이 사는 `../src/<box>.js:line`(누적 코드)·승격분 `../engine/*.js:line`. *그 step 의 정확한 델타*가 필요하면 git(`git log -- src/<box>.js`/`git show`).
- 검증 재현의 골든 등가물은 `node run.js spine`(src 누적 회귀 — reg+전 가설 모드) — ALL OK 가 "전 역사 불변이 현재 코드에서 하나도 안 깨졌다"의 증거다.
