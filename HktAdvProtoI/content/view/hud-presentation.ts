// HUD Presentation — HUD 항목 id 의 표시(라벨·아이콘·토스트)를 결정한다
// (결정 Layer 데이터). id 당 단일 항목 — 미등록 id 는 id 그대로 표시된다.
//
// C027 CHANGED — 여기 남은 것은 **내 몸의 상태뿐이다** (spec R5 · SPEC-006).
// 세계의 사실(깊이 · 안전한 이유 · 압력)은 판이 진다 — 같은 사실이 두 자리에 적히지 않는다.
// 그 셋의 이름표는 판의 표(target-frame-presentation 의 PLACE_ROW_LABELS)가 이미 갖고 있다.

import { BIO_ORE, ORE_EATER_MOLT } from '../regions/index';
import { codeText } from './code-text';

export interface HudPresentation {
  label: string;
  icon?: string;
  celebrateGain?: boolean;
  format?: (value: number | boolean | string) => string; // 값 표시 형식
}

const HUD: Record<string, HudPresentation> = {
  // 지닌 재료 (C011) — **가진 것에만 자리가 있다** (spec SPEC-010: 0 을 지어내지 않는다).
  // 세계가 그 줄을 싣지 않으면 여기 항목이 있어도 화면에 서지 않는다.
  //
  // 아이콘이 없다 — 재료 표식을 만들지 않는다 (Play 확정 8 · spec SPEC-008). 이름표는
  // code-text 의 재료 이름 그대로다: 같은 재료가 판과 HUD 에서 다르게 불리면 그것이
  // 두 가지로 읽힌다. 캤을 때 뜨는 것(celebrateGain)은 광맥 줄의 어법 그대로 살린다 —
  // 손에 무엇이 들어왔는지가 그 순간에 읽혀야 한다 (Observable Result ⑦).
  [`inventory.${BIO_ORE}`]: { label: codeText(BIO_ORE), celebrateGain: true },
  [`inventory.${ORE_EATER_MOLT}`]: { label: codeText(ORE_EATER_MOLT), celebrateGain: true },
  'tool.hasMiningTool': { label: '곡괭이' },
  'player.action': { label: '행동' },
  'world.time': { label: '세계 시간', format: (v) => `${Math.floor(Number(v))}s` },
  // 함께 보고 있는 사람의 수 — 나를 포함한다.
  'observers.present': { label: '함께', icon: '👥', format: (v) => `${Number(v)}명` },
};

export function hudPresentation(id: string): HudPresentation {
  return HUD[id] ?? { label: id };
}
