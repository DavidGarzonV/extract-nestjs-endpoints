# Unit Tests

This directory contains unit tests for the `extract-nestjs-endpoints` project using Node.js's built-in test runner.

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test file
```bash
npm run test:unit
```

Or directly:
```bash
node --test tests/unit.test.js
```

## Test Coverage

### `unit.test.js` - Core Utility Functions

Tests for the core parsing and path manipulation functions:

#### `splitTopLevelArgs(str)`
- Splits function arguments at top-level commas only
- Correctly handles nested brackets `{}`, `()`, `[]`, `<>`
- Tests:
  - Basic argument splitting
  - Nested object types in arguments
  - Empty input handling

#### `parseInlineObjectType(typeStr)`
- Parses inline TypeScript object type definitions like `{ name: string; age?: number }`
- Extracts field names, types, and optional flags
- Tests:
  - Simple object types
  - Optional fields with `?` modifier
  - Complex types like `Record<string, any>`, `Array<string>`
  - Non-object type detection
  - Empty object handling
  - Whitespace variation handling

#### `joinPath(base, sub)`
- Joins controller base path and route paths
- Normalizes slashes and removes trailing/leading slashes
- Tests:
  - Basic path joining `/api` + `users` = `/api/users`
  - Empty base or sub path handling
  - Multiple trailing/leading slash cleanup
  - Complex path segments with parameters

#### `extractControllerBase(src)`
- Extracts `@Controller('path')` decorator value from source code
- Handles different quote styles
- Tests:
  - Single quotes, double quotes, backticks
  - Empty `@Controller()` decorator
  - Missing `@Controller` decorator
  - Whitespace variations
  - Multiline decorator formatting

## Test Statistics

- **Total Tests:** 24
- **Test Categories:**
  - `splitTopLevelArgs`: 4 tests
  - `parseInlineObjectType`: 6 tests
  - `joinPath`: 6 tests
  - `extractControllerBase`: 8 tests

## Requirements

- **Node.js:** v18.0.0 or higher (for built-in `node:test` module)
- **No external dependencies** needed for tests (uses Node.js built-in `assert`)

## Test Framework

Uses Node.js's built-in test runner:
- Module: `node:test`
- Assertion library: `node:assert`
- No external testing framework required

## Notes

- Tests are isolated and don't depend on file I/O or external systems
- Functions are re-implemented in the test file for unit testing purposes
- All tests use synchronous assertions
- Tests validate both happy paths and edge cases
