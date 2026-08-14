// Collision Presentation (C006) — 충돌체 디버그 관찰을 "어떻게 그릴지" 결정한다
// (결정 Layer). Spec 의 debugObserve 계약을 소비한다:
//   bodies         → 몸 반경 원 + 속도 화살표
//   actionColliders → 휘두름 반경 원 (활성/비활성 구분) + 맞은 몸 표시
// 색·굵기·화살표 배율은 전부 여기의 표현 결정이다 — World 의 의미가 아니다.

import type { EntityView, GameViewSnapshot } from '../../protocol/gameview';
import type { SceneColliderDebug, SceneDebugCircle, SceneDebugVector } from '../scene/scene-state';

const BODY_COLOR = 0x36d399; // 몸 — 초록
const BODY_OPACITY = 0.9;
const SWING_ACTIVE_COLOR = 0xff5252; // 활성 휘두름 — 빨강 (지금 닿으면 맞는다)
const SWING_ACTIVE_OPACITY = 0.95;
const SWING_IDLE_COLOR = 0xf0c33c; // 비활성 휘두름 — 노랑 (예비/여운 구간)
const SWING_IDLE_OPACITY = 0.4;
const STRUCK_COLOR = 0xff8f3c; // 이번 휘두름에 맞은 몸 표시 — 주황
const STRUCK_OPACITY = 0.95;
const STRUCK_MARK_RADIUS_SCALE = 1.5; // 맞은 몸의 반경 배수로 겹쳐 그린다
const VELOCITY_COLOR = 0x4db8ff; // 밀리는 방향·세기 — 파랑
const VELOCITY_SCALE = 0.35; // 화살표 길이 = 속도 × 배율 (초 단위 여행 거리)
const VELOCITY_MIN = 1e-3; // 이보다 느리면 화살표를 생략한다

export function collisionDebug(snapshot: GameViewSnapshot): SceneColliderDebug {
  const circles: SceneDebugCircle[] = [];
  const vectors: SceneDebugVector[] = [];
  const byId = new Map<string, EntityView>(snapshot.entities.map((e) => [e.id, e]));

  for (const entity of snapshot.entities) {
    const { body, swing } = entity;

    if (body) {
      circles.push({
        id: `body:${entity.id}`,
        center: entity.position,
        radius: body.radius,
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
      circles.push({
        id: `swing:${entity.id}`,
        center: swing.center,
        radius: swing.radius,
        color: swing.active ? SWING_ACTIVE_COLOR : SWING_IDLE_COLOR,
        opacity: swing.active ? SWING_ACTIVE_OPACITY : SWING_IDLE_OPACITY,
      });

      for (const struckId of swing.struck) {
        const struckEntity = byId.get(struckId);
        if (!struckEntity) continue; // 맞은 몸이 관찰에 없으면 표시할 자리도 없다
        circles.push({
          id: `struck:${entity.id}:${struckId}`,
          center: struckEntity.position,
          radius: (struckEntity.body?.radius ?? 0.5) * STRUCK_MARK_RADIUS_SCALE,
          color: STRUCK_COLOR,
          opacity: STRUCK_OPACITY,
        });
      }
    }
  }

  return { circles, vectors };
}
