import sceneStateSchema from '../schemas/v3-scene-state.schema.json';
import type { Fixture, ScenarioSpec } from '../src/types.js';
import type { JsonSchema } from '@hkt/v1-schema';

/**
 * 대표 장면이 쓰는 픽스처와 명세.
 *
 * 세계 어휘(에너지·사건 로그)는 K0~K3 이 정본을 갖는다. 여기 있는 것은 **시나리오 실행기 자체를
 * 굴려 보기 위한 최소 어휘**이며, VS0(원문 「20」)의 장면 형태 — 에너지 10, 행동마다 3 소비,
 * 네 번째는 실패 — 를 그대로 흉내 내 실행기가 그 형태를 실제로 돌릴 수 있는지 확인한다.
 */

export const SCENE_STATE_SCHEMA = sceneStateSchema as JsonSchema;

export const hunterScene: Fixture = {
  id: 'hunter_scene',
  title: '사냥꾼 하나 · 에너지 10 · 빈 사건 로그',
  schemaId: 'https://hkt.local/schemas/v3-scene-state.schema.json',
  state: {
    actor: { id: 'npc_hunter_01', energy: 10, posture: 'idle' },
    log: [],
  },
};

/** 스키마를 어기는 픽스처 — 적재 단계에서 걸려야 한다. */
export const brokenScene: Fixture = {
  id: 'broken_scene',
  title: '에너지가 수가 아닌 잘못된 초기 상태',
  schemaId: 'https://hkt.local/schemas/v3-scene-state.schema.json',
  state: {
    actor: { id: 'npc_hunter_01', energy: 'ten' },
    log: [],
  },
};

export const BASE_SEED = { worldSeed: '20260730', tick: 0, subjectId: 'npc_hunter_01' } as const;

/** 행동 한 번 = 에너지 3 소비 + 사건 기록. */
export function actionPair(note: string): ScenarioSpec['when'] {
  return [
    { step: 'consume', params: { path: '/actor/energy', amount: 3 }, note },
    { step: 'record_event', params: { path: '/log', kind: 'acted', detail: note }, note: `${note} 기록` },
  ];
}
