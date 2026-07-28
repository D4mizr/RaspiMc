/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

export type RoutePage = 
  | 'raspi-status' 
  | 'settings' 
  | 'mc-list' 
  | 'mc-detail' 
  | 'mc-config' 
  | 'mc-console'
  | 'mc-logs';

export interface Route {
  page: RoutePage;
  serverName: string | null;
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  
  if (path === '' || path === '/' || path.startsWith('/raspi/status')) {
    return { page: 'raspi-status', serverName: null };
  }
  if (path.startsWith('/settings')) {
    return { page: 'settings', serverName: null };
  }
  if (path === '/mc' || path === '/mc/') {
    return { page: 'mc-list', serverName: null };
  }
  
  // Match /mc/{serverName}/config
  const mcConfigMatch = path.match(/^\/mc\/([^/]+)\/config\/?$/);
  if (mcConfigMatch) {
    return { page: 'mc-config', serverName: decodeURIComponent(mcConfigMatch[1]) };
  }
  
  // Match /mc/{serverName}/console
  const mcConsoleMatch = path.match(/^\/mc\/([^/]+)\/console\/?$/);
  if (mcConsoleMatch) {
    return { page: 'mc-console', serverName: decodeURIComponent(mcConsoleMatch[1]) };
  }

  // Match /mc/{serverName}/logs
  const mcLogsMatch = path.match(/^\/mc\/([^/]+)\/logs\/?$/);
  if (mcLogsMatch) {
    return { page: 'mc-logs', serverName: decodeURIComponent(mcLogsMatch[1]) };
  }
  
  // Match /mc/{serverName}
  const mcDetailMatch = path.match(/^\/mc\/([^/]+)\/?$/);
  if (mcDetailMatch) {
    return { page: 'mc-detail', serverName: decodeURIComponent(mcDetailMatch[1]) };
  }
  
  // Fallback
  return { page: 'raspi-status', serverName: null };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    const targetHash = `#${formattedPath}`;
    if (window.location.hash === targetHash) return;
    window.location.hash = formattedPath;
  };

  return {
    route,
    navigate,
  };
}
