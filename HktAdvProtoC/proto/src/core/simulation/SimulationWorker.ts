// Web Worker 진입점 (기획서 §38) — postMessage 를 아는 유일한 파일.
// 실제 처리는 InlineHost 와 동일한 RuntimeServer 가 한다 (Phase 0 §0.4).
import type { RequestEnvelope, ResponseEnvelope, WorkerResponse } from "../../shared/protocol";
import { RuntimeServer } from "./RuntimeServer";

const server = new RuntimeServer();

self.onmessage = (message: MessageEvent<RequestEnvelope>) => {
  const { requestId, request } = message.data;
  let responses: WorkerResponse[];
  try {
    responses = server.handle(request);
  } catch (error) {
    responses = [{ type: "error", message: error instanceof Error ? error.message : String(error) }];
  }
  const envelope: ResponseEnvelope = { requestId, responses };
  self.postMessage(envelope);
};
