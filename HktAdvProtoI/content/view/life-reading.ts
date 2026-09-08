// Life Reading — 탄생지의 **지금** 을 화면이 읽는 자리 (C022 ADDED).
//
// resource-reading.ts 의 형제다. 세계가 싣는 것은 그 탄생지의 state(phase 의 소문자)와
// **지금 모자란 조건 코드들** 뿐이고(spec Observable), 그것이 세계에 남기는 나머지 —
// 서지 않는 자락 · 한 단계 옅어진 흙 — 은 투영되지 않는다: 관찰자가 자기 content/regions 와
// 실려 온 값으로 스스로 얻는다. 땅을 스스로 컴파일해 그리는 C005~C007 · 흔적을 스스로 얻는
// C011 · 원천의 지금을 스스로 잇는 C012~C013 의 규율 그대로다.
//
// **없는 것을 지어내지 않는다** — 결속이 얼마나 찼는지도, 언제 태어나는지도, 무엇이 태어나려
// 하는지도, 지금 비가 오는지도 실려 오지 않는다. 화면이 아는 것은 phase 하나와 모자란 조건의
// 코드들뿐이고, 차 있는 조건은 아예 실리지 않는다 (모자란 것만이 말할 것이다).
//
// **세계의 판정과 같은 규칙이어야 한다** — 자락이 서는가 · 얼마나 짙은가를 세계
// (world/semantic/resource.ts 의 traceStrengthAt)와 여기가 다르게 재면 판이 말하는 것과
// 발밑이 어긋난다. 그래서 그 잣대는 아래 lifeTraceLevelOfArea 한 자리에 있다.

import type { GameViewSnapshot } from '../protocol/gameview';
import {
  FORM_CARCASS_BLOOM,
  FORM_ROOT_CLUTCH,
  FORM_ROOT_EGGS,
  regionSpec,
  type LifeSiteSpec,
  type LifeSiteTrace,
} from '../regions/index';

/** 탄생지의 Semantic Role — 봉투에서 탄생지를 가려내는 유일한 값이다 (role-presentation 의 키와 같다) */
export const LIFE_SITE_ROLE = 'life-site';

/** 결속 중인 탄생지의 state 코드 — 봉투가 싣고 오는 값 그대로다 (code-text 의 phase 문구와 같은 코드) */
const PHASE_BINDING = 'binding';

/** 멎어 있는 탄생지의 state 코드 — 모르는 탄생지를 이 값으로 읽는다 (아래 DEFAULT_OBSERVED) */
const PHASE_DORMANT = 'dormant';

/**
 * 태어난 그 한 tick 의 state 코드 (C023 ADDED).
 *
 * **사람이 볼 일이 드물다** — 다섯이 함께 움직이는 그 순간이 BORN 이고 곧 SPENT 가 된다.
 * 그래도 그림과 문구가 있는 것은, 그 한 tick 이 실려 온 화면에서 코드가 그대로 뜨거나
 * 그림이 비는 일이 없어야 하기 때문이다 (모르는 것은 지어내지 않되 아는 것은 그린다).
 */
const PHASE_BORN = 'born';

/**
 * 터진 채 남아 있는 state 코드 (C023 ADDED) — **눈에 보이는 "터졌다" 가 이것이다.**
 *
 * 눈으로 갈려야 하는 것은 phase 넷이 아니라 셋이다 (맺힌 채 멎음 · 속에서 맺힘 · 터진 것).
 * BORN 은 한 tick 이라 스쳐 가고, 관찰자가 걸어와 보는 것은 언제나 이 자리다.
 */
const PHASE_SPENT = 'spent';

/**
 * 관찰된 그 탄생지의 지금.
 *
 * 원천의 ObservedSource 와 같은 갈래다 — 봉투가 실은 것만 담고, 실리지 않은 자리는
 * 만들지 않는다. `conditions` 는 **모자란 것들**이다: 차 있는 조건은 세계가 싣지 않는다.
 */
export interface ObservedLifeSite {
  phase: string;
  /** 지금 모자란 조건 코드들 — 하나도 없으면 빈 목록이다 (봉투에 자리가 없다) */
  conditions: readonly string[];
}

/** 탄생지 id → 지금. 봉투에 없는 탄생지는 **자리 자체가 없다** (모름을 결속으로 읽지 않는다) */
export type LifeSitePhases = Readonly<Record<string, ObservedLifeSite>>;

/** 아무것도 실려 오지 않았을 때 — 모든 탄생지가 "모름" 이고, 그러면 아무것도 달라지지 않는다 */
export const NO_LIFE_SITES: LifeSitePhases = {};

/**
 * 모르는 탄생지를 읽는 값 — **세계가 처음 놓은 자리 그대로**다.
 *
 * 결속으로 읽지 않고(phase dormant), 모자란 것이 없는 것으로 읽는다(빈 목록). 지어낸 값이
 * 아니라 그 탄생지가 관찰되기 전의 배치 그대로이므로, 아직 아무것도 실려 오지 않은 화면은
 * C021 의 것과 한 픽셀도 다르지 않다 (원천의 DEFAULT_OBSERVED 와 같은 규율).
 */
