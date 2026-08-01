// V1 Stable Sort — 사건 순서가 정렬 구현이나 엔진 버전에 흔들리지 않게 한다.
// 비교값이 같은 원소는 입력 순서를 그대로 유지한다 (엔진의 안정성 보장에 기대지 않고 직접 고정).

/** 두 값의 순서. 음수 = a 먼저, 0 = 동률, 양수 = b 먼저. */
export type Comparator<T> = (a: T, b: T) => number;

/** 안정 정렬 — 원본을 바꾸지 않고 새 배열을 돌려준다. */
export function stableSort<T>(items: readonly T[], compare: Comparator<T>): T[] {
  // 입력 순서를 보조 키로 붙여서 동률을 결정적으로 깬다.
  const decorated = items.map((value, index) => ({ value, index }));
  decorated.sort((left, right) => {
    const order = compare(left.value, right.value);
    if (order !== 0) {
      if (!Number.isFinite(order)) {
        throw new RangeError('비교 결과는 유한한 수여야 한다');
      }
      return order;
    }
    return left.index - right.index;
  });
  return decorated.map((entry) => entry.value);
}

/** 문자열 코드포인트 비교 — localeCompare 는 환경마다 결과가 달라지므로 금지. */
export function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** 수 비교. NaN 은 거부한다 (비교 불가능한 상태를 조용히 통과시키지 않는다). */
export function compareNumbers(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new RangeError('NaN 은 정렬할 수 없다');
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

/** 키 추출 함수로 비교자를 만든다. */
export function compareBy<T>(key: (item: T) => number | string): Comparator<T> {
  return (a, b) => {
    const left = key(a);
    const right = key(b);
    if (typeof left === 'number' && typeof right === 'number') {
      return compareNumbers(left, right);
    }
    return compareStrings(String(left), String(right));
  };
}

/** 비교자를 순서대로 적용한다 — 앞이 동률일 때만 뒤를 본다. */
export function compareChain<T>(...comparators: readonly Comparator<T>[]): Comparator<T> {
  return (a, b) => {
    for (const compare of comparators) {
      const order = compare(a, b);
      if (order !== 0) return order;
    }
    return 0;
  };
}

/** 비교자를 뒤집는다. */
export function descending<T>(compare: Comparator<T>): Comparator<T> {
  return (a, b) => -compare(a, b);
}
