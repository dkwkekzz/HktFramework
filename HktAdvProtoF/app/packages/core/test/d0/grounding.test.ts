// D0-b 단위 테스트 — 열한 종이 세계에 걸리는가, 그리고 선언한 종과 대상이 맞는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId as idOf, STATE_DOMAINS } from '../../src/index.ts';
import type { Claim, Commitment, Entity, Rule, State, Subject } from '../../src/o1/index.ts';
import type { Dependency } from '../../src/o1/index.ts';
import {
  checkDependencyTarget,
  checkGroundings,
  DEPENDENCY_KINDS,
  fitTarget,
  groundingSummary,
  groundingVerdict,
  KIND_GROUNDINGS,
  kindGrounding,
  kindsAccepting,
  type KindGrounding,
} from '../../src/d0/index.ts';

/** 붉은 장막 세계의 대상 후보들 — 전부 O1 원소로 선다. */
const driedMeat: Entity = {
  kind: 'Entity',
  id: idOf('entity', 'dried-meat'),
  entityKind: 'material',
  name: '말린 고기',
  locationId: null,
};
const ravine: Entity = {
  kind: 'Entity',
  id: idOf('entity', 'ravine'),
  entityKind: 'place',
  name: '붉은 장막 협곡',
  locationId: null,
};
const veilMother: Subject = {
  kind: 'Subject',
  id: idOf('subject', 'veil-mother'),
  subjectKind: 'god',
  name: '붉은 장막의 어미',
  partOfId: null,
};
const ravineWarmth: State = {
  kind: 'State',
  id: idOf('state', 'ravine-warmth'),
  domain: 'physical',
  ofId: ravine.id,
  path: 'temperature',
  value: 12,
};
const hunterHunger: State = {
  kind: 'State',
  id: idOf('state', 'hunter-hunger'),
  domain: 'biological',
  ofId: idOf('subject', 'beater-04'),
  path: 'hunger',
  value: 40,
};
const villageTrust: State = {
  kind: 'State',
  id: idOf('state', 'village-trust'),
  domain: 'relational',
  ofId: idOf('subject', 'trader-21'),
  path: 'trust.subject:0001',
  value: 0.6,
};
const passageLaw: Rule = {
  kind: 'Rule',
  id: idOf('rule', 'passage-law'),
  domain: 'institutional',
  name: '고개 통행법',
  when: ['통행권 없는 자가 고개에 들어선다'],
  then: ['이동이 막히고 현상금이 걸린다'],
  axiomId: null,
};
const poisonClaim: Claim = {
  kind: 'Claim',
  id: idOf('claim', 'poison-herb'),
  holderId: idOf('subject', 'beater-04'),
  aboutId: idOf('entity', 'herb'),
  assertion: '붉은 잎 약초는 마비독이다',
  confidence: 0.8,
  sourceIds: [],
};
const altarVow: Commitment = {
  kind: 'Commitment',
  id: idOf('commitment', 'altar-vow'),
  fromId: idOf('subject', 'priest-09'),
  toId: veilMother.id,
  obligation: '열흘마다 제단에 제물을 올린다',
  reward: '어미의 숨이 협곡을 덮는다',
  dueTick: 10,
  state: 'accepted',
  breachEffect: '숭배량이 마르고 제단의 앵커가 흐려진다',
};

