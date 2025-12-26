#!/bin/bash
# ============================================
# Backend Security Fixes - Verification Script
# Run this to verify all fixes are applied
# ============================================

echo "🔍 BACKEND SECURITY AUDIT - VERIFICATION SCRIPT"
echo "================================================\n"

BACKEND_PATH="activecore-db/src"
FIXES_FOUND=0
ISSUES_FOUND=0

# ==================== CRITICAL CHECKS ====================

echo "🔴 CRITICAL ISSUE CHECKS:\n"

# Check 1: JWT Expiration
echo -n "1. JWT Token Expiration... "
if grep -q "expiresIn.*24h\|expiresIn.*:.*24h" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "❌ MISSING - Add expiresIn: '24h' to jwt.sign()"
    ((ISSUES_FOUND++))
fi

# Check 2: JWT_SECRET Validation
echo -n "2. JWT_SECRET Validation... "
if grep -q "JWT_SECRET.*length.*32\|JWT_SECRET.*FATAL" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "❌ MISSING - Add validation for JWT_SECRET length"
    ((ISSUES_FOUND++))
fi

# ==================== HIGH PRIORITY CHECKS ====================

echo "\n🟠 HIGH PRIORITY ISSUE CHECKS:\n"

# Check 3: Console logs with PII
echo -n "3. Console logs with email/token... "
PII_LOGS=$(grep -c "console\\..*email\|console\\..*token\|console\\..*password\|console\\..*user\|console\\..*Auth\|console\\..*Login\|console\\..*GCash" "$BACKEND_PATH/index.ts" 2>/dev/null || echo "0")
if [ "$PII_LOGS" -eq 0 ]; then
    echo "✅ CLEAN (no PII in logs)"
    ((FIXES_FOUND++))
else
    echo "❌ FOUND $PII_LOGS instances - Remove console logs with PII"
    ((ISSUES_FOUND++))
fi

# Check 4: Input Validation
echo -n "4. Input Validation Middleware... "
if grep -q "validateInputs\|validateEmail\|validatePassword\|validateAmount" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "❌ MISSING - Add input validation"
    ((ISSUES_FOUND++))
fi

# Check 5: Rate Limiting
echo -n "5. Rate Limiting... "
if grep -q "rateLimit\|loginLimiter\|express-rate-limit" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "❌ MISSING - Install and add express-rate-limit"
    ((ISSUES_FOUND++))
fi

# Check 6: CORS Configuration
echo -n "6. CORS Hardening... "
if grep -q "ALLOWED_ORIGINS\|allowedOrigins" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "❌ MISSING - Harden CORS with ALLOWED_ORIGINS"
    ((ISSUES_FOUND++))
fi

# Check 7: Error Handler Middleware
echo -n "7. Central Error Handler... "
if grep -q "app\\.use.*errorHandler\|app\\.use.*err.*res.*next" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "❌ MISSING - Add central error handler middleware"
    ((ISSUES_FOUND++))
fi

# Check 8: Password Validation
echo -n "8. Password Requirements... "
if grep -q "validatePassword\|\\[A-Z\\]\|\\[0-9\\]\|password.*length.*8" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "❌ MISSING - Enforce password requirements (8 chars, uppercase, number)"
    ((ISSUES_FOUND++))
fi

# ==================== MEDIUM PRIORITY CHECKS ====================

echo "\n🟡 MEDIUM PRIORITY ISSUE CHECKS:\n"

# Check 9: Database Indexes
echo -n "9. Database Indexes... "
if [ -f "$BACKEND_PATH/database/indexes_and_views.sql" ]; then
    echo "✅ FOUND (indexes_and_views.sql exists)"
    ((FIXES_FOUND++))
else
    echo "⚠️  MISSING - Run indexes_and_views.sql on database"
    ((ISSUES_FOUND++))
fi

# Check 10: Environment Variables
echo -n "10. .env.example Template... "
if [ -f "activecore-db/.env.example" ]; then
    echo "✅ FOUND"
    ((FIXES_FOUND++))
else
    echo "⚠️  MISSING - .env.example not found"
    ((ISSUES_FOUND++))
fi

# Check 11: Bcrypt Salt Rounds
echo -n "11. Bcrypt Configuration... "
if grep -q "bcrypt\\.hash.*,\\s*1[2-9]\|bcrypt\\.hash.*,\\s*2[0-9]" "$BACKEND_PATH/index.ts"; then
    echo "✅ FOUND (salt rounds ≥12)"
    ((FIXES_FOUND++))
else
    echo "⚠️  UNKNOWN - Verify bcrypt salt rounds are ≥12"
    ((ISSUES_FOUND++))
fi

# ==================== SUMMARY ====================

echo "\n================================================"
echo "📊 SUMMARY:"
echo "✅ Fixes Applied: $FIXES_FOUND"
echo "❌ Issues Remaining: $ISSUES_FOUND"
echo "================================================\n"

if [ "$ISSUES_FOUND" -eq 0 ]; then
    echo "🎉 All critical and high priority fixes are in place!"
    echo "You can proceed to production testing.\n"
    exit 0
else
    echo "⚠️  Please fix the $ISSUES_FOUND remaining issues before production.\n"
    echo "Reference: BACKEND_AUDIT_ACTION_PLAN.md\n"
    exit 1
fi
