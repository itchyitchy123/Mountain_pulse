class ScenarioAdapter{
  constructor(resorts,now=()=>new Date()){
    this.resorts=resorts;
    this.now=now;
    this.source={id:'interactive-scenario',label:'Interactive winter scenario',mode:'simulation'};
  }

  fetch(){
    const observedAt=this.now().toISOString(),observations=[];
    for(const resort of Object.values(this.resorts)){
      const summary={...resort};
      observations.push(
        {resortId:resort.id,resource:'summary',data:summary,observedAt,ttlMs:3600000,quality:.6},
        {resortId:resort.id,resource:'lifts',data:resort.lifts,observedAt,ttlMs:300000,quality:.65},
        {resortId:resort.id,resource:'runs',data:resort.runs,observedAt,ttlMs:300000,quality:.65},
        {resortId:resort.id,resource:'conditions',data:resort.conditions,observedAt,ttlMs:900000,quality:.55},
        {resortId:resort.id,resource:'crowds',data:resort.crowds,observedAt,ttlMs:300000,quality:.5},
        {resortId:resort.id,resource:'pulse',data:resort.pulse,observedAt,ttlMs:300000,quality:.55}
      );
    }
    return observations;
  }
}

module.exports={ScenarioAdapter};
