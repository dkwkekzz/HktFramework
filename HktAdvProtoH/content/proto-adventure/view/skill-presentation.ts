// Skill Presentation — 기술을 어떻게 보일지 결정한다 (C025, 결정 Layer 데이터).
//
// 세계는 지금까지도 기술 셋의 **가용성과 사유와 값**을 관찰 결과에 실어 왔다.
// 그런데 화면에는 바닥 프롬프트 한 자리뿐이라 셋 중 하나만, 그것도 문구 한 줄로
// 도착했고, 값(profile)은 어느 자리에도 도착하지 않았다.
// 이 파일이 그 자리를 연다 — **세계에 없던 것을 만들지 않는다.**
//
// **여기서 하는 판정은 하나도 없다.** 지금 쓸 수 있는지도, 왜 못 쓰는지도, 얼마를
// 치르고 얼마를 내는지도 전부 계약이 실어 온 것을 옮길 뿐이다
// (DC-WORLD-OWNS-THE-SURFACE-LIST · 04 prohibited).
//
// ── 무엇이 기술인가 ──────────────────────────────────────────────
//
// `profile` 이 실린 interaction 이 기술이다 (04 skill.identification).
// **이름으로 고르지 않는다** — `role` 의 `skill-` 접두사로 가르면 그 이름 규칙이
// 화면 코드로 복제되고, 세계가 이름을 바꾸는 날 화면이 조용히 틀린다.
// (기본 기술의 id 가 `attack` 이고 role 만 `skill-basic` 인 것이 그 위험의 실례다.)
//
// 그러므로 이 파일에는 `attack` 도 `skill-heavy` 도 `aura-strike` 도 없다.
// 기술이 넷이 되는 날 이 파일은 바뀌지 않는다.
//
// ── 자리를 둘로 가른다 ───────────────────────────────────────────
//
//     띠      한눈에 읽을 것 — 기술마다 한 칸. 이름과 실제 키와 **지금 어떤가** 하나.
//             셋이 나란히 서는 것이 이 Cycle 의 전부다 (INTENT-SKILL-HAND-IS-WHOLE-001)
//     패널    읽어야 아는 것 — 치를 기력과 낼 피해와 방식, 그리고 못 쓰는 사유의 긴 문장

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../../engine/protocol-core/gameview';
import type { SceneHudItem } from '../../../engine/view-kernel/scene/scene-state';
import type { GameViewSnapshot, InteractionView, SkillProfileView } from '../protocol/gameview';
import { interactionPresentation } from './interaction-presentation';

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
function statusText(skill: SkillObservation, answer: SkillAnswer | undefined, short: (c: string) => string): string {
  if (answer?.state === 'pending') return '요청 중';
  if (answer?.state === 'unsent') return '세계에 닿지 않음';
  if (answer?.state === 'accepted') return '나갔다';
  if (rejectionStillHolds(skill, answer))
    return `거절 · ${short(answer?.reason ?? 'unknown-interaction')}`;
  if (!skill.available) return `불가 · ${short(skill.reason ?? 'unknown-interaction')}`;
  return '지금 됨';
}

/**
 * 띠 — 기술마다 한 칸. **하나가 다른 하나를 밀어내지 않는다.**
 *
 * 이 목록이 비면 칸도 없다. 기술이 없는 세계에 기술 자리를 만들지 않는다.
 */
export function skillHudItems(
  snapshot: GameViewSnapshot,
  short: (code: string) => string,
  answers: SkillAnswers = NO_SKILL_ANSWERS,
): SceneHudItem[] {
  return skillObservations(snapshot).map((skill) => ({
    id: `${SKILL_HUD_PREFIX}${skill.id}`,
    widget: 'label' as const,
    label: skill.keyLabel ? `[${skill.keyLabel}] ${skill.label}` : skill.label,
    value: statusText(skill, answers[skill.id], short),
  }));
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
export function skillDetailLines(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
  answers: SkillAnswers = NO_SKILL_ANSWERS,
): string[] {
  const skills = skillObservations(snapshot);
  if (skills.length === 0) return [];

  const lines = ['── 기술 ──'];
  for (const skill of skills) {
    const key = skill.keyLabel ? `[${skill.keyLabel}] ` : '';
    const type = text(skill.profile.damageType);
    lines.push(
      `${key}${skill.label} · ${energyText(skill.profile)}` +
        ` · 공격 피해 ${round(skill.profile.rawDamage)} (${type})`,
    );

    const answer = answers[skill.id];
    if (answer?.state === 'pending') lines.push('    요청 중 — 대답을 기다린다');
    else if (answer?.state === 'unsent') lines.push('    세계에 닿지 않았다 — 이어짐을 확인한다');
    else if (answer?.state === 'accepted') lines.push('    받아들여졌다 — 지금 나가고 있다');
    else if (rejectionStillHolds(skill, answer))
      lines.push(`    거절 — ${text(answer?.reason ?? 'unknown-interaction')}`);
    else if (!skill.available) lines.push(`    불가 — ${text(skill.reason ?? 'unknown-interaction')}`);
  }
  return lines;
}
