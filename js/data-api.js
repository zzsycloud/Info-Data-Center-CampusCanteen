/*
 * data-api.js —— 数据访问层
 * 职责：统一负责 JSON 的加载、超时、重试、校验、缓存与降级，业务代码不直接写 fetch。
 *
 * 三种加载结果（mode）：
 *   'json'     —— fetch 成功，数据来自 data/*.json（正常路径）
 *   'embedded' —— fetch 被浏览器拦截（典型：file:// 打开页面），改用 <script> 引入的 js/data-bundle.js
 *   'failed'   —— 两条路径都失败，抛出 CCError，由页面渲染错误提示 + 重试按钮
 *
 * 调试开关：CC.api.forceFail(true) 可强制让 fetch 失败，用于演示"网络失败"错误提示。
 */
window.CC = window.CC || {};

window.CC.api = (function ($, CC) {
  'use strict';

  var CFG = CC.cfg;
  var D = CFG.data;

  /** 业务错误类型：带上用户可读信息 + 技术细节，便于界面分层展示 */
  function CCError(message, detail, cause) {
    this.name = 'CCError';
    this.message = message || '数据加载失败';
    this.detail = detail || '';
    this.cause = cause || null;
  }
  CCError.prototype = Object.create(Error.prototype);
  CCError.prototype.constructor = CCError;

  var debug = { forceFail: false, failCount: 0 };

  /** 当前数据来源模式，供界面显示 + 报告截图说明 */
  var status = {
    mode: 'json',
    embeddedReason: '',
    lastLoadAt: '',
    cacheHits: 0,
    requestCount: 0,
    retries: 0,
    failures: []
  };

  var cache = {};      // 内存缓存：键为数据集名
  var inflight = {};   // 去重：同一数据集并发请求只发一次
  var attempts = {};   // 记录每个数据集的失败次数，用于重试上限判定

  // 运行环境提示：file:// 下浏览器一定会拦截 JSON 请求，提前在控制台说明，
  // 避免使用者把"这是设计好的降级流程"误判成程序出错。
  if (window.location.protocol === 'file:') {
    if (window.console && console.info) {
      console.info('[CC] 检测到以 file:// 方式打开页面。浏览器会拦截本地 JSON 请求，' +
        '控制台随后出现的 CORS / ERR_FAILED 提示属于预期现象；' +
        '程序会自动改用内置数据包 js/data-bundle.js，页面功能不受影响。' +
        '如需走标准 JSON 加载流程，请在项目根目录执行 python -m http.server 8080。');
    }
  }

  /** 带超时的 fetch —— AbortController 在旧浏览器可能缺失，做能力检测 */
  function fetchWithTimeout(url, timeout) {
    if (typeof window.fetch !== 'function') {
      return Promise.reject(new CCError('当前浏览器不支持 fetch API', '请使用 Chrome / Edge / Firefox 的较新版本，或改用 js/data-bundle.js 兜底数据。'));
    }
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    var options = { cache: 'no-store', headers: { Accept: 'application/json' } };
    if (controller) options.signal = controller.signal;

    var p = window.fetch(url, options).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) {
        throw new CCError('服务器返回状态码 ' + res.status, '请求地址：' + url + '\nHTTP 状态：' + res.status + ' ' + (res.statusText || ''));
      }
      return res.text();
    });

    if (controller) {
      var timeoutPromise = new Promise(function (_, reject) {
        timer = setTimeout(function () {
          controller.abort();
          reject(new CCError('请求超时（超过 ' + timeout + ' 毫秒）', '请求地址：' + url + '\n可能原因：本地服务器未启动、文件路径错误或磁盘响应过慢。'));
        }, timeout);
      });
      p = Promise.race([p, timeoutPromise]);
    }
    return p;
  }

  /** fetch 失败原因归类，给出可操作的排查建议 */
  function describeError(err, url) {
    var raw = (err && err.message) || String(err);
    var detail = [];
    detail.push('请求地址：' + url);
    detail.push('原始错误：' + raw);

    if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
      detail.push('判定：网络请求被拒绝。');
      detail.push('常见原因 1：直接用 file:// 双击打开页面，浏览器安全策略禁止读取本地 JSON（此时应自动启用内置数据包）。');
      detail.push('常见原因 2：本地 Web 服务器未启动或已退出。');
      detail.push('常见原因 3：杀毒软件/代理拦截了 localhost 请求。');
    } else if (/状态码 404/.test(raw)) {
      detail.push('判定：文件不存在。请确认 data 目录与 HTML 同级，且文件名拼写正确。');
    } else if (/超时/.test(raw)) {
      detail.push('判定：请求超时。请检查本地服务器是否响应缓慢，或适当调大 CC_CONFIG.data.timeout。');
    } else if (/JSON|Unexpected token/i.test(raw)) {
      detail.push('判定：返回内容不是合法 JSON。请用编辑器校验 data/*.json 是否有多余逗号或缺失引号。');
    }
    return detail.join('\n');
  }

  /** 从 js/data-bundle.js 提供的全局对象里取数据 */
  function fromEmbedded(name) {
    var all = window[D.embeddedGlobal];
    if (!all || typeof all !== 'object' || !(name in all)) {
      throw new CCError(
        '内置数据包中没有找到数据集「' + name + '」',
        '请确认页面已通过 <script src="js/data-bundle.js"></script> 引入了兜底数据，\n并且 data/*.json 与 js/data-bundle.js 的内容保持一致。'
      );
    }
    return all[name];
  }

  /** 结构校验：保证后续渲染不会因为缺字段而崩溃 */
  function validate(name, data) {
    if (data === null || typeof data !== 'object') {
      throw new CCError('数据集「' + name + '」内容不是对象', '实际类型：' + typeof data);
    }
    if (!data.meta) {
      throw new CCError('数据集「' + name + '」缺少 meta 元信息', '每个数据文件都应包含 meta 字段用于记录版本与口径。');
    }
    if (['canteens', 'dishes', 'notices'].indexOf(name) > -1) {
      if (!Array.isArray(data.list)) {
        throw new CCError('数据集「' + name + '」缺少 list 数组', '字段 list 必须为数组。');
      }
      if (data.list.length === 0) {
        // 空数据不算致命错误，交给页面渲染"暂无数据"空状态
        CC.ui.toast('数据集「' + name + '」内容为空，页面将显示空状态提示。', 'warning', 4200);
      }
    }
    if (name === 'stats') {
      if (!data.traffic || !data.trends || !data.nutrition) {
        throw new CCError('统计数据缺少必要分区', 'stats.json 需要包含 traffic / trends / nutrition 三个分区。');
      }
    }
    return data;
  }

  /**
   * 核心加载函数
   * @param {string} name 数据集名（canteens|dishes|stats|notices）
   * @param {{force?:boolean}} opts force=true 时忽略缓存
   * @returns {Promise<object>}
   */
  function load(name, opts) {
    var o = opts || {};
    if (!o.force && cache[name]) {
      status.cacheHits += 1;
      return Promise.resolve(cache[name]);
    }
    if (inflight[name]) return inflight[name];

    var file = D.manifest[name];
    if (!file) {
      return Promise.reject(new CCError('未配置数据集「' + name + '」', '请在 js/config.js 的 data.manifest 中登记文件名。'));
    }
    var url = D.basePath + file;

    var maxAttempts = Math.max(1, Number(D.retry) || 0) + 1;
    var attempt = 0;

    function tryFetch() {
      attempt += 1;
      status.requestCount += 1;

      if (debug.forceFail) {
        debug.failCount += 1;
        var forcedErr = new CCError('调试模式：fetch 被强制置为失败', '该错误由 js/data-api.js 的 CC.api.forceFail(true) 触发，用于演示网络失败时的错误提示与重试流程。');
        return Promise.reject(forcedErr);
      }

      return fetchWithTimeout(url, D.timeout)
        .then(function (text) {
          var parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            throw new CCError('JSON 解析失败：' + e.message, describeError(e, url));
          }
          return validate(name, parsed);
        })
        .catch(function (err) {
          if (attempt < maxAttempts) {
            status.retries += 1;
            CC.ui.toast('第 ' + attempt + ' 次加载「' + name + '」失败，正在自动重试…', 'warning', 2200);
            return new Promise(function (resolve) { setTimeout(resolve, 300 * attempt); }).then(tryFetch);
          }
          throw err;
        });
    }

    var job = tryFetch()
      .then(function (data) {
        cache[name] = data;
        status.mode = 'json';
        status.lastLoadAt = new Date().toLocaleString('zh-CN');
        delete inflight[name];
        attempts[name] = 0;
        return data;
      })
      .catch(function (err) {
        delete inflight[name];
        attempts[name] = (attempts[name] || 0) + 1;
        var detail = describeError(err, url);

        // 降级路径：使用 js/data-bundle.js 的内置数据
        var embedded = null;
        try {
          embedded = fromEmbedded(name);
        } catch (embeddedErr) {
          var fatal = new CCError(
            '数据集「' + name + '」加载失败，且没有可用的内置数据',
            detail + '\n\n兜底数据也不可用：' + embeddedErr.message
          );
          status.mode = 'failed';
          status.failures.push({ name: name, at: status.lastLoadAt = new Date().toLocaleString('zh-CN'), message: fatal.message });
          throw fatal;
        }

        var data2 = validate(name, embedded);
        cache[name] = data2;
        status.mode = 'embedded';
        status.embeddedReason = 'fetch 本地 JSON 失败，已自动改用内置数据包 js/data-bundle.js（原因：' + ((err && err.message) || '未知') + '）';
        status.lastLoadAt = new Date().toLocaleString('zh-CN');
        $(document).trigger('cc:data-mode', [status.mode, status.embeddedReason]);
        return data2;
      });

    inflight[name] = job;
    return job;
  }

  /* =======================================================================
   * 便捷访问器
   * ===================================================================== */
  var api = {
    CCError: CCError,
    status: status,

    /** 一次性并行加载多个数据集，任何一个失败都会得到带来源标记的结果 */
    loadAll: function (names) {
      var tasks = (names || ['canteens', 'dishes', 'stats', 'notices']).map(function (n) {
        return load(n).then(function (d) { return { name: n, ok: true, data: d }; },
          function (e) { return { name: n, ok: false, error: e }; });
      });
      return Promise.all(tasks);
    },

    load: load,

    canteens: function (opts) { return load('canteens', opts).then(function (d) { return d.list || []; }); },
    dishes: function (opts) { return load('dishes', opts).then(function (d) { return d.list || []; }); },
    stats: function (opts) { return load('stats', opts); },
    notices: function (opts) { return load('notices', opts).then(function (d) { return d.list || []; }); },

    /** 清空缓存（“重新加载数据”按钮） */
    clearCache: function () {
      cache = {};
      inflight = {};
      return true;
    },

    /** 调试：强制失败开关 */
    forceFail: function (on) {
      debug.forceFail = !!on;
      return debug.forceFail;
    },
    isForceFail: function () { return debug.forceFail; },

    /** 统一渲染错误区：target 容器 + 错误对象 + 重试回调 */
    renderError: function (target, name, err, onRetry) {
      var detail = (err && err.detail) || (err && err.message) || '未知错误';
      var $t = target instanceof $ ? target : $(target);
      var steps = (CC.cfg.runHelp || []).map(function (s) {
        return '<li>' + CC.utils.esc(s) + '</li>';
      }).join('');
      CC.ui.alertBox($t, {
        type: 'danger',
        title: '数据加载失败：' + name,
        message: (err && err.message) || '请求数据时发生错误。',
        detail: detail,
        actions: '<button type="button" class="btn btn-sm btn-danger" data-cc-retry="1">' +
                 '<i class="bi bi-arrow-clockwise"></i> 重新加载</button>' +
                 '<button type="button" class="btn btn-sm btn-outline-secondary" data-cc-help="1">' +
                 '<i class="bi bi-question-circle"></i> 查看解决办法</button>'
      });
      // 解决办法直接内联展开，避免再跳到其他页面（运行说明页已移除）
      $t.off('click.ccHelp').on('click.ccHelp', '[data-cc-help]', function () {
        var $box = $t.find('.cc-inline-help');
        if ($box.length) { $box.slideToggle(160); return; }
        $('<div class="cc-inline-help">' +
          '<p class="mb-1"><b>按下面三种方式之一运行，即可正常读取数据：</b></p>' +
          '<ol class="mb-2 ps-3">' + steps + '</ol>' +
          '<p class="mb-0">更多排查方向：确认 <span class="cc-mono">data/</span> 目录与 HTML 同级；' +
          '确认 <span class="cc-mono">vendor/</span> 下的库文件完整；' +
          '按 F12 打开控制台查看具体的报错信息。</p>' +
          '</div>').appendTo($t.find('.cc-alert__body'));
      });
      $t.off('click.ccRetry').on('click.ccRetry', '[data-cc-retry]', function () {
        CC.api.clearCache();
        if (typeof onRetry === 'function') onRetry();
      });
      return $t;
    },

    /** 在页头显示数据来源徽标：JSON / 内置数据包 / 失败 */
    renderModeBadge: function (selector) {
      var $b = $(selector || '#cc-data-mode');
      if (!$b.length) return;
      var mode = status.mode;
      var map = {
        json: { cls: 'success', icon: 'cloud-check', text: '数据来源：本地 JSON 文件' },
        embedded: { cls: 'warning', icon: 'archive', text: '数据来源：内置数据包（file:// 兜底）' },
        failed: { cls: 'danger', icon: 'x-octagon', text: '数据来源：加载失败' }
      };
      var it = map[mode] || map.json;
      $b.attr('class', 'cc-badge cc-badge--' + it.cls)
        .attr('title', status.embeddedReason || ('最近加载：' + (status.lastLoadAt || '尚未加载')))
        .html('<i class="bi bi-' + it.icon + '"></i> ' + CC.utils.esc(it.text));
    },

    /** 判断数据集清单里哪些失败，返回失败的名称数组（供页面顶部汇总提示） */
    firstFailure: function (results) {
      for (var i = 0; i < (results || []).length; i++) {
        if (!results[i].ok) return results[i];
      }
      return null;
    }
  };

  return api;
})(jQuery, window.CC);
