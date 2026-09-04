'use strict';

function parsePort(value){
  const port=value===undefined?4173:Number(value);
  if(!Number.isInteger(port)||port<1||port>65535)throw new RangeError('PORT must be an integer between 1 and 65535');
  return port;
}

function parseInteger(value,{name,defaultValue,min,max}){
  if(value===undefined||value==='')return defaultValue;
  const parsed=Number(value);
  if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
  return parsed;
}

function parseRuntimeConfig(env=process.env){
  const mode=env.APP_MODE||'demo';
  if(!['demo','production'].includes(mode))throw new RangeError('APP_MODE must be demo or production');
  let feedUrl=null;
  if(env.NORMALIZED_FEED_URL){
    try{feedUrl=new URL(env.NORMALIZED_FEED_URL)}catch{throw new RangeError('NORMALIZED_FEED_URL must be a valid URL')}
    if(mode==='production'&&feedUrl.protocol!=='https:')throw new RangeError('NORMALIZED_FEED_URL must use HTTPS in production');
  }
  if(mode==='production'&&!feedUrl)throw new RangeError('NORMALIZED_FEED_URL is required in production');
  const corsOrigin=env.CORS_ORIGIN||(mode==='demo'?'*':null);
  if(mode==='production'&&!corsOrigin)throw new RangeError('CORS_ORIGIN is required in production');
  const installationTokenSecret=env.INSTALLATION_TOKEN_SECRET||null;
  if(mode==='production'&&(!installationTokenSecret||Buffer.byteLength(installationTokenSecret)<32))throw new RangeError('INSTALLATION_TOKEN_SECRET must be at least 32 bytes in production');
  const identityHashSecret=env.IDENTITY_HASH_SECRET||null;
  if(mode==='production'&&(!identityHashSecret||Buffer.byteLength(identityHashSecret)<32))throw new RangeError('IDENTITY_HASH_SECRET must be at least 32 bytes in production');
  const databaseUrl=env.DATABASE_URL||null;
  if(mode==='production'&&!databaseUrl)throw new RangeError('DATABASE_URL is required in production');
  const resortIds=(env.RESORT_IDS||'copper,abasin,loveland,winter,eldora').split(',').map(value=>value.trim()).filter(Boolean);
  if(!resortIds.length||resortIds.some(id=>!/^[a-z0-9-]{1,40}$/.test(id)))throw new RangeError('RESORT_IDS must be a comma-separated list of resort IDs');
  return {
    mode,
    simulation:mode==='demo',
    port:parsePort(env.PORT),
    host:env.HOST||(mode==='production'?'0.0.0.0':'127.0.0.1'),
    corsOrigin,
    installationTokenSecret,
    identityHashSecret,
    databaseUrl,
    resortIds:[...new Set(resortIds)],
    feedUrl,
    feedToken:env.NORMALIZED_FEED_TOKEN||null,
    feedPollMs:parseInteger(env.FEED_POLL_MS,{name:'FEED_POLL_MS',defaultValue:60000,min:5000,max:3600000}),
    feedTimeoutMs:parseInteger(env.FEED_TIMEOUT_MS,{name:'FEED_TIMEOUT_MS',defaultValue:10000,min:1000,max:60000})
  };
}

module.exports={parsePort,parseRuntimeConfig};
