// InlineHost — Worker 없이 같은 스레드에서 RuntimeServer 를 돌리는 호스트 (Phase 0 §0.4)
// Vitest headless 테스트가 이 경로로 코어를 실행한다. Worker 경로와 코드가 완전히 동일해야 한다.
import type { SimulationHost, WorkerRequest, WorkerResponse } from "../../shared/protocol";
import type { RuntimeHooks } from "./SimulationLoop";
import { RuntimeServer } from "./RuntimeServer";

export class InlineHost implements SimulationHost {
  readonly server: RuntimeServer;

  constructor(hooks?: RuntimeHooks) {
    this.server = new RuntimeServer(hooks);
  }

  request(request: WorkerRequest): Promise<WorkerResponse[]> {
    return Promise.resolve(this.server.handle(request));
  }
}
