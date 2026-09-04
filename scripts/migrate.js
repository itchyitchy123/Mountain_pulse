'use strict';

const {readFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {Pool}=require('pg');

async function main(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
  try{
    await pool.query("SELECT pg_advisory_lock(hashtext('mountainpulse-schema-migrations'))");
    await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied=await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1',['001_core.sql']);
    if(applied.rowCount){console.log(JSON.stringify({level:'info',event:'migration_already_applied',migration:'001_core.sql'}));return}
    const sql=await readFile(resolve(__dirname,'../db/migrations/001_core.sql'),'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)',['001_core.sql']);
    console.log(JSON.stringify({level:'info',event:'migration_complete',migration:'001_core.sql'}));
  }finally{await pool.query("SELECT pg_advisory_unlock(hashtext('mountainpulse-schema-migrations'))").catch(()=>{});await pool.end()}
}

main().catch(error=>{console.error(JSON.stringify({level:'error',event:'migration_failed',message:error.message}));process.exitCode=1});
