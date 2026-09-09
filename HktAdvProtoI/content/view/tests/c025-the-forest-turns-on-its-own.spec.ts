// C025 — 새와 포식수의 자락이 떼와 갈린다 · 화면 쪽 검증 시나리오
// (spec Added — View · Observable "투영은 한 항목도 늘지 않는다")
//
// 이 Cycle 이 화면에 더하는 것은 **표의 줄뿐**이다 — 관찰 계약이 한 항목도 늘지 않았고,
// 이번 것들은 이미 실리는 자리로 온다 (presences[].presence 의 코드 · presences[].area 의 자락).
// 그래서 재는 것도 "표가 늘었는가" 하나다. **전체 개수를 세지 않는다** — 이 Cycle 이 더한
// 코드 둘이 저마다 문구와 색을 가지고, 이미 서 있던 것과 갈리는지만 본다.
//
// 재는 것 다섯.
//   ① 문구  — 코드 둘에 사람이 읽을 말이 붙고, 이미 서 있던 떼 · 지나가는 것들과 갈린다
//   ② 침묵  — 그 문구가 값도 상한도 관계도 문턱도 말하지 않는다 (숫자가 한 글자도 없다)
//   ③ 색    — 자락 셋이 저마다의 색을 받고 셋이 서로 갈린다 · 모르는 코드는 이미 있던 색이다
//   ④ 짙기  — 셋이 **한 값**을 함께 쓴다 (겹칠수록 짙다는 화면 문법이 자락마다 갈리지 않는다)
//   ⑤ 그림  — 고른 색이 실제로 지면의 면까지 간다 · 지면에는 여전히 글자도 테두리도 없다
//
// **개체군의 값은 어디에서도 읽지 않는다** — 세계가 싣지 않는다 (spec Observable
// "투영하지 않는 것"). 그래서 이 파일에도 값을 세는 단언이 하나도 없다.

import { describe, expect, it } from 'vitest';
import type { PresenceView } from '../../protocol/gameview';
import { codeText } from '../code-text';
import {
  PRESENCE_AREA_COLOR,
  PRESENCE_AREA_COLORS,
  PRESENCE_AREA_OPACITY,
  PRESENCE_AREA_PROWL_COLOR,
  PRESENCE_AREA_SKY_COLOR,
  PRESENCE_LINE_COLOR,
  presenceAreaColor,
  presenceAreaZones,
} from '../presence-presentation';
import { TRACK_COLOR } from '../track-presentation';
import { surfaceColor } from '../terrain-presentation';
import {
  PRESENCE_BIG_BIRD,
  PRESENCE_ORE_EATER_SWARM,
  PRESENCE_PREDATOR,
  RED_EYE_TREE,
  SURFACE_FLAT,
} from '../../regions/index';

/** 이 Cycle 이 표에 더한 코드 둘 — 이름은 데이터가 소유한다 (여기서 지어내지 않는다) */
const ADDED_PRESENCES = [PRESENCE_BIG_BIRD, PRESENCE_PREDATOR] as const;

/** 이미 서 있던 것들 — 서 있는 떼 하나와 지나가는 것 둘 */
const STANDING_BEFORE = PRESENCE_ORE_EATER_SWARM;
const PASSING = ['sky-whale', 'blind-hunter'] as const;

/** 자락 셋 전부 */
const ALL_AREAS = [STANDING_BEFORE, ...ADDED_PRESENCES] as const;

