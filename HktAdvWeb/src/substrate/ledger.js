// =====================================================================
// 에너지 원장 (step A3)
// ---------------------------------------------------------------------
// 개체별 에너지 계좌 + 모든 이체는 사유(cause)와 함께 기록되고 총량이 보존된다.
// 에너지는 세계의 공통 결제 통화(Design-ObjectiveHierarchy §4.1).
// 감사 불변식:  총 발행량(mint) == Σ잔고 + Σ소각(burn)
// (Design-StepPlan §3 A3)
// =====================================================================

export class Ledger {
  constructor() {
    this.balances = new Map(); // id → 잔고
    this.journal = []; // 이체 기록 (append-only)
    this.minted = 0; // 총 발행량 (open initial + mint)
    this.burned = 0; // 총 소각량
  }

  // 계좌 개설. initial 은 세계 발행(mint)로 취급 — 감사 총량에 포함.
  open(id, initial = 0) {
    if (this.balances.has(id)) {
      throw new Error(`이미 존재하는 계좌: '${id}'`);
    }
    if (initial < 0) throw new Error('초기 잔고는 음수일 수 없다');
    this.balances.set(id, initial);
    this.minted += initial;
    if (initial > 0) {
      this.journal.push({ kind: 'open', to: id, amount: initial, cause: '계좌 개설' });
    }
    return id;
  }

  has(id) {
    return this.balances.has(id);
  }

  balance(id) {
    if (!this.balances.has(id)) throw new Error(`없는 계좌: '${id}'`);
    return this.balances.get(id);
  }

  // 이체 — amount>0, 잔고 부족 거부, cause 필수. 총량 불변.
  transfer(from, to, amount, cause) {
    if (!(amount > 0)) throw new Error('이체액은 0보다 커야 한다');
    if (!cause) throw new Error('이체에는 사유(cause)가 필수다');
    if (!this.balances.has(from)) throw new Error(`없는 출금 계좌: '${from}'`);
    if (!this.balances.has(to)) throw new Error(`없는 입금 계좌: '${to}'`);
    const bal = this.balances.get(from);
    if (bal < amount) throw new Error(`잔고 부족: '${from}' (${bal} < ${amount})`);
    this.balances.set(from, bal - amount);
    this.balances.set(to, this.balances.get(to) + amount);
    this.journal.push({ kind: 'transfer', from, to, amount, cause });
  }

  // 세계 경계 사유로만 허용 — 재앙·소멸 등. 별도 기록.
  mint(to, amount, cause) {
    if (!(amount > 0)) throw new Error('발행액은 0보다 커야 한다');
    if (!cause) throw new Error('발행에는 세계 경계 사유가 필수다');
    if (!this.balances.has(to)) throw new Error(`없는 계좌: '${to}'`);
    this.balances.set(to, this.balances.get(to) + amount);
    this.minted += amount;
    this.journal.push({ kind: 'mint', to, amount, cause });
  }

  burn(from, amount, cause) {
    if (!(amount > 0)) throw new Error('소각액은 0보다 커야 한다');
    if (!cause) throw new Error('소각에는 세계 경계 사유가 필수다');
    if (!this.balances.has(from)) throw new Error(`없는 계좌: '${from}'`);
    const bal = this.balances.get(from);
    if (bal < amount) throw new Error(`잔고 부족(소각): '${from}' (${bal} < ${amount})`);
    this.balances.set(from, bal - amount);
    this.burned += amount;
    this.journal.push({ kind: 'burn', from, amount, cause });
  }

  totalBalance() {
    let sum = 0;
    for (const v of this.balances.values()) sum += v;
    return sum;
  }

  // 보존 불변식 검사: mint == Σ잔고 + burn.
  audit() {
    const total = this.totalBalance();
    const ok = Math.abs(this.minted - (total + this.burned)) < 1e-9;
    return {
      ok,
      minted: this.minted,
      burned: this.burned,
      totalBalance: total,
      expected: this.minted,
      actual: total + this.burned,
    };
  }

  snapshot() {
    return {
      balances: Object.fromEntries(this.balances),
      minted: this.minted,
      burned: this.burned,
      journal: [...this.journal],
      audit: this.audit(),
    };
  }
}
