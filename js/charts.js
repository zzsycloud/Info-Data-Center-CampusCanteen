/*
 * charts.js —— 图表统一门面（Facade）
 * 目标：页面只调用 CC.charts.*，不关心底层用的是 ECharts 还是 Chart.js，
 *       并且在第三方库加载失败时，自动降级到内置 Canvas 绘制器，保证图表区域不空白。
 *
 * 对外接口：
 *   CC.charts.lib('echarts') / lib('chartjs')   —— 取底层库对象，取不到返回 null
 *   CC.charts.available()                        —— { echarts:bool, chartjs:bool, degraded:bool }
 *   CC.charts.init(target, kind, option, opts)   —— 统一初始化，返回句柄 {update, resize, destroy, engine}
 *   CC.charts.resizeAll()                        —— 批量自适应
 */
window.CC = window.CC || {};

window.CC.charts = (function ($, CC) {
  'use strict';

  var registry = [];   // 所有已创建的图表句柄，用于统一 resize
  var palette = (CC.cfg && CC.cfg.charts && CC.cfg.charts.palette) || ['#2f7fd6', '#e0762b', '#3fa36b'];
  var fontFamily = (CC.cfg && CC.cfg.charts && CC.cfg.charts.fontFamily) || 'sans-serif';

  /* =======================================================================
   * 0. 降级容器：统一处理 canvas 尺寸与高清屏
   * ===================================================================== */
  function prepareCanvas($el) {
    var el = $el.get(0);
    if (!el) return null;
    // ECharts 会在容器内自己建 canvas；降级模式下我们自己建
    $el.find('canvas.cc-fallback-canvas').remove();
    var canvas = document.createElement('canvas');
    canvas.className = 'cc-fallback-canvas';
    canvas.setAttribute('role', 'img');
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(240, el.clientWidth || 480);
    var h = Math.max(200, el.clientHeight || 300);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    el.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas: canvas, ctx: ctx, w: w, h: h };
  }

  /* =======================================================================
   * 1. 简易 Canvas 绘图器（只在第三方库不可用时启用）
   *    支持：柱状图 bar / 折线图 line / 面积图 area / 饼图 pie / 环形图 doughnut
   *         散点图 scatter / 雷达图 radar
   * ===================================================================== */
  var draw = {
    text: function (ctx, str, x, y, opt) {
      var o = opt || {};
      ctx.save();
      ctx.font = (o.bold ? 'bold ' : '') + (o.size || 12) + 'px ' + fontFamily;
      ctx.fillStyle = o.color || '#4a5568';
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'middle';
      ctx.fillText(String(str), x, y);
      ctx.restore();
    },

    axisBox: function (ctx, w, h, pad) {
      return { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    },

    grid: function (ctx, box, yMax, yMin, yLabel, xLabels) {
      var steps = 5;
      ctx.save();
      ctx.strokeStyle = 'rgba(120,140,170,.22)';
      ctx.fillStyle = '#7b8794';
      ctx.lineWidth = 1;
      for (var i = 0; i <= steps; i++) {
        var y = box.y + (box.h * i) / steps;
        ctx.beginPath();
        ctx.moveTo(box.x, y);
        ctx.lineTo(box.x + box.w, y);
        ctx.stroke();
        var val = yMax - ((yMax - yMin) * i) / steps;
        draw.text(ctx, draw.fmt(val), box.x - 8, y, { align: 'right', size: 11 });
      }
      if (yLabel) draw.text(ctx, yLabel, box.x - 42, box.y - 12, { size: 11, color: '#9aa5b1' });
      // x 轴标签按间隔抽样，避免拥挤
      var step = Math.ceil(xLabels.length / 8);
      for (var k = 0; k < xLabels.length; k += step) {
        var cx = box.x + (box.w * (k + 0.5)) / xLabels.length;
        draw.text(ctx, xLabels[k], cx, box.y + box.h + 16, { align: 'center', size: 11 });
      }
      ctx.restore();
    },

    fmt: function (v) {
      var n = Number(v);
      if (!isFinite(n)) return '';
      if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万';
      if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
      return Math.abs(n % 1) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
    },

    bar: function (ctx, box, series, xLabels, colors) {
      var maxV = 0;
      series.forEach(function (s) { maxV = Math.max(maxV, Math.max.apply(null, s.data.concat([0]))); });
      maxV = maxV * 1.15 || 1;
      draw.grid(ctx, box, maxV, 0, '', xLabels);
      var groupW = box.w / xLabels.length;
      var barW = Math.max(3, (groupW * 0.7) / series.length);
      series.forEach(function (s, si) {
        ctx.fillStyle = s.color || colors[si % colors.length];
        s.data.forEach(function (v, i) {
          var bh = (Number(v) / maxV) * box.h;
          var bx = box.x + groupW * i + (groupW - barW * series.length) / 2 + barW * si;
          draw.roundRect(ctx, bx, box.y + box.h - bh, barW - 2, bh, 3);
        });
      });
    },

    line: function (ctx, box, series, xLabels, colors, area) {
      var maxV = 0;
      series.forEach(function (s) { maxV = Math.max(maxV, Math.max.apply(null, s.data.concat([0]))); });
      maxV = maxV * 1.15 || 1;
      draw.grid(ctx, box, maxV, 0, '', xLabels);
      series.forEach(function (s, si) {
        ctx.strokeStyle = s.color || colors[si % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        s.data.forEach(function (v, i) {
          var px = box.x + (box.w * (i + 0.5)) / s.data.length;
          var py = box.y + box.h - (Number(v) / maxV) * box.h;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        if (area) {
          ctx.save();
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = s.color || colors[si % colors.length];
          ctx.lineTo(box.x + box.w - box.w / (2 * s.data.length), box.y + box.h);
          ctx.lineTo(box.x + box.w / (2 * s.data.length), box.y + box.h);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = s.color || colors[si % colors.length];
        s.data.forEach(function (v, i) {
          var px = box.x + (box.w * (i + 0.5)) / s.data.length;
          var py = box.y + box.h - (Number(v) / maxV) * box.h;
          ctx.beginPath();
          ctx.arc(px, py, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    },

    pie: function (ctx, box, items, colors, doughnut) {
      var total = items.reduce(function (a, b) { return a + Number(b.value || 0); }, 0) || 1;
      var cx = box.x + box.w / 2;
      var cy = box.y + box.h / 2;
      var r = Math.min(box.w, box.h) / 2 - 12;
      var start = -Math.PI / 2;
      items.forEach(function (it, i) {
        var angle = (Number(it.value) / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = it.color || colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (angle > 0.28) {
          var mid = start + angle / 2;
          draw.text(ctx, it.name + ' ' + Math.round((it.value / total) * 100) + '%',
            cx + Math.cos(mid) * r * 0.62, cy + Math.sin(mid) * r * 0.62,
            { align: 'center', size: 10, color: '#fff', bold: true });
        }
        start += angle;
      });
      if (doughnut) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fill();
        draw.text(ctx, String(total), cx, cy - 6, { align: 'center', size: 16, bold: true, color: '#2d3748' });
        draw.text(ctx, '合计', cx, cy + 12, { align: 'center', size: 11 });
      }
    },

    scatter: function (ctx, box, points, colors) {
      var xs = points.map(function (p) { return p[0]; });
      var ys = points.map(function (p) { return p[1]; });
      var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
      var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
      var padX = (xMax - xMin) * 0.1 || 1;
      var padY = (yMax - yMin) * 0.1 || 0.2;
      xMin -= padX; xMax += padX; yMin -= padY; yMax += padY;
      var xLabels = [];
      for (var i = 0; i <= 5; i++) xLabels.push((xMin + ((xMax - xMin) * i) / 5).toFixed(1));
      draw.grid(ctx, box, yMax, yMin, '', xLabels);
      var rMax = Math.max.apply(null, points.map(function (p) { return p[2] || 1; })) || 1;
      points.forEach(function (p, i) {
        var px = box.x + ((p[0] - xMin) / (xMax - xMin)) * box.w;
        var py = box.y + box.h - ((p[1] - yMin) / (yMax - yMin)) * box.h;
        var r = 3 + 9 * Math.sqrt((p[2] || 1) / rMax);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = (p[3] || colors[i % colors.length]);
        ctx.globalAlpha = 0.72;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    },

    radar: function (ctx, box, indicators, series, colors) {
      var cx = box.x + box.w / 2;
      var cy = box.y + box.h / 2 + 4;
      var r = Math.min(box.w, box.h) / 2 - 26;
      var n = indicators.length;
      function point(i, ratio) {
        var a = -Math.PI / 2 + (Math.PI * 2 * i) / n;
        return [cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio];
      }
      // 网格
      for (var g = 1; g <= 4; g++) {
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var p = point(i, g / 4);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(120,140,170,.28)';
        ctx.stroke();
      }
      for (var k = 0; k < n; k++) {
        var e = point(k, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(e[0], e[1]);
        ctx.strokeStyle = 'rgba(120,140,170,.28)';
        ctx.stroke();
        var lp = point(k, 1.18);
        draw.text(ctx, indicators[k].name, lp[0], lp[1], { align: 'center', size: 10 });
      }
      series.forEach(function (s, si) {
        ctx.beginPath();
        s.data.forEach(function (v, i) {
          var p = point(i, Math.max(0.02, Number(v) / 100));
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        var col = s.color || colors[si % colors.length];
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    },

    roundRect: function (ctx, x, y, w, h, r) {
      var rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
      ctx.fill();
    },

    legend: function (ctx, w, items) {
      var x = 12;
      var y = 12;
      ctx.save();
      ctx.font = '11px ' + fontFamily;
      items.forEach(function (it) {
        var label = it.name + (it.value !== undefined ? '（' + it.value + '）' : '');
        var textW = ctx.measureText ? ctx.measureText(label).width : String(label).length * 7;
        ctx.fillStyle = it.color;
        ctx.fillRect(x, y - 5, 10, 10);
        draw.text(ctx, label, x + 14, y, { size: 11 });
        x += 24 + textW;
        if (x > w - 60) { x = 12; y += 16; }
      });
      ctx.restore();
    }
  };

  /* =======================================================================
   * 2. ECharts 降级替身（实现 init / setOption 等被用到的子集）
   * ===================================================================== */
  function makeEchartsStub() {
    function Chart(el) {
      this.el = $(el);
      this.option = null;
      this.kind = '';
    }
    Chart.prototype.setOption = function (option) {
      this.option = option || {};
      this.render();
      return this;
    };
    Chart.prototype.resize = function () {
      this.render();
      return this;
    };
    Chart.prototype.dispose = function () {
      this.el.find('canvas.cc-fallback-canvas').remove();
      this.dead = true;
    };
    Chart.prototype.render = function () {
      if (this.dead) return;
      var c = prepareCanvas(this.el);
      if (!c) return;
      var ctx = c.ctx;
      ctx.clearRect(0, 0, c.w, c.h);
      var o = this.option || {};
      var pad = { l: 52, t: 28, r: 18, b: 34 };
      if (o.title && o.title.text) {
        draw.text(ctx, o.title.text, 12, 12, { size: 13, bold: true, color: '#2d3748' });
        pad.t = 36;
      }
      var box = draw.axisBox(ctx, c.w, c.h, pad);
      var series = o.series || [];
      var legendItems = [];
      var type = series[0] ? series[0].type : 'bar';

      if (type === 'pie' || type === 'doughnut') {
        var data = (series[0].data || []).map(function (it, i) {
          return { name: it.name, value: it.value, color: it.itemStyle && it.itemStyle.color ? it.itemStyle.color : palette[i % palette.length] };
        });
        draw.pie(ctx, draw.axisBox(ctx, c.w, c.h, { l: 8, t: 34, r: 8, b: 26 }), data, palette, type === 'doughnut');
        legendItems = data.map(function (d) { return { name: d.name, color: d.color, value: d.value }; });
        draw.legend(ctx, c.w, legendItems.slice(0, 6));
        return;
      }
      if (type === 'radar') {
        var ind = (o.radar && o.radar[0] && o.radar[0].indicator) || [];
        var sr = series.map(function (s, i) {
          return { name: s.name, data: (s.data[0] && s.data[0].value) || [], color: palette[i % palette.length] };
        });
        draw.radar(ctx, draw.axisBox(ctx, c.w, c.h, { l: 60, t: 40, r: 60, b: 30 }), ind, sr, palette);
        draw.legend(ctx, c.w, sr.map(function (s) { return { name: s.name, color: s.color }; }));
        return;
      }
      if (type === 'scatter') {
        var pts = (series[0].data || []).map(function (p, i) {
          return [Number(p[0]), Number(p[1]), Number(p[2] || 1), palette[i % palette.length]];
        });
        draw.scatter(ctx, box, pts, palette);
        return;
      }
      var xLabels = (o.xAxis && o.xAxis[0] && o.xAxis[0].data) || [];
      var srs = series.map(function (s, i) {
        return {
          name: s.name,
          data: (s.data || []).map(function (v) { return typeof v === 'object' && v ? v.value : v; }),
          color: (s.itemStyle && s.itemStyle.color) || palette[i % palette.length],
          type: s.type
        };
      });
      if (srs.length && srs[0].type === 'line') {
        draw.line(ctx, box, srs, xLabels, palette, o.__area === true);
      } else {
        draw.bar(ctx, box, srs, xLabels, palette);
      }
      legendItems = srs.map(function (s) { return { name: s.name, color: s.color }; });
      draw.legend(ctx, c.w, legendItems);
    };
    return {
      init: function (el) { return new Chart(el); },
      connect: function () {},
      dispose: function (inst) { if (inst && inst.dispose) inst.dispose(); },
      __degraded: true
    };
  }

  /* =======================================================================
   * 3. Chart.js 降级替身
   * ===================================================================== */
  function makeChartJsStub() {
    function Chart(ctxOrEl, config) {
      this.el = $(ctxOrEl && ctxOrEl.canvas ? ctxOrEl.canvas.parentNode : ctxOrEl);
      this.config = config || {};
      this.data = this.config.data || {};
      this.render();
    }
    Chart.prototype.update = function (patch) {
      // 对齐真实 Chart.js 语义：update({data}) 只替换数据，不清空 type 等配置
      if (patch && patch.data) this.data = patch.data;
      if (patch && patch.type) this.config.type = patch.type;
      this.render();
      return this;
    };
    Chart.prototype.resize = function () { this.render(); return this; };
    Chart.prototype.destroy = function () {
      this.el.find('canvas.cc-fallback-canvas').remove();
      this.dead = true;
    };
    Chart.prototype.render = function () {
      if (this.dead) return;
      var c = prepareCanvas(this.el);
      if (!c) return;
      var ctx = c.ctx;
      ctx.clearRect(0, 0, c.w, c.h);
      var type = this.config.type || 'line';
      var labels = this.data.labels || [];
      var ds = this.data.datasets || [];
      var pad = { l: 54, t: 30, r: 18, b: 40 };
      var title = this.config.options && this.config.options.plugins && this.config.options.plugins.title;
      if (title && title.text) {
        draw.text(ctx, title.text, 12, 12, { size: 13, bold: true, color: '#2d3748' });
        pad.t = 38;
      }
      var box = draw.axisBox(ctx, c.w, c.h, pad);

      if (type === 'doughnut' || type === 'pie') {
        var items = labels.map(function (l, i) {
          var color = (ds[0].backgroundColor && ds[0].backgroundColor[i]) || palette[i % palette.length];
          return { name: l, value: ds[0].data[i], color: color };
        });
        draw.pie(ctx, draw.axisBox(ctx, c.w, c.h, { l: 8, t: 34, r: 8, b: 26 }), items, palette, type === 'doughnut');
        draw.legend(ctx, c.w, items.slice(0, 6));
        return;
      }
      if (type === 'radar') {
        var opts = this.config.options || {};
        var indNames = (opts.scales && opts.scales.r && opts.scales.r.__indicatorNames) || labels;
        var ind = indNames.map(function (l) { return { name: l, max: 100 }; });
        var sr = ds.map(function (d, i) {
          return { name: d.label, data: d.data, color: (d.borderColor) || palette[i % palette.length] };
        });
        draw.radar(ctx, draw.axisBox(ctx, c.w, c.h, { l: 62, t: 42, r: 62, b: 28 }), ind, sr, palette);
        draw.legend(ctx, c.w, sr.map(function (s) { return { name: s.name, color: s.color }; }));
        return;
      }
      var srs = ds.map(function (d, i) {
        return {
          name: d.label,
          data: d.data,
          color: d.borderColor || (typeof d.backgroundColor === 'string' ? d.backgroundColor : null) || palette[i % palette.length]
        };
      });
      if (type === 'bar') draw.bar(ctx, box, srs, labels, palette);
      else draw.line(ctx, box, srs, labels, palette, type === 'line' && ds.some(function (d) { return d.fill; }));
      draw.legend(ctx, c.w, srs.map(function (s) { return { name: s.name, color: s.color }; }));
    };
    return { __degraded: true, Chart: Chart };
  }

  /* =======================================================================
   * 4. 库探测
   * ===================================================================== */
  var engines = {
    echarts: window.echarts && window.echarts.init ? window.echarts : makeEchartsStub(),
    chartjs: window.Chart && window.Chart.prototype ? window.Chart : makeChartJsStub().Chart
  };

  var degradedFlags = {
    echarts: !(window.echarts && window.echarts.init),
    chartjs: !(window.Chart && window.Chart.prototype)
  };

  function available() {
    return {
      echarts: !degradedFlags.echarts,
      chartjs: !degradedFlags.chartjs,
      degraded: degradedFlags.echarts || degradedFlags.chartjs
    };
  }

  /** 页面加载后检查一次，把降级情况明确告诉用户（错误提示完整性要求） */
  function checkLibraries() {
    var a = available();
    if (!a.degraded) return a;
    var missing = [];
    if (!a.echarts) missing.push('ECharts（vendor/echarts.min.js）');
    if (!a.chartjs) missing.push('Chart.js（vendor/chart.umd.min.js）');
    CC.ui.toast('图表库未能加载：' + missing.join('、') + '。已启用内置 Canvas 降级绘制，图形为简化版。', 'warning', 7000);
    $('#cc-chart-degrade-note').removeClass('d-none');
    return a;
  }

  /* =======================================================================
   * 5. 统一 init
   * ===================================================================== */
  function init(target, kind, option, opts) {
    var $el = target instanceof $ ? target : $(target);
    if (!$el.length) {
      return { engine: 'none', update: function () {}, resize: function () {}, destroy: function () {} };
    }
    var o = opts || {};
    var handle;

    if (kind === 'echarts') {
      var ec = engines.echarts;
      var inst = ec.init($el.get(0), null, { renderer: 'canvas' });
      if (option) {
        if (o.area) option.__area = true;
        inst.setOption(option);
      }
      handle = {
        engine: degradedFlags.echarts ? 'canvas-fallback' : 'echarts',
        raw: inst,
        update: function (next) { inst.setOption(next || option, true); },
        resize: function () { inst.resize(); },
        destroy: function () { try { inst.dispose(); } catch (e) { /* 已销毁 */ } }
      };
    } else if (kind === 'chartjs') {
      var Ctor = engines.chartjs;
      var instance = new Ctor($el.get(0), option);
      handle = {
        engine: degradedFlags.chartjs ? 'canvas-fallback' : 'chartjs',
        raw: instance,
        update: function (next) {
          if (next && next.data) {
            instance.data = next.data;
            if (next.type && instance.config) instance.config.type = next.type;
          }
          instance.update();
        },
        resize: function () { if (instance.resize) instance.resize(); },
        destroy: function () { try { instance.destroy(); } catch (e) { /* 已销毁 */ } }
      };
    } else {
      throw new Error('不支持的图表引擎：' + kind);
    }

    registry.push(handle);
    return handle;
  }

  var resizeAll = CC.utils.debounce(function () {
    registry.forEach(function (h) {
      try { h.resize(); } catch (e) { /* 单个图表 resize 失败不影响其他图表 */ }
    });
  }, 220);

  $(window).on('resize orientationchange', resizeAll);
  $(document).on('cc:theme-changed', resizeAll);

  return {
    lib: function (name) { return engines[name] || null; },
    available: available,
    checkLibraries: checkLibraries,
    init: init,
    resizeAll: resizeAll,
    palette: palette,
    /** 便捷：生成 ECharts 通用主题片段 */
    baseOption: function (title) {
      return {
        color: palette,
        textStyle: { fontFamily: fontFamily },
        title: title ? { text: title, left: 8, top: 4, textStyle: { fontSize: 14, color: '#2d3748' } } : undefined,
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 56, right: 22, top: title ? 52 : 30, bottom: 42 },
        legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 }
      };
    },
    destroyed: function (h) { registry = registry.filter(function (x) { return x !== h; }); }
  };
})(jQuery, window.CC);
/*
 * charts.js —— 图表统一门面（Facade）
 * 目标：页面只调用 CC.charts.*，不关心底层用的是 ECharts 还是 Chart.js，
 *       并且在第三方库加载失败时，自动降级到内置 Canvas 绘制器，保证图表区域不空白。
 *
 * 对外接口：
 *   CC.charts.lib('echarts') / lib('chartjs')   —— 取底层库对象，取不到返回 null
 *   CC.charts.available()                        —— { echarts:bool, chartjs:bool, degraded:bool }
 *   CC.charts.init(target, kind, option, opts)   —— 统一初始化，返回句柄 {update, resize, destroy, engine}
 *   CC.charts.resizeAll()                        —— 批量自适应
 */
window.CC = window.CC || {};

window.CC.charts = (function ($, CC) {
  'use strict';

  var registry = [];   // 所有已创建的图表句柄，用于统一 resize
  var palette = (CC.cfg && CC.cfg.charts && CC.cfg.charts.palette) || ['#2f7fd6', '#e0762b', '#3fa36b'];
  var fontFamily = (CC.cfg && CC.cfg.charts && CC.cfg.charts.fontFamily) || 'sans-serif';

  /* =======================================================================
   * 0. 降级容器：统一处理 canvas 尺寸与高清屏
   * ===================================================================== */
  function prepareCanvas($el) {
    var el = $el.get(0);
    if (!el) return null;
    // ECharts 会在容器内自己建 canvas；降级模式下我们自己建
    $el.find('canvas.cc-fallback-canvas').remove();
    var canvas = document.createElement('canvas');
    canvas.className = 'cc-fallback-canvas';
    canvas.setAttribute('role', 'img');
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(240, el.clientWidth || 480);
    var h = Math.max(200, el.clientHeight || 300);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    el.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas: canvas, ctx: ctx, w: w, h: h };
  }

  /* =======================================================================
   * 1. 简易 Canvas 绘图器（只在第三方库不可用时启用）
   *    支持：柱状图 bar / 折线图 line / 面积图 area / 饼图 pie / 环形图 doughnut
   *         散点图 scatter / 雷达图 radar
   * ===================================================================== */
  var draw = {
    text: function (ctx, str, x, y, opt) {
      var o = opt || {};
      ctx.save();
      ctx.font = (o.bold ? 'bold ' : '') + (o.size || 12) + 'px ' + fontFamily;
      ctx.fillStyle = o.color || '#4a5568';
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'middle';
      ctx.fillText(String(str), x, y);
      ctx.restore();
    },

    axisBox: function (ctx, w, h, pad) {
      return { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    },

    grid: function (ctx, box, yMax, yMin, yLabel, xLabels) {
      var steps = 5;
      ctx.save();
      ctx.strokeStyle = 'rgba(120,140,170,.22)';
      ctx.fillStyle = '#7b8794';
      ctx.lineWidth = 1;
      for (var i = 0; i <= steps; i++) {
        var y = box.y + (box.h * i) / steps;
        ctx.beginPath();
        ctx.moveTo(box.x, y);
        ctx.lineTo(box.x + box.w, y);
        ctx.stroke();
        var val = yMax - ((yMax - yMin) * i) / steps;
        draw.text(ctx, draw.fmt(val), box.x - 8, y, { align: 'right', size: 11 });
      }
      if (yLabel) draw.text(ctx, yLabel, box.x - 42, box.y - 12, { size: 11, color: '#9aa5b1' });
      // x 轴标签按间隔抽样，避免拥挤
      var step = Math.ceil(xLabels.length / 8);
      for (var k = 0; k < xLabels.length; k += step) {
        var cx = box.x + (box.w * (k + 0.5)) / xLabels.length;
        draw.text(ctx, xLabels[k], cx, box.y + box.h + 16, { align: 'center', size: 11 });
      }
      ctx.restore();
    },

    fmt: function (v) {
      var n = Number(v);
      if (!isFinite(n)) return '';
      if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万';
      if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
      return Math.abs(n % 1) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
    },

    bar: function (ctx, box, series, xLabels, colors) {
      var maxV = 0;
      series.forEach(function (s) { maxV = Math.max(maxV, Math.max.apply(null, s.data.concat([0]))); });
      maxV = maxV * 1.15 || 1;
      draw.grid(ctx, box, maxV, 0, '', xLabels);
      var groupW = box.w / xLabels.length;
      var barW = Math.max(3, (groupW * 0.7) / series.length);
      series.forEach(function (s, si) {
        ctx.fillStyle = s.color || colors[si % colors.length];
        s.data.forEach(function (v, i) {
          var bh = (Number(v) / maxV) * box.h;
          var bx = box.x + groupW * i + (groupW - barW * series.length) / 2 + barW * si;
          draw.roundRect(ctx, bx, box.y + box.h - bh, barW - 2, bh, 3);
        });
      });
    },

    line: function (ctx, box, series, xLabels, colors, area) {
      var maxV = 0;
      series.forEach(function (s) { maxV = Math.max(maxV, Math.max.apply(null, s.data.concat([0]))); });
      maxV = maxV * 1.15 || 1;
      draw.grid(ctx, box, maxV, 0, '', xLabels);
      series.forEach(function (s, si) {
        ctx.strokeStyle = s.color || colors[si % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        s.data.forEach(function (v, i) {
          var px = box.x + (box.w * (i + 0.5)) / s.data.length;
          var py = box.y + box.h - (Number(v) / maxV) * box.h;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        if (area) {
          ctx.save();
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = s.color || colors[si % colors.length];
          ctx.lineTo(box.x + box.w - box.w / (2 * s.data.length), box.y + box.h);
          ctx.lineTo(box.x + box.w / (2 * s.data.length), box.y + box.h);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = s.color || colors[si % colors.length];
        s.data.forEach(function (v, i) {
          var px = box.x + (box.w * (i + 0.5)) / s.data.length;
          var py = box.y + box.h - (Number(v) / maxV) * box.h;
          ctx.beginPath();
          ctx.arc(px, py, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    },

    pie: function (ctx, box, items, colors, doughnut) {
      var total = items.reduce(function (a, b) { return a + Number(b.value || 0); }, 0) || 1;
      var cx = box.x + box.w / 2;
      var cy = box.y + box.h / 2;
      var r = Math.min(box.w, box.h) / 2 - 12;
      var start = -Math.PI / 2;
      items.forEach(function (it, i) {
        var angle = (Number(it.value) / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = it.color || colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (angle > 0.28) {
          var mid = start + angle / 2;
          draw.text(ctx, it.name + ' ' + Math.round((it.value / total) * 100) + '%',
            cx + Math.cos(mid) * r * 0.62, cy + Math.sin(mid) * r * 0.62,
            { align: 'center', size: 10, color: '#fff', bold: true });
        }
        start += angle;
      });
      if (doughnut) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fill();
        draw.text(ctx, String(total), cx, cy - 6, { align: 'center', size: 16, bold: true, color: '#2d3748' });
        draw.text(ctx, '合计', cx, cy + 12, { align: 'center', size: 11 });
      }
    },

    scatter: function (ctx, box, points, colors) {
      var xs = points.map(function (p) { return p[0]; });
      var ys = points.map(function (p) { return p[1]; });
      var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
      var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
      var padX = (xMax - xMin) * 0.1 || 1;
      var padY = (yMax - yMin) * 0.1 || 0.2;
      xMin -= padX; xMax += padX; yMin -= padY; yMax += padY;
      var xLabels = [];
      for (var i = 0; i <= 5; i++) xLabels.push((xMin + ((xMax - xMin) * i) / 5).toFixed(1));
      draw.grid(ctx, box, yMax, yMin, '', xLabels);
      var rMax = Math.max.apply(null, points.map(function (p) { return p[2] || 1; })) || 1;
      points.forEach(function (p, i) {
        var px = box.x + ((p[0] - xMin) / (xMax - xMin)) * box.w;
        var py = box.y + box.h - ((p[1] - yMin) / (yMax - yMin)) * box.h;
        var r = 3 + 9 * Math.sqrt((p[2] || 1) / rMax);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = (p[3] || colors[i % colors.length]);
        ctx.globalAlpha = 0.72;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    },

    radar: function (ctx, box, indicators, series, colors) {
      var cx = box.x + box.w / 2;
      var cy = box.y + box.h / 2 + 4;
      var r = Math.min(box.w, box.h) / 2 - 26;
      var n = indicators.length;
      function point(i, ratio) {
        var a = -Math.PI / 2 + (Math.PI * 2 * i) / n;
        return [cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio];
      }
      // 网格
      for (var g = 1; g <= 4; g++) {
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var p = point(i, g / 4);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(120,140,170,.28)';
        ctx.stroke();
      }
      for (var k = 0; k < n; k++) {
        var e = point(k, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(e[0], e[1]);
        ctx.strokeStyle = 'rgba(120,140,170,.28)';
        ctx.stroke();
        var lp = point(k, 1.18);
        draw.text(ctx, indicators[k].name, lp[0], lp[1], { align: 'center', size: 10 });
      }
      series.forEach(function (s, si) {
        ctx.beginPath();
        s.data.forEach(function (v, i) {
          var p = point(i, Math.max(0.02, Number(v) / 100));
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        var col = s.color || colors[si % colors.length];
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    },

    roundRect: function (ctx, x, y, w, h, r) {
      var rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
      ctx.fill();
    },

    legend: function (ctx, w, items) {
      var x = 12;
      var y = 12;
      ctx.save();
      ctx.font = '11px ' + fontFamily;
      items.forEach(function (it) {
        var label = it.name + (it.value !== undefined ? '（' + it.value + '）' : '');
        var textW = ctx.measureText ? ctx.measureText(label).width : String(label).length * 7;
        ctx.fillStyle = it.color;
        ctx.fillRect(x, y - 5, 10, 10);
        draw.text(ctx, label, x + 14, y, { size: 11 });
        x += 24 + textW;
        if (x > w - 60) { x = 12; y += 16; }
      });
      ctx.restore();
    }
  };

  /* =======================================================================
   * 2. ECharts 降级替身（实现 init / setOption 等被用到的子集）
   * ===================================================================== */
  function makeEchartsStub() {
    function Chart(el) {
      this.el = $(el);
      this.option = null;
      this.kind = '';
    }
    Chart.prototype.setOption = function (option) {
      this.option = option || {};
      this.render();
      return this;
    };
    Chart.prototype.resize = function () {
      this.render();
      return this;
    };
    Chart.prototype.dispose = function () {
      this.el.find('canvas.cc-fallback-canvas').remove();
      this.dead = true;
    };
    Chart.prototype.render = function () {
      if (this.dead) return;
      var c = prepareCanvas(this.el);
      if (!c) return;
      var ctx = c.ctx;
      ctx.clearRect(0, 0, c.w, c.h);
      var o = this.option || {};
      var pad = { l: 52, t: 28, r: 18, b: 34 };
      if (o.title && o.title.text) {
        draw.text(ctx, o.title.text, 12, 12, { size: 13, bold: true, color: '#2d3748' });
        pad.t = 36;
      }
      var box = draw.axisBox(ctx, c.w, c.h, pad);
      var series = o.series || [];
      var legendItems = [];
      var type = series[0] ? series[0].type : 'bar';

      if (type === 'pie' || type === 'doughnut') {
        var data = (series[0].data || []).map(function (it, i) {
          return { name: it.name, value: it.value, color: it.itemStyle && it.itemStyle.color ? it.itemStyle.color : palette[i % palette.length] };
        });
        draw.pie(ctx, draw.axisBox(ctx, c.w, c.h, { l: 8, t: 34, r: 8, b: 26 }), data, palette, type === 'doughnut');
        legendItems = data.map(function (d) { return { name: d.name, color: d.color, value: d.value }; });
        draw.legend(ctx, c.w, legendItems.slice(0, 6));
        return;
      }
      if (type === 'radar') {
        var ind = (o.radar && o.radar[0] && o.radar[0].indicator) || [];
        var sr = series.map(function (s, i) {
          return { name: s.name, data: (s.data[0] && s.data[0].value) || [], color: palette[i % palette.length] };
        });
        draw.radar(ctx, draw.axisBox(ctx, c.w, c.h, { l: 60, t: 40, r: 60, b: 30 }), ind, sr, palette);
        draw.legend(ctx, c.w, sr.map(function (s) { return { name: s.name, color: s.color }; }));
        return;
      }
      if (type === 'scatter') {
        var pts = (series[0].data || []).map(function (p, i) {
          return [Number(p[0]), Number(p[1]), Number(p[2] || 1), palette[i % palette.length]];
        });
        draw.scatter(ctx, box, pts, palette);
        return;
      }
      var xLabels = (o.xAxis && o.xAxis[0] && o.xAxis[0].data) || [];
      var srs = series.map(function (s, i) {
        return {
          name: s.name,
          data: (s.data || []).map(function (v) { return typeof v === 'object' && v ? v.value : v; }),
          color: (s.itemStyle && s.itemStyle.color) || palette[i % palette.length],
          type: s.type
        };
      });
      if (srs.length && srs[0].type === 'line') {
        draw.line(ctx, box, srs, xLabels, palette, o.__area === true);
      } else {
        draw.bar(ctx, box, srs, xLabels, palette);
      }
      legendItems = srs.map(function (s) { return { name: s.name, color: s.color }; });
      draw.legend(ctx, c.w, legendItems);
    };
    return {
      init: function (el) { return new Chart(el); },
      connect: function () {},
      dispose: function (inst) { if (inst && inst.dispose) inst.dispose(); },
      __degraded: true
    };
  }

  /* =======================================================================
   * 3. Chart.js 降级替身
   * ===================================================================== */
  function makeChartJsStub() {
    function Chart(ctxOrEl, config) {
      this.el = $(ctxOrEl && ctxOrEl.canvas ? ctxOrEl.canvas.parentNode : ctxOrEl);
      this.config = config || {};
      this.data = this.config.data || {};
      this.render();
    }
    Chart.prototype.update = function (patch) {
      // 对齐真实 Chart.js 语义：update({data}) 只替换数据，不清空 type 等配置
      if (patch && patch.data) this.data = patch.data;
      if (patch && patch.type) this.config.type = patch.type;
      this.render();
      return this;
    };
    Chart.prototype.resize = function () { this.render(); return this; };
    Chart.prototype.destroy = function () {
      this.el.find('canvas.cc-fallback-canvas').remove();
      this.dead = true;
    };
    Chart.prototype.render = function () {
      if (this.dead) return;
      var c = prepareCanvas(this.el);
      if (!c) return;
      var ctx = c.ctx;
      ctx.clearRect(0, 0, c.w, c.h);
      var type = this.config.type || 'line';
      var labels = this.data.labels || [];
      var ds = this.data.datasets || [];
      var pad = { l: 54, t: 30, r: 18, b: 40 };
      var title = this.config.options && this.config.options.plugins && this.config.options.plugins.title;
      if (title && title.text) {
        draw.text(ctx, title.text, 12, 12, { size: 13, bold: true, color: '#2d3748' });
        pad.t = 38;
      }
      var box = draw.axisBox(ctx, c.w, c.h, pad);

      if (type === 'doughnut' || type === 'pie') {
        var items = labels.map(function (l, i) {
          var color = (ds[0].backgroundColor && ds[0].backgroundColor[i]) || palette[i % palette.length];
          return { name: l, value: ds[0].data[i], color: color };
        });
        draw.pie(ctx, draw.axisBox(ctx, c.w, c.h, { l: 8, t: 34, r: 8, b: 26 }), items, palette, type === 'doughnut');
        draw.legend(ctx, c.w, items.slice(0, 6));
        return;
      }
      if (type === 'radar') {
        var opts = this.config.options || {};
        var indNames = (opts.scales && opts.scales.r && opts.scales.r.__indicatorNames) || labels;
        var ind = indNames.map(function (l) { return { name: l, max: 100 }; });
        var sr = ds.map(function (d, i) {
          return { name: d.label, data: d.data, color: (d.borderColor) || palette[i % palette.length] };
        });
        draw.radar(ctx, draw.axisBox(ctx, c.w, c.h, { l: 62, t: 42, r: 62, b: 28 }), ind, sr, palette);
        draw.legend(ctx, c.w, sr.map(function (s) { return { name: s.name, color: s.color }; }));
        return;
      }
      var srs = ds.map(function (d, i) {
        return {
          name: d.label,
          data: d.data,
          color: d.borderColor || (typeof d.backgroundColor === 'string' ? d.backgroundColor : null) || palette[i % palette.length]
        };
      });
      if (type === 'bar') draw.bar(ctx, box, srs, labels, palette);
      else draw.line(ctx, box, srs, labels, palette, type === 'line' && ds.some(function (d) { return d.fill; }));
      draw.legend(ctx, c.w, srs.map(function (s) { return { name: s.name, color: s.color }; }));
    };
    return { __degraded: true, Chart: Chart };
  }

  /* =======================================================================
   * 4. 库探测
   * ===================================================================== */
  var engines = {
    echarts: window.echarts && window.echarts.init ? window.echarts : makeEchartsStub(),
    chartjs: window.Chart && window.Chart.prototype ? window.Chart : makeChartJsStub().Chart
  };

  var degradedFlags = {
    echarts: !(window.echarts && window.echarts.init),
    chartjs: !(window.Chart && window.Chart.prototype)
  };

  function available() {
    return {
      echarts: !degradedFlags.echarts,
      chartjs: !degradedFlags.chartjs,
      degraded: degradedFlags.echarts || degradedFlags.chartjs
    };
  }

  /** 页面加载后检查一次，把降级情况明确告诉用户（错误提示完整性要求） */
  function checkLibraries() {
    var a = available();
    if (!a.degraded) return a;
    var missing = [];
    if (!a.echarts) missing.push('ECharts（vendor/echarts.min.js）');
    if (!a.chartjs) missing.push('Chart.js（vendor/chart.umd.min.js）');
    CC.ui.toast('图表库未能加载：' + missing.join('、') + '。已启用内置 Canvas 降级绘制，图形为简化版。', 'warning', 7000);
    $('#cc-chart-degrade-note').removeClass('d-none');
    return a;
  }

  /* =======================================================================
   * 5. 统一 init
   * ===================================================================== */
  function init(target, kind, option, opts) {
    var $el = target instanceof $ ? target : $(target);
    if (!$el.length) {
      return { engine: 'none', update: function () {}, resize: function () {}, destroy: function () {} };
    }
    var o = opts || {};
    var handle;

    if (kind === 'echarts') {
      var ec = engines.echarts;
      var inst = ec.init($el.get(0), null, { renderer: 'canvas' });
      if (option) {
        if (o.area) option.__area = true;
        inst.setOption(option);
      }
      handle = {
        engine: degradedFlags.echarts ? 'canvas-fallback' : 'echarts',
        raw: inst,
        update: function (next) { inst.setOption(next || option, true); },
        resize: function () { inst.resize(); },
        destroy: function () { try { inst.dispose(); } catch (e) { /* 已销毁 */ } }
      };
    } else if (kind === 'chartjs') {
      var Ctor = engines.chartjs;
      var instance = new Ctor($el.get(0), option);
      handle = {
        engine: degradedFlags.chartjs ? 'canvas-fallback' : 'chartjs',
        raw: instance,
        update: function (next) {
          if (next && next.data) {
            instance.data = next.data;
            if (next.type && instance.config) instance.config.type = next.type;
          }
          instance.update();
        },
        resize: function () { if (instance.resize) instance.resize(); },
        destroy: function () { try { instance.destroy(); } catch (e) { /* 已销毁 */ } }
      };
    } else {
      throw new Error('不支持的图表引擎：' + kind);
    }

    registry.push(handle);
    return handle;
  }

  var resizeAll = CC.utils.debounce(function () {
    registry.forEach(function (h) {
      try { h.resize(); } catch (e) { /* 单个图表 resize 失败不影响其他图表 */ }
    });
  }, 220);

  $(window).on('resize orientationchange', resizeAll);
  $(document).on('cc:theme-changed', resizeAll);

  return {
    lib: function (name) { return engines[name] || null; },
    available: available,
    checkLibraries: checkLibraries,
    init: init,
    resizeAll: resizeAll,
    palette: palette,
    /** 便捷：生成 ECharts 通用主题片段 */
    baseOption: function (title) {
      return {
        color: palette,
        textStyle: { fontFamily: fontFamily },
        title: title ? { text: title, left: 8, top: 4, textStyle: { fontSize: 14, color: '#2d3748' } } : undefined,
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 56, right: 22, top: title ? 52 : 30, bottom: 42 },
        legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 }
      };
    },
    destroyed: function (h) { registry = registry.filter(function (x) { return x !== h; }); }
  };
})(jQuery, window.CC);
