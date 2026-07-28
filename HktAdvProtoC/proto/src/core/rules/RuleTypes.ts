// 규칙 DSL 정규형 (기획서 §11 RuleDefinition, §12 규칙 DSL / Phase-2 §2.1)
//
// 실행기는 이 정규형 하나만 안다. §12 의 `when/if/then` 축약형과 §11.4 예시 표기는
// 로더(RuleSchema.loadRuleDocument)가 여기로 변환해 넣는다.
import type { GrowthOption, GrowthType } from "../../shared/player";
import type { EntityType } from "../../shared/state";
import type { ObservationEffect, StateOwnerType } from "../world/types";

export type RuleScope = "global" | "region" | "entity" | "relationship";

/** §11.1 트리거 5종 전부 */
export type RuleTrigger =
  | { type: "state_changed"; stateKey: string }
  | { type: "interval"; interval: number }
  | { type: "action_executed"; actionId: string }
  | { type: "entity_entered"; locationTag: string }
  | { type: "relationship_changed"; relationshipKey: string };

/**
 * 규칙 실행 중의 개체 바인딩.
 * - actor  : 트리거를 일으킨 주체 (행동 주체 / 상태가 바뀐 개체)
 * - target : 규칙이 지금 처리 중인 대상 (트리거 대상 또는 forEach 항목)
 * - each   : 지금 이 효과가 건드리는 개체 · 대상 검색 중의 후보
 */
export type RuleBinding = "actor" | "target" | "each";

/** 산술 — §12 "조건 비교"와 상태 변경량을 코드 없이 쓰기 위한 최소 집합 */
export type ExprOp =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "neg"
  | "min"
  | "max"
  | "floor"
  | "ceil"
  | "round"
  | "abs";

export type QueryAggregate = "first" | "count" | "sum" | "min" | "max";

/** §11.2 ValueReference — Phase-2 §2.3 의 변형 전부 */
export type RuleValue =
  | { type: "constant"; value: number | boolean | string }
  | { type: "actor_state"; key: string }
  | { type: "target_state"; key: string }
  | { type: "each_state"; key: string }
  | { type: "world_state"; key: string }
  | { type: "entity_state"; entityId: string; key: string }
  | { type: "event_payload"; key: string }
  /** §12 점 표기 — `owner.stateKey`. owner 는 예약어(actor/target/each/world) 또는 개체 id */
  | { type: "path"; path: string }
  | { type: "entity_ref"; of: RuleBinding }
  | { type: "entity_type"; of: RuleBinding }
  | { type: "binding"; name: string }
  | { type: "distance"; from: RuleBinding; to: RuleBinding }
  /** §12 확률적 효과 — 난수는 항상 RandomContext(worldSeed, simulationStep, entityId) 로만 만든다 */
  | { type: "random"; stream?: RuleBinding }
  | { type: "random_int"; max: number; stream?: RuleBinding }
  /** §12 주변 개체 검색 — 검색 결과를 값으로 쓴다(개수·합·첫 항목의 상태) */
  | { type: "query_value"; query: RuleTargetQuery; key?: string; aggregate: QueryAggregate }
  | { type: "expr"; op: ExprOp; operands: RuleValue[] };

export type RuleConditionOperator = ">" | ">=" | "<" | "<=" | "==" | "!=" | "contains";

/** §11.2 RuleCondition */
export interface RuleCondition {
  left: RuleValue;
  operator: RuleConditionOperator;
  right: RuleValue;
}

/** §12 `entities[tag=plant]` 에 대응하는 정규형 (Phase-2 §2.5) */
export interface RuleTargetQuery {
  tags?: string[];
  entityType?: EntityType;
  ownerType?: StateOwnerType;
  /** 3D 유클리드 반경 검색 — of 는 바인딩 또는 개체 id. 기준 개체 자신은 제외한다 */
  withinRadius?: { of: RuleBinding | string; r: number };
  /** 후보마다 평가하는 조건 — 후보는 `each` 로 바인딩된다 */
  where?: RuleCondition[];
  limit?: number;
}

/** §11.3 TargetSelector */
export type RuleTargetSelector =
  | { type: "actor" }
  | { type: "target" }
  | { type: "each" }
  /** 전역 상태(ownerType="world") */
  | { type: "world" }
  | { type: "entity"; entityId: string }
  | { type: "query"; query: RuleTargetQuery };

