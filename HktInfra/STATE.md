# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(에이전트 효율 — 토큰이 step 수에 비례해 터지지 않게 *강제*)**: 이 파일은 *고정 크기 대시보드*다. §1~6은 step을 닫을 때마다 **덮어쓴다(rewrite)** — 누적하지 않는다. 오직 §7 INDEX만 **literal 1줄** append(`step | 조각 | 통과+핵심수치 1개` — *문단 금지*). 발견/한계의 *전문*은 STATE가 아니라 `step-NNNN.md`에 산다. **세 가지 누적 함정 금지**: ① §5 에서 큰 그림 진척을 step별로 *재나열*하지 말 것 — 현재 마커 + 핵심 step 목록만 ② §3 에서 ✅해소된 격차를 전문 보존하지 말 것 — *한 줄로 떨어뜨린다* ③ §4 는 *여러 step 이 반복 참조하는 불변*만. 닫힌 step 의 한-문단 INDEX 요약 history 는 [STATE-INDEX-ARCHIVE.md](STATE-INDEX-ARCHIVE.md)(읽기용·필독 아님). 마커: ✅해소 🟡부분 🔴열림(최우선) ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0017](step-0017.md) — 가방 서비스 failover·영속(인벤토리 원장을 영속 저널에서 재구성 · "세계가 세션보다 오래 산다"). SPINE 계층 6(데이터)의 *첫 박스* — 0014~0016 게임 서비스가 전부 *영속 0*(프로세스와 함께 죽음)이었던 것을, `PersistStore`(append-only 효과 저널 `[{seq,kind:'mint'|'xfer',...}]` SSOT, **onTick 없음 = tick 무관 순수 반응형**)로 푼다: persist OFF 면 0016 비트 동일(reg 0) · ON 이면 가방이 수락 변이(pickup=mint·give=xfer)를 persist 로 *write-behind 저널*(fire-and-forget — 결과 ack 가 영속 ack 안 기다림·신성한 tick 밖). 가설의 핵=가방 failover(`invRestart.at`): 인프로세스는 같은 가방 객체 `crash()`(RAM 소실)→`replay(저널)`, 멀티프로세스는 broker 가 persist(*안 죽음*)에서 저널 읽고→가방 호스트 *진짜 child.kill*→새 호스트 spawn·init·`replay`→'inventory' 라우팅 전환(0013 재-provisioning 의 *서비스 판*). 복구는 전부 *제어 평면*(net.log 비-기여)→인프로세스/멀티 **비트 동일**. `replay` 가 mintTotal 복원→itemId 연속성(복구가 미래에도 투명). 영속 인터페이스는 버스 아닌 *직접 명시 인터페이스*(서비스 자기 데이터 스토어=DB 연결 더미판 — §4 "버스/명시 인터페이스" 허용). 월드 경로·제어 평면·버스 의미(0016)·채팅(0015) *무변경*(가방만 journal/crash/replay seam 가산). `engine/` 무수정.
- **한 줄 상태**: 데이터 계층이 첫 박스를 가졌다 — 가방 원장이 *영속 진실*(저널)에서 재현되고, "세계가 세션보다 오래 산다"가 비트 명제로 증명됐다(가방 진짜 kill→replay 후 원장이 무재시작과 *비트 동일* = 영속 투명·영속 OFF+kill 은 원장 소실 = 영속이 보존의 *원인*). `node verify.js` 한 줄이 원격에서 persist 를 별 프로세스로 띄우고 가방을 진짜 kill→replay 로 복구해 검증. 핵심: ① **"세계가 세션보다 오래 산다"는 *두 객체의 독립*으로 떨어진다** — PersistStore(데이터)≠InventoryService(서비스)이기만 하면 가방 객체 crash 가 persist 무관·인프로세스조차 "프로세스 사망"을 충실 모델링(멀티 진짜 child.kill 과 비트 동일) ② **복구가 제어 평면이라 net.log 비-기여** — 인프로세스 객체 wipe 와 멀티 진짜 kill 이 같은 net.log·같은 원장 → 영속/failover 는 응용 메시지 밖의 일 ③ **복제=재현(event sourcing) > 상태 전송** — 0013 loadstate(스냅샷 전송)와 달리 가방은 효과 저널 *재현*(§4 충실)·mintTotal 복원이 미래 itemId 연속성까지 보존 ④ **복구 투명 = 재현 입력 온전성의 함수** — quiescent restart(가방 정지 후 저널 drain 완료)면 투명·대조군(영속 OFF)이 인과(영속=보존 원인)를 분리 ⑤ **0013 failover 골격 그대로 재사용** — kill→spawn→상태회복(loadstate→replay)·라우팅 전환이 존→서비스 일대일. 검증: 회귀 0(`reg`, persist OFF → 0016 비트 동일 20/20)·E2E 동치(`e2e`, 멀티=인프로세스 7중 다이제스트 log+world+inv+chat+bus+audit+persist 비트 동일·persist-bus 11·restart-bus 12 프로세스)·신성한 tick(`sacred`, world on=off·저널 writes>0·존도달 persist/journal 0·persist onTick 없음)·가설(`recover`, 복구 원장==무재시작 비트 동일·영속 OFF 소실 0 vs 51~56·itemDesync 0·belief 소유 ≤1·저널 완전)·열화(`degrade`, persist ON 에도 누설/phantom 0·보존/정합·소유 ≤1 loss-무관)·inject(실효·결정론·멀티 동일 5/5)·분리(`isolate`, persist 자기 pid·안 죽음·가방 kill→새 호스트 다른 pid·replay 57~60 항목)·은닉(`hide`, 저널/persist/replay 누설 0)·재현(`repro`, 멀티 2회=인프로세스 같은 원장 42=0x7a122947…2026=0x4bc176e1). **의도적 경량화 유지**. **단 (a) write-behind 윈도(활성 중 죽음=in-flight 저널 손실 — quiescent restart 로 회피·ack/resend 없음)** **(b) 저널 무한 성장·스냅샷 압축 없음** **(c) PersistStore=단일 박스·디스크 fsync/다중 복제/failover 0(새 단일점)** **(d) 가방만 영속(채팅 구독·버스 라우팅·월드 intent 로그는 영속 0)** **(e) 다운타임 가용성 미보장(복구는 seamless·다운 윈도 0, kill 중 op 큐잉/재시도 없음)** **(f) 여전히 Node·C++ 시뮬 미교체·lockstep 배리어**.
- **다음**: step-0018 (§2).

