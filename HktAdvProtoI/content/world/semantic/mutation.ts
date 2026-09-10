// World Semantic — **지금 그것인 Transition 에 op 의 이름을 붙인다** (C036 ADDED · spec SPEC-006 ·
// L2-World-Foundation G6 · §4.2 Mutation op 표).
//
// **코드를 옮기지 않는다 — 이름만 붙인다.** 이 파일은 아무것도 굴리지 않고 아무것도 판정하지
// 않으며 어느 규칙도 이 표를 읽지 않는다. 여기 있는 것은 "이미 세계에 있는 전이 다섯 군이
// §4.2 의 어느 op 인가" 하나뿐이고, 읽는 곳은 도구(검사 ㊺ 의 op 어휘 대조 · 단위 시험)뿐이다.
//
// 왜 표가 필요한가 — 기회의 `outcomes.world` 가 op 의 이름으로 적히기 때문이다 (SPEC-002 ·
// SPEC-003). 그 이름이 **이미 세계에서 일어나고 있는 일**을 가리키는지, 아니면 지어낸 말인지를
// 사람이 한 자리에서 볼 수 있어야 한다. 이 표가 그 자리다.
//
// 지키는 것.
//   ① **한 줄은 주장이 아니라 인용이다** — `ruleId` 가 그 전이가 사는 자리를 가리키고,
//      grep 하면 그 규칙 머리의 Transition 절이 나온다. 표가 규칙보다 앞서지 않는다.
//   ② **모든 줄의 (group, op) 는 `MUTATION_OPS` 안이다** — 표 밖의 이름을 여기서 짓지 않는다
//      (단위 시험이 잰다).
//   ③ **없는 군은 적지 않는다** — C036 까지 이 세계에 opportunity 군(OPEN · CLOSE · COMPLETE)의
//      전이가 없었다. 없는 것을 채워 다섯을 일곱으로 만들지 않았다.
//
// C037 CHANGED — **여섯째 군이 선다** (opportunity). 기회의 열림과 닫힘과 완료가 이 Cycle 에
// 실제로 일어나기 때문이다. 다만 앞의 다섯과 갈리는 것이 하나 있다: 이 셋은 **저장되는 State 의
// 전이가 아니라 유도**다 (RULE-OPPORTUNITY-OPEN-001 · 문의 활성 CONNECT · DISCONNECT 이 매 tick
// 유도되는 그 어법 그대로). 그래도 표에 서는 이유는 같다 — 세계에 실제로 일어나는 일이고,
// 그 이름이 무엇을 가리키는지 사람이 한 자리에서 볼 수 있어야 한다.

import type { MutationGroup, MutationOp } from '../../../engine/world-authoring/opportunity';
import { RULE_CONNECTOR_ACTIVATION, RULE_MINE_COMPLETE } from '../../protocol/semantic-id';

/**
 * 한 줄 — 지금 그것인 전이 하나와 그것의 op 이름.
 *
 * `ruleId` 는 `content/protocol/semantic-id.ts` 의 RULE id 이거나, 그 id 가 아직 서지 않은
 * 규칙이면 그 규칙 파일 머리의 `RULE-*` 글자 그대로다 (세계 과정들이 그렇다 — grep 이 곧
 * 매핑 표다). `what` 은 그 전이가 무엇을 바꾸는가를 한 마디로 적은 것이고 판정하지 않는다.
 */
export interface MutationBinding {
  group: MutationGroup;
  op: MutationOp;
  ruleId: string;
  what: string;
}

/** 아직 semantic-id 에 서지 않은 규칙들 — 파일 머리의 글자 그대로다 (지키는 것 ①) */
const RULE_DISTURBANCE = 'RULE-DISTURBANCE-001';
const RULE_DISTURBANCE_DECAY = 'RULE-DISTURBANCE-DECAY-001';
const RULE_MAZE_CONNECTION = 'RULE-MAZE-CONNECTION-001';
const RULE_SOURCE_RECOVERY = 'RULE-SOURCE-RECOVERY-001';
const RULE_RECOVERY_SPEED = 'RULE-RECOVERY-SPEED-001';
const RULE_OPPORTUNITY_OPEN = 'RULE-OPPORTUNITY-OPEN-001';

/**
 * 지금 이 세계에 있는 전이 **여섯 군**과 그 op 이름 (C036 spec SPEC-006 · C037 CHANGED).
 *
 * 차례는 §4.2 표의 군 차례다 (property → entity → relation → process → opportunity →
 * ownership) — 두 번 읽어도 글자까지 같다.
 */
