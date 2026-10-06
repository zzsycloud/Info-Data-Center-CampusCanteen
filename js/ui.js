/*
 * ui.js —— 公共界面片段与通用交互（导航、页脚、购物预算清单、收藏、调试面板）
 * 所有页面在 DOMReady 时调用 CC.uiKit.mount()，避免每个 HTML 重复写一大段导航代码。
 */
window.CC = window.CC || {};

window.CC.uiKit = (function ($, CC) {
  'use strict';

  var U = CC.utils;

  /* =======================================================================
   * 1. 顶部导航（含跳转到各功能页、主题切换、收藏/清单计数、移动端折叠）
   * ===================================================================== */
  function navMarkup() {
    return '' +
      '<nav class="navbar navbar-expand-lg fixed-top cc-navbar" aria-label="主导航">' +
      '  <div class="container">' +
      '    <a class="navbar-brand" href="index.html">' +
      '      <i class="bi bi-shop-window" aria-hidden="true"></i>' +
      '      <span>校园食堂信息中心</span>' +
      '    </a>' +
      '    <div class="d-flex align-items-center order-lg-3 cc-nav-tools">' +
      '      <a class="cc-icon-btn" href="dishes.html?favorite=1" title="我的收藏" aria-label="我的收藏">' +
      '        <i class="bi bi-star" aria-hidden="true"></i>' +
      '        <span class="cc-icon-btn__count d-none" id="cc-fav-count">0</span>' +
      '      </a>' +
      '      <button type="button" class="cc-icon-btn" id="cc-cart-toggle" title="预算清单" aria-label="预算清单">' +
      '        <i class="bi bi-basket" aria-hidden="true"></i>' +
      '        <span class="cc-icon-btn__count d-none" id="cc-cart-count">0</span>' +
      '      </button>' +
      '      <button type="button" class="cc-icon-btn" id="cc-theme-toggle" title="切换深色/浅色主题" aria-label="切换深色主题">' +
      '        <i class="bi bi-moon-stars" aria-hidden="true"></i>' +
      '      </button>' +
      '      <button class="navbar-toggler ms-1" type="button" data-bs-toggle="collapse" data-bs-target="#cc-navbar" aria-controls="cc-navbar" aria-expanded="false" aria-label="展开导航菜单">' +
      '        <span class="navbar-toggler-icon"></span>' +
      '      </button>' +
      '    </div>' +
      '    <div class="collapse navbar-collapse order-lg-2" id="cc-navbar">' +
      '      <ul class="navbar-nav mx-lg-auto" id="cc-nav-links"></ul>' +
      '    </div>' +
      '  </div>' +
      '</nav>';
  }

  /* =======================================================================
   * 2. 页脚
   * ===================================================================== */
  function footerMarkup() {
    return '' +
      '<footer class="cc-footer">' +
      '  <div class="container">' +
      '    <div id="cc-footer-meta" class="mb-2"></div>' +
      '    <p class="mb-0">本页面为《软件开发综合实践》期末大作业作品，数据为本地 JSON 示例数据，仅用于教学演示。</p>' +
      '  </div>' +
      '</footer>';
  }

  /* =======================================================================
   * 3. 预算清单抽屉（跨页面共享，数据来自 localStorage）
   * ===================================================================== */
  function cartModalMarkup() {
    return '' +
      '<div class="modal fade" id="cc-cart-modal" tabindex="-1" aria-labelledby="cc-cart-title" aria-hidden="true">' +
      '  <div class="modal-dialog modal-dialog-scrollable modal-lg">' +
      '    <div class="modal-content">' +
      '      <div class="modal-header">' +
      '        <h5 class="modal-title" id="cc-cart-title"><i class="bi bi-basket"></i> 我的预算清单</h5>' +
      '        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭"></button>' +
      '      </div>' +
      '      <div class="modal-body">' +
      '        <div class="row g-2 align-items-end mb-3">' +
      '          <div class="col-7 col-sm-5">' +
      '            <label class="form-label mb-1" for="cc-cart-budget">今日预算（元）</label>' +
      '            <input type="number" class="form-control form-control-sm" id="cc-cart-budget" min="1" max="500" step="1" value="30">' +
      '          </div>' +
      '          <div class="col-5 col-sm-4">' +
      '            <button type="button" class="btn btn-sm btn-primary w-100" id="cc-cart-check">' +
      '              <i class="bi bi-calculator"></i> 校验预算</button>' +
      '          </div>' +
      '        </div>' +
      '        <div id="cc-cart-body"></div>' +
      '      </div>' +
      '      <div class="modal-footer justify-content-between">' +
      '        <button type="button" class="btn btn-sm btn-outline-danger" id="cc-cart-clear">' +
      '          <i class="bi bi-trash3"></i> 清空清单</button>' +
      '        <div>' +
      '          <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">继续挑选</button>' +
      '          <button type="button" class="btn btn-sm btn-success" id="cc-cart-export">' +
      '            <i class="bi bi-download"></i> 导出清单</button>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  var cartCache = {};

  function setCartSource(dishes) {
    (dishes || []).forEach(function (d) { cartCache[d.id] = d; });
  }

  function refreshCounters() {
    var favs = CC.state.getFavorites().length;
    var cart = CC.state.getCart();
    var cartCount = cart.reduce(function (a, b) { return a + Number(b.qty || 0); }, 0);
    $('#cc-fav-count').toggleClass('d-none', favs === 0).text(favs);
    $('#cc-cart-count').toggleClass('d-none', cartCount === 0).text(cartCount);
    $(document).trigger('cc:counters', [{ favorites: favs, cart: cartCount }]);
  }

  function renderCart() {
    var cart = CC.state.getCart();
    var $body = $('#cc-cart-body');
    if (!$body.length) return;

    if (!cart.length) {
      CC.ui.emptyState($body, {
        icon: 'basket',
        title: '清单还是空的',
        message: '在“菜品查询”页点击「加入清单」按钮，可把菜品加入预算清单，用于估算一餐花费。',
        actions: '<a class="btn btn-sm btn-primary" href="dishes.html">去挑选菜品</a>'
      });
      return;
    }

    var total = 0;
    var kcal = 0;
    var rows = cart.map(function (it) {
      var d = cartCache[it.dishId];
      if (!d) {
        return '<tr><td colspan="5" class="text-muted">菜品 ' + U.esc(it.dishId) + ' 不在当前数据集中（可能已在菜品维护中被删除）' +
          '<button class="btn btn-sm btn-link text-danger p-0 ms-2" data-cart-remove="' + U.esc(it.dishId) + '">移除</button></td></tr>';
      }
      var sub = d.price * it.qty;
      total += sub;
      kcal += d.calories * it.qty;
      return '<tr>' +
        '<td>' + U.esc(d.name) + '<div class="cc-hint">' + U.esc(d.__canteenName || d.canteenId) + ' · ' + U.esc(d.stall) + '</div></td>' +
        '<td class="cc-num">' + U.money(d.price) + '</td>' +
        '<td style="width:96px">' +
        '  <div class="input-group input-group-sm">' +
        '    <button class="btn btn-outline-secondary" type="button" data-cart-dec="' + U.esc(it.dishId) + '" aria-label="减少一份">−</button>' +
        '    <input type="text" class="form-control text-center" value="' + it.qty + '" readonly aria-label="份数">' +
        '    <button class="btn btn-outline-secondary" type="button" data-cart-inc="' + U.esc(it.dishId) + '" aria-label="增加一份">+</button>' +
        '  </div>' +
        '</td>' +
        '<td class="cc-num">' + U.money(sub) + '</td>' +
        '<td class="cc-num"><button class="btn btn-sm btn-link text-danger p-0" data-cart-remove="' + U.esc(it.dishId) + '">删除</button></td>' +
        '</tr>';
    }).join('');

    var budget = Number($('#cc-cart-budget').val()) || 0;
    var over = budget > 0 && total > budget;
    var summaryClass = over ? 'cc-alert--warning' : 'cc-alert--success';

    $body.html(
      '<div class="table-responsive cc-table-wrap mb-3">' +
      '  <table class="cc-table table table-sm mb-0"><thead><tr>' +
      '    <th scope="col">菜品</th><th scope="col" class="cc-num">单价</th><th scope="col">份数</th>' +
      '    <th scope="col" class="cc-num">小计</th><th scope="col"></th></tr></thead>' +
      '  <tbody>' + rows + '</tbody></table>' +
      '</div>' +
      '<div class="cc-alert ' + summaryClass + '">' +
      '  <div class="cc-alert__icon"><i class="bi bi-' + (over ? 'exclamation-triangle' : 'check-circle') + '"></i></div>' +
      '  <div class="cc-alert__body">' +
      '    <h4 class="cc-alert__title">合计 ' + U.money(total) + ' · 约 ' + U.int(kcal) + ' 千卡 · ' + cart.length + ' 类菜品</h4>' +
      '    <p class="cc-alert__msg">' + (over
        ? '已超出预算 ' + U.money(U.round(total - budget, 2)) + '，建议减少 1-2 份高价菜品，或把荤菜替换为素菜窗口菜品。'
        : '仍在预算内，剩余 ' + U.money(U.round(budget - total, 2)) + '。') + '</p>' +
      '  </div>' +
      '</div>'
    );
  }

  function bindCartEvents() {
    $('#cc-cart-toggle').on('click', function () {
      refreshCounters();
      renderCart();
      var modalEl = document.getElementById('cc-cart-modal');
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
      } else if (modalEl) {
        // Bootstrap 未加载时的兜底：直接切换显示
        $(modalEl).addClass('show').css('display', 'block');
        CC.ui.toast('Bootstrap 未加载，已用简化方式显示清单。', 'warning');
      }
    });

    $('#cc-cart-modal')
      .on('click', '[data-cart-inc]', function () {
        var id = $(this).data('cart-inc');
        var cur = CC.state.getCart().filter(function (x) { return x.dishId === id; })[0];
        CC.state.updateCartQty(id, (cur ? cur.qty : 0) + 1);
        renderCart(); refreshCounters();
      })
      .on('click', '[data-cart-dec]', function () {
        var id = $(this).data('cart-dec');
        var cur = CC.state.getCart().filter(function (x) { return x.dishId === id; })[0];
        CC.state.updateCartQty(id, Math.max(0, (cur ? cur.qty : 0) - 1));
        renderCart(); refreshCounters();
      })
      .on('click', '[data-cart-remove]', function () {
        CC.state.removeFromCart($(this).data('cart-remove'));
        renderCart(); refreshCounters();
        CC.ui.toast('已从清单中移除。', 'info', 1800);
      })
      .on('input', '#cc-cart-budget', renderCart);

    $('#cc-cart-check').on('click', function () {
      var budget = Number($('#cc-cart-budget').val());
      if (!budget || budget <= 0 || budget > 500) {
        CC.ui.toast('请输入 1-500 元之间的预算金额。', 'danger');
        $('#cc-cart-budget').addClass('is-invalid');
        return;
      }
      $('#cc-cart-budget').removeClass('is-invalid');
      renderCart();
      CC.ui.toast('已按 ' + U.money(budget) + ' 预算重新校验。', 'success');
    });

    $('#cc-cart-clear').on('click', function () {
      if (!CC.state.getCart().length) {
        CC.ui.toast('清单本来就是空的。', 'info', 2000);
        return;
      }
      CC.state.clearCart();
      renderCart(); refreshCounters();
      CC.ui.toast('清单已清空。', 'success');
    });

    $('#cc-cart-export').on('click', function () {
      var rows = CC.state.getCart().map(function (it) {
        var d = cartCache[it.dishId] || {};
        return {
          id: it.dishId, name: d.name || '(未知菜品)', canteenId: d.canteenId,
          __canteenName: d.__canteenName, stall: d.stall, category: d.category,
          price: d.price, calories: d.calories, protein: d.protein, rating: d.rating,
          monthlySales: (d.monthlySales || 0) * 0
        };
      });
      if (!rows.length) {
        CC.ui.toast('清单为空，无法导出。', 'warning');
        return;
      }
      CC.query.exportCSV(rows, '预算清单-' + new Date().toISOString().slice(0, 10) + '.csv');
    });
  }

  /* =======================================================================
   * 4. 数据来源徽标 + 运行模式提示
   * ===================================================================== */
  function ensureModeBanner() {
    if (!$('#cc-data-mode').length) {
      $('main').first().prepend(
        '<div class="d-flex flex-wrap align-items-center gap-2 mb-3">' +
        '  <span id="cc-data-mode" class="cc-badge">数据来源：待加载</span>' +
        '  <span id="cc-chart-degrade-note" class="cc-badge cc-badge--warning d-none">' +
        '    <i class="bi bi-exclamation-triangle"></i> 图表使用内置降级绘制</span>' +
        '</div>'
      );
    }
    $(document).on('cc:data-mode', function (evt, mode, reason) {
      CC.api.renderModeBadge('#cc-data-mode');
      if (mode === 'embedded') {
        CC.ui.toast('检测到浏览器拦截了本地 JSON 请求（常见于直接双击打开页面），已自动切换为内置数据包，功能不受影响。', 'warning', 7000);
        $('body').attr('data-data-mode', 'embedded');
        if (window.console && console.info) console.info('[CC] 数据降级原因：' + reason);
      }
    });
  }

  /* =======================================================================
   * 5. 调试面板：强制 fetch 失败 / 查看加载日志（用于演示错误提示）
   * ===================================================================== */
  function mountDebugPanel(selector) {
    if (!CC.cfg.features.debugPanel) return;
    var $host = $(selector || '#cc-debug-panel');
    if (!$host.length) return;

    $host.html(
      '<div class="cc-debug-panel">' +
      '  <div class="d-flex justify-content-between align-items-center mb-2">' +
      '    <strong><i class="bi bi-bug"></i> 调试与错误提示演示</strong>' +
      '    <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#cc-debug-body" aria-expanded="false">展开/收起</button>' +
      '  </div>' +
      '  <div class="collapse" id="cc-debug-body">' +
      '    <p class="cc-hint mb-2">把下面的开关打开，再点任意「刷新/重载」按钮，即可看到网络失败时的错误提示与重试流程（报告截图 3-3 用到）。</p>' +
      '    <div class="form-check form-switch mb-2">' +
      '      <input class="form-check-input" type="checkbox" role="switch" id="cc-force-fail">' +
      '      <label class="form-check-label" for="cc-force-fail">强制 fetch 失败（模拟断网 / 服务器未启动）</label>' +
      '    </div>' +
      '    <div class="d-flex gap-2 mb-2 flex-wrap">' +
      '      <button class="btn btn-sm btn-outline-primary" type="button" id="cc-reload-data"><i class="bi bi-arrow-clockwise"></i> 清缓存并重新加载</button>' +
      '      <button class="btn btn-sm btn-outline-secondary" type="button" id="cc-clear-local"><i class="bi bi-eraser"></i> 清空本地数据</button>' +
      '    </div>' +
      '    <div class="cc-debug-log" id="cc-debug-log" aria-live="polite"></div>' +
      '  </div>' +
      '</div>'
    );

    function log(msg) {
      var t = new Date().toLocaleTimeString('zh-CN');
      $('#cc-debug-log').prepend('<div>[' + t + '] ' + U.esc(msg) + '</div>');
    }

    log('调试面板就绪，数据模式：' + CC.api.status.mode);
    $(document).on('cc:data-mode', function (evt, mode) { log('数据来源切换为 ' + mode); });
    $(document).on('cc:asset-error', function (evt, src) { log('资源加载失败：' + src); });

    $('#cc-force-fail').on('change', function () {
      var on = CC.api.forceFail(this.checked);
      log(on ? '已开启强制失败开关' : '已关闭强制失败开关');
      CC.ui.toast(on ? '调试开关已打开：下次加载数据会失败，用于演示错误提示。' : '调试开关已关闭，数据可正常加载。', on ? 'warning' : 'success', 3600);
    });

    $('#cc-reload-data').on('click', function () {
      CC.api.clearCache();
      log('缓存已清空，准备重新加载');
      $(document).trigger('cc:reload-data');
    });

    $('#cc-clear-local').on('click', function () {
      Object.keys(CC.store.keys()).forEach(function (k) {
        if (k !== 'theme') CC.store.remove(CC.store.keys()[k]);
      });
      log('已清空收藏 / 清单 / 自建菜品等本地数据');
      CC.ui.toast('本地数据已清空（主题设置保留）。', 'success');
      $(document).trigger('cc:local-cleared');
    });

    CC.api.renderModeBadge('#cc-data-mode');
  }

  /* =======================================================================
   * 6. 挂载
   * ===================================================================== */
  function mount(opts) {
    var o = opts || {};
    // 导航与页脚由脚本注入，HTML 里只留占位容器，减少重复代码
    if ($('#cc-nav-host').length) $('#cc-nav-host').replaceWith(navMarkup());
    if ($('#cc-footer-host').length) $('#cc-footer-host').replaceWith(footerMarkup());
    if (!$('#cc-cart-modal').length) $('body').append(cartModalMarkup());

    CC.layout.init();
    if (o.cart !== false) {
      bindCartEvents();
      refreshCounters();
      // 移动端点击导航项后自动收起折叠菜单
      $(document).on('click', '#cc-nav-links .nav-link', function () {
        var $c = $('#cc-navbar');
        if ($c.hasClass('show') && window.bootstrap) {
          window.bootstrap.Collapse.getOrCreateInstance($c.get(0)).hide();
        }
      });
    }
    return { refreshCounters: refreshCounters, renderCart: renderCart, setCartSource: setCartSource, log: function () {} };
  }

  return {
    mount: mount,
    refreshCounters: refreshCounters,
    renderCart: renderCart,
    setCartSource: setCartSource,
    ensureModeBanner: ensureModeBanner,
    mountDebugPanel: mountDebugPanel
  };
})(jQuery, window.CC);
