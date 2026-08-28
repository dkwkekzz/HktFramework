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
import { swingTrail } from './swing-presentation';
import { commandEntries, composeCommand } from '../../../engine/view-kernel/presentation/command-presentation';
import { panelKeyHints } from './key-registry';
import {
  inspectLines,
  isSelfHudId,
  nameplate,
  selfPanel,
  strikeMark,
} from './combat-presentation';
import {
  effectMarks,
  EMPTY_EFFECT_MEMORY,
  type EffectMemory,
} from './effect-presentation';
import { hudPresentation } from './hud-presentation';
import { allocationHudItems } from './allocation-presentation';
import { equipmentDetailLines, equipmentHudItems } from './equipment-presentation';
import { inventoryDetailLines, inventoryHudItems } from './inventory-presentation';
import { inventoryWorkspace } from './inventory-workspace';
import { interactionPresentation, interactionPriority } from './interaction-presentation';
import {
  NO_SKILL_ANSWERS,
  skillDetailLines,
  skillSlotBar,
  type SkillAnswers,
} from './skill-presentation';
import { codeText, shortCodeText } from './code-text';
import { contactMark } from './relation-presentation';
import { cancelMark } from './phase-presentation';
import { armedHudItems } from './armed-presentation';
import { executionLogSurface, rememberExecutions } from './execution-log';
import { kindPresentation } from './kind-presentation';
import { rolePresentation } from './role-presentation';
import { TARGET_TINT, targetDetailLines, targetHudItems } from './target-presentation';
import { groundDetailLines, groundGenesisLines, groundZonePlans } from './terrain-presentation';
import { growthEventLines, growthLines } from './growth-presentation';

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
  /**
   * 직전 관찰 결과에서 기억해 둔 값들 (F1 — effect-presentation).
   * 세계가 사건으로 보내지 않는 이펙트(채굴 · 알게 됨)는 두 관찰 결과의 *차이*로만
   * 읽힌다. facingSides 와 같은 규칙이다 — 조립 루트가 기억하고 여기서는 읽기만 한다.
   */
  effectsSince?: EffectMemory;
  /**
   * 내가 건 기술 요청이 어떻게 되었는가 (C025 — 04 requestOutcome).
   * 세계의 상태가 아니라 **관찰자가 쥐고 있는 값**이다 — 세계는 누가 무엇을 걸었는지
   * 기억하지 않는다. `command` · `facingSides` 와 같은 자리이며, 조립 루트가 소유한다.
   */
  skillAnswers?: SkillAnswers;
  /**
   * 지금 시각 (ms — 관찰자의 시계) — **세계 시간이 아니다** (V-007).
   *
   * 기다림의 나이를 재는 자다. 세계는 누가 언제 무엇을 보냈는지 모르므로, 보낸 지
   * 얼마가 지났는가는 이쪽에서만 알 수 있다. 주지 않으면 지금을 스스로 읽는다 —
   * 검사가 시계를 쥐고 싶을 때만 넘긴다.
   */
  now?: number;
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
    // 진행도가 오면 그것이 재생을 이끈다. 아니면 시트가 선언한 대로 반복하거나 1회 재생한다.
    mode: progress !== undefined ? 'progress' : asset.play,
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
    // 닫는 자리의 이름 — 기반은 ✕ 를 그릴 뿐 그것을 무엇이라 부르는지 모른다 (문구 반전 ⑤)
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
  const self = selfPanel(snapshot);
  // 기다림의 나이를 재는 시각 — 한 프레임 안에서는 하나여야 한다 (V-007).
  // 자리마다 따로 읽으면 같은 프레임의 두 표면이 다른 지금을 말하게 된다
  const now = options.now ?? performance.now();
  // V-018 — 이번 관찰에 실린 타격·무산·끊김을 기억한다. 세계는 그것을 잠시만 보내므로
  // (같은 수명), 되짚는 자리는 본 것을 쌓아 두지 않으면 지어낼 수밖에 없다.
  // 표면을 짓기 **전**에 부른다 — 이번 프레임의 사건이 이번 목록에 서야 한다
  rememberExecutions(snapshot);
  return {
    specId: snapshot.specId,
    terrain: snapshot.scene,
    // C-TERRAIN-001 — 땅의 자리들. 세계가 보낸 범위에 팩이 색·이름을 입혀 넘긴다.
    // **판정은 여기 없다** — 안인지 밖인지는 세계가 ground.self.state 로 이미 답했고,
    // 이 범위는 그리기 위한 것이다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
    zones: groundZonePlans(snapshot),
    commandSurface: commandSurface(snapshot, options),
    // 겹침 표면 (기반 capability) — C026 의 소지품 작업 공간.
    // 열려 있지 않아도 싣는다: 열림은 표면 자신이 지닌 값이고, 그리는 쪽이 그것을 본다
    surfaces: [
      inventoryWorkspace(snapshot, codeText, shortCodeText, now),
      // V-018 — 방금 있었던 일. 사건은 잠시 실렸다 사라지므로 **본 그대로 쌓아 둔다**
      executionLogSurface(snapshot),
    ],
    // 늘 서 있는 띠 — 지금 이 순간 고르는 것이 자기 자리를 갖는다 (VUX-SK §2.1).
    slotBars: [
      skillSlotBar(snapshot, shortCodeText, options.skillAnswers ?? NO_SKILL_ANSWERS, now),
    ],
    // 조작 안내에 팩의 키를 보탠다 (V-005) — 세계의 interaction 이 아니어서 그 패널에
    // 한 번도 뜨지 못하던 다섯이다. 무엇이 서는지는 키 표가 정한다
    keyHints: panelKeyHints(),
    // 지면에 그리는 부피들 — 두 자리가 하나의 계약을 나눠 쓴다.
    //   켜면 (C)   몸 캡슐 · 속도 화살표 · 맞은 몸 표시 · 칼끝 — 진단 표면 (C006)
    //   평시       칼끝 하나 — **장면의 일부** (C025)
    // C025 이 평시 쪽을 열었다. 기술마다 다른 모양이 닿는 것을 가르게 되었으므로,
    // 칼끝이 어디를 지났는지가 보이지 않으면 그 차이가 화면에 존재하지 않는다
    // (04 VIEW NOTE ①). 켜면 켠 쪽이 이긴다 — 같은 것을 두 번 그리지 않는다.
    colliderDebug: options.debugObserve ? collisionDebug(snapshot) : swingTrail(snapshot),
    entities: snapshot.entities.map((e) => {
      const p = rolePresentation(e.role);
      const motion = resolveMotion(motions, e.kind, e.state, e.progress);
      // 조종하는 이가 없는 몸의 표현 (C004) — attended 가 실린 대상에만 해당한다.
      const unattended = e.attended === false;
      // C017 — 지금 고른 존재는 역할이 정한 색 대신 지목의 색으로 그린다.
      // 자리 비움의 탈색만은 이기지 않는다 — 그것은 존재의 상태이고 지목은 내 선택이다.
      const chosen = e.id === snapshot.currentTarget?.entityId;
      const tint = unattended
        ? (p.unattendedTint ?? p.tint)
        : chosen
          ? TARGET_TINT
          : p.tint;
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
    // 바닥 프롬프트는 **첫 번째** 키 지시 interaction 을 고른다 (가용한 것 우선).
    // 그래서 순서가 곧 "지금 눈앞에 무엇이 뜨는가" 이며, 그 순서를 정하는 것은 화면의
    // 일이다 — 세계가 보낸 순서에는 그런 뜻이 없다. 거의 언제나 가용한 `지목 해제`가
    // 앞에 있어 프롬프트가 그것으로 고정되어 있던 것을 이 정렬이 푼다.
    // 같은 순위끼리는 세계가 보낸 순서를 지킨다 (안정 정렬).
    interactions: [...snapshot.interactions]
      .sort((a, b) => interactionPriority(a.role) - interactionPriority(b.role))
      .map((i) => {
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
    // C022 — 소지품으로 지금 무엇이 되는가도 이 패널로 내려온다. 가로 띠는 한눈에
    // 읽는 자리이고, 사유는 읽어야 아는 문장이라 세로로 자라는 자리가 맞다.
    // 조립이 둘을 잇는다 — 소지품 표현이 전투 표현을 알 필요가 없다.
    ...(self
      ? {
          self: {
            ...self,
            lines: [
              ...self.lines,
              // C-TERRAIN-001 — 땅이 가장 먼저다. 지금 무언가가 나에게서 빠져나가는
              // 중이라면 그것이 다른 무엇보다 급한 사실이며, 자리 밖에서는 줄이 아예
              // 없으므로(자리 밖 = 이 Cycle 이전의 세계) 기존 배치가 밀리지 않는다.
              ...groundDetailLines(snapshot),
              // C-TERRAIN-003 — 세계 씨앗. 진단 표면(C)이 켜졌을 때만 실린다 —
              // 플레이어 평시 표면은 이 값을 그리지 않는다 (04 debug.genesisSeed).
              ...groundGenesisLines(snapshot, options.debugObserve ?? false),
              ...targetDetailLines(snapshot, shortCodeText),
              // 병합 — 두 갈래가 각자 한 벌씩 더했다. 순서는 **결정이 급한 것부터**다.
              //   기술   지금 이 순간 고르는 것 (C025)
              //   장비   몸이 무엇으로 되어 있는가 — 소지품보다 먼저다. 걸기의 대상이
              //          소지품이므로 자리를 먼저 본 뒤 무엇을 걸지 고른다 (C025)
              //   소지품 가진 것 전부 (C020 · C022)
              ...skillDetailLines(
                snapshot,
                codeText,
                options.skillAnswers ?? NO_SKILL_ANSWERS,
                now,
              ),
              ...equipmentDetailLines(snapshot, codeText, shortCodeText),
              ...inventoryDetailLines(snapshot, codeText, shortCodeText),
              // C-GROWTH-001 — 자란 것은 **맨 뒤다.** 이 값은 국면이 아니라 이력이라
              // 지금 이 순간의 결정(기술·대상·자리)을 재촉하지 않는다. 급한 것부터
              // 세우는 이 목록의 순서에서 가장 급하지 않은 자리가 여기다.
              // 그리고 자기 영역 **끝에만** 더하므로 기존 줄이 한 칸도 밀리지 않는다
              // (guides/works.md 공유 지점 규칙 · LANES 충돌 칸).
              ...growthLines(snapshot, codeText),
              // 방금 쌓인 일들 — 세계가 같은 수명으로 지우므로 스스로 사라진다.
              // 자란 것 바로 아래에 서야 "무엇 때문에 저 숫자가 움직였는가" 가
              // 한눈에 이어진다.
              ...growthEventLines(snapshot, codeText),
            ],
          },
        }
      : {}),
    // 타격 숫자는 맞은 몸의 그림 크기에 맞춰 떠오른다 — 그 몸이 아직 세계에 있으면 그 크기를 쓴다
    // C010 — 속성 관찰이 켜져 있으면 그 숫자가 나온 경위도 함께 붙는다 (같은 토글이다)
    // C018 — 무산된 접촉이 같은 자리에 나란히 뜬다. 빗나간 휘두름은 아무것도 오지 않고,
    // 무산은 맞은 자리에 사유가 뜬다 — 둘을 같게 그리면 이 Cycle 의 절반이 사라진다.
    strikes: [
      ...snapshot.strikes.map((event) =>
        strikeMark(
          event,
          rolePresentation(snapshot.entities.find((e) => e.id === event.targetId)?.role ?? '').size,
          options.inspect ?? false,
        ),
      ),
      ...snapshot.contacts.map((contact) =>
        contactMark(
          contact,
          rolePresentation(snapshot.entities.find((e) => e.id === contact.targetId)?.role ?? '')
            .size,
        ),
      ),
      // C019 — 끊긴 기술이 끊긴 자리에 뜬다. 셋은 같은 그리기 능력을 쓰되 다른 문구다:
      // 타격은 숫자, 무산은 사유, 캔슬은 무엇이 사라졌는가. 이것이 없으면 화면에서
      // 캔슬은 "그냥 맞았다" 와 구분되지 않는다 (04 VIEW NOTE ②).
      ...snapshot.cancels.map((cancel) =>
        cancelMark(
          cancel,
          rolePresentation(snapshot.entities.find((e) => e.id === cancel.targetId)?.role ?? '')
            .size,
        ),
      ),
    ],
    // 이펙트 (F1) — 같은 사건을 숫자가 아니라 게놈으로도 드러낸다.
    // 무엇이 어떤 이펙트를 켜는지는 effect-presentation 이 소유한다.
    effects: effectMarks(snapshot, options.effectsSince ?? EMPTY_EFFECT_MEMORY, (entity) =>
      entity ? (entity.body?.height ?? rolePresentation(entity.role).size) : 0,
    ),
    worldTime: Number(snapshot.hud.find((h) => h.id === 'world.time')?.value ?? 0),
    // C017 — 고른 대상 자리. 세계가 보낸 hud 항목이 아니라 계약의 여러 자리를
    // 결정 Layer 가 모아 만든 줄들이다 (04 VIEW ASSEMBLY NOTE). 앞에 둔다 —
    // "지금 누구를 상대하는가" 는 소지품보다 먼저 읽혀야 한다.
    hud: [
      // V-020 — 두 걸음의 첫 걸음. **맨 앞이다**: 평소에는 아예 없고, 걸린 동안에만
      // 서므로 그 자리가 배경이 되지 않는다. 다음 숫자 키가 무엇을 뜻하는지 이 줄이 말한다
      ...armedHudItems(codeText),
      ...targetHudItems(snapshot, codeText),
      // C027 — 기술은 위쪽 띠를 **떠났다.** 같은 값이 화면 아래 슬롯 띠에 서므로
      // (slotBars) 여기 두면 한 화면에 같은 말이 두 번 있게 된다.
      // C025 가 세운 것(모양을 견준다 · 사유는 패널로)은 그대로 살아 자리만 옮겼다.
      // C023 — 걸린 것. 소지품보다 앞에 둔다 — 몸이 무엇으로 되어 있는지가 먼저다
      // C-COMBAT-001 — 고를 수 있는 배분 넷. 걸린 것보다 앞에 둔다 — 지금 힘이 어디에
      // 몰려 있는가는 무엇을 걸었는가보다 국면마다 자주 바뀌고, 자주 바뀌는 것이 위에
      // 있어야 눈이 먼저 닿는다
      ...allocationHudItems(snapshot),
      ...equipmentHudItems(snapshot, codeText),
      // C020 — 가진 것 전부. 세계가 준 순서에 칸 번호만 붙인다
      ...inventoryHudItems(snapshot, codeText),
      ...snapshot.hud.filter((h) => !isSelfHudId(h.id)).map((h) => {
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
    })],
  };
}
