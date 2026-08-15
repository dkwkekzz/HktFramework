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
    // C010 — 막고 있는지와 무너진 여파 안인지 (04 entityHud.shows).
    // 세계가 자세를 싣지 않는 대상(광맥 등)에는 nameplate 자체가 없다.
    guarding: entity.stance?.guarding === true,
    guardBroken: entity.stance?.broken === true,
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
    `방어 ${round(a.defense)}`, // C010
    `자세 ${codeText(entity.stance?.guarding ? 'guard' : 'open')}` +
      (entity.stance?.broken ? ' (무너짐)' : ''), // C010
    `이동 ${codeText(a.moveMode)} · ${round(a.tempoStats.moveSpeed)} ×${round(
      a.tempoStats.runSpeedMultiplier,
    )}`,
    `공속 ×${round(a.tempoStats.actionSpeed)}`,
    `배율 충전×${round(a.modifiers.energyCharge)} 소비×${round(a.modifiers.energyConsume)}`,
    `배율 이동×${round(a.modifiers.moveSpeed)} 공속×${round(a.modifiers.actionSpeed)}`,
  ];
}

// 타격 결과 — 얼마가 깎였는지 숫자로 읽힌다. 고급 스킬의 결과는 크게 그린다.
// 맞은 몸의 그림 크기를 알면 그 몸에서 떠오르게 한다 (모르면 기준값).
export function strikeMark(event: StrikeEventView, targetSpriteSize?: number): SceneStrike {
  const b = event.breakdown;
  return {
    id: `${event.attackerId}->${event.targetId}@${event.since}`,
    position: event.at,
    text: `-${strikeNumber(event.amount)}`,
    // C010 — 최종 숫자가 아니라 그 숫자가 나온 경로를 읽는다 (04 strikeEvents.meaning).
    detail: strikeDetail(event),
    emphasis: event.skill === 'heavy-attack',
    guarded: b?.guarded === true,
    guardBroken: b?.guardBroken === true,
    since: event.since,
    anchorHeight: (targetSpriteSize ?? DEFAULT_SPRITE_SIZE) * STRIKE_ANCHOR_RATIO,
  };
}

// 막아 내면 한 자리 수 아래로 떨어지는 값이 나온다 (2.25 처럼) —
// 반올림해 0 으로 만들면 "막으면 안 아프다" 로 잘못 읽힌다. 작은 값만 소수 한 자리를 남긴다.
function strikeNumber(amount: number): string {
  if (Number.isInteger(amount)) return String(amount);
  return amount < 10 ? amount.toFixed(1) : String(Math.round(amount));
}

/**
 * 그 숫자를 만든 경로 한 줄 (04 strikeEvents.meaning).
 *   막아 냄     20 → 15 · 막음 · 기력 -10
 *   무너짐      20 → 15 · 방어 무너짐
 *   그냥 맞음   20 → 15         (방어력이 걷어낸 것이 있을 때만)
 * 내역이 실리지 않은 관찰 결과(옛 계약)에는 아무것도 만들지 않는다.
 */
function strikeDetail(event: StrikeEventView): string | undefined {
  const b = event.breakdown;
  if (!b) return undefined;

  const parts: string[] = [];
  if (b.base !== b.mitigated) parts.push(`${round(b.base)} → ${round(b.mitigated)}`);
  if (b.guardBroken) parts.push('방어 무너짐');
  else if (b.guarded) parts.push(`막음 · 기력 -${round(b.energyPaid)}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
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
  // C010 — 자세는 늘 눈앞에 있어야 한다. "왜 막기가 안 되지" 로 남지 않게
  // 사유도 같은 자리에서 읽힌다 (04 hud.self.guard.meaning).
  const stanceCode = String(value('self.stance') ?? 'open');
  const guardBroken = value('self.guardBroken') === true;
  const guardFailure = snapshot.interactions.find((i) => i.id === 'guard');

  const lines: string[] = [
    `방어력 ${round(Number(value('self.defense') ?? 0))}`,
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
    stance: codeText(stanceCode),
    stanceCode,
    guarding: stanceCode === 'guard',
    guardBroken,
    ...(guardFailure && !guardFailure.available && guardFailure.reason
      ? { guardUnavailableText: codeText(guardFailure.reason) }
      : {}),
    defense: Number(value('self.defense') ?? 0),
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
