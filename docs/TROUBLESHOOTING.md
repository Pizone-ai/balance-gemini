# 故障排查指南

本指南帮助您诊断和解决 Gemini API 智能冷却负载均衡代理服务的常见问题。

## 🔍 快速诊断

### 1. 检查服务状态

首先访问状态端点获取服务详细信息：

```bash
curl -H "Authorization: Bearer your-auth-token" \
     https://your-worker-url.workers.dev/v1/status
```

根据响应结果进行初步判断：

- **status: "healthy"** - 服务正常
- **status: "degraded"** - 服务部分功能受限
- **status: "unhealthy"** - 服务不可用

### 2. 检查关键指标

关注以下关键指标：

```json
{
  "keyPool": {
    "totalKeys": 4,        // 配置的总 key 数量
    "availableKeys": 2,    // 当前可用的 key 数量
    "failedKeys": 1,       // 永久失效的 key 数量
    "coolingKeys": 1       // 正在冷却的 key 数量
  }
}
```

**健康标准：**
- `availableKeys > 0` - 至少有一个可用 key
- `availableKeys / totalKeys >= 0.5` - 可用率 >= 50%
- `failedKeys / totalKeys < 0.3` - 失效率 < 30%

---

## ❌ 常见错误及解决方案

### 1. Service configuration error

**错误信息：**
```json
{
  "error": {
    "message": "Service configuration error",
    "type": "server_error",
    "code": 500
  }
}
```

**可能原因：**
- 环境变量 `GEMINI_API_KEYS` 未设置或为空
- 环境变量 `VALID_AUTH_TOKENS` 未设置或为空

**解决方案：**

1. **检查环境变量配置：**
   ```bash
   # 在 Cloudflare Dashboard 中检查 Environment Variables
   # 或使用 wrangler 命令检查
   wrangler secret list --env production
   ```

2. **重新设置环境变量：**
   ```bash
   # 设置 API keys
   wrangler secret put GEMINI_API_KEYS --env production
   # 输入: key1,key2,key3,key4
   
   # 设置认证 tokens
   wrangler secret put VALID_AUTH_TOKENS --env production
   # 输入: token1,token2,token3
   ```

3. **验证配置：**
   ```bash
   # 重新部署后检查状态
   curl -H "Authorization: Bearer your-token" \
        https://your-worker-url.workers.dev/v1/status
   ```

### 2. Invalid authorization token

**错误信息：**
```json
{
  "error": {
    "message": "Invalid authorization token",
    "type": "invalid_request_error",
    "code": 403
  }
}
```

**可能原因：**
- 使用的 token 不在 `VALID_AUTH_TOKENS` 列表中
- token 格式错误（缺少 "Bearer " 前缀）
- token 包含特殊字符或空格

**解决方案：**

1. **检查 token 格式：**
   ```bash
   # 正确格式
   Authorization: Bearer your-actual-token
   
   # 错误格式
   Authorization: your-actual-token
   Authorization: Bearer your-actual-token 
   ```

2. **验证 token 是否在有效列表中：**
   ```bash
   # 检查当前有效 token 数量
   curl -H "Authorization: Bearer valid-token" \
        https://your-worker-url.workers.dev/v1/status
   # 查看 auth.validTokens 字段
   ```

3. **更新 token 列表：**
   ```bash
   wrangler secret put VALID_AUTH_TOKENS --env production
   # 输入新的 token 列表，逗号分隔
   ```

### 3. All API keys failed or cooling

**错误信息：**
```json
{
  "error": {
    "message": "All API keys failed or cooling",
    "type": "server_error",
    "code": 500
  }
}
```

**可能原因：**
- 所有 API keys 都处于冷却状态
- 所有 API keys 都已永久失效
- API keys 配额已用完

**解决方案：**

1. **检查 key 状态：**
   ```bash
   curl -H "Authorization: Bearer your-token" \
        https://your-worker-url.workers.dev/v1/status
   ```
   
   查看 `coolingDetails` 了解冷却情况：
   ```json
   {
     "coolingDetails": [
       {
         "key": "AIzaSyABC...",
         "remainingMinutes": 1440,
         "remainingDisplay": "24h0m"
       }
     ]
   }
   ```

