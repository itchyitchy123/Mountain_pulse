const {createHash,createHmac,randomBytes,randomUUID} = require('node:crypto');

const conditionTypes=new Set(['fresh','untracked','icy','thin','windblown','moguls','trees','hazard']);
const parkingLevels=new Set(['Plenty','Filling','Almost full','Turn around']);
const reportTtlMs=7200000;
const movementTtlMs=86400000;
const maximumObservationTtlMs=604800000;
const maximumReportClockSkewMs=300000;
const observationResources=new Set(['summary','lifts','runs','conditions','crowds','pulse']);

class DataPlatform{
  constructor({reportThreshold=2,movementThreshold=3,now=()=>Date.now(),repository=null,identityHashSecret=null}={}){
    this.now=now;
    this.reportThreshold=reportThreshold;
    this.movementThreshold=movementThreshold;
    this.observations=new Map();
    this.sources=new Map();
    this.reports=[];
    this.outcomes=[];
    this.reportCooldowns=new Map();
    this.movement=new Map();
    this.resortIds=new Set();
    this.repository=repository;
    const stableSecret=identityHashSecret?Buffer.from(identityHashSecret):null;
    this.reporterSalt=stableSecret?createHmac('sha256',stableSecret).update('reporters').digest():randomBytes(24);
    this.movementSalt=stableSecret?createHmac('sha256',stableSecret).update('movement').digest():randomBytes(24);
    this.lastIngestedRecords=[];
  }

  ingest(source,observations){
    const sourceId=strictString(source?.id,120);
    if(!sourceId)throw validationError('source id is required');
    if(!Array.isArray(observations))throw validationError('observations must be an array');
    const receivedAt=new Date(this.now()).toISOString();
    let accepted=0;
    const acceptedRecords=[];
    for(const observation of observations){
      const resortId=strictString(observation?.resortId,80),resource=strictString(observation?.resource,80);
      if(!resortId||!observationResources.has(resource)||!validObservationData(resource,observation.data,resortId))continue;
      const observedAt=new Date(observation.observedAt||receivedAt);
      if(Number.isNaN(observedAt.valueOf()))continue;
      const requestedTtlMs=Number(observation.ttlMs);
      const ttlMs=Number.isFinite(requestedTtlMs)&&requestedTtlMs>0?Math.max(1000,Math.min(maximumObservationTtlMs,requestedTtlMs)):300000;
      const expiresAt=new Date(observedAt.valueOf()+ttlMs);
      if(Number.isNaN(expiresAt.valueOf()))continue;
      this.resortIds.add(resortId);
      const record={...observation,resortId,resource,sourceId,sourceMode:source.mode||'unknown',observedAt:observedAt.toISOString(),receivedAt,expiresAt:expiresAt.toISOString(),quality:Math.max(0,Math.min(1,Number(observation.quality) || 0))};
      const key=`${record.resortId}:${record.resource}`;
      const current=this.observations.get(key);
      if(!current||current.observedAt<=record.observedAt){this.observations.set(key,record);acceptedRecords.push(record);accepted+=1}
    }
    const previous=this.sources.get(sourceId);
    this.sources.set(sourceId,{id:sourceId,label:cleanString(source.label,160)||sourceId,mode:cleanString(source.mode,40)||'unknown',status:accepted?'healthy':'degraded',lastSuccessAt:accepted?receivedAt:(previous?.lastSuccessAt||null),lastAttemptAt:receivedAt,acceptedObservations:accepted});
    this.lastIngestedRecords=acceptedRecords;
    return accepted;
  }

  sourceHealth(){return [...this.sources.values()]}

  resource(resortId,resource){return this.observations.get(`${resortId}:${resource}`)||null}

