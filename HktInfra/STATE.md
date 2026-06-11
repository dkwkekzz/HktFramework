# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(에이전트 효율 — 토큰이 step 수에 비례해 터지지 않게 *강제*)**: 이 파일은 *고정 크기 대시보드*다. §1~6은 step을 닫을 때마다 **덮어쓴다(rewrite)** — 누적하지 않는다. 오직 §7 INDEX만 **literal 1줄** append(`step | 조각 | 통과+핵심수치 1개` — *문단 금지*). 발견/한계의 *전문*은 STATE가 아니라 `step-NNNN.md`에 산다. **세 가지 누적 함정 금지**: ① §5 에서 큰 그림 진척을 step별로 *재나열*하지 말 것 — 현재 마커 + 핵심 step 목록만 ② §3 에서 ✅해소된 격차를 전문 보존하지 말 것 — *한 줄로 떨어뜨린다* ③ §4 는 *여러 step 이 반복 참조하는 불변*만. 닫힌 step 의 발견·한계 전문은 각 `step-NNNN.md`(역사의 SSOT), 1줄 요약은 §7 INDEX. 마커: ✅해소 🟡부분 🔴열림(최우선) ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0024](step-0024.md) — 저널 홉 tail 손실 감지 (`InventoryService.onTick`/`journalHb` heartbeat + `PersistStore.expectedMaxSeq`/`_scanAndNak` — 0023 §9 사각 해소). journalHeartbeat OFF 면 0023 비트 동일(reg 0) · ON 이면 가방이 주기적 **heartbeat 로 maxSentSeq 통보**(`journal_hb`·존 tick 밖 *서비스 제어 평면 onTick*)→persist 가 갭 스캔 상한을 `max(maxRecvSeq, maxSentSeq)` 로 올려 **tail 갭도 NAK**→재전송으로 메움. 핵심=**NAK-only 는 받은 최고 seq *위*(tail)를 구조적으로 못 본다**(0023 §9)·**끝은 발신자만 안다 → high-water mark 통보가 감지를 공급**·**tail 은 *배달*이 아니라 *감지* 문제**(알면 0023 재전송 기계가 그대로 메움). 더한 것은 inventory.onTick/journalHb + persist.expectedMaxSeq/_scanAndNak/journal_hb 뿐·host.js/`engine/` 무수정.
- **한 줄 상태**: write-behind 저널 홉의 *tail 손실* 닫힘 — heartbeat 가 maxSentSeq 통보로 NAK-only 사각을 메운다. 핵심: ① **NAK 은 빈칸만 본다·tail 은 끝이라 안 보인다**(maxRecvSeq 위 미감지) ② **heartbeat=high-water 통보**(발신자만 아는 정보·서비스 제어 평면 onTick·신성한 tick 보존) ③ **감지≠배달**(통보 한 조각이 0023 재전송을 살림). 검증: 회귀 0(`reg` 25/25 → 0023 비트 동일·persist+rel+rst 로 heartbeat 휴면 직접 증명)·가설(`tail`, hb ON 저널 완전·복구 무손실(invDigest==무손실 기준)·**tailNAK 21~24**·heartbeat 7·재전송 141~192 / OFF=NAK-only **tail 갭 21~24개**·**tailNAK 0**(구조적 미감지)·복구 손실)·0023 `reliable`(중간 손실) 유지·E2E(chat-restart 14 프로세스·heartbeat 휴면 비트 동일)·spine 24-step 사슬. **단 (a) in-flight 손실 절반(crash 가 sentBuffer 비움)·클라 resend 미착수 = write-behind 진짜 나머지** **(b) 재전송 배달은 신뢰 모델로 격리(손실 재전송·NAK 폭주·heartbeat×압축 미결합·채팅 홉 미적용)** **(c) persist 단일점·버스/월드 영속 0·C++ 시뮬 미교체·lockstep 배리어**.
- **다음**: step-0025 (§2).

---

## 2. NEXT — step-0025 가설 (후보, 권위는 이 절)

**step-0024 가 저널 홉 tail 손실을 heartbeat(maxSentSeq 통보)로 닫았다 — write-behind 신뢰성의 *전송-손실*은 이제 (중간 NAK·0023) + (tail heartbeat·0024) 둘 다 닫혔다. 남은 *진짜* 격차는 in-flight 손실이다. 가장 자연한 다음 한 조각은 ⒜ *write-behind 신뢰성의 나머지 절반* — **in-flight 손실**(활성 중 가방 kill 시 미-ack sentBuffer 소멸 → 클라 resend 로 손실분 belief→원장 재수렴·dupe 0). 또는 ⒝ *버스 영속·failover*(서비스 복구 패턴의 버스 판·동적 구독 선결), 또는 ⒞ *월드 영속(존 intent 로그)*(계층 6 월드 판 — 클라 seen 의 tick-결합 재구성=고위험), 또는 ⒟ *활성 중 서비스 다운타임 + 재발행*(quiescent 한계 해소).**

