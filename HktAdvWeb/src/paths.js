// 경로 헬퍼 — data/ 디렉터리 위치를 소스 기준으로 고정한다 (cwd 무관).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// src/ 의 부모가 프로젝트 루트다.
export const ROOT = join(here, '..');
export const DATA_DIR = join(ROOT, 'data');

export function dataPath(name) {
  return join(DATA_DIR, name);
}
