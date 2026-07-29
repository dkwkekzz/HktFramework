// §12 "확률은 인과관계를 대체하는 용도로 사용하지 않는다. 확률은 다음 용도로 제한한다" 의 실행 데이터.
//
// 기획서가 확률에 건 유일한 원칙이다. 여기에 5용도를 **목록으로 고정**하고, 규칙 DSL 의 모든 확률 지점이
// 그 중 하나를 밝히도록 강제한다(라벨 없는 확률·목록 밖 용도는 세계가 로드되지 않는다).
//
// 확률이 나타나는 자리는 두 곳뿐이다.
//   ① 규칙 효과 — `chance` 또는 값 참조 `random`/`random_int` (이 파일의 검증기가 담당)
//   ② 엔진 — 행동 선택(softmax)·관찰 실패 (코드가 갖는 자리. 규칙이 흉내낼 수 없으므로 라벨을 금지한다)
import type {
  RuleCondition,
  RuleDefinition,
  RuleEffect,
  RuleTargetQuery,
  RuleTargetSelector,
  RuleValue,
} from "./RuleTypes";

/** §12 확률 용도 5종 — 목록 순서는 기획서 그대로다 */
export const CHANCE_USES = [
  "trait_variation",
  "partial_outcome",
  "mutation",
  "observation_failure",
  "action_choice",
] as const;

export type ChanceUse = (typeof CHANCE_USES)[number];

export interface ChanceUseSpec {
  use: ChanceUse;
  /** 기획서 §12 목록 문구 그대로 */
  plan: string;
  /** 이 용도가 사는 자리 — 규칙 효과인가(rule), 엔진인가(engine) */
  site: "rule" | "engine";
  /** 실현 위치 (파일·함수) */
  realizedIn: string;
  /** site="rule" 인 용도가 지켜야 하는 문맥 */
  context?: string;
}

export const CHANCE_USE_SPECS: Record<ChanceUse, ChanceUseSpec> = {
  trait_variation: {
    use: "trait_variation",
    plan: "개체별 성향 차이",
    site: "engine",
    realizedIn: "ActionPlanner.selectAction — randomness = impulsiveness·stress 가 softmax 온도를 만든다",
  },
  partial_outcome: {
    use: "partial_outcome",
    plan: "불완전한 행동 결과",
    site: "rule",
    realizedIn: "행동 실행 규칙의 효과 (action_executed 트리거)",
    context: "규칙이 action_executed 트리거를 가져야 한다 — 결과가 흔들리려면 먼저 행동이 있어야 한다",
  },
  mutation: {
    use: "mutation",
    plan: "돌연변이",
    site: "rule",
    realizedIn: "개체를 바꾸거나 낳거나 없애는 효과",
    context: "대상이 개체여야 한다 — 전역 상태(world)에는 돌연변이가 없다",
  },
  observation_failure: {
    use: "observation_failure",
    plan: "관찰 실패",
    site: "engine",
    realizedIn: "PerceptionSystem.observationSuccessChance — 임계 근처의 신호는 확률적으로 놓친다",
  },
  action_choice: {
    use: "action_choice",
    plan: "여러 가능한 행동 중 선택",
    site: "engine",
    realizedIn: "ActionPlanner.selectAction — 상위 후보 중 softmax 추첨",
  },
};

/** 규칙 효과에 붙일 수 있는 용도 (나머지 셋은 엔진이 갖는다) */
export const RULE_SITE_USES: ChanceUse[] = CHANCE_USES.filter(
  (use) => CHANCE_USE_SPECS[use].site === "rule",
);

export interface ChanceViolation {
  ruleId: string;
  /** 오류 종류 — 위반 픽스처가 이 코드로 검출을 증명한다 */
  code:
    | "unlabeled"
    | "unknown-use"
    | "engine-use"
    | "label-without-chance"
    | "no-cause"
    | "context"
    | "deterministic"
    | "in-condition";
  /** validateWorldDefinition 이 그대로 싣는 문장 */
  message: string;
  fix: string;
}

// --- 확률 지점 수집 -------------------------------------------------------------

/**
 * 난수를 품은 바인딩 이름들.
 * 바인딩은 "한 번 계산해 여러 번 쓰는 값"이므로 난수가 바인딩을 타고 효과로 들어온다 —
 * 바인딩을 따라가지 않으면 확률이 라벨 없이 새어 나간다(공격 피해량·수확량이 실제로 이 형태다).
 */
function randomBindingNames(rule: RuleDefinition): Set<string> {
  const names = new Set<string>();
  const bindings = rule.bindings ?? [];
  // 바인딩이 다른 바인딩을 참조할 수 있으므로 더 늘지 않을 때까지 돈다
  for (let pass = 0; pass <= bindings.length; pass++) {
    const before = names.size;
    for (const binding of bindings) {
      if (valueHasRandom(binding.value, names)) names.add(binding.name);
    }
    if (names.size === before) break;
  }
  return names;
}

