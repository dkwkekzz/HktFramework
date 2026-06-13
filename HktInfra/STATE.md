# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(에이전트 효율 — 토큰이 step 수에 비례해 터지지 않게 *강제*)**: 이 파일은 *고정 크기 대시보드*다. §1~6은 step을 닫을 때마다 **덮어쓴다(rewrite)** — 누적하지 않는다. 오직 §7 INDEX만 **literal 1줄** append(`step | 조각 | 통과+핵심수치 1개` — *문단 금지*). 발견/한계의 *전문*은 STATE가 아니라 `step-NNNN.md`에 산다. **세 가지 누적 함정 금지**: ① §5 에서 큰 그림 진척을 step별로 *재나열*하지 말 것 — 현재 마커 + 핵심 step 목록만 ② §3 에서 ✅해소된 격차를 전문 보존하지 말 것 — *한 줄로 떨어뜨린다* ③ §4 는 *여러 step 이 반복 참조하는 불변*만. 닫힌 step 의 발견·한계 전문은 각 `step-NNNN.md`(역사의 SSOT), 1줄 요약은 §7 INDEX. 마커: ✅해소 🟡부분 🔴열림(최우선) ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0033](step-0033.md) — **버스 동적 구독/해지(runtime sub/unsub)**: 버스 failover(STATE §2 ⒝)의 선결. 0016 이래 정적 선언 spec 뿐이던 버스 라우팅 테이블에 `unsub`(sub seam 의 대칭) + 런타임 양방향 변경을 더한다. 토글은 *그 (소비자,토픽) 행* 만 바꾸고 공동 구독자·발행자는 비트 동일. 닿는 파일 svc-bus.js·topology.js 둘뿐(cluster.js 무수정).
- **한 줄 상태**: 검증 reg 25/25(0032 비트 동일)·신규 busdyn: audit 의 svc.item.out unsub@15→re-sub@18 → A0=60/A_unsub=30/A_resub=42(gap 손실 12·at-most-once)·ranking(공동 구독자) R0=R1=R2·발행자 pub 동일·audit 다른 토픽 동일·보존/정합/desync 0. 18+1모드 ALL OK·spine **33-step 사슬**·close-step 게이트 통과.
- **다음**: §2 참조 — 버스 영속·failover 본체(동적 구독 ✅ 깔림 → 라우팅 영속+이력 replay) · 비동기 결정론(🔴 최우선) · 활성 중 다운타임 일반 재발행 · 정리(cluster.js 45KB 재분할).

---

## 2. NEXT — step-0033 후 가설 (후보, 권위는 이 절)

**step-0033 이 버스 *동적 구독/해지*(runtime sub/unsub)로 버스 failover 의 선결을 깔았다(라우팅 테이블 런타임 양방향 변경 — 토글은 그 소비자만·공동 구독자/발행자 비트 동일). 다음 후보: ⒝ *버스 영속·failover 본체*(이제 동적 구독 ✅ — 라우팅 테이블 영속(저널/스냅샷) + 죽은 버스→backup 재협상 + 이력 replay 로 gap 무손실. 0027 이중쓰기·0028 N-replica 패턴의 버스 판·0016 §9-2), ⒞ *활성 중 서비스 다운타임 일반 재발행*(0025/0026 은 quiescent — 온라인 kill+재발행 핸드셰이크), ⒟ *비동기 결정론(lockstep 배리어 해제)*(논리/벡터 클럭·🔴 최우선·broker=cluster.js 대공사·0012 §9-3), 🔧 *정리 step*(cluster.js 45KB>30KB 박스 트리거 재분할·기능 0·reg 0).**

남은 격차: ⓐ 버스·월드 *영속 0*·서비스 복구 *활성 중 다운타임 일반형 미검증* ⓑ 스냅샷 *비유계*·압축 *단일 트리거*·재전송 amplification·heartbeat×압축 미결합·채팅 in-flight/홉 신뢰 미적용 ⓒ 디스크 fsync 0·복제 anti-entropy 0·빠른 retry(ack 타임아웃)·ack-손실×신뢰 스토어(0032 §9) ⓓ 비동기 결정론(lockstep 배리어) ⓔ give-resend opSeq 견고화·clientResync 멀티프로세스 패리티(0025 §9ⓕⓖ).

