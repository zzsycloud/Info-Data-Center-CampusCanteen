/*
 * page-canteens.js —— 食堂档案页 + 菜品维护（增 / 改 / 删）
 * 图表：Chart.js 柱状图 + 折线图混合（分时段客流与排队时长），体现与 ECharts 的选型对比。
 */
(function ($, CC) {
  'use strict';

  var U = CC.utils;
  var data = { canteens: [], dishes: [], stats: null, userDishes: [], merged: [] };
  var currentId = null;
  var dayType = 'weekday';
  var trafficHandle = null;
  var manage = { page: 1, pageSize: 10, search: '', scope: 'current' };
  var form = { mode: 'create', id: null };

  /* =======================================================================
   * 1. 食堂标签页与档案
   * ===================================================================== */
  function renderTabs() {
    $('#cc-canteen-tabs').html(data.canteens.map(function (c) {
      var active = c.id === currentId ? ' active' : '';
      var selected = c.id === currentId ? 'true' : 'false';
      return '<li class="nav-item" role="presentation">' +
        '<button class="nav-link' + active + '" type="button" role="tab" aria-selected="' + selected + '" ' +
        'data-canteen-tab="' + U.esc(c.id) + '">' +
        '<span class="cc-scene-legend__dot me-1" style="background:' + U.esc(c.color) + '"></span>' + U.esc(c.name) +
        '</button></li>';
    }).join(''));
  }

  function renderProfile() {
    var c = null;
    data.canteens.forEach(function (x) { if (x.id === currentId) c = x; });
    if (!c) {
      CC.ui.emptyState('#cc-profile', { icon: 'shop', title: '未找到该食堂', message: '请从上方标签页重新选择。' });
      return;
    }
    var dishes = data.merged.filter(function (d) { return d.canteenId === c.id; });
    var avgPrice = dishes.length ? U.round(U.avg(dishes.map(function (d) { return d.price; })), 2) : 0;
    var avgRating = dishes.length ? U.round(U.avg(dishes.map(function (d) { return d.rating; })), 2) : 0;
    var totalSales = U.sum(dishes.map(function (d) { return d.monthlySales; }));
    var vegetarian = dishes.filter(function (d) { return d.vegetarian; }).length;

    $('#cc-profile').html(
      '<div class="d-flex justify-content-between align-items-start mb-2">' +
      '  <div>' +
      '    <h2 class="cc-card__title mb-0" style="font-size:1.15rem">' + U.esc(c.name) +
      '      <span class="cc-badge cc-badge--brand">' + U.esc(c.id) + '</span></h2>' +
      '    <div class="cc-hint">' + U.esc(c.brand) + ' · ' + U.esc(c.location) + '</div>' +
      '  </div>' +
      '  <div class="text-end">' + CC.ui.stars(c.rating) +
      '    <div class="cc-hint">共 ' + U.esc(String(c.floor)) + ' 层 · ' + U.esc(String(c.seats)) + ' 座位</div>' +
      '  </div>' +
      '</div>' +
      '<p class="mb-2" style="color:var(--cc-text-soft);font-size:.88rem">' + U.esc(c.description) + '</p>' +
      '<div class="cc-dish__meta mb-3">' + (c.tags || []).map(function (t) {
        return '<span class="cc-chip is-on" style="cursor:default">' + U.esc(t) + '</span>';
      }).join('') + '</div>' +
      '<dl class="row mb-0 g-0" style="font-size:.86rem">' +
      '  <dt class="col-4 cc-hint">营业时间</dt><dd class="col-8">' + (c.openHours || []).map(U.esc).join(' / ') + '</dd>' +
      '  <dt class="col-4 cc-hint">联系电话</dt><dd class="col-8">' + U.esc(c.contact) + '</dd>' +
      '  <dt class="col-4 cc-hint">档口数量</dt><dd class="col-8">' + U.esc(String(c.stallCount)) + ' 个</dd>' +
      '  <dt class="col-4 cc-hint">档案菜品数</dt><dd class="col-8">' + U.esc(String(c.dishCount)) + ' 道（本作品已收录 ' + dishes.length + ' 道）</dd>' +
      '  <dt class="col-4 cc-hint">档案人均消费</dt><dd class="col-8">' + U.money(c.avgPrice) + '</dd>' +
      '  <dt class="col-4 cc-hint">收录菜品均价</dt><dd class="col-8">' + U.money(avgPrice) +
      '    <span class="cc-hint">（由 dishes.json 实时折算，口径与档案人均不同）</span></dd>' +
      '  <dt class="col-4 cc-hint">收录菜品评分</dt><dd class="col-8">' + avgRating.toFixed(2) + ' 分</dd>' +
      '  <dt class="col-4 cc-hint">素食菜品</dt><dd class="col-8">' + vegetarian + ' 道（占 ' + U.percent(vegetarian, dishes.length) + '）</dd>' +
      '  <dt class="col-4 cc-hint">合计月销量</dt><dd class="col-8">' + U.int(totalSales) + ' 份</dd>' +
      '</dl>' +
      '<div class="d-flex gap-2 mt-3 flex-wrap">' +
      '  <a class="btn btn-sm btn-primary" href="dishes.html?canteen=' + encodeURIComponent(c.id) + '">' +
      '    <i class="bi bi-search"></i> 查询该食堂菜品</a>' +
      '  <a class="btn btn-sm btn-outline-secondary" href="scene3d.html?canteen=' + encodeURIComponent(c.id) + '">' +
      '    <i class="bi bi-badge-3d"></i> 三维中查看</a>' +
      '  <button class="btn btn-sm btn-outline-primary" type="button" data-quick-add="' + U.esc(c.id) + '">' +
      '    <i class="bi bi-plus-lg"></i> 为该食堂新增菜品</button>' +
      '</div>'
    );

    // 楼层分布：横向卡片排列，整行铺开更紧凑
    $('#cc-floor-list').html((c.floors || []).map(function (f) {
      var floorDishes = dishes.filter(function (d) { return (d.stall || '').indexOf(String(f.level)) > -1; });
      return '<div class="col-12 col-sm-6 col-lg-4 col-xxl-3">' +
        '  <div class="cc-floor-item">' +
        '    <div class="cc-floor-item__badge">' + U.esc(String(f.level)) + 'F</div>' +
        '    <div class="cc-floor-item__body">' +
        '      <div class="cc-floor-item__name">' + U.esc(f.name) + '</div>' +
        '      <div class="cc-hint">' + U.esc(String(f.stalls)) + ' 个档口' +
        (floorDishes.length ? ' · 已收录 ' + floorDishes.length + ' 道菜品' : '') +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }).join('') || '<div class="col-12"><p class="cc-hint mb-0">该食堂暂未分层。</p></div>');
  }

  /* =======================================================================
   * 2. Chart.js 客流 + 排队时长混合图
   * ===================================================================== */
  function renderTrafficChart() {
    if (!data.stats || !currentId) return;
    var stats = data.stats;
    var counts = dayType === 'weekend' ? stats.traffic[currentId].hourlyWeekend : stats.traffic[currentId].hourly;
    var waits = stats.waitMinutes[currentId];
    var canteen = null;
    data.canteens.forEach(function (c) { if (c.id === currentId) canteen = c; });

    var config = {
      type: 'bar',
      data: {
        labels: stats.meta.hours,
        datasets: [
          {
            label: '在店人数（人次/小时）',
            data: counts,
            backgroundColor: (canteen && canteen.color ? canteen.color : '#2f7fd6') + 'cc',
            borderColor: (canteen && canteen.color) || '#2f7fd6',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: '平均排队时长（分钟）',
            data: waits,
            type: 'line',
            borderColor: '#d94f6a',
            backgroundColor: 'rgba(217,79,106,.15)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 3,
            fill: false,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterBody: function (items) {
                if (!items || !items.length) return '';
                var i = items[0].dataIndex;
                var level = CC.derive.crowdLevel(counts[i]);
                return '拥挤度判定：' + level.label + '（阈值 300 / 700 / 1100）';
              }
            }
          },
          title: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: {
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: '人次', font: { size: 11 } },
            grid: { color: 'rgba(120,140,170,.18)' },
            ticks: { font: { size: 10 } }
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            title: { display: true, text: '分钟', font: { size: 11 } },
            grid: { drawOnChartArea: false },
            ticks: { font: { size: 10 } }
          }
        }
      }
    };

    if (trafficHandle) {
      trafficHandle.update(config);
    } else {
      trafficHandle = CC.charts.init('#cc-canteen-traffic-chart', 'chartjs', config);
    }

    var peak = U.max(counts);
    var peakIdx = counts.indexOf(peak);
    var total = U.sum(counts);
    $('#canteen-traffic-title').html('<i class="bi bi-bar-chart-steps"></i> 分时段客流与排队时长');
    $('.cc-chart-card__sub').filter(function () { return $(this).text().indexOf('traffic') > -1; })
      .html('数据源：stats.json → traffic / waitMinutes（' + (dayType === 'weekend' ? '周末' : '工作日') + '）· 峰值 ' +
        U.esc(stats.meta.hours[peakIdx]) + ' 约 ' + U.int(peak) + ' 人次 · 全天 ' + U.int(total) + ' 人次');
  }

  /* =======================================================================
   * 3. 维护表格
   * ===================================================================== */
  function manageList() {
    var list = data.merged.slice();
    if (manage.scope === 'current' && currentId) {
      list = list.filter(function (d) { return d.canteenId === currentId; });
    }
    if (manage.search) {
      var k = manage.search.toLowerCase();
      list = list.filter(function (d) {
        return (d.name + d.stall + d.category + d.id).toLowerCase().indexOf(k) > -1;
      });
    }
    return list;
  }

  function renderManage() {
    var list = manageList();
    var pageCount = Math.max(1, Math.ceil(list.length / manage.pageSize));
    manage.page = U.clamp(manage.page, 1, pageCount);
    var start = (manage.page - 1) * manage.pageSize;
    var rows = list.slice(start, start + manage.pageSize);
    var canteenMap = {};
    data.canteens.forEach(function (c) { canteenMap[c.id] = c; });

    $('#cc-manage-summary').html(
      '共 <b>' + list.length + '</b> 道菜品' +
      (manage.scope === 'current' && currentId ? '（' + U.esc(canteenMap[currentId].name) + '）' : '（全部食堂）') +
      ' · 其中本地新增 <b>' + data.userDishes.filter(function (d) { return d.__userCreated; }).length + '</b> 道，' +
      '本地修改 <b>' + data.userDishes.filter(function (d) { return !d.__userCreated && !d.__deleted; }).length + '</b> 道，' +
      '本地删除 <b>' + data.userDishes.filter(function (d) { return d.__deleted; }).length + '</b> 道'
    );

    if (!rows.length) {
      $('#cc-manage-body').html('<tr><td colspan="9">' +
        '<div class="cc-empty py-3"><i class="bi bi-inbox"></i>' +
        '<p class="cc-empty__title mb-1">没有匹配的菜品</p>' +
        '<p class="cc-empty__msg mb-2">可以清空筛选关键词，或点击右上角「新增菜品」。</p>' +
        '<button class="btn btn-sm btn-primary" type="button" id="cc-manage-clear">清空筛选</button>' +
        '</div></td></tr>');
      $('#cc-manage-pagination').empty();
      return;
    }

    $('#cc-manage-body').html(rows.map(function (d) {
      var source = d.__userCreated
        ? '<span class="cc-badge cc-badge--success">本地新增</span>'
        : (d.__edited ? '<span class="cc-badge cc-badge--warning">已修改</span>' : '<span class="cc-badge">JSON 源数据</span>');
      return '<tr data-row-id="' + U.esc(d.id) + '">' +
        '<td class="cc-mono">' + U.esc(d.id) + '</td>' +
        '<td><div class="fw-semibold">' + U.esc(d.name) + '</div>' +
        '<div class="cc-hint">' + U.esc((d.tags || []).join('、')) + '</div></td>' +
        '<td>' + U.esc((canteenMap[d.canteenId] || {}).name || d.canteenId) +
        '<div class="cc-hint">' + U.esc(d.stall) + '</div></td>' +
        '<td>' + U.esc(d.category) + '</td>' +
        '<td class="cc-num">' + Number(d.price).toFixed(1) + '</td>' +
        '<td class="cc-num">' + U.int(d.calories) + '</td>' +
        '<td class="cc-num">' + Number(d.rating).toFixed(1) + '</td>' +
        '<td>' + source + '</td>' +
        '<td class="text-nowrap">' +
        '  <button class="btn btn-sm btn-outline-primary" type="button" data-edit="' + U.esc(d.id) + '">' +
        '    <i class="bi bi-pencil"></i> 修改</button> ' +
        '  <button class="btn btn-sm btn-outline-danger" type="button" data-del="' + U.esc(d.id) + '">' +
        '    <i class="bi bi-trash3"></i> 删除</button>' +
        '</td></tr>';
    }).join(''));

    // 分页
    if (pageCount <= 1) {
      $('#cc-manage-pagination').empty();
    } else {
      var html = '<li class="page-item' + (manage.page === 1 ? ' disabled' : '') + '">' +
        '<button class="page-link" data-mpage="' + (manage.page - 1) + '">上一页</button></li>';
      for (var i = 1; i <= pageCount; i++) {
        html += '<li class="page-item' + (i === manage.page ? ' active' : '') + '">' +
          '<button class="page-link" data-mpage="' + i + '">' + i + '</button></li>';
      }
      html += '<li class="page-item' + (manage.page === pageCount ? ' disabled' : '') + '">' +
        '<button class="page-link" data-mpage="' + (manage.page + 1) + '">下一页</button></li>';
      $('#cc-manage-pagination').html(html);
    }

    renderDeletedBox();
  }

  function renderDeletedBox() {
    var deleted = data.userDishes.filter(function (d) { return d.__deleted; });
    if (!deleted.length) {
      $('#cc-deleted-box').empty();
      return;
    }
    var jsonMap = {};
    data.dishes.forEach(function (d) { jsonMap[d.id] = d; });
    $('#cc-deleted-box').html(
      '<div class="cc-alert cc-alert--warning">' +
      '  <div class="cc-alert__icon"><i class="bi bi-trash3"></i></div>' +
      '  <div class="cc-alert__body">' +
      '    <h3 class="cc-alert__title mb-1">已删除的菜品（' + deleted.length + '）</h3>' +
      '    <p class="cc-alert__msg">这些菜品在页面上不再显示，但源文件 data/dishes.json 未被改动，可以随时恢复。</p>' +
      '    <div class="d-flex flex-wrap gap-2">' +
      deleted.map(function (d) {
        var name = jsonMap[d.id] ? jsonMap[d.id].name : (d.name || d.id);
        return '<button class="btn btn-sm btn-outline-success" type="button" data-restore="' + U.esc(d.id) + '">' +
          '<i class="bi bi-arrow-counterclockwise"></i> 恢复「' + U.esc(name) + '」</button>';
      }).join('') +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  }

  /* =======================================================================
   * 4. 表单：新增 / 修改
   * ===================================================================== */
  function fillFormOptions() {
    $('#d-canteenId').html(data.canteens.map(function (c) {
      return '<option value="' + U.esc(c.id) + '">' + U.esc(c.name) + '（' + U.esc(c.brand) + '）</option>';
    }).join(''));

    var cats = CC.derive.computeCategoryShare(data.merged).map(function (c) { return c.name; });
    $('#cc-category-list').html(cats.map(function (c) { return '<option value="' + U.esc(c) + '"></option>'; }).join(''));

    var stalls = {};
    data.merged.forEach(function (d) { stalls[d.stall] = true; });
    $('#cc-stall-list').html(Object.keys(stalls).map(function (s) {
      return '<option value="' + U.esc(s) + '"></option>';
    }).join(''));
  }

  function clearFormErrors() {
    $('#cc-dish-form .is-invalid').removeClass('is-invalid');
    $('#cc-dish-form .invalid-feedback').text('');
    $('#cc-form-errors').addClass('d-none').empty();
  }

  function showFormErrors(errors, fieldErrors) {
    Object.keys(fieldErrors || {}).forEach(function (field) {
      $('#d-' + field).addClass('is-invalid');
      $('#err-' + field).text(fieldErrors[field]);
    });
    if (errors && errors.length) {
      $('#cc-form-errors').removeClass('d-none').html(
        '<div class="cc-alert cc-alert--danger mb-0">' +
        '  <div class="cc-alert__icon"><i class="bi bi-exclamation-octagon"></i></div>' +
        '  <div class="cc-alert__body">' +
        '    <h4 class="cc-alert__title">表单校验未通过（' + errors.length + ' 处问题）</h4>' +
        '    <ul class="mb-0 ps-3">' + errors.map(function (e) { return '<li>' + U.esc(e) + '</li>'; }).join('') + '</ul>' +
        '  </div>' +
        '</div>'
      );
    }
  }

  function openForm(mode, dish) {
    form.mode = mode;
    form.id = dish ? dish.id : null;
    clearFormErrors();
    fillFormOptions();

    $('#cc-dish-modal-title').text(mode === 'create' ? '新增菜品' : '修改菜品');
    $('#cc-form-mode').text(mode === 'create'
      ? '当前为新增模式：将写入浏览器本地存储，不修改源文件'
      : '当前为修改模式：菜品编号 ' + form.id + '，可点「还原本地修改」恢复原值');

    var d = dish || {
      name: '', canteenId: currentId || (data.canteens[0] || {}).id, stall: '', category: '',
      price: '', calories: '', protein: '', rating: '', monthlySales: '', spicy: 0,
      vegetarian: false, isNew: false, signature: false, tags: [], supply: ['午餐', '晚餐']
    };

    $('#d-name').val(d.name);
    $('#d-canteenId').val(d.canteenId);
    $('#d-stall').val(d.stall);
    $('#d-category').val(d.category);
    $('#d-price').val(d.price === 0 ? '' : d.price);
    $('#d-calories').val(d.calories === 0 ? '' : d.calories);
    $('#d-protein').val(d.protein === 0 ? '' : d.protein);
    $('#d-rating').val(d.rating === 0 ? '' : d.rating);
    $('#d-monthlySales').val(d.monthlySales || '');
    $('#d-spicy').val(String(d.spicy || 0));
    $('#d-tags').val((d.tags || []).join(', '));
    $('#d-vegetarian').prop('checked', !!d.vegetarian);
    $('#d-isNew').prop('checked', !!d.isNew);
    $('#d-signature').prop('checked', !!d.signature);
    $('[data-supply]').each(function () {
      $(this).prop('checked', (d.supply || []).indexOf($(this).val()) > -1);
    });

    var modalEl = document.getElementById('cc-dish-modal');
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } else {
      $(modalEl).addClass('show').css('display', 'block');
    }
  }

  function collectForm() {
    return {
      name: $('#d-name').val(),
      canteenId: $('#d-canteenId').val(),
      stall: $('#d-stall').val(),
      category: $('#d-category').val(),
      price: $('#d-price').val(),
      calories: $('#d-calories').val(),
      protein: $('#d-protein').val(),
      rating: $('#d-rating').val(),
      monthlySales: $('#d-monthlySales').val(),
      spicy: $('#d-spicy').val(),
      tags: $('#d-tags').val(),
      vegetarian: $('#d-vegetarian').is(':checked'),
      isNew: $('#d-isNew').is(':checked'),
      signature: $('#d-signature').is(':checked'),
      supply: $('[data-supply]:checked').map(function () { return $(this).val(); }).get()
    };
  }

  function submitForm(evt) {
    evt.preventDefault();
    clearFormErrors();
    var raw = collectForm();

    // 重名校验：修改模式下排除自己
    var existingNames = data.merged
      .filter(function (d) { return d.id !== form.id; })
      .map(function (d) { return d.name; });

    var check = CC.query.validateDish(raw, {
      existingNames: existingNames,
      canteenIds: data.canteens.map(function (c) { return c.id; })
    });

    if (!check.ok) {
      showFormErrors(check.errors, check.fieldErrors);
      CC.ui.toast('提交失败：表单存在 ' + check.errors.length + ' 处问题，请按提示修正。', 'danger', 4200);
      // 聚焦第一个出错字段，方便快速修正
      var first = Object.keys(check.fieldErrors)[0];
      if (first) $('#d-' + first).trigger('focus');
      return;
    }

    var record = $.extend({}, check.value);
    if (form.mode === 'create') {
      record.id = U.uid('U');
      record.__userCreated = true;
      CC.state.upsertUserDish(record);
      CC.ui.toast('已新增菜品「' + record.name + '」。可到“菜品查询”页搜索查看。', 'success', 4200);
    } else {
      record.id = form.id;
      var origin = null;
      data.dishes.forEach(function (d) { if (d.id === form.id) origin = d; });
      if (origin) record.__userCreated = false;
      else record.__userCreated = true;
      CC.state.upsertUserDish(record);
      CC.ui.toast('已保存对「' + record.name + '」的修改（仅本地生效）。', 'success', 3600);
    }

    var modalEl = document.getElementById('cc-dish-modal');
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } else {
      $(modalEl).removeClass('show').css('display', 'none');
    }

    reloadLocal();
  }

  function deleteDish(id) {
    var dish = null;
    data.merged.forEach(function (d) { if (d.id === id) dish = d; });
    if (!dish) {
      CC.ui.toast('未找到要删除的菜品。', 'danger');
      return;
    }
    var isUserCreated = !!dish.__userCreated;
    var modalEl = document.getElementById('cc-confirm-modal');
    if (!modalEl) {
      $('body').append(
        '<div class="modal fade" id="cc-confirm-modal" tabindex="-1" aria-hidden="true">' +
        '  <div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content">' +
        '    <div class="modal-header"><h5 class="modal-title">确认删除</h5>' +
        '    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭"></button></div>' +
        '    <div class="modal-body" id="cc-confirm-body"></div>' +
        '    <div class="modal-footer">' +
        '      <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">取消</button>' +
        '      <button type="button" class="btn btn-sm btn-danger" id="cc-confirm-ok">确认删除</button>' +
        '    </div>' +
        '  </div></div>' +
        '</div>'
      );
      modalEl = document.getElementById('cc-confirm-modal');
    }
    $('#cc-confirm-body').html(
      '<p class="mb-2">确定要删除「<b>' + U.esc(dish.name) + '</b>」（' + U.esc(dish.id) + '）吗？</p>' +
      '<p class="cc-hint mb-0">' + (isUserCreated
        ? '这是一条本地新增数据，删除后将从本地存储中移除，无法通过“恢复”找回。'
        : '这是 JSON 源数据，删除后仅在本浏览器隐藏，可随时在下方“已删除的菜品”中恢复。') + '</p>'
    );
    $('#cc-confirm-ok').off('click').on('click', function () {
      if (isUserCreated) {
        CC.state.deleteUserDish(dish.id);
      } else {
        CC.state.upsertUserDish({ id: dish.id, name: dish.name, __deleted: true });
      }
      if (window.bootstrap && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }
      CC.ui.toast('已删除「' + dish.name + '」。' + (isUserCreated ? '' : '可在下方恢复。'), 'success', 3600);
      reloadLocal();
    });
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  function restoreDish(id) {
    var list = CC.state.getUserDishes().filter(function (d) { return d.id !== id; });
    CC.state.saveUserDishes(list);
    CC.ui.toast('已恢复菜品 ' + id + '。', 'success');
    reloadLocal();
  }

  function reloadLocal() {
    data.userDishes = CC.state.getUserDishes();
    data.merged = CC.query.mergeDishes(data.dishes, data.userDishes);
    renderProfile();
    renderManage();
    fillFormOptions();
    CC.uiKit.setCartSource(data.merged);
  }

  /* =======================================================================
   * 5. 数据加载
   * ===================================================================== */
  function load(retry) {
    $('#cc-canteens-alert').empty();
    CC.api.loadAll(['canteens', 'dishes', 'stats']).then(function (results) {
      var failure = CC.api.firstFailure(results);
      if (failure) {
        CC.api.renderError('#cc-canteens-alert', failure.name, failure.error, function () { load(true); });
        $('#cc-profile').html('');
        $('#cc-manage-body').html('<tr><td colspan="9" class="text-center text-muted py-4">数据加载失败，无法维护菜品。</td></tr>');
        return;
      }
      data.canteens = results[0].data.list;
      data.dishes = results[1].data.list;
      data.stats = results[2].data;
      data.userDishes = CC.state.getUserDishes();
      data.merged = CC.query.mergeDishes(data.dishes, data.userDishes);

      var wanted = U.query('canteen');
      currentId = (wanted && data.canteens.some(function (c) { return c.id === wanted; })) ? wanted : data.canteens[0].id;

      renderTabs();
      renderProfile();
      renderTrafficChart();
      fillFormOptions();
      renderManage();
      CC.uiKit.setCartSource(data.merged);
      CC.api.renderModeBadge('#cc-data-mode');
    });
  }

  /* =======================================================================
   * 6. 事件
   * ===================================================================== */
  CC.ready(function ($) {
    CC.uiKit.mount();
    CC.uiKit.ensureModeBanner();
    load(false);

    $('#cc-canteen-tabs').on('click', '[data-canteen-tab]', function () {
      currentId = $(this).data('canteen-tab');
      manage.page = 1;
      renderTabs();
      renderProfile();
      renderTrafficChart();
      renderManage();
    });

    $('[data-daytype]').on('click', function () {
      dayType = $(this).data('daytype');
      $('[data-daytype]').removeClass('active');
      $(this).addClass('active');
      renderTrafficChart();
    });

    $('#cc-manage-search').on('input', U.debounce(function () {
      manage.search = $(this).val();
      manage.page = 1;
      renderManage();
    }, 250));

    $('#cc-manage-scope').on('change', function () {
      manage.scope = $(this).val();
      manage.page = 1;
      renderManage();
    });

    $(document).on('click', '#cc-manage-clear', function () {
      manage.search = '';
      $('#cc-manage-search').val('');
      renderManage();
    });

    $('#cc-manage-pagination').on('click', 'button[data-mpage]', function () {
      manage.page = Number($(this).data('mpage'));
      renderManage();
    });

    $('#cc-manage-body').on('click', '[data-edit]', function () {
      var id = $(this).data('edit');
      var dish = null;
      data.merged.forEach(function (d) { if (d.id === id) dish = d; });
      if (dish) openForm('edit', dish);
    });

    $('#cc-manage-body').on('click', '[data-del]', function () {
      deleteDish($(this).data('del'));
    });

    $('#cc-deleted-box').on('click', '[data-restore]', function () {
      restoreDish($(this).data('restore'));
    });

    $('#cc-add-dish').on('click', function () { openForm('create', null); });
    $(document).on('click', '[data-quick-add]', function () {
      currentId = $(this).data('quick-add');
      openForm('create', null);
    });

    $('#cc-dish-form').on('submit', submitForm);

    // 输入即清除该项错误提示
    $('#cc-dish-form').on('input change', 'input, select', function () {
      $(this).removeClass('is-invalid');
      $('#err-' + this.id.replace(/^d-/, '')).text('');
    });

    $('#cc-reset-local').on('click', function () {
      var n = CC.state.getUserDishes().length;
      if (!n) {
        CC.ui.toast('当前没有任何本地修改。', 'info', 2200);
        return;
      }
      CC.state.saveUserDishes([]);
      CC.ui.toast('已还原 ' + n + ' 条本地修改，页面恢复为 JSON 源数据。', 'success', 3600);
      reloadLocal();
    });

    $(document).on('cc:reload-data', function () { load(true); });
    $(document).on('cc:local-cleared', function () {
      data.userDishes = [];
      reloadLocal();
    });
    $(document).on('cc:theme-changed', function () {
      if (trafficHandle) { trafficHandle.destroy(); trafficHandle = null; }
      renderTrafficChart();
    });

    CC.uiKit.mountDebugPanel('#cc-debug-panel');
  });
})(jQuery, window.CC);
