window.CC = (function ($) {
  'use strict';

  var CFG = window.CC_CONFIG;

  /* =======================================================================
   * 1. 基础工具
   * ===================================================================== */
  var utils = {
    /** HTML 转义，所有来自 JSON 的文本在拼接前必须经过这里，防止 XSS */
    esc: function (value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /** 金额：保留一位小数，带“元” */
    money: function (n) {
      var v = Number(n);
      if (!isFinite(v)) return '—';
      return v.toFixed(1) + ' 元';
    },

    /** 千分位整数 */
    int: function (n) {
      var v = Number(n);
      if (!isFinite(v)) return '—';
      return v.toLocaleString('zh-CN');
    },

    /** 评分：一位小数 */
    score: function (n) {
      var v = Number(n);
      return isFinite(v) ? v.toFixed(1) : '—';
    },

    percent: function (part, total) {
      if (!total) return '0%';
      return ((part / total) * 100).toFixed(1) + '%';
    },

    /** 日期 "2025-01-06" → "01-06"，非法输入返回原串 */
    shortDate: function (s) {
      if (typeof s !== 'string') return '';
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? m[2] + '-' + m[3] : s;
    },

    /** 相对时间：今天 / 昨天 / N 天前 */
    relativeDate: function (s) {
      var d = new Date(String(s) + 'T00:00:00');
      if (isNaN(d.getTime())) return s;
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var days = Math.round((today - d) / 86400000);
      if (days === 0) return '今天';
      if (days === 1) return '昨天';
      if (days > 1 && days < 30) return days + ' 天前';
      return s;
    },

    /** 秒 → "8.2 秒" */
    seconds: function (n) {
      var v = Number(n);
      return isFinite(v) ? v.toFixed(1) + ' 秒' : '—';
    },

    /** 数组求和 / 平均 / 最大 */
    sum: function (arr) {
      return (arr || []).reduce(function (a, b) { return a + Number(b || 0); }, 0);
    },
    avg: function (arr) {
      if (!arr || !arr.length) return 0;
      return utils.sum(arr) / arr.length;
    },
    max: function (arr) {
      return (arr || []).reduce(function (a, b) { return Math.max(a, Number(b || 0)); }, -Infinity);
    },
    round: function (n, digits) {
      var d = Math.pow(10, digits || 0);
      return Math.round(Number(n) * d) / d;
    },

    /** 稳定排序：按字段升/降序，不改动原数组 */
    sortBy: function (arr, field, desc) {
      var copy = (arr || []).slice();
      copy.sort(function (a, b) {
        var x = a[field];
        var y = b[field];
        if (typeof x === 'string' || typeof y === 'string') {
          return desc ? String(y).localeCompare(String(x), 'zh-CN') : String(x).localeCompare(String(y), 'zh-CN');
        }
        return desc ? Number(y) - Number(x) : Number(x) - Number(y);
      });
      return copy;
    },

    groupBy: function (arr, key) {
      return (arr || []).reduce(function (acc, item) {
        var k = typeof key === 'function' ? key(item) : item[key];
        (acc[k] = acc[k] || []).push(item);
        return acc;
      }, {});
    },

    /** 防抖：搜索输入、窗口 resize 用 */
    debounce: function (fn, wait) {
      var timer = null;
      return function () {
        var ctx = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 250);
      };
    },

    /** 稀疏数组（有洞）检测，用于数据校验 */
    hasHole: function (arr) {
      if (!Array.isArray(arr)) return true;
      for (var i = 0; i < arr.length; i++) {
        if (!(i in arr) || typeof arr[i] !== 'number' || !isFinite(arr[i])) return true;
      }
      return false;
    },

    clamp: function (v, min, max) {
      return Math.min(max, Math.max(min, v));
    },

    /** 唯一 id */
    uid: function (prefix) {
      return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },

    /** 获取 URL 查询参数 */
    query: function (name) {
      var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
    },

    /** 当前页面文件名，用于导航高亮 */
    pageName: function () {
      var p = window.location.pathname.split('/').pop();
      return p && p.length ? p : 'index.html';
    }
  };

  /* =======================================================================
   * 2. 安全本地存储（localStorage 在隐私模式/配额满时会抛异常，必须兜住）
   * ===================================================================== */
  var store = {
    available: (function () {
      try {
        var k = '__cc_test__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    })(),
    _mem: {},

    _key: function (name) {
      return CFG.storage.prefix + name;
    },

    get: function (name, fallback) {
      var key = this._key(name);
      try {
        if (this.available) {
          var raw = window.localStorage.getItem(key);
          return raw === null ? fallback : JSON.parse(raw);
        }
        return key in this._mem ? this._mem[key] : fallback;
      } catch (e) {
        return fallback;
      }
    },

    set: function (name, value) {
      var key = this._key(name);
      try {
        if (this.available) {
          window.localStorage.setItem(key, JSON.stringify(value));
          return true;
        }
        this._mem[key] = value;
        return false;
      } catch (e) {
        // 配额超限：退化为内存存储并提示用户
        this._mem[key] = value;
        toast('本地存储写入失败（可能是隐私模式或空间已满），本次修改仅在当前页面有效。', 'warning');
        return false;
      }
    },

    remove: function (name) {
      var key = this._key(name);
      try {
        if (this.available) window.localStorage.removeItem(key);
      } catch (e) { /* 忽略 */ }
      delete this._mem[key];
    },

    keys: function () {
      return CFG.storage.keys;
    }
  };

  /* =======================================================================
   * 3. 统一提示组件：toast(消息, 类型) / alertBox(容器, 类型, 标题, 正文)
   * ===================================================================== */
  var toastSeq = 0;

  function ensureToastHost() {
    var $host = $('#cc-toast-host');
    if (!$host.length) {
      $host = $('<div id="cc-toast-host" class="cc-toast-host" role="status" aria-live="polite" aria-atomic="true"></div>');
      $('body').append($host);
    }
    return $host;
  }

  /**
   * 顶部提示条
   * @param {string} message 文本（会自动转义）
   * @param {string} type success | info | warning | danger
   * @param {number} delay 毫秒，默认 3200
   */
  function toast(message, type, delay) {
    var kind = type || 'info';
    var icons = { success: 'check-circle', info: 'info-circle', warning: 'exclamation-triangle', danger: 'x-octagon' };
    var $host = ensureToastHost();
    var id = 'cc-toast-' + (++toastSeq);
    var $el = $(
      '<div class="cc-toast cc-toast--' + utils.esc(kind) + '" id="' + id + '" role="alert">' +
        '<i class="bi bi-' + (icons[kind] || 'info-circle') + '" aria-hidden="true"></i>' +
        '<span class="cc-toast__text">' + utils.esc(message) + '</span>' +
        '<button type="button" class="cc-toast__close" aria-label="关闭提示">&times;</button>' +
      '</div>'
    );
    $host.append($el);
    // 触发进场动画
    window.setTimeout(function () { $el.addClass('is-show'); }, 10);

    function close() {
      $el.removeClass('is-show');
      window.setTimeout(function () { $el.remove(); }, 260);
    }
    $el.find('.cc-toast__close').on('click', close);
    window.setTimeout(close, delay || 3200);
    return $el;
  }

  /**
   * 页面内联提示块（用于错误提示区，可带重试按钮）
   * @param {jQuery|string} target 容器
   * @param {{type,title,message,detail,actions}} opts
   */
  function alertBox(target, opts) {
    var o = opts || {};
    var type = o.type || 'info';
    var iconMap = { info: 'info-circle', success: 'check-circle', warning: 'exclamation-triangle', danger: 'x-octagon' };
    var html =
      '<div class="cc-alert cc-alert--' + utils.esc(type) + '" role="alert">' +
        '<div class="cc-alert__icon"><i class="bi bi-' + (iconMap[type] || 'info-circle') + '"></i></div>' +
        '<div class="cc-alert__body">' +
          (o.title ? '<h4 class="cc-alert__title">' + utils.esc(o.title) + '</h4>' : '') +
          (o.message ? '<p class="cc-alert__msg">' + utils.esc(o.message) + '</p>' : '') +
          (o.detail ? '<pre class="cc-alert__detail">' + utils.esc(o.detail) + '</pre>' : '') +
          (o.actions ? '<div class="cc-alert__actions">' + o.actions + '</div>' : '') +
        '</div>' +
      '</div>';
    var $target = target instanceof $ ? target : $(target);
    $target.html(html);
    return $target;
  }

  /** 空状态占位（数据为空时使用，比空白页友好） */
  function emptyState(target, opts) {
    var o = opts || {};
    var $target = target instanceof $ ? target : $(target);
    $target.html(
      '<div class="cc-empty">' +
        '<i class="bi bi-' + utils.esc(o.icon || 'inbox') + '" aria-hidden="true"></i>' +
        '<p class="cc-empty__title">' + utils.esc(o.title || '暂无数据') + '</p>' +
        (o.message ? '<p class="cc-empty__msg">' + utils.esc(o.message) + '</p>' : '') +
        (o.actions ? '<div class="cc-empty__actions">' + o.actions + '</div>' : '') +
      '</div>'
    );
    return $target;
  }

  /** 骨架屏（加载中） */
  function skeleton(target, rows) {
    var n = rows || 3;
    var html = '<div class="cc-skeleton" aria-busy="true" aria-live="polite">';
    for (var i = 0; i < n; i++) {
      html += '<div class="cc-skeleton__row"><span class="cc-skeleton__bar"></span><span class="cc-skeleton__bar cc-skeleton__bar--short"></span></div>';
    }
    html += '<span class="visually-hidden">数据加载中</span></div>';
    var $target = target instanceof $ ? target : $(target);
    $target.html(html);
    return $target;
  }

  /** 星级显示（4.3 → ★★★★☆ 4.3） */
  function stars(score) {
    var s = Number(score) || 0;
    var full = Math.floor(s);
    var half = s - full >= 0.5;
    var html = '<span class="cc-stars" aria-label="评分 ' + utils.score(s) + ' 分">';
    for (var i = 1; i <= 5; i++) {
      if (i <= full) html += '<i class="bi bi-star-fill"></i>';
      else if (i === full + 1 && half) html += '<i class="bi bi-star-half"></i>';
      else html += '<i class="bi bi-star"></i>';
    }
    html += '<span class="cc-stars__num">' + utils.score(s) + '</span></span>';
    return html;
  }

  /* =======================================================================
   * 4. 派生数据：所有统计口径集中在这里，图表只消费这里的输出
   * ===================================================================== */
  var derive = {
    /** 菜品类目数量分布 → [{name, value}] 降序 */
    computeCategoryShare: function (dishes) {
      var g = utils.groupBy(dishes, 'category');
      return Object.keys(g)
        .map(function (k) { return { name: k, value: g[k].length }; })
        .sort(function (a, b) { return b.value - a.value; });
    },

    /** 价格区间分布 → {labels:[], counts:[]} */
    computePriceBins: function (dishes, binSize) {
      var step = binSize || 5;
      var maxPrice = 0;
      (dishes || []).forEach(function (d) { maxPrice = Math.max(maxPrice, Number(d.price) || 0); });
      var binCount = Math.max(1, Math.ceil((maxPrice + 0.001) / step));
      var labels = [];
      var counts = [];
      for (var i = 0; i < binCount; i++) {
        labels.push(i * step + '-' + (i + 1) * step + ' 元');
        counts.push(0);
      }
      labels[binCount - 1] = (binCount - 1) * step + ' 元以上';
      (dishes || []).forEach(function (d) {
        var idx = utils.clamp(Math.floor((Number(d.price) || 0) / step), 0, binCount - 1);
        counts[idx] += 1;
      });
      return { labels: labels, counts: counts };
    },

    /** 各类别价格统计 → [{category, avg, min, max, count}] */
    computePriceStats: function (dishes) {
      var g = utils.groupBy(dishes, 'category');
      return Object.keys(g).map(function (k) {
        var prices = g[k].map(function (d) { return Number(d.price) || 0; });
        return {
          category: k,
          avg: utils.round(utils.avg(prices), 1),
          min: Math.min.apply(null, prices),
          max: Math.max.apply(null, prices),
          count: prices.length
        };
      }).sort(function (a, b) { return b.avg - a.avg; });
    },

    /** 各食堂“已收录菜品”均价 → [{key, name, value, count}] */
    computeCanteenAvgPrice: function (dishes, canteens) {
      var g = utils.groupBy(dishes, 'canteenId');
      return (canteens || []).map(function (c) {
        var list = g[c.id] || [];
        var prices = list.map(function (d) { return Number(d.price) || 0; });
        return {
          key: c.id,
          name: c.name,
          value: prices.length ? utils.round(utils.avg(prices), 2) : 0,
          count: prices.length,
          official: c.avgPrice
        };
      });
    },

    /** 单份营养 5 维（用于雷达图，按膳食指南上限归一化到 100 分制） */
    computeNutritionRadar: function (item) {
      var ref = { calories: 900, protein: 45, fat: 35, carbs: 140, sodium: 1200 };
      function ratio(v, max) { return utils.round(utils.clamp((Number(v) || 0) / max, 0, 1.4) * 100, 1); }
      return {
        name: item.name,
        indicators: [
          { name: '热量(kcal)', max: 100 },
          { name: '蛋白质(g)', max: 100 },
          { name: '脂肪(g)', max: 100 },
          { name: '碳水(g)', max: 100 },
          { name: '钠(mg)', max: 100 }
        ],
        values: [ratio(item.calories, ref.calories), ratio(item.protein, ref.protein), ratio(item.fat, ref.fat), ratio(item.carbs, ref.carbs), ratio(item.sodium, ref.sodium)]
      };
    },

    /** 拥挤度分档 */
    crowdLevel: function (count) {
      var levels = CFG.business.crowdLevels;
      for (var i = 0; i < levels.length; i++) {
        if (count <= levels[i].max) return levels[i];
      }
      return levels[levels.length - 1];
    },

    /** 综合推荐指数：评分 60% + 销量 25% + 性价比 15% */
    recommendIndex: function (dish, maxSales, minPrice, maxPrice) {
      var salesScore = maxSales ? (Number(dish.monthlySales) || 0) / maxSales : 0;
      var priceScore = maxPrice > minPrice ? 1 - ((Number(dish.price) - minPrice) / (maxPrice - minPrice)) : 1;
      var ratingScore = utils.clamp((Number(dish.rating) || 0) / 5, 0, 1);
      return utils.round((ratingScore * 0.6 + salesScore * 0.25 + priceScore * 0.15) * 100, 1);
    }
  };

  /* =======================================================================
   * 5. 全站状态：收藏、购物预算清单、访问计数
   * ===================================================================== */
  var state = {
    getFavorites: function () {
      var v = store.get(store.keys().favorites, []);
      return Array.isArray(v) ? v : [];
    },
    isFavorite: function (dishId) {
      return this.getFavorites().indexOf(dishId) > -1;
    },
    toggleFavorite: function (dishId) {
      var list = this.getFavorites();
      var idx = list.indexOf(dishId);
      if (idx > -1) {
        list.splice(idx, 1);
        store.set(store.keys().favorites, list);
        return false;
      }
      list.push(dishId);
      store.set(store.keys().favorites, list);
      return true;
    },

    getCart: function () {
      var v = store.get(store.keys().cart, []);
      return Array.isArray(v) ? v : [];
    },
    addToCart: function (dishId, qty) {
      var cart = this.getCart();
      var found = null;
      for (var i = 0; i < cart.length; i++) if (cart[i].dishId === dishId) found = cart[i];
      var n = qty || 1;
      if (found) {
        found.qty += n;
      } else {
        cart.push({ dishId: dishId, qty: n });
      }
      store.set(store.keys().cart, cart);
      return cart;
    },
    updateCartQty: function (dishId, qty) {
      var cart = this.getCart().map(function (it) {
        if (it.dishId === dishId) it.qty = qty;
        return it;
      }).filter(function (it) { return it.qty > 0; });
      store.set(store.keys().cart, cart);
      return cart;
    },
    removeFromCart: function (dishId) {
      var cart = this.getCart().filter(function (it) { return it.dishId !== dishId; });
      store.set(store.keys().cart, cart);
      return cart;
    },
    clearCart: function () {
      store.set(store.keys().cart, []);
      return [];
    },

    /** 用户自建菜品（本地新增/修改） */
    getUserDishes: function () {
      var v = store.get(store.keys().userDishes, []);
      return Array.isArray(v) ? v : [];
    },
    saveUserDishes: function (list) {
      return store.set(store.keys().userDishes, list || []);
    },
    upsertUserDish: function (dish) {
      var list = this.getUserDishes();
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === dish.id) idx = i;
      if (idx > -1) list[idx] = dish; else list.push(dish);
      this.saveUserDishes(list);
      return list;
    },
    deleteUserDish: function (id) {
      var list = this.getUserDishes().filter(function (d) { return d.id !== id; });
      this.saveUserDishes(list);
      return list;
    },

    /** 访问计数（首页“本地访问次数”卡片） */
    bumpVisit: function () {
      var n = Number(store.get(store.keys().visitLog, 0)) + 1;
      store.set(store.keys().visitLog, n);
      return n;
    }
  };

  /* =======================================================================
   * 6. 页面骨架：导航渲染、主题、返回顶部、加载遮罩
   * ===================================================================== */
  var layout = {
    navItems: [
      { href: 'index.html', label: '首页', icon: 'house-door' },
      { href: 'dishes.html', label: '菜品查询', icon: 'search' },
      { href: 'canteens.html', label: '食堂档案', icon: 'shop' },
      { href: 'analytics.html', label: '数据看板', icon: 'bar-chart-line' },
      { href: 'scene3d.html', label: '三维总览', icon: 'badge-3d' }
    ],

    renderNav: function () {
      var current = utils.pageName();
      var $nav = $('#cc-nav-links');
      if (!$nav.length) return;
      var html = this.navItems.map(function (it) {
        var active = it.href === current ? ' active' : '';
        var aria = it.href === current ? ' aria-current="page"' : '';
        return '<li class="nav-item">' +
          '<a class="nav-link' + active + '" href="' + it.href + '"' + aria + '>' +
          '<i class="bi bi-' + it.icon + '" aria-hidden="true"></i><span>' + it.label + '</span>' +
          '</a></li>';
      }).join('');
      $nav.html(html);
    },

    initTheme: function () {
      var saved = store.get(store.keys().theme, 'light');
      $('html').attr('data-theme', saved);
      $('#cc-theme-toggle').on('click', function () {
        var next = $('html').attr('data-theme') === 'dark' ? 'light' : 'dark';
        $('html').attr('data-theme', next);
        store.set(store.keys().theme, next);
        $(this).attr('aria-label', next === 'dark' ? '切换到浅色主题' : '切换到深色主题');
        toast(next === 'dark' ? '已切换到深色主题' : '已切换到浅色主题', 'info', 1800);
        $(document).trigger('cc:theme-changed', [next]);
      });
    },

    initBackToTop: function () {
      var $btn = $(
        '<button type="button" id="cc-back-top" class="cc-back-top" aria-label="返回页面顶部">' +
        '<i class="bi bi-arrow-up" aria-hidden="true"></i></button>'
      );
      $('body').append($btn);
      $btn.on('click', function () { $('html, body').animate({ scrollTop: 0 }, 260); });
      $(window).on('scroll', utils.debounce(function () {
        $btn.toggleClass('is-show', $(window).scrollTop() > 320);
      }, 120));
    },

    renderFooter: function () {
      var $f = $('#cc-footer-meta');
      if (!$f.length) return;
      $f.html(
        '<span>' + utils.esc(CFG.appName) + ' v' + utils.esc(CFG.version) + '</span>' +
        '<span class="cc-footer__sep">·</span>' +
        '<span>数据版本 ' + utils.esc(CFG.dataVersion) + '</span>' +
        '<span class="cc-footer__sep">·</span>' +
        '<span>数据来源：本地 JSON（data/*.json）</span>' +
        '<span class="cc-footer__sep">·</span>' +
        '<span>技术栈：HTML5 + CSS3 + jQuery + Bootstrap 5 + ECharts + Chart.js + Three.js</span>'
      );
    },

    /** 统一的初始化入口，每个页面 DOMReady 时调用 */
    init: function () {
      this.renderNav();
      this.initTheme();
      this.initBackToTop();
      this.renderFooter();
      // 让当前脚本报错也能被页面上的错误条捕获
      $(document).trigger('cc:layout-ready');
    }
  };

  /* =======================================================================
   * 7. 全局异常兜底：把未捕获错误显示成提示，避免“白屏无解释”
   * ===================================================================== */
  function installGlobalErrorHandlers() {
    window.addEventListener('error', function (evt) {
      var msg = evt && evt.message ? evt.message : '未知脚本错误';
      // 资源加载失败（img/script）也会进这里，区分处理
      var target = evt.target || {};
      if (target && target.tagName && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
        toast('静态资源加载失败：' + (target.src || target.href || target.tagName), 'danger', 6000);
        $(document).trigger('cc:asset-error', [target.src || target.href]);
        return;
      }
      toast('脚本运行出错：' + msg, 'danger', 6000);
      if (window.console && console.error) console.error('[CC] 未捕获错误', evt.error || msg);
    });

    window.addEventListener('unhandledrejection', function (evt) {
      var reason = evt && evt.reason ? (evt.reason.message || evt.reason) : '未知原因';
      toast('异步操作失败：' + reason, 'danger', 6000);
    });
  }

  /* =======================================================================
   * 8. 导出
   * ===================================================================== */
  installGlobalErrorHandlers();

  return {
    cfg: CFG,
    utils: utils,
    store: store,
    state: state,
    derive: derive,
    layout: layout,
    ui: {
      toast: toast,
      alertBox: alertBox,
      emptyState: emptyState,
      skeleton: skeleton,
      stars: stars
    },
    /** 便捷：$(document).ready 包装 */
    ready: function (fn) {
      $(function () { fn($, window.CC); });
    }
  };
})(jQuery);
