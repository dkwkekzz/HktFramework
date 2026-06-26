'use strict';
// step-0323 정리 분할 — orch-zonebridge.js 가 30.6KB>30KB 박스 트리거를 넘겨, *다운스트림 데이터 평면 뷰 질의*(0319~0322·#9 후속 "host 산출 AOI 뷰")를 이 파일로 분리한다.
//   옮긴 것: 런타임 존이 버퍼링 싱크에 쌓은 산출 뷰의 읽기 전용 질의(zoneViewBuf·zoneViewEntered·zoneViewStats·zoneVisibleIds·zoneViewsFor·zoneViewFrames).
//   남긴 것: 브리지 lifecycle(_bridgeStart/migrate/hostdown/stop)·전송 seam(_zoneDeliver)·런타임 tick(_tickRuntimes)·entity 데이터 평면 질의/정합 → orch-zonebridge.js.
//   Object.assign 으로 같은 prototype 에 되섞으므로 this 바인딩·메서드 해소 동일 = 동작 비트 불변(reg 0·플래그 없는 투명 분할·orch-placement 0251·orch-control 0267·orch-hostproc 0305 동형).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.orch_views).

// 다운스트림 뷰 질의 믹스인 — Orchestrator.prototype 에 Object.assign. 모든 메서드는 this=Orchestrator 인스턴스(zoneRuntimes 의 런타임 존 net.buf 를 읽는다).
const OrchViews = {
  // 다운스트림 뷰 egress(step-0331·#9 후속) — 각 런타임 존이 onTick 으로 산출해 버퍼링 싱크(rt.zone.net.buf)에 쌓은 *새* view/view_delta frame 을 게이트웨이로 송출한다(per-rt egress 커서 rt.egN 으로 한 frame 정확히 1회·버퍼 미삭제 → 0319~0330 질의 보존). 이로써 host 산출 뷰가 *포착*에 머물지 않고 실제 전역 net 을 타 게이트웨이에 닿는다(SPINE §4 경로2 월드 다운스트림 배선). 게이트웨이 라우팅(세션→클라)은 후속. onTick 이 zoneEgress ON 일 때만 호출(OFF→미실행 = 0330 비트 동일).
  _drainZoneEgress() {
    for (const [zoneId, rt] of this.zoneRuntimes) {
      const buf = rt.zone.net && rt.zone.net.buf; if (!buf) continue;
      let cur = rt.egN || 0;
      for (; cur < buf.length; cur++) {
        const p = buf[cur].payload;
        if (p.type !== 'view' && p.type !== 'view_delta') continue;
        const sid = p.sessionId;
        const dseq = this.zoneEgressSeq.get(sid) || 0;   // step-0335 — 세션별 단조 다운스트림 시퀀스(클라가 순서/유실 감지·ack/재전송의 토대).
        this.zoneEgressSeq.set(sid, dseq + 1);
        const key = sid + '#' + dseq;   // step-0337 — 전송 손실 주입: 이 키의 *첫* egress 만 드롭(전송층 유실 모델·재전송은 통과). 미주입이면 항상 전송.
        if (this.egressDrop.has(key) && !this.egressDroppedOnce.has(key)) { this.egressDroppedOnce.add(key); this.zoneEgressDropped++; }
        else this.net.send(this.addr, 'gateway', { type: 'zoneView', zoneId, sessionId: sid, dseq, frame: p });   // 존→게이트웨이 다운스트림(zoneId·sessionId·dseq 태깅 → 게이트웨이가 세션→클라 해소·순서 추적).
        this.zoneViewEgressed++;
        let eb = this.zoneEgressBuf.get(sid); if (!eb) { eb = []; this.zoneEgressBuf.set(sid, eb); }   // step-0336 — 미-ack 버퍼에 보관(게이트웨이 ack 로 가지치기·재전송 소스·드롭된 frame 도 보관 → 재전송 가능).
        eb.push({ dseq, frame: p, zoneId, sentAt: this.curTick });   // step-0338 — sentAt: 타임아웃 재전송 기준(ack 없이 egressTimeout tick 경과 시 재전송).
        if (eb.length > this.zoneEgressBufPeak) this.zoneEgressBufPeak = eb.length;
      }
      rt.egN = cur;
    }
  },
  // 다운스트림 egress 총수 질의(step-0331·#9 후속) — 게이트웨이로 송출한 view frame 누적. == zoneViewFrames() 면 산출된 모든 뷰가 빠짐없이 송출됨(버퍼 잔류 0·무손실 송출). 읽기 전용.
  zoneEgressCount() { return this.zoneViewEgressed; },
  // 다운스트림 egress ack 처리(step-0336·#9 후속) — 게이트웨이가 받은 dseq 까지 통보 → 세션별 ack 워터마크 단조 전진 + egress 버퍼에서 dseq≤워터마크 가지치기(자기-크기조정·미-ack 만 잔류). 정상 흐름엔 ack 가 흘러 버퍼≈in-flight(작게)·손실 구간엔 ack 끊겨 자동 성장(재전송 소스 보존). 버스 ack(0040) 의 다운스트림 판.
  _onZoneViewAck(sid, dseq) {
    if (dseq === undefined) return;
    const cur = this.zoneEgressAcked.has(sid) ? this.zoneEgressAcked.get(sid) : -1;
    if (dseq > cur) this.zoneEgressAcked.set(sid, dseq);
    const buf = this.zoneEgressBuf.get(sid); if (!buf) return;
    const wm = this.zoneEgressAcked.get(sid);
    while (buf.length && buf[0].dseq <= wm) { buf.shift(); this.zoneEgressPruned++; }
  },
  // 다운스트림 egress 버퍼 질의(step-0336·#9 후속) — "이 세션 미-ack 버퍼 길이 / ack 워터마크 / 가지친 누적"(자기-크기조정 유계·무손실 ack 검증). 읽기 전용.
  zoneEgressBufLen(sid) { const b = this.zoneEgressBuf.get(sid); return b ? b.length : 0; },
  zoneEgressAckedOf(sid) { return this.zoneEgressAcked.has(sid) ? this.zoneEgressAcked.get(sid) : -1; },
  // 다운스트림 정착 술어(step-0341·#9 후속 capstone primitive) — 모든 세션의 미-ack egress 버퍼가 비었는가(= 산출된 모든 다운스트림 frame 이 게이트웨이에 닿아 ack 됨·재전송 복구 포함). 손실을 주입해도 gap-resync(0337)/타임아웃(0338) 재전송이 복구하면 결국 모두 ack→가지침→버퍼 0 = 정착. 미가동/leave 정리 세션은 버퍼 없음(자명). 읽기 전용.
  downstreamSettled() { for (const buf of this.zoneEgressBuf.values()) if (buf.length) return false; return true; },
  // 다운스트림 재전송(step-0337·#9 후속) — 게이트웨이 zoneResync{sessionId, from} 에 응답: 미-ack 버퍼의 dseq≥from frame 을 다시 전송(드롭으로 게이트웨이가 못 받은 분 복구). 버퍼가 재전송 소스(0336)·인오더 재배달 → 게이트웨이 gap 닫힘. 손실 1회 모델이라 재전송은 항상 통과.
  _resendEgress(sid, from) {
    this.zoneResyncServed++;
    const buf = this.zoneEgressBuf.get(sid); if (!buf) return;
    for (const e of buf) if (e.dseq >= from) { this.net.send(this.addr, 'gateway', { type: 'zoneView', zoneId: e.zoneId, sessionId: sid, dseq: e.dseq, frame: e.frame }); this.zoneResent++; }
  },
  // 타임아웃 재전송(step-0338·#9 후속) — 매 tick 미-ack egress 버퍼를 훑어 ack 없이 egressTimeout tick 경과한 frame 을 재전송한다. 게이트웨이 gap-resync(0337)는 *뒤 frame 도착*이 트리거라 세션 *마지막* frame 손실은 영영 못 잡는다 → 이 능동 재전송이 그 구멍을 메운다(zone heartbeat·bus recoverRetry 0058 의 다운스트림 판). 재전송 후 sentAt 갱신(또 egressTimeout 대기) → ack 오면 가지쳐 종료. egressTimeout 0 면 미실행 = 비트 동일.
  _retransmitStale(tick) {
    for (const [sid, buf] of this.zoneEgressBuf) {
      for (const e of buf) if (tick - e.sentAt >= this.egressTimeout) {
        this.net.send(this.addr, 'gateway', { type: 'zoneView', zoneId: e.zoneId, sessionId: sid, dseq: e.dseq, frame: e.frame });
        e.sentAt = tick; this.zoneEgressTimeoutResent++;
      }
    }
  },
  // 런타임 존 산출 뷰 버퍼 질의(step-0320·#9 후속) — 그 host 프로세스 런타임 존이 산출해 버퍼링 싱크에 쌓은 view frame 원본 배열({to, payload}…). 다운스트림 뷰의 *내용*(누가 무엇을 보나)을 검증하는 창(AOI 정확성·전파 무손실). 미가동 존 []. 읽기 전용.
  zoneViewBuf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return (rt && rt.zone.net && rt.zone.net.buf) ? rt.zone.net.buf : []; },
  // 세션이 본 entity 집합 질의(step-0322·#9 후속) — 그 세션에 산출된 view 들의 enter 를 누적한 id 집합(=그 세션이 *언젠가 한 번이라도 AOI 안에서 본* entity 들). 두 avatar 가 가까워지면 서로의 집합에 들어온다(상호 가시·enter 델타). 미가동/미존재 빈 집합. 읽기 전용.
  zoneViewEntered(zoneId, sessionId) {
    const set = new Set();
    for (const s of this.zoneViewBuf(zoneId)) { const p = s.payload; if (p.type !== 'view_delta' || p.sessionId !== sessionId) continue; for (const e of p.enter) set.add(e.id); }
    return [...set].sort();
  },
  // 런타임 존 다운스트림 전 정합 술어(step-0330·#9 후속 capstone) — 그 존의 다운스트림 데이터 평면이 *완전히 건강한지*의 단일 술어: ⒜ zoneViewConserved(모든 frame 이 한 세션에 귀속·고아 0·0329) ⒝ zoneViewAllKeyed(모든 활성 세션이 초기 keyframe·무굶김·0328) ⒞ zoneViewWire().serializable(전부 와이어 준비·0325). 참이면 "host 가 산출한 AOI 뷰가 빠짐없이 주소를 갖고·아무도 안 굶고·소켓을 탈 준비가 됐다". 혼합 lifecycle(enter/move/leave/migrate) 뒤 참(capstone). 미가동 존 자명 참. 읽기 전용.
  downstreamCoherent(zoneId) {
    return this.zoneViewConserved(zoneId) && this.zoneViewAllKeyed(zoneId) && this.zoneViewWire(zoneId).serializable;
  },
  // 런타임 존 다운스트림 무손실 회계 술어(step-0329·#9 후속) — 산출된 모든 view frame 이 *정확히 한 세션*에 귀속되는가(고아 frame 0): ⒜ 모든 view/view_delta frame 이 비어있지 않은 sessionId 를 가진다(주소 없는 = 배달 불가 frame 없음) ⒝ 세션별 total 합 == 전체 frame 수(분배 무손실). 참이면 host 가 산출한 다운스트림 뷰가 빠짐없이 누군가에게 배달될 주소를 갖는다. 미가동 존 자명 참. 읽기 전용.
  zoneViewConserved(zoneId) {
    const buf = this.zoneViewBuf(zoneId); let frames = 0; const sids = new Set();
    for (const s of buf) { const p = s.payload; if (p.type !== 'view' && p.type !== 'view_delta') continue; frames++; if (!p.sessionId) return false; sids.add(p.sessionId); }
    let sum = 0; for (const sid of sids) sum += this.zoneViewStats(zoneId, sid).total;
    return sum === frames;
  },
  // 런타임 존 세션 keyframe 충족 술어(step-0328·#9 후속) — 그 존의 *모든 활성 세션*(rt.zone.sessions)이 적어도 한 번 reset keyframe(초기 전체 뷰)을 받았는가. 한 세션도 굶기지 않는다(no-starvation·접속한 플레이어는 누구나 자기 세계를 받는다 = 다운스트림 무손실의 토대). 미가동 존은 자명 참. 읽기 전용.
  zoneViewAllKeyed(zoneId) {
    const rt = this.zoneRuntimes.get(zoneId); if (!rt) return true;
    for (const sid of rt.zone.sessions.keys()) if (this.zoneViewStats(zoneId, sid).resets < 1) return false;
    return true;
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
  // 런타임 존 권위 AOI 서명 질의(step-0343·#9 후속) — avatar 가 *지금* 봐야 할 AOI 의 id@x,y 서명(host 권위 — DownClient.seenSig() 와 같은 형식). 둘이 같으면 desync 0(host 가 본 위치 == 클라가 보는 위치). 위치까지 비교(0342 의 id-only 보다 강함). 미가동/미존재 ''. 읽기 전용.
  zoneAuthSig(zoneId, avatar) {
    const rt = this.zoneRuntimes.get(zoneId); if (!rt) return '';
    const me = rt.zone.ents.get(avatar); if (!me) return '';
    return [...rt.zone.visibleFor(me).entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';');
  },
  // 런타임 존 산출 뷰 질의(step-0319·#9 후속·downstream 데이터 평면) — 그 host 프로세스가 onTick 으로 산출해 *버퍼링 싱크*에 쌓은 view/view_delta frame 수(미가동 존 0). 0282 까지 런타임 존의 뷰는 no-op 싱크로 드롭됐다 — 이 질의가 "host 가 실제로 AOI 뷰를 만들어 내보낼 준비가 됐나"를 본다(SPINE §4 경로2 월드 다운스트림의 씨앗). 읽기 전용.
  zoneViewsFor(zoneId) { const rt = this.zoneRuntimes.get(zoneId); if (!rt || !rt.zone.net || !rt.zone.net.buf) return 0; let n = 0; for (const s of rt.zone.net.buf) if (s.payload.type === 'view' || s.payload.type === 'view_delta') n++; return n; },
  // 전 런타임 산출 뷰 총수 질의(step-0319·#9 후속) — 모든 host 프로세스 런타임 존이 산출한 view/view_delta frame 합. >0 이면 다운스트림 데이터 평면(host→세션 뷰)이 실제로 frame 을 만든다는 증거. 읽기 전용.
  zoneViewFrames() { let n = 0; for (const z of this.zoneRuntimes.keys()) n += this.zoneViewsFor(z); return n; },
};

const __part = { OrchViews };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_views = __part;
