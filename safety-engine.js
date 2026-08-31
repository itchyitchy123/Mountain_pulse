(function exposeSafetyEngine(root,factory){
  const engine=factory(root.MountainPulseRouteEngine||(typeof require==='function'?require('./route-engine'):null));
  if(typeof module==='object'&&module.exports)module.exports=engine;
  root.MountainPulseSafetyEngine=engine;
})(typeof globalThis!=='undefined'?globalThis:this,function createSafetyEngine(routeEngine){
  function uniqueRecentReports(reports,{resort,zone,now=Date.now(),ttlMs=7200000}={}){
    const newest=new Map();
    reports.filter(report=>report.resort===resort&&report.zone===zone&&now-report.observedAt>=0&&now-report.observedAt<ttlMs).forEach(report=>{
      const reporter=report.reporterId||'legacy-device';
      if(!newest.has(reporter)||newest.get(reporter).observedAt<report.observedAt)newest.set(reporter,report);
    });
    return [...newest.values()];
  }

  function evaluateRoute(route,{operations=[],reports=[],resort,now=Date.now(),hazardThreshold=2}={}){
    const blockers=routeEngine.routeBlockers(route,operations);
    const relevant=uniqueRecentReports(reports,{resort,zone:route.destination,now});
    const hazards=relevant.filter(report=>report.condition==='hazard');
    const verifiedHazards=hazards.filter(report=>report.verified||report.source==='official');
    if(verifiedHazards.length||hazards.length>=hazardThreshold)blockers.push(`${route.destination}: active hazard signal`);
    const warnings=[];
    if(hazards.length&&blockers.every(blocker=>!blocker.includes('active hazard')))warnings.push(`Uncorroborated hazard report at ${route.destination}—verify before entering.`);
    return {allowed:blockers.length===0,blockers,warnings,hazardReports:hazards.length,uniqueReports:relevant.length};
  }

  return {evaluateRoute,uniqueRecentReports};
});
