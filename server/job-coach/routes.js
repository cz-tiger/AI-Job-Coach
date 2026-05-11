import { Router } from 'express';
import { authMiddleware } from '../auth/middleware.js';
import { interviewQuotaMiddleware } from './middleware.js';
import { optimizeResume, startInterview, interviewReply, analyzeInterview, generateScripts } from './generator.js';
import { pool } from '../db.js';

const router = Router();

// ============ 简历优化 ============

router.post('/resume/optimize', authMiddleware, async (req, res) => {
  const { resume, jd } = req.body || {};
  if (!resume || resume.length < 50) return res.status(400).json({ error: '简历内容太短，请提供完整简历' });

  try {
    const result = await optimizeResume(String(resume).slice(0, 5000), jd ? String(jd).slice(0, 3000) : '');
    const dbRes = await pool.query(
      `insert into resume_optimizations (id, user_id, original, optimized, jd_text, match_score)
       values (gen_random_uuid(), $1, $2, $3::jsonb, $4, $5) returning id`,
      [req.user.userId, resume, JSON.stringify(result), jd || null, result.overall_score || null]
    );
    res.json({ id: dbRes.rows[0].id, ...result });
  } catch (err) {
    console.error('[job-coach:resume]', err);
    res.status(500).json({ error: '简历优化失败' });
  }
});

router.get('/resume/history', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query('select id, match_score, created_at from resume_optimizations where user_id = $1 order by created_at desc limit 20', [req.user.userId]);
    res.json({ optimizations: r.rows });
  } catch { res.status(500).json({ error: '获取失败' }); }
});

router.get('/resume/:id', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query('select * from resume_optimizations where id = $1 and user_id = $2', [req.params.id, req.user.userId]);
    if (!r.rows[0]) return res.status(404).json({ error: '不存在' });
    const o = r.rows[0];
    res.json({ id: o.id, original: o.original, optimized: typeof o.optimized === 'string' ? JSON.parse(o.optimized) : o.optimized, jdText: o.jd_text, matchScore: o.match_score, createdAt: o.created_at });
  } catch { res.status(500).json({ error: '获取失败' }); }
});

// ============ 模拟面试 ============

router.post('/interview/start', authMiddleware, interviewQuotaMiddleware, async (req, res) => {
  const { jobTitle = '互联网', interviewType = 'technical', jd = '' } = req.body || {};
  try {
    const opening = await startInterview(jobTitle, interviewType, jd);
    const r = await pool.query(
      `insert into interview_sessions (id, user_id, job_title, interview_type, messages)
       values (gen_random_uuid(), $1, $2, $3, $4::jsonb) returning id`,
      [req.user.userId, jobTitle, interviewType, JSON.stringify([{ role: 'assistant', content: opening, timestamp: new Date().toISOString() }])]
    );
    res.json({ sessionId: r.rows[0].id, opening, quota: req.quota });
  } catch (err) {
    console.error('[job-coach:start]', err);
    res.status(500).json({ error: '开始失败' });
  }
});

router.post('/interview/reply', authMiddleware, async (req, res) => {
  const { sessionId, message } = req.body || {};
  if (!sessionId || !message) return res.status(400).json({ error: '缺少参数' });
  try {
    const r = await pool.query('select * from interview_sessions where id = $1 and user_id = $2', [sessionId, req.user.userId]);
    if (!r.rows[0]) return res.status(404).json({ error: '会话不存在' });
    const s = r.rows[0];
    const msgs = typeof s.messages === 'string' ? JSON.parse(s.messages) : s.messages;
    msgs.push({ role: 'user', content: String(message).trim(), timestamp: new Date().toISOString() });
    const reply = await interviewReply(s.job_title, s.interview_type, msgs, '');
    msgs.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });
    await pool.query('update interview_sessions set messages = $1::jsonb where id = $2', [JSON.stringify(msgs), sessionId]);
    res.json({ reply, messages: msgs });
  } catch (err) { res.status(500).json({ error: '发送失败' }); }
});

router.post('/interview/analyze', authMiddleware, async (req, res) => {
  const { sessionId } = req.body || {};
  try {
    const r = await pool.query('select * from interview_sessions where id = $1 and user_id = $2', [sessionId, req.user.userId]);
    if (!r.rows[0]) return res.status(404).json({ error: '不存在' });
    const s = r.rows[0];
    const msgs = typeof s.messages === 'string' ? JSON.parse(s.messages) : s.messages;
    const analysis = await analyzeInterview(s.job_title, s.interview_type, msgs);
    await pool.query(`update interview_sessions set score = $1::jsonb, analysis = $2, suggestions = $3, status = 'completed', completed_at = now() where id = $4`,
      [JSON.stringify(analysis.score), analysis.analysis, analysis.improvements || [], sessionId]);
    res.json({ score: analysis.score, analysis: analysis.analysis, highlights: analysis.highlights, improvements: analysis.improvements, exampleAnswers: analysis.example_answers });
  } catch (err) { res.status(500).json({ error: '分析失败' }); }
});

router.get('/interview/sessions', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query('select id, job_title, interview_type, score, status, created_at, completed_at from interview_sessions where user_id = $1 order by created_at desc limit 20', [req.user.userId]);
    res.json({ sessions: r.rows.map(s => ({ ...s, score: typeof s.score === 'string' ? JSON.parse(s.score) : s.score })) });
  } catch { res.status(500).json({ error: '获取失败' }); }
});

router.post('/interview/script', authMiddleware, async (req, res) => {
  const { questions, jobTitle } = req.body || {};
  try {
    const result = await generateScripts(questions || '自我介绍、离职原因、期望薪资', jobTitle || '');
    res.json({ scripts: Array.isArray(result) ? result : result.scripts, source: result.source || 'ai' });
  } catch { res.status(500).json({ error: '生成失败' }); }
});

export default router;
