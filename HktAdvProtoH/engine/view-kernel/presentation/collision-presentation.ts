// Collision Presentation (C006 / R1) — 충돌체 디버그 관찰을 "어떻게 그릴지" 결정한다
// (결정 Layer). Spec 의 debugObserve 계약을 소비한다:
//   bodies          → 몸 캡슐 부피 + 속도 화살표
//   actionColliders → 칼끝 충돌 구 (활성/비활성 구분) + 맞은 몸 표시
// 색·투명도·구체 높이·화살표 배율은 전부 여기의 표현 결정이다 — World 의 의미가 아니다.

import type { EntityView, GameViewSnapshot } from '../../protocol-core/gameview';
import type {
  SceneColliderDebug,
  SceneDebugCapsule,
  SceneDebugSphere,
  SceneDebugVector,
} from '../scene/scene-state';

const BODY_COLOR = 0x36d399; // 몸 캡슐 — 초록
const BODY_OPACITY = 0.55;
const SWING_ACTIVE_COLOR = 0xff5252; // 활성 칼끝 구 — 빨강 (지금 닿으면 맞는다)
const SWING_ACTIVE_OPACITY = 0.85;
const SWING_IDLE_COLOR = 0xf0c33c; // 비활성 칼끝 구 — 노랑 (예비/여운 자세)
const SWING_IDLE_OPACITY = 0.3;
const STRUCK_COLOR = 0xff8f3c; // 이번 휘두름에 맞은 몸 표시 — 주황
const STRUCK_OPACITY = 0.5;
const STRUCK_MARK_SCALE = 1.25; // 맞은 몸 캡슐의 배수로 겹쳐 그린다
const VELOCITY_COLOR = 0x4db8ff; // 밀리는 방향·세기 — 파랑
const VELOCITY_SCALE = 0.35; // 화살표 길이 = 속도 × 배율 (초 단위 여행 거리)
const VELOCITY_MIN = 1e-3; // 이보다 느리면 화살표를 생략한다
const SWING_ELEVATION_RATIO = 0.55; // 칼끝 구의 높이 = 휘두르는 몸 키의 비율 (허리~가슴께)

export function collisionDebug(snapshot: GameViewSnapshot): SceneColliderDebug {
  const capsules: SceneDebugCapsule[] = [];
  const spheres: SceneDebugSphere[] = [];
  const vectors: SceneDebugVector[] = [];
  const byId = new Map<string, EntityView>(snapshot.entities.map((e) => [e.id, e]));

  for (const entity of snapshot.entities) {
    const { body, swing } = entity;

    if (body) {
      capsules.push({
        id: `body:${entity.id}`,
        center: entity.position,
        radius: body.radius,
        height: body.height,
        color: BODY_COLOR,
        opacity: BODY_OPACITY,
      });

      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
      if (speed > VELOCITY_MIN) {
        vectors.push({
          id: `velocity:${entity.id}`,
          from: entity.position,
          to: {
            x: entity.position.x + body.velocity.x * VELOCITY_SCALE,
            z: entity.position.z + body.velocity.z * VELOCITY_SCALE,
          },
          color: VELOCITY_COLOR,
        });
      }
    }

    if (swing) {
      spheres.push({
        id: `swing:${entity.id}`,
        center: swing.center,
        radius: swing.radius,
        elevation: (body?.height ?? 1.7) * SWING_ELEVATION_RATIO,
        color: swing.active ? SWING_ACTIVE_COLOR : SWING_IDLE_COLOR,
        opacity: swing.active ? SWING_ACTIVE_OPACITY : SWING_IDLE_OPACITY,
      });

      for (const struckId of swing.struck) {
        const struckEntity = byId.get(struckId);
        if (!struckEntity) continue; // 맞은 몸이 관찰에 없으면 표시할 자리도 없다
        const struckBody = struckEntity.body;
        capsules.push({
          id: `struck:${entity.id}:${struckId}`,
          center: struckEntity.position,
          radius: (struckBody?.radius ?? 0.5) * STRUCK_MARK_SCALE,
          height: (struckBody?.height ?? 1.7) * STRUCK_MARK_SCALE,
          color: STRUCK_COLOR,
          opacity: STRUCK_OPACITY,
        });
      }
    }
  }

  return { capsules, spheres, vectors };
}
