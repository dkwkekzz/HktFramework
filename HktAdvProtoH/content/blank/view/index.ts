// blank 팩의 View 결정 Layer — active-view 계약 5종의 최소 구현.
//
// 그림 표가 없다: 모든 존재가 엔진 placeholder 로 그려진다.
// 문구 표가 없다: 의미 코드가 코드 그대로 보인다. 그래도 게임은 멈추지 않는다 —
// 그것이 엔진의 "그대로 그린다" 성질이고, 이 팩은 그 성질만으로 서 있다 (P5).

import type { ActionRequest } from '../../../engine/protocol-core/actions';
import type { GameViewSnapshot } from '../../../engine/protocol-core/gameview';
import type { KeyBinding } from '../../../engine/view-kernel/input/bindings';
import type { SpriteSheet } from '../../../engine/view-kernel/assets/registry';
import {
  commandEntries,
  composeCommand,
} from '../../../engine/view-kernel/presentation/command-presentation';
import type {
  SceneCommandHistoryLine,
  SceneState,
} from '../../../engine/view-kernel/scene/scene-state';

export const codeText = (code: string): string => code;

export const KEY_BINDINGS: readonly KeyBinding[] = [];

export const SPRITE_SHEET: SpriteSheet = { palette: {}, maps: {} };

export function commandActionRequest(
  commandId: string,
  _values: Record<string, string>,
): ActionRequest | null {
  // 이 세계에는 명령이 없다 — 이름만 실어 보내면 세계가 거절로 대답한다.
  return { interactionId: commandId };
}

export interface PresentationOptions {
  debugObserve?: boolean;
  inspect?: boolean;
  viewTurn?: number;
  facingSides?: Readonly<Record<string, 'left' | 'right'>>;
  command?: { open: boolean; text: string; history: readonly SceneCommandHistoryLine[] };
}

const WALKER_SIZE = 2.4;
const OBSERVER_STATES = { 'collider-observe': false, 'attribute-inspect': false } as const;

export function resolvePresentation(
  snapshot: GameViewSnapshot,
  _motions?: unknown,
  options: PresentationOptions = {},
): SceneState {
  const entries = commandEntries(snapshot, OBSERVER_STATES);
  return {
    specId: snapshot.specId,
    terrain: snapshot.scene,
    // 겹침 표면 — 이 팩은 아무것도 열지 않는다. 능력이 있는 것과 쓰는 것은 다르다
    surfaces: [],
    slotBars: [],
    entities: snapshot.entities.map((entity) => ({
      id: entity.id,
      spriteId: `${entity.role}:${entity.state}`, // 미등록 — placeholder 로 그려진다
      size: WALKER_SIZE,
      position: entity.position,
      ...(entity.name === undefined ? {} : { label: entity.name }),
      cameraFollow: entity.role === 'player-character',
      trail: false,
    })),
    interactions: snapshot.interactions.map((interaction) => ({
      id: interaction.id,
      available: interaction.available,
      ...(interaction.role === 'move-to' ? { terrainTarget: true } : {}),
      ...(interaction.reason ? { unavailableText: codeText(interaction.reason) } : {}),
    })),
    hud: snapshot.hud.map((item) => ({
      id: item.id,
      widget: item.kind,
      label: item.id,
      value: item.value,
    })),
    strikes: [],
    effects: [], // 빈 팩에는 이펙트를 켜는 사건이 없다
    worldTime: Number(snapshot.hud.find((h) => h.id === 'world.time')?.value ?? 0),
    commandSurface: {
      open: options.command?.open ?? false,
      entries,
      composition: composeCommand(
        options.command?.text ?? '',
        entries,
        snapshot,
        OBSERVER_STATES,
      ),
      history: [...(options.command?.history ?? [])],
    },
  };
}
