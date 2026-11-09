// A YAML reader for exactly what Figma's OpenAPI file uses (block maps and lists, plain / quoted / folded scalars, `[]` and `{}`), Node builtins only.
// Not a general YAML parser: anchors, tags and multi-document files are not supported, and the reader throws instead of guessing when it meets one.
const scalar = (raw) => {
  const t = raw.trim();
  if (t === '' || t === '~' || t === 'null') return t === '' ? null : null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === '[]') return [];
  if (t === '{}') return {};
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith('"')) { try { return JSON.parse(t); } catch { return t.slice(1, -1); } }
  if (t.startsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  if (t.startsWith('[') && t.endsWith(']')) return t.slice(1, -1).split(',').map((x) => scalar(x)).filter((x) => x !== null && x !== '');
  if (/^[&*!]/.test(t)) throw new Error(`yaml-lite: anchors / aliases / tags are not supported: ${t.slice(0, 40)}`);
  return t;
};

export function parseYaml(text) {
  // logical lines: [indent, content]; a quoted / plain scalar that continues on deeper lines is joined into one line first
  const raw = text.replace(/\r/g, '').split('\n');
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.match(/^ */)[0].length;
    const i0 = i; // line number in the file, for error messages
    let content = line.trim();
    const block = /^(.*?:|-)\s+[|>][+-]?$/.exec(content) || /^[|>][+-]?$/.exec(content);
    if (block) { // block scalar: everything indented deeper belongs to it
      let j = i + 1; const body = [];
      while (j < raw.length && (!raw[j].trim() || raw[j].match(/^ */)[0].length > indent)) { body.push(raw[j].trim()); j++; }
      i = j - 1;
      lines.push([indent, `${content.replace(/\s+[|>][+-]?$/, '')} "${body.join(' ').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`, i0 + 1]);
      continue;
    }
    // continuation of a scalar: following lines that are deeper than this one and do not start a key or a list item
    let j = i + 1;
    // the quote that matters is the one that STARTS the value (`key: "..."`, `- "..."`), not one inside the text (`'... textTruncation: "ENDING" ...'`)
    const body0 = content.startsWith('- ') ? content.slice(2) : content;
    const kv = body0.match(/^(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^"'\s].*?):(?:\s+(.*)|$)/); // `key: value`, `"200":` (a quoted key has no value on its line)
    const valueStart = (kv ? kv[1] ?? '' : body0).trimStart();
    const quote = valueStart[0] === '"' || valueStart[0] === "'" ? valueStart[0] : null;
    const closed = (v, q) => (q === '"' ? /^"(?:[^"\\]|\\.)*"\s*$/ : /^'(?:[^']|'')*'\s*$/).test(v);
    const unclosedQuote = !!quote && !closed(valueStart, quote);
    if (unclosedQuote) { // a quoted scalar runs until its closing quote, blank lines included
      let acc = valueStart;
      // continuation lines are indented deeper than the key; a blank line inside the scalar is kept as a space
      while (j < raw.length && !closed(acc, quote) && (!raw[j].trim() || raw[j].match(/^ */)[0].length > indent)) { acc += ` ${raw[j].trim()}`; content += ` ${raw[j].trim()}`; j++; }
    } else if (/^[^"'\s].*?:\s+\S/.test(content) && !content.startsWith('- ')) { // a plain scalar continues on deeper lines that start neither a key nor a list item
      while (j < raw.length && raw[j].trim() && raw[j].match(/^ */)[0].length > indent && !/^[\w$"'/.:-]+:(\s|$)/.test(raw[j].trim()) && !raw[j].trim().startsWith('- ')) { content += ` ${raw[j].trim()}`; j++; }
    }
    i = j - 1;
    lines.push([indent, content, i0 + 1]);
  }
  let pos = 0;
  const value = (minIndent) => {
    const [indent, content] = lines[pos];
    if (indent < minIndent) return null;
    return content.startsWith('- ') || content === '-' ? list(indent) : map(indent);
  };
  const keyOf = (content) => {
    const m = content.match(/^("(?:[^"\\]|\\.)*"|'[^']*'|.*?):(?:\s+(.*)|$)/); // a key may contain ':' when no space follows it (`current_user:read`)
    if (!m) throw new Error(`yaml-lite: cannot read line: ${content.slice(0, 80)}`);
    return [m[1].replace(/^["']|["']$/g, ''), m[2] ?? ''];
  };
  const map = (indent) => {
    const out = {};
    while (pos < lines.length && lines[pos][0] === indent && !lines[pos][1].startsWith('- ')) {
      const [k, rest] = keyOf(lines[pos][1]);
      pos++;
      if (rest !== '') out[k] = scalar(rest);
      else out[k] = pos < lines.length && (lines[pos][0] > indent || (lines[pos][0] === indent && lines[pos][1].startsWith('- '))) ? value(indent) : null;
    }
    return out;
  };
  const list = (indent) => {
    const out = [];
    while (pos < lines.length && lines[pos][0] === indent && lines[pos][1].startsWith('-')) {
      const content = lines[pos][1].replace(/^-\s*/, '');
      if (content === '') { pos++; out.push(value(indent + 1)); continue; }
      if (/^[^"'\s].*?:(\s|$)/.test(content)) { // `- key: value` starts a map whose keys sit two columns deeper
        lines[pos] = [indent + 2, content];
        out.push(map(indent + 2));
      } else { out.push(scalar(content)); pos++; }
    }
    return out;
  };
  const result = value(0);
  if (pos < lines.length) throw new Error(`yaml-lite: stopped at file line ${lines[pos][2]} (indent ${lines[pos][0]}): ${lines[pos][1].slice(0, 100)}`);
  return result;
}
