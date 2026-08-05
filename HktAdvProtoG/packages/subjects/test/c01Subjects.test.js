import test from 'node:test';
import assert from 'node:assert/strict';
import { defineC01Ontology } from '../../ontology/src/c01Ontology.js';
import { AxiomRegistry, validateTransition } from '../../ontology/src/axioms.js';
import { registerC01Axioms } from '../../ontology/src/c01Axioms.js';
import { validateArchetypeProfile } from '../src/subjectModel.js';
import { validateC01Profiles, createC01Cast, createC01Player, C01_ARCHETYPE_PROFILES } from '../src/c01Subjects.js';

const ontology = defineC01Ontology();

test('프로필 6종·역할 4종이 존재론과 정합한다 (Handoff: O-S02 실제 출력 소비)', () => {
  assert.deepEqual(validateC01Profiles(ontology), []);
});

test('같은 시드 → 같은 배역 (결정성), 다른 시드 → 다른 배역', () => {
  const a = createC01Cast(11, ontology);
  const b = createC01Cast(11, ontology);
  const c = createC01Cast(12, ontology);
  assert.equal(a.castHash, b.castHash);
  assert.deepEqual(a.subjects, b.subjects);
  assert.notEqual(a.castHash, c.castHash);
  assert.equal(Object.keys(a.subjects).length, 8); // 주민3+조합1+상인1+무리1+포식1+군락1
});

test('SC-C01-S-01: 원형별 지각·행동 후보가 다르다 — 무리는 도망치고 포식자는 추격한다', () => {
  const { subjects } = createC01Cast(11, ontology);
  const byArch = (a) => Object.values(subjects).find((s) => s.archetype === a);
  const herd = byArch('herd-beast');
  const apex = byArch('apex-monster');
  const villager = byArch('villager');

  assert.ok(herd.behaviors.includes('flee'));
  assert.ok(!herd.behaviors.includes('stalk-prey'));
  assert.ok(apex.behaviors.includes('stalk-prey'));
  assert.ok(!apex.behaviors.includes('flee'));
  assert.ok(apex.perception.includes('scent-prey-tracking'));
  assert.ok(!villager.perception.includes('scent-prey-tracking'));
  // 세 원형의 지각·행동 집합은 서로 완전히 다르다
  const sig = (s) => JSON.stringify([s.perception, s.behaviors]);
  assert.equal(new Set([sig(herd), sig(apex), sig(villager)]).size, 3);
});

test('조직 주체는 실행 구성원을 갖고, 그 구성원 경유 행동은 조직 실체 공리를 통과한다 (Handoff: O-S01 소비)', () => {
  const { subjects } = createC01Cast(11, ontology);
  const guild = Object.values(subjects).find((s) => s.archetype === 'hunters-guild');
  assert.ok(guild.members.length >= 2);

  const axioms = registerC01Axioms(new AxiomRegistry());
  const withMembers = validateTransition({
    before: { contracts: {} }, after: { contracts: { 'ct-1': {} } },
    input: { events: [{ type: 'ContractIssued', actor: { kind: 'organization', id: guild.id, via: { members: [guild.members[0]] } }, payload: {}, statePaths: ['contracts.ct-1'] }] },
  }, axioms);
  assert.equal(withMembers.passed, true, JSON.stringify(withMembers.violations));

  const without = validateTransition({
    before: { contracts: {} }, after: { contracts: { 'ct-1': {} } },
    input: { events: [{ type: 'ContractIssued', actor: { kind: 'organization', id: guild.id }, payload: {}, statePaths: ['contracts.ct-1'] }] },
  }, axioms);
  assert.ok(without.violations.some((v) => v.violationCode === 'ORG_NO_EMBODIMENT'));
});

test('개체군 주체는 수량을 갖는다 (무리·군락)', () => {
  const { subjects } = createC01Cast(11, ontology);
  const herd = Object.values(subjects).find((s) => s.archetype === 'herd-beast');
  const colony = Object.values(subjects).find((s) => s.archetype === 'resource-colony');
  assert.ok(herd.population.count >= 30 && herd.population.count <= 50);
  assert.ok(colony.population.count >= 40 && colony.population.count <= 80);
});

test('플레이어 역할 4종 생성 — 역할별 행동 후보가 다르다', () => {
  const roles = ['tracker', 'hunter', 'dresser-crafter', 'trader'];
  const players = roles.map((r, i) => createC01Player(`player-${i + 1}`, r, ontology));
  const sigs = new Set(players.map((p) => JSON.stringify(p.behaviors)));
  assert.equal(sigs.size, 4);
  assert.ok(players[0].behaviors.includes('inspect-trace'));
  assert.ok(players[1].behaviors.includes('dress-carcass'));
  assert.ok(players[2].behaviors.includes('craft-item'));
  assert.ok(players[3].behaviors.includes('hoard'));
});

test('불량 프로필·미지 역할은 거부된다 (실패 경로)', () => {
  assert.deepEqual(
    validateArchetypeProfile({ archetype: 'dragon', actorKind: 'individual', behaviors: ['x'], perception: [] }, ontology),
    ['존재론에 없는 원형: dragon'],
  );
  const badKind = validateArchetypeProfile(
    { archetype: 'villager', actorKind: 'organization', behaviors: ['x'], perception: [], memberCount: [1, 2] }, ontology);
  assert.ok(badKind.some((e) => e.includes('actorKind 불일치')));
  const noBehaviors = validateArchetypeProfile(
    { archetype: 'villager', actorKind: 'individual', behaviors: [], perception: [] }, ontology);
  assert.ok(noBehaviors.some((e) => e.includes('행동 후보 없음')));
  assert.throws(() => createC01Player('p1', 'wizard', ontology), /미지 역할/);
});

test('조직 프로필에는 memberCount 가 필수다 — 조직 실체 공리의 생성 시점 보증 (경계)', () => {
  const orgProfile = C01_ARCHETYPE_PROFILES.find((p) => p.archetype === 'hunters-guild');
  const stripped = { ...orgProfile, memberCount: undefined };
  assert.ok(validateArchetypeProfile(stripped, ontology).some((e) => e.includes('memberCount')));
});
