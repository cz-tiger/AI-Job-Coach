import { Router } from 'express';
import { authMiddleware } from '../auth/middleware.js';
import { pool } from '../db.js';

const router = Router();

const TIERS = {
  free: { name: '免费版', price: 0, dailyPracticeLimit: 3, features: { scenarios: '5个基础场景', analysis: false, scripts: false } },
  qa: { name: '进阶版', price: 1900, dailyPracticeLimit: 20, features: { scenarios: '20个场景', analysis: true, scripts: true } },
  premium: { name: '专业版', price: 4900, dailyPracticeLimit: -1, features: { scenarios: '全部场景+自定义', analysis: true, scripts: true, team: true } }
};

router.get('/plans', (_req, res) => {
  res.json({
    tiers: TIERS,
    compare: [
      { tier: 'free', name: '免费版', price: '¥0', practice: '3次/天', scenarios: '5个基础场景', analysis: '❌', scripts: '❌' },
      { tier: 'qa', name: '进阶版', price: '¥19/月', practice: '20次/天', scenarios: '20个场景', analysis: '✅ AI分析', scripts: '✅ 话术生成' },
      { tier: 'premium', name: '专业版', price: '¥49/月', practice: '✅ 无限', scenarios: '✅ 全部+自定义', analysis: '✅ 深度分析', scripts: '✅ 话术库' }
    ]
  });
});

router.post('/upgrade', authMiddleware, async (req, res) => {
  const { tier } = req.body || {};
  if (!['qa', 'premium'].includes(tier)) return res.status(400).json({ error: '无效的档位' });

  try {
    const cfg = TIERS[tier];
    const expireAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await pool.query(
      `insert into subscriptions (id, user_id, plan_tier, daily_practice_limit, features, expire_at)
       values (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5)
       on conflict (user_id) do update
         set plan_tier = $2, daily_practice_limit = $3, features = $4::jsonb, expire_at = $5`,
      [req.user.userId, tier, cfg.dailyPracticeLimit, JSON.stringify(cfg.features), expireAt.toISOString()]
    );
    res.json({ success: true, tier, expireAt: expireAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: '升级失败' });
  }
});

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query('select plan_tier, daily_practice_limit, features, expire_at from subscriptions where user_id = $1', [req.user.userId]);
    if (!r.rows[0]) return res.json({ tier: 'free', dailyPracticeLimit: 3, features: TIERS.free.features, expired: false });
    const s = r.rows[0];
    const expired = s.expire_at && new Date(s.expire_at) < new Date();
    res.json({
      tier: expired ? 'free' : (s.plan_tier || 'free'),
      dailyPracticeLimit: expired ? 3 : s.daily_practice_limit,
      features: typeof s.features === 'string' ? JSON.parse(s.features) : (s.features || TIERS.free.features),
      expireAt: s.expire_at,
      expired
    });
  } catch {
    res.json({ tier: 'free', dailyPracticeLimit: 3, features: TIERS.free.features, expired: false });
  }
});

export default router;
