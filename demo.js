#!/usr/bin/env node

/**
 * Demo script: simulates execution without needing a real project
 */
const chalk = require('chalk');

console.log(chalk.blueBright('\n╔════════════════════════════════════════╗'));
console.log(chalk.blueBright('║  🚀 NestJS Endpoints Extractor        ║'));
console.log(chalk.blueBright('║     Demo / Test Mode                   ║'));
console.log(chalk.blueBright('╚════════════════════════════════════════╝\n'));

console.log(chalk.cyan('This project includes:\n'));
console.log(chalk.white('  ✓ Interactive CLI with file picker support'));
console.log(chalk.white('  ✓ Automatic NestJS project validation'));
console.log(chalk.white('  ✓ Endpoint extraction in JSON format'));
console.log(chalk.white('  ✓ Multi-platform support (Windows, macOS, Linux)\n'));

console.log(chalk.yellow('To start:\n'));
console.log(chalk.greenBright('  npm start\n'));

console.log(chalk.gray('The program will ask you to select your NestJS project folder,'));
console.log(chalk.gray('validate that it is a valid project, and generate the endpoints.json file.\n'));
