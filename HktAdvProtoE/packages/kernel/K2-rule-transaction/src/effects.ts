import { StoreRejection, type EntityStore, type JsonObject, type JsonValue } from '@hkt/k0-entity-state';
import type { BindingTable } from '@hkt/k1-predicate-query';
import { TransactionRejected } from './errors.js';
import { TRANSACTION_ISSUE, type EffectSpec, type ScheduledEffect, type StateDelta } from './types.js';

/**
 * 효과 적용 (원본 15.3 의 `EffectSpec`).
 *
 * 효과는 데이터 AST 다. 여기가 그 데이터를 **유일하게** 상태 변화로 바꾸는 자리이고, 바꾼 내용은
 * 반드시 `StateDelta` 로 남는다 — 델타에 없는 변화는 K3 이 사건으로 기록할 수 없고, 그것은 곧
 * GI-01(사건 없는 상태 변경 금지) 위반이다.
 *
 * ## 지불 능력은 컴포넌트 스키마가 정한다
 *
 * "에너지가 모자라면 실패한다"를 K2 안에 따로 적지 않는다. `energy.current` 의 스키마가
 * `minimum: 0` 이면 3 을 더 빼는 순간 K0 이 거부하고, 그 거부를 여기서 `E_UNAFFORDABLE_COST` 로
 * 옮긴다. 자원마다 하한을 다시 적을 필요가 없고, 하한이 한 곳(스키마)에만 있다.
 */
export interface EffectApplication {
  store: EntityStore;
  delta: StateDelta[];
  scheduled: ScheduledEffect[];
}

export function applyEffects(
  store: EntityStore,
  effects: readonly EffectSpec[],
  bindings: BindingTable,
  options: { at: string },
): EffectApplication {
  let current = store;
  const delta: StateDelta[] = [];
  const scheduled: ScheduledEffect[] = [];

  effects.forEach((effect, index) => {
    const at = `${options.at}/${index}`;
    const applied = applyEffect(current, effect, bindings, at);
    current = applied.store;
    delta.push(...applied.delta);
    scheduled.push(...applied.scheduled);
  });

  return { store: current, delta, scheduled };
}