남은 격차: ⓐ *write-behind 윈도의 나머지 절반* — **in-flight 손실**(crash 가 sentBuffer 비움·클라 resend 미착수·0024 §9) — exactly-once 의 잔여 메커니즘(클라 resend·write-ahead) ⓑ 버스·월드는 *영속 0*·서비스 복구는 *활성 중 다운타임 미검증*(0020~0022) ⓒ 스냅샷 *비유계*·압축 *단일 트리거*(0018/0022)·재전송 amplification(NAK 폭주·0023/0024)·heartbeat×압축 미결합(0024)·채팅 홉 신뢰/heartbeat 미적용 ⓓ PersistStore 가 *단일점*. **권위는 이 절이되, 다음 step 시작 시 한 조각으로 좁힐 것**. ⒜ in-flight sub-piece(클라 resend)는 중난도(클라 belief↔원장 재수렴·dupe 0 회계). ⒝ 는 검증된 영속·복구 패턴의 버스 판이나 *버스 라우팅이 정적 spec* 이라 동적 구독 선결 필요. ⒞ 는 *고위험*(tick-결합 코어·클라 seen 재구성). 큰 조각(비동기 결정론·C++ 시뮬 교체)도 여전히 강한 후보.

**검증할 것(후보 — 영속 신뢰성 나머지·버스 영속 기준)**: ① **회귀 0** — 새 항 OFF 면 0024 비트 동일. ② **신성한 tick** — 새 항(클라 resend·영속)이 존 tick 밖·존 비-침습. ③ **E2E 동치** — 멀티프로세스=인프로세스 비트 동일·은닉. ④ **가설** — ⒜-inflight 면 "활성 중 kill→클라 resend 로 in-flight 손실분 belief→원장 수렴·dupe 0", ⒝ 면 "버스 라우팅 kill→재구성 후 결합 0 보존".

**병행 백로그(블로킹 아님)**: ⬜ in-flight 손실 + 클라 resend·exactly-once 나머지(0024 §9·중난도·write-behind 진짜 나머지) · ⬜ 손실 재전송·재전송 amplification(NAK 폭주) 배칭(0023/0024 §9) · ⬜ heartbeat×압축 결합·채팅 홉 신뢰/heartbeat(0024 §9) · ⬜ 버스 영속·failover(0016 §9-2·0017 §9·동적 구독 선결) · ⬜ 활성 중 서비스 다운타임 + 재발행(0020~0022 §9) · ⬜ 읽기 모델 증분 follow·자체 스냅샷(0020 §9) · ⬜ 증분 스냅샷·압축 트리거 다양화(0018/0022 §9) · ⬜ 월드 영속(존 intent 로그·크래시 복구·late-join — 계층 6 월드 판·tick-결합 고위험) · ⬜ PersistStore failover·디스크 fsync·다중 복제(0017 §9 — 영속 단일점) · ⬜ 버스 분산·failover·동적 구독·이력/replay(0016 §9-2·§9-3) · ⬜ 런타임 consume→publish 사이클 정적 탐지(0019 §9) · ⬜ 거래소·우편(서비스 분리 패턴 반복) · ⬜ 존 넘는 거래·2-party 동의·에스크로(0014 §9-2) · ⬜ 비동기 실행 아래 결정론(논리 클럭, 0012 §9-3·0013 §9-1) · ⬜ 분산 시스템 심화 묶음(다중-브로커 버스 분산·분산 epoch·거짓 사망 플래핑·부분 복귀·다중 standby·디스커버리·소켓 층 비대칭 분단 — 0012~0013 §9) · ⬜ 월드 심화 묶음(다중 클라 복제·예측[C++ 승격]·존 N개·동적 경계·존↔존 ghost 증분화 — 0006~0008 §8) · ⬜ 서버간 인증·재접속·티켓 만료(0001 §8.3·§8.5). (✅ 해소분 0014~0024 = §3 ✅ 묶음·§7 INDEX 참조.)

