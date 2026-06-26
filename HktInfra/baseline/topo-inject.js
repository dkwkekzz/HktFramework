'use strict';
// step-0306 — #9 잔여(실 host.js 물리 분리): zoneHostStaleProbe 주입(같은 tick 존 frame+migrate→host inbox drain 시 떠난 존 frame 거부 검증·이중 쓰기 방지). 미제공이면 휴면(reg 0).
// step-0296 — #9 멀티프로세스 배선 6: zoneStaleProbe 주입(낡은 host 단 zoneDeliver→orch host 불일치 거부 검증·이주 라우팅 정합). 미제공이면 휴면(reg 0).
// step-0294 — #9 멀티프로세스 배선 4: gatewayDirectZone ON 이면 entityOps 를 게이트웨이로 라우팅(클라→게이트웨이 직접 라우팅). OFF→0281 경로(게이트웨이→orch).
// step-0281 — #56 브리지 존 데이터 평면 1: entityOps 주입열(게이트웨이→orch zoneEnter/zoneMove/zoneLeave). 미제공이면 휴면(reg 0).
// step-0261 정리 분할(#49 wiring) — topo-run.js 가 35.9KB>30KB 박스 트리거를 다시 넘겨, run() 의 *per-tick 제어 평면 메시지 주입*
//   (rankDie/rankStall/producerInject/presenceFailover/whispers~loginOps/inject — 정규 net.send·box.onMsg 주입열)을 topo-inject.js 로 분리한다.
//   verbatim 이동·ctx 핸들만 주입·기능 0 → reg 0(0260 비트 동일). 0098 topo-actors·0133 topo-subs·0141 topo-run 분할의 계보(이번엔 주입열).
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.topo_inject). 외부 의존 0(ctx 핸들·opts·tick i 만).
//   ctx = run() 이 makeActor 후 보유한 박스 핸들 묶음. 미수신 박스는 null(해당 가드가 휴면=reg 0 불변).
function applyInjections(opts, i, ctx) {
  const { net, map, ranking, inventory, bus, presence, presenceShadow, wrouter, mbox, presmon, exchange, mail, mailfeed, pservice, guild, instance, orch, cache, worldlog, loginqueue } = ctx;
    // 소비자 영구 다운(이 step·rankDie) — ranking 이 지정 tick 에 svc.item.out 구독을 해지하고 영영 재구독하지 않는다(영구 뒤처진 소비자 = 0044 §9 자극).
    //   이후 ranking 은 결과를 못 받아 ack 가 끊긴다 → consumerWm 고정 → min-워터마크가 그 frontier 에 묶여 outBuffer 무계 성장(busConsumerLease OFF). lease ON 이면 가방이 leaseSpan 뒤처짐 후 축출 → drain.
    //   busReSub unsub 경로(0033) 재사용 — 정규 제어 평면(시드 로그의 일부 = 결정론). 미설정이면 휴면(reg 0 불변·멀티프로세스 E2E 는 미주입).
    if (opts.rankDie && ranking && i + 1 === opts.rankDie) net.send('ranking', 'bus', { type: 'unsub', topic: 'svc.item.out' });
    // 소비자 *일시* 정지(step-0052·rankStall) — ranking 이 at 에 unsub 하고 until 에 re-sub(영구 rankDie 와 달리 복귀). 큰 *일시* gap 1개 생성(cadence 급변 자극·윈도 감쇠 검증용).
    //   재-ack 시 그 stall gap 이 cadence 관측치로 기록 → 전체 러닝 max(OFF)는 영영 보유(임계 영구 과대) vs 윈도(ON)는 K acks 뒤 창 밖으로 늙어 감쇠. 영구 rankDie 와 동형 제어 평면(unsub/sub·시드 로그 = 결정론). 미설정이면 휴면(reg 0 불변).
    if (opts.rankStall && ranking) {
      if (i + 1 === opts.rankStall.at) net.send('ranking', 'bus', { type: 'unsub', topic: 'svc.item.out' });
      if (i + 1 === opts.rankStall.until) { net.send('ranking', 'bus', { type: 'sub', topic: 'svc.item.out' }); if (opts.busResend && inventory) inventory.resendOut(); }
    }
    // 다중 게이트웨이 producer 자극(이 step·producerInject) — 둘째 게이트웨이(gateway2)가 버스 seam 에 svc.item 요청을 발행(producer-local reqId 가 gateway1 과 겹침).
    //   가방은 버스 너머라 발신 게이트웨이를 구별 못 한다(은닉) — producer 태그가 유일한 네임스페이스 신호. op={at,reqId,avatar,producer}. 정규 svc.item pub(실제 둘째 게이트웨이가 발신할 메시지와 동형).
    //   busProducerNs OFF 면 가방이 reqId 만으로 dedup → gateway1 의 같은 reqId 와 충돌(둘째 producer 요청 폐기·손실). ON 이면 (producer,reqId) 분리 → 충돌 0. 미설정이면 휴면(reg 0 불변).
    if (opts.producerInject && bus) for (const op of opts.producerInject) if (op.at === i + 1) net.send('gateway', 'bus', { type: 'pub', topic: 'svc.item', ev: { type: 'item_req', op: 'pickup', avatar: op.avatar, reqId: op.reqId, producer: op.producer } });
    // 프레즌스 박스 failover 승격(step-0067·presenceFailover) — at tick 에 primary 프레즌스 박스 crash(RAM 소실·이후 보고 무시·발행 0). presencePromote ON 이면 같은 tick 에 standby(presence2)를 promote(active=true)해 발행을 인계.
    //   shadow 가 이미 모든 보고로 SSOT 를 그림자 복제했으므로(0066) 승격 시점 SSOT 갭 0 — 죽음 *후* 도착하는 보고(예: permanent)를 승격된 standby 가 svc.presence 로 발행 → 다운스트림(presmon)이 전 전이열(down→permanent) 무손실 수신.
    //   미승격(presencePromote OFF·대조군)이면 primary 만 죽고 standby 는 passive → 죽음 후 전이는 영영 미발행(failover 가 막는 갭). presenceFailover 미제공이면 휴면(crash 0·reg 0 불변·0066 비트 동일).
    if (opts.presenceFailover && presence && i + 1 === opts.presenceFailover.at) {
      presence.crash();
      if (opts.presencePromote && presenceShadow) presenceShadow.promote(i + 1);
    }
    // 귓속말 라우팅 주입(step-0071·whisperRouter) — at tick 에 클라가 라우터(wrouter)로 귓속말 요청 발신(클라→라우터→presence 질의→라우팅).
    //   w={at, from, to, body} — 정규 net.send(client→wrouter·시드 로그의 일부 = 결정론). 라우터가 다음 step 부터 presence SSOT 질의→대상 상태로 전달/반송.
    //   wrouter 부재(whisperRouter OFF)면 주입 0 = 라우팅 없음(대조군). 미제공이면 휴면(reg 0 불변·멀티프로세스 E2E 미주입).
    if (opts.whispers && wrouter) for (const w of opts.whispers) if (w.at === i + 1) net.send(w.from || 'client0', 'wrouter', { type: 'whisper', to: w.to, body: w.body });
    // 라우터 재시작 주입(step-0089·wrouterRestart) — at tick 에 wrouter.restart()(deliverySeq 0 리셋·epoch++). epoch 펜싱이 수신측 워터마크 오접힘을 막는지 검증용. wrouter 부재·미제공이면 휴면(reg 0 불변).
    if (opts.wrouterRestart && wrouter) for (const r of [].concat(opts.wrouterRestart)) if (r.at === i + 1) wrouter.restart();   // 단일 {at} 또는 배열(0090·다중 재시작) 둘 다 지원
    // 옛 epoch straggler 주입(step-0091·mboxStraggler) — at tick 에 *지연된 옛 epoch* whisperDeliver 가 Mailbox 에 직접 도착(net.log 밖·digest 불변). epoch grace 가 유예한 닫힌 epoch 워터마크면 정상 dedup, 가지친 뒤면 신규 오인 재수신(0090 §9 한계 노출). mbox 부재·미제공이면 휴면(reg 0 불변).
    if (opts.mboxStraggler && mbox) for (const s of [].concat(opts.mboxStraggler)) if (s.at === i + 1) mbox.onMsg({ from: s.from, payload: { type: 'whisperDeliver', from: s.from, body: s.body, seq: s.seq, epoch: s.epoch } });
    // inbox 드레인 주입(step-0100·mboxDrain) — at tick 에 소유자가 수신함을 읽어 비운다(mbox.drain()). 읽는 이가 있으면 inbox 가 무손실로 유계됨을 보인다(0099 lossy cap 과 짝). mbox 부재·미제공이면 휴면(reg 0 불변). drainAck ON(0101) 이면 파괴적 비움 대신 미확인 체크아웃으로 옮긴다(ack 전 보유·재드레인 무손실).
    if (opts.mboxDrain && mbox) for (const d of [].concat(opts.mboxDrain)) if (d.at === i + 1) mbox.drain();
    // 읽음 확인 주입(step-0101·mboxDrainAck) — at tick 에 소유자가 읽은 *최신* 체크아웃 배치 처리 완료를 확인(mbox.ackDrain(현 checkout.seq)) → 안전 제거(drainAcked 누적). ack 누락 시 체크아웃이 보유돼 재드레인이 무손실 재반환(읽음 손실 복구). mbox 부재·미제공이면 휴면(reg 0 불변).
    if (opts.mboxDrainAck && mbox) for (const a of [].concat(opts.mboxDrainAck)) if (a.at === i + 1) mbox.ackDrain(mbox.checkout ? mbox.checkout.seq : -1);
    // active 공지 메아리 주입(step-0105·presAnnounceStraggler) — at tick 에 *지연/메아리* svc.presence.active 공지가 presmon 에 직접 도착(net.log 밖·digest 불변). announceEpoch ON 이면 epoch 가 실려 낡은 공지는 거부, OFF 면 무조건 재타깃(0070 §9 역-재타깃 노출). presmon 부재·미제공이면 휴면(reg 0 불변).
    if (opts.presAnnounceStraggler && presmon) for (const s of [].concat(opts.presAnnounceStraggler)) if (s.at === i + 1) presmon.onMsg({ from: s.from || 'presence', payload: { type: 'ev', topic: 'svc.presence.active', ev: opts.announceEpoch ? { addr: s.addr, epoch: s.epoch } : { addr: s.addr } } });
    // 라우터 active 공지 메아리 주입(step-0106·whisperAnnounceStraggler) — at tick 에 지연/메아리 svc.presence.active 공지가 wrouter 에 직접 도착. announceEpoch ON 이면 epoch 가 실려 낡은 공지는 거부(역-재타깃·재시도 폭주 방지), OFF 면 무조건 재타깃(0072 §9). wrouter 부재·미제공이면 휴면(reg 0 불변).
    if (opts.whisperAnnounceStraggler && wrouter) for (const s of [].concat(opts.whisperAnnounceStraggler)) if (s.at === i + 1) wrouter.onMsg({ from: s.from || 'presence', payload: { type: 'ev', topic: 'svc.presence.active', ev: opts.announceEpoch ? { addr: s.addr, epoch: s.epoch } : { addr: s.addr } } });
    // 거래소 거래 주입(step-0107·exchangeOps) — at tick 에 list/buy/cancel 메시지를 거래소에 전달(클라/존이 보낸 거래 요청 모델·net.log 밖·digest 불변). 거래소 부재·미제공이면 휴면(reg 0 불변).
    if (opts.exchangeOps && exchange) for (const o of [].concat(opts.exchangeOps)) if (o.at === i + 1) exchange.onMsg({ from: o.from || 'gateway', payload: o.op, tick: i + 1 });   // tick 동봉(step-0114·만료 listedAt 기준)
    // 가방 직접 주입(step-0117·invOps 테스트 seam) — at tick 에 item_req(pickup/give)를 가방에 직접 전달(거래소↔가방 원자 거래 테스트의 판매자 선-적재용·net.log 밖·digest 불변). 가방 부재·미제공이면 휴면(reg 0 불변).
    if (opts.invOps && inventory) for (const o of [].concat(opts.invOps)) if (o.at === i + 1) inventory.onMsg({ from: o.from || 'gateway', payload: o.op });
    // 우편 주입(step-0142·mailOps) — at tick 에 mailSend/mailFetch 메시지를 우편 박스에 전달(발신자/수신자 우편 요청 모델·net.log 밖·digest 불변). tick 동봉(sentAt 기준·0148 만료 TTL 대비). 우편 부재·미제공이면 휴면(reg 0 불변).
    if (opts.mailOps && mail) for (const o of [].concat(opts.mailOps)) if (o.at === i + 1) mail.onMsg({ from: o.from || 'gateway', payload: o.op, tick: i + 1 });
    // 미읽음 배지 질의 주입(step-0156·mailFeedQuery) — at tick 에 mailUnreadQuery 를 게이트웨이→mailfeed 로 전달(클라/운영 배지 조회 모델·request/reply over net). mailfeed 부재·미제공이면 휴면(reg 0 불변).
    if (opts.mailFeedQuery && mailfeed) for (const o of [].concat(opts.mailFeedQuery)) if (o.at === i + 1) net.send(o.from || 'gateway', 'mailfeed', { type: 'mailUnreadQuery', rcpt: o.rcpt });
    // 파티 라우팅 주입(step-0073·1:N 팬아웃) — at tick 에 클라가 라우터로 파티 요청(members 다수) 발신. 라우터가 멤버마다 presence 질의→부분 전달. wrouter 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.parties && wrouter) for (const pt of opts.parties) if (pt.at === i + 1) net.send(pt.from || 'client0', 'wrouter', { type: 'party', members: pt.members, body: pt.body, partyId: pt.partyId });
    // 파티 멤버십 결성 주입(step-0075·partyService) — at tick 에 클라가 PartyService 에 partyCreate(멤버십 SSOT 쓰기). pservice 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.partyCreate && pservice) for (const pc of opts.partyCreate) if (pc.at === i + 1) net.send(pc.from || 'client0', 'pservice', { type: 'partyCreate', partyId: pc.partyId, members: pc.members });
    // 파티 증분 가입/탈퇴 주입(step-0084·partyChange) — at tick 에 클라가 PartyService 에 partyJoin/partyLeave(멤버 델타). pservice 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.partyOps && pservice) for (const po of opts.partyOps) if (po.at === i + 1) net.send(po.from || 'client0', 'pservice', { type: po.op === 'leave' ? 'partyLeave' : 'partyJoin', partyId: po.partyId, member: po.member });
    // 파티 전송 주입(step-0075) — at tick 에 클라가 라우터로 partyTo(멤버 인라인 X·partyId 만). 라우터가 멤버십 SSOT 조회→프레즌스 질의→라우팅(2단). wrouter 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.partyTo && wrouter) for (const pt of opts.partyTo) if (pt.at === i + 1) net.send(pt.from || 'client0', 'wrouter', { type: 'partyTo', partyId: pt.partyId, body: pt.body });
    // 길드 명령 주입(step-0181·guildOps) — at tick 에 클라가 GuildService 에 guildCreate/guildQuery(로스터 SSOT 쓰기/질의). guild 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.guildOps && guild) for (const go of [].concat(opts.guildOps)) if (go.at === i + 1) net.send(go.from || 'client0', 'guild', go.op);
    // 인스턴스 명령 주입(step-0201·instanceOps) — at tick 에 오케스트레이터/게이트웨이가 InstanceServer 에 instanceSpawn(던전 1개 띄움). instance 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.instanceOps && instance) for (const io of [].concat(opts.instanceOps)) if (io.at === i + 1) net.send(io.from || 'orch', 'instance', io.op);
    // 존 배치 명령 주입(step-0203·placementOps) — at tick 에 게이트웨이/운영이 Orchestrator 에 placeZone(존을 host 에 배치). orch 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.placementOps && orch) for (const po of [].concat(opts.placementOps)) if (po.at === i + 1) net.send(po.from || 'gateway', 'orch', po.op);
    // 존 entity 명령 주입(step-0281·#56·entityOps) — at tick 에 zoneEnter/zoneMove/zoneLeave(브리지 존 데이터 평면). orch 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    //   step-0294 (#9) — gatewayDirectZone ON 이면 *게이트웨이*로 보낸다(클라→게이트웨이→자기 디렉토리 해소→직접 라우팅). OFF 면 0281 경로(게이트웨이→orch 직접).
    if (opts.entityOps && orch) for (const eo of [].concat(opts.entityOps)) if (eo.at === i + 1) {
      if (opts.gatewayDirectZone) net.send(eo.from || 'client0', 'gateway', eo.op);
      else net.send(eo.from || 'gateway', 'orch', eo.op);
    }
    // 존 stale 라우팅 프로브 주입(step-0296·#9·zoneStaleProbe) — at tick 에 *낡은 host* 를 단 zoneDeliver 를 게이트웨이 발신으로 orch 에 직접 보낸다(이주 직후 게이트웨이 디렉토리가 뒤처졌을 때의 frame 모델·straggler 류 테스트 seam). orch 가 host!=running 으로 거부(zoneDirStale++·이중 적용 0)함을 검증. orch 부재·미제공이면 휴면(reg 0 불변).
    if (opts.zoneStaleProbe && orch) for (const s of [].concat(opts.zoneStaleProbe)) if (s.at === i + 1) net.send('gateway', 'orch', { type: 'zoneDeliver', op: s.op || 'enter', zoneId: s.zoneId, avatar: s.avatar, host: s.host });
    // host inbox stale 프로브 주입(step-0306·#9 잔여·zoneHostStaleProbe) — at tick 에 *같은 tick* 으로 ① 존 frame(fromHost 단 zoneDeliver·orch 가 host==running 이라 수락→fromHost inbox enqueue) ② 그 존 migrate(fromHost→toHost) 를 *순서대로* 보낸다. orch onTick drain 시 fromHost 는 더는 그 존을 소유 안 함 → frame 거부(zoneHostStale++). fromHost 가 다른 존을 더 가져 컨테이너가 살아있어야 drain 이 일어난다. orch 부재·미제공이면 휴면(reg 0 불변).
    if (opts.zoneHostStaleProbe && orch) for (const s of [].concat(opts.zoneHostStaleProbe)) if (s.at === i + 1) {
      net.send('gateway', 'orch', { type: 'zoneDeliver', op: s.op || 'move', zoneId: s.zoneId, avatar: s.avatar, dx: s.dx != null ? s.dx : 1, dy: s.dy != null ? s.dy : 0, host: s.host });
      net.send('gateway', 'orch', { type: 'placeMigrate', zoneId: s.zoneId, toHost: s.toHost });
    }
    // 캐시 명령 주입(step-0205·cacheOps) — at tick 에 게이트웨이/서비스가 CacheStore 에 cacheSet(핫 데이터 캐시 채움). cache 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.cacheOps && cache) for (const co of [].concat(opts.cacheOps)) if (co.at === i + 1) net.send(co.from || 'gateway', 'cache', co.op);
    // 월드 intent 주입(step-0207·worldOps) — at tick 에 존/게이트웨이가 WorldLog 에 worldAppend(intent 로그 적층). worldlog 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.worldOps && worldlog) for (const wo of [].concat(opts.worldOps)) if (wo.at === i + 1) net.send(wo.from || 'zone1', 'worldlog', wo.op);
    // 로그인 큐 명령 주입(step-0209·loginOps) — at tick 에 클라/게이트웨이가 LoginQueue 에 loginEnqueue/loginDequeue/loginExpire. tick 동봉(0210 만료 기준·우편 mailOps 패턴). loginqueue 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.loginOps && loginqueue) for (const lo of [].concat(opts.loginOps)) if (lo.at === i + 1) loginqueue.onMsg({ from: lo.from || 'gateway', payload: lo.op, tick: i + 1 });
    // 시나리오 inject write-seam(TESTBED §10-4 — 0011 onTick 선례) — 미제공이면 호출 0(reg 0 불변).
    //   cmd={tick,client,move:[dx,dy]} — tick 직전에 클라 발신으로 주입(게이트웨이엔 정규 move 와 동일·시드 로그의 일부 = 결정론).
    if (opts.inject) for (const c of opts.inject) if (c.tick === i + 1 && c.move) net.send('client' + c.client, 'gateway', { type: 'move', d: { dx: c.move[0] | 0, dy: c.move[1] | 0 } });
}

const __part = { applyInjections };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topo_inject = __part;