describe('열한 종의 세계 걸림', () => {
  const report = checkGroundings();

  test('열한 종에 걸림이 하나씩 붙는다', () => {
    assert.equal(KIND_GROUNDINGS.length, 11);
    assert.deepEqual(
      KIND_GROUNDINGS.map((entry) => entry.kind),
      [...DEPENDENCY_KINDS],
    );
    assert.equal(report.complete, true);
    assert.deepEqual(report.violations, []);
  });

  test('모든 종이 읽을 자리를 댄다 — 시간만 틱을 읽는다', () => {
    for (const entry of KIND_GROUNDINGS) {
      const reads = entry.readDomains.length > 0 || entry.readsClock;
      assert.equal(reads, true, entry.kind);
      assert.notEqual(entry.note, '', entry.kind);
    }
    const clockOnly = KIND_GROUNDINGS.filter((entry) => entry.readsClock).map((e) => e.kind);
    assert.deepEqual(clockOnly, ['time']);
    assert.deepEqual(kindGrounding('time')?.readDomains, []);
  });

  test('9영역이 하나도 남김없이 어느 종엔가 읽힌다', () => {
    assert.deepEqual(report.uncoveredDomains, []);
    for (const domain of STATE_DOMAINS) {
      assert.ok((report.byDomain[domain] ?? []).length > 0, domain);
    }
    assert.deepEqual(report.byDomain['relational'], ['relationship']);
    assert.deepEqual(report.byDomain['psychic'], ['rule', 'ritual']);
  });

  test('가리킬 대상이 없는 종은 시간 하나뿐이다', () => {
    const targetless = KIND_GROUNDINGS.filter((entry) => entry.targeting === 'none');
    assert.deepEqual(
      targetless.map((entry) => entry.kind),
      ['time'],
    );
    assert.deepEqual(kindGrounding('time')?.targetKinds, []);
  });

  test('소모·갈아탐이 종마다 갈린다', () => {
    const depleting = KIND_GROUNDINGS.filter((e) => e.depletes).map((e) => e.kind);
    assert.deepEqual(depleting, ['resource', 'body', 'relationship']);
    // 정보는 나눠 줘도 내가 잃지 않는 유일한 종이다
    assert.equal(kindGrounding('information')?.depletes, false);
    assert.equal(kindGrounding('information')?.transferable, true);
    // 몸과 장소는 넘겨받을 수 없다
    assert.equal(kindGrounding('body')?.transferable, false);
    assert.equal(kindGrounding('space')?.transferable, false);
  });

  test('판정 한 줄과 요약 한 줄이 읽힌다', () => {
    assert.match(groundingVerdict(report), /열한 종이 전부 세계에 걸린다/);
    assert.equal(
      groundingSummary(kindGrounding('resource') as KindGrounding),
      'Entity → economic·ecological (쓰면 준다 · 갈아탈 수 있다)',
    );
    assert.match(groundingSummary(kindGrounding('time') as KindGrounding), /대상 없음 → V1 틱/);
  });

  test('걸림 검사는 결정적이다', () => {
    assert.deepEqual(checkGroundings(), checkGroundings());
  });
});

describe('설 수 없는 걸림은 사유와 함께 거부된다', () => {
  const grounded = [...KIND_GROUNDINGS];
  const swap = (kind: string, patch: Partial<KindGrounding>): readonly KindGrounding[] =>
    grounded.map((entry) => (entry.kind === kind ? { ...entry, ...patch } : entry));

  test('아무 자리도 읽지 않는 종은 압력을 계산할 수 없다는 사유로 걸린다', () => {
    const report = checkGroundings(swap('ritual', { readDomains: [] }));
    assert.equal(report.complete, false);
    assert.equal(report.violations[0]?.rule, 'unreadable-kind');
    assert.match(report.violations[0]?.message ?? '', /D4 는 압력을 계산하지 못한다/);
  });

  test('자리와 틱을 함께 읽으면 어느 쪽이 충족을 정하는지 알 수 없다', () => {
    const report = checkGroundings(swap('resource', { readsClock: true }));
    assert.equal(report.violations[0]?.rule, 'unreadable-kind');
    assert.match(report.violations[0]?.path ?? '', /readsClock/);
  });

  test('9영역 밖의 자리를 읽으면 걸린다', () => {
    const report = checkGroundings(swap('body', { readDomains: ['flesh' as never] }));
    assert.equal(report.violations[0]?.rule, 'phantom-domain');
  });

  test('O1 12타입 밖의 대상은 걸린다', () => {
    const report = checkGroundings(swap('subject', { targetKinds: ['Person' as never] }));
    assert.equal(report.violations[0]?.rule, 'phantom-target-kind');
  });

  test('사물을 받으면서 어느 사물인지 안 적으면 걸린다', () => {
    const report = checkGroundings(swap('space', { targetEntityKinds: [] }));
    assert.equal(report.violations[0]?.rule, 'phantom-target-kind');
    assert.match(report.violations[0]?.message ?? '', /장소와 광물은 채우는 방법이 다르다/);
  });

  test('대상 없는 종이라 적고 대상 종류를 들면 걸린다', () => {
    const report = checkGroundings(swap('time', { targetKinds: ['Subject'] }));
    assert.equal(report.violations[0]?.rule, 'unwanted-target');
  });

  test('시간이 아닌데 대상이 비면 걸린다', () => {
    const report = checkGroundings(
      swap('information', { targetKinds: [], targeting: 'either' }),
    );
    assert.equal(report.violations[0]?.rule, 'targetless-kind');
    assert.match(report.violations[0]?.message ?? '', /대상 없는 의존은 시간뿐이다/);
  });

  test('걸림이 빠진 종은 D2 가 아무것도 짓지 못한다는 사유로 걸린다', () => {
    const report = checkGroundings(grounded.filter((entry) => entry.kind !== 'institution'));
    assert.deepEqual(report.ungrounded, ['institution']);
    assert.deepEqual(report.uncoveredDomains, ['institutional']);
    assert.match(groundingVerdict(report), /아무도 기대지 않는 영역 institutional/);
  });

  test('같은 종의 걸림을 두 번 적으면 걸린다', () => {
    const report = checkGroundings([...grounded, grounded[0] as KindGrounding]);
    assert.deepEqual(report.duplicates, ['resource']);
  });

  test('근거를 대지 않는 걸림은 걸림이 아니다', () => {
    const report = checkGroundings(swap('rule', { note: '' }));
    assert.equal(report.violations[0]?.rule, 'unsourced-kind');
  });
});

