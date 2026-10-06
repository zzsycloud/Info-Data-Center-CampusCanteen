window.CC_CONFIG = (function () {
  'use strict';

  var DATA_VERSION = '1.0.0';

  return {
    appName: '校园食堂信息与数据展示中心',
    campus: '示范大学 · 主校区',
    version: '1.0.0',
    dataVersion: DATA_VERSION,

    /* ---------- 数据源 ---------- */
    data: {
      // 首选：本地 JSON 文件（通过 fetch 异步加载，需要有 Web 服务器或支持 file 访问的浏览器）
      basePath: 'data/',
      manifest: {
        canteens: 'canteens.json',
        dishes: 'dishes.json',
        stats: 'stats.json',
        notices: 'notices.json'
      },
      // 兜底：与 JSON 同源的 JS 数据包（由 _tools/build_data_bundle.py 生成，用 <script> 引入）
      // 当以 file:// 方式双击打开页面、fetch 被浏览器安全策略拦截时自动启用。
      embeddedGlobal: 'CC_DATA',
      timeout: 6000,
      retry: 2,
      cacheKeyPrefix: 'canteen-center:dataset:'
    },

    /* ---------- 本地存储 ---------- */
    storage: {
      prefix: 'canteen-center:',
      keys: {
        favorites: 'favorites',
        cart: 'cart',
        userDishes: 'user-dishes',
        theme: 'theme',
        recentSearch: 'recent-search',
        visitLog: 'visit-log'
      }
    },

    /* ---------- 图表主题 ---------- */
    charts: {
      palette: ['#2f7fd6', '#e0762b', '#3fa36b', '#8b5cf6', '#d94f6a', '#0e9488', '#c9a227'],
      fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
      animation: true
    },

    /* ---------- 业务参数 ---------- */
    business: {
      mealWindows: [
        { key: 'breakfast', label: '早餐', range: '06:30-09:00' },
        { key: 'lunch', label: '午餐', range: '11:00-13:30' },
        { key: 'dinner', label: '晚餐', range: '17:00-19:30' }
      ],
      // 高峰判定阈值（人次/小时）
      peakThreshold: 800,
      // 拥挤度分档
      crowdLevels: [
        { max: 300, label: '空闲', className: 'crowd-idle' },
        { max: 700, label: '正常', className: 'crowd-normal' },
        { max: 1100, label: '较挤', className: 'crowd-busy' },
        { max: Infinity, label: '拥挤', className: 'crowd-full' }
      ],
      // 预算提示：低于该值给出“超出预算”提示
      budgetWarnRatio: 1.0,
      pageSize: 12
    },

    /* ---------- 功能开关 ---------- */
    features: {
      // 演示用：在“调试面板”里把 fetch 改成强制失败，用于展示网络失败的错误提示
      debugPanel: true,
      // 三维场景是否默认自动旋转
      autoRotate: true
    },

    /* ---------- 运行说明（首页展示，与 README 保持一致） ---------- */
    runHelp: [
      '方式一（推荐）：在项目根目录执行 python -m http.server 8080，浏览器访问 http://localhost:8080/index.html',
      '方式二：直接双击 index.html。若浏览器拦截 file:// 下的 fetch，程序会自动切换到内置 JS 数据包（CC_DATA）并在顶部提示。',
      '方式三：VS Code 安装 Live Server 插件，右键 index.html → Open with Live Server。'
    ]
  };
})();
