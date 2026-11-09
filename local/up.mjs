#!/usr/bin/env node
// One command for the local WordPress stack. Staging does not use this file.
//   node local/up.mjs          start
//   node local/up.mjs stop     stop, keep the database
//   node local/up.mjs down     remove containers and the database volume
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env, need } from '../process/modules/common/env.mjs';

const action = process.argv[2] ?? 'up';
const compose = fileURLToPath(new URL('./docker-compose.yml', import.meta.url));
const envFile = fileURLToPath(new URL('../.env.local', import.meta.url));

const LOCAL_KEYS = [
  'WP_PORT',
  'WORDPRESS_IMAGE',
  'WORDPRESS_DEBUG',
  'MARIADB_IMAGE',
  'MARIADB_DATABASE',
  'MARIADB_USER',
  'MARIADB_PASSWORD',
  'MARIADB_ROOT_PASSWORD',
];

if (!['up', 'stop', 'down'].includes(action)) {
  console.error('usage: node local/up.mjs [up|stop|down]');
  process.exit(1);
}

for (const key of LOCAL_KEYS) need(key, 'Add it to .env.local. Staging does not need this command.');
need('WP_URL');

const args = ['compose', '--env-file', envFile, '-f', compose];
if (action === 'up') args.push('up', '-d');
else if (action === 'stop') args.push('stop');
else args.push('down', '-v');

const run = spawnSync('docker', args, { stdio: 'inherit', env });
process.exit(run.status ?? 1);
