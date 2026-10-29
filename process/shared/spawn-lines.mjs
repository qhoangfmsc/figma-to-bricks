// spawn a command and hand every stdout line to onLine as it is printed (progress needs the steps while they run, spawnSync only returns at the end)
import { spawn } from 'node:child_process';

export function runLines(cmd, args, onLine = () => {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args);
    let out = '', err = '', rest = '';
    child.stdout.on('data', (d) => {
      const text = d.toString(); out += text; rest += text;
      const lines = rest.split('\n'); rest = lines.pop();
      for (const l of lines) onLine(l);
    });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (status) => { if (rest) onLine(rest); resolve({ status, stdout: out, stderr: err }); });
    child.on('error', (e) => resolve({ status: null, stdout: out, stderr: String(e) }));
  });
}
