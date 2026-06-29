'use strict';
// step-0353 — #57 실 host.js OS 프로세스 spawn 3: clusterDriver 훅 seam. _hostSet 의 첫-존 spawn·마지막-존 despawn 지점에서 driver.onSpawn/onDespawn 호출(cluster-run.js 가 실 cluster.spawnOne/killHost 로 집행). 미부착(null)→호출 0 = 0352 비트 동일.
// step-0352 — #57 실 host.js OS 프로세스 spawn 2: hostSpawnDelta(prev) 읽기 전용 reconcile 델타. 직전 spawn 된 host 집합 대비 {spawn,kill,keep} — 드라이버가 매 reconcile tick cluster.spawnOne/killHost 로 집행할 차이. 읽기 전용·0351 비트 동일.
// step-0351 — #57 실 host.js OS 프로세스 spawn 1: hostSpawnPlan() 읽기 전용 매니페스트. zoneHostSnapshot(0309) 을 *실 cluster 드라이버가 집행할 spawn 계약*(결정론 spawn order + 존 roster + 총계)으로 감싼다. 읽기 전용·0350 비트 동일.
// step-0310 — #9 잔여(실 host.js 물리 분리) capstone: hostProcCoherent(directFlowCoherent && hostContainerCoherent). destructive+graceful 혼합 lifecycle 을 host 프로세스 컨테이너 라우팅(자기 inbox 수신·자기 루프 tick·roster·stale 거부)으로 돌린 뒤 참 → 실 host.js 물리 분리 arc 0301~0310 닫기. 읽기 전용·0309 비트 동일.
// step-0309 — #9 잔여(실 host.js 물리 분리): host 컨테이너 스냅샷(zoneHostSnapshot·host→[존…]). 다중 동시 이주(4존 몰림→rebalance→drain) 후 host 컨테이너가 running 을 host 별로 묶은 것과 정확한 bijection(zoneDirSnapshot 0299 의 host 프로세스 판). 읽기 전용·0308 비트 동일.
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
    for (const [h, c] of this.zoneHosts) { if (c.zones.delete(zoneId)) { if (this.clusterDriver) { this.clusterDriver.onUnassign(h, zoneId); this.driverUnassigns++; } if (c.zones.size === 0) { this.zoneHosts.delete(h); this.hostDeregisters++; if (this.zoneHostLifecycle) this.hostLifecycleLog.push({ host: h, kind: 'despawn', seq: this.hostLifecycleLog.length }); if (this.clusterDriver) { this.clusterDriver.onDespawn(h); this.driverDespawns++; } } } }   // step-0304 — 마지막 존 잃은 host 컨테이너 제거 = 프로세스 despawn 씨앗. step-0312 — despawn 이벤트 로그(실 killHost 지점). step-0353/0354 — clusterDriver 면 onUnassign(존 떨어짐)+onDespawn(실 cluster.killHost) 집행 훅(미부착→호출 0·비트 동일).
    if (host == null) return;             // 퇴역/소실 — 떼기만(어느 host 도 소유 안 함).
    let c = this.zoneHosts.get(host);
    if (!c) { c = { zones: new Set() }; this.zoneHosts.set(host, c); this.hostRegisters++; if (this.zoneHostLifecycle) this.hostLifecycleLog.push({ host, kind: 'spawn', seq: this.hostLifecycleLog.length }); if (this.clusterDriver) { this.clusterDriver.onSpawn(host); this.driverSpawns++; } }   // step-0304 — 첫 존 받아 새 host 컨테이너 생성 = 프로세스 spawn 씨앗. step-0312 — spawn 이벤트 로그(실 cluster.spawnOne 지점). step-0353 — clusterDriver 면 실 cluster.spawnOne 집행 훅(미부착→호출 0·비트 동일).
    c.zones.add(zoneId);
    if (this.clusterDriver) { this.clusterDriver.onAssign(host, zoneId); this.driverAssigns++; }   // step-0354 — 존이 host 컨테이너에 붙음 = 실 host 에 그 존 init/loadstate 집행 훅(미부착→호출 0·비트 동일).
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
  // host 프로세스 부하 균형 술어(step-0318·#9 잔여) — 클러스터가 *고르게 부하 분산됐는가*의 단일 판정: 존 수 불균형(hostLoadSkew·0311)과 entity 불균형(hostEntitySkew·0314)이 둘 다 허용 오차 안. 부하 균형 sub-arc(0311~0317·skew 관측·생애주기·failover·entity 가중 배치/재배치)의 종합 술어 — 재배치 후 참·재배치 전 거짓을 단언(capstone). 읽기 전용.
  hostBalanced(zoneTol = 2, entTol = 2) { return this.hostLoadSkew().skew <= zoneTol && this.hostEntitySkew().skew <= entTol; },
  // entity 가중 부하 재배치(step-0317·#9 잔여·placeRebalanceE) — entity 부하가 가장 무거운 host 의 한 존을 가장 가벼운 host 로 이주(release+acquire), entity gap(max−min) < 2 가 될 때까지 반복. _rebalance(0223·존 수)의 entity 가중 판. *진동 방지*: 옮겨서 gap 이 strict 하게 줄어드는 존만 고른다(없으면 종료) → gap 단조 감소 = 종료 보장. placement+running 함께 갱신(drift 0). 옮긴 존 수 반환.
  _rebalanceByEntities(hosts) {
    let moved = 0;
    for (let guard = 0; guard < 64; guard++) {
      let maxH = null, maxL = -1, minH = null, minL = Infinity;
      for (const h of hosts) { const l = this.hostEntityLoad(h); if (l > maxL) { maxL = l; maxH = h; } if (l < minL) { minL = l; minH = h; } }
      if (maxH === null || maxH === minH || maxL - minL < 2) break;       // 균형(gap<2)·후보 없음 → 종료.
      const c = this.zoneHosts.get(maxH); if (!c) break;
      let pick = null;
      for (const zid of c.zones) { const rt = this.zoneRuntimes.get(zid); const e = rt ? rt.zone.ents.size : 0; if (Math.abs((maxL - e) - (minL + e)) < (maxL - minL)) { pick = zid; break; } }   // gap 을 strict 하게 줄이는 첫 존만(단조·진동 0).
      if (pick === null) break;
      this.placement.set(pick, minH); moved++;                            // release(maxH)+acquire(minH) 결정.
      if (this.placeExecute) this._migrate(pick, minH);                    // 집행 — 실 존 런타임도 이주(같은 핸들·상태 보존).
    }
    this.rebalanceEMoves += moved; return moved;
  },
  // host 프로세스 entity 부하 질의(step-0316·#9 잔여) — 그 host 컨테이너가 인 존들의 entity 총수(실 부하 ≈ 동접 플레이어). hostLoad(0217·존 수)의 entity 가중 판 — 부하 인지 자동 배치(placeAutoE)가 가장 한가한 host 를 고르는 기준. 컨테이너 없는 idle host 는 0. 읽기 전용.
  hostEntityLoad(host) { const c = this.zoneHosts.get(host); if (!c) return 0; let e = 0; for (const z of c.zones) { const rt = this.zoneRuntimes.get(z); if (rt) e += rt.zone.ents.size; } return e; },
  // entity 최소 부하 host 선택(step-0316·#9 잔여) — 후보 중 hostEntityLoad 최소(동률은 후보 배열 순서로 결정론 tie-break). 후보 없으면 null. _leastLoaded(0217·존 수)의 entity 가중 판 — placeAutoE 가 쓴다.
  _leastLoadedByEntities(hosts) { let best = null, bestLoad = Infinity; for (const h of hosts) { const l = this.hostEntityLoad(h); if (l < bestLoad) { bestLoad = l; best = h; } } return best; },
  // 가동 host 프로세스 수 질의(step-0315·#9 잔여) — 지금 존을 하나라도 돌리는 host 컨테이너 수(="몇 대의 host.js 프로세스가 떠 있나"·운영 대시보드의 기본 카운터). runningHosts(0249·집행 SSOT 의 host 집합)의 컨테이너 판 — 다중 동시 장애 후 생존 host 수로 수렴(예: 2대 죽고 1대 남으면 1). 읽기 전용.
  hostCount() { return this.zoneHosts.size; },
  // host 프로세스 entity 가중 부하 질의(step-0314·#9 잔여) — 부하를 *존 수*(hostLoadSkew·0311)가 아니라 *entity 수*로 본다 {hosts, min, max, skew}. 실 부하 ≈ 동접 플레이어 수이므로 entity 가중이 재배치의 더 정직한 척도(존 1개라도 만원이면 무겁다·존 수만 보면 균형으로 착각). zoneHostCensus(0307)의 entities 분포를 균형 렌즈로. host 0개면 전부 0. 읽기 전용.
  hostEntitySkew() {
    let min = Infinity, max = 0, n = 0;
    for (const c of this.zoneHosts.values()) {
      let e = 0; for (const z of c.zones) { const rt = this.zoneRuntimes.get(z); if (rt) e += rt.zone.ents.size; }
      if (e < min) min = e; if (e > max) max = e; n++;
    }
    if (n === 0) return { hosts: 0, min: 0, max: 0, skew: 0 };
    return { hosts: n, min, max, skew: max - min };
  },
  // host 단건 존 목록 질의(step-0313·#9 잔여) — 그 host 컨테이너가 소유한 존 목록(정렬). zoneHostSnapshot(0309·전체 host→[존…])의 단건 판 — "이 host 프로세스가 지금 무슨 존을 돌리나"(장애 후 죽은 host 비움·생존 host 인수 검증의 단위). 미가동/죽은 host 는 []. 읽기 전용.
  hostZones(host) { const c = this.zoneHosts.get(host); return c ? [...c.zones].sort() : []; },
  // host 프로세스 생애주기 질의(step-0312·#9 잔여) — host 컨테이너 spawn/despawn 의 순서 있는 이벤트 스트림과 그 net 결과. hostRegisters/hostDeregisters(누적 수)가 *얼마나*라면, 이건 *언제 어느 host 가 떴다/졌다*(실 cluster.spawnOne(host)/killHost(host) 호출이 들어갈 지점·운영 타임라인). 불변: net 스폰 집합(spawn−despawn 상쇄)이 현재 가동 host 집합(zoneHostHosts)과 정확히 일치. zoneHostLifecycle OFF 면 빈 로그. 읽기 전용.
  hostLifecycle() { return this.hostLifecycleLog.slice(); },
  hostSpawnCount() { let n = 0; for (const e of this.hostLifecycleLog) if (e.kind === 'spawn') n++; return n; },
  hostDespawnCount() { let n = 0; for (const e of this.hostLifecycleLog) if (e.kind === 'despawn') n++; return n; },
  // 생애주기 로그를 접어 *지금 떠 있는* host 집합 재구성(spawn 시 추가·despawn 시 제거·로그 재생). 가동 host 집합(zoneHostHosts)과 일치해야 — 로그가 roster 의 정직한 역사. 읽기 전용.
  hostLifecycleNet() {
    const live = new Set();
    for (const e of this.hostLifecycleLog) { if (e.kind === 'spawn') live.add(e.host); else live.delete(e.host); }
    return live;
  },
  // host 프로세스 부하 불균형 질의(step-0311·#9 잔여) — 전 host 컨테이너의 존 수 분포에서 부하 균형을 본다 {hosts, min, max, skew:max−min}. zoneHostCensus(0307·존/entity 분포)가 *무엇이 어디*라면, 이건 *얼마나 고른가*(오케스트레이터가 어느 host 프로세스를 비우거나 채울지 판단하는 실 단위). placeRebalance/placeDrain 같은 graceful 재배치 뒤 skew 가 작아지는지(균형 수렴)를 단언하는 기초. host 0개면 전부 0. 읽기 전용.
  hostLoadSkew() {
    let min = Infinity, max = 0, n = 0;
    for (const c of this.zoneHosts.values()) { const z = c.zones.size; if (z < min) min = z; if (z > max) max = z; n++; }
    if (n === 0) return { hosts: 0, min: 0, max: 0, skew: 0 };
    return { hosts: n, min, max, skew: max - min };
  },
  // host 컨테이너 정합 불변 질의(step-0308·#9 잔여·primitive) — host 프로세스 층이 깨지지 않았는가의 단일 술어: ⒜ zoneHostSingleOwner(어떤 존도 두 host 없음·0303) ⒝ zoneHostDrift 0(컨테이너==집행 SSOT running·0303) ⒞ roster 회계 닫힘(hostRegisters−hostDeregisters == 현 host 컨테이너 수·0304 spawn/despawn 이 정확히 상쇄). 참이면 "존이 정확히 한 host 프로세스에·컨테이너가 집행과 한 몸·spawn/despawn 회계가 현 host 수와 일치". bridgeCoherent(0278·실 핸들)의 *host 프로세스 컨테이너* 판. 모든 배치 op 뒤 참(capstone 0310). 읽기 전용.
  hostContainerCoherent() {
    return this.zoneHostSingleOwner() && this.zoneHostDrift() === 0 &&
      (this.hostRegisters - this.hostDeregisters) === this.zoneHosts.size;
  },
  // host 컨테이너 스냅샷 질의(step-0309·#9 잔여) — 현재 host→[존…] 배치 전체를 한 장으로(zoneDirSnapshot 0299·게이트웨이 디렉토리의 host 프로세스 컨테이너 판). 다중 동시 이주(rebalance/drain) 후 이 스냅샷이 running 을 host 별로 묶은 것과 정확한 bijection 인지 검증. 읽기 전용.
  zoneHostSnapshot() {
    const snap = {};
    for (const [h, c] of this.zoneHosts) snap[h] = [...c.zones].sort();
    return snap;
  },
  // host 프로세스 spawn 매니페스트(step-0351·#57 실 host.js OS 프로세스 spawn) — 실 cluster 드라이버가 집행할 *spawn 계약*: 어느 host 프로세스를 (결정론 순서로) 띄우고 각자 어느 존 roster 를 소유하나. zoneHostSnapshot(0309·host→[존…])을 드라이버가 소비할 매니페스트 봉투로 감싼다(정렬된 spawn order·존 수·총계). hostLifecycleLog(0312)가 *언제 떴다/졌다*(이벤트 역사)라면, 이건 *지금 무엇을 띄워야 하나*(목표 상태) — cluster.spawnOne(host)+init(zone specs) 의 입력. 직렬화 가능(host.js 가 자기 makeActor 로 존 재구성 = 멀티프로세스-safe·존 spec 내부는 안 실음). 읽기 전용.
  hostSpawnPlan() {
    const snap = this.zoneHostSnapshot();
    const order = Object.keys(snap).sort();   // 결정론 spawn 순서(드라이버가 같은 순서로 spawnOne)
    const hosts = {}; let zones = 0;
    for (const h of order) { hosts[h] = { zones: snap[h], count: snap[h].length }; zones += snap[h].length; }
    return { hosts, order, hostCount: this.hostCount(), zones };
  },
  // host 프로세스 spawn 델타(step-0352·#57) — *직전에 spawn 돼 있던* host 집합(prev) 대비 현재 목표(zoneHosts)의 차이 {spawn,kill,keep}(정렬). hostSpawnPlan(0351)이 *목표 상태*라면, 이건 그 목표에 수렴하기 위해 드라이버가 *이번 reconcile tick 에 집행할 동작*: spawn=새로 cluster.spawnOne, kill=cluster.killHost, keep=유지. hostLifecycle(0312·이벤트 역사)을 *지금 무엇을 실행하나*(reconcile 차이)로 환산 — 실 cluster 가 외부 상태(이미 뜬 프로세스)와 목표를 맞추는 표준 패턴. 읽기 전용.
  hostSpawnDelta(prev) {
    const cur = new Set(this.zoneHosts.keys());
    const prevSet = new Set(prev || []);
    const spawn = [...cur].filter(h => !prevSet.has(h)).sort();
    const kill = [...prevSet].filter(h => !cur.has(h)).sort();
    const keep = [...cur].filter(h => prevSet.has(h)).sort();
    return { spawn, kill, keep };
  },
  // host 프로세스 전 정합 질의(step-0310·#9 잔여 capstone) — 데이터 평면이 *host 프로세스 컨테이너 경유*로 흘러도 모든 것이 한 몸인지의 단일 술어: ⒜ directFlowCoherent(배치 3층 정합 + entity 단일 소유/orphan0 + 게이트웨이 직접 라우팅 stale 0·0300) ⒝ hostContainerCoherent(존이 정확히 한 host 프로세스에 + 컨테이너==집행 + roster 회계 닫힘·0308). 참이면 "게이트웨이 직접 라우팅 데이터 평면 전부 정합 + host 프로세스 컨테이너(자기 inbox 수신·자기 루프 tick·spawn/despawn roster·stale 거부)가 집행 SSOT 와 완전 정합". destructive+graceful 혼합 lifecycle 을 host 프로세스 컨테이너 라우팅으로 돌린 뒤 참(0310 capstone·실 host.js 물리 분리 arc 0301~0310 닫기). 읽기 전용.
  hostProcCoherent() { return this.directFlowCoherent() && this.hostContainerCoherent(); },
};

const __part = { OrchHostProc };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_hostproc = __part;
