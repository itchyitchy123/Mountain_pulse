const http = require('node:http');
const {readFile} = require('node:fs/promises');
const {extname, normalize, resolve} = require('node:path');
const {resorts} = require('./mountain-data');
const {DataPlatform} = require('./data-platform');
const {ScenarioAdapter} = require('./adapters/scenario-adapter');

const configuredPort=process.env.PORT===undefined?4173:Number(process.env.PORT);
if(!Number.isInteger(configuredPort)||configuredPort<1||configuredPort>65535){
  console.error(JSON.stringify({level:'error',event:'invalid_configuration',field:'PORT',message:'PORT must be an integer between 1 and 65535'}));
  process.exit(1);
}
const port = configuredPort;
const host = process.env.HOST || '127.0.0.1';
const root = __dirname;
const scenarioObservedAt = new Date().toISOString();
const allowedOrigin = process.env.CORS_ORIGIN || '*';
const publicFiles = new Set(['index.html','styles.css','mountain-data.js','scoring.js','route-engine.js','safety-engine.js','parking-model.js','app.js','manifest.webmanifest','service-worker.js','icon.svg']);
const platform = new DataPlatform();
const scenarioAdapter = new ScenarioAdapter(resorts);
platform.ingest(scenarioAdapter.source,scenarioAdapter.fetch());
const requestBuckets = new Map();

const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

function sendJson(response,status,payload){
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowedOrigin,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'});
  response.end(JSON.stringify(payload,null,2));
}

function envelope(data,extra={}){
  return {simulation:true,observed_at:scenarioObservedAt,served_at:new Date().toISOString(),...extra,data};
}

