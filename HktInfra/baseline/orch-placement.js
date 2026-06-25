'use strict';
// step-0251 — 정리(#49 인접): 오케스트레이터 배치 SSOT 런타임을 orchestrator.js 에서 분리(박스 1개=파일 1개 유계화).
//   orchestrator.js 는 #51 arc(0241~0250)로 배치 결정(placement)·실 가동(running) lifecycle 이 누적되며 34KB(>30KB 트리거)로 커졌다.
//   이 step 은 그중 *배치 런타임 메서드*(_start/_migrate/_hostDown/_stop/_rebalance/_drain·load helper·executed/placement 질의)를 이 파일의
//   믹스인 객체(OrchPlacement)로 옮기고, orchestrator.js 가 Object.assign(Orchestrator.prototype, OrchPlacement) 으로 되섞는다.
//   → 메서드 정의 위치만 옮길 뿐 prototype·this 바인딩 동일 = 동작 비트 불변(reg 0·플래그 없는 투명 분할). 프레즌스/failover 제어 평면(onMsg·onTick·_track·_presence·monitor)은 orchestrator.js 잔류.
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 로 선행 로드(전역 __HktNetParts.orch_placement).

// 배치 SSOT 런타임 믹스인 — Orchestrator.prototype 에 Object.assign 으로 섞인다. 모든 메서드는 this=Orchestrator 인스턴스.
const OrchPlacement = {
  // 존 런타임 start(step-0241·#51) — 배치 결정을 *집행*: 실 존 런타임을 host 에 띄운다(running 등록). 이미 도는 존이면 멱등(같은/다른 host 재배치는 0242 migrate 가 담당·여기선 신규 가동만 카운트). placeExecute ON 일 때만 placeZone 이 호출. instance.js _spawn 의 존-배치 판.
  _start(zoneId, host) {
    if (this.zoneBridge && this.zoneFactory) this._bridgeStart(zoneId, host);   // step-0272 (#51b) — 실 EntityZone 런타임도 함께 띄움(OFF/팩토리부재면 가드 통과·0271 비트 동일).
    if (this.running.has(zoneId)) { this.running.set(zoneId, host); return false; }   // 이미 가동 — host 만 정렬(멱등·신규 start 아님).
    this.running.set(zoneId, host); this.starts++; return true;
  },
  // 존 런타임 migrate(step-0242·#51) — 배치 재결정을 *집행*: 도는 존 런타임을 toHost 로 release(기존)+acquire(toHost) 쌍 이주(running 단일 키 원자 교체 = 중간 공백/중복 0·instance.js _route 의 존 판). 안 도는 존이면 멱등 no-op(decision 만 있고 미가동 — placeExecute 경로상 미발생). placeExecute ON·placeMigrate 일 때만 호출.
  _migrate(zoneId, toHost) {
    if (!this.running.has(zoneId)) return false;     // 미가동 — 집행 대상 없음(멱등).
    if (this.running.get(zoneId) === toHost) return false;
    this.running.set(zoneId, toHost); this.runtimeMigrations++; return true;   // release(from)+acquire(toHost) 원자 교체.
  },
  // host 장애 복구(step-0248·#51) — 죽은 host 의 모든 존을 살아남은 host 중 최소부하로 재가동(re-acquire). 드레인(_drain)과 골격은 같으나 *비자발적*: 죽은 host 런타임은 이미 소실이므로 graceful migrate 가 아니라 running 단일 키 재배치(공백 없이 한 존 정확히 한 host 회복). 매 존마다 최소부하 재계산(고른 분산). 생존 host 없으면 보류. 결정(placement)도 함께 갱신해 drift 0.
  _hostDown(host, hosts) {
    let rescued = 0;
    const others = (hosts || []).filter(h => h !== host);   // 생존 host 후보(죽은 host 제외).
    for (const [zid, h] of [...this.placement]) {            // placement 삽입 순(결정론).
      if (h !== host) continue;                             // 죽은 host 의 존만.
      const target = this._leastLoaded(others);             // 매번 최소부하 재계산.
      if (target === null) break;                           // 생존 host 없음 → 보류.
      this.placement.set(zid, target);                      // 재배치 결정.
      if (this.placeExecute) this.running.set(zid, target); // 집행 — 살아남은 host 에 재가동(re-acquire·죽은 host 는 release 불가).
      rescued++;
    }
    this.hostRescued += rescued; return rescued;
  },
  // 존 운영 퇴역 stop(step-0246·#51) — 존을 내린다: 결정(placement)에서 빼고 placeExecute ON 이면 실 런타임(running)도 종료. 없는 존이면 멱등 no-op(zonesRetired 무증). instance.js _despawn 의 존 판. drift 0 보존(둘 다 제거).
  _stop(zoneId) {
    const had = this.placement.delete(zoneId);     // 결정 제거(존 퇴역).
    if (this.placeExecute) this.running.delete(zoneId);   // 집행 — 실 런타임 종료.
    if (had) this.zonesRetired++;
    return had;
  },
  // 존 배치 질의(step-0203) — "이 존이 어디 사나 / 몇 개 배치됐나"(배치 SSOT 읽기). 게이트웨이 라우팅·검증이 쓴다. 질의 인터페이스(request/reply over net)는 0204.
  placementOf(zoneId) { return this.placement.get(zoneId) || null; },
  placedCount() { return this.placement.size; },
  // 존 런타임 질의(step-0241·#51) — "이 존이 *실제로* 어느 host 에서 도나 / 이 host 에 몇 개 도나 / 총 몇 개 도나"(executed SSOT 읽기·placement 결정과 대조해 drift 0 검증).
  runningHostOf(zoneId) { return this.running.get(zoneId) || null; },
  runningOn(host) { let n = 0; for (const h of this.running.values()) if (h === host) n++; return n; },
  runningCount() { return this.running.size; },
  // 가동 host 질의(step-0249·#51) — 현재 존을 하나라도 돌리는 *가동 중 host* 집합(운영 대시보드 — "지금 몇 대가 일하나"). 빈 host(드레인/장애 후)는 빠진다.
  runningHosts() { return new Set(this.running.values()); },
  // placement↔running 표류 질의(step-0245·#51 capstone) — 결정(placement)과 집행(running)이 어긋난 존 수(host 불일치 또는 한쪽에만 존재). placeExecute ON 이면 모든 배치 op 뒤 0(결정==집행·advisory paper 표류 없음)이어야 한다. 읽기 전용(쓰기 무변경).
  placementDrift() {
    let d = 0;
    const ids = new Set([...this.placement.keys(), ...this.running.keys()]);
    for (const z of ids) if (this.placement.get(z) !== this.running.get(z)) d++;
    return d;
  },
  // host 부하(step-0217) — 그 host 에 배치된 존 수(배치 SSOT 에서 파생·부하 지표). 부하 분산 판정의 기준.
  hostLoad(host) { let n = 0; for (const h of this.placement.values()) if (h === host) n++; return n; },
  // 최소 부하 host(step-0217) — 후보 중 hostLoad 최소를 고른다. 동률은 후보 배열 순서로 결정론 tie-break(첫 최소). 후보 없으면 null.
  _leastLoaded(hosts) {
    let best = null, bestLoad = Infinity;
    for (const h of hosts) { const l = this.hostLoad(h); if (l < bestLoad) { bestLoad = l; best = h; } }
    return best;
  },
  // 부하 재배치 자동 트리거(step-0223·placeRebalance) — 후보 host 부하 불균형(최대−최소 ≥ 2)이면 최대부하 host 의 존(placement 삽입 순 첫 존)을 최소부하 host 로 옮긴다(release+acquire 쌍=0218 자동판). 균형(gap<2)까지 한 패스 수렴. 동률은 후보/존 순서로 결정론 tie-break. 옮긴 존 수 반환(균형이면 0).
  _rebalance(hosts) {
    let moved = 0;
    while (true) {
      let maxH = null, maxL = -1, minH = null, minL = Infinity;
      for (const h of hosts) { const l = this.hostLoad(h); if (l > maxL) { maxL = l; maxH = h; } if (l < minL) { minL = l; minH = h; } }
      if (maxH === null || maxL - minL < 2) break;            // 균형(또는 후보 없음) → 종료.
      let z = null; for (const [zid, h] of this.placement) if (h === maxH) { z = zid; break; }   // 최대부하 host 의 첫 존(삽입 순).
      if (z === null) break;
      this.placement.set(z, minH); moved++;                   // release(maxH)+acquire(minH) — 단일 키 원자 교체.
      if (this.placeExecute) this._migrate(z, minH);          // 집행(step-0243) — 실 존 런타임도 함께 이주.
    }
    this.rebalanceMoves += moved; return moved;
  },
  // host 드레인(step-0224·placeDrain) — 정비/퇴역할 host 의 *모든* 존을 나머지 host 중 최소부하로 차례차례 이주(release+acquire 연쇄·권위 단일 소유 보존·드레인 후 그 host 부하 0). 매 존마다 최소부하 재계산(부하 고르게 분산). 다른 host 없으면 보류. 옮긴 존 수 반환.
  _drain(host, hosts) {
    let moved = 0;
    const others = (hosts || []).filter(h => h !== host);   // 드레인 대상 제외 후보.
    for (const [zid, h] of [...this.placement]) {            // placement 삽입 순(결정론).
      if (h !== host) continue;                             // 드레인 host 의 존만.
      const target = this._leastLoaded(others);             // 매번 최소부하 재계산(고른 분산).
      if (target === null) break;                           // 받을 host 없음 → 보류.
      this.placement.set(zid, target); moved++;             // release(host)+acquire(target).
      if (this.placeExecute) this._migrate(zid, target);    // 집행(step-0244) — 실 존 런타임도 함께 이주(드레인 후 running 0).
    }
    this.drainMoves += moved; return moved;
  },
};

const __part = { OrchPlacement };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_placement = __part;
