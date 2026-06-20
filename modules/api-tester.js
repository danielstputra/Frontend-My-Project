/**
 * API Tester Module — Premium Console Suite
 * Real fetch-based API testing tool (100% functional in browser)
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('apiTesterApp', () => ({
    // Request state
    request: {
      method: 'GET',
      url: 'https://httpbin.org/get',
      params: [{ key: '', value: '', enabled: true }],
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: '', value: '', enabled: true }
      ],
      bodyType: 'none', // none | json | form | urlencoded | raw
      bodyJson: '{\n  "key": "value"\n}',
      bodyRaw: '',
      bodyForm: [{ key: '', value: '', enabled: true }],
      bodyUrlencoded: [{ key: '', value: '', enabled: true }],
      auth: {
        type: 'none', // none | bearer | basic | apikey
        bearer: '',
        username: '',
        password: '',
        apiKeyName: 'X-API-Key',
        apiKeyValue: '',
        apiKeyIn: 'header', // header | query
      }
    },

    // Response state
    response: null,
    loading: false,
    corsMode: 'cors', // cors | no-cors | same-origin

    // UI state
    activeTab: 'params',        // params | headers | body | auth
    activeResponseTab: 'body',  // body | headers | info
    bodyJsonError: '',
    showCollections: true,
    showHistory: false,
    showEnvironments: false,
    searchCollection: '',
    searchHistory: '',
    searchEnvironment: '',
    collectionName: '',
    saveDestinationId: '',
    showSaveModal: false,
    notification: '',
    confirmDialog: null,
    promptDialog: null,
    promptInput: '',

    // Environments State
    environments: [],
    activeEnvironmentId: '',
    showEnvModal: false,
    selectedEnvId: null,
    envModalName: '',
    envModalVariables: [{ key: '', value: '', enabled: true }],

    // cURL Import Modal State
    showCurlModal: false,
    curlInput: '',

    // Collections & History
    collections: [],
    history: [],

    // Methods
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    methodColors: {
      GET: 'text-emerald-400',
      POST: 'text-amber-400',
      PUT: 'text-blue-400',
      PATCH: 'text-purple-400',
      DELETE: 'text-red-400',
      HEAD: 'text-cyan-400',
      OPTIONS: 'text-slate-400',
    },

    init() {
      // Load collections
      const savedCols = localStorage.getItem('ag_api_collections');
      if (savedCols) {
        try {
          const parsed = JSON.parse(savedCols);
          // Normalize flat collections to tree structure if needed
          this.collections = parsed.map(c => {
            if (c.type === 'collection' || c.type === 'folder' || c.type === 'request') {
              return c;
            }
            return {
              id: c.id,
              name: c.name,
              type: 'request',
              method: c.method,
              url: c.url,
              request: c.request,
              savedAt: c.savedAt
            };
          });
        } catch(e) {}
      }

      // Load history
      const savedHist = localStorage.getItem('ag_api_history');
      if (savedHist) { try { this.history = JSON.parse(savedHist); } catch(e) {} }

      // Load environments
      const savedEnvs = localStorage.getItem('ag_api_environments');
      if (savedEnvs) { try { this.environments = JSON.parse(savedEnvs); } catch(e) {} }
      const activeEnv = localStorage.getItem('ag_api_active_environment');
      if (activeEnv) { this.activeEnvironmentId = activeEnv; }
      
      this.$watch('loading', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
      this.$watch('response', () => {
        this.$nextTick(() => {
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
    },

    // Variable substitutions
    resolveVariables(val) {
      if (typeof val !== 'string') return val;
      const env = this.environments.find(e => e.id === this.activeEnvironmentId);
      if (!env) return val;
      return val.replace(/\{\{(.+?)\}\}/g, (match, key) => {
        const variable = env.variables.find(v => v.key === key && v.enabled);
        return variable ? variable.value : match;
      });
    },

    get computedUrl() {
      try {
        const u = new URL(this.request.url);
        this.request.params.filter(p => p.enabled && p.key).forEach(p => {
          u.searchParams.set(p.key, p.value);
        });
        if (this.request.auth.type === 'apikey' && this.request.auth.apiKeyIn === 'query') {
          u.searchParams.set(this.request.auth.apiKeyName, this.request.auth.apiKeyValue);
        }
        return u.toString();
      } catch(e) {
        return this.request.url;
      }
    },

    get resolvedComputedUrl() {
      try {
        const resolvedUrl = this.resolveVariables(this.request.url);
        const u = new URL(resolvedUrl);
        this.request.params.filter(p => p.enabled && p.key).forEach(p => {
          u.searchParams.set(this.resolveVariables(p.key), this.resolveVariables(p.value));
        });
        if (this.request.auth.type === 'apikey' && this.request.auth.apiKeyIn === 'query') {
          u.searchParams.set(this.resolveVariables(this.request.auth.apiKeyName), this.resolveVariables(this.request.auth.apiKeyValue));
        }
        return u.toString();
      } catch(e) {
        let urlVal = this.resolveVariables(this.request.url || '');
        const qParams = this.request.params.filter(p => p.enabled && p.key).map(p => {
          return encodeURIComponent(this.resolveVariables(p.key)) + '=' + encodeURIComponent(this.resolveVariables(p.value));
        });
        if (this.request.auth.type === 'apikey' && this.request.auth.apiKeyIn === 'query') {
          qParams.push(encodeURIComponent(this.resolveVariables(this.request.auth.apiKeyName)) + '=' + encodeURIComponent(this.resolveVariables(this.request.auth.apiKeyValue)));
        }
        if (qParams.length > 0) {
          const sep = urlVal.includes('?') ? '&' : '?';
          urlVal += sep + qParams.join('&');
        }
        return urlVal;
      }
    },

    // Hierarchical Collection Tree Logic
    get flattenedCollections() {
      const list = [];
      const traverse = (item, depth = 0, path = []) => {
        const currentPath = [...path, item.name];
        if (item.expanded === undefined) item.expanded = true;
        list.push({
          ...item,
          depth,
          path: currentPath
        });
        if ((item.type === 'collection' || item.type === 'folder') && item.expanded && item.items) {
          item.items.forEach(child => traverse(child, depth + 1, currentPath));
        }
      };
      this.collections.forEach(c => traverse(c, 0, []));
      return list;
    },

    get filteredCollections() {
      if (!this.searchCollection) return this.flattenedCollections;
      const q = this.searchCollection.toLowerCase();
      const list = [];
      const traverseSearch = (item, depth = 0) => {
        if (item.type === 'request' && (item.name.toLowerCase().includes(q) || item.url.toLowerCase().includes(q))) {
          list.push({ ...item, depth });
        }
        if (item.items) {
          item.items.forEach(child => traverseSearch(child, depth + 1));
        }
      };
      this.collections.forEach(c => {
        if (c.type === 'collection' && c.name.toLowerCase().includes(q)) {
          list.push({ ...c, depth: 0 });
        }
        if (c.items) c.items.forEach(child => traverseSearch(child, 1));
      });
      return list;
    },

    get filteredHistory() {
      if (!this.searchHistory) return this.history.slice(0, 50);
      const q = this.searchHistory.toLowerCase();
      return this.history.filter(h => h.url.toLowerCase().includes(q) || h.method.toLowerCase().includes(q)).slice(0, 50);
    },

    async sendRequest() {
      if (!this.request.url || this.request.url.trim() === '') {
        this.showNotification('Please enter a URL');
        return;
      }

      // Validate JSON body with variables resolved
      let bodyJsonResolved = this.resolveVariables(this.request.bodyJson || '');
      if (this.request.bodyType === 'json' && bodyJsonResolved) {
        try { JSON.parse(bodyJsonResolved); this.bodyJsonError = ''; }
        catch(e) { this.bodyJsonError = 'JSON Error: ' + e.message; return; }
      }

      this.loading = true;
      this.response = null;
      const startTime = performance.now();

      try {
        // Build headers
        const headers = {};
        this.request.headers.filter(h => h.enabled && h.key).forEach(h => {
          headers[this.resolveVariables(h.key).trim()] = this.resolveVariables(h.value);
        });

        // Auth headers
        if (this.request.auth.type === 'bearer' && this.request.auth.bearer) {
          headers['Authorization'] = `Bearer ${this.resolveVariables(this.request.auth.bearer)}`;
        } else if (this.request.auth.type === 'basic') {
          const uResolved = this.resolveVariables(this.request.auth.username);
          const pResolved = this.resolveVariables(this.request.auth.password);
          const enc = btoa(`${uResolved}:${pResolved}`);
          headers['Authorization'] = `Basic ${enc}`;
        } else if (this.request.auth.type === 'apikey' && this.request.auth.apiKeyIn === 'header') {
          headers[this.resolveVariables(this.request.auth.apiKeyName)] = this.resolveVariables(this.request.auth.apiKeyValue);
        }

        // Build body
        let body = undefined;
        const method = this.request.method;
        if (!['GET', 'HEAD'].includes(method)) {
          if (this.request.bodyType === 'json') {
            body = bodyJsonResolved;
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
          } else if (this.request.bodyType === 'form') {
            const fd = new FormData();
            this.request.bodyForm.filter(f => f.enabled && f.key).forEach(f => {
              fd.append(this.resolveVariables(f.key), this.resolveVariables(f.value));
            });
            body = fd;
          } else if (this.request.bodyType === 'urlencoded') {
            const p = new URLSearchParams();
            this.request.bodyUrlencoded.filter(f => f.enabled && f.key).forEach(f => {
              p.append(this.resolveVariables(f.key), this.resolveVariables(f.value));
            });
            body = p.toString();
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
          } else if (this.request.bodyType === 'raw') {
            body = this.resolveVariables(this.request.bodyRaw);
          }
        }

        const fetchOptions = { method, headers, mode: this.corsMode };
        if (body !== undefined) fetchOptions.body = body;

        const res = await fetch(this.resolvedComputedUrl, fetchOptions);
        const elapsed = Math.round(performance.now() - startTime);

        // Parse response headers
        const resHeaders = {};
        res.headers.forEach((v, k) => { resHeaders[k] = v; });

        // Parse body
        let resBody = '';
        let size = 0;
        let isJson = false;
        const ct = (res.headers.get('content-type') || '');

        try {
          const buf = await res.clone().arrayBuffer();
          size = buf.byteLength;
        } catch(e) {}

        try {
          if (ct.includes('json')) {
            const json = await res.json();
            resBody = JSON.stringify(json, null, 2);
            isJson = true;
          } else {
            resBody = await res.text();
          }
        } catch(e) {
          resBody = '[Unable to parse response body]';
        }

        this.response = {
          status: res.status,
          statusText: res.statusText,
          headers: resHeaders,
          body: resBody,
          isJson,
          time: elapsed,
          size,
          ok: res.ok,
          error: false,
        };

        this.addToHistory();
      } catch(err) {
        const elapsed = Math.round(performance.now() - startTime);
        this.response = {
          status: 0,
          statusText: 'Network Error',
          headers: {},
          body: `❌ Request Failed\n\nError: ${err.message}\n\nPossible causes:\n• CORS policy blocked the request\n• Network unavailable\n• Invalid URL or hostname\n• Server is down or unreachable\n\nSolutions:\n• Switch CORS Mode to "no-cors"\n• Use a CORS proxy (e.g. cors-anywhere)\n• Check if the server allows cross-origin requests\n• Ensure the URL is correct`,
          isJson: false,
          time: elapsed,
          size: 0,
          ok: false,
          error: true,
        };
      } finally {
        this.loading = false;
      }
    },

    addToHistory() {
      const entry = {
        id: Date.now(),
        method: this.request.method,
        url: this.resolvedComputedUrl,
        status: this.response?.status || 0,
        time: this.response?.time || 0,
        timestamp: new Date().toLocaleTimeString(),
      };
      this.history.unshift(entry);
      if (this.history.length > 100) this.history.pop();
      localStorage.setItem('ag_api_history', JSON.stringify(this.history));
    },

    // Collections Tree CRUD
    saveCollectionsToStorage() {
      localStorage.setItem('ag_api_collections', JSON.stringify(this.collections));
      this.$nextTick(() => {
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      });
    },

    createCollection() {
      this.promptInput = '';
      this.promptDialog = {
        title: 'New Collection',
        label: 'Collection Name',
        placeholder: 'Enter collection name...',
        callback: (name) => {
          if (!name || !name.trim()) return;
          this.collections.push({
            id: Date.now(),
            name: name.trim(),
            type: 'collection',
            items: [],
            expanded: true
          });
          this.saveCollectionsToStorage();
          this.showNotification('✅ Collection created');
        }
      };
    },

    createFolder(parentId) {
      this.promptInput = '';
      this.promptDialog = {
        title: 'New Folder',
        label: 'Folder Name',
        placeholder: 'Enter folder name...',
        callback: (name) => {
          if (!name || !name.trim()) return;
          const newFolder = {
            id: Date.now(),
            name: name.trim(),
            type: 'folder',
            items: [],
            expanded: true
          };

          const addFolderToTree = (items) => {
            for (let item of items) {
              if (item.id === parentId) {
                if (!item.items) item.items = [];
                item.items.unshift(newFolder);
                return true;
              }
              if (item.items) {
                if (addFolderToTree(item.items)) return true;
              }
            }
            return false;
          };

          addFolderToTree(this.collections);
          this.saveCollectionsToStorage();
          this.showNotification('✅ Folder created');
        }
      };
    },

    deleteCollectionItem(id) {
      this.confirmDialog = {
        title: 'Delete Item',
        message: 'Are you sure you want to delete this collection or request?',
        callback: () => {
          const deleteFromTree = (items) => {
            for (let i = 0; i < items.length; i++) {
              if (items[i].id === id) {
                items.splice(i, 1);
                return true;
              }
              if (items[i].items) {
                if (deleteFromTree(items[i].items)) return true;
              }
            }
            return false;
          };
          deleteFromTree(this.collections);
          this.saveCollectionsToStorage();
          this.showNotification('❌ Deleted successfully');
        }
      };
    },

    toggleExpand(item) {
      item.expanded = !item.expanded;
      this.saveCollectionsToStorage();
    },

    get destinationOptions() {
      const options = [];
      const traverse = (item, path = '') => {
        if (item.type === 'collection' || item.type === 'folder') {
          const name = path ? `${path} / ${item.name}` : item.name;
          options.push({ id: item.id, name });
          if (item.items) {
            item.items.forEach(child => traverse(child, name));
          }
        }
      };
      this.collections.forEach(c => traverse(c));
      return options;
    },

    saveToCollection() {
      if (!this.collectionName.trim()) { this.showNotification('Enter a name for this request'); return; }
      const newRequest = {
        id: Date.now(),
        name: this.collectionName.trim(),
        type: 'request',
        method: this.request.method,
        url: this.request.url,
        request: JSON.parse(JSON.stringify(this.request)),
        savedAt: new Date().toLocaleString(),
      };

      if (this.collections.length === 0) {
        this.collections.push({
          id: Date.now() - 1,
          name: 'My Collection',
          type: 'collection',
          items: [newRequest],
          expanded: true
        });
      } else {
        const destId = this.saveDestinationId ? parseInt(this.saveDestinationId) : this.collections[0].id;
        const insertRequestIntoTree = (items, parentId) => {
          for (let item of items) {
            if (item.id === parentId) {
              if (!item.items) item.items = [];
              item.items.unshift(newRequest);
              return true;
            }
            if (item.items) {
              if (insertRequestIntoTree(item.items, parentId)) return true;
            }
          }
          return false;
        };

        const inserted = insertRequestIntoTree(this.collections, destId);
        if (!inserted) {
          if (!this.collections[0].items) this.collections[0].items = [];
          this.collections[0].items.unshift(newRequest);
        }
      }

      this.saveCollectionsToStorage();
      this.collectionName = '';
      this.showSaveModal = false;
      this.showNotification('✅ Saved to Collections');
    },

    loadCollection(item) {
      this.request = JSON.parse(JSON.stringify(item.request));
      this.response = null;
      this.showNotification(`Loaded: ${item.name}`);
    },

    loadHistory(item) {
      this.request.method = item.method;
      this.request.url = item.url;
      this.response = null;
    },

    clearHistory() {
      this.history = [];
      localStorage.removeItem('ag_api_history');
    },

    addParam() { this.request.params.push({ key: '', value: '', enabled: true }); },
    removeParam(i) { this.request.params.splice(i, 1); },
    addHeader() { this.request.headers.push({ key: '', value: '', enabled: true }); },
    removeHeader(i) { this.request.headers.splice(i, 1); },
    addFormField() { this.request.bodyForm.push({ key: '', value: '', enabled: true }); },
    removeFormField(i) { this.request.bodyForm.splice(i, 1); },
    addUrlencodedField() { this.request.bodyUrlencoded.push({ key: '', value: '', enabled: true }); },
    removeUrlencodedField(i) { this.request.bodyUrlencoded.splice(i, 1); },

    copyResponse() {
      if (!this.response) return;
      navigator.clipboard.writeText(this.response.body).then(() => this.showNotification('✅ Response copied'));
    },

    copyCurl() {
      let curl = `curl -X ${this.request.method} '${this.computedUrl}'`;
      this.request.headers.filter(h => h.enabled && h.key).forEach(h => {
        curl += ` \\\n  -H '${h.key}: ${h.value}'`;
      });
      if (this.request.bodyType === 'json' && this.request.bodyJson) {
        curl += ` \\\n  -d '${this.request.bodyJson.replace(/'/g, "\\'")}'`;
      }
      navigator.clipboard.writeText(curl).then(() => this.showNotification('✅ cURL copied'));
    },

    formatJson() {
      try {
        const parsed = JSON.parse(this.request.bodyJson);
        this.request.bodyJson = JSON.stringify(parsed, null, 2);
        this.bodyJsonError = '';
      } catch(e) {
        this.bodyJsonError = e.message;
      }
    },

    get statusClass() {
      if (!this.response) return '';
      const s = this.response.status;
      if (s >= 200 && s < 300) return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30';
      if (s >= 300 && s < 400) return 'text-blue-400 bg-blue-400/10 border-blue-500/30';
      if (s >= 400 && s < 500) return 'text-amber-400 bg-amber-400/10 border-amber-500/30';
      if (s >= 500) return 'text-red-400 bg-red-400/10 border-red-500/30';
      return 'text-slate-400 bg-slate-400/10 border-slate-500/30';
    },

    formatSize(bytes) {
      if (bytes === 0) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    },

    showNotification(msg) {
      this.notification = msg;
      setTimeout(() => this.notification = '', 3000);
    },

    get activeMethodColor() {
      return this.methodColors[this.request.method] || 'text-slate-400';
    },

    // Environments Manager Functions
    saveEnvironmentsToStorage() {
      localStorage.setItem('ag_api_environments', JSON.stringify(this.environments));
      localStorage.setItem('ag_api_active_environment', this.activeEnvironmentId);
    },

    selectEnvironment(envId) {
      this.activeEnvironmentId = envId;
      this.saveEnvironmentsToStorage();
    },

    createEnvironment() {
      this.promptInput = '';
      this.promptDialog = {
        title: 'New Environment',
        label: 'Environment Name',
        placeholder: 'Enter environment name...',
        callback: (name) => {
          if (!name || !name.trim()) return;
          const newEnv = {
            id: 'env_' + Date.now(),
            name: name.trim(),
            variables: [{ key: '', value: '', enabled: true }]
          };
          this.environments.push(newEnv);
          this.saveEnvironmentsToStorage();
          this.editEnvironment(newEnv);
        }
      };
    },

    editEnvironment(env) {
      this.selectedEnvId = env.id;
      this.envModalName = env.name;
      this.envModalVariables = JSON.parse(JSON.stringify(env.variables));
      if (this.envModalVariables.length === 0) {
        this.envModalVariables.push({ key: '', value: '', enabled: true });
      }
      this.showEnvModal = true;
    },

    saveEnvironmentModal() {
      if (!this.envModalName.trim()) { this.showNotification('Please enter environment name'); return; }
      const env = this.environments.find(e => e.id === this.selectedEnvId);
      if (env) {
        env.name = this.envModalName.trim();
        env.variables = this.envModalVariables.filter(v => v.key.trim() !== '');
        this.saveEnvironmentsToStorage();
        this.showEnvModal = false;
        this.showNotification('✅ Environment updated');
      }
    },

    deleteEnvironment(id) {
      this.confirmDialog = {
        title: 'Delete Environment',
        message: 'Are you sure you want to delete this environment? All variables will be lost.',
        callback: () => {
          this.environments = this.environments.filter(e => e.id !== id);
          if (this.activeEnvironmentId === id) this.activeEnvironmentId = '';
          this.saveEnvironmentsToStorage();
          this.showNotification('❌ Environment deleted');
        }
      };
    },

    addEnvModalVariable() {
      this.envModalVariables.push({ key: '', value: '', enabled: true });
    },

    removeEnvModalVariable(i) {
      this.envModalVariables.splice(i, 1);
      if (this.envModalVariables.length === 0) {
        this.envModalVariables.push({ key: '', value: '', enabled: true });
      }
    },

    get filteredEnvironments() {
      if (!this.searchEnvironment) return this.environments;
      const q = this.searchEnvironment.toLowerCase();
      return this.environments.filter(e => e.name.toLowerCase().includes(q));
    },

    // Import/Export DN files
    exportApiTest() {
      const data = {
        fileType: 'AntigravityApiTest',
        version: '1.0',
        collections: this.collections,
        environments: this.environments
      };
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api_test_suite_${new Date().toISOString().slice(0,10)}.dn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showNotification('📤 Exported API Suite to .dn file');
    },

    importApiTest(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.fileType !== 'AntigravityApiTest') {
            this.showNotification('Invalid file format. Please upload a valid .dn file.');
            return;
          }
          if (data.collections && Array.isArray(data.collections)) {
            this.collections = [...this.collections, ...data.collections];
            this.saveCollectionsToStorage();
          }
          if (data.environments && Array.isArray(data.environments)) {
            this.environments = [...this.environments, ...data.environments];
            this.saveEnvironmentsToStorage();
          }
          this.showNotification('📥 Imported API Suite successfully');
        } catch(err) {
          this.showNotification('Error parsing file: ' + err.message);
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },

    createNewRequest() {
      this.request = {
        method: 'GET',
        url: '',
        params: [{ key: '', value: '', enabled: true }],
        headers: [
          { key: 'Accept', value: 'application/json', enabled: true },
          { key: '', value: '', enabled: true }
        ],
        bodyType: 'none',
        bodyJson: '{\n  "key": "value"\n}',
        bodyRaw: '',
        bodyForm: [{ key: '', value: '', enabled: true }],
        bodyUrlencoded: [{ key: '', value: '', enabled: true }],
        auth: {
          type: 'none',
          bearer: '',
          username: '',
          password: '',
          apiKeyName: 'X-API-Key',
          apiKeyValue: '',
          apiKeyIn: 'header',
        }
      };
      this.response = null;
      this.showNotification('🆕 New request scratchpad ready');
    },

    // cURL Parser Logic
    parseCurlCommand(curl) {
      if (!curl) return null;
      let cmd = curl.replace(/\\\s*\n/g, ' ').trim();
      const args = [];
      let current = '';
      let inDoubleQuote = false;
      let inSingleQuote = false;
      
      for (let i = 0; i < cmd.length; i++) {
        const char = cmd[i];
        if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
        } else if (char === ' ' && !inDoubleQuote && !inSingleQuote) {
          if (current.trim()) {
            args.push(current.trim());
            current = '';
          }
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        args.push(current.trim());
      }

      let method = 'GET';
      let url = '';
      const headers = [];
      let body = '';
      let bodyType = 'none';

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-X' || arg === '--request') {
          method = args[++i].replace(/['"]/g, '').toUpperCase();
        } else if (arg === '-H' || arg === '--header') {
          const headerStr = args[++i].replace(/['"]/g, '');
          const colonIdx = headerStr.indexOf(':');
          if (colonIdx > -1) {
            const key = headerStr.substring(0, colonIdx).trim();
            const value = headerStr.substring(colonIdx + 1).trim();
            headers.push({ key, value, enabled: true });
          }
        } else if (arg === '-d' || arg === '--data' || arg === '--data-raw' || arg === '--data-binary') {
          body = args[++i];
          if ((body.startsWith("'") && body.endsWith("'")) || (body.startsWith('"') && body.endsWith('"'))) {
            body = body.slice(1, -1);
          }
          if (method === 'GET') method = 'POST';
          bodyType = 'raw';
        } else if (arg.startsWith('http://') || arg.startsWith('https://') || (arg.includes('.') && !arg.startsWith('-'))) {
          url = arg.replace(/['"]/g, '');
        }
      }

      if (!url) {
        const startIdx = args[0].toLowerCase() === 'curl' ? 1 : 0;
        for (let i = startIdx; i < args.length; i++) {
          if (!args[i].startsWith('-') && !['get', 'post', 'put', 'delete', 'patch'].includes(args[i].toLowerCase())) {
            const prev = args[i-1];
            if (prev !== '-X' && prev !== '--request' && prev !== '-H' && prev !== '--header' && prev !== '-d' && prev !== '--data' && prev !== '--data-raw' && prev !== '--data-binary') {
              url = args[i].replace(/['"]/g, '');
              break;
            }
          }
        }
      }

      if (body) {
        const ctHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
        if (ctHeader) {
          if (ctHeader.value.toLowerCase().includes('application/json')) {
            bodyType = 'json';
          } else if (ctHeader.value.toLowerCase().includes('application/x-www-form-urlencoded')) {
            bodyType = 'urlencoded';
          } else if (ctHeader.value.toLowerCase().includes('multipart/form-data')) {
            bodyType = 'form';
          }
        }
      }

      return { method, url, headers, body, bodyType };
    },

    importCurl() {
      if (!this.curlInput.trim()) {
        this.showNotification('Please paste a cURL command');
        return;
      }
      const parsed = this.parseCurlCommand(this.curlInput);
      if (parsed) {
        this.request.method = parsed.method;
        this.request.url = parsed.url;
        this.request.headers = parsed.headers;
        if (this.request.headers.length === 0 || this.request.headers[this.request.headers.length - 1].key !== '') {
          this.request.headers.push({ key: '', value: '', enabled: true });
        }
        this.request.bodyType = parsed.bodyType;
        if (parsed.bodyType === 'json') {
          this.request.bodyJson = parsed.body;
        } else if (parsed.bodyType === 'raw') {
          this.request.bodyRaw = parsed.body;
        } else if (parsed.bodyType === 'urlencoded') {
          const fields = [];
          const params = new URLSearchParams(parsed.body);
          params.forEach((val, key) => {
            fields.push({ key, value: val, enabled: true });
          });
          if (fields.length === 0) fields.push({ key: '', value: '', enabled: true });
          this.request.bodyUrlencoded = fields;
        } else {
          this.request.bodyRaw = parsed.body;
        }
        this.curlInput = '';
        this.showCurlModal = false;
        this.showNotification('✅ cURL Command Imported');
      } else {
        this.showNotification('Failed to parse cURL command');
      }
    },

    get responseSyntaxHighlight() {
      if (!this.response || !this.response.body) return '';
      let html = this.response.body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      if (this.response.isJson) {
        html = html
          .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
            let cls = 'text-purple-400';
            if (/^"/.test(match)) {
              if (/:$/.test(match)) cls = 'text-sky-300';
              else cls = 'text-amber-300';
            } else if (/true|false/.test(match)) cls = 'text-emerald-400';
            else if (/null/.test(match)) cls = 'text-slate-500';
            return `<span class="${cls}">${match}</span>`;
          });
      }
      return html;
    }
  }));
});
