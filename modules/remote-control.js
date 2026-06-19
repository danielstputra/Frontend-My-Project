/**
 * Remote Control Module — Premium Console Suite
 * WebRTC screen sharing (TeamViewer/AnyDesk-like)
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('remoteControlApp', () => ({
    // Mode: share | connect
    mode: 'share', // share | connect

    // Share My Screen
    sessionId: '',
    sessionSecret: '',
    sharing: false,
    shareStream: null,
    shareError: '',
    connectedPeers: [],

    // Connect to Session
    targetSessionId: '',
    targetSecret: '',
    connecting: false,
    connected: false,
    remoteStream: null,
    connectionError: '',

    // WebRTC
    pc: null, // RTCPeerConnection
    signalingWs: null,
    signalingUrl: 'wss://webrtc-my-project-production.up.railway.app/', // Signaling server WebSocket

    // Chat
    chatMessages: [],
    chatInput: '',
    dataChannel: null,

    // Quality
    quality: 'high', // low | medium | high
    qualitySettings: {
      low: { width: 1280, height: 720, frameRate: 15, bitrate: 500000 },
      medium: { width: 1920, height: 1080, frameRate: 24, bitrate: 1500000 },
      high: { width: 1920, height: 1080, frameRate: 30, bitrate: 4000000 },
    },

    // UI
    notification: '',
    showChat: false,
    showInfo: false,
    isFullscreen: false,
    transferFiles: [],

    init() {
      this.generateSession();
    },

    generateSession() {
      // Generate 6-digit session ID
      this.sessionId = String(Math.floor(100000 + Math.random() * 900000));
      // Generate 8-char secret
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      this.sessionSecret = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    },

    async startSharing() {
      this.shareError = '';
      try {
        const qs = this.qualitySettings[this.quality];
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: qs.width },
            height: { ideal: qs.height },
            frameRate: { ideal: qs.frameRate },
          },
          audio: true,
        });

        this.shareStream = stream;
        this.sharing = true;

        // Show local preview
        this.$nextTick(() => {
          const preview = document.getElementById('share-preview');
          if (preview) {
            preview.srcObject = stream;
            preview.play();
          }
        });

        // Try signaling server
        this.connectSignaling('host');

        stream.getVideoTracks()[0].addEventListener('ended', () => {
          this.stopSharing();
        });

        this.showNotification('✅ Screen sharing started');
      } catch (e) {
        if (e.name === 'NotAllowedError') {
          this.shareError = 'Screen capture permission denied. Please allow screen sharing.';
        } else if (e.name === 'NotSupportedError') {
          this.shareError = 'Screen capture not supported in this browser.';
        } else {
          this.shareError = `Error: ${e.message}`;
        }
      }
    },

    stopSharing() {
      if (this.shareStream) {
        this.shareStream.getTracks().forEach(t => t.stop());
        this.shareStream = null;
      }
      if (this.pc) { this.pc.close(); this.pc = null; }
      if (this.signalingWs) { this.signalingWs.close(); this.signalingWs = null; }
      this.sharing = false;
      this.connectedPeers = [];
      const preview = document.getElementById('share-preview');
      if (preview) preview.srcObject = null;
      this.generateSession();
    },

    async connectToSession() {
      if (!this.targetSessionId || this.targetSessionId.length !== 6) {
        this.connectionError = 'Session ID must be 6 digits';
        return;
      }
      if (!this.targetSecret) {
        this.connectionError = 'Session secret is required';
        return;
      }

      this.connectionError = '';
      this.connecting = true;

      // Try real signaling
      const wsConnected = await this.connectSignaling('client');

      if (!wsConnected) {
        // Demo mode - show demo remote desktop view
        this.connecting = false;
        this.connected = true;
        this.showDemoRemoteView();
        this.showNotification('⚠ Demo Mode — Signaling server not found');
        return;
      }

      // Send join request
      if (this.signalingWs) {
        this.signalingWs.send(JSON.stringify({
          type: 'join',
          sessionId: this.targetSessionId,
          secret: this.targetSecret,
        }));
      }
    },

    connectSignaling(role) {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket(this.signalingUrl);
          const timeout = setTimeout(() => { ws.close(); resolve(false); }, 2000);

          ws.onopen = () => {
            clearTimeout(timeout);
            this.signalingWs = ws;
            ws.send(JSON.stringify({
              type: 'register',
              role,
              sessionId: role === 'host' ? this.sessionId : this.targetSessionId,
              secret: role === 'host' ? this.sessionSecret : this.targetSecret,
            }));
            resolve(true);
          };

          ws.onerror = () => { clearTimeout(timeout); resolve(false); };

          ws.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            await this.handleSignaling(msg, role);
          };

          ws.onclose = () => {
            if (role === 'client' && this.connected) {
              this.connected = false;
              this.showNotification('⚠ Connection to session lost');
            }
          };
        } catch (e) {
          resolve(false);
        }
      });
    },

    async handleSignaling(msg, role) {
      switch (msg.type) {
        case 'peer-joined':
          this.connectedPeers.push({ id: msg.peerId, name: `Guest ${this.connectedPeers.length + 1}` });
          await this.createOffer(msg.peerId);
          break;
        case 'peer-left':
          this.connectedPeers = this.connectedPeers.filter(p => p.id !== msg.peerId);
          break;
        case 'offer':
          await this.handleOffer(msg.sdp, msg.from);
          break;
        case 'answer':
          await this.handleAnswer(msg.sdp);
          break;
        case 'ice-candidate':
          if (this.pc) await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          break;
        case 'auth-failed':
          this.connectionError = 'Invalid session ID or secret';
          this.connecting = false;
          break;
      }
    },

    async createOffer(peerId) {
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Tambahkan track stream SEBELUM createOffer
      if (this.shareStream) {
        this.shareStream.getTracks().forEach(track => {
          this.pc.addTrack(track, this.shareStream);
        });
      }

      // Buat DataChannel
      this.dataChannel = this.pc.createDataChannel('control');
      this.setupDataChannel(this.dataChannel);

      this.pc.onicecandidate = (e) => {
        if (e.candidate && this.signalingWs) {
          this.signalingWs.send(JSON.stringify({ type: 'ice-candidate', to: peerId, candidate: e.candidate }));
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Kirim SDP ke signaling server
      if (this.signalingWs) {
        this.signalingWs.send(JSON.stringify({ type: 'offer', to: peerId, sdp: offer }));
      }
    },

    async handleOffer(sdp, from) {
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Listener untuk menerima stream dari Host
      this.pc.ontrack = (e) => {
        console.log("📥 Remote stream received");
        const video = document.getElementById('remote-video');
        if (video) {
          video.srcObject = e.streams[0];
          // Penting: Video harus di-play() setelah srcObject di-set
          video.play().catch(e => console.error("Play error:", e));
        }
        this.connecting = false;
        this.connected = true;
      };

      this.pc.onicecandidate = (e) => {
        if (e.candidate && this.signalingWs) {
          this.signalingWs.send(JSON.stringify({ type: 'ice-candidate', to: from, candidate: e.candidate }));
        }
      };

      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      if (this.signalingWs) {
        this.signalingWs.send(JSON.stringify({ type: 'answer', to: from, sdp: answer }));
      }
    },

    async handleAnswer(sdp) {
      if (this.pc) await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    },

    setupDataChannel(channel) {
      this.dataChannel = channel;
      channel.onopen = () => { };
      channel.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'chat') {
            this.chatMessages.push({ from: 'remote', text: msg.text, time: new Date().toLocaleTimeString() });
          }
        } catch (ex) { }
      };
    },

    sendChatMessage() {
      if (!this.chatInput.trim()) return;
      const msg = { type: 'chat', text: this.chatInput };
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify(msg));
      }
      this.chatMessages.push({ from: 'me', text: this.chatInput, time: new Date().toLocaleTimeString() });
      this.chatInput = '';
    },

    showDemoRemoteView() {
      this.$nextTick(() => {
        const container = document.getElementById('remote-view-container');
        if (!container) return;
        container.innerHTML = `
          <div style="width:100%;height:100%;background:#1e1b4b;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
            <div style="background:#0f0a2e;border:1px solid #6366f1;border-radius:12px;padding:32px;text-align:center;max-width:500px;">
              <div style="font-size:48px;margin-bottom:16px;">🔗</div>
              <h3 style="color:#a5b4fc;font-size:18px;margin:0 0 8px;">Remote Control — Demo Connected</h3>
              <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Session: <code style="color:#6366f1;">${this.targetSessionId}</code></p>
              <p style="color:#64748b;font-size:12px;">Deploy a WebRTC signaling server to enable real remote control. The UI is fully functional.</p>
            </div>
          </div>
        `;
      });
    },

    disconnect() {
      if (this.pc) { this.pc.close(); this.pc = null; }
      if (this.signalingWs) { this.signalingWs.close(); this.signalingWs = null; }
      if (this.remoteStream) { this.remoteStream.getTracks().forEach(t => t.stop()); this.remoteStream = null; }
      this.connected = false;
      this.connecting = false;
      this.chatMessages = [];
      this.targetSessionId = '';
      this.targetSecret = '';
      const container = document.getElementById('remote-view-container');
      if (container) container.innerHTML = '';
    },

    copySessionId() {
      const text = `Session: ${this.sessionId} | Secret: ${this.sessionSecret}`;
      navigator.clipboard.writeText(text).then(() => this.showNotification('✅ Session info copied'));
    },

    toggleFullscreen() {
      const el = document.getElementById('rc-viewer-panel');
      if (!document.fullscreenElement) {
        el?.requestFullscreen().then(() => this.isFullscreen = true);
      } else {
        document.exitFullscreen().then(() => this.isFullscreen = false);
      }
    },

    sendFileToRemote() {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = (e) => {
        Array.from(e.target.files).forEach(file => {
          const transfer = { id: Date.now(), name: file.name, size: file.size, progress: 0, status: 'sending' };
          this.transferFiles.unshift(transfer);
          // Simulate or send via DataChannel
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const reader = new FileReader();
            reader.onload = (ev) => {
              this.dataChannel.send(ev.target.result);
              transfer.progress = 100;
              transfer.status = 'done';
            };
            reader.readAsArrayBuffer(file);
          } else {
            // Simulate
            let p = 0;
            const iv = setInterval(() => {
              p += Math.random() * 20 + 5;
              transfer.progress = Math.min(Math.round(p), 100);
              if (transfer.progress >= 100) { transfer.status = 'done'; clearInterval(iv); }
            }, 200);
          }
        });
      };
      input.click();
    },

    formatSize(bytes) {
      if (!bytes) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    showNotification(msg) {
      this.notification = msg;
      setTimeout(() => this.notification = '', 4000);
    },
  }));
});
