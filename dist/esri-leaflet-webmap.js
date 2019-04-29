/* L-esri-WebMap - v0.4.0 - Mon Apr 29 2019 17:44:35 GMT-0400 (Eastern Daylight Time)
 * Copyright (c) 2019 Yusuke Nunokawa <ynunokawa.dev@gmail.com>
 * MIT */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports,require("leaflet"),require("leaflet-omnivore"),require("date-fns")):"function"==typeof define&&define.amd?define(["exports","leaflet","leaflet-omnivore","date-fns"],t):t((e.L=e.L||{},e.L.esri=e.L.esri||{}),e.L,e.omnivore,e.datefns)}(this,function(e,t,i,o){"use strict";function r(e,t){for(var i=0;i<e.length;i++)if(e[i]!==t[i])return!1;return!0}function n(e){return r(e[0],e[e.length-1])||e.push(e[0]),e}function s(e){var t,i=0,o=0,r=e.length,n=e[o];for(o;o<r-1;o++)t=e[o+1],i+=(t[0]-n[0])*(t[1]+n[1]),n=t;return i>=0}function a(e,t,i,o){var r=(o[0]-i[0])*(e[1]-i[1])-(o[1]-i[1])*(e[0]-i[0]),n=(t[0]-e[0])*(e[1]-i[1])-(t[1]-e[1])*(e[0]-i[0]),s=(o[1]-i[1])*(t[0]-e[0])-(o[0]-i[0])*(t[1]-e[1]);if(0!==s){var a=r/s,l=n/s;if(a>=0&&a<=1&&l>=0&&l<=1)return!0}return!1}function l(e,t){for(var i=0;i<e.length-1;i++)for(var o=0;o<t.length-1;o++)if(a(e[i],e[i+1],t[o],t[o+1]))return!0;return!1}function f(e,t){for(var i=!1,o=-1,r=e.length,n=r-1;++o<r;n=o)(e[o][1]<=t[1]&&t[1]<e[n][1]||e[n][1]<=t[1]&&t[1]<e[o][1])&&t[0]<(e[n][0]-e[o][0])*(t[1]-e[o][1])/(e[n][1]-e[o][1])+e[o][0]&&(i=!i);return i}function u(e,t){var i=l(e,t),o=f(e,t[0]);return!(i||!o)}function p(e){for(var t,i,o,r=[],a=[],f=0;f<e.length;f++){var p=n(e[f].slice(0));if(!(p.length<4))if(s(p)){var h=[p];r.push(h)}else a.push(p)}for(var y=[];a.length;){o=a.pop();var c=!1;for(t=r.length-1;t>=0;t--)if(i=r[t][0],u(i,o)){r[t].push(o),c=!0;break}c||y.push(o)}for(;y.length;){o=y.pop();var d=!1;for(t=r.length-1;t>=0;t--)if(i=r[t][0],l(i,o)){r[t].push(o),d=!0;break}d||r.push([o.reverse()])}return 1===r.length?{type:"Polygon",coordinates:r[0]}:{type:"MultiPolygon",coordinates:r}}function h(e){var t={};for(var i in e)e.hasOwnProperty(i)&&(t[i]=e[i]);return t}function y(e,t){var i={};return"number"==typeof e.x&&"number"==typeof e.y&&(i.type="Point",i.coordinates=[e.x,e.y]),e.points&&(i.type="MultiPoint",i.coordinates=e.points.slice(0)),e.paths&&(1===e.paths.length?(i.type="LineString",i.coordinates=e.paths[0].slice(0)):(i.type="MultiLineString",i.coordinates=e.paths.slice(0))),e.rings&&(i=p(e.rings.slice(0))),(e.geometry||e.attributes)&&(i.type="Feature",i.geometry=e.geometry?y(e.geometry):null,i.properties=e.attributes?h(e.attributes):null,e.attributes&&(i.id=e.attributes[t]||e.attributes.OBJECTID||e.attributes.FID)),JSON.stringify(i.geometry)===JSON.stringify({})&&(i.geometry=null),i}function c(e,t){return new U(e,t)}function d(e,t){return new Y(e,t)}function _(e,t){return new K(e,t)}function g(e,t){return new $(e,t)}function m(e,t){return new Q(e,t)}function v(e,t){return new Z(e,t)}function b(e,t){var i,o=e.drawingInfo.renderer,r={};switch(t.options.pane&&(r.pane=t.options.pane),e.drawingInfo.transparency&&(r.layerTransparency=e.drawingInfo.transparency),t.options.style&&(r.userDefinedStyle=t.options.style),o.type){case"classBreaks":if(S(e.geometryType,o,t),t._hasProportionalSymbols){t._createPointLayer();g(o,r).attachStylesToLayer(t._pointLayer),r.proportionalPolygon=!0}i=g(o,r);break;case"uniqueValue":console.log(o,r),i=m(o,r);break;default:i=v(o,r)}i.attachStylesToLayer(t)}function S(e,t,i){if(i._hasProportionalSymbols=!1,"esriGeometryPolygon"===e&&(t.backgroundFillSymbol&&(i._hasProportionalSymbols=!0),t.classBreakInfos&&t.classBreakInfos.length)){var o=t.classBreakInfos[0].symbol;!o||"esriSMS"!==o.type&&"esriPMS"!==o.type||(i._hasProportionalSymbols=!0)}}function I(e,t){return new ee(e,t)}function x(e,t){return new te(e,t)}function L(e,t){return new ie(e,t)}function M(e){return new oe(e)}function w(e,t){return new re(e,t)}function k(e){var t={position:[],offset:[]};return t.position=e.reverse(),t.offset=[20,20],t}function D(e){var t,i={position:[],offset:[]};return t=Math.round(e.length/2),i.position=e[t].reverse(),i.offset=[0,0],i}function N(e,t){var i={position:[],offset:[]};return i.position=e.getBounds().getCenter(),i.offset=[0,0],i}function T(e){var t=(""+e).replace(/\D/g,""),i=t.match(/^(\d{3})(\d{3})(\d{4})$/);return i?"("+i[1]+") "+i[2]+"-"+i[3]:null}function C(e){return o.format(e,"MM/DD/YYYY")}function z(e,t){var i=/\{([^\]]*)\}/g,o="",r="";void 0!==e.title&&(o=e.title),o=o.replace(i,function(o){for(var r=i.exec(o),n=t[r[1]],s=0;s<e.fieldInfos.length;s++)e.fieldInfos[s].fieldName===r[1]&&e.fieldInfos[s].format&&("shortDate"!==e.fieldInfos[s].format.dateFormat&&"shortDateShortTime"!==e.fieldInfos[s].format.dateFormat||(n=C(t[e.fieldInfos[s].fieldName])));return n}),r='<div class="leaflet-popup-content-title text-center"><h4>'+o+'</h4></div><div class="leaflet-popup-content-description" style="max-height:200px;overflow:auto;">';var n='<div style="font-weight:bold;color:#999;margin-top:5px;word-break:break-all;">',s='</div><p style="margin-top:0;margin-bottom:5px;word-break:break-all;">';if(void 0!==e.fieldInfos){for(var a=0;a<e.fieldInfos.length;a++)!0===e.fieldInfos[a].visible&&(null===t[e.fieldInfos[a].fieldName]?r+=n+e.fieldInfos[a].label+s+"none</p>":"URL"===e.fieldInfos[a].fieldName||"CODE_SEC_1"===e.fieldInfos[a].fieldName||"WEBSITE"===e.fieldInfos[a].fieldName||"FINAL_LINK_COPY"===e.fieldInfos[a].fieldName||"LINK"===e.fieldInfos[a].fieldName||"CODE_SECTION_LINK"===e.fieldInfos[a].fieldName?r+=n+e.fieldInfos[a].label+s+'<a target="_blank" href="'+t[e.fieldInfos[a].fieldName]+'">'+t[e.fieldInfos[a].fieldName]+"</a></p>":e.fieldInfos[a].fieldName.includes("EMAIL")?r+=n+e.fieldInfos[a].label+s+'<a href="mailto:'+t[e.fieldInfos[a].fieldName]+'">'+t[e.fieldInfos[a].fieldName]+"</a></p>":e.fieldInfos[a].fieldName.includes("PHONE")?r+=n+e.fieldInfos[a].label+s+T(t[e.fieldInfos[a].fieldName])+"</p>":e.fieldInfos[a].fieldName.includes("DATE")?r+=n+e.fieldInfos[a].label+s+C(t[e.fieldInfos[a].fieldName])+"</p>":e.fieldInfos[a].format&&("shortDate"===e.fieldInfos[a].format.dateFormat||"shortDateShortTime"===e.fieldInfos[a].format.dateFormat)?r+=n+e.fieldInfos[a].label+s+C(t[e.fieldInfos[a].fieldName])+"</p>":r+=n+e.fieldInfos[a].label+s+t[e.fieldInfos[a].fieldName]+"</p>");r+="</div>"}else if(void 0!==e.description){var l=e.description.replace(i,function(e){var o=i.exec(e);return t[o[1]]});r+=l+"</div>"}return r}function P(e,t,i,o,r){return J(e,t,i,o,r)}function J(e,i,o,r,n){var s,a,l,f,u=[],p=n+"-label";if("Feature Collection"===e.type||void 0!==e.featureCollection){o.createPane(p);var h,y;if(void 0===e.itemId)for(l=0,f=e.featureCollection.layers.length;l<f;l++)e.featureCollection.layers[l].featureSet.features.length>0&&(void 0!==e.featureCollection.layers[l].popupInfo&&null!==e.featureCollection.layers[l].popupInfo&&(h=e.featureCollection.layers[l].popupInfo),void 0!==e.featureCollection.layers[l].layerDefinition.drawingInfo.labelingInfo&&null!==e.featureCollection.layers[l].layerDefinition.drawingInfo.labelingInfo&&(y=e.featureCollection.layers[l].layerDefinition.drawingInfo.labelingInfo));a=t.featureGroup(u);var c=I(null,{data:e.itemId||e.featureCollection,opacity:e.opacity,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==c&&(h=c.popupInfo,y=c.labelingInfo),void 0!==h&&null!==h){var o=z(h,t.properties);i.feature.popupHtml=o}if(void 0!==y&&null!==y){var r,n=i.feature.geometry.coordinates;r="Point"===i.feature.geometry.type?k(n):"LineString"===i.feature.geometry.type?D(n):"MultiLineString"===i.feature.geometry.type?D(n[Math.round(n.length/2)]):N(i);var s=w(r.position,{zIndexOffset:1,properties:t.properties,labelingInfo:y,offset:r.offset,pane:p});a.addLayer(s)}}});return s=t.layerGroup([c,a]),i.push({type:"FC",title:e.title||"",layer:s}),s}if("ArcGISFeatureLayer"===e.layerType&&void 0!==e.layerDefinition){var d="1=1";if(void 0!==e.layerDefinition.drawingInfo){if("heatmap"===e.layerDefinition.drawingInfo.renderer.type){var _={};return e.layerDefinition.drawingInfo.renderer.colorStops.map(function(e){_[(Math.round(100*e.ratio)/100+6)/7]="rgb("+e.color[0]+","+e.color[1]+","+e.color[2]+")"}),s=t.esri.Heat.heatmapFeatureLayer({url:e.url,token:r.token||null,minOpacity:.5,max:e.layerDefinition.drawingInfo.renderer.maxPixelIntensity,blur:e.layerDefinition.drawingInfo.renderer.blurRadius,radius:1.3*e.layerDefinition.drawingInfo.renderer.blurRadius,gradient:_,pane:n}),i.push({type:"HL",title:e.title||"",layer:s}),s}var g=e.layerDefinition.drawingInfo;return g.transparency=100-100*e.opacity,void 0!==e.layerDefinition.definitionExpression&&(d=e.layerDefinition.definitionExpression),o.createPane(p),a=t.featureGroup(u),s=t.esri.featureLayer({url:e.url,where:d,token:r.token||null,drawingInfo:g,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var o=z(e.popupInfo,t.properties);i.feature.popupHtml=o}if(void 0!==e.layerDefinition.drawingInfo.labelingInfo&&null!==e.layerDefinition.drawingInfo.labelingInfo){var r,n=e.layerDefinition.drawingInfo.labelingInfo,s=i.feature.geometry.coordinates;r="Point"===i.feature.geometry.type?k(s):"LineString"===i.feature.geometry.type?D(s):"MultiLineString"===i.feature.geometry.type?D(s[Math.round(s.length/2)]):N(i);var l=w(r.position,{zIndexOffset:1,properties:t.properties,labelingInfo:n,offset:r.offset,pane:p});a.addLayer(l)}}}),s=t.layerGroup([s,a]),i.push({type:"FL",title:e.title||"",layer:s}),s}return void 0!==e.layerDefinition.definitionExpression&&(d=e.layerDefinition.definitionExpression),s=t.esri.featureLayer({url:e.url,token:r.token||null,where:d,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var o=z(e.popupInfo,t.properties);i.feature.popupHtml=o}}}),i.push({type:"FL",title:e.title||"",layer:s}),s}if("ArcGISFeatureLayer"===e.layerType)return s=t.esri.featureLayer({url:e.url,token:r.token||null,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var o=z(e.popupInfo,t.properties);i.feature.popupHtml=o}}}),i.push({type:"FL",title:e.title||"",layer:s}),s;if("CSV"===e.layerType)return a=t.featureGroup(u),s=x(null,{url:e.url,layerDefinition:e.layerDefinition,locationInfo:e.locationInfo,opacity:e.opacity,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var o=z(e.popupInfo,t.properties);i.feature.popupHtml=o}if(void 0!==e.layerDefinition.drawingInfo.labelingInfo&&null!==e.layerDefinition.drawingInfo.labelingInfo){var r,n=e.layerDefinition.drawingInfo.labelingInfo,s=i.feature.geometry.coordinates;r="Point"===i.feature.geometry.type?k(s):"LineString"===i.feature.geometry.type?D(s):"MultiLineString"===i.feature.geometry.type?D(s[Math.round(s.length/2)]):N(i);var l=w(r.position,{zIndexOffset:1,properties:t.properties,labelingInfo:n,offset:r.offset,pane:p});a.addLayer(l)}}}),s=t.layerGroup([s,a]),i.push({type:"CSV",title:e.title||"",layer:s}),s;if("KML"===e.layerType){a=t.featureGroup(u);var m=L(null,{url:e.url,opacity:e.opacity,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==m.popupInfo&&null!==m.popupInfo){var o=z(m.popupInfo,t.properties);i.feature.popupHtml=o}if(void 0!==m.labelingInfo&&null!==m.labelingInfo){var r,n=m.labelingInfo,s=i.feature.geometry.coordinates;r="Point"===i.feature.geometry.type?k(s):"LineString"===i.feature.geometry.type?D(s):"MultiLineString"===i.feature.geometry.type?D(s[Math.round(s.length/2)]):N(i);var l=w(r.position,{zIndexOffset:1,properties:t.properties,labelingInfo:n,offset:r.offset,pane:p});a.addLayer(l)}}});return s=t.layerGroup([m,a]),i.push({type:"KML",title:e.title||"",layer:s}),s}if("ArcGISImageServiceLayer"===e.layerType)return s=t.esri.imageMapLayer({url:e.url,token:r.token||null,pane:n,opacity:e.opacity||1}),i.push({type:"IML",title:e.title||"",layer:s}),s;if("ArcGISMapServiceLayer"===e.layerType)return s=t.esri.dynamicMapLayer({url:e.url,token:r.token||null,pane:n,opacity:e.opacity||1}),i.push({type:"DML",title:e.title||"",layer:s}),s;if("ArcGISTiledMapServiceLayer"===e.layerType){try{s=t.esri.basemapLayer(e.title)}catch(i){s=t.esri.tiledMapLayer({url:e.url,token:r.token||null}),t.esri.request(e.url,{},function(e,t){if(e)console.log(e);else{var i=o.getSize().x-55,r='<span class="esri-attributions" style="line-height:14px; vertical-align: -3px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; display:inline-block; max-width:'+i+'px;">'+t.copyrightText+"</span>";o.attributionControl.addAttribution(r)}})}return document.getElementsByClassName("leaflet-tile-pane")[0].style.opacity=e.opacity||1,i.push({type:"TML",title:e.title||"",layer:s}),s}if("VectorTileLayer"===e.layerType){var v={"World Street Map (with Relief)":"StreetsRelief","World Street Map (with Relief) (Mature Support)":"StreetsRelief","Hybrid Reference Layer":"Hybrid","Hybrid Reference Layer (Mature Support)":"Hybrid","World Street Map":"Streets","World Street Map (Mature Support)":"Streets","World Street Map (Night)":"StreetsNight","World Street Map (Night) (Mature Support)":"StreetsNight","Dark Gray Canvas":"DarkGray","Dark Gray Canvas (Mature Support)":"DarkGray","World Topographic Map":"Topographic","World Topographic Map (Mature Support)":"Topographic","World Navigation Map":"Navigation","World Navigation Map (Mature Support)":"Navigation","Light Gray Canvas":"Gray","Light Gray Canvas (Mature Support)":"Gray"};return v[e.title]?s=t.esri.Vector.basemap(v[e.title]):(console.error("Unsupported Vector Tile Layer: ",e),s=t.featureGroup([])),i.push({type:"VTL",title:e.title||e.id||"",layer:s}),s}if("OpenStreetMap"===e.layerType)return s=t.tileLayer("http://{s}.tile.osm.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'}),i.push({type:"TL",title:e.title||e.id||"",layer:s}),s;if("WebTiledLayer"===e.layerType){var b=V(e.templateUrl);return s=t.tileLayer(b,{attribution:e.copyright}),document.getElementsByClassName("leaflet-tile-pane")[0].style.opacity=e.opacity||1,i.push({type:"TL",title:e.title||e.id||"",layer:s}),s}if("WMS"===e.layerType){var S="";for(l=0,f=e.visibleLayers.length;l<f;l++)S+=e.visibleLayers[l],l<f-1&&(S+=",");return s=t.tileLayer.wms(e.url,{layers:String(S),format:"image/png",transparent:!0,attribution:e.copyright}),i.push({type:"WMS",title:e.title||e.id||"",layer:s}),s}return s=t.featureGroup([]),console.log("Unsupported Layer: ",e),s}function V(e){var t=e;return t=t.replace(/\{level}/g,"{z}"),t=t.replace(/\{col}/g,"{x}"),t=t.replace(/\{row}/g,"{y}")}function F(e,t){return new ne(e,t)}t="default"in t?t.default:t,i="default"in i?i.default:i;var O=t.Class.extend({initialize:function(e,t){this._symbolJson=e,this.val=null,this._styles={},this._isDefault=!1,this._layerTransparency=1,t&&t.layerTransparency&&(this._layerTransparency=1-t.layerTransparency/100)},pixelValue:function(e){return 1.333*e},colorValue:function(e){return"rgb("+e[0]+","+e[1]+","+e[2]+")"},alphaValue:function(e){return e[3]/255*this._layerTransparency},getSize:function(e,t){var i=e.properties,o=t.field,r=0,n=null;if(o){n=i[o];var s,a=t.minSize,l=t.maxSize,f=t.minDataValue,u=t.maxDataValue,p=t.normalizationField,h=i?parseFloat(i[p]):void 0;if(null===n||p&&(isNaN(h)||0===h))return null;isNaN(h)||(n/=h),null!==a&&null!==l&&null!==f&&null!==u&&(n<=f?r=a:n>=u?r=l:(s=(n-f)/(u-f),r=a+s*(l-a))),r=isNaN(r)?0:r}return r},getColor:function(e,t){if(!(e.properties&&t&&t.field&&t.stops))return null;var i,o,r,n,s=e.properties,a=s[t.field],l=t.normalizationField,f=s?parseFloat(s[l]):void 0;if(null===a||l&&(isNaN(f)||0===f))return null;if(isNaN(f)||(a/=f),a<=t.stops[0].value)return t.stops[0].color;var u=t.stops[t.stops.length-1];if(a>=u.value)return u.color;for(var p=0;p<t.stops.length;p++){var h=t.stops[p];if(h.value<=a)i=h.color,r=h.value;else if(h.value>a){o=h.color,n=h.value;break}}if(!isNaN(r)&&!isNaN(n)){var y=n-r;if(y>0){var c=(a-r)/y;if(c){var d=(n-a)/y;if(d){for(var _=[],g=0;g<4;g++)_[g]=Math.round(i[g]*d+o[g]*c);return _}return o}return i}}return null}}),G=t.Path.extend({initialize:function(e,i,o){t.setOptions(this,o),this._size=i,this._latlng=t.latLng(e),this._svgCanvasIncludes()},toGeoJSON:function(){return t.GeoJSON.getFeature(this,{type:"Point",coordinates:t.GeoJSON.latLngToCoords(this.getLatLng())})},_svgCanvasIncludes:function(){},_project:function(){this._point=this._map.latLngToLayerPoint(this._latlng)},_update:function(){this._map&&this._updatePath()},_updatePath:function(){},setLatLng:function(e){return this._latlng=t.latLng(e),this.redraw(),this.fire("move",{latlng:this._latlng})},getLatLng:function(){return this._latlng},setSize:function(e){return this._size=e,this.redraw()},getSize:function(){return this._size}}),E=G.extend({initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateCrossMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateCrossMarker:function(e){var t=e._point,i=e._size/2,o=this._ctx;o.beginPath(),o.moveTo(t.x,t.y+i),o.lineTo(t.x,t.y-i),this._fillStroke(o,e),o.moveTo(t.x-i,t.y),o.lineTo(t.x+i,t.y),this._fillStroke(o,e)}}),t.SVG.include({_updateCrossMarker:function(e){var i=e._point,o=e._size/2;t.Browser.vml&&(i._round(),o=Math.round(o));var r="M"+i.x+","+(i.y+o)+"L"+i.x+","+(i.y-o)+"M"+(i.x-o)+","+i.y+"L"+(i.x+o)+","+i.y;this._setPath(e,r)}})}}),j=function(e,t,i){return new E(e,t,i)},W=G.extend({initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateXMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateXMarker:function(e){var t=e._point,i=e._size/2,o=this._ctx;o.beginPath(),o.moveTo(t.x+i,t.y+i),o.lineTo(t.x-i,t.y-i),this._fillStroke(o,e)}}),t.SVG.include({_updateXMarker:function(e){var i=e._point,o=e._size/2;t.Browser.vml&&(i._round(),o=Math.round(o));var r="M"+(i.x+o)+","+(i.y+o)+"L"+(i.x-o)+","+(i.y-o)+"M"+(i.x-o)+","+(i.y+o)+"L"+(i.x+o)+","+(i.y-o);this._setPath(e,r)}})}}),B=function(e,t,i){return new W(e,t,i)},q=G.extend({options:{fill:!0},initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateSquareMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateSquareMarker:function(e){var t=e._point,i=e._size/2,o=this._ctx;o.beginPath(),o.moveTo(t.x+i,t.y+i),o.lineTo(t.x-i,t.y+i),o.lineTo(t.x-i,t.y-i),o.lineTo(t.x+i,t.y-i),o.closePath(),this._fillStroke(o,e)}}),t.SVG.include({_updateSquareMarker:function(e){var i=e._point,o=e._size/2;t.Browser.vml&&(i._round(),o=Math.round(o));var r="M"+(i.x+o)+","+(i.y+o)+"L"+(i.x-o)+","+(i.y+o)+"L"+(i.x-o)+","+(i.y-o)+"L"+(i.x+o)+","+(i.y-o);r+=t.Browser.svg?"z":"x",this._setPath(e,r)}})}}),R=function(e,t,i){return new q(e,t,i)},A=G.extend({options:{fill:!0},initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateDiamondMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateDiamondMarker:function(e){var t=e._point,i=e._size/2,o=this._ctx;o.beginPath(),o.moveTo(t.x,t.y+i),o.lineTo(t.x-i,t.y),o.lineTo(t.x,t.y-i),o.lineTo(t.x+i,t.y),o.closePath(),this._fillStroke(o,e)}}),t.SVG.include({_updateDiamondMarker:function(e){var i=e._point,o=e._size/2;t.Browser.vml&&(i._round(),o=Math.round(o));var r="M"+i.x+","+(i.y+o)+"L"+(i.x-o)+","+i.y+"L"+i.x+","+(i.y-o)+"L"+(i.x+o)+","+i.y;r+=t.Browser.svg?"z":"x",this._setPath(e,r)}})}}),H=function(e,t,i){return new A(e,t,i)},U=O.extend({statics:{MARKERTYPES:["esriSMSCircle","esriSMSCross","esriSMSDiamond","esriSMSSquare","esriSMSX","esriPMS"]},initialize:function(e,t){var i;if(O.prototype.initialize.call(this,e,t),t&&(this.serviceUrl=t.url),e)if("esriPMS"===e.type){var o=this._symbolJson.url;o&&"http://"===o.substr(0,7)||"https://"===o.substr(0,8)?(i=this.sanitize(o),this._iconUrl=i):(i=this.serviceUrl+"images/"+o,this._iconUrl=t&&t.token?i+"?token="+t.token:i),e.imageData&&(this._iconUrl="data:"+e.contentType+";base64,"+e.imageData),this._icons={},this.icon=this._createIcon(this._symbolJson)}else this._fillStyles()},sanitize:function(e){if(!e)return"";var t;try{t=e.replace(/<br>/gi,"\n"),t=t.replace(/<p.*>/gi,"\n"),t=t.replace(/<a.*href='(.*?)'.*>(.*?)<\/a>/gi," $2 ($1) "),t=t.replace(/<(?:.|\s)*?>/g,"")}catch(e){t=null}return t},_fillStyles:function(){this._symbolJson.outline&&this._symbolJson.size>0&&"esriSLSNull"!==this._symbolJson.outline.style?(this._styles.stroke=!0,this._styles.weight=this.pixelValue(this._symbolJson.outline.width),this._styles.color=this.colorValue(this._symbolJson.outline.color),this._styles.opacity=this.alphaValue(this._symbolJson.outline.color)):this._styles.stroke=!1,this._symbolJson.color?(this._styles.fillColor=this.colorValue(this._symbolJson.color),this._styles.fillOpacity=this.alphaValue(this._symbolJson.color)):this._styles.fillOpacity=0,"esriSMSCircle"===this._symbolJson.style&&(this._styles.radius=this.pixelValue(this._symbolJson.size)/2)},_createIcon:function(e){var i=this.pixelValue(e.width),o=i;e.height&&(o=this.pixelValue(e.height));var r=i/2,n=o/2;e.xoffset&&(r+=this.pixelValue(e.xoffset)),e.yoffset&&(n+=this.pixelValue(e.yoffset));var s=t.icon({iconUrl:this._iconUrl,iconSize:[i,o],iconAnchor:[r,n]});return this._icons[e.width.toString()]=s,s},_getIcon:function(e){var t=this._icons[e.toString()];return t||(t=this._createIcon({width:e})),t},pointToLayer:function(e,i,o,r){var n=this._symbolJson.size||this._symbolJson.width;if(!this._isDefault){if(o.sizeInfo){var s=this.getSize(e,o.sizeInfo);s&&(n=s)}if(o.colorInfo){var a=this.getColor(e,o.colorInfo);a&&(this._styles.fillColor=this.colorValue(a),this._styles.fillOpacity=this.alphaValue(a))}}if("esriPMS"===this._symbolJson.type){var l=t.extend({},{icon:this._getIcon(n)},r);return t.marker(i,l)}switch(n=this.pixelValue(n),this._symbolJson.style){case"esriSMSSquare":return R(i,n,t.extend({},this._styles,r));case"esriSMSDiamond":return H(i,n,t.extend({},this._styles,r));case"esriSMSCross":return j(i,n,t.extend({},this._styles,r));case"esriSMSX":return B(i,n,t.extend({},this._styles,r))}return this._styles.radius=n/2,t.circleMarker(i,t.extend({},this._styles,r))}}),Y=O.extend({statics:{LINETYPES:["esriSLSDash","esriSLSDot","esriSLSDashDotDot","esriSLSDashDot","esriSLSSolid"]},initialize:function(e,t){O.prototype.initialize.call(this,e,t),this._fillStyles()},_fillStyles:function(){if(this._styles.lineCap="butt",this._styles.lineJoin="miter",this._styles.fill=!1,this._styles.weight=0,!this._symbolJson)return this._styles;if(this._symbolJson.color&&(this._styles.color=this.colorValue(this._symbolJson.color),this._styles.opacity=this.alphaValue(this._symbolJson.color)),!isNaN(this._symbolJson.width)){this._styles.weight=this.pixelValue(this._symbolJson.width);var e=[];switch(this._symbolJson.style){case"esriSLSDash":e=[4,3];break;case"esriSLSDot":e=[1,3];break;case"esriSLSDashDot":e=[8,3,1,3];break;case"esriSLSDashDotDot":e=[8,3,1,3,1,3]}if(e.length>0){for(var t=0;t<e.length;t++)e[t]*=this._styles.weight;this._styles.dashArray=e.join(",")}}},style:function(e,t){if(!this._isDefault&&t){if(t.sizeInfo){var i=this.pixelValue(this.getSize(e,t.sizeInfo));i&&(this._styles.weight=i)}if(t.colorInfo){var o=this.getColor(e,t.colorInfo);o&&(this._styles.color=this.colorValue(o),this._styles.opacity=this.alphaValue(o))}}return this._styles}}),K=O.extend({statics:{POLYGONTYPES:["esriSFSSolid"]},initialize:function(e,t){O.prototype.initialize.call(this,e,t),e&&(e.outline&&"esriSLSNull"===e.outline.style?this._lineStyles={weight:0}:this._lineStyles=d(e.outline,t).style(),this._fillStyles())},_fillStyles:function(){if(this._lineStyles)if(0===this._lineStyles.weight)this._styles.stroke=!1;else for(var e in this._lineStyles)this._styles[e]=this._lineStyles[e];this._symbolJson&&(this._symbolJson.color&&K.POLYGONTYPES.indexOf(this._symbolJson.style>=0)?(this._styles.fill=!0,this._styles.fillColor=this.colorValue(this._symbolJson.color),this._styles.fillOpacity=this.alphaValue(this._symbolJson.color)):(this._styles.fill=!1,this._styles.fillOpacity=0))},style:function(e,t){if(!this._isDefault&&t&&t.colorInfo){var i=this.getColor(e,t.colorInfo);i&&(this._styles.fillColor=this.colorValue(i),this._styles.fillOpacity=this.alphaValue(i))}return this._styles}}),X=t.Class.extend({options:{proportionalPolygon:!1,clickable:!0},initialize:function(e,i){this._rendererJson=e,this._pointSymbols=!1,this._symbols=[],this._visualVariables=this._parseVisualVariables(e.visualVariables),t.Util.setOptions(this,i)},_parseVisualVariables:function(e){var t={};if(e)for(var i=0;i<e.length;i++)t[e[i].type]=e[i];return t},_createDefaultSymbol:function(){this._rendererJson.defaultSymbol&&(this._defaultSymbol=this._newSymbol(this._rendererJson.defaultSymbol),this._defaultSymbol._isDefault=!0)},_newSymbol:function(e){return"esriSMS"===e.type||"esriPMS"===e.type?(this._pointSymbols=!0,c(e,this.options)):"esriSLS"===e.type?d(e,this.options):"esriSFS"===e.type?_(e,this.options):void 0},_getSymbol:function(){},attachStylesToLayer:function(e){this._pointSymbols?e.options.pointToLayer=t.Util.bind(this.pointToLayer,this):(e.options.style=t.Util.bind(this.style,this),e._originalStyle=e.options.style)},pointToLayer:function(e,i){var o=this._getSymbol(e);return o&&o.pointToLayer?o.pointToLayer(e,i,this._visualVariables,this.options):t.circleMarker(i,{radius:0,opacity:0})},style:function(e){var t;this.options.userDefinedStyle&&(t=this.options.userDefinedStyle(e));var i=this._getSymbol(e);return i?this.mergeStyles(i.style(e,this._visualVariables),t):this.mergeStyles({opacity:0,fillOpacity:0},t)},mergeStyles:function(e,t){var i,o={};for(i in e)e.hasOwnProperty(i)&&(o[i]=e[i]);if(t)for(i in t)t.hasOwnProperty(i)&&(o[i]=t[i]);return o}}),$=X.extend({initialize:function(e,t){X.prototype.initialize.call(this,e,t),this._field=this._rendererJson.field,this._rendererJson.normalizationType&&"esriNormalizeByField"===this._rendererJson.normalizationType&&(this._normalizationField=this._rendererJson.normalizationField),this._createSymbols()},_createSymbols:function(){var e,t=this._rendererJson.classBreakInfos;this._symbols=[];for(var i=t.length-1;i>=0;i--)e=this.options.proportionalPolygon&&this._rendererJson.backgroundFillSymbol?this._newSymbol(this._rendererJson.backgroundFillSymbol):this._newSymbol(t[i].symbol),e.val=t[i].classMaxValue,this._symbols.push(e);this._symbols.sort(function(e,t){return e.val>t.val?1:-1}),this._createDefaultSymbol(),this._maxValue=this._symbols[this._symbols.length-1].val},_getSymbol:function(e){var t=e.properties[this._field];if(this._normalizationField){var i=e.properties[this._normalizationField];if(isNaN(i)||0===i)return this._defaultSymbol;t/=i}if(t>this._maxValue)return this._defaultSymbol;for(var o=this._symbols[0],r=this._symbols.length-1;r>=0&&!(t>this._symbols[r].val);r--)o=this._symbols[r];return o}}),Q=X.extend({initialize:function(e,t){X.prototype.initialize.call(this,e,t),this._field=this._rendererJson.field1,this._createSymbols()},_createSymbols:function(){for(var e,t=this._rendererJson.uniqueValueInfos,i=t.length-1;i>=0;i--)e=this._newSymbol(t[i].symbol),e.val=t[i].value,this._symbols.push(e);this._createDefaultSymbol()},_getSymbol:function(e){var t=e.properties[this._field];if(this._rendererJson.fieldDelimiter&&this._rendererJson.field2){var i=e.properties[this._rendererJson.field2];if(i){t+=this._rendererJson.fieldDelimiter+i;var o=e.properties[this._rendererJson.field3];o&&(t+=this._rendererJson.fieldDelimiter+o)}}for(var r=this._defaultSymbol,n=this._symbols.length-1;n>=0;n--)this._symbols[n].val==t&&(r=this._symbols[n]);return r}}),Z=X.extend({initialize:function(e,t){X.prototype.initialize.call(this,e,t),this._createSymbol()},_createSymbol:function(){this._rendererJson.symbol&&this._symbols.push(this._newSymbol(this._rendererJson.symbol))},_getSymbol:function(){return this._symbols[0]}}),ee=t.GeoJSON.extend({options:{data:{},opacity:1},initialize:function(e,i){t.setOptions(this,i),this.data=this.options.data,this.opacity=this.options.opacity,this.popupInfo=null,this.labelingInfo=null,this._layers={};var o,r;if(e)for(o=0,r=e.length;o<r;o++)this.addLayer(e[o]);"string"==typeof this.data?this._getFeatureCollection(this.data):this._parseFeatureCollection(this.data)},_getFeatureCollection:function(e){var i="https://www.arcgis.com/sharing/rest/content/items/"+e+"/data";t.esri.request(i,{},function(e,t){e?console.log(e):this._parseFeatureCollection(t)},this)},_parseFeatureCollection:function(e){var t,i,o=0;for(t=0,i=e.layers.length;t<i;t++)e.layers[t].featureSet.features.length>0&&(o=t);var r=e.layers[o].featureSet.features,n=e.layers[o].layerDefinition.geometryType,s=e.layers[o].layerDefinition.objectIdField,a=e.layers[o].layerDefinition||null;4326!==e.layers[o].layerDefinition.extent.spatialReference.wkid&&(102100!==e.layers[o].layerDefinition.extent.spatialReference.wkid&&console.error("[L.esri.WebMap] this wkid ("+e.layers[o].layerDefinition.extent.spatialReference.wkid+") is not supported."),r=this._projTo4326(r,n)),void 0!==e.layers[o].popupInfo&&(this.popupInfo=e.layers[o].popupInfo),void 0!==e.layers[o].layerDefinition.drawingInfo.labelingInfo&&(this.labelingInfo=e.layers[o].layerDefinition.drawingInfo.labelingInfo),console.log(e);var l=this._featureCollectionToGeoJSON(r,s);null!==a&&b(a,this),console.log(l),this.addData(l)},_projTo4326:function(e,i){console.log("_project!");var o,r,n=[];for(o=0,r=e.length;o<r;o++){var s,a,l,f=e[o];if("esriGeometryPoint"===i)s=t.Projection.SphericalMercator.unproject(t.point(f.geometry.x,f.geometry.y)),f.geometry.x=s.lng,f.geometry.y=s.lat;else if("esriGeometryMultipoint"===i){var u;for(a=0,u=f.geometry.points.length;a<u;a++)s=t.Projection.SphericalMercator.unproject(t.point(f.geometry.points[a][0],f.geometry.points[a][1])),f.geometry.points[a][0]=s.lng,f.geometry.points[a][1]=s.lat}else if("esriGeometryPolyline"===i){var p,h;for(a=0,h=f.geometry.paths.length;a<h;a++)for(l=0,p=f.geometry.paths[a].length;l<p;l++)s=t.Projection.SphericalMercator.unproject(t.point(f.geometry.paths[a][l][0],f.geometry.paths[a][l][1])),f.geometry.paths[a][l][0]=s.lng,f.geometry.paths[a][l][1]=s.lat}else if("esriGeometryPolygon"===i){var y,c;for(a=0,c=f.geometry.rings.length;a<c;a++)for(l=0,y=f.geometry.rings[a].length;l<y;l++)s=t.Projection.SphericalMercator.unproject(t.point(f.geometry.rings[a][l][0],f.geometry.rings[a][l][1])),f.geometry.rings[a][l][0]=s.lng,f.geometry.rings[a][l][1]=s.lat}n.push(f)}return n},_featureCollectionToGeoJSON:function(e,t){var i,o,r={type:"FeatureCollection",features:[]},n=[];for(i=0,o=e.length;i<o;i++){var s=y(e[i],t);n.push(s)}return r.features=n,r}}),te=t.GeoJSON.extend({options:{url:"",data:{},opacity:1},initialize:function(e,i){t.setOptions(this,i),this.url=this.options.url,this.layerDefinition=this.options.layerDefinition,this.locationInfo=this.options.locationInfo,this.opacity=this.options.opacity,this._layers={};var o,r;if(e)for(o=0,r=e.length;o<r;o++)this.addLayer(e[o]);this._parseCSV(this.url,this.layerDefinition,this.locationInfo)},_parseCSV:function(e,t,o){i.csv(e,{latfield:o.latitudeFieldName,lonfield:o.longitudeFieldName},this),b(t,this)}}),ie=t.GeoJSON.extend({options:{opacity:1,url:""},initialize:function(e,i){t.setOptions(this,i),this.url=this.options.url,this.opacity=this.options.opacity,this.popupInfo=null,this.labelingInfo=null,this._layers={};var o,r;if(e)for(o=0,r=e.length;o<r;o++)this.addLayer(e[o]);this._getKML(this.url)},_getKML:function(e){var i="http://utility.arcgis.com/sharing/kml?url="+e+'&model=simple&folders=&outSR=%7B"wkid"%3A4326%7D';t.esri.request(i,{},function(e,t){e?console.log(e):(console.log(t),this._parseFeatureCollection(t.featureCollection))},this)},_parseFeatureCollection:function(e){console.log("_parseFeatureCollection");var t;for(t=0;t<3;t++)if(e.layers[t].featureSet.features.length>0){console.log(t);var i=e.layers[t].featureSet.features,o=e.layers[t].layerDefinition.objectIdField,r=this._featureCollectionToGeoJSON(i,o);void 0!==e.layers[t].popupInfo&&(this.popupInfo=e.layers[t].popupInfo),void 0!==e.layers[t].layerDefinition.drawingInfo.labelingInfo&&(this.labelingInfo=e.layers[t].layerDefinition.drawingInfo.labelingInfo),b(e.layers[t].layerDefinition,this),console.log(r),this.addData(r)}},
_featureCollectionToGeoJSON:function(e,t){var i,o,r={type:"FeatureCollection",features:[]},n=[];for(i=0,o=e.length;i<o;i++){var s=y(e[i],t);n.push(s)}return r.features=n,r}}),oe=t.DivIcon.extend({options:{iconSize:null,className:"esri-leaflet-webmap-labels",text:""},createIcon:function(e){var i=e&&"DIV"===e.tagName?e:document.createElement("div"),o=this.options;if(i.innerHTML='<div style="position: relative; left: -50%; text-shadow: 1px 1px 0px #fff, -1px 1px 0px #fff, 1px -1px 0px #fff, -1px -1px 0px #fff;">'+o.text+"</div>",i.style.fontSize="1em",i.style.fontWeight="bold",i.style.textTransform="uppercase",i.style.textAlign="center",i.style.whiteSpace="nowrap",o.bgPos){var r=t.point(o.bgPos);i.style.backgroundPosition=-r.x+"px "+-r.y+"px"}return this._setIconStyles(i,"icon"),i}}),re=t.Marker.extend({options:{properties:{},labelingInfo:{},offset:[0,0]},initialize:function(e,i){t.setOptions(this,i),this._latlng=t.latLng(e);var o=this._createLabelText(this.options.properties,this.options.labelingInfo);this._setLabelIcon(o,this.options.offset)},_createLabelText:function(e,t){var i=/\[([^\]]*)\]/g,o=t[0].labelExpression;return o=o.replace(i,function(t){var o=i.exec(t);return e[o[1]]})},_setLabelIcon:function(e,t){var i=M({text:e,iconAnchor:t});this.setIcon(i)}}),ne=t.Evented.extend({options:{map:{},token:null,server:"www.arcgis.com"},initialize:function(e,i){t.setOptions(this,i),this._map=this.options.map,this._token=this.options.token,this._server=this.options.server,this._webmapId=e,this._loaded=!1,this._metadataLoaded=!1,this._loadedLayersNum=0,this._layersNum=0,this.layers=[],this.title="",this.bookmarks=[],this.portalItem={},this.VERSION="0.4.0",this._loadWebMapMetaData(e),this._loadWebMap(e)},_checkLoaded:function(){++this._loadedLayersNum===this._layersNum&&(this._loaded=!0,this.fire("load"))},_operationalLayer:function(e,t,i,o,r){var n=P(e,t,i,o,r);void 0!==n&&!0===e.visibility&&n.addTo(i)},_loadWebMapMetaData:function(e){var i={},o=this._map,r=this,n="https://"+this._server+"/sharing/rest/content/items/"+e;this._token&&this._token.length>0&&(i.token=this._token),t.esri.request(n,i,function(e,t){e?console.log(e):(r.portalItem=t,r.title=t.title,r._metadataLoaded=!0,r.fire("metadataLoad"),o.fitBounds([t.extent[0].reverse(),t.extent[1].reverse()]))})},_loadWebMap:function(e){var i=this._map,o=this.layers,r=this._server,n={},s="https://"+r+"/sharing/rest/content/items/"+e+"/data";this._token&&this._token.length>0&&(n.token=this._token),t.esri.request(s,n,function(e,s){e?console.log("L.esri.request error:",e):(this._layersNum=s.baseMap.baseMapLayers.length+s.operationalLayers.length,s.baseMap.baseMapLayers.map(function(s){if(void 0!==s.itemId){var a="https://"+r+"/sharing/rest/content/items/"+s.itemId;t.esri.request(a,n,function(t,r){t?console.error(e):(console.log(r.access),"public"!==r.access?this._operationalLayer(s,o,i,n):this._operationalLayer(s,o,i,{})),this._checkLoaded()},this)}else this._operationalLayer(s,o,i,{}),this._checkLoaded()}.bind(this)),s.operationalLayers.map(function(s,a){var l="esri-webmap-layer"+a;if(i.createPane(l),void 0!==s.itemId){var f="https://"+r+"/sharing/rest/content/items/"+s.itemId;t.esri.request(f,n,function(t,r){t?console.error(e):(console.log(r.access),"public"!==r.access?this._operationalLayer(s,o,i,n,l):this._operationalLayer(s,o,i,{},l)),this._checkLoaded()},this)}else this._operationalLayer(s,o,i,{},l),this._checkLoaded()}.bind(this)),void 0!==s.bookmarks&&s.bookmarks.length>0&&s.bookmarks.map(function(e){var i=t.Projection.SphericalMercator.unproject(t.point(e.extent.xmax,e.extent.ymax)),o=t.Projection.SphericalMercator.unproject(t.point(e.extent.xmin,e.extent.ymin)),r=t.latLngBounds(o,i);this.bookmarks.push({name:e.name,bounds:r})}.bind(this)))}.bind(this))}});e.WebMap=ne,e.webMap=F,e.operationalLayer=P,e.FeatureCollection=ee,e.featureCollection=I,e.LabelMarker=re,e.labelMarker=w,e.LabelIcon=oe,e.labelIcon=M,e.createPopupContent=z,Object.defineProperty(e,"__esModule",{value:!0})});
//# sourceMappingURL=esri-leaflet-webmap.js.map