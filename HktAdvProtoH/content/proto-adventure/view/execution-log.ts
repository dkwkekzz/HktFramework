// 방금 무슨 일이 있었는지 되짚는 자리 (V-018 · VUX-SK-D1 §2.2 · §7 · §12).
//
// 세계가 보내는 타격·무산·끊김은 **잠시 드러났다 사라진다** (StrikeEventView 의 수명).
// 싸우는 중에는 그것을 다 읽을 수 없다 — 숫자가 뜨고 사라지는 사이에 다음 일이 일어난다.
// 이 자리는 그 셋을 **본 그대로 쌓아 두고** 시간순으로 다시 보여 준다.
//
// ── 이 파일이 하는 것과 하지 않는 것 ─────────────────────────────
//
//   한다      본 것을 기억한다. 같은 사건을 두 번 세지 않는다. 시간순으로 세운다.
//             고른 줄의 **피해 산정 경위**를 상세 구획에 편다
//   하지 않는다  판정·산정·사유를 스스로 만들지 않는다. 경위 한 줄은 타격 표시가 쓰는
//             그 함수(`breakdownLine`)를 그대로 부른다 — 두 자리가 다른 말을 하면
//             어느 쪽이 참인지 겪는 사람이 알 수 없다 (DC-WORLD-OWNS-THE-SURFACE-LIST)
//
// **실행 묶음 Tree 는 여기 없다.** "이 타격들이 한 번의 실행이다" 를 말할 값이 계약에
// 없다 (`executionId` — V-001 REPORT ⑤). 그래서 이 자리는 사건 **하나하나**의 줄이다.

import type { SceneSurface, SceneSurfaceRow } from '../../../engine/view-kernel/scene/scene-state';
import type {
  CancelEventView,
  EntityView,
  GameViewSnapshot,
  StrikeEventView,
  UnharmedContactView,
} from '../protocol/gameview';
import { breakdownLine } from './combat-presentation';
import { codeText } from './code-text';
import { keyLabel } from './key-registry';
import { surfaceIsOpen } from './surface-state';

export const EXECUTION_LOG_SURFACE_ID = 'execution-log';

/**
 * 얼마나 쌓아 둘 것인가.
 *
 * 되짚는 자리이지 장부가 아니다 — 오래된 것을 지우지 않으면 목록이 무한히 길어지고,
 * 그때 "방금 무슨 일이 있었는가" 는 그 안에 묻힌다.
 */
const LIMIT = 40;

type LogKind = 'strike' | 'contact' | 'cancel';

interface LogEntry {
  readonly id: string;
  readonly kind: LogKind;
  /** 일어난 세계 시각 — 세계가 준 값이다 */
  readonly since: number;
  readonly attackerId: string;
  readonly targetId: string;
  readonly skill: string;
  readonly amount?: number;
  readonly reason?: string;
  readonly strike?: StrikeEventView;
}

// 새것이 앞이다 — 되짚는 사람이 먼저 찾는 것은 방금 일어난 일이다
let entries: LogEntry[] = [];
let selectedId: string | null = null;

/**
 * 한 사건을 가리키는 열쇠.
 *
 * 세계는 같은 사건을 **여러 프레임에 걸쳐 다시 보낸다** (수명이 다할 때까지). 그래서
 * 무엇으로 같음을 셀지가 이 자리의 전부다 — 누가·누구를·무엇으로·언제가 같으면 같은
 * 사건이다. 세계 시각(`since`)이 그 열쇠의 중심이며 화면이 만들어내는 값이 아니다.
 */
function keyOf(kind: LogKind, e: { attackerId: string; targetId: string; skill: string; since: number }): string {
  return `${kind}:${e.attackerId}>${e.targetId}:${e.skill}@${e.since}`;
}

