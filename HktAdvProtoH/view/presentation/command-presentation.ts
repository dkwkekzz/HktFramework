// 명령 표면의 결정 Layer (C009) — 04 commandCatalog · observerCommands · commandSurface.
//
// 세계는 의미 코드만 보낸다 (Command.Id · Effect · Parameter.Id · Domain).
// 무슨 문구로 보이고 어떤 문장으로 쓰는지는 전부 여기서 정한다 — 세계는 문법을 모른다.
//
// 두 출처를 한 벌로 합친다.
//   world     세계가 밝힌 목록 (snapshot.commands) — 걸면 세계로 간다
//   observer  관찰자 쪽에서 끝나는 것 — 걸어도 세계는 알지 못한다
// 합쳐지는 것은 사람이 다루는 표면이고, 경계는 origin 으로 남는다.
//
// 새 명령이 세계에 생기면 이 파일을 고치지 않아도 목록·안내·기록이 그대로 돈다 —
// 문구가 등록되지 않은 코드는 코드 그대로 보인다 (표현 누락이 게임을 멈추지 않는다).

import type {
  CommandDomainView,
  CommandParameterView,
  CommandView,
  GameViewSnapshot,
} from '../../protocol/gameview';
import type {
  SceneCommandComposition,
  SceneCommandEntry,
  SceneCommandSlot,
} from '../scene/scene-state';
import { codeText } from './code-text';

// ── 관찰자 쪽 명령 (04 observerCommands.items) ───────────────────────
// 세계로 가지 않는다. 세계는 이런 것이 걸렸다는 사실조차 알지 못한다.
// viewpoint(C008) 와 같은 자리의, 같은 성격의 항목이다.

export type ObserverCommandId = 'collider-observe' | 'attribute-inspect';

interface ObserverCommandDefinition {
  id: ObserverCommandId;
  effect: string; // 의미 코드 — 문구는 code-text 가 정한다
}

export const OBSERVER_COMMANDS: readonly ObserverCommandDefinition[] = [
  { id: 'collider-observe', effect: 'collider-observe' },
  { id: 'attribute-inspect', effect: 'attribute-inspect' },
];

/** 관찰자 쪽 명령이 지금 켜져 있는가 */
export type ObserverCommandStates = Readonly<Record<ObserverCommandId, boolean>>;

// ── Domain → 사람이 읽는 안내 ────────────────────────────────────────

function domainOptions(domain: CommandDomainView | undefined): string[] {
  return domain?.options?.map((option) => option.name) ?? [];
}

function domainHint(domain: CommandDomainView | undefined, entityIds: readonly string[]): string {
  if (!domain) return '';
  switch (domain.kind) {
    case 'entity':
      return entityIds.length > 0 ? entityIds.join(' | ') : '존재의 이름';
    case 'choice':
      return domainOptions(domain).join(' | ');
    case 'number': {
      const min = domain.minimum ?? '-∞';
      const max = domain.maximum ?? '∞';
      return `${min} … ${max}`;
    }
    case 'from-previous-choice':
      return '앞에서 고른 것이 정하는 값';
    default:
      return '값';
  }
}

/**
 * 그 자리에 지금 놓을 수 있는 Domain — value 자리처럼 앞의 선택이 정하는 경우
 * 그 선택을 따라간다 (04 commandCatalog: thenDomain).
 */
function effectiveDomain(
  parameters: readonly CommandParameterView[],
  index: number,
  filled: readonly string[],
): CommandDomainView | undefined {
  const parameter = parameters[index];
  if (!parameter) return undefined;
  if (parameter.domain.kind !== 'from-previous-choice') return parameter.domain;

  // 앞 자리들 중 choice 였던 마지막 것의 선택을 찾는다.
  for (let before = index - 1; before >= 0; before -= 1) {
    const previous = parameters[before];
    if (previous?.domain.kind !== 'choice') continue;
    const chosen = filled[before];
    const option = previous.domain.options?.find((candidate) => candidate.name === chosen);
    return option?.thenDomain;
  }
  return undefined;
}

function slotOf(
  parameter: CommandParameterView,
  domain: CommandDomainView | undefined,
  entityIds: readonly string[],
): SceneCommandSlot {
  const options = domainOptions(domain);
  return {
    id: codeText(`param:${parameter.id}`),
    required: parameter.required,
    hint: domainHint(domain, entityIds),
    ...(options.length > 0 ? { options } : {}),
    ...(parameter.omittedMeaning
      ? { omittedMeaning: codeText(`omitted:${parameter.omittedMeaning}`) }
      : {}),
  };
}

function usageOf(command: CommandView): string {
  const slots = command.parameters.map((parameter) =>
    parameter.required ? `<${parameter.id}>` : `[${parameter.id}]`,
  );
  return [command.id, ...slots].join(' ');
}

// ── 목록 (04 commandSurface.browse) ──────────────────────────────────