describe('같은 원소가 기대는 방식에 따라 갈린다', () => {
  test('규칙 하나가 제도·규칙·의례 셋으로 걸릴 수 있다', () => {
    assert.deepEqual(kindsAccepting(passageLaw), ['institution', 'rule', 'ritual']);
    for (const kind of ['institution', 'rule', 'ritual'] as const) {
      assert.equal(fitTarget(kind, passageLaw).fits, true, kind);
    }
  });

  test('약속 하나가 관계로도 의례로도 걸린다', () => {
    assert.deepEqual(kindsAccepting(altarVow), ['relationship', 'ritual']);
  });

  test('상태는 영역이 종을 가른다 — 같은 State 라도 어디의 값인지가 다르다', () => {
    assert.deepEqual(kindsAccepting(ravineWarmth), ['environment']); // physical
    assert.deepEqual(kindsAccepting(hunterHunger), ['body']); // biological
    assert.deepEqual(kindsAccepting(villageTrust), ['relationship']); // relational
  });

  test('사물은 무엇이냐가 종을 가른다', () => {
    assert.deepEqual(kindsAccepting(driedMeat), ['resource']);
    assert.deepEqual(kindsAccepting(ravine), ['space']);
  });

  test('주체는 주체 의존에만 걸리고, 믿음은 정보에만 걸린다', () => {
    assert.deepEqual(kindsAccepting(veilMother), ['subject']);
    assert.deepEqual(kindsAccepting(poisonClaim), ['information']);
  });
});

describe('선언한 종과 대상이 어긋나면 거부된다', () => {
  test('자원이라 적고 장소를 가리키면 무엇으로 적어야 하는지까지 말한다', () => {
    const fit = fitTarget('resource', ravine);
    assert.equal(fit.fits, false);
    assert.equal(fit.violations[0]?.rule, 'kind-target-mismatch');
    assert.match(fit.violations[0]?.message ?? '', /\[space\] 로 걸 수 있다/);
    assert.deepEqual(fit.accepting, ['space']);
  });

  test('환경이라 적고 남의 허기를 가리키면 영역이 다르다고 말한다', () => {
    const fit = fitTarget('environment', hunterHunger);
    assert.equal(fit.fits, false);
    assert.equal(fit.violations[0]?.rule, 'off-domain-state');
    assert.match(fit.violations[0]?.message ?? '', /biological 상태는 이 종이 읽지 않는다/);
  });

  test('시간에 대상을 달면 아무도 채우지 못한다는 사유로 거부된다', () => {
    const fit = fitTarget('time', ravine);
    assert.equal(fit.fits, false);
    assert.equal(fit.violations[0]?.rule, 'unwanted-target');
  });

  test('그 대상이어야 하는 종은 종류로만 걸 수 없다', () => {
    const named = fitTarget('subject', null);
    assert.equal(named.fits, false);
    assert.equal(named.violations[0]?.rule, 'kind-target-mismatch');
    // 종류로만 걸어도 되는 종은 대상 없이도 선다 — "아무 식량이든"
    assert.equal(fitTarget('resource', null).fits, true);
    // 시간은 대상이 없는 것이 정상이다
    assert.equal(fitTarget('time', null).fits, true);
  });

  test('11종 밖의 종은 그 자체로 거부된다', () => {
    const fit = fitTarget('supply' as never, driedMeat);
    assert.equal(fit.fits, false);
    assert.equal(fit.violations[0]?.rule, 'undefined-kind');
  });

  test('O1 Dependency 하나가 그대로 이 관문을 지난다', () => {
    const hunger: Dependency = {
      kind: 'Dependency',
      id: idOf('dependency', 'beater-hunger'),
      subjectId: idOf('subject', 'beater-04'),
      dependencyKind: 'resource',
      targetId: driedMeat.id,
      desiredCondition: '창고의 말린 고기 재고가 3 이상이다',
      strength: 0.9,
      urgency: 0.7,
      substitutability: 0.5,
    };
    assert.deepEqual(checkDependencyTarget(hunger, driedMeat), []);
    assert.equal(checkDependencyTarget(hunger, ravine).length, 1);
    // targetId 가 null 이면 종류로만 걸린 의존이다 — 대상 원소를 넘겨도 보지 않는다
    assert.deepEqual(checkDependencyTarget({ ...hunger, targetId: null }, ravine), []);
  });

  test('경로가 위반에 실려 어디를 고쳐야 하는지 보인다', () => {
    const fit = fitTarget('space', driedMeat, '$.graph.nodes[2]');
    assert.equal(fit.violations[0]?.path, '$.graph.nodes[2].targetId');
  });
});
