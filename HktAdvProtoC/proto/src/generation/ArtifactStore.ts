// 단계 산출물 저장소 (Phase-5 "공통 기반" — generation-artifacts/<step>.json)
//
// 두 가지를 가능하게 한다.
//  ① 단계별 재시도·재개 — 앞 단계를 다시 부르지 않고 뒤 단계만 다시 돌린다.
//  ② 생성 구조 검토(§36.1) — 화면이 단계마다 무엇이 나왔는지 그대로 펼쳐 보인다.
export interface Artifact {
  stepId: string;
  /** §5 의 1~15 */
  stepIndex: number;
  title: string;
  data: unknown;
  /** 이 단계가 실제로 부른 생성 호출 taskId 들 */
  taskIds: string[];
}

export class ArtifactStore {
  private artifacts = new Map<string, Artifact>();

  save(artifact: Artifact): void {
    this.artifacts.set(artifact.stepId, {
      ...artifact,
      data: structuredClone(artifact.data),
      taskIds: [...artifact.taskIds],
    });
  }

  has(stepId: string): boolean {
    return this.artifacts.has(stepId);
  }

  get<T>(stepId: string): T | undefined {
    const found = this.artifacts.get(stepId);
    return found === undefined ? undefined : (structuredClone(found.data) as T);
  }

  /** §5 단계 순서대로 */
  list(): Artifact[] {
    return [...this.artifacts.values()].sort((a, b) => a.stepIndex - b.stepIndex);
  }

  /**
   * stepIndex 앞의 단계만 남긴 사본 (Phase-6 §6.3 증분 재실행).
   * "해당 단계 아티팩트만 교체 후 하위 단계 증분 재실행" — 남긴 것은 재사용되고, 나머지는 다시 생성된다.
   */
  before(stepIndex: number): ArtifactStore {
    const store = new ArtifactStore();
    for (const artifact of this.list()) {
      if (artifact.stepIndex >= stepIndex) continue;
      store.save(artifact);
    }
    return store;
  }

  exportJson(): string {
    return JSON.stringify(this.list(), null, 2);
  }

  static fromJson(json: string): ArtifactStore {
    const store = new ArtifactStore();
    for (const artifact of JSON.parse(json) as Artifact[]) store.save(artifact);
    return store;
  }
}
