// Combat Presentation (C007) — 전투 관찰값의 표시를 결정한다 (결정 Layer 데이터).
//
// 세계는 이름·생명·기력·능력치·배율·타격 결과를 의미 그대로 보낸다.
// 무엇을 늘 띄우고, 무엇을 어떤 형식으로 쓰고, 무엇을 켜야 보이게 할지는 여기서 정한다.
//
// 세계가 모든 속성을 보낸다고 해서 전부 늘 띄우지는 않는다 (04 entityHud.notShownByDefault) —
// 감춘 것이 아니라 몸 위를 채우지 않기 위한 표시 선택이며, 속성 관찰을 켜면 그 자리에서 펼쳐진다.

import type { EntityView, GameViewSnapshot, StrikeEventView } from '../../../protocol/gameview';
import type { SceneNameplate, SceneSelf, SceneStrike } from '../../../engine/view-kernel/scene/scene-state';
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
    // C010 → C012 — 능력이 방식별로 갈렸다. 방어는 체감식이라 수치만으로는 효과를
    // 알 수 없으므로 남는 비율을 함께 쓴다. 두 줄로 나눈 것은 고를 때 견주는 축이
    // 공격/방어가 아니라 **물리/오라** 이기 때문이다.
    // C013 — 방어 뒤에 "그런데 나에게는 얼마로 읽히는가" 가 붙는다.
    // 두 값이 같으면(내 관통이 0 이거나 상대 방어가 0) 붙지 않는다 — 같다는 것은
    // versusText 가 없는 것으로 읽힌다. 걷힌 값을 여기서 곱해 만들지 않는다
    // (04 versusObserver.meaning · DC-WORLD-OWNS-THE-SURFACE-LIST).
    `물리 공격 ${round(a.combatStats.physicalAttack)}` +
      ` · 물리 방어 ${round(a.combatStats.armor)}` +
      ` (받는 피해 ${percent(a.combatStats.armorMultiplier)})` +
      versusText(a.combatStats.armor, a.versusObserver.armor, a.versusObserver.armorMultiplier),
    `오라 공격 ${round(a.combatStats.auraAttack)}` +
      ` · 오라 방어 ${round(a.combatStats.resistance)}` +
      ` (받는 피해 ${percent(a.combatStats.resistanceMultiplier)})` +
      versusText(
        a.combatStats.resistance,
        a.versusObserver.resistance,
        a.versusObserver.resistanceMultiplier,
      ),
    // C013 — 이 존재가 지닌 관통. 상대의 것도 본다 — 저쪽이 내 방어를 얼마나
    // 무력화하는지는 내가 얼마나 위험한지를 아는 일이다.
    `관통 물리 ${round(a.combatStats.armorPenetration)}` +
      ` · 오라 ${round(a.combatStats.resistancePenetration)}`,
    // C012 — 어느 쪽이 더 단단한지는 **세계가 판정한 값**이다.
    // 여기서 두 수치를 비교해 만들어내지 않는다 (04 defenseShape.meaning).
    `약점 ${codeText(a.defenseShape)}`,
    `배율 충전×${round(a.modifiers.energyCharge)} 소비×${round(a.modifiers.energyConsume)}`,
    `배율 이동×${round(a.modifiers.moveSpeed)} 공속×${round(a.modifiers.actionSpeed)}`,
    // C011 — 막기는 행동(state)과 별개라서 몸의 상태 표시로는 드러나지 않는다.
    // 막으며 걷는 존재는 state 가 move 이면서 막고 있다.
    `막기 ${guardText(a.guard) ?? '없음'}`,
  ];
}

// 이 방어가 보는 이의 관통에게 얼마로 읽히는가 (C013) — 세계가 계산해 보낸 값이다.
// 원래 값과 같으면 아무 말도 하지 않는다. 통하지 않았다는 것은 화살표가 없는 것으로 읽힌다.
function versusText(own: number, versus: number, versusMultiplier: number): string {
  if (versus === own) return '';
  return ` → 나에게 ${round(versus)} (${percent(versusMultiplier)})`;
}

// 막기 상태의 문구 (C011) — 막지도 무너지지도 않았으면 쓸 말이 없다.
// broken 을 먼저 본다: 무너진 순간에는 guarding 이 이미 거짓이고,
// "왜 다시 못 드는가" 가 그 순간 가장 알고 싶은 것이다.
function guardText(guard: { guarding: boolean; broken: boolean }): string | undefined {
  if (guard.broken) return '무너짐';
  if (guard.guarding) return '막는 중';
  return undefined;
}

