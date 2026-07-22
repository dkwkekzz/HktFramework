// 파일 로더 — objective-graph.json + world-state.json 을 읽어 온다.
// state-engine.mjs 를 순수(node:fs 비의존)로 유지하기 위해 fs 접근을 이 파일로 분리한다.
// 이렇게 해야 브라우저(objective-tree.html)가 state-engine.mjs 를 그대로 import 할 수 있다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const HERE = dirname(fileURLToPath(import.meta.url));

export function loadWorld(dir = HERE) {
  const graph = JSON.parse(readFileSync(join(dir, "objective-graph.json"), "utf8"));
  const state = JSON.parse(readFileSync(join(dir, "world-state.json"), "utf8"));
  return { graph, state };
}
