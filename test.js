const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {calculateAdjustment} = require('./scoring');
const {calculateConfidence,rankRoutes,routeBlockers} = require('./route-engine');
const {estimateParking} = require('./parking-model');
const {evaluateRoute} = require('./safety-engine');
const mountainData = require('./mountain-data');
const {DataPlatform} = require('./data-platform');
const {ScenarioAdapter} = require('./adapters/scenario-adapter');
const {NormalizedHttpAdapter} = require('./adapters/normalized-http-adapter');
const {InstallationAuth} = require('./installation-auth');
const {parsePort,parseRuntimeConfig} = require('./server-config');

const testPort = 20000+Math.floor(Math.random()*40000);
let child;

async function get(path,options={}){
  const response=await fetch(`http://127.0.0.1:${testPort}${path}`,options);
  const body=await response.text();
  return {response,body};
}

async function run(){
  assert.equal(parsePort(undefined),4173);
  assert.throws(()=>parsePort('invalid'),/PORT must be an integer between 1 and 65535/);
  assert.equal(parseRuntimeConfig({}).mode,'demo');
  assert.throws(()=>parseRuntimeConfig({APP_MODE:'production'}),/NORMALIZED_FEED_URL is required/);
  assert.throws(()=>parseRuntimeConfig({APP_MODE:'production',NORMALIZED_FEED_URL:'http://feed.example',CORS_ORIGIN:'https://app.example'}),/must use HTTPS/);
  const productionEnvironment={APP_MODE:'production',NORMALIZED_FEED_URL:'https://feed.example',CORS_ORIGIN:'https://app.example',INSTALLATION_TOKEN_SECRET:'a-secure-production-secret-at-least-32-bytes',IDENTITY_HASH_SECRET:'a-separate-identity-secret-at-least-32-bytes',DATABASE_URL:'postgres://mountainpulse@db/mountainpulse'};
  assert.equal(parseRuntimeConfig(productionEnvironment).simulation,false);
  const tokenNow=Date.now(),installationAuth=new InstallationAuth({secret:'a-secure-production-secret-at-least-32-bytes',now:()=>tokenNow});
  const installationToken=installationAuth.issue();
  assert.ok(installationAuth.verify(installationToken).id);
  assert.equal(installationAuth.verify(`${installationToken}tampered`),null);
  const normalizedAdapter=new NormalizedHttpAdapter({url:new URL('https://feed.example'),fetchImpl:async()=>new Response(JSON.stringify({observations:[{resortId:'copper'}]}),{headers:{'Content-Type':'application/json'}})});
  assert.deepEqual(await normalizedAdapter.fetch(),[{resortId:'copper'}]);
  const invalidFeedAdapter=new NormalizedHttpAdapter({url:new URL('https://feed.example'),fetchImpl:async()=>new Response('not json',{headers:{'Content-Type':'text/plain'}})});
  await assert.rejects(()=>invalidFeedAdapter.fetch(),/application\/json/);
  const now=Date.now();
  assert.equal(calculateAdjustment([{resort:'copper',zone:'Resolution',type:'stoke',condition:'fresh',observedAt:now}],{resort:'copper',zone:'Resolution',now}),5);
  assert.equal(calculateAdjustment([{reporterId:'same',resort:'copper',zone:'Resolution',type:'stoke',condition:'fresh',observedAt:now-100},{reporterId:'same',resort:'copper',zone:'Resolution',type:'bother',condition:'hazard',observedAt:now}],{resort:'copper',zone:'Resolution',now}),-8);
  assert.equal(calculateAdjustment([{resort:'copper',zone:'Resolution',type:'bother',condition:'hazard',observedAt:now}],{resort:'copper',zone:'Resolution',now}),-8);
  assert.equal(calculateAdjustment([{resort:'copper',zone:'Resolution',type:'stoke',condition:'untracked',observedAt:now-7200000}],{resort:'copper',zone:'Resolution',now}),0);
  assert.equal(calculateAdjustment([{resort:'copper',zone:'Copper Bowl',type:'stoke',condition:'fresh',observedAt:now}],{resort:'copper',zone:'Resolution',now}),0);
  const routeFixtures=[
    {ability:'intermediate',destination:'Easy',requires:['Lift A'],scores:{snow:70,quiet:80,fast:90}},
    {ability:'advanced',destination:'Trees',requires:['Lift B'],scores:{snow:92,quiet:90,fast:75}},
    {ability:'expert',destination:'Chute',requires:['Lift C'],scores:{snow:99,quiet:95,fast:60}}
  ];
  const operationFixtures=[['Lift A','','3 min'],['Lift B','','Closed'],['Lift C','','Wind hold']];
  assert.deepEqual(routeBlockers(routeFixtures[1],operationFixtures),['Lift B: closed']);
  assert.deepEqual(routeBlockers(routeFixtures[2],operationFixtures),['Lift C: hold']);
  assert.deepEqual(routeBlockers({requires:['Unreported Lift']},operationFixtures),['Unreported Lift: status unknown']);
  assert.deepEqual(routeBlockers({requires:['Lift D']},[{name:'Lift D',status:'maintenance'}]),['Lift D: status unknown']);
  assert.deepEqual(routeBlockers({requires:['Lift D']},[['Lift D','','Unavailable']]),['Lift D: status unknown']);
  assert.deepEqual(rankRoutes(routeFixtures,{ability:'expert',priority:'snow',operations:operationFixtures}).map(route=>route.destination),['Easy']);
  const openOperations=[['Lift A','','3 min'],['Lift B','','3 min'],['Lift C','','3 min']];
  assert.equal(rankRoutes(routeFixtures,{ability:'expert',priority:'snow',operations:openOperations,outcomeAdjustment:route=>route.destination==='Trees'?20:0})[0].destination,'Trees');
  assert.ok(calculateConfidence(80,[{available:true,quality:.9,freshness:1}])>calculateConfidence(80,[{available:false,quality:.9,freshness:1}]));
  assert.equal(evaluateRoute(routeFixtures[0],{operations:operationFixtures,reports:[{reporterId:'a',resort:'copper',zone:'Easy',condition:'hazard',observedAt:now}],resort:'copper',now}).allowed,true);
  assert.equal(evaluateRoute(routeFixtures[0],{operations:operationFixtures,reports:[{reporterId:'a',resort:'copper',zone:'Easy',condition:'hazard',observedAt:now},{reporterId:'b',resort:'copper',zone:'Easy',condition:'hazard',observedAt:now}],resort:'copper',now}).allowed,false);
  const parkingEstimate=estimateParking(60,[{level:'Almost full',observedAt:now}],{now});
  assert.ok(parkingEstimate.capacity>60);
  assert.equal(parkingEstimate.reportCount,1);
  assert.ok(parkingEstimate.confidence>estimateParking(60,[],{now}).confidence);
  assert.equal(estimateParking(60,[{level:'Turn around',observedAt:now-7200000}],{now}).reportCount,0);
  assert.equal(estimateParking(60,[{reporterId:'same',level:'Plenty',observedAt:now-100},{reporterId:'same',level:'Turn around',observedAt:now}],{now}).reportCount,1);
  assert.equal(mountainData.resorts.copper.lifts.some(lift=>lift.name==='Excelerator'),true);
  const fixedNow=Date.parse('2026-01-15T17:00:00Z');
  const dataPlatform=new DataPlatform({now:()=>fixedNow});
  const adapter=new ScenarioAdapter(mountainData.resorts,()=>new Date(fixedNow));
  assert.ok(dataPlatform.ingest(adapter.source,adapter.fetch())>0);
  assert.equal(dataPlatform.snapshot('copper').data.id,'copper');
  assert.equal(dataPlatform.sourceHealth()[0].status,'healthy');
  assert.deepEqual(dataPlatform.snapshot('copper').data.lifts,mountainData.resorts.copper.lifts);
  const lastSuccessAt=dataPlatform.sourceHealth()[0].lastSuccessAt;
  assert.equal(dataPlatform.ingest(adapter.source,[{resortId:'copper',resource:'lifts',observedAt:'invalid',data:[]}]),0);
  assert.equal(dataPlatform.sourceHealth()[0].status,'degraded');
  assert.equal(dataPlatform.sourceHealth()[0].lastSuccessAt,lastSuccessAt);
  assert.throws(()=>dataPlatform.ingest({},[]),error=>error.statusCode===400);
  dataPlatform.ingest({id:'bad-source'},[{resortId:'phantom',resource:'summary',observedAt:'invalid',data:{}}]);
  assert.equal(dataPlatform.resortIds.has('phantom'),false);
  dataPlatform.ingest(adapter.source,adapter.fetch());
  assert.doesNotThrow(()=>dataPlatform.ingest({id:'pathological-ttl'},[{resortId:'copper',resource:'conditions',observedAt:new Date(fixedNow).toISOString(),ttlMs:Infinity,data:mountainData.resorts.copper.conditions}]));
  assert.ok(Number.isFinite(new Date(dataPlatform.resource('copper','conditions').expiresAt).valueOf()));
  assert.doesNotThrow(()=>dataPlatform.ingest({id:'extreme-date'},[{resortId:'copper',resource:'conditions',observedAt:'+275760-09-12T23:59:59.999Z',ttlMs:604800000,data:{}}]));
  assert.equal(dataPlatform.sourceHealth().find(source=>source.id==='extreme-date').status,'degraded');
  assert.equal(dataPlatform.submitReport({reporterId:'one',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke',condition:'fresh',observedAt:fixedNow}).published,false);
  assert.equal(dataPlatform.submitReport({reporterId:'two',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke',condition:'fresh',observedAt:fixedNow}).published,true);
  assert.equal(dataPlatform.submitReport({reporterId:'three',resort:'copper',zone:'Resolution',kind:'condition',type:'bother',condition:'icy',observedAt:fixedNow}).published,false);
  assert.throws(()=>dataPlatform.submitReport({reporterId:'wrong-kind',resort:'copper',zone:'Resolution',kind:'hazard',type:'bother',condition:'hazard',observedAt:fixedNow}),error=>error.statusCode===400);
  assert.throws(()=>dataPlatform.submitReport({reporterId:'stale',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke',observedAt:fixedNow-7200000}),error=>error.statusCode===400);
  assert.throws(()=>dataPlatform.submitReport({reporterId:'future',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke',observedAt:fixedNow+300001}),error=>error.statusCode===400);
  assert.equal(dataPlatform.reportAggregates('copper')[0].reporterCount,2);
  assert.throws(()=>dataPlatform.submitReport({reporterId:'one',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke',observedAt:fixedNow}),error=>error.statusCode===429);
  assert.equal(dataPlatform.submitMovementBatch({deviceId:'one',resort:'copper',samples:[{edgeId:'resolution',window:fixedNow,durationSeconds:90}]}).published.length,0);
  dataPlatform.submitMovementBatch({deviceId:'two',resort:'copper',samples:[{edgeId:'resolution',window:fixedNow,durationSeconds:110}]});
  assert.equal(dataPlatform.submitMovementBatch({deviceId:'three',resort:'copper',samples:[{edgeId:'resolution',window:fixedNow,durationSeconds:100}]}).published[0].deviceCount,3);
  assert.equal(dataPlatform.submitMovementBatch({deviceId:'four',resort:'copper',samples:[{edgeId:'resolution',window:fixedNow,durationSeconds:120}]}).published[0].medianSeconds,105);
  assert.throws(()=>dataPlatform.submitMovementBatch({deviceId:'invalid-sample',resort:'copper',samples:[null]}),error=>error.statusCode===400);
  assert.throws(()=>dataPlatform.submitMovementBatch({deviceId:'raw-location',resort:'copper',samples:[{edgeId:'resolution',window:fixedNow,durationSeconds:100,latitude:39.5,longitude:-106.1}]}),error=>error.statusCode===400);
  const atomicPlatform=new DataPlatform({movementThreshold:2,now:()=>fixedNow});
  atomicPlatform.ingest(adapter.source,adapter.fetch());
  assert.throws(()=>atomicPlatform.submitMovementBatch({deviceId:'partial',resort:'copper',samples:[{edgeId:'resolution',window:fixedNow,durationSeconds:90},null]}),error=>error.statusCode===400);
  assert.equal(atomicPlatform.movement.size,0);
  const persistedReports=[];
  const repositoryPlatform=new DataPlatform({now:()=>fixedNow,identityHashSecret:'a-separate-identity-secret-at-least-32-bytes',repository:{saveReport:async report=>{persistedReports.push(report);return null},reportAggregates:async()=>[],saveOutcome:async()=>{},saveMovementSamples:async()=>[]}});
  repositoryPlatform.ingest(adapter.source,adapter.fetch());
  assert.equal((await repositoryPlatform.submitReport({reporterId:'durable-device',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke'})).accepted,true);
  assert.equal(persistedReports.length,1);
  assert.equal(persistedReports[0].reporterHash.includes('durable-device'),false);
  assert.throws(()=>dataPlatform.submitOutcome({resort:'copper',route:'Resolution',rating:'fine',preferences:[]}),error=>error.statusCode===400);
  assert.throws(()=>dataPlatform.submitOutcome({resort:'copper',route:'Resolution',rating:'fine',preferences:{ability:'beginner'}}),error=>error.statusCode===400);
  assert.throws(()=>dataPlatform.submitOutcome({resort:'copper',route:'Resolution',rating:'fine',confidence:101}),error=>error.statusCode===400);
  assert.throws(()=>atomicPlatform.submitMovementBatch({deviceId:'duplicate',resort:'copper',samples:[{edgeId:'resolution',window:fixedNow,durationSeconds:90},{edgeId:'resolution',window:fixedNow,durationSeconds:100}]}),error=>error.statusCode===400);
  assert.equal(atomicPlatform.movement.size,0);

  child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(testPort)},stdio:['ignore','pipe','pipe']});
  const serverStarted=Promise.race([
    once(child.stdout,'data'),
    once(child.stderr,'data').then(([data])=>{throw new Error(data.toString())}),
    once(child,'exit').then(([code,signal])=>{throw new Error(`Server exited before startup (${code??signal})`)}),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Server did not start')),3000))
  ]);
  await serverStarted;

  const home=await get('/');
  assert.equal(home.response.status,200);
  assert.match(home.body,/MountainPulse/);
  assert.match(home.body,/Interactive winter demo/);
  assert.equal((home.body.match(/data-condition=/g)||[]).length,8);
  assert.match(home.body,/scoring\.js/);
  assert.match(home.body,/mountain-data\.js/);
  assert.match(home.body,/route-engine\.js/);
  assert.match(home.body,/safety-engine\.js/);
  assert.match(home.body,/parking-model\.js/);
  assert.match(home.body,/parkingConfidence/);
  assert.match(home.body,/role="tabpanel"/);
  assert.match(home.body,/id="finishRoute"/);
  assert.match(home.body,/Community signals are not monitored in real time/);
  assert.match(home.body,/id="conditionHelp"/);
  assert.match(home.body,/id="dataTrust"/);
  assert.match(home.body,/id="tripDecision"/);
  assert.equal(home.response.headers.get('x-content-type-options'),'nosniff');
  assert.match(home.response.headers.get('content-security-policy'),/default-src 'self'/);

  const health=await get('/healthz');
  assert.equal(health.response.status,200);
  assert.equal(JSON.parse(health.body).status,'ok');
  assert.equal(health.response.headers.get('cache-control'),'no-store');
  const readiness=await get('/readyz');
  assert.equal(readiness.response.status,200);
  assert.equal(JSON.parse(readiness.body).status,'ready');
  const healthHead=await get('/healthz',{method:'HEAD'});
  assert.equal(healthHead.response.status,200);

  const manifest=await get('/manifest.webmanifest');
  assert.equal(manifest.response.status,200);
  assert.match(manifest.response.headers.get('content-type'),/application\/manifest\+json/);
  assert.equal(JSON.parse(manifest.body).name,'MountainPulse');

  const serviceWorker=await get('/service-worker.js');
  assert.equal(serviceWorker.response.status,200);
  assert.match(serviceWorker.body,/mountainpulse-demo-v8/);
  assert.match(serviceWorker.body,/response\.ok/);
  assert.match(serviceWorker.body,/event\.request\.mode==='navigate'/);

  const appAsset=await get('/app.js');
  assert.equal(appAsset.response.status,200);
  assert.match(appAsset.body,/mountainpulse-sync-outbox/);
  assert.match(appAsset.body,/flushPrototypeOutbox/);
  assert.match(appAsset.body,/updateRouteSessionUi/);
  assert.match(appAsset.body,/finishRouteSession/);
  assert.match(appAsset.body,/communityAggregates/);
  assert.match(appAsset.body,/renderDataTrust/);

  const scoring=await get('/scoring.js');
  assert.equal(scoring.response.status,200);
  assert.match(scoring.body,/calculateAdjustment/);

  const routeEngine=await get('/route-engine.js');
  assert.equal(routeEngine.response.status,200);
  assert.match(routeEngine.body,/rankRoutes/);

  const sharedData=await get('/mountain-data.js');
  assert.equal(sharedData.response.status,200);
  const safetyEngine=await get('/safety-engine.js');
  assert.equal(safetyEngine.response.status,200);

  const parkingModel=await get('/parking-model.js');
  assert.equal(parkingModel.response.status,200);
  assert.match(parkingModel.body,/estimateParking/);

  const apiDocs=await get('/api/v1/openapi.json');
  assert.equal(apiDocs.response.status,200);
  assert.equal(JSON.parse(apiDocs.body).openapi,'3.1.0');
  assert.ok(JSON.parse(apiDocs.body).paths['/movement-batches']);

  const runtime=await get('/api/v1/runtime');
  assert.equal(runtime.response.status,200);
  const runtimeBody=JSON.parse(runtime.body);
  assert.equal(runtimeBody.mode,'demo');
  assert.equal(runtimeBody.simulation,true);
  assert.equal(runtimeBody.routing_enabled,true);
  assert.equal(runtimeBody.installation_auth_required,false);
  assert.deepEqual(runtimeBody.resort_ids,['copper','abasin','loveland','winter','eldora']);
  const installation=await get('/api/v1/installations',{method:'POST'});
  assert.equal(installation.response.status,201);
  assert.ok(JSON.parse(installation.body).token);

  const sourceHealth=await get('/api/v1/sources');
  assert.equal(sourceHealth.response.status,200);
  assert.equal(JSON.parse(sourceHealth.body).data[0].status,'healthy');

  const hiddenSource=await get('/server.js');
  assert.equal(hiddenSource.response.status,404);

  const list=await get('/api/v1/resorts');
  assert.equal(list.response.status,200);
  const listBody=JSON.parse(list.body);
  assert.equal(listBody.data.length,5);
  assert.ok(listBody.observed_at);
  assert.ok(listBody.served_at);
  assert.equal(list.response.headers.get('access-control-allow-origin'),'*');

  const pulse=await get('/resorts/abasin/pulse');
  assert.equal(pulse.response.status,200);
  const pulseBody=JSON.parse(pulse.body);
  assert.equal(pulseBody.data.score,94);
  assert.equal(pulseBody.simulation,true);
  assert.ok(pulseBody.observed_at);
  assert.ok(pulseBody.served_at);
  const apiLifts=await get('/api/v1/resorts/copper/lifts');
  const apiLiftBody=JSON.parse(apiLifts.body);
  assert.equal(apiLiftBody.data.some(lift=>lift.name==='Excelerator'),true);
  assert.ok(apiLiftBody.expires_at);
  assert.equal(apiLiftBody.source.mode,'simulation');

  const firstReport=await get('/api/v1/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reporterId:'http-one',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke',condition:'fresh'})});
  assert.equal(firstReport.response.status,202);
  assert.equal(JSON.parse(firstReport.body).published,false);
  const secondReport=await get('/api/v1/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reporterId:'http-two',resort:'copper',zone:'Resolution',kind:'condition',type:'stoke',condition:'fresh'})});
  assert.equal(JSON.parse(secondReport.body).published,true);
  const reportAggregates=await get('/api/v1/resorts/copper/reports');
  assert.equal(JSON.parse(reportAggregates.body).data[0].reporterCount,2);
  assert.doesNotMatch(reportAggregates.body,/http-one|http-two/);
  const badReport=await get('/api/v1/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reporterId:'bad'})});
  assert.equal(badReport.response.status,400);
  const wrongContentType=await get('/api/v1/reports',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'});
  assert.equal(wrongContentType.response.status,415);
  const unknownResortReport=await get('/api/v1/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reporterId:'bad-resort',resort:'unknown',zone:'Nowhere',kind:'condition',type:'stoke'})});
  assert.equal(unknownResortReport.response.status,400);

  const outcome=await get('/api/v1/route-outcomes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resort:'copper',route:'Super Bee → Resolution',rating:'nailed',elapsedMinutes:31})});
  assert.equal(outcome.response.status,202);

  for(const deviceId of ['movement-one','movement-two']){
    const movement=await get('/api/v1/movement-batches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,resort:'copper',samples:[{edgeId:'resolution',window:new Date().toISOString(),durationSeconds:100}]})});
    assert.equal(JSON.parse(movement.body).published.length,0);
  }
  const publishedMovement=await get('/api/v1/movement-batches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'movement-three',resort:'copper',samples:[{edgeId:'resolution',window:new Date().toISOString(),durationSeconds:110}]})});
  assert.equal(JSON.parse(publishedMovement.body).published[0].deviceCount,3);

  const missing=await get('/api/v1/resorts/unknown');
  assert.equal(missing.response.status,404);

  const nestedResource=await get('/api/v1/resorts/copper/lifts/unexpected');
  assert.equal(nestedResource.response.status,404);

  const malformedMovement=await get('/api/v1/movement-batches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'invalid-http-sample',resort:'copper',samples:[null]})});
  assert.equal(malformedMovement.response.status,400);

  const nullReport=await get('/api/v1/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:'null'});
  assert.equal(nullReport.response.status,400);

  const readOnly=await get('/api/v1/resorts',{method:'POST'});
  assert.equal(readOnly.response.status,405);

  const serverExit=once(child,'exit');
  child.kill('SIGTERM');
  const [exitCode,exitSignal]=await serverExit;
  assert.equal(exitCode,0);
  assert.equal(exitSignal,null);

  console.log('Static app and API smoke tests passed.');
}

run().catch(error=>{
  console.error(error);
  process.exitCode=1;
}).finally(()=>child?.kill());
