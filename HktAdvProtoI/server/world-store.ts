// World Store — 스냅샷을 담아 두는 자리 (design/Design-World-Persistence.md).
//
// 세계를 띄우는 쪽의 조립 부품이다. 세계는 저장을 모른다 — 커널이 내놓는
// WorldSnapshot 을 여기가 파일 하나(JSON)로 받아 둘 뿐이다.
// 프로토타입에는 파일이면 충분하며, 다른 저장소가 필요해지면 이 계약만 다시 구현한다.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WorldSnapshot } from '../engine/world-kernel/persistence';

export interface WorldStore {
  /** 담아 둔 스냅샷 — 없거나 읽을 수 없으면 null (새 세계로 시작한다) */
  load(): WorldSnapshot | null;
  save(snapshot: WorldSnapshot): void;
}

export function createFileWorldStore(path: string): WorldStore {
  return {
    load() {
      try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'));
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          typeof (parsed as WorldSnapshot).version !== 'string' ||
          !('state' in parsed)
        )
          return null;
        return parsed as WorldSnapshot;
      } catch {
        return null; // 파일 없음·깨진 JSON — 복구할 것이 없다
      }
    },
    save(snapshot) {
      // 임시 파일에 쓴 뒤 이름을 바꾼다 — 저장 도중 프로세스가 죽어도
      // 직전 스냅샷이 깨지지 않는다 (rename 은 같은 디렉터리 안에서 원자적이다).
      mkdirSync(dirname(path), { recursive: true });
      const temp = `${path}.tmp`;
      writeFileSync(temp, JSON.stringify(snapshot), 'utf-8');
      renameSync(temp, path);
    },
  };
}
