var ANIMATION_DURATION = 400;

var d3Board = {};

d3Board.create = function(el, props, state) {
  var margin = props.margin || {top: 10, right: 10, bottom: 10, left: 10},
      width = props.width - margin.left - margin.right,
      height = props.height - margin.top - margin.bottom,
      dims = {width: width, height: height};

  var svg = d3.select(el).append('svg')
      .attr('class', 'd3')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

  var g = svg.append('g')
      .attr('class', 'd3-board')
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  g.selectAll('.layer').data(["hexes", "buildings", "roads", "coords"]).enter().append('g')
    .attr('class', function (d) { return d; });

  g.select(".coords").attr("visibility", "hidden");

  var hud = d3.select(el).append('div')
    .attr('id', 'hud')
    .style('position', 'absolute')
    .style('top', '10px')
    .style('left', width + margin.left + margin.right + 50 + 'px');

  var hudTable = hud.append("table")
    .selectAll('tr').data([["Index", "stateIndex"],
                           ["Players", "players"],
                           ["Last", "lastAction"],
                           ["Valid", "validActions"]]);
  hudTable.enter().append('tr')
    .selectAll('td').data(function (d) { return d;})
      .enter().append('td')
        .style('vertical-align', 'top')
        .each(function (d, i) {
            if (i == 0) d3.select(this).text(d);
            else d3.select(this).attr('id', d);
        });

  this.update(el, state, dims);
  return dims;
};

d3Board.update = function(el, state, dims) {
  var scales = this._scales(el, state.domain, dims);
  var prevScales = this._scales(el, state.prevDomain, dims);

  var hexSize = (state.domain.xy[1] - state.domain.xy[0]) / 8 + state.domain.xy[0];
  var gameData = this._process(state.data);

  this._drawHexes(el, scales, hexSize, gameData, prevScales);
  this._drawBuildings(el, scales, hexSize, gameData, prevScales);
  this._drawRoads(el, scales, hexSize, gameData, prevScales);
  this._drawCoords(el, scales, hexSize);
  this._updateHUD(el, scales.playerColor, state);
};

d3Board.destroy = function(el) {
};


function _qrToString(qr) {
  return [qr.q, qr.r].join(",");
}

function _stringToQR(id) {
  var qr = id.split(",");
  return {q: parseInt(qr[0]), r: parseInt(qr[1])};
}

function _qrpToString(qrp) {
  return _qrToString(qrp) + "," + qrp.p.substring(0, 1);
}

function _stringToQRP(id) {
  var qrp = id.split(",");
  return {q: parseInt(qrp[0]), r: parseInt(qrp[1]), p: qrp[2] == "t" ? "top" : "bottom"};
}


function _qrFromPoint(point) {
  return {q: point.coord[0], r: point.coord[1]};
}

function _qrpFromPoint(point) {
  return {q: point.coord[0], r: point.coord[1], p: point.position};
}

function _edgeFromQRPs(edge) {
  var qrp1 = _qrpFromPoint(edge.point1),
      qrp2 = _qrpFromPoint(edge.point2);
  return [qrp1, qrp2];
}

function _edgeToString(edge) {
  return '(' + edge.map(_qrpToString).join(")-(") + ')';
}

d3Board._process = function (gameState) {
  var data = { hexes: [],
               roads: [],
               buildings: [],
               harbors: []};

  data.hexes = gameState.board.hexes.map(function (a) {
    var point = a[0], hexCenter = a[1],
        qr = _qrFromPoint(point);
    return {id: _qrToString(qr), 
            qr: qr,
            hex: hexCenter};
  });

  data.roads = gameState.board.roads.map(function (a) {
    var edge = a[0], onEdge = a[1],
        qrpEdge = _edgeFromQRPs(edge);
    if (!onEdge) return null;
    return { id: _edgeToString(qrpEdge),
             edge: qrpEdge,
             color: onEdge.edgeColor
           };
  }).filter(function (d) { return !!d; });

  data.buildings = gameState.board.buildings.map(function (a) {
    var point = a[0], onPoint = a[1],
        qrp = _qrpFromPoint(point);
    if (!onPoint) return null;
    return { id: _qrpToString(qrp),
             qrp: qrp,
             buildingType: onPoint.buildingType,
             color: onPoint.pointColor
           };
  }).filter(function (d) { return !!d; });

  data.harbors = gameState.board.harbors.map(function (a) {
    var point = a[0], harbor = a[1],
        qrp = _qrpFromPoint(point);
    return { id: _qrpToString(qrp),
             qrp: qrp,
             harborType: harbor.harbor || "threetoone"
           };
  }).filter(function (d) { return !!d; });

  return data;
};

function _hexPoints(size) {
    return [0,1,2,3,4,5].map(function (i) {
      var angle = (2 * Math.PI) / 6 * (i + 0.5);
      return [size * Math.cos(angle), size * Math.sin(angle)];
    });
}

function _fromPosition(pos) {
  if (pos == "top") return -1; // remembe,r y is reversed
  else if (pos == "bottom") return 1;
  else return null;
}

