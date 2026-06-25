'use strict';
// step-0281 — #56 브리지 존 데이터 평면 1: _bridgeEnter(실 EntityZone 핸들로 enter 라우팅)·zoneEntityCount/zoneHasEntity 질의. 0272~0280 의 빈 핸들에 실 entity 가 흐르기 시작.
// step-0272 — #51b 실 zone.js 브리지. 0241~0250 의 배치 실배선은 running(zoneId→host 문자열)까지였다 — *집행 SSOT* 이되 실 EntityZone 런타임과는 끊겨 있었다.
//   이 믹스인은 그 간극을 잇는다: placement 집행(_start/_migrate/_stop)이 *실 EntityZone 인스턴스*를 host 에 띄우고/이주하고/내린다(zoneRuntimes 레지스트리).
//   오케스트레이터가 존 런타임을 spawn/배치하는 것은 그 정의 책임(SPINE §2 코디네이션: "존 배치·인스턴스 spawn") — 은닉 위반이 아니라 집행이다.
//   EntityZone 팩토리는 makeActor(topo-actors)가 zoneBridge ON 일 때 주입(직렬화 불가 함수이므로 spec 이 아닌 액터 구성 시점). OFF 면 이 메서드들이 호출되지 않아 0271 비트 동일(reg 0).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.orch_zonebridge).

