// Presentation Resolver — 결정 Layer 의 진입점.
// Semantic Snapshot(role/state/값/사유 코드)을 Presentation 데이터로 해석해
// Capability Layer 가 소비할 Render Plan 을 만든다. 순수 함수 — Fixture 로 검증 가능.
//
// 결정은 전부 *-presentation.ts 의 role/id 단위 단일 항목과 주입된 Motion Library 에서 온다.
// 이 파일과 capability 코드는 Cycle 이 늘어도 수정되지 않는다.

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../engine/protocol-core/gameview';
import type { GameViewSnapshot } from '../protocol/gameview';
import { screenSideValue } from '../../engine/view-kernel/camera/orientation';
import { facingDecision, type ScreenSide } from '../../engine/view-kernel/presentation/facing-presentation';
import { motionLibrary } from './motion-source';
import type { MotionLibrary } from '../../engine/view-kernel/motion/motion-library';
import type {
  SceneCommandHistoryLine,
  SceneCommandSurface,
  SceneMotion,
  SceneState,
} from '../../engine/view-kernel/scene/scene-state';
import { answerLogLines, type KeptAnswer } from './answer-log';
import { collisionDebug } from '../../engine/view-kernel/presentation/collision-presentation';
import { commandEntries, composeCommand } from '../../engine/view-kernel/presentation/command-presentation';
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
import { regionZones } from './region-presentation';
import { DESIGNATE_MODIFIER, type Designation } from './pointer-rules';
import { designationHighlight, targetFrame } from './target-frame-presentation';

// 관찰자 쪽 표시 선택 — 충돌체 디버그 관찰을 켤지. World 에 아무것도 요청하지 않는다.
export interface PresentationOptions {
  debugObserve?: boolean; // 기본 off (04-gameview.spec debugObserve.toggle)
  // 속성 관찰 (04 debugAuthority.inspect.toggle). 기본 off.
  // 세계는 이미 모든 속성을 보내고 있다. 이 값은 그것을 펼쳐 볼지만 정한다.
  inspect?: boolean;
  /**
   * 지금 시점이 수평으로 돈 각 (04 viewpoint.orientation.turn).
   * 세계에서 오는 값이 아니라 관찰자가 가진 값이다. 없으면 기본 시점(0)으로 읽는다.
   */
  viewTurn?: number;
  /**
   * 직전 프레임에 각 몸이 어느 쪽으로 읽혔는지 (04 ambiguous: keep-previous).
   * 이 함수는 읽기만 한다 — 갱신은 결과를 받은 쪽이 한다.
   */
  facingSides?: Readonly<Record<string, ScreenSide>>;
  /**
   * 명령 표면의 지금 상태 (04 commandSurface). 관찰자가 소유하는 값이다 —
   * 열려 있는가, 무엇을 쓰고 있는가, 무엇을 주고받았는가. 세계는 이것을 알지 못한다.
   */
  command?: CommandSurfaceInput;
  /**
   * 지금 무엇을 지목했는가 (C026 R1 — RULE-DESIGNATE-001). **관찰자가 쥐는 값이다** —
   * 스냅샷에 실리지 않고 조립(app)이 소유한다. 세계는 누가 무엇을 지목했는지 모른다.
   *
   * C027 CHANGED — 없어도 **판은 선다**: 그때의 대상은 내 몸이 선 자리다 (C027 R3).
   * 표식은 지금까지대로 지목이 있을 때만 선다 — 아무도 지목하지 않은 자리를 세계 위에
   * 표시하면 그것이 거짓말이다.
   */
  designation?: Designation;
  /**
   * 세계가 나에게 한 말들 — 거절 사유와 알림 (C028 R4 · SPEC-006). **관찰자가 쥐는 값이다**:
   * 스냅샷에 실리지 않고 조립(app)이 모아 두며 다른 관찰자에게 가지 않는다 (SPEC-009 경계).
   *
   * **오래된 것부터** 온다 — 새 것을 위에 세우는 것은 표현의 결정이므로 answerLogLines 가
   * 뒤집는다. 없거나 비면 판에 기록 자리가 아예 서지 않는다 (SPEC-006 경계).
   */
  answers?: readonly KeptAnswer[];
}

