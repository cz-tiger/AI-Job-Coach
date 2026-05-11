/**
 * 微信支付 API v3 客户端
 *
 * JSAPI 支付流程：
 *   小程序端 wx.login() → 服务端统一下单 → 返回 prepay_id →
 *   小程序端 wx.requestPayment() → 微信回调 → 更新订阅
 *
 * 商户必备参数（从微信商户平台获取）：
 *   WX_MCHID       — 商户号
 *   WX_API_V3_KEY  — API v3 密钥（32位）
 *   WX_SERIAL_NO   — 商户证书序列号
 *   WX_PRIVATE_KEY — 商户私钥（apiclient_key.pem 内容）
 *   WX_PAY_NOTIFY  — 支付回调 URL
 */

import { createHash, createSign, createVerify, createDecipheriv, createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';

const MCHID = process.env.WX_MCHID;
const API_V3_KEY = process.env.WX_API_V3_KEY;
const SERIAL_NO = process.env.WX_SERIAL_NO;
const PRIVATE_KEY = process.env.WX_PRIVATE_KEY;
const NOTIFY_URL = process.env.WX_PAY_NOTIFY;
const APPID = process.env.WX_APPID;

// 订阅价格（单位：分）
const TIER_PRICES = {
  qa: { monthly: 1900 },
  premium: { monthly: 4900, yearly: 19900 }
};

/**
 * 生成微信支付签名（API v3 鉴权）
 */
function sign(method, url, body) {
  const nonce = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;

  const signature = createSign('RSA-SHA256')
    .update(message)
    .sign(PRIVATE_KEY, 'base64');

  return {
    Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${MCHID}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${SERIAL_NO}"`
  };
}

/**
 * JSAPI 统一下单
 *
 * @param {string} openid — 用户的微信 openid
 * @param {string} plan — 'monthly' | 'yearly'
 * @returns {object} — { prepay_id, nonceStr, paySign, ... } 供小程序调起支付
 */
export async function createOrder(openid, plan, tier = 'premium') {
  if (!MCHID || !PRIVATE_KEY) {
    throw new Error('微信支付未配置（缺少商户号或私钥）');
  }

  const priceInCents = TIER_PRICES[tier]?.[plan] || 4900;

  const tierLabel = tier === 'qa' ? '问答版' : '完整版';
  const planLabel = plan === 'yearly' ? '年度' : '月度';
  const description = `AI 教育导师${tierLabel}${planLabel}会员`;

  const outTradeNo = `HERMES_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const body = JSON.stringify({
    appid: APPID,
    mchid: MCHID,
    description,
    out_trade_no: outTradeNo,
    notify_url: NOTIFY_URL,
    amount: { total: priceInCents, currency: 'CNY' },
    payer: { openid }
  });

  const url = '/v3/pay/transactions/jsapi';
  const headers = sign('POST', url, body);

  const res = await fetch(`https://api.mch.weixin.qq.com${url}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[wxpay:createOrder]', data);
    throw new Error(data.message || '下单失败');
  }

  // 生成小程序调起支付所需参数
  const prepayId = data.prepay_id;
  const nonceStr = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const packageStr = `prepay_id=${prepayId}`;

  // 生成调起支付的签名
  const signStr = `${APPID}\n${timestamp}\n${nonceStr}\n${packageStr}\n`;
  const paySign = createSign('RSA-SHA256')
    .update(signStr)
    .sign(PRIVATE_KEY, 'base64');

  return {
    prepayId,
    outTradeNo,
    timeStamp: String(timestamp),
    nonceStr,
    package: packageStr,
    signType: 'RSA',
    paySign
  };
}

/**
 * 验证支付回调签名
 */
export function verifyNotify(body, signature, timestamp, nonce) {
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const verified = createVerify('RSA-SHA256')
    .update(message)
    .verify(process.env.WX_PLATFORM_CERT || '', signature, 'base64');

  return verified;
}

/**
 * 解密回调中的敏感字段
 */
export function decryptNotifyResource(ciphertext, associatedData, nonce) {
  // WeChat Pay API v3: ciphertext/nonce/associatedData 均为 base64 编码
  // ciphertext = base64(encrypted_data || auth_tag)，其中 auth_tag 为最后 16 字节
  const cipherBytes = Buffer.from(ciphertext, 'base64');
  const authTag = cipherBytes.slice(-16);
  const data = cipherBytes.slice(0, -16);

  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(API_V3_KEY, 'utf8'),
    Buffer.from(nonce, 'base64')
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData, 'base64'));

  let decoded = decipher.update(data, undefined, 'utf8');
  decoded += decipher.final('utf8');
  return JSON.parse(decoded);
}

/**
 * 生成 HMAC-SHA256 签名（用于回调验签）
 */
export function computeHmacSignature(data) {
  return createHmac('sha256', API_V3_KEY)
    .update(data)
    .digest('base64');
}
