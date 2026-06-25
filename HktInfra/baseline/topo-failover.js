'use strict';
// step-0262 정리 분할(#49 wiring) — topo-run.js 의 run() 에서 *crash/failover 복구 주입*
//   (persistRestart·invRestart·clientResync·rankRestart·spawnReconstruct·chatRestart·busReSub·busRestart 재협상)을 topo-failover.js 로 분리한다.
//   verbatim 이동·ctx 핸들만 주입·기능 0 → reg 0(0261 비트 동일). 0261 topo-inject(메시지 주입열) 분할의 짝 — 이번엔 복구 주입.
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.topo_failover). 외부 의존 0(ctx 핸들·opts·tick i 만).
//   ctx 는 run() 의 박스 핸들 + quorumMergeJournals(N-replica union 헬퍼)를 묶는다. 미수신 박스는 null(해당 가드 휴면=reg 0 불변).
function applyFailover(opts, i, ctx) {
  const { net, map, persist, persist2, inventory, replicaStores, quorumMergeJournals, clis, ranking, ranking2, chat, chatpersist, bus, busSubs } = ctx;
    // 가방 서비스 failover(이 step) — invRestart.at tick 의 deliver *직전*에 crash+replay. 제어 평면(net.log 비-기여) → 멀티프로세스와 비트 동일.
    //   인프로세스 모델: 같은 inventory 객체를 crash()(RAM 소실)한 뒤 PersistStore 저널을 replay(persist ON) → 죽기 전 원장 재현(복구 투명).
    //   persist OFF 면 replay 없음(원장 비고 = 영속 부재의 대가 = 대조군). PersistStore 는 *별 박스*라 crash 의 영향을 안 받는다(데이터 계층 = 세션보다 오래).
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
}

const __part = { applyFailover };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topo_failover = __part;