export function commandEntries(
  snapshot: GameViewSnapshot | null,
  observerStates: ObserverCommandStates,
): SceneCommandEntry[] {
  const entityIds = snapshot?.entities.map((entity) => entity.id) ?? [];

  const world: SceneCommandEntry[] = (snapshot?.commands ?? []).map((command) => ({
    id: command.id,
    title: codeText(command.effect),
    origin: 'world' as const,
    available: command.available,
    ...(command.reason ? { unavailableText: codeText(command.reason) } : {}),
    usage: usageOf(command),
    slots: command.parameters.map((parameter, index) =>
      slotOf(parameter, effectiveDomain(command.parameters, index, []), entityIds),
    ),
  }));

  // 관찰자 쪽 명령은 언제나 걸 수 있다 — 세계의 허용과 무관하다.
  const observer: SceneCommandEntry[] = OBSERVER_COMMANDS.map((command) => ({
    id: command.id,
    title: codeText(command.effect),
    origin: 'observer' as const,
    available: true,
    usage: command.id,
    slots: [],
    stateText: observerStates[command.id] ? '켜짐' : '꺼짐',
  }));

  return [...world, ...observer];
}

// ── 쓰는 중 안내 (04 commandSurface.guide) ───────────────────────────

/** 명령 한 줄을 낱말로 가른다 — 끝의 공백은 "다음 자리를 쓰기 시작했다" 는 뜻이다 */
function tokenize(text: string): { words: string[]; typingNew: boolean } {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  return { words, typingNew: text.length > 0 && /\s$/.test(text) };
}

function fits(
  value: string,
  domain: CommandDomainView | undefined,
  entityIds: readonly string[],
): boolean {
  if (!domain) return false;
  switch (domain.kind) {
    case 'entity':
      return entityIds.includes(value);
    case 'choice':
      return domainOptions(domain).includes(value);
    case 'number':
      return Number.isFinite(Number(value));
    case 'text':
      return value.length > 0;
    default:
      return false;
  }
}

/** 범위 밖의 값을 걸기 전에 알아본다 — 세계도 같은 판정을 하지만 먼저 알려 준다 */
function outOfRange(value: string, domain: CommandDomainView | undefined): boolean {
  if (domain?.kind !== 'number') return false;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return true;
  if (domain.minimum !== undefined && numeric < domain.minimum) return true;
  if (domain.maximum !== undefined && numeric > domain.maximum) return true;
  return false;
}

/**
 * 낱말들을 명령의 자리에 순서대로 채운다.
 * 필수가 아닌 자리는 그 자리에 맞지 않는 낱말이 오면 건너뛴다 —
 * "set-attribute moveSpeed 20" 에서 대상 자리가 비는 방식이다.
 */
export interface CommandFill {
  filled: string[]; // 자리마다 채워진 낱말 (빈 자리는 '')
  leftover: string[]; // 어느 자리에도 들어가지 못한 낱말들
}

export function fillSlots(
  parameters: readonly CommandParameterView[],
  words: readonly string[],
  entityIds: readonly string[],
): CommandFill {
  const filled: string[] = parameters.map(() => '');
  let cursor = 0;

  for (let index = 0; index < parameters.length; index += 1) {
    const parameter = parameters[index]!;
    const word = words[cursor];
    if (word === undefined) break;

    const domain = effectiveDomain(parameters, index, filled);
    if (parameter.required || fits(word, domain, entityIds)) {
      filled[index] = word;
      cursor += 1;
    }
    // 필수가 아니고 맞지도 않으면 이 자리는 비운 채 지나간다.
  }

  return { filled, leftover: words.slice(cursor) };
}

