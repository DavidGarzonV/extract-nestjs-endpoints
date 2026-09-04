# 🚀 NestJS Endpoints Extractor

A CLI tool to automatically extract all endpoints from a NestJS project and generate a JSON file with complete information.

## ✨ Features

- **Native file picker**: Opens the operating system dialog to select the project folder
- **Project validation**: Verifies that it is a valid NestJS project
- **Complete extraction**: Includes HTTP method, routes, parameters, body, and file upload fields
- **JSON output**: Generates an `endpoints.json` file with all information

## 📦 Installation

```bash
npm install
```

## 🚀 Usage

### Option 1: Run directly

```bash
npm start
```

or

```bash
node src/index.js
```

### Option 2: Install as a global command

```bash
npm install -g .
extract-endpoints
```

## 📋 What does it validate?

The program verifies that:
- ✓ The folder exists
- ✓ It contains a valid `package.json`
- ✓ It has `@nestjs/core` or `@nestjs/common` dependencies
- ✓ It contains a `src/` folder
- ✓ There is at least one `.controller.ts` file

## 📊 Output

The generated `endpoints.json` file contains:

```json
[
  {
    "routeName": "auth.login",
    "method": "POST",
    "path": "/auth/login",
    "controller": "src/auth/auth.controller.ts",
    "pathParams": [],
    "queryParams": [],
    "body": {
      "contentType": "application/json",
      "fields": [
        { "name": "email", "type": "string" },
        { "name": "password", "type": "string" }
      ]
    },
    "files": []
  }
]
```

## 🖥️ Compatibility

- **Windows**: Uses PowerShell to open native dialog
- **macOS**: Uses osascript
- **Linux**: Tries zenity or kdialog (with fallback to manual input)

If the file picker cannot be opened, simply paste the path when prompted.

## 📝 Usage example

```bash
$ npm start

╔════════════════════════════════════════╗
║  🚀 NestJS Endpoints Extractor        ║
╚════════════════════════════════════════╝

🔍 Looking for NestJS project path...
[File picker opens]
[Select your NestJS project folder]

✓ Selected path: C:\Users\dev\projects\my-api

🔐 Validating NestJS project...
✓ Valid project: my-api

Extracting endpoints...
✓ Endpoints extracted successfully

✨ Done!

📄 Generated file:
   C:\Users\dev\projects\my-api\endpoints.json

📊 Total endpoints extracted: 15
```

## 🔧 Requirements

- Node.js 12+
- npm or yarn

## 📄 License

MIT
