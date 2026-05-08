// IntentStore 인터페이스 (§5) — window-global, no ESM
// 모든 구체 Store 가 상속해야 하는 추상 기반 클래스.
//
// 에러 타입:
//   StaleError     — 낙관적 잠금 충돌 (baseVersion 이 현재 HEAD와 불일치)
//   ChildExistsError — 자식 Intent 가 있는 상태에서 삭제 시도

class StaleError extends Error {
  constructor(message) {
    super(message || 'StaleError: 외부에서 변경됨 — baseVersion 이 현재 HEAD와 불일치');
    this.name = 'StaleError';
  }
}

class ChildExistsError extends Error {
  constructor(id, children) {
    super(`ChildExistsError: ${id} 에 자식 Intent ${(children || []).join(', ')} 가 있어 삭제 불가`);
    this.name = 'ChildExistsError';
    this.intentId = id;
    this.children = children || [];
  }
}

/**
 * IntentStore 추상 기반 클래스.
 *
 * 모든 메서드는 Promise 를 반환한다.
 * 구체 구현체(GitHubStore 등)는 이 클래스를 extends 해야 한다.
 */
class IntentStore {
  /**
   * 모든 Intent 목록을 반환한다.
   * @returns {Promise<Array>} Intent 객체 배열
   */
  async list() {
    throw new Error('IntentStore.list() 는 구현되지 않았습니다');
  }

  /**
   * 특정 ID 의 Intent 를 반환한다.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    throw new Error('IntentStore.get() 는 구현되지 않았습니다');
  }

  /**
   * 새 Intent 를 생성한다. input 에는 id 필드가 없어야 한다.
   * @param {Object} input  { title, status, intent, parents, children, tags }
   * @returns {Promise<Object>} 생성된 Intent (id, baseVersion 포함)
   */
  async create(input) {
    throw new Error('IntentStore.create() 는 구현되지 않았습니다');
  }

  /**
   * 기존 Intent 를 갱신한다.
   * @param {string} id
   * @param {Object} patch
   * @param {string} baseVersion  낙관적 잠금 버전 토큰
   * @returns {Promise<Object>} 갱신된 Intent
   * @throws {StaleError}
   */
  async update(id, patch, baseVersion) {
    throw new Error('IntentStore.update() 는 구현되지 않았습니다');
  }

  /**
   * Intent 를 삭제한다.
   * @param {string} id
   * @param {string} baseVersion
   * @returns {Promise<void>}
   * @throws {StaleError}
   * @throws {ChildExistsError}
   */
  async remove(id, baseVersion) {
    throw new Error('IntentStore.remove() 는 구현되지 않았습니다');
  }

  /**
   * 변경 이벤트를 구독한다.
   * @param {Function} onChange  ({ type, id, occurredAt }) 콜백
   * @returns {Function} unsubscribe 함수
   */
  subscribe(onChange) {
    throw new Error('IntentStore.subscribe() 는 구현되지 않았습니다');
  }
}

// window 전역 노출
window.IntentStore = IntentStore;
window.StaleError = StaleError;
window.ChildExistsError = ChildExistsError;
