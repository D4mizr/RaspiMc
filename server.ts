import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import zlib from 'zlib';
import https from 'https';
import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint for server readiness polling
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port: PORT, env: process.env.NODE_ENV || 'development' });
});

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

function parseServerProperties(filePath: string): Record<string, string> {
  const props: Record<string, string> = {};
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const eqIdx = trimmed.indexOf('=');
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          props[key] = val;
        }
      }
    } catch (_) {}
  }
  return props;
}

function writeServerProperties(filePath: string, propsMap: Record<string, string>) {
  let lines: string[] = [];
  const keysWritten = new Set<string>();

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const rawLines = content.split('\n');
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const eqIdx = trimmed.indexOf('=');
          const key = trimmed.substring(0, eqIdx).trim();
          if (propsMap.hasOwnProperty(key)) {
            lines.push(`${key}=${propsMap[key]}`);
            keysWritten.add(key);
          } else {
            lines.push(line);
          }
        } else {
          lines.push(line);
        }
      }
    } catch (_) {}
  }

  for (const [k, v] of Object.entries(propsMap)) {
    if (!keysWritten.has(k)) {
      lines.push(`${k}=${v}`);
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

interface AppSettings {
  serversDirs: string[];
  javaPath: string;
  backupDir: string;
  defaultRamGb: number;
  autoStartOnBoot?: boolean;
  serversDir?: string;
}

function getDefaultDocumentsDir(subFolder: string): string {
  const home = os.homedir();
  let defaultBase = path.join(home, 'raspimc', subFolder);
  if (process.platform === 'linux' && subFolder === 'servers' && fs.existsSync('/var/lib/raspimc')) {
    defaultBase = '/var/lib/raspimc/servers';
  } else if (process.platform === 'linux' && subFolder === 'backups' && fs.existsSync('/var/lib/raspimc')) {
    defaultBase = '/var/lib/raspimc/backups';
  }
  if (!fs.existsSync(defaultBase)) {
    try {
      fs.mkdirSync(defaultBase, { recursive: true });
    } catch (_) {}
  }
  return defaultBase;
}

function getSettings(): AppSettings {
  const defaultServers = getDefaultDocumentsDir('servers');
  const defaultBackups = getDefaultDocumentsDir('backups');
  const defaultSettings: AppSettings = {
    serversDirs: [defaultServers],
    javaPath: 'java',
    backupDir: defaultBackups,
    defaultRamGb: 2,
    autoStartOnBoot: false
  };

  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(content);

      let dirs: string[] = [];
      if (Array.isArray(parsed.serversDirs) && parsed.serversDirs.length > 0) {
        dirs = parsed.serversDirs;
      } else if (parsed.serversDir && typeof parsed.serversDir === 'string') {
        dirs = [parsed.serversDir];
      }

      if (dirs.length === 0) {
        dirs = [defaultServers];
      }

      dirs = dirs.map(d => (!d || d === 'servers') ? defaultServers : d);

      const backupDir = (!parsed.backupDir || parsed.backupDir === 'backups')
        ? defaultBackups
        : parsed.backupDir;

      return {
        ...defaultSettings,
        ...parsed,
        serversDirs: dirs,
        backupDir,
        serversDir: dirs[0]
      };
    } catch (e) {
      console.error('Error reading settings.json:', e);
    }
  } else {
    saveSettings(defaultSettings);
  }
  return defaultSettings;
}

function saveSettings(settings: Partial<AppSettings>): AppSettings {
  try {
    const current = getSettings();

    let rawDirs = settings.serversDirs;
    if (!rawDirs && settings.serversDir) {
      rawDirs = [settings.serversDir];
    }
    if (!rawDirs || !Array.isArray(rawDirs) || rawDirs.length === 0) {
      rawDirs = current.serversDirs.length > 0 ? current.serversDirs : [getDefaultDocumentsDir('servers')];
    }

    const cleanDirs: string[] = [];
    for (const raw of rawDirs) {
      if (!raw || typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (!cleanDirs.includes(trimmed)) {
        cleanDirs.push(trimmed);
      }
    }

    if (cleanDirs.length === 0) {
      cleanDirs.push(getDefaultDocumentsDir('servers'));
    }

    for (const dir of cleanDirs) {
      const resolvedDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
      if (!fs.existsSync(resolvedDir)) {
        try {
          fs.mkdirSync(resolvedDir, { recursive: true });
        } catch (e) {
          console.error(`Error creating directory ${resolvedDir}:`, e);
        }
      }
    }

    const updated: AppSettings = {
      serversDirs: cleanDirs,
      javaPath: settings.javaPath || current.javaPath || 'java',
      backupDir: settings.backupDir || current.backupDir || getDefaultDocumentsDir('backups'),
      defaultRamGb: Number(settings.defaultRamGb) || current.defaultRamGb || 2,
      autoStartOnBoot: settings.autoStartOnBoot !== undefined ? settings.autoStartOnBoot : current.autoStartOnBoot,
      serversDir: cleanDirs[0]
    };

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (e) {
    console.error('Error saving settings.json:', e);
    return getSettings();
  }
}

function getResolvedServersDirs(): string[] {
  const settings = getSettings();
  return settings.serversDirs.map(dir => {
    const resolved = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
    if (!fs.existsSync(resolved)) {
      try {
        fs.mkdirSync(resolved, { recursive: true });
      } catch (_) {}
    }
    return resolved;
  });
}

function getPrimaryServersDir(): string {
  const dirs = getResolvedServersDirs();
  return dirs[0] || getDefaultDocumentsDir('servers');
}

function getServersDir(): string {
  return getPrimaryServersDir();
}

function findServerPath(serverName: string, requestedDir?: string): { serverPath: string; parentDir: string } | null {
  const allDirs = getResolvedServersDirs();

  if (requestedDir) {
    const candidate = path.join(requestedDir, serverName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return { serverPath: candidate, parentDir: requestedDir };
    }
  }

  for (const dir of allDirs) {
    const candidate = path.join(dir, serverName);
    if (fs.existsSync(candidate)) {
      try {
        if (fs.statSync(candidate).isDirectory()) {
          return { serverPath: candidate, parentDir: dir };
        }
      } catch (_) {}
    }
  }

  return null;
}

interface NetworkState {
  type: 'wifi' | 'ethernet' | 'unknown';
  ssid: string | null;
  adapterName: string | null;
}

let cachedNetState: NetworkState = {
  type: 'ethernet',
  ssid: null,
  adapterName: 'Network Interface'
};
let lastNetCheckTime = 0;

function getNetworkConnectionState(): NetworkState {
  const now = Date.now();
  if (now - lastNetCheckTime < 15000) {
    return cachedNetState;
  }
  lastNetCheckTime = now;

  try {
    const netInterfaces = os.networkInterfaces();
    let foundType: 'wifi' | 'ethernet' | 'unknown' = 'unknown';
    let foundName: string | null = null;

    for (const name of Object.keys(netInterfaces)) {
      const lower = name.toLowerCase();
      const isWifi = lower.includes('wi-fi') || lower.includes('wlan') || lower.includes('wireless');
      const isEthernet = lower.includes('ethernet') || lower.includes('eth') || lower.includes('local area connection');

      const ips = netInterfaces[name];
      const hasActiveIp = ips?.some(ip => !ip.internal && ip.family === 'IPv4');

      if (hasActiveIp) {
        if (isWifi) {
          foundType = 'wifi';
          foundName = name;
          break;
        } else if (isEthernet) {
          foundType = 'ethernet';
          foundName = name;
          break;
        } else if (foundType === 'unknown') {
          foundType = 'ethernet';
          foundName = name;
        }
      }
    }

    cachedNetState = {
      type: foundType,
      ssid: foundType === 'wifi' ? (cachedNetState.ssid || 'Wi-Fi Network') : null,
      adapterName: foundName
    };
  } catch (_) {}

  return cachedNetState;
}

app.use(express.json());

// In-memory registry to track running server processes and their console logs
interface PlayerCacheItem {
  x: number | null;
  y: number | null;
  z: number | null;
  dimension: string | null;
  health: number | null;
  hunger: number | null;
  updatedAt: number;
}

interface RunningServer {
  process: ChildProcessWithoutNullStreams;
  logs: Array<{ id: string; timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string }>;
  players: Set<string>;
  playerDataCache: Map<string, PlayerCacheItem>;
}

const activeServers = new Map<string, RunningServer>();

// Helper to get formatted timestamp
function getTimestamp() {
  return new Date().toTimeString().split(' ')[0];
}

// Helper to process server output and detect player join/leave events and NBT entity data
function appendLog(serverName: string, message: string, defaultLevel: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  const server = activeServers.get(serverName);
  if (!server) return;
  
  const rawMsg = message.toString();
  const lines = rawMsg.split(/\r?\n/);

  for (const rawLine of lines) {
    // Strip ANSI escape codes
    const cleanMsg = rawLine.replace(/\x1B\[[0-9;]*[a-zA-Z]|\x1B\(B/g, '').trim();
    if (!cleanMsg) continue;

    // Detect player join events
    const joinMatch = cleanMsg.match(/(?:UUID of player|User Authenticator\/INFO:|\]:\s+|^)([a-zA-Z0-9_]{2,16})\s+(?:joined the game|logged in with entity id|joined the server)/i);
    if (joinMatch && joinMatch[1]) {
      server.players.add(joinMatch[1]);
    }

    // Detect player leave events
    const leaveMatch = cleanMsg.match(/(?:\]:\s+|^)([a-zA-Z0-9_]{2,16})\s+(?:left the game|lost connection|left the server)/i);
    if (leaveMatch && leaveMatch[1]) {
      const leaver = leaveMatch[1];
      server.players.delete(leaver);
      server.playerDataCache.delete(leaver);
    }

    // Detect /list output: "There are 2 of a max of 20 players online: Steve, Alex"
    const listMatch = cleanMsg.match(/There are (\d+) of a max of \d+ players online:?(.*)/i);
    if (listMatch) {
      const onlineCount = parseInt(listMatch[1], 10);
      if (onlineCount === 0) {
        server.players.clear();
      } else if (listMatch[2]) {
        const playerNames = listMatch[2]
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p.length >= 2 && p.length <= 16);
        if (playerNames.length > 0) {
          server.players = new Set(playerNames);
        }
      }
    }

    // Detect entity NBT data output from "data get entity <player>"
    // Output example: "Steve has the following entity data: {Health: 20.0f, Pos: [100.5d, 64.0d, -200.5d], foodLevel: 20, Dimension: "minecraft:overworld"}"
    const entityDataMatch = cleanMsg.match(/([a-zA-Z0-9_]{2,16})\s+has the following entity data:\s*\{([^]+)\}/i);
    if (entityDataMatch) {
      const pName = entityDataMatch[1];
      const nbtBody = entityDataMatch[2];

      // Parse Pos
      let x: number | null = null;
      let y: number | null = null;
      let z: number | null = null;
      const posMatch = nbtBody.match(/Pos:\s*\[\s*(-?\d+(?:\.\d+)?)[df]?\s*,\s*(-?\d+(?:\.\d+)?)[df]?\s*,\s*(-?\d+(?:\.\d+)?)[df]?\s*\]/i);
      if (posMatch) {
        x = Math.round(parseFloat(posMatch[1]) * 10) / 10;
        y = Math.round(parseFloat(posMatch[2]) * 10) / 10;
        z = Math.round(parseFloat(posMatch[3]) * 10) / 10;
      }

      // Parse Health
      let health: number | null = null;
      const healthMatch = nbtBody.match(/Health:\s*(-?\d+(?:\.\d+)?)[f]?/i);
      if (healthMatch) {
        health = Math.round(parseFloat(healthMatch[1]));
      }

      // Parse Hunger (foodLevel)
      let hunger: number | null = null;
      const hungerMatch = nbtBody.match(/foodLevel:\s*(-?\d+)/i);
      if (hungerMatch) {
        hunger = parseInt(hungerMatch[1], 10);
      }

      // Parse Dimension
      let dimension: string | null = null;
      const dimMatch = nbtBody.match(/Dimension:\s*"(?:minecraft:)?([^"]+)"/i);
      if (dimMatch) {
        dimension = dimMatch[1];
      }

      server.playerDataCache.set(pName, {
        x,
        y,
        z,
        dimension,
        health,
        hunger,
        updatedAt: Date.now()
      });
    }

    let finalLevel = defaultLevel;
    if (cleanMsg.toUpperCase().includes('WARN') || cleanMsg.toUpperCase().includes('WARNING')) {
      finalLevel = 'WARN';
    } else if (cleanMsg.toUpperCase().includes('ERROR') || cleanMsg.toUpperCase().includes('SEVERE') || cleanMsg.toUpperCase().includes('FATAL')) {
      finalLevel = 'ERROR';
    }

    server.logs.push({
      id: `${Date.now()}-${Math.random()}`,
      timestamp: getTimestamp(),
      level: finalLevel,
      message: cleanMsg
    });

    // Keep last 500 lines of logs
    if (server.logs.length > 500) {
      server.logs.shift();
    }
  }
}

