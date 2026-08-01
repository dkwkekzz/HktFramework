// V0-a 계약 파서 — MODULE.yaml 을 읽는 YAML **부분집합** 파서.
//
// 왜 라이브러리를 쓰지 않는가:
//   ① core 와 마찬가지로 런타임 의존성 0개를 지키면 V3 Lab(브라우저)도 같은 코드로 계약을 읽는다.
//   ② 계약은 MODULE-TEMPLATE.yaml 서식으로만 쓴다. 서식 밖 문법은 "모르는 문법" 이 아니라
//      **거부해야 할 계약**이다 — 조용히 해석하는 범용 파서보다 좁고 엄격한 파서가 V0 의 목적에 맞다.
//
// 지원: 매핑 · 시퀀스 · 인라인 시퀀스([a, b]) · 접힘/유지 블록 스칼라(> |) · 주석 · 인용 문자열
// 거부: 탭 들여쓰기 · 앵커(&)/별칭(*) · 플로 매핑({}) · 복수 문서(---) · 태그(!!)

/** 파서가 만들 수 있는 값 — 전부 JSON 직렬화 가능하다 (상태 원소 규칙). */
export type YamlValue = string | number | boolean | null | YamlValue[] | YamlMap;
export interface YamlMap {
  readonly [key: string]: YamlValue;
}

/** 파싱 실패 — 몇 번째 줄에서 왜 거부됐는지 항상 말한다. */
export class YamlParseError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(`${String(line)}행: ${message}`);
    this.name = 'YamlParseError';
    this.line = line;
  }
}

interface Line {
  /** 1부터 세는 원본 줄 번호 */
  readonly number: number;
  readonly indent: number;
  /** 주석과 좌우 공백을 걷어낸 내용 */
  readonly content: string;
  /** 주석을 걷어내지 않은 원본 (블록 스칼라용) */
  readonly raw: string;
}

const QUOTED = /^(?:'([^']*)'|"((?:[^"\\]|\\.)*)")$/;
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const KEY = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/;

/** 인용부호 밖의 `#` 부터를 주석으로 본다. */
function stripComment(raw: string): string {
  let quote: string | null = null;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index] as string;
    if (quote !== null) {
      if (char === '\\' && quote === '"') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    // 줄 첫 글자이거나 앞이 공백일 때만 주석이다 (`a#b` 는 값의 일부).
    if (char === '#' && (index === 0 || /\s/.test(raw[index - 1] as string))) {
      return raw.slice(0, index);
    }
  }
  return raw;
}

function scan(text: string): Line[] {
  const lines: Line[] = [];
  text.split('\n').forEach((raw, index) => {
    const number = index + 1;
    if (raw.includes('\t')) {
      throw new YamlParseError('탭 들여쓰기는 허용하지 않는다 (공백 2칸)', number);
    }
    const content = stripComment(raw).trimEnd();
    if (content.trim() === '') return;
    if (content.trimStart().startsWith('---')) {
      throw new YamlParseError('복수 문서(---)는 허용하지 않는다', number);
    }
    lines.push({ number, indent: raw.length - raw.trimStart().length, content: content.trim(), raw });
  });
  return lines;
}

class Cursor {
  private index = 0;
  private readonly lines: readonly Line[];
  private readonly rawLines: readonly string[];

  // 매개변수 프로퍼티는 타입 스트리핑으로 지울 수 없어(erasableSyntaxOnly) 명시 대입한다.
  constructor(lines: readonly Line[], rawLines: readonly string[]) {
    this.lines = lines;
    this.rawLines = rawLines;
  }

  peek(): Line | null {
    return this.lines[this.index] ?? null;
  }

  next(): Line {
    const line = this.lines[this.index];
    if (line === undefined) throw new YamlParseError('예상보다 일찍 끝났다', this.lines.length);
    this.index += 1;
    return line;
  }

  /** 블록 스칼라 본문 — 줄 번호 이후, 더 깊게 들여쓴 원본 줄들을 모은다. */
  takeBlockScalar(afterLine: number, parentIndent: number, fold: boolean): string {
    const parts: string[] = [];
    let cursorLine = afterLine;
    while (cursorLine < this.rawLines.length) {
      const raw = this.rawLines[cursorLine] as string;
      const indent = raw.length - raw.trimStart().length;
      if (raw.trim() !== '' && indent <= parentIndent) break;
      parts.push(raw.trim());
      cursorLine += 1;
    }
    // 소비한 줄만큼 커서를 민다.
    while (this.index < this.lines.length && (this.lines[this.index] as Line).number <= cursorLine) {
      this.index += 1;
    }
    while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return fold ? parts.join(' ').trim() : parts.join('\n');
  }
}

