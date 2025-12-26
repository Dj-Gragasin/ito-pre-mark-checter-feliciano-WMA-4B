# Backend Security Audit Report
**ActiveCore Gym Management System - Node.js + Express + TypeScript Backend**

**Date:** December 26, 2025  
**Status:** Production Readiness Assessment

---

## EXECUTIVE SUMMARY

The backend has several security and code quality issues that must be addressed before production deployment. Most issues are **LOW to MEDIUM severity**, but **JWT token expiration is CRITICAL**.

**Overall Status:** ⚠️ **NOT READY FOR PRODUCTION**

---

## CRITICAL ISSUES (Must Fix)

### 1. ❌ JWT Token Has No Expiration
**File:** `src/index.ts` (lines ~1365-1380)  
**Severity:** 🔴 **CRITICAL**

```typescript
// VULNERABLE: No expiration set!
const token = jwt.sign(
  { id, email, role },
  process.env.JWT_SECRET!
  // Missing: expiresIn: '24h'
);
```

**Risk:** Tokens never expire → compromised tokens valid forever  
**Fix:**
```typescript
const token = jwt.sign(
  { id, email, role },
  process.env.JWT_SECRET!,
  { expiresIn: '24h' }  // Add expiration
);
```

---

### 2. ❌ Missing JWT_SECRET Default Validation
**File:** `src/index.ts` (line ~15)  
**Severity:** 🔴 **CRITICAL**

```typescript
// Dangerous: Will crash if JWT_SECRET not set
const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
```

**Risk:** Non-operator will not notice missing env var during deployment  
**Fix:**
```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be set and at least 32 characters');
}
```

---

### 3. ❌ SQL Injection Vulnerability in Email Login
**File:** `src/index.ts` (line ~1160)  
**Severity:** 🔴 **CRITICAL** (Uses prepared statements - OKAY, but logging is risky)

```typescript
console.log('\n🔐 Login attempt for:', email); // Logs user input!
```

**Risk:** Email logged to console → visible in logs, could expose patterns  
**Fix:** Never log PII. Log only: `console.log('Login attempt for: [REDACTED]');`

---

## HIGH SEVERITY ISSUES

### 4. ❌ Bcrypt Salt Rounds May Be Too Low
**File:** `src/index.ts` (line ~1240)  
**Severity:** 🟠 **HIGH**

Current code doesn't show explicit salt rounds. Verify:

```typescript
// Should be at LEAST 10, better 12+
const hashedPassword = await bcrypt.hash(password, 12);
```

**Fix:** Ensure salt rounds ≥ 12

---

### 5. ❌ Console Logs Expose Sensitive Data
**File:** Multiple files  
**Severity:** 🟠 **HIGH**

**Examples:**
- `src/index.ts:168-181` - Auth header logging
- `src/index.ts:705` - Login attempt logging
- `src/index.ts:1195` - Payment details logging

```typescript
❌ console.log('🔐 Auth Header:', authHeader);
❌ console.log('Login attempt for:', email);
❌ console.log('\n💳 Processing GCash AUTO-APPROVAL payment:', { userId, ... });
```

**Risk:** PII and auth tokens visible in production logs  
**Fix:** Remove all console.log statements. Use structured logging only for errors.

---

### 6. ❌ No Input Validation on Sensitive Endpoints
**File:** `src/index.ts` (payment routes)  
**Severity:** 🟠 **HIGH**

No validation on:
- Email format validation
- Password strength requirements
- Amount boundaries
- User ID ownership checks

**Fix:** Add middleware for input validation:
```typescript
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateAmount = (amount: number) => amount > 0 && amount <= 999999;
```

---

### 7. ❌ Missing CORS Protection in Production
**File:** `src/index.ts` (lines 28-65)  
**Severity:** 🟠 **HIGH**

```typescript
// Dangerous in production!
if (process.env.NODE_ENV === 'development') {
  app.use(cors({ origin: true, credentials: true })); // ALLOWS ALL
}
```

