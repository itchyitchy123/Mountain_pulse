const resorts = {
  copper: {name:'Copper Mountain',short:'Copper',score:83,label:'Excellent right now',temp:'18°',snow:'7″',wind:'W 12',terrain:'93%',factors:{Snow:89,Crowds:76,'Lift lines':84,Terrain:91,Wind:72},move:'Super Bee → Excelerator → Resolution',reason:'Fast lifts, cold north-facing snow, and traffic is moving away from the east side.',wait:'7 min',ski:'31 min',vertical:'2,430 ft',avoid:'Avoid Center Village',avoidReason:'for ~45 min — lines are building quickly.',parking:68,full:'Full around 10:18',lots:[68,41,22],powder:[['Copper Bowl',94,'Wind-loaded · high alpine'],['Resolution',91,'North-facing · low traffic'],['Spaulding',82,'Soft chalk · moderate traffic'],['Union Bowl',73,'Wind affected · tracked']]},
  abasin: {name:'Arapahoe Basin',short:'A-Basin',score:94,label:'Exceptional day',temp:'12°',snow:'9″',wind:'W 18',terrain:'88%',factors:{Snow:98,Crowds:91,'Lift lines':95,Terrain:96,Wind:72},move:'Lenawee → Beavers → Steep Gullies',reason:'Fresh refills on the west aspect and unusually light traffic beyond Lenawee.',wait:'5 min',ski:'38 min',vertical:'2,210 ft',avoid:'Skip Black Mountain Express',avoidReason:'for ~25 min — a ski school wave just arrived.',parking:82,full:'Full around 10:02',lots:[82,74,36],powder:[['Steep Gullies',96,'Fresh refill · expert terrain'],['The Beavers',93,'West aspect · low traffic'],['East Wall',86,'High alpine · wind-loaded'],['Montezuma Bowl',78,'Soft snow · filling in']]},
  loveland: {name:'Loveland Ski Area',short:'Loveland',score:91,label:'Powder window open',temp:'9°',snow:'11″',wind:'W 23',terrain:'84%',factors:{Snow:97,Crowds:94,'Lift lines':93,Terrain:88,Wind:61},move:'Chair 4 → Ptarmigan → The Ridge',reason:'Wind is loading the upper bowls and reported traffic remains low.',wait:'4 min',ski:'34 min',vertical:'2,080 ft',avoid:'Avoid Chair 2',avoidReason:'for ~30 min — intermittent wind holds.',parking:55,full:'Full around 10:47',lots:[55,37,18],powder:[['The Ridge',95,'Wind-loaded · low traffic'],['Rock Chutes',90,'Deep pockets · expert terrain'],['Chair 4 Trees',87,'Sheltered · fresh'],['Busy Gully',76,'Good snow · more traffic']]},
  winter: {name:'Winter Park',short:'Winter Park',score:79,label:'Very good right now',temp:'16°',snow:'5″',wind:'NW 9',terrain:'96%',factors:{Snow:81,Crowds:69,'Lift lines':73,Terrain:94,Wind:88},move:'Pano → Parsenn Bowl → Eagle Wind',reason:'Pano is spinning with soft snow and Eagle Wind traffic is still below average.',wait:'11 min',ski:'35 min',vertical:'2,570 ft',avoid:'Avoid Village Cabriolet',avoidReason:'for ~40 min — base traffic is peaking.',parking:76,full:'Full around 10:11',lots:[76,62,31],powder:[['Pano Trees',88,'7 recent stokes · sheltered'],['Eagle Wind',84,'Low traffic · soft'],['Parsenn Bowl',77,'Wind buff · moderate traffic'],['Mary Jane Chutes',69,'Tracked but chalky']]},
  eldora: {name:'Eldora Mountain',short:'Eldora',score:74,label:'Good and improving',temp:'21°',snow:'3″',wind:'NW 14',terrain:'91%',factors:{Snow:72,Crowds:78,'Lift lines':82,Terrain:76,Wind:67},move:'Alpenglow → Corona → Salto Glades',reason:'Corona lines are dropping and shaded trees are holding the best surface.',wait:'6 min',ski:'26 min',vertical:'1,640 ft',avoid:'Avoid Indian Peaks',avoidReason:'for ~20 min — a short maintenance pause is building a queue.',parking:63,full:'Full around 10:32',lots:[63,48,26],powder:[['Salto Glades',81,'Shaded · good trees'],['Moose Glades',77,'Soft pockets · low traffic'],['Corona Bowl',70,'Wind buff · tracked'],['West Ridge',61,'Thin in exposed areas']]}
};

Object.entries(MountainPulseData.resorts).forEach(([key,canonical])=>{
  const resort=resorts[key];
  resort.score=canonical.pulse.score;
  resort.label=canonical.pulse.label;
  resort.temp=`${canonical.conditions.temperature_f}°`;
  resort.snow=`${canonical.conditions.snow_24h_in}″`;
  resort.wind=canonical.conditions.wind.replace(' mph','');
  resort.terrain=`${canonical.conditions.terrain_open_pct}%`;
  resort.factors={Snow:canonical.pulse.factors.snow,Crowds:canonical.pulse.factors.crowds,'Lift lines':canonical.pulse.factors.lift_lines,Terrain:canonical.pulse.factors.terrain,Wind:canonical.pulse.factors.wind};
});
const operations=Object.fromEntries(Object.entries(MountainPulseData.resorts).map(([key,resort])=>[key,MountainPulseData.toUiOperations(resort)]));

const destinations=[
  {key:'abasin',arrival:'8:04 AM',parking:'82%',snow:'9.1',crowds:'Moderate',score:94,requirement:'Reservation may be required'},
  {key:'loveland',arrival:'7:48 AM',parking:'91%',snow:'9.4',crowds:'Low',score:91},
  {key:'copper',arrival:'8:16 AM',parking:'68%',snow:'8.7',crowds:'Moderate',score:83},
  {key:'winter',arrival:'8:31 AM',parking:'59%',snow:'8.1',crowds:'Busy',score:79},
  {key:'eldora',arrival:'7:52 AM',parking:'74%',snow:'7.2',crowds:'Moderate',score:74}
];
const heatMaps={
  copper:{labels:['12,313′','RESOLUTION BOWL','EAST VILLAGE','CENTER VILLAGE'],zones:[['Copper Bowl',94,'hot'],['Resolution',91,'hot'],['Spaulding',82,'good'],['Super Bee',86,'good'],['Center Village',54,'busy'],['West Village',41,'poor']]},
  abasin:{labels:['13,050′','EAST WALL','THE BEAVERS','BASE AREA'],zones:[['East Wall',92,'hot'],['Steep Gullies',96,'hot'],['The Beavers',93,'hot'],['Pallavicini',87,'good'],['Lenawee',72,'good'],['Base Area',52,'busy']]},
  loveland:{labels:['13,010′','THE RIDGE','LOVELAND VALLEY','MAIN BASE'],zones:[['The Ridge',95,'hot'],['Rock Chutes',90,'hot'],['Chair 4 Trees',87,'good'],['Ptarmigan',85,'good'],['Main Base',65,'busy'],['Loveland Valley',71,'good']]},
  winter:{labels:['12,060′','PARSENN BOWL','MARY JANE','WINTER PARK BASE'],zones:[['Pano Trees',88,'hot'],['Eagle Wind',84,'good'],['Parsenn Bowl',77,'good'],['Mary Jane',73,'good'],['Village Way',48,'poor'],['Winter Park Base',57,'busy']]},
  eldora:{labels:['10,600′','CORONA BOWL','FRONT SIDE','INDIAN PEAKS'],zones:[['Salto Glades',81,'good'],['Moose Glades',77,'good'],['Corona Bowl',70,'good'],['West Ridge',61,'busy'],['Indian Peaks',49,'poor'],['Front Side',72,'good']]}
};

