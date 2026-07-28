/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Search, 
  Download, 
  Copy, 
  Check, 
  ChevronLeft, 
  FileCode, 
  Clock, 
  AlertCircle,
  ArrowDown
} from 'lucide-react';
import { MinecraftServer } from '../types';

interface LogFileEntry {
  name: string;
  size: number;
  mtime: string;
  isLatest: boolean;
}

interface McLogsProps {
  server: MinecraftServer;
  navigate: (path: string) => void;
}

export default function McLogs({ server, navigate }: McLogsProps) {
  const [logFiles, setLogFiles] = useState<LogFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('latest.log');
  const [logContent, setLogContent] = useState<string>('');
  const [lineCount, setLineCount] = useState<number>(0);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch list of available log files
  const fetchLogFiles = async (autoSelectLatest = false) => {
    setLoadingFiles(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(server.name)}/log-files`);
      if (!res.ok) throw new Error('No se pudieron obtener los archivos de log.');
      const files: LogFileEntry[] = await res.json();
      setLogFiles(files);

      if (files.length > 0) {
        // Auto-select latest.log if present, else first file
        const latest = files.find(f => f.isLatest) || files[0];
        if (autoSelectLatest || !selectedFile) {
          setSelectedFile(latest.name);
          loadLogContent(latest.name);
        } else {
          // Refresh content of currently selected file
          loadLogContent(selectedFile);
        }
      } else {
        setLogContent('[INFO] No hay archivos de registros registrados para este servidor.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar los logs.');
    } finally {
      setLoadingFiles(false);
    }
  };

  // Load content of a specific log file
  const loadLogContent = async (fileName: string) => {
    setLoadingContent(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(server.name)}/log-files/view?file=${encodeURIComponent(fileName)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fallo al leer el archivo de log.');
      }
      const data = await res.json();
      setLogContent(data.content || '');
      setLineCount(data.lineCount || 0);
    } catch (err: any) {
      setError(err.message || 'Error al descargar/leer el contenido del log.');
      setLogContent('');
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    fetchLogFiles(true);
  }, [server.name]);

  const handleSelectFile = (fileName: string) => {
    setSelectedFile(fileName);
    loadLogContent(fileName);
  };

  const handleCopy = () => {
    if (!logContent) return;
    navigator.clipboard.writeText(logContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!logContent || !selectedFile) return;
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.endsWith('.gz') ? selectedFile.replace('.gz', '') : selectedFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter lines if search query exists
  const lines = logContent ? logContent.split('\n') : [];
  const filteredLines = searchQuery.trim()
    ? lines.filter(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines;

  return (
    <div className="space-y-6" id="mc-logs-container">
      {/* Return button & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4" id="mc-logs-header">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate(`/mc/${encodeURIComponent(server.name)}`)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition"
            title="Volver"
            id="logs-back-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-mono">
              Registros e Histórico de Logs: {server.name}
            </h2>
            <p className="text-sm text-slate-400">
              Explora y analiza los archivos de registros oficiales creados por el servidor de Minecraft.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2" id="logs-actions">
          <button
            onClick={() => fetchLogFiles(false)}
            disabled={loadingFiles || loadingContent}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
            id="logs-refresh-btn"
          >
            <RefreshCw size={14} className={loadingFiles || loadingContent ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={!logContent}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
            id="logs-copy-btn"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copiado' : 'Copiar Log'}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!logContent}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow disabled:opacity-50"
            id="logs-download-btn"
          >
            <Download size={14} />
            <span>Descargar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-2.5 text-sm" id="logs-error-banner">
          <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Logs View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="logs-grid">
        
        {/* Left Sidebar: List of log files */}
        <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-2xl border border-slate-800 space-y-3" id="logs-file-sidebar">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode size={14} className="text-indigo-400" />
              <span>Archivos ({logFiles.length})</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">/logs</span>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1" id="log-files-list">
            {loadingFiles ? (
              <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
                Cargando lista de archivos...
              </div>
            ) : logFiles.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No se encontraron archivos en /logs
              </div>
            ) : (
              logFiles.map((file) => {
                const isSelected = selectedFile === file.name;
                return (
                  <button
                    key={file.name}
                    onClick={() => handleSelectFile(file.name)}
                    className={`
                      w-full text-left p-2.5 rounded-xl border transition flex flex-col gap-1
                      ${isSelected 
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 shadow' 
                        : 'bg-slate-950/60 hover:bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
                      }
                    `}
                    id={`log-file-item-${file.name}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-semibold truncate flex items-center gap-1.5">
                        <FileText size={13} className={file.isLatest ? 'text-indigo-400' : 'text-slate-500'} />
                        {file.name}
                      </span>
                      {file.isLatest && (
                        <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[9px] font-bold rounded uppercase tracking-wider border border-indigo-500/30">
                          Último
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                      <span>{formatFileSize(file.size)}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {file.mtime ? new Date(file.mtime).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Area: Log Content Viewer */}
        <div className="lg:col-span-3 space-y-3" id="logs-viewer-panel">
          
          {/* Search bar & info bar */}
          <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en el contenido del registro..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-600"
                id="logs-search-input"
              />
              {searchQuery && (
                <span className="absolute right-3 top-2 text-[10px] text-indigo-400 font-mono">
                  {filteredLines.length} coincidencias
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
              <span>
                Archivo: <strong className="text-slate-200">{selectedFile}</strong>
              </span>
              <span>•</span>
              <span>
                Líneas: <strong className="text-indigo-400">{filteredLines.length}</strong> / {lineCount}
              </span>
              <button
                onClick={scrollToBottom}
                className="p-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded text-[10px] flex items-center gap-1 transition"
                title="Ir al final"
                id="logs-scroll-bottom-btn"
              >
                <ArrowDown size={12} />
                <span>Ir al final</span>
              </button>
            </div>
          </div>

          {/* Terminal Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
            <div 
              ref={logContainerRef}
              className="p-4 h-[600px] overflow-y-auto font-mono text-xs text-slate-300 space-y-1 select-text scrollbar-thin"
              id="logs-content-box"
            >
              {loadingContent ? (
                <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                  <RefreshCw size={18} className="animate-spin text-indigo-500" />
                  <span>Cargando contenido del log ({selectedFile})...</span>
                </div>
              ) : filteredLines.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">
                  {searchQuery ? 'No se encontraron líneas que coincidan con la búsqueda.' : 'Archivo de log vacío.'}
                </div>
              ) : (
                filteredLines.map((line, idx) => {
                  let textClass = 'text-slate-300';
                  if (line.includes('WARN') || line.includes('WARNING')) textClass = 'text-amber-400';
                  else if (line.includes('ERROR') || line.includes('FATAL') || line.includes('Exception')) textClass = 'text-rose-400';
                  else if (line.includes('INFO')) textClass = 'text-slate-300';
                  else if (line.startsWith('>')) textClass = 'text-emerald-400 font-bold';

                  return (
                    <div key={idx} className="flex hover:bg-slate-900/60 rounded px-1.5 py-0.5 transition">
                      <span className="text-slate-600 select-none w-10 text-right pr-3 shrink-0 text-[10px]">
                        {idx + 1}
                      </span>
                      <span className={`break-all whitespace-pre-wrap ${textClass}`}>
                        {line}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
