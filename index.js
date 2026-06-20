/**
 * Premium Terminal Previewer App - Upgraded Multi-OS Interpreter Engine
 * Core script handling Batch (.bat) & PowerShell (.ps1) browser-side command simulators
 */

// =====================================================
//  ACTIVATION CODES (Hardcoded - No Database Required)
// =====================================================
const ACTIVATION_CODES = {
  'AG-PREMIUM-2026': {
    tier: 'premium',
    label: 'Premium Full Access',
    modules: ['api', 'ssh', 'ftp', 'rdp', 'rc'],
    icon: '👑',
  },
  'AG-BASIC-2026': {
    tier: 'basic',
    label: 'Basic Access',
    modules: ['api', 'ssh'],
    icon: '⚡',
  },
  'AG-TRIAL-001': {
    tier: 'trial',
    label: 'Trial (API Only)',
    modules: ['api'],
    icon: '🎯',
  },
};

// =====================================================
//  ALPINE GLOBAL STORE — App Navigation & Activation
// =====================================================
document.addEventListener('alpine:init', () => {
  Alpine.store('app', {
    // Navigation
    activeModule: 'console', // console | api | ssh | ftp | rdp | rc

    // Activation
    activation: null,    // { tier, label, modules, code, icon } or null
    showActivationModal: false,
    showWAModal: false,
    pendingModule: null,
    activationInput: '',
    activationError: '',
    activationSuccess: false,

    // Language / Theme (shared flags)
    lang: 'id',
    theme: 'dark',

    init() {
      const saved = localStorage.getItem('ag_activation_v2');
      if (saved) {
        try { this.activation = JSON.parse(saved); } catch(e) {}
      }
      // Load lang/theme from localStorage if set
      const savedLang = localStorage.getItem('ag_lang');
      if (savedLang) this.lang = savedLang;
      const savedTheme = localStorage.getItem('ag_ui_theme');
      if (savedTheme) this.theme = savedTheme;
    },

    navigate(module) {
      const premiumModules = ['api', 'ssh', 'ftp', 'rdp', 'rc'];
      if (premiumModules.includes(module)) {
        if (!this.activation || !this.activation.modules.includes(module)) {
          this.pendingModule = module;
          this.showActivationModal = true;
          return;
        }
      }
      this.activeModule = module;
    },

    tryActivate() {
      const code = this.activationInput.trim().toUpperCase();
      const found = ACTIVATION_CODES[code];
      if (found) {
        this.activation = { ...found, code };
        localStorage.setItem('ag_activation_v2', JSON.stringify(this.activation));
        this.activationError = '';
        this.activationSuccess = true;
        setTimeout(() => {
          this.showActivationModal = false;
          this.activationSuccess = false;
          if (this.pendingModule && this.activation.modules.includes(this.pendingModule)) {
            this.activeModule = this.pendingModule;
          }
          this.pendingModule = null;
          this.activationInput = '';
        }, 1200);
      } else {
        this.activationError = 'Kode aktivasi tidak valid. Periksa kembali kode Anda.';
        // Shake animation
        setTimeout(() => this.activationError = '', 3000);
      }
    },

    deactivate() {
      this.activation = null;
      localStorage.removeItem('ag_activation_v2');
      this.activeModule = 'console';
    },

    openWAModal() {
      this.showWAModal = true;
    },

    closeWAModal() {
      this.showWAModal = false;
    },

    sendWhatsApp(message) {
      const phone = '6285161926718';
      const text = encodeURIComponent(message || 'Halo, saya ingin mengetahui lebih lanjut tentang Console & PS Viewer Premium Suite.');
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
      this.showWAModal = false;
    },

    canAccess(module) {
      if (!this.activation) return false;
      return this.activation.modules.includes(module);
    },

    get tierColor() {
      if (!this.activation) return 'text-slate-500';
      const colors = { premium: 'text-purple-400', basic: 'text-sky-400', trial: 'text-amber-400' };
      return colors[this.activation.tier] || 'text-slate-400';
    },
  });
});

