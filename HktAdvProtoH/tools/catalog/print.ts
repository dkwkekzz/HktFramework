// Character Catalog Print — kind 정적 데이터 3원소를 한 화면에 병합해 관찰한다.
//
//   npm run catalog              world 카탈로그 + view 표현 + motions/ 를 종류별로 출력한다
//   npm run catalog:check        3원소 정합만 확인한다 — 카탈로그 불일치면 실패 (검증 단계용)
//
// 코드는 아무것도 바꾸지 않는다 — 읽기 전용 관찰 도구다.
// World/View 경계는 여기서도 지켜진다: 이 도구는 양쪽을 "관찰"만 하며,
// world 와 view 는 여전히 서로를 import 하지 않는다.

import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  CHARACTER_CATALOG,
  DEFAULT_CHARACTER,
  type CharacterDefinition,
} from '../../world/semantic/character-catalog';
import {
  DEFAULT_KIND_PRESENTATION,
  KIND_PRESENTATIONS,
  type KindPresentation,
} from '../../view/presentation/kind-presentation';
import {
  DEFAULT_ROLE_SIZE,
  ROLE_PRESENTATIONS,
} from '../../view/presentation/role-presentation';
import { REGISTERED_SPRITE_IDS } from '../../view/assets/registry';
import { parseMotionPath, ROOT_DIR, type MotionAsset } from '../../view/motion/motion-format';

export function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/** motions/<kind>/ 를 파일 규약 그대로 읽는다 — Vite glob 과 같은 것을 fs 로 본다 */
export function scanMotionFolders(root = projectRoot()): Map<string, MotionAsset[]> {
  const byKind = new Map<string, MotionAsset[]>();
  const motionsDir = join(root, ROOT_DIR);
  let kinds: string[] = [];
  try {
    kinds = readdirSync(motionsDir).filter((name) =>
      statSync(join(motionsDir, name)).isDirectory(),
    );
  } catch {
    return byKind; // motions/ 자체가 없어도 관찰은 계속된다
  }
  for (const kind of kinds.sort()) {
    const assets: MotionAsset[] = [];
    for (const file of readdirSync(join(motionsDir, kind)).sort()) {
      const asset = parseMotionPath(`/${ROOT_DIR}/${kind}/${file}`, '');
      if (asset) assets.push(asset);
    }
    byKind.set(kind, assets);
  }
  return byKind;
}

const num = (v: number) => String(v);
const vec = (v: { x: number; z: number }) => `(${v.x},${v.z})`;

function formatWorldLine(def: CharacterDefinition): string[] {
  return [
    `몸 r${num(def.body.radius)} h${num(def.body.height)} m${num(def.body.mass)}` +
      ` · 기본 방향 ${vec(def.facing)}`,
    `속도 ${num(def.tempo.moveSpeed)} (달리기 x${num(def.tempo.runSpeedMultiplier)}` +
      `, 행동 x${num(def.tempo.actionSpeed)})` +
      ` · HP ${num(def.resources.hpMax)} · CP ${num(def.resources.cpMax)}` +
      ` 시작 ${num(def.resources.cpStart)}`,
    `사거리 ${num(def.attackRange)} · 인지 ${num(def.perceptionRange)}`,
  ];
}

function formatMotions(assets: MotionAsset[] | undefined): string {
  if (!assets || assets.length === 0) return '없음 — placeholder 로 그려진다';
  return assets
    .map((a) => `${a.action}(${a.cols}x${a.rows}·${a.frames}f·${a.fps}fps)`)
    .join('  ');
}

function formatKindBlock(
  kind: string,
  def: CharacterDefinition | undefined,
  view: KindPresentation | undefined,
  motions: MotionAsset[] | undefined,
): string {
  const lines: string[] = [`  ${kind}`];
  if (def) {
    const [l1, l2, l3] = formatWorldLine(def);
    lines.push(`    world    ${l1}`, `             ${l2}`, `             ${l3}`);
  } else {
    lines.push('    world    !! 항목 없음 — DEFAULT_CHARACTER 로 스폰된다');
  }
  lines.push(
    view
      ? `    view     그림 기준 방향 ${view.spriteBaseline}`
      : '    view     !! 항목 없음 — 기본 표현으로 그려진다',
  );
  lines.push(`    motions  ${formatMotions(motions)}`);
  return lines.join('\n');
}

