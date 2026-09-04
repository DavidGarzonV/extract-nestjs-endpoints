#!/usr/bin/env node
/**
 * Generic NestJS HTTP endpoint extractor.
 *
 * Scans every `*.controller.ts` file under a source folder and produces a JSON
 * description of each endpoint (method, path, path/query params, body shape -
 * JSON or multipart - and file upload fields), ready to be used to build curl
 * requests. Works on any NestJS project laid out with standard Nest decorators
 * (@Controller, @Get/@Post/..., @Body/@Param/@Query, @UseInterceptors(FileFieldsInterceptor([...]))).
 *
 * This is a lightweight regex/token based parser (not a full TypeScript AST),
 * so highly unusual code styles may not be fully resolved - fields that can't
 * be determined fall back to a generic `any` type.
 *
 * Usage:
 *   node generate-nestjs-endpoints.js [srcDir] [outputFile]
 *
 * Defaults: srcDir = "src", outputFile = "endpoints.json" (both resolved
 * relative to the current working directory).
 */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(process.argv[2] || 'src');
const OUTPUT_FILE = path.resolve(process.argv[3] || 'endpoints.json');

const HTTP_METHODS = [
	'Get',
	'Post',
	'Put',
	'Patch',
	'Delete',
	'Options',
	'Head',
	'All',
];
const PARAM_DECORATORS =
	'Body|Param|Query|Req|Res|UploadedFiles|UploadedFile|Headers';

// ---------------------------------------------------------------------------
// Generic filesystem helpers
// ---------------------------------------------------------------------------

function walk(dir, predicate, results = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (
			entry.name === 'node_modules' ||
			entry.name === 'dist' ||
			entry.name.startsWith('.')
		)
			continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(fullPath, predicate, results);
		else if (predicate(fullPath)) results.push(fullPath);
	}
	return results;
}

