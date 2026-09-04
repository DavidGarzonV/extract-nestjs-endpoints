/**
 * CLI handler to get the project path
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');

/**
 * Opens the system file picker (if possible)
 * @returns {Promise<string|null>} Selected path or null if unable to open
 */
async function tryOpenFilePicker() {
  const platform = process.platform;

  try {
    let selectedPath = null;

    if (platform === 'win32') {
      // On Windows, use PowerShell to open a dialog
      try {
        const script = `
          [System.Reflection.Assembly]::LoadWithPartialName("System.windows.forms") | Out-Null
          $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
          $dialog.Description = "Select your NestJS project folder"
          if ($dialog.ShowDialog() -eq "OK") {
            Write-Host $dialog.SelectedPath
          }
        `;
        const result = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();

        if (result && result !== 'Cancel' && fs.existsSync(result)) {
          selectedPath = result;
        }
      } catch (err) {
        // If PowerShell fails, continue with manual input
      }
    } else if (platform === 'darwin') {
      // On macOS, use osascript
      try {
        const result = execSync(
          `osascript -e 'POSIX path of (choose folder with prompt "Select your NestJS project folder")'`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
        ).trim();

        if (result && fs.existsSync(result)) {
          selectedPath = result;
        }
      } catch (err) {
        // If it fails, continue with manual input
      }
    } else if (platform === 'linux') {
      // On Linux, try zenity or kdialog
      try {
        const result = execSync('zenity --file-selection --directory --title="Select your NestJS project folder"', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();

        if (result && fs.existsSync(result)) {
          selectedPath = result;
        }
      } catch (err) {
        // Try kdialog
        try {
          const result = execSync(
            'kdialog --getexistingdirectory --title "Select your NestJS project folder"',
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
          ).trim();

          if (result && fs.existsSync(result)) {
            selectedPath = result;
          }
        } catch (err) {
          // If both fail, continue with manual input
        }
      }
    }

    return selectedPath;
  } catch (error) {
    return null;
  }
}

/**
 * Gets the project path from the user
 * Attempts to open the file picker, if it fails asks to paste the path
 */
async function getProjectPath() {
  console.log(chalk.cyan('\n🔍 Looking for NestJS project path...\n'));

  // Try to open the file picker
  const selectedPath = await tryOpenFilePicker();

  if (selectedPath) {
    console.log(chalk.green(`✓ Selected path: ${selectedPath}\n`));
    return selectedPath;
  }

  // If the file picker couldn't be opened, ask to paste the path
  console.log(chalk.yellow('Unable to open the system file picker.\n'));

  const { projectPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectPath',
      message: 'Enter the NestJS project path:',
      default: process.cwd(),
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Path cannot be empty';
        }
        if (!fs.existsSync(input)) {
          return 'Path does not exist';
        }
        return true;
      },
    },
  ]);

  return projectPath;
}

module.exports = {
  getProjectPath,
};