**Risk:** CSRF attacks, unauthorized API access  
**Fix:** Strict CORS in production
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
if (!allowedOrigins.includes(origin)) {
  return res.status(403).json({ error: 'CORS blocked' });
}
```

---

### 8. ❌ No Rate Limiting
**File:** `src/index.ts`  
**Severity:** 🟠 **HIGH**

No protection against:
- Brute force login attacks
- DDoS
- Spam requests

**Fix:** Add express-rate-limit
```typescript
npm install express-rate-limit
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});
app.post('/api/auth/login', loginLimiter, ...);
```

---

### 9. ❌ No Password Requirements
**File:** `src/index.ts` (registration)  
**Severity:** 🟠 **HIGH**

Users can register with `password = "123"`

**Fix:**
```typescript
const validatePassword = (pwd: string) => {
  if (pwd.length < 8) return 'Min 8 chars';
  if (!/[A-Z]/.test(pwd)) return 'Need uppercase';
  if (!/[0-9]/.test(pwd)) return 'Need number';
  return null;
};
```

---

## MEDIUM SEVERITY ISSUES

### 10. ❌ Hardcoded Values in Code
**Files:** `src/index.ts`, frontend  
**Severity:** 🟡 **MEDIUM**

| Value | Location | Fix |
|-------|----------|-----|
| `123 Fitness Street, Barangay Rizal, Makati City` | Multiple files | Use `process.env.GYM_ADDRESS` |
| `http://localhost:3002` | Frontend | Use `process.env.REACT_APP_API_URL` |
| `gpt-4o` | Line 80 | Already using `process.env.OPENAI_MODEL` ✅ |

**Fix:** Move all config to `.env`

---

### 11. ❌ Inconsistent Error Handling
**File:** `src/index.ts`  
**Severity:** 🟡 **MEDIUM**

Mixed error responses:
```typescript
res.status(500).json({ success: false, message: 'Error' });
res.json({ success: false, message: 'Error' });  // Wrong: no status code
throw new Error('...');  // Unhandled
```

**Fix:** Central error handler
```typescript
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});
```

---

### 12. ❌ Missing OpenAI Error Handling
**File:** `src/index.ts` (line ~521)  
**Severity:** 🟡 **MEDIUM**

```typescript
if (err.status === 401) {
  console.warn('OpenAI unauthorized: check OPENAI_API_KEY (rotate key).');
  // Continues execution - should fail gracefully
}
```

**Fix:** Return proper error response
```typescript
if (!openai || err.status === 401) {
  return res.status(503).json({
    success: false,
    message: 'AI service temporarily unavailable'
  });
}
```

---

### 13. ❌ SQL Query Performance Issues
**File:** `src/index.ts` (meal planner, payment routes)  
**Severity:** 🟡 **MEDIUM**

Missing indexes on frequently queried columns:
- `users.email`
- `users.id`
- `payments.user_id`
- `payments.transaction_id`

**Fix:** Add to database initialization:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
```

---

### 14. ❌ No Database Connection Pooling Config
**File:** `src/config/db.config.ts`  
**Severity:** 🟡 **MEDIUM**

Connection pool limits should be configurable:
```typescript
// Current: Hard values
connectionLimit: 10,
queueLimit: 0

// Should be:
connectionLimit: process.env.DB_POOL_SIZE || 10,
queueLimit: process.env.DB_QUEUE_LIMIT || 0
```

---

### 15. ❌ PayPal Error Handling Incomplete
**File:** `src/index.ts` (lines ~2500-2600)  
**Severity:** 🟡 **MEDIUM**

Missing scenarios:
- Network timeout → assumes order exists
- Partial payment captured
- Currency mismatch

---

## LOW SEVERITY ISSUES

### 16. ⚠️ Unused Dependencies
**File:** `package.json`  
**Severity:** 🟢 **LOW**

Check if these are actually used:
- `@types/axios` - axios has built-in types now
- `paymongo` (frontend) - not used in code?

**Fix:** Run `npm prune` after review

---

### 17. ⚠️ Missing Security Headers
**File:** `src/index.ts`  
**Severity:** 🟢 **LOW**

Add helmet.js:
```typescript
npm install helmet
import helmet from 'helmet';
app.use(helmet());
```

---

### 18. ⚠️ No Request ID Tracking
**Severity:** 🟢 **LOW**

For debugging, add request IDs:
```typescript
import { v4 as uuidv4 } from 'uuid';

app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});
```

---

### 19. ⚠️ TypeScript `any` Types
**File:** `src/index.ts` (multiple)  
**Severity:** 🟢 **LOW**

Replace `any` with proper types:
```typescript
❌ (err: any)
❌ (dayObj: any)
❌ const decoded = jwt.verify(...) as any;

