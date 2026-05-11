import OpenAI from 'openai';
import { safeAI } from '../ai/validator.js';
import { buildResumePrompt, buildInterviewStartPrompt, buildInterviewReplyPrompt, buildAnalysisPrompt, buildScriptPrompt } from './prompts.js';

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined, timeout: 20000, maxRetries: 1 })
  : null;

// ============ 简历优化 ============

function validateResume(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    sections: Array.isArray(obj.sections) ? obj.sections.slice(0, 15).map(s => ({
      title: String(s.title || '').slice(0, 100),
      original: String(s.original || '').slice(0, 1000),
      optimized: String(s.optimized || '').slice(0, 2000),
      suggestions: Array.isArray(s.suggestions) ? s.suggestions.slice(0, 5).map(String) : []
    })) : [],
    overall_score: Math.min(100, Math.max(0, Number(obj.overall_score) || 0)),
    summary: String(obj.summary || '').slice(0, 1000),
    valid: true
  };
}

export async function optimizeResume(resume, jd) {
  if (!client) return { sections: [], overall_score: 0, summary: 'AI 服务暂不可用', source: 'fallback' };
  return safeAI(async () => {
    const { system, user, temperature } = buildResumePrompt({ resume, jd });
    const c = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || 'deepseek-chat', temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    return c.choices?.[0]?.message?.content || '';
  }, validateResume, { sections: [], overall_score: 0, summary: '', valid: true });
}

// ============ 模拟面试 ============

export async function startInterview(jobTitle, interviewType, jd) {
  if (!client) return '你好，我是今天的面试官。请先简单介绍一下自己。';
  try {
    const { system, user, temperature } = buildInterviewStartPrompt({ jobTitle, interviewType, jd });
    const c = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || 'deepseek-chat', temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    return c.choices?.[0]?.message?.content || '你好，请介绍一下你自己。';
  } catch { return '你好，我是今天的面试官。请先做一个简短的自我介绍。'; }
}

export async function interviewReply(jobTitle, interviewType, messages, jd) {
  if (!client) return '嗯，请继续。能再说得具体一些吗？';
  try {
    const { system, user, temperature } = buildInterviewReplyPrompt({ jobTitle, interviewType, messages, jd });
    const c = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || 'deepseek-chat', temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    return c.choices?.[0]?.message?.content || '好的，我理解了。下一个问题...';
  } catch { return '请继续，我对你刚才提到的那个项目经历很感兴趣。'; }
}

// ============ 面试分析 ============

function validateAnalysis(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    score: {
      clarity: Math.min(100, Math.max(0, Number(obj.score?.clarity) || 50)),
      logic: Math.min(100, Math.max(0, Number(obj.score?.logic) || 50)),
      professionalism: Math.min(100, Math.max(0, Number(obj.score?.professionalism) || 50)),
      adaptability: Math.min(100, Math.max(0, Number(obj.score?.adaptability) || 50)),
      overall: Math.min(100, Math.max(0, Number(obj.score?.overall) || 50))
    },
    analysis: String(obj.analysis || '').slice(0, 2000),
    highlights: Array.isArray(obj.highlights) ? obj.highlights.slice(0, 5).map(String) : [],
    improvements: Array.isArray(obj.improvements) ? obj.improvements.slice(0, 5).map(String) : [],
    example_answers: Array.isArray(obj.example_answers) ? obj.example_answers.slice(0, 3).map(String) : [],
    valid: true
  };
}

export async function analyzeInterview(jobTitle, interviewType, messages) {
  if (!client) return { score: { clarity: 50, logic: 50, professionalism: 50, adaptability: 50, overall: 50 }, analysis: 'AI 暂不可用', highlights: [], improvements: [], example_answers: [], source: 'fallback' };
  return safeAI(async () => {
    const { system, user, temperature } = buildAnalysisPrompt({ jobTitle, interviewType, messages });
    const c = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || 'deepseek-chat', temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    return c.choices?.[0]?.message?.content || '';
  }, validateAnalysis, { score: { clarity: 50, logic: 50, professionalism: 50, adaptability: 50, overall: 50 }, analysis: '', highlights: [], improvements: [], example_answers: [], valid: true });
}

// ============ 话术生成 ============

function validateScripts(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    scripts: Array.isArray(obj.scripts) ? obj.scripts.slice(0, 8).map(s => ({
      question: String(s.question || '').slice(0, 300),
      answer: String(s.answer || '').slice(0, 1000),
      tips: String(s.tips || '').slice(0, 500)
    })) : [],
    valid: true
  };
}

export async function generateScripts(questions, jobTitle) {
  if (!client) return [{ question: '自我介绍', answer: '您好，我叫...，有N年XX经验，擅长...', tips: '控制在1分钟内，突出与岗位匹配的经历' }];
  return safeAI(async () => {
    const { system, user, temperature } = buildScriptPrompt({ questions, jobTitle });
    const c = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || 'deepseek-chat', temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    return c.choices?.[0]?.message?.content || '';
  }, validateScripts, { scripts: [], valid: true });
}
