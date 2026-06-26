'use strict';
// step-0282 — #56 브리지 존 데이터 평면 2: 런타임 EntityZone 팩토리에 net 싱크 + addr 부착(onTick view send 흡수·위치 적용만).
// step-0098 정리 분할 — 토폴로지 *액터 팩토리 + 라우트 필터*(makeActor·routeFilters). topo-build.js 가 32KB>30KB 박스 트리거를 넘겨,
//   *선언적 spec 빌더*(buildTopology)와 *액터 생성*(makeActor·박스 클래스 import)을 분리한다(기능 0·verbatim 이동·export 집합 불변·reg 0).
//   진입점 topo-build.js 가 이 부품을 require 해 routeFilters·makeActor 를 동일 export 로 노출(0030 net-core·0035 cluster·0038 topology 분할의 계보).
// dual-mode: Node require / 브라우저는 common.js·박스 파일을 <script> 선행 로드(전역 __HktNetCommon·__HktNetParts).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { LoginServer, SessionRegistry, fnv1a } = __c;
const __p = n => (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];
const { Gateway } = __p('gateway');
const { Orchestrator } = __p('orchestrator');
const { EntityZone } = __p('zone');
const { InstanceServer } = __p('instance');   // step-0201 — 던전/매치 일회성 인스턴스(spawn/despawn·존과 수명주기 분리).
const { InventoryService } = __p('svc-inventory');
const { ChatService } = __p('svc-chat');
const { ServiceBus } = __p('svc-bus');
const { AuditService } = __p('svc-audit');
const { RankingService } = __p('svc-ranking');
const { PresenceMonitor } = __p('svc-presence-monitor');
const { PresenceService } = __p('svc-presence');
const { WhisperRouter } = __p('svc-whisper');
const { PartyService } = __p('svc-party');
const { Mailbox } = __p('svc-mailbox');
const { ExchangeService } = __p('svc-exchange');
const { MarketFeed } = __p('svc-market');
const { MailService } = __p('svc-mail');   // step-0142 — 우편 서비스(오프라인 비동기 배송).
const { MailFeed } = __p('svc-mailfeed');   // step-0151 — 우편 미읽음 배지 읽기 모델(svc.mail.* 구독·발신 0).
const { GuildService } = __p('svc-guild');   // step-0181 — 길드 로스터+마스터십 SSOT(오래 사는 조직·존 tick 밖).
const { GuildFeed } = __p('svc-guildfeed');   // step-0186 — 길드 멤버 수 배지 읽기 모델(svc.guild.changed 구독·발신 0).
const { CacheStore } = __p('cache');   // step-0205 — 핫 데이터 캐시 계층(set/get·DB 직행 대체).
const { WorldLog } = __p('worldlog');   // step-0207 — 월드 intent 로그 event sourcing(append/replay).
const { LoginQueue } = __p('loginqueue');   // step-0209 — 로그인 대기열+티켓(enqueue/dequeue·엣지 흡수).
const { PersistStore } = __p('persist');
const { Client } = __p('client');