/** 색 하나의 밝기 — 지면보다 밝은가 어두운가를 재는 데만 쓴다 */
function luminance(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe('C025 — 새와 포식수가 표에 선다', () => {
  // ① 문구 — 코드마다 사람이 읽을 말이 있고, 이미 있던 것들과 갈린다
  it('코드 둘이 사람이 읽을 말을 얻는다 (코드 그대로가 아니다)', () => {
    for (const code of ADDED_PRESENCES) {
      const text = codeText(code);
      expect({ code, isCode: text === code, empty: text.length === 0 }).toEqual({
        code,
        isCode: false,
        empty: false,
      });
    }
  });

  it('서 있는 것 셋과 지나가는 것 둘이 저마다 다른 말을 한다', () => {
    const codes = [...ALL_AREAS, ...PASSING];
    const texts = codes.map((code) => codeText(code));
    expect(new Set(texts).size).toBe(codes.length);
  });

  // ② 침묵 — 문구가 수를 말하지 않는다 (값 · 상한 · 관계 · 문턱은 실리지도 않는다)
  it('문구가 수도 관계도 말하지 않는다', () => {
    for (const code of ADDED_PRESENCES) {
      const text = codeText(code);
      expect({ code, hasDigit: /[0-9]/.test(text) }).toEqual({ code, hasDigit: false });
      // "무엇을 먹는다" · "무엇을 부른다" 를 판이 대신 잇지 않는다 — 관계는 투영되지 않는다
      for (const word of ['먹', '부른', '남기', '늘', '준다']) {
        expect({ code, word, said: text.includes(word) }).toEqual({ code, word, said: false });
      }
    }
  });

  // ③ 색 — 셋이 갈리고, 새 색 체계가 없다
  it('자락 셋이 저마다의 색을 받고 셋이 서로 갈린다', () => {
    const colors = ALL_AREAS.map((code) => presenceAreaColor(code));
    expect(new Set(colors).size).toBe(ALL_AREAS.length);
    for (const code of ALL_AREAS) {
      expect({ code, known: code in PRESENCE_AREA_COLORS }).toEqual({ code, known: true });
    }
  });

  it('새 색 체계를 만들지 않았다 — 이미 이 세계가 쓰던 두 값을 그대로 쓴다', () => {
    // 하늘의 것은 지나가는 것의 선과 같은 대역이고, 도는 것은 자국의 어두움이다
    expect({
      sky: PRESENCE_AREA_SKY_COLOR === PRESENCE_LINE_COLOR,
      prowl: PRESENCE_AREA_PROWL_COLOR === TRACK_COLOR,
      soil: presenceAreaColor(STANDING_BEFORE) === PRESENCE_AREA_COLOR,
    }).toEqual({ sky: true, prowl: true, soil: true });
  });

  it('도는 것만 지면을 어둡게 하고 나머지 둘은 밝게 한다 (짙기가 같아도 색으로 갈린다)', () => {
    const ground = luminance(surfaceColor(SURFACE_FLAT));
    expect({
      soil: luminance(presenceAreaColor(STANDING_BEFORE)) > ground,
      sky: luminance(presenceAreaColor(PRESENCE_BIG_BIRD)) > ground,
      prowl: luminance(presenceAreaColor(PRESENCE_PREDATOR)) < ground,
    }).toEqual({ soil: true, sky: true, prowl: true });
  });

  it('모르는 코드는 이미 서 있던 것의 색을 받는다 (자락을 지어내지도 지우지도 않는다)', () => {
    expect(presenceAreaColor('no-such-presence')).toBe(PRESENCE_AREA_COLOR);
  });

  // ④ 짙기 — 한 벌이다
  it('셋이 짙기 하나를 함께 쓴다', () => {
    for (const code of ALL_AREAS) {
      const zones = presenceAreaZones(RED_EYE_TREE, [{ presence: code, area: 'presence-swarm-1' }]);
      expect({ code, opacity: zones[0]?.fill?.opacity }).toEqual({
        code,
        opacity: PRESENCE_AREA_OPACITY,
      });
    }
  });

  // ⑤ 그림 — 고른 색이 면까지 가고, 지면에는 여전히 글자도 테두리도 없다
  it('같은 자락도 무엇이 도는가에 따라 다른 색으로 선다', () => {
    const drawn = ALL_AREAS.map((code) => {
      const presences: PresenceView[] = [{ presence: code, area: 'presence-swarm-1' }];
      const zones = presenceAreaZones(RED_EYE_TREE, presences);
      return zones[0]?.fill?.color;
    });
    expect(drawn).toEqual(ALL_AREAS.map((code) => presenceAreaColor(code)));
    expect(new Set(drawn).size).toBe(ALL_AREAS.length);
  });

  it('지면에는 테두리도 이름표도 없다 (RULE-QUIET-GROUND-001 그대로)', () => {
    for (const code of ADDED_PRESENCES) {
      const zones = presenceAreaZones(RED_EYE_TREE, [
        { presence: code, area: 'presence-swarm-1' },
      ]);
      expect({ code, count: zones.length, edge: zones[0]?.edge }).toEqual({
        code,
        count: 1,
        edge: undefined,
      });
    }
  });
});
