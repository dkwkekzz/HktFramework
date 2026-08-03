// R2-a 흔적의 통로 — 세계의 어느 자리가 움직이면 어느 통로로 새는가.
//
// O1 은 통로 6종을 열어 두었고(빛·소리·흔적·냄새·의념 잔향·보고서), O0 은 흔적을 요구했다
// ("흔적 없는 능력은 세계에 설 수 없다 — 아무도 그것이 일어났음을 알 수 없기 때문이다").
// 그런데 **무엇이 어느 통로로 새는지**는 아무도 적지 않았다. 그 자리가 여기다.
//
// 통로를 사건(원자)이 아니라 **자리**에 건다. 이유는 하나다: 같은 원자라도 무엇을 움직였는지에
// 따라 남는 것이 다르고, 다른 원자라도 같은 자리를 움직였으면 같은 것이 남는다. 재고가 줄어든
// 흔적만으로는 사갔는지 빼앗겼는지 알 수 없다 — 그것이 관찰의 뜻이다. 이 성질이 그대로
// **애매함**(R2-b `ambiguity`)이 되고, R3 의 선택 감지와 R4 의 오인이 설 자리를 만든다.
//
// P0-b 와 같은 태도로 검사한다.
//
//   ① 원자가 움직일 수 있는 자리(`writes ∪ pays`)는 **전부** 통로를 대야 한다 (`unchanneled-slot`)
//   ② 통로를 적은 자리는 O2 스키마에 실재해야 한다 (`phantom-channel`)
//   ③ **새지 않는 자리는 예외로 선언되어야 한다** — 선언 없이 비면 거부한다 (`undeclared-silence`)
//   ④ 선언해 놓고 실제로 통로를 가지면 예외가 낡은 것이다 (`stale-silence`)
//   ⑤ O1 이 연 통로 6종은 **전부 쓰여야 한다** — 아무 자리도 그리로 새지 않는 통로는 통로가 아니다
//
// 새지 않는 자리 일곱이 실제로 있고, 둘 다 근거가 있다: **앎은 새지 않고**(머릿속은 밖에서 읽히지
// 않는다 — 읽히면 R3 의 선택 감지도 R4 의 거짓 믿음도 통째로 무의미해진다), **몸 안에 머무는 값도
// 새지 않는다**(원문 §6.1 이 "상대 HP 12%" 를 그대로 읽지 못하게 한 자리다 — 겉으로 드러나는 것은
// 상처와 지침이지 허기와 대사가 아니다).

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { PHENOMENON_CHANNELS, type PhenomenonChannel } from '../o1/operation.ts';
import type { StateDomain } from '../o2/domain.ts';
import { matchPath } from '../o2/field.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import {
  ATOM_GROUNDINGS,
  slotText,
  type ActionAtom,
  type AtomGrounding,
  type SlotRef,
} from '../p0/index.ts';
import { violatePhenomenon, type PhenomenonViolation } from './violation.ts';

export { PHENOMENON_CHANNELS, type PhenomenonChannel };

/** 자리 하나가 어느 통로로 새는가. */
export interface LeakChannel {
  readonly slot: SlotRef;
  /** 이 자리가 움직이면 나는 현상의 통로들. 비면 선언이 아니라 실수다 — 새지 않는 자리는 SEALED_SLOTS 로 */
  readonly channels: readonly PhenomenonChannel[];
  /** 왜 그 통로인가 — 근거 없는 통로는 통로가 아니다 (P0-b `note` 와 같은 자리) */
  readonly note: string;
}

/** 새지 않는 자리 — 선언된 예외. */
export interface SealedSlot {
  readonly slot: SlotRef;
  readonly reason: string;
  /** 그러면 그 자리의 변화는 어떻게 알려지는가 — "아무도 모른다" 도 답이다 */
  readonly knownBy: string;
}

const slot = (domain: StateDomain, path: string): SlotRef => ({ domain, path });

