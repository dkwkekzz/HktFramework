// C3 — 재료의 세계: 다중 해법(채굴형/전투형) + 역결합 + 위협=창고
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runC3 } from '../src/content/c3.js';

const graph = loadGraph();

test('같은 무기급 demand 를 두 봇이 다른 경로로 충족한다 (§5 행렬의 실행 증명)', () => {
  const r = runC3(graph);
  assert.equal(r.mine.done, true, '채굴형: 심부 수정으로 충족');
  assert.equal(r.fight.done, true, '전투형: 둥지 소탕→뼈로 충족');
  assert.equal(r.multiPath, true);
  assert.notEqual(r.mine.path, r.fight.path, '경로가 다르다');
});

test('위협 제거가 재료 획득과 겹친다 (둥지 무력화 → 잔해 뼈, ㉡)', () => {
  const r = runC3(graph);
  assert.equal(r.fight.nestDone, true, '둥지 무력화(0.1.2.2) 완료');
  // 무력화가 곧 무기급 뼈 공급 개방
  assert.ok(r.fight.공명전달률 >= graph.constants['공명전달_최소']);
});

test('용도 불명 균류가 촉매 demand 발견 순간 역결합된다 (retro-bind)', () => {
  const r = runC3(graph);
  assert.ok(r.retrobind.unbound.length >= 1, '획득 시 용도 불명 재료 존재');
  assert.ok(r.retrobind.links.some((l) => l.property === '생체촉매활성'), '촉매 속성으로 역결합');
});

test('§7 여는 목적: 균류 배양 원리(0.3.1.2)와 탈것(0.1.1.4.3)도 함께 열린다', () => {
  const r = runC3(graph);
  assert.equal(r.culture, true, '균주 실험 → 배양 지식 확인');
  assert.equal(r.mount, true, '신성내성 개체 포획 → 탈것 확보');
});

test('E1 재해석은 세계에 실존하는 것만 후보로 낸다 (스폰 금지)', () => {
  const r = runC3(graph);
  assert.ok(r.scan.length >= 1, '무기급 재료 후보가 세계에 실존');
});

test('무기 결합은 에너지저장 공급이 0 이라 아직 막힌다 (C4 에서 열림)', () => {
  const r = runC3(graph);
  assert.equal(r.weaponBlocked, true);
});

test('audit + 사건 감사 성립', () => {
  const r = runC3(graph);
  assert.equal(r.audit.ok, true);
  assert.ok(r.events.some((e) => e.verb === '전투'));
  assert.ok(r.events.some((e) => e.verb === '탐색'));
});
