/*
 * page-home.js —— 信息首页
 * 内容：KPI 指标、食堂实时概览（含拥挤度）、今日推荐、功能入口、公告栏、客流迷你图
 * 依赖：core.js / data-api.js / charts.js / query.js / ui.js
 */
(function ($, CC) {
  'use strict';

  var U = CC.utils;
  var data = { canteens: [], dishes: [], stats: null, notices: [] };
  var trafficHandle = null;
  var noticeFilter = 'all';
  var pickOffset = 0;

  /* ---------- 1. 时钟 ---------- */
  function startClock() {
    function tick() {
      var d = new Date();
      function p(n) { return n < 10 ? '0' + n : '' + n; }
      $('#cc-clock').text(p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()));
    }
    tick();
    window.setInterval(tick, 1000);
  }

  /* ---------- 2. 当前时段拥挤度 ---------- */
  function currentHourIndex(stats) {
    var hours = stats.meta.hours;
    var h = new Date().getHours();
    // 数据从 06:00 开始，逐小时一格；超出范围时钳制到首尾
    var idx = h - parseInt(hours[0], 10);
    return U.clamp(idx, 0, hours.length - 1);
  }

  function countAt(stats, canteenId, idx, useWeekend) {
    var t = stats.traffic[canteenId];
    var arr = useWeekend ? t.hourlyWeekend : t.hourly;
    return Number(arr[idx] || 0);
  }

  /* ---------- 3. KPI ---------- */
  function renderKPI() {
    var dishes = data.dishes;
    var stats = data.stats;
    var avgPrice = U.avg(dishes.map(function (d) { return d.price; }));
    var vegetarian = dishes.filter(function (d) { return d.vegetarian; }).length;
    var newCount = dishes.filter(function (d) { return d.isNew; }).length;

    $('#kpi-dishes').text(U.int(dishes.length));
    $('#kpi-dishes-sub').html('<i class="bi bi-leaf"></i> 其中素食 ' + vegetarian + ' 道 · 新品 ' + newCount + ' 道');

    $('#kpi-price').text(avgPrice.toFixed(1));
    var cheapest = U.sortBy(dishes, 'price', false)[0];
    var priciest = U.sortBy(dishes, 'price', true)[0];
    $('#kpi-price-sub').text('区间 ' + (cheapest ? cheapest.price : 0) + ' - ' + (priciest ? priciest.price : 0) + ' 元');

    var total = stats.trends.series.filter(function (s) { return s.type === 'line'; })
      .reduce(function (a, s) { return a + Number(s.data[11] || 0); }, 0);
    var nov = stats.trends.series.filter(function (s) { return s.type === 'line'; })
      .reduce(function (a, s) { return a + Number(s.data[10] || 0); }, 0);
    var delta = nov ? ((total - nov) / nov) * 100 : 0;

    $('#kpi-traffic').text(U.int(total));
    $('#kpi-traffic-sub')
      .attr('class', 'cc-kpi__delta ' + (delta >= 0 ? 'cc-kpi__delta--up' : 'cc-kpi__delta--down'))
      .html('<i class="bi bi-arrow-' + (delta >= 0 ? 'up' : 'down') + '-right"></i> 较上月 ' + (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%');

    var satis = stats.satisfaction.radar['全校平均'];
    var overall = U.avg(satis);
    $('#kpi-rating').text(overall.toFixed(2));
    var dist = stats.satisfaction.scoreDistribution;
    var goodRatio = (dist.counts[0] + dist.counts[1]) / U.sum(dist.counts) * 100;
    $('#kpi-rating-sub').text('满意及以上占 ' + goodRatio.toFixed(1) + '%（样本 ' + U.int(U.sum(dist.counts)) + ' 份）');

    $('#cc-updated').text((data.stats.meta.updated || '') + ' · 数据版本 ' + CC.cfg.dataVersion);
  }

  /* ---------- 4. 食堂概览卡 ---------- */
  function renderCanteens() {
    var stats = data.stats;
    var isWeekend = [0, 6].indexOf(new Date().getDay()) > -1;
    var idx = currentHourIndex(stats);
    var hourLabel = stats.meta.hours[idx];
    var html = data.canteens.map(function (c) {
      var count = countAt(stats, c.id, idx, isWeekend);
      var level = CC.derive.crowdLevel(count);
      var maxCount = U.max(stats.traffic[c.id].hourly.concat(stats.traffic[c.id].hourlyWeekend));
      var width = U.clamp((count / (maxCount || 1)) * 100, 2, 100);
      var wait = stats.waitMinutes[c.id][idx];
      var dishCount = data.dishes.filter(function (d) { return d.canteenId === c.id; }).length;

      return '' +
        '<div class="col-12 col-md-6 col-xxl-4">' +
        '  <article class="cc-card cc-card--hover" data-canteen="' + U.esc(c.id) + '">' +
        '    <div class="d-flex justify-content-between align-items-start mb-1">' +
        '      <div>' +
        '        <h3 class="cc-card__title mb-0">' +
        '          <span class="cc-scene-legend__dot me-1" style="background:' + U.esc(c.color) + '"></span>' +
        U.esc(c.name) + '</h3>' +
        '        <div class="cc-hint">' + U.esc(c.location) + ' · ' + U.esc(c.brand) + '</div>' +
        '      </div>' +
        '      <span class="cc-badge">' + U.esc(String(c.floor)) + ' 层</span>' +
        '    </div>' +
        '    <div class="cc-dish__meta mb-2">' +
        (c.tags || []).map(function (t) { return '<span class="cc-chip is-on" style="cursor:default">' + U.esc(t) + '</span>'; }).join('') +
        '    </div>' +
        '    <div class="cc-crowd cc-crowd--' + level.className.replace('crowd-', '') + '">' +
        '      <div class="d-flex justify-content-between">' +
        '        <span><i class="bi bi-activity"></i> ' + U.esc(hourLabel) + ' 在店人数</span>' +
        '        <strong>' + U.int(count) + ' 人 · ' + U.esc(level.label) + '</strong>' +
        '      </div>' +
        '      <div class="cc-crowd__bar"><div class="cc-crowd__fill" style="width:' + width.toFixed(1) + '%"></div></div>' +
        '      <div class="d-flex justify-content-between mt-1">' +
        '        <span>预计排队 ' + U.seconds(wait) + '</span>' +
        '        <span>收录菜品 ' + dishCount + ' 道</span>' +
        '      </div>' +
        '    </div>' +
        '    <hr class="my-2">' +
        '    <div class="d-flex justify-content-between align-items-center">' +
        '      <span class="cc-hint">人均 ' + U.money(c.avgPrice) + ' · 座位 ' + U.int(c.seats) + '</span>' +
        '      ' + CC.ui.stars(c.rating) +
        '    </div>' +
        '    <div class="d-flex gap-2 mt-2">' +
        '      <a class="btn btn-sm btn-primary flex-fill" href="dishes.html?canteen=' + encodeURIComponent(c.id) + '">看菜品</a>' +
        '      <a class="btn btn-sm btn-outline-secondary flex-fill" href="canteens.html?canteen=' + encodeURIComponent(c.id) + '">看档案</a>' +
        '    </div>' +
        '  </article>' +
        '</div>';
    }).join('');

    $('#cc-canteen-cards').html(html);
  }

  /* ---------- 5. 今日推荐 ---------- */
  function renderPicks() {
    var pool = data.dishes.filter(function (d) {
      return Number(d.rating) >= 4.3 && (d.supply || []).indexOf('午餐') > -1;
    });
    var sorted = U.sortBy(pool, 'rating', true);
    // “换一批”时在评分前 20 名里轮转，避免每次点都看到同样顺序
    var top = sorted.slice(0, 12);
    var start = pickOffset % Math.max(1, top.length);
    var rotate = top.slice(start).concat(top.slice(0, start)).slice(0, 3);

    var canteenMap = {};
    data.canteens.forEach(function (c) { canteenMap[c.id] = c; });

    $('#cc-pick-list').html(rotate.map(function (d) {
      var c = canteenMap[d.canteenId] || {};
      return '' +
        '<div class="col-12 col-md-4">' +
        '  <article class="cc-dish">' +
        '    <div class="cc-dish__head">' +
        '      <div><h3 class="cc-dish__name">' + U.esc(d.name) + '</h3>' +
        '      <div class="cc-dish__stall">' + U.esc(c.name || d.canteenId) + ' · ' + U.esc(d.stall) + '</div></div>' +
        '      <div class="cc-dish__price">' + d.price.toFixed(1) + '<small> 元</small></div>' +
        '    </div>' +
        '    <div class="cc-dish__meta">' + CC.ui.stars(d.rating) + '</div>' +
        '    <div class="cc-dish__stats">' +
        '      <div>月销<b>' + U.int(d.monthlySales) + '</b></div>' +
        '      <div>热量<b>' + U.int(d.calories) + '</b></div>' +
        '      <div>蛋白<b>' + d.protein.toFixed(1) + 'g</b></div>' +
        '    </div>' +
        '    <div class="cc-dish__actions">' +
        '      <a class="btn btn-sm btn-outline-primary flex-fill" href="dishes.html?keyword=' + encodeURIComponent(d.name) + '">查看详情</a>' +
        '      <button class="btn btn-sm btn-primary flex-fill" type="button" data-add-cart="' + U.esc(d.id) + '">' +
        '        <i class="bi bi-basket-plus"></i> 加入清单</button>' +
        '    </div>' +
        '  </article>' +
        '</div>';
    }).join('') || '<div class="col-12"><p class="cc-hint mb-0">没有符合条件的推荐菜品。</p></div>');
  }

  /* ---------- 6. 功能入口 ---------- */
  function renderEntries() {
    var entries = [
      { href: 'dishes.html', icon: 'search', title: '菜品查询', desc: '按食堂 / 类别 / 价格 / 评分多条件筛选，支持收藏与导出', color: '' },
      { href: 'canteens.html', icon: 'shop', title: '食堂档案', desc: '营业时间、楼层档口、客流曲线，并可新增或修改菜品', color: 'cc-kpi__icon--orange' },
      { href: 'analytics.html', icon: 'bar-chart-line', title: '数据看板', desc: 'ECharts + Chart.js 共 8 张图表：客流、价格、营养、满意度', color: 'cc-kpi__icon--green' },
      { href: 'scene3d.html', icon: 'badge-3d', title: '三维总览', desc: 'Three.js 三维食堂模型，点击楼栋查看详情', color: 'cc-kpi__icon--purple' },
      { href: 'dishes.html?favorite=1', icon: 'star', title: '我的收藏', desc: '收藏的菜品集中查看，一键导出为 CSV', color: '' }
    ];
    $('#cc-entry-list').html(entries.map(function (e) {
      return '' +
        '<div class="col-12 col-sm-6 col-lg-4">' +
        '  <a class="cc-card cc-card--hover cc-card--tight d-flex gap-3 text-decoration-none h-100" href="' + e.href + '">' +
        '    <div class="cc-kpi__icon ' + e.color + '"><i class="bi bi-' + e.icon + '"></i></div>' +
        '    <div>' +
        '      <div class="fw-bold" style="color:var(--cc-text)">' + e.title + '</div>' +
        '      <div class="cc-hint">' + e.desc + '</div>' +
        '    </div>' +
        '  </a>' +
        '</div>';
    }).join(''));
  }

  /* ---------- 7. 公告 ---------- */
  function renderNotices() {
    var list = data.notices.slice();
    if (noticeFilter === 'warn') {
      list = list.filter(function (n) { return n.type === 'warn' || n.level === 'warning' || n.level === 'danger'; });
    } else if (noticeFilter === 'event') {
      list = list.filter(function (n) { return n.type === 'event'; });
    }
    list = U.sortBy(list, 'date', true).slice(0, 6);
    var canteenMap = {};
    data.canteens.forEach(function (c) { canteenMap[c.id] = c; });

    if (!list.length) {
      CC.ui.emptyState('#cc-notice-list', {
        icon: 'megaphone',
        title: '该分类下暂无公告',
        message: '可切换上方按钮查看其他类型的公告。'
      });
      return;
    }

    var typeMap = {
      notice: { label: '公告', cls: 'cc-badge--brand' },
      supply: { label: '供应', cls: 'cc-badge--success' },
      price: { label: '价格', cls: 'cc-badge--warning' },
      event: { label: '活动', cls: 'cc-badge--brand' },
      warn: { label: '提醒', cls: 'cc-badge--danger' }
    };

    $('#cc-notice-list').html(list.map(function (n) {
      var t = typeMap[n.type] || typeMap.notice;
      var short = U.shortDate(n.date);
      var rel = U.relativeDate(n.date);
      // 公告是跨天发布的固定清单，不使用"N 天前"这类相对时间，避免长期运行后产生误导；
      // 相对日期与短日期重复时也不重复显示（例如同一天算出 "01-06" 与 "2025-01-06"）。
      var sub = (rel === n.date || rel === short) ? '' : rel;
      return '' +
        '<div class="cc-notice">' +
        '  <div class="cc-notice__date">' + U.esc(short) +
        (sub ? '<div class="cc-hint">' + U.esc(sub) + '</div>' : '') +
        '  </div>' +
        '  <div class="flex-fill">' +
        '    <div class="d-flex gap-2 align-items-center mb-1 flex-wrap">' +
        '      <span class="cc-badge ' + t.cls + ' cc-notice__type">' + t.label + '</span>' +
        '      <h3 class="cc-notice__title mb-0">' + U.esc(n.title) + '</h3>' +
        '    </div>' +
        '    <p class="cc-notice__body">' + U.esc(n.content) + '</p>' +
        '    <div class="cc-hint">' +
        (n.canteenId && canteenMap[n.canteenId] ? '<i class="bi bi-geo-alt"></i> ' + U.esc(canteenMap[n.canteenId].name) : '<i class="bi bi-globe2"></i> 全校通知') +
        '    </div>' +
        '  </div>' +
        '</div>';
    }).join(''));
  }

  /* ---------- 8. 客流迷你图（ECharts） ---------- */
  function renderTrafficChart(canteenId) {
    if (!data.stats) return;
    var stats = data.stats;
    var ids = canteenId && canteenId !== 'all' ? [canteenId] : data.canteens.map(function (c) { return c.id; });
    var canteenMap = {};
    data.canteens.forEach(function (c) { canteenMap[c.id] = c; });

    var series = ids.map(function (id, i) {
      return {
        name: canteenMap[id] ? canteenMap[id].name : id,
        type: 'line',
        smooth: true,
        symbolSize: 5,
        lineStyle: { width: ids.length > 1 ? 2 : 3 },
        areaStyle: ids.length === 1 ? { opacity: 0.18 } : null,
        data: stats.traffic[id].hourly,
        itemStyle: { color: (canteenMap[id] || {}).color || CC.charts.palette[i % CC.charts.palette.length] }
      };
    });

    var option = $.extend(true, CC.charts.baseOption(), {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 16, top: 18, bottom: 34 },
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11 } },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: stats.meta.hours,
        axisLabel: { fontSize: 10, interval: 2 }
      },
      yAxis: {
        type: 'value',
        name: '人次',
        nameTextStyle: { fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed' } }
      },
      series: series
    });
    // 高峰阈值参考线
    option.series[0].markLine = {
      silent: true,
      symbol: 'none',
      lineStyle: { color: '#d94f6a', type: 'dashed' },
      label: { formatter: '高峰阈值', fontSize: 10 },
      data: [{ yAxis: CC.cfg.business.peakThreshold }]
    };

    if (trafficHandle) {
      trafficHandle.update(option);
    } else {
      trafficHandle = CC.charts.init('#cc-home-traffic-chart', 'echarts', option);
    }

    // 计算并展示峰值
    var peakIdx = 0;
    ids.forEach(function (id) {
      stats.traffic[id].hourly.forEach(function (v, i) {
        if (v > stats.traffic[ids[0]].hourly[peakIdx]) peakIdx = i;
      });
    });
    var total = ids.reduce(function (a, id) { return a + U.sum(stats.traffic[id].hourly); }, 0);
    $('#cc-home-traffic-tip').html(
      '<i class="bi bi-lightbulb"></i> 高峰时段出现在 <b>' + U.esc(stats.meta.hours[peakIdx]) + '</b> 前后，' +
      '全天累计约 <b>' + U.int(total) + '</b> 人次。图表数据全部来自 <span class="cc-mono">data/stats.json</span>，未在前端硬编码。'
    );
  }

  /* ---------- 9. 数据加载与错误处理 ---------- */
  function loadAll(isRetry) {
    CC.ui.skeleton('#cc-canteen-cards', 2);
    $('#cc-home-alert').empty();
    if (!isRetry) CC.ui.skeleton('#cc-notice-list', 3);

    CC.api.loadAll(['canteens', 'dishes', 'stats', 'notices']).then(function (results) {
      var failure = CC.api.firstFailure(results);
      if (failure) {
        CC.api.renderError('#cc-home-alert', failure.name, failure.error, function () { loadAll(true); });
        CC.ui.emptyState('#cc-canteen-cards', { icon: 'wifi-off', title: '数据未加载', message: '请先解决上方错误后点击“重新加载”。' });
        CC.ui.emptyState('#cc-notice-list', { icon: 'wifi-off', title: '公告未加载', message: '数据加载失败时不会显示虚假内容。' });
        CC.api.renderModeBadge('#cc-data-mode');
        return;
      }
      results.forEach(function (r) {
        if (r.name === 'canteens') data.canteens = r.data.list;
        if (r.name === 'dishes') data.dishes = r.data.list;
        if (r.name === 'stats') data.stats = r.data;
        if (r.name === 'notices') data.notices = r.data.list;
      });

      CC.uiKit.setCartSource(data.dishes);
      renderKPI();
      renderCanteens();
      renderPicks();
      renderEntries();
      renderNotices();
      renderTrafficChart($('#cc-home-canteen-select').val() || 'all');

      // 食堂下拉
      var $sel = $('#cc-home-canteen-select');
      if (!$sel.data('filled')) {
        $sel.html('<option value="all">全部食堂对比</option>' + data.canteens.map(function (c) {
          return '<option value="' + U.esc(c.id) + '">' + U.esc(c.name) + '</option>';
        }).join('')).data('filled', true);
      }

      CC.api.renderModeBadge('#cc-data-mode');
      if (CC.api.status.mode === 'embedded') {
        $('#cc-home-alert').html(
          '<div class="cc-alert cc-alert--warning">' +
          '  <div class="cc-alert__icon"><i class="bi bi-archive"></i></div>' +
          '  <div class="cc-alert__body">' +
          '    <h4 class="cc-alert__title">当前使用内置数据包运行（功能正常）</h4>' +
          '    <p class="cc-alert__msg mb-0">浏览器阻止了 file:// 下对本地 JSON 的读取，程序已自动降级到 ' +
          '      <span class="cc-mono">js/data-bundle.js</span>，页面功能不受影响。' +
          '      若希望走标准 JSON 异步加载流程，可在项目根目录执行 ' +
          '      <span class="cc-mono">python -m http.server 8080</span> 后通过 ' +
          '      <span class="cc-mono">http://localhost:8080</span> 访问。</p>' +
          '  </div>' +
          '</div>'
        );
      }
    });
  }

  /* ---------- 11. 初始化 ---------- */
  CC.ready(function ($) {
    CC.uiKit.mount();
    CC.uiKit.ensureModeBanner();
    startClock();
    loadAll(false);

    $('#cc-reroll-pick').on('click', function () {
      pickOffset += 1;
      renderPicks();
    });

    $('body').on('click', '[data-add-cart]', function () {
      var id = $(this).data('add-cart');
      CC.state.addToCart(id, 1);
      CC.uiKit.refreshCounters();
      CC.ui.toast('已把「' + ($(this).closest('.cc-dish').find('.cc-dish__name').text() || id) + '」加入预算清单。', 'success', 2400);
    });

    $('body').on('click', '[data-notice-filter]', function () {
      noticeFilter = $(this).data('notice-filter');
      $('[data-notice-filter]').removeClass('active');
      $(this).addClass('active');
      renderNotices();
    });

    $('#cc-home-canteen-select').on('change', function () {
      renderTrafficChart($(this).val());
    });

    $('#cc-refresh-home').on('click', function () {
      CC.api.clearCache();
      loadAll(true);
      CC.ui.toast('已重新请求数据。', 'info', 2200);
    });

    $(document).on('cc:reload-data', function () { loadAll(true); });
    $(document).on('cc:theme-changed', function () {
      // 主题变化后重建图表以应用新的文字颜色
      if (trafficHandle) { trafficHandle.destroy(); trafficHandle = null; }
      renderTrafficChart($('#cc-home-canteen-select').val() || 'all');
    });

    CC.uiKit.mountDebugPanel('#cc-debug-panel');
  });
})(jQuery, window.CC);