const resortMeta={
  copper:{feels:'Feels 9°',contributors:1284,lots:['Alpine','Far East','Chapel']},
  abasin:{feels:'Feels -4°',contributors:964,lots:['Early Riser','High Noon','Last Chance'],reservation:'Weekend parking may require a reservation. Verify before departing.'},
  loveland:{feels:'Feels -8°',contributors:718,lots:['Main Lot','Valley Lot','Lot 4']},
  winter:{feels:'Feels 7°',contributors:1532,lots:['North Bench','Corona','Village Garage']},
  eldora:{feels:'Feels 12°',contributors:486,lots:['Main Lot','Lower Lot','Nordic Lot']}
};
const changeFeeds={
  copper:['Three Bears remains closed','Resolution traffic ↓ 18%','West wind strengthening'],
  abasin:['Beavers traffic ↓ 12%','East Wall wind loading','Black Mountain wait +4m'],
  loveland:['Lift 9 moved to wind hold','Chair 4 traffic ↓ 21%','Ridge refill improving'],
  winter:['Pano wait ↓ 3m','Eagle Wind staying quiet','Base congestion increasing'],
  eldora:['Corona wait ↓ 4m','Indian Peaks delayed','Salto trees holding snow']
};

const recommendationOptions={
  copper:[
    {ability:'intermediate',title:'American Flyer → Timberline → West Village',destination:'West Village',requires:['Timberline Express'],reason:'A lower-commitment lap with manageable queues and straightforward terrain.',wait:'9 min',ski:'24 min',vertical:'1,620 ft',confidence:74,scores:{snow:70,quiet:82,fast:76},flat:true},
    {ability:'advanced',title:'Super Bee → Excelerator → Resolution',destination:'Resolution',requires:['Super Bee','Excelerator'],reason:'Fast lifts, cold north-facing snow, and traffic is moving away from the east side.',wait:'7 min',ski:'31 min',vertical:'2,430 ft',confidence:78,scores:{snow:92,quiet:80,fast:86}},
    {ability:'expert',title:'Sierra → Mountain Chief → Copper Bowl',destination:'Copper Bowl',requires:['Three Bears'],reason:'The highest soft-snow probability, with expert terrain and more exposure.',wait:'10 min',ski:'35 min',vertical:'2,180 ft',confidence:71,scores:{snow:97,quiet:90,fast:65},warning:'Expert terrain—verify gates and patrol status.'}
  ],
  abasin:[
    {ability:'intermediate',title:'Black Mountain → Lenawee → Lenawee',destination:'Lenawee',requires:['Black Mountain','Lenawee Express'],reason:'The best supported option that avoids hike-to and extreme terrain.',wait:'12 min',ski:'25 min',vertical:'1,480 ft',confidence:76,scores:{snow:76,quiet:68,fast:78}},
    {ability:'advanced',title:'Lenawee → Beavers → The Beavers',destination:'The Beavers',requires:['Lenawee Express','Beavers'],reason:'Fresh west-aspect refills with light traffic beyond Lenawee.',wait:'5 min',ski:'34 min',vertical:'2,020 ft',confidence:81,scores:{snow:93,quiet:91,fast:79}},
    {ability:'expert',title:'Lenawee → East Wall → East Wall',destination:'East Wall',requires:['Lenawee Express'],reason:'High-alpine wind loading offers the strongest snow signal.',wait:'6 min',ski:'42 min',vertical:'1,940 ft',confidence:65,scores:{snow:96,quiet:95,fast:54},warning:'Extreme hike-to terrain—verify access, weather, and patrol status.'}
  ],
  loveland:[
    {ability:'intermediate',title:'Chair 4 → Apollo → Ptarmigan',destination:'Ptarmigan',requires:['Lift 4','Ptarmigan'],reason:'Sheltered terrain and short waits without committing to the Ridge.',wait:'5 min',ski:'23 min',vertical:'1,510 ft',confidence:79,scores:{snow:79,quiet:83,fast:86}},
    {ability:'advanced',title:'Chair 4 → Rock Chutes → Chair 4 Trees',destination:'Chair 4 Trees',requires:['Lift 4'],reason:'Deep pockets and low traffic in sheltered upper-mountain terrain.',wait:'4 min',ski:'30 min',vertical:'1,880 ft',confidence:77,scores:{snow:91,quiet:90,fast:81}},
    {ability:'expert',title:'Lift 9 → The Ridge → The Ridge',destination:'The Ridge',requires:['Lift 9'],reason:'The strongest refill signal when the high-alpine lift is available.',wait:'—',ski:'36 min',vertical:'2,080 ft',confidence:42,scores:{snow:96,quiet:94,fast:30},warning:'High-alpine expert terrain—verify wind and patrol status.'}
  ],
  winter:[
    {ability:'intermediate',title:'Explorer → High Lonesome → Parsenn Bowl',destination:'Parsenn Bowl',requires:['Panoramic'],reason:'A broad, lower-commitment lap with good wind-buffed snow.',wait:'8 min',ski:'27 min',vertical:'1,760 ft',confidence:73,scores:{snow:76,quiet:75,fast:80},flat:true},
    {ability:'advanced',title:'Pano → Parsenn Bowl → Eagle Wind',destination:'Eagle Wind',requires:['Panoramic','Eagle Wind'],reason:'Panoramic is spinning and Eagle Wind traffic remains below average.',wait:'11 min',ski:'35 min',vertical:'2,570 ft',confidence:75,scores:{snow:85,quiet:84,fast:72}},
    {ability:'expert',title:'Super Gauge → Mary Jane → Pano Trees',destination:'Pano Trees',requires:['Super Gauge'],reason:'Recent Stoke signals favor sheltered trees over exposed bowls.',wait:'13 min',ski:'33 min',vertical:'2,240 ft',confidence:70,scores:{snow:90,quiet:76,fast:68}}
  ],
  eldora:[
    {ability:'intermediate',title:'Alpenglow → Corona → Front Side',destination:'Front Side',requires:['Alpenglow','Corona'],reason:'Short waits and predictable terrain while Indian Peaks is delayed.',wait:'5 min',ski:'21 min',vertical:'1,310 ft',confidence:80,scores:{snow:68,quiet:75,fast:90}},
    {ability:'advanced',title:'Alpenglow → Corona → Salto Glades',destination:'Salto Glades',requires:['Alpenglow','Corona'],reason:'Corona lines are dropping and shaded trees hold the best surface.',wait:'6 min',ski:'26 min',vertical:'1,640 ft',confidence:76,scores:{snow:84,quiet:82,fast:83}},
    {ability:'expert',title:'Corona → Moose Glades → West Ridge',destination:'Moose Glades',requires:['Corona'],reason:'Soft sheltered pockets with the lowest modeled skier traffic.',wait:'7 min',ski:'29 min',vertical:'1,590 ft',confidence:69,scores:{snow:82,quiet:91,fast:73}}
  ]
};

