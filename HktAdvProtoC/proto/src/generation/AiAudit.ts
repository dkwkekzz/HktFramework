// AI 보조 정합성 검사 (기획서 §33.2 / Phase-6 §6.1-c)
//
// 기계가 판정하기 어려운 다섯 가지를 생성 AI 에게 되묻는다:
// 명제를 위반하는 규칙 / 이유 없는 자원 / 목적 없는 조직 / 대가 없는 강한 능력 / 고립된 설정.
//
// 두 가지 규약을 지킨다.
//  ① **AI 판단은 warning 이다.** error 로 승격하지 않는다 — 최종 게이트는 기계 검증(§34)과 §35 지표뿐이다.
//  ② **꺼져 있어도 파이프라인은 완결된다.** 포트가 없으면 skipped 로 남기고 그대로 통과한다(오프라인 원칙).
import type { WorldDefinition } from "../core/world/types";
import type { ValidationIssue } from "./CompilerPipeline";
import {
  createTelemetry,
  generateChecked,
  type GenerationTelemetry,
  type JsonSchema,
  type StructuredInput,
  type TextGenerationPort,
} from "./TextGenerationPort";

export const AUDIT_CODES = [
  "audit.axiom-violation",
  "audit.purposeless-resource",
  "audit.purposeless-faction",
  "audit.costless-ability",
  "audit.isolated-setting",
] as const;

export type AuditCode = (typeof AUDIT_CODES)[number];

export interface AuditFinding {
  targetId: string;
  reason: string;
}

export interface AuditCheck {
  code: AuditCode;
  taskId: string;
  question: string;
  /** 물어본 대상 수 */
  asked: number;
  findings: AuditFinding[];
  skipped: boolean;
  error?: string;
}

export interface AuditReport {
  enabled: boolean;
  checks: AuditCheck[];
  /** 전부 warning — §34 게이트를 막지 않는다 */
  issues: ValidationIssue[];
}

const FINDINGS_SCHEMA: JsonSchema = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["targetId", "reason"],
        additionalProperties: false,
        properties: { targetId: { type: "string" }, reason: { type: "string" } },
      },
    },
  },
};

const AUDIT_PROMPT = [
  "너는 세계 정합성 검토자다. 생성된 세계의 한 측면만 보고 '말이 되지 않는 것'을 찾는다(§33.2).",
  "찾은 것만 findings 에 담는다. 억지로 채우지 않는다 — 문제가 없으면 빈 배열이 정답이다.",
  "각 findings 항목은 반드시 입력에 있는 id 를 가리키고, 이유는 한 문장으로 쓴다.",
].join("\n");

interface AuditSpec {
  code: AuditCode;
  taskId: string;
  question: string;
  build(definition: WorldDefinition): { input: StructuredInput; asked: number };
}

