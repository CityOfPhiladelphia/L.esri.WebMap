/* L-esri-WebMap - v0.4.0 - Tue Oct 22 2019 15:21:29 GMT-0400 (Eastern Daylight Time)
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

	/**
	 * @name toDate
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
	 * If the argument is none of the above, the function returns Invalid Date.
	 *
	 * **Note**: *all* Date arguments passed to any *date-fns* function is processed by `toDate`.
	 *
	 * @param {Date|Number} argument - the value to convert
	 * @returns {Date} the parsed date in the local time zone
	 * @throws {TypeError} 1 argument required
	 *
	 * @example
	 * // Clone the date:
	 * const result = toDate(new Date(2014, 1, 11, 11, 30, 30))
	 * //=> Tue Feb 11 2014 11:30:30
	 *
	 * @example
	 * // Convert the timestamp to date:
	 * const result = toDate(1392098430000)
	 * //=> Tue Feb 11 2014 11:30:30
	 */
	function toDate(argument) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var argStr = Object.prototype.toString.call(argument); // Clone the date

	  if (argument instanceof Date || typeof argument === 'object' && argStr === '[object Date]') {
	    // Prevent the date to lose the milliseconds when passed to new Date() in IE10
	    return new Date(argument.getTime());
	  } else if (typeof argument === 'number' || argStr === '[object Number]') {
	    return new Date(argument);
	  } else {
	    if ((typeof argument === 'string' || argStr === '[object String]') && typeof console !== 'undefined') {
	      // eslint-disable-next-line no-console
	      console.warn("Starting with v2.0.0-beta.1 date-fns doesn't accept strings as arguments. Please use `parseISO` to parse strings. See: https://git.io/fjule"); // eslint-disable-next-line no-console

	      console.warn(new Error().stack);
	    }

	    return new Date(NaN);
	  }
	}

	function toInteger(dirtyNumber) {
	  if (dirtyNumber === null || dirtyNumber === true || dirtyNumber === false) {
	    return NaN;
	  }

	  var number = Number(dirtyNumber);

	  if (isNaN(number)) {
	    return number;
	  }

	  return number < 0 ? Math.ceil(number) : Math.floor(number);
	}

	/**
	 * @name addMilliseconds
	 * @category Millisecond Helpers
	 * @summary Add the specified number of milliseconds to the given date.
	 *
	 * @description
	 * Add the specified number of milliseconds to the given date.
	 *
	 * ### v2.0.0 breaking changes:
	 *
	 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
	 *
	 * @param {Date|Number} date - the date to be changed
	 * @param {Number} amount - the amount of milliseconds to be added
	 * @returns {Date} the new date with the milliseconds added
	 * @throws {TypeError} 2 arguments required
	 *
	 * @example
	 * // Add 750 milliseconds to 10 July 2014 12:45:30.000:
	 * var result = addMilliseconds(new Date(2014, 6, 10, 12, 45, 30, 0), 750)
	 * //=> Thu Jul 10 2014 12:45:30.750
	 */

	function addMilliseconds(dirtyDate, dirtyAmount) {
	  if (arguments.length < 2) {
	    throw new TypeError('2 arguments required, but only ' + arguments.length + ' present');
	  }

	  var timestamp = toDate(dirtyDate).getTime();
	  var amount = toInteger(dirtyAmount);
	  return new Date(timestamp + amount);
	}

	var MILLISECONDS_IN_MINUTE = 60000;
	/**
	 * Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.
	 * They usually appear for dates that denote time before the timezones were introduced
	 * (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891
	 * and GMT+01:00:00 after that date)
	 *
	 * Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,
	 * which would lead to incorrect calculations.
	 *
	 * This function returns the timezone offset in milliseconds that takes seconds in account.
	 */

	function getTimezoneOffsetInMilliseconds(dirtyDate) {
	  var date = new Date(dirtyDate.getTime());
	  var baseTimezoneOffset = date.getTimezoneOffset();
	  date.setSeconds(0, 0);
	  var millisecondsPartOfTimezoneOffset = date.getTime() % MILLISECONDS_IN_MINUTE;
	  return baseTimezoneOffset * MILLISECONDS_IN_MINUTE + millisecondsPartOfTimezoneOffset;
	}

	/**
	 * @name isValid
	 * @category Common Helpers
	 * @summary Is the given date valid?
	 *
	 * @description
	 * Returns false if argument is Invalid Date and true otherwise.
	 * Argument is converted to Date using `toDate`. See [toDate]{@link https://date-fns.org/docs/toDate}
	 * Invalid Date is a Date, whose time value is NaN.
	 *
	 * Time value of Date: http://es5.github.io/#x15.9.1.1
	 *
	 * ### v2.0.0 breaking changes:
	 *
	 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
	 *
	 * - Now `isValid` doesn't throw an exception
	 *   if the first argument is not an instance of Date.
	 *   Instead, argument is converted beforehand using `toDate`.
	 *
	 *   Examples:
	 *
	 *   | `isValid` argument        | Before v2.0.0 | v2.0.0 onward |
	 *   |---------------------------|---------------|---------------|
	 *   | `new Date()`              | `true`        | `true`        |
	 *   | `new Date('2016-01-01')`  | `true`        | `true`        |
	 *   | `new Date('')`            | `false`       | `false`       |
	 *   | `new Date(1488370835081)` | `true`        | `true`        |
	 *   | `new Date(NaN)`           | `false`       | `false`       |
	 *   | `'2016-01-01'`            | `TypeError`   | `false`       |
	 *   | `''`                      | `TypeError`   | `false`       |
	 *   | `1488370835081`           | `TypeError`   | `true`        |
	 *   | `NaN`                     | `TypeError`   | `false`       |
	 *
	 *   We introduce this change to make *date-fns* consistent with ECMAScript behavior
	 *   that try to coerce arguments to the expected type
	 *   (which is also the case with other *date-fns* functions).
	 *
	 * @param {*} date - the date to check
	 * @returns {Boolean} the date is valid
	 * @throws {TypeError} 1 argument required
	 *
	 * @example
	 * // For the valid date:
	 * var result = isValid(new Date(2014, 1, 31))
	 * //=> true
	 *
	 * @example
	 * // For the value, convertable into a date:
	 * var result = isValid(1393804800000)
	 * //=> true
	 *
	 * @example
	 * // For the invalid date:
	 * var result = isValid(new Date(''))
	 * //=> false
	 */

	function isValid(dirtyDate) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate);
	  return !isNaN(date);
	}

	var formatDistanceLocale = {
	  lessThanXSeconds: {
	    one: 'less than a second',
	    other: 'less than {{count}} seconds'
	  },
	  xSeconds: {
	    one: '1 second',
	    other: '{{count}} seconds'
	  },
	  halfAMinute: 'half a minute',
	  lessThanXMinutes: {
	    one: 'less than a minute',
	    other: 'less than {{count}} minutes'
	  },
	  xMinutes: {
	    one: '1 minute',
	    other: '{{count}} minutes'
	  },
	  aboutXHours: {
	    one: 'about 1 hour',
	    other: 'about {{count}} hours'
	  },
	  xHours: {
	    one: '1 hour',
	    other: '{{count}} hours'
	  },
	  xDays: {
	    one: '1 day',
	    other: '{{count}} days'
	  },
	  aboutXMonths: {
	    one: 'about 1 month',
	    other: 'about {{count}} months'
	  },
	  xMonths: {
	    one: '1 month',
	    other: '{{count}} months'
	  },
	  aboutXYears: {
	    one: 'about 1 year',
	    other: 'about {{count}} years'
	  },
	  xYears: {
	    one: '1 year',
	    other: '{{count}} years'
	  },
	  overXYears: {
	    one: 'over 1 year',
	    other: 'over {{count}} years'
	  },
	  almostXYears: {
	    one: 'almost 1 year',
	    other: 'almost {{count}} years'
	  }
	};
	function formatDistance(token, count, options) {
	  options = options || {};
	  var result;

	  if (typeof formatDistanceLocale[token] === 'string') {
	    result = formatDistanceLocale[token];
	  } else if (count === 1) {
	    result = formatDistanceLocale[token].one;
	  } else {
	    result = formatDistanceLocale[token].other.replace('{{count}}', count);
	  }

	  if (options.addSuffix) {
	    if (options.comparison > 0) {
	      return 'in ' + result;
	    } else {
	      return result + ' ago';
	    }
	  }

	  return result;
	}

	function buildFormatLongFn(args) {
	  return function (dirtyOptions) {
	    var options = dirtyOptions || {};
	    var width = options.width ? String(options.width) : args.defaultWidth;
	    var format = args.formats[width] || args.formats[args.defaultWidth];
	    return format;
	  };
	}

	var dateFormats = {
	  full: 'EEEE, MMMM do, y',
	  long: 'MMMM do, y',
	  medium: 'MMM d, y',
	  short: 'MM/dd/yyyy'
	};
	var timeFormats = {
	  full: 'h:mm:ss a zzzz',
	  long: 'h:mm:ss a z',
	  medium: 'h:mm:ss a',
	  short: 'h:mm a'
	};
	var dateTimeFormats = {
	  full: "{{date}} 'at' {{time}}",
	  long: "{{date}} 'at' {{time}}",
	  medium: '{{date}}, {{time}}',
	  short: '{{date}}, {{time}}'
	};
	var formatLong = {
	  date: buildFormatLongFn({
	    formats: dateFormats,
	    defaultWidth: 'full'
	  }),
	  time: buildFormatLongFn({
	    formats: timeFormats,
	    defaultWidth: 'full'
	  }),
	  dateTime: buildFormatLongFn({
	    formats: dateTimeFormats,
	    defaultWidth: 'full'
	  })
	};

	var formatRelativeLocale = {
	  lastWeek: "'last' eeee 'at' p",
	  yesterday: "'yesterday at' p",
	  today: "'today at' p",
	  tomorrow: "'tomorrow at' p",
	  nextWeek: "eeee 'at' p",
	  other: 'P'
	};
	function formatRelative(token, _date, _baseDate, _options) {
	  return formatRelativeLocale[token];
	}

	function buildLocalizeFn(args) {
	  return function (dirtyIndex, dirtyOptions) {
	    var options = dirtyOptions || {};
	    var context = options.context ? String(options.context) : 'standalone';
	    var valuesArray;

	    if (context === 'formatting' && args.formattingValues) {
	      var defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
	      var width = options.width ? String(options.width) : defaultWidth;
	      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
	    } else {
	      var _defaultWidth = args.defaultWidth;

	      var _width = options.width ? String(options.width) : args.defaultWidth;

	      valuesArray = args.values[_width] || args.values[_defaultWidth];
	    }

	    var index = args.argumentCallback ? args.argumentCallback(dirtyIndex) : dirtyIndex;
	    return valuesArray[index];
	  };
	}

	var eraValues = {
	  narrow: ['B', 'A'],
	  abbreviated: ['BC', 'AD'],
	  wide: ['Before Christ', 'Anno Domini']
	};
	var quarterValues = {
	  narrow: ['1', '2', '3', '4'],
	  abbreviated: ['Q1', 'Q2', 'Q3', 'Q4'],
	  wide: ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter'] // Note: in English, the names of days of the week and months are capitalized.
	  // If you are making a new locale based on this one, check if the same is true for the language you're working on.
	  // Generally, formatted dates should look like they are in the middle of a sentence,
	  // e.g. in Spanish language the weekdays and months should be in the lowercase.

	};
	var monthValues = {
	  narrow: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
	  abbreviated: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
	  wide: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
	};
	var dayValues = {
	  narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
	  short: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
	  abbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
	  wide: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
	};
	var dayPeriodValues = {
	  narrow: {
	    am: 'a',
	    pm: 'p',
	    midnight: 'mi',
	    noon: 'n',
	    morning: 'morning',
	    afternoon: 'afternoon',
	    evening: 'evening',
	    night: 'night'
	  },
	  abbreviated: {
	    am: 'AM',
	    pm: 'PM',
	    midnight: 'midnight',
	    noon: 'noon',
	    morning: 'morning',
	    afternoon: 'afternoon',
	    evening: 'evening',
	    night: 'night'
	  },
	  wide: {
	    am: 'a.m.',
	    pm: 'p.m.',
	    midnight: 'midnight',
	    noon: 'noon',
	    morning: 'morning',
	    afternoon: 'afternoon',
	    evening: 'evening',
	    night: 'night'
	  }
	};
	var formattingDayPeriodValues = {
	  narrow: {
	    am: 'a',
	    pm: 'p',
	    midnight: 'mi',
	    noon: 'n',
	    morning: 'in the morning',
	    afternoon: 'in the afternoon',
	    evening: 'in the evening',
	    night: 'at night'
	  },
	  abbreviated: {
	    am: 'AM',
	    pm: 'PM',
	    midnight: 'midnight',
	    noon: 'noon',
	    morning: 'in the morning',
	    afternoon: 'in the afternoon',
	    evening: 'in the evening',
	    night: 'at night'
	  },
	  wide: {
	    am: 'a.m.',
	    pm: 'p.m.',
	    midnight: 'midnight',
	    noon: 'noon',
	    morning: 'in the morning',
	    afternoon: 'in the afternoon',
	    evening: 'in the evening',
	    night: 'at night'
	  }
	};

	function ordinalNumber(dirtyNumber, _dirtyOptions) {
	  var number = Number(dirtyNumber); // If ordinal numbers depend on context, for example,
	  // if they are different for different grammatical genders,
	  // use `options.unit`:
	  //
	  //   var options = dirtyOptions || {}
	  //   var unit = String(options.unit)
	  //
	  // where `unit` can be 'year', 'quarter', 'month', 'week', 'date', 'dayOfYear',
	  // 'day', 'hour', 'minute', 'second'

	  var rem100 = number % 100;

	  if (rem100 > 20 || rem100 < 10) {
	    switch (rem100 % 10) {
	      case 1:
	        return number + 'st';

	      case 2:
	        return number + 'nd';

	      case 3:
	        return number + 'rd';
	    }
	  }

	  return number + 'th';
	}

	var localize = {
	  ordinalNumber: ordinalNumber,
	  era: buildLocalizeFn({
	    values: eraValues,
	    defaultWidth: 'wide'
	  }),
	  quarter: buildLocalizeFn({
	    values: quarterValues,
	    defaultWidth: 'wide',
	    argumentCallback: function (quarter) {
	      return Number(quarter) - 1;
	    }
	  }),
	  month: buildLocalizeFn({
	    values: monthValues,
	    defaultWidth: 'wide'
	  }),
	  day: buildLocalizeFn({
	    values: dayValues,
	    defaultWidth: 'wide'
	  }),
	  dayPeriod: buildLocalizeFn({
	    values: dayPeriodValues,
	    defaultWidth: 'wide',
	    formattingValues: formattingDayPeriodValues,
	    defaultFormattingWidth: 'wide'
	  })
	};

	function buildMatchPatternFn(args) {
	  return function (dirtyString, dirtyOptions) {
	    var string = String(dirtyString);
	    var options = dirtyOptions || {};
	    var matchResult = string.match(args.matchPattern);

	    if (!matchResult) {
	      return null;
	    }

	    var matchedString = matchResult[0];
	    var parseResult = string.match(args.parsePattern);

	    if (!parseResult) {
	      return null;
	    }

	    var value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
	    value = options.valueCallback ? options.valueCallback(value) : value;
	    return {
	      value: value,
	      rest: string.slice(matchedString.length)
	    };
	  };
	}

	function buildMatchFn(args) {
	  return function (dirtyString, dirtyOptions) {
	    var string = String(dirtyString);
	    var options = dirtyOptions || {};
	    var width = options.width;
	    var matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
	    var matchResult = string.match(matchPattern);

	    if (!matchResult) {
	      return null;
	    }

	    var matchedString = matchResult[0];
	    var parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
	    var value;

	    if (Object.prototype.toString.call(parsePatterns) === '[object Array]') {
	      value = findIndex(parsePatterns, function (pattern) {
	        return pattern.test(string);
	      });
	    } else {
	      value = findKey(parsePatterns, function (pattern) {
	        return pattern.test(string);
	      });
	    }

	    value = args.valueCallback ? args.valueCallback(value) : value;
	    value = options.valueCallback ? options.valueCallback(value) : value;
	    return {
	      value: value,
	      rest: string.slice(matchedString.length)
	    };
	  };
	}

	function findKey(object, predicate) {
	  for (var key in object) {
	    if (object.hasOwnProperty(key) && predicate(object[key])) {
	      return key;
	    }
	  }
	}

	function findIndex(array, predicate) {
	  for (var key = 0; key < array.length; key++) {
	    if (predicate(array[key])) {
	      return key;
	    }
	  }
	}

	var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
	var parseOrdinalNumberPattern = /\d+/i;
	var matchEraPatterns = {
	  narrow: /^(b|a)/i,
	  abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
	  wide: /^(before christ|before common era|anno domini|common era)/i
	};
	var parseEraPatterns = {
	  any: [/^b/i, /^(a|c)/i]
	};
	var matchQuarterPatterns = {
	  narrow: /^[1234]/i,
	  abbreviated: /^q[1234]/i,
	  wide: /^[1234](th|st|nd|rd)? quarter/i
	};
	var parseQuarterPatterns = {
	  any: [/1/i, /2/i, /3/i, /4/i]
	};
	var matchMonthPatterns = {
	  narrow: /^[jfmasond]/i,
	  abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
	  wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
	};
	var parseMonthPatterns = {
	  narrow: [/^j/i, /^f/i, /^m/i, /^a/i, /^m/i, /^j/i, /^j/i, /^a/i, /^s/i, /^o/i, /^n/i, /^d/i],
	  any: [/^ja/i, /^f/i, /^mar/i, /^ap/i, /^may/i, /^jun/i, /^jul/i, /^au/i, /^s/i, /^o/i, /^n/i, /^d/i]
	};
	var matchDayPatterns = {
	  narrow: /^[smtwf]/i,
	  short: /^(su|mo|tu|we|th|fr|sa)/i,
	  abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
	  wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
	};
	var parseDayPatterns = {
	  narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
	  any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
	};
	var matchDayPeriodPatterns = {
	  narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
	  any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
	};
	var parseDayPeriodPatterns = {
	  any: {
	    am: /^a/i,
	    pm: /^p/i,
	    midnight: /^mi/i,
	    noon: /^no/i,
	    morning: /morning/i,
	    afternoon: /afternoon/i,
	    evening: /evening/i,
	    night: /night/i
	  }
	};
	var match = {
	  ordinalNumber: buildMatchPatternFn({
	    matchPattern: matchOrdinalNumberPattern,
	    parsePattern: parseOrdinalNumberPattern,
	    valueCallback: function (value) {
	      return parseInt(value, 10);
	    }
	  }),
	  era: buildMatchFn({
	    matchPatterns: matchEraPatterns,
	    defaultMatchWidth: 'wide',
	    parsePatterns: parseEraPatterns,
	    defaultParseWidth: 'any'
	  }),
	  quarter: buildMatchFn({
	    matchPatterns: matchQuarterPatterns,
	    defaultMatchWidth: 'wide',
	    parsePatterns: parseQuarterPatterns,
	    defaultParseWidth: 'any',
	    valueCallback: function (index) {
	      return index + 1;
	    }
	  }),
	  month: buildMatchFn({
	    matchPatterns: matchMonthPatterns,
	    defaultMatchWidth: 'wide',
	    parsePatterns: parseMonthPatterns,
	    defaultParseWidth: 'any'
	  }),
	  day: buildMatchFn({
	    matchPatterns: matchDayPatterns,
	    defaultMatchWidth: 'wide',
	    parsePatterns: parseDayPatterns,
	    defaultParseWidth: 'any'
	  }),
	  dayPeriod: buildMatchFn({
	    matchPatterns: matchDayPeriodPatterns,
	    defaultMatchWidth: 'any',
	    parsePatterns: parseDayPeriodPatterns,
	    defaultParseWidth: 'any'
	  })
	};

	/**
	 * @type {Locale}
	 * @category Locales
	 * @summary English locale (United States).
	 * @language English
	 * @iso-639-2 eng
	 * @author Sasha Koss [@kossnocorp]{@link https://github.com/kossnocorp}
	 * @author Lesha Koss [@leshakoss]{@link https://github.com/leshakoss}
	 */

	var locale = {
	  code: 'en-US',
	  formatDistance: formatDistance,
	  formatLong: formatLong,
	  formatRelative: formatRelative,
	  localize: localize,
	  match: match,
	  options: {
	    weekStartsOn: 0
	    /* Sunday */
	    ,
	    firstWeekContainsDate: 1
	  }
	};

	/**
	 * @name subMilliseconds
	 * @category Millisecond Helpers
	 * @summary Subtract the specified number of milliseconds from the given date.
	 *
	 * @description
	 * Subtract the specified number of milliseconds from the given date.
	 *
	 * ### v2.0.0 breaking changes:
	 *
	 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
	 *
	 * @param {Date|Number} date - the date to be changed
	 * @param {Number} amount - the amount of milliseconds to be subtracted
	 * @returns {Date} the new date with the milliseconds subtracted
	 * @throws {TypeError} 2 arguments required
	 *
	 * @example
	 * // Subtract 750 milliseconds from 10 July 2014 12:45:30.000:
	 * var result = subMilliseconds(new Date(2014, 6, 10, 12, 45, 30, 0), 750)
	 * //=> Thu Jul 10 2014 12:45:29.250
	 */

	function subMilliseconds(dirtyDate, dirtyAmount) {
	  if (arguments.length < 2) {
	    throw new TypeError('2 arguments required, but only ' + arguments.length + ' present');
	  }

	  var amount = toInteger(dirtyAmount);
	  return addMilliseconds(dirtyDate, -amount);
	}

	function addLeadingZeros(number, targetLength) {
	  var sign = number < 0 ? '-' : '';
	  var output = Math.abs(number).toString();

	  while (output.length < targetLength) {
	    output = '0' + output;
	  }

	  return sign + output;
	}

	/*
	 * |     | Unit                           |     | Unit                           |
	 * |-----|--------------------------------|-----|--------------------------------|
	 * |  a  | AM, PM                         |  A* |                                |
	 * |  d  | Day of month                   |  D  |                                |
	 * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
	 * |  m  | Minute                         |  M  | Month                          |
	 * |  s  | Second                         |  S  | Fraction of second             |
	 * |  y  | Year (abs)                     |  Y  |                                |
	 *
	 * Letters marked by * are not implemented but reserved by Unicode standard.
	 */

	var formatters$1 = {
	  // Year
	  y: function (date, token) {
	    // From http://www.unicode.org/reports/tr35/tr35-31/tr35-dates.html#Date_Format_tokens
	    // | Year     |     y | yy |   yyy |  yyyy | yyyyy |
	    // |----------|-------|----|-------|-------|-------|
	    // | AD 1     |     1 | 01 |   001 |  0001 | 00001 |
	    // | AD 12    |    12 | 12 |   012 |  0012 | 00012 |
	    // | AD 123   |   123 | 23 |   123 |  0123 | 00123 |
	    // | AD 1234  |  1234 | 34 |  1234 |  1234 | 01234 |
	    // | AD 12345 | 12345 | 45 | 12345 | 12345 | 12345 |
	    var signedYear = date.getUTCFullYear(); // Returns 1 for 1 BC (which is year 0 in JavaScript)

	    var year = signedYear > 0 ? signedYear : 1 - signedYear;
	    return addLeadingZeros(token === 'yy' ? year % 100 : year, token.length);
	  },
	  // Month
	  M: function (date, token) {
	    var month = date.getUTCMonth();
	    return token === 'M' ? String(month + 1) : addLeadingZeros(month + 1, 2);
	  },
	  // Day of the month
	  d: function (date, token) {
	    return addLeadingZeros(date.getUTCDate(), token.length);
	  },
	  // AM or PM
	  a: function (date, token) {
	    var dayPeriodEnumValue = date.getUTCHours() / 12 >= 1 ? 'pm' : 'am';

	    switch (token) {
	      case 'a':
	      case 'aa':
	      case 'aaa':
	        return dayPeriodEnumValue.toUpperCase();

	      case 'aaaaa':
	        return dayPeriodEnumValue[0];

	      case 'aaaa':
	      default:
	        return dayPeriodEnumValue === 'am' ? 'a.m.' : 'p.m.';
	    }
	  },
	  // Hour [1-12]
	  h: function (date, token) {
	    return addLeadingZeros(date.getUTCHours() % 12 || 12, token.length);
	  },
	  // Hour [0-23]
	  H: function (date, token) {
	    return addLeadingZeros(date.getUTCHours(), token.length);
	  },
	  // Minute
	  m: function (date, token) {
	    return addLeadingZeros(date.getUTCMinutes(), token.length);
	  },
	  // Second
	  s: function (date, token) {
	    return addLeadingZeros(date.getUTCSeconds(), token.length);
	  },
	  // Fraction of second
	  S: function (date, token) {
	    var numberOfDigits = token.length;
	    var milliseconds = date.getUTCMilliseconds();
	    var fractionalSeconds = Math.floor(milliseconds * Math.pow(10, numberOfDigits - 3));
	    return addLeadingZeros(fractionalSeconds, token.length);
	  }
	};

	var MILLISECONDS_IN_DAY$1 = 86400000; // This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function getUTCDayOfYear(dirtyDate) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate);
	  var timestamp = date.getTime();
	  date.setUTCMonth(0, 1);
	  date.setUTCHours(0, 0, 0, 0);
	  var startOfYearTimestamp = date.getTime();
	  var difference = timestamp - startOfYearTimestamp;
	  return Math.floor(difference / MILLISECONDS_IN_DAY$1) + 1;
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function startOfUTCISOWeek(dirtyDate) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var weekStartsOn = 1;
	  var date = toDate(dirtyDate);
	  var day = date.getUTCDay();
	  var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
	  date.setUTCDate(date.getUTCDate() - diff);
	  date.setUTCHours(0, 0, 0, 0);
	  return date;
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function getUTCISOWeekYear(dirtyDate) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate);
	  var year = date.getUTCFullYear();
	  var fourthOfJanuaryOfNextYear = new Date(0);
	  fourthOfJanuaryOfNextYear.setUTCFullYear(year + 1, 0, 4);
	  fourthOfJanuaryOfNextYear.setUTCHours(0, 0, 0, 0);
	  var startOfNextYear = startOfUTCISOWeek(fourthOfJanuaryOfNextYear);
	  var fourthOfJanuaryOfThisYear = new Date(0);
	  fourthOfJanuaryOfThisYear.setUTCFullYear(year, 0, 4);
	  fourthOfJanuaryOfThisYear.setUTCHours(0, 0, 0, 0);
	  var startOfThisYear = startOfUTCISOWeek(fourthOfJanuaryOfThisYear);

	  if (date.getTime() >= startOfNextYear.getTime()) {
	    return year + 1;
	  } else if (date.getTime() >= startOfThisYear.getTime()) {
	    return year;
	  } else {
	    return year - 1;
	  }
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function startOfUTCISOWeekYear(dirtyDate) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var year = getUTCISOWeekYear(dirtyDate);
	  var fourthOfJanuary = new Date(0);
	  fourthOfJanuary.setUTCFullYear(year, 0, 4);
	  fourthOfJanuary.setUTCHours(0, 0, 0, 0);
	  var date = startOfUTCISOWeek(fourthOfJanuary);
	  return date;
	}

	var MILLISECONDS_IN_WEEK$2 = 604800000; // This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function getUTCISOWeek(dirtyDate) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate);
	  var diff = startOfUTCISOWeek(date).getTime() - startOfUTCISOWeekYear(date).getTime(); // Round the number of days to the nearest integer
	  // because the number of milliseconds in a week is not constant
	  // (e.g. it's different in the week of the daylight saving time clock shift)

	  return Math.round(diff / MILLISECONDS_IN_WEEK$2) + 1;
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function startOfUTCWeek(dirtyDate, dirtyOptions) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var options = dirtyOptions || {};
	  var locale = options.locale;
	  var localeWeekStartsOn = locale && locale.options && locale.options.weekStartsOn;
	  var defaultWeekStartsOn = localeWeekStartsOn == null ? 0 : toInteger(localeWeekStartsOn);
	  var weekStartsOn = options.weekStartsOn == null ? defaultWeekStartsOn : toInteger(options.weekStartsOn); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

	  if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
	    throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
	  }

	  var date = toDate(dirtyDate);
	  var day = date.getUTCDay();
	  var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
	  date.setUTCDate(date.getUTCDate() - diff);
	  date.setUTCHours(0, 0, 0, 0);
	  return date;
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function getUTCWeekYear(dirtyDate, dirtyOptions) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate, dirtyOptions);
	  var year = date.getUTCFullYear();
	  var options = dirtyOptions || {};
	  var locale = options.locale;
	  var localeFirstWeekContainsDate = locale && locale.options && locale.options.firstWeekContainsDate;
	  var defaultFirstWeekContainsDate = localeFirstWeekContainsDate == null ? 1 : toInteger(localeFirstWeekContainsDate);
	  var firstWeekContainsDate = options.firstWeekContainsDate == null ? defaultFirstWeekContainsDate : toInteger(options.firstWeekContainsDate); // Test if weekStartsOn is between 1 and 7 _and_ is not NaN

	  if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
	    throw new RangeError('firstWeekContainsDate must be between 1 and 7 inclusively');
	  }

	  var firstWeekOfNextYear = new Date(0);
	  firstWeekOfNextYear.setUTCFullYear(year + 1, 0, firstWeekContainsDate);
	  firstWeekOfNextYear.setUTCHours(0, 0, 0, 0);
	  var startOfNextYear = startOfUTCWeek(firstWeekOfNextYear, dirtyOptions);
	  var firstWeekOfThisYear = new Date(0);
	  firstWeekOfThisYear.setUTCFullYear(year, 0, firstWeekContainsDate);
	  firstWeekOfThisYear.setUTCHours(0, 0, 0, 0);
	  var startOfThisYear = startOfUTCWeek(firstWeekOfThisYear, dirtyOptions);

	  if (date.getTime() >= startOfNextYear.getTime()) {
	    return year + 1;
	  } else if (date.getTime() >= startOfThisYear.getTime()) {
	    return year;
	  } else {
	    return year - 1;
	  }
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function startOfUTCWeekYear(dirtyDate, dirtyOptions) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var options = dirtyOptions || {};
	  var locale = options.locale;
	  var localeFirstWeekContainsDate = locale && locale.options && locale.options.firstWeekContainsDate;
	  var defaultFirstWeekContainsDate = localeFirstWeekContainsDate == null ? 1 : toInteger(localeFirstWeekContainsDate);
	  var firstWeekContainsDate = options.firstWeekContainsDate == null ? defaultFirstWeekContainsDate : toInteger(options.firstWeekContainsDate);
	  var year = getUTCWeekYear(dirtyDate, dirtyOptions);
	  var firstWeek = new Date(0);
	  firstWeek.setUTCFullYear(year, 0, firstWeekContainsDate);
	  firstWeek.setUTCHours(0, 0, 0, 0);
	  var date = startOfUTCWeek(firstWeek, dirtyOptions);
	  return date;
	}

	var MILLISECONDS_IN_WEEK$3 = 604800000; // This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function getUTCWeek(dirtyDate, options) {
	  if (arguments.length < 1) {
	    throw new TypeError('1 argument required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate);
	  var diff = startOfUTCWeek(date, options).getTime() - startOfUTCWeekYear(date, options).getTime(); // Round the number of days to the nearest integer
	  // because the number of milliseconds in a week is not constant
	  // (e.g. it's different in the week of the daylight saving time clock shift)

	  return Math.round(diff / MILLISECONDS_IN_WEEK$3) + 1;
	}

	var dayPeriodEnum = {
	  am: 'am',
	  pm: 'pm',
	  midnight: 'midnight',
	  noon: 'noon',
	  morning: 'morning',
	  afternoon: 'afternoon',
	  evening: 'evening',
	  night: 'night'
	  /*
	   * |     | Unit                           |     | Unit                           |
	   * |-----|--------------------------------|-----|--------------------------------|
	   * |  a  | AM, PM                         |  A* | Milliseconds in day            |
	   * |  b  | AM, PM, noon, midnight         |  B  | Flexible day period            |
	   * |  c  | Stand-alone local day of week  |  C* | Localized hour w/ day period   |
	   * |  d  | Day of month                   |  D  | Day of year                    |
	   * |  e  | Local day of week              |  E  | Day of week                    |
	   * |  f  |                                |  F* | Day of week in month           |
	   * |  g* | Modified Julian day            |  G  | Era                            |
	   * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
	   * |  i! | ISO day of week                |  I! | ISO week of year               |
	   * |  j* | Localized hour w/ day period   |  J* | Localized hour w/o day period  |
	   * |  k  | Hour [1-24]                    |  K  | Hour [0-11]                    |
	   * |  l* | (deprecated)                   |  L  | Stand-alone month              |
	   * |  m  | Minute                         |  M  | Month                          |
	   * |  n  |                                |  N  |                                |
	   * |  o! | Ordinal number modifier        |  O  | Timezone (GMT)                 |
	   * |  p! | Long localized time            |  P! | Long localized date            |
	   * |  q  | Stand-alone quarter            |  Q  | Quarter                        |
	   * |  r* | Related Gregorian year         |  R! | ISO week-numbering year        |
	   * |  s  | Second                         |  S  | Fraction of second             |
	   * |  t! | Seconds timestamp              |  T! | Milliseconds timestamp         |
	   * |  u  | Extended year                  |  U* | Cyclic year                    |
	   * |  v* | Timezone (generic non-locat.)  |  V* | Timezone (location)            |
	   * |  w  | Local week of year             |  W* | Week of month                  |
	   * |  x  | Timezone (ISO-8601 w/o Z)      |  X  | Timezone (ISO-8601)            |
	   * |  y  | Year (abs)                     |  Y  | Local week-numbering year      |
	   * |  z  | Timezone (specific non-locat.) |  Z* | Timezone (aliases)             |
	   *
	   * Letters marked by * are not implemented but reserved by Unicode standard.
	   *
	   * Letters marked by ! are non-standard, but implemented by date-fns:
	   * - `o` modifies the previous token to turn it into an ordinal (see `format` docs)
	   * - `i` is ISO day of week. For `i` and `ii` is returns numeric ISO week days,
	   *   i.e. 7 for Sunday, 1 for Monday, etc.
	   * - `I` is ISO week of year, as opposed to `w` which is local week of year.
	   * - `R` is ISO week-numbering year, as opposed to `Y` which is local week-numbering year.
	   *   `R` is supposed to be used in conjunction with `I` and `i`
	   *   for universal ISO week-numbering date, whereas
	   *   `Y` is supposed to be used in conjunction with `w` and `e`
	   *   for week-numbering date specific to the locale.
	   * - `P` is long localized date format
	   * - `p` is long localized time format
	   */

	};
	var formatters = {
	  // Era
	  G: function (date, token, localize) {
	    var era = date.getUTCFullYear() > 0 ? 1 : 0;

	    switch (token) {
	      // AD, BC
	      case 'G':
	      case 'GG':
	      case 'GGG':
	        return localize.era(era, {
	          width: 'abbreviated'
	        });
	      // A, B

	      case 'GGGGG':
	        return localize.era(era, {
	          width: 'narrow'
	        });
	      // Anno Domini, Before Christ

	      case 'GGGG':
	      default:
	        return localize.era(era, {
	          width: 'wide'
	        });
	    }
	  },
	  // Year
	  y: function (date, token, localize) {
	    // Ordinal number
	    if (token === 'yo') {
	      var signedYear = date.getUTCFullYear(); // Returns 1 for 1 BC (which is year 0 in JavaScript)

	      var year = signedYear > 0 ? signedYear : 1 - signedYear;
	      return localize.ordinalNumber(year, {
	        unit: 'year'
	      });
	    }

	    return formatters$1.y(date, token);
	  },
	  // Local week-numbering year
	  Y: function (date, token, localize, options) {
	    var signedWeekYear = getUTCWeekYear(date, options); // Returns 1 for 1 BC (which is year 0 in JavaScript)

	    var weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear; // Two digit year

	    if (token === 'YY') {
	      var twoDigitYear = weekYear % 100;
	      return addLeadingZeros(twoDigitYear, 2);
	    } // Ordinal number


	    if (token === 'Yo') {
	      return localize.ordinalNumber(weekYear, {
	        unit: 'year'
	      });
	    } // Padding


	    return addLeadingZeros(weekYear, token.length);
	  },
	  // ISO week-numbering year
	  R: function (date, token) {
	    var isoWeekYear = getUTCISOWeekYear(date); // Padding

	    return addLeadingZeros(isoWeekYear, token.length);
	  },
	  // Extended year. This is a single number designating the year of this calendar system.
	  // The main difference between `y` and `u` localizers are B.C. years:
	  // | Year | `y` | `u` |
	  // |------|-----|-----|
	  // | AC 1 |   1 |   1 |
	  // | BC 1 |   1 |   0 |
	  // | BC 2 |   2 |  -1 |
	  // Also `yy` always returns the last two digits of a year,
	  // while `uu` pads single digit years to 2 characters and returns other years unchanged.
	  u: function (date, token) {
	    var year = date.getUTCFullYear();
	    return addLeadingZeros(year, token.length);
	  },
	  // Quarter
	  Q: function (date, token, localize) {
	    var quarter = Math.ceil((date.getUTCMonth() + 1) / 3);

	    switch (token) {
	      // 1, 2, 3, 4
	      case 'Q':
	        return String(quarter);
	      // 01, 02, 03, 04

	      case 'QQ':
	        return addLeadingZeros(quarter, 2);
	      // 1st, 2nd, 3rd, 4th

	      case 'Qo':
	        return localize.ordinalNumber(quarter, {
	          unit: 'quarter'
	        });
	      // Q1, Q2, Q3, Q4

	      case 'QQQ':
	        return localize.quarter(quarter, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });
	      // 1, 2, 3, 4 (narrow quarter; could be not numerical)

	      case 'QQQQQ':
	        return localize.quarter(quarter, {
	          width: 'narrow',
	          context: 'formatting'
	        });
	      // 1st quarter, 2nd quarter, ...

	      case 'QQQQ':
	      default:
	        return localize.quarter(quarter, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // Stand-alone quarter
	  q: function (date, token, localize) {
	    var quarter = Math.ceil((date.getUTCMonth() + 1) / 3);

	    switch (token) {
	      // 1, 2, 3, 4
	      case 'q':
	        return String(quarter);
	      // 01, 02, 03, 04

	      case 'qq':
	        return addLeadingZeros(quarter, 2);
	      // 1st, 2nd, 3rd, 4th

	      case 'qo':
	        return localize.ordinalNumber(quarter, {
	          unit: 'quarter'
	        });
	      // Q1, Q2, Q3, Q4

	      case 'qqq':
	        return localize.quarter(quarter, {
	          width: 'abbreviated',
	          context: 'standalone'
	        });
	      // 1, 2, 3, 4 (narrow quarter; could be not numerical)

	      case 'qqqqq':
	        return localize.quarter(quarter, {
	          width: 'narrow',
	          context: 'standalone'
	        });
	      // 1st quarter, 2nd quarter, ...

	      case 'qqqq':
	      default:
	        return localize.quarter(quarter, {
	          width: 'wide',
	          context: 'standalone'
	        });
	    }
	  },
	  // Month
	  M: function (date, token, localize) {
	    var month = date.getUTCMonth();

	    switch (token) {
	      case 'M':
	      case 'MM':
	        return formatters$1.M(date, token);
	      // 1st, 2nd, ..., 12th

	      case 'Mo':
	        return localize.ordinalNumber(month + 1, {
	          unit: 'month'
	        });
	      // Jan, Feb, ..., Dec

	      case 'MMM':
	        return localize.month(month, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });
	      // J, F, ..., D

	      case 'MMMMM':
	        return localize.month(month, {
	          width: 'narrow',
	          context: 'formatting'
	        });
	      // January, February, ..., December

	      case 'MMMM':
	      default:
	        return localize.month(month, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // Stand-alone month
	  L: function (date, token, localize) {
	    var month = date.getUTCMonth();

	    switch (token) {
	      // 1, 2, ..., 12
	      case 'L':
	        return String(month + 1);
	      // 01, 02, ..., 12

	      case 'LL':
	        return addLeadingZeros(month + 1, 2);
	      // 1st, 2nd, ..., 12th

	      case 'Lo':
	        return localize.ordinalNumber(month + 1, {
	          unit: 'month'
	        });
	      // Jan, Feb, ..., Dec

	      case 'LLL':
	        return localize.month(month, {
	          width: 'abbreviated',
	          context: 'standalone'
	        });
	      // J, F, ..., D

	      case 'LLLLL':
	        return localize.month(month, {
	          width: 'narrow',
	          context: 'standalone'
	        });
	      // January, February, ..., December

	      case 'LLLL':
	      default:
	        return localize.month(month, {
	          width: 'wide',
	          context: 'standalone'
	        });
	    }
	  },
	  // Local week of year
	  w: function (date, token, localize, options) {
	    var week = getUTCWeek(date, options);

	    if (token === 'wo') {
	      return localize.ordinalNumber(week, {
	        unit: 'week'
	      });
	    }

	    return addLeadingZeros(week, token.length);
	  },
	  // ISO week of year
	  I: function (date, token, localize) {
	    var isoWeek = getUTCISOWeek(date);

	    if (token === 'Io') {
	      return localize.ordinalNumber(isoWeek, {
	        unit: 'week'
	      });
	    }

	    return addLeadingZeros(isoWeek, token.length);
	  },
	  // Day of the month
	  d: function (date, token, localize) {
	    if (token === 'do') {
	      return localize.ordinalNumber(date.getUTCDate(), {
	        unit: 'date'
	      });
	    }

	    return formatters$1.d(date, token);
	  },
	  // Day of year
	  D: function (date, token, localize) {
	    var dayOfYear = getUTCDayOfYear(date);

	    if (token === 'Do') {
	      return localize.ordinalNumber(dayOfYear, {
	        unit: 'dayOfYear'
	      });
	    }

	    return addLeadingZeros(dayOfYear, token.length);
	  },
	  // Day of week
	  E: function (date, token, localize) {
	    var dayOfWeek = date.getUTCDay();

	    switch (token) {
	      // Tue
	      case 'E':
	      case 'EE':
	      case 'EEE':
	        return localize.day(dayOfWeek, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });
	      // T

	      case 'EEEEE':
	        return localize.day(dayOfWeek, {
	          width: 'narrow',
	          context: 'formatting'
	        });
	      // Tu

	      case 'EEEEEE':
	        return localize.day(dayOfWeek, {
	          width: 'short',
	          context: 'formatting'
	        });
	      // Tuesday

	      case 'EEEE':
	      default:
	        return localize.day(dayOfWeek, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // Local day of week
	  e: function (date, token, localize, options) {
	    var dayOfWeek = date.getUTCDay();
	    var localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;

	    switch (token) {
	      // Numerical value (Nth day of week with current locale or weekStartsOn)
	      case 'e':
	        return String(localDayOfWeek);
	      // Padded numerical value

	      case 'ee':
	        return addLeadingZeros(localDayOfWeek, 2);
	      // 1st, 2nd, ..., 7th

	      case 'eo':
	        return localize.ordinalNumber(localDayOfWeek, {
	          unit: 'day'
	        });

	      case 'eee':
	        return localize.day(dayOfWeek, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });
	      // T

	      case 'eeeee':
	        return localize.day(dayOfWeek, {
	          width: 'narrow',
	          context: 'formatting'
	        });
	      // Tu

	      case 'eeeeee':
	        return localize.day(dayOfWeek, {
	          width: 'short',
	          context: 'formatting'
	        });
	      // Tuesday

	      case 'eeee':
	      default:
	        return localize.day(dayOfWeek, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // Stand-alone local day of week
	  c: function (date, token, localize, options) {
	    var dayOfWeek = date.getUTCDay();
	    var localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;

	    switch (token) {
	      // Numerical value (same as in `e`)
	      case 'c':
	        return String(localDayOfWeek);
	      // Padded numerical value

	      case 'cc':
	        return addLeadingZeros(localDayOfWeek, token.length);
	      // 1st, 2nd, ..., 7th

	      case 'co':
	        return localize.ordinalNumber(localDayOfWeek, {
	          unit: 'day'
	        });

	      case 'ccc':
	        return localize.day(dayOfWeek, {
	          width: 'abbreviated',
	          context: 'standalone'
	        });
	      // T

	      case 'ccccc':
	        return localize.day(dayOfWeek, {
	          width: 'narrow',
	          context: 'standalone'
	        });
	      // Tu

	      case 'cccccc':
	        return localize.day(dayOfWeek, {
	          width: 'short',
	          context: 'standalone'
	        });
	      // Tuesday

	      case 'cccc':
	      default:
	        return localize.day(dayOfWeek, {
	          width: 'wide',
	          context: 'standalone'
	        });
	    }
	  },
	  // ISO day of week
	  i: function (date, token, localize) {
	    var dayOfWeek = date.getUTCDay();
	    var isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

	    switch (token) {
	      // 2
	      case 'i':
	        return String(isoDayOfWeek);
	      // 02

	      case 'ii':
	        return addLeadingZeros(isoDayOfWeek, token.length);
	      // 2nd

	      case 'io':
	        return localize.ordinalNumber(isoDayOfWeek, {
	          unit: 'day'
	        });
	      // Tue

	      case 'iii':
	        return localize.day(dayOfWeek, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });
	      // T

	      case 'iiiii':
	        return localize.day(dayOfWeek, {
	          width: 'narrow',
	          context: 'formatting'
	        });
	      // Tu

	      case 'iiiiii':
	        return localize.day(dayOfWeek, {
	          width: 'short',
	          context: 'formatting'
	        });
	      // Tuesday

	      case 'iiii':
	      default:
	        return localize.day(dayOfWeek, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // AM or PM
	  a: function (date, token, localize) {
	    var hours = date.getUTCHours();
	    var dayPeriodEnumValue = hours / 12 >= 1 ? 'pm' : 'am';

	    switch (token) {
	      case 'a':
	      case 'aa':
	      case 'aaa':
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });

	      case 'aaaaa':
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'narrow',
	          context: 'formatting'
	        });

	      case 'aaaa':
	      default:
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // AM, PM, midnight, noon
	  b: function (date, token, localize) {
	    var hours = date.getUTCHours();
	    var dayPeriodEnumValue;

	    if (hours === 12) {
	      dayPeriodEnumValue = dayPeriodEnum.noon;
	    } else if (hours === 0) {
	      dayPeriodEnumValue = dayPeriodEnum.midnight;
	    } else {
	      dayPeriodEnumValue = hours / 12 >= 1 ? 'pm' : 'am';
	    }

	    switch (token) {
	      case 'b':
	      case 'bb':
	      case 'bbb':
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });

	      case 'bbbbb':
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'narrow',
	          context: 'formatting'
	        });

	      case 'bbbb':
	      default:
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // in the morning, in the afternoon, in the evening, at night
	  B: function (date, token, localize) {
	    var hours = date.getUTCHours();
	    var dayPeriodEnumValue;

	    if (hours >= 17) {
	      dayPeriodEnumValue = dayPeriodEnum.evening;
	    } else if (hours >= 12) {
	      dayPeriodEnumValue = dayPeriodEnum.afternoon;
	    } else if (hours >= 4) {
	      dayPeriodEnumValue = dayPeriodEnum.morning;
	    } else {
	      dayPeriodEnumValue = dayPeriodEnum.night;
	    }

	    switch (token) {
	      case 'B':
	      case 'BB':
	      case 'BBB':
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'abbreviated',
	          context: 'formatting'
	        });

	      case 'BBBBB':
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'narrow',
	          context: 'formatting'
	        });

	      case 'BBBB':
	      default:
	        return localize.dayPeriod(dayPeriodEnumValue, {
	          width: 'wide',
	          context: 'formatting'
	        });
	    }
	  },
	  // Hour [1-12]
	  h: function (date, token, localize) {
	    if (token === 'ho') {
	      var hours = date.getUTCHours() % 12;
	      if (hours === 0) hours = 12;
	      return localize.ordinalNumber(hours, {
	        unit: 'hour'
	      });
	    }

	    return formatters$1.h(date, token);
	  },
	  // Hour [0-23]
	  H: function (date, token, localize) {
	    if (token === 'Ho') {
	      return localize.ordinalNumber(date.getUTCHours(), {
	        unit: 'hour'
	      });
	    }

	    return formatters$1.H(date, token);
	  },
	  // Hour [0-11]
	  K: function (date, token, localize) {
	    var hours = date.getUTCHours() % 12;

	    if (token === 'Ko') {
	      return localize.ordinalNumber(hours, {
	        unit: 'hour'
	      });
	    }

	    return addLeadingZeros(hours, token.length);
	  },
	  // Hour [1-24]
	  k: function (date, token, localize) {
	    var hours = date.getUTCHours();
	    if (hours === 0) hours = 24;

	    if (token === 'ko') {
	      return localize.ordinalNumber(hours, {
	        unit: 'hour'
	      });
	    }

	    return addLeadingZeros(hours, token.length);
	  },
	  // Minute
	  m: function (date, token, localize) {
	    if (token === 'mo') {
	      return localize.ordinalNumber(date.getUTCMinutes(), {
	        unit: 'minute'
	      });
	    }

	    return formatters$1.m(date, token);
	  },
	  // Second
	  s: function (date, token, localize) {
	    if (token === 'so') {
	      return localize.ordinalNumber(date.getUTCSeconds(), {
	        unit: 'second'
	      });
	    }

	    return formatters$1.s(date, token);
	  },
	  // Fraction of second
	  S: function (date, token) {
	    return formatters$1.S(date, token);
	  },
	  // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
	  X: function (date, token, _localize, options) {
	    var originalDate = options._originalDate || date;
	    var timezoneOffset = originalDate.getTimezoneOffset();

	    if (timezoneOffset === 0) {
	      return 'Z';
	    }

	    switch (token) {
	      // Hours and optional minutes
	      case 'X':
	        return formatTimezoneWithOptionalMinutes(timezoneOffset);
	      // Hours, minutes and optional seconds without `:` delimiter
	      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
	      // so this token always has the same output as `XX`

	      case 'XXXX':
	      case 'XX':
	        // Hours and minutes without `:` delimiter
	        return formatTimezone(timezoneOffset);
	      // Hours, minutes and optional seconds with `:` delimiter
	      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
	      // so this token always has the same output as `XXX`

	      case 'XXXXX':
	      case 'XXX': // Hours and minutes with `:` delimiter

	      default:
	        return formatTimezone(timezoneOffset, ':');
	    }
	  },
	  // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
	  x: function (date, token, _localize, options) {
	    var originalDate = options._originalDate || date;
	    var timezoneOffset = originalDate.getTimezoneOffset();

	    switch (token) {
	      // Hours and optional minutes
	      case 'x':
	        return formatTimezoneWithOptionalMinutes(timezoneOffset);
	      // Hours, minutes and optional seconds without `:` delimiter
	      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
	      // so this token always has the same output as `xx`

	      case 'xxxx':
	      case 'xx':
	        // Hours and minutes without `:` delimiter
	        return formatTimezone(timezoneOffset);
	      // Hours, minutes and optional seconds with `:` delimiter
	      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
	      // so this token always has the same output as `xxx`

	      case 'xxxxx':
	      case 'xxx': // Hours and minutes with `:` delimiter

	      default:
	        return formatTimezone(timezoneOffset, ':');
	    }
	  },
	  // Timezone (GMT)
	  O: function (date, token, _localize, options) {
	    var originalDate = options._originalDate || date;
	    var timezoneOffset = originalDate.getTimezoneOffset();

	    switch (token) {
	      // Short
	      case 'O':
	      case 'OO':
	      case 'OOO':
	        return 'GMT' + formatTimezoneShort(timezoneOffset, ':');
	      // Long

	      case 'OOOO':
	      default:
	        return 'GMT' + formatTimezone(timezoneOffset, ':');
	    }
	  },
	  // Timezone (specific non-location)
	  z: function (date, token, _localize, options) {
	    var originalDate = options._originalDate || date;
	    var timezoneOffset = originalDate.getTimezoneOffset();

	    switch (token) {
	      // Short
	      case 'z':
	      case 'zz':
	      case 'zzz':
	        return 'GMT' + formatTimezoneShort(timezoneOffset, ':');
	      // Long

	      case 'zzzz':
	      default:
	        return 'GMT' + formatTimezone(timezoneOffset, ':');
	    }
	  },
	  // Seconds timestamp
	  t: function (date, token, _localize, options) {
	    var originalDate = options._originalDate || date;
	    var timestamp = Math.floor(originalDate.getTime() / 1000);
	    return addLeadingZeros(timestamp, token.length);
	  },
	  // Milliseconds timestamp
	  T: function (date, token, _localize, options) {
	    var originalDate = options._originalDate || date;
	    var timestamp = originalDate.getTime();
	    return addLeadingZeros(timestamp, token.length);
	  }
	};

	function formatTimezoneShort(offset, dirtyDelimiter) {
	  var sign = offset > 0 ? '-' : '+';
	  var absOffset = Math.abs(offset);
	  var hours = Math.floor(absOffset / 60);
	  var minutes = absOffset % 60;

	  if (minutes === 0) {
	    return sign + String(hours);
	  }

	  var delimiter = dirtyDelimiter || '';
	  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
	}

	function formatTimezoneWithOptionalMinutes(offset, dirtyDelimiter) {
	  if (offset % 60 === 0) {
	    var sign = offset > 0 ? '-' : '+';
	    return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
	  }

	  return formatTimezone(offset, dirtyDelimiter);
	}

	function formatTimezone(offset, dirtyDelimiter) {
	  var delimiter = dirtyDelimiter || '';
	  var sign = offset > 0 ? '-' : '+';
	  var absOffset = Math.abs(offset);
	  var hours = addLeadingZeros(Math.floor(absOffset / 60), 2);
	  var minutes = addLeadingZeros(absOffset % 60, 2);
	  return sign + hours + delimiter + minutes;
	}

	function dateLongFormatter(pattern, formatLong) {
	  switch (pattern) {
	    case 'P':
	      return formatLong.date({
	        width: 'short'
	      });

	    case 'PP':
	      return formatLong.date({
	        width: 'medium'
	      });

	    case 'PPP':
	      return formatLong.date({
	        width: 'long'
	      });

	    case 'PPPP':
	    default:
	      return formatLong.date({
	        width: 'full'
	      });
	  }
	}

	function timeLongFormatter(pattern, formatLong) {
	  switch (pattern) {
	    case 'p':
	      return formatLong.time({
	        width: 'short'
	      });

	    case 'pp':
	      return formatLong.time({
	        width: 'medium'
	      });

	    case 'ppp':
	      return formatLong.time({
	        width: 'long'
	      });

	    case 'pppp':
	    default:
	      return formatLong.time({
	        width: 'full'
	      });
	  }
	}

	function dateTimeLongFormatter(pattern, formatLong) {
	  var matchResult = pattern.match(/(P+)(p+)?/);
	  var datePattern = matchResult[1];
	  var timePattern = matchResult[2];

	  if (!timePattern) {
	    return dateLongFormatter(pattern, formatLong);
	  }

	  var dateTimeFormat;

	  switch (datePattern) {
	    case 'P':
	      dateTimeFormat = formatLong.dateTime({
	        width: 'short'
	      });
	      break;

	    case 'PP':
	      dateTimeFormat = formatLong.dateTime({
	        width: 'medium'
	      });
	      break;

	    case 'PPP':
	      dateTimeFormat = formatLong.dateTime({
	        width: 'long'
	      });
	      break;

	    case 'PPPP':
	    default:
	      dateTimeFormat = formatLong.dateTime({
	        width: 'full'
	      });
	      break;
	  }

	  return dateTimeFormat.replace('{{date}}', dateLongFormatter(datePattern, formatLong)).replace('{{time}}', timeLongFormatter(timePattern, formatLong));
	}

	var longFormatters = {
	  p: timeLongFormatter,
	  P: dateTimeLongFormatter
	};

	var protectedDayOfYearTokens = ['D', 'DD'];
	var protectedWeekYearTokens = ['YY', 'YYYY'];
	function isProtectedDayOfYearToken(token) {
	  return protectedDayOfYearTokens.indexOf(token) !== -1;
	}
	function isProtectedWeekYearToken(token) {
	  return protectedWeekYearTokens.indexOf(token) !== -1;
	}
	function throwProtectedError(token) {
	  if (token === 'YYYY') {
	    throw new RangeError('Use `yyyy` instead of `YYYY` for formatting years; see: https://git.io/fxCyr');
	  } else if (token === 'YY') {
	    throw new RangeError('Use `yy` instead of `YY` for formatting years; see: https://git.io/fxCyr');
	  } else if (token === 'D') {
	    throw new RangeError('Use `d` instead of `D` for formatting days of the month; see: https://git.io/fxCyr');
	  } else if (token === 'DD') {
	    throw new RangeError('Use `dd` instead of `DD` for formatting days of the month; see: https://git.io/fxCyr');
	  }
	}

	// This RegExp consists of three parts separated by `|`:
	// - [yYQqMLwIdDecihHKkms]o matches any available ordinal number token
	//   (one of the certain letters followed by `o`)
	// - (\w)\1* matches any sequences of the same letter
	// - '' matches two quote characters in a row
	// - '(''|[^'])+('|$) matches anything surrounded by two quote characters ('),
	//   except a single quote symbol, which ends the sequence.
	//   Two quote characters do not end the sequence.
	//   If there is no matching single quote
	//   then the sequence will continue until the end of the string.
	// - . matches any single character unmatched by previous parts of the RegExps

	var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g; // This RegExp catches symbols escaped by quotes, and also
	// sequences of symbols P, p, and the combinations like `PPPPPPPppppp`

	var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
	var escapedStringRegExp = /^'([^]*?)'?$/;
	var doubleQuoteRegExp = /''/g;
	var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
	/**
	 * @name format
	 * @category Common Helpers
	 * @summary Format the date.
	 *
	 * @description
	 * Return the formatted date string in the given format. The result may vary by locale.
	 *
	 * > ⚠️ Please note that the `format` tokens differ from Moment.js and other libraries.
	 * > See: https://git.io/fxCyr
	 *
	 * The characters wrapped between two single quotes characters (') are escaped.
	 * Two single quotes in a row, whether inside or outside a quoted sequence, represent a 'real' single quote.
	 * (see the last example)
	 *
	 * Format of the string is based on Unicode Technical Standard #35:
	 * https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
	 * with a few additions (see note 7 below the table).
	 *
	 * Accepted patterns:
	 * | Unit                            | Pattern | Result examples                   | Notes |
	 * |---------------------------------|---------|-----------------------------------|-------|
	 * | Era                             | G..GGG  | AD, BC                            |       |
	 * |                                 | GGGG    | Anno Domini, Before Christ        | 2     |
	 * |                                 | GGGGG   | A, B                              |       |
	 * | Calendar year                   | y       | 44, 1, 1900, 2017                 | 5     |
	 * |                                 | yo      | 44th, 1st, 0th, 17th              | 5,7   |
	 * |                                 | yy      | 44, 01, 00, 17                    | 5     |
	 * |                                 | yyy     | 044, 001, 1900, 2017              | 5     |
	 * |                                 | yyyy    | 0044, 0001, 1900, 2017            | 5     |
	 * |                                 | yyyyy   | ...                               | 3,5   |
	 * | Local week-numbering year       | Y       | 44, 1, 1900, 2017                 | 5     |
	 * |                                 | Yo      | 44th, 1st, 1900th, 2017th         | 5,7   |
	 * |                                 | YY      | 44, 01, 00, 17                    | 5,8   |
	 * |                                 | YYY     | 044, 001, 1900, 2017              | 5     |
	 * |                                 | YYYY    | 0044, 0001, 1900, 2017            | 5,8   |
	 * |                                 | YYYYY   | ...                               | 3,5   |
	 * | ISO week-numbering year         | R       | -43, 0, 1, 1900, 2017             | 5,7   |
	 * |                                 | RR      | -43, 00, 01, 1900, 2017           | 5,7   |
	 * |                                 | RRR     | -043, 000, 001, 1900, 2017        | 5,7   |
	 * |                                 | RRRR    | -0043, 0000, 0001, 1900, 2017     | 5,7   |
	 * |                                 | RRRRR   | ...                               | 3,5,7 |
	 * | Extended year                   | u       | -43, 0, 1, 1900, 2017             | 5     |
	 * |                                 | uu      | -43, 01, 1900, 2017               | 5     |
	 * |                                 | uuu     | -043, 001, 1900, 2017             | 5     |
	 * |                                 | uuuu    | -0043, 0001, 1900, 2017           | 5     |
	 * |                                 | uuuuu   | ...                               | 3,5   |
	 * | Quarter (formatting)            | Q       | 1, 2, 3, 4                        |       |
	 * |                                 | Qo      | 1st, 2nd, 3rd, 4th                | 7     |
	 * |                                 | QQ      | 01, 02, 03, 04                    |       |
	 * |                                 | QQQ     | Q1, Q2, Q3, Q4                    |       |
	 * |                                 | QQQQ    | 1st quarter, 2nd quarter, ...     | 2     |
	 * |                                 | QQQQQ   | 1, 2, 3, 4                        | 4     |
	 * | Quarter (stand-alone)           | q       | 1, 2, 3, 4                        |       |
	 * |                                 | qo      | 1st, 2nd, 3rd, 4th                | 7     |
	 * |                                 | qq      | 01, 02, 03, 04                    |       |
	 * |                                 | qqq     | Q1, Q2, Q3, Q4                    |       |
	 * |                                 | qqqq    | 1st quarter, 2nd quarter, ...     | 2     |
	 * |                                 | qqqqq   | 1, 2, 3, 4                        | 4     |
	 * | Month (formatting)              | M       | 1, 2, ..., 12                     |       |
	 * |                                 | Mo      | 1st, 2nd, ..., 12th               | 7     |
	 * |                                 | MM      | 01, 02, ..., 12                   |       |
	 * |                                 | MMM     | Jan, Feb, ..., Dec                |       |
	 * |                                 | MMMM    | January, February, ..., December  | 2     |
	 * |                                 | MMMMM   | J, F, ..., D                      |       |
	 * | Month (stand-alone)             | L       | 1, 2, ..., 12                     |       |
	 * |                                 | Lo      | 1st, 2nd, ..., 12th               | 7     |
	 * |                                 | LL      | 01, 02, ..., 12                   |       |
	 * |                                 | LLL     | Jan, Feb, ..., Dec                |       |
	 * |                                 | LLLL    | January, February, ..., December  | 2     |
	 * |                                 | LLLLL   | J, F, ..., D                      |       |
	 * | Local week of year              | w       | 1, 2, ..., 53                     |       |
	 * |                                 | wo      | 1st, 2nd, ..., 53th               | 7     |
	 * |                                 | ww      | 01, 02, ..., 53                   |       |
	 * | ISO week of year                | I       | 1, 2, ..., 53                     | 7     |
	 * |                                 | Io      | 1st, 2nd, ..., 53th               | 7     |
	 * |                                 | II      | 01, 02, ..., 53                   | 7     |
	 * | Day of month                    | d       | 1, 2, ..., 31                     |       |
	 * |                                 | do      | 1st, 2nd, ..., 31st               | 7     |
	 * |                                 | dd      | 01, 02, ..., 31                   |       |
	 * | Day of year                     | D       | 1, 2, ..., 365, 366               | 9     |
	 * |                                 | Do      | 1st, 2nd, ..., 365th, 366th       | 7     |
	 * |                                 | DD      | 01, 02, ..., 365, 366             | 9     |
	 * |                                 | DDD     | 001, 002, ..., 365, 366           |       |
	 * |                                 | DDDD    | ...                               | 3     |
	 * | Day of week (formatting)        | E..EEE  | Mon, Tue, Wed, ..., Su            |       |
	 * |                                 | EEEE    | Monday, Tuesday, ..., Sunday      | 2     |
	 * |                                 | EEEEE   | M, T, W, T, F, S, S               |       |
	 * |                                 | EEEEEE  | Mo, Tu, We, Th, Fr, Su, Sa        |       |
	 * | ISO day of week (formatting)    | i       | 1, 2, 3, ..., 7                   | 7     |
	 * |                                 | io      | 1st, 2nd, ..., 7th                | 7     |
	 * |                                 | ii      | 01, 02, ..., 07                   | 7     |
	 * |                                 | iii     | Mon, Tue, Wed, ..., Su            | 7     |
	 * |                                 | iiii    | Monday, Tuesday, ..., Sunday      | 2,7   |
	 * |                                 | iiiii   | M, T, W, T, F, S, S               | 7     |
	 * |                                 | iiiiii  | Mo, Tu, We, Th, Fr, Su, Sa        | 7     |
	 * | Local day of week (formatting)  | e       | 2, 3, 4, ..., 1                   |       |
	 * |                                 | eo      | 2nd, 3rd, ..., 1st                | 7     |
	 * |                                 | ee      | 02, 03, ..., 01                   |       |
	 * |                                 | eee     | Mon, Tue, Wed, ..., Su            |       |
	 * |                                 | eeee    | Monday, Tuesday, ..., Sunday      | 2     |
	 * |                                 | eeeee   | M, T, W, T, F, S, S               |       |
	 * |                                 | eeeeee  | Mo, Tu, We, Th, Fr, Su, Sa        |       |
	 * | Local day of week (stand-alone) | c       | 2, 3, 4, ..., 1                   |       |
	 * |                                 | co      | 2nd, 3rd, ..., 1st                | 7     |
	 * |                                 | cc      | 02, 03, ..., 01                   |       |
	 * |                                 | ccc     | Mon, Tue, Wed, ..., Su            |       |
	 * |                                 | cccc    | Monday, Tuesday, ..., Sunday      | 2     |
	 * |                                 | ccccc   | M, T, W, T, F, S, S               |       |
	 * |                                 | cccccc  | Mo, Tu, We, Th, Fr, Su, Sa        |       |
	 * | AM, PM                          | a..aaa  | AM, PM                            |       |
	 * |                                 | aaaa    | a.m., p.m.                        | 2     |
	 * |                                 | aaaaa   | a, p                              |       |
	 * | AM, PM, noon, midnight          | b..bbb  | AM, PM, noon, midnight            |       |
	 * |                                 | bbbb    | a.m., p.m., noon, midnight        | 2     |
	 * |                                 | bbbbb   | a, p, n, mi                       |       |
	 * | Flexible day period             | B..BBB  | at night, in the morning, ...     |       |
	 * |                                 | BBBB    | at night, in the morning, ...     | 2     |
	 * |                                 | BBBBB   | at night, in the morning, ...     |       |
	 * | Hour [1-12]                     | h       | 1, 2, ..., 11, 12                 |       |
	 * |                                 | ho      | 1st, 2nd, ..., 11th, 12th         | 7     |
	 * |                                 | hh      | 01, 02, ..., 11, 12               |       |
	 * | Hour [0-23]                     | H       | 0, 1, 2, ..., 23                  |       |
	 * |                                 | Ho      | 0th, 1st, 2nd, ..., 23rd          | 7     |
	 * |                                 | HH      | 00, 01, 02, ..., 23               |       |
	 * | Hour [0-11]                     | K       | 1, 2, ..., 11, 0                  |       |
	 * |                                 | Ko      | 1st, 2nd, ..., 11th, 0th          | 7     |
	 * |                                 | KK      | 1, 2, ..., 11, 0                  |       |
	 * | Hour [1-24]                     | k       | 24, 1, 2, ..., 23                 |       |
	 * |                                 | ko      | 24th, 1st, 2nd, ..., 23rd         | 7     |
	 * |                                 | kk      | 24, 01, 02, ..., 23               |       |
	 * | Minute                          | m       | 0, 1, ..., 59                     |       |
	 * |                                 | mo      | 0th, 1st, ..., 59th               | 7     |
	 * |                                 | mm      | 00, 01, ..., 59                   |       |
	 * | Second                          | s       | 0, 1, ..., 59                     |       |
	 * |                                 | so      | 0th, 1st, ..., 59th               | 7     |
	 * |                                 | ss      | 00, 01, ..., 59                   |       |
	 * | Fraction of second              | S       | 0, 1, ..., 9                      |       |
	 * |                                 | SS      | 00, 01, ..., 99                   |       |
	 * |                                 | SSS     | 000, 0001, ..., 999               |       |
	 * |                                 | SSSS    | ...                               | 3     |
	 * | Timezone (ISO-8601 w/ Z)        | X       | -08, +0530, Z                     |       |
	 * |                                 | XX      | -0800, +0530, Z                   |       |
	 * |                                 | XXX     | -08:00, +05:30, Z                 |       |
	 * |                                 | XXXX    | -0800, +0530, Z, +123456          | 2     |
	 * |                                 | XXXXX   | -08:00, +05:30, Z, +12:34:56      |       |
	 * | Timezone (ISO-8601 w/o Z)       | x       | -08, +0530, +00                   |       |
	 * |                                 | xx      | -0800, +0530, +0000               |       |
	 * |                                 | xxx     | -08:00, +05:30, +00:00            | 2     |
	 * |                                 | xxxx    | -0800, +0530, +0000, +123456      |       |
	 * |                                 | xxxxx   | -08:00, +05:30, +00:00, +12:34:56 |       |
	 * | Timezone (GMT)                  | O...OOO | GMT-8, GMT+5:30, GMT+0            |       |
	 * |                                 | OOOO    | GMT-08:00, GMT+05:30, GMT+00:00   | 2     |
	 * | Timezone (specific non-locat.)  | z...zzz | GMT-8, GMT+5:30, GMT+0            | 6     |
	 * |                                 | zzzz    | GMT-08:00, GMT+05:30, GMT+00:00   | 2,6   |
	 * | Seconds timestamp               | t       | 512969520                         | 7     |
	 * |                                 | tt      | ...                               | 3,7   |
	 * | Milliseconds timestamp          | T       | 512969520900                      | 7     |
	 * |                                 | TT      | ...                               | 3,7   |
	 * | Long localized date             | P       | 05/29/1453                        | 7     |
	 * |                                 | PP      | May 29, 1453                      | 7     |
	 * |                                 | PPP     | May 29th, 1453                    | 7     |
	 * |                                 | PPPP    | Sunday, May 29th, 1453            | 2,7   |
	 * | Long localized time             | p       | 12:00 AM                          | 7     |
	 * |                                 | pp      | 12:00:00 AM                       | 7     |
	 * |                                 | ppp     | 12:00:00 AM GMT+2                 | 7     |
	 * |                                 | pppp    | 12:00:00 AM GMT+02:00             | 2,7   |
	 * | Combination of date and time    | Pp      | 05/29/1453, 12:00 AM              | 7     |
	 * |                                 | PPpp    | May 29, 1453, 12:00:00 AM         | 7     |
	 * |                                 | PPPppp  | May 29th, 1453 at ...             | 7     |
	 * |                                 | PPPPpppp| Sunday, May 29th, 1453 at ...     | 2,7   |
	 * Notes:
	 * 1. "Formatting" units (e.g. formatting quarter) in the default en-US locale
	 *    are the same as "stand-alone" units, but are different in some languages.
	 *    "Formatting" units are declined according to the rules of the language
	 *    in the context of a date. "Stand-alone" units are always nominative singular:
	 *
	 *    `format(new Date(2017, 10, 6), 'do LLLL', {locale: cs}) //=> '6. listopad'`
	 *
	 *    `format(new Date(2017, 10, 6), 'do MMMM', {locale: cs}) //=> '6. listopadu'`
	 *
	 * 2. Any sequence of the identical letters is a pattern, unless it is escaped by
	 *    the single quote characters (see below).
	 *    If the sequence is longer than listed in table (e.g. `EEEEEEEEEEE`)
	 *    the output will be the same as default pattern for this unit, usually
	 *    the longest one (in case of ISO weekdays, `EEEE`). Default patterns for units
	 *    are marked with "2" in the last column of the table.
	 *
	 *    `format(new Date(2017, 10, 6), 'MMM') //=> 'Nov'`
	 *
	 *    `format(new Date(2017, 10, 6), 'MMMM') //=> 'November'`
	 *
	 *    `format(new Date(2017, 10, 6), 'MMMMM') //=> 'N'`
	 *
	 *    `format(new Date(2017, 10, 6), 'MMMMMM') //=> 'November'`
	 *
	 *    `format(new Date(2017, 10, 6), 'MMMMMMM') //=> 'November'`
	 *
	 * 3. Some patterns could be unlimited length (such as `yyyyyyyy`).
	 *    The output will be padded with zeros to match the length of the pattern.
	 *
	 *    `format(new Date(2017, 10, 6), 'yyyyyyyy') //=> '00002017'`
	 *
	 * 4. `QQQQQ` and `qqqqq` could be not strictly numerical in some locales.
	 *    These tokens represent the shortest form of the quarter.
	 *
	 * 5. The main difference between `y` and `u` patterns are B.C. years:
	 *
	 *    | Year | `y` | `u` |
	 *    |------|-----|-----|
	 *    | AC 1 |   1 |   1 |
	 *    | BC 1 |   1 |   0 |
	 *    | BC 2 |   2 |  -1 |
	 *
	 *    Also `yy` always returns the last two digits of a year,
	 *    while `uu` pads single digit years to 2 characters and returns other years unchanged:
	 *
	 *    | Year | `yy` | `uu` |
	 *    |------|------|------|
	 *    | 1    |   01 |   01 |
	 *    | 14   |   14 |   14 |
	 *    | 376  |   76 |  376 |
	 *    | 1453 |   53 | 1453 |
	 *
	 *    The same difference is true for local and ISO week-numbering years (`Y` and `R`),
	 *    except local week-numbering years are dependent on `options.weekStartsOn`
	 *    and `options.firstWeekContainsDate` (compare [getISOWeekYear]{@link https://date-fns.org/docs/getISOWeekYear}
	 *    and [getWeekYear]{@link https://date-fns.org/docs/getWeekYear}).
	 *
	 * 6. Specific non-location timezones are currently unavailable in `date-fns`,
	 *    so right now these tokens fall back to GMT timezones.
	 *
	 * 7. These patterns are not in the Unicode Technical Standard #35:
	 *    - `i`: ISO day of week
	 *    - `I`: ISO week of year
	 *    - `R`: ISO week-numbering year
	 *    - `t`: seconds timestamp
	 *    - `T`: milliseconds timestamp
	 *    - `o`: ordinal number modifier
	 *    - `P`: long localized date
	 *    - `p`: long localized time
	 *
	 * 8. `YY` and `YYYY` tokens represent week-numbering years but they are often confused with years.
	 *    You should enable `options.useAdditionalWeekYearTokens` to use them. See: https://git.io/fxCyr
	 *
	 * 9. `D` and `DD` tokens represent days of the year but they are ofthen confused with days of the month.
	 *    You should enable `options.useAdditionalDayOfYearTokens` to use them. See: https://git.io/fxCyr
	 *
	 * ### v2.0.0 breaking changes:
	 *
	 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
	 *
	 * - The second argument is now required for the sake of explicitness.
	 *
	 *   ```javascript
	 *   // Before v2.0.0
	 *   format(new Date(2016, 0, 1))
	 *
	 *   // v2.0.0 onward
	 *   format(new Date(2016, 0, 1), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
	 *   ```
	 *
	 * - New format string API for `format` function
	 *   which is based on [Unicode Technical Standard #35](https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table).
	 *   See [this post](https://blog.date-fns.org/post/unicode-tokens-in-date-fns-v2-sreatyki91jg) for more details.
	 *
	 * - Characters are now escaped using single quote symbols (`'`) instead of square brackets.
	 *
	 * @param {Date|Number} date - the original date
	 * @param {String} format - the string of tokens
	 * @param {Object} [options] - an object with options.
	 * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
	 * @param {0|1|2|3|4|5|6} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
	 * @param {Number} [options.firstWeekContainsDate=1] - the day of January, which is
	 * @param {Boolean} [options.useAdditionalWeekYearTokens=false] - if true, allows usage of the week-numbering year tokens `YY` and `YYYY`;
	 *   see: https://git.io/fxCyr
	 * @param {Boolean} [options.useAdditionalDayOfYearTokens=false] - if true, allows usage of the day of year tokens `D` and `DD`;
	 *   see: https://git.io/fxCyr
	 * @returns {String} the formatted date string
	 * @throws {TypeError} 2 arguments required
	 * @throws {RangeError} `options.locale` must contain `localize` property
	 * @throws {RangeError} `options.locale` must contain `formatLong` property
	 * @throws {RangeError} `options.weekStartsOn` must be between 0 and 6
	 * @throws {RangeError} `options.firstWeekContainsDate` must be between 1 and 7
	 * @throws {RangeError} use `yyyy` instead of `YYYY` for formatting years; see: https://git.io/fxCyr
	 * @throws {RangeError} use `yy` instead of `YY` for formatting years; see: https://git.io/fxCyr
	 * @throws {RangeError} use `d` instead of `D` for formatting days of the month; see: https://git.io/fxCyr
	 * @throws {RangeError} use `dd` instead of `DD` for formatting days of the month; see: https://git.io/fxCyr
	 * @throws {RangeError} format string contains an unescaped latin alphabet character
	 *
	 * @example
	 * // Represent 11 February 2014 in middle-endian format:
	 * var result = format(new Date(2014, 1, 11), 'MM/dd/yyyy')
	 * //=> '02/11/2014'
	 *
	 * @example
	 * // Represent 2 July 2014 in Esperanto:
	 * import { eoLocale } from 'date-fns/locale/eo'
	 * var result = format(new Date(2014, 6, 2), "do 'de' MMMM yyyy", {
	 *   locale: eoLocale
	 * })
	 * //=> '2-a de julio 2014'
	 *
	 * @example
	 * // Escape string by single quote characters:
	 * var result = format(new Date(2014, 6, 2, 15), "h 'o''clock'")
	 * //=> "3 o'clock"
	 */

	function format(dirtyDate, dirtyFormatStr, dirtyOptions) {
	  if (arguments.length < 2) {
	    throw new TypeError('2 arguments required, but only ' + arguments.length + ' present');
	  }

	  var formatStr = String(dirtyFormatStr);
	  var options = dirtyOptions || {};
	  var locale$$ = options.locale || locale;
	  var localeFirstWeekContainsDate = locale$$.options && locale$$.options.firstWeekContainsDate;
	  var defaultFirstWeekContainsDate = localeFirstWeekContainsDate == null ? 1 : toInteger(localeFirstWeekContainsDate);
	  var firstWeekContainsDate = options.firstWeekContainsDate == null ? defaultFirstWeekContainsDate : toInteger(options.firstWeekContainsDate); // Test if weekStartsOn is between 1 and 7 _and_ is not NaN

	  if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
	    throw new RangeError('firstWeekContainsDate must be between 1 and 7 inclusively');
	  }

	  var localeWeekStartsOn = locale$$.options && locale$$.options.weekStartsOn;
	  var defaultWeekStartsOn = localeWeekStartsOn == null ? 0 : toInteger(localeWeekStartsOn);
	  var weekStartsOn = options.weekStartsOn == null ? defaultWeekStartsOn : toInteger(options.weekStartsOn); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

	  if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
	    throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
	  }

	  if (!locale$$.localize) {
	    throw new RangeError('locale must contain localize property');
	  }

	  if (!locale$$.formatLong) {
	    throw new RangeError('locale must contain formatLong property');
	  }

	  var originalDate = toDate(dirtyDate);

	  if (!isValid(originalDate)) {
	    throw new RangeError('Invalid time value');
	  } // Convert the date in system timezone to the same date in UTC+00:00 timezone.
	  // This ensures that when UTC functions will be implemented, locales will be compatible with them.
	  // See an issue about UTC functions: https://github.com/date-fns/date-fns/issues/376


	  var timezoneOffset = getTimezoneOffsetInMilliseconds(originalDate);
	  var utcDate = subMilliseconds(originalDate, timezoneOffset);
	  var formatterOptions = {
	    firstWeekContainsDate: firstWeekContainsDate,
	    weekStartsOn: weekStartsOn,
	    locale: locale$$,
	    _originalDate: originalDate
	  };
	  var result = formatStr.match(longFormattingTokensRegExp).map(function (substring) {
	    var firstCharacter = substring[0];

	    if (firstCharacter === 'p' || firstCharacter === 'P') {
	      var longFormatter = longFormatters[firstCharacter];
	      return longFormatter(substring, locale$$.formatLong, formatterOptions);
	    }

	    return substring;
	  }).join('').match(formattingTokensRegExp).map(function (substring) {
	    // Replace two single quote characters with one single quote character
	    if (substring === "''") {
	      return "'";
	    }

	    var firstCharacter = substring[0];

	    if (firstCharacter === "'") {
	      return cleanEscapedString(substring);
	    }

	    var formatter = formatters[firstCharacter];

	    if (formatter) {
	      if (!options.useAdditionalWeekYearTokens && isProtectedWeekYearToken(substring)) {
	        throwProtectedError(substring);
	      }

	      if (!options.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(substring)) {
	        throwProtectedError(substring);
	      }

	      return formatter(utcDate, substring, locale$$.localize, formatterOptions);
	    }

	    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
	      throw new RangeError('Format string contains an unescaped latin alphabet character `' + firstCharacter + '`');
	    }

	    return substring;
	  }).join('');
	  return result;
	}

	function cleanEscapedString(input) {
	  return input.match(escapedStringRegExp)[1].replace(doubleQuoteRegExp, "'");
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function setUTCDay(dirtyDate, dirtyDay, dirtyOptions) {
	  if (arguments.length < 2) {
	    throw new TypeError('2 arguments required, but only ' + arguments.length + ' present');
	  }

	  var options = dirtyOptions || {};
	  var locale = options.locale;
	  var localeWeekStartsOn = locale && locale.options && locale.options.weekStartsOn;
	  var defaultWeekStartsOn = localeWeekStartsOn == null ? 0 : toInteger(localeWeekStartsOn);
	  var weekStartsOn = options.weekStartsOn == null ? defaultWeekStartsOn : toInteger(options.weekStartsOn); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

	  if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
	    throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
	  }

	  var date = toDate(dirtyDate);
	  var day = toInteger(dirtyDay);
	  var currentDay = date.getUTCDay();
	  var remainder = day % 7;
	  var dayIndex = (remainder + 7) % 7;
	  var diff = (dayIndex < weekStartsOn ? 7 : 0) + day - currentDay;
	  date.setUTCDate(date.getUTCDate() + diff);
	  return date;
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function setUTCISODay(dirtyDate, dirtyDay) {
	  if (arguments.length < 2) {
	    throw new TypeError('2 arguments required, but only ' + arguments.length + ' present');
	  }

	  var day = toInteger(dirtyDay);

	  if (day % 7 === 0) {
	    day = day - 7;
	  }

	  var weekStartsOn = 1;
	  var date = toDate(dirtyDate);
	  var currentDay = date.getUTCDay();
	  var remainder = day % 7;
	  var dayIndex = (remainder + 7) % 7;
	  var diff = (dayIndex < weekStartsOn ? 7 : 0) + day - currentDay;
	  date.setUTCDate(date.getUTCDate() + diff);
	  return date;
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function setUTCISOWeek(dirtyDate, dirtyISOWeek) {
	  if (arguments.length < 2) {
	    throw new TypeError('2 arguments required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate);
	  var isoWeek = toInteger(dirtyISOWeek);
	  var diff = getUTCISOWeek(date) - isoWeek;
	  date.setUTCDate(date.getUTCDate() - diff * 7);
	  return date;
	}

	// This function will be a part of public API when UTC function will be implemented.
	// See issue: https://github.com/date-fns/date-fns/issues/376

	function setUTCWeek(dirtyDate, dirtyWeek, options) {
	  if (arguments.length < 2) {
	    throw new TypeError('2 arguments required, but only ' + arguments.length + ' present');
	  }

	  var date = toDate(dirtyDate);
	  var week = toInteger(dirtyWeek);
	  var diff = getUTCWeek(date, options) - week;
	  date.setUTCDate(date.getUTCDate() - diff * 7);
	  return date;
	}

	var MILLISECONDS_IN_HOUR$2 = 3600000;
	var MILLISECONDS_IN_MINUTE$3 = 60000;
	var MILLISECONDS_IN_SECOND = 1000;
	var numericPatterns = {
	  month: /^(1[0-2]|0?\d)/,
	  // 0 to 12
	  date: /^(3[0-1]|[0-2]?\d)/,
	  // 0 to 31
	  dayOfYear: /^(36[0-6]|3[0-5]\d|[0-2]?\d?\d)/,
	  // 0 to 366
	  week: /^(5[0-3]|[0-4]?\d)/,
	  // 0 to 53
	  hour23h: /^(2[0-3]|[0-1]?\d)/,
	  // 0 to 23
	  hour24h: /^(2[0-4]|[0-1]?\d)/,
	  // 0 to 24
	  hour11h: /^(1[0-1]|0?\d)/,
	  // 0 to 11
	  hour12h: /^(1[0-2]|0?\d)/,
	  // 0 to 12
	  minute: /^[0-5]?\d/,
	  // 0 to 59
	  second: /^[0-5]?\d/,
	  // 0 to 59
	  singleDigit: /^\d/,
	  // 0 to 9
	  twoDigits: /^\d{1,2}/,
	  // 0 to 99
	  threeDigits: /^\d{1,3}/,
	  // 0 to 999
	  fourDigits: /^\d{1,4}/,
	  // 0 to 9999
	  anyDigitsSigned: /^-?\d+/,
	  singleDigitSigned: /^-?\d/,
	  // 0 to 9, -0 to -9
	  twoDigitsSigned: /^-?\d{1,2}/,
	  // 0 to 99, -0 to -99
	  threeDigitsSigned: /^-?\d{1,3}/,
	  // 0 to 999, -0 to -999
	  fourDigitsSigned: /^-?\d{1,4}/ // 0 to 9999, -0 to -9999

	};
	var timezonePatterns = {
	  basicOptionalMinutes: /^([+-])(\d{2})(\d{2})?|Z/,
	  basic: /^([+-])(\d{2})(\d{2})|Z/,
	  basicOptionalSeconds: /^([+-])(\d{2})(\d{2})((\d{2}))?|Z/,
	  extended: /^([+-])(\d{2}):(\d{2})|Z/,
	  extendedOptionalSeconds: /^([+-])(\d{2}):(\d{2})(:(\d{2}))?|Z/
	};

	function parseNumericPattern(pattern, string, valueCallback) {
	  var matchResult = string.match(pattern);

	  if (!matchResult) {
	    return null;
	  }

	  var value = parseInt(matchResult[0], 10);
	  return {
	    value: valueCallback ? valueCallback(value) : value,
	    rest: string.slice(matchResult[0].length)
	  };
	}

	function parseTimezonePattern(pattern, string) {
	  var matchResult = string.match(pattern);

	  if (!matchResult) {
	    return null;
	  } // Input is 'Z'


	  if (matchResult[0] === 'Z') {
	    return {
	      value: 0,
	      rest: string.slice(1)
	    };
	  }

	  var sign = matchResult[1] === '+' ? 1 : -1;
	  var hours = matchResult[2] ? parseInt(matchResult[2], 10) : 0;
	  var minutes = matchResult[3] ? parseInt(matchResult[3], 10) : 0;
	  var seconds = matchResult[5] ? parseInt(matchResult[5], 10) : 0;
	  return {
	    value: sign * (hours * MILLISECONDS_IN_HOUR$2 + minutes * MILLISECONDS_IN_MINUTE$3 + seconds * MILLISECONDS_IN_SECOND),
	    rest: string.slice(matchResult[0].length)
	  };
	}

	function parseAnyDigitsSigned(string, valueCallback) {
	  return parseNumericPattern(numericPatterns.anyDigitsSigned, string, valueCallback);
	}

	function parseNDigits(n, string, valueCallback) {
	  switch (n) {
	    case 1:
	      return parseNumericPattern(numericPatterns.singleDigit, string, valueCallback);

	    case 2:
	      return parseNumericPattern(numericPatterns.twoDigits, string, valueCallback);

	    case 3:
	      return parseNumericPattern(numericPatterns.threeDigits, string, valueCallback);

	    case 4:
	      return parseNumericPattern(numericPatterns.fourDigits, string, valueCallback);

	    default:
	      return parseNumericPattern(new RegExp('^\\d{1,' + n + '}'), string, valueCallback);
	  }
	}

	function parseNDigitsSigned(n, string, valueCallback) {
	  switch (n) {
	    case 1:
	      return parseNumericPattern(numericPatterns.singleDigitSigned, string, valueCallback);

	    case 2:
	      return parseNumericPattern(numericPatterns.twoDigitsSigned, string, valueCallback);

	    case 3:
	      return parseNumericPattern(numericPatterns.threeDigitsSigned, string, valueCallback);

	    case 4:
	      return parseNumericPattern(numericPatterns.fourDigitsSigned, string, valueCallback);

	    default:
	      return parseNumericPattern(new RegExp('^-?\\d{1,' + n + '}'), string, valueCallback);
	  }
	}

	function dayPeriodEnumToHours(enumValue) {
	  switch (enumValue) {
	    case 'morning':
	      return 4;

	    case 'evening':
	      return 17;

	    case 'pm':
	    case 'noon':
	    case 'afternoon':
	      return 12;

	    case 'am':
	    case 'midnight':
	    case 'night':
	    default:
	      return 0;
	  }
	}

	function normalizeTwoDigitYear(twoDigitYear, currentYear) {
	  var isCommonEra = currentYear > 0; // Absolute number of the current year:
	  // 1 -> 1 AC
	  // 0 -> 1 BC
	  // -1 -> 2 BC

	  var absCurrentYear = isCommonEra ? currentYear : 1 - currentYear;
	  var result;

	  if (absCurrentYear <= 50) {
	    result = twoDigitYear || 100;
	  } else {
	    var rangeEnd = absCurrentYear + 50;
	    var rangeEndCentury = Math.floor(rangeEnd / 100) * 100;
	    var isPreviousCentury = twoDigitYear >= rangeEnd % 100;
	    result = twoDigitYear + rangeEndCentury - (isPreviousCentury ? 100 : 0);
	  }

	  return isCommonEra ? result : 1 - result;
	}

	var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	var DAYS_IN_MONTH_LEAP_YEAR = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // User for validation

	function isLeapYearIndex(year) {
	  return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
	}
	/*
	 * |     | Unit                           |     | Unit                           |
	 * |-----|--------------------------------|-----|--------------------------------|
	 * |  a  | AM, PM                         |  A* | Milliseconds in day            |
	 * |  b  | AM, PM, noon, midnight         |  B  | Flexible day period            |
	 * |  c  | Stand-alone local day of week  |  C* | Localized hour w/ day period   |
	 * |  d  | Day of month                   |  D  | Day of year                    |
	 * |  e  | Local day of week              |  E  | Day of week                    |
	 * |  f  |                                |  F* | Day of week in month           |
	 * |  g* | Modified Julian day            |  G  | Era                            |
	 * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
	 * |  i! | ISO day of week                |  I! | ISO week of year               |
	 * |  j* | Localized hour w/ day period   |  J* | Localized hour w/o day period  |
	 * |  k  | Hour [1-24]                    |  K  | Hour [0-11]                    |
	 * |  l* | (deprecated)                   |  L  | Stand-alone month              |
	 * |  m  | Minute                         |  M  | Month                          |
	 * |  n  |                                |  N  |                                |
	 * |  o! | Ordinal number modifier        |  O* | Timezone (GMT)                 |
	 * |  p  |                                |  P  |                                |
	 * |  q  | Stand-alone quarter            |  Q  | Quarter                        |
	 * |  r* | Related Gregorian year         |  R! | ISO week-numbering year        |
	 * |  s  | Second                         |  S  | Fraction of second             |
	 * |  t! | Seconds timestamp              |  T! | Milliseconds timestamp         |
	 * |  u  | Extended year                  |  U* | Cyclic year                    |
	 * |  v* | Timezone (generic non-locat.)  |  V* | Timezone (location)            |
	 * |  w  | Local week of year             |  W* | Week of month                  |
	 * |  x  | Timezone (ISO-8601 w/o Z)      |  X  | Timezone (ISO-8601)            |
	 * |  y  | Year (abs)                     |  Y  | Local week-numbering year      |
	 * |  z* | Timezone (specific non-locat.) |  Z* | Timezone (aliases)             |
	 *
	 * Letters marked by * are not implemented but reserved by Unicode standard.
	 *
	 * Letters marked by ! are non-standard, but implemented by date-fns:
	 * - `o` modifies the previous token to turn it into an ordinal (see `parse` docs)
	 * - `i` is ISO day of week. For `i` and `ii` is returns numeric ISO week days,
	 *   i.e. 7 for Sunday, 1 for Monday, etc.
	 * - `I` is ISO week of year, as opposed to `w` which is local week of year.
	 * - `R` is ISO week-numbering year, as opposed to `Y` which is local week-numbering year.
	 *   `R` is supposed to be used in conjunction with `I` and `i`
	 *   for universal ISO week-numbering date, whereas
	 *   `Y` is supposed to be used in conjunction with `w` and `e`
	 *   for week-numbering date specific to the locale.
	 */


	var parsers = {
	  // Era
	  G: {
	    priority: 140,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        // AD, BC
	        case 'G':
	        case 'GG':
	        case 'GGG':
	          return match.era(string, {
	            width: 'abbreviated'
	          }) || match.era(string, {
	            width: 'narrow'
	          });
	        // A, B

	        case 'GGGGG':
	          return match.era(string, {
	            width: 'narrow'
	          });
	        // Anno Domini, Before Christ

	        case 'GGGG':
	        default:
	          return match.era(string, {
	            width: 'wide'
	          }) || match.era(string, {
	            width: 'abbreviated'
	          }) || match.era(string, {
	            width: 'narrow'
	          });
	      }
	    },
	    set: function (date, flags, value, _options) {
	      flags.era = value;
	      date.setUTCFullYear(value, 0, 1);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['R', 'u', 't', 'T']
	  },
	  // Year
	  y: {
	    // From http://www.unicode.org/reports/tr35/tr35-31/tr35-dates.html#Date_Format_Patterns
	    // | Year     |     y | yy |   yyy |  yyyy | yyyyy |
	    // |----------|-------|----|-------|-------|-------|
	    // | AD 1     |     1 | 01 |   001 |  0001 | 00001 |
	    // | AD 12    |    12 | 12 |   012 |  0012 | 00012 |
	    // | AD 123   |   123 | 23 |   123 |  0123 | 00123 |
	    // | AD 1234  |  1234 | 34 |  1234 |  1234 | 01234 |
	    // | AD 12345 | 12345 | 45 | 12345 | 12345 | 12345 |
	    priority: 130,
	    parse: function (string, token, match, _options) {
	      var valueCallback = function (year) {
	        return {
	          year: year,
	          isTwoDigitYear: token === 'yy'
	        };
	      };

	      switch (token) {
	        case 'y':
	          return parseNDigits(4, string, valueCallback);

	        case 'yo':
	          return match.ordinalNumber(string, {
	            unit: 'year',
	            valueCallback: valueCallback
	          });

	        default:
	          return parseNDigits(token.length, string, valueCallback);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value.isTwoDigitYear || value.year > 0;
	    },
	    set: function (date, flags, value, _options) {
	      var currentYear = date.getUTCFullYear();

	      if (value.isTwoDigitYear) {
	        var normalizedTwoDigitYear = normalizeTwoDigitYear(value.year, currentYear);
	        date.setUTCFullYear(normalizedTwoDigitYear, 0, 1);
	        date.setUTCHours(0, 0, 0, 0);
	        return date;
	      }

	      var year = !('era' in flags) || flags.era === 1 ? value.year : 1 - value.year;
	      date.setUTCFullYear(year, 0, 1);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['Y', 'R', 'u', 'w', 'I', 'i', 'e', 'c', 't', 'T']
	  },
	  // Local week-numbering year
	  Y: {
	    priority: 130,
	    parse: function (string, token, match, _options) {
	      var valueCallback = function (year) {
	        return {
	          year: year,
	          isTwoDigitYear: token === 'YY'
	        };
	      };

	      switch (token) {
	        case 'Y':
	          return parseNDigits(4, string, valueCallback);

	        case 'Yo':
	          return match.ordinalNumber(string, {
	            unit: 'year',
	            valueCallback: valueCallback
	          });

	        default:
	          return parseNDigits(token.length, string, valueCallback);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value.isTwoDigitYear || value.year > 0;
	    },
	    set: function (date, flags, value, options) {
	      var currentYear = getUTCWeekYear(date, options);

	      if (value.isTwoDigitYear) {
	        var normalizedTwoDigitYear = normalizeTwoDigitYear(value.year, currentYear);
	        date.setUTCFullYear(normalizedTwoDigitYear, 0, options.firstWeekContainsDate);
	        date.setUTCHours(0, 0, 0, 0);
	        return startOfUTCWeek(date, options);
	      }

	      var year = !('era' in flags) || flags.era === 1 ? value.year : 1 - value.year;
	      date.setUTCFullYear(year, 0, options.firstWeekContainsDate);
	      date.setUTCHours(0, 0, 0, 0);
	      return startOfUTCWeek(date, options);
	    },
	    incompatibleTokens: ['y', 'R', 'u', 'Q', 'q', 'M', 'L', 'I', 'd', 'D', 'i', 't', 'T']
	  },
	  // ISO week-numbering year
	  R: {
	    priority: 130,
	    parse: function (string, token, _match, _options) {
	      if (token === 'R') {
	        return parseNDigitsSigned(4, string);
	      }

	      return parseNDigitsSigned(token.length, string);
	    },
	    set: function (_date, _flags, value, _options) {
	      var firstWeekOfYear = new Date(0);
	      firstWeekOfYear.setUTCFullYear(value, 0, 4);
	      firstWeekOfYear.setUTCHours(0, 0, 0, 0);
	      return startOfUTCISOWeek(firstWeekOfYear);
	    },
	    incompatibleTokens: ['G', 'y', 'Y', 'u', 'Q', 'q', 'M', 'L', 'w', 'd', 'D', 'e', 'c', 't', 'T']
	  },
	  // Extended year
	  u: {
	    priority: 130,
	    parse: function (string, token, _match, _options) {
	      if (token === 'u') {
	        return parseNDigitsSigned(4, string);
	      }

	      return parseNDigitsSigned(token.length, string);
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCFullYear(value, 0, 1);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['G', 'y', 'Y', 'R', 'w', 'I', 'i', 'e', 'c', 't', 'T']
	  },
	  // Quarter
	  Q: {
	    priority: 120,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        // 1, 2, 3, 4
	        case 'Q':
	        case 'QQ':
	          // 01, 02, 03, 04
	          return parseNDigits(token.length, string);
	        // 1st, 2nd, 3rd, 4th

	        case 'Qo':
	          return match.ordinalNumber(string, {
	            unit: 'quarter'
	          });
	        // Q1, Q2, Q3, Q4

	        case 'QQQ':
	          return match.quarter(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.quarter(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // 1, 2, 3, 4 (narrow quarter; could be not numerical)

	        case 'QQQQQ':
	          return match.quarter(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // 1st quarter, 2nd quarter, ...

	        case 'QQQQ':
	        default:
	          return match.quarter(string, {
	            width: 'wide',
	            context: 'formatting'
	          }) || match.quarter(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.quarter(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 1 && value <= 4;
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCMonth((value - 1) * 3, 1);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['Y', 'R', 'q', 'M', 'L', 'w', 'I', 'd', 'D', 'i', 'e', 'c', 't', 'T']
	  },
	  // Stand-alone quarter
	  q: {
	    priority: 120,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        // 1, 2, 3, 4
	        case 'q':
	        case 'qq':
	          // 01, 02, 03, 04
	          return parseNDigits(token.length, string);
	        // 1st, 2nd, 3rd, 4th

	        case 'qo':
	          return match.ordinalNumber(string, {
	            unit: 'quarter'
	          });
	        // Q1, Q2, Q3, Q4

	        case 'qqq':
	          return match.quarter(string, {
	            width: 'abbreviated',
	            context: 'standalone'
	          }) || match.quarter(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	        // 1, 2, 3, 4 (narrow quarter; could be not numerical)

	        case 'qqqqq':
	          return match.quarter(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	        // 1st quarter, 2nd quarter, ...

	        case 'qqqq':
	        default:
	          return match.quarter(string, {
	            width: 'wide',
	            context: 'standalone'
	          }) || match.quarter(string, {
	            width: 'abbreviated',
	            context: 'standalone'
	          }) || match.quarter(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 1 && value <= 4;
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCMonth((value - 1) * 3, 1);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['Y', 'R', 'Q', 'M', 'L', 'w', 'I', 'd', 'D', 'i', 'e', 'c', 't', 'T']
	  },
	  // Month
	  M: {
	    priority: 110,
	    parse: function (string, token, match, _options) {
	      var valueCallback = function (value) {
	        return value - 1;
	      };

	      switch (token) {
	        // 1, 2, ..., 12
	        case 'M':
	          return parseNumericPattern(numericPatterns.month, string, valueCallback);
	        // 01, 02, ..., 12

	        case 'MM':
	          return parseNDigits(2, string, valueCallback);
	        // 1st, 2nd, ..., 12th

	        case 'Mo':
	          return match.ordinalNumber(string, {
	            unit: 'month',
	            valueCallback: valueCallback
	          });
	        // Jan, Feb, ..., Dec

	        case 'MMM':
	          return match.month(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.month(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // J, F, ..., D

	        case 'MMMMM':
	          return match.month(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // January, February, ..., December

	        case 'MMMM':
	        default:
	          return match.month(string, {
	            width: 'wide',
	            context: 'formatting'
	          }) || match.month(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.month(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 11;
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCMonth(value, 1);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['Y', 'R', 'q', 'Q', 'L', 'w', 'I', 'D', 'i', 'e', 'c', 't', 'T']
	  },
	  // Stand-alone month
	  L: {
	    priority: 110,
	    parse: function (string, token, match, _options) {
	      var valueCallback = function (value) {
	        return value - 1;
	      };

	      switch (token) {
	        // 1, 2, ..., 12
	        case 'L':
	          return parseNumericPattern(numericPatterns.month, string, valueCallback);
	        // 01, 02, ..., 12

	        case 'LL':
	          return parseNDigits(2, string, valueCallback);
	        // 1st, 2nd, ..., 12th

	        case 'Lo':
	          return match.ordinalNumber(string, {
	            unit: 'month',
	            valueCallback: valueCallback
	          });
	        // Jan, Feb, ..., Dec

	        case 'LLL':
	          return match.month(string, {
	            width: 'abbreviated',
	            context: 'standalone'
	          }) || match.month(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	        // J, F, ..., D

	        case 'LLLLL':
	          return match.month(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	        // January, February, ..., December

	        case 'LLLL':
	        default:
	          return match.month(string, {
	            width: 'wide',
	            context: 'standalone'
	          }) || match.month(string, {
	            width: 'abbreviated',
	            context: 'standalone'
	          }) || match.month(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 11;
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCMonth(value, 1);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['Y', 'R', 'q', 'Q', 'M', 'w', 'I', 'D', 'i', 'e', 'c', 't', 'T']
	  },
	  // Local week of year
	  w: {
	    priority: 100,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'w':
	          return parseNumericPattern(numericPatterns.week, string);

	        case 'wo':
	          return match.ordinalNumber(string, {
	            unit: 'week'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 1 && value <= 53;
	    },
	    set: function (date, _flags, value, options) {
	      return startOfUTCWeek(setUTCWeek(date, value, options), options);
	    },
	    incompatibleTokens: ['y', 'R', 'u', 'q', 'Q', 'M', 'L', 'I', 'd', 'D', 'i', 't', 'T']
	  },
	  // ISO week of year
	  I: {
	    priority: 100,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'I':
	          return parseNumericPattern(numericPatterns.week, string);

	        case 'Io':
	          return match.ordinalNumber(string, {
	            unit: 'week'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 1 && value <= 53;
	    },
	    set: function (date, _flags, value, options) {
	      return startOfUTCISOWeek(setUTCISOWeek(date, value, options), options);
	    },
	    incompatibleTokens: ['y', 'Y', 'u', 'q', 'Q', 'M', 'L', 'w', 'd', 'D', 'e', 'c', 't', 'T']
	  },
	  // Day of the month
	  d: {
	    priority: 90,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'd':
	          return parseNumericPattern(numericPatterns.date, string);

	        case 'do':
	          return match.ordinalNumber(string, {
	            unit: 'date'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (date, value, _options) {
	      var year = date.getUTCFullYear();
	      var isLeapYear = isLeapYearIndex(year);
	      var month = date.getUTCMonth();

	      if (isLeapYear) {
	        return value >= 1 && value <= DAYS_IN_MONTH_LEAP_YEAR[month];
	      } else {
	        return value >= 1 && value <= DAYS_IN_MONTH[month];
	      }
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCDate(value);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['Y', 'R', 'q', 'Q', 'w', 'I', 'D', 'i', 'e', 'c', 't', 'T']
	  },
	  // Day of year
	  D: {
	    priority: 90,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'D':
	        case 'DD':
	          return parseNumericPattern(numericPatterns.dayOfYear, string);

	        case 'Do':
	          return match.ordinalNumber(string, {
	            unit: 'date'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (date, value, _options) {
	      var year = date.getUTCFullYear();
	      var isLeapYear = isLeapYearIndex(year);

	      if (isLeapYear) {
	        return value >= 1 && value <= 366;
	      } else {
	        return value >= 1 && value <= 365;
	      }
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCMonth(0, value);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['Y', 'R', 'q', 'Q', 'M', 'L', 'w', 'I', 'd', 'E', 'i', 'e', 'c', 't', 'T']
	  },
	  // Day of week
	  E: {
	    priority: 90,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        // Tue
	        case 'E':
	        case 'EE':
	        case 'EEE':
	          return match.day(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'short',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // T

	        case 'EEEEE':
	          return match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // Tu

	        case 'EEEEEE':
	          return match.day(string, {
	            width: 'short',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // Tuesday

	        case 'EEEE':
	        default:
	          return match.day(string, {
	            width: 'wide',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'short',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 6;
	    },
	    set: function (date, _flags, value, options) {
	      date = setUTCDay(date, value, options);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['D', 'i', 'e', 'c', 't', 'T']
	  },
	  // Local day of week
	  e: {
	    priority: 90,
	    parse: function (string, token, match, options) {
	      var valueCallback = function (value) {
	        var wholeWeekDays = Math.floor((value - 1) / 7) * 7;
	        return (value + options.weekStartsOn + 6) % 7 + wholeWeekDays;
	      };

	      switch (token) {
	        // 3
	        case 'e':
	        case 'ee':
	          // 03
	          return parseNDigits(token.length, string, valueCallback);
	        // 3rd

	        case 'eo':
	          return match.ordinalNumber(string, {
	            unit: 'day',
	            valueCallback: valueCallback
	          });
	        // Tue

	        case 'eee':
	          return match.day(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'short',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // T

	        case 'eeeee':
	          return match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // Tu

	        case 'eeeeee':
	          return match.day(string, {
	            width: 'short',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	        // Tuesday

	        case 'eeee':
	        default:
	          return match.day(string, {
	            width: 'wide',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'short',
	            context: 'formatting'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 6;
	    },
	    set: function (date, _flags, value, options) {
	      date = setUTCDay(date, value, options);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['y', 'R', 'u', 'q', 'Q', 'M', 'L', 'I', 'd', 'D', 'E', 'i', 'c', 't', 'T']
	  },
	  // Stand-alone local day of week
	  c: {
	    priority: 90,
	    parse: function (string, token, match, options) {
	      var valueCallback = function (value) {
	        var wholeWeekDays = Math.floor((value - 1) / 7) * 7;
	        return (value + options.weekStartsOn + 6) % 7 + wholeWeekDays;
	      };

	      switch (token) {
	        // 3
	        case 'c':
	        case 'cc':
	          // 03
	          return parseNDigits(token.length, string, valueCallback);
	        // 3rd

	        case 'co':
	          return match.ordinalNumber(string, {
	            unit: 'day',
	            valueCallback: valueCallback
	          });
	        // Tue

	        case 'ccc':
	          return match.day(string, {
	            width: 'abbreviated',
	            context: 'standalone'
	          }) || match.day(string, {
	            width: 'short',
	            context: 'standalone'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	        // T

	        case 'ccccc':
	          return match.day(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	        // Tu

	        case 'cccccc':
	          return match.day(string, {
	            width: 'short',
	            context: 'standalone'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	        // Tuesday

	        case 'cccc':
	        default:
	          return match.day(string, {
	            width: 'wide',
	            context: 'standalone'
	          }) || match.day(string, {
	            width: 'abbreviated',
	            context: 'standalone'
	          }) || match.day(string, {
	            width: 'short',
	            context: 'standalone'
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'standalone'
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 6;
	    },
	    set: function (date, _flags, value, options) {
	      date = setUTCDay(date, value, options);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['y', 'R', 'u', 'q', 'Q', 'M', 'L', 'I', 'd', 'D', 'E', 'i', 'e', 't', 'T']
	  },
	  // ISO day of week
	  i: {
	    priority: 90,
	    parse: function (string, token, match, _options) {
	      var valueCallback = function (value) {
	        if (value === 0) {
	          return 7;
	        }

	        return value;
	      };

	      switch (token) {
	        // 2
	        case 'i':
	        case 'ii':
	          // 02
	          return parseNDigits(token.length, string);
	        // 2nd

	        case 'io':
	          return match.ordinalNumber(string, {
	            unit: 'day'
	          });
	        // Tue

	        case 'iii':
	          return match.day(string, {
	            width: 'abbreviated',
	            context: 'formatting',
	            valueCallback: valueCallback
	          }) || match.day(string, {
	            width: 'short',
	            context: 'formatting',
	            valueCallback: valueCallback
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting',
	            valueCallback: valueCallback
	          });
	        // T

	        case 'iiiii':
	          return match.day(string, {
	            width: 'narrow',
	            context: 'formatting',
	            valueCallback: valueCallback
	          });
	        // Tu

	        case 'iiiiii':
	          return match.day(string, {
	            width: 'short',
	            context: 'formatting',
	            valueCallback: valueCallback
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting',
	            valueCallback: valueCallback
	          });
	        // Tuesday

	        case 'iiii':
	        default:
	          return match.day(string, {
	            width: 'wide',
	            context: 'formatting',
	            valueCallback: valueCallback
	          }) || match.day(string, {
	            width: 'abbreviated',
	            context: 'formatting',
	            valueCallback: valueCallback
	          }) || match.day(string, {
	            width: 'short',
	            context: 'formatting',
	            valueCallback: valueCallback
	          }) || match.day(string, {
	            width: 'narrow',
	            context: 'formatting',
	            valueCallback: valueCallback
	          });
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 1 && value <= 7;
	    },
	    set: function (date, _flags, value, options) {
	      date = setUTCISODay(date, value, options);
	      date.setUTCHours(0, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['y', 'Y', 'u', 'q', 'Q', 'M', 'L', 'w', 'd', 'D', 'E', 'e', 'c', 't', 'T']
	  },
	  // AM or PM
	  a: {
	    priority: 80,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'a':
	        case 'aa':
	        case 'aaa':
	          return match.dayPeriod(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });

	        case 'aaaaa':
	          return match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });

	        case 'aaaa':
	        default:
	          return match.dayPeriod(string, {
	            width: 'wide',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	      }
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCHours(dayPeriodEnumToHours(value), 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['b', 'B', 'H', 'K', 'k', 't', 'T']
	  },
	  // AM, PM, midnight
	  b: {
	    priority: 80,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'b':
	        case 'bb':
	        case 'bbb':
	          return match.dayPeriod(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });

	        case 'bbbbb':
	          return match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });

	        case 'bbbb':
	        default:
	          return match.dayPeriod(string, {
	            width: 'wide',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	      }
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCHours(dayPeriodEnumToHours(value), 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['a', 'B', 'H', 'K', 'k', 't', 'T']
	  },
	  // in the morning, in the afternoon, in the evening, at night
	  B: {
	    priority: 80,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'B':
	        case 'BB':
	        case 'BBB':
	          return match.dayPeriod(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });

	        case 'BBBBB':
	          return match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });

	        case 'BBBB':
	        default:
	          return match.dayPeriod(string, {
	            width: 'wide',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'abbreviated',
	            context: 'formatting'
	          }) || match.dayPeriod(string, {
	            width: 'narrow',
	            context: 'formatting'
	          });
	      }
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCHours(dayPeriodEnumToHours(value), 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['a', 'b', 't', 'T']
	  },
	  // Hour [1-12]
	  h: {
	    priority: 70,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'h':
	          return parseNumericPattern(numericPatterns.hour12h, string);

	        case 'ho':
	          return match.ordinalNumber(string, {
	            unit: 'hour'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 1 && value <= 12;
	    },
	    set: function (date, _flags, value, _options) {
	      var isPM = date.getUTCHours() >= 12;

	      if (isPM && value < 12) {
	        date.setUTCHours(value + 12, 0, 0, 0);
	      } else if (!isPM && value === 12) {
	        date.setUTCHours(0, 0, 0, 0);
	      } else {
	        date.setUTCHours(value, 0, 0, 0);
	      }

	      return date;
	    },
	    incompatibleTokens: ['H', 'K', 'k', 't', 'T']
	  },
	  // Hour [0-23]
	  H: {
	    priority: 70,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'H':
	          return parseNumericPattern(numericPatterns.hour23h, string);

	        case 'Ho':
	          return match.ordinalNumber(string, {
	            unit: 'hour'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 23;
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCHours(value, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['a', 'b', 'h', 'K', 'k', 't', 'T']
	  },
	  // Hour [0-11]
	  K: {
	    priority: 70,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'K':
	          return parseNumericPattern(numericPatterns.hour11h, string);

	        case 'Ko':
	          return match.ordinalNumber(string, {
	            unit: 'hour'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 11;
	    },
	    set: function (date, _flags, value, _options) {
	      var isPM = date.getUTCHours() >= 12;

	      if (isPM && value < 12) {
	        date.setUTCHours(value + 12, 0, 0, 0);
	      } else {
	        date.setUTCHours(value, 0, 0, 0);
	      }

	      return date;
	    },
	    incompatibleTokens: ['a', 'b', 'h', 'H', 'k', 't', 'T']
	  },
	  // Hour [1-24]
	  k: {
	    priority: 70,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'k':
	          return parseNumericPattern(numericPatterns.hour24h, string);

	        case 'ko':
	          return match.ordinalNumber(string, {
	            unit: 'hour'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 1 && value <= 24;
	    },
	    set: function (date, _flags, value, _options) {
	      var hours = value <= 24 ? value % 24 : value;
	      date.setUTCHours(hours, 0, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['a', 'b', 'h', 'H', 'K', 't', 'T']
	  },
	  // Minute
	  m: {
	    priority: 60,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 'm':
	          return parseNumericPattern(numericPatterns.minute, string);

	        case 'mo':
	          return match.ordinalNumber(string, {
	            unit: 'minute'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 59;
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCMinutes(value, 0, 0);
	      return date;
	    },
	    incompatibleTokens: ['t', 'T']
	  },
	  // Second
	  s: {
	    priority: 50,
	    parse: function (string, token, match, _options) {
	      switch (token) {
	        case 's':
	          return parseNumericPattern(numericPatterns.second, string);

	        case 'so':
	          return match.ordinalNumber(string, {
	            unit: 'second'
	          });

	        default:
	          return parseNDigits(token.length, string);
	      }
	    },
	    validate: function (_date, value, _options) {
	      return value >= 0 && value <= 59;
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCSeconds(value, 0);
	      return date;
	    },
	    incompatibleTokens: ['t', 'T']
	  },
	  // Fraction of second
	  S: {
	    priority: 30,
	    parse: function (string, token, _match, _options) {
	      var valueCallback = function (value) {
	        return Math.floor(value * Math.pow(10, -token.length + 3));
	      };

	      return parseNDigits(token.length, string, valueCallback);
	    },
	    set: function (date, _flags, value, _options) {
	      date.setUTCMilliseconds(value);
	      return date;
	    },
	    incompatibleTokens: ['t', 'T']
	  },
	  // Timezone (ISO-8601. +00:00 is `'Z'`)
	  X: {
	    priority: 10,
	    parse: function (string, token, _match, _options) {
	      switch (token) {
	        case 'X':
	          return parseTimezonePattern(timezonePatterns.basicOptionalMinutes, string);

	        case 'XX':
	          return parseTimezonePattern(timezonePatterns.basic, string);

	        case 'XXXX':
	          return parseTimezonePattern(timezonePatterns.basicOptionalSeconds, string);

	        case 'XXXXX':
	          return parseTimezonePattern(timezonePatterns.extendedOptionalSeconds, string);

	        case 'XXX':
	        default:
	          return parseTimezonePattern(timezonePatterns.extended, string);
	      }
	    },
	    set: function (date, flags, value, _options) {
	      if (flags.timestampIsSet) {
	        return date;
	      }

	      return new Date(date.getTime() - value);
	    },
	    incompatibleTokens: ['t', 'T', 'x']
	  },
	  // Timezone (ISO-8601)
	  x: {
	    priority: 10,
	    parse: function (string, token, _match, _options) {
	      switch (token) {
	        case 'x':
	          return parseTimezonePattern(timezonePatterns.basicOptionalMinutes, string);

	        case 'xx':
	          return parseTimezonePattern(timezonePatterns.basic, string);

	        case 'xxxx':
	          return parseTimezonePattern(timezonePatterns.basicOptionalSeconds, string);

	        case 'xxxxx':
	          return parseTimezonePattern(timezonePatterns.extendedOptionalSeconds, string);

	        case 'xxx':
	        default:
	          return parseTimezonePattern(timezonePatterns.extended, string);
	      }
	    },
	    set: function (date, flags, value, _options) {
	      if (flags.timestampIsSet) {
	        return date;
	      }

	      return new Date(date.getTime() - value);
	    },
	    incompatibleTokens: ['t', 'T', 'X']
	  },
	  // Seconds timestamp
	  t: {
	    priority: 40,
	    parse: function (string, _token, _match, _options) {
	      return parseAnyDigitsSigned(string);
	    },
	    set: function (_date, _flags, value, _options) {
	      return [new Date(value * 1000), {
	        timestampIsSet: true
	      }];
	    },
	    incompatibleTokens: '*'
	  },
	  // Milliseconds timestamp
	  T: {
	    priority: 20,
	    parse: function (string, _token, _match, _options) {
	      return parseAnyDigitsSigned(string);
	    },
	    set: function (_date, _flags, value, _options) {
	      return [new Date(value), {
	        timestampIsSet: true
	      }];
	    },
	    incompatibleTokens: '*'
	  }
	};

	function transformPhoneNumber(value) {
	  var s2 = (""+value).replace(/\D/g, '');
	  var m = s2.match(/^(\d{3})(\d{3})(\d{4})$/);
	  return (!m) ? null : "(" + m[1] + ") " + m[2] + "-" + m[3];
	}

	function transformDate(value) {
	  // console.log('date value:', value);
	  return format(value, 'MM/dd/yyyy');
	}

	function transformDateTime(value) {
	  // console.log('datetime value:', value);
	  return format(value, 'MM/dd/yyyy hh:mm a');
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
	    // console.log('r:', r, 'm:', m);
	    var val = properties[m[1]];
	    for (var i = 0; i < popupInfo.fieldInfos.length; i++) {
	      if (popupInfo.fieldInfos[i].fieldName === m[1]) {
	        if (popupInfo.fieldInfos[i].format) {
	          if (popupInfo.fieldInfos[i].format.dateFormat === 'shortDate'
	              || popupInfo.fieldInfos[i].format.dateFormat === 'shortDateShortTime'
	          ) {
	            val = transformDate(properties[popupInfo.fieldInfos[i].fieldName])
	          }
	        }
	      }
	    }
	    return val;
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
	            popupInfo.fieldInfos[i].fieldName === 'Permit Link' ||
	            popupInfo.fieldInfos[i].fieldName === 'PermitURL' ||
	            popupInfo.fieldInfos[i].fieldName.toLowerCase().includes('url') ||
	            popupInfo.fieldInfos[i].fieldName.toLowerCase().includes('link') ||
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
	        // handle case
	        } else if (popupInfo.fieldInfos[i].fieldName.includes('time')) {
	            console.log('includes time');
	            content += contentStart
	                    + popupInfo.fieldInfos[i].label
	                    + contentMiddle
	                    + transformDateTime(properties[popupInfo.fieldInfos[i].fieldName])
	                    + '</p>';
	        // if the info is a date
	        } else if (popupInfo.fieldInfos[i].fieldName.includes('DATE')) {
	            console.log('includes date');
	            content += contentStart
	                    + popupInfo.fieldInfos[i].label
	                    + contentMiddle
	                    + transformDate(properties[popupInfo.fieldInfos[i].fieldName])
	                    + '</p>';
	        } else if (popupInfo.fieldInfos[i].format) {
	          if (popupInfo.fieldInfos[i].format.dateFormat === 'shortDate'
	              || popupInfo.fieldInfos[i].format.dateFormat === 'shortDateShortTime'
	          ) {
	            console.log('is shortDate or shortDateShortTime');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9hcmNnaXMtdG8tZ2VvanNvbi11dGlscy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1N5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9sZWFmbGV0LXNoYXBlLW1hcmtlcnMvc3JjL1NoYXBlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvQ3Jvc3NNYXJrZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvbGVhZmxldC1zaGFwZS1tYXJrZXJzL3NyYy9YTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvU3F1YXJlTWFya2VyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2xlYWZsZXQtc2hhcGUtbWFya2Vycy9zcmMvRGlhbW9uZE1hcmtlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvaW50U3ltYm9sLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1N5bWJvbHMvTGluZVN5bWJvbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9TeW1ib2xzL1BvbHlnb25TeW1ib2wuanMiLCIuLi9ub2RlX21vZHVsZXMvZXNyaS1sZWFmbGV0LXJlbmRlcmVycy9zcmMvUmVuZGVyZXJzL1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9VbmlxdWVWYWx1ZVJlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9TaW1wbGVSZW5kZXJlci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9SZW5kZXJlci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9GZWF0dXJlQ29sbGVjdGlvbi5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9DU1ZMYXllci5qcyIsIi4uL3NyYy9GZWF0dXJlQ29sbGVjdGlvbi9LTUxMYXllci5qcyIsIi4uL3NyYy9MYWJlbC9MYWJlbEljb24uanMiLCIuLi9zcmMvTGFiZWwvTGFiZWxNYXJrZXIuanMiLCIuLi9zcmMvTGFiZWwvUG9pbnRMYWJlbC5qcyIsIi4uL3NyYy9MYWJlbC9Qb2x5bGluZUxhYmVsLmpzIiwiLi4vc3JjL0xhYmVsL1BvbHlnb25MYWJlbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vdG9EYXRlL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9fbGliL3RvSW50ZWdlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vYWRkTWlsbGlzZWNvbmRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9fbGliL2dldFRpbWV6b25lT2Zmc2V0SW5NaWxsaXNlY29uZHMvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL2lzVmFsaWQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL2xvY2FsZS9lbi1VUy9fbGliL2Zvcm1hdERpc3RhbmNlL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9sb2NhbGUvX2xpYi9idWlsZEZvcm1hdExvbmdGbi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vbG9jYWxlL2VuLVVTL19saWIvZm9ybWF0TG9uZy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vbG9jYWxlL2VuLVVTL19saWIvZm9ybWF0UmVsYXRpdmUvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL2xvY2FsZS9fbGliL2J1aWxkTG9jYWxpemVGbi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vbG9jYWxlL2VuLVVTL19saWIvbG9jYWxpemUvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL2xvY2FsZS9fbGliL2J1aWxkTWF0Y2hQYXR0ZXJuRm4vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL2xvY2FsZS9fbGliL2J1aWxkTWF0Y2hGbi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vbG9jYWxlL2VuLVVTL19saWIvbWF0Y2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL2xvY2FsZS9lbi1VUy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vc3ViTWlsbGlzZWNvbmRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9fbGliL2FkZExlYWRpbmdaZXJvcy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9mb3JtYXQvbGlnaHRGb3JtYXR0ZXJzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9fbGliL2dldFVUQ0RheU9mWWVhci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9zdGFydE9mVVRDSVNPV2Vlay9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9nZXRVVENJU09XZWVrWWVhci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9zdGFydE9mVVRDSVNPV2Vla1llYXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL19saWIvZ2V0VVRDSVNPV2Vlay9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9zdGFydE9mVVRDV2Vlay9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9nZXRVVENXZWVrWWVhci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9zdGFydE9mVVRDV2Vla1llYXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL19saWIvZ2V0VVRDV2Vlay9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9mb3JtYXQvZm9ybWF0dGVycy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9mb3JtYXQvbG9uZ0Zvcm1hdHRlcnMvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL19saWIvcHJvdGVjdGVkVG9rZW5zL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9mb3JtYXQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL19saWIvc2V0VVRDRGF5L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9fbGliL3NldFVUQ0lTT0RheS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kYXRlLWZucy9lc20vX2xpYi9zZXRVVENJU09XZWVrL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RhdGUtZm5zL2VzbS9fbGliL3NldFVUQ1dlZWsvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZGF0ZS1mbnMvZXNtL3BhcnNlL19saWIvcGFyc2Vycy9pbmRleC5qcyIsIi4uL3NyYy9Qb3B1cC9Qb3B1cC5qcyIsIi4uL3NyYy9PcGVyYXRpb25hbExheWVyLmpzIiwiLi4vc3JjL1dlYk1hcExvYWRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQ29weXJpZ2h0IDIwMTcgRXNyaVxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vLyBjaGVja3MgaWYgMiB4LHkgcG9pbnRzIGFyZSBlcXVhbFxuZnVuY3Rpb24gcG9pbnRzRXF1YWwgKGEsIGIpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIGNoZWNrcyBpZiB0aGUgZmlyc3QgYW5kIGxhc3QgcG9pbnRzIG9mIGEgcmluZyBhcmUgZXF1YWwgYW5kIGNsb3NlcyB0aGUgcmluZ1xuZnVuY3Rpb24gY2xvc2VSaW5nIChjb29yZGluYXRlcykge1xuICBpZiAoIXBvaW50c0VxdWFsKGNvb3JkaW5hdGVzWzBdLCBjb29yZGluYXRlc1tjb29yZGluYXRlcy5sZW5ndGggLSAxXSkpIHtcbiAgICBjb29yZGluYXRlcy5wdXNoKGNvb3JkaW5hdGVzWzBdKTtcbiAgfVxuICByZXR1cm4gY29vcmRpbmF0ZXM7XG59XG5cbi8vIGRldGVybWluZSBpZiBwb2x5Z29uIHJpbmcgY29vcmRpbmF0ZXMgYXJlIGNsb2Nrd2lzZS4gY2xvY2t3aXNlIHNpZ25pZmllcyBvdXRlciByaW5nLCBjb3VudGVyLWNsb2Nrd2lzZSBhbiBpbm5lciByaW5nXG4vLyBvciBob2xlLiB0aGlzIGxvZ2ljIHdhcyBmb3VuZCBhdCBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzExNjU2NDcvaG93LXRvLWRldGVybWluZS1pZi1hLWxpc3Qtb2YtcG9seWdvbi1cbi8vIHBvaW50cy1hcmUtaW4tY2xvY2t3aXNlLW9yZGVyXG5mdW5jdGlvbiByaW5nSXNDbG9ja3dpc2UgKHJpbmdUb1Rlc3QpIHtcbiAgdmFyIHRvdGFsID0gMDtcbiAgdmFyIGkgPSAwO1xuICB2YXIgckxlbmd0aCA9IHJpbmdUb1Rlc3QubGVuZ3RoO1xuICB2YXIgcHQxID0gcmluZ1RvVGVzdFtpXTtcbiAgdmFyIHB0MjtcbiAgZm9yIChpOyBpIDwgckxlbmd0aCAtIDE7IGkrKykge1xuICAgIHB0MiA9IHJpbmdUb1Rlc3RbaSArIDFdO1xuICAgIHRvdGFsICs9IChwdDJbMF0gLSBwdDFbMF0pICogKHB0MlsxXSArIHB0MVsxXSk7XG4gICAgcHQxID0gcHQyO1xuICB9XG4gIHJldHVybiAodG90YWwgPj0gMCk7XG59XG5cbi8vIHBvcnRlZCBmcm9tIHRlcnJhZm9ybWVyLmpzIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL1RlcnJhZm9ybWVyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLmpzI0w1MDQtTDUxOVxuZnVuY3Rpb24gdmVydGV4SW50ZXJzZWN0c1ZlcnRleCAoYTEsIGEyLCBiMSwgYjIpIHtcbiAgdmFyIHVhVCA9ICgoYjJbMF0gLSBiMVswXSkgKiAoYTFbMV0gLSBiMVsxXSkpIC0gKChiMlsxXSAtIGIxWzFdKSAqIChhMVswXSAtIGIxWzBdKSk7XG4gIHZhciB1YlQgPSAoKGEyWzBdIC0gYTFbMF0pICogKGExWzFdIC0gYjFbMV0pKSAtICgoYTJbMV0gLSBhMVsxXSkgKiAoYTFbMF0gLSBiMVswXSkpO1xuICB2YXIgdUIgPSAoKGIyWzFdIC0gYjFbMV0pICogKGEyWzBdIC0gYTFbMF0pKSAtICgoYjJbMF0gLSBiMVswXSkgKiAoYTJbMV0gLSBhMVsxXSkpO1xuXG4gIGlmICh1QiAhPT0gMCkge1xuICAgIHZhciB1YSA9IHVhVCAvIHVCO1xuICAgIHZhciB1YiA9IHViVCAvIHVCO1xuXG4gICAgaWYgKHVhID49IDAgJiYgdWEgPD0gMSAmJiB1YiA+PSAwICYmIHViIDw9IDEpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuLy8gcG9ydGVkIGZyb20gdGVycmFmb3JtZXIuanMgaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvVGVycmFmb3JtZXIvYmxvYi9tYXN0ZXIvdGVycmFmb3JtZXIuanMjTDUyMS1MNTMxXG5mdW5jdGlvbiBhcnJheUludGVyc2VjdHNBcnJheSAoYSwgYikge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBiLmxlbmd0aCAtIDE7IGorKykge1xuICAgICAgaWYgKHZlcnRleEludGVyc2VjdHNWZXJ0ZXgoYVtpXSwgYVtpICsgMV0sIGJbal0sIGJbaiArIDFdKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIHBvcnRlZCBmcm9tIHRlcnJhZm9ybWVyLmpzIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL1RlcnJhZm9ybWVyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLmpzI0w0NzAtTDQ4MFxuZnVuY3Rpb24gY29vcmRpbmF0ZXNDb250YWluUG9pbnQgKGNvb3JkaW5hdGVzLCBwb2ludCkge1xuICB2YXIgY29udGFpbnMgPSBmYWxzZTtcbiAgZm9yICh2YXIgaSA9IC0xLCBsID0gY29vcmRpbmF0ZXMubGVuZ3RoLCBqID0gbCAtIDE7ICsraSA8IGw7IGogPSBpKSB7XG4gICAgaWYgKCgoY29vcmRpbmF0ZXNbaV1bMV0gPD0gcG9pbnRbMV0gJiYgcG9pbnRbMV0gPCBjb29yZGluYXRlc1tqXVsxXSkgfHxcbiAgICAgICAgIChjb29yZGluYXRlc1tqXVsxXSA8PSBwb2ludFsxXSAmJiBwb2ludFsxXSA8IGNvb3JkaW5hdGVzW2ldWzFdKSkgJiZcbiAgICAgICAgKHBvaW50WzBdIDwgKCgoY29vcmRpbmF0ZXNbal1bMF0gLSBjb29yZGluYXRlc1tpXVswXSkgKiAocG9pbnRbMV0gLSBjb29yZGluYXRlc1tpXVsxXSkpIC8gKGNvb3JkaW5hdGVzW2pdWzFdIC0gY29vcmRpbmF0ZXNbaV1bMV0pKSArIGNvb3JkaW5hdGVzW2ldWzBdKSkge1xuICAgICAgY29udGFpbnMgPSAhY29udGFpbnM7XG4gICAgfVxuICB9XG4gIHJldHVybiBjb250YWlucztcbn1cblxuLy8gcG9ydGVkIGZyb20gdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS90ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIuanMjTDEwNi1MMTEzXG5mdW5jdGlvbiBjb29yZGluYXRlc0NvbnRhaW5Db29yZGluYXRlcyAob3V0ZXIsIGlubmVyKSB7XG4gIHZhciBpbnRlcnNlY3RzID0gYXJyYXlJbnRlcnNlY3RzQXJyYXkob3V0ZXIsIGlubmVyKTtcbiAgdmFyIGNvbnRhaW5zID0gY29vcmRpbmF0ZXNDb250YWluUG9pbnQob3V0ZXIsIGlubmVyWzBdKTtcbiAgaWYgKCFpbnRlcnNlY3RzICYmIGNvbnRhaW5zKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBkbyBhbnkgcG9seWdvbnMgaW4gdGhpcyBhcnJheSBjb250YWluIGFueSBvdGhlciBwb2x5Z29ucyBpbiB0aGlzIGFycmF5P1xuLy8gdXNlZCBmb3IgY2hlY2tpbmcgZm9yIGhvbGVzIGluIGFyY2dpcyByaW5nc1xuLy8gcG9ydGVkIGZyb20gdGVycmFmb3JtZXItYXJjZ2lzLXBhcnNlci5qcyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS90ZXJyYWZvcm1lci1hcmNnaXMtcGFyc2VyL2Jsb2IvbWFzdGVyL3RlcnJhZm9ybWVyLWFyY2dpcy1wYXJzZXIuanMjTDExNy1MMTcyXG5mdW5jdGlvbiBjb252ZXJ0UmluZ3NUb0dlb0pTT04gKHJpbmdzKSB7XG4gIHZhciBvdXRlclJpbmdzID0gW107XG4gIHZhciBob2xlcyA9IFtdO1xuICB2YXIgeDsgLy8gaXRlcmF0b3JcbiAgdmFyIG91dGVyUmluZzsgLy8gY3VycmVudCBvdXRlciByaW5nIGJlaW5nIGV2YWx1YXRlZFxuICB2YXIgaG9sZTsgLy8gY3VycmVudCBob2xlIGJlaW5nIGV2YWx1YXRlZFxuXG4gIC8vIGZvciBlYWNoIHJpbmdcbiAgZm9yICh2YXIgciA9IDA7IHIgPCByaW5ncy5sZW5ndGg7IHIrKykge1xuICAgIHZhciByaW5nID0gY2xvc2VSaW5nKHJpbmdzW3JdLnNsaWNlKDApKTtcbiAgICBpZiAocmluZy5sZW5ndGggPCA0KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gaXMgdGhpcyByaW5nIGFuIG91dGVyIHJpbmc/IGlzIGl0IGNsb2Nrd2lzZT9cbiAgICBpZiAocmluZ0lzQ2xvY2t3aXNlKHJpbmcpKSB7XG4gICAgICB2YXIgcG9seWdvbiA9IFsgcmluZyBdO1xuICAgICAgb3V0ZXJSaW5ncy5wdXNoKHBvbHlnb24pOyAvLyBwdXNoIHRvIG91dGVyIHJpbmdzXG4gICAgfSBlbHNlIHtcbiAgICAgIGhvbGVzLnB1c2gocmluZyk7IC8vIGNvdW50ZXJjbG9ja3dpc2UgcHVzaCB0byBob2xlc1xuICAgIH1cbiAgfVxuXG4gIHZhciB1bmNvbnRhaW5lZEhvbGVzID0gW107XG5cbiAgLy8gd2hpbGUgdGhlcmUgYXJlIGhvbGVzIGxlZnQuLi5cbiAgd2hpbGUgKGhvbGVzLmxlbmd0aCkge1xuICAgIC8vIHBvcCBhIGhvbGUgb2ZmIG91dCBzdGFja1xuICAgIGhvbGUgPSBob2xlcy5wb3AoKTtcblxuICAgIC8vIGxvb3Agb3ZlciBhbGwgb3V0ZXIgcmluZ3MgYW5kIHNlZSBpZiB0aGV5IGNvbnRhaW4gb3VyIGhvbGUuXG4gICAgdmFyIGNvbnRhaW5lZCA9IGZhbHNlO1xuICAgIGZvciAoeCA9IG91dGVyUmluZ3MubGVuZ3RoIC0gMTsgeCA+PSAwOyB4LS0pIHtcbiAgICAgIG91dGVyUmluZyA9IG91dGVyUmluZ3NbeF1bMF07XG4gICAgICBpZiAoY29vcmRpbmF0ZXNDb250YWluQ29vcmRpbmF0ZXMob3V0ZXJSaW5nLCBob2xlKSkge1xuICAgICAgICAvLyB0aGUgaG9sZSBpcyBjb250YWluZWQgcHVzaCBpdCBpbnRvIG91ciBwb2x5Z29uXG4gICAgICAgIG91dGVyUmluZ3NbeF0ucHVzaChob2xlKTtcbiAgICAgICAgY29udGFpbmVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmluZyBpcyBub3QgY29udGFpbmVkIGluIGFueSBvdXRlciByaW5nXG4gICAgLy8gc29tZXRpbWVzIHRoaXMgaGFwcGVucyBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9lc3JpLWxlYWZsZXQvaXNzdWVzLzMyMFxuICAgIGlmICghY29udGFpbmVkKSB7XG4gICAgICB1bmNvbnRhaW5lZEhvbGVzLnB1c2goaG9sZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgd2UgY291bGRuJ3QgbWF0Y2ggYW55IGhvbGVzIHVzaW5nIGNvbnRhaW5zIHdlIGNhbiB0cnkgaW50ZXJzZWN0cy4uLlxuICB3aGlsZSAodW5jb250YWluZWRIb2xlcy5sZW5ndGgpIHtcbiAgICAvLyBwb3AgYSBob2xlIG9mZiBvdXQgc3RhY2tcbiAgICBob2xlID0gdW5jb250YWluZWRIb2xlcy5wb3AoKTtcblxuICAgIC8vIGxvb3Agb3ZlciBhbGwgb3V0ZXIgcmluZ3MgYW5kIHNlZSBpZiBhbnkgaW50ZXJzZWN0IG91ciBob2xlLlxuICAgIHZhciBpbnRlcnNlY3RzID0gZmFsc2U7XG5cbiAgICBmb3IgKHggPSBvdXRlclJpbmdzLmxlbmd0aCAtIDE7IHggPj0gMDsgeC0tKSB7XG4gICAgICBvdXRlclJpbmcgPSBvdXRlclJpbmdzW3hdWzBdO1xuICAgICAgaWYgKGFycmF5SW50ZXJzZWN0c0FycmF5KG91dGVyUmluZywgaG9sZSkpIHtcbiAgICAgICAgLy8gdGhlIGhvbGUgaXMgY29udGFpbmVkIHB1c2ggaXQgaW50byBvdXIgcG9seWdvblxuICAgICAgICBvdXRlclJpbmdzW3hdLnB1c2goaG9sZSk7XG4gICAgICAgIGludGVyc2VjdHMgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWludGVyc2VjdHMpIHtcbiAgICAgIG91dGVyUmluZ3MucHVzaChbaG9sZS5yZXZlcnNlKCldKTtcbiAgICB9XG4gIH1cblxuICBpZiAob3V0ZXJSaW5ncy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ1BvbHlnb24nLFxuICAgICAgY29vcmRpbmF0ZXM6IG91dGVyUmluZ3NbMF1cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnTXVsdGlQb2x5Z29uJyxcbiAgICAgIGNvb3JkaW5hdGVzOiBvdXRlclJpbmdzXG4gICAgfTtcbiAgfVxufVxuXG4vLyBUaGlzIGZ1bmN0aW9uIGVuc3VyZXMgdGhhdCByaW5ncyBhcmUgb3JpZW50ZWQgaW4gdGhlIHJpZ2h0IGRpcmVjdGlvbnNcbi8vIG91dGVyIHJpbmdzIGFyZSBjbG9ja3dpc2UsIGhvbGVzIGFyZSBjb3VudGVyY2xvY2t3aXNlXG4vLyB1c2VkIGZvciBjb252ZXJ0aW5nIEdlb0pTT04gUG9seWdvbnMgdG8gQXJjR0lTIFBvbHlnb25zXG5mdW5jdGlvbiBvcmllbnRSaW5ncyAocG9seSkge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIHZhciBwb2x5Z29uID0gcG9seS5zbGljZSgwKTtcbiAgdmFyIG91dGVyUmluZyA9IGNsb3NlUmluZyhwb2x5Z29uLnNoaWZ0KCkuc2xpY2UoMCkpO1xuICBpZiAob3V0ZXJSaW5nLmxlbmd0aCA+PSA0KSB7XG4gICAgaWYgKCFyaW5nSXNDbG9ja3dpc2Uob3V0ZXJSaW5nKSkge1xuICAgICAgb3V0ZXJSaW5nLnJldmVyc2UoKTtcbiAgICB9XG5cbiAgICBvdXRwdXQucHVzaChvdXRlclJpbmcpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb2x5Z29uLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaG9sZSA9IGNsb3NlUmluZyhwb2x5Z29uW2ldLnNsaWNlKDApKTtcbiAgICAgIGlmIChob2xlLmxlbmd0aCA+PSA0KSB7XG4gICAgICAgIGlmIChyaW5nSXNDbG9ja3dpc2UoaG9sZSkpIHtcbiAgICAgICAgICBob2xlLnJldmVyc2UoKTtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQucHVzaChob2xlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0O1xufVxuXG4vLyBUaGlzIGZ1bmN0aW9uIGZsYXR0ZW5zIGhvbGVzIGluIG11bHRpcG9seWdvbnMgdG8gb25lIGFycmF5IG9mIHBvbHlnb25zXG4vLyB1c2VkIGZvciBjb252ZXJ0aW5nIEdlb0pTT04gUG9seWdvbnMgdG8gQXJjR0lTIFBvbHlnb25zXG5mdW5jdGlvbiBmbGF0dGVuTXVsdGlQb2x5Z29uUmluZ3MgKHJpbmdzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCByaW5ncy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBwb2x5Z29uID0gb3JpZW50UmluZ3MocmluZ3NbaV0pO1xuICAgIGZvciAodmFyIHggPSBwb2x5Z29uLmxlbmd0aCAtIDE7IHggPj0gMDsgeC0tKSB7XG4gICAgICB2YXIgcmluZyA9IHBvbHlnb25beF0uc2xpY2UoMCk7XG4gICAgICBvdXRwdXQucHVzaChyaW5nKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuLy8gc2hhbGxvdyBvYmplY3QgY2xvbmUgZm9yIGZlYXR1cmUgcHJvcGVydGllcyBhbmQgYXR0cmlidXRlc1xuLy8gZnJvbSBodHRwOi8vanNwZXJmLmNvbS9jbG9uaW5nLWFuLW9iamVjdC8yXG5mdW5jdGlvbiBzaGFsbG93Q2xvbmUgKG9iaikge1xuICB2YXIgdGFyZ2V0ID0ge307XG4gIGZvciAodmFyIGkgaW4gb2JqKSB7XG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgdGFyZ2V0W2ldID0gb2JqW2ldO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXJjZ2lzVG9HZW9KU09OIChhcmNnaXMsIGlkQXR0cmlidXRlKSB7XG4gIHZhciBnZW9qc29uID0ge307XG5cbiAgaWYgKHR5cGVvZiBhcmNnaXMueCA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGFyY2dpcy55ID09PSAnbnVtYmVyJykge1xuICAgIGdlb2pzb24udHlwZSA9ICdQb2ludCc7XG4gICAgZ2VvanNvbi5jb29yZGluYXRlcyA9IFthcmNnaXMueCwgYXJjZ2lzLnldO1xuICB9XG5cbiAgaWYgKGFyY2dpcy5wb2ludHMpIHtcbiAgICBnZW9qc29uLnR5cGUgPSAnTXVsdGlQb2ludCc7XG4gICAgZ2VvanNvbi5jb29yZGluYXRlcyA9IGFyY2dpcy5wb2ludHMuc2xpY2UoMCk7XG4gIH1cblxuICBpZiAoYXJjZ2lzLnBhdGhzKSB7XG4gICAgaWYgKGFyY2dpcy5wYXRocy5sZW5ndGggPT09IDEpIHtcbiAgICAgIGdlb2pzb24udHlwZSA9ICdMaW5lU3RyaW5nJztcbiAgICAgIGdlb2pzb24uY29vcmRpbmF0ZXMgPSBhcmNnaXMucGF0aHNbMF0uc2xpY2UoMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdlb2pzb24udHlwZSA9ICdNdWx0aUxpbmVTdHJpbmcnO1xuICAgICAgZ2VvanNvbi5jb29yZGluYXRlcyA9IGFyY2dpcy5wYXRocy5zbGljZSgwKTtcbiAgICB9XG4gIH1cblxuICBpZiAoYXJjZ2lzLnJpbmdzKSB7XG4gICAgZ2VvanNvbiA9IGNvbnZlcnRSaW5nc1RvR2VvSlNPTihhcmNnaXMucmluZ3Muc2xpY2UoMCkpO1xuICB9XG5cbiAgaWYgKGFyY2dpcy5nZW9tZXRyeSB8fCBhcmNnaXMuYXR0cmlidXRlcykge1xuICAgIGdlb2pzb24udHlwZSA9ICdGZWF0dXJlJztcbiAgICBnZW9qc29uLmdlb21ldHJ5ID0gKGFyY2dpcy5nZW9tZXRyeSkgPyBhcmNnaXNUb0dlb0pTT04oYXJjZ2lzLmdlb21ldHJ5KSA6IG51bGw7XG4gICAgZ2VvanNvbi5wcm9wZXJ0aWVzID0gKGFyY2dpcy5hdHRyaWJ1dGVzKSA/IHNoYWxsb3dDbG9uZShhcmNnaXMuYXR0cmlidXRlcykgOiBudWxsO1xuICAgIGlmIChhcmNnaXMuYXR0cmlidXRlcykge1xuICAgICAgZ2VvanNvbi5pZCA9IGFyY2dpcy5hdHRyaWJ1dGVzW2lkQXR0cmlidXRlXSB8fCBhcmNnaXMuYXR0cmlidXRlcy5PQkpFQ1RJRCB8fCBhcmNnaXMuYXR0cmlidXRlcy5GSUQ7XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgbm8gdmFsaWQgZ2VvbWV0cnkgd2FzIGVuY291bnRlcmVkXG4gIGlmIChKU09OLnN0cmluZ2lmeShnZW9qc29uLmdlb21ldHJ5KSA9PT0gSlNPTi5zdHJpbmdpZnkoe30pKSB7XG4gICAgZ2VvanNvbi5nZW9tZXRyeSA9IG51bGw7XG4gIH1cblxuICByZXR1cm4gZ2VvanNvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlb2pzb25Ub0FyY0dJUyAoZ2VvanNvbiwgaWRBdHRyaWJ1dGUpIHtcbiAgaWRBdHRyaWJ1dGUgPSBpZEF0dHJpYnV0ZSB8fCAnT0JKRUNUSUQnO1xuICB2YXIgc3BhdGlhbFJlZmVyZW5jZSA9IHsgd2tpZDogNDMyNiB9O1xuICB2YXIgcmVzdWx0ID0ge307XG4gIHZhciBpO1xuXG4gIHN3aXRjaCAoZ2VvanNvbi50eXBlKSB7XG4gICAgY2FzZSAnUG9pbnQnOlxuICAgICAgcmVzdWx0LnggPSBnZW9qc29uLmNvb3JkaW5hdGVzWzBdO1xuICAgICAgcmVzdWx0LnkgPSBnZW9qc29uLmNvb3JkaW5hdGVzWzFdO1xuICAgICAgcmVzdWx0LnNwYXRpYWxSZWZlcmVuY2UgPSBzcGF0aWFsUmVmZXJlbmNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnTXVsdGlQb2ludCc6XG4gICAgICByZXN1bHQucG9pbnRzID0gZ2VvanNvbi5jb29yZGluYXRlcy5zbGljZSgwKTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0xpbmVTdHJpbmcnOlxuICAgICAgcmVzdWx0LnBhdGhzID0gW2dlb2pzb24uY29vcmRpbmF0ZXMuc2xpY2UoMCldO1xuICAgICAgcmVzdWx0LnNwYXRpYWxSZWZlcmVuY2UgPSBzcGF0aWFsUmVmZXJlbmNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnTXVsdGlMaW5lU3RyaW5nJzpcbiAgICAgIHJlc3VsdC5wYXRocyA9IGdlb2pzb24uY29vcmRpbmF0ZXMuc2xpY2UoMCk7XG4gICAgICByZXN1bHQuc3BhdGlhbFJlZmVyZW5jZSA9IHNwYXRpYWxSZWZlcmVuY2U7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdQb2x5Z29uJzpcbiAgICAgIHJlc3VsdC5yaW5ncyA9IG9yaWVudFJpbmdzKGdlb2pzb24uY29vcmRpbmF0ZXMuc2xpY2UoMCkpO1xuICAgICAgcmVzdWx0LnNwYXRpYWxSZWZlcmVuY2UgPSBzcGF0aWFsUmVmZXJlbmNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnTXVsdGlQb2x5Z29uJzpcbiAgICAgIHJlc3VsdC5yaW5ncyA9IGZsYXR0ZW5NdWx0aVBvbHlnb25SaW5ncyhnZW9qc29uLmNvb3JkaW5hdGVzLnNsaWNlKDApKTtcbiAgICAgIHJlc3VsdC5zcGF0aWFsUmVmZXJlbmNlID0gc3BhdGlhbFJlZmVyZW5jZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0ZlYXR1cmUnOlxuICAgICAgaWYgKGdlb2pzb24uZ2VvbWV0cnkpIHtcbiAgICAgICAgcmVzdWx0Lmdlb21ldHJ5ID0gZ2VvanNvblRvQXJjR0lTKGdlb2pzb24uZ2VvbWV0cnksIGlkQXR0cmlidXRlKTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVzID0gKGdlb2pzb24ucHJvcGVydGllcykgPyBzaGFsbG93Q2xvbmUoZ2VvanNvbi5wcm9wZXJ0aWVzKSA6IHt9O1xuICAgICAgaWYgKGdlb2pzb24uaWQpIHtcbiAgICAgICAgcmVzdWx0LmF0dHJpYnV0ZXNbaWRBdHRyaWJ1dGVdID0gZ2VvanNvbi5pZDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0ZlYXR1cmVDb2xsZWN0aW9uJzpcbiAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGdlb2pzb24uZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZ2VvanNvblRvQXJjR0lTKGdlb2pzb24uZmVhdHVyZXNbaV0sIGlkQXR0cmlidXRlKSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdHZW9tZXRyeUNvbGxlY3Rpb24nOlxuICAgICAgcmVzdWx0ID0gW107XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgZ2VvanNvbi5nZW9tZXRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGdlb2pzb25Ub0FyY0dJUyhnZW9qc29uLmdlb21ldHJpZXNbaV0sIGlkQXR0cmlidXRlKSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgYXJjZ2lzVG9HZW9KU09OLCBnZW9qc29uVG9BcmNHSVMgfTtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuXG5leHBvcnQgdmFyIFN5bWJvbCA9IEwuQ2xhc3MuZXh0ZW5kKHtcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgICB0aGlzLl9zeW1ib2xKc29uID0gc3ltYm9sSnNvbjtcbiAgICB0aGlzLnZhbCA9IG51bGw7XG4gICAgdGhpcy5fc3R5bGVzID0ge307XG4gICAgdGhpcy5faXNEZWZhdWx0ID0gZmFsc2U7XG4gICAgdGhpcy5fbGF5ZXJUcmFuc3BhcmVuY3kgPSAxO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMubGF5ZXJUcmFuc3BhcmVuY3kpIHtcbiAgICAgIHRoaXMuX2xheWVyVHJhbnNwYXJlbmN5ID0gMSAtIChvcHRpb25zLmxheWVyVHJhbnNwYXJlbmN5IC8gMTAwLjApO1xuICAgIH1cbiAgfSxcblxuICAvLyB0aGUgZ2VvanNvbiB2YWx1ZXMgcmV0dXJuZWQgYXJlIGluIHBvaW50c1xuICBwaXhlbFZhbHVlOiBmdW5jdGlvbiAocG9pbnRWYWx1ZSkge1xuICAgIHJldHVybiBwb2ludFZhbHVlICogMS4zMzM7XG4gIH0sXG5cbiAgLy8gY29sb3IgaXMgYW4gYXJyYXkgW3IsZyxiLGFdXG4gIGNvbG9yVmFsdWU6IGZ1bmN0aW9uIChjb2xvcikge1xuICAgIHJldHVybiAncmdiKCcgKyBjb2xvclswXSArICcsJyArIGNvbG9yWzFdICsgJywnICsgY29sb3JbMl0gKyAnKSc7XG4gIH0sXG5cbiAgYWxwaGFWYWx1ZTogZnVuY3Rpb24gKGNvbG9yKSB7XG4gICAgdmFyIGFscGhhID0gY29sb3JbM10gLyAyNTUuMDtcbiAgICByZXR1cm4gYWxwaGEgKiB0aGlzLl9sYXllclRyYW5zcGFyZW5jeTtcbiAgfSxcblxuICBnZXRTaXplOiBmdW5jdGlvbiAoZmVhdHVyZSwgc2l6ZUluZm8pIHtcbiAgICB2YXIgYXR0ciA9IGZlYXR1cmUucHJvcGVydGllcztcbiAgICB2YXIgZmllbGQgPSBzaXplSW5mby5maWVsZDtcbiAgICB2YXIgc2l6ZSA9IDA7XG4gICAgdmFyIGZlYXR1cmVWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoZmllbGQpIHtcbiAgICAgIGZlYXR1cmVWYWx1ZSA9IGF0dHJbZmllbGRdO1xuICAgICAgdmFyIG1pblNpemUgPSBzaXplSW5mby5taW5TaXplO1xuICAgICAgdmFyIG1heFNpemUgPSBzaXplSW5mby5tYXhTaXplO1xuICAgICAgdmFyIG1pbkRhdGFWYWx1ZSA9IHNpemVJbmZvLm1pbkRhdGFWYWx1ZTtcbiAgICAgIHZhciBtYXhEYXRhVmFsdWUgPSBzaXplSW5mby5tYXhEYXRhVmFsdWU7XG4gICAgICB2YXIgZmVhdHVyZVJhdGlvO1xuICAgICAgdmFyIG5vcm1GaWVsZCA9IHNpemVJbmZvLm5vcm1hbGl6YXRpb25GaWVsZDtcbiAgICAgIHZhciBub3JtVmFsdWUgPSBhdHRyID8gcGFyc2VGbG9hdChhdHRyW25vcm1GaWVsZF0pIDogdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoZmVhdHVyZVZhbHVlID09PSBudWxsIHx8IChub3JtRmllbGQgJiYgKChpc05hTihub3JtVmFsdWUpIHx8IG5vcm1WYWx1ZSA9PT0gMCkpKSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKCFpc05hTihub3JtVmFsdWUpKSB7XG4gICAgICAgIGZlYXR1cmVWYWx1ZSAvPSBub3JtVmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChtaW5TaXplICE9PSBudWxsICYmIG1heFNpemUgIT09IG51bGwgJiYgbWluRGF0YVZhbHVlICE9PSBudWxsICYmIG1heERhdGFWYWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoZmVhdHVyZVZhbHVlIDw9IG1pbkRhdGFWYWx1ZSkge1xuICAgICAgICAgIHNpemUgPSBtaW5TaXplO1xuICAgICAgICB9IGVsc2UgaWYgKGZlYXR1cmVWYWx1ZSA+PSBtYXhEYXRhVmFsdWUpIHtcbiAgICAgICAgICBzaXplID0gbWF4U2l6ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmZWF0dXJlUmF0aW8gPSAoZmVhdHVyZVZhbHVlIC0gbWluRGF0YVZhbHVlKSAvIChtYXhEYXRhVmFsdWUgLSBtaW5EYXRhVmFsdWUpO1xuICAgICAgICAgIHNpemUgPSBtaW5TaXplICsgKGZlYXR1cmVSYXRpbyAqIChtYXhTaXplIC0gbWluU2l6ZSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzaXplID0gaXNOYU4oc2l6ZSkgPyAwIDogc2l6ZTtcbiAgICB9XG4gICAgcmV0dXJuIHNpemU7XG4gIH0sXG5cbiAgZ2V0Q29sb3I6IGZ1bmN0aW9uIChmZWF0dXJlLCBjb2xvckluZm8pIHtcbiAgICAvLyByZXF1aXJlZCBpbmZvcm1hdGlvbiB0byBnZXQgY29sb3JcbiAgICBpZiAoIShmZWF0dXJlLnByb3BlcnRpZXMgJiYgY29sb3JJbmZvICYmIGNvbG9ySW5mby5maWVsZCAmJiBjb2xvckluZm8uc3RvcHMpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgYXR0ciA9IGZlYXR1cmUucHJvcGVydGllcztcbiAgICB2YXIgZmVhdHVyZVZhbHVlID0gYXR0cltjb2xvckluZm8uZmllbGRdO1xuICAgIHZhciBsb3dlckJvdW5kQ29sb3IsIHVwcGVyQm91bmRDb2xvciwgbG93ZXJCb3VuZCwgdXBwZXJCb3VuZDtcbiAgICB2YXIgbm9ybUZpZWxkID0gY29sb3JJbmZvLm5vcm1hbGl6YXRpb25GaWVsZDtcbiAgICB2YXIgbm9ybVZhbHVlID0gYXR0ciA/IHBhcnNlRmxvYXQoYXR0cltub3JtRmllbGRdKSA6IHVuZGVmaW5lZDtcbiAgICBpZiAoZmVhdHVyZVZhbHVlID09PSBudWxsIHx8IChub3JtRmllbGQgJiYgKChpc05hTihub3JtVmFsdWUpIHx8IG5vcm1WYWx1ZSA9PT0gMCkpKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCFpc05hTihub3JtVmFsdWUpKSB7XG4gICAgICBmZWF0dXJlVmFsdWUgLz0gbm9ybVZhbHVlO1xuICAgIH1cblxuICAgIGlmIChmZWF0dXJlVmFsdWUgPD0gY29sb3JJbmZvLnN0b3BzWzBdLnZhbHVlKSB7XG4gICAgICByZXR1cm4gY29sb3JJbmZvLnN0b3BzWzBdLmNvbG9yO1xuICAgIH1cbiAgICB2YXIgbGFzdFN0b3AgPSBjb2xvckluZm8uc3RvcHNbY29sb3JJbmZvLnN0b3BzLmxlbmd0aCAtIDFdO1xuICAgIGlmIChmZWF0dXJlVmFsdWUgPj0gbGFzdFN0b3AudmFsdWUpIHtcbiAgICAgIHJldHVybiBsYXN0U3RvcC5jb2xvcjtcbiAgICB9XG5cbiAgICAvLyBnbyB0aHJvdWdoIHRoZSBzdG9wcyB0byBmaW5kIG1pbiBhbmQgbWF4XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2xvckluZm8uc3RvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzdG9wSW5mbyA9IGNvbG9ySW5mby5zdG9wc1tpXTtcblxuICAgICAgaWYgKHN0b3BJbmZvLnZhbHVlIDw9IGZlYXR1cmVWYWx1ZSkge1xuICAgICAgICBsb3dlckJvdW5kQ29sb3IgPSBzdG9wSW5mby5jb2xvcjtcbiAgICAgICAgbG93ZXJCb3VuZCA9IHN0b3BJbmZvLnZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChzdG9wSW5mby52YWx1ZSA+IGZlYXR1cmVWYWx1ZSkge1xuICAgICAgICB1cHBlckJvdW5kQ29sb3IgPSBzdG9wSW5mby5jb2xvcjtcbiAgICAgICAgdXBwZXJCb3VuZCA9IHN0b3BJbmZvLnZhbHVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmZWF0dXJlIGZhbGxzIGJldHdlZW4gdHdvIHN0b3BzLCBpbnRlcnBsYXRlIHRoZSBjb2xvcnNcbiAgICBpZiAoIWlzTmFOKGxvd2VyQm91bmQpICYmICFpc05hTih1cHBlckJvdW5kKSkge1xuICAgICAgdmFyIHJhbmdlID0gdXBwZXJCb3VuZCAtIGxvd2VyQm91bmQ7XG4gICAgICBpZiAocmFuZ2UgPiAwKSB7XG4gICAgICAgIC8vIG1vcmUgd2VpZ2h0IHRoZSBmdXJ0aGVyIGl0IGlzIGZyb20gdGhlIGxvd2VyIGJvdW5kXG4gICAgICAgIHZhciB1cHBlckJvdW5kQ29sb3JXZWlnaHQgPSAoZmVhdHVyZVZhbHVlIC0gbG93ZXJCb3VuZCkgLyByYW5nZTtcbiAgICAgICAgaWYgKHVwcGVyQm91bmRDb2xvcldlaWdodCkge1xuICAgICAgICAgIC8vIG1vcmUgd2VpZ2h0IHRoZSBmdXJ0aGVyIGl0IGlzIGZyb20gdGhlIHVwcGVyIGJvdW5kXG4gICAgICAgICAgdmFyIGxvd2VyQm91bmRDb2xvcldlaWdodCA9ICh1cHBlckJvdW5kIC0gZmVhdHVyZVZhbHVlKSAvIHJhbmdlO1xuICAgICAgICAgIGlmIChsb3dlckJvdW5kQ29sb3JXZWlnaHQpIHtcbiAgICAgICAgICAgIC8vIGludGVycG9sYXRlIHRoZSBsb3dlciBhbmQgdXBwZXIgYm91bmQgY29sb3IgYnkgYXBwbHlpbmcgdGhlXG4gICAgICAgICAgICAvLyB3ZWlnaHRzIHRvIGVhY2ggb2YgdGhlIHJnYmEgY29sb3JzIGFuZCBhZGRpbmcgdGhlbSB0b2dldGhlclxuICAgICAgICAgICAgdmFyIGludGVycG9sYXRlZENvbG9yID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IDQ7IGorKykge1xuICAgICAgICAgICAgICBpbnRlcnBvbGF0ZWRDb2xvcltqXSA9IE1hdGgucm91bmQoKGxvd2VyQm91bmRDb2xvcltqXSAqIGxvd2VyQm91bmRDb2xvcldlaWdodCkgKyAodXBwZXJCb3VuZENvbG9yW2pdICogdXBwZXJCb3VuZENvbG9yV2VpZ2h0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaW50ZXJwb2xhdGVkQ29sb3I7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vIGRpZmZlcmVuY2UgYmV0d2VlbiBmZWF0dXJlVmFsdWUgYW5kIHVwcGVyQm91bmQsIDEwMCUgb2YgdXBwZXJCb3VuZENvbG9yXG4gICAgICAgICAgICByZXR1cm4gdXBwZXJCb3VuZENvbG9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBubyBkaWZmZXJlbmNlIGJldHdlZW4gZmVhdHVyZVZhbHVlIGFuZCBsb3dlckJvdW5kLCAxMDAlIG9mIGxvd2VyQm91bmRDb2xvclxuICAgICAgICAgIHJldHVybiBsb3dlckJvdW5kQ29sb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2UgZ2V0IHRvIGhlcmUsIG5vbmUgb2YgdGhlIGNhc2VzIGFwcGx5IHNvIHJldHVybiBudWxsXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn0pO1xuXG4vLyBleHBvcnQgZnVuY3Rpb24gc3ltYm9sIChzeW1ib2xKc29uKSB7XG4vLyAgIHJldHVybiBuZXcgU3ltYm9sKHN5bWJvbEpzb24pO1xuLy8gfVxuXG5leHBvcnQgZGVmYXVsdCBTeW1ib2w7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcblxuZXhwb3J0IHZhciBTaGFwZU1hcmtlciA9IEwuUGF0aC5leHRlbmQoe1xuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gICAgdGhpcy5fc2l6ZSA9IHNpemU7XG4gICAgdGhpcy5fbGF0bG5nID0gTC5sYXRMbmcobGF0bG5nKTtcbiAgICB0aGlzLl9zdmdDYW52YXNJbmNsdWRlcygpO1xuICB9LFxuXG4gIHRvR2VvSlNPTjogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBMLkdlb0pTT04uZ2V0RmVhdHVyZSh0aGlzLCB7XG4gICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgY29vcmRpbmF0ZXM6IEwuR2VvSlNPTi5sYXRMbmdUb0Nvb3Jkcyh0aGlzLmdldExhdExuZygpKVxuICAgIH0pO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIC8vIGltcGxlbWVudCBpbiBzdWIgY2xhc3NcbiAgfSxcblxuICBfcHJvamVjdDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3BvaW50ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9sYXRsbmcpO1xuICB9LFxuXG4gIF91cGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fbWFwKSB7XG4gICAgICB0aGlzLl91cGRhdGVQYXRoKCk7XG4gICAgfVxuICB9LFxuXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gaW1wbGVtZW50IGluIHN1YiBjbGFzc1xuICB9LFxuXG4gIHNldExhdExuZzogZnVuY3Rpb24gKGxhdGxuZykge1xuICAgIHRoaXMuX2xhdGxuZyA9IEwubGF0TG5nKGxhdGxuZyk7XG4gICAgdGhpcy5yZWRyYXcoKTtcbiAgICByZXR1cm4gdGhpcy5maXJlKCdtb3ZlJywge2xhdGxuZzogdGhpcy5fbGF0bG5nfSk7XG4gIH0sXG5cbiAgZ2V0TGF0TG5nOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xhdGxuZztcbiAgfSxcblxuICBzZXRTaXplOiBmdW5jdGlvbiAoc2l6ZSkge1xuICAgIHRoaXMuX3NpemUgPSBzaXplO1xuICAgIHJldHVybiB0aGlzLnJlZHJhdygpO1xuICB9LFxuXG4gIGdldFNpemU6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2l6ZTtcbiAgfVxufSk7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IFNoYXBlTWFya2VyIH0gZnJvbSAnLi9TaGFwZU1hcmtlcic7XG5cbmV4cG9ydCB2YXIgQ3Jvc3NNYXJrZXIgPSBTaGFwZU1hcmtlci5leHRlbmQoe1xuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgICBTaGFwZU1hcmtlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG4gIH0sXG5cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9yZW5kZXJlci5fdXBkYXRlQ3Jvc3NNYXJrZXIodGhpcyk7XG4gIH0sXG5cbiAgX3N2Z0NhbnZhc0luY2x1ZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgTC5DYW52YXMuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlQ3Jvc3NNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG4gICAgICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHgubW92ZVRvKGxhdGxuZy54LCBsYXRsbmcueSArIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLngsIGxhdGxuZy55IC0gb2Zmc2V0KTtcbiAgICAgICAgdGhpcy5fZmlsbFN0cm9rZShjdHgsIGxheWVyKTtcblxuICAgICAgICBjdHgubW92ZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggKyBvZmZzZXQsIGxhdGxuZy55KTtcbiAgICAgICAgdGhpcy5fZmlsbFN0cm9rZShjdHgsIGxheWVyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIEwuU1ZHLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZUNyb3NzTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuXG4gICAgICAgIGlmIChMLkJyb3dzZXIudm1sKSB7XG4gICAgICAgICAgbGF0bG5nLl9yb3VuZCgpO1xuICAgICAgICAgIG9mZnNldCA9IE1hdGgucm91bmQob2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdHIgPSAnTScgKyBsYXRsbmcueCArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIGxhdGxuZy54ICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KSArXG4gICAgICAgICAgJ00nICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIGxhdGxuZy55ICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgbGF0bG5nLnk7XG5cbiAgICAgICAgdGhpcy5fc2V0UGF0aChsYXllciwgc3RyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG5cbmV4cG9ydCB2YXIgY3Jvc3NNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgQ3Jvc3NNYXJrZXIobGF0bG5nLCBzaXplLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNyb3NzTWFya2VyO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgeyBTaGFwZU1hcmtlciB9IGZyb20gJy4vU2hhcGVNYXJrZXInO1xuXG5leHBvcnQgdmFyIFhNYXJrZXIgPSBTaGFwZU1hcmtlci5leHRlbmQoe1xuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgICBTaGFwZU1hcmtlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG4gIH0sXG5cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9yZW5kZXJlci5fdXBkYXRlWE1hcmtlcih0aGlzKTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBMLkNhbnZhcy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVYTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuICAgICAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcblxuICAgICAgICBjdHgubW92ZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSArIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggLSBvZmZzZXQsIGxhdGxuZy55IC0gb2Zmc2V0KTtcbiAgICAgICAgdGhpcy5fZmlsbFN0cm9rZShjdHgsIGxheWVyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIEwuU1ZHLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZVhNYXJrZXI6IGZ1bmN0aW9uIChsYXllcikge1xuICAgICAgICB2YXIgbGF0bG5nID0gbGF5ZXIuX3BvaW50O1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbGF5ZXIuX3NpemUgLyAyLjA7XG5cbiAgICAgICAgaWYgKEwuQnJvd3Nlci52bWwpIHtcbiAgICAgICAgICBsYXRsbmcuX3JvdW5kKCk7XG4gICAgICAgICAgb2Zmc2V0ID0gTWF0aC5yb3VuZChvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0ciA9ICdNJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgKyBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggLSBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KSArXG4gICAgICAgICAgJ00nICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCArIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpO1xuXG4gICAgICAgIHRoaXMuX3NldFBhdGgobGF5ZXIsIHN0cik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgdmFyIHhNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgWE1hcmtlcihsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgeE1hcmtlcjtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IHsgU2hhcGVNYXJrZXIgfSBmcm9tICcuL1NoYXBlTWFya2VyJztcblxuZXhwb3J0IHZhciBTcXVhcmVNYXJrZXIgPSBTaGFwZU1hcmtlci5leHRlbmQoe1xuICBvcHRpb25zOiB7XG4gICAgZmlsbDogdHJ1ZVxuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgICBTaGFwZU1hcmtlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG4gIH0sXG5cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9yZW5kZXJlci5fdXBkYXRlU3F1YXJlTWFya2VyKHRoaXMpO1xuICB9LFxuXG4gIF9zdmdDYW52YXNJbmNsdWRlczogZnVuY3Rpb24gKCkge1xuICAgIEwuQ2FudmFzLmluY2x1ZGUoe1xuICAgICAgX3VwZGF0ZVNxdWFyZU1hcmtlcjogZnVuY3Rpb24gKGxheWVyKSB7XG4gICAgICAgIHZhciBsYXRsbmcgPSBsYXllci5fcG9pbnQ7XG4gICAgICAgIHZhciBvZmZzZXQgPSBsYXllci5fc2l6ZSAvIDIuMDtcbiAgICAgICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgY3R4Lm1vdmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkgKyBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54IC0gb2Zmc2V0LCBsYXRsbmcueSArIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggLSBvZmZzZXQsIGxhdGxuZy55IC0gb2Zmc2V0KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCArIG9mZnNldCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuXG4gICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcblxuICAgICAgICB0aGlzLl9maWxsU3Ryb2tlKGN0eCwgbGF5ZXIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgTC5TVkcuaW5jbHVkZSh7XG4gICAgICBfdXBkYXRlU3F1YXJlTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuXG4gICAgICAgIGlmIChMLkJyb3dzZXIudm1sKSB7XG4gICAgICAgICAgbGF0bG5nLl9yb3VuZCgpO1xuICAgICAgICAgIG9mZnNldCA9IE1hdGgucm91bmQob2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdHIgPSAnTScgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55ICsgb2Zmc2V0KSArXG4gICAgICAgICAgJ0wnICsgKGxhdGxuZy54IC0gb2Zmc2V0KSArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgKGxhdGxuZy55IC0gb2Zmc2V0KTtcblxuICAgICAgICBzdHIgPSBzdHIgKyAoTC5Ccm93c2VyLnN2ZyA/ICd6JyA6ICd4Jyk7XG5cbiAgICAgICAgdGhpcy5fc2V0UGF0aChsYXllciwgc3RyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG5cbmV4cG9ydCB2YXIgc3F1YXJlTWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgc2l6ZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFNxdWFyZU1hcmtlcihsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgc3F1YXJlTWFya2VyO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5pbXBvcnQgeyBTaGFwZU1hcmtlciB9IGZyb20gJy4vU2hhcGVNYXJrZXInO1xuXG5leHBvcnQgdmFyIERpYW1vbmRNYXJrZXIgPSBTaGFwZU1hcmtlci5leHRlbmQoe1xuICBvcHRpb25zOiB7XG4gICAgZmlsbDogdHJ1ZVxuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXRsbmcsIHNpemUsIG9wdGlvbnMpIHtcbiAgICBTaGFwZU1hcmtlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZywgc2l6ZSwgb3B0aW9ucyk7XG4gIH0sXG5cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9yZW5kZXJlci5fdXBkYXRlRGlhbW9uZE1hcmtlcih0aGlzKTtcbiAgfSxcblxuICBfc3ZnQ2FudmFzSW5jbHVkZXM6IGZ1bmN0aW9uICgpIHtcbiAgICBMLkNhbnZhcy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVEaWFtb25kTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuICAgICAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcblxuICAgICAgICBjdHgubW92ZVRvKGxhdGxuZy54LCBsYXRsbmcueSArIG9mZnNldCk7XG4gICAgICAgIGN0eC5saW5lVG8obGF0bG5nLnggLSBvZmZzZXQsIGxhdGxuZy55KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsYXRsbmcueCwgbGF0bG5nLnkgLSBvZmZzZXQpO1xuICAgICAgICBjdHgubGluZVRvKGxhdGxuZy54ICsgb2Zmc2V0LCBsYXRsbmcueSk7XG5cbiAgICAgICAgY3R4LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgIHRoaXMuX2ZpbGxTdHJva2UoY3R4LCBsYXllcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBMLlNWRy5pbmNsdWRlKHtcbiAgICAgIF91cGRhdGVEaWFtb25kTWFya2VyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICAgICAgdmFyIGxhdGxuZyA9IGxheWVyLl9wb2ludDtcbiAgICAgICAgdmFyIG9mZnNldCA9IGxheWVyLl9zaXplIC8gMi4wO1xuXG4gICAgICAgIGlmIChMLkJyb3dzZXIudm1sKSB7XG4gICAgICAgICAgbGF0bG5nLl9yb3VuZCgpO1xuICAgICAgICAgIG9mZnNldCA9IE1hdGgucm91bmQob2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdHIgPSAnTScgKyBsYXRsbmcueCArICcsJyArIChsYXRsbmcueSArIG9mZnNldCkgK1xuICAgICAgICAgICdMJyArIChsYXRsbmcueCAtIG9mZnNldCkgKyAnLCcgKyBsYXRsbmcueSArXG4gICAgICAgICAgJ0wnICsgbGF0bG5nLnggKyAnLCcgKyAobGF0bG5nLnkgLSBvZmZzZXQpICtcbiAgICAgICAgICAnTCcgKyAobGF0bG5nLnggKyBvZmZzZXQpICsgJywnICsgbGF0bG5nLnk7XG5cbiAgICAgICAgc3RyID0gc3RyICsgKEwuQnJvd3Nlci5zdmcgPyAneicgOiAneCcpO1xuXG4gICAgICAgIHRoaXMuX3NldFBhdGgobGF5ZXIsIHN0cik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgdmFyIGRpYW1vbmRNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBzaXplLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgRGlhbW9uZE1hcmtlcihsYXRsbmcsIHNpemUsIG9wdGlvbnMpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZGlhbW9uZE1hcmtlcjtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuaW1wb3J0IFN5bWJvbCBmcm9tICcuL1N5bWJvbCc7XG5pbXBvcnQge3NxdWFyZU1hcmtlciwgeE1hcmtlciwgY3Jvc3NNYXJrZXIsIGRpYW1vbmRNYXJrZXJ9IGZyb20gJ2xlYWZsZXQtc2hhcGUtbWFya2Vycyc7XG5cbmV4cG9ydCB2YXIgUG9pbnRTeW1ib2wgPSBTeW1ib2wuZXh0ZW5kKHtcblxuICBzdGF0aWNzOiB7XG4gICAgTUFSS0VSVFlQRVM6IFsnZXNyaVNNU0NpcmNsZScsICdlc3JpU01TQ3Jvc3MnLCAnZXNyaVNNU0RpYW1vbmQnLCAnZXNyaVNNU1NxdWFyZScsICdlc3JpU01TWCcsICdlc3JpUE1TJ11cbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoc3ltYm9sSnNvbiwgb3B0aW9ucykge1xuICAgIHZhciB1cmw7XG4gICAgU3ltYm9sLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG4gICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgIHRoaXMuc2VydmljZVVybCA9IG9wdGlvbnMudXJsO1xuICAgIH1cbiAgICBpZiAoc3ltYm9sSnNvbikge1xuICAgICAgaWYgKHN5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlQTVMnKSB7XG4gICAgICAgIHZhciBpbWFnZVVybCA9IHRoaXMuX3N5bWJvbEpzb24udXJsO1xuICAgICAgICBpZiAoKGltYWdlVXJsICYmIGltYWdlVXJsLnN1YnN0cigwLCA3KSA9PT0gJ2h0dHA6Ly8nKSB8fCAoaW1hZ2VVcmwuc3Vic3RyKDAsIDgpID09PSAnaHR0cHM6Ly8nKSkge1xuICAgICAgICAgIC8vIHdlYiBpbWFnZVxuICAgICAgICAgIHVybCA9IHRoaXMuc2FuaXRpemUoaW1hZ2VVcmwpO1xuICAgICAgICAgIHRoaXMuX2ljb25VcmwgPSB1cmw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXJsID0gdGhpcy5zZXJ2aWNlVXJsICsgJ2ltYWdlcy8nICsgaW1hZ2VVcmw7XG4gICAgICAgICAgdGhpcy5faWNvblVybCA9IG9wdGlvbnMgJiYgb3B0aW9ucy50b2tlbiA/IHVybCArICc/dG9rZW49JyArIG9wdGlvbnMudG9rZW4gOiB1cmw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN5bWJvbEpzb24uaW1hZ2VEYXRhKSB7XG4gICAgICAgICAgdGhpcy5faWNvblVybCA9ICdkYXRhOicgKyBzeW1ib2xKc29uLmNvbnRlbnRUeXBlICsgJztiYXNlNjQsJyArIHN5bWJvbEpzb24uaW1hZ2VEYXRhO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxlYWZsZXQgZG9lcyBub3QgYWxsb3cgcmVzaXppbmcgaWNvbnMgc28ga2VlcCBhIGhhc2ggb2YgZGlmZmVyZW50XG4gICAgICAgIC8vIGljb24gc2l6ZXMgdG8gdHJ5IGFuZCBrZWVwIGRvd24gb24gdGhlIG51bWJlciBvZiBpY29ucyBjcmVhdGVkXG4gICAgICAgIHRoaXMuX2ljb25zID0ge307XG4gICAgICAgIC8vIGNyZWF0ZSBiYXNlIGljb25cbiAgICAgICAgdGhpcy5pY29uID0gdGhpcy5fY3JlYXRlSWNvbih0aGlzLl9zeW1ib2xKc29uKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbGxTdHlsZXMoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8gcHJldmVudCBodG1sIGluamVjdGlvbiBpbiBzdHJpbmdzXG4gIHNhbml0aXplOiBmdW5jdGlvbiAoc3RyKSB7XG4gICAgaWYgKCFzdHIpIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdmFyIHRleHQ7XG4gICAgdHJ5IHtcbiAgICAgIC8vIHJlbW92ZXMgaHRtbCBidXQgbGVhdmVzIHVybCBsaW5rIHRleHRcbiAgICAgIHRleHQgPSBzdHIucmVwbGFjZSgvPGJyPi9naSwgJ1xcbicpO1xuICAgICAgdGV4dCA9IHRleHQucmVwbGFjZSgvPHAuKj4vZ2ksICdcXG4nKTtcbiAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoLzxhLipocmVmPScoLio/KScuKj4oLio/KTxcXC9hPi9naSwgJyAkMiAoJDEpICcpO1xuICAgICAgdGV4dCA9IHRleHQucmVwbGFjZSgvPCg/Oi58XFxzKSo/Pi9nLCAnJyk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHRleHQgPSBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGV4dDtcbiAgfSxcblxuICBfZmlsbFN0eWxlczogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUgJiYgdGhpcy5fc3ltYm9sSnNvbi5zaXplID4gMCAmJiB0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUuc3R5bGUgIT09ICdlc3JpU0xTTnVsbCcpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5zdHJva2UgPSB0cnVlO1xuICAgICAgdGhpcy5fc3R5bGVzLndlaWdodCA9IHRoaXMucGl4ZWxWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUud2lkdGgpO1xuICAgICAgdGhpcy5fc3R5bGVzLmNvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24ub3V0bGluZS5jb2xvcik7XG4gICAgICB0aGlzLl9zdHlsZXMub3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLm91dGxpbmUuY29sb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdHlsZXMuc3Ryb2tlID0gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKSB7XG4gICAgICB0aGlzLl9zdHlsZXMuZmlsbENvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSAwO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9zeW1ib2xKc29uLnN0eWxlID09PSAnZXNyaVNNU0NpcmNsZScpIHtcbiAgICAgIHRoaXMuX3N0eWxlcy5yYWRpdXMgPSB0aGlzLnBpeGVsVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5zaXplKSAvIDIuMDtcbiAgICB9XG4gIH0sXG5cbiAgX2NyZWF0ZUljb246IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIHdpZHRoID0gdGhpcy5waXhlbFZhbHVlKG9wdGlvbnMud2lkdGgpO1xuICAgIHZhciBoZWlnaHQgPSB3aWR0aDtcbiAgICBpZiAob3B0aW9ucy5oZWlnaHQpIHtcbiAgICAgIGhlaWdodCA9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLmhlaWdodCk7XG4gICAgfVxuICAgIHZhciB4T2Zmc2V0ID0gd2lkdGggLyAyLjA7XG4gICAgdmFyIHlPZmZzZXQgPSBoZWlnaHQgLyAyLjA7XG5cbiAgICBpZiAob3B0aW9ucy54b2Zmc2V0KSB7XG4gICAgICB4T2Zmc2V0ICs9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLnhvZmZzZXQpO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy55b2Zmc2V0KSB7XG4gICAgICB5T2Zmc2V0ICs9IHRoaXMucGl4ZWxWYWx1ZShvcHRpb25zLnlvZmZzZXQpO1xuICAgIH1cblxuICAgIHZhciBpY29uID0gTC5pY29uKHtcbiAgICAgIGljb25Vcmw6IHRoaXMuX2ljb25VcmwsXG4gICAgICBpY29uU2l6ZTogW3dpZHRoLCBoZWlnaHRdLFxuICAgICAgaWNvbkFuY2hvcjogW3hPZmZzZXQsIHlPZmZzZXRdXG4gICAgfSk7XG4gICAgdGhpcy5faWNvbnNbb3B0aW9ucy53aWR0aC50b1N0cmluZygpXSA9IGljb247XG4gICAgcmV0dXJuIGljb247XG4gIH0sXG5cbiAgX2dldEljb246IGZ1bmN0aW9uIChzaXplKSB7XG4gICAgLy8gY2hlY2sgdG8gc2VlIGlmIGl0IGlzIGFscmVhZHkgY3JlYXRlZCBieSBzaXplXG4gICAgdmFyIGljb24gPSB0aGlzLl9pY29uc1tzaXplLnRvU3RyaW5nKCldO1xuICAgIGlmICghaWNvbikge1xuICAgICAgaWNvbiA9IHRoaXMuX2NyZWF0ZUljb24oe3dpZHRoOiBzaXplfSk7XG4gICAgfVxuICAgIHJldHVybiBpY29uO1xuICB9LFxuXG4gIHBvaW50VG9MYXllcjogZnVuY3Rpb24gKGdlb2pzb24sIGxhdGxuZywgdmlzdWFsVmFyaWFibGVzLCBvcHRpb25zKSB7XG4gICAgdmFyIHNpemUgPSB0aGlzLl9zeW1ib2xKc29uLnNpemUgfHwgdGhpcy5fc3ltYm9sSnNvbi53aWR0aDtcbiAgICBpZiAoIXRoaXMuX2lzRGVmYXVsdCkge1xuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5zaXplSW5mbykge1xuICAgICAgICB2YXIgY2FsY3VsYXRlZFNpemUgPSB0aGlzLmdldFNpemUoZ2VvanNvbiwgdmlzdWFsVmFyaWFibGVzLnNpemVJbmZvKTtcbiAgICAgICAgaWYgKGNhbGN1bGF0ZWRTaXplKSB7XG4gICAgICAgICAgc2l6ZSA9IGNhbGN1bGF0ZWRTaXplO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbykge1xuICAgICAgICB2YXIgY29sb3IgPSB0aGlzLmdldENvbG9yKGdlb2pzb24sIHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pO1xuICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbENvbG9yID0gdGhpcy5jb2xvclZhbHVlKGNvbG9yKTtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbE9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUoY29sb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3N5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlQTVMnKSB7XG4gICAgICB2YXIgbGF5ZXJPcHRpb25zID0gTC5leHRlbmQoe30sIHtpY29uOiB0aGlzLl9nZXRJY29uKHNpemUpfSwgb3B0aW9ucyk7XG4gICAgICByZXR1cm4gTC5tYXJrZXIobGF0bG5nLCBsYXllck9wdGlvbnMpO1xuICAgIH1cbiAgICBzaXplID0gdGhpcy5waXhlbFZhbHVlKHNpemUpO1xuXG4gICAgc3dpdGNoICh0aGlzLl9zeW1ib2xKc29uLnN0eWxlKSB7XG4gICAgICBjYXNlICdlc3JpU01TU3F1YXJlJzpcbiAgICAgICAgcmV0dXJuIHNxdWFyZU1hcmtlcihsYXRsbmcsIHNpemUsIEwuZXh0ZW5kKHt9LCB0aGlzLl9zdHlsZXMsIG9wdGlvbnMpKTtcbiAgICAgIGNhc2UgJ2VzcmlTTVNEaWFtb25kJzpcbiAgICAgICAgcmV0dXJuIGRpYW1vbmRNYXJrZXIobGF0bG5nLCBzaXplLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gICAgICBjYXNlICdlc3JpU01TQ3Jvc3MnOlxuICAgICAgICByZXR1cm4gY3Jvc3NNYXJrZXIobGF0bG5nLCBzaXplLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gICAgICBjYXNlICdlc3JpU01TWCc6XG4gICAgICAgIHJldHVybiB4TWFya2VyKGxhdGxuZywgc2l6ZSwgTC5leHRlbmQoe30sIHRoaXMuX3N0eWxlcywgb3B0aW9ucykpO1xuICAgIH1cbiAgICB0aGlzLl9zdHlsZXMucmFkaXVzID0gc2l6ZSAvIDIuMDtcbiAgICByZXR1cm4gTC5jaXJjbGVNYXJrZXIobGF0bG5nLCBMLmV4dGVuZCh7fSwgdGhpcy5fc3R5bGVzLCBvcHRpb25zKSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gcG9pbnRTeW1ib2wgKHN5bWJvbEpzb24sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBQb2ludFN5bWJvbChzeW1ib2xKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9pbnRTeW1ib2w7XG4iLCJpbXBvcnQgU3ltYm9sIGZyb20gJy4vU3ltYm9sJztcblxuZXhwb3J0IHZhciBMaW5lU3ltYm9sID0gU3ltYm9sLmV4dGVuZCh7XG4gIHN0YXRpY3M6IHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWQgJ2VzcmlTTFNOdWxsJ1xuICAgIExJTkVUWVBFUzogWydlc3JpU0xTRGFzaCcsICdlc3JpU0xTRG90JywgJ2VzcmlTTFNEYXNoRG90RG90JywgJ2VzcmlTTFNEYXNoRG90JywgJ2VzcmlTTFNTb2xpZCddXG4gIH0sXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gICAgU3ltYm9sLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fZmlsbFN0eWxlcygpO1xuICB9LFxuXG4gIF9maWxsU3R5bGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gc2V0IHRoZSBkZWZhdWx0cyB0aGF0IHNob3cgdXAgb24gYXJjZ2lzIG9ubGluZVxuICAgIHRoaXMuX3N0eWxlcy5saW5lQ2FwID0gJ2J1dHQnO1xuICAgIHRoaXMuX3N0eWxlcy5saW5lSm9pbiA9ICdtaXRlcic7XG4gICAgdGhpcy5fc3R5bGVzLmZpbGwgPSBmYWxzZTtcbiAgICB0aGlzLl9zdHlsZXMud2VpZ2h0ID0gMDtcblxuICAgIGlmICghdGhpcy5fc3ltYm9sSnNvbikge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0eWxlcztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbi5jb2xvcikge1xuICAgICAgdGhpcy5fc3R5bGVzLmNvbG9yID0gdGhpcy5jb2xvclZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgICAgdGhpcy5fc3R5bGVzLm9wYWNpdHkgPSB0aGlzLmFscGhhVmFsdWUodGhpcy5fc3ltYm9sSnNvbi5jb2xvcik7XG4gICAgfVxuXG4gICAgaWYgKCFpc05hTih0aGlzLl9zeW1ib2xKc29uLndpZHRoKSkge1xuICAgICAgdGhpcy5fc3R5bGVzLndlaWdodCA9IHRoaXMucGl4ZWxWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLndpZHRoKTtcblxuICAgICAgdmFyIGRhc2hWYWx1ZXMgPSBbXTtcblxuICAgICAgc3dpdGNoICh0aGlzLl9zeW1ib2xKc29uLnN0eWxlKSB7XG4gICAgICAgIGNhc2UgJ2VzcmlTTFNEYXNoJzpcbiAgICAgICAgICBkYXNoVmFsdWVzID0gWzQsIDNdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlc3JpU0xTRG90JzpcbiAgICAgICAgICBkYXNoVmFsdWVzID0gWzEsIDNdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlc3JpU0xTRGFzaERvdCc6XG4gICAgICAgICAgZGFzaFZhbHVlcyA9IFs4LCAzLCAxLCAzXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZXNyaVNMU0Rhc2hEb3REb3QnOlxuICAgICAgICAgIGRhc2hWYWx1ZXMgPSBbOCwgMywgMSwgMywgMSwgM107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIHVzZSB0aGUgZGFzaCB2YWx1ZXMgYW5kIHRoZSBsaW5lIHdlaWdodCB0byBzZXQgZGFzaCBhcnJheVxuICAgICAgaWYgKGRhc2hWYWx1ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhc2hWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBkYXNoVmFsdWVzW2ldICo9IHRoaXMuX3N0eWxlcy53ZWlnaHQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdHlsZXMuZGFzaEFycmF5ID0gZGFzaFZhbHVlcy5qb2luKCcsJyk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHN0eWxlOiBmdW5jdGlvbiAoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzKSB7XG4gICAgaWYgKCF0aGlzLl9pc0RlZmF1bHQgJiYgdmlzdWFsVmFyaWFibGVzKSB7XG4gICAgICBpZiAodmlzdWFsVmFyaWFibGVzLnNpemVJbmZvKSB7XG4gICAgICAgIHZhciBjYWxjdWxhdGVkU2l6ZSA9IHRoaXMucGl4ZWxWYWx1ZSh0aGlzLmdldFNpemUoZmVhdHVyZSwgdmlzdWFsVmFyaWFibGVzLnNpemVJbmZvKSk7XG4gICAgICAgIGlmIChjYWxjdWxhdGVkU2l6ZSkge1xuICAgICAgICAgIHRoaXMuX3N0eWxlcy53ZWlnaHQgPSBjYWxjdWxhdGVkU2l6ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHZpc3VhbFZhcmlhYmxlcy5jb2xvckluZm8pIHtcbiAgICAgICAgdmFyIGNvbG9yID0gdGhpcy5nZXRDb2xvcihmZWF0dXJlLCB2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKTtcbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgdGhpcy5fc3R5bGVzLmNvbG9yID0gdGhpcy5jb2xvclZhbHVlKGNvbG9yKTtcbiAgICAgICAgICB0aGlzLl9zdHlsZXMub3BhY2l0eSA9IHRoaXMuYWxwaGFWYWx1ZShjb2xvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0eWxlcztcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBsaW5lU3ltYm9sIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgTGluZVN5bWJvbChzeW1ib2xKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgbGluZVN5bWJvbDtcbiIsImltcG9ydCBTeW1ib2wgZnJvbSAnLi9TeW1ib2wnO1xuaW1wb3J0IGxpbmVTeW1ib2wgZnJvbSAnLi9MaW5lU3ltYm9sJztcblxuZXhwb3J0IHZhciBQb2x5Z29uU3ltYm9sID0gU3ltYm9sLmV4dGVuZCh7XG4gIHN0YXRpY3M6IHtcbiAgICAvLyBub3QgaW1wbGVtZW50ZWQ6ICdlc3JpU0ZTQmFja3dhcmREaWFnb25hbCcsJ2VzcmlTRlNDcm9zcycsJ2VzcmlTRlNEaWFnb25hbENyb3NzJywnZXNyaVNGU0ZvcndhcmREaWFnb25hbCcsJ2VzcmlTRlNIb3Jpem9udGFsJywnZXNyaVNGU051bGwnLCdlc3JpU0ZTVmVydGljYWwnXG4gICAgUE9MWUdPTlRZUEVTOiBbJ2VzcmlTRlNTb2xpZCddXG4gIH0sXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gICAgU3ltYm9sLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgc3ltYm9sSnNvbiwgb3B0aW9ucyk7XG4gICAgaWYgKHN5bWJvbEpzb24pIHtcbiAgICAgIGlmIChzeW1ib2xKc29uLm91dGxpbmUgJiYgc3ltYm9sSnNvbi5vdXRsaW5lLnN0eWxlID09PSAnZXNyaVNMU051bGwnKSB7XG4gICAgICAgIHRoaXMuX2xpbmVTdHlsZXMgPSB7IHdlaWdodDogMCB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fbGluZVN0eWxlcyA9IGxpbmVTeW1ib2woc3ltYm9sSnNvbi5vdXRsaW5lLCBvcHRpb25zKS5zdHlsZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5fZmlsbFN0eWxlcygpO1xuICAgIH1cbiAgfSxcblxuICBfZmlsbFN0eWxlczogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9saW5lU3R5bGVzKSB7XG4gICAgICBpZiAodGhpcy5fbGluZVN0eWxlcy53ZWlnaHQgPT09IDApIHtcbiAgICAgICAgLy8gd2hlbiB3ZWlnaHQgaXMgMCwgc2V0dGluZyB0aGUgc3Ryb2tlIHRvIGZhbHNlIGNhbiBzdGlsbCBsb29rIGJhZFxuICAgICAgICAvLyAoZ2FwcyBiZXR3ZWVuIHRoZSBwb2x5Z29ucylcbiAgICAgICAgdGhpcy5fc3R5bGVzLnN0cm9rZSA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY29weSB0aGUgbGluZSBzeW1ib2wgc3R5bGVzIGludG8gdGhpcyBzeW1ib2wncyBzdHlsZXNcbiAgICAgICAgZm9yICh2YXIgc3R5bGVBdHRyIGluIHRoaXMuX2xpbmVTdHlsZXMpIHtcbiAgICAgICAgICB0aGlzLl9zdHlsZXNbc3R5bGVBdHRyXSA9IHRoaXMuX2xpbmVTdHlsZXNbc3R5bGVBdHRyXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldCB0aGUgZmlsbCBmb3IgdGhlIHBvbHlnb25cbiAgICBpZiAodGhpcy5fc3ltYm9sSnNvbikge1xuICAgICAgaWYgKHRoaXMuX3N5bWJvbEpzb24uY29sb3IgJiZcbiAgICAgICAgICAvLyBkb24ndCBmaWxsIHBvbHlnb24gaWYgdHlwZSBpcyBub3Qgc3VwcG9ydGVkXG4gICAgICAgICAgUG9seWdvblN5bWJvbC5QT0xZR09OVFlQRVMuaW5kZXhPZih0aGlzLl9zeW1ib2xKc29uLnN0eWxlID49IDApKSB7XG4gICAgICAgIHRoaXMuX3N0eWxlcy5maWxsID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxDb2xvciA9IHRoaXMuY29sb3JWYWx1ZSh0aGlzLl9zeW1ib2xKc29uLmNvbG9yKTtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKHRoaXMuX3N5bWJvbEpzb24uY29sb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGwgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gMDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc3R5bGU6IGZ1bmN0aW9uIChmZWF0dXJlLCB2aXN1YWxWYXJpYWJsZXMpIHtcbiAgICBpZiAoIXRoaXMuX2lzRGVmYXVsdCAmJiB2aXN1YWxWYXJpYWJsZXMgJiYgdmlzdWFsVmFyaWFibGVzLmNvbG9ySW5mbykge1xuICAgICAgdmFyIGNvbG9yID0gdGhpcy5nZXRDb2xvcihmZWF0dXJlLCB2aXN1YWxWYXJpYWJsZXMuY29sb3JJbmZvKTtcbiAgICAgIGlmIChjb2xvcikge1xuICAgICAgICB0aGlzLl9zdHlsZXMuZmlsbENvbG9yID0gdGhpcy5jb2xvclZhbHVlKGNvbG9yKTtcbiAgICAgICAgdGhpcy5fc3R5bGVzLmZpbGxPcGFjaXR5ID0gdGhpcy5hbHBoYVZhbHVlKGNvbG9yKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0eWxlcztcbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwb2x5Z29uU3ltYm9sIChzeW1ib2xKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgUG9seWdvblN5bWJvbChzeW1ib2xKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9seWdvblN5bWJvbDtcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xuXG5pbXBvcnQgcG9pbnRTeW1ib2wgZnJvbSAnLi4vU3ltYm9scy9Qb2ludFN5bWJvbCc7XG5pbXBvcnQgbGluZVN5bWJvbCBmcm9tICcuLi9TeW1ib2xzL0xpbmVTeW1ib2wnO1xuaW1wb3J0IHBvbHlnb25TeW1ib2wgZnJvbSAnLi4vU3ltYm9scy9Qb2x5Z29uU3ltYm9sJztcblxuZXhwb3J0IHZhciBSZW5kZXJlciA9IEwuQ2xhc3MuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIHByb3BvcnRpb25hbFBvbHlnb246IGZhbHNlLFxuICAgIGNsaWNrYWJsZTogdHJ1ZVxuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgICB0aGlzLl9yZW5kZXJlckpzb24gPSByZW5kZXJlckpzb247XG4gICAgdGhpcy5fcG9pbnRTeW1ib2xzID0gZmFsc2U7XG4gICAgdGhpcy5fc3ltYm9scyA9IFtdO1xuICAgIHRoaXMuX3Zpc3VhbFZhcmlhYmxlcyA9IHRoaXMuX3BhcnNlVmlzdWFsVmFyaWFibGVzKHJlbmRlcmVySnNvbi52aXN1YWxWYXJpYWJsZXMpO1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF9wYXJzZVZpc3VhbFZhcmlhYmxlczogZnVuY3Rpb24gKHZpc3VhbFZhcmlhYmxlcykge1xuICAgIHZhciB2aXNWYXJzID0ge307XG4gICAgaWYgKHZpc3VhbFZhcmlhYmxlcykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2aXN1YWxWYXJpYWJsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmlzVmFyc1t2aXN1YWxWYXJpYWJsZXNbaV0udHlwZV0gPSB2aXN1YWxWYXJpYWJsZXNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2aXNWYXJzO1xuICB9LFxuXG4gIF9jcmVhdGVEZWZhdWx0U3ltYm9sOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX3JlbmRlcmVySnNvbi5kZWZhdWx0U3ltYm9sKSB7XG4gICAgICB0aGlzLl9kZWZhdWx0U3ltYm9sID0gdGhpcy5fbmV3U3ltYm9sKHRoaXMuX3JlbmRlcmVySnNvbi5kZWZhdWx0U3ltYm9sKTtcbiAgICAgIHRoaXMuX2RlZmF1bHRTeW1ib2wuX2lzRGVmYXVsdCA9IHRydWU7XG4gICAgfVxuICB9LFxuXG4gIF9uZXdTeW1ib2w6IGZ1bmN0aW9uIChzeW1ib2xKc29uKSB7XG4gICAgaWYgKHN5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlTTVMnIHx8IHN5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlQTVMnKSB7XG4gICAgICB0aGlzLl9wb2ludFN5bWJvbHMgPSB0cnVlO1xuICAgICAgcmV0dXJuIHBvaW50U3ltYm9sKHN5bWJvbEpzb24sIHRoaXMub3B0aW9ucyk7XG4gICAgfVxuICAgIGlmIChzeW1ib2xKc29uLnR5cGUgPT09ICdlc3JpU0xTJykge1xuICAgICAgcmV0dXJuIGxpbmVTeW1ib2woc3ltYm9sSnNvbiwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG4gICAgaWYgKHN5bWJvbEpzb24udHlwZSA9PT0gJ2VzcmlTRlMnKSB7XG4gICAgICByZXR1cm4gcG9seWdvblN5bWJvbChzeW1ib2xKc29uLCB0aGlzLm9wdGlvbnMpO1xuICAgIH1cbiAgfSxcblxuICBfZ2V0U3ltYm9sOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gb3ZlcnJpZGVcbiAgfSxcblxuICBhdHRhY2hTdHlsZXNUb0xheWVyOiBmdW5jdGlvbiAobGF5ZXIpIHtcbiAgICBpZiAodGhpcy5fcG9pbnRTeW1ib2xzKSB7XG4gICAgICBsYXllci5vcHRpb25zLnBvaW50VG9MYXllciA9IEwuVXRpbC5iaW5kKHRoaXMucG9pbnRUb0xheWVyLCB0aGlzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGF5ZXIub3B0aW9ucy5zdHlsZSA9IEwuVXRpbC5iaW5kKHRoaXMuc3R5bGUsIHRoaXMpO1xuICAgICAgbGF5ZXIuX29yaWdpbmFsU3R5bGUgPSBsYXllci5vcHRpb25zLnN0eWxlO1xuICAgIH1cbiAgfSxcblxuICBwb2ludFRvTGF5ZXI6IGZ1bmN0aW9uIChnZW9qc29uLCBsYXRsbmcpIHtcbiAgICB2YXIgc3ltID0gdGhpcy5fZ2V0U3ltYm9sKGdlb2pzb24pO1xuICAgIGlmIChzeW0gJiYgc3ltLnBvaW50VG9MYXllcikge1xuICAgICAgLy8gcmlnaHQgbm93IGN1c3RvbSBwYW5lcyBhcmUgdGhlIG9ubHkgb3B0aW9uIHB1c2hlZCB0aHJvdWdoXG4gICAgICByZXR1cm4gc3ltLnBvaW50VG9MYXllcihnZW9qc29uLCBsYXRsbmcsIHRoaXMuX3Zpc3VhbFZhcmlhYmxlcywgdGhpcy5vcHRpb25zKTtcbiAgICB9XG4gICAgLy8gaW52aXNpYmxlIHN5bWJvbG9neVxuICAgIHJldHVybiBMLmNpcmNsZU1hcmtlcihsYXRsbmcsIHtyYWRpdXM6IDAsIG9wYWNpdHk6IDB9KTtcbiAgfSxcblxuICBzdHlsZTogZnVuY3Rpb24gKGZlYXR1cmUpIHtcbiAgICB2YXIgdXNlclN0eWxlcztcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZXJEZWZpbmVkU3R5bGUpIHtcbiAgICAgIHVzZXJTdHlsZXMgPSB0aGlzLm9wdGlvbnMudXNlckRlZmluZWRTdHlsZShmZWF0dXJlKTtcbiAgICB9XG4gICAgLy8gZmluZCB0aGUgc3ltYm9sIHRvIHJlcHJlc2VudCB0aGlzIGZlYXR1cmVcbiAgICB2YXIgc3ltID0gdGhpcy5fZ2V0U3ltYm9sKGZlYXR1cmUpO1xuICAgIGlmIChzeW0pIHtcbiAgICAgIHJldHVybiB0aGlzLm1lcmdlU3R5bGVzKHN5bS5zdHlsZShmZWF0dXJlLCB0aGlzLl92aXN1YWxWYXJpYWJsZXMpLCB1c2VyU3R5bGVzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW52aXNpYmxlIHN5bWJvbG9neVxuICAgICAgcmV0dXJuIHRoaXMubWVyZ2VTdHlsZXMoe29wYWNpdHk6IDAsIGZpbGxPcGFjaXR5OiAwfSwgdXNlclN0eWxlcyk7XG4gICAgfVxuICB9LFxuXG4gIG1lcmdlU3R5bGVzOiBmdW5jdGlvbiAoc3R5bGVzLCB1c2VyU3R5bGVzKSB7XG4gICAgdmFyIG1lcmdlZFN0eWxlcyA9IHt9O1xuICAgIHZhciBhdHRyO1xuICAgIC8vIGNvcHkgcmVuZGVyZXIgc3R5bGUgYXR0cmlidXRlc1xuICAgIGZvciAoYXR0ciBpbiBzdHlsZXMpIHtcbiAgICAgIGlmIChzdHlsZXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgbWVyZ2VkU3R5bGVzW2F0dHJdID0gc3R5bGVzW2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBvdmVycmlkZSB3aXRoIHVzZXIgZGVmaW5lZCBzdHlsZSBhdHRyaWJ1dGVzXG4gICAgaWYgKHVzZXJTdHlsZXMpIHtcbiAgICAgIGZvciAoYXR0ciBpbiB1c2VyU3R5bGVzKSB7XG4gICAgICAgIGlmICh1c2VyU3R5bGVzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgbWVyZ2VkU3R5bGVzW2F0dHJdID0gdXNlclN0eWxlc1thdHRyXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWVyZ2VkU3R5bGVzO1xuICB9XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgUmVuZGVyZXI7XG4iLCJpbXBvcnQgUmVuZGVyZXIgZnJvbSAnLi9SZW5kZXJlcic7XG5cbmV4cG9ydCB2YXIgQ2xhc3NCcmVha3NSZW5kZXJlciA9IFJlbmRlcmVyLmV4dGVuZCh7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChyZW5kZXJlckpzb24sIG9wdGlvbnMpIHtcbiAgICBSZW5kZXJlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG4gICAgdGhpcy5fZmllbGQgPSB0aGlzLl9yZW5kZXJlckpzb24uZmllbGQ7XG4gICAgaWYgKHRoaXMuX3JlbmRlcmVySnNvbi5ub3JtYWxpemF0aW9uVHlwZSAmJiB0aGlzLl9yZW5kZXJlckpzb24ubm9ybWFsaXphdGlvblR5cGUgPT09ICdlc3JpTm9ybWFsaXplQnlGaWVsZCcpIHtcbiAgICAgIHRoaXMuX25vcm1hbGl6YXRpb25GaWVsZCA9IHRoaXMuX3JlbmRlcmVySnNvbi5ub3JtYWxpemF0aW9uRmllbGQ7XG4gICAgfVxuICAgIHRoaXMuX2NyZWF0ZVN5bWJvbHMoKTtcbiAgfSxcblxuICBfY3JlYXRlU3ltYm9sczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzeW1ib2w7XG4gICAgdmFyIGNsYXNzYnJlYWtzID0gdGhpcy5fcmVuZGVyZXJKc29uLmNsYXNzQnJlYWtJbmZvcztcblxuICAgIHRoaXMuX3N5bWJvbHMgPSBbXTtcblxuICAgIC8vIGNyZWF0ZSBhIHN5bWJvbCBmb3IgZWFjaCBjbGFzcyBicmVha1xuICAgIGZvciAodmFyIGkgPSBjbGFzc2JyZWFrcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5wcm9wb3J0aW9uYWxQb2x5Z29uICYmIHRoaXMuX3JlbmRlcmVySnNvbi5iYWNrZ3JvdW5kRmlsbFN5bWJvbCkge1xuICAgICAgICBzeW1ib2wgPSB0aGlzLl9uZXdTeW1ib2wodGhpcy5fcmVuZGVyZXJKc29uLmJhY2tncm91bmRGaWxsU3ltYm9sKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN5bWJvbCA9IHRoaXMuX25ld1N5bWJvbChjbGFzc2JyZWFrc1tpXS5zeW1ib2wpO1xuICAgICAgfVxuICAgICAgc3ltYm9sLnZhbCA9IGNsYXNzYnJlYWtzW2ldLmNsYXNzTWF4VmFsdWU7XG4gICAgICB0aGlzLl9zeW1ib2xzLnB1c2goc3ltYm9sKTtcbiAgICB9XG4gICAgLy8gc29ydCB0aGUgc3ltYm9scyBpbiBhc2NlbmRpbmcgdmFsdWVcbiAgICB0aGlzLl9zeW1ib2xzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBhLnZhbCA+IGIudmFsID8gMSA6IC0xO1xuICAgIH0pO1xuICAgIHRoaXMuX2NyZWF0ZURlZmF1bHRTeW1ib2woKTtcbiAgICB0aGlzLl9tYXhWYWx1ZSA9IHRoaXMuX3N5bWJvbHNbdGhpcy5fc3ltYm9scy5sZW5ndGggLSAxXS52YWw7XG4gIH0sXG5cbiAgX2dldFN5bWJvbDogZnVuY3Rpb24gKGZlYXR1cmUpIHtcbiAgICB2YXIgdmFsID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX2ZpZWxkXTtcbiAgICBpZiAodGhpcy5fbm9ybWFsaXphdGlvbkZpZWxkKSB7XG4gICAgICB2YXIgbm9ybVZhbHVlID0gZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMuX25vcm1hbGl6YXRpb25GaWVsZF07XG4gICAgICBpZiAoIWlzTmFOKG5vcm1WYWx1ZSkgJiYgbm9ybVZhbHVlICE9PSAwKSB7XG4gICAgICAgIHZhbCA9IHZhbCAvIG5vcm1WYWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWZhdWx0U3ltYm9sO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh2YWwgPiB0aGlzLl9tYXhWYWx1ZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRTeW1ib2w7XG4gICAgfVxuICAgIHZhciBzeW1ib2wgPSB0aGlzLl9zeW1ib2xzWzBdO1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9zeW1ib2xzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodmFsID4gdGhpcy5fc3ltYm9sc1tpXS52YWwpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBzeW1ib2wgPSB0aGlzLl9zeW1ib2xzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzQnJlYWtzUmVuZGVyZXIgKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IENsYXNzQnJlYWtzUmVuZGVyZXIocmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3NCcmVha3NSZW5kZXJlcjtcbiIsImltcG9ydCBSZW5kZXJlciBmcm9tICcuL1JlbmRlcmVyJztcblxuZXhwb3J0IHZhciBVbmlxdWVWYWx1ZVJlbmRlcmVyID0gUmVuZGVyZXIuZXh0ZW5kKHtcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICAgIFJlbmRlcmVyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgcmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbiAgICB0aGlzLl9maWVsZCA9IHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZDE7XG4gICAgdGhpcy5fY3JlYXRlU3ltYm9scygpO1xuICB9LFxuXG4gIF9jcmVhdGVTeW1ib2xzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN5bWJvbDtcbiAgICB2YXIgdW5pcXVlcyA9IHRoaXMuX3JlbmRlcmVySnNvbi51bmlxdWVWYWx1ZUluZm9zO1xuXG4gICAgLy8gY3JlYXRlIGEgc3ltYm9sIGZvciBlYWNoIHVuaXF1ZSB2YWx1ZVxuICAgIGZvciAodmFyIGkgPSB1bmlxdWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBzeW1ib2wgPSB0aGlzLl9uZXdTeW1ib2wodW5pcXVlc1tpXS5zeW1ib2wpO1xuICAgICAgc3ltYm9sLnZhbCA9IHVuaXF1ZXNbaV0udmFsdWU7XG4gICAgICB0aGlzLl9zeW1ib2xzLnB1c2goc3ltYm9sKTtcbiAgICB9XG4gICAgdGhpcy5fY3JlYXRlRGVmYXVsdFN5bWJvbCgpO1xuICB9LFxuXG4gIF9nZXRTeW1ib2w6IGZ1bmN0aW9uIChmZWF0dXJlKSB7XG4gICAgdmFyIHZhbCA9IGZlYXR1cmUucHJvcGVydGllc1t0aGlzLl9maWVsZF07XG4gICAgLy8gYWNjdW11bGF0ZSB2YWx1ZXMgaWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBmaWVsZCBkZWZpbmVkXG4gICAgaWYgKHRoaXMuX3JlbmRlcmVySnNvbi5maWVsZERlbGltaXRlciAmJiB0aGlzLl9yZW5kZXJlckpzb24uZmllbGQyKSB7XG4gICAgICB2YXIgdmFsMiA9IGZlYXR1cmUucHJvcGVydGllc1t0aGlzLl9yZW5kZXJlckpzb24uZmllbGQyXTtcbiAgICAgIGlmICh2YWwyKSB7XG4gICAgICAgIHZhbCArPSB0aGlzLl9yZW5kZXJlckpzb24uZmllbGREZWxpbWl0ZXIgKyB2YWwyO1xuICAgICAgICB2YXIgdmFsMyA9IGZlYXR1cmUucHJvcGVydGllc1t0aGlzLl9yZW5kZXJlckpzb24uZmllbGQzXTtcbiAgICAgICAgaWYgKHZhbDMpIHtcbiAgICAgICAgICB2YWwgKz0gdGhpcy5fcmVuZGVyZXJKc29uLmZpZWxkRGVsaW1pdGVyICsgdmFsMztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBzeW1ib2wgPSB0aGlzLl9kZWZhdWx0U3ltYm9sO1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9zeW1ib2xzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAvLyB1c2luZyB0aGUgPT09IG9wZXJhdG9yIGRvZXMgbm90IHdvcmsgaWYgdGhlIGZpZWxkXG4gICAgICAvLyBvZiB0aGUgdW5pcXVlIHJlbmRlcmVyIGlzIG5vdCBhIHN0cmluZ1xuICAgICAgLyplc2xpbnQtZGlzYWJsZSAqL1xuICAgICAgaWYgKHRoaXMuX3N5bWJvbHNbaV0udmFsID09IHZhbCkge1xuICAgICAgICBzeW1ib2wgPSB0aGlzLl9zeW1ib2xzW2ldO1xuICAgICAgfVxuICAgICAgLyplc2xpbnQtZW5hYmxlICovXG4gICAgfVxuICAgIHJldHVybiBzeW1ib2w7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gdW5pcXVlVmFsdWVSZW5kZXJlciAocmVuZGVyZXJKc29uLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgVW5pcXVlVmFsdWVSZW5kZXJlcihyZW5kZXJlckpzb24sIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCB1bmlxdWVWYWx1ZVJlbmRlcmVyO1xuIiwiaW1wb3J0IFJlbmRlcmVyIGZyb20gJy4vUmVuZGVyZXInO1xuXG5leHBvcnQgdmFyIFNpbXBsZVJlbmRlcmVyID0gUmVuZGVyZXIuZXh0ZW5kKHtcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICAgIFJlbmRlcmVyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgcmVuZGVyZXJKc29uLCBvcHRpb25zKTtcbiAgICB0aGlzLl9jcmVhdGVTeW1ib2woKTtcbiAgfSxcblxuICBfY3JlYXRlU3ltYm9sOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX3JlbmRlcmVySnNvbi5zeW1ib2wpIHtcbiAgICAgIHRoaXMuX3N5bWJvbHMucHVzaCh0aGlzLl9uZXdTeW1ib2wodGhpcy5fcmVuZGVyZXJKc29uLnN5bWJvbCkpO1xuICAgIH1cbiAgfSxcblxuICBfZ2V0U3ltYm9sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N5bWJvbHNbMF07XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gc2ltcGxlUmVuZGVyZXIgKHJlbmRlcmVySnNvbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFNpbXBsZVJlbmRlcmVyKHJlbmRlcmVySnNvbiwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHNpbXBsZVJlbmRlcmVyO1xuIiwiaW1wb3J0IHsgY2xhc3NCcmVha3NSZW5kZXJlciB9IGZyb20gJ2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyJztcclxuaW1wb3J0IHsgdW5pcXVlVmFsdWVSZW5kZXJlciB9IGZyb20gJ2VzcmktbGVhZmxldC1yZW5kZXJlcnMvc3JjL1JlbmRlcmVycy9VbmlxdWVWYWx1ZVJlbmRlcmVyJztcclxuaW1wb3J0IHsgc2ltcGxlUmVuZGVyZXIgfSBmcm9tICdlc3JpLWxlYWZsZXQtcmVuZGVyZXJzL3NyYy9SZW5kZXJlcnMvU2ltcGxlUmVuZGVyZXInO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNldFJlbmRlcmVyIChsYXllckRlZmluaXRpb24sIGxheWVyKSB7XHJcbiAgdmFyIHJlbmQ7XHJcbiAgdmFyIHJlbmRlcmVySW5mbyA9IGxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlcjtcclxuXHJcbiAgdmFyIG9wdGlvbnMgPSB7fTtcclxuXHJcbiAgaWYgKGxheWVyLm9wdGlvbnMucGFuZSkge1xyXG4gICAgb3B0aW9ucy5wYW5lID0gbGF5ZXIub3B0aW9ucy5wYW5lO1xyXG4gIH1cclxuICBpZiAobGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeSkge1xyXG4gICAgb3B0aW9ucy5sYXllclRyYW5zcGFyZW5jeSA9IGxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby50cmFuc3BhcmVuY3k7XHJcbiAgfVxyXG4gIGlmIChsYXllci5vcHRpb25zLnN0eWxlKSB7XHJcbiAgICBvcHRpb25zLnVzZXJEZWZpbmVkU3R5bGUgPSBsYXllci5vcHRpb25zLnN0eWxlO1xyXG4gIH1cclxuXHJcbiAgc3dpdGNoIChyZW5kZXJlckluZm8udHlwZSkge1xyXG4gICAgY2FzZSAnY2xhc3NCcmVha3MnOlxyXG4gICAgICBjaGVja0ZvclByb3BvcnRpb25hbFN5bWJvbHMobGF5ZXJEZWZpbml0aW9uLmdlb21ldHJ5VHlwZSwgcmVuZGVyZXJJbmZvLCBsYXllcik7XHJcbiAgICAgIGlmIChsYXllci5faGFzUHJvcG9ydGlvbmFsU3ltYm9scykge1xyXG4gICAgICAgIGxheWVyLl9jcmVhdGVQb2ludExheWVyKCk7XHJcbiAgICAgICAgdmFyIHBSZW5kID0gY2xhc3NCcmVha3NSZW5kZXJlcihyZW5kZXJlckluZm8sIG9wdGlvbnMpO1xyXG4gICAgICAgIHBSZW5kLmF0dGFjaFN0eWxlc1RvTGF5ZXIobGF5ZXIuX3BvaW50TGF5ZXIpO1xyXG4gICAgICAgIG9wdGlvbnMucHJvcG9ydGlvbmFsUG9seWdvbiA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgICAgcmVuZCA9IGNsYXNzQnJlYWtzUmVuZGVyZXIocmVuZGVyZXJJbmZvLCBvcHRpb25zKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICd1bmlxdWVWYWx1ZSc6XHJcbiAgICAgIGNvbnNvbGUubG9nKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XHJcbiAgICAgIHJlbmQgPSB1bmlxdWVWYWx1ZVJlbmRlcmVyKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgcmVuZCA9IHNpbXBsZVJlbmRlcmVyKHJlbmRlcmVySW5mbywgb3B0aW9ucyk7XHJcbiAgfVxyXG4gIHJlbmQuYXR0YWNoU3R5bGVzVG9MYXllcihsYXllcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjaGVja0ZvclByb3BvcnRpb25hbFN5bWJvbHMgKGdlb21ldHJ5VHlwZSwgcmVuZGVyZXIsIGxheWVyKSB7XHJcbiAgbGF5ZXIuX2hhc1Byb3BvcnRpb25hbFN5bWJvbHMgPSBmYWxzZTtcclxuICBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5UG9seWdvbicpIHtcclxuICAgIGlmIChyZW5kZXJlci5iYWNrZ3JvdW5kRmlsbFN5bWJvbCkge1xyXG4gICAgICBsYXllci5faGFzUHJvcG9ydGlvbmFsU3ltYm9scyA9IHRydWU7XHJcbiAgICB9XHJcbiAgICAvLyBjaGVjayB0byBzZWUgaWYgdGhlIGZpcnN0IHN5bWJvbCBpbiB0aGUgY2xhc3NicmVha3MgaXMgYSBtYXJrZXIgc3ltYm9sXHJcbiAgICBpZiAocmVuZGVyZXIuY2xhc3NCcmVha0luZm9zICYmIHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvcy5sZW5ndGgpIHtcclxuICAgICAgdmFyIHN5bSA9IHJlbmRlcmVyLmNsYXNzQnJlYWtJbmZvc1swXS5zeW1ib2w7XHJcbiAgICAgIGlmIChzeW0gJiYgKHN5bS50eXBlID09PSAnZXNyaVNNUycgfHwgc3ltLnR5cGUgPT09ICdlc3JpUE1TJykpIHtcclxuICAgICAgICBsYXllci5faGFzUHJvcG9ydGlvbmFsU3ltYm9scyA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgUmVuZGVyZXIgPSB7XHJcbiAgc2V0UmVuZGVyZXI6IHNldFJlbmRlcmVyLFxyXG4gIGNoZWNrRm9yUHJvcG9ydGlvbmFsU3ltYm9sczogY2hlY2tGb3JQcm9wb3J0aW9uYWxTeW1ib2xzXHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBSZW5kZXJlcjtcclxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcblxyXG5pbXBvcnQgeyBhcmNnaXNUb0dlb0pTT04gfSBmcm9tICdhcmNnaXMtdG8tZ2VvanNvbi11dGlscyc7XHJcbmltcG9ydCB7IHNldFJlbmRlcmVyIH0gZnJvbSAnLi9SZW5kZXJlcic7XHJcblxyXG5leHBvcnQgdmFyIEZlYXR1cmVDb2xsZWN0aW9uID0gTC5HZW9KU09OLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgZGF0YToge30sIC8vIEVzcmkgRmVhdHVyZSBDb2xsZWN0aW9uIEpTT04gb3IgSXRlbSBJRFxyXG4gICAgb3BhY2l0eTogMVxyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXllcnMsIG9wdGlvbnMpIHtcclxuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLmRhdGEgPSB0aGlzLm9wdGlvbnMuZGF0YTtcclxuICAgIHRoaXMub3BhY2l0eSA9IHRoaXMub3B0aW9ucy5vcGFjaXR5O1xyXG4gICAgdGhpcy5wb3B1cEluZm8gPSBudWxsO1xyXG4gICAgdGhpcy5sYWJlbGluZ0luZm8gPSBudWxsO1xyXG4gICAgdGhpcy5fbGF5ZXJzID0ge307XHJcblxyXG4gICAgdmFyIGksIGxlbjtcclxuXHJcbiAgICBpZiAobGF5ZXJzKSB7XHJcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIHRoaXMuYWRkTGF5ZXIobGF5ZXJzW2ldKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgdGhpcy5kYXRhID09PSAnc3RyaW5nJykge1xyXG4gICAgICB0aGlzLl9nZXRGZWF0dXJlQ29sbGVjdGlvbih0aGlzLmRhdGEpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5fcGFyc2VGZWF0dXJlQ29sbGVjdGlvbih0aGlzLmRhdGEpO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIF9nZXRGZWF0dXJlQ29sbGVjdGlvbjogZnVuY3Rpb24gKGl0ZW1JZCkge1xyXG4gICAgdmFyIHVybCA9ICdodHRwczovL3d3dy5hcmNnaXMuY29tL3NoYXJpbmcvcmVzdC9jb250ZW50L2l0ZW1zLycgKyBpdGVtSWQgKyAnL2RhdGEnO1xyXG4gICAgTC5lc3JpLnJlcXVlc3QodXJsLCB7fSwgZnVuY3Rpb24gKGVyciwgcmVzKSB7XHJcbiAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuX3BhcnNlRmVhdHVyZUNvbGxlY3Rpb24ocmVzKTtcclxuICAgICAgfVxyXG4gICAgfSwgdGhpcyk7XHJcbiAgfSxcclxuXHJcbiAgX3BhcnNlRmVhdHVyZUNvbGxlY3Rpb246IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICB2YXIgaSwgbGVuO1xyXG4gICAgdmFyIGluZGV4ID0gMDtcclxuICAgIGZvciAoaSA9IDAsIGxlbiA9IGRhdGEubGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIGlmIChkYXRhLmxheWVyc1tpXS5mZWF0dXJlU2V0LmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBpbmRleCA9IGk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHZhciBmZWF0dXJlcyA9IGRhdGEubGF5ZXJzW2luZGV4XS5mZWF0dXJlU2V0LmZlYXR1cmVzO1xyXG4gICAgdmFyIGdlb21ldHJ5VHlwZSA9IGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24uZ2VvbWV0cnlUeXBlOyAvLyAnZXNyaUdlb21ldHJ5UG9pbnQnIHwgJ2VzcmlHZW9tZXRyeU11bHRpcG9pbnQnIHwgJ2VzcmlHZW9tZXRyeVBvbHlsaW5lJyB8ICdlc3JpR2VvbWV0cnlQb2x5Z29uJyB8ICdlc3JpR2VvbWV0cnlFbnZlbG9wZSdcclxuICAgIHZhciBvYmplY3RJZEZpZWxkID0gZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbi5vYmplY3RJZEZpZWxkO1xyXG4gICAgdmFyIGxheWVyRGVmaW5pdGlvbiA9IGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24gfHwgbnVsbDtcclxuXHJcbiAgICBpZiAoZGF0YS5sYXllcnNbaW5kZXhdLmxheWVyRGVmaW5pdGlvbi5leHRlbnQuc3BhdGlhbFJlZmVyZW5jZS53a2lkICE9PSA0MzI2KSB7XHJcbiAgICAgIGlmIChkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uLmV4dGVudC5zcGF0aWFsUmVmZXJlbmNlLndraWQgIT09IDEwMjEwMCkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tMLmVzcmkuV2ViTWFwXSB0aGlzIHdraWQgKCcgKyBkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uLmV4dGVudC5zcGF0aWFsUmVmZXJlbmNlLndraWQgKyAnKSBpcyBub3Qgc3VwcG9ydGVkLicpO1xyXG4gICAgICB9XHJcbiAgICAgIGZlYXR1cmVzID0gdGhpcy5fcHJvalRvNDMyNihmZWF0dXJlcywgZ2VvbWV0cnlUeXBlKTtcclxuICAgIH1cclxuICAgIGlmIChkYXRhLmxheWVyc1tpbmRleF0ucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5wb3B1cEluZm8gPSBkYXRhLmxheWVyc1tpbmRleF0ucG9wdXBJbmZvO1xyXG4gICAgfVxyXG4gICAgaWYgKGRhdGEubGF5ZXJzW2luZGV4XS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5sYWJlbGluZ0luZm8gPSBkYXRhLmxheWVyc1tpbmRleF0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgIH1cclxuICAgIGNvbnNvbGUubG9nKGRhdGEpO1xyXG5cclxuICAgIHZhciBnZW9qc29uID0gdGhpcy5fZmVhdHVyZUNvbGxlY3Rpb25Ub0dlb0pTT04oZmVhdHVyZXMsIG9iamVjdElkRmllbGQpO1xyXG5cclxuICAgIGlmIChsYXllckRlZmluaXRpb24gIT09IG51bGwpIHtcclxuICAgICAgc2V0UmVuZGVyZXIobGF5ZXJEZWZpbml0aW9uLCB0aGlzKTtcclxuICAgIH1cclxuICAgIGNvbnNvbGUubG9nKGdlb2pzb24pO1xyXG4gICAgdGhpcy5hZGREYXRhKGdlb2pzb24pO1xyXG4gIH0sXHJcblxyXG4gIF9wcm9qVG80MzI2OiBmdW5jdGlvbiAoZmVhdHVyZXMsIGdlb21ldHJ5VHlwZSkge1xyXG4gICAgY29uc29sZS5sb2coJ19wcm9qZWN0IScpO1xyXG4gICAgdmFyIGksIGxlbjtcclxuICAgIHZhciBwcm9qRmVhdHVyZXMgPSBbXTtcclxuXHJcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICB2YXIgZiA9IGZlYXR1cmVzW2ldO1xyXG4gICAgICB2YXIgbWVyY2F0b3JUb0xhdGxuZztcclxuICAgICAgdmFyIGosIGs7XHJcblxyXG4gICAgICBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5UG9pbnQnKSB7XHJcbiAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmLmdlb21ldHJ5LngsIGYuZ2VvbWV0cnkueSkpO1xyXG4gICAgICAgIGYuZ2VvbWV0cnkueCA9IG1lcmNhdG9yVG9MYXRsbmcubG5nO1xyXG4gICAgICAgIGYuZ2VvbWV0cnkueSA9IG1lcmNhdG9yVG9MYXRsbmcubGF0O1xyXG4gICAgICB9IGVsc2UgaWYgKGdlb21ldHJ5VHlwZSA9PT0gJ2VzcmlHZW9tZXRyeU11bHRpcG9pbnQnKSB7XHJcbiAgICAgICAgdmFyIHBsZW47XHJcblxyXG4gICAgICAgIGZvciAoaiA9IDAsIHBsZW4gPSBmLmdlb21ldHJ5LnBvaW50cy5sZW5ndGg7IGogPCBwbGVuOyBqKyspIHtcclxuICAgICAgICAgIG1lcmNhdG9yVG9MYXRsbmcgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoZi5nZW9tZXRyeS5wb2ludHNbal1bMF0sIGYuZ2VvbWV0cnkucG9pbnRzW2pdWzFdKSk7XHJcbiAgICAgICAgICBmLmdlb21ldHJ5LnBvaW50c1tqXVswXSA9IG1lcmNhdG9yVG9MYXRsbmcubG5nO1xyXG4gICAgICAgICAgZi5nZW9tZXRyeS5wb2ludHNbal1bMV0gPSBtZXJjYXRvclRvTGF0bG5nLmxhdDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5UG9seWxpbmUnKSB7XHJcbiAgICAgICAgdmFyIHBhdGhsZW4sIHBhdGhzbGVuO1xyXG5cclxuICAgICAgICBmb3IgKGogPSAwLCBwYXRoc2xlbiA9IGYuZ2VvbWV0cnkucGF0aHMubGVuZ3RoOyBqIDwgcGF0aHNsZW47IGorKykge1xyXG4gICAgICAgICAgZm9yIChrID0gMCwgcGF0aGxlbiA9IGYuZ2VvbWV0cnkucGF0aHNbal0ubGVuZ3RoOyBrIDwgcGF0aGxlbjsgaysrKSB7XHJcbiAgICAgICAgICAgIG1lcmNhdG9yVG9MYXRsbmcgPSBMLlByb2plY3Rpb24uU3BoZXJpY2FsTWVyY2F0b3IudW5wcm9qZWN0KEwucG9pbnQoZi5nZW9tZXRyeS5wYXRoc1tqXVtrXVswXSwgZi5nZW9tZXRyeS5wYXRoc1tqXVtrXVsxXSkpO1xyXG4gICAgICAgICAgICBmLmdlb21ldHJ5LnBhdGhzW2pdW2tdWzBdID0gbWVyY2F0b3JUb0xhdGxuZy5sbmc7XHJcbiAgICAgICAgICAgIGYuZ2VvbWV0cnkucGF0aHNbal1ba11bMV0gPSBtZXJjYXRvclRvTGF0bG5nLmxhdDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAoZ2VvbWV0cnlUeXBlID09PSAnZXNyaUdlb21ldHJ5UG9seWdvbicpIHtcclxuICAgICAgICB2YXIgcmluZ2xlbiwgcmluZ3NsZW47XHJcblxyXG4gICAgICAgIGZvciAoaiA9IDAsIHJpbmdzbGVuID0gZi5nZW9tZXRyeS5yaW5ncy5sZW5ndGg7IGogPCByaW5nc2xlbjsgaisrKSB7XHJcbiAgICAgICAgICBmb3IgKGsgPSAwLCByaW5nbGVuID0gZi5nZW9tZXRyeS5yaW5nc1tqXS5sZW5ndGg7IGsgPCByaW5nbGVuOyBrKyspIHtcclxuICAgICAgICAgICAgbWVyY2F0b3JUb0xhdGxuZyA9IEwuUHJvamVjdGlvbi5TcGhlcmljYWxNZXJjYXRvci51bnByb2plY3QoTC5wb2ludChmLmdlb21ldHJ5LnJpbmdzW2pdW2tdWzBdLCBmLmdlb21ldHJ5LnJpbmdzW2pdW2tdWzFdKSk7XHJcbiAgICAgICAgICAgIGYuZ2VvbWV0cnkucmluZ3Nbal1ba11bMF0gPSBtZXJjYXRvclRvTGF0bG5nLmxuZztcclxuICAgICAgICAgICAgZi5nZW9tZXRyeS5yaW5nc1tqXVtrXVsxXSA9IG1lcmNhdG9yVG9MYXRsbmcubGF0O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBwcm9qRmVhdHVyZXMucHVzaChmKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcHJvakZlYXR1cmVzO1xyXG4gIH0sXHJcblxyXG4gIF9mZWF0dXJlQ29sbGVjdGlvblRvR2VvSlNPTjogZnVuY3Rpb24gKGZlYXR1cmVzLCBvYmplY3RJZEZpZWxkKSB7XHJcbiAgICB2YXIgZ2VvanNvbkZlYXR1cmVDb2xsZWN0aW9uID0ge1xyXG4gICAgICB0eXBlOiAnRmVhdHVyZUNvbGxlY3Rpb24nLFxyXG4gICAgICBmZWF0dXJlczogW11cclxuICAgIH07XHJcbiAgICB2YXIgZmVhdHVyZXNBcnJheSA9IFtdO1xyXG4gICAgdmFyIGksIGxlbjtcclxuXHJcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICB2YXIgZ2VvanNvbiA9IGFyY2dpc1RvR2VvSlNPTihmZWF0dXJlc1tpXSwgb2JqZWN0SWRGaWVsZCk7XHJcbiAgICAgIGZlYXR1cmVzQXJyYXkucHVzaChnZW9qc29uKTtcclxuICAgIH1cclxuXHJcbiAgICBnZW9qc29uRmVhdHVyZUNvbGxlY3Rpb24uZmVhdHVyZXMgPSBmZWF0dXJlc0FycmF5O1xyXG5cclxuICAgIHJldHVybiBnZW9qc29uRmVhdHVyZUNvbGxlY3Rpb247XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBmZWF0dXJlQ29sbGVjdGlvbiAoZ2VvanNvbiwgb3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgRmVhdHVyZUNvbGxlY3Rpb24oZ2VvanNvbiwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZlYXR1cmVDb2xsZWN0aW9uO1xyXG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuXHJcbmltcG9ydCBvbW5pdm9yZSBmcm9tICdsZWFmbGV0LW9tbml2b3JlJztcclxuaW1wb3J0IHsgc2V0UmVuZGVyZXIgfSBmcm9tICcuL1JlbmRlcmVyJztcclxuXHJcbmV4cG9ydCB2YXIgQ1NWTGF5ZXIgPSBMLkdlb0pTT04uZXh0ZW5kKHtcclxuICBvcHRpb25zOiB7XHJcbiAgICB1cmw6ICcnLFxyXG4gICAgZGF0YToge30sIC8vIEVzcmkgRmVhdHVyZSBDb2xsZWN0aW9uIEpTT04gb3IgSXRlbSBJRFxyXG4gICAgb3BhY2l0eTogMVxyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXllcnMsIG9wdGlvbnMpIHtcclxuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLnVybCA9IHRoaXMub3B0aW9ucy51cmw7XHJcbiAgICB0aGlzLmxheWVyRGVmaW5pdGlvbiA9IHRoaXMub3B0aW9ucy5sYXllckRlZmluaXRpb247XHJcbiAgICB0aGlzLmxvY2F0aW9uSW5mbyA9IHRoaXMub3B0aW9ucy5sb2NhdGlvbkluZm87XHJcbiAgICB0aGlzLm9wYWNpdHkgPSB0aGlzLm9wdGlvbnMub3BhY2l0eTtcclxuICAgIHRoaXMuX2xheWVycyA9IHt9O1xyXG5cclxuICAgIHZhciBpLCBsZW47XHJcblxyXG4gICAgaWYgKGxheWVycykge1xyXG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSBsYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICB0aGlzLmFkZExheWVyKGxheWVyc1tpXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9wYXJzZUNTVih0aGlzLnVybCwgdGhpcy5sYXllckRlZmluaXRpb24sIHRoaXMubG9jYXRpb25JbmZvKTtcclxuICB9LFxyXG5cclxuICBfcGFyc2VDU1Y6IGZ1bmN0aW9uICh1cmwsIGxheWVyRGVmaW5pdGlvbiwgbG9jYXRpb25JbmZvKSB7XHJcbiAgICBvbW5pdm9yZS5jc3YodXJsLCB7XHJcbiAgICAgIGxhdGZpZWxkOiBsb2NhdGlvbkluZm8ubGF0aXR1ZGVGaWVsZE5hbWUsXHJcbiAgICAgIGxvbmZpZWxkOiBsb2NhdGlvbkluZm8ubG9uZ2l0dWRlRmllbGROYW1lXHJcbiAgICB9LCB0aGlzKTtcclxuXHJcbiAgICBzZXRSZW5kZXJlcihsYXllckRlZmluaXRpb24sIHRoaXMpO1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3N2TGF5ZXIgKGdlb2pzb24sIG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IENTVkxheWVyKGdlb2pzb24sIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBDU1ZMYXllcjtcclxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcblxyXG5pbXBvcnQgeyBhcmNnaXNUb0dlb0pTT04gfSBmcm9tICdhcmNnaXMtdG8tZ2VvanNvbi11dGlscyc7XHJcbmltcG9ydCB7IHNldFJlbmRlcmVyIH0gZnJvbSAnLi9SZW5kZXJlcic7XHJcblxyXG5leHBvcnQgdmFyIEtNTExheWVyID0gTC5HZW9KU09OLmV4dGVuZCh7XHJcbiAgb3B0aW9uczoge1xyXG4gICAgb3BhY2l0eTogMSxcclxuICAgIHVybDogJydcclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAobGF5ZXJzLCBvcHRpb25zKSB7XHJcbiAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy51cmwgPSB0aGlzLm9wdGlvbnMudXJsO1xyXG4gICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5vcHRpb25zLm9wYWNpdHk7XHJcbiAgICB0aGlzLnBvcHVwSW5mbyA9IG51bGw7XHJcbiAgICB0aGlzLmxhYmVsaW5nSW5mbyA9IG51bGw7XHJcbiAgICB0aGlzLl9sYXllcnMgPSB7fTtcclxuXHJcbiAgICB2YXIgaSwgbGVuO1xyXG5cclxuICAgIGlmIChsYXllcnMpIHtcclxuICAgICAgZm9yIChpID0gMCwgbGVuID0gbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5hZGRMYXllcihsYXllcnNbaV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fZ2V0S01MKHRoaXMudXJsKTtcclxuICB9LFxyXG5cclxuICBfZ2V0S01MOiBmdW5jdGlvbiAodXJsKSB7XHJcbiAgICB2YXIgcmVxdWVzdFVybCA9ICdodHRwOi8vdXRpbGl0eS5hcmNnaXMuY29tL3NoYXJpbmcva21sP3VybD0nICsgdXJsICsgJyZtb2RlbD1zaW1wbGUmZm9sZGVycz0mb3V0U1I9JTdCXCJ3a2lkXCIlM0E0MzI2JTdEJztcclxuICAgIEwuZXNyaS5yZXF1ZXN0KHJlcXVlc3RVcmwsIHt9LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcclxuICAgICAgaWYgKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2cocmVzKTtcclxuICAgICAgICB0aGlzLl9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uKHJlcy5mZWF0dXJlQ29sbGVjdGlvbik7XHJcbiAgICAgIH1cclxuICAgIH0sIHRoaXMpO1xyXG4gIH0sXHJcblxyXG4gIF9wYXJzZUZlYXR1cmVDb2xsZWN0aW9uOiBmdW5jdGlvbiAoZmVhdHVyZUNvbGxlY3Rpb24pIHtcclxuICAgIGNvbnNvbGUubG9nKCdfcGFyc2VGZWF0dXJlQ29sbGVjdGlvbicpO1xyXG4gICAgdmFyIGk7XHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgMzsgaSsrKSB7XHJcbiAgICAgIGlmIChmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0uZmVhdHVyZVNldC5mZWF0dXJlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coaSk7XHJcbiAgICAgICAgdmFyIGZlYXR1cmVzID0gZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmZlYXR1cmVTZXQuZmVhdHVyZXM7XHJcbiAgICAgICAgdmFyIG9iamVjdElkRmllbGQgPSBmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ubGF5ZXJEZWZpbml0aW9uLm9iamVjdElkRmllbGQ7XHJcblxyXG4gICAgICAgIHZhciBnZW9qc29uID0gdGhpcy5fZmVhdHVyZUNvbGxlY3Rpb25Ub0dlb0pTT04oZmVhdHVyZXMsIG9iamVjdElkRmllbGQpO1xyXG5cclxuICAgICAgICBpZiAoZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB0aGlzLnBvcHVwSW5mbyA9IGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5wb3B1cEluZm87XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB0aGlzLmxhYmVsaW5nSW5mbyA9IGZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2V0UmVuZGVyZXIoZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmxheWVyRGVmaW5pdGlvbiwgdGhpcyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coZ2VvanNvbik7XHJcbiAgICAgICAgdGhpcy5hZGREYXRhKGdlb2pzb24pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgX2ZlYXR1cmVDb2xsZWN0aW9uVG9HZW9KU09OOiBmdW5jdGlvbiAoZmVhdHVyZXMsIG9iamVjdElkRmllbGQpIHtcclxuICAgIHZhciBnZW9qc29uRmVhdHVyZUNvbGxlY3Rpb24gPSB7XHJcbiAgICAgIHR5cGU6ICdGZWF0dXJlQ29sbGVjdGlvbicsXHJcbiAgICAgIGZlYXR1cmVzOiBbXVxyXG4gICAgfTtcclxuICAgIHZhciBmZWF0dXJlc0FycmF5ID0gW107XHJcbiAgICB2YXIgaSwgbGVuO1xyXG5cclxuICAgIGZvciAoaSA9IDAsIGxlbiA9IGZlYXR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIHZhciBnZW9qc29uID0gYXJjZ2lzVG9HZW9KU09OKGZlYXR1cmVzW2ldLCBvYmplY3RJZEZpZWxkKTtcclxuICAgICAgZmVhdHVyZXNBcnJheS5wdXNoKGdlb2pzb24pO1xyXG4gICAgfVxyXG5cclxuICAgIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbi5mZWF0dXJlcyA9IGZlYXR1cmVzQXJyYXk7XHJcblxyXG4gICAgcmV0dXJuIGdlb2pzb25GZWF0dXJlQ29sbGVjdGlvbjtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGttbExheWVyIChnZW9qc29uLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBLTUxMYXllcihnZW9qc29uLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgS01MTGF5ZXI7XHJcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5cclxuZXhwb3J0IHZhciBMYWJlbEljb24gPSBMLkRpdkljb24uZXh0ZW5kKHtcclxuICBvcHRpb25zOiB7XHJcbiAgICBpY29uU2l6ZTogbnVsbCxcclxuICAgIGNsYXNzTmFtZTogJ2VzcmktbGVhZmxldC13ZWJtYXAtbGFiZWxzJyxcclxuICAgIHRleHQ6ICcnXHJcbiAgfSxcclxuXHJcbiAgY3JlYXRlSWNvbjogZnVuY3Rpb24gKG9sZEljb24pIHtcclxuICAgIHZhciBkaXYgPSAob2xkSWNvbiAmJiBvbGRJY29uLnRhZ05hbWUgPT09ICdESVYnKSA/IG9sZEljb24gOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xyXG5cclxuICAgIGRpdi5pbm5lckhUTUwgPSAnPGRpdiBzdHlsZT1cInBvc2l0aW9uOiByZWxhdGl2ZTsgbGVmdDogLTUwJTsgdGV4dC1zaGFkb3c6IDFweCAxcHggMHB4ICNmZmYsIC0xcHggMXB4IDBweCAjZmZmLCAxcHggLTFweCAwcHggI2ZmZiwgLTFweCAtMXB4IDBweCAjZmZmO1wiPicgKyBvcHRpb25zLnRleHQgKyAnPC9kaXY+JztcclxuXHJcbiAgICAvLyBsYWJlbC5jc3NcclxuICAgIGRpdi5zdHlsZS5mb250U2l6ZSA9ICcxZW0nO1xyXG4gICAgZGl2LnN0eWxlLmZvbnRXZWlnaHQgPSAnYm9sZCc7XHJcbiAgICBkaXYuc3R5bGUudGV4dFRyYW5zZm9ybSA9ICd1cHBlcmNhc2UnO1xyXG4gICAgZGl2LnN0eWxlLnRleHRBbGlnbiA9ICdjZW50ZXInO1xyXG4gICAgZGl2LnN0eWxlLndoaXRlU3BhY2UgPSAnbm93cmFwJztcclxuXHJcbiAgICBpZiAob3B0aW9ucy5iZ1Bvcykge1xyXG4gICAgICB2YXIgYmdQb3MgPSBMLnBvaW50KG9wdGlvbnMuYmdQb3MpO1xyXG4gICAgICBkaXYuc3R5bGUuYmFja2dyb3VuZFBvc2l0aW9uID0gKC1iZ1Bvcy54KSArICdweCAnICsgKC1iZ1Bvcy55KSArICdweCc7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9zZXRJY29uU3R5bGVzKGRpdiwgJ2ljb24nKTtcclxuXHJcbiAgICByZXR1cm4gZGl2O1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGFiZWxJY29uIChvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBMYWJlbEljb24ob3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGxhYmVsSWNvbjtcclxuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XHJcbmltcG9ydCB7IGxhYmVsSWNvbiB9IGZyb20gJy4vTGFiZWxJY29uJztcclxuXHJcbmV4cG9ydCB2YXIgTGFiZWxNYXJrZXIgPSBMLk1hcmtlci5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIHByb3BlcnRpZXM6IHt9LFxyXG4gICAgbGFiZWxpbmdJbmZvOiB7fSxcclxuICAgIG9mZnNldDogWzAsIDBdXHJcbiAgfSxcclxuXHJcbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKGxhdGxuZywgb3B0aW9ucykge1xyXG4gICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG4gICAgdGhpcy5fbGF0bG5nID0gTC5sYXRMbmcobGF0bG5nKTtcclxuXHJcbiAgICB2YXIgbGFiZWxUZXh0ID0gdGhpcy5fY3JlYXRlTGFiZWxUZXh0KHRoaXMub3B0aW9ucy5wcm9wZXJ0aWVzLCB0aGlzLm9wdGlvbnMubGFiZWxpbmdJbmZvKTtcclxuICAgIHRoaXMuX3NldExhYmVsSWNvbihsYWJlbFRleHQsIHRoaXMub3B0aW9ucy5vZmZzZXQpO1xyXG4gIH0sXHJcblxyXG4gIF9jcmVhdGVMYWJlbFRleHQ6IGZ1bmN0aW9uIChwcm9wZXJ0aWVzLCBsYWJlbGluZ0luZm8pIHtcclxuICAgIHZhciByID0gL1xcWyhbXlxcXV0qKVxcXS9nO1xyXG4gICAgdmFyIGxhYmVsVGV4dCA9IGxhYmVsaW5nSW5mb1swXS5sYWJlbEV4cHJlc3Npb247XHJcblxyXG4gICAgbGFiZWxUZXh0ID0gbGFiZWxUZXh0LnJlcGxhY2UociwgZnVuY3Rpb24gKHMpIHtcclxuICAgICAgdmFyIG0gPSByLmV4ZWMocyk7XHJcbiAgICAgIHJldHVybiBwcm9wZXJ0aWVzW21bMV1dO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGxhYmVsVGV4dDtcclxuICB9LFxyXG5cclxuICBfc2V0TGFiZWxJY29uOiBmdW5jdGlvbiAodGV4dCwgb2Zmc2V0KSB7XHJcbiAgICB2YXIgaWNvbiA9IGxhYmVsSWNvbih7XHJcbiAgICAgIHRleHQ6IHRleHQsXHJcbiAgICAgIGljb25BbmNob3I6IG9mZnNldFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zZXRJY29uKGljb24pO1xyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGFiZWxNYXJrZXIgKGxhdGxuZywgb3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgTGFiZWxNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbGFiZWxNYXJrZXI7XHJcbiIsImV4cG9ydCBmdW5jdGlvbiBwb2ludExhYmVsUG9zIChjb29yZGluYXRlcykge1xyXG4gIHZhciBsYWJlbFBvcyA9IHsgcG9zaXRpb246IFtdLCBvZmZzZXQ6IFtdIH07XHJcblxyXG4gIGxhYmVsUG9zLnBvc2l0aW9uID0gY29vcmRpbmF0ZXMucmV2ZXJzZSgpO1xyXG4gIGxhYmVsUG9zLm9mZnNldCA9IFsyMCwgMjBdO1xyXG5cclxuICByZXR1cm4gbGFiZWxQb3M7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgUG9pbnRMYWJlbCA9IHtcclxuICBwb2ludExhYmVsUG9zOiBwb2ludExhYmVsUG9zXHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBQb2ludExhYmVsO1xyXG4iLCJleHBvcnQgZnVuY3Rpb24gcG9seWxpbmVMYWJlbFBvcyAoY29vcmRpbmF0ZXMpIHtcclxuICB2YXIgbGFiZWxQb3MgPSB7IHBvc2l0aW9uOiBbXSwgb2Zmc2V0OiBbXSB9O1xyXG4gIHZhciBjZW50cmFsS2V5O1xyXG5cclxuICBjZW50cmFsS2V5ID0gTWF0aC5yb3VuZChjb29yZGluYXRlcy5sZW5ndGggLyAyKTtcclxuICBsYWJlbFBvcy5wb3NpdGlvbiA9IGNvb3JkaW5hdGVzW2NlbnRyYWxLZXldLnJldmVyc2UoKTtcclxuICBsYWJlbFBvcy5vZmZzZXQgPSBbMCwgMF07XHJcblxyXG4gIHJldHVybiBsYWJlbFBvcztcclxufVxyXG5cclxuZXhwb3J0IHZhciBQb2x5bGluZUxhYmVsID0ge1xyXG4gIHBvbHlsaW5lTGFiZWxQb3M6IHBvbHlsaW5lTGFiZWxQb3NcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBvbHlsaW5lTGFiZWw7XHJcbiIsImV4cG9ydCBmdW5jdGlvbiBwb2x5Z29uTGFiZWxQb3MgKGxheWVyLCBjb29yZGluYXRlcykge1xyXG4gIHZhciBsYWJlbFBvcyA9IHsgcG9zaXRpb246IFtdLCBvZmZzZXQ6IFtdIH07XHJcblxyXG4gIGxhYmVsUG9zLnBvc2l0aW9uID0gbGF5ZXIuZ2V0Qm91bmRzKCkuZ2V0Q2VudGVyKCk7XHJcbiAgbGFiZWxQb3Mub2Zmc2V0ID0gWzAsIDBdO1xyXG5cclxuICByZXR1cm4gbGFiZWxQb3M7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgUG9seWdvbkxhYmVsID0ge1xyXG4gIHBvbHlnb25MYWJlbFBvczogcG9seWdvbkxhYmVsUG9zXHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBQb2x5Z29uTGFiZWw7XHJcbiIsIi8qKlxuICogQG5hbWUgdG9EYXRlXG4gKiBAY2F0ZWdvcnkgQ29tbW9uIEhlbHBlcnNcbiAqIEBzdW1tYXJ5IENvbnZlcnQgdGhlIGdpdmVuIGFyZ3VtZW50IHRvIGFuIGluc3RhbmNlIG9mIERhdGUuXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBDb252ZXJ0IHRoZSBnaXZlbiBhcmd1bWVudCB0byBhbiBpbnN0YW5jZSBvZiBEYXRlLlxuICpcbiAqIElmIHRoZSBhcmd1bWVudCBpcyBhbiBpbnN0YW5jZSBvZiBEYXRlLCB0aGUgZnVuY3Rpb24gcmV0dXJucyBpdHMgY2xvbmUuXG4gKlxuICogSWYgdGhlIGFyZ3VtZW50IGlzIGEgbnVtYmVyLCBpdCBpcyB0cmVhdGVkIGFzIGEgdGltZXN0YW1wLlxuICpcbiAqIElmIHRoZSBhcmd1bWVudCBpcyBub25lIG9mIHRoZSBhYm92ZSwgdGhlIGZ1bmN0aW9uIHJldHVybnMgSW52YWxpZCBEYXRlLlxuICpcbiAqICoqTm90ZSoqOiAqYWxsKiBEYXRlIGFyZ3VtZW50cyBwYXNzZWQgdG8gYW55ICpkYXRlLWZucyogZnVuY3Rpb24gaXMgcHJvY2Vzc2VkIGJ5IGB0b0RhdGVgLlxuICpcbiAqIEBwYXJhbSB7RGF0ZXxOdW1iZXJ9IGFyZ3VtZW50IC0gdGhlIHZhbHVlIHRvIGNvbnZlcnRcbiAqIEByZXR1cm5zIHtEYXRlfSB0aGUgcGFyc2VkIGRhdGUgaW4gdGhlIGxvY2FsIHRpbWUgem9uZVxuICogQHRocm93cyB7VHlwZUVycm9yfSAxIGFyZ3VtZW50IHJlcXVpcmVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENsb25lIHRoZSBkYXRlOlxuICogY29uc3QgcmVzdWx0ID0gdG9EYXRlKG5ldyBEYXRlKDIwMTQsIDEsIDExLCAxMSwgMzAsIDMwKSlcbiAqIC8vPT4gVHVlIEZlYiAxMSAyMDE0IDExOjMwOjMwXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENvbnZlcnQgdGhlIHRpbWVzdGFtcCB0byBkYXRlOlxuICogY29uc3QgcmVzdWx0ID0gdG9EYXRlKDEzOTIwOTg0MzAwMDApXG4gKiAvLz0+IFR1ZSBGZWIgMTEgMjAxNCAxMTozMDozMFxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0b0RhdGUoYXJndW1lbnQpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAxKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgJyArIGFyZ3VtZW50cy5sZW5ndGggKyAnIHByZXNlbnQnKTtcbiAgfVxuXG4gIHZhciBhcmdTdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJndW1lbnQpOyAvLyBDbG9uZSB0aGUgZGF0ZVxuXG4gIGlmIChhcmd1bWVudCBpbnN0YW5jZW9mIERhdGUgfHwgdHlwZW9mIGFyZ3VtZW50ID09PSAnb2JqZWN0JyAmJiBhcmdTdHIgPT09ICdbb2JqZWN0IERhdGVdJykge1xuICAgIC8vIFByZXZlbnQgdGhlIGRhdGUgdG8gbG9zZSB0aGUgbWlsbGlzZWNvbmRzIHdoZW4gcGFzc2VkIHRvIG5ldyBEYXRlKCkgaW4gSUUxMFxuICAgIHJldHVybiBuZXcgRGF0ZShhcmd1bWVudC5nZXRUaW1lKCkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBhcmd1bWVudCA9PT0gJ251bWJlcicgfHwgYXJnU3RyID09PSAnW29iamVjdCBOdW1iZXJdJykge1xuICAgIHJldHVybiBuZXcgRGF0ZShhcmd1bWVudCk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKCh0eXBlb2YgYXJndW1lbnQgPT09ICdzdHJpbmcnIHx8IGFyZ1N0ciA9PT0gJ1tvYmplY3QgU3RyaW5nXScpICYmIHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgIGNvbnNvbGUud2FybihcIlN0YXJ0aW5nIHdpdGggdjIuMC4wLWJldGEuMSBkYXRlLWZucyBkb2Vzbid0IGFjY2VwdCBzdHJpbmdzIGFzIGFyZ3VtZW50cy4gUGxlYXNlIHVzZSBgcGFyc2VJU09gIHRvIHBhcnNlIHN0cmluZ3MuIFNlZTogaHR0cHM6Ly9naXQuaW8vZmp1bGVcIik7IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG5cbiAgICAgIGNvbnNvbGUud2FybihuZXcgRXJyb3IoKS5zdGFjayk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBEYXRlKE5hTik7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0b0ludGVnZXIoZGlydHlOdW1iZXIpIHtcbiAgaWYgKGRpcnR5TnVtYmVyID09PSBudWxsIHx8IGRpcnR5TnVtYmVyID09PSB0cnVlIHx8IGRpcnR5TnVtYmVyID09PSBmYWxzZSkge1xuICAgIHJldHVybiBOYU47XG4gIH1cblxuICB2YXIgbnVtYmVyID0gTnVtYmVyKGRpcnR5TnVtYmVyKTtcblxuICBpZiAoaXNOYU4obnVtYmVyKSkge1xuICAgIHJldHVybiBudW1iZXI7XG4gIH1cblxuICByZXR1cm4gbnVtYmVyIDwgMCA/IE1hdGguY2VpbChudW1iZXIpIDogTWF0aC5mbG9vcihudW1iZXIpO1xufSIsImltcG9ydCB0b0ludGVnZXIgZnJvbSAnLi4vX2xpYi90b0ludGVnZXIvaW5kZXguanMnO1xuaW1wb3J0IHRvRGF0ZSBmcm9tICcuLi90b0RhdGUvaW5kZXguanMnO1xuLyoqXG4gKiBAbmFtZSBhZGRNaWxsaXNlY29uZHNcbiAqIEBjYXRlZ29yeSBNaWxsaXNlY29uZCBIZWxwZXJzXG4gKiBAc3VtbWFyeSBBZGQgdGhlIHNwZWNpZmllZCBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHRoZSBnaXZlbiBkYXRlLlxuICpcbiAqIEBkZXNjcmlwdGlvblxuICogQWRkIHRoZSBzcGVjaWZpZWQgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byB0aGUgZ2l2ZW4gZGF0ZS5cbiAqXG4gKiAjIyMgdjIuMC4wIGJyZWFraW5nIGNoYW5nZXM6XG4gKlxuICogLSBbQ2hhbmdlcyB0aGF0IGFyZSBjb21tb24gZm9yIHRoZSB3aG9sZSBsaWJyYXJ5XShodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvYmxvYi9tYXN0ZXIvZG9jcy91cGdyYWRlR3VpZGUubWQjQ29tbW9uLUNoYW5nZXMpLlxuICpcbiAqIEBwYXJhbSB7RGF0ZXxOdW1iZXJ9IGRhdGUgLSB0aGUgZGF0ZSB0byBiZSBjaGFuZ2VkXG4gKiBAcGFyYW0ge051bWJlcn0gYW1vdW50IC0gdGhlIGFtb3VudCBvZiBtaWxsaXNlY29uZHMgdG8gYmUgYWRkZWRcbiAqIEByZXR1cm5zIHtEYXRlfSB0aGUgbmV3IGRhdGUgd2l0aCB0aGUgbWlsbGlzZWNvbmRzIGFkZGVkXG4gKiBAdGhyb3dzIHtUeXBlRXJyb3J9IDIgYXJndW1lbnRzIHJlcXVpcmVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEFkZCA3NTAgbWlsbGlzZWNvbmRzIHRvIDEwIEp1bHkgMjAxNCAxMjo0NTozMC4wMDA6XG4gKiB2YXIgcmVzdWx0ID0gYWRkTWlsbGlzZWNvbmRzKG5ldyBEYXRlKDIwMTQsIDYsIDEwLCAxMiwgNDUsIDMwLCAwKSwgNzUwKVxuICogLy89PiBUaHUgSnVsIDEwIDIwMTQgMTI6NDU6MzAuNzUwXG4gKi9cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYWRkTWlsbGlzZWNvbmRzKGRpcnR5RGF0ZSwgZGlydHlBbW91bnQpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMiBhcmd1bWVudHMgcmVxdWlyZWQsIGJ1dCBvbmx5ICcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBwcmVzZW50Jyk7XG4gIH1cblxuICB2YXIgdGltZXN0YW1wID0gdG9EYXRlKGRpcnR5RGF0ZSkuZ2V0VGltZSgpO1xuICB2YXIgYW1vdW50ID0gdG9JbnRlZ2VyKGRpcnR5QW1vdW50KTtcbiAgcmV0dXJuIG5ldyBEYXRlKHRpbWVzdGFtcCArIGFtb3VudCk7XG59IiwidmFyIE1JTExJU0VDT05EU19JTl9NSU5VVEUgPSA2MDAwMDtcbi8qKlxuICogR29vZ2xlIENocm9tZSBhcyBvZiA2Ny4wLjMzOTYuODcgaW50cm9kdWNlZCB0aW1lem9uZXMgd2l0aCBvZmZzZXQgdGhhdCBpbmNsdWRlcyBzZWNvbmRzLlxuICogVGhleSB1c3VhbGx5IGFwcGVhciBmb3IgZGF0ZXMgdGhhdCBkZW5vdGUgdGltZSBiZWZvcmUgdGhlIHRpbWV6b25lcyB3ZXJlIGludHJvZHVjZWRcbiAqIChlLmcuIGZvciAnRXVyb3BlL1ByYWd1ZScgdGltZXpvbmUgdGhlIG9mZnNldCBpcyBHTVQrMDA6NTc6NDQgYmVmb3JlIDEgT2N0b2JlciAxODkxXG4gKiBhbmQgR01UKzAxOjAwOjAwIGFmdGVyIHRoYXQgZGF0ZSlcbiAqXG4gKiBEYXRlI2dldFRpbWV6b25lT2Zmc2V0IHJldHVybnMgdGhlIG9mZnNldCBpbiBtaW51dGVzIGFuZCB3b3VsZCByZXR1cm4gNTcgZm9yIHRoZSBleGFtcGxlIGFib3ZlLFxuICogd2hpY2ggd291bGQgbGVhZCB0byBpbmNvcnJlY3QgY2FsY3VsYXRpb25zLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgdGltZXpvbmUgb2Zmc2V0IGluIG1pbGxpc2Vjb25kcyB0aGF0IHRha2VzIHNlY29uZHMgaW4gYWNjb3VudC5cbiAqL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRUaW1lem9uZU9mZnNldEluTWlsbGlzZWNvbmRzKGRpcnR5RGF0ZSkge1xuICB2YXIgZGF0ZSA9IG5ldyBEYXRlKGRpcnR5RGF0ZS5nZXRUaW1lKCkpO1xuICB2YXIgYmFzZVRpbWV6b25lT2Zmc2V0ID0gZGF0ZS5nZXRUaW1lem9uZU9mZnNldCgpO1xuICBkYXRlLnNldFNlY29uZHMoMCwgMCk7XG4gIHZhciBtaWxsaXNlY29uZHNQYXJ0T2ZUaW1lem9uZU9mZnNldCA9IGRhdGUuZ2V0VGltZSgpICUgTUlMTElTRUNPTkRTX0lOX01JTlVURTtcbiAgcmV0dXJuIGJhc2VUaW1lem9uZU9mZnNldCAqIE1JTExJU0VDT05EU19JTl9NSU5VVEUgKyBtaWxsaXNlY29uZHNQYXJ0T2ZUaW1lem9uZU9mZnNldDtcbn0iLCJpbXBvcnQgdG9EYXRlIGZyb20gJy4uL3RvRGF0ZS9pbmRleC5qcyc7XG4vKipcbiAqIEBuYW1lIGlzVmFsaWRcbiAqIEBjYXRlZ29yeSBDb21tb24gSGVscGVyc1xuICogQHN1bW1hcnkgSXMgdGhlIGdpdmVuIGRhdGUgdmFsaWQ/XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBSZXR1cm5zIGZhbHNlIGlmIGFyZ3VtZW50IGlzIEludmFsaWQgRGF0ZSBhbmQgdHJ1ZSBvdGhlcndpc2UuXG4gKiBBcmd1bWVudCBpcyBjb252ZXJ0ZWQgdG8gRGF0ZSB1c2luZyBgdG9EYXRlYC4gU2VlIFt0b0RhdGVde0BsaW5rIGh0dHBzOi8vZGF0ZS1mbnMub3JnL2RvY3MvdG9EYXRlfVxuICogSW52YWxpZCBEYXRlIGlzIGEgRGF0ZSwgd2hvc2UgdGltZSB2YWx1ZSBpcyBOYU4uXG4gKlxuICogVGltZSB2YWx1ZSBvZiBEYXRlOiBodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDE1LjkuMS4xXG4gKlxuICogIyMjIHYyLjAuMCBicmVha2luZyBjaGFuZ2VzOlxuICpcbiAqIC0gW0NoYW5nZXMgdGhhdCBhcmUgY29tbW9uIGZvciB0aGUgd2hvbGUgbGlicmFyeV0oaHR0cHM6Ly9naXRodWIuY29tL2RhdGUtZm5zL2RhdGUtZm5zL2Jsb2IvbWFzdGVyL2RvY3MvdXBncmFkZUd1aWRlLm1kI0NvbW1vbi1DaGFuZ2VzKS5cbiAqXG4gKiAtIE5vdyBgaXNWYWxpZGAgZG9lc24ndCB0aHJvdyBhbiBleGNlcHRpb25cbiAqICAgaWYgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRlLlxuICogICBJbnN0ZWFkLCBhcmd1bWVudCBpcyBjb252ZXJ0ZWQgYmVmb3JlaGFuZCB1c2luZyBgdG9EYXRlYC5cbiAqXG4gKiAgIEV4YW1wbGVzOlxuICpcbiAqICAgfCBgaXNWYWxpZGAgYXJndW1lbnQgICAgICAgIHwgQmVmb3JlIHYyLjAuMCB8IHYyLjAuMCBvbndhcmQgfFxuICogICB8LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLS18XG4gKiAgIHwgYG5ldyBEYXRlKClgICAgICAgICAgICAgICB8IGB0cnVlYCAgICAgICAgfCBgdHJ1ZWAgICAgICAgIHxcbiAqICAgfCBgbmV3IERhdGUoJzIwMTYtMDEtMDEnKWAgIHwgYHRydWVgICAgICAgICB8IGB0cnVlYCAgICAgICAgfFxuICogICB8IGBuZXcgRGF0ZSgnJylgICAgICAgICAgICAgfCBgZmFsc2VgICAgICAgIHwgYGZhbHNlYCAgICAgICB8XG4gKiAgIHwgYG5ldyBEYXRlKDE0ODgzNzA4MzUwODEpYCB8IGB0cnVlYCAgICAgICAgfCBgdHJ1ZWAgICAgICAgIHxcbiAqICAgfCBgbmV3IERhdGUoTmFOKWAgICAgICAgICAgIHwgYGZhbHNlYCAgICAgICB8IGBmYWxzZWAgICAgICAgfFxuICogICB8IGAnMjAxNi0wMS0wMSdgICAgICAgICAgICAgfCBgVHlwZUVycm9yYCAgIHwgYGZhbHNlYCAgICAgICB8XG4gKiAgIHwgYCcnYCAgICAgICAgICAgICAgICAgICAgICB8IGBUeXBlRXJyb3JgICAgfCBgZmFsc2VgICAgICAgIHxcbiAqICAgfCBgMTQ4ODM3MDgzNTA4MWAgICAgICAgICAgIHwgYFR5cGVFcnJvcmAgICB8IGB0cnVlYCAgICAgICAgfFxuICogICB8IGBOYU5gICAgICAgICAgICAgICAgICAgICAgfCBgVHlwZUVycm9yYCAgIHwgYGZhbHNlYCAgICAgICB8XG4gKlxuICogICBXZSBpbnRyb2R1Y2UgdGhpcyBjaGFuZ2UgdG8gbWFrZSAqZGF0ZS1mbnMqIGNvbnNpc3RlbnQgd2l0aCBFQ01BU2NyaXB0IGJlaGF2aW9yXG4gKiAgIHRoYXQgdHJ5IHRvIGNvZXJjZSBhcmd1bWVudHMgdG8gdGhlIGV4cGVjdGVkIHR5cGVcbiAqICAgKHdoaWNoIGlzIGFsc28gdGhlIGNhc2Ugd2l0aCBvdGhlciAqZGF0ZS1mbnMqIGZ1bmN0aW9ucykuXG4gKlxuICogQHBhcmFtIHsqfSBkYXRlIC0gdGhlIGRhdGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtCb29sZWFufSB0aGUgZGF0ZSBpcyB2YWxpZFxuICogQHRocm93cyB7VHlwZUVycm9yfSAxIGFyZ3VtZW50IHJlcXVpcmVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEZvciB0aGUgdmFsaWQgZGF0ZTpcbiAqIHZhciByZXN1bHQgPSBpc1ZhbGlkKG5ldyBEYXRlKDIwMTQsIDEsIDMxKSlcbiAqIC8vPT4gdHJ1ZVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBGb3IgdGhlIHZhbHVlLCBjb252ZXJ0YWJsZSBpbnRvIGEgZGF0ZTpcbiAqIHZhciByZXN1bHQgPSBpc1ZhbGlkKDEzOTM4MDQ4MDAwMDApXG4gKiAvLz0+IHRydWVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRm9yIHRoZSBpbnZhbGlkIGRhdGU6XG4gKiB2YXIgcmVzdWx0ID0gaXNWYWxpZChuZXcgRGF0ZSgnJykpXG4gKiAvLz0+IGZhbHNlXG4gKi9cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaXNWYWxpZChkaXJ0eURhdGUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAxKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgJyArIGFyZ3VtZW50cy5sZW5ndGggKyAnIHByZXNlbnQnKTtcbiAgfVxuXG4gIHZhciBkYXRlID0gdG9EYXRlKGRpcnR5RGF0ZSk7XG4gIHJldHVybiAhaXNOYU4oZGF0ZSk7XG59IiwidmFyIGZvcm1hdERpc3RhbmNlTG9jYWxlID0ge1xuICBsZXNzVGhhblhTZWNvbmRzOiB7XG4gICAgb25lOiAnbGVzcyB0aGFuIGEgc2Vjb25kJyxcbiAgICBvdGhlcjogJ2xlc3MgdGhhbiB7e2NvdW50fX0gc2Vjb25kcydcbiAgfSxcbiAgeFNlY29uZHM6IHtcbiAgICBvbmU6ICcxIHNlY29uZCcsXG4gICAgb3RoZXI6ICd7e2NvdW50fX0gc2Vjb25kcydcbiAgfSxcbiAgaGFsZkFNaW51dGU6ICdoYWxmIGEgbWludXRlJyxcbiAgbGVzc1RoYW5YTWludXRlczoge1xuICAgIG9uZTogJ2xlc3MgdGhhbiBhIG1pbnV0ZScsXG4gICAgb3RoZXI6ICdsZXNzIHRoYW4ge3tjb3VudH19IG1pbnV0ZXMnXG4gIH0sXG4gIHhNaW51dGVzOiB7XG4gICAgb25lOiAnMSBtaW51dGUnLFxuICAgIG90aGVyOiAne3tjb3VudH19IG1pbnV0ZXMnXG4gIH0sXG4gIGFib3V0WEhvdXJzOiB7XG4gICAgb25lOiAnYWJvdXQgMSBob3VyJyxcbiAgICBvdGhlcjogJ2Fib3V0IHt7Y291bnR9fSBob3VycydcbiAgfSxcbiAgeEhvdXJzOiB7XG4gICAgb25lOiAnMSBob3VyJyxcbiAgICBvdGhlcjogJ3t7Y291bnR9fSBob3VycydcbiAgfSxcbiAgeERheXM6IHtcbiAgICBvbmU6ICcxIGRheScsXG4gICAgb3RoZXI6ICd7e2NvdW50fX0gZGF5cydcbiAgfSxcbiAgYWJvdXRYTW9udGhzOiB7XG4gICAgb25lOiAnYWJvdXQgMSBtb250aCcsXG4gICAgb3RoZXI6ICdhYm91dCB7e2NvdW50fX0gbW9udGhzJ1xuICB9LFxuICB4TW9udGhzOiB7XG4gICAgb25lOiAnMSBtb250aCcsXG4gICAgb3RoZXI6ICd7e2NvdW50fX0gbW9udGhzJ1xuICB9LFxuICBhYm91dFhZZWFyczoge1xuICAgIG9uZTogJ2Fib3V0IDEgeWVhcicsXG4gICAgb3RoZXI6ICdhYm91dCB7e2NvdW50fX0geWVhcnMnXG4gIH0sXG4gIHhZZWFyczoge1xuICAgIG9uZTogJzEgeWVhcicsXG4gICAgb3RoZXI6ICd7e2NvdW50fX0geWVhcnMnXG4gIH0sXG4gIG92ZXJYWWVhcnM6IHtcbiAgICBvbmU6ICdvdmVyIDEgeWVhcicsXG4gICAgb3RoZXI6ICdvdmVyIHt7Y291bnR9fSB5ZWFycydcbiAgfSxcbiAgYWxtb3N0WFllYXJzOiB7XG4gICAgb25lOiAnYWxtb3N0IDEgeWVhcicsXG4gICAgb3RoZXI6ICdhbG1vc3Qge3tjb3VudH19IHllYXJzJ1xuICB9XG59O1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZm9ybWF0RGlzdGFuY2UodG9rZW4sIGNvdW50LCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgcmVzdWx0O1xuXG4gIGlmICh0eXBlb2YgZm9ybWF0RGlzdGFuY2VMb2NhbGVbdG9rZW5dID09PSAnc3RyaW5nJykge1xuICAgIHJlc3VsdCA9IGZvcm1hdERpc3RhbmNlTG9jYWxlW3Rva2VuXTtcbiAgfSBlbHNlIGlmIChjb3VudCA9PT0gMSkge1xuICAgIHJlc3VsdCA9IGZvcm1hdERpc3RhbmNlTG9jYWxlW3Rva2VuXS5vbmU7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0gZm9ybWF0RGlzdGFuY2VMb2NhbGVbdG9rZW5dLm90aGVyLnJlcGxhY2UoJ3t7Y291bnR9fScsIGNvdW50KTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmFkZFN1ZmZpeCkge1xuICAgIGlmIChvcHRpb25zLmNvbXBhcmlzb24gPiAwKSB7XG4gICAgICByZXR1cm4gJ2luICcgKyByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQgKyAnIGFnbyc7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBidWlsZEZvcm1hdExvbmdGbihhcmdzKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZGlydHlPcHRpb25zKSB7XG4gICAgdmFyIG9wdGlvbnMgPSBkaXJ0eU9wdGlvbnMgfHwge307XG4gICAgdmFyIHdpZHRoID0gb3B0aW9ucy53aWR0aCA/IFN0cmluZyhvcHRpb25zLndpZHRoKSA6IGFyZ3MuZGVmYXVsdFdpZHRoO1xuICAgIHZhciBmb3JtYXQgPSBhcmdzLmZvcm1hdHNbd2lkdGhdIHx8IGFyZ3MuZm9ybWF0c1thcmdzLmRlZmF1bHRXaWR0aF07XG4gICAgcmV0dXJuIGZvcm1hdDtcbiAgfTtcbn0iLCJpbXBvcnQgYnVpbGRGb3JtYXRMb25nRm4gZnJvbSAnLi4vLi4vLi4vX2xpYi9idWlsZEZvcm1hdExvbmdGbi9pbmRleC5qcyc7XG52YXIgZGF0ZUZvcm1hdHMgPSB7XG4gIGZ1bGw6ICdFRUVFLCBNTU1NIGRvLCB5JyxcbiAgbG9uZzogJ01NTU0gZG8sIHknLFxuICBtZWRpdW06ICdNTU0gZCwgeScsXG4gIHNob3J0OiAnTU0vZGQveXl5eSdcbn07XG52YXIgdGltZUZvcm1hdHMgPSB7XG4gIGZ1bGw6ICdoOm1tOnNzIGEgenp6eicsXG4gIGxvbmc6ICdoOm1tOnNzIGEgeicsXG4gIG1lZGl1bTogJ2g6bW06c3MgYScsXG4gIHNob3J0OiAnaDptbSBhJ1xufTtcbnZhciBkYXRlVGltZUZvcm1hdHMgPSB7XG4gIGZ1bGw6IFwie3tkYXRlfX0gJ2F0JyB7e3RpbWV9fVwiLFxuICBsb25nOiBcInt7ZGF0ZX19ICdhdCcge3t0aW1lfX1cIixcbiAgbWVkaXVtOiAne3tkYXRlfX0sIHt7dGltZX19JyxcbiAgc2hvcnQ6ICd7e2RhdGV9fSwge3t0aW1lfX0nXG59O1xudmFyIGZvcm1hdExvbmcgPSB7XG4gIGRhdGU6IGJ1aWxkRm9ybWF0TG9uZ0ZuKHtcbiAgICBmb3JtYXRzOiBkYXRlRm9ybWF0cyxcbiAgICBkZWZhdWx0V2lkdGg6ICdmdWxsJ1xuICB9KSxcbiAgdGltZTogYnVpbGRGb3JtYXRMb25nRm4oe1xuICAgIGZvcm1hdHM6IHRpbWVGb3JtYXRzLFxuICAgIGRlZmF1bHRXaWR0aDogJ2Z1bGwnXG4gIH0pLFxuICBkYXRlVGltZTogYnVpbGRGb3JtYXRMb25nRm4oe1xuICAgIGZvcm1hdHM6IGRhdGVUaW1lRm9ybWF0cyxcbiAgICBkZWZhdWx0V2lkdGg6ICdmdWxsJ1xuICB9KVxufTtcbmV4cG9ydCBkZWZhdWx0IGZvcm1hdExvbmc7IiwidmFyIGZvcm1hdFJlbGF0aXZlTG9jYWxlID0ge1xuICBsYXN0V2VlazogXCInbGFzdCcgZWVlZSAnYXQnIHBcIixcbiAgeWVzdGVyZGF5OiBcIid5ZXN0ZXJkYXkgYXQnIHBcIixcbiAgdG9kYXk6IFwiJ3RvZGF5IGF0JyBwXCIsXG4gIHRvbW9ycm93OiBcIid0b21vcnJvdyBhdCcgcFwiLFxuICBuZXh0V2VlazogXCJlZWVlICdhdCcgcFwiLFxuICBvdGhlcjogJ1AnXG59O1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZm9ybWF0UmVsYXRpdmUodG9rZW4sIF9kYXRlLCBfYmFzZURhdGUsIF9vcHRpb25zKSB7XG4gIHJldHVybiBmb3JtYXRSZWxhdGl2ZUxvY2FsZVt0b2tlbl07XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYnVpbGRMb2NhbGl6ZUZuKGFyZ3MpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkaXJ0eUluZGV4LCBkaXJ0eU9wdGlvbnMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IGRpcnR5T3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgY29udGV4dCA9IG9wdGlvbnMuY29udGV4dCA/IFN0cmluZyhvcHRpb25zLmNvbnRleHQpIDogJ3N0YW5kYWxvbmUnO1xuICAgIHZhciB2YWx1ZXNBcnJheTtcblxuICAgIGlmIChjb250ZXh0ID09PSAnZm9ybWF0dGluZycgJiYgYXJncy5mb3JtYXR0aW5nVmFsdWVzKSB7XG4gICAgICB2YXIgZGVmYXVsdFdpZHRoID0gYXJncy5kZWZhdWx0Rm9ybWF0dGluZ1dpZHRoIHx8IGFyZ3MuZGVmYXVsdFdpZHRoO1xuICAgICAgdmFyIHdpZHRoID0gb3B0aW9ucy53aWR0aCA/IFN0cmluZyhvcHRpb25zLndpZHRoKSA6IGRlZmF1bHRXaWR0aDtcbiAgICAgIHZhbHVlc0FycmF5ID0gYXJncy5mb3JtYXR0aW5nVmFsdWVzW3dpZHRoXSB8fCBhcmdzLmZvcm1hdHRpbmdWYWx1ZXNbZGVmYXVsdFdpZHRoXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIF9kZWZhdWx0V2lkdGggPSBhcmdzLmRlZmF1bHRXaWR0aDtcblxuICAgICAgdmFyIF93aWR0aCA9IG9wdGlvbnMud2lkdGggPyBTdHJpbmcob3B0aW9ucy53aWR0aCkgOiBhcmdzLmRlZmF1bHRXaWR0aDtcblxuICAgICAgdmFsdWVzQXJyYXkgPSBhcmdzLnZhbHVlc1tfd2lkdGhdIHx8IGFyZ3MudmFsdWVzW19kZWZhdWx0V2lkdGhdO1xuICAgIH1cblxuICAgIHZhciBpbmRleCA9IGFyZ3MuYXJndW1lbnRDYWxsYmFjayA/IGFyZ3MuYXJndW1lbnRDYWxsYmFjayhkaXJ0eUluZGV4KSA6IGRpcnR5SW5kZXg7XG4gICAgcmV0dXJuIHZhbHVlc0FycmF5W2luZGV4XTtcbiAgfTtcbn0iLCJpbXBvcnQgYnVpbGRMb2NhbGl6ZUZuIGZyb20gJy4uLy4uLy4uL19saWIvYnVpbGRMb2NhbGl6ZUZuL2luZGV4LmpzJztcbnZhciBlcmFWYWx1ZXMgPSB7XG4gIG5hcnJvdzogWydCJywgJ0EnXSxcbiAgYWJicmV2aWF0ZWQ6IFsnQkMnLCAnQUQnXSxcbiAgd2lkZTogWydCZWZvcmUgQ2hyaXN0JywgJ0Fubm8gRG9taW5pJ11cbn07XG52YXIgcXVhcnRlclZhbHVlcyA9IHtcbiAgbmFycm93OiBbJzEnLCAnMicsICczJywgJzQnXSxcbiAgYWJicmV2aWF0ZWQ6IFsnUTEnLCAnUTInLCAnUTMnLCAnUTQnXSxcbiAgd2lkZTogWycxc3QgcXVhcnRlcicsICcybmQgcXVhcnRlcicsICczcmQgcXVhcnRlcicsICc0dGggcXVhcnRlciddIC8vIE5vdGU6IGluIEVuZ2xpc2gsIHRoZSBuYW1lcyBvZiBkYXlzIG9mIHRoZSB3ZWVrIGFuZCBtb250aHMgYXJlIGNhcGl0YWxpemVkLlxuICAvLyBJZiB5b3UgYXJlIG1ha2luZyBhIG5ldyBsb2NhbGUgYmFzZWQgb24gdGhpcyBvbmUsIGNoZWNrIGlmIHRoZSBzYW1lIGlzIHRydWUgZm9yIHRoZSBsYW5ndWFnZSB5b3UncmUgd29ya2luZyBvbi5cbiAgLy8gR2VuZXJhbGx5LCBmb3JtYXR0ZWQgZGF0ZXMgc2hvdWxkIGxvb2sgbGlrZSB0aGV5IGFyZSBpbiB0aGUgbWlkZGxlIG9mIGEgc2VudGVuY2UsXG4gIC8vIGUuZy4gaW4gU3BhbmlzaCBsYW5ndWFnZSB0aGUgd2Vla2RheXMgYW5kIG1vbnRocyBzaG91bGQgYmUgaW4gdGhlIGxvd2VyY2FzZS5cblxufTtcbnZhciBtb250aFZhbHVlcyA9IHtcbiAgbmFycm93OiBbJ0onLCAnRicsICdNJywgJ0EnLCAnTScsICdKJywgJ0onLCAnQScsICdTJywgJ08nLCAnTicsICdEJ10sXG4gIGFiYnJldmlhdGVkOiBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ10sXG4gIHdpZGU6IFsnSmFudWFyeScsICdGZWJydWFyeScsICdNYXJjaCcsICdBcHJpbCcsICdNYXknLCAnSnVuZScsICdKdWx5JywgJ0F1Z3VzdCcsICdTZXB0ZW1iZXInLCAnT2N0b2JlcicsICdOb3ZlbWJlcicsICdEZWNlbWJlciddXG59O1xudmFyIGRheVZhbHVlcyA9IHtcbiAgbmFycm93OiBbJ1MnLCAnTScsICdUJywgJ1cnLCAnVCcsICdGJywgJ1MnXSxcbiAgc2hvcnQ6IFsnU3UnLCAnTW8nLCAnVHUnLCAnV2UnLCAnVGgnLCAnRnInLCAnU2EnXSxcbiAgYWJicmV2aWF0ZWQ6IFsnU3VuJywgJ01vbicsICdUdWUnLCAnV2VkJywgJ1RodScsICdGcmknLCAnU2F0J10sXG4gIHdpZGU6IFsnU3VuZGF5JywgJ01vbmRheScsICdUdWVzZGF5JywgJ1dlZG5lc2RheScsICdUaHVyc2RheScsICdGcmlkYXknLCAnU2F0dXJkYXknXVxufTtcbnZhciBkYXlQZXJpb2RWYWx1ZXMgPSB7XG4gIG5hcnJvdzoge1xuICAgIGFtOiAnYScsXG4gICAgcG06ICdwJyxcbiAgICBtaWRuaWdodDogJ21pJyxcbiAgICBub29uOiAnbicsXG4gICAgbW9ybmluZzogJ21vcm5pbmcnLFxuICAgIGFmdGVybm9vbjogJ2FmdGVybm9vbicsXG4gICAgZXZlbmluZzogJ2V2ZW5pbmcnLFxuICAgIG5pZ2h0OiAnbmlnaHQnXG4gIH0sXG4gIGFiYnJldmlhdGVkOiB7XG4gICAgYW06ICdBTScsXG4gICAgcG06ICdQTScsXG4gICAgbWlkbmlnaHQ6ICdtaWRuaWdodCcsXG4gICAgbm9vbjogJ25vb24nLFxuICAgIG1vcm5pbmc6ICdtb3JuaW5nJyxcbiAgICBhZnRlcm5vb246ICdhZnRlcm5vb24nLFxuICAgIGV2ZW5pbmc6ICdldmVuaW5nJyxcbiAgICBuaWdodDogJ25pZ2h0J1xuICB9LFxuICB3aWRlOiB7XG4gICAgYW06ICdhLm0uJyxcbiAgICBwbTogJ3AubS4nLFxuICAgIG1pZG5pZ2h0OiAnbWlkbmlnaHQnLFxuICAgIG5vb246ICdub29uJyxcbiAgICBtb3JuaW5nOiAnbW9ybmluZycsXG4gICAgYWZ0ZXJub29uOiAnYWZ0ZXJub29uJyxcbiAgICBldmVuaW5nOiAnZXZlbmluZycsXG4gICAgbmlnaHQ6ICduaWdodCdcbiAgfVxufTtcbnZhciBmb3JtYXR0aW5nRGF5UGVyaW9kVmFsdWVzID0ge1xuICBuYXJyb3c6IHtcbiAgICBhbTogJ2EnLFxuICAgIHBtOiAncCcsXG4gICAgbWlkbmlnaHQ6ICdtaScsXG4gICAgbm9vbjogJ24nLFxuICAgIG1vcm5pbmc6ICdpbiB0aGUgbW9ybmluZycsXG4gICAgYWZ0ZXJub29uOiAnaW4gdGhlIGFmdGVybm9vbicsXG4gICAgZXZlbmluZzogJ2luIHRoZSBldmVuaW5nJyxcbiAgICBuaWdodDogJ2F0IG5pZ2h0J1xuICB9LFxuICBhYmJyZXZpYXRlZDoge1xuICAgIGFtOiAnQU0nLFxuICAgIHBtOiAnUE0nLFxuICAgIG1pZG5pZ2h0OiAnbWlkbmlnaHQnLFxuICAgIG5vb246ICdub29uJyxcbiAgICBtb3JuaW5nOiAnaW4gdGhlIG1vcm5pbmcnLFxuICAgIGFmdGVybm9vbjogJ2luIHRoZSBhZnRlcm5vb24nLFxuICAgIGV2ZW5pbmc6ICdpbiB0aGUgZXZlbmluZycsXG4gICAgbmlnaHQ6ICdhdCBuaWdodCdcbiAgfSxcbiAgd2lkZToge1xuICAgIGFtOiAnYS5tLicsXG4gICAgcG06ICdwLm0uJyxcbiAgICBtaWRuaWdodDogJ21pZG5pZ2h0JyxcbiAgICBub29uOiAnbm9vbicsXG4gICAgbW9ybmluZzogJ2luIHRoZSBtb3JuaW5nJyxcbiAgICBhZnRlcm5vb246ICdpbiB0aGUgYWZ0ZXJub29uJyxcbiAgICBldmVuaW5nOiAnaW4gdGhlIGV2ZW5pbmcnLFxuICAgIG5pZ2h0OiAnYXQgbmlnaHQnXG4gIH1cbn07XG5cbmZ1bmN0aW9uIG9yZGluYWxOdW1iZXIoZGlydHlOdW1iZXIsIF9kaXJ0eU9wdGlvbnMpIHtcbiAgdmFyIG51bWJlciA9IE51bWJlcihkaXJ0eU51bWJlcik7IC8vIElmIG9yZGluYWwgbnVtYmVycyBkZXBlbmQgb24gY29udGV4dCwgZm9yIGV4YW1wbGUsXG4gIC8vIGlmIHRoZXkgYXJlIGRpZmZlcmVudCBmb3IgZGlmZmVyZW50IGdyYW1tYXRpY2FsIGdlbmRlcnMsXG4gIC8vIHVzZSBgb3B0aW9ucy51bml0YDpcbiAgLy9cbiAgLy8gICB2YXIgb3B0aW9ucyA9IGRpcnR5T3B0aW9ucyB8fCB7fVxuICAvLyAgIHZhciB1bml0ID0gU3RyaW5nKG9wdGlvbnMudW5pdClcbiAgLy9cbiAgLy8gd2hlcmUgYHVuaXRgIGNhbiBiZSAneWVhcicsICdxdWFydGVyJywgJ21vbnRoJywgJ3dlZWsnLCAnZGF0ZScsICdkYXlPZlllYXInLFxuICAvLyAnZGF5JywgJ2hvdXInLCAnbWludXRlJywgJ3NlY29uZCdcblxuICB2YXIgcmVtMTAwID0gbnVtYmVyICUgMTAwO1xuXG4gIGlmIChyZW0xMDAgPiAyMCB8fCByZW0xMDAgPCAxMCkge1xuICAgIHN3aXRjaCAocmVtMTAwICUgMTApIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgcmV0dXJuIG51bWJlciArICdzdCc7XG5cbiAgICAgIGNhc2UgMjpcbiAgICAgICAgcmV0dXJuIG51bWJlciArICduZCc7XG5cbiAgICAgIGNhc2UgMzpcbiAgICAgICAgcmV0dXJuIG51bWJlciArICdyZCc7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bWJlciArICd0aCc7XG59XG5cbnZhciBsb2NhbGl6ZSA9IHtcbiAgb3JkaW5hbE51bWJlcjogb3JkaW5hbE51bWJlcixcbiAgZXJhOiBidWlsZExvY2FsaXplRm4oe1xuICAgIHZhbHVlczogZXJhVmFsdWVzLFxuICAgIGRlZmF1bHRXaWR0aDogJ3dpZGUnXG4gIH0pLFxuICBxdWFydGVyOiBidWlsZExvY2FsaXplRm4oe1xuICAgIHZhbHVlczogcXVhcnRlclZhbHVlcyxcbiAgICBkZWZhdWx0V2lkdGg6ICd3aWRlJyxcbiAgICBhcmd1bWVudENhbGxiYWNrOiBmdW5jdGlvbiAocXVhcnRlcikge1xuICAgICAgcmV0dXJuIE51bWJlcihxdWFydGVyKSAtIDE7XG4gICAgfVxuICB9KSxcbiAgbW9udGg6IGJ1aWxkTG9jYWxpemVGbih7XG4gICAgdmFsdWVzOiBtb250aFZhbHVlcyxcbiAgICBkZWZhdWx0V2lkdGg6ICd3aWRlJ1xuICB9KSxcbiAgZGF5OiBidWlsZExvY2FsaXplRm4oe1xuICAgIHZhbHVlczogZGF5VmFsdWVzLFxuICAgIGRlZmF1bHRXaWR0aDogJ3dpZGUnXG4gIH0pLFxuICBkYXlQZXJpb2Q6IGJ1aWxkTG9jYWxpemVGbih7XG4gICAgdmFsdWVzOiBkYXlQZXJpb2RWYWx1ZXMsXG4gICAgZGVmYXVsdFdpZHRoOiAnd2lkZScsXG4gICAgZm9ybWF0dGluZ1ZhbHVlczogZm9ybWF0dGluZ0RheVBlcmlvZFZhbHVlcyxcbiAgICBkZWZhdWx0Rm9ybWF0dGluZ1dpZHRoOiAnd2lkZSdcbiAgfSlcbn07XG5leHBvcnQgZGVmYXVsdCBsb2NhbGl6ZTsiLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBidWlsZE1hdGNoUGF0dGVybkZuKGFyZ3MpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkaXJ0eVN0cmluZywgZGlydHlPcHRpb25zKSB7XG4gICAgdmFyIHN0cmluZyA9IFN0cmluZyhkaXJ0eVN0cmluZyk7XG4gICAgdmFyIG9wdGlvbnMgPSBkaXJ0eU9wdGlvbnMgfHwge307XG4gICAgdmFyIG1hdGNoUmVzdWx0ID0gc3RyaW5nLm1hdGNoKGFyZ3MubWF0Y2hQYXR0ZXJuKTtcblxuICAgIGlmICghbWF0Y2hSZXN1bHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciBtYXRjaGVkU3RyaW5nID0gbWF0Y2hSZXN1bHRbMF07XG4gICAgdmFyIHBhcnNlUmVzdWx0ID0gc3RyaW5nLm1hdGNoKGFyZ3MucGFyc2VQYXR0ZXJuKTtcblxuICAgIGlmICghcGFyc2VSZXN1bHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciB2YWx1ZSA9IGFyZ3MudmFsdWVDYWxsYmFjayA/IGFyZ3MudmFsdWVDYWxsYmFjayhwYXJzZVJlc3VsdFswXSkgOiBwYXJzZVJlc3VsdFswXTtcbiAgICB2YWx1ZSA9IG9wdGlvbnMudmFsdWVDYWxsYmFjayA/IG9wdGlvbnMudmFsdWVDYWxsYmFjayh2YWx1ZSkgOiB2YWx1ZTtcbiAgICByZXR1cm4ge1xuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgcmVzdDogc3RyaW5nLnNsaWNlKG1hdGNoZWRTdHJpbmcubGVuZ3RoKVxuICAgIH07XG4gIH07XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYnVpbGRNYXRjaEZuKGFyZ3MpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkaXJ0eVN0cmluZywgZGlydHlPcHRpb25zKSB7XG4gICAgdmFyIHN0cmluZyA9IFN0cmluZyhkaXJ0eVN0cmluZyk7XG4gICAgdmFyIG9wdGlvbnMgPSBkaXJ0eU9wdGlvbnMgfHwge307XG4gICAgdmFyIHdpZHRoID0gb3B0aW9ucy53aWR0aDtcbiAgICB2YXIgbWF0Y2hQYXR0ZXJuID0gd2lkdGggJiYgYXJncy5tYXRjaFBhdHRlcm5zW3dpZHRoXSB8fCBhcmdzLm1hdGNoUGF0dGVybnNbYXJncy5kZWZhdWx0TWF0Y2hXaWR0aF07XG4gICAgdmFyIG1hdGNoUmVzdWx0ID0gc3RyaW5nLm1hdGNoKG1hdGNoUGF0dGVybik7XG5cbiAgICBpZiAoIW1hdGNoUmVzdWx0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgbWF0Y2hlZFN0cmluZyA9IG1hdGNoUmVzdWx0WzBdO1xuICAgIHZhciBwYXJzZVBhdHRlcm5zID0gd2lkdGggJiYgYXJncy5wYXJzZVBhdHRlcm5zW3dpZHRoXSB8fCBhcmdzLnBhcnNlUGF0dGVybnNbYXJncy5kZWZhdWx0UGFyc2VXaWR0aF07XG4gICAgdmFyIHZhbHVlO1xuXG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChwYXJzZVBhdHRlcm5zKSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgdmFsdWUgPSBmaW5kSW5kZXgocGFyc2VQYXR0ZXJucywgZnVuY3Rpb24gKHBhdHRlcm4pIHtcbiAgICAgICAgcmV0dXJuIHBhdHRlcm4udGVzdChzdHJpbmcpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gZmluZEtleShwYXJzZVBhdHRlcm5zLCBmdW5jdGlvbiAocGF0dGVybikge1xuICAgICAgICByZXR1cm4gcGF0dGVybi50ZXN0KHN0cmluZyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YWx1ZSA9IGFyZ3MudmFsdWVDYWxsYmFjayA/IGFyZ3MudmFsdWVDYWxsYmFjayh2YWx1ZSkgOiB2YWx1ZTtcbiAgICB2YWx1ZSA9IG9wdGlvbnMudmFsdWVDYWxsYmFjayA/IG9wdGlvbnMudmFsdWVDYWxsYmFjayh2YWx1ZSkgOiB2YWx1ZTtcbiAgICByZXR1cm4ge1xuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgcmVzdDogc3RyaW5nLnNsaWNlKG1hdGNoZWRTdHJpbmcubGVuZ3RoKVxuICAgIH07XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRLZXkob2JqZWN0LCBwcmVkaWNhdGUpIHtcbiAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgIGlmIChvYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBwcmVkaWNhdGUob2JqZWN0W2tleV0pKSB7XG4gICAgICByZXR1cm4ga2V5O1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kSW5kZXgoYXJyYXksIHByZWRpY2F0ZSkge1xuICBmb3IgKHZhciBrZXkgPSAwOyBrZXkgPCBhcnJheS5sZW5ndGg7IGtleSsrKSB7XG4gICAgaWYgKHByZWRpY2F0ZShhcnJheVtrZXldKSkge1xuICAgICAgcmV0dXJuIGtleTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQgYnVpbGRNYXRjaFBhdHRlcm5GbiBmcm9tICcuLi8uLi8uLi9fbGliL2J1aWxkTWF0Y2hQYXR0ZXJuRm4vaW5kZXguanMnO1xuaW1wb3J0IGJ1aWxkTWF0Y2hGbiBmcm9tICcuLi8uLi8uLi9fbGliL2J1aWxkTWF0Y2hGbi9pbmRleC5qcyc7XG52YXIgbWF0Y2hPcmRpbmFsTnVtYmVyUGF0dGVybiA9IC9eKFxcZCspKHRofHN0fG5kfHJkKT8vaTtcbnZhciBwYXJzZU9yZGluYWxOdW1iZXJQYXR0ZXJuID0gL1xcZCsvaTtcbnZhciBtYXRjaEVyYVBhdHRlcm5zID0ge1xuICBuYXJyb3c6IC9eKGJ8YSkvaSxcbiAgYWJicmV2aWF0ZWQ6IC9eKGJcXC4/XFxzP2NcXC4/fGJcXC4/XFxzP2NcXC4/XFxzP2VcXC4/fGFcXC4/XFxzP2RcXC4/fGNcXC4/XFxzP2VcXC4/KS9pLFxuICB3aWRlOiAvXihiZWZvcmUgY2hyaXN0fGJlZm9yZSBjb21tb24gZXJhfGFubm8gZG9taW5pfGNvbW1vbiBlcmEpL2lcbn07XG52YXIgcGFyc2VFcmFQYXR0ZXJucyA9IHtcbiAgYW55OiBbL15iL2ksIC9eKGF8YykvaV1cbn07XG52YXIgbWF0Y2hRdWFydGVyUGF0dGVybnMgPSB7XG4gIG5hcnJvdzogL15bMTIzNF0vaSxcbiAgYWJicmV2aWF0ZWQ6IC9ecVsxMjM0XS9pLFxuICB3aWRlOiAvXlsxMjM0XSh0aHxzdHxuZHxyZCk/IHF1YXJ0ZXIvaVxufTtcbnZhciBwYXJzZVF1YXJ0ZXJQYXR0ZXJucyA9IHtcbiAgYW55OiBbLzEvaSwgLzIvaSwgLzMvaSwgLzQvaV1cbn07XG52YXIgbWF0Y2hNb250aFBhdHRlcm5zID0ge1xuICBuYXJyb3c6IC9eW2pmbWFzb25kXS9pLFxuICBhYmJyZXZpYXRlZDogL14oamFufGZlYnxtYXJ8YXByfG1heXxqdW58anVsfGF1Z3xzZXB8b2N0fG5vdnxkZWMpL2ksXG4gIHdpZGU6IC9eKGphbnVhcnl8ZmVicnVhcnl8bWFyY2h8YXByaWx8bWF5fGp1bmV8anVseXxhdWd1c3R8c2VwdGVtYmVyfG9jdG9iZXJ8bm92ZW1iZXJ8ZGVjZW1iZXIpL2lcbn07XG52YXIgcGFyc2VNb250aFBhdHRlcm5zID0ge1xuICBuYXJyb3c6IFsvXmovaSwgL15mL2ksIC9ebS9pLCAvXmEvaSwgL15tL2ksIC9eai9pLCAvXmovaSwgL15hL2ksIC9ecy9pLCAvXm8vaSwgL15uL2ksIC9eZC9pXSxcbiAgYW55OiBbL15qYS9pLCAvXmYvaSwgL15tYXIvaSwgL15hcC9pLCAvXm1heS9pLCAvXmp1bi9pLCAvXmp1bC9pLCAvXmF1L2ksIC9ecy9pLCAvXm8vaSwgL15uL2ksIC9eZC9pXVxufTtcbnZhciBtYXRjaERheVBhdHRlcm5zID0ge1xuICBuYXJyb3c6IC9eW3NtdHdmXS9pLFxuICBzaG9ydDogL14oc3V8bW98dHV8d2V8dGh8ZnJ8c2EpL2ksXG4gIGFiYnJldmlhdGVkOiAvXihzdW58bW9ufHR1ZXx3ZWR8dGh1fGZyaXxzYXQpL2ksXG4gIHdpZGU6IC9eKHN1bmRheXxtb25kYXl8dHVlc2RheXx3ZWRuZXNkYXl8dGh1cnNkYXl8ZnJpZGF5fHNhdHVyZGF5KS9pXG59O1xudmFyIHBhcnNlRGF5UGF0dGVybnMgPSB7XG4gIG5hcnJvdzogWy9ecy9pLCAvXm0vaSwgL150L2ksIC9edy9pLCAvXnQvaSwgL15mL2ksIC9ecy9pXSxcbiAgYW55OiBbL15zdS9pLCAvXm0vaSwgL150dS9pLCAvXncvaSwgL150aC9pLCAvXmYvaSwgL15zYS9pXVxufTtcbnZhciBtYXRjaERheVBlcmlvZFBhdHRlcm5zID0ge1xuICBuYXJyb3c6IC9eKGF8cHxtaXxufChpbiB0aGV8YXQpIChtb3JuaW5nfGFmdGVybm9vbnxldmVuaW5nfG5pZ2h0KSkvaSxcbiAgYW55OiAvXihbYXBdXFwuP1xccz9tXFwuP3xtaWRuaWdodHxub29ufChpbiB0aGV8YXQpIChtb3JuaW5nfGFmdGVybm9vbnxldmVuaW5nfG5pZ2h0KSkvaVxufTtcbnZhciBwYXJzZURheVBlcmlvZFBhdHRlcm5zID0ge1xuICBhbnk6IHtcbiAgICBhbTogL15hL2ksXG4gICAgcG06IC9ecC9pLFxuICAgIG1pZG5pZ2h0OiAvXm1pL2ksXG4gICAgbm9vbjogL15uby9pLFxuICAgIG1vcm5pbmc6IC9tb3JuaW5nL2ksXG4gICAgYWZ0ZXJub29uOiAvYWZ0ZXJub29uL2ksXG4gICAgZXZlbmluZzogL2V2ZW5pbmcvaSxcbiAgICBuaWdodDogL25pZ2h0L2lcbiAgfVxufTtcbnZhciBtYXRjaCA9IHtcbiAgb3JkaW5hbE51bWJlcjogYnVpbGRNYXRjaFBhdHRlcm5Gbih7XG4gICAgbWF0Y2hQYXR0ZXJuOiBtYXRjaE9yZGluYWxOdW1iZXJQYXR0ZXJuLFxuICAgIHBhcnNlUGF0dGVybjogcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybixcbiAgICB2YWx1ZUNhbGxiYWNrOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIHJldHVybiBwYXJzZUludCh2YWx1ZSwgMTApO1xuICAgIH1cbiAgfSksXG4gIGVyYTogYnVpbGRNYXRjaEZuKHtcbiAgICBtYXRjaFBhdHRlcm5zOiBtYXRjaEVyYVBhdHRlcm5zLFxuICAgIGRlZmF1bHRNYXRjaFdpZHRoOiAnd2lkZScsXG4gICAgcGFyc2VQYXR0ZXJuczogcGFyc2VFcmFQYXR0ZXJucyxcbiAgICBkZWZhdWx0UGFyc2VXaWR0aDogJ2FueSdcbiAgfSksXG4gIHF1YXJ0ZXI6IGJ1aWxkTWF0Y2hGbih7XG4gICAgbWF0Y2hQYXR0ZXJuczogbWF0Y2hRdWFydGVyUGF0dGVybnMsXG4gICAgZGVmYXVsdE1hdGNoV2lkdGg6ICd3aWRlJyxcbiAgICBwYXJzZVBhdHRlcm5zOiBwYXJzZVF1YXJ0ZXJQYXR0ZXJucyxcbiAgICBkZWZhdWx0UGFyc2VXaWR0aDogJ2FueScsXG4gICAgdmFsdWVDYWxsYmFjazogZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICByZXR1cm4gaW5kZXggKyAxO1xuICAgIH1cbiAgfSksXG4gIG1vbnRoOiBidWlsZE1hdGNoRm4oe1xuICAgIG1hdGNoUGF0dGVybnM6IG1hdGNoTW9udGhQYXR0ZXJucyxcbiAgICBkZWZhdWx0TWF0Y2hXaWR0aDogJ3dpZGUnLFxuICAgIHBhcnNlUGF0dGVybnM6IHBhcnNlTW9udGhQYXR0ZXJucyxcbiAgICBkZWZhdWx0UGFyc2VXaWR0aDogJ2FueSdcbiAgfSksXG4gIGRheTogYnVpbGRNYXRjaEZuKHtcbiAgICBtYXRjaFBhdHRlcm5zOiBtYXRjaERheVBhdHRlcm5zLFxuICAgIGRlZmF1bHRNYXRjaFdpZHRoOiAnd2lkZScsXG4gICAgcGFyc2VQYXR0ZXJuczogcGFyc2VEYXlQYXR0ZXJucyxcbiAgICBkZWZhdWx0UGFyc2VXaWR0aDogJ2FueSdcbiAgfSksXG4gIGRheVBlcmlvZDogYnVpbGRNYXRjaEZuKHtcbiAgICBtYXRjaFBhdHRlcm5zOiBtYXRjaERheVBlcmlvZFBhdHRlcm5zLFxuICAgIGRlZmF1bHRNYXRjaFdpZHRoOiAnYW55JyxcbiAgICBwYXJzZVBhdHRlcm5zOiBwYXJzZURheVBlcmlvZFBhdHRlcm5zLFxuICAgIGRlZmF1bHRQYXJzZVdpZHRoOiAnYW55J1xuICB9KVxufTtcbmV4cG9ydCBkZWZhdWx0IG1hdGNoOyIsImltcG9ydCBmb3JtYXREaXN0YW5jZSBmcm9tICcuL19saWIvZm9ybWF0RGlzdGFuY2UvaW5kZXguanMnO1xuaW1wb3J0IGZvcm1hdExvbmcgZnJvbSAnLi9fbGliL2Zvcm1hdExvbmcvaW5kZXguanMnO1xuaW1wb3J0IGZvcm1hdFJlbGF0aXZlIGZyb20gJy4vX2xpYi9mb3JtYXRSZWxhdGl2ZS9pbmRleC5qcyc7XG5pbXBvcnQgbG9jYWxpemUgZnJvbSAnLi9fbGliL2xvY2FsaXplL2luZGV4LmpzJztcbmltcG9ydCBtYXRjaCBmcm9tICcuL19saWIvbWF0Y2gvaW5kZXguanMnO1xuLyoqXG4gKiBAdHlwZSB7TG9jYWxlfVxuICogQGNhdGVnb3J5IExvY2FsZXNcbiAqIEBzdW1tYXJ5IEVuZ2xpc2ggbG9jYWxlIChVbml0ZWQgU3RhdGVzKS5cbiAqIEBsYW5ndWFnZSBFbmdsaXNoXG4gKiBAaXNvLTYzOS0yIGVuZ1xuICogQGF1dGhvciBTYXNoYSBLb3NzIFtAa29zc25vY29ycF17QGxpbmsgaHR0cHM6Ly9naXRodWIuY29tL2tvc3Nub2NvcnB9XG4gKiBAYXV0aG9yIExlc2hhIEtvc3MgW0BsZXNoYWtvc3Nde0BsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9sZXNoYWtvc3N9XG4gKi9cblxudmFyIGxvY2FsZSA9IHtcbiAgY29kZTogJ2VuLVVTJyxcbiAgZm9ybWF0RGlzdGFuY2U6IGZvcm1hdERpc3RhbmNlLFxuICBmb3JtYXRMb25nOiBmb3JtYXRMb25nLFxuICBmb3JtYXRSZWxhdGl2ZTogZm9ybWF0UmVsYXRpdmUsXG4gIGxvY2FsaXplOiBsb2NhbGl6ZSxcbiAgbWF0Y2g6IG1hdGNoLFxuICBvcHRpb25zOiB7XG4gICAgd2Vla1N0YXJ0c09uOiAwXG4gICAgLyogU3VuZGF5ICovXG4gICAgLFxuICAgIGZpcnN0V2Vla0NvbnRhaW5zRGF0ZTogMVxuICB9XG59O1xuZXhwb3J0IGRlZmF1bHQgbG9jYWxlOyIsImltcG9ydCB0b0ludGVnZXIgZnJvbSAnLi4vX2xpYi90b0ludGVnZXIvaW5kZXguanMnO1xuaW1wb3J0IGFkZE1pbGxpc2Vjb25kcyBmcm9tICcuLi9hZGRNaWxsaXNlY29uZHMvaW5kZXguanMnO1xuLyoqXG4gKiBAbmFtZSBzdWJNaWxsaXNlY29uZHNcbiAqIEBjYXRlZ29yeSBNaWxsaXNlY29uZCBIZWxwZXJzXG4gKiBAc3VtbWFyeSBTdWJ0cmFjdCB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBtaWxsaXNlY29uZHMgZnJvbSB0aGUgZ2l2ZW4gZGF0ZS5cbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIFN1YnRyYWN0IHRoZSBzcGVjaWZpZWQgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBmcm9tIHRoZSBnaXZlbiBkYXRlLlxuICpcbiAqICMjIyB2Mi4wLjAgYnJlYWtpbmcgY2hhbmdlczpcbiAqXG4gKiAtIFtDaGFuZ2VzIHRoYXQgYXJlIGNvbW1vbiBmb3IgdGhlIHdob2xlIGxpYnJhcnldKGh0dHBzOi8vZ2l0aHViLmNvbS9kYXRlLWZucy9kYXRlLWZucy9ibG9iL21hc3Rlci9kb2NzL3VwZ3JhZGVHdWlkZS5tZCNDb21tb24tQ2hhbmdlcykuXG4gKlxuICogQHBhcmFtIHtEYXRlfE51bWJlcn0gZGF0ZSAtIHRoZSBkYXRlIHRvIGJlIGNoYW5nZWRcbiAqIEBwYXJhbSB7TnVtYmVyfSBhbW91bnQgLSB0aGUgYW1vdW50IG9mIG1pbGxpc2Vjb25kcyB0byBiZSBzdWJ0cmFjdGVkXG4gKiBAcmV0dXJucyB7RGF0ZX0gdGhlIG5ldyBkYXRlIHdpdGggdGhlIG1pbGxpc2Vjb25kcyBzdWJ0cmFjdGVkXG4gKiBAdGhyb3dzIHtUeXBlRXJyb3J9IDIgYXJndW1lbnRzIHJlcXVpcmVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFN1YnRyYWN0IDc1MCBtaWxsaXNlY29uZHMgZnJvbSAxMCBKdWx5IDIwMTQgMTI6NDU6MzAuMDAwOlxuICogdmFyIHJlc3VsdCA9IHN1Yk1pbGxpc2Vjb25kcyhuZXcgRGF0ZSgyMDE0LCA2LCAxMCwgMTIsIDQ1LCAzMCwgMCksIDc1MClcbiAqIC8vPT4gVGh1IEp1bCAxMCAyMDE0IDEyOjQ1OjI5LjI1MFxuICovXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN1Yk1pbGxpc2Vjb25kcyhkaXJ0eURhdGUsIGRpcnR5QW1vdW50KSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJzIgYXJndW1lbnRzIHJlcXVpcmVkLCBidXQgb25seSAnICsgYXJndW1lbnRzLmxlbmd0aCArICcgcHJlc2VudCcpO1xuICB9XG5cbiAgdmFyIGFtb3VudCA9IHRvSW50ZWdlcihkaXJ0eUFtb3VudCk7XG4gIHJldHVybiBhZGRNaWxsaXNlY29uZHMoZGlydHlEYXRlLCAtYW1vdW50KTtcbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhZGRMZWFkaW5nWmVyb3MobnVtYmVyLCB0YXJnZXRMZW5ndGgpIHtcbiAgdmFyIHNpZ24gPSBudW1iZXIgPCAwID8gJy0nIDogJyc7XG4gIHZhciBvdXRwdXQgPSBNYXRoLmFicyhudW1iZXIpLnRvU3RyaW5nKCk7XG5cbiAgd2hpbGUgKG91dHB1dC5sZW5ndGggPCB0YXJnZXRMZW5ndGgpIHtcbiAgICBvdXRwdXQgPSAnMCcgKyBvdXRwdXQ7XG4gIH1cblxuICByZXR1cm4gc2lnbiArIG91dHB1dDtcbn0iLCJpbXBvcnQgYWRkTGVhZGluZ1plcm9zIGZyb20gJy4uLy4uL2FkZExlYWRpbmdaZXJvcy9pbmRleC5qcyc7XG4vKlxuICogfCAgICAgfCBVbml0ICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgfCBVbml0ICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfC0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICogfCAgYSAgfCBBTSwgUE0gICAgICAgICAgICAgICAgICAgICAgICAgfCAgQSogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgZCAgfCBEYXkgb2YgbW9udGggICAgICAgICAgICAgICAgICAgfCAgRCAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgaCAgfCBIb3VyIFsxLTEyXSAgICAgICAgICAgICAgICAgICAgfCAgSCAgfCBIb3VyIFswLTIzXSAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgbSAgfCBNaW51dGUgICAgICAgICAgICAgICAgICAgICAgICAgfCAgTSAgfCBNb250aCAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICogfCAgcyAgfCBTZWNvbmQgICAgICAgICAgICAgICAgICAgICAgICAgfCAgUyAgfCBGcmFjdGlvbiBvZiBzZWNvbmQgICAgICAgICAgICAgfFxuICogfCAgeSAgfCBZZWFyIChhYnMpICAgICAgICAgICAgICAgICAgICAgfCAgWSAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICpcbiAqIExldHRlcnMgbWFya2VkIGJ5ICogYXJlIG5vdCBpbXBsZW1lbnRlZCBidXQgcmVzZXJ2ZWQgYnkgVW5pY29kZSBzdGFuZGFyZC5cbiAqL1xuXG52YXIgZm9ybWF0dGVycyA9IHtcbiAgLy8gWWVhclxuICB5OiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4pIHtcbiAgICAvLyBGcm9tIGh0dHA6Ly93d3cudW5pY29kZS5vcmcvcmVwb3J0cy90cjM1L3RyMzUtMzEvdHIzNS1kYXRlcy5odG1sI0RhdGVfRm9ybWF0X3Rva2Vuc1xuICAgIC8vIHwgWWVhciAgICAgfCAgICAgeSB8IHl5IHwgICB5eXkgfCAgeXl5eSB8IHl5eXl5IHxcbiAgICAvLyB8LS0tLS0tLS0tLXwtLS0tLS0tfC0tLS18LS0tLS0tLXwtLS0tLS0tfC0tLS0tLS18XG4gICAgLy8gfCBBRCAxICAgICB8ICAgICAxIHwgMDEgfCAgIDAwMSB8ICAwMDAxIHwgMDAwMDEgfFxuICAgIC8vIHwgQUQgMTIgICAgfCAgICAxMiB8IDEyIHwgICAwMTIgfCAgMDAxMiB8IDAwMDEyIHxcbiAgICAvLyB8IEFEIDEyMyAgIHwgICAxMjMgfCAyMyB8ICAgMTIzIHwgIDAxMjMgfCAwMDEyMyB8XG4gICAgLy8gfCBBRCAxMjM0ICB8ICAxMjM0IHwgMzQgfCAgMTIzNCB8ICAxMjM0IHwgMDEyMzQgfFxuICAgIC8vIHwgQUQgMTIzNDUgfCAxMjM0NSB8IDQ1IHwgMTIzNDUgfCAxMjM0NSB8IDEyMzQ1IHxcbiAgICB2YXIgc2lnbmVkWWVhciA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKTsgLy8gUmV0dXJucyAxIGZvciAxIEJDICh3aGljaCBpcyB5ZWFyIDAgaW4gSmF2YVNjcmlwdClcblxuICAgIHZhciB5ZWFyID0gc2lnbmVkWWVhciA+IDAgPyBzaWduZWRZZWFyIDogMSAtIHNpZ25lZFllYXI7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyh0b2tlbiA9PT0gJ3l5JyA/IHllYXIgJSAxMDAgOiB5ZWFyLCB0b2tlbi5sZW5ndGgpO1xuICB9LFxuICAvLyBNb250aFxuICBNOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4pIHtcbiAgICB2YXIgbW9udGggPSBkYXRlLmdldFVUQ01vbnRoKCk7XG4gICAgcmV0dXJuIHRva2VuID09PSAnTScgPyBTdHJpbmcobW9udGggKyAxKSA6IGFkZExlYWRpbmdaZXJvcyhtb250aCArIDEsIDIpO1xuICB9LFxuICAvLyBEYXkgb2YgdGhlIG1vbnRoXG4gIGQ6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbikge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRVVENEYXRlKCksIHRva2VuLmxlbmd0aCk7XG4gIH0sXG4gIC8vIEFNIG9yIFBNXG4gIGE6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbikge1xuICAgIHZhciBkYXlQZXJpb2RFbnVtVmFsdWUgPSBkYXRlLmdldFVUQ0hvdXJzKCkgLyAxMiA+PSAxID8gJ3BtJyA6ICdhbSc7XG5cbiAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICBjYXNlICdhJzpcbiAgICAgIGNhc2UgJ2FhJzpcbiAgICAgIGNhc2UgJ2FhYSc6XG4gICAgICAgIHJldHVybiBkYXlQZXJpb2RFbnVtVmFsdWUudG9VcHBlckNhc2UoKTtcblxuICAgICAgY2FzZSAnYWFhYWEnOlxuICAgICAgICByZXR1cm4gZGF5UGVyaW9kRW51bVZhbHVlWzBdO1xuXG4gICAgICBjYXNlICdhYWFhJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBkYXlQZXJpb2RFbnVtVmFsdWUgPT09ICdhbScgPyAnYS5tLicgOiAncC5tLic7XG4gICAgfVxuICB9LFxuICAvLyBIb3VyIFsxLTEyXVxuICBoOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4pIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGRhdGUuZ2V0VVRDSG91cnMoKSAlIDEyIHx8IDEyLCB0b2tlbi5sZW5ndGgpO1xuICB9LFxuICAvLyBIb3VyIFswLTIzXVxuICBIOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4pIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGRhdGUuZ2V0VVRDSG91cnMoKSwgdG9rZW4ubGVuZ3RoKTtcbiAgfSxcbiAgLy8gTWludXRlXG4gIG06IGZ1bmN0aW9uIChkYXRlLCB0b2tlbikge1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZGF0ZS5nZXRVVENNaW51dGVzKCksIHRva2VuLmxlbmd0aCk7XG4gIH0sXG4gIC8vIFNlY29uZFxuICBzOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4pIHtcbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGRhdGUuZ2V0VVRDU2Vjb25kcygpLCB0b2tlbi5sZW5ndGgpO1xuICB9LFxuICAvLyBGcmFjdGlvbiBvZiBzZWNvbmRcbiAgUzogZnVuY3Rpb24gKGRhdGUsIHRva2VuKSB7XG4gICAgdmFyIG51bWJlck9mRGlnaXRzID0gdG9rZW4ubGVuZ3RoO1xuICAgIHZhciBtaWxsaXNlY29uZHMgPSBkYXRlLmdldFVUQ01pbGxpc2Vjb25kcygpO1xuICAgIHZhciBmcmFjdGlvbmFsU2Vjb25kcyA9IE1hdGguZmxvb3IobWlsbGlzZWNvbmRzICogTWF0aC5wb3coMTAsIG51bWJlck9mRGlnaXRzIC0gMykpO1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoZnJhY3Rpb25hbFNlY29uZHMsIHRva2VuLmxlbmd0aCk7XG4gIH1cbn07XG5leHBvcnQgZGVmYXVsdCBmb3JtYXR0ZXJzOyIsImltcG9ydCB0b0RhdGUgZnJvbSAnLi4vLi4vdG9EYXRlL2luZGV4LmpzJztcbnZhciBNSUxMSVNFQ09ORFNfSU5fREFZID0gODY0MDAwMDA7IC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBhIHBhcnQgb2YgcHVibGljIEFQSSB3aGVuIFVUQyBmdW5jdGlvbiB3aWxsIGJlIGltcGxlbWVudGVkLlxuLy8gU2VlIGlzc3VlOiBodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvaXNzdWVzLzM3NlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRVVENEYXlPZlllYXIoZGlydHlEYXRlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJzEgYXJndW1lbnQgcmVxdWlyZWQsIGJ1dCBvbmx5ICcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBwcmVzZW50Jyk7XG4gIH1cblxuICB2YXIgZGF0ZSA9IHRvRGF0ZShkaXJ0eURhdGUpO1xuICB2YXIgdGltZXN0YW1wID0gZGF0ZS5nZXRUaW1lKCk7XG4gIGRhdGUuc2V0VVRDTW9udGgoMCwgMSk7XG4gIGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gIHZhciBzdGFydE9mWWVhclRpbWVzdGFtcCA9IGRhdGUuZ2V0VGltZSgpO1xuICB2YXIgZGlmZmVyZW5jZSA9IHRpbWVzdGFtcCAtIHN0YXJ0T2ZZZWFyVGltZXN0YW1wO1xuICByZXR1cm4gTWF0aC5mbG9vcihkaWZmZXJlbmNlIC8gTUlMTElTRUNPTkRTX0lOX0RBWSkgKyAxO1xufSIsImltcG9ydCB0b0RhdGUgZnJvbSAnLi4vLi4vdG9EYXRlL2luZGV4LmpzJzsgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGEgcGFydCBvZiBwdWJsaWMgQVBJIHdoZW4gVVRDIGZ1bmN0aW9uIHdpbGwgYmUgaW1wbGVtZW50ZWQuXG4vLyBTZWUgaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXRlLWZucy9kYXRlLWZucy9pc3N1ZXMvMzc2XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN0YXJ0T2ZVVENJU09XZWVrKGRpcnR5RGF0ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDEpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAnICsgYXJndW1lbnRzLmxlbmd0aCArICcgcHJlc2VudCcpO1xuICB9XG5cbiAgdmFyIHdlZWtTdGFydHNPbiA9IDE7XG4gIHZhciBkYXRlID0gdG9EYXRlKGRpcnR5RGF0ZSk7XG4gIHZhciBkYXkgPSBkYXRlLmdldFVUQ0RheSgpO1xuICB2YXIgZGlmZiA9IChkYXkgPCB3ZWVrU3RhcnRzT24gPyA3IDogMCkgKyBkYXkgLSB3ZWVrU3RhcnRzT247XG4gIGRhdGUuc2V0VVRDRGF0ZShkYXRlLmdldFVUQ0RhdGUoKSAtIGRpZmYpO1xuICBkYXRlLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICByZXR1cm4gZGF0ZTtcbn0iLCJpbXBvcnQgdG9EYXRlIGZyb20gJy4uLy4uL3RvRGF0ZS9pbmRleC5qcyc7XG5pbXBvcnQgc3RhcnRPZlVUQ0lTT1dlZWsgZnJvbSAnLi4vc3RhcnRPZlVUQ0lTT1dlZWsvaW5kZXguanMnOyAvLyBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgYSBwYXJ0IG9mIHB1YmxpYyBBUEkgd2hlbiBVVEMgZnVuY3Rpb24gd2lsbCBiZSBpbXBsZW1lbnRlZC5cbi8vIFNlZSBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL2RhdGUtZm5zL2RhdGUtZm5zL2lzc3Vlcy8zNzZcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VVRDSVNPV2Vla1llYXIoZGlydHlEYXRlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJzEgYXJndW1lbnQgcmVxdWlyZWQsIGJ1dCBvbmx5ICcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBwcmVzZW50Jyk7XG4gIH1cblxuICB2YXIgZGF0ZSA9IHRvRGF0ZShkaXJ0eURhdGUpO1xuICB2YXIgeWVhciA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKTtcbiAgdmFyIGZvdXJ0aE9mSmFudWFyeU9mTmV4dFllYXIgPSBuZXcgRGF0ZSgwKTtcbiAgZm91cnRoT2ZKYW51YXJ5T2ZOZXh0WWVhci5zZXRVVENGdWxsWWVhcih5ZWFyICsgMSwgMCwgNCk7XG4gIGZvdXJ0aE9mSmFudWFyeU9mTmV4dFllYXIuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gIHZhciBzdGFydE9mTmV4dFllYXIgPSBzdGFydE9mVVRDSVNPV2Vlayhmb3VydGhPZkphbnVhcnlPZk5leHRZZWFyKTtcbiAgdmFyIGZvdXJ0aE9mSmFudWFyeU9mVGhpc1llYXIgPSBuZXcgRGF0ZSgwKTtcbiAgZm91cnRoT2ZKYW51YXJ5T2ZUaGlzWWVhci5zZXRVVENGdWxsWWVhcih5ZWFyLCAwLCA0KTtcbiAgZm91cnRoT2ZKYW51YXJ5T2ZUaGlzWWVhci5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgdmFyIHN0YXJ0T2ZUaGlzWWVhciA9IHN0YXJ0T2ZVVENJU09XZWVrKGZvdXJ0aE9mSmFudWFyeU9mVGhpc1llYXIpO1xuXG4gIGlmIChkYXRlLmdldFRpbWUoKSA+PSBzdGFydE9mTmV4dFllYXIuZ2V0VGltZSgpKSB7XG4gICAgcmV0dXJuIHllYXIgKyAxO1xuICB9IGVsc2UgaWYgKGRhdGUuZ2V0VGltZSgpID49IHN0YXJ0T2ZUaGlzWWVhci5nZXRUaW1lKCkpIHtcbiAgICByZXR1cm4geWVhcjtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4geWVhciAtIDE7XG4gIH1cbn0iLCJpbXBvcnQgZ2V0VVRDSVNPV2Vla1llYXIgZnJvbSAnLi4vZ2V0VVRDSVNPV2Vla1llYXIvaW5kZXguanMnO1xuaW1wb3J0IHN0YXJ0T2ZVVENJU09XZWVrIGZyb20gJy4uL3N0YXJ0T2ZVVENJU09XZWVrL2luZGV4LmpzJzsgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGEgcGFydCBvZiBwdWJsaWMgQVBJIHdoZW4gVVRDIGZ1bmN0aW9uIHdpbGwgYmUgaW1wbGVtZW50ZWQuXG4vLyBTZWUgaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXRlLWZucy9kYXRlLWZucy9pc3N1ZXMvMzc2XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN0YXJ0T2ZVVENJU09XZWVrWWVhcihkaXJ0eURhdGUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAxKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgJyArIGFyZ3VtZW50cy5sZW5ndGggKyAnIHByZXNlbnQnKTtcbiAgfVxuXG4gIHZhciB5ZWFyID0gZ2V0VVRDSVNPV2Vla1llYXIoZGlydHlEYXRlKTtcbiAgdmFyIGZvdXJ0aE9mSmFudWFyeSA9IG5ldyBEYXRlKDApO1xuICBmb3VydGhPZkphbnVhcnkuc2V0VVRDRnVsbFllYXIoeWVhciwgMCwgNCk7XG4gIGZvdXJ0aE9mSmFudWFyeS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgdmFyIGRhdGUgPSBzdGFydE9mVVRDSVNPV2Vlayhmb3VydGhPZkphbnVhcnkpO1xuICByZXR1cm4gZGF0ZTtcbn0iLCJpbXBvcnQgdG9EYXRlIGZyb20gJy4uLy4uL3RvRGF0ZS9pbmRleC5qcyc7XG5pbXBvcnQgc3RhcnRPZlVUQ0lTT1dlZWsgZnJvbSAnLi4vc3RhcnRPZlVUQ0lTT1dlZWsvaW5kZXguanMnO1xuaW1wb3J0IHN0YXJ0T2ZVVENJU09XZWVrWWVhciBmcm9tICcuLi9zdGFydE9mVVRDSVNPV2Vla1llYXIvaW5kZXguanMnO1xudmFyIE1JTExJU0VDT05EU19JTl9XRUVLID0gNjA0ODAwMDAwOyAvLyBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgYSBwYXJ0IG9mIHB1YmxpYyBBUEkgd2hlbiBVVEMgZnVuY3Rpb24gd2lsbCBiZSBpbXBsZW1lbnRlZC5cbi8vIFNlZSBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL2RhdGUtZm5zL2RhdGUtZm5zL2lzc3Vlcy8zNzZcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VVRDSVNPV2VlayhkaXJ0eURhdGUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAxKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgJyArIGFyZ3VtZW50cy5sZW5ndGggKyAnIHByZXNlbnQnKTtcbiAgfVxuXG4gIHZhciBkYXRlID0gdG9EYXRlKGRpcnR5RGF0ZSk7XG4gIHZhciBkaWZmID0gc3RhcnRPZlVUQ0lTT1dlZWsoZGF0ZSkuZ2V0VGltZSgpIC0gc3RhcnRPZlVUQ0lTT1dlZWtZZWFyKGRhdGUpLmdldFRpbWUoKTsgLy8gUm91bmQgdGhlIG51bWJlciBvZiBkYXlzIHRvIHRoZSBuZWFyZXN0IGludGVnZXJcbiAgLy8gYmVjYXVzZSB0aGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBpbiBhIHdlZWsgaXMgbm90IGNvbnN0YW50XG4gIC8vIChlLmcuIGl0J3MgZGlmZmVyZW50IGluIHRoZSB3ZWVrIG9mIHRoZSBkYXlsaWdodCBzYXZpbmcgdGltZSBjbG9jayBzaGlmdClcblxuICByZXR1cm4gTWF0aC5yb3VuZChkaWZmIC8gTUlMTElTRUNPTkRTX0lOX1dFRUspICsgMTtcbn0iLCJpbXBvcnQgdG9JbnRlZ2VyIGZyb20gJy4uL3RvSW50ZWdlci9pbmRleC5qcyc7XG5pbXBvcnQgdG9EYXRlIGZyb20gJy4uLy4uL3RvRGF0ZS9pbmRleC5qcyc7IC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBhIHBhcnQgb2YgcHVibGljIEFQSSB3aGVuIFVUQyBmdW5jdGlvbiB3aWxsIGJlIGltcGxlbWVudGVkLlxuLy8gU2VlIGlzc3VlOiBodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvaXNzdWVzLzM3NlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzdGFydE9mVVRDV2VlayhkaXJ0eURhdGUsIGRpcnR5T3B0aW9ucykge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDEpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAnICsgYXJndW1lbnRzLmxlbmd0aCArICcgcHJlc2VudCcpO1xuICB9XG5cbiAgdmFyIG9wdGlvbnMgPSBkaXJ0eU9wdGlvbnMgfHwge307XG4gIHZhciBsb2NhbGUgPSBvcHRpb25zLmxvY2FsZTtcbiAgdmFyIGxvY2FsZVdlZWtTdGFydHNPbiA9IGxvY2FsZSAmJiBsb2NhbGUub3B0aW9ucyAmJiBsb2NhbGUub3B0aW9ucy53ZWVrU3RhcnRzT247XG4gIHZhciBkZWZhdWx0V2Vla1N0YXJ0c09uID0gbG9jYWxlV2Vla1N0YXJ0c09uID09IG51bGwgPyAwIDogdG9JbnRlZ2VyKGxvY2FsZVdlZWtTdGFydHNPbik7XG4gIHZhciB3ZWVrU3RhcnRzT24gPSBvcHRpb25zLndlZWtTdGFydHNPbiA9PSBudWxsID8gZGVmYXVsdFdlZWtTdGFydHNPbiA6IHRvSW50ZWdlcihvcHRpb25zLndlZWtTdGFydHNPbik7IC8vIFRlc3QgaWYgd2Vla1N0YXJ0c09uIGlzIGJldHdlZW4gMCBhbmQgNiBfYW5kXyBpcyBub3QgTmFOXG5cbiAgaWYgKCEod2Vla1N0YXJ0c09uID49IDAgJiYgd2Vla1N0YXJ0c09uIDw9IDYpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3dlZWtTdGFydHNPbiBtdXN0IGJlIGJldHdlZW4gMCBhbmQgNiBpbmNsdXNpdmVseScpO1xuICB9XG5cbiAgdmFyIGRhdGUgPSB0b0RhdGUoZGlydHlEYXRlKTtcbiAgdmFyIGRheSA9IGRhdGUuZ2V0VVRDRGF5KCk7XG4gIHZhciBkaWZmID0gKGRheSA8IHdlZWtTdGFydHNPbiA/IDcgOiAwKSArIGRheSAtIHdlZWtTdGFydHNPbjtcbiAgZGF0ZS5zZXRVVENEYXRlKGRhdGUuZ2V0VVRDRGF0ZSgpIC0gZGlmZik7XG4gIGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gIHJldHVybiBkYXRlO1xufSIsImltcG9ydCB0b0ludGVnZXIgZnJvbSAnLi4vdG9JbnRlZ2VyL2luZGV4LmpzJztcbmltcG9ydCB0b0RhdGUgZnJvbSAnLi4vLi4vdG9EYXRlL2luZGV4LmpzJztcbmltcG9ydCBzdGFydE9mVVRDV2VlayBmcm9tICcuLi9zdGFydE9mVVRDV2Vlay9pbmRleC5qcyc7IC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBhIHBhcnQgb2YgcHVibGljIEFQSSB3aGVuIFVUQyBmdW5jdGlvbiB3aWxsIGJlIGltcGxlbWVudGVkLlxuLy8gU2VlIGlzc3VlOiBodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvaXNzdWVzLzM3NlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRVVENXZWVrWWVhcihkaXJ0eURhdGUsIGRpcnR5T3B0aW9ucykge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDEpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAnICsgYXJndW1lbnRzLmxlbmd0aCArICcgcHJlc2VudCcpO1xuICB9XG5cbiAgdmFyIGRhdGUgPSB0b0RhdGUoZGlydHlEYXRlLCBkaXJ0eU9wdGlvbnMpO1xuICB2YXIgeWVhciA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKTtcbiAgdmFyIG9wdGlvbnMgPSBkaXJ0eU9wdGlvbnMgfHwge307XG4gIHZhciBsb2NhbGUgPSBvcHRpb25zLmxvY2FsZTtcbiAgdmFyIGxvY2FsZUZpcnN0V2Vla0NvbnRhaW5zRGF0ZSA9IGxvY2FsZSAmJiBsb2NhbGUub3B0aW9ucyAmJiBsb2NhbGUub3B0aW9ucy5maXJzdFdlZWtDb250YWluc0RhdGU7XG4gIHZhciBkZWZhdWx0Rmlyc3RXZWVrQ29udGFpbnNEYXRlID0gbG9jYWxlRmlyc3RXZWVrQ29udGFpbnNEYXRlID09IG51bGwgPyAxIDogdG9JbnRlZ2VyKGxvY2FsZUZpcnN0V2Vla0NvbnRhaW5zRGF0ZSk7XG4gIHZhciBmaXJzdFdlZWtDb250YWluc0RhdGUgPSBvcHRpb25zLmZpcnN0V2Vla0NvbnRhaW5zRGF0ZSA9PSBudWxsID8gZGVmYXVsdEZpcnN0V2Vla0NvbnRhaW5zRGF0ZSA6IHRvSW50ZWdlcihvcHRpb25zLmZpcnN0V2Vla0NvbnRhaW5zRGF0ZSk7IC8vIFRlc3QgaWYgd2Vla1N0YXJ0c09uIGlzIGJldHdlZW4gMSBhbmQgNyBfYW5kXyBpcyBub3QgTmFOXG5cbiAgaWYgKCEoZmlyc3RXZWVrQ29udGFpbnNEYXRlID49IDEgJiYgZmlyc3RXZWVrQ29udGFpbnNEYXRlIDw9IDcpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2ZpcnN0V2Vla0NvbnRhaW5zRGF0ZSBtdXN0IGJlIGJldHdlZW4gMSBhbmQgNyBpbmNsdXNpdmVseScpO1xuICB9XG5cbiAgdmFyIGZpcnN0V2Vla09mTmV4dFllYXIgPSBuZXcgRGF0ZSgwKTtcbiAgZmlyc3RXZWVrT2ZOZXh0WWVhci5zZXRVVENGdWxsWWVhcih5ZWFyICsgMSwgMCwgZmlyc3RXZWVrQ29udGFpbnNEYXRlKTtcbiAgZmlyc3RXZWVrT2ZOZXh0WWVhci5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgdmFyIHN0YXJ0T2ZOZXh0WWVhciA9IHN0YXJ0T2ZVVENXZWVrKGZpcnN0V2Vla09mTmV4dFllYXIsIGRpcnR5T3B0aW9ucyk7XG4gIHZhciBmaXJzdFdlZWtPZlRoaXNZZWFyID0gbmV3IERhdGUoMCk7XG4gIGZpcnN0V2Vla09mVGhpc1llYXIuc2V0VVRDRnVsbFllYXIoeWVhciwgMCwgZmlyc3RXZWVrQ29udGFpbnNEYXRlKTtcbiAgZmlyc3RXZWVrT2ZUaGlzWWVhci5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgdmFyIHN0YXJ0T2ZUaGlzWWVhciA9IHN0YXJ0T2ZVVENXZWVrKGZpcnN0V2Vla09mVGhpc1llYXIsIGRpcnR5T3B0aW9ucyk7XG5cbiAgaWYgKGRhdGUuZ2V0VGltZSgpID49IHN0YXJ0T2ZOZXh0WWVhci5nZXRUaW1lKCkpIHtcbiAgICByZXR1cm4geWVhciArIDE7XG4gIH0gZWxzZSBpZiAoZGF0ZS5nZXRUaW1lKCkgPj0gc3RhcnRPZlRoaXNZZWFyLmdldFRpbWUoKSkge1xuICAgIHJldHVybiB5ZWFyO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB5ZWFyIC0gMTtcbiAgfVxufSIsImltcG9ydCB0b0ludGVnZXIgZnJvbSAnLi4vdG9JbnRlZ2VyL2luZGV4LmpzJztcbmltcG9ydCBnZXRVVENXZWVrWWVhciBmcm9tICcuLi9nZXRVVENXZWVrWWVhci9pbmRleC5qcyc7XG5pbXBvcnQgc3RhcnRPZlVUQ1dlZWsgZnJvbSAnLi4vc3RhcnRPZlVUQ1dlZWsvaW5kZXguanMnOyAvLyBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgYSBwYXJ0IG9mIHB1YmxpYyBBUEkgd2hlbiBVVEMgZnVuY3Rpb24gd2lsbCBiZSBpbXBsZW1lbnRlZC5cbi8vIFNlZSBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL2RhdGUtZm5zL2RhdGUtZm5zL2lzc3Vlcy8zNzZcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc3RhcnRPZlVUQ1dlZWtZZWFyKGRpcnR5RGF0ZSwgZGlydHlPcHRpb25zKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJzEgYXJndW1lbnQgcmVxdWlyZWQsIGJ1dCBvbmx5ICcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBwcmVzZW50Jyk7XG4gIH1cblxuICB2YXIgb3B0aW9ucyA9IGRpcnR5T3B0aW9ucyB8fCB7fTtcbiAgdmFyIGxvY2FsZSA9IG9wdGlvbnMubG9jYWxlO1xuICB2YXIgbG9jYWxlRmlyc3RXZWVrQ29udGFpbnNEYXRlID0gbG9jYWxlICYmIGxvY2FsZS5vcHRpb25zICYmIGxvY2FsZS5vcHRpb25zLmZpcnN0V2Vla0NvbnRhaW5zRGF0ZTtcbiAgdmFyIGRlZmF1bHRGaXJzdFdlZWtDb250YWluc0RhdGUgPSBsb2NhbGVGaXJzdFdlZWtDb250YWluc0RhdGUgPT0gbnVsbCA/IDEgOiB0b0ludGVnZXIobG9jYWxlRmlyc3RXZWVrQ29udGFpbnNEYXRlKTtcbiAgdmFyIGZpcnN0V2Vla0NvbnRhaW5zRGF0ZSA9IG9wdGlvbnMuZmlyc3RXZWVrQ29udGFpbnNEYXRlID09IG51bGwgPyBkZWZhdWx0Rmlyc3RXZWVrQ29udGFpbnNEYXRlIDogdG9JbnRlZ2VyKG9wdGlvbnMuZmlyc3RXZWVrQ29udGFpbnNEYXRlKTtcbiAgdmFyIHllYXIgPSBnZXRVVENXZWVrWWVhcihkaXJ0eURhdGUsIGRpcnR5T3B0aW9ucyk7XG4gIHZhciBmaXJzdFdlZWsgPSBuZXcgRGF0ZSgwKTtcbiAgZmlyc3RXZWVrLnNldFVUQ0Z1bGxZZWFyKHllYXIsIDAsIGZpcnN0V2Vla0NvbnRhaW5zRGF0ZSk7XG4gIGZpcnN0V2Vlay5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgdmFyIGRhdGUgPSBzdGFydE9mVVRDV2VlayhmaXJzdFdlZWssIGRpcnR5T3B0aW9ucyk7XG4gIHJldHVybiBkYXRlO1xufSIsImltcG9ydCB0b0RhdGUgZnJvbSAnLi4vLi4vdG9EYXRlL2luZGV4LmpzJztcbmltcG9ydCBzdGFydE9mVVRDV2VlayBmcm9tICcuLi9zdGFydE9mVVRDV2Vlay9pbmRleC5qcyc7XG5pbXBvcnQgc3RhcnRPZlVUQ1dlZWtZZWFyIGZyb20gJy4uL3N0YXJ0T2ZVVENXZWVrWWVhci9pbmRleC5qcyc7XG52YXIgTUlMTElTRUNPTkRTX0lOX1dFRUsgPSA2MDQ4MDAwMDA7IC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBhIHBhcnQgb2YgcHVibGljIEFQSSB3aGVuIFVUQyBmdW5jdGlvbiB3aWxsIGJlIGltcGxlbWVudGVkLlxuLy8gU2VlIGlzc3VlOiBodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvaXNzdWVzLzM3NlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRVVENXZWVrKGRpcnR5RGF0ZSwgb3B0aW9ucykge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDEpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAnICsgYXJndW1lbnRzLmxlbmd0aCArICcgcHJlc2VudCcpO1xuICB9XG5cbiAgdmFyIGRhdGUgPSB0b0RhdGUoZGlydHlEYXRlKTtcbiAgdmFyIGRpZmYgPSBzdGFydE9mVVRDV2VlayhkYXRlLCBvcHRpb25zKS5nZXRUaW1lKCkgLSBzdGFydE9mVVRDV2Vla1llYXIoZGF0ZSwgb3B0aW9ucykuZ2V0VGltZSgpOyAvLyBSb3VuZCB0aGUgbnVtYmVyIG9mIGRheXMgdG8gdGhlIG5lYXJlc3QgaW50ZWdlclxuICAvLyBiZWNhdXNlIHRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIGluIGEgd2VlayBpcyBub3QgY29uc3RhbnRcbiAgLy8gKGUuZy4gaXQncyBkaWZmZXJlbnQgaW4gdGhlIHdlZWsgb2YgdGhlIGRheWxpZ2h0IHNhdmluZyB0aW1lIGNsb2NrIHNoaWZ0KVxuXG4gIHJldHVybiBNYXRoLnJvdW5kKGRpZmYgLyBNSUxMSVNFQ09ORFNfSU5fV0VFSykgKyAxO1xufSIsImltcG9ydCBsaWdodEZvcm1hdHRlcnMgZnJvbSAnLi4vbGlnaHRGb3JtYXR0ZXJzL2luZGV4LmpzJztcbmltcG9ydCBnZXRVVENEYXlPZlllYXIgZnJvbSAnLi4vLi4vLi4vX2xpYi9nZXRVVENEYXlPZlllYXIvaW5kZXguanMnO1xuaW1wb3J0IGdldFVUQ0lTT1dlZWsgZnJvbSAnLi4vLi4vLi4vX2xpYi9nZXRVVENJU09XZWVrL2luZGV4LmpzJztcbmltcG9ydCBnZXRVVENJU09XZWVrWWVhciBmcm9tICcuLi8uLi8uLi9fbGliL2dldFVUQ0lTT1dlZWtZZWFyL2luZGV4LmpzJztcbmltcG9ydCBnZXRVVENXZWVrIGZyb20gJy4uLy4uLy4uL19saWIvZ2V0VVRDV2Vlay9pbmRleC5qcyc7XG5pbXBvcnQgZ2V0VVRDV2Vla1llYXIgZnJvbSAnLi4vLi4vLi4vX2xpYi9nZXRVVENXZWVrWWVhci9pbmRleC5qcyc7XG5pbXBvcnQgYWRkTGVhZGluZ1plcm9zIGZyb20gJy4uLy4uL2FkZExlYWRpbmdaZXJvcy9pbmRleC5qcyc7XG52YXIgZGF5UGVyaW9kRW51bSA9IHtcbiAgYW06ICdhbScsXG4gIHBtOiAncG0nLFxuICBtaWRuaWdodDogJ21pZG5pZ2h0JyxcbiAgbm9vbjogJ25vb24nLFxuICBtb3JuaW5nOiAnbW9ybmluZycsXG4gIGFmdGVybm9vbjogJ2FmdGVybm9vbicsXG4gIGV2ZW5pbmc6ICdldmVuaW5nJyxcbiAgbmlnaHQ6ICduaWdodCdcbiAgLypcbiAgICogfCAgICAgfCBVbml0ICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgfCBVbml0ICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICAgKiB8LS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18LS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18XG4gICAqIHwgIGEgIHwgQU0sIFBNICAgICAgICAgICAgICAgICAgICAgICAgIHwgIEEqIHwgTWlsbGlzZWNvbmRzIGluIGRheSAgICAgICAgICAgIHxcbiAgICogfCAgYiAgfCBBTSwgUE0sIG5vb24sIG1pZG5pZ2h0ICAgICAgICAgfCAgQiAgfCBGbGV4aWJsZSBkYXkgcGVyaW9kICAgICAgICAgICAgfFxuICAgKiB8ICBjICB8IFN0YW5kLWFsb25lIGxvY2FsIGRheSBvZiB3ZWVrICB8ICBDKiB8IExvY2FsaXplZCBob3VyIHcvIGRheSBwZXJpb2QgICB8XG4gICAqIHwgIGQgIHwgRGF5IG9mIG1vbnRoICAgICAgICAgICAgICAgICAgIHwgIEQgIHwgRGF5IG9mIHllYXIgICAgICAgICAgICAgICAgICAgIHxcbiAgICogfCAgZSAgfCBMb2NhbCBkYXkgb2Ygd2VlayAgICAgICAgICAgICAgfCAgRSAgfCBEYXkgb2Ygd2VlayAgICAgICAgICAgICAgICAgICAgfFxuICAgKiB8ICBmICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICBGKiB8IERheSBvZiB3ZWVrIGluIG1vbnRoICAgICAgICAgICB8XG4gICAqIHwgIGcqIHwgTW9kaWZpZWQgSnVsaWFuIGRheSAgICAgICAgICAgIHwgIEcgIHwgRXJhICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAgICogfCAgaCAgfCBIb3VyIFsxLTEyXSAgICAgICAgICAgICAgICAgICAgfCAgSCAgfCBIb3VyIFswLTIzXSAgICAgICAgICAgICAgICAgICAgfFxuICAgKiB8ICBpISB8IElTTyBkYXkgb2Ygd2VlayAgICAgICAgICAgICAgICB8ICBJISB8IElTTyB3ZWVrIG9mIHllYXIgICAgICAgICAgICAgICB8XG4gICAqIHwgIGoqIHwgTG9jYWxpemVkIGhvdXIgdy8gZGF5IHBlcmlvZCAgIHwgIEoqIHwgTG9jYWxpemVkIGhvdXIgdy9vIGRheSBwZXJpb2QgIHxcbiAgICogfCAgayAgfCBIb3VyIFsxLTI0XSAgICAgICAgICAgICAgICAgICAgfCAgSyAgfCBIb3VyIFswLTExXSAgICAgICAgICAgICAgICAgICAgfFxuICAgKiB8ICBsKiB8IChkZXByZWNhdGVkKSAgICAgICAgICAgICAgICAgICB8ICBMICB8IFN0YW5kLWFsb25lIG1vbnRoICAgICAgICAgICAgICB8XG4gICAqIHwgIG0gIHwgTWludXRlICAgICAgICAgICAgICAgICAgICAgICAgIHwgIE0gIHwgTW9udGggICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAgICogfCAgbiAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgTiAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICAgKiB8ICBvISB8IE9yZGluYWwgbnVtYmVyIG1vZGlmaWVyICAgICAgICB8ICBPICB8IFRpbWV6b25lIChHTVQpICAgICAgICAgICAgICAgICB8XG4gICAqIHwgIHAhIHwgTG9uZyBsb2NhbGl6ZWQgdGltZSAgICAgICAgICAgIHwgIFAhIHwgTG9uZyBsb2NhbGl6ZWQgZGF0ZSAgICAgICAgICAgIHxcbiAgICogfCAgcSAgfCBTdGFuZC1hbG9uZSBxdWFydGVyICAgICAgICAgICAgfCAgUSAgfCBRdWFydGVyICAgICAgICAgICAgICAgICAgICAgICAgfFxuICAgKiB8ICByKiB8IFJlbGF0ZWQgR3JlZ29yaWFuIHllYXIgICAgICAgICB8ICBSISB8IElTTyB3ZWVrLW51bWJlcmluZyB5ZWFyICAgICAgICB8XG4gICAqIHwgIHMgIHwgU2Vjb25kICAgICAgICAgICAgICAgICAgICAgICAgIHwgIFMgIHwgRnJhY3Rpb24gb2Ygc2Vjb25kICAgICAgICAgICAgIHxcbiAgICogfCAgdCEgfCBTZWNvbmRzIHRpbWVzdGFtcCAgICAgICAgICAgICAgfCAgVCEgfCBNaWxsaXNlY29uZHMgdGltZXN0YW1wICAgICAgICAgfFxuICAgKiB8ICB1ICB8IEV4dGVuZGVkIHllYXIgICAgICAgICAgICAgICAgICB8ICBVKiB8IEN5Y2xpYyB5ZWFyICAgICAgICAgICAgICAgICAgICB8XG4gICAqIHwgIHYqIHwgVGltZXpvbmUgKGdlbmVyaWMgbm9uLWxvY2F0LikgIHwgIFYqIHwgVGltZXpvbmUgKGxvY2F0aW9uKSAgICAgICAgICAgIHxcbiAgICogfCAgdyAgfCBMb2NhbCB3ZWVrIG9mIHllYXIgICAgICAgICAgICAgfCAgVyogfCBXZWVrIG9mIG1vbnRoICAgICAgICAgICAgICAgICAgfFxuICAgKiB8ICB4ICB8IFRpbWV6b25lIChJU08tODYwMSB3L28gWikgICAgICB8ICBYICB8IFRpbWV6b25lIChJU08tODYwMSkgICAgICAgICAgICB8XG4gICAqIHwgIHkgIHwgWWVhciAoYWJzKSAgICAgICAgICAgICAgICAgICAgIHwgIFkgIHwgTG9jYWwgd2Vlay1udW1iZXJpbmcgeWVhciAgICAgIHxcbiAgICogfCAgeiAgfCBUaW1lem9uZSAoc3BlY2lmaWMgbm9uLWxvY2F0LikgfCAgWiogfCBUaW1lem9uZSAoYWxpYXNlcykgICAgICAgICAgICAgfFxuICAgKlxuICAgKiBMZXR0ZXJzIG1hcmtlZCBieSAqIGFyZSBub3QgaW1wbGVtZW50ZWQgYnV0IHJlc2VydmVkIGJ5IFVuaWNvZGUgc3RhbmRhcmQuXG4gICAqXG4gICAqIExldHRlcnMgbWFya2VkIGJ5ICEgYXJlIG5vbi1zdGFuZGFyZCwgYnV0IGltcGxlbWVudGVkIGJ5IGRhdGUtZm5zOlxuICAgKiAtIGBvYCBtb2RpZmllcyB0aGUgcHJldmlvdXMgdG9rZW4gdG8gdHVybiBpdCBpbnRvIGFuIG9yZGluYWwgKHNlZSBgZm9ybWF0YCBkb2NzKVxuICAgKiAtIGBpYCBpcyBJU08gZGF5IG9mIHdlZWsuIEZvciBgaWAgYW5kIGBpaWAgaXMgcmV0dXJucyBudW1lcmljIElTTyB3ZWVrIGRheXMsXG4gICAqICAgaS5lLiA3IGZvciBTdW5kYXksIDEgZm9yIE1vbmRheSwgZXRjLlxuICAgKiAtIGBJYCBpcyBJU08gd2VlayBvZiB5ZWFyLCBhcyBvcHBvc2VkIHRvIGB3YCB3aGljaCBpcyBsb2NhbCB3ZWVrIG9mIHllYXIuXG4gICAqIC0gYFJgIGlzIElTTyB3ZWVrLW51bWJlcmluZyB5ZWFyLCBhcyBvcHBvc2VkIHRvIGBZYCB3aGljaCBpcyBsb2NhbCB3ZWVrLW51bWJlcmluZyB5ZWFyLlxuICAgKiAgIGBSYCBpcyBzdXBwb3NlZCB0byBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYElgIGFuZCBgaWBcbiAgICogICBmb3IgdW5pdmVyc2FsIElTTyB3ZWVrLW51bWJlcmluZyBkYXRlLCB3aGVyZWFzXG4gICAqICAgYFlgIGlzIHN1cHBvc2VkIHRvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgd2AgYW5kIGBlYFxuICAgKiAgIGZvciB3ZWVrLW51bWJlcmluZyBkYXRlIHNwZWNpZmljIHRvIHRoZSBsb2NhbGUuXG4gICAqIC0gYFBgIGlzIGxvbmcgbG9jYWxpemVkIGRhdGUgZm9ybWF0XG4gICAqIC0gYHBgIGlzIGxvbmcgbG9jYWxpemVkIHRpbWUgZm9ybWF0XG4gICAqL1xuXG59O1xudmFyIGZvcm1hdHRlcnMgPSB7XG4gIC8vIEVyYVxuICBHOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplKSB7XG4gICAgdmFyIGVyYSA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKSA+IDAgPyAxIDogMDtcblxuICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgIC8vIEFELCBCQ1xuICAgICAgY2FzZSAnRyc6XG4gICAgICBjYXNlICdHRyc6XG4gICAgICBjYXNlICdHR0cnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZXJhKGVyYSwge1xuICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnXG4gICAgICAgIH0pO1xuICAgICAgLy8gQSwgQlxuXG4gICAgICBjYXNlICdHR0dHRyc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5lcmEoZXJhLCB7XG4gICAgICAgICAgd2lkdGg6ICduYXJyb3cnXG4gICAgICAgIH0pO1xuICAgICAgLy8gQW5ubyBEb21pbmksIEJlZm9yZSBDaHJpc3RcblxuICAgICAgY2FzZSAnR0dHRyc6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZXJhKGVyYSwge1xuICAgICAgICAgIHdpZHRoOiAnd2lkZSdcbiAgICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAvLyBZZWFyXG4gIHk6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICAvLyBPcmRpbmFsIG51bWJlclxuICAgIGlmICh0b2tlbiA9PT0gJ3lvJykge1xuICAgICAgdmFyIHNpZ25lZFllYXIgPSBkYXRlLmdldFVUQ0Z1bGxZZWFyKCk7IC8vIFJldHVybnMgMSBmb3IgMSBCQyAod2hpY2ggaXMgeWVhciAwIGluIEphdmFTY3JpcHQpXG5cbiAgICAgIHZhciB5ZWFyID0gc2lnbmVkWWVhciA+IDAgPyBzaWduZWRZZWFyIDogMSAtIHNpZ25lZFllYXI7XG4gICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcih5ZWFyLCB7XG4gICAgICAgIHVuaXQ6ICd5ZWFyJ1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpZ2h0Rm9ybWF0dGVycy55KGRhdGUsIHRva2VuKTtcbiAgfSxcbiAgLy8gTG9jYWwgd2Vlay1udW1iZXJpbmcgeWVhclxuICBZOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplLCBvcHRpb25zKSB7XG4gICAgdmFyIHNpZ25lZFdlZWtZZWFyID0gZ2V0VVRDV2Vla1llYXIoZGF0ZSwgb3B0aW9ucyk7IC8vIFJldHVybnMgMSBmb3IgMSBCQyAod2hpY2ggaXMgeWVhciAwIGluIEphdmFTY3JpcHQpXG5cbiAgICB2YXIgd2Vla1llYXIgPSBzaWduZWRXZWVrWWVhciA+IDAgPyBzaWduZWRXZWVrWWVhciA6IDEgLSBzaWduZWRXZWVrWWVhcjsgLy8gVHdvIGRpZ2l0IHllYXJcblxuICAgIGlmICh0b2tlbiA9PT0gJ1lZJykge1xuICAgICAgdmFyIHR3b0RpZ2l0WWVhciA9IHdlZWtZZWFyICUgMTAwO1xuICAgICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyh0d29EaWdpdFllYXIsIDIpO1xuICAgIH0gLy8gT3JkaW5hbCBudW1iZXJcblxuXG4gICAgaWYgKHRva2VuID09PSAnWW8nKSB7XG4gICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcih3ZWVrWWVhciwge1xuICAgICAgICB1bml0OiAneWVhcidcbiAgICAgIH0pO1xuICAgIH0gLy8gUGFkZGluZ1xuXG5cbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKHdlZWtZZWFyLCB0b2tlbi5sZW5ndGgpO1xuICB9LFxuICAvLyBJU08gd2Vlay1udW1iZXJpbmcgeWVhclxuICBSOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4pIHtcbiAgICB2YXIgaXNvV2Vla1llYXIgPSBnZXRVVENJU09XZWVrWWVhcihkYXRlKTsgLy8gUGFkZGluZ1xuXG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhpc29XZWVrWWVhciwgdG9rZW4ubGVuZ3RoKTtcbiAgfSxcbiAgLy8gRXh0ZW5kZWQgeWVhci4gVGhpcyBpcyBhIHNpbmdsZSBudW1iZXIgZGVzaWduYXRpbmcgdGhlIHllYXIgb2YgdGhpcyBjYWxlbmRhciBzeXN0ZW0uXG4gIC8vIFRoZSBtYWluIGRpZmZlcmVuY2UgYmV0d2VlbiBgeWAgYW5kIGB1YCBsb2NhbGl6ZXJzIGFyZSBCLkMuIHllYXJzOlxuICAvLyB8IFllYXIgfCBgeWAgfCBgdWAgfFxuICAvLyB8LS0tLS0tfC0tLS0tfC0tLS0tfFxuICAvLyB8IEFDIDEgfCAgIDEgfCAgIDEgfFxuICAvLyB8IEJDIDEgfCAgIDEgfCAgIDAgfFxuICAvLyB8IEJDIDIgfCAgIDIgfCAgLTEgfFxuICAvLyBBbHNvIGB5eWAgYWx3YXlzIHJldHVybnMgdGhlIGxhc3QgdHdvIGRpZ2l0cyBvZiBhIHllYXIsXG4gIC8vIHdoaWxlIGB1dWAgcGFkcyBzaW5nbGUgZGlnaXQgeWVhcnMgdG8gMiBjaGFyYWN0ZXJzIGFuZCByZXR1cm5zIG90aGVyIHllYXJzIHVuY2hhbmdlZC5cbiAgdTogZnVuY3Rpb24gKGRhdGUsIHRva2VuKSB7XG4gICAgdmFyIHllYXIgPSBkYXRlLmdldFVUQ0Z1bGxZZWFyKCk7XG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyh5ZWFyLCB0b2tlbi5sZW5ndGgpO1xuICB9LFxuICAvLyBRdWFydGVyXG4gIFE6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICB2YXIgcXVhcnRlciA9IE1hdGguY2VpbCgoZGF0ZS5nZXRVVENNb250aCgpICsgMSkgLyAzKTtcblxuICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgIC8vIDEsIDIsIDMsIDRcbiAgICAgIGNhc2UgJ1EnOlxuICAgICAgICByZXR1cm4gU3RyaW5nKHF1YXJ0ZXIpO1xuICAgICAgLy8gMDEsIDAyLCAwMywgMDRcblxuICAgICAgY2FzZSAnUVEnOlxuICAgICAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKHF1YXJ0ZXIsIDIpO1xuICAgICAgLy8gMXN0LCAybmQsIDNyZCwgNHRoXG5cbiAgICAgIGNhc2UgJ1FvJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLm9yZGluYWxOdW1iZXIocXVhcnRlciwge1xuICAgICAgICAgIHVuaXQ6ICdxdWFydGVyJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIFExLCBRMiwgUTMsIFE0XG5cbiAgICAgIGNhc2UgJ1FRUSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5xdWFydGVyKHF1YXJ0ZXIsIHtcbiAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgICAvLyAxLCAyLCAzLCA0IChuYXJyb3cgcXVhcnRlcjsgY291bGQgYmUgbm90IG51bWVyaWNhbClcblxuICAgICAgY2FzZSAnUVFRUVEnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUucXVhcnRlcihxdWFydGVyLCB7XG4gICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIDFzdCBxdWFydGVyLCAybmQgcXVhcnRlciwgLi4uXG5cbiAgICAgIGNhc2UgJ1FRUVEnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLnF1YXJ0ZXIocXVhcnRlciwge1xuICAgICAgICAgIHdpZHRoOiAnd2lkZScsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgLy8gU3RhbmQtYWxvbmUgcXVhcnRlclxuICBxOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplKSB7XG4gICAgdmFyIHF1YXJ0ZXIgPSBNYXRoLmNlaWwoKGRhdGUuZ2V0VVRDTW9udGgoKSArIDEpIC8gMyk7XG5cbiAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAvLyAxLCAyLCAzLCA0XG4gICAgICBjYXNlICdxJzpcbiAgICAgICAgcmV0dXJuIFN0cmluZyhxdWFydGVyKTtcbiAgICAgIC8vIDAxLCAwMiwgMDMsIDA0XG5cbiAgICAgIGNhc2UgJ3FxJzpcbiAgICAgICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyhxdWFydGVyLCAyKTtcbiAgICAgIC8vIDFzdCwgMm5kLCAzcmQsIDR0aFxuXG4gICAgICBjYXNlICdxbyc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5vcmRpbmFsTnVtYmVyKHF1YXJ0ZXIsIHtcbiAgICAgICAgICB1bml0OiAncXVhcnRlcidcbiAgICAgICAgfSk7XG4gICAgICAvLyBRMSwgUTIsIFEzLCBRNFxuXG4gICAgICBjYXNlICdxcXEnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUucXVhcnRlcihxdWFydGVyLCB7XG4gICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgIH0pO1xuICAgICAgLy8gMSwgMiwgMywgNCAobmFycm93IHF1YXJ0ZXI7IGNvdWxkIGJlIG5vdCBudW1lcmljYWwpXG5cbiAgICAgIGNhc2UgJ3FxcXFxJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLnF1YXJ0ZXIocXVhcnRlciwge1xuICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgfSk7XG4gICAgICAvLyAxc3QgcXVhcnRlciwgMm5kIHF1YXJ0ZXIsIC4uLlxuXG4gICAgICBjYXNlICdxcXFxJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5xdWFydGVyKHF1YXJ0ZXIsIHtcbiAgICAgICAgICB3aWR0aDogJ3dpZGUnLFxuICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICB9KTtcbiAgICB9XG4gIH0sXG4gIC8vIE1vbnRoXG4gIE06IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICB2YXIgbW9udGggPSBkYXRlLmdldFVUQ01vbnRoKCk7XG5cbiAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICBjYXNlICdNJzpcbiAgICAgIGNhc2UgJ01NJzpcbiAgICAgICAgcmV0dXJuIGxpZ2h0Rm9ybWF0dGVycy5NKGRhdGUsIHRva2VuKTtcbiAgICAgIC8vIDFzdCwgMm5kLCAuLi4sIDEydGhcblxuICAgICAgY2FzZSAnTW8nOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcihtb250aCArIDEsIHtcbiAgICAgICAgICB1bml0OiAnbW9udGgnXG4gICAgICAgIH0pO1xuICAgICAgLy8gSmFuLCBGZWIsIC4uLiwgRGVjXG5cbiAgICAgIGNhc2UgJ01NTSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5tb250aChtb250aCwge1xuICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIEosIEYsIC4uLiwgRFxuXG4gICAgICBjYXNlICdNTU1NTSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5tb250aChtb250aCwge1xuICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgICAvLyBKYW51YXJ5LCBGZWJydWFyeSwgLi4uLCBEZWNlbWJlclxuXG4gICAgICBjYXNlICdNTU1NJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5tb250aChtb250aCwge1xuICAgICAgICAgIHdpZHRoOiAnd2lkZScsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgLy8gU3RhbmQtYWxvbmUgbW9udGhcbiAgTDogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBsb2NhbGl6ZSkge1xuICAgIHZhciBtb250aCA9IGRhdGUuZ2V0VVRDTW9udGgoKTtcblxuICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgIC8vIDEsIDIsIC4uLiwgMTJcbiAgICAgIGNhc2UgJ0wnOlxuICAgICAgICByZXR1cm4gU3RyaW5nKG1vbnRoICsgMSk7XG4gICAgICAvLyAwMSwgMDIsIC4uLiwgMTJcblxuICAgICAgY2FzZSAnTEwnOlxuICAgICAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKG1vbnRoICsgMSwgMik7XG4gICAgICAvLyAxc3QsIDJuZCwgLi4uLCAxMnRoXG5cbiAgICAgIGNhc2UgJ0xvJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLm9yZGluYWxOdW1iZXIobW9udGggKyAxLCB7XG4gICAgICAgICAgdW5pdDogJ21vbnRoJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIEphbiwgRmViLCAuLi4sIERlY1xuXG4gICAgICBjYXNlICdMTEwnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUubW9udGgobW9udGgsIHtcbiAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgfSk7XG4gICAgICAvLyBKLCBGLCAuLi4sIERcblxuICAgICAgY2FzZSAnTExMTEwnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUubW9udGgobW9udGgsIHtcbiAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgIH0pO1xuICAgICAgLy8gSmFudWFyeSwgRmVicnVhcnksIC4uLiwgRGVjZW1iZXJcblxuICAgICAgY2FzZSAnTExMTCc6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbG9jYWxpemUubW9udGgobW9udGgsIHtcbiAgICAgICAgICB3aWR0aDogJ3dpZGUnLFxuICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICB9KTtcbiAgICB9XG4gIH0sXG4gIC8vIExvY2FsIHdlZWsgb2YgeWVhclxuICB3OiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplLCBvcHRpb25zKSB7XG4gICAgdmFyIHdlZWsgPSBnZXRVVENXZWVrKGRhdGUsIG9wdGlvbnMpO1xuXG4gICAgaWYgKHRva2VuID09PSAnd28nKSB7XG4gICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcih3ZWVrLCB7XG4gICAgICAgIHVuaXQ6ICd3ZWVrJ1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFkZExlYWRpbmdaZXJvcyh3ZWVrLCB0b2tlbi5sZW5ndGgpO1xuICB9LFxuICAvLyBJU08gd2VlayBvZiB5ZWFyXG4gIEk6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICB2YXIgaXNvV2VlayA9IGdldFVUQ0lTT1dlZWsoZGF0ZSk7XG5cbiAgICBpZiAodG9rZW4gPT09ICdJbycpIHtcbiAgICAgIHJldHVybiBsb2NhbGl6ZS5vcmRpbmFsTnVtYmVyKGlzb1dlZWssIHtcbiAgICAgICAgdW5pdDogJ3dlZWsnXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGlzb1dlZWssIHRva2VuLmxlbmd0aCk7XG4gIH0sXG4gIC8vIERheSBvZiB0aGUgbW9udGhcbiAgZDogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBsb2NhbGl6ZSkge1xuICAgIGlmICh0b2tlbiA9PT0gJ2RvJykge1xuICAgICAgcmV0dXJuIGxvY2FsaXplLm9yZGluYWxOdW1iZXIoZGF0ZS5nZXRVVENEYXRlKCksIHtcbiAgICAgICAgdW5pdDogJ2RhdGUnXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRGb3JtYXR0ZXJzLmQoZGF0ZSwgdG9rZW4pO1xuICB9LFxuICAvLyBEYXkgb2YgeWVhclxuICBEOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplKSB7XG4gICAgdmFyIGRheU9mWWVhciA9IGdldFVUQ0RheU9mWWVhcihkYXRlKTtcblxuICAgIGlmICh0b2tlbiA9PT0gJ0RvJykge1xuICAgICAgcmV0dXJuIGxvY2FsaXplLm9yZGluYWxOdW1iZXIoZGF5T2ZZZWFyLCB7XG4gICAgICAgIHVuaXQ6ICdkYXlPZlllYXInXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGRheU9mWWVhciwgdG9rZW4ubGVuZ3RoKTtcbiAgfSxcbiAgLy8gRGF5IG9mIHdlZWtcbiAgRTogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBsb2NhbGl6ZSkge1xuICAgIHZhciBkYXlPZldlZWsgPSBkYXRlLmdldFVUQ0RheSgpO1xuXG4gICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgLy8gVHVlXG4gICAgICBjYXNlICdFJzpcbiAgICAgIGNhc2UgJ0VFJzpcbiAgICAgIGNhc2UgJ0VFRSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuICAgICAgLy8gVFxuXG4gICAgICBjYXNlICdFRUVFRSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIFR1XG5cbiAgICAgIGNhc2UgJ0VFRUVFRSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICdzaG9ydCcsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuICAgICAgLy8gVHVlc2RheVxuXG4gICAgICBjYXNlICdFRUVFJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAvLyBMb2NhbCBkYXkgb2Ygd2Vla1xuICBlOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplLCBvcHRpb25zKSB7XG4gICAgdmFyIGRheU9mV2VlayA9IGRhdGUuZ2V0VVRDRGF5KCk7XG4gICAgdmFyIGxvY2FsRGF5T2ZXZWVrID0gKGRheU9mV2VlayAtIG9wdGlvbnMud2Vla1N0YXJ0c09uICsgOCkgJSA3IHx8IDc7XG5cbiAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAvLyBOdW1lcmljYWwgdmFsdWUgKE50aCBkYXkgb2Ygd2VlayB3aXRoIGN1cnJlbnQgbG9jYWxlIG9yIHdlZWtTdGFydHNPbilcbiAgICAgIGNhc2UgJ2UnOlxuICAgICAgICByZXR1cm4gU3RyaW5nKGxvY2FsRGF5T2ZXZWVrKTtcbiAgICAgIC8vIFBhZGRlZCBudW1lcmljYWwgdmFsdWVcblxuICAgICAgY2FzZSAnZWUnOlxuICAgICAgICByZXR1cm4gYWRkTGVhZGluZ1plcm9zKGxvY2FsRGF5T2ZXZWVrLCAyKTtcbiAgICAgIC8vIDFzdCwgMm5kLCAuLi4sIDd0aFxuXG4gICAgICBjYXNlICdlbyc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5vcmRpbmFsTnVtYmVyKGxvY2FsRGF5T2ZXZWVrLCB7XG4gICAgICAgICAgdW5pdDogJ2RheSdcbiAgICAgICAgfSk7XG5cbiAgICAgIGNhc2UgJ2VlZSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuICAgICAgLy8gVFxuXG4gICAgICBjYXNlICdlZWVlZSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIFR1XG5cbiAgICAgIGNhc2UgJ2VlZWVlZSc6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICdzaG9ydCcsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuICAgICAgLy8gVHVlc2RheVxuXG4gICAgICBjYXNlICdlZWVlJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXkoZGF5T2ZXZWVrLCB7XG4gICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAvLyBTdGFuZC1hbG9uZSBsb2NhbCBkYXkgb2Ygd2Vla1xuICBjOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplLCBvcHRpb25zKSB7XG4gICAgdmFyIGRheU9mV2VlayA9IGRhdGUuZ2V0VVRDRGF5KCk7XG4gICAgdmFyIGxvY2FsRGF5T2ZXZWVrID0gKGRheU9mV2VlayAtIG9wdGlvbnMud2Vla1N0YXJ0c09uICsgOCkgJSA3IHx8IDc7XG5cbiAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAvLyBOdW1lcmljYWwgdmFsdWUgKHNhbWUgYXMgaW4gYGVgKVxuICAgICAgY2FzZSAnYyc6XG4gICAgICAgIHJldHVybiBTdHJpbmcobG9jYWxEYXlPZldlZWspO1xuICAgICAgLy8gUGFkZGVkIG51bWVyaWNhbCB2YWx1ZVxuXG4gICAgICBjYXNlICdjYyc6XG4gICAgICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MobG9jYWxEYXlPZldlZWssIHRva2VuLmxlbmd0aCk7XG4gICAgICAvLyAxc3QsIDJuZCwgLi4uLCA3dGhcblxuICAgICAgY2FzZSAnY28nOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcihsb2NhbERheU9mV2Vlaywge1xuICAgICAgICAgIHVuaXQ6ICdkYXknXG4gICAgICAgIH0pO1xuXG4gICAgICBjYXNlICdjY2MnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZGF5KGRheU9mV2Vlaywge1xuICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIFRcblxuICAgICAgY2FzZSAnY2NjY2MnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZGF5KGRheU9mV2Vlaywge1xuICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgfSk7XG4gICAgICAvLyBUdVxuXG4gICAgICBjYXNlICdjY2NjY2MnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZGF5KGRheU9mV2Vlaywge1xuICAgICAgICAgIHdpZHRoOiAnc2hvcnQnLFxuICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICB9KTtcbiAgICAgIC8vIFR1ZXNkYXlcblxuICAgICAgY2FzZSAnY2NjYyc6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZGF5KGRheU9mV2Vlaywge1xuICAgICAgICAgIHdpZHRoOiAnd2lkZScsXG4gICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgLy8gSVNPIGRheSBvZiB3ZWVrXG4gIGk6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICB2YXIgZGF5T2ZXZWVrID0gZGF0ZS5nZXRVVENEYXkoKTtcbiAgICB2YXIgaXNvRGF5T2ZXZWVrID0gZGF5T2ZXZWVrID09PSAwID8gNyA6IGRheU9mV2VlaztcblxuICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgIC8vIDJcbiAgICAgIGNhc2UgJ2knOlxuICAgICAgICByZXR1cm4gU3RyaW5nKGlzb0RheU9mV2Vlayk7XG4gICAgICAvLyAwMlxuXG4gICAgICBjYXNlICdpaSc6XG4gICAgICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoaXNvRGF5T2ZXZWVrLCB0b2tlbi5sZW5ndGgpO1xuICAgICAgLy8gMm5kXG5cbiAgICAgIGNhc2UgJ2lvJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLm9yZGluYWxOdW1iZXIoaXNvRGF5T2ZXZWVrLCB7XG4gICAgICAgICAgdW5pdDogJ2RheSdcbiAgICAgICAgfSk7XG4gICAgICAvLyBUdWVcblxuICAgICAgY2FzZSAnaWlpJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheShkYXlPZldlZWssIHtcbiAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgICAvLyBUXG5cbiAgICAgIGNhc2UgJ2lpaWlpJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheShkYXlPZldlZWssIHtcbiAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuICAgICAgLy8gVHVcblxuICAgICAgY2FzZSAnaWlpaWlpJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheShkYXlPZldlZWssIHtcbiAgICAgICAgICB3aWR0aDogJ3Nob3J0JyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgICAvLyBUdWVzZGF5XG5cbiAgICAgIGNhc2UgJ2lpaWknOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheShkYXlPZldlZWssIHtcbiAgICAgICAgICB3aWR0aDogJ3dpZGUnLFxuICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICB9KTtcbiAgICB9XG4gIH0sXG4gIC8vIEFNIG9yIFBNXG4gIGE6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICB2YXIgaG91cnMgPSBkYXRlLmdldFVUQ0hvdXJzKCk7XG4gICAgdmFyIGRheVBlcmlvZEVudW1WYWx1ZSA9IGhvdXJzIC8gMTIgPj0gMSA/ICdwbScgOiAnYW0nO1xuXG4gICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgY2FzZSAnYSc6XG4gICAgICBjYXNlICdhYSc6XG4gICAgICBjYXNlICdhYWEnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZGF5UGVyaW9kKGRheVBlcmlvZEVudW1WYWx1ZSwge1xuICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICB9KTtcblxuICAgICAgY2FzZSAnYWFhYWEnOlxuICAgICAgICByZXR1cm4gbG9jYWxpemUuZGF5UGVyaW9kKGRheVBlcmlvZEVudW1WYWx1ZSwge1xuICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG5cbiAgICAgIGNhc2UgJ2FhYWEnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheVBlcmlvZChkYXlQZXJpb2RFbnVtVmFsdWUsIHtcbiAgICAgICAgICB3aWR0aDogJ3dpZGUnLFxuICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICB9KTtcbiAgICB9XG4gIH0sXG4gIC8vIEFNLCBQTSwgbWlkbmlnaHQsIG5vb25cbiAgYjogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBsb2NhbGl6ZSkge1xuICAgIHZhciBob3VycyA9IGRhdGUuZ2V0VVRDSG91cnMoKTtcbiAgICB2YXIgZGF5UGVyaW9kRW51bVZhbHVlO1xuXG4gICAgaWYgKGhvdXJzID09PSAxMikge1xuICAgICAgZGF5UGVyaW9kRW51bVZhbHVlID0gZGF5UGVyaW9kRW51bS5ub29uO1xuICAgIH0gZWxzZSBpZiAoaG91cnMgPT09IDApIHtcbiAgICAgIGRheVBlcmlvZEVudW1WYWx1ZSA9IGRheVBlcmlvZEVudW0ubWlkbmlnaHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRheVBlcmlvZEVudW1WYWx1ZSA9IGhvdXJzIC8gMTIgPj0gMSA/ICdwbScgOiAnYW0nO1xuICAgIH1cblxuICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgIGNhc2UgJ2InOlxuICAgICAgY2FzZSAnYmInOlxuICAgICAgY2FzZSAnYmJiJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheVBlcmlvZChkYXlQZXJpb2RFbnVtVmFsdWUsIHtcbiAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG5cbiAgICAgIGNhc2UgJ2JiYmJiJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheVBlcmlvZChkYXlQZXJpb2RFbnVtVmFsdWUsIHtcbiAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuXG4gICAgICBjYXNlICdiYmJiJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXlQZXJpb2QoZGF5UGVyaW9kRW51bVZhbHVlLCB7XG4gICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAvLyBpbiB0aGUgbW9ybmluZywgaW4gdGhlIGFmdGVybm9vbiwgaW4gdGhlIGV2ZW5pbmcsIGF0IG5pZ2h0XG4gIEI6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICB2YXIgaG91cnMgPSBkYXRlLmdldFVUQ0hvdXJzKCk7XG4gICAgdmFyIGRheVBlcmlvZEVudW1WYWx1ZTtcblxuICAgIGlmIChob3VycyA+PSAxNykge1xuICAgICAgZGF5UGVyaW9kRW51bVZhbHVlID0gZGF5UGVyaW9kRW51bS5ldmVuaW5nO1xuICAgIH0gZWxzZSBpZiAoaG91cnMgPj0gMTIpIHtcbiAgICAgIGRheVBlcmlvZEVudW1WYWx1ZSA9IGRheVBlcmlvZEVudW0uYWZ0ZXJub29uO1xuICAgIH0gZWxzZSBpZiAoaG91cnMgPj0gNCkge1xuICAgICAgZGF5UGVyaW9kRW51bVZhbHVlID0gZGF5UGVyaW9kRW51bS5tb3JuaW5nO1xuICAgIH0gZWxzZSB7XG4gICAgICBkYXlQZXJpb2RFbnVtVmFsdWUgPSBkYXlQZXJpb2RFbnVtLm5pZ2h0O1xuICAgIH1cblxuICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgIGNhc2UgJ0InOlxuICAgICAgY2FzZSAnQkInOlxuICAgICAgY2FzZSAnQkJCJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheVBlcmlvZChkYXlQZXJpb2RFbnVtVmFsdWUsIHtcbiAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG5cbiAgICAgIGNhc2UgJ0JCQkJCJzpcbiAgICAgICAgcmV0dXJuIGxvY2FsaXplLmRheVBlcmlvZChkYXlQZXJpb2RFbnVtVmFsdWUsIHtcbiAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgIH0pO1xuXG4gICAgICBjYXNlICdCQkJCJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsb2NhbGl6ZS5kYXlQZXJpb2QoZGF5UGVyaW9kRW51bVZhbHVlLCB7XG4gICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAvLyBIb3VyIFsxLTEyXVxuICBoOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplKSB7XG4gICAgaWYgKHRva2VuID09PSAnaG8nKSB7XG4gICAgICB2YXIgaG91cnMgPSBkYXRlLmdldFVUQ0hvdXJzKCkgJSAxMjtcbiAgICAgIGlmIChob3VycyA9PT0gMCkgaG91cnMgPSAxMjtcbiAgICAgIHJldHVybiBsb2NhbGl6ZS5vcmRpbmFsTnVtYmVyKGhvdXJzLCB7XG4gICAgICAgIHVuaXQ6ICdob3VyJ1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpZ2h0Rm9ybWF0dGVycy5oKGRhdGUsIHRva2VuKTtcbiAgfSxcbiAgLy8gSG91ciBbMC0yM11cbiAgSDogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBsb2NhbGl6ZSkge1xuICAgIGlmICh0b2tlbiA9PT0gJ0hvJykge1xuICAgICAgcmV0dXJuIGxvY2FsaXplLm9yZGluYWxOdW1iZXIoZGF0ZS5nZXRVVENIb3VycygpLCB7XG4gICAgICAgIHVuaXQ6ICdob3VyJ1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpZ2h0Rm9ybWF0dGVycy5IKGRhdGUsIHRva2VuKTtcbiAgfSxcbiAgLy8gSG91ciBbMC0xMV1cbiAgSzogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBsb2NhbGl6ZSkge1xuICAgIHZhciBob3VycyA9IGRhdGUuZ2V0VVRDSG91cnMoKSAlIDEyO1xuXG4gICAgaWYgKHRva2VuID09PSAnS28nKSB7XG4gICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcihob3Vycywge1xuICAgICAgICB1bml0OiAnaG91cidcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoaG91cnMsIHRva2VuLmxlbmd0aCk7XG4gIH0sXG4gIC8vIEhvdXIgWzEtMjRdXG4gIGs6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICB2YXIgaG91cnMgPSBkYXRlLmdldFVUQ0hvdXJzKCk7XG4gICAgaWYgKGhvdXJzID09PSAwKSBob3VycyA9IDI0O1xuXG4gICAgaWYgKHRva2VuID09PSAna28nKSB7XG4gICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcihob3Vycywge1xuICAgICAgICB1bml0OiAnaG91cidcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3MoaG91cnMsIHRva2VuLmxlbmd0aCk7XG4gIH0sXG4gIC8vIE1pbnV0ZVxuICBtOiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIGxvY2FsaXplKSB7XG4gICAgaWYgKHRva2VuID09PSAnbW8nKSB7XG4gICAgICByZXR1cm4gbG9jYWxpemUub3JkaW5hbE51bWJlcihkYXRlLmdldFVUQ01pbnV0ZXMoKSwge1xuICAgICAgICB1bml0OiAnbWludXRlJ1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpZ2h0Rm9ybWF0dGVycy5tKGRhdGUsIHRva2VuKTtcbiAgfSxcbiAgLy8gU2Vjb25kXG4gIHM6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgbG9jYWxpemUpIHtcbiAgICBpZiAodG9rZW4gPT09ICdzbycpIHtcbiAgICAgIHJldHVybiBsb2NhbGl6ZS5vcmRpbmFsTnVtYmVyKGRhdGUuZ2V0VVRDU2Vjb25kcygpLCB7XG4gICAgICAgIHVuaXQ6ICdzZWNvbmQnXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRGb3JtYXR0ZXJzLnMoZGF0ZSwgdG9rZW4pO1xuICB9LFxuICAvLyBGcmFjdGlvbiBvZiBzZWNvbmRcbiAgUzogZnVuY3Rpb24gKGRhdGUsIHRva2VuKSB7XG4gICAgcmV0dXJuIGxpZ2h0Rm9ybWF0dGVycy5TKGRhdGUsIHRva2VuKTtcbiAgfSxcbiAgLy8gVGltZXpvbmUgKElTTy04NjAxLiBJZiBvZmZzZXQgaXMgMCwgb3V0cHV0IGlzIGFsd2F5cyBgJ1onYClcbiAgWDogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBfbG9jYWxpemUsIG9wdGlvbnMpIHtcbiAgICB2YXIgb3JpZ2luYWxEYXRlID0gb3B0aW9ucy5fb3JpZ2luYWxEYXRlIHx8IGRhdGU7XG4gICAgdmFyIHRpbWV6b25lT2Zmc2V0ID0gb3JpZ2luYWxEYXRlLmdldFRpbWV6b25lT2Zmc2V0KCk7XG5cbiAgICBpZiAodGltZXpvbmVPZmZzZXQgPT09IDApIHtcbiAgICAgIHJldHVybiAnWic7XG4gICAgfVxuXG4gICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgLy8gSG91cnMgYW5kIG9wdGlvbmFsIG1pbnV0ZXNcbiAgICAgIGNhc2UgJ1gnOlxuICAgICAgICByZXR1cm4gZm9ybWF0VGltZXpvbmVXaXRoT3B0aW9uYWxNaW51dGVzKHRpbWV6b25lT2Zmc2V0KTtcbiAgICAgIC8vIEhvdXJzLCBtaW51dGVzIGFuZCBvcHRpb25hbCBzZWNvbmRzIHdpdGhvdXQgYDpgIGRlbGltaXRlclxuICAgICAgLy8gTm90ZTogbmVpdGhlciBJU08tODYwMSBub3IgSmF2YVNjcmlwdCBzdXBwb3J0cyBzZWNvbmRzIGluIHRpbWV6b25lIG9mZnNldHNcbiAgICAgIC8vIHNvIHRoaXMgdG9rZW4gYWx3YXlzIGhhcyB0aGUgc2FtZSBvdXRwdXQgYXMgYFhYYFxuXG4gICAgICBjYXNlICdYWFhYJzpcbiAgICAgIGNhc2UgJ1hYJzpcbiAgICAgICAgLy8gSG91cnMgYW5kIG1pbnV0ZXMgd2l0aG91dCBgOmAgZGVsaW1pdGVyXG4gICAgICAgIHJldHVybiBmb3JtYXRUaW1lem9uZSh0aW1lem9uZU9mZnNldCk7XG4gICAgICAvLyBIb3VycywgbWludXRlcyBhbmQgb3B0aW9uYWwgc2Vjb25kcyB3aXRoIGA6YCBkZWxpbWl0ZXJcbiAgICAgIC8vIE5vdGU6IG5laXRoZXIgSVNPLTg2MDEgbm9yIEphdmFTY3JpcHQgc3VwcG9ydHMgc2Vjb25kcyBpbiB0aW1lem9uZSBvZmZzZXRzXG4gICAgICAvLyBzbyB0aGlzIHRva2VuIGFsd2F5cyBoYXMgdGhlIHNhbWUgb3V0cHV0IGFzIGBYWFhgXG5cbiAgICAgIGNhc2UgJ1hYWFhYJzpcbiAgICAgIGNhc2UgJ1hYWCc6IC8vIEhvdXJzIGFuZCBtaW51dGVzIHdpdGggYDpgIGRlbGltaXRlclxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gZm9ybWF0VGltZXpvbmUodGltZXpvbmVPZmZzZXQsICc6Jyk7XG4gICAgfVxuICB9LFxuICAvLyBUaW1lem9uZSAoSVNPLTg2MDEuIElmIG9mZnNldCBpcyAwLCBvdXRwdXQgaXMgYCcrMDA6MDAnYCBvciBlcXVpdmFsZW50KVxuICB4OiBmdW5jdGlvbiAoZGF0ZSwgdG9rZW4sIF9sb2NhbGl6ZSwgb3B0aW9ucykge1xuICAgIHZhciBvcmlnaW5hbERhdGUgPSBvcHRpb25zLl9vcmlnaW5hbERhdGUgfHwgZGF0ZTtcbiAgICB2YXIgdGltZXpvbmVPZmZzZXQgPSBvcmlnaW5hbERhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKTtcblxuICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgIC8vIEhvdXJzIGFuZCBvcHRpb25hbCBtaW51dGVzXG4gICAgICBjYXNlICd4JzpcbiAgICAgICAgcmV0dXJuIGZvcm1hdFRpbWV6b25lV2l0aE9wdGlvbmFsTWludXRlcyh0aW1lem9uZU9mZnNldCk7XG4gICAgICAvLyBIb3VycywgbWludXRlcyBhbmQgb3B0aW9uYWwgc2Vjb25kcyB3aXRob3V0IGA6YCBkZWxpbWl0ZXJcbiAgICAgIC8vIE5vdGU6IG5laXRoZXIgSVNPLTg2MDEgbm9yIEphdmFTY3JpcHQgc3VwcG9ydHMgc2Vjb25kcyBpbiB0aW1lem9uZSBvZmZzZXRzXG4gICAgICAvLyBzbyB0aGlzIHRva2VuIGFsd2F5cyBoYXMgdGhlIHNhbWUgb3V0cHV0IGFzIGB4eGBcblxuICAgICAgY2FzZSAneHh4eCc6XG4gICAgICBjYXNlICd4eCc6XG4gICAgICAgIC8vIEhvdXJzIGFuZCBtaW51dGVzIHdpdGhvdXQgYDpgIGRlbGltaXRlclxuICAgICAgICByZXR1cm4gZm9ybWF0VGltZXpvbmUodGltZXpvbmVPZmZzZXQpO1xuICAgICAgLy8gSG91cnMsIG1pbnV0ZXMgYW5kIG9wdGlvbmFsIHNlY29uZHMgd2l0aCBgOmAgZGVsaW1pdGVyXG4gICAgICAvLyBOb3RlOiBuZWl0aGVyIElTTy04NjAxIG5vciBKYXZhU2NyaXB0IHN1cHBvcnRzIHNlY29uZHMgaW4gdGltZXpvbmUgb2Zmc2V0c1xuICAgICAgLy8gc28gdGhpcyB0b2tlbiBhbHdheXMgaGFzIHRoZSBzYW1lIG91dHB1dCBhcyBgeHh4YFxuXG4gICAgICBjYXNlICd4eHh4eCc6XG4gICAgICBjYXNlICd4eHgnOiAvLyBIb3VycyBhbmQgbWludXRlcyB3aXRoIGA6YCBkZWxpbWl0ZXJcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGZvcm1hdFRpbWV6b25lKHRpbWV6b25lT2Zmc2V0LCAnOicpO1xuICAgIH1cbiAgfSxcbiAgLy8gVGltZXpvbmUgKEdNVClcbiAgTzogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBfbG9jYWxpemUsIG9wdGlvbnMpIHtcbiAgICB2YXIgb3JpZ2luYWxEYXRlID0gb3B0aW9ucy5fb3JpZ2luYWxEYXRlIHx8IGRhdGU7XG4gICAgdmFyIHRpbWV6b25lT2Zmc2V0ID0gb3JpZ2luYWxEYXRlLmdldFRpbWV6b25lT2Zmc2V0KCk7XG5cbiAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAvLyBTaG9ydFxuICAgICAgY2FzZSAnTyc6XG4gICAgICBjYXNlICdPTyc6XG4gICAgICBjYXNlICdPT08nOlxuICAgICAgICByZXR1cm4gJ0dNVCcgKyBmb3JtYXRUaW1lem9uZVNob3J0KHRpbWV6b25lT2Zmc2V0LCAnOicpO1xuICAgICAgLy8gTG9uZ1xuXG4gICAgICBjYXNlICdPT09PJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAnR01UJyArIGZvcm1hdFRpbWV6b25lKHRpbWV6b25lT2Zmc2V0LCAnOicpO1xuICAgIH1cbiAgfSxcbiAgLy8gVGltZXpvbmUgKHNwZWNpZmljIG5vbi1sb2NhdGlvbilcbiAgejogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBfbG9jYWxpemUsIG9wdGlvbnMpIHtcbiAgICB2YXIgb3JpZ2luYWxEYXRlID0gb3B0aW9ucy5fb3JpZ2luYWxEYXRlIHx8IGRhdGU7XG4gICAgdmFyIHRpbWV6b25lT2Zmc2V0ID0gb3JpZ2luYWxEYXRlLmdldFRpbWV6b25lT2Zmc2V0KCk7XG5cbiAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAvLyBTaG9ydFxuICAgICAgY2FzZSAneic6XG4gICAgICBjYXNlICd6eic6XG4gICAgICBjYXNlICd6enonOlxuICAgICAgICByZXR1cm4gJ0dNVCcgKyBmb3JtYXRUaW1lem9uZVNob3J0KHRpbWV6b25lT2Zmc2V0LCAnOicpO1xuICAgICAgLy8gTG9uZ1xuXG4gICAgICBjYXNlICd6enp6JzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAnR01UJyArIGZvcm1hdFRpbWV6b25lKHRpbWV6b25lT2Zmc2V0LCAnOicpO1xuICAgIH1cbiAgfSxcbiAgLy8gU2Vjb25kcyB0aW1lc3RhbXBcbiAgdDogZnVuY3Rpb24gKGRhdGUsIHRva2VuLCBfbG9jYWxpemUsIG9wdGlvbnMpIHtcbiAgICB2YXIgb3JpZ2luYWxEYXRlID0gb3B0aW9ucy5fb3JpZ2luYWxEYXRlIHx8IGRhdGU7XG4gICAgdmFyIHRpbWVzdGFtcCA9IE1hdGguZmxvb3Iob3JpZ2luYWxEYXRlLmdldFRpbWUoKSAvIDEwMDApO1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3ModGltZXN0YW1wLCB0b2tlbi5sZW5ndGgpO1xuICB9LFxuICAvLyBNaWxsaXNlY29uZHMgdGltZXN0YW1wXG4gIFQ6IGZ1bmN0aW9uIChkYXRlLCB0b2tlbiwgX2xvY2FsaXplLCBvcHRpb25zKSB7XG4gICAgdmFyIG9yaWdpbmFsRGF0ZSA9IG9wdGlvbnMuX29yaWdpbmFsRGF0ZSB8fCBkYXRlO1xuICAgIHZhciB0aW1lc3RhbXAgPSBvcmlnaW5hbERhdGUuZ2V0VGltZSgpO1xuICAgIHJldHVybiBhZGRMZWFkaW5nWmVyb3ModGltZXN0YW1wLCB0b2tlbi5sZW5ndGgpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBmb3JtYXRUaW1lem9uZVNob3J0KG9mZnNldCwgZGlydHlEZWxpbWl0ZXIpIHtcbiAgdmFyIHNpZ24gPSBvZmZzZXQgPiAwID8gJy0nIDogJysnO1xuICB2YXIgYWJzT2Zmc2V0ID0gTWF0aC5hYnMob2Zmc2V0KTtcbiAgdmFyIGhvdXJzID0gTWF0aC5mbG9vcihhYnNPZmZzZXQgLyA2MCk7XG4gIHZhciBtaW51dGVzID0gYWJzT2Zmc2V0ICUgNjA7XG5cbiAgaWYgKG1pbnV0ZXMgPT09IDApIHtcbiAgICByZXR1cm4gc2lnbiArIFN0cmluZyhob3Vycyk7XG4gIH1cblxuICB2YXIgZGVsaW1pdGVyID0gZGlydHlEZWxpbWl0ZXIgfHwgJyc7XG4gIHJldHVybiBzaWduICsgU3RyaW5nKGhvdXJzKSArIGRlbGltaXRlciArIGFkZExlYWRpbmdaZXJvcyhtaW51dGVzLCAyKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0VGltZXpvbmVXaXRoT3B0aW9uYWxNaW51dGVzKG9mZnNldCwgZGlydHlEZWxpbWl0ZXIpIHtcbiAgaWYgKG9mZnNldCAlIDYwID09PSAwKSB7XG4gICAgdmFyIHNpZ24gPSBvZmZzZXQgPiAwID8gJy0nIDogJysnO1xuICAgIHJldHVybiBzaWduICsgYWRkTGVhZGluZ1plcm9zKE1hdGguYWJzKG9mZnNldCkgLyA2MCwgMik7XG4gIH1cblxuICByZXR1cm4gZm9ybWF0VGltZXpvbmUob2Zmc2V0LCBkaXJ0eURlbGltaXRlcik7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFRpbWV6b25lKG9mZnNldCwgZGlydHlEZWxpbWl0ZXIpIHtcbiAgdmFyIGRlbGltaXRlciA9IGRpcnR5RGVsaW1pdGVyIHx8ICcnO1xuICB2YXIgc2lnbiA9IG9mZnNldCA+IDAgPyAnLScgOiAnKyc7XG4gIHZhciBhYnNPZmZzZXQgPSBNYXRoLmFicyhvZmZzZXQpO1xuICB2YXIgaG91cnMgPSBhZGRMZWFkaW5nWmVyb3MoTWF0aC5mbG9vcihhYnNPZmZzZXQgLyA2MCksIDIpO1xuICB2YXIgbWludXRlcyA9IGFkZExlYWRpbmdaZXJvcyhhYnNPZmZzZXQgJSA2MCwgMik7XG4gIHJldHVybiBzaWduICsgaG91cnMgKyBkZWxpbWl0ZXIgKyBtaW51dGVzO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmb3JtYXR0ZXJzOyIsImZ1bmN0aW9uIGRhdGVMb25nRm9ybWF0dGVyKHBhdHRlcm4sIGZvcm1hdExvbmcpIHtcbiAgc3dpdGNoIChwYXR0ZXJuKSB7XG4gICAgY2FzZSAnUCc6XG4gICAgICByZXR1cm4gZm9ybWF0TG9uZy5kYXRlKHtcbiAgICAgICAgd2lkdGg6ICdzaG9ydCdcbiAgICAgIH0pO1xuXG4gICAgY2FzZSAnUFAnOlxuICAgICAgcmV0dXJuIGZvcm1hdExvbmcuZGF0ZSh7XG4gICAgICAgIHdpZHRoOiAnbWVkaXVtJ1xuICAgICAgfSk7XG5cbiAgICBjYXNlICdQUFAnOlxuICAgICAgcmV0dXJuIGZvcm1hdExvbmcuZGF0ZSh7XG4gICAgICAgIHdpZHRoOiAnbG9uZydcbiAgICAgIH0pO1xuXG4gICAgY2FzZSAnUFBQUCc6XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmb3JtYXRMb25nLmRhdGUoe1xuICAgICAgICB3aWR0aDogJ2Z1bGwnXG4gICAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0aW1lTG9uZ0Zvcm1hdHRlcihwYXR0ZXJuLCBmb3JtYXRMb25nKSB7XG4gIHN3aXRjaCAocGF0dGVybikge1xuICAgIGNhc2UgJ3AnOlxuICAgICAgcmV0dXJuIGZvcm1hdExvbmcudGltZSh7XG4gICAgICAgIHdpZHRoOiAnc2hvcnQnXG4gICAgICB9KTtcblxuICAgIGNhc2UgJ3BwJzpcbiAgICAgIHJldHVybiBmb3JtYXRMb25nLnRpbWUoe1xuICAgICAgICB3aWR0aDogJ21lZGl1bSdcbiAgICAgIH0pO1xuXG4gICAgY2FzZSAncHBwJzpcbiAgICAgIHJldHVybiBmb3JtYXRMb25nLnRpbWUoe1xuICAgICAgICB3aWR0aDogJ2xvbmcnXG4gICAgICB9KTtcblxuICAgIGNhc2UgJ3BwcHAnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZm9ybWF0TG9uZy50aW1lKHtcbiAgICAgICAgd2lkdGg6ICdmdWxsJ1xuICAgICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGF0ZVRpbWVMb25nRm9ybWF0dGVyKHBhdHRlcm4sIGZvcm1hdExvbmcpIHtcbiAgdmFyIG1hdGNoUmVzdWx0ID0gcGF0dGVybi5tYXRjaCgvKFArKShwKyk/Lyk7XG4gIHZhciBkYXRlUGF0dGVybiA9IG1hdGNoUmVzdWx0WzFdO1xuICB2YXIgdGltZVBhdHRlcm4gPSBtYXRjaFJlc3VsdFsyXTtcblxuICBpZiAoIXRpbWVQYXR0ZXJuKSB7XG4gICAgcmV0dXJuIGRhdGVMb25nRm9ybWF0dGVyKHBhdHRlcm4sIGZvcm1hdExvbmcpO1xuICB9XG5cbiAgdmFyIGRhdGVUaW1lRm9ybWF0O1xuXG4gIHN3aXRjaCAoZGF0ZVBhdHRlcm4pIHtcbiAgICBjYXNlICdQJzpcbiAgICAgIGRhdGVUaW1lRm9ybWF0ID0gZm9ybWF0TG9uZy5kYXRlVGltZSh7XG4gICAgICAgIHdpZHRoOiAnc2hvcnQnXG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnUFAnOlxuICAgICAgZGF0ZVRpbWVGb3JtYXQgPSBmb3JtYXRMb25nLmRhdGVUaW1lKHtcbiAgICAgICAgd2lkdGg6ICdtZWRpdW0nXG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnUFBQJzpcbiAgICAgIGRhdGVUaW1lRm9ybWF0ID0gZm9ybWF0TG9uZy5kYXRlVGltZSh7XG4gICAgICAgIHdpZHRoOiAnbG9uZydcbiAgICAgIH0pO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdQUFBQJzpcbiAgICBkZWZhdWx0OlxuICAgICAgZGF0ZVRpbWVGb3JtYXQgPSBmb3JtYXRMb25nLmRhdGVUaW1lKHtcbiAgICAgICAgd2lkdGg6ICdmdWxsJ1xuICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIHJldHVybiBkYXRlVGltZUZvcm1hdC5yZXBsYWNlKCd7e2RhdGV9fScsIGRhdGVMb25nRm9ybWF0dGVyKGRhdGVQYXR0ZXJuLCBmb3JtYXRMb25nKSkucmVwbGFjZSgne3t0aW1lfX0nLCB0aW1lTG9uZ0Zvcm1hdHRlcih0aW1lUGF0dGVybiwgZm9ybWF0TG9uZykpO1xufVxuXG52YXIgbG9uZ0Zvcm1hdHRlcnMgPSB7XG4gIHA6IHRpbWVMb25nRm9ybWF0dGVyLFxuICBQOiBkYXRlVGltZUxvbmdGb3JtYXR0ZXJcbn07XG5leHBvcnQgZGVmYXVsdCBsb25nRm9ybWF0dGVyczsiLCJ2YXIgcHJvdGVjdGVkRGF5T2ZZZWFyVG9rZW5zID0gWydEJywgJ0REJ107XG52YXIgcHJvdGVjdGVkV2Vla1llYXJUb2tlbnMgPSBbJ1lZJywgJ1lZWVknXTtcbmV4cG9ydCBmdW5jdGlvbiBpc1Byb3RlY3RlZERheU9mWWVhclRva2VuKHRva2VuKSB7XG4gIHJldHVybiBwcm90ZWN0ZWREYXlPZlllYXJUb2tlbnMuaW5kZXhPZih0b2tlbikgIT09IC0xO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvdGVjdGVkV2Vla1llYXJUb2tlbih0b2tlbikge1xuICByZXR1cm4gcHJvdGVjdGVkV2Vla1llYXJUb2tlbnMuaW5kZXhPZih0b2tlbikgIT09IC0xO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRocm93UHJvdGVjdGVkRXJyb3IodG9rZW4pIHtcbiAgaWYgKHRva2VuID09PSAnWVlZWScpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVXNlIGB5eXl5YCBpbnN0ZWFkIG9mIGBZWVlZYCBmb3IgZm9ybWF0dGluZyB5ZWFyczsgc2VlOiBodHRwczovL2dpdC5pby9meEN5cicpO1xuICB9IGVsc2UgaWYgKHRva2VuID09PSAnWVknKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1VzZSBgeXlgIGluc3RlYWQgb2YgYFlZYCBmb3IgZm9ybWF0dGluZyB5ZWFyczsgc2VlOiBodHRwczovL2dpdC5pby9meEN5cicpO1xuICB9IGVsc2UgaWYgKHRva2VuID09PSAnRCcpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVXNlIGBkYCBpbnN0ZWFkIG9mIGBEYCBmb3IgZm9ybWF0dGluZyBkYXlzIG9mIHRoZSBtb250aDsgc2VlOiBodHRwczovL2dpdC5pby9meEN5cicpO1xuICB9IGVsc2UgaWYgKHRva2VuID09PSAnREQnKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1VzZSBgZGRgIGluc3RlYWQgb2YgYEREYCBmb3IgZm9ybWF0dGluZyBkYXlzIG9mIHRoZSBtb250aDsgc2VlOiBodHRwczovL2dpdC5pby9meEN5cicpO1xuICB9XG59IiwiaW1wb3J0IGlzVmFsaWQgZnJvbSAnLi4vaXNWYWxpZC9pbmRleC5qcyc7XG5pbXBvcnQgZGVmYXVsdExvY2FsZSBmcm9tICcuLi9sb2NhbGUvZW4tVVMvaW5kZXguanMnO1xuaW1wb3J0IHN1Yk1pbGxpc2Vjb25kcyBmcm9tICcuLi9zdWJNaWxsaXNlY29uZHMvaW5kZXguanMnO1xuaW1wb3J0IHRvRGF0ZSBmcm9tICcuLi90b0RhdGUvaW5kZXguanMnO1xuaW1wb3J0IGZvcm1hdHRlcnMgZnJvbSAnLi4vX2xpYi9mb3JtYXQvZm9ybWF0dGVycy9pbmRleC5qcyc7XG5pbXBvcnQgbG9uZ0Zvcm1hdHRlcnMgZnJvbSAnLi4vX2xpYi9mb3JtYXQvbG9uZ0Zvcm1hdHRlcnMvaW5kZXguanMnO1xuaW1wb3J0IGdldFRpbWV6b25lT2Zmc2V0SW5NaWxsaXNlY29uZHMgZnJvbSAnLi4vX2xpYi9nZXRUaW1lem9uZU9mZnNldEluTWlsbGlzZWNvbmRzL2luZGV4LmpzJztcbmltcG9ydCB7IGlzUHJvdGVjdGVkRGF5T2ZZZWFyVG9rZW4sIGlzUHJvdGVjdGVkV2Vla1llYXJUb2tlbiwgdGhyb3dQcm90ZWN0ZWRFcnJvciB9IGZyb20gJy4uL19saWIvcHJvdGVjdGVkVG9rZW5zL2luZGV4LmpzJztcbmltcG9ydCB0b0ludGVnZXIgZnJvbSAnLi4vX2xpYi90b0ludGVnZXIvaW5kZXguanMnOyAvLyBUaGlzIFJlZ0V4cCBjb25zaXN0cyBvZiB0aHJlZSBwYXJ0cyBzZXBhcmF0ZWQgYnkgYHxgOlxuLy8gLSBbeVlRcU1Md0lkRGVjaWhIS2ttc11vIG1hdGNoZXMgYW55IGF2YWlsYWJsZSBvcmRpbmFsIG51bWJlciB0b2tlblxuLy8gICAob25lIG9mIHRoZSBjZXJ0YWluIGxldHRlcnMgZm9sbG93ZWQgYnkgYG9gKVxuLy8gLSAoXFx3KVxcMSogbWF0Y2hlcyBhbnkgc2VxdWVuY2VzIG9mIHRoZSBzYW1lIGxldHRlclxuLy8gLSAnJyBtYXRjaGVzIHR3byBxdW90ZSBjaGFyYWN0ZXJzIGluIGEgcm93XG4vLyAtICcoJyd8W14nXSkrKCd8JCkgbWF0Y2hlcyBhbnl0aGluZyBzdXJyb3VuZGVkIGJ5IHR3byBxdW90ZSBjaGFyYWN0ZXJzICgnKSxcbi8vICAgZXhjZXB0IGEgc2luZ2xlIHF1b3RlIHN5bWJvbCwgd2hpY2ggZW5kcyB0aGUgc2VxdWVuY2UuXG4vLyAgIFR3byBxdW90ZSBjaGFyYWN0ZXJzIGRvIG5vdCBlbmQgdGhlIHNlcXVlbmNlLlxuLy8gICBJZiB0aGVyZSBpcyBubyBtYXRjaGluZyBzaW5nbGUgcXVvdGVcbi8vICAgdGhlbiB0aGUgc2VxdWVuY2Ugd2lsbCBjb250aW51ZSB1bnRpbCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcuXG4vLyAtIC4gbWF0Y2hlcyBhbnkgc2luZ2xlIGNoYXJhY3RlciB1bm1hdGNoZWQgYnkgcHJldmlvdXMgcGFydHMgb2YgdGhlIFJlZ0V4cHNcblxudmFyIGZvcm1hdHRpbmdUb2tlbnNSZWdFeHAgPSAvW3lZUXFNTHdJZERlY2loSEtrbXNdb3woXFx3KVxcMSp8Jyd8JygnJ3xbXiddKSsoJ3wkKXwuL2c7IC8vIFRoaXMgUmVnRXhwIGNhdGNoZXMgc3ltYm9scyBlc2NhcGVkIGJ5IHF1b3RlcywgYW5kIGFsc29cbi8vIHNlcXVlbmNlcyBvZiBzeW1ib2xzIFAsIHAsIGFuZCB0aGUgY29tYmluYXRpb25zIGxpa2UgYFBQUFBQUFBwcHBwcGBcblxudmFyIGxvbmdGb3JtYXR0aW5nVG9rZW5zUmVnRXhwID0gL1ArcCt8UCt8cCt8Jyd8JygnJ3xbXiddKSsoJ3wkKXwuL2c7XG52YXIgZXNjYXBlZFN0cmluZ1JlZ0V4cCA9IC9eJyhbXl0qPyknPyQvO1xudmFyIGRvdWJsZVF1b3RlUmVnRXhwID0gLycnL2c7XG52YXIgdW5lc2NhcGVkTGF0aW5DaGFyYWN0ZXJSZWdFeHAgPSAvW2EtekEtWl0vO1xuLyoqXG4gKiBAbmFtZSBmb3JtYXRcbiAqIEBjYXRlZ29yeSBDb21tb24gSGVscGVyc1xuICogQHN1bW1hcnkgRm9ybWF0IHRoZSBkYXRlLlxuICpcbiAqIEBkZXNjcmlwdGlvblxuICogUmV0dXJuIHRoZSBmb3JtYXR0ZWQgZGF0ZSBzdHJpbmcgaW4gdGhlIGdpdmVuIGZvcm1hdC4gVGhlIHJlc3VsdCBtYXkgdmFyeSBieSBsb2NhbGUuXG4gKlxuICogPiDimqDvuI8gUGxlYXNlIG5vdGUgdGhhdCB0aGUgYGZvcm1hdGAgdG9rZW5zIGRpZmZlciBmcm9tIE1vbWVudC5qcyBhbmQgb3RoZXIgbGlicmFyaWVzLlxuICogPiBTZWU6IGh0dHBzOi8vZ2l0LmlvL2Z4Q3lyXG4gKlxuICogVGhlIGNoYXJhY3RlcnMgd3JhcHBlZCBiZXR3ZWVuIHR3byBzaW5nbGUgcXVvdGVzIGNoYXJhY3RlcnMgKCcpIGFyZSBlc2NhcGVkLlxuICogVHdvIHNpbmdsZSBxdW90ZXMgaW4gYSByb3csIHdoZXRoZXIgaW5zaWRlIG9yIG91dHNpZGUgYSBxdW90ZWQgc2VxdWVuY2UsIHJlcHJlc2VudCBhICdyZWFsJyBzaW5nbGUgcXVvdGUuXG4gKiAoc2VlIHRoZSBsYXN0IGV4YW1wbGUpXG4gKlxuICogRm9ybWF0IG9mIHRoZSBzdHJpbmcgaXMgYmFzZWQgb24gVW5pY29kZSBUZWNobmljYWwgU3RhbmRhcmQgIzM1OlxuICogaHR0cHM6Ly93d3cudW5pY29kZS5vcmcvcmVwb3J0cy90cjM1L3RyMzUtZGF0ZXMuaHRtbCNEYXRlX0ZpZWxkX1N5bWJvbF9UYWJsZVxuICogd2l0aCBhIGZldyBhZGRpdGlvbnMgKHNlZSBub3RlIDcgYmVsb3cgdGhlIHRhYmxlKS5cbiAqXG4gKiBBY2NlcHRlZCBwYXR0ZXJuczpcbiAqIHwgVW5pdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFBhdHRlcm4gfCBSZXN1bHQgZXhhbXBsZXMgICAgICAgICAgICAgICAgICAgfCBOb3RlcyB8XG4gKiB8LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXwtLS0tLS0tfFxuICogfCBFcmEgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgRy4uR0dHICB8IEFELCBCQyAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IEdHR0cgICAgfCBBbm5vIERvbWluaSwgQmVmb3JlIENocmlzdCAgICAgICAgfCAyICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBHR0dHRyAgIHwgQSwgQiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCBDYWxlbmRhciB5ZWFyICAgICAgICAgICAgICAgICAgIHwgeSAgICAgICB8IDQ0LCAxLCAxOTAwLCAyMDE3ICAgICAgICAgICAgICAgICB8IDUgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHlvICAgICAgfCA0NHRoLCAxc3QsIDB0aCwgMTd0aCAgICAgICAgICAgICAgfCA1LDcgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCB5eSAgICAgIHwgNDQsIDAxLCAwMCwgMTcgICAgICAgICAgICAgICAgICAgIHwgNSAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgeXl5ICAgICB8IDA0NCwgMDAxLCAxOTAwLCAyMDE3ICAgICAgICAgICAgICB8IDUgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHl5eXkgICAgfCAwMDQ0LCAwMDAxLCAxOTAwLCAyMDE3ICAgICAgICAgICAgfCA1ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCB5eXl5eSAgIHwgLi4uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgMyw1ICAgfFxuICogfCBMb2NhbCB3ZWVrLW51bWJlcmluZyB5ZWFyICAgICAgIHwgWSAgICAgICB8IDQ0LCAxLCAxOTAwLCAyMDE3ICAgICAgICAgICAgICAgICB8IDUgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFlvICAgICAgfCA0NHRoLCAxc3QsIDE5MDB0aCwgMjAxN3RoICAgICAgICAgfCA1LDcgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBZWSAgICAgIHwgNDQsIDAxLCAwMCwgMTcgICAgICAgICAgICAgICAgICAgIHwgNSw4ICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgWVlZICAgICB8IDA0NCwgMDAxLCAxOTAwLCAyMDE3ICAgICAgICAgICAgICB8IDUgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFlZWVkgICAgfCAwMDQ0LCAwMDAxLCAxOTAwLCAyMDE3ICAgICAgICAgICAgfCA1LDggICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBZWVlZWSAgIHwgLi4uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgMyw1ICAgfFxuICogfCBJU08gd2Vlay1udW1iZXJpbmcgeWVhciAgICAgICAgIHwgUiAgICAgICB8IC00MywgMCwgMSwgMTkwMCwgMjAxNyAgICAgICAgICAgICB8IDUsNyAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFJSICAgICAgfCAtNDMsIDAwLCAwMSwgMTkwMCwgMjAxNyAgICAgICAgICAgfCA1LDcgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBSUlIgICAgIHwgLTA0MywgMDAwLCAwMDEsIDE5MDAsIDIwMTcgICAgICAgIHwgNSw3ICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgUlJSUiAgICB8IC0wMDQzLCAwMDAwLCAwMDAxLCAxOTAwLCAyMDE3ICAgICB8IDUsNyAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFJSUlJSICAgfCAuLi4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAzLDUsNyB8XG4gKiB8IEV4dGVuZGVkIHllYXIgICAgICAgICAgICAgICAgICAgfCB1ICAgICAgIHwgLTQzLCAwLCAxLCAxOTAwLCAyMDE3ICAgICAgICAgICAgIHwgNSAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgdXUgICAgICB8IC00MywgMDEsIDE5MDAsIDIwMTcgICAgICAgICAgICAgICB8IDUgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHV1dSAgICAgfCAtMDQzLCAwMDEsIDE5MDAsIDIwMTcgICAgICAgICAgICAgfCA1ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCB1dXV1ICAgIHwgLTAwNDMsIDAwMDEsIDE5MDAsIDIwMTcgICAgICAgICAgIHwgNSAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgdXV1dXUgICB8IC4uLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IDMsNSAgIHxcbiAqIHwgUXVhcnRlciAoZm9ybWF0dGluZykgICAgICAgICAgICB8IFEgICAgICAgfCAxLCAyLCAzLCA0ICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBRbyAgICAgIHwgMXN0LCAybmQsIDNyZCwgNHRoICAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgUVEgICAgICB8IDAxLCAwMiwgMDMsIDA0ICAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFFRUSAgICAgfCBRMSwgUTIsIFEzLCBRNCAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBRUVFRICAgIHwgMXN0IHF1YXJ0ZXIsIDJuZCBxdWFydGVyLCAuLi4gICAgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgUVFRUVEgICB8IDEsIDIsIDMsIDQgICAgICAgICAgICAgICAgICAgICAgICB8IDQgICAgIHxcbiAqIHwgUXVhcnRlciAoc3RhbmQtYWxvbmUpICAgICAgICAgICB8IHEgICAgICAgfCAxLCAyLCAzLCA0ICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBxbyAgICAgIHwgMXN0LCAybmQsIDNyZCwgNHRoICAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgcXEgICAgICB8IDAxLCAwMiwgMDMsIDA0ICAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHFxcSAgICAgfCBRMSwgUTIsIFEzLCBRNCAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBxcXFxICAgIHwgMXN0IHF1YXJ0ZXIsIDJuZCBxdWFydGVyLCAuLi4gICAgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgcXFxcXEgICB8IDEsIDIsIDMsIDQgICAgICAgICAgICAgICAgICAgICAgICB8IDQgICAgIHxcbiAqIHwgTW9udGggKGZvcm1hdHRpbmcpICAgICAgICAgICAgICB8IE0gICAgICAgfCAxLCAyLCAuLi4sIDEyICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBNbyAgICAgIHwgMXN0LCAybmQsIC4uLiwgMTJ0aCAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgTU0gICAgICB8IDAxLCAwMiwgLi4uLCAxMiAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IE1NTSAgICAgfCBKYW4sIEZlYiwgLi4uLCBEZWMgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBNTU1NICAgIHwgSmFudWFyeSwgRmVicnVhcnksIC4uLiwgRGVjZW1iZXIgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgTU1NTU0gICB8IEosIEYsIC4uLiwgRCAgICAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgTW9udGggKHN0YW5kLWFsb25lKSAgICAgICAgICAgICB8IEwgICAgICAgfCAxLCAyLCAuLi4sIDEyICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBMbyAgICAgIHwgMXN0LCAybmQsIC4uLiwgMTJ0aCAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgTEwgICAgICB8IDAxLCAwMiwgLi4uLCAxMiAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IExMTCAgICAgfCBKYW4sIEZlYiwgLi4uLCBEZWMgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBMTExMICAgIHwgSmFudWFyeSwgRmVicnVhcnksIC4uLiwgRGVjZW1iZXIgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgTExMTEwgICB8IEosIEYsIC4uLiwgRCAgICAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgTG9jYWwgd2VlayBvZiB5ZWFyICAgICAgICAgICAgICB8IHcgICAgICAgfCAxLCAyLCAuLi4sIDUzICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCB3byAgICAgIHwgMXN0LCAybmQsIC4uLiwgNTN0aCAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgd3cgICAgICB8IDAxLCAwMiwgLi4uLCA1MyAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgSVNPIHdlZWsgb2YgeWVhciAgICAgICAgICAgICAgICB8IEkgICAgICAgfCAxLCAyLCAuLi4sIDUzICAgICAgICAgICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBJbyAgICAgIHwgMXN0LCAybmQsIC4uLiwgNTN0aCAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgSUkgICAgICB8IDAxLCAwMiwgLi4uLCA1MyAgICAgICAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgRGF5IG9mIG1vbnRoICAgICAgICAgICAgICAgICAgICB8IGQgICAgICAgfCAxLCAyLCAuLi4sIDMxICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBkbyAgICAgIHwgMXN0LCAybmQsIC4uLiwgMzFzdCAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgZGQgICAgICB8IDAxLCAwMiwgLi4uLCAzMSAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgRGF5IG9mIHllYXIgICAgICAgICAgICAgICAgICAgICB8IEQgICAgICAgfCAxLCAyLCAuLi4sIDM2NSwgMzY2ICAgICAgICAgICAgICAgfCA5ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBEbyAgICAgIHwgMXN0LCAybmQsIC4uLiwgMzY1dGgsIDM2NnRoICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgREQgICAgICB8IDAxLCAwMiwgLi4uLCAzNjUsIDM2NiAgICAgICAgICAgICB8IDkgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IERERCAgICAgfCAwMDEsIDAwMiwgLi4uLCAzNjUsIDM2NiAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBEREREICAgIHwgLi4uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgMyAgICAgfFxuICogfCBEYXkgb2Ygd2VlayAoZm9ybWF0dGluZykgICAgICAgIHwgRS4uRUVFICB8IE1vbiwgVHVlLCBXZWQsIC4uLiwgU3UgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IEVFRUUgICAgfCBNb25kYXksIFR1ZXNkYXksIC4uLiwgU3VuZGF5ICAgICAgfCAyICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBFRUVFRSAgIHwgTSwgVCwgVywgVCwgRiwgUywgUyAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgRUVFRUVFICB8IE1vLCBUdSwgV2UsIFRoLCBGciwgU3UsIFNhICAgICAgICB8ICAgICAgIHxcbiAqIHwgSVNPIGRheSBvZiB3ZWVrIChmb3JtYXR0aW5nKSAgICB8IGkgICAgICAgfCAxLCAyLCAzLCAuLi4sIDcgICAgICAgICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBpbyAgICAgIHwgMXN0LCAybmQsIC4uLiwgN3RoICAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgaWkgICAgICB8IDAxLCAwMiwgLi4uLCAwNyAgICAgICAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IGlpaSAgICAgfCBNb24sIFR1ZSwgV2VkLCAuLi4sIFN1ICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBpaWlpICAgIHwgTW9uZGF5LCBUdWVzZGF5LCAuLi4sIFN1bmRheSAgICAgIHwgMiw3ICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgaWlpaWkgICB8IE0sIFQsIFcsIFQsIEYsIFMsIFMgICAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IGlpaWlpaSAgfCBNbywgVHUsIFdlLCBUaCwgRnIsIFN1LCBTYSAgICAgICAgfCA3ICAgICB8XG4gKiB8IExvY2FsIGRheSBvZiB3ZWVrIChmb3JtYXR0aW5nKSAgfCBlICAgICAgIHwgMiwgMywgNCwgLi4uLCAxICAgICAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgZW8gICAgICB8IDJuZCwgM3JkLCAuLi4sIDFzdCAgICAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IGVlICAgICAgfCAwMiwgMDMsIC4uLiwgMDEgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBlZWUgICAgIHwgTW9uLCBUdWUsIFdlZCwgLi4uLCBTdSAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgZWVlZSAgICB8IE1vbmRheSwgVHVlc2RheSwgLi4uLCBTdW5kYXkgICAgICB8IDIgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IGVlZWVlICAgfCBNLCBULCBXLCBULCBGLCBTLCBTICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBlZWVlZWUgIHwgTW8sIFR1LCBXZSwgVGgsIEZyLCBTdSwgU2EgICAgICAgIHwgICAgICAgfFxuICogfCBMb2NhbCBkYXkgb2Ygd2VlayAoc3RhbmQtYWxvbmUpIHwgYyAgICAgICB8IDIsIDMsIDQsIC4uLiwgMSAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IGNvICAgICAgfCAybmQsIDNyZCwgLi4uLCAxc3QgICAgICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBjYyAgICAgIHwgMDIsIDAzLCAuLi4sIDAxICAgICAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgY2NjICAgICB8IE1vbiwgVHVlLCBXZWQsIC4uLiwgU3UgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IGNjY2MgICAgfCBNb25kYXksIFR1ZXNkYXksIC4uLiwgU3VuZGF5ICAgICAgfCAyICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBjY2NjYyAgIHwgTSwgVCwgVywgVCwgRiwgUywgUyAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgY2NjY2NjICB8IE1vLCBUdSwgV2UsIFRoLCBGciwgU3UsIFNhICAgICAgICB8ICAgICAgIHxcbiAqIHwgQU0sIFBNICAgICAgICAgICAgICAgICAgICAgICAgICB8IGEuLmFhYSAgfCBBTSwgUE0gICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBhYWFhICAgIHwgYS5tLiwgcC5tLiAgICAgICAgICAgICAgICAgICAgICAgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgYWFhYWEgICB8IGEsIHAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgQU0sIFBNLCBub29uLCBtaWRuaWdodCAgICAgICAgICB8IGIuLmJiYiAgfCBBTSwgUE0sIG5vb24sIG1pZG5pZ2h0ICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBiYmJiICAgIHwgYS5tLiwgcC5tLiwgbm9vbiwgbWlkbmlnaHQgICAgICAgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgYmJiYmIgICB8IGEsIHAsIG4sIG1pICAgICAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgRmxleGlibGUgZGF5IHBlcmlvZCAgICAgICAgICAgICB8IEIuLkJCQiAgfCBhdCBuaWdodCwgaW4gdGhlIG1vcm5pbmcsIC4uLiAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBCQkJCICAgIHwgYXQgbmlnaHQsIGluIHRoZSBtb3JuaW5nLCAuLi4gICAgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgQkJCQkIgICB8IGF0IG5pZ2h0LCBpbiB0aGUgbW9ybmluZywgLi4uICAgICB8ICAgICAgIHxcbiAqIHwgSG91ciBbMS0xMl0gICAgICAgICAgICAgICAgICAgICB8IGggICAgICAgfCAxLCAyLCAuLi4sIDExLCAxMiAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBobyAgICAgIHwgMXN0LCAybmQsIC4uLiwgMTF0aCwgMTJ0aCAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgaGggICAgICB8IDAxLCAwMiwgLi4uLCAxMSwgMTIgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgSG91ciBbMC0yM10gICAgICAgICAgICAgICAgICAgICB8IEggICAgICAgfCAwLCAxLCAyLCAuLi4sIDIzICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBIbyAgICAgIHwgMHRoLCAxc3QsIDJuZCwgLi4uLCAyM3JkICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgSEggICAgICB8IDAwLCAwMSwgMDIsIC4uLiwgMjMgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgSG91ciBbMC0xMV0gICAgICAgICAgICAgICAgICAgICB8IEsgICAgICAgfCAxLCAyLCAuLi4sIDExLCAwICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBLbyAgICAgIHwgMXN0LCAybmQsIC4uLiwgMTF0aCwgMHRoICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgS0sgICAgICB8IDEsIDIsIC4uLiwgMTEsIDAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgSG91ciBbMS0yNF0gICAgICAgICAgICAgICAgICAgICB8IGsgICAgICAgfCAyNCwgMSwgMiwgLi4uLCAyMyAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBrbyAgICAgIHwgMjR0aCwgMXN0LCAybmQsIC4uLiwgMjNyZCAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwga2sgICAgICB8IDI0LCAwMSwgMDIsIC4uLiwgMjMgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgTWludXRlICAgICAgICAgICAgICAgICAgICAgICAgICB8IG0gICAgICAgfCAwLCAxLCAuLi4sIDU5ICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBtbyAgICAgIHwgMHRoLCAxc3QsIC4uLiwgNTl0aCAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgbW0gICAgICB8IDAwLCAwMSwgLi4uLCA1OSAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgU2Vjb25kICAgICAgICAgICAgICAgICAgICAgICAgICB8IHMgICAgICAgfCAwLCAxLCAuLi4sIDU5ICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBzbyAgICAgIHwgMHRoLCAxc3QsIC4uLiwgNTl0aCAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgc3MgICAgICB8IDAwLCAwMSwgLi4uLCA1OSAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgRnJhY3Rpb24gb2Ygc2Vjb25kICAgICAgICAgICAgICB8IFMgICAgICAgfCAwLCAxLCAuLi4sIDkgICAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBTUyAgICAgIHwgMDAsIDAxLCAuLi4sIDk5ICAgICAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgU1NTICAgICB8IDAwMCwgMDAwMSwgLi4uLCA5OTkgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFNTU1MgICAgfCAuLi4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAzICAgICB8XG4gKiB8IFRpbWV6b25lIChJU08tODYwMSB3LyBaKSAgICAgICAgfCBYICAgICAgIHwgLTA4LCArMDUzMCwgWiAgICAgICAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgWFggICAgICB8IC0wODAwLCArMDUzMCwgWiAgICAgICAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFhYWCAgICAgfCAtMDg6MDAsICswNTozMCwgWiAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBYWFhYICAgIHwgLTA4MDAsICswNTMwLCBaLCArMTIzNDU2ICAgICAgICAgIHwgMiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgWFhYWFggICB8IC0wODowMCwgKzA1OjMwLCBaLCArMTI6MzQ6NTYgICAgICB8ICAgICAgIHxcbiAqIHwgVGltZXpvbmUgKElTTy04NjAxIHcvbyBaKSAgICAgICB8IHggICAgICAgfCAtMDgsICswNTMwLCArMDAgICAgICAgICAgICAgICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCB4eCAgICAgIHwgLTA4MDAsICswNTMwLCArMDAwMCAgICAgICAgICAgICAgIHwgICAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgeHh4ICAgICB8IC0wODowMCwgKzA1OjMwLCArMDA6MDAgICAgICAgICAgICB8IDIgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHh4eHggICAgfCAtMDgwMCwgKzA1MzAsICswMDAwLCArMTIzNDU2ICAgICAgfCAgICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCB4eHh4eCAgIHwgLTA4OjAwLCArMDU6MzAsICswMDowMCwgKzEyOjM0OjU2IHwgICAgICAgfFxuICogfCBUaW1lem9uZSAoR01UKSAgICAgICAgICAgICAgICAgIHwgTy4uLk9PTyB8IEdNVC04LCBHTVQrNTozMCwgR01UKzAgICAgICAgICAgICB8ICAgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IE9PT08gICAgfCBHTVQtMDg6MDAsIEdNVCswNTozMCwgR01UKzAwOjAwICAgfCAyICAgICB8XG4gKiB8IFRpbWV6b25lIChzcGVjaWZpYyBub24tbG9jYXQuKSAgfCB6Li4uenp6IHwgR01ULTgsIEdNVCs1OjMwLCBHTVQrMCAgICAgICAgICAgIHwgNiAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgenp6eiAgICB8IEdNVC0wODowMCwgR01UKzA1OjMwLCBHTVQrMDA6MDAgICB8IDIsNiAgIHxcbiAqIHwgU2Vjb25kcyB0aW1lc3RhbXAgICAgICAgICAgICAgICB8IHQgICAgICAgfCA1MTI5Njk1MjAgICAgICAgICAgICAgICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCB0dCAgICAgIHwgLi4uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgMyw3ICAgfFxuICogfCBNaWxsaXNlY29uZHMgdGltZXN0YW1wICAgICAgICAgIHwgVCAgICAgICB8IDUxMjk2OTUyMDkwMCAgICAgICAgICAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFRUICAgICAgfCAuLi4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAzLDcgICB8XG4gKiB8IExvbmcgbG9jYWxpemVkIGRhdGUgICAgICAgICAgICAgfCBQICAgICAgIHwgMDUvMjkvMTQ1MyAgICAgICAgICAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgUFAgICAgICB8IE1heSAyOSwgMTQ1MyAgICAgICAgICAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFBQUCAgICAgfCBNYXkgMjl0aCwgMTQ1MyAgICAgICAgICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBQUFBQICAgIHwgU3VuZGF5LCBNYXkgMjl0aCwgMTQ1MyAgICAgICAgICAgIHwgMiw3ICAgfFxuICogfCBMb25nIGxvY2FsaXplZCB0aW1lICAgICAgICAgICAgIHwgcCAgICAgICB8IDEyOjAwIEFNICAgICAgICAgICAgICAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHBwICAgICAgfCAxMjowMDowMCBBTSAgICAgICAgICAgICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBwcHAgICAgIHwgMTI6MDA6MDAgQU0gR01UKzIgICAgICAgICAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgcHBwcCAgICB8IDEyOjAwOjAwIEFNIEdNVCswMjowMCAgICAgICAgICAgICB8IDIsNyAgIHxcbiAqIHwgQ29tYmluYXRpb24gb2YgZGF0ZSBhbmQgdGltZSAgICB8IFBwICAgICAgfCAwNS8yOS8xNDUzLCAxMjowMCBBTSAgICAgICAgICAgICAgfCA3ICAgICB8XG4gKiB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCBQUHBwICAgIHwgTWF5IDI5LCAxNDUzLCAxMjowMDowMCBBTSAgICAgICAgIHwgNyAgICAgfFxuICogfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgUFBQcHBwICB8IE1heSAyOXRoLCAxNDUzIGF0IC4uLiAgICAgICAgICAgICB8IDcgICAgIHxcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFBQUFBwcHBwfCBTdW5kYXksIE1heSAyOXRoLCAxNDUzIGF0IC4uLiAgICAgfCAyLDcgICB8XG4gKiBOb3RlczpcbiAqIDEuIFwiRm9ybWF0dGluZ1wiIHVuaXRzIChlLmcuIGZvcm1hdHRpbmcgcXVhcnRlcikgaW4gdGhlIGRlZmF1bHQgZW4tVVMgbG9jYWxlXG4gKiAgICBhcmUgdGhlIHNhbWUgYXMgXCJzdGFuZC1hbG9uZVwiIHVuaXRzLCBidXQgYXJlIGRpZmZlcmVudCBpbiBzb21lIGxhbmd1YWdlcy5cbiAqICAgIFwiRm9ybWF0dGluZ1wiIHVuaXRzIGFyZSBkZWNsaW5lZCBhY2NvcmRpbmcgdG8gdGhlIHJ1bGVzIG9mIHRoZSBsYW5ndWFnZVxuICogICAgaW4gdGhlIGNvbnRleHQgb2YgYSBkYXRlLiBcIlN0YW5kLWFsb25lXCIgdW5pdHMgYXJlIGFsd2F5cyBub21pbmF0aXZlIHNpbmd1bGFyOlxuICpcbiAqICAgIGBmb3JtYXQobmV3IERhdGUoMjAxNywgMTAsIDYpLCAnZG8gTExMTCcsIHtsb2NhbGU6IGNzfSkgLy89PiAnNi4gbGlzdG9wYWQnYFxuICpcbiAqICAgIGBmb3JtYXQobmV3IERhdGUoMjAxNywgMTAsIDYpLCAnZG8gTU1NTScsIHtsb2NhbGU6IGNzfSkgLy89PiAnNi4gbGlzdG9wYWR1J2BcbiAqXG4gKiAyLiBBbnkgc2VxdWVuY2Ugb2YgdGhlIGlkZW50aWNhbCBsZXR0ZXJzIGlzIGEgcGF0dGVybiwgdW5sZXNzIGl0IGlzIGVzY2FwZWQgYnlcbiAqICAgIHRoZSBzaW5nbGUgcXVvdGUgY2hhcmFjdGVycyAoc2VlIGJlbG93KS5cbiAqICAgIElmIHRoZSBzZXF1ZW5jZSBpcyBsb25nZXIgdGhhbiBsaXN0ZWQgaW4gdGFibGUgKGUuZy4gYEVFRUVFRUVFRUVFYClcbiAqICAgIHRoZSBvdXRwdXQgd2lsbCBiZSB0aGUgc2FtZSBhcyBkZWZhdWx0IHBhdHRlcm4gZm9yIHRoaXMgdW5pdCwgdXN1YWxseVxuICogICAgdGhlIGxvbmdlc3Qgb25lIChpbiBjYXNlIG9mIElTTyB3ZWVrZGF5cywgYEVFRUVgKS4gRGVmYXVsdCBwYXR0ZXJucyBmb3IgdW5pdHNcbiAqICAgIGFyZSBtYXJrZWQgd2l0aCBcIjJcIiBpbiB0aGUgbGFzdCBjb2x1bW4gb2YgdGhlIHRhYmxlLlxuICpcbiAqICAgIGBmb3JtYXQobmV3IERhdGUoMjAxNywgMTAsIDYpLCAnTU1NJykgLy89PiAnTm92J2BcbiAqXG4gKiAgICBgZm9ybWF0KG5ldyBEYXRlKDIwMTcsIDEwLCA2KSwgJ01NTU0nKSAvLz0+ICdOb3ZlbWJlcidgXG4gKlxuICogICAgYGZvcm1hdChuZXcgRGF0ZSgyMDE3LCAxMCwgNiksICdNTU1NTScpIC8vPT4gJ04nYFxuICpcbiAqICAgIGBmb3JtYXQobmV3IERhdGUoMjAxNywgMTAsIDYpLCAnTU1NTU1NJykgLy89PiAnTm92ZW1iZXInYFxuICpcbiAqICAgIGBmb3JtYXQobmV3IERhdGUoMjAxNywgMTAsIDYpLCAnTU1NTU1NTScpIC8vPT4gJ05vdmVtYmVyJ2BcbiAqXG4gKiAzLiBTb21lIHBhdHRlcm5zIGNvdWxkIGJlIHVubGltaXRlZCBsZW5ndGggKHN1Y2ggYXMgYHl5eXl5eXl5YCkuXG4gKiAgICBUaGUgb3V0cHV0IHdpbGwgYmUgcGFkZGVkIHdpdGggemVyb3MgdG8gbWF0Y2ggdGhlIGxlbmd0aCBvZiB0aGUgcGF0dGVybi5cbiAqXG4gKiAgICBgZm9ybWF0KG5ldyBEYXRlKDIwMTcsIDEwLCA2KSwgJ3l5eXl5eXl5JykgLy89PiAnMDAwMDIwMTcnYFxuICpcbiAqIDQuIGBRUVFRUWAgYW5kIGBxcXFxcWAgY291bGQgYmUgbm90IHN0cmljdGx5IG51bWVyaWNhbCBpbiBzb21lIGxvY2FsZXMuXG4gKiAgICBUaGVzZSB0b2tlbnMgcmVwcmVzZW50IHRoZSBzaG9ydGVzdCBmb3JtIG9mIHRoZSBxdWFydGVyLlxuICpcbiAqIDUuIFRoZSBtYWluIGRpZmZlcmVuY2UgYmV0d2VlbiBgeWAgYW5kIGB1YCBwYXR0ZXJucyBhcmUgQi5DLiB5ZWFyczpcbiAqXG4gKiAgICB8IFllYXIgfCBgeWAgfCBgdWAgfFxuICogICAgfC0tLS0tLXwtLS0tLXwtLS0tLXxcbiAqICAgIHwgQUMgMSB8ICAgMSB8ICAgMSB8XG4gKiAgICB8IEJDIDEgfCAgIDEgfCAgIDAgfFxuICogICAgfCBCQyAyIHwgICAyIHwgIC0xIHxcbiAqXG4gKiAgICBBbHNvIGB5eWAgYWx3YXlzIHJldHVybnMgdGhlIGxhc3QgdHdvIGRpZ2l0cyBvZiBhIHllYXIsXG4gKiAgICB3aGlsZSBgdXVgIHBhZHMgc2luZ2xlIGRpZ2l0IHllYXJzIHRvIDIgY2hhcmFjdGVycyBhbmQgcmV0dXJucyBvdGhlciB5ZWFycyB1bmNoYW5nZWQ6XG4gKlxuICogICAgfCBZZWFyIHwgYHl5YCB8IGB1dWAgfFxuICogICAgfC0tLS0tLXwtLS0tLS18LS0tLS0tfFxuICogICAgfCAxICAgIHwgICAwMSB8ICAgMDEgfFxuICogICAgfCAxNCAgIHwgICAxNCB8ICAgMTQgfFxuICogICAgfCAzNzYgIHwgICA3NiB8ICAzNzYgfFxuICogICAgfCAxNDUzIHwgICA1MyB8IDE0NTMgfFxuICpcbiAqICAgIFRoZSBzYW1lIGRpZmZlcmVuY2UgaXMgdHJ1ZSBmb3IgbG9jYWwgYW5kIElTTyB3ZWVrLW51bWJlcmluZyB5ZWFycyAoYFlgIGFuZCBgUmApLFxuICogICAgZXhjZXB0IGxvY2FsIHdlZWstbnVtYmVyaW5nIHllYXJzIGFyZSBkZXBlbmRlbnQgb24gYG9wdGlvbnMud2Vla1N0YXJ0c09uYFxuICogICAgYW5kIGBvcHRpb25zLmZpcnN0V2Vla0NvbnRhaW5zRGF0ZWAgKGNvbXBhcmUgW2dldElTT1dlZWtZZWFyXXtAbGluayBodHRwczovL2RhdGUtZm5zLm9yZy9kb2NzL2dldElTT1dlZWtZZWFyfVxuICogICAgYW5kIFtnZXRXZWVrWWVhcl17QGxpbmsgaHR0cHM6Ly9kYXRlLWZucy5vcmcvZG9jcy9nZXRXZWVrWWVhcn0pLlxuICpcbiAqIDYuIFNwZWNpZmljIG5vbi1sb2NhdGlvbiB0aW1lem9uZXMgYXJlIGN1cnJlbnRseSB1bmF2YWlsYWJsZSBpbiBgZGF0ZS1mbnNgLFxuICogICAgc28gcmlnaHQgbm93IHRoZXNlIHRva2VucyBmYWxsIGJhY2sgdG8gR01UIHRpbWV6b25lcy5cbiAqXG4gKiA3LiBUaGVzZSBwYXR0ZXJucyBhcmUgbm90IGluIHRoZSBVbmljb2RlIFRlY2huaWNhbCBTdGFuZGFyZCAjMzU6XG4gKiAgICAtIGBpYDogSVNPIGRheSBvZiB3ZWVrXG4gKiAgICAtIGBJYDogSVNPIHdlZWsgb2YgeWVhclxuICogICAgLSBgUmA6IElTTyB3ZWVrLW51bWJlcmluZyB5ZWFyXG4gKiAgICAtIGB0YDogc2Vjb25kcyB0aW1lc3RhbXBcbiAqICAgIC0gYFRgOiBtaWxsaXNlY29uZHMgdGltZXN0YW1wXG4gKiAgICAtIGBvYDogb3JkaW5hbCBudW1iZXIgbW9kaWZpZXJcbiAqICAgIC0gYFBgOiBsb25nIGxvY2FsaXplZCBkYXRlXG4gKiAgICAtIGBwYDogbG9uZyBsb2NhbGl6ZWQgdGltZVxuICpcbiAqIDguIGBZWWAgYW5kIGBZWVlZYCB0b2tlbnMgcmVwcmVzZW50IHdlZWstbnVtYmVyaW5nIHllYXJzIGJ1dCB0aGV5IGFyZSBvZnRlbiBjb25mdXNlZCB3aXRoIHllYXJzLlxuICogICAgWW91IHNob3VsZCBlbmFibGUgYG9wdGlvbnMudXNlQWRkaXRpb25hbFdlZWtZZWFyVG9rZW5zYCB0byB1c2UgdGhlbS4gU2VlOiBodHRwczovL2dpdC5pby9meEN5clxuICpcbiAqIDkuIGBEYCBhbmQgYEREYCB0b2tlbnMgcmVwcmVzZW50IGRheXMgb2YgdGhlIHllYXIgYnV0IHRoZXkgYXJlIG9mdGhlbiBjb25mdXNlZCB3aXRoIGRheXMgb2YgdGhlIG1vbnRoLlxuICogICAgWW91IHNob3VsZCBlbmFibGUgYG9wdGlvbnMudXNlQWRkaXRpb25hbERheU9mWWVhclRva2Vuc2AgdG8gdXNlIHRoZW0uIFNlZTogaHR0cHM6Ly9naXQuaW8vZnhDeXJcbiAqXG4gKiAjIyMgdjIuMC4wIGJyZWFraW5nIGNoYW5nZXM6XG4gKlxuICogLSBbQ2hhbmdlcyB0aGF0IGFyZSBjb21tb24gZm9yIHRoZSB3aG9sZSBsaWJyYXJ5XShodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvYmxvYi9tYXN0ZXIvZG9jcy91cGdyYWRlR3VpZGUubWQjQ29tbW9uLUNoYW5nZXMpLlxuICpcbiAqIC0gVGhlIHNlY29uZCBhcmd1bWVudCBpcyBub3cgcmVxdWlyZWQgZm9yIHRoZSBzYWtlIG9mIGV4cGxpY2l0bmVzcy5cbiAqXG4gKiAgIGBgYGphdmFzY3JpcHRcbiAqICAgLy8gQmVmb3JlIHYyLjAuMFxuICogICBmb3JtYXQobmV3IERhdGUoMjAxNiwgMCwgMSkpXG4gKlxuICogICAvLyB2Mi4wLjAgb253YXJkXG4gKiAgIGZvcm1hdChuZXcgRGF0ZSgyMDE2LCAwLCAxKSwgXCJ5eXl5LU1NLWRkJ1QnSEg6bW06c3MuU1NTeHh4XCIpXG4gKiAgIGBgYFxuICpcbiAqIC0gTmV3IGZvcm1hdCBzdHJpbmcgQVBJIGZvciBgZm9ybWF0YCBmdW5jdGlvblxuICogICB3aGljaCBpcyBiYXNlZCBvbiBbVW5pY29kZSBUZWNobmljYWwgU3RhbmRhcmQgIzM1XShodHRwczovL3d3dy51bmljb2RlLm9yZy9yZXBvcnRzL3RyMzUvdHIzNS1kYXRlcy5odG1sI0RhdGVfRmllbGRfU3ltYm9sX1RhYmxlKS5cbiAqICAgU2VlIFt0aGlzIHBvc3RdKGh0dHBzOi8vYmxvZy5kYXRlLWZucy5vcmcvcG9zdC91bmljb2RlLXRva2Vucy1pbi1kYXRlLWZucy12Mi1zcmVhdHlraTkxamcpIGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogLSBDaGFyYWN0ZXJzIGFyZSBub3cgZXNjYXBlZCB1c2luZyBzaW5nbGUgcXVvdGUgc3ltYm9scyAoYCdgKSBpbnN0ZWFkIG9mIHNxdWFyZSBicmFja2V0cy5cbiAqXG4gKiBAcGFyYW0ge0RhdGV8TnVtYmVyfSBkYXRlIC0gdGhlIG9yaWdpbmFsIGRhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBmb3JtYXQgLSB0aGUgc3RyaW5nIG9mIHRva2Vuc1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSAtIGFuIG9iamVjdCB3aXRoIG9wdGlvbnMuXG4gKiBAcGFyYW0ge0xvY2FsZX0gW29wdGlvbnMubG9jYWxlPWRlZmF1bHRMb2NhbGVdIC0gdGhlIGxvY2FsZSBvYmplY3QuIFNlZSBbTG9jYWxlXXtAbGluayBodHRwczovL2RhdGUtZm5zLm9yZy9kb2NzL0xvY2FsZX1cbiAqIEBwYXJhbSB7MHwxfDJ8M3w0fDV8Nn0gW29wdGlvbnMud2Vla1N0YXJ0c09uPTBdIC0gdGhlIGluZGV4IG9mIHRoZSBmaXJzdCBkYXkgb2YgdGhlIHdlZWsgKDAgLSBTdW5kYXkpXG4gKiBAcGFyYW0ge051bWJlcn0gW29wdGlvbnMuZmlyc3RXZWVrQ29udGFpbnNEYXRlPTFdIC0gdGhlIGRheSBvZiBKYW51YXJ5LCB3aGljaCBpc1xuICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy51c2VBZGRpdGlvbmFsV2Vla1llYXJUb2tlbnM9ZmFsc2VdIC0gaWYgdHJ1ZSwgYWxsb3dzIHVzYWdlIG9mIHRoZSB3ZWVrLW51bWJlcmluZyB5ZWFyIHRva2VucyBgWVlgIGFuZCBgWVlZWWA7XG4gKiAgIHNlZTogaHR0cHM6Ly9naXQuaW8vZnhDeXJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW29wdGlvbnMudXNlQWRkaXRpb25hbERheU9mWWVhclRva2Vucz1mYWxzZV0gLSBpZiB0cnVlLCBhbGxvd3MgdXNhZ2Ugb2YgdGhlIGRheSBvZiB5ZWFyIHRva2VucyBgRGAgYW5kIGBERGA7XG4gKiAgIHNlZTogaHR0cHM6Ly9naXQuaW8vZnhDeXJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IHRoZSBmb3JtYXR0ZWQgZGF0ZSBzdHJpbmdcbiAqIEB0aHJvd3Mge1R5cGVFcnJvcn0gMiBhcmd1bWVudHMgcmVxdWlyZWRcbiAqIEB0aHJvd3Mge1JhbmdlRXJyb3J9IGBvcHRpb25zLmxvY2FsZWAgbXVzdCBjb250YWluIGBsb2NhbGl6ZWAgcHJvcGVydHlcbiAqIEB0aHJvd3Mge1JhbmdlRXJyb3J9IGBvcHRpb25zLmxvY2FsZWAgbXVzdCBjb250YWluIGBmb3JtYXRMb25nYCBwcm9wZXJ0eVxuICogQHRocm93cyB7UmFuZ2VFcnJvcn0gYG9wdGlvbnMud2Vla1N0YXJ0c09uYCBtdXN0IGJlIGJldHdlZW4gMCBhbmQgNlxuICogQHRocm93cyB7UmFuZ2VFcnJvcn0gYG9wdGlvbnMuZmlyc3RXZWVrQ29udGFpbnNEYXRlYCBtdXN0IGJlIGJldHdlZW4gMSBhbmQgN1xuICogQHRocm93cyB7UmFuZ2VFcnJvcn0gdXNlIGB5eXl5YCBpbnN0ZWFkIG9mIGBZWVlZYCBmb3IgZm9ybWF0dGluZyB5ZWFyczsgc2VlOiBodHRwczovL2dpdC5pby9meEN5clxuICogQHRocm93cyB7UmFuZ2VFcnJvcn0gdXNlIGB5eWAgaW5zdGVhZCBvZiBgWVlgIGZvciBmb3JtYXR0aW5nIHllYXJzOyBzZWU6IGh0dHBzOi8vZ2l0LmlvL2Z4Q3lyXG4gKiBAdGhyb3dzIHtSYW5nZUVycm9yfSB1c2UgYGRgIGluc3RlYWQgb2YgYERgIGZvciBmb3JtYXR0aW5nIGRheXMgb2YgdGhlIG1vbnRoOyBzZWU6IGh0dHBzOi8vZ2l0LmlvL2Z4Q3lyXG4gKiBAdGhyb3dzIHtSYW5nZUVycm9yfSB1c2UgYGRkYCBpbnN0ZWFkIG9mIGBERGAgZm9yIGZvcm1hdHRpbmcgZGF5cyBvZiB0aGUgbW9udGg7IHNlZTogaHR0cHM6Ly9naXQuaW8vZnhDeXJcbiAqIEB0aHJvd3Mge1JhbmdlRXJyb3J9IGZvcm1hdCBzdHJpbmcgY29udGFpbnMgYW4gdW5lc2NhcGVkIGxhdGluIGFscGhhYmV0IGNoYXJhY3RlclxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXByZXNlbnQgMTEgRmVicnVhcnkgMjAxNCBpbiBtaWRkbGUtZW5kaWFuIGZvcm1hdDpcbiAqIHZhciByZXN1bHQgPSBmb3JtYXQobmV3IERhdGUoMjAxNCwgMSwgMTEpLCAnTU0vZGQveXl5eScpXG4gKiAvLz0+ICcwMi8xMS8yMDE0J1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXByZXNlbnQgMiBKdWx5IDIwMTQgaW4gRXNwZXJhbnRvOlxuICogaW1wb3J0IHsgZW9Mb2NhbGUgfSBmcm9tICdkYXRlLWZucy9sb2NhbGUvZW8nXG4gKiB2YXIgcmVzdWx0ID0gZm9ybWF0KG5ldyBEYXRlKDIwMTQsIDYsIDIpLCBcImRvICdkZScgTU1NTSB5eXl5XCIsIHtcbiAqICAgbG9jYWxlOiBlb0xvY2FsZVxuICogfSlcbiAqIC8vPT4gJzItYSBkZSBqdWxpbyAyMDE0J1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBFc2NhcGUgc3RyaW5nIGJ5IHNpbmdsZSBxdW90ZSBjaGFyYWN0ZXJzOlxuICogdmFyIHJlc3VsdCA9IGZvcm1hdChuZXcgRGF0ZSgyMDE0LCA2LCAyLCAxNSksIFwiaCAnbycnY2xvY2snXCIpXG4gKiAvLz0+IFwiMyBvJ2Nsb2NrXCJcbiAqL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmb3JtYXQoZGlydHlEYXRlLCBkaXJ0eUZvcm1hdFN0ciwgZGlydHlPcHRpb25zKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJzIgYXJndW1lbnRzIHJlcXVpcmVkLCBidXQgb25seSAnICsgYXJndW1lbnRzLmxlbmd0aCArICcgcHJlc2VudCcpO1xuICB9XG5cbiAgdmFyIGZvcm1hdFN0ciA9IFN0cmluZyhkaXJ0eUZvcm1hdFN0cik7XG4gIHZhciBvcHRpb25zID0gZGlydHlPcHRpb25zIHx8IHt9O1xuICB2YXIgbG9jYWxlID0gb3B0aW9ucy5sb2NhbGUgfHwgZGVmYXVsdExvY2FsZTtcbiAgdmFyIGxvY2FsZUZpcnN0V2Vla0NvbnRhaW5zRGF0ZSA9IGxvY2FsZS5vcHRpb25zICYmIGxvY2FsZS5vcHRpb25zLmZpcnN0V2Vla0NvbnRhaW5zRGF0ZTtcbiAgdmFyIGRlZmF1bHRGaXJzdFdlZWtDb250YWluc0RhdGUgPSBsb2NhbGVGaXJzdFdlZWtDb250YWluc0RhdGUgPT0gbnVsbCA/IDEgOiB0b0ludGVnZXIobG9jYWxlRmlyc3RXZWVrQ29udGFpbnNEYXRlKTtcbiAgdmFyIGZpcnN0V2Vla0NvbnRhaW5zRGF0ZSA9IG9wdGlvbnMuZmlyc3RXZWVrQ29udGFpbnNEYXRlID09IG51bGwgPyBkZWZhdWx0Rmlyc3RXZWVrQ29udGFpbnNEYXRlIDogdG9JbnRlZ2VyKG9wdGlvbnMuZmlyc3RXZWVrQ29udGFpbnNEYXRlKTsgLy8gVGVzdCBpZiB3ZWVrU3RhcnRzT24gaXMgYmV0d2VlbiAxIGFuZCA3IF9hbmRfIGlzIG5vdCBOYU5cblxuICBpZiAoIShmaXJzdFdlZWtDb250YWluc0RhdGUgPj0gMSAmJiBmaXJzdFdlZWtDb250YWluc0RhdGUgPD0gNykpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZmlyc3RXZWVrQ29udGFpbnNEYXRlIG11c3QgYmUgYmV0d2VlbiAxIGFuZCA3IGluY2x1c2l2ZWx5Jyk7XG4gIH1cblxuICB2YXIgbG9jYWxlV2Vla1N0YXJ0c09uID0gbG9jYWxlLm9wdGlvbnMgJiYgbG9jYWxlLm9wdGlvbnMud2Vla1N0YXJ0c09uO1xuICB2YXIgZGVmYXVsdFdlZWtTdGFydHNPbiA9IGxvY2FsZVdlZWtTdGFydHNPbiA9PSBudWxsID8gMCA6IHRvSW50ZWdlcihsb2NhbGVXZWVrU3RhcnRzT24pO1xuICB2YXIgd2Vla1N0YXJ0c09uID0gb3B0aW9ucy53ZWVrU3RhcnRzT24gPT0gbnVsbCA/IGRlZmF1bHRXZWVrU3RhcnRzT24gOiB0b0ludGVnZXIob3B0aW9ucy53ZWVrU3RhcnRzT24pOyAvLyBUZXN0IGlmIHdlZWtTdGFydHNPbiBpcyBiZXR3ZWVuIDAgYW5kIDYgX2FuZF8gaXMgbm90IE5hTlxuXG4gIGlmICghKHdlZWtTdGFydHNPbiA+PSAwICYmIHdlZWtTdGFydHNPbiA8PSA2KSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd3ZWVrU3RhcnRzT24gbXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDYgaW5jbHVzaXZlbHknKTtcbiAgfVxuXG4gIGlmICghbG9jYWxlLmxvY2FsaXplKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2xvY2FsZSBtdXN0IGNvbnRhaW4gbG9jYWxpemUgcHJvcGVydHknKTtcbiAgfVxuXG4gIGlmICghbG9jYWxlLmZvcm1hdExvbmcpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignbG9jYWxlIG11c3QgY29udGFpbiBmb3JtYXRMb25nIHByb3BlcnR5Jyk7XG4gIH1cblxuICB2YXIgb3JpZ2luYWxEYXRlID0gdG9EYXRlKGRpcnR5RGF0ZSk7XG5cbiAgaWYgKCFpc1ZhbGlkKG9yaWdpbmFsRGF0ZSkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCB0aW1lIHZhbHVlJyk7XG4gIH0gLy8gQ29udmVydCB0aGUgZGF0ZSBpbiBzeXN0ZW0gdGltZXpvbmUgdG8gdGhlIHNhbWUgZGF0ZSBpbiBVVEMrMDA6MDAgdGltZXpvbmUuXG4gIC8vIFRoaXMgZW5zdXJlcyB0aGF0IHdoZW4gVVRDIGZ1bmN0aW9ucyB3aWxsIGJlIGltcGxlbWVudGVkLCBsb2NhbGVzIHdpbGwgYmUgY29tcGF0aWJsZSB3aXRoIHRoZW0uXG4gIC8vIFNlZSBhbiBpc3N1ZSBhYm91dCBVVEMgZnVuY3Rpb25zOiBodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvaXNzdWVzLzM3NlxuXG5cbiAgdmFyIHRpbWV6b25lT2Zmc2V0ID0gZ2V0VGltZXpvbmVPZmZzZXRJbk1pbGxpc2Vjb25kcyhvcmlnaW5hbERhdGUpO1xuICB2YXIgdXRjRGF0ZSA9IHN1Yk1pbGxpc2Vjb25kcyhvcmlnaW5hbERhdGUsIHRpbWV6b25lT2Zmc2V0KTtcbiAgdmFyIGZvcm1hdHRlck9wdGlvbnMgPSB7XG4gICAgZmlyc3RXZWVrQ29udGFpbnNEYXRlOiBmaXJzdFdlZWtDb250YWluc0RhdGUsXG4gICAgd2Vla1N0YXJ0c09uOiB3ZWVrU3RhcnRzT24sXG4gICAgbG9jYWxlOiBsb2NhbGUsXG4gICAgX29yaWdpbmFsRGF0ZTogb3JpZ2luYWxEYXRlXG4gIH07XG4gIHZhciByZXN1bHQgPSBmb3JtYXRTdHIubWF0Y2gobG9uZ0Zvcm1hdHRpbmdUb2tlbnNSZWdFeHApLm1hcChmdW5jdGlvbiAoc3Vic3RyaW5nKSB7XG4gICAgdmFyIGZpcnN0Q2hhcmFjdGVyID0gc3Vic3RyaW5nWzBdO1xuXG4gICAgaWYgKGZpcnN0Q2hhcmFjdGVyID09PSAncCcgfHwgZmlyc3RDaGFyYWN0ZXIgPT09ICdQJykge1xuICAgICAgdmFyIGxvbmdGb3JtYXR0ZXIgPSBsb25nRm9ybWF0dGVyc1tmaXJzdENoYXJhY3Rlcl07XG4gICAgICByZXR1cm4gbG9uZ0Zvcm1hdHRlcihzdWJzdHJpbmcsIGxvY2FsZS5mb3JtYXRMb25nLCBmb3JtYXR0ZXJPcHRpb25zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3Vic3RyaW5nO1xuICB9KS5qb2luKCcnKS5tYXRjaChmb3JtYXR0aW5nVG9rZW5zUmVnRXhwKS5tYXAoZnVuY3Rpb24gKHN1YnN0cmluZykge1xuICAgIC8vIFJlcGxhY2UgdHdvIHNpbmdsZSBxdW90ZSBjaGFyYWN0ZXJzIHdpdGggb25lIHNpbmdsZSBxdW90ZSBjaGFyYWN0ZXJcbiAgICBpZiAoc3Vic3RyaW5nID09PSBcIicnXCIpIHtcbiAgICAgIHJldHVybiBcIidcIjtcbiAgICB9XG5cbiAgICB2YXIgZmlyc3RDaGFyYWN0ZXIgPSBzdWJzdHJpbmdbMF07XG5cbiAgICBpZiAoZmlyc3RDaGFyYWN0ZXIgPT09IFwiJ1wiKSB7XG4gICAgICByZXR1cm4gY2xlYW5Fc2NhcGVkU3RyaW5nKHN1YnN0cmluZyk7XG4gICAgfVxuXG4gICAgdmFyIGZvcm1hdHRlciA9IGZvcm1hdHRlcnNbZmlyc3RDaGFyYWN0ZXJdO1xuXG4gICAgaWYgKGZvcm1hdHRlcikge1xuICAgICAgaWYgKCFvcHRpb25zLnVzZUFkZGl0aW9uYWxXZWVrWWVhclRva2VucyAmJiBpc1Byb3RlY3RlZFdlZWtZZWFyVG9rZW4oc3Vic3RyaW5nKSkge1xuICAgICAgICB0aHJvd1Byb3RlY3RlZEVycm9yKHN1YnN0cmluZyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghb3B0aW9ucy51c2VBZGRpdGlvbmFsRGF5T2ZZZWFyVG9rZW5zICYmIGlzUHJvdGVjdGVkRGF5T2ZZZWFyVG9rZW4oc3Vic3RyaW5nKSkge1xuICAgICAgICB0aHJvd1Byb3RlY3RlZEVycm9yKHN1YnN0cmluZyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmb3JtYXR0ZXIodXRjRGF0ZSwgc3Vic3RyaW5nLCBsb2NhbGUubG9jYWxpemUsIGZvcm1hdHRlck9wdGlvbnMpO1xuICAgIH1cblxuICAgIGlmIChmaXJzdENoYXJhY3Rlci5tYXRjaCh1bmVzY2FwZWRMYXRpbkNoYXJhY3RlclJlZ0V4cCkpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdGb3JtYXQgc3RyaW5nIGNvbnRhaW5zIGFuIHVuZXNjYXBlZCBsYXRpbiBhbHBoYWJldCBjaGFyYWN0ZXIgYCcgKyBmaXJzdENoYXJhY3RlciArICdgJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1YnN0cmluZztcbiAgfSkuam9pbignJyk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGNsZWFuRXNjYXBlZFN0cmluZyhpbnB1dCkge1xuICByZXR1cm4gaW5wdXQubWF0Y2goZXNjYXBlZFN0cmluZ1JlZ0V4cClbMV0ucmVwbGFjZShkb3VibGVRdW90ZVJlZ0V4cCwgXCInXCIpO1xufSIsImltcG9ydCB0b0ludGVnZXIgZnJvbSAnLi4vdG9JbnRlZ2VyL2luZGV4LmpzJztcbmltcG9ydCB0b0RhdGUgZnJvbSAnLi4vLi4vdG9EYXRlL2luZGV4LmpzJzsgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGEgcGFydCBvZiBwdWJsaWMgQVBJIHdoZW4gVVRDIGZ1bmN0aW9uIHdpbGwgYmUgaW1wbGVtZW50ZWQuXG4vLyBTZWUgaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXRlLWZucy9kYXRlLWZucy9pc3N1ZXMvMzc2XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNldFVUQ0RheShkaXJ0eURhdGUsIGRpcnR5RGF5LCBkaXJ0eU9wdGlvbnMpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMiBhcmd1bWVudHMgcmVxdWlyZWQsIGJ1dCBvbmx5ICcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBwcmVzZW50Jyk7XG4gIH1cblxuICB2YXIgb3B0aW9ucyA9IGRpcnR5T3B0aW9ucyB8fCB7fTtcbiAgdmFyIGxvY2FsZSA9IG9wdGlvbnMubG9jYWxlO1xuICB2YXIgbG9jYWxlV2Vla1N0YXJ0c09uID0gbG9jYWxlICYmIGxvY2FsZS5vcHRpb25zICYmIGxvY2FsZS5vcHRpb25zLndlZWtTdGFydHNPbjtcbiAgdmFyIGRlZmF1bHRXZWVrU3RhcnRzT24gPSBsb2NhbGVXZWVrU3RhcnRzT24gPT0gbnVsbCA/IDAgOiB0b0ludGVnZXIobG9jYWxlV2Vla1N0YXJ0c09uKTtcbiAgdmFyIHdlZWtTdGFydHNPbiA9IG9wdGlvbnMud2Vla1N0YXJ0c09uID09IG51bGwgPyBkZWZhdWx0V2Vla1N0YXJ0c09uIDogdG9JbnRlZ2VyKG9wdGlvbnMud2Vla1N0YXJ0c09uKTsgLy8gVGVzdCBpZiB3ZWVrU3RhcnRzT24gaXMgYmV0d2VlbiAwIGFuZCA2IF9hbmRfIGlzIG5vdCBOYU5cblxuICBpZiAoISh3ZWVrU3RhcnRzT24gPj0gMCAmJiB3ZWVrU3RhcnRzT24gPD0gNikpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignd2Vla1N0YXJ0c09uIG11c3QgYmUgYmV0d2VlbiAwIGFuZCA2IGluY2x1c2l2ZWx5Jyk7XG4gIH1cblxuICB2YXIgZGF0ZSA9IHRvRGF0ZShkaXJ0eURhdGUpO1xuICB2YXIgZGF5ID0gdG9JbnRlZ2VyKGRpcnR5RGF5KTtcbiAgdmFyIGN1cnJlbnREYXkgPSBkYXRlLmdldFVUQ0RheSgpO1xuICB2YXIgcmVtYWluZGVyID0gZGF5ICUgNztcbiAgdmFyIGRheUluZGV4ID0gKHJlbWFpbmRlciArIDcpICUgNztcbiAgdmFyIGRpZmYgPSAoZGF5SW5kZXggPCB3ZWVrU3RhcnRzT24gPyA3IDogMCkgKyBkYXkgLSBjdXJyZW50RGF5O1xuICBkYXRlLnNldFVUQ0RhdGUoZGF0ZS5nZXRVVENEYXRlKCkgKyBkaWZmKTtcbiAgcmV0dXJuIGRhdGU7XG59IiwiaW1wb3J0IHRvSW50ZWdlciBmcm9tICcuLi90b0ludGVnZXIvaW5kZXguanMnO1xuaW1wb3J0IHRvRGF0ZSBmcm9tICcuLi8uLi90b0RhdGUvaW5kZXguanMnOyAvLyBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgYSBwYXJ0IG9mIHB1YmxpYyBBUEkgd2hlbiBVVEMgZnVuY3Rpb24gd2lsbCBiZSBpbXBsZW1lbnRlZC5cbi8vIFNlZSBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL2RhdGUtZm5zL2RhdGUtZm5zL2lzc3Vlcy8zNzZcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2V0VVRDSVNPRGF5KGRpcnR5RGF0ZSwgZGlydHlEYXkpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMiBhcmd1bWVudHMgcmVxdWlyZWQsIGJ1dCBvbmx5ICcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBwcmVzZW50Jyk7XG4gIH1cblxuICB2YXIgZGF5ID0gdG9JbnRlZ2VyKGRpcnR5RGF5KTtcblxuICBpZiAoZGF5ICUgNyA9PT0gMCkge1xuICAgIGRheSA9IGRheSAtIDc7XG4gIH1cblxuICB2YXIgd2Vla1N0YXJ0c09uID0gMTtcbiAgdmFyIGRhdGUgPSB0b0RhdGUoZGlydHlEYXRlKTtcbiAgdmFyIGN1cnJlbnREYXkgPSBkYXRlLmdldFVUQ0RheSgpO1xuICB2YXIgcmVtYWluZGVyID0gZGF5ICUgNztcbiAgdmFyIGRheUluZGV4ID0gKHJlbWFpbmRlciArIDcpICUgNztcbiAgdmFyIGRpZmYgPSAoZGF5SW5kZXggPCB3ZWVrU3RhcnRzT24gPyA3IDogMCkgKyBkYXkgLSBjdXJyZW50RGF5O1xuICBkYXRlLnNldFVUQ0RhdGUoZGF0ZS5nZXRVVENEYXRlKCkgKyBkaWZmKTtcbiAgcmV0dXJuIGRhdGU7XG59IiwiaW1wb3J0IHRvSW50ZWdlciBmcm9tICcuLi90b0ludGVnZXIvaW5kZXguanMnO1xuaW1wb3J0IHRvRGF0ZSBmcm9tICcuLi8uLi90b0RhdGUvaW5kZXguanMnO1xuaW1wb3J0IGdldFVUQ0lTT1dlZWsgZnJvbSAnLi4vZ2V0VVRDSVNPV2Vlay9pbmRleC5qcyc7IC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBhIHBhcnQgb2YgcHVibGljIEFQSSB3aGVuIFVUQyBmdW5jdGlvbiB3aWxsIGJlIGltcGxlbWVudGVkLlxuLy8gU2VlIGlzc3VlOiBodHRwczovL2dpdGh1Yi5jb20vZGF0ZS1mbnMvZGF0ZS1mbnMvaXNzdWVzLzM3NlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzZXRVVENJU09XZWVrKGRpcnR5RGF0ZSwgZGlydHlJU09XZWVrKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJzIgYXJndW1lbnRzIHJlcXVpcmVkLCBidXQgb25seSAnICsgYXJndW1lbnRzLmxlbmd0aCArICcgcHJlc2VudCcpO1xuICB9XG5cbiAgdmFyIGRhdGUgPSB0b0RhdGUoZGlydHlEYXRlKTtcbiAgdmFyIGlzb1dlZWsgPSB0b0ludGVnZXIoZGlydHlJU09XZWVrKTtcbiAgdmFyIGRpZmYgPSBnZXRVVENJU09XZWVrKGRhdGUpIC0gaXNvV2VlaztcbiAgZGF0ZS5zZXRVVENEYXRlKGRhdGUuZ2V0VVRDRGF0ZSgpIC0gZGlmZiAqIDcpO1xuICByZXR1cm4gZGF0ZTtcbn0iLCJpbXBvcnQgdG9JbnRlZ2VyIGZyb20gJy4uL3RvSW50ZWdlci9pbmRleC5qcyc7XG5pbXBvcnQgdG9EYXRlIGZyb20gJy4uLy4uL3RvRGF0ZS9pbmRleC5qcyc7XG5pbXBvcnQgZ2V0VVRDV2VlayBmcm9tICcuLi9nZXRVVENXZWVrL2luZGV4LmpzJzsgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGEgcGFydCBvZiBwdWJsaWMgQVBJIHdoZW4gVVRDIGZ1bmN0aW9uIHdpbGwgYmUgaW1wbGVtZW50ZWQuXG4vLyBTZWUgaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXRlLWZucy9kYXRlLWZucy9pc3N1ZXMvMzc2XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNldFVUQ1dlZWsoZGlydHlEYXRlLCBkaXJ0eVdlZWssIG9wdGlvbnMpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignMiBhcmd1bWVudHMgcmVxdWlyZWQsIGJ1dCBvbmx5ICcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBwcmVzZW50Jyk7XG4gIH1cblxuICB2YXIgZGF0ZSA9IHRvRGF0ZShkaXJ0eURhdGUpO1xuICB2YXIgd2VlayA9IHRvSW50ZWdlcihkaXJ0eVdlZWspO1xuICB2YXIgZGlmZiA9IGdldFVUQ1dlZWsoZGF0ZSwgb3B0aW9ucykgLSB3ZWVrO1xuICBkYXRlLnNldFVUQ0RhdGUoZGF0ZS5nZXRVVENEYXRlKCkgLSBkaWZmICogNyk7XG4gIHJldHVybiBkYXRlO1xufSIsImltcG9ydCBnZXRVVENXZWVrWWVhciBmcm9tICcuLi8uLi8uLi9fbGliL2dldFVUQ1dlZWtZZWFyL2luZGV4LmpzJztcbmltcG9ydCBzZXRVVENEYXkgZnJvbSAnLi4vLi4vLi4vX2xpYi9zZXRVVENEYXkvaW5kZXguanMnO1xuaW1wb3J0IHNldFVUQ0lTT0RheSBmcm9tICcuLi8uLi8uLi9fbGliL3NldFVUQ0lTT0RheS9pbmRleC5qcyc7XG5pbXBvcnQgc2V0VVRDSVNPV2VlayBmcm9tICcuLi8uLi8uLi9fbGliL3NldFVUQ0lTT1dlZWsvaW5kZXguanMnO1xuaW1wb3J0IHNldFVUQ1dlZWsgZnJvbSAnLi4vLi4vLi4vX2xpYi9zZXRVVENXZWVrL2luZGV4LmpzJztcbmltcG9ydCBzdGFydE9mVVRDSVNPV2VlayBmcm9tICcuLi8uLi8uLi9fbGliL3N0YXJ0T2ZVVENJU09XZWVrL2luZGV4LmpzJztcbmltcG9ydCBzdGFydE9mVVRDV2VlayBmcm9tICcuLi8uLi8uLi9fbGliL3N0YXJ0T2ZVVENXZWVrL2luZGV4LmpzJztcbnZhciBNSUxMSVNFQ09ORFNfSU5fSE9VUiA9IDM2MDAwMDA7XG52YXIgTUlMTElTRUNPTkRTX0lOX01JTlVURSA9IDYwMDAwO1xudmFyIE1JTExJU0VDT05EU19JTl9TRUNPTkQgPSAxMDAwO1xudmFyIG51bWVyaWNQYXR0ZXJucyA9IHtcbiAgbW9udGg6IC9eKDFbMC0yXXwwP1xcZCkvLFxuICAvLyAwIHRvIDEyXG4gIGRhdGU6IC9eKDNbMC0xXXxbMC0yXT9cXGQpLyxcbiAgLy8gMCB0byAzMVxuICBkYXlPZlllYXI6IC9eKDM2WzAtNl18M1swLTVdXFxkfFswLTJdP1xcZD9cXGQpLyxcbiAgLy8gMCB0byAzNjZcbiAgd2VlazogL14oNVswLTNdfFswLTRdP1xcZCkvLFxuICAvLyAwIHRvIDUzXG4gIGhvdXIyM2g6IC9eKDJbMC0zXXxbMC0xXT9cXGQpLyxcbiAgLy8gMCB0byAyM1xuICBob3VyMjRoOiAvXigyWzAtNF18WzAtMV0/XFxkKS8sXG4gIC8vIDAgdG8gMjRcbiAgaG91cjExaDogL14oMVswLTFdfDA/XFxkKS8sXG4gIC8vIDAgdG8gMTFcbiAgaG91cjEyaDogL14oMVswLTJdfDA/XFxkKS8sXG4gIC8vIDAgdG8gMTJcbiAgbWludXRlOiAvXlswLTVdP1xcZC8sXG4gIC8vIDAgdG8gNTlcbiAgc2Vjb25kOiAvXlswLTVdP1xcZC8sXG4gIC8vIDAgdG8gNTlcbiAgc2luZ2xlRGlnaXQ6IC9eXFxkLyxcbiAgLy8gMCB0byA5XG4gIHR3b0RpZ2l0czogL15cXGR7MSwyfS8sXG4gIC8vIDAgdG8gOTlcbiAgdGhyZWVEaWdpdHM6IC9eXFxkezEsM30vLFxuICAvLyAwIHRvIDk5OVxuICBmb3VyRGlnaXRzOiAvXlxcZHsxLDR9LyxcbiAgLy8gMCB0byA5OTk5XG4gIGFueURpZ2l0c1NpZ25lZDogL14tP1xcZCsvLFxuICBzaW5nbGVEaWdpdFNpZ25lZDogL14tP1xcZC8sXG4gIC8vIDAgdG8gOSwgLTAgdG8gLTlcbiAgdHdvRGlnaXRzU2lnbmVkOiAvXi0/XFxkezEsMn0vLFxuICAvLyAwIHRvIDk5LCAtMCB0byAtOTlcbiAgdGhyZWVEaWdpdHNTaWduZWQ6IC9eLT9cXGR7MSwzfS8sXG4gIC8vIDAgdG8gOTk5LCAtMCB0byAtOTk5XG4gIGZvdXJEaWdpdHNTaWduZWQ6IC9eLT9cXGR7MSw0fS8gLy8gMCB0byA5OTk5LCAtMCB0byAtOTk5OVxuXG59O1xudmFyIHRpbWV6b25lUGF0dGVybnMgPSB7XG4gIGJhc2ljT3B0aW9uYWxNaW51dGVzOiAvXihbKy1dKShcXGR7Mn0pKFxcZHsyfSk/fFovLFxuICBiYXNpYzogL14oWystXSkoXFxkezJ9KShcXGR7Mn0pfFovLFxuICBiYXNpY09wdGlvbmFsU2Vjb25kczogL14oWystXSkoXFxkezJ9KShcXGR7Mn0pKChcXGR7Mn0pKT98Wi8sXG4gIGV4dGVuZGVkOiAvXihbKy1dKShcXGR7Mn0pOihcXGR7Mn0pfFovLFxuICBleHRlbmRlZE9wdGlvbmFsU2Vjb25kczogL14oWystXSkoXFxkezJ9KTooXFxkezJ9KSg6KFxcZHsyfSkpP3xaL1xufTtcblxuZnVuY3Rpb24gcGFyc2VOdW1lcmljUGF0dGVybihwYXR0ZXJuLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spIHtcbiAgdmFyIG1hdGNoUmVzdWx0ID0gc3RyaW5nLm1hdGNoKHBhdHRlcm4pO1xuXG4gIGlmICghbWF0Y2hSZXN1bHQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhciB2YWx1ZSA9IHBhcnNlSW50KG1hdGNoUmVzdWx0WzBdLCAxMCk7XG4gIHJldHVybiB7XG4gICAgdmFsdWU6IHZhbHVlQ2FsbGJhY2sgPyB2YWx1ZUNhbGxiYWNrKHZhbHVlKSA6IHZhbHVlLFxuICAgIHJlc3Q6IHN0cmluZy5zbGljZShtYXRjaFJlc3VsdFswXS5sZW5ndGgpXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlVGltZXpvbmVQYXR0ZXJuKHBhdHRlcm4sIHN0cmluZykge1xuICB2YXIgbWF0Y2hSZXN1bHQgPSBzdHJpbmcubWF0Y2gocGF0dGVybik7XG5cbiAgaWYgKCFtYXRjaFJlc3VsdCkge1xuICAgIHJldHVybiBudWxsO1xuICB9IC8vIElucHV0IGlzICdaJ1xuXG5cbiAgaWYgKG1hdGNoUmVzdWx0WzBdID09PSAnWicpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmFsdWU6IDAsXG4gICAgICByZXN0OiBzdHJpbmcuc2xpY2UoMSlcbiAgICB9O1xuICB9XG5cbiAgdmFyIHNpZ24gPSBtYXRjaFJlc3VsdFsxXSA9PT0gJysnID8gMSA6IC0xO1xuICB2YXIgaG91cnMgPSBtYXRjaFJlc3VsdFsyXSA/IHBhcnNlSW50KG1hdGNoUmVzdWx0WzJdLCAxMCkgOiAwO1xuICB2YXIgbWludXRlcyA9IG1hdGNoUmVzdWx0WzNdID8gcGFyc2VJbnQobWF0Y2hSZXN1bHRbM10sIDEwKSA6IDA7XG4gIHZhciBzZWNvbmRzID0gbWF0Y2hSZXN1bHRbNV0gPyBwYXJzZUludChtYXRjaFJlc3VsdFs1XSwgMTApIDogMDtcbiAgcmV0dXJuIHtcbiAgICB2YWx1ZTogc2lnbiAqIChob3VycyAqIE1JTExJU0VDT05EU19JTl9IT1VSICsgbWludXRlcyAqIE1JTExJU0VDT05EU19JTl9NSU5VVEUgKyBzZWNvbmRzICogTUlMTElTRUNPTkRTX0lOX1NFQ09ORCksXG4gICAgcmVzdDogc3RyaW5nLnNsaWNlKG1hdGNoUmVzdWx0WzBdLmxlbmd0aClcbiAgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VBbnlEaWdpdHNTaWduZWQoc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKSB7XG4gIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy5hbnlEaWdpdHNTaWduZWQsIHN0cmluZywgdmFsdWVDYWxsYmFjayk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTkRpZ2l0cyhuLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spIHtcbiAgc3dpdGNoIChuKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIHBhcnNlTnVtZXJpY1BhdHRlcm4obnVtZXJpY1BhdHRlcm5zLnNpbmdsZURpZ2l0LCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuXG4gICAgY2FzZSAyOlxuICAgICAgcmV0dXJuIHBhcnNlTnVtZXJpY1BhdHRlcm4obnVtZXJpY1BhdHRlcm5zLnR3b0RpZ2l0cywgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcblxuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy50aHJlZURpZ2l0cywgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcblxuICAgIGNhc2UgNDpcbiAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy5mb3VyRGlnaXRzLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG5ldyBSZWdFeHAoJ15cXFxcZHsxLCcgKyBuICsgJ30nKSwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZU5EaWdpdHNTaWduZWQobiwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKSB7XG4gIHN3aXRjaCAobikge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy5zaW5nbGVEaWdpdFNpZ25lZCwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcblxuICAgIGNhc2UgMjpcbiAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy50d29EaWdpdHNTaWduZWQsIHN0cmluZywgdmFsdWVDYWxsYmFjayk7XG5cbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gcGFyc2VOdW1lcmljUGF0dGVybihudW1lcmljUGF0dGVybnMudGhyZWVEaWdpdHNTaWduZWQsIHN0cmluZywgdmFsdWVDYWxsYmFjayk7XG5cbiAgICBjYXNlIDQ6XG4gICAgICByZXR1cm4gcGFyc2VOdW1lcmljUGF0dGVybihudW1lcmljUGF0dGVybnMuZm91ckRpZ2l0c1NpZ25lZCwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gcGFyc2VOdW1lcmljUGF0dGVybihuZXcgUmVnRXhwKCdeLT9cXFxcZHsxLCcgKyBuICsgJ30nKSwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkYXlQZXJpb2RFbnVtVG9Ib3VycyhlbnVtVmFsdWUpIHtcbiAgc3dpdGNoIChlbnVtVmFsdWUpIHtcbiAgICBjYXNlICdtb3JuaW5nJzpcbiAgICAgIHJldHVybiA0O1xuXG4gICAgY2FzZSAnZXZlbmluZyc6XG4gICAgICByZXR1cm4gMTc7XG5cbiAgICBjYXNlICdwbSc6XG4gICAgY2FzZSAnbm9vbic6XG4gICAgY2FzZSAnYWZ0ZXJub29uJzpcbiAgICAgIHJldHVybiAxMjtcblxuICAgIGNhc2UgJ2FtJzpcbiAgICBjYXNlICdtaWRuaWdodCc6XG4gICAgY2FzZSAnbmlnaHQnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gMDtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVUd29EaWdpdFllYXIodHdvRGlnaXRZZWFyLCBjdXJyZW50WWVhcikge1xuICB2YXIgaXNDb21tb25FcmEgPSBjdXJyZW50WWVhciA+IDA7IC8vIEFic29sdXRlIG51bWJlciBvZiB0aGUgY3VycmVudCB5ZWFyOlxuICAvLyAxIC0+IDEgQUNcbiAgLy8gMCAtPiAxIEJDXG4gIC8vIC0xIC0+IDIgQkNcblxuICB2YXIgYWJzQ3VycmVudFllYXIgPSBpc0NvbW1vbkVyYSA/IGN1cnJlbnRZZWFyIDogMSAtIGN1cnJlbnRZZWFyO1xuICB2YXIgcmVzdWx0O1xuXG4gIGlmIChhYnNDdXJyZW50WWVhciA8PSA1MCkge1xuICAgIHJlc3VsdCA9IHR3b0RpZ2l0WWVhciB8fCAxMDA7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHJhbmdlRW5kID0gYWJzQ3VycmVudFllYXIgKyA1MDtcbiAgICB2YXIgcmFuZ2VFbmRDZW50dXJ5ID0gTWF0aC5mbG9vcihyYW5nZUVuZCAvIDEwMCkgKiAxMDA7XG4gICAgdmFyIGlzUHJldmlvdXNDZW50dXJ5ID0gdHdvRGlnaXRZZWFyID49IHJhbmdlRW5kICUgMTAwO1xuICAgIHJlc3VsdCA9IHR3b0RpZ2l0WWVhciArIHJhbmdlRW5kQ2VudHVyeSAtIChpc1ByZXZpb3VzQ2VudHVyeSA/IDEwMCA6IDApO1xuICB9XG5cbiAgcmV0dXJuIGlzQ29tbW9uRXJhID8gcmVzdWx0IDogMSAtIHJlc3VsdDtcbn1cblxudmFyIERBWVNfSU5fTU9OVEggPSBbMzEsIDI4LCAzMSwgMzAsIDMxLCAzMCwgMzEsIDMxLCAzMCwgMzEsIDMwLCAzMV07XG52YXIgREFZU19JTl9NT05USF9MRUFQX1lFQVIgPSBbMzEsIDI5LCAzMSwgMzAsIDMxLCAzMCwgMzEsIDMxLCAzMCwgMzEsIDMwLCAzMV07IC8vIFVzZXIgZm9yIHZhbGlkYXRpb25cblxuZnVuY3Rpb24gaXNMZWFwWWVhckluZGV4KHllYXIpIHtcbiAgcmV0dXJuIHllYXIgJSA0MDAgPT09IDAgfHwgeWVhciAlIDQgPT09IDAgJiYgeWVhciAlIDEwMCAhPT0gMDtcbn1cbi8qXG4gKiB8ICAgICB8IFVuaXQgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICAgICB8IFVuaXQgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8LS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18LS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18XG4gKiB8ICBhICB8IEFNLCBQTSAgICAgICAgICAgICAgICAgICAgICAgICB8ICBBKiB8IE1pbGxpc2Vjb25kcyBpbiBkYXkgICAgICAgICAgICB8XG4gKiB8ICBiICB8IEFNLCBQTSwgbm9vbiwgbWlkbmlnaHQgICAgICAgICB8ICBCICB8IEZsZXhpYmxlIGRheSBwZXJpb2QgICAgICAgICAgICB8XG4gKiB8ICBjICB8IFN0YW5kLWFsb25lIGxvY2FsIGRheSBvZiB3ZWVrICB8ICBDKiB8IExvY2FsaXplZCBob3VyIHcvIGRheSBwZXJpb2QgICB8XG4gKiB8ICBkICB8IERheSBvZiBtb250aCAgICAgICAgICAgICAgICAgICB8ICBEICB8IERheSBvZiB5ZWFyICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBlICB8IExvY2FsIGRheSBvZiB3ZWVrICAgICAgICAgICAgICB8ICBFICB8IERheSBvZiB3ZWVrICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBmICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICBGKiB8IERheSBvZiB3ZWVrIGluIG1vbnRoICAgICAgICAgICB8XG4gKiB8ICBnKiB8IE1vZGlmaWVkIEp1bGlhbiBkYXkgICAgICAgICAgICB8ICBHICB8IEVyYSAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBoICB8IEhvdXIgWzEtMTJdICAgICAgICAgICAgICAgICAgICB8ICBIICB8IEhvdXIgWzAtMjNdICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBpISB8IElTTyBkYXkgb2Ygd2VlayAgICAgICAgICAgICAgICB8ICBJISB8IElTTyB3ZWVrIG9mIHllYXIgICAgICAgICAgICAgICB8XG4gKiB8ICBqKiB8IExvY2FsaXplZCBob3VyIHcvIGRheSBwZXJpb2QgICB8ICBKKiB8IExvY2FsaXplZCBob3VyIHcvbyBkYXkgcGVyaW9kICB8XG4gKiB8ICBrICB8IEhvdXIgWzEtMjRdICAgICAgICAgICAgICAgICAgICB8ICBLICB8IEhvdXIgWzAtMTFdICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBsKiB8IChkZXByZWNhdGVkKSAgICAgICAgICAgICAgICAgICB8ICBMICB8IFN0YW5kLWFsb25lIG1vbnRoICAgICAgICAgICAgICB8XG4gKiB8ICBtICB8IE1pbnV0ZSAgICAgICAgICAgICAgICAgICAgICAgICB8ICBNICB8IE1vbnRoICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBuICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICBOICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBvISB8IE9yZGluYWwgbnVtYmVyIG1vZGlmaWVyICAgICAgICB8ICBPKiB8IFRpbWV6b25lIChHTVQpICAgICAgICAgICAgICAgICB8XG4gKiB8ICBwICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICBQICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICBxICB8IFN0YW5kLWFsb25lIHF1YXJ0ZXIgICAgICAgICAgICB8ICBRICB8IFF1YXJ0ZXIgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICByKiB8IFJlbGF0ZWQgR3JlZ29yaWFuIHllYXIgICAgICAgICB8ICBSISB8IElTTyB3ZWVrLW51bWJlcmluZyB5ZWFyICAgICAgICB8XG4gKiB8ICBzICB8IFNlY29uZCAgICAgICAgICAgICAgICAgICAgICAgICB8ICBTICB8IEZyYWN0aW9uIG9mIHNlY29uZCAgICAgICAgICAgICB8XG4gKiB8ICB0ISB8IFNlY29uZHMgdGltZXN0YW1wICAgICAgICAgICAgICB8ICBUISB8IE1pbGxpc2Vjb25kcyB0aW1lc3RhbXAgICAgICAgICB8XG4gKiB8ICB1ICB8IEV4dGVuZGVkIHllYXIgICAgICAgICAgICAgICAgICB8ICBVKiB8IEN5Y2xpYyB5ZWFyICAgICAgICAgICAgICAgICAgICB8XG4gKiB8ICB2KiB8IFRpbWV6b25lIChnZW5lcmljIG5vbi1sb2NhdC4pICB8ICBWKiB8IFRpbWV6b25lIChsb2NhdGlvbikgICAgICAgICAgICB8XG4gKiB8ICB3ICB8IExvY2FsIHdlZWsgb2YgeWVhciAgICAgICAgICAgICB8ICBXKiB8IFdlZWsgb2YgbW9udGggICAgICAgICAgICAgICAgICB8XG4gKiB8ICB4ICB8IFRpbWV6b25lIChJU08tODYwMSB3L28gWikgICAgICB8ICBYICB8IFRpbWV6b25lIChJU08tODYwMSkgICAgICAgICAgICB8XG4gKiB8ICB5ICB8IFllYXIgKGFicykgICAgICAgICAgICAgICAgICAgICB8ICBZICB8IExvY2FsIHdlZWstbnVtYmVyaW5nIHllYXIgICAgICB8XG4gKiB8ICB6KiB8IFRpbWV6b25lIChzcGVjaWZpYyBub24tbG9jYXQuKSB8ICBaKiB8IFRpbWV6b25lIChhbGlhc2VzKSAgICAgICAgICAgICB8XG4gKlxuICogTGV0dGVycyBtYXJrZWQgYnkgKiBhcmUgbm90IGltcGxlbWVudGVkIGJ1dCByZXNlcnZlZCBieSBVbmljb2RlIHN0YW5kYXJkLlxuICpcbiAqIExldHRlcnMgbWFya2VkIGJ5ICEgYXJlIG5vbi1zdGFuZGFyZCwgYnV0IGltcGxlbWVudGVkIGJ5IGRhdGUtZm5zOlxuICogLSBgb2AgbW9kaWZpZXMgdGhlIHByZXZpb3VzIHRva2VuIHRvIHR1cm4gaXQgaW50byBhbiBvcmRpbmFsIChzZWUgYHBhcnNlYCBkb2NzKVxuICogLSBgaWAgaXMgSVNPIGRheSBvZiB3ZWVrLiBGb3IgYGlgIGFuZCBgaWlgIGlzIHJldHVybnMgbnVtZXJpYyBJU08gd2VlayBkYXlzLFxuICogICBpLmUuIDcgZm9yIFN1bmRheSwgMSBmb3IgTW9uZGF5LCBldGMuXG4gKiAtIGBJYCBpcyBJU08gd2VlayBvZiB5ZWFyLCBhcyBvcHBvc2VkIHRvIGB3YCB3aGljaCBpcyBsb2NhbCB3ZWVrIG9mIHllYXIuXG4gKiAtIGBSYCBpcyBJU08gd2Vlay1udW1iZXJpbmcgeWVhciwgYXMgb3Bwb3NlZCB0byBgWWAgd2hpY2ggaXMgbG9jYWwgd2Vlay1udW1iZXJpbmcgeWVhci5cbiAqICAgYFJgIGlzIHN1cHBvc2VkIHRvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgSWAgYW5kIGBpYFxuICogICBmb3IgdW5pdmVyc2FsIElTTyB3ZWVrLW51bWJlcmluZyBkYXRlLCB3aGVyZWFzXG4gKiAgIGBZYCBpcyBzdXBwb3NlZCB0byBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYHdgIGFuZCBgZWBcbiAqICAgZm9yIHdlZWstbnVtYmVyaW5nIGRhdGUgc3BlY2lmaWMgdG8gdGhlIGxvY2FsZS5cbiAqL1xuXG5cbnZhciBwYXJzZXJzID0ge1xuICAvLyBFcmFcbiAgRzoge1xuICAgIHByaW9yaXR5OiAxNDAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgLy8gQUQsIEJDXG4gICAgICAgIGNhc2UgJ0cnOlxuICAgICAgICBjYXNlICdHRyc6XG4gICAgICAgIGNhc2UgJ0dHRyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmVyYShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZXJhKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIEEsIEJcblxuICAgICAgICBjYXNlICdHR0dHRyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmVyYShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93J1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyBBbm5vIERvbWluaSwgQmVmb3JlIENocmlzdFxuXG4gICAgICAgIGNhc2UgJ0dHR0cnOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBtYXRjaC5lcmEoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3dpZGUnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZXJhKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCdcbiAgICAgICAgICB9KSB8fCBtYXRjaC5lcmEoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdydcbiAgICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIGZsYWdzLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIGZsYWdzLmVyYSA9IHZhbHVlO1xuICAgICAgZGF0ZS5zZXRVVENGdWxsWWVhcih2YWx1ZSwgMCwgMSk7XG4gICAgICBkYXRlLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6IFsnUicsICd1JywgJ3QnLCAnVCddXG4gIH0sXG4gIC8vIFllYXJcbiAgeToge1xuICAgIC8vIEZyb20gaHR0cDovL3d3dy51bmljb2RlLm9yZy9yZXBvcnRzL3RyMzUvdHIzNS0zMS90cjM1LWRhdGVzLmh0bWwjRGF0ZV9Gb3JtYXRfUGF0dGVybnNcbiAgICAvLyB8IFllYXIgICAgIHwgICAgIHkgfCB5eSB8ICAgeXl5IHwgIHl5eXkgfCB5eXl5eSB8XG4gICAgLy8gfC0tLS0tLS0tLS18LS0tLS0tLXwtLS0tfC0tLS0tLS18LS0tLS0tLXwtLS0tLS0tfFxuICAgIC8vIHwgQUQgMSAgICAgfCAgICAgMSB8IDAxIHwgICAwMDEgfCAgMDAwMSB8IDAwMDAxIHxcbiAgICAvLyB8IEFEIDEyICAgIHwgICAgMTIgfCAxMiB8ICAgMDEyIHwgIDAwMTIgfCAwMDAxMiB8XG4gICAgLy8gfCBBRCAxMjMgICB8ICAgMTIzIHwgMjMgfCAgIDEyMyB8ICAwMTIzIHwgMDAxMjMgfFxuICAgIC8vIHwgQUQgMTIzNCAgfCAgMTIzNCB8IDM0IHwgIDEyMzQgfCAgMTIzNCB8IDAxMjM0IHxcbiAgICAvLyB8IEFEIDEyMzQ1IHwgMTIzNDUgfCA0NSB8IDEyMzQ1IHwgMTIzNDUgfCAxMjM0NSB8XG4gICAgcHJpb3JpdHk6IDEzMCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBfb3B0aW9ucykge1xuICAgICAgdmFyIHZhbHVlQ2FsbGJhY2sgPSBmdW5jdGlvbiAoeWVhcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHllYXI6IHllYXIsXG4gICAgICAgICAgaXNUd29EaWdpdFllYXI6IHRva2VuID09PSAneXknXG4gICAgICAgIH07XG4gICAgICB9O1xuXG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIGNhc2UgJ3knOlxuICAgICAgICAgIHJldHVybiBwYXJzZU5EaWdpdHMoNCwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcblxuICAgICAgICBjYXNlICd5byc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm9yZGluYWxOdW1iZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB1bml0OiAneWVhcicsXG4gICAgICAgICAgICB2YWx1ZUNhbGxiYWNrOiB2YWx1ZUNhbGxiYWNrXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoX2RhdGUsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHZhbHVlLmlzVHdvRGlnaXRZZWFyIHx8IHZhbHVlLnllYXIgPiAwO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgZmxhZ3MsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgdmFyIGN1cnJlbnRZZWFyID0gZGF0ZS5nZXRVVENGdWxsWWVhcigpO1xuXG4gICAgICBpZiAodmFsdWUuaXNUd29EaWdpdFllYXIpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRUd29EaWdpdFllYXIgPSBub3JtYWxpemVUd29EaWdpdFllYXIodmFsdWUueWVhciwgY3VycmVudFllYXIpO1xuICAgICAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKG5vcm1hbGl6ZWRUd29EaWdpdFllYXIsIDAsIDEpO1xuICAgICAgICBkYXRlLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgICByZXR1cm4gZGF0ZTtcbiAgICAgIH1cblxuICAgICAgdmFyIHllYXIgPSAhKCdlcmEnIGluIGZsYWdzKSB8fCBmbGFncy5lcmEgPT09IDEgPyB2YWx1ZS55ZWFyIDogMSAtIHZhbHVlLnllYXI7XG4gICAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKHllYXIsIDAsIDEpO1xuICAgICAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ1knLCAnUicsICd1JywgJ3cnLCAnSScsICdpJywgJ2UnLCAnYycsICd0JywgJ1QnXVxuICB9LFxuICAvLyBMb2NhbCB3ZWVrLW51bWJlcmluZyB5ZWFyXG4gIFk6IHtcbiAgICBwcmlvcml0eTogMTMwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICB2YXIgdmFsdWVDYWxsYmFjayA9IGZ1bmN0aW9uICh5ZWFyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgeWVhcjogeWVhcixcbiAgICAgICAgICBpc1R3b0RpZ2l0WWVhcjogdG9rZW4gPT09ICdZWSdcbiAgICAgICAgfTtcbiAgICAgIH07XG5cbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgY2FzZSAnWSc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTkRpZ2l0cyg0LCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuXG4gICAgICAgIGNhc2UgJ1lvJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gub3JkaW5hbE51bWJlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHVuaXQ6ICd5ZWFyJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KTtcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBwYXJzZU5EaWdpdHModG9rZW4ubGVuZ3RoLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuICAgICAgfVxuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChfZGF0ZSwgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICByZXR1cm4gdmFsdWUuaXNUd29EaWdpdFllYXIgfHwgdmFsdWUueWVhciA+IDA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBmbGFncywgdmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBjdXJyZW50WWVhciA9IGdldFVUQ1dlZWtZZWFyKGRhdGUsIG9wdGlvbnMpO1xuXG4gICAgICBpZiAodmFsdWUuaXNUd29EaWdpdFllYXIpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRUd29EaWdpdFllYXIgPSBub3JtYWxpemVUd29EaWdpdFllYXIodmFsdWUueWVhciwgY3VycmVudFllYXIpO1xuICAgICAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKG5vcm1hbGl6ZWRUd29EaWdpdFllYXIsIDAsIG9wdGlvbnMuZmlyc3RXZWVrQ29udGFpbnNEYXRlKTtcbiAgICAgICAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgICAgcmV0dXJuIHN0YXJ0T2ZVVENXZWVrKGRhdGUsIG9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICB2YXIgeWVhciA9ICEoJ2VyYScgaW4gZmxhZ3MpIHx8IGZsYWdzLmVyYSA9PT0gMSA/IHZhbHVlLnllYXIgOiAxIC0gdmFsdWUueWVhcjtcbiAgICAgIGRhdGUuc2V0VVRDRnVsbFllYXIoeWVhciwgMCwgb3B0aW9ucy5maXJzdFdlZWtDb250YWluc0RhdGUpO1xuICAgICAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgIHJldHVybiBzdGFydE9mVVRDV2VlayhkYXRlLCBvcHRpb25zKTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWyd5JywgJ1InLCAndScsICdRJywgJ3EnLCAnTScsICdMJywgJ0knLCAnZCcsICdEJywgJ2knLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gSVNPIHdlZWstbnVtYmVyaW5nIHllYXJcbiAgUjoge1xuICAgIHByaW9yaXR5OiAxMzAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBfbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICBpZiAodG9rZW4gPT09ICdSJykge1xuICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzU2lnbmVkKDQsIHN0cmluZyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJzZU5EaWdpdHNTaWduZWQodG9rZW4ubGVuZ3RoLCBzdHJpbmcpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoX2RhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICB2YXIgZmlyc3RXZWVrT2ZZZWFyID0gbmV3IERhdGUoMCk7XG4gICAgICBmaXJzdFdlZWtPZlllYXIuc2V0VVRDRnVsbFllYXIodmFsdWUsIDAsIDQpO1xuICAgICAgZmlyc3RXZWVrT2ZZZWFyLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgcmV0dXJuIHN0YXJ0T2ZVVENJU09XZWVrKGZpcnN0V2Vla09mWWVhcik7XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6IFsnRycsICd5JywgJ1knLCAndScsICdRJywgJ3EnLCAnTScsICdMJywgJ3cnLCAnZCcsICdEJywgJ2UnLCAnYycsICd0JywgJ1QnXVxuICB9LFxuICAvLyBFeHRlbmRlZCB5ZWFyXG4gIHU6IHtcbiAgICBwcmlvcml0eTogMTMwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgX21hdGNoLCBfb3B0aW9ucykge1xuICAgICAgaWYgKHRva2VuID09PSAndScpIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlTkRpZ2l0c1NpZ25lZCg0LCBzdHJpbmcpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyc2VORGlnaXRzU2lnbmVkKHRva2VuLmxlbmd0aCwgc3RyaW5nKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKHZhbHVlLCAwLCAxKTtcbiAgICAgIGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWydHJywgJ3knLCAnWScsICdSJywgJ3cnLCAnSScsICdpJywgJ2UnLCAnYycsICd0JywgJ1QnXVxuICB9LFxuICAvLyBRdWFydGVyXG4gIFE6IHtcbiAgICBwcmlvcml0eTogMTIwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIC8vIDEsIDIsIDMsIDRcbiAgICAgICAgY2FzZSAnUSc6XG4gICAgICAgIGNhc2UgJ1FRJzpcbiAgICAgICAgICAvLyAwMSwgMDIsIDAzLCAwNFxuICAgICAgICAgIHJldHVybiBwYXJzZU5EaWdpdHModG9rZW4ubGVuZ3RoLCBzdHJpbmcpO1xuICAgICAgICAvLyAxc3QsIDJuZCwgM3JkLCA0dGhcblxuICAgICAgICBjYXNlICdRbyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm9yZGluYWxOdW1iZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB1bml0OiAncXVhcnRlcidcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gUTEsIFEyLCBRMywgUTRcblxuICAgICAgICBjYXNlICdRUVEnOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5xdWFydGVyKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5xdWFydGVyKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIDEsIDIsIDMsIDQgKG5hcnJvdyBxdWFydGVyOyBjb3VsZCBiZSBub3QgbnVtZXJpY2FsKVxuXG4gICAgICAgIGNhc2UgJ1FRUVFRJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gucXVhcnRlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyAxc3QgcXVhcnRlciwgMm5kIHF1YXJ0ZXIsIC4uLlxuXG4gICAgICAgIGNhc2UgJ1FRUVEnOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBtYXRjaC5xdWFydGVyKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLnF1YXJ0ZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLnF1YXJ0ZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoX2RhdGUsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHZhbHVlID49IDEgJiYgdmFsdWUgPD0gNDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICBkYXRlLnNldFVUQ01vbnRoKCh2YWx1ZSAtIDEpICogMywgMSk7XG4gICAgICBkYXRlLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6IFsnWScsICdSJywgJ3EnLCAnTScsICdMJywgJ3cnLCAnSScsICdkJywgJ0QnLCAnaScsICdlJywgJ2MnLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gU3RhbmQtYWxvbmUgcXVhcnRlclxuICBxOiB7XG4gICAgcHJpb3JpdHk6IDEyMCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBfb3B0aW9ucykge1xuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICAvLyAxLCAyLCAzLCA0XG4gICAgICAgIGNhc2UgJ3EnOlxuICAgICAgICBjYXNlICdxcSc6XG4gICAgICAgICAgLy8gMDEsIDAyLCAwMywgMDRcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nKTtcbiAgICAgICAgLy8gMXN0LCAybmQsIDNyZCwgNHRoXG5cbiAgICAgICAgY2FzZSAncW8nOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5vcmRpbmFsTnVtYmVyKHN0cmluZywge1xuICAgICAgICAgICAgdW5pdDogJ3F1YXJ0ZXInXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIFExLCBRMiwgUTMsIFE0XG5cbiAgICAgICAgY2FzZSAncXFxJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gucXVhcnRlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSkgfHwgbWF0Y2gucXVhcnRlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyAxLCAyLCAzLCA0IChuYXJyb3cgcXVhcnRlcjsgY291bGQgYmUgbm90IG51bWVyaWNhbClcblxuICAgICAgICBjYXNlICdxcXFxcSc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLnF1YXJ0ZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gMXN0IHF1YXJ0ZXIsIDJuZCBxdWFydGVyLCAuLi5cblxuICAgICAgICBjYXNlICdxcXFxJzpcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gucXVhcnRlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnd2lkZScsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KSB8fCBtYXRjaC5xdWFydGVyKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KSB8fCBtYXRjaC5xdWFydGVyKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAxICYmIHZhbHVlIDw9IDQ7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgZGF0ZS5zZXRVVENNb250aCgodmFsdWUgLSAxKSAqIDMsIDEpO1xuICAgICAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ1knLCAnUicsICdRJywgJ00nLCAnTCcsICd3JywgJ0knLCAnZCcsICdEJywgJ2knLCAnZScsICdjJywgJ3QnLCAnVCddXG4gIH0sXG4gIC8vIE1vbnRoXG4gIE06IHtcbiAgICBwcmlvcml0eTogMTEwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICB2YXIgdmFsdWVDYWxsYmFjayA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgLSAxO1xuICAgICAgfTtcblxuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICAvLyAxLCAyLCAuLi4sIDEyXG4gICAgICAgIGNhc2UgJ00nOlxuICAgICAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy5tb250aCwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcbiAgICAgICAgLy8gMDEsIDAyLCAuLi4sIDEyXG5cbiAgICAgICAgY2FzZSAnTU0nOlxuICAgICAgICAgIHJldHVybiBwYXJzZU5EaWdpdHMoMiwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcbiAgICAgICAgLy8gMXN0LCAybmQsIC4uLiwgMTJ0aFxuXG4gICAgICAgIGNhc2UgJ01vJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gub3JkaW5hbE51bWJlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHVuaXQ6ICdtb250aCcsXG4gICAgICAgICAgICB2YWx1ZUNhbGxiYWNrOiB2YWx1ZUNhbGxiYWNrXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIEphbiwgRmViLCAuLi4sIERlY1xuXG4gICAgICAgIGNhc2UgJ01NTSc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm1vbnRoKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5tb250aChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyBKLCBGLCAuLi4sIERcblxuICAgICAgICBjYXNlICdNTU1NTSc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm1vbnRoKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIEphbnVhcnksIEZlYnJ1YXJ5LCAuLi4sIERlY2VtYmVyXG5cbiAgICAgICAgY2FzZSAnTU1NTSc6XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm1vbnRoKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLm1vbnRoKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5tb250aChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChfZGF0ZSwgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICByZXR1cm4gdmFsdWUgPj0gMCAmJiB2YWx1ZSA8PSAxMTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICBkYXRlLnNldFVUQ01vbnRoKHZhbHVlLCAxKTtcbiAgICAgIGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWydZJywgJ1InLCAncScsICdRJywgJ0wnLCAndycsICdJJywgJ0QnLCAnaScsICdlJywgJ2MnLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gU3RhbmQtYWxvbmUgbW9udGhcbiAgTDoge1xuICAgIHByaW9yaXR5OiAxMTAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHZhciB2YWx1ZUNhbGxiYWNrID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAtIDE7XG4gICAgICB9O1xuXG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIC8vIDEsIDIsIC4uLiwgMTJcbiAgICAgICAgY2FzZSAnTCc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTnVtZXJpY1BhdHRlcm4obnVtZXJpY1BhdHRlcm5zLm1vbnRoLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuICAgICAgICAvLyAwMSwgMDIsIC4uLiwgMTJcblxuICAgICAgICBjYXNlICdMTCc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTkRpZ2l0cygyLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuICAgICAgICAvLyAxc3QsIDJuZCwgLi4uLCAxMnRoXG5cbiAgICAgICAgY2FzZSAnTG8nOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5vcmRpbmFsTnVtYmVyKHN0cmluZywge1xuICAgICAgICAgICAgdW5pdDogJ21vbnRoJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gSmFuLCBGZWIsIC4uLiwgRGVjXG5cbiAgICAgICAgY2FzZSAnTExMJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gubW9udGgoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLm1vbnRoKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIEosIEYsIC4uLiwgRFxuXG4gICAgICAgIGNhc2UgJ0xMTExMJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gubW9udGgoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gSmFudWFyeSwgRmVicnVhcnksIC4uLiwgRGVjZW1iZXJcblxuICAgICAgICBjYXNlICdMTExMJzpcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gubW9udGgoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3dpZGUnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSkgfHwgbWF0Y2gubW9udGgoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLm1vbnRoKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAwICYmIHZhbHVlIDw9IDExO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIGRhdGUuc2V0VVRDTW9udGgodmFsdWUsIDEpO1xuICAgICAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ1knLCAnUicsICdxJywgJ1EnLCAnTScsICd3JywgJ0knLCAnRCcsICdpJywgJ2UnLCAnYycsICd0JywgJ1QnXVxuICB9LFxuICAvLyBMb2NhbCB3ZWVrIG9mIHllYXJcbiAgdzoge1xuICAgIHByaW9yaXR5OiAxMDAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgY2FzZSAndyc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTnVtZXJpY1BhdHRlcm4obnVtZXJpY1BhdHRlcm5zLndlZWssIHN0cmluZyk7XG5cbiAgICAgICAgY2FzZSAnd28nOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5vcmRpbmFsTnVtYmVyKHN0cmluZywge1xuICAgICAgICAgICAgdW5pdDogJ3dlZWsnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoX2RhdGUsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHZhbHVlID49IDEgJiYgdmFsdWUgPD0gNTM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBvcHRpb25zKSB7XG4gICAgICByZXR1cm4gc3RhcnRPZlVUQ1dlZWsoc2V0VVRDV2VlayhkYXRlLCB2YWx1ZSwgb3B0aW9ucyksIG9wdGlvbnMpO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ3knLCAnUicsICd1JywgJ3EnLCAnUScsICdNJywgJ0wnLCAnSScsICdkJywgJ0QnLCAnaScsICd0JywgJ1QnXVxuICB9LFxuICAvLyBJU08gd2VlayBvZiB5ZWFyXG4gIEk6IHtcbiAgICBwcmlvcml0eTogMTAwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIGNhc2UgJ0knOlxuICAgICAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy53ZWVrLCBzdHJpbmcpO1xuXG4gICAgICAgIGNhc2UgJ0lvJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gub3JkaW5hbE51bWJlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHVuaXQ6ICd3ZWVrJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTkRpZ2l0cyh0b2tlbi5sZW5ndGgsIHN0cmluZyk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAxICYmIHZhbHVlIDw9IDUzO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHN0YXJ0T2ZVVENJU09XZWVrKHNldFVUQ0lTT1dlZWsoZGF0ZSwgdmFsdWUsIG9wdGlvbnMpLCBvcHRpb25zKTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWyd5JywgJ1knLCAndScsICdxJywgJ1EnLCAnTScsICdMJywgJ3cnLCAnZCcsICdEJywgJ2UnLCAnYycsICd0JywgJ1QnXVxuICB9LFxuICAvLyBEYXkgb2YgdGhlIG1vbnRoXG4gIGQ6IHtcbiAgICBwcmlvcml0eTogOTAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgY2FzZSAnZCc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTnVtZXJpY1BhdHRlcm4obnVtZXJpY1BhdHRlcm5zLmRhdGUsIHN0cmluZyk7XG5cbiAgICAgICAgY2FzZSAnZG8nOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5vcmRpbmFsTnVtYmVyKHN0cmluZywge1xuICAgICAgICAgICAgdW5pdDogJ2RhdGUnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoZGF0ZSwgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICB2YXIgeWVhciA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKTtcbiAgICAgIHZhciBpc0xlYXBZZWFyID0gaXNMZWFwWWVhckluZGV4KHllYXIpO1xuICAgICAgdmFyIG1vbnRoID0gZGF0ZS5nZXRVVENNb250aCgpO1xuXG4gICAgICBpZiAoaXNMZWFwWWVhcikge1xuICAgICAgICByZXR1cm4gdmFsdWUgPj0gMSAmJiB2YWx1ZSA8PSBEQVlTX0lOX01PTlRIX0xFQVBfWUVBUlttb250aF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsdWUgPj0gMSAmJiB2YWx1ZSA8PSBEQVlTX0lOX01PTlRIW21vbnRoXTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICBkYXRlLnNldFVUQ0RhdGUodmFsdWUpO1xuICAgICAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ1knLCAnUicsICdxJywgJ1EnLCAndycsICdJJywgJ0QnLCAnaScsICdlJywgJ2MnLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gRGF5IG9mIHllYXJcbiAgRDoge1xuICAgIHByaW9yaXR5OiA5MCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBfb3B0aW9ucykge1xuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgY2FzZSAnREQnOlxuICAgICAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy5kYXlPZlllYXIsIHN0cmluZyk7XG5cbiAgICAgICAgY2FzZSAnRG8nOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5vcmRpbmFsTnVtYmVyKHN0cmluZywge1xuICAgICAgICAgICAgdW5pdDogJ2RhdGUnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoZGF0ZSwgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICB2YXIgeWVhciA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKTtcbiAgICAgIHZhciBpc0xlYXBZZWFyID0gaXNMZWFwWWVhckluZGV4KHllYXIpO1xuXG4gICAgICBpZiAoaXNMZWFwWWVhcikge1xuICAgICAgICByZXR1cm4gdmFsdWUgPj0gMSAmJiB2YWx1ZSA8PSAzNjY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsdWUgPj0gMSAmJiB2YWx1ZSA8PSAzNjU7XG4gICAgICB9XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgZGF0ZS5zZXRVVENNb250aCgwLCB2YWx1ZSk7XG4gICAgICBkYXRlLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6IFsnWScsICdSJywgJ3EnLCAnUScsICdNJywgJ0wnLCAndycsICdJJywgJ2QnLCAnRScsICdpJywgJ2UnLCAnYycsICd0JywgJ1QnXVxuICB9LFxuICAvLyBEYXkgb2Ygd2Vla1xuICBFOiB7XG4gICAgcHJpb3JpdHk6IDkwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIC8vIFR1ZVxuICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgY2FzZSAnRUUnOlxuICAgICAgICBjYXNlICdFRUUnOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnc2hvcnQnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIFRcblxuICAgICAgICBjYXNlICdFRUVFRSc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyBUdVxuXG4gICAgICAgIGNhc2UgJ0VFRUVFRSc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnc2hvcnQnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIFR1ZXNkYXlcblxuICAgICAgICBjYXNlICdFRUVFJzpcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdzaG9ydCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoX2RhdGUsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHZhbHVlID49IDAgJiYgdmFsdWUgPD0gNjtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIF9mbGFncywgdmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgIGRhdGUgPSBzZXRVVENEYXkoZGF0ZSwgdmFsdWUsIG9wdGlvbnMpO1xuICAgICAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ0QnLCAnaScsICdlJywgJ2MnLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gTG9jYWwgZGF5IG9mIHdlZWtcbiAgZToge1xuICAgIHByaW9yaXR5OiA5MCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBvcHRpb25zKSB7XG4gICAgICB2YXIgdmFsdWVDYWxsYmFjayA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgd2hvbGVXZWVrRGF5cyA9IE1hdGguZmxvb3IoKHZhbHVlIC0gMSkgLyA3KSAqIDc7XG4gICAgICAgIHJldHVybiAodmFsdWUgKyBvcHRpb25zLndlZWtTdGFydHNPbiArIDYpICUgNyArIHdob2xlV2Vla0RheXM7XG4gICAgICB9O1xuXG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIC8vIDNcbiAgICAgICAgY2FzZSAnZSc6XG4gICAgICAgIGNhc2UgJ2VlJzpcbiAgICAgICAgICAvLyAwM1xuICAgICAgICAgIHJldHVybiBwYXJzZU5EaWdpdHModG9rZW4ubGVuZ3RoLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuICAgICAgICAvLyAzcmRcblxuICAgICAgICBjYXNlICdlbyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm9yZGluYWxOdW1iZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB1bml0OiAnZGF5JyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gVHVlXG5cbiAgICAgICAgY2FzZSAnZWVlJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3Nob3J0JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyBUXG5cbiAgICAgICAgY2FzZSAnZWVlZWUnOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gVHVcblxuICAgICAgICBjYXNlICdlZWVlZWUnOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3Nob3J0JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyBUdWVzZGF5XG5cbiAgICAgICAgY2FzZSAnZWVlZSc6XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnd2lkZScsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnc2hvcnQnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAwICYmIHZhbHVlIDw9IDY7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBvcHRpb25zKSB7XG4gICAgICBkYXRlID0gc2V0VVRDRGF5KGRhdGUsIHZhbHVlLCBvcHRpb25zKTtcbiAgICAgIGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWyd5JywgJ1InLCAndScsICdxJywgJ1EnLCAnTScsICdMJywgJ0knLCAnZCcsICdEJywgJ0UnLCAnaScsICdjJywgJ3QnLCAnVCddXG4gIH0sXG4gIC8vIFN0YW5kLWFsb25lIGxvY2FsIGRheSBvZiB3ZWVrXG4gIGM6IHtcbiAgICBwcmlvcml0eTogOTAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgb3B0aW9ucykge1xuICAgICAgdmFyIHZhbHVlQ2FsbGJhY2sgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdmFyIHdob2xlV2Vla0RheXMgPSBNYXRoLmZsb29yKCh2YWx1ZSAtIDEpIC8gNykgKiA3O1xuICAgICAgICByZXR1cm4gKHZhbHVlICsgb3B0aW9ucy53ZWVrU3RhcnRzT24gKyA2KSAlIDcgKyB3aG9sZVdlZWtEYXlzO1xuICAgICAgfTtcblxuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICAvLyAzXG4gICAgICAgIGNhc2UgJ2MnOlxuICAgICAgICBjYXNlICdjYyc6XG4gICAgICAgICAgLy8gMDNcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nLCB2YWx1ZUNhbGxiYWNrKTtcbiAgICAgICAgLy8gM3JkXG5cbiAgICAgICAgY2FzZSAnY28nOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5vcmRpbmFsTnVtYmVyKHN0cmluZywge1xuICAgICAgICAgICAgdW5pdDogJ2RheScsXG4gICAgICAgICAgICB2YWx1ZUNhbGxiYWNrOiB2YWx1ZUNhbGxiYWNrXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIFR1ZVxuXG4gICAgICAgIGNhc2UgJ2NjYyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdzaG9ydCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gVFxuXG4gICAgICAgIGNhc2UgJ2NjY2NjJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIFR1XG5cbiAgICAgICAgY2FzZSAnY2NjY2NjJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdzaG9ydCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gVHVlc2RheVxuXG4gICAgICAgIGNhc2UgJ2NjY2MnOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3dpZGUnLFxuICAgICAgICAgICAgY29udGV4dDogJ3N0YW5kYWxvbmUnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnc3RhbmRhbG9uZSdcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3Nob3J0JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdzdGFuZGFsb25lJ1xuICAgICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChfZGF0ZSwgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICByZXR1cm4gdmFsdWUgPj0gMCAmJiB2YWx1ZSA8PSA2O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgb3B0aW9ucykge1xuICAgICAgZGF0ZSA9IHNldFVUQ0RheShkYXRlLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICBkYXRlLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6IFsneScsICdSJywgJ3UnLCAncScsICdRJywgJ00nLCAnTCcsICdJJywgJ2QnLCAnRCcsICdFJywgJ2knLCAnZScsICd0JywgJ1QnXVxuICB9LFxuICAvLyBJU08gZGF5IG9mIHdlZWtcbiAgaToge1xuICAgIHByaW9yaXR5OiA5MCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBfb3B0aW9ucykge1xuICAgICAgdmFyIHZhbHVlQ2FsbGJhY2sgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIDc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9O1xuXG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIC8vIDJcbiAgICAgICAgY2FzZSAnaSc6XG4gICAgICAgIGNhc2UgJ2lpJzpcbiAgICAgICAgICAvLyAwMlxuICAgICAgICAgIHJldHVybiBwYXJzZU5EaWdpdHModG9rZW4ubGVuZ3RoLCBzdHJpbmcpO1xuICAgICAgICAvLyAybmRcblxuICAgICAgICBjYXNlICdpbyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm9yZGluYWxOdW1iZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB1bml0OiAnZGF5J1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyBUdWVcblxuICAgICAgICBjYXNlICdpaWknOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3Nob3J0JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZycsXG4gICAgICAgICAgICB2YWx1ZUNhbGxiYWNrOiB2YWx1ZUNhbGxiYWNrXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIFRcblxuICAgICAgICBjYXNlICdpaWlpaSc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheShzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KTtcbiAgICAgICAgLy8gVHVcblxuICAgICAgICBjYXNlICdpaWlpaWknOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3Nob3J0JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZycsXG4gICAgICAgICAgICB2YWx1ZUNhbGxiYWNrOiB2YWx1ZUNhbGxiYWNrXG4gICAgICAgICAgfSk7XG4gICAgICAgIC8vIFR1ZXNkYXlcblxuICAgICAgICBjYXNlICdpaWlpJzpcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5KHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3Nob3J0JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJyxcbiAgICAgICAgICAgIHZhbHVlQ2FsbGJhY2s6IHZhbHVlQ2FsbGJhY2tcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXkoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZycsXG4gICAgICAgICAgICB2YWx1ZUNhbGxiYWNrOiB2YWx1ZUNhbGxiYWNrXG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAxICYmIHZhbHVlIDw9IDc7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBvcHRpb25zKSB7XG4gICAgICBkYXRlID0gc2V0VVRDSVNPRGF5KGRhdGUsIHZhbHVlLCBvcHRpb25zKTtcbiAgICAgIGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWyd5JywgJ1knLCAndScsICdxJywgJ1EnLCAnTScsICdMJywgJ3cnLCAnZCcsICdEJywgJ0UnLCAnZScsICdjJywgJ3QnLCAnVCddXG4gIH0sXG4gIC8vIEFNIG9yIFBNXG4gIGE6IHtcbiAgICBwcmlvcml0eTogODAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgY2FzZSAnYSc6XG4gICAgICAgIGNhc2UgJ2FhJzpcbiAgICAgICAgY2FzZSAnYWFhJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5UGVyaW9kKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXlQZXJpb2Qoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KTtcblxuICAgICAgICBjYXNlICdhYWFhYSc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheVBlcmlvZChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGNhc2UgJ2FhYWEnOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXlQZXJpb2Qoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ3dpZGUnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5UGVyaW9kKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICdhYmJyZXZpYXRlZCcsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXlQZXJpb2Qoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICBkYXRlLnNldFVUQ0hvdXJzKGRheVBlcmlvZEVudW1Ub0hvdXJzKHZhbHVlKSwgMCwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWydiJywgJ0InLCAnSCcsICdLJywgJ2snLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gQU0sIFBNLCBtaWRuaWdodFxuICBiOiB7XG4gICAgcHJpb3JpdHk6IDgwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIGNhc2UgJ2InOlxuICAgICAgICBjYXNlICdiYic6XG4gICAgICAgIGNhc2UgJ2JiYic6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheVBlcmlvZChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5UGVyaW9kKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgY2FzZSAnYmJiYmInOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXlQZXJpb2Qoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ25hcnJvdycsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KTtcblxuICAgICAgICBjYXNlICdiYmJiJzpcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5UGVyaW9kKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICd3aWRlJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheVBlcmlvZChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnYWJicmV2aWF0ZWQnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSkgfHwgbWF0Y2guZGF5UGVyaW9kKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgZGF0ZS5zZXRVVENIb3VycyhkYXlQZXJpb2RFbnVtVG9Ib3Vycyh2YWx1ZSksIDAsIDAsIDApO1xuICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6IFsnYScsICdCJywgJ0gnLCAnSycsICdrJywgJ3QnLCAnVCddXG4gIH0sXG4gIC8vIGluIHRoZSBtb3JuaW5nLCBpbiB0aGUgYWZ0ZXJub29uLCBpbiB0aGUgZXZlbmluZywgYXQgbmlnaHRcbiAgQjoge1xuICAgIHByaW9yaXR5OiA4MCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBfb3B0aW9ucykge1xuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICBjYXNlICdCJzpcbiAgICAgICAgY2FzZSAnQkInOlxuICAgICAgICBjYXNlICdCQkInOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5kYXlQZXJpb2Qoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheVBlcmlvZChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGNhc2UgJ0JCQkJCJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2guZGF5UGVyaW9kKHN0cmluZywge1xuICAgICAgICAgICAgd2lkdGg6ICduYXJyb3cnLFxuICAgICAgICAgICAgY29udGV4dDogJ2Zvcm1hdHRpbmcnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgY2FzZSAnQkJCQic6XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLmRheVBlcmlvZChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnd2lkZScsXG4gICAgICAgICAgICBjb250ZXh0OiAnZm9ybWF0dGluZydcbiAgICAgICAgICB9KSB8fCBtYXRjaC5kYXlQZXJpb2Qoc3RyaW5nLCB7XG4gICAgICAgICAgICB3aWR0aDogJ2FiYnJldmlhdGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pIHx8IG1hdGNoLmRheVBlcmlvZChzdHJpbmcsIHtcbiAgICAgICAgICAgIHdpZHRoOiAnbmFycm93JyxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdmb3JtYXR0aW5nJ1xuICAgICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIGRhdGUuc2V0VVRDSG91cnMoZGF5UGVyaW9kRW51bVRvSG91cnModmFsdWUpLCAwLCAwLCAwKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ2EnLCAnYicsICd0JywgJ1QnXVxuICB9LFxuICAvLyBIb3VyIFsxLTEyXVxuICBoOiB7XG4gICAgcHJpb3JpdHk6IDcwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIGNhc2UgJ2gnOlxuICAgICAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy5ob3VyMTJoLCBzdHJpbmcpO1xuXG4gICAgICAgIGNhc2UgJ2hvJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gub3JkaW5hbE51bWJlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHVuaXQ6ICdob3VyJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTkRpZ2l0cyh0b2tlbi5sZW5ndGgsIHN0cmluZyk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAxICYmIHZhbHVlIDw9IDEyO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHZhciBpc1BNID0gZGF0ZS5nZXRVVENIb3VycygpID49IDEyO1xuXG4gICAgICBpZiAoaXNQTSAmJiB2YWx1ZSA8IDEyKSB7XG4gICAgICAgIGRhdGUuc2V0VVRDSG91cnModmFsdWUgKyAxMiwgMCwgMCwgMCk7XG4gICAgICB9IGVsc2UgaWYgKCFpc1BNICYmIHZhbHVlID09PSAxMikge1xuICAgICAgICBkYXRlLnNldFVUQ0hvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGF0ZS5zZXRVVENIb3Vycyh2YWx1ZSwgMCwgMCwgMCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ0gnLCAnSycsICdrJywgJ3QnLCAnVCddXG4gIH0sXG4gIC8vIEhvdXIgWzAtMjNdXG4gIEg6IHtcbiAgICBwcmlvcml0eTogNzAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgY2FzZSAnSCc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTnVtZXJpY1BhdHRlcm4obnVtZXJpY1BhdHRlcm5zLmhvdXIyM2gsIHN0cmluZyk7XG5cbiAgICAgICAgY2FzZSAnSG8nOlxuICAgICAgICAgIHJldHVybiBtYXRjaC5vcmRpbmFsTnVtYmVyKHN0cmluZywge1xuICAgICAgICAgICAgdW5pdDogJ2hvdXInXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoX2RhdGUsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHZhbHVlID49IDAgJiYgdmFsdWUgPD0gMjM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgZGF0ZS5zZXRVVENIb3Vycyh2YWx1ZSwgMCwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWydhJywgJ2InLCAnaCcsICdLJywgJ2snLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gSG91ciBbMC0xMV1cbiAgSzoge1xuICAgIHByaW9yaXR5OiA3MCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBfb3B0aW9ucykge1xuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICBjYXNlICdLJzpcbiAgICAgICAgICByZXR1cm4gcGFyc2VOdW1lcmljUGF0dGVybihudW1lcmljUGF0dGVybnMuaG91cjExaCwgc3RyaW5nKTtcblxuICAgICAgICBjYXNlICdLbyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm9yZGluYWxOdW1iZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB1bml0OiAnaG91cidcbiAgICAgICAgICB9KTtcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBwYXJzZU5EaWdpdHModG9rZW4ubGVuZ3RoLCBzdHJpbmcpO1xuICAgICAgfVxuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChfZGF0ZSwgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICByZXR1cm4gdmFsdWUgPj0gMCAmJiB2YWx1ZSA8PSAxMTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKGRhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICB2YXIgaXNQTSA9IGRhdGUuZ2V0VVRDSG91cnMoKSA+PSAxMjtcblxuICAgICAgaWYgKGlzUE0gJiYgdmFsdWUgPCAxMikge1xuICAgICAgICBkYXRlLnNldFVUQ0hvdXJzKHZhbHVlICsgMTIsIDAsIDAsIDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGF0ZS5zZXRVVENIb3Vycyh2YWx1ZSwgMCwgMCwgMCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ2EnLCAnYicsICdoJywgJ0gnLCAnaycsICd0JywgJ1QnXVxuICB9LFxuICAvLyBIb3VyIFsxLTI0XVxuICBrOiB7XG4gICAgcHJpb3JpdHk6IDcwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgbWF0Y2gsIF9vcHRpb25zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgIGNhc2UgJ2snOlxuICAgICAgICAgIHJldHVybiBwYXJzZU51bWVyaWNQYXR0ZXJuKG51bWVyaWNQYXR0ZXJucy5ob3VyMjRoLCBzdHJpbmcpO1xuXG4gICAgICAgIGNhc2UgJ2tvJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gub3JkaW5hbE51bWJlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHVuaXQ6ICdob3VyJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTkRpZ2l0cyh0b2tlbi5sZW5ndGgsIHN0cmluZyk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAxICYmIHZhbHVlIDw9IDI0O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHZhciBob3VycyA9IHZhbHVlIDw9IDI0ID8gdmFsdWUgJSAyNCA6IHZhbHVlO1xuICAgICAgZGF0ZS5zZXRVVENIb3Vycyhob3VycywgMCwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWydhJywgJ2InLCAnaCcsICdIJywgJ0snLCAndCcsICdUJ11cbiAgfSxcbiAgLy8gTWludXRlXG4gIG06IHtcbiAgICBwcmlvcml0eTogNjAsXG4gICAgcGFyc2U6IGZ1bmN0aW9uIChzdHJpbmcsIHRva2VuLCBtYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgY2FzZSAnbSc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTnVtZXJpY1BhdHRlcm4obnVtZXJpY1BhdHRlcm5zLm1pbnV0ZSwgc3RyaW5nKTtcblxuICAgICAgICBjYXNlICdtbyc6XG4gICAgICAgICAgcmV0dXJuIG1hdGNoLm9yZGluYWxOdW1iZXIoc3RyaW5nLCB7XG4gICAgICAgICAgICB1bml0OiAnbWludXRlJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlTkRpZ2l0cyh0b2tlbi5sZW5ndGgsIHN0cmluZyk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKF9kYXRlLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA+PSAwICYmIHZhbHVlIDw9IDU5O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIGRhdGUuc2V0VVRDTWludXRlcyh2YWx1ZSwgMCwgMCk7XG4gICAgICByZXR1cm4gZGF0ZTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWyd0JywgJ1QnXVxuICB9LFxuICAvLyBTZWNvbmRcbiAgczoge1xuICAgIHByaW9yaXR5OiA1MCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIG1hdGNoLCBfb3B0aW9ucykge1xuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICBjYXNlICdzJzpcbiAgICAgICAgICByZXR1cm4gcGFyc2VOdW1lcmljUGF0dGVybihudW1lcmljUGF0dGVybnMuc2Vjb25kLCBzdHJpbmcpO1xuXG4gICAgICAgIGNhc2UgJ3NvJzpcbiAgICAgICAgICByZXR1cm4gbWF0Y2gub3JkaW5hbE51bWJlcihzdHJpbmcsIHtcbiAgICAgICAgICAgIHVuaXQ6ICdzZWNvbmQnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gcGFyc2VORGlnaXRzKHRva2VuLmxlbmd0aCwgc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoX2RhdGUsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHZhbHVlID49IDAgJiYgdmFsdWUgPD0gNTk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBfZmxhZ3MsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgZGF0ZS5zZXRVVENTZWNvbmRzKHZhbHVlLCAwKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ3QnLCAnVCddXG4gIH0sXG4gIC8vIEZyYWN0aW9uIG9mIHNlY29uZFxuICBTOiB7XG4gICAgcHJpb3JpdHk6IDMwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgX21hdGNoLCBfb3B0aW9ucykge1xuICAgICAgdmFyIHZhbHVlQ2FsbGJhY2sgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IodmFsdWUgKiBNYXRoLnBvdygxMCwgLXRva2VuLmxlbmd0aCArIDMpKTtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBwYXJzZU5EaWdpdHModG9rZW4ubGVuZ3RoLCBzdHJpbmcsIHZhbHVlQ2FsbGJhY2spO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgX2ZsYWdzLCB2YWx1ZSwgX29wdGlvbnMpIHtcbiAgICAgIGRhdGUuc2V0VVRDTWlsbGlzZWNvbmRzKHZhbHVlKTtcbiAgICAgIHJldHVybiBkYXRlO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiBbJ3QnLCAnVCddXG4gIH0sXG4gIC8vIFRpbWV6b25lIChJU08tODYwMS4gKzAwOjAwIGlzIGAnWidgKVxuICBYOiB7XG4gICAgcHJpb3JpdHk6IDEwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCB0b2tlbiwgX21hdGNoLCBfb3B0aW9ucykge1xuICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICBjYXNlICdYJzpcbiAgICAgICAgICByZXR1cm4gcGFyc2VUaW1lem9uZVBhdHRlcm4odGltZXpvbmVQYXR0ZXJucy5iYXNpY09wdGlvbmFsTWludXRlcywgc3RyaW5nKTtcblxuICAgICAgICBjYXNlICdYWCc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlVGltZXpvbmVQYXR0ZXJuKHRpbWV6b25lUGF0dGVybnMuYmFzaWMsIHN0cmluZyk7XG5cbiAgICAgICAgY2FzZSAnWFhYWCc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlVGltZXpvbmVQYXR0ZXJuKHRpbWV6b25lUGF0dGVybnMuYmFzaWNPcHRpb25hbFNlY29uZHMsIHN0cmluZyk7XG5cbiAgICAgICAgY2FzZSAnWFhYWFgnOlxuICAgICAgICAgIHJldHVybiBwYXJzZVRpbWV6b25lUGF0dGVybih0aW1lem9uZVBhdHRlcm5zLmV4dGVuZGVkT3B0aW9uYWxTZWNvbmRzLCBzdHJpbmcpO1xuXG4gICAgICAgIGNhc2UgJ1hYWCc6XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlVGltZXpvbmVQYXR0ZXJuKHRpbWV6b25lUGF0dGVybnMuZXh0ZW5kZWQsIHN0cmluZyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChkYXRlLCBmbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICBpZiAoZmxhZ3MudGltZXN0YW1wSXNTZXQpIHtcbiAgICAgICAgcmV0dXJuIGRhdGU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgRGF0ZShkYXRlLmdldFRpbWUoKSAtIHZhbHVlKTtcbiAgICB9LFxuICAgIGluY29tcGF0aWJsZVRva2VuczogWyd0JywgJ1QnLCAneCddXG4gIH0sXG4gIC8vIFRpbWV6b25lIChJU08tODYwMSlcbiAgeDoge1xuICAgIHByaW9yaXR5OiAxMCxcbiAgICBwYXJzZTogZnVuY3Rpb24gKHN0cmluZywgdG9rZW4sIF9tYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4pIHtcbiAgICAgICAgY2FzZSAneCc6XG4gICAgICAgICAgcmV0dXJuIHBhcnNlVGltZXpvbmVQYXR0ZXJuKHRpbWV6b25lUGF0dGVybnMuYmFzaWNPcHRpb25hbE1pbnV0ZXMsIHN0cmluZyk7XG5cbiAgICAgICAgY2FzZSAneHgnOlxuICAgICAgICAgIHJldHVybiBwYXJzZVRpbWV6b25lUGF0dGVybih0aW1lem9uZVBhdHRlcm5zLmJhc2ljLCBzdHJpbmcpO1xuXG4gICAgICAgIGNhc2UgJ3h4eHgnOlxuICAgICAgICAgIHJldHVybiBwYXJzZVRpbWV6b25lUGF0dGVybih0aW1lem9uZVBhdHRlcm5zLmJhc2ljT3B0aW9uYWxTZWNvbmRzLCBzdHJpbmcpO1xuXG4gICAgICAgIGNhc2UgJ3h4eHh4JzpcbiAgICAgICAgICByZXR1cm4gcGFyc2VUaW1lem9uZVBhdHRlcm4odGltZXpvbmVQYXR0ZXJucy5leHRlbmRlZE9wdGlvbmFsU2Vjb25kcywgc3RyaW5nKTtcblxuICAgICAgICBjYXNlICd4eHgnOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBwYXJzZVRpbWV6b25lUGF0dGVybih0aW1lem9uZVBhdHRlcm5zLmV4dGVuZGVkLCBzdHJpbmcpO1xuICAgICAgfVxuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZGF0ZSwgZmxhZ3MsIHZhbHVlLCBfb3B0aW9ucykge1xuICAgICAgaWYgKGZsYWdzLnRpbWVzdGFtcElzU2V0KSB7XG4gICAgICAgIHJldHVybiBkYXRlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmV3IERhdGUoZGF0ZS5nZXRUaW1lKCkgLSB2YWx1ZSk7XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6IFsndCcsICdUJywgJ1gnXVxuICB9LFxuICAvLyBTZWNvbmRzIHRpbWVzdGFtcFxuICB0OiB7XG4gICAgcHJpb3JpdHk6IDQwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCBfdG9rZW4sIF9tYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiBwYXJzZUFueURpZ2l0c1NpZ25lZChzdHJpbmcpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoX2RhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICByZXR1cm4gW25ldyBEYXRlKHZhbHVlICogMTAwMCksIHtcbiAgICAgICAgdGltZXN0YW1wSXNTZXQ6IHRydWVcbiAgICAgIH1dO1xuICAgIH0sXG4gICAgaW5jb21wYXRpYmxlVG9rZW5zOiAnKidcbiAgfSxcbiAgLy8gTWlsbGlzZWNvbmRzIHRpbWVzdGFtcFxuICBUOiB7XG4gICAgcHJpb3JpdHk6IDIwLFxuICAgIHBhcnNlOiBmdW5jdGlvbiAoc3RyaW5nLCBfdG9rZW4sIF9tYXRjaCwgX29wdGlvbnMpIHtcbiAgICAgIHJldHVybiBwYXJzZUFueURpZ2l0c1NpZ25lZChzdHJpbmcpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoX2RhdGUsIF9mbGFncywgdmFsdWUsIF9vcHRpb25zKSB7XG4gICAgICByZXR1cm4gW25ldyBEYXRlKHZhbHVlKSwge1xuICAgICAgICB0aW1lc3RhbXBJc1NldDogdHJ1ZVxuICAgICAgfV07XG4gICAgfSxcbiAgICBpbmNvbXBhdGlibGVUb2tlbnM6ICcqJ1xuICB9XG59O1xuZXhwb3J0IGRlZmF1bHQgcGFyc2VyczsiLCIvLyBpbXBvcnQgKiBhcyBkYXRlZm5zIGZyb20gJ2RhdGUtZm5zJztcclxuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAnZGF0ZS1mbnMvZXNtJztcclxuXHJcbmZ1bmN0aW9uIHRyYW5zZm9ybVBob25lTnVtYmVyKHZhbHVlKSB7XHJcbiAgdmFyIHMyID0gKFwiXCIrdmFsdWUpLnJlcGxhY2UoL1xcRC9nLCAnJyk7XHJcbiAgdmFyIG0gPSBzMi5tYXRjaCgvXihcXGR7M30pKFxcZHszfSkoXFxkezR9KSQvKTtcclxuICByZXR1cm4gKCFtKSA/IG51bGwgOiBcIihcIiArIG1bMV0gKyBcIikgXCIgKyBtWzJdICsgXCItXCIgKyBtWzNdO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cmFuc2Zvcm1EYXRlKHZhbHVlKSB7XHJcbiAgLy8gY29uc29sZS5sb2coJ2RhdGUgdmFsdWU6JywgdmFsdWUpO1xyXG4gIHJldHVybiBmb3JtYXQodmFsdWUsICdNTS9kZC95eXl5Jyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRyYW5zZm9ybURhdGVUaW1lKHZhbHVlKSB7XHJcbiAgLy8gY29uc29sZS5sb2coJ2RhdGV0aW1lIHZhbHVlOicsIHZhbHVlKTtcclxuICByZXR1cm4gZm9ybWF0KHZhbHVlLCAnTU0vZGQveXl5eSBoaDptbSBhJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRyYW5zZm9ybURlY2ltYWxQbGFjZSh2YWx1ZSkge1xyXG4gIHZhciBudW1iZXIgPSBTdHJpbmcodmFsdWUpLm1hdGNoKC9cXGQrLylbMF0ucmVwbGFjZSgvKC4pKD89KFxcZHszfSkrJCkvZywnJDEsJyk7XHJcbiAgdmFyIGxhYmVsID0gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC9bMC05XS9nLCAnJykgfHwgJyc7XHJcbiAgcmV0dXJuIG51bWJlciArICcgJyArIGxhYmVsO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBvcHVwQ29udGVudCAocG9wdXBJbmZvLCBwcm9wZXJ0aWVzKSB7XHJcbiAgLy8gY29uc29sZS5sb2coJ3BvcHVwSW5mbzonLCBwb3B1cEluZm8pO1xyXG4gIC8vIGNvbnNvbGUubG9nKCdwb3B1cCBwcm9wZXJ0aWVzOicsIHByb3BlcnRpZXMpO1xyXG4gIHZhciByID0gL1xceyhbXlxcXV0qKVxcfS9nO1xyXG4gIHZhciB0aXRsZVRleHQgPSAnJztcclxuICB2YXIgY29udGVudCA9ICcnO1xyXG5cclxuICBpZiAocG9wdXBJbmZvLnRpdGxlICE9PSB1bmRlZmluZWQpIHtcclxuICAgIHRpdGxlVGV4dCA9IHBvcHVwSW5mby50aXRsZTtcclxuICB9XHJcblxyXG4gIHRpdGxlVGV4dCA9IHRpdGxlVGV4dC5yZXBsYWNlKHIsIGZ1bmN0aW9uIChzKSB7XHJcbiAgICB2YXIgbSA9IHIuZXhlYyhzKTtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdyOicsIHIsICdtOicsIG0pO1xyXG4gICAgdmFyIHZhbCA9IHByb3BlcnRpZXNbbVsxXV07XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvcHVwSW5mby5maWVsZEluZm9zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09IG1bMV0pIHtcclxuICAgICAgICBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZm9ybWF0KSB7XHJcbiAgICAgICAgICBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZm9ybWF0LmRhdGVGb3JtYXQgPT09ICdzaG9ydERhdGUnXHJcbiAgICAgICAgICAgICAgfHwgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZm9ybWF0LmRhdGVGb3JtYXQgPT09ICdzaG9ydERhdGVTaG9ydFRpbWUnXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgdmFsID0gdHJhbnNmb3JtRGF0ZShwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV0pXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsO1xyXG4gIH0pO1xyXG5cclxuICBjb250ZW50ID0gJzxkaXYgY2xhc3M9XCJsZWFmbGV0LXBvcHVwLWNvbnRlbnQtdGl0bGUgdGV4dC1jZW50ZXJcIj48aDQ+JyArIHRpdGxlVGV4dCArICc8L2g0PjwvZGl2PjxkaXYgY2xhc3M9XCJsZWFmbGV0LXBvcHVwLWNvbnRlbnQtZGVzY3JpcHRpb25cIiBzdHlsZT1cIm1heC1oZWlnaHQ6MjAwcHg7b3ZlcmZsb3c6YXV0bztcIj4nO1xyXG5cclxuICB2YXIgY29udGVudFN0YXJ0ID0gJzxkaXYgc3R5bGU9XCJmb250LXdlaWdodDpib2xkO2NvbG9yOiM5OTk7bWFyZ2luLXRvcDo1cHg7d29yZC1icmVhazpicmVhay1hbGw7XCI+J1xyXG4gIHZhciBjb250ZW50TWlkZGxlID0gJzwvZGl2PjxwIHN0eWxlPVwibWFyZ2luLXRvcDowO21hcmdpbi1ib3R0b206NXB4O3dvcmQtYnJlYWs6YnJlYWstYWxsO1wiPidcclxuICB2YXIgYVRhZ1N0YXJ0ID0gJzxhIHRhcmdldD1cIl9ibGFua1wiIGhyZWY9XCInXHJcbiAgdmFyIGVtYWlsVGFnU3RhcnQgPSAnPGEgaHJlZj1cIm1haWx0bzonXHJcblxyXG4gIGlmIChwb3B1cEluZm8uZmllbGRJbmZvcyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvcHVwSW5mby5maWVsZEluZm9zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS52aXNpYmxlID09PSB0cnVlKSB7XHJcbiAgICAgICAgaWYgKHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgY29udGVudCArPSBjb250ZW50U3RhcnRcclxuICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICArIGNvbnRlbnRNaWRkbGVcclxuICAgICAgICAgICAgICAgICAgLy8gKyBhVGFnU3RhcnRcclxuICAgICAgICAgICAgICAgICAgLy8gKyBwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV1cclxuICAgICAgICAgICAgICAgICAgKyAnbm9uZSdcclxuICAgICAgICAgICAgICAgICAgLy8gKyAnXCI+J1xyXG4gICAgICAgICAgICAgICAgICAvLyArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICArICc8L3A+JztcclxuICAgICAgICAvLyBpZiB0aGUgaW5mbyBpcyBhIFVSTFxyXG4gICAgICAgIH0gZWxzZSBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lID09PSAnVVJMJyB8fFxyXG4gICAgICAgICAgICBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09ICdDT0RFX1NFQ18xJyB8fFxyXG4gICAgICAgICAgICBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09ICdXRUJTSVRFJyB8fFxyXG4gICAgICAgICAgICBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09ICdGSU5BTF9MSU5LX0NPUFknIHx8XHJcbiAgICAgICAgICAgIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZSA9PT0gJ0xJTksnIHx8XHJcbiAgICAgICAgICAgIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZSA9PT0gJ1Blcm1pdCBMaW5rJyB8fFxyXG4gICAgICAgICAgICBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUgPT09ICdQZXJtaXRVUkwnIHx8XHJcbiAgICAgICAgICAgIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd1cmwnKSB8fFxyXG4gICAgICAgICAgICBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbGluaycpIHx8XHJcbiAgICAgICAgICAgIC8vIHpvbmluZyBvdmVybGF5czpcclxuICAgICAgICAgICAgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lID09PSAnQ09ERV9TRUNUSU9OX0xJTksnXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICBjb250ZW50ICs9IGNvbnRlbnRTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICArIGFUYWdTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICArICdcIj4nXHJcbiAgICAgICAgICAgICAgICAgICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdXHJcbiAgICAgICAgICAgICAgICAgICsgJzwvYT48L3A+JztcclxuICAgICAgICAvLyBpZiB0aGUgaW5mbyBpcyBhbiBlbWFpbCBhZGRyZXNzXHJcbiAgICAgICAgfSBlbHNlIGlmIChwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWUuaW5jbHVkZXMoJ0VNQUlMJykpIHtcclxuICAgICAgICAgIGNvbnRlbnQgKz0gY29udGVudFN0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWxcclxuICAgICAgICAgICAgICAgICAgKyBjb250ZW50TWlkZGxlXHJcbiAgICAgICAgICAgICAgICAgICsgZW1haWxUYWdTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICArICdcIj4nXHJcbiAgICAgICAgICAgICAgICAgICsgcHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdXHJcbiAgICAgICAgICAgICAgICAgICsgJzwvYT48L3A+JztcclxuICAgICAgICAvLyBpZiB0aGUgaW5mbyBpcyBhIHBob25lIG51bWJlclxyXG4gICAgICAgIH0gZWxzZSBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lLmluY2x1ZGVzKCdQSE9ORScpKSB7XHJcbiAgICAgICAgICBjb250ZW50ICs9IGNvbnRlbnRTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICArIHRyYW5zZm9ybVBob25lTnVtYmVyKHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXSlcclxuICAgICAgICAgICAgICAgICAgKyAnPC9wPic7XHJcbiAgICAgICAgLy8gaGFuZGxlIGNhc2VcclxuICAgICAgICB9IGVsc2UgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZS5pbmNsdWRlcygndGltZScpKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdpbmNsdWRlcyB0aW1lJyk7XHJcbiAgICAgICAgICAgIGNvbnRlbnQgKz0gY29udGVudFN0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICAgICsgdHJhbnNmb3JtRGF0ZVRpbWUocHJvcGVydGllc1twb3B1cEluZm8uZmllbGRJbmZvc1tpXS5maWVsZE5hbWVdKVxyXG4gICAgICAgICAgICAgICAgICAgICsgJzwvcD4nO1xyXG4gICAgICAgIC8vIGlmIHRoZSBpbmZvIGlzIGEgZGF0ZVxyXG4gICAgICAgIH0gZWxzZSBpZiAocG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lLmluY2x1ZGVzKCdEQVRFJykpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2luY2x1ZGVzIGRhdGUnKTtcclxuICAgICAgICAgICAgY29udGVudCArPSBjb250ZW50U3RhcnRcclxuICAgICAgICAgICAgICAgICAgICArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICAgKyBjb250ZW50TWlkZGxlXHJcbiAgICAgICAgICAgICAgICAgICAgKyB0cmFuc2Zvcm1EYXRlKHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXSlcclxuICAgICAgICAgICAgICAgICAgICArICc8L3A+JztcclxuICAgICAgICB9IGVsc2UgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZvcm1hdCkge1xyXG4gICAgICAgICAgaWYgKHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZvcm1hdC5kYXRlRm9ybWF0ID09PSAnc2hvcnREYXRlJ1xyXG4gICAgICAgICAgICAgIHx8IHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmZvcm1hdC5kYXRlRm9ybWF0ID09PSAnc2hvcnREYXRlU2hvcnRUaW1lJ1xyXG4gICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdpcyBzaG9ydERhdGUgb3Igc2hvcnREYXRlU2hvcnRUaW1lJyk7XHJcbiAgICAgICAgICAgIGNvbnRlbnQgKz0gY29udGVudFN0YXJ0XHJcbiAgICAgICAgICAgICAgICAgICAgKyBwb3B1cEluZm8uZmllbGRJbmZvc1tpXS5sYWJlbFxyXG4gICAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICAgICsgdHJhbnNmb3JtRGF0ZShwcm9wZXJ0aWVzW3BvcHVwSW5mby5maWVsZEluZm9zW2ldLmZpZWxkTmFtZV0pXHJcbiAgICAgICAgICAgICAgICAgICAgKyAnPC9wPic7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb250ZW50ICs9IGNvbnRlbnRTdGFydFxyXG4gICAgICAgICAgICAgICAgICAgICsgcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0ubGFiZWxcclxuICAgICAgICAgICAgICAgICAgICArIGNvbnRlbnRNaWRkbGVcclxuICAgICAgICAgICAgICAgICAgICArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICAgICsgJzwvcD4nO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb250ZW50ICs9IGNvbnRlbnRTdGFydFxyXG4gICAgICAgICAgICAgICAgICArIHBvcHVwSW5mby5maWVsZEluZm9zW2ldLmxhYmVsXHJcbiAgICAgICAgICAgICAgICAgICsgY29udGVudE1pZGRsZVxyXG4gICAgICAgICAgICAgICAgICArIHByb3BlcnRpZXNbcG9wdXBJbmZvLmZpZWxkSW5mb3NbaV0uZmllbGROYW1lXVxyXG4gICAgICAgICAgICAgICAgICArICc8L3A+JztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGNvbnRlbnQgKz0gJzwvZGl2Pic7XHJcblxyXG4gIH0gZWxzZSBpZiAocG9wdXBJbmZvLmRlc2NyaXB0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgIC8vIEtNTExheWVyIHBvcHVwXHJcbiAgICB2YXIgZGVzY3JpcHRpb25UZXh0ID0gcG9wdXBJbmZvLmRlc2NyaXB0aW9uLnJlcGxhY2UociwgZnVuY3Rpb24gKHMpIHtcclxuICAgICAgdmFyIG0gPSByLmV4ZWMocyk7XHJcbiAgICAgIHJldHVybiBwcm9wZXJ0aWVzW21bMV1dO1xyXG4gICAgfSk7XHJcbiAgICBjb250ZW50ICs9IGRlc2NyaXB0aW9uVGV4dCArICc8L2Rpdj4nO1xyXG4gIH1cclxuXHJcbiAgLy8gaWYgKHBvcHVwSW5mby5tZWRpYUluZm9zLmxlbmd0aCA+IDApIHtcclxuICAgIC8vIEl0IGRvZXMgbm90IHN1cHBvcnQgbWVkaWFJbmZvcyBmb3IgcG9wdXAgY29udGVudHMuXHJcbiAgLy8gfVxyXG5cclxuICByZXR1cm4gY29udGVudDtcclxufVxyXG5cclxuZXhwb3J0IHZhciBQb3B1cCA9IHtcclxuICBjcmVhdGVQb3B1cENvbnRlbnQ6IGNyZWF0ZVBvcHVwQ29udGVudFxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUG9wdXA7XHJcbiIsImltcG9ydCBMIGZyb20gJ2xlYWZsZXQnO1xyXG5pbXBvcnQgeyBmZWF0dXJlQ29sbGVjdGlvbiB9IGZyb20gJy4vRmVhdHVyZUNvbGxlY3Rpb24vRmVhdHVyZUNvbGxlY3Rpb24nO1xyXG5pbXBvcnQgeyBjc3ZMYXllciB9IGZyb20gJy4vRmVhdHVyZUNvbGxlY3Rpb24vQ1NWTGF5ZXInO1xyXG5pbXBvcnQgeyBrbWxMYXllciB9IGZyb20gJy4vRmVhdHVyZUNvbGxlY3Rpb24vS01MTGF5ZXInO1xyXG5pbXBvcnQgeyBsYWJlbE1hcmtlciB9IGZyb20gJy4vTGFiZWwvTGFiZWxNYXJrZXInO1xyXG5pbXBvcnQgeyBwb2ludExhYmVsUG9zIH0gZnJvbSAnLi9MYWJlbC9Qb2ludExhYmVsJztcclxuaW1wb3J0IHsgcG9seWxpbmVMYWJlbFBvcyB9IGZyb20gJy4vTGFiZWwvUG9seWxpbmVMYWJlbCc7XHJcbmltcG9ydCB7IHBvbHlnb25MYWJlbFBvcyB9IGZyb20gJy4vTGFiZWwvUG9seWdvbkxhYmVsJztcclxuaW1wb3J0IHsgY3JlYXRlUG9wdXBDb250ZW50IH0gZnJvbSAnLi9Qb3B1cC9Qb3B1cCc7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3BlcmF0aW9uYWxMYXllciAobGF5ZXIsIGxheWVycywgbWFwLCBwYXJhbXMsIHBhbmVOYW1lKSB7XHJcbiAgLy8gY29uc29sZS5sb2coJ29wZXJhdGlvbmFsTGF5ZXIsIGxheWVyOicsIGxheWVyLCAnbGF5ZXJzOicsIGxheWVycywgJ21hcDonLCBtYXAsICdwYXJhbXM6JywgcGFyYW1zLCAncGFuZU5hbWU6JywgcGFuZU5hbWUpO1xyXG4gIHJldHVybiBfZ2VuZXJhdGVFc3JpTGF5ZXIobGF5ZXIsIGxheWVycywgbWFwLCBwYXJhbXMsIHBhbmVOYW1lKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9nZW5lcmF0ZUVzcmlMYXllciAobGF5ZXIsIGxheWVycywgbWFwLCBwYXJhbXMsIHBhbmVOYW1lKSB7XHJcbiAgLy8gY29uc29sZS5sb2coJ2dlbmVyYXRlRXNyaUxheWVyOiAnLCBsYXllci50aXRsZSwgJ3BhbmVOYW1lOicsIHBhbmVOYW1lLCAnbGF5ZXI6JywgbGF5ZXIpO1xyXG4gIHZhciBseXI7XHJcbiAgdmFyIGxhYmVscyA9IFtdO1xyXG4gIHZhciBsYWJlbHNMYXllcjtcclxuICB2YXIgbGFiZWxQYW5lTmFtZSA9IHBhbmVOYW1lICsgJy1sYWJlbCc7XHJcbiAgdmFyIGksIGxlbjtcclxuXHJcbiAgaWYgKGxheWVyLnR5cGUgPT09ICdGZWF0dXJlIENvbGxlY3Rpb24nIHx8IGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGUgRmVhdHVyZUNvbGxlY3Rpb24nKTtcclxuXHJcbiAgICBtYXAuY3JlYXRlUGFuZShsYWJlbFBhbmVOYW1lKTtcclxuXHJcbiAgICB2YXIgcG9wdXBJbmZvLCBsYWJlbGluZ0luZm87XHJcbiAgICBpZiAobGF5ZXIuaXRlbUlkID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgZm9yIChpID0gMCwgbGVuID0gbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5mZWF0dXJlU2V0LmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIGlmIChsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ucG9wdXBJbmZvICE9PSB1bmRlZmluZWQgJiYgbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLnBvcHVwSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBwb3B1cEluZm8gPSBsYXllci5mZWF0dXJlQ29sbGVjdGlvbi5sYXllcnNbaV0ucG9wdXBJbmZvO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKGxheWVyLmZlYXR1cmVDb2xsZWN0aW9uLmxheWVyc1tpXS5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSB1bmRlZmluZWQgJiYgbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgbGFiZWxpbmdJbmZvID0gbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24ubGF5ZXJzW2ldLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm87XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG4gICAgdmFyIGZjID0gZmVhdHVyZUNvbGxlY3Rpb24obnVsbCwge1xyXG4gICAgICBkYXRhOiBsYXllci5pdGVtSWQgfHwgbGF5ZXIuZmVhdHVyZUNvbGxlY3Rpb24sXHJcbiAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHksXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgIGwuZmVhdHVyZS5sYXllck5hbWUgPSBsYXllci50aXRsZS5zcGxpdCgnXycpWzFdO1xyXG4gICAgICAgIGlmIChmYyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICBwb3B1cEluZm8gPSBmYy5wb3B1cEluZm87XHJcbiAgICAgICAgICBsYWJlbGluZ0luZm8gPSBmYy5sYWJlbGluZ0luZm87XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChwb3B1cEluZm8gIT09IHVuZGVmaW5lZCAmJiBwb3B1cEluZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQocG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgLy8gbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgIGwuZmVhdHVyZS5wb3B1cEh0bWwgPSBwb3B1cENvbnRlbnRcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkICYmIGxhYmVsaW5nSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgdmFyIGNvb3JkaW5hdGVzID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xyXG4gICAgICAgICAgdmFyIGxhYmVsUG9zO1xyXG5cclxuICAgICAgICAgIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ1BvaW50Jykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvaW50TGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXNbTWF0aC5yb3VuZChjb29yZGluYXRlcy5sZW5ndGggLyAyKV0pO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5Z29uTGFiZWxQb3MobCk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgdmFyIGxhYmVsID0gbGFiZWxNYXJrZXIobGFiZWxQb3MucG9zaXRpb24sIHtcclxuICAgICAgICAgICAgekluZGV4T2Zmc2V0OiAxLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBnZW9qc29uLnByb3BlcnRpZXMsXHJcbiAgICAgICAgICAgIGxhYmVsaW5nSW5mbzogbGFiZWxpbmdJbmZvLFxyXG4gICAgICAgICAgICBvZmZzZXQ6IGxhYmVsUG9zLm9mZnNldCxcclxuICAgICAgICAgICAgcGFuZTogbGFiZWxQYW5lTmFtZVxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgbGFiZWxzTGF5ZXIuYWRkTGF5ZXIobGFiZWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbHlyID0gTC5sYXllckdyb3VwKFtmYywgbGFiZWxzTGF5ZXJdKTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGQycsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQXJjR0lTRmVhdHVyZUxheWVyJyAmJiBsYXllci5sYXllckRlZmluaXRpb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgdmFyIHdoZXJlID0gJzE9MSc7XHJcbiAgICBpZiAobGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci50eXBlID09PSAnaGVhdG1hcCcpIHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZygnY3JlYXRlIEhlYXRtYXBMYXllcicpO1xyXG4gICAgICAgIHZhciBncmFkaWVudCA9IHt9O1xyXG5cclxuICAgICAgICBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuY29sb3JTdG9wcy5tYXAoZnVuY3Rpb24gKHN0b3ApIHtcclxuICAgICAgICAgIC8vIGdyYWRpZW50W3N0b3AucmF0aW9dID0gJ3JnYmEoJyArIHN0b3AuY29sb3JbMF0gKyAnLCcgKyBzdG9wLmNvbG9yWzFdICsgJywnICsgc3RvcC5jb2xvclsyXSArICcsJyArIChzdG9wLmNvbG9yWzNdLzI1NSkgKyAnKSc7XHJcbiAgICAgICAgICAvLyBncmFkaWVudFtNYXRoLnJvdW5kKHN0b3AucmF0aW8qMTAwKS8xMDBdID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xyXG4gICAgICAgICAgZ3JhZGllbnRbKE1hdGgucm91bmQoc3RvcC5yYXRpbyAqIDEwMCkgLyAxMDAgKyA2KSAvIDddID0gJ3JnYignICsgc3RvcC5jb2xvclswXSArICcsJyArIHN0b3AuY29sb3JbMV0gKyAnLCcgKyBzdG9wLmNvbG9yWzJdICsgJyknO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBseXIgPSBMLmVzcmkuSGVhdC5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDIuMFxyXG4gICAgICAgIC8vIGx5ciA9IEwuZXNyaS5oZWF0bWFwRmVhdHVyZUxheWVyKHsgLy8gRXNyaSBMZWFmbGV0IDEuMFxyXG4gICAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgICB0b2tlbjogcGFyYW1zLnRva2VuIHx8IG51bGwsXHJcbiAgICAgICAgICBtaW5PcGFjaXR5OiAwLjUsXHJcbiAgICAgICAgICBtYXg6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5tYXhQaXhlbEludGVuc2l0eSxcclxuICAgICAgICAgIGJsdXI6IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5yZW5kZXJlci5ibHVyUmFkaXVzLFxyXG4gICAgICAgICAgcmFkaXVzOiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ucmVuZGVyZXIuYmx1clJhZGl1cyAqIDEuMyxcclxuICAgICAgICAgIGdyYWRpZW50OiBncmFkaWVudCxcclxuICAgICAgICAgIHBhbmU6IHBhbmVOYW1lXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0hMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gbHlyO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyICh3aXRoIGxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mbyknKTtcclxuICAgICAgICB2YXIgZHJhd2luZ0luZm8gPSBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm87XHJcbiAgICAgICAgZHJhd2luZ0luZm8udHJhbnNwYXJlbmN5ID0gMTAwIC0gKGxheWVyLm9wYWNpdHkgKiAxMDApO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGRyYXdpbmdJbmZvLnRyYW5zcGFyZW5jeSk7XHJcblxyXG4gICAgICAgIGlmIChsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb24gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgd2hlcmUgPSBsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBtYXAuY3JlYXRlUGFuZShsYWJlbFBhbmVOYW1lKTtcclxuXHJcbiAgICAgICAgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG5cclxuICAgICAgICBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcclxuICAgICAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICAgICAgd2hlcmU6IHdoZXJlLFxyXG4gICAgICAgICAgdG9rZW46IHBhcmFtcy50b2tlbiB8fCBudWxsLFxyXG4gICAgICAgICAgZHJhd2luZ0luZm86IGRyYXdpbmdJbmZvLFxyXG4gICAgICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgICAgICBsLmZlYXR1cmUubGF5ZXJOYW1lID0gbGF5ZXIudGl0bGUuc3BsaXQoJ18nKVsxXTtcclxuICAgICAgICAgICAgaWYgKGxheWVyLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgdmFyIHBvcHVwQ29udGVudCA9IGNyZWF0ZVBvcHVwQ29udGVudChsYXllci5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgICAgLy8gbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgICAgICBsLmZlYXR1cmUucG9wdXBIdG1sID0gcG9wdXBDb250ZW50XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCAmJiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgdmFyIGxhYmVsaW5nSW5mbyA9IGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm87XHJcbiAgICAgICAgICAgICAgdmFyIGNvb3JkaW5hdGVzID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xyXG4gICAgICAgICAgICAgIHZhciBsYWJlbFBvcztcclxuXHJcbiAgICAgICAgICAgICAgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnUG9pbnQnKSB7XHJcbiAgICAgICAgICAgICAgICBsYWJlbFBvcyA9IHBvaW50TGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzW01hdGgucm91bmQoY29vcmRpbmF0ZXMubGVuZ3RoIC8gMildKTtcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5Z29uTGFiZWxQb3MobCk7XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICB2YXIgbGFiZWwgPSBsYWJlbE1hcmtlcihsYWJlbFBvcy5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICAgICAgekluZGV4T2Zmc2V0OiAxLFxyXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogZ2VvanNvbi5wcm9wZXJ0aWVzLFxyXG4gICAgICAgICAgICAgICAgbGFiZWxpbmdJbmZvOiBsYWJlbGluZ0luZm8sXHJcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IGxhYmVsUG9zLm9mZnNldCxcclxuICAgICAgICAgICAgICAgIHBhbmU6IGxhYmVsUGFuZU5hbWVcclxuICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgbGFiZWxzTGF5ZXIuYWRkTGF5ZXIobGFiZWwpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGx5ciA9IEwubGF5ZXJHcm91cChbbHlyLCBsYWJlbHNMYXllcl0pO1xyXG5cclxuICAgICAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGx5cjtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gY29uc29sZS5sb2coJ2NyZWF0ZSBBcmNHSVNGZWF0dXJlTGF5ZXIgKHdpdGhvdXQgbGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvKScpO1xyXG5cclxuICAgICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kZWZpbml0aW9uRXhwcmVzc2lvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgd2hlcmUgPSBsYXllci5sYXllckRlZmluaXRpb24uZGVmaW5pdGlvbkV4cHJlc3Npb247XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGx5ciA9IEwuZXNyaS5mZWF0dXJlTGF5ZXIoe1xyXG4gICAgICAgIHVybDogbGF5ZXIudXJsLFxyXG4gICAgICAgIHRva2VuOiBwYXJhbXMudG9rZW4gfHwgbnVsbCxcclxuICAgICAgICB3aGVyZTogd2hlcmUsXHJcbiAgICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgICAgb25FYWNoRmVhdHVyZTogZnVuY3Rpb24gKGdlb2pzb24sIGwpIHtcclxuICAgICAgICAgIGwuZmVhdHVyZS5sYXllck5hbWUgPSBsYXllci50aXRsZS5zcGxpdCgnXycpWzFdO1xyXG4gICAgICAgICAgaWYgKGxheWVyLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQobGF5ZXIucG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgICAvLyBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgICBsLmZlYXR1cmUucG9wdXBIdG1sID0gcG9wdXBDb250ZW50XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0ZMJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgICAgcmV0dXJuIGx5cjtcclxuICAgIH1cclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ0FyY0dJU0ZlYXR1cmVMYXllcicpIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTRmVhdHVyZUxheWVyJyk7XHJcbiAgICBseXIgPSBMLmVzcmkuZmVhdHVyZUxheWVyKHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIHRva2VuOiBwYXJhbXMudG9rZW4gfHwgbnVsbCxcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9uRWFjaEZlYXR1cmU6IGZ1bmN0aW9uIChnZW9qc29uLCBsKSB7XHJcbiAgICAgICAgbC5mZWF0dXJlLmxheWVyTmFtZSA9IGxheWVyLnRpdGxlLnNwbGl0KCdfJylbMV07XHJcbiAgICAgICAgaWYgKGxheWVyLnBvcHVwSW5mbyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGxheWVyLnBvcHVwSW5mbywgZ2VvanNvbi5wcm9wZXJ0aWVzKTtcclxuICAgICAgICAgIC8vIGwuYmluZFBvcHVwKHBvcHVwQ29udGVudCk7XHJcbiAgICAgICAgICBsLmZlYXR1cmUucG9wdXBIdG1sID0gcG9wdXBDb250ZW50XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdGTCcsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnQ1NWJykge1xyXG4gICAgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG4gICAgbHlyID0gY3N2TGF5ZXIobnVsbCwge1xyXG4gICAgICB1cmw6IGxheWVyLnVybCxcclxuICAgICAgbGF5ZXJEZWZpbml0aW9uOiBsYXllci5sYXllckRlZmluaXRpb24sXHJcbiAgICAgIGxvY2F0aW9uSW5mbzogbGF5ZXIubG9jYXRpb25JbmZvLFxyXG4gICAgICBvcGFjaXR5OiBsYXllci5vcGFjaXR5LFxyXG4gICAgICBwYW5lOiBwYW5lTmFtZSxcclxuICAgICAgb25FYWNoRmVhdHVyZTogZnVuY3Rpb24gKGdlb2pzb24sIGwpIHtcclxuICAgICAgICBsLmZlYXR1cmUubGF5ZXJOYW1lID0gbGF5ZXIudGl0bGUuc3BsaXQoJ18nKVsxXTtcclxuICAgICAgICBpZiAobGF5ZXIucG9wdXBJbmZvICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHZhciBwb3B1cENvbnRlbnQgPSBjcmVhdGVQb3B1cENvbnRlbnQobGF5ZXIucG9wdXBJbmZvLCBnZW9qc29uLnByb3BlcnRpZXMpO1xyXG4gICAgICAgICAgLy8gbC5iaW5kUG9wdXAocG9wdXBDb250ZW50KTtcclxuICAgICAgICAgIGwuZmVhdHVyZS5wb3B1cEh0bWwgPSBwb3B1cENvbnRlbnRcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGxheWVyLmxheWVyRGVmaW5pdGlvbi5kcmF3aW5nSW5mby5sYWJlbGluZ0luZm8gIT09IHVuZGVmaW5lZCAmJiBsYXllci5sYXllckRlZmluaXRpb24uZHJhd2luZ0luZm8ubGFiZWxpbmdJbmZvICE9PSBudWxsKSB7XHJcbiAgICAgICAgICB2YXIgbGFiZWxpbmdJbmZvID0gbGF5ZXIubGF5ZXJEZWZpbml0aW9uLmRyYXdpbmdJbmZvLmxhYmVsaW5nSW5mbztcclxuICAgICAgICAgIHZhciBjb29yZGluYXRlcyA9IGwuZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcclxuICAgICAgICAgIHZhciBsYWJlbFBvcztcclxuXHJcbiAgICAgICAgICBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdQb2ludCcpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2ludExhYmVsUG9zKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAobC5mZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5bGluZUxhYmVsUG9zKGNvb3JkaW5hdGVzW01hdGgucm91bmQoY29vcmRpbmF0ZXMubGVuZ3RoIC8gMildKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWdvbkxhYmVsUG9zKGwpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHZhciBsYWJlbCA9IGxhYmVsTWFya2VyKGxhYmVsUG9zLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgIHpJbmRleE9mZnNldDogMSxcclxuICAgICAgICAgICAgcHJvcGVydGllczogZ2VvanNvbi5wcm9wZXJ0aWVzLFxyXG4gICAgICAgICAgICBsYWJlbGluZ0luZm86IGxhYmVsaW5nSW5mbyxcclxuICAgICAgICAgICAgb2Zmc2V0OiBsYWJlbFBvcy5vZmZzZXQsXHJcbiAgICAgICAgICAgIHBhbmU6IGxhYmVsUGFuZU5hbWVcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGxhYmVsc0xheWVyLmFkZExheWVyKGxhYmVsKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGx5ciA9IEwubGF5ZXJHcm91cChbbHlyLCBsYWJlbHNMYXllcl0pO1xyXG5cclxuICAgIGxheWVycy5wdXNoKHsgdHlwZTogJ0NTVicsIHRpdGxlOiBsYXllci50aXRsZSB8fCAnJywgbGF5ZXI6IGx5ciB9KTtcclxuXHJcbiAgICByZXR1cm4gbHlyO1xyXG4gIH0gZWxzZSBpZiAobGF5ZXIubGF5ZXJUeXBlID09PSAnS01MJykge1xyXG4gICAgbGFiZWxzTGF5ZXIgPSBMLmZlYXR1cmVHcm91cChsYWJlbHMpO1xyXG4gICAgdmFyIGttbCA9IGttbExheWVyKG51bGwsIHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHksXHJcbiAgICAgIHBhbmU6IHBhbmVOYW1lLFxyXG4gICAgICBvbkVhY2hGZWF0dXJlOiBmdW5jdGlvbiAoZ2VvanNvbiwgbCkge1xyXG4gICAgICAgIGwuZmVhdHVyZS5sYXllck5hbWUgPSBsYXllci50aXRsZS5zcGxpdCgnXycpWzFdO1xyXG4gICAgICAgIGlmIChrbWwucG9wdXBJbmZvICE9PSB1bmRlZmluZWQgJiYga21sLnBvcHVwSW5mbyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coa21sLnBvcHVwSW5mbyk7XHJcbiAgICAgICAgICB2YXIgcG9wdXBDb250ZW50ID0gY3JlYXRlUG9wdXBDb250ZW50KGttbC5wb3B1cEluZm8sIGdlb2pzb24ucHJvcGVydGllcyk7XHJcbiAgICAgICAgICAvLyBsLmJpbmRQb3B1cChwb3B1cENvbnRlbnQpO1xyXG4gICAgICAgICAgbC5mZWF0dXJlLnBvcHVwSHRtbCA9IHBvcHVwQ29udGVudFxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoa21sLmxhYmVsaW5nSW5mbyAhPT0gdW5kZWZpbmVkICYmIGttbC5sYWJlbGluZ0luZm8gIT09IG51bGwpIHtcclxuICAgICAgICAgIHZhciBsYWJlbGluZ0luZm8gPSBrbWwubGFiZWxpbmdJbmZvO1xyXG4gICAgICAgICAgdmFyIGNvb3JkaW5hdGVzID0gbC5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xyXG4gICAgICAgICAgdmFyIGxhYmVsUG9zO1xyXG5cclxuICAgICAgICAgIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ1BvaW50Jykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvaW50TGFiZWxQb3MoY29vcmRpbmF0ZXMpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChsLmZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGxhYmVsUG9zID0gcG9seWxpbmVMYWJlbFBvcyhjb29yZGluYXRlcyk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGwuZmVhdHVyZS5nZW9tZXRyeS50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xyXG4gICAgICAgICAgICBsYWJlbFBvcyA9IHBvbHlsaW5lTGFiZWxQb3MoY29vcmRpbmF0ZXNbTWF0aC5yb3VuZChjb29yZGluYXRlcy5sZW5ndGggLyAyKV0pO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbGFiZWxQb3MgPSBwb2x5Z29uTGFiZWxQb3MobCk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgdmFyIGxhYmVsID0gbGFiZWxNYXJrZXIobGFiZWxQb3MucG9zaXRpb24sIHtcclxuICAgICAgICAgICAgekluZGV4T2Zmc2V0OiAxLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBnZW9qc29uLnByb3BlcnRpZXMsXHJcbiAgICAgICAgICAgIGxhYmVsaW5nSW5mbzogbGFiZWxpbmdJbmZvLFxyXG4gICAgICAgICAgICBvZmZzZXQ6IGxhYmVsUG9zLm9mZnNldCxcclxuICAgICAgICAgICAgcGFuZTogbGFiZWxQYW5lTmFtZVxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgbGFiZWxzTGF5ZXIuYWRkTGF5ZXIobGFiZWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbHlyID0gTC5sYXllckdyb3VwKFtrbWwsIGxhYmVsc0xheWVyXSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnS01MJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNJbWFnZVNlcnZpY2VMYXllcicpIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGUgQXJjR0lTSW1hZ2VTZXJ2aWNlTGF5ZXInKTtcclxuICAgIGx5ciA9IEwuZXNyaS5pbWFnZU1hcExheWVyKHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIHRva2VuOiBwYXJhbXMudG9rZW4gfHwgbnVsbCxcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHkgfHwgMVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnSU1MJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNNYXBTZXJ2aWNlTGF5ZXInKSB7XHJcbiAgICBseXIgPSBMLmVzcmkuZHluYW1pY01hcExheWVyKHtcclxuICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgIHRva2VuOiBwYXJhbXMudG9rZW4gfHwgbnVsbCxcclxuICAgICAgcGFuZTogcGFuZU5hbWUsXHJcbiAgICAgIG9wYWNpdHk6IGxheWVyLm9wYWNpdHkgfHwgMVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnRE1MJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIGlmIChsYXllci5sYXllclR5cGUgPT09ICdBcmNHSVNUaWxlZE1hcFNlcnZpY2VMYXllcicpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGx5ciA9IEwuZXNyaS5iYXNlbWFwTGF5ZXIobGF5ZXIudGl0bGUpO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICBseXIgPSBMLmVzcmkudGlsZWRNYXBMYXllcih7XHJcbiAgICAgICAgdXJsOiBsYXllci51cmwsXHJcbiAgICAgICAgdG9rZW46IHBhcmFtcy50b2tlbiB8fCBudWxsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgTC5lc3JpLnJlcXVlc3QobGF5ZXIudXJsLCB7fSwgZnVuY3Rpb24gKGVyciwgcmVzKSB7XHJcbiAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdmFyIG1heFdpZHRoID0gKG1hcC5nZXRTaXplKCkueCAtIDU1KTtcclxuICAgICAgICAgIHZhciB0aWxlZEF0dHJpYnV0aW9uID0gJzxzcGFuIGNsYXNzPVwiZXNyaS1hdHRyaWJ1dGlvbnNcIiBzdHlsZT1cImxpbmUtaGVpZ2h0OjE0cHg7IHZlcnRpY2FsLWFsaWduOiAtM3B4OyB0ZXh0LW92ZXJmbG93OmVsbGlwc2lzOyB3aGl0ZS1zcGFjZTpub3dyYXA7IG92ZXJmbG93OmhpZGRlbjsgZGlzcGxheTppbmxpbmUtYmxvY2s7IG1heC13aWR0aDonICsgbWF4V2lkdGggKyAncHg7XCI+JyArIHJlcy5jb3B5cmlnaHRUZXh0ICsgJzwvc3Bhbj4nO1xyXG4gICAgICAgICAgbWFwLmF0dHJpYnV0aW9uQ29udHJvbC5hZGRBdHRyaWJ1dGlvbih0aWxlZEF0dHJpYnV0aW9uKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2xlYWZsZXQtdGlsZS1wYW5lJylbMF0uc3R5bGUub3BhY2l0eSA9IGxheWVyLm9wYWNpdHkgfHwgMTtcclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdUTUwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ1ZlY3RvclRpbGVMYXllcicpIHtcclxuICAgIHZhciBrZXlzID0ge1xyXG4gICAgICAnV29ybGQgU3RyZWV0IE1hcCAod2l0aCBSZWxpZWYpJzogJ1N0cmVldHNSZWxpZWYnLFxyXG4gICAgICAnV29ybGQgU3RyZWV0IE1hcCAod2l0aCBSZWxpZWYpIChNYXR1cmUgU3VwcG9ydCknOiAnU3RyZWV0c1JlbGllZicsXHJcbiAgICAgICdIeWJyaWQgUmVmZXJlbmNlIExheWVyJzogJ0h5YnJpZCcsXHJcbiAgICAgICdIeWJyaWQgUmVmZXJlbmNlIExheWVyIChNYXR1cmUgU3VwcG9ydCknOiAnSHlicmlkJyxcclxuICAgICAgJ1dvcmxkIFN0cmVldCBNYXAnOiAnU3RyZWV0cycsXHJcbiAgICAgICdXb3JsZCBTdHJlZXQgTWFwIChNYXR1cmUgU3VwcG9ydCknOiAnU3RyZWV0cycsXHJcbiAgICAgICdXb3JsZCBTdHJlZXQgTWFwIChOaWdodCknOiAnU3RyZWV0c05pZ2h0JyxcclxuICAgICAgJ1dvcmxkIFN0cmVldCBNYXAgKE5pZ2h0KSAoTWF0dXJlIFN1cHBvcnQpJzogJ1N0cmVldHNOaWdodCcsXHJcbiAgICAgICdEYXJrIEdyYXkgQ2FudmFzJzogJ0RhcmtHcmF5JyxcclxuICAgICAgJ0RhcmsgR3JheSBDYW52YXMgKE1hdHVyZSBTdXBwb3J0KSc6ICdEYXJrR3JheScsXHJcbiAgICAgICdXb3JsZCBUb3BvZ3JhcGhpYyBNYXAnOiAnVG9wb2dyYXBoaWMnLFxyXG4gICAgICAnV29ybGQgVG9wb2dyYXBoaWMgTWFwIChNYXR1cmUgU3VwcG9ydCknOiAnVG9wb2dyYXBoaWMnLFxyXG4gICAgICAnV29ybGQgTmF2aWdhdGlvbiBNYXAnOiAnTmF2aWdhdGlvbicsXHJcbiAgICAgICdXb3JsZCBOYXZpZ2F0aW9uIE1hcCAoTWF0dXJlIFN1cHBvcnQpJzogJ05hdmlnYXRpb24nLFxyXG4gICAgICAnTGlnaHQgR3JheSBDYW52YXMnOiAnR3JheScsXHJcbiAgICAgICdMaWdodCBHcmF5IENhbnZhcyAoTWF0dXJlIFN1cHBvcnQpJzogJ0dyYXknXHJcbiAgICAgIC8vJ1RlcnJhaW4gd2l0aCBMYWJlbHMnOiAnJyxcclxuICAgICAgLy8nV29ybGQgVGVycmFpbiB3aXRoIExhYmVscyc6ICcnLFxyXG4gICAgICAvLydMaWdodCBHcmF5IENhbnZhcyBSZWZlcmVuY2UnOiAnJyxcclxuICAgICAgLy8nRGFyayBHcmF5IENhbnZhcyBSZWZlcmVuY2UnOiAnJyxcclxuICAgICAgLy8nRGFyayBHcmF5IENhbnZhcyBCYXNlJzogJycsXHJcbiAgICAgIC8vJ0xpZ2h0IEdyYXkgQ2FudmFzIEJhc2UnOiAnJ1xyXG4gICAgfTtcclxuXHJcbiAgICBpZiAoa2V5c1tsYXllci50aXRsZV0pIHtcclxuICAgICAgbHlyID0gTC5lc3JpLlZlY3Rvci5iYXNlbWFwKGtleXNbbGF5ZXIudGl0bGVdKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vuc3VwcG9ydGVkIFZlY3RvciBUaWxlIExheWVyOiAnLCBsYXllcik7XHJcbiAgICAgIGx5ciA9IEwuZmVhdHVyZUdyb3VwKFtdKTtcclxuICAgIH1cclxuXHJcbiAgICBsYXllcnMucHVzaCh7IHR5cGU6ICdWVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ09wZW5TdHJlZXRNYXAnKSB7XHJcbiAgICBseXIgPSBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xyXG4gICAgICBhdHRyaWJ1dGlvbjogJyZjb3B5OyA8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T3BlblN0cmVldE1hcDwvYT4gY29udHJpYnV0b3JzJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ1dlYlRpbGVkTGF5ZXInKSB7XHJcbiAgICB2YXIgbHlyVXJsID0gX2VzcmlXVExVcmxUZW1wbGF0ZVRvTGVhZmxldChsYXllci50ZW1wbGF0ZVVybCk7XHJcbiAgICBseXIgPSBMLnRpbGVMYXllcihseXJVcmwsIHtcclxuICAgICAgYXR0cmlidXRpb246IGxheWVyLmNvcHlyaWdodFxyXG4gICAgfSk7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdsZWFmbGV0LXRpbGUtcGFuZScpWzBdLnN0eWxlLm9wYWNpdHkgPSBsYXllci5vcGFjaXR5IHx8IDE7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnVEwnLCB0aXRsZTogbGF5ZXIudGl0bGUgfHwgbGF5ZXIuaWQgfHwgJycsIGxheWVyOiBseXIgfSk7XHJcblxyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9IGVsc2UgaWYgKGxheWVyLmxheWVyVHlwZSA9PT0gJ1dNUycpIHtcclxuICAgIHZhciBsYXllck5hbWVzID0gJyc7XHJcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBsYXllci52aXNpYmxlTGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIGxheWVyTmFtZXMgKz0gbGF5ZXIudmlzaWJsZUxheWVyc1tpXTtcclxuICAgICAgaWYgKGkgPCBsZW4gLSAxKSB7XHJcbiAgICAgICAgbGF5ZXJOYW1lcyArPSAnLCc7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBseXIgPSBMLnRpbGVMYXllci53bXMobGF5ZXIudXJsLCB7XHJcbiAgICAgIGxheWVyczogU3RyaW5nKGxheWVyTmFtZXMpLFxyXG4gICAgICBmb3JtYXQ6ICdpbWFnZS9wbmcnLFxyXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcclxuICAgICAgYXR0cmlidXRpb246IGxheWVyLmNvcHlyaWdodFxyXG4gICAgfSk7XHJcblxyXG4gICAgbGF5ZXJzLnB1c2goeyB0eXBlOiAnV01TJywgdGl0bGU6IGxheWVyLnRpdGxlIHx8IGxheWVyLmlkIHx8ICcnLCBsYXllcjogbHlyIH0pO1xyXG5cclxuICAgIHJldHVybiBseXI7XHJcbiAgfSBlbHNlIHtcclxuICAgIGx5ciA9IEwuZmVhdHVyZUdyb3VwKFtdKTtcclxuICAgIGNvbnNvbGUubG9nKCdVbnN1cHBvcnRlZCBMYXllcjogJywgbGF5ZXIpO1xyXG4gICAgcmV0dXJuIGx5cjtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZXNyaVdUTFVybFRlbXBsYXRlVG9MZWFmbGV0ICh1cmwpIHtcclxuICB2YXIgbmV3VXJsID0gdXJsO1xyXG5cclxuICBuZXdVcmwgPSBuZXdVcmwucmVwbGFjZSgvXFx7bGV2ZWx9L2csICd7en0nKTtcclxuICBuZXdVcmwgPSBuZXdVcmwucmVwbGFjZSgvXFx7Y29sfS9nLCAne3h9Jyk7XHJcbiAgbmV3VXJsID0gbmV3VXJsLnJlcGxhY2UoL1xce3Jvd30vZywgJ3t5fScpO1xyXG5cclxuICByZXR1cm4gbmV3VXJsO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIE9wZXJhdGlvbmFsTGF5ZXIgPSB7XHJcbiAgb3BlcmF0aW9uYWxMYXllcjogb3BlcmF0aW9uYWxMYXllcixcclxuICBfZ2VuZXJhdGVFc3JpTGF5ZXI6IF9nZW5lcmF0ZUVzcmlMYXllcixcclxuICBfZXNyaVdUTFVybFRlbXBsYXRlVG9MZWFmbGV0OiBfZXNyaVdUTFVybFRlbXBsYXRlVG9MZWFmbGV0XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBPcGVyYXRpb25hbExheWVyO1xyXG4iLCIvKlxyXG4gKiBMLmVzcmkuV2ViTWFwXHJcbiAqIEEgbGVhZmxldCBwbHVnaW4gdG8gZGlzcGxheSBBcmNHSVMgV2ViIE1hcC4gaHR0cHM6Ly9naXRodWIuY29tL3ludW5va2F3YS9MLmVzcmkuV2ViTWFwXHJcbiAqIChjKSAyMDE2IFl1c3VrZSBOdW5va2F3YVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiBgYGBqc1xyXG4gKiB2YXIgd2VibWFwID0gTC53ZWJtYXAoJzIyYzUwNGQyMjlmMTRjNzg5YzViNDllYmZmMzhiOTQxJywgeyBtYXA6IEwubWFwKCdtYXAnKSB9KTtcclxuICogYGBgXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gJy4uL3BhY2thZ2UuanNvbic7XHJcblxyXG5pbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcclxuaW1wb3J0IHsgb3BlcmF0aW9uYWxMYXllciB9IGZyb20gJy4vT3BlcmF0aW9uYWxMYXllcic7XHJcblxyXG5leHBvcnQgdmFyIFdlYk1hcCA9IEwuRXZlbnRlZC5leHRlbmQoe1xyXG4gIG9wdGlvbnM6IHtcclxuICAgIC8vIEwuTWFwXHJcbiAgICBtYXA6IHt9LFxyXG4gICAgLy8gYWNjZXNzIHRva2VuIGZvciBzZWN1cmUgY29udGVudHMgb24gQXJjR0lTIE9ubGluZVxyXG4gICAgdG9rZW46IG51bGwsXHJcbiAgICAvLyBzZXJ2ZXIgZG9tYWluIG5hbWUgKGRlZmF1bHQ9ICd3d3cuYXJjZ2lzLmNvbScpXHJcbiAgICBzZXJ2ZXI6ICd3d3cuYXJjZ2lzLmNvbSdcclxuICB9LFxyXG5cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAod2VibWFwSWQsIG9wdGlvbnMpIHtcclxuICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9tYXAgPSB0aGlzLm9wdGlvbnMubWFwO1xyXG4gICAgdGhpcy5fdG9rZW4gPSB0aGlzLm9wdGlvbnMudG9rZW47XHJcbiAgICB0aGlzLl9zZXJ2ZXIgPSB0aGlzLm9wdGlvbnMuc2VydmVyO1xyXG4gICAgdGhpcy5fd2VibWFwSWQgPSB3ZWJtYXBJZDtcclxuICAgIHRoaXMuX2xvYWRlZCA9IGZhbHNlO1xyXG4gICAgdGhpcy5fbWV0YWRhdGFMb2FkZWQgPSBmYWxzZTtcclxuICAgIHRoaXMuX2xvYWRlZExheWVyc051bSA9IDA7XHJcbiAgICB0aGlzLl9sYXllcnNOdW0gPSAwO1xyXG5cclxuICAgIHRoaXMubGF5ZXJzID0gW107IC8vIENoZWNrIHRoZSBsYXllciB0eXBlcyBoZXJlIC0+IGh0dHBzOi8vZ2l0aHViLmNvbS95bnVub2thd2EvTC5lc3JpLldlYk1hcC93aWtpL0xheWVyLXR5cGVzXHJcbiAgICB0aGlzLnRpdGxlID0gJyc7IC8vIFdlYiBNYXAgVGl0bGVcclxuICAgIHRoaXMuYm9va21hcmtzID0gW107IC8vIFdlYiBNYXAgQm9va21hcmtzIC0+IFt7IG5hbWU6ICdCb29rbWFyayBuYW1lJywgYm91bmRzOiA8TC5sYXRMbmdCb3VuZHM+IH1dXHJcbiAgICB0aGlzLnBvcnRhbEl0ZW0gPSB7fTsgLy8gV2ViIE1hcCBNZXRhZGF0YVxyXG5cclxuICAgIHRoaXMuVkVSU0lPTiA9IHZlcnNpb247XHJcblxyXG4gICAgdGhpcy5fbG9hZFdlYk1hcE1ldGFEYXRhKHdlYm1hcElkKTtcclxuICAgIHRoaXMuX2xvYWRXZWJNYXAod2VibWFwSWQpO1xyXG4gIH0sXHJcblxyXG4gIF9jaGVja0xvYWRlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5fbG9hZGVkTGF5ZXJzTnVtKys7XHJcbiAgICBpZiAodGhpcy5fbG9hZGVkTGF5ZXJzTnVtID09PSB0aGlzLl9sYXllcnNOdW0pIHtcclxuICAgICAgdGhpcy5fbG9hZGVkID0gdHJ1ZTtcclxuICAgICAgdGhpcy5maXJlKCdsb2FkJyk7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgX29wZXJhdGlvbmFsTGF5ZXI6IGZ1bmN0aW9uIChsYXllciwgbGF5ZXJzLCBtYXAsIHBhcmFtcywgcGFuZU5hbWUpIHtcclxuICAgIHZhciBseXIgPSBvcGVyYXRpb25hbExheWVyKGxheWVyLCBsYXllcnMsIG1hcCwgcGFyYW1zLCBwYW5lTmFtZSk7XHJcbiAgICBpZiAobHlyICE9PSB1bmRlZmluZWQgJiYgbGF5ZXIudmlzaWJpbGl0eSA9PT0gdHJ1ZSkge1xyXG4gICAgICBseXIuYWRkVG8obWFwKTtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBfbG9hZFdlYk1hcE1ldGFEYXRhOiBmdW5jdGlvbiAoaWQpIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdfbG9hZFdlYk1hcE1ldGFEYXRhIGlzIHJ1bm5pbmcsIGlkOicsIGlkLCAndGhpcy5fc2VydmVyOicsIHRoaXMuX3NlcnZlcik7XHJcbiAgICB2YXIgcGFyYW1zID0ge307XHJcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xyXG4gICAgdmFyIHdlYm1hcCA9IHRoaXM7XHJcbiAgICB2YXIgd2VibWFwTWV0YURhdGFSZXF1ZXN0VXJsID0gJ2h0dHBzOi8vJyArIHRoaXMuX3NlcnZlciArICcvc2hhcmluZy9yZXN0L2NvbnRlbnQvaXRlbXMvJyArIGlkO1xyXG4gICAgaWYgKHRoaXMuX3Rva2VuICYmIHRoaXMuX3Rva2VuLmxlbmd0aCA+IDApIHtcclxuICAgICAgcGFyYW1zLnRva2VuID0gdGhpcy5fdG9rZW47XHJcbiAgICB9XHJcblxyXG4gICAgTC5lc3JpLnJlcXVlc3Qod2VibWFwTWV0YURhdGFSZXF1ZXN0VXJsLCBwYXJhbXMsIGZ1bmN0aW9uIChlcnJvciwgcmVzcG9uc2UpIHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdXZWJNYXAgTWV0YURhdGE6ICcsIHJlc3BvbnNlKTtcclxuICAgICAgICB3ZWJtYXAucG9ydGFsSXRlbSA9IHJlc3BvbnNlO1xyXG4gICAgICAgIHdlYm1hcC50aXRsZSA9IHJlc3BvbnNlLnRpdGxlO1xyXG4gICAgICAgIHdlYm1hcC5fbWV0YWRhdGFMb2FkZWQgPSB0cnVlO1xyXG4gICAgICAgIHdlYm1hcC5maXJlKCdtZXRhZGF0YUxvYWQnKTtcclxuICAgICAgICBtYXAuZml0Qm91bmRzKFtyZXNwb25zZS5leHRlbnRbMF0ucmV2ZXJzZSgpLCByZXNwb25zZS5leHRlbnRbMV0ucmV2ZXJzZSgpXSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH0sXHJcblxyXG4gIF9sb2FkV2ViTWFwOiBmdW5jdGlvbiAoaWQpIHtcclxuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XHJcbiAgICB2YXIgbGF5ZXJzID0gdGhpcy5sYXllcnM7XHJcbiAgICB2YXIgc2VydmVyID0gdGhpcy5fc2VydmVyO1xyXG4gICAgdmFyIHBhcmFtcyA9IHt9O1xyXG4gICAgdmFyIHdlYm1hcFJlcXVlc3RVcmwgPSAnaHR0cHM6Ly8nICsgc2VydmVyICsgJy9zaGFyaW5nL3Jlc3QvY29udGVudC9pdGVtcy8nICsgaWQgKyAnL2RhdGEnO1xyXG4gICAgLy8gY29uc29sZS5sb2coJ3dlYm1hcFJlcXVlc3RVcmw6Jywgd2VibWFwUmVxdWVzdFVybCwgJ3RoaXMuX3Rva2VuOicsIHRoaXMuX3Rva2VuKTtcclxuICAgIGlmICh0aGlzLl90b2tlbiAmJiB0aGlzLl90b2tlbi5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHBhcmFtcy50b2tlbiA9IHRoaXMuX3Rva2VuO1xyXG4gICAgfVxyXG5cclxuICAgIEwuZXNyaS5yZXF1ZXN0KHdlYm1hcFJlcXVlc3RVcmwsIHBhcmFtcywgZnVuY3Rpb24gKGVycm9yLCByZXNwb25zZSkge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnTC5lc3JpLnJlcXVlc3QgZXJyb3I6JywgZXJyb3IpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdXZWJNYXA6ICcsIHJlc3BvbnNlKTtcclxuICAgICAgICB0aGlzLl9sYXllcnNOdW0gPSByZXNwb25zZS5iYXNlTWFwLmJhc2VNYXBMYXllcnMubGVuZ3RoICsgcmVzcG9uc2Uub3BlcmF0aW9uYWxMYXllcnMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvLyBBZGQgQmFzZW1hcFxyXG4gICAgICAgIHJlc3BvbnNlLmJhc2VNYXAuYmFzZU1hcExheWVycy5tYXAoZnVuY3Rpb24gKGJhc2VNYXBMYXllcikge1xyXG4gICAgICAgICAgaWYgKGJhc2VNYXBMYXllci5pdGVtSWQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB2YXIgaXRlbVJlcXVlc3RVcmwgPSAnaHR0cHM6Ly8nICsgc2VydmVyICsgJy9zaGFyaW5nL3Jlc3QvY29udGVudC9pdGVtcy8nICsgYmFzZU1hcExheWVyLml0ZW1JZDtcclxuICAgICAgICAgICAgTC5lc3JpLnJlcXVlc3QoaXRlbVJlcXVlc3RVcmwsIHBhcmFtcywgZnVuY3Rpb24gKGVyciwgcmVzKSB7XHJcbiAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlcy5hY2Nlc3MpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlcy5hY2Nlc3MgIT09ICdwdWJsaWMnKSB7XHJcbiAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdpbiBfbG9hZFdlYk1hcCBwdWJsaWMnKVxyXG4gICAgICAgICAgICAgICAgICB0aGlzLl9vcGVyYXRpb25hbExheWVyKGJhc2VNYXBMYXllciwgbGF5ZXJzLCBtYXAsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnaW4gX2xvYWRXZWJNYXAgTk9UIHB1YmxpYycpXHJcbiAgICAgICAgICAgICAgICAgIHRoaXMuX29wZXJhdGlvbmFsTGF5ZXIoYmFzZU1hcExheWVyLCBsYXllcnMsIG1hcCwge30pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB0aGlzLl9jaGVja0xvYWRlZCgpO1xyXG4gICAgICAgICAgICB9LCB0aGlzKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX29wZXJhdGlvbmFsTGF5ZXIoYmFzZU1hcExheWVyLCBsYXllcnMsIG1hcCwge30pO1xyXG4gICAgICAgICAgICB0aGlzLl9jaGVja0xvYWRlZCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBPcGVyYXRpb25hbCBMYXllcnNcclxuICAgICAgICByZXNwb25zZS5vcGVyYXRpb25hbExheWVycy5tYXAoZnVuY3Rpb24gKGxheWVyLCBpKSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZygncmVzcG9uc2Uub3BlcmF0aW9uYWxMYXllcnMsIGxheWVyOicsIGxheWVyKTtcclxuICAgICAgICAgIHZhciBwYW5lTmFtZSA9ICdlc3JpLXdlYm1hcC1sYXllcicgKyBpO1xyXG4gICAgICAgICAgbWFwLmNyZWF0ZVBhbmUocGFuZU5hbWUpO1xyXG4gICAgICAgICAgaWYgKGxheWVyLml0ZW1JZCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdXZWJNYXBMb2FkZXIuanMgcGFuZU5hbWU6JywgcGFuZU5hbWUpO1xyXG4gICAgICAgICAgICB2YXIgaXRlbVJlcXVlc3RVcmwgPSAnaHR0cHM6Ly8nICsgc2VydmVyICsgJy9zaGFyaW5nL3Jlc3QvY29udGVudC9pdGVtcy8nICsgbGF5ZXIuaXRlbUlkO1xyXG4gICAgICAgICAgICBMLmVzcmkucmVxdWVzdChpdGVtUmVxdWVzdFVybCwgcGFyYW1zLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcclxuICAgICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cocmVzLmFjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzLmFjY2VzcyAhPT0gJ3B1YmxpYycpIHtcclxuICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ2luc2lkZSBwdWJsaWMsIGxheWVyOicsIGxheWVyLCAnbGF5ZXJzOicsIGxheWVycywgJ21hcDonLCBtYXAsICdwYXJhbXM6JywgcGFyYW1zLCAncGFuZU5hbWU6JywgcGFuZU5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICB0aGlzLl9vcGVyYXRpb25hbExheWVyKGxheWVyLCBsYXllcnMsIG1hcCwgcGFyYW1zLCBwYW5lTmFtZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnTk9UIGluc2lkZSBwdWJsaWMsIGxheWVyOicsIGxheWVyLCAnbGF5ZXJzOicsIGxheWVycywgJ21hcDonLCBtYXAsICdwYXJhbXM6JywgcGFyYW1zLCAncGFuZU5hbWU6JywgcGFuZU5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICB0aGlzLl9vcGVyYXRpb25hbExheWVyKGxheWVyLCBsYXllcnMsIG1hcCwge30sIHBhbmVOYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgdGhpcy5fY2hlY2tMb2FkZWQoKTtcclxuICAgICAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9vcGVyYXRpb25hbExheWVyKGxheWVyLCBsYXllcnMsIG1hcCwge30sIHBhbmVOYW1lKTtcclxuICAgICAgICAgICAgdGhpcy5fY2hlY2tMb2FkZWQoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICAvLyBBZGQgQm9va21hcmtzXHJcbiAgICAgICAgaWYgKHJlc3BvbnNlLmJvb2ttYXJrcyAhPT0gdW5kZWZpbmVkICYmIHJlc3BvbnNlLmJvb2ttYXJrcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICByZXNwb25zZS5ib29rbWFya3MubWFwKGZ1bmN0aW9uIChib29rbWFyaykge1xyXG4gICAgICAgICAgICAvLyBFc3JpIEV4dGVudCBHZW9tZXRyeSB0byBMLmxhdExuZ0JvdW5kc1xyXG4gICAgICAgICAgICB2YXIgbm9ydGhFYXN0ID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGJvb2ttYXJrLmV4dGVudC54bWF4LCBib29rbWFyay5leHRlbnQueW1heCkpO1xyXG4gICAgICAgICAgICB2YXIgc291dGhXZXN0ID0gTC5Qcm9qZWN0aW9uLlNwaGVyaWNhbE1lcmNhdG9yLnVucHJvamVjdChMLnBvaW50KGJvb2ttYXJrLmV4dGVudC54bWluLCBib29rbWFyay5leHRlbnQueW1pbikpO1xyXG4gICAgICAgICAgICB2YXIgYm91bmRzID0gTC5sYXRMbmdCb3VuZHMoc291dGhXZXN0LCBub3J0aEVhc3QpO1xyXG4gICAgICAgICAgICB0aGlzLmJvb2ttYXJrcy5wdXNoKHsgbmFtZTogYm9va21hcmsubmFtZSwgYm91bmRzOiBib3VuZHMgfSk7XHJcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy90aGlzLl9sb2FkZWQgPSB0cnVlO1xyXG4gICAgICAgIC8vdGhpcy5maXJlKCdsb2FkJyk7XHJcbiAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3ZWJNYXAgKHdlYm1hcElkLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBXZWJNYXAod2VibWFwSWQsIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB3ZWJNYXA7XHJcbiJdLCJuYW1lcyI6WyJSZW5kZXJlciIsImZvcm1hdHRlcnMiLCJNSUxMSVNFQ09ORFNfSU5fREFZIiwiTUlMTElTRUNPTkRTX0lOX1dFRUsiLCJsaWdodEZvcm1hdHRlcnMiLCJsb2NhbGUiLCJkZWZhdWx0TG9jYWxlIiwiTUlMTElTRUNPTkRTX0lOX0hPVVIiLCJNSUxMSVNFQ09ORFNfSU5fTUlOVVRFIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFB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QUMsRUFBRTtBQUNyQyxDQUFBLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3pDLENBQUEsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDM0MsQ0FBQSxNQUFNLElBQUksc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNsRSxDQUFBLFFBQVEsT0FBTyxJQUFJLENBQUM7QUFDcEIsQ0FBQSxPQUFPO0FBQ1AsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUEsQ0FBQzs7QUFFRCxDQUFBO0FBQ0EsQ0FBQSxTQUFTLHVCQUF1QixFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUU7QUFDdEQsQ0FBQSxFQUFFLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztBQUN2QixDQUFBLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN0RSxDQUFBLElBQUksSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FB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Q0FBQSxRQUFRLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDOztBQUVyQyxDQUFBLFFBQVEsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEQsQ0FBQSxRQUFRLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUEsUUFBUSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNyQyxDQUFBLE9BQU87QUFDUCxDQUFBLEtBQUssQ0FBQyxDQUFDOztBQUVQLENBQUEsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUNsQixDQUFBLE1BQU0sa0JBQWtCLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDM0MsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDOztBQUV2QyxDQUFBLFFBQVEsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtBQUMzQixDQUFBLFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzFCLENBQUEsVUFBVSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxDQUFBLFNBQVM7O0FBRVQsQ0FBQSxRQUFRLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQzVELENBQUEsVUFBVSxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1B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LENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQ3pELENBQUEsUUFBUSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7O0FBRXpELENBQUEsUUFBUSxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7O0FBRXhCLENBQUEsUUFBUSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNyQyxDQUFBLE9BQU87QUFDUCxDQUFBLEtBQUssQ0FBQyxDQUFDOztBQUVQLENBQUEsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUNsQixDQUFBLE1BQU0sbUJBQW1CLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDNUMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDbEMsQ0FBQSxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDOztBQUV2QyxDQUFBLFFBQVEsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtBQUMzQixDQUFBLFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzFCLENBQUEsVUFBVSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxDQUFBLFNBQVM7O0FBRVQsQ0FBQSxRQUFRLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDdkUsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDL0QsQ0FBQSxVQUFV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SUE7O0NDZk8sU0FBUyxlQUFlLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRTtBQUNyRCxDQUFBLEVBQUUsSUFBSSxRQUFRLEdBQUcsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQzs7QUFFOUMsQ0FBQSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ3BELENBQUEsRUFBRSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOztBQUUzQixDQUFBLEVBQUUsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQSxDQUFDLEFBRUQsQUFJQTs7Q0NiQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQUFBZSxDQUFBLFNBQVMsTUFBTSxDQUFDLFFBQVEsRUFBRTtBQUN6QyxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzFGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDOztBQUV4RCxDQUFBLEVBQUUsSUFBSSxRQUFRLFlBQVksSUFBSSxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxNQUFNLEtBQUssZUFBZSxFQUFFO0FBQzlGLENBQUE7QUFDQSxDQUFBLElBQUksT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUN4QyxDQUFBLEdBQUcsTUFBTSxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxNQUFNLEtBQUssaUJBQWlCLEVBQUU7QUFDM0UsQ0FBQSxJQUFJLE9BQU8sSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDOUIsQ0FBQSxHQUFHLE1BQU07QUFDVCxDQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxNQUFNLEtBQUssaUJBQWlCLENBQUMsSUFBSSxPQUFPLE9BQU8sS0FBSyxXQUFXLEVBQUU7QUFDMUcsQ0FBQTtBQUNBLENBQUEsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLDZJQUE2SSxDQUFDLENBQUM7O0FBRWxLLENBQUEsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDdEMsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLENBQUEsR0FBRztBQUNILENBQUE7O0NDcERlLFNBQVMsU0FBUyxDQUFDLFdBQVcsRUFBRTtBQUMvQyxDQUFBLEVBQUUsSUFBSSxXQUFXLEtBQUssSUFBSSxJQUFJLFdBQVcsS0FBSyxJQUFJLElBQUksV0FBVyxLQUFLLEtBQUssRUFBRTtBQUM3RSxDQUFBLElBQUksT0FBTyxHQUFHLENBQUM7QUFDZixDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQzs7QUFFbkMsQ0FBQSxFQUFFLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ3JCLENBQUEsSUFBSSxPQUFPLE1BQU0sQ0FBQztBQUNsQixDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLE9BQU8sTUFBTSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDN0QsQ0FBQTs7Q0NWQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxBQUFlLENBQUEsU0FBUyxlQUFlLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRTtBQUNoRSxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxpQ0FBaUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzNGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzlDLENBQUEsRUFBRSxJQUFJLE1BQU0sR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDdEMsQ0FBQSxFQUFFLE9BQU8sSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUE7O0NDakNBLElBQUksc0JBQXNCLEdBQUcsS0FBSyxDQUFDO0FBQ25DLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBOztBQUVBLEFBQWUsQ0FBQSxTQUFTLCtCQUErQixDQUFDLFNBQVMsRUFBRTtBQUNuRSxDQUFBLEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDM0MsQ0FBQSxFQUFFLElBQUksa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDcEQsQ0FBQSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLENBQUEsRUFBRSxJQUFJLGdDQUFnQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxzQkFBc0IsQ0FBQztBQUNqRixDQUFBLEVBQUUsT0FBTyxrQkFBa0IsR0FBRyxzQkFBc0IsR0FBRyxnQ0FBZ0MsQ0FBQztBQUN4RixDQUFBOztDQ2xCQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBOztBQUVBLEFBQWUsQ0FBQSxTQUFTLE9BQU8sQ0FBQyxTQUFTLEVBQUU7QUFDM0MsQ0FBQSxFQUFFLElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDNUIsQ0FBQSxJQUFJLE1BQU0sSUFBSSxTQUFTLENBQUMsZ0NBQWdDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsQ0FBQztBQUMxRixDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvQixDQUFBLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN0QixDQUFBOztDQ2xFQSxJQUFJLG9CQUFvQixHQUFHO0FBQzNCLENBQUEsRUFBRSxnQkFBZ0IsRUFBRTtBQUNwQixDQUFBLElBQUksR0FBRyxFQUFFLG9CQUFvQjtBQUM3QixDQUFBLElBQUksS0FBSyxFQUFFLDZCQUE2QjtBQUN4QyxDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsUUFBUSxFQUFFO0FBQ1osQ0FBQSxJQUFJLEdBQUcsRUFBRSxVQUFVO0FBQ25CLENBQUEsSUFBSSxLQUFLLEVBQUUsbUJBQW1CO0FBQzlCLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxXQUFXLEVBQUUsZUFBZTtBQUM5QixDQUFBLEVBQUUsZ0JBQWdCLEVBQUU7QUFDcEIsQ0FBQSxJQUFJLEdBQUcsRUFBRSxvQkFBb0I7QUFDN0IsQ0FBQSxJQUFJLEtBQUssRUFBRSw2QkFBNkI7QUFDeEMsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLFFBQVEsRUFBRTtBQUNaLENBQUEsSUFBSSxHQUFHLEVBQUUsVUFBVTtBQUNuQixDQUFBLElBQUksS0FBSyxFQUFFLG1CQUFtQjtBQUM5QixDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsV0FBVyxFQUFFO0FBQ2YsQ0FBQSxJQUFJLEdBQUcsRUFBRSxjQUFjO0FBQ3ZCLENBQUEsSUFBSSxLQUFLLEVBQUUsdUJBQXVCO0FBQ2xDLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxNQUFNLEVBQUU7QUFDVixDQUFBLElBQUksR0FBRyxFQUFFLFFBQVE7QUFDakIsQ0FBQSxJQUFJLEtBQUssRUFBRSxpQkFBaUI7QUFDNUIsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLEtBQUssRUFBRTtBQUNULENBQUEsSUFBSSxHQUFHLEVBQUUsT0FBTztBQUNoQixDQUFBLElBQUksS0FBSyxFQUFFLGdCQUFnQjtBQUMzQixDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsWUFBWSxFQUFFO0FBQ2hCLENBQUEsSUFBSSxHQUFHLEVBQUUsZUFBZTtBQUN4QixDQUFBLElBQUksS0FBSyxFQUFFLHdCQUF3QjtBQUNuQyxDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsT0FBTyxFQUFFO0FBQ1gsQ0FBQSxJQUFJLEdBQUcsRUFBRSxTQUFTO0FBQ2xCLENBQUEsSUFBSSxLQUFLLEVBQUUsa0JBQWtCO0FBQzdCLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxXQUFXLEVBQUU7QUFDZixDQUFBLElBQUksR0FBRyxFQUFFLGNBQWM7QUFDdkIsQ0FBQSxJQUFJLEtBQUssRUFBRSx1QkFBdUI7QUFDbEMsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLE1BQU0sRUFBRTtBQUNWLENBQUEsSUFBSSxHQUFHLEVBQUUsUUFBUTtBQUNqQixDQUFBLElBQUksS0FBSyxFQUFFLGlCQUFpQjtBQUM1QixDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsVUFBVSxFQUFFO0FBQ2QsQ0FBQSxJQUFJLEdBQUcsRUFBRSxhQUFhO0FBQ3RCLENBQUEsSUFBSSxLQUFLLEVBQUUsc0JBQXNCO0FBQ2pDLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxZQUFZLEVBQUU7QUFDaEIsQ0FBQSxJQUFJLEdBQUcsRUFBRSxlQUFlO0FBQ3hCLENBQUEsSUFBSSxLQUFLLEVBQUUsd0JBQXdCO0FBQ25DLENBQUEsR0FBRztBQUNILENBQUEsQ0FBQyxDQUFDO0FBQ0YsQUFBZSxDQUFBLFNBQVMsY0FBYyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFO0FBQzlELENBQUEsRUFBRSxPQUFPLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQztBQUMxQixDQUFBLEVBQUUsSUFBSSxNQUFNLENBQUM7O0FBRWIsQ0FBQSxFQUFFLElBQUksT0FBTyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxRQUFRLEVBQUU7QUFDdkQsQ0FBQSxJQUFJLE1BQU0sR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN6QyxDQUFBLEdBQUcsTUFBTSxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUU7QUFDMUIsQ0FBQSxJQUFJLE1BQU0sR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDN0MsQ0FBQSxHQUFHLE1BQU07QUFDVCxDQUFBLElBQUksTUFBTSxHQUFHLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzNFLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxPQUFPLENBQUMsU0FBUyxFQUFFO0FBQ3pCLENBQUEsSUFBSSxJQUFJLE9BQU8sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxFQUFFO0FBQ2hDLENBQUEsTUFBTSxPQUFPLEtBQUssR0FBRyxNQUFNLENBQUM7QUFDNUIsQ0FBQSxLQUFLLE1BQU07QUFDWCxDQUFBLE1BQU0sT0FBTyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQzdCLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQTs7Q0M1RWUsU0FBUyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUU7QUFDaEQsQ0FBQSxFQUFFLE9BQU8sVUFBVSxZQUFZLEVBQUU7QUFDakMsQ0FBQSxJQUFJLElBQUksT0FBTyxHQUFHLFlBQVksSUFBSSxFQUFFLENBQUM7QUFDckMsQ0FBQSxJQUFJLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO0FBQzFFLENBQUEsSUFBSSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3hFLENBQUEsSUFBSSxPQUFPLE1BQU0sQ0FBQztBQUNsQixDQUFBLEdBQUcsQ0FBQztBQUNKLENBQUE7O0NDTkEsSUFBSSxXQUFXLEdBQUc7QUFDbEIsQ0FBQSxFQUFFLElBQUksRUFBRSxrQkFBa0I7QUFDMUIsQ0FBQSxFQUFFLElBQUksRUFBRSxZQUFZO0FBQ3BCLENBQUEsRUFBRSxNQUFNLEVBQUUsVUFBVTtBQUNwQixDQUFBLEVBQUUsS0FBSyxFQUFFLFlBQVk7QUFDckIsQ0FBQSxDQUFDLENBQUM7QUFDRixDQUFBLElBQUksV0FBVyxHQUFHO0FBQ2xCLENBQUEsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCO0FBQ3hCLENBQUEsRUFBRSxJQUFJLEVBQUUsYUFBYTtBQUNyQixDQUFBLEVBQUUsTUFBTSxFQUFFLFdBQVc7QUFDckIsQ0FBQSxFQUFFLEtBQUssRUFBRSxRQUFRO0FBQ2pCLENBQUEsQ0FBQyxDQUFDO0FBQ0YsQ0FBQSxJQUFJLGVBQWUsR0FBRztBQUN0QixDQUFBLEVBQUUsSUFBSSxFQUFFLHdCQUF3QjtBQUNoQyxDQUFBLEVBQUUsSUFBSSxFQUFFLHdCQUF3QjtBQUNoQyxDQUFBLEVBQUUsTUFBTSxFQUFFLG9CQUFvQjtBQUM5QixDQUFBLEVBQUUsS0FBSyxFQUFFLG9CQUFvQjtBQUM3QixDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxVQUFVLEdBQUc7QUFDakIsQ0FBQSxFQUFFLElBQUksRUFBRSxpQkFBaUIsQ0FBQztBQUMxQixDQUFBLElBQUksT0FBTyxFQUFFLFdBQVc7QUFDeEIsQ0FBQSxJQUFJLFlBQVksRUFBRSxNQUFNO0FBQ3hCLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxFQUFFLElBQUksRUFBRSxpQkFBaUIsQ0FBQztBQUMxQixDQUFBLElBQUksT0FBTyxFQUFFLFdBQVc7QUFDeEIsQ0FBQSxJQUFJLFlBQVksRUFBRSxNQUFNO0FBQ3hCLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQztBQUM5QixDQUFBLElBQUksT0FBTyxFQUFFLGVBQWU7QUFDNUIsQ0FBQSxJQUFJLFlBQVksRUFBRSxNQUFNO0FBQ3hCLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxDQUFDLENBQUMsQUFDRjs7Q0NqQ0EsSUFBSSxvQkFBb0IsR0FBRztBQUMzQixDQUFBLEVBQUUsUUFBUSxFQUFFLG9CQUFvQjtBQUNoQyxDQUFBLEVBQUUsU0FBUyxFQUFFLGtCQUFrQjtBQUMvQixDQUFBLEVBQUUsS0FBSyxFQUFFLGNBQWM7QUFDdkIsQ0FBQSxFQUFFLFFBQVEsRUFBRSxpQkFBaUI7QUFDN0IsQ0FBQSxFQUFFLFFBQVEsRUFBRSxhQUFhO0FBQ3pCLENBQUEsRUFBRSxLQUFLLEVBQUUsR0FBRztBQUNaLENBQUEsQ0FBQyxDQUFDO0FBQ0YsQUFBZSxDQUFBLFNBQVMsY0FBYyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRTtBQUMxRSxDQUFBLEVBQUUsT0FBTyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNyQyxDQUFBOztDQ1ZlLFNBQVMsZUFBZSxDQUFDLElBQUksRUFBRTtBQUM5QyxDQUFBLEVBQUUsT0FBTyxVQUFVLFVBQVUsRUFBRSxZQUFZLEVBQUU7QUFDN0MsQ0FBQSxJQUFJLElBQUksT0FBTyxHQUFHLFlBQVksSUFBSSxFQUFFLENBQUM7QUFDckMsQ0FBQSxJQUFJLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUM7QUFDM0UsQ0FBQSxJQUFJLElBQUksV0FBVyxDQUFDOztBQUVwQixDQUFBLElBQUksSUFBSSxPQUFPLEtBQUssWUFBWSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtBQUMzRCxDQUFBLE1BQU0sSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUM7QUFDMUUsQ0FBQSxNQUFNLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxZQUFZLENBQUM7QUFDdkUsQ0FBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3hGLENBQUEsS0FBSyxNQUFNO0FBQ1gsQ0FBQSxNQUFNLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7O0FBRTVDLENBQUEsTUFBTSxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQzs7QUFFN0UsQ0FBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDdEUsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxHQUFHLFVBQVUsQ0FBQztBQUN2RixDQUFBLElBQUksT0FBTyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDOUIsQ0FBQSxHQUFHLENBQUM7QUFDSixDQUFBOztDQ3BCQSxJQUFJLFNBQVMsR0FBRztBQUNoQixDQUFBLEVBQUUsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUNwQixDQUFBLEVBQUUsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztBQUMzQixDQUFBLEVBQUUsSUFBSSxFQUFFLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQztBQUN4QyxDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxhQUFhLEdBQUc7QUFDcEIsQ0FBQSxFQUFFLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUM5QixDQUFBLEVBQUUsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0FBQ3ZDLENBQUEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxhQUFhLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSxhQUFhLENBQUM7QUFDcEUsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBOztBQUVBLENBQUEsQ0FBQyxDQUFDO0FBQ0YsQ0FBQSxJQUFJLFdBQVcsR0FBRztBQUNsQixDQUFBLEVBQUUsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7QUFDdEUsQ0FBQSxFQUFFLFdBQVcsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDO0FBQ25HLENBQUEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQztBQUNsSSxDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxTQUFTLEdBQUc7QUFDaEIsQ0FBQSxFQUFFLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUM3QyxDQUFBLEVBQUUsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0FBQ25ELENBQUEsRUFBRSxXQUFXLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUM7QUFDaEUsQ0FBQSxFQUFFLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQztBQUN0RixDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxlQUFlLEdBQUc7QUFDdEIsQ0FBQSxFQUFFLE1BQU0sRUFBRTtBQUNWLENBQUEsSUFBSSxFQUFFLEVBQUUsR0FBRztBQUNYLENBQUEsSUFBSSxFQUFFLEVBQUUsR0FBRztBQUNYLENBQUEsSUFBSSxRQUFRLEVBQUUsSUFBSTtBQUNsQixDQUFBLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixDQUFBLElBQUksT0FBTyxFQUFFLFNBQVM7QUFDdEIsQ0FBQSxJQUFJLFNBQVMsRUFBRSxXQUFXO0FBQzFCLENBQUEsSUFBSSxPQUFPLEVBQUUsU0FBUztBQUN0QixDQUFBLElBQUksS0FBSyxFQUFFLE9BQU87QUFDbEIsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLFdBQVcsRUFBRTtBQUNmLENBQUEsSUFBSSxFQUFFLEVBQUUsSUFBSTtBQUNaLENBQUEsSUFBSSxFQUFFLEVBQUUsSUFBSTtBQUNaLENBQUEsSUFBSSxRQUFRLEVBQUUsVUFBVTtBQUN4QixDQUFBLElBQUksSUFBSSxFQUFFLE1BQU07QUFDaEIsQ0FBQSxJQUFJLE9BQU8sRUFBRSxTQUFTO0FBQ3RCLENBQUEsSUFBSSxTQUFTLEVBQUUsV0FBVztBQUMxQixDQUFBLElBQUksT0FBTyxFQUFFLFNBQVM7QUFDdEIsQ0FBQSxJQUFJLEtBQUssRUFBRSxPQUFPO0FBQ2xCLENBQUEsR0FBRztBQUNILENBQUEsRUFBRSxJQUFJLEVBQUU7QUFDUixDQUFBLElBQUksRUFBRSxFQUFFLE1BQU07QUFDZCxDQUFBLElBQUksRUFBRSxFQUFFLE1BQU07QUFDZCxDQUFBLElBQUksUUFBUSxFQUFFLFVBQVU7QUFDeEIsQ0FBQSxJQUFJLElBQUksRUFBRSxNQUFNO0FBQ2hCLENBQUEsSUFBSSxPQUFPLEVBQUUsU0FBUztBQUN0QixDQUFBLElBQUksU0FBUyxFQUFFLFdBQVc7QUFDMUIsQ0FBQSxJQUFJLE9BQU8sRUFBRSxTQUFTO0FBQ3RCLENBQUEsSUFBSSxLQUFLLEVBQUUsT0FBTztBQUNsQixDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSx5QkFBeUIsR0FBRztBQUNoQyxDQUFBLEVBQUUsTUFBTSxFQUFFO0FBQ1YsQ0FBQSxJQUFJLEVBQUUsRUFBRSxHQUFHO0FBQ1gsQ0FBQSxJQUFJLEVBQUUsRUFBRSxHQUFHO0FBQ1gsQ0FBQSxJQUFJLFFBQVEsRUFBRSxJQUFJO0FBQ2xCLENBQUEsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLENBQUEsSUFBSSxPQUFPLEVBQUUsZ0JBQWdCO0FBQzdCLENBQUEsSUFBSSxTQUFTLEVBQUUsa0JBQWtCO0FBQ2pDLENBQUEsSUFBSSxPQUFPLEVBQUUsZ0JBQWdCO0FBQzdCLENBQUEsSUFBSSxLQUFLLEVBQUUsVUFBVTtBQUNyQixDQUFBLEdBQUc7QUFDSCxDQUFBLEVBQUUsV0FBVyxFQUFFO0FBQ2YsQ0FBQSxJQUFJLEVBQUUsRUFBRSxJQUFJO0FBQ1osQ0FBQSxJQUFJLEVBQUUsRUFBRSxJQUFJO0FBQ1osQ0FBQSxJQUFJLFFBQVEsRUFBRSxVQUFVO0FBQ3hCLENBQUEsSUFBSSxJQUFJLEVBQUUsTUFBTTtBQUNoQixDQUFBLElBQUksT0FBTyxFQUFFLGdCQUFnQjtBQUM3QixDQUFBLElBQUksU0FBUyxFQUFFLGtCQUFrQjtBQUNqQyxDQUFBLElBQUksT0FBTyxFQUFFLGdCQUFnQjtBQUM3QixDQUFBLElBQUksS0FBSyxFQUFFLFVBQVU7QUFDckIsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxFQUFFLElBQUksRUFBRTtBQUNSLENBQUEsSUFBSSxFQUFFLEVBQUUsTUFBTTtBQUNkLENBQUEsSUFBSSxFQUFFLEVBQUUsTUFBTTtBQUNkLENBQUEsSUFBSSxRQUFRLEVBQUUsVUFBVTtBQUN4QixDQUFBLElBQUksSUFBSSxFQUFFLE1BQU07QUFDaEIsQ0FBQSxJQUFJLE9BQU8sRUFBRSxnQkFBZ0I7QUFDN0IsQ0FBQSxJQUFJLFNBQVMsRUFBRSxrQkFBa0I7QUFDakMsQ0FBQSxJQUFJLE9BQU8sRUFBRSxnQkFBZ0I7QUFDN0IsQ0FBQSxJQUFJLEtBQUssRUFBRSxVQUFVO0FBQ3JCLENBQUEsR0FBRztBQUNILENBQUEsQ0FBQyxDQUFDOztBQUVGLENBQUEsU0FBUyxhQUFhLENBQUMsV0FBVyxFQUFFLGFBQWEsRUFBRTtBQUNuRCxDQUFBLEVBQUUsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ25DLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBOztBQUVBLENBQUEsRUFBRSxJQUFJLE1BQU0sR0FBRyxNQUFNLEdBQUcsR0FBRyxDQUFDOztBQUU1QixDQUFBLEVBQUUsSUFBSSxNQUFNLEdBQUcsRUFBRSxJQUFJLE1BQU0sR0FBRyxFQUFFLEVBQUU7QUFDbEMsQ0FBQSxJQUFJLFFBQVEsTUFBTSxHQUFHLEVBQUU7QUFDdkIsQ0FBQSxNQUFNLEtBQUssQ0FBQztBQUNaLENBQUEsUUFBUSxPQUFPLE1BQU0sR0FBRyxJQUFJLENBQUM7O0FBRTdCLENBQUEsTUFBTSxLQUFLLENBQUM7QUFDWixDQUFBLFFBQVEsT0FBTyxNQUFNLEdBQUcsSUFBSSxDQUFDOztBQUU3QixDQUFBLE1BQU0sS0FBSyxDQUFDO0FBQ1osQ0FBQSxRQUFRLE9BQU8sTUFBTSxHQUFHLElBQUksQ0FBQztBQUM3QixDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLE9BQU8sTUFBTSxHQUFHLElBQUksQ0FBQztBQUN2QixDQUFBLENBQUM7O0FBRUQsQ0FBQSxJQUFJLFFBQVEsR0FBRztBQUNmLENBQUEsRUFBRSxhQUFhLEVBQUUsYUFBYTtBQUM5QixDQUFBLEVBQUUsR0FBRyxFQUFFLGVBQWUsQ0FBQztBQUN2QixDQUFBLElBQUksTUFBTSxFQUFFLFNBQVM7QUFDckIsQ0FBQSxJQUFJLFlBQVksRUFBRSxNQUFNO0FBQ3hCLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxFQUFFLE9BQU8sRUFBRSxlQUFlLENBQUM7QUFDM0IsQ0FBQSxJQUFJLE1BQU0sRUFBRSxhQUFhO0FBQ3pCLENBQUEsSUFBSSxZQUFZLEVBQUUsTUFBTTtBQUN4QixDQUFBLElBQUksZ0JBQWdCLEVBQUUsVUFBVSxPQUFPLEVBQUU7QUFDekMsQ0FBQSxNQUFNLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNqQyxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUcsQ0FBQztBQUNKLENBQUEsRUFBRSxLQUFLLEVBQUUsZUFBZSxDQUFDO0FBQ3pCLENBQUEsSUFBSSxNQUFNLEVBQUUsV0FBVztBQUN2QixDQUFBLElBQUksWUFBWSxFQUFFLE1BQU07QUFDeEIsQ0FBQSxHQUFHLENBQUM7QUFDSixDQUFBLEVBQUUsR0FBRyxFQUFFLGVBQWUsQ0FBQztBQUN2QixDQUFBLElBQUksTUFBTSxFQUFFLFNBQVM7QUFDckIsQ0FBQSxJQUFJLFlBQVksRUFBRSxNQUFNO0FBQ3hCLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxFQUFFLFNBQVMsRUFBRSxlQUFlLENBQUM7QUFDN0IsQ0FBQSxJQUFJLE1BQU0sRUFBRSxlQUFlO0FBQzNCLENBQUEsSUFBSSxZQUFZLEVBQUUsTUFBTTtBQUN4QixDQUFBLElBQUksZ0JBQWdCLEVBQUUseUJBQXlCO0FBQy9DLENBQUEsSUFBSSxzQkFBc0IsRUFBRSxNQUFNO0FBQ2xDLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxDQUFDLENBQUMsQUFDRjs7Q0NwSmUsU0FBUyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUU7QUFDbEQsQ0FBQSxFQUFFLE9BQU8sVUFBVSxXQUFXLEVBQUUsWUFBWSxFQUFFO0FBQzlDLENBQUEsSUFBSSxJQUFJLE1BQU0sR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDckMsQ0FBQSxJQUFJLElBQUksT0FBTyxHQUFHLFlBQVksSUFBSSxFQUFFLENBQUM7QUFDckMsQ0FBQSxJQUFJLElBQUksV0FBVyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDOztBQUV0RCxDQUFBLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUN0QixDQUFBLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxJQUFJLGFBQWEsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQSxJQUFJLElBQUksV0FBVyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDOztBQUV0RCxDQUFBLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUN0QixDQUFBLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3pGLENBQUEsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUN6RSxDQUFBLElBQUksT0FBTztBQUNYLENBQUEsTUFBTSxLQUFLLEVBQUUsS0FBSztBQUNsQixDQUFBLE1BQU0sSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQztBQUM5QyxDQUFBLEtBQUssQ0FBQztBQUNOLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQTs7Q0N4QmUsU0FBUyxZQUFZLENBQUMsSUFBSSxFQUFFO0FBQzNDLENBQUEsRUFBRSxPQUFPLFVBQVUsV0FBVyxFQUFFLFlBQVksRUFBRTtBQUM5QyxDQUFBLElBQUksSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3JDLENBQUEsSUFBSSxJQUFJLE9BQU8sR0FBRyxZQUFZLElBQUksRUFBRSxDQUFDO0FBQ3JDLENBQUEsSUFBSSxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO0FBQzlCLENBQUEsSUFBSSxJQUFJLFlBQVksR0FBRyxLQUFLLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ3hHLENBQUEsSUFBSSxJQUFJLFdBQVcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDOztBQUVqRCxDQUFBLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUN0QixDQUFBLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxJQUFJLGFBQWEsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQSxJQUFJLElBQUksYUFBYSxHQUFHLEtBQUssSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDekcsQ0FBQSxJQUFJLElBQUksS0FBSyxDQUFDOztBQUVkLENBQUEsSUFBSSxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxnQkFBZ0IsRUFBRTtBQUM1RSxDQUFBLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxhQUFhLEVBQUUsVUFBVSxPQUFPLEVBQUU7QUFDMUQsQ0FBQSxRQUFRLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNwQyxDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxLQUFLLE1BQU07QUFDWCxDQUFBLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxhQUFhLEVBQUUsVUFBVSxPQUFPLEVBQUU7QUFDeEQsQ0FBQSxRQUFRLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNwQyxDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUNuRSxDQUFBLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDekUsQ0FBQSxJQUFJLE9BQU87QUFDWCxDQUFBLE1BQU0sS0FBSyxFQUFFLEtBQUs7QUFDbEIsQ0FBQSxNQUFNLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7QUFDOUMsQ0FBQSxLQUFLLENBQUM7QUFDTixDQUFBLEdBQUcsQ0FBQztBQUNKLENBQUEsQ0FBQzs7QUFFRCxDQUFBLFNBQVMsT0FBTyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUU7QUFDcEMsQ0FBQSxFQUFFLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO0FBQzFCLENBQUEsSUFBSSxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQzlELENBQUEsTUFBTSxPQUFPLEdBQUcsQ0FBQztBQUNqQixDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUM7O0FBRUQsQ0FBQSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFO0FBQ3JDLENBQUEsRUFBRSxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBRTtBQUMvQyxDQUFBLElBQUksSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDL0IsQ0FBQSxNQUFNLE9BQU8sR0FBRyxDQUFDO0FBQ2pCLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUE7O0NDL0NBLElBQUkseUJBQXlCLEdBQUcsdUJBQXVCLENBQUM7QUFDeEQsQ0FBQSxJQUFJLHlCQUF5QixHQUFHLE1BQU0sQ0FBQztBQUN2QyxDQUFBLElBQUksZ0JBQWdCLEdBQUc7QUFDdkIsQ0FBQSxFQUFFLE1BQU0sRUFBRSxTQUFTO0FBQ25CLENBQUEsRUFBRSxXQUFXLEVBQUUsNERBQTREO0FBQzNFLENBQUEsRUFBRSxJQUFJLEVBQUUsNERBQTREO0FBQ3BFLENBQUEsQ0FBQyxDQUFDO0FBQ0YsQ0FBQSxJQUFJLGdCQUFnQixHQUFHO0FBQ3ZCLENBQUEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDO0FBQ3pCLENBQUEsQ0FBQyxDQUFDO0FBQ0YsQ0FBQSxJQUFJLG9CQUFvQixHQUFHO0FBQzNCLENBQUEsRUFBRSxNQUFNLEVBQUUsVUFBVTtBQUNwQixDQUFBLEVBQUUsV0FBVyxFQUFFLFdBQVc7QUFDMUIsQ0FBQSxFQUFFLElBQUksRUFBRSxnQ0FBZ0M7QUFDeEMsQ0FBQSxDQUFDLENBQUM7QUFDRixDQUFBLElBQUksb0JBQW9CLEdBQUc7QUFDM0IsQ0FBQSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztBQUMvQixDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxrQkFBa0IsR0FBRztBQUN6QixDQUFBLEVBQUUsTUFBTSxFQUFFLGNBQWM7QUFDeEIsQ0FBQSxFQUFFLFdBQVcsRUFBRSxxREFBcUQ7QUFDcEUsQ0FBQSxFQUFFLElBQUksRUFBRSwyRkFBMkY7QUFDbkcsQ0FBQSxDQUFDLENBQUM7QUFDRixDQUFBLElBQUksa0JBQWtCLEdBQUc7QUFDekIsQ0FBQSxFQUFFLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDO0FBQzlGLENBQUEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQztBQUN0RyxDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxnQkFBZ0IsR0FBRztBQUN2QixDQUFBLEVBQUUsTUFBTSxFQUFFLFdBQVc7QUFDckIsQ0FBQSxFQUFFLEtBQUssRUFBRSwwQkFBMEI7QUFDbkMsQ0FBQSxFQUFFLFdBQVcsRUFBRSxpQ0FBaUM7QUFDaEQsQ0FBQSxFQUFFLElBQUksRUFBRSw4REFBOEQ7QUFDdEUsQ0FBQSxDQUFDLENBQUM7QUFDRixDQUFBLElBQUksZ0JBQWdCLEdBQUc7QUFDdkIsQ0FBQSxFQUFFLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQztBQUMzRCxDQUFBLEVBQUUsR0FBRyxFQUFFLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDO0FBQzVELENBQUEsQ0FBQyxDQUFDO0FBQ0YsQ0FBQSxJQUFJLHNCQUFzQixHQUFHO0FBQzdCLENBQUEsRUFBRSxNQUFNLEVBQUUsNERBQTREO0FBQ3RFLENBQUEsRUFBRSxHQUFHLEVBQUUsZ0ZBQWdGO0FBQ3ZGLENBQUEsQ0FBQyxDQUFDO0FBQ0YsQ0FBQSxJQUFJLHNCQUFzQixHQUFHO0FBQzdCLENBQUEsRUFBRSxHQUFHLEVBQUU7QUFDUCxDQUFBLElBQUksRUFBRSxFQUFFLEtBQUs7QUFDYixDQUFBLElBQUksRUFBRSxFQUFFLEtBQUs7QUFDYixDQUFBLElBQUksUUFBUSxFQUFFLE1BQU07QUFDcEIsQ0FBQSxJQUFJLElBQUksRUFBRSxNQUFNO0FBQ2hCLENBQUEsSUFBSSxPQUFPLEVBQUUsVUFBVTtBQUN2QixDQUFBLElBQUksU0FBUyxFQUFFLFlBQVk7QUFDM0IsQ0FBQSxJQUFJLE9BQU8sRUFBRSxVQUFVO0FBQ3ZCLENBQUEsSUFBSSxLQUFLLEVBQUUsUUFBUTtBQUNuQixDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxLQUFLLEdBQUc7QUFDWixDQUFBLEVBQUUsYUFBYSxFQUFFLG1CQUFtQixDQUFDO0FBQ3JDLENBQUEsSUFBSSxZQUFZLEVBQUUseUJBQXlCO0FBQzNDLENBQUEsSUFBSSxZQUFZLEVBQUUseUJBQXlCO0FBQzNDLENBQUEsSUFBSSxhQUFhLEVBQUUsVUFBVSxLQUFLLEVBQUU7QUFDcEMsQ0FBQSxNQUFNLE9BQU8sUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNqQyxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUcsQ0FBQztBQUNKLENBQUEsRUFBRSxHQUFHLEVBQUUsWUFBWSxDQUFDO0FBQ3BCLENBQUEsSUFBSSxhQUFhLEVBQUUsZ0JBQWdCO0FBQ25DLENBQUEsSUFBSSxpQkFBaUIsRUFBRSxNQUFNO0FBQzdCLENBQUEsSUFBSSxhQUFhLEVBQUUsZ0JBQWdCO0FBQ25DLENBQUEsSUFBSSxpQkFBaUIsRUFBRSxLQUFLO0FBQzVCLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUM7QUFDeEIsQ0FBQSxJQUFJLGFBQWEsRUFBRSxvQkFBb0I7QUFDdkMsQ0FBQSxJQUFJLGlCQUFpQixFQUFFLE1BQU07QUFDN0IsQ0FBQSxJQUFJLGFBQWEsRUFBRSxvQkFBb0I7QUFDdkMsQ0FBQSxJQUFJLGlCQUFpQixFQUFFLEtBQUs7QUFDNUIsQ0FBQSxJQUFJLGFBQWEsRUFBRSxVQUFVLEtBQUssRUFBRTtBQUNwQyxDQUFBLE1BQU0sT0FBTyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUM7QUFDdEIsQ0FBQSxJQUFJLGFBQWEsRUFBRSxrQkFBa0I7QUFDckMsQ0FBQSxJQUFJLGlCQUFpQixFQUFFLE1BQU07QUFDN0IsQ0FBQSxJQUFJLGFBQWEsRUFBRSxrQkFBa0I7QUFDckMsQ0FBQSxJQUFJLGlCQUFpQixFQUFFLEtBQUs7QUFDNUIsQ0FBQSxHQUFHLENBQUM7QUFDSixDQUFBLEVBQUUsR0FBRyxFQUFFLFlBQVksQ0FBQztBQUNwQixDQUFBLElBQUksYUFBYSxFQUFFLGdCQUFnQjtBQUNuQyxDQUFBLElBQUksaUJBQWlCLEVBQUUsTUFBTTtBQUM3QixDQUFBLElBQUksYUFBYSxFQUFFLGdCQUFnQjtBQUNuQyxDQUFBLElBQUksaUJBQWlCLEVBQUUsS0FBSztBQUM1QixDQUFBLEdBQUcsQ0FBQztBQUNKLENBQUEsRUFBRSxTQUFTLEVBQUUsWUFBWSxDQUFDO0FBQzFCLENBQUEsSUFBSSxhQUFhLEVBQUUsc0JBQXNCO0FBQ3pDLENBQUEsSUFBSSxpQkFBaUIsRUFBRSxLQUFLO0FBQzVCLENBQUEsSUFBSSxhQUFhLEVBQUUsc0JBQXNCO0FBQ3pDLENBQUEsSUFBSSxpQkFBaUIsRUFBRSxLQUFLO0FBQzVCLENBQUEsR0FBRyxDQUFDO0FBQ0osQ0FBQSxDQUFDLENBQUMsQUFDRjs7Q0M1RkE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxDQUFBLElBQUksTUFBTSxHQUFHO0FBQ2IsQ0FBQSxFQUFFLElBQUksRUFBRSxPQUFPO0FBQ2YsQ0FBQSxFQUFFLGNBQWMsRUFBRSxjQUFjO0FBQ2hDLENBQUEsRUFBRSxVQUFVLEVBQUUsVUFBVTtBQUN4QixDQUFBLEVBQUUsY0FBYyxFQUFFLGNBQWM7QUFDaEMsQ0FBQSxFQUFFLFFBQVEsRUFBRSxRQUFRO0FBQ3BCLENBQUEsRUFBRSxLQUFLLEVBQUUsS0FBSztBQUNkLENBQUEsRUFBRSxPQUFPLEVBQUU7QUFDWCxDQUFBLElBQUksWUFBWSxFQUFFLENBQUM7QUFDbkIsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBLElBQUkscUJBQXFCLEVBQUUsQ0FBQztBQUM1QixDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUMsQ0FBQyxBQUNGOztDQzNCQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxBQUFlLENBQUEsU0FBUyxlQUFlLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRTtBQUNoRSxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxpQ0FBaUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzNGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxNQUFNLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3RDLENBQUEsRUFBRSxPQUFPLGVBQWUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM3QyxDQUFBOztDQ2hDZSxTQUFTLGVBQWUsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFO0FBQzlELENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFDbkMsQ0FBQSxFQUFFLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7O0FBRTNDLENBQUEsRUFBRSxPQUFPLE1BQU0sQ0FBQyxNQUFNLEdBQUcsWUFBWSxFQUFFO0FBQ3ZDLENBQUEsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLE1BQU0sQ0FBQztBQUMxQixDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLE9BQU8sSUFBSSxHQUFHLE1BQU0sQ0FBQztBQUN2QixDQUFBOztDQ1JBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7O0FBRUEsQ0FBQSxJQUFJQyxZQUFVLEdBQUc7QUFDakIsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFO0FBQzVCLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQSxJQUFJLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQzs7QUFFM0MsQ0FBQSxJQUFJLElBQUksSUFBSSxHQUFHLFVBQVUsR0FBRyxDQUFDLEdBQUcsVUFBVSxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUM7QUFDNUQsQ0FBQSxJQUFJLE9BQU8sZUFBZSxDQUFDLEtBQUssS0FBSyxJQUFJLEdBQUcsSUFBSSxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzdFLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRTtBQUM1QixDQUFBLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQ25DLENBQUEsSUFBSSxPQUFPLEtBQUssS0FBSyxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM3RSxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUU7QUFDNUIsQ0FBQSxJQUFJLE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDNUQsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFO0FBQzVCLENBQUEsSUFBSSxJQUFJLGtCQUFrQixHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7O0FBRXhFLENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQSxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQ2YsQ0FBQSxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQ2hCLENBQUEsTUFBTSxLQUFLLEtBQUs7QUFDaEIsQ0FBQSxRQUFRLE9BQU8sa0JBQWtCLENBQUMsV0FBVyxFQUFFLENBQUM7O0FBRWhELENBQUEsTUFBTSxLQUFLLE9BQU87QUFDbEIsQ0FBQSxRQUFRLE9BQU8sa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXJDLENBQUEsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUNsQixDQUFBLE1BQU07QUFDTixDQUFBLFFBQVEsT0FBTyxrQkFBa0IsS0FBSyxJQUFJLEdBQUcsTUFBTSxHQUFHLE1BQU0sQ0FBQztBQUM3RCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUU7QUFDNUIsQ0FBQSxJQUFJLE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN4RSxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUU7QUFDNUIsQ0FBQSxJQUFJLE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDN0QsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFO0FBQzVCLENBQUEsSUFBSSxPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQy9ELENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRTtBQUM1QixDQUFBLElBQUksT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvRCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUU7QUFDNUIsQ0FBQSxJQUFJLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDdEMsQ0FBQSxJQUFJLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0FBQ2pELENBQUEsSUFBSSxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLGNBQWMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hGLENBQUEsSUFBSSxPQUFPLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDNUQsQ0FBQSxHQUFHO0FBQ0gsQ0FBQSxDQUFDLENBQUMsQUFDRixBQUFlLEFBQVU7O0NDaEZ6QixJQUFJQyxxQkFBbUIsR0FBRyxRQUFRLENBQUM7QUFDbkMsQ0FBQTs7QUFFQSxBQUFlLENBQUEsU0FBUyxlQUFlLENBQUMsU0FBUyxFQUFFO0FBQ25ELENBQUEsRUFBRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQzVCLENBQUEsSUFBSSxNQUFNLElBQUksU0FBUyxDQUFDLGdDQUFnQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFDMUYsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDL0IsQ0FBQSxFQUFFLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNqQyxDQUFBLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDekIsQ0FBQSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDL0IsQ0FBQSxFQUFFLElBQUksb0JBQW9CLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzVDLENBQUEsRUFBRSxJQUFJLFVBQVUsR0FBRyxTQUFTLEdBQUcsb0JBQW9CLENBQUM7QUFDcEQsQ0FBQSxFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUdBLHFCQUFtQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzFELENBQUE7O0NDaEI0QztBQUM1QyxDQUFBOztBQUVBLEFBQWUsQ0FBQSxTQUFTLGlCQUFpQixDQUFDLFNBQVMsRUFBRTtBQUNyRCxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzFGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDL0IsQ0FBQSxFQUFFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUM3QixDQUFBLEVBQUUsSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLEdBQUcsWUFBWSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsWUFBWSxDQUFDO0FBQy9ELENBQUEsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUM1QyxDQUFBLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMvQixDQUFBLEVBQUUsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFBOztDQ2QrRDtBQUMvRCxDQUFBOztBQUVBLEFBQWUsQ0FBQSxTQUFTLGlCQUFpQixDQUFDLFNBQVMsRUFBRTtBQUNyRCxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzFGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQy9CLENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7QUFDbkMsQ0FBQSxFQUFFLElBQUkseUJBQXlCLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQSxFQUFFLHlCQUF5QixDQUFDLGNBQWMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMzRCxDQUFBLEVBQUUseUJBQXlCLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BELENBQUEsRUFBRSxJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3JFLENBQUEsRUFBRSxJQUFJLHlCQUF5QixHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlDLENBQUEsRUFBRSx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFBLEVBQUUseUJBQXlCLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BELENBQUEsRUFBRSxJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDOztBQUVyRSxDQUFBLEVBQUUsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksZUFBZSxDQUFDLE9BQU8sRUFBRSxFQUFFO0FBQ25ELENBQUEsSUFBSSxPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7QUFDcEIsQ0FBQSxHQUFHLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksZUFBZSxDQUFDLE9BQU8sRUFBRSxFQUFFO0FBQzFELENBQUEsSUFBSSxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFBLEdBQUcsTUFBTTtBQUNULENBQUEsSUFBSSxPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7QUFDcEIsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTs7Q0MxQitEO0FBQy9ELENBQUE7O0FBRUEsQUFBZSxDQUFBLFNBQVMscUJBQXFCLENBQUMsU0FBUyxFQUFFO0FBQ3pELENBQUEsRUFBRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQzVCLENBQUEsSUFBSSxNQUFNLElBQUksU0FBUyxDQUFDLGdDQUFnQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFDMUYsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMxQyxDQUFBLEVBQUUsSUFBSSxlQUFlLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEMsQ0FBQSxFQUFFLGVBQWUsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM3QyxDQUFBLEVBQUUsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMxQyxDQUFBLEVBQUUsSUFBSSxJQUFJLEdBQUcsaUJBQWlCLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDaEQsQ0FBQSxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQTs7Q0NaQSxJQUFJQyxzQkFBb0IsR0FBRyxTQUFTLENBQUM7QUFDckMsQ0FBQTs7QUFFQSxBQUFlLENBQUEsU0FBUyxhQUFhLENBQUMsU0FBUyxFQUFFO0FBQ2pELENBQUEsRUFBRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQzVCLENBQUEsSUFBSSxNQUFNLElBQUksU0FBUyxDQUFDLGdDQUFnQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFDMUYsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDL0IsQ0FBQSxFQUFFLElBQUksSUFBSSxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ3ZGLENBQUE7QUFDQSxDQUFBOztBQUVBLENBQUEsRUFBRSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHQSxzQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNyRCxDQUFBOztDQ2hCNEM7QUFDNUMsQ0FBQTs7QUFFQSxBQUFlLENBQUEsU0FBUyxjQUFjLENBQUMsU0FBUyxFQUFFLFlBQVksRUFBRTtBQUNoRSxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzFGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxPQUFPLEdBQUcsWUFBWSxJQUFJLEVBQUUsQ0FBQztBQUNuQyxDQUFBLEVBQUUsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztBQUM5QixDQUFBLEVBQUUsSUFBSSxrQkFBa0IsR0FBRyxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztBQUNuRixDQUFBLEVBQUUsSUFBSSxtQkFBbUIsR0FBRyxrQkFBa0IsSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzNGLENBQUEsRUFBRSxJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxJQUFJLElBQUksR0FBRyxtQkFBbUIsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDOztBQUUxRyxDQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsWUFBWSxJQUFJLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDakQsQ0FBQSxJQUFJLE1BQU0sSUFBSSxVQUFVLENBQUMsa0RBQWtELENBQUMsQ0FBQztBQUM3RSxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvQixDQUFBLEVBQUUsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQzdCLENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxDQUFDLEdBQUcsR0FBRyxZQUFZLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxZQUFZLENBQUM7QUFDL0QsQ0FBQSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0FBQzVDLENBQUEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQy9CLENBQUEsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUE7O0NDdkJ5RDtBQUN6RCxDQUFBOztBQUVBLEFBQWUsQ0FBQSxTQUFTLGNBQWMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFO0FBQ2hFLENBQUEsRUFBRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQzVCLENBQUEsSUFBSSxNQUFNLElBQUksU0FBUyxDQUFDLGdDQUFnQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFDMUYsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQzdDLENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7QUFDbkMsQ0FBQSxFQUFFLElBQUksT0FBTyxHQUFHLFlBQVksSUFBSSxFQUFFLENBQUM7QUFDbkMsQ0FBQSxFQUFFLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7QUFDOUIsQ0FBQSxFQUFFLElBQUksMkJBQTJCLEdBQUcsTUFBTSxJQUFJLE1BQU0sQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQztBQUNyRyxDQUFBLEVBQUUsSUFBSSw0QkFBNEIsR0FBRywyQkFBMkIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0FBQ3RILENBQUEsRUFBRSxJQUFJLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsSUFBSSxJQUFJLEdBQUcsNEJBQTRCLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDOztBQUU5SSxDQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMscUJBQXFCLElBQUksQ0FBQyxJQUFJLHFCQUFxQixJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ25FLENBQUEsSUFBSSxNQUFNLElBQUksVUFBVSxDQUFDLDJEQUEyRCxDQUFDLENBQUM7QUFDdEYsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLG1CQUFtQixHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hDLENBQUEsRUFBRSxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUscUJBQXFCLENBQUMsQ0FBQztBQUN6RSxDQUFBLEVBQUUsbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzlDLENBQUEsRUFBRSxJQUFJLGVBQWUsR0FBRyxjQUFjLENBQUMsbUJBQW1CLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDMUUsQ0FBQSxFQUFFLElBQUksbUJBQW1CLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEMsQ0FBQSxFQUFFLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixDQUFDLENBQUM7QUFDckUsQ0FBQSxFQUFFLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM5QyxDQUFBLEVBQUUsSUFBSSxlQUFlLEdBQUcsY0FBYyxDQUFDLG1CQUFtQixFQUFFLFlBQVksQ0FBQyxDQUFDOztBQUUxRSxDQUFBLEVBQUUsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksZUFBZSxDQUFDLE9BQU8sRUFBRSxFQUFFO0FBQ25ELENBQUEsSUFBSSxPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7QUFDcEIsQ0FBQSxHQUFHLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksZUFBZSxDQUFDLE9BQU8sRUFBRSxFQUFFO0FBQzFELENBQUEsSUFBSSxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFBLEdBQUcsTUFBTTtBQUNULENBQUEsSUFBSSxPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7QUFDcEIsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTs7Q0NwQ3lEO0FBQ3pELENBQUE7O0FBRUEsQUFBZSxDQUFBLFNBQVMsa0JBQWtCLENBQUMsU0FBUyxFQUFFLFlBQVksRUFBRTtBQUNwRSxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzFGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxPQUFPLEdBQUcsWUFBWSxJQUFJLEVBQUUsQ0FBQztBQUNuQyxDQUFBLEVBQUUsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztBQUM5QixDQUFBLEVBQUUsSUFBSSwyQkFBMkIsR0FBRyxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDO0FBQ3JHLENBQUEsRUFBRSxJQUFJLDRCQUE0QixHQUFHLDJCQUEyQixJQUFJLElBQUksR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFDdEgsQ0FBQSxFQUFFLElBQUkscUJBQXFCLEdBQUcsT0FBTyxDQUFDLHFCQUFxQixJQUFJLElBQUksR0FBRyw0QkFBNEIsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDOUksQ0FBQSxFQUFFLElBQUksSUFBSSxHQUFHLGNBQWMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDckQsQ0FBQSxFQUFFLElBQUksU0FBUyxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlCLENBQUEsRUFBRSxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUscUJBQXFCLENBQUMsQ0FBQztBQUMzRCxDQUFBLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwQyxDQUFBLEVBQUUsSUFBSSxJQUFJLEdBQUcsY0FBYyxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztBQUNyRCxDQUFBLEVBQUUsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFBOztDQ2xCQSxJQUFJQSxzQkFBb0IsR0FBRyxTQUFTLENBQUM7QUFDckMsQ0FBQTs7QUFFQSxBQUFlLENBQUEsU0FBUyxVQUFVLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRTtBQUN2RCxDQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0FBQzFGLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQy9CLENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLGtCQUFrQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNuRyxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxDQUFBLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBR0Esc0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDckQsQ0FBQTs7Q0NWQSxJQUFJLGFBQWEsR0FBRztBQUNwQixDQUFBLEVBQUUsRUFBRSxFQUFFLElBQUk7QUFDVixDQUFBLEVBQUUsRUFBRSxFQUFFLElBQUk7QUFDVixDQUFBLEVBQUUsUUFBUSxFQUFFLFVBQVU7QUFDdEIsQ0FBQSxFQUFFLElBQUksRUFBRSxNQUFNO0FBQ2QsQ0FBQSxFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQ3BCLENBQUEsRUFBRSxTQUFTLEVBQUUsV0FBVztBQUN4QixDQUFBLEVBQUUsT0FBTyxFQUFFLFNBQVM7QUFDcEIsQ0FBQSxFQUFFLEtBQUssRUFBRSxPQUFPO0FBQ2hCLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxDQUFBLENBQUMsQ0FBQztBQUNGLENBQUEsSUFBSSxVQUFVLEdBQUc7QUFDakIsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDOztBQUVoRCxDQUFBLElBQUksUUFBUSxLQUFLO0FBQ2pCLENBQUE7QUFDQSxDQUFBLE1BQU0sS0FBSyxHQUFHLENBQUM7QUFDZixDQUFBLE1BQU0sS0FBSyxJQUFJLENBQUM7QUFDaEIsQ0FBQSxNQUFNLEtBQUssS0FBSztBQUNoQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRTtBQUNqQyxDQUFBLFVBQVUsS0FBSyxFQUFFLGFBQWE7QUFDOUIsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssT0FBTztBQUNsQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRTtBQUNqQyxDQUFBLFVBQVUsS0FBSyxFQUFFLFFBQVE7QUFDekIsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ2xCLENBQUEsTUFBTTtBQUNOLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFO0FBQ2pDLENBQUEsVUFBVSxLQUFLLEVBQUUsTUFBTTtBQUN2QixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBO0FBQ0EsQ0FBQSxJQUFJLElBQUksS0FBSyxLQUFLLElBQUksRUFBRTtBQUN4QixDQUFBLE1BQU0sSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDOztBQUU3QyxDQUFBLE1BQU0sSUFBSSxJQUFJLEdBQUcsVUFBVSxHQUFHLENBQUMsR0FBRyxVQUFVLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztBQUM5RCxDQUFBLE1BQU0sT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRTtBQUMxQyxDQUFBLFFBQVEsSUFBSSxFQUFFLE1BQU07QUFDcEIsQ0FBQSxPQUFPLENBQUMsQ0FBQztBQUNULENBQUEsS0FBSzs7QUFFTCxDQUFBLElBQUksT0FBT0MsWUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDMUMsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7QUFDL0MsQ0FBQSxJQUFJLElBQUksY0FBYyxHQUFHLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7O0FBRXZELENBQUEsSUFBSSxJQUFJLFFBQVEsR0FBRyxjQUFjLEdBQUcsQ0FBQyxHQUFHLGNBQWMsR0FBRyxDQUFDLEdBQUcsY0FBYyxDQUFDOztBQUU1RSxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLENBQUEsTUFBTSxJQUFJLFlBQVksR0FBRyxRQUFRLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLENBQUEsTUFBTSxPQUFPLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQSxLQUFLOzs7QUFHTCxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLENBQUEsTUFBTSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFO0FBQzlDLENBQUEsUUFBUSxJQUFJLEVBQUUsTUFBTTtBQUNwQixDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxLQUFLOzs7QUFHTCxDQUFBLElBQUksT0FBTyxlQUFlLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuRCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUU7QUFDNUIsQ0FBQSxJQUFJLElBQUksV0FBVyxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDOztBQUU5QyxDQUFBLElBQUksT0FBTyxlQUFlLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0RCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRTtBQUM1QixDQUFBLElBQUksSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBQ3JDLENBQUEsSUFBSSxPQUFPLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQy9DLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7QUFDdEMsQ0FBQSxJQUFJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7O0FBRTFELENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQTtBQUNBLENBQUEsTUFBTSxLQUFLLEdBQUc7QUFDZCxDQUFBLFFBQVEsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDL0IsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxJQUFJO0FBQ2YsQ0FBQSxRQUFRLE9BQU8sZUFBZSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMzQyxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLElBQUk7QUFDZixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRTtBQUMvQyxDQUFBLFVBQVUsSUFBSSxFQUFFLFNBQVM7QUFDekIsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssS0FBSztBQUNoQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRTtBQUN6QyxDQUFBLFVBQVUsS0FBSyxFQUFFLGFBQWE7QUFDOUIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLE9BQU87QUFDbEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUU7QUFDekMsQ0FBQSxVQUFVLEtBQUssRUFBRSxRQUFRO0FBQ3pCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFDbEIsQ0FBQSxNQUFNO0FBQ04sQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUU7QUFDekMsQ0FBQSxVQUFVLEtBQUssRUFBRSxNQUFNO0FBQ3ZCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzs7QUFFMUQsQ0FBQSxJQUFJLFFBQVEsS0FBSztBQUNqQixDQUFBO0FBQ0EsQ0FBQSxNQUFNLEtBQUssR0FBRztBQUNkLENBQUEsUUFBUSxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMvQixDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLElBQUk7QUFDZixDQUFBLFFBQVEsT0FBTyxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzNDLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssSUFBSTtBQUNmLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFO0FBQy9DLENBQUEsVUFBVSxJQUFJLEVBQUUsU0FBUztBQUN6QixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxLQUFLO0FBQ2hCLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFO0FBQ3pDLENBQUEsVUFBVSxLQUFLLEVBQUUsYUFBYTtBQUM5QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssT0FBTztBQUNsQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRTtBQUN6QyxDQUFBLFVBQVUsS0FBSyxFQUFFLFFBQVE7QUFDekIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUNsQixDQUFBLE1BQU07QUFDTixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRTtBQUN6QyxDQUFBLFVBQVUsS0FBSyxFQUFFLE1BQU07QUFDdkIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3RDLENBQUEsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7O0FBRW5DLENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQSxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQ2YsQ0FBQSxNQUFNLEtBQUssSUFBSTtBQUNmLENBQUEsUUFBUSxPQUFPQSxZQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUM5QyxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLElBQUk7QUFDZixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUU7QUFDakQsQ0FBQSxVQUFVLElBQUksRUFBRSxPQUFPO0FBQ3ZCLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLEtBQUs7QUFDaEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7QUFDckMsQ0FBQSxVQUFVLEtBQUssRUFBRSxhQUFhO0FBQzlCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxPQUFPO0FBQ2xCLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFO0FBQ3JDLENBQUEsVUFBVSxLQUFLLEVBQUUsUUFBUTtBQUN6QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ2xCLENBQUEsTUFBTTtBQUNOLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFO0FBQ3JDLENBQUEsVUFBVSxLQUFLLEVBQUUsTUFBTTtBQUN2QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7QUFDdEMsQ0FBQSxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQzs7QUFFbkMsQ0FBQSxJQUFJLFFBQVEsS0FBSztBQUNqQixDQUFBO0FBQ0EsQ0FBQSxNQUFNLEtBQUssR0FBRztBQUNkLENBQUEsUUFBUSxPQUFPLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakMsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxJQUFJO0FBQ2YsQ0FBQSxRQUFRLE9BQU8sZUFBZSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0MsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxJQUFJO0FBQ2YsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFO0FBQ2pELENBQUEsVUFBVSxJQUFJLEVBQUUsT0FBTztBQUN2QixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxLQUFLO0FBQ2hCLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFO0FBQ3JDLENBQUEsVUFBVSxLQUFLLEVBQUUsYUFBYTtBQUM5QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssT0FBTztBQUNsQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRTtBQUNyQyxDQUFBLFVBQVUsS0FBSyxFQUFFLFFBQVE7QUFDekIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUNsQixDQUFBLE1BQU07QUFDTixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRTtBQUNyQyxDQUFBLFVBQVUsS0FBSyxFQUFFLE1BQU07QUFDdkIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtBQUMvQyxDQUFBLElBQUksSUFBSSxJQUFJLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQzs7QUFFekMsQ0FBQSxJQUFJLElBQUksS0FBSyxLQUFLLElBQUksRUFBRTtBQUN4QixDQUFBLE1BQU0sT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRTtBQUMxQyxDQUFBLFFBQVEsSUFBSSxFQUFFLE1BQU07QUFDcEIsQ0FBQSxPQUFPLENBQUMsQ0FBQztBQUNULENBQUEsS0FBSzs7QUFFTCxDQUFBLElBQUksT0FBTyxlQUFlLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvQyxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3RDLENBQUEsSUFBSSxJQUFJLE9BQU8sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBRXRDLENBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7QUFDeEIsQ0FBQSxNQUFNLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUU7QUFDN0MsQ0FBQSxRQUFRLElBQUksRUFBRSxNQUFNO0FBQ3BCLENBQUEsT0FBTyxDQUFDLENBQUM7QUFDVCxDQUFBLEtBQUs7O0FBRUwsQ0FBQSxJQUFJLE9BQU8sZUFBZSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbEQsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLENBQUEsTUFBTSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFO0FBQ3ZELENBQUEsUUFBUSxJQUFJLEVBQUUsTUFBTTtBQUNwQixDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxPQUFPQSxZQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMxQyxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3RDLENBQUEsSUFBSSxJQUFJLFNBQVMsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBRTFDLENBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7QUFDeEIsQ0FBQSxNQUFNLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUU7QUFDL0MsQ0FBQSxRQUFRLElBQUksRUFBRSxXQUFXO0FBQ3pCLENBQUEsT0FBTyxDQUFDLENBQUM7QUFDVCxDQUFBLEtBQUs7O0FBRUwsQ0FBQSxJQUFJLE9BQU8sZUFBZSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDcEQsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDOztBQUVyQyxDQUFBLElBQUksUUFBUSxLQUFLO0FBQ2pCLENBQUE7QUFDQSxDQUFBLE1BQU0sS0FBSyxHQUFHLENBQUM7QUFDZixDQUFBLE1BQU0sS0FBSyxJQUFJLENBQUM7QUFDaEIsQ0FBQSxNQUFNLEtBQUssS0FBSztBQUNoQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRTtBQUN2QyxDQUFBLFVBQVUsS0FBSyxFQUFFLGFBQWE7QUFDOUIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLE9BQU87QUFDbEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUU7QUFDdkMsQ0FBQSxVQUFVLEtBQUssRUFBRSxRQUFRO0FBQ3pCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxRQUFRO0FBQ25CLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFO0FBQ3ZDLENBQUEsVUFBVSxLQUFLLEVBQUUsT0FBTztBQUN4QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ2xCLENBQUEsTUFBTTtBQUNOLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFO0FBQ3ZDLENBQUEsVUFBVSxLQUFLLEVBQUUsTUFBTTtBQUN2QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO0FBQy9DLENBQUEsSUFBSSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDckMsQ0FBQSxJQUFJLElBQUksY0FBYyxHQUFHLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7QUFFekUsQ0FBQSxJQUFJLFFBQVEsS0FBSztBQUNqQixDQUFBO0FBQ0EsQ0FBQSxNQUFNLEtBQUssR0FBRztBQUNkLENBQUEsUUFBUSxPQUFPLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUN0QyxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLElBQUk7QUFDZixDQUFBLFFBQVEsT0FBTyxlQUFlLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2xELENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssSUFBSTtBQUNmLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsY0FBYyxFQUFFO0FBQ3RELENBQUEsVUFBVSxJQUFJLEVBQUUsS0FBSztBQUNyQixDQUFBLFNBQVMsQ0FBQyxDQUFDOztBQUVYLENBQUEsTUFBTSxLQUFLLEtBQUs7QUFDaEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUU7QUFDdkMsQ0FBQSxVQUFVLEtBQUssRUFBRSxhQUFhO0FBQzlCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxPQUFPO0FBQ2xCLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFO0FBQ3ZDLENBQUEsVUFBVSxLQUFLLEVBQUUsUUFBUTtBQUN6QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssUUFBUTtBQUNuQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRTtBQUN2QyxDQUFBLFVBQVUsS0FBSyxFQUFFLE9BQU87QUFDeEIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUNsQixDQUFBLE1BQU07QUFDTixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRTtBQUN2QyxDQUFBLFVBQVUsS0FBSyxFQUFFLE1BQU07QUFDdkIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtBQUMvQyxDQUFBLElBQUksSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ3JDLENBQUEsSUFBSSxJQUFJLGNBQWMsR0FBRyxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBRXpFLENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQTtBQUNBLENBQUEsTUFBTSxLQUFLLEdBQUc7QUFDZCxDQUFBLFFBQVEsT0FBTyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDdEMsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxJQUFJO0FBQ2YsQ0FBQSxRQUFRLE9BQU8sZUFBZSxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDN0QsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxJQUFJO0FBQ2YsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxjQUFjLEVBQUU7QUFDdEQsQ0FBQSxVQUFVLElBQUksRUFBRSxLQUFLO0FBQ3JCLENBQUEsU0FBUyxDQUFDLENBQUM7O0FBRVgsQ0FBQSxNQUFNLEtBQUssS0FBSztBQUNoQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRTtBQUN2QyxDQUFBLFVBQVUsS0FBSyxFQUFFLGFBQWE7QUFDOUIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLE9BQU87QUFDbEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUU7QUFDdkMsQ0FBQSxVQUFVLEtBQUssRUFBRSxRQUFRO0FBQ3pCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxRQUFRO0FBQ25CLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFO0FBQ3ZDLENBQUEsVUFBVSxLQUFLLEVBQUUsT0FBTztBQUN4QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ2xCLENBQUEsTUFBTTtBQUNOLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFO0FBQ3ZDLENBQUEsVUFBVSxLQUFLLEVBQUUsTUFBTTtBQUN2QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7QUFDdEMsQ0FBQSxJQUFJLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUNyQyxDQUFBLElBQUksSUFBSSxZQUFZLEdBQUcsU0FBUyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDOztBQUV2RCxDQUFBLElBQUksUUFBUSxLQUFLO0FBQ2pCLENBQUE7QUFDQSxDQUFBLE1BQU0sS0FBSyxHQUFHO0FBQ2QsQ0FBQSxRQUFRLE9BQU8sTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3BDLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssSUFBSTtBQUNmLENBQUEsUUFBUSxPQUFPLGVBQWUsQ0FBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzNELENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssSUFBSTtBQUNmLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFO0FBQ3BELENBQUEsVUFBVSxJQUFJLEVBQUUsS0FBSztBQUNyQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxLQUFLO0FBQ2hCLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFO0FBQ3ZDLENBQUEsVUFBVSxLQUFLLEVBQUUsYUFBYTtBQUM5QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQztBQUNYLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssT0FBTztBQUNsQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRTtBQUN2QyxDQUFBLFVBQVUsS0FBSyxFQUFFLFFBQVE7QUFDekIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLFFBQVE7QUFDbkIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUU7QUFDdkMsQ0FBQSxVQUFVLEtBQUssRUFBRSxPQUFPO0FBQ3hCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFDbEIsQ0FBQSxNQUFNO0FBQ04sQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUU7QUFDdkMsQ0FBQSxVQUFVLEtBQUssRUFBRSxNQUFNO0FBQ3ZCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQ25DLENBQUEsSUFBSSxJQUFJLGtCQUFrQixHQUFHLEtBQUssR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7O0FBRTNELENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQSxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQ2YsQ0FBQSxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQ2hCLENBQUEsTUFBTSxLQUFLLEtBQUs7QUFDaEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRTtBQUN0RCxDQUFBLFVBQVUsS0FBSyxFQUFFLGFBQWE7QUFDOUIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7O0FBRVgsQ0FBQSxNQUFNLEtBQUssT0FBTztBQUNsQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsU0FBUyxDQUFDLGtCQUFrQixFQUFFO0FBQ3RELENBQUEsVUFBVSxLQUFLLEVBQUUsUUFBUTtBQUN6QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQzs7QUFFWCxDQUFBLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFDbEIsQ0FBQSxNQUFNO0FBQ04sQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRTtBQUN0RCxDQUFBLFVBQVUsS0FBSyxFQUFFLE1BQU07QUFDdkIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3RDLENBQUEsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDbkMsQ0FBQSxJQUFJLElBQUksa0JBQWtCLENBQUM7O0FBRTNCLENBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxFQUFFLEVBQUU7QUFDdEIsQ0FBQSxNQUFNLGtCQUFrQixHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUM7QUFDOUMsQ0FBQSxLQUFLLE1BQU0sSUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFFO0FBQzVCLENBQUEsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDO0FBQ2xELENBQUEsS0FBSyxNQUFNO0FBQ1gsQ0FBQSxNQUFNLGtCQUFrQixHQUFHLEtBQUssR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFDekQsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQSxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQ2YsQ0FBQSxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQ2hCLENBQUEsTUFBTSxLQUFLLEtBQUs7QUFDaEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRTtBQUN0RCxDQUFBLFVBQVUsS0FBSyxFQUFFLGFBQWE7QUFDOUIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7O0FBRVgsQ0FBQSxNQUFNLEtBQUssT0FBTztBQUNsQixDQUFBLFFBQVEsT0FBTyxRQUFRLENBQUMsU0FBUyxDQUFDLGtCQUFrQixFQUFFO0FBQ3RELENBQUEsVUFBVSxLQUFLLEVBQUUsUUFBUTtBQUN6QixDQUFBLFVBQVUsT0FBTyxFQUFFLFlBQVk7QUFDL0IsQ0FBQSxTQUFTLENBQUMsQ0FBQzs7QUFFWCxDQUFBLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFDbEIsQ0FBQSxNQUFNO0FBQ04sQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRTtBQUN0RCxDQUFBLFVBQVUsS0FBSyxFQUFFLE1BQU07QUFDdkIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7QUFDWCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3RDLENBQUEsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDbkMsQ0FBQSxJQUFJLElBQUksa0JBQWtCLENBQUM7O0FBRTNCLENBQUEsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLEVBQUU7QUFDckIsQ0FBQSxNQUFNLGtCQUFrQixHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7QUFDakQsQ0FBQSxLQUFLLE1BQU0sSUFBSSxLQUFLLElBQUksRUFBRSxFQUFFO0FBQzVCLENBQUEsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsU0FBUyxDQUFDO0FBQ25ELENBQUEsS0FBSyxNQUFNLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRTtBQUMzQixDQUFBLE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztBQUNqRCxDQUFBLEtBQUssTUFBTTtBQUNYLENBQUEsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDO0FBQy9DLENBQUEsS0FBSzs7QUFFTCxDQUFBLElBQUksUUFBUSxLQUFLO0FBQ2pCLENBQUEsTUFBTSxLQUFLLEdBQUcsQ0FBQztBQUNmLENBQUEsTUFBTSxLQUFLLElBQUksQ0FBQztBQUNoQixDQUFBLE1BQU0sS0FBSyxLQUFLO0FBQ2hCLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEVBQUU7QUFDdEQsQ0FBQSxVQUFVLEtBQUssRUFBRSxhQUFhO0FBQzlCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDOztBQUVYLENBQUEsTUFBTSxLQUFLLE9BQU87QUFDbEIsQ0FBQSxRQUFRLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRTtBQUN0RCxDQUFBLFVBQVUsS0FBSyxFQUFFLFFBQVE7QUFDekIsQ0FBQSxVQUFVLE9BQU8sRUFBRSxZQUFZO0FBQy9CLENBQUEsU0FBUyxDQUFDLENBQUM7O0FBRVgsQ0FBQSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ2xCLENBQUEsTUFBTTtBQUNOLENBQUEsUUFBUSxPQUFPLFFBQVEsQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEVBQUU7QUFDdEQsQ0FBQSxVQUFVLEtBQUssRUFBRSxNQUFNO0FBQ3ZCLENBQUEsVUFBVSxPQUFPLEVBQUUsWUFBWTtBQUMvQixDQUFBLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLENBQUEsTUFBTSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQzFDLENBQUEsTUFBTSxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUUsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUNsQyxDQUFBLE1BQU0sT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRTtBQUMzQyxDQUFBLFFBQVEsSUFBSSxFQUFFLE1BQU07QUFDcEIsQ0FBQSxPQUFPLENBQUMsQ0FBQztBQUNULENBQUEsS0FBSzs7QUFFTCxDQUFBLElBQUksT0FBT0EsWUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDMUMsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLENBQUEsTUFBTSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFO0FBQ3hELENBQUEsUUFBUSxJQUFJLEVBQUUsTUFBTTtBQUNwQixDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxPQUFPQSxZQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMxQyxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3RDLENBQUEsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDOztBQUV4QyxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLENBQUEsTUFBTSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFO0FBQzNDLENBQUEsUUFBUSxJQUFJLEVBQUUsTUFBTTtBQUNwQixDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxPQUFPLGVBQWUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hELENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7QUFDdEMsQ0FBQSxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUNuQyxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFFLEtBQUssR0FBRyxFQUFFLENBQUM7O0FBRWhDLENBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7QUFDeEIsQ0FBQSxNQUFNLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUU7QUFDM0MsQ0FBQSxRQUFRLElBQUksRUFBRSxNQUFNO0FBQ3BCLENBQUEsT0FBTyxDQUFDLENBQUM7QUFDVCxDQUFBLEtBQUs7O0FBRUwsQ0FBQSxJQUFJLE9BQU8sZUFBZSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDaEQsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtBQUN0QyxDQUFBLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLENBQUEsTUFBTSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFO0FBQzFELENBQUEsUUFBUSxJQUFJLEVBQUUsUUFBUTtBQUN0QixDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxPQUFPQSxZQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMxQyxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3RDLENBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7QUFDeEIsQ0FBQSxNQUFNLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUU7QUFDMUQsQ0FBQSxRQUFRLElBQUksRUFBRSxRQUFRO0FBQ3RCLENBQUEsT0FBTyxDQUFDLENBQUM7QUFDVCxDQUFBLEtBQUs7O0FBRUwsQ0FBQSxJQUFJLE9BQU9BLFlBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzFDLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRTtBQUM1QixDQUFBLElBQUksT0FBT0EsWUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDMUMsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUU7QUFDaEQsQ0FBQSxJQUFJLElBQUksWUFBWSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDO0FBQ3JELENBQUEsSUFBSSxJQUFJLGNBQWMsR0FBRyxZQUFZLENBQUMsaUJBQWlCLEVBQUUsQ0FBQzs7QUFFMUQsQ0FBQSxJQUFJLElBQUksY0FBYyxLQUFLLENBQUMsRUFBRTtBQUM5QixDQUFBLE1BQU0sT0FBTyxHQUFHLENBQUM7QUFDakIsQ0FBQSxLQUFLOztBQUVMLENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQTtBQUNBLENBQUEsTUFBTSxLQUFLLEdBQUc7QUFDZCxDQUFBLFFBQVEsT0FBTyxpQ0FBaUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUNqRSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ2xCLENBQUEsTUFBTSxLQUFLLElBQUk7QUFDZixDQUFBO0FBQ0EsQ0FBQSxRQUFRLE9BQU8sY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzlDLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxPQUFPLENBQUM7QUFDbkIsQ0FBQSxNQUFNLEtBQUssS0FBSyxDQUFDOztBQUVqQixDQUFBLE1BQU07QUFDTixDQUFBLFFBQVEsT0FBTyxjQUFjLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ25ELENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO0FBQ2hELENBQUEsSUFBSSxJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQztBQUNyRCxDQUFBLElBQUksSUFBSSxjQUFjLEdBQUcsWUFBWSxDQUFDLGlCQUFpQixFQUFFLENBQUM7O0FBRTFELENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQTtBQUNBLENBQUEsTUFBTSxLQUFLLEdBQUc7QUFDZCxDQUFBLFFBQVEsT0FBTyxpQ0FBaUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUNqRSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7O0FBRUEsQ0FBQSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ2xCLENBQUEsTUFBTSxLQUFLLElBQUk7QUFDZixDQUFBO0FBQ0EsQ0FBQSxRQUFRLE9BQU8sY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzlDLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxPQUFPLENBQUM7QUFDbkIsQ0FBQSxNQUFNLEtBQUssS0FBSyxDQUFDOztBQUVqQixDQUFBLE1BQU07QUFDTixDQUFBLFFBQVEsT0FBTyxjQUFjLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ25ELENBQUEsS0FBSztBQUNMLENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO0FBQ2hELENBQUEsSUFBSSxJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQztBQUNyRCxDQUFBLElBQUksSUFBSSxjQUFjLEdBQUcsWUFBWSxDQUFDLGlCQUFpQixFQUFFLENBQUM7O0FBRTFELENBQUEsSUFBSSxRQUFRLEtBQUs7QUFDakIsQ0FBQTtBQUNBLENBQUEsTUFBTSxLQUFLLEdBQUcsQ0FBQztBQUNmLENBQUEsTUFBTSxLQUFLLElBQUksQ0FBQztBQUNoQixDQUFBLE1BQU0sS0FBSyxLQUFLO0FBQ2hCLENBQUEsUUFBUSxPQUFPLEtBQUssR0FBRyxtQkFBbUIsQ0FBQyxjQUFjLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDaEUsQ0FBQTs7QUFFQSxDQUFBLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFDbEIsQ0FBQSxNQUFNO0FBQ04sQ0FBQSxRQUFRLE9BQU8sS0FBSyxHQUFHLGNBQWMsQ0FBQyxjQUFjLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDM0QsQ0FBQSxLQUFLO0FBQ0wsQ0FBQSxHQUFHO0FBQ0gsQ0FBQTtBQUNBLENBQUEsRUFBRSxDQUFDLEVBQUUsVUFBVSxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUU7QUFDaEQsQ0FBQSxJQUFJLElBQUksWUFBWSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDO0FBQ3JELENBQUEsSUFBSSxJQUFJLGNBQWMsR0FBRyxZQUFZLENBQUMsaUJBQWlCLEVBQUUsQ0FBQzs7QUFFMUQsQ0FBQSxJQUFJLFFBQVEsS0FBSztBQUNqQixDQUFBO0FBQ0EsQ0FBQSxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQ2YsQ0FBQSxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQ2hCLENBQUEsTUFBTSxLQUFLLEtBQUs7QUFDaEIsQ0FBQSxRQUFRLE9BQU8sS0FBSyxHQUFHLG1CQUFtQixDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNoRSxDQUFBOztBQUVBLENBQUEsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUNsQixDQUFBLE1BQU07QUFDTixDQUFBLFFBQVEsT0FBTyxLQUFLLEdBQUcsY0FBYyxDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUMzRCxDQUFBLEtBQUs7QUFDTCxDQUFBLEdBQUc7QUFDSCxDQUFBO0FBQ0EsQ0FBQSxFQUFFLENBQUMsRUFBRSxVQUFVLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRTtBQUNoRCxDQUFBLElBQUksSUFBSSxZQUFZLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUM7QUFDckQsQ0FBQSxJQUFJLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0FBQzlELENBQUEsSUFBSSxPQUFPLGVBQWUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3BELENBQUEsR0FBRztBQUNILENBQUE7QUFDQSxDQUFBLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO0FBQ2hELENBQUEsSUFBSSxJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQztBQUNyRCxDQUFBLElBQUksSUFBSSxTQUFTLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzNDLENBQUEsSUFBSSxPQUFPLGVBQWUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3BELENBQUEsR0FBRztBQUNILENBQUEsQ0FBQyxDQUFDOztBQUVGLENBQUEsU0FBUyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsY0FBYyxFQUFFO0FBQ3JELENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDcEMsQ0FBQSxFQUFFLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbkMsQ0FBQSxFQUFFLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQ3pDLENBQUEsRUFBRSxJQUFJLE9BQU8sR0FBRyxTQUFTLEdBQUcsRUFBRSxDQUFDOztBQUUvQixDQUFBLEVBQUUsSUFBSSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ3JCLENBQUEsSUFBSSxPQUFPLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDaEMsQ0FBQSxHQUFHOztBQUVILENBQUEsRUFBRSxJQUFJLFNBQVMsR0FBRyxjQUFjLElBQUksRUFBRSxDQUFDO0FBQ3ZDLENBQUEsRUFBRSxPQUFPLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsU0FBUyxHQUFHLGVBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDeEUsQ0FBQSxDQUFDOztBQUVELENBQUEsU0FBUyxpQ0FBaUMsQ0FBQyxNQUFNLEVBQUUsY0FBYyxFQUFFO0FBQ25FLENBQUEsRUFBRSxJQUFJLE1BQU0sR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFO0FBQ3pCLENBQUEsSUFBSSxJQUFJLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDdEMsQ0FBQSxJQUFJLE9BQU8sSUFBSSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1RCxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLE9BQU8sY0FBYyxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztBQUNoRCxDQUFBLENBQUM7O0FBRUQsQ0FBQSxTQUFTLGNBQWMsQ0FBQyxNQUFNLEVBQUUsY0FBYyxFQUFFO0FBQ2hELENBQUEsRUFBRSxJQUFJLFNBQVMsR0FBRyxjQUFjLElBQUksRUFBRSxDQUFDO0FBQ3ZDLENBQUEsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDcEMsQ0FBQSxFQUFFLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbkMsQ0FBQSxFQUFFLElBQUksS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM3RCxDQUFBLEVBQUUsSUFBSSxPQUFPLEdBQUcsZUFBZSxDQUFDLFNBQVMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDbkQsQ0FBQSxFQUFFLE9BQU8sSUFBSSxHQUFHLEtBQUssR0FBRyxTQUFTLEdBQUcsT0FBTyxDQUFDO0FBQzVDLENBQUEsQ0FBQyxBQUVEOztDQ3YxQkEsU0FBUyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFO0FBQ2hELENBQUEsRUFBRSxRQUFRLE9BQU87QUFDakIsQ0FBQSxJQUFJLEtBQUssR0FBRztBQUNaLENBQUEsTUFBTSxPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUM7QUFDN0IsQ0FBQSxRQUFRLEtBQUssRUFBRSxPQUFPO0FBQ3RCLENBQUEsT0FBTyxDQUFDLENBQUM7O0FBRVQsQ0FBQSxJQUFJLEtBQUssSUFBSTtBQUNiLENBQUEsTUFBTSxPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUM7QUFDN0IsQ0FBQSxRQUFRLEtBQUssRUFBRSxRQUFRO0FBQ3ZCLENBQUEsT0FBTyxDQUFDLENBQUM7O0FBRVQsQ0FBQSxJQUFJLEtBQUssS0FBSztBQUNkLENBQUEsTUFBTSxPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUM7QUFDN0IsQ0FBQSxRQUFRLEtBQUssRUFBRSxNQUFNO0FBQ3JCLENBQUEsT0FBTyxDQUFDLENBQUM7O0FBRVQsQ0FBQSxJQUFJLEtBQUssTUFBTSxDQUFDO0FBQ2hCLENBQUEsSUFBSTtBQUNKLENBQUEsTUFBTSxPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUM7QUFDN0IsQ0FBQSxRQUFRLEtBQUssRUFBRSxNQUFNO0FBQ3JCLENBQUEsT0FBTyxDQUFDLENBQUM7QUFDVCxDQUFBLEdBQUc7QUFDSCxDQUFBLENBQUM7O0FBRUQsQ0FBQSxTQUFTLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUU7QUFDaEQsQ0FBQSxFQUFFLFFBQVEsT0FBTztBQUNqQixDQUFBLElBQUksS0FBSyxHQUFHO0FBQ1osQ0FBQSxNQUFNLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztBQUM3QixDQUFBLFFBQVEsS0FBSyxFQUFFLE9BQU87QUFDdEIsQ0FBQSxPQUFPLENBQUMsQ0FBQzs7QUFFVCxDQUFBLElBQUksS0FBSyxJQUFJO0FBQ2IsQ0FBQSxNQUFNLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztBQUM3QixDQUFBLFFBQVEsS0FBSyxFQUFFLFFBQVE7QUFDdkIsQ0FBQSxPQUFPLENBQUMsQ0FBQzs7QUFFVCxDQUFBLElBQUksS0FBSyxLQUFLO0FBQ2QsQ0FBQSxNQUFNLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztBQUM3QixDQUFBLFFBQVEsS0FBSyxFQUFFLE1BQU07QUFDckIsQ0FBQSxPQUFPLENBQUMsQ0FBQzs7QUFFVCxDQUFBLElBQUksS0FBSyxNQUFNLENBQUM7QUFDaEIsQ0FBQSxJQUFJO0FBQ0osQ0FBQSxNQUFNLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztBQUM3QixDQUFBLFFBQVEsS0FBSyxFQUFFLE1BQU07QUFDckIsQ0FBQSxPQUFPLENBQUMsQ0FBQztBQUNULENBQUEsR0FBRztBQUNILENBQUEsQ0FBQzs7QUFFRCxDQUFBLFNBQVMscUJBQXFCLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRTtBQUNwRCxDQUFBLEVBQUUsSUFBSSxXQUFXLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMvQyxDQUFBLEVBQUUsSUFBSSxXQUFXLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25DLENBQUEsRUFBRSxJQUFJLFdBQVcsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRW5DLENBQUEsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFO0FBQ3BCLENBQUEsSUFBSSxPQUFPLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztBQUNsRCxDQUFBLEdBQUc7O0FBRUgsQ0FBQSxFQUFFLElBQUksY0FBYyxDQUFDOztBQUVyQixDQUFBLEVBQUUsUUFBUSxXQUFXO0FBQ3JCLENBQUEsSUFBSSxLQUFLLEdBQUc7QUFDWixDQUFBLE1BQU0sY0FBYyxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDM0MsQ0FBQSxRQUFRLEtBQUssRUFBRSxPQUFPO0FBQ3RCLENBQUEsT0FBTyxDQUFDLENBQUM7QUFDVCxDQUFBLE1BQU0sTUFBTTs7QUFFWixDQUFBLElBQUksS0FBSyxJQUFJO0FBQ2IsQ0FBQSxNQUFNLGNBQWMsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDO0FBQzNDLENBQUEsUUFBUSxLQUFLLEVBQUUsUUFBUTtBQUN2QixDQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsQ0FBQSxNQUFNLE1BQU07O0FBRVosQ0FBQSxJQUFJLEtBQUssS0FBSztBQUNkLENBQUEsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQztBQUMzQyxDQUFBLFFBQVEsS0FBSyxFQUFFLE1BQU07QUFDckIsQ0FBQSxPQUFPLENBQUMsQ0FBQztBQUNULENBQUEsTUFBTSxNQUFNOztBQUVaLENBQUEsSUFBSSxLQUFLLE1BQU0sQ0FBQztBQUNoQixDQUFBLElBQUk7QUFDSixDQUFBLE1BQU0sY0FBYyxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDM0MsQ0FBQSxRQUFRLEtBQUssRUFBRSxNQUFNO0FBQ3JCLENBQUEsT0FBTyxDQUFDLENBQUM7QUFDVCxDQUFBLE1BQU0sTUFBTTtBQUNaLENBQUEsR0FBRzs7QUFFSCxDQUFBLEVBQUUsT0FBTyxjQUFjLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ3hKLENBQUEsQ0FBQzs7QUFFRCxDQUFBLElBQUksY0FBYyxHQUFHO0FBQ3JCLENBQUEsRUFBRSxDQUFDLEVBQUUsaUJBQWlCO0FBQ3RCLENBQUEsRUFBRSxDQUFDLEVBQUUscUJBQXFCO0FBQzFCLENBQUEsQ0FBQyxDQUFDLEFBQ0Y7O0NDL0ZBLElBQUksd0JBQXdCLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0MsQ0FBQSxJQUFJLHVCQUF1QixHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzdDLEFBQU8sQ0FBQSxTQUFTLHlCQUF5QixDQUFDLEtBQUssRUFBRTtBQUNqRCxDQUFBLEVBQUUsT0FBTyx3QkFBd0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDeEQsQ0FBQSxDQUFDO0FBQ0QsQUFBTyxDQUFBLFNBQVMsd0JBQXdCLENBQUMsS0FBSyxFQUFFO0FBQ2hELENBQUEsRUFBRSxPQUFPLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFBLENBQUM7QUFDRCxBQUFPLENBQUEsU0FBUyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUU7QUFDM0MsQ0FBQSxFQUFFLElBQUksS0FBSyxLQUFLLE1BQU0sRUFBRTtBQUN4QixDQUFBLElBQUksTUFBTSxJQUFJLFVBQVUsQ0FBQyw4RUFBOEUsQ0FBQyxDQUFDO0FBQ3pHLENBQUEsR0FBRyxNQUFNLElBQUksS0FBSyxLQUFLLElBQUksRUFBRTtBQUM3QixDQUFBLElBQUksTUFBTSxJQUFJLFVBQVUsQ0FBQywwRUFBMEUsQ0FBQyxDQUFDO0FBQ3JHLENBQUEsR0FBRyxNQUFNLElBQUksS0FBSyxLQUFLLEdBQUcsRUFBRTtBQUM1QixDQUFBLElBQUksTUFBTSxJQUFJLFVBQVUsQ0FBQyxvRkFBb0YsQ0FBQyxDQUFDO0FBQy9HLENBQUEsR0FBRyxNQUFNLElBQUksS0FBSyxLQUFLLElBQUksRUFBRTtBQUM3QixDQUFBLElBQUksTUFBTSxJQUFJLFVBQVUsQ0FBQyxzRkFBc0YsQ0FBQyxDQUFDO0FBQ2pILENBQUEsR0FBRztBQUNILENBQUE7O0NDVm9EO0FBQ3BELENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7O0FBRUEsQ0FBQSxJQUFJLHNCQUFzQixHQUFHLHVEQUF1RCxDQUFDO0FBQ3JGLENBQUE7O0FBRUEsQ0FBQSxJQUFJLDBCQUEwQixHQUFHLG1DQUFtQyxDQUFDO0FBQ3JFLENBQUEsSUFBSSxtQkFBbUIsR0FBRyxjQUFjLENBQUM7QUFDekMsQ0FBQSxJQUFJLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQUM5QixDQUFBLElBQUksNkJBQTZCLEdBQUcsVUFBVSxDQUFDO0FBQy9DLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNB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QUc7O0FBRUgsQ0FBQSxFQUFFLE9BQU8sV0FBVyxHQUFHLE1BQU0sR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQzNDLENBQUEsQ0FBQzs7QUFFRCxDQUFBLElBQUksYUFBYSxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNyRSxDQUFBLElBQUksdUJBQXVCLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDOztBQUUvRSxDQUFBLFNBQVMsZUFBZSxDQUFDLElBQUksRUFBRTtBQUMvQixDQUFBLEVBQUUsT0FBTyxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQztBQUNoRSxDQUFBLENBQUM7QUFDRCxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FBQ0EsQ0FBQTtBQUNBLENBQUE7QUFDQSxDQUFBO0FB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U0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDakUsQ0FBQSxvQkFBb0IsSUFBSTtBQUN4QixDQUFBLG9CQUFvQixVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDakUsQ0FBQSxvQkFBb0IsVUFBVSxDQUFDO0FBQy9CLENBQUE7QUFDQSxDQUFBLFNBQVMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUN4RSxDQUFBLFVBQVUsT0FBTyxJQUFJLFlBQVk7QUFDakMsQ0FBQSxvQkFBb0IsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO0FBQ2pELENBQUEsb0JBQW9CLGFBQWE7QUFDakMsQ0FBQSxvQkFBb0IsYUFBYTtBQUNqQyxDQUFBLG9CQUFvQixVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDakUsQ0FBQSxvQkFBb0IsSUFBSTtBQUN4QixDQUFBLG9CQUFvQixVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDakUsQ0FBQSxvQkFBb0IsVUFBVSxDQUFDO0FBQy9CLENBQUE7QUFDQSxDQUFBLFNBQVMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUN4RSxDQUFBLFVBQVUsT0FBTyxJQUFJLFlBQVk7QUFDakMsQ0FBQSxvQkFBb0IsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO0FBQ2pELENBQUEsb0JBQW9CLGFBQWE7QUFDakMsQ0FBQSxvQkFBb0Isb0JBQW9CLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMs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