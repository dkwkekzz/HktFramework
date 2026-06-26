'use strict';
// step-0308 — #9 잔여(실 host.js 물리 분리): host 컨테이너 정합 불변(hostContainerCoherent) — 단일 소유 + 표류 0 + roster 회계 닫힘(register−deregister==현 host)을 한 술어로. bridgeCoherent(0278)의 host 프로세스 컨테이너 판. 읽기 전용·0307 비트 동일.
// step-0307 — #9 잔여(실 host.js 물리 분리): host 프로세스 entity census(zoneHostCensus). 전 host 컨테이너의 {존 수, entity 수} 분포 — entityCensus(0289·존별)의 host 프로세스별 판(부하·재배치 판단의 실 단위). 읽기 전용·0306 비트 동일.
// step-0305 정리 분할 — orch-zonebridge.js 가 29.4KB>30KB 트리거에 근접해, *host 프로세스 컨테이너 층*(0301~0304·#9 잔여 "실 host.js 물리 분리")을 이 파일로 분리한다.
//   옮긴 것: host 컨테이너 레지스트리(_hostSet)·질의(hostRuntimeCount·zoneHostOf·zoneHostHosts·hostRegistered)·불변(zoneHostSingleOwner·zoneHostDrift).
//   남긴 것: 실 zone.js 브리지 lifecycle(_bridgeStart/migrate/hostdown/stop)·전송 seam(_zoneDeliver)·런타임 tick(_tickRuntimes)·#56 데이터 평면 질의 → orch-zonebridge.js.
//   Object.assign 으로 같은 prototype 에 되섞으므로 this 바인딩·메서드 해소 동일 = 동작 비트 불변(reg 0·플래그 없는 투명 분할·orch-placement 0251·orch-control 0267 동형).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.orch_hostproc).

