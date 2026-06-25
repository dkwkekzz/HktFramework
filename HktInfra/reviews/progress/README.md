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
| ⑤ 코디네이션 | [5-coordination.md](5-coordination.md) | **세션/프레즌스** 🟡 failover-safe SSOT(플레이어 프레즌스 후속) · **오케스트레이터** 🟡 zone failover+self-healing + 배치 SSOT/질의·부하 배치·핸드오프 + executed SSOT(0241~0250) + 실 EntityZone 브리지(0272~0280) + **브리지 존 데이터 평면(0281~0290·#56·entity enter/move/leave·런타임 tick·migrate무손실↔hostdown소실·단일소유·정합·보존 회계 capstone)** |
| ⑥ 데이터 | [6-data.md](6-data.md) | **캐시** 🟡 set/get+read-through·TTL·무효화 + **용량 LRU·touch(0225~0226)** · **월드 영속** 🟡 intent 로그·replay·스냅샷·crash/recover + **write-behind·fsync(0227~0228)** · **DB·write-behind** 🟡 저널·복제·quorum·정합 윈도 |

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0290 현재 ⬜/🌱 박스 0 — 너비 1차 + 2·3차 균형 + #16 승급(0231~0240) + #51 배치 실배선(0241~0250) + orch 정리(0251) + 캐시 4차 고도화(0252~0260) + #49 wiring 정리 arc(0261~0270) + 도구 #43(0271) + #51b 실 zone.js 브리지(0272~0280) + #56 브리지 존 데이터 평면(0281~0290) 완료.**

> **기준선**: 닫힌 step **~0290**([../../STATE.md](../../STATE.md) NOW). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · 30KB 초과 박스 0(`wc -c src/*.js|awk '$1>30000'`=0행·최대 svc-exchange-core 26KB) · orch 가 `zone.js` 직접 import 0 hit(④ 은닉·EntityZone 은 `makeActor:67` 팩토리 주입) · **#56 브리지 존 데이터 평면 ✅**(0281~0290·`zoneflowcap` 5/5 entityFlowCoherent·entityConserved·total 1==5−1−2−1·ledger 5/1/2/1). **#16 확장**: 이번 묶음 bespoke 모드(zoneenter~zonegraceful)도 미승급(현 spine 모드=zoneflowcap 만·0281~0289 모드는 git per-commit). **잔여 load-bearing: #9 멀티프로세스 배선**(브리지=orch 인프로세스 핸들·실 host.js 소켓 0·게이트웨이→실 존 직접 라우팅 0·현 orch 경유).

## 다음 큰 걸음 (직관) — 🎯 #56 브리지 존 데이터 평면 arc (0281~0290·SKILL §3.6)

> **0281~0290 = #56 브리지 존 데이터 평면**(load-bearing) — 0271~0280 평결이 지목한 게이트("게이트웨이→실 존 enter/move 라우팅 + 이주 시 entity 무손실 실증")를 집행. 너비(⬜/🌱) 0 유지·새 박스 0(오케스트레이터 *심화*).

**#56 데이터 평면 ✅(0281~0290):** 0272~0280 의 `zoneRuntimes` 는 *비활성 핸들*(entity 0·`onTick` 미호출)이라 0273 migrate "상태 보존"이 구조적이되 행동적이지 않았다. 이 arc 가 실 entity 를 그 핸들에 흘린다: 0281 enter(`_bridgeEnter`)→0282 move+런타임 tick(`_tickRuntimes`·net 싱크)→0283 leave→0284 migrate 무손실(행동적·같은 핸들→entity 수·위치 보존·0273 구조적 보존의 데이터 평면 판)→0285 hostdown 소실(`zoneEntitiesLost`·새 인스턴스·정직한 한계)→0286 stop 폐기(`zoneEntitiesDiscarded`·계획적)→0287 단일 소유(`entitiesSingleOwner`)→0288 정합(`entityCoherent`·orphan 0)→0289 graceful census 보존(rebalance/drain=같은 핸들→total 불변)→0290 **capstone**(`entityFlowCoherent`=fullyCoherent 3층+entityCoherent·`entityConserved` total=enters−leaves−lost−discarded). `zoneEntityFlow` OFF→0280 비트 동일(reg 0).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0·0210~)라 2차 허용·#56 은 0271~0280 verdict 가 지정한 **load-bearing 게이트** → **과심화 아님**(승인된 심화). 재현 증거: `zoneflowcap` 5/5 entityFlowCoherent·entityConserved·`reg` ALL OK·spine ALL OK·orch→zone.js 직접 import 0. **단 두 한계**: ⒜ 데이터 평면 정합(entityCoherent/entityFlowCoherent/entityConserved)도 **by-construction**(정상 op 에서 graceful=같은 핸들·destructive=동시 정리→분기 0·#53 의 #56 판) ⒝ entity 트래픽이 **게이트웨이→orch→런타임** 경유(orch 가 런타임 핸들 보유)이지 게이트웨이→실 존 *직접*이 아니다(#9 무대). **다음 권고: #9 멀티프로세스 배선**(브리지 핸들→실 host.js 소켓·게이트웨이→실 존 직접 라우팅·현 orch 경유). 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
