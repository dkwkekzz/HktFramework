// P2-b·c 단위 테스트 — 문화가 얹히고 금기가 덜어 내고, 갈래가 한 번 더 좁아진다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { evaluatePressure, snapshotOf, type SlotValue } from '../../src/d4/index.ts';
import { expandStrategies } from '../../src/p1/index.ts';
import {
  allows,
  buildGrammar,
  checkExamples,
  checkGrammar,
  diffGrammars,
  entryOf,
  EXAMPLE_LINES,
  exampleVerdict,
  grammarVerdict,
  narrowTree,
  narrowVerdict,
  type AbilityGrant,
  type AtomBan,
} from '../../src/p2/index.ts';

import { beast, beastBlueprint, berryId, denId } from '../d2/fixture.ts';
import { baseGraphOf, drawId, plain } from '../d3/fixture.ts';

void beastBlueprint;

const cultureId = deterministicId('rule', 'culture', '굴을 지키는 무리');
const roleId = deterministicId('rule', 'role', '굴지기');

/** 최소 문화·역할 — P2 가 보는 것만 채운다 (S2 조립은 시나리오 장면이 맡는다). */
const culture = {
  kind: 'Rule' as const,
  id: cultureId,
  domain: 'psychic' as const,
  name: '굴을 지키는 무리',
  when: ['굴에서 함께 겨울을 난다'],
  then: ['굴을 해치는 것을 하지 않는다'],
  axiomId: null,
  speciesIds: [beast.id],
  readings: [],
  values: [],
  taboos: [],
  roles: [],
};
const role = {
  kind: 'Rule' as const,
  id: roleId,
  domain: 'psychic' as const,
  name: '굴지기',
  when: ['굴 어귀를 지킨다'],
  then: ['의념으로 굴을 덮는다'],
  axiomId: null,
  cultureId,
  grants: [drawId],
  taboos: [],
  readings: [],
  values: [],
};

const grants: readonly AbilityGrant[] = [
  { abilityId: drawId, atoms: ['protect', 'conceal'], note: '의념 흡수는 굴을 덮는 데 쓰인다' },
];
const bans: readonly AtomBan[] = [
  { ruleId: cultureId, atoms: ['destroy'], note: '굴을 해치는 것은 하지 않는다' },
];

const bare = buildGrammar({ archetype: beast, culture, role: null, capabilities: [] });
const keeper = buildGrammar({
  archetype: beast,
  culture,
  role,
  capabilities: [drawId],
  grants,
  bans,
});

describe('문법 세우기', () => {
  test('유형이 깔고 능력이 얹고 금기가 덜어 낸다', () => {
    assert.equal(bare.allowed.length, 12); // 생물 — 합의 셋과 배신을 못 낸다
    assert.equal(keeper.allowed.length, 11); // 금기가 제거 하나를 더 닫는다
    assert.deepEqual(keeper.banned, ['destroy']);
    assert.deepEqual(keeper.empowered, ['protect', 'conceal']);
    assert.match(grammarVerdict(keeper), /열여섯 중 11을 낸다/);
  });

  test('능력은 대가를 몸에서 의념으로 옮긴다 — 여는 것이 아니다', () => {
    assert.equal(entryOf(bare, 'protect')?.access, 'direct');
    assert.equal(entryOf(keeper, 'protect')?.access, 'viaAbility');
    assert.equal(entryOf(keeper, 'protect')?.openedBy, 'ability');
    assert.match(entryOf(keeper, 'protect')?.note ?? '', /의념으로 옮겨 간다/);
  });

  test('능력은 유형이 막은 자리를 열지 못한다', () => {
    const impossible = buildGrammar({
      archetype: beast,
      culture,
      role,
      capabilities: [drawId],
      grants: [{ abilityId: drawId, atoms: ['ally'], note: '말을 하게 해 준다고 적어도' }],
    });
    assert.equal(allows(impossible, 'ally'), false);
    assert.equal(entryOf(impossible, 'ally')?.closedBy, 'kind');
  });

  test('금기는 낼 손이 있는 것만 닫는다 — 닫힌 것도 자리를 지킨다', () => {
    assert.equal(keeper.entries.length, 16);
    assert.equal(entryOf(keeper, 'destroy')?.closedBy, 'taboo');
    assert.equal(entryOf(keeper, 'destroy')?.byRuleId, cultureId);
    assert.match(entryOf(keeper, 'destroy')?.note ?? '', /낼 손은 있으나 하지 않는다/);
  });

  test('같은 종의 둘이 어디서 갈리는지 표로 남는다', () => {
    const diff = diffGrammars(bare, keeper);
    assert.deepEqual(diff.onlyLeft, ['destroy']);
    assert.deepEqual(diff.onlyRight, []);
    assert.deepEqual(diff.differentAccess, ['보호: direct ↔ viaAbility', '은폐: direct ↔ viaAbility']);
  });

  test('내 능력이 아닌 배정·내 문화가 아닌 금기는 얹히지 않는다', () => {
    const stranger = buildGrammar({ archetype: beast, culture, role: null, capabilities: [], grants, bans: [{ ruleId: deterministicId('rule', 'culture', '남의 문화'), atoms: ['destroy'], note: '' }] });
    assert.deepEqual(stranger.empowered, []);
    assert.deepEqual(stranger.banned, []);
  });
});

