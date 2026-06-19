/**
 * SSH Terminal Module — Premium Console Suite
 * xterm.js powered SSH client with WebSocket proxy support
 * Demo mode included when backend not available
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('sshApp', () => ({
    // Connection state
    connected: false,
    connecting: false,
    connectionError: '',
    sessions: [],
    activeSessionId: null,
    
    // Config form
    config: {
      host: '',
      port: 22,
      username: '',
      authType: 'password', // password | key
      password: '',
      privateKey: '',
      proxyUrl: 'ws://localhost:2222', // WebSocket SSH proxy endpoint
    },

    // Demo mode (when no backend)
    demoMode: false,
    demoInput: '',
    demoHistory: [],
    demoCwd: '/home/user',
    demoUser: 'user',
    demoHost: 'remote-server',
    
    // Terminal state
    terminal: null,
    ws: null,
    
    // Saved hosts
    savedHosts: [],
    searchHost: '',
    showAddHost: false,

    init() {
      const saved = localStorage.getItem('ag_ssh_hosts');
      if (saved) { try { this.savedHosts = JSON.parse(saved); } catch(e) {} }
      
      // Load xterm.js if not already loaded
      this.loadXterm();
    },

    loadXterm() {
      if (window.Terminal) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js';
      document.head.appendChild(script);

      const fitScript = document.createElement('script');
      fitScript.src = 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js';
      document.head.appendChild(fitScript);
    },

    get filteredHosts() {
      if (!this.searchHost) return this.savedHosts;
      const q = this.searchHost.toLowerCase();
      return this.savedHosts.filter(h => h.host.toLowerCase().includes(q) || h.username.toLowerCase().includes(q));
    },

    get activeSession() {
      return this.sessions.find(s => s.id === this.activeSessionId);
    },

    get prompt() {
      return `\x1b[32m${this.demoUser}@${this.demoHost}\x1b[0m:\x1b[34m${this.demoCwd}\x1b[0m$ `;
    },

    async connect() {
      if (!this.config.host) { this.connectionError = 'Host is required'; return; }
      if (!this.config.username) { this.connectionError = 'Username is required'; return; }
      
      this.connectionError = '';
      this.connecting = true;

      // Try to connect via WebSocket SSH proxy
      try {
        await this.tryWebSocketConnect();
      } catch(e) {
        // Fallback to demo mode
        this.connecting = false;
        this.startDemoMode();
      }
    },

    tryWebSocketConnect() {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 3000);

        try {
          const ws = new WebSocket(this.config.proxyUrl);
          ws.onopen = () => {
            clearTimeout(timeout);
            // Send auth payload
            ws.send(JSON.stringify({
              type: 'auth',
              host: this.config.host,
              port: this.config.port,
              username: this.config.username,
              password: this.config.password,
              privateKey: this.config.privateKey,
            }));
            this.ws = ws;
          };
          ws.onerror = () => { clearTimeout(timeout); reject(new Error('WebSocket error')); };
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'auth_success') {
              this.ws = ws;
              this.createRealSession(ws);
              resolve();
            } else if (data.type === 'auth_error') {
              reject(new Error(data.message));
            }
          };
        } catch(e) {
          clearTimeout(timeout);
          reject(e);
        }
      });
    },

    createRealSession(ws) {
      const id = Date.now();
      const session = {
        id,
        title: `${this.config.username}@${this.config.host}`,
        host: this.config.host,
        connected: true,
        mode: 'real',
      };
      this.sessions.push(session);
      this.activeSessionId = id;
      this.connected = true;
      this.connecting = false;
      this.saveHost();
      
      // Init xterm
      this.$nextTick(() => this.initXterm(id, ws));
    },

    startDemoMode() {
      this.demoMode = true;
      const id = Date.now();
      const session = {
        id,
        title: `${this.config.username}@${this.config.host} (Demo)`,
        host: this.config.host,
        connected: true,
        mode: 'demo',
      };
      this.sessions.push(session);
      this.activeSessionId = id;
      this.connected = true;
      this.demoUser = this.config.username || 'user';
      this.demoHost = this.config.host || 'remote-server';
      this.saveHost();
      
      this.$nextTick(() => this.initDemoTerminal(id));
    },

    initXterm(sessionId, ws) {
      const el = document.getElementById(`xterm-${sessionId}`);
      if (!el || !window.Terminal) return;
      
      const term = new Terminal({
        theme: {
          background: '#0c0c0c',
          foreground: '#cccccc',
          cursor: '#ffffff',
          selection: 'rgba(255, 255, 255, 0.3)',
          black: '#000000', red: '#cc0000', green: '#4e9a06',
          yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b',
          cyan: '#06989a', white: '#d3d7cf', brightBlack: '#555753',
          brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f',
          brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2',
          brightWhite: '#eeeeec',
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: 14,
        lineHeight: 1.4,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(el);
      fitAddon.fit();

      term.onData(data => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'data', data })); });
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'data') term.write(msg.data);
        } catch(e) { term.write(event.data); }
      };
      ws.onclose = () => { term.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n'); };
      
      this.terminal = term;
      
      window.addEventListener('resize', () => fitAddon.fit());
    },

    initDemoTerminal(sessionId) {
      const el = document.getElementById(`xterm-${sessionId}`);
      if (!el || !window.Terminal) {
        // Fallback text terminal
        return;
      }

      const term = new Terminal({
        theme: { background: '#0c0c0c', foreground: '#cccccc', cursor: '#00ff00' },
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 14,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(el);
      fitAddon.fit();

      // Welcome banner
      term.writeln(`\x1b[33m⚠  Demo Mode — Connect WebSocket SSH proxy for real access\x1b[0m`);
      term.writeln(`\x1b[90mProxy: ${this.config.proxyUrl} (not available)\x1b[0m`);
      term.writeln(`\x1b[32mConnected to ${this.config.host}:${this.config.port} (simulated)\x1b[0m`);
      term.writeln('');
      term.writeln('\x1b[90mType "help" for available demo commands\x1b[0m');
      term.writeln('');

      let inputBuffer = '';
      let historyBuf = [];
      let histIndex = -1;

      const writePrompt = () => term.write(`\x1b[32m${this.demoUser}@${this.demoHost}\x1b[0m:\x1b[34m${this.demoCwd}\x1b[0m\x1b[1m$\x1b[0m `);
      writePrompt();

      term.onKey(({ key, domEvent }) => {
        const code = domEvent.keyCode;
        
        if (code === 13) { // Enter
          term.writeln('');
          const cmd = inputBuffer.trim();
          if (cmd) { historyBuf.unshift(cmd); histIndex = -1; }
          this.runDemoCmd(term, cmd, writePrompt);
          inputBuffer = '';
        } else if (code === 8) { // Backspace
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            term.write('\b \b');
          }
        } else if (code === 38) { // Arrow up (history)
          if (histIndex < historyBuf.length - 1) {
            histIndex++;
            const prev = historyBuf[histIndex];
            term.write('\r\x1b[K');
            writePrompt();
            term.write(prev);
            inputBuffer = prev;
          }
        } else if (code === 40) { // Arrow down (history)
          if (histIndex > 0) {
            histIndex--;
            const next = historyBuf[histIndex];
            term.write('\r\x1b[K');
            writePrompt();
            term.write(next);
            inputBuffer = next;
          } else {
            histIndex = -1;
            inputBuffer = '';
            term.write('\r\x1b[K');
            writePrompt();
          }
        } else if (code === 67 && domEvent.ctrlKey) { // Ctrl+C
          term.writeln('^C');
          inputBuffer = '';
          writePrompt();
        } else if (code === 76 && domEvent.ctrlKey) { // Ctrl+L
          term.clear();
          writePrompt();
        } else {
          inputBuffer += key;
          term.write(key);
        }
      });

      this.terminal = term;
      window.addEventListener('resize', () => fitAddon.fit());
    },

    runDemoCmd(term, cmd, writePrompt) {
      const parts = cmd.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      switch(command) {
        case '':
          break;
        case 'help':
          term.writeln('\x1b[36mAvailable demo commands:\x1b[0m');
          term.writeln('  ls [-la]      List directory contents');
          term.writeln('  pwd           Print working directory');
          term.writeln('  cd <dir>      Change directory');
          term.writeln('  cat <file>    Display file contents');
          term.writeln('  echo <text>   Print text');
          term.writeln('  whoami        Current user');
          term.writeln('  hostname      System hostname');
          term.writeln('  date          Current date/time');
          term.writeln('  uname -a      System information');
          term.writeln('  top           Process list (simulated)');
          term.writeln('  ps aux        Running processes');
          term.writeln('  df -h         Disk usage');
          term.writeln('  free -h       Memory usage');
          term.writeln('  ifconfig      Network interfaces');
          term.writeln('  ping <host>   Ping test');
          term.writeln('  clear         Clear terminal');
          term.writeln('  exit          Disconnect session');
          break;
        case 'clear':
          term.clear();
          break;
        case 'exit':
        case 'logout':
          term.writeln('logout');
          term.writeln('\x1b[33mSession closed.\x1b[0m');
          break;
        case 'pwd':
          term.writeln(this.demoCwd);
          break;
        case 'whoami':
          term.writeln(this.demoUser);
          break;
        case 'hostname':
          term.writeln(this.demoHost);
          break;
        case 'date':
          term.writeln(new Date().toString());
          break;
        case 'cd':
          if (!args[0] || args[0] === '~') { this.demoCwd = `/home/${this.demoUser}`; }
          else if (args[0] === '..') {
            const parts2 = this.demoCwd.split('/');
            if (parts2.length > 1) { parts2.pop(); this.demoCwd = parts2.join('/') || '/'; }
          } else if (args[0].startsWith('/')) { this.demoCwd = args[0]; }
          else { this.demoCwd = this.demoCwd + '/' + args[0]; }
          break;
        case 'ls':
          const longFormat = args.includes('-la') || args.includes('-l') || args.includes('-a');
          if (longFormat) {
            term.writeln('total 48');
            term.writeln('drwxr-xr-x  5 ' + this.demoUser + ' ' + this.demoUser + ' 4096 Jun 19 09:15 .');
            term.writeln('drwxr-xr-x 25 root root          4096 Jun 19 08:00 ..');
            term.writeln('-rw-------  1 ' + this.demoUser + ' ' + this.demoUser + '  512 Jun 18 21:30 .bash_history');
            term.writeln('-rw-r--r--  1 ' + this.demoUser + ' ' + this.demoUser + '  220 Jun 18 08:00 .bash_logout');
            term.writeln('-rw-r--r--  1 ' + this.demoUser + ' ' + this.demoUser + ' 3526 Jun 18 08:00 .bashrc');
            term.writeln('\x1b[34mdrwxr-xr-x  2 ' + this.demoUser + ' ' + this.demoUser + ' 4096 Jun 19 09:00 Documents\x1b[0m');
            term.writeln('\x1b[34mdrwxr-xr-x  2 ' + this.demoUser + ' ' + this.demoUser + ' 4096 Jun 19 09:00 Downloads\x1b[0m');
            term.writeln('-rw-r--r--  1 ' + this.demoUser + ' ' + this.demoUser + ' 2048 Jun 19 09:15 config.json');
            term.writeln('-rwxr-xr-x  1 ' + this.demoUser + ' ' + this.demoUser + ' 8192 Jun 19 09:12 startup.sh');
          } else {
            term.writeln('\x1b[34mDocuments\x1b[0m  \x1b[34mDownloads\x1b[0m  config.json  startup.sh');
          }
          break;
        case 'cat':
          if (!args[0]) { term.writeln('cat: missing file operand'); break; }
          if (args[0] === 'config.json') {
            term.writeln('{\n  "host": "' + this.demoHost + '",\n  "port": 22,\n  "version": "1.0.0"\n}');
          } else if (args[0] === 'startup.sh') {
            term.writeln('#!/bin/bash\necho "Starting services..."\nsystemctl start nginx\nsystemctl start mysql');
          } else {
            term.writeln(`cat: ${args[0]}: No such file or directory`);
          }
          break;
        case 'echo':
          term.writeln(args.join(' '));
          break;
        case 'uname':
          term.writeln(`Linux ${this.demoHost} 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64 GNU/Linux`);
          break;
        case 'ps':
          term.writeln('USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND');
          term.writeln(this.demoUser + '       1  0.0  0.1   4620  3420 ?        Ss   09:00   0:00 /sbin/init');
          term.writeln(this.demoUser + '     412  0.0  0.3  15420  7100 ?        S    09:01   0:00 sshd: user@pts/0');
          term.writeln(this.demoUser + '     413  0.0  0.2  10052  4220 pts/0    Ss   09:01   0:00 -bash');
          term.writeln(this.demoUser + '     891  2.1  1.4 512340 28900 ?        Sl   09:05   0:12 node server.js');
          break;
        case 'top':
          term.writeln('\x1b[7m top - ' + new Date().toLocaleTimeString() + ' up 4 days, 2:15,  1 user,  load average: 0.12, 0.08, 0.05\x1b[0m');
          term.writeln('Tasks: 124 total,   1 running, 123 sleeping,   0 stopped,   0 zombie');
          term.writeln('\x1b[36m%Cpu(s):  2.1 us,  0.8 sy,  0.0 ni, 96.8 id,  0.2 wa,  0.0 hi,  0.1 si\x1b[0m');
          term.writeln('MiB Mem :   7924.2 total,   3124.5 free,   2891.3 used,   1908.4 buff/cache');
          term.writeln('\x1b[90m(Press q to exit)\x1b[0m');
          break;
        case 'df':
          term.writeln('Filesystem      Size  Used Avail Use% Mounted on');
          term.writeln('/dev/sda1        50G   18G   30G  38% /');
          term.writeln('tmpfs           3.9G     0  3.9G   0% /dev/shm');
          term.writeln('/dev/sdb1       200G   89G  100G  47% /data');
          break;
        case 'free':
          term.writeln('               total        used        free      shared  buff/cache   available');
          term.writeln('Mem:           7924M       2891M       3124M        142M       1908M       4701M');
          term.writeln('Swap:          2048M          0M       2048M');
          break;
        case 'ifconfig':
          term.writeln('eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500');
          term.writeln(`        inet ${this.config.host || '10.0.1.100'}  netmask 255.255.255.0  broadcast 10.0.1.255`);
          term.writeln('        ether 02:42:ac:11:00:02  txqueuelen 0  (Ethernet)');
          term.writeln('lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536');
          term.writeln('        inet 127.0.0.1  netmask 255.0.0.0');
          break;
        case 'ping':
          if (!args[0]) { term.writeln('Usage: ping <host>'); break; }
          term.writeln(`PING ${args[0]} (93.184.216.34) 56(84) bytes of data.`);
          term.writeln(`64 bytes from ${args[0]} (93.184.216.34): icmp_seq=1 ttl=56 time=12.4 ms`);
          term.writeln(`64 bytes from ${args[0]} (93.184.216.34): icmp_seq=2 ttl=56 time=11.8 ms`);
          term.writeln(`64 bytes from ${args[0]} (93.184.216.34): icmp_seq=3 ttl=56 time=13.1 ms`);
          term.writeln(`--- ${args[0]} ping statistics ---`);
          term.writeln('3 packets transmitted, 3 received, 0% packet loss, time 2002ms');
          break;
        default:
          term.writeln(`\x1b[31m${command}: command not found\x1b[0m`);
          term.writeln(`\x1b[90mType 'help' for available commands\x1b[0m`);
      }

      writePrompt();
    },

    disconnect() {
      if (this.ws) { this.ws.close(); this.ws = null; }
      if (this.terminal) { this.terminal.dispose(); this.terminal = null; }
      this.sessions = this.sessions.filter(s => s.id !== this.activeSessionId);
      if (this.sessions.length > 0) {
        this.activeSessionId = this.sessions[this.sessions.length - 1].id;
      } else {
        this.activeSessionId = null;
        this.connected = false;
        this.demoMode = false;
      }
    },

    disconnectAll() {
      if (this.ws) { this.ws.close(); this.ws = null; }
      if (this.terminal) { this.terminal.dispose(); this.terminal = null; }
      this.sessions = [];
      this.activeSessionId = null;
      this.connected = false;
      this.demoMode = false;
    },

    saveHost() {
      const existing = this.savedHosts.find(h => h.host === this.config.host && h.username === this.config.username);
      if (!existing) {
        this.savedHosts.unshift({
          id: Date.now(),
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          authType: this.config.authType,
          lastConnected: new Date().toLocaleDateString(),
        });
        localStorage.setItem('ag_ssh_hosts', JSON.stringify(this.savedHosts));
      }
    },

    loadHost(h) {
      this.config.host = h.host;
      this.config.port = h.port;
      this.config.username = h.username;
      this.config.authType = h.authType;
    },

    deleteHost(id) {
      this.savedHosts = this.savedHosts.filter(h => h.id !== id);
      localStorage.setItem('ag_ssh_hosts', JSON.stringify(this.savedHosts));
    },

    newSession() {
      this.disconnectAll();
    },
  }));
});
