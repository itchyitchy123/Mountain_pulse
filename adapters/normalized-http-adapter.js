'use strict';

const maximumFeedBytes=2*1024*1024;

class NormalizedHttpAdapter{
  constructor({url,token=null,timeoutMs=10000,fetchImpl=fetch}={}){
    if(!(url instanceof URL))throw new TypeError('A normalized feed URL is required');
    this.url=url;
    this.token=token;
    this.timeoutMs=timeoutMs;
    this.fetchImpl=fetchImpl;
    this.source={id:'normalized-http-feed',label:'Configured normalized mountain feed',mode:'official'};
  }

  async fetch(){
    const headers={Accept:'application/json'};
    if(this.token)headers.Authorization=`Bearer ${this.token}`;
    const response=await this.fetchImpl(this.url,{headers,signal:AbortSignal.timeout(this.timeoutMs)});
    if(!response.ok)throw new Error(`normalized feed returned HTTP ${response.status}`);
    const contentType=response.headers.get('content-type')||'';
    if(!/^application\/json(?:\s*;|$)/i.test(contentType))throw new Error('normalized feed must return application/json');
    const declaredLength=Number(response.headers.get('content-length'));
    if(Number.isFinite(declaredLength)&&declaredLength>maximumFeedBytes)throw new Error('normalized feed response is too large');
    const chunks=[];
    let byteLength=0;
    for await(const chunk of response.body){
      byteLength+=chunk.byteLength;
      if(byteLength>maximumFeedBytes)throw new Error('normalized feed response is too large');
      chunks.push(chunk);
    }
    const bytes=new Uint8Array(byteLength);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    let payload;
    try{payload=JSON.parse(new TextDecoder().decode(bytes))}catch{throw new Error('normalized feed returned invalid JSON')}
    const observations=Array.isArray(payload)?payload:payload?.observations;
    if(!Array.isArray(observations))throw new Error('normalized feed must return an observations array');
    return observations;
  }
}

module.exports={NormalizedHttpAdapter,maximumFeedBytes};
