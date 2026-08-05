// 단일 프로세스 권위 서버 껍질 (Foundation — N0 의 씨앗).
// 불변 규칙: 클라이언트는 명령만 제출한다. 상태 확정은 서버가 하며,
// 모든 상태 변경은 이벤트(리듀서) 경유다. 동시 명령 충돌은 접수 순서로 한 번만 확정된다.
import { EventLog } from '../../events/src/eventLog.js';

export class AuthorityServer {
  #state;
  #handlers;
  #reducer;
  #pending = [];
  #submitSeq = 0;
  #tick = 0;
  log = new EventLog();

  /**
   * handlers: { [commandType]: (stateSnapshot, command) → {accept: bool, reason?, events?: [{type, payload}]} }
   * reducer:  (state, event) → newState  (순수 함수 — 유일한 상태 변경 경로)
   */
  constructor({ initialState, handlers, reducer }) {
    this.#state = structuredClone(initialState);
    this.#handlers = handlers;
    this.#reducer = reducer;
  }

  /** 클라이언트 핸들 — 명령 제출만 가능, 상태 접근은 스냅샷뿐 */
  connect(clientId) {
    return {
      clientId,
      submit: (type, payload) => this.#submit(clientId, type, payload),
      snapshot: () => this.getSnapshot(),
    };
  }

  #submit(clientId, type, payload) {
    const receipt = { submitSeq: this.#submitSeq++, clientId, type, payload };
    this.#pending.push(receipt);
    return { submitSeq: receipt.submitSeq };
  }

  /** 접수 순서대로 결정적 처리 — 결과(수락/거부·이벤트)를 명령별로 반환 */
  processPending() {
    this.#tick += 1;
    const batch = this.#pending.splice(0).sort((a, b) => a.submitSeq - b.submitSeq);
    const results = [];
    for (const cmd of batch) {
      const handler = this.#handlers[cmd.type];
      if (!handler) { results.push({ ...cmd, accepted: false, reason: `미지 명령: ${cmd.type}` }); continue; }
      const verdict = handler(this.getSnapshot(), cmd);
      if (!verdict.accept) { results.push({ ...cmd, accepted: false, reason: verdict.reason ?? 'rejected' }); continue; }
      const applied = [];
      for (const e of verdict.events ?? []) {
        const ev = this.log.append(e.type, e.payload, { tick: this.#tick, traceId: `cmd-${cmd.submitSeq}` });
        this.#state = this.#reducer(this.#state, ev);
        applied.push(ev);
      }
      results.push({ ...cmd, accepted: true, events: applied });
    }
    return results;
  }

  /** 상태는 사본으로만 노출 — 외부 변형은 서버 상태에 닿지 않는다 */
  getSnapshot() { return structuredClone(this.#state); }

  /** 저장·복구 검증용: 이벤트 로그 재생이 현재 상태와 같은가 */
  rebuildFromLog(initialState) { return this.log.replay(structuredClone(initialState), this.#reducer); }
}