2. **等待冷却期结束：**
   - 429/503 错误：24小时冷却
   - 502/504 错误：5分钟冷却
   - 其他 5xx 错误：10分钟冷却

3. **添加更多 API keys：**
   ```bash
   # 获取新的 Gemini API keys
   # 访问 https://makersuite.google.com/app/apikey
   
   # 更新 key 列表
   wrangler secret put GEMINI_API_KEYS --env production
   # 输入: old-key1,old-key2,new-key3,new-key4
   ```

4. **重置失效状态（紧急情况）：**
   ```bash
   # 重新部署 worker 会重置所有状态
   wrangler deploy --env production
   ```

### 4. messages array is required

**错误信息：**
```json
{
  "error": {
    "message": "messages array is required",
    "type": "invalid_request_error",
    "code": 400
  }
}
```

**可能原因：**
- 请求体中缺少 `messages` 字段
- `messages` 字段为空数组
- `messages` 字段不是数组类型

**解决方案：**

1. **检查请求格式：**
   ```javascript
   // 正确格式
   {
     "model": "gemini-2.5-flash",
     "messages": [
       {"role": "user", "content": "Hello"}
     ]
   }
   
   // 错误格式
   {
     "model": "gemini-2.5-flash",
     "messages": []  // 空数组
   }
   ```

2. **验证消息格式：**
   ```javascript
   // 每个消息必须包含 role 和 content
   {
     "role": "user|assistant|system",
     "content": "消息内容"
   }
   ```

### 5. Request timeout

**错误信息：**
- 请求超时，没有响应
- 连接被重置

**可能原因：**
- 网络连接问题
- Gemini API 响应缓慢
- Worker 执行时间超限

**解决方案：**

1. **检查网络连接：**
   ```bash
   # 测试基本连通性
   curl -I https://your-worker-url.workers.dev/v1/status
   ```

2. **增加客户端超时时间：**
   ```javascript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒
   
   fetch(url, {
     signal: controller.signal,
     // ... 其他选项
   });
   ```

3. **使用流式响应：**
   ```javascript
   // 流式响应可以更快获得首个响应
   {
     "stream": true,
     // ... 其他参数
   }
   ```

---

## 🔧 性能问题排查

### 1. 响应时间过长

**诊断步骤：**

1. **检查 API key 状态：**
   ```bash
   # 查看是否有 key 处于冷却状态
   curl -H "Authorization: Bearer your-token" \
        https://your-worker-url.workers.dev/v1/status
   ```

2. **测试不同模型：**
   ```bash
   # 测试 gemini-2.5-flash（更快）
   curl -X POST https://your-worker-url.workers.dev/v1/chat/completions \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 50}'
   ```

3. **减少请求复杂度：**
   ```javascript
   {
     "max_tokens": 100,      // 减少生成长度
     "temperature": 0.1,     // 降低随机性
     "messages": [
       // 简化对话历史
       {"role": "user", "content": "简短问题"}
     ]
   }
   ```

### 2. 频繁出现 429 错误

**解决方案：**

1. **增加 API keys：**
   ```bash
   # 添加更多 keys 分散负载
   wrangler secret put GEMINI_API_KEYS --env production
   ```

2. **实现客户端限流：**
   ```javascript
   // 简单的限流实现
   class RateLimiter {
     constructor(maxRequests, timeWindow) {
       this.maxRequests = maxRequests;
       this.timeWindow = timeWindow;
       this.requests = [];
     }
     
     async waitForSlot() {
       const now = Date.now();
       this.requests = this.requests.filter(time => now - time < this.timeWindow);
       
       if (this.requests.length >= this.maxRequests) {
         const waitTime = this.timeWindow - (now - this.requests[0]);
         await new Promise(resolve => setTimeout(resolve, waitTime));
         return this.waitForSlot();
       }
       
       this.requests.push(now);
     }
   }
   ```

