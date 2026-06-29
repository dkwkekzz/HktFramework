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
| ⑤ 코디네이션 | [5-coordination.md](5-coordination.md) | **세션/프레즌스** 🟡 failover-safe SSOT(플레이어 프레즌스 후속) · **오케스트레이터** 🟡 zone failover+self-healing + 배치 SSOT/질의·부하 배치·핸드오프 + executed SSOT(0241~0250) + 실 EntityZone 브리지(0272~0280) + 브리지 존 데이터 평면(0281~0290·#56) + #9 멀티프로세스 배선(0291~0300·게이트웨이 직접 라우팅·directFlowCoherent) + **host 프로세스 컨테이너 arc(0301~0310·#9 잔여·zoneHosts·자기 inbox 수신·자기 루프 tick·roster spawn/despawn·stale 거부·hostProcCoherent capstone)** + **host 프로세스 부하 균형 sub-arc(0311~0318·hostEntitySkew·placeAutoE/placeRebalanceE·hostBalanced)** + **다운스트림 뷰 egress·신뢰 전파(0331~0350·#9 후속·_drainZoneEgress·ack 자기-크기조정·gap/타임아웃 재전송·downstreamWorldCoherent capstone — #60 해소)** + **실 cluster 호스트 드라이버(0351~0360·#57·ClusterHostDriver·실 host.js child_process spawn·clusterHostsCoherent)** + **실 cluster 데이터 평면(0361~0370·#57·deliver/zonedel/tick·egress/migrate 상태보존/killHost·failover/reconcile/격리/driveCluster·clusterCoherent desync 0 — 실 host.js 프로세스 전 데이터 평면 E2E)** + **broker 측 제어 평면 상주 코디네이터(0371~0380·#62·`cluster-coord.js` ClusterCoordinator·start/tick/연속 run 루프/매-tick desync 가드/상주 migrate·failover/syncPlan 비파괴 자가 치유/egress 집계/report/coordCoherent capstone — verify ad-hoc 구동을 상주화·잔여=옛 runMulti 합류+양방향 동기)** + 정리(orch-bridge-init 0332) |
| ⑥ 데이터 | [6-data.md](6-data.md) | **캐시** 🟡 set/get+read-through·TTL·무효화 + **용량 LRU·touch(0225~0226)** · **월드 영속** 🟡 intent 로그·replay·스냅샷·crash/recover + **write-behind·fsync(0227~0228)** · **DB·write-behind** 🟡 저널·복제·quorum·정합 윈도 |

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0380 현재 ⬜/🌱 박스 0 — 너비 1차 + … + 다운스트림 전파/수렴(0331~0350) + 실 cluster 호스트 드라이버(0351~0360·#57·clusterHostsCoherent) + 실 cluster 데이터 평면(0361~0370·#57·clusterCoherent desync 0) + broker 측 제어 평면 상주 코디네이터(0371~0380·#62·ClusterCoordinator·연속 tick 루프·coordCoherent) 완료. #57/#62 실 host.js OS 프로세스 데이터 평면을 상주 broker 제어 평면이 연속 구동.**

> **기준선**: 닫힌 step **~0380**([../../STATE.md](../../STATE.md) NOW=0380·이 지도 0380 까지 반영). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · 30KB 초과 박스 0(`wc -c src/*.js`·최대 orch-zonebridge 28.96KB·gateway 28.2KB·cluster-coord 10.9KB) · orch 가 `zone.js` 직접 import 0 hit(④ 은닉)·cluster-coord `require` 0(순수 주입) · **broker 측 제어 평면 상주 코디네이터 ✅**(0371~0380·재현: `coordcap` 5/5 maxDesync 0·drift→syncPlan 치유·coordCoherent·report coh·reg 0·spine ALL OK). **#16 확장**: 이번 묶음 bespoke 모드(coordstart~coordcap 10개)도 미승급(현 spine 모드=최신 step `coordcap` 1개·나머지 git per-commit) → reg 구조적 0 와 겹쳐 cluster-coord spine 안전망 얇음. **잔여 load-bearing: 코디네이터↔옛 cluster-run.js runMulti 코드 합류(#62)·코디네이터 lifecycle↔orch zoneHost 양방향 동기(#65)** · 진짜 비동기(#4) · 업스트림 intent 실 클라(#61).

## 다음 큰 걸음 (직관) — 🎯 #62 runMulti 통합: broker 측 제어 평면 상주 (0371~0380·SKILL §3.6)

> **0371~0380 = 0361~0370 의 실 데이터 평면 구동(verify 가 ad-hoc 으로 driveCluster 호출)을 *broker 측 제어 평면 상주 객체*로 옮김**. 새 박스 `cluster-coord.js`(`ClusterCoordinator`·10.9KB·require 0·순수 주입) — orch(in-proc 권위)+실 cluster+driver 를 묶어 *연속 tick 루프*로 상주 구동. cluster-run.js runMulti 의 핵심("한 broker 가 cluster 를 매 tick 구동")을 상주화한 것(#62 의 *능력* 충족).

**runMulti 통합 sub-arc(0371~0380):** 골격+start(0371·토폴로지 reconcile)→tick(0372·데이터 평면 1 tick)→run 연속 tick 루프(0373)→매-tick desync 가드(0374·maxDesync·ghost 진짜화)→상주 migrate(0375·상태 보존)→상주 failover(0376·상태 소실 정직)→syncPlan 비파괴 자가 치유(0377·차분→누락만 zoneadd)→egress 집계(0378)→report 대시보드(0379)→capstone coordCoherent(0380·start→run→drift→syncPlan 치유 뒤 desync 0).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0)라 2차 허용. 0371~0380 은 0361~0370 verdict 가 지목한 *cluster-run.js runMulti 코어에 orch 상주 + 연속 tick 루프*를 집행한 **새 능력**(오케스트레이터 기능 17·과심화 아님). 재현 증거(시드 5종 5/5): `coordcap`(maxDesync 0·drift→syncPlan 치유·coordCoherent·report coh)·`reg`/`spine` ALL OK·`Math.random`/UObject src 0·cluster-coord require 0(순수 주입)·orch→zone.js import 0·>30KB 박스 0(cluster-coord 10.9KB). **세 잔여**: ⒜ **#62 코드 합류** — 이 코디네이터와 옛 `cluster-run.js` lockstep runMulti(14-프로세스)가 *두 별개 runner*·합류 미수행(능력은 섰음) ⒝ **#65 양방향 동기** — 코디네이터 migrate/failover 가 orch 권위 zoneHost 미갱신(단방향·실 migrate 후 clusterDesync stale 발산→capstone 이 migrate/failover 제외) ⒞ reg 구조적 0(새 박스 run() 미사용) + bespoke 미승급(#16)으로 cluster-coord spine 안전망 얇음. **다음 권고: 코디네이터↔cluster-run.js runMulti 합류(#62) + 코디네이터 lifecycle↔orch zoneHost 양방향 동기(#65), 그 다음 업스트림 intent 실 클라(#61)·진짜 비동기(#4).** step-loop 이 STATE §2 로 승급.

---

## (이전) #57 드라이버 계약 + 실 spawn (0351~0360·SKILL §3.6)

> **0351~0360 = orch 의 *논리* zoneHost 컨테이너(0301~0350 내내 인프로세스 Map·#57 최상위 load-bearing)를 실 `host.js` 자식 OS 프로세스로 물질화**. 0319~0350 이 인프로세스 다운스트림 E2E 를 완결한 뒤, 이번 묶음은 그 다음 큰 걸음 — *실 프로세스 경계* — 의 첫 절반(드라이버 계약 + 실 spawn/존 인스턴스화)을 세웠다. 너비(⬜/🌱) 0 유지·새 박스 = `cluster-hostdriver.js`(번역 계층).

**드라이버 계약 sub-arc(0351~0357):** orch zoneHost 의 생애주기·데이터 평면 이벤트를 *실 cluster 가 소비할 계약*으로 노출 — 목표 매니페스트(`hostSpawnPlan` 0351)·reconcile 델타(`hostSpawnDelta` 0352)·`_hostSet` 의 spawn/despawn→`onSpawn/onDespawn`(0353)·존 귀속→`onAssign/onUnassign`(0354)·entity frame→`onFrame`(0355)·다운스트림 egress→`onEgress`(0356)·그리고 `ClusterHostDriver`(`cluster-hostdriver.js` 0357)가 이 이벤트를 cluster 명령(spawnOne/killHost/rpc)으로 *동기* 번역(commands 큐)하고 `flush` 가 *async* 집행(번역↔집행 분리=#4 비동기 경계 격리). 이론 = *reconcile 루프*(목표 상태 매니페스트 + 현재 상태 델타 → 명령). 전부 OFF 플래그(미부착→호출 0·reg 0).

**실 spawn sub-arc(0358~0360):** 번역 계약을 *실 `Cluster`(child_process)* 에 집행 — `flush(cluster, specOf)` 가 실 `host.js` 자식 프로세스를 spawn 하고 존을 makeActor 로 인스턴스화(0358·livePid 1·snapshot 에 zone)·`host.js` `zoneadd` cmd 로 한 프로세스가 다중 존 incremental 소유(0359·기존 cmd 무변경→e2e 동일)·capstone `clusterHostsCoherent`(0360·논리 컨테이너↔드라이버 명령 순계 1:1) + 실 Cluster 다중 host E2E(host.js 2 프로세스·A=[z1,z2]·B=[z3]).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0)라 2차 허용. 0351~0360 은 *연속 4묶음 verdict 가 지목한 최상위 load-bearing #57*(실 host.js OS 프로세스/소켓 spawn)을 집행한 **새 능력**(오케스트레이터 기능 15·과심화 아님). 재현 증거(시드 5종 5/5): `hostplan`/`hostdelta`/`hostdrive`/`hostroster`/`hostframe`/`hostegress`/`hostcmd` (in-proc 드라이버 계약)·`hostspawnreal`(실 host.js livePid 1·zone z1 인스턴스)·`hostmultizone`(한 프로세스 z1·z2)·`clusterhostcap`(clusterHostsCoherent + 실 host.js 2 프로세스 A=[z1,z2]·B=[z3])·`reg`/`spine` ALL OK·`Math.random`/UObject src 0·orch→zone.js 직접 import 0·>30KB 박스 0(최대 orch-zonebridge 28.9KB). **세 한계**: ⒜ `flush` 가 실 집행하는 건 spawn+zoneadd 까지 — deliver/egress 는 큐 번역만(실 소켓 데이터 평면 집행 미연결) ⒝ migrate/killHost·graceful 상태 이전·`cluster-run.js` runMulti 통합 미연결(실 lifecycle 전환은 후속) ⒞ in-proc 드라이버 계약은 recorder 로 검증(by-construction·#53 family) — 단 실 spawn/zoneadd 는 진짜 child_process. **다음 권고(불변): #57 잔여 — deliver/egress 실 소켓 데이터 평면 집행 + migrate/killHost 실 프로세스 전환 + cluster-run.js runMulti 통합, 그 다음 진짜 비동기(#4)**. 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
