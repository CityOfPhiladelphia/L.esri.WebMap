/*
 * L.esri.WebMap
 * 
 * 
 */

L.esri.WebMap = L.Class.extend({
	options: {
		map: {}
	},

	initialize: function(webmapId, options) {
		L.setOptions(this, options);

		this._map = this.options.map;
		this._webmapId = webmapId;
		this._mapOptions = {};
		this._baseMap = {};
		this._operationalLayers = {};
		this._exportOptions = {};
		this._layoutOptions = {};
        
        this.layers = [];

		this._loadWebMapMetaData(webmapId);
		this._loadWebMap(webmapId);
	},

	_loadWebMapMetaData: function(id) {
        console.log(this);
		var map = this._map;
		var leafletLatlng = this.leafletLatlng;
		var webmapMetaDataRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id;
		L.esri.request(webmapMetaDataRequestUrl, {}, function(error, response){
		  if(error){
		    console.log(error);
		  } else {
		    console.log(response);
				console.log('extent: ', response.extent);

				map.fitBounds([leafletLatlng(response.extent[0]), leafletLatlng(response.extent[1])]);
		  }
		});
	},

	_loadWebMap: function(id) {
		var map = this._map;
		var generateEsriLayer = this._generateEsriLayer;
		//var basemapKey = this.getBasemapKey;
		var webmapRequestUrl = 'https://www.arcgis.com/sharing/rest/content/items/' + id + '/data';
		L.esri.request(webmapRequestUrl, {}, function(error, response){
		  if(error){
		    console.log(error);
		  } else {
		    console.log(response);
				console.log('baseMap: ', response.baseMap);
				console.log('operationalLayers: ', response.operationalLayers);

				// Add Basemap
				response.baseMap.baseMapLayers.map(function(baseMapLayer) {
					generateEsriLayer(baseMapLayer).addTo(map);
				});

				// Add Operational Layers
				response.operationalLayers.map(function(layer) {
                    var lyr = generateEsriLayer(layer);
                    this.webmap.layers.push(lyr);
                    lyr.addTo(map);
				});
		  }
		});
	},

	leafletLatlng: function(latlng) {
		var changedLatlng = [latlng[1], latlng[0]];
		return changedLatlng;
	},
    
    _createPopupContent: function(popupInfo, properties) {
        //console.log(popupInfo, properties);
        var content = '<h4>' + popupInfo.title + '</h4>';
        if(popupInfo.fieldInfos.length > 0) {
            popupInfo.fieldInfos.map(function(info) {
                content += '<div style="font-weight:bold;color:#999;margin-top:5px;">' + info.label + '</div> ' + properties[info.fieldName] + '<br>';
            });
        }
        if(popupInfo.mediaInfos.length > 0) {
            
        }
        return content;
    },
    
    _pointSymbol: function(symbol) {
        var icon;
        if(symbol.type === 'esriPMS') {
            icon = L.icon({
                iconUrl: symbol.url,
                shadowUrl: '',
                iconSize:     [symbol.height, symbol.width],
                shadowSize:   [0, 0],
                iconAnchor:   [symbol.height-16, symbol.width-1],
                shadowAnchor: [0, 0],
                popupAnchor:  [symbol.width/3, symbol.height*-1]
            });
        }
        if(symbol.type === 'esriSMS') {
            if(symbol.style === 'esriSMSCircle') {
                if(symbol.outline.style === 'esriSLSNull') {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: (symbol.size + symbol.outline.width) * 2,
                        svgWidth: (symbol.size + symbol.outline.width) * 2,
                        type: 'circle',
                        shape: {
                            r: symbol.size + '',
                            cx: symbol.size + symbol.outline.width,
                            cy: symbol.size + symbol.outline.width
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            //stroke: '',
                            strokeWidth: 0
                        }
                    });
                }
                else {
                    icon = L.vectorIcon({
                        //className: 'my-vector-icon',
                        svgHeight: (symbol.size + symbol.outline.width) * 2,
                        svgWidth: (symbol.size + symbol.outline.width) * 2,
                        type: 'circle',
                        shape: {
                            r: symbol.size + '',
                            cx: symbol.size + symbol.outline.width,
                            cy: symbol.size + symbol.outline.width
                        },
                        style: {
                            fill: 'rgba(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] + ',' + symbol.color[3]/255 + ')',
                            stroke: 'rgba(' + symbol.outline.color[0] + ',' + symbol.outline.color[1] + ',' + symbol.outline.color[2] + ',' + symbol.outline.color[3]/255 + ')',
                            strokeWidth: symbol.outline.width
                        }
                    });
                }
            }
            if(symbol.style === '') {
                
            }
            if(symbol.style === '') {
                
            }
        }
        return icon;
    },
    
    _generateIcon: function(renderer, properties) {
        //console.log(renderer);
        var icon;
        if(renderer.type === 'simple') {
            icon = this._pointSymbol(renderer.symbol);
        }
        if(renderer.type === 'uniqueValue') {
            renderer.uniqueValueInfos.map(function(info) {
                if(info.value === properties[renderer.field1]) { // field2, field3は後で考えよう
                    icon = this.webmap._pointSymbol(info.symbol);
                }
            });
        }
        if(renderer.type === 'classBreaks') {
            renderer.classBreakInfos.map(function(info) {
                if(info.classMinValue !== undefined) {
                    if(info.classMinValue <= properties[renderer.field] && info.classMaxValue > properties[renderer.field]) {
                        icon = this.webmap._pointSymbol(info.symbol);
                    }
                }
                else {
                    if(info.classMaxValue > properties[renderer.field]) {
                        icon = this.webmap._pointSymbol(info.symbol);
                    }
                }
            });
        }
        return icon;
    },
    
    _generateLabel: function(properties, labelingInfo) {
        //console.log('generateLabels: ', properties, labelingInfo);
        var r = /\[([^\]]*)\]/g;
        var labelText = labelingInfo[0].labelExpression;
        labelText = labelText.replace(r, function(s) {
            var m = r.exec(s);
            //console.log(m[1]);
            //console.log(properties[m[1]]);
            return properties[m[1]];
        });
        return labelText;
    },

	_generateEsriLayer: function(layer) {
		console.log('generateEsriLayer: ', layer.title, layer);
        
		console.log(this.webmap);

		if(layer.featureCollection !== undefined) {
            // Supporting only point geometry
            console.log('create FeatureCollection');
            var renderer = layer.featureCollection.layers[0].layerDefinition.drawingInfo.renderer;
            console.log(renderer);
            var features = [];
            layer.featureCollection.layers[0].featureSet.features.map(function(feature) {
                
                var popupContent = this.webmap._createPopupContent(layer.featureCollection.layers[0].popupInfo, feature.attributes);
                var icon = this.webmap._generateIcon(renderer, feature.attributes);
                var mercatorToLatlng = L.Projection.SphericalMercator.unproject(L.point(feature.geometry.x, feature.geometry.y));

                var f = L.marker(mercatorToLatlng, { icon: icon, opacity: layer.opacity }).bindPopup(popupContent);
                
                if(layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo !== undefined) {
                    var labelingInfo = layer.featureCollection.layers[0].layerDefinition.drawingInfo.labelingInfo;
                    var labelText = this.webmap._generateLabel(feature.attributes, labelingInfo);
                    //f.bindLabel(labelText, { noHide: true }).showLabel();
                }
                
                features.push(f);
            });
            
            var lyr = L.featureGroup(features);
            return lyr;
        }
        if(layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition.drawingInfo !== undefined) {
            if(layer.layerDefinition.drawingInfo.renderer.type === 'heatmap'){
                console.log('create HeatmapLayer');
                var gradient = {};
                layer.layerDefinition.drawingInfo.renderer.colorStops.map(function(stop) {
                    //gradient[stop.ratio] = 'rgba(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ',' + (stop.color[3]/255) + ')';
                    gradient[Math.round(stop.ratio*100)/100] = 'rgb(' + stop.color[0] + ',' + stop.color[1] + ',' + stop.color[2] + ')';
                });
                //console.log(gradient);

                var lyr = L.esri.Heat.heatmapFeatureLayer({ // Esri Leaflet 2.0
                //var lyr = L.esri.heatmapFeatureLayer({ // Esri Leaflet 1.0
                    url: layer.url,
                    //blur: layer.layerDefinition.drawingInfo.renderer.blurRadius,
                    //max: layer.layerDefinition.drawingInfo.renderer.maxPixelIntensity,
                    gradient: gradient
                })
                return lyr;
            }
		}
		if(layer.layerType === 'ArcGISFeatureLayer' && layer.layerDefinition !== undefined) {
            if(layer.layerDefinition.drawingInfo !== undefined){
                console.log('create ArcGISFeatureLayer (with layerDefinition.drawingInfo)');
                var renderer = layer.layerDefinition.drawingInfo.renderer;
                var where = '1=1';
                if(layer.layerDefinition.definitionExpression !== undefined) {
                    where = layer.layerDefinition.definitionExpression;
                }

                var lyr = L.esri.featureLayer({
                    url: layer.url,
                    where: where,
                    pointToLayer: function (geojson, latlng) {
                    
                        var popupContent = this.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                        var icon = this.webmap._generateIcon(renderer, geojson.properties);
                        
                        var f = L.marker(latlng, {
                            icon: icon,
                            opacity: layer.opacity
                        }).bindPopup(popupContent);
                        
                        if(layer.layerDefinition.drawingInfo.labelingInfo !== undefined) {
                            var labelingInfo = layer.layerDefinition.drawingInfo.labelingInfo;
                            var labelText = this.webmap._generateLabel(geojson.properties, labelingInfo);
                            //f.bindLabel(labelText, { noHide: true }).showLabel();
                        }
                            
                        return f;
                    }
                });
                return lyr;
            }
            else {
                console.log('create ArcGISFeatureLayer (without layerDefinition.drawingInfo)');
                var where = '1=1';
                if(layer.layerDefinition.definitionExpression !== undefined) {
                    where = layer.layerDefinition.definitionExpression;
                }
                
                var lyr = L.esri.featureLayer({
                    url: layer.url,
                    where: where,
                    pointToLayer: function (geojson, latlng) {
                    
                        var popupContent = this.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                        //var icon = this.webmap._generateIcon(renderer, geojson.properties);
                        
                        var f = L.marker(latlng, {
                            //icon: icon,
                            opacity: layer.opacity
                        }).bindPopup(popupContent);
                            
                        return f;
                    }
                });
                return lyr;
            }
		}
		if(layer.layerType === 'ArcGISFeatureLayer') {
			console.log('create ArcGISFeatureLayer');
            var lyr = L.esri.featureLayer({
                url: layer.url,
                pointToLayer: function (geojson, latlng) {
                
                    var popupContent = this.webmap._createPopupContent(layer.popupInfo, geojson.properties);
                    //var icon = this.webmap._generateIcon(renderer, geojson.properties);
                    
                    var f = L.marker(latlng, {
                        //icon: icon,
                        opacity: layer.opacity
                    }).bindPopup(popupContent);
                        
                    return f;
                }
            });
			return lyr;
		}
		if(layer.layerType === 'ArcGISImageServiceLayer') {
			console.log('create ArcGISImageServiceLayer');
			var lyr = L.esri.imageMapLayer({
				url: layer.url
			});
			return lyr;
		}
		if(layer.layerType === 'ArcGISMapServiceLayer') {
			var lyr = L.esri.dynamicMapLayer({
				url: layer.url
			});
			return lyr;
		}
		if(layer.layerType === 'ArcGISTiledMapServiceLayer') {
			var lyr = L.esri.tiledMapLayer({
				url: layer.url
			});
			return lyr;
		}
		if(layer.layerType === '') {
			return false;
		}
		if(layer.layerType === '') {
			return false;
		}
	}

});

L.esri.webMap = function (webmapId, options) {
	return new L.esri.WebMap(webmapId, options);
};