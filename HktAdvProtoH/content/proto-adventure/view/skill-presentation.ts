// Skill Presentation — 걸 수 있는 기술들을 **한자리에 견주어** 보이게 하고,
// 내가 건 요청이 어떻게 되었는지를 그 자리에 붙인다 (C025+C027, 결정 Layer 데이터).
//
// 두 레인이 같은 자리에서 만났다.
//
//   C025 (레인 B)   무엇이 넓고 무엇이 멀리 닿는가 — 모양을 견주는 띠
//   C027 (레인 A)   무엇을 치르고 무엇을 내는가 · 내 요청이 어떻게 되었는가
//
// 둘은 같은 물음의 앞뒤다. 고르기 전에 견주고(모양·값), 걸고 나서 대답을 받는다.
// 그래서 목록을 둘로 가르지 않고 **한 벌**로 둔다.
//
// **여기서 하는 판정은 하나도 없다.** 걸 수 있는지도, 왜 안 되는지도, 얼마를 치르고
// 얼마를 내는지도 전부 계약이 실어 온 것을 옮길 뿐이다
// (DC-WORLD-OWNS-THE-SURFACE-LIST · 04 prohibited).
//
// ── 무엇이 기술인가 ──────────────────────────────────────────────
//
// `profile` 이 실린 interaction 이 기술이다 (04 skill.identification).
// **이름으로 고르지 않는다** — `role` 의 `skill-` 접두사로 가르면 그 이름 규칙이
// 화면 코드로 복제되고, 세계가 이름을 바꾸는 날 화면이 조용히 틀린다
// (DC-SKILL-IS-COMBINATION-NOT-NAME). 기본 기술의 id 가 `attack` 이고 role 만
// `skill-basic` 인 것이 그 위험의 실례다.
//
// 모양(`swingArc`·`swingReach`·`swingTipRadius`)은 **있으면 그리고 없으면 건너뛴다** —
// 모양을 기술의 조건으로 삼으면 모양 없는 기술이 생기는 날 그 기술이 목록에서
// 조용히 사라진다.
//
// 그러므로 이 파일에는 `attack` 도 `skill-heavy` 도 `aura-strike` 도 없다.
// 기술이 넷이 되는 날 이 파일은 바뀌지 않는다.
//
// ── 자리를 둘로 가른다 ───────────────────────────────────────────
//
//   띠     한눈에 읽을 것 — 어느 키로 무엇을 걸고, 얼마나 넓고 멀리 닿고, 지금 어떤가
//   패널   읽어야 아는 것 — 치를 기력·낼 피해·방식, 그리고 못 쓰는 사유의 긴 문장
//
// 사유를 띠에 문장으로 두지 않는 이유는 C025 가 실측으로 배운 것이다 — 무엇이든
// 하고 있는 동안에는 세 기술이 **모두** "지금 하는 행동이 끝나야 한다" 를 달고 나와
// 띠가 세 배로 길어졌다. 띠에는 **짧은 표기**만 둔다.

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../../engine/protocol-core/gameview';
import type {
  SceneHudItem,
  SceneSlotBar,
  SceneSlotState,
} from '../../../engine/view-kernel/scene/scene-state';
import type { GameViewSnapshot, InteractionView, SkillProfileView } from '../protocol/gameview';
import { interactionPresentation, interactionIcon} from './interaction-presentation';
import { waitingSince, waitStage, waitText, type WaitStage } from './request-timing';

/** 기술 줄의 id 앞머리 — 조립 루트가 이것으로 자기 칸을 되찾는다 */
export const SKILL_HUD_PREFIX = 'skill.';

/**
 * 내가 건 요청이 어떻게 되었는가 (C025 — 04 requestOutcome).
 *
 * **세계의 상태가 아니다.** 세계는 누가 무엇을 걸었는지 기억하지 않는다
 * (03 WORLD STATE — pending 은 World State 가 아니다). 이것은 관찰자 자신이 아는
 * 사실이며 조립 루트가 쥔다 — `facingSides` · `command` 와 같은 자리다.
 */
