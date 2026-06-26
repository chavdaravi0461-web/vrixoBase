(function () {
  'use strict';

  var REFRESH_TOKEN_KEY = 'vrixo_refresh_token';
  var ACCESS_TOKEN_KEY = 'vrixo_access_token';
  var API_KEY_KEY = 'vrixo_api_key';
  var API_BASE = window.location.origin;

  function getRefreshToken() {
    try { return localStorage.getItem(REFRESH_TOKEN_KEY); } catch (e) { return null; }
  }
  function getAccessToken() {
    try { return localStorage.getItem(ACCESS_TOKEN_KEY); } catch (e) { return null; }
  }
  function getApiKey() {
    try { return localStorage.getItem(API_KEY_KEY); } catch (e) { return null; }
  }
  function setTokens(access, refresh) {
    try {
      if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    } catch (e) {}
  }
  function clearTokens() {
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch (e) {}
  }

  function decodeToken(token) {
    try { return JSON.parse(atob(token.split('.')[1])); } catch (e) { return null; }
  }

  function formatTimeLeft(ms) {
    if (ms <= 0) return 'Expired';
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var h = Math.floor(m / 60);
    s = s % 60;
    m = m % 60;
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  }

  function createStatusBar() {
    var existing = document.getElementById('vrixo-auth-status');
    if (existing) return existing;
    var bar = document.createElement('div');
    bar.id = 'vrixo-auth-status';
    bar.style.cssText = 'padding:8px 16px;margin:0;font-size:13px;font-family:monospace;background:#1b1b1f;color:#e4e4e7;border-bottom:1px solid #27272a;display:none';
    var target = document.querySelector('.swagger-ui') || document.body;
    target.insertBefore(bar, target.firstChild);
    return bar;
  }

  function updateStatusBar() {
    var bar = createStatusBar();
    var token = getAccessToken();
    var apiKey = getApiKey();
    var payload = token ? decodeToken(token) : null;
    if (!token && !apiKey) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    var parts = [];
    if (payload && payload.email) parts.push('<b>' + escapeHtml(payload.email) + '</b>');
    if (payload && payload.sub) parts.push('ID: <code>' + payload.sub.substring(0, 8) + '...</code>');
    if (payload && payload.role) parts.push('Role: ' + payload.role);
    if (apiKey) parts.push('API Key auth');
    if (payload && payload.exp) {
      var expiresIn = payload.exp * 1000 - Date.now();
      var cls = expiresIn < 60000 ? 'color:#ef4444' : expiresIn < 300000 ? 'color:#f59e0b' : 'color:#22c55e';
      parts.push('Token: <span style="' + cls + '">' + formatTimeLeft(Math.max(0, expiresIn)) + '</span>');
    }
    bar.innerHTML = 'Authenticated as: ' + parts.join(' | ');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function updateSwaggerAuth(token) {
    if (window.ui && window.ui.authSelectors && window.ui.authActions) {
      var definitions = window.ui.authSelectors.shownDefinitions();
      if (definitions && definitions['JWT-auth']) {
        window.ui.authActions.authorize({
          'JWT-auth': { name: 'JWT-auth', schema: { type: 'apiKey', in: 'header', name: 'Authorization' }, value: 'Bearer ' + token }
        });
      }
    }
  }

  function updateSwaggerApiKey(apiKey) {
    if (window.ui && window.ui.authSelectors && window.ui.authActions) {
      var definitions = window.ui.authSelectors.shownDefinitions();
      if (definitions && definitions['ApiKey-auth']) {
        window.ui.authActions.authorize({
          'ApiKey-auth': { name: 'ApiKey-auth', schema: { type: 'apiKey', in: 'header', name: 'x-api-key' }, value: apiKey }
        });
      }
    }
  }

  function persistSwaggerAuth() {
    if (window.ui && window.ui.authSelectors && window.ui.authActions) {
      var definitions = window.ui.authSelectors.shownDefinitions();
      var token = getAccessToken();
      var apiKey = getApiKey();
      if (token && definitions && definitions['JWT-auth']) {
        var val = definitions['JWT-auth'].get('value');
        if (!val || val === 'Bearer undefined' || val === 'Bearer null') {
          updateSwaggerAuth(token);
        }
      }
      if (apiKey && definitions && definitions['ApiKey-auth']) {
        var val = definitions['ApiKey-auth'].get('value');
        if (!val || val === 'undefined' || val === 'null') {
          updateSwaggerApiKey(apiKey);
        }
      }
    }
  }

  function waitForSwagger(retries, cb) {
    if (window.ui && window.ui.authSelectors) { cb(); return; }
    if (retries <= 0) return;
    setTimeout(function () { waitForSwagger(retries - 1, cb); }, 500);
  }

  var isRefreshing = false;
  var refreshSubscribers = [];

  function onRefreshed(token) {
    refreshSubscribers.forEach(function (cb) { cb(token); });
    refreshSubscribers = [];
  }

  function doRefresh() {
    var refreshToken = getRefreshToken();
    if (!refreshToken) return Promise.resolve(null);
    return fetch(API_BASE + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken })
    }).then(function (res) {
      if (!res.ok) { clearTokens(); return null; }
      return res.json().then(function (body) {
        var data = body.data || body;
        if (data.accessToken && data.refreshToken) {
          setTokens(data.accessToken, data.refreshToken);
          return data.accessToken;
        }
        return null;
      });
    }).catch(function () { return null; });
  }

  function isTokenExpired(token) {
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch (e) { return true; }
  }

  var originalFetch = window.fetch;
  window.fetch = function (url, opts) {
    var shouldAuth = typeof url === 'string' && url.indexOf('/api/') !== -1 && url.indexOf('/api/auth/') === -1;
    if (shouldAuth && !opts) opts = {};
    if (shouldAuth) {
      var accessToken = getAccessToken();
      if (accessToken && isTokenExpired(accessToken) && !isRefreshing) {
        isRefreshing = true;
        return doRefresh().then(function (newToken) {
          isRefreshing = false;
          onRefreshed(newToken);
          if (newToken) {
            updateSwaggerAuth(newToken);
            opts.headers = opts.headers || {};
            opts.headers['Authorization'] = 'Bearer ' + newToken;
          }
          updateStatusBar();
          return originalFetch.call(window, url, opts);
        });
      }
    }
    return originalFetch.call(window, url, opts).then(function (response) {
      if (shouldAuth && response.status === 401 && !isRefreshing) {
        var cloned = response.clone();
        return cloned.text().then(function (text) {
          if (text.indexOf('Invalid or expired token') !== -1 || text.indexOf('Unauthorized') !== -1) {
            var token = getAccessToken();
            if (token) {
              isRefreshing = true;
              return doRefresh().then(function (newToken) {
                isRefreshing = false;
                onRefreshed(newToken);
                if (newToken) {
                  updateSwaggerAuth(newToken);
                  opts.headers = opts.headers || {};
                  opts.headers['Authorization'] = 'Bearer ' + newToken;
                  updateStatusBar();
                  return originalFetch.call(window, url, opts);
                }
                return response;
              });
            }
          }
          return response;
        });
      }
      return response;
    });
  };

  waitForSwagger(20, function () {
    var token = getAccessToken();
    var apiKey = getApiKey();
    if (token) updateSwaggerAuth(token);
    if (apiKey) updateSwaggerApiKey(apiKey);
    persistSwaggerAuth();
    updateStatusBar();
    setInterval(updateStatusBar, 5000);

    var origAuthorize = window.ui.authActions.authorize;
    if (origAuthorize) {
      window.ui.authActions.authorize = function (definitions) {
        var result = origAuthorize.call(window.ui.authActions, definitions);
        if (definitions && definitions['JWT-auth']) {
          var value = definitions['JWT-auth'].value;
          if (value && value.indexOf('Bearer ') === 0) {
            setTokens(value.substring(7), null);
          }
        }
        if (definitions && definitions['ApiKey-auth']) {
          var val = definitions['ApiKey-auth'].value;
          if (val) {
            try { localStorage.setItem(API_KEY_KEY, val); } catch (e) {}
          }
        }
        updateStatusBar();
        return result;
      };
    }
  });
})();