export function applyEffect(
  store: EntityStore,
  effect: EffectSpec,
  bindings: BindingTable,
  at: string,
): EffectApplication {
  switch (effect.op) {
    case 'add':
      return numeric(store, bindings, effect.path, at, 'add', (before) => before + effect.value);

    case 'multiply':
      return numeric(store, bindings, effect.path, at, 'multiply', (before) => before * effect.value);

    case 'set': {
      const target = locate(store, bindings, effect.path, at);
      const before = readAt(store, target);
      const next = writeAt(store, target, effect.value, at, TRANSACTION_ISSUE.BAD_EFFECT);
      return {
        store: next,
        delta: [{ path: target.deltaPath, op: 'set', before, after: effect.value }],
        scheduled: [],
      };
    }

    case 'transfer': {
      if (!Number.isFinite(effect.amount) || effect.amount < 0) {
        throw new TransactionRejected(
          TRANSACTION_ISSUE.BAD_EFFECT,
          at,
          `transfer 의 amount 는 0 이상의 유한한 수여야 한다: ${effect.amount}`,
        );
      }
      // 내보내는 쪽을 먼저 깎는다. 모자라면 받는 쪽이 늘기 전에 멈춰야 총량이 늘지 않는다.
      const taken = numeric(store, bindings, effect.from, `${at}/from`, 'transfer', (before) => before - effect.amount);
      const given = numeric(taken.store, bindings, effect.to, `${at}/to`, 'transfer', (before) => before + effect.amount);
      return { store: given.store, delta: [...taken.delta, ...given.delta], scheduled: [] };
    }

    case 'attach_tag':
    case 'remove_tag': {
      const entityId = requireBinding(bindings, effect.target, at);
      const entity = store.get(entityId);
      if (!entity) {
        throw new TransactionRejected(TRANSACTION_ISSUE.BAD_EFFECT, at, `없는 실체다: ${entityId}`);
      }
      const before = [...entity.tags];
      const next =
        effect.op === 'attach_tag'
          ? guard(() => store.attachTag(entityId, effect.tag), at, TRANSACTION_ISSUE.BAD_EFFECT)
          : guard(() => store.removeTag(entityId, effect.tag), at, TRANSACTION_ISSUE.BAD_EFFECT);
      const after = [...(next.get(entityId)?.tags ?? [])];
      if (JSON.stringify(before) === JSON.stringify(after)) {
        return { store: next, delta: [], scheduled: [] };
      }
      return {
        store: next,
        delta: [{ path: `entity/${entityId}/tags`, op: effect.op, before, after }],
        scheduled: [],
      };
    }

    case 'create_commitment':
      return commitment(store, bindings, at, (open, breached) => ({
        open: [...open, effect.templateId].sort(),
        breached,
      }));

    case 'breach_commitment': {
      const target = locate(store, bindings, effect.commitmentIdPath, at);
      const id = readAt(store, target);
      if (typeof id !== 'string') {
        throw new TransactionRejected(
          TRANSACTION_ISSUE.BAD_EFFECT,
          at,
          `${effect.commitmentIdPath} 가 약속 id 를 가리키지 않는다: ${JSON.stringify(id)}`,
        );
      }
      return commitment(store, bindings, at, (open, breached) => {
        if (!open.includes(id)) {
          throw new TransactionRejected(TRANSACTION_ISSUE.BAD_EFFECT, at, `열려 있지 않은 약속이다: ${id}`);
        }
        return { open: open.filter((item) => item !== id), breached: [...breached, id].sort() };
      });
    }

    case 'schedule_event': {
      if (!Number.isInteger(effect.delayTicks) || effect.delayTicks < 0) {
        throw new TransactionRejected(
          TRANSACTION_ISSUE.BAD_EFFECT,
          at,
          `delayTicks 는 0 이상의 정수여야 한다: ${effect.delayTicks}`,
        );
      }
      // 상태를 바꾸지 않는다 — 예약만 남기고, 실제로 일으키는 일은 K3 의 Scheduler 가 한다.
      return {
        store,
        delta: [],
        scheduled: [{ eventTemplateId: effect.eventTemplateId, delayTicks: effect.delayTicks }],
      };
    }

    default: {
      const unknown = effect as { op?: unknown };
      throw new TransactionRejected(
        TRANSACTION_ISSUE.BAD_EFFECT,
        `${at}/op`,
        `모르는 효과다: ${JSON.stringify(unknown.op)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------

interface Target {
  entityId: string;
  component: string;
  /** 컴포넌트 안의 경로. 비어 있으면 컴포넌트 전체를 가리킨다. */
  field: string[];
  deltaPath: string;
}

function locate(store: EntityStore, bindings: BindingTable, path: string, at: string): Target {
  if (typeof path !== 'string' || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(path)) {
    throw new TransactionRejected(
      TRANSACTION_ISSUE.BAD_EFFECT,
      at,
      `효과의 경로는 \`<결합>.<컴포넌트>[.<필드>…]\` 여야 한다: ${JSON.stringify(path)}`,
    );
  }
  const [head, component, ...field] = path.split('.') as [string, string, ...string[]];
  const entityId = requireBinding(bindings, head, at);
  if (!store.has(entityId)) {
    throw new TransactionRejected(TRANSACTION_ISSUE.BAD_EFFECT, at, `없는 실체다: ${entityId}`);
  }
  if (!store.registry.has(component)) {
    throw new TransactionRejected(
      TRANSACTION_ISSUE.BAD_EFFECT,
      at,
      `선언되지 않은 컴포넌트 종류다: ${component}`,
    );
  }
  return {
    entityId,
    component,
    field,
    deltaPath: `entity/${entityId}/components/${component}${field.length > 0 ? `/${field.join('/')}` : ''}`,
  };
}

function readAt(store: EntityStore, target: Target): JsonValue | null {
  const component = store.component(target.entityId, target.component);
  if (component === null) return null;
  let cursor: JsonValue = component;
  for (const key of target.field) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return null;
    const next: JsonValue | undefined = (cursor as JsonObject)[key];
    if (next === undefined) return null;
    cursor = next;
  }
  return cursor;
}

function writeAt(
  store: EntityStore,
  target: Target,
  value: JsonValue,
  at: string,
  schemaViolationCode: (typeof TRANSACTION_ISSUE)[keyof typeof TRANSACTION_ISSUE],
): EntityStore {
  const current = store.component(target.entityId, target.component);
  if (target.field.length === 0) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TransactionRejected(
        TRANSACTION_ISSUE.BAD_EFFECT,
        at,
        `컴포넌트 전체에는 객체만 쓸 수 있다: ${JSON.stringify(value)}`,
      );
    }
    return guard(() => store.setComponent(target.entityId, target.component, value as JsonObject), at, schemaViolationCode);
  }
  if (current === null) {
    throw new TransactionRejected(
      TRANSACTION_ISSUE.BAD_EFFECT,
      at,
      `${target.entityId} 에 \`${target.component}\` 컴포넌트가 없다.`,
    );
  }

  const next = JSON.parse(JSON.stringify(current)) as JsonObject;
  let cursor: JsonObject = next;
  for (const key of target.field.slice(0, -1)) {
    const child = cursor[key];
    if (child === null || typeof child !== 'object' || Array.isArray(child)) {
      throw new TransactionRejected(TRANSACTION_ISSUE.BAD_EFFECT, at, `${target.deltaPath} 아래로 들어갈 수 없다.`);
    }
    cursor = child as JsonObject;
  }
  cursor[target.field[target.field.length - 1] as string] = value;
  return guard(() => store.setComponent(target.entityId, target.component, next), at, schemaViolationCode);
}

