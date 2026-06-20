/**
 * Remote Desktop Module — Premium Console Suite
 * noVNC-based VNC viewer with WebSocket support
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('remoteDesktopApp', () => ({
    connected: false,
    connecting: false,
    connectionError: '',

    config: {
      host: '',
      port: 5900,
      password: '',
      encryption: 'none', // none | tls | anon-tls
      wsPath: '/websockify',
      viewOnly: false,
      sharedSession: true,
      clipboardSync: true,
      scaling: 'local',  // local | remote | off
      quality: 6,
      compression: 2,
    },

    // noVNC instance
    rfb: null,
    rfbStatus: '',

    // Screen state
    screenWidth: 0,
    screenHeight: 0,
    mouseX: 0,
    mouseY: 0,

    // Saved sessions
    savedSessions: [],
    searchSess: '',
    notification: '',
    confirmDialog: null,
    showPasswordModal: false,
    passwordInput: '',
    rfbTempInstance: null,

    // UI state
    showControls: true,
    showClipboard: false,
    clipboardText: '',
    isFullscreen: false,
    screenshotData: null,

    init() {
      const saved = localStorage.getItem('ag_rdp_sessions');
      if (saved) { try { this.savedSessions = JSON.parse(saved); } catch(e) {} }
      this.loadNoVNC();
    },

    loadNoVNC() {
      // noVNC is loaded as ES module - check if already available
      if (window.RFB) return;
      // Load noVNC core script
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import RFB from 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js';
        window.RFB = RFB;
        window.dispatchEvent(new Event('novnc-loaded'));
      `;
      document.head.appendChild(script);
    },

    async connect() {
      if (!this.config.host) { this.connectionError = 'VNC Host is required'; return; }
      this.connectionError = '';
      this.connecting = true;
      this.rfbStatus = 'Connecting...';

      const wsProto = this.config.encryption !== 'none' ? 'wss' : 'ws';
      const wsUrl = `${wsProto}://${this.config.host}:${this.config.port}${this.config.wsPath}`;

      this.$nextTick(() => {
        try {
          this.initVNC(wsUrl);
        } catch(e) {
          this.connectionError = `Connection failed: ${e.message}`;
          this.connecting = false;
          this.rfbStatus = 'Failed';
        }
      });
    },

    initVNC(wsUrl) {
      const canvas = document.getElementById('rdp-canvas-container');
      if (!canvas) { this.connectionError = 'Canvas not found'; this.connecting = false; return; }
      canvas.innerHTML = '';

      if (!window.RFB) {
        // Fallback demo mode
        this.startDemoMode(canvas);
        return;
      }

      try {
        const rfb = new window.RFB(canvas, wsUrl, {
          credentials: { password: this.config.password },
          shared: this.config.sharedSession,
          clipViewport: false,
          dragViewport: false,
          scaleViewport: this.config.scaling === 'local',
          resizeSession: this.config.scaling === 'remote',
          showDotCursor: true,
          qualityLevel: this.config.quality,
          compressionLevel: this.config.compression,
        });

        rfb.viewOnly = this.config.viewOnly;

        rfb.addEventListener('connect', () => {
          this.connected = true;
          this.connecting = false;
          this.rfbStatus = 'Connected';
          this.saveSession();
        });

        rfb.addEventListener('disconnect', (e) => {
          this.connected = false;
          this.rfbStatus = e.detail?.clean ? 'Disconnected cleanly' : 'Connection lost';
          this.rfb = null;
        });

        rfb.addEventListener('credentialsrequired', () => {
          this.rfbTempInstance = rfb;
          this.passwordInput = '';
          this.showPasswordModal = true;
        });

        rfb.addEventListener('desktopname', (e) => {
          this.rfbStatus = `Connected to: ${e.detail.name}`;
        });

        rfb.addEventListener('clipboard', (e) => {
          if (this.config.clipboardSync) {
            this.clipboardText = e.detail.text;
          }
        });

        rfb.addEventListener('capabilities', () => {});

        rfb.addEventListener('securityfailure', (e) => {
          this.connectionError = `Security failure: ${e.detail.reason}`;
          this.connecting = false;
        });

        this.rfb = rfb;
      } catch(e) {
        this.startDemoMode(canvas);
      }
    },

    startDemoMode(canvas) {
      this.connecting = false;
      this.connected = true;
      this.rfbStatus = `Demo Mode — ${this.config.host || 'localhost'}:${this.config.port} (noVNC not loaded)`;

      // Draw a demo desktop canvas
      canvas.innerHTML = `
        <div style="width:100%;height:100%;background:#2d2d2d;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;font-family:sans-serif;">
          <div style="background:#1a1a2e;border:1px solid #4f46e5;border-radius:12px;padding:32px;text-align:center;max-width:500px;">
            <div style="font-size:48px;margin-bottom:16px;">🖥️</div>
            <h3 style="color:#a5b4fc;font-size:18px;margin:0 0 8px;">Remote Desktop — Demo Mode</h3>
            <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Connect to a real VNC server via WebSocket (websockify) to view the remote desktop here.</p>
            <div style="background:#0f172a;border-radius:8px;padding:12px;text-align:left;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">Connected to: <span style="color:#6366f1;">${this.config.host || 'localhost'}:${this.config.port}</span></p>
              <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">Protocol: <span style="color:#06b6d4;">VNC over WebSocket</span></p>
              <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">Status: <span style="color:#f59e0b;">Demo (websockify proxy required)</span></p>
            </div>
          </div>
          <p style="color:#475569;font-size:12px;">Install websockify: <code style="color:#6366f1;">pip install websockify && websockify 5900 ${this.config.host || 'localhost'}:5900</code></p>
        </div>
      `;
      canvas.style.display = 'flex';
    },

    disconnect() {
      if (this.rfb) {
        this.rfb.disconnect();
        this.rfb = null;
      }
      this.connected = false;
      this.rfbStatus = '';
      const canvas = document.getElementById('rdp-canvas-container');
      if (canvas) canvas.innerHTML = '';
    },

    sendCtrlAltDel() {
      if (this.rfb) {
        this.rfb.sendCtrlAltDel();
        this.showNotification('Ctrl+Alt+Del sent');
      }
    },

    captureScreenshot() {
      const canvas = document.querySelector('#rdp-canvas-container canvas');
      if (canvas) {
        this.screenshotData = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = this.screenshotData;
        a.download = `rdp-screenshot-${Date.now()}.png`;
        a.click();
        this.showNotification('✅ Screenshot saved');
      } else {
        this.showNotification('⚠ No active screen capture available');
      }
    },

    toggleFullscreen() {
      const el = document.getElementById('rdp-viewer-panel');
      if (!el) return;
      if (!document.fullscreenElement) {
        el.requestFullscreen().then(() => { this.isFullscreen = true; });
      } else {
        document.exitFullscreen().then(() => { this.isFullscreen = false; });
      }
    },

    sendClipboard() {
      if (this.rfb && this.clipboardText) {
        this.rfb.clipboardPasteFrom(this.clipboardText);
        this.showNotification('✅ Clipboard sent to remote');
      }
    },

    pasteToClipboard() {
      navigator.clipboard.writeText(this.clipboardText).then(() => {
        this.showNotification('✅ Copied to local clipboard');
      });
    },

    saveSession() {
      const exists = this.savedSessions.find(s => s.host === this.config.host && s.port === this.config.port);
      if (!exists) {
        this.savedSessions.unshift({
          id: Date.now(),
          label: `${this.config.host}:${this.config.port}`,
          host: this.config.host,
          port: this.config.port,
          encryption: this.config.encryption,
          lastUsed: new Date().toLocaleDateString(),
        });
        if (this.savedSessions.length > 20) this.savedSessions.pop();
        localStorage.setItem('ag_rdp_sessions', JSON.stringify(this.savedSessions));
      }
    },

    loadSession(s) {
      this.config.host = s.host;
      this.config.port = s.port;
      this.config.encryption = s.encryption;
    },

    deleteSession(id) {
      this.confirmDialog = {
        title: 'Delete Session',
        message: 'Are you sure you want to delete this saved Remote Desktop session profile?',
        callback: () => {
          this.savedSessions = this.savedSessions.filter(s => s.id !== id);
          localStorage.setItem('ag_rdp_sessions', JSON.stringify(this.savedSessions));
        }
      };
    },

    submitVncPassword() {
      if (this.rfbTempInstance) {
        this.rfbTempInstance.sendCredentials({ password: this.passwordInput });
        this.rfbTempInstance = null;
        this.showPasswordModal = false;
      }
    },

    showNotification(msg) {
      this.notification = msg;
      setTimeout(() => this.notification = '', 3000);
    },

    get statusColor() {
      if (this.connected) return 'text-emerald-400';
      if (this.connecting) return 'text-amber-400';
      return 'text-slate-500';
    },
  }));
});