**빌드 인프라 — `engine/` 추출 완료(0004), 0005~0024 무수정 재사용**: 공통 하니스(시드 PRNG·FNV·전송 모델 `Net`·엣지/코디 스텁·동결 `ISimCore` 2구현 = `engine/index.js`, 시각 관찰 키트 = `engine/panel-kit.js`)를 `engine/` 한 곳에. 코어는 **dual-mode**(Node `require` + 브라우저 `<script>` 전역). 0024 는 `engine/`·host.js·cluster.js 무수정(heartbeat opt 는 spec 직렬화로 자동 흐름·`journal_hb`/NAK 는 기존 라우팅 재사용·`Net.step` 이 inventory.onTick 호출)·존/orch/추종자/버스/감사/랭킹·채팅·0023 신뢰 전달 무수정 — net-core 는 0023 그대로 + **InventoryService `onTick`/`journalHb`**(주기적 `journal_hb{maxSentSeq}` 발신·OFF 면 no-op = 0023 비트 동일)·**PersistStore `expectedMaxSeq`/`_scanAndNak`/journal_hb**(갭 스캔 상한을 maxSentSeq 로 확장·tail NAK)만 더함. tail 손실은 `JTAIL`(tick≥16 최초 전송 100% 드롭·재전송/NAK/heartbeat 제외)로 전송층 주입. step-0025 의 net-core 출발 템플릿은 `step-0024/net-core.js`·`step-0024/cluster.js`·`step-0024/host.js`.

