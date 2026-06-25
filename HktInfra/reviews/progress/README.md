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
| ② 월드 | [2-world.md](2-world.md) | **존** 🟡 *가장 성숙* — 결정론 복제·AOI·분할·핸드오프·failover(동적 N 존 후속) · **인스턴스** 🟡 spawn/despawn + 수요 spawn·라우팅(0215~0216) + **이탈·수요 자동 despawn(0221~0222)** |
| ③ 게임 서비스 | [3-services.md](3-services.md) | **가방·채팅·랭킹·wrouter+수신함·파티·거래소·시세피드·우편·우편배지·길드** 🟡 — 거래소↔가방 saga + 우편 동형(0142~0180) + 길드(0181~0190) + 공유 금고 0191~0200(🚦과심화) |
| ④ 버스 | [4-bus.md](4-bus.md) | **이벤트 버스** 🟡 *깊게 자람* — pub/sub·failover·무손실·유계화·소비자 lease·관측(물리 분산 후속) |
| ⑤ 코디네이션 | [5-coordination.md](5-coordination.md) | **세션/프레즌스** 🟡 failover-safe SSOT(플레이어 프레즌스 후속) · **오케스트레이터** 🟡 zone failover+self-healing + 배치 SSOT/질의·부하 배치·핸드오프 + executed SSOT(0241~0250) + 실 EntityZone 브리지(0272~0280) + 브리지 존 데이터 평면(0281~0290·#56) + **#9 멀티프로세스 배선(0291~0300·전송 seam·host mailbox·게이트웨이 직접 라우팅 인계·directFlowCoherent capstone — 실 host.js 물리 분리만 잔여)** |
| ⑥ 데이터 | [6-data.md](6-data.md) | **캐시** 🟡 set/get+read-through·TTL·무효화 + **용량 LRU·touch(0225~0226)** · **월드 영속** 🟡 intent 로그·replay·스냅샷·crash/recover + **write-behind·fsync(0227~0228)** · **DB·write-behind** 🟡 저널·복제·quorum·정합 윈도 |

상태 기호(STATE §5 정합): 🟡 자라는 중(씨앗+능력 누적·아직 부분) · 🌱 씨앗만(계약만 섰음) · ⬜ 미착수(아직 박스 없음). **★ 0300 현재 ⬜/🌱 박스 0 — 너비 1차 + 2·3차 균형 + #16 승급(0231~0240) + #51 배치 실배선(0241~0250) + orch 정리(0251) + 캐시 4차 고도화(0252~0260) + #49 wiring 정리 arc(0261~0270) + 도구 #43(0271) + #51b 실 zone.js 브리지(0272~0280) + #56 브리지 존 데이터 평면(0281~0290) + #9 멀티프로세스 배선(0291~0300) 완료.**

> **기준선**: 닫힌 step **~0300**([../../STATE.md](../../STATE.md) NOW). 재현 검증(이 지도가 *주장*이 아니라 *사실*임의 근거): src/ 실 `Math.random` 0 hit(결정론) · UE 모듈 링크 0 hit(headless) · `node run.js spine` = **ALL OK** · 30KB 초과 박스 0(`wc -c src/*.js`·최대 orchestrator 27.0KB) · orch 가 `zone.js` 직접 import 0 hit(④ 은닉·EntityZone 은 `makeActor` 팩토리 주입·orch 는 `orch-zonebridge.js` 믹스인만 require) · **#9 멀티프로세스 배선 ✅**(0291~0300·`gwdircap` 5/5 directFlowCoherent·entityConserved·total 1·ledger 5/1/2/1·dir==running bijection·routes7==applied7·stale/miss 0). **#16 확장**: 이번 묶음 bespoke 모드(zonehandle~gwdirbij)도 미승급(현 spine 모드=`gwdircap` 만·0291~0299 모드는 git per-commit). **잔여 load-bearing: 실 host.js 물리 프로세스/소켓 분리**(zone-host 핸들이 orch 인프로세스 `zoneRuntimes` Map·게이트웨이가 host 태깅 후 orch 적용·cluster-run.js 실 spawn 통합 미연결).

## 다음 큰 걸음 (직관) — 🎯 #9 멀티프로세스 배선 arc (0291~0300·SKILL §3.6)

> **0291~0300 = #9 멀티프로세스 배선**(load-bearing·최상위) — 0271~0290 평결이 연속 지목한 게이트("게이트웨이→실 존 직접 라우팅·브리지 핸들→실 host.js 소켓")를 집행. 너비(⬜/🌱) 0 유지·새 박스 0(게이트웨이·오케스트레이터 *심화*).

**#9 ✅(0291~0300):** 0290 까지 entity 데이터 평면은 게이트웨이→**orch**→런타임 경유였다 — orch 가 라우팅 *결정*을 쥐어 데이터 평면이 코디네이션 박스를 거쳤고(SPINE §4 는 게이트웨이가 직접 중계), 런타임 적용도 in-memory method 호출이었다(직렬화 경계·소켓 없음). 이 arc 가 그걸 *직렬화 전송 seam + 서비스 디스커버리 + 게이트웨이 직접 라우팅*으로 가른다: 0291 전송 seam(`_zoneDeliver`·frame JSON round-trip·소켓 와이어 씨앗)→0292 host mailbox(수신 버퍼 큐·`_tickRuntimes` onTick 전 drain)→0293 게이트웨이 디렉토리(orch `zoneLoc` push→`zoneDir` 캐시·서비스 디스커버리)→0294 직접 enter(게이트웨이 `zoneDir` 해소→`zoneDeliver` host 태깅→orch host 검증·적용)→0295 직접 move/leave→0296 이주 정합+stale 거부→0297 장애 dir 무효화(`hostDown` broadcast)+복구→0298 단일소유+정합(`entityDirectCoherent`)→0299 다중 churn dir bijection(`zoneDirSnapshot`)→0300 **capstone**(`directFlowCoherent`=entityFlowCoherent && entityDirectCoherent·destructive+graceful 혼합 lifecycle 을 게이트웨이 직접 라우팅만으로). 각 플래그 OFF→직전 step 비트 동일(reg 0).

**⚠ 단계 평결(SKILL §3.6)**: 너비 1차 완료(⬜/🌱 0·0210~)라 2차 허용·#9 은 0271~0290 verdict 가 *연속 지목*한 **최상위 load-bearing 게이트** → **과심화 아님**(승인된 심화). 재현 증거: `gwdircap` 5/5 directFlowCoherent·entityConserved·dir==running bijection·routes7==applied7·stale/miss 0·`reg` ALL OK·spine ALL OK·`Math.random`/UObject src 0·orch→zone.js 직접 import 0. **단 두 한계**: ⒜ 정합 술어(directFlowCoherent·dir bijection)는 여전히 **by-construction**(게이트웨이·orch 가 같은 인프로세스·이주마다 `_pubZoneLoc` 동시 push→stale 창은 1-tick 지연뿐·zoneStaleProbe 만 합성 stale·#53 의 #9 판) ⒝ zone-host 핸들이 **orch 인프로세스 `zoneRuntimes` Map** 에 산다 — 게이트웨이가 host 태깅 후 orch 가 적용(실 host.js *물리* 프로세스/소켓 분리 아님·#9 잔여=다음 arc). **다음 권고: 실 host.js 물리 프로세스 분리(cluster-run.js 실 spawn 통합) + 진짜 비동기(#4·논리 클럭).** 권위는 [../../STATE.md](../../STATE.md) §2 NEXT·승급 게이트는 [../README.md](../README.md) §2.
