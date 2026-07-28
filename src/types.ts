/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppSettings {
  serversDirs: string[];
  javaPath: string;
  backupDir: string;
  defaultRamGb: number;
  autoStartOnBoot?: boolean;
}

export interface SystemStatus {
  cpuUsage: number;
  cpuHistory: number[]; // For a live small Sparkline chart!
  ramTotal: number; // in GB
  ramUsed: number; // in GB
  storageTotal: number; // in GB
  storageUsed: number; // in GB
  temperature: number | null; // null on Windows
  uptime: string | null;
  ipAddress: string;
  ethernetConnected: boolean;
  dataSourceStatus: 'live' | 'cached' | 'unavailable';
  connectionType?: 'wifi' | 'ethernet' | 'unknown';
  wifiSsid?: string | null;
  adapterName?: string | null;
  serversDir?: string;
  serversDirs?: string[];
  hotspot?: {
    active: boolean;
    ssid: string;
    password: string;
    ip: string;
    interface: string;
    clientsCount: number;
  };
}

export type ServerStatus = 'online' | 'offline' | 'starting' | 'stopping';

export interface MinecraftServer {
  name: string;
  location?: string;
  status: ServerStatus;
  installed?: boolean;
  version: string;
  type: 'Vanilla' | 'Paper' | 'Forge' | 'Fabric';
  ip: string;
  port: number;
  playersMax: number;
  playersOnline: number;
  playersList: string[];
  motd: string;
  worldName: string;
  worldSeed: string;
  gameMode: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  pvp: boolean;
  spawnProtection: number;
  viewDistance: number;
  allowFlight: boolean;
  enableCommandBlocks: boolean;
  whiteList?: boolean;
  onlineMode?: boolean;
  spawnAnimals?: boolean;
  spawnMonsters?: boolean;
  spawnNpcs?: boolean;
  allowNether?: boolean;
  forceGamemode?: boolean;
  requireResourcePack?: boolean;
  resourcePack?: string;
  resourcePackPrompt?: string;
  ramAllocated: number; // in GB (Max RAM)
  ramMinAllocated?: number; // in GB (Min RAM)
  eulaAccepted?: boolean;
  hasCustomIcon?: boolean;
}

export interface ConsoleLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface DownloadTask {
  id: string;
  serverName: string;
  type: string;
  version: string;
  percent: number;
  status: 'resolving' | 'starting_download' | 'downloading' | 'configuring' | 'complete' | 'error';
  message: string;
  error?: string;
}

export interface PlayerData {
  name: string;
  serverName: string;
  status: 'online' | 'offline';
  coordinates: {
    x: number;
    y: number;
    z: number;
    dimension?: string;
  } | null;
  health: number | null;
  hunger: number | null;
  lastUpdated?: string;
  message?: string;
}
