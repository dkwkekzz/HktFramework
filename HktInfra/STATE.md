# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(에이전트 효율 — 토큰이 step 수에 비례해 터지지 않게 *강제*)**: 이 파일은 *고정 크기 대시보드*다. §1~6은 step을 닫을 때마다 **덮어쓴다(rewrite)** — 누적하지 않는다. 오직 §7 INDEX만 **literal 1줄** append(`step | 조각 | 통과+핵심수치 1개` — *문단 금지*). 발견/한계의 *전문*은 STATE가 아니라 `step-NNNN.md`에 산다. **세 가지 누적 함정 금지**: ① §5 에서 큰 그림 진척을 step별로 *재나열*하지 말 것 — 현재 마커 + 핵심 step 목록만 ② §3 에서 ✅해소된 격차를 전문 보존하지 말 것 — *한 줄로 떨어뜨린다* ③ §4 는 *여러 step 이 반복 참조하는 불변*만. 닫힌 step 의 발견·한계 전문은 각 `step-NNNN.md`(역사의 SSOT), 1줄 요약은 §7 INDEX. 마커: ✅해소 🟡부분 🔴열림(최우선) ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0099](step-0099.md) — **Mailbox inbox 유계화**(inboxBound·드레인 읽기 모델): inbox 가 받은 귓속말을 전부 영구 보관 → 읽는 이 없으면 메모리 ∝received 누설. dedup 은 0081/0090/0091 로 유계화했지만 inbox 적재는 무계였다. inbox 를 최근 K개로 cap(초과 시 가장 오래된 것 드롭·overflowed++)·received(총 수신)는 진실 SSOT 보존. inboxBound 0(기본)=무계=0098 비트 동일. 닿는 박스: svc-mailbox(inboxBound·overflowed·push 후 shift)·topo-build(mailboxInboxBound→__mboxOpts).
- **한 줄 상태**: reg ALL OK(src=baseline=0098 비트 동일·월드해시 `0x7a122947`(seed42)… 보존)·E2E 14프로세스 비트동일·pinboxbound: 8 귓속말·ON inbox 4/overflowed 4/received 8 vs OFF inbox 8/overflowed 0·minted ON==OFF·spine 99-step ALL OK.
- **다음**: §2 참조(멤버별 Mailbox 토폴로지(0088 §9) · 파티 complete 발행(성공 종결·0093 §9) · 파티 cluster kill→replay 통합(0085 §9) · active 메아리 정리(0068 §9) · 거래소/우편/길드 · 비동기 결정론🔴). 이제 각 step 은 `src/` 닿는 박스만 제자리 수정.

---

## 2. NEXT — step-0044 후 가설 (후보, 권위는 이 절)

**step-0099 가 *Mailbox inbox 유계화*(inboxBound)를 닫아 수신함 세 차원(dedup seq·dedup epoch·inbox 적재) 유계화 완성(회계 received ⟂ 보유 inbox 분리). 기능 후보(우선): *파티 cluster kill→replay 통합*(별 프로세스·0085 §9)·*active 메아리 정리*(0068 §9)·*inbox 드레인*(읽음 확인·0099 §9)·*거래소/우편/길드*·*비동기 결정론*(🔴·0012 §9-3). 🔧 정리: buildTopology 24KB 단일 함수 — 더 자라면 구독 테이블 분리.**

**검증할 것(공통)**: ① **회귀 0**(새 항 OFF=직전 비트 동일) ② **신성한 tick**(존 tick 밖·비-침습) ③ **E2E 동치**(멀티프로세스=인프로세스·은닉) ④ **가설**(고장 주입·복구 수렴 증명).

**병행 백로그(블로킹 아님·전문은 §3·각 step 문서)**: ⬜ per-producer ack·fsync·anti-entropy·버스 라우팅 영속/분산·활성 중 다운타임+재발행·채팅 홉 신뢰·월드 영속·거래소/우편/길드·비동기 결정론(논리 클럭)·서버간 인증·재접속·티켓.

**빌드 인프라 — `engine/` 공유 커널 + `src/` 단일 소스(0049 전환)**: `engine/`=VM 커널·PRNG·FNV·`Net`·동결 `ISimCore`·`panel-kit`·`verify-kit`(누적 회귀·모드 추가만)·`close-step`·`new-step`. 코드는 **`src/` 제자리 수정** + `src/STEP` + `src/verify.js`(NETPREV=`../baseline` 고정) + `baseline/`(직전 동결 1벌·dual-mode). **step 절차**: ① `new-step.js`(src→baseline 스냅샷·STEP 전진) ② 닿는 박스만 Edit + verify 셸에 새 모드만 ③ `close-step.js` ④ 델타 1커밋+`git tag`. 정리 step: 0030·0035·0038·0043·0049·0053. *태그 원격 push 거부 환경=로컬만*.

