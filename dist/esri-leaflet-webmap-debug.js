/* esri-leaflet-webmap - v0.4.0 - Fri Mar 08 2019 11:15:37 GMT-0500 (Eastern Standard Time)
 * Copyright (c) 2019 Yusuke Nunokawa <ynunokawa.dev@gmail.com>
 * MIT */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet'), require('leaflet-omnivore')) :
	typeof define === 'function' && define.amd ? define(['exports', 'leaflet', 'leaflet-omnivore'], factory) :
	(factory((global.L = global.L || {}, global.L.esri = global.L.esri || {}),global.L,global.omnivore));
}(this, function (exports,L,omnivore) { 'use strict';

	L = 'default' in L ? L['default'] : L;
	omnivore = 'default' in omnivore ? omnivore['default'] : omnivore;

	var version = "0.4.0";

	/*
	 * Copyright 2017 Esri
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */

	// checks if 2 x,y points are equal
	function pointsEqual (a, b) {
	  for (var i = 0; i < a.length; i++) {
	    if (a[i] !== b[i]) {
	      return false;
	    }
	  }
	  return true;
	}

	// checks if the first and last points of a ring are equal and closes the ring
	function closeRing (coordinates) {
	  if (!pointsEqual(coordinates[0], coordinates[coordinates.length - 1])) {
	    coordinates.push(coordinates[0]);
	  }
	  return coordinates;
	}

	// determine if polygon ring coordinates are clockwise. clockwise signifies outer ring, counter-clockwise an inner ring
	// or hole. this logic was found at http://stackoverflow.com/questions/1165647/how-to-determine-if-a-list-of-polygon-
	// points-are-in-clockwise-order
	function ringIsClockwise (ringToTest) {
	  var total = 0;
	  var i = 0;
	  var rLength = ringToTest.length;
	  var pt1 = ringToTest[i];
	  var pt2;
	  for (i; i < rLength - 1; i++) {
	    pt2 = ringToTest[i + 1];
	    total += (pt2[0] - pt1[0]) * (pt2[1] + pt1[1]);
	    pt1 = pt2;
	  }
	  return (total >= 0);
	}

	// ported from terraformer.js https://github.com/Esri/Terraformer/blob/master/terraformer.js#L504-L519
	function vertexIntersectsVertex (a1, a2, b1, b2) {
	  var uaT = ((b2[0] - b1[0]) * (a1[1] - b1[1])) - ((b2[1] - b1[1]) * (a1[0] - b1[0]));
	  var ubT = ((a2[0] - a1[0]) * (a1[1] - b1[1])) - ((a2[1] - a1[1]) * (a1[0] - b1[0]));
	  var uB = ((b2[1] - b1[1]) * (a2[0] - a1[0])) - ((b2[0] - b1[0]) * (a2[1] - a1[1]));

	  if (uB !== 0) {
	    var ua = uaT / uB;
	    var ub = ubT / uB;

	    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
	      return true;
	    }
	  }

	  return false;
	}

	// ported from terraformer.js https://github.com/Esri/Terraformer/blob/master/terraformer.js#L521-L531
	function arrayIntersectsArray (a, b) {
	  for (var i = 0; i < a.length - 1; i++) {
	    for (var j = 0; j < b.length - 1; j++) {
	      if (vertexIntersectsVertex(a[i], a[i + 1], b[j], b[j + 1])) {
	        return true;
	      }
	    }
	  }

	  return false;
	}

	// ported from terraformer.js https://github.com/Esri/Terraformer/blob/master/terraformer.js#L470-L480
	function coordinatesContainPoint (coordinates, point) {
	  var contains = false;
	  for (var i = -1, l = coordinates.length, j = l - 1; ++i < l; j = i) {
	    if (((coordinates[i][1] <= point[1] && point[1] < coordinates[j][1]) ||
	         (coordinates[j][1] <= point[1] && point[1] < coordinates[i][1])) &&
	        (point[0] < (((coordinates[j][0] - coordinates[i][0]) * (point[1] - coordinates[i][1])) / (coordinates[j][1] - coordinates[i][1])) + coordinates[i][0])) {
	      contains = !contains;
	    }
	  }
	  return contains;
	}

	// ported from terraformer-arcgis-parser.js https://github.com/Esri/terraformer-arcgis-parser/blob/master/terraformer-arcgis-parser.js#L106-L113
	function coordinatesContainCoordinates (outer, inner) {
	  var intersects = arrayIntersectsArray(outer, inner);
	  var contains = coordinatesContainPoint(outer, inner[0]);
	  if (!intersects && contains) {
	    return true;
	  }
	  return false;
	}

	// do any polygons in this array contain any other polygons in this array?
	// used for checking for holes in arcgis rings
	// ported from terraformer-arcgis-parser.js https://github.com/Esri/terraformer-arcgis-parser/blob/master/terraformer-arcgis-parser.js#L117-L172
	function convertRingsToGeoJSON (rings) {
	  var outerRings = [];
	  var holes = [];
	  var x; // iterator
	  var outerRing; // current outer ring being evaluated
	  var hole; // current hole being evaluated

	  // for each ring
	  for (var r = 0; r < rings.length; r++) {
	    var ring = closeRing(rings[r].slice(0));
	    if (ring.length < 4) {
	      continue;
	    }
	    // is this ring an outer ring? is it clockwise?
	    if (ringIsClockwise(ring)) {
	      var polygon = [ ring ];
	      outerRings.push(polygon); // push to outer rings
	    } else {
	      holes.push(ring); // counterclockwise push to holes
	    }
	  }

	  var uncontainedHoles = [];

	  // while there are holes left...
	  while (holes.length) {
	    // pop a hole off out stack
	    hole = holes.pop();

	    // loop over all outer rings and see if they contain our hole.
	    var contained = false;
	    for (x = outerRings.length - 1; x >= 0; x--) {
	      outerRing = outerRings[x][0];
	      if (coordinatesContainCoordinates(outerRing, hole)) {
	        // the hole is contained push it into our polygon
	        outerRings[x].push(hole);
	        contained = true;
	        break;
	      }
	    }

	    // ring is not contained in any outer ring
	    // sometimes this happens https://github.com/Esri/esri-leaflet/issues/320
	    if (!contained) {
	      uncontainedHoles.push(hole);
	    }
	  }

	  // if we couldn't match any holes using contains we can try intersects...
	  while (uncontainedHoles.length) {
	    // pop a hole off out stack
	    hole = uncontainedHoles.pop();

	    // loop over all outer rings and see if any intersect our hole.
	    var intersects = false;

	    for (x = outerRings.length - 1; x >= 0; x--) {
	      outerRing = outerRings[x][0];
	      if (arrayIntersectsArray(outerRing, hole)) {
	        // the hole is contained push it into our polygon
	        outerRings[x].push(hole);
	        intersects = true;
	        break;
	      }
	    }

	    if (!intersects) {
	      outerRings.push([hole.reverse()]);
	    }
	  }

	  if (outerRings.length === 1) {
	    return {
	      type: 'Polygon',
	      coordinates: outerRings[0]
	    };
	  } else {
	    return {
	      type: 'MultiPolygon',
	      coordinates: outerRings
	    };
	  }
	}

	// shallow object clone for feature properties and attributes
	// from http://jsperf.com/cloning-an-object/2
	function shallowClone (obj) {
	  var target = {};
	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      target[i] = obj[i];
	    }
	  }
	  return target;
	}

	function arcgisToGeoJSON (arcgis, idAttribute) {
	  var geojson = {};

	  if (typeof arcgis.x === 'number' && typeof arcgis.y === 'number') {
	    geojson.type = 'Point';
	    geojson.coordinates = [arcgis.x, arcgis.y];
	  }

	  if (arcgis.points) {
	    geojson.type = 'MultiPoint';
	    geojson.coordinates = arcgis.points.slice(0);
	  }

	  if (arcgis.paths) {
	    if (arcgis.paths.length === 1) {
	      geojson.type = 'LineString';
	      geojson.coordinates = arcgis.paths[0].slice(0);
	    } else {
	      geojson.type = 'MultiLineString';
	      geojson.coordinates = arcgis.paths.slice(0);
	    }
	  }

	  if (arcgis.rings) {
	    geojson = convertRingsToGeoJSON(arcgis.rings.slice(0));
	  }

	  if (arcgis.geometry || arcgis.attributes) {
	    geojson.type = 'Feature';
	    geojson.geometry = (arcgis.geometry) ? arcgisToGeoJSON(arcgis.geometry) : null;
	    geojson.properties = (arcgis.attributes) ? shallowClone(arcgis.attributes) : null;
	    if (arcgis.attributes) {
	      geojson.id = arcgis.attributes[idAttribute] || arcgis.attributes.OBJECTID || arcgis.attributes.FID;
	    }
	  }

	  // if no valid geometry was encountered
	  if (JSON.stringify(geojson.geometry) === JSON.stringify({})) {
	    geojson.geometry = null;
	  }

	  return geojson;
	}

	var Symbol = L.Class.extend({
	  initialize: function (symbolJson, options) {
	    this._symbolJson = symbolJson;
	    this.val = null;
	    this._styles = {};
	    this._isDefault = false;
	    this._layerTransparency = 1;
	    if (options && options.layerTransparency) {
	      this._layerTransparency = 1 - (options.layerTransparency / 100.0);
	    }
	  },

	  // the geojson values returned are in points
	  pixelValue: function (pointValue) {
	    return pointValue * 1.333;
	  },

	  // color is an array [r,g,b,a]
	  colorValue: function (color) {
	    return 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
	  },

	  alphaValue: function (color) {
	    var alpha = color[3] / 255.0;
	    return alpha * this._layerTransparency;
	  },

	  getSize: function (feature, sizeInfo) {
	    var attr = feature.properties;
	    var field = sizeInfo.field;
	    var size = 0;
	    var featureValue = null;

	    if (field) {
	      featureValue = attr[field];
	      var minSize = sizeInfo.minSize;
	      var maxSize = sizeInfo.maxSize;
	      var minDataValue = sizeInfo.minDataValue;
	      var maxDataValue = sizeInfo.maxDataValue;
	      var featureRatio;
	      var normField = sizeInfo.normalizationField;
	      var normValue = attr ? parseFloat(attr[normField]) : undefined;

	      if (featureValue === null || (normField && ((isNaN(normValue) || normValue === 0)))) {
	        return null;
	      }

	      if (!isNaN(normValue)) {
	        featureValue /= normValue;
	      }

	      if (minSize !== null && maxSize !== null && minDataValue !== null && maxDataValue !== null) {
	        if (featureValue <= minDataValue) {
	          size = minSize;
	        } else if (featureValue >= maxDataValue) {
	          size = maxSize;
	        } else {
	          featureRatio = (featureValue - minDataValue) / (maxDataValue - minDataValue);
	          size = minSize + (featureRatio * (maxSize - minSize));
	        }
	      }
	      size = isNaN(size) ? 0 : size;
	    }
	    return size;
	  },

	  getColor: function (feature, colorInfo) {
	    // required information to get color
	    if (!(feature.properties && colorInfo && colorInfo.field && colorInfo.stops)) {
	      return null;
	    }

	    var attr = feature.properties;
	    var featureValue = attr[colorInfo.field];
	    var lowerBoundColor, upperBoundColor, lowerBound, upperBound;
	    var normField = colorInfo.normalizationField;
	    var normValue = attr ? parseFloat(attr[normField]) : undefined;
	    if (featureValue === null || (normField && ((isNaN(normValue) || normValue === 0)))) {
	      return null;
	    }

	    if (!isNaN(normValue)) {
	      featureValue /= normValue;
	    }

	    if (featureValue <= colorInfo.stops[0].value) {
	      return colorInfo.stops[0].color;
	    }
	    var lastStop = colorInfo.stops[colorInfo.stops.length - 1];
	    if (featureValue >= lastStop.value) {
	      return lastStop.color;
	    }

	    // go through the stops to find min and max
	    for (var i = 0; i < colorInfo.stops.length; i++) {
	      var stopInfo = colorInfo.stops[i];

	      if (stopInfo.value <= featureValue) {
	        lowerBoundColor = stopInfo.color;
	        lowerBound = stopInfo.value;
	      } else if (stopInfo.value > featureValue) {
	        upperBoundColor = stopInfo.color;
	        upperBound = stopInfo.value;
	        break;
	      }
	    }

	    // feature falls between two stops, interplate the colors
	    if (!isNaN(lowerBound) && !isNaN(upperBound)) {
	      var range = upperBound - lowerBound;
	      if (range > 0) {
	        // more weight the further it is from the lower bound
	        var upperBoundColorWeight = (featureValue - lowerBound) / range;
	        if (upperBoundColorWeight) {
	          // more weight the further it is from the upper bound
	          var lowerBoundColorWeight = (upperBound - featureValue) / range;
	          if (lowerBoundColorWeight) {
	            // interpolate the lower and upper bound color by applying the
	            // weights to each of the rgba colors and adding them together
	            var interpolatedColor = [];
	            for (var j = 0; j < 4; j++) {
	              interpolatedColor[j] = Math.round((lowerBoundColor[j] * lowerBoundColorWeight) + (upperBoundColor[j] * upperBoundColorWeight));
	            }
	            return interpolatedColor;
	          } else {
	            // no difference between featureValue and upperBound, 100% of upperBoundColor
	            return upperBoundColor;
	          }
	        } else {
	          // no difference between featureValue and lowerBound, 100% of lowerBoundColor
	          return lowerBoundColor;
	        }
	      }
	    }
	    // if we get to here, none of the cases apply so return null
	    return null;
	  }
	});

	var ShapeMarker = L.Path.extend({

	  initialize: function (latlng, size, options) {
	    L.setOptions(this, options);
	    this._size = size;
	    this._latlng = L.latLng(latlng);
	    this._svgCanvasIncludes();
	  },

	  toGeoJSON: function () {
	    return L.GeoJSON.getFeature(this, {
	      type: 'Point',
	      coordinates: L.GeoJSON.latLngToCoords(this.getLatLng())
	    });
	  },

	  _svgCanvasIncludes: function () {
	    // implement in sub class
	  },

	  _project: function () {
	    this._point = this._map.latLngToLayerPoint(this._latlng);
	  },

	  _update: function () {
	    if (this._map) {
	      this._updatePath();
	    }
	  },

	  _updatePath: function () {
	    // implement in sub class
	  },

	  setLatLng: function (latlng) {
	    this._latlng = L.latLng(latlng);
	    this.redraw();
	    return this.fire('move', {latlng: this._latlng});
	  },

	  getLatLng: function () {
	    return this._latlng;
	  },

	  setSize: function (size) {
	    this._size = size;
	    return this.redraw();
	  },

	  getSize: function () {
	    return this._size;
	  }
	});

	var CrossMarker = ShapeMarker.extend({

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateCrossMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateCrossMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();
	        ctx.moveTo(latlng.x, latlng.y + offset);
	        ctx.lineTo(latlng.x, latlng.y - offset);
	        this._fillStroke(ctx, layer);

	        ctx.moveTo(latlng.x - offset, latlng.y);
	        ctx.lineTo(latlng.x + offset, latlng.y);
	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateCrossMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + latlng.x + ',' + (latlng.y + offset) +
	          'L' + latlng.x + ',' + (latlng.y - offset) +
	          'M' + (latlng.x - offset) + ',' + latlng.y +
	          'L' + (latlng.x + offset) + ',' + latlng.y;

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var crossMarker = function (latlng, size, options) {
	  return new CrossMarker(latlng, size, options);
	};

	var XMarker = ShapeMarker.extend({

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateXMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateXMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();

	        ctx.moveTo(latlng.x + offset, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y - offset);
	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateXMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + (latlng.x + offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + (latlng.y - offset) +
	          'M' + (latlng.x - offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x + offset) + ',' + (latlng.y - offset);

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var xMarker = function (latlng, size, options) {
	  return new XMarker(latlng, size, options);
	};

	var SquareMarker = ShapeMarker.extend({
	  options: {
	    fill: true
	  },

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateSquareMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateSquareMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();

	        ctx.moveTo(latlng.x + offset, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y - offset);
	        ctx.lineTo(latlng.x + offset, latlng.y - offset);

	        ctx.closePath();

	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateSquareMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + (latlng.x + offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + (latlng.y - offset) +
	          'L' + (latlng.x + offset) + ',' + (latlng.y - offset);

	        str = str + (L.Browser.svg ? 'z' : 'x');

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var squareMarker = function (latlng, size, options) {
	  return new SquareMarker(latlng, size, options);
	};

	var DiamondMarker = ShapeMarker.extend({
	  options: {
	    fill: true
	  },

	  initialize: function (latlng, size, options) {
	    ShapeMarker.prototype.initialize.call(this, latlng, size, options);
	  },

	  _updatePath: function () {
	    this._renderer._updateDiamondMarker(this);
	  },

	  _svgCanvasIncludes: function () {
	    L.Canvas.include({
	      _updateDiamondMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;
	        var ctx = this._ctx;

	        ctx.beginPath();

	        ctx.moveTo(latlng.x, latlng.y + offset);
	        ctx.lineTo(latlng.x - offset, latlng.y);
	        ctx.lineTo(latlng.x, latlng.y - offset);
	        ctx.lineTo(latlng.x + offset, latlng.y);

	        ctx.closePath();

	        this._fillStroke(ctx, layer);
	      }
	    });

	    L.SVG.include({
	      _updateDiamondMarker: function (layer) {
	        var latlng = layer._point;
	        var offset = layer._size / 2.0;

	        if (L.Browser.vml) {
	          latlng._round();
	          offset = Math.round(offset);
	        }

	        var str = 'M' + latlng.x + ',' + (latlng.y + offset) +
	          'L' + (latlng.x - offset) + ',' + latlng.y +
	          'L' + latlng.x + ',' + (latlng.y - offset) +
	          'L' + (latlng.x + offset) + ',' + latlng.y;

	        str = str + (L.Browser.svg ? 'z' : 'x');

	        this._setPath(layer, str);
	      }
	    });
	  }
	});

	var diamondMarker = function (latlng, size, options) {
	  return new DiamondMarker(latlng, size, options);
	};

	var PointSymbol = Symbol.extend({

	  statics: {
	    MARKERTYPES: ['esriSMSCircle', 'esriSMSCross', 'esriSMSDiamond', 'esriSMSSquare', 'esriSMSX', 'esriPMS']
	  },

	  initialize: function (symbolJson, options) {
	    var url;
	    Symbol.prototype.initialize.call(this, symbolJson, options);
	    if (options) {
	      this.serviceUrl = options.url;
	    }
	    if (symbolJson) {
	      if (symbolJson.type === 'esriPMS') {
	        var imageUrl = this._symbolJson.url;
	        if ((imageUrl && imageUrl.substr(0, 7) === 'http://') || (imageUrl.substr(0, 8) === 'https://')) {
	          // web image
	          url = this.sanitize(imageUrl);
	          this._iconUrl = url;
	        } else {
	          url = this.serviceUrl + 'images/' + imageUrl;
	          this._iconUrl = options && options.token ? url + '?token=' + options.token : url;
	        }
	        if (symbolJson.imageData) {
	          this._iconUrl = 'data:' + symbolJson.contentType + ';base64,' + symbolJson.imageData;
	        }
	        // leaflet does not allow resizing icons so keep a hash of different
	        // icon sizes to try and keep down on the number of icons created
	        this._icons = {};
	        // create base icon
	        this.icon = this._createIcon(this._symbolJson);
	      } else {
	        this._fillStyles();
	      }
	    }
	  },

	  // prevent html injection in strings
	  sanitize: function (str) {
	    if (!str) {
	      return '';
	    }
	    var text;
	    try {
	      // removes html but leaves url link text
	      text = str.replace(/<br>/gi, '\n');
	      text = text.replace(/<p.*>/gi, '\n');
	      text = text.replace(/<a.*href='(.*?)'.*>(.*?)<\/a>/gi, ' $2 ($1) ');
	      text = text.replace(/<(?:.|\s)*?>/g, '');
	    } catch (ex) {
	      text = null;
	    }
	    return text;
	  },

	  _fillStyles: function () {
	    if (this._symbolJson.outline && this._symbolJson.size > 0 && this._symbolJson.outline.style !== 'esriSLSNull') {
	      this._styles.stroke = true;
	      this._styles.weight = this.pixelValue(this._symbolJson.outline.width);
	      this._styles.color = this.colorValue(this._symbolJson.outline.color);
	      this._styles.opacity = this.alphaValue(this._symbolJson.outline.color);
	    } else {
	      this._styles.stroke = false;
	    }
	    if (this._symbolJson.color) {
	      this._styles.fillColor = this.colorValue(this._symbolJson.color);
	      this._styles.fillOpacity = this.alphaValue(this._symbolJson.color);
	    } else {
	      this._styles.fillOpacity = 0;
	    }

	    if (this._symbolJson.style === 'esriSMSCircle') {
	      this._styles.radius = this.pixelValue(this._symbolJson.size) / 2.0;
	    }
	  },

	  _createIcon: function (options) {
	    var width = this.pixelValue(options.width);
	    var height = width;
	    if (options.height) {
	      height = this.pixelValue(options.height);
	    }
	    var xOffset = width / 2.0;
	    var yOffset = height / 2.0;

	    if (options.xoffset) {
	      xOffset += this.pixelValue(options.xoffset);
	    }
	    if (options.yoffset) {
	      yOffset += this.pixelValue(options.yoffset);
	    }

	    var icon = L.icon({
	      iconUrl: this._iconUrl,
	      iconSize: [width, height],
	      iconAnchor: [xOffset, yOffset]
	    });
	    this._icons[options.width.toString()] = icon;
	    return icon;
	  },

	  _getIcon: function (size) {
	    // check to see if it is already created by size
	    var icon = this._icons[size.toString()];
	    if (!icon) {
	      icon = this._createIcon({width: size});
	    }
	    return icon;
	  },

	  pointToLayer: function (geojson, latlng, visualVariables, options) {
	    var size = this._symbolJson.size || this._symbolJson.width;
	    if (!this._isDefault) {
	      if (visualVariables.sizeInfo) {
	        var calculatedSize = this.getSize(geojson, visualVariables.sizeInfo);
	        if (calculatedSize) {
	          size = calculatedSize;
	        }
	      }
	      if (visualVariables.colorInfo) {
	        var color = this.getColor(geojson, visualVariables.colorInfo);
	        if (color) {
	          this._styles.fillColor = this.colorValue(color);
	          this._styles.fillOpacity = this.alphaValue(color);
	        }
	      }
	    }

	    if (this._symbolJson.type === 'esriPMS') {
	      var layerOptions = L.extend({}, {icon: this._getIcon(size)}, options);
	      return L.marker(latlng, layerOptions);
	    }
	    size = this.pixelValue(size);

	    switch (this._symbolJson.style) {
	      case 'esriSMSSquare':
	        return squareMarker(latlng, size, L.extend({}, this._styles, options));
	      case 'esriSMSDiamond':
	        return diamondMarker(latlng, size, L.extend({}, this._styles, options));
	      case 'esriSMSCross':
	        return crossMarker(latlng, size, L.extend({}, this._styles, options));
	      case 'esriSMSX':
	        return xMarker(latlng, size, L.extend({}, this._styles, options));
	    }
	    this._styles.radius = size / 2.0;
	    return L.circleMarker(latlng, L.extend({}, this._styles, options));
	  }
	});

	function pointSymbol (symbolJson, options) {
	  return new PointSymbol(symbolJson, options);
	}

	var LineSymbol = Symbol.extend({
	  statics: {
	    // Not implemented 'esriSLSNull'
	    LINETYPES: ['esriSLSDash', 'esriSLSDot', 'esriSLSDashDotDot', 'esriSLSDashDot', 'esriSLSSolid']
	  },
	  initialize: function (symbolJson, options) {
	    Symbol.prototype.initialize.call(this, symbolJson, options);
	    this._fillStyles();
	  },

	  _fillStyles: function () {
	    // set the defaults that show up on arcgis online
	    this._styles.lineCap = 'butt';
	    this._styles.lineJoin = 'miter';
	    this._styles.fill = false;
	    this._styles.weight = 0;

	    if (!this._symbolJson) {
	      return this._styles;
	    }

	    if (this._symbolJson.color) {
	      this._styles.color = this.colorValue(this._symbolJson.color);
	      this._styles.opacity = this.alphaValue(this._symbolJson.color);
	    }

	    if (!isNaN(this._symbolJson.width)) {
	      this._styles.weight = this.pixelValue(this._symbolJson.width);

	      var dashValues = [];

	      switch (this._symbolJson.style) {
	        case 'esriSLSDash':
	          dashValues = [4, 3];
	          break;
	        case 'esriSLSDot':
	          dashValues = [1, 3];
	          break;
	        case 'esriSLSDashDot':
	          dashValues = [8, 3, 1, 3];
	          break;
	        case 'esriSLSDashDotDot':
	          dashValues = [8, 3, 1, 3, 1, 3];
	          break;
	      }

	      // use the dash values and the line weight to set dash array
	      if (dashValues.length > 0) {
	        for (var i = 0; i < dashValues.length; i++) {
	          dashValues[i] *= this._styles.weight;
	        }

	        this._styles.dashArray = dashValues.join(',');
	      }
	    }
	  },

	  style: function (feature, visualVariables) {
	    if (!this._isDefault && visualVariables) {
	      if (visualVariables.sizeInfo) {
	        var calculatedSize = this.pixelValue(this.getSize(feature, visualVariables.sizeInfo));
	        if (calculatedSize) {
	          this._styles.weight = calculatedSize;
	        }
	      }
	      if (visualVariables.colorInfo) {
	        var color = this.getColor(feature, visualVariables.colorInfo);
	        if (color) {
	          this._styles.color = this.colorValue(color);
	          this._styles.opacity = this.alphaValue(color);
	        }
	      }
	    }
	    return this._styles;
	  }
	});

	function lineSymbol (symbolJson, options) {
	  return new LineSymbol(symbolJson, options);
	}

	var PolygonSymbol = Symbol.extend({
	  statics: {
	    // not implemented: 'esriSFSBackwardDiagonal','esriSFSCross','esriSFSDiagonalCross','esriSFSForwardDiagonal','esriSFSHorizontal','esriSFSNull','esriSFSVertical'
	    POLYGONTYPES: ['esriSFSSolid']
	  },
	  initialize: function (symbolJson, options) {
	    Symbol.prototype.initialize.call(this, symbolJson, options);
	    if (symbolJson) {
	      if (symbolJson.outline && symbolJson.outline.style === 'esriSLSNull') {
	        this._lineStyles = { weight: 0 };
	      } else {
	        this._lineStyles = lineSymbol(symbolJson.outline, options).style();
	      }
	      this._fillStyles();
	    }
	  },

	  _fillStyles: function () {
	    if (this._lineStyles) {
	      if (this._lineStyles.weight === 0) {
	        // when weight is 0, setting the stroke to false can still look bad
	        // (gaps between the polygons)
	        this._styles.stroke = false;
	      } else {
	        // copy the line symbol styles into this symbol's styles
	        for (var styleAttr in this._lineStyles) {
	          this._styles[styleAttr] = this._lineStyles[styleAttr];
	        }
	      }
	    }

	    // set the fill for the polygon
	    if (this._symbolJson) {
	      if (this._symbolJson.color &&
	          // don't fill polygon if type is not supported
	          PolygonSymbol.POLYGONTYPES.indexOf(this._symbolJson.style >= 0)) {
	        this._styles.fill = true;
	        this._styles.fillColor = this.colorValue(this._symbolJson.color);
	        this._styles.fillOpacity = this.alphaValue(this._symbolJson.color);
	      } else {
	        this._styles.fill = false;
	        this._styles.fillOpacity = 0;
	      }
	    }
	  },

	  style: function (feature, visualVariables) {
	    if (!this._isDefault && visualVariables && visualVariables.colorInfo) {
	      var color = this.getColor(feature, visualVariables.colorInfo);
	      if (color) {
	        this._styles.fillColor = this.colorValue(color);
	        this._styles.fillOpacity = this.alphaValue(color);
	      }
	    }
	    return this._styles;
	  }
	});

	function polygonSymbol (symbolJson, options) {
	  return new PolygonSymbol(symbolJson, options);
	}

	var Renderer$1 = L.Class.extend({
	  options: {
	    proportionalPolygon: false,
	    clickable: true
	  },

	  initialize: function (rendererJson, options) {
	    this._rendererJson = rendererJson;
	    this._pointSymbols = false;
	    this._symbols = [];
	    this._visualVariables = this._parseVisualVariables(rendererJson.visualVariables);
	    L.Util.setOptions(this, options);
	  },

	  _parseVisualVariables: function (visualVariables) {
	    var visVars = {};
	    if (visualVariables) {
	      for (var i = 0; i < visualVariables.length; i++) {
	        visVars[visualVariables[i].type] = visualVariables[i];
	      }
	    }
	    return visVars;
	  },

	  _createDefaultSymbol: function () {
	    if (this._rendererJson.defaultSymbol) {
	      this._defaultSymbol = this._newSymbol(this._rendererJson.defaultSymbol);
	      this._defaultSymbol._isDefault = true;
	    }
	  },

	  _newSymbol: function (symbolJson) {
	    if (symbolJson.type === 'esriSMS' || symbolJson.type === 'esriPMS') {
	      this._pointSymbols = true;
	      return pointSymbol(symbolJson, this.options);
	    }
	    if (symbolJson.type === 'esriSLS') {
	      return lineSymbol(symbolJson, this.options);
	    }
	    if (symbolJson.type === 'esriSFS') {
	      return polygonSymbol(symbolJson, this.options);
	    }
	  },

	  _getSymbol: function () {
	    // override
	  },

	  attachStylesToLayer: function (layer) {
	    if (this._pointSymbols) {
	      layer.options.pointToLayer = L.Util.bind(this.pointToLayer, this);
	    } else {
	      layer.options.style = L.Util.bind(this.style, this);
	      layer._originalStyle = layer.options.style;
	    }
	  },

	  pointToLayer: function (geojson, latlng) {
	    var sym = this._getSymbol(geojson);
	    if (sym && sym.pointToLayer) {
	      // right now custom panes are the only option pushed through
	      return sym.pointToLayer(geojson, latlng, this._visualVariables, this.options);
	    }
	    // invisible symbology
	    return L.circleMarker(latlng, {radius: 0, opacity: 0});
	  },

	  style: function (feature) {
	    var userStyles;
	    if (this.options.userDefinedStyle) {
	      userStyles = this.options.userDefinedStyle(feature);
	    }
	    // find the symbol to represent this feature
	    var sym = this._getSymbol(feature);
	    if (sym) {
	      return this.mergeStyles(sym.style(feature, this._visualVariables), userStyles);
	    } else {
	      // invisible symbology
	      return this.mergeStyles({opacity: 0, fillOpacity: 0}, userStyles);
	    }
	  },

	  mergeStyles: function (styles, userStyles) {
	    var mergedStyles = {};
	    var attr;
	    // copy renderer style attributes
	    for (attr in styles) {
	      if (styles.hasOwnProperty(attr)) {
	        mergedStyles[attr] = styles[attr];
	      }
	    }
	    // override with user defined style attributes
	    if (userStyles) {
	      for (attr in userStyles) {
	        if (userStyles.hasOwnProperty(attr)) {
	          mergedStyles[attr] = userStyles[attr];
	        }
	      }
	    }
	    return mergedStyles;
	  }
	});

	var ClassBreaksRenderer = Renderer$1.extend({
	  initialize: function (rendererJson, options) {
	    Renderer$1.prototype.initialize.call(this, rendererJson, options);
	    this._field = this._rendererJson.field;
	    if (this._rendererJson.normalizationType && this._rendererJson.normalizationType === 'esriNormalizeByField') {
	      this._normalizationField = this._rendererJson.normalizationField;
	    }
	    this._createSymbols();
	  },

	  _createSymbols: function () {
	    var symbol;
	    var classbreaks = this._rendererJson.classBreakInfos;

	    this._symbols = [];

	    // create a symbol for each class break
	    for (var i = classbreaks.length - 1; i >= 0; i--) {
	      if (this.options.proportionalPolygon && this._rendererJson.backgroundFillSymbol) {
	        symbol = this._newSymbol(this._rendererJson.backgroundFillSymbol);
	      } else {
	        symbol = this._newSymbol(classbreaks[i].symbol);
	      }
	      symbol.val = classbreaks[i].classMaxValue;
	      this._symbols.push(symbol);
	    }
	    // sort the symbols in ascending value
	    this._symbols.sort(function (a, b) {
	      return a.val > b.val ? 1 : -1;
	    });
	    this._createDefaultSymbol();
	    this._maxValue = this._symbols[this._symbols.length - 1].val;
	  },

	  _getSymbol: function (feature) {
	    var val = feature.properties[this._field];
	    if (this._normalizationField) {
	      var normValue = feature.properties[this._normalizationField];
	      if (!isNaN(normValue) && normValue !== 0) {
	        val = val / normValue;
	      } else {
	        return this._defaultSymbol;
	      }
	    }

	    if (val > this._maxValue) {
	      return this._defaultSymbol;
	    }
	    var symbol = this._symbols[0];
	    for (var i = this._symbols.length - 1; i >= 0; i--) {
	      if (val > this._symbols[i].val) {
	        break;
	      }
	      symbol = this._symbols[i];
	    }
	    return symbol;
	  }
	});

	function classBreaksRenderer (rendererJson, options) {
	  return new ClassBreaksRenderer(rendererJson, options);
	}

	var UniqueValueRenderer = Renderer$1.extend({
	  initialize: function (rendererJson, options) {
	    Renderer$1.prototype.initialize.call(this, rendererJson, options);
	    this._field = this._rendererJson.field1;
	    this._createSymbols();
	  },

	  _createSymbols: function () {
	    var symbol;
	    var uniques = this._rendererJson.uniqueValueInfos;

	    // create a symbol for each unique value
	    for (var i = uniques.length - 1; i >= 0; i--) {
	      symbol = this._newSymbol(uniques[i].symbol);
	      symbol.val = uniques[i].value;
	      this._symbols.push(symbol);
	    }
	    this._createDefaultSymbol();
	  },

	  _getSymbol: function (feature) {
	    var val = feature.properties[this._field];
	    // accumulate values if there is more than one field defined
	    if (this._rendererJson.fieldDelimiter && this._rendererJson.field2) {
	      var val2 = feature.properties[this._rendererJson.field2];
	      if (val2) {
	        val += this._rendererJson.fieldDelimiter + val2;
	        var val3 = feature.properties[this._rendererJson.field3];
	        if (val3) {
	          val += this._rendererJson.fieldDelimiter + val3;
	        }
	      }
	    }

	    var symbol = this._defaultSymbol;
	    for (var i = this._symbols.length - 1; i >= 0; i--) {
	      // using the === operator does not work if the field
	      // of the unique renderer is not a string
	      /*eslint-disable */
	      if (this._symbols[i].val == val) {
	        symbol = this._symbols[i];
	      }
	      /*eslint-enable */
	    }
	    return symbol;
	  }
	});

	function uniqueValueRenderer (rendererJson, options) {
	  return new UniqueValueRenderer(rendererJson, options);
	}

	var SimpleRenderer = Renderer$1.extend({
	  initialize: function (rendererJson, options) {
	    Renderer$1.prototype.initialize.call(this, rendererJson, options);
	    this._createSymbol();
	  },

	  _createSymbol: function () {
	    if (this._rendererJson.symbol) {
	      this._symbols.push(this._newSymbol(this._rendererJson.symbol));
	    }
	  },

	  _getSymbol: function () {
	    return this._symbols[0];
	  }
	});

	function simpleRenderer (rendererJson, options) {
	  return new SimpleRenderer(rendererJson, options);
	}

	function setRenderer (layerDefinition, layer) {
	  var rend;
	  var rendererInfo = layerDefinition.drawingInfo.renderer;

	  var options = {};

	  if (layer.options.pane) {
	    options.pane = layer.options.pane;
	  }
	  if (layerDefinition.drawingInfo.transparency) {
	    options.layerTransparency = layerDefinition.drawingInfo.transparency;
	  }
	  if (layer.options.style) {
	    options.userDefinedStyle = layer.options.style;
	  }

	  switch (rendererInfo.type) {
	    case 'classBreaks':
	      checkForProportionalSymbols(layerDefinition.geometryType, rendererInfo, layer);
	      if (layer._hasProportionalSymbols) {
	        layer._createPointLayer();
	        var pRend = classBreaksRenderer(rendererInfo, options);
	        pRend.attachStylesToLayer(layer._pointLayer);
	        options.proportionalPolygon = true;
	      }
	      rend = classBreaksRenderer(rendererInfo, options);
	      break;
	    case 'uniqueValue':
	      console.log(rendererInfo, options);
	      rend = uniqueValueRenderer(rendererInfo, options);
	      break;
	    default:
	      rend = simpleRenderer(rendererInfo, options);
	  }
	  rend.attachStylesToLayer(layer);
	}

	function checkForProportionalSymbols (geometryType, renderer, layer) {
	  layer._hasProportionalSymbols = false;
	  if (geometryType === 'esriGeometryPolygon') {
	    if (renderer.backgroundFillSymbol) {
	      layer._hasProportionalSymbols = true;
	    }
	    // check to see if the first symbol in the classbreaks is a marker symbol
	    if (renderer.classBreakInfos && renderer.classBreakInfos.length) {
	      var sym = renderer.classBreakInfos[0].symbol;
	      if (sym && (sym.type === 'esriSMS' || sym.type === 'esriPMS')) {
	        layer._hasProportionalSymbols = true;
	      }
	    }
	  }
	}

	var FeatureCollection = L.GeoJSON.extend({
	  options: {
	    data: {}, // Esri Feature Collection JSON or Item ID
	    opacity: 1
	  },

	  initialize: function (layers, options) {
	    L.setOptions(this, options);

	    this.data = this.options.data;
	    this.opacity = this.options.opacity;
	    this.popupInfo = null;
	    this.labelingInfo = null;
	    this._layers = {};

	    var i, len;

	    if (layers) {
	      for (i = 0, len = layers.length; i < len; i++) {
	        this.addLayer(layers[i]);
	      }
	    }

	    if (typeof this.data === 'string') {
	      this._getFeatureCollection(this.data);
	    } else {
	      this._parseFeatureCollection(this.data);
	    }
	  },

	  _getFeatureCollection: function (itemId) {
	    var url = 'https://www.arcgis.com/sharing/rest/content/items/' + itemId + '/data';
	    L.esri.request(url, {}, function (err, res) {
	      if (err) {
	        console.log(err);
	      } else {
	        this._parseFeatureCollection(res);
	      }
	    }, this);
	  },

	  _parseFeatureCollection: function (data) {
	    var i, len;
	    var index = 0;
	    for (i = 0, len = data.layers.length; i < len; i++) {
	      if (data.layers[i].featureSet.features.length > 0) {
	        index = i;
	      }
	    }
	    var features = data.layers[index].featureSet.features;
	    var geometryType = data.layers[index].layerDefinition.geometryType; // 'esriGeometryPoint' | 'esriGeometryMultipoint' | 'esriGeometryPolyline' | 'esriGeometryPolygon' | 'esriGeometryEnvelope'
	    var objectIdField = data.layers[index].layerDefinition.objectIdField;
	    var layerDefinition = data.layers[index].layerDefinition || null;

	    if (data.layers[index].layerDefinition.extent.spatialReference.wkid !== 4326) {
	      if (data.layers[index].layerDefinition.extent.spatialReference.wkid !== 102100) {
	        console.error('[L.esri.WebMap] this wkid (' + data.layers[index].layerDefinition.extent.spatialReference.wkid + ') is not supported.');
	      }
	      features = this._projTo4326(features, geometryType);
	    }
	    if (data.layers[index].popupInfo !== undefined) {
	      this.popupInfo = data.layers[index].popupInfo;
	    }
	    if (data.layers[index].layerDefinition.drawingInfo.labelingInfo !== undefined) {
	      this.labelingInfo = data.layers[index].layerDefinition.drawingInfo.labelingInfo;
	    }
	    console.log(data);

	    var geojson = this._featureCollectionToGeoJSON(features, objectIdField);

	    if (layerDefinition !== null) {
	      setRenderer(layerDefinition, this);
	    }
	    console.log(geojson);
	    this.addData(geojson);
	  },

	  _projTo4326: function (features, geometryType) {
	    console.log('_project!');
	    var i, len;
	    var projFeatures = [];

	    for (i = 0, len = features.length; i < len; i++) {
	      var f = features[i];
	      var mercatorToLatlng;
	      var j, k;

	      if (geometryType === 'esriGeometryPoint') {
	        mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.x, f.geometry.y));
	        f.geometry.x = mercatorToLatlng.lng;
	        f.geometry.y = mercatorToLatlng.lat;
	      } else if (geometryType === 'esriGeometryMultipoint') {
	        var plen;

	        for (j = 0, plen = f.geometry.points.length; j < plen; j++) {
	          mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.points[j][0], f.geometry.points[j][1]));
	          f.geometry.points[j][0] = mercatorToLatlng.lng;
	          f.geometry.points[j][1] = mercatorToLatlng.lat;
	        }
	      } else if (geometryType === 'esriGeometryPolyline') {
	        var pathlen, pathslen;

	        for (j = 0, pathslen = f.geometry.paths.length; j < pathslen; j++) {
	          for (k = 0, pathlen = f.geometry.paths[j].length; k < pathlen; k++) {
	            mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.paths[j][k][0], f.geometry.paths[j][k][1]));
	            f.geometry.paths[j][k][0] = mercatorToLatlng.lng;
	            f.geometry.paths[j][k][1] = mercatorToLatlng.lat;
	          }
	        }
	      } else if (geometryType === 'esriGeometryPolygon') {
	        var ringlen, ringslen;

	        for (j = 0, ringslen = f.geometry.rings.length; j < ringslen; j++) {
	          for (k = 0, ringlen = f.geometry.rings[j].length; k < ringlen; k++) {
	            mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(f.geometry.rings[j][k][0], f.geometry.rings[j][k][1]));
	            f.geometry.rings[j][k][0] = mercatorToLatlng.lng;
	            f.geometry.rings[j][k][1] = mercatorToLatlng.lat;
	          }
	        }
	      }
	      projFeatures.push(f);
	    }

	    return projFeatures;
	  },

	  _featureCollectionToGeoJSON: function (features, objectIdField) {
	    var geojsonFeatureCollection = {
	      type: 'FeatureCollection',
	      features: []
	    };
	    var featuresArray = [];
	    var i, len;

	    for (i = 0, len = features.length; i < len; i++) {
	      var geojson = arcgisToGeoJSON(features[i], objectIdField);
	      featuresArray.push(geojson);
	    }

	    geojsonFeatureCollection.features = featuresArray;

	    return geojsonFeatureCollection;
	  }
	});

	function featureCollection (geojson, options) {
	  return new FeatureCollection(geojson, options);
	}

	var CSVLayer = L.GeoJSON.extend({
	  options: {
	    url: '',
	    data: {}, // Esri Feature Collection JSON or Item ID
	    opacity: 1
	  },

	  initialize: function (layers, options) {
	    L.setOptions(this, options);

	    this.url = this.options.url;
	    this.layerDefinition = this.options.layerDefinition;
	    this.locationInfo = this.options.locationInfo;
	    this.opacity = this.options.opacity;
	    this._layers = {};

	    var i, len;

	    if (layers) {
	      for (i = 0, len = layers.length; i < len; i++) {
	        this.addLayer(layers[i]);
	      }
	    }

	    this._parseCSV(this.url, this.layerDefinition, this.locationInfo);
	  },

	  _parseCSV: function (url, layerDefinition, locationInfo) {
	    omnivore.csv(url, {
	      latfield: locationInfo.latitudeFieldName,
	      lonfield: locationInfo.longitudeFieldName
	    }, this);

	    setRenderer(layerDefinition, this);
	  }
	});

	function csvLayer (geojson, options) {
	  return new CSVLayer(geojson, options);
	}

	var KMLLayer = L.GeoJSON.extend({
	  options: {
	    opacity: 1,
	    url: ''
	  },

	  initialize: function (layers, options) {
	    L.setOptions(this, options);

	    this.url = this.options.url;
	    this.opacity = this.options.opacity;
	    this.popupInfo = null;
	    this.labelingInfo = null;
	    this._layers = {};

	    var i, len;

	    if (layers) {
	      for (i = 0, len = layers.length; i < len; i++) {
	        this.addLayer(layers[i]);
	      }
	    }

	    this._getKML(this.url);
	  },

	  _getKML: function (url) {
	    var requestUrl = 'http://utility.arcgis.com/sharing/kml?url=' + url + '&model=simple&folders=&outSR=%7B"wkid"%3A4326%7D';
	    L.esri.request(requestUrl, {}, function (err, res) {
	      if (err) {
	        console.log(err);
	      } else {
	        console.log(res);
	        this._parseFeatureCollection(res.featureCollection);
	      }
	    }, this);
	  },

	  _parseFeatureCollection: function (featureCollection) {
	    console.log('_parseFeatureCollection');
	    var i;
	    for (i = 0; i < 3; i++) {
	      if (featureCollection.layers[i].featureSet.features.length > 0) {
	        console.log(i);
	        var features = featureCollection.layers[i].featureSet.features;
	        var objectIdField = featureCollection.layers[i].layerDefinition.objectIdField;

	        var geojson = this._featureCollectionToGeoJSON(features, objectIdField);

	        if (featureCollection.layers[i].popupInfo !== undefined) {
	          this.popupInfo = featureCollection.layers[i].popupInfo;
	        }
	        if (featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo !== undefined) {
	          this.labelingInfo = featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo;
	        }

	        setRenderer(featureCollection.layers[i].layerDefinition, this);
	        console.log(geojson);
	        this.addData(geojson);
	      }
	    }
	  },

	  _featureCollectionToGeoJSON: function (features, objectIdField) {
	    var geojsonFeatureCollection = {
	      type: 'FeatureCollection',
	      features: []
	    };
	    var featuresArray = [];
	    var i, len;

	    for (i = 0, len = features.length; i < len; i++) {
	      var geojson = arcgisToGeoJSON(features[i], objectIdField);
	      featuresArray.push(geojson);
	    }

	    geojsonFeatureCollection.features = featuresArray;

	    return geojsonFeatureCollection;
	  }
	});

	function kmlLayer (geojson, options) {
	  return new KMLLayer(geojson, options);
	}

	var LabelIcon = L.DivIcon.extend({
	  options: {
	    iconSize: null,
	    className: 'esri-leaflet-webmap-labels',
	    text: ''
	  },

	  createIcon: function (oldIcon) {
	    var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div');
	    var options = this.options;

	    div.innerHTML = '<div style="position: relative; left: -50%; text-shadow: 1px 1px 0px #fff, -1px 1px 0px #fff, 1px -1px 0px #fff, -1px -1px 0px #fff;">' + options.text + '</div>';

	    // label.css
	    div.style.fontSize = '1em';
	    div.style.fontWeight = 'bold';
	    div.style.textTransform = 'uppercase';
	    div.style.textAlign = 'center';
	    div.style.whiteSpace = 'nowrap';

	    if (options.bgPos) {
	      var bgPos = L.point(options.bgPos);
	      div.style.backgroundPosition = (-bgPos.x) + 'px ' + (-bgPos.y) + 'px';
	    }
	    this._setIconStyles(div, 'icon');

	    return div;
	  }
	});

	function labelIcon (options) {
	  return new LabelIcon(options);
	}

	var LabelMarker = L.Marker.extend({
	  options: {
	    properties: {},
	    labelingInfo: {},
	    offset: [0, 0]
	  },

	  initialize: function (latlng, options) {
	    L.setOptions(this, options);
	    this._latlng = L.latLng(latlng);

	    var labelText = this._createLabelText(this.options.properties, this.options.labelingInfo);
	    this._setLabelIcon(labelText, this.options.offset);
	  },

	  _createLabelText: function (properties, labelingInfo) {
	    var r = /\[([^\]]*)\]/g;
	    var labelText = labelingInfo[0].labelExpression;

	    labelText = labelText.replace(r, function (s) {
	      var m = r.exec(s);
	      return properties[m[1]];
	    });

	    return labelText;
	  },

	  _setLabelIcon: function (text, offset) {
	    var icon = labelIcon({
	      text: text,
	      iconAnchor: offset
	    });

	    this.setIcon(icon);
	  }
	});

	function labelMarker (latlng, options) {
	  return new LabelMarker(latlng, options);
	}

	function pointLabelPos (coordinates) {
	  var labelPos = { position: [], offset: [] };

	  labelPos.position = coordinates.reverse();
	  labelPos.offset = [20, 20];

	  return labelPos;
	}

	function polylineLabelPos (coordinates) {
	  var labelPos = { position: [], offset: [] };
	  var centralKey;

	  centralKey = Math.round(coordinates.length / 2);
	  labelPos.position = coordinates[centralKey].reverse();
	  labelPos.offset = [0, 0];

	  return labelPos;
	}

	function polygonLabelPos (layer, coordinates) {
	  var labelPos = { position: [], offset: [] };

	  labelPos.position = layer.getBounds().getCenter();
	  labelPos.offset = [0, 0];

	  return labelPos;
	}

	var getDayOfYear = require('../get_day_of_year/index.js')
	var getISOWeek = require('../get_iso_week/index.js')
	var getISOYear = require('../get_iso_year/index.js')
	var parse = require('../parse/index.js')
	var isValid = require('../is_valid/index.js')
	var enLocale = require('../locale/en/index.js')

	/**
	 * @category Common Helpers
	 * @summary Format the date.
	 *
	 * @description
	 * Return the formatted date string in the given format.
	 *
	 * Accepted tokens:
	 * | Unit                    | Token | Result examples                  |
	 * |-------------------------|-------|----------------------------------|
	 * | Month                   | M     | 1, 2, ..., 12                    |
	 * |                         | Mo    | 1st, 2nd, ..., 12th              |
	 * |                         | MM    | 01, 02, ..., 12                  |
	 * |                         | MMM   | Jan, Feb, ..., Dec               |
	 * |                         | MMMM  | January, February, ..., December |
	 * | Quarter                 | Q     | 1, 2, 3, 4                       |
	 * |                         | Qo    | 1st, 2nd, 3rd, 4th               |
	 * | Day of month            | D     | 1, 2, ..., 31                    |
	 * |                         | Do    | 1st, 2nd, ..., 31st              |
	 * |                         | DD    | 01, 02, ..., 31                  |
	 * | Day of year             | DDD   | 1, 2, ..., 366                   |
	 * |                         | DDDo  | 1st, 2nd, ..., 366th             |
	 * |                         | DDDD  | 001, 002, ..., 366               |
	 * | Day of week             | d     | 0, 1, ..., 6                     |
	 * |                         | do    | 0th, 1st, ..., 6th               |
	 * |                         | dd    | Su, Mo, ..., Sa                  |
	 * |                         | ddd   | Sun, Mon, ..., Sat               |
	 * |                         | dddd  | Sunday, Monday, ..., Saturday    |
	 * | Day of ISO week         | E     | 1, 2, ..., 7                     |
	 * | ISO week                | W     | 1, 2, ..., 53                    |
	 * |                         | Wo    | 1st, 2nd, ..., 53rd              |
	 * |                         | WW    | 01, 02, ..., 53                  |
	 * | Year                    | YY    | 00, 01, ..., 99                  |
	 * |                         | YYYY  | 1900, 1901, ..., 2099            |
	 * | ISO week-numbering year | GG    | 00, 01, ..., 99                  |
	 * |                         | GGGG  | 1900, 1901, ..., 2099            |
	 * | AM/PM                   | A     | AM, PM                           |
	 * |                         | a     | am, pm                           |
	 * |                         | aa    | a.m., p.m.                       |
	 * | Hour                    | H     | 0, 1, ... 23                     |
	 * |                         | HH    | 00, 01, ... 23                   |
	 * |                         | h     | 1, 2, ..., 12                    |
	 * |                         | hh    | 01, 02, ..., 12                  |
	 * | Minute                  | m     | 0, 1, ..., 59                    |
	 * |                         | mm    | 00, 01, ..., 59                  |
	 * | Second                  | s     | 0, 1, ..., 59                    |
	 * |                         | ss    | 00, 01, ..., 59                  |
	 * | 1/10 of second          | S     | 0, 1, ..., 9                     |
	 * | 1/100 of second         | SS    | 00, 01, ..., 99                  |
	 * | Millisecond             | SSS   | 000, 001, ..., 999               |
	 * | Timezone                | Z     | -01:00, +00:00, ... +12:00       |
	 * |                         | ZZ    | -0100, +0000, ..., +1200         |
	 * | Seconds timestamp       | X     | 512969520                        |
	 * | Milliseconds timestamp  | x     | 512969520900                     |
	 *
	 * The characters wrapped in square brackets are escaped.
	 *
	 * The result may vary by locale.
	 *
	 * @param {Date|String|Number} date - the original date
	 * @param {String} [format='YYYY-MM-DDTHH:mm:ss.SSSZ'] - the string of tokens
	 * @param {Object} [options] - the object with options
	 * @param {Object} [options.locale=enLocale] - the locale object
	 * @returns {String} the formatted date string
	 *
	 * @example
	 * // Represent 11 February 2014 in middle-endian format:
	 * var result = format(
	 *   new Date(2014, 1, 11),
	 *   'MM/DD/YYYY'
	 * )
	 * //=> '02/11/2014'
	 *
	 * @example
	 * // Represent 2 July 2014 in Esperanto:
	 * var eoLocale = require('date-fns/locale/eo')
	 * var result = format(
	 *   new Date(2014, 6, 2),
	 *   'Do [de] MMMM YYYY',
	 *   {locale: eoLocale}
	 * )
	 * //=> '2-a de julio 2014'
	 */
	function format (dirtyDate, dirtyFormatStr, dirtyOptions) {
	  var formatStr = dirtyFormatStr ? String(dirtyFormatStr) : 'YYYY-MM-DDTHH:mm:ss.SSSZ'
	  var options = dirtyOptions || {}

	  var locale = options.locale
	  var localeFormatters = enLocale.format.formatters
	  var formattingTokensRegExp = enLocale.format.formattingTokensRegExp
	  if (locale && locale.format && locale.format.formatters) {
	    localeFormatters = locale.format.formatters

	    if (locale.format.formattingTokensRegExp) {
	      formattingTokensRegExp = locale.format.formattingTokensRegExp
	    }
	  }

	  var date = parse(dirtyDate)

	  if (!isValid(date)) {
	    return 'Invalid Date'
	  }

	  var formatFn = buildFormatFn(formatStr, localeFormatters, formattingTokensRegExp)

	  return formatFn(date)
	}

	var formatters = {
	  // Month: 1, 2, ..., 12
	  'M': function (date) {
	    return date.getMonth() + 1
	  },

	  // Month: 01, 02, ..., 12
	  'MM': function (date) {
	    return addLeadingZeros(date.getMonth() + 1, 2)
	  },

	  // Quarter: 1, 2, 3, 4
	  'Q': function (date) {
	    return Math.ceil((date.getMonth() + 1) / 3)
	  },

	  // Day of month: 1, 2, ..., 31
	  'D': function (date) {
	    return date.getDate()
	  },

	  // Day of month: 01, 02, ..., 31
	  'DD': function (date) {
	    return addLeadingZeros(date.getDate(), 2)
	  },

	  // Day of year: 1, 2, ..., 366
	  'DDD': function (date) {
	    return getDayOfYear(date)
	  },

	  // Day of year: 001, 002, ..., 366
	  'DDDD': function (date) {
	    return addLeadingZeros(getDayOfYear(date), 3)
	  },

	  // Day of week: 0, 1, ..., 6
	  'd': function (date) {
	    return date.getDay()
	  },

	  // Day of ISO week: 1, 2, ..., 7
	  'E': function (date) {
	    return date.getDay() || 7
	  },

	  // ISO week: 1, 2, ..., 53
	  'W': function (date) {
	    return getISOWeek(date)
	  },

	  // ISO week: 01, 02, ..., 53
	  'WW': function (date) {
	    return addLeadingZeros(getISOWeek(date), 2)
	  },

	  // Year: 00, 01, ..., 99
	  'YY': function (date) {
	    return addLeadingZeros(date.getFullYear(), 4).substr(2)
	  },

	  // Year: 1900, 1901, ..., 2099
	  'YYYY': function (date) {
	    return addLeadingZeros(date.getFullYear(), 4)
	  },

	  // ISO week-numbering year: 00, 01, ..., 99
	  'GG': function (date) {
	    return String(getISOYear(date)).substr(2)
	  },

	  // ISO week-numbering year: 1900, 1901, ..., 2099
	  'GGGG': function (date) {
	    return getISOYear(date)
	  },

	  // Hour: 0, 1, ... 23
	  'H': function (date) {
	    return date.getHours()
	  },

	  // Hour: 00, 01, ..., 23
	  'HH': function (date) {
	    return addLeadingZeros(date.getHours(), 2)
	  },

	  // Hour: 1, 2, ..., 12
	  'h': function (date) {
	    var hours = date.getHours()
	    if (hours === 0) {
	      return 12
	    } else if (hours > 12) {
	      return hours % 12
	    } else {
	      return hours
	    }
	  },

	  // Hour: 01, 02, ..., 12
	  'hh': function (date) {
	    return addLeadingZeros(formatters['h'](date), 2)
	  },

	  // Minute: 0, 1, ..., 59
	  'm': function (date) {
	    return date.getMinutes()
	  },

	  // Minute: 00, 01, ..., 59
	  'mm': function (date) {
	    return addLeadingZeros(date.getMinutes(), 2)
	  },

	  // Second: 0, 1, ..., 59
	  's': function (date) {
	    return date.getSeconds()
	  },

	  // Second: 00, 01, ..., 59
	  'ss': function (date) {
	    return addLeadingZeros(date.getSeconds(), 2)
	  },

	  // 1/10 of second: 0, 1, ..., 9
	  'S': function (date) {
	    return Math.floor(date.getMilliseconds() / 100)
	  },

	  // 1/100 of second: 00, 01, ..., 99
	  'SS': function (date) {
	    return addLeadingZeros(Math.floor(date.getMilliseconds() / 10), 2)
	  },

	  // Millisecond: 000, 001, ..., 999
	  'SSS': function (date) {
	    return addLeadingZeros(date.getMilliseconds(), 3)
	  },

	  // Timezone: -01:00, +00:00, ... +12:00
	  'Z': function (date) {
	    return formatTimezone(date.getTimezoneOffset(), ':')
	  },

	  // Timezone: -0100, +0000, ... +1200
	  'ZZ': function (date) {
	    return formatTimezone(date.getTimezoneOffset())
	  },

	  // Seconds timestamp: 512969520
	  'X': function (date) {
	    return Math.floor(date.getTime() / 1000)
	  },

	  // Milliseconds timestamp: 512969520900
	  'x': function (date) {
	    return date.getTime()
	  }
	}

	function buildFormatFn (formatStr, localeFormatters, formattingTokensRegExp) {
	  var array = formatStr.match(formattingTokensRegExp)
	  var length = array.length

	  var i
	  var formatter
	  for (i = 0; i < length; i++) {
	    formatter = localeFormatters[array[i]] || formatters[array[i]]
	    if (formatter) {
	      array[i] = formatter
	    } else {
	      array[i] = removeFormattingTokens(array[i])
	    }
	  }

	  return function (date) {
	    var output = ''
	    for (var i = 0; i < length; i++) {
	      if (array[i] instanceof Function) {
	        output += array[i](date, formatters)
	      } else {
	        output += array[i]
	      }
	    }
	    return output
	  }
	}

	function removeFormattingTokens (input) {
	  if (input.match(/\[[\s\S]/)) {
	    return input.replace(/^\[|]$/g, '')
	  }
	  return input.replace(/\\/g, '')
	}

	function formatTimezone (offset, delimeter) {
	  delimeter = delimeter || ''
	  var sign = offset > 0 ? '-' : '+'
	  var absOffset = Math.abs(offset)
	  var hours = Math.floor(absOffset / 60)
	  var minutes = absOffset % 60
	  return sign + addLeadingZeros(hours, 2) + delimeter + addLeadingZeros(minutes, 2)
	}

	function addLeadingZeros (number, targetLength) {
	  var output = Math.abs(number).toString()
	  while (output.length < targetLength) {
	    output = '0' + output
	  }
	  return output
	}

	module.exports = format


	var format$1 = Object.freeze({

	});

	console.log('format:', format$1);

	function transformPhoneNumber(value) {
	  var s2 = (""+value).replace(/\D/g, '');
	  var m = s2.match(/^(\d{3})(\d{3})(\d{4})$/);
	  return (!m) ? null : "(" + m[1] + ") " + m[2] + "-" + m[3];
	}

	function transformDate(value) {
	  // var moment = globals.moment;
	  // return moment(value).format('MM/DD/YYYY');
	  return format$1(value, 'MM/DD/YYYY');
	  // return value;
	}

	function createPopupContent (popupInfo, properties) {
	  // console.log('popupInfo:', popupInfo);
	  // console.log('popup properties:', properties);
	  var r = /\{([^\]]*)\}/g;
	  var titleText = '';
	  var content = '';

	  if (popupInfo.title !== undefined) {
	    titleText = popupInfo.title;
	  }

	  titleText = titleText.replace(r, function (s) {
	    var m = r.exec(s);
	    return properties[m[1]];
	  });

	  content = '<div class="leaflet-popup-content-title text-center"><h4>' + titleText + '</h4></div><div class="leaflet-popup-content-description" style="max-height:200px;overflow:auto;">';

	  var contentStart = '<div style="font-weight:bold;color:#999;margin-top:5px;word-break:break-all;">'
	  var contentMiddle = '</div><p style="margin-top:0;margin-bottom:5px;word-break:break-all;">'
	  var aTagStart = '<a target="_blank" href="'
	  var emailTagStart = '<a href="mailto:'

	  if (popupInfo.fieldInfos !== undefined) {
	    for (var i = 0; i < popupInfo.fieldInfos.length; i++) {
	      if (popupInfo.fieldInfos[i].visible === true) {
	        if (properties[popupInfo.fieldInfos[i].fieldName] === null) {
	          content += contentStart
	                  + popupInfo.fieldInfos[i].label
	                  + contentMiddle
	                  // + aTagStart
	                  // + properties[popupInfo.fieldInfos[i].fieldName]
	                  + 'none'
	                  // + '">'
	                  // + properties[popupInfo.fieldInfos[i].fieldName]
	                  + '</p>';
	        // if the info is a URL
	        } else if (popupInfo.fieldInfos[i].fieldName === 'URL' ||
	            popupInfo.fieldInfos[i].fieldName === 'CODE_SEC_1' ||
	            popupInfo.fieldInfos[i].fieldName === 'WEBSITE' ||
	            popupInfo.fieldInfos[i].fieldName === 'FINAL_LINK_COPY' ||
	            popupInfo.fieldInfos[i].fieldName === 'LINK' ||
	            // zoning overlays:
	            popupInfo.fieldInfos[i].fieldName === 'CODE_SECTION_LINK'
	        ) {
	          content += contentStart
	                  + popupInfo.fieldInfos[i].label
	                  + contentMiddle
	                  + aTagStart
	                  + properties[popupInfo.fieldInfos[i].fieldName]
	                  + '">'
	                  + properties[popupInfo.fieldInfos[i].fieldName]
	                  + '</a></p>';
	        // if the info is an email address
	        } else if (popupInfo.fieldInfos[i].fieldName.includes('EMAIL')) {
	          content += contentStart
	                  + popupInfo.fieldInfos[i].label
	                  + contentMiddle
	                  + emailTagStart
	                  + properties[popupInfo.fieldInfos[i].fieldName]
	                  + '">'
	                  + properties[popupInfo.fieldInfos[i].fieldName]
	                  + '</a></p>';
	        // if the info is a phone number
	        } else if (popupInfo.fieldInfos[i].fieldName.includes('PHONE')) {
	          content += contentStart
	                  + popupInfo.fieldInfos[i].label
	                  + contentMiddle
	                  + transformPhoneNumber(properties[popupInfo.fieldInfos[i].fieldName])
	                  + '</p>';
	        // if the info is a date
	      } else if (popupInfo.fieldInfos[i].fieldName.includes('DATE')) {
	          content += contentStart
	                  + popupInfo.fieldInfos[i].label
	                  + contentMiddle
	                  + transformDate(properties[popupInfo.fieldInfos[i].fieldName])
	                  + '</p>';
	        } else {
	          content += contentStart
	                  + popupInfo.fieldInfos[i].label
	                  + contentMiddle
	                  + properties[popupInfo.fieldInfos[i].fieldName]
	                  + '</p>';
	        }
	      }
	    }
	    content += '</div>';

	  } else if (popupInfo.description !== undefined) {
	    // KMLLayer popup
	    var descriptionText = popupInfo.description.replace(r, function (s) {
	      var m = r.exec(s);
	      return properties[m[1]];
	    });
	    content += descriptionText + '</div>';
	  }

	  // if (popupInfo.mediaInfos.length > 0) {
	    // It does not support mediaInfos for popup contents.
	  // }

	  return content;
	}

	function operationalLayer (layer, layers, map, params, paneName) {
	  // console.log('operationalLayer, layer:', layer, 'layers:', layers, 'map:', map, 'params:', params, 'paneName:', paneName);
	  return _generateEsriLayer(layer, layers, map, params, paneName);
	}

	function _generateEsriLayer (layer, layers, map, params, paneName) {
	  // console.log('generateEsriLayer: ', layer.title, 'paneName:', paneName, 'layer:', layer);
	  var lyr;
	  var labels = [];
	  var labelsLayer;
	  var labelPaneName = paneName + '-label';
	  var i, len;

	  if (layer.type === 'Feature Collection' || layer.featureCollection !== undefined) {
	    // console.log('create FeatureCollection');

	    map.createPane(labelPaneName);

	    var popupInfo, labelingInfo;
	    if (layer.itemId === undefined) {
	      for (i = 0, len = layer.featureCollection.layers.length; i < len; i++) {
	        if (layer.featureCollection.layers[i].featureSet.features.length > 0) {
	          if (layer.featureCollection.layers[i].popupInfo !== undefined && layer.featureCollection.layers[i].popupInfo !== null) {
	            popupInfo = layer.featureCollection.layers[i].popupInfo;
	          }
	          if (layer.featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo !== undefined && layer.featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo !== null) {
	            labelingInfo = layer.featureCollection.layers[i].layerDefinition.drawingInfo.labelingInfo;
	          }
	        }
	      }
	    }

	    labelsLayer = L.featureGroup(labels);
	    var fc = featureCollection(null, {
	      data: layer.itemId || layer.featureCollection,
	      opacity: layer.opacity,
	      pane: paneName,
	      onEachFeature: function (geojson, l) {
	        l.feature.layerName = layer.title.split('_')[1];
	        if (fc !== undefined) {
	          popupInfo = fc.popupInfo;
	          labelingInfo = fc.labelingInfo;
	        }
	        if (popupInfo !== undefined && popupInfo !== null) {
	          var popupContent = createPopupContent(popupInfo, geojson.properties);
	          // l.bindPopup(popupContent);
	          l.feature.popupHtml = popupContent
	        }
	        if (labelingInfo !== undefined && labelingInfo !== null) {
	          var coordinates = l.feature.geometry.coordinates;
	          var labelPos;

	          if (l.feature.geometry.type === 'Point') {
	            labelPos = pointLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'LineString') {
	            labelPos = polylineLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'MultiLineString') {
	            labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
	          } else {
	            labelPos = polygonLabelPos(l);
	          }

	          var label = labelMarker(labelPos.position, {
	            zIndexOffset: 1,
	            properties: geojson.properties,
	            labelingInfo: labelingInfo,
	            offset: labelPos.offset,
	            pane: labelPaneName
	          });

	          labelsLayer.addLayer(label);
	        }
	      }
	    });

	    lyr = L.layerGroup([fc, labelsLayer]);

	    layers.push({ type: 'FC', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition !== undefined) {
	    var where = '1=1';
	    if (layer.layerDefinition.drawingInfo !== undefined) {
	      if (layer.layerDefinition.drawingInfo.renderer.type === 'heatmap') {
	        // console.log('create HeatmapLayer');
	        var gradient = {};

	        layer.layerDefinition.drawingInfo.renderer.colorStops.map(function (stop) {
	          // gradient[stop.ratio] = 'rgba(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ',' + (stop.color[3]/255) + ')';
	          // gradient[Math.round(stop.ratio*100)/100] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
	          gradient[(Math.round(stop.ratio * 100) / 100 + 6) / 7] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
	        });

	        lyr = L.esri.Heat.heatmapFeatureLayer({ // Esri Leaflet 2.0
	        // lyr = L.esri.heatmapFeatureLayer({ // Esri Leaflet 1.0
	          url: layer.url,
	          token: params.token || null,
	          minOpacity: 0.5,
	          max: layer.layerDefinition.drawingInfo.renderer.maxPixelIntensity,
	          blur: layer.layerDefinition.drawingInfo.renderer.blurRadius,
	          radius: layer.layerDefinition.drawingInfo.renderer.blurRadius * 1.3,
	          gradient: gradient,
	          pane: paneName
	        });

	        layers.push({ type: 'HL', title: layer.title || '', layer: lyr });

	        return lyr;
	      } else {
	        // console.log('create ArcGISFeatureLayer (with layerDefinition.drawingInfo)');
	        var drawingInfo = layer.layerDefinition.drawingInfo;
	        drawingInfo.transparency = 100 - (layer.opacity * 100);
	        // console.log(drawingInfo.transparency);

	        if (layer.layerDefinition.definitionExpression !== undefined) {
	          where = layer.layerDefinition.definitionExpression;
	        }

	        map.createPane(labelPaneName);

	        labelsLayer = L.featureGroup(labels);

	        lyr = L.esri.featureLayer({
	          url: layer.url,
	          where: where,
	          token: params.token || null,
	          drawingInfo: drawingInfo,
	          pane: paneName,
	          onEachFeature: function (geojson, l) {
	            l.feature.layerName = layer.title.split('_')[1];
	            if (layer.popupInfo !== undefined) {
	              var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	              // l.bindPopup(popupContent);
	              l.feature.popupHtml = popupContent
	            }
	            if (layer.layerDefinition.drawingInfo.labelingInfo !== undefined && layer.layerDefinition.drawingInfo.labelingInfo !== null) {
	              var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
	              var coordinates = l.feature.geometry.coordinates;
	              var labelPos;

	              if (l.feature.geometry.type === 'Point') {
	                labelPos = pointLabelPos(coordinates);
	              } else if (l.feature.geometry.type === 'LineString') {
	                labelPos = polylineLabelPos(coordinates);
	              } else if (l.feature.geometry.type === 'MultiLineString') {
	                labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
	              } else {
	                labelPos = polygonLabelPos(l);
	              }

	              var label = labelMarker(labelPos.position, {
	                zIndexOffset: 1,
	                properties: geojson.properties,
	                labelingInfo: labelingInfo,
	                offset: labelPos.offset,
	                pane: labelPaneName
	              });

	              labelsLayer.addLayer(label);
	            }
	          }
	        });

	        lyr = L.layerGroup([lyr, labelsLayer]);

	        layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	        return lyr;
	      }
	    } else {
	      // console.log('create ArcGISFeatureLayer (without layerDefinition.drawingInfo)');

	      if (layer.layerDefinition.definitionExpression !== undefined) {
	        where = layer.layerDefinition.definitionExpression;
	      }

	      lyr = L.esri.featureLayer({
	        url: layer.url,
	        token: params.token || null,
	        where: where,
	        pane: paneName,
	        onEachFeature: function (geojson, l) {
	          l.feature.layerName = layer.title.split('_')[1];
	          if (layer.popupInfo !== undefined) {
	            var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	            // l.bindPopup(popupContent);
	            l.feature.popupHtml = popupContent
	          }
	        }
	      });

	      layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	      return lyr;
	    }
	  } else if (layer.layerType === 'ArcGISFeatureLayer') {
	    // console.log('create ArcGISFeatureLayer');
	    lyr = L.esri.featureLayer({
	      url: layer.url,
	      token: params.token || null,
	      pane: paneName,
	      onEachFeature: function (geojson, l) {
	        l.feature.layerName = layer.title.split('_')[1];
	        if (layer.popupInfo !== undefined) {
	          var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	          // l.bindPopup(popupContent);
	          l.feature.popupHtml = popupContent
	        }
	      }
	    });

	    layers.push({ type: 'FL', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'CSV') {
	    labelsLayer = L.featureGroup(labels);
	    lyr = csvLayer(null, {
	      url: layer.url,
	      layerDefinition: layer.layerDefinition,
	      locationInfo: layer.locationInfo,
	      opacity: layer.opacity,
	      pane: paneName,
	      onEachFeature: function (geojson, l) {
	        l.feature.layerName = layer.title.split('_')[1];
	        if (layer.popupInfo !== undefined) {
	          var popupContent = createPopupContent(layer.popupInfo, geojson.properties);
	          // l.bindPopup(popupContent);
	          l.feature.popupHtml = popupContent
	        }
	        if (layer.layerDefinition.drawingInfo.labelingInfo !== undefined && layer.layerDefinition.drawingInfo.labelingInfo !== null) {
	          var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
	          var coordinates = l.feature.geometry.coordinates;
	          var labelPos;

	          if (l.feature.geometry.type === 'Point') {
	            labelPos = pointLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'LineString') {
	            labelPos = polylineLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'MultiLineString') {
	            labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
	          } else {
	            labelPos = polygonLabelPos(l);
	          }

	          var label = labelMarker(labelPos.position, {
	            zIndexOffset: 1,
	            properties: geojson.properties,
	            labelingInfo: labelingInfo,
	            offset: labelPos.offset,
	            pane: labelPaneName
	          });

	          labelsLayer.addLayer(label);
	        }
	      }
	    });

	    lyr = L.layerGroup([lyr, labelsLayer]);

	    layers.push({ type: 'CSV', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'KML') {
	    labelsLayer = L.featureGroup(labels);
	    var kml = kmlLayer(null, {
	      url: layer.url,
	      opacity: layer.opacity,
	      pane: paneName,
	      onEachFeature: function (geojson, l) {
	        l.feature.layerName = layer.title.split('_')[1];
	        if (kml.popupInfo !== undefined && kml.popupInfo !== null) {
	          // console.log(kml.popupInfo);
	          var popupContent = createPopupContent(kml.popupInfo, geojson.properties);
	          // l.bindPopup(popupContent);
	          l.feature.popupHtml = popupContent
	        }
	        if (kml.labelingInfo !== undefined && kml.labelingInfo !== null) {
	          var labelingInfo = kml.labelingInfo;
	          var coordinates = l.feature.geometry.coordinates;
	          var labelPos;

	          if (l.feature.geometry.type === 'Point') {
	            labelPos = pointLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'LineString') {
	            labelPos = polylineLabelPos(coordinates);
	          } else if (l.feature.geometry.type === 'MultiLineString') {
	            labelPos = polylineLabelPos(coordinates[Math.round(coordinates.length / 2)]);
	          } else {
	            labelPos = polygonLabelPos(l);
	          }

	          var label = labelMarker(labelPos.position, {
	            zIndexOffset: 1,
	            properties: geojson.properties,
	            labelingInfo: labelingInfo,
	            offset: labelPos.offset,
	            pane: labelPaneName
	          });

	          labelsLayer.addLayer(label);
	        }
	      }
	    });

	    lyr = L.layerGroup([kml, labelsLayer]);

	    layers.push({ type: 'KML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISImageServiceLayer') {
	    // console.log('create ArcGISImageServiceLayer');
	    lyr = L.esri.imageMapLayer({
	      url: layer.url,
	      token: params.token || null,
	      pane: paneName,
	      opacity: layer.opacity || 1
	    });

	    layers.push({ type: 'IML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISMapServiceLayer') {
	    lyr = L.esri.dynamicMapLayer({
	      url: layer.url,
	      token: params.token || null,
	      pane: paneName,
	      opacity: layer.opacity || 1
	    });

	    layers.push({ type: 'DML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'ArcGISTiledMapServiceLayer') {
	    try {
	      lyr = L.esri.basemapLayer(layer.title);
	    } catch (e) {
	      lyr = L.esri.tiledMapLayer({
	        url: layer.url,
	        token: params.token || null
	      });

	      L.esri.request(layer.url, {}, function (err, res) {
	        if (err) {
	          console.log(err);
	        } else {
	          var maxWidth = (map.getSize().x - 55);
	          var tiledAttribution = '<span class="esri-attributions" style="line-height:14px; vertical-align: -3px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; display:inline-block; max-width:' + maxWidth + 'px;">' + res.copyrightText + '</span>';
	          map.attributionControl.addAttribution(tiledAttribution);
	        }
	      });
	    }

	    document.getElementsByClassName('leaflet-tile-pane')[0].style.opacity = layer.opacity || 1;

	    layers.push({ type: 'TML', title: layer.title || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'VectorTileLayer') {
	    var keys = {
	      'World Street Map (with Relief)': 'StreetsRelief',
	      'World Street Map (with Relief) (Mature Support)': 'StreetsRelief',
	      'Hybrid Reference Layer': 'Hybrid',
	      'Hybrid Reference Layer (Mature Support)': 'Hybrid',
	      'World Street Map': 'Streets',
	      'World Street Map (Mature Support)': 'Streets',
	      'World Street Map (Night)': 'StreetsNight',
	      'World Street Map (Night) (Mature Support)': 'StreetsNight',
	      'Dark Gray Canvas': 'DarkGray',
	      'Dark Gray Canvas (Mature Support)': 'DarkGray',
	      'World Topographic Map': 'Topographic',
	      'World Topographic Map (Mature Support)': 'Topographic',
	      'World Navigation Map': 'Navigation',
	      'World Navigation Map (Mature Support)': 'Navigation',
	      'Light Gray Canvas': 'Gray',
	      'Light Gray Canvas (Mature Support)': 'Gray'
	      //'Terrain with Labels': '',
	      //'World Terrain with Labels': '',
	      //'Light Gray Canvas Reference': '',
	      //'Dark Gray Canvas Reference': '',
	      //'Dark Gray Canvas Base': '',
	      //'Light Gray Canvas Base': ''
	    };

	    if (keys[layer.title]) {
	      lyr = L.esri.Vector.basemap(keys[layer.title]);
	    } else {
	      console.error('Unsupported Vector Tile Layer: ', layer);
	      lyr = L.featureGroup([]);
	    }

	    layers.push({ type: 'VTL', title: layer.title || layer.id || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'OpenStreetMap') {
	    lyr = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
	      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
	    });

	    layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'WebTiledLayer') {
	    var lyrUrl = _esriWTLUrlTemplateToLeaflet(layer.templateUrl);
	    lyr = L.tileLayer(lyrUrl, {
	      attribution: layer.copyright
	    });
	    document.getElementsByClassName('leaflet-tile-pane')[0].style.opacity = layer.opacity || 1;

	    layers.push({ type: 'TL', title: layer.title || layer.id || '', layer: lyr });

	    return lyr;
	  } else if (layer.layerType === 'WMS') {
	    var layerNames = '';
	    for (i = 0, len = layer.visibleLayers.length; i < len; i++) {
	      layerNames += layer.visibleLayers[i];
	      if (i < len - 1) {
	        layerNames += ',';
	      }
	    }

	    lyr = L.tileLayer.wms(layer.url, {
	      layers: String(layerNames),
	      format: 'image/png',
	      transparent: true,
	      attribution: layer.copyright
	    });

	    layers.push({ type: 'WMS', title: layer.title || layer.id || '', layer: lyr });

	    return lyr;
	  } else {
	    lyr = L.featureGroup([]);
	    console.log('Unsupported Layer: ', layer);
	    return lyr;
	  }
	}

	function _esriWTLUrlTemplateToLeaflet (url) {
	  var newUrl = url;

	  newUrl = newUrl.replace(/\{level}/g, '{z}');
	  newUrl = newUrl.replace(/\{col}/g, '{x}');
	  newUrl = newUrl.replace(/\{row}/g, '{y}');

	  return newUrl;
	}

	var WebMap = L.Evented.extend({
	  options: {
	    // L.Map
	    map: {},
	    // access token for secure contents on ArcGIS Online
	    token: null,
	    // server domain name (default= 'www.arcgis.com')
	    server: 'www.arcgis.com'
	  },

	  initialize: function (webmapId, options) {
	    L.setOptions(this, options);

	    this._map = this.options.map;
	    this._token = this.options.token;
	    this._server = this.options.server;
	    this._webmapId = webmapId;
	    this._loaded = false;
	    this._metadataLoaded = false;
	    this._loadedLayersNum = 0;
	    this._layersNum = 0;

	    this.layers = []; // Check the layer types here -> https://github.com/ynunokawa/L.esri.WebMap/wiki/Layer-types
	    this.title = ''; // Web Map Title
	    this.bookmarks = []; // Web Map Bookmarks -> [{ name: 'Bookmark name', bounds: <L.latLngBounds> }]
	    this.portalItem = {}; // Web Map Metadata

	    this.VERSION = version;

	    this._loadWebMapMetaData(webmapId);
	    this._loadWebMap(webmapId);
	  },

	  _checkLoaded: function () {
	    this._loadedLayersNum++;
	    if (this._loadedLayersNum === this._layersNum) {
	      this._loaded = true;
	      this.fire('load');
	    }
	  },

	  _operationalLayer: function (layer, layers, map, params, paneName) {
	    var lyr = operationalLayer(layer, layers, map, params, paneName);
	    if (lyr !== undefined && layer.visibility === true) {
	      lyr.addTo(map);
	    }
	  },

	  _loadWebMapMetaData: function (id) {
	    // console.log('_loadWebMapMetaData is running, id:', id, 'this._server:', this._server);
	    var params = {};
	    var map = this._map;
	    var webmap = this;
	    var webmapMetaDataRequestUrl = 'https://' + this._server + '/sharing/rest/content/items/' + id;
	    if (this._token && this._token.length > 0) {
	      params.token = this._token;
	    }

	    L.esri.request(webmapMetaDataRequestUrl, params, function (error, response) {
	      if (error) {
	        console.log(error);
	      } else {
	        // console.log('WebMap MetaData: ', response);
	        webmap.portalItem = response;
	        webmap.title = response.title;
	        webmap._metadataLoaded = true;
	        webmap.fire('metadataLoad');
	        map.fitBounds([response.extent[0].reverse(), response.extent[1].reverse()]);
	      }
	    });
	  },

	  _loadWebMap: function (id) {
	    var map = this._map;
	    var layers = this.layers;
	    var server = this._server;
	    var params = {};
	    var webmapRequestUrl = 'https://' + server + '/sharing/rest/content/items/' + id + '/data';
	    // console.log('webmapRequestUrl:', webmapRequestUrl, 'this._token:', this._token);
	    if (this._token && this._token.length > 0) {
	      params.token = this._token;
	    }

	    L.esri.request(webmapRequestUrl, params, function (error, response) {
	      if (error) {
	        console.log('L.esri.request error:', error);
	      } else {
	        // console.log('WebMap: ', response);
	        this._layersNum = response.baseMap.baseMapLayers.length + response.operationalLayers.length;

	        // Add Basemap
	        response.baseMap.baseMapLayers.map(function (baseMapLayer) {
	          if (baseMapLayer.itemId !== undefined) {
	            var itemRequestUrl = 'https://' + server + '/sharing/rest/content/items/' + baseMapLayer.itemId;
	            L.esri.request(itemRequestUrl, params, function (err, res) {
	              if (err) {
	                console.error(error);
	              } else {
	                console.log(res.access);
	                if (res.access !== 'public') {
	                  // console.log('in _loadWebMap public')
	                  this._operationalLayer(baseMapLayer, layers, map, params);
	                } else {
	                  // console.log('in _loadWebMap NOT public')
	                  this._operationalLayer(baseMapLayer, layers, map, {});
	                }
	              }
	              this._checkLoaded();
	            }, this);
	          } else {
	            this._operationalLayer(baseMapLayer, layers, map, {});
	            this._checkLoaded();
	          }
	        }.bind(this));

	        // Add Operational Layers
	        response.operationalLayers.map(function (layer, i) {
	          // console.log('response.operationalLayers, layer:', layer);
	          var paneName = 'esri-webmap-layer' + i;
	          map.createPane(paneName);
	          if (layer.itemId !== undefined) {
	            // console.log('WebMapLoader.js paneName:', paneName);
	            var itemRequestUrl = 'https://' + server + '/sharing/rest/content/items/' + layer.itemId;
	            L.esri.request(itemRequestUrl, params, function (err, res) {
	              if (err) {
	                console.error(error);
	              } else {
	                console.log(res.access);
	                if (res.access !== 'public') {
	                  // console.log('inside public, layer:', layer, 'layers:', layers, 'map:', map, 'params:', params, 'paneName:', paneName);
	                  this._operationalLayer(layer, layers, map, params, paneName);
	                } else {
	                  // console.log('NOT inside public, layer:', layer, 'layers:', layers, 'map:', map, 'params:', params, 'paneName:', paneName);
	                  this._operationalLayer(layer, layers, map, {}, paneName);
	                }
	              }
	              this._checkLoaded();
	            }, this);
	          } else {
	            this._operationalLayer(layer, layers, map, {}, paneName);
	            this._checkLoaded();
	          }
	        }.bind(this));

	        // Add Bookmarks
	        if (response.bookmarks !== undefined && response.bookmarks.length > 0) {
	          response.bookmarks.map(function (bookmark) {
	            // Esri Extent Geometry to L.latLngBounds
	            var northEast = L.Projection.SphericalMercator.unproject(L.point(bookmark.extent.xmax, bookmark.extent.ymax));
	            var southWest = L.Projection.SphericalMercator.unproject(L.point(bookmark.extent.xmin, bookmark.extent.ymin));
	            var bounds = L.latLngBounds(southWest, northEast);
	            this.bookmarks.push({ name: bookmark.name, bounds: bounds });
	          }.bind(this));
	        }

	        //this._loaded = true;
	        //this.fire('load');
	      }
	    }.bind(this));
	  }
	});

	function webMap (webmapId, options) {
	  return new WebMap(webmapId, options);
	}

	exports.WebMap = WebMap;
	exports.webMap = webMap;
	exports.operationalLayer = operationalLayer;
	exports.FeatureCollection = FeatureCollection;
	exports.featureCollection = featureCollection;
	exports.LabelMarker = LabelMarker;
	exports.labelMarker = labelMarker;
	exports.LabelIcon = LabelIcon;
	exports.labelIcon = labelIcon;
	exports.createPopupContent = createPopupContent;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9hcmNnaXMtdG8tZ2VvanNvbi11dGlscy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1N5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZWFmbGV0LXNoYXBlLW1hcmtlcnMvc3JjL1NoYXBlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvQ3Jvc3NNYXJrZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvbGVhZmxldC1zaGFwZS1tYXJrZXJzL3NyYy9YTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvU3F1YXJlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvRGlhbW9uZE1hcmtlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvaW50U3ltYm9sLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1N5bWJvbHMvTGluZVN5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvbHlnb25TeW1ib2wuanMiLCIuLi9ub2RlX21vZHVsZXMvZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9VbmlxdWVWYWx1ZVJlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9SZW5kZXJlci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9GZWF0dXJlQ29sbGVjdGlvbi5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9DU1ZMYXllci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9LTUxMYXllci5qcyIsIi4uL3NyYy9MYWJlbC9MYWJlbEljb24uanMiLCIuLi9zcmMvTGFiZWwvTGFiZWxNYXJrZXIuanMiLCIuLi9zcmMvTGFiZWwvUG9pbnRMYWJlbC5qcyIsIi4uL3NyYy9MYWJlbC9Qb2x5bGluZUxhYmVsLmpzIiwiLi4vc3JjL0xhYmVsL1BvbHlnb25MYWJlbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9mb3JtYXQvaW5kZXguanMiLCIuLi9zcmMvUG9wdXAvUG9wdXAuanMiLCIuLi9zcmMvT3BlcmF0aW9uYWxMYXllci5qcyIsIi4uL3NyYy9XZWJNYXBMb2FkZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAyMDE3IEVzcmlcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLy8gY2hlY2tzIGlmIDIgeCx5IHBvaW50cyBhcmUgZXF1YWxcbmZ1bmN0aW9uIHBvaW50c0VxdWFsIChhLCBiKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyBjaGVja3MgaWYgdGhlIGZpcnN0IGFuZCBsYXN0IHBvaW50cyBvZiBhIHJpbmcgYXJlIGVxdWFsIGFuZCBjbG9zZXMgdGhlIHJpbmdcbmZ1bmN0aW9uIGNsb3NlUmluZyAoY29vcmRpbmF0ZXMpIHtcbiAgaWYgKCFwb2ludHNFcXVhbChjb29yZGluYXRlc1swXSwgY29vcmRpbmF0ZXNbY29vcmRpbmF0ZXMubGVuZ3RoIC0gMV0pKSB7XG4gICAgY29vcmRpbmF0ZXMucHVzaChjb29yZGluYXRlc1swXSk7XG4gIH1cbiAgcmV0dXJuIGNvb3JkaW5hdGVzO1xufVxuXG4vLyBkZXRlcm1pbmUgaWYgcG9seWdvbiByaW5nIGNvb3JkaW5hdGVzIGFyZSBjbG9ja3dpc2UuIGNsb2Nrd2lzZSBzaWduaWZpZXMgb3V0ZXIgcmluZywgY291bnRlci1jbG9ja3dpc2UgYW4gaW5uZXIgcmluZ1xuLy8gb3IgaG9sZS4gdGhpcyBsb2dpYyB3YXMgZm91bmQgYXQgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMTY1NjQ3L2hvdy10by1kZXRlcm1pbmUtaWYtYS1saXN0LW9mLXBvbHlnb24tXG4vLyBwb2ludHMtYXJlLWluLWNsb2Nrd2lzZS1vcmRlclxuZnVuY3Rpb24gcmluZ0lzQ2xvY2t3aXNlIChyaW5nVG9UZXN0KSB7XG4gIHZhciB0b3RhbCA9IDA7XG4gIHZhciBpID0gMDtcbiAgdmFyIHJMZW5ndGggPSByaW5nVG9UZXN0Lmxlbmd0aDtcbiAgdmFyIHB0MSA9IHJpbmdUb1Rlc3RbaV07XG4gIHZhciBwdDI7XG4gIGZvciAoaTsgaSA8IHJMZW5ndGggLSAxOyBpKyspIHtcbiAgICBwdDIgPSByaW5nVG9UZXN0W2kgKyAxXTtcbiAgICB0b3RhbCArPSAocHQyWzBdIC0gcHQxWzBdKSAqIChwdDJbMV0gKyBwdDFbMV0pO1xuICAgIHB0MSA9IHB0MjtcbiAgfVxuICByZXR1cm4gKHRvdGFsID49IDApO1xufVxuXG4vLyBwb3J0ZWQgZnJvbSB0ZXJyYWZvcm1lci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9UZXJyYWZvcm1lci9ibG9iL21hc3Rlci90ZXJyYWZvcm1lci5qcyNMNTA0LUw1MTlcbmZ1bmN0aW9uIHZlcnRleEludGVyc2VjdHNWZXJ0ZXggKGExLCBhMiwgYjEsIGIyKSB7XG4gIHZhciB1YVQgPSAoKGIyWzBdIC0gYjFbMF0pICogKGExWzFdIC0gYjFbMV0pKSAtICgoYjJbMV0gLSBiMVsxXSkgKiAoYTFbMF0gLSBiMVswXSkpO1xuICB2YXIgdWJUID0gKChhMlswXSAtIGExWzBdKSAqIChhMVsxXSAtIGIxWzFdKSkgLSAoKGEyWzFdIC0gYTFbMV0pICogKGExWzBdIC0gYjFbMF0pKTtcbiAgdmFyIHVCID0gKChiMlsxXSAtIGIxWzFdKSAqIChhMlswXSAtIGExWzBdKSkgLSAoKGIyWzBdIC0gYjFbMF0pICogKGEyWzFdIC0gYTFbMV0pKTtcblxuICBpZiAodUIgIT09IDApIHtcbiAgICB2YXIgdWEgPSB1YVQgLyB1QjtcbiAgICB2YXIgdWIgPSB1YlQgLyB1QjtcblxuICAgIGlmICh1YSA+PSAwICYmIHVhIDw9IDEgJiYgdWIgPj0gMCAmJiB1YiA8PSAxKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIHBvcnRlZCBmcm9tIHRlcnJhZm9ybWVyLmpzIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL1RlcnJhZm9ybWVyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLmpzI0w1MjEtTDUzMVxuZnVuY3Rpb24gYXJyYXlJbnRlcnNlY3RzQXJyYXkgKGEsIGIpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aCAtIDE7IGkrKykge1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgYi5sZW5ndGggLSAxOyBqKyspIHtcbiAgICAgIGlmICh2ZXJ0ZXhJbnRlcnNlY3RzVmVydGV4KGFbaV0sIGFbaSArIDFdLCBiW2pdLCBiW2ogKyAxXSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBwb3J0ZWQgZnJvbSB0ZXJyYWZvcm1lci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9UZXJyYWZvcm1lci9ibG9iL21hc3Rlci90ZXJyYWZvcm1lci5qcyNMNDcwLUw0ODBcbmZ1bmN0aW9uIGNvb3JkaW5hdGVzQ29udGFpblBvaW50IChjb29yZGluYXRlcywgcG9pbnQpIHtcbiAgdmFyIGNvbnRhaW5zID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAtMSwgbCA9IGNvb3JkaW5hdGVzLmxlbmd0aCwgaiA9IGwgLSAxOyArK2kgPCBsOyBqID0gaSkge1xuICAgIGlmICgoKGNvb3JkaW5hdGVzW2ldWzFdIDw9IHBvaW50WzFdICYmIHBvaW50WzFdIDwgY29vcmRpbmF0ZXNbal1bMV0pIHx8XG4gICAgICAgICAoY29vcmRpbmF0ZXNbal1bMV0gPD0gcG9pbnRbMV0gJiYgcG9pbnRbMV0gPCBjb29yZGluYXRlc1tpXVsxXSkpICYmXG4gICAgICAgIChwb2ludFswXSA8ICgoKGNvb3JkaW5hdGVzW2pdWzBdIC0gY29vcmRpbmF0ZXNbaV1bMF0pICogKHBvaW50WzFdIC0gY29vcmRpbmF0ZXNbaV1bMV0pKSAvIChjb29yZGluYXRlc1tqXVsxXSAtIGNvb3JkaW5hdGVzW2ldWzFdKSkgKyBjb29yZGluYXRlc1tpXVswXSkpIHtcbiAgICAgIGNvbnRhaW5zID0gIWNvbnRhaW5zO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY29udGFpbnM7XG59XG5cbi8vIHBvcnRlZCBmcm9tIHRlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIuanMgaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci9ibG9iL21hc3Rlci90ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyLmpzI0wxMDYtTDExM1xuZnVuY3Rpb24gY29vcmRpbmF0ZXNDb250YWluQ29vcmRpbmF0ZXMgKG91dGVyLCBpbm5lcikge1xuICB2YXIgaW50ZXJzZWN0cyA9IGFycmF5SW50ZXJzZWN0c0FycmF5KG91dGVyLCBpbm5lcik7XG4gIHZhciBjb250YWlucyA9IGNvb3JkaW5hdGVzQ29udGFpblBvaW50KG91dGVyLCBpbm5lclswXSk7XG4gIGlmICghaW50ZXJzZWN0cyAmJiBjb250YWlucykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLy8gZG8gYW55IHBvbHlnb25zIGluIHRoaXMgYXJyYXkgY29udGFpbiBhbnkgb3RoZXIgcG9seWdvbnMgaW4gdGhpcyBhcnJheT9cbi8vIHVzZWQgZm9yIGNoZWNraW5nIGZvciBob2xlcyBpbiBhcmNnaXMgcmluZ3Ncbi8vIHBvcnRlZCBmcm9tIHRlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIuanMgaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci9ibG9iL21hc3Rlci90ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyLmpzI0wxMTctTDE3MlxuZnVuY3Rpb24gY29udmVydFJpbmdzVG9HZW9KU09OIChyaW5ncykge1xuICB2YXIgb3V0ZXJSaW5ncyA9IFtdO1xuICB2YXIgaG9sZXMgPSBbXTtcbiAgdmFyIHg7IC8vIGl0ZXJhdG9yXG4gIHZhciBvdXRlclJpbmc7IC8vIGN1cnJlbnQgb3V0ZXIgcmluZyBiZWluZyBldmFsdWF0ZWRcbiAgdmFyIGhvbGU7IC8vIGN1cnJlbnQgaG9sZSBiZWluZyBldmFsdWF0ZWRcblxuICAvLyBmb3IgZWFjaCByaW5nXG4gIGZvciAodmFyIHIgPSAwOyByIDwgcmluZ3MubGVuZ3RoOyByKyspIHtcbiAgICB2YXIgcmluZyA9IGNsb3NlUmluZyhyaW5nc1tyXS5zbGljZSgwKSk7XG4gICAgaWYgKHJpbmcubGVuZ3RoIDwgNCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIGlzIHRoaXMgcmluZyBhbiBvdXRlciByaW5nPyBpcyBpdCBjbG9ja3dpc2U/XG4gICAgaWYgKHJpbmdJc0Nsb2Nrd2lzZShyaW5nKSkge1xuICAgICAgdmFyIHBvbHlnb24gPSBbIHJpbmcgXTtcbiAgICAgIG91dGVyUmluZ3MucHVzaChwb2x5Z29uKTsgLy8gcHVzaCB0byBvdXRlciByaW5nc1xuICAgIH0gZWxzZSB7XG4gICAgICBob2xlcy5wdXNoKHJpbmcpOyAvLyBjb3VudGVyY2xvY2t3aXNlIHB1c2ggdG8gaG9sZXNcbiAgICB9XG4gIH1cblxuICB2YXIgdW5jb250YWluZWRIb2xlcyA9IFtdO1xuXG4gIC8vIHdoaWxlIHRoZXJlIGFyZSBob2xlcyBsZWZ0Li4uXG4gIHdoaWxlIChob2xlcy5sZW5ndGgpIHtcbiAgICAvLyBwb3AgYSBob2xlIG9mZiBvdXQgc3RhY2tcbiAgICBob2xlID0gaG9sZXMucG9wKCk7XG5cbiAgICAvLyBsb29wIG92ZXIgYWxsIG91dGVyIHJpbmdzIGFuZCBzZWUgaWYgdGhleSBjb250YWluIG91ciBob2xlLlxuICAgIHZhciBjb250YWluZWQgPSBmYWxzZTtcbiAgICBmb3IgKHggPSBvdXRlclJpbmdzLmxlbmd0aCAtIDE7IHggPj0gMDsgeC0tKSB7XG4gICAgICBvdXRlclJpbmcgPSBvdXRlclJpbmdzW3hdWzBdO1xuICAgICAgaWYgKGNvb3JkaW5hdGVzQ29udGFpbkNvb3JkaW5hdGVzKG91dGVyUmluZywgaG9sZSkpIHtcbiAgICAgICAgLy8gdGhlIGhvbGUgaXMgY29udGFpbmVkIHB1c2ggaXQgaW50byBvdXIgcG9seWdvblxuICAgICAgICBvdXRlclJpbmdzW3hdLnB1c2goaG9sZSk7XG4gICAgICAgIGNvbnRhaW5lZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJpbmcgaXMgbm90IGNvbnRhaW5lZCBpbiBhbnkgb3V0ZXIgcmluZ1xuICAgIC8vIHNvbWV0aW1lcyB0aGlzIGhhcHBlbnMgaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvZXNyaS1sZWFmbGV0L2lzc3Vlcy8zMjBcbiAgICBpZiAoIWNvbnRhaW5lZCkge1xuICAgICAgdW5jb250YWluZWRIb2xlcy5wdXNoKGhvbGUpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHdlIGNvdWxkbid0IG1hdGNoIGFueSBob2xlcyB1c2luZyBjb250YWlucyB3ZSBjYW4gdHJ5IGludGVyc2VjdHMuLi5cbiAgd2hpbGUgKHVuY29udGFpbmVkSG9sZXMubGVuZ3RoKSB7XG4gICAgLy8gcG9wIGEgaG9sZSBvZmYgb3V0IHN0YWNrXG4gICAgaG9sZSA9IHVuY29udGFpbmVkSG9sZXMucG9wKCk7XG5cbiAgICAvLyBsb29wIG92ZXIgYWxsIG91dGVyIHJpbmdzIGFuZCBzZWUgaWYgYW55IGludGVyc2VjdCBvdXIgaG9sZS5cbiAgICB2YXIgaW50ZXJzZWN0cyA9IGZhbHNlO1xuXG4gICAgZm9yICh4ID0gb3V0ZXJSaW5ncy5sZW5ndGggLSAxOyB4ID49IDA7IHgtLSkge1xuICAgICAgb3V0ZXJSaW5nID0gb3V0ZXJSaW5nc1t4XVswXTtcbiAgICAgIGlmIChhcnJheUludGVyc2VjdHNBcnJheShvdXRlclJpbmcsIGhvbGUpKSB7XG4gICAgICAgIC8vIHRoZSBob2xlIGlzIGNvbnRhaW5lZCBwdXNoIGl0IGludG8gb3VyIHBvbHlnb25cbiAgICAgICAgb3V0ZXJSaW5nc1t4XS5wdXNoKGhvbGUpO1xuICAgICAgICBpbnRlcnNlY3RzID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbnRlcnNlY3RzKSB7XG4gICAgICBvdXRlclJpbmdzLnB1c2goW2hvbGUucmV2ZXJzZSgpXSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG91dGVyUmluZ3MubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdQb2x5Z29uJyxcbiAgICAgIGNvb3JkaW5hdGVzOiBvdXRlclJpbmdzWzBdXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ011bHRpUG9seWdvbicsXG4gICAgICBjb29yZGluYXRlczogb3V0ZXJSaW5nc1xuICAgIH07XG4gIH1cbn1cblxuLy8gVGhpcyBmdW5jdGlvbiBlbnN1cmVzIHRoYXQgcmluZ3MgYXJlIG9yaWVudGVkIGluIHRoZSByaWdodCBkaXJlY3Rpb25zXG4vLyBvdXRlciByaW5ncyBhcmUgY2xvY2t3aXNlLCBob2xlcyBhcmUgY291bnRlcmNsb2Nrd2lzZVxuLy8gdXNlZCBmb3IgY29udmVydGluZyBHZW9KU09OIFBvbHlnb25zIHRvIEFyY0dJUyBQb2x5Z29uc1xuZnVuY3Rpb24gb3JpZW50UmluZ3MgKHBvbHkpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICB2YXIgcG9seWdvbiA9IHBvbHkuc2xpY2UoMCk7XG4gIHZhciBvdXRlclJpbmcgPSBjbG9zZVJpbmcocG9seWdvbi5zaGlmdCgpLnNsaWNlKDApKTtcbiAgaWYgKG91dGVyUmluZy5sZW5ndGggPj0gNCkge1xuICAgIGlmICghcmluZ0lzQ2xvY2t3aXNlKG91dGVyUmluZykpIHtcbiAgICAgIG91dGVyUmluZy5yZXZlcnNlKCk7XG4gICAgfVxuXG4gICAgb3V0cHV0LnB1c2gob3V0ZXJSaW5nKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG9seWdvbi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGhvbGUgPSBjbG9zZVJpbmcocG9seWdvbltpXS5zbGljZSgwKSk7XG4gICAgICBpZiAoaG9sZS5sZW5ndGggPj0gNCkge1xuICAgICAgICBpZiAocmluZ0lzQ2xvY2t3aXNlKGhvbGUpKSB7XG4gICAgICAgICAgaG9sZS5yZXZlcnNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0LnB1c2goaG9sZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuLy8gVGhpcyBmdW5jdGlvbiBmbGF0dGVucyBob2xlcyBpbiBtdWx0aXBvbHlnb25zIHRvIG9uZSBhcnJheSBvZiBwb2x5Z29uc1xuLy8gdXNlZCBmb3IgY29udmVydGluZyBHZW9KU09OIFBvbHlnb25zIHRvIEFyY0dJUyBQb2x5Z29uc1xuZnVuY3Rpb24gZmxhdHRlbk11bHRpUG9seWdvblJpbmdzIChyaW5ncykge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcG9seWdvbiA9IG9yaWVudFJpbmdzKHJpbmdzW2ldKTtcbiAgICBmb3IgKHZhciB4ID0gcG9seWdvbi5sZW5ndGggLSAxOyB4ID49IDA7IHgtLSkge1xuICAgICAgdmFyIHJpbmcgPSBwb2x5Z29uW3hdLnNsaWNlKDApO1xuICAgICAgb3V0cHV0LnB1c2gocmluZyk7XG4gICAgfVxuICB9XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbi8vIHNoYWxsb3cgb2JqZWN0IGNsb25lIGZvciBmZWF0dXJlIHByb3BlcnRpZXMgYW5kIGF0dHJpYnV0ZXNcbi8vIGZyb20gaHR0cDovL2pzcGVyZi5jb20vY2xvbmluZy1hbi1vYmplY3QvMlxuZnVuY3Rpb24gc2hhbGxvd0Nsb25lIChvYmopIHtcbiAgdmFyIHRhcmdldCA9IHt9O1xuICBmb3IgKHZhciBpIGluIG9iaikge1xuICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgIHRhcmdldFtpXSA9IG9ialtpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFyY2dpc1RvR2VvSlNPTiAoYXJjZ2lzLCBpZEF0dHJpYnV0ZSkge1xuICB2YXIgZ2VvanNvbiA9IHt9O1xuXG4gIGlmICh0eXBlb2YgYXJjZ2lzLnggPT09ICdudW1iZXInICYmIHR5cGVvZiBhcmNnaXMueSA9PT0gJ251bWJlcicpIHtcbiAgICBnZW9qc29uLnR5cGUgPSAnUG9pbnQnO1xuICAgIGdlb2pzb24uY29vcmRpbmF0ZXMgPSBbYXJjZ2lzLngsIGFyY2dpcy55XTtcbiAgfVxuXG4gIGlmIChhcmNnaXMucG9pbnRzKSB7XG4gICAgZ2VvanNvbi50eXBlID0gJ011bHRpUG9pbnQnO1xuICAgIGdlb2pzb24uY29vcmRpbmF0ZXMgPSBhcmNnaXMucG9pbnRzLnNsaWNlKDApO1xuICB9XG5cbiAgaWYgKGFyY2dpcy5wYXRocykge1xuICAgIGlmIChhcmNnaXMucGF0aHMubGVuZ3RoID09PSAxKSB7XG4gICAgICBnZW9qc29uLnR5cGUgPSAnTGluZVN0cmluZyc7XG4gICAgICBnZW9qc29uLmNvb3JkaW5hdGVzID0gYXJjZ2lzLnBhdGhzWzBdLnNsaWNlKDApO1xuICAgIH0gZWxzZSB7XG4gICAgICBnZW9qc29uLnR5cGUgPSAnTXVsdGlMaW5lU3RyaW5nJztcbiAgICAgIGdlb2pzb24uY29vcmRpbmF0ZXMgPSBhcmNnaXMucGF0aHMuc2xpY2UoMCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGFyY2dpcy5yaW5ncykge1xuICAgIGdlb2pzb24gPSBjb252ZXJ0UmluZ3NUb0dlb0pTT04oYXJjZ2lzLnJpbmdzLnNsaWNlKDApKTtcbiAgfVxuXG4gIGlmIChhcmNnaXMuZ2VvbWV0cnkgfHwgYXJjZ2lzLmF0dHJpYnV0ZXMpIHtcbiAgICBnZW9qc29uLnR5cGUgPSAnRmVhdHVyZSc7XG4gICAgZ2VvanNvbi5nZW9tZXRyeSA9IChhcmNnaXMuZ2VvbWV0cnkpID8gYXJjZ2lzVG9HZW9KU09OKGFyY2dpcy5nZW9tZXRyeSkgOiBudWxsO1xuICAgIGdlb2pzb24ucHJvcGVydGllcyA9IChhcmNnaXMuYXR0cmlidXRlcykgPyBzaGFsbG93Q2xvbmUoYXJjZ2lzLmF0dHJpYnV0ZXMpIDogbnVsbDtcbiAgICBpZiAoYXJjZ2lzLmF0dHJpYnV0ZXMpIHtcbiAgICAgIGdlb2pzb24uaWQgPSBhcmNnaXMuYXR0cmlidXRlc1tpZEF0dHJpYnV0ZV0gfHwgYXJjZ2lzLmF0dHJpYnV0ZXMuT0JKRUNUSUQgfHwgYXJjZ2lzLmF0dHJpYnV0ZXMuRklEO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIG5vIHZhbGlkIGdlb21ldHJ5IHdhcyBlbmNvdW50ZXJlZFxuICBpZiAoSlNPTi5zdHJpbmdpZnkoZ2VvanNvbi5nZW9tZXRyeSkgPT09IEpTT04uc3RyaW5naWZ5KHt9KSkge1xuICAgIGdlb2pzb24uZ2VvbWV0cnkgPSBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGdlb2pzb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW9qc29uVG9BcmNHSVMgKGdlb2pzb24sIGlkQXR0cmlidXRlKSB7XG4gIGlkQXR0cmlidXRlID0gaWRBdHRyaWJ1dGUgfHwgJ09CSkVDVElEJztcbiAgdmFyIHNwYXRpYWxSZWZlcmVuY2UgPSB7IHdraWQ6IDQzMjYgfTtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICB2YXIgaTtcblxuICBzd2l0Y2ggKGdlb2pzb24udHlwZSkge1xuICAgIGNhc2UgJ1BvaW50JzpcbiAgICAgIHJlc3VsdC54ID0gZ2VvanNvbi5jb29yZGluYXRlc1swXTtcbiAgICAgIHJlc3VsdC55ID0gZ2VvanNvbi5jb29yZGluYXRlc1sxXTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ011bHRpUG9pbnQnOlxuICAgICAgcmVzdWx0LnBvaW50cyA9IGdlb2pzb24uY29vcmRpbmF0ZXMuc2xpY2UoMCk7XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdMaW5lU3RyaW5nJzpcbiAgICAgIHJlc3VsdC5wYXRocyA9IFtnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApXTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ011bHRpTGluZVN0cmluZyc6XG4gICAgICByZXN1bHQucGF0aHMgPSBnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApO1xuICAgICAgcmVzdWx0LnNwYXRpYWxSZWZlcmVuY2UgPSBzcGF0aWFsUmVmZXJlbmNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnUG9seWdvbic6XG4gICAgICByZXN1bHQucmluZ3MgPSBvcmllbnRSaW5ncyhnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApKTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ011bHRpUG9seWdvbic6XG4gICAgICByZXN1bHQucmluZ3MgPSBmbGF0dGVuTXVsdGlQb2x5Z29uUmluZ3MoZ2VvanNvbi5jb29yZGluYXRlcy5zbGljZSgwKSk7XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdGZWF0dXJlJzpcbiAgICAgIGlmIChnZW9qc29uLmdlb21ldHJ5KSB7XG4gICAgICAgIHJlc3VsdC5nZW9tZXRyeSA9IGdlb2pzb25Ub0FyY0dJUyhnZW9qc29uLmdlb21ldHJ5LCBpZEF0dHJpYnV0ZSk7XG4gICAgICB9XG4gICAgICByZXN1bHQuYXR0cmlidXRlcyA9IChnZW9qc29uLnByb3BlcnRpZXMpID8gc2hhbGxvd0Nsb25lKGdlb2pzb24ucHJvcGVydGllcykgOiB7fTtcbiAgICAgIGlmIChnZW9qc29uLmlkKSB7XG4gICAgICAgIHJlc3VsdC5hdHRyaWJ1dGVzW2lkQXR0cmlidXRlXSA9IGdlb2pzb24uaWQ7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdGZWF0dXJlQ29sbGVjdGlvbic6XG4gICAgICByZXN1bHQgPSBbXTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBnZW9qc29uLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGdlb2pzb25Ub0FyY0dJUyhnZW9qc29uLmZlYXR1cmVzW2ldLCBpZEF0dHJpYnV0ZSkpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnR2VvbWV0cnlDb2xsZWN0aW9uJzpcbiAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGdlb2pzb24uZ2VvbWV0cmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXN1bHQucHVzaChnZW9qc29uVG9BcmNHSVMoZ2VvanNvbi5nZW9tZXRyaWVzW2ldLCBpZEF0dHJpYnV0ZSkpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZGVmYXVsdCB7IGFyY2dpc1RvR2VvSlNPTiwgZ2VvanNvblRvQXJjR0lTIH07XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcblxuZXhwb3J0IHZhciBTeW1ib2wgPSBMLkNsYXNzLmV4dGVuZCh7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fc3ltYm9sSnNvbiA9IHN5bWJvbEpzb247XG4gICAgdGhpcy52YWwgPSBudWxsO1xuICAgIHRoaXMuX3N0eWxlcyA9IHt9O1xuICAgIHRoaXMuX2lzRGVmYXVsdCA9IGZhbHNlO1xuICAgIHRoaXMuX2xheWVyVHJhbnNwYXJlbmN5ID0gMTtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmxheWVyVHJhbnNwYXJlbmN5KSB7XG4gICAgICB0aGlzLl9sYXllclRyYW5zcGFyZW5jeSA9IDEgLSAob3B0aW9ucy5sYXllclRyYW5zcGFyZW5jeSAvIDEwMC4wKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gdGhlIGdlb2pzb24gdmFsdWVzIHJldHVybmVkIGFyZSBpbiBwb2ludHNcbiAgcGl4ZWxWYWx1ZTogZnVuY3Rpb24gKHBvaW50VmFsdWUpIHtcbiAgICByZXR1cm4gcG9pbnRWYWx1ZSAqIDEuMzMzO1xuICB9LFxuXG4gIC8vIGNvbG9yIGlzIGFuIGFycmF5IFtyLGcsYixhXVxuICBjb2xvclZhbHVlOiBmdW5jdGlvbiAoY29sb3IpIHtcbiAgICByZXR1cm4gJ3JnYignICsgY29sb3JbMF0gKyAnLCcgKyBjb2xvclsxXSArICcsJyArIGNvbG9yWzJdICsgJyknO1xuICB9LFxuXG4gIGFscGhhVmFsdWU6IGZ1bmN0aW9uIChjb2xvcikge1xuICAgIHZhciBhbHBoYSA9IGNvbG9yWzNdIC8gMjU1LjA7XG4gICAgcmV0dXJuIGFscGhhICogdGhpcy5fbGF5ZXJUcmFuc3BhcmVuY3k7XG4gIH0sXG5cbiAgZ2V0U2l6ZTogZnVuY3Rpb24gKGZlYXR1cmUsIHNpemVJbmZvKSB7XG4gICAgdmFyIGF0dHIgPSBmZWF0dXJlLnByb3BlcnRpZXM7XG4gICAgdmFyIGZpZWxkID0gc2l6ZUluZm8uZmllbGQ7XG4gICAgdmFyIHNpemUgPSAwO1xuICAgIHZhciBmZWF0dXJlVmFsdWUgPSBudWxsO1xuXG4gICAgaWYgKGZpZWxkKSB7XG4gICAgICBmZWF0dXJlVmFsdWUgPSBhdHRyW2ZpZWxkXTtcbiAgICAgIHZhciBtaW5TaXplID0gc2l6ZUluZm8ubWluU2l6ZTtcbiAgICAgIHZhciBtYXhTaXplID0gc2l6ZUluZm8ubWF4U2l6ZTtcbiAgICAgIHZhciBtaW5EYXRhVmFsdWUgPSBzaXplSW5mby5taW5EYXRhVmFsdWU7XG4gICAgICB2YXIgbWF4RGF0YVZhbHVlID0gc2l6ZUluZm8ubWF4RGF0YVZhbHVlO1xuICAgICAgdmFyIGZlYXR1cmVSYXRpbztcbiAgICAgIHZhciBub3JtRmllbGQgPSBzaXplSW5mby5ub3JtYWxpemF0aW9uRmllbGQ7XG4gICAgICB2YXIgbm9ybVZhbHVlID0gYXR0ciA/IHBhcnNlRmxvYXQoYXR0cltub3JtRmllbGRdKSA6IHVuZGVmaW5lZDtcblxuICAgICAgaWYgKGZlYXR1cmVWYWx1ZSA9PT0gbnVsbCB8fCAobm9ybUZpZWxkICYmICgoaXNOYU4obm9ybVZhbHVlKSB8fCBub3JtVmFsdWUgPT09IDApKSkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmICghaXNOYU4obm9ybVZhbHVlKSkge1xuICAgICAgICBmZWF0dXJlVmFsdWUgLz0gbm9ybVZhbHVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobWluU2l6ZSAhPT0gbnVsbCAmJiBtYXhTaXplICE9PSBudWxsICYmIG1pbkRhdGFWYWx1ZSAhPT0gbnVsbCAmJiBtYXhEYXRhVmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKGZlYXR1cmVWYWx1ZSA8PSBtaW5EYXRhVmFsdWUpIHtcbiAgICAgICAgICBzaXplID0gbWluU2l6ZTtcbiAgICAgICAgfSBlbHNlIGlmIChmZWF0dXJlVmFsdWUgPj0gbWF4RGF0YVZhbHVlKSB7XG4gICAgICAgICAgc2l6ZSA9IG1heFNpemU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmVhdHVyZVJhdGlvID0gKGZlYXR1cmVWYWx1ZSAtIG1pbkRhdGFWYWx1ZSkgLyAobWF4RGF0YVZhbHVlIC0gbWluRGF0YVZhbHVlKTtcbiAgICAgICAgICBzaXplID0gbWluU2l6ZSArIChmZWF0dXJlUmF0aW8gKiAobWF4U2l6ZSAtIG1pblNpemUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2l6ZSA9IGlzTmFOKHNpemUpID8gMCA6IHNpemU7XG4gICAgfVxuICAgIHJldHVybiBzaXplO1xuICB9LFxuXG4gIGdldENvbG9yOiBmdW5jdGlvbiAoZmVhdHVyZSwgY29sb3JJbmZvKSB7XG4gICAgLy8gcmVxdWlyZWQgaW5mb3JtYXRpb24gdG8gZ2V0IGNvbG9yXG4gICAgaWYgKCEoZmVhdHVyZS5wcm9wZXJ0aWVzICYmIGNvbG9ySW5mbyAmJiBjb2xvckluZm8uZmllbGQgJiYgY29sb3JJbmZvLnN0b3BzKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGF0dHIgPSBmZWF0dXJlLnByb3BlcnRpZXM7XG4gICAgdmFyIGZlYXR1cmVWYWx1ZSA9IGF0dHJbY29sb3JJbmZvLmZpZWxkXTtcbiAgICB2YXIgbG93ZXJCb3VuZENvbG9yLCB1cHBlckJvdW5kQ29sb3IsIGxvd2VyQm91bmQsIHVwcGVyQm91bmQ7XG4gICAgdmFyIG5vcm1GaWVsZCA9IGNvbG9ySW5mby5ub3JtYWxpemF0aW9uRmllbGQ7XG4gICAgdmFyIG5vcm1WYWx1ZSA9IGF0dHIgPyBwYXJzZUZsb2F0KGF0dHJbbm9ybUZpZWxkXSkgOiB1bmRlZmluZWQ7XG4gICAgaWYgKGZlYXR1cmVWYWx1ZSA9PT0gbnVsbCB8fCAobm9ybUZpZWxkICYmICgoaXNOYU4obm9ybVZhbHVlKSB8fCBub3JtVmFsdWUgPT09IDApKSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmICghaXNOYU4obm9ybVZhbHVlKSkge1xuICAgICAgZmVhdHVyZVZhbHVlIC89IG5vcm1WYWx1ZTtcbiAgICB9XG5cbiAgICBpZiAoZmVhdHVyZVZhbHVlIDw9IGNvbG9ySW5mby5zdG9wc1swXS52YWx1ZSkge1xuICAgICAgcmV0dXJuIGNvbG9ySW5mby5zdG9wc1swXS5jb2xvcjtcbiAgICB9XG4gICAgdmFyIGxhc3RTdG9wID0gY29sb3JJbmZvLnN0b3BzW2NvbG9ySW5mby5zdG9wcy5sZW5ndGggLSAxXTtcbiAgICBpZiAoZmVhdHVyZVZhbHVlID49IGxhc3RTdG9wLnZhbHVlKSB7XG4gICAgICByZXR1cm4gbGFzdFN0b3AuY29sb3I7XG4gICAgfVxuXG4gICAgLy8gZ28gdGhyb3VnaCB0aGUgc3RvcHMgdG8gZmluZCBtaW4gYW5kIG1heFxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29sb3JJbmZvLnN0b3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3RvcEluZm8gPSBjb2xvckluZm8uc3RvcHNbaV07XG5cbiAgICAgIGlmIChzdG9wSW5mby52YWx1ZSA8PSBmZWF0dXJlVmFsdWUpIHtcbiAgICAgICAgbG93ZXJCb3VuZENvbG9yID0gc3RvcEluZm8uY29sb3I7XG4gICAgICAgIGxvd2VyQm91bmQgPSBzdG9wSW5mby52YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAoc3RvcEluZm8udmFsdWUgPiBmZWF0dXJlVmFsdWUpIHtcbiAgICAgICAgdXBwZXJCb3VuZENvbG9yID0gc3RvcEluZm8uY29sb3I7XG4gICAgICAgIHVwcGVyQm91bmQgPSBzdG9wSW5mby52YWx1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZmVhdHVyZSBmYWxscyBiZXR3ZWVuIHR3byBzdG9wcywgaW50ZXJwbGF0ZSB0aGUgY29sb3JzXG4gICAgaWYgKCFpc05hTihsb3dlckJvdW5kKSAmJiAhaXNOYU4odXBwZXJCb3VuZCkpIHtcbiAgICAgIHZhciByYW5nZSA9IHVwcGVyQm91bmQgLSBsb3dlckJvdW5kO1xuICAgICAgaWYgKHJhbmdlID4gMCkge1xuICAgICAgICAvLyBtb3JlIHdlaWdodCB0aGUgZnVydGhlciBpdCBpcyBmcm9tIHRoZSBsb3dlciBib3VuZFxuICAgICAgICB2YXIgdXBwZXJCb3VuZENvbG9yV2VpZ2h0ID0gKGZlYXR1cmVWYWx1ZSAtIGxvd2VyQm91bmQpIC8gcmFuZ2U7XG4gICAgICAgIGlmICh1cHBlckJvdW5kQ29sb3JXZWlnaHQpIHtcbiAgICAgICAgICAvLyBtb3JlIHdlaWdodCB0aGUgZnVydGhlciBpdCBpcyBmcm9tIHRoZSB1cHBlciBib3VuZFxuICAgICAgICAgIHZhciBsb3dlckJvdW5kQ29sb3JXZWlnaHQgPSAodXBwZXJCb3VuZCAtIGZlYXR1cmVWYWx1ZSkgLyByYW5nZTtcbiAgICAgICAgICBpZiAobG93ZXJCb3VuZENvbG9yV2VpZ2h0KSB7XG4gICAgICAgICAgICAvLyBpbnRlcnBvbGF0ZSB0aGUgbG93ZXIgYW5kIHVwcGVyIGJvdW5kIGNvbG9yIGJ5IGFwcGx5aW5nIHRoZVxuICAgICAgICAgICAgLy8gd2VpZ2h0cyB0byBlYWNoIG9mIHRoZSByZ2JhIGNvbG9ycyBhbmQgYWRkaW5nIHRoZW0gdG9nZXRoZXJcbiAgICAgICAgICAgIHZhciBpbnRlcnBvbGF0ZWRDb2xvciA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCA0OyBqKyspIHtcbiAgICAgICAgICAgICAgaW50ZXJwb2xhdGVkQ29sb3Jbal0gPSBNYXRoLnJvdW5kKChsb3dlckJvdW5kQ29sb3Jbal0gKiBsb3dlckJvdW5kQ29sb3JXZWlnaHQpICsgKHVwcGVyQm91bmRDb2xvcltqXSAqIHVwcGVyQm91bmRDb2xvcldlaWdodCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGludGVycG9sYXRlZENvbG9yO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyBkaWZmZXJlbmNlIGJldHdlZW4gZmVhdHVyZVZhbHVlIGFuZCB1cHBlckJvdW5kLCAxMDAlIG9mIHVwcGVyQm91bmRDb2xvclxuICAgICAgICAgICAgcmV0dXJuIHVwcGVyQm91bmRDb2xvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm8gZGlmZmVyZW5jZSBiZXR3ZWVuIGZlYXR1cmVWYWx1ZSBhbmQgbG93ZXJCb3VuZCwgMTAwJSBvZiBsb3dlckJvdW5kQ29sb3JcbiAgICAgICAgICByZXR1cm4gbG93ZXJCb3VuZENvbG9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHdlIGdldCB0byBoZXJlLCBub25lIG9mIHRoZSBjYXNlcyBhcHBseSBzbyByZXR1cm4gbnVsbFxuICAgIHJldHVybiBudWxsO1xuICB9XG59KTtcblxuLy8gZXhwb3J0IGZ1bmN0aW9uIHN5bWJvbCAoc3ltYm9sSnNvbikge1xuLy8gICByZXR1cm4gbmV3IFN5bWJvbChzeW1ib2xKc29uKTtcbi8vIH1cblxuZXhwb3J0IGRlZmF1bHQgU3ltYm9sO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5cbmV4cG9ydCB2YXIgU2hhcGVNYXJrZXIgPSBMLlBhdGguZXh0ZW5kKHtcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICAgIHRoaXMuX3NpemUgPSBzaXplO1xuICAgIHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XG4gICAgdGhpcy5fc3ZnQ2FudmFzSW5jbHVkZXMoKTtcbiAgfSxcblxuICB0b0dlb0pTT046IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xuICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgIGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5nZXRMYXRMbmcoKSlcbiAgICB9KTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBpbXBsZW1lbnQgaW4gc3ViIGNsYXNzXG4gIH0sXG5cbiAgX3Byb2plY3Q6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wb2ludCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fbGF0bG5nKTtcbiAgfSxcblxuICBfdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX21hcCkge1xuICAgICAgdGhpcy5fdXBkYXRlUGF0aCgpO1xuICAgIH1cbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIC8vIGltcGxlbWVudCBpbiBzdWIgY2xhc3NcbiAgfSxcblxuICBzZXRMYXRMbmc6IGZ1bmN0aW9uIChsYXRsbmcpIHtcbiAgICB0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xuICAgIHRoaXMucmVkcmF3KCk7XG4gICAgcmV0dXJuIHRoaXMuZmlyZSgnbW92ZScsIHtsYXRsbmc6IHRoaXMuX2xhdGxuZ30pO1xuICB9LFxuXG4gIGdldExhdExuZzogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9sYXRsbmc7XG4gIH0sXG5cbiAgc2V0U2l6ZTogZnVuY3Rpb24gKHNpemUpIHtcbiAgICB0aGlzLl9zaXplID0gc2l6ZTtcbiAgICByZXR1cm4gdGhpcy5yZWRyYXcoKTtcbiAgfSxcblxuICBnZXRTaXplOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NpemU7XG4gIH1cbn0pO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgeyBTaGFwZU1hcmtlciB9IGZyb20gJy4vU2hhcGVNYXJrZXInO1xuXG5leHBvcnQgdmFyIENyb3NzTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZUNyb3NzTWFya2VyKHRoaXMpO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIEwuQ2FudmFzLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZUNyb3NzTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuICAgICAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG5cbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSk7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBMLlNWRy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVDcm9zc01hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgbGF0bG5nLnggKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyBsYXRsbmcueCArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdNJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyBsYXRsbmcueSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIGxhdGxuZy55O1xuXG4gICAgICAgIHRoaXMuX3NldFBhdGgobGF5ZXIsIHN0cik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgdmFyIGNyb3NzTWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IENyb3NzTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBjcm9zc01hcmtlcjtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgU2hhcGVNYXJrZXIgfSBmcm9tICcuL1NoYXBlTWFya2VyJztcblxuZXhwb3J0IHZhciBYTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZVhNYXJrZXIodGhpcyk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgTC5DYW52YXMuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlWE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBMLlNWRy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVYTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuXG4gICAgICAgIGlmIChMLkJyb3dzZXIudm1sKSB7XG4gICAgICAgICAgbGF0bG5nLl9yb3VuZCgpO1xuICAgICAgICAgIG9mZnNldCA9IE1hdGgucm91bmQob2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdHIgPSAnTScgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdNJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciB4TWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFhNYXJrZXIobGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHhNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IFNoYXBlTWFya2VyIH0gZnJvbSAnLi9TaGFwZU1hcmtlcic7XG5cbmV4cG9ydCB2YXIgU3F1YXJlTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIGZpbGw6IHRydWVcbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZVNxdWFyZU1hcmtlcih0aGlzKTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBMLkNhbnZhcy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVTcXVhcmVNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG4gICAgICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55IC0gb2Zmc2V0KTtcblxuICAgICAgICBjdHguY2xvc2VQYXRoKCk7XG5cbiAgICAgICAgdGhpcy5fZmlsbFN0cm9rZShjdHgsIGxheWVyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIEwuU1ZHLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZVNxdWFyZU1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCk7XG5cbiAgICAgICAgc3RyID0gc3RyICsgKEwuQnJvd3Nlci5zdmcgPyAneicgOiAneCcpO1xuXG4gICAgICAgIHRoaXMuX3NldFBhdGgobGF5ZXIsIHN0cik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgdmFyIHNxdWFyZU1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBTcXVhcmVNYXJrZXIobGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHNxdWFyZU1hcmtlcjtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgU2hhcGVNYXJrZXIgfSBmcm9tICcuL1NoYXBlTWFya2VyJztcblxuZXhwb3J0IHZhciBEaWFtb25kTWFya2VyID0gU2hhcGVNYXJrZXIuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIGZpbGw6IHRydWVcbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gICAgU2hhcGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3VwZGF0ZURpYW1vbmRNYXJrZXIodGhpcyk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgTC5DYW52YXMuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlRGlhbW9uZE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLngsIGxhdGxuZy55IC0gb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkpO1xuXG4gICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcblxuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgTC5TVkcuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlRGlhbW9uZE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgbGF0bG5nLnggKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgbGF0bG5nLnkgK1xuICAgICAgICAgICdMJyArIGxhdGxuZy54ICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIGxhdGxuZy55O1xuXG4gICAgICAgIHN0ciA9IHN0ciArIChMLkJyb3dzZXIuc3ZnID8gJ3onIDogJ3gnKTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciBkaWFtb25kTWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IERpYW1vbmRNYXJrZXIobGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRpYW1vbmRNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCBTeW1ib2wgZnJvbSAnLi9TeW1ib2wnO1xuaW1wb3J0IHtzcXVhcmVNYXJrZXIsIHhNYXJrZXIsIGNyb3NzTWFya2VyLCBkaWFtb25kTWFya2VyfSBmcm9tICdsZWFmbGV0LXNoYXBlLW1hcmtlcnMnO1xuXG5leHBvcnQgdmFyIFBvaW50U3ltYm9sID0gU3ltYm9sLmV4dGVuZCh7XG5cbiAgc3RhdGljczoge1xuICAgIE1BUktFUlRZUEVTOiBbJ2VzcmlTTVNDaXJjbGUnLCAnZXNyaVNNU0Nyb3NzJywgJ2VzcmlTTVNEaWFtb25kJywgJ2VzcmlTTVNTcXVhcmUnLCAnZXNyaVNNU1gnLCAnZXNyaVBNUyddXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgICB2YXIgdXJsO1xuICAgIFN5bWJvbC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHN5bWJvbEpzb24sIG9wdGlvbnMpO1xuICAgIGlmIChvcHRpb25zKSB7XG4gICAgICB0aGlzLnNlcnZpY2VVcmwgPSBvcHRpb25zLnVybDtcbiAgICB9XG4gICAgaWYgKHN5bWJvbEpzb24pIHtcbiAgICAgIGlmIChzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpUE1TJykge1xuICAgICAgICB2YXIgaW1hZ2VVcmwgPSB0aGlzLl9zeW1ib2xKc29uLnVybDtcbiAgICAgICAgaWYgKChpbWFnZVVybCAmJiBpbWFnZVVybC5zdWJzdHIoMCwgNykgPT09ICdodHRwOi8vJykgfHwgKGltYWdlVXJsLnN1YnN0cigwLCA4KSA9PT0gJ2h0dHBzOi8vJykpIHtcbiAgICAgICAgICAvLyB3ZWIgaW1hZ2VcbiAgICAgICAgICB1cmwgPSB0aGlzLnNhbml0aXplKGltYWdlVXJsKTtcbiAgICAgICAgICB0aGlzLl9pY29uVXJsID0gdXJsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVybCA9IHRoaXMuc2VydmljZVVybCArICdpbWFnZXMvJyArIGltYWdlVXJsO1xuICAgICAgICAgIHRoaXMuX2ljb25VcmwgPSBvcHRpb25zICYmIG9wdGlvbnMudG9rZW4gPyB1cmwgKyAnP3Rva2VuPScgKyBvcHRpb25zLnRva2VuIDogdXJsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzeW1ib2xKc29uLmltYWdlRGF0YSkge1xuICAgICAgICAgIHRoaXMuX2ljb25VcmwgPSAnZGF0YTonICsgc3ltYm9sSnNvbi5jb250ZW50VHlwZSArICc7YmFzZTY0LCcgKyBzeW1ib2xKc29uLmltYWdlRGF0YTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZWFmbGV0IGRvZXMgbm90IGFsbG93IHJlc2l6aW5nIGljb25zIHNvIGtlZXAgYSBoYXNoIG9mIGRpZmZlcmVudFxuICAgICAgICAvLyBpY29uIHNpemVzIHRvIHRyeSBhbmQga2VlcCBkb3duIG9uIHRoZSBudW1iZXIgb2YgaWNvbnMgY3JlYXRlZFxuICAgICAgICB0aGlzLl9pY29ucyA9IHt9O1xuICAgICAgICAvLyBjcmVhdGUgYmFzZSBpY29uXG4gICAgICAgIHRoaXMuaWNvbiA9IHRoaXMuX2NyZWF0ZUljb24odGhpcy5fc3ltYm9sSnNvbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maWxsU3R5bGVzKCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIC8vIHByZXZlbnQgaHRtbCBpbmplY3Rpb24gaW4gc3RyaW5nc1xuICBzYW5pdGl6ZTogZnVuY3Rpb24gKHN0cikge1xuICAgIGlmICghc3RyKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHZhciB0ZXh0O1xuICAgIHRyeSB7XG4gICAgICAvLyByZW1vdmVzIGh0bWwgYnV0IGxlYXZlcyB1cmwgbGluayB0ZXh0XG4gICAgICB0ZXh0ID0gc3RyLnJlcGxhY2UoLzxicj4vZ2ksICdcXG4nKTtcbiAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoLzxwLio+L2dpLCAnXFxuJyk7XG4gICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88YS4qaHJlZj0nKC4qPyknLio+KC4qPyk8XFwvYT4vZ2ksICcgJDIgKCQxKSAnKTtcbiAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoLzwoPzoufFxccykqPz4vZywgJycpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0ZXh0ID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRleHQ7XG4gIH0sXG5cbiAgX2ZpbGxTdHlsZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lICYmIHRoaXMuX3N5bWJvbEpzb24uc2l6ZSA+IDAgJiYgdGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lLnN0eWxlICE9PSAnZXNyaVNMU051bGwnKSB7XG4gICAgICB0aGlzLl9zdHlsZXMuc3Ryb2tlID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3N0eWxlcy53ZWlnaHQgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lLndpZHRoKTtcbiAgICAgIHRoaXMuX3N0eWxlcy5jb2xvciA9IHRoaXMuY29sb3JWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUuY29sb3IpO1xuICAgICAgdGhpcy5fc3R5bGVzLm9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lLmNvbG9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3R5bGVzLnN0cm9rZSA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5jb2xvcikge1xuICAgICAgdGhpcy5fc3R5bGVzLmZpbGxDb2xvciA9IHRoaXMuY29sb3JWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gMDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSA9PT0gJ2VzcmlTTVNDaXJjbGUnKSB7XG4gICAgICB0aGlzLl9zdHlsZXMucmFkaXVzID0gdGhpcy5waXhlbFZhbHVlKHRoaXMuX3N5bWJvbEpzb24uc2l6ZSkgLyAyLjA7XG4gICAgfVxuICB9LFxuXG4gIF9jcmVhdGVJY29uOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciB3aWR0aCA9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLndpZHRoKTtcbiAgICB2YXIgaGVpZ2h0ID0gd2lkdGg7XG4gICAgaWYgKG9wdGlvbnMuaGVpZ2h0KSB7XG4gICAgICBoZWlnaHQgPSB0aGlzLnBpeGVsVmFsdWUob3B0aW9ucy5oZWlnaHQpO1xuICAgIH1cbiAgICB2YXIgeE9mZnNldCA9IHdpZHRoIC8gMi4wO1xuICAgIHZhciB5T2Zmc2V0ID0gaGVpZ2h0IC8gMi4wO1xuXG4gICAgaWYgKG9wdGlvbnMueG9mZnNldCkge1xuICAgICAgeE9mZnNldCArPSB0aGlzLnBpeGVsVmFsdWUob3B0aW9ucy54b2Zmc2V0KTtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMueW9mZnNldCkge1xuICAgICAgeU9mZnNldCArPSB0aGlzLnBpeGVsVmFsdWUob3B0aW9ucy55b2Zmc2V0KTtcbiAgICB9XG5cbiAgICB2YXIgaWNvbiA9IEwuaWNvbih7XG4gICAgICBpY29uVXJsOiB0aGlzLl9pY29uVXJsLFxuICAgICAgaWNvblNpemU6IFt3aWR0aCwgaGVpZ2h0XSxcbiAgICAgIGljb25BbmNob3I6IFt4T2Zmc2V0LCB5T2Zmc2V0XVxuICAgIH0pO1xuICAgIHRoaXMuX2ljb25zW29wdGlvbnMud2lkdGgudG9TdHJpbmcoKV0gPSBpY29uO1xuICAgIHJldHVybiBpY29uO1xuICB9LFxuXG4gIF9nZXRJY29uOiBmdW5jdGlvbiAoc2l6ZSkge1xuICAgIC8vIGNoZWNrIHRvIHNlZSBpZiBpdCBpcyBhbHJlYWR5IGNyZWF0ZWQgYnkgc2l6ZVxuICAgIHZhciBpY29uID0gdGhpcy5faWNvbnNbc2l6ZS50b1N0cmluZygpXTtcbiAgICBpZiAoIWljb24pIHtcbiAgICAgIGljb24gPSB0aGlzLl9jcmVhdGVJY29uKHt3aWR0aDogc2l6ZX0pO1xuICAgIH1cbiAgICByZXR1cm4gaWNvbjtcbiAgfSxcblxuICBwb2ludFRvTGF5ZXI6IGZ1bmN0aW9uIChnZW9qc29uLCBsYXRsbmcsIHZpc3VhbFZhcmlhYmxlcywgb3B0aW9ucykge1xuICAgIHZhciBzaXplID0gdGhpcy5fc3ltYm9sSnNvbi5zaXplIHx8IHRoaXMuX3N5bWJvbEpzb24ud2lkdGg7XG4gICAgaWYgKCF0aGlzLl9pc0RlZmF1bHQpIHtcbiAgICAgIGlmICh2aXN1YWxWYXJpYWJsZXMuc2l6ZUluZm8pIHtcbiAgICAgICAgdmFyIGNhbGN1bGF0ZWRTaXplID0gdGhpcy5nZXRTaXplKGdlb2pzb24sIHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbyk7XG4gICAgICAgIGlmIChjYWxjdWxhdGVkU2l6ZSkge1xuICAgICAgICAgIHNpemUgPSBjYWxjdWxhdGVkU2l6ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pIHtcbiAgICAgICAgdmFyIGNvbG9yID0gdGhpcy5nZXRDb2xvcihnZW9qc29uLCB2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKTtcbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxDb2xvciA9IHRoaXMuY29sb3JWYWx1ZShjb2xvcik7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKGNvbG9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpUE1TJykge1xuICAgICAgdmFyIGxheWVyT3B0aW9ucyA9IEwuZXh0ZW5kKHt9LCB7aWNvbjogdGhpcy5fZ2V0SWNvbihzaXplKX0sIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuIEwubWFya2VyKGxhdGxuZywgbGF5ZXJPcHRpb25zKTtcbiAgICB9XG4gICAgc2l6ZSA9IHRoaXMucGl4ZWxWYWx1ZShzaXplKTtcblxuICAgIHN3aXRjaCAodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSkge1xuICAgICAgY2FzZSAnZXNyaVNNU1NxdWFyZSc6XG4gICAgICAgIHJldHVybiBzcXVhcmVNYXJrZXIobGF0bG5nLCBzaXplLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gICAgICBjYXNlICdlc3JpU01TRGlhbW9uZCc6XG4gICAgICAgIHJldHVybiBkaWFtb25kTWFya2VyKGxhdGxuZywgc2l6ZSwgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICAgICAgY2FzZSAnZXNyaVNNU0Nyb3NzJzpcbiAgICAgICAgcmV0dXJuIGNyb3NzTWFya2VyKGxhdGxuZywgc2l6ZSwgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICAgICAgY2FzZSAnZXNyaVNNU1gnOlxuICAgICAgICByZXR1cm4geE1hcmtlcihsYXRsbmcsIHNpemUsIEwuZXh0ZW5kKHt9LCB0aGlzLl9zdHlsZXMsIG9wdGlvbnMpKTtcbiAgICB9XG4gICAgdGhpcy5fc3R5bGVzLnJhZGl1cyA9IHNpemUgLyAyLjA7XG4gICAgcmV0dXJuIEwuY2lyY2xlTWFya2VyKGxhdGxuZywgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBvaW50U3ltYm9sIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgUG9pbnRTeW1ib2woc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBvaW50U3ltYm9sO1xuIiwiaW1wb3J0IFN5bWJvbCBmcm9tICcuL1N5bWJvbCc7XG5cbmV4cG9ydCB2YXIgTGluZVN5bWJvbCA9IFN5bWJvbC5leHRlbmQoe1xuICBzdGF0aWNzOiB7XG4gICAgLy8gTm90IGltcGxlbWVudGVkICdlc3JpU0xTTnVsbCdcbiAgICBMSU5FVFlQRVM6IFsnZXNyaVNMU0Rhc2gnLCAnZXNyaVNMU0RvdCcsICdlc3JpU0xTRGFzaERvdERvdCcsICdlc3JpU0xTRGFzaERvdCcsICdlc3JpU0xTU29saWQnXVxuICB9LFxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICAgIFN5bWJvbC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHN5bWJvbEpzb24sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2ZpbGxTdHlsZXMoKTtcbiAgfSxcblxuICBfZmlsbFN0eWxlczogZnVuY3Rpb24gKCkge1xuICAgIC8vIHNldCB0aGUgZGVmYXVsdHMgdGhhdCBzaG93IHVwIG9uIGFyY2dpcyBvbmxpbmVcbiAgICB0aGlzLl9zdHlsZXMubGluZUNhcCA9ICdidXR0JztcbiAgICB0aGlzLl9zdHlsZXMubGluZUpvaW4gPSAnbWl0ZXInO1xuICAgIHRoaXMuX3N0eWxlcy5maWxsID0gZmFsc2U7XG4gICAgdGhpcy5fc3R5bGVzLndlaWdodCA9IDA7XG5cbiAgICBpZiAoIXRoaXMuX3N5bWJvbEpzb24pIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdHlsZXM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5jb2xvciA9IHRoaXMuY29sb3JWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICAgIHRoaXMuX3N0eWxlcy5vcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgIH1cblxuICAgIGlmICghaXNOYU4odGhpcy5fc3ltYm9sSnNvbi53aWR0aCkpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy53ZWlnaHQgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5fc3ltYm9sSnNvbi53aWR0aCk7XG5cbiAgICAgIHZhciBkYXNoVmFsdWVzID0gW107XG5cbiAgICAgIHN3aXRjaCAodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSkge1xuICAgICAgICBjYXNlICdlc3JpU0xTRGFzaCc6XG4gICAgICAgICAgZGFzaFZhbHVlcyA9IFs0LCAzXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZXNyaVNMU0RvdCc6XG4gICAgICAgICAgZGFzaFZhbHVlcyA9IFsxLCAzXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZXNyaVNMU0Rhc2hEb3QnOlxuICAgICAgICAgIGRhc2hWYWx1ZXMgPSBbOCwgMywgMSwgM107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2VzcmlTTFNEYXNoRG90RG90JzpcbiAgICAgICAgICBkYXNoVmFsdWVzID0gWzgsIDMsIDEsIDMsIDEsIDNdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyB1c2UgdGhlIGRhc2ggdmFsdWVzIGFuZCB0aGUgbGluZSB3ZWlnaHQgdG8gc2V0IGRhc2ggYXJyYXlcbiAgICAgIGlmIChkYXNoVmFsdWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXNoVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZGFzaFZhbHVlc1tpXSAqPSB0aGlzLl9zdHlsZXMud2VpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3R5bGVzLmRhc2hBcnJheSA9IGRhc2hWYWx1ZXMuam9pbignLCcpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzdHlsZTogZnVuY3Rpb24gKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcykge1xuICAgIGlmICghdGhpcy5faXNEZWZhdWx0ICYmIHZpc3VhbFZhcmlhYmxlcykge1xuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbykge1xuICAgICAgICB2YXIgY2FsY3VsYXRlZFNpemUgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5nZXRTaXplKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbykpO1xuICAgICAgICBpZiAoY2FsY3VsYXRlZFNpemUpIHtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMud2VpZ2h0ID0gY2FsY3VsYXRlZFNpemU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKSB7XG4gICAgICAgIHZhciBjb2xvciA9IHRoaXMuZ2V0Q29sb3IoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbyk7XG4gICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgIHRoaXMuX3N0eWxlcy5jb2xvciA9IHRoaXMuY29sb3JWYWx1ZShjb2xvcik7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLm9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUoY29sb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHlsZXM7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gbGluZVN5bWJvbCAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IExpbmVTeW1ib2woc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGxpbmVTeW1ib2w7XG4iLCJpbXBvcnQgU3ltYm9sIGZyb20gJy4vU3ltYm9sJztcbmltcG9ydCBsaW5lU3ltYm9sIGZyb20gJy4vTGluZVN5bWJvbCc7XG5cbmV4cG9ydCB2YXIgUG9seWdvblN5bWJvbCA9IFN5bWJvbC5leHRlbmQoe1xuICBzdGF0aWNzOiB7XG4gICAgLy8gbm90IGltcGxlbWVudGVkOiAnZXNyaVNGU0JhY2t3YXJkRGlhZ29uYWwnLCdlc3JpU0ZTQ3Jvc3MnLCdlc3JpU0ZTRGlhZ29uYWxDcm9zcycsJ2VzcmlTRlNGb3J3YXJkRGlhZ29uYWwnLCdlc3JpU0ZTSG9yaXpvbnRhbCcsJ2VzcmlTRlNOdWxsJywnZXNyaVNGU1ZlcnRpY2FsJ1xuICAgIFBPTFlHT05UWVBFUzogWydlc3JpU0ZTU29saWQnXVxuICB9LFxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICAgIFN5bWJvbC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHN5bWJvbEpzb24sIG9wdGlvbnMpO1xuICAgIGlmIChzeW1ib2xKc29uKSB7XG4gICAgICBpZiAoc3ltYm9sSnNvbi5vdXRsaW5lICYmIHN5bWJvbEpzb24ub3V0bGluZS5zdHlsZSA9PT0gJ2VzcmlTTFNOdWxsJykge1xuICAgICAgICB0aGlzLl9saW5lU3R5bGVzID0geyB3ZWlnaHQ6IDAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2xpbmVTdHlsZXMgPSBsaW5lU3ltYm9sKHN5bWJvbEpzb24ub3V0bGluZSwgb3B0aW9ucykuc3R5bGUoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2ZpbGxTdHlsZXMoKTtcbiAgICB9XG4gIH0sXG5cbiAgX2ZpbGxTdHlsZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fbGluZVN0eWxlcykge1xuICAgICAgaWYgKHRoaXMuX2xpbmVTdHlsZXMud2VpZ2h0ID09PSAwKSB7XG4gICAgICAgIC8vIHdoZW4gd2VpZ2h0IGlzIDAsIHNldHRpbmcgdGhlIHN0cm9rZSB0byBmYWxzZSBjYW4gc3RpbGwgbG9vayBiYWRcbiAgICAgICAgLy8gKGdhcHMgYmV0d2VlbiB0aGUgcG9seWdvbnMpXG4gICAgICAgIHRoaXMuX3N0eWxlcy5zdHJva2UgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNvcHkgdGhlIGxpbmUgc3ltYm9sIHN0eWxlcyBpbnRvIHRoaXMgc3ltYm9sJ3Mgc3R5bGVzXG4gICAgICAgIGZvciAodmFyIHN0eWxlQXR0ciBpbiB0aGlzLl9saW5lU3R5bGVzKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzW3N0eWxlQXR0cl0gPSB0aGlzLl9saW5lU3R5bGVzW3N0eWxlQXR0cl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgdGhlIGZpbGwgZm9yIHRoZSBwb2x5Z29uXG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24pIHtcbiAgICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLmNvbG9yICYmXG4gICAgICAgICAgLy8gZG9uJ3QgZmlsbCBwb2x5Z29uIGlmIHR5cGUgaXMgbm90IHN1cHBvcnRlZFxuICAgICAgICAgIFBvbHlnb25TeW1ib2wuUE9MWUdPTlRZUEVTLmluZGV4T2YodGhpcy5fc3ltYm9sSnNvbi5zdHlsZSA+PSAwKSkge1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsQ29sb3IgPSB0aGlzLmNvbG9yVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IDA7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHN0eWxlOiBmdW5jdGlvbiAoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzKSB7XG4gICAgaWYgKCF0aGlzLl9pc0RlZmF1bHQgJiYgdmlzdWFsVmFyaWFibGVzICYmIHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pIHtcbiAgICAgIHZhciBjb2xvciA9IHRoaXMuZ2V0Q29sb3IoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbyk7XG4gICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxDb2xvciA9IHRoaXMuY29sb3JWYWx1ZShjb2xvcik7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZShjb2xvcik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHlsZXM7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gcG9seWdvblN5bWJvbCAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFBvbHlnb25TeW1ib2woc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBvbHlnb25TeW1ib2w7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcblxuaW1wb3J0IHBvaW50U3ltYm9sIGZyb20gJy4uL1N5bWJvbHMvUG9pbnRTeW1ib2wnO1xuaW1wb3J0IGxpbmVTeW1ib2wgZnJvbSAnLi4vU3ltYm9scy9MaW5lU3ltYm9sJztcbmltcG9ydCBwb2x5Z29uU3ltYm9sIGZyb20gJy4uL1N5bWJvbHMvUG9seWdvblN5bWJvbCc7XG5cbmV4cG9ydCB2YXIgUmVuZGVyZXIgPSBMLkNsYXNzLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBwcm9wb3J0aW9uYWxQb2x5Z29uOiBmYWxzZSxcbiAgICBjbGlja2FibGU6IHRydWVcbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fcmVuZGVyZXJKc29uID0gcmVuZGVyZXJKc29uO1xuICAgIHRoaXMuX3BvaW50U3ltYm9scyA9IGZhbHNlO1xuICAgIHRoaXMuX3N5bWJvbHMgPSBbXTtcbiAgICB0aGlzLl92aXN1YWxWYXJpYWJsZXMgPSB0aGlzLl9wYXJzZVZpc3VhbFZhcmlhYmxlcyhyZW5kZXJlckpzb24udmlzdWFsVmFyaWFibGVzKTtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcbiAgfSxcblxuICBfcGFyc2VWaXN1YWxWYXJpYWJsZXM6IGZ1bmN0aW9uICh2aXN1YWxWYXJpYWJsZXMpIHtcbiAgICB2YXIgdmlzVmFycyA9IHt9O1xuICAgIGlmICh2aXN1YWxWYXJpYWJsZXMpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlzdWFsVmFyaWFibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZpc1ZhcnNbdmlzdWFsVmFyaWFibGVzW2ldLnR5cGVdID0gdmlzdWFsVmFyaWFibGVzW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmlzVmFycztcbiAgfSxcblxuICBfY3JlYXRlRGVmYXVsdFN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24uZGVmYXVsdFN5bWJvbCkge1xuICAgICAgdGhpcy5fZGVmYXVsdFN5bWJvbCA9IHRoaXMuX25ld1N5bWJvbCh0aGlzLl9yZW5kZXJlckpzb24uZGVmYXVsdFN5bWJvbCk7XG4gICAgICB0aGlzLl9kZWZhdWx0U3ltYm9sLl9pc0RlZmF1bHQgPSB0cnVlO1xuICAgIH1cbiAgfSxcblxuICBfbmV3U3ltYm9sOiBmdW5jdGlvbiAoc3ltYm9sSnNvbikge1xuICAgIGlmIChzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpU01TJyB8fCBzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpUE1TJykge1xuICAgICAgdGhpcy5fcG9pbnRTeW1ib2xzID0gdHJ1ZTtcbiAgICAgIHJldHVybiBwb2ludFN5bWJvbChzeW1ib2xKc29uLCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbiAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVNMUycpIHtcbiAgICAgIHJldHVybiBsaW5lU3ltYm9sKHN5bWJvbEpzb24sIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuICAgIGlmIChzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpU0ZTJykge1xuICAgICAgcmV0dXJuIHBvbHlnb25TeW1ib2woc3ltYm9sSnNvbiwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIC8vIG92ZXJyaWRlXG4gIH0sXG5cbiAgYXR0YWNoU3R5bGVzVG9MYXllcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgaWYgKHRoaXMuX3BvaW50U3ltYm9scykge1xuICAgICAgbGF5ZXIub3B0aW9ucy5wb2ludFRvTGF5ZXIgPSBMLlV0aWwuYmluZCh0aGlzLnBvaW50VG9MYXllciwgdGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxheWVyLm9wdGlvbnMuc3R5bGUgPSBMLlV0aWwuYmluZCh0aGlzLnN0eWxlLCB0aGlzKTtcbiAgICAgIGxheWVyLl9vcmlnaW5hbFN0eWxlID0gbGF5ZXIub3B0aW9ucy5zdHlsZTtcbiAgICB9XG4gIH0sXG5cbiAgcG9pbnRUb0xheWVyOiBmdW5jdGlvbiAoZ2VvanNvbiwgbGF0bG5nKSB7XG4gICAgdmFyIHN5bSA9IHRoaXMuX2dldFN5bWJvbChnZW9qc29uKTtcbiAgICBpZiAoc3ltICYmIHN5bS5wb2ludFRvTGF5ZXIpIHtcbiAgICAgIC8vIHJpZ2h0IG5vdyBjdXN0b20gcGFuZXMgYXJlIHRoZSBvbmx5IG9wdGlvbiBwdXNoZWQgdGhyb3VnaFxuICAgICAgcmV0dXJuIHN5bS5wb2ludFRvTGF5ZXIoZ2VvanNvbiwgbGF0bG5nLCB0aGlzLl92aXN1YWxWYXJpYWJsZXMsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuICAgIC8vIGludmlzaWJsZSBzeW1ib2xvZ3lcbiAgICByZXR1cm4gTC5jaXJjbGVNYXJrZXIobGF0bG5nLCB7cmFkaXVzOiAwLCBvcGFjaXR5OiAwfSk7XG4gIH0sXG5cbiAgc3R5bGU6IGZ1bmN0aW9uIChmZWF0dXJlKSB7XG4gICAgdmFyIHVzZXJTdHlsZXM7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VyRGVmaW5lZFN0eWxlKSB7XG4gICAgICB1c2VyU3R5bGVzID0gdGhpcy5vcHRpb25zLnVzZXJEZWZpbmVkU3R5bGUoZmVhdHVyZSk7XG4gICAgfVxuICAgIC8vIGZpbmQgdGhlIHN5bWJvbCB0byByZXByZXNlbnQgdGhpcyBmZWF0dXJlXG4gICAgdmFyIHN5bSA9IHRoaXMuX2dldFN5bWJvbChmZWF0dXJlKTtcbiAgICBpZiAoc3ltKSB7XG4gICAgICByZXR1cm4gdGhpcy5tZXJnZVN0eWxlcyhzeW0uc3R5bGUoZmVhdHVyZSwgdGhpcy5fdmlzdWFsVmFyaWFibGVzKSwgdXNlclN0eWxlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmlzaWJsZSBzeW1ib2xvZ3lcbiAgICAgIHJldHVybiB0aGlzLm1lcmdlU3R5bGVzKHtvcGFjaXR5OiAwLCBmaWxsT3BhY2l0eTogMH0sIHVzZXJTdHlsZXMpO1xuICAgIH1cbiAgfSxcblxuICBtZXJnZVN0eWxlczogZnVuY3Rpb24gKHN0eWxlcywgdXNlclN0eWxlcykge1xuICAgIHZhciBtZXJnZWRTdHlsZXMgPSB7fTtcbiAgICB2YXIgYXR0cjtcbiAgICAvLyBjb3B5IHJlbmRlcmVyIHN0eWxlIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGF0dHIgaW4gc3R5bGVzKSB7XG4gICAgICBpZiAoc3R5bGVzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIG1lcmdlZFN0eWxlc1thdHRyXSA9IHN0eWxlc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgd2l0aCB1c2VyIGRlZmluZWQgc3R5bGUgYXR0cmlidXRlc1xuICAgIGlmICh1c2VyU3R5bGVzKSB7XG4gICAgICBmb3IgKGF0dHIgaW4gdXNlclN0eWxlcykge1xuICAgICAgICBpZiAodXNlclN0eWxlcy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICAgIG1lcmdlZFN0eWxlc1thdHRyXSA9IHVzZXJTdHlsZXNbYXR0cl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1lcmdlZFN0eWxlcztcbiAgfVxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IFJlbmRlcmVyO1xuIiwiaW1wb3J0IFJlbmRlcmVyIGZyb20gJy4vUmVuZGVyZXInO1xuXG5leHBvcnQgdmFyIENsYXNzQnJlYWtzUmVuZGVyZXIgPSBSZW5kZXJlci5leHRlbmQoe1xuICBpbml0aWFsaXplOiBmdW5jdGlvbiAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gICAgUmVuZGVyZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCByZW5kZXJlckpzb24sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2ZpZWxkID0gdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkO1xuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24ubm9ybWFsaXphdGlvblR5cGUgJiYgdGhpcy5fcmVuZGVyZXJKc29uLm5vcm1hbGl6YXRpb25UeXBlID09PSAnZXNyaU5vcm1hbGl6ZUJ5RmllbGQnKSB7XG4gICAgICB0aGlzLl9ub3JtYWxpemF0aW9uRmllbGQgPSB0aGlzLl9yZW5kZXJlckpzb24ubm9ybWFsaXphdGlvbkZpZWxkO1xuICAgIH1cbiAgICB0aGlzLl9jcmVhdGVTeW1ib2xzKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVN5bWJvbHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3ltYm9sO1xuICAgIHZhciBjbGFzc2JyZWFrcyA9IHRoaXMuX3JlbmRlcmVySnNvbi5jbGFzc0JyZWFrSW5mb3M7XG5cbiAgICB0aGlzLl9zeW1ib2xzID0gW107XG5cbiAgICAvLyBjcmVhdGUgYSBzeW1ib2wgZm9yIGVhY2ggY2xhc3MgYnJlYWtcbiAgICBmb3IgKHZhciBpID0gY2xhc3NicmVha3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMucHJvcG9ydGlvbmFsUG9seWdvbiAmJiB0aGlzLl9yZW5kZXJlckpzb24uYmFja2dyb3VuZEZpbGxTeW1ib2wpIHtcbiAgICAgICAgc3ltYm9sID0gdGhpcy5fbmV3U3ltYm9sKHRoaXMuX3JlbmRlcmVySnNvbi5iYWNrZ3JvdW5kRmlsbFN5bWJvbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzeW1ib2wgPSB0aGlzLl9uZXdTeW1ib2woY2xhc3NicmVha3NbaV0uc3ltYm9sKTtcbiAgICAgIH1cbiAgICAgIHN5bWJvbC52YWwgPSBjbGFzc2JyZWFrc1tpXS5jbGFzc01heFZhbHVlO1xuICAgICAgdGhpcy5fc3ltYm9scy5wdXNoKHN5bWJvbCk7XG4gICAgfVxuICAgIC8vIHNvcnQgdGhlIHN5bWJvbHMgaW4gYXNjZW5kaW5nIHZhbHVlXG4gICAgdGhpcy5fc3ltYm9scy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYS52YWwgPiBiLnZhbCA/IDEgOiAtMTtcbiAgICB9KTtcbiAgICB0aGlzLl9jcmVhdGVEZWZhdWx0U3ltYm9sKCk7XG4gICAgdGhpcy5fbWF4VmFsdWUgPSB0aGlzLl9zeW1ib2xzW3RoaXMuX3N5bWJvbHMubGVuZ3RoIC0gMV0udmFsO1xuICB9LFxuXG4gIF9nZXRTeW1ib2w6IGZ1bmN0aW9uIChmZWF0dXJlKSB7XG4gICAgdmFyIHZhbCA9IGZlYXR1cmUucHJvcGVydGllc1t0aGlzLl9maWVsZF07XG4gICAgaWYgKHRoaXMuX25vcm1hbGl6YXRpb25GaWVsZCkge1xuICAgICAgdmFyIG5vcm1WYWx1ZSA9IGZlYXR1cmUucHJvcGVydGllc1t0aGlzLl9ub3JtYWxpemF0aW9uRmllbGRdO1xuICAgICAgaWYgKCFpc05hTihub3JtVmFsdWUpICYmIG5vcm1WYWx1ZSAhPT0gMCkge1xuICAgICAgICB2YWwgPSB2YWwgLyBub3JtVmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmYXVsdFN5bWJvbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodmFsID4gdGhpcy5fbWF4VmFsdWUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9kZWZhdWx0U3ltYm9sO1xuICAgIH1cbiAgICB2YXIgc3ltYm9sID0gdGhpcy5fc3ltYm9sc1swXTtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fc3ltYm9scy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHZhbCA+IHRoaXMuX3N5bWJvbHNbaV0udmFsKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgc3ltYm9sID0gdGhpcy5fc3ltYm9sc1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHN5bWJvbDtcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc0JyZWFrc1JlbmRlcmVyIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBDbGFzc0JyZWFrc1JlbmRlcmVyKHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzQnJlYWtzUmVuZGVyZXI7XG4iLCJpbXBvcnQgUmVuZGVyZXIgZnJvbSAnLi9SZW5kZXJlcic7XG5cbmV4cG9ydCB2YXIgVW5pcXVlVmFsdWVSZW5kZXJlciA9IFJlbmRlcmVyLmV4dGVuZCh7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgICBSZW5kZXJlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fZmllbGQgPSB0aGlzLl9yZW5kZXJlckpzb24uZmllbGQxO1xuICAgIHRoaXMuX2NyZWF0ZVN5bWJvbHMoKTtcbiAgfSxcblxuICBfY3JlYXRlU3ltYm9sczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzeW1ib2w7XG4gICAgdmFyIHVuaXF1ZXMgPSB0aGlzLl9yZW5kZXJlckpzb24udW5pcXVlVmFsdWVJbmZvcztcblxuICAgIC8vIGNyZWF0ZSBhIHN5bWJvbCBmb3IgZWFjaCB1bmlxdWUgdmFsdWVcbiAgICBmb3IgKHZhciBpID0gdW5pcXVlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgc3ltYm9sID0gdGhpcy5fbmV3U3ltYm9sKHVuaXF1ZXNbaV0uc3ltYm9sKTtcbiAgICAgIHN5bWJvbC52YWwgPSB1bmlxdWVzW2ldLnZhbHVlO1xuICAgICAgdGhpcy5fc3ltYm9scy5wdXNoKHN5bWJvbCk7XG4gICAgfVxuICAgIHRoaXMuX2NyZWF0ZURlZmF1bHRTeW1ib2woKTtcbiAgfSxcblxuICBfZ2V0U3ltYm9sOiBmdW5jdGlvbiAoZmVhdHVyZSkge1xuICAgIHZhciB2YWwgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fZmllbGRdO1xuICAgIC8vIGFjY3VtdWxhdGUgdmFsdWVzIGlmIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgZmllbGQgZGVmaW5lZFxuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24uZmllbGREZWxpbWl0ZXIgJiYgdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkMikge1xuICAgICAgdmFyIHZhbDIgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkMl07XG4gICAgICBpZiAodmFsMikge1xuICAgICAgICB2YWwgKz0gdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkRGVsaW1pdGVyICsgdmFsMjtcbiAgICAgICAgdmFyIHZhbDMgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkM107XG4gICAgICAgIGlmICh2YWwzKSB7XG4gICAgICAgICAgdmFsICs9IHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZERlbGltaXRlciArIHZhbDM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgc3ltYm9sID0gdGhpcy5fZGVmYXVsdFN5bWJvbDtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fc3ltYm9scy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgLy8gdXNpbmcgdGhlID09PSBvcGVyYXRvciBkb2VzIG5vdCB3b3JrIGlmIHRoZSBmaWVsZFxuICAgICAgLy8gb2YgdGhlIHVuaXF1ZSByZW5kZXJlciBpcyBub3QgYSBzdHJpbmdcbiAgICAgIC8qZXNsaW50LWRpc2FibGUgKi9cbiAgICAgIGlmICh0aGlzLl9zeW1ib2xzW2ldLnZhbCA9PSB2YWwpIHtcbiAgICAgICAgc3ltYm9sID0gdGhpcy5fc3ltYm9sc1tpXTtcbiAgICAgIH1cbiAgICAgIC8qZXNsaW50LWVuYWJsZSAqL1xuICAgIH1cbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHVuaXF1ZVZhbHVlUmVuZGVyZXIgKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFVuaXF1ZVZhbHVlUmVuZGVyZXIocmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdW5pcXVlVmFsdWVSZW5kZXJlcjtcbiIsImltcG9ydCBSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVyJztcblxuZXhwb3J0IHZhciBTaW1wbGVSZW5kZXJlciA9IFJlbmRlcmVyLmV4dGVuZCh7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgICBSZW5kZXJlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fY3JlYXRlU3ltYm9sKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9yZW5kZXJlckpzb24uc3ltYm9sKSB7XG4gICAgICB0aGlzLl9zeW1ib2xzLnB1c2godGhpcy5fbmV3U3ltYm9sKHRoaXMuX3JlbmRlcmVySnNvbi5zeW1ib2wpKTtcbiAgICB9XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9zeW1ib2xzWzBdO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNpbXBsZVJlbmRlcmVyIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBTaW1wbGVSZW5kZXJlcihyZW5kZXJlckpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBzaW1wbGVSZW5kZXJlcjtcbiIsImltcG9ydCB7IGNsYXNzQnJlYWtzUmVuZGVyZXIgfSBmcm9tICdlc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9SZW5kZXJlcnMvQ2xhc3NCcmVha3NSZW5kZXJlcic7XHJcbmltcG9ydCB7IHVuaXF1ZVZhbHVlUmVuZGVyZXIgfSBmcm9tICdlc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9SZW5kZXJlcnMvVW5pcXVlVmFsdWVSZW5kZXJlcic7XHJcbmltcG9ydCB7IHNpbXBsZVJlbmRlcmVyIH0gZnJvbSAnZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1NpbXBsZVJlbmRlcmVyJztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzZXRSZW5kZXJlciAobGF5ZXJEZWZpbml0aW9uLCBsYXllcikge1xyXG4gIHZhciByZW5kO1xyXG4gIHZhciByZW5kZXJlckluZm8gPSBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXI7XHJcblxyXG4gIHZhciBvcHRpb25zID0ge307XHJcblxyXG4gIGlmIChsYXllci5vcHRpb25zLnBhbmUpIHtcclxuICAgIG9wdGlvbnMucGFuZSA9IGxheWVyLm9wdGlvbnMucGFuZTtcclxuICB9XHJcbiAgaWYgKGxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby50cmFuc3BhcmVuY3kpIHtcclxuICAgIG9wdGlvbnMubGF5ZXJUcmFuc3BhcmVuY3kgPSBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8udHJhbnNwYXJlbmN5O1xyXG4gIH1cclxuICBpZiAobGF5ZXIub3B0aW9ucy5zdHlsZSkge1xyXG4gICAgb3B0aW9ucy51c2VyRGVmaW5lZFN0eWxlID0gbGF5ZXIub3B0aW9ucy5zdHlsZTtcclxuICB9XHJcblxyXG4gIHN3aXRjaCAocmVuZGVyZXJJbmZvLnR5cGUpIHtcclxuICAgIGNhc2UgJ2NsYXNzQnJlYWtzJzpcclxuICAgICAgY2hlY2tGb3JQcm9wb3J0aW9uYWxTeW1ib2xzKGxheWVyRGVmaW5pdGlvbi5nZW9tZXRyeVR5cGUsIHJlbmRlcmVySW5mbywgbGF5ZXIpO1xyXG4gICAgICBpZiAobGF5ZXIuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMpIHtcclxuICAgICAgICBsYXllci5fY3JlYXRlUG9pbnRMYXllcigpO1xyXG4gICAgICAgIHZhciBwUmVuZCA9IGNsYXNzQnJlYWtzUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgICBwUmVuZC5hdHRhY2hTdHlsZXNUb0xheWVyKGxheWVyLl9wb2ludExheWVyKTtcclxuICAgICAgICBvcHRpb25zLnByb3BvcnRpb25hbFBvbHlnb24gPSB0cnVlO1xyXG4gICAgICB9XHJcbiAgICAgIHJlbmQgPSBjbGFzc0JyZWFrc1JlbmRlcmVyKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAndW5pcXVlVmFsdWUnOlxyXG4gICAgICBjb25zb2xlLmxvZyhyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gICAgICByZW5kID0gdW5pcXVlVmFsdWVSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gICAgICBicmVhaztcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJlbmQgPSBzaW1wbGVSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gIH1cclxuICByZW5kLmF0dGFjaFN0eWxlc1RvTGF5ZXIobGF5ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tGb3JQcm9wb3J0aW9uYWxTeW1ib2xzIChnZW9tZXRyeVR5cGUsIHJlbmRlcmVyLCBsYXllcikge1xyXG4gIGxheWVyLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzID0gZmFsc2U7XHJcbiAgaWYgKGdlb21ldHJ5VHlwZSA9PT0gJ2VzcmlHZW9tZXRyeVBvbHlnb24nKSB7XHJcbiAgICBpZiAocmVuZGVyZXIuYmFja2dyb3VuZEZpbGxTeW1ib2wpIHtcclxuICAgICAgbGF5ZXIuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgLy8gY2hlY2sgdG8gc2VlIGlmIHRoZSBmaXJzdCBzeW1ib2wgaW4gdGhlIGNsYXNzYnJlYWtzIGlzIGEgbWFya2VyIHN5bWJvbFxyXG4gICAgaWYgKHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvcyAmJiByZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MubGVuZ3RoKSB7XHJcbiAgICAgIHZhciBzeW0gPSByZW5kZXJlci5jbGFzc0JyZWFrSW5mb3NbMF0uc3ltYm9sO1xyXG4gICAgICBpZiAoc3ltICYmIChzeW0udHlwZSA9PT0gJ2VzcmlTTVMnIHx8IHN5bS50eXBlID09PSAnZXNyaVBNUycpKSB7XHJcbiAgICAgICAgbGF5ZXIuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSB0cnVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIFJlbmRlcmVyID0ge1xyXG4gIHNldFJlbmRlcmVyOiBzZXRSZW5kZXJlcixcclxuICBjaGVja0ZvclByb3BvcnRpb25hbFN5bWJvbHM6IGNoZWNrRm9yUHJvcG9ydGlvbmFsU3ltYm9sc1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUmVuZGVyZXI7XHJcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5cclxuaW1wb3J0IHsgYXJjZ2lzVG9HZW9KU09OIH0gZnJvbSAnYXJjZ2lzLXRvLWdlb2pzb24tdXRpbHMnO1xyXG5pbXBvcnQgeyBzZXRSZW5kZXJlciB9IGZyb20gJy4vUmVuZGVyZXInO1xyXG5cclxuZXhwb3J0IHZhciBGZWF0dXJlQ29sbGVjdGlvbiA9IEwuR2VvSlNPTi5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIGRhdGE6IHt9LCAvLyBFc3JpIEZlYXR1cmUgQ29sbGVjdGlvbiBKU09OIG9yIEl0ZW0gSURcclxuICAgIG9wYWNpdHk6IDFcclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF5ZXJzLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5kYXRhID0gdGhpcy5vcHRpb25zLmRhdGE7XHJcbiAgICB0aGlzLm9wYWNpdHkgPSB0aGlzLm9wdGlvbnMub3BhY2l0eTtcclxuICAgIHRoaXMucG9wdXBJbmZvID0gbnVsbDtcclxuICAgIHRoaXMubGFiZWxpbmdJbmZvID0gbnVsbDtcclxuICAgIHRoaXMuX2xheWVycyA9IHt9O1xyXG5cclxuICAgIHZhciBpLCBsZW47XHJcblxyXG4gICAgaWYgKGxheWVycykge1xyXG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSBsYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICB0aGlzLmFkZExheWVyKGxheWVyc1tpXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIHRoaXMuZGF0YSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgdGhpcy5fZ2V0RmVhdHVyZUNvbGxlY3Rpb24odGhpcy5kYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX3BhcnNlRmVhdHVyZUNvbGxlY3Rpb24odGhpcy5kYXRhKTtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBfZ2V0RmVhdHVyZUNvbGxlY3Rpb246IGZ1bmN0aW9uIChpdGVtSWQpIHtcclxuICAgIHZhciB1cmwgPSAnaHR0cHM6Ly93d3cuYXJjZ2lzLmNvbS9zaGFyaW5nL3Jlc3QvY29udGVudC9pdGVtcy8nICsgaXRlbUlkICsgJy9kYXRhJztcclxuICAgIEwuZXNyaS5yZXF1ZXN0KHVybCwge30sIGZ1bmN0aW9uIChlcnIsIHJlcykge1xyXG4gICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZXJyKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLl9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uKHJlcyk7XHJcbiAgICAgIH1cclxuICAgIH0sIHRoaXMpO1xyXG4gIH0sXHJcblxyXG4gIF9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgdmFyIGksIGxlbjtcclxuICAgIHZhciBpbmRleCA9IDA7XHJcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBkYXRhLmxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICBpZiAoZGF0YS5sYXllcnNbaV0uZmVhdHVyZVNldC5mZWF0dXJlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgaW5kZXggPSBpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICB2YXIgZmVhdHVyZXMgPSBkYXRhLmxheWVyc1tpbmRleF0uZmVhdHVyZVNldC5mZWF0dXJlcztcclxuICAgIHZhciBnZW9tZXRyeVR5cGUgPSBkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uLmdlb21ldHJ5VHlwZTsgLy8gJ2VzcmlHZW9tZXRyeVBvaW50JyB8ICdlc3JpR2VvbWV0cnlNdWx0aXBvaW50JyB8ICdlc3JpR2VvbWV0cnlQb2x5bGluZScgfCAnZXNyaUdlb21ldHJ5UG9seWdvbicgfCAnZXNyaUdlb21ldHJ5RW52ZWxvcGUnXHJcbiAgICB2YXIgb2JqZWN0SWRGaWVsZCA9IGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24ub2JqZWN0SWRGaWVsZDtcclxuICAgIHZhciBsYXllckRlZmluaXRpb24gPSBkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uIHx8IG51bGw7XHJcblxyXG4gICAgaWYgKGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24uZXh0ZW50LnNwYXRpYWxSZWZlcmVuY2Uud2tpZCAhPT0gNDMyNikge1xyXG4gICAgICBpZiAoZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbi5leHRlbnQuc3BhdGlhbFJlZmVyZW5jZS53a2lkICE9PSAxMDIxMDApIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbTC5lc3JpLldlYk1hcF0gdGhpcyB3a2lkICgnICsgZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbi5leHRlbnQuc3BhdGlhbFJlZmVyZW5jZS53a2lkICsgJykgaXMgbm90IHN1cHBvcnRlZC4nKTtcclxuICAgICAgfVxyXG4gICAgICBmZWF0dXJlcyA9IHRoaXMuX3Byb2pUbzQzMjYoZmVhdHVyZXMsIGdlb21ldHJ5VHlwZSk7XHJcbiAgICB9XHJcbiAgICBpZiAoZGF0YS5sYXllcnNbaW5kZXhdLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucG9wdXBJbmZvID0gZGF0YS5sYXllcnNbaW5kZXhdLnBvcHVwSW5mbztcclxuICAgIH1cclxuICAgIGlmIChkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMubGFiZWxpbmdJbmZvID0gZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm87XHJcbiAgICB9XHJcbiAgICBjb25zb2xlLmxvZyhkYXRhKTtcclxuXHJcbiAgICB2YXIgZ2VvanNvbiA9IHRoaXMuX2ZlYXR1cmVDb2xsZWN0aW9uVG9HZW9KU09OKGZlYXR1cmVzLCBvYmplY3RJZEZpZWxkKTtcclxuXHJcbiAgICBpZiAobGF5ZXJEZWZpbml0aW9uICE9PSBudWxsKSB7XHJcbiAgICAgIHNldFJlbmRlcmVyKGxheWVyRGVmaW5pdGlvbiwgdGhpcyk7XHJcbiAgICB9XHJcbiAgICBjb25zb2xlLmxvZyhnZW9qc29uKTtcclxuICAgIHRoaXMuYWRkRGF0YShnZW9qc29uKTtcclxuICB9LFxyXG5cclxuICBfcHJvalRvNDMyNjogZnVuY3Rpb24gKGZlYXR1cmVzLCBnZW9tZXRyeVR5cGUpIHtcclxuICAgIGNvbnNvbGUubG9nKCdfcHJvamVjdCEnKTtcclxuICAgIHZhciBpLCBsZW47XHJcbiAgICB2YXIgcHJvakZlYXR1cmVzID0gW107XHJcblxyXG4gICAgZm9yIChpID0gMCwgbGVuID0gZmVhdHVyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgdmFyIGYgPSBmZWF0dXJlc1tpXTtcclxuICAgICAgdmFyIG1lcmNhdG9yVG9MYXRsbmc7XHJcbiAgICAgIHZhciBqLCBrO1xyXG5cclxuICAgICAgaWYgKGdlb21ldHJ5VHlwZSA9PT0gJ2VzcmlHZW9tZXRyeVBvaW50Jykge1xyXG4gICAgICAgIG1lcmNhdG9yVG9MYXRsbmcgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoZi5nZW9tZXRyeS54LCBmLmdlb21ldHJ5LnkpKTtcclxuICAgICAgICBmLmdlb21ldHJ5LnggPSBtZXJjYXRvclRvTGF0bG5nLmxuZztcclxuICAgICAgICBmLmdlb21ldHJ5LnkgPSBtZXJjYXRvclRvTGF0bG5nLmxhdDtcclxuICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlNdWx0aXBvaW50Jykge1xyXG4gICAgICAgIHZhciBwbGVuO1xyXG5cclxuICAgICAgICBmb3IgKGogPSAwLCBwbGVuID0gZi5nZW9tZXRyeS5wb2ludHMubGVuZ3RoOyBqIDwgcGxlbjsgaisrKSB7XHJcbiAgICAgICAgICBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGYuZ2VvbWV0cnkucG9pbnRzW2pdWzBdLCBmLmdlb21ldHJ5LnBvaW50c1tqXVsxXSkpO1xyXG4gICAgICAgICAgZi5nZW9tZXRyeS5wb2ludHNbal1bMF0gPSBtZXJjYXRvclRvTGF0bG5nLmxuZztcclxuICAgICAgICAgIGYuZ2VvbWV0cnkucG9pbnRzW2pdWzFdID0gbWVyY2F0b3JUb0xhdGxuZy5sYXQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKGdlb21ldHJ5VHlwZSA9PT0gJ2VzcmlHZW9tZXRyeVBvbHlsaW5lJykge1xyXG4gICAgICAgIHZhciBwYXRobGVuLCBwYXRoc2xlbjtcclxuXHJcbiAgICAgICAgZm9yIChqID0gMCwgcGF0aHNsZW4gPSBmLmdlb21ldHJ5LnBhdGhzLmxlbmd0aDsgaiA8IHBhdGhzbGVuOyBqKyspIHtcclxuICAgICAgICAgIGZvciAoayA9IDAsIHBhdGhsZW4gPSBmLmdlb21ldHJ5LnBhdGhzW2pdLmxlbmd0aDsgayA8IHBhdGhsZW47IGsrKykge1xyXG4gICAgICAgICAgICBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGYuZ2VvbWV0cnkucGF0aHNbal1ba11bMF0sIGYuZ2VvbWV0cnkucGF0aHNbal1ba11bMV0pKTtcclxuICAgICAgICAgICAgZi5nZW9tZXRyeS5wYXRoc1tqXVtrXVswXSA9IG1lcmNhdG9yVG9MYXRsbmcubG5nO1xyXG4gICAgICAgICAgICBmLmdlb21ldHJ5LnBhdGhzW2pdW2tdWzFdID0gbWVyY2F0b3JUb0xhdGxuZy5sYXQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKGdlb21ldHJ5VHlwZSA9PT0gJ2VzcmlHZW9tZXRyeVBvbHlnb24nKSB7XHJcbiAgICAgICAgdmFyIHJpbmdsZW4sIHJpbmdzbGVuO1xyXG5cclxuICAgICAgICBmb3IgKGogPSAwLCByaW5nc2xlbiA9IGYuZ2VvbWV0cnkucmluZ3MubGVuZ3RoOyBqIDwgcmluZ3NsZW47IGorKykge1xyXG4gICAgICAgICAgZm9yIChrID0gMCwgcmluZ2xlbiA9IGYuZ2VvbWV0cnkucmluZ3Nbal0ubGVuZ3RoOyBrIDwgcmluZ2xlbjsgaysrKSB7XHJcbiAgICAgICAgICAgIG1lcmNhdG9yVG9MYXRsbmcgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoZi5nZW9tZXRyeS5yaW5nc1tqXVtrXVswXSwgZi5nZW9tZXRyeS5yaW5nc1tqXVtrXVsxXSkpO1xyXG4gICAgICAgICAgICBmLmdlb21ldHJ5LnJpbmdzW2pdW2tdWzBdID0gbWVyY2F0b3JUb0xhdGxuZy5sbmc7XHJcbiAgICAgICAgICAgIGYuZ2VvbWV0cnkucmluZ3Nbal1ba11bMV0gPSBtZXJjYXRvclRvTGF0bG5nLmxhdDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcHJvakZlYXR1cmVzLnB1c2goZik7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHByb2pGZWF0dXJlcztcclxuICB9LFxyXG5cclxuICBfZmVhdHVyZUNvbGxlY3Rpb25Ub0dlb0pTT046IGZ1bmN0aW9uIChmZWF0dXJlcywgb2JqZWN0SWRGaWVsZCkge1xyXG4gICAgdmFyIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbiA9IHtcclxuICAgICAgdHlwZTogJ0ZlYXR1cmVDb2xsZWN0aW9uJyxcclxuICAgICAgZmVhdHVyZXM6IFtdXHJcbiAgICB9O1xyXG4gICAgdmFyIGZlYXR1cmVzQXJyYXkgPSBbXTtcclxuICAgIHZhciBpLCBsZW47XHJcblxyXG4gICAgZm9yIChpID0gMCwgbGVuID0gZmVhdHVyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgdmFyIGdlb2pzb24gPSBhcmNnaXNUb0dlb0pTT04oZmVhdHVyZXNbaV0sIG9iamVjdElkRmllbGQpO1xyXG4gICAgICBmZWF0dXJlc0FycmF5LnB1c2goZ2VvanNvbik7XHJcbiAgICB9XHJcblxyXG4gICAgZ2VvanNvbkZlYXR1cmVDb2xsZWN0aW9uLmZlYXR1cmVzID0gZmVhdHVyZXNBcnJheTtcclxuXHJcbiAgICByZXR1cm4gZ2VvanNvbkZlYXR1cmVDb2xsZWN0aW9uO1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZmVhdHVyZUNvbGxlY3Rpb24gKGdlb2pzb24sIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IEZlYXR1cmVDb2xsZWN0aW9uKGdlb2pzb24sIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmZWF0dXJlQ29sbGVjdGlvbjtcclxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcblxyXG5pbXBvcnQgb21uaXZvcmUgZnJvbSAnbGVhZmxldC1vbW5pdm9yZSc7XHJcbmltcG9ydCB7IHNldFJlbmRlcmVyIH0gZnJvbSAnLi9SZW5kZXJlcic7XHJcblxyXG5leHBvcnQgdmFyIENTVkxheWVyID0gTC5HZW9KU09OLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgdXJsOiAnJyxcclxuICAgIGRhdGE6IHt9LCAvLyBFc3JpIEZlYXR1cmUgQ29sbGVjdGlvbiBKU09OIG9yIEl0ZW0gSURcclxuICAgIG9wYWNpdHk6IDFcclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF5ZXJzLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy51cmwgPSB0aGlzLm9wdGlvbnMudXJsO1xyXG4gICAgdGhpcy5sYXllckRlZmluaXRpb24gPSB0aGlzLm9wdGlvbnMubGF5ZXJEZWZpbml0aW9uO1xyXG4gICAgdGhpcy5sb2NhdGlvbkluZm8gPSB0aGlzLm9wdGlvbnMubG9jYXRpb25JbmZvO1xyXG4gICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5vcHRpb25zLm9wYWNpdHk7XHJcbiAgICB0aGlzLl9sYXllcnMgPSB7fTtcclxuXHJcbiAgICB2YXIgaSwgbGVuO1xyXG5cclxuICAgIGlmIChsYXllcnMpIHtcclxuICAgICAgZm9yIChpID0gMCwgbGVuID0gbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5hZGRMYXllcihsYXllcnNbaV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fcGFyc2VDU1YodGhpcy51cmwsIHRoaXMubGF5ZXJEZWZpbml0aW9uLCB0aGlzLmxvY2F0aW9uSW5mbyk7XHJcbiAgfSxcclxuXHJcbiAgX3BhcnNlQ1NWOiBmdW5jdGlvbiAodXJsLCBsYXllckRlZmluaXRpb24sIGxvY2F0aW9uSW5mbykge1xyXG4gICAgb21uaXZvcmUuY3N2KHVybCwge1xyXG4gICAgICBsYXRmaWVsZDogbG9jYXRpb25JbmZvLmxhdGl0dWRlRmllbGROYW1lLFxyXG4gICAgICBsb25maWVsZDogbG9jYXRpb25JbmZvLmxvbmdpdHVkZUZpZWxkTmFtZVxyXG4gICAgfSwgdGhpcyk7XHJcblxyXG4gICAgc2V0UmVuZGVyZXIobGF5ZXJEZWZpbml0aW9uLCB0aGlzKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNzdkxheWVyIChnZW9qc29uLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBDU1ZMYXllcihnZW9qc29uLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQ1NWTGF5ZXI7XHJcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5cclxuaW1wb3J0IHsgYXJjZ2lzVG9HZW9KU09OIH0gZnJvbSAnYXJjZ2lzLXRvLWdlb2pzb24tdXRpbHMnO1xyXG5pbXBvcnQgeyBzZXRSZW5kZXJlciB9IGZyb20gJy4vUmVuZGVyZXInO1xyXG5cclxuZXhwb3J0IHZhciBLTUxMYXllciA9IEwuR2VvSlNPTi5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIG9wYWNpdHk6IDEsXHJcbiAgICB1cmw6ICcnXHJcbiAgfSxcclxuXHJcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxheWVycywgb3B0aW9ucykge1xyXG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMudXJsID0gdGhpcy5vcHRpb25zLnVybDtcclxuICAgIHRoaXMub3BhY2l0eSA9IHRoaXMub3B0aW9ucy5vcGFjaXR5O1xyXG4gICAgdGhpcy5wb3B1cEluZm8gPSBudWxsO1xyXG4gICAgdGhpcy5sYWJlbGluZ0luZm8gPSBudWxsO1xyXG4gICAgdGhpcy5fbGF5ZXJzID0ge307XHJcblxyXG4gICAgdmFyIGksIGxlbjtcclxuXHJcbiAgICBpZiAobGF5ZXJzKSB7XHJcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIHRoaXMuYWRkTGF5ZXIobGF5ZXJzW2ldKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2dldEtNTCh0aGlzLnVybCk7XHJcbiAgfSxcclxuXHJcbiAgX2dldEtNTDogZnVuY3Rpb24gKHVybCkge1xyXG4gICAgdmFyIHJlcXVlc3RVcmwgPSAnaHR0cDovL3V0aWxpdHkuYXJjZ2lzLmNvbS9zaGFyaW5nL2ttbD91cmw9JyArIHVybCArICcmbW9kZWw9c2ltcGxlJmZvbGRlcnM9Jm91dFNSPSU3Qlwid2tpZFwiJTNBNDMyNiU3RCc7XHJcbiAgICBMLmVzcmkucmVxdWVzdChyZXF1ZXN0VXJsLCB7fSwgZnVuY3Rpb24gKGVyciwgcmVzKSB7XHJcbiAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHJlcyk7XHJcbiAgICAgICAgdGhpcy5fcGFyc2VGZWF0dXJlQ29sbGVjdGlvbihyZXMuZmVhdHVyZUNvbGxlY3Rpb24pO1xyXG4gICAgICB9XHJcbiAgICB9LCB0aGlzKTtcclxuICB9LFxyXG5cclxuICBfcGFyc2VGZWF0dXJlQ29sbGVjdGlvbjogZnVuY3Rpb24gKGZlYXR1cmVDb2xsZWN0aW9uKSB7XHJcbiAgICBjb25zb2xlLmxvZygnX3BhcnNlRmVhdHVyZUNvbGxlY3Rpb24nKTtcclxuICAgIHZhciBpO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xyXG4gICAgICBpZiAoZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmZlYXR1cmVTZXQuZmVhdHVyZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGkpO1xyXG4gICAgICAgIHZhciBmZWF0dXJlcyA9IGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5mZWF0dXJlU2V0LmZlYXR1cmVzO1xyXG4gICAgICAgIHZhciBvYmplY3RJZEZpZWxkID0gZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmxheWVyRGVmaW5pdGlvbi5vYmplY3RJZEZpZWxkO1xyXG5cclxuICAgICAgICB2YXIgZ2VvanNvbiA9IHRoaXMuX2ZlYXR1cmVDb2xsZWN0aW9uVG9HZW9KU09OKGZlYXR1cmVzLCBvYmplY3RJZEZpZWxkKTtcclxuXHJcbiAgICAgICAgaWYgKGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgdGhpcy5wb3B1cEluZm8gPSBmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ucG9wdXBJbmZvO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgdGhpcy5sYWJlbGluZ0luZm8gPSBmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHNldFJlbmRlcmVyKGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5sYXllckRlZmluaXRpb24sIHRoaXMpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGdlb2pzb24pO1xyXG4gICAgICAgIHRoaXMuYWRkRGF0YShnZW9qc29uKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIF9mZWF0dXJlQ29sbGVjdGlvblRvR2VvSlNPTjogZnVuY3Rpb24gKGZlYXR1cmVzLCBvYmplY3RJZEZpZWxkKSB7XHJcbiAgICB2YXIgZ2VvanNvbkZlYXR1cmVDb2xsZWN0aW9uID0ge1xyXG4gICAgICB0eXBlOiAnRmVhdHVyZUNvbGxlY3Rpb24nLFxyXG4gICAgICBmZWF0dXJlczogW11cclxuICAgIH07XHJcbiAgICB2YXIgZmVhdHVyZXNBcnJheSA9IFtdO1xyXG4gICAgdmFyIGksIGxlbjtcclxuXHJcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICB2YXIgZ2VvanNvbiA9IGFyY2dpc1RvR2VvSlNPTihmZWF0dXJlc1tpXSwgb2JqZWN0SWRGaWVsZCk7XHJcbiAgICAgIGZlYXR1cmVzQXJyYXkucHVzaChnZW9qc29uKTtcclxuICAgIH1cclxuXHJcbiAgICBnZW9qc29uRmVhdHVyZUNvbGxlY3Rpb24uZmVhdHVyZXMgPSBmZWF0dXJlc0FycmF5O1xyXG5cclxuICAgIHJldHVybiBnZW9qc29uRmVhdHVyZUNvbGxlY3Rpb247XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBrbWxMYXllciAoZ2VvanNvbiwgb3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgS01MTGF5ZXIoZ2VvanNvbiwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IEtNTExheWVyO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuXHJcbmV4cG9ydCB2YXIgTGFiZWxJY29uID0gTC5EaXZJY29uLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgaWNvblNpemU6IG51bGwsXHJcbiAgICBjbGFzc05hbWU6ICdlc3JpLWxlYWZsZXQtd2VibWFwLWxhYmVscycsXHJcbiAgICB0ZXh0OiAnJ1xyXG4gIH0sXHJcblxyXG4gIGNyZWF0ZUljb246IGZ1bmN0aW9uIChvbGRJY29uKSB7XHJcbiAgICB2YXIgZGl2ID0gKG9sZEljb24gJiYgb2xkSWNvbi50YWdOYW1lID09PSAnRElWJykgPyBvbGRJY29uIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcclxuXHJcbiAgICBkaXYuaW5uZXJIVE1MID0gJzxkaXYgc3R5bGU9XCJwb3NpdGlvbjogcmVsYXRpdmU7IGxlZnQ6IC01MCU7IHRleHQtc2hhZG93OiAxcHggMXB4IDBweCAjZmZmLCAtMXB4IDFweCAwcHggI2ZmZiwgMXB4IC0xcHggMHB4ICNmZmYsIC0xcHggLTFweCAwcHggI2ZmZjtcIj4nICsgb3B0aW9ucy50ZXh0ICsgJzwvZGl2Pic7XHJcblxyXG4gICAgLy8gbGFiZWwuY3NzXHJcbiAgICBkaXYuc3R5bGUuZm9udFNpemUgPSAnMWVtJztcclxuICAgIGRpdi5zdHlsZS5mb250V2VpZ2h0ID0gJ2JvbGQnO1xyXG4gICAgZGl2LnN0eWxlLnRleHRUcmFuc2Zvcm0gPSAndXBwZXJjYXNlJztcclxuICAgIGRpdi5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcclxuICAgIGRpdi5zdHlsZS53aGl0ZVNwYWNlID0gJ25vd3JhcCc7XHJcblxyXG4gICAgaWYgKG9wdGlvbnMuYmdQb3MpIHtcclxuICAgICAgdmFyIGJnUG9zID0gTC5wb2ludChvcHRpb25zLmJnUG9zKTtcclxuICAgICAgZGl2LnN0eWxlLmJhY2tncm91bmRQb3NpdGlvbiA9ICgtYmdQb3MueCkgKyAncHggJyArICgtYmdQb3MueSkgKyAncHgnO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fc2V0SWNvblN0eWxlcyhkaXYsICdpY29uJyk7XHJcblxyXG4gICAgcmV0dXJuIGRpdjtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGxhYmVsSWNvbiAob3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgTGFiZWxJY29uKG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBsYWJlbEljb247XHJcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5pbXBvcnQgeyBsYWJlbEljb24gfSBmcm9tICcuL0xhYmVsSWNvbic7XHJcblxyXG5leHBvcnQgdmFyIExhYmVsTWFya2VyID0gTC5NYXJrZXIuZXh0ZW5kKHtcclxuICBvcHRpb25zOiB7XHJcbiAgICBwcm9wZXJ0aWVzOiB7fSxcclxuICAgIGxhYmVsaW5nSW5mbzoge30sXHJcbiAgICBvZmZzZXQ6IFswLCAwXVxyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIG9wdGlvbnMpIHtcclxuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuICAgIHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XHJcblxyXG4gICAgdmFyIGxhYmVsVGV4dCA9IHRoaXMuX2NyZWF0ZUxhYmVsVGV4dCh0aGlzLm9wdGlvbnMucHJvcGVydGllcywgdGhpcy5vcHRpb25zLmxhYmVsaW5nSW5mbyk7XHJcbiAgICB0aGlzLl9zZXRMYWJlbEljb24obGFiZWxUZXh0LCB0aGlzLm9wdGlvbnMub2Zmc2V0KTtcclxuICB9LFxyXG5cclxuICBfY3JlYXRlTGFiZWxUZXh0OiBmdW5jdGlvbiAocHJvcGVydGllcywgbGFiZWxpbmdJbmZvKSB7XHJcbiAgICB2YXIgciA9IC9cXFsoW15cXF1dKilcXF0vZztcclxuICAgIHZhciBsYWJlbFRleHQgPSBsYWJlbGluZ0luZm9bMF0ubGFiZWxFeHByZXNzaW9uO1xyXG5cclxuICAgIGxhYmVsVGV4dCA9IGxhYmVsVGV4dC5yZXBsYWNlKHIsIGZ1bmN0aW9uIChzKSB7XHJcbiAgICAgIHZhciBtID0gci5leGVjKHMpO1xyXG4gICAgICByZXR1cm4gcHJvcGVydGllc1ttWzFdXTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBsYWJlbFRleHQ7XHJcbiAgfSxcclxuXHJcbiAgX3NldExhYmVsSWNvbjogZnVuY3Rpb24gKHRleHQsIG9mZnNldCkge1xyXG4gICAgdmFyIGljb24gPSBsYWJlbEljb24oe1xyXG4gICAgICB0ZXh0OiB0ZXh0LFxyXG4gICAgICBpY29uQW5jaG9yOiBvZmZzZXRcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2V0SWNvbihpY29uKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGxhYmVsTWFya2VyIChsYXRsbmcsIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IExhYmVsTWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGxhYmVsTWFya2VyO1xyXG4iLCJleHBvcnQgZnVuY3Rpb24gcG9pbnRMYWJlbFBvcyAoY29vcmRpbmF0ZXMpIHtcclxuICB2YXIgbGFiZWxQb3MgPSB7IHBvc2l0aW9uOiBbXSwgb2Zmc2V0OiBbXSB9O1xyXG5cclxuICBsYWJlbFBvcy5wb3NpdGlvbiA9IGNvb3JkaW5hdGVzLnJldmVyc2UoKTtcclxuICBsYWJlbFBvcy5vZmZzZXQgPSBbMjAsIDIwXTtcclxuXHJcbiAgcmV0dXJuIGxhYmVsUG9zO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIFBvaW50TGFiZWwgPSB7XHJcbiAgcG9pbnRMYWJlbFBvczogcG9pbnRMYWJlbFBvc1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUG9pbnRMYWJlbDtcclxuIiwiZXhwb3J0IGZ1bmN0aW9uIHBvbHlsaW5lTGFiZWxQb3MgKGNvb3JkaW5hdGVzKSB7XHJcbiAgdmFyIGxhYmVsUG9zID0geyBwb3NpdGlvbjogW10sIG9mZnNldDogW10gfTtcclxuICB2YXIgY2VudHJhbEtleTtcclxuXHJcbiAgY2VudHJhbEtleSA9IE1hdGgucm91bmQoY29vcmRpbmF0ZXMubGVuZ3RoIC8gMik7XHJcbiAgbGFiZWxQb3MucG9zaXRpb24gPSBjb29yZGluYXRlc1tjZW50cmFsS2V5XS5yZXZlcnNlKCk7XHJcbiAgbGFiZWxQb3Mub2Zmc2V0ID0gWzAsIDBdO1xyXG5cclxuICByZXR1cm4gbGFiZWxQb3M7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgUG9seWxpbmVMYWJlbCA9IHtcclxuICBwb2x5bGluZUxhYmVsUG9zOiBwb2x5bGluZUxhYmVsUG9zXHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBQb2x5bGluZUxhYmVsO1xyXG4iLCJleHBvcnQgZnVuY3Rpb24gcG9seWdvbkxhYmVsUG9zIChsYXllciwgY29vcmRpbmF0ZXMpIHtcclxuICB2YXIgbGFiZWxQb3MgPSB7IHBvc2l0aW9uOiBbXSwgb2Zmc2V0OiBbXSB9O1xyXG5cclxuICBsYWJlbFBvcy5wb3NpdGlvbiA9IGxheWVyLmdldEJvdW5kcygpLmdldENlbnRlcigpO1xyXG4gIGxhYmVsUG9zLm9mZnNldCA9IFswLCAwXTtcclxuXHJcbiAgcmV0dXJuIGxhYmVsUG9zO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIFBvbHlnb25MYWJlbCA9IHtcclxuICBwb2x5Z29uTGFiZWxQb3M6IHBvbHlnb25MYWJlbFBvc1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUG9seWdvbkxhYmVsO1xyXG4iLCJ2YXIgZ2V0RGF5T2ZZZWFyID0gcmVxdWlyZSgnLi4vZ2V0X2RheV9vZl95ZWFyL2luZGV4LmpzJylcbnZhciBnZXRJU09XZWVrID0gcmVxdWlyZSgnLi4vZ2V0X2lzb193ZWVrL2luZGV4LmpzJylcbnZhciBnZXRJU09ZZWFyID0gcmVxdWlyZSgnLi4vZ2V0X2lzb195ZWFyL2luZGV4LmpzJylcbnZhciBwYXJzZSA9IHJlcXVpcmUoJy4uL3BhcnNlL2luZGV4LmpzJylcbnZhciBpc1ZhbGlkID0gcmVxdWlyZSgnLi4vaXNfdmFsaWQvaW5kZXguanMnKVxudmFyIGVuTG9jYWxlID0gcmVxdWlyZSgnLi4vbG9jYWxlL2VuL2luZGV4LmpzJylcblxuLyoqXG4gKiBAY2F0ZWdvcnkgQ29tbW9uIEhlbHBlcnNcbiAqIEBzdW1tYXJ5IEZvcm1hdCB0aGUgZGF0ZS5cbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIFJldHVybiB0aGUgZm9ybWF0dGVkIGRhdGUgc3RyaW5nIGluIHRoZSBnaXZlbiBmb3JtYXQuXG4gKlxuICogQWNjZXB0ZWQgdG9rZW5zOlxuICogfCBVbml0ICAgICAgICAgICAgICAgICAgICB8IFRva2VuIHwgUmVzdWx0IGV4YW1wbGVzICAgICAgICAgICAgICAgICAgfFxuICogfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18LS0tLS0tLXwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICogfCBNb250aCAgICAgICAgICAgICAgICAgICB8IE0gICAgIHwgMSwgMiwgLi4uLCAxMiAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IE1vICAgIHwgMXN0LCAybmQsIC4uLiwgMTJ0aCAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IE1NICAgIHwgMDEsIDAyLCAuLi4sIDEyICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IE1NTSAgIHwgSmFuLCBGZWIsIC4uLiwgRGVjICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IE1NTU0gIHwgSmFudWFyeSwgRmVicnVhcnksIC4uLiwgRGVjZW1iZXIgfFxuICogfCBRdWFydGVyICAgICAgICAgICAgICAgICB8IFEgICAgIHwgMSwgMiwgMywgNCAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IFFvICAgIHwgMXN0LCAybmQsIDNyZCwgNHRoICAgICAgICAgICAgICAgfFxuICogfCBEYXkgb2YgbW9udGggICAgICAgICAgICB8IEQgICAgIHwgMSwgMiwgLi4uLCAzMSAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IERvICAgIHwgMXN0LCAybmQsIC4uLiwgMzFzdCAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IEREICAgIHwgMDEsIDAyLCAuLi4sIDMxICAgICAgICAgICAgICAgICAgfFxuICogfCBEYXkgb2YgeWVhciAgICAgICAgICAgICB8IERERCAgIHwgMSwgMiwgLi4uLCAzNjYgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IERERG8gIHwgMXN0LCAybmQsIC4uLiwgMzY2dGggICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IEREREQgIHwgMDAxLCAwMDIsIC4uLiwgMzY2ICAgICAgICAgICAgICAgfFxuICogfCBEYXkgb2Ygd2VlayAgICAgICAgICAgICB8IGQgICAgIHwgMCwgMSwgLi4uLCA2ICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGRvICAgIHwgMHRoLCAxc3QsIC4uLiwgNnRoICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGRkICAgIHwgU3UsIE1vLCAuLi4sIFNhICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGRkZCAgIHwgU3VuLCBNb24sIC4uLiwgU2F0ICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGRkZGQgIHwgU3VuZGF5LCBNb25kYXksIC4uLiwgU2F0dXJkYXkgICAgfFxuICogfCBEYXkgb2YgSVNPIHdlZWsgICAgICAgICB8IEUgICAgIHwgMSwgMiwgLi4uLCA3ICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBJU08gd2VlayAgICAgICAgICAgICAgICB8IFcgICAgIHwgMSwgMiwgLi4uLCA1MyAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IFdvICAgIHwgMXN0LCAybmQsIC4uLiwgNTNyZCAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IFdXICAgIHwgMDEsIDAyLCAuLi4sIDUzICAgICAgICAgICAgICAgICAgfFxuICogfCBZZWFyICAgICAgICAgICAgICAgICAgICB8IFlZICAgIHwgMDAsIDAxLCAuLi4sIDk5ICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IFlZWVkgIHwgMTkwMCwgMTkwMSwgLi4uLCAyMDk5ICAgICAgICAgICAgfFxuICogfCBJU08gd2Vlay1udW1iZXJpbmcgeWVhciB8IEdHICAgIHwgMDAsIDAxLCAuLi4sIDk5ICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IEdHR0cgIHwgMTkwMCwgMTkwMSwgLi4uLCAyMDk5ICAgICAgICAgICAgfFxuICogfCBBTS9QTSAgICAgICAgICAgICAgICAgICB8IEEgICAgIHwgQU0sIFBNICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGEgICAgIHwgYW0sIHBtICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGFhICAgIHwgYS5tLiwgcC5tLiAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBIb3VyICAgICAgICAgICAgICAgICAgICB8IEggICAgIHwgMCwgMSwgLi4uIDIzICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IEhIICAgIHwgMDAsIDAxLCAuLi4gMjMgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGggICAgIHwgMSwgMiwgLi4uLCAxMiAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IGhoICAgIHwgMDEsIDAyLCAuLi4sIDEyICAgICAgICAgICAgICAgICAgfFxuICogfCBNaW51dGUgICAgICAgICAgICAgICAgICB8IG0gICAgIHwgMCwgMSwgLi4uLCA1OSAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IG1tICAgIHwgMDAsIDAxLCAuLi4sIDU5ICAgICAgICAgICAgICAgICAgfFxuICogfCBTZWNvbmQgICAgICAgICAgICAgICAgICB8IHMgICAgIHwgMCwgMSwgLi4uLCA1OSAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IHNzICAgIHwgMDAsIDAxLCAuLi4sIDU5ICAgICAgICAgICAgICAgICAgfFxuICogfCAxLzEwIG9mIHNlY29uZCAgICAgICAgICB8IFMgICAgIHwgMCwgMSwgLi4uLCA5ICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAxLzEwMCBvZiBzZWNvbmQgICAgICAgICB8IFNTICAgIHwgMDAsIDAxLCAuLi4sIDk5ICAgICAgICAgICAgICAgICAgfFxuICogfCBNaWxsaXNlY29uZCAgICAgICAgICAgICB8IFNTUyAgIHwgMDAwLCAwMDEsIC4uLiwgOTk5ICAgICAgICAgICAgICAgfFxuICogfCBUaW1lem9uZSAgICAgICAgICAgICAgICB8IFogICAgIHwgLTAxOjAwLCArMDA6MDAsIC4uLiArMTI6MDAgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICB8IFpaICAgIHwgLTAxMDAsICswMDAwLCAuLi4sICsxMjAwICAgICAgICAgfFxuICogfCBTZWNvbmRzIHRpbWVzdGFtcCAgICAgICB8IFggICAgIHwgNTEyOTY5NTIwICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCBNaWxsaXNlY29uZHMgdGltZXN0YW1wICB8IHggICAgIHwgNTEyOTY5NTIwOTAwICAgICAgICAgICAgICAgICAgICAgfFxuICpcbiAqIFRoZSBjaGFyYWN0ZXJzIHdyYXBwZWQgaW4gc3F1YXJlIGJyYWNrZXRzIGFyZSBlc2NhcGVkLlxuICpcbiAqIFRoZSByZXN1bHQgbWF5IHZhcnkgYnkgbG9jYWxlLlxuICpcbiAqIEBwYXJhbSB7RGF0ZXxTdHJpbmd8TnVtYmVyfSBkYXRlIC0gdGhlIG9yaWdpbmFsIGRhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZm9ybWF0PSdZWVlZLU1NLUREVEhIOm1tOnNzLlNTU1onXSAtIHRoZSBzdHJpbmcgb2YgdG9rZW5zXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIC0gdGhlIG9iamVjdCB3aXRoIG9wdGlvbnNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5sb2NhbGU9ZW5Mb2NhbGVdIC0gdGhlIGxvY2FsZSBvYmplY3RcbiAqIEByZXR1cm5zIHtTdHJpbmd9IHRoZSBmb3JtYXR0ZWQgZGF0ZSBzdHJpbmdcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmVwcmVzZW50IDExIEZlYnJ1YXJ5IDIwMTQgaW4gbWlkZGxlLWVuZGlhbiBmb3JtYXQ6XG4gKiB2YXIgcmVzdWx0ID0gZm9ybWF0KFxuICogICBuZXcgRGF0ZSgyMDE0LCAxLCAxMSksXG4gKiAgICdNTS9ERC9ZWVlZJ1xuICogKVxuICogLy89PiAnMDIvMTEvMjAxNCdcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmVwcmVzZW50IDIgSnVseSAyMDE0IGluIEVzcGVyYW50bzpcbiAqIHZhciBlb0xvY2FsZSA9IHJlcXVpcmUoJ2RhdGUtZm5zL2xvY2FsZS9lbycpXG4gKiB2YXIgcmVzdWx0ID0gZm9ybWF0KFxuICogICBuZXcgRGF0ZSgyMDE0LCA2LCAyKSxcbiAqICAgJ0RvIFtkZV0gTU1NTSBZWVlZJyxcbiAqICAge2xvY2FsZTogZW9Mb2NhbGV9XG4gKiApXG4gKiAvLz0+ICcyLWEgZGUganVsaW8gMjAxNCdcbiAqL1xuZnVuY3Rpb24gZm9ybWF0IChkaXJ0eURhdGUsIGRpcnR5Rm9ybWF0U3RyLCBkaXJ0eU9wdGlvbnMpIHtcbiAgdmFyIGZvcm1hdFN0ciA9IGRpcnR5Rm9ybWF0U3RyID8gU3RyaW5nKGRpcnR5Rm9ybWF0U3RyKSA6ICdZWVlZLU1NLUREVEhIOm1tOnNzLlNTU1onXG4gIHZhciBvcHRpb25zID0gZGlydHlPcHRpb25zIHx8IHt9XG5cbiAgdmFyIGxvY2FsZSA9IG9wdGlvbnMubG9jYWxlXG4gIHZhciBsb2NhbGVGb3JtYXR0ZXJzID0gZW5Mb2NhbGUuZm9ybWF0LmZvcm1hdHRlcnNcbiAgdmFyIGZvcm1hdHRpbmdUb2tlbnNSZWdFeHAgPSBlbkxvY2FsZS5mb3JtYXQuZm9ybWF0dGluZ1Rva2Vuc1JlZ0V4cFxuICBpZiAobG9jYWxlICYmIGxvY2FsZS5mb3JtYXQgJiYgbG9jYWxlLmZvcm1hdC5mb3JtYXR0ZXJzKSB7XG4gICAgbG9jYWxlRm9ybWF0dGVycyA9IGxvY2FsZS5mb3JtYXQuZm9ybWF0dGVyc1xuXG4gICAgaWYgKGxvY2FsZS5mb3JtYXQuZm9ybWF0dGluZ1Rva2Vuc1JlZ0V4cCkge1xuICAgICAgZm9ybWF0dGluZ1Rva2Vuc1JlZ0V4cCA9IGxvY2FsZS5mb3JtYXQuZm9ybWF0dGluZ1Rva2Vuc1JlZ0V4cFxuICAgIH1cbiAgfVxuXG4gIHZhciBkYXRlID0gcGFyc2UoZGlydHlEYXRlKVxuXG4gIGlmICghaXNWYWxpZChkYXRlKSkge1xuICAgIHJldHVybiAnSW52YWxpZCBEYXRlJ1xuICB9XG5cbiAgdmFyIGZvcm1hdEZuID0gYnVpbGRGb3JtYXRGbihmb3JtYXRTdHIsIGxvY2FsZUZvcm1hdHRlcnMsIGZvcm1hdHRpbmdUb2tlbnNSZWdFeHApXG5cbiAgcmV0dXJuIGZvcm1hdEZuKGRhdGUpXG59XG5cbnZhciBmb3JtYXR0ZXJzID0ge1xuICAvLyBNb250aDogMSwgMiwgLi4uLCAxMlxuICAnTSc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGRhdGUuZ2V0TW9udGgoKSArIDFcbiAgfSxcblxuICAvLyBNb250aDogMDEsIDAyLCAuLi4sIDEyXG4gICdNTSc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhkYXRlLmdldE1vbnRoKCkgKyAxLCAyKVxuICB9LFxuXG4gIC8vIFF1YXJ0ZXI6IDEsIDIsIDMsIDRcbiAgJ1EnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBNYXRoLmNlaWwoKGRhdGUuZ2V0TW9udGgoKSArIDEpIC8gMylcbiAgfSxcblxuICAvLyBEYXkgb2YgbW9udGg6IDEsIDIsIC4uLiwgMzFcbiAgJ0QnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBkYXRlLmdldERhdGUoKVxuICB9LFxuXG4gIC8vIERheSBvZiBtb250aDogMDEsIDAyLCAuLi4sIDMxXG4gICdERCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhkYXRlLmdldERhdGUoKSwgMilcbiAgfSxcblxuICAvLyBEYXkgb2YgeWVhcjogMSwgMiwgLi4uLCAzNjZcbiAgJ0RERCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGdldERheU9mWWVhcihkYXRlKVxuICB9LFxuXG4gIC8vIERheSBvZiB5ZWFyOiAwMDEsIDAwMiwgLi4uLCAzNjZcbiAgJ0REREQnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZ2V0RGF5T2ZZZWFyKGRhdGUpLCAzKVxuICB9LFxuXG4gIC8vIERheSBvZiB3ZWVrOiAwLCAxLCAuLi4sIDZcbiAgJ2QnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBkYXRlLmdldERheSgpXG4gIH0sXG5cbiAgLy8gRGF5IG9mIElTTyB3ZWVrOiAxLCAyLCAuLi4sIDdcbiAgJ0UnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBkYXRlLmdldERheSgpIHx8IDdcbiAgfSxcblxuICAvLyBJU08gd2VlazogMSwgMiwgLi4uLCA1M1xuICAnVyc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGdldElTT1dlZWsoZGF0ZSlcbiAgfSxcblxuICAvLyBJU08gd2VlazogMDEsIDAyLCAuLi4sIDUzXG4gICdXVyc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhnZXRJU09XZWVrKGRhdGUpLCAyKVxuICB9LFxuXG4gIC8vIFllYXI6IDAwLCAwMSwgLi4uLCA5OVxuICAnWVknOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRGdWxsWWVhcigpLCA0KS5zdWJzdHIoMilcbiAgfSxcblxuICAvLyBZZWFyOiAxOTAwLCAxOTAxLCAuLi4sIDIwOTlcbiAgJ1lZWVknOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRGdWxsWWVhcigpLCA0KVxuICB9LFxuXG4gIC8vIElTTyB3ZWVrLW51bWJlcmluZyB5ZWFyOiAwMCwgMDEsIC4uLiwgOTlcbiAgJ0dHJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gU3RyaW5nKGdldElTT1llYXIoZGF0ZSkpLnN1YnN0cigyKVxuICB9LFxuXG4gIC8vIElTTyB3ZWVrLW51bWJlcmluZyB5ZWFyOiAxOTAwLCAxOTAxLCAuLi4sIDIwOTlcbiAgJ0dHR0cnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBnZXRJU09ZZWFyKGRhdGUpXG4gIH0sXG5cbiAgLy8gSG91cjogMCwgMSwgLi4uIDIzXG4gICdIJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZGF0ZS5nZXRIb3VycygpXG4gIH0sXG5cbiAgLy8gSG91cjogMDAsIDAxLCAuLi4sIDIzXG4gICdISCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhkYXRlLmdldEhvdXJzKCksIDIpXG4gIH0sXG5cbiAgLy8gSG91cjogMSwgMiwgLi4uLCAxMlxuICAnaCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgdmFyIGhvdXJzID0gZGF0ZS5nZXRIb3VycygpXG4gICAgaWYgKGhvdXJzID09PSAwKSB7XG4gICAgICByZXR1cm4gMTJcbiAgICB9IGVsc2UgaWYgKGhvdXJzID4gMTIpIHtcbiAgICAgIHJldHVybiBob3VycyAlIDEyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBob3Vyc1xuICAgIH1cbiAgfSxcblxuICAvLyBIb3VyOiAwMSwgMDIsIC4uLiwgMTJcbiAgJ2hoJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGZvcm1hdHRlcnNbJ2gnXShkYXRlKSwgMilcbiAgfSxcblxuICAvLyBNaW51dGU6IDAsIDEsIC4uLiwgNTlcbiAgJ20nOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBkYXRlLmdldE1pbnV0ZXMoKVxuICB9LFxuXG4gIC8vIE1pbnV0ZTogMDAsIDAxLCAuLi4sIDU5XG4gICdtbSc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhkYXRlLmdldE1pbnV0ZXMoKSwgMilcbiAgfSxcblxuICAvLyBTZWNvbmQ6IDAsIDEsIC4uLiwgNTlcbiAgJ3MnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBkYXRlLmdldFNlY29uZHMoKVxuICB9LFxuXG4gIC8vIFNlY29uZDogMDAsIDAxLCAuLi4sIDU5XG4gICdzcyc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhkYXRlLmdldFNlY29uZHMoKSwgMilcbiAgfSxcblxuICAvLyAxLzEwIG9mIHNlY29uZDogMCwgMSwgLi4uLCA5XG4gICdTJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gTWF0aC5mbG9vcihkYXRlLmdldE1pbGxpc2Vjb25kcygpIC8gMTAwKVxuICB9LFxuXG4gIC8vIDEvMTAwIG9mIHNlY29uZDogMDAsIDAxLCAuLi4sIDk5XG4gICdTUyc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhNYXRoLmZsb29yKGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkgLyAxMCksIDIpXG4gIH0sXG5cbiAgLy8gTWlsbGlzZWNvbmQ6IDAwMCwgMDAxLCAuLi4sIDk5OVxuICAnU1NTJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCksIDMpXG4gIH0sXG5cbiAgLy8gVGltZXpvbmU6IC0wMTowMCwgKzAwOjAwLCAuLi4gKzEyOjAwXG4gICdaJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZm9ybWF0VGltZXpvbmUoZGF0ZS5nZXRUaW1lem9uZU9mZnNldCgpLCAnOicpXG4gIH0sXG5cbiAgLy8gVGltZXpvbmU6IC0wMTAwLCArMDAwMCwgLi4uICsxMjAwXG4gICdaWic6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGZvcm1hdFRpbWV6b25lKGRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKSlcbiAgfSxcblxuICAvLyBTZWNvbmRzIHRpbWVzdGFtcDogNTEyOTY5NTIwXG4gICdYJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gTWF0aC5mbG9vcihkYXRlLmdldFRpbWUoKSAvIDEwMDApXG4gIH0sXG5cbiAgLy8gTWlsbGlzZWNvbmRzIHRpbWVzdGFtcDogNTEyOTY5NTIwOTAwXG4gICd4JzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZGF0ZS5nZXRUaW1lKClcbiAgfVxufVxuXG5mdW5jdGlvbiBidWlsZEZvcm1hdEZuIChmb3JtYXRTdHIsIGxvY2FsZUZvcm1hdHRlcnMsIGZvcm1hdHRpbmdUb2tlbnNSZWdFeHApIHtcbiAgdmFyIGFycmF5ID0gZm9ybWF0U3RyLm1hdGNoKGZvcm1hdHRpbmdUb2tlbnNSZWdFeHApXG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGhcblxuICB2YXIgaVxuICB2YXIgZm9ybWF0dGVyXG4gIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGZvcm1hdHRlciA9IGxvY2FsZUZvcm1hdHRlcnNbYXJyYXlbaV1dIHx8IGZvcm1hdHRlcnNbYXJyYXlbaV1dXG4gICAgaWYgKGZvcm1hdHRlcikge1xuICAgICAgYXJyYXlbaV0gPSBmb3JtYXR0ZXJcbiAgICB9IGVsc2Uge1xuICAgICAgYXJyYXlbaV0gPSByZW1vdmVGb3JtYXR0aW5nVG9rZW5zKGFycmF5W2ldKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHZhciBvdXRwdXQgPSAnJ1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJheVtpXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgIG91dHB1dCArPSBhcnJheVtpXShkYXRlLCBmb3JtYXR0ZXJzKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0ICs9IGFycmF5W2ldXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXRcbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVGb3JtYXR0aW5nVG9rZW5zIChpbnB1dCkge1xuICBpZiAoaW5wdXQubWF0Y2goL1xcW1tcXHNcXFNdLykpIHtcbiAgICByZXR1cm4gaW5wdXQucmVwbGFjZSgvXlxcW3xdJC9nLCAnJylcbiAgfVxuICByZXR1cm4gaW5wdXQucmVwbGFjZSgvXFxcXC9nLCAnJylcbn1cblxuZnVuY3Rpb24gZm9ybWF0VGltZXpvbmUgKG9mZnNldCwgZGVsaW1ldGVyKSB7XG4gIGRlbGltZXRlciA9IGRlbGltZXRlciB8fCAnJ1xuICB2YXIgc2lnbiA9IG9mZnNldCA+IDAgPyAnLScgOiAnKydcbiAgdmFyIGFic09mZnNldCA9IE1hdGguYWJzKG9mZnNldClcbiAgdmFyIGhvdXJzID0gTWF0aC5mbG9vcihhYnNPZmZzZXQgLyA2MClcbiAgdmFyIG1pbnV0ZXMgPSBhYnNPZmZzZXQgJSA2MFxuICByZXR1cm4gc2lnbiArIGFkZExlYWRpbmdaZXJvcyhob3VycywgMikgKyBkZWxpbWV0ZXIgKyBhZGRMZWFkaW5nWmVyb3MobWludXRlcywgMilcbn1cblxuZnVuY3Rpb24gYWRkTGVhZGluZ1plcm9zIChudW1iZXIsIHRhcmdldExlbmd0aCkge1xuICB2YXIgb3V0cHV0ID0gTWF0aC5hYnMobnVtYmVyKS50b1N0cmluZygpXG4gIHdoaWxlIChvdXRwdXQubGVuZ3RoIDwgdGFyZ2V0TGVuZ3RoKSB7XG4gICAgb3V0cHV0ID0gJzAnICsgb3V0cHV0XG4gIH1cbiAgcmV0dXJuIG91dHB1dFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZvcm1hdFxuIiwiaW1wb3J0ICogYXMgZm9ybWF0IGZyb20gJ2RhdGUtZm5zL2Zvcm1hdCc7XHJcbmNvbnNvbGUubG9nKCdmb3JtYXQ6JywgZm9ybWF0KTtcclxuXHJcbmZ1bmN0aW9uIHRyYW5zZm9ybVBob25lTnVtYmVyKHZhbHVlKSB7XHJcbiAgdmFyIHMyID0gKFwiXCIrdmFsdWUpLnJlcGxhY2UoL1xcRC9nLCAnJyk7XHJcbiAgdmFyIG0gPSBzMi5tYXRjaCgvXihcXGR7M30pKFxcZHszfSkoXFxkezR9KSQvKTtcclxuICByZXR1cm4gKCFtKSA/IG51bGwgOiBcIihcIiArIG1bMV0gKyBcIikgXCIgKyBtWzJdICsgXCItXCIgKyBtWzNdO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cmFuc2Zvcm1EYXRlKHZhbHVlKSB7XHJcbiAgLy8gdmFyIG1vbWVudCA9IGdsb2JhbHMubW9tZW50O1xyXG4gIC8vIHJldHVybiBtb21lbnQodmFsdWUpLmZvcm1hdCgnTU0vREQvWVlZWScpO1xyXG4gIHJldHVybiBmb3JtYXQodmFsdWUsICdNTS9ERC9ZWVlZJyk7XHJcbiAgLy8gcmV0dXJuIHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cmFuc2Zvcm1EZWNpbWFsUGxhY2UodmFsdWUpIHtcclxuICB2YXIgbnVtYmVyID0gU3RyaW5nKHZhbHVlKS5tYXRjaCgvXFxkKy8pWzBdLnJlcGxhY2UoLyguKSg/PShcXGR7M30pKyQpL2csJyQxLCcpO1xyXG4gIHZhciBsYWJlbCA9IFN0cmluZyh2YWx1ZSkucmVwbGFjZSgvWzAtOV0vZywgJycpIHx8ICcnO1xyXG4gIHJldHVybiBudW1iZXIgKyAnICcgKyBsYWJlbDtcclxufVxyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQb3B1cENvbnRlbnQgKHBvcHVwSW5mbywgcHJvcGVydGllcykge1xyXG4gIC8vIGNvbnNvbGUubG9nKCdwb3B1cEluZm86JywgcG9wdXBJbmZvKTtcclxuICAvLyBjb25zb2xlLmxvZygncG9wdXAgcHJvcGVydGllczonLCBwcm9wZXJ0aWVzKTtcclxuICB2YXIgciA9IC9cXHsoW15cXF1dKilcXH0vZztcclxuICB2YXIgdGl0bGVUZXh0ID0gJyc7XHJcbiAgdmFyIGNvbnRlbnQgPSAnJztcclxuXHJcbiAgaWYgKHBvcHVwSW5mby50aXRsZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICB0aXRsZVRleHQgPSBwb3B1cEluZm8udGl0bGU7XHJcbiAgfVxyXG5cclxuICB0aXRsZVRleHQgPSB0aXRsZVRleHQucmVwbGFjZShyLCBmdW5jdGlvbiAocykge1xyXG4gICAgdmFyIG0gPSByLmV4ZWMocyk7XHJcbiAgICByZXR1cm4gcHJvcGVydGllc1ttWzFdXTtcclxuICB9KTtcclxuXHJcbiAgY29udGVudCA9ICc8ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LXRpdGxlIHRleHQtY2VudGVyXCI+PGg0PicgKyB0aXRsZVRleHQgKyAnPC9oND48L2Rpdj48ZGl2IGNsYXNzPVwibGVhZmxldC1wb3B1cC1jb250ZW50LWRlc2NyaXB0aW9uXCIgc3R5bGU9XCJtYXgtaGVpZ2h0OjIwMHB4O292ZXJmbG93OmF1dG87XCI+JztcclxuXHJcbiAgdmFyIGNvbnRlbnRTdGFydCA9ICc8ZGl2IHN0eWxlPVwiZm9udC13ZWlnaHQ6Ym9sZDtjb2xvcjojOTk5O21hcmdpbi10b3A6NXB4O3dvcmQtYnJlYWs6YnJlYWstYWxsO1wiPidcclxuICB2YXIgY29udGVudE1pZGRsZSA9ICc8L2Rpdj48cCBzdHlsZT1cIm1hcmdpbi10b3A6MDttYXJnaW4tYm90dG9tOjVweDt3b3JkLWJyZWFrOmJyZWFrLWFsbDtcIj4nXHJcbiAgdmFyIGFUYWdTdGFydCA9ICc8YSB0YXJnZXQ9XCJfYmxhbmtcIiBocmVmPVwiJ1xyXG4gIHZhciBlbWFpbFRhZ1N0YXJ0ID0gJzxhIGhyZWY9XCJtYWlsdG86J1xyXG5cclxuICBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3MgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb3B1cEluZm8uZmllbGRJbmZvcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0udmlzaWJsZSA9PT0gdHJ1ZSkge1xyXG4gICAgICAgIGlmIChwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV0gPT09IG51bGwpIHtcclxuICAgICAgICAgIGNvbnRlbnQgKz0gY29udGVudFN0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWxcclxuICAgICAgICAgICAgICAgICAgKyBjb250ZW50TWlkZGxlXHJcbiAgICAgICAgICAgICAgICAgIC8vICsgYVRhZ1N0YXJ0XHJcbiAgICAgICAgICAgICAgICAgIC8vICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdXHJcbiAgICAgICAgICAgICAgICAgICsgJ25vbmUnXHJcbiAgICAgICAgICAgICAgICAgIC8vICsgJ1wiPidcclxuICAgICAgICAgICAgICAgICAgLy8gKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV1cclxuICAgICAgICAgICAgICAgICAgKyAnPC9wPic7XHJcbiAgICAgICAgLy8gaWYgdGhlIGluZm8gaXMgYSBVUkxcclxuICAgICAgICB9IGVsc2UgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZSA9PT0gJ1VSTCcgfHxcclxuICAgICAgICAgICAgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lID09PSAnQ09ERV9TRUNfMScgfHxcclxuICAgICAgICAgICAgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lID09PSAnV0VCU0lURScgfHxcclxuICAgICAgICAgICAgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lID09PSAnRklOQUxfTElOS19DT1BZJyB8fFxyXG4gICAgICAgICAgICBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09ICdMSU5LJyB8fFxyXG4gICAgICAgICAgICAvLyB6b25pbmcgb3ZlcmxheXM6XHJcbiAgICAgICAgICAgIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZSA9PT0gJ0NPREVfU0VDVElPTl9MSU5LJ1xyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgY29udGVudCArPSBjb250ZW50U3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICArIGNvbnRlbnRNaWRkbGVcclxuICAgICAgICAgICAgICAgICAgKyBhVGFnU3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV1cclxuICAgICAgICAgICAgICAgICAgKyAnXCI+J1xyXG4gICAgICAgICAgICAgICAgICArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICArICc8L2E+PC9wPic7XHJcbiAgICAgICAgLy8gaWYgdGhlIGluZm8gaXMgYW4gZW1haWwgYWRkcmVzc1xyXG4gICAgICAgIH0gZWxzZSBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lLmluY2x1ZGVzKCdFTUFJTCcpKSB7XHJcbiAgICAgICAgICBjb250ZW50ICs9IGNvbnRlbnRTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICArIGVtYWlsVGFnU3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV1cclxuICAgICAgICAgICAgICAgICAgKyAnXCI+J1xyXG4gICAgICAgICAgICAgICAgICArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICArICc8L2E+PC9wPic7XHJcbiAgICAgICAgLy8gaWYgdGhlIGluZm8gaXMgYSBwaG9uZSBudW1iZXJcclxuICAgICAgICB9IGVsc2UgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZS5pbmNsdWRlcygnUEhPTkUnKSkge1xyXG4gICAgICAgICAgY29udGVudCArPSBjb250ZW50U3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICArIGNvbnRlbnRNaWRkbGVcclxuICAgICAgICAgICAgICAgICAgKyB0cmFuc2Zvcm1QaG9uZU51bWJlcihwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV0pXHJcbiAgICAgICAgICAgICAgICAgICsgJzwvcD4nO1xyXG4gICAgICAgIC8vIGlmIHRoZSBpbmZvIGlzIGEgZGF0ZVxyXG4gICAgICB9IGVsc2UgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZS5pbmNsdWRlcygnREFURScpKSB7XHJcbiAgICAgICAgICBjb250ZW50ICs9IGNvbnRlbnRTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICArIHRyYW5zZm9ybURhdGUocHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdKVxyXG4gICAgICAgICAgICAgICAgICArICc8L3A+JztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgY29udGVudCArPSBjb250ZW50U3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICArIGNvbnRlbnRNaWRkbGVcclxuICAgICAgICAgICAgICAgICAgKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV1cclxuICAgICAgICAgICAgICAgICAgKyAnPC9wPic7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBjb250ZW50ICs9ICc8L2Rpdj4nO1xyXG5cclxuICB9IGVsc2UgaWYgKHBvcHVwSW5mby5kZXNjcmlwdGlvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBLTUxMYXllciBwb3B1cFxyXG4gICAgdmFyIGRlc2NyaXB0aW9uVGV4dCA9IHBvcHVwSW5mby5kZXNjcmlwdGlvbi5yZXBsYWNlKHIsIGZ1bmN0aW9uIChzKSB7XHJcbiAgICAgIHZhciBtID0gci5leGVjKHMpO1xyXG4gICAgICByZXR1cm4gcHJvcGVydGllc1ttWzFdXTtcclxuICAgIH0pO1xyXG4gICAgY29udGVudCArPSBkZXNjcmlwdGlvblRleHQgKyAnPC9kaXY+JztcclxuICB9XHJcblxyXG4gIC8vIGlmIChwb3B1cEluZm8ubWVkaWFJbmZvcy5sZW5ndGggPiAwKSB7XHJcbiAgICAvLyBJdCBkb2VzIG5vdCBzdXBwb3J0IG1lZGlhSW5mb3MgZm9yIHBvcHVwIGNvbnRlbnRzLlxyXG4gIC8vIH1cclxuXHJcbiAgcmV0dXJuIGNvbnRlbnQ7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgUG9wdXAgPSB7XHJcbiAgY3JlYXRlUG9wdXBDb250ZW50OiBjcmVhdGVQb3B1cENvbnRlbnRcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvcHVwO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuaW1wb3J0IHsgZmVhdHVyZUNvbGxlY3Rpb24gfSBmcm9tICcuL0ZlYXR1cmVDb2xsZWN0aW9uL0ZlYXR1cmVDb2xsZWN0aW9uJztcclxuaW1wb3J0IHsgY3N2TGF5ZXIgfSBmcm9tICcuL0ZlYXR1cmVDb2xsZWN0aW9uL0NTVkxheWVyJztcclxuaW1wb3J0IHsga21sTGF5ZXIgfSBmcm9tICcuL0ZlYXR1cmVDb2xsZWN0aW9uL0tNTExheWVyJztcclxuaW1wb3J0IHsgbGFiZWxNYXJrZXIgfSBmcm9tICcuL0xhYmVsL0xhYmVsTWFya2VyJztcclxuaW1wb3J0IHsgcG9pbnRMYWJlbFBvcyB9IGZyb20gJy4vTGFiZWwvUG9pbnRMYWJlbCc7XHJcbmltcG9ydCB7IHBvbHlsaW5lTGFiZWxQb3MgfSBmcm9tICcuL0xhYmVsL1BvbHlsaW5lTGFiZWwnO1xyXG5pbXBvcnQgeyBwb2x5Z29uTGFiZWxQb3MgfSBmcm9tICcuL0xhYmVsL1BvbHlnb25MYWJlbCc7XHJcbmltcG9ydCB7IGNyZWF0ZVBvcHVwQ29udGVudCB9IGZyb20gJy4vUG9wdXAvUG9wdXAnO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZXJhdGlvbmFsTGF5ZXIgKGxheWVyLCBsYXllcnMsIG1hcCwgcGFyYW1zLCBwYW5lTmFtZSkge1xyXG4gIC8vIGNvbnNvbGUubG9nKCdvcGVyYXRpb25hbExheWVyLCBsYXllcjonLCBsYXllciwgJ2xheWVyczonLCBsYXllcnMsICdtYXA6JywgbWFwLCAncGFyYW1zOicsIHBhcmFtcywgJ3BhbmVOYW1lOicsIHBhbmVOYW1lKTtcclxuICByZXR1cm4gX2dlbmVyYXRlRXNyaUxheWVyKGxheWVyLCBsYXllcnMsIG1hcCwgcGFyYW1zLCBwYW5lTmFtZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZ2VuZXJhdGVFc3JpTGF5ZXIgKGxheWVyLCBsYXllcnMsIG1hcCwgcGFyYW1zLCBwYW5lTmFtZSkge1xyXG4gIC8vIGNvbnNvbGUubG9nKCdnZW5lcmF0ZUVzcmlMYXllcjogJywgbGF5ZXIudGl0bGUsICdwYW5lTmFtZTonLCBwYW5lTmFtZSwgJ2xheWVyOicsIGxheWVyKTtcclxuICB2YXIgbHlyO1xyXG4gIHZhciBsYWJlbHMgPSBbXTtcclxuICB2YXIgbGFiZWxzTGF5ZXI7XHJcbiAgdmFyIGxhYmVsUGFuZU5hbWUgPSBwYW5lTmFtZSArICctbGFiZWwnO1xyXG4gIHZhciBpLCBsZW47XHJcblxyXG4gIGlmIChsYXllci50eXBlID09PSAnRmVhdHVyZSBDb2xsZWN0aW9uJyB8fCBsYXllci5mZWF0dXJlQ29sbGVjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlIEZlYXR1cmVDb2xsZWN0aW9uJyk7XHJcblxyXG4gICAgbWFwLmNyZWF0ZVBhbmUobGFiZWxQYW5lTmFtZSk7XHJcblxyXG4gICAgdmFyIHBvcHVwSW5mbywgbGFiZWxpbmdJbmZvO1xyXG4gICAgaWYgKGxheWVyLml0ZW1JZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIGlmIChsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0uZmVhdHVyZVNldC5mZWF0dXJlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICBpZiAobGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkICYmIGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5wb3B1cEluZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgcG9wdXBJbmZvID0gbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLnBvcHVwSW5mbztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmIChsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkICYmIGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGxhYmVsaW5nSW5mbyA9IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGxhYmVsc0xheWVyID0gTC5mZWF0dXJlR3JvdXAobGFiZWxzKTtcclxuICAgIHZhciBmYyA9IGZlYXR1cmVDb2xsZWN0aW9uKG51bGwsIHtcclxuICAgICAgZGF0YTogbGF5ZXIuaXRlbUlkIHx8IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5LFxyXG4gICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgb25FYWNoRmVhdHVyZTogZnVuY3Rpb24gKGdlb2pzb24sIGwpIHtcclxuICAgICAgICBsLmZlYXR1cmUubGF5ZXJOYW1lID0gbGF5ZXIudGl0bGUuc3BsaXQoJ18nKVsxXTtcclxuICAgICAgICBpZiAoZmMgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgcG9wdXBJbmZvID0gZmMucG9wdXBJbmZvO1xyXG4gICAgICAgICAgbGFiZWxpbmdJbmZvID0gZmMubGFiZWxpbmdJbmZvO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocG9wdXBJbmZvICE9PSB1bmRlZmluZWQgJiYgcG9wdXBJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KHBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgIC8vIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICBsLmZlYXR1cmUucG9wdXBIdG1sID0gcG9wdXBDb250ZW50XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChsYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCAmJiBsYWJlbGluZ0luZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgIHZhciBjb29yZGluYXRlcyA9IGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcclxuICAgICAgICAgIHZhciBsYWJlbFBvcztcclxuXHJcbiAgICAgICAgICBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2ludExhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzW01hdGgucm91bmQoY29vcmRpbmF0ZXMubGVuZ3RoIC8gMildKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWdvbkxhYmVsUG9zKGwpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHZhciBsYWJlbCA9IGxhYmVsTWFya2VyKGxhYmVsUG9zLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgIHpJbmRleE9mZnNldDogMSxcclxuICAgICAgICAgICAgcHJvcGVydGllczogZ2VvanNvbi5wcm9wZXJ0aWVzLFxyXG4gICAgICAgICAgICBsYWJlbGluZ0luZm86IGxhYmVsaW5nSW5mbyxcclxuICAgICAgICAgICAgb2Zmc2V0OiBsYWJlbFBvcy5vZmZzZXQsXHJcbiAgICAgICAgICAgIHBhbmU6IGxhYmVsUGFuZU5hbWVcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGxhYmVsc0xheWVyLmFkZExheWVyKGxhYmVsKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGx5ciA9IEwubGF5ZXJHcm91cChbZmMsIGxhYmVsc0xheWVyXSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRkMnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU0ZlYXR1cmVMYXllcicgJiYgbGF5ZXIubGF5ZXJEZWZpbml0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgIHZhciB3aGVyZSA9ICcxPTEnO1xyXG4gICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZSBIZWF0bWFwTGF5ZXInKTtcclxuICAgICAgICB2YXIgZ3JhZGllbnQgPSB7fTtcclxuXHJcbiAgICAgICAgbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLmNvbG9yU3RvcHMubWFwKGZ1bmN0aW9uIChzdG9wKSB7XHJcbiAgICAgICAgICAvLyBncmFkaWVudFtzdG9wLnJhdGlvXSA9ICdyZ2JhKCcgKyBzdG9wLmNvbG9yWzBdICsgJywnICsgc3RvcC5jb2xvclsxXSArICcsJyArIHN0b3AuY29sb3JbMl0gKyAnLCcgKyAoc3RvcC5jb2xvclszXS8yNTUpICsgJyknO1xyXG4gICAgICAgICAgLy8gZ3JhZGllbnRbTWF0aC5yb3VuZChzdG9wLnJhdGlvKjEwMCkvMTAwXSA9ICdyZ2IoJyArIHN0b3AuY29sb3JbMF0gKyAnLCcgKyBzdG9wLmNvbG9yWzFdICsgJywnICsgc3RvcC5jb2xvclsyXSArICcpJztcclxuICAgICAgICAgIGdyYWRpZW50WyhNYXRoLnJvdW5kKHN0b3AucmF0aW8gKiAxMDApIC8gMTAwICsgNikgLyA3XSA9ICdyZ2IoJyArIHN0b3AuY29sb3JbMF0gKyAnLCcgKyBzdG9wLmNvbG9yWzFdICsgJywnICsgc3RvcC5jb2xvclsyXSArICcpJztcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbHlyID0gTC5lc3JpLkhlYXQuaGVhdG1hcEZlYXR1cmVMYXllcih7IC8vIEVzcmkgTGVhZmxldCAyLjBcclxuICAgICAgICAvLyBseXIgPSBMLmVzcmkuaGVhdG1hcEZlYXR1cmVMYXllcih7IC8vIEVzcmkgTGVhZmxldCAxLjBcclxuICAgICAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICAgICAgdG9rZW46IHBhcmFtcy50b2tlbiB8fCBudWxsLFxyXG4gICAgICAgICAgbWluT3BhY2l0eTogMC41LFxyXG4gICAgICAgICAgbWF4OiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIubWF4UGl4ZWxJbnRlbnNpdHksXHJcbiAgICAgICAgICBibHVyOiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuYmx1clJhZGl1cyxcclxuICAgICAgICAgIHJhZGl1czogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLmJsdXJSYWRpdXMgKiAxLjMsXHJcbiAgICAgICAgICBncmFkaWVudDogZ3JhZGllbnQsXHJcbiAgICAgICAgICBwYW5lOiBwYW5lTmFtZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdITCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGx5cjtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllciAod2l0aCBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8pJyk7XHJcbiAgICAgICAgdmFyIGRyYXdpbmdJbmZvID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvO1xyXG4gICAgICAgIGRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeSA9IDEwMCAtIChsYXllci5vcGFjaXR5ICogMTAwKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhkcmF3aW5nSW5mby50cmFuc3BhcmVuY3kpO1xyXG5cclxuICAgICAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHdoZXJlID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbWFwLmNyZWF0ZVBhbmUobGFiZWxQYW5lTmFtZSk7XHJcblxyXG4gICAgICAgIGxhYmVsc0xheWVyID0gTC5mZWF0dXJlR3JvdXAobGFiZWxzKTtcclxuXHJcbiAgICAgICAgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XHJcbiAgICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICAgIHdoZXJlOiB3aGVyZSxcclxuICAgICAgICAgIHRva2VuOiBwYXJhbXMudG9rZW4gfHwgbnVsbCxcclxuICAgICAgICAgIGRyYXdpbmdJbmZvOiBkcmF3aW5nSW5mbyxcclxuICAgICAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICAgICAgb25FYWNoRmVhdHVyZTogZnVuY3Rpb24gKGdlb2pzb24sIGwpIHtcclxuICAgICAgICAgICAgbC5mZWF0dXJlLmxheWVyTmFtZSA9IGxheWVyLnRpdGxlLnNwbGl0KCdfJylbMV07XHJcbiAgICAgICAgICAgIGlmIChsYXllci5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQobGF5ZXIucG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgICAgIC8vIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICAgICAgbC5mZWF0dXJlLnBvcHVwSHRtbCA9IHBvcHVwQ29udGVudFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQgJiYgbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgIHZhciBsYWJlbGluZ0luZm8gPSBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xyXG4gICAgICAgICAgICAgIHZhciBjb29yZGluYXRlcyA9IGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcclxuICAgICAgICAgICAgICB2YXIgbGFiZWxQb3M7XHJcblxyXG4gICAgICAgICAgICAgIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ1BvaW50Jykge1xyXG4gICAgICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2ludExhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlc1tNYXRoLnJvdW5kKGNvb3JkaW5hdGVzLmxlbmd0aCAvIDIpXSk7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWdvbkxhYmVsUG9zKGwpO1xyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgdmFyIGxhYmVsID0gbGFiZWxNYXJrZXIobGFiZWxQb3MucG9zaXRpb24sIHtcclxuICAgICAgICAgICAgICAgIHpJbmRleE9mZnNldDogMSxcclxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IGdlb2pzb24ucHJvcGVydGllcyxcclxuICAgICAgICAgICAgICAgIGxhYmVsaW5nSW5mbzogbGFiZWxpbmdJbmZvLFxyXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiBsYWJlbFBvcy5vZmZzZXQsXHJcbiAgICAgICAgICAgICAgICBwYW5lOiBsYWJlbFBhbmVOYW1lXHJcbiAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgIGxhYmVsc0xheWVyLmFkZExheWVyKGxhYmVsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBseXIgPSBMLmxheWVyR3JvdXAoW2x5ciwgbGFiZWxzTGF5ZXJdKTtcclxuXHJcbiAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRkwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBseXI7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyICh3aXRob3V0IGxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mbyknKTtcclxuXHJcbiAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHdoZXJlID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcclxuICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICB0b2tlbjogcGFyYW1zLnRva2VuIHx8IG51bGwsXHJcbiAgICAgICAgd2hlcmU6IHdoZXJlLFxyXG4gICAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgICBsLmZlYXR1cmUubGF5ZXJOYW1lID0gbGF5ZXIudGl0bGUuc3BsaXQoJ18nKVsxXTtcclxuICAgICAgICAgIGlmIChsYXllci5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgLy8gbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgICAgbC5mZWF0dXJlLnBvcHVwSHRtbCA9IHBvcHVwQ29udGVudFxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgIHJldHVybiBseXI7XHJcbiAgICB9XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNGZWF0dXJlTGF5ZXInKSB7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllcicpO1xyXG4gICAgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XHJcbiAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICB0b2tlbjogcGFyYW1zLnRva2VuIHx8IG51bGwsXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgIGwuZmVhdHVyZS5sYXllck5hbWUgPSBsYXllci50aXRsZS5zcGxpdCgnXycpWzFdO1xyXG4gICAgICAgIGlmIChsYXllci5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAvLyBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgbC5mZWF0dXJlLnBvcHVwSHRtbCA9IHBvcHVwQ29udGVudFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRkwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0NTVicpIHtcclxuICAgIGxhYmVsc0xheWVyID0gTC5mZWF0dXJlR3JvdXAobGFiZWxzKTtcclxuICAgIGx5ciA9IGNzdkxheWVyKG51bGwsIHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIGxheWVyRGVmaW5pdGlvbjogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLFxyXG4gICAgICBsb2NhdGlvbkluZm86IGxheWVyLmxvY2F0aW9uSW5mbyxcclxuICAgICAgb3BhY2l0eTogbGF5ZXIub3BhY2l0eSxcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgbC5mZWF0dXJlLmxheWVyTmFtZSA9IGxheWVyLnRpdGxlLnNwbGl0KCdfJylbMV07XHJcbiAgICAgICAgaWYgKGxheWVyLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgIC8vIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICBsLmZlYXR1cmUucG9wdXBIdG1sID0gcG9wdXBDb250ZW50XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQgJiYgbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgdmFyIGxhYmVsaW5nSW5mbyA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm87XHJcbiAgICAgICAgICB2YXIgY29vcmRpbmF0ZXMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICB2YXIgbGFiZWxQb3M7XHJcblxyXG4gICAgICAgICAgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnUG9pbnQnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9pbnRMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlc1tNYXRoLnJvdW5kKGNvb3JkaW5hdGVzLmxlbmd0aCAvIDIpXSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlnb25MYWJlbFBvcyhsKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICB2YXIgbGFiZWwgPSBsYWJlbE1hcmtlcihsYWJlbFBvcy5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IGdlb2pzb24ucHJvcGVydGllcyxcclxuICAgICAgICAgICAgbGFiZWxpbmdJbmZvOiBsYWJlbGluZ0luZm8sXHJcbiAgICAgICAgICAgIG9mZnNldDogbGFiZWxQb3Mub2Zmc2V0LFxyXG4gICAgICAgICAgICBwYW5lOiBsYWJlbFBhbmVOYW1lXHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICBsYWJlbHNMYXllci5hZGRMYXllcihsYWJlbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBseXIgPSBMLmxheWVyR3JvdXAoW2x5ciwgbGFiZWxzTGF5ZXJdKTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdDU1YnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0tNTCcpIHtcclxuICAgIGxhYmVsc0xheWVyID0gTC5mZWF0dXJlR3JvdXAobGFiZWxzKTtcclxuICAgIHZhciBrbWwgPSBrbWxMYXllcihudWxsLCB7XHJcbiAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5LFxyXG4gICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgb25FYWNoRmVhdHVyZTogZnVuY3Rpb24gKGdlb2pzb24sIGwpIHtcclxuICAgICAgICBsLmZlYXR1cmUubGF5ZXJOYW1lID0gbGF5ZXIudGl0bGUuc3BsaXQoJ18nKVsxXTtcclxuICAgICAgICBpZiAoa21sLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkICYmIGttbC5wb3B1cEluZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGttbC5wb3B1cEluZm8pO1xyXG4gICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChrbWwucG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgLy8gbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgIGwuZmVhdHVyZS5wb3B1cEh0bWwgPSBwb3B1cENvbnRlbnRcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGttbC5sYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCAmJiBrbWwubGFiZWxpbmdJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICB2YXIgbGFiZWxpbmdJbmZvID0ga21sLmxhYmVsaW5nSW5mbztcclxuICAgICAgICAgIHZhciBjb29yZGluYXRlcyA9IGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcclxuICAgICAgICAgIHZhciBsYWJlbFBvcztcclxuXHJcbiAgICAgICAgICBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2ludExhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzW01hdGgucm91bmQoY29vcmRpbmF0ZXMubGVuZ3RoIC8gMildKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWdvbkxhYmVsUG9zKGwpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHZhciBsYWJlbCA9IGxhYmVsTWFya2VyKGxhYmVsUG9zLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgIHpJbmRleE9mZnNldDogMSxcclxuICAgICAgICAgICAgcHJvcGVydGllczogZ2VvanNvbi5wcm9wZXJ0aWVzLFxyXG4gICAgICAgICAgICBsYWJlbGluZ0luZm86IGxhYmVsaW5nSW5mbyxcclxuICAgICAgICAgICAgb2Zmc2V0OiBsYWJlbFBvcy5vZmZzZXQsXHJcbiAgICAgICAgICAgIHBhbmU6IGxhYmVsUGFuZU5hbWVcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGxhYmVsc0xheWVyLmFkZExheWVyKGxhYmVsKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGx5ciA9IEwubGF5ZXJHcm91cChba21sLCBsYWJlbHNMYXllcl0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0tNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTSW1hZ2VTZXJ2aWNlTGF5ZXInKSB7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ltYWdlU2VydmljZUxheWVyJyk7XHJcbiAgICBseXIgPSBMLmVzcmkuaW1hZ2VNYXBMYXllcih7XHJcbiAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICB0b2tlbjogcGFyYW1zLnRva2VuIHx8IG51bGwsXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5IHx8IDFcclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0lNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTTWFwU2VydmljZUxheWVyJykge1xyXG4gICAgbHlyID0gTC5lc3JpLmR5bmFtaWNNYXBMYXllcih7XHJcbiAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICB0b2tlbjogcGFyYW1zLnRva2VuIHx8IG51bGwsXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5IHx8IDFcclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0RNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTVGlsZWRNYXBTZXJ2aWNlTGF5ZXInKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBseXIgPSBMLmVzcmkuYmFzZW1hcExheWVyKGxheWVyLnRpdGxlKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgbHlyID0gTC5lc3JpLnRpbGVkTWFwTGF5ZXIoe1xyXG4gICAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICAgIHRva2VuOiBwYXJhbXMudG9rZW4gfHwgbnVsbFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIEwuZXNyaS5yZXF1ZXN0KGxheWVyLnVybCwge30sIGZ1bmN0aW9uIChlcnIsIHJlcykge1xyXG4gICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHZhciBtYXhXaWR0aCA9IChtYXAuZ2V0U2l6ZSgpLnggLSA1NSk7XHJcbiAgICAgICAgICB2YXIgdGlsZWRBdHRyaWJ1dGlvbiA9ICc8c3BhbiBjbGFzcz1cImVzcmktYXR0cmlidXRpb25zXCIgc3R5bGU9XCJsaW5lLWhlaWdodDoxNHB4OyB2ZXJ0aWNhbC1hbGlnbjogLTNweDsgdGV4dC1vdmVyZmxvdzplbGxpcHNpczsgd2hpdGUtc3BhY2U6bm93cmFwOyBvdmVyZmxvdzpoaWRkZW47IGRpc3BsYXk6aW5saW5lLWJsb2NrOyBtYXgtd2lkdGg6JyArIG1heFdpZHRoICsgJ3B4O1wiPicgKyByZXMuY29weXJpZ2h0VGV4dCArICc8L3NwYW4+JztcclxuICAgICAgICAgIG1hcC5hdHRyaWJ1dGlvbkNvbnRyb2wuYWRkQXR0cmlidXRpb24odGlsZWRBdHRyaWJ1dGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdsZWFmbGV0LXRpbGUtcGFuZScpWzBdLnN0eWxlLm9wYWNpdHkgPSBsYXllci5vcGFjaXR5IHx8IDE7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVE1MJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdWZWN0b3JUaWxlTGF5ZXInKSB7XHJcbiAgICB2YXIga2V5cyA9IHtcclxuICAgICAgJ1dvcmxkIFN0cmVldCBNYXAgKHdpdGggUmVsaWVmKSc6ICdTdHJlZXRzUmVsaWVmJyxcclxuICAgICAgJ1dvcmxkIFN0cmVldCBNYXAgKHdpdGggUmVsaWVmKSAoTWF0dXJlIFN1cHBvcnQpJzogJ1N0cmVldHNSZWxpZWYnLFxyXG4gICAgICAnSHlicmlkIFJlZmVyZW5jZSBMYXllcic6ICdIeWJyaWQnLFxyXG4gICAgICAnSHlicmlkIFJlZmVyZW5jZSBMYXllciAoTWF0dXJlIFN1cHBvcnQpJzogJ0h5YnJpZCcsXHJcbiAgICAgICdXb3JsZCBTdHJlZXQgTWFwJzogJ1N0cmVldHMnLFxyXG4gICAgICAnV29ybGQgU3RyZWV0IE1hcCAoTWF0dXJlIFN1cHBvcnQpJzogJ1N0cmVldHMnLFxyXG4gICAgICAnV29ybGQgU3RyZWV0IE1hcCAoTmlnaHQpJzogJ1N0cmVldHNOaWdodCcsXHJcbiAgICAgICdXb3JsZCBTdHJlZXQgTWFwIChOaWdodCkgKE1hdHVyZSBTdXBwb3J0KSc6ICdTdHJlZXRzTmlnaHQnLFxyXG4gICAgICAnRGFyayBHcmF5IENhbnZhcyc6ICdEYXJrR3JheScsXHJcbiAgICAgICdEYXJrIEdyYXkgQ2FudmFzIChNYXR1cmUgU3VwcG9ydCknOiAnRGFya0dyYXknLFxyXG4gICAgICAnV29ybGQgVG9wb2dyYXBoaWMgTWFwJzogJ1RvcG9ncmFwaGljJyxcclxuICAgICAgJ1dvcmxkIFRvcG9ncmFwaGljIE1hcCAoTWF0dXJlIFN1cHBvcnQpJzogJ1RvcG9ncmFwaGljJyxcclxuICAgICAgJ1dvcmxkIE5hdmlnYXRpb24gTWFwJzogJ05hdmlnYXRpb24nLFxyXG4gICAgICAnV29ybGQgTmF2aWdhdGlvbiBNYXAgKE1hdHVyZSBTdXBwb3J0KSc6ICdOYXZpZ2F0aW9uJyxcclxuICAgICAgJ0xpZ2h0IEdyYXkgQ2FudmFzJzogJ0dyYXknLFxyXG4gICAgICAnTGlnaHQgR3JheSBDYW52YXMgKE1hdHVyZSBTdXBwb3J0KSc6ICdHcmF5J1xyXG4gICAgICAvLydUZXJyYWluIHdpdGggTGFiZWxzJzogJycsXHJcbiAgICAgIC8vJ1dvcmxkIFRlcnJhaW4gd2l0aCBMYWJlbHMnOiAnJyxcclxuICAgICAgLy8nTGlnaHQgR3JheSBDYW52YXMgUmVmZXJlbmNlJzogJycsXHJcbiAgICAgIC8vJ0RhcmsgR3JheSBDYW52YXMgUmVmZXJlbmNlJzogJycsXHJcbiAgICAgIC8vJ0RhcmsgR3JheSBDYW52YXMgQmFzZSc6ICcnLFxyXG4gICAgICAvLydMaWdodCBHcmF5IENhbnZhcyBCYXNlJzogJydcclxuICAgIH07XHJcblxyXG4gICAgaWYgKGtleXNbbGF5ZXIudGl0bGVdKSB7XHJcbiAgICAgIGx5ciA9IEwuZXNyaS5WZWN0b3IuYmFzZW1hcChrZXlzW2xheWVyLnRpdGxlXSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdVbnN1cHBvcnRlZCBWZWN0b3IgVGlsZSBMYXllcjogJywgbGF5ZXIpO1xyXG4gICAgICBseXIgPSBMLmZlYXR1cmVHcm91cChbXSk7XHJcbiAgICB9XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVlRMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8IGxheWVyLmlkIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdPcGVuU3RyZWV0TWFwJykge1xyXG4gICAgbHlyID0gTC50aWxlTGF5ZXIoJ2h0dHA6Ly97c30udGlsZS5vc20ub3JnL3t6fS97eH0ve3l9LnBuZycsIHtcclxuICAgICAgYXR0cmlidXRpb246ICcmY29weTsgPGEgaHJlZj1cImh0dHA6Ly9vc20ub3JnL2NvcHlyaWdodFwiPk9wZW5TdHJlZXRNYXA8L2E+IGNvbnRyaWJ1dG9ycydcclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ1RMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8IGxheWVyLmlkIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdXZWJUaWxlZExheWVyJykge1xyXG4gICAgdmFyIGx5clVybCA9IF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXQobGF5ZXIudGVtcGxhdGVVcmwpO1xyXG4gICAgbHlyID0gTC50aWxlTGF5ZXIobHlyVXJsLCB7XHJcbiAgICAgIGF0dHJpYnV0aW9uOiBsYXllci5jb3B5cmlnaHRcclxuICAgIH0pO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnbGVhZmxldC10aWxlLXBhbmUnKVswXS5zdHlsZS5vcGFjaXR5ID0gbGF5ZXIub3BhY2l0eSB8fCAxO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ1RMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8IGxheWVyLmlkIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdXTVMnKSB7XHJcbiAgICB2YXIgbGF5ZXJOYW1lcyA9ICcnO1xyXG4gICAgZm9yIChpID0gMCwgbGVuID0gbGF5ZXIudmlzaWJsZUxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICBsYXllck5hbWVzICs9IGxheWVyLnZpc2libGVMYXllcnNbaV07XHJcbiAgICAgIGlmIChpIDwgbGVuIC0gMSkge1xyXG4gICAgICAgIGxheWVyTmFtZXMgKz0gJywnO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgbHlyID0gTC50aWxlTGF5ZXIud21zKGxheWVyLnVybCwge1xyXG4gICAgICBsYXllcnM6IFN0cmluZyhsYXllck5hbWVzKSxcclxuICAgICAgZm9ybWF0OiAnaW1hZ2UvcG5nJyxcclxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXHJcbiAgICAgIGF0dHJpYnV0aW9uOiBsYXllci5jb3B5cmlnaHRcclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ1dNUycsIHRpdGxlOiBsYXllci50aXRsZSB8fCBsYXllci5pZCB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBseXIgPSBMLmZlYXR1cmVHcm91cChbXSk7XHJcbiAgICBjb25zb2xlLmxvZygnVW5zdXBwb3J0ZWQgTGF5ZXI6ICcsIGxheWVyKTtcclxuICAgIHJldHVybiBseXI7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldCAodXJsKSB7XHJcbiAgdmFyIG5ld1VybCA9IHVybDtcclxuXHJcbiAgbmV3VXJsID0gbmV3VXJsLnJlcGxhY2UoL1xce2xldmVsfS9nLCAne3p9Jyk7XHJcbiAgbmV3VXJsID0gbmV3VXJsLnJlcGxhY2UoL1xce2NvbH0vZywgJ3t4fScpO1xyXG4gIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtyb3d9L2csICd7eX0nKTtcclxuXHJcbiAgcmV0dXJuIG5ld1VybDtcclxufVxyXG5cclxuZXhwb3J0IHZhciBPcGVyYXRpb25hbExheWVyID0ge1xyXG4gIG9wZXJhdGlvbmFsTGF5ZXI6IG9wZXJhdGlvbmFsTGF5ZXIsXHJcbiAgX2dlbmVyYXRlRXNyaUxheWVyOiBfZ2VuZXJhdGVFc3JpTGF5ZXIsXHJcbiAgX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldDogX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldFxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgT3BlcmF0aW9uYWxMYXllcjtcclxuIiwiLypcclxuICogTC5lc3JpLldlYk1hcFxyXG4gKiBBIGxlYWZsZXQgcGx1Z2luIHRvIGRpc3BsYXkgQXJjR0lTIFdlYiBNYXAuIGh0dHBzOi8vZ2l0aHViLmNvbS95bnVub2thd2EvTC5lc3JpLldlYk1hcFxyXG4gKiAoYykgMjAxNiBZdXN1a2UgTnVub2thd2FcclxuICpcclxuICogQGV4YW1wbGVcclxuICpcclxuICogYGBganNcclxuICogdmFyIHdlYm1hcCA9IEwud2VibWFwKCcyMmM1MDRkMjI5ZjE0Yzc4OWM1YjQ5ZWJmZjM4Yjk0MScsIHsgbWFwOiBMLm1hcCgnbWFwJykgfSk7XHJcbiAqIGBgYFxyXG4gKi9cclxuXHJcbmltcG9ydCB7IHZlcnNpb24gfSBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xyXG5cclxuaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcbmltcG9ydCB7IG9wZXJhdGlvbmFsTGF5ZXIgfSBmcm9tICcuL09wZXJhdGlvbmFsTGF5ZXInO1xyXG5cclxuZXhwb3J0IHZhciBXZWJNYXAgPSBMLkV2ZW50ZWQuZXh0ZW5kKHtcclxuICBvcHRpb25zOiB7XHJcbiAgICAvLyBMLk1hcFxyXG4gICAgbWFwOiB7fSxcclxuICAgIC8vIGFjY2VzcyB0b2tlbiBmb3Igc2VjdXJlIGNvbnRlbnRzIG9uIEFyY0dJUyBPbmxpbmVcclxuICAgIHRva2VuOiBudWxsLFxyXG4gICAgLy8gc2VydmVyIGRvbWFpbiBuYW1lIChkZWZhdWx0PSAnd3d3LmFyY2dpcy5jb20nKVxyXG4gICAgc2VydmVyOiAnd3d3LmFyY2dpcy5jb20nXHJcbiAgfSxcclxuXHJcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHdlYm1hcElkLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5fbWFwID0gdGhpcy5vcHRpb25zLm1hcDtcclxuICAgIHRoaXMuX3Rva2VuID0gdGhpcy5vcHRpb25zLnRva2VuO1xyXG4gICAgdGhpcy5fc2VydmVyID0gdGhpcy5vcHRpb25zLnNlcnZlcjtcclxuICAgIHRoaXMuX3dlYm1hcElkID0gd2VibWFwSWQ7XHJcbiAgICB0aGlzLl9sb2FkZWQgPSBmYWxzZTtcclxuICAgIHRoaXMuX21ldGFkYXRhTG9hZGVkID0gZmFsc2U7XHJcbiAgICB0aGlzLl9sb2FkZWRMYXllcnNOdW0gPSAwO1xyXG4gICAgdGhpcy5fbGF5ZXJzTnVtID0gMDtcclxuXHJcbiAgICB0aGlzLmxheWVycyA9IFtdOyAvLyBDaGVjayB0aGUgbGF5ZXIgdHlwZXMgaGVyZSAtPiBodHRwczovL2dpdGh1Yi5jb20veW51bm9rYXdhL0wuZXNyaS5XZWJNYXAvd2lraS9MYXllci10eXBlc1xyXG4gICAgdGhpcy50aXRsZSA9ICcnOyAvLyBXZWIgTWFwIFRpdGxlXHJcbiAgICB0aGlzLmJvb2ttYXJrcyA9IFtdOyAvLyBXZWIgTWFwIEJvb2ttYXJrcyAtPiBbeyBuYW1lOiAnQm9va21hcmsgbmFtZScsIGJvdW5kczogPEwubGF0TG5nQm91bmRzPiB9XVxyXG4gICAgdGhpcy5wb3J0YWxJdGVtID0ge307IC8vIFdlYiBNYXAgTWV0YWRhdGFcclxuXHJcbiAgICB0aGlzLlZFUlNJT04gPSB2ZXJzaW9uO1xyXG5cclxuICAgIHRoaXMuX2xvYWRXZWJNYXBNZXRhRGF0YSh3ZWJtYXBJZCk7XHJcbiAgICB0aGlzLl9sb2FkV2ViTWFwKHdlYm1hcElkKTtcclxuICB9LFxyXG5cclxuICBfY2hlY2tMb2FkZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuX2xvYWRlZExheWVyc051bSsrO1xyXG4gICAgaWYgKHRoaXMuX2xvYWRlZExheWVyc051bSA9PT0gdGhpcy5fbGF5ZXJzTnVtKSB7XHJcbiAgICAgIHRoaXMuX2xvYWRlZCA9IHRydWU7XHJcbiAgICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIF9vcGVyYXRpb25hbExheWVyOiBmdW5jdGlvbiAobGF5ZXIsIGxheWVycywgbWFwLCBwYXJhbXMsIHBhbmVOYW1lKSB7XHJcbiAgICB2YXIgbHlyID0gb3BlcmF0aW9uYWxMYXllcihsYXllciwgbGF5ZXJzLCBtYXAsIHBhcmFtcywgcGFuZU5hbWUpO1xyXG4gICAgaWYgKGx5ciAhPT0gdW5kZWZpbmVkICYmIGxheWVyLnZpc2liaWxpdHkgPT09IHRydWUpIHtcclxuICAgICAgbHlyLmFkZFRvKG1hcCk7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgX2xvYWRXZWJNYXBNZXRhRGF0YTogZnVuY3Rpb24gKGlkKSB7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnX2xvYWRXZWJNYXBNZXRhRGF0YSBpcyBydW5uaW5nLCBpZDonLCBpZCwgJ3RoaXMuX3NlcnZlcjonLCB0aGlzLl9zZXJ2ZXIpO1xyXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xyXG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcclxuICAgIHZhciB3ZWJtYXAgPSB0aGlzO1xyXG4gICAgdmFyIHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCA9ICdodHRwczovLycgKyB0aGlzLl9zZXJ2ZXIgKyAnL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZDtcclxuICAgIGlmICh0aGlzLl90b2tlbiAmJiB0aGlzLl90b2tlbi5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHBhcmFtcy50b2tlbiA9IHRoaXMuX3Rva2VuO1xyXG4gICAgfVxyXG5cclxuICAgIEwuZXNyaS5yZXF1ZXN0KHdlYm1hcE1ldGFEYXRhUmVxdWVzdFVybCwgcGFyYW1zLCBmdW5jdGlvbiAoZXJyb3IsIHJlc3BvbnNlKSB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZygnV2ViTWFwIE1ldGFEYXRhOiAnLCByZXNwb25zZSk7XHJcbiAgICAgICAgd2VibWFwLnBvcnRhbEl0ZW0gPSByZXNwb25zZTtcclxuICAgICAgICB3ZWJtYXAudGl0bGUgPSByZXNwb25zZS50aXRsZTtcclxuICAgICAgICB3ZWJtYXAuX21ldGFkYXRhTG9hZGVkID0gdHJ1ZTtcclxuICAgICAgICB3ZWJtYXAuZmlyZSgnbWV0YWRhdGFMb2FkJyk7XHJcbiAgICAgICAgbWFwLmZpdEJvdW5kcyhbcmVzcG9uc2UuZXh0ZW50WzBdLnJldmVyc2UoKSwgcmVzcG9uc2UuZXh0ZW50WzFdLnJldmVyc2UoKV0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9LFxyXG5cclxuICBfbG9hZFdlYk1hcDogZnVuY3Rpb24gKGlkKSB7XHJcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xyXG4gICAgdmFyIGxheWVycyA9IHRoaXMubGF5ZXJzO1xyXG4gICAgdmFyIHNlcnZlciA9IHRoaXMuX3NlcnZlcjtcclxuICAgIHZhciBwYXJhbXMgPSB7fTtcclxuICAgIHZhciB3ZWJtYXBSZXF1ZXN0VXJsID0gJ2h0dHBzOi8vJyArIHNlcnZlciArICcvc2hhcmluZy9yZXN0L2NvbnRlbnQvaXRlbXMvJyArIGlkICsgJy9kYXRhJztcclxuICAgIC8vIGNvbnNvbGUubG9nKCd3ZWJtYXBSZXF1ZXN0VXJsOicsIHdlYm1hcFJlcXVlc3RVcmwsICd0aGlzLl90b2tlbjonLCB0aGlzLl90b2tlbik7XHJcbiAgICBpZiAodGhpcy5fdG9rZW4gJiYgdGhpcy5fdG9rZW4ubGVuZ3RoID4gMCkge1xyXG4gICAgICBwYXJhbXMudG9rZW4gPSB0aGlzLl90b2tlbjtcclxuICAgIH1cclxuXHJcbiAgICBMLmVzcmkucmVxdWVzdCh3ZWJtYXBSZXF1ZXN0VXJsLCBwYXJhbXMsIGZ1bmN0aW9uIChlcnJvciwgcmVzcG9uc2UpIHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0wuZXNyaS5yZXF1ZXN0IGVycm9yOicsIGVycm9yKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZygnV2ViTWFwOiAnLCByZXNwb25zZSk7XHJcbiAgICAgICAgdGhpcy5fbGF5ZXJzTnVtID0gcmVzcG9uc2UuYmFzZU1hcC5iYXNlTWFwTGF5ZXJzLmxlbmd0aCArIHJlc3BvbnNlLm9wZXJhdGlvbmFsTGF5ZXJzLmxlbmd0aDtcclxuXHJcbiAgICAgICAgLy8gQWRkIEJhc2VtYXBcclxuICAgICAgICByZXNwb25zZS5iYXNlTWFwLmJhc2VNYXBMYXllcnMubWFwKGZ1bmN0aW9uIChiYXNlTWFwTGF5ZXIpIHtcclxuICAgICAgICAgIGlmIChiYXNlTWFwTGF5ZXIuaXRlbUlkICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdmFyIGl0ZW1SZXF1ZXN0VXJsID0gJ2h0dHBzOi8vJyArIHNlcnZlciArICcvc2hhcmluZy9yZXN0L2NvbnRlbnQvaXRlbXMvJyArIGJhc2VNYXBMYXllci5pdGVtSWQ7XHJcbiAgICAgICAgICAgIEwuZXNyaS5yZXF1ZXN0KGl0ZW1SZXF1ZXN0VXJsLCBwYXJhbXMsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xyXG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhyZXMuYWNjZXNzKTtcclxuICAgICAgICAgICAgICAgIGlmIChyZXMuYWNjZXNzICE9PSAncHVibGljJykge1xyXG4gICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnaW4gX2xvYWRXZWJNYXAgcHVibGljJylcclxuICAgICAgICAgICAgICAgICAgdGhpcy5fb3BlcmF0aW9uYWxMYXllcihiYXNlTWFwTGF5ZXIsIGxheWVycywgbWFwLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ2luIF9sb2FkV2ViTWFwIE5PVCBwdWJsaWMnKVxyXG4gICAgICAgICAgICAgICAgICB0aGlzLl9vcGVyYXRpb25hbExheWVyKGJhc2VNYXBMYXllciwgbGF5ZXJzLCBtYXAsIHt9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgdGhpcy5fY2hlY2tMb2FkZWQoKTtcclxuICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9vcGVyYXRpb25hbExheWVyKGJhc2VNYXBMYXllciwgbGF5ZXJzLCBtYXAsIHt9KTtcclxuICAgICAgICAgICAgdGhpcy5fY2hlY2tMb2FkZWQoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICAvLyBBZGQgT3BlcmF0aW9uYWwgTGF5ZXJzXHJcbiAgICAgICAgcmVzcG9uc2Uub3BlcmF0aW9uYWxMYXllcnMubWFwKGZ1bmN0aW9uIChsYXllciwgaSkge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coJ3Jlc3BvbnNlLm9wZXJhdGlvbmFsTGF5ZXJzLCBsYXllcjonLCBsYXllcik7XHJcbiAgICAgICAgICB2YXIgcGFuZU5hbWUgPSAnZXNyaS13ZWJtYXAtbGF5ZXInICsgaTtcclxuICAgICAgICAgIG1hcC5jcmVhdGVQYW5lKHBhbmVOYW1lKTtcclxuICAgICAgICAgIGlmIChsYXllci5pdGVtSWQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnV2ViTWFwTG9hZGVyLmpzIHBhbmVOYW1lOicsIHBhbmVOYW1lKTtcclxuICAgICAgICAgICAgdmFyIGl0ZW1SZXF1ZXN0VXJsID0gJ2h0dHBzOi8vJyArIHNlcnZlciArICcvc2hhcmluZy9yZXN0L2NvbnRlbnQvaXRlbXMvJyArIGxheWVyLml0ZW1JZDtcclxuICAgICAgICAgICAgTC5lc3JpLnJlcXVlc3QoaXRlbVJlcXVlc3RVcmwsIHBhcmFtcywgZnVuY3Rpb24gKGVyciwgcmVzKSB7XHJcbiAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlcy5hY2Nlc3MpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlcy5hY2Nlc3MgIT09ICdwdWJsaWMnKSB7XHJcbiAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdpbnNpZGUgcHVibGljLCBsYXllcjonLCBsYXllciwgJ2xheWVyczonLCBsYXllcnMsICdtYXA6JywgbWFwLCAncGFyYW1zOicsIHBhcmFtcywgJ3BhbmVOYW1lOicsIHBhbmVOYW1lKTtcclxuICAgICAgICAgICAgICAgICAgdGhpcy5fb3BlcmF0aW9uYWxMYXllcihsYXllciwgbGF5ZXJzLCBtYXAsIHBhcmFtcywgcGFuZU5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ05PVCBpbnNpZGUgcHVibGljLCBsYXllcjonLCBsYXllciwgJ2xheWVyczonLCBsYXllcnMsICdtYXA6JywgbWFwLCAncGFyYW1zOicsIHBhcmFtcywgJ3BhbmVOYW1lOicsIHBhbmVOYW1lKTtcclxuICAgICAgICAgICAgICAgICAgdGhpcy5fb3BlcmF0aW9uYWxMYXllcihsYXllciwgbGF5ZXJzLCBtYXAsIHt9LCBwYW5lTmFtZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIHRoaXMuX2NoZWNrTG9hZGVkKCk7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fb3BlcmF0aW9uYWxMYXllcihsYXllciwgbGF5ZXJzLCBtYXAsIHt9LCBwYW5lTmFtZSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2NoZWNrTG9hZGVkKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgLy8gQWRkIEJvb2ttYXJrc1xyXG4gICAgICAgIGlmIChyZXNwb25zZS5ib29rbWFya3MgIT09IHVuZGVmaW5lZCAmJiByZXNwb25zZS5ib29rbWFya3MubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgcmVzcG9uc2UuYm9va21hcmtzLm1hcChmdW5jdGlvbiAoYm9va21hcmspIHtcclxuICAgICAgICAgICAgLy8gRXNyaSBFeHRlbnQgR2VvbWV0cnkgdG8gTC5sYXRMbmdCb3VuZHNcclxuICAgICAgICAgICAgdmFyIG5vcnRoRWFzdCA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChib29rbWFyay5leHRlbnQueG1heCwgYm9va21hcmsuZXh0ZW50LnltYXgpKTtcclxuICAgICAgICAgICAgdmFyIHNvdXRoV2VzdCA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChib29rbWFyay5leHRlbnQueG1pbiwgYm9va21hcmsuZXh0ZW50LnltaW4pKTtcclxuICAgICAgICAgICAgdmFyIGJvdW5kcyA9IEwubGF0TG5nQm91bmRzKHNvdXRoV2VzdCwgbm9ydGhFYXN0KTtcclxuICAgICAgICAgICAgdGhpcy5ib29rbWFya3MucHVzaCh7IG5hbWU6IGJvb2ttYXJrLm5hbWUsIGJvdW5kczogYm91bmRzIH0pO1xyXG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vdGhpcy5fbG9hZGVkID0gdHJ1ZTtcclxuICAgICAgICAvL3RoaXMuZmlyZSgnbG9hZCcpO1xyXG4gICAgICB9XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd2ViTWFwICh3ZWJtYXBJZCwgb3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgV2ViTWFwKHdlYm1hcElkLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgd2ViTWFwO1xyXG4iXSwibmFtZXMiOlsiUmVuZGVyZXIiLCJmb3JtYXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0NBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxDQUFBO0FBQ0EsQ0FBQSxTQUFTLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQzVCLENBQUEsRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQyxDQUFBLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ3ZCLENBQUEsTUFBTSxPQUFPLEtBQUssQ0FBQztBQUNuQixDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFBLENBQUM7O0FBRUQsQ0FBQTtBQUNBLENBQUEsU0FBUyxTQUFTLEVBQUUsV0FBVyxFQUFFO0FBQ2pDLENBQUEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ3pFLENBQUEsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFBLENBQUM7O0FBRUQsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQSxTQUFTLGVBQWUsRUFBRSxVQUFVLEVBQUU7QUFDdEMsQ0FBQSxFQUFFLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNoQixDQUFBLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ1osQ0FBQSxFQUFFLElBQUksT0FBTyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxFQUFFLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixDQUFBLEVBQUUsSUFBSSxHQUFHLENBQUM7QUFDVixDQUFBLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDaEMsQ0FBQSxJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzVCLENBQUEsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkQsQ0FBQSxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDZCxDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsT0FBTyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFBLENBQUM7O0FBRUQsQ0FBQTtBQUNBLENBQUEsU0FBUyxzQkFBc0IsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7QUFDakQsQ0FBQSxFQUFFLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEYsQ0FBQSxFQUFFLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEYsQ0FBQSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXJGLENBQUEsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUU7QUFDaEIsQ0FBQSxJQUFJLElBQUksRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFDdEIsQ0FBQSxJQUFJLElBQUksRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7O0FBRXRCLENBQUEsSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7QUFDbEQsQ0FBQSxNQUFNLE9BQU8sSUFBSSxDQUFDO0FBQ2xCLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFBLENBQUM7O0FBRUQsQ0FBQTtBQUNBLENBQUEsU0FBUyxvQkFBb0IsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQ3JDLENBQUEsRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDekMsQ0FBQSxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUMzQyxDQUFBLE1BQU0sSUFBSSxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ2xFLENBQUEsUUFBUSxPQUFPLElBQUksQ0FBQztBQUNwQixDQUFBLE9BQU87QUFDUCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQSxDQUFDOztBQUVELENBQUE7QUFDQSxDQUFBLFNBQVMsdUJBQXVCLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRTtBQUN0RCxDQUFBLEVBQUUsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO0FBQ3ZCLENBQUEsRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3RFLENBQUEsSUFBSSxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEUsQ0FBQSxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekUsQ0FBQSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDakssQ0FBQSxNQUFNLFFBQVEsR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUMzQixDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQSxDQUFDOztBQUVELENBQUE7QUFDQSxDQUFBLFNBQVMsNkJBQTZCLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTtBQUN0RCxDQUFBLEVBQUUsSUFBSSxVQUFVLEdBQUcsb0JBQW9CLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3RELENBQUEsRUFBRSxJQUFJLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUQsQ0FBQSxFQUFFLElBQUksQ0FBQyxVQUFVLElBQUksUUFBUSxFQUFFO0FBQy9CLENBQUEsSUFBSSxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFBLENBQUM7O0FBRUQsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQSxTQUFTLHFCQUFxQixFQUFFLEtBQUssRUFBRTtBQUN2QyxDQUFBLEVBQUUsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO0FBQ3RCLENBQUEsRUFBRSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7QUFDakIsQ0FBQSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ1IsQ0FBQSxFQUFFLElBQUksU0FBUyxDQUFDO0FBQ2hCLENBQUEsRUFBRSxJQUFJLElBQUksQ0FBQzs7QUFFWCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3pDLENBQUEsSUFBSSxJQUFJLElBQUksR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVDLENBQUEsSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ3pCLENBQUEsTUFBTSxTQUFTO0FBQ2YsQ0FBQSxLQUFLO0FBQ0wsQ0FBQTtBQUNBLENBQUEsSUFBSSxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUMvQixDQUFBLE1BQU0sSUFBSSxPQUFPLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQztBQUM3QixDQUFBLE1BQU0sVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMvQixDQUFBLEtBQUssTUFBTTtBQUNYLENBQUEsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3ZCLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7O0FBRTVCLENBQUE7QUFDQSxDQUFBLEVBQUUsT0FBTyxLQUFLLENBQUMsTUFBTSxFQUFFO0FBQ3ZCLENBQUE7QUFDQSxDQUFBLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7QUFFdkIsQ0FBQTtBQUNBLENBQUEsSUFBSSxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDMUIsQ0FBQSxJQUFJLEtBQUssQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDakQsQ0FBQSxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkMsQ0FBQSxNQUFNLElBQUksNkJBQTZCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxFQUFFO0FBQzFELENBQUE7QUFDQSxDQUFBLFFBQVEsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqQyxDQUFBLFFBQVEsU0FBUyxHQUFHLElBQUksQ0FBQztBQUN6QixDQUFBLFFBQVEsTUFBTTtBQUNkLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSzs7QUFFTCxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUEsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ3BCLENBQUEsTUFBTSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEMsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHOztBQUVILENBQUE7QUFDQSxDQUFBLEVBQUUsT0FBTyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUU7QUFDbEMsQ0FBQTtBQUNBLENBQUEsSUFBSSxJQUFJLEdBQUcsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUM7O0FBRWxDLENBQUE7QUFDQSxDQUFBLElBQUksSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDOztBQUUzQixDQUFBLElBQUksS0FBSyxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNqRCxDQUFBLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQyxDQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEVBQUU7QUFDakQsQ0FBQTtBQUNBLENBQUEsUUFBUSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pDLENBQUEsUUFBUSxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQzFCLENBQUEsUUFBUSxNQUFNO0FBQ2QsQ0FBQSxPQUFPO0FBQ1AsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ3JCLENBQUEsTUFBTSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN4QyxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDL0IsQ0FBQSxJQUFJLE9BQU87QUFDWCxDQUFBLE1BQU0sSUFBSSxFQUFFLFNBQVM7QUFDckIsQ0FBQSxNQUFNLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLENBQUEsS0FBSyxDQUFDO0FBQ04sQ0FBQSxHQUFHLE1BQU07QUFDVCxDQUFBLElBQUksT0FBTztBQUNYLENBQUEsTUFBTSxJQUFJLEVBQUUsY0FBYztBQUMxQixDQUFBLE1BQU0sV0FBVyxFQUFFLFVBQVU7QUFDN0IsQ0FBQSxLQUFLLENBQUM7QUFDTixDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUM7O0FBRUQsQUE0QkEsQUFjQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUEsU0FBUyxZQUFZLEVBQUUsR0FBRyxFQUFFO0FBQzVCLENBQUEsRUFBRSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDbEIsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFO0FBQ3JCLENBQUEsSUFBSSxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDL0IsQ0FBQSxNQUFNLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekIsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUEsQ0FBQzs7QUFFRCxBQUFPLENBQUEsU0FBUyxlQUFlLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRTtBQUN0RCxDQUFBLEVBQUUsSUFBSSxPQUFPLEdBQUcsRUFBRSxDQUFDOztBQUVuQixDQUFBLEVBQUUsSUFBSSxPQUFPLE1BQU0sQ0FBQyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sTUFBTSxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUU7QUFDcEUsQ0FBQSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDO0FBQzNCLENBQUEsSUFBSSxPQUFPLENBQUMsV0FBVyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0MsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7QUFDckIsQ0FBQSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEdBQUcsWUFBWSxDQUFDO0FBQ2hDLENBQUEsSUFBSSxPQUFPLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pELENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO0FBQ3BCLENBQUEsSUFBSSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUNuQyxDQUFBLE1BQU0sT0FBTyxDQUFDLElBQUksR0FBRyxZQUFZLENBQUM7QUFDbEMsQ0FBQSxNQUFNLE9BQU8sQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckQsQ0FBQSxLQUFLLE1BQU07QUFDWCxDQUFBLE1BQU0sT0FBTyxDQUFDLElBQUksR0FBRyxpQkFBaUIsQ0FBQztBQUN2QyxDQUFBLE1BQU0sT0FBTyxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtBQUNwQixDQUFBLElBQUksT0FBTyxHQUFHLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0QsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLE1BQU0sQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtBQUM1QyxDQUFBLElBQUksT0FBTyxDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7QUFDN0IsQ0FBQSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDbkYsQ0FBQSxJQUFJLE9BQU8sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDdEYsQ0FBQSxJQUFJLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtBQUMzQixDQUFBLE1BQU0sT0FBTyxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO0FBQ3pHLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRzs7QUFFSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUMvRCxDQUFBLElBQUksT0FBTyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDNUIsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFBLENBQUMsQUFFRCxBQTBEQTs7Q0MxVk8sSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbkMsQ0FBQSxFQUFFLFVBQVUsRUFBRSxVQUFVLFVBQVUsRUFBRSxPQUFPLEVBQUU7QUFDN0MsQ0FBQSxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDO0FBQ2xDLENBQUEsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQztBQUNwQixDQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDdEIsQ0FBQSxJQUFJLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO0FBQzVCLENBQUEsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0FBQ2hDLENBQUEsSUFBSSxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsaUJBQWlCLEVBQUU7QUFDOUMsQ0FBQSxNQUFNLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFDeEUsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHOztBQUVILENBQUE7QUFDQSxDQUFBLEVBQUUsVUFBVSxFQUFFLFVBQVUsVUFBVSxFQUFFO0FBQ3BDLENBQUEsSUFBSSxPQUFPLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDOUIsQ0FBQSxHQUFHOztBQUVILENBQUE7QUFDQSxDQUFBLEVBQUUsVUFBVSxFQUFFLFVBQVUsS0FBSyxFQUFFO0FBQy9CLENBQUEsSUFBSSxPQUFPLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUNyRSxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLFVBQVUsRUFBRSxVQUFVLEtBQUssRUFBRTtBQUMvQixDQUFBLElBQUksSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUNqQyxDQUFBLElBQUksT0FBTyxLQUFLLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDO0FBQzNDLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsT0FBTyxFQUFFLFVBQVUsT0FBTyxFQUFFLFFBQVEsRUFBRTtBQUN4QyxDQUFBLElBQUksSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztBQUNsQyxDQUFBLElBQUksSUFBSSxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQztBQUMvQixDQUFBLElBQUksSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ2pCLENBQUEsSUFBSSxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7O0FBRTVCLENBQUEsSUFBSSxJQUFJLEtBQUssRUFBRTtBQUNmLENBQUEsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2pDLENBQUEsTUFBTSxJQUFJLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDO0FBQ3JDLENBQUEsTUFBTSxJQUFJLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDO0FBQ3JDLENBQUEsTUFBTSxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDO0FBQy9DLENBQUEsTUFBTSxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDO0FBQy9DLENBQUEsTUFBTSxJQUFJLFlBQVksQ0FBQztBQUN2QixDQUFBLE1BQU0sSUFBSSxTQUFTLEdBQUcsUUFBUSxDQUFDLGtCQUFrQixDQUFDO0FBQ2xELENBQUEsTUFBTSxJQUFJLFNBQVMsR0FBRyxJQUFJLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQzs7QUFFckUsQ0FBQSxNQUFNLElBQUksWUFBWSxLQUFLLElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLFNBQVMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDM0YsQ0FBQSxRQUFRLE9BQU8sSUFBSSxDQUFDO0FBQ3BCLENBQUEsT0FBTzs7QUFFUCxDQUFBLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRTtBQUM3QixDQUFBLFFBQVEsWUFBWSxJQUFJLFNBQVMsQ0FBQztBQUNsQyxDQUFBLE9BQU87O0FBRVAsQ0FBQSxNQUFNLElBQUksT0FBTyxLQUFLLElBQUksSUFBSSxPQUFPLEtBQUssSUFBSSxJQUFJLFlBQVksS0FBSyxJQUFJLElBQUksWUFBWSxLQUFLLElBQUksRUFBRTtBQUNsRyxDQUFBLFFBQVEsSUFBSSxZQUFZLElBQUksWUFBWSxFQUFFO0FBQzFDLENBQUEsVUFBVSxJQUFJLEdBQUcsT0FBTyxDQUFDO0FBQ3pCLENBQUEsU0FBUyxNQUFNLElBQUksWUFBWSxJQUFJLFlBQVksRUFBRTtBQUNqRCxDQUFBLFVBQVUsSUFBSSxHQUFHLE9BQU8sQ0FBQztBQUN6QixDQUFBLFNBQVMsTUFBTTtBQUNmLENBQUEsVUFBVSxZQUFZLEdBQUcsQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDLENBQUM7QUFDdkYsQ0FBQSxVQUFVLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNoRSxDQUFBLFNBQVM7QUFDVCxDQUFBLE9BQU87QUFDUCxDQUFBLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQ3BDLENBQUEsS0FBSztBQUNMLENBQUEsSUFBSSxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLFFBQVEsRUFBRSxVQUFVLE9BQU8sRUFBRSxTQUFTLEVBQUU7QUFDMUMsQ0FBQTtBQUNBLENBQUEsSUFBSSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLFNBQVMsSUFBSSxTQUFTLENBQUMsS0FBSyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNsRixDQUFBLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO0FBQ2xDLENBQUEsSUFBSSxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzdDLENBQUEsSUFBSSxJQUFJLGVBQWUsRUFBRSxlQUFlLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQztBQUNqRSxDQUFBLElBQUksSUFBSSxTQUFTLEdBQUcsU0FBUyxDQUFDLGtCQUFrQixDQUFDO0FBQ2pELENBQUEsSUFBSSxJQUFJLFNBQVMsR0FBRyxJQUFJLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQztBQUNuRSxDQUFBLElBQUksSUFBSSxZQUFZLEtBQUssSUFBSSxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksU0FBUyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUN6RixDQUFBLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFO0FBQzNCLENBQUEsTUFBTSxZQUFZLElBQUksU0FBUyxDQUFDO0FBQ2hDLENBQUEsS0FBSzs7QUFFTCxDQUFBLElBQUksSUFBSSxZQUFZLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUU7QUFDbEQsQ0FBQSxNQUFNLE9BQU8sU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDdEMsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxJQUFJLElBQUksUUFBUSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDL0QsQ0FBQSxJQUFJLElBQUksWUFBWSxJQUFJLFFBQVEsQ0FBQyxLQUFLLEVBQUU7QUFDeEMsQ0FBQSxNQUFNLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQztBQUM1QixDQUFBLEtBQUs7O0FBRUwsQ0FBQTtBQUNBLENBQUEsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckQsQ0FBQSxNQUFNLElBQUksUUFBUSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXhDLENBQUEsTUFBTSxJQUFJLFFBQVEsQ0FBQyxLQUFLLElBQUksWUFBWSxFQUFFO0FBQzFDLENBQUEsUUFBUSxlQUFlLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQztBQUN6QyxDQUFBLFFBQVEsVUFBVSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7QUFDcEMsQ0FBQSxPQUFPLE1BQU0sSUFBSSxRQUFRLENBQUMsS0FBSyxHQUFHLFlBQVksRUFBRTtBQUNoRCxDQUFBLFFBQVEsZUFBZSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7QUFDekMsQ0FBQSxRQUFRLFVBQVUsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDO0FBQ3BDLENBQUEsUUFBUSxNQUFNO0FBQ2QsQ0FBQSxPQUFPO0FBQ1AsQ0FBQSxLQUFLOztBQUVMLENBQUE7QUFDQSxDQUFBLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRTtBQUNsRCxDQUFBLE1BQU0sSUFBSSxLQUFLLEdBQUcsVUFBVSxHQUFHLFVBQVUsQ0FBQztBQUMxQyxDQUFBLE1BQU0sSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFO0FBQ3JCLENBQUE7QUFDQSxDQUFBLFFBQVEsSUFBSSxxQkFBcUIsR0FBRyxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDeEUsQ0FBQSxRQUFRLElBQUkscUJBQXFCLEVBQUU7QUFDbkMsQ0FBQTtBQUNBLENBQUEsVUFBVSxJQUFJLHFCQUFxQixHQUFHLENBQUMsVUFBVSxHQUFHLFlBQVksQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUMxRSxDQUFBLFVBQVUsSUFBSSxxQkFBcUIsRUFBRTtBQUNyQyxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUEsWUFBWSxJQUFJLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztBQUN2QyxDQUFBLFlBQVksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN4QyxDQUFBLGNBQWMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBRyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxHQUFHLHFCQUFxQixDQUFDLENBQUMsQ0FBQztBQUM3SSxDQUFBLGFBQWE7QUFDYixDQUFBLFlBQVksT0FBTyxpQkFBaUIsQ0FBQztBQUNyQyxDQUFBLFdBQVcsTUFBTTtBQUNqQixDQUFBO0FBQ0EsQ0FBQSxZQUFZLE9BQU8sZUFBZSxDQUFDO0FBQ25DLENBQUEsV0FBVztBQUNYLENBQUEsU0FBUyxNQUFNO0FBQ2YsQ0FBQTtBQUNBLENBQUEsVUFBVSxPQUFPLGVBQWUsQ0FBQztBQUNqQyxDQUFBLFNBQVM7QUFDVCxDQUFBLE9BQU87QUFDUCxDQUFBLEtBQUs7QUFDTCxDQUFBO0FBQ0EsQ0FBQSxJQUFJLE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUEsR0FBRztBQUNILENBQUEsQ0FBQyxDQUFDLENBQUMsQUFFSDs7Q0MzSU8sSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7O0FBRXZDLENBQUEsRUFBRSxVQUFVLEVBQUUsVUFBVSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtBQUMvQyxDQUFBLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDaEMsQ0FBQSxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLENBQUEsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0FBQzlCLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsU0FBUyxFQUFFLFlBQVk7QUFDekIsQ0FBQSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFO0FBQ3RDLENBQUEsTUFBTSxJQUFJLEVBQUUsT0FBTztBQUNuQixDQUFBLE1BQU0sV0FBVyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUM3RCxDQUFBLEtBQUssQ0FBQyxDQUFDO0FBQ1AsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxrQkFBa0IsRUFBRSxZQUFZO0FBQ2xDLENBQUE7QUFDQSxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLFFBQVEsRUFBRSxZQUFZO0FBQ3hCLENBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdELENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsT0FBTyxFQUFFLFlBQVk7QUFDdkIsQ0FBQSxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtBQUNuQixDQUFBLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQ3pCLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsV0FBVyxFQUFFLFlBQVk7QUFDM0IsQ0FBQTtBQUNBLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsU0FBUyxFQUFFLFVBQVUsTUFBTSxFQUFFO0FBQy9CLENBQUEsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNsQixDQUFBLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNyRCxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLFNBQVMsRUFBRSxZQUFZO0FBQ3pCLENBQUEsSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDeEIsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUU7QUFDM0IsQ0FBQSxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLENBQUEsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN6QixDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLE9BQU8sRUFBRSxZQUFZO0FBQ3ZCLENBQUEsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDdEIsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxDQUFDLENBQUMsQ0FBQzs7Q0NuREksSUFBSSxXQUFXLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQzs7QUFFNUMsQ0FBQSxFQUFFLFVBQVUsRUFBRSxVQUFVLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0FBQy9DLENBQUEsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDdkUsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxXQUFXLEVBQUUsWUFBWTtBQUMzQixDQUFBLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM1QyxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLGtCQUFrQixFQUFFLFlBQVk7QUFDbEMsQ0FBQSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0FBQ3JCLENBQUEsTUFBTSxrQkFBa0IsRUFBRSxVQUFVLEtBQUssRUFBRTtBQUMzQyxDQUFBLFFBQVEsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUNsQyxDQUFBLFFBQVEsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUM7QUFDdkMsQ0FBQSxRQUFRLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7O0FBRTVCLENBQUEsUUFBUSxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDeEIsQ0FBQSxRQUFRLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQ2hELENBQUEsUUFBUSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUNoRCxDQUFBLFFBQVEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7O0FBRXJDLENBQUEsUUFBUSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRCxDQUFBLFFBQVEsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEQsQ0FBQSxRQUFRLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3JDLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSyxDQUFDLENBQUM7O0FBRVAsQ0FBQSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQ2xCLENBQUEsTUFBTSxrQkFBa0IsRUFBRSxVQUFVLEtBQUssRUFBRTtBQUMzQyxDQUFBLFFBQVEsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUNsQyxDQUFBLFFBQVEsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUM7O0FBRXZDLENBQUEsUUFBUSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO0FBQzNCLENBQUEsVUFBVSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDMUIsQ0FBQSxVQUFVLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUEsU0FBUzs7QUFFVCxDQUFBLFFBQVEsSUFBSSxHQUFHLEdBQUcsR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDNUQsQ0FBQSxVQUFVLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQ3BELENBQUEsVUFBVSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUNwRCxDQUFBLFVBQVUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQzs7QUFFckQsQ0FBQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSyxDQUFDLENBQUM7QUFDUCxDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUMsQ0FBQyxDQUFDOztBQUVILEFBQU8sQ0FBQSxJQUFJLFdBQVcsR0FBRyxVQUFVLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0FBQzFELENBQUEsRUFBRSxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDaEQsQ0FBQSxDQUFDLENBQUMsQUFFRjs7Q0NyRE8sSUFBSSxPQUFPLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQzs7QUFFeEMsQ0FBQSxFQUFFLFVBQVUsRUFBRSxVQUFVLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0FBQy9DLENBQUEsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDdkUsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxXQUFXLEVBQUUsWUFBWTtBQUMzQixDQUFBLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEMsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxrQkFBa0IsRUFBRSxZQUFZO0FBQ2xDLENBQUEsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUNyQixDQUFBLE1BQU0sY0FBYyxFQUFFLFVBQVUsS0FBSyxFQUFFO0FBQ3ZDLENBQUEsUUFBUSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQ2xDLENBQUEsUUFBUSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQztBQUN2QyxDQUFBLFFBQVEsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQzs7QUFFNUIsQ0FBQSxRQUFRLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7QUFFeEIsQ0FBQSxRQUFRLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUN6RCxDQUFBLFFBQVEsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQ3pELENBQUEsUUFBUSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNyQyxDQUFBLE9BQU87QUFDUCxDQUFBLEtBQUssQ0FBQyxDQUFDOztBQUVQLENBQUEsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUNsQixDQUFBLE1BQU0sY0FBYyxFQUFFLFVBQVUsS0FBSyxFQUFFO0FBQ3ZDLENBQUEsUUFBUSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQ2xDLENBQUEsUUFBUSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQzs7QUFFdkMsQ0FBQSxRQUFRLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7QUFDM0IsQ0FBQSxVQUFVLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUMxQixDQUFBLFVBQVUsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsQ0FBQSxTQUFTOztBQUVULENBQUEsUUFBUSxJQUFJLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQ3ZFLENBQUEsVUFBVSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQy9ELENBQUEsVUFBVSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQy9ELENBQUEsVUFBVSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7O0FBRWhFLENBQUEsUUFBUSxJQUFJLENBQUMs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R0FBRyxFQUFFO0FBQzNCLENBQUEsVUFBVSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDMUIsQ0FBQSxVQUFVLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUEsU0FBUzs7QUFFVCxDQUFBLFFBQVEsSUFBSSxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUN2RSxDQUFBLFVBQVUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUMvRCxDQUFBLFVBQVUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUMvRCxDQUFBLFVBQVUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDOztBQUVoRSxDQUFBLFFBQVEsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQzs7QUFFaEQsQ0FBQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSyxDQUFDLENBQUM7QUFDUCxDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUMsQ0FBQyxDQUFDOztBQUVILEFBQU8sQ0FBQSxJQUFJLFlBQVksR0FBRyxVQUFVLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0FBQzNELENBQUEsRUFBRSxPQUFPLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDakQsQ0FBQSxDQUFDLENBQUMsQUFFRjs7Q0M1RE8sSUFBSSxhQUFhLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztBQUM5QyxDQUFBLEVBQUUsT0FBTyxFQUFFO0FBQ1gsQ0FBQSxJQUFJLElBQUksRUFBRSxJQUFJO0FBQ2QsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxVQUFVLEVBQUUsVUFBVSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtBQUMvQyxDQUFBLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZFLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsV0FBVyxFQUFFLFlBQVk7QUFDM0IsQ0FBQSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDOUMsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxrQkFBa0IsRUFBRSxZQUFZO0FBQ2xDLENBQUEsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUNyQixDQUFBLE1BQU0sb0JBQW9CLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDN0MsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDO0FBQ3ZDLENBQUEsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDOztBQUU1QixDQUFBLFFBQVEsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDOztBQUV4QixDQUFBLFFBQVEsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDaEQsQ0FBQSxRQUFRLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUEsUUFBUSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUNoRCxDQUFBLFFBQVEsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRWhELENBQUEsUUFBUSxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7O0FBRXhCLENBQUEsUUFBUSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNyQyxDQUFBLE9BQU87QUFDUCxDQUFBLEtBQUssQ0FBQyxDQUFDOztBQUVQLENBQUEsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUNsQixDQUFBLE1BQU0sb0JBQW9CLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDN0MsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDOztBQUV2QyxDQUFBLFFBQVEsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtBQUMzQixDQUFBLFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzFCLENBQUEsVUFBVSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxDQUFBLFNBQVM7O0FBRVQsQ0FBQSxRQUFRLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcs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QUFBLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQztBQUM3QyxDQUFBLElBQUksUUFBUSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQzs7QUFFL0MsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFB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