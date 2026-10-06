/*
 * page-analytics.js —— 数据看板
 * 6 张图表：ECharts 5 张 + Chart.js 1 张；并提供"同一份数据、两个引擎"的对照实验以支撑选型说明。
 * 所有数值都由 data/*.json 现算，页面不写死任何一个业务数字（阈值类常量除外）。
 */
(function ($, CC) {
  'use strict';

  var U = CC.utils;
  var data = { canteens: [], dishes: [], stats: null, notices: [] };
  var handles = {};
  var state = { trendScope: 'all', trendEngine: 'echarts', dayType: 'hourly', nutriMetric: 'all' };
  var canteenName = {};

  /* =======================================================================
   * 通用小工具
   * ===================================================================== */
  function axisCommon(extra) {
    return $.extend(true, {
      axisLine: { lineStyle: { color: 'rgba(120,140,170,.5)' } },
      axisLabel: { fontSize: 11, color: '#7b8794' },
      splitLine: { lineStyle: { type: 'dashed', color: 'rgba(120,140,170,.22)' } }
    }, extra || {});
  }

  function setHandle(key, kind, option) {
    if (handles[key]) {
      handles[key].update(option);
      return handles[key];
    }
    handles[key] = CC.charts.init('#chart-' + key, kind, option);
    return handles[key];
  }

  function destroyAll() {
    Object.keys(handles).forEach(function (k) {
      try { handles[k].destroy(); } catch (e) { /* 忽略 */ }
      delete handles[k];
    });
  }

  /* =======================================================================
   * 图表 1 · 全年客流趋势 + 人均消费（支持 ECharts / Chart.js 切换）
   * ===================================================================== */
  function trendSeries() {
    var stats = data.stats;
    var lines = stats.trends.series.filter(function (s) { return s.type === 'line'; });
    if (state.trendScope !== 'all') lines = lines.filter(function (s) { return s.key === state.trendScope; });
    var price = stats.trends.series.filter(function (s) { return s.type === 'bar'; })[0];
    return { lines: lines, price: price };
  }

  function renderTrend() {
    var stats = data.stats;
    var labels = stats.trends.labels;
    var t = trendSeries();

    if (state.trendEngine === 'chartjs') {
      var ds = t.lines.map(function (s) {
        var c = null;
        data.canteens.forEach(function (x) { if (x.id === s.key) c = x; });
        return {
          label: s.name + '（人次）',
          data: s.data,
          type: 'line',
          borderColor: (c && c.color) || '#2f7fd6',
          backgroundColor: ((c && c.color) || '#2f7fd6') + '33',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2.5,
          yAxisID: 'y'
        };
      });
      ds.push({
        label: '人均消费（元）',
        data: t.price.data,
        type: 'bar',
        backgroundColor: 'rgba(224,118,43,.55)',
        borderColor: '#e0762b',
        borderWidth: 1,
        borderRadius: 3,
        yAxisID: 'y1'
      });

      setHandle('trend', 'chartjs', {
        type: 'line',
        data: { labels: labels, datasets: ds },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + '：' + U.int(ctx.parsed.y); } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { beginAtZero: true, position: 'left', title: { display: true, text: '人次', font: { size: 11 } } },
            y1: {
              beginAtZero: true, position: 'right', title: { display: true, text: '元', font: { size: 11 } },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
      return;
    }

    // ECharts 版本
    var series = t.lines.map(function (s) {
      var c = null;
      data.canteens.forEach(function (x) { if (x.id === s.key) c = x; });
      return {
        name: s.name,
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        itemStyle: { color: (c && c.color) || undefined },
        areaStyle: t.lines.length === 1 ? { opacity: 0.15 } : undefined,
        data: s.data
      };
    });
    series.push({
      name: '人均消费（元）',
      type: 'bar',
      yAxisIndex: 1,
      barWidth: '34%',
      itemStyle: { color: 'rgba(224,118,43,.6)', borderRadius: [4, 4, 0, 0] },
      data: t.price.data
    });

    setHandle('trend', 'echarts', {
      color: CC.charts.palette,
      textStyle: { fontFamily: CC.cfg.charts.fontFamily },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross', crossStyle: { color: '#999' } } },
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 62, right: 58, top: 26, bottom: 52 },
      xAxis: axisCommon({ type: 'category', boundaryGap: true, data: labels }),
      yAxis: [
        axisCommon({ type: 'value', name: '人次', nameTextStyle: { fontSize: 11 } }),
        axisCommon({ type: 'value', name: '元', nameTextStyle: { fontSize: 11 }, splitLine: { show: false } })
      ],
      series: series
    });

    $('#chart1-sub').html('数据源：stats.json → trends.series（' +
      (state.trendEngine === 'echarts' ? 'ECharts' : 'Chart.js') + ' 渲染 · ' +
      (state.trendScope === 'all' ? '3 个食堂 + 人均消费' : canteenName[state.trendScope] + ' + 人均消费') +
      ' · 折线为左轴人次、柱状为右轴元）');
  }

  /* =======================================================================
   * 图表 2 · 菜品类目环形图
   * ===================================================================== */
  function renderCategory() {
    var share = CC.derive.computeCategoryShare(data.dishes);
    setHandle('category', 'echarts', {
      color: CC.charts.palette.concat(['#64748b', '#a16207', '#0ea5e9', '#f472b6', '#84cc16']),
      textStyle: { fontFamily: CC.cfg.charts.fontFamily },
      tooltip: { trigger: 'item', formatter: '{b}：{c} 道（{d}%）' },
      legend: {
        type: 'scroll', orient: 'vertical', right: 4, top: 'center',
        itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 }
      },
      series: [{
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['36%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c} 道', fontSize: 10, lineHeight: 13 },
        labelLine: { length: 8, length2: 8 },
        data: share.map(function (s) { return { name: s.name, value: s.value }; })
      }]
    });
    $('#chart2-sub').html('数据源：dishes.json 实时折算 · 共 ' + share.length + ' 个类目 · ' +
      data.dishes.length + ' 道菜品（环形图）');
  }

  /* =======================================================================
   * 图表 3 · 价格与评分散点图
   * ===================================================================== */
  function renderScatter() {
    var points = data.dishes.filter(function (d) { return Number(d.monthlySales) >= 600; });
    var byCanteen = {};
    data.canteens.forEach(function (c) { byCanteen[c.id] = []; });
    points.forEach(function (d) {
      (byCanteen[d.canteenId] = byCanteen[d.canteenId] || []).push([d.price, d.rating, d.monthlySales, d.name, d.stall]);
    });
    var series = Object.keys(byCanteen).map(function (id) {
      var c = null;
      data.canteens.forEach(function (x) { if (x.id === id) c = x; });
      return {
        name: (c && c.name) || id,
        type: 'scatter',
        symbolSize: function (v) { return U.clamp(Math.sqrt(v[2]) / 3.4, 8, 34); },
        itemStyle: { color: (c && c.color) || undefined, opacity: 0.72 },
        data: byCanteen[id]
      };
    });

    setHandle('scatter', 'echarts', {
      color: CC.charts.palette,
      textStyle: { fontFamily: CC.cfg.charts.fontFamily },
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          return '<b>' + U.esc(p.data[3]) + '</b><br>' + U.esc(p.data[4]) + '<br>' +
            '价格：' + p.data[0] + ' 元<br>评分：' + p.data[1] + ' 分<br>月销量：' + U.int(p.data[2]) + ' 份';
        }
      },
      legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
      grid: { left: 52, right: 24, top: 22, bottom: 52 },
      xAxis: axisCommon({ type: 'value', name: '价格（元）', nameTextStyle: { fontSize: 11 }, min: 0, max: 30 }),
      yAxis: axisCommon({ type: 'value', name: '评分', nameTextStyle: { fontSize: 11 }, min: 3.8, max: 4.9 }),
      series: series
    });
    $('#chart3-sub').html('每道菜品一个气泡（共 ' + points.length + ' 道月销 ≥ 600 的菜品），' +
      '气泡越大月销量越高；可观察"高价不等于高分"的分布规律');
  }

  /* =======================================================================
   * 图表 4 · 各食堂均价 + 价格区间分布
   * ===================================================================== */
  function renderPrice() {
    var avg = CC.derive.computeCanteenAvgPrice(data.dishes, data.canteens);
    var bins = CC.derive.computePriceBins(data.dishes, 5);
    var total = U.sum(bins.counts) || 1;
    var ratio = bins.counts.map(function (c) { return U.round((c / total) * 100, 1); });

    setHandle('price', 'echarts', {
      color: CC.charts.palette,
      textStyle: { fontFamily: CC.cfg.charts.fontFamily },
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 56, right: 52, top: 26, bottom: 52 },
      xAxis: axisCommon({ type: 'category', data: avg.map(function (a) { return a.name; }) }),
      yAxis: [
        axisCommon({ type: 'value', name: '元', nameTextStyle: { fontSize: 11 }, min: 0 }),
        axisCommon({ type: 'value', name: '占比 %', nameTextStyle: { fontSize: 11 }, splitLine: { show: false }, max: 40 })
      ],
      series: [
        {
          name: '收录菜品均价（元）',
          type: 'bar',
          barWidth: '42%',
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          label: { show: true, position: 'top', fontSize: 11, formatter: '{c} 元' },
          data: avg.map(function (a, i) {
            return { value: a.value, itemStyle: { color: (data.canteens[i] || {}).color || CC.charts.palette[i] } };
          })
        },
        {
          name: '价格区间菜品占比（%）',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 6,
          lineStyle: { width: 2, type: 'dashed', color: '#d94f6a' },
          itemStyle: { color: '#d94f6a' },
          data: ratio
        }
      ]
    });
    $('#chart4-sub').html('柱：由 dishes.json 折算的各食堂已收录菜品均价（第一 ' +
      avg[0].value + ' / 第二 ' + avg[1].value + ' / 第三 ' + avg[2].value +
      ' 元）；折线：全部菜品按 5 元分档的区间占比（' + bins.labels.join('、') + '）');
  }

  /* =======================================================================
   * 图表 5 · 分时段客流面积图
   * ===================================================================== */
  function renderHourly() {
    var stats = data.stats;
    var series = data.canteens.map(function (c) {
      return {
        name: c.name,
        type: 'line',
        smooth: true,
        symbolSize: 5,
        stack: 'total',
        areaStyle: { opacity: 0.32 },
        emphasis: { focus: 'series' },
        itemStyle: { color: c.color },
        data: stats.traffic[c.id][state.dayType]
      };
    });
    series[0].markLine = {
      silent: true,
      symbol: 'none',
      lineStyle: { color: '#d94f6a', type: 'dashed', width: 1.5 },
      label: { formatter: '单食堂高峰阈值 ' + CC.cfg.business.peakThreshold, fontSize: 10, position: 'insideEndTop' },
      data: [{ yAxis: CC.cfg.business.peakThreshold }]
    };

    setHandle('hourly', 'echarts', {
      color: CC.charts.palette,
      textStyle: { fontFamily: CC.cfg.charts.fontFamily },
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 58, right: 24, top: 30, bottom: 52 },
      xAxis: axisCommon({ type: 'category', boundaryGap: false, data: stats.meta.hours, axisLabel: { fontSize: 10, interval: 1 } }),
      yAxis: axisCommon({ type: 'value', name: '人次', nameTextStyle: { fontSize: 11 } }),
      series: series
    });

    var totals = data.canteens.map(function (c) { return U.sum(stats.traffic[c.id][state.dayType]); });
    var peakIdx = 0;
    data.canteens[0] && stats.traffic[data.canteens[0].id][state.dayType].forEach(function (v, i) {
      if (v > stats.traffic[data.canteens[0].id][state.dayType][peakIdx]) peakIdx = i;
    });
    $('#chart5-sub').html('数据源：stats.json → traffic.*.' + state.dayType +
      '（' + (state.dayType === 'hourly' ? '工作日' : '周末') + '）· 全天合计 ' + U.int(U.sum(totals)) +
      ' 人次 · 峰值时段 ' + U.esc(stats.meta.hours[peakIdx]) + '（堆叠面积图，可看出三食堂人流差距）');
  }

  /* =======================================================================
   * 图表 6 · 营养构成分组柱（Chart.js）
   * ===================================================================== */
  function renderNutrition() {
    var items = data.stats.nutrition.items;
    var metrics = [
      { key: 'calories', label: '热量 (kcal)', color: 'rgba(224,118,43,.7)' },
      { key: 'protein', label: '蛋白质 (g)', color: 'rgba(47,127,214,.7)' },
      { key: 'fat', label: '脂肪 (g)', color: 'rgba(217,79,106,.7)' },
      { key: 'carbs', label: '碳水 (g)', color: 'rgba(63,163,107,.7)' }
    ].filter(function (m) { return state.nutriMetric === 'all' || state.nutriMetric === m.key; });

    setHandle('nutrition', 'chartjs', {
      type: 'bar',
      data: {
        labels: items.map(function (i) { return i.name; }),
        datasets: metrics.map(function (m) {
          return {
            label: m.label,
            data: items.map(function (i) { return i[m.key]; }),
            backgroundColor: m.color,
            borderColor: m.color.replace(/[\d.]+\)$/, '1)'),
            borderWidth: 1,
            borderRadius: 3
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterBody: function (ctxs) {
                var idx = ctxs[0].dataIndex;
                var it = items[idx];
                var flag = it.calories >= 600 && it.calories <= 900 ? '符合午餐热量建议（600-900 kcal）' : (it.calories < 600 ? '低于午餐建议热量，可搭配主食' : '高于午餐建议热量，建议分食或减少主食');
                return flag;
              }
            }
          }
        },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 40, minRotation: 0 }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: '数值（单位见图例）', font: { size: 11 } } }
        }
      }
    });
  }

  /* =======================================================================
   * 核对表
   * ===================================================================== */
  function renderTables() {
    var stats = data.stats;
    // 年度趋势
    var lineKeys = stats.trends.series.filter(function (s) { return s.type === 'line'; });
    var priceData = stats.trends.series.filter(function (s) { return s.type === 'bar'; })[0].data;
    $('#tab-trend-body').html(stats.trends.labels.map(function (m, i) {
      var vals = lineKeys.map(function (s) { return Number(s.data[i]); });
      var sum = U.sum(vals);
      return '<tr><th scope="row">' + U.esc(m) + '</th>' +
        vals.map(function (v) { return '<td class="cc-num">' + U.int(v) + '</td>'; }).join('') +
        '<td class="cc-num"><b>' + U.int(sum) + '</b></td>' +
        '<td class="cc-num">' + priceData[i].toFixed(1) + '</td></tr>';
    }).join(''));

    // 类目与价格
    var share = CC.derive.computeCategoryShare(data.dishes);
    var priceStats = CC.derive.computePriceStats(data.dishes);
    var statMap = {};
    priceStats.forEach(function (p) { statMap[p.category] = p; });
    var maxCount = share[0] ? share[0].value : 1;
    $('#tab-cate-body').html(share.map(function (s) {
      var p = statMap[s.name] || { avg: 0, min: 0, max: 0 };
      return '<tr><th scope="row">' + U.esc(s.name) + '</th>' +
        '<td class="cc-num">' + s.value + '</td>' +
        '<td class="cc-num">' + U.percent(s.value, data.dishes.length) + '</td>' +
        '<td class="cc-num">' + p.avg.toFixed(1) + '</td>' +
        '<td class="cc-num">' + p.min.toFixed(1) + '</td>' +
        '<td class="cc-num">' + p.max.toFixed(1) + '</td>' +
        '<td><div class="cc-mini-bar"><span style="width:' + ((s.value / maxCount) * 100).toFixed(1) + '%"></span></div></td></tr>';
    }).join(''));

    // 营养
    var std = { calories: [600, 900], protein: [25, 999] };
    $('#tab-nutri-body').html(stats.nutrition.items.map(function (it) {
      var okCal = it.calories >= std.calories[0] && it.calories <= std.calories[1];
      var okPro = it.protein >= std.protein[0];
      var label = okCal && okPro ? '<span class="cc-badge cc-badge--success">热量与蛋白均达标</span>'
        : (!okCal && okPro ? '<span class="cc-badge cc-badge--warning">热量偏离建议</span>'
          : (okCal && !okPro ? '<span class="cc-badge cc-badge--warning">蛋白质偏低</span>'
            : '<span class="cc-badge cc-badge--danger">两项均需注意</span>'));
      return '<tr><th scope="row">' + U.esc(it.name) + '</th>' +
        '<td class="cc-num">' + U.int(it.calories) + '</td>' +
        '<td class="cc-num">' + it.protein.toFixed(1) + '</td>' +
        '<td class="cc-num">' + it.fat.toFixed(1) + '</td>' +
        '<td class="cc-num">' + it.carbs.toFixed(1) + '</td>' +
        '<td class="cc-num">' + U.int(it.sodium) + '</td>' +
        '<td>' + label + '</td></tr>';
    }).join(''));
  }

  /* =======================================================================
   * 概览指标 + 数据一致性自检
   * ===================================================================== */
  function renderOverview() {
    var stats = data.stats;
    var recordCount = data.canteens.length + data.dishes.length + data.notices.length;
    $('#an-records').text(U.int(recordCount));
    $('#an-sources').html('食堂 ' + data.canteens.length + ' + 菜品 ' + data.dishes.length +
      ' + 公告 ' + data.notices.length + ' + 统计分区 5');

    var points = 0;
    Object.keys(stats.traffic).forEach(function (k) {
      points += stats.traffic[k].hourly.length + stats.traffic[k].hourlyWeekend.length;
    });
    points += stats.trends.labels.length * stats.trends.series.length;
    points += stats.weeklyVisits.labels.length * data.canteens.length;
    points += stats.satisfaction.dimensions.length * Object.keys(stats.satisfaction.radar).length;
    points += stats.nutrition.items.length * 5;
    $('#an-points').text(U.int(points));
    $('#an-points-sub').text('客流 ' + stats.meta.hours.length + ' 时段 × 2 类日期 × 3 食堂 等');
  }

  function load(retry) {
    $('#cc-analytics-alert').empty();
    CC.api.loadAll(['canteens', 'dishes', 'stats', 'notices']).then(function (results) {
      var failure = CC.api.firstFailure(results);
      if (failure) {
        CC.api.renderError('#cc-analytics-alert', failure.name, failure.error, function () { load(true); });
        destroyAll();
        CC.ui.emptyState('#chart-trend', { icon: 'bar-chart', title: '图表不可用', message: '数据未加载成功，解决上方错误后点击“重新加载”。' });
        return;
      }
      data.canteens = results[0].data.list;
      data.dishes = results[1].data.list;
      data.stats = results[2].data;
      data.notices = results[3].data.list;
      data.canteens.forEach(function (c) { canteenName[c.id] = c.name; });

      destroyAll();
      renderOverview();
      renderTrend();
      renderCategory();
      renderScatter();
      renderPrice();
      renderHourly();
      renderNutrition();
      renderTables();
      CC.api.renderModeBadge('#cc-data-mode');
    });
  }

  CC.ready(function ($) {
    CC.uiKit.mount({ cart: true });
    CC.uiKit.ensureModeBanner();
    load(false);

    // 图表 1：数据范围 / 引擎切换
    $('[data-trend]').on('click', function () {
      state.trendScope = $(this).data('trend');
      $('[data-trend]').removeClass('active');
      $(this).addClass('active');
      renderTrend();
    });
    $('#cc-engine-echarts, #cc-engine-chartjs').on('click', function () {
      state.trendEngine = this.id === 'cc-engine-echarts' ? 'echarts' : 'chartjs';
      $('#cc-engine-echarts, #cc-engine-chartjs').removeClass('active');
      $(this).addClass('active');
      if (handles.trend) { handles.trend.destroy(); delete handles.trend; }
      renderTrend();
      CC.ui.toast('图表 1 已改用 ' + (state.trendEngine === 'echarts' ? 'ECharts' : 'Chart.js') +
        ' 渲染，数据完全相同，可对比两库的默认样式差异。', 'info', 3600);
    });

    $('#chart5-daytype').on('change', function () {
      state.dayType = $(this).val();
      renderHourly();
    });

    $('#chart6-metric').on('change', function () {
      state.nutriMetric = $(this).val();
      if (handles.nutrition) { handles.nutrition.destroy(); delete handles.nutrition; }
      renderNutrition();
    });

    $('#cc-reload-analytics').on('click', function () {
      CC.api.clearCache();
      load(true);
      CC.ui.toast('已重新请求数据并重绘全部图表。', 'info', 2400);
    });

    $(document).on('cc:reload-data', function () { load(true); });
    $(document).on('cc:theme-changed', function () {
      // 主题切换后重建图表，套用新的坐标轴与文字颜色
      destroyAll();
      renderTrend(); renderCategory(); renderScatter(); renderPrice();
      renderHourly(); renderNutrition();
    });

    CC.uiKit.mountDebugPanel('#cc-debug-panel');
  });
})(jQuery, window.CC);