/**
 * RULE-SELF-HUD-001 — 상시 HUD 는 **내 몸의 상태만** 진다 (C027 R5 · SPEC-006).
 *
 * 세계의 사실 셋은 이제 판이 진다.
 *   region.depth      봉투의 hud 로 오던 줄 — 여기서 걷어 낸다. 판의 "깊이" 줄이 같은 값을 진다
 *   region.safe-by    C006 이 standingConditions 로 세우던 줄 — 판의 "걸린 것" 줄이 진다
 *   region.pressure   C008 이 region.state 로 세우던 줄 — 판의 "압력" 줄이 진다
 *
 * 뒤의 둘은 애초에 봉투의 hud 목록이 아니라 View 가 세우던 줄이므로 **세우기를 그만두면
 * 사라진다** (그 자리는 target-frame-presentation 이다). 앞의 하나만 세계가 실어 오므로
 * 여기서 걸러야 한다 — 같은 사실이 두 자리에 적히면 둘 중 하나를 믿을 수 없게 된다.
 */
const FRAME_OWNED_HUD_IDS: ReadonlySet<string> = new Set(['region.depth']);

function isFrameOwnedHudId(id: string): boolean {
  return FRAME_OWNED_HUD_IDS.has(id);
}

/**
 * RULE-DESIGNATE-HINT-001 — 조작 안내에 **지목하는 법** 한 줄 (C027 R6 · SPEC-007).
 *
 * 보조키가 무엇인지의 원본은 pointer-rules 의 DESIGNATE_MODIFIER 하나뿐이다 — 사본을 두면
 * 키를 옮겼을 때 화면이 없는 키를 안내한다. 여기서는 그 값을 키 표기로만 올려 끼운다.
 * 기존 안내 줄들은 그대로다 — 줄이 하나 늘 뿐이다 (SPEC-007 경계).
 */
const DESIGNATE_KEY_LABEL =
  DESIGNATE_MODIFIER.charAt(0).toUpperCase() + DESIGNATE_MODIFIER.slice(1);

function designateHint(): readonly string[] {
  return [codeText('hint.designate', DESIGNATE_KEY_LABEL)];
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
    // 재생 방식은 셋이다. 소요 시간이 있으면 진행도가 이끌고(progress), 없으면 시트가
    // 선언한 대로다 — 되돌아오지 않는다고 밝힌 시트(once)는 한 바퀴만 돌고 마지막 자세에
    // 머문다. 여기서 시트의 선언을 읽지 않고 늘 loop 로 두었기 때문에 쓰러진 몸이
    // 계속 일어섰다 다시 쓰러졌다 (motion-format.ts MotionPlay 의 존재 이유).
    mode: progress !== undefined ? 'progress' : asset.play === 'once' ? 'once' : 'loop',
    ...(progress === undefined ? {} : { progress }),
    ...(geometry ? { geometry } : {}),
  };
}

