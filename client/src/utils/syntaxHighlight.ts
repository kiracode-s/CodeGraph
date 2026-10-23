import { Language } from '../types';

export interface CodeToken {
  type: 'keyword' | 'control' | 'type' | 'function' | 'string' | 'number' | 'comment' | 'operator' | 'punctuation' | 'identifier' | 'boolean' | 'decorator';
  text: string;
}

// Language keywords definition
const KEYWORDS: Record<Language, {
  control: Set<string>;
  keywords: Set<string>;
  types: Set<string>;
  builtins: Set<string>;
}> = {
  python: {
    control: new Set(['if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return', 'yield', 'try', 'except', 'finally', 'raise', 'with', 'as', 'pass', 'match', 'case']),
    keywords: new Set(['def', 'class', 'import', 'from', 'lambda', 'global', 'nonlocal', 'assert', 'del', 'async', 'await', 'in', 'is', 'not', 'and', 'or']),
    types: new Set(['int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple', 'bytes', 'object', 'None', 'True', 'False', 'Self', 'Any', 'Optional', 'Union']),
    builtins: new Set(['print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'reversed', 'type', 'isinstance', 'input', 'open', 'id', 'dir', 'repr'])
  },
  javascript: {
    control: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally', 'yield', 'default']),
    keywords: new Set(['const', 'let', 'var', 'function', 'class', 'import', 'export', 'from', 'as', 'async', 'await', 'new', 'this', 'super', 'extends', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of']),
    types: new Set(['number', 'string', 'boolean', 'symbol', 'bigint', 'undefined', 'null', 'true', 'false', 'Array', 'Object', 'Function', 'Promise', 'Map', 'Set']),
    builtins: new Set(['console', 'log', 'warn', 'error', 'Math', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'setInterval', 'clearTimeout'])
  },
  c: {
    control: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'goto', 'default']),
    keywords: new Set(['struct', 'union', 'enum', 'typedef', 'sizeof', 'static', 'extern', 'const', 'volatile', 'register', 'inline', 'auto']),
    types: new Set(['int', 'char', 'float', 'double', 'short', 'long', 'void', 'signed', 'unsigned', 'size_t', 'bool', 'NULL', 'true', 'false']),
    builtins: new Set(['printf', 'scanf', 'malloc', 'calloc', 'realloc', 'free', 'exit', 'memcpy', 'memset', 'strlen', 'strcpy', 'strcmp', 'fopen', 'fclose'])
  },
  cpp: {
    control: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'goto', 'default', 'try', 'catch', 'throw']),
    keywords: new Set(['class', 'struct', 'union', 'enum', 'typedef', 'typename', 'template', 'namespace', 'using', 'public', 'private', 'protected', 'virtual', 'override', 'final', 'friend', 'operator', 'new', 'delete', 'this', 'constexpr', 'static', 'const', 'auto', 'decltype', 'sizeof', 'alignas', 'alignof', 'noexcept']),
    types: new Set(['int', 'char', 'float', 'double', 'short', 'long', 'void', 'bool', 'signed', 'unsigned', 'size_t', 'string', 'vector', 'pair', 'map', 'set', 'unordered_map', 'unordered_set', 'queue', 'stack', 'NULL', 'nullptr', 'true', 'false']),
    builtins: new Set(['std', 'cout', 'cin', 'endl', 'printf', 'scanf', 'malloc', 'free', 'push_back', 'emplace_back', 'size', 'empty', 'begin', 'end', 'sort', 'reverse', 'max', 'min'])
  },
  java: {
    control: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'default', 'try', 'catch', 'finally', 'throw', 'throws']),
    keywords: new Set(['class', 'interface', 'enum', 'extends', 'implements', 'package', 'import', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'native', 'new', 'this', 'super', 'instanceof']),
    types: new Set(['int', 'char', 'float', 'double', 'byte', 'short', 'long', 'boolean', 'void', 'String', 'Integer', 'Double', 'Boolean', 'Character', 'Object', 'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet', 'null', 'true', 'false']),
    builtins: new Set(['System', 'out', 'println', 'print', 'printf', 'Scanner', 'Math', 'Arrays', 'Collections', 'length', 'size', 'add', 'get', 'set', 'remove'])
  }
};

/**
 * Tokenizes a single line of code into VS Code colored tokens.
 */
