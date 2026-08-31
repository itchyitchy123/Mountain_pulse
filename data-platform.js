const {createHash,randomBytes,randomUUID} = require('node:crypto');

const conditionTypes=new Set(['fresh','untracked','icy','thin','windblown','moguls','trees','hazard']);
const parkingLevels=new Set(['Plenty','Filling','Almost full','Turn around']);
const reportTtlMs=7200000;
const movementTtlMs=86400000;

class DataPlatform{
  constructor({reportThreshold=2,movementThreshold=3,now=()=>Date.now()}={}){
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
    this.reporterSalt=randomBytes(24);
    this.movementSalt=randomBytes(24);
  }

  ingest(source,observations){
    const receivedAt=new Date(this.now()).toISOString();
    let accepted=0;
    for(const observation of observations){
      if(!observation?.resortId||!observation?.resource||observation.data===undefined)continue;
      this.resortIds.add(observation.resortId);
      const observedAt=new Date(observation.observedAt||receivedAt);
      if(Number.isNaN(observedAt.valueOf()))continue;
      const ttlMs=Math.max(1000,Number(observation.ttlMs)||300000);
      const record={...observation,sourceId:source.id,sourceMode:source.mode||'unknown',observedAt:observedAt.toISOString(),receivedAt,expiresAt:new Date(observedAt.valueOf()+ttlMs).toISOString(),quality:Math.max(0,Math.min(1,Number(observation.quality) || 0))};
      const key=`${record.resortId}:${record.resource}`;
      const current=this.observations.get(key);
      if(!current||current.observedAt<=record.observedAt){this.observations.set(key,record);accepted+=1}
    }
    this.sources.set(source.id,{id:source.id,label:source.label||source.id,mode:source.mode||'unknown',status:accepted?'healthy':'degraded',lastSuccessAt:accepted?receivedAt:null,lastAttemptAt:receivedAt,acceptedObservations:accepted});
    return accepted;
  }

  sourceHealth(){return [...this.sources.values()]}

  resource(resortId,resource){return this.observations.get(`${resortId}:${resource}`)||null}

  snapshot(resortId){
    const resources=['summary','lifts','runs','conditions','crowds','pulse'];
    const records=Object.fromEntries(resources.map(resource=>[resource,this.resource(resortId,resource)]).filter(([,record])=>record));
    if(!records.summary)return null;
    return {data:records.summary.data,resources:records,stale:Object.values(records).some(record=>new Date(record.expiresAt).valueOf()<=this.now())};
  }

  submitReport(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw validationError('report body must be an object');
    const now=this.now();
    this.pruneTransientState(now);
    const reporterId=cleanString(input.reporterId,100),resort=cleanString(input.resort,40),zone=cleanString(input.zone,120);
    const kind=input.kind==='parking'?'parking':'condition';
    if(!reporterId||!resort||!zone)throw validationError('reporterId, resort, and zone are required');
    if(!this.resortIds.has(resort))throw validationError('unknown resort');
    if(kind==='condition'&&!['stoke','bother'].includes(input.type))throw validationError('condition report type must be stoke or bother');
    if(input.condition&&!conditionTypes.has(input.condition))throw validationError('unknown condition');
    if(kind==='parking'&&!parkingLevels.has(input.level))throw validationError('unknown parking level');
    const reporterHash=createHash('sha256').update(this.reporterSalt).update(reporterId).digest('hex');
    const cooldownKey=`${reporterHash}:${resort}:${kind}`;
    const cooldownMs=kind==='parking'?30000:10000;
    if(now-(this.reportCooldowns.get(cooldownKey)||0)<cooldownMs)throw rateLimitError('report cooldown active');
    this.reportCooldowns.set(cooldownKey,now);
    const report={id:randomUUID(),reporterHash,resort,zone,kind,type:kind==='condition'?input.type:null,condition:kind==='condition'?(input.condition||null):null,level:kind==='parking'?input.level:null,observedAt:normalizeClientTime(input.observedAt,now),receivedAt:new Date(now).toISOString()};
    this.reports.push(report);
    this.reports=this.reports.filter(item=>now-new Date(item.observedAt).valueOf()<reportTtlMs).slice(-5000);
    const aggregate=this.reportAggregates(resort).find(item=>item.zone===zone&&item.kind===kind);
    return {accepted:true,id:report.id,published:Boolean(aggregate),independentReporters:aggregate?.reporterCount||1};
  }

  reportAggregates(resort){
    const now=this.now(),groups=new Map();
    this.reports.filter(report=>report.resort===resort&&now-new Date(report.observedAt).valueOf()>=0&&now-new Date(report.observedAt).valueOf()<reportTtlMs).forEach(report=>{
      const key=[report.kind,report.zone,report.type,report.condition,report.level].join('|');
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
    const outcome={id:randomUUID(),resort,route,destination:cleanString(input.destination,120)||null,rating,confidence:finiteRange(input.confidence,0,100),elapsedMinutes:finiteRange(input.elapsedMinutes,0,720),preferences:safePreferences(input.preferences),completedAt:new Date(this.now()).toISOString()};
    this.outcomes.push(outcome);
    this.outcomes=this.outcomes.slice(-10000);
    return {accepted:true,id:outcome.id};
  }

  submitMovementBatch(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw validationError('movement batch body must be an object');
    const now=this.now();
    this.pruneTransientState(now);
    const deviceId=cleanString(input.deviceId,120),resort=cleanString(input.resort,40),samples=Array.isArray(input.samples)?input.samples:[];
    if(!deviceId||!resort||!samples.length||samples.length>100)throw validationError('deviceId, resort, and 1-100 aggregate samples are required');
    if(!this.resortIds.has(resort))throw validationError('unknown resort');
    const deviceHash=createHash('sha256').update(this.movementSalt).update(deviceId).digest('hex');
    const published=[];
    let storedSamples=0;
    for(const sample of samples){
      if(!sample||typeof sample!=='object'||Array.isArray(sample))throw validationError('movement samples must be objects');
      if(['lat','lon','latitude','longitude','coordinates','geometry'].some(key=>Object.hasOwn(sample,key)))throw validationError('raw coordinates are not accepted; submit edge-level aggregates only');
      const edgeId=cleanString(sample.edgeId,160),window=normalizeWindow(sample.window,now);
      const durationSeconds=finiteRange(sample.durationSeconds,1,7200);
      if(!edgeId||!window||durationSeconds===null)continue;
      storedSamples+=1;
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
    if(!storedSamples)throw validationError('no valid aggregate samples');
    return {accepted:true,storedSamples,published};
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
function finiteRange(value,min,max){const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?number:null}
function normalizeClientTime(value,now){const parsed=new Date(value||now);return Number.isNaN(parsed.valueOf())||Math.abs(parsed.valueOf()-now)>86400000?new Date(now).toISOString():parsed.toISOString()}
function normalizeWindow(value,now){const parsed=new Date(value);if(Number.isNaN(parsed.valueOf())||Math.abs(parsed.valueOf()-now)>86400000)return null;parsed.setUTCSeconds(0,0);return parsed.toISOString()}
function safePreferences(value={}){return {ability:cleanString(value.ability,20)||null,ride:cleanString(value.ride,20)||null,priority:cleanString(value.priority,20)||null}}
function validationError(message){return Object.assign(new Error(message),{statusCode:400,code:'invalid_request'})}
function rateLimitError(message){return Object.assign(new Error(message),{statusCode:429,code:'rate_limited'})}

module.exports={DataPlatform};
