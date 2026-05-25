// IMPORTANT: 'dotenv/config' must be the very first import so that
// process.env vars are populated before any other module reads them.
import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});