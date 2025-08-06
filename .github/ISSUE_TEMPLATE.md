---
name: 问题报告
about: 创建问题报告以帮助我们改进项目
title: '[BUG] '
labels: bug
assignees: ''
---

## 🐛 问题描述

请清晰简洁地描述遇到的问题。

## 🔄 复现步骤

请提供详细的复现步骤：

1. 访问 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

## 🎯 期望行为

请清晰简洁地描述您期望发生的行为。

## 📸 截图

如果适用，请添加截图来帮助解释您的问题。

## 🌐 环境信息

请完成以下信息：

- **Worker URL**: [例如 https://your-worker.your-subdomain.workers.dev]
- **浏览器**: [例如 Chrome, Safari]
- **版本**: [例如 22]
- **操作系统**: [例如 iOS]
- **设备**: [例如 iPhone6]

## 📋 服务状态

请提供 `/v1/status` 端点的响应（请隐藏敏感信息）：

```json
{
  "status": "healthy",
  "keyPool": {
    "totalKeys": 4,
    "availableKeys": 2,
    "failedKeys": 1,
    "coolingKeys": 1
  }
}
```

## 🔍 错误信息

如果有错误信息，请提供完整的错误响应：

```json
{
  "error": {
    "message": "错误信息",
    "type": "错误类型",
    "code": 500
  }
}
```

## 📝 请求示例

请提供导致问题的请求示例（请隐藏敏感信息）：

```bash
curl -X POST https://your-worker-url.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer [HIDDEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

## 🔧 已尝试的解决方案

请描述您已经尝试过的解决方案：

- [ ] 检查了服务状态
- [ ] 验证了认证 token
- [ ] 查看了文档
- [ ] 重新部署了 Worker
- [ ] 其他：

## 📚 附加信息

请添加任何其他有助于解决问题的信息。

## ✅ 检查清单

请确认您已经：

- [ ] 搜索了现有的 Issues
- [ ] 查看了 [故障排查指南](../docs/TROUBLESHOOTING.md)
- [ ] 提供了完整的环境信息
- [ ] 隐藏了敏感信息（API keys, tokens 等）
- [ ] 使用了描述性的标题