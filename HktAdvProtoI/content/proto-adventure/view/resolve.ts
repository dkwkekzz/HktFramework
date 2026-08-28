// Presentation Resolver — 결정 Layer 의 진입점.
// Semantic Snapshot(role/state/값/사유 코드)을 Presentation 데이터로 해석해
// Capability Layer 가 소비할 Render Plan 을 만든다. 순수 함수 — Fixture 로 검증 가능.
//
// 결정은 전부 *-presentation.ts 의 role/id 단위 단일 항목과 주입된 Motion Library 에서 온다.
// 이 파일과 capability 코드는 Cycle 이 늘어도 수정되지 않는다.

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../../engine/protocol-core/gameview';
import type { GameViewSnapshot } from '../protocol/gameview';
import { screenSideValue } from '../../../engine/view-kernel/camera/orientation';
import { facingDecision, type ScreenSide } from '../../../engine/view-kernel/presentation/facing-presentation';
import { motionLibrary } from './motion-source';
import type { MotionLibrary } from '../../../engine/view-kernel/motion/motion-library';
import type {
  SceneCommandHistoryLine,
  SceneCommandSurface,
  SceneMotion,
  SceneState,
} from '../../../engine/view-kernel/scene/scene-state';
import { collisionDebug } from '../../../engine/view-kernel/presentation/collision-presentation';
import { commandEntries, composeCommand } from '../../../engine/view-kernel/presentation/command-presentation';
import {
  inspectLines,
  isSelfHudId,
  nameplate,
  selfPanel,
  strikeMark,
} from './combat-presentation';
import { hudPresentation } from './hud-presentation';
import { interactionPresentation } from './interaction-presentation';
import { codeText } from './code-text';
import { rolePresentation } from './role-presentation';
import { kindPresentation } from './kind-presentation';

// 관찰자 쪽 표시 선택 (C006) — 충돌체 디버그 관찰을 켤지. World 에 아무것도 요청하지 않는다.
export interface PresentationOptions {
  debugObserve?: boolean; // 기본 off (04-gameview.spec debugObserve.toggle)
  // 속성 관찰 (C007 R2 — 04 debugAuthority.inspect.toggle). 기본 off.
  // 세계는 이미 모든 속성을 보내고 있다. 이 값은 그것을 펼쳐 볼지만 정한다.
  inspect?: boolean;
  /**
   * 지금 시점이 수평으로 돈 각 (C008 — 04 viewpoint.orientation.turn).
   * 세계에서 오는 값이 아니라 관찰자가 가진 값이다. 없으면 기본 시점(0)으로 읽는다.
   */
  viewTurn?: number;
  /**
   * 직전 프레임에 각 몸이 어느 쪽으로 읽혔는지 (C008 — 04 ambiguous: keep-previous).
   * 이 함수는 읽기만 한다 — 갱신은 결과를 받은 쪽이 한다.
   */
  facingSides?: Readonly<Record<string, ScreenSide>>;
  /**
   * 명령 표면의 지금 상태 (C009 — 04 commandSurface). 관찰자가 소유하는 값이다 —
   * 열려 있는가, 무엇을 쓰고 있는가, 무엇을 주고받았는가. 세계는 이것을 알지 못한다.
   */
  command?: CommandSurfaceInput;
}

/** 관찰자가 쥐고 있는 명령 표면 상태 — 조립 루트가 소유한다 (04 history.owner: observer) */
export interface CommandSurfaceInput {
  open: boolean;
  text: string;
  history: readonly SceneCommandHistoryLine[];
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

  // 시트를 어디서 자를지는 정적 분석이 이미 구해 두었다 — 그리는 쪽이 픽셀을 훑지 않게 한다.
  const geometry = motions.geometry(asset);

  return {
    id: asset.id,
    url: asset.url,
    cols: asset.cols,
    rows: asset.rows,
    frames: asset.frames,
    fps: asset.fps,
    mode: progress === undefined ? 'loop' : 'progress',
    ...(progress === undefined ? {} : { progress }),
    ...(geometry ? { geometry } : {}),
  };
}

/**
 * 명령 표면 (C009 — 04 commandSurface).
 * 두 출처의 목록을 한 벌로 합치고, 지금 쓰고 있는 것에 대한 안내를 붙인다.
 * 목록은 표면이 닫혀 있어도 만들어진다 — 결정은 순수하고, 보일지는 capability 가 정한다.
 */
