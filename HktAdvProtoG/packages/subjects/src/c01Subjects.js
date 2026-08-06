// C01-S-S01 — 국경 협곡 사냥터의 원형 프로필 6종·역할 프로필 4종·표준 배역 생성.
// 원형마다 지각·행동 후보가 다르다 (SC-C01-S-01): 무리는 도망치고, 포식자는 추격한다.
// habitat 은 그 원형이 평소 머무는 곳 — R3 지각이 "여기서 보이는가"를 판정하는 기준이다.
import { SeededRandom, createIdGenerator, stateHash } from '../../verification/src/deterministic.js';
import { validateArchetypeProfile, createIndividual, createPlayerSubject } from './subjectModel.js';

export const C01_ARCHETYPE_PROFILES = [
  {
    archetype: 'villager', actorKind: 'individual',
    habitat: 'village-pasture',
    perception: ['sight-near', 'hearing', 'rumor'],
    behaviors: ['farm', 'herd-livestock', 'flee-to-village', 'report-sighting', 'spread-rumor'],
    attrRanges: { courage: [1, 6], health: [5, 9] },
  },
  {
    archetype: 'hunters-guild', actorKind: 'organization',
    habitat: 'hunter-outpost',
    perception: ['member-reports', 'village-complaints'],
    // suspend-cull-contract: 조절 계약을 거둬 무리를 회복시키는 지렛대 (먹이 회복 개입군)
    behaviors: ['issue-cull-contract', 'suspend-cull-contract', 'issue-subjugation-contract', 'buy-potions', 'rate-contract-performance'],
    memberCount: [2, 4],
  },
  {
    archetype: 'merchant', actorKind: 'individual',
    habitat: 'hunter-outpost',
    perception: ['market-stock', 'price-board', 'rumor'],
    behaviors: ['update-prices', 'buy-byproducts', 'sell-supplies', 'organize-export'],
    attrRanges: { capital: [20, 60] },
  },
  {
    archetype: 'herd-beast', actorKind: 'population',
    habitat: 'herd-valley',
    perception: ['scent-predator', 'sight-wide', 'hearing'],
    behaviors: ['graze', 'migrate', 'flee', 'breed', 'trample-colony'],
    populationRange: [30, 50],
  },
  {
    archetype: 'apex-monster', actorKind: 'individual',
    habitat: 'apex-lair',
    perception: ['scent-prey-tracking', 'night-sight', 'hearing'],
    behaviors: ['stalk-prey', 'hunt', 'relocate-lair', 'recover-injury', 'raid-pasture'],
    attrRanges: { aggression: [4, 9], injury: [0, 0] },
  },
  {
    archetype: 'resource-colony', actorKind: 'population',
    habitat: 'marsh-colony',
    perception: [],
    behaviors: ['regenerate', 'degrade-under-trampling'],
    populationRange: [40, 80],
  },
];

export const C01_ROLE_PROFILES = [
  { role: 'tracker', station: 'lookout-rocks', perception: ['trace-reading', 'rumor'], behaviors: ['inspect-trace', 'survey-from-lookout', 'update-map', 'sell-intel'] },
  // set-bait: 미끼로 대상을 다른 곳으로 끌어내는 행동 (유인 개입군)
  { role: 'hunter', station: 'hunter-outpost', perception: ['sight-near', 'trace-reading'], behaviors: ['prepare-gear', 'set-bait', 'stalk', 'fight', 'capture', 'dress-carcass'] },
  { role: 'dresser-crafter', station: 'marsh-colony', perception: ['quality-appraisal'], behaviors: ['gather-herbs', 'appraise', 'craft-item', 'deliver-contract'] },
  { role: 'trader', station: 'hunter-outpost', perception: ['market-stock', 'price-board'], behaviors: ['quote-price', 'buy', 'sell', 'hoard', 'export'] },
];

/** 프로필 전체 정합 검사 — 존재론과 어긋나면 오류 목록 */
export function validateC01Profiles(ontology) {
  const errors = [];
  for (const p of C01_ARCHETYPE_PROFILES) errors.push(...validateArchetypeProfile(p, ontology));
  for (const r of C01_ROLE_PROFILES) {
    if (!ontology.has('player-role', r.role)) errors.push(`존재론에 없는 역할: ${r.role}`);
    if (!r.behaviors?.length) errors.push(`역할 행동 후보 없음: ${r.role}`);
  }
  return errors;
}

/**
 * 표준 배역 생성 (결정적): 주민 3, 조합 1(구성원 포함), 상인 1, 무리 1, 포식 마물 1, 군락 1.
 * 반환: { subjects: {id→subject}, castHash }
 */
export function createC01Cast(seed, ontology) {
  const errors = validateC01Profiles(ontology);
  if (errors.length) throw new Error(`프로필 정합 실패:\n${errors.join('\n')}`);
  const rng = new SeededRandom(seed);
  const idGen = createIdGenerator('sub');
  const counts = { villager: 3, 'hunters-guild': 1, merchant: 1, 'herd-beast': 1, 'apex-monster': 1, 'resource-colony': 1 };
  const subjects = {};
  for (const profile of C01_ARCHETYPE_PROFILES) {
    if (!counts[profile.archetype]) continue;
    for (let i = 0; i < counts[profile.archetype]; i++) {
      const s = createIndividual(rng, profile, idGen);
      subjects[s.id] = s;
    }
  }
  return { subjects, castHash: stateHash(subjects) };
}

/** 플레이어 주체 생성 — roleId 는 존재론 player-role 이어야 한다 */
export function createC01Player(playerId, roleId, ontology) {
  const profile = C01_ROLE_PROFILES.find((r) => r.role === roleId);
  if (!profile) throw new Error(`미지 역할 프로필: ${roleId}`);
  return createPlayerSubject(playerId, profile, ontology);
}
