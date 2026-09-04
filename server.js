const http = require('node:http');
const {readFile} = require('node:fs/promises');
const {randomBytes,randomUUID} = require('node:crypto');
const {extname, normalize, resolve} = require('node:path');
const {resorts} = require('./mountain-data');
const {DataPlatform} = require('./data-platform');
const {ScenarioAdapter} = require('./adapters/scenario-adapter');
const {NormalizedHttpAdapter} = require('./adapters/normalized-http-adapter');
const {InstallationAuth} = require('./installation-auth');
const {PostgresRepository} = require('./postgres-repository');
const {parseRuntimeConfig} = require('./server-config');

let runtime;
try{runtime=parseRuntimeConfig(process.env)}catch(error){
  console.error(JSON.stringify({level:'error',event:'invalid_configuration',message:error.message}));
  process.exit(1);
}
const {port,host}=runtime;
const root = __dirname;
const allowedOrigin = runtime.corsOrigin;
const unknownResortIds=runtime.resortIds.filter(id=>!Object.hasOwn(resorts,id));
if(unknownResortIds.length){
  console.error(JSON.stringify({level:'error',event:'invalid_configuration',message:`Unknown RESORT_IDS: ${unknownResortIds.join(', ')}`}));
  process.exit(1);
}
const enabledResorts=new Set(runtime.resortIds);
const publicFiles = new Set(['index.html','styles.css','mountain-data.js','scoring.js','route-engine.js','safety-engine.js','parking-model.js','app.js','manifest.webmanifest','service-worker.js','icon.svg']);
const repository=runtime.databaseUrl?new PostgresRepository({connectionString:runtime.databaseUrl}):null;
const platform = new DataPlatform({repository,identityHashSecret:runtime.identityHashSecret});
const installationAuth=new InstallationAuth({secret:runtime.installationTokenSecret||randomBytes(32)});
let feedTimer=null,feedRefresh=null,storageTimer=null,maintenanceTimer=null,storageReady=!repository;
if(runtime.simulation){
  const scenarioAdapter = new ScenarioAdapter(resorts);
  platform.ingest(scenarioAdapter.source,scenarioAdapter.fetch());
}else{
  const liveAdapter=new NormalizedHttpAdapter({url:runtime.feedUrl,token:runtime.feedToken,timeoutMs:runtime.feedTimeoutMs});
  const refresh=async()=>{
    if(feedRefresh)return feedRefresh;
    feedRefresh=(async()=>{
      try{
        const accepted=platform.ingest(liveAdapter.source,await liveAdapter.fetch());
        if(!accepted)throw new Error('normalized feed contained no acceptable observations');
        await repository.saveObservations(liveAdapter.source,platform.lastIngestedRecords);
        console.log(JSON.stringify({level:'info',event:'feed_refresh_complete',accepted}));
      }catch(error){
        platform.ingest(liveAdapter.source,[]);
        if(storageReady)await repository.markSourceFailure(liveAdapter.source,error).catch(()=>{});
        console.error(JSON.stringify({level:'error',event:'feed_refresh_failed',message:error.message}));
      }finally{
        feedRefresh=null;
        if(!shuttingDown)feedTimer=setTimeout(refresh,runtime.feedPollMs).unref();
      }
    })();
    return feedRefresh;
  };
  const initializeStorage=async()=>{
    try{
      await repository.connect();
      storageReady=true;
      maintenanceTimer=setInterval(()=>repository.pruneExpired().catch(error=>console.error(JSON.stringify({level:'error',event:'storage_maintenance_failed',message:error.message}))),300000).unref();
      await refresh();
    }catch(error){
      storageReady=false;
      console.error(JSON.stringify({level:'error',event:'storage_initialization_failed',message:error.message}));
      if(!shuttingDown)storageTimer=setTimeout(initializeStorage,5000).unref();
    }
  };
  setImmediate(initializeStorage);
}
const requestBuckets = new Map();

const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const requiredResources=['summary','lifts','runs','conditions','crowds','pulse'];

function isReady(){return storageReady&&runtime.resortIds.every(resortId=>requiredResources.every(resource=>{const record=platform.resource(resortId,resource);return record&&new Date(record.expiresAt).valueOf()>Date.now()}))}

function sendJson(response,status,payload){
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowedOrigin,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Vary':'Origin'});
  response.end(JSON.stringify(payload,null,2));
}