  snapshot(resortId){
    const resources=['summary','lifts','runs','conditions','crowds','pulse'];
    const records=Object.fromEntries(resources.map(resource=>[resource,this.resource(resortId,resource)]).filter(([,record])=>record));
    if(!records.summary)return null;
    const data={...records.summary.data};
    for(const resource of resources.filter(name=>name!=='summary'))if(records[resource])data[resource]=records[resource].data;
    return {data,resources:records,stale:resources.some(resource=>!records[resource]||new Date(records[resource].expiresAt).valueOf()<=this.now())};
  }

  submitReport(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw validationError('report body must be an object');
    const now=this.now();
    this.pruneTransientState(now);
    const reporterId=cleanString(input.reporterId,100),resort=cleanString(input.resort,40),zone=cleanString(input.zone,120);
    const kind=cleanString(input.kind,20);
    if(!reporterId||!resort||!zone)throw validationError('reporterId, resort, and zone are required');
    if(!this.resortIds.has(resort))throw validationError('unknown resort');
    if(!['condition','parking'].includes(kind))throw validationError('report kind must be condition or parking');
    if(kind==='condition'&&!['stoke','bother'].includes(input.type))throw validationError('condition report type must be stoke or bother');
    if(input.condition&&!conditionTypes.has(input.condition))throw validationError('unknown condition');
    if(kind==='parking'&&!parkingLevels.has(input.level))throw validationError('unknown parking level');
    const observedAt=normalizeReportTime(input.observedAt,now);
    const reporterHash=createHash('sha256').update(this.reporterSalt).update(reporterId).digest('hex');
    const cooldownKey=`${reporterHash}:${resort}:${kind}`;
    const cooldownMs=kind==='parking'?30000:10000;
    if(now-(this.reportCooldowns.get(cooldownKey)||0)<cooldownMs)throw rateLimitError('report cooldown active');
    const report={id:randomUUID(),reporterHash,resort,zone,kind,type:kind==='condition'?input.type:null,condition:kind==='condition'?(input.condition||null):null,level:kind==='parking'?input.level:null,observedAt,receivedAt:new Date(now).toISOString()};
    const commit=aggregate=>{
      this.reportCooldowns.set(cooldownKey,now);
      this.reports.push(report);
      this.reports=this.reports.filter(item=>now-new Date(item.observedAt).valueOf()>=0&&now-new Date(item.observedAt).valueOf()<reportTtlMs).slice(-5000);
      const matched=aggregate||this.localReportAggregates(resort).find(item=>item.zone===zone&&item.kind===kind&&item.type===report.type&&item.condition===report.condition&&item.level===report.level);
      return {accepted:true,id:report.id,published:Boolean(matched),independentReporters:matched?.reporterCount||1};
    };
    return this.repository?this.repository.saveReport(report,{cooldownMs,threshold:this.reportThreshold}).then(commit):commit();
  }

  reportAggregates(resort){
    return this.repository?this.repository.reportAggregates(resort,{threshold:this.reportThreshold,now:this.now()}):this.localReportAggregates(resort);
  }

  localReportAggregates(resort){
    const now=this.now(),groups=new Map();
    this.reports.filter(report=>report.resort===resort&&now-new Date(report.observedAt).valueOf()>=0&&now-new Date(report.observedAt).valueOf()<reportTtlMs).forEach(report=>{
      const key=JSON.stringify([report.kind,report.zone,report.type,report.condition,report.level]);
      if(!groups.has(key))groups.set(key,{kind:report.kind,zone:report.zone,type:report.type,condition:report.condition,level:report.level,reporters:new Map(),latestObservedAt:report.observedAt});
      const group=groups.get(key),prior=group.reporters.get(report.reporterHash);
      if(!prior||prior.observedAt<report.observedAt)group.reporters.set(report.reporterHash,report);
      if(group.latestObservedAt<report.observedAt)group.latestObservedAt=report.observedAt;
    });
    return [...groups.values()].filter(group=>group.reporters.size>=this.reportThreshold).map(({reporters,...group})=>({...group,reporterCount:reporters.size,verified:reporters.size>=this.reportThreshold}));
  }

