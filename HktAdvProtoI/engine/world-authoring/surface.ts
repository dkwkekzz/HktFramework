// World Authoring — 표면 규칙 표 평가 (ENGINE A).
//
// vertex 마다 경사를 재고 규칙 표를 **배열 순서로** 훑어 처음 맞는 태그를 붙인다. 순서가
// 곧 우선순위이므로 같은 입력은 언제나 같은 결과다 (design/Plan-World-Authoring-Engine.md §3.5).
//
// 이 파일은 어떤 태그 이름도 알지 못한다 — 규칙은 인자로 들어오고, 태그의 뜻은 컨텐츠의 것이다.

import type { HeightField, SurfaceRule } from './compiled';
import { slopeAtVertex } from './height-field';

/**
 * 규칙이 하나도 없을 때 격자 전체가 갖는 태그.
 *
 * 빈 문자열은 "태그가 없다" 와 구별되지 않으므로 쓰지 않는다. 뜻 없는 이름 하나를 두어
 * surface 색인(0)이 언제나 가리킬 곳이 있게 한다 — 컨텐츠가 규칙을 주면 쓰이지 않는다.
 */
export const DEFAULT_SURFACE_TAG = 'default';

/**
 * 격자 vertex 마다 태그 색인 하나.
 *
 * surfaceTags 는 규칙에 나온 순서대로의 태그 목록이다 (같은 태그를 여러 규칙이 쓰면 한 번만
 * 담는다). 아무 규칙도 맞지 않으면 **마지막 규칙**의 태그를 붙인다 — 표의 마지막 줄이 남은
 * 전부를 받는 자리다.
 */
export function evaluateSurface(
  field: HeightField,
  rules: readonly SurfaceRule[],
): { surface: Uint8Array; surfaceTags: string[] } {
  const surfaceTags: string[] = [];
  const tagIndexOfRule: number[] = [];
  for (const rule of rules) {
    let index = surfaceTags.indexOf(rule.tag);
    if (index < 0) {
      index = surfaceTags.length;
      surfaceTags.push(rule.tag);
    }
    tagIndexOfRule.push(index);
  }

  const surface = new Uint8Array(field.cols * field.rows);
  if (rules.length === 0) {
    // 규칙이 비면 격자 전체가 태그 하나다 — 색인은 이미 전부 0 이다
    surfaceTags.push(DEFAULT_SURFACE_TAG);
    return { surface, surfaceTags };
  }

  const fallback = tagIndexOfRule[tagIndexOfRule.length - 1] ?? 0;
  for (let iz = 0; iz < field.rows; iz++) {
    for (let ix = 0; ix < field.cols; ix++) {
      const slope = slopeAtVertex(field, ix, iz);
      let chosen = fallback;
      for (let r = 0; r < rules.length; r++) {
        const rule = rules[r];
        if (!rule) continue;
        if (rule.maxSlope === undefined || slope < rule.maxSlope) {
          chosen = tagIndexOfRule[r] ?? 0;
          break;
        }
      }
      surface[iz * field.cols + ix] = chosen;
    }
  }
  return { surface, surfaceTags };
}
