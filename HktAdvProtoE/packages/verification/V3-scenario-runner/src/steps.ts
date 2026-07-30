import { escapeToken, parsePointer } from '@hkt/v1-schema';
import { readPath, writePath } from './json.js';
import { StepRejection, type JsonObject, type JsonValue, type StepDefinition } from './types.js';

/**
 * 기본 단계 목록.
 *
 * V3 는 세계가 무엇인지 모른다 — 그것은 K 페이즈의 몫이다. 그래서 여기 있는 단계들은
 * **임의의 JSON 상태 위에서 도는 일반 연산**뿐이다. 시나리오 실행기 자체를 검증하기 위한 최소 어휘이며,
 * K0~K3 이 오면 세계 규칙 단계가 같은 자리에 등록된다.
 *
 * 두 가지를 구분한다.
 *
 * - **거부**(`StepRejection`) — 규칙이 막은 것. 상태를 전혀 바꾸지 않고 다음 단계로 간다.
 * - **오류**(그 외 예외) — 단계 구현의 버그. 그 자리에서 시나리오를 멈춘다.
 */

const PATH_SCHEMA = { type: 'string' } as const;

/** `/a/b` 위치에 값을 쓴다. */
export const setStep: StepDefinition = {
  id: 'set',
  title: '값을 쓴다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-set.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['path', 'value'],
    properties: { path: PATH_SCHEMA, value: true },
  },
  apply: (state, params) => writePath(state, params['path'] as string, params['value'] as JsonValue),
};

/** 수를 더한다. 대상이 수가 아니면 거부한다 — 조용히 NaN 을 만들지 않는다. */
export const addStep: StepDefinition = {
  id: 'add',
  title: '수를 더한다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-add.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['path', 'amount'],
    properties: { path: PATH_SCHEMA, amount: { type: 'number' } },
  },
  apply: (state, params) => {
    const path = params['path'] as string;
    const current = readPath(state, path);
    if (typeof current !== 'number') {
      throw new StepRejection('E_NOT_A_NUMBER', path, `${path} 가 수가 아니다: ${JSON.stringify(current ?? null)}`);
    }
    return writePath(state, path, current + (params['amount'] as number));
  },
};

/**
 * 자원을 소비한다. 남은 양이 모자라면 **아무것도 바꾸지 않고** 거부한다.
 *
 * VS0(원문 「20」)의 "네 번째 행동은 실패한다 / 상태를 전혀 변경하지 않는다"가 바로 이 형태다.
 * 세계 규칙 자체는 K2 의 몫이지만, 시나리오 실행기가 그 형태를 실제로 실행할 수 있는지는 여기서 확인한다.
 */
export const consumeStep: StepDefinition = {
  id: 'consume',
  title: '자원을 소비한다 (모자라면 거부)',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-consume.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['path', 'amount'],
    properties: { path: PATH_SCHEMA, amount: { type: 'number', exclusiveMinimum: 0 } },
  },
  apply: (state, params) => {
    const path = params['path'] as string;
    const amount = params['amount'] as number;
    const current = readPath(state, path);
    if (typeof current !== 'number') {
      throw new StepRejection('E_NOT_A_NUMBER', path, `${path} 가 수가 아니다: ${JSON.stringify(current ?? null)}`);
    }
    if (current < amount) {
      throw new StepRejection(
        'E_INSUFFICIENT',
        path,
        `${path} 가 ${current} 뿐이라 ${amount} 를 소비할 수 없다.`,
      );
    }
    return writePath(state, path, current - amount);
  },
};

/** 배열 끝에 값을 붙인다. 대상이 배열이 아니면 거부한다. */
export const appendStep: StepDefinition = {
  id: 'append',
  title: '배열에 값을 붙인다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-append.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['path', 'value'],
    properties: { path: PATH_SCHEMA, value: true },
  },
  apply: (state, params) => {
    const path = params['path'] as string;
    const current = readPath(state, path);
    if (!Array.isArray(current)) {
      throw new StepRejection('E_NOT_AN_ARRAY', path, `${path} 가 배열이 아니다.`);
    }
    return writePath(state, `${path}/-`, params['value'] as JsonValue);
  },
};

/**
 * 사건을 기록한다. id 와 시각은 V2 가 주므로 재실행해도 같은 값이 나온다
 * (UUID v4 나 `Date.now()` 를 쓰면 리플레이 대조가 불가능해진다 — GI-12).
 */
export const recordEventStep: StepDefinition = {
  id: 'record_event',
  title: '사건을 기록한다 (결정적 id·시각)',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-record-event.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['path', 'kind'],
    properties: { path: PATH_SCHEMA, kind: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' }, detail: true },
  },
  apply: (state, params, context) => {
    const path = params['path'] as string;
    const current = readPath(state, path);
    if (!Array.isArray(current)) {
      throw new StepRejection('E_NOT_AN_ARRAY', path, `${path} 가 배열이 아니다.`);
    }
    const kind = params['kind'] as string;
    const entry: JsonObject = {
      id: context.nextId(kind),
      kind,
      tick: context.tick,
      timeMs: context.timeMs,
      detail: (params['detail'] ?? null) as JsonValue,
    };
    return writePath(state, `${path}/-`, entry);
  },
};

/** 결정적 난수를 상태에 쓴다 — 같은 시드면 같은 값이 나오는지 눈으로 보기 위한 단계다. */
export const rollStep: StepDefinition = {
  id: 'roll',
  title: '결정적 난수를 굴린다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-roll.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['path', 'min', 'max'],
    properties: { path: PATH_SCHEMA, min: { type: 'integer' }, max: { type: 'integer' } },
  },
  apply: (state, params, context) => {
    const min = params['min'] as number;
    const max = params['max'] as number;
    if (max <= min) {
      throw new StepRejection('E_EMPTY_RANGE', '/params/max', `빈 범위다: [${min}, ${max})`);
    }
    return writePath(state, params['path'] as string, context.randomInt(min, max));
  },
};

/** 값을 지운다. 없으면 거부한다 — "지웠다"와 "원래 없었다"를 구분한다. */
export const removeStep: StepDefinition = {
  id: 'remove',
  title: '값을 지운다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-remove.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['path'],
    properties: { path: PATH_SCHEMA },
  },
  apply: (state, params) => {
    const path = params['path'] as string;
    if (readPath(state, path) === undefined) {
      throw new StepRejection('E_ABSENT', path, `${path} 에 지울 값이 없다.`);
    }
    const tokens = parsePointer(path);
    const last = tokens.pop() as string;
    const parentPath = tokens.map((token) => `/${escapeToken(token)}`).join('');
    const parent = readPath(state, parentPath);
    if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
      throw new StepRejection('E_NOT_AN_OBJECT', parentPath, `${parentPath} 가 객체가 아니라 항목을 지울 수 없다.`);
    }
    const nextParent: JsonObject = { ...(parent as JsonObject) };
    delete nextParent[last];
    return writePath(state, parentPath, nextParent);
  },
};

/** 일부러 터지는 단계 — "버그는 거부와 다르게 다뤄진다"를 보이기 위한 것이다. */
export const failStep: StepDefinition = {
  id: 'fail',
  title: '구현 버그를 흉내 낸다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v3-step-fail.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['message'],
    properties: { message: { type: 'string', minLength: 1 } },
  },
  apply: (_state, params) => {
    throw new Error(params['message'] as string);
  },
};

/** 기본 단계 목록 (id 오름차순). */
export const BUILTIN_STEPS: readonly StepDefinition[] = [
  addStep,
  appendStep,
  consumeStep,
  failStep,
  recordEventStep,
  removeStep,
  rollStep,
  setStep,
];
