const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Logging Configuration
const LOG_DIR = path.join(__dirname, '../../build/logs');
const DEBUG_LOG = path.join(LOG_DIR, 'tag_debug.log');
const HISTORY_LOG = path.join(LOG_DIR, 'tag_history.log');
const ERROR_LOG = path.join(LOG_DIR, 'tag_error.log');
const ENV_FILE = path.join(__dirname, '../../build/.env');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize log files
function initLogs() {
  // Clear debug log on each run
  fs.writeFileSync(DEBUG_LOG, '');
  // Initialize other logs if they don't exist
  if (!fs.existsSync(HISTORY_LOG)) fs.writeFileSync(HISTORY_LOG, '');
  if (!fs.existsSync(ERROR_LOG)) fs.writeFileSync(ERROR_LOG, '');
}

function debugLog(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  fs.appendFileSync(DEBUG_LOG, `[DEBUG ${timestamp}] ${message}\n`);
}

function historyLog(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  fs.appendFileSync(HISTORY_LOG, `${timestamp} - ${message}\n`);
}

function errorLog(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  fs.appendFileSync(ERROR_LOG, `[ERROR ${timestamp}] ${message}\n`);
}

function getTagVersion() {
  try {
    debugLog('Reading TAG_VERSION from .env file');
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const match = envContent.match(/TAG_VERSION=([^\n]+)/);
    
    if (!match) {
      const msg = 'TAG_VERSION not found in .env file';
      errorLog(msg);
      throw new Error(msg);
    }
    
    debugLog(`Found TAG_VERSION: ${match[1]}`);
    return match[1];
  } catch (error) {
    errorLog(`Error reading TAG_VERSION: ${error.message}`);
    throw error;
  }
}

function tagExists(tagName) {
  try {
    debugLog(`Checking if tag exists: ${tagName}`);
    execSync(`git rev-parse ${tagName}`, { stdio: 'pipe' });
    debugLog(`Tag ${tagName} already exists`);
    return true;
  } catch (error) {
    debugLog(`Tag ${tagName} does not exist`);
    return false;
  }
}

function createAndPushTag() {
  initLogs();
  debugLog('Starting tag creation process');

  try {
    const baseTagVersion = getTagVersion();
    let tagName = `v${baseTagVersion}`;
    let counter = 0;
    let success = false;
    const maxAttempts = 100;

    debugLog(`Base tag name: ${tagName}`);
    debugLog(`Maximum attempts: ${maxAttempts}`);

    while (!success && counter < maxAttempts) {
      const currentTag = counter === 0 ? tagName : `${tagName}-${counter}`;
      debugLog(`Attempting with tag: ${currentTag}`);

      if (tagExists(currentTag)) {
        debugLog(`Tag ${currentTag} exists, incrementing counter`);
        counter++;
        continue;
      }

      try {
        // Create annotated tag
        debugLog(`Creating annotated tag: ${currentTag}`);
        execSync(`git tag -a ${currentTag} -m "${currentTag}"`, { stdio: 'inherit' });
        
        // Push the tag
        debugLog(`Pushing tag to remote: ${currentTag}`);
        execSync(`git push origin ${currentTag}`, { stdio: 'inherit' });
        
        // Log success
        const successMsg = `Successfully created and pushed tag: ${currentTag}`;
        debugLog(successMsg);
        historyLog(successMsg);
        console.log(successMsg);
        
        success = true;
        return currentTag;
      } catch (error) {
        const errorMsg = `Error processing tag ${currentTag}: ${error.message}`;
        errorLog(errorMsg);
        debugLog(errorMsg);
        counter++;
      }
    }

    if (!success) {
      const errorMsg = `Failed to create tag after ${maxAttempts} attempts`;
      errorLog(errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    errorLog(`Fatal error in tag creation: ${error.message}`);
    debugLog(`Process failed: ${error.message}`);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Add this to your package.json scripts:
// "deploy": "node path/to/this/script.js"
if (require.main === module) {
  createAndPushTag();
}

module.exports = { createAndPushTag };