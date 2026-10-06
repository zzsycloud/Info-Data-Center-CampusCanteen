/*
 * page-scene3d.js —— 三维食堂总览（Three.js）
 *
 * 场景构成：
 *   地面（含路网、中心广场、喷泉、树木）、三栋食堂楼（按 canteens.json 的 position3d 摆放）、
 *   楼层分割线、屋顶、招牌、名称标签（Canvas 纹理精灵）、客流悬浮柱。
 *
 * 数据映射（详见 HTML 右侧说明）：
 *   楼栋长宽  ← canteens.json position3d.width / depth
 *   楼栋高度  ← seats 座位数线性映射
 *   楼栋颜色  ← canteens.json color
 *   悬浮柱    ← stats.json traffic 当前时段人数；高度与颜色表示拥挤度
 *   楼层数    ← canteens.json floors.length
 *
 * 交互：SimpleOrbit 控制器（自研，见 vendor/SimpleOrbit.js）+ Raycaster 拾取 + 键盘快捷键。
 */
(function ($, CC) {
  'use strict';

  var U = CC.utils;
  var data = { canteens: [], dishes: [], stats: null };
  var T = window.THREE;

  var scene, camera, renderer, controls, raycaster, pointer;
  var buildings = [];      // {group, body, canteen, label, bar, barBase, floors:[]}
  var pickTargets = [];    // 参与拾取的网格（body / 屋顶 / 招牌）
  var hoverRing;
  var selectedId = null;
  var state = {
    autoRotate: true,
    wireframe: false,
    exploded: false,
    slot: 'now'          // now | lunch | dinner | morning
  };
  var frameId = null;
  var running = false;

  /* =======================================================================
   * 1. 时间与客流数据
   * ===================================================================== */
  function isWeekend() {
    var d = new Date().getDay();
    return d === 0 || d === 6;
  }

  function hourIndex(hour) {
    var hours = data.stats.meta.hours;
    return U.clamp(hour - parseInt(hours[0], 10), 0, hours.length - 1);
  }

  function currentHourForSlot() {
    if (state.slot === 'now') return new Date().getHours();
    if (state.slot === 'morning') return 7;
    if (state.slot === 'lunch') return 12;
    if (state.slot === 'dinner') return 18;
    return new Date().getHours();
  }

  function slotLabel() {
    if (state.slot === 'now') return '现在';
    if (state.slot === 'morning') return '早餐 07:00';
    if (state.slot === 'lunch') return '午餐高峰 12:00';
    if (state.slot === 'dinner') return '晚餐高峰 18:00';
    return '现在';
  }

  function countFor(canteenId) {
    var idx = hourIndex(currentHourForSlot());
    var arr = isWeekend() ? data.stats.traffic[canteenId].hourlyWeekend : data.stats.traffic[canteenId].hourly;
    return Number(arr[idx] || 0);
  }

  function heightFor(seats) {
    return U.clamp(Number(seats) / 120, 3.5, 16);
  }

  /* =======================================================================
   * 2. 标签精灵（用 Canvas 生成纹理，无需外部图片，file:// 下也能工作）
   * ===================================================================== */
  function makeLabelSprite(text, subText, color) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var W = 512;
    var H = 176;
    canvas.width = W;
    canvas.height = H;

    // 圆角背景
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    ctx.fillStyle = 'rgba(9,16,27,.82)';
    roundRect(8, 8, W - 16, H - 16, 24);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 62px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, 62);

    ctx.fillStyle = color;
    ctx.font = '38px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(subText, W / 2, 128);

    var texture = new T.CanvasTexture(canvas);
    texture.minFilter = T.LinearFilter;
    var material = new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new T.Sprite(material);
    sprite.scale.set(8.6, 8.6 * (H / W), 1);
    sprite.userData.isLabel = true;
    return sprite;
  }

  /* =======================================================================
   * 3. 场景搭建
   * ===================================================================== */
  function initRenderer() {
    var canvas = document.getElementById('cc-scene-canvas');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    return canvas;
  }

  var BASE_FOV = 48;   // 以该垂直视角（16:9 画布）为基准，按画布比例换算，保证不同宽高比下取景一致

  function resizeRenderer() {
    var canvas = document.getElementById('cc-scene-canvas');
    if (!renderer || !canvas) return;
    var w = canvas.clientWidth || 800;
    var h = canvas.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 关键：按"横向视野恒定"换算垂直视角。
    // 三个食堂是左右排布的，若固定垂直视角，画布变矮（手机 / 窄屏）时左右两侧会被裁掉，
    // 固定横向视野则能保证任何比例下都能看全三栋楼。
    var baseAspect = 16 / 9;
    var baseHalf = (BASE_FOV * Math.PI) / 360;
    var halfH = Math.atan(Math.tan(baseHalf) * baseAspect);   // 基准横向半角
    var halfV = Math.atan(Math.tan(halfH) / Math.max(0.35, camera.aspect));
    camera.fov = Math.min(96, Math.max(24, (halfV * 360) / Math.PI));
    camera.updateProjectionMatrix();
  }

  function initScene() {
    scene = new T.Scene();
    scene.background = new T.Color(0x0e1726);
    scene.fog = new T.Fog(0x0e1726, 100, 260);

    camera = new T.PerspectiveCamera(48, 16 / 9, 0.1, 800);
    camera.position.set(26, 42, 60);

    // 灯光：环境光 + 半球光 + 主平行光（带阴影）+ 补光
    scene.add(new T.AmbientLight(0xdfe9f5, 0.55));
    scene.add(new T.HemisphereLight(0xcfe3ff, 0x1b2536, 0.55));

    var dir = new T.DirectionalLight(0xffffff, 0.95);
    dir.position.set(28, 42, 22);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 160;
    dir.shadow.camera.left = -60;
    dir.shadow.camera.right = 60;
    dir.shadow.camera.top = 60;
    dir.shadow.camera.bottom = -60;
    scene.add(dir);

    var fill = new T.DirectionalLight(0x8fb6e8, 0.35);
    fill.position.set(-24, 18, -22);
    scene.add(fill);
  }

  function initGround() {
    // 草地 / 场地
    var groundGeo = new T.PlaneGeometry(200, 200);
    var groundMat = new T.MeshStandardMaterial({ color: 0x1e3040, roughness: 0.95, metalness: 0.05 });
    var ground = new T.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.pickable = false;
    scene.add(ground);

    // 主干道：一条南北向主路（三个食堂都排在它两侧），一条东西向支路
    var roadMat = new T.MeshStandardMaterial({ color: 0x2b3d52, roughness: 0.9 });
    var roadNS = new T.Mesh(new T.BoxGeometry(7, 0.16, 78), roadMat);
    roadNS.position.set(0, 0.08, 4);
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    var roadEW = new T.Mesh(new T.BoxGeometry(92, 0.16, 6.5), roadMat);
    roadEW.position.set(0, 0.08, 18);
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    // 中心广场 + 喷泉（位于南北主路中段，作为视觉中心与方位参照）
    var plaza = new T.Mesh(
      new T.CylinderGeometry(6.2, 6.2, 0.3, 48),
      new T.MeshStandardMaterial({ color: 0x35506b, roughness: 0.85 })
    );
    plaza.position.set(0, 0.15, 8);
    plaza.receiveShadow = true;
    scene.add(plaza);

    var fountainBase = new T.Mesh(
      new T.CylinderGeometry(2.2, 2.6, 1.0, 32),
      new T.MeshStandardMaterial({ color: 0x7f95ad, roughness: 0.7 })
    );
    fountainBase.position.set(0, 0.6, 8);
    fountainBase.castShadow = true;
    scene.add(fountainBase);

    var water = new T.Mesh(
      new T.CylinderGeometry(1.95, 1.95, 0.2, 32),
      new T.MeshStandardMaterial({ color: 0x49b6e8, emissive: 0x1d5c7a, roughness: 0.25, metalness: 0.4 })
    );
    water.position.set(0, 1.12, 8);
    water.name = 'water';
    scene.add(water);

    // 校园其他建筑（图书馆 / 教学楼 / 宿舍楼），提供空间参照，使食堂位置可被感知
    var neutralA = new T.MeshStandardMaterial({ color: 0x54697f, roughness: 0.8, metalness: 0.1 });
    var neutralB = new T.MeshStandardMaterial({ color: 0x455a70, roughness: 0.85, metalness: 0.1 });

    function campusBlock(x, z, w, d, h, mat, name) {
      var g = new T.Group();
      var body = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      var top = new T.Mesh(new T.BoxGeometry(w + 0.4, 0.3, d + 0.4),
        new T.MeshStandardMaterial({ color: 0x7b8ea1, roughness: 0.7 }));
      top.position.y = h + 0.15;
      g.add(top);
      g.position.set(x, 0, z);
      g.userData.label = name;
      scene.add(g);
      return g;
    }
    // 教学楼（主路西侧后方）、图书馆（主路东侧后方）、宿舍楼（南侧两栋）
    campusBlock(-30, 27, 18, 10, 7, neutralA, '教学楼');
    campusBlock(28, 27, 16, 10, 6, neutralB, '图书馆');
    campusBlock(-30, -21, 18, 9, 6, neutralB, '学生宿舍 1 号楼');
    campusBlock(30, -21, 18, 9, 6, neutralA, '学生宿舍 2 号楼');

    // 树木（固定伪随机，保证每次进入场景布局一致，便于截图复现）
    var seed = 20250106;
    function rnd() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
    var trunkMat = new T.MeshStandardMaterial({ color: 0x6b4b2a, roughness: 0.9 });
    var leafMat = new T.MeshStandardMaterial({ color: 0x2f7a52, roughness: 0.85 });
    var leafMat2 = new T.MeshStandardMaterial({ color: 0x3d8f60, roughness: 0.85 });

    for (var i = 0; i < 34; i++) {
      var x = (rnd() - 0.5) * 86;
      var z = (rnd() - 0.5) * 66 + 2;
      // 避开三栋食堂、其他建筑、道路与广场
      if (Math.abs(x) < 34 && Math.abs(z) < 12) continue;
      if (Math.abs(x) < 38 && z > 18 && z < 34) continue;
      if (Math.abs(x) < 38 && z < -10 && z > -26) continue;
      if (Math.abs(z - 18) < 5 || Math.abs(x) < 5.2) continue;
      if (Math.sqrt(x * x + (z - 8) * (z - 8)) < 8.5) continue;

      var scale = 0.8 + rnd() * 0.8;
      var tree = new T.Group();
      var trunk = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 1.7, 8), trunkMat);
      trunk.position.y = 0.85;
      trunk.castShadow = true;
      tree.add(trunk);
      var crown = new T.Mesh(new T.IcosahedronGeometry(1.35, 0), i % 2 ? leafMat : leafMat2);
      crown.position.y = 2.5;
      crown.castShadow = true;
      tree.add(crown);
      tree.position.set(x, 0.2, z);
      tree.scale.setScalar(scale);
      scene.add(tree);
    }

    // 悬停指示环
    hoverRing = new T.Mesh(
      new T.RingGeometry(0.9, 1.25, 32),
      new T.MeshBasicMaterial({ color: 0x63d2ff, transparent: true, opacity: 0.9, side: T.DoubleSide })
    );
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.position.y = 0.22;
    hoverRing.visible = false;
    scene.add(hoverRing);
  }

  /* =======================================================================
   * 4. 食堂楼栋
   * ===================================================================== */
  function buildCanteen(canteen, index) {
    var pos = canteen.position3d;
    var h = heightFor(canteen.seats);
    var group = new T.Group();
    group.position.set(pos.x, 0, pos.z);
    group.userData.canteenId = canteen.id;
    scene.add(group);

    var floorCount = Math.max(1, (canteen.floors || []).length);
    var floorH = h / floorCount;
    var bodyMat = new T.MeshStandardMaterial({
      color: new T.Color(canteen.color),
      roughness: 0.55,
      metalness: 0.18,
      emissive: new T.Color(canteen.color).multiplyScalar(0.12)
    });

    var floorMeshes = [];
    for (var f = 0; f < floorCount; f++) {
      var mesh = new T.Mesh(new T.BoxGeometry(pos.width, floorH * 0.94, pos.depth), bodyMat);
      mesh.position.y = floorH * (f + 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.canteenId = canteen.id;
      mesh.userData.floorLevel = f + 1;
      mesh.userData.baseY = mesh.position.y;
      group.add(mesh);
      floorMeshes.push(mesh);
      pickTargets.push(mesh);
    }

    // 屋顶（略带女儿墙效果）
    var roof = new T.Mesh(
      new T.BoxGeometry(pos.width + 0.5, 0.42, pos.depth + 0.5),
      new T.MeshStandardMaterial({ color: 0xdbe4ef, roughness: 0.7 })
    );
    roof.position.y = h + 0.2;
    roof.castShadow = true;
    roof.userData.canteenId = canteen.id;
    roof.userData.isRoof = true;
    group.add(roof);
    pickTargets.push(roof);

    // 招牌（三层薄板）
    var signMat = new T.MeshStandardMaterial({
      color: 0xffffff, emissive: new T.Color(canteen.color).multiplyScalar(0.5), roughness: 0.4
    });
    var sign = new T.Mesh(new T.BoxGeometry(pos.width * 0.62, 1.15, 0.28), signMat);
    sign.position.set(0, h - 1.1, pos.depth / 2 + 0.22);
    sign.castShadow = true;
    sign.userData.canteenId = canteen.id;
    group.add(sign);
    pickTargets.push(sign);

    // 大门
    var door = new T.Mesh(
      new T.BoxGeometry(3.0, 2.1, 0.2),
      new T.MeshStandardMaterial({ color: 0x24313f, roughness: 0.6 })
    );
    door.position.set(0, 1.15, pos.depth / 2 + 0.12);
    group.add(door);

    // 名称标签：三栋楼错开高度，避免标签在透视下互相遮挡
    var labelLift = [5.2, 6.8, 4.6][index % 3];
    var label = makeLabelSprite(canteen.name, canteen.shortName + ' · ' + canteen.seats + ' 座', canteen.color);
    label.position.set(pos.width * 0.16, h + labelLift, 0);
    group.add(label);

    // 客流悬浮柱：立在楼顶左后角，与名称标签分居两侧，避免相互遮挡
    var barX = -pos.width * 0.33;
    var barZ = -pos.depth * 0.26;
    var barBase = new T.Mesh(
      new T.CylinderGeometry(0.75, 0.95, 0.25, 20),
      new T.MeshStandardMaterial({ color: 0x8fa4bb, transparent: true, opacity: 0.7 })
    );
    barBase.position.set(barX, h + 0.45, barZ);
    group.add(barBase);

    var bar = new T.Mesh(
      new T.CylinderGeometry(0.7, 0.7, 1, 20),
      new T.MeshStandardMaterial({ color: 0x3fa36b, emissive: 0x1c4a32, roughness: 0.35, transparent: true, opacity: 0.92 })
    );
    bar.position.copy(barBase.position);
    bar.userData.canteenId = canteen.id;
    bar.userData.isBar = true;
    group.add(bar);

    buildings.push({
      id: canteen.id,
      canteen: canteen,
      group: group,
      floors: floorMeshes,
      floorH: floorH,
      height: h,
      label: label,
      bar: bar,
      barBase: barBase,
      bodyMat: bodyMat,
      maxCount: U.max(data.stats.traffic[canteen.id].hourly.concat(data.stats.traffic[canteen.id].hourlyWeekend))
    });

    void index;
  }

  /* =======================================================================
   * 5. 由数据刷新场景（客流柱高度 / 颜色、标签文案）
   * ===================================================================== */
  function updateFromData() {
    buildings.forEach(function (b) {
      var count = countFor(b.id);
      var level = CC.derive.crowdLevel(count);
      var ratio = U.clamp(count / (b.maxCount || 1), 0.04, 1);
      var barH = 1 + ratio * 7;

      b.bar.scale.y = barH;
      b.bar.position.set(-b.canteen.position3d.width * 0.33, b.height + 0.57 + barH / 2, -b.canteen.position3d.depth * 0.26);
      b.barBase.position.set(-b.canteen.position3d.width * 0.33, b.height + 0.45, -b.canteen.position3d.depth * 0.26);

      var colorMap = { idle: 0x3fa36b, normal: 0x2f7fd6, busy: 0xd9a021, full: 0xd94f6a };
      var key = level.className.replace('crowd-', '');
      b.bar.material.color.setHex(colorMap[key] || 0x2f7fd6);
      b.bar.material.emissive.setHex(colorMap[key] || 0x2f7fd6).multiplyScalar(0.35);

      // 标签第二行显示实时人数
      var sub = level.label + ' · ' + U.int(count) + ' 人';
      if (b.label && b.label.material && b.label.material.map) {
        if (b.label.userData.sub !== sub) {
          b.label.userData.sub = sub;
          var sprite = makeLabelSprite(b.canteen.name, sub, b.canteen.color);
          b.label.material.map.dispose();
          b.label.material.map = sprite.material.map;
          b.label.material.needsUpdate = true;
          sprite.material.dispose();
        }
      }
    });

    // 图例
    $('#cc-scene-legend').html(
      '<div class="mb-1 fw-semibold">拥挤度图例</div>' +
      '<div class="cc-scene-legend__row"><span class="cc-scene-legend__dot" style="background:#3fa36b"></span>空闲（≤300 人）</div>' +
      '<div class="cc-scene-legend__row"><span class="cc-scene-legend__dot" style="background:#2f7fd6"></span>正常（≤700 人）</div>' +
      '<div class="cc-scene-legend__row"><span class="cc-scene-legend__dot" style="background:#d9a021"></span>较挤（≤1100 人）</div>' +
      '<div class="cc-scene-legend__row"><span class="cc-scene-legend__dot" style="background:#d94f6a"></span>拥挤（&gt;1100 人）</div>' +
      '<div class="cc-scene-legend__row mt-1"><span class="cc-scene-legend__dot" style="background:#8fa4bb"></span>柱高 = 当前在店人数</div>'
    );

    // 场景左上角信息
    var total = buildings.reduce(function (a, b) { return a + countFor(b.id); }, 0);
    var dishTotal = data.dishes.length;
    $('#cc-scene-info').html(
      '<b>' + U.esc(data.stats.meta.campus || CC.cfg.campus) + ' 食堂三维总览</b>' +
      '<dl>' +
      '  <dt>时刻</dt><dd>' + U.esc(slotLabel()) + '（' + (isWeekend() ? '周末' : '工作日') + '）</dd>' +
      '  <dt>在店合计</dt><dd>' + U.int(total) + ' 人</dd>' +
      '  <dt>楼栋</dt><dd>' + buildings.length + ' 栋</dd>' +
      '  <dt>收录菜品</dt><dd>' + dishTotal + ' 道</dd>' +
      '</dl>'
    );

    var $stats = $('#cc-scene-stats');
    $stats.html(buildings.map(function (b) {
      return '<span><i style="background:' + U.esc(b.canteen.color) + '"></i>' + U.esc(b.canteen.shortName) +
        '：' + U.int(countFor(b.id)) + ' 人</span>';
    }).join(''));
  }

  /* =======================================================================
   * 6. 详情面板
   * ===================================================================== */
  function showDetail(canteenId, focusCamera) {
    var b = null;
    buildings.forEach(function (x) { if (x.id === canteenId) b = x; });
    if (!b) return;
    selectedId = canteenId;

    var c = b.canteen;
    var count = countFor(c.id);
    var level = CC.derive.crowdLevel(count);
    var dishes = data.dishes.filter(function (d) { return d.canteenId === c.id; });
    var avgPrice = dishes.length ? U.round(U.avg(dishes.map(function (d) { return d.price; })), 2) : 0;
    var idx = hourIndex(currentHourForSlot());
    var wait = data.stats.waitMinutes[c.id][idx];

    $('#cc-scene-detail').html(
      '<h2 class="cc-section-title"><i class="bi bi-building"></i> ' + U.esc(c.name) +
      ' <span class="cc-badge cc-badge--brand">' + U.esc(c.id) + '</span></h2>' +
      '<div class="cc-dish__meta mb-2">' +
      '  <span class="cc-badge cc-badge--brand"><i class="bi bi-geo-alt"></i> ' + U.esc(c.location) + '</span>' +
      '  <span class="cc-badge">' + U.esc(c.brand) + '</span>' +
      '</div>' +
      '<div class="cc-crowd cc-crowd--' + level.className.replace('crowd-', '') + ' mb-2">' +
      '  <div class="d-flex justify-content-between"><span>当前在店（' + U.esc(slotLabel()) + '）</span>' +
      '  <strong>' + U.int(count) + ' 人 · ' + U.esc(level.label) + '</strong></div>' +
      '  <div class="cc-crowd__bar"><div class="cc-crowd__fill" style="width:' +
        U.clamp((count / (b.maxCount || 1)) * 100, 3, 100).toFixed(1) + '%"></div></div>' +
      '  <div class="d-flex justify-content-between mt-1"><span>预计排队 ' + U.seconds(wait) + '</span>' +
      '  <span>座位 ' + U.int(c.seats) + '</span></div>' +
      '</div>' +
      '<dl class="row mb-2 g-0" style="font-size:.85rem">' +
      '  <dt class="col-4 cc-hint">营业时间</dt><dd class="col-8">' + (c.openHours || []).map(U.esc).join(' / ') + '</dd>' +
      '  <dt class="col-4 cc-hint">楼层</dt><dd class="col-8">' + U.esc(String(c.floor)) + ' 层（' +
        (c.floors || []).map(function (f) { return U.esc(f.name); }).join('；') + '）</dd>' +
      '  <dt class="col-4 cc-hint">3D 模型尺寸</dt><dd class="col-8">' +
        U.esc(String(c.position3d.width)) + ' × ' + U.esc(String(c.position3d.depth)) + ' × ' +
        b.height.toFixed(1) + ' 单位（高按座位数映射）</dd>' +
      '  <dt class="col-4 cc-hint">收录菜品</dt><dd class="col-8">' + dishes.length + ' 道 · 均价 ' + U.money(avgPrice) + '</dd>' +
      '  <dt class="col-4 cc-hint">学生评分</dt><dd class="col-8">' + CC.ui.stars(c.rating) + '</dd>' +
      '</dl>' +
      '<p class="mb-2" style="font-size:.85rem;color:var(--cc-text-soft)">' + U.esc(c.description) + '</p>' +
      '<div class="d-flex gap-2 flex-wrap">' +
      '  <a class="btn btn-sm btn-primary" href="dishes.html?canteen=' + encodeURIComponent(c.id) + '">' +
      '    <i class="bi bi-search"></i> 查该食堂菜品</a>' +
      '  <a class="btn btn-sm btn-outline-secondary" href="canteens.html?canteen=' + encodeURIComponent(c.id) + '">' +
      '    <i class="bi bi-file-text"></i> 完整档案</a>' +
      '  <button class="btn btn-sm btn-outline-primary" type="button" data-focus="' + U.esc(c.id) + '">' +
      '    <i class="bi bi-bounding-box"></i> 相机聚焦</button>' +
      '</div>'
    );

    // 高亮选中的楼栋
    buildings.forEach(function (x) {
      var on = x.id === selectedId;
      x.bodyMat.emissive.setHex(on ? new T.Color(x.canteen.color).multiplyScalar(0.55).getHex() : new T.Color(x.canteen.color).multiplyScalar(0.12).getHex());
      if (x.label) x.label.scale.set(on ? 9.8 : 8.6, (on ? 9.8 : 8.6) * (176 / 512), 1);
    });

    if (focusCamera) {
      focusOn(b);
    }
  }

  function focusOn(b) {
    if (!controls) return;
    var pos = b.canteen.position3d;
    controls.target.set(pos.x, b.height / 2, pos.z);
    var dist = Math.max(pos.width, pos.depth) * 2.4 + 12;
    camera.position.set(pos.x + dist * 0.62, b.height + dist * 0.5, pos.z + dist * 0.8);
    controls.spherical.setFromVector3(camera.position.clone().sub(controls.target));
    controls.sphericalDelta.set(0, 0, 0);
    controls.panOffset.set(0, 0, 0);
    controls.scale = 1;
  }

  /* =======================================================================
   * 7. 拾取与交互
   * ===================================================================== */
  function pickAt(clientX, clientY) {
    var canvas = renderer.domElement;
    var rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(pickTargets, false);
    return hits.length ? hits[0] : null;
  }

  function bindInteraction() {
    var canvas = renderer.domElement;
    var down = null;

    canvas.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY, t: Date.now() };
    });

    canvas.addEventListener('pointerup', function (e) {
      if (!down) return;
      var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
      var elapsed = Date.now() - down.t;
      down = null;
      // 拖拽超过 6 像素或按住超过 600ms 视为旋转操作，不触发点击
      if (moved > 6 || elapsed > 600 || e.button !== 0) return;
      var hit = pickAt(e.clientX, e.clientY);
      if (hit && hit.object.userData.canteenId) {
        showDetail(hit.object.userData.canteenId, false);
        CC.ui.toast('已选中「' + (buildings.filter(function (b) { return b.id === hit.object.userData.canteenId; })[0] || {}).canteen.name + '」，右侧显示详情。', 'info', 2200);
      } else {
        selectedId = null;
        buildings.forEach(function (x) {
          x.bodyMat.emissive.setHex(new T.Color(x.canteen.color).multiplyScalar(0.12).getHex());
        });
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      var hit = pickAt(e.clientX, e.clientY);
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (hit) {
        var p = hit.point;
        hoverRing.position.set(Math.round(p.x / 2) * 2, 0.22, Math.round(p.z / 2) * 2);
        hoverRing.visible = true;
      } else {
        hoverRing.visible = false;
      }
    });

    canvas.addEventListener('pointerleave', function () {
      hoverRing.visible = false;
    });

    $(document).on('click', '[data-focus]', function () {
      var id = $(this).data('focus');
      buildings.forEach(function (b) { if (b.id === id) focusOn(b); });
    });

    $(window).on('keydown', function (e) {
      if (e.key === 'r' || e.key === 'R') {
        if (selectedId) {
          buildings.forEach(function (b) { if (b.id === selectedId) focusOn(b); });
        } else {
          resetView();
        }
      }
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        toggleRotate();
      }
    });

    $(window).on('resize orientationchange', U.debounce(function () {
      resizeRenderer();
    }, 200));
  }

  /* =======================================================================
   * 8. 工具条动作
   * ===================================================================== */
  function toggleRotate() {
    state.autoRotate = !state.autoRotate;
    controls.autoRotate = state.autoRotate;
    $('#btn-rotate').toggleClass('btn-outline-primary', state.autoRotate)
      .toggleClass('btn-outline-secondary', !state.autoRotate)
      .html('<i class="bi bi-arrow-repeat"></i> 自动旋转：' + (state.autoRotate ? '开' : '关'));
  }

  function toggleWireframe() {
    state.wireframe = !state.wireframe;
    buildings.forEach(function (b) {
      b.bodyMat.wireframe = state.wireframe;
    });
    $('#btn-wire').toggleClass('active', state.wireframe);
    CC.ui.toast(state.wireframe ? '已开启线框模式，可看清楼栋几何结构。' : '已关闭线框模式。', 'info', 2000);
  }

  function toggleExplode() {
    state.exploded = !state.exploded;
    buildings.forEach(function (b) {
      b.floors.forEach(function (m, i) {
        var target = state.exploded ? m.userData.baseY + i * 1.6 : m.userData.baseY;
        m.userData.targetY = target;
      });
    });
    $('#btn-explode').toggleClass('active', state.exploded);
    CC.ui.toast(state.exploded ? '已分层展开：每层代表一个楼层，可在详情面板查看楼层档口。' : '已恢复整体楼栋。', 'info', 2400);
  }

  function cycleSlot() {
    var order = ['now', 'morning', 'lunch', 'dinner'];
    state.slot = order[(order.indexOf(state.slot) + 1) % order.length];
    $('#btn-time-label').text(slotLabel());
    updateFromData();
    if (selectedId) showDetail(selectedId, false);
  }

  function resetView() {
    camera.position.set(26, 42, 60);
    controls.target.set(0, 2.5, 6);
    controls.spherical.setFromVector3(camera.position.clone().sub(controls.target));
    controls.sphericalDelta.set(0, 0, 0);
    controls.panOffset.set(0, 0, 0);
    controls.scale = 1;
    CC.ui.toast('视角已复位。', 'info', 1600);
  }

  function saveShot() {
    try {
      renderer.render(scene, camera);
      var url = renderer.domElement.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = '食堂三维场景-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      CC.ui.toast('当前视角已保存为 PNG 图片（可直接插入报告）。', 'success', 3600);
    } catch (err) {
      CC.ui.toast('截图失败：' + err.message + '。请改用系统截图工具（Win + Shift + S）。', 'danger', 4200);
    }
  }

  /* =======================================================================
   * 9. 渲染循环
   * ===================================================================== */
  function animate() {
    frameId = window.requestAnimationFrame(animate);
    var t = performance.now() / 1000;

    // 楼层分层动画
    buildings.forEach(function (b) {
      b.floors.forEach(function (m) {
        if (m.userData.targetY !== undefined) {
          m.position.y += (m.userData.targetY - m.position.y) * 0.14;
        }
      });
    });

    // 悬浮柱轻微呼吸效果（仅在拥挤时提示）
    buildings.forEach(function (b, i) {
      var count = countFor(b.id);
      if (count > CC.cfg.business.peakThreshold) {
        b.bar.material.opacity = 0.7 + Math.abs(Math.sin(t * 2 + i)) * 0.3;
      } else {
        b.bar.material.opacity = 0.92;
      }
    });

    // 喷泉水波动
    var water = scene.getObjectByName('water');
    if (water) {
      water.position.y = 1.12 + Math.sin(t * 1.6) * 0.05;
      water.rotation.y = t * 0.15;
    }

    if (controls) controls.update();
    renderer.render(scene, camera);
  }

  /* =======================================================================
   * 10. 启动 / 环境检测
   * ===================================================================== */
  function checkWebGL() {
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  function showMask(text, isError) {
    var $mask = $('#cc-scene-mask');
    $mask.removeClass('d-none');
    $mask.find('.spinner-border').toggleClass('d-none', !!isError);
    $('#cc-scene-mask-text').html(text);
  }

  function hideMask() {
    $('#cc-scene-mask').addClass('d-none');
  }

  function start() {
    if (!T) {
      showMask('三维库未能加载：<span class="cc-mono">' + (window.__CC_THREE_ERROR || 'vendor/three.min.js 缺失') +
        '</span><br>请确认 vendor/three.min.js 与 vendor/SimpleOrbit.js 两个文件都存在' +
        '（部分解压工具会漏解 .js 文件），然后刷新页面重试。', true);
      CC.api.renderError('#cc-scene-alert', 'three.min.js', new CC.api.CCError(
        'Three.js 未能加载，三维场景无法渲染',
        '页面已通过 onerror 捕获到脚本加载失败。\n排查建议：\n1) 确认 vendor/three.min.js 文件存在且未被杀毒软件删除；\n2) 若从压缩包解压，注意部分解压工具会漏解 .js 文件；\n3) 控制台 Network 面板查看该文件的状态码。'
      ), function () { window.location.reload(); });
      return;
    }
    if (!window.SimpleOrbit) {
      showMask('轨道控制器未能加载：<span class="cc-mono">' + (window.__CC_ORBIT_ERROR || 'vendor/SimpleOrbit.js 缺失') + '</span>', true);
      return;
    }
    if (!checkWebGL()) {
      showMask('当前浏览器 / 显卡驱动不支持 WebGL，无法显示三维场景。<br>' +
        '建议：更新显卡驱动、在 Chrome 设置中开启“使用硬件加速”，或改用 Edge / Firefox 打开。', true);
      $('#cc-scene-alert').html(
        '<div class="cc-alert cc-alert--warning"><div class="cc-alert__icon"><i class="bi bi-gpu-card"></i></div>' +
        '<div class="cc-alert__body"><h4 class="cc-alert__title">WebGL 不可用</h4>' +
        '<p class="cc-alert__msg mb-0">三维展示依赖 WebGL。页面其余功能（查询、图表）不受影响，' +
        '可继续使用 <a href="analytics.html">数据看板</a> 查看二维图表。</p></div></div>'
      );
      return;
    }

    try {
      initScene();
      initRenderer();
      resizeRenderer();
      initGround();
      data.canteens.forEach(function (c, i) { buildCanteen(c, i); });

      raycaster = new T.Raycaster();
      pointer = new T.Vector2();
      controls = new window.SimpleOrbit(camera, renderer.domElement, {
        target: [0, 2.5, 6],
        minDistance: 14,
        maxDistance: 130,
        autoRotate: state.autoRotate,
        autoRotateSpeed: 0.5,
        damping: 0.12
      });

      hoverRing.visible = false;
      bindInteraction();
      updateFromData();
      hideMask();

      var wanted = U.query('canteen');
      if (wanted && data.canteens.some(function (c) { return c.id === wanted; })) {
        showDetail(wanted, true);
      } else {
        $('#cc-scene-info').find('b').text('加载完成：点击任意楼栋查看详情');
      }

      if (!running) {
        running = true;
        animate();
      }
      CC.api.renderModeBadge('#cc-data-mode');
    } catch (err) {
      showMask('三维场景初始化失败：' + U.esc(err.message) + '<br>请刷新页面重试，或查看控制台错误信息。', true);
      CC.api.renderError('#cc-scene-alert', '三维场景初始化', new CC.api.CCError(err.message, (err.stack || '').slice(0, 600)), function () {
        window.location.reload();
      });
    }
  }

  /* =======================================================================
   * 11. 数据加载
   * ===================================================================== */
  function load(retry) {
    $('#cc-scene-alert').empty();
    showMask('正在加载食堂与客流数据…', false);
    CC.api.loadAll(['canteens', 'dishes', 'stats']).then(function (results) {
      var failure = CC.api.firstFailure(results);
      if (failure) {
        CC.api.renderError('#cc-scene-alert', failure.name, failure.error, function () { load(true); });
        showMask('数据加载失败，三维场景无法生成。请先处理上方错误提示。', true);
        return;
      }
      data.canteens = results[0].data.list;
      data.dishes = results[1].data.list;
      data.stats = results[2].data;

      // 数据合法性检查：缺少 3D 坐标的食堂无法摆放
      var missing = data.canteens.filter(function (c) { return !c.position3d; });
      if (missing.length) {
        CC.ui.toast('有 ' + missing.length + ' 个食堂缺少 position3d 坐标配置，已跳过建模：' +
          missing.map(function (c) { return c.name; }).join('、'), 'warning', 5200);
        data.canteens = data.canteens.filter(function (c) { return !!c.position3d; });
      }
      if (!data.canteens.length) {
        showMask('数据中没有可用的食堂三维坐标，无法生成场景。<br>请在 data/canteens.json 中补充 position3d 字段。', true);
        return;
      }

      CC.uiKit.setCartSource(data.dishes);
      start();
    });
  }

  CC.ready(function ($) {
    CC.uiKit.mount();
    CC.uiKit.ensureModeBanner();
    load(false);

    $('#btn-rotate').on('click', toggleRotate);
    $('#btn-wire').on('click', toggleWireframe);
    $('#btn-explode').on('click', toggleExplode);
    $('#btn-time').on('click', cycleSlot);
    $('#btn-reset').on('click', resetView);
    $('#btn-shot').on('click', saveShot);

    $('#cc-scene-reload').on('click', function () {
      CC.api.clearCache();
      load(true);
    });

    $(document).on('cc:reload-data', function () { load(true); });
  });
})(jQuery, window.CC);
