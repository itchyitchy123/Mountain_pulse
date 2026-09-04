'use strict';

const {Pool}=require('pg');

class PostgresRepository{
  constructor({connectionString,pool=null}={}){
    if(!connectionString&&!pool)throw new TypeError('DATABASE_URL is required');
    this.pool=pool||new Pool({connectionString,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,allowExitOnIdle:true});
  }

  async connect(){const client=await this.pool.connect();try{await client.query('SELECT 1')}finally{client.release()}}
  async close(){await this.pool.end()}

  async saveObservations(source,records){
    if(!records.length)return;
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query(`INSERT INTO data_sources (id,label,source_mode,default_ttl,last_attempt_at,last_success_at)
        VALUES ($1,$2,$3,interval '5 minutes',now(),now())
        ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,source_mode=EXCLUDED.source_mode,last_attempt_at=now(),last_success_at=now(),consecutive_failures=0`,[source.id,source.label||source.id,source.mode]);
      for(const record of records.filter(item=>item.resource==='summary'))await client.query(`INSERT INTO resorts (id,name,state) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,state=EXCLUDED.state`,[record.resortId,record.data.name,record.data.state]);
      for(const record of records){
        await client.query(`INSERT INTO observations (resort_id,resource,value,source_id,source_event_id,quality,observed_at,received_at,expires_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,[record.resortId,record.resource,record.data,record.sourceId,record.sourceEventId||null,record.quality,record.observedAt,record.receivedAt,record.expiresAt]);
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }

  async markSourceFailure(source,error){
    await this.pool.query(`INSERT INTO data_sources (id,label,source_mode,default_ttl,last_attempt_at,consecutive_failures,health)
      VALUES ($1,$2,$3,interval '5 minutes',now(),1,jsonb_build_object('last_error',$4::text))
      ON CONFLICT (id) DO UPDATE SET last_attempt_at=now(),consecutive_failures=data_sources.consecutive_failures+1,health=jsonb_build_object('last_error',$4::text)`,[source.id,source.label||source.id,source.mode,String(error.message||error).slice(0,500)]);
  }

  async saveReport(report,{cooldownMs,threshold}){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const cooldown=await client.query(`INSERT INTO report_cooldowns (reporter_hash,resort_id,report_kind,last_received_at)
        VALUES ($1,$2,$3,$4) ON CONFLICT (reporter_hash,resort_id,report_kind) DO UPDATE SET last_received_at=EXCLUDED.last_received_at
        WHERE report_cooldowns.last_received_at <= EXCLUDED.last_received_at-($5::bigint*interval '1 millisecond') RETURNING reporter_hash`,[report.reporterHash,report.resort,report.kind,report.receivedAt,cooldownMs]);
      if(!cooldown.rowCount)throw Object.assign(new Error('report cooldown active'),{statusCode:429,code:'rate_limited'});
      await client.query(`INSERT INTO community_reports (id,reporter_hash,resort_id,zone_name,report_kind,payload,observed_at,received_at,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$7::timestamptz+interval '2 hours')`,[report.id,report.reporterHash,report.resort,report.zone,report.kind,{type:report.type,condition:report.condition,level:report.level},report.observedAt,report.receivedAt]);
      const aggregate=await this.findReportAggregate(client,report,threshold);
      await client.query('COMMIT');
      return aggregate;
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }

  async findReportAggregate(client,report,threshold){
    const result=await client.query(`SELECT count(DISTINCT reporter_hash)::integer AS reporter_count,max(observed_at) AS latest_observed_at
      FROM community_reports WHERE resort_id=$1 AND zone_name=$2 AND report_kind=$3 AND payload=$4::jsonb AND expires_at>now()`,[report.resort,report.zone,report.kind,JSON.stringify({type:report.type,condition:report.condition,level:report.level})]);
      const row=result.rows[0];
    if(row.reporter_count<threshold)return null;
    await client.query(`UPDATE community_reports SET moderation_state='published' WHERE resort_id=$1 AND zone_name=$2 AND report_kind=$3 AND payload=$4::jsonb AND expires_at>now()`,[report.resort,report.zone,report.kind,JSON.stringify({type:report.type,condition:report.condition,level:report.level})]);
    return {kind:report.kind,zone:report.zone,type:report.type,condition:report.condition,level:report.level,reporterCount:row.reporter_count,latestObservedAt:row.latest_observed_at,verified:true};
  }

  async reportAggregates(resort,{threshold}){
    const result=await this.pool.query(`SELECT report_kind AS kind,zone_name AS zone,payload->>'type' AS type,payload->>'condition' AS condition,payload->>'level' AS level,
      count(DISTINCT reporter_hash)::integer AS "reporterCount",max(observed_at) AS "latestObservedAt",true AS verified
      FROM community_reports WHERE resort_id=$1 AND expires_at>now() AND moderation_state='published'
      GROUP BY report_kind,zone_name,payload HAVING count(DISTINCT reporter_hash)>=$2 ORDER BY max(observed_at) DESC`,[resort,threshold]);
    return result.rows;
  }

  async saveOutcome(outcome){
    await this.pool.query(`INSERT INTO route_outcomes (id,resort_id,rating,predicted,actual,context,completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,[outcome.id,outcome.resort,outcome.rating,{route:outcome.route,destination:outcome.destination,confidence:outcome.confidence},{elapsedMinutes:outcome.elapsedMinutes},outcome.preferences,outcome.completedAt]);
  }

  async saveMovementSamples({resort,deviceHash,samples,threshold}){
    const client=await this.pool.connect(),published=[];
    try{
      await client.query('BEGIN');
      for(const sample of samples){
        await client.query(`INSERT INTO movement_samples (resort_id,topology_edge_id,window_start,device_hash,duration_seconds,expires_at)
          VALUES ($1,$2,$3,$4,$5,$3::timestamptz+interval '24 hours') ON CONFLICT (resort_id,topology_edge_id,window_start,device_hash) DO UPDATE SET duration_seconds=EXCLUDED.duration_seconds`,[resort,sample.edgeId,sample.window,deviceHash,sample.durationSeconds]);
        const result=await client.query(`SELECT count(*)::integer AS device_count,percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) AS median_seconds
          FROM movement_samples WHERE resort_id=$1 AND topology_edge_id=$2 AND window_start=$3 AND expires_at>now()`,[resort,sample.edgeId,sample.window]);
        const aggregate=result.rows[0];
        if(aggregate.device_count>=threshold){
          const publication={edgeId:sample.edgeId,window:sample.window,deviceCount:aggregate.device_count,medianSeconds:Number(aggregate.median_seconds)};
          await client.query(`INSERT INTO movement_cells (resort_id,topology_edge_id,window_start,device_count,median_seconds,published)
            VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (resort_id,topology_edge_id,window_start) DO UPDATE SET device_count=EXCLUDED.device_count,median_seconds=EXCLUDED.median_seconds,published=true`,[resort,sample.edgeId,sample.window,publication.deviceCount,publication.medianSeconds]);
          published.push(publication);
        }
      }
      await client.query('COMMIT');
      return published;
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }

  async pruneExpired(){
    await this.pool.query(`WITH expired_reports AS (DELETE FROM community_reports WHERE expires_at<=now()),
      expired_samples AS (DELETE FROM movement_samples WHERE expires_at<=now()),
      expired_observations AS (DELETE FROM observations WHERE expires_at<now()-interval '7 days')
      DELETE FROM report_cooldowns WHERE last_received_at<now()-interval '2 hours'`);
  }
}

module.exports={PostgresRepository};
