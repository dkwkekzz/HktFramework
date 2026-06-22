'use strict';
// step-0048 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// 정리 step: topology.js 가 31KB>30KB 박스 트리거를 넘겨, *토폴로지 구성*(routeFilters·buildTopology·makeActor)을
//   topo-build.js 로 분리했다. 이 파일은 *run 드라이버 + 진입점*(quorumMergeJournals·run·runMulti)으로 남고,
//   build 부품을 require 해 동일 export 를 노출한다 — 기능 0·바이트 동일·export 불변 → reg 0(0037 비트 동일).
// dual-mode: Node require / 브라우저는 common.js·박스 파일을 <script> 선행 로드(전역 __HktNetCommon·__HktNetParts).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, fnv1a } = __c;
const __p = n => (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];
const { inflightSet, replicaDivergence } = __p('metrics');
// 토폴로지 구성 부품(이 step 분할) — routeFilters·buildTopology·makeActor 를 topo-build.js 에서 가져와 run 이 쓰고 진입점이 재노출.
const { routeFilters, buildTopology, makeActor } = __p('topo-build');

// ════════════════════════════════════════════════════════════════════════
//  run — 인프로세스 모드(engine/Net). 0009 와 *비트 동일*(reg 0). 단일 경로(buildTopology+makeActor)로 구성.
// ════════════════════════════════════════════════════════════════════════
// N-replica quorum read(이 step) — 생존 복제 저장소들의 저널을 seq 로 union(dedup) → 완전 저널 재구성.
//   각 복제가 전송 손실로 *부분* 저널만 가져도 union 이 메운다(어떤 seq 든 ≥1 생존 복제에 있으면 복구 = quorum read 의 핵심·단일 복제보다 강함).
//   snapshot 은 upToSeq 최대인 것 채택(압축 OFF 면 전부 null). 죽은(crash) 스토어는 journal=[] → 기여 0 → 자연히 생존 복제만 union.
function quorumMergeJournals(stores) {
  const bySeq = new Map();
  let snapshot = null;
  for (const s of stores) {
    if (!s) continue;
    for (const e of s.journal) if (!bySeq.has(e.seq)) bySeq.set(e.seq, e);
    if (s.snapshot && (!snapshot || s.snapshot.upToSeq > snapshot.upToSeq)) snapshot = s.snapshot;
  }
  const journal = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  return { journal, snapshot };
}