---

## 2. NEXT — step-0018 가설 (후보, 권위는 이 절)

**step-0017 이 가방 원장을 영속화했으나 *write-behind 윈도*(활성 중 죽음=in-flight 저널 손실 — quiescent restart 로 회피했을 뿐)가 열려 있고, 채팅 구독·버스 라우팅·월드는 여전히 영속 0이다. 가장 자연한 다음 한 조각은 ⒜ *활성 중 failover + write-behind 손실 재수렴*(가방이 op 활성 중 죽어도 ack/resend·write 손실 감지로 완전성 수렴 — 이 step write-behind 윈도의 닫기, 0017 §9) — 영속의 *신뢰성* 반쪽. 또는 ⒝ *채팅·버스 영속*(서비스 분리 패턴의 영속 판 반복 — 채팅 구독/버스 라우팅을 죽여도 보존), 또는 ⒞ *저널 스냅샷 압축*(intent 로그 + 주기 스냅샷 — 무한 성장 저널 압축, SPINE "intent 로그+스냅샷"), 또는 ⒟ *월드 영속(존 intent 로그)*(계층 6 의 월드 판 — 크래시 복구·late-join, 존 세계가 세션보다 오래 산다), 또는 ⒠ *발신하는 둘째 소비자*(랭킹/거래소 — 0016 §9-4), 또는 ⒡ *채팅 신뢰 전달*(0015 §9-2).**

