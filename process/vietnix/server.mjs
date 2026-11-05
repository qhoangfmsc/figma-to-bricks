#!/usr/bin/env node
// Local API for the Vietnix Tools screen. WordPress only has wp-content mounted, so the pipeline stays on the host.
//   node process/vietnix/server.mjs
// Binds 127.0.0.1:8791. The admin page (localhost:8080) calls it from the browser.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from '../shared/env.mjs';
import { parseFrameInput } from '../template/frames.mjs';
import { describeTiming } from '../template/timing.mjs';
import { readTemplate, buildTemplate } from '../template.mjs';

const PORT = 8791;
const tokenPath = join(ROOT, 'wp-content/mu-plugins/vietnix-tools/.token');

function token() {
  if (!existsSync(tokenPath)) {
    mkdirSync(dirname(tokenPath), { recursive: true });
    writeFileSync(tokenPath, randomBytes(24).toString('hex') + '\n');
  }
  return readFileSync(tokenPath, 'utf8').trim();
}

const jobs = new Map();
let busy = null;

function jobView(job) {
  const now = Date.now();
  return {
    id: job.id,
    phase: job.phase,
    log: job.log.slice(-80),
    read: job.read,
    result: job.result,
    error: job.error,
    stack: job.stack ?? '',
    problems: job.problems ?? [],
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    elapsedMs: (job.endedAt ?? now) - job.startedAt,
    estimate: job.estimate,
  };
}

function fail(job, e) {
  job.error = e?.message || String(e);
  job.stack = e?.expose ? '' : String(e?.stack || '').split('\n').slice(0, 12).join('\n');
  job.problems = e?.problems ?? [];
  job.phase = 'error';
  job.endedAt = Date.now();
}

function push(job, line) {
  job.log.push(String(line));
  if (job.log.length > 200) job.log.splice(0, job.log.length - 200);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('body quá lớn');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function send(res, status, body, origin) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-private-network': 'true',
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const allowed = new Set(['http://localhost:8080', 'http://127.0.0.1:8080']);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const origin = allowed.has(req.headers.origin) ? req.headers.origin : 'http://localhost:8080';
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, timing: describeTiming({ desktop: 'x' }) }, origin);
    if (req.method === 'GET' && url.pathname === '/estimate') return send(res, 200, describeTiming({
      desktop: url.searchParams.get('desktop') ? '1' : '',
      tablet: url.searchParams.get('tablet') ? '1' : '',
      mobile: url.searchParams.get('mobile') ? '1' : '',
    }), origin);
    const bearer = String(req.headers.authorization ?? '');
    if (bearer !== `Bearer ${token()}`) return send(res, 401, { error: 'Sai token. Mở lại Vietnix Tools.' }, origin);

    if (req.method === 'GET' && url.pathname.startsWith('/jobs/')) {
      const job = jobs.get(url.pathname.slice('/jobs/'.length));
      if (!job) return send(res, 404, { error: 'Không thấy job.' }, origin);
      return send(res, 200, jobView(job), origin);
    }

    if (req.method === 'POST' && (url.pathname === '/read' || url.pathname === '/build')) {
      if (busy) return send(res, 409, { error: 'Đang chạy một template. Đợi xong rồi chạy tiếp.' }, origin);
      const body = await readBody(req);
      const parsed = parseFrameInput(body.frames ?? body);
      if (!parsed.ok) return send(res, 400, { errors: parsed.errors }, origin);
      const job = {
        id: randomBytes(8).toString('hex'),
        phase: url.pathname === '/read' ? 'reading' : 'building',
        log: [],
        read: null,
        result: null,
        error: null,
        stack: '',
        problems: [],
        frames: parsed.frames,
        answers: body.answers ?? {},
        feedback: String(body.feedback ?? ''),
        startedAt: Date.now(),
        endedAt: null,
        estimate: describeTiming(body.frames ?? body),
      };
      jobs.set(job.id, job);
      busy = job.id;
      const finish = () => { job.endedAt ??= Date.now(); if (busy === job.id) busy = null; };
      if (url.pathname === '/read') {
        readTemplate(parsed.frames, { log: (line) => push(job, line) }).then((read) => {
          job.read = read;
          job.phase = 'confirm';
          finish();
        }, (e) => { fail(job, e); finish(); });
      } else {
        buildTemplate(parsed.frames.desktop.url, job.answers, { log: (line) => push(job, line), feedback: job.feedback }).then((result) => {
          job.result = result;
          job.phase = 'done';
          finish();
        }, (e) => { fail(job, e); finish(); });
      }
      return send(res, 202, { id: job.id }, origin);
    }
    send(res, 404, { error: 'Không có route này.' }, origin);
  } catch (e) {
    send(res, 400, { error: e.message }, origin);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  token();
  console.log(`Vietnix Tools pipeline http://127.0.0.1:${PORT}`);
});