export interface SkillAnswer {
  /**
   * pending    걸어 두었고 아직 대답이 오지 않았다
   * accepted   세계가 받아들였다
   * rejected   세계가 거절했다 — 사유가 함께 온다
   * unsent     세계에 닿지도 못했다 (이어져 있지 않다).
   *            거절과 **다른 사정**이다 (INTENT-SKILL-REQUEST-ANSWERED-001)
   */
  state: 'pending' | 'accepted' | 'rejected' | 'unsent';
  /** 거절 사유 코드 — 세계가 준 그대로. 문구 변환은 이 파일이 한다 */
  reason?: string;
}

/** 기술 id → 그 기술에 마지막으로 일어난 일. 없는 기술은 항목이 없다 */
export type SkillAnswers = Readonly<Record<string, SkillAnswer>>;

export const NO_SKILL_ANSWERS: SkillAnswers = {};

/** 한 기술의 관찰 — 계약이 실어 온 것과, 그것을 부르는 화면의 결정뿐이다 */
export interface SkillObservation {
  /** ActionRequest.interactionId 로 그대로 나간다 */
  id: string;
  /** 의미 코드 */
  role: string;
  /** 사람이 읽는 이름 — 표에 없으면 role 코드가 그대로 선다 */
  label: string;
  /** 실제 바인딩 표기 (C005 INTENT-LINK-BINDING-VISIBLE-001). 없을 수 있다 */
  keyLabel?: string;
  available: boolean;
  /** 못 쓰는 사유 코드 — 세계가 고른 **하나**다 (04 skill.unavailableReason) */
  reason?: string;
  profile: SkillProfileView;
}

/** 넓이 막대의 칸 수 — 목록 안에서 가장 넓은 기술이 이만큼 찬다 */
const ARC_BAR_STEPS = 5;
const BAR_FILLED = '█';
const BAR_EMPTY = '░';

/** 이 기술의 휘두름 모양 — 세계가 싣지 않았으면 없다 (C025) */
function shapeOf(profile: SkillProfileView) {
  const { swingArc, swingReach, swingTipRadius } = profile;
  if (swingArc === undefined || swingReach === undefined || swingTipRadius === undefined) {
    return undefined;
  }
  return { arc: swingArc, reach: swingReach, tipRadius: swingTipRadius };
}

/**
 * 넓이 막대 — **목록 안에서** 가장 넓은 것을 가득 찬 것으로 보고 견준다 (C025).
 *
 * 화면이 "몇 도부터 넓은가" 를 정하지 않는다는 뜻이다. 그런 문턱을 코드에 두면
 * 세계가 값을 바꿀 때마다 화면이 거짓말을 하게 된다.
 */
function arcBar(arc: number, widest: number): string {
  const filled = widest > 0 ? Math.max(1, Math.round((arc / widest) * ARC_BAR_STEPS)) : 0;
  return BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(Math.max(0, ARC_BAR_STEPS - filled));
}

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI);
/** 실제로 닿는 가장 먼 거리의 기준 — 길이 + 굵기 (상대의 몸 반경은 그 위에 더해진다) */
const outerReach = (reach: number, tipRadius: number) => (reach + tipRadius).toFixed(1);

/**
 * 이 interaction 이 기술인가 — `profile` 이 실렸는가 하나로 답한다.
 *
 * 이 함수가 이 파일에서 **유일한 분류**이며, 그것도 계약이 실은 값을 보는 것이다.
 */
export function isSkillInteraction(interaction: InteractionView): boolean {
  return interaction.profile !== undefined;
}

/**
 * 지금 관찰된 기술 전부 — **세계가 보낸 순서 그대로.**
 *
 * 화면이 순서를 만들지 않는다. 키가 없는 기술도 빠지지 않는다 —
 * 부르지 못할 뿐 존재는 관찰된다 (03 JUDGEMENT ③).
 */
