/**
 * Security Fixes - Apply These IMMEDIATELY Before Production
 * 
 * CRITICAL ISSUES TO FIX:
 * 1. JWT Token Expiration
 * 2. Console.log removal
 * 3. Input validation
 * 4. Rate limiting
 * 5. CORS hardening
 */

// ============================================
// FIX #1: JWT Configuration with Expiration
// ============================================
// Location: src/index.ts - Find all jwt.sign() calls

// BEFORE (Vulnerable):
// const token = jwt.sign({ id, email, role }, process.env.JWT_SECRET!);

// AFTER (Secure):
const generateToken = (userId: number, email: string, role: string) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET not configured or too short');
  }
  return jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // ← ADD THIS LINE
  );
};

// ============================================
// FIX #2: Bcrypt Salt Rounds (Already OK, but verify)
// ============================================
// When hashing passwords:
const hashedPassword = await bcrypt.hash(password, 12); // ✅ Good (10-14 is secure range)

// ============================================
// FIX #3: Remove All Console Logs with PII
// ============================================

// REMOVE THESE:
// ❌ console.log('🔐 Auth Header:', authHeader);
// ❌ console.log('🎫 Token:', token ? 'Present' : 'Missing');
// ❌ console.log('\n🔐 Login attempt for:', email);
// ❌ console.log('✅ User found:', user.email);
// ❌ console.log('💳 Processing GCash AUTO-APPROVAL payment:', {...});

// KEEP ONLY:
// ✅ console.error('Auth failed:', errorType);
// ✅ console.error('Database error:', errorCode);

// ============================================
// FIX #4: Input Validation Helper
// ============================================

export const validateInputs = {
  email: (email: string): { valid: boolean; error?: string } => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !regex.test(email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    if (email.length > 100) {
      return { valid: false, error: 'Email too long' };
    }
    return { valid: true };
  },

  password: (password: string): { valid: boolean; error?: string } => {
    if (!password || password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain number' };
    }
    if (password.length > 128) {
      return { valid: false, error: 'Password too long' };
    }
    return { valid: true };
  },

  amount: (amount: any): { valid: boolean; error?: string } => {
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      return { valid: false, error: 'Amount must be positive' };
    }
    if (num > 999999) {
      return { valid: false, error: 'Amount exceeds maximum' };
    }
    return { valid: true };
  },

  memberId: (id: any): { valid: boolean; error?: string } => {
    const num = Number(id);
    if (!Number.isInteger(num) || num < 1) {
      return { valid: false, error: 'Invalid member ID' };
    }
    return { valid: true };
  }
};

// ============================================
// FIX #5: JWT Token Verification with Expiration Check
// ============================================

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Don't log the auth header or token!
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    // Token is valid and not expired (jwt.verify checks expiration)
    req.user = decoded;
    next();
  } catch (err: any) {
    // Don't expose token verification details
    const message = err.name === 'TokenExpiredError' 
      ? 'Token has expired' 
      : 'Invalid token';
    
    return res.status(403).json({
      success: false,
      message
    });
  }
};

// ============================================
// FIX #6: Rate Limiting Middleware
// ============================================
// Install: npm install express-rate-limit

import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts. Try again in 15 minutes.',
  standardHeaders: false, // Don't return rate limit info in headers
  skip: (req: Request) => process.env.NODE_ENV === 'development' // Skip in dev
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: false
});

// Usage:
// app.post('/api/auth/login', loginLimiter, loginHandler);
// app.use('/api/', apiLimiter);

// ============================================
// FIX #7: Strict CORS Configuration
// ============================================

export const getCorsOptions = () => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',')
    .map(o => o.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: ALLOWED_ORIGINS must be configured for production');
  }

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
  };
};

// Usage:
// app.use(cors(getCorsOptions()));

// ============================================
// FIX #8: Centralized Error Handler
// ============================================

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log error with context (but no PII)
  console.error({
    timestamp: new Date().toISOString(),
    status: statusCode,
    path: req.path,
    method: req.method,
    error: isDevelopment ? err.message : 'Internal server error'
  });

  // Send response (safe message in production)
  res.status(statusCode).json({
    success: false,
    message: isDevelopment ? err.message : 'An error occurred',
    ...(isDevelopment && { stack: err.stack })
  });
};

// Usage:
// app.use(errorHandler);

// ============================================
// FIX #9: Environment Variable Validation
// ============================================

export const validateEnvironment = () => {
  const required = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  // Validate DB connection is possible
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ALLOWED_ORIGINS) {
      throw new Error('ALLOWED_ORIGINS must be set for production');
    }
  }

  console.log('✅ Environment validation passed');
};

// Usage:
// validateEnvironment(); // Call at startup

// ============================================
// FIX #10: Request ID & Structured Logging
// ============================================

export const requestIdMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  req.id = require('uuid').v4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Usage:
// app.use(requestIdMiddleware);
// Then in logs: console.error({ requestId: req.id, error: ... });

// ============================================
// FIX #11: Session Timeout Handler
// ============================================

export const sessionTimeoutMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user) {
    // Check if token will expire in next 1 minute
    const expiresIn = (req.user.exp || 0) - Math.floor(Date.now() / 1000);
    
    if (expiresIn < 60) {
      res.setHeader('X-Session-Expires-Soon', 'true');
    }
  }
  next();
};

// ============================================
// DEPLOYMENT CHECKLIST
// ============================================
/*
Before deploying to production:

1. CRITICAL FIXES:
   [ ] Add expiresIn: '24h' to all jwt.sign() calls
   [ ] Remove all console.log statements (keep only errors)
   [ ] Validate JWT_SECRET is ≥32 chars
   [ ] Verify bcrypt salt rounds are 12+

2. SECURITY:
   [ ] Install express-rate-limit
   [ ] Configure ALLOWED_ORIGINS in .env
   [ ] Set strict CORS options
   [ ] Add input validation to all endpoints
   [ ] Enforce password requirements

3. INFRASTRUCTURE:
   [ ] Enable HTTPS/TLS
   [ ] Set up error tracking (Sentry, Datadog)
   [ ] Enable database backups
   [ ] Configure database indexes
   [ ] Set up monitoring/alerting

4. TESTING:
   [ ] Test JWT expiration (wait 25 hours)
   [ ] Test rate limiting
   [ ] Load test with 100+ concurrent users
   [ ] Penetration test auth endpoints
   [ ] Test all payment flows

5. DOCUMENTATION:
   [ ] Document all environment variables
   [ ] Create runbook for incident response
   [ ] Document backup/restore procedure
   [ ] Create security incident response plan
*/
