import { createServer } from 'net';

/** Probes real OS port availability (not just an internal counter) — avoids colliding with anything else already listening on the host. */
export async function findFreePort(startFrom: number, endAt = startFrom + 200): Promise<number> {
  for (let port = startFrom; port <= endAt; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`Kein freier Port zwischen ${startFrom} und ${endAt} gefunden.`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}
