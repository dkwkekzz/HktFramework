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
| ① 엣지 | [1-edge.md](1-edge.md) | **로그인** 🟡 일회 티켓·은닉 + 대기열+발급+만료 + 백프레셔·재접속(0219~0220) + **계정 검증·큐 이탈(0229~0230)** · **게이트웨이** 🟡 별 프로세스·다중 GW 네임스페이스(군 풀 후속) |
| ② 월드 | [2-world.md](2-world.md) | **존** 🟡 *가장 성숙* — 결정론 복제·AOI·분할·핸드오프·failover(동적 N 존 후속) · **인스턴스** 🟡 spawn/despawn + 수요 spawn·라우팅(0215~0216) + **이탈·수요 자동 despawn(0221~0222)** |
| ③ 게임 서비스 | [3-services.md](3-services.md) | **가방·채팅·랭킹·wrouter+수신함·파티·거래소·시세피드·우편·우편배지·길드** 🟡 — 거래소↔가방 saga + 우편 동형(0142~0180) + 길드(0181~0190) + 공유 금고 0191~0200(🚦과심화) |
| ④ 버스 | [4-bus.md](4-bus.md) | **이벤트 버스** 🟡 *깊게 자람* — pub/sub·failover·무손실·유계화·소비자 lease·관측(물리 분산 후속) |
| ⑤ 코디네이션 | [5-coordination.md](5-coordination.md) | **세션/프레즌스** 🟡 failover-safe SSOT(플레이어 프레즌스 후속) · **오케스트레이터** 🟡 zone failover+self-healing + 배치 SSOT/질의·부하 배치·핸드오프(0217~0218) + **자동 재배치·host 드레인(0223~0224·단 #51 paper map)** |
| ⑥ 데이터 | [6-data.md](6-data.md) | **캐시** 🟡 set/get+read-through·TTL·무효화 + **용량 LRU·touch(0225~0226)** · **월드 영속** 🟡 intent 로그·replay·스냅샷·crash/recover + **write-behind·fsync(0227~0228)** · **DB·write-behind** 🟡 저널·복제·quorum·정합 윈도 |

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0280 현재 ⬜/🌱 박스 0 — 너비 1차 + 2·3차 균형 + #16 승급(0231~0240) + #51 배치 실배선(0241~0250) + orch 정리(0251) + 캐시 4차 고도화(0252~0260) + #49 wiring 정리 arc(0261~0270) + 도구 #43(0271) + #51b 실 zone.js 브리지(0272~0280) 완료.**

> **기준선**: 닫힌 step **~0280**([../../STATE.md](../../STATE.md) NOW). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · 30KB 초과 박스 0(`wc -c src/*.js|awk '$1>30000'`=0행·최대 svc-exchange-core 26KB) · **#43 ✅**(0271·`engine/close-step.js:59` src/*.js >30KB 가드·#49 재발 방비) · **#51b 실 zone.js 브리지 ✅**(0272~0280·orch 가 placement 집행으로 실 EntityZone lifecycle 구동·`orch-zonebridge.js`·`zonecapstone` 5/5 fullyCoherent·runtimeCount==runningCount==placedCount 3). **#16 확장**: 이번 묶음 bespoke 모드(zonebridge~zonecapstone)도 미승급(현 spine 모드=zonecapstone 만·0272~0279 모드는 git per-commit). **잔여 load-bearing: #9 멀티프로세스 배선**(브리지=orch 인프로세스 핸들·실 host.js 소켓 0)·브리지 존 *비활성*(entity 트래픽·tick 0·#56).

## 다음 큰 걸음 (직관) — 🎯 도구 #43 + #51b 실 zone.js 브리지 arc (0271~0280·SKILL §3.6)

> **0271 = 도구 #43**(close-step src/*.js >30KB 가드·net-core 무변경·#49 재발 방비) — 세 라운드 보류됐던 동반 갭. **0272~0280 = #51b 실 zone.js 브리지**(load-bearing) — 세 라운드 연속 권고된 게이트를 집행. 너비(⬜/🌱) 0 유지·새 박스 0(오케스트레이터 *심화*).

**#51b 브리지 ✅(0272~0280):** 0241~0250 의 `running`(zoneId→host *문자열* 추상 집행 SSOT)을 **실 EntityZone(`zone.js`) 런타임 인스턴스**에 연결. orch 가 placement 집행으로 실 존 lifecycle 을 구동(`zoneRuntimes` 레지스트리·`orch-zonebridge.js` 믹스인·EntityZone 팩토리는 `makeActor` 주입=직렬화 안전). 0272 레지스트리(_bridgeStart)→0273 migrate(같은 핸들·상태 보존·zoneStarts 불변)→0274 stop→0275 hostDown(새 인스턴스·**상태 소실·비자발**·migrate 와 의미 분리)→0276 zoneRuntimeDrift→0277 rebalance 실 핸들 균형→0278 drain 비움→0279 placeQuery runtimeHost 회신→0280 **fullyCoherent capstone**(placement==running==zoneRuntimes 3층). zoneBridge OFF→전 step 비트 동일(reg 0).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0·0210~)라 2차 허용·#51b 는 prior verdict 3라운드가 지정한 **load-bearing 게이트** → **과심화 아님**(승인된 심화). 재현 증거: `zonecapstone` 5/5 fullyCoherent·`reg` ALL OK·spine ALL OK. **단 두 한계**: ⒜ 브리지 정합(drift/coherent/fullyCoherent)은 **by-construction**(running·zoneRuntimes 항상 동시 갱신→분기 0·#53 의 #51b 판) ⒝ 브리지 존은 **비활성 핸들**(entity 트래픽·tick 0→migrate "상태 보존"은 구조적·잃을 상태 없음·#56 신규). **다음 권고: #9 멀티프로세스 배선**(브리지 핸들→실 host.js 소켓·현 인프로세스) + 브리지 존 데이터 평면(entity 트래픽·#56). 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