const DEFAULT_OBSERVED: ObservedLifeSite = {
  phase: PHASE_DORMANT,
  conditions: [],
};

/**
 * 관찰 결과가 싣고 온 탄생지들의 표.
 *
 * 관찰은 방으로 잘리고 밤에는 멀리 있는 것이 실리지 않으므로(원천과 같은 자름) 이 표에는
 * **지금 보이는 것만** 있다. 실리지 않은 것에는 없는 것을 지어내지 않는다.
 */
export function lifeSitePhases(snapshot: GameViewSnapshot): LifeSitePhases {
  const sites: Record<string, ObservedLifeSite> = {};
  for (const entity of snapshot.entities) {
    if (entity.role !== LIFE_SITE_ROLE) continue;
    sites[entity.id] = {
      phase: entity.state,
      // 걸린 것이 없으면 봉투에 자리가 없다 — 그대로 빈 목록으로 읽는다 (C012 의 어법)
      conditions: entity.conditions ?? [],
    };
  }
  return sites;
}

/**
 * RULE-LIFE-SITE-PHASE-001 (C022 R4) — 탄생지가 그 자락에 하는 일.
 *
 * 자락의 단계를 여기서 **다시 재지 않는다** — 데이터가 밝힌 단계(level)를 받아 탄생지의
 * 지금이 그것을 어떻게 덮는지만 답한다. 어느 탄생지의 자락도 아닌 area 는 받은 값 그대로다
 * (방 바닥에 깔린 흔적 · 원천 둘레는 한 값도 달라지지 않는다).
 *
 * 잣대 둘 — 세계 쪽(world/semantic/resource.ts)과 **같은 것**이어야 한다.
 *   ① 그 자락이 가려지는 조건(hiddenWhen)이 지금 모자란 것들에 들어 있으면 **서지 않는다**(0).
 *      부푼 균사는 뻗어 올 것이 있어야 서기 때문이다.
 *   ② 결속하는 동안(BINDING) 빨리는 자락(fadesWhileBinding)은 **한 단계 옅다** — 재료가
 *      알집으로 가고 있다. 0 아래로는 내려가지 않는다 (고갈된 원천 둘레와 같은 어법).
 *
 * C023 CHANGED — 잣대가 셋이 되었다. 밝혀만 두던 `traces.after` 가 일을 한다:
 *   ③ 태어난 뒤의 자락은 **SPENT 인 동안에만** 선다 (그 밖에는 0). 전조가 "늘 있다가
 *      가려지는 것" 이라면 이것은 "없다가 그동안만 서는 것" 이다 — 터진 자리에 남은
 *      붉은 가루이고, 되돌아오면 자리와 함께 사라진다 (spec SPEC-004 경계 ③).
 * 세계 쪽 lifeTraceOverlayIn 과 **같은 잣대**여야 한다 — 갈리면 바닥에 그려진 색과
 * 판이 말하는 단계가 어긋난다 (이 파일 머리의 규율 그대로).
 */
export function lifeTraceLevelOfArea(
  regionId: string,
  areaId: string,
  level: number,
  lives: LifeSitePhases,
): number {
  if (level <= 0) return 0;
  for (const site of lifeSitesOf(regionId)) {
    const trace = traceOf(site, areaId);
    if (trace) {
      const observed = observedLifeSite(lives, site.id);
      // ① 가려진 자락은 서지 않는다 — 모자란 것에 그 코드가 들어 있으면 흙도 그것을 말하지 않는다
      if (trace.hiddenWhen !== undefined && observed.conditions.includes(trace.hiddenWhen)) {
        return 0;
      }
      // ② 결속하는 동안만 옅어진다 — 멎어 있는 동안은 데이터 그대로다
      return trace.fadesWhileBinding && observed.phase === PHASE_BINDING
        ? Math.max(0, level - 1)
        : level;
    }
    // ③ 태어난 **뒤**의 자락 (C023 ADDED) — 터진 자리에 서는 붉은 가루다.
    //    **SPENT 인 동안에만 선다**: 아직 태어나지 않았을 때도, 되돌아온 뒤에도 그 자리에
    //    아무것도 없다 (spec SPEC-004 경계 ③). 전조(before)와 갈리는 자리가 여기다 —
    //    전조는 늘 있다가 조건에 따라 가려지고, 이것은 없다가 그동안만 선다.
    if (isAfterTrace(site, areaId)) {
      return observedLifeSite(lives, site.id).phase === PHASE_SPENT ? level : 0;
    }
    // 이 탄생지의 자락이 아니다 — 다음 탄생지를 본다 (어느 것의 것도 아니면 데이터 그대로다)
  }
  return level;
}

/** 실려 온 그 탄생지의 지금 — 실려 오지 않았으면 처음 놓인 그대로 읽는다 */
export function observedLifeSite(lives: LifeSitePhases, id: string): ObservedLifeSite {
  return lives[id] ?? DEFAULT_OBSERVED;
}

