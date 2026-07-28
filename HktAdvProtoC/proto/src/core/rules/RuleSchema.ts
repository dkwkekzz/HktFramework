// 규칙 DSL 스키마와 로더 (Phase-2 §2.1 · 구현 스텝 1)
//
// 두 가지를 담는다.
//  ① RULE_JSON_SCHEMA — 정규형 RuleDefinition 의 JSON Schema. Phase 5 규칙 생성기의 출력 계약이자
//     §34 스키마 검증의 입력이다. 여기 없는 필드는 규칙에 쓸 수 없다.
//  ② loadRuleDocument — §12 축약형(`when/if/then`)과 §11.4 표기를 정규형으로 옮기는 로더.
//     실행기(RuleEngine)는 정규형 하나만 안다.
import type { ObservationEffect } from "../world/types";
import type {
  RuleCondition,
  RuleDefinition,
  RuleEffect,
  RuleTargetQuery,
  RuleTargetSelector,
  RuleTrigger,
  RuleValue,
} from "./RuleTypes";

// --- ① JSON Schema ------------------------------------------------------------

const VALUE_REF = { $ref: "#/$defs/value" } as const;

export const RULE_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "hkt-adv-proto-c/rule-definition",
  type: "object",
  required: ["id", "name", "scope", "priority", "triggers", "conditions", "effects"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    scope: { enum: ["global", "region", "entity", "relationship"] },
    priority: { type: "number" },
    /** §28 사건 탐지가 읽는 의미 태그 (Phase-4 §4.1) */
    tags: { type: "array", items: { type: "string" } },
    triggers: { type: "array", items: { $ref: "#/$defs/trigger" } },
    forEach: { $ref: "#/$defs/selector" },
    bindings: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "value"],
        additionalProperties: false,
        properties: { name: { type: "string" }, value: VALUE_REF },
      },
    },
    conditions: { type: "array", items: { $ref: "#/$defs/condition" } },
    effects: { type: "array", items: { $ref: "#/$defs/effect" } },
    observations: { type: "array", items: { $ref: "#/$defs/observation" } },
    cooldown: { type: "number", minimum: 0 },
    derivedFromAxioms: { type: "array", items: { type: "string" } },
  },
  $defs: {
    binding: { enum: ["actor", "target", "each"] },
    trigger: {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: {
          enum: [
            "state_changed",
            "interval",
            "action_executed",
            "entity_entered",
            "relationship_changed",
          ],
        },
        stateKey: { type: "string" },
        interval: { type: "number", minimum: 1 },
        actionId: { type: "string" },
        locationTag: { type: "string" },
        relationshipKey: { type: "string" },
      },
    },
    query: {
      type: "object",
      additionalProperties: false,
      properties: {
        tags: { type: "array", items: { type: "string" } },
        entityType: { enum: ["agent", "resource", "location", "faction"] },
        ownerType: {
          enum: ["world", "region", "location", "species", "faction", "agent", "relationship", "resource"],
        },
        withinRadius: {
          type: "object",
          required: ["of", "r"],
          additionalProperties: false,
          properties: { of: { type: "string" }, r: { type: "number" } },
        },
        where: { type: "array", items: { $ref: "#/$defs/condition" } },
        limit: { type: "number", minimum: 1 },
      },
    },
    selector: {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: { enum: ["actor", "target", "each", "world", "entity", "query"] },
        entityId: { type: "string" },
        query: { $ref: "#/$defs/query" },
      },
    },
    value: {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: {
          enum: [
            "constant",
            "actor_state",
            "target_state",
            "each_state",
            "world_state",
            "entity_state",
            "event_payload",
            "path",
            "entity_ref",
            "entity_type",
            "binding",
            "distance",
            "random",
            "random_int",
            "query_value",
            "expr",
          ],
        },
        value: {},
        key: { type: "string" },
        entityId: { type: "string" },
        path: { type: "string" },
        of: { $ref: "#/$defs/binding" },
        name: { type: "string" },
        from: { $ref: "#/$defs/binding" },
        to: { $ref: "#/$defs/binding" },
        stream: { $ref: "#/$defs/binding" },
        max: { type: "number" },
        query: { $ref: "#/$defs/query" },
        aggregate: { enum: ["first", "count", "sum", "min", "max"] },
        op: {
          enum: ["add", "sub", "mul", "div", "neg", "min", "max", "floor", "ceil", "round", "abs"],
        },
        operands: { type: "array", items: VALUE_REF },
      },
    },
    condition: {
      type: "object",
      required: ["left", "operator", "right"],
      additionalProperties: false,
      properties: {
        left: VALUE_REF,
        operator: { enum: [">", ">=", "<", "<=", "==", "!=", "contains"] },
        right: VALUE_REF,
      },
    },
    effect: {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: {
          enum: [
            "modify_state",
            "transfer_resource",
            "create_entity",
            "destroy_entity",
            "emit_signal",
            "schedule_rule",
            "modify_relationship",
          ],
        },
        conditions: { type: "array", items: { $ref: "#/$defs/condition" } },
        chance: { type: "number", minimum: 0 },
        target: { $ref: "#/$defs/selector" },
        stateKey: { type: "string" },
        operation: { enum: ["set", "add", "multiply"] },
        value: {},
        valueRef: VALUE_REF,
        resourceId: { type: "string" },
        from: { $ref: "#/$defs/selector" },
        to: { $ref: "#/$defs/selector" },
        amount: { type: "number" },
        amountRef: VALUE_REF,
        fromStateKey: { type: "string" },
        toStateKey: { type: "string" },
        templateId: { type: "string" },
        location: { $ref: "#/$defs/selector" },
        signalId: { type: "string" },
        intensity: { type: "number" },
        ruleId: { type: "string" },
        delay: { type: "number" },
        key: { type: "string" },
      },
    },
    observation: {
      type: "object",
      required: ["signalId", "channels", "strength", "tags"],
      additionalProperties: false,
      properties: {
        signalId: { type: "string" },
        channels: { type: "array", items: { type: "string" } },
        strength: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        origin: { enum: ["actor", "target"] },
        claim: {
          type: "object",
          required: ["subject", "stateKey"],
          additionalProperties: false,
          properties: {
            subject: { enum: ["actor", "target", "entity"] },
            entityId: { type: "string" },
            stateKey: { type: "string" },
            value: {},
            confidence: { type: "number" },
            observerStateKey: { type: "string" },
            /** 전달자의 믿음을 그대로 옮긴다 (§23 소문·보고) — value/confidence 는 쓰이지 않는다 */
            relayBelief: { type: "boolean" },
          },
        },
      },
    },
  },
} as const;

