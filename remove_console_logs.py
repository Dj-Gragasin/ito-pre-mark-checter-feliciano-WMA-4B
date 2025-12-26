#!/usr/bin/env python3
"""
Remove console.log, console.error, and console.warn statements from TypeScript files.

Production-ready script with:
- Safe file handling (backup before modify)
- Multi-line console statement support
- Detailed reporting
- Error recovery

Usage:
    python3 remove_console_logs.py
    python3 remove_console_logs.py --aggressive
"""

import re
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Tuple


class ConsoleRemover:
    """Safe console statement remover for TypeScript files."""

    def __init__(self, file_path: str, aggressive: bool = False):
        self.file_path = file_path
        self.aggressive = aggressive
        self.removed_count = 0
        self.backup_path = None

    def create_backup(self) -> str:
        """Create a timestamped backup of the original file."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = f"{self.file_path}.backup.{timestamp}"
        
        try:
            with open(self.file_path, 'r', encoding='utf-8') as src:
                content = src.read()
            with open(backup_path, 'w', encoding='utf-8') as dst:
                dst.write(content)
            self.backup_path = backup_path
            return backup_path
        except Exception as e:
            raise Exception(f"Failed to create backup: {e}")

    def read_file(self) -> str:
        """Read file content safely."""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found: {self.file_path}")
        except Exception as e:
            raise Exception(f"Error reading file: {e}")

    def write_file(self, content: str) -> None:
        """Write content to file safely."""
        try:
            with open(self.file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        except Exception as e:
            raise Exception(f"Error writing file: {e}")

    def restore_backup(self) -> None:
        """Restore file from backup."""
        if not self.backup_path or not os.path.exists(self.backup_path):
            return
        
        try:
            with open(self.backup_path, 'r', encoding='utf-8') as src:
                content = src.read()
            self.write_file(content)
        except Exception as e:
            print(f"⚠️  Failed to restore backup: {e}")

    def remove_console_standard(self, content: str) -> str:
        """
        Remove standalone console statements (standard mode).
        Preserves inline console calls.
        """
        lines = content.split('\n')
        result_lines = []
        i = 0

        while i < len(lines):
            line = lines[i]
            
            # Check if line starts with console statement
            if re.match(r'^\s*(console\.(log|error|warn)\s*\()', line):
                # Count parentheses to find statement end
                paren_count = 0
                found_open = False
                end_line_idx = i

                for j in range(i, len(lines)):
                    current_line = lines[j]
                    
                    for k, char in enumerate(current_line):
                        # Skip string contents
                        if char in ('"', "'", '`'):
                            quote_char = char
                            k += 1
                            while k < len(current_line):
                                if current_line[k] == '\\':
                                    k += 2
                                elif current_line[k] == quote_char:
                                    break
                                else:
                                    k += 1
                            continue

                        if char == '(' and not found_open:
                            found_open = True
                            paren_count = 1
                        elif found_open:
                            if char == '(':
                                paren_count += 1
                            elif char == ')':
                                paren_count -= 1
                                if paren_count == 0:
                                    end_line_idx = j
                                    break

                    if found_open and paren_count == 0:
                        break

                # If we found complete statement, remove it
                if found_open and paren_count == 0:
                    self.removed_count += 1
                    i = end_line_idx + 1
                    continue

            result_lines.append(line)
            i += 1

        return '\n'.join(result_lines)

    def remove_console_aggressive(self, content: str) -> str:
        """
        Remove all console statements including inline ones (aggressive mode).
        """
        # First pass: remove standalone lines
        result = self.remove_console_standard(content)
        
        # Second pass: remove inline console calls
        # Pattern: console.(log|error|warn)(...) with simple content
        pattern = r'console\.(log|error|warn)\s*\([^)]*\)'
        matches = re.finditer(pattern, result)
        
        # Count matches
        for _ in matches:
            self.removed_count += 1
        
        # Replace all matches
        result = re.sub(pattern, '', result)
        
        # Clean up any dangling operators or arrows
        # E.g., ".catch(() => )" becomes ".catch(() => {})"
        result = re.sub(r'\.catch\s*\(\s*\(\s*\)\s*=>\s*\)', '.catch(() => {})', result)
        
        return result

    def process(self) -> Tuple[int, int, int]:
        """
        Process the file and return (removed_count, original_lines, cleaned_lines)
        """
        # Validate file exists
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"File not found: {self.file_path}")

        # Create backup
        self.create_backup()

        # Read original content
        original_content = self.read_file()
        original_lines = len(original_content.split('\n'))

        # Remove console statements
        if self.aggressive:
            cleaned_content = self.remove_console_aggressive(original_content)
        else:
            cleaned_content = self.remove_console_standard(original_content)

        cleaned_lines = len(cleaned_content.split('\n'))

        # Write cleaned content
        try:
            self.write_file(cleaned_content)
        except Exception as e:
            print(f"❌ Error writing file: {e}")
            print(f"⚠️  Restoring from backup...")
            self.restore_backup()
            raise

        return self.removed_count, original_lines, cleaned_lines


def print_header(title: str, mode: str = "standard"):
    """Print formatted header."""
    print(f"\n{'=' * 70}")
    print(f"🧹 {title}")
    if mode == "aggressive":
        print("⚡ AGGRESSIVE MODE - Removes ALL console statements")
    print(f"{'=' * 70}")


def print_summary(file_path: str, removed: int, backup_path: str, 
                  original_lines: int, cleaned_lines: int):
    """Print summary of operation."""
    print(f"\n{'=' * 70}")
    print("📋 SUMMARY")
    print(f"{'=' * 70}")
    print(f"✅ Console statements removed: {removed}")
    print(f"✅ File updated: {file_path}")
    print(f"✅ Backup saved: {backup_path}")
    print(f"\n📝 Original lines: {original_lines:,}")
    print(f"📝 Cleaned lines: {cleaned_lines:,}")
    print(f"📝 Lines removed: {original_lines - cleaned_lines:,}")
    print(f"\nTo restore original file:")
    print(f'  copy "{backup_path}" "{file_path}"')
    print(f"{'=' * 70}\n")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Remove console statements from TypeScript files'
    )
    parser.add_argument(
        '--file',
        default=r'c:\xampp\htdocs\cpionic\activecore-db\src\index.ts',
        help='Target TypeScript file'
    )
    parser.add_argument(
        '--aggressive',
        action='store_true',
        help='Remove ALL console statements including inline ones'
    )
    
    args = parser.parse_args()
    target_file = args.file
    
    title = "Console Statement Remover (Aggressive Mode)" if args.aggressive else "Console Statement Remover"
    print_header(title, "aggressive" if args.aggressive else "standard")
    
    print(f"\n📁 Target file: {target_file}")
    
    if os.path.exists(target_file):
        file_size = os.path.getsize(target_file)
        print(f"📊 File size: {file_size:,} bytes")
    
    # Process file
    print(f"\n🔒 Creating backup...")
    
    try:
        remover = ConsoleRemover(target_file, aggressive=args.aggressive)
        
        print(f"🔍 Scanning for console statements...")
        removed_count, original_lines, cleaned_lines = remover.process()
        
        print(f"✅ Found and removed {removed_count} console statement(s)")
        
        print(f"\n💾 File updated successfully")
        
        print_summary(
            target_file,
            removed_count,
            remover.backup_path,
            original_lines,
            cleaned_lines
        )
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
