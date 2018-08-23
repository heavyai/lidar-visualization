/* eslint-disable */
import MapDCon from '@mapd/connector/dist/browser-connector';
const defaultQueryOptions = {};
var deckgl;
var currentFilter={seaLevel:0,NOR:5,commercial:"COMM-MO','COMM",government:'GOVT',duplex:'DUP',quad:'QUAD',residential:'CA - Res',condo:'CA - Condo',SFR:'SFR',GP:1,HP:0,HP_check:0,freeze:0,pointSize:5,DTM:1,DSM:1}
var tooltip
var debounceZoom = debounce(function(v,boundingPoly){
  zoomCheck(v.zoom)
  executeQuery(boundingPoly);
}, 500);

//Establish connection with MapD using Mapd-connector

//Please enter Mapd server details
const connector = new MapdCon();
connector.protocol(protocol)
  .host(hostname)
  .port(port)
  .dbName(dbname)
  .user(username)
  .password(pwd) 
  .connectAsync()
  .then(session=>
    {
      var queries=queryBuild([[-81.36484675265373,31.130611454325006],[-81.36484675265373,30.997776159412396],[-81.47391023914975,30.997776159412396],[-81.47391023914975,31.130611454325006]])
      Promise.all([
        session.queryAsync(queries[0], defaultQueryOptions),
        session.queryAsync(queries[1], defaultQueryOptions)
      ])
      .then(values => {
        console.log(values);
        initializeDOM();
        var polygonData=dataTransformPoly(values[0]);
        createDeckGL(dataTransformPoint(values[1]),polygonData[0],polygonData[1]);
        $('#modal_loading').modal('hide')
    })
  })
  .catch(error => {
    console.error("Something bad happened: ", error)
  })

//Create deck.gl object

function createDeckGL(pointData,polygonFloodLayer,polygonBuildingLayer){
  deckgl = new deck.DeckGL({
  container: 'container',
  //mapStyle:'mapbox://styles/mapbox/satellite-streets-v9',
  mapboxApiAccessToken: 'pk.eyJ1IjoiZGlwdGlrb3RoYXJpIiwiYSI6ImNqaWt3YWZuazJpazUzcXF5M3p0aml3dWcifQ.cyNkWKiPEN2L3oUHgLOTeA',
  longitude: -81.41028,
  latitude: 31.10102,
  layers:[ addPointCloud(pointData),addPolygonBuildingHeight(polygonBuildingLayer),addPolygonFloodIndicator(polygonFloodLayer)],
  zoom:12,
  onViewportChange: v => {
    if(currentFilter.freeze==0)
    {
      debounceZoom(v,computeBoundingBox());
    }
  }
  });
}

//Compute Bounding Box
function computeBoundingBox(){
  //use screen size to get map coordinates
  var upperRight=deckgl.layerManager.viewports[0].unproject([deckgl.width,0]);
  var lowerRight=deckgl.layerManager.viewports[0].unproject([deckgl.width,deckgl.height]);
  var upperLeft=deckgl.layerManager.viewports[0].unproject([0,0]);
  var lowerLeft=deckgl.layerManager.viewports[0].unproject([0,deckgl.height]);
  return [upperRight,lowerRight,lowerLeft,upperLeft]
}

