// 관찰 신호 생성기 (기획서 §11 observations, §21 visibleSignals, §23 / Phase-2 §2.6)
//
// 규칙의 `observations` 와 행동의 `visibleSignals` 는 같은 ObservationEffect 형태다.
// emit_signal 효과는 signalId 로 둘 중 하나를 찾아 실행 위치 기준의 ObservationSignal 로 바꾼다.
import type { ObservationSignal } from "../../shared/observation";
import { emitObservationEffect } from "../world/Signals";
import type { ObservationEffect } from "../world/types";
import type { RuleContext } from "./ConditionEvaluator";

/** 규칙 자신의 선언 → 트리거를 일으킨 행동의 선언 순으로 찾는다 */
export function findObservationEffects(ctx: RuleContext, signalId: string): ObservationEffect[] {
  const fromRule = ctx.rule.observations.filter((effect) => effect.signalId === signalId);
  if (fromRule.length > 0) return fromRule;
  if (ctx.actionId === undefined) return [];
  const action = ctx.runtime.index.actions.get(ctx.actionId);
  return (action?.visibleSignals ?? []).filter((effect) => effect.signalId === signalId);
}

export function emitObservation(
  ctx: RuleContext,
  effect: ObservationEffect,
  intensity?: number,
): ObservationSignal | undefined {
  const actorId = ctx.actorId;
  if (actorId === undefined) return undefined;
  const applied: ObservationEffect =
    intensity === undefined ? effect : { ...effect, strength: intensity };
  return emitObservationEffect(ctx.runtime, applied, {
    actorId,
    ...(ctx.targetId !== undefined ? { targetId: ctx.targetId } : {}),
  });
}

/**
 * emit_signal 효과 — 규칙이 선언하지 않은 신호(=행동의 visibleSignals)를 꺼내 쓸 때 필요하다.
 * 규칙 자신의 `observations` 는 규칙이 발동할 때 자동으로 나가므로 여기서 다시 부를 필요가 없다.
 */
export function emitRuleSignal(
  ctx: RuleContext,
  signalId: string,
  intensity?: number,
): ObservationSignal[] {
  const emitted: ObservationSignal[] = [];
  for (const effect of findObservationEffects(ctx, signalId)) {
    const signal = emitObservation(ctx, effect, intensity);
    if (signal !== undefined) emitted.push(signal);
  }
  return emitted;
}
