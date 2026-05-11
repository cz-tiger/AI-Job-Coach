# AI 求职助手

AI 帮你优化简历、模拟面试、拿到 offer。

## 功能

- **简历优化**: 粘贴简历+JD → AI 逐段诊断（动词优化/量化成果/关键词匹配）
- **岗位匹配**: AI 分析匹配度并给出修改方向
- **模拟面试**: AI 扮演 4 种面试官（技术面/HR面/行为面/案例面）
- **表现分析**: 4 维度评分（表达清晰度/逻辑性/专业度/应变力）
- **话术生成**: 自我介绍、离职原因等关键回答模板

## 技术栈

- Node.js + Express 5
- PostgreSQL (Supabase)
- DeepSeek AI
- WeChat 小程序
- WeChat Pay API v3

## 快速开始

```bash
npm install
cp .env.example .env
npm start              # http://localhost:8790
npm test               # 运行测试
```

## 定价

| 档位 | 价格 | 简历优化 | 模拟面试 |
|------|------|---------|---------|
| 免费版 | ¥0 | 1次 | 3次/天 |
| 进阶版 | ¥19/月 | 10次/月 | 20次/天 |
| 专业版 | ¥49/月 | 无限 | 无限 |

## 项目结构

```
server/
  job-coach/        # AI 面试训练引擎
  subscription/     # 订阅管理
  payment/          # 微信支付
miniprogram/        # WeChat 小程序
```