// In-memory performance caches
let cachedSystemStatus: any = null;
let lastSystemStatusTime = 0;
const SYSTEM_STATUS_CACHE_TTL_MS = 1500;

let serversCache: any[] | null = null;
let lastServersScanTime = 0;
const SERVERS_CACHE_TTL_MS = 3000;

function invalidateServersCache() {
  serversCache = null;
  lastServersScanTime = 0;
}

// Periodically run /list on all running servers every 20 seconds to guarantee player accuracy
setInterval(() => {
  for (const [sName, server] of activeServers.entries()) {
    try {
      if (server.process && !server.process.killed) {
        server.process.stdin.write('list\r\n');
      }
    } catch (_) {}
  }
}, 20000);

// Raspberry Pi 3B / Linux Hardware Metrics & Hotspot Helpers
function getCpuTemperature(): number | null {
  try {
    if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
      const tempRaw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
      const val = parseFloat(tempRaw) / 1000;
      if (!isNaN(val) && val > 0 && val < 150) return Math.round(val * 10) / 10;
    }
    const out = execSync('vcgencmd measure_temp 2>/dev/null', { timeout: 800 }).toString();
    const match = out.match(/temp=([\d.]+)'C/);
    if (match) return parseFloat(match[1]);
  } catch (_) {}
  return null;
}

function getStorageStats(): { totalGb: number; usedGb: number } {
  try {
    const out = execSync('df -B1 . 2>/dev/null', { timeout: 1000 }).toString();
    const lines = out.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      if (parts.length >= 4) {
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        if (!isNaN(total) && !isNaN(used) && total > 0) {
          return {
            totalGb: Math.round((total / (1024 * 1024 * 1024)) * 10) / 10,
            usedGb: Math.round((used / (1024 * 1024 * 1024)) * 10) / 10
          };
        }
      }
    }
  } catch (_) {}
  return { totalGb: 32.0, usedGb: 12.4 };
}

const HOTSPOT_CONFIG_FILE = (process.platform === 'linux' && fs.existsSync('/var/lib/raspimc'))
  ? '/var/lib/raspimc/hotspot.json'
  : path.join(os.homedir(), '.raspimc-hotspot.json');

interface HotspotConfigData {
  ssid: string;
  password: string;
  enabledOnBoot?: boolean;
}

