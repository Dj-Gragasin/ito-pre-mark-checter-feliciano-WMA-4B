"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initializeDatabase = initializeDatabase;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log('🔍 Database Configuration:');
console.log('   Host:', process.env.DB_HOST || 'localhost');
console.log('   Port:', process.env.DB_PORT || '5432');
console.log('   User:', process.env.DB_USER || 'postgres');
console.log('   Database:', process.env.DB_NAME || 'activecore');
const pgPool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'activecore',
    max: 10,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 2000,
});
// Create wrapper to provide MySQL-compatible interface
class MySQLCompatiblePool {
    constructor(pool) {
        this.pgPool = pool;
    }
    query(sql, values) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Convert MySQL placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
                let pgSql = sql;
                let paramIndex = 1;
                pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
                const result = yield this.pgPool.query(pgSql, values || []);
                // Create a compatible result object that looks like MySQL results
                const fields = {
                    affectedRows: result.rowCount || 0,
                };
                // Return as a tuple that can be destructured
                return [result.rows, fields];
            }
            catch (error) {
                throw error;
            }
        });
    }
    getConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pgPool.connect();
        });
    }
    end() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pgPool.end();
        });
    }
}
exports.pool = new MySQLCompatiblePool(pgPool);
function initializeDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('\n🔌 Connecting to database...');
            const connection = yield exports.pool.getConnection();
            console.log('✅ Database connected successfully!');
            console.log('🗄️  Database:', process.env.DB_NAME || 'activecore');
            console.log('📊 Backend:', process.env.DB_HOST || 'localhost');
            console.log('');
            connection.release();
            return true;
        }
        catch (error) {
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
    });
}