/**
 * 하나를 기억한다 — **세계가 준 시각으로 세운다.**
 *
 * 넣은 차례로 세우지 않는 이유가 있다: 한 번의 관찰에 사건이 여럿 실려 올 수 있고,
 * 그 목록의 차례는 시간순이라고 계약이 말한 적이 없다. 넣은 차례로 두면 같은 프레임에
 * 온 둘이 뒤집혀 서고, 그때 "시간순으로 선다" 는 우연히 참인 문장이 된다.
 */
function push(entry: LogEntry): void {
  if (entries.some((seen) => seen.id === entry.id)) return;
  entries = [entry, ...entries].sort((a, b) => b.since - a.since).slice(0, LIMIT);
}

/**
 * 이번 관찰에 실려 온 사건들을 기억한다 — **매 프레임 부른다.**
 *
 * 기억하는 것은 세계가 보낸 값 그대로다. 이 자리가 값을 고치거나 채워 넣으면 되짚기가
 * 아니라 지어내기가 된다.
 */
export function rememberExecutions(snapshot: GameViewSnapshot): void {
  for (const s of snapshot.strikes) {
    push({
      id: keyOf('strike', s),
      kind: 'strike',
      since: s.since,
      attackerId: s.attackerId,
      targetId: s.targetId,
      skill: s.skill,
      amount: s.amount,
      strike: s,
    });
  }
  for (const c of snapshot.contacts) push(contactEntry(c));
  for (const c of snapshot.cancels) push(cancelEntry(c));
}

function contactEntry(c: UnharmedContactView): LogEntry {
  return {
    id: keyOf('contact', c),
    kind: 'contact',
    since: c.since,
    attackerId: c.attackerId,
    targetId: c.targetId,
    skill: c.skill,
    reason: c.reason,
  };
}

function cancelEntry(c: CancelEventView): LogEntry {
  return {
    id: keyOf('cancel', c),
    kind: 'cancel',
    since: c.since,
    attackerId: c.attackerId,
    targetId: c.targetId,
    skill: c.skill,
  };
}

/**
 * 쌓인 것을 모두 잊는다 — **검증용**이다.
 *
 * 게임 안에는 이것을 부르는 자리가 없다. 되짚는 자리를 비우는 손짓은 아직 요구가 없고,
 * 요구가 없는 손짓을 화면에 두면 겪는 사람은 그것이 무엇을 지우는지 알 수 없다.
 */
export function forgetExecutions(): void {
  entries = [];
  selectedId = null;
}

/** 검증용 — 지금까지 쌓인 수 */
export function loggedCount(): number {
  return entries.length;
}

/** 줄 하나가 눌렸다 — 고른 것이 된다. 세계로 아무것도 나가지 않는다 */
export function pickLogEntry(rowId: string): void {
  if (entries.some((e) => e.id === rowId)) selectedId = rowId;
}

/**
 * 줄 사이에서 고르기를 옮긴다.
 *
 * 목록이 비었으면 아무 일도 없다. 아직 고른 것이 없으면 **맨 위**(가장 최근)에서
 * 시작한다 — 되짚는 사람이 먼저 보려는 것이 그것이다.
 */
export function moveLogSelection(delta: number): void {
  if (entries.length === 0) return;
  const at = selectedId === null ? -1 : entries.findIndex((e) => e.id === selectedId);
  if (at < 0) {
    selectedId = entries[0]!.id;
    return;
  }
  const next = Math.min(entries.length - 1, Math.max(0, at + delta));
  selectedId = entries[next]!.id;
}

function nameOf(snapshot: GameViewSnapshot, id: string): string {
  const entity: EntityView | undefined = snapshot.entities.find((e) => e.id === id);
  return entity?.name ?? id;
}

