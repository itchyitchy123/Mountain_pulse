(function exposeScoring(root,factory){
  const scoring=factory();
  if(typeof module==='object'&&module.exports)module.exports=scoring;
  root.MountainPulseScoring=scoring;
})(typeof globalThis!=='undefined'?globalThis:this,function createScoring(){
  const conditionWeights={fresh:3,untracked:5,icy:-5,thin:-6,windblown:-2,moguls:0,trees:3,hazard:-8};

  function calculateAdjustment(signals,{resort,zone,now=Date.now(),ttlMs=7200000,cap=8}={}){
    if(!resort||!zone)return 0;
    const newest=new Map();
    signals
      .filter(signal=>signal.resort===resort&&signal.zone===zone&&now-signal.observedAt>=0&&now-signal.observedAt<ttlMs)
      .forEach(signal=>{const reporter=signal.reporterId||'legacy-device';if(!newest.has(reporter)||newest.get(reporter).observedAt<signal.observedAt)newest.set(reporter,signal)});
    const adjustment=[...newest.values()]
      .reduce((total,signal)=>{
        const freshness=Math.max(.15,1-(now-signal.observedAt)/ttlMs);
        const vote=signal.type==='stoke'?2:-3;
        return total+(vote+(conditionWeights[signal.condition]||0))*freshness;
      },0);
    return Math.max(-cap,Math.min(cap,Math.round(adjustment)));
  }

  return {calculateAdjustment,conditionWeights};
});
