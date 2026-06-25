'use strict';
// step-0297 — #9 멀티프로세스 배선 7: onMsg 에 orch hostDown 분기(죽은 host 의 dir 엔트리 일괄 무효화·장애 검출). 미수신이면 이전 비트 동일.
// step-0295 — #9 멀티프로세스 배선 5: onMsg 에 클라 zoneMove/zoneLeave 직접 라우팅 분기(enter 와 동형·zoneDir 해소→zoneDeliver). 미수신(OFF)이면 이전 비트 동일.
// step-0294 — #9 멀티프로세스 배선 4: onMsg 에 클라 zoneEnter 직접 라우팅 분기(zoneDir 해소→zoneDeliver). 미수신(gatewayDirectZone OFF)이면 이전 비트 동일.
// step-0293 — #9 멀티프로세스 배선 3: onMsg 에 orch zoneLoc 분기(존 위치 디렉토리 갱신·서비스 디스커버리). 미수신(gatewayZoneDir OFF)이면 이전 비트 동일.
// step-0270 정리 분할(#49 인접·선제) — gateway.js 가 22.8KB(엣지 핵심 박스·성장)라, Gateway 의 *메시지 라우팅 핸들러*(onMsg:
//   클라 move/item/chat 업스트림 라우팅 + 존/서비스/버스 다운스트림 중계 + 세션 bind/unbind)를 gateway-msg.js 믹스인으로 분리한다.
//   코어가 Object.assign(prototype) 로 되섞음 — 정의 위치만 이동·this 바인딩/메서드 해소 동일·기능 0 → reg 0(0269 비트 동일).
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.gateway_msg). onMsg 가 _svcSend/_itemReq/_relayX(코어 잔류) 호출.
const GatewayMsg = {
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.byAvatar.set(p.avatar, bind);   // 가방·채팅 결과 라우팅용(item_result/chat_out → 대상 클라; service off 면 미사용 → 비-침습)
        this.net.send(this.addr, this.zones[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        if (this.replicas.length) this.net.send(this.addr, this.replicas[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from === 'orch') {
      if (p.type === 'reroute') {
        this.zones = this.zones.map(z => z === p.from ? p.to : z);
        this.replicas = this.replicas.filter(z => z !== p.to && z !== p.retire);
      } else if (p.type === 'zoneLoc') {
        // 존 위치 디렉토리 갱신(step-0293·#9) — orch 가 배치 집행마다 push 한 zone→host 위치를 캐시(서비스 디스커버리). host===null 이면 퇴역(삭제). 게이트웨이는 orch 내부 모른 채 이 명시 메시지로만 학습(은닉). 미수신(gatewayZoneDir OFF)이면 이 분기 영영 안 옴 = 이전 비트 동일.
        if (p.host === null || p.host === undefined) this.zoneDir.delete(p.zoneId);
        else this.zoneDir.set(p.zoneId, p.host);
      } else if (p.type === 'hostDown') {
        // host 장애 일괄 무효화(step-0297·#9) — 죽은 host 의 모든 dir 엔트리 삭제(장애 검출 신호). 구조된 존은 _bridgeHostDown 의 survivor zoneLoc 가 *먼저* 도착해 새 host 로 이미 갱신됨(삭제 대상 아님) → 미구조(생존 host 없는) 존만 정리. 게이트웨이가 죽은 host 로 직접 라우팅하지 않게 보장. 미수신이면 이전 비트 동일.
        for (const [z, h] of [...this.zoneDir]) if (h === p.host) this.zoneDir.delete(z);
        this.gatewayHostInvalidated++;
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', entities: p.entities });
      } else if (p.type === 'view_delta') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view_delta', reset: p.reset, enter: p.enter, exit: p.exit, update: p.update, seq: p.seq });
      }
      return;
    }
    if (this.bus && m.from === this.bus) {
      // 버스 구독 수신(ev 봉투) — 게이트웨이는 *토픽*만 안다(서비스 주소 무지). 중계는 직접 모드와 같은 함수(클라 계약 불변).
      if (p.type === 'ev') {
        if (p.topic === 'svc.item.out') { this._relayItemResult(p.ev); this._relayItemRecon(p.ev); this._ackOut(p.ev); }   // item_result + item_recon_map 중계 + 결과 ack(이 step·busOutAck)
        else if (p.topic === 'svc.item.ack') this._onItemAck(p.ev);   // 요청 ack(0040·busAck) — inBuffer 자기-크기조정 가지치기

        else if (p.topic === 'svc.chat.out') this._relayChatOut(p.ev);
        else if (p.topic === 'svc.rank.out') this._relayRank(p.ev);   // 랭킹(이 step) — 발신하는 소비자의 출력 중계
      }
      return;
    }
    if (m.from === this.inventory) {
      this._relayItemResult(p);
      this._relayItemRecon(p);   // id-reconciliation 응답 중계(이 step) — item_recon_map 클라로. item_result 와 같은 직접 모드.
      return;
    }
    if (m.from === this.chat) {
      this._relayChatOut(p);
      return;
    }
    if (p.type === 'connect') {
      if (this.byClient.has(m.from)) { this.rejected++; this.net.send(this.addr, m.from, { type: 'connect_fail' }); return; }
      this.net.send(this.addr, 'registry', { type: 'validate', ticket: p.ticket, ref: m.from });
    } else if (p.type === 'move') {
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'move', sessionId: bind.sessionId, avatar: bind.avatar, d: p.d });
      else this.dropped++;
    } else if (p.type === 'resync') {
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'resync', sessionId: bind.sessionId });
      else this.dropped++;
    } else if (p.type === 'item_pickup') {
      // 가방 분리 — 아이템 인텐트는 *존을 우회*해 서비스 경로로(존 tick 비-침습). 버스 ON 이면 svc.item 토픽 발행(주소 무지).
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._itemReq({ type: 'item_req', op: 'pickup', avatar: bind.avatar });
      else this.dropped++;
    } else if (p.type === 'item_give') {
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._itemReq({ type: 'item_req', op: 'give', fromAvatar: bind.avatar, toAvatar: p.toAvatar, itemId: p.itemId });
      else this.dropped++;
    } else if (p.type === 'item_reconcile') {
      // id-reconciliation 요청(이 step·mintRecon) — 클라가 보낸 belief 목록을 가방에 전달. 가방이 없는 id 를 re-mint.
      //   클라가 avatar 를 포함하지 않아도 됨 — 게이트웨이가 bind.avatar 로 주입(은닉 유지: 클라는 서비스 내부 주소 모름).
      //   버스 ON 이면 svc.item 토픽 발행(주소 무지 — item_pickup/give 와 같은 경로). mintRecon OFF 면 클라가 메시지 0 → 도달 0(reg 0 불변).
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._itemReq({ type: 'item_reconcile', reqAvatar: bind.avatar, owned: p.owned });
      else this.dropped++;
    } else if (p.type === 'chat_join') {
      // 채팅 분리 — 구독 인텐트는 *존을 우회*해 서비스 경로로(존 tick 비-침습). 버스 ON 이면 svc.chat 토픽 발행(주소 무지).
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.chat)) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'join', avatar: bind.avatar, region: p.region });
      else this.dropped++;
    } else if (p.type === 'chat_say') {
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.chat)) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'say', fromAvatar: bind.avatar, scope: p.scope, seq: p.seq });
      else this.dropped++;
    } else if (p.type === 'chat_whisper') {
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.chat)) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'whisper', fromAvatar: bind.avatar, toAvatar: p.to, seq: p.seq });
      else this.dropped++;
    } else if (p.type === 'zoneEnter') {
      // 게이트웨이 직접 존 라우팅(step-0294·#9) — 자기 zoneDir 로 존 host(런타임)를 해소해 그 host 로 entity enter frame 을 직접 보낸다(orch 데이터 평면 우회·라우팅 *결정*이 게이트웨이에). 디렉토리 미스(미배치/미학습)면 드롭(은닉 — 게이트웨이는 orch 내부 모름). 현재 zone-host 는 orch 가 보유하므로 host 태깅해 zoneDeliver 로 전달(orch 가 일치 검증·적용)·실 host.js 완전 분리는 #9 후속. 미수신(gatewayDirectZone OFF)이면 이 분기 영영 안 옴 = 이전 비트 동일.
      const host = this.zoneDir.get(p.zoneId);
      if (host === undefined) { this.gatewayZoneMisses++; return; }
      this.net.send(this.addr, 'orch', { type: 'zoneDeliver', op: 'enter', zoneId: p.zoneId, avatar: p.avatar, sessionId: p.sessionId, host });
      this.gatewayZoneRoutes++;
    } else if (p.type === 'zoneMove') {
      // 게이트웨이 직접 존 move 라우팅(step-0295·#9·enter 와 동형) — zoneDir 로 host 해소→zoneDeliver(move). 미스면 드롭. 미수신(OFF)이면 이전 비트 동일.
      const host = this.zoneDir.get(p.zoneId);
      if (host === undefined) { this.gatewayZoneMisses++; return; }
      this.net.send(this.addr, 'orch', { type: 'zoneDeliver', op: 'move', zoneId: p.zoneId, avatar: p.avatar, dx: p.dx, dy: p.dy, host });
      this.gatewayZoneRoutes++;
    } else if (p.type === 'zoneLeave') {
      // 게이트웨이 직접 존 leave 라우팅(step-0295·#9·enter 와 동형) — zoneDir 로 host 해소→zoneDeliver(leave). 미스면 드롭. 미수신(OFF)이면 이전 비트 동일.
      const host = this.zoneDir.get(p.zoneId);
      if (host === undefined) { this.gatewayZoneMisses++; return; }
      this.net.send(this.addr, 'orch', { type: 'zoneDeliver', op: 'leave', zoneId: p.zoneId, avatar: p.avatar, host });
      this.gatewayZoneRoutes++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      if (this.bus || this.chat) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'leave', avatar: bind.avatar });   // 구독 테이블 대칭 정리(stale 팬아웃 방지)
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
      this.byAvatar.delete(bind.avatar);   // 가방·채팅 라우팅 인덱스도 대칭 정리(stale bind 로 결과 오라우팅 방지)
    }
  }
};

const __part = { GatewayMsg };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).gateway_msg = __part;

