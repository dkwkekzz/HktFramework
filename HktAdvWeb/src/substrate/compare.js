// 비교 연산자 — 술어 DSL v0 (objective-graph.yaml 헤더) 의 정본 op 집합.
// substance.hasProp, predicate.evalPred, demand 판정이 공유한다.

export const OPS = new Set(['>=', '<=', '==', '!=', '>', '<']);

export function compare(a, op, b) {
  switch (op) {
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '<': return a < b;
    case '==': return a === b;
    case '!=': return a !== b;
    default:
      throw new Error(`알 수 없는 비교 연산자: '${op}'`);
  }
}