function formatRoleTable(): string {
  const lines: string[] = [];
  for (const [role, p] of Object.entries(ROLE_PRESENTATIONS)) {
    const flags = [
      p.cameraFollow ? 'camera' : null,
      p.trail ? 'trail' : null,
      p.tint !== undefined ? `tint#${p.tint.toString(16)}` : null,
      p.unattendedTint !== undefined ? 'unattended' : null,
      p.labelFormat ? 'label' : null,
    ].filter(Boolean);
    const fallbackStates = REGISTERED_SPRITE_IDS.filter((id) => id.startsWith(`${p.sprite}:`))
      .map((id) => id.slice(p.sprite.length + 1))
      .join(',');
    lines.push(
      `  ${role.padEnd(24)} sprite ${p.sprite.padEnd(16)} size ${String(p.size).padEnd(5)}` +
        ` ${flags.join(' ').padEnd(28)} 픽셀아트 ${fallbackStates || '없음(placeholder)'}`,
    );
  }
  lines.push(`  (미등록 role)             sprite <role 그대로>    size ${DEFAULT_ROLE_SIZE}`);
  return lines.join('\n');
}

export interface CatalogDrift {
  errors: string[]; // 카탈로그 등록 불일치 — check 모드에서 실패
  warnings: string[]; // 폴백으로 동작은 하는 어긋남 — 알림만
}

/** 3원소(world 카탈로그 · view 표현 · motions 폴더)의 정합을 본다 */
export function findDrift(motions: Map<string, MotionAsset[]>): CatalogDrift {
  const errors: string[] = [];
  const warnings: string[] = [];
  const worldKinds = Object.keys(CHARACTER_CATALOG);
  const viewKinds = Object.keys(KIND_PRESENTATIONS);

  for (const kind of worldKinds)
    if (!viewKinds.includes(kind))
      errors.push(`world 카탈로그의 '${kind}' 가 view/presentation/kind-presentation.ts 에 없다`);
  for (const kind of viewKinds)
    if (!worldKinds.includes(kind))
      errors.push(`view 표현의 '${kind}' 가 world/semantic/character-catalog.ts 에 없다`);

  for (const kind of worldKinds)
    if (!motions.has(kind) || motions.get(kind)!.length === 0)
      warnings.push(`'${kind}' 의 motions/${kind}/ 시트가 없다 — placeholder 로 그려진다`);
  for (const kind of motions.keys())
    if (!worldKinds.includes(kind))
      warnings.push(`motions/${kind}/ 의 종류가 world 카탈로그에 없다 — DEFAULT_CHARACTER 로 스폰된다`);

  for (const [role, p] of Object.entries(ROLE_PRESENTATIONS)) {
    const hasPixel = REGISTERED_SPRITE_IDS.some((id) => id.startsWith(`${p.sprite}:`));
    const hasMotion = motions.has(p.sprite);
    if (!hasPixel && !hasMotion)
      warnings.push(`role '${role}' 의 sprite '${p.sprite}' 는 픽셀아트도 모션도 없다 — placeholder 로 그려진다`);
  }

  return { errors, warnings };
}

export function renderCatalog(motions: Map<string, MotionAsset[]>): string {
  const kinds = [
    ...new Set([...Object.keys(CHARACTER_CATALOG), ...Object.keys(KIND_PRESENTATIONS), ...motions.keys()]),
  ].sort();

  const lines: string[] = [];
  lines.push('');
  lines.push('  Character Catalog — kind 정적 데이터 3원소 (world 시뮬레이션 · view 표현 · motions 그림)');
  lines.push('  ' + '-'.repeat(96));
  for (const kind of kinds) {
    lines.push(
      formatKindBlock(kind, CHARACTER_CATALOG[kind], KIND_PRESENTATIONS[kind], motions.get(kind)),
    );
  }
  lines.push('  ' + '-'.repeat(96));
  const [d1, d2, d3] = formatWorldLine(DEFAULT_CHARACTER);
  lines.push('  (미등록 종류의 기본값)');
  lines.push(`    world    ${d1}`, `             ${d2}`, `             ${d3}`);
  lines.push(`    view     그림 기준 방향 ${DEFAULT_KIND_PRESENTATION.spriteBaseline}`);
  lines.push('');
  lines.push('  Role Presentations — 역할별 표현 (view/presentation/role-presentation.ts)');
  lines.push('  ' + '-'.repeat(96));
  lines.push(formatRoleTable());
  lines.push('');
  return lines.join('\n');
}

// CLI 로 직접 실행될 때만 동작한다 (import 로는 조용하다)
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const checkOnly = process.argv.includes('--check');
  const motions = scanMotionFolders();
  const { errors, warnings } = findDrift(motions);

  if (!checkOnly) console.log(renderCatalog(motions));

  for (const w of warnings) console.log(`  경고: ${w}`);
  for (const e of errors) console.error(`  [오류] ${e}`);

  if (errors.length > 0) {
    console.error('\n  kind 는 world·view 카탈로그 양쪽에 같은 이름으로 등록되어야 한다.');
    process.exit(1);
  }
  if (checkOnly) console.log('  카탈로그 3원소가 정합한다.');
}