✅ interface LoginRequest { email: string; password: string; }
✅ const decoded: JwtPayload = jwt.verify(...);
```

---

## FILES TO DELETE

### Unused/Dev Files
- `activecore-db/scripts/deleteRecipesFrom27.js` (cleanup script, keep for now)
- Any `.test.ts` files if present
- Any `.example.ts` files if present

---

## DEPENDENCIES TO REMOVE

| Package | Reason | Action |
|---------|--------|--------|
| `@types/axios` | Unnecessary (v0.9.36 is outdated) | Remove, use axios v1.13+ built-in types |
| `paymongo` (if in backend) | Only for frontend | Remove from backend |
| Consider adding: `helmet` | Security headers | `npm install helmet` |
| Consider adding: `express-rate-limit` | DDoS protection | `npm install express-rate-limit` |
| Consider adding: `joi` | Input validation | `npm install joi` |

---

## REFACTORING RECOMMENDATIONS

### 1. Extract Routes to Separate Files
```
src/
  ├── routes/
  │   ├── auth.routes.ts
  │   ├── users.routes.ts
  │   ├── payments.routes.ts
  │   ├── meals.routes.ts
  │   └── admin.routes.ts
  ├── controllers/
  │   ├── auth.controller.ts
  │   ├── users.controller.ts
  │   ├── payments.controller.ts
  │   └── meals.controller.ts
  ├── middleware/
  │   ├── auth.middleware.ts
  │   ├── validation.middleware.ts
  │   ├── error.middleware.ts
  │   └── logging.middleware.ts
  ├── services/
  │   ├── payment.service.ts
  │   ├── user.service.ts
  │   ├── meal.service.ts
  │   └── openai.service.ts
  └── index.ts (main server file)
```

### 2. Create Shared Types
```typescript
// src/types/index.ts
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'member' | 'admin';
  password: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}
```

### 3. Create Config Handler
```typescript
// src/config/environment.ts
export const config = {
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES || '24h'
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'activecore'
  },
  gym: {
    address: process.env.GYM_ADDRESS || '123 Fitness Street',
    hours: process.env.GYM_HOURS || 'Mon-Sun, 6:00 AM - 10:00 PM'
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true
  }
};
```

---

## PRODUCTION DEPLOYMENT CHECKLIST

- [ ] **JWT Tokens** - Add 24h expiration (`expiresIn: '24h'`)
- [ ] **JWT Secret** - Verify ≥32 chars, unique per environment
- [ ] **Bcrypt** - Confirm salt rounds ≥ 12
- [ ] **Console Logs** - Remove all except errors (no PII)
- [ ] **Rate Limiting** - Install & configure `express-rate-limit`
- [ ] **Input Validation** - Add email, password, amount validation
- [ ] **CORS** - Set strict `ALLOWED_ORIGINS` for production
- [ ] **Environment Variables** - All required vars documented
- [ ] **Database Indexes** - Create indexes on frequently queried columns
- [ ] **Error Handling** - Central error middleware in place
- [ ] **Security Headers** - Install & use `helmet`
- [ ] **Password Requirements** - Enforce min 8 chars, uppercase, number
- [ ] **OpenAI Fallback** - Graceful degradation if API unavailable
- [ ] **PayPal Testing** - Verify all edge cases (timeout, invalid order, etc.)
- [ ] **Database Backups** - Automated backup strategy documented
- [ ] **Logging** - Structured logging (no PII), log rotation enabled
- [ ] **Monitoring** - Set up error tracking (Sentry, DataDog, etc.)
- [ ] **API Documentation** - Swagger/OpenAPI docs generated
- [ ] **Performance** - Load test with 100+ concurrent users
- [ ] **SSL/TLS** - HTTPS enforced, certificate auto-renewal configured

---

## ESTIMATED EFFORT

| Task | Hours | Priority |
|------|-------|----------|
| JWT expiration + secret validation | 1 | 🔴 CRITICAL |
| Remove console logs | 2 | 🟠 HIGH |
| Add input validation | 3 | 🟠 HIGH |
| Rate limiting setup | 2 | 🟠 HIGH |
| CORS hardening | 1 | 🟠 HIGH |
| Routes refactoring | 8 | 🟡 MEDIUM |
| Error handling middleware | 2 | 🟡 MEDIUM |
| Database indexes | 1 | 🟡 MEDIUM |
| Password requirements | 1 | 🟠 HIGH |
| Tests & verification | 4 | 🟡 MEDIUM |
| **TOTAL** | **25 hours** | |

---

## NEXT STEPS

1. **Immediately (Today):** Fix JWT expiration and bcrypt configuration
2. **This Week:** Remove console logs, add rate limiting, harden CORS
3. **Next Week:** Refactor routes/controllers, add input validation
4. **Before Production:** Full security audit, penetration testing, load testing

---

## SECURITY BEST PRACTICES SUMMARY

✅ Use HTTPS/TLS everywhere  
✅ Never log PII (email, phone, tokens, passwords)  
✅ Always validate + sanitize input  
✅ Use environment variables for all secrets  
✅ Implement rate limiting on auth endpoints  
✅ Use bcrypt with ≥12 salt rounds  
✅ Tokens must expire (max 24h)  
✅ CORS must be strict in production  
✅ Database queries must use prepared statements (already doing this)  
✅ Add security headers (helmet)  
✅ Monitor & log all errors  
✅ Regular dependency updates  

---

**Report Generated:** December 26, 2025  
**Reviewed By:** Security Audit Framework  
**Next Audit:** After all CRITICAL/HIGH fixes applied
