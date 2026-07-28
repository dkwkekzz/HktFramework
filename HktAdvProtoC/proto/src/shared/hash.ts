// 상태 해시 — 결정론 검증(DoD "동일 시드 → 동일 상태 해시")용.
// 키 순서에 무관하도록 정렬 직렬화 후 FNV-1a.

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",");
  return `{${body}}`;
}

export function fnv1aHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function hashValue(value: unknown): string {
  return fnv1aHex(stableStringify(value));
}
