(function exposeRouteEngine(root,factory){
  const engine=factory();
  if(typeof module==='object'&&module.exports)module.exports=engine;
  root.MountainPulseRouteEngine=engine;
})(typeof globalThis!=='undefined'?globalThis:this,function createRouteEngine(){
  const abilityRank={intermediate:1,advanced:2,expert:3};

  function normalizeOperations(rows=[]){
    return rows.map(row=>{
      if(!Array.isArray(row))return row;
      const [name,,state]=row;
      const normalized=String(state).toLowerCase();
      return {name,status:normalized.includes('closed')?'closed':normalized.includes('hold')?'hold':'open'};
    });
  }

  function routeBlockers(route,operations=[]){
    const indexed=new Map(normalizeOperations(operations).map(operation=>[operation.name.toLowerCase(),operation.status]));
    return (route.requires||[]).flatMap(requirement=>{
      const status=indexed.get(requirement.toLowerCase());
      if(!status)return [`${requirement}: status unknown`];
      return status!=='open'?[`${requirement}: ${status}`]:[];
    });
  }

  function rankRoutes(routes,{ability='advanced',ride='ski',priority='snow',operations=[],signalAdjustment=()=>0,outcomeAdjustment=()=>0,safetyEvaluation=null}={}){
    return routes
      .map(route=>{const safety=safetyEvaluation?safetyEvaluation(route):null;return {...route,safety,blockers:safety?safety.blockers:routeBlockers(route,operations)}})
      .filter(route=>abilityRank[route.ability]<=abilityRank[ability]&&!route.unavailable&&route.blockers.length===0)
      .map(route=>({...route,rankScore:route.scores[priority]+(priority==='snow'?signalAdjustment(route.destination):0)+outcomeAdjustment(route)-(ride==='snowboard'&&route.flat?25:0)}))
      .sort((a,b)=>b.rankScore-a.rankScore);
  }

  function calculateConfidence(prior,sources=[]){
    const weighted=sources.reduce((total,source)=>{
      const weight=source.weight||1;
      const freshness=source.available===false?0:Math.max(.1,Math.min(1,source.freshness??1));
      const quality=source.available===false?0:Math.max(0,Math.min(1,source.quality??.5));
      total.value+=weight*quality*freshness;
      total.weight+=weight;
      return total;
    },{value:0,weight:0});
    const evidence=weighted.weight?weighted.value/weighted.weight:.35;
    return Math.max(20,Math.min(95,Math.round(prior*.55+evidence*100*.45)));
  }

  return {abilityRank,calculateConfidence,normalizeOperations,rankRoutes,routeBlockers};
});