**TESTBED 도구 인계(0010 후 구현·동결 step 무수정) — 마무리 완료**: `run.js`(검증 단일 진입점 — `node run.js`·`spine`·`<NNNN>`·`report`·**`scenario`**·`live`) + 자기완결 `report.html`(녹화 레코더, **공간 위치+AOI 맵 포함**) + `live.js`(SSE 라이브 모니터)가 섰다([TESTBED.md](TESTBED.md) §12 구현 현황). ⒜ `onTick(t,state)` 훅(0011 심음) ✅ · ⒝ verify **`scenario <file>`** 브리지(trace 4기둥 프로그램적 단언·exit 0/1) ✅ · ⒞ 레코더 공간 위치·AOI 격자 맵 ✅ · ⒟ **scenario `inject`**(0016 에서 net-core write-seam 심음 — `opts.inject`·미제공=no-op→reg 0·run()/runMulti() 같은 위치라 멀티도 비트 동일·run.js `loadScenario` 가 자동 번역 + `NET.SUPPORTS.inject` 기능 탐지로 과거 step 은 경고 후 무시) ✅. "레코더 이상→export→회귀 케이스" 고리가 kill/transport/**inject** 전부에서 성립. 새 박스 추가 시 run.js 의 addr→layer 선언 맵만 갱신(0016 에서 bus/audit 추가 — TESTBED §10-5).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| 🔴 | **C++ 시뮬 코어 headless 빌드 (최우선)** | 월드 | 결정론 시뮬 코어가 UE 모듈(`Core`·`CoreUObject`·`GameplayTags`·`Json` 등)에 링크되면 'UObject 0' 이라도 UE 소스/UBT 없이 빌드 불가 → 원격 검증 불가. UE-모듈-free 코어 분리 또는 얇은 헤드리스 shim 필요(§4 불변). C++ 승격의 선결(0003 §8.2). |
| 🔴 | **비동기 실행 아래 결정론 (lockstep 배리어 해제·step-0014 후보)** | 코디네이션 | 0013 까지 결정론은 *중앙 lockstep 배리어*(broker 가 매 tick 전 프로세스 응답 대기)가 떠받친다. 진짜 비동기·노드 자유 진행·벽시계 타임아웃 곡선은 미착수 — 논리 클럭(Lamport/벡터)·인과 순서로 배리어 없이 결정론·소유자 1 보존이 후속(0012 §9-3·0013 §9-1). |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정 검증·대기열·티켓 만료(0001 §8.5). |
| ⬜ | **다중 클라 결정론 복제·예측** | 월드 | 0002~0004 의 결정론 복제·예측은 *C++ 시뮬 코어 승격*에서 부활(더미는 경량 라우터). 다중 클라 intent 인터리빙·예측/롤백(0001 §8.6). |
| ⬜ | **서버간 인증 없음** | 버스 | 존이 게이트웨이 발신을 암묵 신뢰(0001 §8.3) — 분산 시 서버간 인증 필요. |
| ⬜ | **버스 단일점·분산·동적 구독** | 버스 | 0016 ServiceBus = *단일 박스·영속 0*(죽으면 서비스 경로 단절 — 새 단일점)·구독은 정적 선언 spec(동적 구독/해지·구독자 장애 감지·이력/replay 없음·unrouted=at-most-once). 월드·제어 평면·존간 핸드오프는 직접 유지(의도 — 버스 승격 여부는 후속 판단). 다중 브로커 분산(0012 §9-1)·버스 failover 후속. |
| 🟡 | **서비스 영속·failover (가방 ✅+압축 ✅+저널홉 신뢰 ✅+tail 감지 ✅·채팅 ✅+압축 ✅·버스 ⬜)·존 넘는 거래** | 서비스/데이터 | 0017 가방 원장 = event sourcing 효과 저널(복구 투명)·0018 스냅샷 압축. 0021 채팅 = *커맨드 로그* event sourcing·0022 라우팅 스냅샷 압축. 0023 *저널 홉 신뢰 전달*(중간 갭 NAK+재전송)·0024 *tail 손실 감지*(heartbeat→maxSentSeq 통보→tail NAK → 전송 손실 아래 저널 완전·복구 무손실). 단 write-behind 윈도의 *진짜 나머지*(in-flight 손실 — 0024 §9)·버스 라우팅은 *영속 0*·채팅 홉 신뢰/heartbeat 미적용. 가방 일방 give(2PC 없음 — 0014 §9-2). |
| 🟡 | **길드·거래소·우편(서비스 반복)·랭킹 ✅·읽기 모델 복구 ✅** | 서비스 | 0019 RankingService = *발신하는 소비자*(consume→publish·CQRS·발행자 무수정·프로젝션==원장). 0020 = *읽기 모델 영속·late-join*(랭킹 crash→쓰기 저널 reconstruct·자기 영속 0·투영==원장 — 0019 §9 해소). 단 *quiescent restart 만*(활성 중 다운타임+재발행 미검증·0020 §9)·증분 follow 0·런타임 사이클 탐지 0. 거래소·우편·길드는 반복 미착수. |
| ⬜ | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | "누가 어디에" SSOT·존 배치·부하 분산·인스턴스 spawn. |
| 🟡 | **캐시 + write-behind 영속 (가방·채팅 저널+압축 ✅·저널홉 신뢰 ✅+tail 감지 ✅·복제/월드 ⬜)** | 데이터 | 0017 PersistStore = 가방 효과 저널(write-behind)·계층 6 첫 박스. 0018 가방·0022 채팅 스냅샷 압축(제네릭 핸들러 공용). 0023 *저널 홉 신뢰 수신*(seq 갭 감지 NAK·recvSeqs 멱등 dedup). 0024 *tail 손실 감지*(heartbeat 의 maxSentSeq 로 갭 스캔 상한 확장 → maxRecvSeq 위 tail 도 NAK → effectively-once 영속 완성). 단 *in-flight 손실(0024 §9)·스냅샷 비유계·압축 단일 트리거·재전송 amplification(NAK 폭주)·heartbeat×압축 미결합·디스크 fsync/다중 복제/persist failover 0(단일점)·월드 영속 0* — 0018/0022/0024 §9. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속에서 뷰/권위 재구성 — 소실 권위의 고리 닫기. |

> **✅ 해소된 격차 (0001~0024)** — 전문은 §7 INDEX(1줄/step)·각 `step-NNNN.md`. 묶음: 골격/복제/Sim 동결/현실 전송(0001~0004)·AOI·공간 분할·핸드오프·증분·반응적 복원·failover(0005~0009)·프로세스 경계·TCP·버스 분산·진짜 kill failover(0010~0013)·게임 서비스 분리(가방 0014·채팅 0015)·이벤트 버스 의미(0016)·가방 영속+압축(0017~0018)·발신 소비자·읽기 모델 영속(0019~0020)·채팅 영속+압축(0021~0022)·**저널 홉 신뢰: 중간 갭 NAK(0023)+tail heartbeat(0024)**.

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
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 0014 가방(InventoryService) 첫 박스 — 단일 소유·쌍 거래·dupe 0 +0015 채팅(ChatService) 둘째 박스 — 채널 팬아웃·지역 격리 +0016 서비스 경로가 버스 발행/구독으로 + AuditService(관찰 소비자) +0017 가방 failover·영속(kill→저널 replay) +0018 저널 스냅샷 압축 +0019 **RankingService**(발신하는 소비자 — svc.item.out 소비→rank 투영→svc.rank.out 발행·CQRS 읽기 모델) +0020 **읽기 모델 영속·late-join**(랭킹 crash→쓰기 저널 reconstruct·자기 영속 0·투영==원장) +0021 **채팅 영속·failover**(커맨드 로그 replay·라우팅+deliveries event sourcing 복구·*서비스 복구 3부작 완성*) +0022 **채팅 커맨드 로그 스냅샷 압축**(라우팅 스냅샷+tail replay·무손실·효과/커맨드소싱 둘 다 압축 완성) +0023 **저널 홉 신뢰 전달**(가방 저널 홉 *중간* 갭 감지 NAK+재전송) +0024 **저널 홉 tail 손실 감지**(가방 onTick heartbeat→persist 에 maxSentSeq 통보→tail 갭 NAK·전송 손실 아래 저널 완전·복구 무손실). 전부 별 프로세스·tick 무관(가방 onTick 은 *서비스 제어 평면*·존 tick 밖)·신성한 tick·E2E 비트 동일·은닉. 활성 중 다운타임+재발행·write-behind 진짜 나머지(in-flight)·버스 영속·거래소/우편/길드 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 0004 전송 substrate(`engine/Net`) +0008 핸드오프/델타 라우트 +0010 IPC +0011 실 TCP 소켓 와이어 +0012 토픽 pub/sub 버스(*전송*·소켓 층 열화 내성) +0016 **서비스 의미**(ServiceBus — 발행/구독 계약·gateway↔service 직접 결합 0·발행자 무수정 소비자 추가) +0019 **발신 소비자**(ranking 이 svc.item.out 둘째 소비자로 구독→svc.rank.out 발행 = consume→publish 루프·발행자 무수정·루프 없음). 버스 단일점 제거(분산·failover)·동적 구독·이력/replay·런타임 사이클 탐지·서버간 인증 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 0001 레지스트리 +0009 Orchestrator(lease·failover) +0010 broker(lockstep 배리어) +0011 broker=TCP 서버 +0012 broker=버스 허브·분단 감지·펜싱 +0013 진짜 kill(소켓 close 감지)·타임아웃 추측(거짓 사망)·epoch 펜싱·재-provisioning(split-brain 0·소유자 1). broker 물리 분산·분산 epoch·진짜 비동기(배리어 해제) 후속 |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 0017 PersistStore 첫 박스 — 가방 효과 저널(event sourcing·write-behind)·진짜 kill→replay 로 원장 재현(복구 투명) +0018 **저널 스냅샷 압축**(intent 로그+주기 스냅샷·무손실·저널 (스냅샷+tail) 유계화) +0020 같은 저널이 *읽기 모델 복구원*으로도(랭킹 reconstruct) +0021 **chatpersist**(PersistStore 재사용 독립 인스턴스 — 채팅 커맨드 로그) +0022 **채팅 커맨드 로그 스냅샷 압축**(라우팅 파생 상태 스냅샷·제네릭 PersistStore 핸들러 가방·채팅 공용) +0023 **저널 홉 신뢰 수신**(PersistStore seq 갭 감지 NAK·recvSeqs 멱등 dedup) +0024 **tail 손실 감지**(expectedMaxSeq — heartbeat 의 maxSentSeq 로 갭 스캔 상한 확장·maxRecvSeq 위 tail 도 NAK → effectively-once 영속 완성). in-flight 손실·증분 스냅샷·NAK 배칭·디스크 fsync·다중 복제·persist failover·월드 영속(존 intent 로그)·버스 영속 후속 |

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
| [0023](step-0023.md) | 저널 홉 신뢰 전달 (가방 write-behind 저널 홉의 갭 감지 NAK + 재전송 — 0008 의 저널 홉 판) | 통과 · journalReliable OFF=0022 비트 동일(25/25·persist+rel+rst 로 무손실 휴면 증명)·저널 홉 loss 0.3 아래 신뢰 ON=저널 완전(writes==무손실 기준)·복구 무손실(invDigest==기준) / OFF=16~18개 갭·복구 손실·NAK 166~187·재전송 223~239·effectively-once(at-least-once+recvSeqs dedup)·E2E 비트 동일(신뢰 휴면)·spine 23-step 사슬. tail 손실 미감지·in-flight 절반 §9 |
| [0024](step-0024.md) | 저널 홉 tail 손실 감지 (가방 onTick heartbeat→maxSentSeq 통보 → persist 가 NAK-only 사각인 tail 갭 감지 — 0023 §9 해소) | 통과 · journalHeartbeat OFF=0023 비트 동일(25/25·persist+rel+rst 로 heartbeat 휴면 증명)·tail 손실 아래 hb ON=저널 완전(writes==무손실 기준)·복구 무손실(invDigest==기준)·**tailNAK 21~24**·heartbeat 7·재전송 141~192 / OFF=NAK-only **tail 갭 21~24개**·**tailNAK 0**(구조적 미감지)·복구 손실·E2E 비트 동일(heartbeat 휴면)·spine 24-step 사슬. in-flight 손실 §9 |
