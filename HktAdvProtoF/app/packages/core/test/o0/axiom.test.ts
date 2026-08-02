// O0-a 단위 테스트 — 원문 세 목록의 최상위 제약 대조.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { classify } from '../../src/o1/index.ts';
import {
  AXIOM_CLAUSES,
  AXIOM_RECONCILIATION,
  AXIOM_SET,
  axiomById,
  axiomId,
  axiomOf,
  axiomSetReport,
  axiomSetVerdict,
  isAxiomClause,
  ORIGINAL_AXIOMS,
  resolutionOf,
  type Axiom,
  type AxiomResolution,
} from '../../src/o0/index.ts';

describe('확정 공리 8개', () => {
  test('조항 이름표에 공리가 하나씩 붙는다', () => {
    assert.equal(AXIOM_SET.length, AXIOM_CLAUSES.length);
    assert.deepEqual(
      AXIOM_SET.map((axiom) => axiom.clause),
      [...AXIOM_CLAUSES],
    );
  });

  test('공리는 온전한 O1 Rule 이다 — 새 타입이 아니라 규칙의 한 종류다', () => {
    for (const axiom of AXIOM_SET) {
      assert.equal(classify(axiom).kind, 'Rule', axiom.clause);
    }
  });

  test('공리의 근거는 자기 자신이다 — axiomId 가 null 인 유일한 규칙들', () => {
    for (const axiom of AXIOM_SET) {
      assert.equal(axiom.axiomId, null, axiom.clause);
    }
  });

  test('공리 ID 는 유래에서 나온다 — 몇 번을 만들어도 같다', () => {
    assert.equal(axiomId('psychic-life'), axiomId('psychic-life'));
    assert.notEqual(axiomId('psychic-life'), axiomId('verifiable-cost'));
    assert.equal(axiomOf('psychic-life')?.id, axiomId('psychic-life'));
    assert.equal(axiomById(axiomId('observable-trace'))?.clause, 'observable-trace');
    assert.equal(axiomById('axiom:없는것'), null);
  });

  test('모든 공리가 조건·효과·원문 근거를 갖는다', () => {
    for (const axiom of AXIOM_SET) {
      assert.ok(axiom.when.length > 0, axiom.clause);
      assert.ok(axiom.then.length > 0, axiom.clause);
      assert.ok(axiom.sources.length > 0, axiom.clause);
    }
  });

  test('조항 8종 밖의 이름은 조항이 아니다', () => {
    assert.ok(isAxiomClause('psychic-life'));
    assert.ok(!isAxiomClause('free-lunch'));
    assert.ok(!isAxiomClause(0));
  });
});

describe('원문 대조', () => {
  const report = axiomSetReport();

  test('원문 문장 16개가 하나도 빠짐없이 해소된다', () => {
    assert.equal(ORIGINAL_AXIOMS.length, 16);
    assert.deepEqual([...report.unresolved], []);
    assert.deepEqual([...report.danglingTargets], []);
    assert.ok(report.complete, axiomSetVerdict(report));
  });

  test('모든 공리가 원문 문장 하나 이상을 근거로 갖는다 — 발명된 공리가 없다', () => {
    assert.deepEqual([...report.ungroundedAxioms], []);
    assert.deepEqual([...report.duplicateClauses], []);
    assert.deepEqual([...report.malformed], []);
  });

  test('원문 세 곳이 모두 대조에 들어온다', () => {
    const sources = ORIGINAL_AXIOMS.map((original) => original.source);
    assert.ok(sources.some((source) => source.startsWith('ModulePlan O0')));
    assert.ok(sources.some((source) => source.startsWith('MasterPlan §3.1')));
    assert.ok(sources.some((source) => source.startsWith('MasterPlan §3.2')));
  });

  test('비용 공리는 원문 다섯 문장이 모인 자리다 — 원문이 같은 말을 여러 번 적었다', () => {
    const merged = AXIOM_RECONCILIATION.filter((entry) => entry.clause === 'verifiable-cost');
    assert.equal(merged.length, 5);
    assert.deepEqual(
      merged.map((entry) => entry.original),
      ['mp-o0-2', 'inv-cost', 'l1-cost', 'seed-premise-exception', 'l6-personal'],
    );
  });

  test('해소 하나를 지우면 그 문장이 지목된다', () => {
    const cut = AXIOM_RECONCILIATION.filter((entry) => entry.original !== 'l1-causality');
    const broken = axiomSetReport(AXIOM_SET, ORIGINAL_AXIOMS, cut);
    assert.deepEqual([...broken.unresolved], ['l1-causality']);
    // 그 문장이 유일한 근거였던 공리는 근거를 잃는다.
    assert.deepEqual([...broken.ungroundedAxioms], ['caused-persistence']);
    assert.ok(!broken.complete);
    assert.match(axiomSetVerdict(broken), /l1-causality/);
  });

  test('없는 조항으로 보낸 문장은 빗나간 대조로 남는다', () => {
    const strayed: AxiomResolution[] = [
      ...AXIOM_RECONCILIATION.filter((entry) => entry.original !== 'inv-resistance'),
      {
        original: 'inv-resistance',
        resolution: 'same',
        clause: 'entropy' as never,
        reason: '없는 조항',
      },
    ];
    const broken = axiomSetReport(AXIOM_SET, ORIGINAL_AXIOMS, strayed);
    assert.deepEqual([...broken.danglingTargets], ['inv-resistance→entropy']);
    assert.deepEqual([...broken.ungroundedAxioms], ['stability-resistance']);
  });

  test('원문에 없는 문장을 근거로 들어도 공리는 근거를 얻지 못한다', () => {
    const invented: AxiomResolution[] = AXIOM_RECONCILIATION.map((entry) =>
      entry.clause === 'emergent-divinity' ? { ...entry, original: 'made-up' } : entry,
    );
    const broken = axiomSetReport(AXIOM_SET, ORIGINAL_AXIOMS, invented);
    assert.deepEqual([...broken.unresolved], ['mp-o0-4']);
    assert.deepEqual([...broken.ungroundedAxioms], ['emergent-divinity']);
  });

  test('원문 문장 하나가 어느 공리로 갔는지 되짚는다', () => {
    assert.equal(resolutionOf('l1-exclusion')?.clause, 'state-exclusion');
    assert.equal(resolutionOf('l1-exclusion')?.resolution, 'restated');
    assert.equal(resolutionOf('없는문장'), null);
  });

  test('대조할 원문이 없으면 완결이 아니다 — 아무것도 확인하지 않은 것이다', () => {
    const blank = axiomSetReport(AXIOM_SET, [], []);
    assert.ok(!blank.complete);
    assert.match(axiomSetVerdict(blank), /대조할 원문 문장이 없다/);
  });

  test('공리가 없으면 완결이 아니다', () => {
    const blank = axiomSetReport([], ORIGINAL_AXIOMS, AXIOM_RECONCILIATION);
    assert.ok(!blank.complete);
    assert.match(axiomSetVerdict(blank), /공리가 하나도 없다/);
  });
});