// ── routeFilter — 0009 그대로 ──
const routeFilters = {
  handoff: (m) => /^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff',
  delta: (m) => /^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta',
  both: (m) => (/^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff') ||
               (/^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta'),
  // 가방 서버-측 홉(gateway↔inventory) — redundancy/dedup 아래 원장 보존(idempotent transfer) 검증용.
  item: (m) => (m.from === 'gateway' && m.to === 'inventory') || (m.from === 'inventory' && m.to === 'gateway'),
  // 채팅 서버-측 홉(gateway↔chat) — loss/redundancy 아래 best-effort 팬아웃(누설 0·지역 격리 보존, 완전성은 graceful 열화) 검증용.
  chat: (m) => (m.from === 'gateway' && m.to === 'chat') || (m.from === 'chat' && m.to === 'gateway'),
  // 이벤트 버스 홉(bus 출입 전체 — pub·ev) — loss/redundancy 아래 라우팅 정확성(누설/phantom 0)·원장 보존 검증용(0016).
  svcbus: (m) => m.from === 'bus' || m.to === 'bus',
  // 영속 저널 홉(inventory→persist) — loss/redundancy 아래 라우팅 정확성·원장 보존(저널 미사용 시 무해) 검증용(0017).
  persist: (m) => m.to === 'persist' || m.from === 'persist',
};

// makeActor — spec → 액터(net 에 register). 인프로세스(engine Net)·호스트(HostNet shim) 양쪽이 같은 팩토리 사용.
function makeActor(spec, net) {
  let a;
  switch (spec.kind) {
    case 'login': a = new LoginServer(spec.opts.accounts, spec.opts.seed); break;
    case 'registry': a = new SessionRegistry(); break;
    case 'gateway': a = new Gateway(spec.opts.zoneAddrs, spec.opts.replicas, spec.opts.inventoryAddr, spec.opts.chatAddr, spec.opts.busAddr, spec.opts.busResendReq, spec.opts.busWindow, spec.opts.busAck, spec.opts.busOutAck, spec.opts.busSeenBound, spec.opts.busMinWm, spec.opts.busProducerNs, spec.opts.busSeenNs); break;
    case 'zone': a = new EntityZone(spec.seed, spec.opts); break;
    case 'instance': a = new InstanceServer(spec.opts); break;   // step-0201 — 인스턴스 서버.
    case 'orch':
      // step-0272 (#51b) — zoneBridge ON 이면 orch 에 *실 EntityZone 런타임 팩토리*를 주입(배치 결정이 실 존 인스턴스를 띄우게).
      //   팩토리는 직렬화 불가(함수)이므로 spec 이 아니라 *액터 구성 시점*에 makeActor 가 붙인다(인프로세스·각 호스트 프로세스가 자기 makeActor 로 동일 구성 = 멀티프로세스-safe). 시드는 zoneId 해시(결정론). OFF 면 spec.opts 그대로 = 0271 비트 동일.
      a = new Orchestrator(spec.opts.zoneBridge
        ? Object.assign({}, spec.opts, { zoneFactory: (zid) => {
            // step-0282 (#56) — 런타임 EntityZone 에 net 싱크 + addr 부착. 데이터 평면(0282 move~)에서 orch 가 런타임 onTick 을 구동하면 zone.js 가 세션에 view/view_delta 를 send 한다.
            //   step-0319 (#9 후속·downstream 데이터 평면) — 예전엔 no-op 싱크로 *드롭*했으나, 이제 *버퍼링 싱크*로 포착한다(host 프로세스가 산출한 AOI 뷰를 보관 = 다운스트림 전파의 씨앗). 버퍼는 orch 가 질의(zoneViewFrames…)로 읽을 뿐, 전역 net 을 안 건드린다(미읽으면 무관) → reg/spine 비트 동일(zoneBridge OFF 면 팩토리 자체 미발화·prior 모드는 버퍼 미읽음).
            const z = new EntityZone(fnv1a(String(zid)) >>> 0, { grid: spec.opts.zoneRtGrid, radius: spec.opts.zoneRtRadius });
            z.addr = 'zrt:' + zid; z.net = { buf: [], send(from, to, payload) { this.buf.push({ to, payload }); } };
            return z;
          } })
        : spec.opts);
      break;
    case 'inventory': a = new InventoryService(spec.opts); break;
    case 'chat': a = new ChatService(spec.opts); break;
    case 'bus': a = new ServiceBus(spec.opts); break;
    case 'audit': a = new AuditService(spec.opts); break;
    case 'presmon': a = new PresenceMonitor(spec.opts); break;
    case 'presence': a = new PresenceService(spec.opts); break;
    case 'whisper': a = new WhisperRouter(spec.opts); break;
    case 'party': a = new PartyService(spec.opts); break;
    case 'mailbox': a = new Mailbox(spec.opts); break;
    case 'exchange': a = new ExchangeService(spec.opts); break;
    case 'market': a = new MarketFeed(spec.opts); break;
    case 'mail': a = new MailService(spec.opts); break;   // step-0142 — 우편 서비스 박스.
    case 'mailfeed': a = new MailFeed(spec.opts); break;   // step-0151 — 우편 미읽음 배지 읽기 모델.
    case 'guild': a = new GuildService(spec.opts); break;   // step-0181 — 길드 서비스 박스.
    case 'guildfeed': a = new GuildFeed(spec.opts); break;   // step-0186 — 길드 멤버 수 배지 읽기 모델.
    case 'ranking': a = new RankingService(spec.opts); break;
    case 'cache': a = new CacheStore(spec.opts); break;   // step-0205 — 캐시 박스.
    case 'worldlog': a = new WorldLog(spec.opts); break;   // step-0207 — 월드 intent 로그.
    case 'loginqueue': a = new LoginQueue(spec.opts); break;   // step-0209 — 로그인 큐.
    case 'persist': a = new PersistStore(spec.opts); break;
    case 'client': a = new Client(spec.opts.script); break;
    default: throw new Error('unknown kind ' + spec.kind);
  }
  net.register(spec.addr, a);
  return a;
}

const __part = { routeFilters, makeActor };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topo_actors = __part;
