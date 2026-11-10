// Cursor MCP for the one site in .env. URL and token are that site's, not a second target.
import { createInterface } from 'node:readline';
import { need, requireSiteEnv } from '../process/modules/common/env.mjs';

requireSiteEnv();
const endpoint = new URL('/wp-json/f2b-mcp/v1/mcp', need('WP_URL')).href;
const token = need('MCP_TOKEN');

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  let payload;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: trimmed,
    });
    const text = (await res.text()).trim();
    if (!text) continue;
    payload = JSON.parse(text);
  } catch (error) {
    payload = { jsonrpc: '2.0', id: null, error: { code: -32000, message: error.message } };
  }
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}
