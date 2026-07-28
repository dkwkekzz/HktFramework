// RawWorldChange 수집·색인 (기획서 §28 / Phase-4 §4.1)
//
// 사건 탐지는 change 로그를 **읽기만** 한다. 이 수집기는 로그를 바꾸지 않고,
// 최근 N tick 의 change 를 시간순 링 버퍼와 태그·위치 색인으로 들고 있다가 매처에게 넘긴다.
// 사건에 소속되지 못한 채 보관 기간을 넘긴 change 는 조용히 버려진다 — §24 기억과 같은 이유다.
import type { RawWorldChange } from "../../shared/change";
import type { WorldRuntime } from "../world/WorldRuntime";

export class ChangeCollector {
  /** 시간순(=id 순) 링 버퍼 */
  private ring: RawWorldChange[] = [];
  private tagIndex = new Map<string, RawWorldChange[]>();
  private locationIndex = new Map<string, RawWorldChange[]>();
  /** 마지막으로 흡수한 change id */
  private cursor = -1;

  /** @param retention 보관 기간(tick) — 가장 긴 패턴 timeWindow 의 몇 배로 잡는다 */
  constructor(readonly retention: number) {}

  /** 로그에 새로 쌓인 change 를 흡수하고 보관 기간이 지난 것을 버린다 */
  collect(runtime: WorldRuntime): void {
    const log = runtime.state.changeLog;
    const lastId = log.length === 0 ? -1 : log[log.length - 1]!.id;
    // 스냅샷 복원 등으로 로그가 되감겼다 — 색인을 처음부터 다시 만든다
    if (lastId < this.cursor) this.reset();

    for (const change of log) {
      if (change.id <= this.cursor) continue;
      this.ring.push(change);
      this.cursor = change.id;
    }
    this.evict(runtime.state.simulationTime - this.retention);
    this.reindex();
  }

  private reset(): void {
    this.ring = [];
    this.cursor = -1;
    this.tagIndex.clear();
    this.locationIndex.clear();
  }

  private evict(before: number): void {
    if (this.ring.length === 0) return;
    let cut = 0;
    while (cut < this.ring.length && this.ring[cut]!.time < before) cut += 1;
    if (cut > 0) this.ring = this.ring.slice(cut);
  }

  /** 링 버퍼가 바뀔 때마다 색인을 다시 만든다 — 버퍼는 최근 며칠 치뿐이라 비용이 작다 */
  private reindex(): void {
    this.tagIndex.clear();
    this.locationIndex.clear();
    for (const change of this.ring) {
      for (const tag of new Set(change.tags)) {
        const list = this.tagIndex.get(tag);
        if (list === undefined) this.tagIndex.set(tag, [change]);
        else list.push(change);
      }
      if (change.locationId === undefined) continue;
      const list = this.locationIndex.get(change.locationId);
      if (list === undefined) this.locationIndex.set(change.locationId, [change]);
      else list.push(change);
    }
  }

  get size(): number {
    return this.ring.length;
  }

  all(): RawWorldChange[] {
    return this.ring;
  }

  byTag(tag: string): RawWorldChange[] {
    return this.tagIndex.get(tag) ?? [];
  }

  byLocation(locationId: string): RawWorldChange[] {
    return this.locationIndex.get(locationId) ?? [];
  }

  /**
   * requiredTags 를 **전부** 가진 change 를 시간순으로 돌려준다 (§28 requiredTags).
   * 가장 희소한 태그의 색인에서 출발해 나머지를 걸러 낸다.
   */
  matching(requiredTags: string[], since = Number.NEGATIVE_INFINITY): RawWorldChange[] {
    if (requiredTags.length === 0) return this.ring.filter((change) => change.time >= since);
    let seed: RawWorldChange[] | undefined;
    for (const tag of requiredTags) {
      const list = this.byTag(tag);
      if (seed === undefined || list.length < seed.length) seed = list;
    }
    return (seed ?? []).filter(
      (change) => change.time >= since && requiredTags.every((tag) => change.tags.includes(tag)),
    );
  }
}
