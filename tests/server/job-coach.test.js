import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('openai', () => ({
  default: function () { return { chat: { completions: { create: () => Promise.resolve({ choices: [{ message: { content: '{}' } }] }) } } }; }
}));

vi.mock('../../server/db.js', () => ({ pool: { query: vi.fn() } }));

// ============ Prompts Tests ============
import { buildResumePrompt, buildInterviewStartPrompt, buildInterviewReplyPrompt, buildAnalysisPrompt, buildScriptPrompt, ROLES, INTERVIEW_TYPES } from '../../server/job-coach/prompts.js';

describe('Job Coach Prompts', () => {
  it('buildResumePrompt includes resume and JD', () => {
    const r = buildResumePrompt({ resume: '测试简历', jd: '测试JD' });
    expect(r.user).toContain('测试简历');
    expect(r.user).toContain('测试JD');
    expect(r.temperature).toBe(0.3);
  });

  it('buildInterviewStartPrompt includes job title', () => {
    const r = buildInterviewStartPrompt({ jobTitle: '前端工程师', interviewType: 'technical', jd: 'React' });
    expect(r.user).toContain('前端工程师');
    expect(r.user).toContain('技术面');
  });

  it('buildInterviewReplyPrompt includes conversation history', () => {
    const r = buildInterviewReplyPrompt({ jobTitle: 'PM', interviewType: 'hr', messages: [{ role: 'user', content: '你好' }] });
    expect(r.user).toContain('你好');
  });

  it('buildAnalysisPrompt has low temperature', () => {
    const r = buildAnalysisPrompt({ jobTitle: '设计', interviewType: 'behavioral', messages: [] });
    expect(r.temperature).toBe(0.3);
  });

  it('buildScriptPrompt includes questions', () => {
    const r = buildScriptPrompt({ questions: '自我介绍', jobTitle: '销售' });
    expect(r.user).toContain('自我介绍');
  });

  it('ROLES has all 4 roles', () => {
    expect(ROLES.resumeOptimizer).toBeDefined();
    expect(ROLES.interviewer).toBeDefined();
    expect(ROLES.performanceAnalyst).toBeDefined();
    expect(ROLES.scriptGenerator).toBeDefined();
  });

  it('INTERVIEW_TYPES maps correctly', () => {
    expect(INTERVIEW_TYPES.technical).toBe('技术面');
    expect(INTERVIEW_TYPES.hr).toBe('HR面');
  });
});

// ============ Middleware Tests ============
const { pool } = await import('../../server/db.js');
const { interviewQuotaMiddleware } = await import('../../server/job-coach/middleware.js');

describe('interviewQuotaMiddleware', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when not logged in', async () => {
    const req = { user: null };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await interviewQuotaMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('passes for premium users', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'premium', expire_at: '2027-01-01' }] });
    const req = { user: { userId: 'u1' } };
    const next = vi.fn();
    await interviewQuotaMiddleware(req, {}, next);
    expect(next).toHaveBeenCalled();
    expect(req.quota.limit).toBe(-1);
  });

  it('blocks free user when limit exceeded', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] }).mockResolvedValueOnce({ rows: [{ practice_count: 3 }] });
    const req = { user: { userId: 'u1' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await interviewQuotaMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

// ============ Generator Tests ============
import { startInterview, interviewReply } from '../../server/job-coach/generator.js';

describe('Interview Generator', () => {
  it('startInterview returns string', async () => {
    const r = await startInterview('前端', 'technical', '');
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });

  it('interviewReply returns string', async () => {
    const r = await interviewReply('PM', 'hr', [{ role: 'user', content: '你好' }], '');
    expect(typeof r).toBe('string');
  });
});
