// ============================================================================
// FEnergyLedger — 에너지 원장 (설계 문서 §2)
//
// 서버·클라 공용 순수 모듈 (Node/DOM API 의존 0).
// - 서버: 권위 원장. transfer() 가 유일한 상태 변경 경로 (클램프 = 보존 강제 지점).
// - 클라: 미러 원장. 서버가 확정한 tx 를 applyTx() 로 재생.
//
// 불변식:
//   1. 전 풀 잔고 합계는 transfer 로 절대 변하지 않는다 (보존).
//   2. 잔고는 항상 0 <= balance <= max.
//   3. 지역 합계(regionSums)는 이체·이주마다 O(1) 로 갱신되며
//      항상 "그 지역 풀들의 잔고 합" 과 일치한다 (체크섬 채널의 근거).
// ============================================================================

export class EnergyLedger {
  constructor() {
    this.pools = new Map();      // id -> { id, balance, max, region }
    this.regionSums = new Map(); // regionKey -> int 합계 (region=null 풀은 제외)
  }

  createPool(id, balance, max, region = null) {
    if (this.pools.has(id)) throw new Error(`pool exists: ${id}`);
    const pool = { id, balance, max, region };
    this.pools.set(id, pool);
    if (region !== null) this.#addRegion(region, balance);
    return pool;
  }

  // 잔고 0 인 풀만 제거 가능 — 에너지를 들고 있는 풀의 소멸은 보존 위반이다.
  removePool(id) {
    const pool = this.pools.get(id);
    if (!pool) return;
    if (pool.balance !== 0) throw new Error(`pool not empty: ${id} (${pool.balance})`);
    if (pool.region !== null) this.#addRegion(pool.region, 0); // no-op, 명시성
    this.pools.delete(id);
  }

  get(id) { return this.pools.get(id); }
  balance(id) { return this.pools.get(id)?.balance ?? 0; }

  // 풀의 지역 이주 (아이템 드랍/픽업, 정적 풀 배치) — 지역 합계 O(1) 보정
  setRegion(id, region) {
    const pool = this.pools.get(id);
    if (!pool || pool.region === region) return;
    if (pool.region !== null) this.#addRegion(pool.region, -pool.balance);
    if (region !== null) this.#addRegion(region, pool.balance);
    pool.region = region;
  }

  // 이체 — 원장의 유일한 잔고 변경 연산. want 를 출금 잔고와 입금 수용량으로 클램프.
  // 반환: 확정 이체량 (0 이면 이체 불성립). Got < Want 는 실패가 아니라 게임플레이(고갈/포화).
  transfer(fromId, toId, want, cause) {
    const from = this.pools.get(fromId);
    const to = this.pools.get(toId);
    if (!from || !to || fromId === toId || want <= 0 || !Number.isInteger(want)) return 0;
    const amount = Math.min(want, from.balance, to.max - to.balance);
    if (amount <= 0) return 0;
    from.balance -= amount;
    to.balance += amount;
    if (from.region !== null) this.#addRegion(from.region, -amount);
    if (to.region !== null) this.#addRegion(to.region, amount);
    return amount;
  }

  // 클라 미러 전용 — 서버가 이미 클램프·확정한 tx 를 그대로 재생.
  // 미러가 정확하면 transfer 와 동일한 결과. 어긋나면 지역 체크섬이 잡아낸다.
  applyTx(tx) {
    return this.transfer(tx.from, tx.to, tx.amount, tx.cause) === tx.amount;
  }

  // --------------------------------------------------------------------------
  // 영속화 (A3) — 세계 상태 = 원장 잔고뿐. 배치·시드 유도 값은 담지 않는다.
  // 직렬화·복원이 순수 로직이라 C++ 이식 시 저장 계층과 무관하게 그대로 옮겨진다.
  // --------------------------------------------------------------------------

  // 전 풀을 [id, balance, max, region] 배열로 — 바깥(서버)이 JSON/DB 로 저장한다.
  serialize() {
    const out = [];
    for (const p of this.pools.values()) out.push([p.id, p.balance, p.max, p.region]);
    return out;
  }

  // 직렬화 레코드로 원장을 통째로 재구축 (지역 합계도 createPool 이 O(1) 로 복원).
  load(records) {
    this.pools.clear();
    this.regionSums.clear();
    for (const [id, balance, max, region] of records) this.createPool(id, balance, max, region);
  }

  regionSum(regionKey) { return this.regionSums.get(regionKey) ?? 0; }

  // 전 풀 합계 — 보존 불변식 검증용. O(N) 이므로 검증·표시 채널에서만 사용.
  totalSum() {
    let sum = 0;
    for (const pool of this.pools.values()) sum += pool.balance;
    return sum;
  }

  // --------------------------------------------------------------------------
  // 미러 전용 연산 — 클라이언트 원장에서만 사용한다.
  // 서버 권위 원장은 transfer/setRegion 외의 잔고 변경 경로를 갖지 않는다.
  // --------------------------------------------------------------------------

  // 시야 진입/스냅샷 복구: 풀을 서버가 알려준 값으로 강제 일치 (upsert)
  mirrorSet(id, balance, max, region = null) {
    const existing = this.pools.get(id);
    if (existing) {
      if (existing.region !== null) this.#addRegion(existing.region, -existing.balance);
      existing.balance = balance;
      existing.max = max;
      existing.region = region;
      if (region !== null) this.#addRegion(region, balance);
      return existing;
    }
    return this.createPool(id, balance, max, region);
  }

  // 시야 이탈: 풀을 미러에서 잊는다 (에너지 소멸이 아니라 관측 중단)
  forget(id) {
    const pool = this.pools.get(id);
    if (!pool) return;
    if (pool.region !== null) this.#addRegion(pool.region, -pool.balance);
    this.pools.delete(id);
  }

  #addRegion(key, delta) {
    this.regionSums.set(key, (this.regionSums.get(key) ?? 0) + delta);
  }
}