function parseScalar(text: string, lineNumber: number): YamlValue {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('&') || trimmed.startsWith('*')) {
    throw new YamlParseError('앵커(&)·별칭(*)은 허용하지 않는다', lineNumber);
  }
  if (trimmed.startsWith('{')) {
    throw new YamlParseError('플로 매핑({})은 허용하지 않는다 — 블록 매핑으로 쓸 것', lineNumber);
  }
  if (trimmed.startsWith('!')) {
    throw new YamlParseError('태그(!)는 허용하지 않는다', lineNumber);
  }

  const quoted = QUOTED.exec(trimmed);
  if (quoted !== null) {
    return quoted[1] ?? (quoted[2] ?? '').replace(/\\(.)/g, '$1');
  }

  if (trimmed.startsWith('[')) {
    if (!trimmed.endsWith(']')) {
      throw new YamlParseError('인라인 시퀀스가 닫히지 않았다', lineNumber);
    }
    const inner = trimmed.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((item) => parseScalar(item, lineNumber));
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null' || trimmed === '~') return null;
  if (NUMBER.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseNode(cursor: Cursor, indent: number, rawLines: readonly string[]): YamlValue {
  const first = cursor.peek();
  if (first === null || first.indent < indent) return null;
  return first.content.startsWith('- ') || first.content === '-'
    ? parseSequence(cursor, first.indent, rawLines)
    : parseMapping(cursor, first.indent, rawLines);
}

function parseMapping(cursor: Cursor, indent: number, rawLines: readonly string[]): YamlMap {
  const map: Record<string, YamlValue> = {};
  for (;;) {
    const line = cursor.peek();
    if (line === null || line.indent < indent) break;
    if (line.indent > indent) {
      throw new YamlParseError('들여쓰기가 어긋났다', line.number);
    }
    if (line.content.startsWith('- ')) {
      throw new YamlParseError('매핑 안에 같은 깊이의 시퀀스 항목이 있다', line.number);
    }

    const match = KEY.exec(line.content);
    if (match === null) {
      throw new YamlParseError(`키: 값 형태가 아니다 — ${line.content}`, line.number);
    }
    const key = match[1] as string;
    if (key in map) {
      throw new YamlParseError(`키가 중복됐다 — ${key}`, line.number);
    }
    const inline = (match[2] ?? '').trim();
    cursor.next();

    if (inline === '>' || inline === '>-' || inline === '|' || inline === '|-') {
      map[key] = cursor.takeBlockScalar(line.number, indent, inline.startsWith('>'));
      continue;
    }
    if (inline === '') {
      map[key] = parseNode(cursor, indent + 1, rawLines);
      continue;
    }
    map[key] = parseScalar(inline, line.number);
  }
  return map;
}

function parseSequence(cursor: Cursor, indent: number, rawLines: readonly string[]): YamlValue[] {
  const items: YamlValue[] = [];
  for (;;) {
    const line = cursor.peek();
    if (line === null || line.indent < indent) break;
    if (line.indent > indent) {
      throw new YamlParseError('들여쓰기가 어긋났다', line.number);
    }
    if (!line.content.startsWith('- ') && line.content !== '-') break;

    const body = line.content === '-' ? '' : line.content.slice(2).trim();
    cursor.next();

    if (body === '') {
      items.push(parseNode(cursor, indent + 1, rawLines));
      continue;
    }

    const match = KEY.exec(body);
    if (match === null) {
      items.push(parseScalar(body, line.number));
      continue;
    }

    // `- key: value` — 대시 뒤 열이 곧 이 매핑의 들여쓰기다.
    const itemIndent = indent + 2;
    const map: Record<string, YamlValue> = {};
    const key = match[1] as string;
    const inline = (match[2] ?? '').trim();
    if (inline === '>' || inline === '>-' || inline === '|' || inline === '|-') {
      map[key] = cursor.takeBlockScalar(line.number, itemIndent - 1, inline.startsWith('>'));
    } else if (inline === '') {
      map[key] = parseNode(cursor, itemIndent + 1, rawLines);
    } else {
      map[key] = parseScalar(inline, line.number);
    }

    const rest = cursor.peek();
    if (rest !== null && rest.indent === itemIndent && !rest.content.startsWith('- ')) {
      const tail = parseMapping(cursor, itemIndent, rawLines);
      for (const [tailKey, tailValue] of Object.entries(tail)) {
        if (tailKey in map) {
          throw new YamlParseError(`키가 중복됐다 — ${tailKey}`, line.number);
        }
        map[tailKey] = tailValue;
      }
    }
    items.push(map);
  }
  return items;
}

/** YAML 부분집합을 파싱한다. 서식 밖 문법은 줄 번호와 함께 거부한다. */
export function parseYaml(text: string): YamlValue {
  const rawLines = text.split('\n');
  const lines = scan(text);
  if (lines.length === 0) return null;
  const cursor = new Cursor(lines, rawLines);
  const value = parseNode(cursor, (lines[0] as Line).indent, rawLines);
  const leftover = cursor.peek();
  if (leftover !== null) {
    throw new YamlParseError(`해석되지 않은 줄이 남았다 — ${leftover.content}`, leftover.number);
  }
  return value;
}
