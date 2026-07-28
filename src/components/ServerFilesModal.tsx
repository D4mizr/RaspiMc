/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Folder, 
  FileText, 
  FolderPlus, 
  FilePlus, 
  Search, 
  ChevronRight, 
  Home, 
  ArrowLeft, 
  Save, 
  Trash2, 
  RefreshCw, 
  FileCode, 
  Settings, 
  FileCheck, 
  AlertCircle, 
  Check, 
  HardDrive,
  Download,
  Eye,
  Upload,
  UploadCloud,
  FileUp,
  AlertTriangle
} from 'lucide-react';

interface FileItem {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension: string;
}

interface ServerFilesModalProps {
  serverName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ServerFilesModal({ serverName, isOpen, onClose }: ServerFilesModalProps) {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Editor state
  const [activeEditingFile, setActiveEditingFile] = useState<{ filepath: string; name: string; content: string; originalContent: string } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Create Item Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createItemName, setCreateItemName] = useState<string>('');
  const [isCreateFolder, setIsCreateFolder] = useState<boolean>(false);

  // Delete confirmation state
  const [itemToDelete, setItemToDelete] = useState<FileItem | null>(null);

  // File Upload / Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string; percent: number } | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Conflicts State
  const [conflictsToResolve, setConflictsToResolve] = useState<{ files: File[]; conflictNames: string[] } | null>(null);

