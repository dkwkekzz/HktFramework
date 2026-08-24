// Focus Movement (범용 엔진) — 나란히 놓인 것들 사이에서 자판 초점을 옮긴다.
//
// **고르기를 소유하지 않는다.** 초점은 "지금 자판이 가리키는 자리" 이고, 고르기는
// "겪는 사람이 골라 둔 것" 이다. 둘은 다른 것이며 고르기는 결정 Layer 가 쥔다 —
// 여기 있는 것은 목록과 지금 자리에서 다음 자리를 구하는 산수뿐이다.
//
// 이 파일에는 게임의 명사가 하나도 없다. 무엇의 목록인지 알지 못한다.

/**
 * 한 줄로 늘어선 것들 사이의 이동.
 *
 * 목록이 비었으면 초점도 없다. 지금 자리가 목록에 없으면(방금 사라졌으면) 첫 자리로
 * 되돌린다 — 사라진 자리를 붙들고 있으면 다음 눌림이 아무 데도 가지 않는다.
 *
 * 끝에서 한 번 더 가면 반대쪽 끝으로 감긴다. 감기지 않으면 목록의 양 끝이 막다른 곳이
 * 되고, 그때 겪는 사람은 자기가 끝에 있는지 조작이 죽었는지 구별할 수 없다.
 */
export function moveFocus(
  ids: readonly string[],
  current: string | undefined,
  delta: number,
): string | undefined {
  if (ids.length === 0) return undefined;
  const at = current === undefined ? -1 : ids.indexOf(current);
  if (at < 0) return ids[0];
  const size = ids.length;
  // 나머지 연산이 음수를 내지 않게 한 번 더 더한다 — 왼쪽으로 감기는 자리다
  const next = (((at + delta) % size) + size) % size;
  return ids[next];
}

/**
 * 여러 줄로 놓인 것들 사이의 이동 — 위아래는 한 줄만큼 건너뛴다.
 *
 * `columns` 는 **그리는 쪽의 결정**이며 계약에서 오지 않는다. 몇 줄로 놓든 목록의
 * 순서는 하나이므로, 위아래 이동은 그 순서 위에서 columns 만큼 건너뛰는 일이 된다.
 *
 * 위아래는 감기지 않는다. 목록의 길이가 columns 의 배수가 아닐 때 감으면 마지막 줄의
 * 빈 자리를 지나며 초점이 어디로 갈지 예측할 수 없어진다 — 대신 양 끝에서 멈춘다.
 */
export function moveFocusGrid(
  ids: readonly string[],
  current: string | undefined,
  columns: number,
  step: { readonly dx?: number; readonly dy?: number },
): string | undefined {
  if (ids.length === 0) return undefined;
  const at = current === undefined ? -1 : ids.indexOf(current);
  if (at < 0) return ids[0];

  const dy = step.dy ?? 0;
  if (dy !== 0) {
    const width = Math.max(1, Math.floor(columns));
    const moved = at + dy * width;
    // 양 끝에서는 멈춘다 — 감으면 마지막 줄의 빈 자리 때문에 자리가 예측되지 않는다
    if (moved < 0 || moved >= ids.length) return ids[at];
    return ids[moved];
  }

  return moveFocus(ids, current, step.dx ?? 0);
}