step-0017 이 데이터 계층 첫 박스(PersistStore)를 세워 가방 원장을 event sourcing 으로 영속화했다(복구 투명·E2E 비트 동일). 그러나 ⓐ *write-behind 윈도*(가방 활성 중 죽음=in-flight 저널 손실 — ack/resend·손실 감지 없음) ⓑ 채팅·버스·월드는 *영속 0* ⓒ 저널 *무한 성장·스냅샷 압축 없음* ⓓ PersistStore 가 *새 단일점*(디스크 fsync/다중 복제/failover 0) ⓔ 다운타임 *가용성 미보장*(복구 seamless·kill 중 op 큐잉/재시도 없음)이다. 다음 자연한 한 조각 후보는 위 ⒜~⒡ 중 하나. **권위는 이 절이되, 다음 step 시작 시 한 조각으로 좁힐 것** — 큰 조각(비동기 결정론·C++ 시뮬 교체)도 여전히 강한 후보다.

**검증할 것(후보 — 활성 중 failover·write 신뢰성 기준)**: ① **회귀 0** — 새 항 OFF 면 0017 비트 동일. ② **신성한 tick** — 새 항(ack/resend·스냅샷·압축)이 존 tick 밖·존 비-침습(월드 비트 동일). ③ **E2E 동치** — 멀티프로세스=인프로세스 비트 동일·은닉. ④ **가설** — *가방 활성 중 kill→복구 후 완전성 수렴*(in-flight 손실분이 재전송/감지로 메워져 클라 belief 가 원장 진실로 수렴 — dupe 0·소유 ≤1 유지). *채팅·버스 영속* 후보면 ④ 가 "구독/라우팅 kill→재구성 후 누설 0·격리 보존", *스냅샷 압축* 후보면 "스냅샷+tail replay == 전체 replay 비트 동일·저널 크기 절감", *월드 영속* 후보면 "존 kill→intent 로그 replay 로 월드 재현·desync 0".

> 후속 한 조각: **활성 중 가방 failover + write 손실 재수렴**(ack/resend·손실 감지 — 0017 §9) · **채팅·버스 영속**(서비스 영속 판 반복) · **저널 스냅샷 압축**(intent 로그+스냅샷) · **월드 영속(존 intent 로그)**(계층 6 월드 판·크래시 복구·late-join) · **PersistStore failover·다중 복제**(영속 단일점 제거) · **발신하는 둘째 소비자(랭킹/거래소)**(0016 §9-4) · **채팅 신뢰 전달**(0015 §9-2) · **존 넘는 거래**(2PC — 0014 §9-2) · **비동기 실행 아래 결정론**(lockstep 해제·논리 클럭 — 0013 §9-1·큰 조각) · **C++ 시뮬 코어 headless 교체**(§3 🔴).