export const MUTATION_BINDINGS: readonly MutationBinding[] = [
  // ── ① 소란 (property) ──
  // 한 일이 그 방의 소란이 된다. 값이 오르고(ADD) 임계 위로는 오르지 않는다(CLAMP) —
  // 두 op 이 `addDisturbance` 한 줄 안에 함께 산다 (Math.min(임계, 값 + 양)).
  {
    group: 'property',
    op: 'ADD',
    ruleId: RULE_DISTURBANCE,
    what: '그 방의 소란 값이 한 일만큼 오른다',
  },
  {
    group: 'property',
    op: 'CLAMP',
    ruleId: RULE_DISTURBANCE,
    what: '소란은 임계 위로 오르지 않는다',
  },
  {
    group: 'property',
    op: 'ADD',
    ruleId: RULE_DISTURBANCE_DECAY,
    what: '가라앉는 철에는 소란이 흐른 시간만큼 준다',
  },
  {
    group: 'property',
    op: 'CLAMP',
    ruleId: RULE_DISTURBANCE_DECAY,
    what: '소란은 0 아래로 내리지 않는다',
  },
  // ── ② 원천의 마디 (entity) ──
  // 원천의 phase 는 available · depleted · recovering 셋 사이를 옮겨 간다. 옮기는 자리는 둘이다 —
  // 다 캐면 고갈되고(채취), 되돌아오면 다시 선다(세계 과정).
  {
    group: 'entity',
    op: 'CHANGE_STATE',
    ruleId: RULE_MINE_COMPLETE,
    what: '다 캔 원천의 phase 가 고갈이 된다',
  },
  {
    group: 'entity',
    op: 'CHANGE_STATE',
    ruleId: RULE_SOURCE_RECOVERY,
    what: '되돌아오는 원천의 phase 가 되돌아옴 · 다시 섬으로 옮겨 간다',
  },
  // ── ③ 문의 활성 (relation) ──
  // 방과 방을 잇는 것이 이어지고 끊긴다. **저장되는 State 가 아니다** — 그 방의 지금 패턴과
  // 세계의 시각에서 매 tick 유도되고(RULE-CONNECTOR-ACTIVATION-001), 패턴을 옮기는 것은 방의
  // 규칙이다(RULE-MAZE-CONNECTION-001). 그래서 두 줄이 한 짝으로 선다.
  {
    group: 'relation',
    op: 'CONNECT',
    ruleId: RULE_CONNECTOR_ACTIVATION,
    what: '요구가 서면 그 문이 지금 열린 것으로 읽힌다',
  },
  {
    group: 'relation',
    op: 'DISCONNECT',
    ruleId: RULE_CONNECTOR_ACTIVATION,
    what: '요구가 서지 않으면 그 문이 지금 잠긴 것으로 읽힌다',
  },
  {
    group: 'relation',
    op: 'CONNECT',
    ruleId: RULE_MAZE_CONNECTION,
    what: '방이 재배열되면 그 패턴이 여는 통로가 이어진다',
  },
  {
    group: 'relation',
    op: 'DISCONNECT',
    ruleId: RULE_MAZE_CONNECTION,
    what: '방이 재배열되면 그 패턴이 닫는 통로가 끊긴다',
  },
  // ── ④ 되돌아옴 (process) ──
  // 되돌아옴은 이 세계에서 **과정**이다 — 시작하고 · 멎고 · 나아가고 · 되돌려진다.
  // 넷이 다 지금 있다: 다 캐면 시작하고, 조건이 걸리면 멎고(배속 0 도 멎음이다),
  // 매 tick 나아가고, 다 차면 진행이 0 으로 되돌려진다.
  {
    group: 'process',
    op: 'START',
    ruleId: RULE_MINE_COMPLETE,
    what: '다 캔 원천의 되돌아옴이 시작된다',
  },
  {
    group: 'process',
    op: 'STOP',
    ruleId: RULE_SOURCE_RECOVERY,
    what: '멎게 하는 조건이 걸린 원천의 되돌아옴이 나아가지 않는다',
  },
  {
    group: 'process',
    op: 'ADVANCE',
    ruleId: RULE_RECOVERY_SPEED,
    what: '흐른 시간이 철과 개체군의 배속으로 진행에 실린다',
  },
  {
    group: 'process',
    op: 'RESET',
    ruleId: RULE_SOURCE_RECOVERY,
    what: '다 되돌아온 원천의 진행과 캔 셈이 0 으로 돌아간다',
  },
  // ── ⑤ 기회의 열림 (opportunity) — C037 ADDED ──
  // 세 op 이 다 선다. OPEN · CLOSE 는 availability 의 판정 셋에서 유도되고(참이면 열림 ·
  // 거짓이면 닫힘 · 판정 불가는 열지 않는다), COMPLETE 는 다 캔 그 순간이다 — 그 기회가
  // 내민 것을 붙잡은 자리이므로 채취의 완료와 **같은 전이**이고 원인이 하나다.
  {
    group: 'opportunity',
    op: 'OPEN',
    ruleId: RULE_OPPORTUNITY_OPEN,
    what: 'availability 가 참인 기회는 지금 열려 있는 것으로 읽힌다',
  },
  {
    group: 'opportunity',
    op: 'CLOSE',
    ruleId: RULE_OPPORTUNITY_OPEN,
    what: 'availability 가 참이 아닌 기회는 열려 있지 않은 것으로 읽힌다',
  },
  {
    group: 'opportunity',
    op: 'COMPLETE',
    ruleId: RULE_MINE_COMPLETE,
    what: '다 캔 그 순간 그 기회가 내민 것이 붙잡힌다',
  },
  // ── ⑥ 채취 (ownership) ──
  // 세계의 것이 캔 사람의 것이 된다. 이 세계에서 소유가 옮겨 가는 자리는 여기 하나뿐이다.
  {
    group: 'ownership',
    op: 'GRANT',
    ruleId: RULE_MINE_COMPLETE,
    what: '캔 사람의 소지품에 그 원천의 재료가 하나 는다',
  },
];