  // Load directory items
  const loadDirectory = (subpath: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    fetch(`/api/servers/${encodeURIComponent(serverName)}/files?subpath=${encodeURIComponent(subpath)}`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Error al cargar directorio'); });
        return res.json();
      })
      .then(data => {
        if (data.items) {
          setItems(data.items);
          setCurrentPath(data.currentPath || subpath);
        }
      })
      .catch(err => {
        setErrorMsg(err.message);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentPath('/');
      setSearchQuery('');
      setSearchResults([]);
      setActiveEditingFile(null);
      setUploadStatusMsg(null);
      setConflictsToResolve(null);
      loadDirectory('/');
    }
  }, [isOpen, serverName]);

  // Execute recursive file search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);
    fetch(`/api/servers/${encodeURIComponent(serverName)}/files/search?q=${encodeURIComponent(searchQuery.trim())}`)
      .then(res => res.json())
      .then(data => {
        if (data.results) {
          setSearchResults(data.results);
        }
      })
      .catch(() => setErrorMsg('Error en la búsqueda de archivos'))
      .finally(() => setIsSearching(false));
  };

  // Clear search and return to directory view
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // Open file for editing
  const handleOpenFile = (filepath: string) => {
    setIsReadingFile(true);
    setErrorMsg(null);
    fetch(`/api/servers/${encodeURIComponent(serverName)}/files/read?filepath=${encodeURIComponent(filepath)}`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'No se pudo leer el archivo'); });
        return res.json();
      })
      .then(data => {
        if (data.content !== undefined) {
          setActiveEditingFile({
            filepath: data.filepath,
            name: data.name,
            content: data.content,
            originalContent: data.content
          });
        }
      })
      .catch(err => setErrorMsg(err.message))
      .finally(() => setIsReadingFile(false));
  };

  // Save file to disk
  const handleSaveFile = () => {
    if (!activeEditingFile) return;

    setIsSavingFile(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    fetch(`/api/servers/${encodeURIComponent(serverName)}/files/save`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filepath: activeEditingFile.filepath,
        content: activeEditingFile.content
      })
    })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Error al guardar archivo'); });
        return res.json();
      })
      .then(data => {
        setSaveSuccessMsg(data.message || 'Archivo guardado correctamente en el disco.');
        setActiveEditingFile(prev => prev ? { ...prev, originalContent: prev.content } : null);
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      })
      .catch(err => setErrorMsg(err.message))
      .finally(() => setIsSavingFile(false));
  };

  // Handle file/folder creation
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createItemName.trim()) return;

    fetch(`/api/servers/${encodeURIComponent(serverName)}/files/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subpath: currentPath,
        name: createItemName.trim(),
        isDirectory: isCreateFolder
      })
    })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Error al crear elemento'); });
        return res.json();
      })
      .then(() => {
        setShowCreateModal(false);
        setCreateItemName('');
        loadDirectory(currentPath);
      })
      .catch(err => setErrorMsg(err.message));
  };

  // Handle deletion
  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;

    fetch(`/api/servers/${encodeURIComponent(serverName)}/files/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath: itemToDelete.relativePath })
    })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Error al eliminar'); });
        return res.json();
      })
      .then(() => {
        setItemToDelete(null);
        if (searchQuery) {
          handleSearch({ preventDefault: () => {} } as any);
        } else {
          loadDirectory(currentPath);
        }
      })
      .catch(err => setErrorMsg(err.message));
  };

  // READ FILE AS BASE64 PROMISE
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // START FILE UPLOAD FLOW
  const handleSelectFilesClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFilesSelected = (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploadStatusMsg(null);
    checkAndUploadFiles(files, false);
  };

  const checkAndUploadFiles = async (files: File[], forceOverwrite: boolean) => {
    if (files.length === 0) return;

    // Check for conflicts if not forced overwrite
    if (!forceOverwrite) {
      try {
        const fileNames = files.map(f => f.name);
        const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/files/check-conflicts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subpath: currentPath, fileNames })
        });
        const data = await res.json();
        if (data.conflicts && data.conflicts.length > 0) {
          setConflictsToResolve({ files, conflictNames: data.conflicts });
          return;
        }
      } catch (err) {
        console.warn('Error checking conflicts, proceeding directly', err);
      }
    }

    // Perform uploads
    setIsUploading(true);
    setConflictsToResolve(null);
    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const percent = Math.round(((i + 0.5) / files.length) * 100);
      setUploadProgress({
        current: i + 1,
        total: files.length,
        currentFileName: file.name,
        percent
      });

      try {
        const fileData = await readFileAsBase64(file);
        const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/files/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subpath: currentPath,
            fileName: file.name,
            fileData,
            overwrite: forceOverwrite
          })
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || `Error al subir ${file.name}`);
        }

        successCount++;
      } catch (err: any) {
        failCount++;
        lastError = err.message;
      }
    }

    setIsUploading(false);
    setUploadProgress(null);

    if (successCount > 0) {
      setUploadStatusMsg({
        type: 'success',
        text: `¡${successCount} archivo(s) importado(s) exitosamente en "${currentPath}"! ${failCount > 0 ? `(${failCount} fallidos: ${lastError})` : ''}`
      });
      loadDirectory(currentPath);
      setTimeout(() => setUploadStatusMsg(null), 5000);
    } else if (failCount > 0) {
      setUploadStatusMsg({
        type: 'error',
        text: `No se pudieron importar los archivos: ${lastError}`
      });
    }
  };

  // DRAG & DROP HANDLERS
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      handleFilesSelected(droppedFiles);
    }
  };

  if (!isOpen) return null;

  // Helper formatting
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (item: FileItem) => {
    if (item.isDirectory) return <Folder className="text-amber-400 shrink-0" size={18} />;
    const ext = item.extension;
    if (['.yml', '.yaml', '.json', '.properties', '.toml', '.conf'].includes(ext)) {
      return <Settings className="text-indigo-400 shrink-0" size={18} />;
    }
    if (['.sh', '.bat', '.cmd', '.py'].includes(ext)) {
      return <FileCode className="text-emerald-400 shrink-0" size={18} />;
    }
    if (['.log', '.txt'].includes(ext)) {
      return <FileText className="text-slate-400 shrink-0" size={18} />;
    }
    if (['.jar', '.zip', '.tar', '.gz'].includes(ext)) {
      return <HardDrive className="text-purple-400 shrink-0" size={18} />;
    }
    return <FileText className="text-slate-500 shrink-0" size={18} />;
  };

  const isTextFile = (item: FileItem) => {
    if (item.isDirectory) return false;
    const editableExts = [
      '.yml', '.yaml', '.properties', '.json', '.txt', '.log', '.conf', 
      '.toml', '.cfg', '.sh', '.bat', '.cmd', '.py', '.js', '.md', '.sk'
    ];
    return editableExts.includes(item.extension) || item.size < 2 * 1024 * 1024;
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn" id="server-files-modal">
      
      {/* Hidden File Input */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) {
            handleFilesSelected(Array.from(e.target.files) as File[]);
          }
        }}
        className="hidden"
      />

      <div className="w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Folder size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Explorador de Archivos</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 bg-slate-850 text-indigo-300 rounded border border-slate-800">
                  {serverName}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Navega, crea, edita e importa archivos locales directamente en las carpetas del servidor.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            id="close-files-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Error or Upload Status Banner */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {uploadStatusMsg && (
          <div className={`mx-4 mt-3 p-3 rounded-xl border text-xs flex items-center justify-between shrink-0 animate-fadeIn ${
            uploadStatusMsg.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {uploadStatusMsg.type === 'success' ? <Check size={16} className="text-emerald-400 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 shrink-0" />}
              <span className="font-semibold">{uploadStatusMsg.text}</span>
            </div>
            <button onClick={() => setUploadStatusMsg(null)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Upload Progress Bar Banner */}
        {isUploading && uploadProgress && (
          <div className="mx-4 mt-3 p-3.5 bg-indigo-950/50 border border-indigo-500/30 rounded-xl text-xs space-y-2 shrink-0 animate-fadeIn">
            <div className="flex items-center justify-between text-indigo-200">
              <div className="flex items-center gap-2 font-semibold">
                <RefreshCw size={14} className="animate-spin text-indigo-400" />
                <span>Importando archivo ({uploadProgress.current}/{uploadProgress.total}): <code className="text-white font-mono">{uploadProgress.currentFileName}</code></span>
              </div>
              <span className="font-mono font-bold text-indigo-300">{uploadProgress.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Content Body: Explorer or Editor */}
        {activeEditingFile ? (
          /* FILE EDITOR VIEW */
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950" id="file-editor-view">
            {/* Editor Top Bar */}
            <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3 truncate">
                <button
                  onClick={() => setActiveEditingFile(null)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                  id="editor-back-btn"
                >
                  <ArrowLeft size={14} />
                  <span>Volver a Archivos</span>
                </button>
                <span className="text-xs font-mono text-slate-400 truncate">
                  {activeEditingFile.filepath}
                </span>
                {activeEditingFile.content !== activeEditingFile.originalContent && (
                  <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                    Sin guardar *
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {saveSuccessMsg && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-fadeIn">
                    <Check size={14} />
                    <span>{saveSuccessMsg}</span>
                  </span>
                )}
                <button
                  onClick={handleSaveFile}
                  disabled={isSavingFile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition cursor-pointer"
                  id="save-file-btn"
                >
                  {isSavingFile ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>Guardar Archivo</span>
                </button>
              </div>
            </div>

            {/* Textarea Code Editor */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <textarea
                value={activeEditingFile.content}
                onChange={(e) => setActiveEditingFile({ ...activeEditingFile, content: e.target.value })}
                placeholder="Escribe el contenido del archivo..."
                spellCheck={false}
                className="w-full h-full p-4 bg-slate-900/90 text-slate-200 border border-slate-800 rounded-xl font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-medium selection:bg-indigo-500/30"
                id="file-content-textarea"
              />
            </div>
          </div>
        ) : (
          /* FILE BROWSER VIEW WITH DRAG AND DROP */
          <div 
            className="flex-1 flex flex-col overflow-hidden relative" 
            id="file-browser-view"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag & Drop Visual Overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-40 bg-indigo-950/90 border-2 border-dashed border-indigo-500 rounded-xl backdrop-blur-sm flex flex-col items-center justify-center space-y-3 pointer-events-none animate-fadeIn">
                <div className="p-4 bg-indigo-500/20 rounded-full text-indigo-400 animate-bounce">
                  <UploadCloud size={48} />
                </div>
                <p className="text-base font-bold text-white">
                  Suelta tus archivos aquí para importarlos
                </p>
                <p className="text-xs text-indigo-300 font-mono">
                  Destino: {currentPath}
                </p>
              </div>
            )}

            {/* Toolbar: Breadcrumb + Search + Upload & Create Actions */}
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Breadcrumb Path */}
              <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-mono bg-slate-950 px-3 py-2 rounded-xl border border-slate-850 text-slate-300 flex-1">
                <button
                  onClick={() => { clearSearch(); loadDirectory('/'); }}
                  className="hover:text-indigo-400 text-slate-400 flex items-center gap-1 cursor-pointer"
                  title="Inicio (/)"
                >
                  <Home size={14} />
                  <span>servidor</span>
                </button>
                {pathParts.map((part, index) => {
                  const pathUpToHere = '/' + pathParts.slice(0, index + 1).join('/');
                  return (
                    <React.Fragment key={pathUpToHere}>
                      <ChevronRight size={12} className="text-slate-600 shrink-0" />
                      <button
                        onClick={() => { clearSearch(); loadDirectory(pathUpToHere); }}
                        className="hover:text-indigo-400 font-medium cursor-pointer truncate max-w-[120px]"
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Search input & actions */}
              <div className="flex items-center gap-2">
                <form onSubmit={handleSearch} className="relative w-full md:w-48">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar archivos..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="file-search-input"
                  />
                  <Search size={14} className="absolute left-2.5 top-2 text-slate-500" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-2 top-2 text-slate-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </form>

                {/* Import / Upload Action Button */}
                <button
                  onClick={handleSelectFilesClick}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Importar archivos locales a esta carpeta"
                  id="upload-file-btn"
                >
                  <Upload size={14} />
                  <span>Subir</span>
                </button>

                <button
                  onClick={() => { setIsCreateFolder(false); setCreateItemName(''); setShowCreateModal(true); }}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                  title="Nuevo Archivo"
                  id="create-file-btn"
                >
                  <FilePlus size={15} className="text-indigo-400" />
                </button>

                <button
                  onClick={() => { setIsCreateFolder(true); setCreateItemName(''); setShowCreateModal(true); }}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                  title="Nueva Carpeta"
                  id="create-folder-btn"
                >
                  <FolderPlus size={15} className="text-amber-400" />
                </button>

                <button
                  onClick={() => loadDirectory(currentPath)}
                  disabled={isLoading}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                  title="Refrescar Lista"
                  id="refresh-files-btn"
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* File Items Table / Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Search Results Banner */}
              {searchQuery && (
                <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
                  <span>Resultados de búsqueda para &ldquo;<strong>{searchQuery}</strong>&rdquo;: ({searchResults.length} encontrados)</span>
                  <button onClick={clearSearch} className="text-indigo-400 hover:underline">Limpiar búsqueda</button>
                </div>
              )}

              {isLoading || isSearching || isReadingFile ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
                  <RefreshCw size={28} className="animate-spin text-indigo-400" />
                  <span className="text-xs font-mono">Cargando contenido del servidor...</span>
                </div>
              ) : (searchQuery ? searchResults : items).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
                  <UploadCloud size={42} className="text-slate-700" />
                  <span className="text-sm font-semibold text-slate-400">Esta carpeta está vacía</span>
                  <p className="text-xs text-slate-600 max-w-sm text-center">
                    Arrastra y suelta archivos aquí para importarlos o utiliza el botón <strong className="text-indigo-400">Subir</strong> para agregarlos desde tu equipo.
                  </p>
                  <button
                    onClick={handleSelectFilesClick}
                    className="mt-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload size={14} />
                    <span>Seleccionar Archivos</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Parent Directory Link */}
                  {!searchQuery && currentPath !== '/' && (
                    <div
                      onClick={() => {
                        const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
                        loadDirectory(parent);
                      }}
                      className="flex items-center space-x-3 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer text-xs font-mono transition"
                    >
                      <Folder className="text-amber-500/70" size={18} />
                      <span className="font-bold">.. (Carpeta superior)</span>
                    </div>
                  )}

                  {/* List File Items */}
                  {(searchQuery ? searchResults : items).map((item) => (
                    <div
                      key={item.relativePath}
                      className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-850 border border-transparent hover:border-slate-800 text-xs font-mono transition"
                      id={`file-item-${item.name}`}
                    >
                      <div 
                        onClick={() => {
                          if (item.isDirectory) {
                            clearSearch();
                            loadDirectory(item.relativePath);
                          } else if (isTextFile(item)) {
                            handleOpenFile(item.relativePath);
                          }
                        }}
                        className="flex items-center space-x-3 flex-1 cursor-pointer truncate"
                      >
                        {getFileIcon(item)}
                        <span className="font-semibold text-slate-200 group-hover:text-indigo-400 truncate">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-6 text-slate-500 shrink-0">
                        <span className="w-20 text-right font-medium">
                          {item.isDirectory ? 'Carpeta' : formatBytes(item.size)}
                        </span>
                        <span className="hidden sm:inline-block w-36 text-right text-[11px]">
                          {new Date(item.modifiedAt).toLocaleDateString()} {new Date(item.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {/* Item Actions */}
                        <div className="flex items-center space-x-1">
                          {isTextFile(item) && (
                            <button
                              onClick={() => handleOpenFile(item.relativePath)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition cursor-pointer"
                              title="Editar archivo"
                            >
                              <FileText size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Servidor: <strong className="text-slate-300 font-mono">{serverName}</strong></span>
          <span className="flex items-center gap-2">
            <span>Carpeta actual: <strong className="text-indigo-400 font-mono">{currentPath}</strong></span>
          </span>
        </div>
      </div>

      {/* CONFLICT RESOLUTION MODAL */}
      {conflictsToResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" id="conflict-resolution-modal">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>Archivos Ya Existentes</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Los siguientes {conflictsToResolve.conflictNames.length} archivo(s) ya existen en la carpeta <strong className="text-indigo-300 font-mono">{currentPath}</strong>:
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto space-y-1 font-mono text-xs text-amber-200">
              {conflictsToResolve.conflictNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText size={13} className="text-amber-400 shrink-0" />
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400">
              ¿Qué deseas hacer con los archivos que coinciden?
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflictsToResolve(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const filteredFiles = conflictsToResolve.files.filter(f => !conflictsToResolve.conflictNames.includes(f.name));
                  checkAndUploadFiles(filteredFiles, false);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Omitir Existentes
              </button>
              <button
                type="button"
                onClick={() => checkAndUploadFiles(conflictsToResolve.files, true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
              >
                Sobrescribir Todos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE FILE / FOLDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {isCreateFolder ? <FolderPlus className="text-amber-400" size={18} /> : <FilePlus className="text-indigo-400" size={18} />}
              <span>Crear {isCreateFolder ? 'Carpeta' : 'Archivo'} en {currentPath}</span>
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={createItemName}
                  onChange={(e) => setCreateItemName(e.target.value)}
                  placeholder={isCreateFolder ? "ej: plugins_config" : "ej: server.properties"}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertCircle size={18} />
              <span>Confirmar Eliminación</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Estás seguro de que deseas borrar permanentemente {itemToDelete.isDirectory ? 'la carpeta' : 'el archivo'} <strong className="text-white font-mono">{itemToDelete.name}</strong>?
              Esta acción no se puede deshacer en el disco.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
