import { Pool, QueryResult, PoolClient } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// When running via `npm --prefix`, the process CWD may be the repo root (not activecore-db/).
// Load env files relative to this package so local dev picks up activecore-db/.env reliably.
const envCandidates = [
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
];

const envPath = envCandidates.find(p => fs.existsSync(p));
if (envPath) {
  dotenv.config({ path: envPath, override: true });
} else {
  dotenv.config();
}

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const connectionString = process.env.DATABASE_URL?.trim();

type EffectiveDbInfo = {
  host: string;
  port: string;
  database: string;
  user: string;
};

const deriveEffectiveDbInfo = (): EffectiveDbInfo => {
  if (connectionString) {
    try {
      const url = new URL(connectionString);
      return {
        host: url.hostname || 'localhost',
        port: url.port || '5432',
        database: (url.pathname || '').replace(/^\//, '') || 'activecore',
        user: decodeURIComponent(url.username || '') || 'postgres',
      };
    } catch {
      // Fall back to DB_* if DATABASE_URL is malformed
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    database: process.env.DB_NAME || 'activecore',
    user: process.env.DB_USER || 'postgres',
  };
};

const effectiveDb = deriveEffectiveDbInfo();
const isLocalHost = effectiveDb.host === 'localhost' || effectiveDb.host === '127.0.0.1';
const shouldUseSSL = parseBool(process.env.DB_SSL, !isLocalHost);
// Keep old behavior for Render unless overridden.
// Supabase pooled endpoints can present chains that fail strict verification in some runtimes.
// Allow overriding via DB_SSL_REJECT_UNAUTHORIZED.
const hostLower = effectiveDb.host.toLowerCase();
const defaultRejectUnauthorized =
  hostLower.includes('render.com') || hostLower.includes('supabase.com') || hostLower.includes('supabase.co')
    ? false
    : true;
const sslRejectUnauthorized = parseBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, defaultRejectUnauthorized);

const sslCaInline = process.env.DB_SSL_CA?.trim();
const sslCaFilePath = process.env.DB_SSL_CA_FILE?.trim();
let sslCa: string | undefined;

const looksLikePemCertificate = (value: string): boolean => {
  const normalized = value.trim();
  return normalized.includes('-----BEGIN CERTIFICATE-----') && normalized.includes('-----END CERTIFICATE-----');
};

const looksLikeFilePath = (value: string): boolean => {
  const v = value.trim();
  // Windows drive path (e.g. C:\...) or unix-ish absolute path.
  if (/^[a-zA-Z]:\\/.test(v) || v.startsWith('/') || v.startsWith('\\\\')) return true;
  // Common cert file extensions.
  if (/\.(crt|pem|cer)$/i.test(v)) return true;
  return false;
};

if (sslCaInline) {
  // Allow newline-escaped PEM values in env vars.
  const expanded = sslCaInline.includes('\\n') ? sslCaInline.replace(/\\n/g, '\n') : sslCaInline;
  if (looksLikePemCertificate(expanded)) {
    sslCa = expanded;
  } else {
    if (looksLikeFilePath(expanded)) {
      console.warn('⚠️  DB_SSL_CA looks like a file path, not PEM contents. Ignoring DB_SSL_CA and continuing.');
      console.warn('   Use DB_SSL_CA with the PEM text, or DB_SSL_CA_FILE with a readable container path.');
    } else {
      console.warn('⚠️  DB_SSL_CA is set but does not look like a PEM certificate. Ignoring DB_SSL_CA.');
    }
  }
} else if (sslCaFilePath) {
  try {
    sslCa = fs.readFileSync(sslCaFilePath, 'utf8');
  } catch (error) {
    console.warn('⚠️  Could not read DB_SSL_CA_FILE:', sslCaFilePath);
  }
}

// If a CA is provided, default to strict verification for best security.
const sslConfig = shouldUseSSL ? { rejectUnauthorized: sslCa ? true : sslRejectUnauthorized, ...(sslCa ? { ca: sslCa } : {}) } : false;

console.log('🔍 Database Configuration:');
console.log('   Host:', effectiveDb.host);
console.log('   Port:', effectiveDb.port);
console.log('   User:', effectiveDb.user);
console.log('   Database:', effectiveDb.database);
console.log('   Using DATABASE_URL:', connectionString ? 'yes' : 'no');

const pgPool = new Pool({
  ...(connectionString
    ? { connectionString }
    : {
        host: effectiveDb.host,
        port: parseInt(effectiveDb.port || '5432'),
        user: effectiveDb.user,
        password: process.env.DB_PASSWORD || '',
        database: effectiveDb.database,
      }),
  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000, // Increased from 2000ms to 10000ms for remote databases
  ssl: sslConfig,
});

// MySQL-compatible result interface
interface MySQLResult {
  insertId?: number;
  affectedRows: number;
}

// MySQL-compatible tuple type for results
type MySQLQueryResult<T = any> = [T[], MySQLResult];

// Create wrapper to provide MySQL-compatible interface
class MySQLCompatiblePool {
  private pgPool: Pool;

  constructor(pool: Pool) {
    this.pgPool = pool;
  }

  async query<T = any>(sql: string, values?: any[]): Promise<MySQLQueryResult<T>> {
    try {
      // Convert MySQL placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

      const result = await this.pgPool.query(pgSql, values || []);

      // Create a compatible result object that looks like MySQL results
      const fields: MySQLResult = {
        affectedRows: result.rowCount || 0,
      };

      // Return as a tuple that can be destructured
      return [result.rows as T[], fields];
    } catch (error) {
      throw error;
    }
  }

  async getConnection() {
    return await this.pgPool.connect();
  }

  async end() {
    return await this.pgPool.end();
  }
}

export const pool = new MySQLCompatiblePool(pgPool);

export async function initializeDatabase() {
  try {
    console.log('\n🔌 Connecting to database...');
    console.log('   Host:', effectiveDb.host);
    console.log('   Port:', effectiveDb.port);
    console.log('   User:', effectiveDb.user);
    console.log('   Database:', effectiveDb.database);
    
    // Test connection by running a simple query with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout - database unreachable')), 15000)
    );

    const queryPromise = pgPool.query('SELECT NOW()');
    
    await Promise.race([queryPromise, timeoutPromise]);
    
    console.log('✅ Database connected successfully!');
    console.log('🗄️  Database:', effectiveDb.database);
    console.log('📊 Host:', effectiveDb.host);
    console.log('');
    return true;
  } catch (error: any) {
    console.error('\n❌ ========================================');
    console.error('❌ DATABASE CONNECTION FAILED');
    console.error('❌ ========================================');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('');
    console.error('Attempted connection:');
    console.error('  Host:', effectiveDb.host);
    console.error('  Port:', effectiveDb.port);
    console.error('  User:', effectiveDb.user);
    console.error('  Database:', effectiveDb.database);
    console.error('');
    console.error('📝 Troubleshooting steps:');
    console.error('1. Verify .env file exists in activecore-db/ folder');
    console.error('2. Check DB_HOST is correct (e.g., your-render-db.render.com)');
    console.error('3. Confirm DB_PASSWORD is set and correct');
    console.error('4. Verify database "activecore" exists on the server');
    console.error('5. Check if PostgreSQL is running and accessible');
    console.error('6. If you see SELF_SIGNED_CERT_IN_CHAIN, set DB_SSL_REJECT_UNAUTHORIZED=false');
    console.error('7. Ensure your IP is whitelisted (if applicable)');
    console.error('========================================\n');
    return false;
  }
}