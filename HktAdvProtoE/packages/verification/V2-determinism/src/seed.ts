import { sha256Hex } from '@hkt/v0-module-contract';

/**
 * 시드 구성 — [Design-MMO.md](../../../../design/Design-MMO.md) 29장의 조합 규칙을 그대로 따른다.
 *
 * ```text
 * worldSeed + currentTick + subjectId + decisionCounter + situationId
 * ```
 *
 * 빠진 항목과 빈 문자열을 구분한다 (`undefined` → null, `''` → 빈 문자열). 두 경우가 같은 시드를 내면
 * "구성요소를 하나 바꾸면 열이 달라진다"는 보장이 깨진다.
 */
export interface SeedComponents {
  /** 세계 하나의 뿌리 시드. 이것만 필수다. */
  worldSeed: bigint;
  /** 현재 틱 */
  tick?: number;
  /** 주체 id */
  subjectId?: string;
  /** 같은 틱 안에서 같은 주체가 여러 번 결정할 때의 순번 */
  decisionCounter?: number;
  /** 상황 id */
  situationId?: string;
}

const MASK64 = (1n << 64n) - 1n;

/** 조합 규칙의 정규 표기 — 해시 입력이자, 사람이 읽는 설명이다. */
export function seedLabel(components: SeedComponents): string {
  return JSON.stringify([
    components.worldSeed.toString(),
    components.tick ?? null,
    components.subjectId ?? null,
    components.decisionCounter ?? null,
    components.situationId ?? null,
  ]);
}

/** 구성요소를 64비트 시드 하나로 접는다. 같은 구성 → 같은 시드. */
export function deriveSeed(components: SeedComponents): bigint {
  return BigInt(`0x${sha256Hex(seedLabel(components)).slice(0, 16)}`) & MASK64;
}

/**
 * 이름표로 하위 시드를 만든다.
 *
 * 소비자(스트림)를 새로 추가해도 기존 소비자의 열이 흔들리지 않게 하는 것이 목적이다 —
 * 하나의 열을 여럿이 나눠 쓰면 소비 순서가 바뀔 때 리플레이가 깨진다(GI-12).
 */
export function deriveChildSeed(parentSeed: bigint, label: string): bigint {
  return BigInt(`0x${sha256Hex(`${(parentSeed & MASK64).toString(16)}/${label}`).slice(0, 16)}`) & MASK64;
}

export { MASK64 };
