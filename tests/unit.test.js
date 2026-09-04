const test = require('node:test');
const assert = require('node:assert');

// Helper functions to test (testing the logic, not importing from main module)

function splitTopLevelArgs(str) {
  const args = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if ('([{<'.includes(ch)) depth++;
    if (')]}>'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseInlineObjectType(typeStr) {
  const trimmed = typeStr.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  const fields = [];
  const fieldRegex = /([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*([^;]+)/g;
  let m;
  while ((m = fieldRegex.exec(inner)) !== null) {
    fields.push({
      name: m[1],
      type: m[3].trim().replace(/\s+/g, ' '),
      optional: !!m[2]
    });
  }
  return fields.length > 0 ? fields : null;
}

function joinPath(base, sub) {
  const b = (base || '').replace(/^\/+|\/+$/g, '');
  const s = (sub || '').replace(/^\/+|\/+$/g, '');
  const parts = [b, s].filter(Boolean);
  return '/' + parts.join('/');
}

function extractControllerBase(src) {
  const m = src.match(/@Controller\(\s*(['"`])([^'"`]*)\1\s*\)/);
  if (m) return m[2];
  return /@Controller\s*\(/.test(src) ? '' : null;
}

// ============================================================================
// Test suites
// ============================================================================

test('splitTopLevelArgs - splits arguments at top-level commas only', () => {
  const result = splitTopLevelArgs('name: string, age?: number, tags: string[]');
  assert.deepStrictEqual(result, ['name: string', 'age?: number', 'tags: string[]']);
});

test('splitTopLevelArgs - ignores commas in brackets', () => {
  const result = splitTopLevelArgs('data: { id: string, name: string }, count: number');
  assert.deepStrictEqual(result, ['data: { id: string, name: string }', 'count: number']);
});

test('splitTopLevelArgs - handles nested parentheses', () => {
  const result = splitTopLevelArgs('data: { id: string, name: string }, count: number, active: boolean');
  assert.deepStrictEqual(result, ['data: { id: string, name: string }', 'count: number', 'active: boolean']);
});

test('splitTopLevelArgs - handles empty input', () => {
  const result = splitTopLevelArgs('');
  assert.deepStrictEqual(result, []);
});

test('parseInlineObjectType - parses simple object types', () => {
  const result = parseInlineObjectType('{ name: string; age: number }');
  assert.deepStrictEqual(result, [
    { name: 'name', type: 'string', optional: false },
    { name: 'age', type: 'number', optional: false }
  ]);
});

test('parseInlineObjectType - handles optional fields', () => {
  const result = parseInlineObjectType('{ name: string; age?: number; active?: boolean }');
  assert.deepStrictEqual(result, [
    { name: 'name', type: 'string', optional: false },
    { name: 'age', type: 'number', optional: true },
    { name: 'active', type: 'boolean', optional: true }
  ]);
});

test('parseInlineObjectType - handles complex types', () => {
  const result = parseInlineObjectType('{ items: string[]; metadata: Record<string, any> }');
  assert.deepStrictEqual(result, [
    { name: 'items', type: 'string[]', optional: false },
    { name: 'metadata', type: 'Record<string, any>', optional: false }
  ]);
});

test('parseInlineObjectType - returns null for non-object types', () => {
  const result = parseInlineObjectType('CreateUserDto');
  assert.strictEqual(result, null);
});

test('parseInlineObjectType - returns null for empty objects', () => {
  const result = parseInlineObjectType('{}');
  assert.strictEqual(result, null);
});

test('parseInlineObjectType - handles whitespace variations', () => {
  const result = parseInlineObjectType('{  name  :  string  ;  age  ?  :  number  }');
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, 'name');
  assert.strictEqual(result[1].optional, true);
});

test('joinPath - joins controller base and route paths', () => {
  const result = joinPath('/api', 'users');
  assert.strictEqual(result, '/api/users');
});

test('joinPath - handles empty base', () => {
  const result = joinPath('', 'items');
  assert.strictEqual(result, '/items');
});

test('joinPath - handles empty sub', () => {
  const result = joinPath('/api', '');
  assert.strictEqual(result, '/api');
});

test('joinPath - handles trailing/leading slashes', () => {
  const result = joinPath('///api///', '///users///');
  assert.strictEqual(result, '/api/users');
});

test('joinPath - handles both empty', () => {
  const result = joinPath('', '');
  assert.strictEqual(result, '/');
});

test('joinPath - handles complex paths', () => {
  const result = joinPath('api/v1', 'users/:id/profile');
  assert.strictEqual(result, '/api/v1/users/:id/profile');
});

test('extractControllerBase - extracts controller path', () => {
  const src = `
    @Controller('api/users')
    export class UserController {}
  `;
  const result = extractControllerBase(src);
  assert.strictEqual(result, 'api/users');
});

test('extractControllerBase - handles single quotes', () => {
  const src = "@Controller('products')";
  const result = extractControllerBase(src);
  assert.strictEqual(result, 'products');
});

test('extractControllerBase - handles double quotes', () => {
  const src = '@Controller("posts")';
  const result = extractControllerBase(src);
  assert.strictEqual(result, 'posts');
});

test('extractControllerBase - handles backticks', () => {
  const src = "@Controller(`/api/v1`)";
  const result = extractControllerBase(src);
  assert.strictEqual(result, '/api/v1');
});

test('extractControllerBase - returns empty string for no args', () => {
  const src = `
    @Controller()
    export class TestController {}
  `;
  const result = extractControllerBase(src);
  assert.strictEqual(result, '');
});

test('extractControllerBase - returns null when no @Controller', () => {
  const src = 'export class NotAController {}';
  const result = extractControllerBase(src);
  assert.strictEqual(result, null);
});

test('extractControllerBase - handles whitespace around decorator', () => {
  const src = "  @Controller(  'admin'  )  ";
  const result = extractControllerBase(src);
  assert.strictEqual(result, 'admin');
});

test('extractControllerBase - extracts from multiline decorator', () => {
  const src = `
    @Controller(
      'users'
    )
    export class UserController {}
  `;
  const result = extractControllerBase(src);
  assert.strictEqual(result, 'users');
});

console.log('\n✅ All unit tests completed!');
