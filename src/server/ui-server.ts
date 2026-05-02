import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

const PORT = process.env.AGENT_DEVKIT_UI_PORT || '18790';
const OPENCLAW_CONTAINER = 'agent-devkit-openclaw';
const HERMES_CONTAINER = 'agent-devkit-hermes';
const HERMES_API_URL = process.env.HERMES_API_URL || 'http://localhost:8642';
const HERMES_API_KEY = process.env.HERMES_API_KEY || 'hermes-devkit-key';

function isOpenClawRunning(): boolean {
  try {
    execSync(`docker ps -q -f name=${OPENCLAW_CONTAINER}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isHermesRunning(): boolean {
  try {
    execSync(`docker ps -q -f name=${HERMES_CONTAINER}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function dockerExec(cmd: string, timeout = 15000): string {
  return execSync(`docker exec ${OPENCLAW_CONTAINER} ${cmd}`, {
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout
  });
}

function getDashboardUrl(): string {
  try {
    const configJson = dockerExec('cat /home/node/.openclaw/openclaw.json', 5000);
    const config = JSON.parse(configJson);
    const token = config.gateway?.auth?.token || '';
    return token ? `http://localhost:18789/#token=${token}` : 'http://localhost:18789';
  } catch {
    return 'http://localhost:18789';
  }
}

const API_ROUTES: Record<string, (req: http.IncomingMessage, res: http.ServerResponse, body?: any) => void> = {
  '/api/status': (_req, res) => {
    const openclawRunning = isOpenClawRunning();
    let hermesRunning = false;
    try {
      if (isHermesRunning()) {
        execSync(`curl -sf ${HERMES_API_URL}/v1/health`, { stdio: 'pipe', timeout: 3000 });
        hermesRunning = true;
      }
    } catch {
      hermesRunning = false;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, openclawRunning, hermesRunning, dashboardUrl: getDashboardUrl() }));
  },

  '/api/agents': (_req, res) => {
    if (!isOpenClawRunning()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OpenClaw container is not running' }));
      return;
    }
    try {
      const output = dockerExec('openclaw agents list --json', 15000);
      const agents = JSON.parse(output);
      // Enrich with auth status for each
      const enriched = agents.map((a: any) => ({
        ...a,
        chatUrl: `http://localhost:18789/#token=${getDashboardUrl().split('token=')[1] || ''}&agent=${a.id}`
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(enriched));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  },

  '/api/agents/create': (_req, res, body) => {
    if (!isOpenClawRunning()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OpenClaw container is not running' }));
      return;
    }
    const { name, model } = body || {};
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent name is required' }));
      return;
    }
    try {
      dockerExec(
        `openclaw agents add "${name}" --non-interactive --workspace /home/node/.openclaw/workspace/${name} --agent-dir /home/node/.openclaw/agents/${name}/agent ${model ? `--model "${model}"` : ''}`,
        30000
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: name }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.stderr || err.message }));
    }
  },

  '/api/agents/delete': (_req, res, body) => {
    if (!isOpenClawRunning()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OpenClaw container is not running' }));
      return;
    }
    const { id } = body || {};
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent id is required' }));
      return;
    }
    try {
      dockerExec(`openclaw agents delete "${id}" --force`, 15000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.stderr || err.message }));
    }
  },

  '/api/skills': (_req, res) => {
    if (!isOpenClawRunning()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OpenClaw container is not running' }));
      return;
    }
    try {
      const output = dockerExec('openclaw skills list --json', 15000);
      const data = JSON.parse(output);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data.skills || []));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  },

  '/api/containers': (_req, res) => {
    try {
      const output = execSync(
        `docker ps --filter "label=agent-devkit.managed=true" --format "{{json .}}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      const lines = output.trim().split('\n').filter(Boolean);
      const containers = lines.map(line => {
        try {
          const c = JSON.parse(line);
          return {
            name: c.Names,
            image: c.Image,
            status: c.Status,
            state: c.State,
            ports: c.Ports
          };
        } catch {
          return null;
        }
      }).filter(Boolean);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(containers));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
};

function serveStatic(filePath: string, res: http.ServerResponse): void {
  const ext = path.extname(filePath);
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

export function startUIServer(): http.Server {
  // Try dist first, then fall back to source (tsc doesn't copy static files)
  const publicDir =
    fs.existsSync(path.join(__dirname, 'public', 'index.html'))
      ? path.join(__dirname, 'public')
      : path.join(__dirname, '..', '..', '..', 'src', 'server', 'public');

  const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '/';

    // API routes
    if (url.startsWith('/api/')) {
      const handler = API_ROUTES[url];
      if (!handler) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      if (req.method === 'POST' || req.method === 'DELETE') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            handler(req, res, parsed);
          } catch {
            handler(req, res, {});
          }
        });
      } else {
        handler(req, res);
      }
      return;
    }

    // Static files
    const filePath = url === '/' ? path.join(publicDir, 'index.html') : path.join(publicDir, url);
    // Security: prevent directory traversal
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    serveStatic(filePath, res);
  });

  server.listen(parseInt(PORT, 10), () => {
    console.log(chalk.bold.green(`\n🎛️  Agent DevKit UI running at http://localhost:${PORT}\n`));
    console.log(chalk.white('Available endpoints:'));
    console.log(chalk.gray(`  • http://localhost:${PORT}/           Dashboard`));
    console.log(chalk.gray(`  • http://localhost:${PORT}/api/agents   List agents`));
    console.log(chalk.gray(`  • http://localhost:${PORT}/api/status   Devkit status`));
    console.log();
    console.log(chalk.gray('Press Ctrl+C to stop'));
  });

  return server;
}