/** 입력은 구조화 요약만 담는다 (§33 "월드 상태 전체를 매번 전달하지 않는다") */
const SPECS: AuditSpec[] = [
  {
    code: "audit.axiom-violation",
    taskId: "audit/axiom_violation",
    question: "세계 명제를 위반하는 규칙이 있는가",
    build(definition) {
      const rules = definition.ruleDefinitions.map((rule) => ({
        id: rule.id,
        name: rule.name,
        tags: rule.tags ?? [],
        fromAxioms: rule.derivedFromAxioms ?? [],
      }));
      return {
        input: {
          axioms: definition.axioms.map((axiom) => ({ id: axiom.id, statement: axiom.statement, category: axiom.category })),
          rules,
        },
        asked: rules.length,
      };
    },
  },
  {
    code: "audit.purposeless-resource",
    taskId: "audit/purposeless_resource",
    question: "이유 없이 존재하는 자원이 있는가",
    build(definition) {
      const resources = definition.resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        tags: resource.tags,
        producedBy: resource.productionRules.length,
        consumedBy: resource.consumptionRules.length,
        desiredBy: resource.desiredBy.map((entry) => entry.agentTag),
      }));
      return { input: { resources }, asked: resources.length };
    },
  },
  {
    code: "audit.purposeless-faction",
    taskId: "audit/purposeless_faction",
    question: "목적 없는 조직이 있는가",
    build(definition) {
      const factions = definition.factions.map((faction) => ({
        id: faction.id,
        name: faction.name,
        publicPurpose: faction.publicPurpose,
        hiddenPurposes: faction.hiddenPurposes,
        controls: faction.controlledResources,
        internalGroups: (faction.internalGroups ?? []).map((group) => `${group.id}(${group.stance})`),
      }));
      return { input: { factions }, asked: factions.length };
    },
  },
  {
    code: "audit.costless-ability",
    taskId: "audit/costless_ability",
    question: "대가 없이 강한 능력이 있는가",
    build(definition) {
      const abilities = (definition.abilitySystem?.abilities ?? []).map((ability) => ({
        id: ability.id,
        purpose: ability.purpose,
        output: ability.outputRange.max,
        restrictions: ability.restrictions.map((restriction) => `${restriction.description}(${restriction.severity})`),
        costs: ability.costs.map((cost) => `${cost.stateKey}:${cost.amount}`),
        backlash: ability.failureEffects.length,
      }));
      return { input: { abilities }, asked: abilities.length };
    },
  },
  {
    code: "audit.isolated-setting",
    taskId: "audit/isolated_setting",
    question: "다른 요소와 연결되지 않은 설정이 있는가",
    build(definition) {
      // "연결"은 참조 수로 요약한다 — 어떤 규칙·목적·조직도 건드리지 않는 설정이 고립이다
      const referenced = new Set<string>();
      const walk = (node: unknown, depth: number): void => {
        if (depth > 12 || node === null) return;
        if (typeof node === "string") {
          referenced.add(node);
          return;
        }
        if (Array.isArray(node)) {
          for (const item of node) walk(item, depth + 1);
          return;
        }
        if (typeof node === "object") for (const value of Object.values(node)) walk(value, depth + 1);
      };
      walk(definition.ruleDefinitions, 0);
      walk(definition.goalTemplates, 0);
      walk(definition.actionDefinitions, 0);
      walk(definition.eventPatterns, 0);
      const entries = [
        ...definition.species.map((species) => ({ id: species.id, kind: "species", name: species.name })),
        ...definition.spaces.regions.map((region) => ({ id: region.id, kind: "region", name: region.name })),
        ...definition.resources.map((resource) => ({ id: resource.id, kind: "resource", name: resource.name })),
        ...definition.factions.map((faction) => ({ id: faction.id, kind: "faction", name: faction.name })),
      ].map((entry) => ({ ...entry, referencedElsewhere: referenced.has(entry.id) }));
      return { input: { settings: entries }, asked: entries.length };
    },
  },
];

/**
 * §33.2 다섯 항목을 물어본다.
 * port 가 없으면 전부 skipped — 이 함수가 던지는 예외는 없다(검증 파이프라인을 멈추지 않는다).
 */
export async function auditWorld(
  definition: WorldDefinition,
  port?: TextGenerationPort,
  telemetry: GenerationTelemetry = createTelemetry(),
): Promise<AuditReport> {
  const checks: AuditCheck[] = [];
  for (const spec of SPECS) {
    const { input, asked } = spec.build(definition);
    if (port === undefined) {
      checks.push({ code: spec.code, taskId: spec.taskId, question: spec.question, asked, findings: [], skipped: true });
      continue;
    }
    try {
      const answer = await generateChecked<{ findings: AuditFinding[] }>(
        port,
        {
          taskId: spec.taskId,
          systemPrompt: `${AUDIT_PROMPT}\n검토 항목: ${spec.question}`,
          input,
          outputSchema: FINDINGS_SCHEMA,
        },
        telemetry,
        0, // 보조 검사는 재시도하지 않는다 — 실패하면 그냥 건너뛴다
      );
      checks.push({
        code: spec.code,
        taskId: spec.taskId,
        question: spec.question,
        asked,
        findings: answer.findings,
        skipped: false,
      });
    } catch (error) {
      checks.push({
        code: spec.code,
        taskId: spec.taskId,
        question: spec.question,
        asked,
        findings: [],
        skipped: true,
        error: error instanceof Error ? (error.message.split("\n")[0] ?? error.message) : String(error),
      });
    }
  }

  const issues: ValidationIssue[] = checks.flatMap((check) =>
    check.findings.map((finding) => ({
      level: "warning" as const,
      code: check.code,
      targetId: finding.targetId,
      message: `${check.question} — ${finding.targetId}: ${finding.reason}`,
      suggestedFix: "사람이 판단한다 — AI 검사는 게이트가 아니다(§34)",
    })),
  );

  return { enabled: port !== undefined, checks, issues };
}
