// V0-a 계약 파서 단위 테스트 — 서식은 읽고, 서식 밖 문법은 줄 번호와 함께 거부한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { YamlParseError, parseYaml } from '../src/yaml.ts';

const contractsDir = new URL('../', import.meta.url);

describe('읽는다', () => {
  test('스칼라 종류', () => {
    assert.deepEqual(
      parseYaml(
        [
          'id: V1',
          'count: 42',
          'ratio: -1.5',
          'enabled: true',
          'disabled: false',
          'nothing: null',
          'tilde: ~',
          "quoted: 'a: b'",
          'escaped: "따옴표 \\" 포함"',
          'path: /lab/v1',
        ].join('\n'),
      ),
      {
        id: 'V1',
        count: 42,
        ratio: -1.5,
        enabled: true,
        disabled: false,
        nothing: null,
        tilde: null,
        quoted: 'a: b',
        escaped: '따옴표 " 포함',
        path: '/lab/v1',
      },
    );
  });

  test('인라인 시퀀스와 빈 시퀀스', () => {
    assert.deepEqual(parseYaml('inputs: [A, B, C]\ndepends: []'), {
      inputs: ['A', 'B', 'C'],
      depends: [],
    });
  });

  test('블록 시퀀스와 중첩 매핑', () => {
    assert.deepEqual(
      parseYaml(['elements:', '  - name: Seed', '    renderer: diff', '  - name: Tick', '    renderer: gauge'].join('\n')),
      { elements: [{ name: 'Seed', renderer: 'diff' }, { name: 'Tick', renderer: 'gauge' }] },
    );
  });

  test('스칼라 시퀀스', () => {
    assert.deepEqual(parseYaml(['scenarios:', '  - a-normal', '  - a-failure'].join('\n')), {
      scenarios: ['a-normal', 'a-failure'],
    });
  });

  test('접힘 블록 스칼라(>)는 한 줄로 합쳐진다', () => {
    assert.deepEqual(parseYaml(['purpose: >', '  첫 줄', '  둘째 줄', 'id: X'].join('\n')), {
      purpose: '첫 줄 둘째 줄',
      id: 'X',
    });
  });

  test('유지 블록 스칼라(|)는 줄바꿈을 지킨다', () => {
    assert.deepEqual(parseYaml(['note: |', '  첫 줄', '  둘째 줄'].join('\n')), {
      note: '첫 줄\n둘째 줄',
    });
  });

  test('주석과 빈 줄은 무시된다 — 값 안의 # 은 살린다', () => {
    assert.deepEqual(
      parseYaml(['# 머리말', 'id: V1   # 꼬리 주석', '', 'tag: a#b', "quoted: 'x # y'"].join('\n')),
      { id: 'V1', tag: 'a#b', quoted: 'x # y' },
    );
  });

  test('중첩 매핑', () => {
    assert.deepEqual(parseYaml(['a:', '  b:', '    c: 1'].join('\n')), { a: { b: { c: 1 } } });
  });

  test('빈 문서는 null', () => {
    assert.equal(parseYaml(''), null);
    assert.equal(parseYaml('# 주석뿐\n\n'), null);
  });
});

describe('거부한다', () => {
  const rejects = (text: string, pattern: RegExp): void => {
    assert.throws(() => parseYaml(text), (error: unknown) => {
      assert.ok(error instanceof YamlParseError, `YamlParseError 가 아니다: ${String(error)}`);
      assert.match(error.message, /^\d+행: /, '줄 번호가 없다');
      assert.match(error.message, pattern);
      return true;
    });
  };

  test('탭 들여쓰기', () => {
    rejects('a:\n\tb: 1', /탭/);
  });

  test('앵커·별칭', () => {
    rejects('a: &anchor 1', /앵커/);
    rejects('a: *anchor', /앵커/);
  });

  test('플로 매핑', () => {
    rejects('a: { b: 1 }', /플로 매핑/);
  });

  test('태그', () => {
    rejects('a: !!str 1', /태그/);
  });

  test('복수 문서', () => {
    rejects('a: 1\n---\nb: 2', /복수 문서/);
  });

  test('키가 아닌 줄', () => {
    rejects('그냥 문장', /키: 값/);
  });

  test('중복 키', () => {
    rejects('a: 1\na: 2', /중복/);
  });

  test('닫히지 않은 인라인 시퀀스', () => {
    rejects('a: [1, 2', /닫히지/);
  });

  test('어긋난 들여쓰기', () => {
    rejects('a: 1\n   b: 2', /들여쓰기/);
  });

  test('거부 사유는 정확한 줄을 가리킨다', () => {
    assert.throws(
      () => parseYaml(['id: V1', 'name: ok', 'a: { b: 1 }'].join('\n')),
      /YamlParseError: 3행: /,
    );
  });
});

describe('실제 계약 파일', () => {
  const files = readdirSync(contractsDir).filter((name) => name.endsWith('.yaml'));

  test('계약 파일이 하나 이상 있다', () => {
    assert.ok(files.length > 0);
  });

  for (const file of files) {
    test(`${file} 을 읽고 필수 필드를 갖춘다`, () => {
      const parsed = parseYaml(readFileSync(new URL(file, contractsDir), 'utf8'));
      assert.ok(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed));
      const contract = parsed as Record<string, unknown>;
      assert.equal(typeof contract['id'], 'string');
      assert.equal(typeof contract['purpose'], 'string');
      assert.ok(Array.isArray(contract['scenarios']));
      // 파싱 결과는 그대로 JSON 이 된다 (상태 원소 규칙).
      assert.deepEqual(JSON.parse(JSON.stringify(contract)), contract);
    });
  }
});