/**
 * 자리 → 통로. 순서는 O2 영역 순서(물리·생물·생태·관계·제도·경제·정보·의념·초월)를 따른다.
 *
 * 한 자리가 여러 통로로 샐 수 있다 — 부서지는 것은 소리가 나고 부서진 채로 남는다.
 * 그래서 사건 하나가 현상 여럿을 남기고, 어느 통로를 가진 자만 그중 일부를 감지한다 (R3).
 */
export const LEAK_CHANNELS: readonly LeakChannel[] = [
  {
    slot: slot('physical', 'region'),
    channels: ['light'],
    note: '자리를 옮기는 것은 보인다 — 움직임은 눈에 드는 가장 흔한 변화다',
  },
  {
    slot: slot('physical', 'temperature'),
    channels: ['trace'],
    note: '온기는 그 자리에 남는다 — 식지 않은 화덕은 누가 여기 있었다고 말한다',
  },
  {
    slot: slot('physical', 'cover'),
    channels: ['light'],
    note: '무언가 세워지거나 치워지는 것은 보인다. 가려진 뒤에 무엇이 있는지는 가려지지만, 가리는 행위 자체는 가려지지 않는다',
  },
  {
    slot: slot('physical', 'broken'),
    channels: ['sound', 'trace'],
    note: '부서질 때 소리가 나고 부서진 것은 남는다 — 열여섯 중 제거 하나만 이 자리를 움직이므로 가장 덜 애매한 흔적이다',
  },
  {
    slot: slot('biological', 'vitality'),
    channels: ['smell', 'trace'],
    note: '몸이 깎이면 피 냄새가 나고 자국이 남는다. 열여섯 중 열둘이 이 자리를 치르므로 **가장 흔하고 가장 애매한 흔적**이다 — 누군가 무언가 했다는 것만 말한다',
  },
  {
    slot: slot('biological', 'mutation.{rule}'),
    channels: ['light', 'psychic'],
    note: '변이가 발현되면 몸에 드러나고 의념 잔향을 남긴다 — O0 observable-trace 가 능력에 요구한 그 흔적이다',
  },
  {
    slot: slot('biological', 'growthStage'),
    channels: ['light', 'trace'],
    note: '탈피는 보이고 벗은 껍질이 남는다',
  },
  {
    slot: slot('ecological', 'population'),
    channels: ['trace'],
    note: '개체군이 줄면 사체와 빈 둥지가 남는다 — 생태의 변화는 현장에서만 읽힌다',
  },
  {
    slot: slot('relational', 'trust.{subject}'),
    channels: ['report'],
    note: '사이가 달라진 것은 남을 거쳐 온다 — 두 사람 사이의 일은 본 사람이 말해야 알려진다',
  },
  {
    slot: slot('relational', 'fear.{subject}'),
    channels: ['light', 'report'],
    note: '두려움은 몸이 먼저 말한다 — 원문 §6.1 의 "뒤로 물러난다" 가 이 자리다. 그러고 나서 소문이 된다',
  },
  {
    slot: slot('relational', 'grudge.{subject}'),
    channels: ['report'],
    note: '원한은 겉으로 드러나지 않고 이야기로 퍼진다',
  },
  {
    slot: slot('relational', 'reliance.{subject}'),
    channels: ['report'],
    note: '누가 누구에게 기대는지는 지켜본 사람이 말한다',
  },
  {
    slot: slot('relational', 'belongsTo.{subject}'),
    channels: ['report'],
    note: '소속이 바뀌는 것은 공표된다 — 아무도 모르는 소속은 소속이 아니다',
  },
  {
    slot: slot('relational', 'debt.{subject}'),
    channels: ['report'],
    note: '빚은 장부에 적히고 장부는 사람을 거쳐 읽힌다',
  },
  {
    slot: slot('institutional', 'law.{rule}'),
    channels: ['report'],
    note: '법은 말로 퍼진다 — 알려지지 않은 법은 아무도 지키지 않는다',
  },
  {
    slot: slot('institutional', 'license.{rule}'),
    channels: ['report'],
    note: '자격은 남이 인정해 주어야 자격이다',
  },
  {
    slot: slot('institutional', 'passage.{entity}'),
    channels: ['report'],
    note: '통행권이 열리고 닫히는 것은 전언으로 온다',
  },
  {
    slot: slot('institutional', 'bounty'),
    channels: ['report'],
    note: '현상금은 붙여 알리는 것이 목적이다',
  },
  {
    slot: slot('institutional', 'contraband.{entity}'),
    channels: ['report'],
    note: '무엇이 금지되었는지는 포고로 온다',
  },
  {
    slot: slot('institutional', 'diplomacy.{subject}'),
    channels: ['report'],
    note: '외교는 공표로 성립한다 — 아무도 모르는 동맹은 동맹의 값을 갖지 못한다',
  },
  {
    slot: slot('economic', 'stock.{entity}'),
    channels: ['light'],
    note: '쌓인 것과 빈 자리는 보인다. 다만 **줄었다는 것만 보이고 누가 가져갔는지는 보이지 않는다** — 여섯 원자가 이 자리를 움직인다',
  },
  {
    slot: slot('economic', 'flow.{entity}'),
    channels: ['report'],
    note: '유통량은 한 자리에서 보이지 않는다 — 여러 곳의 말이 모여야 읽힌다',
  },
  {
    slot: slot('economic', 'price.{entity}'),
    channels: ['report'],
    note: '값은 부르는 것이고 부르는 것은 들린다',
  },
  {
    slot: slot('economic', 'demand.{entity}'),
    channels: ['report'],
    note: '무엇을 원하는지는 찾아다니는 말로 드러난다',
  },
  {
    slot: slot('informational', 'rumorSpread.{claim}'),
    channels: ['report'],
    note: '앎 자체는 새지 않지만 **퍼지는 중인 말은 들린다** — 정보 영역에서 유일하게 밖으로 나오는 자리이고, R4 소문이 여기에 선다',
  },
  {
    slot: slot('psychic', 'energy'),
    channels: ['psychic'],
    note: '의념이 닳는 것은 의념으로 느껴진다 — 의념을 읽는 눈이 있어야 읽힌다 (R3)',
  },
  {
    slot: slot('psychic', 'activeEffect.{rule}'),
    channels: ['psychic', 'light'],
    note: '능력이 서 있으면 잔향이 남고 대개 눈에도 든다 — O0 observable-trace 가 "흔적 없는 능력은 설 수 없다" 고 못박은 자리다',
  },
  {
    slot: slot('psychic', 'conditionMet.{rule}'),
    channels: ['psychic'],
    note: '서약의 조건이 채워지는 순간은 의념으로만 감지된다',
  },
  {
    slot: slot('psychic', 'trace.{rule}'),
    channels: ['psychic', 'trace'],
    note: '능력이 남긴 흔적은 그 자체가 현상이다 — 의념으로도 현장으로도 읽힌다',
  },
  {
    slot: slot('psychic', 'interference.{entity}'),
    channels: ['psychic'],
    note: '영역이 서로 간섭하는 것은 그 안에 선 자만 느낀다',
  },
  {
    slot: slot('psychic', 'conviction'),
    channels: ['psychic'],
    note: '신념의 압력은 말보다 먼저 전해진다',
  },
  {
    slot: slot('transcendent', 'legitimacy'),
    channels: ['report'],
    note: '정당성은 남이 인정하는 것이다 — 스스로 정당한 자는 없다',
  },
  {
    slot: slot('transcendent', 'worship'),
    channels: ['report', 'psychic'],
    note: '숭배는 모여서 하는 일이라 보이고 들리며, 신에게는 의념으로 닿는다',
  },
  {
    slot: slot('transcendent', 'anchor'),
    channels: ['psychic'],
    note: '앵커가 서고 무너지는 것은 의념의 자리에서 일어난다',
  },
  {
    slot: slot('transcendent', 'divineDomain.{entity}'),
    channels: ['psychic', 'light'],
    note: '신역은 그 안에 들어선 자에게 드러난다',
  },
];

