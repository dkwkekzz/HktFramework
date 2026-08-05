// Foundation 완료 조건 실증용 데모 시나리오 — "기관 소유권 경쟁".
// 두 사냥꾼 클라이언트가 추적(시드 의존 굴림) 후 같은 마물 기관을 동시에 주장한다.
// 실증 대상: 권위 서버 경유 명령 제출, 충돌 1회 확정, 사건 기반 상태 변경,
// 시드 결정성(같은 시드 = 같은 해시 궤적), 리플레이 재구성.
import { AuthorityServer } from '../../server/src/authority.js';

export const DEMO_INITIAL_STATE = {
  organ: { id: 'organ-1', owner: null },
  hunters: { H1: { tracking: 0 }, H2: { tracking: 0 } },
};

export const demoHandlers = {
  'track': (snapshot, cmd) => ({
    accept: true,
    events: [{ type: 'TrackProgress', payload: { by: cmd.clientId, roll: cmd.payload.roll } }],
  }),
  'claim-organ': (snapshot, cmd) =>
    snapshot.organ.owner
      ? { accept: false, reason: `already-owned-by:${snapshot.organ.owner}` }
      : { accept: true, events: [{ type: 'OrganClaimed', payload: { organId: cmd.payload.organId, by: cmd.clientId } }] },
};

export function demoReducer(state, event) {
  const next = structuredClone(state);
  switch (event.type) {
    case 'TrackProgress':
      next.hunters[event.payload.by].tracking += event.payload.roll;
      return next;
    case 'OrganClaimed':
      next.organ.owner = event.payload.by;
      return next;
    default:
      return next;
  }
}

/** ScenarioRunner 계약에 맞춘 데모 Scenario 정의 */
export const organClaimScenario = {
  id: 'FD-ORGAN-CLAIM-01',
  cycleId: 'C01',
  setup() {
    const server = new AuthorityServer({
      initialState: DEMO_INITIAL_STATE,
      handlers: demoHandlers,
      reducer: demoReducer,
    });
    return {
      server,
      clients: { H1: server.connect('H1'), H2: server.connect('H2') },
      rejections: [],
    };
  },
  inputs: [
    { client: 'H1', type: 'track' },
    { client: 'H2', type: 'track' },
    { client: 'H1', type: 'claim-organ' },
    { client: 'H2', type: 'claim-organ' },
  ],
  apply(world, input, rng) {
    const payload = input.type === 'track' ? { roll: rng.int(100) } : { organId: 'organ-1' };
    world.clients[input.client].submit(input.type, payload);
    const results = world.server.processPending();
    for (const r of results) if (!r.accepted) world.rejections.push({ clientId: r.clientId, reason: r.reason });
    return { events: results.flatMap((r) => r.events ?? []) };
  },
  snapshot(world) {
    return world.server.getSnapshot();
  },
  expect({ world, events }) {
    const s = world.server.getSnapshot();
    const claimEvents = events.filter((e) => e.type === 'OrganClaimed');
    return [
      { name: '소유권 1회 확정 (권위 충돌 확정)', passed: claimEvents.length === 1 && s.organ.owner === 'H1',
        detail: `owner=${s.organ.owner}, claims=${claimEvents.length}` },
      { name: '후속 주장 거부와 사유 보존', passed: world.rejections.length === 1 && world.rejections[0].reason.startsWith('already-owned-by:'),
        detail: JSON.stringify(world.rejections) },
      { name: '상태 변경은 사건 경유 (추적 굴림 반영)', passed: s.hunters.H1.tracking > 0 && s.hunters.H2.tracking > 0,
        detail: `H1=${s.hunters.H1.tracking}, H2=${s.hunters.H2.tracking}` },
    ];
  },
};