**검증할 것(공통)**: ① **회귀 0** — 새 항 OFF 면 0032 비트 동일. ② **신성한 tick** — 새 항이 존 tick 밖·존 비-침습. ③ **E2E 동치** — 멀티프로세스=인프로세스 비트 동일·은닉. ④ **가설** — 선택한 조각의 고장 시나리오 주입·복구 수렴 증명.

**병행 백로그(블로킹 아님)**: ⬜ fill 재발신 손실 retry·sweep 범위 bound·적응형 주기·디스크 fsync·복제 anti-entropy(0031 §9·0029 §9) · ⬜ 버스 영속·failover·분산·동적 구독·이력/replay(0016 §9-2·§9-3) · ⬜ 활성 중 서비스 다운타임 + 재발행 핸드셰이크(0020~0022 §9) · ⬜ give-resend opSeq 매칭·clientResync 멀티프로세스 패리티(0025 §9ⓕⓖ) · ⬜ 재전송 amplification 배칭·heartbeat×압축 결합·채팅 in-flight/홉 신뢰(0023/0024 §9) · ⬜ 읽기 모델 증분 follow·증분 스냅샷·압축 트리거 다양화(0018/0020/0022 §9) · ⬜ 월드 영속(존 intent 로그·tick-결합 고위험) · ⬜ 런타임 consume→publish 사이클 정적 탐지(0019 §9) · ⬜ 거래소·우편·길드(서비스 반복)·존 넘는 거래·2-party 에스크로(0014 §9-2) · ⬜ 비동기 결정론(논리 클럭·0012 §9-3) · ⬜ 분산/월드 심화 묶음 · ⬜ 서버간 인증·재접속·티켓 만료. (✅ 해소분 0014~0028 = §3 ✅ 묶음·§7 INDEX 참조.)

**빌드 인프라 — `engine/` 한 곳(0004 추출·0030 확장)**: `engine/index.js`(VM 커널·PRNG·FNV·`Net`·스텁·동결 `ISimCore`) · `panel-kit.js`(관찰) · **`verify-kit.js`(0030 — 누적 회귀 18모드 팩토리·모드 제거 금지/추가만)** · **`close-step.js`(0030 — 닫기 게이트: 검증+크기 예산+산출물 한 줄)** · `new-step.js`(복사 전진 스캐폴드·flat 파일만). 코어는 **dual-mode**. **step 절차(0030 부터·0031 실증)**: ① `node engine/new-step.js` → scaffold 커밋(기계 복사분 분리 — 2-커밋 관행) ② 닿는 박스 파일만 Edit(박스 1개=파일 1개 — 0031 은 svc-inventory.js+topology.js 2개) + verify.js 셸에 새 모드만 `kit.MODES['<mode>']=fn`·`kit.ORDER.splice` 추가(0031 wfill·0032 wfretry 선례 — 가설 모드는 셸 한정·키트엔 누적 회귀 18모드만) ③ `node engine/close-step.js` 로 닫기 ④ 델타 커밋. 출발 템플릿 = `step-0032/`(분할 구조).