export function skillObservations(snapshot: GameViewSnapshot): SkillObservation[] {
  const observations: SkillObservation[] = [];
  for (const interaction of snapshot.interactions) {
    if (!isSkillInteraction(interaction)) continue;
    const presentation = interactionPresentation(interaction.role);
    observations.push({
      id: interaction.id,
      role: interaction.role,
      label: presentation.prompt ?? interaction.role,
      ...(presentation.keyLabel ? { keyLabel: presentation.keyLabel } : {}),
      available: interaction.available,
      ...(interaction.reason ? { reason: interaction.reason } : {}),
      profile: interaction.profile as SkillProfileView,
    });
  }
  return observations;
}

/**
 * 지금 기술인 interaction 의 id 들 — 조립 루트가 "이 요청에 표식을 달까" 를 이것으로 안다.
 *
 * 봉투 형(CoreGameViewSnapshot)으로 받는다. 조립 루트는 팩 계약의 형을 알지 못하며,
 * 알 필요도 없다 — 무엇이 기술인지는 이 파일이 답한다 (04 skill.identification).
 */
export function skillInteractionIds(observed: CoreGameViewSnapshot): Set<string> {
  return new Set(skillObservations(observed as GameViewSnapshot).map((skill) => skill.id));
}

/**
 * 거절이 **아직 참인가.**
 *
 * 거절은 *일어난 일*이고 가용성은 *지금 어떤가* 다. 둘은 어긋날 수 있다.
 *
 *     손을 내렸다        막는 중이라 거절당했는데 이제 막고 있지 않다
 *     사정이 바뀌었다     행동 중이라 거절당했는데 이제는 막는 중이다
 *
 * 두 경우 모두 `거절 · 막는 중` 을 계속 보이면 화면이 **지금 참이 아닌 것**을 말한다.
 * 그러므로 거절은 세계가 **여전히 같은 사유로 막고 있는 동안에만** 남는다.
 *
 * 그동안은 미리 받은 안내(`불가`)보다 앞선다 — 짐작이 아니라 실제로 걸어 보고 받은
 * 답이기 때문이다. 사유가 바뀌면 세계의 지금 말이 이긴다. 되면 그냥 된다.
 *
 * 이 판정에 화면의 규칙은 하나도 없다 — 두 값을 견줄 뿐이며, 사유의 단일 출처는
 * 여전히 세계다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
function rejectionStillHolds(skill: SkillObservation, answer: SkillAnswer | undefined): boolean {
  if (answer?.state !== 'rejected') return false;
  if (skill.available) return false;
  return skill.reason === answer.reason;
}

/**
 * 띠 한 칸의 상태 — **하나만** 보인다.
 *
 * 순서가 곧 판단이다. 앞의 셋은 **내 요청**에 대한 답이고, 뒤의 둘은 **세계의 지금**이다.
 *
 *     요청 중 · 닿지 않음    내 요청이 아직 끝나지 않았다 — 지금 가장 알고 싶은 것이다
 *     나갔다                받아들여졌다 — 조립 루트가 이 표시를 잠깐만 쥐고 있다
 *     거절                  실제로 걸어 보고 받은 답. **같은 사유로 아직 막힌 동안에만** 남는다
 *     불가                  세계가 미리 말해 둔 사유
 *     지금 됨               막을 것이 없다
 *
 * **받아들여짐이 `불가` 보다 앞에 온다.** 뒤에 두면 영영 보이지 않기 때문이다 —
 * 받아들여진 기술은 그 순간부터 행동 중이라 세계가 곧바로 `action-busy` 로 막는다.
 * 그러면 나간 것과 애초에 못 나간 것이 화면에서 같아지고, 그것이 정확히 이 Cycle 이
 * 없애려는 상태다 (INTENT-SKILL-REQUEST-ANSWERED-001).
 *
 * 대신 그 표시는 오래 머물지 않는다 — 얼마나 머물지는 시계를 쥔 조립 루트가 정한다.
 * 표시가 걷히면 세계의 지금(`불가 · 행동 중` 또는 `지금 됨`)이 그 자리를 돌려받는다.
 *
 * **없는 것을 지어내지 않는다** — 가용하면 사유가 없고, 사유가 없으면 이유를 만들지 않는다.
 */