// host 프로세스 컨테이너 믹스인 — Orchestrator.prototype 에 Object.assign. 모든 메서드는 this=Orchestrator 인스턴스.
//   flat zoneRuntimes(zoneId→{zone,host}) 위에 host 를 *1급 컨테이너*(zoneHosts: host→{zones,inbox})로 묶어 실 host.js 프로세스(여러 존 소유·자기 소켓 수신·자기 루프 tick·spawn/despawn)의 씨앗으로 삼는다.
const OrchHostProc = {
  // host 컨테이너 귀속 갱신(step-0301·#9 잔여) — zoneId 를 *정확히 한* host 컨테이너에 귀속시킨다(host==null 이면 어느 컨테이너에서도 떼기만). 어디 있든 먼저 떼고(멱등) 새 host 에 붙인다 → start/migrate/hostdown/stop 어느 집행에서 불러도 같은 결과(낡은 host 추적 불필요). 컨테이너 첫 생성=hostRegisters++(spawn 씨앗)·빈 컨테이너 제거=hostDeregisters++(despawn 씨앗·step-0304). zoneHostProc OFF 면 no-op = 0300 비트 동일.
  _hostSet(zoneId, host) {
    if (!this.zoneHostProc) return;
    for (const [h, c] of this.zoneHosts) { if (c.zones.delete(zoneId) && c.zones.size === 0) { this.zoneHosts.delete(h); this.hostDeregisters++; } }   // step-0304 — 마지막 존 잃은 host 컨테이너 제거 = 프로세스 despawn 씨앗.
    if (host == null) return;             // 퇴역/소실 — 떼기만(어느 host 도 소유 안 함).
    let c = this.zoneHosts.get(host);
    if (!c) { c = { zones: new Set() }; this.zoneHosts.set(host, c); this.hostRegisters++; }   // step-0304 — 첫 존 받아 새 host 컨테이너 생성 = 프로세스 spawn 씨앗.
    c.zones.add(zoneId);
  },
  // host 컨테이너 질의(step-0301·#9 잔여) — "이 host 프로세스가 몇 존을 소유하나 / 이 존은 어느 host 프로세스에 사나 / 지금 존을 하나라도 돌리는 host 집합". flat zoneRuntimes 의 host 별 묶음이 실 host.js 분리의 씨앗(host=프로세스 단위). 읽기 전용.
  hostRuntimeCount(host) { const c = this.zoneHosts.get(host); return c ? c.zones.size : 0; },
  zoneHostOf(zoneId) { for (const [h, c] of this.zoneHosts) if (c.zones.has(zoneId)) return h; return null; },
  zoneHostHosts() { return new Set(this.zoneHosts.keys()); },
  // host roster 질의(step-0304·#9 잔여) — "이 host 가 지금 존을 하나라도 돌리나"(컨테이너 존재 = 프로세스 가동). 첫 존에 register(spawn)·마지막 존에 deregister(despawn)된 roster 의 단건 조회. 읽기 전용.
  hostRegistered(host) { return this.zoneHosts.has(host); },
  // host 컨테이너 단일 소유 불변(step-0303·#9 잔여) — 어떤 존도 두 host 컨테이너에 동시에 귀속하지 않는다(존의 host 단일 소유의 *컨테이너* 판·zone-host 핸들 0276 과 동형). _hostSet 이 어디 있든 먼저 떼고 한 곳에만 붙이므로 정상 op 에선 항상 참 — 모든 배치 op 뒤 단언(capstone). 읽기 전용.
  zoneHostSingleOwner() {
    const seen = new Set();
    for (const c of this.zoneHosts.values()) for (const z of c.zones) { if (seen.has(z)) return false; seen.add(z); }
    return true;
  },
  // host 컨테이너 표류 질의(step-0303·#9 잔여) — host 컨테이너(host→{zones})와 집행 SSOT(running·zoneId→host)가 어긋난 존 수: ⒜ running 존이 자기 host 컨테이너에 없거나 다른 host 에 ⒝ 컨테이너엔 있는데 running 에 없는(orphan) 존. zoneRuntimeDrift(0276·실 핸들 host)의 *컨테이너* 판 — placeExecute+zoneHostProc ON 이면 모든 배치 op 뒤 0(host 컨테이너가 집행 SSOT 와 한 몸). 읽기 전용.
  zoneHostDrift() {
    let d = 0;
    const ids = new Set([...this.running.keys()]);
    for (const c of this.zoneHosts.values()) for (const z of c.zones) ids.add(z);
    for (const z of ids) { if (this.zoneHostOf(z) !== (this.running.get(z) || null)) d++; }
    return d;
  },
  // host 프로세스 entity census(step-0307·#9 잔여) — 전 host 컨테이너의 {존 수, entity 수} 분포 {total, hosts:{host:{zones,entities}}}. entityCensus(0289·존별)의 *host 프로세스별* 판 — 운영 대시보드로 "어느 host 프로세스가 몇 존·몇 entity 를 지나" 를 본다(부하·재배치 판단의 실 단위). entity 수 = 그 host 소유 존들의 zoneRuntimes ents 합. graceful op(migrate/rebalance/drain·같은 핸들)는 total 불변·host 간 분포만 재편. 읽기 전용.
  zoneHostCensus() {
    const hosts = {}; let total = 0;
    for (const [h, c] of this.zoneHosts) {
      let ents = 0;
      for (const z of c.zones) { const rt = this.zoneRuntimes.get(z); if (rt) ents += rt.zone.ents.size; }
      hosts[h] = { zones: c.zones.size, entities: ents }; total += ents;
    }
    return { total, hosts };
  },
  // host 컨테이너 정합 불변 질의(step-0308·#9 잔여·primitive) — host 프로세스 층이 깨지지 않았는가의 단일 술어: ⒜ zoneHostSingleOwner(어떤 존도 두 host 없음·0303) ⒝ zoneHostDrift 0(컨테이너==집행 SSOT running·0303) ⒞ roster 회계 닫힘(hostRegisters−hostDeregisters == 현 host 컨테이너 수·0304 spawn/despawn 이 정확히 상쇄). 참이면 "존이 정확히 한 host 프로세스에·컨테이너가 집행과 한 몸·spawn/despawn 회계가 현 host 수와 일치". bridgeCoherent(0278·실 핸들)의 *host 프로세스 컨테이너* 판. 모든 배치 op 뒤 참(capstone 0310). 읽기 전용.
  hostContainerCoherent() {
    return this.zoneHostSingleOwner() && this.zoneHostDrift() === 0 &&
      (this.hostRegisters - this.hostDeregisters) === this.zoneHosts.size;
  },
};

const __part = { OrchHostProc };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_hostproc = __part;
