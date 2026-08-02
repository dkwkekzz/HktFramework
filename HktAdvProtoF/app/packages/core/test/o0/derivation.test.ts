// O0-d 단위 테스트 — 같은 공리에서 여러 정의가 도출되는가 (원문 O0 검증 조항 ②).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  axiomId,
  derivationOf,
  derivationReport,
  derivationVerdict,
  MIN_DERIVATIONS,
  type AbilityDefinition,
  type Definition,
  type SpeciesDefinition,
} from '../../src/o0/index.ts';

/** 능력 하나를 짓는다 — 흔적은 자기 자신의 규칙 ID 를 매개로 받는다. */
function ability(
  name: string,
  strength: number,
  supportIds: readonly string[] = [],
): AbilityDefinition {
  const id = deterministicId('rule', 'ability', name);
  return {
    kind: 'Rule',
    id,
    definitionKind: 'ability',
    domain: 'psychic',
    name,
    when: [`${name} 의 조건이 성립한다`],
    then: [`${name} 이 발동한다`],
    axiomId: axiomId('observable-trace'),
    supportIds,
    strength,
    costs:
      strength > 0.5 ? [{ domain: 'psychic', path: 'energy', amount: 10 }] : [],
    traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${id}` }],
  };
}

/** 종 하나를 짓는다. */
function species(name: string, supportIds: readonly string[] = []): SpeciesDefinition {
  return {
    kind: 'Rule',
    id: deterministicId('rule', 'species', name),
    definitionKind: 'species',
    domain: 'biological',
    name,
    when: [`세계에 ${name} 이 선다`],
    then: [`${name} 은 의념을 갖는다`],
    axiomId: axiomId('psychic-life'),
    supportIds,
    subjectKind: 'person',
    alive: true,
    slots: [{ domain: 'psychic', path: 'conviction' }],
    originId: null,
  };
}

/** 신 하나를 짓는다 — 유래와 초월 자리를 갖춘다. */
function god(name: string, origin: string): SpeciesDefinition {
  return {
    ...species(name),
    id: deterministicId('rule', 'species', name),
    axiomId: axiomId('emergent-divinity'),
    supportIds: [axiomId('psychic-life')],
    subjectKind: 'god',
    slots: [
      { domain: 'psychic', path: 'energy' },
      { domain: 'transcendent', path: 'worship' },
    ],
    originId: deterministicId('subject', 'organization', origin),
  };
}

/** 네 공리 전부에서 정의가 둘 이상 나오는 온전한 카탈로그. */
const CATALOG: readonly Definition[] = [
  ability('붉은 장막', 0.9, [axiomId('verifiable-cost')]),
  ability('독 감별', 0.3),
  ability('전언 새김', 0.7, [axiomId('verifiable-cost')]),
  species('사냥꾼'),
  species('장막벌레'),
  god('붉은 장막의 어미', '아랫마을 사람들'),
  god('길 위의 이름 없는 신', '행상단'),
];

describe('도출 대조', () => {
  const report = derivationReport(CATALOG);

  test('정의가 든 근거를 공리 쪽에서 되짚는다', () => {
    assert.equal(report.accepted, CATALOG.length);
    assert.deepEqual([...report.rejected], []);
    assert.ok(report.complete, derivationVerdict(report));
  });

  test('도출을 요구하는 공리는 정의 층위에 걸리는 넷뿐이다', () => {
    assert.deepEqual(
      report.byClause.filter((entry) => entry.required).map((entry) => entry.clause),
      ['psychic-life', 'verifiable-cost', 'observable-trace', 'emergent-divinity'],
    );
  });

  test('같은 공리에서 서로 다른 정의가 둘 이상 나온다', () => {
    for (const entry of report.byClause) {
      if (!entry.required) continue;
      assert.ok(entry.diverse, `${entry.clause}: ${String(entry.derived.length)}`);
      assert.ok(entry.derived.length >= MIN_DERIVATIONS, entry.clause);
    }
    assert.deepEqual([...report.barren], []);
    assert.deepEqual([...report.monotone], []);
  });

  test('한 공리에서 능력과 종이 함께 나온다 — 생명 공리는 사람도 신도 낳는다', () => {
    const life = derivationOf(report, 'psychic-life');
    assert.equal(life?.species, 4);
    assert.equal(life?.abilities, 0);
    // 신 둘은 같은 공리(신적 주체)에서 서로 다른 유래로 도출된다.
    const divinity = derivationOf(report, 'emergent-divinity');
    assert.deepEqual(
      divinity?.derived.map((entry) => entry.definitionName),
      ['붉은 장막의 어미', '길 위의 이름 없는 신'],
    );
  });

  test('대표 근거와 함께 따르는 근거를 갈라 적는다', () => {
    const cost = derivationOf(report, 'verifiable-cost');
    assert.deepEqual(
      cost?.derived.map((entry) => `${entry.definitionName}:${entry.role}`),
      ['붉은 장막:support', '전언 새김:support'],
    );
    const trace = derivationOf(report, 'observable-trace');
    assert.ok(trace?.derived.every((entry) => entry.role === 'primary'));
  });

  test('능력과 종이 둘 다 도출돼야 한다', () => {
    assert.deepEqual([...report.kindsCovered], ['ability', 'species']);
    const onlySpecies = derivationReport([species('사냥꾼'), species('장막벌레')]);
    assert.deepEqual([...onlySpecies.kindsCovered], ['species']);
    assert.ok(!onlySpecies.complete);
    assert.match(derivationVerdict(onlySpecies), /종류가 species 뿐이다/);
  });
});

describe('공리가 세계를 넓히지 못하면 드러난다', () => {
  test('도출 하나를 지우면 그 공리가 불모로 찍힌다', () => {
    const cut = CATALOG.filter(
      (definition) => definition.name !== '붉은 장막의 어미' && definition.name !== '길 위의 이름 없는 신',
    );
    const report = derivationReport(cut);
    assert.deepEqual([...report.barren], ['emergent-divinity']);
    assert.ok(!report.complete);
    assert.match(derivationVerdict(report), /아무것도 낳지 못한 공리 emergent-divinity/);
  });

  test('정의 하나로 그친 공리는 공리가 아니라 그 정의의 다른 이름이다', () => {
    const report = derivationReport(CATALOG.filter((entry) => entry.name !== '길 위의 이름 없는 신'));
    assert.deepEqual([...report.monotone], ['emergent-divinity']);
    assert.match(derivationVerdict(report), /정의 하나로 그친 공리/);
  });

  test('공리를 어긴 정의는 도출로 세지 않는다 — 어긴 것이 공리의 성과가 될 수 없다', () => {
    const traceless: AbilityDefinition = { ...ability('빈손 술', 0.2), traces: [] };
    const report = derivationReport([...CATALOG, traceless]);
    assert.equal(report.accepted, CATALOG.length);
    assert.deepEqual([...report.rejected], ['빈손 술']);
    assert.ok(!report.complete);
    assert.match(derivationVerdict(report), /도출로 세지 못한 정의 빈손 술/);
  });

  test('정의가 없으면 완결이 아니다', () => {
    const blank = derivationReport([]);
    assert.ok(!blank.complete);
    assert.match(derivationVerdict(blank), /도출된 정의가 없다/);
  });

  test('없는 공리를 근거로 든 정의는 O0-b 가 먼저 막는다', () => {
    const invented = { ...ability('없는 근거', 0.2), axiomId: deterministicId('axiom', 'free-lunch') };
    const report = derivationReport([...CATALOG, invented]);
    assert.deepEqual([...report.rejected], ['없는 근거']);
  });
});