**TESTBED 도구**: `run.js`(단일 진입점 — `node run.js`=src/·`spine`=src 누적 회귀·`<NNNN>`=현재 step·`report`·`scenario`·`live`) + `report.html`(녹화 레코더) + `live.js`(SSE). 훅 `onTick`·`inject`(write-seam·미제공=no-op→reg 0).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| 🔴 | **C++ 시뮬 코어 headless 빌드 (최우선)** | 월드 | 결정론 시뮬 코어가 UE 모듈(`Core`·`CoreUObject`·`GameplayTags`·`Json` 등)에 링크되면 'UObject 0' 이라도 UE 소스/UBT 없이 빌드 불가 → 원격 검증 불가. UE-모듈-free 코어 분리 또는 얇은 헤드리스 shim 필요(§4 불변). C++ 승격의 선결(0003 §8.2). |
| 🔴 | **비동기 실행 아래 결정론 (lockstep 배리어 해제·step-0014 후보)** | 코디네이션 | 0013 까지 결정론은 *중앙 lockstep 배리어*(broker 가 매 tick 전 프로세스 응답 대기)가 떠받친다. 진짜 비동기·노드 자유 진행·벽시계 타임아웃 곡선은 미착수 — 논리 클럭(Lamport/벡터)·인과 순서로 배리어 없이 결정론·소유자 1 보존이 후속(0012 §9-3·0013 §9-1). |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정 검증·대기열·만료(0001 §8.5). |
| ⬜ | **다중 클라 결정론 복제·예측** | 월드 | 0002~0004 의 결정론 복제·예측은 *C++ 시뮬 코어 승격*에서 부활(더미는 경량 라우터). 다중 클라 intent 인터리빙·예측/롤백(0001 §8.6). |
| ⬜ | **서버간 인증 없음** | 버스 | 존이 게이트웨이 발신을 암묵 신뢰(0001 §8.3) — 분산 시 필요. |
| 🟡 | **버스 단일점·분산·영속(동적구독·failover·무손실·replay 유계·lease·치유·대체활성화 ✅)** | 버스 | 0016 ServiceBus=단일 박스·영속 0. 동적구독→failover→무손실→lease→생애관측→self-healing→대체활성화(0033~0061). 남은 것: 라우팅 영속·다중 브로커·per-producer ack. |
| 🟡 | **서비스 영속·failover (가방·채팅 ✅+압축·파티 ✅·버스 ⬜)·존 넘는 거래** | 서비스/데이터 | 가방 저널(0017)+압축(0018)·채팅 로그(0021)+압축(0022)·파티 멤버십 저널(0085). write-behind 신뢰성(0023~0029). 단 버스 라우팅 영속 0. |
| 🟡 | **길드·거래소·우편(서비스 반복)·랭킹 ✅·읽기 모델 복구 ✅** | 서비스 | 0019 RankingService=발신 소비자(CQRS). 0020=읽기 모델 영속·late-join. 거래소·우편·길드 미착수. |
| 🟡 | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | 프레즌스 박스 0064~0070(분리·버스화·shadow·failover·자율감지·질의). 귓속말/파티 라우팅 0071~0097(라우팅·failover·1:N·멤버십 SSOT·영속·전달 신뢰·epoch 펜싱+유계화+grace·파티 종결/발행·멤버별 수신함·반송 발행). 남은 것: cluster kill→replay·존 배치·부하 분산·메아리 정리. |
| 🟡 | **캐시 + write-behind 영속 (가방·채팅 저널+압축·홉 신뢰·persist failover+N-replica+quorum+윈도 ✅·월드/fsync ⬜)** | 데이터 | PersistStore(0017·계층6 첫)=가방 저널+압축(0018). 홉 신뢰→failover→N-replica quorum→윈도(0023~0032). fsync 0·월드 영속 0. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속에서 뷰/권위 재구성 — 소실 권위의 고리 닫기. |

> **✅ 해소된 격차 (0001~0086)** — 전문은 §7 INDEX(1줄/step)·각 `step-NNNN.md`. 묶음: 골격~전송(01~04)·AOI~failover(05~09)·프로세스/TCP/버스/kill(10~13)·게임서비스 분리(14~16)·가방/채팅 영속+압축(17~22)·write-behind/quorum/윈도(23~32)·버스 동적구독~lease(33~52)·lease 관측→프레즌스 박스(54~70)·귓속말/파티 라우팅~멤버십 영속·압축(71~86).

