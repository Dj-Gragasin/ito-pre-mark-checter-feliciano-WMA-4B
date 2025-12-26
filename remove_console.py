#!/usr/bin/env python3
import re
import os
from pathlib import Path

def remove_console_statements(file_path):
    """Remove console.log/error/warn statements from a file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_length = len(content)
    count_before = len(re.findall(r'console\.(log|error|warn)\(', content))
    
    # Pattern 1: Full line console statements
    content = re.sub(r'^\s*console\.(log|error|warn)\([^)]*\);?\s*\n', '', content, flags=re.MULTILINE)
    
    # Pattern 2: Console statements with complex multi-line content
    # Match: console.log(` ... `) or console.log('...' + var) 
    content = re.sub(r'console\.(log|error|warn)\([^;]*\);', '', content)
    
    # Clean up multiple empty lines
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    count_after = len(re.findall(r'console\.(log|error|warn)\(', content))
    removed = count_before - count_after
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return removed, count_before

# Target files
backend_file = r'c:\xampp\htdocs\cpionic\activecore-db\src\index.ts'

print(f"Cleaning {backend_file}...")
removed, before = remove_console_statements(backend_file)
print(f"✅ Removed {removed} console statements from backend (had {before} total)")

# Also clean frontend pages
frontend_pages = [
    r'c:\xampp\htdocs\cpionic\src\pages\QrAttendance.tsx',
    r'c:\xampp\htdocs\cpionic\src\pages\PaymentSuccess.tsx',
    r'c:\xampp\htdocs\cpionic\src\pages\Payment.tsx',
    r'c:\xampp\htdocs\cpionic\src\pages\MealPlanner.tsx',
    r'c:\xampp\htdocs\cpionic\src\pages\AdminDashboard.tsx',
    r'c:\xampp\htdocs\cpionic\src\pages\MembersManagement.tsx',
    r'c:\xampp\htdocs\cpionic\src\pages\ProgressTracker.tsx',
]

total_removed = removed
for page in frontend_pages:
    if os.path.exists(page):
        removed, before = remove_console_statements(page)
        print(f"✅ {Path(page).name}: removed {removed} console statements")
        total_removed += removed
    else:
        print(f"⚠️  {Path(page).name}: file not found")

print(f"\n🎉 Total: {total_removed} console statements removed!")
