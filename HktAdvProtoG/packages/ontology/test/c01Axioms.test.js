import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AxiomRegistry, validateTransition, validateWorldProposal, validateAuthorityResolution, changedPaths,
} from '../src/axioms.js';
import { registerC01Axioms } from '../src/c01Axioms.js';

const newRegistry = () => registerC01Axioms(new AxiomRegistry());

// ---- STEPS.md C01-O-S01 실패 Scenario 5종 ----

test('실패 1: 재료 미소비 치료제 무한 생산 → 보존 위반 (CONSERVATION_NO_COST)', () => {
  const reg = newRegistry();
  const report = validateTransition({
    before: { resources: { 'healing-herb': 3, 'healing-potion': 0 } },
    after: { resources: { 'healing-herb': 3, 'healing-potion': 99 } },
    input: { events: [{ type: 'ItemCrafted', payload: { produces: [{ resource: 'healing-potion', qty: 99 }] } }] },
  }, reg);
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((v) => v.violationCode === 'CONSERVATION_NO_COST'));
});

test('실패 2: 사건 없는 개체수 직접 수정 → 사건 기반 위반 (EVENT_REQUIRED)', () => {
  const reg = newRegistry();
  const report = validateTransition({
    before: { herd: { population: 40 } },
    after: { herd: { population: 25 } },
    input: { events: [] },
  }, reg);
  assert.equal(report.passed, false);
  const v = report.violations.find((x) => x.violationCode === 'EVENT_REQUIRED');
  assert.ok(v);
  assert.deepEqual(v.statePaths, ['herd.population']); // 최초로 달라진 상태 경로 보고
});

test('실패 3: 관찰된 둥지 소급 이동 → 관찰 고정 위반 (OBSERVED_RETROACTIVE_CHANGE)', () => {
  const reg = newRegistry();
  const report = validateWorldProposal({
    proposal: { modifies: ['region.apexLair.position'] },
    observedPaths: ['region.apexLair.position'],
  }, reg);
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((v) => v.violationCode === 'OBSERVED_RETROACTIVE_CHANGE'));
});

test('실패 4: 구성원 없는 조합 계약 발급 → 조직 실체 위반 (ORG_NO_EMBODIMENT)', () => {
  const reg = newRegistry();
  const report = validateTransition({
    before: { contracts: {} },
    after: { contracts: { 'ct-1': { kind: 'cull' } } },
    input: {
      events: [{
        type: 'ContractIssued',
        actor: { kind: 'organization', id: 'hunters-guild' },   // via.members 없음
        payload: {}, statePaths: ['contracts.ct-1'],
      }],
    },
  }, reg);
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((v) => v.violationCode === 'ORG_NO_EMBODIMENT'));
});

test('실패 5: 동시 포획 이중 소유 → 권위 확정 위반 (AUTHORITY_DOUBLE_CONFIRM)', () => {
  const reg = newRegistry();
  const report = validateAuthorityResolution({
    resource: 'organ-1',
    claims: [{ by: 'H1' }, { by: 'H2' }],
    accepted: [{ by: 'H1' }, { by: 'H2' }],
    resolvedBy: 'authority-server',
  }, reg);
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((v) => v.violationCode === 'AUTHORITY_DOUBLE_CONFIRM'));
});

// ---- 정상·경계·추가 실패 경로 ----

test('정상: 재료를 소비한 제작 + 구성원 있는 조직 행동은 통과', () => {
  const reg = newRegistry();
  const report = validateTransition({
    before: { resources: { 'healing-herb': 3, 'healing-potion': 0 }, contracts: {} },
    after: { resources: { 'healing-herb': 1, 'healing-potion': 1 }, contracts: { 'ct-1': { kind: 'supply' } } },
    input: {
      events: [
        { type: 'ItemCrafted', payload: { produces: [{ resource: 'healing-potion', qty: 1 }], consumes: [{ resource: 'healing-herb', qty: 2 }] } },
        { type: 'ContractIssued', actor: { kind: 'organization', id: 'hunters-guild', via: { members: ['npc-guild-clerk-1'] } }, payload: {}, statePaths: ['contracts.ct-1'] },
      ],
    },
  }, reg);
  assert.equal(report.passed, true, JSON.stringify(report.violations));
});

