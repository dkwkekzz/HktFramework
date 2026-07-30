// 세계 보관함 (Phase-9 §9.1) — 생성과 플레이를 잇는 저장소.
//
// 담는 것은 **불투명 패키지 문자열**뿐이다 — 화면 계층은 세계 정의를 해석하지 않는다(분해 원칙 5).
// localStorage 는 app 계층의 것이다(Worker 는 접근 불가). 결정론 제약도 없다 — 저장 시각은 표시용이다.
import type { WorldPackageStageBadge } from "../shared/protocol";

export interface StoredWorld {
  /** 보관 항목 id — 같은 세계를 여러 번 보관해도 각각 남는다 */
  id: string;
  worldId: string;
  label: string;
  /** 표시용 저장 시각 (ISO) */
  savedAt: string;
  /** 세계 패키지 — initialize_world 의 package 로 그대로 보낸다 */
  json: string;
  /** §3 모듈 1~6 처리 보고 (표시용) — 패키지가 어떤 가공을 거쳤는가 */
  stages: WorldPackageStageBadge[];
}

const STORAGE_KEY = "hktadvc.worlds.v1";

export class WorldLibrary {
  list(): StoredWorld[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed as StoredWorld[];
    } catch {
      return [];
    }
  }

  save(worldId: string, label: string, json: string, stages: WorldPackageStageBadge[]): StoredWorld | undefined {
    const entry: StoredWorld = {
      id: `${worldId}.${Date.now()}`,
      worldId,
      label,
      savedAt: new Date().toISOString(),
      json,
      stages,
    };
    try {
      const all = [entry, ...this.list()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return entry;
    } catch {
      // 저장 실패(용량·프라이빗 모드) — 호출자가 알림으로 알린다
      return undefined;
    }
  }

  remove(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list().filter((entry) => entry.id !== id)));
    } catch {
      // 삭제 실패는 목록 갱신 시 드러난다
    }
  }

  find(id: string): StoredWorld | undefined {
    return this.list().find((entry) => entry.id === id);
  }
}
