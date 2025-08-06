# 🚀 Gemini API 智能冷却负载均衡代理 - 部署指南

## 📋 部署前准备

### 1. 准备 Gemini API Keys

您需要准备 3-5 个有效的 Gemini API keys：

```bash
# 示例 keys（请替换为您的真实 keys）
AIzaSyABC123def456ghi789jkl012mno345pqr678
AIzaSyDEF789ghi012jkl345mno678pqr901stu234
AIzaSyGHI345jkl678mno901pqr234stu567vwx890
AIzaSyJKL901mno234pqr567stu890vwx123yza456
```

### 2. 准备认证 Tokens

为前端应用创建认证 tokens：

```bash
# 示例 tokens（请替换为您的自定义 tokens）
my-app-frontend-token-2024
admin-dashboard-token-secure
mobile-app-token-v1
```

## 🌐 Cloudflare 网页端部署

### 步骤 1: 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 点击 "Workers & Pages" → "Create application" → "Create Worker"
3. 输入名称：`gemini-proxy-intelligent-cooling`
4. 点击 "Deploy"

### 步骤 2: 部署代码

1. 点击 "Edit code"
2. 删除默认代码
3. 复制粘贴整个 `worker.js` 文件内容
4. 点击 "Save and deploy"

### 步骤 3: 配置环境变量

在 "Settings" → "Environment Variables" 中添加：

#### 必需变量（Secret 类型）

```
变量名: GEMINI_API_KEYS
类型: Secret
值: key1,key2,key3,key4
描述: Gemini API 密钥池，逗号分隔
```

```
变量名: VALID_AUTH_TOKENS
类型: Secret  
值: token1,token2,token3
描述: 前端认证令牌池，逗号分隔
```

#### 可选变量（Text 类型）

```
变量名: LOAD_BALANCE_STRATEGY
类型: Text
值: round-robin
描述: 负载均衡策略（round-robin 或 random）
```

```
变量名: HEALTH_CHECK_INTERVAL
类型: Text
值: 300
描述: 健康检查间隔（秒）
```

### 步骤 4: 验证部署

部署完成后，您会获得 Worker URL：
```
https://gemini-proxy-intelligent-cooling.your-username.workers.dev
```

## 🧪 功能测试

### 1. 状态检查测试

```bash
curl -H "Authorization: Bearer your-auth-token" \
     https://your-worker-url.workers.dev/v1/status
```

**预期响应：**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "keyPool": {
    "totalKeys": 4,
    "availableKeys": 4,
    "failedKeys": 0,
    "coolingKeys": 0,
    "strategy": "round-robin"
  },
  "auth": {
    "validTokens": 3
  },
  "version": "2.1.0-intelligent-cooling",
  "features": [
    "Load Balancing",
    "Intelligent Error Handling",
    "24h Cooling for 429/503",
    "5min Cooling for 502/504",
    "Auto Recovery"
  ]
}
```

### 2. 聊天接口测试

```bash
curl -X POST \
     -H "Authorization: Bearer your-auth-token" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemini-2.5-flash",
       "messages": [
         {"role": "user", "content": "Hello, test message"}
       ],
       "max_tokens": 50
     }' \
     https://your-worker-url.workers.dev/v1/chat/completions
```

### 3. 使用测试脚本

```bash
# 修改 test-api.js 中的配置
const TEST_CONFIG = {
  workerUrl: 'https://your-worker-url.workers.dev',
  authToken: 'your-auth-token'
};

# 运行测试
node test-api.js
```

## 🔧 高级配置

### 自定义域名

1. 在 Cloudflare Dashboard 中添加自定义域名
2. 配置 DNS 记录指向 Worker
3. 启用 SSL/TLS

### 速率限制

可以在 Worker 中添加额外的速率限制：

```javascript
// 在 worker.js 中添加
const RATE_LIMIT = {
  requests: 100,    // 每分钟请求数
  window: 60000     // 时间窗口（毫秒）
};
```

### 监控和告警

1. 启用 Cloudflare Analytics
2. 设置 Worker 指标监控
3. 配置告警规则

## 🛠️ 故障排查

### 常见问题

#### 1. "Service configuration error"

**原因**: 环境变量未正确设置
**解决**: 检查 `GEMINI_API_KEYS` 和 `VALID_AUTH_TOKENS` 是否正确配置

#### 2. "Invalid authorization token"

**原因**: 前端使用的 token 不在有效列表中
**解决**: 确认 token 在 `VALID_AUTH_TOKENS` 中

#### 3. "All API keys failed or cooling"

**原因**: 所有 keys 都失效或处于冷却状态
**解决**: 
- 检查 `/v1/status` 查看详细状态
- 等待冷却期结束
- 添加更多有效的 API keys

#### 4. Keys 频繁进入冷却状态

**原因**: API 使用量超过限制
**解决**:
- 增加更多 API keys
- 检查请求频率
- 考虑升级 Gemini API 配额

### 冷却状态说明

| 状态 | 触发条件 | 冷却时间 | 恢复方式 |
|------|----------|----------|----------|
| 永久失效 | 401/403 错误 | 永久 | 手动更换 key |
| 长期冷却 | 429/503 错误 | 24小时 | 自动恢复 |
| 短期冷却 | 502/504 错误 | 5分钟 | 自动恢复 |
| 中期冷却 | 其他 5xx 错误 | 10分钟 | 自动恢复 |

### 性能监控

通过 `/v1/status` 端点监控：

- **totalKeys**: 配置的总 key 数量
- **availableKeys**: 当前可用的 key 数量
- **failedKeys**: 永久失效的 key 数量
- **coolingKeys**: 正在冷却的 key 数量
- **coolingDetails**: 详细的冷却信息

## 📊 最佳实践

### 1. API Key 管理

- **数量**: 建议配置 3-5 个 keys
- **轮换**: 定期更换 keys 以提高安全性
- **监控**: 定期检查 key 状态和使用情况

### 2. 负载均衡策略

- **round-robin**: 适合 keys 性能相近的场景（推荐）
- **random**: 适合需要随机分布的场景

### 3. 冷却时间调整

如需调整冷却时间，修改 `handleApiError` 函数：

```javascript
if (status === 429) {
  // 调整 429 错误的冷却时间（当前 24 小时）
  keyPool.markKeyCooling(apiKey, 12 * 60); // 改为 12 小时
}
```

### 4. 安全建议

- 使用强随机的认证 tokens
- 定期轮换 API keys 和 tokens
- 启用 Cloudflare 的安全功能
- 监控异常请求模式

## 🔄 维护和更新

### 定期维护

1. **每周**: 检查 key 状态和使用情况
2. **每月**: 更新认证 tokens
3. **每季度**: 轮换 API keys

### 版本更新

关注项目更新，获取最新功能和安全修复：

- 智能冷却算法优化
- 新的错误处理机制
- 性能改进
- 安全增强

## 📞 支持

如遇到问题：

1. 查看 `/v1/status` 端点的详细状态
2. 检查 Cloudflare Workers 日志
3. 参考故障排查部分
4. 使用测试脚本验证功能

---

**部署完成后，您将拥有一个高性能、高可用的 Gemini API 智能冷却负载均衡代理服务！** 🎉