/**
 * 수를 셈해 다시 쓴다.
 *
 * 여기서 나는 스키마 위반은 **언제나 "자원이 하한을 넘었다"** 는 뜻이다 — `minimum` 이 지불 능력을
 * 정하기 때문이다. 그래서 비용이든 효과든 가리지 않고 `E_UNAFFORDABLE_COST` 로 옮긴다.
 * 값을 통째로 갈아 끼우는 `set` 의 스키마 위반은 규칙이 잘못 적힌 것이므로 `E_BAD_EFFECT` 다.
 */
function numeric(
  store: EntityStore,
  bindings: BindingTable,
  path: string,
  at: string,
  op: StateDelta['op'],
  transform: (before: number) => number,
): EffectApplication {
  const target = locate(store, bindings, path, at);
  const before = readAt(store, target);
  if (typeof before !== 'number' || !Number.isFinite(before)) {
    throw new TransactionRejected(
      TRANSACTION_ISSUE.BAD_EFFECT,
      at,
      `${path} 가 수가 아니라 셈할 수 없다: ${JSON.stringify(before)}`,
    );
  }
  const after = transform(before);
  const next = writeAt(store, target, after, at, TRANSACTION_ISSUE.UNAFFORDABLE);
  return { store: next, delta: [{ path: target.deltaPath, op, before, after }], scheduled: [] };
}

const COMMITMENT_COMPONENT = 'commitments';

function commitment(
  store: EntityStore,
  bindings: BindingTable,
  at: string,
  change: (open: string[], breached: string[]) => { open: string[]; breached: string[] },
): EffectApplication {
  const entityId = requireBinding(bindings, 'actor', at);
  if (!store.registry.has(COMMITMENT_COMPONENT)) {
    throw new TransactionRejected(
      TRANSACTION_ISSUE.BAD_EFFECT,
      at,
      `약속 효과를 쓰려면 세계가 \`${COMMITMENT_COMPONENT}\` 컴포넌트를 선언해야 한다.`,
    );
  }
  const current = (store.component(entityId, COMMITMENT_COMPONENT) ?? { open: [], breached: [] }) as {
    open?: JsonValue;
    breached?: JsonValue;
  };
  const open = Array.isArray(current.open) ? (current.open as string[]) : [];
  const breached = Array.isArray(current.breached) ? (current.breached as string[]) : [];
  const next = change([...open], [...breached]);

  const store2 = guard(
    () => store.setComponent(entityId, COMMITMENT_COMPONENT, next as unknown as JsonObject),
    at,
    TRANSACTION_ISSUE.BAD_EFFECT,
  );
  return {
    store: store2,
    delta: [
      {
        path: `entity/${entityId}/components/${COMMITMENT_COMPONENT}`,
        op: next.breached.length > breached.length ? 'breach_commitment' : 'create_commitment',
        before: { open, breached } as unknown as JsonValue,
        after: next as unknown as JsonValue,
      },
    ],
    scheduled: [],
  };
}

function requireBinding(bindings: BindingTable, name: string, at: string): string {
  const id = bindings[name];
  if (id === undefined) {
    throw new TransactionRejected(
      TRANSACTION_ISSUE.BAD_EFFECT,
      at,
      `모르는 결합 이름이다: ${name} (결합된 이름: ${Object.keys(bindings).sort().join(', ') || '없음'})`,
    );
  }
  return id;
}

/**
 * K0 의 거부를 트랜잭션의 언어로 옮긴다.
 *
 * 스키마 위반은 대개 "자원이 하한 아래로 내려갔다" 이므로, 비용을 치르는 자리에서는
 * `E_UNAFFORDABLE_COST` 가 된다. 효과를 적용하는 자리에서는 규칙이 잘못 적힌 것이므로
 * `E_BAD_EFFECT` 다.
 */
function guard(
  action: () => EntityStore,
  at: string,
  code: (typeof TRANSACTION_ISSUE)[keyof typeof TRANSACTION_ISSUE],
): EntityStore {
  try {
    return action();
  } catch (error) {
    if (error instanceof StoreRejection) {
      throw new TransactionRejected(code, at, `${error.code} @ ${error.path} — ${error.message}`);
    }
    throw error;
  }
}
