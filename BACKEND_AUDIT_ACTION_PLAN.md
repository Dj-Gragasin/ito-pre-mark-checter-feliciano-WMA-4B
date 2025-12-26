# Backend Audit Summary & Action Plan

**Project:** ActiveCore Gym Management System  
**Component:** Node.js + Express + TypeScript Backend  
**Status:** Production NOT Ready  
**Date:** December 26, 2025

---

## QUICK SUMMARY

Your backend has **2 CRITICAL issues** and **8 HIGH severity** issues that must be fixed before production.

| Severity | Count | Time to Fix |
|----------|-------|-------------|
| 🔴 CRITICAL | 2 | 1 hour |
| 🟠 HIGH | 8 | 12 hours |
| 🟡 MEDIUM | 5 | 8 hours |
| 🟢 LOW | 5 | 4 hours |
| **TOTAL** | **20** | **25 hours** |

---

## CRITICAL ISSUES (FIX TODAY)

### 1. ❌ JWT Tokens Never Expire
**Risk:** Stolen token = permanent access to account  
**File:** `src/index.ts` (all jwt.sign calls)  
**Time:** 15 minutes  

**Fix:**
```typescript
// Add to every jwt.sign() call:
jwt.sign(payload, secret, { expiresIn: '24h' })
```

**Verify:** Find all `jwt.sign` in code:
```bash
grep -n "jwt.sign" src/index.ts
```

---

### 2. ❌ JWT_SECRET Can Be Missing or Too Short
**Risk:** App crashes in production, or uses weak secret  
**File:** `src/index.ts` (startup validation)  
**Time:** 10 minutes  

**Fix:** Add validation at startup:
```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be set and ≥32 chars');
}
```

---

## HIGH PRIORITY ISSUES (FIX THIS WEEK)

### 1. Remove Console Logs with PII
**Time:** 2 hours  
**Search for:**
```bash
grep -n "console.log\|console.error\|console.warn" src/index.ts | grep -E "email|token|password|user|Auth|Login|payment|GCash"
```

**Remove lines with:**
- `console.log('🔐 Auth Header')`
- `console.log('Login attempt for:', email)`
- `console.log('Token:', token...)`
- `console.log('💳 Processing ... payment')`

**Keep only:**
- Error logging: `console.error('Database error:', err.code)`
- Database status: `console.log('✅ Database connected')`

---

### 2. Add Input Validation
**Time:** 3 hours  
**Add to every endpoint:**

```typescript
// Validate email
const email = req.body.email?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return res.status(400).json({ success: false, message: 'Invalid email' });
}

// Validate password (min 8 chars, needs uppercase, number)
const pwd = req.body.password;
if (!pwd || pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
  return res.status(400).json({ success: false, message: 'Weak password' });
}

// Validate amount
const amount = Number(req.body.amount);
if (isNaN(amount) || amount <= 0 || amount > 999999) {
  return res.status(400).json({ success: false, message: 'Invalid amount' });
}
```

---

### 3. Add Rate Limiting
**Time:** 1 hour  
**Steps:**
1. Install: `npm install express-rate-limit`
2. Add to `src/index.ts`:
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 tries
  message: 'Too many login attempts'
});

app.post('/api/auth/login', loginLimiter, handleLogin);
```

---

### 4. Harden CORS
**Time:** 1 hour  
**Action:** Replace allow-all CORS:

```typescript
// BEFORE (DANGEROUS):
app.use(cors({ origin: true, credentials: true }));

// AFTER (SECURE):
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};
app.use(cors(corsOptions));
```

**Add to .env:**
```
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

---

### 5. Add .env Validation
**Time:** 30 minutes  
**Add to `src/index.ts` startup:**

```typescript
const required = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter(k => !process.env[k]);

if (missing.length > 0 || process.env.JWT_SECRET!.length < 32) {
  throw new Error(`❌ Missing or invalid env: ${missing.join(', ')}`);
}
```

---

### 6. Enforce Password Requirements
**Time:** 1 hour  
**During registration/password change:**

```typescript
const validatePassword = (pwd: string) => {
  if (pwd.length < 8) throw new Error('Min 8 chars');
  if (!/[A-Z]/.test(pwd)) throw new Error('Need uppercase');
  if (!/[0-9]/.test(pwd)) throw new Error('Need number');
  if (!/[a-z]/.test(pwd)) throw new Error('Need lowercase');
};
```

---

### 7. Central Error Handler
**Time:** 1 hour  
**Add to `src/index.ts` (before starting server):**

```typescript
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message); // No PII
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal error' 
      : err.message
  });
});
```

