// O0-c 단위 테스트 — 공리가 선언한 관문이 정말 막는지 실행해서 확인한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import {
  AXIOM_SET,
  enforcementReport,
  enforcementVerdict,
  probeOf,
  type Axiom,
} from '../../src/o0/index.ts';

describe('강제 지점 프로브', () => {
  const report = enforcementReport();

  test('선언된 강제 지점에는 프로브가 하나씩 있다', () => {
    assert.deepEqual([...report.missingProbes], []);
    assert.deepEqual([...report.orphanProbes], []);
  });

  test('선언된 관문이 전부 실제로 막는다', () => {
    assert.deepEqual([...report.brokenGates], []);
    assert.ok(report.complete, enforcementVerdict(report));
    for (const result of report.results) {
      assert.ok(result.held, `${result.clause} → ${result.gate} : ${result.observed}`);
    }
  });

  test('공리 8개 중 6개가 지금 막고 있고, 둘은 갚을 모듈과 함께 남는다', () => {
    assert.deepEqual(
      [...report.enforced],
      [
        'psychic-life',
        'verifiable-cost',
        'observable-trace',
        'emergent-divinity',
        'state-exclusion',
        'caused-persistence',
      ],
    );
    assert.deepEqual([...report.deferred], ['observed-manipulation', 'stability-resistance']);
    assert.equal(report.enforced.length + report.deferred.length, AXIOM_SET.length);
  });

  test('공리는 한 모듈의 것이 아니다 — O1·O2 가 이미 막고 있던 것이 표로 선다', () => {
    const byModule = report.results.map((result) => result.gate.split('.')[0]);
    assert.ok(byModule.includes('O0'));
    assert.ok(byModule.includes('O1'));
    assert.ok(byModule.includes('O2'));
    // O1·O2 관문은 O0 가 서기 전부터 공리를 강제하고 있었다.
    assert.ok(report.results.filter((result) => !result.gate.startsWith('O0.')).length >= 5);
  });

  test('프로브 결과는 무엇을 넣어 무엇이 나왔는지를 함께 남긴다', () => {
    const duplicate = report.results.find((result) => result.probe === 'o2-duplicate-state');
    assert.equal(duplicate?.clause, 'state-exclusion');
    assert.equal(duplicate?.observed, 'duplicate-state');
    const affordance = report.results.find((result) => result.probe === 'o1-affordance-cost');
    assert.match(affordance?.observed ?? '', /비용 없는 가능성은 거부한다/);
  });

  test('같은 프로브를 다시 돌려도 같은 결과다 — 프로브는 순수하다', () => {
    assert.equal(stateHash(enforcementReport()), stateHash(report));
  });

  test('프로브를 id 로 찾는다', () => {
    assert.equal(probeOf('o2-trace-slot')?.expects, 'psychic.trace.{rule} 이 실재한다');
    assert.equal(probeOf('없는프로브'), null);
  });
});

describe('선언과 실제가 어긋나면 드러난다', () => {
  test('없는 프로브를 선언하면 강제 지점이 빈 것으로 걸린다', () => {
    const lying: Axiom[] = AXIOM_SET.map((axiom) =>
      axiom.clause === 'state-exclusion'
        ? {
            ...axiom,
            enforcedBy: [{ gate: 'O2.assembleWorld', probe: 'o2-nonexistent', note: '없는 프로브' }],
          }
        : axiom,
    );
    const broken = enforcementReport(lying);
    assert.deepEqual([...broken.missingProbes], ['state-exclusion→o2-nonexistent']);
    assert.ok(!broken.complete);
    assert.match(enforcementVerdict(broken), /프로브 없는 강제 지점/);
  });

  test('엉뚱한 관문을 가리키면 그 공리는 강제되지 않는 것으로 남는다', () => {
    const mismatched: Axiom[] = AXIOM_SET.map((axiom) =>
      axiom.clause === 'caused-persistence'
        ? {
            ...axiom,
            enforcedBy: [
              { gate: 'O2.STATE_SCHEMA', probe: 'o2-trace-slot', note: '상관없는 프로브' },
            ],
          }
        : axiom,
    );
    const shifted = enforcementReport(mismatched);
    // 프로브 자체는 통과하지만, 원래 관문을 겨누던 프로브가 아무도 참조하지 않게 된다.
    assert.deepEqual(
      [...shifted.orphanProbes],
      ['o1-causeless-phenomenon', 'o1-changeless-event'],
    );
    assert.ok(!shifted.complete);
    assert.match(enforcementVerdict(shifted), /아무 공리도 가리키지 않는 프로브/);
  });

  test('강제도 유예도 없는 공리는 판정 문장이 지목한다', () => {
    const orphan: Axiom[] = AXIOM_SET.map((axiom) =>
      axiom.clause === 'observed-manipulation'
        ? { ...axiom, enforcedBy: [], deferredTo: null }
        : axiom,
    );
    const broken = enforcementReport(orphan);
    assert.ok(!broken.complete);
    assert.match(enforcementVerdict(broken), /강제도 유예도 없는 공리 observed-manipulation/);
  });

  test('공리가 없으면 완결이 아니다', () => {
    const blank = enforcementReport([]);
    assert.ok(!blank.complete);
    assert.match(enforcementVerdict(blank), /실행한 프로브가 없다|아무 공리도 가리키지 않는/);
  });
});