function valueHasRandom(value: RuleValue, randomBindings: ReadonlySet<string>): boolean {
  if (value.type === "random" || value.type === "random_int") return true;
  if (value.type === "binding") return randomBindings.has(value.name);
  if (value.type === "expr") return value.operands.some((operand) => valueHasRandom(operand, randomBindings));
  if (value.type === "query_value") return queryHasRandom(value.query, randomBindings);
  return false;
}

function conditionsHaveRandom(
  conditions: readonly RuleCondition[] | undefined,
  randomBindings: ReadonlySet<string>,
): boolean {
  return (conditions ?? []).some(
    (condition) =>
      valueHasRandom(condition.left, randomBindings) || valueHasRandom(condition.right, randomBindings),
  );
}

function queryHasRandom(query: RuleTargetQuery, randomBindings: ReadonlySet<string>): boolean {
  return conditionsHaveRandom(query.where, randomBindings);
}

function selectorHasRandom(
  selector: RuleTargetSelector | undefined,
  randomBindings: ReadonlySet<string>,
): boolean {
  return (
    selector !== undefined && selector.type === "query" && queryHasRandom(selector.query, randomBindings)
  );
}

function selectorsOf(effect: RuleEffect): (RuleTargetSelector | undefined)[] {
  switch (effect.type) {
    case "modify_state":
    case "destroy_entity":
    case "record_growth":
      return [effect.target];
    case "transfer_resource":
    case "modify_relationship":
    case "make_promise":
      return [effect.from, effect.to];
    case "create_entity":
      return [effect.location];
    default:
      return [];
  }
}

/** 이 효과가 확률을 쓰는가 — `chance` 또는 (바인딩을 타고 들어온 것을 포함한) random/random_int */
export function effectProbabilitySites(
  effect: RuleEffect,
  randomBindings: ReadonlySet<string> = new Set(),
): string[] {
  const sites: string[] = [];
  if (effect.chance !== undefined) sites.push("chance");
  if (conditionsHaveRandom(effect.conditions, randomBindings)) sites.push("conditions.random");
  const valueRefs: (RuleValue | undefined)[] =
    effect.type === "modify_state"
      ? [effect.valueRef]
      : effect.type === "transfer_resource"
        ? [effect.amountRef]
        : effect.type === "record_growth"
          ? [effect.amountRef]
          : effect.type === "modify_relationship"
            ? [effect.valueRef]
            : [];
  for (const ref of valueRefs) {
    if (ref !== undefined && valueHasRandom(ref, randomBindings)) sites.push("valueRef.random");
  }
  if (selectorsOf(effect).some((selector) => selectorHasRandom(selector, randomBindings))) {
    sites.push("target.random");
  }
  return sites;
}

/** 대상이 개체인가 — 전역(world) 이면 개체가 아니다 (mutation 문맥 검사) */
function targetsEntity(effect: RuleEffect): boolean {
  const selectors = selectorsOf(effect);
  if (selectors.length === 0) return false;
  return selectors.every((selector) => selector !== undefined && selector.type !== "world");
}

// --- 검증 -----------------------------------------------------------------------

const USE_LIST = CHANCE_USES.map((use) => `${use}(${CHANCE_USE_SPECS[use].plan})`).join(" · ");

/**
 * 규칙 하나의 확률 사용을 §12 원칙에 비추어 판정한다.
 * 판정 기준은 두 겹이다 — ① 용도가 5종 목록 안에 있는가 ② 확률이 **인과 위에** 얹혔는가.
 */
