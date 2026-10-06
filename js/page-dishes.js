/*
 * page-dishes.js —— 菜品查询页
 * 交互：关键词搜索（防抖）、多条件筛选、多选类别、排序、分页、收藏、加入预算清单、导出 CSV
 * 说明：筛选条件全部同步到 URL 查询串，便于"分享筛选结果"与截图复现。
 */
(function ($, CC) {
  'use strict';

  var U = CC.utils;
  var data = { canteens: [], dishes: [], userDishes: [], all: [], canteenMap: {} };
  var filter = CC.query.defaultFilter();
  var result = null;
  var syncingUrl = false;

  /* ---------- 1. URL ↔ 筛选条件 ---------- */
  function readUrl() {
    var f = CC.query.defaultFilter();
    f.canteenId = U.query('canteen') || 'all';
    f.keyword = U.query('keyword') || '';
    f.categories = (U.query('category') || '').split(',').filter(Boolean);
    f.ratingMin = Number(U.query('rating') || 0);
    f.supply = U.query('supply') || 'all';
    f.sort = U.query('sort') || 'recommend';
    f.vegetarianOnly = U.query('veg') === '1';
    f.newOnly = U.query('new') === '1';
    f.signatureOnly = U.query('signature') === '1';
    f.spiciness = U.query('spicy') || 'all';
    // 收藏页入口：dishes.html?favorite=1
    f.favoriteOnly = U.query('favorite') === '1';
    var pmin = Number(U.query('pmin'));
    var pmax = Number(U.query('pmax'));
    if (!isNaN(pmin) && pmin > 0) f.priceMin = pmin;
    if (!isNaN(pmax) && pmax > 0) f.priceMax = pmax;
    return f;
  }

  function writeUrl() {
    syncingUrl = true;
    var parts = [];
    if (filter.keyword) parts.push('keyword=' + encodeURIComponent(filter.keyword));
    if (filter.canteenId !== 'all') parts.push('canteen=' + encodeURIComponent(filter.canteenId));
    if (filter.categories.length) parts.push('category=' + encodeURIComponent(filter.categories.join(',')));
    if (filter.ratingMin > 0) parts.push('rating=' + filter.ratingMin);
    if (filter.supply !== 'all') parts.push('supply=' + encodeURIComponent(filter.supply));
    if (filter.sort !== 'recommend') parts.push('sort=' + filter.sort);
    if (filter.spiciness !== 'all') parts.push('spicy=' + filter.spiciness);
    if (filter.vegetarianOnly) parts.push('veg=1');
    if (filter.newOnly) parts.push('new=1');
    if (filter.signatureOnly) parts.push('signature=1');
    if (filter.favoriteOnly) parts.push('favorite=1');
    if (filter.priceMin > 0) parts.push('pmin=' + filter.priceMin);
    if (filter.priceMax < 30) parts.push('pmax=' + filter.priceMax);
    if (filter.page > 1) parts.push('page=' + filter.page);

    var url = window.location.pathname.split('/').pop() + (parts.length ? '?' + parts.join('&') : '');
    try {
      window.history.replaceState(null, '', url);
    } catch (e) {
      // file:// 下部分浏览器禁止 replaceState，忽略即可，不影响功能
    }
    syncingUrl = false;
  }

  /* ---------- 2. 表单 ↔ 筛选条件 双向同步 ---------- */
  function fillCanteenSelect() {
    $('#f-canteen').html('<option value="all">全部食堂</option>' + data.canteens.map(function (c) {
      return '<option value="' + U.esc(c.id) + '">' + U.esc(c.name) + '（' + U.esc(c.brand) + '）</option>';
    }).join(''));
  }

  function fillCategoryChips() {
    var cats = CC.derive.computeCategoryShare(data.all).map(function (c) { return c.name; });
    $('#f-category-chips').html(cats.map(function (c) {
      var on = filter.categories.indexOf(c) > -1 ? ' is-on' : '';
      return '<button type="button" class="cc-chip' + on + '" data-category="' + U.esc(c) + '">' +
        U.esc(c) + '<span class="cc-hint ms-1" data-cat-count="' + U.esc(c) + '"></span></button>';
    }).join(''));
    updateCategoryCounts();
  }

  function updateCategoryCounts() {
    var share = CC.derive.computeCategoryShare(data.all);
    var map = {};
    share.forEach(function (s) { map[s.name] = s.value; });
    $('[data-cat-count]').each(function () {
      var c = $(this).data('cat-count');
      $(this).text('(' + (map[c] || 0) + ')');
    });
  }

  function syncFormFromFilter() {
    $('#f-keyword').val(filter.keyword);
    $('#f-canteen').val(filter.canteenId);
    $('#f-sort').val(filter.sort);
    $('#f-supply').val(filter.supply);
    $('#f-rating').val(String(filter.ratingMin));
    $('#f-price-min').val(filter.priceMin);
    $('#f-price-max').val(filter.priceMax);
    $('#f-pagesize').val(String(filter.pageSize));
    $('#f-price-label').text(filter.priceMin + ' - ' + filter.priceMax + ' 元');

    $('#f-spicy-chips .cc-chip').removeClass('is-on').filter('[data-spicy="' + filter.spiciness + '"]').addClass('is-on');

    ['vegetarianOnly', 'newOnly', 'signatureOnly', 'favoriteOnly'].forEach(function (flag) {
      var map = { vegetarianOnly: 'chip-vegetarian', newOnly: 'chip-new', signatureOnly: 'chip-signature', favoriteOnly: 'chip-favorite' };
      $('#' + map[flag]).toggleClass('is-on', !!filter[flag]);
    });

    $('#f-category-chips .cc-chip').each(function () {
      var c = $(this).data('category');
      $(this).toggleClass('is-on', filter.categories.indexOf(c) > -1);
    });

    // 输入框非法状态清理
    $('.is-invalid').removeClass('is-invalid');
  }

  /* ---------- 3. 已选条件标签 ---------- */
  function renderFilterTags() {
    var tags = CC.query.buildFilterTags(filter, { canteenMap: data.canteenMap });
    if (!tags.length) {
      $('#cc-active-filters').html('<span class="cc-hint"><i class="bi bi-info-circle"></i> 当前未设置任何筛选条件，显示全部菜品</span>');
      return;
    }
    $('#cc-active-filters').html(
      '<span class="cc-hint">已选条件：</span>' +
      tags.map(function (t) {
        return '<span class="cc-filter-tag">' + U.esc(t.label) +
          '<button type="button" data-remove-tag="' + U.esc(t.key) + '" aria-label="移除条件 ' + U.esc(t.label) + '">&times;</button></span>';
      }).join('') +
      '<button class="btn btn-sm btn-link p-0 ms-1" type="button" id="cc-clear-tags">清空</button>'
    );
  }

  /* ---------- 4. 渲染结果 ---------- */
  function stationBadges(d) {
    var html = '';
    if (d.signature) html += '<span class="cc-badge cc-badge--warning"><i class="bi bi-award"></i> 招牌</span>';
    if (d.isNew) html += '<span class="cc-badge cc-badge--success"><i class="bi bi-stars"></i> 新品</span>';
    if (d.vegetarian) html += '<span class="cc-badge cc-badge--success"><i class="bi bi-leaf"></i> 素食</span>';
    if (Number(d.spicy) === 1) html += '<span class="cc-badge">微辣</span>';
    if (Number(d.spicy) === 2) html += '<span class="cc-badge cc-badge--warning">中辣</span>';
    if (Number(d.spicy) === 3) html += '<span class="cc-badge cc-badge--danger">重辣</span>';
    if (d.__userCreated) html += '<span class="cc-badge cc-badge--brand"><i class="bi bi-person-plus"></i> 本地新增</span>';
    else if (d.__edited) html += '<span class="cc-badge cc-badge--brand"><i class="bi bi-pencil"></i> 已本地修改</span>';
    return html;
  }

  function renderList() {
    var $list = $('#cc-dish-list');
    if (!result.total) {
      CC.ui.emptyState($list, {
        icon: 'search',
        title: '没有符合条件的菜品',
        message: '试试放宽价格区间、清空关键词，或点击下方按钮重置全部条件。',
        actions: '<button class="btn btn-sm btn-primary" type="button" id="cc-empty-reset">重置全部条件</button>' +
                 '<a class="btn btn-sm btn-outline-secondary" href="dishes.html">浏览全部菜品</a>'
      });
      $('#cc-pagination').empty();
      $('#cc-page-info').text('共 0 条');
      return;
    }

    var favs = CC.state.getFavorites();
    $list.html(result.items.map(function (d) {
      var fav = favs.indexOf(d.id) > -1;
      return '' +
        '<div class="col-12 col-sm-6 col-lg-4 col-xxl-3">' +
        '  <article class="cc-dish' + (fav ? ' is-favorite' : '') + '" data-dish-id="' + U.esc(d.id) + '">' +
        (d.signature ? '<div class="cc-dish__ribbon">招牌</div>' : (d.isNew ? '<div class="cc-dish__ribbon cc-dish__ribbon--new">新品</div>' : '')) +
        '    <div class="cc-dish__head">' +
        '      <div>' +
        '        <h3 class="cc-dish__name">' + U.esc(d.name) + '</h3>' +
        '        <div class="cc-dish__stall"><i class="bi bi-shop"></i> ' + U.esc(d.__canteenName) + ' · ' + U.esc(d.stall) + '</div>' +
        '      </div>' +
        '      <div class="text-end">' +
        '        <div class="cc-dish__price">' + Number(d.price).toFixed(1) + '<small> 元</small></div>' +
        '        <button class="cc-fav-btn' + (fav ? ' is-on' : '') + '" type="button" data-fav="' + U.esc(d.id) + '" ' +
        '          aria-label="' + (fav ? '取消收藏' : '收藏') + U.esc(d.name) + '" aria-pressed="' + fav + '">' +
        '          <i class="bi bi-' + (fav ? 'star-fill' : 'star') + '"></i></button>' +
        '      </div>' +
        '    </div>' +
        '    <div class="cc-dish__meta">' + stationBadges(d) + '</div>' +
        '    <div class="cc-dish__stats">' +
        '      <div>评分<b>' + U.score(d.rating) + '</b></div>' +
        '      <div>热量<b>' + U.int(d.calories) + '</b></div>' +
        '      <div>蛋白<b>' + Number(d.protein).toFixed(1) + '</b></div>' +
        '    </div>' +
        '    <div class="cc-hint d-flex justify-content-between">' +
        '      <span><i class="bi bi-graph-up-arrow"></i> 月销 ' + U.int(d.monthlySales) + '</span>' +
        '      <span title="综合推荐指数 = 评分 60% + 销量 25% + 性价比 15%"><i class="bi bi-hand-thumbs-up"></i> 推荐 ' + d.__recommend + '</span>' +
        '    </div>' +
        '    <div class="cc-dish__actions">' +
        '      <button class="btn btn-sm btn-outline-secondary flex-fill" type="button" data-detail="' + U.esc(d.id) + '">' +
        '        <i class="bi bi-info-circle"></i> 详情</button>' +
        '      <button class="btn btn-sm btn-primary flex-fill" type="button" data-cart="' + U.esc(d.id) + '">' +
        '        <i class="bi bi-basket-plus"></i> 加入清单</button>' +
        '    </div>' +
        '  </article>' +
        '</div>';
    }).join(''));

    renderPagination();
    $('#cc-page-info').text('第 ' + result.page + ' / ' + result.pageCount + ' 页 · 共 ' + result.total + ' 条');
  }

  function renderStats() {
    var s = result.stats;
    $('#st-count').text(U.int(s.count) + ' 道');
    $('#st-price').text(s.avgPrice.toFixed(2) + ' 元');
    $('#st-rating').text(s.avgRating.toFixed(2) + ' 分');
    $('#st-calories').text(U.int(s.avgCalories) + ' kcal');
    $('#st-veg').text(U.percent(s.vegetarian, s.count));
    $('#st-sales').text(U.int(s.totalSales) + ' 份');
  }

  function renderPagination() {
    var p = result.page;
    var n = result.pageCount;
    if (n <= 1) { $('#cc-pagination').empty(); return; }
    var html = '';
    html += '<li class="page-item' + (p === 1 ? ' disabled' : '') + '"><button class="page-link" data-page="1" aria-label="第一页">&laquo;</button></li>';
    html += '<li class="page-item' + (p === 1 ? ' disabled' : '') + '"><button class="page-link" data-page="' + (p - 1) + '">上一页</button></li>';
    var from = Math.max(1, p - 2);
    var to = Math.min(n, from + 4);
    from = Math.max(1, to - 4);
    for (var i = from; i <= to; i++) {
      html += '<li class="page-item' + (i === p ? ' active' : '') + '">' +
        '<button class="page-link" data-page="' + i + '"' + (i === p ? ' aria-current="page"' : '') + '>' + i + '</button></li>';
    }
    html += '<li class="page-item' + (p === n ? ' disabled' : '') + '"><button class="page-link" data-page="' + (p + 1) + '">下一页</button></li>';
    html += '<li class="page-item' + (p === n ? ' disabled' : '') + '"><button class="page-link" data-page="' + n + '" aria-label="最后一页">&raquo;</button></li>';
    $('#cc-pagination').html(html);
  }

  /** 统一刷新：重算结果 → 渲染列表/统计/标签 → 同步 URL */
  function refresh(keepPage) {
    if (!keepPage) filter.page = 1;
    result = CC.query.apply(data.all, filter, { favorites: CC.state.getFavorites(), canteenMap: data.canteenMap });
    filter.page = result.page;
    renderList();
    renderStats();
    renderFilterTags();
    writeUrl();
  }

  /* ---------- 5. 菜品详情弹窗 ---------- */
  function showDetail(dishId) {
    var d = null;
    result.all.forEach(function (x) { if (x.id === dishId) d = x; });
    if (!d) {
      CC.ui.toast('未找到该菜品，可能已被删除。', 'danger');
      return;
    }
    var c = data.canteenMap[d.canteenId] || {};
    var modalEl = document.getElementById('cc-detail-modal');
    if (!modalEl) {
      $('body').append(
        '<div class="modal fade" id="cc-detail-modal" tabindex="-1" aria-hidden="true">' +
        '  <div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
        '    <div class="modal-header"><h5 class="modal-title">菜品详情</h5>' +
        '    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭"></button></div>' +
        '    <div class="modal-body" id="cc-detail-body"></div>' +
        '  </div></div>' +
        '</div>'
      );
      modalEl = document.getElementById('cc-detail-modal');
    }
    $('#cc-detail-body').html(
      '<h4 class="mb-1">' + U.esc(d.name) + ' <span class="cc-badge cc-badge--brand">' + U.esc(d.id) + '</span></h4>' +
      '<p class="cc-hint">' + U.esc(c.name || d.canteenId) + ' · ' + U.esc(d.stall) + ' · ' + U.esc(d.category) + '</p>' +
      '<div class="table-responsive"><table class="table table-sm cc-table"><tbody>' +
      '<tr><th scope="row">价格</th><td>' + U.money(d.price) + '</td><th scope="row">评分</th><td>' + CC.ui.stars(d.rating) + '</td></tr>' +
      '<tr><th scope="row">热量</th><td>' + U.int(d.calories) + ' kcal</td><th scope="row">蛋白质</th><td>' + Number(d.protein).toFixed(1) + ' g</td></tr>' +
      '<tr><th scope="row">月销量</th><td>' + U.int(d.monthlySales) + ' 份</td><th scope="row">辣度</th><td>' + ['不辣', '微辣', '中辣', '重辣'][Number(d.spicy) || 0] + '</td></tr>' +
      '<tr><th scope="row">供应时段</th><td colspan="3">' + U.esc((d.supply || []).join(' / ') || '—') + '</td></tr>' +
      '<tr><th scope="row">标签</th><td colspan="3">' + U.esc((d.tags || []).join('、') || '—') + '</td></tr>' +
      '<tr><th scope="row">推荐指数</th><td colspan="3">' + d.__recommend + ' / 100（评分 60% + 销量 25% + 性价比 15%）</td></tr>' +
      '</tbody></table></div>' +
      (d.__userCreated ? '<p class="cc-hint mb-0"><i class="bi bi-info-circle"></i> 该菜品由本人在“食堂档案 → 菜品维护”中新增，保存在浏览器 localStorage。</p>' : '') +
      (d.__edited ? '<p class="cc-hint mb-0"><i class="bi bi-info-circle"></i> 该菜品已被本地修改，原始数据仍在 data/dishes.json 中未变动。</p>' : '')
    );
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  /* ---------- 6. 数据加载 ---------- */
  function load(retry) {
    $('#cc-dishes-alert').empty();
    CC.ui.skeleton('#cc-dish-list', 3);
    CC.api.loadAll(['canteens', 'dishes']).then(function (results) {
      var failure = CC.api.firstFailure(results);
      if (failure) {
        CC.api.renderError('#cc-dishes-alert', failure.name, failure.error, function () { load(true); });
        CC.ui.emptyState('#cc-dish-list', { icon: 'wifi-off', title: '菜品数据未加载', message: '请先处理上方错误提示，再点击“重新加载”。' });
        CC.api.renderModeBadge('#cc-data-mode');
        return;
      }
      data.canteens = results[0].data.list;
      data.dishes = results[1].data.list;
      data.canteenMap = {};
      data.canteens.forEach(function (c) { data.canteenMap[c.id] = c; });
      data.userDishes = CC.state.getUserDishes();
      data.all = CC.query.mergeDishes(data.dishes, data.userDishes);

      fillCanteenSelect();
      fillCategoryChips();
      syncFormFromFilter();
      refresh(true);

      CC.uiKit.setCartSource(data.all);
      CC.uiKit.refreshCounters();
      CC.api.renderModeBadge('#cc-data-mode');
    });
  }

  /* ---------- 7. 事件绑定 ---------- */
  CC.ready(function ($) {
    CC.uiKit.mount();
    CC.uiKit.ensureModeBanner();

    filter = readUrl();
    load(false);

    // 关键词：输入防抖 350ms
    $('#f-keyword').on('input', U.debounce(function () {
      filter.keyword = $(this).val();
      refresh();
    }, 350));
    $('#f-keyword-clear').on('click', function () {
      $('#f-keyword').val('');
      filter.keyword = '';
      refresh();
      $('#f-keyword').focus();
    });

    $('#f-canteen').on('change', function () { filter.canteenId = $(this).val(); refresh(); });
    $('#f-sort').on('change', function () { filter.sort = $(this).val(); refresh(); });
    $('#f-supply').on('change', function () { filter.supply = $(this).val(); refresh(); });
    $('#f-rating').on('change', function () { filter.ratingMin = Number($(this).val()); refresh(); });
    $('#f-pagesize').on('change', function () { filter.pageSize = Number($(this).val()); refresh(); });

    $('#f-spicy-chips').on('click', '.cc-chip', function () {
      filter.spiciness = $(this).data('spicy');
      $('#f-spicy-chips .cc-chip').removeClass('is-on');
      $(this).addClass('is-on');
      refresh();
    });

    $('#f-category-chips').on('click', '.cc-chip', function () {
      var c = $(this).data('category');
      var i = filter.categories.indexOf(c);
      if (i > -1) filter.categories.splice(i, 1); else filter.categories.push(c);
      $(this).toggleClass('is-on');
      refresh();
    });

    $('[data-toggle-flag]').on('click', function () {
      var flag = $(this).data('toggle-flag');
      filter[flag] = !filter[flag];
      $(this).toggleClass('is-on', filter[flag]);
      refresh();
      if (flag === 'favoriteOnly' && filter.favoriteOnly && !CC.state.getFavorites().length) {
        CC.ui.toast('还没有收藏任何菜品，可在菜品卡片右上角点星标收藏。', 'info', 3600);
      }
    });

    // 价格区间：非法输入校验
    function applyPrice() {
      var min = Number($('#f-price-min').val());
      var max = Number($('#f-price-max').val());
      var ok = true;
      if (isNaN(min) || min < 0 || min > 30) { $('#f-price-min').addClass('is-invalid'); ok = false; }
      else $('#f-price-min').removeClass('is-invalid');
      if (isNaN(max) || max < 0 || max > 30) { $('#f-price-max').addClass('is-invalid'); ok = false; }
      else $('#f-price-max').removeClass('is-invalid');
      if (ok && min > max) {
        CC.ui.toast('最低价格不能大于最高价格，已自动交换。', 'warning');
        var t = min; min = max; max = t;
        $('#f-price-min').val(min);
        $('#f-price-max').val(max);
      }
      if (!ok) {
        CC.ui.toast('价格区间需为 0-30 之间的数字，请检查输入。', 'danger');
        return;
      }
      filter.priceMin = min;
      filter.priceMax = max;
      $('#f-price-label').text(min + ' - ' + max + ' 元');
      refresh();
    }
    $('#f-price-apply').on('click', applyPrice);
    $('#f-price-min, #f-price-max').on('keydown', function (e) {
      if (e.key === 'Enter') applyPrice();
    });

    $('#cc-apply-filter').on('click', function () {
      // 全部条件已在 change 时生效，这里给用户一个明确的反馈
      refresh();
      CC.ui.toast('已应用筛选条件，共命中 ' + result.total + ' 道菜品。', 'success', 2400);
    });

    $('#cc-reset-filter').on('click', function () {
      filter = CC.query.defaultFilter();
      syncFormFromFilter();
      refresh();
      CC.ui.toast('筛选条件已重置。', 'info', 2000);
    });

    $(document).on('click', '#cc-empty-reset', function () {
      filter = CC.query.defaultFilter();
      syncFormFromFilter();
      refresh();
    });

    $(document).on('click', '#cc-clear-tags', function () {
      filter = CC.query.defaultFilter();
      syncFormFromFilter();
      refresh();
    });

    $('#cc-active-filters').on('click', '[data-remove-tag]', function () {
      filter = CC.query.removeTag(filter, $(this).data('remove-tag'));
      syncFormFromFilter();
      refresh();
    });

    $('#cc-pagination').on('click', 'button[data-page]', function () {
      var p = Number($(this).data('page'));
      if (p < 1 || p > result.pageCount) return;
      filter.page = p;
      refresh(true);
      $('html, body').animate({ scrollTop: $('#cc-dish-list').offset().top - 120 }, 240);
    });

    // 收藏 / 加入清单 / 详情
    $('#cc-dish-list').on('click', '[data-fav]', function () {
      var id = $(this).data('fav');
      var on = CC.state.toggleFavorite(id);
      var $article = $(this).closest('.cc-dish');
      $article.toggleClass('is-favorite', on);
      $(this).toggleClass('is-on', on).attr('aria-pressed', on)
        .find('i').attr('class', on ? 'bi bi-star-fill' : 'bi bi-star');
      CC.uiKit.refreshCounters();
      CC.ui.toast(on ? '已收藏，可在导航栏星标处集中查看。' : '已取消收藏。', 'success', 2000);
      if (filter.favoriteOnly) refresh(true);
    });

    $('#cc-dish-list').on('click', '[data-cart]', function () {
      var id = $(this).data('cart');
      CC.state.addToCart(id, 1);
      CC.uiKit.refreshCounters();
      var name = $(this).closest('.cc-dish').find('.cc-dish__name').text();
      CC.ui.toast('「' + name + '」已加入预算清单。', 'success', 2200);
    });

    $('#cc-dish-list').on('click', '[data-detail]', function () {
      showDetail($(this).data('detail'));
    });

    $('#cc-export-csv').on('click', function () {
      CC.query.exportCSV(result ? result.all : [], '菜品查询结果-' + new Date().toISOString().slice(0, 10) + '.csv');
    });

    $('#cc-toggle-filter').on('click', function () {
      $('#cc-filter-panel').slideToggle(180);
    });

    $('#cc-refresh-dishes, [data-cc-retry]').on('click', function () { load(true); });
    $(document).on('cc:reload-data', function () { load(true); });
    $(document).on('cc:local-cleared', function () {
      data.userDishes = [];
      data.all = CC.query.mergeDishes(data.dishes, []);
      fillCategoryChips();
      refresh(true);
    });

    CC.uiKit.mountDebugPanel('#cc-debug-panel');
  });
})(jQuery, window.CC);