**병행 백로그(블로킹 아님)**: ⬜ 활성 중 가방 failover + write 손실 재수렴·ack/resend(0017 §9) · ⬜ 채팅·버스 영속·failover(0015 §9-3·0016 §9-2·0017 §9) · ⬜ 저널 스냅샷 압축·intent 로그+스냅샷(0017 §9) · ⬜ 월드 영속(존 intent 로그·크래시 복구·late-join — 계층 6 월드 판) · ⬜ PersistStore failover·디스크 fsync·다중 복제(0017 §9 — 영속 단일점) · ⬜ 발신하는 둘째 소비자—랭킹/거래소(0016 §9-4) · ⬜ 채팅 신뢰 전달·채널 시퀀스·ack/resend(0015 §9-2) · ⬜ 버스 분산·failover·동적 구독·이력/replay(0016 §9-2·§9-3) · ⬜ 존간 이벤트(핸드오프·ghost)의 버스 승격 판단(0016 §9-1) · ⬜ 길드·우편(서비스 분리 패턴 반복) · ⬜ 존 넘는 거래·2-party 동의·에스크로(0014 §9-2) · ⬜ 비동기 실행 아래 결정론(논리 클럭, 0012 §9-3·0013 §9-1) · ⬜ 물리적 다중-브로커 버스 분산·분산 epoch(0012 §9-1·0013 §9-3) · ⬜ 거짓 사망 플래핑·부분 복귀·stale 호스트 재합류(0013 §9-4) · ⬜ 다중 standby·자가 디스커버리·점진 상태 동기(0013 §9-2) · ⬜ 소켓 층 지연·재정렬·비대칭 분단(0012 §9-4) · ⬜ 다중 클라 결정론 복제·예측(C++ 승격에서 부활) · ⬜ 존 N개·동적 경계(0006 §8.2) · ⬜ 존↔존 ghost 증분화·복원(0007 §8.3·0008 §8.6) · ⬜ 서버간 인증(0001 §8.3) · ⬜ 재접속·티켓 만료(0001 §8.5) · ✅ 가방 서비스 영속·failover(0017 — event sourcing 저널·복구 투명·계층 6 첫 진입) · ✅ 이벤트 버스 서비스 층(0016 — 발행/구독 의미·직접 결합 0·발행자 무수정 소비자 추가) · ✅ 채팅 서비스 분리(0015 — 채널 팬아웃·비-구독자 누설 0·지역 격리) · ✅ 가방 서비스 분리(0014 — 단일 소유·쌍 거래·dupe 0) · ✅ 시각화·검증 testbed 단일화(0010 후: `run.js`+`report.html`+`live.js` — [TESTBED.md](TESTBED.md)) · ✅ 레코더 per-tick 엔티티 위치·AOI 시각화 + verify `scenario` 브리지 · ✅ 시나리오 `inject`(0016 에서 write-seam 심음 — run.js 자동 소비).

**빌드 인프라 — `engine/` 추출 완료(0004), 0005~0017 무수정 재사용**: 공통 하니스(시드 PRNG·FNV·전송 모델 `Net`·엣지/코디 스텁·동결 `ISimCore` 2구현 = `engine/index.js`, 시각 관찰 키트 = `engine/panel-kit.js`)를 `engine/` 한 곳에. 코어는 **dual-mode**(Node `require` + 브라우저 `<script>` 전역). 0017 은 `engine/` 무수정·존/orch/추종자/버스/감사/채팅 액터 무수정 — net-core 는 0016 그대로 + **PersistStore**(append-only 효과 저널·onTick 0) + 가방 `_journal`(write-behind)·`crash`·`replay` + run() **invRestart** 분기(crash+replay)만 더함. `cluster.js`(broker)·`host.js`(자식)는 0016 그대로 + *persist 재구성/스냅샷·가방 failover 안무*(진짜 kill→새 호스트 spawn·init·replay·라우팅 전환 — 0013 재-provisioning 패턴의 서비스 판). broker 는 persist 를 범용 호스트로 취급(복구만 제어 평면 RPC). step-0018 의 net-core 출발 템플릿은 `step-0017/net-core.js`·`step-0017/cluster.js`·`step-0017/host.js`.

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
| 🟡 | **서비스 영속·failover (가방 ✅·채팅/버스 ⬜)·존 넘는 거래** | 서비스/데이터 | 0017 가방 원장 = event sourcing 저널로 영속·failover(복구 투명·계층 6 진입). 단 *write-behind 윈도*(활성 중 죽음=in-flight 손실·ack/resend 없음 — 0017 §9)·채팅 구독·버스 라우팅은 *영속 0*. 가방 일방 give(2PC 없음 — 0014 §9-2)·채팅 best-effort(0015 §9-2). |
| ⬜ | **길드·거래소·우편·랭킹(발신하는 소비자)** | 서비스 | 가방·채팅 분리 패턴의 반복 + 0016 버스 패턴의 실전 검증(audit 은 관찰 전용 — 이벤트를 *소비해 발행*하는 서비스의 순서/루프 미검증, 0016 §9-4). |
| ⬜ | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | "누가 어디에" SSOT·존 배치·부하 분산·인스턴스 spawn. |
| 🟡 | **캐시 + write-behind 영속 (가방 저널 ✅·압축/복제/월드 ⬜)** | 데이터 | 0017 PersistStore = 가방 효과 저널(write-behind)·계층 6 첫 박스("세계가 세션보다 오래 산다" 가방 판 실증). 단 *저널 무한 성장·스냅샷 압축 0·디스크 fsync/다중 복제/persist failover 0(새 단일점)·월드 영속 0(존 intent 로그 미착수)* — 0017 §9. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속에서 뷰/권위 재구성 — 소실 권위의 고리 닫기. |