**TESTBED 도구(0010 후 구현·동결 step 무수정)**: `run.js`(검증 단일 진입점 — `node run.js`·`spine`·`<NNNN>`·`report`·`scenario`·`live`) + 자기완결 `report.html`(녹화 레코더·공간 위치+AOI 맵) + `live.js`(SSE). 훅 `onTick`·verify `scenario <file>`(trace 4기둥 단언)·scenario `inject`(net-core write-seam·미제공=no-op→reg 0·`NET.SUPPORTS.inject` 기능 탐지) 전부 ✅. 새 박스 추가 시 run.js 의 addr→layer 선언 맵만 갱신(TESTBED §10-5).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| 🔴 | **C++ 시뮬 코어 headless 빌드 (최우선)** | 월드 | 결정론 시뮬 코어가 UE 모듈(`Core`·`CoreUObject`·`GameplayTags`·`Json` 등)에 링크되면 'UObject 0' 이라도 UE 소스/UBT 없이 빌드 불가 → 원격 검증 불가. UE-모듈-free 코어 분리 또는 얇은 헤드리스 shim 필요(§4 불변). C++ 승격의 선결(0003 §8.2). |
| 🔴 | **비동기 실행 아래 결정론 (lockstep 배리어 해제·step-0014 후보)** | 코디네이션 | 0013 까지 결정론은 *중앙 lockstep 배리어*(broker 가 매 tick 전 프로세스 응답 대기)가 떠받친다. 진짜 비동기·노드 자유 진행·벽시계 타임아웃 곡선은 미착수 — 논리 클럭(Lamport/벡터)·인과 순서로 배리어 없이 결정론·소유자 1 보존이 후속(0012 §9-3·0013 §9-1). |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정 검증·대기열·티켓 만료(0001 §8.5). |
| ⬜ | **다중 클라 결정론 복제·예측** | 월드 | 0002~0004 의 결정론 복제·예측은 *C++ 시뮬 코어 승격*에서 부활(더미는 경량 라우터). 다중 클라 intent 인터리빙·예측/롤백(0001 §8.6). |
| ⬜ | **서버간 인증 없음** | 버스 | 존이 게이트웨이 발신을 암묵 신뢰(0001 §8.3) — 분산 시 서버간 인증 필요. |
| 🟡 | **버스 단일점·분산·영속(동적 구독 ✅)** | 버스 | 0016 ServiceBus = *단일 박스·영속 0*(죽으면 서비스 경로 단절 — 새 단일점). **0033 동적 구독/해지 ✅**(런타임 `unsub`/`sub` — 라우팅 테이블 양방향 변경·토글은 그 소비자만·gap=at-most-once). 남은 것: 라우팅 *영속 0*·이력/replay 0·구독자 장애 감지 0·다중 브로커 분산(0012 §9-1)·버스 failover 본체. 월드·제어 평면·존간 핸드오프는 직접 유지(의도). |
| 🟡 | **서비스 영속·failover (가방 ✅+압축 ✅+저널홉 신뢰·tail·in-flight give·mint ✅·채팅 ✅+압축 ✅·버스 ⬜)·존 넘는 거래** | 서비스/데이터 | 가방=event sourcing 효과 저널(0017·복구 투명)+스냅샷 압축(0018). 채팅=커맨드 로그 소싱(0021)+압축(0022). write-behind 신뢰성 체인 0023~0026·영속 failover 0027~0029(§7 INDEX 전문). 단 버스 라우팅 *영속 0*·채팅 in-flight/홉 신뢰 미적용·가방 일방 give(2PC 없음·0014 §9-2). |
| 🟡 | **길드·거래소·우편(서비스 반복)·랭킹 ✅·읽기 모델 복구 ✅** | 서비스 | 0019 RankingService = *발신하는 소비자*(consume→publish·CQRS·발행자 무수정·프로젝션==원장). 0020 = *읽기 모델 영속·late-join*(랭킹 crash→쓰기 저널 reconstruct·자기 영속 0·투영==원장 — 0019 §9 해소). 단 *quiescent restart 만*(활성 중 다운타임+재발행 미검증·0020 §9)·증분 follow 0·런타임 사이클 탐지 0. 거래소·우편·길드는 반복 미착수. |
| ⬜ | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | "누가 어디에" SSOT·존 배치·부하 분산·인스턴스 spawn. |
| 🟡 | **캐시 + write-behind 영속 (가방·채팅 저널+압축 ✅·저널홉 신뢰+tail+in-flight give/mint ✅·persist failover+N-replica+quorum read/write ✅·윈도 해소 ✅·월드/fsync ⬜)** | 데이터 | PersistStore(0017·계층 6 첫 박스) = 가방 효과 저널(write-behind)+스냅샷 압축(0018). 저널홉 신뢰 수신·tail·in-flight 복구 0023~0026. failover 0027(이중쓰기)·N-replica quorum-read 0028·quorum-write ack 0029(durableSeq 워터마크·정합성 윈도 가시)·**윈도 해소 0031(quorum-fill)+유계 sweep·fill 손실 retry 0032**·전문 §7 INDEX. 단 *디스크 fsync 0·복제 anti-entropy 0·빠른 retry(ack 타임아웃) 0·스냅샷 비유계·월드 영속 0* — 0032/0029/0018 §9. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속에서 뷰/권위 재구성 — 소실 권위의 고리 닫기. |

