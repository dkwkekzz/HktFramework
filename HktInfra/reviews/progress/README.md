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
| ⑤ 코디네이션 | [5-coordination.md](5-coordination.md) | **세션/프레즌스** 🟡 failover-safe SSOT(플레이어 프레즌스 후속) · **오케스트레이터** 🟡 zone failover+self-healing + 배치 SSOT/질의·부하 배치·핸드오프 + executed SSOT(0241~0250) + 실 EntityZone 브리지(0272~0280) + 브리지 존 데이터 평면(0281~0290·#56) + #9 멀티프로세스 배선(0291~0300·게이트웨이 직접 라우팅·directFlowCoherent) + **host 프로세스 컨테이너 arc(0301~0310·#9 잔여·zoneHosts·자기 inbox 수신·자기 루프 tick·roster spawn/despawn·stale 거부·hostProcCoherent capstone)** + **host 프로세스 부하 균형 sub-arc(0311~0318·hostEntitySkew·placeAutoE/placeRebalanceE·hostBalanced)** + **다운스트림 뷰 egress·신뢰 전파(0331~0350·#9 후속·_drainZoneEgress·ack 자기-크기조정·gap/타임아웃 재전송·downstreamWorldCoherent capstone — #60 해소·실 OS 프로세스 #57 잔여)** + **정리: orch-bridge-init 분할(0332·#58 해소·orchestrator.js 29.7→22.8KB)** |
| ⑥ 데이터 | [6-data.md](6-data.md) | **캐시** 🟡 set/get+read-through·TTL·무효화 + **용량 LRU·touch(0225~0226)** · **월드 영속** 🟡 intent 로그·replay·스냅샷·crash/recover + **write-behind·fsync(0227~0228)** · **DB·write-behind** 🟡 저널·복제·quorum·정합 윈도 |

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0350 현재 ⬜/🌱 박스 0 — 너비 1차 + … + host 프로세스 부하 균형(0311~0318) + 다운스트림 AOI 뷰 *포착·검증*(0319~0330) + 다운스트림 *전파*(0331~0341·egress/ack/재전송·capstone downstreamDeliverCoherent) + 실 다운스트림 클라 *수렴*(0342~0350·DownClient desync 0·grand capstone downstreamWorldCoherent) 완료. #58(orch 크기)·#60(다운스트림→실 클라 전파) 해소.**

> **기준선**: 닫힌 step **~0350**([../../STATE.md](../../STATE.md) NOW=0350·이 지도 0350 까지 반영). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · 30KB 초과 박스 0(`wc -c src/*.js`·최대 orch-zonebridge 28.4KB·gateway 28.2KB·**orchestrator 22.8KB**·#58 해소 0332) · orch 가 `zone.js` 직접 import 0 hit(④ 은닉·EntityZone 은 `makeActor` 팩토리 주입) · **다운스트림 전파 sub-arc ✅**(0331~0341·재현: egress4==gwRx4·pruned4 buf0·손실 dropped1→resync1→resent3→인오더 복구) · **실 클라 수렴 sub-arc ✅**(0342~0350·재현: dc0.seen==aoi(a1)·손실 하 convergedTo true·worldcap 5/5 downstreamWorldCoherent·dc0/dc1/dc2 수렴·isolated). **#16 확장**: 이번 묶음 bespoke 모드(egress~worldcap 19개)도 미승급(현 spine 모드=최신 step `worldcap` 1개·나머지 git per-commit). **잔여 load-bearing: 실 host.js *OS 프로세스/소켓* spawn(#57)**(zoneHosts·egress·DownClient 은 orch 인프로세스 *논리*·cluster-run.js 실 spawn 통합 미연결) · 업스트림 intent 실 클라 경로(#61).

## 다음 큰 걸음 (직관) — 🎯 월드 다운스트림 데이터 평면 E2E 닫힘 (0319~0350·SKILL §3.6)

> **0331~0350 = 월드 다운스트림의 *전파*(0331~0341)와 *실 클라 수렴*(0342~0350)을 세워, 0319~0330 의 *포착·검증* 위에 SPINE §4 경로2(host→게이트웨이→실 클라)를 인프로세스로 완결**(#60 해소·grand capstone `downstreamWorldCoherent`). #58(orch 코어 크기)도 0332 정리로 해소. 너비(⬜/🌱) 0 유지·새 박스 = 수신 전용 `DownClient`(실 클라 하니스). *직전 0319~0330=다운스트림 AOI 뷰 포착·검증(review-0321-0330).*

**다운스트림 *전파* sub-arc(0331~0341):** 0319~0330 이 포착한 AOI 뷰를 실제 전역 net 으로 내보낸다 — orch `_drainZoneEgress`(존 버퍼→게이트웨이 `zoneView`·per-세션 단조 `dseq`)·게이트웨이 수신/세션→클라 라우팅(`downClients`)·신뢰성(ack 자기-크기조정 `zoneEgressBuf`·gap-resync 재전송·타임아웃 재전송[마지막 frame 손실]·leave 정리·격리)·capstone `downstreamDeliverCoherent`(손실·lifecycle 무손실 인오더). 이론 = *기존 netcode 패턴의 다운스트림 판*(0008 ack/NAK·0040 bus ack·0058 recoverRetry·0042 seenBound). 정리 0332(브리지 필드 init→`orch-bridge-init.js`·#58 해소).

**실 클라 *수렴* sub-arc(0342~0350):** 전파 종단(spectator addr)을 *수신 전용 실 `DownClient` 액터*로 교체 → host 권위 AOI == 클라 뷰(**desync 0**): 정적/상호 가시 위치(`zoneAuthSig`)·손실 하 수렴·교차 관찰자 일치(`seenPos`·겹친 뷰 desync 0)·다중 클라/migrate capstone(`convergedTo`)·수신 버퍼 유계화(`downRecvWindow`)·late-join keyframe·대시보드(`downstreamReport`)·E2E grand capstone `downstreamWorldCoherent`(0350·2존·3클라·손실·migrate·late-join 뒤 전 수렴).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0)라 2차 허용. 0331~0350 은 *미배선이던 다운스트림 절반*(SPINE §4 경로2)의 *마지막 홉*(전파+수렴)을 세운 **새 능력**(존 박스 기능 8 확장·게이트웨이 기능 5·과심화 아님)·0332 는 정리(기능 0·#58 해소). 재현 증거(현재 코드 inline·시드 5종 5/5): egress4==gwRx4·pruned4 buf0·손실 dropped1→resync1→resent3 복구·dc0.seen==aoi(a1)·손실 하 convergedTo true·`worldcap` 5/5(downstreamWorldCoherent·dc0/dc1/dc2 수렴·isolated)·`reg`/`spine` ALL OK·`Math.random`/UObject src 0·orch→zone.js 직접 import 0·>30KB 박스 0(최대 orch-zonebridge 28.4KB·orchestrator 22.8KB). **두 한계**: ⒜ DownClient·zoneHost·egress 모두 인프로세스 액터 — 실 host.js *OS 프로세스/소켓* spawn(#57·최상위 load-bearing) ⒝ 업스트림 intent 실 클라 경로(경로1·#61·현재 entityOps 합성 주입). **다음 권고(불변): 실 host.js OS 프로세스/소켓 spawn(#57·cluster-run.js 통합) + 진짜 비동기(#4·논리 클럭)** — 인프로세스 다운스트림 E2E 가 완결됐으니 이제 *실 프로세스 경계*로. 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