describe('강제 책임', () => {
  const report = axiomSetReport();

  test('아무도 지키지 않는 공리는 없다 — 막고 있거나, 갚을 모듈이 적혀 있다', () => {
    assert.deepEqual([...report.unenforced], []);
    for (const axiom of AXIOM_SET) {
      assert.ok(axiom.enforcedBy.length > 0 || axiom.deferredTo !== null, axiom.clause);
    }
  });

  test('아직 못 막는 공리 둘은 갚을 모듈과 함께 남는다 (R3 지각 · W2 규칙 실체화)', () => {
    assert.deepEqual([...report.deferred], ['observed-manipulation', 'stability-resistance']);
    for (const clause of report.deferred) {
      assert.notEqual(axiomOf(clause)?.deferredTo, null);
    }
  });

  test('O0 밖의 관문도 강제 지점으로 적힌다 — 공리는 한 모듈의 것이 아니다', () => {
    const gates = AXIOM_SET.flatMap((axiom) => axiom.enforcedBy.map((point) => point.gate));
    assert.ok(gates.some((gate) => gate.startsWith('O0.')));
    assert.ok(gates.some((gate) => gate.startsWith('O1.')));
    assert.ok(gates.some((gate) => gate.startsWith('O2.')));
  });

  test('강제 지점도 없고 갚을 모듈도 없으면 미완결이다', () => {
    const orphan: Axiom[] = AXIOM_SET.map((axiom) =>
      axiom.clause === 'state-exclusion' ? { ...axiom, enforcedBy: [], deferredTo: null } : axiom,
    );
    const broken = axiomSetReport(orphan, ORIGINAL_AXIOMS, AXIOM_RECONCILIATION);
    assert.deepEqual([...broken.unenforced], ['state-exclusion']);
    assert.ok(!broken.complete);
    assert.match(axiomSetVerdict(broken), /아무도 지키지 않는 공리/);
  });

  test('원문 근거가 비면 결함 공리로 걸린다', () => {
    const unsourced: Axiom[] = AXIOM_SET.map((axiom) =>
      axiom.clause === 'psychic-life' ? { ...axiom, sources: [] } : axiom,
    );
    const broken = axiomSetReport(unsourced, ORIGINAL_AXIOMS, AXIOM_RECONCILIATION);
    assert.deepEqual([...broken.malformed], ['psychic-life → 원문 근거가 없다']);
  });

  test('규칙으로서 결함이 있는 공리는 경로·사유와 함께 걸린다', () => {
    const empty: Axiom[] = AXIOM_SET.map((axiom) =>
      axiom.clause === 'observable-trace' ? { ...axiom, then: [] } : axiom,
    );
    const broken = axiomSetReport(empty, ORIGINAL_AXIOMS, AXIOM_RECONCILIATION);
    assert.equal(broken.malformed.length, 1);
    assert.match(broken.malformed[0] as string, /observable-trace → \$\.then/);
  });
});
