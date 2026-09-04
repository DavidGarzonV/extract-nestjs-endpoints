/**
 * NestJS project validator
 * Verifies that the folder is a valid NestJS project
 */
const fs = require('fs');
const path = require('path');

function isValidNestJSProject(projectPath) {
  try {
    // Check that the path exists
    if (!fs.existsSync(projectPath)) {
      return { valid: false, error: 'Path does not exist' };
    }

    // Check that it is a directory
    const stats = fs.statSync(projectPath);
    if (!stats.isDirectory()) {
      return { valid: false, error: 'Path is not a directory' };
    }

    // Check that package.json exists
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return { valid: false, error: 'package.json does not exist' };
    }

    // Check that package.json is valid and contains NestJS dependencies
    let packageJson;
    try {
      const content = fs.readFileSync(packageJsonPath, 'utf8');
      packageJson = JSON.parse(content);
    } catch (err) {
      return { valid: false, error: 'package.json is not valid' };
    }

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (!deps['@nestjs/common'] && !deps['@nestjs/core']) {
      return { valid: false, error: 'Does not contain @nestjs dependencies' };
    }

    // Check that the src folder exists
    const srcPath = path.join(projectPath, 'src');
    if (!fs.existsSync(srcPath)) {
      return { valid: false, error: 'src/ folder does not exist' };
    }

    // Check that there is at least one .controller.ts file
    const hasControllers = hasControllerFiles(srcPath);
    if (!hasControllers) {
      return { valid: false, error: 'No .controller.ts files found' };
    }

    return { valid: true, projectName: packageJson.name || 'NestJS Project' };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function hasControllerFiles(dir, depth = 0) {
  if (depth > 10) return false;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        if (hasControllerFiles(path.join(dir, entry.name), depth + 1)) {
          return true;
        }
      } else if (entry.name.endsWith('.controller.ts')) {
        return true;
      }
    }
  } catch (err) {
    return false;
  }

  return false;
}

module.exports = {
  isValidNestJSProject,
};