function stripComments(src) {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ---------------------------------------------------------------------------
// Balanced-parens / decorator scanning helpers
// ---------------------------------------------------------------------------

function skipBalanced(src, openIdx, openChar, closeChar) {
	let depth = 0;
	let i = openIdx;
	while (i < src.length) {
		if (src[i] === openChar) depth++;
		else if (src[i] === closeChar) {
			depth--;
			if (depth === 0) return i + 1;
		}
		i++;
	}
	return src.length;
}

function skipBalancedParens(src, openIdx) {
	return skipBalanced(src, openIdx, '(', ')');
}

// Given idx pointing right after `(`, returns the text up to the matching `)` (exclusive).
function extractBalanced(src, startIdx) {
	let depth = 1;
	let i = startIdx;
	while (i < src.length && depth > 0) {
		if (src[i] === '(') depth++;
		else if (src[i] === ')') depth--;
		i++;
	}
	return src.slice(startIdx, i - 1);
}

function readDecoratorArgs(src, idx) {
	let i = idx;
	while (/\s/.test(src[i])) i++;
	if (src[i] !== '(') return { argsStr: null, nextIdx: idx };
	const start = i + 1;
	const end = skipBalancedParens(src, i);
	return { argsStr: src.slice(start, end - 1), nextIdx: end };
}

// Skips whitespace/decorators/access modifiers, returning where the actual token starts
// and the raw text that was skipped (used to look for @UseInterceptors(...) content).
function skipDecoratorsAndModifiers(src, idx) {
	let i = idx;
	const blockStart = idx;
	while (true) {
		while (/\s/.test(src[i])) i++;
		if (src[i] === '@') {
			i++;
			while (/[\w.]/.test(src[i])) i++;
			const { nextIdx } = readDecoratorArgs(src, i);
			i = nextIdx;
			continue;
		}
		const modMatch = /^(public|private|protected|static|readonly)\b/.exec(
			src.slice(i, i + 20),
		);
		if (modMatch) {
			i += modMatch[0].length;
			continue;
		}
		break;
	}
	return { nextIdx: i, skippedText: src.slice(blockStart, i) };
}

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

// ---------------------------------------------------------------------------
// Controller parsing
// ---------------------------------------------------------------------------

function extractControllerBase(src) {
	const m = src.match(/@Controller\(\s*(['"`])([^'"`]*)\1\s*\)/);
	if (m) return m[2];
	// @Controller() with no prefix, or @Controller(SOME_CONST) - treat as empty prefix.
	return /@Controller\s*\(/.test(src) ? '' : null;
}

// Parses FileFieldsInterceptor([{ name: 'x', maxCount: 1 }, ...]) within a decorators block.
function extractFileFields(decoratorsBlock) {
	const fields = [];
	const interceptorMatch = decoratorsBlock.match(/FileFieldsInterceptor\s*\(/);
	if (!interceptorMatch) return fields;
	const idx = interceptorMatch.index + interceptorMatch[0].length - 1;
	const argsStr = extractBalanced(decoratorsBlock, idx + 1);
	const fieldRegex =
		/\{\s*name:\s*['"]([^'"]+)['"]\s*(?:,\s*maxCount:\s*(\d+))?\s*\}/g;
	let fm;
	while ((fm = fieldRegex.exec(argsStr)) !== null) {
		fields.push({ campo: fm[1], maxCount: fm[2] ? Number(fm[2]) : 1 });
	}
	return fields;
}

function parseParams(paramsStr) {
	const args = splitTopLevelArgs(paramsStr);
	const result = [];
	for (const arg of args) {
		const decoratorMatch = arg.match(
			new RegExp(`@(${PARAM_DECORATORS})\\s*(\\(([^]*)\\))?`),
		);
		if (!decoratorMatch) {
			const nameTypeMatch = arg.match(/([A-Za-z0-9_]+)\s*(\?)?\s*:\s*([^=]+)$/);
			result.push({
				source: 'other',
				key: null,
				name: nameTypeMatch ? nameTypeMatch[1] : undefined,
				type: nameTypeMatch
					? nameTypeMatch[3].trim().replace(/\s+/g, ' ')
					: undefined,
				optional: !!(nameTypeMatch && nameTypeMatch[2]),
				destructured: null,
			});
			continue;
		}
		const source = decoratorMatch[1];
		let key = null;
		if (decoratorMatch[3]) {
			const strMatch = decoratorMatch[3].trim().match(/^['"]([^'"]+)['"]/);
			if (strMatch) key = strMatch[1];
		}
		const rest = arg.slice(decoratorMatch.index + decoratorMatch[0].length);
		// Destructured parameter, e.g. `{ id }: UUIDDto`.
		const destructureMatch = rest.match(/^\s*\{([^}]*)\}\s*:\s*([^=]+)$/);
		if (destructureMatch) {
			const destructured = destructureMatch[1]
				.split(',')
				.map((s) => s.trim().split(':')[0].trim())
				.filter(Boolean);
			result.push({
				source,
				key,
				name: null,
				type: destructureMatch[2].trim().replace(/\s+/g, ' '),
				optional: false,
				destructured,
			});
			continue;
		}
		const nameTypeMatch = rest.match(/([A-Za-z0-9_]+)\s*(\?)?\s*:\s*([^=]+)$/);
		result.push({
			source,
			key,
			name: nameTypeMatch ? nameTypeMatch[1] : undefined,
			type: nameTypeMatch
				? nameTypeMatch[3].trim().replace(/\s+/g, ' ')
				: undefined,
			optional: !!(nameTypeMatch && nameTypeMatch[2]),
			destructured: null,
		});
	}
	return result;
}

function extractMethods(src) {
	const methods = [];
	const decoratorRegex = new RegExp(`@(${HTTP_METHODS.join('|')})\\b`, 'g');
	let match;
	while ((match = decoratorRegex.exec(src)) !== null) {
		const httpMethod = match[1];
		const { argsStr, nextIdx } = readDecoratorArgs(
			src,
			decoratorRegex.lastIndex,
		);
		let routePath = '';
		if (argsStr) {
			const strMatch = argsStr.match(/^\s*['"`]([^'"`]*)['"`]\s*$/);
			if (strMatch) routePath = strMatch[1];
		}
		decoratorRegex.lastIndex = nextIdx;

		const { nextIdx: afterDecoratorsIdx, skippedText } =
			skipDecoratorsAndModifiers(src, nextIdx);
		const asyncMatch = /^async\s+/.exec(
			src.slice(afterDecoratorsIdx, afterDecoratorsIdx + 10),
		);
		const nameStart = asyncMatch
			? afterDecoratorsIdx + asyncMatch[0].length
			: afterDecoratorsIdx;
		const nameMatch = /^([A-Za-z0-9_$]+)\s*\(/.exec(
			src.slice(nameStart, nameStart + 200),
		);
		if (!nameMatch) continue;
		const methodName = nameMatch[1];
		const parenStart = nameStart + nameMatch[0].length;
		const paramsStr = extractBalanced(src, parenStart);
		const params = parseParams(paramsStr);
		const fileFields = extractFileFields(skippedText);
		methods.push({ httpMethod, routePath, methodName, params, fileFields });
	}
	return methods;
}

// ---------------------------------------------------------------------------
// DTO field resolution (best effort, resolves whole @Body()/@Query()/@Param() objects)
// ---------------------------------------------------------------------------

function buildClassIndex(srcRoot) {
	const files = walk(srcRoot, (f) => f.endsWith('.ts'));
	const index = {};
	for (const file of files) {
		let src;
		try {
			src = stripComments(fs.readFileSync(file, 'utf8'));
		} catch {
			continue;
		}
		const regex =
			/export\s+class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/g;
		let m;
		while ((m = regex.exec(src)) !== null) {
			index[m[1]] = { file, src, extends: m[2] || null };
		}
	}
	return index;
}

function extractClassBody(src, className) {
	const marker = new RegExp(`class\\s+${className}\\b[^{]*\\{`);
	const m = marker.exec(src);
	if (!m) return null;
	const braceStart = m.index + m[0].length - 1;
	const end = skipBalanced(src, braceStart, '{', '}');
	return src.slice(braceStart + 1, end - 1);
}

// Removes decorator call arguments (`@Foo(...)` -> `@Foo`) so property regex isn't confused
// by commas/colons/braces inside decorator options (e.g. @Transform(({value}) => {...})).
function stripDecoratorArgs(body) {
	let result = '';
	let i = 0;
	while (i < body.length) {
		if (body[i] === '@') {
			let j = i + 1;
			while (/[\w.]/.test(body[j])) j++;
			result += body.slice(i, j);
			i = j;
			let k = i;
			while (/\s/.test(body[k])) k++;
			if (body[k] === '(') {
				i = skipBalancedParens(body, k);
			}
			continue;
		}
		result += body[i];
		i++;
	}
	return result;
}

function parseClassFields(body) {
	const cleaned = stripDecoratorArgs(body);
	const fieldRegex = /(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*([^;\n]+);/g;
	const fields = [];
	let m;
	while ((m = fieldRegex.exec(cleaned)) !== null) {
		const name = m[1];
		if (['constructor', 'get', 'set'].includes(name)) continue;
		fields.push({
			name: name,
			type: m[3].trim().replace(/\s+/g, ' '),
			optional: !!m[2],
		});
	}
	return fields;
}

// Parses inline object type definitions like `{ name: string; age?: number; email: string }`
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
			optional: !!m[2],
		});
	}
	return fields.length > 0 ? fields : null;
}

function resolveDtoFields(
	className,
	classIndex,
	cache = new Map(),
	stack = new Set(),
) {
	if (cache.has(className)) return cache.get(className);
	if (stack.has(className)) return null; // circular guard

	// Check if this is an inline object type definition
	const inlineFields = parseInlineObjectType(className);
	if (inlineFields) {
		cache.set(className, inlineFields);
		return inlineFields;
	}

	const info = classIndex[className];
	if (!info) {
		cache.set(className, null);
		return null;
	}
	stack.add(className);
	const body = extractClassBody(info.src, className);
	const ownFields = body ? parseClassFields(body) : [];

	let merged = [];
	if (info.extends) {
		const inherited = resolveDtoFields(info.extends, classIndex, cache, stack);
		if (inherited) merged = inherited.slice();
	}
	for (const f of ownFields) {
		const idx = merged.findIndex((x) => x.name === f.name);
		if (idx >= 0) merged[idx] = f;
		else merged.push(f);
	}

	stack.delete(className);
	cache.set(className, merged);
	return merged;
}

// ---------------------------------------------------------------------------
// Endpoint assembly
// ---------------------------------------------------------------------------

function joinPath(base, sub) {
	const b = (base || '').replace(/^\/+|\/+$/g, '');
	const s = (sub || '').replace(/^\/+|\/+$/g, '');
	const parts = [b, s].filter(Boolean);
	return '/' + parts.join('/');
}

function expandParam(p, classIndex, dtoCache) {
	if (p.destructured) {
		const known = resolveDtoFields(p.type, classIndex, dtoCache);
		if (known) {
			return p.destructured.map((name) => {
				const found = known.find((f) => f.name === name);
				return found
					? { name: found.name, type: found.type, optional: found.optional }
					: { name: name, type: 'any', optional: false };
			});
		}
		return p.destructured.map((name) => ({
			name: name,
			type: 'any',
			optional: false,
		}));
	}
	if (!p.key) {
		const known = resolveDtoFields(p.type, classIndex, dtoCache);
		if (known && known.length > 0) return known;
		// Check if it's an inline type or a class name
		const isInlineType = p.type && p.type.trim().startsWith('{');
		return [
			{
				name: '(whole object)',
				type: p.type || 'any',
				optional: false,
				...(p.type &&
					!isInlineType &&
					!['string', 'number', 'boolean', 'Date', 'any'].includes(p.type) && {
						dtoNotFound: true,
					}),
			},
		];
	}
	return [{ name: p.key, type: p.type || 'string', optional: !!p.optional }];
}

function buildEndpoints(controllerFiles, classIndex) {
	const dtoCache = new Map();
	const endpoints = [];

	for (const file of controllerFiles) {
		const raw = fs.readFileSync(file, 'utf8');
		const src = stripComments(raw);
		const base = extractControllerBase(src);
		if (base === null) continue; // no @Controller found, not a real controller
		const methods = extractMethods(src);
		const relFile = path
			.relative(process.cwd(), file)
			.split(path.sep)
			.join('/');

		for (const m of methods) {
			const fullPath = joinPath(base, m.routePath);
			const isMultipart = m.fileFields.length > 0;

			const pathParams = m.params
				.filter((p) => p.source === 'Param')
				.flatMap((p) => expandParam(p, classIndex, dtoCache))
				.map(({ name, type }) => ({ name, type }));

			const queryParams = m.params
				.filter((p) => p.source === 'Query')
				.flatMap((p) => expandParam(p, classIndex, dtoCache));

			const bodyFields = m.params.filter((p) => p.source === 'Body');
			let body = null;

			if (isMultipart) {
				// In multipart requests, @Body('key', ParseJsonPipe) fields arrive as separate form fields (JSON-encoded strings).
				const textFields = bodyFields
					.filter((p) => p.key)
					.map((p) => ({
						field: p.key,
						type: p.type || 'any',
						format: 'json-string',
					}));
				body = { contentType: 'multipart/form-data', textFields };
			} else if (bodyFields.length > 0) {
				const wholeBody = bodyFields.find((p) => !p.key);
				if (wholeBody) {
					const known = resolveDtoFields(wholeBody.type, classIndex, dtoCache);
					const isInlineType =
						wholeBody.type && wholeBody.type.trim().startsWith('{');
					body = {
						contentType: 'application/json',
						schema: wholeBody.type || 'any',
						fields: known,
						...(known === null &&
							!isInlineType && {
								dtoNotFound: true,
								suggestion: `DTO class "${wholeBody.type}" not found in scanned files`,
							}),
					};
				} else {
					body = {
						contentType: 'application/json',
						fields: bodyFields.map((p) => ({
							name: p.key,
							type: p.type || 'any',
						})),
					};
				}
			}

			const files = m.fileFields.map((f) => ({
				field: f.campo,
				maxCount: f.maxCount,
			}));

			endpoints.push({
				routeName: `${base || 'root'}.${m.methodName}`,
				method: m.httpMethod.toUpperCase(),
				path: fullPath,
				pathParams,
				queryParams,
				body,
				files,
			});
		}
	}

	return endpoints;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
	if (!fs.existsSync(SRC_ROOT)) {
		console.error(`Source directory not found: ${SRC_ROOT}`);
		process.exit(1);
	}

	const controllerFiles = walk(SRC_ROOT, (f) => f.endsWith('.controller.ts'));
	const classIndex = buildClassIndex(SRC_ROOT);
	const endpoints = buildEndpoints(controllerFiles, classIndex);

	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(endpoints, null, 2));
	console.log(`Controllers scanned: ${controllerFiles.length}`);
	console.log(`Endpoints extracted: ${endpoints.length}`);
	console.log(`Output written to: ${OUTPUT_FILE}`);
}

main();
