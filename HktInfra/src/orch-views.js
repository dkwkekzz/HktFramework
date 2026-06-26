'use strict';
// step-0323 정리 분할 — orch-zonebridge.js 가 30.6KB>30KB 박스 트리거를 넘겨, *다운스트림 데이터 평면 뷰 질의*(0319~0322·#9 후속 "host 산출 AOI 뷰")를 이 파일로 분리한다.
//   옮긴 것: 런타임 존이 버퍼링 싱크에 쌓은 산출 뷰의 읽기 전용 질의(zoneViewBuf·zoneViewEntered·zoneViewStats·zoneVisibleIds·zoneViewsFor·zoneViewFrames).
//   남긴 것: 브리지 lifecycle(_bridgeStart/migrate/hostdown/stop)·전송 seam(_zoneDeliver)·런타임 tick(_tickRuntimes)·entity 데이터 평면 질의/정합 → orch-zonebridge.js.
//   Object.assign 으로 같은 prototype 에 되섞으므로 this 바인딩·메서드 해소 동일 = 동작 비트 불변(reg 0·플래그 없는 투명 분할·orch-placement 0251·orch-control 0267·orch-hostproc 0305 동형).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.orch_views).

// 다운스트림 뷰 질의 믹스인 — Orchestrator.prototype 에 Object.assign. 모든 메서드는 this=Orchestrator 인스턴스(zoneRuntimes 의 런타임 존 net.buf 를 읽는다).
const OrchViews = {
  // 런타임 존 산출 뷰 버퍼 질의(step-0320·#9 후속) — 그 host 프로세스 런타임 존이 산출해 버퍼링 싱크에 쌓은 view frame 원본 배열({to, payload}…). 다운스트림 뷰의 *내용*(누가 무엇을 보나)을 검증하는 창(AOI 정확성·전파 무손실). 미가동 존 []. 읽기 전용.
  zoneViewBuf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return (rt && rt.zone.net && rt.zone.net.buf) ? rt.zone.net.buf : []; },
  // 세션이 본 entity 집합 질의(step-0322·#9 후속) — 그 세션에 산출된 view 들의 enter 를 누적한 id 집합(=그 세션이 *언젠가 한 번이라도 AOI 안에서 본* entity 들). 두 avatar 가 가까워지면 서로의 집합에 들어온다(상호 가시·enter 델타). 미가동/미존재 빈 집합. 읽기 전용.
  zoneViewEntered(zoneId, sessionId) {
    const set = new Set();
    for (const s of this.zoneViewBuf(zoneId)) { const p = s.payload; if (p.type !== 'view_delta' || p.sessionId !== sessionId) continue; for (const e of p.enter) set.add(e.id); }
    return [...set].sort();
  },
  // 런타임 존 다운스트림 요약 질의(step-0327·#9 후속) — 그 존의 다운스트림 데이터 평면 대시보드 {frames, bytes, sessions, serializable}(0319~0326 지표 집계). 운영 한눈 + migrate 같은 lifecycle 전후로 뷰 산출이 *끊기지 않는지*(연속성) 보는 단위. 미가동 존은 0/[]. 읽기 전용.
  zoneViewReport(zoneId) {
    const w = this.zoneViewWire(zoneId);
    return { frames: w.frames, bytes: w.bytes, sessions: this.zoneViewSessions(zoneId).length, serializable: w.serializable };
  },
  // 런타임 존 산출 뷰 세션 집합 질의(step-0326·#9 후속) — 그 존이 뷰를 산출한 sessionId 들(정렬). 다중 존이 동시에 돌 때 각 존이 *자기 세션에만* 뷰를 내보내는지(존 간 누수 0·격리) 검증의 단위. 미가동 존 []. 읽기 전용.
  zoneViewSessions(zoneId) {
    const set = new Set();
    for (const s of this.zoneViewBuf(zoneId)) { const p = s.payload; if ((p.type === 'view' || p.type === 'view_delta') && p.sessionId) set.add(p.sessionId); }
    return [...set].sort();
  },
  // 런타임 존 산출 뷰 와이어 질의(step-0325·#9 후속) — 그 존이 산출한 view frame 들이 *직렬화 가능*(JSON round-trip 동일)하고 와이어 바이트가 얼마인지 {frames, bytes, serializable}. 다운스트림 뷰가 실 소켓(host→게이트웨이→클라)을 탈 준비가 됐다는 증거 — 함수/순환 참조가 섞이면 serializable=false(원격-검증 토대·_zoneDeliver 0291 의 다운스트림 짝). 읽기 전용.
  zoneViewWire(zoneId) {
    let frames = 0, bytes = 0, serializable = true;
    for (const s of this.zoneViewBuf(zoneId)) {
      const p = s.payload; if (p.type !== 'view' && p.type !== 'view_delta') continue;
      frames++;
      try { const w = JSON.stringify(p); bytes += w.length; if (JSON.stringify(JSON.parse(w)) !== w) serializable = false; } catch { serializable = false; }
    }
    return { frames, bytes, serializable };
  },
  // 세션이 시야에서 잃은 entity 집합 질의(step-0324·#9 후속) — 그 세션 뷰들의 exit 를 누적한 id 집합(=그 세션의 AOI 에서 *언젠가 빠져나간* entity). 두 avatar 가 멀어지면 서로의 exit 집합에 들어온다(동적 가시 상실·exit 델타·enter 0322 의 짝). 읽기 전용.
  zoneViewExited(zoneId, sessionId) {
    const set = new Set();
    for (const s of this.zoneViewBuf(zoneId)) { const p = s.payload; if (p.type !== 'view_delta' || p.sessionId !== sessionId) continue; for (const id of (p.exit || [])) set.add(id); }
    return [...set].sort();
  },
  // 런타임 존 산출 뷰 통계 질의(step-0321·#9 후속) — 그 존이 한 세션(또는 전체)에 산출한 view_delta 분포 {resets, updates, enters, total}. 증분 전파의 핵심을 본다: 초기 keyframe(reset) 1 + 이동마다 update — *매 tick 전체 전송이 아니라 변경분만*(대역 절감). total ≪ tick 수면 증분이 동작. 미가동 존 0. 읽기 전용.
  zoneViewStats(zoneId, sessionId) {
    const buf = this.zoneViewBuf(zoneId); let resets = 0, updates = 0, enters = 0, total = 0;
    for (const s of buf) { const p = s.payload; if (p.type !== 'view_delta' || (sessionId && p.sessionId !== sessionId)) continue; total++; if (p.reset) resets++; if (p.update && p.update.length) updates++; if (p.enter && p.enter.length) enters++; }
    return { resets, updates, enters, total };
  },
  // 런타임 존 AOI 가시 집합 질의(step-0320·#9 후속) — 그 존에서 avatar 가 *지금* 보는 entity id 집합(반경 R AOI·zone.visibleFor). host 가 산출한 view 의 enter 가 이 집합과 일치해야(뷰가 진짜 AOI 다 — 가까운 것만·먼 것 제외). 미가동/미존재 []. 읽기 전용.
  zoneVisibleIds(zoneId, avatar) { const rt = this.zoneRuntimes.get(zoneId); if (!rt) return []; const me = rt.zone.ents.get(avatar); if (!me) return []; return [...rt.zone.visibleFor(me).keys()].sort(); },
  // 런타임 존 산출 뷰 질의(step-0319·#9 후속·downstream 데이터 평면) — 그 host 프로세스가 onTick 으로 산출해 *버퍼링 싱크*에 쌓은 view/view_delta frame 수(미가동 존 0). 0282 까지 런타임 존의 뷰는 no-op 싱크로 드롭됐다 — 이 질의가 "host 가 실제로 AOI 뷰를 만들어 내보낼 준비가 됐나"를 본다(SPINE §4 경로2 월드 다운스트림의 씨앗). 읽기 전용.
  zoneViewsFor(zoneId) { const rt = this.zoneRuntimes.get(zoneId); if (!rt || !rt.zone.net || !rt.zone.net.buf) return 0; let n = 0; for (const s of rt.zone.net.buf) if (s.payload.type === 'view' || s.payload.type === 'view_delta') n++; return n; },
  // 전 런타임 산출 뷰 총수 질의(step-0319·#9 후속) — 모든 host 프로세스 런타임 존이 산출한 view/view_delta frame 합. >0 이면 다운스트림 데이터 평면(host→세션 뷰)이 실제로 frame 을 만든다는 증거. 읽기 전용.
  zoneViewFrames() { let n = 0; for (const z of this.zoneRuntimes.keys()) n += this.zoneViewsFor(z); return n; },
};

const __part = { OrchViews };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_views = __part;
