#!/usr/bin/env node

/**
 * Enhanced Console Statement Remover for TypeScript Files
 * 
 * This is an improved version that also removes console statements that are:
 * - Part of error handlers (.catch(err => console.error(...)))
 * - Inline in various expressions
 * 
 * Features:
 * - Removes all console.log, console.error, and console.warn statements
 * - Handles single-line and multi-line statements
 * - Handles inline console calls in callbacks and error handlers
 * - Creates backup before modifying
 * - Reports number of statements removed
 * - Safe operation with validation
 *
 * Usage: node remove_console_logs_aggressive.js
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
 * Aggressive approach: Remove all console.* calls, even inline ones.
 * Handles cases like: .catch(err => console.error(...))
 */
function removeAllConsoleStatements(content) {
  let removedCount = 0;

  // Pattern 1: Remove standalone console statements (entire lines)
  // Matches: console.log|error|warn with proper bracket handling
  let result = content;

  // First pass: Remove standalone lines (console at start of line with optional whitespace)
  const lines = result.split('\n');
  const processedLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('console.log(') || 
        trimmed.startsWith('console.error(') || 
        trimmed.startsWith('console.warn(')) {
      
      // Count parens to find end of statement
      let parenCount = 0;
      let foundOpen = false;
      let endLineIdx = i;

      for (let j = i; j < lines.length; j++) {
        const currentLine = j === i ? line : lines[j];
        for (let k = 0; k < currentLine.length; k++) {
          const char = currentLine[k];
          
          if ((char === '"' || char === "'" || char === '`') && foundOpen) {
            // Skip string content
            const quote = char;
            k++;
            while (k < currentLine.length) {
              if (currentLine[k] === '\\') {
                k += 2;
              } else if (currentLine[k] === quote) {
                break;
              } else {
                k++;
              }
            }
            continue;
          }

          if (char === '(' && !foundOpen) {
            foundOpen = true;
            parenCount = 1;
          } else if (foundOpen) {
            if (char === '(') parenCount++;
            if (char === ')') parenCount--;
          }

          if (foundOpen && parenCount === 0) {
            endLineIdx = j;
            break;
          }
        }
        if (foundOpen && parenCount === 0) break;
      }

      if (foundOpen && parenCount === 0) {
        removedCount++;
        i = endLineIdx + 1;
        continue;
      }
    }

    processedLines.push(line);
    i++;
  }

  result = processedLines.join('\n');

  // Second pass: Remove inline console calls
  // Pattern: console.(log|error|warn)\s*\([^)]*\)
  // This handles: .catch(err => console.error(...))
  result = result.replace(/console\.(log|error|warn)\s*\([^)]*\)/g, (match) => {
    removedCount++;
    return '';
  });

  // Clean up any leftover patterns that span multiple issues
  // Handle more complex nested parentheses
  const complexPattern = /\.catch\s*\(\s*\w+\s*=>\s*console\.(log|error|warn)\s*\([^)]*\)\s*\)/g;
  result = result.replace(complexPattern, (match) => {
    removedCount++;
    return '.catch(() => {})';
  });

  return {
    content: result,
    removedCount,
  };
}

function main() {
  log('\n════════════════════════════════════════════════════════════════════════', 'cyan');
  log('🧹 Console Statement Remover (Aggressive Mode)', 'cyan');
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
  log('\n🔍 Scanning for console statements (aggressive mode)...', 'yellow');
  let originalContent;
  try {
    originalContent = fs.readFileSync(targetFile, 'utf-8');
  } catch (err) {
    log(`\n❌ ERROR reading file: ${err.message}`, 'red');
    process.exit(1);
  }

  // Remove console statements
  const { content: cleanedContent, removedCount } = removeAllConsoleStatements(originalContent);

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
