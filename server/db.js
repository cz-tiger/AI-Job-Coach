import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres', user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'Test1', max: 10, family: 4,
  ssl: { rejectUnauthorized: false }
});

export async function checkDb() {
  try { await pool.query('select 1'); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
}

export async function initDb() {
  await pool.query(`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(), phone varchar(20) unique,
      wechat_openid varchar(100) unique, nickname text, created_at timestamptz default now()
    );
    create table if not exists subscriptions (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) unique,
      plan_tier text default 'free', daily_practice_limit int default 3,
      features jsonb default '{}', expire_at timestamptz, created_at timestamptz default now()
    );
    create table if not exists daily_usage (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id),
      date date not null, practice_count int default 0, unique(user_id, date)
    );
    create table if not exists resume_optimizations (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id),
      original text not null, optimized jsonb, jd_text text, match_score integer,
      created_at timestamptz default now()
    );
    create table if not exists interview_sessions (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id),
      job_title text, interview_type text, messages jsonb not null default '[]',
      score jsonb, analysis text, suggestions text[],
      status text default 'active', created_at timestamptz default now(), completed_at timestamptz
    );
    create index if not exists resume_opt_user_idx on resume_optimizations(user_id);
    create index if not exists interview_sess_user_idx on interview_sessions(user_id);
  `);
}