> **✅ 해소된 격차 (0001~0028)** — 전문은 §7 INDEX(1줄/step)·각 `step-NNNN.md`. 묶음: 골격/복제/Sim 동결/현실 전송(0001~0004)·AOI·공간 분할·핸드오프·증분·반응적 복원·failover(0005~0009)·프로세스 경계·TCP·버스 분산·진짜 kill failover(0010~0013)·게임 서비스 분리(가방 0014·채팅 0015)·이벤트 버스 의미(0016)·가방 영속+압축(0017~0018)·발신 소비자·읽기 모델 영속(0019~0020)·채팅 영속+압축(0021~0022)·write-behind 신뢰성 완결: 중간 갭 NAK(0023)+tail heartbeat(0024)+in-flight give 복구(0025)+in-flight mint id-reconciliation(0026)·PersistStore 이중쓰기 backup(0027)·N-replica + quorum-read 복구(0028)·quorum write ack — durable 선언 정확성·정합성 윈도 가시(0029)·**정합성 윈도 해소 — quorum-fill 로 W 미달 seq durable 전환(0031)**.

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
| 1 | 엣지 | 로그인/인증 · 게이트웨이 | 🟡 0001 스텁(일회 티켓·단일 연결·은닉) + 0010 별 OS 프로세스. 대기열·만료·재접속 후속 |
| 2 | 월드 | 존 · 인스턴스 (분할·AOI·조정·핸드오프) | 🟡 0001 존 VM +0002~0004 결정론 복제(현실 전송)·동결 Sim +0005 AOI +0006 분할·핸드오프(소유자=1) +0007 증분 AOI +0008 반응적 복원 +0009 failover +0010 별 프로세스 +0013 죽은 추종자 재충원(재-provisioning·divergence 0·N≥2). 0002~0004 비트-결정론 복제는 C++ 승격에서 부활. 존 N개·동적 경계 후속 |
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 0014 가방·0015 채팅(단일 소유·쌍 거래·팬아웃·지역 격리) →0016 버스 발행/구독+audit →0017~0018 가방 failover·영속·스냅샷 →0019~0020 ranking(발신 소비자)·읽기모델 late-join →0021~0022 채팅 영속·스냅샷 →0023~0026 write-behind 신뢰성 완결(홉 NAK·tail·in-flight give/mint 복구) →0027~0029 persist failover·N-replica·quorum write ack →0031~0032 정합성 윈도 해소·유계 sweep+retry(전문 §7). 전부 별 프로세스·tick 무관·신성한 tick·E2E 비트 동일·은닉. 활성 중 다운타임 일반 재발행·버스 영속·거래소/우편/길드 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 0004 전송 substrate(`engine/Net`) +0008 핸드오프/델타 라우트 +0010 IPC +0011 실 TCP 소켓 와이어 +0012 토픽 pub/sub 버스(*전송*·소켓 층 열화 내성) +0016 **서비스 의미**(ServiceBus — 발행/구독 계약·gateway↔service 직접 결합 0·발행자 무수정 소비자 추가) +0019 **발신 소비자**(ranking 이 svc.item.out 둘째 소비자로 구독→svc.rank.out 발행 = consume→publish 루프·발행자 무수정·루프 없음) +0033 **동적 구독/해지**(runtime `unsub`/`sub` — 라우팅 테이블 양방향 변경·토글은 그 소비자만·공동 구독자/발행자 비트 동일·gap=at-most-once = 버스 failover 의 선결). 버스 단일점 제거(분산·failover)·라우팅 영속·이력/replay·런타임 사이클 탐지·서버간 인증 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 0001 레지스트리 +0009 Orchestrator(lease·failover) +0010 broker(lockstep 배리어) +0011 broker=TCP 서버 +0012 broker=버스 허브·분단 감지·펜싱 +0013 진짜 kill(소켓 close 감지)·타임아웃 추측(거짓 사망)·epoch 펜싱·재-provisioning(split-brain 0·소유자 1). broker 물리 분산·분산 epoch·진짜 비동기(배리어 해제) 후속 |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 0017 PersistStore 첫 박스 — 가방 효과 저널(event sourcing·write-behind)·진짜 kill→replay →0018 스냅샷 압축 →0020 같은 저널이 읽기모델 복구원 →0021~0022 채팅 영속·스냅샷 →0023~0026 홉 신뢰(NAK·dedup·tail·in-flight give/mint 복구) →0027 failover(이중쓰기 backup) →0028 N-replica quorum-read(생존 union·부분쓰기 무손실) →0029 quorum write ack(`durableSeq` 워터마크·정합성 윈도 가시) →0031~0032 윈도 해소(`windowFill` sweep)+유계 K 창·fill 손실 retry(전문 §7). 증분 스냅샷·디스크 fsync·복제 anti-entropy·빠른 retry·월드/버스 영속 후속 |

