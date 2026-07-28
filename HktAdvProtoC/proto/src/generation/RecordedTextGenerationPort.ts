// 오프라인 목(mock) 포트 — 녹화된 응답 재생 (Phase-5 구현 스텝 1)
//
// "코어와 검증은 AI 없이 항상 실행 가능해야 한다"(README 기술 기준선). 테스트·verify 는 전부 이 포트로 돈다.
// 실제 LLM 어댑터(Claude API 등)는 같은 인터페이스를 구현하고, 응답을 이 코퍼스 형식으로 녹화해 두면
// 그 순간부터 오프라인 재현이 가능해진다.
import type { GenerationTask, TextGenerationPort } from "./TextGenerationPort";

export interface RecordedCall {
  taskId: string;
  attempt: number;
  inputBytes: number;
  inputKeys: string[];
  hadPreviousErrors: boolean;
}

/** taskId → 녹화된 응답 */
export type RecordedCorpus = Record<string, unknown>;

export class RecordedTextGenerationPort implements TextGenerationPort {
  readonly calls: RecordedCall[] = [];
  private counts = new Map<string, number>();

  constructor(
    private readonly corpus: RecordedCorpus,
    /** 재시도 경로 시험용 — 첫 시도의 응답을 일부러 망가뜨린다 */
    private readonly corrupt?: (taskId: string, attempt: number, response: unknown) => unknown,
  ) {}

  async generate(task: GenerationTask): Promise<unknown> {
    const attempt = (this.counts.get(task.taskId) ?? 0) + 1;
    this.counts.set(task.taskId, attempt);
    this.calls.push({
      taskId: task.taskId,
      attempt,
      inputBytes: JSON.stringify(task.input).length,
      inputKeys: Object.keys(task.input),
      hadPreviousErrors: (task.previousErrors ?? []).length > 0,
    });
    if (!(task.taskId in this.corpus)) {
      throw new Error(`녹화되지 않은 생성 호출: ${task.taskId}`);
    }
    const response = structuredClone(this.corpus[task.taskId]);
    return this.corrupt === undefined ? response : this.corrupt(task.taskId, attempt, response);
  }

  /** 호출된 taskId 목록 (호출 순서) */
  get taskIds(): string[] {
    return this.calls.map((call) => call.taskId);
  }

  get maxInputBytes(): number {
    return this.calls.reduce((max, call) => Math.max(max, call.inputBytes), 0);
  }
}
