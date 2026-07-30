import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@hkt/v0-module-contract';
import type { ScenarioRun } from '@hkt/v0-module-contract';
import { auditRepository, statusRank, validateEvidenceDocument } from '@hkt/v4-evidence-gate';
import type { EvidenceDocument } from '@hkt/v4-evidence-gate';

/**
 * 저장소 규약 검사.
 *
 * 개별 모듈이 아니라 **저장소 전체**를 대상으로 한다. 새 모듈이 추가되면 아무 등록 없이 여기에 걸리므로,
 * "문서에만 있는 규약"이 아니라 기계가 강제하는 규약이 된다.
 *
 * 검증 상태·증거 판정은 **V4(evidence-gate)가 맡는다**(원문 「8」). 이 파일은 저장소의 실제 파일을 모아
 * V4 에 넣어 보는 자리이며, 판정 규칙을 여기서 다시 적지 않는다 — 규칙이 두 곳에 있으면 둘이 갈라진다.
 * 어느 모듈의 소유도 아니므로 패키지 밖(`tests/`)에 둔다.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGES = join(ROOT, 'packages');

interface ModuleDir {
  /** V0 · V1 … */
  id: string;
  /** module-contract · schema … */
  name: string;
  /** packages/verification/V0-module-contract */
  path: string;
  absolute: string;
}

/** `packages/<그룹>/<ID>-<name>/` 규약을 따르는 디렉터리를 모은다. */
function collectModuleDirs(): ModuleDir[] {
  const found: ModuleDir[] = [];
  for (const group of readdirSync(PACKAGES, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    if (!group.isDirectory() || group.name === 'node_modules') continue;
    for (const entry of readdirSync(join(PACKAGES, group.name), { withFileTypes: true }).sort(
      (a, b) => (a.name < b.name ? -1 : 1),
    )) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const match = /^([A-Z][0-9]+)-(.+)$/.exec(entry.name);
      const absolute = join(PACKAGES, group.name, entry.name);
      expect(match, `${entry.name} 이 \`<ID>-<name>\` 규약을 따르지 않는다`).not.toBeNull();
      found.push({
        id: (match as RegExpExecArray)[1] as string,
        name: (match as RegExpExecArray)[2] as string,
        path: relative(ROOT, absolute).split(sep).join('/'),
        absolute,
      });
    }
  }
  return found;
}

const moduleDirs = collectModuleDirs();
const each = moduleDirs.map((module) => [module.id, module] as const);