  submitOutcome(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw validationError('outcome body must be an object');
    const resort=cleanString(input.resort,40),route=cleanString(input.route,240),rating=cleanString(input.rating,20);
    if(!resort||!route||!['nailed','fine','missed'].includes(rating))throw validationError('resort, route, and a valid rating are required');
    if(!this.resortIds.has(resort))throw validationError('unknown resort');
    const confidence=optionalFiniteRange(input.confidence,0,100,'confidence');
    const elapsedMinutes=optionalFiniteRange(input.elapsedMinutes,0,720,'elapsedMinutes');
    const outcome={id:randomUUID(),resort,route,destination:cleanString(input.destination,120)||null,rating,confidence,elapsedMinutes,preferences:safePreferences(input.preferences),completedAt:new Date(this.now()).toISOString()};
    const commit=()=>{this.outcomes.push(outcome);this.outcomes=this.outcomes.slice(-10000);return {accepted:true,id:outcome.id}};
    return this.repository?this.repository.saveOutcome(outcome).then(commit):commit();
  }

  submitMovementBatch(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw validationError('movement batch body must be an object');
    const now=this.now();
    this.pruneTransientState(now);
    const deviceId=cleanString(input.deviceId,120),resort=cleanString(input.resort,40),samples=Array.isArray(input.samples)?input.samples:[];
    if(!deviceId||!resort||!samples.length||samples.length>100)throw validationError('deviceId, resort, and 1-100 aggregate samples are required');
    if(!this.resortIds.has(resort))throw validationError('unknown resort');
    const normalizedSamples=samples.map(sample=>{
      if(!sample||typeof sample!=='object'||Array.isArray(sample))throw validationError('movement samples must be objects');
      if(['lat','lon','latitude','longitude','coordinates','geometry'].some(key=>Object.hasOwn(sample,key)))throw validationError('raw coordinates are not accepted; submit edge-level aggregates only');
      const edgeId=cleanString(sample.edgeId,160),window=normalizeWindow(sample.window,now);
      const durationSeconds=finiteRange(sample.durationSeconds,1,7200);
      if(!edgeId||!window||durationSeconds===null)throw validationError('each movement sample requires a valid edgeId, window, and durationSeconds');
      return {edgeId,window,durationSeconds};
    });
    const sampleKeys=new Set(normalizedSamples.map(sample=>`${sample.edgeId}:${sample.window}`));
    if(sampleKeys.size!==normalizedSamples.length)throw validationError('movement batch contains duplicate edge windows');
    const deviceHash=createHash('sha256').update(this.movementSalt).update(deviceId).digest('hex');
    const commit=(persistedPublished=null)=>{
      const published=[];
      for(const {edgeId,window,durationSeconds} of normalizedSamples){
      const key=`${resort}:${edgeId}:${window}`;
      if(!this.movement.has(key))this.movement.set(key,{resort,edgeId,window,devices:new Map()});
      this.movement.get(key).devices.set(deviceHash,durationSeconds);
      const aggregate=this.movement.get(key);
      if(aggregate.devices.size>=this.movementThreshold){
        const durations=[...aggregate.devices.values()].sort((a,b)=>a-b);
        const middle=Math.floor(durations.length/2);
        const medianSeconds=durations.length%2?durations[middle]:(durations[middle-1]+durations[middle])/2;
        published.push({edgeId,window,deviceCount:durations.length,medianSeconds});
      }
      }
      return {accepted:true,storedSamples:normalizedSamples.length,published:persistedPublished||published};
    };
    return this.repository?this.repository.saveMovementSamples({resort,deviceHash,samples:normalizedSamples,threshold:this.movementThreshold}).then(commit):commit();
  }

  pruneTransientState(now=this.now()){
    for(const [key,lastReportAt] of this.reportCooldowns){
      if(now-lastReportAt>=reportTtlMs)this.reportCooldowns.delete(key);
    }
    for(const [key,aggregate] of this.movement){
      if(now-new Date(aggregate.window).valueOf()>=movementTtlMs)this.movement.delete(key);
    }
  }
}

