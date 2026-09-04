#!/usr/bin/env node

/**
 * Main CLI to extract endpoints from NestJS projects
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getProjectPath } = require('./cli');
const { isValidNestJSProject } = require('./validator');
const { spawn } = require('child_process');

async function main() {
  try {
    // Banner
    console.log(chalk.blueBright('\n╔════════════════════════════════════════╗'));
    console.log(chalk.blueBright('║  🚀 NestJS Endpoints Extractor        ║'));
    console.log(chalk.blueBright('╚════════════════════════════════════════╝\n'));

    // Get project path
    const projectPath = await getProjectPath();

    // Validate that it's a valid NestJS project
    console.log(chalk.cyan('\n🔐 Validating NestJS project...'));
    const validation = isValidNestJSProject(projectPath);

    if (!validation.valid) {
      console.log(chalk.red(`\n✗ Error: ${validation.error}`));
      process.exit(1);
    }

    console.log(chalk.green(`✓ Valid project: ${validation.projectName}\n`));

    // Run the endpoint generator
    const spinner = ora(chalk.cyan('Extracting endpoints...')).start();

    // Get the project name from the folder path
    const projectName = path.basename(projectPath);

    // Save the output file in the outputs folder
    const outputDir = path.join(process.cwd(), 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.join(outputDir, `endpoints-${projectName}.json`);
    const generatorPath = path.join(__dirname, 'generate-nestjs-endpoints.js');

    // Run the generator script
    await runGenerator(generatorPath, projectPath, outputFile, spinner);

    spinner.succeed(chalk.green('Endpoints extracted successfully\n'));

    // Show result
    console.log(chalk.greenBright('\n✨ Done!\n'));
    console.log(chalk.gray('📄 Generated file:'));
    console.log(chalk.white(`   ${outputFile}\n`));

    // Verify if the file was created correctly
    if (fs.existsSync(outputFile)) {
      const endpointsData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      console.log(chalk.gray(`📊 Total endpoints extracted: ${endpointsData.length}`));
      console.log(chalk.cyan(`\nYou can use this file in your testing or documentation tools.\n`));
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * Runs the endpoint generator
 */
function runGenerator(generatorPath, projectPath, outputFile, spinner) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [generatorPath, projectPath, outputFile], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        spinner.fail(chalk.red('Error extracting endpoints'));
        reject(new Error(stderr || 'Unknown error while running the generator'));
      } else {
        resolve();
      }
    });

    child.on('error', (err) => {
      spinner.fail(chalk.red('Error running the generator'));
      reject(err);
    });
  });
}

// Run
main().catch((error) => {
  console.error(chalk.red('\n✗ Fatal error:'), error.message);
  process.exit(1);
});
