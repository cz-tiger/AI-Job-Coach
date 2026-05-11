const api = require('../../services/api.js');
Page({
  data: {
    phase: 'menu',  // menu | resume | interview | analyzing | result
    resume: '', jd: '', jobTitle: '', interviewType: 'technical',
    sessionId: null, messages: [], inputText: '', sending: false,
    resumeResult: null, analysis: null, loading: false
  },
  onShow() { if (!api.getToken()) wx.redirectTo({ url: '/pages/login/index' }); },

  // Resume flow
  onResumeInput(e) { this.setData({ resume: e.detail.value }); },
  onJDInput(e) { this.setData({ jd: e.detail.value }); },
  async onOptimize() {
    if (this.data.resume.length < 50) return wx.showToast({ title: '简历太短', icon: 'none' });
    this.setData({ loading: true });
    try {
      const r = await api.optimizeResume(this.data.resume, this.data.jd);
      this.setData({ resumeResult: r.data, phase: 'resume', loading: false });
    } catch { this.setData({ loading: false }); }
  },

  // Interview flow
  onJobTitleInput(e) { this.setData({ jobTitle: e.detail.value }); },
  onTypeTap(e) { this.setData({ interviewType: e.currentTarget.dataset.type }); },
  async onStartInterview() {
    this.setData({ loading: true });
    try {
      const r = await api.startInterview(this.data.jobTitle || '互联网', this.data.interviewType, this.data.jd);
      this.setData({ sessionId: r.data.sessionId, messages: [{ role: 'assistant', content: r.data.opening }], phase: 'interview', loading: false });
    } catch { this.setData({ loading: false }); }
  },
  onInputChange(e) { this.setData({ inputText: e.detail.value }); },
  async onSend() {
    const text = this.data.inputText.trim(); if (!text) return;
    const msgs = [...this.data.messages, { role: 'user', content: text }];
    this.setData({ messages: msgs, inputText: '', sending: true });
    try {
      const r = await api.interviewReply(this.data.sessionId, text);
      this.setData({ messages: [...msgs, { role: 'assistant', content: r.data.reply }], sending: false });
    } catch { this.setData({ sending: false }); }
  },
  async onFinish() {
    this.setData({ phase: 'analyzing' });
    try {
      const r = await api.analyzeInterview(this.data.sessionId);
      this.setData({ analysis: r.data, phase: 'result' });
    } catch { this.setData({ phase: 'interview' }); }
  },
  onMenu() { this.setData({ phase: 'menu', resumeResult: null, analysis: null }); }
});