//Initialize Filter and DOMEvents
function initializeDOM(){
  console.log(currentFilter)
  document.getElementById("submitButton").addEventListener("click",function(){
    zoomCheck(deckgl.layerManager.viewports[0].zoom);
    currentFilter.seaLevel=parseInt(document.getElementById("seaRange").value);
    currentFilter.NOR=parseInt(document.getElementById("numberReturns").value);
    currentFilter.pointSize=parseInt(document.getElementById("pointSize").value)
    if($("#inlineCheckbox1").prop('checked')==true){
      currentFilter.commercial="COMM-MO','COMM"
    }
    else{
      currentFilter.commercial=''
    }
    if($("#inlineCheckbox2").prop('checked')==true){
      currentFilter.government='GOVT'
    }
    else{
      currentFilter.government=''
    }
    if($("#inlineCheckbox3").prop('checked')==true){
      currentFilter.duplex='DUP'
    }
    else{
      currentFilter.duplex=''
    }
    if($("#inlineCheckbox4").prop('checked')==true){
      currentFilter.quad='QUAD'
    }
    else{
      currentFilter.quad=''
    }
    if($("#inlineCheckbox5").prop('checked')==true){
      currentFilter.residential='CA - Res'
    }
    else{
      currentFilter.residential=''
    }
    if($("#inlineCheckbox6").prop('checked')==true){
      currentFilter.condo='CA - Condo'
    }
    else{
      currentFilter.condo=''
    }
    if($("#inlineCheckbox7").prop('checked')==true){
      currentFilter.SFR='SFR'
    }
    else{
      currentFilter.SFR=''
    }
    if($("#groundPoints").prop('checked')==true){
      currentFilter.GP=1
    }
    else{
      currentFilter.GP=0
    }
    if($("#highPrecision").prop('checked')==true){
      currentFilter.HP=1
    }
    else{
      currentFilter.HP=0
    }
    if($("#freeze").prop('checked')==true){
      currentFilter.freeze=1
    }
    else{
      currentFilter.freeze=0
    }
    if($("#DTM").prop('checked')==true){
      currentFilter.DTM=1
    }
    else{
      currentFilter.DTM=0
    }
    if($("#DSM").prop('checked')==true){
      currentFilter.DSM=1
    }
    else{
      currentFilter.DSM=0
    }
    executeQuery(computeBoundingBox())
  })
}


function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

//Prepare polygon data for deckgl polygon layer
function dataTransformPoly(values){
  var i,j;
  var polygonFloodLayer=[]
  var polygonBuildingLayer=[]
  var limit=currentFilter.seaLevel
  var assetVal=0
  for(i=0;i<values.length;i++){
    var z= values[i].mapd_geo.slice(10,(values[i].mapd_geo.length)-3).split(',')
    var MHHWadjustedZ=values[i].avg_z-3.27
    var floodHeight=limit-MHHWadjustedZ
    var contourFloodLayer=[];
    var contourBuildingLayer=[];
    if((MHHWadjustedZ)<=limit){
      assetVal+=values[i].BLDGVAL17
    }
    for (j=0; j<z.length;j++){
      var polyEdge=[parseFloat(z[j].split(' ')[0]),parseFloat(z[j].split(' ')[1])];
      contourFloodLayer.push([polyEdge[0],polyEdge[1],MHHWadjustedZ])
      if (floodHeight<0 || floodHeight>values[i].avg_ground){       
        polyEdge.push(MHHWadjustedZ)
      }
      else {
          polyEdge.push(MHHWadjustedZ+floodHeight)
        }
      contourBuildingLayer.push(polyEdge)
    }
    if (floodHeight<0){
      polygonFloodLayer.push({"Contour":contourFloodLayer,"Height":0,"assetValue":values[i].BLDGVAL17,"displayHeight":values[i].avg_ground,"displayZ":MHHWadjustedZ})
      polygonBuildingLayer.push({"Contour":contourBuildingLayer,"Height":values[i].avg_ground,"assetValue":values[i].BLDGVAL17,"displayHeight":values[i].avg_ground,"displayZ":MHHWadjustedZ})
    }
    else{
      if(floodHeight>values[i].avg_ground){
        polygonFloodLayer.push({"Contour":contourFloodLayer,"Height":values[i].avg_ground,"assetValue":values[i].BLDGVAL17,"displayHeight":values[i].avg_ground,"displayZ":MHHWadjustedZ})
        polygonBuildingLayer.push({"Contour":contourBuildingLayer,"Height":0,"assetValue":values[i].BLDGVAL17,"displayHeight":values[i].avg_ground,"displayZ":MHHWadjustedZ})  
      }
      else{
        polygonFloodLayer.push({"Contour":contourFloodLayer,"Height":floodHeight,"assetValue":values[i].BLDGVAL17,"displayHeight":values[i].avg_ground,"displayZ":MHHWadjustedZ})
        polygonBuildingLayer.push({"Contour":contourBuildingLayer,"Height":values[i].avg_ground-floodHeight,"assetValue":values[i].BLDGVAL17,"displayHeight":values[i].avg_ground,"displayZ":MHHWadjustedZ})
      }
    }
  }
  var polygonData=[polygonFloodLayer,polygonBuildingLayer]
  console.log(polygonFloodLayer,polygonBuildingLayer)
  document.getElementById('assetValue').value=assetVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return polygonData
  
}

