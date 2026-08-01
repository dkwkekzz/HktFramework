// V1 State Hash — 임의의 세계 상태를 하나의 문자열로 환원한다.
// 리플레이 동일성 판정(같은 시드 → 같은 해시)의 근거이며,
// "모든 개념은 직렬화 가능한 데이터" (WORKFLOW §6-1) 를 런타임에서 강제하는 지점이기도 하다.

/** 상태 해시 — FNV-1a 64bit 16자리 소문자 hex. */
export type StateHash = string;

const FNV_OFFSET_64 = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME_64 = 0x0000_0100_0000_01b3n;
const MASK_64 = 0xffff_ffff_ffff_ffffn;

const encoder = new TextEncoder();

function pathToString(path: readonly string[]): string {
  return path.length === 0 ? '$' : `$.${path.join('.')}`;
}

function canonicalizeValue(
  value: unknown,
  path: string[],
  seen: Set<object>,
  out: string[],
): void {
  if (value === null) {
    out.push('null');
    return;
  }

  switch (typeof value) {
    case 'boolean':
      out.push(value ? 'true' : 'false');
      return;

    case 'number': {
      if (!Number.isFinite(value)) {
        throw new TypeError(
          `상태 원소는 유한한 수여야 한다 (${pathToString(path)} = ${String(value)})`,
        );
      }
      // -0 과 0 은 같은 상태로 본다 — 부호만 다른 해시가 생기지 않게 정규화한다.
      out.push(Object.is(value, -0) ? '0' : String(value));
      return;
    }

    case 'string':
      out.push(JSON.stringify(value));
      return;

    case 'undefined':
      // 배열 원소 자리의 undefined 만 여기에 닿는다 (객체 키는 아래에서 제외됨).
      out.push('null');
      return;

    case 'object':
      break;

    default:
      throw new TypeError(
        `상태 원소는 JSON 직렬화 가능해야 한다 — ${typeof value} 는 불가 (${pathToString(path)})`,
      );
  }

  const object = value as object;
  if (seen.has(object)) {
    throw new TypeError(`상태에 순환 참조가 있다 (${pathToString(path)})`);
  }
  seen.add(object);

  if (Array.isArray(object)) {
    out.push('[');
    object.forEach((item, index) => {
      if (index > 0) out.push(',');
      path.push(String(index));
      canonicalizeValue(item, path, seen, out);
      path.pop();
    });
    out.push(']');
  } else {
    const prototype = Object.getPrototypeOf(object) as object | null;
    if (prototype !== null && prototype !== Object.prototype) {
      throw new TypeError(
        `상태 원소는 평범한 객체·배열만 허용한다 — ${object.constructor?.name ?? '알 수 없는 타입'} 은 불가 (${pathToString(path)})`,
      );
    }
    // 키 순서에 해시가 흔들리지 않도록 코드포인트 순으로 고정한다.
    const keys = Object.keys(object as Record<string, unknown>).sort();
    out.push('{');
    let first = true;
    for (const key of keys) {
      const child = (object as Record<string, unknown>)[key];
      if (child === undefined) continue; // 없는 값과 undefined 를 같게 본다.
      if (!first) out.push(',');
      first = false;
      out.push(JSON.stringify(key), ':');
      path.push(key);
      canonicalizeValue(child, path, seen, out);
      path.pop();
    }
    out.push('}');
  }

  seen.delete(object);
}

/**
 * 상태를 정규 문자열로 만든다 — 객체 키 순서·-0·undefined 차이를 흡수한다.
 * 해시가 달라졌을 때 무엇이 달라졌는지 눈으로 비교하는 용도로도 쓴다 (diff 렌더러).
 */
export function canonicalize(value: unknown): string {
  const out: string[] = [];
  canonicalizeValue(value, [], new Set<object>(), out);
  return out.join('');
}

/**
 * 눈사태 마무리 (32bit).
 * FNV-1a 만으로는 끝 한 글자만 다른 입력이 거의 같은 해시가 된다 — ID 가 눈으로 구분되지 않고
 * 상위 비트를 잘라 쓸 때 충돌이 몰린다. 마지막에 비트를 섞어 한 글자 차이가 전 비트에 퍼지게 한다.
 */
function avalanche32(input: number): number {
  let h = input;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85eb_ca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2_ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 눈사태 마무리 (64bit, splitmix64 finalizer). */
function avalanche64(input: bigint): bigint {
  let h = input;
  h = ((h ^ (h >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & MASK_64;
  h = ((h ^ (h >> 27n)) * 0x94d0_49bb_1331_11ebn) & MASK_64;
  return (h ^ (h >> 31n)) & MASK_64;
}

/** 문자열 → uint32 해시 (시드 정규화·결정적 ID 의 재료). */
export function hashString(text: string): number {
  let h = 0x811c_9dc5;
  const bytes = encoder.encode(text);
  for (const byte of bytes) {
    h ^= byte;
    // FNV prime 곱을 32bit 안에서 수행 (Math.imul 로 오버플로 정의를 고정).
    h = Math.imul(h, 0x0100_0193);
  }
  return avalanche32(h);
}

/** 상태 해시 — 같은 상태면 같은 문자열, 다른 상태면 (사실상) 다른 문자열. */
export function stateHash(value: unknown): StateHash {
  const bytes = encoder.encode(canonicalize(value));
  let h = FNV_OFFSET_64;
  for (const byte of bytes) {
    h = ((h ^ BigInt(byte)) * FNV_PRIME_64) & MASK_64;
  }
  return avalanche64(h).toString(16).padStart(16, '0');
}

/** 두 상태가 같은 상태인지 — 해시 동일성으로 판정한다. */
export function sameState(left: unknown, right: unknown): boolean {
  return stateHash(left) === stateHash(right);
}
