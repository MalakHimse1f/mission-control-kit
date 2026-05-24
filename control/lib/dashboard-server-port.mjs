import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_DASHBOARD_PORT = 9470;
export const DASHBOARD_PORT_SCAN_MAX = 50;

export function dashboardServerStatePath(controlRoot) {
  return path.join(controlRoot, '.mc/dashboard-server.json');
}

export function readDashboardServerState(controlRoot) {
  const file = dashboardServerStatePath(controlRoot);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeDashboardServerState(controlRoot, state) {
  const file = dashboardServerStatePath(controlRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
}

export function clearDashboardServerState(controlRoot) {
  const file = dashboardServerStatePath(controlRoot);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function listenOnPort(server, port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

export async function probeDashboardServer(port, { host = '127.0.0.1', timeoutMs = 800, fetchFn = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`http://${host}:${port}/api/server-info`, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRoot(root) {
  return path.resolve(root);
}

/**
 * Pick a dashboard port. When auto-selecting, skips ports used by other MC projects
 * and reuses detection when this control root is already served.
 */
export async function resolveDashboardPort({
  controlRoot,
  preferredPort = DEFAULT_DASHBOARD_PORT,
  explicitPort = null,
  host = '127.0.0.1',
  maxAttempts = DASHBOARD_PORT_SCAN_MAX,
  probeFn = probeDashboardServer,
  listenFn = listenOnPort,
  server,
} = {}) {
  const root = normalizeRoot(controlRoot);
  const saved = readDashboardServerState(root);
  const startPort = explicitPort != null ? Number(explicitPort) : (saved?.port ?? preferredPort);
  const autoSelect = explicitPort == null;

  async function checkExisting(port) {
    const info = await probeFn(port, { host });
    if (!info?.controlRoot) return null;
    if (normalizeRoot(info.controlRoot) === root) {
      return { port, alreadyRunning: true, info };
    }
    return { port, occupiedByOther: true, info };
  }

  if (saved?.port) {
    const existing = await checkExisting(saved.port);
    if (existing?.alreadyRunning) return existing;
  }

  const portsToTry = autoSelect
    ? Array.from({ length: maxAttempts }, (_, i) => startPort + i)
    : [startPort];

  for (const port of portsToTry) {
    const existing = await checkExisting(port);
    if (existing?.alreadyRunning) return existing;
    if (existing?.occupiedByOther) continue;

    if (!server) {
      return { port, alreadyRunning: false };
    }

    try {
      await listenFn(server, port, host);
      return { port, alreadyRunning: false };
    } catch (err) {
      if (err?.code === 'EADDRINUSE') continue;
      throw err;
    }
  }

  if (autoSelect) {
    throw new Error(
      `No free dashboard port in range ${startPort}–${startPort + maxAttempts - 1}. Stop unused servers or set MC_DASHBOARD_PORT.`,
    );
  }
  throw new Error(`Port ${startPort} is in use. Omit MC_DASHBOARD_PORT to auto-pick the next free port.`);
}