const conditionTypes={
  fresh:{emoji:'❄️',label:'Fresh'},untracked:{emoji:'🔥',label:'Untracked'},icy:{emoji:'🧊',label:'Icy'},thin:{emoji:'🪨',label:'Thin coverage'},
  windblown:{emoji:'🌬',label:'Windblown'},moguls:{emoji:'🥔',label:'Moguls'},trees:{emoji:'🌲',label:'Good trees'},hazard:{emoji:'⚠️',label:'Hazard'}
};
let enabledResortIds=Object.keys(resorts),dataLoadedAt=Date.now();
let runtimeMode='demo',routingEnabled=true,installationAuthRequired=false,currentRecommendation=null,alternateIndex=0,selectedCondition='';

function loadLocal(key,fallback){
  try{
    const value=JSON.parse(localStorage.getItem(key));
    if(value===null)return fallback;
    if(Array.isArray(fallback))return Array.isArray(value)?value:fallback;
    if(fallback&&typeof fallback==='object')return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback;
    return typeof value===typeof fallback?value:fallback;
  }catch{return fallback}
}
function loadRecords(key){return loadLocal(key,[]).filter(value=>value&&typeof value==='object'&&!Array.isArray(value))}
function saveLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function escapeHTML(value){return String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]))}
function getReporterId(){let id=loadLocal('mountainpulse-reporter-id','');if(!id){id=globalThis.crypto?.randomUUID?.()||`device-${Date.now()}`;saveLocal('mountainpulse-reporter-id',id)}return id}
const reporterId=getReporterId();

function localSignalAdjustment(zone){
  return MountainPulseScoring.calculateAdjustment(loadRecords('mountainpulse-signals'),{resort:current,zone});
}

function trustedLocalReportCount(){
  const now=Date.now(),reporters=new Set();
  loadRecords('mountainpulse-signals').filter(signal=>signal.resort===current&&now-signal.observedAt>=0&&now-signal.observedAt<7200000).forEach(signal=>reporters.add(signal.reporterId||'legacy-device'));
  return reporters.size;
}

function adjustedScore(zone,base){return Math.max(0,Math.min(100,base+localSignalAdjustment(zone)))}
function heatState(score){return score>=89?'hot':score>=69?'good':score>=50?'busy':'poor'}

let current='copper', toastTimer;
const $=selector=>document.querySelector(selector);

function renderResort(key,{announce=true}={}){
  current=key;
  const resort=resorts[key];
  const meta=resortMeta[key];
  $('#resortName').textContent=resort.name;
  $('#pulseScore').textContent=resort.score;
  $('#pulseLabel').textContent=resort.label;
  $('#temp').textContent=resort.temp;
  $('#feelsLike').textContent=meta.feels;
  $('#snow').textContent=resort.snow;
  $('#wind').textContent=resort.wind;
  $('#openTerrain').textContent=resort.terrain;
  $('#pulseFactors').innerHTML=Object.entries(resort.factors).map(([name,value])=>`<div><span>${name}</span><strong>${value}</strong></div>`).join('');
  $('#avoidArea').textContent=resort.avoid;
  $('#avoidReason').textContent=resort.avoidReason;
  const localParking=loadRecords('mountainpulse-parking').filter(report=>report.resort===key);
  const parkingEstimate=MountainPulseParkingModel.estimateParking(resort.parking,localParking);
  $('#parkingCapacity').textContent=`${parkingEstimate.capacity}%`;
  $('#parkingMeter').style.width=`${parkingEstimate.capacity}%`;
  $('#parkingLabel').textContent=parkingEstimate.reportCount?`${parkingEstimate.status} · ${parkingEstimate.reportCount} local report${parkingEstimate.reportCount===1?'':'s'}`:parkingEstimate.status;
  $('#parkingConfidence').textContent=`${parkingEstimate.confidence}% ${parkingEstimate.reportCount?'local estimate':'scenario'} confidence${parkingEstimate.reportCount?' · unique device reports included':' · historical scenario only'}`;
  $('#parkingFull').textContent=resort.full;
  [$('#alpineLot'),$('#farEastLot'),$('#chapelLot')].forEach((element,index)=>element.textContent=`${resort.lots[index]}%`);
  [$('#lotName1'),$('#lotName2'),$('#lotName3')].forEach((element,index)=>element.textContent=meta.lots[index]);
  const localCount=loadRecords('mountainpulse-signals').filter(signal=>signal.resort===key&&Date.now()-signal.observedAt>=0&&Date.now()-signal.observedAt<7200000).length;
  $('#contributorCount').textContent=`${meta.contributors.toLocaleString()} ${runtimeMode==='production'?'reported':'simulated'} movement signals${localCount?` · ${localCount} saved locally`:''}`;
  document.querySelectorAll('.resort-menu button').forEach(button=>button.classList.toggle('active',button.dataset.key===key));
  renderOperations();
  renderPowder();
  renderHeatMap();
  renderReports();
  renderLeaderboard();
  renderChanges();
  alternateIndex=0;
  renderRecommendation();
  renderTravelAlert();
  updateRouteSessionUi();
  closeResortMenu();
  if(announce) showToast(`${resort.short} ${runtimeMode==='production'?'snapshot':'demo pulse'} loaded`);
}

function renderChanges(){
  $('#changeList').innerHTML=changeFeeds[current].map(change=>`<span>• ${escapeHTML(change)}</span>`).join('');
}

