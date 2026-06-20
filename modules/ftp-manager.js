/**
 * FTP/SFTP File Manager Module — Premium Console Suite
 * Dual-panel file manager with drag & drop support
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('ftpApp', () => ({
    // Connection
    connected: false,
    connecting: false,
    connectionError: '',
    config: {
      protocol: 'sftp', // ftp | sftp
      host: '',
      port: 22,
      username: '',
      password: '',
      proxyUrl: 'http://localhost:8888', // Backend FTP proxy endpoint
      passive: true,
      encoding: 'UTF-8',
    },

    // Saved connections
    savedConnections: [],
    searchConn: '',
    showNewConn: false,

    // File panels
    localCwd: '/local/home',
    remoteCwd: '/',
    localFiles: [],
    remoteFiles: [],
    localSelected: [],
    remoteSelected: [],
    localLoading: false,
    remoteLoading: false,

    // Transfer queue
    transfers: [],
    
    // UI state
    activePanel: 'remote', // local | remote
    showHidden: false,
    notification: '',
    confirmDialog: null, // { message, onConfirm }
    promptDialog: null,
    promptInput: '',
    renameTarget: null, // { file, panel, newName }

    // Demo file system
    demoRemoteFS: {
      '/': [
        { name: 'var', type: 'dir', size: 4096, modified: '2026-06-19 09:00', perms: 'drwxr-xr-x', owner: 'root' },
        { name: 'home', type: 'dir', size: 4096, modified: '2026-06-19 08:00', perms: 'drwxr-xr-x', owner: 'root' },
        { name: 'etc', type: 'dir', size: 4096, modified: '2026-06-18 21:00', perms: 'drwxr-xr-x', owner: 'root' },
        { name: 'opt', type: 'dir', size: 4096, modified: '2026-06-17 10:00', perms: 'drwxr-xr-x', owner: 'root' },
        { name: 'tmp', type: 'dir', size: 4096, modified: '2026-06-19 10:00', perms: 'drwxrwxrwt', owner: 'root' },
        { name: 'README.txt', type: 'file', size: 512, modified: '2026-06-15 08:00', perms: '-rw-r--r--', owner: 'root' },
      ],
      '/var': [
        { name: 'www', type: 'dir', size: 4096, modified: '2026-06-19 09:15', perms: 'drwxr-xr-x', owner: 'www-data' },
        { name: 'log', type: 'dir', size: 4096, modified: '2026-06-19 10:00', perms: 'drwxr-xr-x', owner: 'root' },
      ],
      '/var/www': [
        { name: 'html', type: 'dir', size: 4096, modified: '2026-06-19 09:15', perms: 'drwxr-xr-x', owner: 'www-data' },
      ],
      '/var/www/html': [
        { name: 'index.html', type: 'file', size: 2048, modified: '2026-06-19 09:15', perms: '-rw-r--r--', owner: 'www-data' },
        { name: 'assets', type: 'dir', size: 4096, modified: '2026-06-19 09:12', perms: 'drwxr-xr-x', owner: 'www-data' },
        { name: 'api', type: 'dir', size: 4096, modified: '2026-06-18 15:00', perms: 'drwxr-xr-x', owner: 'www-data' },
        { name: '.htaccess', type: 'file', size: 128, modified: '2026-06-15 10:00', perms: '-rw-r--r--', owner: 'www-data' },
      ],
      '/home': [
        { name: 'user', type: 'dir', size: 4096, modified: '2026-06-19 09:01', perms: 'drwxr-xr-x', owner: 'user' },
      ],
      '/home/user': [
        { name: 'Documents', type: 'dir', size: 4096, modified: '2026-06-19 09:01', perms: 'drwxr-xr-x', owner: 'user' },
        { name: 'Downloads', type: 'dir', size: 4096, modified: '2026-06-18 18:00', perms: 'drwxr-xr-x', owner: 'user' },
        { name: 'config.json', type: 'file', size: 1024, modified: '2026-06-19 08:30', perms: '-rw-------', owner: 'user' },
        { name: '.bashrc', type: 'file', size: 3526, modified: '2026-06-18 08:00', perms: '-rw-r--r--', owner: 'user' },
        { name: 'startup.sh', type: 'file', size: 512, modified: '2026-06-17 12:00', perms: '-rwxr-xr-x', owner: 'user' },
      ],
    },

    // Simulated local files
    localFS: {
      '/local/home': [
        { name: 'Documents', type: 'dir', size: 4096, modified: new Date().toLocaleDateString() },
        { name: 'Desktop', type: 'dir', size: 4096, modified: new Date().toLocaleDateString() },
        { name: 'Downloads', type: 'dir', size: 4096, modified: new Date().toLocaleDateString() },
        { name: 'project.zip', type: 'file', size: 524288, modified: new Date().toLocaleDateString() },
        { name: 'readme.txt', type: 'file', size: 1024, modified: new Date().toLocaleDateString() },
        { name: 'data.json', type: 'file', size: 4096, modified: new Date().toLocaleDateString() },
      ],
      '/local/home/Documents': [
        { name: 'report.pdf', type: 'file', size: 1048576, modified: new Date().toLocaleDateString() },
        { name: 'notes.txt', type: 'file', size: 2048, modified: new Date().toLocaleDateString() },
      ],
      '/local/home/Downloads': [
        { name: 'setup.exe', type: 'file', size: 52428800, modified: new Date().toLocaleDateString() },
        { name: 'backup.tar.gz', type: 'file', size: 10485760, modified: new Date().toLocaleDateString() },
      ],
    },

    init() {
      const saved = localStorage.getItem('ag_ftp_connections');
      if (saved) { try { this.savedConnections = JSON.parse(saved); } catch(e) {} }
      
      this.$watch('localFiles', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
      this.$watch('remoteFiles', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
      this.$watch('transfers', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
    },

    get filteredConnections() {
      if (!this.searchConn) return this.savedConnections;
      const q = this.searchConn.toLowerCase();
      return this.savedConnections.filter(c => c.host.toLowerCase().includes(q) || c.username.toLowerCase().includes(q));
    },

    async connect() {
      if (!this.config.host) { this.connectionError = 'Host is required'; return; }
      this.connectionError = '';
      this.connecting = true;
      
      // Try real backend connection
      try {
        const res = await fetch(`${this.config.proxyUrl}/ftp/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.config),
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error('Backend error');
        this.connecting = false;
        this.connected = true;
        this.saveConnection();
        this.loadRemoteDir('/');
        this.loadLocalDir('/local/home');
      } catch(e) {
        // Demo mode
        this.connecting = false;
        this.connected = true;
        this.saveConnection();
        this.showNotification(`⚠ Demo Mode — Backend proxy not found. Showing simulated files.`);
        this.loadRemoteDir('/');
        this.loadLocalDir('/local/home');
      }
    },

    disconnect() {
      this.connected = false;
      this.remoteFiles = [];
      this.localFiles = [];
      this.remoteCwd = '/';
      this.localSelected = [];
      this.remoteSelected = [];
    },

    loadRemoteDir(path) {
      this.remoteLoading = true;
      this.remoteCwd = path;
      this.remoteSelected = [];
      setTimeout(() => {
        const files = this.demoRemoteFS[path] || [];
        this.remoteFiles = this.showHidden ? files : files.filter(f => !f.name.startsWith('.'));
        this.remoteLoading = false;
      }, 300);
    },

    loadLocalDir(path) {
      this.localLoading = true;
      this.localCwd = path;
      this.localSelected = [];
      setTimeout(() => {
        const files = this.localFS[path] || [];
        this.localFiles = files;
        this.localLoading = false;
      }, 200);
    },

    navigateRemote(file) {
      if (file.type === 'dir') {
        const newPath = this.remoteCwd === '/' ? `/${file.name}` : `${this.remoteCwd}/${file.name}`;
        this.loadRemoteDir(newPath);
      }
    },

    navigateLocal(file) {
      if (file.type === 'dir') {
        const newPath = this.localCwd === '/local/home' ? `/local/home/${file.name}` : `${this.localCwd}/${file.name}`;
        this.loadLocalDir(newPath);
      }
    },

    goUpRemote() {
      if (this.remoteCwd === '/') return;
      const parts = this.remoteCwd.split('/');
      parts.pop();
      this.loadRemoteDir(parts.join('/') || '/');
    },

    goUpLocal() {
      if (this.localCwd === '/local/home') return;
      const parts = this.localCwd.split('/');
      parts.pop();
      this.loadLocalDir(parts.join('/') || '/local/home');
    },

    toggleSelect(name, panel) {
      const arr = panel === 'remote' ? this.remoteSelected : this.localSelected;
      const idx = arr.indexOf(name);
      if (idx === -1) arr.push(name);
      else arr.splice(idx, 1);
    },

    isSelected(name, panel) {
      return panel === 'remote' ? this.remoteSelected.includes(name) : this.localSelected.includes(name);
    },

    uploadFiles() {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = (e) => {
        Array.from(e.target.files).forEach(file => {
          const transfer = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            direction: 'upload',
            progress: 0,
            status: 'uploading', // uploading | done | error
          };
          this.transfers.unshift(transfer);
          // Simulate transfer
          this.simulateTransfer(transfer);
        });
      };
      input.click();
    },

    downloadSelected() {
      if (this.remoteSelected.length === 0) { this.showNotification('Select files to download'); return; }
      this.remoteSelected.forEach(name => {
        const file = this.remoteFiles.find(f => f.name === name);
        if (!file || file.type === 'dir') return;
        const transfer = {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          direction: 'download',
          progress: 0,
          status: 'downloading',
        };
        this.transfers.unshift(transfer);
        this.simulateTransfer(transfer);
      });
    },

    simulateTransfer(transfer) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        transfer.progress = Math.min(Math.round(progress), 100);
        if (transfer.progress >= 100) {
          transfer.status = 'done';
          clearInterval(interval);
          this.showNotification(`✅ ${transfer.name} ${transfer.direction === 'upload' ? 'uploaded' : 'downloaded'}`);
        }
      }, 150);
    },

    deleteSelected(panel) {
      const selected = panel === 'remote' ? this.remoteSelected : this.localSelected;
      if (selected.length === 0) return;
      this.confirmDialog = {
        message: `Delete ${selected.length} item(s)?`,
        onConfirm: () => {
          if (panel === 'remote') {
            this.remoteFiles = this.remoteFiles.filter(f => !this.remoteSelected.includes(f.name));
            this.remoteSelected = [];
          } else {
            this.localFiles = this.localFiles.filter(f => !this.localSelected.includes(f.name));
            this.localSelected = [];
          }
          this.confirmDialog = null;
          this.showNotification('✅ Items deleted');
        }
      };
    },

    createDirectory(panel) {
      this.promptInput = '';
      this.promptDialog = {
        title: 'New Folder',
        label: 'Folder Name',
        placeholder: 'Enter folder name...',
        callback: (name) => {
          if (!name || !name.trim()) return;
          const newDir = { name: name.trim(), type: 'dir', size: 4096, modified: new Date().toLocaleString(), perms: 'drwxr-xr-x', owner: 'user' };
          if (panel === 'remote') this.remoteFiles.unshift(newDir);
          else this.localFiles.unshift(newDir);
          this.showNotification(`✅ Folder "${name.trim()}" created`);
        }
      };
    },

    startRename(file, panel) {
      this.renameTarget = { file, panel, newName: file.name };
    },

    confirmRename() {
      if (!this.renameTarget || !this.renameTarget.newName) return;
      const { file, panel, newName } = this.renameTarget;
      file.name = newName;
      this.renameTarget = null;
      this.showNotification(`✅ Renamed to "${newName}"`);
    },

    formatSize(bytes) {
      if (!bytes) return '-';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    },

    fileIcon(file) {
      if (file.type === 'dir') return 'folder';
      const ext = file.name.split('.').pop().toLowerCase();
      const icons = {
        js: 'file-code-2', ts: 'file-code-2', py: 'file-code-2', php: 'file-code-2',
        html: 'file-code-2', css: 'file-code-2', json: 'file-json',
        txt: 'file-text', md: 'file-text', log: 'file-text',
        zip: 'file-archive', gz: 'file-archive', tar: 'file-archive', rar: 'file-archive',
        jpg: 'file-image', jpeg: 'file-image', png: 'file-image', gif: 'file-image',
        pdf: 'file-type', sh: 'terminal', exe: 'settings',
      };
      return icons[ext] || 'file';
    },

    fileColor(file) {
      if (file.type === 'dir') return 'text-blue-400';
      const ext = file.name.split('.').pop().toLowerCase();
      if (['js', 'ts', 'py', 'php', 'html', 'css'].includes(ext)) return 'text-emerald-400';
      if (['zip', 'gz', 'tar', 'rar'].includes(ext)) return 'text-amber-400';
      if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'text-purple-400';
      if (['sh', 'bash'].includes(ext)) return 'text-green-400';
      if (ext === 'pdf') return 'text-red-400';
      return 'text-slate-300';
    },

    saveConnection() {
      const exists = this.savedConnections.find(c => c.host === this.config.host && c.username === this.config.username);
      if (!exists) {
        this.savedConnections.unshift({
          id: Date.now(),
          label: `${this.config.username}@${this.config.host}`,
          protocol: this.config.protocol,
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          lastUsed: new Date().toLocaleDateString(),
        });
        localStorage.setItem('ag_ftp_connections', JSON.stringify(this.savedConnections));
      }
    },

    loadConnection(c) {
      this.config.protocol = c.protocol;
      this.config.host = c.host;
      this.config.port = c.port;
      this.config.username = c.username;
    },

    deleteConnection(id) {
      this.confirmDialog = {
        message: 'Are you sure you want to delete this connection profile?',
        onConfirm: () => {
          this.savedConnections = this.savedConnections.filter(c => c.id !== id);
          localStorage.setItem('ag_ftp_connections', JSON.stringify(this.savedConnections));
          this.showNotification('❌ Connection profile deleted');
          this.confirmDialog = null;
        }
      };
    },

    refreshRemote() { this.loadRemoteDir(this.remoteCwd); },
    refreshLocal() { this.loadLocalDir(this.localCwd); },

    showNotification(msg) {
      this.notification = msg;
      setTimeout(() => this.notification = '', 4000);
    },

    removeTransfer(id) {
      this.transfers = this.transfers.filter(t => t.id !== id);
    },

    get hasActiveTransfers() {
      return this.transfers.some(t => t.status !== 'done' && t.status !== 'error');
    },
  }));
});