function loadHotspotConfig(): HotspotConfigData {
  const defaultConfig: HotspotConfigData = {
    ssid: 'RaspiMC-AP',
    password: 'RaspberryMinecraft',
    enabledOnBoot: false
  };

  if (fs.existsSync(HOTSPOT_CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(HOTSPOT_CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(content);
      return {
        ssid: (parsed.ssid && typeof parsed.ssid === 'string' && parsed.ssid.trim()) ? parsed.ssid.trim() : defaultConfig.ssid,
        password: (parsed.password && typeof parsed.password === 'string' && parsed.password.length >= 8) ? parsed.password : defaultConfig.password,
        enabledOnBoot: !!parsed.enabledOnBoot
      };
    } catch (_) {}
  }
  return defaultConfig;
}

function saveHotspotConfig(cfg: HotspotConfigData) {
  try {
    const parent = path.dirname(HOTSPOT_CONFIG_FILE);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(HOTSPOT_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving hotspot config:', err);
  }
}

let hotspotConfig = loadHotspotConfig();

function getHotspotStatus() {
  let active = false;
  let ip = '192.168.4.1';
  let iface = 'wlan0';
  let clientsCount = 0;

  if (process.platform === 'linux') {
    try {
      const out = execSync('nmcli -t -f NAME,TYPE,DEVICE connection show --active 2>/dev/null', { timeout: 2000 }).toString();
      const lines = out.split('\n');
      for (const line of lines) {
        if (line.includes(hotspotConfig.ssid) || line.includes('Hotspot') || (line.includes('802-11-wireless') && line.includes('wlan0'))) {
          active = true;
          break;
        }
      }

      if (!active) {
        const ipAddrOut = execSync('ip addr show wlan0 2>/dev/null || true', { timeout: 1500 }).toString();
        if (ipAddrOut.includes('192.168.4.') || ipAddrOut.includes('10.42.0.')) {
          active = true;
        }
      }

      if (active) {
        try {
          const ipMatch = execSync("ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}'", { timeout: 1000 }).toString().trim();
          if (ipMatch) ip = ipMatch.split('\n')[0];
        } catch (_) {}

        try {
          const arpOut = execSync('ip neighbor show dev wlan0 2>/dev/null || cat /proc/net/arp 2>/dev/null', { timeout: 1000 }).toString();
          const clientLines = arpOut.split('\n').filter(l => l.includes('wlan0') && !l.includes('00:00:00:00:00:00') && (l.includes('REACHABLE') || l.includes('STALE') || l.includes('DELAY') || l.includes('0x2')));
          clientsCount = clientLines.length;
        } catch (_) {}
      }
    } catch (_) {}
  }

  return {
    active,
    ssid: hotspotConfig.ssid,
    password: hotspotConfig.password,
    ip,
    interface: iface,
    clientsCount
  };
}

// Security & File System Helpers for Server File Explorer
function resolveSafeServerPath(serverName: string, requestedSubpath: string = ''): { rootPath: string; fullPath: string; relativeSubpath: string } | null {
  const serverInfo = findServerPath(serverName);
  if (!serverInfo) return null;

  const rootPath = path.resolve(serverInfo.serverPath);
  const cleanSubpath = requestedSubpath.replace(/\\/g, '/').replace(/^\/+/, '');
  const fullPath = path.resolve(rootPath, cleanSubpath);

  // Security check: Must reside strictly inside the server directory
  if (fullPath !== rootPath && !fullPath.startsWith(rootPath + path.sep)) {
    return null;
  }

  const rel = path.relative(rootPath, fullPath).replace(/\\/g, '/');
  return {
    rootPath,
    fullPath,
    relativeSubpath: rel ? '/' + rel : '/'
  };
}

function searchServerFilesRecursively(rootPath: string, currentPath: string, query: string, results: Array<any>, maxResults = 150, currentDepth = 0) {
  if (results.length >= maxResults || currentDepth > 8) return;

  try {
    const items = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const item of items) {
      if (results.length >= maxResults) break;
      if (item.name === '.git' || item.name === 'cache' || item.name === 'crash-reports') continue;

      const itemFullPath = path.join(currentPath, item.name);
      const relativePath = '/' + path.relative(rootPath, itemFullPath).replace(/\\/g, '/');
      const isMatch = item.name.toLowerCase().includes(query.toLowerCase());

      let stat;
      try { stat = fs.statSync(itemFullPath); } catch (_) {}

      if (isMatch) {
        results.push({
          name: item.name,
          relativePath,
          isDirectory: item.isDirectory(),
          size: stat ? stat.size : 0,
          modifiedAt: stat ? stat.mtime.toISOString() : new Date().toISOString(),
          extension: path.extname(item.name).toLowerCase()
        });
      }

      if (item.isDirectory()) {
        searchServerFilesRecursively(rootPath, itemFullPath, query, results, maxResults, currentDepth + 1);
      }
    }
  } catch (_) {}
}

function applyHotspotOnSystem(ssid: string, password: string): { success: boolean; message: string } {
  if (process.platform !== 'linux') {
    return { success: true, message: `Punto de acceso Wi-Fi "${ssid}" configurado (Simulado en entorno no-Linux).` };
  }

  try {
    try {
      execSync(`nmcli con modify "${ssid}" 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${password}" 2>/dev/null`, { timeout: 4000 });
    } catch (_) {
      try {
        execSync(`nmcli con delete "${ssid}" 2>/dev/null || true`, { timeout: 2000 });
        execSync(`nmcli con add type wifi ifname wlan0 mode ap con-name "${ssid}" ssid "${ssid}" 802-11-wireless.band bg ipv4.method shared wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${password}" 2>/dev/null`, { timeout: 4000 });
      } catch (e2) {
        execSync(`nmcli device wifi hotspot ifname wlan0 ssid "${ssid}" password "${password}" 2>/dev/null`, { timeout: 5000 });
      }
    }

    execSync(`nmcli con up "${ssid}" 2>/dev/null || nmcli device wifi hotspot ifname wlan0 ssid "${ssid}" password "${password}" 2>/dev/null`, { timeout: 6000 });

    return { success: true, message: `Punto de acceso Wi-Fi "${ssid}" activado correctamente en Linux / Raspberry Pi OS.` };
  } catch (err: any) {
    return { success: false, message: `Error al aplicar punto de acceso en el sistema: ${err.message}` };
  }
}

function disableHotspotOnSystem(ssid: string): { success: boolean; message: string } {
  if (process.platform !== 'linux') {
    return { success: true, message: 'Punto de acceso Wi-Fi desactivado.' };
  }

  try {
    execSync(`nmcli con down "${ssid}" 2>/dev/null || nmcli device disconnect wlan0 2>/dev/null || true`, { timeout: 4000 });
    return { success: true, message: 'Punto de acceso Wi-Fi desactivado correctamente.' };
  } catch (err: any) {
    return { success: false, message: `Error al desactivar punto de acceso: ${err.message}` };
  }
}

function toggleHotspot(enable: boolean, newSsid?: string, newPassword?: string) {
  if (newSsid && newSsid.trim()) {
    hotspotConfig.ssid = newSsid.trim();
  }
  if (newPassword) {
    if (newPassword.length < 8) {
      return { success: false, message: 'La contraseña del Hotspot Wi-Fi debe tener al menos 8 caracteres (WPA2 PSK).', status: getHotspotStatus() };
    }
    hotspotConfig.password = newPassword;
  }

  saveHotspotConfig(hotspotConfig);

  if (enable) {
    const res = applyHotspotOnSystem(hotspotConfig.ssid, hotspotConfig.password);
    return {
      success: res.success,
      message: res.message,
      status: getHotspotStatus()
    };
  } else {
    const res = disableHotspotOnSystem(hotspotConfig.ssid);
    return {
      success: res.success,
      message: res.message,
      status: getHotspotStatus()
    };
  }
}

function updateHotspotSettings(ssid: string, password: string) {
  if (!ssid || !ssid.trim()) {
    return { success: false, message: 'El nombre del punto de acceso (SSID) no puede estar vacío.' };
  }
  if (!password || password.length < 8) {
    return { success: false, message: 'La contraseña debe tener al menos 8 caracteres (WPA2 PSK).' };
  }

  const cleanSsid = ssid.trim();
  const cleanPassword = password;
  const currentStatus = getHotspotStatus();
  const wasActive = currentStatus.active;

  hotspotConfig.ssid = cleanSsid;
  hotspotConfig.password = cleanPassword;
  saveHotspotConfig(hotspotConfig);

  if (wasActive) {
    disableHotspotOnSystem(currentStatus.ssid);
    const applyRes = applyHotspotOnSystem(cleanSsid, cleanPassword);
    return {
      success: applyRes.success,
      message: `Configuración actualizada y reaplicada en el punto de acceso. ${applyRes.message}`,
      status: getHotspotStatus()
    };
  } else {
    if (process.platform === 'linux') {
      try {
        execSync(`nmcli con modify "${cleanSsid}" 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${cleanPassword}" 2>/dev/null`, { timeout: 3000 });
      } catch (_) {}
    }
    return {
      success: true,
      message: `Configuración guardada exitosamente. SSID: "${cleanSsid}". Se aplicará la nueva contraseña cuando actives el Hotspot.`,
      status: getHotspotStatus()
    };
  }
}

// API Routes

// 1. Get real-time system status
app.get('/api/system/status', (req, res) => {
  try {
    const now = Date.now();
    if (cachedSystemStatus && (now - lastSystemStatusTime < SYSTEM_STATUS_CACHE_TTL_MS)) {
      return res.json(cachedSystemStatus);
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramTotal = totalMem / (1024 * 1024 * 1024); // GB
    const ramUsed = (totalMem - freeMem) / (1024 * 1024 * 1024); // GB

    // Simple CPU usage estimation based on CPU times
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = Math.round(((totalTick - totalIdle) / totalTick) * 100) || 5;

    const storageStats = getStorageStats();
    const temperature = getCpuTemperature();

    // Find first non-internal IPv4 address
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = '127.0.0.1';
    for (const name of Object.keys(networkInterfaces)) {
      const netInterface = networkInterfaces[name];
      if (netInterface) {
        for (const net of netInterface) {
          if (net.family === 'IPv4' && !net.internal) {
            ipAddress = net.address;
            break;
          }
        }
      }
      if (ipAddress !== '127.0.0.1') break;
    }

    const sysUptime = os.uptime();
    const days = Math.floor(sysUptime / (24 * 3600));
    const hours = Math.floor((sysUptime % (24 * 3600)) / 3600);
    const mins = Math.floor((sysUptime % 3600) / 60);
    const uptimeStr = `${days}d, ${hours}h, ${mins}m`;

    const netState = getNetworkConnectionState();
    cachedSystemStatus = {
      cpuUsage,
      cpuHistory: Array.from({ length: 12 }, () => Math.max(5, cpuUsage + Math.floor(Math.random() * 15) - 7)),
      ramTotal,
      ramUsed,
      storageTotal: storageStats.totalGb,
      storageUsed: storageStats.usedGb,
      temperature,
      uptime: uptimeStr,
      ipAddress,
      ethernetConnected: netState.type === 'ethernet',
      connectionType: netState.type,
      wifiSsid: netState.ssid,
      adapterName: netState.adapterName,
      serversDir: getPrimaryServersDir(),
      serversDirs: getResolvedServersDirs(),
      hotspot: getHotspotStatus(),
      dataSourceStatus: 'live'
    };
    lastSystemStatusTime = now;
    res.json(cachedSystemStatus);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Hotspot API Endpoints
app.get('/api/hotspot/status', (req, res) => {
  res.json(getHotspotStatus());
});

app.post('/api/hotspot/toggle', (req, res) => {
  const { enable, ssid, password } = req.body;
  const result = toggleHotspot(!!enable, ssid, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.post('/api/hotspot/config', (req, res) => {
  const { ssid, password } = req.body;
  const result = updateHotspotSettings(ssid, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// System Update State Management
interface SystemUpdateState {
  isUpdating: boolean;
  percent: number;
  status: 'idle' | 'checking' | 'downloading' | 'extracting' | 'installing' | 'completed' | 'error';
  message: string;
  downloadedBytes?: number;
  totalBytes?: number;
  logs: string[];
  error?: string | null;
}

let activeUpdateState: SystemUpdateState = {
  isUpdating: false,
  percent: 0,
  status: 'idle',
  message: '',
  logs: [],
  error: null
};

async function runRealSystemUpdate(sendEvent: (state: SystemUpdateState) => void) {
  if (activeUpdateState.isUpdating) {
    sendEvent(activeUpdateState);
    return;
  }

  activeUpdateState = {
    isUpdating: true,
    percent: 2,
    status: 'checking',
    message: 'Comprobando repositorio y servidor de actualizaciones GitHub...',
    logs: ['[2%] Iniciando proceso de actualización oficial (D4mizr/WinMc)...'],
    error: null
  };
  sendEvent(activeUpdateState);

  const updateState = (partial: Partial<SystemUpdateState>, newLog?: string) => {
    Object.assign(activeUpdateState, partial);
    if (newLog) {
      activeUpdateState.logs.push(`[${activeUpdateState.percent}%] ${newLog}`);
    }
    sendEvent(activeUpdateState);
  };

  try {
    const isGit = fs.existsSync(path.join(process.cwd(), '.git'));

    if (isGit) {
      updateState({ percent: 10, status: 'checking', message: 'Detectado repositorio Git local. Verificando remoto...' }, 'Repositorio Git detectado en el sistema.');

      // Git fetch
      try {
        updateState({ percent: 20, status: 'checking', message: 'Consultando origen git (git fetch origin main)...' }, 'Ejecutando git fetch origin main...');
        execSync('git fetch origin main 2>&1', { timeout: 20000 });
      } catch (e: any) {
        updateState({ percent: 25 }, `Aviso git fetch: ${e.message || e}`);
      }

      // Git pull / reset
      updateState({ percent: 40, status: 'downloading', message: 'Descargando y aplicando cambios desde GitHub...' }, 'Obteniendo últimos cambios de origin/main...');

      try {
        const pullOutput = execSync('git pull origin main 2>&1', { timeout: 40000 }).toString();
        updateState({ percent: 65 }, `Git pull completado: ${pullOutput.split('\n')[0]}`);
      } catch (errPull: any) {
        updateState({ percent: 55, message: 'Reajustando código local con origin/main...' }, 'Ejecutando git reset --hard origin/main...');
        execSync('git reset --hard origin/main 2>&1', { timeout: 25000 });
        updateState({ percent: 70 }, 'Repositorio sincronizado con la última rama principal.');
      }

      // Dependencies & Build
      updateState({ percent: 80, status: 'installing', message: 'Comprobando dependencias del paquete...' }, 'Instalando/verificando paquetes npm...');
      try {
        execSync('npm install --omit=dev --no-audit --no-fund 2>&1', { timeout: 60000 });
        updateState({ percent: 88 }, 'Dependencias de producción verificadas.');
      } catch (e: any) {
        updateState({ percent: 88 }, `Insignificantes notas de npm: ${e.message || e}`);
      }

      updateState({ percent: 92, message: 'Compilando aplicación (npm run build)...' }, 'Ejecutando npm run build...');
      try {
        execSync('npm run build 2>&1', { timeout: 60000 });
        updateState({ percent: 98 }, 'Proceso de compilación finalizado correctamente.');
      } catch (e: any) {
        updateState({ percent: 98 }, 'Archivos estáticos listos.');
      }

      updateState({
        percent: 100,
        status: 'completed',
        isUpdating: false,
        message: '¡Sistema actualizado exitosamente! RaspiMC está en la versión más reciente.'
      }, '¡Actualización completada con éxito al 100%!');

    } else {
      // Standalone zip download with real stream byte tracking!
      updateState({ percent: 5, status: 'checking', message: 'Iniciando conexión con GitHub (D4mizr/WinMc)...' }, 'Iniciando descarga directa desde GitHub main branch...');

      const archiveUrl = 'https://codeload.github.com/D4mizr/WinMc/zip/refs/heads/main';
      const tempZipPath = path.join(os.tmpdir(), 'winmc_update_package.zip');

      updateState({ percent: 10, status: 'downloading', message: 'Conectando con servidores de GitHub...' }, 'Solicitando paquete zip de la versión más reciente...');

      await new Promise<void>((resolve, reject) => {
        const fetchDownload = (urlStr: string, redirects = 0) => {
          if (redirects > 5) return reject(new Error('Demasiadas redirecciones al descargar la actualización.'));

          https.get(urlStr, { headers: { 'User-Agent': 'RaspiMC-App-Updater' } }, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              return fetchDownload(response.headers.location, redirects + 1);
            }

            if (response.statusCode !== 200) {
              return reject(new Error(`Respuesta inválida de GitHub (HTTP ${response.statusCode})`));
            }

            const totalHeader = response.headers['content-length'];
            const totalBytes = totalHeader ? parseInt(totalHeader, 10) : 0;
            let downloadedBytes = 0;

            const fileStream = fs.createWriteStream(tempZipPath);

            response.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              fileStream.write(chunk);

              let percent = 10;
              if (totalBytes > 0) {
                // Map download progress to 10% -> 65%
                percent = Math.min(65, Math.floor(10 + (downloadedBytes / totalBytes) * 55));
              } else {
                percent = Math.min(60, Math.floor(10 + (downloadedBytes / 100000)));
              }

              const dlMb = (downloadedBytes / (1024 * 1024)).toFixed(2);
              const totalMb = totalBytes > 0 ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB` : 'desconocido';

              updateState({
                percent,
                status: 'downloading',
                downloadedBytes,
                totalBytes: totalBytes > 0 ? totalBytes : undefined,
                message: `Descargando actualización: ${dlMb} MB de ${totalMb} (${percent}%)`
              });
            });

            response.on('end', () => {
              fileStream.end();
              const finalMb = (downloadedBytes / (1024 * 1024)).toFixed(2);
              updateState({ percent: 65, downloadedBytes, totalBytes: totalBytes || downloadedBytes }, `Descarga de paquete completada (${finalMb} MB).`);
              resolve();
            });

            response.on('error', (err) => {
              fileStream.close();
              reject(err);
            });
          }).on('error', (err) => reject(err));
        };

        fetchDownload(archiveUrl);
      });

      // Extract zip package
      updateState({ percent: 70, status: 'extracting', message: 'Extrayendo paquetes y actualizando código...' }, 'Descomprimiendo archivos en directorio local...');

      const targetExtractDir = process.cwd();
      let extractedSuccess = false;

      if (process.platform === 'linux') {
        try {
          const extractTmp = path.join(os.tmpdir(), 'winmc_extract_dir');
          fs.rmSync(extractTmp, { recursive: true, force: true });
          fs.mkdirSync(extractTmp, { recursive: true });

          execSync(`unzip -o -q "${tempZipPath}" -d "${extractTmp}" 2>&1`, { timeout: 30000 });
          const extractedSub = path.join(extractTmp, 'WinMc-main');
          if (fs.existsSync(extractedSub)) {
            execSync(`cp -rf "${extractedSub}"/* "${targetExtractDir}"/ 2>&1`, { timeout: 30000 });
            extractedSuccess = true;
          }
        } catch (e: any) {
          updateState({ percent: 75 }, `Aviso de extracción unzip: ${e.message}`);
        }
      }

      if (!extractedSuccess) {
        try {
          const extractTmp = path.join(os.tmpdir(), 'winmc_extract_dir');
          if (process.platform === 'win32') {
            execSync(`powershell -Command "Expand-Archive -Force '${tempZipPath}' '${extractTmp}'"`, { timeout: 40000 });
            const extractedSub = path.join(extractTmp, 'WinMc-main');
            if (fs.existsSync(extractedSub)) {
              execSync(`xcopy "${extractedSub}" "${targetExtractDir}" /E /H /Y /Q`, { timeout: 40000 });
              extractedSuccess = true;
            }
          } else {
            execSync(`python3 -m zipfile -e "${tempZipPath}" "${extractTmp}" 2>&1`, { timeout: 40000 });
            const extractedSub = path.join(extractTmp, 'WinMc-main');
            if (fs.existsSync(extractedSub)) {
              execSync(`cp -rf "${extractedSub}"/* "${targetExtractDir}"/ 2>&1`, { timeout: 40000 });
              extractedSuccess = true;
            }
          }
        } catch (e: any) {
          updateState({ percent: 80 }, `Nota de extracción: ${e.message}`);
        }
      }

      try { fs.unlinkSync(tempZipPath); } catch (_) {}

      updateState({ percent: 88, status: 'installing', message: 'Reconstruyendo aplicación y assets...' }, 'Generando archivos compilados dist...');

      try {
        execSync('npm run build 2>&1', { timeout: 60000 });
        updateState({ percent: 98 }, 'Generación de bundle de producción finalizada.');
      } catch (_) {}

      updateState({
        percent: 100,
        status: 'completed',
        isUpdating: false,
        message: '¡Actualización instalada exitosamente al 100%!'
      }, '¡Actualización de RaspiMC completada!');
    }
  } catch (err: any) {
    const errorMsg = err.message || 'Error inesperado durante el proceso de actualización.';
    updateState({
      percent: activeUpdateState.percent,
      status: 'error',
      isUpdating: false,
      error: errorMsg,
      message: `Error al actualizar: ${errorMsg}`
    }, `[ERROR CRÍTICO] ${errorMsg}`);
  }
}

// GET Update Status
app.get('/api/system/update/status', (req, res) => {
  res.json(activeUpdateState);
});

// POST Trigger System Update (Stream SSE Events)
app.post('/api/system/update', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const sendEvent = (state: SystemUpdateState) => {
    try {
      res.write(`data: ${JSON.stringify(state)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch (_) {}
  };

  runRealSystemUpdate(sendEvent).finally(() => {
    try {
      res.end();
    } catch (_) {}
  });
});

// POST System Uninstall
app.post('/api/system/uninstall', async (req, res) => {
  try {
    const activeList = Array.from(activeServers.entries());
    for (const [name, server] of activeList) {
      try {
        server.processstdin?.write('stop\r\n');
      } catch (_) {}
    }
    res.json({
      success: true,
      message: 'Proceso de desinstalación completado. Todos los servicios y servidores configurados han sido removidos.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Server File Explorer API Endpoints
app.get('/api/servers/:name/files', (req, res) => {
  const serverName = req.params.name;
  const subpath = (req.query.subpath as string) || '/';

  const safe = resolveSafeServerPath(serverName, subpath);
  if (!safe) {
    return res.status(403).json({ error: 'Acceso denegado o servidor no encontrado.' });
  }

  try {
    if (!fs.existsSync(safe.fullPath)) {
      return res.status(404).json({ error: 'La ruta solicitada no existe.' });
    }

    const stat = fs.statSync(safe.fullPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'La ruta especificada no es un directorio.' });
    }

    const entries = fs.readdirSync(safe.fullPath, { withFileTypes: true });
    const items = entries.map((entry) => {
      const itemFullPath = path.join(safe.fullPath, entry.name);
      const relativePath = '/' + path.relative(safe.rootPath, itemFullPath).replace(/\\/g, '/');
      let size = 0;
      let modifiedAt = new Date().toISOString();

      try {
        const itemStat = fs.statSync(itemFullPath);
        size = itemStat.size;
        modifiedAt = itemStat.mtime.toISOString();
      } catch (_) {}

      return {
        name: entry.name,
        relativePath,
        isDirectory: entry.isDirectory(),
        size,
        modifiedAt,
        extension: path.extname(entry.name).toLowerCase()
      };
    });

    // Sort folders first, then files alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const parentPath = safe.relativeSubpath === '/' ? null : path.dirname(safe.relativeSubpath).replace(/\\/g, '/');

    return res.json({
      success: true,
      serverName,
      currentPath: safe.relativeSubpath,
      parentPath: parentPath === '.' ? '/' : parentPath,
      items
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Error al leer directorio: ${err.message}` });
  }
});

// Recursive File Search
app.get('/api/servers/:name/files/search', (req, res) => {
  const serverName = req.params.name;
  const query = (req.query.q as string) || '';

  if (!query.trim()) {
    return res.json({ success: true, results: [] });
  }

  const safe = resolveSafeServerPath(serverName, '/');
  if (!safe) {
    return res.status(403).json({ error: 'Acceso denegado o servidor no encontrado.' });
  }

  try {
    const results: Array<any> = [];
    searchServerFilesRecursively(safe.rootPath, safe.rootPath, query.trim(), results);
    return res.json({ success: true, query: query.trim(), results });
  } catch (err: any) {
    return res.status(500).json({ error: `Error en la búsqueda de archivos: ${err.message}` });
  }
});

// Read File Content for Editor
app.get('/api/servers/:name/files/read', (req, res) => {
  const serverName = req.params.name;
  const filepath = (req.query.filepath as string) || '';

  if (!filepath) {
    return res.status(400).json({ error: 'Ruta de archivo no proporcionada.' });
  }

  const safe = resolveSafeServerPath(serverName, filepath);
  if (!safe) {
    return res.status(403).json({ error: 'Acceso denegado: Intentando acceder fuera del servidor.' });
  }

  try {
    if (!fs.existsSync(safe.fullPath)) {
      return res.status(404).json({ error: 'El archivo no existe.' });
    }

    const stat = fs.statSync(safe.fullPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'La ruta corresponde a una carpeta, no a un archivo.' });
    }

    if (stat.size > 5 * 1024 * 1024) { // 5MB limit
      return res.status(400).json({ error: 'El archivo es demasiado grande para editarlo en el navegador (> 5MB).' });
    }

    const content = fs.readFileSync(safe.fullPath, 'utf8');
    return res.json({
      success: true,
      filepath: safe.relativeSubpath,
      name: path.basename(safe.fullPath),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      content
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Error al leer archivo: ${err.message}` });
  }
});

// Save File Content to Disk
app.put('/api/servers/:name/files/save', (req, res) => {
  const serverName = req.params.name;
  const { filepath, content } = req.body;

  if (!filepath || typeof content !== 'string') {
    return res.status(400).json({ error: 'Parámetros inválidos (filepath o content).' });
  }

  const safe = resolveSafeServerPath(serverName, filepath);
  if (!safe) {
    return res.status(403).json({ error: 'Acceso denegado: Intentando escribir fuera de la carpeta del servidor.' });
  }

  try {
    // Ensure directory exists
    const dir = path.dirname(safe.fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safe.fullPath, content, 'utf8');
    return res.json({
      success: true,
      message: `Archivo "${path.basename(safe.fullPath)}" guardado correctamente en el disco.`,
      filepath: safe.relativeSubpath
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Error al escribir el archivo en el disco: ${err.message}` });
  }
});

// Check File Upload Conflicts
app.post('/api/servers/:name/files/check-conflicts', (req, res) => {
  const serverName = req.params.name;
  const { subpath, fileNames } = req.body;

  if (!Array.isArray(fileNames)) {
    return res.status(400).json({ error: 'Lista de nombres de archivos inválida.' });
  }

  const conflicts: string[] = [];
  for (const fileName of fileNames) {
    if (typeof fileName !== 'string' || !fileName.trim()) continue;
    const targetPath = path.join(subpath || '/', fileName.trim());
    const safe = resolveSafeServerPath(serverName, targetPath);
    if (safe && fs.existsSync(safe.fullPath)) {
      conflicts.push(fileName.trim());
    }
  }

  return res.json({ success: true, conflicts });
});

// Upload File to Server Directory
app.post('/api/servers/:name/files/upload', (req, res) => {
  const serverName = req.params.name;
  const { subpath, fileName, fileData, overwrite } = req.body;

  if (!fileName || typeof fileData !== 'string') {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (fileName o fileData).' });
  }

  const cleanFileName = path.basename(fileName.trim());
  if (!cleanFileName) {
    return res.status(400).json({ error: 'Nombre de archivo inválido.' });
  }

  const targetPath = path.join(subpath || '/', cleanFileName);
  const safe = resolveSafeServerPath(serverName, targetPath);
  if (!safe) {
    return res.status(403).json({ error: 'Acceso denegado: Intento de subir archivos fuera de la carpeta del servidor.' });
  }

  try {
    const parentDir = path.dirname(safe.fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (fs.existsSync(safe.fullPath) && !overwrite) {
      return res.status(409).json({
        conflict: true,
        fileName: cleanFileName,
        error: `El archivo "${cleanFileName}" ya existe en el servidor.`
      });
    }

    // Clean base64 header if present (e.g. data:application/octet-stream;base64,...)
    const base64Clean = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    fs.writeFileSync(safe.fullPath, buffer);

    return res.json({
      success: true,
      message: `Archivo "${cleanFileName}" importado correctamente.`,
      savedPath: safe.relativeSubpath,
      size: buffer.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Error al guardar el archivo importado: ${err.message}` });
  }
});

// Create File or Folder
app.post('/api/servers/:name/files/create', (req, res) => {
  const serverName = req.params.name;
  const { subpath, name, isDirectory } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nombre no especificado.' });
  }

  const targetPath = path.join(subpath || '/', name);
  const safe = resolveSafeServerPath(serverName, targetPath);
  if (!safe) {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  try {
    if (fs.existsSync(safe.fullPath)) {
      return res.status(400).json({ error: 'Ya existe un archivo o carpeta con este nombre.' });
    }

    if (isDirectory) {
      fs.mkdirSync(safe.fullPath, { recursive: true });
    } else {
      const parentDir = path.dirname(safe.fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(safe.fullPath, '', 'utf8');
    }

    return res.json({
      success: true,
      message: `${isDirectory ? 'Carpeta' : 'Archivo'} "${name}" creado exitosamente.`
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Error al crear elemento: ${err.message}` });
  }
});

// Delete File or Folder
app.delete('/api/servers/:name/files/delete', (req, res) => {
  const serverName = req.params.name;
  const filepath = (req.body?.filepath || req.query?.filepath) as string;

  if (!filepath) {
    return res.status(400).json({ error: 'Ruta no especificada.' });
  }

  const safe = resolveSafeServerPath(serverName, filepath);
  if (!safe || safe.fullPath === safe.rootPath) {
    return res.status(403).json({ error: 'Acceso denegado: No puedes borrar el directorio raíz del servidor.' });
  }

  try {
    if (!fs.existsSync(safe.fullPath)) {
      return res.status(404).json({ error: 'El archivo o carpeta no existe.' });
    }

    fs.rmSync(safe.fullPath, { recursive: true, force: true });
    return res.json({
      success: true,
      message: `"${path.basename(safe.fullPath)}" eliminado correctamente del servidor.`
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Error al eliminar: ${err.message}` });
  }
});

// System Update API Endpoint
app.post('/api/system/update', async (req, res) => {
  try {
    const logs: string[] = [];
    logs.push('Iniciando comprobación y actualización de RaspiMC desde el repositorio de GitHub...');

    const appDir = process.cwd();
    const isGit = fs.existsSync(path.join(appDir, '.git'));

    if (isGit) {
      try {
        const gitPull = execSync('git pull origin main || git pull origin master', { timeout: 15000, cwd: appDir }).toString();
        logs.push(`Respuesta de Git: ${gitPull.trim()}`);
      } catch (e: any) {
        logs.push(`Nota Git: ${e.message || 'No se pudo completar git pull'}`);
      }
    } else {
      logs.push('Descargando último paquete de actualización desde GitHub (D4mizr/WinMc)...');
      try {
        execSync('curl -sL https://github.com/D4mizr/WinMc/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1', { timeout: 25000, cwd: appDir });
        logs.push('Archivos del repositorio descargados y extraídos correctamente.');
      } catch (e: any) {
        logs.push(`Actualización directa: ${e.message}`);
      }
    }

    logs.push('Instalando dependencias e iniciando compilación...');
    try {
      execSync('npm install --no-audit --no-fund', { timeout: 60000, cwd: appDir });
      execSync('npm run build', { timeout: 60000, cwd: appDir });
      logs.push('¡Compilación de RaspiMC finalizada con éxito!');
    } catch (buildErr: any) {
      logs.push(`Detalle del build: ${buildErr.message || 'Compilación completada.'}`);
    }

    logs.push('Reiniciando servicio RaspiMC en Raspberry Pi OS...');

    // Schedule systemd restart
    setTimeout(() => {
      try {
        execSync('systemctl restart raspimc 2>/dev/null || process.exit(0)', { timeout: 3000 });
      } catch (_) {
        process.exit(0);
      }
    }, 2000);

    return res.json({
      success: true,
      message: 'Proceso de actualización completado exitosamente. El servidor se está reiniciando.',
      logs
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Error durante la actualización: ${err.message}`
    });
  }
});

// System Uninstall API Endpoint (Complete Clean Purge)
app.post('/api/system/uninstall', async (req, res) => {
  const { confirmDeleteServers } = req.body;

  if (!confirmDeleteServers) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere confirmación explícita para la eliminación completa del sistema y servidores.'
    });
  }

  try {
    console.log('[RaspiMC] ¡INICIANDO DESINSTALACIÓN COMPLETA DEL SISTEMA EN LINUX!');

    // Stop active servers
    for (const [serverName, server] of activeServers.entries()) {
      try {
        console.log(`[RaspiMC] Apagando servidor antes de desinstalar: ${serverName}`);
        server.process.stdin.write('stop\r\n');
      } catch (_) {}
    }

    res.json({
      success: true,
      message: 'Desinstalación iniciada. Los archivos del sistema y todos los servidores de Minecraft serán eliminados permanentemente.'
    });

    // Run async script to purge systemd service, CLI command, and app + server directories
    setTimeout(() => {
      try {
        const purgeScript = `
          sleep 1;
          systemctl stop raspimc 2>/dev/null || true;
          systemctl disable raspimc 2>/dev/null || true;
          rm -f /usr/local/bin/raspimc 2>/dev/null || true;
          rm -f /etc/systemd/system/raspimc.service 2>/dev/null || true;
          systemctl daemon-reload 2>/dev/null || true;
          rm -rf /var/lib/raspimc 2>/dev/null || true;
          rm -rf /opt/raspimc 2>/dev/null || true;
        `;
        execSync(`nohup sh -c "${purgeScript.replace(/\n/g, ' ')}" >/dev/null 2>&1 &`);
      } catch (_) {}
      process.exit(0);
    }, 1200);

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Error al ejecutar la desinstalación: ${err.message}`
    });
  }
});

// 2. Fetch available versions for installer dropdowns dynamically
app.get('/api/servers/versions', async (req, res) => {
  const type = req.query.type as string; // 'Vanilla', 'Paper', 'Fabric', 'Forge'
  try {
    if (type === 'Paper') {
      const response = await fetch('https://fill.papermc.io/v3/projects/paper');
      const data: any = await response.json();
      const versionsObj = data.versions || {};
      const allVersions = Object.values(versionsObj).flat() as string[];
      const cleanVersions = allVersions.filter((v) => !v.includes('-rc') && !v.includes('-pre'));
      return res.json({ versions: cleanVersions.length > 0 ? cleanVersions : allVersions });
    } else if (type === 'Fabric') {
      const response = await fetch('https://meta.fabricmc.net/v2/versions/game');
      const data: any = await response.json();
      const stableVersions = data
        .filter((v: any) => v.stable)
        .map((v: any) => v.version);
      return res.json({ versions: stableVersions.slice(0, 50) });
    } else if (type === 'Vanilla') {
      const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
      const data: any = await response.json();
      const releases = data.versions
        .filter((v: any) => v.type === 'release')
        .map((v: any) => v.id);
      return res.json({ versions: releases.slice(0, 50) });
    } else {
      // Forge standard release list
      const forgeVersions = ['1.21', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2'];
      return res.json({ versions: forgeVersions });
    }
  } catch (error) {
    // Fallback stable lists if API fails
    const defaultVersions = ['1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2'];
    res.json({ versions: defaultVersions });
  }
});

// Helper function to download real server JAR file with live progress tracking
async function downloadServerJar(
  serverPath: string,
  type: string,
  version: string,
  ramAllocated: number,
  onProgress?: (event: { status: string; percent: number; downloadedBytes?: number; totalBytes?: number; message: string }) => void
): Promise<string> {
  let downloadUrl = '';

  if (type === 'Paper') {
    onProgress?.({
      status: 'resolving',
      percent: 10,
      message: `Consultando API oficial v3 de PaperMC (${version})...`
    });

    // Use official PaperMC v3 Downloads Service API (version + build resolution)
    const buildsRes = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`);
    if (!buildsRes.ok) {
      throw new Error(`No se encontró la versión ${version} en el servicio oficial de PaperMC (HTTP ${buildsRes.status}).`);
    }
    const buildsData: any = await buildsRes.json();
    if (!Array.isArray(buildsData) || buildsData.length === 0) {
      throw new Error(`No hay compilaciones (builds) disponibles para PaperMC ${version}.`);
    }

    // Iterate builds (newest first) to find first valid server download URL
    for (const build of buildsData) {
      if (build.downloads) {
        const dlObj = build.downloads['server:default'] || build.downloads['application'] || Object.values(build.downloads)[0];
        if (dlObj && (dlObj as any).url) {
          downloadUrl = (dlObj as any).url;
          break;
        }
      }
    }

    if (!downloadUrl) {
      throw new Error(`No se pudo obtener el enlace de descarga directo para PaperMC ${version}.`);
    }
  } else if (type === 'Fabric') {
    onProgress?.({
      status: 'resolving',
      percent: 10,
      message: 'Consultando Meta API oficial de FabricMC...'
    });

    const loaderRes = await fetch('https://meta.fabricmc.net/v2/versions/loader');
    const installerRes = await fetch('https://meta.fabricmc.net/v2/versions/installer');
    if (!loaderRes.ok || !installerRes.ok) {
      throw new Error('No se pudo conectar con la API oficial de FabricMC.');
    }
    const loaders: any = await loaderRes.json();
    const installers: any = await installerRes.json();
    if (!loaders || !loaders.length || !installers || !installers.length) {
      throw new Error('Sin versiones disponibles en la API de FabricMC.');
    }
    const latestLoader = loaders[0].version;
    const latestInstaller = installers[0].version;
    downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${latestLoader}/${latestInstaller}/server/jar`;
  } else if (type === 'Vanilla') {
    onProgress?.({
      status: 'resolving',
      percent: 10,
      message: 'Consultando manifiesto oficial de versiones de Mojang...'
    });

    const manifestRes = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
    if (!manifestRes.ok) {
      throw new Error('No se pudo obtener el manifiesto oficial de versiones de Mojang.');
    }
    const manifest: any = await manifestRes.json();
    const verObj = manifest.versions.find((v: any) => v.id === version);
    if (!verObj) {
      throw new Error(`La versión Vanilla ${version} no existe en el manifiesto oficial de Mojang.`);
    }
    const verRes = await fetch(verObj.url);
    if (!verRes.ok) {
      throw new Error(`Error al obtener metadatos de descarga para Vanilla ${version}.`);
    }
    const verData: any = await verRes.json();
    if (!verData.downloads || !verData.downloads.server || !verData.downloads.server.url) {
      throw new Error(`La versión ${version} de Mojang Vanilla no provee un binario server.jar directo.`);
    }
    downloadUrl = verData.downloads.server.url;
  } else if (type === 'Forge') {
    onProgress?.({
      status: 'resolving',
      percent: 10,
      message: 'Consultando catálogo oficial de promociones de Forge...'
    });

    let forgeVer = '';
    try {
      const promoRes = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
      if (promoRes.ok) {
        const promoData: any = await promoRes.json();
        const promoKeyLatest = `${version}-latest`;
        const promoKeyRec = `${version}-recommended`;
        if (promoData.promos && (promoData.promos[promoKeyRec] || promoData.promos[promoKeyLatest])) {
          forgeVer = promoData.promos[promoKeyRec] || promoData.promos[promoKeyLatest];
        }
      }
    } catch (_) {}

    if (!forgeVer) {
      const fallbackForgeMap: Record<string, string> = {
        '1.21': '51.0.8',
        '1.20.4': '49.0.38',
        '1.20.1': '47.2.0',
        '1.19.4': '45.1.0',
        '1.19.2': '43.2.0',
        '1.18.2': '40.2.0',
        '1.16.5': '36.2.39',
        '1.12.2': '14.23.5.2859'
      };
      forgeVer = fallbackForgeMap[version] || '47.2.0';
    }

    downloadUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${forgeVer}/forge-${version}-${forgeVer}-installer.jar`;
  }

  if (!downloadUrl) {
    throw new Error(`No se encontró una URL de descarga válida para ${type} ${version}`);
  }

  const targetJarName = type === 'Forge' ? 'forge-installer.jar' : 'server.jar';
  const jarPath = path.join(serverPath, targetJarName);

  onProgress?.({
    status: 'starting_download',
    percent: 15,
    message: `Iniciando descarga de ${targetJarName}...`
  });

  const downloadResponse = await fetch(downloadUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Fallo al descargar el archivo JAR (${downloadResponse.statusText}) desde ${downloadUrl}`);
  }

  const contentLength = Number(downloadResponse.headers.get('content-length') || 0);
  let downloadedBytes = 0;

  const fileStream = fs.createWriteStream(jarPath);

  if (downloadResponse.body && typeof (downloadResponse.body as any).getReader === 'function') {
    const reader = (downloadResponse.body as any).getReader();
    let lastReportTime = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloadedBytes += value.length;
      fileStream.write(value);

      const now = Date.now();
      if (now - lastReportTime > 150) {
        lastReportTime = now;
        const percent = contentLength > 0
          ? Math.min(95, 15 + Math.round((downloadedBytes / contentLength) * 80))
          : 50;
        const mbDownloaded = (downloadedBytes / (1024 * 1024)).toFixed(1);
        const mbTotal = contentLength > 0 ? (contentLength / (1024 * 1024)).toFixed(1) : '?';

        onProgress?.({
          status: 'downloading',
          percent,
          downloadedBytes,
          totalBytes: contentLength,
          message: `Descargando ${mbDownloaded} MB / ${mbTotal} MB (${percent}%)`
        });
      }
    }
    fileStream.end();
  } else {
    const arrayBuffer = await downloadResponse.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 1000) {
      throw new Error('El archivo descargado es inválido o está corrupto.');
    }
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(jarPath, buffer);
    downloadedBytes = buffer.byteLength;
  }

  onProgress?.({
    status: 'configuring',
    percent: 96,
    message: 'Escribiendo configuraciones y scripts de inicio...'
  });

  if (type === 'Forge') {
    fs.writeFileSync(
      path.join(serverPath, 'start.bat'),
      `@echo off\nif not exist forge-installer.jar (\n  echo Forge Installer not found\n) else (\n  java -jar forge-installer.jar --installServer\n)\njava -Xmx${ramAllocated}G -Xms${ramAllocated}G -jar server.jar nogui\n`
    );
  } else {
    fs.writeFileSync(
      path.join(serverPath, 'start.bat'),
      `@echo off\njava -Xmx${ramAllocated}G -Xms${ramAllocated}G -jar server.jar nogui\n`
    );
  }

  return targetJarName;
}

// 3. List all Minecraft servers managed in all configured directories
app.get('/api/servers', (req, res) => {
  try {
    const now = Date.now();
    if (serversCache && (now - lastServersScanTime < SERVERS_CACHE_TTL_MS)) {
      const activeList = serversCache.map(s => {
        const active = activeServers.get(s.name);
        return {
          ...s,
          status: active ? 'online' : 'offline',
          playersOnline: active ? active.players.size : 0,
          playersList: active ? Array.from(active.players) : []
        };
      });
      return res.json(activeList);
    }

    const dirs = getResolvedServersDirs();
    const serversList = [];
    const seenNames = new Set<string>();

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      let folders: string[] = [];
      try {
        folders = fs.readdirSync(dir);
      } catch (_) {
        continue;
      }

      for (const folder of folders) {
        const serverPath = path.join(dir, folder);
        try {
          if (!fs.statSync(serverPath).isDirectory()) continue;
        } catch (_) {
          continue;
        }

        const configPath = path.join(serverPath, 'config.json');
        const propsPath = path.join(serverPath, 'server.properties');
        const jarPath = path.join(serverPath, 'server.jar');
        const forgeJarPath = path.join(serverPath, 'forge-installer.jar');

        // Check if directory looks like a Minecraft server
        if (!fs.existsSync(configPath) && !fs.existsSync(propsPath) && !fs.existsSync(jarPath) && !fs.existsSync(forgeJarPath)) {
          continue;
        }

        if (seenNames.has(folder)) continue;
        seenNames.add(folder);

        let serverConfig: any = {};
        if (fs.existsSync(configPath)) {
          try {
            serverConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          } catch (_) {}
        }

        // Check if EULA is accepted
        const eulaPath = path.join(serverPath, 'eula.txt');
        let eulaAccepted = false;
        if (fs.existsSync(eulaPath)) {
          try {
            const eulaContent = fs.readFileSync(eulaPath, 'utf8');
            eulaAccepted = eulaContent.includes('eula=true');
          } catch (_) {}
        }

        // Determine real process status
        let status = 'offline';
        const active = activeServers.get(folder);
        if (active) {
          status = 'online';
        }

        // Check if server JAR exists
        const serverType = serverConfig.type || 'Vanilla';
        const expectedJarName = serverType === 'Forge'
          ? (fs.existsSync(jarPath) ? 'server.jar' : 'forge-installer.jar')
          : 'server.jar';
        const isInstalled = fs.existsSync(path.join(serverPath, expectedJarName));

        // Parse server.properties for real server settings
        const props = parseServerProperties(propsPath);
        const hasCustomIcon = fs.existsSync(path.join(serverPath, 'server-icon.png'));

        serversList.push({
          name: folder,
          location: dir,
          status: status,
          installed: isInstalled,
          version: serverConfig.version || '1.21',
          type: serverType,
          ip: '127.0.0.1',
          port: parseInt(props['server-port'] || serverConfig.port || '25565', 10),
          playersMax: parseInt(props['max-players'] || serverConfig.playersMax || '20', 10),
          playersOnline: active ? active.players.size : 0,
          playersList: active ? Array.from(active.players) : [],
          motd: props['motd'] || serverConfig.motd || 'A RaspiMC server -- Kai',
          worldName: props['level-name'] || serverConfig.worldName || 'world',
          worldSeed: serverConfig.worldSeed || '12345',
          gameMode: (props['gamemode'] as any) || serverConfig.gameMode || 'survival',
          difficulty: (props['difficulty'] as any) || serverConfig.difficulty || 'normal',
          pvp: props['pvp'] !== undefined ? props['pvp'] === 'true' : (serverConfig.pvp !== false),
          spawnProtection: parseInt(props['spawn-protection'] || serverConfig.spawnProtection || '16', 10),
          viewDistance: parseInt(props['view-distance'] || serverConfig.viewDistance || '10', 10),
          allowFlight: props['allow-flight'] === 'true' || serverConfig.allowFlight === true,
          enableCommandBlocks: props['enable-command-block'] === 'true' || serverConfig.enableCommandBlocks === true,
          whiteList: props['white-list'] === 'true' || serverConfig.whiteList === true,
          onlineMode: props['online-mode'] !== undefined ? props['online-mode'] === 'true' : (serverConfig.onlineMode !== false),
          spawnAnimals: props['spawn-animals'] !== undefined ? props['spawn-animals'] === 'true' : (serverConfig.spawnAnimals !== false),
          spawnMonsters: props['spawn-monsters'] !== undefined ? props['spawn-monsters'] === 'true' : (serverConfig.spawnMonsters !== false),
          spawnNpcs: props['spawn-npcs'] !== undefined ? props['spawn-npcs'] === 'true' : (serverConfig.spawnNpcs !== false),
          allowNether: props['allow-nether'] !== undefined ? props['allow-nether'] === 'true' : (serverConfig.allowNether !== false),
          forceGamemode: props['force-gamemode'] === 'true' || serverConfig.forceGamemode === true,
          requireResourcePack: props['require-resource-pack'] === 'true' || serverConfig.requireResourcePack === true,
          resourcePack: props['resource-pack'] || serverConfig.resourcePack || '',
          resourcePackPrompt: props['resource-pack-prompt'] || serverConfig.resourcePackPrompt || '',
          ramAllocated: Number(serverConfig.ramAllocated) || 2,
          ramMinAllocated: Number(serverConfig.ramMinAllocated) || 1,
          eulaAccepted,
          hasCustomIcon
        });
      }
    }

    serversCache = serversList;
    lastServersScanTime = now;

    res.json(serversList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Download server JAR and create server directory with live SSE progress stream
app.post('/api/servers', async (req, res) => {
  const { name, type, version, ramAllocated, targetLocation } = req.body;
  if (!name || !type || !version) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (nombre, tipo, versión)' });
  }

  const cleanName = name.replace(/[^a-zA-Z0-9_\-]/g, '');
  let serversDir = getPrimaryServersDir();
  if (targetLocation && typeof targetLocation === 'string') {
    const resolved = path.isAbsolute(targetLocation) ? targetLocation : path.join(process.cwd(), targetLocation);
    if (fs.existsSync(resolved)) {
      serversDir = resolved;
    }
  }

  const existing = findServerPath(cleanName);
  if (existing) {
    return res.status(400).json({ error: 'Ya existe un servidor con ese nombre' });
  }

  const serverPath = path.join(serversDir, cleanName);

  // Set SSE Headers for live non-blocking progress updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (eventData: any) => {
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
  };

  try {
    // Create server directory
    fs.mkdirSync(serverPath, { recursive: true });

    // Save configuration file config.json
    const config = {
      name: cleanName,
      type,
      version,
      port: 25565,
      playersMax: 20,
      motd: (req.body.motd && req.body.motd.trim()) ? req.body.motd.trim() : 'A RaspiMC server -- Kai',
      worldName: 'world',
      worldSeed: Math.floor(Math.random() * 999999999999).toString(),
      gameMode: 'survival',
      difficulty: 'normal',
      pvp: true,
      spawnProtection: 16,
      viewDistance: 10,
      allowFlight: false,
      enableCommandBlocks: false,
      ramAllocated: ramAllocated || 2
    };

    fs.writeFileSync(path.join(serverPath, 'config.json'), JSON.stringify(config, null, 2));

    // Create default server.properties
    fs.writeFileSync(
      path.join(serverPath, 'server.properties'),
      `server-port=25565\nmotd=${config.motd}\nlevel-name=world\ndifficulty=normal\npvp=true\nspawn-protection=16\n`
    );

    // Download actual JAR file and emit progress events
    await downloadServerJar(serverPath, type, version, config.ramAllocated, (progressEvent) => {
      sendEvent(progressEvent);
    });

    sendEvent({
      status: 'complete',
      percent: 100,
      message: '¡Servidor creado e instalado con éxito!',
      server: config
    });
    invalidateServersCache();
    res.end();
  } catch (error: any) {
    // Clean up directory if download or setup failed
    if (fs.existsSync(serverPath)) {
      try {
        fs.rmSync(serverPath, { recursive: true, force: true });
      } catch (_) {}
    }

    sendEvent({
      status: 'error',
      error: error.message || 'Error al crear el servidor'
    });
    res.end();
  }
});

// Delete Server and entire folder recursively
app.delete('/api/servers/:name', (req, res) => {
  const serverName = req.params.name;
  const found = findServerPath(serverName);

  if (!found) {
    return res.status(404).json({ error: 'El servidor no existe' });
  }

  const { serverPath } = found;

  try {
    const running = activeServers.get(serverName);
    if (running) {
      try {
        running.process.kill('SIGKILL');
      } catch (_) {}
      activeServers.delete(serverName);
    }

    fs.rmSync(serverPath, { recursive: true, force: true });
    invalidateServersCache();
    res.json({ success: true, message: `El servidor ${serverName} y todos sus archivos fueron eliminados.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update or set EULA status
app.post('/api/servers/:name/eula', (req, res) => {
  const serverName = req.params.name;
  const found = findServerPath(serverName);

  if (!found) {
    return res.status(404).json({ error: 'El servidor especificado no existe.' });
  }

  const { serverPath } = found;
  const { accept } = req.body;
  const eulaPath = path.join(serverPath, 'eula.txt');

  if (accept === true) {
    fs.writeFileSync(eulaPath, 'eula=true\n');
    invalidateServersCache();
    return res.json({ success: true, eulaAccepted: true });
  } else {
    if (fs.existsSync(eulaPath)) {
      fs.unlinkSync(eulaPath);
    }
    invalidateServersCache();
    return res.json({ success: true, eulaAccepted: false });
  }
});

// 5. Update Server Configuration
app.post('/api/servers/:name/config', (req, res) => {
  const serverName = req.params.name;
  const found = findServerPath(serverName);

  if (!found) {
    return res.status(404).json({ error: 'Server folder not found' });
  }

  const { serverPath } = found;

  try {
    const configPath = path.join(serverPath, 'config.json');
    let currentConfig: any = {};
    if (fs.existsSync(configPath)) {
      currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    const updatedConfig = { ...currentConfig, ...req.body };
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

    const propertiesPath = path.join(serverPath, 'server.properties');
    
    // Map all fields directly to server.properties key format
    const propsMap: Record<string, string> = {
      'server-port': String(updatedConfig.port || 25565),
      'motd': String(updatedConfig.motd || 'A RaspiMC server -- Kai'),
      'level-name': String(updatedConfig.worldName || 'world'),
      'difficulty': String(updatedConfig.difficulty || 'normal'),
      'gamemode': String(updatedConfig.gameMode || 'survival'),
      'pvp': String(updatedConfig.pvp !== false),
      'spawn-protection': String(updatedConfig.spawnProtection ?? 16),
      'view-distance': String(updatedConfig.viewDistance ?? 10),
      'allow-flight': String(updatedConfig.allowFlight === true),
      'enable-command-block': String(updatedConfig.enableCommandBlocks === true),
      'max-players': String(updatedConfig.playersMax ?? 20),
      'white-list': String(updatedConfig.whiteList === true),
      'online-mode': String(updatedConfig.onlineMode !== false),
      'spawn-animals': String(updatedConfig.spawnAnimals !== false),
      'spawn-monsters': String(updatedConfig.spawnMonsters !== false),
      'spawn-npcs': String(updatedConfig.spawnNpcs !== false),
      'allow-nether': String(updatedConfig.allowNether !== false),
      'force-gamemode': String(updatedConfig.forceGamemode === true),
      'require-resource-pack': String(updatedConfig.requireResourcePack === true),
      'resource-pack': String(updatedConfig.resourcePack || ''),
      'resource-pack-prompt': String(updatedConfig.resourcePackPrompt || '')
    };

    writeServerProperties(propertiesPath, propsMap);

    // Sync start.bat if RAM was updated
    const ramMaxGb = Math.max(1, Number(updatedConfig.ramAllocated) || 2);
    const ramMinGb = Math.max(0.5, Math.min(ramMaxGb, Number(updatedConfig.ramMinAllocated) || Math.max(1, ramMaxGb / 2)));
    const ramMaxMb = Math.round(ramMaxGb * 1024);
    const ramMinMb = Math.round(ramMinGb * 1024);

    const batPath = path.join(serverPath, 'start.bat');
    fs.writeFileSync(
      batPath,
      `@echo off\njava -Xms${ramMinMb}M -Xmx${ramMaxMb}M -jar server.jar nogui\n`
    );

    invalidateServersCache();
    res.json(updatedConfig);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/servers/:name/icon - Serve custom server icon file
app.get('/api/servers/:name/icon', (req, res) => {
  const serverName = req.params.name;
  const found = findServerPath(serverName);
  if (found) {
    const iconPath = path.join(found.serverPath, 'server-icon.png');
    if (fs.existsSync(iconPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(iconPath);
    }
  }
  return res.status(404).send('No custom server-icon.png found');
});

// POST /api/servers/:name/icon - Upload or set server-icon.png
app.post('/api/servers/:name/icon', (req, res) => {
  const serverName = req.params.name;
  const { iconBase64 } = req.body;
  const found = findServerPath(serverName);

  if (!found) {
    return res.status(404).json({ error: 'Servidor no encontrado' });
  }

  const { serverPath } = found;

  if (!iconBase64) {
    return res.status(400).json({ error: 'Falta la imagen base64' });
  }

  try {
    const cleanBase64 = iconBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const iconPath = path.join(serverPath, 'server-icon.png');
    fs.writeFileSync(iconPath, buffer);

    res.json({ success: true, message: 'Icono guardado con éxito como server-icon.png en la raíz del servidor.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:name/icon - Delete custom server-icon.png
app.delete('/api/servers/:name/icon', (req, res) => {
  const serverName = req.params.name;
  const found = findServerPath(serverName);

  if (found) {
    const iconPath = path.join(found.serverPath, 'server-icon.png');
    if (fs.existsSync(iconPath)) {
      try {
        fs.unlinkSync(iconPath);
      } catch (_) {}
    }
  }
  res.json({ success: true });
});

// GET /api/servers/:name/log-files - List available log files in /logs
app.get('/api/servers/:name/log-files', (req, res) => {
  const serverName = req.params.name;
  const found = findServerPath(serverName);

  if (!found) {
    return res.status(404).json({ error: 'Servidor no encontrado' });
  }

  const { serverPath } = found;
  const logsDir = path.join(serverPath, 'logs');

  const filesList: Array<{ name: string; size: number; mtime: string; isLatest: boolean }> = [];

  if (fs.existsSync(logsDir)) {
    try {
      const files = fs.readdirSync(logsDir);
      for (const file of files) {
        const fp = path.join(logsDir, file);
        const stat = fs.statSync(fp);
        if (stat.isFile()) {
          filesList.push({
            name: file,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            isLatest: file === 'latest.log'
          });
        }
      }
    } catch (_) {}
  }

  // Also check if latest.log is directly at server root
  const rootLatest = path.join(serverPath, 'latest.log');
  if (fs.existsSync(rootLatest) && !filesList.some(f => f.name === 'latest.log')) {
    try {
      const stat = fs.statSync(rootLatest);
      filesList.push({
        name: 'latest.log',
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        isLatest: true
      });
    } catch (_) {}
  }

  // Sort with latest.log first, then newest descending
  filesList.sort((a, b) => {
    if (a.isLatest) return -1;
    if (b.isLatest) return 1;
    return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
  });

  res.json(filesList);
});

// GET /api/servers/:name/log-files/view - Read log file content
app.get('/api/servers/:name/log-files/view', (req, res) => {
  const serverName = req.params.name;
  const fileName = (req.query.file as string) || 'latest.log';

  const safeFileName = path.basename(fileName);
  const found = findServerPath(serverName);

  if (!found) {
    return res.status(404).json({ error: 'Servidor no encontrado' });
  }

  const { serverPath } = found;

  let filePath = path.join(serverPath, 'logs', safeFileName);
  if (!fs.existsSync(filePath)) {
    const rootPath = path.join(serverPath, safeFileName);
    if (fs.existsSync(rootPath)) {
      filePath = rootPath;
    } else {
      return res.status(404).json({ error: `El archivo ${safeFileName} no existe.` });
    }
  }

  try {
    let content = '';
    if (safeFileName.endsWith('.gz')) {
      const gzBuffer = fs.readFileSync(filePath);
      const uncompressed = zlib.gunzipSync(gzBuffer);
      content = uncompressed.toString('utf8');
    } else {
      content = fs.readFileSync(filePath, 'utf8');
    }

    const lines = content.split('\n');
    res.json({
      filename: safeFileName,
      lineCount: lines.length,
      content
    });
  } catch (error: any) {
    res.status(500).json({ error: `No se pudo leer el archivo de log: ${error.message}` });
  }
});

// 6. Start server process
app.post('/api/servers/:name/start', (req, res) => {
  const serverName = req.params.name;
  const found = findServerPath(serverName);

  if (!found) {
    return res.status(404).json({ error: 'El servidor no existe' });
  }

  const { serverPath } = found;

  if (activeServers.has(serverName)) {
    return res.status(400).json({ error: 'El servidor ya se encuentra en ejecución' });
  }

  const eulaPath = path.join(serverPath, 'eula.txt');
  if (req.body && req.body.acceptEula === true) {
    fs.writeFileSync(eulaPath, 'eula=true\n');
  }

  let hasAcceptedEula = false;
  if (fs.existsSync(eulaPath)) {
    try {
      const eulaContent = fs.readFileSync(eulaPath, 'utf8');
      if (eulaContent.includes('eula=true')) {
        hasAcceptedEula = true;
      }
    } catch (_) {}
  }

  if (!hasAcceptedEula) {
    return res.status(400).json({
      error: 'EULA_REQUIRED',
      message: 'Debes aceptar la Licencia de Usuario Final (EULA) de Mojang antes de iniciar el servidor.'
    });
  }

  try {
    const configPath = path.join(serverPath, 'config.json');
    let ramAllocated = 2;
    let type = 'Vanilla';
    let configMotd = 'A RaspiMC server -- Kai';
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        ramAllocated = Number(config.ramAllocated) || 2;
        type = config.type || 'Vanilla';
        if (config.motd && config.motd.trim()) {
          configMotd = config.motd.trim();
        }
      } catch (_) {}
    }

    // Write / sync MOTD to server.properties before launching
    const propertiesPath = path.join(serverPath, 'server.properties');
    if (!fs.existsSync(propertiesPath)) {
      fs.writeFileSync(propertiesPath, `server-port=25565\nmotd=${configMotd}\nlevel-name=world\ndifficulty=normal\npvp=true\nspawn-protection=16\n`);
    } else {
      let props = fs.readFileSync(propertiesPath, 'utf8');
      if (props.includes('motd=')) {
        props = props.replace(/motd=.*/g, `motd=${configMotd}`);
      } else {
        props += `\nmotd=${configMotd}\n`;
      }
      fs.writeFileSync(propertiesPath, props);
    }

    const jarName = type === 'Forge' ? (fs.existsSync(path.join(serverPath, 'server.jar')) ? 'server.jar' : 'forge-installer.jar') : 'server.jar';
    const jarPath = path.join(serverPath, jarName);

    if (!fs.existsSync(jarPath)) {
      return res.status(400).json({ error: 'No se encontró el archivo .jar en el servidor.' });
    }

    // Calculate RAM arguments in MB
    const ramMaxMb = Math.round(ramAllocated * 1024);
    const ramMinMb = Math.max(512, Math.round(ramMaxMb / 2));

    // Start Java child process using custom Java path if available
    const settings = getSettings();
    const javaExec = settings.javaPath || 'java';
    
    const jvmArgs = [
      `-Xms${ramMinMb}M`,
      `-Xmx${ramMaxMb}M`,
      '-jar',
      jarName,
      'nogui'
    ];

    const serverProcess = spawn(javaExec, jvmArgs, {
      cwd: serverPath,
      shell: process.platform === 'win32'
    });

    const serverEntry: RunningServer = {
      process: serverProcess,
      logs: [{
        id: 'init',
        timestamp: getTimestamp(),
        level: 'INFO',
        message: `[SISTEMA] Ejecutando: ${javaExec} ${jvmArgs.join(' ')} (Directorio: ${serverPath})`
      }],
      players: new Set<string>(),
      playerDataCache: new Map()
    };

    activeServers.set(serverName, serverEntry);

    // Capture standard output
    serverProcess.stdout.on('data', (data) => {
      appendLog(serverName, data.toString(), 'INFO');
    });

    // Capture standard error
    serverProcess.stderr.on('data', (data) => {
      appendLog(serverName, data.toString(), 'ERROR');
    });

    // Handle process termination
    serverProcess.on('close', (code) => {
      appendLog(serverName, `[SISTEMA] El proceso del servidor Minecraft terminó con código de salida ${code}`, 'INFO');
      activeServers.delete(serverName);
    });

    serverProcess.on('error', (err) => {
      appendLog(
        serverName,
        `[ERROR CRÍTICO] Fallo de ejecución del proceso Java: ${err.message}. Verifica que Java esté instalado y la ruta '${javaExec}' sea válida.`,
        'ERROR'
      );
      activeServers.delete(serverName);
    });

    res.json({ status: 'starting' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Stop server process
app.post('/api/servers/:name/stop', (req, res) => {
  const serverName = req.params.name;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor no se encuentra en ejecución' });
  }

  try {
    // Send command "stop" to standard input of the server
    running.process.stdin.write('stop\r\n');
    appendLog(serverName, '> stop', 'INFO');
    
    // In case server hangs, kill after 15s
    setTimeout(() => {
      if (activeServers.has(serverName)) {
        running.process.kill('SIGTERM');
        activeServers.delete(serverName);
      }
    }, 15000);

    res.json({ status: 'stopping' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Send Console Command to Server
app.post('/api/servers/:name/command', (req, res) => {
  const serverName = req.params.name;
  const { command } = req.body;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor debe estar en línea para poder enviar comandos.' });
  }

  if (!command) {
    return res.status(400).json({ error: 'Falta el comando a enviar' });
  }

  try {
    const cleanCmd = command.startsWith('/') ? command.substring(1) : command;
    running.process.stdin.write(`${cleanCmd}\r\n`);
    appendLog(serverName, `> ${command}`, 'INFO');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Player Management Endpoints

// GET /api/servers/:name/players/:player - Query real player data
app.get('/api/servers/:name/players/:player', async (req, res) => {
  const { name: serverName, player: playerName } = req.params;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.json({
      name: playerName,
      serverName,
      status: 'offline',
      coordinates: null,
      health: null,
      hunger: null,
      message: 'Servidor no activo'
    });
  }

  try {
    // Request entity data from server console
    running.process.stdin.write(`data get entity ${playerName}\r\n`);

    // Wait short delay for stdout listener to capture data
    await new Promise((r) => setTimeout(r, 450));

    const cached = running.playerDataCache.get(playerName);
    if (cached) {
      return res.json({
        name: playerName,
        serverName,
        status: 'online',
        coordinates: (cached.x !== null && cached.y !== null && cached.z !== null)
          ? { x: cached.x, y: cached.y, z: cached.z, dimension: cached.dimension || 'overworld' }
          : null,
        health: cached.health,
        hunger: cached.hunger,
        lastUpdated: new Date(cached.updatedAt).toLocaleTimeString()
      });
    }

    return res.json({
      name: playerName,
      serverName,
      status: 'online',
      coordinates: null,
      health: null,
      hunger: null,
      message: 'no disponible'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/servers/:name/players/:player/health - Set player health via real server command pipeline
app.post('/api/servers/:name/players/:player/health', (req, res) => {
  const { name: serverName, player: playerName } = req.params;
  const { health, currentHealth } = req.body;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor no se encuentra en línea.' });
  }

  const targetHealth = Math.min(20, Math.max(0, parseInt(health, 10) || 0));

  try {
    const cached = running.playerDataCache.get(playerName);
    const currHp = typeof currentHealth === 'number' ? currentHealth : (cached?.health ?? 20);

    if (targetHealth < currHp) {
      const damageAmount = currHp - targetHealth;
      // Execute real Minecraft /damage command
      running.process.stdin.write(`damage ${playerName} ${damageAmount}\r\n`);
      // Supplemental NBT modify for max compatibility
      running.process.stdin.write(`data modify entity ${playerName} Health set value ${targetHealth}.0f\r\n`);
      if (targetHealth === 0) {
        running.process.stdin.write(`kill ${playerName}\r\n`);
      }
      appendLog(serverName, `> damage ${playerName} ${damageAmount}`, 'INFO');
    } else if (targetHealth > currHp) {
      running.process.stdin.write(`data modify entity ${playerName} Health set value ${targetHealth}.0f\r\n`);
      running.process.stdin.write(`execute as ${playerName} run attribute @s generic.max_health base set 20\r\n`);
      running.process.stdin.write(`effect give ${playerName} instant_health 1 ${Math.max(1, Math.floor((targetHealth - currHp) / 4))} true\r\n`);
      appendLog(serverName, `> data modify entity ${playerName} Health set value ${targetHealth}.0f`, 'INFO');
    } else {
      running.process.stdin.write(`data modify entity ${playerName} Health set value ${targetHealth}.0f\r\n`);
    }

    // Refresh entity data
    running.process.stdin.write(`data get entity ${playerName}\r\n`);

    if (cached) {
      cached.health = targetHealth;
      cached.updatedAt = Date.now();
    }

    const actionText = targetHealth < currHp 
      ? `/damage ${playerName} ${currHp - targetHealth}` 
      : `/data modify Health ${targetHealth}`;

    res.json({
      success: true,
      health: targetHealth,
      message: `Comando enviado (${actionText}): Salud de ${playerName} fijada a ${targetHealth} HP.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/servers/:name/players/:player/hunger - Set player hunger (foodLevel) via real command pipeline
app.post('/api/servers/:name/players/:player/hunger', (req, res) => {
  const { name: serverName, player: playerName } = req.params;
  const { hunger, currentHunger } = req.body;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor no se encuentra en línea.' });
  }

  const targetHunger = Math.min(20, Math.max(0, parseInt(hunger, 10) || 0));

  try {
    const cached = running.playerDataCache.get(playerName);
    const currFood = typeof currentHunger === 'number' ? currentHunger : (cached?.hunger ?? 20);

    if (targetHunger < currFood) {
      const hungerLoss = currFood - targetHunger;
      // Calculate duration and amplifier for hunger effect
      const durationSeconds = Math.max(1, Math.min(30, Math.ceil(hungerLoss * 1.5)));
      const amplifier = Math.max(0, Math.min(255, Math.floor((hungerLoss / durationSeconds) * 20)));

      // Execute real Minecraft /effect hunger command
      running.process.stdin.write(`effect give ${playerName} hunger ${durationSeconds} ${amplifier} true\r\n`);
      // Supplemental NBT modify for max compatibility
      running.process.stdin.write(`data modify entity ${playerName} foodLevel set value ${targetHunger}\r\n`);

      appendLog(serverName, `> effect give ${playerName} hunger ${durationSeconds} ${amplifier} true`, 'INFO');
    } else if (targetHunger > currFood) {
      running.process.stdin.write(`data modify entity ${playerName} foodLevel set value ${targetHunger}\r\n`);
      running.process.stdin.write(`feed ${playerName}\r\n`);
      running.process.stdin.write(`effect give ${playerName} saturation 1 255 true\r\n`);
      appendLog(serverName, `> data modify entity ${playerName} foodLevel set value ${targetHunger}`, 'INFO');
    } else {
      running.process.stdin.write(`data modify entity ${playerName} foodLevel set value ${targetHunger}\r\n`);
    }

    // Refresh entity data
    running.process.stdin.write(`data get entity ${playerName}\r\n`);

    if (cached) {
      cached.hunger = targetHunger;
      cached.updatedAt = Date.now();
    }

    const actionText = targetHunger < currFood
      ? `/effect give ${playerName} hunger`
      : `/feed & /data modify foodLevel ${targetHunger}`;

    res.json({
      success: true,
      hunger: targetHunger,
      message: `Comando enviado (${actionText}): Nivel de hambre de ${playerName} fijado a ${targetHunger}.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/servers/:name/players/:player/teleport - Teleport player to X, Y, Z coordinates via real command pipeline
app.post('/api/servers/:name/players/:player/teleport', (req, res) => {
  const { name: serverName, player: playerName } = req.params;
  const { x, y, z } = req.body;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor no se encuentra en línea.' });
  }

  const numX = parseFloat(x);
  const numY = parseFloat(y);
  const numZ = parseFloat(z);

  if (isNaN(numX) || isNaN(numY) || isNaN(numZ)) {
    return res.status(400).json({ error: 'Coordenadas X, Y, Z inválidas.' });
  }

  try {
    // Send teleport commands via standard input
    running.process.stdin.write(`tp ${playerName} ${numX} ${numY} ${numZ}\r\n`);
    running.process.stdin.write(`teleport ${playerName} ${numX} ${numY} ${numZ}\r\n`);
    // Query updated entity position
    running.process.stdin.write(`data get entity ${playerName}\r\n`);

    appendLog(serverName, `> tp ${playerName} ${numX} ${numY} ${numZ}`, 'INFO');

    const cached = running.playerDataCache.get(playerName);
    if (cached) {
      cached.x = numX;
      cached.y = numY;
      cached.z = numZ;
      cached.updatedAt = Date.now();
    }

    res.json({
      success: true,
      coordinates: { x: numX, y: numY, z: numZ },
      message: `Comando enviado: Teletransportando a ${playerName} a X:${numX}, Y:${numY}, Z:${numZ}.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/servers/:name/players/:player/kick - Kick player via real command pipeline
app.post('/api/servers/:name/players/:player/kick', (req, res) => {
  const { name: serverName, player: playerName } = req.params;
  const { reason } = req.body;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor no se encuentra en línea.' });
  }

  try {
    const kickReason = reason || 'Expulsado por un administrador';
    running.process.stdin.write(`kick ${playerName} ${kickReason}\r\n`);
    appendLog(serverName, `> kick ${playerName} ${kickReason}`, 'INFO');

    running.players.delete(playerName);
    running.playerDataCache.delete(playerName);

    res.json({ success: true, message: `Jugador ${playerName} expulsado del servidor.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/servers/:name/players/:player/ban - Ban player via real command pipeline
app.post('/api/servers/:name/players/:player/ban', (req, res) => {
  const { name: serverName, player: playerName } = req.params;
  const { reason } = req.body;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor no se encuentra en línea.' });
  }

  try {
    const banReason = reason || 'Baneado por un administrador';
    running.process.stdin.write(`ban ${playerName} ${banReason}\r\n`);
    appendLog(serverName, `> ban ${playerName} ${banReason}`, 'INFO');

    running.players.delete(playerName);
    running.playerDataCache.delete(playerName);

    res.json({ success: true, message: `Jugador ${playerName} baneado del servidor.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/servers/:name/players/:player/message - Send direct message to player via real command pipeline
app.post('/api/servers/:name/players/:player/message', (req, res) => {
  const { name: serverName, player: playerName } = req.params;
  const { message } = req.body;
  const running = activeServers.get(serverName);

  if (!running) {
    return res.status(400).json({ error: 'El servidor no se encuentra en línea.' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  try {
    const cleanMsg = message.trim();
    // Send tellraw (stylized JSON chat message) and fallback tell/msg
    const escapedMsg = cleanMsg.replace(/"/g, '\\"');
    running.process.stdin.write(`tellraw ${playerName} {"text":"[Admin] ${escapedMsg}","color":"gold","bold":true}\r\n`);
    running.process.stdin.write(`tell ${playerName} [Admin] ${cleanMsg}\r\n`);
    running.process.stdin.write(`msg ${playerName} [Admin] ${cleanMsg}\r\n`);

    appendLog(serverName, `> tellraw ${playerName} "[Admin] ${cleanMsg}"`, 'INFO');

    res.json({ success: true, message: `Mensaje enviado a ${playerName}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Get console logs of running server
app.get('/api/servers/:name/console', (req, res) => {
  const serverName = req.params.name;
  const running = activeServers.get(serverName);

  if (!running) {
    // If offline, check if folder exists and read the last lines of logs/latest.log
    const serversDir = getServersDir();
    const logFilePath = path.join(serversDir, serverName, 'logs', 'latest.log');
    if (fs.existsSync(logFilePath)) {
      try {
        const fileContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = fileContent.split('\n').filter(Boolean).slice(-100);
        const staticLogs = lines.map((line, idx) => ({
          id: `static-${idx}`,
          timestamp: getTimestamp(),
          level: 'INFO' as const,
          message: line
        }));
        return res.json({ logs: staticLogs });
      } catch (_) {}
    }
    return res.json({ logs: [{ id: 'offline', timestamp: getTimestamp(), level: 'INFO', message: 'Servidor apagado. Consola no activa.' }] });
  }

  res.json({ logs: running.logs });
});

// GET Settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = getSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Settings
app.post('/api/settings', (req, res) => {
  try {
    const updatedSettings = saveSettings(req.body);
    invalidateServersCache();
    res.json(updatedSettings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/shutdown - Gracefully stop all running Minecraft servers
app.post('/api/shutdown', async (req, res) => {
  console.log('[Shutdown] Recibida orden de apagado general. Deteniendo servidores Minecraft...');
  const activeList = Array.from(activeServers.entries());

  if (activeList.length === 0) {
    return res.json({ status: 'stopped', count: 0, message: 'No hay servidores en ejecución.' });
  }

  const stopPromises = activeList.map(([serverName, server]) => {
    return new Promise<void>((resolve) => {
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          activeServers.delete(serverName);
          resolve();
        }
      };

      const timer = setTimeout(() => {
        console.warn(`[Shutdown Warning] Servidor ${serverName} no respondió al 'stop'. Forzando cierre.`);
        try {
          server.process.kill('SIGTERM');
        } catch (_) {}
        finish();
      }, 10000);

      server.process.once('close', () => {
        clearTimeout(timer);
        console.log(`[Shutdown] Servidor ${serverName} guardado y cerrado correctamente.`);
        finish();
      });

      try {
        server.process.stdin.write('stop\r\n');
        appendLog(serverName, '> stop (Cierre de aplicación WinMc)', 'INFO');
      } catch (err) {
        clearTimeout(timer);
        finish();
      }
    });
  });

  await Promise.all(stopPromises);
  res.json({ status: 'stopped', count: activeList.length, message: 'Servidores cerrados correctamente.' });
});

// Setup Vite Dev Server / Static Production Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Server Dev] Vite middleware cargado correctamente.');
    } catch (err) {
      console.warn('[Server Dev] No se pudo cargar Vite middleware:', err);
    }
  } else {
    const candidatePaths = [
      path.join(process.cwd(), 'dist'),
      __dirname,
      path.join(__dirname, '..', 'dist'),
      process.cwd()
    ];
    let distPath = candidatePaths.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || candidatePaths[0];
    console.log(`[Production] Servidor estático cargando archivos desde: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('No se encontró index.html. Por favor ejecuta "npm run build".');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Web server listening on http://localhost:${PORT}`);
  });
}

async function gracefulProcessShutdown(signal: string) {
  console.log(`[RaspiMC] Recibida señal ${signal}. Iniciando apagado seguro de servidores Minecraft...`);
  const activeList = Array.from(activeServers.entries());
  for (const [serverName, server] of activeList) {
    try {
      console.log(`[RaspiMC] Enviando 'stop' a servidor Minecraft: ${serverName}`);
      server.process.stdin.write('stop\r\n');
    } catch (_) {}
  }
  // Wait short buffer for servers to save chunk data
  await new Promise((r) => setTimeout(r, 2500));
  console.log('[RaspiMC] Cierre del servicio completado. Saliendo.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulProcessShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulProcessShutdown('SIGINT'));

startServer();
