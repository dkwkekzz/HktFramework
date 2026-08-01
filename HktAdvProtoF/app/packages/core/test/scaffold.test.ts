// V1-a 스캐폴드 검증 — core 가 빌드 없이 로드되고, 런타임 의존성이 0개임을 고정한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('core 배럴이 빌드 없이 그대로 로드된다', async () => {
  const barrel = await import('../src/index.ts');
  assert.equal(typeof barrel, 'object');
});

test('core 는 런타임 의존성을 갖지 않는다', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { dependencies?: Record<string, string> };
  assert.equal(pkg.dependencies, undefined);
});
