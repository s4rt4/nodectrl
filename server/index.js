#!/usr/bin/env node
/**
 * NodeCtrl Backend Server
 * Pure Node.js — zero npm dependencies
 * Features: HTTP static server, WebSocket, real command execution, package.json watcher
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { attachWebSocket } = require('./ws-server');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');

// ─── MIME TYPES ──────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ─── ACTIVE PROCESSES ────────────────────────────────────────────────────────
const activeProcs = new Map(); // cmdId -> ChildProcess

// ─── HTTP SERVER ─────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url;

  // API: list package.json
  if (req.method === 'GET' && req.url.startsWith('/api/pkgjson')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = params.get('dir') || process.cwd();
    const pkgPath = path.join(dir, 'package.json');
    try {
      const data = fs.readFileSync(pkgPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No package.json found', path: pkgPath }));
    }
    return;
  }

  // API: save package.json
  if (req.method === 'POST' && req.url.startsWith('/api/pkgjson')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = params.get('dir') || process.cwd();
    const pkgPath = path.join(dir, 'package.json');
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        JSON.parse(body); // validate JSON
        fs.writeFileSync(pkgPath, body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }


  // API: scan project folder
  if (req.method === 'GET' && req.url.startsWith('/api/scan')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = resolveCwd(params.get('dir') || process.cwd());
    const result = scanProject(dir);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: read .env file
  if (req.method === 'GET' && req.url.startsWith('/api/env')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = resolveCwd(params.get('dir') || process.cwd());
    const envFile = params.get('file') || '.env';
    const envPath = path.join(dir, envFile);
    try {
      const raw = fs.readFileSync(envPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, content: raw, path: envPath }));
    } catch(e) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'File not found', path: envPath }));
    }
    return;
  }

  // API: save .env file
  if (req.method === 'POST' && req.url.startsWith('/api/env')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = resolveCwd(params.get('dir') || process.cwd());
    const envFile = params.get('file') || '.env';
    const envPath = path.join(dir, envFile);
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        fs.writeFileSync(envPath, body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: list active ports (Windows: netstat, Unix: ss/netstat)
  if (req.method === 'GET' && req.url.startsWith('/api/ports')) {
    getActivePorts((err, ports) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(err ? { error: err.message, ports: [] } : { ports }));
    });
    return;
  }

  // API: kill process by PID
  if (req.method === 'POST' && req.url.startsWith('/api/killpid')) {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { pid } = JSON.parse(body);
        const isWin = process.platform === 'win32';
        const { exec } = require('child_process');
        const killCmd = isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
        exec(killCmd, { shell: true }, (err) => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(err ? { ok: false, error: err.message } : { ok: true }));
        });
      } catch(e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: get real nvm versions from system
  if (req.method === 'GET' && req.url.startsWith('/api/nvm-versions')) {
    getNvmVersions((err, result) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(err ? { error: err.message, versions: [] } : result));
    });
    return;
  }

  // API: get workspaces
  if (req.method === 'GET' && req.url === '/api/workspaces') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(loadWorkspaces()));
    return;
  }

  // API: save workspaces
  if (req.method === 'POST' && req.url === '/api/workspaces') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        saveWorkspaces(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: dependency analysis
  if (req.method === 'GET' && req.url.startsWith('/api/deps')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = resolveCwd(params.get('dir') || process.cwd());
    getDepsInfo(dir, (err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(err ? { error: err.message } : data));
    });
    return;
  }

  // API: process list
  if (req.method === 'GET' && req.url.startsWith('/api/procs')) {
    getProcessList((err, procs) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(err ? { error: err.message, procs: [] } : { procs }));
    });
    return;
  }

  // API: list log files in project directory
  if (req.method === 'GET' && req.url.startsWith('/api/logs')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = resolveCwd(params.get('dir') || process.cwd());
    const logs = findLogFiles(dir);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ logs }));
    return;
  }

  // API: read log file content (last N lines)
  if (req.method === 'GET' && req.url.startsWith('/api/logread')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const file = params.get('file') || '';
    const lines = Math.min(parseInt(params.get('lines') || '500'), 2000);
    try {
      const content = fs.readFileSync(file, 'utf8');
      const all = content.split('\n');
      const tail = all.slice(-lines).join('\n');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, content: tail, total: all.length }));
    } catch(e) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // API: git info
  if (req.method === 'GET' && req.url.startsWith('/api/git')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const dir = resolveCwd(params.get('dir') || process.cwd());
    getGitInfo(dir, (err, info) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(err ? { error: err.message } : info));
    });
    return;
  }

  // API: kill process
  if (req.method === 'POST' && req.url.startsWith('/api/kill')) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const id = params.get('id');
    if (id && activeProcs.has(id)) {
      try { activeProcs.get(id).kill('SIGTERM'); } catch(e) {}
      activeProcs.delete(id);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST' });
    res.end(); return;
  }

  // Static files
  const filePath = path.join(PUBLIC_DIR, urlPath.split('?')[0]);
  const ext = path.extname(filePath);
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
const clients = new Set();

attachWebSocket(server, (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (total: ${clients.size})`);

  // Send welcome — include actual cwd so frontend syncs correctly
  ws.send(JSON.stringify({
    type: 'system',
    text: `NodeCtrl server ready · Node ${process.version}`,
    cwd: process.cwd()
  }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }

    if (msg.type === 'run') handleRun(ws, msg);
    else if (msg.type === 'kill') handleKill(ws, msg);
    else if (msg.type === 'cwd') handleCwd(ws, msg);
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected (total: ${clients.size})`);
  });
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function resolveCwd(reqCwd) {
  const os = require('os');
  const isWin = process.platform === 'win32';
  let dir = reqCwd || process.cwd();

  // Resolve ~ on both platforms
  if (dir === '~' || dir.startsWith('~/') || dir.startsWith('~\\')) {
    dir = dir.replace(/^~/, os.homedir());
  }

  // On Windows forward-slashes → backslashes
  if (isWin) dir = dir.replace(/\//g, '\\');

  // Validate directory exists; fallback to server cwd
  try {
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) return dir;
  } catch(e) {}

  // Fallback: use the directory the server was started from
  return process.cwd();
}

// ─── COMMAND RUNNER ───────────────────────────────────────────────────────────
function handleRun(ws, msg) {
  const { id, cmd, cwd: reqCwd } = msg;
  const workDir = resolveCwd(reqCwd);
  const isWin = process.platform === 'win32';

  // Safety: block dangerous commands
  const BLOCKED = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
  if (BLOCKED.some(b => cmd.includes(b))) {
    ws.send(JSON.stringify({ type: 'error', id, text: '⛔ Blocked: dangerous command' }));
    return;
  }

  ws.send(JSON.stringify({ type: 'start', id, cmd, cwd: workDir }));

  let proc;
  try {
    // shell:true on both platforms — Node resolves the shell executable automatically.
    // On Windows this uses cmd.exe; on Unix it uses /bin/sh.
    // We pass the raw command string so the shell parses it correctly.
    proc = spawn(cmd, [], {
      cwd: workDir,
      env: { ...process.env },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: isWin
    });
  } catch(e) {
    ws.send(JSON.stringify({ type: 'error', id, text: `Failed to spawn: ${e.message}` }));
    return;
  }

  activeProcs.set(id, proc);

  proc.stdout.on('data', d => {
    ws.send(JSON.stringify({ type: 'stdout', id, text: d.toString() }));
  });

  proc.stderr.on('data', d => {
    ws.send(JSON.stringify({ type: 'stderr', id, text: d.toString() }));
  });

  proc.on('close', (code, signal) => {
    activeProcs.delete(id);
    ws.send(JSON.stringify({
      type: 'done', id, cmd,
      code,
      signal: signal || null,
      success: code === 0
    }));
  });

  proc.on('error', (e) => {
    activeProcs.delete(id);
    ws.send(JSON.stringify({ type: 'error', id, text: e.message }));
  });
}

function handleKill(ws, msg) {
  const { id } = msg;
  if (activeProcs.has(id)) {
    try { activeProcs.get(id).kill('SIGTERM'); } catch(e) {}
    activeProcs.delete(id);
    ws.send(JSON.stringify({ type: 'killed', id }));
  }
}

function handleCwd(ws, msg) {
  const dir = resolveCwd(msg.dir);
  try {
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) {
      ws.send(JSON.stringify({ type: 'cwd_ok', dir }));
    } else {
      ws.send(JSON.stringify({ type: 'error', id: msg.id, text: `Not a directory: ${dir}` }));
    }
  } catch(e) {
    ws.send(JSON.stringify({ type: 'error', id: msg.id, text: `Directory not found: ${dir}` }));
  }
}

// ─── PROJECT SCANNER ──────────────────────────────────────────────────────────
function scanProject(dir) {
  const result = { dir, hasPkg: false, hasEnv: false, envFiles: [],
    packageManager: null, name: null, version: null, scripts: {},
    deps: 0, devDeps: 0, frameworks: [], nodeVersion: null };
  try {
    const files = fs.readdirSync(dir);
    if (files.includes('pnpm-lock.yaml'))        result.packageManager = 'pnpm';
    else if (files.includes('yarn.lock'))         result.packageManager = 'yarn';
    else if (files.includes('package-lock.json')) result.packageManager = 'npm';
    if (files.includes('.nvmrc')) {
      try { result.nodeVersion = fs.readFileSync(path.join(dir, '.nvmrc'), 'utf8').trim(); } catch(e) {}
    }
    result.envFiles = files.filter(f => f === '.env' || f.startsWith('.env.'));
    result.hasEnv = result.envFiles.length > 0;
    if (files.includes('package.json')) {
      result.hasPkg = true;
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      result.name    = pkg.name    || path.basename(dir);
      result.version = pkg.version || '0.0.0';
      result.scripts  = pkg.scripts  || {};
      result.deps     = Object.keys(pkg.dependencies    || {}).length;
      result.devDeps  = Object.keys(pkg.devDependencies || {}).length;
      if (!result.packageManager) result.packageManager = 'npm';
      const all = { ...pkg.dependencies, ...pkg.devDependencies };
      const fw = [];
      if (all['react'])       fw.push({ name:'React',      icon:'⚛' });
      if (all['vue'])         fw.push({ name:'Vue',        icon:'💚' });
      if (all['svelte'])      fw.push({ name:'Svelte',     icon:'🔥' });
      if (all['next'])        fw.push({ name:'Next.js',    icon:'▲' });
      if (all['nuxt'])        fw.push({ name:'Nuxt',       icon:'💚' });
      if (all['express'])     fw.push({ name:'Express',    icon:'🚂' });
      if (all['fastify'])     fw.push({ name:'Fastify',    icon:'⚡' });
      if (all['typescript'] || all['ts-node']) fw.push({ name:'TypeScript', icon:'🔷' });
      if (all['vite'])        fw.push({ name:'Vite',       icon:'⚡' });
      if (all['webpack'])     fw.push({ name:'Webpack',    icon:'📦' });
      if (all['tailwindcss']) fw.push({ name:'Tailwind',   icon:'🎨' });
      if (all['electron'])    fw.push({ name:'Electron',   icon:'⚛' });
      result.frameworks = fw;
    }
  } catch(e) { result.error = e.message; }
  return result;
}

// ─── PORT SCANNER ─────────────────────────────────────────────────────────────
function getActivePorts(cb) {
  const { exec } = require('child_process');
  const isWin = process.platform === 'win32';
  const DEV_PORTS = new Set([3000,3001,3002,4000,4200,5000,5173,5174,8000,8080,8081,8888,9000,9229]);

  if (isWin) {
    exec('netstat -ano', { shell: true, windowsHide: true, timeout: 8000 }, (err, stdout) => {
      if (err && !stdout) return cb(err);
      const ports = [], seen = new Set();
      (stdout || '').split('\n').forEach(line => {
        const m = line.match(/TCP\s+[\d.:*]+:(\d+)\s+[\d.:*]+\s+(LISTENING|ESTABLISHED)\s+(\d+)/i);
        if (m) {
          const port = parseInt(m[1]), state = m[2].toUpperCase(), pid = parseInt(m[3]);
          const key = `${port}-${pid}`;
          if (!seen.has(key) && port > 0 && port < 65536) {
            seen.add(key);
            ports.push({ port, state, pid, dev: DEV_PORTS.has(port) });
          }
        }
      });
      cb(null, ports.sort((a,b) => a.port - b.port).slice(0,80));
    });
  } else {
    exec("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null", { shell:'/bin/bash', timeout:8000 }, (err, stdout) => {
      if (err && !stdout) return cb(err);
      const ports = [], seen = new Set();
      (stdout||'').split('\n').forEach(line => {
        const m = line.match(/[:\s](\d{2,5})\s/);
        const pidM = line.match(/pid=(\d+)/);
        if (m) {
          const port = parseInt(m[1]), pid = pidM ? parseInt(pidM[1]) : null;
          if (!seen.has(port) && port > 0 && port < 65536) {
            seen.add(port);
            ports.push({ port, state:'LISTENING', pid, dev: DEV_PORTS.has(port) });
          }
        }
      });
      cb(null, ports.sort((a,b) => a.port - b.port).slice(0,80));
    });
  }
}

// ─── NVM VERSION DETECTOR ─────────────────────────────────────────────────────
function getNvmVersions(cb) {
  const isWin = process.platform === 'win32';
  const { exec } = require('child_process');

  const parseVersions = (stdout) => {
    const lines = (stdout || '').split('\n');
    const versions = [];
    if (isWin) {
      // nvm-windows output:  "    24.14.0" or "  * 22.22.1 (Currently using 64-bit executable)"
      lines.forEach(line => {
        // Strip ANSI escape codes
        const clean = line.replace(/\x1b\[[0-9;]*m/g, '').replace(/[^\x20-\x7E]/g, '');
        const isCurrent = clean.includes('*');
        const match = clean.match(/(\d+\.\d+\.\d+)/);
        if (match) {
          versions.push({ version: match[1], current: isCurrent, lts: getLtsName(match[1]) });
        }
      });
    } else {
      lines.forEach(line => {
        const clean = line.replace(/\x1b\[[0-9;]*m/g, '');
        const isCurrent = clean.includes('->');
        const match = clean.match(/v?(\d+\.\d+\.\d+)/);
        if (match) {
          const ltsMatch = clean.match(/lts\/(\w+)/i);
          versions.push({ version: match[1], current: isCurrent, lts: ltsMatch ? ltsMatch[1] : getLtsName(match[1]) });
        }
      });
    }
    return versions;
  };

  // Get node + npm versions
  const getToolVersions = () => {
    const { execSync } = require('child_process');
    let nodeVer = '', npmVer = '';
    try { nodeVer = execSync('node --version', { timeout: 3000, windowsHide: true }).toString().trim(); } catch(e) {}
    try { npmVer  = execSync('npm --version',  { timeout: 3000, windowsHide: true }).toString().trim(); } catch(e) {}
    return { nodeVer, npmVer };
  };

  if (isWin) {
    // shell:true is the key — lets exec find cmd.exe/nvm via PATH
    exec('nvm list', { timeout: 8000, env: process.env, shell: true, windowsHide: true }, (err, stdout) => {
      if (err && !stdout) return cb(new Error('nvm not found. Make sure nvm-windows is installed.'));
      const versions = parseVersions(stdout);
      cb(null, { versions, isWin, ...getToolVersions() });
    });
  } else {
    const cmd = 'source ~/.nvm/nvm.sh 2>/dev/null; source ~/.config/nvm/nvm.sh 2>/dev/null; nvm ls --no-colors 2>/dev/null';
    exec(cmd, { timeout: 8000, env: process.env, shell: '/bin/bash' }, (err, stdout) => {
      if (err && !stdout) return cb(new Error('nvm not found.'));
      const versions = parseVersions(stdout);
      cb(null, { versions, isWin, ...getToolVersions() });
    });
  }
}

// Rough LTS name mapping by major version
function getLtsName(versionStr) {
  const major = parseInt(versionStr.split('.')[0]);
  const ltsMap = { 20: 'Iron', 18: 'Hydrogen', 22: 'Jod', 16: 'Gallium', 14: 'Fermium' };
  return ltsMap[major] || null;
}

// ─── WORKSPACE MANAGER ────────────────────────────────────────────────────────
const os = require('os');
const WORKSPACES_PATH = path.join(os.homedir(), '.nodectrl', 'workspaces.json');

function loadWorkspaces() {
  try { return JSON.parse(fs.readFileSync(WORKSPACES_PATH, 'utf8')); } catch(e) { return []; }
}

function saveWorkspaces(list) {
  const dir = path.dirname(WORKSPACES_PATH);
  try { fs.mkdirSync(dir, { recursive: true }); } catch(e) {}
  fs.writeFileSync(WORKSPACES_PATH, JSON.stringify(list, null, 2), 'utf8');
}

// ─── GIT INFO ─────────────────────────────────────────────────────────────────
function getGitInfo(dir, cb) {
  const { exec } = require('child_process');
  const isWin = process.platform === 'win32';
  const q = isWin ? '"' : "'";

  const checkGit = (d) => {
    try { return fs.statSync(path.join(d, '.git')).isDirectory(); } catch(e) { return false; }
  };

  let gitDir = dir, found = checkGit(gitDir);
  if (!found) {
    let parent = path.dirname(gitDir);
    while (parent !== gitDir && !found) {
      if (checkGit(parent)) { gitDir = parent; found = true; }
      else { gitDir = parent; parent = path.dirname(gitDir); }
    }
  }
  if (!found) return cb(null, { isGit: false });

  const run = (cmd, done) => exec(cmd, { timeout: 5000, shell: true }, (_e, out) => done((out || '').trim()));

  run(`git -C ${q}${gitDir}${q} rev-parse --abbrev-ref HEAD`, branch => {
    run(`git -C ${q}${gitDir}${q} status --short`, status => {
      run(`git -C ${q}${gitDir}${q} log --oneline -5`, log => {
        const changes = status.split('\n').filter(l => l.trim());
        const commits = log.split('\n').filter(l => l.trim()).map(l => {
          const sp = l.indexOf(' ');
          return { hash: l.slice(0, sp), msg: l.slice(sp + 1) };
        });
        cb(null, { isGit: true, gitDir, branch, clean: changes.length === 0, changes, commits });
      });
    });
  });
}

// ─── DEPENDENCY ANALYZER ──────────────────────────────────────────────────────
function getDepsInfo(dir, cb) {
  const { exec } = require('child_process');
  const pkgPath = path.join(dir, 'package.json');
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); }
  catch(e) { return cb(new Error('No package.json found in ' + dir)); }

  const deps = {};
  Object.entries(pkg.dependencies    || {}).forEach(([n, v]) => { deps[n] = { name: n, declared: v, type: 'prod' }; });
  Object.entries(pkg.devDependencies || {}).forEach(([n, v]) => { deps[n] = { name: n, declared: v, type: 'dev'  }; });

  exec('npm outdated --json', { cwd: dir, timeout: 30000, shell: true }, (_e, stdout) => {
    let outdated = {};
    try { outdated = JSON.parse(stdout || '{}'); } catch(e) {}
    Object.entries(outdated).forEach(([name, info]) => {
      if (deps[name]) {
        deps[name].current  = info.current;
        deps[name].wanted   = info.wanted;
        deps[name].latest   = info.latest;
        deps[name].outdated = !!info.current && info.current !== info.latest;
      }
    });

    exec('npm audit --json', { cwd: dir, timeout: 30000, shell: true }, (_e2, stdout2) => {
      let audit = {};
      try { audit = JSON.parse(stdout2 || '{}'); } catch(e) {}
      const vulns = audit.vulnerabilities || {};
      Object.entries(vulns).forEach(([name, info]) => {
        if (deps[name]) {
          deps[name].vulnerable = true;
          deps[name].severity   = info.severity || 'low';
        }
      });
      const meta = (audit.metadata || {}).vulnerabilities || {};
      cb(null, { deps: Object.values(deps), auditSummary: meta });
    });
  });
}

// ─── PROCESS MONITOR ──────────────────────────────────────────────────────────
function getProcessList(cb) {
  const { exec } = require('child_process');
  const isWin = process.platform === 'win32';

  if (isWin) {
    const cmd = `powershell -NoProfile -Command "Get-Process | Select-Object Name,Id,@{N='CPU';E={[math]::Round($_.CPU,1)}},@{N='Mem';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Sort-Object CPU -Descending | Select-Object -First 40 | ConvertTo-Json -Compress"`;
    exec(cmd, { timeout: 12000, windowsHide: true }, (_err, stdout) => {
      let procs = [];
      try {
        const raw = JSON.parse((stdout || '').trim());
        const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        procs = arr.map(p => ({ name: p.Name || '', pid: p.Id || 0, cpu: p.CPU || 0, mem: p.Mem || 0 }));
      } catch(e) {}
      cb(null, procs);
    });
  } else {
    exec('ps aux --sort=-%cpu 2>/dev/null | head -41', { shell: '/bin/bash', timeout: 8000 }, (err, stdout) => {
      if (err && !stdout) return cb(err);
      const procs = (stdout || '').split('\n').slice(1).filter(l => l.trim()).map(l => {
        const p = l.trim().split(/\s+/);
        return { name: p.slice(10).join(' ').slice(0, 50), pid: parseInt(p[1])||0, cpu: parseFloat(p[2])||0, mem: parseFloat(p[3])||0 };
      }).filter(p => p.pid);
      cb(null, procs);
    });
  }
}

// ─── LOG FILE FINDER ──────────────────────────────────────────────────────────
function findLogFiles(dir) {
  const results = [];
  const LOG_DIRS = ['logs', 'log', '.logs'];
  try {
    fs.readdirSync(dir).forEach(f => {
      if (f.endsWith('.log')) {
        try {
          const full = path.join(dir, f);
          const s = fs.statSync(full);
          if (s.isFile()) results.push({ name: f, path: full, size: s.size, mtime: s.mtime });
        } catch(e) {}
      }
    });
    LOG_DIRS.forEach(ld => {
      try {
        fs.readdirSync(path.join(dir, ld)).forEach(f => {
          if (f.endsWith('.log') || f.endsWith('.txt')) {
            try {
              const full = path.join(dir, ld, f);
              const s = fs.statSync(full);
              if (s.isFile()) results.push({ name: `${ld}/${f}`, path: full, size: s.size, mtime: s.mtime });
            } catch(e) {}
          }
        });
      } catch(e) {}
    });
  } catch(e) {}
  return results.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

// ─── START ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n  ⬡  NodeCtrl running at http://localhost:${PORT}\n`);
  console.log(`  Working directory: ${process.cwd()}`);
  console.log(`  Press Ctrl+C to stop\n`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${PORT} in use. Try: PORT=3001 node server/index.js\n`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