/**
 * 새지 않는 자리 — 선언된 예외.
 *
 * 두 가족뿐이다. **머릿속**(정보 영역)과 **몸 안**(허기·대사). 둘 다 원문이 이미 못박은 자리다:
 * 상대의 실제 상태를 그대로 읽게 하면 안 된다(§6.1). 여기서 하나라도 새게 하면 R3 의 선택 감지와
 * R4 의 거짓 믿음이 통째로 무의미해진다 — 남의 앎을 직접 읽을 수 있으면 오해할 것이 없다.
 */
export const SEALED_SLOTS: readonly SealedSlot[] = [
  {
    slot: slot('informational', 'knows.{claim}'),
    reason:
      '누가 무엇을 아는지는 밖에서 보이지 않는다 — 원문 §6.1 이 "상대의 목적·능력을 그대로 알 수 없다" 고 못박은 자리다',
    knownBy: '말해 주거나(설득 — 관계 자리가 대신 샌다) 행동으로 드러날 때까지 아무도 모른다',
  },
  {
    slot: slot('informational', 'certainty.{claim}'),
    reason: '얼마나 확신하는지는 본인만 안다 — 확신은 몸에도 세계에도 자국을 남기지 않는다',
    knownBy: '그 확신으로 낸 행동이 남기는 다른 흔적으로만 짐작된다',
  },
  {
    slot: slot('informational', 'sourceOf.{claim}'),
    reason: '어디서 들었는지는 머릿속의 연결이다 — 출처가 새면 정보전이 성립하지 않는다',
    knownBy: 'R4 가 소문의 경로를 세울 때 그 연결을 다시 만든다',
  },
  {
    slot: slot('informational', 'falsehood.{claim}'),
    reason:
      '무엇을 거짓으로 표시했는지가 새면 속임수가 성립하지 않는다 — 조사(investigate)만이 이 자리를 세울 수 있고, 그 조사조차 남에게는 보이지 않는다',
    knownBy: '아무도 모른다 — 이것이 오인이 유지되는 이유다 (R4)',
  },
  {
    slot: slot('informational', 'secret.{claim}'),
    reason: '비밀이 새면 비밀이 아니다 — 정의상 새지 않는 자리다',
    knownBy: '들킴은 별도의 사건이다 (E 계층 발각) — 자리가 저절로 새는 것이 아니다',
  },
  {
    slot: slot('biological', 'hunger'),
    reason:
      '배고픔은 겉으로 드러나지 않는다 — D4 압력이 아무리 올라도 남은 그것을 읽지 못한다. 원문 §6.1 이 실제 상태를 직접 읽지 못하게 한 그 자리다',
    knownBy: '굶주린 자가 무엇을 하는가로만 짐작된다 — 그래서 굶주림은 행동으로 번역돼야 알려진다',
  },
  {
    slot: slot('biological', 'metabolism'),
    reason: '대사가 달라지는 것은 몸 안에서 천천히 일어나 밖에서 보이지 않는다',
    knownBy: '적응의 결과(변이 발현·행동 변화)가 대신 샌다',
  },
];