//Prepare point data for deckgl point cloud layer
function dataTransformPoint(values) {
  var i;
  var data=[];
  for(i=0;i<values.length;i++){
    var obj={position:[values[i].X,values[i].Y,(values[i].Z+values[i].HeightAboveGround-3.27)],HeightAboveGround:(values[i].Z+values[i].HeightAboveGround-3.27),normal: [0, 0, 1],NOR:values[i].NumberOfReturns};
    data.push(obj);
  }
  return (data);
}

//Create Flood indicator layer
function addPolygonFloodIndicator(data){
  return new deck.PolygonLayer({
    id: 'polygon-indicator-layer',
    data,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: true,
    wireframe: true,
    lineWidthMinPixels: 0,
    getPolygon: d => d.Contour,
    getElevation: d => d.Height, 
    getFillColor: d => [0,255,255,255],
    getLineWidth: 0,
    fp64:true,
    onHover:info =>{tooltipEvent(info)}
  });
}

//Create Building height layer
function addPolygonBuildingHeight(data){
  return new deck.PolygonLayer({
    id: 'polygon-ground-layer',
    data,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: true,
    wireframe: true,
    lineWidthMinPixels: 1,
    getPolygon: d => d.Contour,
    getElevation: d => d.Height, 
    getFillColor: d => [178,34,34,255],
    getLineWidth: 1,
    fp64:true,
    onHover:info => {tooltipEvent(info)}
  });
}

//Tooltip function to display asset value
function tooltipEvent(info){
  const {x, y, object} = info;
  var tooltip=document.getElementById('container').querySelector("#tooltip")
  if (object) {
    tooltip.style.top = `${y}px`;
    tooltip.style.left = `${x}px`;
    tooltip.innerHTML = `
      <div><b>Asset Property Value &nbsp;</b></div>
      <div>${object.assetValue} $</div>
      <div><b>Height Above MHHW</b></div>
      <div>${(Math.round(object.displayZ*100))/100} ft</div>
      <div><b>Height Above Ground</b></div>
      <div>${(Math.round(object.displayHeight*100))/100} ft</div>
    `;
  } else { 
    tooltip.innerHTML = '';
  }
}

//Create Point cloud layer
function addPointCloud(data) {
  return new deck.PointCloudLayer({
    id: 'point-cloud-layer',
    coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    data: data,
    radiusPixels: currentFilter.pointSize,
    getPosition: d => d.position,
    getNormal: d => d.normal,
    getColor: d=>{
        if (d.HeightAboveGround<=(currentFilter.seaLevel)){
          return [0,255,255,255];
        }
        switch(d.NOR){
          case 5:return [0,52,0,255];
          case 4:return [0,103,0,255];
          case 3:return [0,154,0,255];
          case 2:return [0,179,0,255];
          case 1:return [234,208,168,255];
      }},
    updateTriggers: {getColor: [[0,52,0,255], [0,103,0,255],[0,154,0,255],[0,179,0,255],[234,208,168,255]]},
    lightSettings: {},
    fp64:true
  });
}

