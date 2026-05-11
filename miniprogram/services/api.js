const API_BASE = 'http://localhost:8790';
function getToken() { try { return wx.getStorageSync('auth_token'); } catch { return null; } }
function setToken(t) { wx.setStorageSync('auth_token', t); }

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const h = { 'Content-Type': 'application/json' };
    const t = getToken(); if (t) h['Authorization'] = `Bearer ${t}`;
    wx.request({
      url: `${API_BASE}${path}`, method, header: h, data,
      success(r) {
        if (r.statusCode === 401) { wx.redirectTo({ url: '/pages/login/index' }); return reject(new Error('过期')); }
        if (r.statusCode === 429) { wx.showModal({ title: '额度用完', content: r.data?.error, confirmText: '升级', success(x) { if (x.confirm) wx.navigateTo({ url: '/pages/subscription/index' }); } }); return reject(new Error('quota')); }
        resolve(r);
      },
      fail: reject
    });
  });
}

module.exports = {
  API_BASE, getToken, setToken, request,
  login: (p) => request('/api/auth/login', 'POST', { phone: p }),
  optimizeResume: (resume, jd) => request('/api/resume/optimize', 'POST', { resume, jd }),
  getResumeHistory: () => request('/api/resume/history'),
  getResume: (id) => request(`/api/resume/${id}`),
  startInterview: (jobTitle, interviewType, jd) => request('/api/interview/start', 'POST', { jobTitle, interviewType, jd }),
  interviewReply: (sessionId, message) => request('/api/interview/reply', 'POST', { sessionId, message }),
  analyzeInterview: (sessionId) => request('/api/interview/analyze', 'POST', { sessionId }),
  getInterviewSessions: () => request('/api/interview/sessions'),
  generateScripts: (questions, jobTitle) => request('/api/interview/script', 'POST', { questions, jobTitle }),
  getPlans: () => request('/api/subscription/plans'),
  getStatus: () => request('/api/subscription/status'),
  upgrade: (tier) => request('/api/subscription/upgrade', 'POST', { tier })
};
