// content/authoring — 작성기가 기반에 건네는 것들의 **유일한 자리** (Tool-Scale §3.1).
//
// 기반(engine/world-authoring)은 게임 명사를 알지 못한다. 갈래마다 어떤 땅인지(templates),
// 이 세계가 이미 무엇을 가졌는지(contracts), 초안기가 무엇을 읽고 무엇을 지키는지(prompts) —
// 셋 다 컨텐츠가 안다. 도구는 여기서 셋을 받아 기반에 건넨다 (CLAUDE.md 원칙 5:
// 기반은 컨텐츠를 부르지 않는다 · 컨텐츠가 계약으로 자신을 등록한다).
//
// `content/regions/` 를 **쓰는** 쪽이지 읽히는 쪽이 아니다 — regions 는 여전히 engine 만 들인다.

export { WORLD_AUTHOR_TEMPLATES } from './templates';
export { WORLD_CONTRACTS } from './contracts';
export { DRAFT_PROMPT } from './prompts';
