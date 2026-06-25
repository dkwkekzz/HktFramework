# ⑤ 코디네이션 — "누가 어디에" 의 단일 진실

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: "플레이어 X 는 어느 게이트웨이·어느 존" 과 "어떤 존을 어느 서버가 맡나"를 한 곳이 안다. 어떤 단일 서버도 *영구 중심*이 아니다 — 죽으면 다른 데가 맡고, split-brain(둘이 동시에 주인) 0. 그리고 *소비자가 죽으면 스스로 되살린다*.

---

## 세션/프레즌스 서버 🟡 자라는 중 *(전용 박스 → 쓰기·발행·읽기 전 경로 failover-safe)*

**무슨 서버인가**: "누가 지금 어디에 있나"(소비자·세션의 위치/건강)를 한 곳에서 아는 SSOT 서버(`src/svc-presence.js`·관측 `svc-presence-monitor.js`). *비유 — 안내 데스크*: 모두가 "X 어디 있어?"를 여기 한 곳에 묻고, 직원이 쓰러지면 옆 직원이 같은 장부로 이어받되 쓰러진 직원의 옛 방송은 무시한다.

**필요한 기능들** (기능마다 다른 이론에 기댄다):

1. **위치 레지스트리(조회 한 곳)** ✅ — 왜: 귓속말·파티·핸드오프가 "X 어디"를 떠돌이로 찾으면 안 됨. / 어떻게: 단일 진실 원천(SSOT) 등록. / 했나: `step-0001` 레지스트리 씨앗.
2. **건강 프레즌스(누가 down/up)** ✅ — 왜: 위치를 능동적으로 알아야 치유 가능. / 어떻게: 소비자 건강을 버스로 알고 svc.presence 발행 + presmon 상태 기계. / 했나: `step-0055~0063`(아직 orch 곁붙이).
3. **전용 박스로 독립(디커플)** ✅ — 왜: orch 에 얹히면 이중 SSOT·강결합. / 어떻게: SSOT+발행을 PresenceService 로 떼고 보고 버스화(orch 가 주소 모름). / 했나: `step-0064~0065`.
4. **failover(SSOT 가 죽어도)** ✅ — 왜: 한 곳이 죽으면 끊김. / 어떻게: shadow 복제(같은 보고로 그림자)→승격 인계→하트비트 침묵으로 자가 사망 감지. / 했나: `step-0066~0068`(외부 트리거 0).
5. **읽기(pull) 질의 + 연속성** ✅ — 왜: 구독 못 한 쪽도 상태를 물으면 답해야. / 어떻게: pull 질의 + 승격 시 새 주소 공지→질의자 재타깃. / 했나: `step-0069~0070`.
6. **질의 인터페이스 실사용** ✅ — 왜: 인터페이스는 써야 산다. / 어떻게: 귓속말/파티 라우터(계층3)가 이 SSOT 를 조회처로. / 했나: `step-0071~0074`(읽기 failover 가 소비자 쪽까지 연속).
7. **디스커버리 메아리 펜싱** ✅ — 왜: 지연 공지가 죽은 박스로 역-재타깃하면 위험. / 어떻게: 승격 공지에 epoch(단조)→본 최고 이하 거부. / 했나: `step-0105~0106`(`svc-presence.js:70`·읽기-디스커버리 split-brain 0).
8. **진짜 플레이어 프레즌스** ⬜ — 왜: 지금은 *서비스 소비자* 건강만 앎. / 어떻게: "플레이어 X 가 어느 게이트웨이/존" SSOT. / 했나: 미착수.

