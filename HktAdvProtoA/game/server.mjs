// 월드 서버 — Design-MMO §8 멀티플레이: 세계층 엔진을 상주 프로세스로 옮긴다.
// 클라이언트는 SSE(/api/events) 로 스냅샷 diff 를 구독하고, 세계에는 행동 발화
// 요청(/api/act)으로만 닿는다 (불변 2·6 — 표현층 코드는 데이터 소스만 바뀐다).
// 의존성 0 (node:http). 지역 내 픽셀 좌표(/api/pos)는 비권위 표현 채널 — 상태가 아니다.
//
// 실행: node HktAdvProtoA/game/server.mjs [포트=8000]
//       → http://localhost:8000/game/world.html?online&name=이름
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildInitial, recomputeDerived, newCtx, tick, indexVars, joinChar } from "../data/state-engine.mjs";
import { loadWorld } from "../data/load-world.mjs";

const PORT = Number(process.argv[2] || 8000);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");   // HktAdvProtoA/
const TICK_MS = 1000;                                               // 1 세계틱 = 1초 (§9)

const { state } = loadWorld();
const varIdx = indexVars(state);
const snap = buildInitial(state);
recomputeDerived(snap, varIdx);
const ctx = newCtx(state);
const clients = new Set();      // SSE 연결
const poses = {};               // char → {region,x,y,seen} — 표현 채널 릴레이
let prev = { ...snap };

const sse = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
const ctxView = () => ({ busy: ctx.busy, pending: ctx.pending.map((p) => ({ label: p.label, at: p.at })) });

setInterval(() => {
  const fired = tick(snap, state, ctx);
  const diff = {};
  for (const k in snap) if (snap[k] !== prev[k]) diff[k] = snap[k];
  prev = { ...snap };
  for (const [c, p] of Object.entries(poses)) if (Date.now() - p.seen > 10000) delete poses[c];
  if (ctx.errors.length) { console.error("[엔진 오류]", ctx.errors.join(" · ")); ctx.errors.length = 0; }
  const msg = { t: ctx.t, diff, fired, ...ctxView(), poses };
  for (const res of clients) { try { sse(res, "tick", msg); } catch { clients.delete(res); } }
}, TICK_MS);

const MIME = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".mjs": "text/javascript", ".js": "text/javascript" };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive" });
    clients.add(res);
    sse(res, "init", { t: ctx.t, snap, ...ctxView(), poses });
    req.on("close", () => clients.delete(res));
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = body ? JSON.parse(body) : {}; } catch { res.writeHead(400); res.end(); return; }
    if (url.pathname === "/api/join") {
      const name = String(data.name || "").replace(/[^\w가-힣]/g, "").slice(0, 12) || "모험가" + (Math.floor(Math.random() * 900) + 100);
      const char = joinChar(snap, state, "E_플레이어#" + name);
      console.log(`[join] ${char} (t=${ctx.t})`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ char, t: ctx.t }));
      return;
    }
    if (url.pathname === "/api/act") {
      // 서버 권위 검증 — 행동 존재 + actor_type 에 캐릭터의 base 노드 포함 (§6)
      const act = (state.actions || []).find((a) => a.id === data.actionId);
      const base = String(data.char || "").split("#")[0];
      if (!act || !(act.actor_type || []).includes(base)) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "허용되지 않는 행동" }));
        return;
      }
      const t = ctx.t + 1;
      if (!ctx.inputs.has(t)) ctx.inputs.set(t, []);
      ctx.inputs.get(t).push({ actionId: String(data.actionId || ""), actor: String(data.char || ""), target: data.target });
      res.writeHead(200); res.end("{}");
      return;
    }
    if (url.pathname === "/api/pos") {
      if (data.char) poses[data.char] = { region: data.region, x: data.x, y: data.y, seen: Date.now() };
      res.writeHead(200); res.end("{}");
      return;
    }
    res.writeHead(404); res.end();
    return;
  }
  // 정적 서빙 — HktAdvProtoA 루트 (클라의 ../data/*.json fetch 가 그대로 동작)
  try {
    const p = join(ROOT, decodeURIComponent(url.pathname === "/" ? "/game/world.html" : url.pathname));
    if (!p.startsWith(ROOT)) throw new Error("밖");
    const file = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(file);
  } catch { res.writeHead(404); res.end("not found"); }
});
server.listen(PORT, () => console.log(`월드 서버 가동 — http://localhost:${PORT}/game/world.html?online  (틱 ${TICK_MS}ms, 정책 on)`));
