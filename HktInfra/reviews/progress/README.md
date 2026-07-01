# progress/ — 서버별 기능 리스트 진행 지도 (주제=계층별 분할)

> **이 폴더가 답하는 것**: "*무슨 서버*를 만들고 있고, 그 서버에 *어떤 기능들*이 필요하고, 각 기능을 *어떻게 구현하면 되고*, *무엇을 했고/남았는가*?" 를 비전문가도 리스트로 훑을 수 있게 그린다. 한 서버 = 기능 리스트, 각 기능 = (왜 필요 → 어떻게 구현 → 무엇을 했나/남음). **이론은 서버당 하나가 아니라 기능마다 다르다.**
> 구조 권위는 [../../SPINE.md](../../SPINE.md)(§1 토폴로지·§2 계층 책임), 진행 마커 권위는 [../../STATE.md](../../STATE.md) §5, 정당성 판정(척추 지켰나)은 묶음 감사 [../README.md](../README.md) §1.
> **분할 규칙**: 한 파일에 다 몰지 않는다 — *주제(6계층)당 파일 1개*, 그 안에서 *박스(서버)별 항목*(무슨 서버 + 필요한 기능 리스트 + 지금 어디). 매 리뷰가 이번 묶음이 건드린 서버 항목만 이어 갱신한다(점적 기록·정합 판정은 감사·step 문서).

## 큰 줄기 한 줄

> **"한 프로세스가 모든 일을 하면 모든 일이 서로의 병목이다."** 지금 한 프로세스에 뭉친 로그인·시뮬·아이템·채팅·이벤트·영속을, 상용 MMORPG 토폴로지의 **6계층 · 그 안의 박스들**로 쪼갠다. 각 박스를 *원격에서 도는 headless 서버*의 씨앗으로 심고 **한 step 에 한 조각씩** 키운다. 그림이 아니라 `node run.js` 로 검증되는 인프라가 목표.

## 계층(주제)별 진행 파일 — 무슨 서버가 지금 어디까지

> 각 파일은 박스(서버)마다 *무슨 서버·어떤 이론·왜 필요→어떻게 구현(단계)·지금 어디* 를 인과로 푼다. 아래는 "무슨 서버가 지금 무엇을 하나"의 한 줄 요약.