export function findRuleChanceViolations(rule: RuleDefinition): ChanceViolation[] {
  const violations: ChanceViolation[] = [];
  const add = (code: ChanceViolation["code"], message: string, fix: string): void => {
    violations.push({ ruleId: rule.id, code, message, fix });
  };

  // 원인 자리(규칙 조건·대상 선택)에 굴린 주사위는 인과의 대체다 — 확률은 결과(효과)에만 붙는다
  const ruleWhere = `규칙 ${rule.id}`;
  const randomBindings = randomBindingNames(rule);
  if (conditionsHaveRandom(rule.conditions, randomBindings)) {
    add(
      "in-condition",
      `${ruleWhere}: 조건에 확률을 쓴다 — 확률은 원인이 아니라 결과에만 붙는다 (§12)`,
      "random 을 조건에서 걷어내고, 결과 효과에 chance 와 chanceUse 로 옮긴다",
    );
  }
  if (rule.forEach !== undefined && selectorHasRandom(rule.forEach, randomBindings)) {
    add(
      "in-condition",
      `${ruleWhere} forEach: 대상 선택에 확률을 쓴다 — 확률은 결과에만 붙는다 (§12)`,
      "대상은 조건으로 고르고, 흔들림은 효과의 chance 로 표현한다",
    );
  }

  const causedByEvent = rule.triggers.some((trigger) => trigger.type !== "interval");
  const ruleHasConditions = rule.conditions.length > 0;

  rule.effects.forEach((effect, index) => {
    const where = `${ruleWhere} 효과[${index}]`;
    const sites = effectProbabilitySites(effect, randomBindings);
    const use = effect.chanceUse;

    if (sites.length === 0) {
      if (use !== undefined) {
        add(
          "label-without-chance",
          `${where}: 확률이 없는데 chanceUse="${use}" 를 달았다 (§12)`,
          "chance 또는 random 값을 쓰지 않는 효과에서는 chanceUse 를 지운다",
        );
      }
      return;
    }

    if (effect.chance !== undefined && (effect.chance <= 0 || effect.chance >= 1)) {
      add(
        "deterministic",
        `${where}: chance=${effect.chance} 는 확률이 아니다 — 0 < chance < 1 이어야 한다 (§12)`,
        "항상/절대는 조건으로 쓴다. 흔들리는 것만 chance 로 남긴다",
      );
    }

    if (use === undefined) {
      add(
        "unlabeled",
        `${where}: 용도를 밝히지 않은 확률 — chanceUse 가 필요하다 (§12 확률 5용도: ${USE_LIST})`,
        `chanceUse 에 ${RULE_SITE_USES.join(" 또는 ")} 중 하나를 적는다`,
      );
      return;
    }

    const spec = CHANCE_USE_SPECS[use];
    if (spec === undefined) {
      add(
        "unknown-use",
        `${where}: §12 목록 밖의 확률 용도 — "${String(use)}" (허용: ${USE_LIST})`,
        "5용도 중 하나로 바꾸거나, 확률을 걷어내고 인과로 쓴다",
      );
      return;
    }

    if (spec.site === "engine") {
      add(
        "engine-use",
        `${where}: "${use}"(${spec.plan})는 엔진이 갖는 용도다 — 규칙 효과에 붙일 수 없다 (${spec.realizedIn})`,
        `규칙 효과의 확률은 ${RULE_SITE_USES.join(" 또는 ")} 뿐이다`,
      );
      return;
    }

    // §12 의 핵심 — 확률이 인과를 **대체**하면 안 된다. 원인(사건 트리거 또는 조건) 위에만 얹힌다.
    if (!causedByEvent && !ruleHasConditions && (effect.conditions ?? []).length === 0) {
      add(
        "no-cause",
        `${where}: 원인 없이 굴리는 주사위 — 주기 트리거뿐이고 조건도 없다. 확률은 인과를 대체하지 않는다 (§12)`,
        "무엇이 이 변화를 부르는지 조건으로 적고, 확률은 그 위의 흔들림으로만 남긴다",
      );
    }

    if (use === "partial_outcome" && !rule.triggers.some((t) => t.type === "action_executed")) {
      add(
        "context",
        `${where}: partial_outcome(불완전한 행동 결과)인데 이 규칙은 행동이 깨우지 않는다 (§12)`,
        "action_executed 트리거를 붙이거나, 용도를 mutation 으로 바꾼다",
      );
    }
    if (use === "mutation" && !targetsEntity(effect)) {
      add(
        "context",
        `${where}: mutation(돌연변이)인데 대상이 개체가 아니다 (§12)`,
        "돌연변이는 개체에 일어난다 — 전역 상태 대신 개체를 대상으로 삼는다",
      );
    }
  });

  return violations;
}

/** 세계 전체의 확률 사용 판정 */
export function findChanceViolations(rules: readonly RuleDefinition[]): ChanceViolation[] {
  return rules.flatMap(findRuleChanceViolations);
}

export interface ChanceSiteRecord {
  ruleId: string;
  effectIndex: number;
  use: ChanceUse | undefined;
  sites: string[];
  chance: number | undefined;
}

/** 세계가 실제로 쓰는 확률 지점 전수 목록 — verify 가 "라벨 없는 확률 0건"을 이 목록으로 판정한다 */
export function collectChanceSites(rules: readonly RuleDefinition[]): ChanceSiteRecord[] {
  const records: ChanceSiteRecord[] = [];
  for (const rule of rules) {
    const randomBindings = randomBindingNames(rule);
    rule.effects.forEach((effect, effectIndex) => {
      const sites = effectProbabilitySites(effect, randomBindings);
      if (sites.length === 0) return;
      records.push({
        ruleId: rule.id,
        effectIndex,
        use: effect.chanceUse,
        sites,
        chance: effect.chance,
      });
    });
  }
  return records;
}
