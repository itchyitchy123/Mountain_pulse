'use strict';

const {createHmac,randomBytes,randomUUID,timingSafeEqual}=require('node:crypto');

const tokenLifetimeMs=90*24*60*60*1000;

class InstallationAuth{
  constructor({secret=randomBytes(32),now=()=>Date.now()}={}){
    this.secret=Buffer.isBuffer(secret)?secret:Buffer.from(secret);
    if(this.secret.byteLength<32)throw new TypeError('installation token secret must be at least 32 bytes');
    this.now=now;
  }

  issue(){
    const payload=Buffer.from(JSON.stringify({id:randomUUID(),issuedAt:this.now()})).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token){
    if(typeof token!=='string'||token.length>1024)return null;
    const [payload,signature,...extra]=token.split('.');
    if(!payload||!signature||extra.length)return null;
    const expected=this.sign(payload),provided=Buffer.from(signature);
    if(provided.byteLength!==Buffer.byteLength(expected)||!timingSafeEqual(provided,Buffer.from(expected)))return null;
    try{
      const value=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
      if(typeof value.id!=='string'||!Number.isFinite(value.issuedAt)||this.now()-value.issuedAt<0||this.now()-value.issuedAt>tokenLifetimeMs)return null;
      return value;
    }catch{return null}
  }

  sign(payload){return createHmac('sha256',this.secret).update(payload).digest('base64url')}
}

module.exports={InstallationAuth,tokenLifetimeMs};