export function tokenizeLine(line: string, language: Language): CodeToken[] {
  const langConfig = KEYWORDS[language] || KEYWORDS.python;
  const tokens: CodeToken[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    const ch = line[i];

    // 1. Whitespace
    if (/\s/.test(ch)) {
      let space = '';
      while (i < len && /\s/.test(line[i])) {
        space += line[i++];
      }
      tokens.push({ type: 'punctuation', text: space });
      continue;
    }

    // 2. Comments
    if (
      (language === 'python' && ch === '#') ||
      ((language === 'c' || language === 'cpp' || language === 'java' || language === 'javascript') && ch === '/' && line[i + 1] === '/')
    ) {
      tokens.push({ type: 'comment', text: line.substring(i) });
      break;
    }

    // 3. Strings
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let str = quote;
      i++;
      let escaped = false;
      while (i < len) {
        const c = line[i++];
        str += c;
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === quote) {
          break;
        }
      }
      tokens.push({ type: 'string', text: str });
      continue;
    }

    // 4. Numbers
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(line[i + 1] || ''))) {
      let num = '';
      if (ch === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X' || line[i + 1] === 'b' || line[i + 1] === 'B')) {
        num += line[i++];
        num += line[i++];
        while (i < len && /[0-9a-fA-F]/.test(line[i])) {
          num += line[i++];
        }
      } else {
        while (i < len && /[0-9a-zA-Z_.]/.test(line[i])) {
          num += line[i++];
        }
      }
      tokens.push({ type: 'number', text: num });
      continue;
    }

    // 5. Identifiers, Keywords, Functions
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_$]/.test(line[i])) {
        ident += line[i++];
      }

      // Peek if followed by '(' -> function call
      let j = i;
      while (j < len && /\s/.test(line[j])) j++;
      const isCall = j < len && line[j] === '(';

      if (langConfig.control.has(ident)) {
        tokens.push({ type: 'control', text: ident });
      } else if (langConfig.keywords.has(ident)) {
        tokens.push({ type: 'keyword', text: ident });
      } else if (langConfig.types.has(ident)) {
        tokens.push({ type: 'type', text: ident });
      } else if (ident === 'true' || ident === 'false' || ident === 'True' || ident === 'False' || ident === 'null' || ident === 'None' || ident === 'nullptr') {
        tokens.push({ type: 'boolean', text: ident });
      } else if (isCall || langConfig.builtins.has(ident)) {
        tokens.push({ type: 'function', text: ident });
      } else {
        tokens.push({ type: 'identifier', text: ident });
      }
      continue;
    }

    // 6. Preprocessor directives in C/C++ (#include, #define)
    if (ch === '#' && (language === 'c' || language === 'cpp')) {
      let dir = '';
      while (i < len && /[#a-zA-Z0-9_]/.test(line[i])) {
        dir += line[i++];
      }
      tokens.push({ type: 'control', text: dir });
      continue;
    }

    // 7. Operators & Punctuation
    const twoChar = line.substring(i, i + 2);
    const multiOps = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '->', '=>', '+=', '-=', '*=', '/=', '<<', '>>', '::'];
    if (multiOps.includes(twoChar)) {
      tokens.push({ type: 'operator', text: twoChar });
      i += 2;
      continue;
    }

    if (/[+\-*/%=<>!&|^~?:,]/.test(ch)) {
      tokens.push({ type: 'operator', text: ch });
      i++;
      continue;
    }

    if (/[{}()[\];.]/.test(ch)) {
      tokens.push({ type: 'punctuation', text: ch });
      i++;
      continue;
    }

    tokens.push({ type: 'punctuation', text: ch });
    i++;
  }

  return tokens;
}

/**
 * Returns VS Code CSS classes or colors for token types in Dark+ Theme
 */
export function getVSCodeTokenStyle(type: CodeToken['type']): string {
  switch (type) {
    case 'control':
      // VS Code magenta for control flow (if, for, while, return, etc.)
      return 'text-[#C586C0] font-semibold';
    case 'keyword':
      // VS Code blue for definition keywords (def, class, const, let, etc.)
      return 'text-[#569CD6] font-semibold';
    case 'type':
      // VS Code teal for types (int, str, vector, etc.)
      return 'text-[#4EC9B0]';
    case 'function':
      // VS Code warm yellow for function calls & defs
      return 'text-[#DCDCAA]';
    case 'string':
      // VS Code peach / coral for strings
      return 'text-[#CE9178]';
    case 'number':
      // VS Code light green for numbers
      return 'text-[#B5CEA8]';
    case 'boolean':
      // VS Code blue/green for booleans and null/None
      return 'text-[#569CD6] font-medium';
    case 'comment':
      // VS Code muted green for comments
      return 'text-[#6A9955] italic';
    case 'operator':
      // VS Code bright neutral for operators
      return 'text-[#D4D4D4]';
    case 'punctuation':
      return 'text-[#CCCCCC]';
    case 'identifier':
    default:
      // VS Code light sky blue for identifiers
      return 'text-[#9CDCFE]';
  }
}