document.addEventListener('alpine:init', () => {
  Alpine.data('terminalApp', () => ({
    // General State
    theme: 'cmd', // 'cmd' | 'powershell' (Ignored for Linux/macOS raw shells)
    terminalOS: 'win11', // 'win11' | 'win10' | 'win8' | 'macos' | 'ubuntu' | 'kali' | 'centos'
    windowTitle: 'Administrator: Command Prompt',
    systemPath: 'C:\\Users\\Administrator>',
    editorInput: '',
    renderedLines: [],
    
    // Customization State
    fontSize: 'base', // 'xs' | 'sm' | 'base' | 'lg' | 'xl'
    fontFamily: 'jetbrains', // 'jetbrains' | 'fira' | 'consolas'
    cursorType: 'block', // 'block' | 'underscore' | 'line'
    opacity: 98,
    shadowIntensity: 'glow', // 'none' | 'md' | 'lg' | 'glow'
    blurBg: true,
    showGradients: true,
    customGlowColor: 'indigo', // 'indigo' | 'emerald' | 'rose' | 'amber' | 'blue'
    textSpeed: 30, // typing speed in ms per character
    
    // Theme & Language Toggle State
    isDarkMode: true,
    lang: 'id', // 'id' | 'en'

    // Simulation / Playback State
    isPlaying: false,
    currentLineIndex: 0,
    typingText: '',
    simTimeout: null,
    
    // UI states
    copied: false,
    exporting: false,
    
    // Translations Dictionary
    t: {
      id: {
        title: "Console Log Viewer & Simulator",
        subtitle: "Buat preview konsol premium untuk Windows, macOS, Linux, Kali Linux, CentOS, dll",
        presetBtn: "Load Preset Demo",
        clearTooltip: "Bersihkan Editor",
        selectTheme: "Pilih Tipe Terminal",
        editorLabel: "Input Kode Console & Log",
        autoUpdate: "Auto-update preview (Realtime Result)",
        tipsTitle: "Tips Tag Format Warna:",
        tipsSuccess: "Berhasil",
        tipsError: "Gagal / Error",
        tipsWarning: "Peringatan",
        tipsInfo: "Informasi",
        powershellTip: "Khusus PowerShell:",
        playSim: "Play Sim",
        stopSim: "Stop Sim",
        copyCode: "Copy Kode",
        copied: "Disalin!",
        delayLabel: "Delay:",
        customTitle: "Kustomisasi Tampilan",
        winTitle: "Window Title",
        sysPath: "System Path Prefix",
        fontFamily: "Font Family",
        fontSize: "Ukuran Font",
        opacityLabel: "Opacity Window",
        cursorLabel: "Tipe Cursor",
        blurLabel: "Glassmorphism Blur",
        bgGradientLabel: "Background Gradient Frame",
        bgFrameTheme: "Theme Background Frame",
        livePreview: "LIVE PREVIEW DECK",
        exportBtn: "Export Gambar (PNG)",
        exportingBtn: "Mengekspor...",
        tweakCard: "Pengaturan Kartu Presentasi",
        canvasShadow: "Bayangan Kanvas",
        typingSpeed: "Kecepatan Mengetik",
        themeVisual: "Visual Tema",
        presetSupport: "Dukungan Preset",
        activeReady: "Aktif & Siap",
        premiumTitle: "🌟 Fitur Premium Pro",
        premiumDesc: "Buka seluruh kemampuan kustomisasi untuk developer & presentasi profesional.",
        premiumFeature1: "Vector Export (Format SVG / PDF)",
        premiumFeature2: "Multiple Tabs & Layout Bersebelahan",
        premiumFeature3: "Integrasi API Otomatis (POST /render)",
        premiumFeature4: "Sinkronisasi Awan Preset Log",
        premiumFeature5: "Logo & Brand Custom di Header Terminal",
        premiumUpgradeBtn: "Dapatkan Akses Premium Pro",
        devTitle: "👨‍💻 Informasi Pengembang",
        devRole: "Senior UI/UX & Backend Engineer",
        devLocation: "Jakarta, Indonesia",
        devContact: "Hubungi Pengembang",
        devDesc: "Fokus pada pembuatan infrastruktur berkualitas tinggi, antarmuka interaktif, dan optimasi performa native.",
        shadowNone: "Tanpa Bayangan",
        shadowMd: "Medium Shadow",
        shadowLg: "Soft Dark Shadow",
        shadowGlow: "Neon Glow Backdrop",
        speedFast: "Sangat Cepat (15ms)",
        speedStd: "Standard (30ms)",
        speedSlow: "Lambat (50ms)",
        speedVerySlow: "Sangat Lambat (90ms)",
        themeDark: "Gelap",
        themeLight: "Terang",
        osLabel: "Tema Bingkai OS Window",
        win11: "Windows 11 (Acrylic)",
        win10: "Windows 10 (Flat)",
        win8: "Windows 8 (Metro)",
        macos: "macOS Terminal (zsh)",
        ubuntu: "Ubuntu Linux (bash)",
        kali: "Kali Linux (Hacker)",
        centos: "CentOS Server (bash)",
        noResultsTitle: "Pencarian Tidak Ada",
        noResultsDesc: "Coba gunakan kata kunci lainnya"
      },
      en: {
        title: "Console Log Viewer & Simulator",
        subtitle: "Generate premium console previews for Windows, macOS, Linux, Kali Linux, CentOS, etc.",
        presetBtn: "Load Demo Preset",
        clearTooltip: "Clear Editor",
        selectTheme: "Select Terminal Type",
        editorLabel: "Console Code & Log Input",
        autoUpdate: "Auto-updates preview (Realtime Result)",
        tipsTitle: "Color Formatting Tag Tips:",
        tipsSuccess: "Success",
        tipsError: "Failed / Error",
        tipsWarning: "Warning",
        tipsInfo: "Information",
        powershellTip: "PowerShell specific:",
        playSim: "Play Sim",
        stopSim: "Stop Sim",
        copyCode: "Copy Code",
        copied: "Copied!",
        delayLabel: "Delay:",
        customTitle: "Customize Appearance",
        winTitle: "Window Title",
        sysPath: "System Path Prefix",
        fontFamily: "Font Family",
        fontSize: "Font Size",
        opacityLabel: "Window Opacity",
        cursorLabel: "Cursor Type",
        blurLabel: "Glassmorphism Blur",
        bgGradientLabel: "Background Gradient Frame",
        bgFrameTheme: "Theme Background Frame",
        livePreview: "LIVE PREVIEW DECK",
        exportBtn: "Export Image (PNG)",
        exportingBtn: "Exporting...",
        tweakCard: "Tweak Card Presentation",
        canvasShadow: "Canvas Shadow",
        typingSpeed: "Typing Speed",
        themeVisual: "Theme Visual",
        presetSupport: "Preset Support",
        activeReady: "Active & Ready",
        premiumTitle: "🌟 Pro Premium Features",
        premiumDesc: "Unlock full customization power for developers & professional presentations.",
        premiumFeature1: "Vector Export (SVG / PDF Format)",
        premiumFeature2: "Multiple Tabs & Side-by-Side Layouts",
        premiumFeature3: "Automated API Integration (POST /render)",
        premiumFeature4: "Cloud Sync for Preset Logs",
        premiumFeature5: "Custom Logo & Branding in Terminal Header",
        premiumUpgradeBtn: "Get Premium Pro Access",
        devTitle: "👨‍💻 Developer Information",
        devRole: "Senior UI/UX & Backend Engineer",
        devLocation: "Jakarta, Indonesia",
        devContact: "Contact Developer",
        devDesc: "Focused on building high-performance architectures, interactive interfaces, and native optimizations.",
        shadowNone: "No Shadow",
        shadowMd: "Medium Shadow",
        shadowLg: "Soft Dark Shadow",
        shadowGlow: "Neon Glow Backdrop",
        speedFast: "Super Fast (15ms)",
        speedStd: "Standard (30ms)",
        speedSlow: "Slow (50ms)",
        speedVerySlow: "Very Slow (90ms)",
        themeDark: "Dark",
        themeLight: "Light",
        osLabel: "OS Window Frame Theme",
        win11: "Windows 11 (Acrylic)",
        win10: "Windows 10 (Flat)",
        win8: "Windows 8 (Metro)",
        macos: "macOS Terminal (zsh)",
        ubuntu: "Ubuntu Linux (bash)",
        kali: "Kali Linux (Hacker)",
        centos: "CentOS Server (bash)",
        noResultsTitle: "No Results Found",
        noResultsDesc: "Try using different keywords"
      }
    },

    // Presets catalog (Expanded with cross-platform scripts)
    presets: [
      {
        id: 'ping_test',
        name: '🌐 Server Ping Test (.bat)',
        shell: 'cmd',
        os: 'win11',
        title: 'Administrator: Command Prompt - ping google.com',
        path: 'C:\\Users\\Administrator>',
        content: '@echo off\ntitle Administrator: Network Utility\ncolor 0a\necho [info] Initiating ping request for google.com...\nStart-Sleep -m 400\nping google.com\necho [success] Ping command completed successfully.'
      },
      {
        id: 'dir_listing',
        name: '📁 Directory Listing (dir .bat)',
        shell: 'cmd',
        os: 'win10',
        title: 'Command Prompt',
        path: 'C:\\Projects\\ott-engine>',
        content: 'dir\necho. \necho [success] directory structure read completed.'
      },
      {
        id: 'bat_security',
        name: '🚀 Security Audit Script (.bat)',
        shell: 'cmd',
        os: 'win11',
        title: 'Administrator: Security Shield Terminal',
        path: 'C:\\Security\\Shield>',
        content: '@echo off\ntitle Administrator: Security Shield Audit\ncolor 0a\necho [info] Starting Ultimate Enterprise OTT security validation...\nStart-Sleep -m 500\necho [success] Timestamp verification active (Tolerance window: 30s)\nStart-Sleep -m 400\necho [info] Validation of Bearer Token authentication routes...\nStart-Sleep -m 600\necho [success] HMAC-SHA256 signature middleware validated successfully\nStart-Sleep -m 400\ncolor 0c\necho [error] Security Breach: Default AES keys found in Dev config!\nStart-Sleep -m 800\ncolor 0e\necho [warning] Rate Limiter alert: Blocked 12 request spikes.\nStart-Sleep -m 500\ncolor 0a\necho [success] Security shield integrity check completed.'
      },
      {
        id: 'ps_diagnostics',
        name: '🛠️ DB & Redis Diagnostics (.ps1)',
        shell: 'powershell',
        os: 'win11',
        title: 'Windows PowerShell - Connection Check',
        path: 'PS C:\\Projects\\OTT-IPTV>',
        content: '$host.UI.RawUI.WindowTitle = "PowerShell - DB & Redis diagnostics"\nWrite-Host "Initializing connection tests..." -ForegroundColor Green\nStart-Sleep -m 500\n[info] Checking EF Core database provider in appsettings.json...\nStart-Sleep -m 400\n[success] Database Provider: MS SQL Server connected (Host: 10.0.1.12)\nStart-Sleep -m 600\n[info] Resolving Redis Session Server cache availability...\nStart-Sleep -m 400\n[success] Redis Connection state: Active (Host: 127.0.0.1:6379)\nStart-Sleep -m 500\n[warning] Redis Latency warning: Cache responding in 45ms. Threshold is 20ms.\nWrite-Host "Connection check finished with warnings." -ForegroundColor Yellow'
      },
      {
        id: 'ps_antipiracy',
        name: '📡 Anti-Piracy Monitor (.ps1)',
        shell: 'powershell',
        os: 'win11',
        title: 'Administrator: Windows PowerShell - Stream Shield',
        path: 'PS C:\\Windows\\System32>',
        content: '$host.UI.RawUI.WindowTitle = "Administrator: PowerShell Stream Shield"\nWrite-Host "Stream-Guard Engine is running..." -ForegroundColor Cyan\n[info] Target Tenant ID: 8872-Hotel-A\n[success] Dynamic routing mapped through YARP reverse proxy.\nStart-Sleep -m 800\n[info] Monitoring chunk request frequencies on streams...\nStart-Sleep -m 900\n[warning] IP 185.220.101.4 requested 12 chunks in < 2 seconds (Potential IDM Ripper)\nStart-Sleep -m 600\n[error] IP 185.220.101.4 blocked globally via Redis rate limiter!\nWrite-Host "Alert dispatched. SignalR ForceLogout signal sent to session ID: 49b7d." -ForegroundColor Red'
      },
      {
        id: 'macos_nmap',
        name: '🍎 macOS Nmap Security Port Scan (.sh)',
        shell: 'cmd',
        os: 'macos',
        title: 'zsh - terminal - nmap',
        path: 'user@macbook-pro ~ %',
        content: 'nmap -sS -O 192.168.1.1\n\nStarting Nmap 7.92 ( https://nmap.org ) at 2026-06-19 09:50 EST\nNmap scan report for 192.168.1.1\nHost is up (0.0012s latency).\nNot shown: 997 closed tcp ports (reset)\nPORT     STATE SERVICE\n[success]80/tcp   open  http\n[success]443/tcp  open  https\n[warning]22/tcp   open  ssh\n\nDevice type: general purpose\nRunning: Linux 5.X\n[info] OS details: Linux 5.0 - 5.4\n\nNmap done: 1 IP address (1 host up) scanned in 1.82 seconds'
      },
      {
        id: 'ubuntu_docker',
        name: '🐋 Ubuntu Docker Container Up (.sh)',
        shell: 'cmd',
        os: 'ubuntu',
        title: 'bash - ubuntu@client: /var/www',
        path: 'ubuntu@client:~$',
        content: 'sudo docker-compose up -d --build\n\n[info] Creating network "ott_default" with the default driver\n[info] Creating volume "ott_db_data" with default driver\n[info] Building gateway...\n[success] Step 1/5 : FROM mcr.microsoft.com/dotnet/aspnet:10.0\n[success] Step 2/5 : WORKDIR /app\n[success] Step 3/5 : COPY dist/ .\n[success] Step 4/5 : EXPOSE 80\n[success] Step 5/5 : ENTRYPOINT ["dotnet", "Gateway.dll"]\n[success] Successfully built 4d92a10582d\nStart-Sleep -m 800\n[info] Creating database container ... [success]done\n[info] Creating redis container ... [success]done\n[info] Creating reverse-proxy-yarp ... [success]done\nWrite-Host "Services successfully running on ports 80/443" -ForegroundColor Green'
      },
      {
        id: 'kali_exploit',
        name: '🐉 Kali Linux Penetration Test (.sh)',
        shell: 'cmd',
        os: 'kali',
        title: 'kali@kali: ~',
        path: '┌──(kali㉿kali)-[~]\n└─$',
        content: 'msfconsole -q\n\n[success] msf6 > use exploit/multi/handler\n[info] [*] Using configured payload generic/shell_reverse_tcp\n[success] msf6 exploit(multi/handler) > set LHOST 10.0.0.15\nLHOST => 10.0.0.15\n[success] msf6 exploit(multi/handler) > run\nStart-Sleep -m 600\n[info] [*] Started reverse TCP handler on 10.0.0.15:4444 \nStart-Sleep -m 800\n[warning] [*] Sending stage (175174 bytes) to target machine 10.0.0.99\nStart-Sleep -m 500\n[success] [*] Meterpreter session 1 opened (10.0.0.15:4444 -> 10.0.0.99:53120)\n[success] meterpreter > getuid\nServer username: NT AUTHORITY\\SYSTEM (ROOT PRIVILEGES)'
      },
      {
        id: 'centos_nginx',
        name: '⚙️ CentOS Enterprise Nginx Systemctl (.sh)',
        shell: 'cmd',
        os: 'centos',
        title: 'root@centos-server: /etc/nginx',
        path: '[root@centos-server ~]#',
        content: 'sudo systemctl restart nginx\n\n[info] Job for nginx.service status: validating configuration...\nStart-Sleep -m 400\n[success] nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\n[success] nginx: configuration file /etc/nginx/nginx.conf test is successful\n[info] Stopping nginx: [success] OK\n[info] Starting nginx: [success] OK\n[success] Active: active (running) since Fri 2026-06-19 09:51:12 UTC'
      }
    ],

    // Initialize logic
    init() {
      // Set default content
      this.loadPreset(this.presets[0]);
      
      // Watch for editor changes to re-render in real-time
      this.$watch('editorInput', (value) => {
        if (!this.isPlaying) {
          this.parseInputToRendered();
        }
      });
      
      this.$watch('theme', (value) => {
        if (this.terminalOS.startsWith('win')) {
          if (value === 'cmd') {
            this.windowTitle = 'Administrator: Command Prompt';
            this.systemPath = 'C:\\Users\\Administrator>';
          } else {
            this.windowTitle = 'Windows PowerShell';
            this.systemPath = 'PS C:\\Users\\Administrator>';
          }
        }
      });

      // Watcher for isDarkMode to control the HTML dark class
      this.$watch('isDarkMode', (val) => {
        this.updateThemeClass(val);
      });
      
      // Watcher for OS Change
      this.$watch('terminalOS', (val) => {
        this.onOSChange();
      });

      // Sync initial theme
      this.updateThemeClass(this.isDarkMode);
    },

    // Handles default state configurations when switching target OS
    onOSChange() {
      this.stopSimulation();
      
      switch (this.terminalOS) {
        case 'win11':
          this.theme = 'cmd';
          this.windowTitle = 'Administrator: Command Prompt';
          this.systemPath = 'C:\\Users\\Administrator>';
          this.loadPreset(this.presets.find(p => p.id === 'bat_security') || this.presets[0]);
          break;
        case 'win10':
          this.theme = 'cmd';
          this.windowTitle = 'Command Prompt';
          this.systemPath = 'C:\\Users\\Administrator>';
          this.loadPreset(this.presets.find(p => p.id === 'ping_test') || this.presets[0]);
          break;
        case 'win8':
          this.theme = 'cmd';
          this.windowTitle = 'Command Prompt';
          this.systemPath = 'C:\\>';
          this.loadPreset(this.presets.find(p => p.id === 'dir_listing') || this.presets[0]);
          break;
        case 'macos':
          this.theme = 'cmd';
          this.windowTitle = 'zsh - terminal';
          this.systemPath = 'user@macbook-pro ~ %';
          this.loadPreset(this.presets.find(p => p.id === 'macos_nmap') || this.presets[0]);
          break;
        case 'ubuntu':
          this.theme = 'cmd';
          this.windowTitle = 'ubuntu@client: /var/www';
          this.systemPath = 'ubuntu@client:~$';
          this.loadPreset(this.presets.find(p => p.id === 'ubuntu_docker') || this.presets[0]);
          break;
        case 'kali':
          this.theme = 'cmd';
          this.windowTitle = 'kali@kali: ~';
          this.systemPath = '┌──(kali㉿kali)-[~]\n└─$';
          this.loadPreset(this.presets.find(p => p.id === 'kali_exploit') || this.presets[0]);
          break;
        case 'centos':
          this.theme = 'cmd';
          this.windowTitle = 'root@centos-server: /etc/nginx';
          this.systemPath = '[root@centos-server ~]#';
          this.loadPreset(this.presets.find(p => p.id === 'centos_nginx') || this.presets[0]);
          break;
      }
    },

    updateThemeClass(val) {
      if (val) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    },

    getCurrentPresets() {
      return this.presets;
    },

    loadPreset(preset) {
      this.stopSimulation();
      this.theme = preset.shell; // Sync shell type
      this.windowTitle = preset.title;
      this.systemPath = preset.path;
      this.editorInput = preset.content;
      this.parseInputToRendered();
    },

    // Realtime static parser: reads script text line by line
    parseInputToRendered() {
      const lines = this.editorInput.split('\n');
      let isEchoOff = false;
      let activeColorClass = '';
      let tempTitle = this.windowTitle;
      let currentLines = [];

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        // 1. Comments
        if (this.theme === 'cmd' && (trimmed.startsWith('rem') || trimmed.startsWith('::'))) {
          if (!isEchoOff) {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-slate-500 opacity-60' });
          }
          continue;
        }
        if ((this.theme === 'powershell' || this.terminalOS === 'macos' || this.terminalOS === 'ubuntu' || this.terminalOS === 'kali' || this.terminalOS === 'centos') && trimmed.startsWith('#')) {
          currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-slate-500 opacity-65' });
          continue;
        }

        // 2. Clear Screen Commands
        if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear-host' || trimmed.toLowerCase() === 'clear') {
          currentLines = [];
          continue;
        }

        // 3. Title Modifications
        if (this.theme === 'cmd' && trimmed.toLowerCase().startsWith('title ')) {
          tempTitle = rawLine.substring(rawLine.toLowerCase().indexOf('title ') + 6).trim();
          if (!isEchoOff) {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
          }
          continue;
        }
        if (this.theme === 'powershell' && (trimmed.includes('windowtitle') || trimmed.includes('WindowTitle'))) {
          const titleMatch = rawLine.match(/"([^"]+)"/) || rawLine.match(/'([^']+)'/);
          if (titleMatch) {
            tempTitle = titleMatch[1];
          }
          currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-yellow-355 dark:text-yellow-300' });
          continue;
        }

        // 4. Batch Echo Toggle Control
        if (this.theme === 'cmd' && (trimmed.toLowerCase() === '@echo off' || trimmed.toLowerCase() === 'echo off')) {
          isEchoOff = true;
          continue;
        }
        if (this.theme === 'cmd' && (trimmed.toLowerCase() === '@echo on' || trimmed.toLowerCase() === 'echo on')) {
          isEchoOff = false;
          currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
          continue;
        }

        // 5. Batch Color Attribute Control
        if (this.theme === 'cmd' && trimmed.toLowerCase().startsWith('color ')) {
          const colorAttr = trimmed.substring(6).trim();
          const code = colorAttr.length === 2 ? colorAttr[1].toLowerCase() : colorAttr[0].toLowerCase();
          switch (code) {
            case 'a': activeColorClass = 'text-green-500 dark:text-green-400 font-semibold'; break;
            case 'c': activeColorClass = 'text-red-500 font-bold'; break;
            case 'e': activeColorClass = 'text-yellow-500 dark:text-yellow-400'; break;
            case 'b': activeColorClass = 'text-cyan-500 dark:text-cyan-400'; break;
            case '9': activeColorClass = 'text-blue-500 dark:text-blue-450'; break;
            default: activeColorClass = '';
          }
          if (!isEchoOff) {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
          }
          continue;
        }

        // 6. Batch Echo Output command
        if (this.theme === 'cmd' && trimmed.toLowerCase().startsWith('echo ')) {
          const msg = rawLine.substring(rawLine.toLowerCase().indexOf('echo ') + 5);
          if (!isEchoOff) {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
          }
          currentLines.push(this.parseLine(msg, activeColorClass));
          continue;
        }

        // 7. Write-Host block output for PowerShell
        if (this.theme === 'powershell' && trimmed.startsWith('Write-Host')) {
          currentLines.push(this.parseLine(rawLine, activeColorClass));
          continue;
        }

        // 8. Sleep or pauses (represented statically)
        if (trimmed.startsWith('Start-Sleep') || trimmed.toLowerCase() === 'pause') {
          if (this.theme === 'cmd') {
            if (!isEchoOff) {
              currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
            }
            if (trimmed.toLowerCase() === 'pause') {
              currentLines.push({ raw: 'pause', clean: 'Press any key to continue . . .', type: 'normal', classes: 'text-slate-450 opacity-75' });
            }
          } else {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-yellow-355 dark:text-yellow-300' });
          }
          continue;
        }

        // 9. Ping simulator
        if (trimmed.toLowerCase().startsWith('ping ')) {
          const host = trimmed.substring(5).trim().split(' ')[0];
          if (this.theme === 'cmd') {
            if (!isEchoOff) currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
          } else {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-yellow-350 dark:text-yellow-300' });
          }
          
          currentLines.push({ clean: `Pinging ${host} with 32 bytes of data:`, type: 'normal', classes: '' });
          currentLines.push({ clean: `Reply from ${host}: bytes=32 time=12ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          currentLines.push({ clean: `Reply from ${host}: bytes=32 time=10ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          currentLines.push({ clean: `Reply from ${host}: bytes=32 time=11ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          currentLines.push({ clean: `Reply from ${host}: bytes=32 time=9ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          currentLines.push({ clean: `Ping statistics for ${host}:`, type: 'normal', classes: '' });
          currentLines.push({ clean: `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`, type: 'normal', classes: '' });
          continue;
        }

        // 10. Dir/LS command simulator
        if (trimmed.toLowerCase() === 'dir' || trimmed.toLowerCase() === 'ls' || trimmed.toLowerCase() === 'get-childitem') {
          const isWindows = this.terminalOS.startsWith('win');
          if (isWindows && this.theme === 'cmd') {
            if (!isEchoOff) currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
            currentLines.push({ clean: ' Volume in drive C has no label.\n Volume Serial Number is 8A4F-5D9B\n\n Directory of ' + this.systemPath.replace('>', ''), type: 'normal', classes: '' });
            currentLines.push({ clean: '06/19/2026  09:00 AM    <DIR>          .\n06/19/2026  09:00 AM    <DIR>          ..\n06/19/2026  09:12 AM    <DIR>          Documents\n06/19/2026  09:15 AM             1,424 appsettings.json\n06/19/2026  09:30 AM             3,822 WebAPI.csproj\n               2 File(s)          5,246 bytes\n               3 Dir(s)  120,443,908,096 bytes free', type: 'normal', classes: '' });
          } else if (isWindows && this.theme === 'powershell') {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-yellow-350 dark:text-yellow-300' });
            currentLines.push({ clean: '    Directory: C:\\Users\\Administrator\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\nd----           6/19/2026   9:12 AM                Documents\n-a---           6/19/2026   9:15 AM           1424 appsettings.json\n-a---           6/19/2026   9:30 AM           3822 WebAPI.csproj', type: 'normal', classes: '' });
          } else {
            // Linux/macOS
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-emerald-500 dark:text-emerald-400 font-medium' });
            currentLines.push({ clean: 'total 24\ndrwxr-xr-x  3 root root 4096 Jun 19 09:12 Documents\n-rw-r--r--  1 root root 1424 Jun 19 09:15 appsettings.json\n-rw-r--r--  1 root root 3822 Jun 19 09:30 WebAPI.csproj', type: 'normal', classes: '' });
          }
          continue;
        }

        // 11. PowerShell processes simulator
        if (this.theme === 'powershell' && trimmed.toLowerCase().startsWith('get-process')) {
          currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-yellow-350 dark:text-yellow-300' });
          currentLines.push({ clean: 'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n    432      24    34212      45120       1.20   1240   1 powershell\n    812      56   124230     152430      14.50   4290   1 dotnet\n    234      12    12904      18900       0.15   8824   1 redis-server\n    567      32    45600      62000       4.10   9102   1 sqlservr', type: 'normal', classes: '' });
          continue;
        }

        // 12. Default Line Output
        if (this.theme === 'powershell') {
          const isPSStatement = trimmed.includes('=') || trimmed.includes('.') || trimmed.includes('-');
          if (isPSStatement) {
            currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-yellow-350 dark:text-yellow-300' });
          } else {
            currentLines.push(this.parseLine(rawLine, activeColorClass));
          }
        } else {
          const isShell = this.terminalOS === 'macos' || this.terminalOS === 'ubuntu' || this.terminalOS === 'kali' || this.terminalOS === 'centos';
          if (isShell) {
            // macOS / Linux treats the line as direct command
            if (i === 0 || trimmed.includes('-') || trimmed.includes('sudo') || trimmed.includes('nmap') || trimmed.includes('msf')) {
              currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: 'text-emerald-500 dark:text-emerald-400 font-semibold' });
            } else {
              currentLines.push(this.parseLine(rawLine, activeColorClass));
            }
          } else {
            if (!isEchoOff) {
              currentLines.push({ raw: rawLine, clean: rawLine, type: 'command', classes: '' });
            } else {
              currentLines.push(this.parseLine(rawLine, activeColorClass));
            }
          }
        }
      }

      this.renderedLines = currentLines;
    },

    // Individual line parser supporting log format tags & powershell colored prompts
    parseLine(line, activeColorClass = '') {
      let type = 'normal';
      let cleanText = line;
      let extraClasses = activeColorClass;

      // 1. Check custom formatting tags
      if (line.trim().startsWith('[success]')) {
        type = 'success';
        cleanText = line.replace('[success]', '');
      } else if (line.trim().startsWith('[error]')) {
        type = 'error';
        cleanText = line.replace('[error]', '');
      } else if (line.trim().startsWith('[warning]')) {
        type = 'warning';
        cleanText = line.replace('[warning]', '');
      } else if (line.trim().startsWith('[info]')) {
        type = 'info';
        cleanText = line.replace('[info]', '');
      } 
      // 2. Check PowerShell Write-Host directives
      else if (line.trim().startsWith('Write-Host')) {
        type = 'powershell-writehost';
        const textMatch = line.match(/"([^"]+)"/) || line.match(/'([^']+)'/);
        const colorMatch = line.match(/-ForegroundColor\s+(\w+)/i);
        
        if (textMatch) {
          cleanText = textMatch[1];
          const colorName = colorMatch ? colorMatch[1].toLowerCase() : 'white';
          
          switch(colorName) {
            case 'green': extraClasses = 'text-green-500 dark:text-green-400 font-medium'; break;
            case 'red': extraClasses = 'text-red-500 font-bold'; break;
            case 'yellow': extraClasses = 'text-yellow-500 dark:text-yellow-450 font-medium'; break;
            case 'cyan': extraClasses = 'text-cyan-500 dark:text-cyan-400 font-medium'; break;
            case 'magenta': extraClasses = 'text-pink-500 dark:text-pink-400'; break;
            case 'darkyellow': extraClasses = 'text-yellow-600 dark:text-yellow-500'; break;
            case 'gray': extraClasses = 'text-gray-450 dark:text-gray-400'; break;
            default: extraClasses = 'text-slate-100';
          }
        }
      }

      return {
        raw: line,
        clean: cleanText,
        type: type,
        classes: extraClasses
      };
    },

    // Asynchronous Execution Interpreter for typing simulation & timing schedules
    async startSimulation() {
      if (this.isPlaying) {
        this.stopSimulation();
        return;
      }

      this.isPlaying = true;
      this.renderedLines = [];
      this.currentLineIndex = 0;
      this.typingText = '';
      
      const lines = this.editorInput.split('\n');
      
      let isEchoOff = false;
      let activeColorClass = '';
      
      for (let i = 0; i < lines.length; i++) {
        if (!this.isPlaying) break;
        
        this.currentLineIndex = i;
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        // 1. Skip comments
        if (this.theme === 'cmd' && (trimmed.startsWith('rem') || trimmed.startsWith('::'))) {
          if (!isEchoOff) {
            this.renderedLines.push({ clean: rawLine, type: 'command', classes: 'text-slate-500 opacity-60' });
          }
          await this.sleep(100);
          continue;
        }
        if ((this.theme === 'powershell' || this.terminalOS === 'macos' || this.terminalOS === 'ubuntu' || this.terminalOS === 'kali' || this.terminalOS === 'centos') && trimmed.startsWith('#')) {
          this.renderedLines.push({ clean: rawLine, type: 'command', classes: 'text-slate-550 opacity-65' });
          await this.sleep(80);
          continue;
        }

        // 2. Clear Screen
        if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear-host' || trimmed.toLowerCase() === 'clear') {
          this.renderedLines = [];
          await this.sleep(200);
          continue;
        }

        // 3. Batch title change
        if (this.theme === 'cmd' && trimmed.toLowerCase().startsWith('title ')) {
          const newTitle = rawLine.substring(rawLine.toLowerCase().indexOf('title ') + 6).trim();
          this.windowTitle = newTitle;
          if (!isEchoOff) {
            await this.simulateTyping(rawLine);
          }
          continue;
        }

        // 4. PowerShell Window Title change
        if (this.theme === 'powershell' && (trimmed.includes('windowtitle') || trimmed.includes('WindowTitle'))) {
          const titleMatch = rawLine.match(/"([^"]+)"/) || rawLine.match(/'([^']+)'/);
          if (titleMatch) {
            this.windowTitle = titleMatch[1];
          }
          await this.simulateTyping(rawLine, 'text-yellow-355 dark:text-yellow-300');
          continue;
        }

        // 5. Echo off / on toggles
        if (this.theme === 'cmd' && (trimmed.toLowerCase() === '@echo off' || trimmed.toLowerCase() === 'echo off')) {
          isEchoOff = true;
          continue;
        }
        if (this.theme === 'cmd' && (trimmed.toLowerCase() === '@echo on' || trimmed.toLowerCase() === 'echo on')) {
          isEchoOff = false;
          await this.simulateTyping(rawLine);
          continue;
        }

        // 6. Color changes in batch
        if (this.theme === 'cmd' && trimmed.toLowerCase().startsWith('color ')) {
          const colorAttr = trimmed.substring(6).trim();
          const code = colorAttr.length === 2 ? colorAttr[1].toLowerCase() : colorAttr[0].toLowerCase();
          switch (code) {
            case 'a': activeColorClass = 'text-green-500 dark:text-green-400 font-semibold'; break;
            case 'c': activeColorClass = 'text-red-500 font-bold'; break;
            case 'e': activeColorClass = 'text-yellow-500 dark:text-yellow-400'; break;
            case 'b': activeColorClass = 'text-cyan-500 dark:text-cyan-400'; break;
            case '9': activeColorClass = 'text-blue-500 dark:text-blue-450'; break;
            default: activeColorClass = '';
          }
          if (!isEchoOff) {
            await this.simulateTyping(rawLine);
          }
          continue;
        }

        // 7. Batch echo statement
        if (this.theme === 'cmd' && trimmed.toLowerCase().startsWith('echo ')) {
          const msg = rawLine.substring(rawLine.toLowerCase().indexOf('echo ') + 5);
          if (!isEchoOff) {
            await this.simulateTyping(rawLine);
          }
          this.renderedLines.push(this.parseLine(msg, activeColorClass));
          await this.sleep(150);
          continue;
        }

        // 8. PowerShell Write-Host Output
        if (this.theme === 'powershell' && trimmed.startsWith('Write-Host')) {
          this.renderedLines.push(this.parseLine(rawLine, activeColorClass));
          await this.sleep(150);
          continue;
        }

        // 9. Start-Sleep simulation timing logic
        if (trimmed.startsWith('Start-Sleep')) {
          if (this.theme === 'powershell') {
            await this.simulateTyping(rawLine, 'text-yellow-355 dark:text-yellow-300');
          }
          const sMatch = trimmed.match(/-Seconds\s+(\d+)/i) || trimmed.match(/-s\s+(\d+)/i);
          const msMatch = trimmed.match(/-Milliseconds\s+(\d+)/i) || trimmed.match(/-m\s+(\d+)/i);
          
          let sleepDuration = 500;
          if (sMatch) {
            sleepDuration = parseInt(sMatch[1]) * 1000;
          } else if (msMatch) {
            sleepDuration = parseInt(msMatch[1]);
          }
          await this.sleep(sleepDuration);
          continue;
        }

        // Sleep command parsing inside batch
        if (this.theme === 'cmd' && trimmed.startsWith('Start-Sleep')) {
          if (!isEchoOff) {
            await this.simulateTyping(rawLine);
          }
          const msMatch = trimmed.match(/-m\s+(\d+)/i);
          const sleepDuration = msMatch ? parseInt(msMatch[1]) : 500;
          await this.sleep(sleepDuration);
          continue;
        }

        // Pause command simulation in Batch
        if (this.theme === 'cmd' && trimmed.toLowerCase() === 'pause') {
          if (!isEchoOff) {
            await this.simulateTyping(rawLine);
          }
          this.renderedLines.push({ clean: 'Press any key to continue . . .', type: 'normal', classes: 'text-slate-450' });
          await this.sleep(1500);
          continue;
        }

        // Ping simulation runs
        if (trimmed.toLowerCase().startsWith('ping ')) {
          const host = trimmed.substring(5).trim().split(' ')[0];
          if (this.theme === 'cmd') {
            if (!isEchoOff) await this.simulateTyping(rawLine);
          } else {
            await this.simulateTyping(rawLine, 'text-yellow-350 dark:text-yellow-300');
          }
          
          this.renderedLines.push({ clean: `Pinging ${host} with 32 bytes of data:`, type: 'normal', classes: '' });
          await this.sleep(400);
          this.renderedLines.push({ clean: `Reply from ${host}: bytes=32 time=12ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          await this.sleep(300);
          this.renderedLines.push({ clean: `Reply from ${host}: bytes=32 time=10ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          await this.sleep(300);
          this.renderedLines.push({ clean: `Reply from ${host}: bytes=32 time=11ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          await this.sleep(300);
          this.renderedLines.push({ clean: `Reply from ${host}: bytes=32 time=9ms TTL=117`, type: 'success', classes: 'text-green-500 dark:text-green-400' });
          await this.sleep(400);
          this.renderedLines.push({ clean: `Ping statistics for ${host}:`, type: 'normal', classes: '' });
          this.renderedLines.push({ clean: `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`, type: 'normal', classes: '' });
          await this.sleep(400);
          continue;
        }

        // Dir/LS simulation runs
        if (trimmed.toLowerCase() === 'dir' || trimmed.toLowerCase() === 'ls' || trimmed.toLowerCase() === 'get-childitem') {
          const isWindows = this.terminalOS.startsWith('win');
          if (isWindows && this.theme === 'cmd') {
            if (!isEchoOff) await this.simulateTyping(rawLine);
            this.renderedLines.push({ clean: ' Volume in drive C has no label.\n Volume Serial Number is 8A4F-5D9B\n\n Directory of ' + this.systemPath.replace('>', ''), type: 'normal', classes: '' });
            await this.sleep(350);
            this.renderedLines.push({ clean: '06/19/2026  09:00 AM    <DIR>          .\n06/19/2026  09:00 AM    <DIR>          ..\n06/19/2026  09:12 AM    <DIR>          Documents\n06/19/2026  09:15 AM             1,424 appsettings.json\n06/19/2026  09:30 AM             3,822 WebAPI.csproj\n               2 File(s)          5,246 bytes\n               3 Dir(s)  120,443,908,096 bytes free', type: 'normal', classes: '' });
          } else if (isWindows && this.theme === 'powershell') {
            await this.simulateTyping(rawLine, 'text-yellow-355 dark:text-yellow-300');
            this.renderedLines.push({ clean: '    Directory: C:\\Users\\Administrator\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\nd----           6/19/2026   9:12 AM                Documents\n-a---           6/19/2026   9:15 AM           1424 appsettings.json\n-a---           6/19/2026   9:30 AM           3822 WebAPI.csproj', type: 'normal', classes: '' });
          } else {
            await this.simulateTyping(rawLine, 'text-emerald-500 dark:text-emerald-400 font-medium');
            this.renderedLines.push({ clean: 'total 24\ndrwxr-xr-x  3 root root 4096 Jun 19 09:12 Documents\n-rw-r--r--  1 root root 1424 Jun 19 09:15 appsettings.json\n-rw-r--r--  1 root root 3822 Jun 19 09:30 WebAPI.csproj', type: 'normal', classes: '' });
          }
          await this.sleep(500);
          continue;
        }

        // Get-Process simulation runs
        if (this.theme === 'powershell' && trimmed.toLowerCase().startsWith('get-process')) {
          await this.simulateTyping(rawLine, 'text-yellow-355 dark:text-yellow-300');
          this.renderedLines.push({ clean: 'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n    432      24    34212      45120       1.20   1240   1 powershell\n    812      56   124230     152430      14.50   4290   1 dotnet\n    234      12    12904      18900       0.15   8824   1 redis-server\n    567      32    45600      62000       4.10   9102   1 sqlservr', type: 'normal', classes: '' });
          await this.sleep(600);
          continue;
        }

        // Get-Date simulation runs
        if (this.theme === 'powershell' && trimmed.toLowerCase().startsWith('get-date')) {
          await this.simulateTyping(rawLine, 'text-yellow-355 dark:text-yellow-300');
          this.renderedLines.push({ clean: new Date().toString(), type: 'normal', classes: '' });
          await this.sleep(400);
          continue;
        }

        // Default run fallback
        if (this.theme === 'powershell') {
          const isPSStatement = trimmed.includes('=') || trimmed.includes('.') || trimmed.includes('-');
          if (isPSStatement) {
            await this.simulateTyping(rawLine, 'text-yellow-355 dark:text-yellow-300');
          } else {
            this.renderedLines.push(this.parseLine(rawLine, activeColorClass));
            await this.sleep(120);
          }
        } else {
          const isShell = this.terminalOS === 'macos' || this.terminalOS === 'ubuntu' || this.terminalOS === 'kali' || this.terminalOS === 'centos';
          if (isShell) {
            if (i === 0 || trimmed.includes('-') || trimmed.includes('sudo') || trimmed.includes('nmap') || trimmed.includes('msf')) {
              await this.simulateTyping(rawLine, 'text-emerald-500 dark:text-emerald-400 font-semibold');
            } else {
              this.renderedLines.push(this.parseLine(rawLine, activeColorClass));
              await this.sleep(120);
            }
          } else {
            if (!isEchoOff) {
              await this.simulateTyping(rawLine);
            } else {
              this.renderedLines.push(this.parseLine(rawLine, activeColorClass));
              await this.sleep(120);
            }
          }
        }
      }

      this.isPlaying = false;
      this.typingText = '';
    },

    // Types text char-by-char to simulate command keyboard entries
    simulateTyping(text, colorClass = '') {
      return new Promise((resolve) => {
        let charIndex = 0;
        this.typingText = '';
        
        const typeChar = () => {
          if (!this.isPlaying) {
            resolve();
            return;
          }
          
          if (charIndex < text.length) {
            this.typingText += text[charIndex];
            charIndex++;
            this.simTimeout = setTimeout(typeChar, this.textSpeed);
          } else {
            // Typing complete
            this.renderedLines.push({
              clean: this.typingText,
              type: 'command',
              raw: text,
              classes: colorClass
            });
            this.typingText = '';
            this.simTimeout = setTimeout(resolve, 300);
          }
        };
        typeChar();
      });
    },

    // Clear simulation timers
    stopSimulation() {
      this.isPlaying = false;
      if (this.simTimeout) {
        clearTimeout(this.simTimeout);
        this.simTimeout = null;
      }
      this.typingText = '';
      this.parseInputToRendered();
    },

    sleep(ms) {
      return new Promise(resolve => {
        this.simTimeout = setTimeout(resolve, ms);
      });
    },

    // Copy raw console code
    copyCode() {
      navigator.clipboard.writeText(this.editorInput).then(() => {
        this.copied = true;
        setTimeout(() => this.copied = false, 2000);
      });
    },

    // Export terminal window using html2canvas
    exportPNG() {
      if (this.exporting) return;
      this.exporting = true;
      
      const element = document.getElementById('terminal-capture-area');
      const options = {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 2
      };

      html2canvas(element, options).then(canvas => {
        const link = document.createElement('a');
        const defaultName = `${this.terminalOS}_terminal_preview.png`;
        link.download = defaultName;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.exporting = false;
      }).catch(err => {
        console.error('Export failed:', err);
        alert(this.lang === 'id' ? 'Gagal mengekspor gambar. Pastikan browser Anda mendukung canvas export.' : 'Failed to export image. Please check if your browser supports canvas exports.');
        this.exporting = false;
      });
    }
  }));
});
