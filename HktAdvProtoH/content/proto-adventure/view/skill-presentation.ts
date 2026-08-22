// Skill Presentation — 걸 수 있는 기술들을 **한자리에 견주어** 보이게 한다
// (C024, 결정 Layer 데이터).
//
// 지금까지 화면이 준 것은 조작 안내 한 줄씩이었다 ("고급 스킬: G"). 그것으로는
// 무엇이 넓고 무엇이 멀리 닿는지, 지금 걸 수 있는지, 못 걸면 왜인지가
// **견주어지지 않는다.** C024 이 만드는 판단은 "여기서는 무엇을 걸까" 이고,
// 그 판단은 고르는 순간에 서야 한다 (04 VIEW NOTE ② · 05-review.md Human 지시).
//
// **여기서 하는 판정은 하나도 없다.** 걸 수 있는지도, 왜 안 되는지도 전부 계약이
// 실어 온 것을 옮길 뿐이다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
//
// 자리는 둘로 갈린다 — C022 가 소지품에서 같은 문제를 겪고 내린 결정을 그대로 따른다.
// 처음에는 사유까지 가로 띠에 함께 두었는데, 무엇이든 하고 있는 동안에는 세 기술이
// **모두** "지금 하는 행동이 끝나야 한다" 를 달고 나와 띠가 세 배로 길어졌다.
// 사유는 문장이라 길고, 띠는 가로로만 자란다.
//
//   띠     한눈에 읽을 것 — 어느 키로 무엇을 걸고, 얼마나 넓고 얼마나 멀리 닿는가
//   패널   읽어야 아는 것 — 지금 걸 수 있는가, 안 되면 왜인가 (세로로 자란다)
//
// 어느 것도 사라지지 않는다. 세계가 보낸 사유는 전부 그대로 보인다 — 자리만 옮겼다.
//
// **기술 이름도 역할 목록도 이 파일에 없다.** 무엇이 기술인가를 묻는 방법은 하나다 —
// **모양을 지닌 interaction 이 기술이다.** 세계가 넷째 기술을 정의하면 이 파일을
// 고치지 않아도 줄이 하나 는다 (DC-SKILL-IS-COMBINATION-NOT-NAME).

import type { SceneHudItem } from '../../../engine/view-kernel/scene/scene-state';
import type { GameViewSnapshot, InteractionView } from '../protocol/gameview';
import { interactionPresentation } from './interaction-presentation';

/** 기술 줄의 id 앞머리 — 다른 줄과 섞이지 않게 한다 */
export const SKILL_HUD_PREFIX = 'skill.';

/** 넓이 막대의 칸 수 — 가장 넓은 기술이 이만큼 찬다 */
const ARC_BAR_STEPS = 5;
const BAR_FILLED = '█';
const BAR_EMPTY = '░';

/** 이 interaction 이 기술인가 — 모양을 지녔으면 기술이다 */
function shapeOf(interaction: InteractionView) {
  const profile = interaction.profile;
  if (!profile) return undefined;
  const { swingArc, swingReach, swingTipRadius } = profile;
  if (swingArc === undefined || swingReach === undefined || swingTipRadius === undefined) {
    return undefined;
  }
  return { arc: swingArc, reach: swingReach, tipRadius: swingTipRadius };
}

/**
 * 넓이 막대 — **목록 안에서** 가장 넓은 것을 가득 찬 것으로 보고 견준다.
 *
 * 화면이 "몇 도부터 넓은가" 를 정하지 않는다는 뜻이다. 그런 문턱을 코드에 두면
 * 세계가 값을 바꿀 때마다 화면이 거짓말을 하게 된다. 여기서 하는 것은 세계가 보낸
 * 것들끼리의 견줌뿐이다.
 */
function arcBar(arc: number, widest: number): string {
  const filled = widest > 0 ? Math.max(1, Math.round((arc / widest) * ARC_BAR_STEPS)) : 0;
  return BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(Math.max(0, ARC_BAR_STEPS - filled));
}

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI);
/** 실제로 닿는 가장 먼 거리의 기준 — 길이 + 굵기 (상대의 몸 반경은 그 위에 더해진다) */
const outerReach = (reach: number, tipRadius: number) => (reach + tipRadius).toFixed(1);

/**
 * 걸 수 있는 기술들의 줄. 세계가 보낸 순서를 지킨다 —
 * 순서를 정하는 것은 이미 `interaction-presentation` 의 priority 가 한 일이다.
 */
export function skillHudItems(snapshot: GameViewSnapshot): SceneHudItem[] {
  const skills = snapshot.interactions
    .map((interaction) => ({ interaction, shape: shapeOf(interaction) }))
    .filter((entry): entry is { interaction: InteractionView; shape: NonNullable<ReturnType<typeof shapeOf>> } =>
      entry.shape !== undefined,
    );

  if (skills.length === 0) return [];

  const widest = Math.max(...skills.map((s) => s.shape.arc));

  return skills.map(({ interaction, shape }) => {
    const presentation = interactionPresentation(interaction.role);
    // 이름도 키도 이미 한 곳에 있다 — 여기서 다시 적지 않는다.
    // 표에 없는 역할이면 역할 코드가 그대로 보인다 (화면이 멈추지 않는다).
    const name = presentation.prompt ?? interaction.role;
    const key = presentation.keyLabel;
    return {
      id: `${SKILL_HUD_PREFIX}${interaction.id}`,
      widget: 'label' as const,
      label: key ? `${key} ${name}` : name,
      value: `${arcBar(shape.arc, widest)} ${degrees(shape.arc)}° · 도달 ${outerReach(shape.reach, shape.tipRadius)}`,
    };
  });
}

/**
 * 지금 걸 수 있는가와 안 되면 왜인가 — 세로로 자라는 패널의 몫이다.
 *
 * 여기서도 판정하지 않는다. `available` 과 `reason` 은 세계가 보낸 것이고, 이 함수는
 * 그것을 사람이 읽을 줄로 옮길 뿐이다.
 */
export function skillDetailLines(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
  /** 사유의 **짧은 표기** — 목록 안이라 길면 문단이 된다 (code-text.ts 의 이유 참조) */
  shortText: (code: string) => string,
): string[] {
  const skills = snapshot.interactions.filter((interaction) => shapeOf(interaction) !== undefined);
  if (skills.length === 0) return [];

  return [
    '기술',
    ...skills.map((interaction) => {
      const presentation = interactionPresentation(interaction.role);
      const name = presentation.prompt ?? interaction.role;
      const key = presentation.keyLabel;
      if (!interaction.available) {
        return `${name} ✗ ${interaction.reason ? shortText(interaction.reason) : '안 됨'}`;
      }
      return key ? `${name} ✓ ${key}` : `${name} ✓`;
    }),
  ];
}
