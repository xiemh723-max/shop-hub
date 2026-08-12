/* app.js — StorePilot 靠谱店铺导航：GitHub JSON 实时拉取 + 搜索匹配 + 平台直达 */
(function () {
  'use strict';

  /* ===== 平台定义（品牌色仅为标识，跳转均指向平台官方搜索页） ===== */
  var enc = function (q) { return encodeURIComponent(q); };
  var PLATFORMS = [
    { key: 'alibaba', name: '阿里巴巴', icon: '阿', color: '#FF5A00',
      search: function (q) { return 'https://s.1688.com/selloffer/offer_search.htm?keywords=' + enc(q); } },
    { key: 'taobao',  name: '淘宝',     icon: '淘', color: '#FF4400',
      search: function (q) { return 'https://s.taobao.com/search?q=' + enc(q); } },
    { key: 'lcsc',    name: '立创商城', icon: '立', color: '#2F6BFF',
      search: function (q) { return 'https://so.szlcsc.com/global.html?k=' + enc(q); } },
    { key: 'ickey',   name: '云汉芯城', icon: '云', color: '#0E8A5F',
      search: function (q) { return 'https://www.ickey.com/search/result?key=' + enc(q); } }
  ];

  /* ===== 数据源（实时更新核心：改 GitHub 上的 shops.json 即生效） ===== */
  var GITHUB_URL = 'https://raw.githubusercontent.com/xiemh723-max/shop-hub/main/data/shops.json';
  var LOCAL_URL = 'data/shops.json';
  var CACHE_KEY = 'storepilot_data_v1';

  /* 内置最小示例（GitHub / 本地都拿不到时兜底，保证离线可用） */
  var BUILTIN = {
    updatedAt: '2026-08-12T00:00:00Z',
    source: '内置示例',
    entries: [
      { id: 'builtin-recorder', keywords: ['录音芯片', 'AI录音芯片', '录音笔芯片', 'recorder chip'],
        stores: [
          { platform: 'lcsc', name: '立创商城自营 · 智能录音方案专区', tag: '自营 · 现货', url: 'https://so.szlcsc.com/global.html?k=录音芯片', demo: true },
          { platform: 'ickey', name: '云汉芯城 · 语音处理芯片专柜', tag: '授权分销', url: 'https://www.ickey.com/search/result?key=录音芯片', demo: true }
        ] }
    ]
  };

  var state = { data: null, q: '' };

  /* ===== 工具 ===== */
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function getCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function setCache(d) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }

  /* ===== 数据加载：GitHub 优先 → 本地 → 缓存 → 内置 ===== */
  function loadData() {
    var status = $('status');
    status.hidden = false;
    status.className = 'status';
    status.textContent = '正在拉取最新店铺数据…';

    return fetch(GITHUB_URL + '?t=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('github ' + r.status); return r.json(); })
      .then(function (d) {
        d.source = 'GitHub 实时数据';
        setCache(d);
        status.textContent = '✓ 已同步 GitHub 最新数据';
        status.className = 'status ok';
        return d;
      })
      .catch(function () {
        return fetch(LOCAL_URL + '?t=' + Date.now())
          .then(function (r) { if (!r.ok) throw new Error('local ' + r.status); return r.json(); })
          .then(function (d) { d.source = '本地数据'; setCache(d); status.textContent = '✓ 数据来自本地文件'; status.className = 'status ok'; return d; })
          .catch(function () {
            var c = getCache();
            if (c) { c.source = '缓存数据（离线）'; status.textContent = '✓ 离线缓存数据'; status.className = 'status ok'; return c; }
            status.textContent = '数据源不可用，展示内置示例';
            status.className = 'status err';
            return BUILTIN;
          });
      });
  }

  /* ===== 关键词匹配 ===== */
  function findEntry(q, entries) {
    var nq = q.trim().toLowerCase();
    if (!nq) return null;
    for (var i = 0; i < entries.length; i++) {
      var ks = entries[i].keywords || [];
      for (var j = 0; j < ks.length; j++) {
        var k = String(ks[j]).toLowerCase();
        if (k.indexOf(nq) !== -1 || nq.indexOf(k) !== -1) return entries[i];
      }
    }
    return null;
  }

  /* ===== 渲染 ===== */
  function platformOf(key) {
    for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].key === key) return PLATFORMS[i];
    return null;
  }

  function directBtn(p, q) {
    var el = document.createElement('a');
    el.className = 'direct-btn';
    el.href = p.search(q);
    el.target = '_blank';
    el.rel = 'noopener';
    el.innerHTML = '<span class="pi" style="background:' + p.color + '">' + p.icon + '</span><span>' + escapeHtml(p.name) + ' 搜「' + escapeHtml(q) + '」</span><span style="margin-left:auto">→</span>';
    return el;
  }

  function storeCard(s, p) {
    var a = document.createElement('a');
    a.className = 'store-card';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML =
      '<span class="sn">' + escapeHtml(s.name) + (s.demo ? '<span class="demo">示例</span>' : '') + '</span>' +
      '<span class="st">' + escapeHtml(s.tag || '靠谱店铺') + '</span>' +
      '<span class="go">直达店铺 →</span>';
    return a;
  }

  function renderPlatformColumn(p, stores, q) {
    var col = document.createElement('div');
    col.className = 'pl-col';
    var head = document.createElement('div');
    head.className = 'pl-col-head';
    head.innerHTML = '<span class="pt"><span class="pi" style="background:' + p.color + '">' + p.icon + '</span>' + escapeHtml(p.name) + '</span>' +
      '<a class="pl-search" href="' + p.search(q) + '" target="_blank" rel="noopener">平台搜索 →</a>';
    col.appendChild(head);

    var body = document.createElement('div');
    body.className = 'pl-col-body';
    if (stores && stores.length) {
      stores.forEach(function (s) { body.appendChild(storeCard(s, p)); });
    } else {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = '该平台暂无预置店铺<br><span style="font-size:12px">点右上角直达平台搜索</span>';
      body.appendChild(empty);
    }
    col.appendChild(body);
    return col;
  }

  function renderResults(q) {
    state.q = q;
    var entry = findEntry(q, state.data.entries);
    var results = $('results');
    results.className = 'show';
    $('qLabel').textContent = q;

    var src = state.data.source || '';
    var up = state.data.updatedAt || '';
    $('dataMeta').textContent = src + (up ? ' · 更新于 ' + up.slice(0, 10) : '');
    $('footerMeta').textContent = up ? '数据更新：' + up.slice(0, 10) : '';

    var grid = $('storeGrid');
    var direct = $('directBox');
    grid.innerHTML = '';
    direct.hidden = true;

    if (entry) {
      direct.hidden = true;
      PLATFORMS.forEach(function (p) {
        var stores = (entry.stores || []).filter(function (s) { return s.platform === p.key; });
        grid.appendChild(renderPlatformColumn(p, stores, q));
      });
    } else {
      direct.hidden = false;
      var dg = $('directGrid');
      dg.innerHTML = '';
      PLATFORMS.forEach(function (p) { dg.appendChild(directBtn(p, q)); });
      // 空状态下仍铺 4 列空位，保持版式
      PLATFORMS.forEach(function (p) { grid.appendChild(renderPlatformColumn(p, [], q)); });
    }

    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function doSearch(raw) {
    var q = (raw || '').trim();
    if (!q) { $('q').focus(); return; }
    $('q').value = q;
    renderResults(q);
  }

  /* ===== 事件 ===== */
  function init() {
    loadData().then(function (d) {
      state.data = d;
      if (state.q) renderResults(state.q);
    });

    $('searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      doSearch($('q').value);
    });

    $('refreshBtn').addEventListener('click', function () {
      loadData().then(function (d) {
        state.data = d;
        if (state.q) renderResults(state.q);
      });
    });

    $('quickTags').addEventListener('click', function (e) {
      var t = e.target.closest('.tag');
      if (t) { $('q').value = t.textContent.trim(); doSearch(t.textContent.trim()); }
    });

    // 支持从 URL 参数带关键词：?q=录音芯片
    var urlQ = new URLSearchParams(location.search).get('q');
    if (urlQ) doSearch(urlQ);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