3. **使用指数退避重试：**
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.status === 429 && i < maxRetries - 1) {
           const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
           await new Promise(resolve => setTimeout(resolve, delay));
           continue;
         }
         throw error;
       }
     }
   }
   ```

---

## 🛠️ 调试工具

### 1. 日志查看

```bash
# 查看实时日志
wrangler tail --env production

# 查看特定时间段的日志
wrangler tail --env production --since 1h

# 过滤错误日志
wrangler tail --env production | grep -i error
```

### 2. 本地测试

```bash
# 启动本地开发服务器
wrangler dev

# 测试本地服务
curl -H "Authorization: Bearer test-token" \
     http://localhost:8787/v1/status
```

### 3. 健康检查脚本

创建 `health-check.sh`：

```bash
#!/bin/bash

WORKER_URL="https://your-worker-url.workers.dev"
AUTH_TOKEN="your-auth-token"

echo "🏥 健康检查开始..."

# 检查状态端点
echo "📊 检查服务状态..."
STATUS=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$WORKER_URL/v1/status")
echo "$STATUS" | jq '.'

# 检查可用 keys
AVAILABLE_KEYS=$(echo "$STATUS" | jq '.keyPool.availableKeys')
TOTAL_KEYS=$(echo "$STATUS" | jq '.keyPool.totalKeys')

if [ "$AVAILABLE_KEYS" -eq 0 ]; then
    echo "❌ 警告：没有可用的 API keys"
    exit 1
elif [ "$AVAILABLE_KEYS" -lt $((TOTAL_KEYS / 2)) ]; then
    echo "⚠️  警告：可用 keys 不足 50%"
fi

# 测试聊天接口
echo "💬 测试聊天接口..."
CHAT_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 10}')

if echo "$CHAT_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null; then
    echo "✅ 聊天接口正常"
else
    echo "❌ 聊天接口异常"
    echo "$CHAT_RESPONSE" | jq '.'
    exit 1
fi

echo "🎉 健康检查完成"
```

---

## 📞 获取帮助

### 1. 自助排查清单

在寻求帮助前，请完成以下检查：

- [ ] 检查服务状态端点
- [ ] 验证环境变量配置
- [ ] 确认认证 token 有效
- [ ] 查看 Worker 日志
- [ ] 测试简单请求
- [ ] 检查网络连接

### 2. 收集诊断信息

提交问题时，请包含以下信息：

```bash
# 1. 服务状态
curl -H "Authorization: Bearer your-token" \
     https://your-worker-url.workers.dev/v1/status

# 2. 错误请求示例
curl -v -X POST https://your-worker-url.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "test"}]}'

# 3. Worker 日志
wrangler tail --env production --since 10m
```

### 3. 联系支持

- **GitHub Issues**: [项目 Issues 页面](https://github.com/Pizone-ai/balance-gemini/issues)
- **讨论区**: [GitHub Discussions](https://github.com/Pizone-ai/balance-gemini/discussions)
- **文档**: [README.md](../README.md) 和 [API 文档](./API.md)

---

## 🔄 预防措施

### 1. 监控设置

```javascript
// 定期健康检查
setInterval(async () => {
  try {
    const status = await fetch('/v1/status', {
      headers: { 'Authorization': 'Bearer your-token' }
    }).then(r => r.json());
    
    if (status.keyPool.availableKeys === 0) {
      console.error('No available API keys!');
      // 发送告警
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
}, 60000); // 每分钟检查一次
```

### 2. 配置备份

定期备份重要配置：

```bash
# 导出环境变量（注意安全）
wrangler secret list --env production > secrets-backup.txt

# 备份 wrangler.toml
cp wrangler.toml wrangler.toml.backup
```

### 3. 容量规划

- **API Keys**: 建议配置 3-5 个 keys
- **认证 Tokens**: 根据应用数量配置
- **监控频率**: 建议每分钟检查一次状态
- **日志保留**: 建议保留至少 7 天的日志

---

通过遵循本指南，您应该能够快速诊断和解决大部分常见问题。如果问题仍然存在，请参考 [API 文档](./API.md) 或提交 Issue 获取帮助。