/**
 * 그 탄생지의 지금을 부르는 **문구 코드** — 형태(kind)와 phase 가 함께 고른다.
 *
 * 세계가 싣는 phase 코드(dormant · binding)는 **방의 위상이 쓰는 코드와 같은 글자**다
 * (region.disturbance.phase 의 dormant). 같은 글자가 다른 것을 뜻하는 자리이므로 문구를
 * 코드 하나로 두면 알집이 "방이 잠들어 있다" 라고 말하게 된다 — 어느 말을 할지는 세계가
 * 아니라 **화면이 정하는 것**이고(핵심 원칙 2), 그 결정이 이 표다.
 *
 * 표에 없는 형태는 실려 온 코드 그대로 지난다 — 원천도 사람도 여기를 지나며 한 글자도
 * 달라지지 않는다 (미등록은 지어내지 않는다는 폴백 규칙 그대로).
 */
export function lifeSiteStateCode(kind: string | undefined, state: string): string {
  if (kind === undefined) return state;
  return LIFE_SITE_STATE_CODES[kind]?.[state] ?? state;
}

/**
 * 형태 × phase → 문구 코드 (C022 — 알집 하나뿐이었다. C023 CHANGED — 형태가 둘 · phase 가 넷.
 * C024 CHANGED — 형태가 셋).
 *
 * **탄생지가 셋이 되어도 표에 한 줄이 늘 뿐이다** (원천이 넷에서 열일곱이 된 그 어법 그대로).
 * 형태마다 자기 말을 갖는 것은 SPEC-008 이 요구하는 것이다 — 큰 알집과 작은 붉은 점은
 * 다른 이름 · 다른 그림 · 다른 말이고, 같은 phase 라도 무엇이 맺히고 무엇이 터졌는지가
 * 갈려 읽혀야 한다. **어느 쪽이 결속이고 어느 쪽이 계승인지는 여기서도 말하지 않는다**
 * (spec Observable "투영하지 않는 것") — 갈리는 것은 생김새이지 방식의 이름이 아니다.
 *
 * 셋째(사체의 흰 것)도 **방식의 이름을 말하지 않는다.** 그 말이 '맺힌다' 가 아니라
 * '덮어 간다' 인 것은 변성형이라고 적은 것이 아니라 **눈에 보이는 것이 그렇기 때문**이다 —
 * 뿌리의 둘은 없던 것이 맺히고, 이것은 있던 것 위로 다른 것이 번진다.
 */
const LIFE_SITE_STATE_CODES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  [FORM_ROOT_CLUTCH]: {
    [PHASE_DORMANT]: 'clutch-dormant',
    [PHASE_BINDING]: 'clutch-binding',
    [PHASE_BORN]: 'clutch-born',
    [PHASE_SPENT]: 'clutch-spent',
  },
  [FORM_ROOT_EGGS]: {
    [PHASE_DORMANT]: 'eggs-dormant',
    [PHASE_BINDING]: 'eggs-binding',
    [PHASE_BORN]: 'eggs-born',
    [PHASE_SPENT]: 'eggs-spent',
  },
  [FORM_CARCASS_BLOOM]: {
    [PHASE_DORMANT]: 'bloom-dormant',
    [PHASE_BINDING]: 'bloom-binding',
    [PHASE_BORN]: 'bloom-born',
    [PHASE_SPENT]: 'bloom-spent',
  },
};

// ── 안쪽 ─────────────────────────────────────────────────────────────
//
// content/regions 의 생명 데이터를 읽는 자리는 아래 둘뿐이다 — 데이터의 형이 바뀌면
// 고칠 곳도 둘이다 (원천을 읽는 resource-reading 의 sourcesOf · siteOfOp 와 같은 어법).

/** 그 방이 밝힌 탄생지들 — 밝히지 않은 방(지금은 거목의 방을 뺀 전부)은 빈 목록이다 */
function lifeSitesOf(regionId: string): readonly LifeSiteSpec[] {
  return regionSpec(regionId)?.ecology?.lifeFormation ?? [];
}

/** 그 자락이 이 탄생지가 밝힌 전조인가 — 아니면 없다 (원천의 siteOfOp 와 같은 어법) */
function traceOf(site: LifeSiteSpec, areaId: string): LifeSiteTrace | undefined {
  return site.traces.before.find((trace) => trace.op === areaId);
}

/**
 * 그 자락이 이 탄생지가 태어난 **뒤**에 세우는 것인가 (C023 ADDED).
 *
 * 전조와 달리 밝히는 것이 op id 하나뿐이므로(조건도 옅어짐도 없다) 목록에 있는지만 본다.
 * 세계 쪽 잣대와 **같은 것**이어야 한다 — 화면이 세우는 자락과 판이 말하는 단계가
 * 갈리면 둘 중 하나를 믿을 수 없다 (이 파일 머리의 규율).
 */
function isAfterTrace(site: LifeSiteSpec, areaId: string): boolean {
  return site.traces.after.includes(areaId);
}
