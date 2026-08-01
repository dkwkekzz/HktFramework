// O2 검증 시나리오 3종 — 세계의 모든 상태 값이 9영역 필드 트리 하나로 서는가,
// 그리고 그 트리에 없는 값은 걸리는가.

import { stateHash } from '@hkt/core/v1';
import { classify } from '@hkt/core/o1';
import {
  assembleWorld,
  checkAgainstSchema,
  countSlots,
  disassembleWorld,
  emptyWorld,
  readSlot,
  reconcileDomains,
  reconciliationVerdict,
  schemaReport,
  schemaVerdict,
  STATE_DOMAINS,
  STATE_SCHEMA,
  slotStateId,
  worldDiff,
  worldHolders,
  type OriginalField,
  type State,
  type StateDomain,
} from '@hkt/core';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  healingClaim,
  herbId,
  hunger,
  hunterId,
  HUNTER_WORLD,
  HUNTER_WORLD_LATER,
  merchantId,
  motherGodId,
  nestId,
  OFF_SCHEMA_STATES,
  toxin,
  villageId,
} from './o2-hunter-world.ts';

/** 상태를 자리 이름으로 접는다 — 순서에 흔들리지 않게 비교하려고. */
function slotKeys(states: readonly State[]): string[] {
  return states.map((state) => `${state.domain}.${state.ofId}.${state.path}`).sort();
}

/** 정상 — 한 컷의 세계가 9영역 트리로 서고, 조립·분해를 왕복해도 같은 세계다. */
export const o2SceneAssembled = defineScenario({
  id: 'o2-scene-assembled',
  module: 'O2',
  kind: 'normal',
  purpose:
    '붉은 장막 사냥꾼의 지금이 9영역 트리로 서고, 조립·분해를 왕복해도 같은 세계로 돌아온다.',
  arrange: () => ({ states: HUNTER_WORLD, schema: STATE_SCHEMA }),
  act: ({ states, schema }) => {
    const assembled = assembleWorld(states, schema);
    const back = disassembleWorld(assembled.world);
    const again = assembleWorld(back, schema);
    const domainsUsed = STATE_DOMAINS.filter(
      (domain) => Object.keys(assembled.world[domain]).length > 0,
    );
    return {
      violations: assembled.violations.map((violation) => violation.rule),
      slots: countSlots(assembled.world),
      holders: worldHolders(assembled.world),
      domainsUsed,
      roundTrip: { before: slotKeys(states), after: slotKeys(back) },
      sameWorld: stateHash(assembled.world) === stateHash(again.world),
      // 입력 순서를 뒤집어도 같은 세계여야 한다 — 세계는 목록의 순서를 기억하지 않는다.
      orderFree:
        stateHash(assembled.world) === stateHash(assembleWorld([...states].reverse(), schema).world),
      // O1 이 만든 원소가 그대로 통과하는가 — 두 모듈이 어긋나지 않았다는 증거.
      o1States: [hunger, toxin].map((state) => checkAgainstSchema(schema, state).length),
      o1Classified: [hunger, toxin].map((state) => classify(state).kind),
      hunger: readSlot(assembled.world, 'biological', hunterId, 'hunger'),
      trust: readSlot(assembled.world, 'relational', hunterId, `trust.${merchantId}`),
      anchor: readSlot(assembled.world, 'transcendent', motherGodId, 'anchor'),
      schema: schemaReport(schema),
      reconciliation: reconcileDomains(),
    };
  },
  assert: (result): Assertion[] => [
    expectState('장면의 상태가 하나도 거부되지 않는다', [], result.violations),
    expectState('상태 하나가 자리 하나를 얻는다', HUNTER_WORLD.length, result.slots),
    expectState('9영역이 모두 쓰인다 — 어느 영역도 장식이 아니다', [...STATE_DOMAINS], [
      ...result.domainsUsed,
    ]),
    expectState(
      '세계에 이름이 오른 존재는 다섯 — 행상은 값으로만 등장한다',
      [herbId, hunterId, motherGodId, nestId, villageId].sort(),
      [...result.holders],
    ),
    expectState('조립했다가 분해하면 처음 자리로 돌아온다', result.roundTrip.before, result.roundTrip.after),
    expectTrue('다시 조립해도 같은 세계다', result.sameWorld),
    expectTrue('입력 순서를 뒤집어도 같은 세계다', result.orderFree),
    expectState('O1 이 만든 상태가 O2 스키마를 그대로 통과한다', [0, 0], result.o1States),
    expectState('그 상태들은 여전히 온전한 O1 State 다', ['State', 'State'], result.o1Classified),
    expectState('사냥꾼은 배고프다', 0.7, result.hunger),
    expectState('행상을 못 믿는다 — 불신은 음수다', -0.4, result.trust),
    expectState('어미의 앵커는 둥지다', nestId, result.anchor),
    expectTrue('스키마가 원문 필드를 다 담았다', result.schema.complete, schemaVerdict(result.schema)),
    expectTrue(
      '원문 두 목록이 9영역으로 해소됐다',
      result.reconciliation.complete,
      reconciliationVerdict(result.reconciliation),
    ),
    expectDeterministic('같은 상태 목록이면 같은 세계 해시', () =>
      stateHash(assembleWorld(HUNTER_WORLD).world),
    ),
  ],
});