> **상시 렌즈 — 척추** ([SPINE.md](SPINE.md) §5 필독): 매 step은 verify 4기둥 + 척추 체크 5항(① 신성한 tick ② 결정론 코어 ③ 권위 단일 소유 ④ 은닉·단일 연결 ⑤ headless·원격 검증)으로 판정. 분리 판정 기준: *그 일이 존 시뮬 tick 과 같은 박자로 돌아야 하는가?*

---

## 4. DURABLE CONSTRAINTS — 모든 step이 지킬 정전(canonical) 사실

> 여러 step이 반복 참조하는 불변. 새 step은 이걸 어기면 척추에서 벗어난 것 — 재설계.

- **회귀 0**: 새로 더한 항을 끄면(플래그=0) 직전 step과 **비트 단위 동일**(verify `reg`, maxDiff=0).
- **신성한 tick**: 존 시뮬 tick 안에 시뮬 외 작업(동기 I/O·인증·트랜잭션·팬아웃) 금지 — 전부 비동기 서비스/버스 경유.
- **결정론 코어**: 세계 상태의 쓰기 경로는 intent→결정론 시뮬 코어 하나. 같은 시드·로그 → 같은 해시. **`Math.random` 금지, 시드 의사난수만.**
- **권위 단일 소유**: 모든 상태 조각의 쓰기 권위는 정확히 한 곳(매 tick 소유자=1). 이동은 release+acquire **쌍 거래**/트랜잭션.
- **은닉·단일 연결**: 클라는 게이트웨이만 안다. 서버간은 버스/명시 인터페이스만 — 타 서버 내부·DB 직접 접근 금지.
- **수렴(desync 0)**: 클라 예측 뷰는 권위 재현으로 수렴. 겹친 뷰의 참여자는 조정 후 일치.
- **복제 = 재현, 상태 전송 아님**: `(seed+params+intent 로그)` 가 기본. 전체 스냅샷은 late-join·복구의 최후 수단.
- **Sim = 인터페이스 우선, C++ 최후 교체**: 존 시뮬은 *동결된 Sim 인터페이스* 뒤에 산다 — 오늘은 더미 구현(헤드리스), 인프라 전체를 원격 E2E 로 세운 뒤 인터페이스 무변경으로 얇은 C++ 호스트로 *교체만*. C++ 선-구축으로 원격 검증 루프를 끊지 않는다 ([TOOLS.md](TOOLS.md) §4·§6). 더미는 throwaway 가 아니라 인터페이스의 *첫 구현*.
- **headless·원격 검증(게임 시뮬 포함, 협상 불가)**: 모든 서버 동작 검증은 *결정론 시뮬 코어까지* Unreal Engine·GUI 없이 headless 로, 원격(이 환경/CI)에서 가능해야 한다. 더미=Node 라 자명히 충족 — C++ 승격 경로도 시뮬 *검증*에 UE 모듈을 링크하지 않는다. **'UObject 0' 으로는 부족**: 결정론 시뮬 코어가 UE 모듈(`Core`·`CoreUObject`·`GameplayTags`·`Json` 등)에 링크되면 headless 빌드 불가(§3 격차) → UE-모듈-free 코어 분리 또는 얇은 헤드리스 shim 으로 충족. 'UE 없이, 원격에서 빌드·통신·검증되는가'가 모든 박스(시뮬 포함)의 통과 조건 ([TOOLS.md](TOOLS.md) §1·§4).
- **수치 = verify 출력**: 모든 문서 수치는 시드 [42, 7, 1234, 99, 2026] 평균으로 재현.
- **코어 netcode 불변**: 결정론 시뮬 코어 순수성(UObject 0 — headless 빌드 가능) · 서버 권위(클라 읽기전용) · ISP 3-Layer · 시뮬 상태 직접쓰기 금지(intent 경유). 인프라는 *확장*하되 *깨지 않는다*.
- **한 step = 한 조각**: 더 떠올라도 다음으로 전가. 새 코어는 직전 코어를 잇고 박스/계약 하나만 더한다.
- **도구 = tick 판정 + 원격-검증** ([TOOLS.md](TOOLS.md)): tick 동기는 C++(결정론 시뮬 코어), 그 외는 원격에서 빌드·헤드리스 검증되는 도구(Go·Node·컨테이너). 시뮬만 무거운 빌드로 격리(시뮬 코어 "UObject 0" 순수성 = 얇은 헤드리스 호스트로 CI 빌드 가능 = 빌드 자산).
- **데이터 3분할** ([TOOLS.md](TOOLS.md) §3): ① 월드 영속 = intent 로그(event sourcing) + 스냅샷 ② 트랜잭션 진실 원천(가방·계정) = PostgreSQL→분산 SQL ③ Redis = 휘발/캐시(진실 원천 아님). 월드 상태를 DB 행으로 저장하지 않는다.

