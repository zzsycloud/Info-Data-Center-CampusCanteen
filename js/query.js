/*
 * query.js —— 交互查询与管理模块
 * 提供纯函数式的筛选/排序/分页逻辑 + 本地菜品增删改的校验规则，页面只负责渲染。
 *
 * 分工：
 *   CC.query.mergeDishes   合并 JSON 数据与用户本地新增/修改的菜品
 *   CC.query.apply         按条件筛选 + 排序 + 分页
 *   CC.query.buildFilterTags 生成"已选条件"标签
 *   CC.query.validateDish  表单校验（返回错误信息数组）
 *   CC.query.exportCSV     导出当前结果
 */
window.CC = window.CC || {};

window.CC.query = (function ($, CC) {
  'use strict';

  var U = CC.utils;

  /* =======================================================================
   * 1. 数据合并：JSON 菜品 + 本地增改（用户改过的以本地为准，本地标记为已删除的不显示）
   * ===================================================================== */
  function mergeDishes(jsonDishes, userDishes) {
    var overrides = {};
    var added = [];
    var removed = {};

    (userDishes || []).forEach(function (d) {
      if (!d || !d.id) return;
      if (d.__deleted) { removed[d.id] = true; return; }
      if (d.__userCreated) { added.push(d); return; }
      overrides[d.id] = d;
    });

    var merged = [];
    (jsonDishes || []).forEach(function (d) {
      if (removed[d.id]) return;
      var ov = overrides[d.id];
      if (ov) {
        var copy = $.extend({}, d, ov);
        copy.__edited = true;
        merged.push(copy);
      } else {
        merged.push($.extend({}, d));
      }
    });
    added.forEach(function (d) {
      var copy = $.extend({}, d);
      copy.__userCreated = true;
      merged.push(copy);
    });
    return merged;
  }

  /* =======================================================================
   * 2. 默认筛选条件
   * ===================================================================== */
  function defaultFilter() {
    return {
      keyword: '',
      canteenId: 'all',
      categories: [],      // 多选
      priceMin: 0,
      priceMax: 30,
      ratingMin: 0,
      spiciness: 'all',    // all | 0-1 | 2-3
      vegetarianOnly: false,
      newOnly: false,
      signatureOnly: false,
      favoriteOnly: false,
      supply: 'all',       // all | 早餐 | 午餐 | 晚餐
      sort: 'recommend',   // recommend | sales | rating | priceAsc | priceDesc | caloriesAsc | nameAsc
      page: 1,
      pageSize: CC.cfg.business.pageSize
    };
  }

  /** 关键词匹配：名称、档口、标签、菜系拼音首字母不做，匹配中文与英文数字即可 */
  function matchKeyword(dish, kw) {
    if (!kw) return true;
    var k = kw.trim().toLowerCase();
    if (!k) return true;
    var haystack = [dish.name, dish.stall, dish.category, dish.id, (dish.tags || []).join(' ')].join(' ').toLowerCase();
    // 支持空格分隔的多关键词，全部命中才算匹配
    return k.split(/\s+/).every(function (part) { return haystack.indexOf(part) > -1; });
  }

  /** 判断菜品是否属于某个筛选条件集合 */
  function matchFilter(dish, f, ctx) {
    if (f.canteenId !== 'all' && dish.canteenId !== f.canteenId) return false;
    if (f.categories.length && f.categories.indexOf(dish.category) === -1) return false;
    if (Number(dish.price) < Number(f.priceMin) || Number(dish.price) > Number(f.priceMax)) return false;
    if (Number(dish.rating) < Number(f.ratingMin)) return false;
    if (f.spiciness === 'mild' && Number(dish.spicy) > 1) return false;
    if (f.spiciness === 'hot' && Number(dish.spicy) < 2) return false;
    if (f.vegetarianOnly && !dish.vegetarian) return false;
    if (f.newOnly && !dish.isNew) return false;
    if (f.signatureOnly && !dish.signature) return false;
    if (f.supply !== 'all' && (dish.supply || []).indexOf(f.supply) === -1) return false;
    if (f.favoriteOnly && ctx.favorites.indexOf(dish.id) === -1) return false;
    if (!matchKeyword(dish, f.keyword)) return false;
    return true;
  }

  /* =======================================================================
   * 3. 主入口：筛选 + 排序 + 分页
   * @returns {{items, total, page, pageCount, stats, all}}
   * ===================================================================== */
  function apply(dishes, filter, ctx) {
    var f = $.extend(defaultFilter(), filter || {});
    var c = $.extend({ favorites: [] }, ctx || {});
    var canteenMap = c.canteenMap || {};

    var all = (dishes || []).filter(function (d) { return matchFilter(d, f, c); });

    // 价格区间与销量极值用于推荐指数换算
    var prices = all.map(function (d) { return Number(d.price) || 0; });
    var sales = all.map(function (d) { return Number(d.monthlySales) || 0; });
    var minPrice = prices.length ? Math.min.apply(null, prices) : 0;
    var maxPrice = prices.length ? Math.max.apply(null, prices) : 1;
    var maxSales = sales.length ? Math.max.apply(null, sales) : 1;

    all.forEach(function (d) {
      d.__recommend = CC.derive.recommendIndex(d, maxSales, minPrice, maxPrice);
      d.__canteenName = (canteenMap[d.canteenId] || {}).name || d.canteenId;
    });

    var sorted;
    switch (f.sort) {
      case 'sales': sorted = U.sortBy(all, 'monthlySales', true); break;
      case 'rating': sorted = U.sortBy(all, 'rating', true); break;
      case 'priceAsc': sorted = U.sortBy(all, 'price', false); break;
      case 'priceDesc': sorted = U.sortBy(all, 'price', true); break;
      case 'caloriesAsc': sorted = U.sortBy(all, 'calories', false); break;
      case 'nameAsc': sorted = U.sortBy(all, 'name', false); break;
      default: sorted = U.sortBy(all, '__recommend', true);
    }

    var pageSize = Math.max(1, Number(f.pageSize) || 12);
    var pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    var page = U.clamp(Number(f.page) || 1, 1, pageCount);
    var start = (page - 1) * pageSize;

    var stats = {
      count: sorted.length,
      avgPrice: sorted.length ? U.round(U.avg(sorted.map(function (d) { return d.price; })), 2) : 0,
      avgRating: sorted.length ? U.round(U.avg(sorted.map(function (d) { return d.rating; })), 2) : 0,
      avgCalories: sorted.length ? Math.round(U.avg(sorted.map(function (d) { return d.calories; }))) : 0,
      totalSales: U.sum(sorted.map(function (d) { return d.monthlySales; })),
      vegetarian: sorted.filter(function (d) { return d.vegetarian; }).length,
      cheapest: sorted.length ? U.sortBy(sorted, 'price', false)[0] : null,
      mostPopular: sorted.length ? U.sortBy(sorted, 'monthlySales', true)[0] : null
    };

    return {
      items: sorted.slice(start, start + pageSize),
      all: sorted,
      total: sorted.length,
      page: page,
      pageSize: pageSize,
      pageCount: pageCount,
      filter: f,
      stats: stats
    };
  }

  /* =======================================================================
   * 4. 已选条件标签（点击可单独移除）
   * ===================================================================== */
  function buildFilterTags(filter, ctx) {
    var f = $.extend(defaultFilter(), filter || {});
    var canteenMap = (ctx && ctx.canteenMap) || {};
    var tags = [];

    if (f.keyword) tags.push({ key: 'keyword', label: '关键词：' + f.keyword });
    if (f.canteenId !== 'all') tags.push({ key: 'canteenId', label: '食堂：' + ((canteenMap[f.canteenId] || {}).name || f.canteenId) });
    (f.categories || []).forEach(function (c) {
      tags.push({ key: 'category:' + c, label: '类别：' + c });
    });
    if (Number(f.priceMin) > 0 || Number(f.priceMax) < 30) {
      tags.push({ key: 'price', label: '价格：' + f.priceMin + '-' + f.priceMax + ' 元' });
    }
    if (Number(f.ratingMin) > 0) tags.push({ key: 'ratingMin', label: '评分 ≥ ' + f.ratingMin });
    if (f.spiciness === 'mild') tags.push({ key: 'spiciness', label: '不辣 / 微辣' });
    if (f.spiciness === 'hot') tags.push({ key: 'spiciness', label: '中辣以上' });
    if (f.vegetarianOnly) tags.push({ key: 'vegetarianOnly', label: '只看素食' });
    if (f.newOnly) tags.push({ key: 'newOnly', label: '只看新品' });
    if (f.signatureOnly) tags.push({ key: 'signatureOnly', label: '只看招牌菜' });
    if (f.favoriteOnly) tags.push({ key: 'favoriteOnly', label: '只看我的收藏' });
    if (f.supply !== 'all') tags.push({ key: 'supply', label: '供应时段：' + f.supply });
    return tags;
  }

  /** 移除某个标签后返回新的筛选条件 */
  function removeTag(filter, tagKey) {
    var f = $.extend(defaultFilter(), filter || {});
    if (tagKey === 'price') {
      f.priceMin = 0;
      f.priceMax = 30;
    } else if (tagKey.indexOf('category:') === 0) {
      var c = tagKey.slice('category:'.length);
      f.categories = (f.categories || []).filter(function (x) { return x !== c; });
    } else if (tagKey === 'keyword') {
      f.keyword = '';
    } else if (tagKey === 'canteenId') {
      f.canteenId = 'all';
    } else if (tagKey === 'spiciness') {
      f.spiciness = 'all';
    } else if (tagKey === 'ratingMin') {
      f.ratingMin = 0;
    } else if (tagKey === 'supply') {
      f.supply = 'all';
    } else {
      f[tagKey] = false;
    }
    f.page = 1;
    return f;
  }

  /* =======================================================================
   * 5. 表单校验（新增 / 修改菜品）
   * @returns {{ok:boolean, errors:string[], fieldErrors:Object, value:Object}}
   * ===================================================================== */
  function validateDish(raw, options) {
    var o = options || {};
    var errors = [];
    var fieldErrors = {};
    var value = {};

    function fail(field, msg) {
      errors.push(msg);
      fieldErrors[field] = msg;
    }

    // 名称
    var name = String(raw.name == null ? '' : raw.name).trim();
    if (!name) {
      fail('name', '菜品名称不能为空。');
    } else if (name.length < 2 || name.length > 20) {
      fail('name', '菜品名称长度需在 2-20 个字符之间，当前 ' + name.length + ' 个字符。');
    } else if (/[<>{}\\]/.test(name)) {
      fail('name', '菜品名称包含非法字符（不允许 < > { } \\）。');
    } else if ((o.existingNames || []).indexOf(name) > -1) {
      fail('name', '菜品「' + name + '」已存在，请换一个名称。');
    }
    value.name = name;

    // 食堂
    if (!raw.canteenId) {
      fail('canteenId', '请选择所属食堂。');
    } else if ((o.canteenIds || []).indexOf(raw.canteenId) === -1) {
      fail('canteenId', '所属食堂编号「' + raw.canteenId + '」不存在。');
    }
    value.canteenId = raw.canteenId;

    // 档口
    var stall = String(raw.stall == null ? '' : raw.stall).trim();
    if (!stall) fail('stall', '档口名称不能为空。');
    else if (stall.length > 24) fail('stall', '档口名称不能超过 24 个字符。');
    value.stall = stall;

    // 类别
    var category = String(raw.category == null ? '' : raw.category).trim();
    if (!category) fail('category', '请选择或填写菜品类别。');
    value.category = category;

    // 价格
    var price = Number(raw.price);
    if (raw.price === '' || raw.price === null || raw.price === undefined || isNaN(price)) {
      fail('price', '价格必须是数字。');
    } else if (price <= 0) {
      fail('price', '价格必须大于 0 元。');
    } else if (price > 200) {
      fail('price', '价格不能超过 200 元，请确认是否填错（例如把 12 写成了 1200）。');
    } else if (Math.round(price * 10) !== price * 10) {
      fail('price', '价格最多保留一位小数。');
    }
    value.price = isNaN(price) ? 0 : U.round(price, 1);

    // 热量
    var calories = Number(raw.calories);
    if (raw.calories === '' || raw.calories === null || raw.calories === undefined || isNaN(calories)) {
      fail('calories', '热量必须是数字。');
    } else if (calories <= 0 || calories > 3000) {
      fail('calories', '热量需在 1-3000 千卡之间。');
    }
    value.calories = isNaN(calories) ? 0 : Math.round(calories);

    // 蛋白质
    var protein = Number(raw.protein);
    if (raw.protein === '' || raw.protein === null || raw.protein === undefined || isNaN(protein)) {
      fail('protein', '蛋白质必须是数字。');
    } else if (protein < 0 || protein > 200) {
      fail('protein', '蛋白质需在 0-200 克之间。');
    }
    value.protein = isNaN(protein) ? 0 : U.round(protein, 1);

    // 评分
    var rating = Number(raw.rating);
    if (raw.rating === '' || raw.rating === null || raw.rating === undefined || isNaN(rating)) {
      fail('rating', '评分必须是数字。');
    } else if (rating < 0 || rating > 5) {
      fail('rating', '评分需在 0-5 之间。');
    }
    value.rating = isNaN(rating) ? 0 : U.round(rating, 1);

    // 月销量
    var sales = Number(raw.monthlySales);
    if (raw.monthlySales !== '' && raw.monthlySales !== null && raw.monthlySales !== undefined && !isNaN(sales)) {
      if (sales < 0 || sales > 100000) fail('monthlySales', '月销量需在 0-100000 之间。');
      value.monthlySales = Math.round(sales);
    } else {
      value.monthlySales = 0;
    }

    // 辣度
    var spicy = Number(raw.spicy);
    if ([0, 1, 2, 3].indexOf(spicy) === -1) {
      fail('spicy', '辣度只能是 0（不辣）、1（微辣）、2（中辣）、3（重辣）。');
      spicy = 0;
    }
    value.spicy = spicy;

    value.vegetarian = !!raw.vegetarian;
    value.isNew = !!raw.isNew;
    value.signature = !!raw.signature;
    value.supply = Array.isArray(raw.supply) && raw.supply.length ? raw.supply : ['午餐'];
    value.tags = String(raw.tags == null ? '' : raw.tags)
      .split(/[,，\s]+/)
      .filter(function (t) { return t.length > 0; })
      .slice(0, 5);

    return {
      ok: errors.length === 0,
      errors: errors,
      fieldErrors: fieldErrors,
      value: value
    };
  }

  /* =======================================================================
   * 6. 导出 CSV（当前筛选结果）
   * ===================================================================== */
  function exportCSV(rows, filename) {
    if (!rows || !rows.length) {
      CC.ui.toast('当前没有可导出的数据，请先调整筛选条件。', 'warning');
      return false;
    }
    var headers = ['菜品编号', '菜品名称', '所属食堂', '档口', '类别', '价格(元)', '热量(kcal)', '蛋白质(g)', '评分', '月销量'];
    var lines = [headers.join(',')];
    rows.forEach(function (d) {
      lines.push([
        d.id, d.name, d.__canteenName || d.canteenId, d.stall, d.category,
        d.price, d.calories, d.protein, d.rating, d.monthlySales
      ].map(function (v) {
        var s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || ('菜品导出-' + new Date().toISOString().slice(0, 10) + '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    CC.ui.toast('已导出 ' + rows.length + ' 条记录到 CSV 文件。', 'success');
    return true;
  }

  return {
    mergeDishes: mergeDishes,
    defaultFilter: defaultFilter,
    apply: apply,
    buildFilterTags: buildFilterTags,
    removeTag: removeTag,
    validateDish: validateDish,
    exportCSV: exportCSV
  };
})(jQuery, window.CC);
