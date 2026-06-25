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

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0270 현재 ⬜/🌱 박스 0 — 너비 1차 + 2·3차 균형 + #16 승급(0231~0240) + #51 배치 실배선(0241~0250) + orch 정리(0251) + 캐시 4차 고도화(0252~0260) + #49 wiring 정리 arc(0261~0270) 완료.**

> **기준선**: 닫힌 step **~0270**([../../STATE.md](../../STATE.md) NOW). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · **#49 wiring 정리 arc(0261~0270) ✅: 30KB 초과 박스 0**(`wc -c src/*.js|awk '$1>30000'`=0행·최대 svc-exchange-core 26.6KB). 분할 패턴 둘 — *단일 거대 함수* wiring(topo-run 35.9→13.1·topo-build 31.5→14.7)은 위임(`apply*(opts,i,ctx)`/`addServiceBoxes`·topo-inject/topo-failover/topo-boxes), *클래스* 박스(svc-exchange-core 30.7→26.6·svc-guild·svc-inventory-core·orchestrator·svc-mail-core·svc-mailbox·gateway)는 `Object.assign(prototype)` 믹스인. **전 step 기능 0·reg ALL OK(투명 분할).** **#16 확장**: 이번 10 bespoke 모드(injsplit~gwsplit)도 미승급·잔여 0033~0270 수백 모드 유지. 멀티프로세스 미배선(#9)·#51b 실 zone.js 브리지 미진전·도구 갭 #43(close-step src size 미체크·#49 재발 방비) 승격.

## 다음 큰 걸음 (직관) — 🎯 #49 wiring 정리 arc (0261~0270·기능 0·SKILL §3.6)

> **0261~0270 = 순수 구조 정리(기능 0)** — 0241~0250·0251~0260 verdict 가 세 라운드 연속 권고한 **#49 게이트를 집행**. 3대 >30KB 박스 해소 + 30KB 근접 7박스 선제 분할. 너비(⬜/🌱)는 0 유지·새 박스 0·전 step reg ALL OK(투명 분할).

**3대 >30KB 박스 해소 ✅:** topo-run(35.9KB) → per-tick 주입열을 `topo-inject.js`(0261·applyInjections)·복구 주입을 `topo-failover.js`(0262·applyFailover)로 위임(13.1KB) · topo-build(31.5KB) → 서비스 박스 add 시퀀스를 `topo-boxes.js`(0263·addServiceBoxes)로 위임(14.7KB) · svc-exchange-core(30.7KB) → 영속/failover 메서드를 `svc-exchange-persist.js`(0264) 믹스인(26.6KB). *단일 거대 함수* wiring 의 #49 근거(클래스 믹스인 미적용)를 **ctx 핸들 묶음 위임**으로 해소.

**선제 정리 7박스(30KB 근접) ✅:** svc-guild→`svc-guild-txn`(0265·onMsg)·svc-inventory-core→`svc-inventory-init`(0266·_init 필드초기화)·orchestrator→`orch-control`(0267·onMsg/onTick)·svc-mail-core→`svc-mail-saga`(0268·_custody/재전송/재admission)·svc-mailbox→`svc-mailbox-dedup`(0269·seen/epoch dedup)·gateway→`gateway-msg`(0270·라우팅 onMsg). 전부 `Object.assign(prototype)` 믹스인·verbatim·reg 0.

**⚠ 단계 평결(SKILL §3.6)**: 빈 박스도·심화도 아닌 **순수 구조 정리** → **과심화 아님**(기능 0). 세 라운드 보류됐던 #49 게이트 집행 — load-bearing 압력(#54 집중 편중) 완화. **다음 권고: #49 게이트 해제 → ⒜ #51b running↔실 EntityZone host 이주(zone.js 핸드오프·load-bearing) ⒝ #9 멀티프로세스 배선 우선.** 도구 갭 #43(close-step src size·#49 재발 방비) 동반. 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