function envelope(data,extra={}){
  const observedAt=[...platform.observations.values()].map(record=>record.observedAt).sort().at(-1)||null;
  return {simulation:runtime.simulation,observed_at:observedAt,served_at:new Date().toISOString(),...extra,data};
}

function openApiDocument(){
  const resourcePath=resource=>({get:{summary:`Get resort ${resource}`,parameters:[{name:'id',in:'path',required:true,schema:{type:'string',enum:Object.keys(resorts)}}],responses:{200:{description:'Simulated resort data'},404:{description:'Resort not found'}}}});
  return {
    openapi:'3.1.0',info:{title:'MountainPulse API',version:'1.0.0',description:runtime.simulation?'Simulated development data. Not an official resort operations source.':'Normalized mountain observations with explicit freshness and provenance.'},
    servers:[{url:'/api/v1'}],
    paths:{
      '/resorts':{get:{summary:'List resorts',responses:{200:{description:'Resort summaries'}}}},
      '/resorts/{id}':resourcePath('summary'),'/resorts/{id}/lifts':resourcePath('lifts'),'/resorts/{id}/runs':resourcePath('runs'),
      '/resorts/{id}/conditions':resourcePath('conditions'),'/resorts/{id}/crowds':resourcePath('crowds'),'/resorts/{id}/pulse':resourcePath('pulse'),
      '/resorts/{id}/reports':{get:{summary:'Get privacy-thresholded community report aggregates',responses:{200:{description:'Verified report aggregates'}}}},
      '/sources':{get:{summary:'Get ingestion source health',responses:{200:{description:'Source health'}}}},
      '/runtime':{get:{summary:'Get public runtime capabilities',responses:{200:{description:'Runtime mode and feature availability'}}}},
      '/installations':{post:{summary:'Issue an anonymous installation credential',responses:{201:{description:'Installation credential issued'},429:{description:'Rate limited'}}}},
      '/reports':{post:{summary:'Submit a condition or parking report',responses:{202:{description:'Report accepted'},400:{description:'Invalid report'},401:{description:'Installation authentication required'},415:{description:'JSON content type required'},429:{description:'Cooldown active'}}}},
      '/route-outcomes':{post:{summary:'Submit recommendation outcome calibration',responses:{202:{description:'Outcome accepted'},400:{description:'Invalid outcome'},415:{description:'JSON content type required'}}}},
      '/movement-batches':{post:{summary:'Submit edge-level movement samples; raw coordinates are rejected by contract',responses:{202:{description:'Aggregate samples accepted'},400:{description:'Invalid batch'},415:{description:'JSON content type required'}}}}
    }
  };
}

async function readJson(request,limit=65536){
  const chunks=[];
  let size=0;
  for await(const chunk of request){size+=chunk.length;if(size>limit)throw Object.assign(new Error('request body too large'),{statusCode:413,code:'payload_too_large'});chunks.push(chunk)}
  if(!chunks.length)return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('request body must be valid JSON'),{statusCode:400,code:'invalid_json'})}
}

function consumeWriteCapacity(request){
  const now=Date.now(),key=request.socket.remoteAddress||'unknown',windowMs=60000,limit=60;
  for(const [address,candidate] of requestBuckets){
    if(now-candidate.startedAt>=windowMs)requestBuckets.delete(address);
  }
  const bucket=requestBuckets.get(key);
  if(!bucket||now-bucket.startedAt>=windowMs){requestBuckets.set(key,{startedAt:now,count:1});return true}
  bucket.count+=1;
  return bucket.count<=limit;
}