/** 실패 — 스키마 밖의 값은 트리에 들어가지 못하고, 어디가 왜 틀렸는지가 함께 나온다. */
export const o2OffSchemaRejected = defineScenario({
  id: 'o2-offschema-rejected',
  module: 'O2',
  kind: 'failure',
  purpose:
    'O1 로서는 온전한 상태도 세계에 그런 자리가 없으면 거부되고, 사유와 자리가 함께 나온다.',
  arrange: () => ({ good: HUNTER_WORLD, bad: OFF_SCHEMA_STATES }),
  act: ({ good, bad }) => {
    const assembled = assembleWorld([...good, ...bad.map((entry) => entry.value)]);
    const duplicate = assembleWorld([hunger, { ...hunger, value: 0.1 }]);
    // 원문 필드 하나가 자리를 잃으면 대조가 무너진다.
    const missing = schemaReport({
      ...STATE_SCHEMA,
      fields: STATE_SCHEMA.fields.filter((field) => field.path !== 'grudge.{subject}'),
    });
    return {
      // 결함 상태 9종이 각자 어떤 사유로 걸리는가
      rejected: bad.map((entry) => ({
        broke: entry.broke,
        expected: entry.expected,
        actual: checkAgainstSchema(STATE_SCHEMA, entry.value)[0]?.rule ?? '(통과해 버렸다)',
      })),
      // O1 이 이미 막는 것과, O1 을 통과해 O2 에서 걸리는 것을 갈라 본다
      o1Verdicts: bad.map((entry) => classify(entry.value).kind),
      caughtOnlyByO2: bad.filter((entry) => classify(entry.value).kind === 'State').length,
      slots: countSlots(assembled.world),
      wheres: assembled.violations.map((violation) => violation.where),
      duplicateRules: duplicate.violations.map((violation) => violation.rule),
      duplicateKept: readSlot(duplicate.world, 'biological', hunterId, 'hunger'),
      missingComplete: missing.complete,
      missingVerdict: schemaVerdict(missing),
    };
  },
  assert: (result): Assertion[] => [
    expectState(
      '결함 상태 9종이 각자의 사유로 걸린다',
      result.rejected.map((entry) => `${entry.broke} → ${entry.expected}`),
      result.rejected.map((entry) => `${entry.broke} → ${entry.actual}`),
    ),
    expectState(
      '영역 이름만 O1 이 이미 막는다 — 나머지 8종은 O1 을 통과한 뒤 O2 에서 걸린다',
      [null, ...OFF_SCHEMA_STATES.slice(1).map(() => 'State')],
      result.o1Verdicts,
    ),
    expectState('O2 가 없으면 세계에 들어갔을 값이 8개다', 8, result.caughtOnlyByO2),
    expectState('거부된 값은 세계에 들어가지 않는다', HUNTER_WORLD.length, result.slots),
    expectTrue(
      '거부 사유는 고칠 자리를 그대로 가리킨다',
      result.wheres.every((where) => where.split('.').length >= 3),
      result.wheres,
    ),
    expectState('같은 자리에 값이 둘이면 뒤가 막힌다', ['duplicate-state'], result.duplicateRules),
    expectState('막힌 뒤에도 먼저 온 값이 세계로 남는다', 0.7, result.duplicateKept),
    expectTrue('원문 필드가 자리를 잃으면 스키마가 미완결이 된다', !result.missingComplete),
    expectTrue('무엇이 빠졌는지 판정 문장이 말해 준다', result.missingVerdict.includes('원한'), result.missingVerdict),
  ],
});