// 실 zone.js 브리지 믹스인 — Orchestrator.prototype 에 Object.assign 으로 섞인다. 모든 메서드는 this=Orchestrator 인스턴스.
const OrchZoneBridge = {
  // 브리지 start(step-0272) — 배치 결정 집행 시 실 EntityZone 런타임을 host 에 띄운다(zoneRuntimes 등록). 이미 도는 존이면 host 만 정렬(멱등·신규 인스턴스화 아님). zoneBridge OFF·팩토리 부재면 호출 자체가 없다(_start 가드).
  _bridgeStart(zoneId, host) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (rt) { rt.host = host; return false; }   // 이미 가동 — host 만 정렬(멱등).
    const zone = this.zoneFactory(zoneId);      // 실 EntityZone 인스턴스화(결정론 시드=zoneId 해시·makeActor 주입 팩토리).
    this.zoneRuntimes.set(zoneId, { zone, host });
    this.zoneStarts++;
    return true;
  },
  // 브리지 migrate(step-0273) — 배치 재결정 집행 시 *같은 EntityZone 인스턴스*의 host 를 release(기존)+acquire(toHost) 쌍으로 원자 교체한다(존 런타임 핸들 이주 = 상태 보존·재생성 아님·zoneRuntimes 단일 키 = 한 존 정확히 한 host). 미가동·같은 host 는 멱등 no-op. zoneBridge OFF·팩토리 부재면 호출 자체가 없다(_migrate 가드).
  _bridgeMigrate(zoneId, toHost) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;             // 미가동 — 집행 대상 없음(멱등).
    if (rt.host === toHost) return false;
    rt.host = toHost;                  // 같은 EntityZone 핸들(상태·entity 보존)의 host 만 원자 교체 — 새 인스턴스 만들지 않음.
    this.zoneMigrations++;
    return true;
  },
  // 브리지 hostDown(step-0275) — host 장애 복구 집행 시 죽은 host 의 실 EntityZone 런타임을 생존 host 에 *새 인스턴스*로 재가동한다. migrate(자발·같은 핸들·상태 보존)와 결정적으로 다르다: 죽은 host 의 런타임은 이미 소실이므로 graceful 이주 불가 → 새 인스턴스(상태 보존 *불가*·잃은 상태 복구는 영속서 후속·범위 밖). zoneRuntimes 의 zone 핸들을 교체하고 host 를 target 으로. 없는 존 멱등.
  _bridgeHostDown(zoneId, target) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;
    rt.zone = this.zoneFactory(zoneId);   // 새 인스턴스 — 죽은 것 폐기(상태 소실·비자발적). migrate 와 달리 핸들 동일성 *깨짐*이 정상.
    rt.host = target;
    this.zoneRescued++;
    return true;
  },
  // 브리지 stop(step-0274) — 존 운영 퇴역 집행 시 실 EntityZone 런타임을 zoneRuntimes 에서 제거(핸들 폐기 = 인스턴스 GC 대상). 없는 존은 멱등 no-op(zoneStops 무증). instance.js _despawn 의 존 판. zoneBridge OFF·팩토리 부재면 호출 자체가 없다(_stop 가드).
  _bridgeStop(zoneId) {
    if (this.zoneRuntimes.delete(zoneId)) { this.zoneStops++; return true; }
    return false;
  },
  // 존 런타임 질의(step-0272) — "이 존의 실 EntityZone 핸들 / 그 host / 총 몇 개 실 런타임이 도나"(브리지 읽기·running 문자열 SSOT 와 대조해 실물 정합 검증).
  zoneRuntimeOf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.zone : null; },
  zoneRuntimeHostOf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.host : null; },
  runtimeCount() { return this.zoneRuntimes.size; },
  // 실 런타임 host 분포 질의(step-0275) — 그 host 에서 도는 실 EntityZone 런타임 수(장애/드레인 후 그 host 0 검증·running 문자열 runningOn 의 실물 짝).
  runtimeOn(host) { let n = 0; for (const rt of this.zoneRuntimes.values()) if (rt.host === host) n++; return n; },
  // 실 런타임 가동 host 집합 질의(step-0277) — 현재 실 EntityZone 을 하나라도 돌리는 host 집합(운영 대시보드·재배치 분산/드레인 비움 검증). running 문자열 runningHosts 의 실물 짝.
  zoneRuntimeHosts() { const s = new Set(); for (const rt of this.zoneRuntimes.values()) s.add(rt.host); return s; },
  // 브리지 표류 질의(step-0276) — running(zoneId→host *문자열* 추상 SSOT·0241)과 zoneRuntimes(실 EntityZone 핸들의 host)가 어긋난 존 수(host 불일치 또는 한쪽에만 존재). placeExecute+zoneBridge ON 이면 모든 배치 op(start/migrate/stop/hostdown/rebalance/drain) 뒤 0 — 추상 집행 SSOT 와 실 런타임 레지스트리가 한 몸으로 움직인다(브리지 정합). placementDrift(0245·결정↔집행)의 *실물* 판. 읽기 전용.
  zoneRuntimeDrift() {
    let d = 0;
    const ids = new Set([...this.running.keys(), ...this.zoneRuntimes.keys()]);
    for (const z of ids) { const rt = this.zoneRuntimes.get(z); if (this.running.get(z) !== (rt ? rt.host : undefined)) d++; }
    return d;
  },
  // 브리지 정합 불변 질의(step-0278·capstone primitive) — 브리지가 깨지지 않았는가의 단일 술어: ⒜ 표류 0(추상 host==실 host) ⒝ 실 런타임 수 == 추상 running 수(존 집합 일치). 둘 다 참이면 추상 집행 SSOT 와 실 EntityZone 레지스트리가 완전 일치(한 존=한 host·양쪽). 모든 배치 op 뒤 참이어야(0280 capstone 이 혼합 lifecycle 로 단언). 읽기 전용.
  bridgeCoherent() { return this.zoneRuntimeDrift() === 0 && this.runtimeCount() === this.running.size; },
  // 브리지 존 enter 라우팅(step-0281·#56) — 게이트웨이/운영이 보낸 enter 를 *실 EntityZone 핸들*로 흘린다. 0272~0280 의 zoneRuntimes 는 빈 핸들이었고(entity 0), 이 메서드가 실 zone.js onMsg('enter') 를 호출해 실제 avatar 가 그 존의 ents 에 산다 → migrate "상태 보존"이 *행동적으로* 검증 가능해진다(리뷰 #56). 미가동 존(런타임 없음)은 거부(멱등 false). zoneEntityFlow OFF 면 호출 자체 없음(onMsg 가드·0280 비트 동일).
  _bridgeEnter(zoneId, avatar, sessionId, gateway) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;             // 미가동 존 — 흘릴 핸들 없음(멱등).
    rt.zone.onMsg({ from: gateway || 'gateway', payload: { type: 'enter', sessionId: sessionId || ('s:' + avatar), avatar } });
    this.zoneEnters++;
    return true;
  },
  // 브리지 존 entity 질의(step-0281·#56) — "이 존의 실 EntityZone 핸들에 몇 entity 가 사나 / 이 avatar 가 있나"(실 zone.js ents 직접 읽기·migrate 무손실·hostdown 소실 등 데이터 평면 불변 검증의 기초). 미가동 존은 0/false.
  zoneEntityCount(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.zone.ents.size : 0; },
  zoneHasEntity(zoneId, avatar) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.zone.ents.has(avatar) : false; },
  // 전 계층 정합 질의(step-0280·#51b capstone) — 배치 결정(placement)·추상 집행(running)·실 EntityZone 런타임(zoneRuntimes) **세 층이 완전 일치**하는 단일 술어: ⒜ placementDrift 0(결정==집행·0245) ⒝ bridgeCoherent(집행==실물·0278) ⒞ placedCount==runtimeCount(결정 수==실 런타임 수). 참이면 "어디서 돌아야 하나(결정)==어디서 돈다고 기록(집행)==실제 어느 핸들이 어느 host(실물)" 가 한 몸 — #51b 가 추상 SSOT 와 실 zone.js 런타임을 완전히 이은 증거. 읽기 전용.
  fullyCoherent() { return this.placementDrift() === 0 && this.bridgeCoherent() && this.placedCount() === this.runtimeCount(); },
};

const __part = { OrchZoneBridge };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_zonebridge = __part;
