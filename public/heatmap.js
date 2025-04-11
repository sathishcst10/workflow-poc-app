/*
 * heatmap.js v2.0.2 | JavaScript Heatmap Library
 *
 * Copyright 2008-2016 Patrick Wied <heatmapjs@patrick-wied.at> - All rights reserved.
 * Dual licensed under MIT and Beerware license 
 *
 * :: 2016-02-04 21:25
 */

// Using ES6+ syntax
(function (name, context, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define(factory);
  } else {
    context[name] = factory();
  }
})("h337", this, () => {
  const HeatmapConfig = {
    defaultRadius: 40,
    defaultRenderer: 'canvas2d',
    defaultGradient: { 0.25: "rgb(0,0,255)", 0.55: "rgb(0,255,0)", 0.85: "yellow", 1.0: "rgb(255,0,0)" },
    defaultMaxOpacity: 1,
    defaultMinOpacity: 0,
    defaultBlur: 0.85,
    defaultXField: 'x',
    defaultYField: 'y',
    defaultValueField: 'value',
    plugins: {}
  };

  class Store {
    constructor(config) {
      this._coordinator = {};
      this._data = [];
      this._radi = [];
      this._min = 0;
      this._max = 1;
      this._xField = config.xField || config.defaultXField;
      this._yField = config.yField || config.defaultYField;
      this._valueField = config.valueField || config.defaultValueField;
      this._cfgRadius = config.radius || HeatmapConfig.defaultRadius;
    }

    _organiseData(dataPoint, forceRender) {
      const x = dataPoint[this._xField];
      const y = dataPoint[this._yField];
      const value = dataPoint[this._valueField] || 1;
      const radius = dataPoint.radius || this._cfgRadius;

      if (!this._data[x]) {
        this._data[x] = [];
        this._radi[x] = [];
      }

      if (!this._data[x][y]) {
        this._data[x][y] = value;
        this._radi[x][y] = radius;
      } else {
        this._data[x][y] += value;
      }

      if (this._data[x][y] > this._max) {
        if (!forceRender) {
          this._max = this._data[x][y];
        } else {
          this.setDataMax(this._data[x][y]);
        }
        return false;
      } else {
        return { x, y, value, radius, min: this._min, max: this._max };
      }
    }

    _unOrganizeData() {
      const unorganizedData = [];
      for (const x in this._data) {
        for (const y in this._data[x]) {
          unorganizedData.push({
            x: +x,
            y: +y,
            radius: this._radi[x][y],
            value: this._data[x][y]
          });
        }
      }
      return { min: this._min, max: this._max, data: unorganizedData };
    }

    _onExtremaChange() {
      this._coordinator.emit('extremachange', { min: this._min, max: this._max });
    }

    addData(...args) {
      if (Array.isArray(args[0])) {
        args[0].forEach(dataPoint => this.addData(dataPoint));
      } else {
        const organisedEntry = this._organiseData(args[0], true);
        if (organisedEntry) {
          this._coordinator.emit('renderpartial', {
            min: this._min,
            max: this._max,
            data: [organisedEntry]
          });
        }
      }
      return this;
    }

    setData(data) {
      const { data: dataPoints, max, min = 0 } = data;
      this._data = [];
      this._radi = [];
      dataPoints.forEach(point => this._organiseData(point, false));
      this._max = max;
      this._min = min;
      this._onExtremaChange();
      this._coordinator.emit('renderall', this._getInternalData());
      return this;
    }

    setDataMax(max) {
      this._max = max;
      this._onExtremaChange();
      this._coordinator.emit('renderall', this._getInternalData());
      return this;
    }

    setDataMin(min) {
      this._min = min;
      this._onExtremaChange();
      this._coordinator.emit('renderall', this._getInternalData());
      return this;
    }

    setCoordinator(coordinator) {
      this._coordinator = coordinator;
    }

    _getInternalData() {
      return { max: this._max, min: this._min, data: this._data, radi: this._radi };
    }

    getData() {
      return this._unOrganizeData();
    }
  }

  const _getColorPalette = (config) => {
    const gradientConfig = config.gradient || config.defaultGradient;
    const paletteCanvas = document.createElement('canvas');
    const paletteCtx = paletteCanvas.getContext('2d');

    paletteCanvas.width = 256;
    paletteCanvas.height = 1;

    const gradient = paletteCtx.createLinearGradient(0, 0, 256, 1);
    for (const key in gradientConfig) {
      gradient.addColorStop(key, gradientConfig[key]);
    }

    paletteCtx.fillStyle = gradient;
    paletteCtx.fillRect(0, 0, 256, 1);

    return paletteCtx.getImageData(0, 0, 256, 1).data;
  };

  const _getPointTemplate = (radius, blurFactor) => {
    const tplCanvas = document.createElement('canvas');
    const tplCtx = tplCanvas.getContext('2d');
    const x = radius;
    const y = radius;
    tplCanvas.width = tplCanvas.height = radius * 2;

    if (blurFactor === 1) {
      tplCtx.beginPath();
      tplCtx.arc(x, y, radius, 0, 2 * Math.PI, false);
      tplCtx.fillStyle = 'rgba(0,0,0,1)';
      tplCtx.fill();
    } else {
      const gradient = tplCtx.createRadialGradient(x, y, radius * blurFactor, x, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      tplCtx.fillStyle = gradient;
      tplCtx.fillRect(0, 0, 2 * radius, 2 * radius);
    }

    return tplCanvas;
  };

  const _prepareData = (data) => {
    const renderData = [];
    const { min, max, radi } = data;
    const dataPoints = data.data;

    const xValues = Object.keys(dataPoints);
    xValues.forEach(xValue => {
      const yValues = Object.keys(dataPoints[xValue]);
      yValues.forEach(yValue => {
        const value = dataPoints[xValue][yValue];
        const radius = radi[xValue][yValue];
        renderData.push({ x: xValue, y: yValue, value, radius });
      });
    });

    return { min, max, data: renderData };
  };

  class Canvas2dRenderer {
    constructor(config) {
      const container = config.container;
      this.shadowCanvas = document.createElement('canvas');
      this.canvas = config.canvas || document.createElement('canvas');
      this._renderBoundaries = [10000, 10000, 0, 0];

      const computed = getComputedStyle(config.container) || {};

      this.canvas.className = 'heatmap-canvas';

      this._width = this.canvas.width = this.shadowCanvas.width = config.width || +computed.width.replace(/px/, '');
      this._height = this.canvas.height = this.shadowCanvas.height = config.height || +computed.height.replace(/px/, '');

      this.shadowCtx = this.shadowCanvas.getContext('2d');
      this.ctx = this.canvas.getContext('2d');

      this.canvas.style.cssText = this.shadowCanvas.style.cssText = 'position:absolute;left:0;top:0;';

      container.style.position = 'relative';
      container.appendChild(this.canvas);

      this._palette = _getColorPalette(config);
      this._templates = {};

      this._setStyles(config);
    }

    renderPartial(data) {
      if (data.data.length > 0) {
        this._drawAlpha(data);
        this._colorize();
      }
    }

    renderAll(data) {
      this._clear();
      if (data.data.length > 0) {
        this._drawAlpha(_prepareData(data));
        this._colorize();
      }
    }

    _updateGradient(config) {
      this._palette = _getColorPalette(config);
    }

    updateConfig(config) {
      if (config.gradient) {
        this._updateGradient(config);
      }
      this._setStyles(config);
    }

    setDimensions(width, height) {
      this._width = width;
      this._height = height;
      this.canvas.width = this.shadowCanvas.width = width;
      this.canvas.height = this.shadowCanvas.height = height;
    }

    _clear() {
      this.shadowCtx.clearRect(0, 0, this._width, this._height);
      this.ctx.clearRect(0, 0, this._width, this._height);
    }

    _setStyles(config) {
      this._blur = config.blur === 0 ? 0 : config.blur || config.defaultBlur;

      if (config.backgroundColor) {
        this.canvas.style.backgroundColor = config.backgroundColor;
      }

      this._width = this.canvas.width = this.shadowCanvas.width = config.width || this._width;
      this._height = this.canvas.height = this.shadowCanvas.height = config.height || this._height;

      this._opacity = (config.opacity || 0) * 255;
      this._maxOpacity = (config.maxOpacity || config.defaultMaxOpacity) * 255;
      this._minOpacity = (config.minOpacity || config.defaultMinOpacity) * 255;
      this._useGradientOpacity = !!config.useGradientOpacity;
    }

    _drawAlpha(data) {
      const { min, max } = data;
      const dataPoints = data.data || [];
      const blur = 1 - this._blur;

      dataPoints.forEach(point => {
        const { x, y, radius, value } = point;
        const rectX = x - radius;
        const rectY = y - radius;
        const shadowCtx = this.shadowCtx;

        let tpl;
        if (!this._templates[radius]) {
          this._templates[radius] = tpl = _getPointTemplate(radius, blur);
        } else {
          tpl = this._templates[radius];
        }

        const templateAlpha = (value - min) / (max - min);
        shadowCtx.globalAlpha = templateAlpha < 0.01 ? 0.01 : templateAlpha;

        shadowCtx.drawImage(tpl, rectX, rectY);

        if (rectX < this._renderBoundaries[0]) {
          this._renderBoundaries[0] = rectX;
        }
        if (rectY < this._renderBoundaries[1]) {
          this._renderBoundaries[1] = rectY;
        }
        if (rectX + 2 * radius > this._renderBoundaries[2]) {
          this._renderBoundaries[2] = rectX + 2 * radius;
        }
        if (rectY + 2 * radius > this._renderBoundaries[3]) {
          this._renderBoundaries[3] = rectY + 2 * radius;
        }
      });
    }

    _colorize() {
      let [x, y, width, height] = this._renderBoundaries;
      const maxWidth = this._width;
      const maxHeight = this._height;
      const { _opacity, _maxOpacity, _minOpacity, _useGradientOpacity, _palette } = this;

      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x + width > maxWidth) width = maxWidth - x;
      if (y + height > maxHeight) height = maxHeight - y;

      const img = this.shadowCtx.getImageData(x, y, width, height);
      const imgData = img.data;
      const len = imgData.length;

      for (let i = 3; i < len; i += 4) {
        const alpha = imgData[i];
        const offset = alpha * 4;

        if (!offset) continue;

        let finalAlpha;
        if (_opacity > 0) {
          finalAlpha = _opacity;
        } else {
          if (alpha < _maxOpacity) {
            finalAlpha = alpha < _minOpacity ? _minOpacity : alpha;
          } else {
            finalAlpha = _maxOpacity;
          }
        }

        imgData[i - 3] = _palette[offset];
        imgData[i - 2] = _palette[offset + 1];
        imgData[i - 1] = _palette[offset + 2];
        imgData[i] = _useGradientOpacity ? _palette[offset + 3] : finalAlpha;
      }

      this.ctx.putImageData(img, x, y);
      this._renderBoundaries = [1000, 1000, 0, 0];
    }

    getValueAt(point) {
      const img = this.shadowCtx.getImageData(point.x, point.y, 1, 1);
      const data = img.data[3];
      const { _max, _min } = this;
      return Math.floor((Math.abs(_max - _min) * (data / 255)));
    }

    getDataURL() {
      return this.canvas.toDataURL();
    }
  }

  const Renderer = (() => {
    if (HeatmapConfig.defaultRenderer === 'canvas2d') {
      return Canvas2dRenderer;
    }
    return null;
  })();

  const Util = {
    merge: (...args) => {
      return Object.assign({}, ...args);
    }
  };

  class Coordinator {
    constructor() {
      this.cStore = {};
    }

    on(evtName, callback, scope) {
      if (!this.cStore[evtName]) {
        this.cStore[evtName] = [];
      }
      this.cStore[evtName].push(data => callback.call(scope, data));
    }

    emit(evtName, data) {
      if (this.cStore[evtName]) {
        this.cStore[evtName].forEach(callback => callback(data));
      }
    }
  }

  const _connect = (scope) => {
    const { _renderer, _coordinator, _store, _config } = scope;

    _coordinator.on('renderpartial', _renderer.renderPartial, _renderer);
    _coordinator.on('renderall', _renderer.renderAll, _renderer);
    _coordinator.on('extremachange', (data) => {
      _config.onExtremaChange && _config.onExtremaChange({
        min: data.min,
        max: data.max,
        gradient: _config.gradient || _config.defaultGradient
      });
    });
    _store.setCoordinator(_coordinator);
  };

  class Heatmap {
    constructor(config) {
      this._config = Util.merge(HeatmapConfig, config || {});
      this._coordinator = new Coordinator();
      if (this._config.plugin) {
        const pluginToLoad = this._config.plugin;
        if (!HeatmapConfig.plugins[pluginToLoad]) {
          throw new Error(`Plugin '${pluginToLoad}' not found. Maybe it was not registered.`);
        } else {
          const plugin = HeatmapConfig.plugins[pluginToLoad];
          this._renderer = new plugin.renderer(this._config);
          this._store = new plugin.store(this._config);
        }
      } else {
        this._renderer = new Renderer(this._config);
        this._store = new Store(this._config);
      }
      _connect(this);
    }

    addData(...args) {
      this._store.addData(...args);
      return this;
    }

    removeData(...args) {
      this._store.removeData && this._store.removeData(...args);
      return this;
    }

    setData(...args) {
      this._store.setData(...args);
      return this;
    }

    setDataMax(...args) {
      this._store.setDataMax(...args);
      return this;
    }

    setDataMin(...args) {
      this._store.setDataMin(...args);
      return this;
    }

    configure(config) {
      this._config = Util.merge(this._config, config);
      this._renderer.updateConfig(this._config);
      this._coordinator.emit('renderall', this._store._getInternalData());
      return this;
    }

    repaint() {
      this._coordinator.emit('renderall', this._store._getInternalData());
      return this;
    }

    getData() {
      return this._store.getData();
    }

    getDataURL() {
      return this._renderer.getDataURL();
    }

    getValueAt(point) {
      if (this._store.getValueAt) {
        return this._store.getValueAt(point);
      } else if (this._renderer.getValueAt) {
        return this._renderer.getValueAt(point);
      } else {
        return null;
      }
    }
  }

  const heatmapFactory = {
    create: (config) => new Heatmap(config),
    register: (pluginKey, plugin) => {
      HeatmapConfig.plugins[pluginKey] = plugin;
    }
  };

  return heatmapFactory;
});