async function handleApi(request,response,url){
  if(url.pathname==='/healthz'||url.pathname==='/readyz'){
    if(request.method!=='GET'&&request.method!=='HEAD'){sendJson(response,405,{error:'method_not_allowed'});return true}
    const ready=isReady();
    const status=url.pathname==='/healthz'||ready?200:503;
    const payload={status:url.pathname==='/healthz'?'ok':ready?'ready':'not_ready',simulation:runtime.simulation,served_at:new Date().toISOString()};
    if(request.method==='HEAD'){
      response.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end();
    }else sendJson(response,status,payload);
    return true;
  }
  const parts=url.pathname.split('/').filter(Boolean);
  const apiBase=parts[0]==='api'&&parts[1]==='v1';
  const apiDocs=apiBase&&parts.length===3&&parts[2]==='openapi.json';
  const versioned=parts[0]==='api'&&parts[1]==='v1'&&parts[2]==='resorts';
  const planAlias=parts[0]==='resorts';
  const writeResource=apiBase&&['reports','route-outcomes','movement-batches'].includes(parts[2])&&parts.length===3;
  const installationResource=apiBase&&parts[2]==='installations'&&parts.length===3;
  const sourceHealth=apiBase&&parts[2]==='sources'&&parts.length===3;
  const runtimeInfo=apiBase&&parts[2]==='runtime'&&parts.length===3;
  if(!versioned&&!planAlias&&!apiDocs&&!writeResource&&!installationResource&&!sourceHealth&&!runtimeInfo) return false;
  const requestOrigin=request.headers.origin;
  if(requestOrigin&&allowedOrigin!=='*'&&requestOrigin!==allowedOrigin){sendJson(response,403,{error:'origin_not_allowed'});return true}
  if(request.method==='OPTIONS'){
    response.writeHead(204,{'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'});
    response.end();
    return true;
  }
  if(installationResource){
    if(request.method!=='POST'){sendJson(response,405,{error:'method_not_allowed'});return true}
    if(!consumeWriteCapacity(request)){sendJson(response,429,{error:'rate_limited'});return true}
    sendJson(response,201,{token:installationAuth.issue(),expires_in_seconds:7776000});
    return true;
  }
  if(writeResource){
    if(request.method!=='POST'){sendJson(response,405,{error:'method_not_allowed'});return true}
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||'')){sendJson(response,415,{error:'unsupported_media_type',message:'Content-Type must be application/json.'});return true}
    if(!consumeWriteCapacity(request)){sendJson(response,429,{error:'rate_limited',message:'Too many ingestion requests from this client.'});return true}
    if(!isReady()){sendJson(response,503,{error:'service_not_ready'});return true}
    try{
      let body=await readJson(request);
      if(!runtime.simulation){
        const authorization=request.headers.authorization||'';
        const installation=authorization.startsWith('Installation ')?installationAuth.verify(authorization.slice(13)):null;
        if(!installation){sendJson(response,401,{error:'installation_auth_required'});return true}
        body={...body,reporterId:installation.id,deviceId:installation.id};
      }
      const result=await (parts[2]==='reports'?platform.submitReport(body):parts[2]==='route-outcomes'?platform.submitOutcome(body):platform.submitMovementBatch(body));
      sendJson(response,202,{...result,simulation:runtime.simulation,served_at:new Date().toISOString()});
    }catch(error){sendJson(response,error.statusCode||500,{error:error.code||'server_error',message:error.statusCode&&error.statusCode<500?error.message:'Unable to process request.'})}
    return true;
  }
  if(request.method!=='GET'){sendJson(response,405,{error:'method_not_allowed'});return true}
  if(apiDocs){sendJson(response,200,openApiDocument());return true}
  if(runtimeInfo){sendJson(response,200,{mode:runtime.mode,simulation:runtime.simulation,routing_enabled:runtime.simulation,installation_auth_required:!runtime.simulation,resort_ids:runtime.resortIds,served_at:new Date().toISOString()});return true}
  if(sourceHealth){sendJson(response,200,envelope(platform.sourceHealth()));return true}
  const base=versioned?3:1;
  if(parts.length===base){
    const summaries=runtime.resortIds.flatMap(resortId=>{const record=platform.resource(resortId,'summary');return record?[{id:resortId,name:record.data.name,state:record.data.state,pulse_score:record.data.pulse?.score,terrain_open_pct:record.data.conditions?.terrain_open_pct}]:[]});
    sendJson(response,200,envelope(summaries));
    return true;
  }
  const resort=enabledResorts.has(parts[base])?resorts[parts[base]]:null;
  if(!resort){sendJson(response,404,{error:'resort_not_found'});return true}
  if(parts.length===base+1){const snapshot=platform.snapshot(resort.id);if(!snapshot){sendJson(response,503,{error:'resort_data_unavailable'});return true}const summary=snapshot.resources.summary;sendJson(response,200,envelope(snapshot.data,{observed_at:summary.observedAt,expires_at:summary.expiresAt,stale:snapshot.stale,source:{id:summary.sourceId,mode:summary.sourceMode,quality:summary.quality}}));return true}
  if(parts.length!==base+2){sendJson(response,404,{error:'resource_not_found'});return true}
  const resource=parts[base+1];
  if(resource==='reports'){sendJson(response,200,envelope(await platform.reportAggregates(resort.id),{resort_id:resort.id,privacy_threshold:platform.reportThreshold}));return true}
  if(!['lifts','runs','conditions','crowds','pulse'].includes(resource)){sendJson(response,404,{error:'resource_not_found'});return true}
  const observation=platform.resource(resort.id,resource);
  if(!observation){sendJson(response,503,{error:'resource_data_unavailable',resort_id:resort.id,resource});return true}
  sendJson(response,200,{simulation:runtime.simulation,resort_id:resort.id,observed_at:observation.observedAt,served_at:new Date().toISOString(),expires_at:observation.expiresAt,stale:new Date(observation.expiresAt).valueOf()<=Date.now(),source:{id:observation.sourceId,mode:observation.sourceMode,quality:observation.quality},data:observation.data});
  return true;
}