const slotKey = (ref: SlotRef): string => slotText(ref);

/** 그 자리가 O2 스키마에 실재하는가 — 패턴 그대로 선언됐어야 한다. */
function slotExists(schema: StateSchema, ref: SlotRef): boolean {
  return schema.fields.some((field) => field.domain === ref.domain && field.path === ref.path);
}

/** 열여섯 원자가 움직일 수 있는 자리 전부 (`writes ∪ pays`). */
export function movableSlots(
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): readonly SlotRef[] {
  const seen = new Map<string, SlotRef>();
  for (const grounding of groundings) {
    for (const ref of [...grounding.writes, ...grounding.pays]) {
      if (!seen.has(slotKey(ref))) seen.set(slotKey(ref), ref);
    }
  }
  return stableSort([...seen.values()], (left, right) =>
    compareStrings(slotKey(left), slotKey(right)),
  );
}

/**
 * 그 자리를 움직일 수 있는 원자들.
 *
 * 흔적의 애매함이 여기서 나온다 — 재고가 줄어든 자국을 남길 수 있는 원자가 여섯이면, 그 자국을
 * 본 자는 여섯 중 무엇이 일어났는지 모른다. R2-b `ambiguity` 가 이것을 값으로 접는다.
 */
export function atomsMoving(
  ref: SlotRef,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): readonly ActionAtom[] {
  return groundings
    .filter((grounding) =>
      [...grounding.writes, ...grounding.pays].some((entry) => slotKey(entry) === slotKey(ref)),
    )
    .map((grounding) => grounding.atom);
}