---

### 8. Fix PayPal Error Handling
**Time:** 2 hours  
**Review:** `src/index.ts` ~line 2500  
**Add:**
- Timeout handling
- Invalid order handling  
- Duplicate transaction checks

---

## FILES CREATED FOR YOU

✅ **`BACKEND_SECURITY_AUDIT.md`** - Full detailed audit report  
✅ **`SECURITY_FIXES.ts`** - Code templates for all fixes  
✅ **`.env.example`** - Environment template with all variables  
✅ **`indexes_and_views.sql`** - Database performance optimization  

---

## IMMEDIATE ACTION PLAN (Do First)

**TODAY (1 hour):**
1. Add JWT expiration: `{ expiresIn: '24h' }`
2. Add JWT_SECRET validation at startup
3. Remove console.log lines with PII

**THIS WEEK (12 hours):**
1. Add input validation to all endpoints
2. Install rate limiting
3. Harden CORS configuration
4. Add .env variable validation
5. Enforce password requirements
6. Central error handler
7. Test all changes locally

**BEFORE PRODUCTION (2 days):**
1. Database indexes: Run `src/database/indexes_and_views.sql`
2. Create `.env` with real values (NOT .env.example)
3. Load test with 100+ users
4. Security penetration test
5. All payment flows tested
6. Backup/restore tested
7. Monitoring configured

---

## TESTING CHECKLIST

- [ ] JWT token expires after 24h
- [ ] Weak passwords rejected
- [ ] Login limited to 5 attempts/15min
- [ ] Invalid JSON rejected
- [ ] All enum values validated
- [ ] Database queries protected (already good)
- [ ] PayPal fails gracefully
- [ ] OpenAI API missing handled
- [ ] User can't access other user's data
- [ ] Admin endpoints require admin role
- [ ] Timestamps are UTC
- [ ] Error messages don't leak stack traces
- [ ] Rate limiter properly counts requests
- [ ] CORS properly blocks wrong origins

---

## ENVIRONMENT VARIABLES NEEDED

**Required:**
```
JWT_SECRET=xxxxx (≥32 chars, random)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=xxxxx
DB_NAME=activecore
NODE_ENV=production
ALLOWED_ORIGINS=https://domain.com
```

**Optional but Recommended:**
```
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
OPENAI_API_KEY=xxxxx
GYM_ADDRESS=xxxxx
GYM_HOURS=Mon-Sun, 6:00 AM - 10:00 PM
```

---

## DEPENDENCIES TO ADD

```bash
npm install express-rate-limit helmet joi
```

- `express-rate-limit` - Brute force protection
- `helmet` - Security headers
- `joi` - Data validation (optional)

---

## AFTER FIXES, VERIFY

Run in terminal:
```bash
# Count JWT.sign calls
grep -c "jwt.sign" src/index.ts

# Check for console.log with email/token/password
grep "console\." src/index.ts | grep -i "email\|token\|password\|user\|auth\|payment"

# Verify env validation exists
grep -c "JWT_SECRET" src/index.ts

# Count input validations
grep -c "validateInputs\|validate(" src/index.ts
```

---

## FINAL PRODUCTION CHECKLIST

- [ ] All 2 CRITICAL issues fixed ✅
- [ ] All 8 HIGH issues fixed ✅
- [ ] JWT expiration: 24h
- [ ] Console logs cleaned
- [ ] Input validation on all endpoints
- [ ] Rate limiting configured
- [ ] CORS strict
- [ ] Error handling centralized
- [ ] Database indexes created
- [ ] Password requirements enforced
- [ ] .env configured with real values
- [ ] All secrets ≥32 chars random
- [ ] HTTPS/TLS enabled
- [ ] Backups configured
- [ ] Monitoring enabled
- [ ] Load tested
- [ ] Security tested

---

## ESTIMATED PRODUCTION DATE

- **Start Fixes:** Today (Dec 26)
- **Complete Fixes:** Dec 31 (5 days, assuming 8 hours/day)
- **Testing & Verification:** Jan 2-3 (2 days)
- **Production Ready:** January 4, 2025

---

## CONTACT FOR QUESTIONS

All code templates and fixes are in:
- `SECURITY_FIXES.ts` - Copy-paste code
- `BACKEND_SECURITY_AUDIT.md` - Detailed explanations
- `.env.example` - All variables documented
- `indexes_and_views.sql` - Database optimization

---

**Next Step:** Start with the 2 CRITICAL issues (JWT fixes). Should take 30 minutes.

Good luck! 🚀
