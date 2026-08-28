// Pending Requests (범용 엔진) — 보낸 요청과 돌아온 대답을 짚어 맞춘다.
//
// 세계는 요청 하나하나에 대답한다 (RULE-REQUEST-REPLY-001). 그 대답에는 요청에
// 실어 보낸 표식이 그대로 붙어 오므로(INTENT-REPLY-CORRESPONDENCE-001) 어느 요청의
// 대답인지 짚을 수 있다. **그 짚는 표가 지금까지 조립 루트에 손으로 짜여 있었다.**
//
// 이 파일이 아는 것은 표식과 그것에 매달아 둔 값 하나뿐이다. 그 값이 화면의 어느
// 줄인지, 어느 칸인지, 무엇을 하려던 요청인지 알지 못한다 — 그래서 무엇을 기다리든
// 같은 표가 된다.
//
// 왜 이것이 필요한가: 세계가 답하기 전에는 아무것도 참이 아니다. 기다리는 동안
// 화면이 결과를 앞당겨 그리지 않으려면, 무엇을 기다리는 중인지를 **화면이 알아야**
// 한다. 그것을 모르면 기다림은 보이지 않고, 보이지 않는 기다림은 같은 요청을 두 번
// 보내게 만든다.

export interface PendingRequests<T> {
  /**
   * 보낸 요청 하나를 기다림에 올린다.
   *
   * 표식이 없으면(= 보내지 못했으면) 올리지 않고 거짓을 낸다. 보내지 못한 것을
   * 기다리면 영영 풀리지 않는 기다림이 남는다.
   */
  add(mark: number | null | undefined, value: T): boolean;
  /**
   * 대답 하나를 짚어 뺀다 — 그 요청에 매달아 두었던 값을 낸다.
   *
   * 표식이 없는 대답은 **가장 오래 기다린 것**에 붙인다. 버리지 않는 이유는 대답이
   * 왔다는 사실 자체가 기다림의 끝이기 때문이다 — 버리면 그 자리는 영영 기다린다.
   */
  resolve(mark: number | undefined): T | undefined;
  /** 이런 것을 지금 기다리는 중인가 — 같은 요청을 두 번 보내지 않기 위한 물음 */
  waiting(match: (value: T) => boolean): boolean;
  /** 지금 기다리는 것들 — 올린 차례대로 */
  values(): T[];
  /** 몇을 기다리는가 */
  size(): number;
  /** 전부 잊는다 — 이어짐이 끊겼을 때처럼 대답이 영영 오지 않게 된 자리 */
  clear(): void;
}

export function createPendingRequests<T>(): PendingRequests<T> {
  // 올린 차례가 유지되는 것이 요점이다 — 표식 없는 대답이 가장 오래된 것에 붙는다
  const waitingByMark = new Map<number, T>();

  return {
    add(mark, value) {
      if (mark === null || mark === undefined) return false;
      waitingByMark.set(mark, value);
      return true;
    },

    resolve(mark) {
      if (mark !== undefined) {
        const found = waitingByMark.get(mark);
        if (found === undefined) return undefined;
        waitingByMark.delete(mark);
        return found;
      }
      const oldest = waitingByMark.keys().next();
      if (oldest.done) return undefined;
      const found = waitingByMark.get(oldest.value)!;
      waitingByMark.delete(oldest.value);
      return found;
    },

    waiting(match) {
      for (const value of waitingByMark.values()) if (match(value)) return true;
      return false;
    },

    values: () => [...waitingByMark.values()],
    size: () => waitingByMark.size,
    clear: () => waitingByMark.clear(),
  };
}
