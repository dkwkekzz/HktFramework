// Presentation Resolver — 결정 Layer 의 진입점.
// Semantic Snapshot(role/state/값/사유 코드)을 Presentation 데이터로 해석해
// Capability Layer 가 소비할 Render Plan 을 만든다. 순수 함수 — Fixture 로 검증 가능.
//
// 결정은 전부 *-presentation.ts 의 role/id 단위 단일 항목과 주입된 Motion Library 에서 온다.
// 이 파일과 capability 코드는 Cycle 이 늘어도 수정되지 않는다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import { motionLibrary } from '../motion/motion-source';
import type { MotionLibrary } from '../motion/motion-library';
import type { SceneMotion, SceneState } from '../scene/scene-state';
import { collisionDebug } from './collision-presentation';
import { hudPresentation } from './hud-presentation';
import { interactionPresentation } from './interaction-presentation';
import { codeText } from './code-text';
import { rolePresentation } from './role-presentation';

// 관찰자 쪽 표시 선택 (C006) — 충돌체 디버그 관찰을 켤지. World 에 아무것도 요청하지 않는다.
export interface PresentationOptions {
  debugObserve?: boolean; // 기본 off (04-gameview.spec debugObserve.toggle)
}

// entity.kind(종류) + state(행동) → 재생할 모션. 데이터가 없으면 undefined 이고
// 그리기는 spriteId 의 절차 생성 Asset 이 맡는다 (spec 의 fallback 마지막 단계).
function resolveMotion(
  motions: MotionLibrary,
  kind: string | undefined,
  state: string,
  progress: number | undefined,
): SceneMotion | undefined {
  if (!kind) return undefined;
  const asset = motions.resolve(kind, state);
  if (!asset) return undefined;

  return {
    id: asset.id,
    url: asset.url,
    cols: asset.cols,
    rows: asset.rows,
    frames: asset.frames,
    fps: asset.fps,
    mode: progress === undefined ? 'loop' : 'progress',
    ...(progress === undefined ? {} : { progress }),
  };
}

export function resolvePresentation(
  snapshot: GameViewSnapshot,
  motions: MotionLibrary = motionLibrary,
  options: PresentationOptions = {},
): SceneState {
  return {
    specId: snapshot.specId,
    terrain: snapshot.scene,
    // 충돌체 디버그 관찰 (C006) — 켜졌을 때만 지시를 담는다
    ...(options.debugObserve ? { colliderDebug: collisionDebug(snapshot) } : {}),
    entities: snapshot.entities.map((e) => {
      const p = rolePresentation(e.role);
      const motion = resolveMotion(motions, e.kind, e.state, e.progress);
      // 조종하는 이가 없는 몸의 표현 (C004) — attended 가 실린 대상에만 해당한다.
      const unattended = e.attended === false;
      const tint = unattended && p.unattendedTint !== undefined ? p.unattendedTint : p.tint;
      const label =
        unattended && p.unattendedLabel !== undefined
          ? p.unattendedLabel
          : e.labelValue !== undefined
            ? p.labelFormat
              ? p.labelFormat(e.labelValue)
              : String(e.labelValue)
            : undefined;
      return {
        id: e.id,
        spriteId: `${p.sprite}:${e.state}`,
        ...(motion ? { motion } : {}),
        size: p.size,
        ...(tint === undefined ? {} : { tint }),
        position: e.position,
        ...(label === undefined ? {} : { label }),
        cameraFollow: p.cameraFollow ?? false,
        trail: p.trail ?? false,
      };
    }),
    interactions: snapshot.interactions.map((i) => {
      const p = interactionPresentation(i.role);
      return {
        id: i.id,
        available: i.available,
        ...(i.targetEntityId ? { targetEntityId: i.targetEntityId } : {}),
        ...(p.terrainTarget ? { terrainTarget: true } : {}),
        ...(p.key ? { key: p.key } : {}),
        ...(p.keyLabel ? { keyLabel: p.keyLabel } : {}),
        ...(p.prompt ? { prompt: p.prompt } : {}),
        ...(i.reason ? { unavailableText: codeText(i.reason) } : {}),
      };
    }),
    hud: snapshot.hud.map((h) => {
      const p = hudPresentation(h.id);
      return {
        id: h.id,
        widget: h.kind,
        label: p.label,
        ...(p.icon ? { icon: p.icon } : {}),
        // 의미 코드 값(label 위젯)은 문구 결정을, 형식 지시가 있으면 그 형식을 거친다
        value: p.format
          ? p.format(h.value)
          : h.kind === 'label'
            ? codeText(String(h.value))
            : h.value,
        ...(h.progress === undefined ? {} : { progress: h.progress }),
        ...(p.celebrateGain ? { celebrateGain: true } : {}),
      };
    }),
  };
}
