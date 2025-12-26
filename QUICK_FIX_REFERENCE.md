# ⚡ QUICK REFERENCE - Critical Fixes

## 🔴 DO THIS FIRST (30 minutes)

### Fix 1: JWT Expiration
```bash
# Find all jwt.sign() calls:
grep -n "jwt.sign" activecore-db/src/index.ts
```

**Add to EVERY jwt.sign():**
```typescript
{ expiresIn: '24h' }
```

### Fix 2: JWT_SECRET Validation
**Add at top of src/index.ts, after imports:**
```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and ≥32 chars');
  process.exit(1);
}
```

### Fix 3: Remove Console Logs with PII
```bash
# Find them:
grep -n "console\." activecore-db/src/index.ts | grep -i "email\|token\|password"

# Delete lines that contain:
console.log('🔐 Auth Header')
console.log('🎫 Token')
console.log('Login attempt for', email)
console.log('GCash... payment')
```

**Keep safe logs:**
```typescript
✅ console.error('Database error:', err.code)
✅ console.log('✅ Database connected')
```

---

## 🟠 DO THIS THIS WEEK (12 hours)

### Fix 4: Input Validation
**Add before handling each request:**
```typescript
// Email validation
const email = req.body.email?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return res.status(400).json({ success: false, message: 'Invalid email' });
}

// Password validation (8 chars, uppercase, number, lowercase)
const pwd = req.body.password;
if (!pwd || pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[a-z]/.test(pwd)) {
  return res.status(400).json({ success: false, message: 'Weak password' });
}

// Amount validation
const amount = Number(req.body.amount);
if (isNaN(amount) || amount <= 0 || amount > 999999) {
  return res.status(400).json({ success: false, message: 'Invalid amount' });
}
```

### Fix 5: Install Rate Limiting
```bash
npm install express-rate-limit
```

**Add to src/index.ts:**
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts'
});

// On login endpoint:
app.post('/api/auth/login', loginLimiter, handleLogin);
```

### Fix 6: CORS Hardening
**Replace this:**
```typescript
❌ app.use(cors({ origin: true, credentials: true }));
```

**With this:**
```typescript
✅ const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true
};
app.use(cors(corsOptions));
```

**Add to .env:**
```
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### Fix 7: Central Error Handler
**Add before app.listen():**
```typescript
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Error' : err.message
  });
});
```

### Fix 8: Password Requirements
**When registering or changing password:**
```typescript
const validatePassword = (pwd: string) => {
  if (!pwd || pwd.length < 8) return 'Min 8 chars';
  if (!/[A-Z]/.test(pwd)) return 'Need uppercase';
  if (!/[a-z]/.test(pwd)) return 'Need lowercase';
  if (!/[0-9]/.test(pwd)) return 'Need number';
  return null;
};

const error = validatePassword(password);
if (error) return res.status(400).json({ success: false, message: error });
```

---

## 🟡 BEFORE PRODUCTION (1 day)

### Fix 9: Database Indexes
**Run in MySQL:**
```sql
-- Copy the SQL from:
-- src/database/indexes_and_views.sql

-- Then run:
mysql -u root -p activecore < src/database/indexes_and_views.sql
```

### Fix 10: Environment Variables
**Create real .env (don't use .env.example):**
```bash
cp activecore-db/.env.example activecore-db/.env
# Edit .env with real values
```

**Required values:**
```
JWT_SECRET=<generate-random-32-char-string>
DB_PASSWORD=<your-mysql-password>
ALLOWED_ORIGINS=https://yourdomain.com
```

### Fix 11: Test All Fixes
```bash
# Run verification script:
bash verify_security_fixes.sh
```

---

## 🧪 QUICK TESTING

**Test JWT Expiration:**
1. Login → get token
2. Wait 25 hours
3. Try to use token → should fail with "Token has expired"

**Test Rate Limiting:**
1. Try to login 6 times with wrong password
2. 6th attempt should fail with "Too many attempts"

**Test Input Validation:**
1. Try to register with password "123" → should fail
2. Try to register with invalid email → should fail
3. Try to submit negative payment amount → should fail

**Test CORS:**
1. Open browser DevTools
2. Try API call from different domain
3. Should be blocked (403 error)

---

## 📋 VERIFICATION CHECKLIST

After each fix, verify:

- [ ] JWT_SECRET validation at startup
- [ ] JWT tokens expire after 24h
- [ ] Console logs have NO email/token/password
- [ ] Input validation on login endpoint
- [ ] Input validation on registration endpoint
- [ ] Input validation on payment endpoints
- [ ] Rate limiter installed and active
- [ ] CORS rejects wrong origins
- [ ] Error handler returns safe messages
- [ ] Password requires 8 chars, upper, lower, number
- [ ] .env has all required variables
- [ ] .env not committed to git (add to .gitignore)
- [ ] Database indexes created
- [ ] No TypeScript errors: `npm run build`

---

## ⚠️ SECURITY REMINDERS

**DO:**
✅ Use HTTPS/TLS in production  
✅ Never log PII (email, phone, tokens, passwords)  
✅ Always validate input  
✅ Use environment variables for secrets  
✅ Hash passwords with bcrypt (10-14 rounds)  
✅ Rotate secrets regularly  
✅ Monitor error logs for attacks  

**DON'T:**
❌ Hardcode secrets in code  
❌ Log sensitive data  
❌ Trust user input  
❌ Use weak random generators  
❌ Disable CORS in production  
❌ Reuse tokens across users  
❌ Keep old secrets in code comments  

---

## 📞 WHERE TO FIND HELP

- **Full Details:** `COMPLETE_SECURITY_AUDIT_REPORT.md`
- **Action Plan:** `BACKEND_AUDIT_ACTION_PLAN.md`
- **Code Templates:** `SECURITY_FIXES.ts`
- **SQL Scripts:** `src/database/indexes_and_views.sql`
- **Env Template:** `.env.example`

---

## ✨ ESTIMATED TIME

**Critical Fixes:** 1 hour  
**High Priority:** 12 hours  
**Testing:** 4 hours  

**Total:** ~17 hours = 2.5 days of work

---

**Start with Fix 1 now! ⚡**
