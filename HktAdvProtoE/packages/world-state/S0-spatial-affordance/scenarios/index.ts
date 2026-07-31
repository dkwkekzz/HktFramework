import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { auditOutput, executeS0, S0_PURPOSE } from '../src/module.js';
import type { S0Input, S0Output, S0StepReport } from '../src/module.js';
import type { AffordanceOffer, Cell } from '../src/types.js';
import {
  AFFORDANCES,
  ARMLESS_GHOST,
  COMPONENT_DEFINITIONS,
  DETOUR_ROOM,
  LAYOUT,
  OPEN_DOOR,
  PATIENT_SCOUT,
  REACH_TEST,
  RULES,
  SHOVE_DOOR,
  TAKE_COIN,
  TAKE_KEY,
  TAKE_LOST_LANTERN,
  TAKE_RELIC,
  TAKE_WALL,
  TWO_ROOMS,
} from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): S0Input;
  check(input: S0Input, output: S0Output, context: ModuleContext): AssertionResult[];
  reasons(input: S0Input, output: S0Output): string[];
  candidates?(input: S0Input, output: S0Output): LabRow[];
  result?(output: S0Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<S0Input, S0Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeS0(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      return {
        purpose: S0_PURPOSE,
        input: [
          {
            label: '격자',
            value: `칸 ${input.layout.cellSize}m · ${input.layout.size.x}×${input.layout.size.y}×${input.layout.size.z} · 원점 (${input.layout.origin.x}, ${input.layout.origin.y}, ${input.layout.origin.z})`,
          },
          {
            label: '세계',
            value: input.world.operations
              .filter((operation): operation is Extract<typeof operation, { op: 'spawn' }> => operation.op === 'spawn')
              .map((operation) => operation.id)
              .join(', '),
          },
          ...input.affordances.map((affordance) => ({
            label: `행동 ${affordance.id}`,
            value: `${affordance.verb} → ${affordance.targetEntityId} · 능력 [${affordance.requiredCapabilities.join(', ') || '없음'}] · 비용 ${JSON.stringify(affordance.estimatedCost)}`,
          })),
          ...input.steps.map((step) => ({
            label: `걸음 ${step.id}`,
            value: describeStep(step),
          })),
        ],
        candidates: spec.candidates?.(input, output) ?? defaultCandidates(output),
        result: spec.result?.(output) ?? defaultResult(output),
        reasons: spec.reasons(input, output),
        before: `세계 해시 ${output.worldHashBefore.slice(0, 21)}…`,
        after: `세계 해시 ${output.worldHashAfter.slice(0, 21)}…${output.worldHashBefore === output.worldHashAfter ? ' (세계는 그대로다)' : ' (규칙이 세계를 바꿨다)'}`,
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 화면 보조
// ---------------------------------------------------------------------------

function describeStep(step: S0Input['steps'][number]): string {
  switch (step.kind) {
    case 'resolve':
      return `${step.actor} 가 지금 할 수 있는 것${step.verbs ? ` (동사 ${step.verbs.join('·')})` : ''}`;
    case 'act':
      return `${step.intent.actor} 가 ${step.intent.verb} → ${(step.intent.targets ?? []).join(', ')} (K2 규칙이 판정)`;
    case 'path':
      return `${step.from} → ${step.to} 길찾기`;
    default:
      return `${step.center} 반경 ${step.radius}m`;
  }
}

export function drawCells(cells: readonly Cell[]): string {
  return cells.map((cell) => `(${cell.ix},${cell.iy})`).join(' → ');
}

function offerLine(offer: AffordanceOffer): string {
  const cost = Object.entries(offer.cost)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, value]) => `${key} ${value}`)
    .join(' + ');
  if (offer.available) {
    return `가능 · 비용 ${cost} · ${offer.path?.cells.length === 1 ? '제자리' : drawCells(offer.path?.cells ?? [])}`;
  }
  return `불가 · ${offer.refusals.map((refusal) => `${refusal.code}${refusal.blockedBy.length > 0 ? ` [${refusal.blockedBy.join(', ')}]` : ''}`).join(' · ')}`;
}

