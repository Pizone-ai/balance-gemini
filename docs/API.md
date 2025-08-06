# API 文档

本文档详细描述了 Gemini API 智能冷却负载均衡代理服务的所有 API 端点。

## 基础信息

- **基础 URL**: `https://your-worker.your-subdomain.workers.dev`
- **认证方式**: Bearer Token
- **内容类型**: `application/json`
- **API 版本**: v1

## 认证

所有 API 请求都需要在请求头中包含有效的认证令牌：

```http
Authorization: Bearer your-auth-token
```

## 端点概览

| 端点 | 方法 | 描述 |
|------|------|------|
| `/v1/chat/completions` | POST | 聊天完成接口 |
| `/v1/models` | GET | 获取可用模型列表 |
| `/v1/embeddings` | POST | 生成文本嵌入向量 |
| `/v1/status` | GET | 获取服务状态 |

---

## 1. 聊天完成接口

### `POST /v1/chat/completions`

生成聊天完成响应，支持流式和非流式两种模式。

#### 请求参数

```json
{
  "model": "gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "max_tokens": 1000,
  "temperature": 0.7,
  "top_p": 1.0,
  "frequency_penalty": 0,
  "presence_penalty": 0,
  "stop": ["Human:", "AI:"],
  "stream": false,
  "response_format": {
    "type": "text"
  }
}
```

#### 参数说明

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `model` | string | 是 | - | 要使用的模型名称 |
| `messages` | array | 是 | - | 对话消息数组 |
| `max_tokens` | integer | 否 | 1000 | 生成的最大 token 数 |
| `temperature` | number | 否 | 0.7 | 控制随机性，0-2 之间 |
| `top_p` | number | 否 | 1.0 | 核采样参数，0-1 之间 |
| `frequency_penalty` | number | 否 | 0 | 频率惩罚，-2 到 2 之间 |
| `presence_penalty` | number | 否 | 0 | 存在惩罚，-2 到 2 之间 |
| `stop` | array | 否 | null | 停止序列 |
| `stream` | boolean | 否 | false | 是否启用流式响应 |
| `response_format` | object | 否 | - | 响应格式配置 |

#### Messages 格式

每个消息对象包含以下字段：

```json
{
  "role": "user|assistant|system",
  "content": "消息内容"
}
```

**支持的内容类型：**

1. **纯文本**：
```json
{
  "role": "user",
  "content": "Hello, world!"
}
```

2. **多模态内容**：
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "What's in this image?"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/image.jpg"
      }
    }
  ]
}
```

3. **音频内容**：
```json
{
  "role": "user",
  "content": [
    {
      "type": "input_audio",
      "input_audio": {
        "data": "base64_encoded_audio_data",
        "format": "wav"
      }
    }
  ]
}
```

#### 响应格式

**非流式响应：**

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gemini-2.5-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 12,
    "total_tokens": 22
  }
}
```

**流式响应：**

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gemini-2.5-flash","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gemini-2.5-flash","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gemini-2.5-flash","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gemini-2.5-flash","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

#### 示例请求

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer your-auth-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "max_tokens": 100
  }'
```

---

## 2. 模型列表接口

### `GET /v1/models`

获取所有可用的模型列表。

#### 请求参数

无需请求参数。

#### 响应格式

```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-2.5-flash",
      "object": "model",
      "created": 1677652288,
      "owned_by": "google"
    },
    {
      "id": "gemini-1.5-pro",
      "object": "model",
      "created": 1677652288,
      "owned_by": "google"
    }
  ]
}
```

#### 示例请求

```bash
curl -X GET https://your-worker.your-subdomain.workers.dev/v1/models \
  -H "Authorization: Bearer your-auth-token"