| 계층 | 파일 | 무슨 서버 — 지금 어디 (한 줄) |
|---|---|---|
| ① 엣지 | [1-edge.md](1-edge.md) | **로그인** 🟡 일회 티켓·은닉 + 대기열+발급+만료 + 백프레셔·재접속(0219~0220) + **계정 검증·큐 이탈(0229~0230)** · **게이트웨이** 🟡 별 프로세스·다중 GW 네임스페이스 + **존 직접 entity *업스트림* 라우팅(0293~0299·#9)** + **다운스트림 뷰 *전파·신뢰·실 클라 종단*(0331~0350·#9 후속·존→게이트웨이→실 DownClient·dseq/ack/재전송/격리/유계화·#60 해소)** (군 풀·암호화 후속) |
| ② 월드 | [2-world.md](2-world.md) | **존** 🟡 *가장 성숙* — 결정론 복제·AOI·분할·핸드오프·failover + **월드 다운스트림 데이터 평면 E2E(0319~0350·#9 후속): host AOI 산출→포착·검증(0319~30)→신뢰 전파(egress/ack/재전송·0331~41)→실 DownClient 수렴 desync 0(0342~50)→grand capstone downstreamWorldCoherent — SPINE §4 경로2 host→게이트웨이→실 클라 인프로세스 완결(#60 해소·실 OS 프로세스 #57 잔여)**(동적 N 존 후속) · **인스턴스** 🟡 spawn/despawn + 수요 spawn·라우팅(0215~0216) + **이탈·수요 자동 despawn(0221~0222)** |
| ③ 게임 서비스 | [3-services.md](3-services.md) | **가방·채팅·랭킹·wrouter+수신함·파티·거래소·시세피드·우편·우편배지·길드** 🟡 — 거래소↔가방 saga + 우편 동형(0142~0180) + 길드(0181~0190) + 공유 금고 0191~0200(🚦과심화) |
| ④ 버스 | [4-bus.md](4-bus.md) | **이벤트 버스** 🟡 *깊게 자람* — pub/sub·failover·무손실·유계화·소비자 lease·관측(물리 분산 후속) |
| ⑤ 코디네이션 | [5-coordination.md](5-coordination.md) | **세션/프레즌스** 🟡 failover-safe SSOT(플레이어 프레즌스 후속) · **오케스트레이터** 🟡 zone failover+self-healing + 배치 SSOT/질의·부하 배치·핸드오프 + executed SSOT(0241~0250) + 실 EntityZone 브리지(0272~0280) + 브리지 존 데이터 평면(0281~0290·#56) + #9 멀티프로세스 배선(0291~0300·게이트웨이 직접 라우팅·directFlowCoherent) + **host 프로세스 컨테이너 arc(0301~0310·#9 잔여·zoneHosts·자기 inbox 수신·자기 루프 tick·roster spawn/despawn·stale 거부·hostProcCoherent capstone)** + **host 프로세스 부하 균형 sub-arc(0311~0318·hostEntitySkew·placeAutoE/placeRebalanceE·hostBalanced)** + **다운스트림 뷰 egress·신뢰 전파(0331~0350·#9 후속·_drainZoneEgress·ack 자기-크기조정·gap/타임아웃 재전송·downstreamWorldCoherent capstone — #60 해소)** + **실 cluster 호스트 드라이버(0351~0360·#57·ClusterHostDriver·실 host.js child_process spawn·clusterHostsCoherent)** + **실 cluster 데이터 평면(0361~0370·#57·deliver/zonedel/tick·egress/migrate 상태보존/killHost·failover/reconcile/격리/driveCluster·clusterCoherent desync 0 — 실 host.js 프로세스 전 데이터 평면 E2E)** + **broker 측 제어 평면 상주 코디네이터(0371~0380·#62·`cluster-coord.js` ClusterCoordinator·연속 run 루프·coordCoherent — verify ad-hoc 구동을 상주화)** + **코디네이터 placement 권위 양방향 동기(0381~0390·#65·placement SSOT·migrate/failover 가 placement 갱신·coordDesync/placementCoherent/syncedCoherent — 이주/장애 후도 정합·잔여=이중 권위 합류 #67·tick placement-aware #66·옛 runMulti 합류 #62)** + 정리(orch-bridge-init 0332) · **비동기 실행 substrate(0431~0440·#4·`async-core.js`·in-proc ✅) + 실 Net·sim seam 브리지 in-proc 등가(0441~0450·`async-net.js`) + 실 run() net.step 배리어 실제 치환(0451~0460·`async-barrier.js`·run() 이 net.step 대신 stepper 로 월드입력을 정전 순서 holdback/resync 배달·손실+지연 하 world/뷰==lockstep·exactly-once·다중존 투명·OFF→net.step reg 0)** |
| ⑥ 데이터 | [6-data.md](6-data.md) | **캐시** 🟡 set/get+read-through·TTL·무효화 + **용량 LRU·touch(0225~0226)** · **월드 영속** 🟡 intent 로그·replay·스냅샷·crash/recover + **write-behind·fsync(0227~0228)** · **DB·write-behind** 🟡 저널·복제·quorum·정합 윈도 |

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0460 현재 ⬜/🌱 박스 0 — 너비 1차 + … + **#4 비동기 substrate in-proc(0431~40·`async-core`) + 실 Net·sim seam 브리지 등가(0441~50·`async-net`) + 실 run() net.step 배리어 실제 치환(0451~60·`async-barrier`)** 완료. #4 — 0001 이래 열린 채였던 lockstep 의존을 *실 run() 전송 경로*에서 async substrate 로 치환(월드/뷰 lockstep 수렴·OFF→기본 lockstep 보존 reg 0). 잔여=완전 async 전환(항상 ON·이주 하 유계 resync·downstream 손실/재접속).**

> **기준선**: 닫힌 step **~0460**([../../STATE.md](../../STATE.md) NOW=0460·이 지도 0460 까지 반영). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론·주석만) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · 30KB 초과 박스 0(`wc -c src/*.js`·최대 cluster-coord 29.3KB·async-net 17.4KB·async-barrier 8.4KB) · orch 가 `zone.js` 직접 import 0 hit(④ 은닉) · **#4 substrate ✅ in-proc + 실 Net·sim seam 브리지 등가 ✅ + 실 run() net.step 배리어 실제 치환 ✅**(0431~0460·재현: `nete2ecap`·`bare2ecap` 각 5/5[bare2ecap=실 run() 손실+지연 world/뷰==lockstep·exactly-once·다중존 투명]·`reg`/`spine` ALL OK[asyncBarrier OFF→net.step 그대로 비트 동일]·async-barrier `topo-run.js:88`/`:102` gated). **#16 확장**: 이번 묶음 bespoke 모드(barpass~bare2ecap 10개)도 미승급(현 spine 모드=최신 `bare2ecap` 1개·나머지 git per-commit). **잔여 load-bearing: 완전 async 전환(#4 후속·항상 ON·이주 하 유계 resync·downstream)·실 host.js child 경계 업스트림(#70·#57 짝)** · orch zoneHost entity 컨테이너 동기(#68·경미) · 동치 transitive(#69·경미) · substrate 실 전송 by-construction(#71·단일 존 검증·다중 존 이주 섭동 후속).

## 다음 큰 걸음 (직관) — 🎯 #4 실 run() net.step 배리어 실제 치환 (0451~0460·SKILL §3.6)

> **0451~0460 = #4 실제 치환** — 0441~0450 이 substrate 를 *실 engine Net 메시지·실 sim seam* 위에서 등가 증명(단 async-net 은 run() 밖 검증 전용)한 뒤, 이번 묶음은 실 `run()` 의 `net.step()` 중앙 lockstep 배리어를 신규 박스 `async-barrier.js` 로 **실제 대체**했다. run() 이 매 tick net.step() 대신 stepper 를 부르고(`topo-run.js:88`/`:102`·`opts.asyncBarrier` OFF→net.step() 그대로·reg 구조적 0), 그 stepper 가 월드 입력을 *정전 순서(발신 순서 m.id)* holdback 으로 배달·move 손실 resync·지연 jitter 를 흡수. 핵심 명제: **`worldDigest(run{asyncBarrier}) == worldDigest(run{})`(lockstep)** — 중앙 배리어를 async substrate 로 치환해도 월드/뷰 결정론 보존.

**#4 실제 치환 sub-arc(0451~0460):** stepper seam 투명(0451)→인라인 배달+월드입력 Lamport 스탬프(0452)→정전 순서 holdback 제자리 슬롯(0453)→move 손실+resync 복원(0454·단일 존)→무-resync 대조 발산(0455·load-bearing 확증)→exactly-once 회계(0456·moveDup0)→교차-tick 지연 jitter(0457)→다중 존+핸드오프 투명(0458)→다운스트림 뷰 수렴(0459·desync0)→grand capstone bare2ecap(0460).

**의외 발견(0453)**: 실 존은 *순서 민감*(enter 가 zone.rng() 소비·move 는 entity 존재 요구) — 임의 재정렬은 월드 파괴다. 그래서 배리어는 *발신 순서(m.id) 재구성*으로 lockstep 을 재현하고, load-bearing 은 *재정렬이 아니라 손실 복원*(move 는 위치 가산=가환이라 늦게 적용해도 최종 동일). 손실/지연 섭동은 *단일 존*(무이주)에서 검증 — 다중 존은 *투명 통합*만(이주 경계 넘는 지연 move 는 손실될 수 있어 이주 전 유계 resync 필요).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0)라 2차 허용. 0451~0460 은 직전 0441-0450 verdict 가 STATE §2 로 올린 *load-bearing #4(실 net.step 실제 치환)* 을 집행한 **새 능력**(코디네이션 substrate→실 run() 배선 기능 9·과심화 아님·신규 박스 `async-barrier.js`). 재현 증거(시드 5종 5/5): `bare2ecap`(단일 존 손실+지연→world/뷰==lockstep·exactly-once·다중 존+핸드오프 투명 world/log==lockstep)·`barnoresync`(무-resync 발산·resync 복원=substrate load-bearing)·`reg`/`spine` ALL OK(asyncBarrier OFF→net.step 그대로 비트 동일)·`Math.random`/UObject src 0(주석만)·async-barrier `topo-run.js:88`/`:102` gated·>30KB 박스 0(async-barrier 8.4KB). **#4 🟡대폭 진전(실 run() 치환 ✅·잔여=완전 async 전환)**·부수 **#72 신규(다중 존 이주 하 손실/지연 섭동 미검증·유계 resync 필요)·#53 확장(손실/지연 드라이버 합성·단일 존)**. **잔여**: ⒜ **완전 async 전환**(항상 ON·다중 존 이주 하 유계 resync·downstream 손실/재접속·다음 큰 load-bearing) ⒝ **#70 실 host.js child 경계 업스트림**(#57 짝) ⒞ **#68·#69 경미**. **다음 권고: #4 완전 async 전환(다중 존 이주 유계 resync) 또는 실 host.js child 업스트림(#70), 그 다음 경미 정리(#68·#69·#72·#16 승급).** step-loop 이 STATE §2 로 승급.

## (이전) #4 브리지 in-proc 등가: async substrate → 실 Net·sim seam (0441~0450·SKILL §3.6)

> **0441~0450 = #4 브리지 in-proc 등가** — 0431~0440 추상 substrate 를 신규 박스 `async-net.js`(run() 밖 검증 전용)로 **실 engine Net 메시지·동결 sim seam(`DummySimCore`)**에 이어 배리어 치환 등가 증명. 핵심: 실 engine Net 배리어로 배달하든 배리어-free substrate 로 배달하든 존 실 월드 == canonical. 재현: `nete2ecap` 5/5·`reg`/`spine` ALL OK. **다음 권고였음: #4 실 net.step *실제* 치환(→0451~0460 이 async-barrier 로 집행).**

## (이전) #4 진짜 비동기 substrate: 논리 클럭·인과 정렬 in-proc (0431~0440·SKILL §3.6)

> **0431~0440 = #4 in-proc substrate** — 0001 이래 열린 채였던 #4(broker lockstep·net.step 동기 배리어가 결정론을 떠받침)를 *해제할 기계*를 신규 박스 `async-core.js`(run() 밖 검증 전용·매 step reg 구조적 0)에 in-proc 으로 처음 세웠다.

**#4 substrate sub-arc(0431~0440):** Lamport 논리 클럭(0431)→send/recv 인과·clock condition(0432)→결정론 전순서(0433)→holdback 재정렬·low-water-mark(0434)→인과 의존 배달·FIFO-free(0435)→async 수렴 desync0(0436)→배리어-free 진행·비-lockstep(0437)→손실 하 gap-resync(0438)→인과 회계·exactly-once(0439)→grand capstone(0440·M 복제 순열+손실 E2E). 재현: `asynce2ecap` 5/5·`reg`/`spine` ALL OK·async-core run() 호출 0 hit. **다음 권고였음: #4 실 net.step 배리어 치환(→0441~0450 이 브리지 in-proc 등가로 집행).**

---

## (이전) #57 드라이버 계약 + 실 spawn (0351~0360·SKILL §3.6)

> **0351~0360 = orch 의 *논리* zoneHost 컨테이너(0301~0350 내내 인프로세스 Map·#57 최상위 load-bearing)를 실 `host.js` 자식 OS 프로세스로 물질화**. 0319~0350 이 인프로세스 다운스트림 E2E 를 완결한 뒤, 이번 묶음은 그 다음 큰 걸음 — *실 프로세스 경계* — 의 첫 절반(드라이버 계약 + 실 spawn/존 인스턴스화)을 세웠다. 너비(⬜/🌱) 0 유지·새 박스 = `cluster-hostdriver.js`(번역 계층).

**드라이버 계약 sub-arc(0351~0357):** orch zoneHost 의 생애주기·데이터 평면 이벤트를 *실 cluster 가 소비할 계약*으로 노출 — 목표 매니페스트(`hostSpawnPlan` 0351)·reconcile 델타(`hostSpawnDelta` 0352)·`_hostSet` 의 spawn/despawn→`onSpawn/onDespawn`(0353)·존 귀속→`onAssign/onUnassign`(0354)·entity frame→`onFrame`(0355)·다운스트림 egress→`onEgress`(0356)·그리고 `ClusterHostDriver`(`cluster-hostdriver.js` 0357)가 이 이벤트를 cluster 명령(spawnOne/killHost/rpc)으로 *동기* 번역(commands 큐)하고 `flush` 가 *async* 집행(번역↔집행 분리=#4 비동기 경계 격리). 이론 = *reconcile 루프*(목표 상태 매니페스트 + 현재 상태 델타 → 명령). 전부 OFF 플래그(미부착→호출 0·reg 0).

**실 spawn sub-arc(0358~0360):** 번역 계약을 *실 `Cluster`(child_process)* 에 집행 — `flush(cluster, specOf)` 가 실 `host.js` 자식 프로세스를 spawn 하고 존을 makeActor 로 인스턴스화(0358·livePid 1·snapshot 에 zone)·`host.js` `zoneadd` cmd 로 한 프로세스가 다중 존 incremental 소유(0359·기존 cmd 무변경→e2e 동일)·capstone `clusterHostsCoherent`(0360·논리 컨테이너↔드라이버 명령 순계 1:1) + 실 Cluster 다중 host E2E(host.js 2 프로세스·A=[z1,z2]·B=[z3]).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0)라 2차 허용. 0351~0360 은 *연속 4묶음 verdict 가 지목한 최상위 load-bearing #57*(실 host.js OS 프로세스/소켓 spawn)을 집행한 **새 능력**(오케스트레이터 기능 15·과심화 아님). 재현 증거(시드 5종 5/5): `hostplan`/`hostdelta`/`hostdrive`/`hostroster`/`hostframe`/`hostegress`/`hostcmd` (in-proc 드라이버 계약)·`hostspawnreal`(실 host.js livePid 1·zone z1 인스턴스)·`hostmultizone`(한 프로세스 z1·z2)·`clusterhostcap`(clusterHostsCoherent + 실 host.js 2 프로세스 A=[z1,z2]·B=[z3])·`reg`/`spine` ALL OK·`Math.random`/UObject src 0·orch→zone.js 직접 import 0·>30KB 박스 0(최대 orch-zonebridge 28.9KB). **세 한계**: ⒜ `flush` 가 실 집행하는 건 spawn+zoneadd 까지 — deliver/egress 는 큐 번역만(실 소켓 데이터 평면 집행 미연결) ⒝ migrate/killHost·graceful 상태 이전·`cluster-run.js` runMulti 통합 미연결(실 lifecycle 전환은 후속) ⒞ in-proc 드라이버 계약은 recorder 로 검증(by-construction·#53 family) — 단 실 spawn/zoneadd 는 진짜 child_process. **다음 권고(불변): #57 잔여 — deliver/egress 실 소켓 데이터 평면 집행 + migrate/killHost 실 프로세스 전환 + cluster-run.js runMulti 통합, 그 다음 진짜 비동기(#4)**. 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