function commandSurface(
  snapshot: GameViewSnapshot,
  options: PresentationOptions,
): SceneCommandSurface {
  const states = {
    'collider-observe': options.debugObserve ?? false,
    'attribute-inspect': options.inspect ?? false,
  } as const;
  const entries = commandEntries(snapshot, states, codeText);
  const input = options.command;
  return {
    open: input?.open ?? false,
    // 닫는 자리를 부르는 말은 팩이 정한다 — 기반은 이름을 짓지 않는다
    closeText: codeText('command.close'),
    entries,
    composition: composeCommand(input?.text ?? '', entries, snapshot, states, codeText),
    history: [...(input?.history ?? [])],
  };
}

export function resolvePresentation(
  observed: CoreGameViewSnapshot,
  motions: MotionLibrary = motionLibrary,
  options: PresentationOptions = {},
): SceneState {
  // 이 세계의 관찰 결과는 팩 계약(04 spec — Snapshot.specId)의 형태다.
  // 봉투 형으로 도착한 것을 팩 형으로 좁히는 자리는 결정 Layer 의 진입점 하나뿐이다 (P2).
  const snapshot = observed as GameViewSnapshot;
  return {
    specId: snapshot.specId,
    terrain: snapshot.scene,
    commandSurface: commandSurface(snapshot, options),
    // 기반이 지닌 범용 capability 자리들 — 이 층은 아직 아무것도 올리지 않는다.
    // 채우는 것은 그것을 요구하는 Cycle 의 일이며, 비어 있으면 그려지지 않는다.
    effects: [],
    surfaces: [],
    slotBars: [],
    zones: [],
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
      // C007 — 몸 위 기본 표시는 이름과 생명이다. 나머지 속성은 켜야 펼쳐진다.
      // 표지는 그 존재가 그려지는 크기(p.size) 바로 위에 붙는다.
      const plate = nameplate(e, p.size);
      const inspect = options.inspect ? inspectLines(e) : undefined;
      // C008 — 몸이 향한 방향(세계)을 지금 시점에서 본 좌우로 읽고, 그림 기준 방향과
      // 비교해 뒤집을지 정한다. 방향이 없는 대상(광맥)은 이 결정을 받지 않는다.
      const facing = e.body?.facing;
      const decided = facing
        ? facingDecision(
            kindPresentation(e.kind).spriteBaseline,
            screenSideValue(options.viewTurn ?? 0, facing),
            options.facingSides?.[e.id],
          )
        : undefined;
      return {
        id: e.id,
        spriteId: `${p.sprite}:${e.state}`,
        ...(motion ? { motion } : {}),
        // 몸이 있는 존재의 그림 크기는 몸 높이에서 유도한다 (C006 R2) —
        // 충돌체와 이미지가 어긋나지 않고, 새 종류를 추가해도 자동으로 일치한다.
        // 몸이 없는 존재(광맥 등)만 role 의 표시 크기를 쓴다.
        size: e.body?.height ?? p.size,
        ...(tint === undefined ? {} : { tint }),
        position: e.position,
        ...(label === undefined ? {} : { label }),
        ...(plate ? { nameplate: plate } : {}),
        ...(inspect ? { inspect } : {}),
        ...(decided ? { facingSide: decided.side, flip: decided.flip } : {}),
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
    // C007 — 자기 자원·능력치·배율은 self 패널이 가져간다 (같은 값을 두 번 그리지 않는다)
    ...(selfPanel(snapshot) ? { self: selfPanel(snapshot) } : {}),
    // 타격 숫자는 맞은 몸의 그림 크기에 맞춰 떠오른다 — 그 몸이 아직 세계에 있으면 그 크기를 쓴다
    strikes: snapshot.strikes.map((event) =>
      strikeMark(
        event,
        rolePresentation(snapshot.entities.find((e) => e.id === event.targetId)?.role ?? '').size,
      ),
    ),
    worldTime: Number(snapshot.hud.find((h) => h.id === 'world.time')?.value ?? 0),
    hud: snapshot.hud.filter((h) => !isSelfHudId(h.id)).map((h) => {
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
