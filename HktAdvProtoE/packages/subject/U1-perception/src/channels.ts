import { AURA_CAPABILITY, type ChannelSpec, type PhenomenonSpec } from './types.js';

/**
 * 채널 책 — U1 이 소유하는 콘텐츠 데이터.
 *
 * ## 벽은 시선을 끊고 소리를 줄인다
 *
 * 원문 「11」 U1 의 대표 검증이 "벽 뒤 사건은 보지 못하지만 큰 폭발음은 들을 수 있음"인 이유가
 * 여기 있다. 두 감각이 막히는 방식이 **다르다.**
 *
 * ```text
 * visual   cut      벽 하나면 끝이다. 아무리 밝아도 보이지 않는다.
 * audio    damped   벽 하나마다 1/4 로 준다. 충분히 크면 넘어온다.
 * ```
 *
 * 소리도 `cut` 으로 적으면 대표 검증이 통과할 수 없고, 시선을 `damped` 로 적으면 벽이 벽이
 * 아니게 된다. 이 두 줄이 이 모듈에서 가장 중요한 데이터다.
 *
 * ## 왜 데이터인가
 *
 * 감쇠 상수는 세계의 성질이지 계산기의 성질이 아니다. 안개 낀 지역은 `visual.maxDistance` 가
 * 짧고, 동굴은 `audio.dampPerBlocker` 가 크다 — 지역 규칙(L4)이 이 책을 갈아 끼우는 방식으로
 * 표현될 자리이며, 그것은 S3·C3 의 몫이다.
 */
export const CHANNEL_BOOK: ChannelSpec[] = [
  {
    id: 'visual',
    title: '시각',
    falloff: 0.05,
    maxDistance: 40,
    // 벽 뒤는 보이지 않는다. 줄어드는 것이 아니라 끊긴다.
    onBlocked: 'cut',
    dampPerBlocker: 0,
    carriedByPeople: false,
  },
  {
    id: 'audio',
    title: '청각',
    falloff: 0.08,
    maxDistance: 60,
    // 벽은 소리를 줄일 뿐이다. 그래서 큰 폭발음은 넘어온다.
    onBlocked: 'damped',
    dampPerBlocker: 0.25,
    carriedByPeople: false,
  },
  {
    id: 'smell',
    title: '냄새',
    // 냄새는 빨리 옅어진다 — 가까이 가야 안다.
    falloff: 0.3,
    maxDistance: 15,
    onBlocked: 'damped',
    dampPerBlocker: 0.1,
    carriedByPeople: false,
  },
  {
    id: 'touch',
    title: '접촉',
    // 닿아야 안다. 한 걸음만 떨어져도 세기가 반으로 준다.
    falloff: 5,
    maxDistance: 2,
    onBlocked: 'cut',
    dampPerBlocker: 0,
    carriedByPeople: false,
  },
  {
    id: 'aura',
    title: '의념',
    falloff: 0.1,
    maxDistance: 30,
    // 잔향은 벽을 거의 그대로 지난다 — 물질이 아니기 때문이다.
    onBlocked: 'damped',
    dampPerBlocker: 0.8,
    // 감지 능력이 없는 주체는 잔향을 발견하지 못한다 (원문 「10」 S3 의 대표 검증과 같은 선).
    requiredCapability: AURA_CAPABILITY,
    carriedByPeople: false,
  },
  {
    id: 'report',
    title: '보고',
    falloff: 0,
    maxDistance: Number.POSITIVE_INFINITY,
    onBlocked: 'damped',
    dampPerBlocker: 1,
    // 공간을 건너오지 않는다. 사람이 들고 온다.
    carriedByPeople: true,
  },
  {
    id: 'rumor',
    title: '소문',
    falloff: 0,
    maxDistance: Number.POSITIVE_INFINITY,
    onBlocked: 'damped',
    dampPerBlocker: 1,
    carriedByPeople: true,
  },
];