async function serveStatic(request,response,url){
  if(request.method!=='GET'&&request.method!=='HEAD'){
    response.writeHead(405,{'Content-Type':'text/plain; charset=utf-8'});
    response.end('Method not allowed');
    return;
  }
  let requested;
  try{requested=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1))}
  catch{
    response.writeHead(400,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});
    response.end('Bad request');
    return;
  }
  if(!publicFiles.has(requested)){
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});
    response.end('Not found');
    return;
  }
  const filePath=resolve(root,normalize(requested));
  if(!filePath.startsWith(`${root}/`)){
    response.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});
    response.end('Forbidden');
    return;
  }
  try{
    const body=await readFile(filePath);
    response.writeHead(200,{'Content-Type':contentTypes[extname(filePath)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'geolocation=(self)','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
    if(request.method==='HEAD')response.end();else response.end(body);
  }catch(error){
    response.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});
    response.end(error.code==='ENOENT'?'Not found':'Server error');
  }
}

const server=http.createServer(async(request,response)=>{
  const requestId=typeof request.headers['x-request-id']==='string'&&/^[A-Za-z0-9._-]{1,80}$/.test(request.headers['x-request-id'])?request.headers['x-request-id']:randomUUID();
  const startedAt=Date.now();
  response.setHeader('X-Request-Id',requestId);
  response.on('finish',()=>console.log(JSON.stringify({level:'info',event:'request_complete',request_id:requestId,method:request.method,path:request.url?.split('?')[0],status:response.statusCode,duration_ms:Date.now()-startedAt})));
  let url;
  try{url=new URL(request.url,`http://${request.headers.host||'localhost'}`)}
  catch{response.writeHead(400,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});response.end('Bad request');return}
  try{
    if(await handleApi(request,response,url))return;
    await serveStatic(request,response,url);
  }catch(error){
    console.error(JSON.stringify({level:'error',event:'request_failed',request_id:requestId,message:error.message}));
    if(!response.headersSent)response.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
    if(!response.writableEnded)response.end('Server error');
  }
});

let shuttingDown=false;
function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  if(feedTimer)clearTimeout(feedTimer);
  if(storageTimer)clearTimeout(storageTimer);
  if(maintenanceTimer)clearInterval(maintenanceTimer);
  console.log(JSON.stringify({level:'info',event:'shutdown_started',signal}));
  server.close(async error=>{
    if(repository)await repository.close().catch(closeError=>console.error(JSON.stringify({level:'error',event:'storage_close_failed',message:closeError.message})));
    if(error)console.error(JSON.stringify({level:'error',event:'shutdown_failed',message:error.message}));
    else console.log(JSON.stringify({level:'info',event:'shutdown_complete'}));
    process.exit(error?1:0);
  });
  server.closeIdleConnections?.();
  setTimeout(()=>{console.error(JSON.stringify({level:'error',event:'shutdown_timeout'}));process.exit(1)},10000).unref();
}

server.on('error',error=>{console.error(JSON.stringify({level:'error',event:'server_error',message:error.message}));process.exitCode=1});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.keepAliveTimeout=5000;
server.listen(port,host,()=>console.log(JSON.stringify({level:'info',event:'server_started',host,port,mode:runtime.mode})));
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
