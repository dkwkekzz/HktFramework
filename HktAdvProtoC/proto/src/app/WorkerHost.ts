// WorkerHost — 브라우저에서 SimulationWorker 를 구동하는 호스트 (Phase 0 §0.4)
// core 심볼을 import 하지 않는다 — Worker URL(프로세스 경계 참조)과 shared 프로토콜만 안다.
import type {
  RequestEnvelope,
  ResponseEnvelope,
  SimulationHost,
  WorkerRequest,
  WorkerResponse,
} from "../shared/protocol";

export class WorkerHost implements SimulationHost {
  private worker: Worker;
  private nextRequestId = 1;
  private pending = new Map<number, (responses: WorkerResponse[]) => void>();

  constructor() {
    this.worker = new Worker(new URL("../core/simulation/SimulationWorker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (message: MessageEvent<ResponseEnvelope>) => {
      const { requestId, responses } = message.data;
      const resolve = this.pending.get(requestId);
      if (resolve !== undefined) {
        this.pending.delete(requestId);
        resolve(responses);
      }
    };
  }

  request(request: WorkerRequest): Promise<WorkerResponse[]> {
    const requestId = this.nextRequestId++;
    const envelope: RequestEnvelope = { requestId, request };
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.worker.postMessage(envelope);
    });
  }
}