function eligibleRecommendations(){
  if(!routingEnabled)return [];
  const reports=loadRecords('mountainpulse-signals');
  return MountainPulseRouteEngine.rankRoutes(recommendationOptions[current],{
    ability:$('#abilityPreference').value,
    ride:$('#ridePreference').value,
    priority:$('#priorityPreference').value,
    operations:operations[current].lifts,
    signalAdjustment:localSignalAdjustment,
    outcomeAdjustment:localOutcomeAdjustment,
    safetyEvaluation:route=>MountainPulseSafetyEngine.evaluateRoute(route,{operations:operations[current].lifts,reports,resort:current})
  });
}

function localOutcomeAdjustment(route){
  const preferences={ability:$('#abilityPreference').value,ride:$('#ridePreference').value,priority:$('#priorityPreference').value};
  const outcomes=loadRecords('mountainpulse-feedback').filter(outcome=>outcome.resort===current&&(outcome.destination===route.destination||outcome.route===route.title)).slice(-20);
  if(!outcomes.length)return 0;
  const value=outcomes.reduce((sum,outcome)=>{
    const contextMatch=Object.entries(preferences).every(([key,value])=>outcome.preferences?.[key]===value);
    const rating=outcome.rating==='nailed'?5:outcome.rating==='missed'?-7:0;
    return sum+rating*(contextMatch?1:.5);
  },0)/outcomes.length;
  return Math.max(-8,Math.min(6,Math.round(value)));
}

function confidenceSources(){
  const localReports=trustedLocalReportCount();
  const outcomes=loadRecords('mountainpulse-feedback').filter(outcome=>outcome.resort===current);
  const outcomeQuality=outcomes.length?outcomes.reduce((sum,outcome)=>sum+(outcome.rating==='nailed'?1:(outcome.rating==='fine'?0.6:0.15)),0)/outcomes.length:0.45;
  return [
    ...['operations','weather','webcam','movement'].map(name=>({name,...MountainPulseData.sourceMeta[name]})),
    {name:'community',available:localReports>0,quality:Math.min(.7,.2+localReports*.1),freshness:1,weight:1},
    {name:'historical',...MountainPulseData.sourceMeta.historical,quality:outcomes.length?outcomeQuality:MountainPulseData.sourceMeta.historical.quality}
  ];
}

function renderRecommendation(){
  const options=eligibleRecommendations();
  const option=options.length?options[alternateIndex%options.length]:null;
  if(!option){
    currentRecommendation=null;
    $('#moveTitle').textContent='No eligible route right now';
    $('#moveReason').textContent=routingEnabled?'Every modeled option conflicts with your ability setting or current lift operations. Check official resort status.':'Routing is withheld until licensed topology and production safety validation are configured.';
    $('#waitTime').textContent='—';$('#skiTime').textContent='—';$('#vertical').textContent='—';
    $('#routeConfidence').innerHTML='<i></i> Route withheld';
    $('#routeButton').disabled=true;
    $('#sourceLedger').innerHTML='<div class="source-item"><strong>Safety constraint</strong><span>No route clears all hard filters</span><b>Withheld</b></div>';
    updateRouteSessionUi();
    return;
  }
  currentRecommendation=option;
  $('#routeButton').disabled=false;
  $('#moveTitle').textContent=option.title;
  const snowboardWarning=$('#ridePreference').value==='snowboard'&&option.flat?'Flat-section risk for snowboarders.':'';
  const warnings=[option.warning,snowboardWarning,...(option.safety?.warnings||[])].filter(Boolean);
  $('#moveReason').innerHTML=`${escapeHTML(option.reason)}${warnings.length?` <span class="route-warning">${warnings.map(escapeHTML).join(' ')}</span>`:''}`;
  $('#waitTime').textContent=option.wait;
  $('#skiTime').textContent=option.ski;
  $('#vertical').textContent=option.vertical;
  option.calculatedConfidence=MountainPulseRouteEngine.calculateConfidence(option.confidence,confidenceSources());
  const isScenario=confidenceSources().filter(source=>source.available).every(source=>source.mode==='simulation'||source.name==='community');
  $('#routeConfidence').innerHTML=`<i></i> ${option.calculatedConfidence}% ${isScenario?'scenario':'evidence'} confidence`;
  const routeLegs=option.title.split(' → ');
  document.querySelectorAll('.route-node:not(.start)').forEach((node,index)=>node.textContent=(routeLegs[index]||'').split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase());
  document.querySelectorAll('.zone').forEach(zone=>zone.classList.remove('route-active'));
  renderSourceLedger(option);
  updateRouteSessionUi();
}

function renderSourceLedger(option){
  const saved=trustedLocalReportCount();
  const outcomes=loadRecords('mountainpulse-feedback').filter(outcome=>outcome.resort===current);
  const nailed=outcomes.filter(outcome=>outcome.rating==='nailed').length;
  const adjustment=localSignalAdjustment(option.destination);
  const outcomeAdjustment=localOutcomeAdjustment(option);
  const sources=[
    ['Resort operations',MountainPulseData.sourceMeta.operations.label,MountainPulseData.sourceMeta.operations.mode],
    ['Weather & snowfall',MountainPulseData.sourceMeta.weather.label,MountainPulseData.sourceMeta.weather.mode],
    ['Webcam verification',MountainPulseData.sourceMeta.webcam.label,'Unavailable'],
    ['Movement model',MountainPulseData.sourceMeta.movement.label,'simulation'],
    ['Community reports',`${saved} local · ${saved?'under 2h old':'none yet'}`,adjustment?`${adjustment>0?'+':''}${adjustment} personal`:'No adjustment'],
    ['Outcome calibration',outcomes.length?`${outcomes.length} device ratings · ${Math.round(nailed/outcomes.length*100)}% nailed`:'No completed-route ratings',`${outcomeAdjustment>0?'+':''}${outcomeAdjustment} rank · ${option.calculatedConfidence}% combined`]
  ];
  $('#sourceLedger').innerHTML=sources.map(([name,detail,confidence])=>`<div class="source-item"><strong>${name}</strong><span>${detail}</span><b>${confidence}</b></div>`).join('');
}

function renderTravelAlert(){
  const month=new Date().getMonth();
  const offSeason=month>=5&&month<=8;
  const reservation=resortMeta[current].reservation;
  $('#travelAlert').innerHTML=`<strong>${offSeason?'Off-season demo':'Demo forecast'}</strong><span>${reservation?`${reservation} `:''}Connect current CDOT incidents, traction laws, and resort rules before departing.</span>`;
}