d3Board._scales = function(el, domain, dims) {
  if (!domain) {
    return null;
  }

  var width = dims.width;
  var height = dims.height;

  var x = d3.scale.linear()
    .range([0, width])
    .domain(domain.xy);

  var y = d3.scale.linear()
    .range([height, 0])
    .domain(domain.xy);

  var hexColor = d3.scale.ordinal()
    .domain(["forest", "hill", "mountain","desert","pasture","field"])
    .range(colorbrewer.Pastel2[6]);

  var playerColor = d3.scale.ordinal()
    .domain(["red", "blue", "white", "orange"])
    .range(colorbrewer.Set1[4]);

  var fromQR = function(qr) {
    var q = qr.q,
        r = qr.r,
        x = Math.sqrt(3) * (q + r/2),
        y = -1.5 * r;
    return {x: x, y: y};
  };

  var offsetFromQRP = function(qrp) {
    return _fromPosition(qrp.p);
  };

  return {x: x, 
          y: y,
          fromQR: fromQR,
          offsetFromQRP: offsetFromQRP,
          hexColor: hexColor,
          playerColor: playerColor};
};

d3Board._drawHexes = function(el, scales, hexSize, data, prevScales) {
  var g = d3.select(el).selectAll('.d3-board');

  var hex = g.selectAll('.hexes')
    .selectAll('.hex')
      .data(data.hexes, function(d) { return d.id + d.hex.hasRobber; });

  function _textHexPoints(size) {
    return _hexPoints(size).map(function(h) { return h.join(","); }).join(" ");
  }

  var points = _textHexPoints(1);

  var hexGroup = hex.enter().append('g')
      .attr('class', 'hex')
      .attr('id', function (d) { return 'hex' + _qrToString(d.qr);});

  var poly = hexGroup.append('polygon')
    .attr('class', 'hexPoly')
    .attr('points', points)
    .style('stroke', 'white')
    .style('stroke-width', '0.1px')
    .attr('transform', 'scale(' + scales.x(hexSize) + ')');

  hexGroup.append('text')
    .text(function (d) { return d.hex.roll; })
    .attr('text-anchor', 'middle')
    .style('fill', 'rgba(0,0,0,0.6)')
    .style('font-size', '28px');

  hexGroup.append('circle')
    .attr('class', 'robber')
    .attr('r', 10)
    .style('fill', 'black')
    .style('visibility', 'hidden');

  hex.style('fill', function(d) { return scales.hexColor(d.hex.terrain); })
    .attr('transform', function(d) { 
        return "translate(" + scales.x(scales.fromQR(d.qr).x) + "," + scales.y(scales.fromQR(d.qr).y) + ")";
      });

  hex.selectAll('.robber')
    .style('visibility', function (d) { return d.hex.hasRobber ? "visible" : "hidden";});

  if (prevScales) {
    hex.exit()
      .transition()
        .duration(ANIMATION_DURATION)
        .attr('transform', function(d) { 
          return "translate(" + scales.x(scales.fromQR(d.qr).x) + "," + scales.y(scales.fromQR(d.qr).y) + ")";
        })
        .remove();
  }
  else {
    hex.exit()
        .remove();
  }
};

d3Board._drawBuildings = function(el, scales, hexSize, data, prevScales) {
  var g = d3.select(el).selectAll('.d3-board');

  var nested = d3.nest()
    .key(function (d) { return _qrToString(d.qrp); })
    .entries(data.buildings);

  var buildingGroups = g.selectAll('.buildings')
    .selectAll('.hexBuildings')
      .data(nested);

  buildingGroups.enter().append('g')
    .attr('class', 'hexBuildings');

  buildingGroups
    .attr('transform', function(d) {
      var qr = _stringToQR(d.key);
      return "translate(" + scales.x(scales.fromQR(qr).x) + "," + scales.y(scales.fromQR(qr).y) + ")";
    });

  buildingGroups.exit().remove();

  var buildings = buildingGroups.selectAll('.building')
      .data(function (d) { return d.values; });

  buildings.enter().append('circle')
    .attr('class', 'building')
    .attr('r', 10);

  buildings
    .style('fill', function (d) { return scales.playerColor(d.color);})
    .attr('cx', 0)
    .attr('cy', function (d) { return _fromPosition(d.qrp.p) * scales.x(hexSize); });

  buildings.exit().remove();
};

d3Board._drawRoads = function(el, scales, hexSize, data, prevScales) {
  var g = d3.select(el).selectAll('.d3-board');

  var roads = g.selectAll('.roads')
    .selectAll('.road')
      .data(data.roads, function (d) { return d.id; });

  roads.enter().append('line')
    .attr('class', 'road')
    .style('stroke-width', 8);

  function _edgeToRoad(edge) {
    var points = edge.map(scales.fromQR),
        offsets = edge.map(scales.offsetFromQRP),
        x1 = scales.x(points[0].x),
        x2 = scales.x(points[1].x),
        y1 = scales.y(points[0].y) + (scales.x(hexSize) * offsets[0]),
        y2 = scales.y(points[1].y) + (scales.x(hexSize) * offsets[1]);

    return {x1: x1, x2: x2, y1: y1, y2: y2};
  }

  roads
    .style('stroke', function (d) { return scales.playerColor(d.color);})
    .attr('x1', function (d) { return _edgeToRoad(d.edge).x1 })
    .attr('x2', function (d) { return _edgeToRoad(d.edge).x2 })
    .attr('y1', function (d) { return _edgeToRoad(d.edge).y1 })
    .attr('y2', function (d) { return _edgeToRoad(d.edge).y2 });

  roads.exit().remove();
};

