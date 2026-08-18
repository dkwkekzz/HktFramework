// kind 정적 데이터 3원소(world 카탈로그 · view 표현 · motions/)의 정합 검사.
// npm run catalog:check 와 같은 판정을 테스트로도 돌린다 —
// 한쪽 카탈로그에만 등록한 종류는 여기서 걸린다.

import { describe, expect, it } from 'vitest';
import { CHARACTER_CATALOG } from '../../../content/proto-adventure/world/semantic/character-catalog';
import { KIND_PRESENTATIONS } from '../../../content/proto-adventure/view/kind-presentation';
import { findDrift, scanMotionFolders } from '../print';

describe('Character Catalog — 3원소 정합', () => {
  it('world 카탈로그와 view 표현의 kind 집합이 일치한다', () => {
    expect(Object.keys(KIND_PRESENTATIONS).sort()).toEqual(
      Object.keys(CHARACTER_CATALOG).sort(),
    );
  });

  it('현재 저장소에 카탈로그 등록 불일치가 없다 (catalog:check 동치)', () => {
    expect(findDrift(scanMotionFolders()).errors).toEqual([]);
  });

  it('motions/ 폴더의 종류는 모두 world 카탈로그에 등록되어 있다', () => {
    for (const kind of scanMotionFolders().keys()) {
      expect(CHARACTER_CATALOG[kind], `motions/${kind}/ 의 카탈로그 항목`).toBeDefined();
    }
  });
});
