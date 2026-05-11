import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-sales-coach-dev-secret-key-2026';

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { userId: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}
