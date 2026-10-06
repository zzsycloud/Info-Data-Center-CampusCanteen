/*
 * SimpleOrbit.js —— 轻量级轨道控制器（自研，配合 vendor/three.min.js 使用）
 * 功能：鼠标左键拖拽旋转、滚轮缩放、右键拖拽平移、双指捏合缩放、阻尼惯性、可选自动旋转。
 * 依赖：THREE（全局变量）
 * 说明：课程要求不使用未讲授的框架，Three.js 官方 examples 里的 OrbitControls 需要额外下载，
 *       这里用原生指针事件 + 球坐标实现同样的交互，代码量小且便于阅读。
 */
(function (global) {
  'use strict';

  if (!global.THREE) {
    throw new Error('SimpleOrbit 需要先加载 three.min.js');
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function SimpleOrbit(camera, domElement, options) {
    var opt = options || {};
    this.camera = camera;
    this.dom = domElement;
    this.target = new THREE.Vector3(
      opt.target ? opt.target[0] : 0,
      opt.target ? opt.target[1] : 0,
      opt.target ? opt.target[2] : 0
    );
    this.minDistance = opt.minDistance != null ? opt.minDistance : 6;
    this.maxDistance = opt.maxDistance != null ? opt.maxDistance : 60;
    this.minPolar = opt.minPolar != null ? opt.minPolar : 0.25;
    this.maxPolar = opt.maxPolar != null ? opt.maxPolar : Math.PI / 2 - 0.06;
    this.rotateSpeed = opt.rotateSpeed != null ? opt.rotateSpeed : 1.0;
    this.zoomSpeed = opt.zoomSpeed != null ? opt.zoomSpeed : 1.0;
    this.damping = opt.damping != null ? opt.damping : 0.12;
    this.autoRotate = !!opt.autoRotate;
    this.autoRotateSpeed = opt.autoRotateSpeed != null ? opt.autoRotateSpeed : 0.45;

    // 由当前相机位置反推球坐标
    var offset = camera.position.clone().sub(this.target);
    this.spherical = new THREE.Spherical().setFromVector3(offset);
    this.sphericalDelta = new THREE.Spherical(0, 0, 0);
    this.panOffset = new THREE.Vector3();
    this.scale = 1;

    this.enabled = true;
    this._state = 'none';
    this._pointers = {};
    this._pointerCount = 0;
    this._last = { x: 0, y: 0 };
    this._pinch = 0;
    this._listeners = {};
    this._bind();
    this.update();
  }

  SimpleOrbit.prototype._bind = function () {
    var self = this;
    var dom = this.dom;

    function down(e) {
      if (!self.enabled) return;
      self._pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      self._pointerCount = Object.keys(self._pointers).length;
      if (self._pointerCount === 1) {
        self._state = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
        self._last.x = e.clientX;
        self._last.y = e.clientY;
        self.autoRotate = false;
        self._emit('start');
      } else if (self._pointerCount === 2) {
        self._state = 'pinch';
        self._pinch = self._pinchDistance();
      }
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
    }

    function move(e) {
      if (!self.enabled) return;
      if (!self._pointers[e.pointerId]) {
        self._emit('hover');
        return;
      }
      self._pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (self._state === 'rotate') {
        var dx = e.clientX - self._last.x;
        var dy = e.clientY - self._last.y;
        var h = dom.clientHeight || 1;
        self.sphericalDelta.theta -= (2 * Math.PI * dx * self.rotateSpeed) / h;
        self.sphericalDelta.phi -= (2 * Math.PI * dy * self.rotateSpeed) / h;
        self._last.x = e.clientX;
        self._last.y = e.clientY;
        self._emit('change');
      } else if (self._state === 'pan') {
        var dxp = e.clientX - self._last.x;
        var dyp = e.clientY - self._last.y;
        self._pan(dxp, dyp);
        self._last.x = e.clientX;
        self._last.y = e.clientY;
        self._emit('change');
      } else if (self._state === 'pinch' && self._pointerCount === 2) {
        var d = self._pinchDistance();
        if (self._pinch > 0 && d > 0) {
          self.scale *= self._pinch / d;
          self._emit('change');
        }
        self._pinch = d;
      }
    }

    function up(e) {
      delete self._pointers[e.pointerId];
      self._pointerCount = Object.keys(self._pointers).length;
      if (self._pointerCount === 1) {
        var remaining = self._pointers[Object.keys(self._pointers)[0]];
        self._last.x = remaining.x;
        self._last.y = remaining.y;
        self._state = 'rotate';
      } else if (self._pointerCount === 0) {
        self._state = 'none';
        self._emit('end');
      }
      dom.releasePointerCapture && dom.releasePointerCapture(e.pointerId);
    }

    function wheel(e) {
      if (!self.enabled) return;
      e.preventDefault();
      var delta = e.deltaY > 0 ? 1.08 : 1 / 1.08;
      self.scale *= Math.pow(delta, self.zoomSpeed);
      self._emit('change');
    }

    dom.addEventListener('pointerdown', down);
    dom.addEventListener('pointermove', move);
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', wheel, { passive: false });
    dom.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    this._domListeners = { down: down, move: move, up: up, wheel: wheel };
    void self;
  };

  SimpleOrbit.prototype._pinchDistance = function () {
    var ids = Object.keys(this._pointers);
    if (ids.length < 2) return 0;
    var a = this._pointers[ids[0]];
    var b = this._pointers[ids[1]];
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  };

  SimpleOrbit.prototype._pan = function (dx, dy) {
    var el = this.dom;
    var offset = this.camera.position.clone().sub(this.target);
    var distance = offset.length();
    var fov = (this.camera.fov * Math.PI) / 180;
    var targetHeight = 2 * distance * Math.tan(fov / 2);
    var factorX = (targetHeight * -dx) / (el.clientHeight || 1);
    var factorY = (targetHeight * dy) / (el.clientHeight || 1);
    var te = this.camera.matrix.elements;
    var right = new THREE.Vector3(te[0], te[1], te[2]);
    var up = new THREE.Vector3(te[4], te[5], te[6]);
    this.panOffset.addScaledVector(right, factorX);
    this.panOffset.addScaledVector(up, factorY);
  };

  SimpleOrbit.prototype.on = function (name, fn) {
    (this._listeners[name] = this._listeners[name] || []).push(fn);
    return this;
  };

  SimpleOrbit.prototype._emit = function (name) {
    var list = this._listeners[name];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      list[i](this);
    }
  };

  SimpleOrbit.prototype.reset = function () {
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.target));
  };

  SimpleOrbit.prototype.update = function () {
    if (this.autoRotate && this._state === 'none') {
      this.sphericalDelta.theta -= this.autoRotateSpeed * 0.01;
    }
    // 阻尼插值
    this.spherical.theta += this.sphericalDelta.theta * this.damping;
    this.spherical.phi += this.sphericalDelta.phi * this.damping;
    this.spherical.phi = clamp(this.spherical.phi, this.minPolar, this.maxPolar);

    this.target.add(this.panOffset.clone().multiplyScalar(this.damping));
    this.spherical.radius *= 1 + (this.scale - 1) * this.damping;
    this.spherical.radius = clamp(this.spherical.radius, this.minDistance, this.maxDistance);

    this.sphericalDelta.theta *= 1 - this.damping;
    this.sphericalDelta.phi *= 1 - this.damping;
    this.panOffset.multiplyScalar(1 - this.damping);
    this.scale = 1 + (this.scale - 1) * (1 - this.damping);

    var offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  };

  SimpleOrbit.prototype.dispose = function () {
    var dom = this.dom;
    var l = this._domListeners;
    if (!l) return;
    dom.removeEventListener('pointerdown', l.down);
    dom.removeEventListener('pointermove', l.move);
    dom.removeEventListener('pointerup', l.up);
    dom.removeEventListener('pointercancel', l.up);
    dom.removeEventListener('wheel', l.wheel);
  };

  global.SimpleOrbit = SimpleOrbit;
})(window);
