const { Client } = require('pg');
async function test() {
  for (const host of ['localhost', '127.0.0.1', '::1']) {
    try {
      const c = new Client({
        host, port: 5433, user: 'vrixo', password: 'vrixo_secret', database: 'vrixo', ssl: false
      });
      await c.connect();
      console.log('SUCCESS with', host);
      const r = await c.query('SELECT 1 AS test');
      console.log('Query:', JSON.stringify(r.rows));
      await c.end();
      return;
    } catch (e) {
      console.log('FAIL with', host, ':', e.message);
    }
  }
  process.exit(1);
}
test();
