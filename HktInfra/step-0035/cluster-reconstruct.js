// HktInfra step-0035 — cluster 분할 ③: reconstruct(스냅샷 → run() 과 같은 형태의 r 재구성·dead 표기). cluster.js 에서 추출.
//   기능 0 — cluster-run.js(runMulti)가 호출. 바이트 동일(verbatim 이동) → reg 0.
'use strict';

// 스냅샷 → run() 과 같은 형태의 r 로 재구성 + dead 주소(kill/fence/추측사망) 를 dead 로 표기(소유자=1 보존).
//   죽은 프로세스(스냅샷 불가)는 dead 빈 프록시로 합성 — fullDigest 는 비권위라 무관(비트 동일 보존).
function reconstruct(net_, topo, snaps, placement, clusterInfo, opts) {
  const byAddr = new Map();
  for (const snap of snaps.values()) for (const addr of Object.keys(snap)) byAddr.set(addr, snap[addr]);
  const deadSet = new Set(clusterInfo.deadAddrs || []);

  const deadProxy = (addr) => ({
    addr, region: { lo: 0, hi: topo.H }, dead: true, shadow: false,
    ents: new Map(), outbox: new Map(), promotionKeyframes: 0, leasesSent: 0,
    isAuthority() { return false; },
  });
  const zoneProxy = (addr, s) => {
    if (!s) return deadProxy(addr);
    return {
      addr: s.addr, region: s.region, dead: s.dead || deadSet.has(s.addr), shadow: s.shadow,
      ents: new Map(s.ents.map(([id, e]) => [id, { x: e.x, y: e.y }])),
      outbox: new Map(),
      promotionKeyframes: s.promotionKeyframes, leasesSent: s.leasesSent,
      isAuthority() { return !this.dead && !this.shadow; },
    };
  };
  const clientProxy = (s) => {
    const seen = new Map(s.seen.map(([id, e]) => [id, { x: e.x, y: e.y }]));
    const items = new Set(s.items || []);       // 가방 belief(0014)
    const chatRecv = new Set(s.chatRecv || []); // 채팅 belief(0015)
    return {
      addr: s.addr, avatar: s.avatar, views: s.views, seen, items, chatRecv,
      rankBelief: (s.rankBelief == null) ? null : s.rankBelief,   // 랭킹 belief(0019) — rankDesync 재구성용
      naksSent: s.naksSent, staleDrops: s.staleDrops,
      seenIds() { return [...seen.keys()].sort(); },
      seenSig() { return [...seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';'); },
      itemsSig() { return [...items].sort().join(','); },
      chatSig() { return [...chatRecv].sort().join(';'); },
    };
  };
  // 가방 서비스(0014) 재구성 — 원장·역인덱스를 Map/Set 으로 복원(run() r.inventory 와 같은 형태 → 같은 digest 함수).
  const invSnap = byAddr.get('inventory');
  const inventory = invSnap ? {
    ledger: new Map(invSnap.ledger),
    byOwner: new Map((invSnap.byOwner || []).map(([o, arr]) => [o, new Set(arr)])),
    minted: invSnap.minted, transfers: invSnap.transfers, failedOps: invSnap.failedOps,
    itemCount() { return this.ledger.size; }, ownerOf(id) { return this.ledger.get(id); },
  } : null;
  // 채팅 서비스(0015) 재구성 — 구독 테이블·역인덱스·deliveries 를 Map/Set 으로 복원(run() r.chat 과 같은 형태 → 같은 digest 함수).
  const chatSnap = byAddr.get('chat');
  const chat = chatSnap ? {
    channels: new Map((chatSnap.channels || []).map(([ch, arr]) => [ch, new Set(arr)])),
    byAvatar: new Map((chatSnap.byAvatar || []).map(([av, e]) => [av, { gateway: e.gateway, region: e.region, subs: new Set(e.subs) }])),
    deliveries: chatSnap.deliveries || [],
    joins: chatSnap.joins, says: chatSnap.says, whispers: chatSnap.whispers, whisperFails: chatSnap.whisperFails, fanout: chatSnap.fanout,
    subscriberCount(ch) { const s = this.channels.get(ch); return s ? s.size : 0; },
  } : null;
  // 이벤트 버스(0016) 재구성 — 토픽 라우팅 테이블·발행/팬아웃 회계를 복원(run() r.bus 와 같은 형태 → 같은 digest 함수).
  const busSnap = byAddr.get('bus');
  const bus = busSnap ? {
    topics: new Map((busSnap.topics || []).map(([t, arr]) => [t, arr.slice()])),
    publishes: busSnap.publishes, deliveries: busSnap.deliveries, unrouted: busSnap.unrouted,
    subscriberCount(t) { const a = this.topics.get(t); return a ? a.length : 0; },
  } : null;
  // 감사(0016 새 소비자) 재구성 — 관찰 스트림(records)·토픽별 수신 회계를 복원.
  const auditSnap = byAddr.get('audit');
  const audit = auditSnap ? { seen: new Map(auditSnap.seen || []), records: auditSnap.records || [] } : null;
  // 랭킹(0019 발신하는 소비자) 재구성 — rank 투영 테이블·소비/발행 회계를 복원(run() r.ranking 과 같은 형태 → 같은 digest 함수).
  const rankingSnap = byAddr.get('ranking');
  const ranking = rankingSnap ? { ranks: new Map(rankingSnap.ranks || []), consumed: rankingSnap.consumed || 0, published: rankingSnap.published || 0 } : null;
  // 영속 스토어(0017 데이터 계층) 재구성 — 저널(효과 로그)을 복원(run() r.persist 와 같은 형태 → 같은 digest 함수).
  //   가방이 죽어도 persist 호스트는 안 죽으므로 저널이 온전하다(snapshotAll 이 정상 수집).
  const persistSnap = byAddr.get('persist');
  const persist = persistSnap ? {
    journal: (persistSnap.journal || []).slice(), writes: persistSnap.writes,
    snapshot: persistSnap.snapshot || null, snapshots: persistSnap.snapshots || 0, compacted: persistSnap.compacted || 0,   // 스냅샷 압축(0018)
    size() { return this.journal.length; },
  } : null;
  // 채팅 영속 스토어(0021 데이터 계층) 재구성 — 채팅 커맨드 로그를 복원(run() r.chatpersist 와 같은 형태 → 같은 digest 함수).
  //   채팅이 죽어도 chatpersist 호스트는 안 죽으므로 커맨드 로그가 온전하다(snapshotAll 이 정상 수집).
  const chatPersistSnap = byAddr.get('chatpersist');
  const chatpersist = chatPersistSnap ? {
    journal: (chatPersistSnap.journal || []).slice(), writes: chatPersistSnap.writes,
    snapshot: chatPersistSnap.snapshot || null, snapshots: chatPersistSnap.snapshots || 0, compacted: chatPersistSnap.compacted || 0,   // 라우팅 스냅샷 압축(이 step)
    size() { return this.journal.length; },
  } : null;

  const zoneObjs = topo.zoneAddrs.map(a => zoneProxy(a, byAddr.get(a)));
  const followers = ['zone1f', 'zone2f'].filter(a => byAddr.get(a)).map(a => zoneProxy(a, byAddr.get(a)));
  const reprovZones = (clusterInfo.reprovAddrs || []).filter(a => byAddr.get(a)).map(a => zoneProxy(a, byAddr.get(a)));
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => clientProxy(byAddr.get(s.addr)));
  const allZones = zoneObjs.concat(followers).concat(reprovZones);
  const orchSnap = byAddr.get('orch');

  const sumAll = (f) => allZones.reduce((a, z) => a + (f(z) || 0), 0);
  const totals = {
    promotions: orchSnap ? orchSnap.promotions : 0,
    promotionKeyframes: sumAll(z => z.promotionKeyframes),
    leasesSent: sumAll(z => z.leasesSent),
    naksSent: clis.reduce((a, c) => a + (c.naksSent || 0), 0),
    staleDrops: clis.reduce((a, c) => a + (c.staleDrops || 0), 0),
  };

  return {
    net: net_, zones: zoneObjs, followers, reprovZones, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, inventory, chat, bus, audit, ranking, persist, chatpersist,
    totals, H: topo.H, grid: topo.grid, radius: topo.radius,
    deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1',
    orch: orchSnap ? { promotions: orchSnap.promotions, deathSeen: new Map(orchSnap.deathSeen) } : null,
    cluster: clusterInfo, mode: 'multiproc',
  };
}

module.exports = { reconstruct };