// --- JSON Schema 검사기 (draft-07 부분집합) -------------------------------------
// 외부 의존을 늘리지 않으려고 필요한 키워드만 직접 구현한다:
// type / enum / required / properties / additionalProperties / items / minimum / $ref.

type Schema = Record<string, unknown>;

function resolveRef(root: Schema, ref: string): Schema {
  const path = ref.replace(/^#\//, "").split("/");
  let node: unknown = root;
  for (const segment of path) node = (node as Record<string, unknown>)[segment];
  if (node === undefined) throw new Error(`풀 수 없는 $ref: ${ref}`);
  return node as Schema;
}

function typeMatches(type: string, value: unknown): boolean {
  switch (type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      return true;
  }
}

export function validateAgainstSchema(
  value: unknown,
  schema: Schema = RULE_JSON_SCHEMA as unknown as Schema,
  root: Schema = RULE_JSON_SCHEMA as unknown as Schema,
  where = "$",
): string[] {
  const errors: string[] = [];
  if (typeof schema["$ref"] === "string") {
    return validateAgainstSchema(value, resolveRef(root, schema["$ref"]), root, where);
  }
  if (typeof schema["type"] === "string" && !typeMatches(schema["type"], value)) {
    return [`${where}: ${String(schema["type"])} 가 아니다 (${JSON.stringify(value)})`];
  }
  if (Array.isArray(schema["enum"]) && !schema["enum"].includes(value as never)) {
    return [`${where}: 허용되지 않은 값 ${JSON.stringify(value)} (허용: ${schema["enum"].join(", ")})`];
  }
  if (typeof schema["minimum"] === "number" && typeof value === "number" && value < schema["minimum"]) {
    errors.push(`${where}: ${value} 는 최소값 ${schema["minimum"]} 미만이다`);
  }

  if (Array.isArray(value) && schema["items"] !== undefined) {
    value.forEach((item, i) => {
      errors.push(...validateAgainstSchema(item, schema["items"] as Schema, root, `${where}[${i}]`));
    });
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const properties = (schema["properties"] ?? {}) as Record<string, Schema>;
    for (const key of (schema["required"] ?? []) as string[]) {
      if (record[key] === undefined) errors.push(`${where}: 필수 항목 누락 — ${key}`);
    }
    for (const [key, child] of Object.entries(record)) {
      const childSchema = properties[key];
      if (childSchema === undefined) {
        if (schema["additionalProperties"] === false) {
          errors.push(`${where}: 알 수 없는 항목 — ${key}`);
        }
        continue;
      }
      errors.push(...validateAgainstSchema(child, childSchema, root, `${where}.${key}`));
    }
  }
  return errors;
}

// --- ② 로더 (축약형 → 정규형) ---------------------------------------------------

type Json = Record<string, unknown>;

function asRecord(value: unknown, where: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where}: 객체가 아니다`);
  }
  return value as Json;
}

/** §12 `entities[tag=plant]` → { tags: ["plant"] } */
export function parseQueryExpression(expression: string): RuleTargetQuery {
  const match = /^entities\[(.*)\]$/.exec(expression.trim());
  if (match === null) throw new Error(`알 수 없는 대상 표현식: ${expression}`);
  const query: RuleTargetQuery = {};
  for (const clause of match[1]!.split(",").map((part) => part.trim()).filter(Boolean)) {
    const [rawKey, rawValue] = clause.split("=").map((part) => part.trim());
    if (rawKey === undefined || rawValue === undefined) {
      throw new Error(`알 수 없는 대상 표현식 절: ${clause}`);
    }
    switch (rawKey) {
      case "tag":
        query.tags = [...(query.tags ?? []), rawValue];
        break;
      case "type":
        query.entityType = rawValue as NonNullable<RuleTargetQuery["entityType"]>;
        break;
      case "limit":
        query.limit = Number(rawValue);
        break;
      default:
        throw new Error(`알 수 없는 대상 표현식 키: ${rawKey}`);
    }
  }
  return query;
}

/** 효과의 대상 경로 `states.health` → 상태 키 `health` */
function stateKeyOfPath(path: string): string {
  return path.startsWith("states.") ? path.slice("states.".length) : path;
}

function literalValue(value: unknown): RuleValue {
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return { type: "constant", value };
  }
  throw new Error(`상수로 쓸 수 없는 값: ${JSON.stringify(value)}`);
}

/** §12 `when` → 트리거. `region.temperature.changed` 처럼 마지막 마디가 이벤트 종류다. */
function normalizeWhen(when: Json): RuleTrigger[] {
  if (typeof when["event"] === "string") {
    const event = when["event"];
    if (!event.endsWith(".changed")) throw new Error(`알 수 없는 when.event: ${event}`);
    const path = event.slice(0, -".changed".length);
    const stateKey = path.slice(path.lastIndexOf(".") + 1);
    return [{ type: "state_changed", stateKey }];
  }
  if (typeof when["interval"] === "number") {
    return [{ type: "interval", interval: when["interval"] }];
  }
  if (typeof when["action"] === "string") {
    return [{ type: "action_executed", actionId: when["action"] }];
  }
  if (typeof when["entered"] === "string") {
    return [{ type: "entity_entered", locationTag: when["entered"] }];
  }
  if (typeof when["relationship"] === "string") {
    return [{ type: "relationship_changed", relationshipKey: when["relationship"] }];
  }
  throw new Error(`알 수 없는 when: ${JSON.stringify(when)}`);
}

/** §12 `if` 절 → RuleCondition */
function normalizeIf(entry: Json): RuleCondition {
  if (entry["left"] !== undefined) return entry as unknown as RuleCondition;
  const path = entry["path"];
  if (typeof path !== "string") throw new Error(`if 절에 path 가 없다: ${JSON.stringify(entry)}`);
  const operator = (entry["operator"] ?? "==") as RuleCondition["operator"];
  return { left: { type: "path", path }, operator, right: literalValue(entry["value"]) };
}

/** §12 `then` 절 → RuleEffect */
function normalizeThen(entry: Json): RuleEffect {
  if (typeof entry["type"] === "string") return entry as unknown as RuleEffect;
  const effect = entry["effect"];
  if (effect === "emit") {
    const signal = entry["signal"];
    if (typeof signal !== "string") throw new Error("emit 효과에 signal 이 없다");
    return {
      type: "emit_signal",
      signalId: signal,
      ...(typeof entry["strength"] === "number" ? { intensity: entry["strength"] } : {}),
    };
  }
  if (effect === "add" || effect === "multiply" || effect === "set") {
    const path = entry["path"];
    if (typeof path !== "string") throw new Error(`${effect} 효과에 path 가 없다`);
    const query = entry["targetQuery"];
    const target: RuleTargetSelector =
      typeof query === "string"
        ? { type: "query", query: parseQueryExpression(query) }
        : ((entry["target"] as RuleTargetSelector | undefined) ?? { type: "actor" });
    return {
      type: "modify_state",
      target,
      stateKey: stateKeyOfPath(path),
      operation: effect,
      value: entry["value"] as number | boolean | string,
    };
  }
  throw new Error(`알 수 없는 then 효과: ${JSON.stringify(entry)}`);
}

/** §11.4 표기 `{channel, signal, strength}` 를 ObservationEffect 로 옮긴다 */
function normalizeObservation(entry: Json): ObservationEffect {
  if (typeof entry["signalId"] === "string") return entry as unknown as ObservationEffect;
  const signal = entry["signal"];
  const channel = entry["channel"];
  if (typeof signal !== "string" || typeof channel !== "string") {
    throw new Error(`알 수 없는 observation: ${JSON.stringify(entry)}`);
  }
  return {
    signalId: signal,
    channels: [channel as ObservationEffect["channels"][number]],
    strength: typeof entry["strength"] === "number" ? entry["strength"] : 0,
    tags: (entry["tags"] as string[] | undefined) ?? [],
  };
}

/**
 * 규칙 문서 한 건을 정규형으로 읽는다.
 * 축약형·정규형·§11.4 표기를 모두 받아들이고, 스키마를 통과하지 못하면 예외를 던진다.
 */
/** 정규형 필드 + §12 축약형 별칭. 여기 없는 이름은 오타로 본다(조용히 무시하지 않는다). */
const DOCUMENT_KEYS = new Set([
  ...Object.keys(RULE_JSON_SCHEMA.properties),
  "when",
  "if",
  "then",
]);

export function loadRuleDocument(document: unknown): RuleDefinition {
  const doc = asRecord(document, "규칙 문서");
  const id = typeof doc["id"] === "string" ? doc["id"] : "(id 없음)";

  const unknownKeys = Object.keys(doc).filter((key) => !DOCUMENT_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`규칙 스키마 위반 — ${id}\n$: 알 수 없는 항목 — ${unknownKeys.join(", ")}`);
  }

  const triggers =
    doc["when"] !== undefined
      ? normalizeWhen(asRecord(doc["when"], `${id}.when`))
      : ((doc["triggers"] as RuleTrigger[] | undefined) ?? []);

  const conditions = (((doc["if"] ?? doc["conditions"]) as unknown[] | undefined) ?? []).map(
    (entry, i) => normalizeIf(asRecord(entry, `${id}.conditions[${i}]`)),
  );

  const effects = (((doc["then"] ?? doc["effects"]) as unknown[] | undefined) ?? []).map((entry, i) =>
    normalizeThen(asRecord(entry, `${id}.effects[${i}]`)),
  );

  const observations = ((doc["observations"] as unknown[] | undefined) ?? []).map((entry, i) =>
    normalizeObservation(asRecord(entry, `${id}.observations[${i}]`)),
  );

  const rule: RuleDefinition = {
    id,
    name: typeof doc["name"] === "string" ? doc["name"] : id,
    scope: (doc["scope"] as RuleDefinition["scope"] | undefined) ?? "global",
    priority: typeof doc["priority"] === "number" ? doc["priority"] : 50,
    triggers,
    conditions,
    effects,
    observations,
    derivedFromAxioms: (doc["derivedFromAxioms"] as string[] | undefined) ?? [],
    ...(doc["tags"] !== undefined ? { tags: doc["tags"] as string[] } : {}),
    ...(doc["forEach"] !== undefined ? { forEach: doc["forEach"] as RuleTargetSelector } : {}),
    ...(doc["bindings"] !== undefined
      ? { bindings: doc["bindings"] as NonNullable<RuleDefinition["bindings"]> }
      : {}),
    ...(typeof doc["cooldown"] === "number" ? { cooldown: doc["cooldown"] } : {}),
  };

  const errors = validateAgainstSchema(rule);
  if (errors.length > 0) {
    throw new Error(`규칙 스키마 위반 — ${id}\n${errors.join("\n")}`);
  }
  // 트리거가 비어 있는 규칙은 schedule_rule(§11.3) 로만 깨어난다.
  // "아무도 깨우지 않는 규칙"인지는 세계 전체를 봐야 알 수 있으므로 WorldValidation 이 판정한다.
  return rule;
}

export function loadRuleDocuments(documents: unknown[]): RuleDefinition[] {
  return documents.map(loadRuleDocument);
}