function statusText(
  skill: SkillObservation,
  answer: SkillAnswer | undefined,
  short: (c: string) => string,
  wait: WaitStage,
): string {
  // 기다림은 **늦을 때만** 말한다 (V-007). 늦지 않은 기다림 동안 이 칸은 세계의 지금을
  // 그대로 보인다 — 곧 올 답이 그 자리를 덮으므로, 깜빡이는 글자를 하나 더 두지 않는다
  if (answer?.state === 'pending') return waitText(wait) ?? worldNow(skill, short);
  if (answer?.state === 'unsent') return '세계에 닿지 않음';
  if (answer?.state === 'accepted') return '나갔다';
  if (rejectionStillHolds(skill, answer))
    return `거절 · ${short(answer?.reason ?? 'unknown-interaction')}`;
  return worldNow(skill, short);
}

/** 세계의 지금 — 내 요청에 대한 답이 아무것도 없을 때 이 칸이 말하는 것 */
function worldNow(skill: SkillObservation, short: (c: string) => string): string {
  if (!skill.available) return `불가 · ${short(skill.reason ?? 'unknown-interaction')}`;
  return '지금 됨';
}

/**
 * 이 기술이 지는 사정 — **있으면 적고 없으면 건너뛴다** (C-COMBAT-003).
 *
 * 모양을 다루는 `shapeOf` 와 같은 규율이다: 사정을 기술의 조건으로 삼으면 사정 없는
 * 기술이 생기는 날 그 기술이 목록에서 조용히 사라진다. 기존 세 기술은 빈 목록으로
 * 오므로 이 함수가 아무것도 더하지 않고, 그래서 그 셋의 줄은 한 글자도 바뀌지 않는다.
 *
 * **요구와 조건을 다른 말로 적는다.** 계약이 둘을 다른 칸에 실어 보낸 이유가 그대로다 —
 * 못 쓰는 사유와 더 잘 드는 사유는 다른 물음의 답이다 (04 GameView Specification).
 *
 * 여기서도 판정하지 않는다. 갖춰졌는지도 참인지도 세계가 실은 값이며, 화면은 그것을
 * ✓ 와 ✗ 로 옮길 뿐이다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
function circumstanceText(
  profile: SkillProfileView,
  text: (code: string) => string,
): string | undefined {
  const parts: string[] = [];

  const requires = profile.requires ?? [];
  if (requires.length > 0) {
    // **사정의 이름으로 적는다** — 긴 사유(`무엇을 하면 열리는가`)가 아니다.
    // 그것은 이미 줄 앞머리에 서 있고(`panelMark`), 여기에 또 적으면 한 줄에 같은
    // 문장이 두 번 실린다. 실제로 그렇게 나왔고 브라우저에서 눈으로 잡았다
    // (07-view-implementation.md NOTES ②).
    parts.push('요구 ' + requires.map((r) => `${r.met ? '✓' : '✗'}${text(r.id)}`).join(' · '));
  }

  const conditions = profile.conditions ?? [];
  if (conditions.length > 0) {
    // 몫을 함께 적는다 — 얼마나 커지는지를 알아야 사정을 만들러 갈 값이 선다.
    // 세계가 실은 수를 그대로 쓴다 (화면이 피해로 환산하지 않는다 — 대상이 정해지기
    // 전에는 세계도 모르는 값이다).
    parts.push(
      '조건 ' +
        conditions
          .map((c) => `${c.holds ? '✓' : '✗'}${text(c.id)} +${round(c.bonus)}`)
          .join(' · '),
    );
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * 이 기술이 실어 보내는 공격 피해 (C-COMBAT-004 CHANGED).
 *
 * **0 을 그대로 쓰지 않는다.** `공격 피해 0` 은 "아주 약한 공격" 으로 읽히는데,
 * 세계가 말하는 것은 그것이 아니라 **이 기술은 피해를 내지 않는다** 다
 * (INTENT-A-BLOW-THAT-LEAVES-INSTEAD-OF-HURTS-001).
 *
 * 지어내는 것이 아니다 — 세계가 보낸 0 을 다른 말로 옮길 뿐이며, 옮기는 말을 정하는
 * 것이 결정 Layer 의 일이다. 값이 있으면 지금까지와 한 글자도 같다.
 */
