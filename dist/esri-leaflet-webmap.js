/* esri-leaflet-webmap - v0.4.0 - Fri Mar 08 2019 13:02:37 GMT-0500 (Eastern Standard Time)
 * Copyright (c) 2019 Yusuke Nunokawa <ynunokawa.dev@gmail.com>
 * MIT */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports,require("leaflet"),require("leaflet-omnivore"),require("date-fns")):"function"==typeof define&&define.amd?define(["exports","leaflet","leaflet-omnivore","date-fns"],t):t((e.L=e.L||{},e.L.esri=e.L.esri||{}),e.L,e.omnivore,e.datefns)}(this,function(e,t,i,r){"use strict";function o(e,t){for(var i=0;i<e.length;i++)if(e[i]!==t[i])return!1;return!0}function n(e){return o(e[0],e[e.length-1])||e.push(e[0]),e}function s(e){var t,i=0,r=0,o=e.length,n=e[r];for(r;r<o-1;r++)t=e[r+1],i+=(t[0]-n[0])*(t[1]+n[1]),n=t;return i>=0}function a(e,t,i,r){var o=(r[0]-i[0])*(e[1]-i[1])-(r[1]-i[1])*(e[0]-i[0]),n=(t[0]-e[0])*(e[1]-i[1])-(t[1]-e[1])*(e[0]-i[0]),s=(r[1]-i[1])*(t[0]-e[0])-(r[0]-i[0])*(t[1]-e[1]);if(0!==s){var a=o/s,l=n/s;if(a>=0&&a<=1&&l>=0&&l<=1)return!0}return!1}function l(e,t){for(var i=0;i<e.length-1;i++)for(var r=0;r<t.length-1;r++)if(a(e[i],e[i+1],t[r],t[r+1]))return!0;return!1}function u(e,t){for(var i=!1,r=-1,o=e.length,n=o-1;++r<o;n=r)(e[r][1]<=t[1]&&t[1]<e[n][1]||e[n][1]<=t[1]&&t[1]<e[r][1])&&t[0]<(e[n][0]-e[r][0])*(t[1]-e[r][1])/(e[n][1]-e[r][1])+e[r][0]&&(i=!i);return i}function f(e,t){var i=l(e,t),r=u(e,t[0]);return!(i||!r)}function p(e){for(var t,i,r,o=[],a=[],u=0;u<e.length;u++){var p=n(e[u].slice(0));if(!(p.length<4))if(s(p)){var h=[p];o.push(h)}else a.push(p)}for(var y=[];a.length;){r=a.pop();var c=!1;for(t=o.length-1;t>=0;t--)if(i=o[t][0],f(i,r)){o[t].push(r),c=!0;break}c||y.push(r)}for(;y.length;){r=y.pop();var d=!1;for(t=o.length-1;t>=0;t--)if(i=o[t][0],l(i,r)){o[t].push(r),d=!0;break}d||o.push([r.reverse()])}return 1===o.length?{type:"Polygon",coordinates:o[0]}:{type:"MultiPolygon",coordinates:o}}function h(e){var t={};for(var i in e)e.hasOwnProperty(i)&&(t[i]=e[i]);return t}function y(e,t){var i={};return"number"==typeof e.x&&"number"==typeof e.y&&(i.type="Point",i.coordinates=[e.x,e.y]),e.points&&(i.type="MultiPoint",i.coordinates=e.points.slice(0)),e.paths&&(1===e.paths.length?(i.type="LineString",i.coordinates=e.paths[0].slice(0)):(i.type="MultiLineString",i.coordinates=e.paths.slice(0))),e.rings&&(i=p(e.rings.slice(0))),(e.geometry||e.attributes)&&(i.type="Feature",i.geometry=e.geometry?y(e.geometry):null,i.properties=e.attributes?h(e.attributes):null,e.attributes&&(i.id=e.attributes[t]||e.attributes.OBJECTID||e.attributes.FID)),JSON.stringify(i.geometry)===JSON.stringify({})&&(i.geometry=null),i}function c(e,t){return new U(e,t)}function d(e,t){return new Y(e,t)}function _(e,t){return new K(e,t)}function g(e,t){return new $(e,t)}function m(e,t){return new Q(e,t)}function v(e,t){return new Z(e,t)}function b(e,t){var i,r=e.drawingInfo.renderer,o={};switch(t.options.pane&&(o.pane=t.options.pane),e.drawingInfo.transparency&&(o.layerTransparency=e.drawingInfo.transparency),t.options.style&&(o.userDefinedStyle=t.options.style),r.type){case"classBreaks":if(S(e.geometryType,r,t),t._hasProportionalSymbols){t._createPointLayer();g(r,o).attachStylesToLayer(t._pointLayer),o.proportionalPolygon=!0}i=g(r,o);break;case"uniqueValue":console.log(r,o),i=m(r,o);break;default:i=v(r,o)}i.attachStylesToLayer(t)}function S(e,t,i){if(i._hasProportionalSymbols=!1,"esriGeometryPolygon"===e&&(t.backgroundFillSymbol&&(i._hasProportionalSymbols=!0),t.classBreakInfos&&t.classBreakInfos.length)){var r=t.classBreakInfos[0].symbol;!r||"esriSMS"!==r.type&&"esriPMS"!==r.type||(i._hasProportionalSymbols=!0)}}function I(e,t){return new ee(e,t)}function x(e,t){return new te(e,t)}function L(e,t){return new ie(e,t)}function M(e){return new re(e)}function w(e,t){return new oe(e,t)}function k(e){var t={position:[],offset:[]};return t.position=e.reverse(),t.offset=[20,20],t}function D(e){var t,i={position:[],offset:[]};return t=Math.round(e.length/2),i.position=e[t].reverse(),i.offset=[0,0],i}function N(e,t){var i={position:[],offset:[]};return i.position=e.getBounds().getCenter(),i.offset=[0,0],i}function T(e){var t=(""+e).replace(/\D/g,""),i=t.match(/^(\d{3})(\d{3})(\d{4})$/);return i?"("+i[1]+") "+i[2]+"-"+i[3]:null}function C(e){return r.format(e,"MM/DD/YYYY")}function z(e,t){var i=/\{([^\]]*)\}/g,r="",o="";void 0!==e.title&&(r=e.title),r=r.replace(i,function(e){var r=i.exec(e);return t[r[1]]}),o='<div class="leaflet-popup-content-title text-center"><h4>'+r+'</h4></div><div class="leaflet-popup-content-description" style="max-height:200px;overflow:auto;">';var n='<div style="font-weight:bold;color:#999;margin-top:5px;word-break:break-all;">',s='</div><p style="margin-top:0;margin-bottom:5px;word-break:break-all;">';if(void 0!==e.fieldInfos){for(var a=0;a<e.fieldInfos.length;a++)!0===e.fieldInfos[a].visible&&(null===t[e.fieldInfos[a].fieldName]?o+=n+e.fieldInfos[a].label+s+"none</p>":"URL"===e.fieldInfos[a].fieldName||"CODE_SEC_1"===e.fieldInfos[a].fieldName||"WEBSITE"===e.fieldInfos[a].fieldName||"FINAL_LINK_COPY"===e.fieldInfos[a].fieldName||"LINK"===e.fieldInfos[a].fieldName||"CODE_SECTION_LINK"===e.fieldInfos[a].fieldName?o+=n+e.fieldInfos[a].label+s+'<a target="_blank" href="'+t[e.fieldInfos[a].fieldName]+'">'+t[e.fieldInfos[a].fieldName]+"</a></p>":e.fieldInfos[a].fieldName.includes("EMAIL")?o+=n+e.fieldInfos[a].label+s+'<a href="mailto:'+t[e.fieldInfos[a].fieldName]+'">'+t[e.fieldInfos[a].fieldName]+"</a></p>":e.fieldInfos[a].fieldName.includes("PHONE")?o+=n+e.fieldInfos[a].label+s+T(t[e.fieldInfos[a].fieldName])+"</p>":e.fieldInfos[a].fieldName.includes("DATE")?o+=n+e.fieldInfos[a].label+s+C(t[e.fieldInfos[a].fieldName])+"</p>":o+=n+e.fieldInfos[a].label+s+t[e.fieldInfos[a].fieldName]+"</p>");o+="</div>"}else if(void 0!==e.description){var l=e.description.replace(i,function(e){var r=i.exec(e);return t[r[1]]});o+=l+"</div>"}return o}function P(e,t,i,r,o){return J(e,t,i,r,o)}function J(e,i,r,o,n){var s,a,l,u,f=[],p=n+"-label";if("Feature Collection"===e.type||void 0!==e.featureCollection){r.createPane(p);var h,y;if(void 0===e.itemId)for(l=0,u=e.featureCollection.layers.length;l<u;l++)e.featureCollection.layers[l].featureSet.features.length>0&&(void 0!==e.featureCollection.layers[l].popupInfo&&null!==e.featureCollection.layers[l].popupInfo&&(h=e.featureCollection.layers[l].popupInfo),void 0!==e.featureCollection.layers[l].layerDefinition.drawingInfo.labelingInfo&&null!==e.featureCollection.layers[l].layerDefinition.drawingInfo.labelingInfo&&(y=e.featureCollection.layers[l].layerDefinition.drawingInfo.labelingInfo));a=t.featureGroup(f);var c=I(null,{data:e.itemId||e.featureCollection,opacity:e.opacity,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==c&&(h=c.popupInfo,y=c.labelingInfo),void 0!==h&&null!==h){var r=z(h,t.properties);i.feature.popupHtml=r}if(void 0!==y&&null!==y){var o,n=i.feature.geometry.coordinates;o="Point"===i.feature.geometry.type?k(n):"LineString"===i.feature.geometry.type?D(n):"MultiLineString"===i.feature.geometry.type?D(n[Math.round(n.length/2)]):N(i);var s=w(o.position,{zIndexOffset:1,properties:t.properties,labelingInfo:y,offset:o.offset,pane:p});a.addLayer(s)}}});return s=t.layerGroup([c,a]),i.push({type:"FC",title:e.title||"",layer:s}),s}if("ArcGISFeatureLayer"===e.layerType&&void 0!==e.layerDefinition){var d="1=1";if(void 0!==e.layerDefinition.drawingInfo){if("heatmap"===e.layerDefinition.drawingInfo.renderer.type){var _={};return e.layerDefinition.drawingInfo.renderer.colorStops.map(function(e){_[(Math.round(100*e.ratio)/100+6)/7]="rgb("+e.color[0]+","+e.color[1]+","+e.color[2]+")"}),s=t.esri.Heat.heatmapFeatureLayer({url:e.url,token:o.token||null,minOpacity:.5,max:e.layerDefinition.drawingInfo.renderer.maxPixelIntensity,blur:e.layerDefinition.drawingInfo.renderer.blurRadius,radius:1.3*e.layerDefinition.drawingInfo.renderer.blurRadius,gradient:_,pane:n}),i.push({type:"HL",title:e.title||"",layer:s}),s}var g=e.layerDefinition.drawingInfo;return g.transparency=100-100*e.opacity,void 0!==e.layerDefinition.definitionExpression&&(d=e.layerDefinition.definitionExpression),r.createPane(p),a=t.featureGroup(f),s=t.esri.featureLayer({url:e.url,where:d,token:o.token||null,drawingInfo:g,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var r=z(e.popupInfo,t.properties);i.feature.popupHtml=r}if(void 0!==e.layerDefinition.drawingInfo.labelingInfo&&null!==e.layerDefinition.drawingInfo.labelingInfo){var o,n=e.layerDefinition.drawingInfo.labelingInfo,s=i.feature.geometry.coordinates;o="Point"===i.feature.geometry.type?k(s):"LineString"===i.feature.geometry.type?D(s):"MultiLineString"===i.feature.geometry.type?D(s[Math.round(s.length/2)]):N(i);var l=w(o.position,{zIndexOffset:1,properties:t.properties,labelingInfo:n,offset:o.offset,pane:p});a.addLayer(l)}}}),s=t.layerGroup([s,a]),i.push({type:"FL",title:e.title||"",layer:s}),s}return void 0!==e.layerDefinition.definitionExpression&&(d=e.layerDefinition.definitionExpression),s=t.esri.featureLayer({url:e.url,token:o.token||null,where:d,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var r=z(e.popupInfo,t.properties);i.feature.popupHtml=r}}}),i.push({type:"FL",title:e.title||"",layer:s}),s}if("ArcGISFeatureLayer"===e.layerType)return s=t.esri.featureLayer({url:e.url,token:o.token||null,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var r=z(e.popupInfo,t.properties);i.feature.popupHtml=r}}}),i.push({type:"FL",title:e.title||"",layer:s}),s;if("CSV"===e.layerType)return a=t.featureGroup(f),s=x(null,{url:e.url,layerDefinition:e.layerDefinition,locationInfo:e.locationInfo,opacity:e.opacity,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==e.popupInfo){var r=z(e.popupInfo,t.properties);i.feature.popupHtml=r}if(void 0!==e.layerDefinition.drawingInfo.labelingInfo&&null!==e.layerDefinition.drawingInfo.labelingInfo){var o,n=e.layerDefinition.drawingInfo.labelingInfo,s=i.feature.geometry.coordinates;o="Point"===i.feature.geometry.type?k(s):"LineString"===i.feature.geometry.type?D(s):"MultiLineString"===i.feature.geometry.type?D(s[Math.round(s.length/2)]):N(i);var l=w(o.position,{zIndexOffset:1,properties:t.properties,labelingInfo:n,offset:o.offset,pane:p});a.addLayer(l)}}}),s=t.layerGroup([s,a]),i.push({type:"CSV",title:e.title||"",layer:s}),s;if("KML"===e.layerType){a=t.featureGroup(f);var m=L(null,{url:e.url,opacity:e.opacity,pane:n,onEachFeature:function(t,i){if(i.feature.layerName=e.title.split("_")[1],void 0!==m.popupInfo&&null!==m.popupInfo){var r=z(m.popupInfo,t.properties);i.feature.popupHtml=r}if(void 0!==m.labelingInfo&&null!==m.labelingInfo){var o,n=m.labelingInfo,s=i.feature.geometry.coordinates;o="Point"===i.feature.geometry.type?k(s):"LineString"===i.feature.geometry.type?D(s):"MultiLineString"===i.feature.geometry.type?D(s[Math.round(s.length/2)]):N(i);var l=w(o.position,{zIndexOffset:1,properties:t.properties,labelingInfo:n,offset:o.offset,pane:p});a.addLayer(l)}}});return s=t.layerGroup([m,a]),i.push({type:"KML",title:e.title||"",layer:s}),s}if("ArcGISImageServiceLayer"===e.layerType)return s=t.esri.imageMapLayer({url:e.url,token:o.token||null,pane:n,opacity:e.opacity||1}),i.push({type:"IML",title:e.title||"",layer:s}),s;if("ArcGISMapServiceLayer"===e.layerType)return s=t.esri.dynamicMapLayer({url:e.url,token:o.token||null,pane:n,opacity:e.opacity||1}),i.push({type:"DML",title:e.title||"",layer:s}),s;if("ArcGISTiledMapServiceLayer"===e.layerType){try{s=t.esri.basemapLayer(e.title)}catch(i){s=t.esri.tiledMapLayer({url:e.url,token:o.token||null}),t.esri.request(e.url,{},function(e,t){if(e)console.log(e);else{var i=r.getSize().x-55,o='<span class="esri-attributions" style="line-height:14px; vertical-align: -3px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; display:inline-block; max-width:'+i+'px;">'+t.copyrightText+"</span>";r.attributionControl.addAttribution(o)}})}return document.getElementsByClassName("leaflet-tile-pane")[0].style.opacity=e.opacity||1,i.push({type:"TML",title:e.title||"",layer:s}),s}if("VectorTileLayer"===e.layerType){var v={"World Street Map (with Relief)":"StreetsRelief","World Street Map (with Relief) (Mature Support)":"StreetsRelief","Hybrid Reference Layer":"Hybrid","Hybrid Reference Layer (Mature Support)":"Hybrid","World Street Map":"Streets","World Street Map (Mature Support)":"Streets","World Street Map (Night)":"StreetsNight","World Street Map (Night) (Mature Support)":"StreetsNight","Dark Gray Canvas":"DarkGray","Dark Gray Canvas (Mature Support)":"DarkGray","World Topographic Map":"Topographic","World Topographic Map (Mature Support)":"Topographic","World Navigation Map":"Navigation","World Navigation Map (Mature Support)":"Navigation","Light Gray Canvas":"Gray","Light Gray Canvas (Mature Support)":"Gray"};return v[e.title]?s=t.esri.Vector.basemap(v[e.title]):(console.error("Unsupported Vector Tile Layer: ",e),s=t.featureGroup([])),i.push({type:"VTL",title:e.title||e.id||"",layer:s}),s}if("OpenStreetMap"===e.layerType)return s=t.tileLayer("http://{s}.tile.osm.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'}),i.push({type:"TL",title:e.title||e.id||"",layer:s}),s;if("WebTiledLayer"===e.layerType){var b=V(e.templateUrl);return s=t.tileLayer(b,{attribution:e.copyright}),document.getElementsByClassName("leaflet-tile-pane")[0].style.opacity=e.opacity||1,i.push({type:"TL",title:e.title||e.id||"",layer:s}),s}if("WMS"===e.layerType){var S="";for(l=0,u=e.visibleLayers.length;l<u;l++)S+=e.visibleLayers[l],l<u-1&&(S+=",");return s=t.tileLayer.wms(e.url,{layers:String(S),format:"image/png",transparent:!0,attribution:e.copyright}),i.push({type:"WMS",title:e.title||e.id||"",layer:s}),s}return s=t.featureGroup([]),console.log("Unsupported Layer: ",e),s}function V(e){var t=e;return t=t.replace(/\{level}/g,"{z}"),t=t.replace(/\{col}/g,"{x}"),t=t.replace(/\{row}/g,"{y}")}function O(e,t){return new ne(e,t)}t="default"in t?t.default:t,i="default"in i?i.default:i;var F=t.Class.extend({initialize:function(e,t){this._symbolJson=e,this.val=null,this._styles={},this._isDefault=!1,this._layerTransparency=1,t&&t.layerTransparency&&(this._layerTransparency=1-t.layerTransparency/100)},pixelValue:function(e){return 1.333*e},colorValue:function(e){return"rgb("+e[0]+","+e[1]+","+e[2]+")"},alphaValue:function(e){return e[3]/255*this._layerTransparency},getSize:function(e,t){var i=e.properties,r=t.field,o=0,n=null;if(r){n=i[r];var s,a=t.minSize,l=t.maxSize,u=t.minDataValue,f=t.maxDataValue,p=t.normalizationField,h=i?parseFloat(i[p]):void 0;if(null===n||p&&(isNaN(h)||0===h))return null;isNaN(h)||(n/=h),null!==a&&null!==l&&null!==u&&null!==f&&(n<=u?o=a:n>=f?o=l:(s=(n-u)/(f-u),o=a+s*(l-a))),o=isNaN(o)?0:o}return o},getColor:function(e,t){if(!(e.properties&&t&&t.field&&t.stops))return null;var i,r,o,n,s=e.properties,a=s[t.field],l=t.normalizationField,u=s?parseFloat(s[l]):void 0;if(null===a||l&&(isNaN(u)||0===u))return null;if(isNaN(u)||(a/=u),a<=t.stops[0].value)return t.stops[0].color;var f=t.stops[t.stops.length-1];if(a>=f.value)return f.color;for(var p=0;p<t.stops.length;p++){var h=t.stops[p];if(h.value<=a)i=h.color,o=h.value;else if(h.value>a){r=h.color,n=h.value;break}}if(!isNaN(o)&&!isNaN(n)){var y=n-o;if(y>0){var c=(a-o)/y;if(c){var d=(n-a)/y;if(d){for(var _=[],g=0;g<4;g++)_[g]=Math.round(i[g]*d+r[g]*c);return _}return r}return i}}return null}}),G=t.Path.extend({initialize:function(e,i,r){t.setOptions(this,r),this._size=i,this._latlng=t.latLng(e),this._svgCanvasIncludes()},toGeoJSON:function(){return t.GeoJSON.getFeature(this,{type:"Point",coordinates:t.GeoJSON.latLngToCoords(this.getLatLng())})},_svgCanvasIncludes:function(){},_project:function(){this._point=this._map.latLngToLayerPoint(this._latlng)},_update:function(){this._map&&this._updatePath()},_updatePath:function(){},setLatLng:function(e){return this._latlng=t.latLng(e),this.redraw(),this.fire("move",{latlng:this._latlng})},getLatLng:function(){return this._latlng},setSize:function(e){return this._size=e,this.redraw()},getSize:function(){return this._size}}),E=G.extend({initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateCrossMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateCrossMarker:function(e){var t=e._point,i=e._size/2,r=this._ctx;r.beginPath(),r.moveTo(t.x,t.y+i),r.lineTo(t.x,t.y-i),this._fillStroke(r,e),r.moveTo(t.x-i,t.y),r.lineTo(t.x+i,t.y),this._fillStroke(r,e)}}),t.SVG.include({_updateCrossMarker:function(e){var i=e._point,r=e._size/2;t.Browser.vml&&(i._round(),r=Math.round(r));var o="M"+i.x+","+(i.y+r)+"L"+i.x+","+(i.y-r)+"M"+(i.x-r)+","+i.y+"L"+(i.x+r)+","+i.y;this._setPath(e,o)}})}}),j=function(e,t,i){return new E(e,t,i)},W=G.extend({initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateXMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateXMarker:function(e){var t=e._point,i=e._size/2,r=this._ctx;r.beginPath(),r.moveTo(t.x+i,t.y+i),r.lineTo(t.x-i,t.y-i),this._fillStroke(r,e)}}),t.SVG.include({_updateXMarker:function(e){var i=e._point,r=e._size/2;t.Browser.vml&&(i._round(),r=Math.round(r));var o="M"+(i.x+r)+","+(i.y+r)+"L"+(i.x-r)+","+(i.y-r)+"M"+(i.x-r)+","+(i.y+r)+"L"+(i.x+r)+","+(i.y-r);this._setPath(e,o)}})}}),B=function(e,t,i){return new W(e,t,i)},q=G.extend({options:{fill:!0},initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateSquareMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateSquareMarker:function(e){var t=e._point,i=e._size/2,r=this._ctx;r.beginPath(),r.moveTo(t.x+i,t.y+i),r.lineTo(t.x-i,t.y+i),r.lineTo(t.x-i,t.y-i),r.lineTo(t.x+i,t.y-i),r.closePath(),this._fillStroke(r,e)}}),t.SVG.include({_updateSquareMarker:function(e){var i=e._point,r=e._size/2;t.Browser.vml&&(i._round(),r=Math.round(r));var o="M"+(i.x+r)+","+(i.y+r)+"L"+(i.x-r)+","+(i.y+r)+"L"+(i.x-r)+","+(i.y-r)+"L"+(i.x+r)+","+(i.y-r);o+=t.Browser.svg?"z":"x",this._setPath(e,o)}})}}),R=function(e,t,i){return new q(e,t,i)},A=G.extend({options:{fill:!0},initialize:function(e,t,i){G.prototype.initialize.call(this,e,t,i)},_updatePath:function(){this._renderer._updateDiamondMarker(this)},_svgCanvasIncludes:function(){t.Canvas.include({_updateDiamondMarker:function(e){var t=e._point,i=e._size/2,r=this._ctx;r.beginPath(),r.moveTo(t.x,t.y+i),r.lineTo(t.x-i,t.y),r.lineTo(t.x,t.y-i),r.lineTo(t.x+i,t.y),r.closePath(),this._fillStroke(r,e)}}),t.SVG.include({_updateDiamondMarker:function(e){var i=e._point,r=e._size/2;t.Browser.vml&&(i._round(),r=Math.round(r));var o="M"+i.x+","+(i.y+r)+"L"+(i.x-r)+","+i.y+"L"+i.x+","+(i.y-r)+"L"+(i.x+r)+","+i.y;o+=t.Browser.svg?"z":"x",this._setPath(e,o)}})}}),H=function(e,t,i){return new A(e,t,i)},U=F.extend({statics:{MARKERTYPES:["esriSMSCircle","esriSMSCross","esriSMSDiamond","esriSMSSquare","esriSMSX","esriPMS"]},initialize:function(e,t){var i;if(F.prototype.initialize.call(this,e,t),t&&(this.serviceUrl=t.url),e)if("esriPMS"===e.type){var r=this._symbolJson.url;r&&"http://"===r.substr(0,7)||"https://"===r.substr(0,8)?(i=this.sanitize(r),this._iconUrl=i):(i=this.serviceUrl+"images/"+r,this._iconUrl=t&&t.token?i+"?token="+t.token:i),e.imageData&&(this._iconUrl="data:"+e.contentType+";base64,"+e.imageData),this._icons={},this.icon=this._createIcon(this._symbolJson)}else this._fillStyles()},sanitize:function(e){if(!e)return"";var t;try{t=e.replace(/<br>/gi,"\n"),t=t.replace(/<p.*>/gi,"\n"),t=t.replace(/<a.*href='(.*?)'.*>(.*?)<\/a>/gi," $2 ($1) "),t=t.replace(/<(?:.|\s)*?>/g,"")}catch(e){t=null}return t},_fillStyles:function(){this._symbolJson.outline&&this._symbolJson.size>0&&"esriSLSNull"!==this._symbolJson.outline.style?(this._styles.stroke=!0,this._styles.weight=this.pixelValue(this._symbolJson.outline.width),this._styles.color=this.colorValue(this._symbolJson.outline.color),this._styles.opacity=this.alphaValue(this._symbolJson.outline.color)):this._styles.stroke=!1,this._symbolJson.color?(this._styles.fillColor=this.colorValue(this._symbolJson.color),this._styles.fillOpacity=this.alphaValue(this._symbolJson.color)):this._styles.fillOpacity=0,"esriSMSCircle"===this._symbolJson.style&&(this._styles.radius=this.pixelValue(this._symbolJson.size)/2)},_createIcon:function(e){var i=this.pixelValue(e.width),r=i;e.height&&(r=this.pixelValue(e.height));var o=i/2,n=r/2;e.xoffset&&(o+=this.pixelValue(e.xoffset)),e.yoffset&&(n+=this.pixelValue(e.yoffset));var s=t.icon({iconUrl:this._iconUrl,iconSize:[i,r],iconAnchor:[o,n]});return this._icons[e.width.toString()]=s,s},_getIcon:function(e){var t=this._icons[e.toString()];return t||(t=this._createIcon({width:e})),t},pointToLayer:function(e,i,r,o){var n=this._symbolJson.size||this._symbolJson.width;if(!this._isDefault){if(r.sizeInfo){var s=this.getSize(e,r.sizeInfo);s&&(n=s)}if(r.colorInfo){var a=this.getColor(e,r.colorInfo);a&&(this._styles.fillColor=this.colorValue(a),this._styles.fillOpacity=this.alphaValue(a))}}if("esriPMS"===this._symbolJson.type){var l=t.extend({},{icon:this._getIcon(n)},o);return t.marker(i,l)}switch(n=this.pixelValue(n),this._symbolJson.style){case"esriSMSSquare":return R(i,n,t.extend({},this._styles,o));case"esriSMSDiamond":return H(i,n,t.extend({},this._styles,o));case"esriSMSCross":return j(i,n,t.extend({},this._styles,o));case"esriSMSX":return B(i,n,t.extend({},this._styles,o))}return this._styles.radius=n/2,t.circleMarker(i,t.extend({},this._styles,o))}}),Y=F.extend({statics:{LINETYPES:["esriSLSDash","esriSLSDot","esriSLSDashDotDot","esriSLSDashDot","esriSLSSolid"]},initialize:function(e,t){F.prototype.initialize.call(this,e,t),this._fillStyles()},_fillStyles:function(){if(this._styles.lineCap="butt",this._styles.lineJoin="miter",this._styles.fill=!1,this._styles.weight=0,!this._symbolJson)return this._styles;if(this._symbolJson.color&&(this._styles.color=this.colorValue(this._symbolJson.color),this._styles.opacity=this.alphaValue(this._symbolJson.color)),!isNaN(this._symbolJson.width)){this._styles.weight=this.pixelValue(this._symbolJson.width);var e=[];switch(this._symbolJson.style){case"esriSLSDash":e=[4,3];break;case"esriSLSDot":e=[1,3];break;case"esriSLSDashDot":e=[8,3,1,3];break;case"esriSLSDashDotDot":e=[8,3,1,3,1,3]}if(e.length>0){for(var t=0;t<e.length;t++)e[t]*=this._styles.weight;this._styles.dashArray=e.join(",")}}},style:function(e,t){if(!this._isDefault&&t){if(t.sizeInfo){var i=this.pixelValue(this.getSize(e,t.sizeInfo));i&&(this._styles.weight=i)}if(t.colorInfo){var r=this.getColor(e,t.colorInfo);r&&(this._styles.color=this.colorValue(r),this._styles.opacity=this.alphaValue(r))}}return this._styles}}),K=F.extend({statics:{POLYGONTYPES:["esriSFSSolid"]},initialize:function(e,t){F.prototype.initialize.call(this,e,t),e&&(e.outline&&"esriSLSNull"===e.outline.style?this._lineStyles={weight:0}:this._lineStyles=d(e.outline,t).style(),this._fillStyles())},_fillStyles:function(){if(this._lineStyles)if(0===this._lineStyles.weight)this._styles.stroke=!1;else for(var e in this._lineStyles)this._styles[e]=this._lineStyles[e];this._symbolJson&&(this._symbolJson.color&&K.POLYGONTYPES.indexOf(this._symbolJson.style>=0)?(this._styles.fill=!0,this._styles.fillColor=this.colorValue(this._symbolJson.color),this._styles.fillOpacity=this.alphaValue(this._symbolJson.color)):(this._styles.fill=!1,this._styles.fillOpacity=0))},style:function(e,t){if(!this._isDefault&&t&&t.colorInfo){var i=this.getColor(e,t.colorInfo);i&&(this._styles.fillColor=this.colorValue(i),this._styles.fillOpacity=this.alphaValue(i))}return this._styles}}),X=t.Class.extend({options:{proportionalPolygon:!1,clickable:!0},initialize:function(e,i){this._rendererJson=e,this._pointSymbols=!1,this._symbols=[],this._visualVariables=this._parseVisualVariables(e.visualVariables),t.Util.setOptions(this,i)},_parseVisualVariables:function(e){var t={};if(e)for(var i=0;i<e.length;i++)t[e[i].type]=e[i];return t},_createDefaultSymbol:function(){this._rendererJson.defaultSymbol&&(this._defaultSymbol=this._newSymbol(this._rendererJson.defaultSymbol),this._defaultSymbol._isDefault=!0)},_newSymbol:function(e){return"esriSMS"===e.type||"esriPMS"===e.type?(this._pointSymbols=!0,c(e,this.options)):"esriSLS"===e.type?d(e,this.options):"esriSFS"===e.type?_(e,this.options):void 0},_getSymbol:function(){},attachStylesToLayer:function(e){this._pointSymbols?e.options.pointToLayer=t.Util.bind(this.pointToLayer,this):(e.options.style=t.Util.bind(this.style,this),e._originalStyle=e.options.style)},pointToLayer:function(e,i){var r=this._getSymbol(e);return r&&r.pointToLayer?r.pointToLayer(e,i,this._visualVariables,this.options):t.circleMarker(i,{radius:0,opacity:0})},style:function(e){var t;this.options.userDefinedStyle&&(t=this.options.userDefinedStyle(e));var i=this._getSymbol(e);return i?this.mergeStyles(i.style(e,this._visualVariables),t):this.mergeStyles({opacity:0,fillOpacity:0},t)},mergeStyles:function(e,t){var i,r={};for(i in e)e.hasOwnProperty(i)&&(r[i]=e[i]);if(t)for(i in t)t.hasOwnProperty(i)&&(r[i]=t[i]);return r}}),$=X.extend({initialize:function(e,t){X.prototype.initialize.call(this,e,t),this._field=this._rendererJson.field,this._rendererJson.normalizationType&&"esriNormalizeByField"===this._rendererJson.normalizationType&&(this._normalizationField=this._rendererJson.normalizationField),this._createSymbols()},_createSymbols:function(){var e,t=this._rendererJson.classBreakInfos;this._symbols=[];for(var i=t.length-1;i>=0;i--)e=this.options.proportionalPolygon&&this._rendererJson.backgroundFillSymbol?this._newSymbol(this._rendererJson.backgroundFillSymbol):this._newSymbol(t[i].symbol),e.val=t[i].classMaxValue,this._symbols.push(e);this._symbols.sort(function(e,t){return e.val>t.val?1:-1}),this._createDefaultSymbol(),this._maxValue=this._symbols[this._symbols.length-1].val},_getSymbol:function(e){var t=e.properties[this._field];if(this._normalizationField){var i=e.properties[this._normalizationField];if(isNaN(i)||0===i)return this._defaultSymbol;t/=i}if(t>this._maxValue)return this._defaultSymbol;for(var r=this._symbols[0],o=this._symbols.length-1;o>=0&&!(t>this._symbols[o].val);o--)r=this._symbols[o];return r}}),Q=X.extend({initialize:function(e,t){X.prototype.initialize.call(this,e,t),this._field=this._rendererJson.field1,this._createSymbols()},_createSymbols:function(){for(var e,t=this._rendererJson.uniqueValueInfos,i=t.length-1;i>=0;i--)e=this._newSymbol(t[i].symbol),e.val=t[i].value,this._symbols.push(e);this._createDefaultSymbol()},_getSymbol:function(e){var t=e.properties[this._field];if(this._rendererJson.fieldDelimiter&&this._rendererJson.field2){var i=e.properties[this._rendererJson.field2];if(i){t+=this._rendererJson.fieldDelimiter+i;var r=e.properties[this._rendererJson.field3];r&&(t+=this._rendererJson.fieldDelimiter+r)}}for(var o=this._defaultSymbol,n=this._symbols.length-1;n>=0;n--)this._symbols[n].val==t&&(o=this._symbols[n]);return o}}),Z=X.extend({initialize:function(e,t){X.prototype.initialize.call(this,e,t),this._createSymbol()},_createSymbol:function(){this._rendererJson.symbol&&this._symbols.push(this._newSymbol(this._rendererJson.symbol))},_getSymbol:function(){return this._symbols[0]}}),ee=t.GeoJSON.extend({options:{data:{},opacity:1},initialize:function(e,i){t.setOptions(this,i),this.data=this.options.data,this.opacity=this.options.opacity,this.popupInfo=null,this.labelingInfo=null,this._layers={};var r,o;if(e)for(r=0,o=e.length;r<o;r++)this.addLayer(e[r]);"string"==typeof this.data?this._getFeatureCollection(this.data):this._parseFeatureCollection(this.data)},_getFeatureCollection:function(e){var i="https://www.arcgis.com/sharing/rest/content/items/"+e+"/data";t.esri.request(i,{},function(e,t){e?console.log(e):this._parseFeatureCollection(t)},this)},_parseFeatureCollection:function(e){var t,i,r=0;for(t=0,i=e.layers.length;t<i;t++)e.layers[t].featureSet.features.length>0&&(r=t);var o=e.layers[r].featureSet.features,n=e.layers[r].layerDefinition.geometryType,s=e.layers[r].layerDefinition.objectIdField,a=e.layers[r].layerDefinition||null;4326!==e.layers[r].layerDefinition.extent.spatialReference.wkid&&(102100!==e.layers[r].layerDefinition.extent.spatialReference.wkid&&console.error("[L.esri.WebMap] this wkid ("+e.layers[r].layerDefinition.extent.spatialReference.wkid+") is not supported."),o=this._projTo4326(o,n)),void 0!==e.layers[r].popupInfo&&(this.popupInfo=e.layers[r].popupInfo),void 0!==e.layers[r].layerDefinition.drawingInfo.labelingInfo&&(this.labelingInfo=e.layers[r].layerDefinition.drawingInfo.labelingInfo),console.log(e);var l=this._featureCollectionToGeoJSON(o,s);null!==a&&b(a,this),console.log(l),this.addData(l)},_projTo4326:function(e,i){console.log("_project!");var r,o,n=[];for(r=0,o=e.length;r<o;r++){var s,a,l,u=e[r];if("esriGeometryPoint"===i)s=t.Projection.SphericalMercator.unproject(t.point(u.geometry.x,u.geometry.y)),u.geometry.x=s.lng,u.geometry.y=s.lat;else if("esriGeometryMultipoint"===i){var f;for(a=0,f=u.geometry.points.length;a<f;a++)s=t.Projection.SphericalMercator.unproject(t.point(u.geometry.points[a][0],u.geometry.points[a][1])),u.geometry.points[a][0]=s.lng,u.geometry.points[a][1]=s.lat}else if("esriGeometryPolyline"===i){var p,h;for(a=0,h=u.geometry.paths.length;a<h;a++)for(l=0,p=u.geometry.paths[a].length;l<p;l++)s=t.Projection.SphericalMercator.unproject(t.point(u.geometry.paths[a][l][0],u.geometry.paths[a][l][1])),u.geometry.paths[a][l][0]=s.lng,u.geometry.paths[a][l][1]=s.lat}else if("esriGeometryPolygon"===i){var y,c;for(a=0,c=u.geometry.rings.length;a<c;a++)for(l=0,y=u.geometry.rings[a].length;l<y;l++)s=t.Projection.SphericalMercator.unproject(t.point(u.geometry.rings[a][l][0],u.geometry.rings[a][l][1])),u.geometry.rings[a][l][0]=s.lng,u.geometry.rings[a][l][1]=s.lat}n.push(u)}return n},_featureCollectionToGeoJSON:function(e,t){var i,r,o={type:"FeatureCollection",features:[]},n=[];for(i=0,r=e.length;i<r;i++){var s=y(e[i],t);n.push(s)}return o.features=n,o}}),te=t.GeoJSON.extend({options:{url:"",data:{},opacity:1},initialize:function(e,i){t.setOptions(this,i),this.url=this.options.url,this.layerDefinition=this.options.layerDefinition,this.locationInfo=this.options.locationInfo,this.opacity=this.options.opacity,this._layers={};var r,o;if(e)for(r=0,o=e.length;r<o;r++)this.addLayer(e[r]);this._parseCSV(this.url,this.layerDefinition,this.locationInfo)},_parseCSV:function(e,t,r){i.csv(e,{latfield:r.latitudeFieldName,lonfield:r.longitudeFieldName},this),b(t,this)}}),ie=t.GeoJSON.extend({options:{opacity:1,url:""},initialize:function(e,i){t.setOptions(this,i),this.url=this.options.url,this.opacity=this.options.opacity,this.popupInfo=null,this.labelingInfo=null,this._layers={};var r,o;if(e)for(r=0,o=e.length;r<o;r++)this.addLayer(e[r]);this._getKML(this.url)},_getKML:function(e){var i="http://utility.arcgis.com/sharing/kml?url="+e+'&model=simple&folders=&outSR=%7B"wkid"%3A4326%7D';t.esri.request(i,{},function(e,t){e?console.log(e):(console.log(t),this._parseFeatureCollection(t.featureCollection))},this)},_parseFeatureCollection:function(e){console.log("_parseFeatureCollection");var t;for(t=0;t<3;t++)if(e.layers[t].featureSet.features.length>0){console.log(t);var i=e.layers[t].featureSet.features,r=e.layers[t].layerDefinition.objectIdField,o=this._featureCollectionToGeoJSON(i,r);void 0!==e.layers[t].popupInfo&&(this.popupInfo=e.layers[t].popupInfo),void 0!==e.layers[t].layerDefinition.drawingInfo.labelingInfo&&(this.labelingInfo=e.layers[t].layerDefinition.drawingInfo.labelingInfo),b(e.layers[t].layerDefinition,this),console.log(o),this.addData(o)}},_featureCollectionToGeoJSON:function(e,t){var i,r,o={type:"FeatureCollection",features:[]},n=[];for(i=0,r=e.length;i<r;i++){var s=y(e[i],t);n.push(s)}return o.features=n,o}}),re=t.DivIcon.extend({options:{iconSize:null,className:"esri-leaflet-webmap-labels",text:""},createIcon:function(e){var i=e&&"DIV"===e.tagName?e:document.createElement("div"),r=this.options
;if(i.innerHTML='<div style="position: relative; left: -50%; text-shadow: 1px 1px 0px #fff, -1px 1px 0px #fff, 1px -1px 0px #fff, -1px -1px 0px #fff;">'+r.text+"</div>",i.style.fontSize="1em",i.style.fontWeight="bold",i.style.textTransform="uppercase",i.style.textAlign="center",i.style.whiteSpace="nowrap",r.bgPos){var o=t.point(r.bgPos);i.style.backgroundPosition=-o.x+"px "+-o.y+"px"}return this._setIconStyles(i,"icon"),i}}),oe=t.Marker.extend({options:{properties:{},labelingInfo:{},offset:[0,0]},initialize:function(e,i){t.setOptions(this,i),this._latlng=t.latLng(e);var r=this._createLabelText(this.options.properties,this.options.labelingInfo);this._setLabelIcon(r,this.options.offset)},_createLabelText:function(e,t){var i=/\[([^\]]*)\]/g,r=t[0].labelExpression;return r=r.replace(i,function(t){var r=i.exec(t);return e[r[1]]})},_setLabelIcon:function(e,t){var i=M({text:e,iconAnchor:t});this.setIcon(i)}}),ne=t.Evented.extend({options:{map:{},token:null,server:"www.arcgis.com"},initialize:function(e,i){t.setOptions(this,i),this._map=this.options.map,this._token=this.options.token,this._server=this.options.server,this._webmapId=e,this._loaded=!1,this._metadataLoaded=!1,this._loadedLayersNum=0,this._layersNum=0,this.layers=[],this.title="",this.bookmarks=[],this.portalItem={},this.VERSION="0.4.0",this._loadWebMapMetaData(e),this._loadWebMap(e)},_checkLoaded:function(){++this._loadedLayersNum===this._layersNum&&(this._loaded=!0,this.fire("load"))},_operationalLayer:function(e,t,i,r,o){var n=P(e,t,i,r,o);void 0!==n&&!0===e.visibility&&n.addTo(i)},_loadWebMapMetaData:function(e){var i={},r=this._map,o=this,n="https://"+this._server+"/sharing/rest/content/items/"+e;this._token&&this._token.length>0&&(i.token=this._token),t.esri.request(n,i,function(e,t){e?console.log(e):(o.portalItem=t,o.title=t.title,o._metadataLoaded=!0,o.fire("metadataLoad"),r.fitBounds([t.extent[0].reverse(),t.extent[1].reverse()]))})},_loadWebMap:function(e){var i=this._map,r=this.layers,o=this._server,n={},s="https://"+o+"/sharing/rest/content/items/"+e+"/data";this._token&&this._token.length>0&&(n.token=this._token),t.esri.request(s,n,function(e,s){e?console.log("L.esri.request error:",e):(this._layersNum=s.baseMap.baseMapLayers.length+s.operationalLayers.length,s.baseMap.baseMapLayers.map(function(s){if(void 0!==s.itemId){var a="https://"+o+"/sharing/rest/content/items/"+s.itemId;t.esri.request(a,n,function(t,o){t?console.error(e):(console.log(o.access),"public"!==o.access?this._operationalLayer(s,r,i,n):this._operationalLayer(s,r,i,{})),this._checkLoaded()},this)}else this._operationalLayer(s,r,i,{}),this._checkLoaded()}.bind(this)),s.operationalLayers.map(function(s,a){var l="esri-webmap-layer"+a;if(i.createPane(l),void 0!==s.itemId){var u="https://"+o+"/sharing/rest/content/items/"+s.itemId;t.esri.request(u,n,function(t,o){t?console.error(e):(console.log(o.access),"public"!==o.access?this._operationalLayer(s,r,i,n,l):this._operationalLayer(s,r,i,{},l)),this._checkLoaded()},this)}else this._operationalLayer(s,r,i,{},l),this._checkLoaded()}.bind(this)),void 0!==s.bookmarks&&s.bookmarks.length>0&&s.bookmarks.map(function(e){var i=t.Projection.SphericalMercator.unproject(t.point(e.extent.xmax,e.extent.ymax)),r=t.Projection.SphericalMercator.unproject(t.point(e.extent.xmin,e.extent.ymin)),o=t.latLngBounds(r,i);this.bookmarks.push({name:e.name,bounds:o})}.bind(this)))}.bind(this))}});e.WebMap=ne,e.webMap=O,e.operationalLayer=P,e.FeatureCollection=ee,e.featureCollection=I,e.LabelMarker=oe,e.labelMarker=w,e.LabelIcon=re,e.labelIcon=M,e.createPopupContent=z,Object.defineProperty(e,"__esModule",{value:!0})});
//# sourceMappingURL=esri-leaflet-webmap.js.map