---

## 5. 6계층 진행 현황 ([SPINE.md](SPINE.md) §6)

| # | 계층 | 박스 | 상태 (현재 마커 + 핵심 step) |
|---|------|------|------|
| 1 | 엣지 | 로그인/인증 · 게이트웨이 | 🟡 0001 스텁(일회 티켓·단일 연결·은닉) + 0010 별 OS 프로세스 + 0046 게이트웨이 producer 네임스페이스(다중 게이트웨이 reqId 겹침→복합키). 대기열·만료·재접속·게이트웨이 군 풀 토폴로지 후속 |
| 2 | 월드 | 존 · 인스턴스 (분할·AOI·조정·핸드오프) | 🟡 0001 존 VM +0002~0004 결정론 복제·동결 Sim +0005 AOI +0006 분할·핸드오프(소유자=1) +0007 증분 AOI +0008 반응적 복원 +0009 failover +0010 별 프로세스 +0013 죽은 추종자 재충원(divergence 0·N≥2). 0002~0004 비트-결정론 복제는 C++ 승격에서 부활. 존 N개·동적 경계 후속 |
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 0014 가방·0015 채팅(단일 소유·쌍 거래·팬아웃·격리)→0016 버스+audit→0017~0022 가방/채팅 영속+압축·ranking 발신소비자·읽기모델 late-join→0023~0032 write-behind 신뢰성·persist failover/N-replica/quorum/윈도→대체 소비자 호(0061~0063 spawnReplace→reconstruct→presmon). **0071~0091 귓속말/파티 라우팅 호(wrouter)**: 프레즌스 질의(0069)의 라우팅 소비자 — 라우팅·failover 재타깃·파티 1:N·멤버십 SSOT(pservice)·전달 신뢰(0076~0082 영수증→재시도→상한→통지→dedup→유계화→실패발행)·파티(0083~0086 집계·증분 변경발행·영속·압축)·관측·ack 집계·epoch 펜싱+유계화+grace(0087~0091·상세 §7). 전부 별 프로세스·신성한 tick·권위 0. 거래소/우편/길드 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 0004 전송 substrate→0012 토픽 pub/sub→0016 서비스 의미(ServiceBus·발행자 무수정 소비자)→0019 발신 소비자→0033 동적 구독→0034 failover(진실원천=소비자)→0036/0037 결과/요청 무손실(producer replay)→0039~0042 replay 유계화·ack 자기조정→0044 min-워터마크→0045 lease→0046/0047 producer 네임스페이스→0048 lifecycle→0050~0052 적응형 leaseSpan·grace·cadence→0054 lease 관측. 버스 분산·per-producer ack·라우팅 영속 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 0001 레지스트리 +0009 Orchestrator(lease·failover) +0010~0013 broker(lockstep→TCP→버스 허브·분단/펜싱·kill·split-brain 0). 0054~0063 lease 관측→프레즌스 SSOT→self-healing 호(recover→ack→retry→포기→발행→spawnReplace→presmon). 프레즌스 박스 호(0064~0070): 전용 박스 분리(⟂orch)→보고 버스화→shadow→failover 승격→사망 자율 감지→질의 인터페이스→질의 failover 연속. 전 경로 failover-safe. broker 물리 분산·진짜 비동기·메아리 정리 후속 |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 0017 PersistStore 첫 박스(효과 저널·write-behind·kill→replay)→0018 스냅샷 압축→0020 읽기모델 복구원→0021~0022 채팅 영속·스냅샷→0023~0026 홉 신뢰(NAK·tail·give/mint)→0027~0029 failover/N-replica quorum→0031~0032 윈도 해소+유계 K→0062 대체 소비자 reconstruct. 증분 스냅샷·fsync·월드/버스 영속 후속 |

---

## 6. 빠른 참조

- 네트워크 인프라 큰 그림·계층 책임·씨앗 매핑·척추 체크 5항: [SPINE.md](SPINE.md)
- **도구·기술 스택(각 박스를 무엇으로 짓는가)·데이터 3분할·교차 관심사**: [TOOLS.md](TOOLS.md)
- **의외의 발견 / 정직한 한계 전문**: 각 `step-NNNN.md` (STATE는 중복 보관하지 않음 — 위 §3·§4가 현재 load-bearing 요약).

---

## 7. INDEX — 시리즈 검증 현황 (유일하게 append, 1행/step)

