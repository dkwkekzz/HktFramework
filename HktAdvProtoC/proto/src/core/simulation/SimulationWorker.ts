// Web Worker 진입점 (기획서 §38) — postMessage 를 아는 유일한 파일.
// 실제 처리는 InlineHost 와 동일한 RuntimeServer 가 한다 (Phase 0 §0.4).
import type { RequestEnvelope, ResponseEnvelope, WorkerResponse } from "../../shared/protocol";
import { RuntimeServer } from "./RuntimeServer";

const server = new RuntimeServer();

self.onmessage = (message: MessageEvent<RequestEnvelope>) => {
  const { requestId, request } = message.data;
  // 세계 생성(§5 15단계)까지 이 경계 뒤에서 돈다 — 그래서 진입점도 비동기다(Phase 8)
  void server
    .handleAsync(request)
    .catch((error: unknown): WorkerResponse[] => [
      { type: "error", message: error instanceof Error ? error.message : String(error) },
    ])
    .then((responses) => {
      const envelope: ResponseEnvelope = { requestId, responses };
      self.postMessage(envelope);
    });
};