function run(opts) {
  const { seed, ticks = 48, transport = null, onTick = null } = opts;
  const topo = buildTopology(opts);
  const net = new Net({ transport, seed });
  const map = new Map();
  for (const spec of topo.specs) map.set(spec.addr, makeActor(spec, net));

  const gateway = map.get('gateway');
  const login = map.get('login');
  const registry = map.get('registry');
  const orch = map.get('orch') || null;
  const inventory = map.get('inventory') || null;
  const chat = map.get('chat') || null;
  const bus = map.get('bus') || null;
  const busSubs = bus ? ((topo.specs.find(s => s.addr === 'bus') || {}).opts || {}).subs || [] : [];   // 정적 subs spec(재협상 원천 — "소비자가 무엇을 구독했나"·0034 버스 failover)
  const audit = map.get('audit') || null;
  const ranking = map.get('ranking') || null;
  const ranking2 = map.get('ranking2') || null;   // 대체 소비자(step-0061·spawnReplace) — standby. spawnReplace OFF 면 null(0060 동일).
  const presmon = map.get('presmon') || null;      // 프레즌스 모니터(step-0063·presenceMonitor) — svc.presence 읽기 모델. OFF 면 null(0062 동일).
  const presence = map.get('presence') || null;    // 전용 프레즌스 박스(step-0064·presenceBox) — 프레즌스 SSOT. OFF 면 null(0063 동일).
  const presenceShadow = map.get('presence2') || null;   // 프레즌스 박스 shadow(step-0066·presenceShadow) — standby PresenceService. 같은 보고로 SSOT 그림자 복제(active=false·발행 0). OFF 면 null(0065 동일).
  const wrouter = map.get('wrouter') || null;       // 귓속말 라우터(step-0071·whisperRouter) — 프레즌스 질의로 라우팅. OFF 면 null(0070 동일).
  const pservice = map.get('pservice') || null;     // 파티 멤버십 SSOT(step-0075·partyService) — 멤버십 보유. OFF 면 null(0074 동일).
  const mbox = map.get('mbox') || null;             // 귓속말 수신 박스(step-0076·whisperReceipt) — Mailbox. OFF 면 null(0075 동일).
  const mbox2 = map.get('mbox2') || null;           // 둘째 수신 박스(step-0096·mailbox2) — 멤버별 Mailbox. OFF 면 null(0095 동일).
  const persist = map.get('persist') || null;
  const persist2 = map.get('persist2') || null;
  // N-replica 복제 스토어 핸들(이 step) — persistReplicas≥1 이면 'persist2'..'persistN+1'. [] 면 0027 복구 경로(persist2 단일).
  const replicaAddrs = (opts.persistReplicas >= 1) ? Array.from({ length: opts.persistReplicas }, (_, k) => 'persist' + (k + 2)) : [];
  const replicaStores = replicaAddrs.map(a => map.get(a)).filter(Boolean);
  const chatpersist = map.get('chatpersist') || null;
  const zoneObjs = topo.zoneAddrs.map(a => map.get(a));
  const followers = ['zone1f', 'zone2f'].map(a => map.get(a)).filter(Boolean);
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => map.get(s.addr));
  const allZones = zoneObjs.concat(followers);

  const trace = [], seenTrace = [], deltaTrace = [], replicaTrace = [];
  let prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    // 가방 서비스 failover(이 step) — invRestart.at tick 의 deliver *직전*에 crash+replay. 제어 평면(net.log 비-기여) → 멀티프로세스와 비트 동일.
    //   인프로세스 모델: 같은 inventory 객체를 crash()(RAM 소실)한 뒤 PersistStore 저널을 replay(persist ON) → 죽기 전 원장 재현(복구 투명).
    //   persist OFF 면 replay 없음(원장 비고 = 영속 부재의 대가 = 대조군). PersistStore 는 *별 박스*라 crash 의 영향을 안 받는다(데이터 계층 = 세션보다 오래).
    //   주의(write-behind 윈도): 저널은 1-tick 비동기라 crash 시점에 in-flight 항목이 있으면 손실 — 시나리오는 가방이 *정지(quiescent)* 한 늦은 tick 에 재시작해 투명(후속: ack/resend·스냅샷 압축).
    // PersistStore failover(이 step) — persistRestart.at tick 에 primary persist crash(RAM 소실). persist2 가 이 시점까지 전체 저널 보유 → invRestart 가 persist2 에서 복구.
    //   대조군(persistBackup OFF): persist crash → journal 소실 → invRestart replay 불가 → 원장 소실(invDigest 불일치).
    if (opts.persistRestart && i + 1 === opts.persistRestart.at) {
      if (persist) persist.crash();
      // N-replica(이 step) — 지정 복제도 함께 죽임(생존 복제 union 으로 복구되는지 검증). 죽은 스토어는 journal 빔 → merge 기여 0.
      for (const a of (opts.replicaKills || [])) { const s = map.get(a); if (s) s.crash(); }
    }
    if (opts.invRestart && inventory && i + 1 === opts.invRestart.at) {
      inventory.crash();
      if (replicaStores.length) {
        // N-replica quorum-merge 복구(이 step) — 생존 복제(+primary)들의 저널 union → replay. primary 포함 최대 N개 죽어도 무손실(생존 복제가 메움).
        const merged = quorumMergeJournals([persist, ...replicaStores]);
        inventory.replay(merged.journal, merged.snapshot);
      } else {
        // persistBackup ON(0027) 이고 primary 가 crash 된 경우 persist2 에서 복구 — 단일점 제거 가설.
        const recoveryPersist = (persist2 && opts.persistRestart) ? persist2 : persist;
        if (recoveryPersist) inventory.replay(recoveryPersist.journal, recoveryPersist.snapshot);   // 스냅샷(0018)+tail replay — 압축 OFF 면 snapshot=null(0017 전체 저널)
      }
    }
    // in-flight give 손실 복구(이 step) — clientResync.at 의 deliver *직전*에 클라들이 확인된 give 를 *재발행*(가방 복구 핸드셰이크의 클라 측).
    //   복구 원장은 in-flight 손실 give 효과가 빠져 있다(아이템이 sender 소유로 되돌려짐) → 재발행이 그 전송을 재적용 → 원장이 클라 belief 따라잡음(itemDesync→0).
    //   제어 평면 트리거(invRestart 처럼 run 루프가 주입) — 재발행 메시지는 client→gateway→inventory 정규 라우팅. clientResync 미제공/clientResend OFF 면 호출 0(reg 0 불변).
    if (opts.clientResync && i + 1 === opts.clientResync.at) for (const c of clis) { c.resendGives(); c.sendReconcile(); }   // 0025 give-resend + 이 step mint reconcile 동시 트리거
    // 읽기 모델(랭킹) failover(이 step 의 한 조각) — rankRestart.at 의 deliver *직전*에 crash+reconstruct(invRestart 와 같은 위치·제어 평면).
    //   읽기 모델은 *자기 영속이 없다* — crash(RAM 소실) 후 *쓰기 모델의 영속 저널*(PersistStore)을 reconstruct 해 투영을 재계산한다
    //   (CQRS late-join: 휘발 svc.item.out 스트림이 아니라 *내구 저널*이 복구원). persist OFF 면 reconstruct 없음 = 투영 소실(영속 부재의 대가 = 대조군).
    //   늦은 quiescent tick(활동 정지 후)이라 클라 rankBelief 는 이미 수렴 — 재발행 불필요(rankDesync 0 유지). PersistStore 는 별 박스라 ranking 죽음과 독립.
    if (opts.rankRestart && ranking && i + 1 === opts.rankRestart.at) {
      ranking.crash();
      if (persist) ranking.reconstruct(persist.journal, persist.snapshot);   // 쓰기 저널 replay → 투영 재계산(스냅샷 압축 베이스 + tail). persist OFF → 소실.
    }
    // 대체 소비자 late-join reconstruct(step-0062·spawnReconstruct) — 0061 의 대체 소비자(ranking2)는 *활성화 이후* 결과만 인계해 다운타임(원 ranking 사망~활성화) 중 놓친 효과만큼 투영이 원장에 뒤처진다(0061 §9 의 정직한 한계).
    //   여기서 그 갭을 메운다: 활성화된 ranking2 가 *쓰기 모델의 영속 저널*(PersistStore)을 reconstruct(=ranks 리셋 후 전수 재계산) → 다운타임 이력까지 복원해 투영==원장(0020 의 읽기 모델 late-join 을 *대체 소비자*에 적용).
    //   reconstruct 는 ranks 를 *리셋-재구성*(this.ranks=new Map())하므로 라이브 소비분과 이중 계산 0. 늦은 quiescent tick(opts.reconstructAt — 활동 정지 후)이라 이후 라이브 효과가 없어 저널이 완전 = 투영 완전. spawnReconstruct OFF·미활성·persist 부재면 휴면 = 0061 비트 동일(reg 0).
    if (opts.spawnReconstruct && ranking2 && ranking2.activated && persist && i + 1 === opts.reconstructAt) {
      ranking2.reconstruct(persist.journal, persist.snapshot);
    }
    // 채팅 서비스 failover(이 step 의 한 조각) — chatRestart.at 의 deliver *직전*에 crash+replay(invRestart 와 같은 위치·제어 평면·net.log 비-기여).
    //   가방(0017)이 *효과 저널*(mint/xfer)을 replay 했다면, 채팅은 *커맨드 로그*(join/say/whisper/leave)를 replay 해 라우팅 테이블+deliveries 를
    //   리듀서 재실행으로 재현(순수 event sourcing·재발신 0). chatpersist OFF 면 replay 없음 = 구독/배달 소실(영속 부재의 대가 = 대조군).
    //   늦은 quiescent tick(채팅 정지 후)라 클라 belief 는 이미 수렴. PersistStore 는 별 박스라 채팅 죽음과 독립(데이터 계층 = 세션보다 오래).
    if (opts.chatRestart && chat && i + 1 === opts.chatRestart.at) {
      chat.crash();
      if (chatpersist) chat.replay(chatpersist.journal, chatpersist.snapshot);   // 라우팅 스냅샷(이 step)+tail 커맨드 replay → 라우팅+deliveries 재현. chatpersist OFF → 소실.
    }
    // 버스 동적 구독/해지(이 step) — busReSub.at tick 의 net.step *직전*에 지정 소비자가 bus 에 sub/unsub 발신(제어 평면·정규 라우팅).
    //   op={at,from,type:'sub'|'unsub',topic} — actor→bus 정규 net.send(시드 로그의 일부 = 결정론). 버스가 다음 step 에서 처리해 라우팅 테이블을 *양방향*으로 갱신.
    //   미제공이면 호출 0(reg 0 불변 — unsub/동적 sub 코드 휴면). 멀티프로세스 E2E 는 busReSub 를 안 주므로 cluster.js 무수정.
    if (opts.busReSub && bus) for (const op of opts.busReSub) if (op.at === i + 1) net.send(op.from, 'bus', { type: op.type, topic: op.topic });
    // 버스 failover(이 step) — busRestart.at 에 bus.crash()(라우팅 RAM 소실 → 서비스 경로 단절), renegAt 에 *구독 재협상*(0033 동적 sub).
    //   버스는 파생 상태(라우팅)만 들고 진실 원천은 소비자다 → 복구 = 소비자들이 (같은 주소의) 버스에 *재구독*(정적 subs spec 을 sub 메시지로 재발신).
    //   renegAt 없으면 재협상 0 = 영구 단절(대조군 — 버스 단일점의 대가). busRestart 미제공이면 crash 0(reg 0 불변). 발행자(gateway/inventory…)는 같은 'bus' 주소라 무수정.
    if (opts.busRestart && bus) {
      if (i + 1 === opts.busRestart.at) bus.crash();
      if (opts.busRestart.renegAt && i + 1 === opts.busRestart.renegAt) {
        // 다중 소비자 min-워터마크 데모(이 step·rankRenegAt) — ranking 재구독을 게이트웨이보다 *늦춘다*(비대칭 복구).
        //   rankRenegAt 미설정이면 ranking 도 여기서 재구독(0043 비트 동일). 설정 시 ranking 구독만 보류 → 아래 rankRenegAt 블록에서 재구독.
        for (const [topic, addr] of (busSubs || [])) { if (opts.rankRenegAt && addr === 'ranking') continue; net.send(addr, 'bus', { type: 'sub', topic }); }   // 각 소비자가 재구독(재협상) → 라우팅 재구성
        // 요청 경로 무손실(이 step·busResendReq) — 재구독 직후 게이트웨이가 보관한 svc.item *요청*을 재발행(producer replay).
        //   재구독 sub 메시지가 먼저 큐에 들어가므로(같은 tick·FIFO) bus 가 sub→pub 순으로 처리 = 라우팅 복구 후 fan-out → gap 에 떨군 요청이 가방에 도달해 mint/xfer(원장이 base 따라잡음).
        //   가방이 reqId 로 dedup(gap 전 도달분 재발행은 무해) → 이중 mint 0. busResendReq OFF 면 resendIn() 즉시 반환(reg 0 불변). 재협상 없으면 호출 0(라우팅 죽은 채 = 대조군).
        if (opts.busResendReq) { const gw = map.get('gateway'); if (gw) gw.resendIn(); }
        // 결과 경로 무손실(0036·busResend) — 재구독 직후 가방이 보관한 svc.item.out 결과를 재발행(producer replay).
        //   busResend OFF 면 resendOut() 즉시 반환(reg 0 불변). 재협상(renegAt) 없으면 호출 0(라우팅 죽은 채라 재발행 무의미 = 대조군).
        if (opts.busResend && inventory) inventory.resendOut();
      }
      // ranking 늦은 재구독(이 step·rankRenegAt) — 게이트웨이 복구(renegAt) *후* ranking 이 뒤늦게 재구독 + 결과 재발행.
      //   단일 워터마크면 outBuffer 가 게이트웨이 ack 로 이미 가지쳐져 ranking 이 굶는다(starve → rankProjection 깨짐). min-워터마크면 ranking frontier 가 min 을 눌러 buffer 보존 → 재발행이 따라잡힌다.
      //   미설정이면 이 블록 휴면 = 0043 비트 동일. ranking 의 outSeq dedup 이 재발행×live 중복을 멱등 폐기(counts 이중 적용 0).
      if (opts.rankRenegAt && i + 1 === opts.rankRenegAt) {
        for (const [topic, addr] of (busSubs || [])) if (addr === 'ranking') net.send(addr, 'bus', { type: 'sub', topic });
        if (opts.busResend && inventory) inventory.resendOut();
      }
    }
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
    // 파티 라우팅 주입(step-0073·1:N 팬아웃) — at tick 에 클라가 라우터로 파티 요청(members 다수) 발신. 라우터가 멤버마다 presence 질의→부분 전달. wrouter 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.parties && wrouter) for (const pt of opts.parties) if (pt.at === i + 1) net.send(pt.from || 'client0', 'wrouter', { type: 'party', members: pt.members, body: pt.body, partyId: pt.partyId });
    // 파티 멤버십 결성 주입(step-0075·partyService) — at tick 에 클라가 PartyService 에 partyCreate(멤버십 SSOT 쓰기). pservice 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.partyCreate && pservice) for (const pc of opts.partyCreate) if (pc.at === i + 1) net.send(pc.from || 'client0', 'pservice', { type: 'partyCreate', partyId: pc.partyId, members: pc.members });
    // 파티 증분 가입/탈퇴 주입(step-0084·partyChange) — at tick 에 클라가 PartyService 에 partyJoin/partyLeave(멤버 델타). pservice 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.partyOps && pservice) for (const po of opts.partyOps) if (po.at === i + 1) net.send(po.from || 'client0', 'pservice', { type: po.op === 'leave' ? 'partyLeave' : 'partyJoin', partyId: po.partyId, member: po.member });
    // 파티 전송 주입(step-0075) — at tick 에 클라가 라우터로 partyTo(멤버 인라인 X·partyId 만). 라우터가 멤버십 SSOT 조회→프레즌스 질의→라우팅(2단). wrouter 부재면 주입 0. 미제공이면 휴면(reg 0 불변).
    if (opts.partyTo && wrouter) for (const pt of opts.partyTo) if (pt.at === i + 1) net.send(pt.from || 'client0', 'wrouter', { type: 'partyTo', partyId: pt.partyId, body: pt.body });
    // 시나리오 inject write-seam(TESTBED §10-4 — 0011 onTick 선례) — 미제공이면 호출 0(reg 0 불변).
    //   cmd={tick,client,move:[dx,dy]} — tick 직전에 클라 발신으로 주입(게이트웨이엔 정규 move 와 동일·시드 로그의 일부 = 결정론).
    if (opts.inject) for (const c of opts.inject) if (c.tick === i + 1 && c.move) net.send('client' + c.client, 'gateway', { type: 'move', d: { dx: c.move[0] | 0, dy: c.move[1] | 0 } });
    net.step();
    const committed = new Map();
    for (const z of allZones) if (z.isAuthority()) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = inflightSet(net, allZones);
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    seenTrace.push(clis.map(c => c.seenSig()));
    const curDeltaRec = zoneObjs.reduce((a, z) => a + z.deltaEnter + z.deltaExit + z.deltaUpdate, 0);
    deltaTrace.push(curDeltaRec - prevDeltaRec); prevDeltaRec = curDeltaRec;
    if (opts.failover) replicaTrace.push(replicaDivergence(zoneObjs, followers));
    // 옵션 onTick(t, state) 훅 — 미제공이면 호출 0(reg 0 불변). 레코더의 per-tick 엔티티 위치·AOI 시각화 활성용
    //   (TESTBED 마무리 ⒜·STATE §2). state.ents = [{id,x,y,zone,authority}], state.radius = AOI 반경.
    if (onTick) {
      const ents = [];
      for (const z of allZones) if (z.isAuthority()) for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: z.addr, authority: true });
      onTick(i + 1, { ents, radius: topo.radius, grid: topo.grid });
    }
  }
  const sum = (f) => zoneObjs.reduce((a, z) => a + f(z), 0);
  const sumAll = (f) => allZones.reduce((a, z) => a + f(z), 0);
  const totals = {
    sent: sum(z => z.sent), views: sum(z => z.views),
    handoffs: sum(z => z.handoffsSent), acquired: sum(z => z.handoffsAcquired),
    ghostEnts: sum(z => z.ghostEntsSent), ghostMsgs: sum(z => z.ghostMsgs),
    deltaEnter: sum(z => z.deltaEnter), deltaExit: sum(z => z.deltaExit), deltaUpdate: sum(z => z.deltaUpdate),
    deltaMsgs: sum(z => z.deltaMsgs), resets: sum(z => z.resets),
    retransmits: sum(z => z.retransmits), acksRx: sum(z => z.acksRx), naksRx: sum(z => z.naksRx),
    keyframesForced: sumAll(z => z.keyframesForced), heartbeats: sum(z => z.heartbeats),
    promotionKeyframes: sumAll(z => z.promotionKeyframes),
    leasesSent: sumAll(z => z.leasesSent),
    naksSent: clis.reduce((a, c) => a + c.naksSent, 0),
    staleDrops: clis.reduce((a, c) => a + c.staleDrops, 0),
    promotions: orch ? orch.promotions : 0,
  };
  totals.deltaRecords = totals.deltaEnter + totals.deltaExit + totals.deltaUpdate;
  totals.netLost = net.stats.lost;
  return { net, login, registry, gateway, orch, inventory, chat, bus, audit, ranking, ranking2, presmon, presence, presenceShadow, wrouter, pservice, mbox, mbox2, persist, persist2, replicaStores, chatpersist, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, replicaTrace, totals, H: topo.H, grid: topo.grid, radius: topo.radius, deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1', mode: 'inproc' };
}

// ════════════════════════════════════════════════════════════════════════
//  runMulti — 멀티프로세스 모드(토픽 pub/sub 버스 + 소켓 층 열화). cluster.js 에 위임(Node 한정).
//   같은 buildTopology 로 토폴로지를 짜고, 각 서버 박스를 별 프로세스(spawn — IPC 0)에 띄워 broker(버스 허브)와
//   *토픽 발행/구독*으로 묶어 lockstep 배리어로 구동. opts.wire(드롭·분단·재연결)로 링크 열화를 주입.
//   반환 r 은 run() 과 같은 digest 함수들이 그대로 먹는 형태(zones/clients/net.log) + r.cluster(버스/열화 계측).
// ════════════════════════════════════════════════════════════════════════
function runMulti(opts) {
  if (typeof require === 'undefined') throw new Error('runMulti 는 Node 전용');
  return require('./cluster.js').runMulti(opts, { buildTopology, Net, fnv1a });
}

const __part = { routeFilters, buildTopology, makeActor, quorumMergeJournals, run, runMulti };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topology = __part;
