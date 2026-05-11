import { Router } from 'express';
import { authMiddleware } from '../auth/middleware.js';
import { createOrder, computeHmacSignature, decryptNotifyResource } from './wechat-pay.js';
import { pool } from '../db.js';

const router = Router();

/**
 * POST /api/payment/create-order — 创建微信支付订单
 *
 * 请求：{ plan: 'monthly' | 'yearly' }
 * 响应：{ prepayId, timeStamp, nonceStr, package, paySign }
 *    → 小程序端调用 wx.requestPayment 调起支付
 */
router.post('/create-order', authMiddleware, async (req, res) => {
  const { plan, tier } = req.body || {};

  if (!['qa', 'premium'].includes(tier)) {
    return res.status(400).json({ error: '请选择有效的订阅档位（qa/premium）' });
  }

  if (!['monthly', 'yearly'].includes(plan)) {
    return res.status(400).json({ error: '请选择有效的订阅计划（monthly/yearly）' });
  }

  try {
    // 获取用户 openid
    const userResult = await pool.query(
      'select wechat_openid from users where id = $1',
      [req.user.userId]
    );
    const openid = userResult.rows[0]?.wechat_openid;

    if (!openid) {
      return res.status(400).json({ error: '请先使用微信登录' });
    }

    const paymentParams = await createOrder(openid, plan, tier);

    console.log(`[payment:create-order] user=${req.user.userId} plan=${plan} order=${paymentParams.outTradeNo}`);

    return res.json(paymentParams);
  } catch (error) {
    console.error('[payment:create-order]', error);
    return res.status(500).json({ error: error.message || '创建订单失败' });
  }
});

/**
 * POST /api/payment/notify — 微信支付回调
 *
 * 微信支付平台在用户支付成功后调用此接口。
 * 需要配置到微信商户平台：https://pay.weixin.qq.com
 *
 * 注意：此路由需要 express.raw() 解析（已在 app.js 配置）
 */
router.post('/notify', async (req, res) => {
  try {
    const body = req.body.toString('utf8');
    const signature = req.headers['wechatpay-signature'];
    const timestamp = req.headers['wechatpay-timestamp'];
    const nonce = req.headers['wechatpay-nonce'];
    const serial = req.headers['wechatpay-serial'];

    // 验签
    const expectedSign = computeHmacSignature(`${timestamp}\n${nonce}\n${body}\n`);
    if (signature !== expectedSign) {
      console.error('[payment:notify] signature verification failed');
      return res.status(400).json({ code: 'FAIL', message: '签名验证失败' });
    }

    // 解密回调数据
    const event = JSON.parse(body);
    const { ciphertext, associated_data, nonce: resourceNonce } = event.resource;
    const decrypted = decryptNotifyResource(ciphertext, associated_data, resourceNonce);

    // 处理支付成功
    if (decrypted.trade_state === 'SUCCESS') {
      const outTradeNo = decrypted.out_trade_no;
      const total = decrypted.amount?.total || 0;

      // 从订单号提取 userId（订单号格式：HERMES_timestamp_uuid）
      // 实际生产应查询订单表获取 userId
      // 这里通过 openid 反查
      const userResult = await pool.query(
        'select id from users where wechat_openid = $1',
        [decrypted.payer?.openid]
      );
      const userId = userResult.rows[0]?.id;

      if (userId) {
        // 根据金额识别档位和周期（1900=qa月, 4900=premium月, 19900=premium年）
        let plan, tier;
        if (total >= 19900) { plan = 'yearly'; tier = 'premium'; }
        else if (total >= 4900) { plan = 'monthly'; tier = 'premium'; }
        else { plan = 'monthly'; tier = 'qa'; }
        const days = plan === 'yearly' ? 365 : 30;
        const tierConfig = tier === 'premium'
          ? { dailyPracticeLimit: -1, dailyTutorLimit: -1, features: { wrongBook: 'detailed', report: true, parent: true } }
          : { dailyPracticeLimit: 10, dailyTutorLimit: -1, features: { wrongBook: 'detailed', report: false, parent: false } };

        await pool.query(
          `insert into subscriptions (id, user_id, plan, plan_tier, daily_limit, daily_practice_limit, daily_tutor_limit, features, expire_at)
           values (gen_random_uuid(), $1, $2, $3, 999, $4, $5, $6::jsonb, now() + interval '1 day' * $7)
           on conflict (user_id) do update
             set plan = $2, plan_tier = $3, daily_limit = 999,
                 daily_practice_limit = $4, daily_tutor_limit = $5,
                 features = $6::jsonb,
                 expire_at = greatest(subscriptions.expire_at, now()) + interval '1 day' * $7`,
          [userId, plan, tier, tierConfig.dailyPracticeLimit, tierConfig.dailyTutorLimit,
           JSON.stringify(tierConfig.features), days]
        );

        console.log(`[payment:notify] user=${userId} tier=${tier} plan=${plan} amount=${total / 100}元 order=${outTradeNo}`);
      }
    }

    // 必须返回成功，否则微信会重试
    return res.json({ code: 'SUCCESS', message: 'OK' });
  } catch (error) {
    console.error('[payment:notify]', error);
    return res.status(500).json({ code: 'FAIL', message: error.message });
  }
});

export default router;
