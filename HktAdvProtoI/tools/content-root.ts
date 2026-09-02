// Content Root — 공정 도구가 컨텐츠의 자리를 읽는 유일한 경로.
//
// 컨텐츠는 이 저장소에 하나뿐이고 `content/` 에 산다. 도구(catalog · motion-atlas)는
// 그 자리를 직접 적지 않고 여기를 부른다 — 자리가 바뀌면 이 파일 하나만 고친다.
// 코드 조립이 컨텐츠를 부르는 자리는 따로다: content/active*.ts (경계 규칙 3).

import { join } from 'node:path';

/** 컨텐츠 루트 디렉터리 (<root>/content) */
export function contentDir(projectRoot: string): string {
  return join(projectRoot, 'content');
}
