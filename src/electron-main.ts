import { app, Tray, Menu, shell, BrowserWindow, dialog, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';

// Disable hardware acceleration to prevent GPU freezes/hangs on Windows environments
try {
  app.disableHardwareAcceleration();
} catch (_) {}

// Prevent multiple app instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    showOrCreateWindow();
  });
}

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// Send HTTP POST request to backend server to gracefully stop all running servers
function shutdownServers(): Promise<void> {
  return new Promise((resolve) => {
    console.log('[Shutdown] Notificando al backend para detener todos los servidores Minecraft...');
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/shutdown',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 12000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          console.log('[Shutdown] Respuesta del backend tras detener servidores:', body);
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      console.warn('[Shutdown] Excepción de red o backend no disponible al apagar:', err.message);
      resolve();
    });

    req.on('timeout', () => {
      console.warn('[Shutdown] Timeout esperando respuesta de apagado del servidor.');
      req.destroy();
      resolve();
    });

    req.end();
  });
}

async function handleQuit() {
  if (isQuitting) return;
  isQuitting = true;

  console.log('[Quit] Apagando servidores Minecraft y cerrando WinMc...');

  // 1. Cleanly stop running servers
  await shutdownServers();

  // 2. Destroy Tray instance
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }

  // 3. Destroy Main Window instance
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }

  // 4. Fully exit Electron app
  app.quit();
}

// Helper to safely open the server URL in the user's default web browser
function openInBrowser() {
  try {
    shell.openExternal(SERVER_URL).catch((err) => {
      console.error('Error al abrir el navegador con shell.openExternal:', err);
    });
  } catch (err) {
    console.error('Error inesperado al abrir el navegador:', err);
  }
}

// Check server health via HTTP GET
function checkServerHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      if (res.statusCode && res.statusCode < 500) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Poll server until ready or timeout
async function waitForServer(url: string, maxWaitMs = 20000, intervalMs = 250): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const isReady = await checkServerHealth(url);
    if (isReady) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// Start the Express backend server
function startBackendServer() {
  try {
    if (app.isPackaged || process.env.NODE_ENV !== 'development') {
      process.env.NODE_ENV = 'production';
    }
    const candidateServerPaths = [
      path.join(__dirname, 'server.cjs'),
      path.join(process.cwd(), 'dist', 'server.cjs'),
      path.join(__dirname, '..', 'dist', 'server.cjs'),
      path.join(app.getAppPath(), 'dist', 'server.cjs')
    ];
    const serverPath = candidateServerPaths.find((p) => fs.existsSync(p));

    if (serverPath) {
      console.log(`[Startup] web server start from ${serverPath}`);
      require(serverPath);
    } else {
      console.warn('[Startup Warning] server.cjs no fue encontrado en los caminos esperados.');
    }
  } catch (err) {
    console.error('[Startup Error] Error al iniciar el servidor backend:', err);
  }
}

// Helper to resolve icon files in dev or packaged mode
function getIconPath(filenames: string[]): string | undefined {
  const baseDirs = [
    process.cwd(),
    __dirname,
    path.join(__dirname, '..'),
    path.join(__dirname, '..', '..'),
    app.getAppPath(),
    path.join(app.getAppPath(), '..'),
    path.join(app.getAppPath(), 'dist'),
    path.join(process.cwd(), 'dist'),
  ];

  for (const base of baseDirs) {
    for (const name of filenames) {
      const candidate1 = path.join(base, 'public', name);
      if (fs.existsSync(candidate1)) return candidate1;
      const candidate2 = path.join(base, name);
      if (fs.existsSync(candidate2)) return candidate2;
    }
  }
  return undefined;
}

function getNativeIcon(filenames: string[]) {
  const iconFilePath = getIconPath(filenames);
  if (iconFilePath) {
    const img = nativeImage.createFromPath(iconFilePath);
    if (!img.isEmpty()) {
      return { path: iconFilePath, image: img };
    }
  }
  return undefined;
}

function createWindow() {
  const iconObj = getNativeIcon(['icon.ico', 'icon.png']);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'WinMc - Administrador de Servidores Minecraft',
    icon: iconObj ? iconObj.image : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  console.log('[Startup] Electron window load');
  mainWindow.loadURL(SERVER_URL).catch((err) => {
    console.error('Error al cargar la URL en la ventana de Electron:', err);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function showOrCreateWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function createTray() {
  const trayIconObj = getNativeIcon(['tray-icon.png', 'icon.ico', 'icon.png']);

  if (trayIconObj) {
    tray = new Tray(trayIconObj.image);
  } else {
    console.warn('[Tray Warning] No se pudo encontrar imagen válida para el icono de la bandeja.');
    return;
  }

  tray.setToolTip('WinMc / RaspiMC - Administrador de Servidores Minecraft');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'WinMc Server Manager',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open app',
      click: () => {
        showOrCreateWindow();
      }
    },
    {
      label: 'Abrir en Navegador (Open in Browser)',
      click: () => {
        openInBrowser();
      }
    },
    {
      label: 'Estado: Servidor Activo (Puerto 3000)',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit WinMc',
      click: () => {
        handleQuit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    showOrCreateWindow();
  });

  tray.on('double-click', () => {
    showOrCreateWindow();
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Ensure default servers directory exists in user Documents/RaspiMC/servers
  try {
    const home = app.getPath('documents');
    const defaultServersDir = path.join(home, 'RaspiMC', 'servers');
    if (!fs.existsSync(defaultServersDir)) {
      fs.mkdirSync(defaultServersDir, { recursive: true });
    }
  } catch (err) {
    console.error('Error verificando carpeta de documentos:', err);
  }

  // 1. Web server start
  console.log('[Startup] web server start');
  startBackendServer();

  // 2. Wait for server readiness via HTTP health polling
  const isReady = await waitForServer(`${SERVER_URL}/api/health`, 20000);

  if (!isReady) {
    console.error(`[Startup Error] Web server failed to respond on ${SERVER_URL}`);
    dialog.showErrorBox(
      'Error de Inicio de RaspiMC',
      `El servidor web no respondió a tiempo en ${SERVER_URL}.\nPor favor verifica que el puerto 3000 esté libre e inténtalo de nuevo.`
    );
    return;
  }

  // 3. Server ready
  console.log('[Startup] server ready');

  // 4. Electron window load
  createWindow();

  // 5. Create System Tray
  createTray();

  console.log('Aplicación RaspiMC lista e iniciada correctamente.');
});

// Keep application active in background
app.on('window-all-closed', () => {
  // Intentional no-op to keep tray app alive in background
});

app.on('before-quit', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    handleQuit();
  }
});