//Build query using bounding box(poly) and filter(currentFilter) values
function queryBuild(poly){
    var filterPoints=' AND NumberOfReturns<='+currentFilter.NOR
  //GP : Ground Points
  if(currentFilter.GP==0){
    filterPoints+=' AND Classification=1'
  }
  //Vegetation Points
  if(currentFilter.DTM==0){
    filterPoints+=' AND NumberOfReturns<=1'
  }
  //Elevated Non vegetation points
  if(currentFilter.DSM==0){
    filterPoints+=' AND NumberOfReturns>2'
  }
  if(currentFilter.HP_check==1 && currentFilter.HP==1){
    var pointQuery="SELECT X,Y,Z,HeightAboveGround,NumberOfReturns FROM jekyll_points WHERE ST_Contains(ST_GeomFromText('POLYGON(("+poly[0][0]+" "+poly[0][1]+","+poly[1][0]+" "+poly[1][1]+","+poly[2][0]+" "+poly[2][1]+","+poly[3][0]+" "+poly[3][1]+"))'),mapd_geo) "+filterPoints+" LIMIT 500000";
  }
  else{
    var rows_passing_filters="(SELECT COUNT(rowid) FROM jekyll_points WHERE ST_Contains(ST_GeomFromText('POLYGON(("+poly[0][0]+" "+poly[0][1]+","+poly[1][0]+" "+poly[1][1]+","+poly[2][0]+" "+poly[2][1]+","+poly[3][0]+" "+poly[3][1]+"))'),mapd_geo) "+filterPoints+")";
    var pointQuery="SELECT X,Y,Z,HeightAboveGround,NumberOfReturns FROM jekyll_points WHERE MOD(jekyll_points.rowid * 2654435761, 4294967296) < "+"((50000*4294967296)/"+rows_passing_filters+") AND ST_Contains(ST_GeomFromText('POLYGON(("+poly[0][0]+" "+poly[0][1]+","+poly[1][0]+" "+poly[1][1]+","+poly[2][0]+" "+poly[2][1]+","+poly[3][0]+" "+poly[3][1]+"))'),mapd_geo) "+filterPoints+" LIMIT 50000";
  }
  var filterPoly="AND CLASS IN ('"+currentFilter.commercial+"','"+currentFilter.government+"','"+currentFilter.duplex+"','"+currentFilter.quad+"','"+currentFilter.residential+"','"+currentFilter.condo+"','"+currentFilter.SFR+"')"
  var polyQuery = "SELECT mapd_geo,avg_z,avg_ground,BLDGVAL17 FROM jekyll_polygons WHERE SHAPE_area<12291479 AND FID_1 IN (SELECT DISTINCT(FID_1) FROM jekyll_polygonVertices WHERE ST_Contains(ST_GeomFromText('POLYGON(("+poly[0][0]+" "+poly[0][1]+","+poly[1][0]+" "+poly[1][1]+","+poly[2][0]+" "+poly[2][1]+","+poly[3][0]+" "+poly[3][1]+"))'),mapd_geo)) "+filterPoly;
  return [polyQuery,pointQuery]
}

//Enable/Disable High Precision based on zoom level
function zoomCheck(zoom){
  if(zoom==20){
    $("#highPrecision").bootstrapToggle('enable');
    currentFilter.HP_check=1
  }
  else{
    $('#highPrecision').bootstrapToggle('off');
    $("#highPrecision").bootstrapToggle('disable');
    currentFilter.HP_check=0
    currentFilter.HP=0
  }
}

//Request query from MapD
function executeQuery(boundingPoly){
  var queries=queryBuild([boundingPoly[0],boundingPoly[1],boundingPoly[2],boundingPoly[3]])
  Promise.all([
    connector.queryAsync(queries[0],defaultQueryOptions),
    connector.queryAsync(queries[1],defaultQueryOptions)
  ]).then(values=>{
    console.log(values)
    var polygonData=dataTransformPoly(values[0])
    deckgl.setProps({layers: [addPointCloud(dataTransformPoint(values[1])),addPolygonBuildingHeight(polygonData[1]),addPolygonFloodIndicator(polygonData[0])]});
  })
}

