// P3-b 단위 테스트 — 무엇을 딛고 서는가. 보지 못한 것은 후보가 되지 않는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash } from '../../src/v1/index.ts';
import { buildGrammar } from '../../src/p2/index.ts';
import {
  buildContext,
  contextSummary,
  contextVerdict,
  reaches,
  relationsOf,
  sourceLabel,
  type ContextSpec,
} from '../../src/p3/index.ts';

import {
  beast,
  berryId,
  drawId,
  grants,
  hiddenBerryId,
  keeperGrammar,
  bareGrammar,
  neighborId,
  plain,
  voidGrants,
  worldAt,
} from './fixture.ts';

const world = worldAt(3);

/** 굴짐승 01 이 제 창고를 보고, 이웃이 굶던 것을 기억하고, 능력을 지녔다. */
const full: ContextSpec = {
  subjectId: plain.id,
  tick: 100,
  world,
  grammar: keeperGrammar,
  percepts: [{ holderId: plain.id, domain: 'economic', path: `stock.${berryId}` }],
  memories: [
    { holderId: neighborId, domain: 'biological', path: 'hunger', value: 0.9, asOfTick: 80 },
  ],
  capabilities: [drawId],
  grants,
};

const context = buildContext(full);
const rules = (spec: ContextSpec) => [
  ...new Set(buildContext(spec).violations.map((violation) => violation.rule)),
];

describe('근거 넷이 한 모양으로 선다', () => {
  test('출처 넷이 전부 서고, 사실마다 유래가 적힌다', () => {
    assert.equal(context.complete, true);
    assert.deepEqual(
      [...new Set(context.facts.map((fact) => fact.via))],
      ['percept', 'memory', 'relationship', 'capability'],
    );
    for (const fact of context.facts) assert.notEqual(fact.note, '');
    assert.deepEqual(FACT_LABELS, ['봄', '기억', '사이', '능력']);
  });

  test('자기 자신은 언제나 보인다 — 몸은 보지 않아도 안다', () => {
    const blind = buildContext({ ...full, percepts: [], memories: [], capabilities: [] });
    assert.deepEqual(blind.seen, [plain.id]);
    assert.equal(blind.complete, true);
    assert.equal(reaches(blind, plain.id), true);
    const first = blind.facts[0];
    assert.equal(first?.via, 'percept');
    assert.equal(first?.holderId, plain.id);
    assert.match(first?.note ?? '', /보지 않아도 안다/);
  });

  test('보지 못한 것은 후보가 되지 않는다 — 세계에 있어도 닿지 않는다', () => {
    // 골짜기 열매는 세계에 자리가 있다. 그런데 아무도 그것을 보지 않았다.
    assert.notEqual(world['economic']?.[plain.id]?.[`stock.${hiddenBerryId}`], undefined);
    assert.equal(reaches(context, hiddenBerryId), false);
    assert.ok(!context.reachable.includes(hiddenBerryId));
  });

  test('같은 세계에 선 둘이 본 것이 달라 닿는 대상이 갈린다', () => {
    const seer = buildContext({
      ...full,
      percepts: [{ holderId: neighborId, domain: 'biological', path: 'hunger' }],
      memories: [],
    });
    const rememberer = buildContext({ ...full, percepts: [] });
    assert.deepEqual(seer.seen, [neighborId, plain.id].sort());
    assert.deepEqual(seer.remembered, []);
    assert.deepEqual(rememberer.seen, [plain.id]);
    assert.deepEqual(rememberer.remembered, [neighborId]);
    // 둘 다 이웃에 닿지만, 닿는 방식이 다르다 — 하나는 보고 하나는 기억한다.
    assert.equal(reaches(seer, neighborId), true);
    assert.equal(reaches(rememberer, neighborId), true);
    assert.notEqual(stateHash(seer.facts), stateHash(rememberer.facts));
  });
});

const FACT_LABELS = ['percept', 'memory', 'relationship', 'capability'].map((via) =>
  sourceLabel(via as 'percept'),
);

describe('사이는 주장이 아니라 기록이다', () => {
  test('관계는 손으로 주지 않고 세계의 relational 자리에서 읽는다', () => {
    assert.deepEqual(context.counterparts, [neighborId]);
    const relations = relationsOf(world, plain.id);
    assert.deepEqual(
      relations.map((entry) => entry.path),
      [`debt.${neighborId}`, `trust.${neighborId}`],
    );
    const facts = context.facts.filter((fact) => fact.via === 'relationship');
    assert.equal(facts.length, 2);
    for (const fact of facts) assert.equal(fact.holderId, neighborId);
  });

  test('적히지 않은 사이는 없는 사이다', () => {
    const lonely = buildContext({ ...full, subjectId: neighborId });
    assert.deepEqual(lonely.counterparts, []);
    assert.equal(lonely.facts.some((fact) => fact.via === 'relationship'), false);
  });
});

