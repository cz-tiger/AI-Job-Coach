import { pool } from '../db.js';

const TIER_LIMITS = { free: 3, qa: 20, premium: -1 };

async function getConfig(userId) {
  try {
    const r = await pool.query('select plan_tier, expire_at from subscriptions where user_id = $1', [userId]);
    if (!r.rows[0]) return { tier: 'free', limit: TIER_LIMITS.free };
    const expired = r.rows[0].expire_at && new Date(r.rows[0].expire_at) < new Date();
    const tier = expired ? 'free' : (r.rows[0].plan_tier || 'free');
    return { tier, limit: TIER_LIMITS[tier] ?? TIER_LIMITS.free };
  } catch { return { tier: 'free', limit: TIER_LIMITS.free }; }
}

async function getDailyCount(userId, date) {
  try {
    const r = await pool.query('select practice_count from daily_usage where user_id = $1 and date = $2', [userId, date]);
    return r.rows[0]?.practice_count || 0;
  } catch { return 0; }
}

export async function interviewQuotaMiddleware(req, res, next) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: '未登录' });

  try {
    const { tier, limit } = await getConfig(userId);
    if (limit === -1) { req.quota = { tier, limit: -1, used: 0, remaining: -1 }; return next(); }

    const today = new Date().toISOString().slice(0, 10);
    const used = await getDailyCount(userId, today);
    if (used >= limit) return res.status(429).json({
      error: `今日面试次数已用完（${used}/${limit}）`, type: 'interview', limit, used, remaining: 0,
      upgradeTiers: tier === 'free' ? ['qa', 'premium'] : ['premium']
    });

    req.quota = { tier, limit, used, remaining: limit - used };
    const orig = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        pool.query(`insert into daily_usage (id, user_id, date, practice_count) values (gen_random_uuid(), $1, $2, 0) on conflict (user_id, date) do nothing`, [userId, today])
          .then(() => pool.query('update daily_usage set practice_count = practice_count + 1 where user_id = $1 and date = $2', [userId, today])).catch(() => {});
      }
      return orig(body);
    };
    next();
  } catch (err) { next(); }
}