// 타격 결과 — 얼마가 깎였는지 숫자로 읽힌다. 고급 스킬의 결과는 크게 그린다.
// 맞은 몸의 그림 크기를 알면 그 몸에서 떠오르게 한다 (모르면 기준값).
//
// C010 — 세계는 그 숫자가 나온 경위도 함께 보낸다. 늘 띄우면 정작 피해 숫자가 읽히지
// 않으므로, 속성 관찰이 켜진 동안에만 한 줄로 덧붙인다 (detail).
// "왜 이만큼인가" 를 확인하려는 순간은 값을 들여다보는 순간과 같기 때문이다.
// C011 — 막힌·무너진 타격은 관찰이 꺼져 있어도 그 사실을 한 줄 붙인다.
// 이 한 줄이 없으면 화면에는 그냥 작아진 숫자만 남고, 무엇 덕분에 작아졌는지도
// 그 대가로 무엇을 냈는지도 알 수 없다 — 맞바꿨다는 것이 플레이어에게 일어나지 않는다.
export function strikeMark(
  event: StrikeEventView,
  targetSpriteSize?: number,
  inspect = false,
): SceneStrike {
  const guard = event.breakdown.guard;
  const details = [guardLine(event), inspect ? breakdownLine(event) : undefined].filter(
    (line): line is string => line !== undefined,
  );

  return {
    id: `${event.attackerId}->${event.targetId}@${event.since}`,
    position: event.at,
    text: `-${Math.round(event.amount)}`,
    emphasis: event.skill === 'heavy-attack',
    since: event.since,
    anchorHeight: (targetSpriteSize ?? DEFAULT_SPRITE_SIZE) * STRIKE_ANCHOR_RATIO,
    ...(details.length > 0 ? { detail: details.join(' · ') } : {}),
    ...(guard?.broken ? { guard: 'broken' as const } : {}),
    ...(guard?.blocked ? { guard: 'blocked' as const } : {}),
  };
}

// 막기가 한 일 (C011) — 막지 않은 타격에는 없다.
// 막힘은 "막지 않았다면 얼마였는지 → 얼마가 되었는지" 를 함께 쓴다.
// 줄어든 값만 보이면 막기가 일한 것을 알 수 없기 때문이다.
function guardLine(event: StrikeEventView): string | undefined {
  const guard = event.breakdown.guard;
  if (!guard) return undefined;
  if (guard.broken) return '방어 무너짐';
  return (
    `막음 ${Math.round(event.breakdown.finalDamage)}→${Math.round(event.breakdown.appliedDamage)}` +
    ` · 기력 -${Math.round(guard.cpPaid)}`
  );
}

// 한 방의 경위를 한 줄로 — 어떤 방식으로 쳤고, 스킬이 얼마 + 그 방식의 공격 능력이
// 얼마를 보태 = 얼마였고, 그 방식에 대응하는 상대 방어가 몇 할로 줄여 = 얼마가 되었다.
// C012 — 고른 능력의 **이름**이 함께 나온다. 값만 있으면 왜 이쪽으로 계산되었는지
// 알 수 없다 (04 strikeEvents.meaning).
function breakdownLine(event: StrikeEventView): string {
  const b = event.breakdown;
  return (
    `${codeText(b.damageType)} · ` +
    `${round(b.baseDamage)}+${round(b.attackContribution)}=${round(b.rawDamage)}` +
    ` (${codeText(b.offenseStat.name)} ${round(b.offenseStat.value)})` +
    ` ×${percent(b.defenseMultiplier)}(${defenseText(b)})` +
    ` = ${Math.round(b.finalDamage)}`
  );
}

// 방어가 어떻게 읽혔는가 (C013) — 걷히기 전 · 작용한 관통 · 걷힌 뒤 세 값을 함께 쓴다.
// 관통이 0 이어도 세 값을 모두 쓴다. `armor 50 · 관통 0 → 50` 이 보이는 것이
// "이 상대에게는 통하지 않았다" 의 관찰이며, 항목을 감추면 그 사실을 볼 수 없다
// (04 strikeEvents.meaning). 걷힌 뒤 값이 감쇄율의 근거다 — 걷히기 전 값으로 검산하면 어긋난다.
function defenseText(b: StrikeEventView['breakdown']): string {
  return (
    `${codeText(b.defenseStat.name)} ${round(b.defenseStat.value)}` +
    ` · 관통 ${round(b.penetrationStat.value)} → ${round(b.effectiveDefense)}`
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
    // C010 → C012 — 내가 어느 쪽으로 더 세게 때리고 어느 쪽으로 덜 맞는가.
    // 고르는 일은 상대의 방어와 내 공격 능력을 함께 보는 일이므로 둘 다 눈앞에 둔다.
    `물리 공격 ${round(Number(value('self.combat.physicalAttack') ?? 0))}` +
      ` · 물리 방어 ${round(Number(value('self.combat.armor') ?? 0))}` +
      ` (받는 피해 ${percent(Number(value('self.combat.armorMultiplier') ?? 1))})`,
    `오라 공격 ${round(Number(value('self.combat.auraAttack') ?? 0))}` +
      ` · 오라 방어 ${round(Number(value('self.combat.resistance') ?? 0))}` +
      ` (받는 피해 ${percent(Number(value('self.combat.resistanceMultiplier') ?? 1))})`,
    // C013 — 내 관통. 0 인 쪽도 쓴다. 없다는 것을 아는 것이
    // "그쪽으로는 벽을 깎을 수 없다" 를 아는 것이다 (04 hud.self.combatStats.meaning).
    `관통 물리 ${round(Number(value('self.combat.armorPenetration') ?? 0))}` +
      ` · 오라 ${round(Number(value('self.combat.resistancePenetration') ?? 0))}`,
    // 상대도 같은 규칙으로 나를 고른다 — 내 약점도 세계가 판정해 보낸다
    `내 약점 ${codeText(String(value('self.combat.defenseShape') ?? 'even'))}`,
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

  // C011 — 막기 상태는 늘 눈앞에 둔다 (04 hud.self.guard.meaning).
  const guarding = value('self.guard.guarding') === true;
  const guardBroken = value('self.guard.broken') === true;
  const stance = guardText({ guarding, broken: guardBroken });

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
    guard: { guarding, broken: guardBroken, ...(stance ? { text: stance } : {}) },
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
