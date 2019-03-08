/* esri-leaflet-webmap - v0.4.0 - Fri Mar 08 2019 12:39:11 GMT-0500 (Eastern Standard Time)
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

	var parse$1 = require('../parse/index.js')
	var startOfYear = require('../start_of_year/index.js')
	var differenceInCalendarDays = require('../difference_in_calendar_days/index.js')

	/**
	 * @category Day Helpers
	 * @summary Get the day of the year of the given date.
	 *
	 * @description
	 * Get the day of the year of the given date.
	 *
	 * @param {Date|String|Number} date - the given date
	 * @returns {Number} the day of year
	 *
	 * @example
	 * // Which day of the year is 2 July 2014?
	 * var result = getDayOfYear(new Date(2014, 6, 2))
	 * //=> 183
	 */
	function getDayOfYear$1 (dirtyDate) {
	  var date = parse$1(dirtyDate)
	  var diff = differenceInCalendarDays(date, startOfYear(date))
	  var dayOfYear = diff + 1
	  return dayOfYear
	}

	module.exports = getDayOfYear$1

	var parse$2 = require('../parse/index.js')
	var startOfISOWeek = require('../start_of_iso_week/index.js')
	var startOfISOYear = require('../start_of_iso_year/index.js')

	var MILLISECONDS_IN_WEEK = 604800000

	/**
	 * @category ISO Week Helpers
	 * @summary Get the ISO week of the given date.
	 *
	 * @description
	 * Get the ISO week of the given date.
	 *
	 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
	 *
	 * @param {Date|String|Number} date - the given date
	 * @returns {Number} the ISO week
	 *
	 * @example
	 * // Which week of the ISO-week numbering year is 2 January 2005?
	 * var result = getISOWeek(new Date(2005, 0, 2))
	 * //=> 53
	 */
	function getISOWeek$1 (dirtyDate) {
	  var date = parse$2(dirtyDate)
	  var diff = startOfISOWeek(date).getTime() - startOfISOYear(date).getTime()

	  // Round the number of days to the nearest integer
	  // because the number of milliseconds in a week is not constant
	  // (e.g. it's different in the week of the daylight saving time clock shift)
	  return Math.round(diff / MILLISECONDS_IN_WEEK) + 1
	}

	module.exports = getISOWeek$1

	var parse$3 = require('../parse/index.js')
	var startOfISOWeek$1 = require('../start_of_iso_week/index.js')

	/**
	 * @category ISO Week-Numbering Year Helpers
	 * @summary Get the ISO week-numbering year of the given date.
	 *
	 * @description
	 * Get the ISO week-numbering year of the given date,
	 * which always starts 3 days before the year's first Thursday.
	 *
	 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
	 *
	 * @param {Date|String|Number} date - the given date
	 * @returns {Number} the ISO week-numbering year
	 *
	 * @example
	 * // Which ISO-week numbering year is 2 January 2005?
	 * var result = getISOYear(new Date(2005, 0, 2))
	 * //=> 2004
	 */
	function getISOYear$1 (dirtyDate) {
	  var date = parse$3(dirtyDate)
	  var year = date.getFullYear()

	  var fourthOfJanuaryOfNextYear = new Date(0)
	  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4)
	  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0)
	  var startOfNextYear = startOfISOWeek$1(fourthOfJanuaryOfNextYear)

	  var fourthOfJanuaryOfThisYear = new Date(0)
	  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4)
	  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0)
	  var startOfThisYear = startOfISOWeek$1(fourthOfJanuaryOfThisYear)

	  if (date.getTime() >= startOfNextYear.getTime()) {
	    return year + 1
	  } else if (date.getTime() >= startOfThisYear.getTime()) {
	    return year
	  } else {
	    return year - 1
	  }
	}

	module.exports = getISOYear$1

	var isDate = require('../is_date/index.js')

	/**
	 * @category Common Helpers
	 * @summary Is the given date valid?
	 *
	 * @description
	 * Returns false if argument is Invalid Date and true otherwise.
	 * Invalid Date is a Date, whose time value is NaN.
	 *
	 * Time value of Date: http://es5.github.io/#x15.9.1.1
	 *
	 * @param {Date} date - the date to check
	 * @returns {Boolean} the date is valid
	 * @throws {TypeError} argument must be an instance of Date
	 *
	 * @example
	 * // For the valid date:
	 * var result = isValid(new Date(2014, 1, 31))
	 * //=> true
	 *
	 * @example
	 * // For the invalid date:
	 * var result = isValid(new Date(''))
	 * //=> false
	 */
	function isValid$1 (dirtyDate) {
	  if (isDate(dirtyDate)) {
	    return !isNaN(dirtyDate)
	  } else {
	    throw new TypeError(toString.call(dirtyDate) + ' is not an instance of Date')
	  }
	}

	module.exports = isValid$1

	var buildDistanceInWordsLocale = require('./build_distance_in_words_locale/index.js')
	var buildFormatLocale = require('./build_format_locale/index.js')

	/**
	 * @category Locales
	 * @summary English locale.
	 */
	module.exports = {
	  distanceInWords: buildDistanceInWordsLocale(),
	  format: buildFormatLocale()
	}

	var getTimezoneOffsetInMilliseconds = require('../_lib/getTimezoneOffsetInMilliseconds/index.js')
	var isDate$1 = require('../is_date/index.js')

	var MILLISECONDS_IN_HOUR = 3600000
	var MILLISECONDS_IN_MINUTE = 60000
	var DEFAULT_ADDITIONAL_DIGITS = 2

	var parseTokenDateTimeDelimeter = /[T ]/
	var parseTokenPlainTime = /:/

	// year tokens
	var parseTokenYY = /^(\d{2})$/
	var parseTokensYYY = [
	  /^([+-]\d{2})$/, // 0 additional digits
	  /^([+-]\d{3})$/, // 1 additional digit
	  /^([+-]\d{4})$/ // 2 additional digits
	]

	var parseTokenYYYY = /^(\d{4})/
	var parseTokensYYYYY = [
	  /^([+-]\d{4})/, // 0 additional digits
	  /^([+-]\d{5})/, // 1 additional digit
	  /^([+-]\d{6})/ // 2 additional digits
	]

	// date tokens
	var parseTokenMM = /^-(\d{2})$/
	var parseTokenDDD = /^-?(\d{3})$/
	var parseTokenMMDD = /^-?(\d{2})-?(\d{2})$/
	var parseTokenWww = /^-?W(\d{2})$/
	var parseTokenWwwD = /^-?W(\d{2})-?(\d{1})$/

	// time tokens
	var parseTokenHH = /^(\d{2}([.,]\d*)?)$/
	var parseTokenHHMM = /^(\d{2}):?(\d{2}([.,]\d*)?)$/
	var parseTokenHHMMSS = /^(\d{2}):?(\d{2}):?(\d{2}([.,]\d*)?)$/

	// timezone tokens
	var parseTokenTimezone = /([Z+-].*)$/
	var parseTokenTimezoneZ = /^(Z)$/
	var parseTokenTimezoneHH = /^([+-])(\d{2})$/
	var parseTokenTimezoneHHMM = /^([+-])(\d{2}):?(\d{2})$/

	/**
	 * @category Common Helpers
	 * @summary Convert the given argument to an instance of Date.
	 *
	 * @description
	 * Convert the given argument to an instance of Date.
	 *
	 * If the argument is an instance of Date, the function returns its clone.
	 *
	 * If the argument is a number, it is treated as a timestamp.
	 *
	 * If an argument is a string, the function tries to parse it.
	 * Function accepts complete ISO 8601 formats as well as partial implementations.
	 * ISO 8601: http://en.wikipedia.org/wiki/ISO_8601
	 *
	 * If all above fails, the function passes the given argument to Date constructor.
	 *
	 * @param {Date|String|Number} argument - the value to convert
	 * @param {Object} [options] - the object with options
	 * @param {0 | 1 | 2} [options.additionalDigits=2] - the additional number of digits in the extended year format
	 * @returns {Date} the parsed date in the local time zone
	 *
	 * @example
	 * // Convert string '2014-02-11T11:30:30' to date:
	 * var result = parse('2014-02-11T11:30:30')
	 * //=> Tue Feb 11 2014 11:30:30
	 *
	 * @example
	 * // Parse string '+02014101',
	 * // if the additional number of digits in the extended year format is 1:
	 * var result = parse('+02014101', {additionalDigits: 1})
	 * //=> Fri Apr 11 2014 00:00:00
	 */
	function parse$4 (argument, dirtyOptions) {
	  if (isDate$1(argument)) {
	    // Prevent the date to lose the milliseconds when passed to new Date() in IE10
	    return new Date(argument.getTime())
	  } else if (typeof argument !== 'string') {
	    return new Date(argument)
	  }

	  var options = dirtyOptions || {}
	  var additionalDigits = options.additionalDigits
	  if (additionalDigits == null) {
	    additionalDigits = DEFAULT_ADDITIONAL_DIGITS
	  } else {
	    additionalDigits = Number(additionalDigits)
	  }

	  var dateStrings = splitDateString(argument)

	  var parseYearResult = parseYear(dateStrings.date, additionalDigits)
	  var year = parseYearResult.year
	  var restDateString = parseYearResult.restDateString

	  var date = parseDate(restDateString, year)

	  if (date) {
	    var timestamp = date.getTime()
	    var time = 0
	    var offset

	    if (dateStrings.time) {
	      time = parseTime(dateStrings.time)
	    }

	    if (dateStrings.timezone) {
	      offset = parseTimezone(dateStrings.timezone) * MILLISECONDS_IN_MINUTE
	    } else {
	      var fullTime = timestamp + time
	      var fullTimeDate = new Date(fullTime)

	      offset = getTimezoneOffsetInMilliseconds(fullTimeDate)

	      // Adjust time when it's coming from DST
	      var fullTimeDateNextDay = new Date(fullTime)
	      fullTimeDateNextDay.setDate(fullTimeDate.getDate() + 1)
	      var offsetDiff =
	        getTimezoneOffsetInMilliseconds(fullTimeDateNextDay) -
	        getTimezoneOffsetInMilliseconds(fullTimeDate)
	      if (offsetDiff > 0) {
	        offset += offsetDiff
	      }
	    }

	    return new Date(timestamp + time + offset)
	  } else {
	    return new Date(argument)
	  }
	}

	function splitDateString (dateString) {
	  var dateStrings = {}
	  var array = dateString.split(parseTokenDateTimeDelimeter)
	  var timeString

	  if (parseTokenPlainTime.test(array[0])) {
	    dateStrings.date = null
	    timeString = array[0]
	  } else {
	    dateStrings.date = array[0]
	    timeString = array[1]
	  }

	  if (timeString) {
	    var token = parseTokenTimezone.exec(timeString)
	    if (token) {
	      dateStrings.time = timeString.replace(token[1], '')
	      dateStrings.timezone = token[1]
	    } else {
	      dateStrings.time = timeString
	    }
	  }

	  return dateStrings
	}

	function parseYear (dateString, additionalDigits) {
	  var parseTokenYYY = parseTokensYYY[additionalDigits]
	  var parseTokenYYYYY = parseTokensYYYYY[additionalDigits]

	  var token

	  // YYYY or ±YYYYY
	  token = parseTokenYYYY.exec(dateString) || parseTokenYYYYY.exec(dateString)
	  if (token) {
	    var yearString = token[1]
	    return {
	      year: parseInt(yearString, 10),
	      restDateString: dateString.slice(yearString.length)
	    }
	  }

	  // YY or ±YYY
	  token = parseTokenYY.exec(dateString) || parseTokenYYY.exec(dateString)
	  if (token) {
	    var centuryString = token[1]
	    return {
	      year: parseInt(centuryString, 10) * 100,
	      restDateString: dateString.slice(centuryString.length)
	    }
	  }

	  // Invalid ISO-formatted year
	  return {
	    year: null
	  }
	}

	function parseDate (dateString, year) {
	  // Invalid ISO-formatted year
	  if (year === null) {
	    return null
	  }

	  var token
	  var date
	  var month
	  var week

	  // YYYY
	  if (dateString.length === 0) {
	    date = new Date(0)
	    date.setUTCFullYear(year)
	    return date
	  }

	  // YYYY-MM
	  token = parseTokenMM.exec(dateString)
	  if (token) {
	    date = new Date(0)
	    month = parseInt(token[1], 10) - 1
	    date.setUTCFullYear(year, month)
	    return date
	  }

	  // YYYY-DDD or YYYYDDD
	  token = parseTokenDDD.exec(dateString)
	  if (token) {
	    date = new Date(0)
	    var dayOfYear = parseInt(token[1], 10)
	    date.setUTCFullYear(year, 0, dayOfYear)
	    return date
	  }

	  // YYYY-MM-DD or YYYYMMDD
	  token = parseTokenMMDD.exec(dateString)
	  if (token) {
	    date = new Date(0)
	    month = parseInt(token[1], 10) - 1
	    var day = parseInt(token[2], 10)
	    date.setUTCFullYear(year, month, day)
	    return date
	  }

	  // YYYY-Www or YYYYWww
	  token = parseTokenWww.exec(dateString)
	  if (token) {
	    week = parseInt(token[1], 10) - 1
	    return dayOfISOYear(year, week)
	  }

	  // YYYY-Www-D or YYYYWwwD
	  token = parseTokenWwwD.exec(dateString)
	  if (token) {
	    week = parseInt(token[1], 10) - 1
	    var dayOfWeek = parseInt(token[2], 10) - 1
	    return dayOfISOYear(year, week, dayOfWeek)
	  }

	  // Invalid ISO-formatted date
	  return null
	}

	function parseTime (timeString) {
	  var token
	  var hours
	  var minutes

	  // hh
	  token = parseTokenHH.exec(timeString)
	  if (token) {
	    hours = parseFloat(token[1].replace(',', '.'))
	    return (hours % 24) * MILLISECONDS_IN_HOUR
	  }

	  // hh:mm or hhmm
	  token = parseTokenHHMM.exec(timeString)
	  if (token) {
	    hours = parseInt(token[1], 10)
	    minutes = parseFloat(token[2].replace(',', '.'))
	    return (hours % 24) * MILLISECONDS_IN_HOUR +
	      minutes * MILLISECONDS_IN_MINUTE
	  }

	  // hh:mm:ss or hhmmss
	  token = parseTokenHHMMSS.exec(timeString)
	  if (token) {
	    hours = parseInt(token[1], 10)
	    minutes = parseInt(token[2], 10)
	    var seconds = parseFloat(token[3].replace(',', '.'))
	    return (hours % 24) * MILLISECONDS_IN_HOUR +
	      minutes * MILLISECONDS_IN_MINUTE +
	      seconds * 1000
	  }

	  // Invalid ISO-formatted time
	  return null
	}

	function parseTimezone (timezoneString) {
	  var token
	  var absoluteOffset

	  // Z
	  token = parseTokenTimezoneZ.exec(timezoneString)
	  if (token) {
	    return 0
	  }

	  // ±hh
	  token = parseTokenTimezoneHH.exec(timezoneString)
	  if (token) {
	    absoluteOffset = parseInt(token[2], 10) * 60
	    return (token[1] === '+') ? -absoluteOffset : absoluteOffset
	  }

	  // ±hh:mm or ±hhmm
	  token = parseTokenTimezoneHHMM.exec(timezoneString)
	  if (token) {
	    absoluteOffset = parseInt(token[2], 10) * 60 + parseInt(token[3], 10)
	    return (token[1] === '+') ? -absoluteOffset : absoluteOffset
	  }

	  return 0
	}

	function dayOfISOYear (isoYear, week, day) {
	  week = week || 0
	  day = day || 0
	  var date = new Date(0)
	  date.setUTCFullYear(isoYear, 0, 4)
	  var fourthOfJanuaryDay = date.getUTCDay() || 7
	  var diff = week * 7 + day + 1 - fourthOfJanuaryDay
	  date.setUTCDate(date.getUTCDate() + diff)
	  return date
	}

	module.exports = parse$4

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9hcmNnaXMtdG8tZ2VvanNvbi11dGlscy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1N5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZWFmbGV0LXNoYXBlLW1hcmtlcnMvc3JjL1NoYXBlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvQ3Jvc3NNYXJrZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvbGVhZmxldC1zaGFwZS1tYXJrZXJzL3NyYy9YTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvU3F1YXJlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvRGlhbW9uZE1hcmtlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvaW50U3ltYm9sLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1N5bWJvbHMvTGluZVN5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvbHlnb25TeW1ib2wuanMiLCIuLi9ub2RlX21vZHVsZXMvZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9VbmlxdWVWYWx1ZVJlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9SZW5kZXJlci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9GZWF0dXJlQ29sbGVjdGlvbi5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9DU1ZMYXllci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9LTUxMYXllci5qcyIsIi4uL3NyYy9MYWJlbC9MYWJlbEljb24uanMiLCIuLi9zcmMvTGFiZWwvTGFiZWxNYXJrZXIuanMiLCIuLi9zcmMvTGFiZWwvUG9pbnRMYWJlbC5qcyIsIi4uL3NyYy9MYWJlbC9Qb2x5bGluZUxhYmVsLmpzIiwiLi4vc3JjL0xhYmVsL1BvbHlnb25MYWJlbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9mb3JtYXQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZ2V0X2RheV9vZl95ZWFyL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2dldF9pc29fd2Vlay9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9nZXRfaXNvX3llYXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvaXNfdmFsaWQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvbG9jYWxlL2VuL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL3BhcnNlL2luZGV4LmpzIiwiLi4vc3JjL1BvcHVwL1BvcHVwLmpzIiwiLi4vc3JjL09wZXJhdGlvbmFsTGF5ZXIuanMiLCIuLi9zcmMvV2ViTWFwTG9hZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBDb3B5cmlnaHQgMjAxNyBFc3JpXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbi8vIGNoZWNrcyBpZiAyIHgseSBwb2ludHMgYXJlIGVxdWFsXG5mdW5jdGlvbiBwb2ludHNFcXVhbCAoYSwgYikge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gY2hlY2tzIGlmIHRoZSBmaXJzdCBhbmQgbGFzdCBwb2ludHMgb2YgYSByaW5nIGFyZSBlcXVhbCBhbmQgY2xvc2VzIHRoZSByaW5nXG5mdW5jdGlvbiBjbG9zZVJpbmcgKGNvb3JkaW5hdGVzKSB7XG4gIGlmICghcG9pbnRzRXF1YWwoY29vcmRpbmF0ZXNbMF0sIGNvb3JkaW5hdGVzW2Nvb3JkaW5hdGVzLmxlbmd0aCAtIDFdKSkge1xuICAgIGNvb3JkaW5hdGVzLnB1c2goY29vcmRpbmF0ZXNbMF0pO1xuICB9XG4gIHJldHVybiBjb29yZGluYXRlcztcbn1cblxuLy8gZGV0ZXJtaW5lIGlmIHBvbHlnb24gcmluZyBjb29yZGluYXRlcyBhcmUgY2xvY2t3aXNlLiBjbG9ja3dpc2Ugc2lnbmlmaWVzIG91dGVyIHJpbmcsIGNvdW50ZXItY2xvY2t3aXNlIGFuIGlubmVyIHJpbmdcbi8vIG9yIGhvbGUuIHRoaXMgbG9naWMgd2FzIGZvdW5kIGF0IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTE2NTY0Ny9ob3ctdG8tZGV0ZXJtaW5lLWlmLWEtbGlzdC1vZi1wb2x5Z29uLVxuLy8gcG9pbnRzLWFyZS1pbi1jbG9ja3dpc2Utb3JkZXJcbmZ1bmN0aW9uIHJpbmdJc0Nsb2Nrd2lzZSAocmluZ1RvVGVzdCkge1xuICB2YXIgdG90YWwgPSAwO1xuICB2YXIgaSA9IDA7XG4gIHZhciByTGVuZ3RoID0gcmluZ1RvVGVzdC5sZW5ndGg7XG4gIHZhciBwdDEgPSByaW5nVG9UZXN0W2ldO1xuICB2YXIgcHQyO1xuICBmb3IgKGk7IGkgPCByTGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgcHQyID0gcmluZ1RvVGVzdFtpICsgMV07XG4gICAgdG90YWwgKz0gKHB0MlswXSAtIHB0MVswXSkgKiAocHQyWzFdICsgcHQxWzFdKTtcbiAgICBwdDEgPSBwdDI7XG4gIH1cbiAgcmV0dXJuICh0b3RhbCA+PSAwKTtcbn1cblxuLy8gcG9ydGVkIGZyb20gdGVycmFmb3JtZXIuanMgaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvVGVycmFmb3JtZXIvYmxvYi9tYXN0ZXIvdGVycmFmb3JtZXIuanMjTDUwNC1MNTE5XG5mdW5jdGlvbiB2ZXJ0ZXhJbnRlcnNlY3RzVmVydGV4IChhMSwgYTIsIGIxLCBiMikge1xuICB2YXIgdWFUID0gKChiMlswXSAtIGIxWzBdKSAqIChhMVsxXSAtIGIxWzFdKSkgLSAoKGIyWzFdIC0gYjFbMV0pICogKGExWzBdIC0gYjFbMF0pKTtcbiAgdmFyIHViVCA9ICgoYTJbMF0gLSBhMVswXSkgKiAoYTFbMV0gLSBiMVsxXSkpIC0gKChhMlsxXSAtIGExWzFdKSAqIChhMVswXSAtIGIxWzBdKSk7XG4gIHZhciB1QiA9ICgoYjJbMV0gLSBiMVsxXSkgKiAoYTJbMF0gLSBhMVswXSkpIC0gKChiMlswXSAtIGIxWzBdKSAqIChhMlsxXSAtIGExWzFdKSk7XG5cbiAgaWYgKHVCICE9PSAwKSB7XG4gICAgdmFyIHVhID0gdWFUIC8gdUI7XG4gICAgdmFyIHViID0gdWJUIC8gdUI7XG5cbiAgICBpZiAodWEgPj0gMCAmJiB1YSA8PSAxICYmIHViID49IDAgJiYgdWIgPD0gMSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBwb3J0ZWQgZnJvbSB0ZXJyYWZvcm1lci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9UZXJyYWZvcm1lci9ibG9iL21hc3Rlci90ZXJyYWZvcm1lci5qcyNMNTIxLUw1MzFcbmZ1bmN0aW9uIGFycmF5SW50ZXJzZWN0c0FycmF5IChhLCBiKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGggLSAxOyBpKyspIHtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGIubGVuZ3RoIC0gMTsgaisrKSB7XG4gICAgICBpZiAodmVydGV4SW50ZXJzZWN0c1ZlcnRleChhW2ldLCBhW2kgKyAxXSwgYltqXSwgYltqICsgMV0pKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuLy8gcG9ydGVkIGZyb20gdGVycmFmb3JtZXIuanMgaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvVGVycmFmb3JtZXIvYmxvYi9tYXN0ZXIvdGVycmFmb3JtZXIuanMjTDQ3MC1MNDgwXG5mdW5jdGlvbiBjb29yZGluYXRlc0NvbnRhaW5Qb2ludCAoY29vcmRpbmF0ZXMsIHBvaW50KSB7XG4gIHZhciBjb250YWlucyA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gLTEsIGwgPSBjb29yZGluYXRlcy5sZW5ndGgsIGogPSBsIC0gMTsgKytpIDwgbDsgaiA9IGkpIHtcbiAgICBpZiAoKChjb29yZGluYXRlc1tpXVsxXSA8PSBwb2ludFsxXSAmJiBwb2ludFsxXSA8IGNvb3JkaW5hdGVzW2pdWzFdKSB8fFxuICAgICAgICAgKGNvb3JkaW5hdGVzW2pdWzFdIDw9IHBvaW50WzFdICYmIHBvaW50WzFdIDwgY29vcmRpbmF0ZXNbaV1bMV0pKSAmJlxuICAgICAgICAocG9pbnRbMF0gPCAoKChjb29yZGluYXRlc1tqXVswXSAtIGNvb3JkaW5hdGVzW2ldWzBdKSAqIChwb2ludFsxXSAtIGNvb3JkaW5hdGVzW2ldWzFdKSkgLyAoY29vcmRpbmF0ZXNbal1bMV0gLSBjb29yZGluYXRlc1tpXVsxXSkpICsgY29vcmRpbmF0ZXNbaV1bMF0pKSB7XG4gICAgICBjb250YWlucyA9ICFjb250YWlucztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbnRhaW5zO1xufVxuXG4vLyBwb3J0ZWQgZnJvbSB0ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyLmpzIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL3RlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIvYmxvYi9tYXN0ZXIvdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci5qcyNMMTA2LUwxMTNcbmZ1bmN0aW9uIGNvb3JkaW5hdGVzQ29udGFpbkNvb3JkaW5hdGVzIChvdXRlciwgaW5uZXIpIHtcbiAgdmFyIGludGVyc2VjdHMgPSBhcnJheUludGVyc2VjdHNBcnJheShvdXRlciwgaW5uZXIpO1xuICB2YXIgY29udGFpbnMgPSBjb29yZGluYXRlc0NvbnRhaW5Qb2ludChvdXRlciwgaW5uZXJbMF0pO1xuICBpZiAoIWludGVyc2VjdHMgJiYgY29udGFpbnMpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIGRvIGFueSBwb2x5Z29ucyBpbiB0aGlzIGFycmF5IGNvbnRhaW4gYW55IG90aGVyIHBvbHlnb25zIGluIHRoaXMgYXJyYXk/XG4vLyB1c2VkIGZvciBjaGVja2luZyBmb3IgaG9sZXMgaW4gYXJjZ2lzIHJpbmdzXG4vLyBwb3J0ZWQgZnJvbSB0ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyLmpzIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL3RlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIvYmxvYi9tYXN0ZXIvdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci5qcyNMMTE3LUwxNzJcbmZ1bmN0aW9uIGNvbnZlcnRSaW5nc1RvR2VvSlNPTiAocmluZ3MpIHtcbiAgdmFyIG91dGVyUmluZ3MgPSBbXTtcbiAgdmFyIGhvbGVzID0gW107XG4gIHZhciB4OyAvLyBpdGVyYXRvclxuICB2YXIgb3V0ZXJSaW5nOyAvLyBjdXJyZW50IG91dGVyIHJpbmcgYmVpbmcgZXZhbHVhdGVkXG4gIHZhciBob2xlOyAvLyBjdXJyZW50IGhvbGUgYmVpbmcgZXZhbHVhdGVkXG5cbiAgLy8gZm9yIGVhY2ggcmluZ1xuICBmb3IgKHZhciByID0gMDsgciA8IHJpbmdzLmxlbmd0aDsgcisrKSB7XG4gICAgdmFyIHJpbmcgPSBjbG9zZVJpbmcocmluZ3Nbcl0uc2xpY2UoMCkpO1xuICAgIGlmIChyaW5nLmxlbmd0aCA8IDQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBpcyB0aGlzIHJpbmcgYW4gb3V0ZXIgcmluZz8gaXMgaXQgY2xvY2t3aXNlP1xuICAgIGlmIChyaW5nSXNDbG9ja3dpc2UocmluZykpIHtcbiAgICAgIHZhciBwb2x5Z29uID0gWyByaW5nIF07XG4gICAgICBvdXRlclJpbmdzLnB1c2gocG9seWdvbik7IC8vIHB1c2ggdG8gb3V0ZXIgcmluZ3NcbiAgICB9IGVsc2Uge1xuICAgICAgaG9sZXMucHVzaChyaW5nKTsgLy8gY291bnRlcmNsb2Nrd2lzZSBwdXNoIHRvIGhvbGVzXG4gICAgfVxuICB9XG5cbiAgdmFyIHVuY29udGFpbmVkSG9sZXMgPSBbXTtcblxuICAvLyB3aGlsZSB0aGVyZSBhcmUgaG9sZXMgbGVmdC4uLlxuICB3aGlsZSAoaG9sZXMubGVuZ3RoKSB7XG4gICAgLy8gcG9wIGEgaG9sZSBvZmYgb3V0IHN0YWNrXG4gICAgaG9sZSA9IGhvbGVzLnBvcCgpO1xuXG4gICAgLy8gbG9vcCBvdmVyIGFsbCBvdXRlciByaW5ncyBhbmQgc2VlIGlmIHRoZXkgY29udGFpbiBvdXIgaG9sZS5cbiAgICB2YXIgY29udGFpbmVkID0gZmFsc2U7XG4gICAgZm9yICh4ID0gb3V0ZXJSaW5ncy5sZW5ndGggLSAxOyB4ID49IDA7IHgtLSkge1xuICAgICAgb3V0ZXJSaW5nID0gb3V0ZXJSaW5nc1t4XVswXTtcbiAgICAgIGlmIChjb29yZGluYXRlc0NvbnRhaW5Db29yZGluYXRlcyhvdXRlclJpbmcsIGhvbGUpKSB7XG4gICAgICAgIC8vIHRoZSBob2xlIGlzIGNvbnRhaW5lZCBwdXNoIGl0IGludG8gb3VyIHBvbHlnb25cbiAgICAgICAgb3V0ZXJSaW5nc1t4XS5wdXNoKGhvbGUpO1xuICAgICAgICBjb250YWluZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByaW5nIGlzIG5vdCBjb250YWluZWQgaW4gYW55IG91dGVyIHJpbmdcbiAgICAvLyBzb21ldGltZXMgdGhpcyBoYXBwZW5zIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL2VzcmktbGVhZmxldC9pc3N1ZXMvMzIwXG4gICAgaWYgKCFjb250YWluZWQpIHtcbiAgICAgIHVuY29udGFpbmVkSG9sZXMucHVzaChob2xlKTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB3ZSBjb3VsZG4ndCBtYXRjaCBhbnkgaG9sZXMgdXNpbmcgY29udGFpbnMgd2UgY2FuIHRyeSBpbnRlcnNlY3RzLi4uXG4gIHdoaWxlICh1bmNvbnRhaW5lZEhvbGVzLmxlbmd0aCkge1xuICAgIC8vIHBvcCBhIGhvbGUgb2ZmIG91dCBzdGFja1xuICAgIGhvbGUgPSB1bmNvbnRhaW5lZEhvbGVzLnBvcCgpO1xuXG4gICAgLy8gbG9vcCBvdmVyIGFsbCBvdXRlciByaW5ncyBhbmQgc2VlIGlmIGFueSBpbnRlcnNlY3Qgb3VyIGhvbGUuXG4gICAgdmFyIGludGVyc2VjdHMgPSBmYWxzZTtcblxuICAgIGZvciAoeCA9IG91dGVyUmluZ3MubGVuZ3RoIC0gMTsgeCA+PSAwOyB4LS0pIHtcbiAgICAgIG91dGVyUmluZyA9IG91dGVyUmluZ3NbeF1bMF07XG4gICAgICBpZiAoYXJyYXlJbnRlcnNlY3RzQXJyYXkob3V0ZXJSaW5nLCBob2xlKSkge1xuICAgICAgICAvLyB0aGUgaG9sZSBpcyBjb250YWluZWQgcHVzaCBpdCBpbnRvIG91ciBwb2x5Z29uXG4gICAgICAgIG91dGVyUmluZ3NbeF0ucHVzaChob2xlKTtcbiAgICAgICAgaW50ZXJzZWN0cyA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW50ZXJzZWN0cykge1xuICAgICAgb3V0ZXJSaW5ncy5wdXNoKFtob2xlLnJldmVyc2UoKV0pO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvdXRlclJpbmdzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnUG9seWdvbicsXG4gICAgICBjb29yZGluYXRlczogb3V0ZXJSaW5nc1swXVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdNdWx0aVBvbHlnb24nLFxuICAgICAgY29vcmRpbmF0ZXM6IG91dGVyUmluZ3NcbiAgICB9O1xuICB9XG59XG5cbi8vIFRoaXMgZnVuY3Rpb24gZW5zdXJlcyB0aGF0IHJpbmdzIGFyZSBvcmllbnRlZCBpbiB0aGUgcmlnaHQgZGlyZWN0aW9uc1xuLy8gb3V0ZXIgcmluZ3MgYXJlIGNsb2Nrd2lzZSwgaG9sZXMgYXJlIGNvdW50ZXJjbG9ja3dpc2Vcbi8vIHVzZWQgZm9yIGNvbnZlcnRpbmcgR2VvSlNPTiBQb2x5Z29ucyB0byBBcmNHSVMgUG9seWdvbnNcbmZ1bmN0aW9uIG9yaWVudFJpbmdzIChwb2x5KSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgdmFyIHBvbHlnb24gPSBwb2x5LnNsaWNlKDApO1xuICB2YXIgb3V0ZXJSaW5nID0gY2xvc2VSaW5nKHBvbHlnb24uc2hpZnQoKS5zbGljZSgwKSk7XG4gIGlmIChvdXRlclJpbmcubGVuZ3RoID49IDQpIHtcbiAgICBpZiAoIXJpbmdJc0Nsb2Nrd2lzZShvdXRlclJpbmcpKSB7XG4gICAgICBvdXRlclJpbmcucmV2ZXJzZSgpO1xuICAgIH1cblxuICAgIG91dHB1dC5wdXNoKG91dGVyUmluZyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvbHlnb24ubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBob2xlID0gY2xvc2VSaW5nKHBvbHlnb25baV0uc2xpY2UoMCkpO1xuICAgICAgaWYgKGhvbGUubGVuZ3RoID49IDQpIHtcbiAgICAgICAgaWYgKHJpbmdJc0Nsb2Nrd2lzZShob2xlKSkge1xuICAgICAgICAgIGhvbGUucmV2ZXJzZSgpO1xuICAgICAgICB9XG4gICAgICAgIG91dHB1dC5wdXNoKGhvbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbi8vIFRoaXMgZnVuY3Rpb24gZmxhdHRlbnMgaG9sZXMgaW4gbXVsdGlwb2x5Z29ucyB0byBvbmUgYXJyYXkgb2YgcG9seWdvbnNcbi8vIHVzZWQgZm9yIGNvbnZlcnRpbmcgR2VvSlNPTiBQb2x5Z29ucyB0byBBcmNHSVMgUG9seWdvbnNcbmZ1bmN0aW9uIGZsYXR0ZW5NdWx0aVBvbHlnb25SaW5ncyAocmluZ3MpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHJpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHBvbHlnb24gPSBvcmllbnRSaW5ncyhyaW5nc1tpXSk7XG4gICAgZm9yICh2YXIgeCA9IHBvbHlnb24ubGVuZ3RoIC0gMTsgeCA+PSAwOyB4LS0pIHtcbiAgICAgIHZhciByaW5nID0gcG9seWdvblt4XS5zbGljZSgwKTtcbiAgICAgIG91dHB1dC5wdXNoKHJpbmcpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufVxuXG4vLyBzaGFsbG93IG9iamVjdCBjbG9uZSBmb3IgZmVhdHVyZSBwcm9wZXJ0aWVzIGFuZCBhdHRyaWJ1dGVzXG4vLyBmcm9tIGh0dHA6Ly9qc3BlcmYuY29tL2Nsb25pbmctYW4tb2JqZWN0LzJcbmZ1bmN0aW9uIHNoYWxsb3dDbG9uZSAob2JqKSB7XG4gIHZhciB0YXJnZXQgPSB7fTtcbiAgZm9yICh2YXIgaSBpbiBvYmopIHtcbiAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICB0YXJnZXRbaV0gPSBvYmpbaV07XG4gICAgfVxuICB9XG4gIHJldHVybiB0YXJnZXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcmNnaXNUb0dlb0pTT04gKGFyY2dpcywgaWRBdHRyaWJ1dGUpIHtcbiAgdmFyIGdlb2pzb24gPSB7fTtcblxuICBpZiAodHlwZW9mIGFyY2dpcy54ID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgYXJjZ2lzLnkgPT09ICdudW1iZXInKSB7XG4gICAgZ2VvanNvbi50eXBlID0gJ1BvaW50JztcbiAgICBnZW9qc29uLmNvb3JkaW5hdGVzID0gW2FyY2dpcy54LCBhcmNnaXMueV07XG4gIH1cblxuICBpZiAoYXJjZ2lzLnBvaW50cykge1xuICAgIGdlb2pzb24udHlwZSA9ICdNdWx0aVBvaW50JztcbiAgICBnZW9qc29uLmNvb3JkaW5hdGVzID0gYXJjZ2lzLnBvaW50cy5zbGljZSgwKTtcbiAgfVxuXG4gIGlmIChhcmNnaXMucGF0aHMpIHtcbiAgICBpZiAoYXJjZ2lzLnBhdGhzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgZ2VvanNvbi50eXBlID0gJ0xpbmVTdHJpbmcnO1xuICAgICAgZ2VvanNvbi5jb29yZGluYXRlcyA9IGFyY2dpcy5wYXRoc1swXS5zbGljZSgwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2VvanNvbi50eXBlID0gJ011bHRpTGluZVN0cmluZyc7XG4gICAgICBnZW9qc29uLmNvb3JkaW5hdGVzID0gYXJjZ2lzLnBhdGhzLnNsaWNlKDApO1xuICAgIH1cbiAgfVxuXG4gIGlmIChhcmNnaXMucmluZ3MpIHtcbiAgICBnZW9qc29uID0gY29udmVydFJpbmdzVG9HZW9KU09OKGFyY2dpcy5yaW5ncy5zbGljZSgwKSk7XG4gIH1cblxuICBpZiAoYXJjZ2lzLmdlb21ldHJ5IHx8IGFyY2dpcy5hdHRyaWJ1dGVzKSB7XG4gICAgZ2VvanNvbi50eXBlID0gJ0ZlYXR1cmUnO1xuICAgIGdlb2pzb24uZ2VvbWV0cnkgPSAoYXJjZ2lzLmdlb21ldHJ5KSA/IGFyY2dpc1RvR2VvSlNPTihhcmNnaXMuZ2VvbWV0cnkpIDogbnVsbDtcbiAgICBnZW9qc29uLnByb3BlcnRpZXMgPSAoYXJjZ2lzLmF0dHJpYnV0ZXMpID8gc2hhbGxvd0Nsb25lKGFyY2dpcy5hdHRyaWJ1dGVzKSA6IG51bGw7XG4gICAgaWYgKGFyY2dpcy5hdHRyaWJ1dGVzKSB7XG4gICAgICBnZW9qc29uLmlkID0gYXJjZ2lzLmF0dHJpYnV0ZXNbaWRBdHRyaWJ1dGVdIHx8IGFyY2dpcy5hdHRyaWJ1dGVzLk9CSkVDVElEIHx8IGFyY2dpcy5hdHRyaWJ1dGVzLkZJRDtcbiAgICB9XG4gIH1cblxuICAvLyBpZiBubyB2YWxpZCBnZW9tZXRyeSB3YXMgZW5jb3VudGVyZWRcbiAgaWYgKEpTT04uc3RyaW5naWZ5KGdlb2pzb24uZ2VvbWV0cnkpID09PSBKU09OLnN0cmluZ2lmeSh7fSkpIHtcbiAgICBnZW9qc29uLmdlb21ldHJ5ID0gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBnZW9qc29uO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VvanNvblRvQXJjR0lTIChnZW9qc29uLCBpZEF0dHJpYnV0ZSkge1xuICBpZEF0dHJpYnV0ZSA9IGlkQXR0cmlidXRlIHx8ICdPQkpFQ1RJRCc7XG4gIHZhciBzcGF0aWFsUmVmZXJlbmNlID0geyB3a2lkOiA0MzI2IH07XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgdmFyIGk7XG5cbiAgc3dpdGNoIChnZW9qc29uLnR5cGUpIHtcbiAgICBjYXNlICdQb2ludCc6XG4gICAgICByZXN1bHQueCA9IGdlb2pzb24uY29vcmRpbmF0ZXNbMF07XG4gICAgICByZXN1bHQueSA9IGdlb2pzb24uY29vcmRpbmF0ZXNbMV07XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdNdWx0aVBvaW50JzpcbiAgICAgIHJlc3VsdC5wb2ludHMgPSBnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApO1xuICAgICAgcmVzdWx0LnNwYXRpYWxSZWZlcmVuY2UgPSBzcGF0aWFsUmVmZXJlbmNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnTGluZVN0cmluZyc6XG4gICAgICByZXN1bHQucGF0aHMgPSBbZ2VvanNvbi5jb29yZGluYXRlcy5zbGljZSgwKV07XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdNdWx0aUxpbmVTdHJpbmcnOlxuICAgICAgcmVzdWx0LnBhdGhzID0gZ2VvanNvbi5jb29yZGluYXRlcy5zbGljZSgwKTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1BvbHlnb24nOlxuICAgICAgcmVzdWx0LnJpbmdzID0gb3JpZW50UmluZ3MoZ2VvanNvbi5jb29yZGluYXRlcy5zbGljZSgwKSk7XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdNdWx0aVBvbHlnb24nOlxuICAgICAgcmVzdWx0LnJpbmdzID0gZmxhdHRlbk11bHRpUG9seWdvblJpbmdzKGdlb2pzb24uY29vcmRpbmF0ZXMuc2xpY2UoMCkpO1xuICAgICAgcmVzdWx0LnNwYXRpYWxSZWZlcmVuY2UgPSBzcGF0aWFsUmVmZXJlbmNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnRmVhdHVyZSc6XG4gICAgICBpZiAoZ2VvanNvbi5nZW9tZXRyeSkge1xuICAgICAgICByZXN1bHQuZ2VvbWV0cnkgPSBnZW9qc29uVG9BcmNHSVMoZ2VvanNvbi5nZW9tZXRyeSwgaWRBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgICAgcmVzdWx0LmF0dHJpYnV0ZXMgPSAoZ2VvanNvbi5wcm9wZXJ0aWVzKSA/IHNoYWxsb3dDbG9uZShnZW9qc29uLnByb3BlcnRpZXMpIDoge307XG4gICAgICBpZiAoZ2VvanNvbi5pZCkge1xuICAgICAgICByZXN1bHQuYXR0cmlidXRlc1tpZEF0dHJpYnV0ZV0gPSBnZW9qc29uLmlkO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnRmVhdHVyZUNvbGxlY3Rpb24nOlxuICAgICAgcmVzdWx0ID0gW107XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgZ2VvanNvbi5mZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXN1bHQucHVzaChnZW9qc29uVG9BcmNHSVMoZ2VvanNvbi5mZWF0dXJlc1tpXSwgaWRBdHRyaWJ1dGUpKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0dlb21ldHJ5Q29sbGVjdGlvbic6XG4gICAgICByZXN1bHQgPSBbXTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBnZW9qc29uLmdlb21ldHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZ2VvanNvblRvQXJjR0lTKGdlb2pzb24uZ2VvbWV0cmllc1tpXSwgaWRBdHRyaWJ1dGUpKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBhcmNnaXNUb0dlb0pTT04sIGdlb2pzb25Ub0FyY0dJUyB9O1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5cbmV4cG9ydCB2YXIgU3ltYm9sID0gTC5DbGFzcy5leHRlbmQoe1xuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICAgIHRoaXMuX3N5bWJvbEpzb24gPSBzeW1ib2xKc29uO1xuICAgIHRoaXMudmFsID0gbnVsbDtcbiAgICB0aGlzLl9zdHlsZXMgPSB7fTtcbiAgICB0aGlzLl9pc0RlZmF1bHQgPSBmYWxzZTtcbiAgICB0aGlzLl9sYXllclRyYW5zcGFyZW5jeSA9IDE7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5sYXllclRyYW5zcGFyZW5jeSkge1xuICAgICAgdGhpcy5fbGF5ZXJUcmFuc3BhcmVuY3kgPSAxIC0gKG9wdGlvbnMubGF5ZXJUcmFuc3BhcmVuY3kgLyAxMDAuMCk7XG4gICAgfVxuICB9LFxuXG4gIC8vIHRoZSBnZW9qc29uIHZhbHVlcyByZXR1cm5lZCBhcmUgaW4gcG9pbnRzXG4gIHBpeGVsVmFsdWU6IGZ1bmN0aW9uIChwb2ludFZhbHVlKSB7XG4gICAgcmV0dXJuIHBvaW50VmFsdWUgKiAxLjMzMztcbiAgfSxcblxuICAvLyBjb2xvciBpcyBhbiBhcnJheSBbcixnLGIsYV1cbiAgY29sb3JWYWx1ZTogZnVuY3Rpb24gKGNvbG9yKSB7XG4gICAgcmV0dXJuICdyZ2IoJyArIGNvbG9yWzBdICsgJywnICsgY29sb3JbMV0gKyAnLCcgKyBjb2xvclsyXSArICcpJztcbiAgfSxcblxuICBhbHBoYVZhbHVlOiBmdW5jdGlvbiAoY29sb3IpIHtcbiAgICB2YXIgYWxwaGEgPSBjb2xvclszXSAvIDI1NS4wO1xuICAgIHJldHVybiBhbHBoYSAqIHRoaXMuX2xheWVyVHJhbnNwYXJlbmN5O1xuICB9LFxuXG4gIGdldFNpemU6IGZ1bmN0aW9uIChmZWF0dXJlLCBzaXplSW5mbykge1xuICAgIHZhciBhdHRyID0gZmVhdHVyZS5wcm9wZXJ0aWVzO1xuICAgIHZhciBmaWVsZCA9IHNpemVJbmZvLmZpZWxkO1xuICAgIHZhciBzaXplID0gMDtcbiAgICB2YXIgZmVhdHVyZVZhbHVlID0gbnVsbDtcblxuICAgIGlmIChmaWVsZCkge1xuICAgICAgZmVhdHVyZVZhbHVlID0gYXR0cltmaWVsZF07XG4gICAgICB2YXIgbWluU2l6ZSA9IHNpemVJbmZvLm1pblNpemU7XG4gICAgICB2YXIgbWF4U2l6ZSA9IHNpemVJbmZvLm1heFNpemU7XG4gICAgICB2YXIgbWluRGF0YVZhbHVlID0gc2l6ZUluZm8ubWluRGF0YVZhbHVlO1xuICAgICAgdmFyIG1heERhdGFWYWx1ZSA9IHNpemVJbmZvLm1heERhdGFWYWx1ZTtcbiAgICAgIHZhciBmZWF0dXJlUmF0aW87XG4gICAgICB2YXIgbm9ybUZpZWxkID0gc2l6ZUluZm8ubm9ybWFsaXphdGlvbkZpZWxkO1xuICAgICAgdmFyIG5vcm1WYWx1ZSA9IGF0dHIgPyBwYXJzZUZsb2F0KGF0dHJbbm9ybUZpZWxkXSkgOiB1bmRlZmluZWQ7XG5cbiAgICAgIGlmIChmZWF0dXJlVmFsdWUgPT09IG51bGwgfHwgKG5vcm1GaWVsZCAmJiAoKGlzTmFOKG5vcm1WYWx1ZSkgfHwgbm9ybVZhbHVlID09PSAwKSkpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzTmFOKG5vcm1WYWx1ZSkpIHtcbiAgICAgICAgZmVhdHVyZVZhbHVlIC89IG5vcm1WYWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1pblNpemUgIT09IG51bGwgJiYgbWF4U2l6ZSAhPT0gbnVsbCAmJiBtaW5EYXRhVmFsdWUgIT09IG51bGwgJiYgbWF4RGF0YVZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChmZWF0dXJlVmFsdWUgPD0gbWluRGF0YVZhbHVlKSB7XG4gICAgICAgICAgc2l6ZSA9IG1pblNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAoZmVhdHVyZVZhbHVlID49IG1heERhdGFWYWx1ZSkge1xuICAgICAgICAgIHNpemUgPSBtYXhTaXplO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZlYXR1cmVSYXRpbyA9IChmZWF0dXJlVmFsdWUgLSBtaW5EYXRhVmFsdWUpIC8gKG1heERhdGFWYWx1ZSAtIG1pbkRhdGFWYWx1ZSk7XG4gICAgICAgICAgc2l6ZSA9IG1pblNpemUgKyAoZmVhdHVyZVJhdGlvICogKG1heFNpemUgLSBtaW5TaXplKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHNpemUgPSBpc05hTihzaXplKSA/IDAgOiBzaXplO1xuICAgIH1cbiAgICByZXR1cm4gc2l6ZTtcbiAgfSxcblxuICBnZXRDb2xvcjogZnVuY3Rpb24gKGZlYXR1cmUsIGNvbG9ySW5mbykge1xuICAgIC8vIHJlcXVpcmVkIGluZm9ybWF0aW9uIHRvIGdldCBjb2xvclxuICAgIGlmICghKGZlYXR1cmUucHJvcGVydGllcyAmJiBjb2xvckluZm8gJiYgY29sb3JJbmZvLmZpZWxkICYmIGNvbG9ySW5mby5zdG9wcykpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciBhdHRyID0gZmVhdHVyZS5wcm9wZXJ0aWVzO1xuICAgIHZhciBmZWF0dXJlVmFsdWUgPSBhdHRyW2NvbG9ySW5mby5maWVsZF07XG4gICAgdmFyIGxvd2VyQm91bmRDb2xvciwgdXBwZXJCb3VuZENvbG9yLCBsb3dlckJvdW5kLCB1cHBlckJvdW5kO1xuICAgIHZhciBub3JtRmllbGQgPSBjb2xvckluZm8ubm9ybWFsaXphdGlvbkZpZWxkO1xuICAgIHZhciBub3JtVmFsdWUgPSBhdHRyID8gcGFyc2VGbG9hdChhdHRyW25vcm1GaWVsZF0pIDogdW5kZWZpbmVkO1xuICAgIGlmIChmZWF0dXJlVmFsdWUgPT09IG51bGwgfHwgKG5vcm1GaWVsZCAmJiAoKGlzTmFOKG5vcm1WYWx1ZSkgfHwgbm9ybVZhbHVlID09PSAwKSkpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIWlzTmFOKG5vcm1WYWx1ZSkpIHtcbiAgICAgIGZlYXR1cmVWYWx1ZSAvPSBub3JtVmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKGZlYXR1cmVWYWx1ZSA8PSBjb2xvckluZm8uc3RvcHNbMF0udmFsdWUpIHtcbiAgICAgIHJldHVybiBjb2xvckluZm8uc3RvcHNbMF0uY29sb3I7XG4gICAgfVxuICAgIHZhciBsYXN0U3RvcCA9IGNvbG9ySW5mby5zdG9wc1tjb2xvckluZm8uc3RvcHMubGVuZ3RoIC0gMV07XG4gICAgaWYgKGZlYXR1cmVWYWx1ZSA+PSBsYXN0U3RvcC52YWx1ZSkge1xuICAgICAgcmV0dXJuIGxhc3RTdG9wLmNvbG9yO1xuICAgIH1cblxuICAgIC8vIGdvIHRocm91Z2ggdGhlIHN0b3BzIHRvIGZpbmQgbWluIGFuZCBtYXhcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbG9ySW5mby5zdG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0b3BJbmZvID0gY29sb3JJbmZvLnN0b3BzW2ldO1xuXG4gICAgICBpZiAoc3RvcEluZm8udmFsdWUgPD0gZmVhdHVyZVZhbHVlKSB7XG4gICAgICAgIGxvd2VyQm91bmRDb2xvciA9IHN0b3BJbmZvLmNvbG9yO1xuICAgICAgICBsb3dlckJvdW5kID0gc3RvcEluZm8udmFsdWU7XG4gICAgICB9IGVsc2UgaWYgKHN0b3BJbmZvLnZhbHVlID4gZmVhdHVyZVZhbHVlKSB7XG4gICAgICAgIHVwcGVyQm91bmRDb2xvciA9IHN0b3BJbmZvLmNvbG9yO1xuICAgICAgICB1cHBlckJvdW5kID0gc3RvcEluZm8udmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZlYXR1cmUgZmFsbHMgYmV0d2VlbiB0d28gc3RvcHMsIGludGVycGxhdGUgdGhlIGNvbG9yc1xuICAgIGlmICghaXNOYU4obG93ZXJCb3VuZCkgJiYgIWlzTmFOKHVwcGVyQm91bmQpKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB1cHBlckJvdW5kIC0gbG93ZXJCb3VuZDtcbiAgICAgIGlmIChyYW5nZSA+IDApIHtcbiAgICAgICAgLy8gbW9yZSB3ZWlnaHQgdGhlIGZ1cnRoZXIgaXQgaXMgZnJvbSB0aGUgbG93ZXIgYm91bmRcbiAgICAgICAgdmFyIHVwcGVyQm91bmRDb2xvcldlaWdodCA9IChmZWF0dXJlVmFsdWUgLSBsb3dlckJvdW5kKSAvIHJhbmdlO1xuICAgICAgICBpZiAodXBwZXJCb3VuZENvbG9yV2VpZ2h0KSB7XG4gICAgICAgICAgLy8gbW9yZSB3ZWlnaHQgdGhlIGZ1cnRoZXIgaXQgaXMgZnJvbSB0aGUgdXBwZXIgYm91bmRcbiAgICAgICAgICB2YXIgbG93ZXJCb3VuZENvbG9yV2VpZ2h0ID0gKHVwcGVyQm91bmQgLSBmZWF0dXJlVmFsdWUpIC8gcmFuZ2U7XG4gICAgICAgICAgaWYgKGxvd2VyQm91bmRDb2xvcldlaWdodCkge1xuICAgICAgICAgICAgLy8gaW50ZXJwb2xhdGUgdGhlIGxvd2VyIGFuZCB1cHBlciBib3VuZCBjb2xvciBieSBhcHBseWluZyB0aGVcbiAgICAgICAgICAgIC8vIHdlaWdodHMgdG8gZWFjaCBvZiB0aGUgcmdiYSBjb2xvcnMgYW5kIGFkZGluZyB0aGVtIHRvZ2V0aGVyXG4gICAgICAgICAgICB2YXIgaW50ZXJwb2xhdGVkQ29sb3IgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgNDsgaisrKSB7XG4gICAgICAgICAgICAgIGludGVycG9sYXRlZENvbG9yW2pdID0gTWF0aC5yb3VuZCgobG93ZXJCb3VuZENvbG9yW2pdICogbG93ZXJCb3VuZENvbG9yV2VpZ2h0KSArICh1cHBlckJvdW5kQ29sb3Jbal0gKiB1cHBlckJvdW5kQ29sb3JXZWlnaHQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnRlcnBvbGF0ZWRDb2xvcjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gZGlmZmVyZW5jZSBiZXR3ZWVuIGZlYXR1cmVWYWx1ZSBhbmQgdXBwZXJCb3VuZCwgMTAwJSBvZiB1cHBlckJvdW5kQ29sb3JcbiAgICAgICAgICAgIHJldHVybiB1cHBlckJvdW5kQ29sb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vIGRpZmZlcmVuY2UgYmV0d2VlbiBmZWF0dXJlVmFsdWUgYW5kIGxvd2VyQm91bmQsIDEwMCUgb2YgbG93ZXJCb3VuZENvbG9yXG4gICAgICAgICAgcmV0dXJuIGxvd2VyQm91bmRDb2xvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiB3ZSBnZXQgdG8gaGVyZSwgbm9uZSBvZiB0aGUgY2FzZXMgYXBwbHkgc28gcmV0dXJuIG51bGxcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8vIGV4cG9ydCBmdW5jdGlvbiBzeW1ib2wgKHN5bWJvbEpzb24pIHtcbi8vICAgcmV0dXJuIG5ldyBTeW1ib2woc3ltYm9sSnNvbik7XG4vLyB9XG5cbmV4cG9ydCBkZWZhdWx0IFN5bWJvbDtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuXG5leHBvcnQgdmFyIFNoYXBlTWFya2VyID0gTC5QYXRoLmV4dGVuZCh7XG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcbiAgICB0aGlzLl9zaXplID0gc2l6ZTtcbiAgICB0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xuICAgIHRoaXMuX3N2Z0NhbnZhc0luY2x1ZGVzKCk7XG4gIH0sXG5cbiAgdG9HZW9KU09OOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIEwuR2VvSlNPTi5nZXRGZWF0dXJlKHRoaXMsIHtcbiAgICAgIHR5cGU6ICdQb2ludCcsXG4gICAgICBjb29yZGluYXRlczogTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuZ2V0TGF0TG5nKCkpXG4gICAgfSk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gaW1wbGVtZW50IGluIHN1YiBjbGFzc1xuICB9LFxuXG4gIF9wcm9qZWN0OiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcG9pbnQgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KHRoaXMuX2xhdGxuZyk7XG4gIH0sXG5cbiAgX3VwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9tYXApIHtcbiAgICAgIHRoaXMuX3VwZGF0ZVBhdGgoKTtcbiAgICB9XG4gIH0sXG5cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBpbXBsZW1lbnQgaW4gc3ViIGNsYXNzXG4gIH0sXG5cbiAgc2V0TGF0TG5nOiBmdW5jdGlvbiAobGF0bG5nKSB7XG4gICAgdGhpcy5fbGF0bG5nID0gTC5sYXRMbmcobGF0bG5nKTtcbiAgICB0aGlzLnJlZHJhdygpO1xuICAgIHJldHVybiB0aGlzLmZpcmUoJ21vdmUnLCB7bGF0bG5nOiB0aGlzLl9sYXRsbmd9KTtcbiAgfSxcblxuICBnZXRMYXRMbmc6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGF0bG5nO1xuICB9LFxuXG4gIHNldFNpemU6IGZ1bmN0aW9uIChzaXplKSB7XG4gICAgdGhpcy5fc2l6ZSA9IHNpemU7XG4gICAgcmV0dXJuIHRoaXMucmVkcmF3KCk7XG4gIH0sXG5cbiAgZ2V0U2l6ZTogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9zaXplO1xuICB9XG59KTtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgU2hhcGVNYXJrZXIgfSBmcm9tICcuL1NoYXBlTWFya2VyJztcblxuZXhwb3J0IHZhciBDcm9zc01hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVDcm9zc01hcmtlcih0aGlzKTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBMLkNhbnZhcy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVDcm9zc01hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLngsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLnggLSBvZmZzZXQsIGxhdGxuZy55KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkpO1xuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgTC5TVkcuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlQ3Jvc3NNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG5cbiAgICAgICAgaWYgKEwuQnJvd3Nlci52bWwpIHtcbiAgICAgICAgICBsYXRsbmcuX3JvdW5kKCk7XG4gICAgICAgICAgb2Zmc2V0ID0gTWF0aC5yb3VuZChvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0ciA9ICdNJyArIGxhdGxuZy54ICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgbGF0bG5nLnggKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpICtcbiAgICAgICAgICAnTScgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgbGF0bG5nLnkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyBsYXRsbmcueTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciBjcm9zc01hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBDcm9zc01hcmtlcihsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgY3Jvc3NNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IFNoYXBlTWFya2VyIH0gZnJvbSAnLi9TaGFwZU1hcmtlcic7XG5cbmV4cG9ydCB2YXIgWE1hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVYTWFya2VyKHRoaXMpO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIEwuQ2FudmFzLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZVhNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG4gICAgICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgTC5TVkcuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlWE1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcblxuICAgICAgICBpZiAoTC5Ccm93c2VyLnZtbCkge1xuICAgICAgICAgIGxhdGxuZy5fcm91bmQoKTtcbiAgICAgICAgICBvZmZzZXQgPSBNYXRoLnJvdW5kKG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyID0gJ00nICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpICtcbiAgICAgICAgICAnTScgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54ICsgb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCk7XG5cbiAgICAgICAgdGhpcy5fc2V0UGF0aChsYXllciwgc3RyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG5cbmV4cG9ydCB2YXIgeE1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBYTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCB4TWFya2VyO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgeyBTaGFwZU1hcmtlciB9IGZyb20gJy4vU2hhcGVNYXJrZXInO1xuXG5leHBvcnQgdmFyIFNxdWFyZU1hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBmaWxsOiB0cnVlXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVTcXVhcmVNYXJrZXIodGhpcyk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgTC5DYW52YXMuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlU3F1YXJlTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuICAgICAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcblxuICAgICAgICBjdHgubW92ZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSArIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggLSBvZmZzZXQsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSAtIG9mZnNldCk7XG5cbiAgICAgICAgY3R4LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBMLlNWRy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVTcXVhcmVNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG5cbiAgICAgICAgaWYgKEwuQnJvd3Nlci52bWwpIHtcbiAgICAgICAgICBsYXRsbmcuX3JvdW5kKCk7XG4gICAgICAgICAgb2Zmc2V0ID0gTWF0aC5yb3VuZChvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0ciA9ICdNJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpO1xuXG4gICAgICAgIHN0ciA9IHN0ciArIChMLkJyb3dzZXIuc3ZnID8gJ3onIDogJ3gnKTtcblxuICAgICAgICB0aGlzLl9zZXRQYXRoKGxheWVyLCBzdHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuZXhwb3J0IHZhciBzcXVhcmVNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgU3F1YXJlTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBzcXVhcmVNYXJrZXI7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IFNoYXBlTWFya2VyIH0gZnJvbSAnLi9TaGFwZU1hcmtlcic7XG5cbmV4cG9ydCB2YXIgRGlhbW9uZE1hcmtlciA9IFNoYXBlTWFya2VyLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBmaWxsOiB0cnVlXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICAgIFNoYXBlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3JlbmRlcmVyLl91cGRhdGVEaWFtb25kTWFya2VyKHRoaXMpO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIEwuQ2FudmFzLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZURpYW1vbmRNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG4gICAgICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gICAgICAgIGN0eC5tb3ZlVG8obGF0bG5nLngsIGxhdGxuZy55ICsgb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCAtIG9mZnNldCwgbGF0bG5nLnkpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54LCBsYXRsbmcueSAtIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55KTtcblxuICAgICAgICBjdHguY2xvc2VQYXRoKCk7XG5cbiAgICAgICAgdGhpcy5fZmlsbFN0cm9rZShjdHgsIGxheWVyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIEwuU1ZHLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZURpYW1vbmRNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG5cbiAgICAgICAgaWYgKEwuQnJvd3Nlci52bWwpIHtcbiAgICAgICAgICBsYXRsbmcuX3JvdW5kKCk7XG4gICAgICAgICAgb2Zmc2V0ID0gTWF0aC5yb3VuZChvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0ciA9ICdNJyArIGxhdGxuZy54ICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIGxhdGxuZy55ICtcbiAgICAgICAgICAnTCcgKyBsYXRsbmcueCArICcsJyArIChsYXRsbmcueSAtIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyBsYXRsbmcueTtcblxuICAgICAgICBzdHIgPSBzdHIgKyAoTC5Ccm93c2VyLnN2ZyA/ICd6JyA6ICd4Jyk7XG5cbiAgICAgICAgdGhpcy5fc2V0UGF0aChsYXllciwgc3RyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG5cbmV4cG9ydCB2YXIgZGlhbW9uZE1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBEaWFtb25kTWFya2VyKGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBkaWFtb25kTWFya2VyO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgU3ltYm9sIGZyb20gJy4vU3ltYm9sJztcbmltcG9ydCB7c3F1YXJlTWFya2VyLCB4TWFya2VyLCBjcm9zc01hcmtlciwgZGlhbW9uZE1hcmtlcn0gZnJvbSAnbGVhZmxldC1zaGFwZS1tYXJrZXJzJztcblxuZXhwb3J0IHZhciBQb2ludFN5bWJvbCA9IFN5bWJvbC5leHRlbmQoe1xuXG4gIHN0YXRpY3M6IHtcbiAgICBNQVJLRVJUWVBFUzogWydlc3JpU01TQ2lyY2xlJywgJ2VzcmlTTVNDcm9zcycsICdlc3JpU01TRGlhbW9uZCcsICdlc3JpU01TU3F1YXJlJywgJ2VzcmlTTVNYJywgJ2VzcmlQTVMnXVxuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gICAgdmFyIHVybDtcbiAgICBTeW1ib2wucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBzeW1ib2xKc29uLCBvcHRpb25zKTtcbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgdGhpcy5zZXJ2aWNlVXJsID0gb3B0aW9ucy51cmw7XG4gICAgfVxuICAgIGlmIChzeW1ib2xKc29uKSB7XG4gICAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVBNUycpIHtcbiAgICAgICAgdmFyIGltYWdlVXJsID0gdGhpcy5fc3ltYm9sSnNvbi51cmw7XG4gICAgICAgIGlmICgoaW1hZ2VVcmwgJiYgaW1hZ2VVcmwuc3Vic3RyKDAsIDcpID09PSAnaHR0cDovLycpIHx8IChpbWFnZVVybC5zdWJzdHIoMCwgOCkgPT09ICdodHRwczovLycpKSB7XG4gICAgICAgICAgLy8gd2ViIGltYWdlXG4gICAgICAgICAgdXJsID0gdGhpcy5zYW5pdGl6ZShpbWFnZVVybCk7XG4gICAgICAgICAgdGhpcy5faWNvblVybCA9IHVybDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1cmwgPSB0aGlzLnNlcnZpY2VVcmwgKyAnaW1hZ2VzLycgKyBpbWFnZVVybDtcbiAgICAgICAgICB0aGlzLl9pY29uVXJsID0gb3B0aW9ucyAmJiBvcHRpb25zLnRva2VuID8gdXJsICsgJz90b2tlbj0nICsgb3B0aW9ucy50b2tlbiA6IHVybDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3ltYm9sSnNvbi5pbWFnZURhdGEpIHtcbiAgICAgICAgICB0aGlzLl9pY29uVXJsID0gJ2RhdGE6JyArIHN5bWJvbEpzb24uY29udGVudFR5cGUgKyAnO2Jhc2U2NCwnICsgc3ltYm9sSnNvbi5pbWFnZURhdGE7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGVhZmxldCBkb2VzIG5vdCBhbGxvdyByZXNpemluZyBpY29ucyBzbyBrZWVwIGEgaGFzaCBvZiBkaWZmZXJlbnRcbiAgICAgICAgLy8gaWNvbiBzaXplcyB0byB0cnkgYW5kIGtlZXAgZG93biBvbiB0aGUgbnVtYmVyIG9mIGljb25zIGNyZWF0ZWRcbiAgICAgICAgdGhpcy5faWNvbnMgPSB7fTtcbiAgICAgICAgLy8gY3JlYXRlIGJhc2UgaWNvblxuICAgICAgICB0aGlzLmljb24gPSB0aGlzLl9jcmVhdGVJY29uKHRoaXMuX3N5bWJvbEpzb24pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmlsbFN0eWxlcygpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvLyBwcmV2ZW50IGh0bWwgaW5qZWN0aW9uIGluIHN0cmluZ3NcbiAgc2FuaXRpemU6IGZ1bmN0aW9uIChzdHIpIHtcbiAgICBpZiAoIXN0cikge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB2YXIgdGV4dDtcbiAgICB0cnkge1xuICAgICAgLy8gcmVtb3ZlcyBodG1sIGJ1dCBsZWF2ZXMgdXJsIGxpbmsgdGV4dFxuICAgICAgdGV4dCA9IHN0ci5yZXBsYWNlKC88YnI+L2dpLCAnXFxuJyk7XG4gICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88cC4qPi9naSwgJ1xcbicpO1xuICAgICAgdGV4dCA9IHRleHQucmVwbGFjZSgvPGEuKmhyZWY9JyguKj8pJy4qPiguKj8pPFxcL2E+L2dpLCAnICQyICgkMSkgJyk7XG4gICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88KD86LnxcXHMpKj8+L2csICcnKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgdGV4dCA9IG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0O1xuICB9LFxuXG4gIF9maWxsU3R5bGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24ub3V0bGluZSAmJiB0aGlzLl9zeW1ib2xKc29uLnNpemUgPiAwICYmIHRoaXMuX3N5bWJvbEpzb24ub3V0bGluZS5zdHlsZSAhPT0gJ2VzcmlTTFNOdWxsJykge1xuICAgICAgdGhpcy5fc3R5bGVzLnN0cm9rZSA9IHRydWU7XG4gICAgICB0aGlzLl9zdHlsZXMud2VpZ2h0ID0gdGhpcy5waXhlbFZhbHVlKHRoaXMuX3N5bWJvbEpzb24ub3V0bGluZS53aWR0aCk7XG4gICAgICB0aGlzLl9zdHlsZXMuY29sb3IgPSB0aGlzLmNvbG9yVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5vdXRsaW5lLmNvbG9yKTtcbiAgICAgIHRoaXMuX3N0eWxlcy5vcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKHRoaXMuX3N5bWJvbEpzb24ub3V0bGluZS5jb2xvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5zdHJva2UgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5maWxsQ29sb3IgPSB0aGlzLmNvbG9yVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IDA7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24uc3R5bGUgPT09ICdlc3JpU01TQ2lyY2xlJykge1xuICAgICAgdGhpcy5fc3R5bGVzLnJhZGl1cyA9IHRoaXMucGl4ZWxWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLnNpemUpIC8gMi4wO1xuICAgIH1cbiAgfSxcblxuICBfY3JlYXRlSWNvbjogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgd2lkdGggPSB0aGlzLnBpeGVsVmFsdWUob3B0aW9ucy53aWR0aCk7XG4gICAgdmFyIGhlaWdodCA9IHdpZHRoO1xuICAgIGlmIChvcHRpb25zLmhlaWdodCkge1xuICAgICAgaGVpZ2h0ID0gdGhpcy5waXhlbFZhbHVlKG9wdGlvbnMuaGVpZ2h0KTtcbiAgICB9XG4gICAgdmFyIHhPZmZzZXQgPSB3aWR0aCAvIDIuMDtcbiAgICB2YXIgeU9mZnNldCA9IGhlaWdodCAvIDIuMDtcblxuICAgIGlmIChvcHRpb25zLnhvZmZzZXQpIHtcbiAgICAgIHhPZmZzZXQgKz0gdGhpcy5waXhlbFZhbHVlKG9wdGlvbnMueG9mZnNldCk7XG4gICAgfVxuICAgIGlmIChvcHRpb25zLnlvZmZzZXQpIHtcbiAgICAgIHlPZmZzZXQgKz0gdGhpcy5waXhlbFZhbHVlKG9wdGlvbnMueW9mZnNldCk7XG4gICAgfVxuXG4gICAgdmFyIGljb24gPSBMLmljb24oe1xuICAgICAgaWNvblVybDogdGhpcy5faWNvblVybCxcbiAgICAgIGljb25TaXplOiBbd2lkdGgsIGhlaWdodF0sXG4gICAgICBpY29uQW5jaG9yOiBbeE9mZnNldCwgeU9mZnNldF1cbiAgICB9KTtcbiAgICB0aGlzLl9pY29uc1tvcHRpb25zLndpZHRoLnRvU3RyaW5nKCldID0gaWNvbjtcbiAgICByZXR1cm4gaWNvbjtcbiAgfSxcblxuICBfZ2V0SWNvbjogZnVuY3Rpb24gKHNpemUpIHtcbiAgICAvLyBjaGVjayB0byBzZWUgaWYgaXQgaXMgYWxyZWFkeSBjcmVhdGVkIGJ5IHNpemVcbiAgICB2YXIgaWNvbiA9IHRoaXMuX2ljb25zW3NpemUudG9TdHJpbmcoKV07XG4gICAgaWYgKCFpY29uKSB7XG4gICAgICBpY29uID0gdGhpcy5fY3JlYXRlSWNvbih7d2lkdGg6IHNpemV9KTtcbiAgICB9XG4gICAgcmV0dXJuIGljb247XG4gIH0sXG5cbiAgcG9pbnRUb0xheWVyOiBmdW5jdGlvbiAoZ2VvanNvbiwgbGF0bG5nLCB2aXN1YWxWYXJpYWJsZXMsIG9wdGlvbnMpIHtcbiAgICB2YXIgc2l6ZSA9IHRoaXMuX3N5bWJvbEpzb24uc2l6ZSB8fCB0aGlzLl9zeW1ib2xKc29uLndpZHRoO1xuICAgIGlmICghdGhpcy5faXNEZWZhdWx0KSB7XG4gICAgICBpZiAodmlzdWFsVmFyaWFibGVzLnNpemVJbmZvKSB7XG4gICAgICAgIHZhciBjYWxjdWxhdGVkU2l6ZSA9IHRoaXMuZ2V0U2l6ZShnZW9qc29uLCB2aXN1YWxWYXJpYWJsZXMuc2l6ZUluZm8pO1xuICAgICAgICBpZiAoY2FsY3VsYXRlZFNpemUpIHtcbiAgICAgICAgICBzaXplID0gY2FsY3VsYXRlZFNpemU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKSB7XG4gICAgICAgIHZhciBjb2xvciA9IHRoaXMuZ2V0Q29sb3IoZ2VvanNvbiwgdmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbyk7XG4gICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgIHRoaXMuX3N0eWxlcy5maWxsQ29sb3IgPSB0aGlzLmNvbG9yVmFsdWUoY29sb3IpO1xuICAgICAgICAgIHRoaXMuX3N0eWxlcy5maWxsT3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZShjb2xvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVBNUycpIHtcbiAgICAgIHZhciBsYXllck9wdGlvbnMgPSBMLmV4dGVuZCh7fSwge2ljb246IHRoaXMuX2dldEljb24oc2l6ZSl9LCBvcHRpb25zKTtcbiAgICAgIHJldHVybiBMLm1hcmtlcihsYXRsbmcsIGxheWVyT3B0aW9ucyk7XG4gICAgfVxuICAgIHNpemUgPSB0aGlzLnBpeGVsVmFsdWUoc2l6ZSk7XG5cbiAgICBzd2l0Y2ggKHRoaXMuX3N5bWJvbEpzb24uc3R5bGUpIHtcbiAgICAgIGNhc2UgJ2VzcmlTTVNTcXVhcmUnOlxuICAgICAgICByZXR1cm4gc3F1YXJlTWFya2VyKGxhdGxuZywgc2l6ZSwgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICAgICAgY2FzZSAnZXNyaVNNU0RpYW1vbmQnOlxuICAgICAgICByZXR1cm4gZGlhbW9uZE1hcmtlcihsYXRsbmcsIHNpemUsIEwuZXh0ZW5kKHt9LCB0aGlzLl9zdHlsZXMsIG9wdGlvbnMpKTtcbiAgICAgIGNhc2UgJ2VzcmlTTVNDcm9zcyc6XG4gICAgICAgIHJldHVybiBjcm9zc01hcmtlcihsYXRsbmcsIHNpemUsIEwuZXh0ZW5kKHt9LCB0aGlzLl9zdHlsZXMsIG9wdGlvbnMpKTtcbiAgICAgIGNhc2UgJ2VzcmlTTVNYJzpcbiAgICAgICAgcmV0dXJuIHhNYXJrZXIobGF0bG5nLCBzaXplLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gICAgfVxuICAgIHRoaXMuX3N0eWxlcy5yYWRpdXMgPSBzaXplIC8gMi4wO1xuICAgIHJldHVybiBMLmNpcmNsZU1hcmtlcihsYXRsbmcsIEwuZXh0ZW5kKHt9LCB0aGlzLl9zdHlsZXMsIG9wdGlvbnMpKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwb2ludFN5bWJvbCAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFBvaW50U3ltYm9sKHN5bWJvbEpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwb2ludFN5bWJvbDtcbiIsImltcG9ydCBTeW1ib2wgZnJvbSAnLi9TeW1ib2wnO1xuXG5leHBvcnQgdmFyIExpbmVTeW1ib2wgPSBTeW1ib2wuZXh0ZW5kKHtcbiAgc3RhdGljczoge1xuICAgIC8vIE5vdCBpbXBsZW1lbnRlZCAnZXNyaVNMU051bGwnXG4gICAgTElORVRZUEVTOiBbJ2VzcmlTTFNEYXNoJywgJ2VzcmlTTFNEb3QnLCAnZXNyaVNMU0Rhc2hEb3REb3QnLCAnZXNyaVNMU0Rhc2hEb3QnLCAnZXNyaVNMU1NvbGlkJ11cbiAgfSxcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgICBTeW1ib2wucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBzeW1ib2xKc29uLCBvcHRpb25zKTtcbiAgICB0aGlzLl9maWxsU3R5bGVzKCk7XG4gIH0sXG5cbiAgX2ZpbGxTdHlsZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBzZXQgdGhlIGRlZmF1bHRzIHRoYXQgc2hvdyB1cCBvbiBhcmNnaXMgb25saW5lXG4gICAgdGhpcy5fc3R5bGVzLmxpbmVDYXAgPSAnYnV0dCc7XG4gICAgdGhpcy5fc3R5bGVzLmxpbmVKb2luID0gJ21pdGVyJztcbiAgICB0aGlzLl9zdHlsZXMuZmlsbCA9IGZhbHNlO1xuICAgIHRoaXMuX3N0eWxlcy53ZWlnaHQgPSAwO1xuXG4gICAgaWYgKCF0aGlzLl9zeW1ib2xKc29uKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3R5bGVzO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKSB7XG4gICAgICB0aGlzLl9zdHlsZXMuY29sb3IgPSB0aGlzLmNvbG9yVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgICB0aGlzLl9zdHlsZXMub3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzTmFOKHRoaXMuX3N5bWJvbEpzb24ud2lkdGgpKSB7XG4gICAgICB0aGlzLl9zdHlsZXMud2VpZ2h0ID0gdGhpcy5waXhlbFZhbHVlKHRoaXMuX3N5bWJvbEpzb24ud2lkdGgpO1xuXG4gICAgICB2YXIgZGFzaFZhbHVlcyA9IFtdO1xuXG4gICAgICBzd2l0Y2ggKHRoaXMuX3N5bWJvbEpzb24uc3R5bGUpIHtcbiAgICAgICAgY2FzZSAnZXNyaVNMU0Rhc2gnOlxuICAgICAgICAgIGRhc2hWYWx1ZXMgPSBbNCwgM107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2VzcmlTTFNEb3QnOlxuICAgICAgICAgIGRhc2hWYWx1ZXMgPSBbMSwgM107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2VzcmlTTFNEYXNoRG90JzpcbiAgICAgICAgICBkYXNoVmFsdWVzID0gWzgsIDMsIDEsIDNdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlc3JpU0xTRGFzaERvdERvdCc6XG4gICAgICAgICAgZGFzaFZhbHVlcyA9IFs4LCAzLCAxLCAzLCAxLCAzXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gdXNlIHRoZSBkYXNoIHZhbHVlcyBhbmQgdGhlIGxpbmUgd2VpZ2h0IHRvIHNldCBkYXNoIGFycmF5XG4gICAgICBpZiAoZGFzaFZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGFzaFZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGRhc2hWYWx1ZXNbaV0gKj0gdGhpcy5fc3R5bGVzLndlaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0eWxlcy5kYXNoQXJyYXkgPSBkYXNoVmFsdWVzLmpvaW4oJywnKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc3R5bGU6IGZ1bmN0aW9uIChmZWF0dXJlLCB2aXN1YWxWYXJpYWJsZXMpIHtcbiAgICBpZiAoIXRoaXMuX2lzRGVmYXVsdCAmJiB2aXN1YWxWYXJpYWJsZXMpIHtcbiAgICAgIGlmICh2aXN1YWxWYXJpYWJsZXMuc2l6ZUluZm8pIHtcbiAgICAgICAgdmFyIGNhbGN1bGF0ZWRTaXplID0gdGhpcy5waXhlbFZhbHVlKHRoaXMuZ2V0U2l6ZShmZWF0dXJlLCB2aXN1YWxWYXJpYWJsZXMuc2l6ZUluZm8pKTtcbiAgICAgICAgaWYgKGNhbGN1bGF0ZWRTaXplKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLndlaWdodCA9IGNhbGN1bGF0ZWRTaXplO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbykge1xuICAgICAgICB2YXIgY29sb3IgPSB0aGlzLmdldENvbG9yKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pO1xuICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMuY29sb3IgPSB0aGlzLmNvbG9yVmFsdWUoY29sb3IpO1xuICAgICAgICAgIHRoaXMuX3N0eWxlcy5vcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKGNvbG9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3R5bGVzO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGxpbmVTeW1ib2wgKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMaW5lU3ltYm9sKHN5bWJvbEpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBsaW5lU3ltYm9sO1xuIiwiaW1wb3J0IFN5bWJvbCBmcm9tICcuL1N5bWJvbCc7XG5pbXBvcnQgbGluZVN5bWJvbCBmcm9tICcuL0xpbmVTeW1ib2wnO1xuXG5leHBvcnQgdmFyIFBvbHlnb25TeW1ib2wgPSBTeW1ib2wuZXh0ZW5kKHtcbiAgc3RhdGljczoge1xuICAgIC8vIG5vdCBpbXBsZW1lbnRlZDogJ2VzcmlTRlNCYWNrd2FyZERpYWdvbmFsJywnZXNyaVNGU0Nyb3NzJywnZXNyaVNGU0RpYWdvbmFsQ3Jvc3MnLCdlc3JpU0ZTRm9yd2FyZERpYWdvbmFsJywnZXNyaVNGU0hvcml6b250YWwnLCdlc3JpU0ZTTnVsbCcsJ2VzcmlTRlNWZXJ0aWNhbCdcbiAgICBQT0xZR09OVFlQRVM6IFsnZXNyaVNGU1NvbGlkJ11cbiAgfSxcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgICBTeW1ib2wucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBzeW1ib2xKc29uLCBvcHRpb25zKTtcbiAgICBpZiAoc3ltYm9sSnNvbikge1xuICAgICAgaWYgKHN5bWJvbEpzb24ub3V0bGluZSAmJiBzeW1ib2xKc29uLm91dGxpbmUuc3R5bGUgPT09ICdlc3JpU0xTTnVsbCcpIHtcbiAgICAgICAgdGhpcy5fbGluZVN0eWxlcyA9IHsgd2VpZ2h0OiAwIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9saW5lU3R5bGVzID0gbGluZVN5bWJvbChzeW1ib2xKc29uLm91dGxpbmUsIG9wdGlvbnMpLnN0eWxlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9maWxsU3R5bGVzKCk7XG4gICAgfVxuICB9LFxuXG4gIF9maWxsU3R5bGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2xpbmVTdHlsZXMpIHtcbiAgICAgIGlmICh0aGlzLl9saW5lU3R5bGVzLndlaWdodCA9PT0gMCkge1xuICAgICAgICAvLyB3aGVuIHdlaWdodCBpcyAwLCBzZXR0aW5nIHRoZSBzdHJva2UgdG8gZmFsc2UgY2FuIHN0aWxsIGxvb2sgYmFkXG4gICAgICAgIC8vIChnYXBzIGJldHdlZW4gdGhlIHBvbHlnb25zKVxuICAgICAgICB0aGlzLl9zdHlsZXMuc3Ryb2tlID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjb3B5IHRoZSBsaW5lIHN5bWJvbCBzdHlsZXMgaW50byB0aGlzIHN5bWJvbCdzIHN0eWxlc1xuICAgICAgICBmb3IgKHZhciBzdHlsZUF0dHIgaW4gdGhpcy5fbGluZVN0eWxlcykge1xuICAgICAgICAgIHRoaXMuX3N0eWxlc1tzdHlsZUF0dHJdID0gdGhpcy5fbGluZVN0eWxlc1tzdHlsZUF0dHJdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0IHRoZSBmaWxsIGZvciB0aGUgcG9seWdvblxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uKSB7XG4gICAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5jb2xvciAmJlxuICAgICAgICAgIC8vIGRvbid0IGZpbGwgcG9seWdvbiBpZiB0eXBlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgICBQb2x5Z29uU3ltYm9sLlBPTFlHT05UWVBFUy5pbmRleE9mKHRoaXMuX3N5bWJvbEpzb24uc3R5bGUgPj0gMCkpIHtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGwgPSB0cnVlO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbENvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSAwO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzdHlsZTogZnVuY3Rpb24gKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcykge1xuICAgIGlmICghdGhpcy5faXNEZWZhdWx0ICYmIHZpc3VhbFZhcmlhYmxlcyAmJiB2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKSB7XG4gICAgICB2YXIgY29sb3IgPSB0aGlzLmdldENvbG9yKGZlYXR1cmUsIHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pO1xuICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsQ29sb3IgPSB0aGlzLmNvbG9yVmFsdWUoY29sb3IpO1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUoY29sb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3R5bGVzO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBvbHlnb25TeW1ib2wgKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBQb2x5Z29uU3ltYm9sKHN5bWJvbEpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwb2x5Z29uU3ltYm9sO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5cbmltcG9ydCBwb2ludFN5bWJvbCBmcm9tICcuLi9TeW1ib2xzL1BvaW50U3ltYm9sJztcbmltcG9ydCBsaW5lU3ltYm9sIGZyb20gJy4uL1N5bWJvbHMvTGluZVN5bWJvbCc7XG5pbXBvcnQgcG9seWdvblN5bWJvbCBmcm9tICcuLi9TeW1ib2xzL1BvbHlnb25TeW1ib2wnO1xuXG5leHBvcnQgdmFyIFJlbmRlcmVyID0gTC5DbGFzcy5leHRlbmQoe1xuICBvcHRpb25zOiB7XG4gICAgcHJvcG9ydGlvbmFsUG9seWdvbjogZmFsc2UsXG4gICAgY2xpY2thYmxlOiB0cnVlXG4gIH0sXG5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICAgIHRoaXMuX3JlbmRlcmVySnNvbiA9IHJlbmRlcmVySnNvbjtcbiAgICB0aGlzLl9wb2ludFN5bWJvbHMgPSBmYWxzZTtcbiAgICB0aGlzLl9zeW1ib2xzID0gW107XG4gICAgdGhpcy5fdmlzdWFsVmFyaWFibGVzID0gdGhpcy5fcGFyc2VWaXN1YWxWYXJpYWJsZXMocmVuZGVyZXJKc29uLnZpc3VhbFZhcmlhYmxlcyk7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cbiAgX3BhcnNlVmlzdWFsVmFyaWFibGVzOiBmdW5jdGlvbiAodmlzdWFsVmFyaWFibGVzKSB7XG4gICAgdmFyIHZpc1ZhcnMgPSB7fTtcbiAgICBpZiAodmlzdWFsVmFyaWFibGVzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZpc3VhbFZhcmlhYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2aXNWYXJzW3Zpc3VhbFZhcmlhYmxlc1tpXS50eXBlXSA9IHZpc3VhbFZhcmlhYmxlc1tpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZpc1ZhcnM7XG4gIH0sXG5cbiAgX2NyZWF0ZURlZmF1bHRTeW1ib2w6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fcmVuZGVyZXJKc29uLmRlZmF1bHRTeW1ib2wpIHtcbiAgICAgIHRoaXMuX2RlZmF1bHRTeW1ib2wgPSB0aGlzLl9uZXdTeW1ib2wodGhpcy5fcmVuZGVyZXJKc29uLmRlZmF1bHRTeW1ib2wpO1xuICAgICAgdGhpcy5fZGVmYXVsdFN5bWJvbC5faXNEZWZhdWx0ID0gdHJ1ZTtcbiAgICB9XG4gIH0sXG5cbiAgX25ld1N5bWJvbDogZnVuY3Rpb24gKHN5bWJvbEpzb24pIHtcbiAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVNNUycgfHwgc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVBNUycpIHtcbiAgICAgIHRoaXMuX3BvaW50U3ltYm9scyA9IHRydWU7XG4gICAgICByZXR1cm4gcG9pbnRTeW1ib2woc3ltYm9sSnNvbiwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG4gICAgaWYgKHN5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlTTFMnKSB7XG4gICAgICByZXR1cm4gbGluZVN5bWJvbChzeW1ib2xKc29uLCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbiAgICBpZiAoc3ltYm9sSnNvbi50eXBlID09PSAnZXNyaVNGUycpIHtcbiAgICAgIHJldHVybiBwb2x5Z29uU3ltYm9sKHN5bWJvbEpzb24sIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuICB9LFxuXG4gIF9nZXRTeW1ib2w6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBvdmVycmlkZVxuICB9LFxuXG4gIGF0dGFjaFN0eWxlc1RvTGF5ZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgIGlmICh0aGlzLl9wb2ludFN5bWJvbHMpIHtcbiAgICAgIGxheWVyLm9wdGlvbnMucG9pbnRUb0xheWVyID0gTC5VdGlsLmJpbmQodGhpcy5wb2ludFRvTGF5ZXIsIHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXllci5vcHRpb25zLnN0eWxlID0gTC5VdGlsLmJpbmQodGhpcy5zdHlsZSwgdGhpcyk7XG4gICAgICBsYXllci5fb3JpZ2luYWxTdHlsZSA9IGxheWVyLm9wdGlvbnMuc3R5bGU7XG4gICAgfVxuICB9LFxuXG4gIHBvaW50VG9MYXllcjogZnVuY3Rpb24gKGdlb2pzb24sIGxhdGxuZykge1xuICAgIHZhciBzeW0gPSB0aGlzLl9nZXRTeW1ib2woZ2VvanNvbik7XG4gICAgaWYgKHN5bSAmJiBzeW0ucG9pbnRUb0xheWVyKSB7XG4gICAgICAvLyByaWdodCBub3cgY3VzdG9tIHBhbmVzIGFyZSB0aGUgb25seSBvcHRpb24gcHVzaGVkIHRocm91Z2hcbiAgICAgIHJldHVybiBzeW0ucG9pbnRUb0xheWVyKGdlb2pzb24sIGxhdGxuZywgdGhpcy5fdmlzdWFsVmFyaWFibGVzLCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbiAgICAvLyBpbnZpc2libGUgc3ltYm9sb2d5XG4gICAgcmV0dXJuIEwuY2lyY2xlTWFya2VyKGxhdGxuZywge3JhZGl1czogMCwgb3BhY2l0eTogMH0pO1xuICB9LFxuXG4gIHN0eWxlOiBmdW5jdGlvbiAoZmVhdHVyZSkge1xuICAgIHZhciB1c2VyU3R5bGVzO1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlckRlZmluZWRTdHlsZSkge1xuICAgICAgdXNlclN0eWxlcyA9IHRoaXMub3B0aW9ucy51c2VyRGVmaW5lZFN0eWxlKGZlYXR1cmUpO1xuICAgIH1cbiAgICAvLyBmaW5kIHRoZSBzeW1ib2wgdG8gcmVwcmVzZW50IHRoaXMgZmVhdHVyZVxuICAgIHZhciBzeW0gPSB0aGlzLl9nZXRTeW1ib2woZmVhdHVyZSk7XG4gICAgaWYgKHN5bSkge1xuICAgICAgcmV0dXJuIHRoaXMubWVyZ2VTdHlsZXMoc3ltLnN0eWxlKGZlYXR1cmUsIHRoaXMuX3Zpc3VhbFZhcmlhYmxlcyksIHVzZXJTdHlsZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZpc2libGUgc3ltYm9sb2d5XG4gICAgICByZXR1cm4gdGhpcy5tZXJnZVN0eWxlcyh7b3BhY2l0eTogMCwgZmlsbE9wYWNpdHk6IDB9LCB1c2VyU3R5bGVzKTtcbiAgICB9XG4gIH0sXG5cbiAgbWVyZ2VTdHlsZXM6IGZ1bmN0aW9uIChzdHlsZXMsIHVzZXJTdHlsZXMpIHtcbiAgICB2YXIgbWVyZ2VkU3R5bGVzID0ge307XG4gICAgdmFyIGF0dHI7XG4gICAgLy8gY29weSByZW5kZXJlciBzdHlsZSBhdHRyaWJ1dGVzXG4gICAgZm9yIChhdHRyIGluIHN0eWxlcykge1xuICAgICAgaWYgKHN0eWxlcy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICBtZXJnZWRTdHlsZXNbYXR0cl0gPSBzdHlsZXNbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICAgIC8vIG92ZXJyaWRlIHdpdGggdXNlciBkZWZpbmVkIHN0eWxlIGF0dHJpYnV0ZXNcbiAgICBpZiAodXNlclN0eWxlcykge1xuICAgICAgZm9yIChhdHRyIGluIHVzZXJTdHlsZXMpIHtcbiAgICAgICAgaWYgKHVzZXJTdHlsZXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICBtZXJnZWRTdHlsZXNbYXR0cl0gPSB1c2VyU3R5bGVzW2F0dHJdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtZXJnZWRTdHlsZXM7XG4gIH1cbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBSZW5kZXJlcjtcbiIsImltcG9ydCBSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVyJztcblxuZXhwb3J0IHZhciBDbGFzc0JyZWFrc1JlbmRlcmVyID0gUmVuZGVyZXIuZXh0ZW5kKHtcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICAgIFJlbmRlcmVyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgcmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbiAgICB0aGlzLl9maWVsZCA9IHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZDtcbiAgICBpZiAodGhpcy5fcmVuZGVyZXJKc29uLm5vcm1hbGl6YXRpb25UeXBlICYmIHRoaXMuX3JlbmRlcmVySnNvbi5ub3JtYWxpemF0aW9uVHlwZSA9PT0gJ2VzcmlOb3JtYWxpemVCeUZpZWxkJykge1xuICAgICAgdGhpcy5fbm9ybWFsaXphdGlvbkZpZWxkID0gdGhpcy5fcmVuZGVyZXJKc29uLm5vcm1hbGl6YXRpb25GaWVsZDtcbiAgICB9XG4gICAgdGhpcy5fY3JlYXRlU3ltYm9scygpO1xuICB9LFxuXG4gIF9jcmVhdGVTeW1ib2xzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN5bWJvbDtcbiAgICB2YXIgY2xhc3NicmVha3MgPSB0aGlzLl9yZW5kZXJlckpzb24uY2xhc3NCcmVha0luZm9zO1xuXG4gICAgdGhpcy5fc3ltYm9scyA9IFtdO1xuXG4gICAgLy8gY3JlYXRlIGEgc3ltYm9sIGZvciBlYWNoIGNsYXNzIGJyZWFrXG4gICAgZm9yICh2YXIgaSA9IGNsYXNzYnJlYWtzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLnByb3BvcnRpb25hbFBvbHlnb24gJiYgdGhpcy5fcmVuZGVyZXJKc29uLmJhY2tncm91bmRGaWxsU3ltYm9sKSB7XG4gICAgICAgIHN5bWJvbCA9IHRoaXMuX25ld1N5bWJvbCh0aGlzLl9yZW5kZXJlckpzb24uYmFja2dyb3VuZEZpbGxTeW1ib2wpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3ltYm9sID0gdGhpcy5fbmV3U3ltYm9sKGNsYXNzYnJlYWtzW2ldLnN5bWJvbCk7XG4gICAgICB9XG4gICAgICBzeW1ib2wudmFsID0gY2xhc3NicmVha3NbaV0uY2xhc3NNYXhWYWx1ZTtcbiAgICAgIHRoaXMuX3N5bWJvbHMucHVzaChzeW1ib2wpO1xuICAgIH1cbiAgICAvLyBzb3J0IHRoZSBzeW1ib2xzIGluIGFzY2VuZGluZyB2YWx1ZVxuICAgIHRoaXMuX3N5bWJvbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgcmV0dXJuIGEudmFsID4gYi52YWwgPyAxIDogLTE7XG4gICAgfSk7XG4gICAgdGhpcy5fY3JlYXRlRGVmYXVsdFN5bWJvbCgpO1xuICAgIHRoaXMuX21heFZhbHVlID0gdGhpcy5fc3ltYm9sc1t0aGlzLl9zeW1ib2xzLmxlbmd0aCAtIDFdLnZhbDtcbiAgfSxcblxuICBfZ2V0U3ltYm9sOiBmdW5jdGlvbiAoZmVhdHVyZSkge1xuICAgIHZhciB2YWwgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fZmllbGRdO1xuICAgIGlmICh0aGlzLl9ub3JtYWxpemF0aW9uRmllbGQpIHtcbiAgICAgIHZhciBub3JtVmFsdWUgPSBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5fbm9ybWFsaXphdGlvbkZpZWxkXTtcbiAgICAgIGlmICghaXNOYU4obm9ybVZhbHVlKSAmJiBub3JtVmFsdWUgIT09IDApIHtcbiAgICAgICAgdmFsID0gdmFsIC8gbm9ybVZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRTeW1ib2w7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHZhbCA+IHRoaXMuX21heFZhbHVlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVmYXVsdFN5bWJvbDtcbiAgICB9XG4gICAgdmFyIHN5bWJvbCA9IHRoaXMuX3N5bWJvbHNbMF07XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX3N5bWJvbHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh2YWwgPiB0aGlzLl9zeW1ib2xzW2ldLnZhbCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHN5bWJvbCA9IHRoaXMuX3N5bWJvbHNbaV07XG4gICAgfVxuICAgIHJldHVybiBzeW1ib2w7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NCcmVha3NSZW5kZXJlciAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgQ2xhc3NCcmVha3NSZW5kZXJlcihyZW5kZXJlckpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzc0JyZWFrc1JlbmRlcmVyO1xuIiwiaW1wb3J0IFJlbmRlcmVyIGZyb20gJy4vUmVuZGVyZXInO1xuXG5leHBvcnQgdmFyIFVuaXF1ZVZhbHVlUmVuZGVyZXIgPSBSZW5kZXJlci5leHRlbmQoe1xuICBpbml0aWFsaXplOiBmdW5jdGlvbiAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gICAgUmVuZGVyZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCByZW5kZXJlckpzb24sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2ZpZWxkID0gdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkMTtcbiAgICB0aGlzLl9jcmVhdGVTeW1ib2xzKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVN5bWJvbHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3ltYm9sO1xuICAgIHZhciB1bmlxdWVzID0gdGhpcy5fcmVuZGVyZXJKc29uLnVuaXF1ZVZhbHVlSW5mb3M7XG5cbiAgICAvLyBjcmVhdGUgYSBzeW1ib2wgZm9yIGVhY2ggdW5pcXVlIHZhbHVlXG4gICAgZm9yICh2YXIgaSA9IHVuaXF1ZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHN5bWJvbCA9IHRoaXMuX25ld1N5bWJvbCh1bmlxdWVzW2ldLnN5bWJvbCk7XG4gICAgICBzeW1ib2wudmFsID0gdW5pcXVlc1tpXS52YWx1ZTtcbiAgICAgIHRoaXMuX3N5bWJvbHMucHVzaChzeW1ib2wpO1xuICAgIH1cbiAgICB0aGlzLl9jcmVhdGVEZWZhdWx0U3ltYm9sKCk7XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKGZlYXR1cmUpIHtcbiAgICB2YXIgdmFsID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX2ZpZWxkXTtcbiAgICAvLyBhY2N1bXVsYXRlIHZhbHVlcyBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGZpZWxkIGRlZmluZWRcbiAgICBpZiAodGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkRGVsaW1pdGVyICYmIHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZDIpIHtcbiAgICAgIHZhciB2YWwyID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX3JlbmRlcmVySnNvbi5maWVsZDJdO1xuICAgICAgaWYgKHZhbDIpIHtcbiAgICAgICAgdmFsICs9IHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZERlbGltaXRlciArIHZhbDI7XG4gICAgICAgIHZhciB2YWwzID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX3JlbmRlcmVySnNvbi5maWVsZDNdO1xuICAgICAgICBpZiAodmFsMykge1xuICAgICAgICAgIHZhbCArPSB0aGlzLl9yZW5kZXJlckpzb24uZmllbGREZWxpbWl0ZXIgKyB2YWwzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHN5bWJvbCA9IHRoaXMuX2RlZmF1bHRTeW1ib2w7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX3N5bWJvbHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIC8vIHVzaW5nIHRoZSA9PT0gb3BlcmF0b3IgZG9lcyBub3Qgd29yayBpZiB0aGUgZmllbGRcbiAgICAgIC8vIG9mIHRoZSB1bmlxdWUgcmVuZGVyZXIgaXMgbm90IGEgc3RyaW5nXG4gICAgICAvKmVzbGludC1kaXNhYmxlICovXG4gICAgICBpZiAodGhpcy5fc3ltYm9sc1tpXS52YWwgPT0gdmFsKSB7XG4gICAgICAgIHN5bWJvbCA9IHRoaXMuX3N5bWJvbHNbaV07XG4gICAgICB9XG4gICAgICAvKmVzbGludC1lbmFibGUgKi9cbiAgICB9XG4gICAgcmV0dXJuIHN5bWJvbDtcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxdWVWYWx1ZVJlbmRlcmVyIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBVbmlxdWVWYWx1ZVJlbmRlcmVyKHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHVuaXF1ZVZhbHVlUmVuZGVyZXI7XG4iLCJpbXBvcnQgUmVuZGVyZXIgZnJvbSAnLi9SZW5kZXJlcic7XG5cbmV4cG9ydCB2YXIgU2ltcGxlUmVuZGVyZXIgPSBSZW5kZXJlci5leHRlbmQoe1xuICBpbml0aWFsaXplOiBmdW5jdGlvbiAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gICAgUmVuZGVyZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCByZW5kZXJlckpzb24sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2NyZWF0ZVN5bWJvbCgpO1xuICB9LFxuXG4gIF9jcmVhdGVTeW1ib2w6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fcmVuZGVyZXJKc29uLnN5bWJvbCkge1xuICAgICAgdGhpcy5fc3ltYm9scy5wdXNoKHRoaXMuX25ld1N5bWJvbCh0aGlzLl9yZW5kZXJlckpzb24uc3ltYm9sKSk7XG4gICAgfVxuICB9LFxuXG4gIF9nZXRTeW1ib2w6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc3ltYm9sc1swXTtcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBzaW1wbGVSZW5kZXJlciAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgU2ltcGxlUmVuZGVyZXIocmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgc2ltcGxlUmVuZGVyZXI7XG4iLCJpbXBvcnQgeyBjbGFzc0JyZWFrc1JlbmRlcmVyIH0gZnJvbSAnZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL0NsYXNzQnJlYWtzUmVuZGVyZXInO1xyXG5pbXBvcnQgeyB1bmlxdWVWYWx1ZVJlbmRlcmVyIH0gZnJvbSAnZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1VuaXF1ZVZhbHVlUmVuZGVyZXInO1xyXG5pbXBvcnQgeyBzaW1wbGVSZW5kZXJlciB9IGZyb20gJ2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlcic7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2V0UmVuZGVyZXIgKGxheWVyRGVmaW5pdGlvbiwgbGF5ZXIpIHtcclxuICB2YXIgcmVuZDtcclxuICB2YXIgcmVuZGVyZXJJbmZvID0gbGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyO1xyXG5cclxuICB2YXIgb3B0aW9ucyA9IHt9O1xyXG5cclxuICBpZiAobGF5ZXIub3B0aW9ucy5wYW5lKSB7XHJcbiAgICBvcHRpb25zLnBhbmUgPSBsYXllci5vcHRpb25zLnBhbmU7XHJcbiAgfVxyXG4gIGlmIChsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8udHJhbnNwYXJlbmN5KSB7XHJcbiAgICBvcHRpb25zLmxheWVyVHJhbnNwYXJlbmN5ID0gbGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeTtcclxuICB9XHJcbiAgaWYgKGxheWVyLm9wdGlvbnMuc3R5bGUpIHtcclxuICAgIG9wdGlvbnMudXNlckRlZmluZWRTdHlsZSA9IGxheWVyLm9wdGlvbnMuc3R5bGU7XHJcbiAgfVxyXG5cclxuICBzd2l0Y2ggKHJlbmRlcmVySW5mby50eXBlKSB7XHJcbiAgICBjYXNlICdjbGFzc0JyZWFrcyc6XHJcbiAgICAgIGNoZWNrRm9yUHJvcG9ydGlvbmFsU3ltYm9scyhsYXllckRlZmluaXRpb24uZ2VvbWV0cnlUeXBlLCByZW5kZXJlckluZm8sIGxheWVyKTtcclxuICAgICAgaWYgKGxheWVyLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzKSB7XHJcbiAgICAgICAgbGF5ZXIuX2NyZWF0ZVBvaW50TGF5ZXIoKTtcclxuICAgICAgICB2YXIgcFJlbmQgPSBjbGFzc0JyZWFrc1JlbmRlcmVyKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XHJcbiAgICAgICAgcFJlbmQuYXR0YWNoU3R5bGVzVG9MYXllcihsYXllci5fcG9pbnRMYXllcik7XHJcbiAgICAgICAgb3B0aW9ucy5wcm9wb3J0aW9uYWxQb2x5Z29uID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgICByZW5kID0gY2xhc3NCcmVha3NSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ3VuaXF1ZVZhbHVlJzpcclxuICAgICAgY29uc29sZS5sb2cocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgcmVuZCA9IHVuaXF1ZVZhbHVlUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICByZW5kID0gc2ltcGxlUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICB9XHJcbiAgcmVuZC5hdHRhY2hTdHlsZXNUb0xheWVyKGxheWVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrRm9yUHJvcG9ydGlvbmFsU3ltYm9scyAoZ2VvbWV0cnlUeXBlLCByZW5kZXJlciwgbGF5ZXIpIHtcclxuICBsYXllci5faGFzUHJvcG9ydGlvbmFsU3ltYm9scyA9IGZhbHNlO1xyXG4gIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2x5Z29uJykge1xyXG4gICAgaWYgKHJlbmRlcmVyLmJhY2tncm91bmRGaWxsU3ltYm9sKSB7XHJcbiAgICAgIGxheWVyLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIC8vIGNoZWNrIHRvIHNlZSBpZiB0aGUgZmlyc3Qgc3ltYm9sIGluIHRoZSBjbGFzc2JyZWFrcyBpcyBhIG1hcmtlciBzeW1ib2xcclxuICAgIGlmIChyZW5kZXJlci5jbGFzc0JyZWFrSW5mb3MgJiYgcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zLmxlbmd0aCkge1xyXG4gICAgICB2YXIgc3ltID0gcmVuZGVyZXIuY2xhc3NCcmVha0luZm9zWzBdLnN5bWJvbDtcclxuICAgICAgaWYgKHN5bSAmJiAoc3ltLnR5cGUgPT09ICdlc3JpU01TJyB8fCBzeW0udHlwZSA9PT0gJ2VzcmlQTVMnKSkge1xyXG4gICAgICAgIGxheWVyLl9oYXNQcm9wb3J0aW9uYWxTeW1ib2xzID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBSZW5kZXJlciA9IHtcclxuICBzZXRSZW5kZXJlcjogc2V0UmVuZGVyZXIsXHJcbiAgY2hlY2tGb3JQcm9wb3J0aW9uYWxTeW1ib2xzOiBjaGVja0ZvclByb3BvcnRpb25hbFN5bWJvbHNcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFJlbmRlcmVyO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuXHJcbmltcG9ydCB7IGFyY2dpc1RvR2VvSlNPTiB9IGZyb20gJ2FyY2dpcy10by1nZW9qc29uLXV0aWxzJztcclxuaW1wb3J0IHsgc2V0UmVuZGVyZXIgfSBmcm9tICcuL1JlbmRlcmVyJztcclxuXHJcbmV4cG9ydCB2YXIgRmVhdHVyZUNvbGxlY3Rpb24gPSBMLkdlb0pTT04uZXh0ZW5kKHtcclxuICBvcHRpb25zOiB7XHJcbiAgICBkYXRhOiB7fSwgLy8gRXNyaSBGZWF0dXJlIENvbGxlY3Rpb24gSlNPTiBvciBJdGVtIElEXHJcbiAgICBvcGFjaXR5OiAxXHJcbiAgfSxcclxuXHJcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxheWVycywgb3B0aW9ucykge1xyXG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuZGF0YSA9IHRoaXMub3B0aW9ucy5kYXRhO1xyXG4gICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5vcHRpb25zLm9wYWNpdHk7XHJcbiAgICB0aGlzLnBvcHVwSW5mbyA9IG51bGw7XHJcbiAgICB0aGlzLmxhYmVsaW5nSW5mbyA9IG51bGw7XHJcbiAgICB0aGlzLl9sYXllcnMgPSB7fTtcclxuXHJcbiAgICB2YXIgaSwgbGVuO1xyXG5cclxuICAgIGlmIChsYXllcnMpIHtcclxuICAgICAgZm9yIChpID0gMCwgbGVuID0gbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5hZGRMYXllcihsYXllcnNbaV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiB0aGlzLmRhdGEgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHRoaXMuX2dldEZlYXR1cmVDb2xsZWN0aW9uKHRoaXMuZGF0YSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uKHRoaXMuZGF0YSk7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgX2dldEZlYXR1cmVDb2xsZWN0aW9uOiBmdW5jdGlvbiAoaXRlbUlkKSB7XHJcbiAgICB2YXIgdXJsID0gJ2h0dHBzOi8vd3d3LmFyY2dpcy5jb20vc2hhcmluZy9yZXN0L2NvbnRlbnQvaXRlbXMvJyArIGl0ZW1JZCArICcvZGF0YSc7XHJcbiAgICBMLmVzcmkucmVxdWVzdCh1cmwsIHt9LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcclxuICAgICAgaWYgKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5fcGFyc2VGZWF0dXJlQ29sbGVjdGlvbihyZXMpO1xyXG4gICAgICB9XHJcbiAgICB9LCB0aGlzKTtcclxuICB9LFxyXG5cclxuICBfcGFyc2VGZWF0dXJlQ29sbGVjdGlvbjogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgIHZhciBpLCBsZW47XHJcbiAgICB2YXIgaW5kZXggPSAwO1xyXG4gICAgZm9yIChpID0gMCwgbGVuID0gZGF0YS5sYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgaWYgKGRhdGEubGF5ZXJzW2ldLmZlYXR1cmVTZXQuZmVhdHVyZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGluZGV4ID0gaTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdmFyIGZlYXR1cmVzID0gZGF0YS5sYXllcnNbaW5kZXhdLmZlYXR1cmVTZXQuZmVhdHVyZXM7XHJcbiAgICB2YXIgZ2VvbWV0cnlUeXBlID0gZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbi5nZW9tZXRyeVR5cGU7IC8vICdlc3JpR2VvbWV0cnlQb2ludCcgfCAnZXNyaUdlb21ldHJ5TXVsdGlwb2ludCcgfCAnZXNyaUdlb21ldHJ5UG9seWxpbmUnIHwgJ2VzcmlHZW9tZXRyeVBvbHlnb24nIHwgJ2VzcmlHZW9tZXRyeUVudmVsb3BlJ1xyXG4gICAgdmFyIG9iamVjdElkRmllbGQgPSBkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uLm9iamVjdElkRmllbGQ7XHJcbiAgICB2YXIgbGF5ZXJEZWZpbml0aW9uID0gZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbiB8fCBudWxsO1xyXG5cclxuICAgIGlmIChkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uLmV4dGVudC5zcGF0aWFsUmVmZXJlbmNlLndraWQgIT09IDQzMjYpIHtcclxuICAgICAgaWYgKGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24uZXh0ZW50LnNwYXRpYWxSZWZlcmVuY2Uud2tpZCAhPT0gMTAyMTAwKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignW0wuZXNyaS5XZWJNYXBdIHRoaXMgd2tpZCAoJyArIGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24uZXh0ZW50LnNwYXRpYWxSZWZlcmVuY2Uud2tpZCArICcpIGlzIG5vdCBzdXBwb3J0ZWQuJyk7XHJcbiAgICAgIH1cclxuICAgICAgZmVhdHVyZXMgPSB0aGlzLl9wcm9qVG80MzI2KGZlYXR1cmVzLCBnZW9tZXRyeVR5cGUpO1xyXG4gICAgfVxyXG4gICAgaWYgKGRhdGEubGF5ZXJzW2luZGV4XS5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLnBvcHVwSW5mbyA9IGRhdGEubGF5ZXJzW2luZGV4XS5wb3B1cEluZm87XHJcbiAgICB9XHJcbiAgICBpZiAoZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLmxhYmVsaW5nSW5mbyA9IGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xyXG4gICAgfVxyXG4gICAgY29uc29sZS5sb2coZGF0YSk7XHJcblxyXG4gICAgdmFyIGdlb2pzb24gPSB0aGlzLl9mZWF0dXJlQ29sbGVjdGlvblRvR2VvSlNPTihmZWF0dXJlcywgb2JqZWN0SWRGaWVsZCk7XHJcblxyXG4gICAgaWYgKGxheWVyRGVmaW5pdGlvbiAhPT0gbnVsbCkge1xyXG4gICAgICBzZXRSZW5kZXJlcihsYXllckRlZmluaXRpb24sIHRoaXMpO1xyXG4gICAgfVxyXG4gICAgY29uc29sZS5sb2coZ2VvanNvbik7XHJcbiAgICB0aGlzLmFkZERhdGEoZ2VvanNvbik7XHJcbiAgfSxcclxuXHJcbiAgX3Byb2pUbzQzMjY6IGZ1bmN0aW9uIChmZWF0dXJlcywgZ2VvbWV0cnlUeXBlKSB7XHJcbiAgICBjb25zb2xlLmxvZygnX3Byb2plY3QhJyk7XHJcbiAgICB2YXIgaSwgbGVuO1xyXG4gICAgdmFyIHByb2pGZWF0dXJlcyA9IFtdO1xyXG5cclxuICAgIGZvciAoaSA9IDAsIGxlbiA9IGZlYXR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIHZhciBmID0gZmVhdHVyZXNbaV07XHJcbiAgICAgIHZhciBtZXJjYXRvclRvTGF0bG5nO1xyXG4gICAgICB2YXIgaiwgaztcclxuXHJcbiAgICAgIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2ludCcpIHtcclxuICAgICAgICBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGYuZ2VvbWV0cnkueCwgZi5nZW9tZXRyeS55KSk7XHJcbiAgICAgICAgZi5nZW9tZXRyeS54ID0gbWVyY2F0b3JUb0xhdGxuZy5sbmc7XHJcbiAgICAgICAgZi5nZW9tZXRyeS55ID0gbWVyY2F0b3JUb0xhdGxuZy5sYXQ7XHJcbiAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5TXVsdGlwb2ludCcpIHtcclxuICAgICAgICB2YXIgcGxlbjtcclxuXHJcbiAgICAgICAgZm9yIChqID0gMCwgcGxlbiA9IGYuZ2VvbWV0cnkucG9pbnRzLmxlbmd0aDsgaiA8IHBsZW47IGorKykge1xyXG4gICAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmLmdlb21ldHJ5LnBvaW50c1tqXVswXSwgZi5nZW9tZXRyeS5wb2ludHNbal1bMV0pKTtcclxuICAgICAgICAgIGYuZ2VvbWV0cnkucG9pbnRzW2pdWzBdID0gbWVyY2F0b3JUb0xhdGxuZy5sbmc7XHJcbiAgICAgICAgICBmLmdlb21ldHJ5LnBvaW50c1tqXVsxXSA9IG1lcmNhdG9yVG9MYXRsbmcubGF0O1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2x5bGluZScpIHtcclxuICAgICAgICB2YXIgcGF0aGxlbiwgcGF0aHNsZW47XHJcblxyXG4gICAgICAgIGZvciAoaiA9IDAsIHBhdGhzbGVuID0gZi5nZW9tZXRyeS5wYXRocy5sZW5ndGg7IGogPCBwYXRoc2xlbjsgaisrKSB7XHJcbiAgICAgICAgICBmb3IgKGsgPSAwLCBwYXRobGVuID0gZi5nZW9tZXRyeS5wYXRoc1tqXS5sZW5ndGg7IGsgPCBwYXRobGVuOyBrKyspIHtcclxuICAgICAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmLmdlb21ldHJ5LnBhdGhzW2pdW2tdWzBdLCBmLmdlb21ldHJ5LnBhdGhzW2pdW2tdWzFdKSk7XHJcbiAgICAgICAgICAgIGYuZ2VvbWV0cnkucGF0aHNbal1ba11bMF0gPSBtZXJjYXRvclRvTGF0bG5nLmxuZztcclxuICAgICAgICAgICAgZi5nZW9tZXRyeS5wYXRoc1tqXVtrXVsxXSA9IG1lcmNhdG9yVG9MYXRsbmcubGF0O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmIChnZW9tZXRyeVR5cGUgPT09ICdlc3JpR2VvbWV0cnlQb2x5Z29uJykge1xyXG4gICAgICAgIHZhciByaW5nbGVuLCByaW5nc2xlbjtcclxuXHJcbiAgICAgICAgZm9yIChqID0gMCwgcmluZ3NsZW4gPSBmLmdlb21ldHJ5LnJpbmdzLmxlbmd0aDsgaiA8IHJpbmdzbGVuOyBqKyspIHtcclxuICAgICAgICAgIGZvciAoayA9IDAsIHJpbmdsZW4gPSBmLmdlb21ldHJ5LnJpbmdzW2pdLmxlbmd0aDsgayA8IHJpbmdsZW47IGsrKykge1xyXG4gICAgICAgICAgICBtZXJjYXRvclRvTGF0bG5nID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGYuZ2VvbWV0cnkucmluZ3Nbal1ba11bMF0sIGYuZ2VvbWV0cnkucmluZ3Nbal1ba11bMV0pKTtcclxuICAgICAgICAgICAgZi5nZW9tZXRyeS5yaW5nc1tqXVtrXVswXSA9IG1lcmNhdG9yVG9MYXRsbmcubG5nO1xyXG4gICAgICAgICAgICBmLmdlb21ldHJ5LnJpbmdzW2pdW2tdWzFdID0gbWVyY2F0b3JUb0xhdGxuZy5sYXQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHByb2pGZWF0dXJlcy5wdXNoKGYpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwcm9qRmVhdHVyZXM7XHJcbiAgfSxcclxuXHJcbiAgX2ZlYXR1cmVDb2xsZWN0aW9uVG9HZW9KU09OOiBmdW5jdGlvbiAoZmVhdHVyZXMsIG9iamVjdElkRmllbGQpIHtcclxuICAgIHZhciBnZW9qc29uRmVhdHVyZUNvbGxlY3Rpb24gPSB7XHJcbiAgICAgIHR5cGU6ICdGZWF0dXJlQ29sbGVjdGlvbicsXHJcbiAgICAgIGZlYXR1cmVzOiBbXVxyXG4gICAgfTtcclxuICAgIHZhciBmZWF0dXJlc0FycmF5ID0gW107XHJcbiAgICB2YXIgaSwgbGVuO1xyXG5cclxuICAgIGZvciAoaSA9IDAsIGxlbiA9IGZlYXR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIHZhciBnZW9qc29uID0gYXJjZ2lzVG9HZW9KU09OKGZlYXR1cmVzW2ldLCBvYmplY3RJZEZpZWxkKTtcclxuICAgICAgZmVhdHVyZXNBcnJheS5wdXNoKGdlb2pzb24pO1xyXG4gICAgfVxyXG5cclxuICAgIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbi5mZWF0dXJlcyA9IGZlYXR1cmVzQXJyYXk7XHJcblxyXG4gICAgcmV0dXJuIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbjtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGZlYXR1cmVDb2xsZWN0aW9uIChnZW9qc29uLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBGZWF0dXJlQ29sbGVjdGlvbihnZW9qc29uLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZmVhdHVyZUNvbGxlY3Rpb247XHJcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5cclxuaW1wb3J0IG9tbml2b3JlIGZyb20gJ2xlYWZsZXQtb21uaXZvcmUnO1xyXG5pbXBvcnQgeyBzZXRSZW5kZXJlciB9IGZyb20gJy4vUmVuZGVyZXInO1xyXG5cclxuZXhwb3J0IHZhciBDU1ZMYXllciA9IEwuR2VvSlNPTi5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIHVybDogJycsXHJcbiAgICBkYXRhOiB7fSwgLy8gRXNyaSBGZWF0dXJlIENvbGxlY3Rpb24gSlNPTiBvciBJdGVtIElEXHJcbiAgICBvcGFjaXR5OiAxXHJcbiAgfSxcclxuXHJcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxheWVycywgb3B0aW9ucykge1xyXG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMudXJsID0gdGhpcy5vcHRpb25zLnVybDtcclxuICAgIHRoaXMubGF5ZXJEZWZpbml0aW9uID0gdGhpcy5vcHRpb25zLmxheWVyRGVmaW5pdGlvbjtcclxuICAgIHRoaXMubG9jYXRpb25JbmZvID0gdGhpcy5vcHRpb25zLmxvY2F0aW9uSW5mbztcclxuICAgIHRoaXMub3BhY2l0eSA9IHRoaXMub3B0aW9ucy5vcGFjaXR5O1xyXG4gICAgdGhpcy5fbGF5ZXJzID0ge307XHJcblxyXG4gICAgdmFyIGksIGxlbjtcclxuXHJcbiAgICBpZiAobGF5ZXJzKSB7XHJcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIHRoaXMuYWRkTGF5ZXIobGF5ZXJzW2ldKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3BhcnNlQ1NWKHRoaXMudXJsLCB0aGlzLmxheWVyRGVmaW5pdGlvbiwgdGhpcy5sb2NhdGlvbkluZm8pO1xyXG4gIH0sXHJcblxyXG4gIF9wYXJzZUNTVjogZnVuY3Rpb24gKHVybCwgbGF5ZXJEZWZpbml0aW9uLCBsb2NhdGlvbkluZm8pIHtcclxuICAgIG9tbml2b3JlLmNzdih1cmwsIHtcclxuICAgICAgbGF0ZmllbGQ6IGxvY2F0aW9uSW5mby5sYXRpdHVkZUZpZWxkTmFtZSxcclxuICAgICAgbG9uZmllbGQ6IGxvY2F0aW9uSW5mby5sb25naXR1ZGVGaWVsZE5hbWVcclxuICAgIH0sIHRoaXMpO1xyXG5cclxuICAgIHNldFJlbmRlcmVyKGxheWVyRGVmaW5pdGlvbiwgdGhpcyk7XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjc3ZMYXllciAoZ2VvanNvbiwgb3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgQ1NWTGF5ZXIoZ2VvanNvbiwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IENTVkxheWVyO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuXHJcbmltcG9ydCB7IGFyY2dpc1RvR2VvSlNPTiB9IGZyb20gJ2FyY2dpcy10by1nZW9qc29uLXV0aWxzJztcclxuaW1wb3J0IHsgc2V0UmVuZGVyZXIgfSBmcm9tICcuL1JlbmRlcmVyJztcclxuXHJcbmV4cG9ydCB2YXIgS01MTGF5ZXIgPSBMLkdlb0pTT04uZXh0ZW5kKHtcclxuICBvcHRpb25zOiB7XHJcbiAgICBvcGFjaXR5OiAxLFxyXG4gICAgdXJsOiAnJ1xyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXllcnMsIG9wdGlvbnMpIHtcclxuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLnVybCA9IHRoaXMub3B0aW9ucy51cmw7XHJcbiAgICB0aGlzLm9wYWNpdHkgPSB0aGlzLm9wdGlvbnMub3BhY2l0eTtcclxuICAgIHRoaXMucG9wdXBJbmZvID0gbnVsbDtcclxuICAgIHRoaXMubGFiZWxpbmdJbmZvID0gbnVsbDtcclxuICAgIHRoaXMuX2xheWVycyA9IHt9O1xyXG5cclxuICAgIHZhciBpLCBsZW47XHJcblxyXG4gICAgaWYgKGxheWVycykge1xyXG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSBsYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICB0aGlzLmFkZExheWVyKGxheWVyc1tpXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9nZXRLTUwodGhpcy51cmwpO1xyXG4gIH0sXHJcblxyXG4gIF9nZXRLTUw6IGZ1bmN0aW9uICh1cmwpIHtcclxuICAgIHZhciByZXF1ZXN0VXJsID0gJ2h0dHA6Ly91dGlsaXR5LmFyY2dpcy5jb20vc2hhcmluZy9rbWw/dXJsPScgKyB1cmwgKyAnJm1vZGVsPXNpbXBsZSZmb2xkZXJzPSZvdXRTUj0lN0JcIndraWRcIiUzQTQzMjYlN0QnO1xyXG4gICAgTC5lc3JpLnJlcXVlc3QocmVxdWVzdFVybCwge30sIGZ1bmN0aW9uIChlcnIsIHJlcykge1xyXG4gICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZXJyKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhyZXMpO1xyXG4gICAgICAgIHRoaXMuX3BhcnNlRmVhdHVyZUNvbGxlY3Rpb24ocmVzLmZlYXR1cmVDb2xsZWN0aW9uKTtcclxuICAgICAgfVxyXG4gICAgfSwgdGhpcyk7XHJcbiAgfSxcclxuXHJcbiAgX3BhcnNlRmVhdHVyZUNvbGxlY3Rpb246IGZ1bmN0aW9uIChmZWF0dXJlQ29sbGVjdGlvbikge1xyXG4gICAgY29uc29sZS5sb2coJ19wYXJzZUZlYXR1cmVDb2xsZWN0aW9uJyk7XHJcbiAgICB2YXIgaTtcclxuICAgIGZvciAoaSA9IDA7IGkgPCAzOyBpKyspIHtcclxuICAgICAgaWYgKGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5mZWF0dXJlU2V0LmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhpKTtcclxuICAgICAgICB2YXIgZmVhdHVyZXMgPSBmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0uZmVhdHVyZVNldC5mZWF0dXJlcztcclxuICAgICAgICB2YXIgb2JqZWN0SWRGaWVsZCA9IGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5sYXllckRlZmluaXRpb24ub2JqZWN0SWRGaWVsZDtcclxuXHJcbiAgICAgICAgdmFyIGdlb2pzb24gPSB0aGlzLl9mZWF0dXJlQ29sbGVjdGlvblRvR2VvSlNPTihmZWF0dXJlcywgb2JqZWN0SWRGaWVsZCk7XHJcblxyXG4gICAgICAgIGlmIChmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHRoaXMucG9wdXBJbmZvID0gZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLnBvcHVwSW5mbztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHRoaXMubGFiZWxpbmdJbmZvID0gZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm87XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzZXRSZW5kZXJlcihmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ubGF5ZXJEZWZpbml0aW9uLCB0aGlzKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhnZW9qc29uKTtcclxuICAgICAgICB0aGlzLmFkZERhdGEoZ2VvanNvbik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG5cclxuICBfZmVhdHVyZUNvbGxlY3Rpb25Ub0dlb0pTT046IGZ1bmN0aW9uIChmZWF0dXJlcywgb2JqZWN0SWRGaWVsZCkge1xyXG4gICAgdmFyIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbiA9IHtcclxuICAgICAgdHlwZTogJ0ZlYXR1cmVDb2xsZWN0aW9uJyxcclxuICAgICAgZmVhdHVyZXM6IFtdXHJcbiAgICB9O1xyXG4gICAgdmFyIGZlYXR1cmVzQXJyYXkgPSBbXTtcclxuICAgIHZhciBpLCBsZW47XHJcblxyXG4gICAgZm9yIChpID0gMCwgbGVuID0gZmVhdHVyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgdmFyIGdlb2pzb24gPSBhcmNnaXNUb0dlb0pTT04oZmVhdHVyZXNbaV0sIG9iamVjdElkRmllbGQpO1xyXG4gICAgICBmZWF0dXJlc0FycmF5LnB1c2goZ2VvanNvbik7XHJcbiAgICB9XHJcblxyXG4gICAgZ2VvanNvbkZlYXR1cmVDb2xsZWN0aW9uLmZlYXR1cmVzID0gZmVhdHVyZXNBcnJheTtcclxuXHJcbiAgICByZXR1cm4gZ2VvanNvbkZlYXR1cmVDb2xsZWN0aW9uO1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24ga21sTGF5ZXIgKGdlb2pzb24sIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IEtNTExheWVyKGdlb2pzb24sIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBLTUxMYXllcjtcclxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcblxyXG5leHBvcnQgdmFyIExhYmVsSWNvbiA9IEwuRGl2SWNvbi5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIGljb25TaXplOiBudWxsLFxyXG4gICAgY2xhc3NOYW1lOiAnZXNyaS1sZWFmbGV0LXdlYm1hcC1sYWJlbHMnLFxyXG4gICAgdGV4dDogJydcclxuICB9LFxyXG5cclxuICBjcmVhdGVJY29uOiBmdW5jdGlvbiAob2xkSWNvbikge1xyXG4gICAgdmFyIGRpdiA9IChvbGRJY29uICYmIG9sZEljb24udGFnTmFtZSA9PT0gJ0RJVicpID8gb2xkSWNvbiA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XHJcblxyXG4gICAgZGl2LmlubmVySFRNTCA9ICc8ZGl2IHN0eWxlPVwicG9zaXRpb246IHJlbGF0aXZlOyBsZWZ0OiAtNTAlOyB0ZXh0LXNoYWRvdzogMXB4IDFweCAwcHggI2ZmZiwgLTFweCAxcHggMHB4ICNmZmYsIDFweCAtMXB4IDBweCAjZmZmLCAtMXB4IC0xcHggMHB4ICNmZmY7XCI+JyArIG9wdGlvbnMudGV4dCArICc8L2Rpdj4nO1xyXG5cclxuICAgIC8vIGxhYmVsLmNzc1xyXG4gICAgZGl2LnN0eWxlLmZvbnRTaXplID0gJzFlbSc7XHJcbiAgICBkaXYuc3R5bGUuZm9udFdlaWdodCA9ICdib2xkJztcclxuICAgIGRpdi5zdHlsZS50ZXh0VHJhbnNmb3JtID0gJ3VwcGVyY2FzZSc7XHJcbiAgICBkaXYuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XHJcbiAgICBkaXYuc3R5bGUud2hpdGVTcGFjZSA9ICdub3dyYXAnO1xyXG5cclxuICAgIGlmIChvcHRpb25zLmJnUG9zKSB7XHJcbiAgICAgIHZhciBiZ1BvcyA9IEwucG9pbnQob3B0aW9ucy5iZ1Bvcyk7XHJcbiAgICAgIGRpdi5zdHlsZS5iYWNrZ3JvdW5kUG9zaXRpb24gPSAoLWJnUG9zLngpICsgJ3B4ICcgKyAoLWJnUG9zLnkpICsgJ3B4JztcclxuICAgIH1cclxuICAgIHRoaXMuX3NldEljb25TdHlsZXMoZGl2LCAnaWNvbicpO1xyXG5cclxuICAgIHJldHVybiBkaXY7XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsYWJlbEljb24gKG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IExhYmVsSWNvbihvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbGFiZWxJY29uO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuaW1wb3J0IHsgbGFiZWxJY29uIH0gZnJvbSAnLi9MYWJlbEljb24nO1xyXG5cclxuZXhwb3J0IHZhciBMYWJlbE1hcmtlciA9IEwuTWFya2VyLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgcHJvcGVydGllczoge30sXHJcbiAgICBsYWJlbGluZ0luZm86IHt9LFxyXG4gICAgb2Zmc2V0OiBbMCwgMF1cclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF0bG5nLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcbiAgICB0aGlzLl9sYXRsbmcgPSBMLmxhdExuZyhsYXRsbmcpO1xyXG5cclxuICAgIHZhciBsYWJlbFRleHQgPSB0aGlzLl9jcmVhdGVMYWJlbFRleHQodGhpcy5vcHRpb25zLnByb3BlcnRpZXMsIHRoaXMub3B0aW9ucy5sYWJlbGluZ0luZm8pO1xyXG4gICAgdGhpcy5fc2V0TGFiZWxJY29uKGxhYmVsVGV4dCwgdGhpcy5vcHRpb25zLm9mZnNldCk7XHJcbiAgfSxcclxuXHJcbiAgX2NyZWF0ZUxhYmVsVGV4dDogZnVuY3Rpb24gKHByb3BlcnRpZXMsIGxhYmVsaW5nSW5mbykge1xyXG4gICAgdmFyIHIgPSAvXFxbKFteXFxdXSopXFxdL2c7XHJcbiAgICB2YXIgbGFiZWxUZXh0ID0gbGFiZWxpbmdJbmZvWzBdLmxhYmVsRXhwcmVzc2lvbjtcclxuXHJcbiAgICBsYWJlbFRleHQgPSBsYWJlbFRleHQucmVwbGFjZShyLCBmdW5jdGlvbiAocykge1xyXG4gICAgICB2YXIgbSA9IHIuZXhlYyhzKTtcclxuICAgICAgcmV0dXJuIHByb3BlcnRpZXNbbVsxXV07XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbGFiZWxUZXh0O1xyXG4gIH0sXHJcblxyXG4gIF9zZXRMYWJlbEljb246IGZ1bmN0aW9uICh0ZXh0LCBvZmZzZXQpIHtcclxuICAgIHZhciBpY29uID0gbGFiZWxJY29uKHtcclxuICAgICAgdGV4dDogdGV4dCxcclxuICAgICAgaWNvbkFuY2hvcjogb2Zmc2V0XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNldEljb24oaWNvbik7XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsYWJlbE1hcmtlciAobGF0bG5nLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBMYWJlbE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBsYWJlbE1hcmtlcjtcclxuIiwiZXhwb3J0IGZ1bmN0aW9uIHBvaW50TGFiZWxQb3MgKGNvb3JkaW5hdGVzKSB7XHJcbiAgdmFyIGxhYmVsUG9zID0geyBwb3NpdGlvbjogW10sIG9mZnNldDogW10gfTtcclxuXHJcbiAgbGFiZWxQb3MucG9zaXRpb24gPSBjb29yZGluYXRlcy5yZXZlcnNlKCk7XHJcbiAgbGFiZWxQb3Mub2Zmc2V0ID0gWzIwLCAyMF07XHJcblxyXG4gIHJldHVybiBsYWJlbFBvcztcclxufVxyXG5cclxuZXhwb3J0IHZhciBQb2ludExhYmVsID0ge1xyXG4gIHBvaW50TGFiZWxQb3M6IHBvaW50TGFiZWxQb3NcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvaW50TGFiZWw7XHJcbiIsImV4cG9ydCBmdW5jdGlvbiBwb2x5bGluZUxhYmVsUG9zIChjb29yZGluYXRlcykge1xyXG4gIHZhciBsYWJlbFBvcyA9IHsgcG9zaXRpb246IFtdLCBvZmZzZXQ6IFtdIH07XHJcbiAgdmFyIGNlbnRyYWxLZXk7XHJcblxyXG4gIGNlbnRyYWxLZXkgPSBNYXRoLnJvdW5kKGNvb3JkaW5hdGVzLmxlbmd0aCAvIDIpO1xyXG4gIGxhYmVsUG9zLnBvc2l0aW9uID0gY29vcmRpbmF0ZXNbY2VudHJhbEtleV0ucmV2ZXJzZSgpO1xyXG4gIGxhYmVsUG9zLm9mZnNldCA9IFswLCAwXTtcclxuXHJcbiAgcmV0dXJuIGxhYmVsUG9zO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIFBvbHlsaW5lTGFiZWwgPSB7XHJcbiAgcG9seWxpbmVMYWJlbFBvczogcG9seWxpbmVMYWJlbFBvc1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUG9seWxpbmVMYWJlbDtcclxuIiwiZXhwb3J0IGZ1bmN0aW9uIHBvbHlnb25MYWJlbFBvcyAobGF5ZXIsIGNvb3JkaW5hdGVzKSB7XHJcbiAgdmFyIGxhYmVsUG9zID0geyBwb3NpdGlvbjogW10sIG9mZnNldDogW10gfTtcclxuXHJcbiAgbGFiZWxQb3MucG9zaXRpb24gPSBsYXllci5nZXRCb3VuZHMoKS5nZXRDZW50ZXIoKTtcclxuICBsYWJlbFBvcy5vZmZzZXQgPSBbMCwgMF07XHJcblxyXG4gIHJldHVybiBsYWJlbFBvcztcclxufVxyXG5cclxuZXhwb3J0IHZhciBQb2x5Z29uTGFiZWwgPSB7XHJcbiAgcG9seWdvbkxhYmVsUG9zOiBwb2x5Z29uTGFiZWxQb3NcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvbHlnb25MYWJlbDtcclxuIiwidmFyIGdldERheU9mWWVhciA9IHJlcXVpcmUoJy4uL2dldF9kYXlfb2ZfeWVhci9pbmRleC5qcycpXG52YXIgZ2V0SVNPV2VlayA9IHJlcXVpcmUoJy4uL2dldF9pc29fd2Vlay9pbmRleC5qcycpXG52YXIgZ2V0SVNPWWVhciA9IHJlcXVpcmUoJy4uL2dldF9pc29feWVhci9pbmRleC5qcycpXG52YXIgcGFyc2UgPSByZXF1aXJlKCcuLi9wYXJzZS9pbmRleC5qcycpXG52YXIgaXNWYWxpZCA9IHJlcXVpcmUoJy4uL2lzX3ZhbGlkL2luZGV4LmpzJylcbnZhciBlbkxvY2FsZSA9IHJlcXVpcmUoJy4uL2xvY2FsZS9lbi9pbmRleC5qcycpXG5cbi8qKlxuICogQGNhdGVnb3J5IENvbW1vbiBIZWxwZXJzXG4gKiBAc3VtbWFyeSBGb3JtYXQgdGhlIGRhdGUuXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBSZXR1cm4gdGhlIGZvcm1hdHRlZCBkYXRlIHN0cmluZyBpbiB0aGUgZ2l2ZW4gZm9ybWF0LlxuICpcbiAqIEFjY2VwdGVkIHRva2VuczpcbiAqIHwgVW5pdCAgICAgICAgICAgICAgICAgICAgfCBUb2tlbiB8IFJlc3VsdCBleGFtcGxlcyAgICAgICAgICAgICAgICAgIHxcbiAqIHwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAqIHwgTW9udGggICAgICAgICAgICAgICAgICAgfCBNICAgICB8IDEsIDIsIC4uLiwgMTIgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBNbyAgICB8IDFzdCwgMm5kLCAuLi4sIDEydGggICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBNTSAgICB8IDAxLCAwMiwgLi4uLCAxMiAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBNTU0gICB8IEphbiwgRmViLCAuLi4sIERlYyAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBNTU1NICB8IEphbnVhcnksIEZlYnJ1YXJ5LCAuLi4sIERlY2VtYmVyIHxcbiAqIHwgUXVhcnRlciAgICAgICAgICAgICAgICAgfCBRICAgICB8IDEsIDIsIDMsIDQgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBRbyAgICB8IDFzdCwgMm5kLCAzcmQsIDR0aCAgICAgICAgICAgICAgIHxcbiAqIHwgRGF5IG9mIG1vbnRoICAgICAgICAgICAgfCBEICAgICB8IDEsIDIsIC4uLiwgMzEgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBEbyAgICB8IDFzdCwgMm5kLCAuLi4sIDMxc3QgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBERCAgICB8IDAxLCAwMiwgLi4uLCAzMSAgICAgICAgICAgICAgICAgIHxcbiAqIHwgRGF5IG9mIHllYXIgICAgICAgICAgICAgfCBEREQgICB8IDEsIDIsIC4uLiwgMzY2ICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBERERvICB8IDFzdCwgMm5kLCAuLi4sIDM2NnRoICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBEREREICB8IDAwMSwgMDAyLCAuLi4sIDM2NiAgICAgICAgICAgICAgIHxcbiAqIHwgRGF5IG9mIHdlZWsgICAgICAgICAgICAgfCBkICAgICB8IDAsIDEsIC4uLiwgNiAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBkbyAgICB8IDB0aCwgMXN0LCAuLi4sIDZ0aCAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBkZCAgICB8IFN1LCBNbywgLi4uLCBTYSAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBkZGQgICB8IFN1biwgTW9uLCAuLi4sIFNhdCAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBkZGRkICB8IFN1bmRheSwgTW9uZGF5LCAuLi4sIFNhdHVyZGF5ICAgIHxcbiAqIHwgRGF5IG9mIElTTyB3ZWVrICAgICAgICAgfCBFICAgICB8IDEsIDIsIC4uLiwgNyAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgSVNPIHdlZWsgICAgICAgICAgICAgICAgfCBXICAgICB8IDEsIDIsIC4uLiwgNTMgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBXbyAgICB8IDFzdCwgMm5kLCAuLi4sIDUzcmQgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBXVyAgICB8IDAxLCAwMiwgLi4uLCA1MyAgICAgICAgICAgICAgICAgIHxcbiAqIHwgWWVhciAgICAgICAgICAgICAgICAgICAgfCBZWSAgICB8IDAwLCAwMSwgLi4uLCA5OSAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBZWVlZICB8IDE5MDAsIDE5MDEsIC4uLiwgMjA5OSAgICAgICAgICAgIHxcbiAqIHwgSVNPIHdlZWstbnVtYmVyaW5nIHllYXIgfCBHRyAgICB8IDAwLCAwMSwgLi4uLCA5OSAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBHR0dHICB8IDE5MDAsIDE5MDEsIC4uLiwgMjA5OSAgICAgICAgICAgIHxcbiAqIHwgQU0vUE0gICAgICAgICAgICAgICAgICAgfCBBICAgICB8IEFNLCBQTSAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBhICAgICB8IGFtLCBwbSAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBhYSAgICB8IGEubS4sIHAubS4gICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgSG91ciAgICAgICAgICAgICAgICAgICAgfCBIICAgICB8IDAsIDEsIC4uLiAyMyAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBISCAgICB8IDAwLCAwMSwgLi4uIDIzICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBoICAgICB8IDEsIDIsIC4uLiwgMTIgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBoaCAgICB8IDAxLCAwMiwgLi4uLCAxMiAgICAgICAgICAgICAgICAgIHxcbiAqIHwgTWludXRlICAgICAgICAgICAgICAgICAgfCBtICAgICB8IDAsIDEsIC4uLiwgNTkgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBtbSAgICB8IDAwLCAwMSwgLi4uLCA1OSAgICAgICAgICAgICAgICAgIHxcbiAqIHwgU2Vjb25kICAgICAgICAgICAgICAgICAgfCBzICAgICB8IDAsIDEsIC4uLiwgNTkgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBzcyAgICB8IDAwLCAwMSwgLi4uLCA1OSAgICAgICAgICAgICAgICAgIHxcbiAqIHwgMS8xMCBvZiBzZWNvbmQgICAgICAgICAgfCBTICAgICB8IDAsIDEsIC4uLiwgOSAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgMS8xMDAgb2Ygc2Vjb25kICAgICAgICAgfCBTUyAgICB8IDAwLCAwMSwgLi4uLCA5OSAgICAgICAgICAgICAgICAgIHxcbiAqIHwgTWlsbGlzZWNvbmQgICAgICAgICAgICAgfCBTU1MgICB8IDAwMCwgMDAxLCAuLi4sIDk5OSAgICAgICAgICAgICAgIHxcbiAqIHwgVGltZXpvbmUgICAgICAgICAgICAgICAgfCBaICAgICB8IC0wMTowMCwgKzAwOjAwLCAuLi4gKzEyOjAwICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgfCBaWiAgICB8IC0wMTAwLCArMDAwMCwgLi4uLCArMTIwMCAgICAgICAgIHxcbiAqIHwgU2Vjb25kcyB0aW1lc3RhbXAgICAgICAgfCBYICAgICB8IDUxMjk2OTUyMCAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgTWlsbGlzZWNvbmRzIHRpbWVzdGFtcCAgfCB4ICAgICB8IDUxMjk2OTUyMDkwMCAgICAgICAgICAgICAgICAgICAgIHxcbiAqXG4gKiBUaGUgY2hhcmFjdGVycyB3cmFwcGVkIGluIHNxdWFyZSBicmFja2V0cyBhcmUgZXNjYXBlZC5cbiAqXG4gKiBUaGUgcmVzdWx0IG1heSB2YXJ5IGJ5IGxvY2FsZS5cbiAqXG4gKiBAcGFyYW0ge0RhdGV8U3RyaW5nfE51bWJlcn0gZGF0ZSAtIHRoZSBvcmlnaW5hbCBkYXRlXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zvcm1hdD0nWVlZWS1NTS1ERFRISDptbTpzcy5TU1NaJ10gLSB0aGUgc3RyaW5nIG9mIHRva2Vuc1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSAtIHRoZSBvYmplY3Qgd2l0aCBvcHRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubG9jYWxlPWVuTG9jYWxlXSAtIHRoZSBsb2NhbGUgb2JqZWN0XG4gKiBAcmV0dXJucyB7U3RyaW5nfSB0aGUgZm9ybWF0dGVkIGRhdGUgc3RyaW5nXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJlcHJlc2VudCAxMSBGZWJydWFyeSAyMDE0IGluIG1pZGRsZS1lbmRpYW4gZm9ybWF0OlxuICogdmFyIHJlc3VsdCA9IGZvcm1hdChcbiAqICAgbmV3IERhdGUoMjAxNCwgMSwgMTEpLFxuICogICAnTU0vREQvWVlZWSdcbiAqIClcbiAqIC8vPT4gJzAyLzExLzIwMTQnXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJlcHJlc2VudCAyIEp1bHkgMjAxNCBpbiBFc3BlcmFudG86XG4gKiB2YXIgZW9Mb2NhbGUgPSByZXF1aXJlKCdkYXRlLWZucy9sb2NhbGUvZW8nKVxuICogdmFyIHJlc3VsdCA9IGZvcm1hdChcbiAqICAgbmV3IERhdGUoMjAxNCwgNiwgMiksXG4gKiAgICdEbyBbZGVdIE1NTU0gWVlZWScsXG4gKiAgIHtsb2NhbGU6IGVvTG9jYWxlfVxuICogKVxuICogLy89PiAnMi1hIGRlIGp1bGlvIDIwMTQnXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdCAoZGlydHlEYXRlLCBkaXJ0eUZvcm1hdFN0ciwgZGlydHlPcHRpb25zKSB7XG4gIHZhciBmb3JtYXRTdHIgPSBkaXJ0eUZvcm1hdFN0ciA/IFN0cmluZyhkaXJ0eUZvcm1hdFN0cikgOiAnWVlZWS1NTS1ERFRISDptbTpzcy5TU1NaJ1xuICB2YXIgb3B0aW9ucyA9IGRpcnR5T3B0aW9ucyB8fCB7fVxuXG4gIHZhciBsb2NhbGUgPSBvcHRpb25zLmxvY2FsZVxuICB2YXIgbG9jYWxlRm9ybWF0dGVycyA9IGVuTG9jYWxlLmZvcm1hdC5mb3JtYXR0ZXJzXG4gIHZhciBmb3JtYXR0aW5nVG9rZW5zUmVnRXhwID0gZW5Mb2NhbGUuZm9ybWF0LmZvcm1hdHRpbmdUb2tlbnNSZWdFeHBcbiAgaWYgKGxvY2FsZSAmJiBsb2NhbGUuZm9ybWF0ICYmIGxvY2FsZS5mb3JtYXQuZm9ybWF0dGVycykge1xuICAgIGxvY2FsZUZvcm1hdHRlcnMgPSBsb2NhbGUuZm9ybWF0LmZvcm1hdHRlcnNcblxuICAgIGlmIChsb2NhbGUuZm9ybWF0LmZvcm1hdHRpbmdUb2tlbnNSZWdFeHApIHtcbiAgICAgIGZvcm1hdHRpbmdUb2tlbnNSZWdFeHAgPSBsb2NhbGUuZm9ybWF0LmZvcm1hdHRpbmdUb2tlbnNSZWdFeHBcbiAgICB9XG4gIH1cblxuICB2YXIgZGF0ZSA9IHBhcnNlKGRpcnR5RGF0ZSlcblxuICBpZiAoIWlzVmFsaWQoZGF0ZSkpIHtcbiAgICByZXR1cm4gJ0ludmFsaWQgRGF0ZSdcbiAgfVxuXG4gIHZhciBmb3JtYXRGbiA9IGJ1aWxkRm9ybWF0Rm4oZm9ybWF0U3RyLCBsb2NhbGVGb3JtYXR0ZXJzLCBmb3JtYXR0aW5nVG9rZW5zUmVnRXhwKVxuXG4gIHJldHVybiBmb3JtYXRGbihkYXRlKVxufVxuXG52YXIgZm9ybWF0dGVycyA9IHtcbiAgLy8gTW9udGg6IDEsIDIsIC4uLiwgMTJcbiAgJ00nOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBkYXRlLmdldE1vbnRoKCkgKyAxXG4gIH0sXG5cbiAgLy8gTW9udGg6IDAxLCAwMiwgLi4uLCAxMlxuICAnTU0nOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRNb250aCgpICsgMSwgMilcbiAgfSxcblxuICAvLyBRdWFydGVyOiAxLCAyLCAzLCA0XG4gICdRJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gTWF0aC5jZWlsKChkYXRlLmdldE1vbnRoKCkgKyAxKSAvIDMpXG4gIH0sXG5cbiAgLy8gRGF5IG9mIG1vbnRoOiAxLCAyLCAuLi4sIDMxXG4gICdEJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZGF0ZS5nZXREYXRlKClcbiAgfSxcblxuICAvLyBEYXkgb2YgbW9udGg6IDAxLCAwMiwgLi4uLCAzMVxuICAnREQnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXREYXRlKCksIDIpXG4gIH0sXG5cbiAgLy8gRGF5IG9mIHllYXI6IDEsIDIsIC4uLiwgMzY2XG4gICdEREQnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBnZXREYXlPZlllYXIoZGF0ZSlcbiAgfSxcblxuICAvLyBEYXkgb2YgeWVhcjogMDAxLCAwMDIsIC4uLiwgMzY2XG4gICdEREREJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGdldERheU9mWWVhcihkYXRlKSwgMylcbiAgfSxcblxuICAvLyBEYXkgb2Ygd2VlazogMCwgMSwgLi4uLCA2XG4gICdkJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZGF0ZS5nZXREYXkoKVxuICB9LFxuXG4gIC8vIERheSBvZiBJU08gd2VlazogMSwgMiwgLi4uLCA3XG4gICdFJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZGF0ZS5nZXREYXkoKSB8fCA3XG4gIH0sXG5cbiAgLy8gSVNPIHdlZWs6IDEsIDIsIC4uLiwgNTNcbiAgJ1cnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBnZXRJU09XZWVrKGRhdGUpXG4gIH0sXG5cbiAgLy8gSVNPIHdlZWs6IDAxLCAwMiwgLi4uLCA1M1xuICAnV1cnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZ2V0SVNPV2VlayhkYXRlKSwgMilcbiAgfSxcblxuICAvLyBZZWFyOiAwMCwgMDEsIC4uLiwgOTlcbiAgJ1lZJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGRhdGUuZ2V0RnVsbFllYXIoKSwgNCkuc3Vic3RyKDIpXG4gIH0sXG5cbiAgLy8gWWVhcjogMTkwMCwgMTkwMSwgLi4uLCAyMDk5XG4gICdZWVlZJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGRhdGUuZ2V0RnVsbFllYXIoKSwgNClcbiAgfSxcblxuICAvLyBJU08gd2Vlay1udW1iZXJpbmcgeWVhcjogMDAsIDAxLCAuLi4sIDk5XG4gICdHRyc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIFN0cmluZyhnZXRJU09ZZWFyKGRhdGUpKS5zdWJzdHIoMilcbiAgfSxcblxuICAvLyBJU08gd2Vlay1udW1iZXJpbmcgeWVhcjogMTkwMCwgMTkwMSwgLi4uLCAyMDk5XG4gICdHR0dHJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZ2V0SVNPWWVhcihkYXRlKVxuICB9LFxuXG4gIC8vIEhvdXI6IDAsIDEsIC4uLiAyM1xuICAnSCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGRhdGUuZ2V0SG91cnMoKVxuICB9LFxuXG4gIC8vIEhvdXI6IDAwLCAwMSwgLi4uLCAyM1xuICAnSEgnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRIb3VycygpLCAyKVxuICB9LFxuXG4gIC8vIEhvdXI6IDEsIDIsIC4uLiwgMTJcbiAgJ2gnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHZhciBob3VycyA9IGRhdGUuZ2V0SG91cnMoKVxuICAgIGlmIChob3VycyA9PT0gMCkge1xuICAgICAgcmV0dXJuIDEyXG4gICAgfSBlbHNlIGlmIChob3VycyA+IDEyKSB7XG4gICAgICByZXR1cm4gaG91cnMgJSAxMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaG91cnNcbiAgICB9XG4gIH0sXG5cbiAgLy8gSG91cjogMDEsIDAyLCAuLi4sIDEyXG4gICdoaCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhmb3JtYXR0ZXJzWydoJ10oZGF0ZSksIDIpXG4gIH0sXG5cbiAgLy8gTWludXRlOiAwLCAxLCAuLi4sIDU5XG4gICdtJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZGF0ZS5nZXRNaW51dGVzKClcbiAgfSxcblxuICAvLyBNaW51dGU6IDAwLCAwMSwgLi4uLCA1OVxuICAnbW0nOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRNaW51dGVzKCksIDIpXG4gIH0sXG5cbiAgLy8gU2Vjb25kOiAwLCAxLCAuLi4sIDU5XG4gICdzJzogZnVuY3Rpb24gKGRhdGUpIHtcbiAgICByZXR1cm4gZGF0ZS5nZXRTZWNvbmRzKClcbiAgfSxcblxuICAvLyBTZWNvbmQ6IDAwLCAwMSwgLi4uLCA1OVxuICAnc3MnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRTZWNvbmRzKCksIDIpXG4gIH0sXG5cbiAgLy8gMS8xMCBvZiBzZWNvbmQ6IDAsIDEsIC4uLiwgOVxuICAnUyc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IoZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSAvIDEwMClcbiAgfSxcblxuICAvLyAxLzEwMCBvZiBzZWNvbmQ6IDAwLCAwMSwgLi4uLCA5OVxuICAnU1MnOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoTWF0aC5mbG9vcihkYXRlLmdldE1pbGxpc2Vjb25kcygpIC8gMTApLCAyKVxuICB9LFxuXG4gIC8vIE1pbGxpc2Vjb25kOiAwMDAsIDAwMSwgLi4uLCA5OTlcbiAgJ1NTUyc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhkYXRlLmdldE1pbGxpc2Vjb25kcygpLCAzKVxuICB9LFxuXG4gIC8vIFRpbWV6b25lOiAtMDE6MDAsICswMDowMCwgLi4uICsxMjowMFxuICAnWic6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGZvcm1hdFRpbWV6b25lKGRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKSwgJzonKVxuICB9LFxuXG4gIC8vIFRpbWV6b25lOiAtMDEwMCwgKzAwMDAsIC4uLiArMTIwMFxuICAnWlonOiBmdW5jdGlvbiAoZGF0ZSkge1xuICAgIHJldHVybiBmb3JtYXRUaW1lem9uZShkYXRlLmdldFRpbWV6b25lT2Zmc2V0KCkpXG4gIH0sXG5cbiAgLy8gU2Vjb25kcyB0aW1lc3RhbXA6IDUxMjk2OTUyMFxuICAnWCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IoZGF0ZS5nZXRUaW1lKCkgLyAxMDAwKVxuICB9LFxuXG4gIC8vIE1pbGxpc2Vjb25kcyB0aW1lc3RhbXA6IDUxMjk2OTUyMDkwMFxuICAneCc6IGZ1bmN0aW9uIChkYXRlKSB7XG4gICAgcmV0dXJuIGRhdGUuZ2V0VGltZSgpXG4gIH1cbn1cblxuZnVuY3Rpb24gYnVpbGRGb3JtYXRGbiAoZm9ybWF0U3RyLCBsb2NhbGVGb3JtYXR0ZXJzLCBmb3JtYXR0aW5nVG9rZW5zUmVnRXhwKSB7XG4gIHZhciBhcnJheSA9IGZvcm1hdFN0ci5tYXRjaChmb3JtYXR0aW5nVG9rZW5zUmVnRXhwKVxuICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoXG5cbiAgdmFyIGlcbiAgdmFyIGZvcm1hdHRlclxuICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBmb3JtYXR0ZXIgPSBsb2NhbGVGb3JtYXR0ZXJzW2FycmF5W2ldXSB8fCBmb3JtYXR0ZXJzW2FycmF5W2ldXVxuICAgIGlmIChmb3JtYXR0ZXIpIHtcbiAgICAgIGFycmF5W2ldID0gZm9ybWF0dGVyXG4gICAgfSBlbHNlIHtcbiAgICAgIGFycmF5W2ldID0gcmVtb3ZlRm9ybWF0dGluZ1Rva2VucyhhcnJheVtpXSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24gKGRhdGUpIHtcbiAgICB2YXIgb3V0cHV0ID0gJydcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYXJyYXlbaV0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICBvdXRwdXQgKz0gYXJyYXlbaV0oZGF0ZSwgZm9ybWF0dGVycylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dCArPSBhcnJheVtpXVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlRm9ybWF0dGluZ1Rva2VucyAoaW5wdXQpIHtcbiAgaWYgKGlucHV0Lm1hdGNoKC9cXFtbXFxzXFxTXS8pKSB7XG4gICAgcmV0dXJuIGlucHV0LnJlcGxhY2UoL15cXFt8XSQvZywgJycpXG4gIH1cbiAgcmV0dXJuIGlucHV0LnJlcGxhY2UoL1xcXFwvZywgJycpXG59XG5cbmZ1bmN0aW9uIGZvcm1hdFRpbWV6b25lIChvZmZzZXQsIGRlbGltZXRlcikge1xuICBkZWxpbWV0ZXIgPSBkZWxpbWV0ZXIgfHwgJydcbiAgdmFyIHNpZ24gPSBvZmZzZXQgPiAwID8gJy0nIDogJysnXG4gIHZhciBhYnNPZmZzZXQgPSBNYXRoLmFicyhvZmZzZXQpXG4gIHZhciBob3VycyA9IE1hdGguZmxvb3IoYWJzT2Zmc2V0IC8gNjApXG4gIHZhciBtaW51dGVzID0gYWJzT2Zmc2V0ICUgNjBcbiAgcmV0dXJuIHNpZ24gKyBhZGRMZWFkaW5nWmVyb3MoaG91cnMsIDIpICsgZGVsaW1ldGVyICsgYWRkTGVhZGluZ1plcm9zKG1pbnV0ZXMsIDIpXG59XG5cbmZ1bmN0aW9uIGFkZExlYWRpbmdaZXJvcyAobnVtYmVyLCB0YXJnZXRMZW5ndGgpIHtcbiAgdmFyIG91dHB1dCA9IE1hdGguYWJzKG51bWJlcikudG9TdHJpbmcoKVxuICB3aGlsZSAob3V0cHV0Lmxlbmd0aCA8IHRhcmdldExlbmd0aCkge1xuICAgIG91dHB1dCA9ICcwJyArIG91dHB1dFxuICB9XG4gIHJldHVybiBvdXRwdXRcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmb3JtYXRcbiIsInZhciBwYXJzZSA9IHJlcXVpcmUoJy4uL3BhcnNlL2luZGV4LmpzJylcbnZhciBzdGFydE9mWWVhciA9IHJlcXVpcmUoJy4uL3N0YXJ0X29mX3llYXIvaW5kZXguanMnKVxudmFyIGRpZmZlcmVuY2VJbkNhbGVuZGFyRGF5cyA9IHJlcXVpcmUoJy4uL2RpZmZlcmVuY2VfaW5fY2FsZW5kYXJfZGF5cy9pbmRleC5qcycpXG5cbi8qKlxuICogQGNhdGVnb3J5IERheSBIZWxwZXJzXG4gKiBAc3VtbWFyeSBHZXQgdGhlIGRheSBvZiB0aGUgeWVhciBvZiB0aGUgZ2l2ZW4gZGF0ZS5cbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIEdldCB0aGUgZGF5IG9mIHRoZSB5ZWFyIG9mIHRoZSBnaXZlbiBkYXRlLlxuICpcbiAqIEBwYXJhbSB7RGF0ZXxTdHJpbmd8TnVtYmVyfSBkYXRlIC0gdGhlIGdpdmVuIGRhdGVcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IHRoZSBkYXkgb2YgeWVhclxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBXaGljaCBkYXkgb2YgdGhlIHllYXIgaXMgMiBKdWx5IDIwMTQ/XG4gKiB2YXIgcmVzdWx0ID0gZ2V0RGF5T2ZZZWFyKG5ldyBEYXRlKDIwMTQsIDYsIDIpKVxuICogLy89PiAxODNcbiAqL1xuZnVuY3Rpb24gZ2V0RGF5T2ZZZWFyIChkaXJ0eURhdGUpIHtcbiAgdmFyIGRhdGUgPSBwYXJzZShkaXJ0eURhdGUpXG4gIHZhciBkaWZmID0gZGlmZmVyZW5jZUluQ2FsZW5kYXJEYXlzKGRhdGUsIHN0YXJ0T2ZZZWFyKGRhdGUpKVxuICB2YXIgZGF5T2ZZZWFyID0gZGlmZiArIDFcbiAgcmV0dXJuIGRheU9mWWVhclxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldERheU9mWWVhclxuIiwidmFyIHBhcnNlID0gcmVxdWlyZSgnLi4vcGFyc2UvaW5kZXguanMnKVxudmFyIHN0YXJ0T2ZJU09XZWVrID0gcmVxdWlyZSgnLi4vc3RhcnRfb2ZfaXNvX3dlZWsvaW5kZXguanMnKVxudmFyIHN0YXJ0T2ZJU09ZZWFyID0gcmVxdWlyZSgnLi4vc3RhcnRfb2ZfaXNvX3llYXIvaW5kZXguanMnKVxuXG52YXIgTUlMTElTRUNPTkRTX0lOX1dFRUsgPSA2MDQ4MDAwMDBcblxuLyoqXG4gKiBAY2F0ZWdvcnkgSVNPIFdlZWsgSGVscGVyc1xuICogQHN1bW1hcnkgR2V0IHRoZSBJU08gd2VlayBvZiB0aGUgZ2l2ZW4gZGF0ZS5cbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIEdldCB0aGUgSVNPIHdlZWsgb2YgdGhlIGdpdmVuIGRhdGUuXG4gKlxuICogSVNPIHdlZWstbnVtYmVyaW5nIHllYXI6IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPX3dlZWtfZGF0ZVxuICpcbiAqIEBwYXJhbSB7RGF0ZXxTdHJpbmd8TnVtYmVyfSBkYXRlIC0gdGhlIGdpdmVuIGRhdGVcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IHRoZSBJU08gd2Vla1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBXaGljaCB3ZWVrIG9mIHRoZSBJU08td2VlayBudW1iZXJpbmcgeWVhciBpcyAyIEphbnVhcnkgMjAwNT9cbiAqIHZhciByZXN1bHQgPSBnZXRJU09XZWVrKG5ldyBEYXRlKDIwMDUsIDAsIDIpKVxuICogLy89PiA1M1xuICovXG5mdW5jdGlvbiBnZXRJU09XZWVrIChkaXJ0eURhdGUpIHtcbiAgdmFyIGRhdGUgPSBwYXJzZShkaXJ0eURhdGUpXG4gIHZhciBkaWZmID0gc3RhcnRPZklTT1dlZWsoZGF0ZSkuZ2V0VGltZSgpIC0gc3RhcnRPZklTT1llYXIoZGF0ZSkuZ2V0VGltZSgpXG5cbiAgLy8gUm91bmQgdGhlIG51bWJlciBvZiBkYXlzIHRvIHRoZSBuZWFyZXN0IGludGVnZXJcbiAgLy8gYmVjYXVzZSB0aGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBpbiBhIHdlZWsgaXMgbm90IGNvbnN0YW50XG4gIC8vIChlLmcuIGl0J3MgZGlmZmVyZW50IGluIHRoZSB3ZWVrIG9mIHRoZSBkYXlsaWdodCBzYXZpbmcgdGltZSBjbG9jayBzaGlmdClcbiAgcmV0dXJuIE1hdGgucm91bmQoZGlmZiAvIE1JTExJU0VDT05EU19JTl9XRUVLKSArIDFcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRJU09XZWVrXG4iLCJ2YXIgcGFyc2UgPSByZXF1aXJlKCcuLi9wYXJzZS9pbmRleC5qcycpXG52YXIgc3RhcnRPZklTT1dlZWsgPSByZXF1aXJlKCcuLi9zdGFydF9vZl9pc29fd2Vlay9pbmRleC5qcycpXG5cbi8qKlxuICogQGNhdGVnb3J5IElTTyBXZWVrLU51bWJlcmluZyBZZWFyIEhlbHBlcnNcbiAqIEBzdW1tYXJ5IEdldCB0aGUgSVNPIHdlZWstbnVtYmVyaW5nIHllYXIgb2YgdGhlIGdpdmVuIGRhdGUuXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBHZXQgdGhlIElTTyB3ZWVrLW51bWJlcmluZyB5ZWFyIG9mIHRoZSBnaXZlbiBkYXRlLFxuICogd2hpY2ggYWx3YXlzIHN0YXJ0cyAzIGRheXMgYmVmb3JlIHRoZSB5ZWFyJ3MgZmlyc3QgVGh1cnNkYXkuXG4gKlxuICogSVNPIHdlZWstbnVtYmVyaW5nIHllYXI6IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPX3dlZWtfZGF0ZVxuICpcbiAqIEBwYXJhbSB7RGF0ZXxTdHJpbmd8TnVtYmVyfSBkYXRlIC0gdGhlIGdpdmVuIGRhdGVcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IHRoZSBJU08gd2Vlay1udW1iZXJpbmcgeWVhclxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBXaGljaCBJU08td2VlayBudW1iZXJpbmcgeWVhciBpcyAyIEphbnVhcnkgMjAwNT9cbiAqIHZhciByZXN1bHQgPSBnZXRJU09ZZWFyKG5ldyBEYXRlKDIwMDUsIDAsIDIpKVxuICogLy89PiAyMDA0XG4gKi9cbmZ1bmN0aW9uIGdldElTT1llYXIgKGRpcnR5RGF0ZSkge1xuICB2YXIgZGF0ZSA9IHBhcnNlKGRpcnR5RGF0ZSlcbiAgdmFyIHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKClcblxuICB2YXIgZm91cnRoT2ZKYW51YXJ5T2ZOZXh0WWVhciA9IG5ldyBEYXRlKDApXG4gIGZvdXJ0aE9mSmFudWFyeU9mTmV4dFllYXIuc2V0RnVsbFllYXIoeWVhciArIDEsIDAsIDQpXG4gIGZvdXJ0aE9mSmFudWFyeU9mTmV4dFllYXIuc2V0SG91cnMoMCwgMCwgMCwgMClcbiAgdmFyIHN0YXJ0T2ZOZXh0WWVhciA9IHN0YXJ0T2ZJU09XZWVrKGZvdXJ0aE9mSmFudWFyeU9mTmV4dFllYXIpXG5cbiAgdmFyIGZvdXJ0aE9mSmFudWFyeU9mVGhpc1llYXIgPSBuZXcgRGF0ZSgwKVxuICBmb3VydGhPZkphbnVhcnlPZlRoaXNZZWFyLnNldEZ1bGxZZWFyKHllYXIsIDAsIDQpXG4gIGZvdXJ0aE9mSmFudWFyeU9mVGhpc1llYXIuc2V0SG91cnMoMCwgMCwgMCwgMClcbiAgdmFyIHN0YXJ0T2ZUaGlzWWVhciA9IHN0YXJ0T2ZJU09XZWVrKGZvdXJ0aE9mSmFudWFyeU9mVGhpc1llYXIpXG5cbiAgaWYgKGRhdGUuZ2V0VGltZSgpID49IHN0YXJ0T2ZOZXh0WWVhci5nZXRUaW1lKCkpIHtcbiAgICByZXR1cm4geWVhciArIDFcbiAgfSBlbHNlIGlmIChkYXRlLmdldFRpbWUoKSA+PSBzdGFydE9mVGhpc1llYXIuZ2V0VGltZSgpKSB7XG4gICAgcmV0dXJuIHllYXJcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4geWVhciAtIDFcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldElTT1llYXJcbiIsInZhciBpc0RhdGUgPSByZXF1aXJlKCcuLi9pc19kYXRlL2luZGV4LmpzJylcblxuLyoqXG4gKiBAY2F0ZWdvcnkgQ29tbW9uIEhlbHBlcnNcbiAqIEBzdW1tYXJ5IElzIHRoZSBnaXZlbiBkYXRlIHZhbGlkP1xuICpcbiAqIEBkZXNjcmlwdGlvblxuICogUmV0dXJucyBmYWxzZSBpZiBhcmd1bWVudCBpcyBJbnZhbGlkIERhdGUgYW5kIHRydWUgb3RoZXJ3aXNlLlxuICogSW52YWxpZCBEYXRlIGlzIGEgRGF0ZSwgd2hvc2UgdGltZSB2YWx1ZSBpcyBOYU4uXG4gKlxuICogVGltZSB2YWx1ZSBvZiBEYXRlOiBodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDE1LjkuMS4xXG4gKlxuICogQHBhcmFtIHtEYXRlfSBkYXRlIC0gdGhlIGRhdGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtCb29sZWFufSB0aGUgZGF0ZSBpcyB2YWxpZFxuICogQHRocm93cyB7VHlwZUVycm9yfSBhcmd1bWVudCBtdXN0IGJlIGFuIGluc3RhbmNlIG9mIERhdGVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRm9yIHRoZSB2YWxpZCBkYXRlOlxuICogdmFyIHJlc3VsdCA9IGlzVmFsaWQobmV3IERhdGUoMjAxNCwgMSwgMzEpKVxuICogLy89PiB0cnVlXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEZvciB0aGUgaW52YWxpZCBkYXRlOlxuICogdmFyIHJlc3VsdCA9IGlzVmFsaWQobmV3IERhdGUoJycpKVxuICogLy89PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1ZhbGlkIChkaXJ0eURhdGUpIHtcbiAgaWYgKGlzRGF0ZShkaXJ0eURhdGUpKSB7XG4gICAgcmV0dXJuICFpc05hTihkaXJ0eURhdGUpXG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcih0b1N0cmluZy5jYWxsKGRpcnR5RGF0ZSkgKyAnIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRlJylcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmFsaWRcbiIsInZhciBidWlsZERpc3RhbmNlSW5Xb3Jkc0xvY2FsZSA9IHJlcXVpcmUoJy4vYnVpbGRfZGlzdGFuY2VfaW5fd29yZHNfbG9jYWxlL2luZGV4LmpzJylcbnZhciBidWlsZEZvcm1hdExvY2FsZSA9IHJlcXVpcmUoJy4vYnVpbGRfZm9ybWF0X2xvY2FsZS9pbmRleC5qcycpXG5cbi8qKlxuICogQGNhdGVnb3J5IExvY2FsZXNcbiAqIEBzdW1tYXJ5IEVuZ2xpc2ggbG9jYWxlLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZGlzdGFuY2VJbldvcmRzOiBidWlsZERpc3RhbmNlSW5Xb3Jkc0xvY2FsZSgpLFxuICBmb3JtYXQ6IGJ1aWxkRm9ybWF0TG9jYWxlKClcbn1cbiIsInZhciBnZXRUaW1lem9uZU9mZnNldEluTWlsbGlzZWNvbmRzID0gcmVxdWlyZSgnLi4vX2xpYi9nZXRUaW1lem9uZU9mZnNldEluTWlsbGlzZWNvbmRzL2luZGV4LmpzJylcbnZhciBpc0RhdGUgPSByZXF1aXJlKCcuLi9pc19kYXRlL2luZGV4LmpzJylcblxudmFyIE1JTExJU0VDT05EU19JTl9IT1VSID0gMzYwMDAwMFxudmFyIE1JTExJU0VDT05EU19JTl9NSU5VVEUgPSA2MDAwMFxudmFyIERFRkFVTFRfQURESVRJT05BTF9ESUdJVFMgPSAyXG5cbnZhciBwYXJzZVRva2VuRGF0ZVRpbWVEZWxpbWV0ZXIgPSAvW1QgXS9cbnZhciBwYXJzZVRva2VuUGxhaW5UaW1lID0gLzovXG5cbi8vIHllYXIgdG9rZW5zXG52YXIgcGFyc2VUb2tlbllZID0gL14oXFxkezJ9KSQvXG52YXIgcGFyc2VUb2tlbnNZWVkgPSBbXG4gIC9eKFsrLV1cXGR7Mn0pJC8sIC8vIDAgYWRkaXRpb25hbCBkaWdpdHNcbiAgL14oWystXVxcZHszfSkkLywgLy8gMSBhZGRpdGlvbmFsIGRpZ2l0XG4gIC9eKFsrLV1cXGR7NH0pJC8gLy8gMiBhZGRpdGlvbmFsIGRpZ2l0c1xuXVxuXG52YXIgcGFyc2VUb2tlbllZWVkgPSAvXihcXGR7NH0pL1xudmFyIHBhcnNlVG9rZW5zWVlZWVkgPSBbXG4gIC9eKFsrLV1cXGR7NH0pLywgLy8gMCBhZGRpdGlvbmFsIGRpZ2l0c1xuICAvXihbKy1dXFxkezV9KS8sIC8vIDEgYWRkaXRpb25hbCBkaWdpdFxuICAvXihbKy1dXFxkezZ9KS8gLy8gMiBhZGRpdGlvbmFsIGRpZ2l0c1xuXVxuXG4vLyBkYXRlIHRva2Vuc1xudmFyIHBhcnNlVG9rZW5NTSA9IC9eLShcXGR7Mn0pJC9cbnZhciBwYXJzZVRva2VuREREID0gL14tPyhcXGR7M30pJC9cbnZhciBwYXJzZVRva2VuTU1ERCA9IC9eLT8oXFxkezJ9KS0/KFxcZHsyfSkkL1xudmFyIHBhcnNlVG9rZW5Xd3cgPSAvXi0/VyhcXGR7Mn0pJC9cbnZhciBwYXJzZVRva2VuV3d3RCA9IC9eLT9XKFxcZHsyfSktPyhcXGR7MX0pJC9cblxuLy8gdGltZSB0b2tlbnNcbnZhciBwYXJzZVRva2VuSEggPSAvXihcXGR7Mn0oWy4sXVxcZCopPykkL1xudmFyIHBhcnNlVG9rZW5ISE1NID0gL14oXFxkezJ9KTo/KFxcZHsyfShbLixdXFxkKik/KSQvXG52YXIgcGFyc2VUb2tlbkhITU1TUyA9IC9eKFxcZHsyfSk6PyhcXGR7Mn0pOj8oXFxkezJ9KFsuLF1cXGQqKT8pJC9cblxuLy8gdGltZXpvbmUgdG9rZW5zXG52YXIgcGFyc2VUb2tlblRpbWV6b25lID0gLyhbWistXS4qKSQvXG52YXIgcGFyc2VUb2tlblRpbWV6b25lWiA9IC9eKFopJC9cbnZhciBwYXJzZVRva2VuVGltZXpvbmVISCA9IC9eKFsrLV0pKFxcZHsyfSkkL1xudmFyIHBhcnNlVG9rZW5UaW1lem9uZUhITU0gPSAvXihbKy1dKShcXGR7Mn0pOj8oXFxkezJ9KSQvXG5cbi8qKlxuICogQGNhdGVnb3J5IENvbW1vbiBIZWxwZXJzXG4gKiBAc3VtbWFyeSBDb252ZXJ0IHRoZSBnaXZlbiBhcmd1bWVudCB0byBhbiBpbnN0YW5jZSBvZiBEYXRlLlxuICpcbiAqIEBkZXNjcmlwdGlvblxuICogQ29udmVydCB0aGUgZ2l2ZW4gYXJndW1lbnQgdG8gYW4gaW5zdGFuY2Ugb2YgRGF0ZS5cbiAqXG4gKiBJZiB0aGUgYXJndW1lbnQgaXMgYW4gaW5zdGFuY2Ugb2YgRGF0ZSwgdGhlIGZ1bmN0aW9uIHJldHVybnMgaXRzIGNsb25lLlxuICpcbiAqIElmIHRoZSBhcmd1bWVudCBpcyBhIG51bWJlciwgaXQgaXMgdHJlYXRlZCBhcyBhIHRpbWVzdGFtcC5cbiAqXG4gKiBJZiBhbiBhcmd1bWVudCBpcyBhIHN0cmluZywgdGhlIGZ1bmN0aW9uIHRyaWVzIHRvIHBhcnNlIGl0LlxuICogRnVuY3Rpb24gYWNjZXB0cyBjb21wbGV0ZSBJU08gODYwMSBmb3JtYXRzIGFzIHdlbGwgYXMgcGFydGlhbCBpbXBsZW1lbnRhdGlvbnMuXG4gKiBJU08gODYwMTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9JU09fODYwMVxuICpcbiAqIElmIGFsbCBhYm92ZSBmYWlscywgdGhlIGZ1bmN0aW9uIHBhc3NlcyB0aGUgZ2l2ZW4gYXJndW1lbnQgdG8gRGF0ZSBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBAcGFyYW0ge0RhdGV8U3RyaW5nfE51bWJlcn0gYXJndW1lbnQgLSB0aGUgdmFsdWUgdG8gY29udmVydFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSAtIHRoZSBvYmplY3Qgd2l0aCBvcHRpb25zXG4gKiBAcGFyYW0gezAgfCAxIHwgMn0gW29wdGlvbnMuYWRkaXRpb25hbERpZ2l0cz0yXSAtIHRoZSBhZGRpdGlvbmFsIG51bWJlciBvZiBkaWdpdHMgaW4gdGhlIGV4dGVuZGVkIHllYXIgZm9ybWF0XG4gKiBAcmV0dXJucyB7RGF0ZX0gdGhlIHBhcnNlZCBkYXRlIGluIHRoZSBsb2NhbCB0aW1lIHpvbmVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ29udmVydCBzdHJpbmcgJzIwMTQtMDItMTFUMTE6MzA6MzAnIHRvIGRhdGU6XG4gKiB2YXIgcmVzdWx0ID0gcGFyc2UoJzIwMTQtMDItMTFUMTE6MzA6MzAnKVxuICogLy89PiBUdWUgRmViIDExIDIwMTQgMTE6MzA6MzBcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUGFyc2Ugc3RyaW5nICcrMDIwMTQxMDEnLFxuICogLy8gaWYgdGhlIGFkZGl0aW9uYWwgbnVtYmVyIG9mIGRpZ2l0cyBpbiB0aGUgZXh0ZW5kZWQgeWVhciBmb3JtYXQgaXMgMTpcbiAqIHZhciByZXN1bHQgPSBwYXJzZSgnKzAyMDE0MTAxJywge2FkZGl0aW9uYWxEaWdpdHM6IDF9KVxuICogLy89PiBGcmkgQXByIDExIDIwMTQgMDA6MDA6MDBcbiAqL1xuZnVuY3Rpb24gcGFyc2UgKGFyZ3VtZW50LCBkaXJ0eU9wdGlvbnMpIHtcbiAgaWYgKGlzRGF0ZShhcmd1bWVudCkpIHtcbiAgICAvLyBQcmV2ZW50IHRoZSBkYXRlIHRvIGxvc2UgdGhlIG1pbGxpc2Vjb25kcyB3aGVuIHBhc3NlZCB0byBuZXcgRGF0ZSgpIGluIElFMTBcbiAgICByZXR1cm4gbmV3IERhdGUoYXJndW1lbnQuZ2V0VGltZSgpKVxuICB9IGVsc2UgaWYgKHR5cGVvZiBhcmd1bWVudCAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoYXJndW1lbnQpXG4gIH1cblxuICB2YXIgb3B0aW9ucyA9IGRpcnR5T3B0aW9ucyB8fCB7fVxuICB2YXIgYWRkaXRpb25hbERpZ2l0cyA9IG9wdGlvbnMuYWRkaXRpb25hbERpZ2l0c1xuICBpZiAoYWRkaXRpb25hbERpZ2l0cyA9PSBudWxsKSB7XG4gICAgYWRkaXRpb25hbERpZ2l0cyA9IERFRkFVTFRfQURESVRJT05BTF9ESUdJVFNcbiAgfSBlbHNlIHtcbiAgICBhZGRpdGlvbmFsRGlnaXRzID0gTnVtYmVyKGFkZGl0aW9uYWxEaWdpdHMpXG4gIH1cblxuICB2YXIgZGF0ZVN0cmluZ3MgPSBzcGxpdERhdGVTdHJpbmcoYXJndW1lbnQpXG5cbiAgdmFyIHBhcnNlWWVhclJlc3VsdCA9IHBhcnNlWWVhcihkYXRlU3RyaW5ncy5kYXRlLCBhZGRpdGlvbmFsRGlnaXRzKVxuICB2YXIgeWVhciA9IHBhcnNlWWVhclJlc3VsdC55ZWFyXG4gIHZhciByZXN0RGF0ZVN0cmluZyA9IHBhcnNlWWVhclJlc3VsdC5yZXN0RGF0ZVN0cmluZ1xuXG4gIHZhciBkYXRlID0gcGFyc2VEYXRlKHJlc3REYXRlU3RyaW5nLCB5ZWFyKVxuXG4gIGlmIChkYXRlKSB7XG4gICAgdmFyIHRpbWVzdGFtcCA9IGRhdGUuZ2V0VGltZSgpXG4gICAgdmFyIHRpbWUgPSAwXG4gICAgdmFyIG9mZnNldFxuXG4gICAgaWYgKGRhdGVTdHJpbmdzLnRpbWUpIHtcbiAgICAgIHRpbWUgPSBwYXJzZVRpbWUoZGF0ZVN0cmluZ3MudGltZSlcbiAgICB9XG5cbiAgICBpZiAoZGF0ZVN0cmluZ3MudGltZXpvbmUpIHtcbiAgICAgIG9mZnNldCA9IHBhcnNlVGltZXpvbmUoZGF0ZVN0cmluZ3MudGltZXpvbmUpICogTUlMTElTRUNPTkRTX0lOX01JTlVURVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZnVsbFRpbWUgPSB0aW1lc3RhbXAgKyB0aW1lXG4gICAgICB2YXIgZnVsbFRpbWVEYXRlID0gbmV3IERhdGUoZnVsbFRpbWUpXG5cbiAgICAgIG9mZnNldCA9IGdldFRpbWV6b25lT2Zmc2V0SW5NaWxsaXNlY29uZHMoZnVsbFRpbWVEYXRlKVxuXG4gICAgICAvLyBBZGp1c3QgdGltZSB3aGVuIGl0J3MgY29taW5nIGZyb20gRFNUXG4gICAgICB2YXIgZnVsbFRpbWVEYXRlTmV4dERheSA9IG5ldyBEYXRlKGZ1bGxUaW1lKVxuICAgICAgZnVsbFRpbWVEYXRlTmV4dERheS5zZXREYXRlKGZ1bGxUaW1lRGF0ZS5nZXREYXRlKCkgKyAxKVxuICAgICAgdmFyIG9mZnNldERpZmYgPVxuICAgICAgICBnZXRUaW1lem9uZU9mZnNldEluTWlsbGlzZWNvbmRzKGZ1bGxUaW1lRGF0ZU5leHREYXkpIC1cbiAgICAgICAgZ2V0VGltZXpvbmVPZmZzZXRJbk1pbGxpc2Vjb25kcyhmdWxsVGltZURhdGUpXG4gICAgICBpZiAob2Zmc2V0RGlmZiA+IDApIHtcbiAgICAgICAgb2Zmc2V0ICs9IG9mZnNldERpZmZcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IERhdGUodGltZXN0YW1wICsgdGltZSArIG9mZnNldClcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IERhdGUoYXJndW1lbnQpXG4gIH1cbn1cblxuZnVuY3Rpb24gc3BsaXREYXRlU3RyaW5nIChkYXRlU3RyaW5nKSB7XG4gIHZhciBkYXRlU3RyaW5ncyA9IHt9XG4gIHZhciBhcnJheSA9IGRhdGVTdHJpbmcuc3BsaXQocGFyc2VUb2tlbkRhdGVUaW1lRGVsaW1ldGVyKVxuICB2YXIgdGltZVN0cmluZ1xuXG4gIGlmIChwYXJzZVRva2VuUGxhaW5UaW1lLnRlc3QoYXJyYXlbMF0pKSB7XG4gICAgZGF0ZVN0cmluZ3MuZGF0ZSA9IG51bGxcbiAgICB0aW1lU3RyaW5nID0gYXJyYXlbMF1cbiAgfSBlbHNlIHtcbiAgICBkYXRlU3RyaW5ncy5kYXRlID0gYXJyYXlbMF1cbiAgICB0aW1lU3RyaW5nID0gYXJyYXlbMV1cbiAgfVxuXG4gIGlmICh0aW1lU3RyaW5nKSB7XG4gICAgdmFyIHRva2VuID0gcGFyc2VUb2tlblRpbWV6b25lLmV4ZWModGltZVN0cmluZylcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIGRhdGVTdHJpbmdzLnRpbWUgPSB0aW1lU3RyaW5nLnJlcGxhY2UodG9rZW5bMV0sICcnKVxuICAgICAgZGF0ZVN0cmluZ3MudGltZXpvbmUgPSB0b2tlblsxXVxuICAgIH0gZWxzZSB7XG4gICAgICBkYXRlU3RyaW5ncy50aW1lID0gdGltZVN0cmluZ1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkYXRlU3RyaW5nc1xufVxuXG5mdW5jdGlvbiBwYXJzZVllYXIgKGRhdGVTdHJpbmcsIGFkZGl0aW9uYWxEaWdpdHMpIHtcbiAgdmFyIHBhcnNlVG9rZW5ZWVkgPSBwYXJzZVRva2Vuc1lZWVthZGRpdGlvbmFsRGlnaXRzXVxuICB2YXIgcGFyc2VUb2tlbllZWVlZID0gcGFyc2VUb2tlbnNZWVlZWVthZGRpdGlvbmFsRGlnaXRzXVxuXG4gIHZhciB0b2tlblxuXG4gIC8vIFlZWVkgb3IgwrFZWVlZWVxuICB0b2tlbiA9IHBhcnNlVG9rZW5ZWVlZLmV4ZWMoZGF0ZVN0cmluZykgfHwgcGFyc2VUb2tlbllZWVlZLmV4ZWMoZGF0ZVN0cmluZylcbiAgaWYgKHRva2VuKSB7XG4gICAgdmFyIHllYXJTdHJpbmcgPSB0b2tlblsxXVxuICAgIHJldHVybiB7XG4gICAgICB5ZWFyOiBwYXJzZUludCh5ZWFyU3RyaW5nLCAxMCksXG4gICAgICByZXN0RGF0ZVN0cmluZzogZGF0ZVN0cmluZy5zbGljZSh5ZWFyU3RyaW5nLmxlbmd0aClcbiAgICB9XG4gIH1cblxuICAvLyBZWSBvciDCsVlZWVxuICB0b2tlbiA9IHBhcnNlVG9rZW5ZWS5leGVjKGRhdGVTdHJpbmcpIHx8IHBhcnNlVG9rZW5ZWVkuZXhlYyhkYXRlU3RyaW5nKVxuICBpZiAodG9rZW4pIHtcbiAgICB2YXIgY2VudHVyeVN0cmluZyA9IHRva2VuWzFdXG4gICAgcmV0dXJuIHtcbiAgICAgIHllYXI6IHBhcnNlSW50KGNlbnR1cnlTdHJpbmcsIDEwKSAqIDEwMCxcbiAgICAgIHJlc3REYXRlU3RyaW5nOiBkYXRlU3RyaW5nLnNsaWNlKGNlbnR1cnlTdHJpbmcubGVuZ3RoKVxuICAgIH1cbiAgfVxuXG4gIC8vIEludmFsaWQgSVNPLWZvcm1hdHRlZCB5ZWFyXG4gIHJldHVybiB7XG4gICAgeWVhcjogbnVsbFxuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlRGF0ZSAoZGF0ZVN0cmluZywgeWVhcikge1xuICAvLyBJbnZhbGlkIElTTy1mb3JtYXR0ZWQgeWVhclxuICBpZiAoeWVhciA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICB2YXIgdG9rZW5cbiAgdmFyIGRhdGVcbiAgdmFyIG1vbnRoXG4gIHZhciB3ZWVrXG5cbiAgLy8gWVlZWVxuICBpZiAoZGF0ZVN0cmluZy5sZW5ndGggPT09IDApIHtcbiAgICBkYXRlID0gbmV3IERhdGUoMClcbiAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKHllYXIpXG4gICAgcmV0dXJuIGRhdGVcbiAgfVxuXG4gIC8vIFlZWVktTU1cbiAgdG9rZW4gPSBwYXJzZVRva2VuTU0uZXhlYyhkYXRlU3RyaW5nKVxuICBpZiAodG9rZW4pIHtcbiAgICBkYXRlID0gbmV3IERhdGUoMClcbiAgICBtb250aCA9IHBhcnNlSW50KHRva2VuWzFdLCAxMCkgLSAxXG4gICAgZGF0ZS5zZXRVVENGdWxsWWVhcih5ZWFyLCBtb250aClcbiAgICByZXR1cm4gZGF0ZVxuICB9XG5cbiAgLy8gWVlZWS1EREQgb3IgWVlZWURERFxuICB0b2tlbiA9IHBhcnNlVG9rZW5EREQuZXhlYyhkYXRlU3RyaW5nKVxuICBpZiAodG9rZW4pIHtcbiAgICBkYXRlID0gbmV3IERhdGUoMClcbiAgICB2YXIgZGF5T2ZZZWFyID0gcGFyc2VJbnQodG9rZW5bMV0sIDEwKVxuICAgIGRhdGUuc2V0VVRDRnVsbFllYXIoeWVhciwgMCwgZGF5T2ZZZWFyKVxuICAgIHJldHVybiBkYXRlXG4gIH1cblxuICAvLyBZWVlZLU1NLUREIG9yIFlZWVlNTUREXG4gIHRva2VuID0gcGFyc2VUb2tlbk1NREQuZXhlYyhkYXRlU3RyaW5nKVxuICBpZiAodG9rZW4pIHtcbiAgICBkYXRlID0gbmV3IERhdGUoMClcbiAgICBtb250aCA9IHBhcnNlSW50KHRva2VuWzFdLCAxMCkgLSAxXG4gICAgdmFyIGRheSA9IHBhcnNlSW50KHRva2VuWzJdLCAxMClcbiAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKHllYXIsIG1vbnRoLCBkYXkpXG4gICAgcmV0dXJuIGRhdGVcbiAgfVxuXG4gIC8vIFlZWVktV3d3IG9yIFlZWVlXd3dcbiAgdG9rZW4gPSBwYXJzZVRva2VuV3d3LmV4ZWMoZGF0ZVN0cmluZylcbiAgaWYgKHRva2VuKSB7XG4gICAgd2VlayA9IHBhcnNlSW50KHRva2VuWzFdLCAxMCkgLSAxXG4gICAgcmV0dXJuIGRheU9mSVNPWWVhcih5ZWFyLCB3ZWVrKVxuICB9XG5cbiAgLy8gWVlZWS1Xd3ctRCBvciBZWVlZV3d3RFxuICB0b2tlbiA9IHBhcnNlVG9rZW5Xd3dELmV4ZWMoZGF0ZVN0cmluZylcbiAgaWYgKHRva2VuKSB7XG4gICAgd2VlayA9IHBhcnNlSW50KHRva2VuWzFdLCAxMCkgLSAxXG4gICAgdmFyIGRheU9mV2VlayA9IHBhcnNlSW50KHRva2VuWzJdLCAxMCkgLSAxXG4gICAgcmV0dXJuIGRheU9mSVNPWWVhcih5ZWFyLCB3ZWVrLCBkYXlPZldlZWspXG4gIH1cblxuICAvLyBJbnZhbGlkIElTTy1mb3JtYXR0ZWQgZGF0ZVxuICByZXR1cm4gbnVsbFxufVxuXG5mdW5jdGlvbiBwYXJzZVRpbWUgKHRpbWVTdHJpbmcpIHtcbiAgdmFyIHRva2VuXG4gIHZhciBob3Vyc1xuICB2YXIgbWludXRlc1xuXG4gIC8vIGhoXG4gIHRva2VuID0gcGFyc2VUb2tlbkhILmV4ZWModGltZVN0cmluZylcbiAgaWYgKHRva2VuKSB7XG4gICAgaG91cnMgPSBwYXJzZUZsb2F0KHRva2VuWzFdLnJlcGxhY2UoJywnLCAnLicpKVxuICAgIHJldHVybiAoaG91cnMgJSAyNCkgKiBNSUxMSVNFQ09ORFNfSU5fSE9VUlxuICB9XG5cbiAgLy8gaGg6bW0gb3IgaGhtbVxuICB0b2tlbiA9IHBhcnNlVG9rZW5ISE1NLmV4ZWModGltZVN0cmluZylcbiAgaWYgKHRva2VuKSB7XG4gICAgaG91cnMgPSBwYXJzZUludCh0b2tlblsxXSwgMTApXG4gICAgbWludXRlcyA9IHBhcnNlRmxvYXQodG9rZW5bMl0ucmVwbGFjZSgnLCcsICcuJykpXG4gICAgcmV0dXJuIChob3VycyAlIDI0KSAqIE1JTExJU0VDT05EU19JTl9IT1VSICtcbiAgICAgIG1pbnV0ZXMgKiBNSUxMSVNFQ09ORFNfSU5fTUlOVVRFXG4gIH1cblxuICAvLyBoaDptbTpzcyBvciBoaG1tc3NcbiAgdG9rZW4gPSBwYXJzZVRva2VuSEhNTVNTLmV4ZWModGltZVN0cmluZylcbiAgaWYgKHRva2VuKSB7XG4gICAgaG91cnMgPSBwYXJzZUludCh0b2tlblsxXSwgMTApXG4gICAgbWludXRlcyA9IHBhcnNlSW50KHRva2VuWzJdLCAxMClcbiAgICB2YXIgc2Vjb25kcyA9IHBhcnNlRmxvYXQodG9rZW5bM10ucmVwbGFjZSgnLCcsICcuJykpXG4gICAgcmV0dXJuIChob3VycyAlIDI0KSAqIE1JTExJU0VDT05EU19JTl9IT1VSICtcbiAgICAgIG1pbnV0ZXMgKiBNSUxMSVNFQ09ORFNfSU5fTUlOVVRFICtcbiAgICAgIHNlY29uZHMgKiAxMDAwXG4gIH1cblxuICAvLyBJbnZhbGlkIElTTy1mb3JtYXR0ZWQgdGltZVxuICByZXR1cm4gbnVsbFxufVxuXG5mdW5jdGlvbiBwYXJzZVRpbWV6b25lICh0aW1lem9uZVN0cmluZykge1xuICB2YXIgdG9rZW5cbiAgdmFyIGFic29sdXRlT2Zmc2V0XG5cbiAgLy8gWlxuICB0b2tlbiA9IHBhcnNlVG9rZW5UaW1lem9uZVouZXhlYyh0aW1lem9uZVN0cmluZylcbiAgaWYgKHRva2VuKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuXG4gIC8vIMKxaGhcbiAgdG9rZW4gPSBwYXJzZVRva2VuVGltZXpvbmVISC5leGVjKHRpbWV6b25lU3RyaW5nKVxuICBpZiAodG9rZW4pIHtcbiAgICBhYnNvbHV0ZU9mZnNldCA9IHBhcnNlSW50KHRva2VuWzJdLCAxMCkgKiA2MFxuICAgIHJldHVybiAodG9rZW5bMV0gPT09ICcrJykgPyAtYWJzb2x1dGVPZmZzZXQgOiBhYnNvbHV0ZU9mZnNldFxuICB9XG5cbiAgLy8gwrFoaDptbSBvciDCsWhobW1cbiAgdG9rZW4gPSBwYXJzZVRva2VuVGltZXpvbmVISE1NLmV4ZWModGltZXpvbmVTdHJpbmcpXG4gIGlmICh0b2tlbikge1xuICAgIGFic29sdXRlT2Zmc2V0ID0gcGFyc2VJbnQodG9rZW5bMl0sIDEwKSAqIDYwICsgcGFyc2VJbnQodG9rZW5bM10sIDEwKVxuICAgIHJldHVybiAodG9rZW5bMV0gPT09ICcrJykgPyAtYWJzb2x1dGVPZmZzZXQgOiBhYnNvbHV0ZU9mZnNldFxuICB9XG5cbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gZGF5T2ZJU09ZZWFyIChpc29ZZWFyLCB3ZWVrLCBkYXkpIHtcbiAgd2VlayA9IHdlZWsgfHwgMFxuICBkYXkgPSBkYXkgfHwgMFxuICB2YXIgZGF0ZSA9IG5ldyBEYXRlKDApXG4gIGRhdGUuc2V0VVRDRnVsbFllYXIoaXNvWWVhciwgMCwgNClcbiAgdmFyIGZvdXJ0aE9mSmFudWFyeURheSA9IGRhdGUuZ2V0VVRDRGF5KCkgfHwgN1xuICB2YXIgZGlmZiA9IHdlZWsgKiA3ICsgZGF5ICsgMSAtIGZvdXJ0aE9mSmFudWFyeURheVxuICBkYXRlLnNldFVUQ0RhdGUoZGF0ZS5nZXRVVENEYXRlKCkgKyBkaWZmKVxuICByZXR1cm4gZGF0ZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlXG4iLCJpbXBvcnQgKiBhcyBmb3JtYXQgZnJvbSAnZGF0ZS1mbnMvZm9ybWF0JztcclxuaW1wb3J0ICogYXMgZ2V0X2RheV9vZl95ZWFyIGZyb20gJ2RhdGUtZm5zL2dldF9kYXlfb2ZfeWVhcic7XHJcbmltcG9ydCAqIGFzIGdldF9pc29fd2VlayBmcm9tICdkYXRlLWZucy9nZXRfaXNvX3dlZWsnO1xyXG5pbXBvcnQgKiBhcyBnZXRfaXNvX3llYXIgZnJvbSAnZGF0ZS1mbnMvZ2V0X2lzb195ZWFyJztcclxuaW1wb3J0ICogYXMgaXNfdmFsaWQgZnJvbSAnZGF0ZS1mbnMvaXNfdmFsaWQnO1xyXG5pbXBvcnQgKiBhcyBlbiBmcm9tICdkYXRlLWZucy9sb2NhbGUvZW4nO1xyXG5pbXBvcnQgKiBhcyBwYXJzZSBmcm9tICdkYXRlLWZucy9wYXJzZSc7XHJcblxyXG5mdW5jdGlvbiB0cmFuc2Zvcm1QaG9uZU51bWJlcih2YWx1ZSkge1xyXG4gIHZhciBzMiA9IChcIlwiK3ZhbHVlKS5yZXBsYWNlKC9cXEQvZywgJycpO1xyXG4gIHZhciBtID0gczIubWF0Y2goL14oXFxkezN9KShcXGR7M30pKFxcZHs0fSkkLyk7XHJcbiAgcmV0dXJuICghbSkgPyBudWxsIDogXCIoXCIgKyBtWzFdICsgXCIpIFwiICsgbVsyXSArIFwiLVwiICsgbVszXTtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJhbnNmb3JtRGF0ZSh2YWx1ZSkge1xyXG4gIC8vIHZhciBtb21lbnQgPSBnbG9iYWxzLm1vbWVudDtcclxuICAvLyByZXR1cm4gbW9tZW50KHZhbHVlKS5mb3JtYXQoJ01NL0REL1lZWVknKTtcclxuICByZXR1cm4gZm9ybWF0KHZhbHVlLCAnTU0vREQvWVlZWScpO1xyXG4gIC8vIHJldHVybiB2YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJhbnNmb3JtRGVjaW1hbFBsYWNlKHZhbHVlKSB7XHJcbiAgdmFyIG51bWJlciA9IFN0cmluZyh2YWx1ZSkubWF0Y2goL1xcZCsvKVswXS5yZXBsYWNlKC8oLikoPz0oXFxkezN9KSskKS9nLCckMSwnKTtcclxuICB2YXIgbGFiZWwgPSBTdHJpbmcodmFsdWUpLnJlcGxhY2UoL1swLTldL2csICcnKSB8fCAnJztcclxuICByZXR1cm4gbnVtYmVyICsgJyAnICsgbGFiZWw7XHJcbn1cclxuXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUG9wdXBDb250ZW50IChwb3B1cEluZm8sIHByb3BlcnRpZXMpIHtcclxuICAvLyBjb25zb2xlLmxvZygncG9wdXBJbmZvOicsIHBvcHVwSW5mbyk7XHJcbiAgLy8gY29uc29sZS5sb2coJ3BvcHVwIHByb3BlcnRpZXM6JywgcHJvcGVydGllcyk7XHJcbiAgdmFyIHIgPSAvXFx7KFteXFxdXSopXFx9L2c7XHJcbiAgdmFyIHRpdGxlVGV4dCA9ICcnO1xyXG4gIHZhciBjb250ZW50ID0gJyc7XHJcblxyXG4gIGlmIChwb3B1cEluZm8udGl0bGUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgdGl0bGVUZXh0ID0gcG9wdXBJbmZvLnRpdGxlO1xyXG4gIH1cclxuXHJcbiAgdGl0bGVUZXh0ID0gdGl0bGVUZXh0LnJlcGxhY2UociwgZnVuY3Rpb24gKHMpIHtcclxuICAgIHZhciBtID0gci5leGVjKHMpO1xyXG4gICAgcmV0dXJuIHByb3BlcnRpZXNbbVsxXV07XHJcbiAgfSk7XHJcblxyXG4gIGNvbnRlbnQgPSAnPGRpdiBjbGFzcz1cImxlYWZsZXQtcG9wdXAtY29udGVudC10aXRsZSB0ZXh0LWNlbnRlclwiPjxoND4nICsgdGl0bGVUZXh0ICsgJzwvaDQ+PC9kaXY+PGRpdiBjbGFzcz1cImxlYWZsZXQtcG9wdXAtY29udGVudC1kZXNjcmlwdGlvblwiIHN0eWxlPVwibWF4LWhlaWdodDoyMDBweDtvdmVyZmxvdzphdXRvO1wiPic7XHJcblxyXG4gIHZhciBjb250ZW50U3RhcnQgPSAnPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OmJvbGQ7Y29sb3I6Izk5OTttYXJnaW4tdG9wOjVweDt3b3JkLWJyZWFrOmJyZWFrLWFsbDtcIj4nXHJcbiAgdmFyIGNvbnRlbnRNaWRkbGUgPSAnPC9kaXY+PHAgc3R5bGU9XCJtYXJnaW4tdG9wOjA7bWFyZ2luLWJvdHRvbTo1cHg7d29yZC1icmVhazpicmVhay1hbGw7XCI+J1xyXG4gIHZhciBhVGFnU3RhcnQgPSAnPGEgdGFyZ2V0PVwiX2JsYW5rXCIgaHJlZj1cIidcclxuICB2YXIgZW1haWxUYWdTdGFydCA9ICc8YSBocmVmPVwibWFpbHRvOidcclxuXHJcbiAgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zICE9PSB1bmRlZmluZWQpIHtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG9wdXBJbmZvLmZpZWxkSW5mb3MubGVuZ3RoOyBpKyspIHtcclxuICAgICAgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLnZpc2libGUgPT09IHRydWUpIHtcclxuICAgICAgICBpZiAocHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdID09PSBudWxsKSB7XHJcbiAgICAgICAgICBjb250ZW50ICs9IGNvbnRlbnRTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICAvLyArIGFUYWdTdGFydFxyXG4gICAgICAgICAgICAgICAgICAvLyArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICArICdub25lJ1xyXG4gICAgICAgICAgICAgICAgICAvLyArICdcIj4nXHJcbiAgICAgICAgICAgICAgICAgIC8vICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdXHJcbiAgICAgICAgICAgICAgICAgICsgJzwvcD4nO1xyXG4gICAgICAgIC8vIGlmIHRoZSBpbmZvIGlzIGEgVVJMXHJcbiAgICAgICAgfSBlbHNlIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09ICdVUkwnIHx8XHJcbiAgICAgICAgICAgIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZSA9PT0gJ0NPREVfU0VDXzEnIHx8XHJcbiAgICAgICAgICAgIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZSA9PT0gJ1dFQlNJVEUnIHx8XHJcbiAgICAgICAgICAgIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZSA9PT0gJ0ZJTkFMX0xJTktfQ09QWScgfHxcclxuICAgICAgICAgICAgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lID09PSAnTElOSycgfHxcclxuICAgICAgICAgICAgLy8gem9uaW5nIG92ZXJsYXlzOlxyXG4gICAgICAgICAgICBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09ICdDT0RFX1NFQ1RJT05fTElOSydcclxuICAgICAgICApIHtcclxuICAgICAgICAgIGNvbnRlbnQgKz0gY29udGVudFN0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWxcclxuICAgICAgICAgICAgICAgICAgKyBjb250ZW50TWlkZGxlXHJcbiAgICAgICAgICAgICAgICAgICsgYVRhZ1N0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdXHJcbiAgICAgICAgICAgICAgICAgICsgJ1wiPidcclxuICAgICAgICAgICAgICAgICAgKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV1cclxuICAgICAgICAgICAgICAgICAgKyAnPC9hPjwvcD4nO1xyXG4gICAgICAgIC8vIGlmIHRoZSBpbmZvIGlzIGFuIGVtYWlsIGFkZHJlc3NcclxuICAgICAgICB9IGVsc2UgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZS5pbmNsdWRlcygnRU1BSUwnKSkge1xyXG4gICAgICAgICAgY29udGVudCArPSBjb250ZW50U3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICArIGNvbnRlbnRNaWRkbGVcclxuICAgICAgICAgICAgICAgICAgKyBlbWFpbFRhZ1N0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdXHJcbiAgICAgICAgICAgICAgICAgICsgJ1wiPidcclxuICAgICAgICAgICAgICAgICAgKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV1cclxuICAgICAgICAgICAgICAgICAgKyAnPC9hPjwvcD4nO1xyXG4gICAgICAgIC8vIGlmIHRoZSBpbmZvIGlzIGEgcGhvbmUgbnVtYmVyXHJcbiAgICAgICAgfSBlbHNlIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUuaW5jbHVkZXMoJ1BIT05FJykpIHtcclxuICAgICAgICAgIGNvbnRlbnQgKz0gY29udGVudFN0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWxcclxuICAgICAgICAgICAgICAgICAgKyBjb250ZW50TWlkZGxlXHJcbiAgICAgICAgICAgICAgICAgICsgdHJhbnNmb3JtUGhvbmVOdW1iZXIocHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdKVxyXG4gICAgICAgICAgICAgICAgICArICc8L3A+JztcclxuICAgICAgICAvLyBpZiB0aGUgaW5mbyBpcyBhIGRhdGVcclxuICAgICAgfSBlbHNlIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUuaW5jbHVkZXMoJ0RBVEUnKSkge1xyXG4gICAgICAgICAgY29udGVudCArPSBjb250ZW50U3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICArIGNvbnRlbnRNaWRkbGVcclxuICAgICAgICAgICAgICAgICAgKyB0cmFuc2Zvcm1EYXRlKHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXSlcclxuICAgICAgICAgICAgICAgICAgKyAnPC9wPic7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGNvbnRlbnQgKz0gY29udGVudFN0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWxcclxuICAgICAgICAgICAgICAgICAgKyBjb250ZW50TWlkZGxlXHJcbiAgICAgICAgICAgICAgICAgICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdXHJcbiAgICAgICAgICAgICAgICAgICsgJzwvcD4nO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgY29udGVudCArPSAnPC9kaXY+JztcclxuXHJcbiAgfSBlbHNlIGlmIChwb3B1cEluZm8uZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gS01MTGF5ZXIgcG9wdXBcclxuICAgIHZhciBkZXNjcmlwdGlvblRleHQgPSBwb3B1cEluZm8uZGVzY3JpcHRpb24ucmVwbGFjZShyLCBmdW5jdGlvbiAocykge1xyXG4gICAgICB2YXIgbSA9IHIuZXhlYyhzKTtcclxuICAgICAgcmV0dXJuIHByb3BlcnRpZXNbbVsxXV07XHJcbiAgICB9KTtcclxuICAgIGNvbnRlbnQgKz0gZGVzY3JpcHRpb25UZXh0ICsgJzwvZGl2Pic7XHJcbiAgfVxyXG5cclxuICAvLyBpZiAocG9wdXBJbmZvLm1lZGlhSW5mb3MubGVuZ3RoID4gMCkge1xyXG4gICAgLy8gSXQgZG9lcyBub3Qgc3VwcG9ydCBtZWRpYUluZm9zIGZvciBwb3B1cCBjb250ZW50cy5cclxuICAvLyB9XHJcblxyXG4gIHJldHVybiBjb250ZW50O1xyXG59XHJcblxyXG5leHBvcnQgdmFyIFBvcHVwID0ge1xyXG4gIGNyZWF0ZVBvcHVwQ29udGVudDogY3JlYXRlUG9wdXBDb250ZW50XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBQb3B1cDtcclxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcbmltcG9ydCB7IGZlYXR1cmVDb2xsZWN0aW9uIH0gZnJvbSAnLi9GZWF0dXJlQ29sbGVjdGlvbi9GZWF0dXJlQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IGNzdkxheWVyIH0gZnJvbSAnLi9GZWF0dXJlQ29sbGVjdGlvbi9DU1ZMYXllcic7XHJcbmltcG9ydCB7IGttbExheWVyIH0gZnJvbSAnLi9GZWF0dXJlQ29sbGVjdGlvbi9LTUxMYXllcic7XHJcbmltcG9ydCB7IGxhYmVsTWFya2VyIH0gZnJvbSAnLi9MYWJlbC9MYWJlbE1hcmtlcic7XHJcbmltcG9ydCB7IHBvaW50TGFiZWxQb3MgfSBmcm9tICcuL0xhYmVsL1BvaW50TGFiZWwnO1xyXG5pbXBvcnQgeyBwb2x5bGluZUxhYmVsUG9zIH0gZnJvbSAnLi9MYWJlbC9Qb2x5bGluZUxhYmVsJztcclxuaW1wb3J0IHsgcG9seWdvbkxhYmVsUG9zIH0gZnJvbSAnLi9MYWJlbC9Qb2x5Z29uTGFiZWwnO1xyXG5pbXBvcnQgeyBjcmVhdGVQb3B1cENvbnRlbnQgfSBmcm9tICcuL1BvcHVwL1BvcHVwJztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvcGVyYXRpb25hbExheWVyIChsYXllciwgbGF5ZXJzLCBtYXAsIHBhcmFtcywgcGFuZU5hbWUpIHtcclxuICAvLyBjb25zb2xlLmxvZygnb3BlcmF0aW9uYWxMYXllciwgbGF5ZXI6JywgbGF5ZXIsICdsYXllcnM6JywgbGF5ZXJzLCAnbWFwOicsIG1hcCwgJ3BhcmFtczonLCBwYXJhbXMsICdwYW5lTmFtZTonLCBwYW5lTmFtZSk7XHJcbiAgcmV0dXJuIF9nZW5lcmF0ZUVzcmlMYXllcihsYXllciwgbGF5ZXJzLCBtYXAsIHBhcmFtcywgcGFuZU5hbWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX2dlbmVyYXRlRXNyaUxheWVyIChsYXllciwgbGF5ZXJzLCBtYXAsIHBhcmFtcywgcGFuZU5hbWUpIHtcclxuICAvLyBjb25zb2xlLmxvZygnZ2VuZXJhdGVFc3JpTGF5ZXI6ICcsIGxheWVyLnRpdGxlLCAncGFuZU5hbWU6JywgcGFuZU5hbWUsICdsYXllcjonLCBsYXllcik7XHJcbiAgdmFyIGx5cjtcclxuICB2YXIgbGFiZWxzID0gW107XHJcbiAgdmFyIGxhYmVsc0xheWVyO1xyXG4gIHZhciBsYWJlbFBhbmVOYW1lID0gcGFuZU5hbWUgKyAnLWxhYmVsJztcclxuICB2YXIgaSwgbGVuO1xyXG5cclxuICBpZiAobGF5ZXIudHlwZSA9PT0gJ0ZlYXR1cmUgQ29sbGVjdGlvbicgfHwgbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZSBGZWF0dXJlQ29sbGVjdGlvbicpO1xyXG5cclxuICAgIG1hcC5jcmVhdGVQYW5lKGxhYmVsUGFuZU5hbWUpO1xyXG5cclxuICAgIHZhciBwb3B1cEluZm8sIGxhYmVsaW5nSW5mbztcclxuICAgIGlmIChsYXllci5pdGVtSWQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSBsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICBpZiAobGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmZlYXR1cmVTZXQuZmVhdHVyZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgaWYgKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCAmJiBsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ucG9wdXBJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHBvcHVwSW5mbyA9IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5wb3B1cEluZm87XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAobGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCAmJiBsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBsYWJlbGluZ0luZm8gPSBsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBsYWJlbHNMYXllciA9IEwuZmVhdHVyZUdyb3VwKGxhYmVscyk7XHJcbiAgICB2YXIgZmMgPSBmZWF0dXJlQ29sbGVjdGlvbihudWxsLCB7XHJcbiAgICAgIGRhdGE6IGxheWVyLml0ZW1JZCB8fCBsYXllci5mZWF0dXJlQ29sbGVjdGlvbixcclxuICAgICAgb3BhY2l0eTogbGF5ZXIub3BhY2l0eSxcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgbC5mZWF0dXJlLmxheWVyTmFtZSA9IGxheWVyLnRpdGxlLnNwbGl0KCdfJylbMV07XHJcbiAgICAgICAgaWYgKGZjICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHBvcHVwSW5mbyA9IGZjLnBvcHVwSW5mbztcclxuICAgICAgICAgIGxhYmVsaW5nSW5mbyA9IGZjLmxhYmVsaW5nSW5mbztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkICYmIHBvcHVwSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChwb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAvLyBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgbC5mZWF0dXJlLnBvcHVwSHRtbCA9IHBvcHVwQ29udGVudFxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQgJiYgbGFiZWxpbmdJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICB2YXIgY29vcmRpbmF0ZXMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICB2YXIgbGFiZWxQb3M7XHJcblxyXG4gICAgICAgICAgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnUG9pbnQnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9pbnRMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlc1tNYXRoLnJvdW5kKGNvb3JkaW5hdGVzLmxlbmd0aCAvIDIpXSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlnb25MYWJlbFBvcyhsKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICB2YXIgbGFiZWwgPSBsYWJlbE1hcmtlcihsYWJlbFBvcy5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IGdlb2pzb24ucHJvcGVydGllcyxcclxuICAgICAgICAgICAgbGFiZWxpbmdJbmZvOiBsYWJlbGluZ0luZm8sXHJcbiAgICAgICAgICAgIG9mZnNldDogbGFiZWxQb3Mub2Zmc2V0LFxyXG4gICAgICAgICAgICBwYW5lOiBsYWJlbFBhbmVOYW1lXHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICBsYWJlbHNMYXllci5hZGRMYXllcihsYWJlbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBseXIgPSBMLmxheWVyR3JvdXAoW2ZjLCBsYWJlbHNMYXllcl0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZDJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNGZWF0dXJlTGF5ZXInICYmIGxheWVyLmxheWVyRGVmaW5pdGlvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgd2hlcmUgPSAnMT0xJztcclxuICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLnR5cGUgPT09ICdoZWF0bWFwJykge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGUgSGVhdG1hcExheWVyJyk7XHJcbiAgICAgICAgdmFyIGdyYWRpZW50ID0ge307XHJcblxyXG4gICAgICAgIGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5jb2xvclN0b3BzLm1hcChmdW5jdGlvbiAoc3RvcCkge1xyXG4gICAgICAgICAgLy8gZ3JhZGllbnRbc3RvcC5yYXRpb10gPSAncmdiYSgnICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJywnICsgKHN0b3AuY29sb3JbM10vMjU1KSArICcpJztcclxuICAgICAgICAgIC8vIGdyYWRpZW50W01hdGgucm91bmQoc3RvcC5yYXRpbyoxMDApLzEwMF0gPSAncmdiKCcgKyBzdG9wLmNvbG9yWzBdICsgJywnICsgc3RvcC5jb2xvclsxXSArICcsJyArIHN0b3AuY29sb3JbMl0gKyAnKSc7XHJcbiAgICAgICAgICBncmFkaWVudFsoTWF0aC5yb3VuZChzdG9wLnJhdGlvICogMTAwKSAvIDEwMCArIDYpIC8gN10gPSAncmdiKCcgKyBzdG9wLmNvbG9yWzBdICsgJywnICsgc3RvcC5jb2xvclsxXSArICcsJyArIHN0b3AuY29sb3JbMl0gKyAnKSc7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGx5ciA9IEwuZXNyaS5IZWF0LmhlYXRtYXBGZWF0dXJlTGF5ZXIoeyAvLyBFc3JpIExlYWZsZXQgMi4wXHJcbiAgICAgICAgLy8gbHlyID0gTC5lc3JpLmhlYXRtYXBGZWF0dXJlTGF5ZXIoeyAvLyBFc3JpIExlYWZsZXQgMS4wXHJcbiAgICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICAgIHRva2VuOiBwYXJhbXMudG9rZW4gfHwgbnVsbCxcclxuICAgICAgICAgIG1pbk9wYWNpdHk6IDAuNSxcclxuICAgICAgICAgIG1heDogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLm1heFBpeGVsSW50ZW5zaXR5LFxyXG4gICAgICAgICAgYmx1cjogbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnJlbmRlcmVyLmJsdXJSYWRpdXMsXHJcbiAgICAgICAgICByYWRpdXM6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5ibHVyUmFkaXVzICogMS4zLFxyXG4gICAgICAgICAgZ3JhZGllbnQ6IGdyYWRpZW50LFxyXG4gICAgICAgICAgcGFuZTogcGFuZU5hbWVcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnSEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBseXI7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNGZWF0dXJlTGF5ZXIgKHdpdGggbGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvKScpO1xyXG4gICAgICAgIHZhciBkcmF3aW5nSW5mbyA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mbztcclxuICAgICAgICBkcmF3aW5nSW5mby50cmFuc3BhcmVuY3kgPSAxMDAgLSAobGF5ZXIub3BhY2l0eSAqIDEwMCk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coZHJhd2luZ0luZm8udHJhbnNwYXJlbmN5KTtcclxuXHJcbiAgICAgICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB3aGVyZSA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG1hcC5jcmVhdGVQYW5lKGxhYmVsUGFuZU5hbWUpO1xyXG5cclxuICAgICAgICBsYWJlbHNMYXllciA9IEwuZmVhdHVyZUdyb3VwKGxhYmVscyk7XHJcblxyXG4gICAgICAgIGx5ciA9IEwuZXNyaS5mZWF0dXJlTGF5ZXIoe1xyXG4gICAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgICB3aGVyZTogd2hlcmUsXHJcbiAgICAgICAgICB0b2tlbjogcGFyYW1zLnRva2VuIHx8IG51bGwsXHJcbiAgICAgICAgICBkcmF3aW5nSW5mbzogZHJhd2luZ0luZm8sXHJcbiAgICAgICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgICAgIGwuZmVhdHVyZS5sYXllck5hbWUgPSBsYXllci50aXRsZS5zcGxpdCgnXycpWzFdO1xyXG4gICAgICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgICAgICAvLyBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgICAgIGwuZmVhdHVyZS5wb3B1cEh0bWwgPSBwb3B1cENvbnRlbnRcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkICYmIGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICB2YXIgbGFiZWxpbmdJbmZvID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgICAgICAgICAgICB2YXIgY29vcmRpbmF0ZXMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICAgICAgdmFyIGxhYmVsUG9zO1xyXG5cclxuICAgICAgICAgICAgICBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcclxuICAgICAgICAgICAgICAgIGxhYmVsUG9zID0gcG9pbnRMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXNbTWF0aC5yb3VuZChjb29yZGluYXRlcy5sZW5ndGggLyAyKV0pO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlnb25MYWJlbFBvcyhsKTtcclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgIHZhciBsYWJlbCA9IGxhYmVsTWFya2VyKGxhYmVsUG9zLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBnZW9qc29uLnByb3BlcnRpZXMsXHJcbiAgICAgICAgICAgICAgICBsYWJlbGluZ0luZm86IGxhYmVsaW5nSW5mbyxcclxuICAgICAgICAgICAgICAgIG9mZnNldDogbGFiZWxQb3Mub2Zmc2V0LFxyXG4gICAgICAgICAgICAgICAgcGFuZTogbGFiZWxQYW5lTmFtZVxyXG4gICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICBsYWJlbHNMYXllci5hZGRMYXllcihsYWJlbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbHlyID0gTC5sYXllckdyb3VwKFtseXIsIGxhYmVsc0xheWVyXSk7XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlIEFyY0dJU0ZlYXR1cmVMYXllciAod2l0aG91dCBsYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8pJyk7XHJcblxyXG4gICAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRlZmluaXRpb25FeHByZXNzaW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICB3aGVyZSA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbjtcclxuICAgICAgfVxyXG5cclxuICAgICAgbHlyID0gTC5lc3JpLmZlYXR1cmVMYXllcih7XHJcbiAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgdG9rZW46IHBhcmFtcy50b2tlbiB8fCBudWxsLFxyXG4gICAgICAgIHdoZXJlOiB3aGVyZSxcclxuICAgICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgICAgbC5mZWF0dXJlLmxheWVyTmFtZSA9IGxheWVyLnRpdGxlLnNwbGl0KCdfJylbMV07XHJcbiAgICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgIC8vIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICAgIGwuZmVhdHVyZS5wb3B1cEh0bWwgPSBwb3B1cENvbnRlbnRcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRkwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgICByZXR1cm4gbHlyO1xyXG4gICAgfVxyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTRmVhdHVyZUxheWVyJykge1xyXG4gICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNGZWF0dXJlTGF5ZXInKTtcclxuICAgIGx5ciA9IEwuZXNyaS5mZWF0dXJlTGF5ZXIoe1xyXG4gICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgdG9rZW46IHBhcmFtcy50b2tlbiB8fCBudWxsLFxyXG4gICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgb25FYWNoRmVhdHVyZTogZnVuY3Rpb24gKGdlb2pzb24sIGwpIHtcclxuICAgICAgICBsLmZlYXR1cmUubGF5ZXJOYW1lID0gbGF5ZXIudGl0bGUuc3BsaXQoJ18nKVsxXTtcclxuICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQobGF5ZXIucG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgLy8gbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgIGwuZmVhdHVyZS5wb3B1cEh0bWwgPSBwb3B1cENvbnRlbnRcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdDU1YnKSB7XHJcbiAgICBsYWJlbHNMYXllciA9IEwuZmVhdHVyZUdyb3VwKGxhYmVscyk7XHJcbiAgICBseXIgPSBjc3ZMYXllcihudWxsLCB7XHJcbiAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICBsYXllckRlZmluaXRpb246IGxheWVyLmxheWVyRGVmaW5pdGlvbixcclxuICAgICAgbG9jYXRpb25JbmZvOiBsYXllci5sb2NhdGlvbkluZm8sXHJcbiAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHksXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgIGwuZmVhdHVyZS5sYXllck5hbWUgPSBsYXllci50aXRsZS5zcGxpdCgnXycpWzFdO1xyXG4gICAgICAgIGlmIChsYXllci5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAvLyBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgbC5mZWF0dXJlLnBvcHVwSHRtbCA9IHBvcHVwQ29udGVudFxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkICYmIGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgIHZhciBsYWJlbGluZ0luZm8gPSBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xyXG4gICAgICAgICAgdmFyIGNvb3JkaW5hdGVzID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xyXG4gICAgICAgICAgdmFyIGxhYmVsUG9zO1xyXG5cclxuICAgICAgICAgIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ1BvaW50Jykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvaW50TGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXNbTWF0aC5yb3VuZChjb29yZGluYXRlcy5sZW5ndGggLyAyKV0pO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5Z29uTGFiZWxQb3MobCk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgdmFyIGxhYmVsID0gbGFiZWxNYXJrZXIobGFiZWxQb3MucG9zaXRpb24sIHtcclxuICAgICAgICAgICAgekluZGV4T2Zmc2V0OiAxLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBnZW9qc29uLnByb3BlcnRpZXMsXHJcbiAgICAgICAgICAgIGxhYmVsaW5nSW5mbzogbGFiZWxpbmdJbmZvLFxyXG4gICAgICAgICAgICBvZmZzZXQ6IGxhYmVsUG9zLm9mZnNldCxcclxuICAgICAgICAgICAgcGFuZTogbGFiZWxQYW5lTmFtZVxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgbGFiZWxzTGF5ZXIuYWRkTGF5ZXIobGFiZWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbHlyID0gTC5sYXllckdyb3VwKFtseXIsIGxhYmVsc0xheWVyXSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnQ1NWJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdLTUwnKSB7XHJcbiAgICBsYWJlbHNMYXllciA9IEwuZmVhdHVyZUdyb3VwKGxhYmVscyk7XHJcbiAgICB2YXIga21sID0ga21sTGF5ZXIobnVsbCwge1xyXG4gICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgb3BhY2l0eTogbGF5ZXIub3BhY2l0eSxcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgbC5mZWF0dXJlLmxheWVyTmFtZSA9IGxheWVyLnRpdGxlLnNwbGl0KCdfJylbMV07XHJcbiAgICAgICAgaWYgKGttbC5wb3B1cEluZm8gIT09IHVuZGVmaW5lZCAmJiBrbWwucG9wdXBJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhrbWwucG9wdXBJbmZvKTtcclxuICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQoa21sLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgIC8vIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICBsLmZlYXR1cmUucG9wdXBIdG1sID0gcG9wdXBDb250ZW50XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChrbWwubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQgJiYga21sLmxhYmVsaW5nSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgdmFyIGxhYmVsaW5nSW5mbyA9IGttbC5sYWJlbGluZ0luZm87XHJcbiAgICAgICAgICB2YXIgY29vcmRpbmF0ZXMgPSBsLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XHJcbiAgICAgICAgICB2YXIgbGFiZWxQb3M7XHJcblxyXG4gICAgICAgICAgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnUG9pbnQnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9pbnRMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlc1tNYXRoLnJvdW5kKGNvb3JkaW5hdGVzLmxlbmd0aCAvIDIpXSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlnb25MYWJlbFBvcyhsKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICB2YXIgbGFiZWwgPSBsYWJlbE1hcmtlcihsYWJlbFBvcy5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICB6SW5kZXhPZmZzZXQ6IDEsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IGdlb2pzb24ucHJvcGVydGllcyxcclxuICAgICAgICAgICAgbGFiZWxpbmdJbmZvOiBsYWJlbGluZ0luZm8sXHJcbiAgICAgICAgICAgIG9mZnNldDogbGFiZWxQb3Mub2Zmc2V0LFxyXG4gICAgICAgICAgICBwYW5lOiBsYWJlbFBhbmVOYW1lXHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICBsYWJlbHNMYXllci5hZGRMYXllcihsYWJlbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBseXIgPSBMLmxheWVyR3JvdXAoW2ttbCwgbGFiZWxzTGF5ZXJdKTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdLTUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU0ltYWdlU2VydmljZUxheWVyJykge1xyXG4gICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNJbWFnZVNlcnZpY2VMYXllcicpO1xyXG4gICAgbHlyID0gTC5lc3JpLmltYWdlTWFwTGF5ZXIoe1xyXG4gICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgdG9rZW46IHBhcmFtcy50b2tlbiB8fCBudWxsLFxyXG4gICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgb3BhY2l0eTogbGF5ZXIub3BhY2l0eSB8fCAxXHJcbiAgICB9KTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdJTUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU01hcFNlcnZpY2VMYXllcicpIHtcclxuICAgIGx5ciA9IEwuZXNyaS5keW5hbWljTWFwTGF5ZXIoe1xyXG4gICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgdG9rZW46IHBhcmFtcy50b2tlbiB8fCBudWxsLFxyXG4gICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgb3BhY2l0eTogbGF5ZXIub3BhY2l0eSB8fCAxXHJcbiAgICB9KTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdETUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU1RpbGVkTWFwU2VydmljZUxheWVyJykge1xyXG4gICAgdHJ5IHtcclxuICAgICAgbHlyID0gTC5lc3JpLmJhc2VtYXBMYXllcihsYXllci50aXRsZSk7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIGx5ciA9IEwuZXNyaS50aWxlZE1hcExheWVyKHtcclxuICAgICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgICB0b2tlbjogcGFyYW1zLnRva2VuIHx8IG51bGxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBMLmVzcmkucmVxdWVzdChsYXllci51cmwsIHt9LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcclxuICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB2YXIgbWF4V2lkdGggPSAobWFwLmdldFNpemUoKS54IC0gNTUpO1xyXG4gICAgICAgICAgdmFyIHRpbGVkQXR0cmlidXRpb24gPSAnPHNwYW4gY2xhc3M9XCJlc3JpLWF0dHJpYnV0aW9uc1wiIHN0eWxlPVwibGluZS1oZWlnaHQ6MTRweDsgdmVydGljYWwtYWxpZ246IC0zcHg7IHRleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7IHdoaXRlLXNwYWNlOm5vd3JhcDsgb3ZlcmZsb3c6aGlkZGVuOyBkaXNwbGF5OmlubGluZS1ibG9jazsgbWF4LXdpZHRoOicgKyBtYXhXaWR0aCArICdweDtcIj4nICsgcmVzLmNvcHlyaWdodFRleHQgKyAnPC9zcGFuPic7XHJcbiAgICAgICAgICBtYXAuYXR0cmlidXRpb25Db250cm9sLmFkZEF0dHJpYnV0aW9uKHRpbGVkQXR0cmlidXRpb24pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnbGVhZmxldC10aWxlLXBhbmUnKVswXS5zdHlsZS5vcGFjaXR5ID0gbGF5ZXIub3BhY2l0eSB8fCAxO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ1RNTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnVmVjdG9yVGlsZUxheWVyJykge1xyXG4gICAgdmFyIGtleXMgPSB7XHJcbiAgICAgICdXb3JsZCBTdHJlZXQgTWFwICh3aXRoIFJlbGllZiknOiAnU3RyZWV0c1JlbGllZicsXHJcbiAgICAgICdXb3JsZCBTdHJlZXQgTWFwICh3aXRoIFJlbGllZikgKE1hdHVyZSBTdXBwb3J0KSc6ICdTdHJlZXRzUmVsaWVmJyxcclxuICAgICAgJ0h5YnJpZCBSZWZlcmVuY2UgTGF5ZXInOiAnSHlicmlkJyxcclxuICAgICAgJ0h5YnJpZCBSZWZlcmVuY2UgTGF5ZXIgKE1hdHVyZSBTdXBwb3J0KSc6ICdIeWJyaWQnLFxyXG4gICAgICAnV29ybGQgU3RyZWV0IE1hcCc6ICdTdHJlZXRzJyxcclxuICAgICAgJ1dvcmxkIFN0cmVldCBNYXAgKE1hdHVyZSBTdXBwb3J0KSc6ICdTdHJlZXRzJyxcclxuICAgICAgJ1dvcmxkIFN0cmVldCBNYXAgKE5pZ2h0KSc6ICdTdHJlZXRzTmlnaHQnLFxyXG4gICAgICAnV29ybGQgU3RyZWV0IE1hcCAoTmlnaHQpIChNYXR1cmUgU3VwcG9ydCknOiAnU3RyZWV0c05pZ2h0JyxcclxuICAgICAgJ0RhcmsgR3JheSBDYW52YXMnOiAnRGFya0dyYXknLFxyXG4gICAgICAnRGFyayBHcmF5IENhbnZhcyAoTWF0dXJlIFN1cHBvcnQpJzogJ0RhcmtHcmF5JyxcclxuICAgICAgJ1dvcmxkIFRvcG9ncmFwaGljIE1hcCc6ICdUb3BvZ3JhcGhpYycsXHJcbiAgICAgICdXb3JsZCBUb3BvZ3JhcGhpYyBNYXAgKE1hdHVyZSBTdXBwb3J0KSc6ICdUb3BvZ3JhcGhpYycsXHJcbiAgICAgICdXb3JsZCBOYXZpZ2F0aW9uIE1hcCc6ICdOYXZpZ2F0aW9uJyxcclxuICAgICAgJ1dvcmxkIE5hdmlnYXRpb24gTWFwIChNYXR1cmUgU3VwcG9ydCknOiAnTmF2aWdhdGlvbicsXHJcbiAgICAgICdMaWdodCBHcmF5IENhbnZhcyc6ICdHcmF5JyxcclxuICAgICAgJ0xpZ2h0IEdyYXkgQ2FudmFzIChNYXR1cmUgU3VwcG9ydCknOiAnR3JheSdcclxuICAgICAgLy8nVGVycmFpbiB3aXRoIExhYmVscyc6ICcnLFxyXG4gICAgICAvLydXb3JsZCBUZXJyYWluIHdpdGggTGFiZWxzJzogJycsXHJcbiAgICAgIC8vJ0xpZ2h0IEdyYXkgQ2FudmFzIFJlZmVyZW5jZSc6ICcnLFxyXG4gICAgICAvLydEYXJrIEdyYXkgQ2FudmFzIFJlZmVyZW5jZSc6ICcnLFxyXG4gICAgICAvLydEYXJrIEdyYXkgQ2FudmFzIEJhc2UnOiAnJyxcclxuICAgICAgLy8nTGlnaHQgR3JheSBDYW52YXMgQmFzZSc6ICcnXHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChrZXlzW2xheWVyLnRpdGxlXSkge1xyXG4gICAgICBseXIgPSBMLmVzcmkuVmVjdG9yLmJhc2VtYXAoa2V5c1tsYXllci50aXRsZV0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5lcnJvcignVW5zdXBwb3J0ZWQgVmVjdG9yIFRpbGUgTGF5ZXI6ICcsIGxheWVyKTtcclxuICAgICAgbHlyID0gTC5mZWF0dXJlR3JvdXAoW10pO1xyXG4gICAgfVxyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ1ZUTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCBsYXllci5pZCB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnT3BlblN0cmVldE1hcCcpIHtcclxuICAgIGx5ciA9IEwudGlsZUxheWVyKCdodHRwOi8ve3N9LnRpbGUub3NtLm9yZy97en0ve3h9L3t5fS5wbmcnLCB7XHJcbiAgICAgIGF0dHJpYnV0aW9uOiAnJmNvcHk7IDxhIGhyZWY9XCJodHRwOi8vb3NtLm9yZy9jb3B5cmlnaHRcIj5PcGVuU3RyZWV0TWFwPC9hPiBjb250cmlidXRvcnMnXHJcbiAgICB9KTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdUTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCBsYXllci5pZCB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnV2ViVGlsZWRMYXllcicpIHtcclxuICAgIHZhciBseXJVcmwgPSBfZXNyaVdUTFVybFRlbXBsYXRlVG9MZWFmbGV0KGxheWVyLnRlbXBsYXRlVXJsKTtcclxuICAgIGx5ciA9IEwudGlsZUxheWVyKGx5clVybCwge1xyXG4gICAgICBhdHRyaWJ1dGlvbjogbGF5ZXIuY29weXJpZ2h0XHJcbiAgICB9KTtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2xlYWZsZXQtdGlsZS1wYW5lJylbMF0uc3R5bGUub3BhY2l0eSA9IGxheWVyLm9wYWNpdHkgfHwgMTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdUTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCBsYXllci5pZCB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnV01TJykge1xyXG4gICAgdmFyIGxheWVyTmFtZXMgPSAnJztcclxuICAgIGZvciAoaSA9IDAsIGxlbiA9IGxheWVyLnZpc2libGVMYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgbGF5ZXJOYW1lcyArPSBsYXllci52aXNpYmxlTGF5ZXJzW2ldO1xyXG4gICAgICBpZiAoaSA8IGxlbiAtIDEpIHtcclxuICAgICAgICBsYXllck5hbWVzICs9ICcsJztcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGx5ciA9IEwudGlsZUxheWVyLndtcyhsYXllci51cmwsIHtcclxuICAgICAgbGF5ZXJzOiBTdHJpbmcobGF5ZXJOYW1lcyksXHJcbiAgICAgIGZvcm1hdDogJ2ltYWdlL3BuZycsXHJcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxyXG4gICAgICBhdHRyaWJ1dGlvbjogbGF5ZXIuY29weXJpZ2h0XHJcbiAgICB9KTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdXTVMnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2Uge1xyXG4gICAgbHlyID0gTC5mZWF0dXJlR3JvdXAoW10pO1xyXG4gICAgY29uc29sZS5sb2coJ1Vuc3VwcG9ydGVkIExheWVyOiAnLCBsYXllcik7XHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXQgKHVybCkge1xyXG4gIHZhciBuZXdVcmwgPSB1cmw7XHJcblxyXG4gIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtsZXZlbH0vZywgJ3t6fScpO1xyXG4gIG5ld1VybCA9IG5ld1VybC5yZXBsYWNlKC9cXHtjb2x9L2csICd7eH0nKTtcclxuICBuZXdVcmwgPSBuZXdVcmwucmVwbGFjZSgvXFx7cm93fS9nLCAne3l9Jyk7XHJcblxyXG4gIHJldHVybiBuZXdVcmw7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgT3BlcmF0aW9uYWxMYXllciA9IHtcclxuICBvcGVyYXRpb25hbExheWVyOiBvcGVyYXRpb25hbExheWVyLFxyXG4gIF9nZW5lcmF0ZUVzcmlMYXllcjogX2dlbmVyYXRlRXNyaUxheWVyLFxyXG4gIF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXQ6IF9lc3JpV1RMVXJsVGVtcGxhdGVUb0xlYWZsZXRcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IE9wZXJhdGlvbmFsTGF5ZXI7XHJcbiIsIi8qXHJcbiAqIEwuZXNyaS5XZWJNYXBcclxuICogQSBsZWFmbGV0IHBsdWdpbiB0byBkaXNwbGF5IEFyY0dJUyBXZWIgTWFwLiBodHRwczovL2dpdGh1Yi5jb20veW51bm9rYXdhL0wuZXNyaS5XZWJNYXBcclxuICogKGMpIDIwMTYgWXVzdWtlIE51bm9rYXdhXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIGBgYGpzXHJcbiAqIHZhciB3ZWJtYXAgPSBMLndlYm1hcCgnMjJjNTA0ZDIyOWYxNGM3ODljNWI0OWViZmYzOGI5NDEnLCB7IG1hcDogTC5tYXAoJ21hcCcpIH0pO1xyXG4gKiBgYGBcclxuICovXHJcblxyXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi4vcGFja2FnZS5qc29uJztcclxuXHJcbmltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5pbXBvcnQgeyBvcGVyYXRpb25hbExheWVyIH0gZnJvbSAnLi9PcGVyYXRpb25hbExheWVyJztcclxuXHJcbmV4cG9ydCB2YXIgV2ViTWFwID0gTC5FdmVudGVkLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgLy8gTC5NYXBcclxuICAgIG1hcDoge30sXHJcbiAgICAvLyBhY2Nlc3MgdG9rZW4gZm9yIHNlY3VyZSBjb250ZW50cyBvbiBBcmNHSVMgT25saW5lXHJcbiAgICB0b2tlbjogbnVsbCxcclxuICAgIC8vIHNlcnZlciBkb21haW4gbmFtZSAoZGVmYXVsdD0gJ3d3dy5hcmNnaXMuY29tJylcclxuICAgIHNlcnZlcjogJ3d3dy5hcmNnaXMuY29tJ1xyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uICh3ZWJtYXBJZCwgb3B0aW9ucykge1xyXG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX21hcCA9IHRoaXMub3B0aW9ucy5tYXA7XHJcbiAgICB0aGlzLl90b2tlbiA9IHRoaXMub3B0aW9ucy50b2tlbjtcclxuICAgIHRoaXMuX3NlcnZlciA9IHRoaXMub3B0aW9ucy5zZXJ2ZXI7XHJcbiAgICB0aGlzLl93ZWJtYXBJZCA9IHdlYm1hcElkO1xyXG4gICAgdGhpcy5fbG9hZGVkID0gZmFsc2U7XHJcbiAgICB0aGlzLl9tZXRhZGF0YUxvYWRlZCA9IGZhbHNlO1xyXG4gICAgdGhpcy5fbG9hZGVkTGF5ZXJzTnVtID0gMDtcclxuICAgIHRoaXMuX2xheWVyc051bSA9IDA7XHJcblxyXG4gICAgdGhpcy5sYXllcnMgPSBbXTsgLy8gQ2hlY2sgdGhlIGxheWVyIHR5cGVzIGhlcmUgLT4gaHR0cHM6Ly9naXRodWIuY29tL3ludW5va2F3YS9MLmVzcmkuV2ViTWFwL3dpa2kvTGF5ZXItdHlwZXNcclxuICAgIHRoaXMudGl0bGUgPSAnJzsgLy8gV2ViIE1hcCBUaXRsZVxyXG4gICAgdGhpcy5ib29rbWFya3MgPSBbXTsgLy8gV2ViIE1hcCBCb29rbWFya3MgLT4gW3sgbmFtZTogJ0Jvb2ttYXJrIG5hbWUnLCBib3VuZHM6IDxMLmxhdExuZ0JvdW5kcz4gfV1cclxuICAgIHRoaXMucG9ydGFsSXRlbSA9IHt9OyAvLyBXZWIgTWFwIE1ldGFkYXRhXHJcblxyXG4gICAgdGhpcy5WRVJTSU9OID0gdmVyc2lvbjtcclxuXHJcbiAgICB0aGlzLl9sb2FkV2ViTWFwTWV0YURhdGEod2VibWFwSWQpO1xyXG4gICAgdGhpcy5fbG9hZFdlYk1hcCh3ZWJtYXBJZCk7XHJcbiAgfSxcclxuXHJcbiAgX2NoZWNrTG9hZGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLl9sb2FkZWRMYXllcnNOdW0rKztcclxuICAgIGlmICh0aGlzLl9sb2FkZWRMYXllcnNOdW0gPT09IHRoaXMuX2xheWVyc051bSkge1xyXG4gICAgICB0aGlzLl9sb2FkZWQgPSB0cnVlO1xyXG4gICAgICB0aGlzLmZpcmUoJ2xvYWQnKTtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBfb3BlcmF0aW9uYWxMYXllcjogZnVuY3Rpb24gKGxheWVyLCBsYXllcnMsIG1hcCwgcGFyYW1zLCBwYW5lTmFtZSkge1xyXG4gICAgdmFyIGx5ciA9IG9wZXJhdGlvbmFsTGF5ZXIobGF5ZXIsIGxheWVycywgbWFwLCBwYXJhbXMsIHBhbmVOYW1lKTtcclxuICAgIGlmIChseXIgIT09IHVuZGVmaW5lZCAmJiBsYXllci52aXNpYmlsaXR5ID09PSB0cnVlKSB7XHJcbiAgICAgIGx5ci5hZGRUbyhtYXApO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIF9sb2FkV2ViTWFwTWV0YURhdGE6IGZ1bmN0aW9uIChpZCkge1xyXG4gICAgLy8gY29uc29sZS5sb2coJ19sb2FkV2ViTWFwTWV0YURhdGEgaXMgcnVubmluZywgaWQ6JywgaWQsICd0aGlzLl9zZXJ2ZXI6JywgdGhpcy5fc2VydmVyKTtcclxuICAgIHZhciBwYXJhbXMgPSB7fTtcclxuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XHJcbiAgICB2YXIgd2VibWFwID0gdGhpcztcclxuICAgIHZhciB3ZWJtYXBNZXRhRGF0YVJlcXVlc3RVcmwgPSAnaHR0cHM6Ly8nICsgdGhpcy5fc2VydmVyICsgJy9zaGFyaW5nL3Jlc3QvY29udGVudC9pdGVtcy8nICsgaWQ7XHJcbiAgICBpZiAodGhpcy5fdG9rZW4gJiYgdGhpcy5fdG9rZW4ubGVuZ3RoID4gMCkge1xyXG4gICAgICBwYXJhbXMudG9rZW4gPSB0aGlzLl90b2tlbjtcclxuICAgIH1cclxuXHJcbiAgICBMLmVzcmkucmVxdWVzdCh3ZWJtYXBNZXRhRGF0YVJlcXVlc3RVcmwsIHBhcmFtcywgZnVuY3Rpb24gKGVycm9yLCByZXNwb25zZSkge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1dlYk1hcCBNZXRhRGF0YTogJywgcmVzcG9uc2UpO1xyXG4gICAgICAgIHdlYm1hcC5wb3J0YWxJdGVtID0gcmVzcG9uc2U7XHJcbiAgICAgICAgd2VibWFwLnRpdGxlID0gcmVzcG9uc2UudGl0bGU7XHJcbiAgICAgICAgd2VibWFwLl9tZXRhZGF0YUxvYWRlZCA9IHRydWU7XHJcbiAgICAgICAgd2VibWFwLmZpcmUoJ21ldGFkYXRhTG9hZCcpO1xyXG4gICAgICAgIG1hcC5maXRCb3VuZHMoW3Jlc3BvbnNlLmV4dGVudFswXS5yZXZlcnNlKCksIHJlc3BvbnNlLmV4dGVudFsxXS5yZXZlcnNlKCldKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSxcclxuXHJcbiAgX2xvYWRXZWJNYXA6IGZ1bmN0aW9uIChpZCkge1xyXG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcclxuICAgIHZhciBsYXllcnMgPSB0aGlzLmxheWVycztcclxuICAgIHZhciBzZXJ2ZXIgPSB0aGlzLl9zZXJ2ZXI7XHJcbiAgICB2YXIgcGFyYW1zID0ge307XHJcbiAgICB2YXIgd2VibWFwUmVxdWVzdFVybCA9ICdodHRwczovLycgKyBzZXJ2ZXIgKyAnL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpZCArICcvZGF0YSc7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnd2VibWFwUmVxdWVzdFVybDonLCB3ZWJtYXBSZXF1ZXN0VXJsLCAndGhpcy5fdG9rZW46JywgdGhpcy5fdG9rZW4pO1xyXG4gICAgaWYgKHRoaXMuX3Rva2VuICYmIHRoaXMuX3Rva2VuLmxlbmd0aCA+IDApIHtcclxuICAgICAgcGFyYW1zLnRva2VuID0gdGhpcy5fdG9rZW47XHJcbiAgICB9XHJcblxyXG4gICAgTC5lc3JpLnJlcXVlc3Qod2VibWFwUmVxdWVzdFVybCwgcGFyYW1zLCBmdW5jdGlvbiAoZXJyb3IsIHJlc3BvbnNlKSB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdMLmVzcmkucmVxdWVzdCBlcnJvcjonLCBlcnJvcik7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1dlYk1hcDogJywgcmVzcG9uc2UpO1xyXG4gICAgICAgIHRoaXMuX2xheWVyc051bSA9IHJlc3BvbnNlLmJhc2VNYXAuYmFzZU1hcExheWVycy5sZW5ndGggKyByZXNwb25zZS5vcGVyYXRpb25hbExheWVycy5sZW5ndGg7XHJcblxyXG4gICAgICAgIC8vIEFkZCBCYXNlbWFwXHJcbiAgICAgICAgcmVzcG9uc2UuYmFzZU1hcC5iYXNlTWFwTGF5ZXJzLm1hcChmdW5jdGlvbiAoYmFzZU1hcExheWVyKSB7XHJcbiAgICAgICAgICBpZiAoYmFzZU1hcExheWVyLml0ZW1JZCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHZhciBpdGVtUmVxdWVzdFVybCA9ICdodHRwczovLycgKyBzZXJ2ZXIgKyAnL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBiYXNlTWFwTGF5ZXIuaXRlbUlkO1xyXG4gICAgICAgICAgICBMLmVzcmkucmVxdWVzdChpdGVtUmVxdWVzdFVybCwgcGFyYW1zLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcclxuICAgICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cocmVzLmFjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzLmFjY2VzcyAhPT0gJ3B1YmxpYycpIHtcclxuICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ2luIF9sb2FkV2ViTWFwIHB1YmxpYycpXHJcbiAgICAgICAgICAgICAgICAgIHRoaXMuX29wZXJhdGlvbmFsTGF5ZXIoYmFzZU1hcExheWVyLCBsYXllcnMsIG1hcCwgcGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdpbiBfbG9hZFdlYk1hcCBOT1QgcHVibGljJylcclxuICAgICAgICAgICAgICAgICAgdGhpcy5fb3BlcmF0aW9uYWxMYXllcihiYXNlTWFwTGF5ZXIsIGxheWVycywgbWFwLCB7fSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIHRoaXMuX2NoZWNrTG9hZGVkKCk7XHJcbiAgICAgICAgICAgIH0sIHRoaXMpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fb3BlcmF0aW9uYWxMYXllcihiYXNlTWFwTGF5ZXIsIGxheWVycywgbWFwLCB7fSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2NoZWNrTG9hZGVkKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgLy8gQWRkIE9wZXJhdGlvbmFsIExheWVyc1xyXG4gICAgICAgIHJlc3BvbnNlLm9wZXJhdGlvbmFsTGF5ZXJzLm1hcChmdW5jdGlvbiAobGF5ZXIsIGkpIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdyZXNwb25zZS5vcGVyYXRpb25hbExheWVycywgbGF5ZXI6JywgbGF5ZXIpO1xyXG4gICAgICAgICAgdmFyIHBhbmVOYW1lID0gJ2Vzcmktd2VibWFwLWxheWVyJyArIGk7XHJcbiAgICAgICAgICBtYXAuY3JlYXRlUGFuZShwYW5lTmFtZSk7XHJcbiAgICAgICAgICBpZiAobGF5ZXIuaXRlbUlkICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ1dlYk1hcExvYWRlci5qcyBwYW5lTmFtZTonLCBwYW5lTmFtZSk7XHJcbiAgICAgICAgICAgIHZhciBpdGVtUmVxdWVzdFVybCA9ICdodHRwczovLycgKyBzZXJ2ZXIgKyAnL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBsYXllci5pdGVtSWQ7XHJcbiAgICAgICAgICAgIEwuZXNyaS5yZXF1ZXN0KGl0ZW1SZXF1ZXN0VXJsLCBwYXJhbXMsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xyXG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhyZXMuYWNjZXNzKTtcclxuICAgICAgICAgICAgICAgIGlmIChyZXMuYWNjZXNzICE9PSAncHVibGljJykge1xyXG4gICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnaW5zaWRlIHB1YmxpYywgbGF5ZXI6JywgbGF5ZXIsICdsYXllcnM6JywgbGF5ZXJzLCAnbWFwOicsIG1hcCwgJ3BhcmFtczonLCBwYXJhbXMsICdwYW5lTmFtZTonLCBwYW5lTmFtZSk7XHJcbiAgICAgICAgICAgICAgICAgIHRoaXMuX29wZXJhdGlvbmFsTGF5ZXIobGF5ZXIsIGxheWVycywgbWFwLCBwYXJhbXMsIHBhbmVOYW1lKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdOT1QgaW5zaWRlIHB1YmxpYywgbGF5ZXI6JywgbGF5ZXIsICdsYXllcnM6JywgbGF5ZXJzLCAnbWFwOicsIG1hcCwgJ3BhcmFtczonLCBwYXJhbXMsICdwYW5lTmFtZTonLCBwYW5lTmFtZSk7XHJcbiAgICAgICAgICAgICAgICAgIHRoaXMuX29wZXJhdGlvbmFsTGF5ZXIobGF5ZXIsIGxheWVycywgbWFwLCB7fSwgcGFuZU5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB0aGlzLl9jaGVja0xvYWRlZCgpO1xyXG4gICAgICAgICAgICB9LCB0aGlzKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX29wZXJhdGlvbmFsTGF5ZXIobGF5ZXIsIGxheWVycywgbWFwLCB7fSwgcGFuZU5hbWUpO1xyXG4gICAgICAgICAgICB0aGlzLl9jaGVja0xvYWRlZCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBCb29rbWFya3NcclxuICAgICAgICBpZiAocmVzcG9uc2UuYm9va21hcmtzICE9PSB1bmRlZmluZWQgJiYgcmVzcG9uc2UuYm9va21hcmtzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHJlc3BvbnNlLmJvb2ttYXJrcy5tYXAoZnVuY3Rpb24gKGJvb2ttYXJrKSB7XHJcbiAgICAgICAgICAgIC8vIEVzcmkgRXh0ZW50IEdlb21ldHJ5IHRvIEwubGF0TG5nQm91bmRzXHJcbiAgICAgICAgICAgIHZhciBub3J0aEVhc3QgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoYm9va21hcmsuZXh0ZW50LnhtYXgsIGJvb2ttYXJrLmV4dGVudC55bWF4KSk7XHJcbiAgICAgICAgICAgIHZhciBzb3V0aFdlc3QgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoYm9va21hcmsuZXh0ZW50LnhtaW4sIGJvb2ttYXJrLmV4dGVudC55bWluKSk7XHJcbiAgICAgICAgICAgIHZhciBib3VuZHMgPSBMLmxhdExuZ0JvdW5kcyhzb3V0aFdlc3QsIG5vcnRoRWFzdCk7XHJcbiAgICAgICAgICAgIHRoaXMuYm9va21hcmtzLnB1c2goeyBuYW1lOiBib29rbWFyay5uYW1lLCBib3VuZHM6IGJvdW5kcyB9KTtcclxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3RoaXMuX2xvYWRlZCA9IHRydWU7XHJcbiAgICAgICAgLy90aGlzLmZpcmUoJ2xvYWQnKTtcclxuICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdlYk1hcCAod2VibWFwSWQsIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IFdlYk1hcCh3ZWJtYXBJZCwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHdlYk1hcDtcclxuIl0sIm5hbWVzIjpbIlJlbmRlcmVyIiwicGFyc2UiLCJnZXREYXlPZlllYXIiLCJnZXRJU09XZWVrIiwic3RhcnRPZklTT1dlZWsiLCJnZXRJU09ZZWFyIiwiaXNWYWxpZCIsImlzRGF0ZSIsImZvcm1hdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Q0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBOztBQUVBLENBQUE7QUFDQSxDQUFBLFNBQVMsV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDNUIsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLENBQUEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdkIsQ0FBQSxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ25CLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQSxTQUFTLFNBQVMsRUFBRSxXQUFXLEVBQUU7QUFDakMsQ0FBQSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDekUsQ0FBQSxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckMsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBLFNBQVMsZUFBZSxFQUFFLFVBQVUsRUFBRTtBQUN0QyxDQUFBLEVBQUUsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2hCLENBQUEsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDWixDQUFBLEVBQUUsSUFBSSxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztBQUNsQyxDQUFBLEVBQUUsSUFBSSxHQUFHLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUEsRUFBRSxJQUFJLEdBQUcsQ0FBQztBQUNWLENBQUEsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNoQyxDQUFBLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDNUIsQ0FBQSxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuRCxDQUFBLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNkLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQSxTQUFTLHNCQUFzQixFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtBQUNqRCxDQUFBLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RixDQUFBLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RixDQUFBLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFckYsQ0FBQSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRTtBQUNoQixDQUFBLElBQUksSUFBSSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUN0QixDQUFBLElBQUksSUFBSSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQzs7QUFFdEIsQ0FBQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNsRCxDQUFBLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQSxTQUFTLG9CQUFvQixFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDckMsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN6QyxDQUFBLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzNDLENBQUEsTUFBTSxJQUFJLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDbEUsQ0FBQSxRQUFRLE9BQU8sSUFBSSxDQUFDO0FBQ3BCLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFBLENBQUM7O0FBRUQsQ0FBQTtBQUNBLENBQUEsU0FBUyx1QkFBdUIsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFO0FBQ3RELENBQUEsRUFBRSxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7QUFDdkIsQ0FBQSxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDdEUsQ0FBQSxJQUFJLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFBLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RSxDQUFBLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNqSyxDQUFBLE1BQU0sUUFBUSxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQzNCLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxPQUFP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TSxjQUFjLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDdkMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDOztBQUV2QyxDQUFBLFFBQVEsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtBQUMzQixDQUFBLFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzFCLENBQUEsVUFBVSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxDQUFBLFNBQVM7O0FBRVQsQ0FBQSxRQUFRLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDdkUsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDL0QsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDL0QsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQzs7QUFFaEUsQ0FBQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLENBQUEsT0FBTztBQUNQLENBQUEsS0FBSyxDQUFDLENBQUM7QUFDUCxDQUFBLEdBQUc7QUFDSCxDQUFB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O0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUEsU0FBUyxNQUFNLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUU7QUFDMUQsQ0FBQSxFQUFFLElBQUksU0FB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QSxFQUFFLEtBQUssR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUN4QyxDQUFBLEVBQUUsSUFBSSxLQUFLLEVBQUU7QUFDYixDQUFBLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFBLElBQUksSUFBSSxTQUFTLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7QUFDMUMsQ0FBQSxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxTQUFTLENBQUM7QUFDM0MsQ0FBQSxJQUFJLE9BQU8sSUFBSTtBQUNmLENBQUEsR0FBRzs7QUFFSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLEtBQUssR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUN6QyxDQUFBLEVBQUUsSUFBSSxLQUFLLEVBQUU7QUFDYixDQUFBLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFBLElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQztBQUN0QyxDQUFBLElBQUksSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7QUFDcEMsQ0FBQSxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUM7QUFDekMsQ0FBQSxJQUFJLE9BQU8sSUFBSTtBQUNmLENBQUEsR0FBRzs7QUFFSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLEtBQUssR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUN4QyxDQUFBLEVBQUUsSUFBSSxLQUFLLEVBQUU7QUFDYixDQUFBLElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQztB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