/**
 * 명령 표면 (04 commandSurface).
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
  // 세계 시각 — 타격 결과의 나이도, 재배열이 얼마 전인지도 이 값 하나로 잰다.
  // zones 가 그것을 쓰므로 장면을 세우기 전에 먼저 읽는다.
  const worldTimeValue = snapshot.hud.find((h) => h.id === 'world.time')?.value;
  const worldTime = Number(worldTimeValue ?? 0);
  // 세계 시각을 **모르는 것**과 0 인 것은 다르다 (C028 SPEC-003 경계). 봉투가 아직 그 줄을
  // 싣지 않았으면 나이를 재지 않는다 — 아래 두 자리(기록 줄 · 재배열)가 이 값을 받는다.
  // zones 는 지금까지대로 0 을 받는다 (C008 의 맥동은 창 밖이면 어차피 서지 않는다)
  const knownWorldTime =
    worldTimeValue !== undefined && Number.isFinite(worldTime) ? worldTime : undefined;
  // 판은 지목이 없어도 선다 (C027 R3) — 지목을 넘기고, 없으면 내가 선 자리가 답한다.
  // 표식은 지목이 있고 그 대상이 아직 세계에 있을 때만 선다
  const frame = targetFrame(snapshot, options.designation, knownWorldTime);
  const highlight = options.designation
    ? designationHighlight(snapshot, options.designation)
    : undefined;
  // 관찰자가 모아 둔 말 → 판의 기록 줄 (C028 R4). **판이 무엇을 지고 있든 같은 자리다** —
  // 지목한 자리든 존재든 내가 선 자리든, 기록은 대상의 것이 아니라 관찰자의 것이므로
  // 대상이 바뀌어도 그대로 남는다 (SPEC-006). 비면 붙이지 않는다 — 빈 기록판은 없다
  const log = answerLogLines(options.answers ?? [], knownWorldTime);
  const framed = frame && log.length > 0 ? { ...frame, log } : frame;
  return {
    specId: snapshot.specId,
    terrain: snapshot.scene,
    commandSurface: commandSurface(snapshot, options),
    // 기반이 지닌 범용 capability 자리들 — 이 층은 아직 아무것도 올리지 않는다.
    // 채우는 것은 그것을 요구하는 Cycle 의 일이며, 비어 있으면 그려지지 않는다.
    effects: [],
    surfaces: [],
    slotBars: [],
    // 선 방의 바닥 (C001) — 모르는 방이면 비어 있고, 비어 있으면 그려지지 않는다.
    // C008 부터 구역·통로도 여기서 선다 — 재배열이 얼마 전인지를 재려고 세계 시각을 함께 넘긴다
    zones: regionZones(snapshot.region, worldTime),
    // 판 하나 (C026 · C027 CHANGED) — 지목한 것이 서고, 지목이 없으면 **내가 선 자리**가
    // 선다. 판이 아예 없는 경우는 내 몸을 모를 때뿐이다. 표식은 지목이 있을 때만 선다.
    // 세계로 나가는 요청은 어느 쪽이든 0 이다 (SPEC-009)
    ...(framed ? { targetFrame: framed } : {}),
    ...(highlight ? { highlight } : {}),
    // 조작 안내에 팩이 보태는 줄 (C027 R6)
    keyHints: designateHint(),
    // 선 방의 크기가 정하는 시점 거리 (C003) — 모르는 방이면 없고, 없으면 기본 거리다
    // 충돌체 디버그 관찰 — 켜졌을 때만 지시를 담는다
    ...(options.debugObserve ? { colliderDebug: collisionDebug(snapshot) } : {}),
    entities: snapshot.entities.map((e) => {
      const p = rolePresentation(e.role);
      const motion = resolveMotion(motions, e.kind, e.state, e.progress);
      // 조종하는 이가 없는 몸의 표현 — attended 가 실린 대상에만 해당한다.
      const unattended = e.attended === false;
      // 종류별 색 표가 있으면 그것이 role 의 기본 색보다 우선한다
      const baseTint = (e.kind !== undefined ? p.tintByKind?.[e.kind] : undefined) ?? p.tint;
      const tint = unattended && p.unattendedTint !== undefined ? p.unattendedTint : baseTint;
      const label =
        unattended && p.unattendedLabel !== undefined
          ? p.unattendedLabel
          : e.labelValue !== undefined
            ? p.labelFormat
              ? p.labelFormat(e.labelValue)
              : String(e.labelValue)
            : undefined;
      // 몸 위 기본 표시는 이름과 생명이다. 나머지 속성은 켜야 펼쳐진다.
      // 표지는 그 존재가 그려지는 크기(p.size) 바로 위에 붙는다.
      const plate = nameplate(e, p.size);
      const inspect = options.inspect ? inspectLines(e) : undefined;
      // 몸이 향한 방향(세계)을 지금 시점에서 본 좌우로 읽고, 그림 기준 방향과
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
        // 몸이 있는 존재의 그림 크기는 몸 높이에서 유도한다 —
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
    // 자기 자원·능력치·배율은 self 패널이 가져간다 (같은 값을 두 번 그리지 않는다)
    ...(selfPanel(snapshot) ? { self: selfPanel(snapshot) } : {}),
    // 타격 숫자는 맞은 몸의 그림 크기에 맞춰 떠오른다 — 그 몸이 아직 세계에 있으면 그 크기를 쓴다
    strikes: snapshot.strikes.map((event) =>
      strikeMark(
        event,
        rolePresentation(snapshot.entities.find((e) => e.id === event.targetId)?.role ?? '').size,
      ),
    ),
    worldTime,
    // 상시 HUD — **내 몸의 상태만** 남는다 (C027 R5). 세계의 사실은 판이 진다
    hud: [
      ...snapshot.hud
        .filter((h) => !isSelfHudId(h.id) && !isFrameOwnedHudId(h.id))
        .map((h) => {
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
    ],
  };
}