/** 몇 초 전인가 — 세계 시각으로 잰다 (화면의 시계가 아니다) */
function ago(worldTime: number, since: number): string {
  const seconds = Math.max(0, worldTime - since);
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s 전`;
}

/**
 * 세계 시각 — 관찰이 실어 온 값이다 (`hud` 의 `world.time`). 화면의 시계가 아니다:
 * 사건의 나이는 세계가 잰 것이어야 하고, 그 자리는 이미 결정 Layer 가 읽고 있다
 * (resolve.ts 의 `worldTime`).
 */
function worldTimeOf(snapshot: GameViewSnapshot): number {
  return Number(snapshot.hud.find((h) => h.id === 'world.time')?.value ?? 0);
}

function rowOf(snapshot: GameViewSnapshot, entry: LogEntry): SceneSurfaceRow {
  const skill = codeText(entry.skill);
  const target = nameOf(snapshot, entry.targetId);
  const mine = entry.attackerId === snapshot.observer?.characterId;
  // 누가 친 것인지가 먼저다 — 내가 낸 일과 내게 일어난 일은 되짚는 뜻이 다르다
  const who = mine ? '내가' : `${nameOf(snapshot, entry.attackerId)} 가`;
  const what =
    entry.kind === 'strike'
      ? `${skill} → ${target} · ${codeText('struck')} ${Math.round(entry.amount ?? 0)}`
      : entry.kind === 'contact'
        ? `${skill} → ${target} · ${codeText('unharmed')} (${codeText(entry.reason ?? '')})`
        : `${skill} → ${target} · ${codeText('cancelled')}`;
  return {
    id: entry.id,
    text: `${who} ${what}`,
    hint: ago(worldTimeOf(snapshot), entry.since),
  };
}

/**
 * 고른 줄의 경위 — **타격에만 있다.**
 *
 * 무산과 끊김에는 산정 자체가 없다 (계약이 그렇게 갈라 두었다). 그때 빈 줄을 내는
 * 대신 **왜 없는지**를 적는다 — 없는 것과 못 읽은 것은 다른 일이다.
 */
function detailRows(entry: LogEntry | undefined): SceneSurfaceRow[] {
  if (!entry) return [];
  if (entry.kind === 'strike' && entry.strike) {
    return [{ id: `${entry.id}:breakdown`, text: breakdownLine(entry.strike) }];
  }
  const why =
    entry.kind === 'contact'
      ? `${codeText('unharmed')} — ${codeText(entry.reason ?? '')} · 산정이 없다`
      : `${codeText('cancelled')} — 없던 일이 되었다 · 산정이 없다`;
  return [{ id: `${entry.id}:why`, text: why }];
}

/**
 * 되짚는 표면 하나 — 열려 있지 않아도 실린다 (열림은 표면 자신이 지닌 값이다).
 */
export function executionLogSurface(snapshot: GameViewSnapshot): SceneSurface {
  const open = surfaceIsOpen(EXECUTION_LOG_SURFACE_ID);
  // 고른 것이 목록 밖으로 밀려났으면(오래되어 지워졌으면) 고르기도 함께 놓는다
  if (selectedId !== null && !entries.some((e) => e.id === selectedId)) selectedId = null;
  const chosen = entries.find((e) => e.id === selectedId);
  return {
    id: EXECUTION_LOG_SURFACE_ID,
    open,
    title: `방금 있었던 일 — ${entries.length}`,
    ...(selectedId === null ? {} : { focusId: selectedId }),
    sections: [
      {
        id: 'log',
        title: '시간순 (새것이 위)',
        rows: entries.map((entry) => rowOf(snapshot, entry)),
        // 아무 일도 없었던 것과 안 그린 것은 다르다
        emptyText: '아직 쌓인 일이 없다',
      },
      {
        id: 'why',
        title: '고른 줄의 경위',
        rows: detailRows(chosen),
        emptyText: `${keyLabel('actionUp')} ${keyLabel('actionDown')} 로 고른다`,
      },
    ],
    footer: [
      `닫기 ${keyLabel('close')}`,
      `고르기 ${keyLabel('actionUp')} ${keyLabel('actionDown')}`,
    ],
  };
}
