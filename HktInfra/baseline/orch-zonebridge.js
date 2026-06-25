'use strict';
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
  // 존 런타임 질의(step-0272) — "이 존의 실 EntityZone 핸들 / 그 host / 총 몇 개 실 런타임이 도나"(브리지 읽기·running 문자열 SSOT 와 대조해 실물 정합 검증).
  zoneRuntimeOf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.zone : null; },
  zoneRuntimeHostOf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.host : null; },
  runtimeCount() { return this.zoneRuntimes.size; },
};

const __part = { OrchZoneBridge };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_zonebridge = __part;
