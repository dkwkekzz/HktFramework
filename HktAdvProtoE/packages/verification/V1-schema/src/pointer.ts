/** RFC 6901 JSON Pointer 유틸 — 오류가 데이터·스키마의 정확한 위치를 가리키게 하는 근거다. */

/** 토큰 하나를 이스케이프한다 (`~` → `~0`, `/` → `~1`). */
export function escapeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function unescapeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** 부모 포인터에 토큰을 하나 잇는다. 숫자 인덱스도 그대로 받는다. */
export function join(pointer: string, token: string | number): string {
  return `${pointer}/${escapeToken(String(token))}`;
}

/** 포인터를 토큰 배열로 나눈다. 빈 문자열은 루트를 뜻한다. */
export function parse(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`JSON Pointer 는 '/' 로 시작해야 한다: ${pointer}`);
  }
  return pointer.slice(1).split('/').map(unescapeToken);
}

/** 포인터가 가리키는 값을 꺼낸다. 없으면 undefined. */
export function resolve(root: unknown, pointer: string): unknown {
  let current: unknown = root;
  for (const token of parse(pointer)) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    if (current !== null && typeof current === 'object') {
      const record = current as Record<string, unknown>;
      if (!(token in record)) return undefined;
      current = record[token];
      continue;
    }
    return undefined;
  }
  return current;
}

/** 사람이 읽는 표기 — 루트는 `/` 로 보여 준다. */
export function display(pointer: string): string {
  return pointer === '' ? '/' : pointer;
}
