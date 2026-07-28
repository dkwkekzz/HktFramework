// 상태 스키마 등록기 (기획서 §9, Phase-1 §1.1)
// "세계 상태는 임의의 문자열로 저장하지 않는다" — 등록되지 않은 stateKey 는 읽기도 쓰기도 오류다.
import type { StateOwnerType, StateSchema } from "./types";

/** 파생 상태 계산식 (§9 updatePolicy="derived") — 다른 상태들의 함수이며 쓰기는 금지된다 */
export type DerivedFormula = (read: (stateKey: string) => unknown) => unknown;

function num(read: (k: string) => unknown, key: string): number {
  const value = read(key);
  return typeof value === "number" ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Phase 1 의 파생 상태.
 * §26 shouldReplan 이 읽는 survivalPressure/stress 를 개별 규칙이 각자 갱신하면 정합이 깨지므로
 * 원천 상태(허기·체력·공포)의 함수로 고정한다.
 */
export const DERIVED_FORMULAS: Record<string, DerivedFormula> = {
  // 생존 압력: 굶주릴수록, 체력이 낮을수록 높다 (§8 생존 압력)
  survivalPressure: (read) =>
    clamp(num(read, "hunger") * 0.6 + (100 - num(read, "health")) * 0.4, 0, 100),
  // 스트레스: 공포와 생존 압력의 합성 (§26 stress > 85 → 재판단)
  stress: (read) =>
    clamp(num(read, "fear") * 0.6 + num(read, "survivalPressure") * 0.4, 0, 100),
  /**
   * 조직의 위기 (§17 requiredStates / §26 재판단 조건의 조직판).
   * 조직에게 굶주림은 없다 — 비축이 마르고, 두려움과 위협 믿음이 커지는 것이 조직의 생존 압력이다.
   */
  crisis: (read) =>
    clamp(
      (100 - Math.min(100, num(read, "food_reserve"))) * 0.5 +
        num(read, "fear") * 0.3 +
        num(read, "threat_belief") * 0.2,
      0,
      100,
    ),
};

const MAX_DERIVED_DEPTH = 8;

export class StateSchemaRegistry {
  private readonly byKey = new Map<string, StateSchema>();
  private readonly derived = new Map<string, DerivedFormula>();

  constructor(schemas: StateSchema[], derivedFormulas: Record<string, DerivedFormula> = DERIVED_FORMULAS) {
    for (const schema of schemas) {
      const key = `${schema.ownerType}.${schema.id}`;
      if (this.byKey.has(key)) throw new Error(`상태 스키마 중복 등록: ${key}`);
      this.byKey.set(key, schema);
      if (schema.updatePolicy === "derived") {
        const formula = derivedFormulas[schema.id];
        if (formula === undefined) {
          throw new Error(`파생 상태 계산식 없음: ${key} (updatePolicy=derived)`);
        }
        this.derived.set(key, formula);
      }
    }
  }

  find(ownerType: StateOwnerType, stateKey: string): StateSchema | undefined {
    return this.byKey.get(`${ownerType}.${stateKey}`);
  }

  require(ownerType: StateOwnerType, stateKey: string): StateSchema {
    const schema = this.find(ownerType, stateKey);
    if (schema === undefined) {
      throw new Error(`등록되지 않은 상태: ${ownerType}.${stateKey} (§9 스키마 검증)`);
    }
    return schema;
  }

  isDerived(ownerType: StateOwnerType, stateKey: string): boolean {
    return this.derived.has(`${ownerType}.${stateKey}`);
  }

  /** 파생 상태를 읽기 시점에 계산한다. 파생이 파생을 참조할 수 있어 깊이를 제한한다. */
  computeDerived(
    ownerType: StateOwnerType,
    stateKey: string,
    read: (key: string) => unknown,
    depth = 0,
  ): unknown {
    const formula = this.derived.get(`${ownerType}.${stateKey}`);
    if (formula === undefined) throw new Error(`파생 상태 아님: ${ownerType}.${stateKey}`);
    if (depth > MAX_DERIVED_DEPTH) throw new Error(`파생 상태 순환 참조: ${ownerType}.${stateKey}`);
    return formula((key) =>
      this.isDerived(ownerType, key) ? this.computeDerived(ownerType, key, read, depth + 1) : read(key),
    );
  }

  /** §9 dataType/min/max 검증. 범위 초과는 경계로 고정(clamp), 타입 불일치는 오류. */
  coerce(schema: StateSchema, value: unknown): unknown {
    switch (schema.dataType) {
      case "number": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new Error(`상태 타입 불일치: ${schema.ownerType}.${schema.id} 는 number (${String(value)})`);
        }
        const min = schema.min ?? Number.NEGATIVE_INFINITY;
        const max = schema.max ?? Number.POSITIVE_INFINITY;
        return clamp(value, min, max);
      }
      case "boolean":
        if (typeof value !== "boolean") {
          throw new Error(`상태 타입 불일치: ${schema.ownerType}.${schema.id} 는 boolean`);
        }
        return value;
      case "string":
      case "enum":
        if (typeof value !== "string") {
          throw new Error(`상태 타입 불일치: ${schema.ownerType}.${schema.id} 는 string`);
        }
        return value;
      case "set":
        if (!Array.isArray(value)) {
          throw new Error(`상태 타입 불일치: ${schema.ownerType}.${schema.id} 는 set(배열)`);
        }
        return value;
      case "map":
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new Error(`상태 타입 불일치: ${schema.ownerType}.${schema.id} 는 map(객체)`);
        }
        return value;
    }
  }

  /** 소유자 종류별 기본값 묶음 — 개체 생성 시 등록된 상태를 빠짐없이 채운다 */
  defaultsFor(ownerType: StateOwnerType): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const schema of this.byKey.values()) {
      // 파생 상태는 저장하지 않는다 — 읽기 시점 계산이다
      if (schema.ownerType === ownerType && schema.updatePolicy !== "derived") {
        defaults[schema.id] = structuredClone(schema.defaultValue);
      }
    }
    return defaults;
  }

  all(): StateSchema[] {
    return [...this.byKey.values()];
  }
}
