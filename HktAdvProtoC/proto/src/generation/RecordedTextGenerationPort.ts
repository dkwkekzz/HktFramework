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

/**
 * 수정 라운드의 녹화 (Phase-6 §6.3).
 * "이 이슈를 프롬프트에 붙여 다시 물었더니 생성 AI 가 이렇게 고쳐 왔다" 를 그대로 담는다.
 * answers 에 적힌 이슈 코드가 실제로 검출되었을 때에만 이 응답이 켜진다 — 한번 켜지면 계속 유지된다
 * (뒤 라운드에서 더 앞 단계를 다시 돌려도 이미 고친 것이 되돌아가지 않는다).
 */
export interface RepairRecording {
  taskId: string;
  /** 이 응답이 답하는 §34/§35 이슈 코드 */
  answers: string[];
  /** 무엇을 고쳤는가 (보고에 그대로 실린다) */
  note: string;
  response: unknown;
}

export class RecordedTextGenerationPort implements TextGenerationPort {
  readonly calls: RecordedCall[] = [];
  private counts = new Map<string, number>();
  /** 켜진 수정 녹화 — taskId → 응답 */
  private readonly activeRepairs = new Map<string, RepairRecording>();

  constructor(
    private readonly corpus: RecordedCorpus,
    /** 재시도 경로 시험용 — 첫 시도의 응답을 일부러 망가뜨린다 */
    private readonly corrupt?: (taskId: string, attempt: number, response: unknown) => unknown,
    private readonly repairs: readonly RepairRecording[] = [],
  ) {}

  /**
   * 수정 라운드 진입 (RepairLoop 가 부른다).
   * 검출된 이슈 코드에 답하는 녹화를 켠다. 켤 것이 없으면 다음 라운드도 같은 세계가 나온다 —
   * 그 경우 루프는 상한에서 멈추고 사람 검토로 넘어간다(§42-6).
   */
  applyRepair(_round: number, issueCodes: readonly string[]): RepairRecording[] {
    const activated: RepairRecording[] = [];
    for (const recording of this.repairs) {
      if (this.activeRepairs.has(recording.taskId)) continue;
      if (!recording.answers.some((code) => issueCodes.includes(code))) continue;
      this.activeRepairs.set(recording.taskId, recording);
      activated.push(recording);
    }
    return activated;
  }

  get appliedRepairs(): RepairRecording[] {
    return [...this.activeRepairs.values()];
  }

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
    const repaired = this.activeRepairs.get(task.taskId);
    if (repaired === undefined && !(task.taskId in this.corpus)) {
      throw new Error(`녹화되지 않은 생성 호출: ${task.taskId}`);
    }
    const response = structuredClone(repaired === undefined ? this.corpus[task.taskId] : repaired.response);
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