describe('모듈 디렉터리 규약', () => {
  it('모듈이 하나 이상 있다', () => {
    expect(moduleDirs.length).toBeGreaterThan(0);
  });

  it.each(each)('%s — 원문 「3」의 표준 계약 파일을 모두 갖는다', (_id, module) => {
    const required = [
      'MODULE.yaml',
      'README.md',
      'package.json',
      'src',
      'schemas',
      'scenarios',
      'lab',
      'tests/unit',
      'tests/property',
      'tests/integration',
      'evidence/latest.json',
    ];
    const missing = required.filter((entry) => !existsSync(join(module.absolute, entry)));
    expect(missing, `${module.path} 에 없는 항목`).toEqual([]);
  });

  it.each(each)('%s — package.json 이름이 `@hkt/<id>-<name>` 이다', (_id, module) => {
    const pkg = JSON.parse(readFileSync(join(module.absolute, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
    };
    expect(pkg.name).toBe(`@hkt/${module.id.toLowerCase()}-${module.name}`);
    expect(pkg.version, '증거의 moduleVersion 근거').toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('계약 등록 규약', () => {
  const documents = moduleDirs.map((module) => ({
    path: `${module.path}/MODULE.yaml`,
    text: readFileSync(join(module.absolute, 'MODULE.yaml'), 'utf8'),
  }));
  const report = buildRegistry(documents);

  it('모든 모듈이 거부 없이 등록된다', () => {
    expect(report.issues, JSON.stringify(report.issues, null, 2)).toEqual([]);
    expect(report.registered).toEqual(moduleDirs.map((module) => module.id).sort());
  });

  it('위상 순서에서 선행이 항상 앞에 온다', () => {
    const position = new Map(report.registry.order.map((id, index) => [id, index]));
    for (const module of report.registry.modules) {
      for (const dependency of module.dependsOn) {
        expect(position.get(dependency), `${module.id} 의 선행 ${dependency}`).toBeLessThan(
          position.get(module.id) as number,
        );
      }
    }
  });

  it.each(each)('%s — MODULE.yaml 의 id·name 이 디렉터리와 같다', (_id, module) => {
    const parsed = parseYaml(readFileSync(join(module.absolute, 'MODULE.yaml'), 'utf8')) as {
      id: string;
      name: string;
    };
    expect(parsed.id).toBe(module.id);
    expect(parsed.name).toBe(module.name);
  });
});

describe('Lab 등록 규약', () => {
  it.each(each)('%s — lab/index.ts 가 labModule 을 내보내고 장면이 계약과 일치한다', async (_id, module) => {
    const entry = (await import(join(module.absolute, 'lab', 'index.ts'))) as {
      labModule?: {
        id: string;
        version: string;
        purpose: string;
        scenarioIds: string[];
        run: (seedOffset: bigint) => ScenarioRun[];
      };
    };

    const labModule = entry.labModule;
    expect(labModule, `${module.path}/lab/index.ts 가 labModule 을 내보내지 않는다`).toBeDefined();
    if (!labModule) return;

    expect(labModule.id).toBe(module.id);
    expect(labModule.purpose.trim()).not.toBe('');
    expect(labModule.version).toMatch(/^\d+\.\d+\.\d+$/);

    // 계약이 선언한 시나리오와 Lab 이 실제로 돌리는 장면이 같아야 한다
    const contract = parseYaml(readFileSync(join(module.absolute, 'MODULE.yaml'), 'utf8')) as {
      scenarios: string[];
    };
    expect(labModule.scenarioIds).toEqual(contract.scenarios);

    // 원문 「24」의 구획이 모두 채워지고, 모든 장면이 통과해야 한다
    const runs = labModule.run(0n);
    expect(runs.map((run) => run.scenarioId)).toEqual(contract.scenarios);
    for (const run of runs) {
      expect(run.passed, `${run.scenarioId}: ${JSON.stringify(run.assertions.filter((a) => !a.passed))}`).toBe(true);
      expect(run.view.purpose).not.toBe('');
      expect(run.view.input.length).toBeGreaterThan(0);
      expect(run.view.candidates.length).toBeGreaterThan(0);
      expect(run.view.result).not.toBe('');
      expect(run.view.reasons.length).toBeGreaterThan(0);
      expect(run.view.before).not.toBe('');
      expect(run.view.after).not.toBe('');
      expect(run.view.checks.length).toBe(run.assertions.length);
    }
  });
});

/**
 * 코드만 남긴다 — 주석과 문자열 리터럴을 걷어낸다.
 *
 * 규약을 설명하는 주석이나 Lab 화면에 띄우는 안내 문구("Date.now() 를 읽지 않는다")가
 * 위반으로 잡히면 검사기를 믿을 수 없게 된다. 템플릿 문자열의 `${...}` 보간은 코드이므로 남긴다.
 */
export function stripNonCode(source: string): string {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  return withoutComments
    // 템플릿 문자열: 보간 부분만 남긴다
    .replace(/`(?:[^`\\]|\\.)*`/g, (literal) =>
      [...literal.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map((match) => match[1]).join(' '),
    )
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

describe('결정성 규약', () => {
  /** 같은 입력에서 다른 결과를 낼 수 있는 호출 (원문 「23」 · GI-12). 시간·난수는 V2 가 결정적 자원으로 제공한다. */
  const FORBIDDEN_CALLS = ['Math.random(', 'Date.now(', 'new Date(', 'crypto.getRandomValues('];

  it.each(each)('%s — 비결정적 호출이 없다 (원문 「23」)', (_id, module) => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          const code = stripNonCode(readFileSync(full, 'utf8'));
          for (const call of FORBIDDEN_CALLS) {
            if (code.includes(call)) {
              offenders.push(`${relative(ROOT, full).split(sep).join('/')} · ${call}`);
            }
          }
        }
      }
    };
    for (const dir of ['src', 'scenarios', 'lab', 'tests']) walk(join(module.absolute, dir));
    expect(offenders).toEqual([]);
  });

  it('검사기 자체 확인 — 주석·문자열은 걷어내고 코드는 남긴다', () => {
    // 걷어내야 하는 것
    expect(stripNonCode('// Math.random( 은 금지다\nconst a = 1;')).not.toContain('Math.random(');
    expect(stripNonCode('/* Math.random( */ const a = 1;')).not.toContain('Math.random(');
    expect(stripNonCode("const msg = 'Date.now( 를 읽지 않는다';")).not.toContain('Date.now(');
    expect(stripNonCode('const msg = `new Date( 를 읽지 않는다`;')).not.toContain('new Date(');

    // 남겨야 하는 것
    expect(stripNonCode('const a = Math.random();')).toContain('Math.random(');
    expect(stripNonCode('const a = `${Date.now()}`;')).toContain('Date.now(');
    expect(stripNonCode('const a = { b: new Date() };')).toContain('new Date(');
  });

  it.each(each)('%s — Lab 장면을 다시 실행해도 결과가 같다', async (_id, module) => {
    const { labModule } = (await import(join(module.absolute, 'lab', 'index.ts'))) as {
      labModule: { run: (seedOffset: bigint) => ScenarioRun[] };
    };
    const first = JSON.stringify(labModule.run(0n));
    for (let run = 0; run < 5; run += 1) {
      expect(JSON.stringify(labModule.run(0n))).toBe(first);
    }
  });
});

describe('스키마 규약', () => {
  /**
   * 모듈은 자기 선행에만 의존해야 하므로(원문 「3.1」), V1 을 선행으로 두지 않은 모듈은 자기 스키마를
   * 스스로 컴파일해 볼 수 없다. 저장소 단위인 여기서 대신 강제한다.
   */
  it.each(each)('%s — schemas/ 의 스키마가 V1 로 컴파일된다', async (_id, module) => {
    const { compileSchema } = await import('@hkt/v1-schema');
    const dir = join(module.absolute, 'schemas');
    const files = existsSync(dir)
      ? readdirSync(dir)
          .filter((name) => name.endsWith('.schema.json'))
          .sort()
      : [];

    for (const file of files) {
      const schema = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown>;
      expect(schema['$id'], `${module.path}/schemas/${file} 에 $id 가 없다`).toBeTypeOf('string');
      expect(() => compileSchema(schema), `${module.path}/schemas/${file}`).not.toThrow();
    }
  });

  it('저장소의 모든 $id 가 유일하다', () => {
    const seen = new Map<string, string>();
    for (const module of moduleDirs) {
      const dir = join(module.absolute, 'schemas');
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.schema.json'))) {
        const path = `${module.path}/schemas/${file}`;
        const id = (JSON.parse(readFileSync(join(dir, file), 'utf8')) as { $id?: string })['$id'];
        if (typeof id !== 'string') continue;
        expect(seen.has(id), `${id} 가 ${seen.get(id)} 와 ${path} 에 중복 선언되었다`).toBe(false);
        seen.set(id, path);
      }
    }
  });
});

/**
 * 증거·검증 상태 규약은 **V4(evidence-gate)가 판정한다.**
 *
 * 여기서 형식을 다시 손으로 적으면 판정 규칙이 두 곳에 생기고, 둘이 갈라지는 순간 어느 쪽도 믿을 수 없다.
 * 그래서 이 절은 "저장소의 실제 파일을 V4 에 넣어 본다"만 한다.
 */
describe('증거 규약 (V4 위임)', () => {
  const evidenceOf = (module: ModuleDir): EvidenceDocument =>
    JSON.parse(readFileSync(join(module.absolute, 'evidence', 'latest.json'), 'utf8')) as EvidenceDocument;

  const contracts = moduleDirs.map((module) => ({
    path: `${module.path}/MODULE.yaml`,
    text: readFileSync(join(module.absolute, 'MODULE.yaml'), 'utf8'),
  }));

  it.each(each)('%s — 증거가 원문 「21」 형식을 지킨다', (_id, module) => {
    const evidence = evidenceOf(module);
    expect(evidence.moduleId).toBe(module.id);
    const issues = validateEvidenceDocument(evidence, { label: `${module.path}/evidence/latest.json` });
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it.each(each)('%s — 증거의 수치가 실제 실행에서 나온 것이다', (_id, module) => {
    const evidence = evidenceOf(module);
    expect(evidence.unitTests.passed).toBeGreaterThan(0);
    expect(evidence.unitTests.failed).toBe(0);
    expect(evidence.replay.runs).toBeGreaterThan(0);
  });

  it('어떤 모듈도 게이트보다 높은 상태를 주장하지 않는다', () => {
    const report = auditRepository({ contracts, evidences: moduleDirs.map(evidenceOf) });
    const forged = report.issues.filter((issue) => issue.code === 'E_STATUS_ABOVE_GATES');
    expect(forged, JSON.stringify(forged, null, 2)).toEqual([]);
  });

  it('선행 계약이 바뀐 채로 남은 증거가 없다 (원문 「2.5」)', () => {
    const report = auditRepository({ contracts, evidences: moduleDirs.map(evidenceOf) });
    const stale = report.modules.filter((module) => module.invalidated);
    expect(
      stale.map((module) => `${module.id}: ${module.reasons.map((reason) => reason.code).join(', ')}`),
      '계약을 고쳤으면 `pnpm verify <ID> --lab` 로 증거를 다시 발급할 것',
    ).toEqual([]);
  });

  it('통합 슬라이스가 남아 있는 동안 어떤 모듈도 VERIFIED 가 아니다 (원문 「23」)', () => {
    const report = auditRepository({ contracts, evidences: moduleDirs.map(evidenceOf) });
    for (const module of report.modules) {
      if (statusRank(module.effectiveStatus) < statusRank('VERIFIED')) continue;
      const slices = Object.entries(module.integrationSlices);
      expect(slices.length, `${module.id}: VERIFIED 인데 통합 슬라이스 기록이 없다`).toBeGreaterThan(0);
      for (const [slice, verdict] of slices) {
        expect(verdict, `${module.id}: ${slice} 가 통과하지 않았다`).toBe('passed');
      }
    }
  });
});

describe('의존 규약', () => {
  it.each(each)('%s — MODULE.yaml 의 선행이 package.json 의존과 일치한다', (_id, module) => {
    const contract = parseYaml(readFileSync(join(module.absolute, 'MODULE.yaml'), 'utf8')) as {
      depends_on: string[];
    };
    const pkg = JSON.parse(readFileSync(join(module.absolute, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const declared = contract.depends_on.filter((id) => id !== 'none');
    const workspaceDeps = Object.keys(pkg.dependencies ?? {})
      .filter((name) => name.startsWith('@hkt/'))
      .map((name) => (name.split('/')[1]?.split('-')[0] ?? '').toUpperCase())
      .sort();

    // 계약이 선언한 선행은 모두 실제 패키지 의존으로 잡혀 있어야 한다
    expect(workspaceDeps).toEqual(expect.arrayContaining([...declared].sort()));
    // 반대로 계약에 없는 모듈을 몰래 의존해서는 안 된다
    expect([...declared].sort()).toEqual(expect.arrayContaining(workspaceDeps));
  });
});
