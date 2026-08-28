// Active Pack — 공정 도구가 "어느 컨텐츠 팩이 활성인가" 를 읽는 유일한 경로 (P4 ADDED).
//
// 코드 조립은 content/active.ts · content/active-view.ts (TS 재수출)가 맡고,
// 파일 시스템을 훑는 도구(catalog · motion-atlas)와 문서 공정은 이 JSON 을 읽는다.
// 두 곳이 같은 팩을 가리켜야 한다 — catalog:check 가 어긋남을 잡는다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function activePack(projectRoot: string): string {
  const raw = readFileSync(join(projectRoot, 'hkt.pack.json'), 'utf8');
  const parsed = JSON.parse(raw) as { active?: string };
  if (!parsed.active) throw new Error('hkt.pack.json 에 active 팩이 없다');
  return parsed.active;
}

/** 활성 팩의 루트 디렉터리 (예: <root>/content/proto-adventure) */
export function activePackDir(projectRoot: string): string {
  return join(projectRoot, 'content', activePack(projectRoot));
}