> **✅ 해소된 격차 (0001~0016)** — 골격 토폴로지(0001)·존 결정론 복제(0002)·Sim 인터페이스 동결(0003)·현실 전송 위 복제(0004)·AOI 브로드캐스트(0005)·공간 분할·권위 핸드오프(0006)·증분 AOI(0007)·전송 열화 아래 반응적 복원(0008)·추종자 승격 failover(0009)·프로세스 경계 E2E(0010)·실 TCP 소켓 와이어(0011)·버스 분산·열화 내성(0012)·진짜 프로세스 kill 아래 failover(0013, epoch 펜싱·재-provisioning)·가방 서비스 분리(0014, 게임 서비스 계층 첫 박스·단일 소유·쌍 거래·dupe 0)·채팅 서비스 분리(0015, 게임 서비스 둘째 박스·채널 팬아웃·비-구독자 누설 0·지역 격리)·이벤트 버스 서비스 층(0016, 발행/구독 의미·직접 결합 0·발행자 무수정 소비자 추가)·**가방 서비스 영속·failover(0017, event sourcing 저널·복구 투명·계층 6 데이터 첫 진입 — 종전 ⬜"캐시+write-behind 영속" 격차 부분 해소)**. 상세 = 각 `step-NNNN.md` · §7 INDEX · [STATE-INDEX-ARCHIVE.md](STATE-INDEX-ARCHIVE.md).

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
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 0014 가방(InventoryService) 첫 박스 — 단일 소유·쌍 거래·dupe 0 +0015 채팅(ChatService) 둘째 박스 — 채널 팬아웃·지역 격리·best-effort +0016 서비스 경로가 버스 발행/구독으로(주소 무지) + AuditService +0017 **가방 failover·영속**(진짜 kill→저널 replay·복구 투명). 전부 별 프로세스·tick 무관 순수 반응형(onTick 0)·신성한 tick·E2E 비트 동일·은닉. 채팅/버스 영속·활성 중 failover·채팅 신뢰 전달·발신하는 소비자(랭킹/거래소)·길드/우편 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 0004 전송 substrate(`engine/Net`) +0008 핸드오프/델타 라우트 +0010 IPC +0011 실 TCP 소켓 와이어 +0012 토픽 pub/sub 버스(*전송*·소켓 층 열화 내성) +0016 **서비스 의미**(ServiceBus — 발행/구독 계약·gateway↔service 직접 결합 0·발행자 무수정 소비자 추가·E2E 비트 동일). 버스 단일점 제거(분산·failover)·동적 구독·이력/replay·지연/재정렬·서버간 인증 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 0001 레지스트리 +0009 Orchestrator(lease·failover) +0010 broker(lockstep 배리어) +0011 broker=TCP 서버 +0012 broker=버스 허브·분단 감지·펜싱 +0013 진짜 kill(소켓 close 감지)·타임아웃 추측(거짓 사망)·epoch 펜싱·재-provisioning(split-brain 0·소유자 1). broker 물리 분산·분산 epoch·진짜 비동기(배리어 해제) 후속 |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 0017 PersistStore 첫 박스 — 가방 효과 저널(event sourcing·write-behind)·가방 진짜 kill→replay 로 원장 재현(복구 투명·"세계가 세션보다 오래 산다" 가방 판). 저널 스냅샷 압축·디스크 fsync·다중 복제·persist failover·월드 영속(존 intent 로그)·채팅/버스 영속 후속 |

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
