// C01-O-S02 — 국경 협곡 사냥터 존재론 카탈로그.
// CYCLE.yaml regionScope/subjectsAndFactions/resourceEconomy 의 모든 요소를 존재론 타입으로 표현한다
// (완료 조건). 좌표·수치는 넣지 않는다 — 공간·상태 실체화는 W 계층의 몫이다.
import { WorldOntology } from './worldOntology.js';

export function defineC01Ontology() {
  const o = new WorldOntology();

  // 장소 6 — tags 는 CYCLE.yaml 의 productionSites/dangerZones/socialSpaces 근거
  o.addEntity('place', { id: 'hunter-outpost', name: '사냥꾼 전초 마을', tags: ['social', 'market', 'guild'] });
  o.addEntity('place', { id: 'village-pasture', name: '마을 목장', tags: ['production', 'threat-target'] });
  o.addEntity('place', { id: 'herd-valley', name: '초식 무리 서식 골짜기', tags: ['production', 'danger'] });
  o.addEntity('place', { id: 'apex-lair', name: '포식 마물 둥지 협곡', tags: ['danger'] });
  o.addEntity('place', { id: 'marsh-colony', name: '약초·먹이 군락 습지', tags: ['production'] });
  o.addEntity('place', { id: 'lookout-rocks', name: '전망 바위', tags: ['observation'] });

  // 이동 구조 3
  o.addEntity('route', { id: 'monster-route', name: '마물 이동로', dependsOn: ['prey', 'habitat'] });
  o.addEntity('route', { id: 'hunting-trail', name: '사냥로', dependsOn: [] });
  o.addEntity('route', { id: 'export-route', name: '외부 운송로', dependsOn: [] });

  // 주체 원형 6 — actorKind 는 조직 실체 공리(AX-ORG-EMBODIED)의 적용 대상 구분에 쓰인다
  o.addEntity('subject-archetype', { id: 'villager', name: '마을 주민', actorKind: 'individual', goals: ['safety', 'food'] });
  o.addEntity('subject-archetype', { id: 'hunters-guild', name: '사냥꾼 조합', actorKind: 'organization', goals: ['village-defense', 'hunt-order', 'reputation'] });
  o.addEntity('subject-archetype', { id: 'merchant', name: '부산물 상인', actorKind: 'individual', goals: ['inventory', 'price', 'profit'] });
  o.addEntity('subject-archetype', { id: 'herd-beast', name: '초식 무리', actorKind: 'population', goals: ['forage', 'breeding', 'migration'] });
  o.addEntity('subject-archetype', { id: 'apex-monster', name: '거대 포식 마물', actorKind: 'individual', goals: ['prey', 'lair', 'recovery'] });
  o.addEntity('subject-archetype', { id: 'resource-colony', name: '자원 군락', actorKind: 'population', goals: ['regeneration'] });
  // 플레이어도 정식 세계의 주체다 — state.subjects 에 살기 위해 존재론 어휘가 필요하다
  o.addEntity('subject-archetype', { id: 'player', name: '플레이어', actorKind: 'individual', goals: [] });

  // 플레이어 역할 4
  o.addEntity('player-role', { id: 'tracker', name: '추적꾼' });
  o.addEntity('player-role', { id: 'hunter', name: '사냥꾼' });
  o.addEntity('player-role', { id: 'dresser-crafter', name: '해체·제작자' });
  o.addEntity('player-role', { id: 'trader', name: '부산물 상인(플레이어)' });

  // 자원 6
  for (const [id, name] of [
    ['hide', '가죽'], ['monster-organ', '마물 기관'], ['meat', '고기'],
    ['healing-herb', '치료 약초'], ['bait-material', '미끼 재료'], ['food', '식량'],
  ]) o.addEntity('resource', { id, name });

  // 제작물 4 — inputs 필수 (보존 공리): 기본 제작식은 W/G 에서 확장될 수 있는 최소값
  o.addEntity('craft-item', { id: 'healing-potion', name: '치료제', inputs: [{ resource: 'healing-herb', qty: 2 }] });
  o.addEntity('craft-item', { id: 'bait', name: '미끼', inputs: [{ resource: 'bait-material', qty: 1 }, { resource: 'meat', qty: 1 }] });
  o.addEntity('craft-item', { id: 'tracking-tool', name: '추적 도구', inputs: [{ resource: 'hide', qty: 1 }] });
  o.addEntity('craft-item', { id: 'equipment', name: '장비', inputs: [{ resource: 'hide', qty: 2 }, { resource: 'monster-organ', qty: 1 }] });

  // 사건 타입 — R 계층이 이 어휘 밖의 사건을 정식 세계에 기록하지 못하게 하는 기준
  for (const [id, requiredPayload] of [
    ['ResourceGathered', ['resource', 'qty', 'at']],
    ['MonsterMoved', ['subjectId', 'from', 'to']],
    ['MonsterHunted', ['subjectId', 'by']],
    ['ItemCrafted', ['produces', 'consumes']],
    ['ResourceClaimed', ['resource', 'by']],
    ['ContractIssued', ['contractId', 'kind']],
    ['ContractResolved', ['contractId', 'outcome']],
    ['TradeExecuted', ['resource', 'qty', 'from', 'to']],
    ['TrackProgress', ['by', 'roll']],
  ]) o.addEntity('event-type', { id, requiredPayload });

  return o;
}