---

## 6. 빠른 참조

- 네트워크 인프라 큰 그림·계층 책임·씨앗 매핑·척추 체크 5항: [SPINE.md](SPINE.md)
- **도구·기술 스택(각 박스를 무엇으로 짓는가)·데이터 3분할·교차 관심사**: [TOOLS.md](TOOLS.md)
- **의외의 발견 / 정직한 한계 전문**: 각 `step-NNNN.md` (STATE는 중복 보관하지 않음 — 위 §3·§4가 현재 load-bearing 요약).

---

## 7. INDEX — 시리즈 검증 현황 (유일하게 append, 1행/step)

| step | 더한 한 조각 | 결과 (회귀 0 전제) |
|---|---|---|
| [0001](step-0001.md) | 최소 골격 토폴로지 (4박스+세션 계약) | 통과 · E2E 수명주기·은닉 0/47·비트 결정론(골든 5종) |
| [0002](step-0002.md) | 존 결정론 복제 (추종자 존+입력 미러 탭) | 통과 · 0/60 desync·상태 전송 0바이트·회귀 0 |
| [0003](step-0003.md) | Sim 인터페이스 동결 (ISimCore v1·2구현·단일 seam) | 통과 · 표현 무관 비트 동일·구체 시뮬 참조 0건 |
| [0004](step-0004.md) | 현실 전송(지연·손실·재정렬)+논리-tick 스케줄링 (+engine/ 추출) | 통과 · 타이밍↔내용 분리·redundancy 1→3 desync 597→0 |
| [0005](step-0005.md) | 멀티 클라+AOI 브로드캐스트 (EntityZone, 시뮬 0) | 통과 · seen==트루스·절감 51~68%·재현 결정론 |
| [0006](step-0006.md) | 공간 분할+존 간 권위 핸드오프 (EntityZone ×2) | 통과 · 소유자+in-flight=1·이중쓰기/공백 0·지연 1tick |
| [0007](step-0007.md) | 증분 AOI (enter/exit/update+누적 재구성) | 통과 · 증분≡전체 288/288·대역폭 절감 19~33% |
| [0008](step-0008.md) | 전송 열화 아래 핸드오프+반응적 복원 (ack/재전송·seq/NAK/keyframe) | 통과 · 손실 0~30% 권위 위반 0·최종 desync 0 수렴 |
| [0009](step-0009.md) | 추종자 승격 failover (shadow 복제·lease 감지·승격) | 통과 · 사망→소유자 1 회복·bounded gap→0·이중쓰기 0 |
| [0010](step-0010.md) | 프로세스 경계 현실화 (실 프로세스/IPC·broker lockstep) | 통과 · 멀티프로세스=인프로세스 비트 동일·9 구분 pid·공유 메모리 0 |
| [0011](step-0011.md) | 실 TCP 소켓 전송 현실화 (IPC 파이프→TCP·프레이밍) | 통과 · 실 소켓=인프로세스 비트 동일·결정론=*순서*의 함수 |
| [0012](step-0012.md) | 버스 분산+실 네트워크 열화 내성 (토픽 pub/sub·드롭+resend·분단·펜싱) | 통과 · 링크 분단=deathTick 비트 동일·소유자 1·split-brain 0·멱등 effectively-once |
| [0013](step-0013.md) | 진짜 프로세스 kill 아래 failover (실 child.kill·소켓 close/타임아웃 추측 감지·재-provisioning·거짓 사망 epoch 펜싱) | 통과 · 진짜 kill=인프로세스 deathTick 비트 동일·재충원 divergence 0·N≥2·거짓 사망 epoch 펜싱 split-brain 0·소유자 1 |
| [0014](step-0014.md) | 가방 서비스 분리 (아이템 원장을 존 tick 밖 비동기 서비스로·신성한 tick·단일 소유·쌍 거래·dupe 0) | 통과 · 가방 ON/OFF 월드 비트 동일(비-침습)·존 도달 item 0·소유자 1·conserved/consistent·전송 열화 보존·E2E 비트 동일 |
| [0015](step-0015.md) | 채팅 서비스 분리 (채널 팬아웃을 존 tick 밖 비동기 서비스로·구독 라우팅·비-구독자 누설 0·지역 격리·whisper 프라이버시) | 통과 · 채팅 ON/OFF 월드 비트 동일(비-침습)·존 도달 chat 0·누설 0·phantom 0·chatDesync 0·열화에도 누설0/격리보존·E2E 비트 동일 |
| [0016](step-0016.md) | 이벤트 버스 서비스 층 (발행/구독 의미·gateway↔service 직접 결합 제거·발행자 무수정 소비자 추가 + inject seam) | 통과 · 버스 OFF=0015 비트 동일(25/25)·직접 결합 409~427→0·audit 추가에 발행자 spec/발신/결과 비트 동일·소비자 전수 수신·존 도달 svc 0·E2E 6중 다이제스트 비트 동일(10~13 프로세스)·열화에도 누설/phantom 0 |
| [0017](step-0017.md) | 가방 서비스 failover·영속 (인벤토리 원장을 영속 저널에서 재구성 — event sourcing·계층 6 데이터 첫 진입) | 통과 · persist OFF=0016 비트 동일(20/20)·복구 원장==무재시작 비트 동일(영속 투명)·영속 OFF+kill 은 원장 소실(0 vs 51~56)·itemDesync 0·E2E 7중 다이제스트 비트 동일(persist-bus 11·restart-bus 12 프로세스)·존 도달 persist 0·persist 안 죽음 |
| [0018](step-0018.md) | 가방 저널 스냅샷 압축 (event sourcing 의 intent 로그 + 주기 스냅샷 — 무한 성장 저널 유계화) | 통과 · snapshot OFF=0017 비트 동일(25/25)·스냅샷+tail replay==전체 replay==무재시작 invDigest 동일(무손실)·저널 60→0/57→3 92~100% 절감·9~10 스냅샷·desync 0·완전성=writes·E2E 비트 동일(persist-bus 11·restart-bus 12)·spine 18-step 사슬 |
| [0019](step-0019.md) | 발신하는 둘째 소비자 (RankingService — 버스 consume→publish 루프·이벤트 기반 읽기 모델/CQRS) | 통과 · ranking OFF=0018 비트 동일(25/25)·consume→publish(소비 57~60·발행 61~69)·rank 프로젝션==원장 byOwner·발행자 무수정(senderDigest on=off)·rankDesync 0·루프 없음·E2E 8중 비트 동일(persist-bus 12·restart-bus 13)·spine 19-step 사슬 |
| [0020](step-0020.md) | 읽기 모델 영속·late-join (RankingService crash→쓰기 저널 reconstruct — 자기 영속 0 인 CQRS 읽기 모델 복구) | 통과 · rankRestart OFF=0019 비트 동일(25/25·rank 포함)·랭킹 kill→reconstruct 복구 투영==원장 byOwner(6아바타)·persist OFF+kill 투영 소실(0 vs 6)·rankDesync 0·E2E 9중 비트 동일(rank-restart 13 프로세스·저널 tail 0~5 reconstruct)·spine 20-step 사슬 |
| [0021](step-0021.md) | 채팅 서비스 영속·failover (ChatService crash→커맨드 로그 replay — 라우팅 테이블+deliveries 의 event sourcing 복구) | 통과 · chatpersist OFF=0020 비트 동일(25/25·_process 리팩터 비-침습)·채팅 kill→커맨드 로그 replay 복구 투명(chatDigest 무재시작 동일·배달 211~229 재현)·chatpersist OFF+kill 소실(0)·복구 후 누설 0·chatDesync 0·E2E 비트 동일+chatpersist(chat-restart 14 프로세스·커맨드 78개 replay)·spine 21-step 사슬 |
| [0022](step-0022.md) | 채팅 커맨드 로그 스냅샷 압축 (ChatService 라우팅 스냅샷+tail replay — 0018 가방 효과 저널 압축의 커맨드-소싱 판) | 통과 · chatSnapshot OFF=0021 비트 동일(25/25·chatp+chatrst 구성으로 압축 코드 휴면 증명)·라우팅 스냅샷+tail replay==전체-커맨드 replay==무재시작 chatDigest 동일(무손실)·커맨드 로그 78→3(96% 절감)·15 스냅샷·chatDesync 0·누설 0·완전성=커맨드(writes==joins+says+whispers+leaves)·E2E 비트 동일(chat-restart 14)·spine 22-step 사슬 |
| [0023](step-0023.md) | 저널 홉 신뢰 전달 (write-behind 저널 홉 갭 감지 NAK+재전송 — 0008 의 저널 홉 판) | 통과 · OFF=0022 비트 동일(25/25)·loss 0.3 ON=저널 완전·복구 무손실 / OFF=16~18개 갭·복구 손실. tail 미감지·in-flight §9 |
| [0024](step-0024.md) | 저널 홉 tail 손실 감지 (heartbeat→maxSentSeq 통보→tail NAK — 0023 §9 해소) | 통과 · OFF=0023 비트 동일(25/25)·tail 손실 ON=저널 완전·tailNAK 21~24 / OFF=tail 갭 21~24 구조적 미감지. in-flight §9 |
| [0025](step-0025.md) | in-flight give 손실 복구 (클라 give-resend 로 복구 원장을 belief 로 재수렴 — 0024 §9 give 한정 해소) | 통과 · OFF=0024 비트 동일(25/25)·ON=itemDesync 0·재발행 3~9·dupe 0 / OFF=itemDesync 3~6. mint §9 |
| [0026](step-0026.md) | in-flight mint 손실 복구: id-reconciliation (belief 선언→re-mint→newId 채택 — write-behind 신뢰성 완결·0025 §9 해소) | 통과 · OFF=0025 비트 동일(25/25)·ON=itemDesync 0·reconcile 6회·dupe 0 / OFF=itemDesync 6. 버그 2건 전문은 step 문서 |
| [0027](step-0027.md) | PersistStore failover: 이중쓰기 보조 persist 로 단일점 제거 (_journal primary+backup 동시 발신 → primary crash 후 persist2 에서 완전 복구) | 통과 · persistBackup OFF=0026 비트 동일(25/25·이중쓰기 휴면)·primary crash+OFF=원장 소실 / ON=invDigest==무손실 기준(전 시드)·persist2 writes==primary writes(57~60·완전 복제)·desync 0·보존/정합 유지. spine 27-step 사슬 |
| [0028](step-0028.md) | PersistStore N-replica + quorum: 복제 N개 fan-out·생존 저널 union 복구로 영속 단일점 일반 해소 (_journal 복제 N 발신·quorumMergeJournals·0027 §9 2복제 단일점 해소) | 통과 · persistReplicas 0=0027 비트 동일(25/25·N-replica 휴면)·⒜완전복제 primary+복제2 죽음(생존1)=무손실 / ⒝부분쓰기 primary 죽음(생존3·각 ~2/3 보유 38~40/57~60)=union==base 무손실 / ⒞생존1 부분=손실(정족수 경계)·desync 0·보존정합. spine 28-step 사슬 |
| [0029](step-0029.md) | PersistStore quorum *쓰기* ack: W 정족수 확인 후 durable 선언·정합성 윈도 가시화 (journal_ack·durableSeq 워터마크·0028 §9 fire-and-forget 해소) | 통과 · quorumW 0=0028 비트 동일(25/25·q·ack 휴면)·⒜무손실=전 seq durable(win 0) / ⒝per-link 손실 3홀더=W=여전 durable(win 0) / ⒞tail 정족수 미달=durableSeq T-1 정지·윈도 23~24·crash{primary,p4} 에 durable 전부 복구·윈도 전부 소실(워터마크가 복구 프런티어 정확 예측)·라이브 desync 0. spine 29-step 사슬 |
| [0030](step-0030.md) | 정리 step: 박스 1개=파일 1개 분할 + verify 누적회귀 18모드 engine 승격(verify-kit) + 닫기 게이트(close-step) + 2-커밋 관행 — 기능 추가 0 | 통과 · reg 25/25(0029 비트 동일·verbatim 이동)·18모드 ALL OK·spine 30-step 사슬·step 디렉토리 267.5→203.3KB(verify 73.7→1.6KB·net-core 진입점 2.5KB) |
| [0031](step-0031.md) | 정합성 윈도 *해소*(quorum-fill — 주기 sweep 이 W 미달 윈도 seq 를 비-홀더 스토어에 재-fan-out resend·q → durable 전환·0029 §9 감지→전환) | 통과 · windowFill 0=0030 비트 동일(reg 25/25)·OFF durableSeq T-1/윈도 24(0029 감지)·ON durableSeq total-1/윈도 0·fill 46~48·crash{primary,p4} ON 전 seq 생존/OFF 윈도소실·dupe 0·desync 0·spine 31-step 사슬 |
| [0032](step-0032.md) | 윈도 해소의 *유계 sweep + fill 손실 retry*(`wfWindow` 미끄러지는 K 창·주기 재-scan=내장 retry·0031 §9 ⒜⒝) | 통과 · wfWindow 0=0031 비트 동일(reg 25/25)·fill 첫시도 드롭에도 무계·유계 K=8 둘 다 durSeq=total-1/윈도0·fills=2×F0(92~96)·retry↑·dupe 0·crash{primary,p4} 전 seq 생존·desync 0·spine 32-step 사슬 |
| [0033](step-0033.md) | 버스 *동적 구독/해지*(runtime `unsub`/`sub` — 라우팅 테이블 런타임 양방향 변경·버스 failover 의 선결·0016 §9-2) | 통과 · busReSub 0=0032 비트 동일(reg 25/25)·audit svc.item.out unsub@15→re-sub@18 → A0=60/Au=30/Ar=42(gap 손실 12·at-most-once)·ranking 공동구독 R0=R1=R2·발행자 pub 동일·다른 토픽 동일·보존/정합/desync 0·spine 33-step 사슬 |
