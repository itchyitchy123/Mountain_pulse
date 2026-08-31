(function exposeParkingModel(root,factory){
  const model=factory();
  if(typeof module==='object'&&module.exports)module.exports=model;
  root.MountainPulseParkingModel=model;
})(typeof globalThis!=='undefined'?globalThis:this,function createParkingModel(){
  const levelCapacity={Plenty:25,Filling:60,'Almost full':90,'Turn around':100};

  function estimateParking(baseCapacity,reports=[],{now=Date.now(),ttlMs=7200000}={}){
    const base=Math.max(0,Math.min(100,Number(baseCapacity)||0));
    const newest=new Map();
    reports.filter(report=>levelCapacity[report.level]!==undefined&&Number.isFinite(report.observedAt)&&now-report.observedAt>=0&&now-report.observedAt<ttlMs).forEach(report=>{const reporter=report.reporterId||'legacy-device';if(!newest.has(reporter)||newest.get(reporter).observedAt<report.observedAt)newest.set(reporter,report)});
    const valid=[...newest.values()];
    const aggregate=valid.reduce((total,report)=>{
      const freshness=Math.max(.1,1-(now-report.observedAt)/ttlMs);
      total.value+=levelCapacity[report.level]*freshness;
      total.weight+=freshness;
      return total;
    },{value:0,weight:0});
    const reported=aggregate.weight?aggregate.value/aggregate.weight:base;
    const reportInfluence=Math.min(.65,aggregate.weight*.22);
    const capacity=Math.round(base*(1-reportInfluence)+reported*reportInfluence);
    const confidence=Math.min(92,Math.round(58+Math.min(24,aggregate.weight*12)));
    return {capacity:Math.max(0,Math.min(100,capacity)),confidence,reportCount:valid.length,status:capacity>=95?'Turn around':capacity>=82?'Almost full':capacity>=55?'Filling':'Plenty'};
  }

  return {estimateParking,levelCapacity};
});