describe('설 수 없는 문법', () => {
  const spec = { archetype: beast, culture, role, capabilities: [drawId], grants, bans };

  test('온전한 문법은 아무것도 걸리지 않는다', () => {
    assert.deepEqual(checkGrammar(keeper, spec), []);
  });

  test('그 종이 지닐 수 없는 문화는 거부된다 (S2 조항)', () => {
    const foreign = { ...spec, culture: { ...culture, speciesIds: [] } };
    assert.equal(checkGrammar(keeper, foreign)[0]?.rule, 'foreign-culture');
  });

  test('문화 없이 자리만 선 개체·남의 문화의 자리는 거부된다', () => {
    assert.equal(checkGrammar(keeper, { ...spec, culture: null })[0]?.rule, 'roleless-grant');
    assert.equal(
      checkGrammar(keeper, {
        ...spec,
        role: { ...role, cultureId: deterministicId('rule', 'culture', '다른 무리') },
      })[0]?.rule,
      'roleless-grant',
    );
  });

  test('세계에 없는 능력이 원자를 싣는다고 적으면 거부된다', () => {
    const other = { ...beast, id: deterministicId('rule', 'ability', '없는 능력') };
    const violations = checkGrammar(keeper, spec, [other]);
    assert.equal(violations[0]?.rule, 'unknown-ability');
  });

  test('16원자 밖을 싣거나 금하면 거부된다', () => {
    assert.equal(
      checkGrammar(keeper, {
        ...spec,
        grants: [{ abilityId: drawId, atoms: ['fly' as never], note: '난다' }],
      })[0]?.rule,
      'phantom-atom',
    );
    assert.equal(
      checkGrammar(keeper, {
        ...spec,
        bans: [{ ruleId: cultureId, atoms: ['fly' as never], note: '날지 않는다' }],
      })[0]?.rule,
      'phantom-atom',
    );
  });

  test('아무도 열지 않은 것은 금할 수 없다 (S2 선례)', () => {
    const violations = checkGrammar(keeper, {
      ...spec,
      bans: [{ ruleId: cultureId, atoms: ['ally'], note: '짐승에게 금할 수 없는 것' }],
    });
    assert.equal(violations[0]?.rule, 'ungranted-taboo');
  });

  test('배정에 까닭을 적지 않으면 걸린다', () => {
    const violations = checkGrammar(keeper, {
      ...spec,
      grants: [{ abilityId: drawId, atoms: ['protect'], note: '' }],
    });
    assert.equal(violations[0]?.rule, 'unreasoned-denial');
  });

  test('금기가 전부를 닫으면 그 개체는 아무것도 하지 못한다', () => {
    const muted = buildGrammar({
      ...spec,
      bans: [{ ruleId: cultureId, atoms: [...bare.allowed], note: '전부 금한다' }],
    });
    assert.equal(muted.allowed.length, 0);
    assert.equal(checkGrammar(muted, { ...spec, bans: [{ ruleId: cultureId, atoms: [...bare.allowed], note: '전부 금한다' }] })[0]?.rule, 'total-taboo');
  });
});