test('경계: 재고 전량 소비는 통과, 전량+1 은 재고 부족 위반', () => {
  const reg = newRegistry();
  const mk = (qty) => validateTransition({
    before: { resources: { 'healing-herb': 2 } },
    after: { resources: { 'healing-herb': 2 - Math.min(qty, 2), 'healing-potion': 1 } },
    input: { events: [{ type: 'ItemCrafted', payload: { produces: [{ resource: 'healing-potion', qty: 1 }], consumes: [{ resource: 'healing-herb', qty }] } }] },
  }, reg);
  assert.equal(mk(2).passed, true);
  const over = mk(3);
  assert.equal(over.passed, false);
  assert.ok(over.violations.some((v) => v.violationCode === 'CONSERVATION_INSUFFICIENT_SOURCE'));
});

test('관찰 고정(런타임): 관찰 경로 변경은 그 경로를 선언한 사건이 있어야 한다', () => {
  const reg = newRegistry();
  const base = {
    before: { region: { lair: 'north' } },
    after: { region: { lair: 'south' } },
  };
  const noDecl = validateTransition({ ...base, input: {
    events: [{ type: 'LairMoved', payload: {} }], observedPaths: ['region.lair'],
  } }, reg);
  assert.ok(noDecl.violations.some((v) => v.violationCode === 'OBSERVED_RETROACTIVE_CHANGE'));
  const decl = validateTransition({ ...base, input: {
    events: [{ type: 'LairMoved', payload: {}, statePaths: ['region.lair'] }], observedPaths: ['region.lair'],
  } }, reg);
  assert.equal(decl.passed, true);
});

test('권위: 서버 외 확정 주체와 주장 없는 확정은 위반', () => {
  const reg = newRegistry();
  const clientSide = validateAuthorityResolution(
    { resource: 'organ-1', claims: [{ by: 'H1' }], accepted: [{ by: 'H1' }], resolvedBy: 'client-H1' }, reg);
  assert.ok(clientSide.violations.some((v) => v.violationCode === 'AUTHORITY_NOT_SERVER'));
  const phantom = validateAuthorityResolution(
    { resource: 'organ-1', claims: [{ by: 'H1' }], accepted: [{ by: 'H9' }], resolvedBy: 'authority-server' }, reg);
  assert.ok(phantom.violations.some((v) => v.violationCode === 'AUTHORITY_PHANTOM_ACCEPT'));
  const allRejected = validateAuthorityResolution(
    { resource: 'organ-1', claims: [{ by: 'H2' }], accepted: [], resolvedBy: 'authority-server' }, reg);
  assert.equal(allRejected.passed, true); // 전원 거부는 정당 (이미 소유된 자원 등)
});

// ---- 레지스트리·결정성 ----

test('공리 5종 등록·스냅샷 해시는 결정적이다', () => {
  const a = newRegistry().snapshot();
  const b = newRegistry().snapshot();
  assert.equal(a.axioms.length, 5);
  assert.equal(a.hash, b.hash);
  assert.deepEqual(a.axioms.map((x) => x.id),
    ['AX-AUTHORITY', 'AX-CONSERVATION', 'AX-EVENT-SOURCED', 'AX-OBSERVED-LOCK', 'AX-ORG-EMBODIED']);
});

test('불량 AxiomSpec·중복 등록은 거부한다 (실패 경로)', () => {
  const reg = new AxiomRegistry();
  assert.throws(() => reg.register({ id: 'X' }, () => {}), /필드 누락/);
  assert.throws(() => reg.register(
    { id: 'X', description: 'd', phases: ['nope'], severity: 'error', evaluatorId: 'e' }, () => {}), /미지 phase/);
  registerC01Axioms(reg);
  assert.throws(() => registerC01Axioms(reg), /중복 공리/);
});

test('평가기 예외는 은폐되지 않고 EVALUATOR_ERROR 로 노출된다', () => {
  const reg = new AxiomRegistry();
  reg.register(
    { id: 'AX-BOOM', description: 'd', phases: ['runtime_transition'], severity: 'error', evaluatorId: 'boom' },
    () => { throw new Error('boom'); });
  const report = validateTransition({ before: {}, after: {}, input: { events: [] } }, reg);
  assert.equal(report.passed, false);
  assert.equal(report.violations[0].violationCode, 'EVALUATOR_ERROR');
});

test('changedPaths 는 결정적 순서로 차이 경로를 보고한다', () => {
  assert.deepEqual(
    changedPaths({ a: 1, b: { c: 2, d: 3 } }, { a: 1, b: { c: 9, d: 3 }, e: 4 }),
    ['b.c', 'e'],
  );
  assert.deepEqual(changedPaths({ x: 1 }, { x: 1 }), []);
});
