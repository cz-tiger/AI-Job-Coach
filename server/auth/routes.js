import { Router } from 'express';
import { signToken, authMiddleware } from './middleware.js';
import { pool } from '../db.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: '请输入手机号' });

  try {
    let result = await pool.query('select * from users where phone = $1', [phone]);
    if (!result.rows[0]) {
      result = await pool.query(
        'insert into users (id, phone) values (gen_random_uuid(), $1) returning *',
        [phone]
      );
    }
    const user = result.rows[0];
    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, phone: user.phone } });
  } catch (error) {
    res.status(500).json({ error: '登录失败' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('select id, phone, nickname, role from users where id = $1', [req.user.userId]);
    if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

export default router;