function damageText(profile: SkillProfileView, type: string): string {
  if (profile.rawDamage === 0) return '피해 없음';
  return `공격 피해 ${round(profile.rawDamage)} (${type})`;
}

/** `-0 / +12` 처럼 읽는 기력 수지 — 두 값을 합치지 않는다. 서로 다른 일이기 때문이다 */
function energyText(profile: SkillProfileView): string {
  return `기력 -${round(profile.cost)} / +${round(profile.charge)}`;
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * 패널 — 기술마다 한 줄. 치를 것과 낼 것과 방식, 그리고 못 쓰는 긴 사유.
 *
 * `rawDamage` 는 **세계가 지금 이 몸으로 계산한 값**이다. 화면은
 * `baseDamage + 내 공격 능력 × attackRatio` 를 하지 않는다 (04 prohibited).
 * 최종 피해도 아니다 — 대상이 정해지기 전에는 세계도 모르는 값이다.
 */
/**
 * 패널 한 줄의 앞머리 — **지금 어떤가**를 한 글자와 짧은 말로 (C025 ✓/✗ 표기 유지).
 *
 * 띠와 나누는 기준은 **길이**다. 띠에는 짧은 표기만 가고, 사유의 **긴 문장**은 여기 온다 —
 * C025 가 실측으로 배운 것이다 (무엇이든 하는 동안 세 기술이 모두 같은 문장을 달아
 * 띠가 세 배로 길어졌다).
 */
function panelMark(
  skill: SkillObservation,
  answer: SkillAnswer | undefined,
  text: (code: string) => string,
  wait: WaitStage,
): string {
  if (answer?.state === 'pending') {
    const waiting = waitText(wait);
    if (waiting !== undefined) return `⋯ ${waiting}`;
    // 아직 말하지 않는다 — 아래로 흘러 세계의 지금이 선다 (V-007)
  }
  if (answer?.state === 'unsent') return '✗ 세계에 닿지 않았다';
  if (answer?.state === 'accepted') return '✓ 나갔다';
  if (rejectionStillHolds(skill, answer))
    return `✗ 거절 — ${text(answer?.reason ?? 'unknown-interaction')}`;
  if (!skill.available) return `✗ ${text(skill.reason ?? 'unknown-interaction')}`;
  return skill.keyLabel ? `✓ ${skill.keyLabel}` : '✓';
}

/**
 * 패널 — 기술마다 한 줄. 지금 어떤가(긴 문장) + 치를 것과 낼 것과 방식.
 *
 * `rawDamage` 는 **세계가 지금 이 몸으로 계산한 값**이다. 화면은
 * `baseDamage + 내 공격 능력 × attackRatio` 를 하지 않는다 (04 prohibited).
 * 최종 피해도 아니다 — 대상이 정해지기 전에는 세계도 모르는 값이다.
 */
export function skillDetailLines(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
  answers: SkillAnswers = NO_SKILL_ANSWERS,
  now: number = performance.now(),
): string[] {
  const skills = skillObservations(snapshot);
  if (skills.length === 0) return [];

  return [
    '기술',
    ...skills.map((skill) => {
      const mark = panelMark(skill, answers[skill.id], text, stageOf(skill.id, answers, now));
      const type = text(skill.profile.damageType);
      // C-COMBAT-003 — 사정은 **패널에만** 온다. 띠에 두면 사정을 지는 기술마다 줄이
      // 배로 길어지고, 그것이 정확히 C025 가 실측으로 배운 실패다 (이 파일 머리말).
      const circumstances = circumstanceText(skill.profile, text);
      return (
        `${skill.label} ${mark}` +
        ` · ${energyText(skill.profile)}` +
        ` · ${damageText(skill.profile, type)}` +
        (circumstances ? ` · ${circumstances}` : '')
      );
    }),
  ];
}

/** 기술 띠의 id — 조립 루트가 눌린 칸을 이 앞머리로 되읽는다 */
export const SKILL_SLOT_BAR_ID = 'skills';

/**
 * 이 기술의 기다림이 지금 어떻게 보이는가 (V-007).
 *
 * 언제 보냈는지는 화면에 실려 오지 않는다 — `SkillAnswer` 는 결과만 나른다.
 * 그래서 **기다리는 것을 처음 본 순간**을 화면이 적어 둔다 (request-timing 의 장부).
 */
function stageOf(id: string, answers: SkillAnswers, now: number): WaitStage {
  const pending = answers[id]?.state === 'pending';
  return waitStage(waitingSince(id, pending, now), now);
}

/** 이 칸이 지금 어떤 상태인가 — 세계의 판정과 내 요청을 한 값으로 (그리기용) */
function slotState(
  skill: SkillObservation,
  answer: SkillAnswer | undefined,
  wait: WaitStage,
): SceneSlotState {
  // 기다리는 칸으로 그리는 것도 늦을 때부터다 — 안 그러면 누를 때마다 칸이 깜빡인다
  if (answer?.state === 'pending' && wait !== 'silent') return 'pending';
  if (answer?.state === 'pending') return skill.available ? 'available' : 'blocked';
  if (answer?.state === 'unsent') return 'blocked';
  if (answer?.state === 'accepted') return 'available';
  return skill.available ? 'available' : 'blocked';
}

/**
 * 기술 슬롯 띠 — 화면 아래에 늘 서는 자리 (VUX-SK §2.1 · §3).
 *
 * 지금까지 기술은 위쪽 가로 띠의 **글자 한 칸**이었다. 그것으로도 셋이 나란히 서고
 * 사유가 각자 붙었지만, 겪는 사람에게는 다른 안내들과 같은 무게로 보였다 —
 * 지금 이 순간 고르는 것이 자기 자리를 갖지 못했다.
 *
 * **여기서도 판정하지 않는다.** 칸의 순서도 세계가 보낸 순서이고, 되는지 안 되는지도
 * 세계가 실은 값이다. 이 함수가 하는 일은 그것을 그리는 지시로 옮기는 것뿐이다.
 *
 * 부를 키가 없는 기술도 칸을 얻는다 — 부르지 못할 뿐 존재는 관찰된다.
 * 그런 칸은 눌러서 부를 수 있다 (키와 포인터가 같은 요청으로 수렴한다).
 */
export function skillSlotBar(
  snapshot: GameViewSnapshot,
  short: (code: string) => string,
  answers: SkillAnswers = NO_SKILL_ANSWERS,
  now: number = performance.now(),
): SceneSlotBar {
  const skills = skillObservations(snapshot);
  const arcs = skills.map((s) => shapeOf(s.profile)?.arc ?? 0);
  const widest = Math.max(0, ...arcs);

  return {
    id: SKILL_SLOT_BAR_ID,
    cells: skills.map((skill) => {
      const shape = shapeOf(skill.profile);
      const wait = stageOf(skill.id, answers, now);
      return {
        id: skill.id,
        ...(skill.keyLabel ? { key: skill.keyLabel } : {}),
        // 표식은 **이름과 함께** 선다 (V-019) — 글자를 읽지 않고도 칸이 갈리되,
        // 표식만으로는 무엇인지 아는 사람에게만 참인 화면이 되기 때문이다.
        // 표에 없는 기술도 표식을 얻는다: 칸이 사라지거나 비지 않는다
        title: `${interactionIcon(skill.role)} ${skill.label}`,
        // 고르기 전에 아는 값 — 모양이 있으면 모양을, 없으면 치를 기력을 보인다.
        // 둘 다 세계가 실은 값이며 화면이 만들지 않는다.
        detail: shape
          ? `${arcBar(shape.arc, widest)} ${degrees(shape.arc)}° · 도달 ${outerReach(shape.reach, shape.tipRadius)}`
          : energyText(skill.profile),
        status: statusText(skill, answers[skill.id], short, wait),
        state: slotState(skill, answers[skill.id], wait),
      };
    }),
  };
}