describe('기억은 틀릴 수 있다 — 그것이 거짓 믿음의 씨앗이다', () => {
  test('세계와 어긋난 기억은 stale 로 남되 거부되지 않는다', () => {
    assert.equal(context.complete, true);
    assert.equal(context.staleFacts.length, 1);
    const stale = context.staleFacts[0];
    assert.equal(stale?.via, 'memory');
    assert.equal(stale?.value, 0.9); // 기억은 0.9 인데
    assert.equal(world['biological']?.[neighborId]?.['hunger'], 0.2); // 세계는 0.2 다
    assert.match(stale?.note ?? '', /R4 가 갚을 어긋남/);
  });

  test('세계가 기억과 같아지면 같은 기억이 어긋나기를 그친다', () => {
    const agreed = buildContext({
      ...full,
      memories: [
        { holderId: neighborId, domain: 'biological', path: 'hunger', value: 0.2, asOfTick: 80 },
      ],
    });
    assert.deepEqual(agreed.staleFacts, []);
  });

  test('사라진 것도 기억에 남는다 — 실재를 요구하지 않는다', () => {
    const gone = buildContext({
      ...full,
      memories: [
        { holderId: 'entity:없어진창고', domain: 'economic', path: 'stock.x', value: 9, asOfTick: 40 },
      ],
    });
    assert.equal(gone.complete, true); // 거부되지 않는다
    assert.equal(gone.staleFacts.length, 1); // 다만 어긋난 것으로 선다
    assert.ok(gone.remembered.includes('entity:없어진창고'));
  });
});

describe('설 수 없는 근거는 사유와 함께 거부된다', () => {
  test('세계에 없는 자리를 본다고 하면 걸린다', () => {
    assert.deepEqual(
      rules({
        ...full,
        percepts: [{ holderId: plain.id, domain: 'economic', path: 'stock.없는것' }],
      }),
      ['phantom-percept'],
    );
  });

  test('아직 오지 않은 것은 기억이 아니다', () => {
    assert.deepEqual(
      rules({
        ...full,
        memories: [
          { holderId: neighborId, domain: 'biological', path: 'hunger', value: 0.1, asOfTick: 101 },
        ],
      }),
      ['future-memory'],
    );
  });

  test('배정 없는 능력은 이름뿐이다', () => {
    assert.deepEqual(rules({ ...full, capabilities: ['rule:없는능력'] }), [
      'ungranted-capability',
    ]);
  });

  test('능력은 유형이 막은 자리를 열지 못한다 — 실은 것이 없으면 근거가 아니다', () => {
    const voided = buildGrammar({ archetype: beast, capabilities: [drawId], grants: voidGrants });
    assert.deepEqual(voided.empowered, []); // 짐승은 합의로 서는 원자를 못 낸다
    assert.deepEqual(rules({ ...full, grammar: voided, grants: voidGrants }), [
      'ungranted-capability',
    ]);
  });

  test('세계에 서 있지 않은 주체는 아무것도 딛지 못한다', () => {
    const ghost = deterministicId('subject', 'creature', '세계에 없는 것');
    const result = buildContext({ ...full, subjectId: ghost, percepts: [], memories: [] });
    assert.deepEqual(
      result.violations.map((violation) => violation.rule),
      ['absent-subject'],
    );
  });
});

describe('경계 · 결정성', () => {
  test('맨몸 문법이면 능력 근거가 하나도 서지 않는다', () => {
    const bare = buildContext({ ...full, grammar: bareGrammar, capabilities: [], grants: [] });
    assert.deepEqual(bare.empowered, []);
    assert.deepEqual(bare.capabilities, []);
    assert.equal(bare.complete, true); // 능력이 없는 것은 결함이 아니다
  });

  test('아무것도 보지 못해도 근거는 선다 — 굶주림은 그에게도 길을 남긴다', () => {
    const blind = buildContext({
      subjectId: plain.id,
      tick: 100,
      world,
      grammar: bareGrammar,
    });
    assert.equal(blind.complete, true);
    assert.equal(blind.reachable.length, 1);
    assert.deepEqual(blind.counterparts, [neighborId]); // 사이는 보지 않아도 적혀 있다
    assert.match(contextVerdict(blind), /^사실 /);
  });

  test('같은 재료를 100번 세워도 같은 해시가 나온다', () => {
    const first = stateHash(buildContext(full));
    for (let index = 0; index < 100; index += 1) {
      assert.equal(stateHash(buildContext(full)), first);
    }
  });

  test('요약 줄이 근거 넷을 그대로 편다', () => {
    const summary = contextSummary(context);
    assert.equal(summary.length, 5);
    assert.match(summary[3] ?? '', /protect/);
    assert.match(contextVerdict(context), /어긋난 기억 1/);
  });
});
