// 테스트가 시작하기 전에 모션 아틀라스 생성물을 만든다.
//
// 생성물은 커밋하지 않는다 (.gitignore) — 개발 서버가 motions/ 를 지켜보며 다시 만들기
// 때문에, 커밋해 두면 서버가 도는 동안 파일이 바뀌어 pull 이 막힌다. 대신 그것을 읽는
// 모든 진입점이 먼저 만든다: 개발 서버·빌드는 vite plugin 이, 테스트는 여기가.
//
// globalSetup 은 테스트 파일을 읽어 들이기 전에 한 번 돈다 — import 가 최신 파일을 본다.

import { scanMotions } from './scan';

export default function setup(): void {
  scanMotions();
}