**지금 어디 / 다음**: 등록 씨앗 → 전용 박스 → 쓰기·발행·읽기 전 경로 failover-safe SSOT 까지. 다음 = 진짜 플레이어 프레즌스. (펜싱 epoch 단일 클럭 가정 #29·펜싱 로직 중복 #28 잔여.)

## 오케스트레이터 서버 🟡 자라는 중 *(failover + self-healing 제어 루프)*

**무슨 서버인가**: 존 배치·죽은 노드 인계·죽은 소비자 되살리기를 *동적으로* 결정하는 서버(`src/orchestrator.js`). *비유 — 당직 관리자*: 주인이 항상 정확히 한 명이게 정하고, 누가 쓰러지면 대타 투입→확인→재시도→끝내 포기까지 자동.

**필요한 기능들**:

1. **zone failover + 펜싱(split-brain 0)** ✅ — 왜: 정적 배치 한계·주인 둘이면 split-brain. / 어떻게: lease·진짜 kill 감지·epoch 펜싱·재-provisioning. / 했나: `step-0009~0013`(broker lockstep 배리어=검증용 결정론 받침).
2. **소비자 self-healing 제어 루프** ✅ — 왜: 죽은 소비자가 사람 개입 없이 되살아나야. / 어떻게: 제어 루프(감지→recover→확인→재시도→상한 포기→발행). / 했나: `step-0056~0060`.
3. **역할 분리(순수 오케스트레이터)** 🟡 — 왜: 한 박스가 SSOT·치유·결정을 다 쥐면 비대. / 어떻게: 프레즌스 SSOT 떼냄(치유 HealService 는 아직 겸함). / 했나: `step-0064` 프레즌스 분리(치유 분리 ⬜).
4. **진짜 비동기(lockstep 배리어 해제)** ⬜ *가장 큰 빚* — 왜: 결정론이 아직 중앙 lockstep 에 의존. / 어떻게: 논리/벡터 클럭·인과 순서로 배리어 없이 결정론. / 했나: 미착수(STATE §3 🔴).
5. **존 배치 SSOT + 질의** ✅ 기본 — 왜: 정적 배치(2존 고정)는 한계·"누가 어디서 도나"를 한 곳이 알아야 라우팅·재배치가 선다. / 어떻게: 배치 맵 SSOT(zoneId→host·재배치 덮어씀) + 원격 request/reply 질의. / 했나: `step-0203` placeZone(배치 결정 권위) + `step-0204` placeQuery→placeReply(게이트웨이가 존 위치 조회·순수 읽기). 정적 배치 한계 제거 씨앗.
6. **부하 분산 배치 + 재배치 핸드오프 + 자동 트리거/드레인** ✅ — 왜: 배치를 부하로 결정·존을 host 사이로 이주·불균형/퇴역을 사람 손 없이 자동 해소. / 어떻게: ⒜ 후보 host 중 최소 부하 선택·동률 결정론 tie-break ⒝ 재배치는 release(기존)+acquire(신규) 쌍(권위 단일 소유 보존·공백/중복 0) ⒞ 불균형(최대−최소≥2) 자동 감지→최대→최소로 균형까지 수렴 ⒟ host 퇴역 시 그 host 의 모든 존을 나머지 최소부하로 연쇄 이주. / 했나: `step-0217` placeAuto + `step-0218` placeMigrate + `step-0223` placeRebalance + `step-0224` placeDrain. 미주입이면 휴면(reg 0).
7. **배치 결정→실 존 런타임 집행(executed SSOT)** ✅ — 왜: 6 의 배치 정책(place/migrate/rebalance/drain)이 `orchestrator.js:placement` *advisory paper map* 만 갱신하고 실 존은 안 움직였다(#51·"누가 어디서 *돈다*"가 아니라 "*돌아야 한다*"만). / 어떻게: 결정(placement)과 별개로 *실제 가동 중* 존 런타임을 추적하는 executed SSOT(`running`·zoneId→실 가동 host)를 두고, 모든 배치 op 가 paper 갱신마다 실 런타임 lifecycle(start/migrate/stop/re-acquire)을 구동(`placeExecute` 플래그·instance.js active/route 수명주기 동형). 결정==집행 표류 0(`placementDrift`). / 했나: `step-0241` running SSOT(start)→`0242` executed migrate(release+acquire)→`0243` rebalance→`0244` drain→`0245` reconcile capstone(drift 0)→`0246` stop→`0247` auto→`0248` host 장애 복구(placeHostDown·비자발 re-acquire)→`0249` 전 lifecycle capstone→`0250` placeQuery 가 실 가동 host 회신.
8. **추상 running→실 EntityZone(zone.js) 브리지** ✅ — 왜: 7 의 `running` 은 아직 zoneId→host *문자열* 추상 레지스트리였다(#51b·집행 SSOT 이되 실 `EntityZone`(`zone.js`) 인스턴스와 끊김). / 어떻게: 배치 집행이 *실 EntityZone 인스턴스*를 host 에 띄우고/이주하고/내리는 런타임 레지스트리(`zoneRuntimes`·`orch-zonebridge.js` 믹스인). 팩토리는 `makeActor`(`topo-actors.js:65`)가 zoneBridge ON 일 때 주입(직렬화 불가 함수→spec 아닌 액터 구성 시점·멀티프로세스-safe). 추상↔실물 정합 질의로 표류 0 단언. 기능마다 다른 이론: start=인스턴스화·migrate=같은 핸들 host 원자 교체(**상태 보존**)·hostdown=새 인스턴스(**상태 소실·비자발**·migrate 와 의미 분리)·drift/coherent=구조 불변. / 했나: `step-0272` 레지스트리(_bridgeStart·`orch-zonebridge.js:11`)→`0273` migrate(같은 핸들·zoneStarts 불변)→`0274` stop→`0275` hostDown 재가동(새 인스턴스)→`0276` zoneRuntimeDrift→`0277` rebalance 실 핸들 균형→`0278` drain 비움+bridgeCoherent→`0279` placeQuery runtimeHost 회신→`0280` fullyCoherent capstone(placement==running==zoneRuntimes 3층). zoneBridge OFF→전 step 비트 동일(reg 0). **잔여: 브리지 존은 *비활성 핸들*(entity 트래픽·tick 없음)·orch 인프로세스 레지스트리(실 프로세스 분리 #9 미배선)** — lifecycle/SSOT 층은 닫혔으나 *데이터 평면*(게이트웨이→실 존 enter/move·이주 시 entity 무손실)은 다음.
9. **적응형 recoverTimeout** ⬜ — 왜: 고정 timeout 은 부하 변동에 둔감. / 어떻게: 부하/지연 신호 기반 적응. / 했나: 미착수(2차 잔여).

**지금 어디 / 다음**: zone failover + self-healing 루프 + 존 배치 SSOT/질의 + 부하 배치·재배치·드레인(0217~0224) + 배치 결정→실 존 런타임 executed SSOT(0241~0250) + **추상 running→실 EntityZone(zone.js) 브리지(0272~0280·orch 가 placement 집행으로 실 EntityZone lifecycle 구동·zoneRuntimes·`orch-zonebridge.js`·migrate 상태보존↔hostdown 소실 의미 분리·fullyCoherent 3층 정합)**까지 — 배치 정책이 이제 *실 존 인스턴스*를 띄운다(#51b ✅·코디네이션 SSOT↔실물 닫힘). **정리: `0251` orch-placement·`0267` orch-control 믹스인 분할(<30KB·#52 ✅)**. 다음(load-bearing) = **#9 멀티프로세스 배선**(브리지 핸들→실 host.js 소켓·현재 인프로세스 레지스트리) + 브리지 존의 *데이터 평면*(entity 트래픽·tick) + *진짜 비동기*(가장 큰 빚) + 치유 HealService 분리.

---

> **📦 구조 분할(#49 arc·0267·기능 0)**: 오케스트레이터 제어 평면 핸들러(`onMsg`·`onTick`)를 `orch-control.js` 믹스인으로 분리(0251 `orch-placement.js`[배치 런타임]의 짝·`Object.assign(prototype)`·verbatim·reg 0·27.5→18.9KB). 이제 오케 3분할: 코어 18.9 + placement 9.1 + control 9.6KB. 능력 무변경.

> **이 계층 다음 걸음**: ⒜ *진짜 비동기*(lockstep 배리어 제거·논리/벡터 클럭). ⒝ 플레이어 프레즌스 실사용. ⒞ 치유(HealService) 분리.
