// Logs del sistema en formato JSON (una línea por evento), a consola y opcionalmente a archivo.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let file: string | null = null;

export function setLogFile(path: string | null) {
  file = path;
  if (path) mkdirSync(dirname(path), { recursive: true });
}

function write(level: string, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...data });
  if (level === 'error') console.error(line);
  else if (process.env.LOG_QUIET !== '1') console.log(line);
  if (file) {
    try {
      appendFileSync(file, line + '\n');
    } catch {
      /* sin archivo de log */
    }
  }
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => write('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => write('error', event, data),
};
