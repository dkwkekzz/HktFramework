// Active Content — 공정 도구(tools/catalog) 쪽.
//
// 카탈로그 관찰이 읽는 정적 데이터만 재수출한다. active-view 와 따로 두는 이유:
// active-view 는 결정 Layer 전체(resolve → motion-source 의 Vite glob)를 끌고
// 들어오므로 Node 로 도는 도구가 import 할 수 없다. 여기는 순수 표만 내보낸다.
// 컨텐츠의 구성이 바뀌면 이 파일과 active.ts · active-view.ts 를 함께 고친다.

export {
  CHARACTER_CATALOG,
  DEFAULT_CHARACTER,
  type CharacterDefinition,
} from './world/semantic/character-catalog';
export {
  DEFAULT_KIND_PRESENTATION,
  KIND_PRESENTATIONS,
  type KindPresentation,
} from './view/kind-presentation';
export {
  DEFAULT_ROLE_SIZE,
  ROLE_PRESENTATIONS,
} from './view/role-presentation';
export { REGISTERED_SPRITE_IDS } from './view/sprites';