function defaultCandidates(output: S0Output): LabRow[] {
  const rows: LabRow[] = [];
  for (const step of output.steps) {
    for (const offer of step.offers ?? []) {
      rows.push({ label: `${step.id}/${offer.affordanceId}`, value: offerLine(offer) });
    }
    if (step.path) {
      rows.push({
        label: `${step.id} 길`,
        value: step.path.found
          ? `${step.path.cost}m · ${drawCells(step.path.cells)}`
          : `막힘 · ${step.path.blockedBy.join(', ') || '길 없음'}`,
      });
    }
    if (step.range) {
      rows.push({ label: `${step.id} 반경`, value: `[${step.range.matched.join(', ')}] · ${step.range.reason}` });
    }
    if (step.outcome) {
      rows.push({
        label: `${step.id} 규칙`,
        value: step.outcome.ok
          ? `${step.outcome.appliedRuleId} 적용 · 변화 ${step.outcome.delta.length}건`
          : `거부 ${step.outcome.rejection?.code}`,
      });
    }
    if (step.rejection) rows.push({ label: `${step.id} 거부`, value: `${step.rejection.code} @ ${step.rejection.path}` });
  }
  return rows;
}

function defaultResult(output: S0Output): string {
  const parts = output.steps
    .filter((step) => step.offers !== null)
    .map((step) => {
      const open = (step.offers ?? []).filter((offer) => offer.available).map((offer) => offer.affordanceId);
      return `${step.id} → [${open.join(', ') || '가능한 행동 없음'}]`;
    });
  return parts.join(' / ') || output.steps.map((step) => step.id).join(' / ');
}

// ---------------------------------------------------------------------------
// 단정 도우미
// ---------------------------------------------------------------------------

