import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { openDb, seed } from './db.ts';

const port = Number(process.env.PORT ?? 3001);
const db = openDb(process.env.DB_PATH ?? 'data/schemes.db');
const seeded = seed(db, new URL('../docs/blueprint/examples/', import.meta.url));
if (seeded) console.log(`seeded ${seeded} schemes`);

const server = createServer(createApp(db));
server.listen(port, () => console.log(`api on :${port}`));

const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
