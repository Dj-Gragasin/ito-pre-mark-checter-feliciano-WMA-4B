const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'activecore'
  });
  
  const [columns] = await connection.execute("SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'filipino_dishes' AND TABLE_SCHEMA = 'activecore'");
  console.log('Current schema:');
  console.log(columns);
  
  const [dishes] = await connection.execute("SELECT * FROM filipino_dishes LIMIT 1");
  console.log('\nSample dish:');
  console.log(dishes[0]);
  
  await connection.end();
}

checkSchema();