const eq = (id: string, expected: unknown, actual: unknown, reason?: string): AssertionResult => ({
  id,
  passed: JSON.stringify(expected) === JSON.stringify(actual),
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

const ok = (
  id: string,
  passed: boolean,
  expected: unknown,
  actual: unknown,
  reason?: string,
): AssertionResult => ({
  id,
  passed,
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

const stepOf = (output: S0Output, id: string): S0StepReport | undefined =>
  output.steps.find((step) => step.id === id);

const offerOf = (output: S0Output, stepId: string, affordanceId: string): AffordanceOffer | undefined =>
  stepOf(output, stepId)?.offers?.find((offer) => offer.affordanceId === affordanceId);

const codesOf = (offer: AffordanceOffer | undefined): string[] =>
  (offer?.refusals ?? []).map((refusal) => refusal.code);

const world = { components: COMPONENT_DEFINITIONS, operations: TWO_ROOMS };

// ---------------------------------------------------------------------------
// 1. 대표 검증 — 벽 너머는 못 잡고, 문을 열면 잡는다
// ---------------------------------------------------------------------------
const wallBlocksTheRelicUntilTheDoorOpens = defineScene({
  id: 'wall_blocks_the_relic_until_the_door_opens',
  title: '벽 너머 유물은 직접 획득할 수 없고, 문을 열면 접근 가능해진다',
  seed: 301n,
  arrange: () => ({
    world,
    layout: LAYOUT,
    affordances: AFFORDANCES,
    rules: RULES,
    steps: [
      { kind: 'resolve', id: 'before', actor: 'hunter' },
      { kind: 'act', id: 'open', intent: { id: 'open_1', actor: 'hunter', verb: 'open', targets: ['oak_door'] } },
      { kind: 'resolve', id: 'after', actor: 'hunter' },
    ],
  }),
  check: (input, output) => {
    const before = offerOf(output, 'before', 'take_relic');
    const after = offerOf(output, 'after', 'take_relic');
    const openBefore = offerOf(output, 'before', 'open_the_door');
    const openAfter = offerOf(output, 'after', 'open_the_door');
    const act = stepOf(output, 'open');

    return [
      eq('relic_is_not_takeable_through_the_wall', false, before?.available, '문이 닫혀 있는 동안'),
      eq('refusal_is_unreachable_not_condition', ['E_UNREACHABLE'], codesOf(before), '유물은 여전히 집을 수 있는 물건이다'),
      eq(
        'refusal_names_the_door_and_the_walls',
        ['oak_door', 'stone_wall_north', 'stone_wall_south'],
        before?.refusals[0]?.blockedBy,
        '무엇이 막았는지가 이름으로 남는다',
      ),
      eq('relic_is_not_even_visible', false, before?.visible, 'opaque 장애물이 시선을 끊는다'),
      eq('distance_alone_would_have_allowed_it', 5, before?.distance, '5m — 멀어서가 아니라 막혀서 못 간다'),
      eq('the_door_itself_is_reachable', true, openBefore?.available, '막은 것에는 손이 닿는다 — 그래서 다음 행동이 생긴다'),
      eq('opening_the_door_is_a_rule_not_a_side_effect', 'l1_open_a_door', act?.outcome?.appliedRuleId),
      eq(
        'the_change_is_recorded_as_a_delta',
        [
          'entity/hunter/components/stamina/current',
          'entity/oak_door/components/barrier/opaque',
          'entity/oak_door/components/barrier/solid',
        ],
        [...(act?.outcome?.delta ?? [])].map((delta) => delta.path).sort(),
        'GI-01 — 원인 없는 변화가 없다',
      ),
      eq('relic_is_takeable_after_the_door_opens', true, after?.available),
      eq('the_new_path_goes_through_the_doorway', '(1,2) → (2,2) → (3,2) → (4,2) → (5,2)', drawCells(after?.path?.cells ?? [])),
      eq('travel_cost_appears_only_when_there_is_a_path', { stamina: 1, movement: 4 }, after?.cost),
      eq('the_door_cannot_be_opened_twice', ['E_CONDITION_UNMET'], codesOf(openAfter), '열린 문은 조건이 어긋난다'),
      eq('coin_in_the_same_room_was_takeable_all_along', [true, true], [
        offerOf(output, 'before', 'take_coin')?.available,
        offerOf(output, 'after', 'take_coin')?.available,
      ]),
      eq('output_invariants', [], auditOutput(input, output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `문이 닫혀 있을 때: ${offerOf(output, 'before', 'take_relic')?.refusals[0]?.message}`,
    `문을 연 뒤: ${drawCells(offerOf(output, 'after', 'take_relic')?.path?.cells ?? [])} · 비용 ${JSON.stringify(offerOf(output, 'after', 'take_relic')?.cost)}`,
    '세계를 바꾼 것은 S0 이 아니라 K2 의 규칙이다. S0 은 바뀐 세계를 다시 읽었을 뿐이며, 그 사이에 유물은 한 발짝도 움직이지 않았다.',
  ],
});

// ---------------------------------------------------------------------------
// 2. 벽이 있으면 우회한다 (VS1 완료 조건)
// ---------------------------------------------------------------------------
const pathGoesAroundTheWall = defineScene({
  id: 'path_goes_around_the_wall',
  title: '끝이 트인 벽은 통과하지 않고 돌아간다 — 직선 5걸음이 8걸음이 된다',
  seed: 302n,
  arrange: () => ({
    world: { components: COMPONENT_DEFINITIONS, operations: DETOUR_ROOM },
    layout: LAYOUT,
    affordances: [TAKE_RELIC],
    steps: [
      { kind: 'resolve', id: 'detour', actor: 'hunter' },
      { kind: 'path', id: 'straight_line', from: 'hunter', to: 'sealed_relic' },
    ],
  }),
  check: (input, output) => {
    const offer = offerOf(output, 'detour', 'take_relic');
    const path = stepOf(output, 'straight_line')?.path;
    const crossesTheWall = (offer?.path?.cells ?? []).some((cell) => cell.ix === 4 && cell.iy <= 3);

    return [
      eq('the_relic_is_reachable', true, offer?.available, '벽이 끝까지 막지 않았다'),
      eq(
        'the_path_climbs_over_the_open_end',
        '(1,2) → (1,3) → (1,4) → (2,4) → (3,4) → (4,4) → (5,4) → (5,3) → (6,3)',
        drawCells(offer?.path?.cells ?? []),
      ),
      eq('detour_costs_eight_steps', 8, offer?.path?.cost, '직선이면 4걸음이면 닿을 자리다'),
      ok('the_path_never_enters_the_wall', !crossesTheWall, '벽 칸을 밟지 않는다', offer?.path?.cells),
      eq('travel_cost_is_the_detour_not_the_straight_line', { stamina: 1, movement: 8 }, offer?.cost),
      eq('walking_onto_the_relic_cell_is_also_a_detour', 9, path?.cost, '유물 칸까지 걸어가면 한 걸음 더다'),
      eq('the_relic_is_not_visible_through_the_wall', false, offer?.visible),
      eq('output_invariants', [], auditOutput(input, output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `우회 경로: ${drawCells(offerOf(output, 'detour', 'take_relic')?.path?.cells ?? [])}`,
    '여섯 방향(축 정렬)만 허용하므로 두 벽이 만나는 모서리를 사선으로 빠져나갈 수 없다. 대각선을 허용하면 "양옆이 뚫려 있을 때만"이라는 예외를 더 두어야 하고, 그 예외는 언젠가 빠뜨린다.',
    '길은 격자 위에서만 정해진다 — 벽의 메시가 어떻게 생겼든 규칙이 보는 것은 축 정렬 상자뿐이다(원본 18.4).',
  ],
});

// ---------------------------------------------------------------------------
// 3. 거리와 접근 가능성은 다른 것이다
// ---------------------------------------------------------------------------
const reachNeedsAClearLineNotJustDistance = defineScene({
  id: 'reach_needs_a_clear_line_not_just_distance',
  title: '손이 닿을 거리여도 사이에 문이 있으면 닿지 않는다',
  seed: 303n,
  arrange: () => ({
    world: { components: COMPONENT_DEFINITIONS, operations: REACH_TEST },
    layout: LAYOUT,
    affordances: [TAKE_KEY, OPEN_DOOR],
    rules: RULES,
    steps: [
      { kind: 'resolve', id: 'blocked', actor: 'hunter' },
      { kind: 'act', id: 'open', intent: { id: 'open_1', actor: 'hunter', verb: 'open', targets: ['oak_door'] } },
      { kind: 'resolve', id: 'cleared', actor: 'hunter' },
    ],
  }),
  check: (input, output) => {
    const blocked = offerOf(output, 'blocked', 'take_key');
    const cleared = offerOf(output, 'cleared', 'take_key');

    return [
      eq('the_key_is_within_arm_reach', 2, blocked?.distance, '닿는 거리는 2.5m 다'),
      eq('but_it_is_not_takeable', false, blocked?.available),
      eq('the_door_is_on_the_straight_line', ['oak_door'], blocked?.lineBlockers),
      ok(
        'the_message_says_reach_is_not_the_problem',
        blocked?.refusals[0]?.message.includes('손이 닿지만') === true,
        '거리가 아니라 사이의 것이 문제다',
        blocked?.refusals[0]?.message,
      ),
      eq('nothing_moved_but_the_door_state', true, cleared?.available, '문을 연 뒤'),
      eq('the_actor_did_not_take_a_single_step', 0, cleared?.path?.cost, '제자리에서 닿는다'),
      eq('so_there_is_no_travel_cost', { stamina: 1 }, cleared?.cost, '이동하지 않았으니 이동 비용도 없다'),
      eq('the_key_becomes_visible_too', [false, true], [blocked?.visible, cleared?.visible]),
      eq('output_invariants', [], auditOutput(input, output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `문이 닫혀 있을 때: 거리 ${offerOf(output, 'blocked', 'take_key')?.distance}m · ${offerOf(output, 'blocked', 'take_key')?.refusals[0]?.message}`,
    '“닿는 자리”는 대상까지의 거리만으로 정해지지 않는다. 그 자리에서 대상까지 직선이 뚫려 있어야 한다 — 그래야 벽에 등을 대고 벽 너머를 집는 일이 생기지 않는다.',
    '문은 열려도 사라지지 않는다. `solid` 가 거짓이 되었을 뿐이고, 같은 실체가 여전히 그 자리에 있다.',
  ],
});

// ---------------------------------------------------------------------------
// 4. 색인은 성능만 바꾸고 답을 바꾸지 않는다
// ---------------------------------------------------------------------------
const spatialIndexAgreesWithFullScan = defineScene({
  id: 'spatial_index_agrees_with_full_scan',
  title: '격자로 좁힌 반경 질의가 전수 조회와 언제나 같다',
  seed: 304n,
  arrange: () => ({
    world,
    layout: LAYOUT,
    affordances: [],
    steps: [
      { kind: 'range', id: 'touching', center: 'hunter', radius: 0 },
      { kind: 'range', id: 'near', center: 'hunter', radius: 1.5 },
      { kind: 'range', id: 'room', center: 'hunter', radius: 3 },
      { kind: 'range', id: 'everything', center: 'hunter', radius: 40 },
      { kind: 'range', id: 'from_the_door', center: 'oak_door', radius: 3 },
    ],
  }),
  check: (input, output) => {
    const matched = (id: string): string[] => stepOf(output, id)?.range?.matched ?? [];
    const disagreements = output.steps.filter(
      (step) => step.range && JSON.stringify(step.range.matched) !== JSON.stringify(step.rangeByFullScan),
    );

    return [
      eq('a_zero_radius_finds_only_what_is_underfoot', ['hunter'], matched('touching')),
      eq('nearby_uses_the_box_not_the_centre', ['dropped_coin', 'hunter'], matched('near'), '동전은 1.41m 떨어져 있다'),
      eq(
        'the_wall_is_found_by_its_surface',
        ['dropped_coin', 'hunter', 'oak_door', 'stone_wall_north', 'stone_wall_south'],
        matched('room'),
        '중심 거리로 쟀다면 3.5m 짜리 벽을 놓쳤을 것이다',
      ),
      ok(
        'the_entity_outside_the_grid_is_not_lost',
        matched('everything').includes('far_watchtower'),
        'far_watchtower 도 잡힌다',
        matched('everything'),
      ),
      eq(
        'the_door_sees_both_rooms',
        ['dropped_coin', 'hunter', 'oak_door', 'sealed_relic', 'stone_wall_north', 'stone_wall_south'],
        matched('from_the_door'),
        '반경 질의는 벽을 뚫는다 — 막힘 판정은 경로가 한다',
      ),
      eq('index_and_full_scan_never_disagree', [], disagreements.map((step) => step.id)),
      ok(
        'the_index_actually_narrowed_something',
        (stepOf(output, 'touching')?.range?.scanned ?? 99) < (stepOf(output, 'touching')?.range?.total ?? 0),
        '전수보다 적게 훑었다',
        [stepOf(output, 'touching')?.range?.scanned, stepOf(output, 'touching')?.range?.total],
      ),
      eq('output_invariants', [], auditOutput(input, output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.steps
      .filter((step) => step.range)
      .map((step) => `${step.id}: [${step.range?.matched.join(', ')}] · ${step.range?.reason}`)
      .join('\n'),
    '색인은 답을 정하지 않는다 — 후보를 좁힐 뿐이고, 좁힌 답은 전수 조회와 반드시 같아야 한다. 다르면 그것은 최적화가 아니라 버그다(K1 의 질의 계획과 같은 규율).',
    '격자 밖에 있는 실체는 어느 칸에도 들어가지 않으므로, 따로 들고 있다가 모든 반경 질의에 함께 넣는다.',
  ],
  candidates: (_input, output) =>
    output.steps
      .filter((step) => step.range)
      .map((step) => ({
        label: step.id,
        value: `색인 [${step.range?.matched.join(', ')}] · 전수 [${step.rangeByFullScan?.join(', ')}] · 칸 ${step.range?.cellsScanned}개 · 후보 ${step.range?.scanned}/${step.range?.total}`,
      })),
  result: (output) =>
    output.steps
      .filter((step) => step.range)
      .map((step) => `${step.id}=${step.range?.matched.length}`)
      .join(' / '),
});

// ---------------------------------------------------------------------------
// 5. 거절의 갈래는 섞이지 않는다
// ---------------------------------------------------------------------------
const capabilityAndConditionAreSeparateRefusals = defineScene({
  id: 'capability_and_condition_are_separate_refusals',
  title: '능력 없음 · 조건 어긋남 · 닿지 않음 · 대상 없음이 각자의 코드로 남는다',
  seed: 305n,
  arrange: () => ({
    world: { components: COMPONENT_DEFINITIONS, operations: [...TWO_ROOMS, ...ARMLESS_GHOST] },
    layout: LAYOUT,
    affordances: [TAKE_RELIC, TAKE_COIN, TAKE_WALL, TAKE_LOST_LANTERN],
    steps: [
      { kind: 'resolve', id: 'ghost', actor: 'armless_ghost' },
      { kind: 'resolve', id: 'hunter', actor: 'hunter' },
    ],
  }),
  check: (input, output) => {
    const ghostRelic = offerOf(output, 'ghost', 'take_relic');
    const ghostCoin = offerOf(output, 'ghost', 'take_coin');
    const hunterWall = offerOf(output, 'hunter', 'take_wall');
    const hunterLantern = offerOf(output, 'hunter', 'take_lost_lantern');

    return [
      eq('armless_ghost_stands_next_to_the_relic', 1, ghostRelic?.distance, '닿는 거리 안에 있다'),
      eq('but_it_has_no_hands', ['E_MISSING_CAPABILITY'], codesOf(ghostRelic), '공간의 문제가 아니다'),
      ok(
        'the_missing_capability_is_named',
        ghostRelic?.refusals[0]?.message.includes('grasp') === true,
        'grasp 를 지목한다',
        ghostRelic?.refusals[0]?.message,
      ),
      eq(
        'two_independent_refusals_do_not_merge',
        ['E_MISSING_CAPABILITY', 'E_UNREACHABLE'],
        codesOf(ghostCoin),
        '손도 없고 벽 너머이기도 하다',
      ),
      eq('the_wall_is_close_enough_but_is_not_a_thing_you_take', ['E_CONDITION_UNMET'], codesOf(hunterWall)),
      eq(
        'the_failing_condition_is_pointed_at',
        ['target.tags'],
        (hunterWall?.refusals[0]?.causes ?? []).map((cause) => cause.at),
        'K1 이 어긴 잎 조건을 지목한다',
      ),
      eq('a_target_that_does_not_exist_is_its_own_answer', ['E_UNKNOWN_TARGET'], codesOf(hunterLantern), '막힌 것과 사라진 것은 다르다'),
      eq('a_missing_target_has_no_path_and_no_distance', [null, null], [hunterLantern?.path, hunterLantern?.distance]),
      eq(
        'every_refused_offer_still_carries_its_cost',
        [true, true, true, true],
        [ghostRelic, ghostCoin, hunterWall, hunterLantern].map((offer) => Object.keys(offer?.cost ?? {}).length > 0),
        '비용 없는 행동은 두지 않는다 (GI-06)',
      ),
      eq('output_invariants', [], auditOutput(input, output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.steps
      .flatMap((step) => (step.offers ?? []).map((offer) => `${step.id}/${offer.affordanceId}: ${offerLine(offer)}`))
      .join('\n'),
    '네 갈래를 "불가능" 하나로 뭉치면 다음 행동이 나오지 않는다. 문이 막았다를 알아야 문을 여는 목적이 생기고, 손이 없다를 알아야 도구를 찾는 목적이 생긴다.',
    '거절은 하나만 돌려주지 않는다 — 손도 없고 벽 너머이기도 한 경우, 둘 다 고쳐야 그 행동이 열린다.',
  ],
});

// ---------------------------------------------------------------------------
// 6. 비용은 선언한 것 + S0 이 잰 이동
// ---------------------------------------------------------------------------
const estimatedCostCarriesTheTravel = defineScene({
  id: 'estimated_cost_carries_the_travel',
  title: '행동의 선언 비용은 그대로 두고, 이동 비용만 묻는 자리에 따라 달라진다',
  seed: 306n,
  arrange: () => ({
    world: { components: COMPONENT_DEFINITIONS, operations: [...TWO_ROOMS, ...PATIENT_SCOUT] },
    layout: LAYOUT,
    affordances: [OPEN_DOOR, SHOVE_DOOR],
    steps: [
      { kind: 'resolve', id: 'far', actor: 'hunter' },
      { kind: 'resolve', id: 'near', actor: 'patient_scout' },
    ],
  }),
  check: (input, output) => {
    const farOpen = offerOf(output, 'far', 'open_the_door');
    const nearOpen = offerOf(output, 'near', 'open_the_door');
    const farShove = offerOf(output, 'far', 'shove_the_door');
    const nearShove = offerOf(output, 'near', 'shove_the_door');

    return [
      eq('the_declared_cost_is_not_touched', [2, 2], [farOpen?.cost['stamina'], nearOpen?.cost['stamina']]),
      eq('the_traveller_pays_for_the_walk', 2, farOpen?.cost['movement'], '(1,2) 에서 두 걸음'),
      eq('the_one_already_there_pays_nothing', undefined, nearOpen?.cost['movement'], '이동이 없으면 항목 자체가 없다'),
      eq('both_can_open_the_same_door', [true, true], [farOpen?.available, nearOpen?.available]),
      eq(
        'a_declared_movement_cost_is_added_to_not_replaced',
        3,
        farShove?.cost['movement'],
        '선언 1 + 실제 이동 2',
      ),
      eq('and_stays_declared_when_there_is_no_travel', 1, nearShove?.cost['movement'], '선언 1 + 이동 0'),
      eq('the_shove_keeps_its_own_stamina', [4, 4], [farShove?.cost['stamina'], nearShove?.cost['stamina']]),
      eq(
        'the_same_affordance_yields_different_paths',
        ['(1,2) → (2,2) → (3,2)', '(3,2)'],
        [drawCells(farOpen?.path?.cells ?? []), drawCells(nearOpen?.path?.cells ?? [])],
      ),
      eq('output_invariants', [], auditOutput(input, output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `hunter: ${JSON.stringify(offerOf(output, 'far', 'open_the_door')?.cost)} · patient_scout: ${JSON.stringify(offerOf(output, 'near', 'open_the_door')?.cost)}`,
    '이동 비용을 `Affordance.estimatedCost` 에 미리 적어 둘 수 없는 이유가 여기 있다 — 같은 문이라도 누가 어디에서 묻느냐에 따라 값이 다르다. 대상에 붙는 값이 아니다.',
    '원문 「10」의 `Affordance` 는 한 칸도 늘리지 않았다. S0 은 선언된 비용을 고치지 않고, 자기가 잰 이동을 `movement` 항목으로 더한다.',
  ],
});

// ---------------------------------------------------------------------------
// 7. 물어보는 것은 세계를 바꾸지 않는다
// ---------------------------------------------------------------------------
const resolutionLeavesTheWorldUntouched = defineScene({
  id: 'resolution_leaves_the_world_untouched',
  title: '접근 가능성을 아무리 물어도 세계 해시가 그대로다',
  seed: 307n,
  arrange: () => ({
    world,
    layout: LAYOUT,
    affordances: AFFORDANCES,
    steps: [
      { kind: 'resolve', id: 'ask_1', actor: 'hunter' },
      { kind: 'path', id: 'walk', from: 'hunter', to: 'dropped_coin' },
      { kind: 'range', id: 'look', center: 'hunter', radius: 5 },
      { kind: 'resolve', id: 'ask_2', actor: 'hunter' },
      { kind: 'resolve', id: 'ask_3', actor: 'hunter' },
    ],
  }),
  check: (input, output) => {
    const changed = output.steps.filter((step) => step.hashBefore !== step.hashAfter);
    const again = executeS0(input);

    return [
      eq('no_step_changed_the_world', [], changed.map((step) => step.id)),
      eq('the_world_hash_is_the_same_at_both_ends', output.worldHashBefore, output.worldHashAfter),
      eq(
        'asking_three_times_gives_the_same_answer',
        JSON.stringify(stepOf(output, 'ask_1')?.offers),
        JSON.stringify(stepOf(output, 'ask_3')?.offers),
        'GI-12',
      ),
      eq('re_running_the_whole_input_is_identical', again.digest, output.digest),
      eq('a_rejected_step_is_recorded_not_thrown', null, stepOf(output, 'walk')?.rejection),
      ok(
        'the_offers_are_not_empty',
        (stepOf(output, 'ask_1')?.offers ?? []).length === 3,
        '세 행동이 모두 판정된다',
        (stepOf(output, 'ask_1')?.offers ?? []).map((offer) => offer.affordanceId),
      ),
      eq('output_invariants', [], auditOutput(input, output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `묻기 전 ${output.worldHashBefore}`,
    `묻고 난 뒤 ${output.worldHashAfter}`,
    'S0 은 K0 의 읽기만 부른다. K0 의 읽기는 동결 사본이므로 접근 가능성 계산이 세계를 잡을 손잡이가 없다. 세계를 바꾸려면 K2 의 규칙을 통과해야 한다(GI-01).',
  ],
});

export const s0Scenarios: VerificationScenario<S0Input, S0Output>[] = [
  wallBlocksTheRelicUntilTheDoorOpens,
  pathGoesAroundTheWall,
  reachNeedsAClearLineNotJustDistance,
  spatialIndexAgreesWithFullScan,
  capabilityAndConditionAreSeparateRefusals,
  estimatedCostCarriesTheTravel,
  resolutionLeavesTheWorldUntouched,
];