| step | 더한 한 조각 | 결과 (회귀 0 전제) |
|---|---|---|
| [0001](step-0001.md) | 최소 골격 토폴로지 (4박스+세션 계약) | 통과 · 은닉 0/47·비트 결정론 |
| [0002](step-0002.md) | 존 결정론 복제 (추종자 존+입력 미러 탭) | 통과 · 0/60 desync·전송 0바이트 |
| [0003](step-0003.md) | Sim 인터페이스 동결 (ISimCore v1·2구현·단일 seam) | 통과 · 구체 참조 0건 |
| [0004](step-0004.md) | 현실 전송(지연·손실·재정렬)+논리-tick (+engine/ 추출) | 통과 · redundancy 1→3 desync 597→0 |
| [0005](step-0005.md) | 멀티 클라+AOI 브로드캐스트 (EntityZone, 시뮬 0) | 통과 · seen==트루스·절감 51~68% |
| [0006](step-0006.md) | 공간 분할+존 간 권위 핸드오프 (EntityZone ×2) | 통과 · 소유자+in-flight=1·이중쓰기 0 |
| [0007](step-0007.md) | 증분 AOI(enter/exit/update+누적 재구성) | 통과 · 증분≡전체 288/288 |
| [0008](step-0008.md) | 전송 열화 아래 핸드오프+반응적 복원(ack/재전송·seq/NAK/keyframe) | 통과 · 손실 0~30% 위반 0·desync 0 |
| [0009](step-0009.md) | 추종자 승격 failover(shadow 복제·lease 감지·승격) | 통과 · 사망→소유자 1·gap→0 |
| [0010](step-0010.md) | 프로세스 경계 현실화(실 프로세스/IPC·broker lockstep) | 통과 · 멀티=인프로세스 |
| [0011](step-0011.md) | 실 TCP 소켓 전송 현실화(IPC 파이프→TCP·프레이밍) | 통과 · 실 소켓=인프로세스 |
| [0012](step-0012.md) | 버스 분산+네트워크 열화 내성(토픽 pub/sub·드롭+resend·분단·펜싱) | 통과 · split-brain 0 |
| [0013](step-0013.md) | 진짜 프로세스 kill 아래 failover(child.kill·소켓 close·epoch 펜싱) | 통과 · split-brain 0 |
| [0014](step-0014.md) | 가방 서비스 분리(아이템 원장을 존 tick 밖 비동기·단일 소유·쌍 거래) | 통과 · 소유자 1·spine 14 |
| [0015](step-0015.md) | 채팅 서비스 분리(채널 팬아웃 비동기·구독 라우팅·지역 격리·whisper) | 통과 · 누설 0·spine 15 |
| [0016](step-0016.md) | 이벤트 버스 서비스 층(발행/구독·직접 결합 제거·발행자 무수정 소비자) | 통과 · 결합 409~427→0·spine 16 |
| [0017](step-0017.md) | 가방 failover·영속(원장을 영속 저널서 재구성·event sourcing·계층6 첫) | 통과 · 복구==무재시작 |
| [0018](step-0018.md) | 가방 저널 스냅샷 압축(intent 로그+주기 스냅샷) | 통과 · 저널 92% 절감 |
| [0019](step-0019.md) | 발신하는 둘째 소비자(RankingService·CQRS) | 통과 · 투영==원장 |
| [0020](step-0020.md) | 읽기 모델 영속·late-join(crash→쓰기 저널 reconstruct) | 통과 · 투영==원장 |
| [0021](step-0021.md) | 채팅 영속·failover(crash→커맨드 로그 replay) | 통과 · kill→replay 투명 |
| [0022](step-0022.md) | 채팅 커맨드 로그 스냅샷 압축(스냅샷+tail replay) | 통과 · 로그 78→3 |
| [0023](step-0023.md) | 저널 홉 신뢰 전달(write-behind 홉 갭 NAK+재전송) | 통과 · ON 완전 vs OFF 갭·spine 23 |
| [0024](step-0024.md) | 저널 홉 tail 손실 감지(heartbeat→tail NAK) | 통과 · tail ON 완전·spine 24 |
| [0025](step-0025.md) | in-flight give 손실 복구(give-resend→belief 재수렴) | 통과 · ON itemDesync 0 |
| [0026](step-0026.md) | in-flight mint 손실 복구: id-reconciliation(belief→re-mint) | 통과 · desync/dupe 0 |
| [0027](step-0027.md) | PersistStore failover: 이중쓰기 보조 persist(primary+backup) | 통과 · crash 무손실 |
| [0028](step-0028.md) | PersistStore N-replica+quorum: fan-out·생존 union 복구 | 통과 · 생존3 union==base |
| [0029](step-0029.md) | PersistStore quorum 쓰기 ack: W 정족수 후 durable | 통과 · durableSeq T-1 |
| [0030](step-0030.md) | 정리: 박스 1개=파일 1개 분할 + engine 승격(verify-kit)+닫기 게이트 | 통과 |
| [0031](step-0031.md) | 정합성 윈도 해소(quorum-fill — sweep 이 W 미달 seq 재-fan-out) | 통과 · durSeq total-1/윈도 0 |
| [0032](step-0032.md) | 윈도 해소 유계 sweep+fill retry(wfWindow K 창) | 통과 · K=8 durSeq=total-1 |
| [0033](step-0033.md) | 버스 동적 구독/해지(runtime unsub/sub) | 통과 · unsub@15→re-sub@18 |
| [0034](step-0034.md) | 버스 failover(bus.crash()→재협상·진실원천=소비자) | 통과 · crash@12→재협상@14 |
| [0035](step-0035.md) | 정리: cluster.js 박스-부품 4분할(45KB>30KB·기능 0) | 통과 · ≤19.7KB |
| [0036](step-0036.md) | 버스 failover 결과 경로 무손실(producer replay) | 통과 · desync 6→0 |
| [0037](step-0037.md) | 버스 failover 요청 경로 무손실(gateway replay+reqId dedup) | 통과 · minted==base |
| [0038](step-0038.md) | 정리: topology.js 박스-부품 분할(31KB>30KB·기능 0) | 통과 |
| [0039](step-0039.md) | 버스 replay 버퍼 유계화(busWindow 슬라이딩 K 창) | 통과 · desync 0 vs tiny 4 |
| [0040](step-0040.md) | 요청 replay 버퍼 자기조정(busAck — reqId ack→워터마크) | 통과 |
| [0041](step-0041.md) | 결과 replay 버퍼 자기조정(busOutAck — outSeq ack→가지치기) | 통과 · desync 0 vs K8 4 |
| [0042](step-0042.md) | seenReqs dedup 유계화(busSeenBound — inAcked 워터마크) | 통과 · peak 60→24 |
| [0043](step-0043.md) | 정리: `svc-inventory.js` 박스-부품 3분할(34KB>30KB·기능 0) | 통과 · ≤19.6KB |
| [0044](step-0044.md) | 다중 소비자 min-워터마크(busMinWm — 결과 버퍼=모든 소비자 frontier 최소) | 통과 · 비대칭 F vs min T |
| [0045](step-0045.md) | 소비자 lease/축출(busConsumerLease — 침묵 길이로 죽은 소비자 축출) | 통과 · OFF peak∝run vs ON 유계 |
| [0046](step-0046.md) | 게이트웨이 producer 네임스페이스(busProducerNs — (producer,reqId) 복합키) | 통과 · OFF Δ0 vs ON Δ5 |
| [0047](step-0047.md) | per-producer seen 워터마크(busSeenNs — 복합키 producer 별 가지치기) | 통과 · OFF peak∝run vs 유계 |
| [0048](step-0048.md) | 소비자 lease lifecycle(busLeaseLife — never-ack 축출·재admission 가역) | 통과 · outBuf 유계·readm 1 |
| [0049](step-0049.md) | 단일 살아있는 소스 src/ 전환(복사 전진 폐기·기능 0·reg 0) | 통과 · src=baseline=0048 |
| [0050](step-0050.md) | 적응형 leaseSpan(busLeaseAdapt — 축출 임계를 ack cadence 로 self-size) | 통과 · 고정 flapping vs 적응 ev=1 |
| [0051](step-0051.md) | 시작 cadence prior(busLeaseGrace — 적응형 lease bootstrap floor) | 통과 · grace ev=0 vs 적응만 1 |
| [0052](step-0052.md) | 윈도 cadence(busCadenceWindow — 추정=최근 K gap max·감쇠) | 통과 · stall 후 OFF 60 vs ON 0 |
| [0053](step-0053.md) | 정리: 트랜잭션 onMsg 를 svc-inventory-txn.js 로 추출(core 31.9→25.5KB·기능 0) | 통과 · spine 53 |
| [0054](step-0054.md) | lease 생애 관측(busLeaseAudit — 축출/재admission→audit) | 통과 · 전이 관측 |
| [0055](step-0055.md) | lease 생애 반응(busLeasePresence — orch lease 소비→consumerDown) | 통과 · down==evicted |
| [0056](step-0056.md) | 프레즌스 반응(self-healing·busPresenceRecover — recover→재구독→readmit) | 통과 · 각 1 |
| [0057](step-0057.md) | 치유 확인 고리(recoverAck — 재구독하며 orch 에 회신→수행 확인) | 통과 · sent==acks==1 |
| [0058](step-0058.md) | 미확인 명령 재시도(recoverRetry — recoverTimeout 뒤 재발신) | 통과 · ON retries 2·ack 1 |
| [0059](step-0059.md) | 재시도 상한(recoverMaxRetries — 도달 시 permanentDown 포기) | 통과 · retries 3·givenUp 1 |
| [0060](step-0060.md) | 프레즌스 발행(presencePublish — down/up/permanent→svc.presence→audit) | 통과 · 치유/영구→audit 1:1 |
| [0061](step-0061.md) | 대체 소비자 자동 활성화(spawnReplace — standby 가 svc.presence 'permanent' 에 자기 활성화·인계) | 통과 · permanent→인계 |
| [0062](step-0062.md) | 대체 소비자 late-join reconstruct(spawnReconstruct — 쓰기 저널로 다운타임 갭 복원) | 통과 · 투영==원장 |
| [0063](step-0063.md) | 프레즌스 모니터(presenceMonitor — svc.presence 구독→소비자별 건강 상태 기계) | 통과 · events 2/2 |
| [0064](step-0064.md) | 전용 프레즌스 박스 분리(presenceBox — orch SSOT+발행→PresenceService·⟂orch) | 통과 · orch pub 0 |
| [0065](step-0065.md) | 프레즌스 보고 버스화(presenceReportBus — 보고를 svc.presence.report 토픽으로) | 통과 · presmon ON==OFF |
| [0066](step-0066.md) | 프레즌스 shadow 복제(presenceShadow — standby 가 같은 보고로 SSOT 그림자) | 통과 · shadow==primary |
| [0067](step-0067.md) | 프레즌스 failover 승격(presencePromote — crash→standby promote·shadow 갭 0) | 통과 · 승격 분담 |
| [0068](step-0068.md) | 프레즌스 사망 자율 감지(presenceLease — hb 침묵 hbTimeout→자기 승격) | 통과 · 자율 승격 |
| [0069](step-0069.md) | 프레즌스 SSOT 질의 인터페이스(presenceQuery→presenceReply·stateOf pull) | 통과 · 질의↔응답 4/4 |
| [0070](step-0070.md) | failover 중 질의 연속성(presenceAnnounce — svc.presence.active 공지→재타깃) | 통과 · 죽음 후 2/2 |
| [0071](step-0071.md) | 귓속말 라우터(whisperRouter — 프레즌스 질의→up 전달/permanent 반송·첫 라우팅 소비자) | 통과 · routed 1/bounced 1·OFF null |
| [0072](step-0072.md) | 귓속말 라우터 failover(whisperFailover — 승격 공지 구독→queryAddr 재타깃) | 통과 · 사망 후 routed 1 vs OFF 손실 |
| [0073](step-0073.md) | 파티 라우터(1:N 팬아웃 — 멤버마다 질의→부분 전달) | 통과 · routed 2/bounced 1 |
| [0074](step-0074.md) | 재타깃 윈도 질의 재시도(whisperRetry — 보류 질의 재발신·읽기 at-least-once) | 통과 · ON retries 2→pending 0 vs OFF 2(손실) |
| [0075](step-0075.md) | 파티 멤버십 SSOT(partyService — 멤버십⟂라우팅·partyTo→질의→멤버십→프레즌스 2단) | 통과 · resolved 3·routed 2/b 1 vs OFF null |
| [0076](step-0076.md) | 전달 영수증(whisperReceipt — seq/ackTo·inflight 보류·Mailbox whisperAck→delivered) | 통과 · delivered 1·mbox 1/1 vs OFF 0 |
| [0077](step-0077.md) | 전달 손실 재시도(whisperDeliverRetry — deliverTimeout 경과 inflight 재발신·at-least-once) | 통과 · ON delivered 1 vs OFF 0·inflight 1(갇힘) |
| [0078](step-0078.md) | 전달 재시도 상한(deliverMaxRetries — tries≥상한 포기·undeliverable) | 통과 · ON undel 1 vs OFF 무상한 12 |
| [0079](step-0079.md) | 전달 포기 통지(deliverNotify — 포기 시 발신자에 deliveryFailed 회신) | 통과 · ON failedNotified 1 vs OFF 0 |
| [0080](step-0080.md) | 수신측 dedup(deliverDedup — Mailbox seq 기억·중복 재적재 차단·재-ack·exactly-once) | 통과 · ON dup 1 vs OFF 0(중복 적재) |
| [0081](step-0081.md) | dedup seen 유계화(deliverDedupBound — 연속 워터마크+희소 비순차 집합으로 O(gap)) | 통과 · ON seenSize 0/wm 12 vs OFF 12(∝run)·dup 1 보존 |
| [0082](step-0082.md) | 전달 실패 발행(failedPublish — 포기 시 svc.whisper.failed 발행·audit·통지와 직교) | 통과 · ON failedPub 1/audit 1 vs OFF 0 |
| [0083](step-0083.md) | 파티 1:N 영수증 집계(partyReceipt — partyId 별 {members,routed,bounced} 원장·N-of-M) | 통과 · ON {3,2,1}/done vs OFF size 0 |
| [0084](step-0084.md) | 증분 가입/탈퇴+변경 발행(partyChange — Join/Leave 델타·svc.party.changed) | 통과 · ON 발행 2/audit 2 vs OFF 0 |
| [0085](step-0085.md) | 파티 멤버십 영속·failover(partyPersist — 변경 저널 replay·crash→reconstruct) | 통과 · reconstruct [b,c] vs OFF 소실 |
| [0086](step-0086.md) | 파티 저널 스냅샷 압축(partySnapshot — 스냅샷+저널 가지치기·tail replay) | 통과 · ON tail 2 vs OFF 6·[a..f] 무손실 |
| [0087](step-0087.md) | 전달 수명주기 관측(deliveredPublish — whisperAck 시 svc.whisper.delivered 발행·audit) | 통과 · ON pub 1/audit 1 vs OFF 0 |
| [0088](step-0088.md) | 파티 ack 집계(partyAckTally — whisperAck→파티 delivered 집계·acked=delivered==routed) | 통과 · ON {routed 1,delivered 1}·acked vs OFF size 0 |
| [0089](step-0089.md) | producer epoch 워터마크(epochKeyed — restart 시 epoch++·Mailbox (prod,epoch) 키) | 통과 · restart 후 ON received 12/dup 0 vs OFF 6/6(유실) |
| [0090](step-0090.md) | epoch 워터마크 유계화(epochBound — 높은 epoch 도착 시 낮은 epoch 가지치기·현재 epoch 만) | 통과 · 3재시작·ON epochKeys 1 vs OFF 4(∝epoch)·received 8/dup 0 |
| [0091](step-0091.md) | 옛 epoch grace 유예(deliverEpochGrace — 최근 N개 닫힌 epoch 유예·지연 straggler dedup·N+1 유계) | 통과 · straggler ON received 4/dup 1 vs OFF 5(누수)·spine 91 |
| [0092](step-0092.md) | 파티 ack 타임아웃 포기(partyAckGiveup — 멤버 전달 포기를 파티 failed 귀속·partyIncomplete 종결·0078 N-of-M 판) | 통과 · ON rec{routed 2,delivered 1,failed 1}/incomplete vs OFF failed 0/보류·spine 92 |
| [0093](step-0093.md) | 파티 incomplete 발행(partyIncompletePublish — 부분 전달 실패 종결을 svc.party.incomplete 로 발행·audit 관측·0082 의 파티 판) | 통과 · ON pub 1/audit 1 vs OFF 0/0·minted ON==OFF·spine 93 |
| [0094](step-0094.md) | 정리: svc-whisper 박스-부품 분할(33KB>30KB — core/handlers/entry·Object.assign 프로토타입·기능 0) | 통과 · src=baseline 비트 동일·박스 33→12/10/1KB·spine 94 |
| [0095](step-0095.md) | 파티 complete 발행(partyCompletePublish — 전원 acked 성공 종결을 svc.party.complete 로 발행·audit·0093 incomplete 와 짝) | 통과 · ON pub 1/audit 1 vs OFF 0/0·spine 95 |
| [0096](step-0096.md) | 멤버별 Mailbox 토폴로지(mailbox2 — 둘째 수신함·파티원마다 ack 가능·0088 §9 해소) | 통과 · ON routed 2/delivered 2/acked true vs OFF delivered 1/acked false·spine 96 |
| [0097](step-0097.md) | 귓속말 반송 발행(bouncePublish — down/permanent 반송을 svc.whisper.bounced 발행·audit·전달 결말 셋째) | 통과 · ON pub 1/audit 1 vs OFF 0/0·둘 다 bounced 1·spine 97 |
| [0098](step-0098.md) | 정리: topo-build 박스-부품 분할(32KB>30KB — topo-actors.js 로 makeActor·routeFilters 분리·기능 0) | 통과 · src=baseline 비트 동일·박스 32→28.5/4.9KB·spine 98 |
| [0099](step-0099.md) | Mailbox inbox 유계화(inboxBound — inbox 최근 K cap·received 보존·수신함 inbox 차원 유계) | 통과 · ON inbox 4/overflow 4 vs OFF inbox 8/overflow 0·received 8 보존·spine 99 |