function applyCanonicalSnapshot(key,canonical,response){
  if(!canonical||canonical.id!==key||!canonical.pulse||!canonical.conditions||!Array.isArray(canonical.lifts)||!Array.isArray(canonical.runs))throw new Error(`Incomplete snapshot for ${key}`);
  const resort=resorts[key],conditions=canonical.conditions,pulse=canonical.pulse;
  resort.name=canonical.name||resort.name;
  resort.score=Number.isFinite(pulse.score)?pulse.score:resort.score;
  resort.label=pulse.label||resort.label;
  resort.temp=Number.isFinite(conditions.temperature_f)?`${conditions.temperature_f}°`:'—';
  resort.snow=Number.isFinite(conditions.snow_24h_in)?`${conditions.snow_24h_in}″`:'—';
  resort.wind=typeof conditions.wind==='string'?conditions.wind.replace(' mph',''):'—';
  resort.terrain=Number.isFinite(conditions.terrain_open_pct)?`${conditions.terrain_open_pct}%`:'—';
  if(pulse.factors)resort.factors={Snow:pulse.factors.snow,Crowds:pulse.factors.crowds,'Lift lines':pulse.factors.lift_lines,Terrain:pulse.factors.terrain,Wind:pulse.factors.wind};
  resortMeta[key].feels=Number.isFinite(conditions.feels_like_f)?`Feels ${conditions.feels_like_f}°`:'Feels unavailable';
  if(Number.isFinite(canonical.crowds?.contributors))resortMeta[key].contributors=canonical.crowds.contributors;
  operations[key]=MountainPulseData.toUiOperations(canonical);
  const sourceMode=response.source?.mode||'unknown';
  ['operations','weather','movement'].forEach(name=>{MountainPulseData.sourceMeta[name].mode=sourceMode;MountainPulseData.sourceMeta[name].available=!response.stale;MountainPulseData.sourceMeta[name].freshness=response.stale?.1:1;MountainPulseData.sourceMeta[name].label=`${sourceMode} normalized feed`});
}

function showProductionUnavailable(){
  routingEnabled=false;
  Object.values(resorts).forEach(resort=>{resort.score='—';resort.label='Live data unavailable';resort.temp='—';resort.snow='—';resort.wind='—';resort.terrain='—'});
  Object.keys(operations).forEach(key=>{operations[key]={count:'0/0 status available',lifts:[],runs:[]}});
  renderStaticLists();
  renderResort(current,{announce:false});
  $('#updatedTime').textContent='Waiting for a fresh official snapshot';
}

