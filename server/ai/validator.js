/**
 * AI 输出校验器
 */
const MAX_RETRIES = 2;

export function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const clean = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '');
  try { return JSON.parse(clean); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch {}
  return null;
}

export async function callWithValidation(callFn, validateFn, buildRetryPrompt) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const text = await callFn(attempt);
    if (!text) continue;
    const parsed = extractJSON(text);
    if (!parsed) {
      if (attempt < MAX_RETRIES) continue;
      return null;
    }
    const validated = validateFn(parsed);
    if (validated && validated.valid) return validated;
    if (attempt < MAX_RETRIES) continue;
  }
  return null;
}

export async function safeAI(callFn, validateFn, fallback) {
  try {
    const result = await callWithValidation(callFn, validateFn,
      (attempt) => attempt === 0 ? '请严格按 JSON 格式返回。' : '最后一次机会：只返回 JSON。');
    return result || { ...fallback, source: 'fallback', validationFailed: true };
  } catch (err) {
    console.error('[safeAI]', err.message);
    return { ...fallback, source: 'fallback', error: err.message };
  }
}
