// O2 상태 스키마 — 세계의 모든 상태 값을 9영역 필드 트리 하나로 표현한다.
//
// O1 은 "무엇을 적을 수 있는가"(12타입) 를 정했고, O2 는 그중 State 하나를 파고들어
// "어떤 값이 세계에 놓일 수 있는가" 를 정한다. O1 State 는 `domain` + `path` + `value` 만
// 요구했을 뿐, 어떤 영역에 어떤 경로가 있어야 하는지는 비어 있었다 — 그 빈칸을 O2 가 채운다.

export * from './domain.ts';
export * from './field.ts';
export * from './schema.ts';
export * from './world.ts';