```

---

## 3. 嵌入向量接口

### `POST /v1/embeddings`

生成文本的嵌入向量表示。

#### 请求参数

```json
{
  "model": "embedding-001",
  "input": [
    "The quick brown fox jumps over the lazy dog",
    "Hello, world!"
  ]
}
```

#### 参数说明

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `model` | string | 否 | "embedding-001" | 嵌入模型名称 |
| `input` | string/array | 是 | - | 要生成嵌入的文本 |

#### 响应格式

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.1, 0.2, 0.3, ...],
      "index": 0
    },
    {
      "object": "embedding",
      "embedding": [0.4, 0.5, 0.6, ...],
      "index": 1
    }
  ],
  "model": "embedding-001",
  "usage": {
    "prompt_tokens": 20,
    "total_tokens": 20
  }
}
```

#### 示例请求

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/v1/embeddings \
  -H "Authorization: Bearer your-auth-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "embedding-001",
    "input": ["Hello, world!", "How are you?"]
  }'
```

---

## 4. 状态检查接口

### `GET /v1/status`

获取服务的详细状态信息，包括 API key 池状态、认证信息等。

#### 请求参数

无需请求参数。

#### 响应格式

```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "keyPool": {
    "totalKeys": 4,
    "availableKeys": 3,
    "failedKeys": 1,
    "coolingKeys": 0,
    "strategy": "round-robin",
    "coolingDetails": [
      {
        "key": "AIzaSyABC...",
        "remainingMinutes": 1440,
        "remainingHours": 24,
        "remainingDisplay": "24h0m"
      }
    ]
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

#### 状态说明

| 状态 | 描述 |
|------|------|
| `healthy` | 服务正常运行 |
| `degraded` | 服务部分功能受限 |
| `unhealthy` | 服务不可用 |

#### 示例请求

```bash
curl -X GET https://your-worker.your-subdomain.workers.dev/v1/status \
  -H "Authorization: Bearer your-auth-token"
```

---

## 错误处理

### 错误响应格式

所有错误响应都遵循统一的格式：

```json
{
  "error": {
    "message": "错误描述",
    "type": "错误类型",
    "code": 400
  }
}
```

### 常见错误码

| HTTP 状态码 | 错误类型 | 描述 |
|-------------|----------|------|
| 400 | `invalid_request_error` | 请求参数无效 |
| 401 | `invalid_request_error` | 缺少认证令牌 |
| 403 | `invalid_request_error` | 认证令牌无效 |
| 404 | `invalid_request_error` | 端点不存在 |
| 405 | `invalid_request_error` | 请求方法不允许 |
| 429 | `rate_limit_error` | 请求频率过高 |
| 500 | `server_error` | 服务器内部错误 |

### 错误示例

```json
{
  "error": {
    "message": "messages array is required",
    "type": "invalid_request_error",
    "code": 400
  }
}
```

---

## 速率限制

- 每个认证令牌的请求频率限制由后端 Gemini API 决定
- 服务会自动处理 429 错误并进行智能重试
- 建议在客户端实现适当的重试机制

---

## 最佳实践

### 1. 错误处理

```javascript
try {
  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${error.error.message}`);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('Request failed:', error);
  // 实现重试逻辑
}
```

### 2. 流式响应处理

```javascript
const response = await fetch('/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ...requestData,
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          console.log(content);
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }
}
```

### 3. 状态监控

```javascript
async function checkServiceHealth() {
  const response = await fetch('/v1/status', {
    headers: {
      'Authorization': 'Bearer your-token'
    }
  });

  const status = await response.json();
  
  if (status.keyPool.availableKeys === 0) {
    console.warn('No API keys available!');
  }
  
  if (status.status !== 'healthy') {
    console.warn(`Service status: ${status.status}`);
  }
  
  return status;
}
```

---

## 更新日志

### v2.1.0
- 添加智能冷却机制
- 改进错误处理
- 增强状态监控

### v2.0.0
- 添加负载均衡功能
- 实现认证层
- 支持多种响应格式

---

如有问题或建议，请查看 [故障排查指南](./TROUBLESHOOTING.md) 或提交 Issue。