describe('갈래 좁히기와 원문 대조', () => {
  const graph = baseGraphOf(plain);
  const slots: readonly SlotValue[] = [
    { domain: 'biological', path: 'hunger', holderId: plain.id, value: 0.3 },
    { domain: 'biological', path: 'fertility', holderId: plain.id, value: 0.5 },
    { domain: 'economic', path: `stock.${berryId}`, holderId: plain.id, value: 0 },
    { domain: 'physical', path: 'region', holderId: plain.id, value: denId },
  ];
  const tree = expandStrategies(graph, evaluatePressure(graph, snapshotOf(slots, 100).snapshot));

  test('문법은 닫기만 한다 — 넓히면 그것은 좁히기가 아니다', () => {
    const narrowed = narrowTree(tree, bare);
    assert.deepEqual(narrowed.violations, []);
    assert.ok(narrowed.openAfter <= narrowed.openBefore);
  });

  test('생물은 말이 없어 위임이 닫힌다 — 같은 결핍, 다른 갈래', () => {
    const narrowed = narrowTree(tree, bare);
    const branch = narrowed.branches[0];
    assert.ok((branch?.closedByGrammar ?? []).includes('delegate'));
    assert.match(narrowVerdict(narrowed), /문법이 닫은 방향/);
  });

  test('충족의 원자도 걸러진다 — 짐승은 사지 못한다', () => {
    const narrowed = narrowTree(tree, bare);
    const fulfill = narrowed.branches[0]?.options.find((option) => option.direction === 'fulfill');
    assert.ok((fulfill?.removed ?? []).includes('exchange'));
    assert.ok((fulfill?.atoms ?? []).includes('acquire'));
  });

  test('닫힌 갈래는 무엇이 닫았는지를 말한다', () => {
    const narrowed = narrowTree(tree, keeper);
    for (const branch of narrowed.branches) {
      for (const option of branch.options) {
        if (option.open) continue;
        assert.notEqual(option.closedBy, null, option.direction);
      }
    }
  });

  test('원문 P2 다섯 줄 열다섯 행동이 전부 유형 격자에서 도출된다', () => {
    const report = checkExamples();
    assert.equal(EXAMPLE_LINES.length, 5);
    assert.equal(report.checks.length, 15);
    assert.deepEqual(report.unreachable, []);
    assert.equal(report.complete, true);
    assert.match(exampleVerdict(report), /전부 유형 격자에서 도출된다/);
  });

  test('격자가 틀리면 원문 예시가 도달되지 않는 것으로 드러난다', () => {
    const broken = checkExamples([
      { subjectKind: 'god', names: ['이동'], source: '신이 걷는다고 적으면' },
    ]);
    assert.equal(broken.violations[0]?.rule, 'unreachable-example');
    assert.match(exampleVerdict(broken), /도달되지 않는다/);
  });

  test('P0 환원표에 없는 이름은 대조할 수 없다', () => {
    const broken = checkExamples([
      { subjectKind: 'person', names: ['명상'], source: '원문에 없는 이름' },
    ]);
    assert.equal(broken.violations[0]?.rule, 'unresolved-example');
  });

  test('유형이 낼 수 있는데 원문이 예로 들지 않은 원자도 값으로 남는다', () => {
    const report = checkExamples();
    assert.ok((report.unusedByOriginal['person'] ?? []).includes('betray'));
    assert.ok((report.unusedByOriginal['god'] ?? []).includes('conceal'));
  });
});
