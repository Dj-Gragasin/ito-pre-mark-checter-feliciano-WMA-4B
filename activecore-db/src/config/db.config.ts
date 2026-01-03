import { Pool, QueryResult, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Database Configuration:');
console.log('   Host:', process.env.DB_HOST || 'localhost');
console.log('   Port:', process.env.DB_PORT || '5432');
console.log('   User:', process.env.DB_USER || 'postgres');
console.log('   Database:', process.env.DB_NAME || 'activecore');

const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'activecore',
  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 2000,
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
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    console.log('🗄️  Database:', process.env.DB_NAME || 'activecore');
    console.log('📊 Backend:', process.env.DB_HOST || 'localhost');
    console.log('');
    connection.release();
    return true;
  } catch (error: any) {
    console.error('\n❌ ========================================');
    console.error('❌ DATABASE CONNECTION FAILED');
    console.error('❌ ========================================');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('');
    console.error('📝 Troubleshooting steps:');
    console.error('1. Check if PostgreSQL is running on Render');
    console.error('2. Verify database "activecore" exists');
    console.error('3. Confirm PostgreSQL is on port 5432');
    console.error('4. Check .env file configuration');
    console.error('5. Verify DB_HOST matches Render connection string');
    console.error('========================================\n');
    return false;
  }
}