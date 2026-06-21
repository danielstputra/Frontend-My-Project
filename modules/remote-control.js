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
    iceCandidatesQueue: [],
    connectionTimeout: null,
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
    activeIncomingFile: null,

    init() {
      this.generateSession();
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        this.signalingUrl = 'ws://localhost:9090/';
      }

      this.$watch('mode', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
      this.$watch('sharing', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
      this.$watch('connected', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
      this.$watch('connecting', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });

      document.addEventListener('fullscreenchange', () => {
        this.isFullscreen = (document.fullscreenElement !== null);
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
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
      this.iceCandidatesQueue = [];
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      const preview = document.getElementById('share-preview');
      if (preview) preview.srcObject = null;
      this.generateSession();
    },

    async connectToSession() {
      if (!this.targetSessionId || this.targetSessionId.length !== 6) {
        this.connectionError = 'Session ID must be 6 digits';
        this.showNotification('⚠️ ' + this.connectionError);
        return;
      }
      if (!this.targetSecret) {
        this.connectionError = 'Session secret is required';
        this.showNotification('⚠️ ' + this.connectionError);
        return;
      }

      this.connectionError = '';
      this.connecting = true;

      // Start connection timeout timer
      this.connectionTimeout = setTimeout(() => {
        if (this.connecting && !this.connected) {
          this.disconnect();
          this.connectionError = 'Koneksi timeout: Host belum melakukan share screen atau Session ID tidak aktif.';
          this.showNotification('❌ ' + this.connectionError);
        }
      }, 7000);

      // Try real signaling
      const wsConnected = await this.connectSignaling('client');

      if (!wsConnected) {
        // Demo mode - show demo remote desktop view
        this.connecting = false;
        this.connected = true;
        this.showDemoRemoteView();
        this.showNotification('⚠ Demo Mode — Signaling server not found');
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
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
          if (role === 'client' && (msg.role === 'host' || msg.peerId === 'host')) {
            this.disconnect();
            this.showNotification('🔴 Host telah menghentikan share screen.');
          } else if (role === 'host') {
            this.showNotification('🔴 Klien terputus.');
            this.connectedPeers = [];
          }
          break;
        case 'offer':
          await this.handleOffer(msg.sdp, msg.from);
          break;
        case 'answer':
          await this.handleAnswer(msg.sdp);
          break;
        case 'ice-candidate':
          if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch(e) {
              console.error("Error adding ice candidate:", e);
            }
          } else {
            this.iceCandidatesQueue.push(msg.candidate);
          }
          break;
        case 'auth-failed':
          this.connectionError = msg.message || 'Host belum melakukan share screen atau session ID tidak aktif.';
          this.connecting = false;
          this.showNotification('❌ ' + this.connectionError);
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
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

      this.pc.onconnectionstatechange = () => {
        if (this.pc && (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed')) {
          console.log("WebRTC host PC connection state changed to:", this.pc.connectionState);
          if (this.pc) { this.pc.close(); this.pc = null; }
          this.connectedPeers = [];
          this.showNotification('🔴 Klien terputus.');
        }
      };

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

      this.pc.onconnectionstatechange = () => {
        if (this.pc && (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed')) {
          console.log("WebRTC client PC connection state changed to:", this.pc.connectionState);
          this.disconnect();
          this.showNotification('🔴 Koneksi ke host terputus.');
        }
      };

      // Listener untuk menerima stream dari Host
      this.pc.ontrack = (e) => {
        console.log("📥 Remote stream received");
        this.remoteStream = e.streams[0]; // Set state to trigger Alpine.js rendering of remote-video element

        // Listen for track ended to automatically disconnect
        e.streams[0].getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            console.log("Remote track ended, disconnecting...");
            this.disconnect();
            this.showNotification('🔴 Sesi share screen telah dihentikan oleh Host.');
          });
        });

        this.$nextTick(() => {
          const video = document.getElementById('remote-video');
          if (video) {
            video.srcObject = e.streams[0];
            // Penting: Video harus di-play() setelah srcObject di-set
            video.play().catch(ex => console.error("Play error:", ex));
          }
        });
        this.connecting = false;
        this.connected = true;
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
      };

      // Listener untuk menerima data channel dari Host
      this.pc.ondatachannel = (e) => {
        console.log("📥 Data channel received");
        this.setupDataChannel(e.channel);
      };

      this.pc.onicecandidate = (e) => {
        if (e.candidate && this.signalingWs) {
          this.signalingWs.send(JSON.stringify({ type: 'ice-candidate', to: from, candidate: e.candidate }));
        }
      };

      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.processIceQueue(); // Process queued ICE candidates
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      if (this.signalingWs) {
        this.signalingWs.send(JSON.stringify({ type: 'answer', to: from, sdp: answer }));
      }
    },

    async handleAnswer(sdp) {
      if (this.pc) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await this.processIceQueue();
      }
    },

    async processIceQueue() {
      if (!this.pc || !this.pc.remoteDescription) return;
      while (this.iceCandidatesQueue.length > 0) {
        const candidate = this.iceCandidatesQueue.shift();
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch(e) {
          console.error("Error adding queued ice candidate:", e);
        }
      }
    },

    setupDataChannel(channel) {
      this.dataChannel = channel;
      channel.binaryType = 'arraybuffer';
      channel.bufferedAmountLowThreshold = 65536;

      channel.onopen = () => { };
      channel.onmessage = (e) => {
        if (typeof e.data === 'string') {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'chat') {
              this.chatMessages.push({ from: 'remote', text: msg.text, time: new Date().toLocaleTimeString() });
            } else if (msg.type === 'file-start') {
              this.activeIncomingFile = {
                id: msg.id,
                name: msg.name,
                size: msg.size,
                receivedSize: 0,
                chunks: []
              };
              this.transferFiles.unshift({
                id: msg.id,
                name: msg.name,
                size: msg.size,
                progress: 0,
                status: 'receiving'
              });
              this.showNotification(`📥 Menerima file: ${msg.name}`);
            } else if (msg.type === 'file-end') {
              if (this.activeIncomingFile && this.activeIncomingFile.id === msg.id) {
                const blob = new Blob(this.activeIncomingFile.chunks);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.activeIncomingFile.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                const item = this.transferFiles.find(t => t.id === msg.id);
                if (item) {
                  item.progress = 100;
                  item.status = 'done';
                }
                this.showNotification(`✅ File ${this.activeIncomingFile.name} berhasil diunduh!`);
                this.activeIncomingFile = null;
              }
            }
          } catch (ex) {
            console.error("Gagal memproses data channel message:", ex);
          }
        } else {
          // Binary chunk
          if (this.activeIncomingFile) {
            this.activeIncomingFile.chunks.push(e.data);
            this.activeIncomingFile.receivedSize += e.data.byteLength;
            const progress = Math.min(Math.round((this.activeIncomingFile.receivedSize / this.activeIncomingFile.size) * 100), 100);
            const item = this.transferFiles.find(t => t.id === this.activeIncomingFile.id);
            if (item) {
              item.progress = progress;
              item.status = 'receiving';
            }
          }
        }
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
      this.iceCandidatesQueue = [];
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      const container = document.getElementById('remote-view-container');
      if (container) container.innerHTML = '';
    },

    copySessionId() {
      const text = `Session: ${this.sessionId} | Secret: ${this.sessionSecret}`;
      navigator.clipboard.writeText(text).then(() => this.showNotification('✅ Session info copied'));
    },

    toggleFullscreen() {
      const el = document.getElementById('rc-video-wrapper');
      if (!document.fullscreenElement) {
        el?.requestFullscreen().then(() => this.isFullscreen = true);
      } else {
        document.exitFullscreen().then(() => this.isFullscreen = false);
      }
    },

    sendFileToRemote() {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        this.showNotification('⚠️ Koneksi tidak aktif atau Data Channel belum siap.');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = (e) => {
        Array.from(e.target.files).forEach(file => {
          const fileId = Date.now() + Math.random().toString(36).substr(2, 9);
          const transfer = { id: fileId, name: file.name, size: file.size, progress: 0, status: 'sending' };
          this.transferFiles.unshift(transfer);
          
          // Send metadata
          this.dataChannel.send(JSON.stringify({
            type: 'file-start',
            id: fileId,
            name: file.name,
            size: file.size
          }));

          // Send in chunks
          this.sendFileInChunks(file, fileId, transfer);
        });
      };
      input.click();
    },

    sendFileInChunks(file, fileId, transferItem) {
      const CHUNK_SIZE = 16384; // 16KB chunks
      let offset = 0;
      const reader = new FileReader();

      const readNextChunk = () => {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
          transferItem.status = 'failed';
          this.showNotification('❌ Pengiriman file gagal: Data Channel terputus.');
          return;
        }

        if (offset >= file.size) {
          // File completed sending
          this.dataChannel.send(JSON.stringify({ type: 'file-end', id: fileId }));
          transferItem.progress = 100;
          transferItem.status = 'done';
          this.showNotification(`📁 File ${file.name} berhasil dikirim!`);
          return;
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (e) => {
        const buffer = e.target.result;
        
        // Handle DataChannel backpressure
        if (this.dataChannel.bufferedAmount > 1048576) { // 1MB limit
          const listener = () => {
            this.dataChannel.removeEventListener('bufferedamountlow', listener);
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
              this.dataChannel.send(buffer);
              offset += buffer.byteLength;
              transferItem.progress = Math.min(Math.round((offset / file.size) * 100), 100);
              readNextChunk();
            }
          };
          this.dataChannel.addEventListener('bufferedamountlow', listener);
        } else {
          this.dataChannel.send(buffer);
          offset += buffer.byteLength;
          transferItem.progress = Math.min(Math.round((offset / file.size) * 100), 100);
          readNextChunk();
        }
      };

      readNextChunk();
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