function cleanString(value,max){return typeof value==='string'?value.trim().slice(0,max):''}
function strictString(value,max){if(typeof value!=='string')return '';const cleaned=value.trim();return cleaned.length<=max?cleaned:''}
function finiteNumber(value,min,max){return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max}
function validObservationData(resource,data,resortId){
  if(resource==='lifts')return Array.isArray(data)&&data.every(lift=>strictString(lift?.name,160)&&['open','closed','hold','unknown'].includes(lift.status)&&(lift.wait_minutes===null||finiteNumber(lift.wait_minutes,0,240)));
  if(resource==='runs')return Array.isArray(data)&&data.every(run=>strictString(run?.name,160)&&['open','closed','hold','caution','unknown'].includes(run.status));
  if(!data||typeof data!=='object'||Array.isArray(data))return false;
  if(resource==='conditions')return finiteNumber(data.temperature_f,-100,150)&&finiteNumber(data.snow_24h_in,0,500)&&finiteNumber(data.terrain_open_pct,0,100)&&strictString(data.wind,80);
  if(resource==='crowds')return strictString(data.level,40)&&strictString(data.trend,160)&&finiteNumber(data.contributors,0,10000000);
  if(resource==='pulse')return finiteNumber(data.score,0,100)&&strictString(data.label,160)&&data.factors&&['snow','crowds','lift_lines','terrain','wind'].every(name=>finiteNumber(data.factors[name],0,100));
  return resource==='summary'&&data.id===resortId&&strictString(data.name,160)&&strictString(data.state,40)&&validObservationData('pulse',data.pulse,resortId)&&validObservationData('conditions',data.conditions,resortId)&&validObservationData('crowds',data.crowds,resortId)&&validObservationData('lifts',data.lifts,resortId)&&validObservationData('runs',data.runs,resortId);
}
function finiteRange(value,min,max){const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?number:null}
function optionalFiniteRange(value,min,max,name){if(value===undefined||value===null)return null;const number=finiteRange(value,min,max);if(number===null)throw validationError(`${name} must be between ${min} and ${max}`);return number}
function normalizeReportTime(value,now){
  if(value===undefined||value===null||value==='')return new Date(now).toISOString();
  const parsed=new Date(value),timestamp=parsed.valueOf();
  if(Number.isNaN(timestamp)||now-timestamp>=reportTtlMs||timestamp-now>maximumReportClockSkewMs)throw validationError('observedAt must be a valid time within the report freshness window');
  return parsed.toISOString();
}
function normalizeWindow(value,now){const parsed=new Date(value);if(Number.isNaN(parsed.valueOf())||Math.abs(parsed.valueOf()-now)>86400000)return null;parsed.setUTCSeconds(0,0);return parsed.toISOString()}
function safePreferences(value){
  if(value===undefined||value===null)return {ability:null,ride:null,priority:null};
  if(typeof value!=='object'||Array.isArray(value))throw validationError('preferences must be an object');
  const preferences={ability:cleanString(value.ability,20)||null,ride:cleanString(value.ride,20)||null,priority:cleanString(value.priority,20)||null};
  if(preferences.ability&&!['intermediate','advanced','expert'].includes(preferences.ability))throw validationError('unknown ability preference');
  if(preferences.ride&&!['ski','snowboard'].includes(preferences.ride))throw validationError('unknown ride preference');
  if(preferences.priority&&!['snow','quiet','fast'].includes(preferences.priority))throw validationError('unknown priority preference');
  return preferences;
}
function validationError(message){return Object.assign(new Error(message),{statusCode:400,code:'invalid_request'})}
function rateLimitError(message){return Object.assign(new Error(message),{statusCode:429,code:'rate_limited'})}

module.exports={DataPlatform};
