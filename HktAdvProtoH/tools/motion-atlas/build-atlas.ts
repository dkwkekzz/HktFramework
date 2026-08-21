// Motion Atlas Builder — motions/ 를 훑어 프레임 기하를 미리 구해 둔다.
//
// 등록 코드가 없다는 규약(motions/README.md)은 그대로다. 이 도구도 폴더를 스스로 훑고,
// 파일명 해석은 런타임과 **같은 파서**(view/motion/motion-format.ts)를 쓴다 —
// 포맷의 진실이 두 군데로 갈라지지 않게 한다.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { parseMotionPath } from '../../engine/view-kernel/motion/motion-format';
import type { MotionAtlas, MotionFrameGeometry, MotionGeometry } from '../../engine/view-kernel/motion/motion-geometry';
import { activePackDir } from '../active-pack';
import { detectSheet, type DetectedSheet } from './detect-frames';
import { readPngAlpha } from './png-alpha';

export interface SheetReport {
  /** import.meta.glob 과 같은 키 (예: /motions/rabbit-swordsman/attack.3x3.9f.12fps.png) */
  key: string;
  id: string;
  cols: number;
  rows: number;
  declaredFrames: number;
  /** 분석에 성공했을 때만 있다. 없으면 런타임이 균등 분할로 물러난다 */
  geometry?: MotionGeometry;
  detected?: DetectedSheet;
  /** 균등 분할로 물러난 이유 (읽지 못한 형식 등) */
  skipped?: string;
}

export interface AtlasBuildResult {
  atlas: MotionAtlas;
  reports: SheetReport[];
  /** 입력 지문 — motions/ 내용 + 분석기 판. 바뀌지 않았으면 다시 만들 필요가 없다 */
  inputHash: string;
  /** 훑은 시트 파일 수 (분석을 건너뛰었을 때도 안다) */
  sheets: number;
  /** reuseIfHash 와 같아 분석을 건너뛰었다 — atlas·reports 는 비어 있다 */
  upToDate: boolean;
}

export interface AtlasBuildOptions {
  /**
   * 이미 이 지문으로 만들어 둔 생성물이 있다면 분석을 건너뛴다.
   *
   * 지문은 파일 **내용**으로만 만든다 (경로+바이트) — 크기·수정시각과 달리 기계가 달라도,
   * 다시 클론해도 같은 값이다. 그래서 "이미 최신" 판단이 컴퓨터마다 갈리지 않는다.
   */
  reuseIfHash?: string;
}

/**
 * 기하를 결정하는 분석기 소스의 지문.
 *
 * 지문이 시트 내용만 담으면, 검출·정규화 규칙이 바뀌었는데 시트는 그대로인 상황에서
 * "이미 최신" 이라고 잘못 판정한다 (실제로 있었던 일 — 커밋 8d8ceb3 은 시트를 건드리지
 * 않고 세로 기준점 규칙만 바꿨다). 그래서 규칙도 입력으로 친다.
 *
 * 공정 코드(scan · vite-plugin)는 뺀다 — 출력 값을 만들지 않기 때문이다.
 */
function builderFingerprint(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const sources = [
    join(here, 'build-atlas.ts'),
    join(here, 'detect-frames.ts'),
    join(here, 'png-alpha.ts'),
    join(here, 'emit.ts'),
    join(here, '..', '..', 'engine', 'view-kernel', 'motion', 'motion-format.ts'),
  ];
  const hash = createHash('sha256');
  for (const source of sources) {
    // 줄바꿈은 규칙이 아니다 — CRLF 체크아웃에서 지문이 달라지지 않게 한다
    hash.update(readFileSync(source, 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex');
}

/** motions/ 아래의 모든 이미지 파일 경로를 모은다 */
function collectSheets(motionsDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(png|webp)$/i.test(entry.name)) found.push(full);
    }
  };
  try {
    walk(motionsDir);
  } catch {
    // motions/ 가 없어도 도구는 실패하지 않는다 — 빈 아틀라스를 만든다.
  }
  return found;
}

/**
 * 검출 결과를 정규화한다.
 *
 * 크기 — 대표 높이는 그 모션에서 **가장 큰 포즈**의 그림 높이다. 모든 프레임을
 *        같은 픽셀 배율로 그리므로 모션 안의 웅크림은 그대로 남고,
 *        모션끼리의 크기 차이만 사라진다.
 * 발    — 기준점은 **그 포즈가 땅에 닿는 줄**이다 (detect-frames 의 ground).
 * 좌우  — 기준점은 **파일명이 선언한 격자**의 칸 중심에 둔다. 시트 전체의
 *        치우침(평균 편차)만 걷어내고, 프레임별 돌진은 그대로 남는다.
 *
 * 두 축 모두 검출 사각형을 기준으로 삼지 않는다. 검출 절단선은 *빈 줄의 한가운데*라서
 * 이웃 프레임의 그림에 따라 움직인다 — 즉 사각형은 자기 그림뿐 아니라 옆 칸·아랫 칸
 * 그림에도 끌려다닌다. 그것을 기준으로 삼으면 캐릭터가 제자리에 있어도 프레임마다 밀린다.
 *
 *   가로  걸을 때 몸 중심이 좌우로 흔들렸다 (move 실측: 대표 높이의 14.6% → 5.2%)
 *   세로  칸 아래 여백이 큰 시트일수록 몸이 땅에서 떴다. `downed` 는 누운 포즈라
 *         아래 여백이 특히 커서 42% 나 떠올랐다 — 접지선 기준으로는 그 원인 자체가 없다
 *
 * 세로 기준점은 프레임마다 잡는다. 접지선은 "이 포즈가 땅에 닿는 자리"이므로 웅크림도
 * 쓰러짐도 그대로 살아 있다. 다만 **공중에 뜬 포즈**(도약)는 표현할 수 없다 —
 * 알파만 보고는 발이 땅에 있는지 공중에 있는지 알 방법이 없기 때문이다.
 */
