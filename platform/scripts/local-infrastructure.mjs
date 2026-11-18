import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));

const mode = process.argv[2] ?? 'check';
const timeoutMs = 1_500;

function tcpReachable(host, port, timeout = timeoutMs) {
  return new Promise((resolveProbe) => {
    const socket = net.createConnection({ host, port });
    const finish = (result) => {
      socket.destroy();
      resolveProbe(result);
    };
    socket.setTimeout(timeout, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function amqpReachable(host, port) {
  return new Promise((resolveProbe) => {
    const socket = net.createConnection({ host, port });
    const finish = (result) => {
      socket.destroy();
      resolveProbe(result);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => socket.write(Buffer.from('AMQP\0\0\x09\x01', 'binary')));
    socket.once('data', (chunk) => {
      const protocolHeader = chunk.subarray(0, 4).toString() === 'AMQP';
      finish(protocolHeader || chunk[0] === 1);
    });
    socket.once('error', () => finish(false));
    socket.once('close', () => resolveProbe(false));
  });
}

async function checkMongo() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/cctv_platform?replicaSet=rs0';
  const url = new URL(uri);
  const host = url.hostname;
  const port = Number(url.port || 27017);
  const reachable = await tcpReachable(host, port);
  if (!reachable) return { name: 'MongoDB', state: 'missing', compose: ['mongodb', 'mongo-init'] };

  try {
    const moduleUrl = pathToFileURL(resolve(root, 'apps/api/node_modules/mongoose/index.js')).href;
    const { default: mongoose } = await import(moduleUrl);
    const probeUrl = new URL(uri);
    probeUrl.searchParams.delete('replicaSet');
    probeUrl.searchParams.set('directConnection', 'true');
    const connection = await mongoose
      .createConnection(probeUrl.toString(), {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs,
      })
      .asPromise();
    const hello = await connection.db.admin().command({ hello: 1 });
    await connection.close();
    const expectedReplicaSet = url.searchParams.get('replicaSet');
    if (expectedReplicaSet && hello.setName !== expectedReplicaSet) {
      return {
        name: 'MongoDB',
        state: 'conflict',
        detail: `port ${port} aktif tetapi replica set adalah ${hello.setName ?? 'standalone'}, bukan ${expectedReplicaSet}`,
      };
    }
    return {
      name: 'MongoDB',
      state: 'reused',
      detail: `${host}:${port}, ${hello.setName ? `replica set ${hello.setName}` : 'standalone'}`,
    };
  } catch (error) {
    return {
      name: 'MongoDB',
      state: 'conflict',
      detail: `port ${port} aktif tetapi tidak kompatibel: ${String(error).split('\n')[0]}`,
    };
  }
}

async function checkRabbit() {
  const uri = new URL(process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672');
  const port = Number(uri.port || 5672);
  const portOccupied = await tcpReachable(uri.hostname, port);
  const reachable = portOccupied && (await amqpReachable(uri.hostname, port));
  if (portOccupied && !reachable) {
    return {
      name: 'RabbitMQ',
      state: 'conflict',
      detail: `port ${port} aktif tetapi tidak merespons protokol AMQP`,
    };
  }
  return reachable
    ? { name: 'RabbitMQ', state: 'reused', detail: `${uri.hostname}:${port}` }
    : { name: 'RabbitMQ', state: 'missing', compose: ['rabbitmq'] };
}

async function checkMediaMtx() {
  const rtspPort = Number(process.env.MEDIAMTX_RTSP_PORT ?? 8554);
  const apiPort = Number(process.env.MEDIAMTX_API_PORT ?? 9997);
  const rtsp = await tcpReachable('localhost', rtspPort);
  let api = false;
  try {
    const response = await fetch(`http://localhost:${apiPort}/v3/paths/list`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    api = response.ok || response.status === 401;
  } catch {
    api = false;
  }
  if (rtsp && api) {
    return { name: 'MediaMTX', state: 'reused', detail: `RTSP :${rtspPort}, API :${apiPort}` };
  }
  if (rtsp || api) {
    return {
      name: 'MediaMTX',
      state: 'conflict',
      detail: 'sebagian port MediaMTX sudah dipakai tetapi service tidak lengkap',
    };
  }
  return { name: 'MediaMTX', state: 'missing', compose: ['mediamtx'] };
}

async function inspect() {
  return Promise.all([checkMongo(), checkRabbit(), checkMediaMtx()]);
}

function print(results) {
  const symbols = { reused: 'REUSE', missing: 'START', conflict: 'BLOCK' };
  for (const result of results) {
    console.log(
      `${symbols[result.state].padEnd(5)} ${result.name.padEnd(10)} ${result.detail ?? ''}`,
    );
  }
}

async function main() {
  const initial = await inspect();
  print(initial);
  if (mode === 'check') return;
  if (mode !== 'up') throw new Error(`Unknown mode: ${mode}`);

  const conflicts = initial.filter((result) => result.state === 'conflict');
  if (conflicts.length) {
    throw new Error(
      'Port conflict detected. Resolve the blocked service or update .env before starting.',
    );
  }
  const services = initial.flatMap((result) => result.compose ?? []);
  if (!services.length) {
    console.log('All local infrastructure is already available; no container was started.');
    return;
  }

  const command = spawnSync('docker', ['compose', 'up', '-d', ...services], {
    cwd: root,
    stdio: 'inherit',
  });
  if (command.status !== 0) process.exit(command.status ?? 1);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
    const current = await inspect();
    const pending = current.filter((result) => result.state !== 'reused');
    if (!pending.length) {
      console.log('\nInfrastructure is ready:');
      print(current);
      return;
    }
  }
  throw new Error(
    'Infrastructure did not become ready within 20 seconds. Run docker compose logs.',
  );
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
