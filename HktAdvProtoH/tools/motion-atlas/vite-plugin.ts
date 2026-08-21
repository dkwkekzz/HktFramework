// Motion Atlas Vite Plugin — 시트를 놓기만 하면 되는 규약을 지킨다.
//
// motions/README.md 의 약속은 "등록 코드는 없다. 파일을 놓으면 알아서 불러온다" 였다.
// 정적 분석이 끼어들면서 그 약속이 깨지면 안 되므로, 개발 서버 시작·빌드 시작 때와
// motions/ 안이 바뀔 때마다 분석을 다시 돌린다. 사용자는 여전히 PNG 만 놓으면 된다.
//
// 다만 **바뀌지 않았으면 아무 일도 하지 않는다** — 생성물은 커밋되어 있으므로, 게임을
// 켤 때마다 다시 쓰이면 그것이 곧 작업 트리의 잡음이 된다. 생성물에 적힌 입력 지문과
// 지금 motions/ 의 지문을 견주어 같으면 해독도 쓰기도 건너뛴다.
//
// 손으로 돌리고 싶을 때는 scan-motions.bat / scan-motions.sh (또는 npm run motions:scan).

import { join, sep } from 'node:path';
import type { Plugin } from 'vite';
import { motionsFingerprint } from './build-atlas';
import { activePackDir } from '../active-pack';
import { projectRoot, scanMotions } from './scan';

export function motionAtlasPlugin(): Plugin {
  const root = projectRoot();
  const motionsDir = join(activePackDir(root), 'motions');
  let lastFingerprint = '';

  const run = (log: (message: string) => void): void => {
    const fingerprint = motionsFingerprint(root);
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    const { changed, reports, warnings, upToDate, sheets } = scanMotions(root, {
      reuseIfUnchanged: true,
    });
    if (upToDate) {
      log(`모션 아틀라스: 시트 ${sheets}장 · 이미 최신 (분석 건너뜀)`);
      return;
    }

    const analyzed = reports.filter((r) => r.geometry).length;
    log(
      `모션 아틀라스: 시트 ${analyzed}/${reports.length}장 분석${
        changed ? ' · 생성물 갱신' : ''
      }${warnings > 0 ? ` · 경고 ${warnings}건 (npm run motions:scan 으로 상세 확인)` : ''}`,
    );
  };

  return {
    name: 'hkt-motion-atlas',
    enforce: 'pre',

    buildStart() {
      run((message) => this.info(message));
    },

    configureServer(server) {
      run((message) => server.config.logger.info(`  ➜  ${message}`));

      server.watcher.add(motionsDir);
      server.watcher.on('all', (_event, path) => {
        if (!path.startsWith(motionsDir + sep)) return;
        if (!/\.(png|webp)$/i.test(path)) return;
        run((message) => server.config.logger.info(`  ➜  ${message}`));
      });
    },
  };
}
