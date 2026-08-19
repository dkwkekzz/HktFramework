// Active Pack — 공정 도구(tools/catalog) 쪽 (P4 ADDED).
//
// 카탈로그 관찰이 읽는 팩 정적 데이터만 재수출한다. active-view 와 따로 두는 이유:
// active-view 는 결정 Layer 전체(resolve → motion-source 의 Vite glob)를 끌고
// 들어오므로 Node 로 도는 도구가 import 할 수 없다. 여기는 순수 표만 내보낸다.
// 팩을 바꾸려면 이 파일과 active.ts · active-view.ts · hkt.pack.json 을 함께 바꾼다.

export {
  CHARACTER_CATALOG,
  DEFAULT_CHARACTER,
  type CharacterDefinition,
} from './proto-adventure/world/base/character-catalog';
export {
  DEFAULT_KIND_PRESENTATION,
  KIND_PRESENTATIONS,
  type KindPresentation,
} from './proto-adventure/view/kind-presentation';
export {
  DEFAULT_ROLE_SIZE,
  ROLE_PRESENTATIONS,
} from './proto-adventure/view/role-presentation';
export { REGISTERED_SPRITE_IDS } from './proto-adventure/view/sprites';