async function refreshApiSnapshots(){
  try{
    const runtimeResponse=await fetch('/api/v1/runtime',{cache:'no-store'});
    if(!runtimeResponse.ok)throw new Error(`Runtime endpoint returned ${runtimeResponse.status}`);
    const runtime=await runtimeResponse.json();
    runtimeMode=runtime.mode;
    routingEnabled=Boolean(runtime.routing_enabled);
    installationAuthRequired=Boolean(runtime.installation_auth_required);
    enabledResortIds=Array.isArray(runtime.resort_ids)?runtime.resort_ids.filter(key=>Object.hasOwn(resorts,key)):Object.keys(resorts);
    if(!enabledResortIds.length)throw new Error('Runtime has no supported resorts');
    if(!enabledResortIds.includes(current))current=enabledResortIds[0];
    $('#runtimeLabel').textContent=runtime.simulation?'Interactive winter demo':'Connected mountain data';
    document.querySelector('.live-dot').classList.toggle('demo-dot',runtime.simulation);
    const results=await Promise.all(enabledResortIds.map(async key=>{
      const response=await fetch(`/api/v1/resorts/${encodeURIComponent(key)}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`${key} snapshot returned ${response.status}`);
      const payload=await response.json();
      if(!payload.simulation&&payload.stale)throw new Error(`${key} snapshot is stale`);
      applyCanonicalSnapshot(key,payload.data,payload);
      return payload;
    }));
    dataLoadedAt=Date.now();
    const observed=results.map(result=>Date.parse(result.observed_at)).filter(Number.isFinite).sort((a,b)=>b-a)[0];
    $('#updatedTime').textContent=observed?`Observed ${formatAge(observed).replace(' · this device','')}`:'Snapshot loaded now';
    renderStaticLists();
    renderResort(current,{announce:false});
  }catch(error){
    if(runtimeMode==='production')showProductionUnavailable();
    console.warn('Mountain snapshot refresh failed',error);
  }
}

function renderOperations(){
  const data=operations[current];
  $('#openCount').textContent=data.count;
  $('#liftList').innerHTML=data.lifts.map(([name,area,wait,trend,level])=>`<div class="lift-row"><strong><span style="color:${wait==='Closed'||wait==='Wind hold'?'#db5347':'#11a36a'}">●</span> ${name}</strong><small>${area}</small><div class="lift-wait ${level}"><b>${wait}</b><span class="trend">${trend}</span></div></div>`).join('');
  $('#runList').innerHTML=data.runs.map(([name,detail,status,state])=>`<div class="run-row"><strong>${name}</strong><small>${detail}</small><span class="status-pill ${state}">${status}</span></div>`).join('');
}

function renderPowder(){
  $('#powderList').innerHTML=resorts[current].powder.map(([name,probability,reason])=>{
    const adjustment=localSignalAdjustment(name),score=adjustedScore(name,probability);
    return `<div class="powder-row ${adjustment?'adjusted':''}"><strong>${name}<small>${reason}</small>${adjustment?`<small class="score-adjustment">Personal signal overlay ${adjustment>0?'+':''}${adjustment}; base ${probability}</small>`:''}</strong><div class="probability-track" aria-label="${score}% powder probability"><i style="--probability:${score}%"></i></div><b>${score}%</b></div>`;
  }).join('');
}

function renderHeatMap(){
  const map=heatMaps[current];
  ['peak','basin','east','center'].forEach((name,index)=>$(`.map-label.${name}`).textContent=map.labels[index]);
  document.querySelectorAll('.zone').forEach((zone,index)=>{
    const [name,baseScore]=map.zones[index];
    const score=adjustedScore(name,baseScore),state=heatState(score);
    zone.dataset.zone=name;
    zone.className=`zone ${state}`;
    zone.querySelector('b').textContent=state==='hot'?'🔥':'●';
    zone.querySelector('span').innerHTML=`${name}<small>${score}</small>`;
  });
  $('#reportZone').innerHTML='<option value="">Choose a zone</option>'+map.zones.map(([name])=>`<option value="${name}">${name}</option>`).join('');
  $('#zonePopover').hidden=true;
}

function renderReports(){
  const powder=resorts[current].powder;
  const modeledReports=[
    ['🔥',powder[0][0],'Fresh & lightly tracked','simulated community scenario','Heating up'],
    ['❄️',powder[1][0],powder[1][2],'simulated community scenario',`${(powder[1][1]/10).toFixed(1)} / 10`],
    ['🌬',powder[2][0],powder[2][2],'simulated community scenario','Watch wind'],
    ['⚠️',powder[3][0],powder[3][2],'8 min ago · simulated model','Use caution']
  ];
  const localReports=loadRecords('mountainpulse-signals')
    .filter(signal=>signal.resort===current&&Date.now()-signal.observedAt<7200000)
    .sort((a,b)=>b.observedAt-a.observedAt)
    .map(signal=>{const condition=conditionTypes[signal.condition];return [condition?.emoji||(signal.type==='stoke'?'🔥':'💀'),signal.zone,condition?`${condition.label} · ${signal.type==='stoke'?'Stoke':'Don’t bother'}`:signal.type==='stoke'?'Local Stoke signal':'Local warning signal',formatAge(signal.observedAt),'Saved locally']});
  $('#reportList').innerHTML=[...localReports,...modeledReports].map(([emoji,run,condition,meta,tag])=>`<div class="report-row"><div class="report-emoji">${escapeHTML(emoji)}</div><div><h3>${escapeHTML(run)}</h3><small>${escapeHTML(meta)}</small></div><p>${escapeHTML(condition)}</p><span class="report-tag ${tag==='Saved locally'?'local-signal':''}">${escapeHTML(tag)}</span></div>`).join('');
}

function formatAge(timestamp){
  const minutes=Math.max(0,Math.floor((Date.now()-timestamp)/60000));
  return minutes<1?'just now · this device':`${minutes} min ago · this device`;
}

function renderLeaderboard(){
  const ranked=Object.entries(resorts).filter(([key])=>enabledResortIds.includes(key)).sort((a,b)=>b[1].score-a[1].score);
  $('#leaderboardList').innerHTML=ranked.map(([key,resort],index)=>`<button class="leaderboard-row ${key===current?'current':''}" data-key="${key}" aria-label="Load ${resort.name}, pulse ${resort.score}"><span>${index+1}</span><strong>${resort.short}</strong><b>${resort.score}${resort.score>90?' 🔥':''}</b></button>`).join('');
}

function renderStaticLists(){
  $('#resortMenu').innerHTML=Object.entries(resorts).filter(([key])=>enabledResortIds.includes(key)).map(([key,resort])=>`<button role="menuitem" data-key="${key}" class="${key===current?'active':''}"><span>${resort.name}</span><small>${resort.score}</small></button>`).join('');
  renderDestinations();
}

function renderDestinations(){
  const hasReservation=$('#abasinReservation').checked;
  const ranked=destinations.filter(item=>enabledResortIds.includes(item.key)).sort((a,b)=>{
    const aEligible=a.key!=='abasin'||hasReservation;
    const bEligible=b.key!=='abasin'||hasReservation;
    return Number(bEligible)-Number(aEligible)||b.score-a.score;
  });
  let eligibleRank=0;
  $('#destinationList').innerHTML=ranked.map(item=>{
    const resort=resorts[item.key];
    const eligible=item.key!=='abasin'||hasReservation;
    if(eligible)eligibleRank+=1;
    return `<div class="destination-row ${eligible&&eligibleRank===1?'winner':''} ${eligible?'':'ineligible'}"><span class="destination-rank">${eligible&&eligibleRank===1?'🏆':eligible?eligibleRank:'—'}</span><div class="destination-name"><strong>${resort.short}</strong><small>${eligible?`Arrive ${item.arrival}`:item.requirement}</small></div><div class="destination-metric"><small>Parking chance</small><b>${item.parking}</b></div><div class="destination-metric"><small>Snow score</small><b>${item.snow}</b></div><div class="destination-metric"><small>Crowds</small><b>${item.crowds}</b></div><span class="destination-score">${eligible?item.score:'Not eligible'}</span></div>`;
  }).join('');
}

function closeResortMenu(){
  $('#resortMenu').classList.remove('open');
  $('#resortPicker').setAttribute('aria-expanded','false');
}

function showToast(message){
  const toast=$('#toast');
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);
}

function enqueuePrototypeSync(path,payload){
  const queue=loadRecords('mountainpulse-sync-outbox');
  queue.push({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),path,payload,queuedAt:Date.now()});
  saveLocal('mountainpulse-sync-outbox',queue.slice(-100));
}

async function syncPrototype(path,payload,{queueOnFailure=true}={}){
  if(!navigator.onLine){if(queueOnFailure)enqueuePrototypeSync(path,payload);return {synced:false,reason:'offline'};}
  try{
    let installationToken=loadLocal('mountainpulse-installation-token','');
    if(installationAuthRequired&&!installationToken){
      const installationResponse=await fetch('/api/v1/installations',{method:'POST',keepalive:true});
      if(!installationResponse.ok)throw new Error('installation registration failed');
      installationToken=(await installationResponse.json()).token||'';
      if(!installationToken||!saveLocal('mountainpulse-installation-token',installationToken))throw new Error('installation token could not be retained');
    }
    const headers={'Content-Type':'application/json'};
    if(installationToken)headers.Authorization=`Installation ${installationToken}`;
    const response=await fetch(path,{method:'POST',headers,body:JSON.stringify(payload),keepalive:true});
    const result=await response.json().catch(()=>({}));
    if(!response.ok&&queueOnFailure&&(response.status===429||response.status>=500))enqueuePrototypeSync(path,payload);
    return response.ok?{synced:true,...result}:{synced:false,status:response.status,reason:result.message||`HTTP ${response.status}`};
  }catch{if(queueOnFailure)enqueuePrototypeSync(path,payload);return {synced:false,reason:'network unavailable'}}
}

let flushingOutbox=false;
async function flushPrototypeOutbox(){
  if(flushingOutbox||!navigator.onLine)return;
  flushingOutbox=true;
  try{
    const queue=loadRecords('mountainpulse-sync-outbox'),remaining=[];
    const attemptedIds=new Set(queue.map(item=>item.id));
    for(const item of queue){
      if(!item||typeof item.path!=='string'||!item.path.startsWith('/api/v1/'))continue;
      const result=await syncPrototype(item.path,item.payload,{queueOnFailure:false});
      if(!result.synced&&(result.status===429||!result.status||result.status>=500))remaining.push(item);
    }
    const queuedDuringFlush=loadRecords('mountainpulse-sync-outbox').filter(item=>!attemptedIds.has(item.id));
    const finalQueue=[...remaining,...queuedDuringFlush].slice(-100);
    saveLocal('mountainpulse-sync-outbox',finalQueue);
    if(queue.length&&!finalQueue.length)showToast('Offline reports synced');
  }finally{
    flushingOutbox=false;
  }
}

function submitReport(type){
  const success=$('#reportSuccess');
  const signals=loadRecords('mountainpulse-signals').filter(signal=>Date.now()-signal.observedAt<7200000);
  const zone=$('#reportZone').value;
  if(!zone){success.textContent='Choose the run or zone before sending a signal.';success.classList.add('show');showToast('Please confirm where you just rode');setTimeout(()=>success.classList.remove('show'),3000);return}
  if(signals.some(signal=>signal.resort===current&&Date.now()-signal.observedAt<10000)){showToast('Signal already saved — wait a few seconds before reporting again');return}
  const effectiveType=selectedCondition==='hazard'?'bother':type;
  const signal={id:globalThis.crypto?.randomUUID?.()||String(Date.now()),reporterId,resort:current,zone,type:effectiveType,condition:selectedCondition||null,observedAt:Date.now()};
  signals.push(signal);
  const retainedSignals=signals.slice(-50);
  const saved=saveLocal('mountainpulse-signals',retainedSignals);
  success.textContent=saved?(effectiveType==='stoke'?'🔥 Stoke saved on this device.':'💀 Warning saved on this device.'):'Could not save this report on this device.';
  success.classList.add('show');
  showToast(saved?'Signal saved locally · syncing prototype aggregate…':'Local storage unavailable');
  if(saved)syncPrototype('/api/v1/reports',{...signal,kind:'condition'}).then(result=>showToast(result.synced?(result.published?'Signal synced and aggregate published':'Signal synced · awaiting independent corroboration'):'Saved locally · sync will need a retry'));
  renderReports();
  renderPowder();
  renderHeatMap();
  renderRecommendation();
  const localCount=retainedSignals.filter(item=>item.resort===current).length;
  $('#contributorCount').textContent=`${resortMeta[current].contributors.toLocaleString()} simulated movement signals · ${localCount} saved locally`;
  selectedCondition='';
  document.querySelectorAll('#conditionPicker button').forEach(button=>{button.setAttribute('aria-pressed','false')});
  setTimeout(()=>success.classList.remove('show'),4000);
}

function startRouteSession(){
  if(!currentRecommendation)return;
  const active=loadLocal('mountainpulse-active-route',null);
  if(active?.resort===current&&active.route===currentRecommendation.title){showToast('This lap is already active');return}
  if(active){showToast('Finish or rate your active lap before starting another');return}
  const session={
    id:globalThis.crypto?.randomUUID?.()||String(Date.now()),resort:current,route:currentRecommendation.title,destination:currentRecommendation.destination,
    confidence:currentRecommendation.calculatedConfidence,startedAt:Date.now(),preferences:{ability:$('#abilityPreference').value,ride:$('#ridePreference').value,priority:$('#priorityPreference').value}
  };
  saveLocal('mountainpulse-active-route',session);
  $('#feedbackRoute').textContent=`After you finish: ${session.route}`;
  $('#routeFeedback').hidden=false;
  $('#routeButton').innerHTML='Route active <span>✓</span>';
}

function updateRouteSessionUi(){
  const session=loadLocal('mountainpulse-active-route',null);
  if(!session||session.resort!==current){$('#routeFeedback').hidden=true;$('#routeButton').innerHTML='Start lap <span>→</span>';return}
  $('#feedbackRoute').textContent=`After you finish: ${session.route}`;
  $('#routeFeedback').hidden=false;
  $('#routeButton').innerHTML=currentRecommendation?.title===session.route?'Route active <span>✓</span>':'Start lap <span>→</span>';
}

function recordRouteFeedback(rating){
  const session=loadLocal('mountainpulse-active-route',null);
  if(!session){showToast('Start a route before rating it');return}
  const outcomes=loadRecords('mountainpulse-feedback');
  const outcome={...session,rating,completedAt:Date.now(),elapsedMinutes:Math.max(1,Math.round((Date.now()-session.startedAt)/60000))};
  outcomes.push(outcome);
  saveLocal('mountainpulse-feedback',outcomes.slice(-100));
  try{localStorage.removeItem('mountainpulse-active-route')}catch{}
  $('#routeFeedback').hidden=true;
  $('#routeButton').innerHTML='Start lap <span>→</span>';
  alternateIndex=0;
  renderRecommendation();
  syncPrototype('/api/v1/route-outcomes',outcome);
  showToast(rating==='nailed'?'Recommendation nailed — calibration saved 🔥':rating==='fine'?'Route outcome saved':'Miss recorded — this is the signal that improves recommendations');
}

function showOperations(panel){
  const lifts=panel==='lifts';
  $('#liftList').hidden=!lifts;
  $('#runList').hidden=lifts;
  $('#liftTab').classList.toggle('active',lifts);
  $('#runTab').classList.toggle('active',!lifts);
  $('#liftTab').setAttribute('aria-selected',lifts);
  $('#runTab').setAttribute('aria-selected',!lifts);
  $('#liftTab').tabIndex=lifts?0:-1;
  $('#runTab').tabIndex=lifts?-1:0;
}

function setLiftMode(enabled){
  document.body.classList.toggle('lift-mode',enabled);
  $('#liftModeButton').setAttribute('aria-pressed',String(enabled));
  $('#liftModeButton').textContent=enabled?'Exit lift mode':'Lift mode';
  saveLocal('mountainpulse-lift-mode',enabled);
  if(enabled)document.querySelector('.best-move').scrollIntoView({block:'start'});
}

const savedPreferences=loadLocal('mountainpulse-preferences',{ability:'advanced',ride:'ski',priority:'snow'});
$('#abilityPreference').value=['intermediate','advanced','expert'].includes(savedPreferences.ability)?savedPreferences.ability:'advanced';
$('#ridePreference').value=['ski','snowboard'].includes(savedPreferences.ride)?savedPreferences.ride:'ski';
$('#priorityPreference').value=['snow','quiet','fast'].includes(savedPreferences.priority)?savedPreferences.priority:'snow';
$('#abasinReservation').checked=loadLocal('mountainpulse-abasin-reservation',false);
renderStaticLists();
renderResort('copper',{announce:false});
setLiftMode(loadLocal('mountainpulse-lift-mode',false));
refreshApiSnapshots();

$('#resortPicker').addEventListener('click',()=>{
  const open=$('#resortMenu').classList.toggle('open');
  $('#resortPicker').setAttribute('aria-expanded',open);
  if(open)($('#resortMenu .active')||$('#resortMenu button'))?.focus();
});
$('#resortMenu').addEventListener('click',event=>{const button=event.target.closest('button');if(button){renderResort(button.dataset.key);$('#resortPicker').focus()}});
$('#leaderboardList').addEventListener('click',event=>{const button=event.target.closest('button');if(button){renderResort(button.dataset.key);window.scrollTo({top:0,behavior:'smooth'})}});
document.addEventListener('click',event=>{if(!event.target.closest('.resort-picker')&&!event.target.closest('.resort-menu'))closeResortMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menuOpen=$('#resortMenu').classList.contains('open');closeResortMenu();$('#zonePopover').hidden=true;if(menuOpen)$('#resortPicker').focus()}});
$('#resortMenu').addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();
  const items=[...$('#resortMenu').querySelectorAll('button')],index=items.indexOf(document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:event.key==='ArrowDown'?(index+1)%items.length:(index-1+items.length)%items.length;
  items[next]?.focus();
});
$('#liftTab').addEventListener('click',()=>showOperations('lifts'));
$('#runTab').addEventListener('click',()=>showOperations('runs'));
document.querySelector('.operation-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=event.key==='Home'?$('#liftTab'):event.key==='End'?$('#runTab'):event.target===$('#liftTab')?$('#runTab'):$('#liftTab');
  next.click();
  next.focus();
});
$('#abasinReservation').addEventListener('change',event=>{saveLocal('mountainpulse-abasin-reservation',event.target.checked);renderDestinations();showToast(event.target.checked?'A-Basin is now eligible in this demo':'A-Basin removed until parking eligibility is confirmed')});
$('#conditionPicker').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  const next=selectedCondition===button.dataset.condition?'':button.dataset.condition;
  selectedCondition=next;
  document.querySelectorAll('#conditionPicker button').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.condition===next)));
});
$('#routeFeedback').addEventListener('click',event=>{const button=event.target.closest('[data-rating]');if(button)recordRouteFeedback(button.dataset.rating)});
$('#liftModeButton').addEventListener('click',()=>setLiftMode(!document.body.classList.contains('lift-mode')));
[$('#abilityPreference'),$('#ridePreference'),$('#priorityPreference')].forEach(control=>control.addEventListener('change',()=>{
  alternateIndex=0;
  saveLocal('mountainpulse-preferences',{ability:$('#abilityPreference').value,ride:$('#ridePreference').value,priority:$('#priorityPreference').value});
  renderRecommendation();
  showToast('Recommendation updated for your preferences');
}));
$('#stokeButton').addEventListener('click',()=>submitReport('stoke'));
$('#botherButton').addEventListener('click',()=>submitReport('bother'));
$('#mobileReport').addEventListener('click',()=>{document.querySelector('.quick-report').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('#stokeButton').focus(),500)});
document.querySelector('.avatar').addEventListener('click',()=>{document.querySelector('.best-move').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('#abilityPreference').focus(),500);showToast('Adjust your skier profile in the recommendation controls')});
$('#alternateRoute').addEventListener('click',()=>{alternateIndex+=1;renderRecommendation();showToast('Showing the next eligible option')});
$('#routeButton').addEventListener('click',()=>{
  const zones=[...document.querySelectorAll('.zone')];
  const target=zones.find(zone=>zone.dataset.zone.toLowerCase()===currentRecommendation.destination.toLowerCase())||zones.find(zone=>currentRecommendation.title.toLowerCase().includes(zone.dataset.zone.toLowerCase()));
  zones.forEach(zone=>zone.classList.remove('route-active'));
  if(target){
    target.classList.add('route-active');
    target.focus({preventScroll:true});
    target.click();
    document.querySelector('.mountain-card').scrollIntoView({behavior:'smooth',block:'center'});
    startRouteSession();
    showToast(`Route destination highlighted: ${currentRecommendation.destination}`);
  }else showToast('This demo route has no mapped destination yet');
});
$('#locationButton').addEventListener('click',()=>{
  if(!navigator.geolocation){showToast(`Location unavailable — showing ${resorts[current].short} base area`);return}
  showToast('Requesting device location…');
  navigator.geolocation.getCurrentPosition(()=>showToast('Location granted; real trail geometry is required to position you'),()=>showToast(`Location unavailable — showing ${resorts[current].short} demo map`),{timeout:5000});
});
document.querySelectorAll('.zone').forEach(zone=>zone.addEventListener('click',event=>{
  event.stopPropagation();
  const popover=$('#zonePopover');
  const name=zone.dataset.zone;
  const score=zone.querySelector('small')?.textContent||'86';
  popover.innerHTML=`<strong>${name} · ${score} demo pulse</strong><span>Soft snow · ${Number(score)>85?'low':'moderate'} modeled traffic<br>Simulated scenario</span>`;
  popover.hidden=false;
  popover.style.left=`min(calc(100% - 195px), ${zone.style.getPropertyValue('--x')})`;
  popover.style.top=`calc(${zone.style.getPropertyValue('--y')} + 30px)`;
}));
$('#mountainMap').addEventListener('click',()=>$('#zonePopover').hidden=true);
$('#refreshMap').addEventListener('click',()=>{
  const button=$('#refreshMap');
  button.disabled=true;
  button.textContent='Updating…';
  setTimeout(()=>{button.disabled=false;button.innerHTML='Refresh map <span>↻</span>';$('#updatedTime').textContent='Scenario reloaded now';renderReports();showToast('Demo scenario re-rendered — no live source is connected')},800);
});
document.querySelector('.parking-report').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(button){
    const reports=loadRecords('mountainpulse-parking').filter(report=>Date.now()-report.observedAt<7200000);
    if(reports.some(report=>report.resort===current&&Date.now()-report.observedAt<30000)){showToast('Recent parking report already saved');return}
    reports.push({reporterId,resort:current,level:button.dataset.level,observedAt:Date.now()});
    const saved=saveLocal('mountainpulse-parking',reports.slice(-50));
    if(saved)renderResort(current,{announce:false});
    showToast(saved?'Parking report saved locally · syncing prototype aggregate…':'Local storage unavailable');
    if(saved)syncPrototype('/api/v1/reports',{reporterId,resort:current,zone:resortMeta[current].lots[0],kind:'parking',level:button.dataset.level,observedAt:Date.now()}).then(result=>showToast(result.synced?(result.published?'Parking aggregate published':'Parking report synced · awaiting corroboration'):'Saved locally · sync will need a retry'));
  }
});
document.querySelector('.text-button').addEventListener('click',()=>showToast('All recent community reports are already shown'));
setInterval(()=>{const minutes=Math.max(1,Math.floor((Date.now()-dataLoadedAt)/60000));$('#updatedTime').textContent=`${runtimeMode==='production'?'Snapshot':'Scenario'} loaded ${minutes} min ago`},30000);
setInterval(refreshApiSnapshots,60000);

function updateConnectivity(){
  let banner=document.querySelector('.offline-banner');
  if(!navigator.onLine){
    if(!banner){banner=document.createElement('div');banner.className='offline-banner';banner.textContent='Offline — showing cached demo data';document.body.append(banner)}
  }else banner?.remove();
}
window.addEventListener('online',()=>{updateConnectivity();flushPrototypeOutbox()});
window.addEventListener('offline',updateConnectivity);
updateConnectivity();
flushPrototypeOutbox();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
