// Combat Presentation (C007) — 전투 관찰값의 표시를 결정한다 (결정 Layer 데이터).
//
// 세계는 이름·생명·기력·능력치·배율·타격 결과를 의미 그대로 보낸다.
// 무엇을 늘 띄우고, 무엇을 어떤 형식으로 쓰고, 무엇을 켜야 보이게 할지는 여기서 정한다.
//
// 세계가 모든 속성을 보낸다고 해서 전부 늘 띄우지는 않는다 (04 entityHud.notShownByDefault) —
// 감춘 것이 아니라 몸 위를 채우지 않기 위한 표시 선택이며, 속성 관찰을 켜면 그 자리에서 펼쳐진다.

import type { EntityView, GameViewSnapshot, StrikeEventView } from '../../protocol/gameview';
import type { SceneNameplate, SceneSelf, SceneStrike } from '../scene/scene-state';
import { codeText } from './code-text';

// 표지는 그 몸의 그림 바로 위에 붙는다 — 떨어져 있으면 누구의 것인지 읽히지 않는다.
// 기준은 물리 몸(캡슐 높이 1.7)이 아니라 실제로 그려지는 그림의 크기다.
// 그림이 큰 존재는 표지도 그만큼 위로 간다.
const PLATE_MARGIN = 0.15;
// 타격 숫자는 맞은 자리 — 그림 한가운데쯤에서 떠오른다.
const STRIKE_ANCHOR_RATIO = 0.55;
// 그림 크기를 모르는 경우의 기준 (role-presentation 의 기본 크기)
const DEFAULT_SPRITE_SIZE = 2.5;

// 몸 위 기본 표시 — 이름과 생명뿐이다 (04 entityHud.shows).
// spriteSize 는 그 존재가 그려지는 크기 (결정 Layer 가 role 로 정한 값).
export function nameplate(entity: EntityView, spriteSize: number): SceneNameplate | undefined {
  if (!entity.vitality || entity.name === undefined) return undefined;
  const { health, healthMaximum, downed } = entity.vitality;
  return {
    name: entity.name,
    health: Math.round(health),
    healthMaximum: Math.round(healthMaximum),
    healthRatio: healthMaximum > 0 ? Math.max(0, Math.min(1, health / healthMaximum)) : 0,
    downed,
    anchorHeight: spriteSize + PLATE_MARGIN,
  };
}

// 속성 관찰 (04 debugAuthority.inspect) — 켜면 그 존재의 모든 속성을 펼친다.
// 세계는 이미 전부 보내고 있다. 켜고 끄는 것은 보는 이의 선택이다.
export function inspectLines(entity: EntityView): string[] | undefined {
  const a = entity.attributes;
  if (!a) return undefined;
  return [
    // 자원은 눈으로 읽는 값이다 — 소수점까지 흔들리면 읽히지 않는다 (self 패널과 같은 규칙)
    `기력 ${Math.round(a.energy)} / ${Math.round(a.energyMaximum)}`,
    `이동 ${codeText(a.moveMode)} · ${round(a.tempoStats.moveSpeed)} ×${round(
      a.tempoStats.runSpeedMultiplier,
    )}`,
    `공속 ×${round(a.tempoStats.actionSpeed)}`,
    // C010 — 방어는 체감식이라 수치만으로는 효과를 알 수 없다. 남는 비율을 함께 쓴다.
    `공격 ${round(a.combatStats.attack)} · 방어 ${round(a.combatStats.defense)}` +
      ` (받는 피해 ${percent(a.combatStats.defenseMultiplier)})`,
    `배율 충전×${round(a.modifiers.energyCharge)} 소비×${round(a.modifiers.energyConsume)}`,
    `배율 이동×${round(a.modifiers.moveSpeed)} 공속×${round(a.modifiers.actionSpeed)}`,
  ];
}