/** 그 자리의 통로 선언을 찾는다 — 실제 경로(`stock.entity:ab12`)도 패턴에 걸어 준다. */
export function leakOf(
  domain: StateDomain,
  path: string,
  channels: readonly LeakChannel[] = LEAK_CHANNELS,
): LeakChannel | null {
  return (
    channels.find(
      (entry) =>
        entry.slot.domain === domain &&
        (entry.slot.path === path || matchPath(entry.slot.path, path) !== null),
    ) ?? null
  );
}

/** 그 자리가 새지 않는다고 선언됐는가. */
export function sealedOf(
  domain: StateDomain,
  path: string,
  sealed: readonly SealedSlot[] = SEALED_SLOTS,
): SealedSlot | null {
  return (
    sealed.find(
      (entry) =>
        entry.slot.domain === domain &&
        (entry.slot.path === path || matchPath(entry.slot.path, path) !== null),
    ) ?? null
  );
}

/** 통로 검사 결과 — 세계의 표면이 온전한가. */
export interface LeakReport {
  /** 원자가 움직일 수 있는 자리 수 */
  readonly movable: number;
  /** 통로를 대지 못한 자리 */
  readonly unchanneled: readonly string[];
  /** 새지 않는다고 선언된 자리 */
  readonly sealed: readonly string[];
  /** 통로별로 그리로 새는 자리들 */
  readonly byChannel: Readonly<Record<string, readonly string[]>>;
  /** 아무 자리도 쓰지 않는 통로 */
  readonly unusedChannels: readonly PhenomenonChannel[];
  /**
   * 통로가 선언됐지만 아직 **아무 원자도 움직이지 못하는** 자리.
   * 스키마에는 있고 열여섯 원자의 손이 닿지 않는 자리들이다(가격·통행권·앵커…) — 빠뜨림이 아니라
   * 뒤 계층(W·G·E)이 그 자리를 움직일 때 통로를 다시 정하지 않게 미리 적어 둔 것이다.
   * 검사에 걸리지는 않되 **몇 개인지는 값으로 드러난다** — 죽은 선언이 조용히 쌓이지 않게.
   */
  readonly aheadOfAtoms: readonly string[];
  /** 자리별 애매함 — 그 자리를 움직일 수 있는 원자 수 */
  readonly moversBySlot: Readonly<Record<string, number>>;
  readonly violations: readonly PhenomenonViolation[];
  readonly complete: boolean;
}

/**
 * 세계의 표면을 검사한다. 던지지 않는다 — 어긋남은 값으로 남는다.
 *
 * 관문 순서: 선언 자체의 온전함(통로 이름·자리 실재·중복) → 예외의 정합(새지 않는다는 선언과
 * 통로 선언이 같은 자리를 두고 다투지 않는가) → 완전성(움직일 수 있는 자리가 전부 답을 갖는가) →
 * 통로 6종이 전부 쓰이는가.
 */
