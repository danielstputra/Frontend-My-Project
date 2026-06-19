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
    searchCollection: '',
    searchHistory: '',
    collectionName: '',
    showSaveModal: false,
    notification: '',

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
      // Load from localStorage
      const savedCols = localStorage.getItem('ag_api_collections');
      if (savedCols) { try { this.collections = JSON.parse(savedCols); } catch(e) {} }
      const savedHist = localStorage.getItem('ag_api_history');
      if (savedHist) { try { this.history = JSON.parse(savedHist); } catch(e) {} }
    },

    get computedUrl() {
      try {
        const u = new URL(this.request.url);
        this.request.params.filter(p => p.enabled && p.key).forEach(p => {
          u.searchParams.set(p.key, p.value);
        });
        // Auth as query param
        if (this.request.auth.type === 'apikey' && this.request.auth.apiKeyIn === 'query') {
          u.searchParams.set(this.request.auth.apiKeyName, this.request.auth.apiKeyValue);
        }
        return u.toString();
      } catch(e) {
        return this.request.url;
      }
    },

    get filteredCollections() {
      if (!this.searchCollection) return this.collections;
      const q = this.searchCollection.toLowerCase();
      return this.collections.filter(c => c.name.toLowerCase().includes(q) || c.url.toLowerCase().includes(q));
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

      // Validate JSON body
      if (this.request.bodyType === 'json' && this.request.bodyJson) {
        try { JSON.parse(this.request.bodyJson); this.bodyJsonError = ''; }
        catch(e) { this.bodyJsonError = e.message; return; }
      }

      this.loading = true;
      this.response = null;
      const startTime = performance.now();

      try {
        // Build headers
        const headers = {};
        this.request.headers.filter(h => h.enabled && h.key).forEach(h => {
          headers[h.key.trim()] = h.value;
        });

        // Auth headers
        if (this.request.auth.type === 'bearer' && this.request.auth.bearer) {
          headers['Authorization'] = `Bearer ${this.request.auth.bearer}`;
        } else if (this.request.auth.type === 'basic') {
          const enc = btoa(`${this.request.auth.username}:${this.request.auth.password}`);
          headers['Authorization'] = `Basic ${enc}`;
        } else if (this.request.auth.type === 'apikey' && this.request.auth.apiKeyIn === 'header') {
          headers[this.request.auth.apiKeyName] = this.request.auth.apiKeyValue;
        }

        // Build body
        let body = undefined;
        const method = this.request.method;
        if (!['GET', 'HEAD'].includes(method)) {
          if (this.request.bodyType === 'json') {
            body = this.request.bodyJson;
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
          } else if (this.request.bodyType === 'form') {
            const fd = new FormData();
            this.request.bodyForm.filter(f => f.enabled && f.key).forEach(f => fd.append(f.key, f.value));
            body = fd;
          } else if (this.request.bodyType === 'urlencoded') {
            const p = new URLSearchParams();
            this.request.bodyUrlencoded.filter(f => f.enabled && f.key).forEach(f => p.append(f.key, f.value));
            body = p.toString();
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
          } else if (this.request.bodyType === 'raw') {
            body = this.request.bodyRaw;
          }
        }

        const fetchOptions = { method, headers, mode: this.corsMode };
        if (body !== undefined) fetchOptions.body = body;

        const res = await fetch(this.computedUrl, fetchOptions);
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
        url: this.computedUrl,
        status: this.response?.status || 0,
        time: this.response?.time || 0,
        timestamp: new Date().toLocaleTimeString(),
      };
      this.history.unshift(entry);
      if (this.history.length > 100) this.history.pop();
      localStorage.setItem('ag_api_history', JSON.stringify(this.history));
    },

    saveToCollection() {
      if (!this.collectionName.trim()) { this.showNotification('Enter a name for this request'); return; }
      const entry = {
        id: Date.now(),
        name: this.collectionName.trim(),
        method: this.request.method,
        url: this.request.url,
        request: JSON.parse(JSON.stringify(this.request)),
        savedAt: new Date().toLocaleString(),
      };
      this.collections.unshift(entry);
      localStorage.setItem('ag_api_collections', JSON.stringify(this.collections));
      this.collectionName = '';
      this.showSaveModal = false;
      this.showNotification('✅ Saved to Collections');
    },

    loadCollection(item) {
      this.request = JSON.parse(JSON.stringify(item.request));
      this.response = null;
      this.showNotification(`Loaded: ${item.name}`);
    },

    deleteCollection(id) {
      this.collections = this.collections.filter(c => c.id !== id);
      localStorage.setItem('ag_api_collections', JSON.stringify(this.collections));
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

    get responseSyntaxHighlight() {
      if (!this.response || !this.response.body) return '';
      // Simple syntax highlight using spans
      let html = this.response.body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      // JSON highlight
      if (this.response.isJson) {
        html = html
          .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
            let cls = 'text-purple-400'; // number
            if (/^"/.test(match)) {
              if (/:$/.test(match)) cls = 'text-sky-300'; // key
              else cls = 'text-amber-300'; // string
            } else if (/true|false/.test(match)) cls = 'text-emerald-400';
            else if (/null/.test(match)) cls = 'text-slate-500';
            return `<span class="${cls}">${match}</span>`;
          });
      }
      return html;
    }
  }));
});