/**
 * 현상 사전 — 어떤 일이 어느 감각에 얼마나 크게 남는가.
 *
 * 앞선 모듈(S1 · U0)의 법칙이 남기는 흔적 이름이 그대로 열쇠가 된다. K2 의 `PhenomenonSpec` 은
 * 세기를 들고 있지 않으므로(그것이 옳다 — 규칙은 무엇이 일어났는지만 적는다) 여기서 붙인다.
 *
 * 사전에 없는 이름은 **지어내지 않고** `E_UNKNOWN_PHENOMENON` 으로 남긴다. 기본값 하나를
 * 슬쩍 끼워 넣으면 세계가 조용히 균일해진다 — 늑대의 사냥과 풀의 광합성이 같은 크기로 들린다.
 */
export const PHENOMENON_BOOK: PhenomenonSpec[] = [
  // ── S1 자연 법칙이 남기는 흔적 ────────────────────────────────────────────
  { id: 'predation', title: '사냥', measurements: { visual: 8, audio: 14, smell: 6 }, tags: ['violence'] },
  { id: 'birth', title: '출산', measurements: { visual: 4, audio: 3 }, tags: ['life'] },
  { id: 'starvation', title: '아사', measurements: { visual: 5, smell: 3 }, tags: ['death'] },
  { id: 'plague_death', title: '역병사', measurements: { visual: 6, smell: 9 }, tags: ['death', 'disease'] },
  { id: 'heat_death', title: '열사', measurements: { visual: 5 }, tags: ['death'] },
  { id: 'festering', title: '곪음', measurements: { smell: 7 }, tags: ['disease'] },
  { id: 'recovering', title: '회복', measurements: { visual: 2 }, tags: ['life'] },
  { id: 'fever', title: '발열', measurements: { touch: 6 }, tags: ['disease'] },
  { id: 'thermoregulation', title: '체온 조절', measurements: { touch: 2 }, tags: [] },
  { id: 'prowling', title: '어슬렁거림', measurements: { visual: 3, audio: 2 }, tags: [] },
  { id: 'enduring', title: '버팀', measurements: { visual: 1 }, tags: [] },

  // ── U0 주체 법칙이 남기는 흔적 — 전부 의념이다 ───────────────────────────
  { id: 'pang_of_hunger', title: '허기의 기척', measurements: { aura: 4 }, tags: ['need'] },
  { id: 'sated', title: '만족의 기척', measurements: { aura: 2 }, tags: ['need'] },
  { id: 'gnawing_hunger', title: '깊은 허기', measurements: { aura: 7 }, tags: ['need'] },
  { id: 'alarm', title: '경계', measurements: { aura: 5 }, tags: ['emotion'] },
  { id: 'at_ease', title: '평온', measurements: { aura: 2 }, tags: ['emotion'] },
  { id: 'dread', title: '공포', measurements: { aura: 9 }, tags: ['emotion'] },
  { id: 'despair', title: '절망', measurements: { aura: 8 }, tags: ['emotion'] },
  { id: 'steadied', title: '가라앉음', measurements: { aura: 2 }, tags: ['emotion'] },
  { id: 'hollow', title: '텅 빔', measurements: { aura: 6 }, tags: ['emotion'] },

  // ── 장면이 쓰는 흔적 ──────────────────────────────────────────────────────
  { id: 'bell_toll', title: '종소리', measurements: { visual: 6, audio: 12 }, tags: ['signal'] },
  { id: 'blast', title: '폭발', measurements: { visual: 30, audio: 40, touch: 8 }, tags: ['violence'] },
  { id: 'whisper', title: '속삭임', measurements: { audio: 2 }, tags: ['speech'] },
];

export const CHANNEL_IDS: string[] = CHANNEL_BOOK.map((channel) => channel.id).sort();
export const PHENOMENON_IDS: string[] = PHENOMENON_BOOK.map((entry) => entry.id).sort();