/** 경계 — 빈 세계·범위 양끝·매개 경로·전후 비교의 끝에서도 판정이 흔들리지 않는다. */
export const o2Boundary = defineScenario({
  id: 'o2-boundary',
  module: 'O2',
  kind: 'boundary',
  purpose: '빈 세계 · 범위 양끝 · 매개 경로 · 전후 비교의 끝에서도 판정이 흔들리지 않는다.',
  arrange: () => ({ empty: [] as readonly State[] }),
  act: ({ empty }) => {
    const blank = assembleWorld(empty);
    const before = assembleWorld(HUNTER_WORLD).world;
    const after = assembleWorld(HUNTER_WORLD_LATER).world;

    const at = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
      kind: 'State',
      id: slotStateId(domain, ofId, path),
      domain,
      ofId,
      path,
      value,
    });
    const passes = (state: State): boolean => checkAgainstSchema(STATE_SCHEMA, state).length === 0;

    return {
      blankSlots: countSlots(blank.world),
      blankDomains: Object.keys(blank.world),
      blankSameAsEmpty: stateHash(blank.world) === stateHash(emptyWorld()),
      // 비율의 양끝은 통과하고, 그 밖은 걸린다.
      ratioZero: passes(at('biological', hunterId, 'hunger', 0)),
      ratioOne: passes(at('biological', hunterId, 'hunger', 1)),
      ratioOver: passes(at('biological', hunterId, 'hunger', 1.0000001)),
      // 부호 비율은 -1 까지 간다 — 적대도 값이다.
      signedMin: passes(at('relational', hunterId, `trust.${merchantId}`, -1)),
      signedUnder: passes(at('relational', hunterId, `trust.${merchantId}`, -1.5)),
      // 정수 자리에 소수는 못 온다.
      integerOk: passes(at('ecological', nestId, 'population', 0)),
      integerFraction: passes(at('ecological', nestId, 'population', 40.5)),
      // 자기 자신을 가리키는 매개 경로도 자리로서는 온전하다 (뜻은 D·R 계층이 본다).
      selfParam: passes(at('relational', hunterId, `trust.${hunterId}`, 0)),
      // 매개 자리가 비면 자리가 아니다.
      emptyParam: passes(at('economic', hunterId, 'stock.', 1)),
      // 참거짓 자리에 0 은 안 된다 — 세계는 참거짓과 수를 섞지 않는다.
      flagZero: passes(at('informational', hunterId, `knows.${healingClaim.id}`, 0 as never)),
      // 전후 비교의 끝
      sameWorld: worldDiff(before, before).length,
      fromEmpty: worldDiff(emptyWorld(), before).length,
      toEmpty: worldDiff(before, emptyWorld()).length,
      later: worldDiff(before, after).map((entry) => `${entry.change} ${entry.path}`),
      // 원문 필드 대조가 빈 목록이면 아무것도 확인하지 않은 것이다.
      emptyOriginals: schemaReport(STATE_SCHEMA, [] as readonly OriginalField[]).complete,
    };
  },
  assert: (result): Assertion[] => [
    expectState('빈 세계에도 9영역이 서 있다', [...STATE_DOMAINS], result.blankDomains),
    expectState('빈 세계에는 값이 없다', 0, result.blankSlots),
    expectTrue('빈 목록으로 조립한 세계는 빈 세계와 같다', result.blankSameAsEmpty),
    expectState('비율 0 과 1 은 통과하고 그 밖은 걸린다', [true, true, false], [
      result.ratioZero,
      result.ratioOne,
      result.ratioOver,
    ]),
    expectState('부호 비율은 -1 까지 — 적대도 값이다', [true, false], [
      result.signedMin,
      result.signedUnder,
    ]),
    expectState('개체 수는 정수다', [true, false], [result.integerOk, result.integerFraction]),
    expectTrue('자기 자신을 가리키는 매개 경로도 자리로서는 온전하다', result.selfParam),
    expectTrue('매개 자리가 비면 자리가 아니다', !result.emptyParam),
    expectTrue('참거짓 자리에 0 은 오지 않는다', !result.flagZero),
    expectState('같은 세계면 차이가 없다', 0, result.sameWorld),
    expectState('빈 세계에서 보면 전부 생긴 것이다', HUNTER_WORLD.length, result.fromEmpty),
    expectState('빈 세계로 가면 전부 사라진 것이다', HUNTER_WORLD.length, result.toEmpty),
    expectState(
      '세 틱 뒤 — 바뀐 값 셋 · 사라진 자리 하나 · 생긴 자리 하나',
      [
        'added temperature',
        'changed hunger',
        `changed stock.${herbId}`,
        'changed vitality',
        `removed debt.${merchantId}`,
      ],
      [...result.later].sort(),
    ),
    expectTrue('대조할 원문 필드가 없으면 완결이 아니다', !result.emptyOriginals),
    expectDeterministic('같은 두 세계면 같은 차이 목록', () =>
      worldDiff(assembleWorld(HUNTER_WORLD).world, assembleWorld(HUNTER_WORLD_LATER).world),
    ),
  ],
});

export const o2Scenarios = [o2SceneAssembled, o2OffSchemaRejected, o2Boundary] as const;
