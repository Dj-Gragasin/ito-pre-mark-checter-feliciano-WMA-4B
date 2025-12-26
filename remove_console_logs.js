#!/usr/bin/env node

/**
 * Remove console.log, console.error, and console.warn statements from TypeScript files.
 *
 * Features:
 * - Safely removes console statements while preserving code structure
 * - Handles multi-line console statements
 * - Creates backup before modifying
 * - Reports number of statements removed
 * - Validates file existence before processing
 *
 * Usage: node remove_console_logs.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createBackup(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    fs.writeFileSync(backupPath, content, 'utf-8');
    return backupPath;
  } catch (err) {
    throw new Error(`Failed to create backup: ${err.message}`);
  }
}

/**
 * Remove console statements from content.
 * Handles single-line and multi-line statements.
 */
function removeConsoleStatements(content) {
  const lines = content.split('\n');
  const result = [];
  let removedCount = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if line contains a console statement at the beginning (with optional whitespace)
    const consoleMatch = line.match(/^\s*(console\.(log|error|warn)\s*\()/);

    if (consoleMatch) {
      // This line starts with a console statement
      const leadingWhitespace = line.match(/^\s*/)[0];
      const statementStart = leadingWhitespace.length;

      // Find where this console statement ends
      let currentIndex = statementStart;
      let parenCount = 0;
      let foundOpening = false;
      let endLineIndex = i;

      // Process current line and subsequent lines to find the end
      for (let lineIdx = i; lineIdx < lines.length; lineIdx++) {
        const currentLine = lineIdx === i ? line : lines[lineIdx];
        const startIdx = lineIdx === i ? currentIndex : 0;

        for (let charIdx = startIdx; charIdx < currentLine.length; charIdx++) {
          const char = currentLine[charIdx];

          if (char === '(' && !foundOpening) {
            foundOpening = true;
            parenCount = 1;
          } else if (foundOpening) {
            // Inside string literals, skip quotes
            if (char === '"' || char === "'" || char === '`') {
              const quoteChar = char;
              charIdx++;
              while (charIdx < currentLine.length) {
                if (currentLine[charIdx] === '\\') {
                  charIdx += 2; // Skip escaped character
                } else if (currentLine[charIdx] === quoteChar) {
                  break;
                } else {
                  charIdx++;
                }
              }
            } else if (char === '(') {
              parenCount++;
            } else if (char === ')') {
              parenCount--;
              if (parenCount === 0) {
                endLineIndex = lineIdx;
                break;
              }
            }
          }
        }

        if (parenCount === 0) {
          break;
        }
      }

      // Remove the console statement(s)
      if (parenCount === 0) {
        removedCount++;
        i = endLineIndex + 1;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return {
    content: result.join('\n'),
    removedCount,
  };
}

function main() {
  log('\n════════════════════════════════════════════════════════════════════════', 'cyan');
  log('🧹 Console Statement Remover for TypeScript Files', 'cyan');
  log('════════════════════════════════════════════════════════════════════════', 'cyan');

  const targetFile = path.normalize(
    'c:\\xampp\\htdocs\\cpionic\\activecore-db\\src\\index.ts'
  );

  log(`\n📁 Target file: ${targetFile}`);

  // Validate file exists
  if (!fs.existsSync(targetFile)) {
    log(`\n❌ ERROR: File not found: ${targetFile}`, 'red');
    process.exit(1);
  }

  const stats = fs.statSync(targetFile);
  log(`📊 File size: ${stats.size.toLocaleString()} bytes`);

  // Create backup
  log('\n🔒 Creating backup...', 'yellow');
  let backupPath;
  try {
    backupPath = createBackup(targetFile);
    log(`✅ Backup created: ${backupPath}`, 'green');
  } catch (err) {
    log(`\n❌ ERROR: ${err.message}`, 'red');
    process.exit(1);
  }

  // Read file
  log('\n🔍 Scanning for console statements...', 'yellow');
  let originalContent;
  try {
    originalContent = fs.readFileSync(targetFile, 'utf-8');
  } catch (err) {
    log(`\n❌ ERROR reading file: ${err.message}`, 'red');
    process.exit(1);
  }

  // Remove console statements
  const { content: cleanedContent, removedCount } = removeConsoleStatements(originalContent);

  log(`✅ Found and removed ${removedCount} console statement(s)`, 'green');

  // Calculate statistics
  const originalLines = originalContent.split('\n').length;
  const cleanedLines = cleanedContent.split('\n').length;
  const linesRemoved = originalLines - cleanedLines;

  log(`📝 Original lines: ${originalLines.toLocaleString()}`);
  log(`📝 Cleaned lines: ${cleanedLines.toLocaleString()}`);
  log(`📝 Lines removed: ${linesRemoved.toLocaleString()}`);

  // Write cleaned content
  log('\n💾 Writing cleaned file...', 'yellow');
  try {
    fs.writeFileSync(targetFile, cleanedContent, 'utf-8');
    log(`✅ File updated successfully`, 'green');
  } catch (err) {
    log(`\n❌ ERROR writing file: ${err.message}`, 'red');
    log(`⚠️  Restoring from backup: ${backupPath}`, 'yellow');
    try {
      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      fs.writeFileSync(targetFile, backupContent, 'utf-8');
      log('✅ File restored from backup', 'green');
    } catch (restoreErr) {
      log(`❌ Failed to restore: ${restoreErr.message}`, 'red');
    }
    process.exit(1);
  }

  // Summary
  log('\n════════════════════════════════════════════════════════════════════════', 'cyan');
  log('📋 SUMMARY', 'cyan');
  log('════════════════════════════════════════════════════════════════════════', 'cyan');
  log(`✅ Console statements removed: ${removedCount}`, 'green');
  log(`✅ File updated: ${targetFile}`, 'green');
  log(`✅ Backup saved: ${backupPath}`, 'green');
  log(`\nTo restore original file:`, 'yellow');
  log(`  copy "${backupPath}" "${targetFile}"`);
  log('════════════════════════════════════════════════════════════════════════\n', 'cyan');
}

main();
