// V0 — 모듈 계약 레지스트리: 고정 모듈 순서, Step 의 consumes/produces 등록, 의존성 검사.
// 오류: 아무도 생산하지 않는 산출물 소비, 미지 모듈.
// 경고: 소비되지 않는 산출물(터미널 예외), 역방향(피드백) 소비.

export const MODULE_ORDER = ['V', 'O', 'S', 'D', 'P', 'Q', 'W', 'R', 'E', 'G', 'C', 'X', 'N', 'A'];

export class ModuleContractRegistry {
  #steps = new Map();          // stepId → {module, mode, consumes, produces}
  #external = new Set();       // Foundation 등 Cycle 밖에서 공급되는 산출물
  #terminal = new Set();       // 다음 모듈이 아닌 외부(다음 Cycle·플레이어)가 소비하는 산출물

  registerExternalArtifacts(ids) { for (const id of ids) this.#external.add(id); }
  registerTerminalArtifacts(ids) { for (const id of ids) this.#terminal.add(id); }

  registerStep({ id, module, mode, consumes = [], produces = [] }) {
    if (!MODULE_ORDER.includes(module)) throw new Error(`미지 모듈 ${module} (step ${id})`);
    if (this.#steps.has(id)) throw new Error(`중복 Step 등록: ${id}`);
    this.#steps.set(id, { id, module, mode, consumes: [...consumes], produces: [...produces] });
  }

  get stepCount() { return this.#steps.size; }

  /** 모듈별 Step 존재 여부 — SKIP 금지 검사용 */
  modulesCovered() {
    const covered = new Set();
    for (const s of this.#steps.values()) covered.add(s.module);
    return MODULE_ORDER.filter((m) => covered.has(m));
  }

  checkDependencies() {
    const errors = [];
    const warnings = [];
    const producers = new Map(); // artifact → {stepId, moduleIndex}
    for (const s of this.#steps.values()) {
      const mi = MODULE_ORDER.indexOf(s.module);
      for (const a of s.produces) {
        if (producers.has(a)) errors.push(`산출물 중복 생산: ${a} (${producers.get(a).stepId}, ${s.id})`);
        producers.set(a, { stepId: s.id, moduleIndex: mi });
      }
    }
    const consumed = new Set();
    for (const s of this.#steps.values()) {
      const mi = MODULE_ORDER.indexOf(s.module);
      for (const a of s.consumes) {
        consumed.add(a);
        if (this.#external.has(a)) continue;
        const p = producers.get(a);
        if (!p) { errors.push(`생산자 없는 소비: ${s.id} ← ${a}`); continue; }
        if (p.moduleIndex > mi) warnings.push(`역방향(피드백) 소비: ${s.id}(${s.module}) ← ${a} (${p.stepId})`);
      }
    }
    for (const [a, p] of producers) {
      if (!consumed.has(a) && !this.#terminal.has(a)) warnings.push(`미소비 산출물: ${a} (${p.stepId})`);
    }
    return { errors, warnings };
  }
}