export function checkLeakChannels(
  channels: readonly LeakChannel[] = LEAK_CHANNELS,
  sealed: readonly SealedSlot[] = SEALED_SLOTS,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
  schema: StateSchema = STATE_SCHEMA,
): LeakReport {
  const violations: PhenomenonViolation[] = [];

  // ① 선언 자체가 온전한가.
  const declared = new Map<string, LeakChannel>();
  for (const [index, entry] of channels.entries()) {
    const at = `$.channels[${String(index)}]`;
    const key = slotKey(entry.slot);

    if (declared.has(key)) {
      violatePhenomenon(
        violations,
        key,
        'unchanneled-slot',
        at,
        `${key} 의 통로가 두 번 적혔다 — 같은 자리가 두 답을 가지면 어느 쪽이 세계인지 알 수 없다`,
      );
      continue;
    }
    declared.set(key, entry);

    if (!slotExists(schema, entry.slot)) {
      violatePhenomenon(
        violations,
        key,
        'phantom-channel',
        `${at}.slot`,
        `세계에 없는 자리 ${key} 가 샌다고 적었다 — 없는 자리는 흔적을 남기지 못한다`,
      );
    }

    if (entry.channels.length === 0) {
      violatePhenomenon(
        violations,
        key,
        'undeclared-silence',
        `${at}.channels`,
        `${key} 가 아무 통로로도 새지 않는다고 적었으면서 왜 그런지를 선언하지 않았다 — 새지 않는 자리는 예외로 선언하고 그러면 어떻게 알려지는지를 적어라`,
      );
    }
    for (const [channelIndex, channel] of entry.channels.entries()) {
      if (!(PHENOMENON_CHANNELS as readonly string[]).includes(channel)) {
        violatePhenomenon(
          violations,
          key,
          'unknown-channel',
          `${at}.channels[${String(channelIndex)}]`,
          `O1 이 연 통로 6종에 없는 통로 ${JSON.stringify(channel)} 로 샌다고 적었다`,
        );
      }
    }

    if (entry.note === '') {
      violatePhenomenon(
        violations,
        key,
        'unchanneled-slot',
        `${at}.note`,
        `${key} 가 왜 그 통로로 새는지를 대지 못한다 — 근거 없는 통로는 통로가 아니다`,
      );
    }
  }

  // ② 예외가 통로 선언과 다투지 않는가.
  const sealedKeys = new Map<string, SealedSlot>();
  for (const [index, entry] of sealed.entries()) {
    const at = `$.sealed[${String(index)}]`;
    const key = slotKey(entry.slot);
    sealedKeys.set(key, entry);

    if (!slotExists(schema, entry.slot)) {
      violatePhenomenon(
        violations,
        key,
        'phantom-channel',
        `${at}.slot`,
        `세계에 없는 자리 ${key} 를 새지 않는 자리로 선언했다`,
      );
    }
    if (entry.reason === '' || entry.knownBy === '') {
      violatePhenomenon(
        violations,
        key,
        'undeclared-silence',
        at,
        `${key} 가 새지 않는다면서 이유나 "그러면 어떻게 알려지는가" 를 적지 않았다`,
      );
    }
    if (declared.has(key)) {
      violatePhenomenon(
        violations,
        key,
        'stale-silence',
        at,
        `${key} 는 새지 않는다고 선언됐는데 ${(declared.get(key) as LeakChannel).channels.join(', ')} 로 샌다고도 적혔다 — 예외가 낡았다`,
      );
    }
  }

  // ③ 원자가 움직일 수 있는 자리는 전부 답을 가져야 한다.
  const movable = movableSlots(groundings);
  const unchanneled: string[] = [];
  const moversBySlot: Record<string, number> = {};
  for (const ref of movable) {
    const key = slotKey(ref);
    moversBySlot[key] = atomsMoving(ref, groundings).length;
    if (declared.has(key) || sealedKeys.has(key)) continue;
    unchanneled.push(key);
    violatePhenomenon(
      violations,
      key,
      'unchanneled-slot',
      '$.channels',
      `원자가 움직일 수 있는 자리 ${key} 가 어느 통로로 새는지 적히지 않았다 — 세계가 바뀌는데 아무도 알 수 없다면 그것은 선언되어야 한다 (O0 observable-trace)`,
    );
  }

  // ④ O1 이 연 통로는 전부 쓰여야 한다.
  const byChannel: Record<string, string[]> = {};
  for (const channel of PHENOMENON_CHANNELS) byChannel[channel] = [];
  for (const entry of channels) {
    for (const channel of entry.channels) byChannel[channel]?.push(slotKey(entry.slot));
  }
  const unusedChannels = PHENOMENON_CHANNELS.filter(
    (channel) => (byChannel[channel] ?? []).length === 0,
  );
  for (const channel of unusedChannels) {
    violatePhenomenon(
      violations,
      channel,
      'unused-channel',
      '$.channels',
      `O1 이 연 통로 ${channel} 로 새는 자리가 하나도 없다 — 쓰이지 않는 통로는 통로가 아니다`,
    );
  }

  const movableKeys = new Set(movable.map(slotKey));
  const aheadOfAtoms = stableSort(
    [...declared.keys()].filter((key) => !movableKeys.has(key)),
    compareStrings,
  );

  return {
    movable: movable.length,
    unchanneled,
    sealed: stableSort([...sealedKeys.keys()], compareStrings),
    byChannel,
    unusedChannels,
    aheadOfAtoms,
    moversBySlot,
    violations,
    complete: channels.length > 0 && violations.length === 0,
  };
}