d3Board._drawCoords = function(el, scales, hexSize) {
  var points = ["-3,1,t", "-3,2,t", "-3,3,t", "-2,-1,b", "-2,0,t", "-2,0,b", "-2,1,t", "-2,1,b", "-2,2,t", "-2,2,b", "-2,3,t", "-1,-2,b", "-1,-1,t", "-1,-1,b", "-1,0,t", "-1,0,b", "-1,1,t", "-1,1,b", "-1,2,t", "-1,2,b", "-1,3,t", "0,-3,b", "0,-2,t", "0,-2,b", "0,-1,t", "0,-1,b", "0,0,t", "0,0,b", "0,1,t", "0,1,b", "0,2,t", "0,2,b", "0,3,t", "1,-3,b", "1,-2,t", "1,-2,b", "1,-1,t", "1,-1,b", "1,0,t", "1,0,b", "1,1,t", "1,1,b", "1,2,t", "2,-3,b", "2,-2,t", "2,-2,b", "2,-1,t", "2,-1,b", "2,0,t", "2,0,b", "2,1,t", "3,-3,b", "3,-2,b", "3,-1,b"];
  var qrps = points.map(_stringToQRP);
  var g = d3.select(el).selectAll('.d3-board');
  var textWidth = 30;
  var textHeight = 13;

  var coords = g.selectAll('.coords').selectAll(".coord")
    .data(qrps);

  coords.enter().append('g')
    .attr('class', 'coord');

  g.selectAll('.coord').append('rect')
    .attr('width', textWidth + 'px')
    .attr('height', textHeight + 'px')
    .style('fill', 'rgba(255,255,255,0.6)');

  g.selectAll('.coord')
    .append('text')
    .style('font-size', '12px')
    .attr('text-anchor', 'middle')
    .attr('x', 15)
    .attr('y', textHeight - 2)
    .text(function (d) { return _qrpToString(d); });

  coords
    .attr('transform', function (d) { 
      return 'translate(' + (scales.x(scales.fromQR(d).x)-textWidth/2) + ',' + 
        (scales.y(scales.fromQR(d).y) + (scales.x(hexSize) * scales.offsetFromQRP(d)) - textHeight/2) + ')'; 
      });

  coords.exit().remove();
};

function _showRes(res) {
  var reduced = {};
  for (var i in res) {
    if (res[i] != 0) reduced[i] = res[i];
  }
  return JSON.stringify(reduced);
}

function _maybe(obj, propKey) {
  var props = propKey.split('.');
  if (props.length == 1 && props[0] == "") return obj;

  var firstKey = props[0];
  if (obj.hasOwnProperty(firstKey)) return _maybe(obj[firstKey], props.slice(1).join('.'));
  else return null;
}

function _showItems(items) {
  var realItems = items.filter(function(c) { return !c.potential;});
  return realItems.map(function (item) {
    var point = _maybe(item, 'building.building.edifice.onPoint.point');
    var edge = _maybe(item, 'building.building.roadway.onEdge.edge');
    var card = _maybe(item, 'card.card');

    if (point) {
      var buildingType = _maybe(item, 'building.building.edifice.onPoint.buildingType');
      return buildingType + " " + '(' + _qrpToString(_qrpFromPoint(point)) + ')';
    } else if (edge) {
      return "road " + _edgeToString(_edgeFromQRPs(edge));
    } else if (card) {
      return card;
    } else return "ERROR unknown item type: " + JSON.stringify(item); //should be one of known types!
  }).filter(function (d) { return !!d; }).join('; ');
}

d3Board._updateHUD = function(el, playerColor, state) {
  var hud = d3.select(el).select('#hud'),
      stateIndex = hud.select('#stateIndex'),
      players = hud.select('#players'),
      lastAction = hud.select('#lastAction'),
      validActions = hud.select('#validActions');

  stateIndex.text(state.index);

  var playersD = players.selectAll(".player")
    .data(state.data.players, function (d) { return d.playerIndex; });

  playersD.enter().append("div")
    .attr('class', 'player')
    .attr('id', function (d) { return "player" + d.playerIndex; })
    .style('color', function (d) { return playerColor(d.playerColor); });

  var playerInfo = playersD.selectAll(".playerInfo")
    .data(function (d) { return ["Player " + d.playerIndex,
                                 _showRes(d.resources),
                                 _showItems(d.constructed)]; 
                       });

  playerInfo.enter().append("div")
    .attr('class', 'playerInfo');

  playerInfo.text(function (d) { return d; });

  playerInfo.exit().remove();

  playersD.exit().remove();

  lastAction.text(JSON.stringify(state.data.lastAction));
  validActions.text(JSON.stringify(state.data.validActions));
};