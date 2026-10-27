// Client for the WordPress bridge (wp-content/mu-plugins/figma-to-bricks-bridge.php)
import { env, need } from '../shared/env.mjs';

export async function bridge(method, path, body) {
  const url = (env.WP_URL ?? 'http://localhost:8080') + '/?rest_route=/f2b/v1' + path;
  const auth = Buffer.from(`${need('WP_USER')}:${need('WP_APP_PASSWORD')}`).toString('base64');
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
  if (!res.ok) throw new Error(`bridge ${method} ${path} -> ${res.status} ${data?.message ?? data}`);
  return data;
}