/** 표면을 한 줄 판정으로 접는다 — 터미널·배지용. */
export function leakVerdict(report: LeakReport): string {
  if (report.complete) {
    return `원자가 움직이는 자리 ${String(report.movable)} 이 전부 답을 갖는다 (새는 자리 ${String(report.movable - report.sealed.length)} · 새지 않는 자리 ${String(report.sealed.length)} — 전부 선언된 예외 · 통로 ${String(PHENOMENON_CHANNELS.length)} 종 전부 쓰임)`;
  }
  const reasons: string[] = [];
  if (report.unchanneled.length > 0) {
    reasons.push(`통로 없는 자리 ${report.unchanneled.join(', ')}`);
  }
  if (report.unusedChannels.length > 0) {
    reasons.push(`쓰이지 않는 통로 ${report.unusedChannels.join(', ')}`);
  }
  const rest = [...new Set(report.violations.map((violation) => violation.rule))];
  if (reasons.length === 0) return `표면이 막혔다 — ${rest.join(', ')}`;
  return reasons.join(' · ');
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function leakSummary(report: LeakReport): readonly string[] {
  return [
    `통로별 자리: ${PHENOMENON_CHANNELS.map((channel) => `${channel} ${String((report.byChannel[channel] ?? []).length)}`).join(' · ')}`,
    `새지 않는 자리: ${report.sealed.length === 0 ? '(없다)' : report.sealed.join(', ')}`,
    `가장 애매한 자리: ${mostAmbiguousSlot(report)}`,
    `아직 아무 원자도 못 움직이는 자리(미리 적어 둔 통로): ${String(report.aheadOfAtoms.length)}`,
  ];
}

/** 가장 많은 원자가 움직일 수 있는 자리 — 그 자국은 거의 아무것도 말해 주지 않는다. */
function mostAmbiguousSlot(report: LeakReport): string {
  const entries = stableSort(
    Object.entries(report.moversBySlot).filter(([key]) => !report.sealed.includes(key)),
    ([leftKey], [rightKey]) => compareStrings(leftKey, rightKey),
  );
  let best: readonly [string, number] | null = null;
  for (const entry of entries) {
    if (best === null || entry[1] > best[1]) best = entry;
  }
  return best === null ? '(없다)' : `${best[0]} — 원자 ${String(best[1])} 이 이 자리를 움직인다`;
}