function openApiDocument(){
  const resourcePath=resource=>({get:{summary:`Get resort ${resource}`,parameters:[{name:'id',in:'path',required:true,schema:{type:'string',enum:Object.keys(resorts)}}],responses:{200:{description:'Simulated resort data'},404:{description:'Resort not found'}}}});
  return {
    openapi:'3.1.0',info:{title:'MountainPulse Prototype API',version:'1.0.0',description:'Simulated read data and process-local prototype ingestion. Not an official resort operations source.'},
    servers:[{url:'/api/v1'}],
    paths:{
      '/resorts':{get:{summary:'List resorts',responses:{200:{description:'Resort summaries'}}}},
      '/resorts/{id}':resourcePath('summary'),'/resorts/{id}/lifts':resourcePath('lifts'),'/resorts/{id}/runs':resourcePath('runs'),
      '/resorts/{id}/conditions':resourcePath('conditions'),'/resorts/{id}/crowds':resourcePath('crowds'),'/resorts/{id}/pulse':resourcePath('pulse'),
      '/resorts/{id}/reports':{get:{summary:'Get privacy-thresholded community report aggregates',responses:{200:{description:'Verified report aggregates'}}}},
      '/sources':{get:{summary:'Get ingestion source health',responses:{200:{description:'Source health'}}}},
      '/reports':{post:{summary:'Submit a condition or parking report',responses:{202:{description:'Report accepted'},400:{description:'Invalid report'},429:{description:'Cooldown active'}}}},
      '/route-outcomes':{post:{summary:'Submit recommendation outcome calibration',responses:{202:{description:'Outcome accepted'}}}},
      '/movement-batches':{post:{summary:'Submit edge-level movement samples; raw coordinates are rejected by contract',responses:{202:{description:'Aggregate samples accepted'}}}}
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
    const ready=Object.keys(resorts).every(resortId=>Boolean(platform.resource(resortId,'summary')));
    const status=url.pathname==='/healthz'||ready?200:503;
    const payload={status:url.pathname==='/healthz'?'ok':ready?'ready':'not_ready',simulation:true,served_at:new Date().toISOString()};
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
  const sourceHealth=apiBase&&parts[2]==='sources'&&parts.length===3;
  if(!versioned&&!planAlias&&!apiDocs&&!writeResource&&!sourceHealth) return false;
  if(request.method==='OPTIONS'){
    response.writeHead(204,{'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'});
    response.end();
    return true;
  }
  if(writeResource){
    if(request.method!=='POST'){sendJson(response,405,{error:'method_not_allowed'});return true}
    if(!consumeWriteCapacity(request)){sendJson(response,429,{error:'rate_limited',message:'Too many ingestion requests from this client.'});return true}
    try{
      const body=await readJson(request);
      const result=parts[2]==='reports'?platform.submitReport(body):parts[2]==='route-outcomes'?platform.submitOutcome(body):platform.submitMovementBatch(body);
      sendJson(response,202,{...result,simulation:true,served_at:new Date().toISOString()});
    }catch(error){sendJson(response,error.statusCode||500,{error:error.code||'server_error',message:error.statusCode&&error.statusCode<500?error.message:'Unable to process request.'})}
    return true;
  }
  if(request.method!=='GET'){sendJson(response,405,{error:'method_not_allowed'});return true}
  if(apiDocs){sendJson(response,200,openApiDocument());return true}
  if(sourceHealth){sendJson(response,200,envelope(platform.sourceHealth()));return true}
  const base=versioned?3:1;
  if(parts.length===base){
    sendJson(response,200,envelope(Object.values(resorts).map(({id,name,state,pulse,conditions})=>({id,name,state,pulse_score:pulse.score,terrain_open_pct:conditions.terrain_open_pct}))));
    return true;
  }
  const resort=resorts[parts[base]];
  if(!resort){sendJson(response,404,{error:'resort_not_found'});return true}
  if(parts.length===base+1){const snapshot=platform.snapshot(resort.id);if(!snapshot){sendJson(response,503,{error:'resort_data_unavailable'});return true}sendJson(response,200,envelope(snapshot.data,{stale:snapshot.stale}));return true}
  if(parts.length!==base+2){sendJson(response,404,{error:'resource_not_found'});return true}
  const resource=parts[base+1];
  if(resource==='reports'){sendJson(response,200,envelope(platform.reportAggregates(resort.id),{resort_id:resort.id,privacy_threshold:platform.reportThreshold}));return true}
  if(!['lifts','runs','conditions','crowds','pulse'].includes(resource)){sendJson(response,404,{error:'resource_not_found'});return true}
  const observation=platform.resource(resort.id,resource);
  if(!observation){sendJson(response,503,{error:'resource_data_unavailable',resort_id:resort.id,resource});return true}
  sendJson(response,200,{simulation:true,resort_id:resort.id,observed_at:observation.observedAt,served_at:new Date().toISOString(),expires_at:observation.expiresAt,stale:new Date(observation.expiresAt).valueOf()<=Date.now(),source:{id:observation.sourceId,mode:observation.sourceMode,quality:observation.quality},data:observation.data});
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
    response.writeHead(200,{'Content-Type':contentTypes[extname(filePath)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
    if(request.method==='HEAD')response.end();else response.end(body);
  }catch(error){
    response.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});
    response.end(error.code==='ENOENT'?'Not found':'Server error');
  }
}

const server=http.createServer(async(request,response)=>{
  let url;
  try{url=new URL(request.url,`http://${request.headers.host||'localhost'}`)}
  catch{response.writeHead(400,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});response.end('Bad request');return}
  try{
    if(await handleApi(request,response,url))return;
    await serveStatic(request,response,url);
  }catch{
    if(!response.headersSent)response.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
    if(!response.writableEnded)response.end('Server error');
  }
});

let shuttingDown=false;
function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  console.log(JSON.stringify({level:'info',event:'shutdown_started',signal}));
  server.close(error=>{
    if(error)console.error(JSON.stringify({level:'error',event:'shutdown_failed',message:error.message}));
    else console.log(JSON.stringify({level:'info',event:'shutdown_complete'}));
    process.exit(error?1:0);
  });
  server.closeIdleConnections?.();
  setTimeout(()=>{console.error(JSON.stringify({level:'error',event:'shutdown_timeout'}));process.exit(1)},10000).unref();
}

server.on('error',error=>{console.error(JSON.stringify({level:'error',event:'server_error',message:error.message}));process.exitCode=1});
server.listen(port,host,()=>console.log(JSON.stringify({level:'info',event:'server_started',host,port,mode:'simulation'})));
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
