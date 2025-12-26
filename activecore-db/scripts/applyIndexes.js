/**
 * Apply Database Indexes and Views
 * Run: node scripts/applyIndexes.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyIndexes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'activecore',
    multipleStatements: true
  });

  try {
    console.log('📊 Reading indexes_and_views.sql...');
    const sqlPath = path.join(__dirname, '../src/database/indexes_and_views.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Applying database indexes and views...\n');
    
    // Execute SQL script
    const [results] = await connection.query(sqlContent);
    
    console.log('\n✅ Database optimization complete!');
    console.log('✅ Indexes created for:');
    console.log('   - Users (email, role, status)');
    console.log('   - Payments (user_id, transaction_id, payment_status, dates)');
    console.log('   - Attendance (user_id, dates, composite index)');
    console.log('   - QR Tokens (token lookup, expiration)');
    console.log('   - Meal Plans (user_id, creation date)');
    console.log('   - Equipment (purchase date, warranty)');
    console.log('   - Filipino Dishes (name, category)');
    console.log('   - Payment History (user_id, payment_id)');
    
    console.log('\n✅ Stored procedures created for common queries');
    console.log('✅ Views created for reports and analytics');
    
  } catch (error) {
    console.error('❌ Error applying indexes:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

applyIndexes();
