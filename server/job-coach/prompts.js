export const ROLES = {
  resumeOptimizer: {
    temperature: 0.3,
    system: '你是一位资深HR和职业规划师，曾在BAT等一线互联网公司担任招聘负责人。'
      + '你擅长分析简历问题，给出逐条具体的优化建议。只返回 JSON。',
    output: '{"sections":[{"title":"","original":"","optimized":"","suggestions":[]}],"overall_score":0,"summary":""}'
  },
  interviewer: {
    temperature: 0.7,
    system: '你是一位专业面试官。根据岗位要求进行结构化面试。'
      + '追问细节，挖掘候选人的真实能力和经验。营造真实但有压力的面试氛围。'
  },
  performanceAnalyst: {
    temperature: 0.3,
    system: '你是一位资深面试教练。从表达清晰度、逻辑性、专业度、应变力四个维度评估面试表现。只返回 JSON。',
    output: '{"score":{"clarity":0,"logic":0,"professionalism":0,"adaptability":0,"overall":0},"analysis":"","highlights":[],"improvements":[],"example_answers":[]}'
  },
  scriptGenerator: {
    temperature: 0.6,
    system: '你是一位职场导师，帮助求职者准备面试话术。只返回 JSON。',
    output: '{"scripts":[{"question":"","answer":"","tips":""}]}'
  }
};

export const INTERVIEW_TYPES = {
  technical: '技术面', hr: 'HR面', behavioral: '行为面', case: '案例面'
};

export function buildResumePrompt({ resume, jd }) {
  const r = ROLES.resumeOptimizer;
  const prompt = `请逐条分析以下简历，给出优化建议：

${jd ? '【岗位JD】\n' + jd + '\n' : ''}
【简历原文】
${resume}

要求：逐段分析并给出：原标题→优化标题→优化建议列表。如果提供了JD，同时给出匹配度评分（0-100）和差距分析。

返回格式：${r.output}`;
  return { system: r.system, user: prompt, temperature: r.temperature };
}

export function buildInterviewStartPrompt({ jobTitle, interviewType, jd }) {
  const r = ROLES.interviewer;
  const typeLabel = INTERVIEW_TYPES[interviewType] || '综合';
  const prompt = `你是一位${typeLabel}面试官，正在面试一个${jobTitle || '互联网'}岗位。

${jd ? '岗位要求：\n' + jd + '\n' : ''}
请用一句简短的开场白开始面试。介绍你的角色，然后开始第一个问题。不要加任何标记。`;
  return { system: r.system, user: prompt, temperature: r.temperature };
}

export function buildInterviewReplyPrompt({ jobTitle, interviewType, messages, jd }) {
  const r = ROLES.interviewer;
  const typeLabel = INTERVIEW_TYPES[interviewType] || '综合';
  const prompt = `岗位：${jobTitle || '互联网'}
面试类型：${typeLabel}${jd ? '\n岗位要求：' + jd : ''}

对话历史：
${messages.map(m => `${m.role === 'user' ? '候选人' : '面试官'}: ${m.content}`).join('\n')}

请以面试官视角自然回应。如果是技术面→追问技术细节；HR面→关注软技能和动机；行为面→要求STAR案例；案例面→抛出商业场景。不要加标记。`;
  return { system: r.system, user: prompt, temperature: r.temperature };
}

export function buildAnalysisPrompt({ jobTitle, interviewType, messages }) {
  const r = ROLES.performanceAnalyst;
  const typeLabel = INTERVIEW_TYPES[interviewType] || '综合';
  const prompt = `分析以下${jobTitle}岗位的${typeLabel}面试对话：

${messages.map(m => `${m.role === 'user' ? '候选人' : '面试官'}: ${m.content}`).join('\n')}

从四个维度评分（0-100）：clarity（表达清晰度）、logic（逻辑性）、professionalism（专业度）、adaptability（应变力）。
在example_answers中给出"应该怎么回答更好"的示例。

返回格式：${r.output}`;
  return { system: r.system, user: prompt, temperature: r.temperature };
}

export function buildScriptPrompt({ questions, jobTitle }) {
  const r = ROLES.scriptGenerator;
  const prompt = `岗位：${jobTitle || '互联网'}
面试常见问题：${questions || '自我介绍、离职原因、期望薪资、职业规划'}

为以上每个问题生成专业回答话术和使用技巧。

返回格式：${r.output}`;
  return { system: r.system, user: prompt, temperature: r.temperature };
}
