// R3 — 지각. 주체는 세계를 보지 않는다. 자기 감각이 닿는 자국만 본다.
//
// 세 가지가 맞아떨어져야 자국이 주체에게 도달한다:
//   ① 감각 채널  — 그 감각 종류를 읽을 수 있는가 (발자국을 읽는 눈, 소문을 듣는 귀)
//   ② 거리       — 여기(here) / 길로 이어진 곳(route) / 지역 전체(region)
//   ③ 예민함     — 자국의 읽기 난이도(legibility)가 그 채널의 문턱을 넘는가
//
// 그리고 도달한 것이 곧 사실은 아니다. 채널마다 충실도(fidelity)가 달라서,
// 소문으로 들은 것은 직접 본 것보다 흐리고 부풀려진다 (R4 가 그 왜곡을 믿음으로 만든다).
import { stableSort } from '../../verification/src/deterministic.js';

/**
 * 감각 채널 표 — S-S01 의 주체 프로필이 가진 perception 어휘와 1:1 로 대응한다.
 * senses: 읽을 수 있는 현상 종류 / acuity: 이만큼은 또렷해야 알아챈다
 * reach: 어디까지 닿는가 / fidelity: 도달한 것이 얼마나 사실에 가까운가
 */
export const PERCEPTION_CHANNELS = {
  'sight-near': { senses: ['sighting', 'absence'], acuity: 0.5, reach: 'here', fidelity: 1 },
  'sight-wide': { senses: ['sighting'], acuity: 0.6, reach: 'route', fidelity: 0.8 },
  'night-sight': { senses: ['sighting', 'trace'], acuity: 0.4, reach: 'here', fidelity: 0.9 },
  'trace-reading': { senses: ['trace'], acuity: 0.3, reach: 'here', fidelity: 1 },
  // 소리는 멀리 가지만 방향과 크기를 정확히 알기 어렵다
  'hearing': { senses: ['sound'], acuity: 0.4, reach: 'route', fidelity: 0.8 },
  'scent-predator': { senses: ['trace'], acuity: 0.6, reach: 'route', fidelity: 0.7 },
  'scent-prey-tracking': { senses: ['trace'], acuity: 0.4, reach: 'route', fidelity: 0.9 },
  // 소문은 멀리 가지만 흐리다 — 지역 어디서든 닿고, 사실의 절반만 남는다
  'rumor': { senses: ['record'], acuity: 0.2, reach: 'region', fidelity: 0.5 },
  'member-reports': { senses: ['record', 'absence'], acuity: 0.3, reach: 'region', fidelity: 0.8 },
  'village-complaints': { senses: ['absence', 'record'], acuity: 0.3, reach: 'region', fidelity: 0.7 },
  'market-stock': { senses: ['record'], acuity: 0.4, reach: 'here', fidelity: 1 },
  'price-board': { senses: ['record'], acuity: 0.4, reach: 'here', fidelity: 1 },
  'quality-appraisal': { senses: ['record'], acuity: 0.5, reach: 'here', fidelity: 1 },
};

/**
 * 지각 어휘 정합 — 양방향이다.
 *   ① 주체가 가진 채널이 표에 있는가
 *   ② 세계에 남는 감각 종류를 읽는 주체가 하나라도 있는가
 * ②가 비면 그 감각의 자국은 아무에게도 닿지 않는다 — 죽은 출력이다.
 */
export function validatePerception(subjects, senses = []) {
  const errors = [];
  const covered = new Set();
  for (const s of Object.values(subjects))
    for (const ch of s.perception ?? []) {
      const spec = PERCEPTION_CHANNELS[ch];
      if (!spec) { errors.push(`미지 지각 채널: ${ch} (${s.id}/${s.archetype})`); continue; }
      for (const sense of spec.senses) covered.add(sense);
    }
  for (const sense of senses)
    if (!covered.has(sense)) errors.push(`아무도 읽지 못하는 감각: ${sense} — 그 자국은 세계에 닿지 않는다`);
  return errors;
}

/** 길로 이어진 이웃 장소 — reach:'route' 채널이 닿는 범위 */
export function neighborsOf(place, routes = {}) {
  const out = new Set();
  for (const route of Object.values(routes))
    if (route.connects?.includes(place))
      for (const p of route.connects) if (p !== place) out.add(p);
  return out;
}

const inReach = (reach, subjectAt, phenomenonAt, routes) => {
  if (reach === 'region') return true;
  if (!phenomenonAt || !subjectAt) return false;
  if (subjectAt === phenomenonAt) return true;
  return reach === 'route' && neighborsOf(subjectAt, routes).has(phenomenonAt);
};

/**
 * R3 — 한 주체가 이번에 알아챈 것들.
 * 같은 자국을 여러 채널로 잡으면 가장 충실한 채널 하나만 남긴다 (직접 본 것이 소문을 이긴다).
 */
export function perceive({ subject, phenomena, routes = {}, since = 0 }) {
  const at = subject.at ?? null;
  const best = new Map();
  for (const p of phenomena) {
    if (p.tick < since) continue;
    if (p.actor === subject.id) continue;   // 자기가 남긴 자국은 지각이 아니라 기억이다
    for (const channel of subject.perception ?? []) {
      const spec = PERCEPTION_CHANNELS[channel];
      if (!spec || !spec.senses.includes(p.sense)) continue;
      if (p.legibility < spec.acuity) continue;
      if (!inReach(spec.reach, at, p.at, routes)) continue;
      const prev = best.get(p.id);
      if (prev && prev.fidelity >= spec.fidelity) continue;
      best.set(p.id, {
        subject: subject.id, phenomenon: p.id, channel, fidelity: spec.fidelity,
        sense: p.sense, at: p.at, tick: p.tick, behavior: p.behavior, legibility: p.legibility,
        description: p.description, sourceEventId: p.sourceEventId,
        direct: spec.reach === 'here' && at === p.at,
      });
    }
  }
  return stableSort([...best.values()], (a, b) => a.tick - b.tick || a.phenomenon.localeCompare(b.phenomenon));
}

/** 배역 전체의 지각 — 결정적 순서로 */
export function perceiveAll({ subjects, phenomena, routes = {}, since = 0 }) {
  const out = {};
  for (const s of stableSort(Object.values(subjects), (a, b) => a.id.localeCompare(b.id)))
    out[s.id] = perceive({ subject: s, phenomena, routes, since });
  return out;
}