// 타격 결과 — 얼마가 깎였는지 숫자로 읽힌다. 고급 스킬의 결과는 크게 그린다.
// 맞은 몸의 그림 크기를 알면 그 몸에서 떠오르게 한다 (모르면 기준값).
//
// C010 — 세계는 그 숫자가 나온 경위도 함께 보낸다. 늘 띄우면 정작 피해 숫자가 읽히지
// 않으므로, 속성 관찰이 켜진 동안에만 한 줄로 덧붙인다 (detail).
// "왜 이만큼인가" 를 확인하려는 순간은 값을 들여다보는 순간과 같기 때문이다.
export function strikeMark(
  event: StrikeEventView,
  targetSpriteSize?: number,
  inspect = false,
): SceneStrike {
  return {
    id: `${event.attackerId}->${event.targetId}@${event.since}`,
    position: event.at,
    text: `-${Math.round(event.amount)}`,
    emphasis: event.skill === 'heavy-attack',
    since: event.since,
    anchorHeight: (targetSpriteSize ?? DEFAULT_SPRITE_SIZE) * STRIKE_ANCHOR_RATIO,
    ...(inspect ? { detail: breakdownLine(event) } : {}),
  };
}

// 한 방의 경위를 한 줄로 — 스킬이 얼마 + 공격력이 얼마를 보태 = 얼마였고,
// 상대 방어가 그것을 몇 할로 줄여 = 얼마가 되었다.
function breakdownLine(event: StrikeEventView): string {
  const b = event.breakdown;
  return (
    `${round(b.baseDamage)}+${round(b.attackContribution)}=${round(b.rawDamage)}` +
    ` ×${percent(b.defenseMultiplier)}(방어 ${round(b.targetDefense)})` +
    ` = ${Math.round(b.finalDamage)}`
  );
}

// 자기 자원·능력치·배율 — 늘 눈앞에 있는 자리 (04 hud.self).
// 배율은 1 이면 걸린 것이 없다는 뜻이므로 굳이 줄을 만들지 않는다 — 다르면 그때 드러난다.
export function selfPanel(snapshot: GameViewSnapshot): SceneSelf | undefined {
  const value = (id: string) => snapshot.hud.find((h) => h.id === id)?.value;
  const health = value('self.hp');
  const energy = value('self.cp');
  if (typeof health !== 'number' || typeof energy !== 'number') return undefined;

  const healthMaximum = Number(value('self.hpMax') ?? 0);
  const energyMaximum = Number(value('self.cpMax') ?? 0);
  const moveModeCode = String(value('self.moveMode') ?? 'walk');

  const lines: string[] = [
    // C010 — 내가 얼마나 세게 때리고 얼마나 덜 맞는가. 값을 바꾸면 여기서 바로 확인된다.
    `공격력 ${round(Number(value('self.combat.attack') ?? 0))}` +
      ` · 방어력 ${round(Number(value('self.combat.defense') ?? 0))}` +
      ` (받는 피해 ${percent(Number(value('self.combat.defenseMultiplier') ?? 1))})`,
    `이동 속도 ${round(Number(value('self.tempo.moveSpeed') ?? 0))}` +
      ` · 달리기 ×${round(Number(value('self.tempo.runSpeedMultiplier') ?? 1))}`,
    `공격 속도 ×${round(Number(value('self.tempo.actionSpeed') ?? 1))}`,
  ];

  const modifiers: Array<[string, number]> = [
    ['기력 충전', Number(value('self.modifier.cpCharge') ?? 1)],
    ['기력 소비', Number(value('self.modifier.cpConsume') ?? 1)],
    ['이동 속도', Number(value('self.modifier.moveSpeed') ?? 1)],
    ['공격 속도', Number(value('self.modifier.actionSpeed') ?? 1)],
  ];
  for (const [label, factor] of modifiers) {
    if (factor !== 1) lines.push(`${label} 배율 ×${round(factor)}`);
  }

  return {
    health: Math.round(health),
    healthMaximum: Math.round(healthMaximum),
    healthRatio: healthMaximum > 0 ? Math.max(0, Math.min(1, health / healthMaximum)) : 0,
    energy: Math.round(energy),
    energyMaximum: Math.round(energyMaximum),
    energyRatio: energyMaximum > 0 ? Math.max(0, Math.min(1, energy / energyMaximum)) : 0,
    downed: value('self.downed') === true,
    moveMode: codeText(moveModeCode),
    moveModeCode,
    lines,
  };
}

// hud.self.* 는 self 패널이 가져간다 — 일반 위젯 줄로 또 그리면 같은 값이 두 번 보인다.
export function isSelfHudId(id: string): boolean {
  return id.startsWith('self.');
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

// 비율은 백분율로 읽는 편이 빠르다 — 0.769 보다 77% 가 먼저 이해된다 (C010).
function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
