# Gemini API 智能冷却负载均衡代理服务

这是一个基于 Cloudflare Workers 的高级 Gemini API 代理服务，支持智能冷却机制的 API key 池负载均衡和认证层。

## 🚀 核心特性

- **智能负载均衡**: 支持多个 Gemini API key 轮询/随机使用
- **智能冷却机制**: 区分永久失效和临时限流，自动冷却恢复
- **认证层**: 前端使用认证 token，后端使用真实 API key 池
- **高级容错**: 自动检测失效 key 并智能切换
- **实时监控**: 提供详细的状态检查和冷却信息
- **高性能**: 基于 Cloudflare Workers 边缘计算，性能开销 < 0.01%

## 📋 支持的 API 端点

- `POST /v1/chat/completions` - 聊天完成接口
- `GET /v1/models` - 模型列表接口
- `POST /v1/embeddings` - 嵌入向量接口
- `GET /v1/status` - 服务状态检查

## 🚀 快速部署

### 一键部署到 Cloudflare Workers

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Pizone-ai/balance-gemini)

点击上方按钮即可一键部署到 Cloudflare Workers！

### 手动部署

如果您需要更多控制或自定义配置，请查看详细的部署指南：

📖 **[查看完整部署指南](DEPLOYMENT_GUIDE.md)**

#### 快速开始

1. **准备 API Keys**
   - 获取 Gemini API Keys：[Google AI Studio](https://makersuite.google.com/app/apikey)
   - 创建认证 Tokens（用于前端应用）

2. **部署到 Cloudflare**
   ```bash
   # 克隆项目
   git clone https://github.com/Pizone-ai/balance-gemini.git
   cd balance-gemini
   
   # 安装依赖
   npm install
   
   # 配置环境变量
   wrangler secret put GEMINI_API_KEYS
   wrangler secret put VALID_AUTH_TOKENS
   
   # 部署
   wrangler deploy
   ```

3. **验证部署**
   ```bash
   curl -H "Authorization: Bearer your-auth-token" \
        https://your-worker-url.workers.dev/v1/status
   ```

## 🔑 使用方式

### 前端调用示例

```javascript
// 使用认证 token 调用（不是真实的 Gemini API key）
const response = await fetch('https://your-worker.your-subdomain.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-auth-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gemini-2.5-flash', // 支持所有 Gemini 模型
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    stream: false
  })
});

const data = await response.json();
console.log(data);
```

### 状态检查

```javascript
const status = await fetch('https://your-worker.your-subdomain.workers.dev/v1/status', {
  headers: {
    'Authorization': 'Bearer your-auth-token'
  }
});

const statusData = await status.json();
console.log(statusData);
// 输出示例:
// {
//   "status": "healthy",
//   "timestamp": "2025-01-21T10:30:00.000Z",
//   "keyPool": {
//     "totalKeys": 4,
//     "availableKeys": 2,
//     "failedKeys": 1,
//     "coolingKeys": 1,
//     "strategy": "round-robin",
//     "coolingDetails": [
//       {
//         "key": "AIzaSyABC...",
//         "remainingMinutes": 1440,
//         "remainingHours": 24,
//         "remainingDisplay": "24h0m"
//       }
//     ]
//   },
//   "auth": {
//     "validTokens": 3
//   },
//   "version": "2.1.0-intelligent-cooling",
//   "features": [
//     "Load Balancing",
//     "Intelligent Error Handling",
//     "24h Cooling for 429/503",
//     "5min Cooling for 502/504",
//     "Auto Recovery"
//   ]
// }
```

## ⚙️ 配置选项

### 负载均衡策略

在 `wrangler.toml` 中配置：

```toml
[vars]
LOAD_BALANCE_STRATEGY = "round-robin"  # 或 "random"
```

- `round-robin`: 轮询策略（默认）
- `random`: 随机选择策略


## 🧠 智能冷却机制

### 错误分类处理

| 错误码 | 错误类型 | 处理策略 | 冷却时间 |
|--------|----------|----------|----------|
| 401/403 | 永久失效 | 标记失效，不再使用 | 永久 |
| 429 | 频率限制 | 智能冷却，自动恢复 | 24小时 |
| 503 | 服务不可用 | 长期冷却 | 24小时 |
| 502/504 | 网关错误 | 短期冷却 | 5分钟 |
| 5xx | 其他服务器错误 | 中期冷却 | 10分钟 |

### 冷却恢复机制

- **自动清理**: 每分钟清理过期的冷却状态
- **智能恢复**: 冷却期满后自动恢复使用
- **紧急模式**: 所有 key 失效时重置状态
- **优先级选择**: 优先使用冷却时间最短的 key

## 🛡️ 安全特性

1. **API Key 隔离**: 真实的 Gemini API key 不暴露给前端
2. **Token 认证**: 前端使用独立的认证 token
3. **智能故障转移**: 区分永久和临时错误，智能切换
4. **请求验证**: 完整的请求参数验证
5. **冷却保护**: 防止频繁请求被限流的 key

## 🔍 监控和调试

### 日志查看

```bash
# 查看实时日志
wrangler tail --env production

# 查看特定时间段的日志
wrangler tail --env production --since 1h
```

### 常见错误处理

1. **Service configuration error**: 检查环境变量是否正确设置
2. **Invalid authorization token**: 检查前端使用的 token 是否在 `VALID_AUTH_TOKENS` 中
3. **All API keys failed or cooling**: 所有 key 都失效或冷却中
   - 检查 `/v1/status` 端点查看详细状态
   - 等待冷却期结束或添加更多有效 key
4. **API key temporarily unavailable**: key 正在冷却中
   - 429/503 错误会触发 24 小时冷却
   - 502/504 错误会触发 5 分钟冷却

## 📊 性能优化

- 使用对象池减少内存分配
- 流式响应支持
- 边缘计算加速
- 智能重试机制

## 🔄 版本更新

当前版本: `2.1.0-intelligent-cooling`

### 更新日志

**v2.1.0 - 智能冷却版本**
- ✅ 实现智能冷却机制（429/503→24h，502/504→5min）
- ✅ 区分永久失效和临时限流
- ✅ 自动冷却恢复和状态清理
- ✅ 增强状态监控，显示冷却详情
- ✅ 性能优化，开销 < 0.01%

**v2.0.0 - 负载均衡版本**
- ✅ 添加 API key 池负载均衡
- ✅ 实现认证层
- ✅ 添加健康检查端点
- ✅ 增强错误处理和重试机制
- ✅ 支持多种负载均衡策略

## 📞 技术支持

### 问题排查步骤

1. **检查服务状态**: 访问 `/v1/status` 端点查看详细状态
2. **验证配置**: 确认环境变量 `GEMINI_API_KEYS` 和 `VALID_AUTH_TOKENS` 正确设置
3. **检查 key 状态**: 查看是否有 key 处于冷却状态
4. **验证认证**: 确认前端使用的 token 在有效列表中
5. **网络检查**: 确认到 Gemini API 的网络连接正常

### 冷却状态说明

- **永久失效**: 401/403 错误，key 无效或权限不足
- **24小时冷却**: 429 频率限制或 503 服务不可用
- **5分钟冷却**: 502/504 网关错误
- **自动恢复**: 冷却期满后自动恢复使用

### 性能保证

- 内存开销: < 5KB
- CPU 开销: < 0.01%
- 延迟影响: < 0.1ms
- 支持规模: 100+ API keys

通过 `/v1/status` 端点可以实时查看服务状态、冷却详情和配置信息。