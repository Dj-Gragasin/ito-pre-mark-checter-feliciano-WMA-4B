const pg = require('pg');
const c = new pg.Client({
  host: 'dpg-d5b3d6er433s738mu9gg-a.singapore-postgres.render.com',
  user: 'activecore_user',
  password: 'i2gf3m6yT8vhRf5eRE9jlKVnEgt2wyFi',
  database: 'activecore'
});

c.connect()
  .then(() => c.query("SELECT id, email, first_name, last_name, role FROM users WHERE LOWER(email) LIKE '%djgragasin%'"))
  .then(r => {
    console.log(JSON.stringify(r.rows, null, 2));
    c.end();
  })
  .catch(e => {
    console.log(e.message);
    c.end();
  });