function normalize(detected: DetectedSheet, declaredFrames: number): MotionGeometry {
  /** 그 프레임이 놓인 칸의 중심 — 선언 격자 위의 자리다 (검출 사각형과 무관) */
  const cellWidth = detected.cols > 0 ? detected.width / detected.cols : detected.width;
  const cellCenterX = (index: number): number => ((index % detected.cols) + 0.5) * cellWidth;

  // 프레임은 왼쪽 위에서 오른쪽으로 세므로 index % cols 가 곧 칸의 열이다.
  const indexed = detected.frames.map((frame, index) => ({ frame, index }));
  const live = indexed.slice(0, declaredFrames).filter((f) => !f.frame.empty);
  const measured = live.length > 0 ? live : indexed.slice(0, declaredFrames);

  const refHeightPx = Math.max(1, ...measured.map(({ frame: f }) => f.content.h));

  const biasPx =
    measured.reduce(
      (sum, { frame: f, index }) => sum + (f.content.x + f.content.w / 2) - cellCenterX(index),
      0,
    ) / Math.max(1, measured.length);

  const frames: MotionFrameGeometry[] = detected.frames.map((f, index) => ({
    rect: [f.rect.x, f.rect.y, f.rect.w, f.rect.h] as const,
    content: [f.content.x, f.content.y, f.content.w, f.content.h] as const,
    anchor: [
      // 기준점은 시트 절대 좌표(칸 중심 + 치우침)에서 이 프레임 사각형 기준 비율로 환산한다
      f.rect.w > 0 ? (cellCenterX(index) + biasPx - f.rect.x) / f.rect.w : 0.5,
      // v 는 사각형 아래에서 위로 재는 값이다 — 접지선까지의 거리를 그렇게 환산한다
      f.rect.h > 0 ? (f.rect.y + f.rect.h - 1 - f.ground) / f.rect.h : 0,
    ] as const,
  }));

  const warnings: string[] = [];
  for (const b of detected.bleed) {
    warnings.push(
      `절단선 ${b.axis}=${b.at} 위에 잉크 ${b.ink}px — 프레임끼리 맞닿아 있다. 시트 재추출 권장`,
    );
  }
  detected.frames.slice(0, declaredFrames).forEach((f, i) => {
    if (f.empty) warnings.push(`프레임 ${i} 이 비어 있다 — 격자(cols×rows)가 시트와 다를 수 있다`);
  });

  return { sheet: [detected.width, detected.height], cols: detected.cols, rows: detected.rows, refHeightPx, frames, warnings };
}

export function buildAtlas(projectRoot: string, options: AtlasBuildOptions = {}): AtlasBuildResult {
  const motionsDir = join(activePackDir(projectRoot), 'motions');
  const files = collectSheets(motionsDir);

  // 지문 먼저 — 입력이 그대로면 알파 해독도 기하 검출도 하지 않는다.
  const hash = createHash('sha256');
  hash.update(builderFingerprint());
  const keyed = files.map((file) => {
    const key = '/' + relative(projectRoot, file).split(sep).join('/');
    hash.update(key).update(readFileSync(file));
    return { file, key };
  });
  const inputHash = hash.digest('hex').slice(0, 16);

  if (options.reuseIfHash !== undefined && options.reuseIfHash === inputHash) {
    return { atlas: {}, reports: [], inputHash, sheets: files.length, upToDate: true };
  }

  const atlas: Record<string, MotionGeometry> = {};
  const reports: SheetReport[] = [];

  for (const { file, key } of keyed) {
    const asset = parseMotionPath(key, key);
    if (!asset) continue; // 포맷에 맞지 않는 파일은 런타임과 똑같이 무시한다

    const base = {
      key,
      id: asset.id,
      cols: asset.cols,
      rows: asset.rows,
      declaredFrames: asset.frames,
    };

    // 읽지 못한 시트는 아틀라스에 **넣지 않는다**. 런타임이 이미지 크기를 알게 된 뒤
    // 예전처럼 균등 분할한다(uniformGeometry) — 게임은 멈추지 않고, 여기서는 이유만 남긴다.
    if (!/\.png$/i.test(file)) {
      reports.push({ ...base, skipped: 'PNG 이 아니어서 알파를 읽지 못했다 — 런타임 균등 분할' });
      continue;
    }

    try {
      const detected = detectSheet(readPngAlpha(readFileSync(file)), asset.cols, asset.rows);
      const geometry = normalize(detected, asset.frames);
      atlas[key] = geometry;
      reports.push({ ...base, geometry, detected });
    } catch (error) {
      reports.push({ ...base, skipped: `${(error as Error).message} — 런타임 균등 분할` });
    }
  }

  return { atlas, reports, inputHash, sheets: files.length, upToDate: false };
}

/** motions/ 안 파일들의 크기·수정시각 지문 — 다시 만들지 판단하는 값싼 기준 */
export function motionsFingerprint(projectRoot: string): string {
  const files = collectSheets(join(activePackDir(projectRoot), 'motions'));
  const hash = createHash('sha256');
  for (const file of files) {
    const s = statSync(file);
    hash.update(file).update(String(s.size)).update(String(s.mtimeMs));
  }
  return hash.digest('hex').slice(0, 16);
}
