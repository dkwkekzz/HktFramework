// S0·S3 — 공통 주체 모델과 결정적 개별 주체 생성.
// 원형 프로필: 존재론의 subject-archetype 을 지각·행동 후보·속성 분포로 구체화한다.
// 의존 어휘(먹이·안전 …)는 여기서 선언하지 않는다 — D 계층이 원형에서 의존 그래프를 생성한다 (D2).

/** 프로필 정합 검사 — 존재론에 없는 원형·actorKind 불일치·빈 행동 후보를 거부 */
export function validateArchetypeProfile(profile, ontology) {
  const errors = [];
  if (!ontology.has('subject-archetype', profile.archetype)) {
    errors.push(`존재론에 없는 원형: ${profile.archetype}`);
    return errors;
  }
  const entity = ontology.get('subject-archetype', profile.archetype);
  if (entity.actorKind !== profile.actorKind)
    errors.push(`actorKind 불일치: ${profile.archetype} 존재론=${entity.actorKind} 프로필=${profile.actorKind}`);
  if (!Array.isArray(profile.behaviors) || profile.behaviors.length === 0)
    errors.push(`행동 후보 없음: ${profile.archetype}`);
  if (!Array.isArray(profile.perception))
    errors.push(`지각 목록 없음: ${profile.archetype}`);
  if (profile.actorKind === 'organization' && !(profile.memberCount?.length === 2))
    errors.push(`조직 프로필에 memberCount [min,max] 필요: ${profile.archetype} (조직 실체 공리)`);
  if (profile.actorKind === 'population' && !(profile.populationRange?.length === 2))
    errors.push(`개체군 프로필에 populationRange [min,max] 필요: ${profile.archetype}`);
  return errors;
}

const rollRange = (rng, [min, max]) => min + rng.int(max - min + 1);

/** 결정적 개별 주체 생성 — 같은 rng 시퀀스·프로필이면 같은 주체 */
export function createIndividual(rng, profile, idGen) {
  const subject = {
    id: idGen(),
    archetype: profile.archetype,
    actorKind: profile.actorKind,
    perception: [...profile.perception],
    behaviors: [...profile.behaviors],
    attrs: {},
  };
  for (const [attr, range] of Object.entries(profile.attrRanges ?? {}))
    subject.attrs[attr] = rollRange(rng, range);
  if (profile.actorKind === 'organization') {
    const n = rollRange(rng, profile.memberCount);
    subject.members = Array.from({ length: n }, () => idGen());
  }
  if (profile.actorKind === 'population') {
    subject.population = { count: rollRange(rng, profile.populationRange) };
  }
  return subject;
}

/** 플레이어 주체 — 역할은 존재론 player-role 에 있어야 하며 행동 후보는 역할 프로필에서 온다 */
export function createPlayerSubject(playerId, roleProfile, ontology) {
  if (!ontology.has('player-role', roleProfile.role))
    throw new Error(`존재론에 없는 역할: ${roleProfile.role}`);
  return {
    id: playerId,
    archetype: 'player',
    actorKind: 'individual',
    role: roleProfile.role,
    perception: [...roleProfile.perception],
    behaviors: [...roleProfile.behaviors],
    attrs: {},
  };
}