export type StateOperation = "set" | "add" | "multiply";

interface EffectCommon {
  /** 이 효과만의 추가 조건 — 규칙 conditions 를 통과한 뒤 대상마다 평가한다 */
  conditions?: RuleCondition[];
  /** §12 확률적 효과. 난수는 (worldSeed, simulationStep, 대상id#규칙id#효과번호) 스트림 */
  chance?: number;
}

/** §11.3 RuleEffect 6종 + §12 가 요구하는 관계 변경 (Phase-2 §2.4) */
export type RuleEffect = EffectCommon &
  (
    | {
        type: "modify_state";
        target: RuleTargetSelector;
        stateKey: string;
        operation: StateOperation;
        value?: number | boolean | string;
        /** 계산된 값 — 지정되면 value 를 대신한다 */
        valueRef?: RuleValue;
      }
    | {
        type: "transfer_resource";
        resourceId: string;
        from: RuleTargetSelector;
        to: RuleTargetSelector;
        amount?: number;
        amountRef?: RuleValue;
        /** 자원 재고를 담는 상태 키 — 없으면 resourceId 를 그대로 쓴다 */
        fromStateKey?: string;
        toStateKey?: string;
      }
    | { type: "create_entity"; templateId: string; location: RuleTargetSelector }
    | { type: "destroy_entity"; target: RuleTargetSelector }
    | { type: "emit_signal"; signalId: string; intensity?: number }
    | { type: "schedule_rule"; ruleId: string; delay: number }
    | {
        type: "modify_relationship";
        from: RuleTargetSelector;
        to: RuleTargetSelector;
        key: string;
        operation: StateOperation;
        value?: number;
        valueRef?: RuleValue;
      }
    /**
     * §25 약속 생성 — 계약·동맹 행동(§21)이 관계 원장에 약속을 남기는 효과.
     * from 이 약속하는 쪽이다: dueInTicks 안에 from 의 stateKey 가 comparison/threshold 를
     * 만족하면 이행, 아니면 파기(§25 약속 위반 연쇄는 기존 규칙이 잇는다).
     */
    | {
        type: "make_promise";
        from: RuleTargetSelector;
        to: RuleTargetSelector;
        stateKey: string;
        comparison: ">" | "<";
        threshold: number;
        dueInTicks: number;
        tags?: string[];
      }
    /**
     * §32 성장 기록 (Phase-7 §7.4). 성장 **발생 조건**을 코드가 아니라 규칙이 갖게 하는 효과다 —
     * NPC 와 플레이어가 같은 규칙으로 자란다(§21). 출처 사건이 확정된 뒤에 적용된다.
     */
    | {
        type: "record_growth";
        growthType: GrowthType;
        target: RuleTargetSelector;
        key: string;
        amount?: number;
        amountRef?: RuleValue;
        /** 있으면 즉시 적용이 아니라 선택지를 게시한다 (§32 "사용자의 선택") */
        options?: GrowthOption[];
      }
  );

/** 규칙 본문에서 한 번만 계산해 여러 번 쓰는 값 (lazy — 처음 참조될 때 계산되고 그 뒤로는 기억된다) */
export interface RuleBindingDefinition {
  name: string;
  value: RuleValue;
}

/** §11 RuleDefinition */
export interface RuleDefinition {
  id: string;
  name: string;
  scope: RuleScope;
  priority: number;
  /**
   * 이 규칙이 만드는 변화의 의미 태그 (§28 태그 전파 — Phase-4 §4.1).
   * 사건 패턴의 requiredTags 가 이 태그를 물어본다. 실행에는 영향을 주지 않는다.
   */
  tags?: string[];
  triggers: RuleTrigger[];
  /**
   * 규칙 본문을 개체마다 한 번씩 돌린다. 선택된 개체가 `target` 으로 바인딩된다.
   * 없으면 트리거가 준 대상 하나로 한 번만 돈다.
   */
  forEach?: RuleTargetSelector;
  bindings?: RuleBindingDefinition[];
  conditions: RuleCondition[];
  effects: RuleEffect[];
  observations: ObservationEffect[];
  cooldown?: number;
  derivedFromAxioms: string[];
}

/** §11.3 create_entity 의 templateId 가 가리키는 것 (Phase-2 §2.4) */
export interface EntityTemplate {
  id: string;
  type: EntityType;
  tags: string[];
  states: Record<string, unknown>;
}
