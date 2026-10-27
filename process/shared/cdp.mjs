// Minimal Chrome DevTools Protocol client (no dependencies): open a page in a headless browser, evaluate JS, take a screenshot.
//
// The browser runs INSIDE DOCKER (chromedp/headless-shell), never as an app on the owner's Mac: a local Chrome shows up in the Dock and
// steals focus on every run. The container is reached on 127.0.0.1:<random port>; inside it, the WordPress host name from WP_URL
// (localhost:8080) is mapped to the Docker host, so the preview URL works unchanged.
import { spawnSync } from 'node:child_process';
import { env } from './env.mjs';

const IMAGE = env.CHROME_IMAGE ?? 'chromedp/headless-shell:latest';
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

export async function launchChrome() {
  if (docker('info').status !== 0) throw new Error('Docker is not running: start Docker Desktop (the browser used by verify runs in a container)');
  const port = 9300 + Math.floor(Math.random() * 500);
  const name = `f2b-chrome-${process.pid}-${port}`;
  const wp = new URL(env.WP_URL ?? 'http://localhost:8080');
  const wpPort = wp.port || (wp.protocol === 'https:' ? '443' : '80');
  // every name the site can be reached by from the host -> the Docker host
  const rules = [...new Set([wp.hostname, 'localhost', '127.0.0.1'])].map((h) => `MAP ${h}:${wpPort} host.docker.internal:${wpPort}`).join(', ');
  // The image's own run.sh passes its arguments unquoted, which breaks --host-resolver-rules (it contains spaces), so the same
  // two processes are started here: socat publishes Chrome's loopback-only DevTools port, Chrome gets the rules from $RULES.
  const script = 'socat TCP4-LISTEN:9222,fork TCP4:127.0.0.1:9223 & exec /headless-shell/headless-shell --no-sandbox --use-gl=angle --use-angle=swiftshader --remote-debugging-port=9223 --hide-scrollbars --font-render-hinting=none --host-resolver-rules="$RULES"';
  const run = docker('run', '--rm', '-d', '--name', name, '--shm-size=1g', '--add-host=host.docker.internal:host-gateway', '-e', `RULES=${rules}`,
    '-p', `127.0.0.1:${port}:9222`, '--entrypoint', '/bin/bash', IMAGE, '-c', script);
  if (run.status !== 0) throw new Error(`could not start the browser container: ${run.stderr.trim()}`);
  const proc = { kill: () => docker('rm', '-f', name) };
  process.once('exit', () => proc.kill()); // never leave a container behind, even when a step crashes

  let ws;
  for (let i = 0; i < 60; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      ws = v.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, `ws://127.0.0.1:${port}`);
      break;
    } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!ws) { proc.kill(); throw new Error('the browser container did not start'); }

  const sock = new WebSocket(ws);
  await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  const listeners = [];
  sock.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(`${m.error.message}`)) : res(m.result);
    } else if (m.method) listeners.forEach((l) => l(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    sock.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);

  return {
    call,
    waitEvent: (name, ms = 20000) => new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`timeout waiting for ${name}`)), ms);
      const l = (m) => { if (m.method === name && m.sessionId === sessionId) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); res(m.params); } };
      listeners.push(l);
    }),
    async evaluate(expression) {
      const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
      return r.result.value;
    },
    async close() {
      try { sock.close(); } catch {}
      proc.kill();
    },
  };
}
