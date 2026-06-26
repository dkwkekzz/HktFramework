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
| ① 엣지 | [1-edge.md](1-edge.md) | **로그인** 🟡 일회 티켓·은닉 + 대기열+발급+만료 + 백프레셔·재접속(0219~0220) + **계정 검증·큐 이탈(0229~0230)** · **게이트웨이** 🟡 별 프로세스·다중 GW 네임스페이스 + **존 위치 디렉토리·실 존 직접 entity 라우팅(0293~0299·#9·서비스 디스커버리·zoneDir→zoneDeliver·이주/장애 정합·bijection)** (군 풀·암호화 후속) |
| ② 월드 | [2-world.md](2-world.md) | **존** 🟡 *가장 성숙* — 결정론 복제·AOI·분할·핸드오프·failover + **다운스트림 AOI 뷰 산출·포착(0319~0320·#9 후속·예전 드롭하던 뷰를 버퍼링 싱크로 잡고 AOI 정확성 검증·0321~ 이어짐)**(동적 N 존 후속) · **인스턴스** 🟡 spawn/despawn + 수요 spawn·라우팅(0215~0216) + **이탈·수요 자동 despawn(0221~0222)** |
| ③ 게임 서비스 | [3-services.md](3-services.md) | **가방·채팅·랭킹·wrouter+수신함·파티·거래소·시세피드·우편·우편배지·길드** 🟡 — 거래소↔가방 saga + 우편 동형(0142~0180) + 길드(0181~0190) + 공유 금고 0191~0200(🚦과심화) |
| ④ 버스 | [4-bus.md](4-bus.md) | **이벤트 버스** 🟡 *깊게 자람* — pub/sub·failover·무손실·유계화·소비자 lease·관측(물리 분산 후속) |
| ⑤ 코디네이션 | [5-coordination.md](5-coordination.md) | **세션/프레즌스** 🟡 failover-safe SSOT(플레이어 프레즌스 후속) · **오케스트레이터** 🟡 zone failover+self-healing + 배치 SSOT/질의·부하 배치·핸드오프 + executed SSOT(0241~0250) + 실 EntityZone 브리지(0272~0280) + 브리지 존 데이터 평면(0281~0290·#56) + #9 멀티프로세스 배선(0291~0300·게이트웨이 직접 라우팅·directFlowCoherent) + **host 프로세스 컨테이너 arc(0301~0310·#9 잔여·zoneHosts·자기 inbox 수신·자기 루프 tick·roster spawn/despawn·stale 거부·hostProcCoherent capstone)** + **host 프로세스 부하 균형·생애주기·장애 sub-arc(0311~0318·hostLoadSkew·entity 가중 hostEntitySkew·생애주기 로그·placeAutoE/placeRebalanceE·다중/동시 host 장애·hostBalanced capstone — 실 OS 프로세스/소켓 spawn 만 잔여)** |
| ⑥ 데이터 | [6-data.md](6-data.md) | **캐시** 🟡 set/get+read-through·TTL·무효화 + **용량 LRU·touch(0225~0226)** · **월드 영속** 🟡 intent 로그·replay·스냅샷·crash/recover + **write-behind·fsync(0227~0228)** · **DB·write-behind** 🟡 저널·복제·quorum·정합 윈도 |

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0320 현재 ⬜/🌱 박스 0 — 너비 1차 + 2·3차 균형 + #16 승급(0231~0240) + #51 배치 실배선(0241~0250) + orch 정리(0251) + 캐시 4차 고도화(0252~0260) + #49 wiring 정리 arc(0261~0270) + 도구 #43(0271) + #51b 실 zone.js 브리지(0272~0280) + #56 브리지 존 데이터 평면(0281~0290) + #9 멀티프로세스 배선(0291~0300) + host 프로세스 컨테이너 arc(0301~0310) + host 프로세스 부하 균형·생애주기·장애 sub-arc(0311~0318) + 다운스트림 AOI 뷰 산출·포착(0319~0320·#9 후속·이어짐) 완료.**

> **기준선**: 닫힌 step **~0320**([../../STATE.md](../../STATE.md) NOW=0330·이 지도는 리뷰 닫힌 0320 까지 반영). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · 30KB 초과 박스 0(`wc -c src/*.js`·최대 orchestrator 29.7KB·#58 watch) · orch 가 `zone.js` 직접 import 0 hit(④ 은닉·EntityZone 은 `makeActor` 팩토리 주입·orch 는 `orch-zonebridge.js`/`orch-hostproc.js`/`orch-views.js` 믹스인만 require) · **host 프로세스 부하 균형 sub-arc ✅**(0311~0318·재현: hostLoadSkew 2→1·placeAuto z3@A vs placeAutoE z3@B·hostBalanced false→true 5/5·hostContainerCoherent·entityConserved) · **다운스트림 AOI 뷰 ✅포착**(0319~0320·zoneViewFrames>0·AOI enter==zoneVisibleIds·게이트웨이 발신). **#16 확장**: 이번 묶음 bespoke 모드(hostloadskew~hostzoneaoi)도 미승급(현 spine 모드=최신 step 1개만·나머지는 git per-commit). **잔여 load-bearing: 실 host.js *OS 프로세스/소켓* spawn(#57)**(zoneHosts 는 orch 인프로세스 *논리* 컨테이너·cluster-run.js 실 spawn 통합 미연결).

## 다음 큰 걸음 (직관) — 🎯 host 프로세스 부하 균형 + 다운스트림 뷰 (0311~0320·SKILL §3.6)

> **0311~0318 = host 프로세스 부하 균형·생애주기·장애**(0301~0310 host 컨테이너 *심화*) + **0319~0320 = 다운스트림 AOI 뷰 산출·포착**(#9 후속·SPINE §4 경로2·이어짐 0321~0330). 둘 다 너비(⬜/🌱) 0 유지·새 박스 0(존/오케스트레이터 *심화*·`orch-views.js` 는 0323 분할 산물).

**host 프로세스 부하 균형 ✅(0311~0318):** 0310 까지 host 컨테이너(`zoneHosts`)는 *섰지만* 오케스트레이터가 그걸 *부하로 운영*하지 못했다. 이 sub-arc 가 운영 능력을 더한다: 존 수 불균형(`hostLoadSkew`·0311)→생애주기 이벤트 로그(`hostLifecycle`·실 spawn/killHost 지점 씨앗·0312)→다중 존 host 장애(0313)→**entity(≈동접) 가중 불균형**(`hostEntitySkew`·존 수 균형이어도 만원 host 드러냄·0314)→다중 동시 host 장애(0315)→entity 가중 자동 배치(`placeAutoE`·만원 host 회피·0316)→entity 가중 재배치(`placeRebalanceE`·gap 단조 감소 무손실·0317)→균형 술어 capstone(`hostBalanced`·0318). 새 op 미수신/플래그 OFF→직전 step 비트 동일(reg 0).

**다운스트림 AOI 뷰 ✅포착(0319~0320·이어짐):** 브리지 런타임 존이 산출하던 `view_delta`(AOI 뷰)가 0282 이래 *no-op 싱크로 드롭*됐다(SPINE §4 경로2 월드 다운스트림 미배선). 0319 가 싱크를 *버퍼링*으로 바꿔 포착하고(`topo-actors.js:71`), 0320 이 AOI 정확성(`zoneVisibleIds`==산출 enter·반경 안만)을 단언. 0321~0330 이 증분 델타·상호 가시/exit·직렬화·격리·이주 연속성·무굶김·무손실·capstone 으로 잇는다(다음 리뷰 묶음).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0·0210~)라 2차 허용. 0311~0318 은 0301~0310(host 컨테이너·load-bearing #57 의 논리 층)의 *운영 심화*, 0319~0320 은 *미배선이던 다운스트림 절반*(SPINE §4 경로2)을 처음 세운 것 → **과심화 아님**(전자는 승인된 심화·후자는 새 능력). 재현 증거: hostLoadSkew 2→1·placeAuto z3@A vs placeAutoE z3@B·hostBalanced false→true 5/5·hostContainerCoherent·entityConserved·zoneViewFrames>0·AOI enter==zoneVisibleIds·게이트웨이 발신·`reg`/`spine` ALL OK·`Math.random`/UObject src 0·orch→zone.js 직접 import 0·>30KB 박스 0(최대 orchestrator 29.7KB·#58 watch). **한계**: ⒜ 부하 균형·뷰 정합 술어 by-construction(#53·#59)·자동 트리거 미연결 ⒝ `zoneHosts` 는 여전히 orch 인프로세스 *논리* 컨테이너(실 host.js OS 프로세스 spawn 아님·#57) ⒞ 다운스트림 뷰는 *산출·포착*까지(게이트웨이→실 클라 전파 미연결·#60). **다음 권고(불변): 실 host.js OS 프로세스/소켓 spawn(#57·cluster-run.js 통합) + 진짜 비동기(#4·논리 클럭)** — 부하 균형·다운스트림 뷰는 *심화*이고, 최상위 load-bearing 은 여전히 #57. 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