export function composeCommand(
  text: string,
  entries: readonly SceneCommandEntry[],
  snapshot: GameViewSnapshot | null,
  observerStates: ObserverCommandStates,
): SceneCommandComposition {
  const entityIds = snapshot?.entities.map((entity) => entity.id) ?? [];
  const { words, typingNew } = tokenize(text);
  const typed = words[0] ?? '';

  // 아직 명령 이름을 쓰는 중 — 이름으로 후보를 좁힌다.
  if (words.length <= 1 && !typingNew) {
    const candidates = entries.filter((entry) => entry.id.startsWith(typed));
    const exact = entries.find((entry) => entry.id === typed);
    return {
      text,
      candidates,
      ...(exact?.slots[0] ? { nextSlot: exact.slots[0] } : {}),
      suggestions: candidates.map((entry) => entry.id),
      ...(typed.length > 0 && candidates.length === 0
        ? { problem: `그런 명령이 없다 — ${typed}` }
        : {}),
      // 자리를 받지 않는 명령(관찰 토글)은 이름만으로 걸 수 있다.
      submittable: exact !== undefined && exact.slots.length === 0,
    };
  }

  const entry = entries.find((candidate) => candidate.id === typed);
  if (!entry) {
    return {
      text,
      candidates: [],
      suggestions: [],
      problem: `그런 명령이 없다 — ${typed}`,
      submittable: false,
    };
  }

  // 관찰자 쪽 명령은 받는 것이 없다 — 이름 뒤의 낱말은 군더더기다.
  if (entry.origin === 'observer') {
    return {
      text,
      candidates: [entry],
      suggestions: [],
      ...(words.length > 1 ? { problem: `${entry.id} 은 아무것도 받지 않는다` } : {}),
      submittable: words.length === 1,
      ...(entry.stateText ? {} : {}),
    };
  }

  const command = snapshot?.commands.find((candidate) => candidate.id === entry.id);
  if (!command) {
    return { text, candidates: [entry], suggestions: [], submittable: false };
  }

  const rest = words.slice(1);
  const { filled, leftover } = fillSlots(command.parameters, rest, entityIds);

  // 어느 자리가 다음인가 — 아직 비어 있는 필수 자리, 또는 지금 쓰고 있는 자리.
  const activeIndex = typingNew
    ? filled.findIndex((value, index) => value === '' && command.parameters[index]!.required)
    : Math.max(
        0,
        filled.reduce((last, value, index) => (value === '' ? last : index), -1),
      );

  const nextIndex =
    activeIndex >= 0
      ? activeIndex
      : filled.findIndex((value, index) => value === '' && command.parameters[index]!.required);

  const nextParameter = nextIndex >= 0 ? command.parameters[nextIndex] : undefined;
  const nextDomain = nextParameter
    ? effectiveDomain(command.parameters, nextIndex, filled)
    : undefined;

  // 지금 쓰고 있는 낱말로 그 자리의 후보를 좁힌다.
  const typingWord = typingNew ? '' : (words[words.length - 1] ?? '');
  const pool =
    nextDomain?.kind === 'entity' ? entityIds : domainOptions(nextDomain);
  const suggestions = pool.filter((option) => option.startsWith(typingWord));

  // 무엇이 잘못되었는가 — 걸기 전에 알려 준다.
  // 자리에 든 값을 먼저 본다. 잘못 든 값이 뒤의 낱말을 밀어내므로,
  // 남은 낱말부터 말하면 진짜 원인이 아니라 그 여파를 말하게 된다.
  let problem: string | undefined;
  for (let index = 0; index < command.parameters.length; index += 1) {
    const value = filled[index]!;
    if (value === '') continue;
    const domain = effectiveDomain(command.parameters, index, filled);
    if (outOfRange(value, domain)) {
      problem = `허용된 범위를 벗어난 값이다 — ${value} (${domainHint(domain, entityIds)})`;
      break;
    }
    if (!fits(value, domain, entityIds)) {
      problem = `그 자리에 넣을 수 없다 — ${value} (${domainHint(domain, entityIds)})`;
      break;
    }
  }
  if (problem === undefined && leftover.length > 0) {
    problem = `받지 않는 것이 남았다 — ${leftover.join(' ')}`;
  }

  const missing = command.parameters.some(
    (parameter, index) => parameter.required && filled[index] === '',
  );

  return {
    text,
    candidates: [entry],
    ...(nextParameter
      ? { nextSlot: slotOf(nextParameter, nextDomain, entityIds) }
      : {}),
    suggestions,
    ...(problem ? { problem } : {}),
    submittable: !missing && problem === undefined,
  };
}

// ── 걸기 (04 interactions.setAttribute.composedFrom) ─────────────────

/** 한 줄을 걸었을 때 무엇이 되는가 */
export type CommandInvocation =
  | { kind: 'world'; commandId: string; values: Record<string, string> }
  | { kind: 'observer'; commandId: ObserverCommandId }
  | { kind: 'rejected'; problem: string };

export function invocationOf(
  text: string,
  entries: readonly SceneCommandEntry[],
  snapshot: GameViewSnapshot | null,
  observerStates: ObserverCommandStates,
): CommandInvocation {
  const composition = composeCommand(text, entries, snapshot, observerStates);
  if (!composition.submittable) {
    return {
      kind: 'rejected',
      problem: composition.problem ?? '아직 다 적지 않았다',
    };
  }

  const { words } = tokenize(text);
  const id = words[0]!;
  const entry = entries.find((candidate) => candidate.id === id)!;

  if (entry.origin === 'observer') {
    return { kind: 'observer', commandId: id as ObserverCommandId };
  }

  const command = snapshot!.commands.find((candidate) => candidate.id === id)!;
  const entityIds = snapshot!.entities.map((entity) => entity.id);
  const { filled } = fillSlots(command.parameters, words.slice(1), entityIds);

  const values: Record<string, string> = {};
  command.parameters.forEach((parameter, index) => {
    const value = filled[index]!;
    if (value !== '') values[parameter.id] = value;
  });

  return { kind: 'world', commandId: id, values };
}
