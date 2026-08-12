// 의존성 없는 YAML 서브셋 파서.
// 이 트랙의 공식 Artifact 가 사용하는 부분집합만 지원한다:
//   - 들여쓰기 기반 맵 / `- ` 리스트 (스칼라 항목, 맵 항목)
//   - 스칼라: null/~, true/false, 정수, 실수, 따옴표 문자열, 평문 문자열
//   - 블록 스칼라 `>` `|` (chomping `-` 허용)
//   - 인라인 리스트 `[]`, `[a, b]`
//   - `#` 주석 (전체 행 / 비따옴표 값의 트레일링)
// 앵커·별칭·다중문서·flow map 은 지원하지 않는다 — Artifact 작성 시 사용 금지.

export function parseYaml(text) {
  const lines = [];
  const raw = String(text).split(/\r?\n/);
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = line.match(/^ */)[0].length;
    lines.push({ indent, text: trimmed, n: i + 1 });
  }
  if (lines.length === 0) return null;
  const [value, pos] = parseBlock(lines, 0, lines[0].indent);
  if (pos < lines.length) {
    throw new Error(`yaml: line ${lines[pos].n}: unexpected content (indentation error?)`);
  }
  return value;
}

function parseBlock(lines, pos, indent) {
  if (pos >= lines.length || lines[pos].indent < indent) return [null, pos];
  const isList = lines[pos].text === '-' || lines[pos].text.startsWith('- ');
  return isList ? parseList(lines, pos, indent) : parseMap(lines, pos, indent);
}

function parseMap(lines, pos, indent) {
  const obj = {};
  while (pos < lines.length && lines[pos].indent === indent) {
    const { text, n } = lines[pos];
    if (text === '-' || text.startsWith('- ')) break;
    const m = text.match(/^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/);
    if (!m) throw new Error(`yaml: line ${n}: expected "key: value", got "${text}"`);
    let key = m[1].trim();
    if (/^["'].*["']$/.test(key)) key = key.slice(1, -1);
    const rest = m[2] !== undefined ? m[2].trim() : '';
    pos++;
    if (rest === '' ) {
      // 중첩 블록 또는 null
      if (pos < lines.length && lines[pos].indent > indent) {
        const [child, next] = parseBlock(lines, pos, lines[pos].indent);
        obj[key] = child;
        pos = next;
      } else {
        obj[key] = null;
      }
    } else if (/^[>|][+-]?$/.test(rest)) {
      const fold = rest[0] === '>';
      const parts = [];
      while (pos < lines.length && lines[pos].indent > indent) {
        parts.push(lines[pos].text);
        pos++;
      }
      obj[key] = parts.join(fold ? ' ' : '\n');
    } else {
      obj[key] = parseScalar(rest, n);
    }
  }
  return [obj, pos];
}

function parseList(lines, pos, indent) {
  const arr = [];
  while (pos < lines.length && lines[pos].indent === indent) {
    const { text, n } = lines[pos];
    if (text !== '-' && !text.startsWith('- ')) break;
    const content = text === '-' ? '' : text.slice(2).trim();
    if (content === '') {
      pos++;
      if (pos < lines.length && lines[pos].indent > indent) {
        const [child, next] = parseBlock(lines, pos, lines[pos].indent);
        arr.push(child);
        pos = next;
      } else {
        arr.push(null);
      }
    } else if (/^("[^"]*"|'[^']*'|[^:]+?):(\s|$)/.test(content)) {
      // 맵 항목: `- key: value` — 항목 본문을 가상 들여쓰기(indent+2)로 재구성
      const itemIndent = indent + 2;
      const slice = [{ indent: itemIndent, text: content, n }];
      pos++;
      while (pos < lines.length && lines[pos].indent >= itemIndent &&
             !(lines[pos].indent === indent)) {
        slice.push(lines[pos]);
        pos++;
      }
      const [child, next] = parseBlock(slice, 0, itemIndent);
      if (next < slice.length) {
        throw new Error(`yaml: line ${slice[next].n}: bad list item indentation`);
      }
      arr.push(child);
    } else {
      arr.push(parseScalar(content, n));
      pos++;
    }
  }
  return [arr, pos];
}

function parseScalar(s, n) {
  s = s.trim();
  if (s.startsWith('"')) {
    const m = s.match(/^"([^"]*)"/);
    if (!m) throw new Error(`yaml: line ${n}: unterminated string`);
    return m[1];
  }
  if (s.startsWith("'")) {
    const m = s.match(/^'([^']*)'/);
    if (!m) throw new Error(`yaml: line ${n}: unterminated string`);
    return m[1];
  }
  // 비따옴표 값의 트레일링 주석 제거
  const hash = s.search(/\s#/);
  if (hash >= 0) s = s.slice(0, hash).trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === '[]') return [];
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((x) => parseScalar(x.trim(), n));
  }
  if (/^-?[0-9]+$/.test(s)) return parseInt(s, 10);
  if (/^-?[0-9]+\.[0-9]+$/.test(s)) return parseFloat(s);
  return s;
}
