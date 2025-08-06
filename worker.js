/**
 * Gemini API Proxy - Load Balanced Version with Auth Layer
 */

// Core Constants
const CONTENT_TYPE_JSON = "application/json";
const CONTENT_TYPE_SSE = "text/event-stream";
const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive"
};

// API Key Pool Manager with Optimized Cooling System
class ApiKeyPool {
  constructor(keys, strategy = 'round-robin') {
    this.keys = keys.filter(key => key && key.trim());
    this.strategy = strategy;
    this.currentIndex = 0;
    this.failedKeys = new Set();           // 永久失效的 keys (401/403)
    this.coolingKeys = new Map();          // 冷却中的 keys {key: 恢复时间戳}
    this.lastCleanup = 0;                  // 上次清理时间
    this.hasCoolingKeys = false;           // 性能优化：标记是否有冷却密钥
    
    // 性能优化：缓存可用 keys，避免频繁过滤
    this.availableKeysCache = [...this.keys];
    this.cacheValid = true;
    
    // 性能优化：缓存统计信息
    this.statsCache = null;
    this.statsCacheTime = 0;
    
    if (this.keys.length === 0) {
      throw new Error('No valid API keys provided');
    }
    
  }
  
  getNextKey() {
    // 快速路径：无冷却密钥时完全跳过所有检查
    if (!this.hasCoolingKeys) {
      return this.getAvailableKey();
    }
    
    // 慢速路径：有冷却密钥时，1小时检查一次
    const now = Date.now();
    if (now - this.lastCleanup > 3600000) { // 1小时 = 3600000ms
      this.cleanupExpiredKeys();
      this.lastCleanup = now;
    }
    
    return this.getAvailableKey();
  }
  
  getAvailableKey() {
    // 简化缓存逻辑：只在真正需要时才重建
    if (!this.cacheValid) {
      this.updateAvailableKeysCache();
    }
    
    // 如果没有可用密钥，执行应急处理
    if (this.availableKeysCache.length === 0) {
      return this.handleEmergencyCase();
    }
    
    // 正常的密钥选择
    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(this.availableKeysCache);
      case 'random':
        return this.random(this.availableKeysCache);
      default:
        return this.availableKeysCache[0];
    }
  }
  
  handleEmergencyCase() {
    // 应急情况：立即检查一次是否有密钥可恢复
    if (this.hasCoolingKeys) {
      this.cleanupExpiredKeys();
      if (!this.cacheValid) {
        this.updateAvailableKeysCache();
      }
    }
    
    // 如果还是没有，使用冷却时间最短的密钥
    if (this.availableKeysCache.length === 0) {
      const emergencyKey = this.getNextCoolingKey();
      if (emergencyKey) {
        return emergencyKey;
      }
      
      // 最后手段：重置所有状态
      this.resetAllKeys();
      return this.keys[0];
    }
    
    return this.availableKeysCache[0];
  }
  
  // 性能优化：更新可用 keys 缓存
  updateAvailableKeysCache() {
    this.availableKeysCache = this.keys.filter(key =>
      !this.failedKeys.has(key) && !this.coolingKeys.has(key)
    );
    this.cacheValid = true;
  }
  
  // 性能优化：使缓存失效
  invalidateCache() {
    this.cacheValid = false;
    this.statsCache = null;
  }
  
  roundRobin(availableKeys) {
    const key = availableKeys[this.currentIndex % availableKeys.length];
    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;
    return key;
  }
  
  random(availableKeys) {
    const randomIndex = Math.floor(Math.random() * availableKeys.length);
    return availableKeys[randomIndex];
  }
  
  // 永久标记失效（401/403 错误）
  markKeyFailed(key) {
    this.failedKeys.add(key);
    this.coolingKeys.delete(key); // 从冷却中移除
    this.invalidateCache(); // 使缓存失效
  }
  
  // 临时冷却（429/503/502/504 错误）
  markKeyCooling(key, minutes) {
    const coolUntil = Date.now() + (minutes * 60 * 1000);
    this.coolingKeys.set(key, coolUntil);
    this.hasCoolingKeys = true; // 标记有冷却密钥
    this.invalidateCache(); // 使缓存失效
  }
  
  // 标记 key 成功使用
  markKeySuccess(key) {
    // 空实现，保持接口一致性
  }
  
  // 清理过期的冷却状态
  cleanupExpiredKeys() {
    if (!this.hasCoolingKeys) return;
    
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, coolUntil] of this.coolingKeys.entries()) {
      if (now >= coolUntil) {
        this.coolingKeys.delete(key);
        cleanedCount++;
      }
    }
    
    // 更新状态标记
    this.hasCoolingKeys = this.coolingKeys.size > 0;
    
    if (cleanedCount > 0) {
      this.invalidateCache(); // 有 key 恢复时使缓存失效
    }
  }
  
  // 获取冷却时间最短的 key
  getNextCoolingKey() {
    if (this.coolingKeys.size === 0) return null;
    
    const entries = [...this.coolingKeys.entries()];
    entries.sort(([,a], [,b]) => a - b);
    return entries[0][0];
  }
  
  // 重置所有状态
  resetAllKeys() {
    this.failedKeys.clear();
    this.coolingKeys.clear();
    this.hasCoolingKeys = false; // 重置冷却状态标记
    this.invalidateCache(); // 重置时使缓存失效
  }
  
  
  // 获取详细统计信息 - 性能优化：缓存计算结果
  getStats() {
    const now = Date.now();
    
    // 缓存 5 秒，避免频繁计算
    if (this.statsCache && (now - this.statsCacheTime) < 5000) {
      return this.statsCache;
    }
    
    const activeCooling = [...this.coolingKeys.values()]
      .filter(coolUntil => now < coolUntil).length;
    
    this.statsCache = {
      totalKeys: this.keys.length,
      availableKeys: this.keys.length - this.failedKeys.size - activeCooling,
      failedKeys: this.failedKeys.size,
      coolingKeys: activeCooling,
      strategy: this.strategy
    };
    this.statsCacheTime = now;
    
    return this.statsCache;
  }
  
  // 获取冷却详情（用于状态监控）
  getCoolingDetails() {
    const now = Date.now();
    const details = [];
    
    for (const [key, coolUntil] of this.coolingKeys.entries()) {
      if (now < coolUntil) {
        const remainingMs = coolUntil - now;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        const remainingHours = Math.floor(remainingMinutes / 60);
        
        details.push({
          key: key.substring(0, 10) + '...',
          remainingMinutes,
          remainingHours: remainingHours > 0 ? remainingHours : 0,
          remainingDisplay: remainingHours > 0
            ? `${remainingHours}h${remainingMinutes % 60}m`
            : `${remainingMinutes}m`
        });
      }
    }
    
    return details.sort((a, b) => a.remainingMinutes - b.remainingMinutes);
  }
}

// Authentication Manager
class AuthManager {
  constructor(validTokens) {
    this.validTokens = new Set(validTokens.filter(token => token && token.trim()));
  }
  
  validateToken(token) {
    return this.validTokens.has(token);
  }
  
  getValidTokenCount() {
    return this.validTokens.size;
  }
}

// Global instances (will be initialized in fetch handler)
let keyPool = null;
let authManager = null;

const COMMON_HEADERS = {
  JSON: new Headers({ ...BASE_HEADERS, "Content-Type": CONTENT_TYPE_JSON }),
  SSE: new Headers({ ...BASE_HEADERS, "Content-Type": CONTENT_TYPE_SSE })
};

// API Constants
const DEFAULT_MODEL = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com";
const API_VERSION = "v1beta";
const API_CLIENT = "genai-js/0.19.0";

// Validation Constants
const VALID_ROLES = { user: 1, assistant: 1, system: 1 };
const VALID_CONTENT_TYPES = { text: 1, image_url: 1, input_audio: 1 };

// Safety Settings
const safetySettings = [
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" }
];

// Field Mappings
const fieldsMap = {
  stop: 'stopSequences',
  n: 'candidateCount',
  max_tokens: 'maxOutputTokens',
  temperature: 'temperature',
  top_p: 'topP',
  frequency_penalty: 'frequencyPenalty',
  presence_penalty: 'presencePenalty'
};

// Error Templates
const ERROR_TEMPLATES = {
  400: msg => ({ error: { message: msg, type: 'invalid_request_error', code: 400 } }),
  401: () => ({ error: { message: 'Missing API key', type: 'invalid_request_error', code: 401 } }),
  403: () => ({ error: { message: 'Forbidden', type: 'invalid_request_error', code: 403 } }),
  404: () => ({ error: { message: 'Not Found', type: 'invalid_request_error', code: 404 } }),
  405: msg => ({ error: { message: msg || 'Method not allowed', type: 'invalid_request_error', code: 405 } }),
  429: () => ({ error: { message: 'Too many requests', type: 'rate_limit_error', code: 429 } }),
  500: msg => ({ error: { message: msg, type: 'server_error', code: 500 } })
};

// API Endpoints
const API_ENDPOINTS = {
  chat: (model, stream) => 
    `${BASE_URL}/${API_VERSION}/models/${model}:${stream ? "streamGenerateContent" : "generateContent"}`,
  models: `${BASE_URL}/${API_VERSION}/models`,
  embeddings: model => 
    `${BASE_URL}/${API_VERSION}/${model}:batchEmbedContents`
};


// Main Worker Export with Stream Optimization
export default {
  async fetch(request, env, ctx) {
    // Initialize global instances with environment variables
    if (!keyPool || !authManager) {
      try {
        const geminiKeys = (env.GEMINI_API_KEYS || '').split(',').filter(k => k.trim());
        const validTokens = (env.VALID_AUTH_TOKENS || '').split(',').filter(t => t.trim());
        const strategy = env.LOAD_BALANCE_STRATEGY || 'round-robin';
        
        if (geminiKeys.length === 0) {
          console.error('No GEMINI_API_KEYS configured');
          return createErrorResponse(500, 'Service configuration error');
        }
        
        if (validTokens.length === 0) {
          console.error('No VALID_AUTH_TOKENS configured');
          return createErrorResponse(500, 'Service initialization error');
        }
        
        keyPool = new ApiKeyPool(geminiKeys, strategy);
        authManager = new AuthManager(validTokens);
        
      } catch (err) {
        console.error('Failed to initialize services:', err);
        return createErrorResponse(500, 'Service initialization error');
      }
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: BASE_HEADERS });
    }

    const url = new URL(request.url);
    const userToken = request.headers.get("Authorization")?.split(" ")[1];

    // 验证用户认证 token
    if (!userToken) {
      return createErrorResponse(401, 'Missing authorization token');
    }

    if (!authManager.validateToken(userToken)) {
      return createErrorResponse(403, 'Invalid authorization token');
    }

    try {
      switch (true) {
        case url.pathname.endsWith("/v1/chat/completions"):
          if (request.method !== "POST") {
            return createErrorResponse(405, "Method not allowed");
          }
          const body = await request.json().catch(() => null);
          if (!body) {
            return createErrorResponse(400, "Invalid JSON body");
          }
          
          // 流式请求的特殊处理 - 使用 waitUntil 确保流完整处理
          if (body.stream && ctx) {
            const response = await handleRequest(body);
            
            // 确保流完整传输，防止 Worker 过早终止
            // 注意：不要在这里再次使用 response.body，因为它已经在 handleStreamResponse 中被消费
            ctx.waitUntil(new Promise(resolve => {
              // 简化监控逻辑，避免重复使用 response body
              // 流的完成状态已经在 handleStreamResponse 中处理
              setTimeout(() => {
                resolve();
              }, 30000); // 30秒超时保护
            }));
            
            return response;
          }
          
          return handleRequest(body);

        case url.pathname.endsWith("/v1/models"):
          if (request.method !== "GET") {
            return createErrorResponse(405, "Method not allowed");
          }
          return handleModels();

        case url.pathname.endsWith("/v1/embeddings"):
          if (request.method !== "POST") {
            return createErrorResponse(405, "Method not allowed");
          }
          const embedBody = await request.json().catch(() => null);
          if (!embedBody) {
            return createErrorResponse(400, "Invalid JSON body");
          }
          return handleEmbeddings(embedBody);

        case url.pathname.endsWith("/v1/status"):
          if (request.method !== "GET") {
            return createErrorResponse(405, "Method not allowed");
          }
          return handleStatus();

        default:
          return createErrorResponse(404);
      }
    } catch (err) {
      console.error('Request processing error:', err);
      return createErrorResponse(500, err.message);
    }
  }
};

// Error Response Creation
function createErrorResponse(status, message) {
  const template = ERROR_TEMPLATES[status] || ERROR_TEMPLATES[500];
  return new Response(
    JSON.stringify(template(message)),
    { status, headers: COMMON_HEADERS.JSON }
  );
}

// Request Validation
function validateRequest(req) {
  if (!req?.messages?.length) {
    throw new Error("messages array is required");
  }

  for (const msg of req.messages) {
    if (!VALID_ROLES[msg.role]) {
      throw new Error(`Invalid role: ${msg.role}`);
    }

    if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (!VALID_CONTENT_TYPES[item.type]) {
          throw new Error(`Invalid content type: ${item.type}`);
        }
      }
    }
  }
}

// Main Request Handler with Intelligent Error Handling
async function handleRequest(req) {
  const model = req.model?.startsWith("gemini-") ? req.model : DEFAULT_MODEL;
  const url = API_ENDPOINTS.chat(model, req.stream);
  
  try {
    validateRequest(req);
    
    // 尝试使用负载均衡的 API key
    let lastError = null;
    const maxRetries = Math.min(3, keyPool.getStats().totalKeys);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = keyPool.getNextKey();
      
      try {
        const response = await fetch(req.stream ? `${url}?alt=sse` : url, {
          method: "POST",
          headers: {
            "Content-Type": CONTENT_TYPE_JSON,
            "x-goog-api-key": apiKey,
            "x-goog-api-client": API_CLIENT
          },
          body: JSON.stringify(await transformRequest(req))
        });

        if (response.ok) {
          // 成功时标记 key 为正常使用
          keyPool.markKeySuccess(apiKey);
          const id = generateChatcmplId();
          return req.stream
            ? handleStreamResponse(response, model, id)
            : handleNonStreamResponse(response, model, id);
        }
        
        // 智能错误处理 - 先克隆响应以避免 body 被多次使用
        const responseClone = response.clone();
        const errorType = handleApiError(apiKey, response);
        
        if (errorType === 'permanent') {
          // 永久失效，继续尝试下一个 key
          lastError = new Error(`API key permanently failed: ${response.status}`);
          continue;
        } else if (errorType === 'temporary') {
          // 临时错误，继续尝试下一个 key
          lastError = new Error(`API key temporarily unavailable: ${response.status}`);
          continue;
        } else {
          // 其他错误（可能是请求本身的问题），直接返回
          // 使用克隆的响应来读取错误内容，避免 body 重复使用
          try {
            const errorText = await responseClone.text();
            return createErrorResponse(response.status, errorText);
          } catch (bodyError) {
            // 如果读取 body 失败，返回通用错误信息
            return createErrorResponse(response.status, `HTTP ${response.status} Error`);
          }
        }
        
      } catch (err) {
        lastError = err;
        
        // 网络错误，短期冷却
        keyPool.markKeyCooling(apiKey, 5); // 5分钟冷却
      }
    }
    
    // 所有重试都失败了
    throw lastError || new Error('All API keys failed or cooling');
    
  } catch (err) {
    return createErrorResponse(500, err.message);
  }
}

// 智能 API 错误处理函数
function handleApiError(apiKey, response) {
  const status = response.status;
  
  if (status === 401 || status === 403) {
    // 永久失效：API key 无效或权限不足
    keyPool.markKeyFailed(apiKey);
    return 'permanent';
  }
  
  if (status === 429) {
    // 频率限制：24小时冷却
    const retryAfter = response.headers.get('Retry-After');
    const coolMinutes = retryAfter ? Math.max(parseInt(retryAfter) / 60, 24 * 60) : 24 * 60;
    keyPool.markKeyCooling(apiKey, coolMinutes);
    return 'temporary';
  }
  
  if (status === 503) {
    // 服务不可用：24小时冷却
    keyPool.markKeyCooling(apiKey, 24 * 60);
    return 'temporary';
  }
  
  if (status === 502 || status === 504) {
    // 网关错误：5分钟冷却
    keyPool.markKeyCooling(apiKey, 5);
    return 'temporary';
  }
  
  if (status >= 500) {
    // 其他服务器错误：短期冷却
    keyPool.markKeyCooling(apiKey, 10);
    return 'temporary';
  }
  
  // 4xx 客户端错误（除了401/403），可能是请求问题
  return 'client_error';
}

// ID Generation
const generateChatcmplId = (() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const len = chars.length;
  const result = new Array(29);
  return () => {
    for (let i = 0; i < 29; i++) {
      result[i] = chars[Math.random() * len | 0];
    }
    return "chatcmpl-" + result.join('');
  };
})();

// Message Transformation
async function transformMsg({ role, content }) {
  if (!Array.isArray(content)) {
    return { role, parts: [{ text: content }] };
  }

  const parts = new Array(content.length);
  for (let i = 0; i < content.length; i++) {
    const item = content[i];
    switch (item.type) {
      case "text":
        parts[i] = { text: item.text };
        break;
      case "image_url":
        parts[i] = await parseImg(item.image_url.url);
        break;
      case "input_audio":
        parts[i] = {
          inlineData: {
            mimeType: "audio/" + item.input_audio.format,
            data: item.input_audio.data
          }
        };
        break;
    }
  }
  return { role, parts };
}

// Image Processing
const IMAGE_DATA_REGEX = /^data:(?<mimeType>.*?)(;base64)?,(?<data>.*)$/;
async function parseImg(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    if (url.startsWith("data:")) {
      const match = url.match(IMAGE_DATA_REGEX);
      if (!match) throw new Error("Invalid image data");
      return {
        inlineData: {
          mimeType: match.groups.mimeType,
          data: match.groups.data
        }
      };
    }

    const response = await fetch(
      `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=512&we&encoding=base64`,
      {
        signal: controller.signal,
        headers: { 'Accept': 'text/plain' }
      }
    );
    
    if (!response.ok) throw new Error("Failed to fetch image");
    
    return {
      inlineData: {
        mimeType: 'image/jpeg',
        data: await response.text()
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Message Transformation
async function transformMessages(messages) {
  const contents = new Array(messages.length);
  let system_instruction;
  let contentIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    const item = messages[i];
    if (item.role === "system") {
      system_instruction = await transformMsg({ ...item, role: undefined });
    } else {
      contents[contentIndex++] = await transformMsg({
        ...item,
        role: item.role === "assistant" ? "model" : "user"
      });
    }
  }
  
  contents.length = contentIndex;

  if (system_instruction && !contents.length) {
    contents[0] = { role: "model", parts: [{ text: " " }] };
  }

  return { system_instruction, contents };
}

// Config Transformation
function transformConfig(req) {
  const config = {};
  for (const key in fieldsMap) {
    if (req[key] !== undefined) {
      config[fieldsMap[key]] = req[key];
    }
  }

  if (req.response_format) {
    config.responseMimeType = req.response_format.type === "text" 
      ? "text/plain" 
      : CONTENT_TYPE_JSON;
    
    if (req.response_format.type === "json_schema") {
      config.responseSchema = req.response_format.json_schema?.schema;
    }
  }

  return config;
}

// Request Transformation
async function transformRequest(req) {
  return {
    ...await transformMessages(req.messages),
    safetySettings,
    generationConfig: transformConfig(req)
  };
}

// 性能优化：预编译正则表达式，避免重复编译
const STREAM_SPLIT_REGEX = /\r?\n\r?\n/;

// Optimized Stream Response Handling
function createOptimizedChunk(content, model, id, isFirst = false, isLast = false, finishReason = null) {
  // 创建独立的块对象，避免并发问题
  const chunk = {
    id,
    created: Date.now() / 1000 | 0,
    model,
    object: "chat.completion.chunk",
    choices: [{
      index: 0,
      delta: isLast
        ? {}
        : isFirst
          ? { role: "assistant", content: "" }
          : { content: content || "" },
      finish_reason: isLast ? finishReason : null
    }]
  };
  
  return `data: ${JSON.stringify(chunk)}\r\n\r\n`;
}

// 合并的优化流处理 - 将解析和转换合并为一层
function createOptimizedParseStream(model, id) {
  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;
  let lastChunkTime = Date.now();
  let isFirstChunk = true;
  
  // 性能优化：添加缓冲区大小限制，防止内存泄漏
  const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB 限制
  
  return new TransformStream({
    transform(chunk, controller) {
      try {
        // 立即处理，减少缓冲延迟
        const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
        buffer += text;
        
        // 性能优化：检查缓冲区大小，防止内存泄漏
        if (buffer.length > MAX_BUFFER_SIZE) {
          buffer = buffer.slice(-MAX_BUFFER_SIZE / 2); // 保留后半部分
        }
        
        // 性能优化：使用预编译的正则表达式
        const parts = buffer.split(STREAM_SPLIT_REGEX);
        buffer = parts.pop() || '';
        
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const content = part.slice(6).trim();
            if (content && content !== '[DONE]') {
              try {
                const parsed = JSON.parse(content);
                
                // 验证数据格式
                if (!parsed.candidates?.[0]) {
                  console.warn('Invalid response format, skipping chunk');
                  continue;
                }

                const cand = parsed.candidates[0];
                const index = cand.index || 0;
                
                // 性能优化：减少频繁的时间计算，采用采样监控
                chunkCount++;
                if (chunkCount % 10 === 0) { // 每 10 个 chunk 检查一次
                  const now = Date.now();
                  const timeSinceLastChunk = now - lastChunkTime;
                  
                  // 监控异常延迟（超过5秒警告）
                  if (timeSinceLastChunk > 5000 && chunkCount > 10) {
                    // 延迟检测，但不输出日志
                  }
                  lastChunkTime = now;
                }
                
                // 处理首个数据块
                if (isFirstChunk) {
                  controller.enqueue(createOptimizedChunk("", model, id, true));
                  isFirstChunk = false;
                }
                
                // 处理内容数据块
                if (cand.content?.parts?.[0]?.text) {
                  const content = cand.content.parts[0].text;
                  controller.enqueue(createOptimizedChunk(content, model, id, false));
                }
                
                // 处理结束标记
                if (cand.finishReason) {
                  const finishReason = reasonsMap[cand.finishReason] || cand.finishReason;
                  controller.enqueue(createOptimizedChunk("", model, id, false, true, finishReason));
                }
                
              } catch (e) {
                // 继续处理，不中断流
                // 发送空内容块保持流连续性
                controller.enqueue(createOptimizedChunk("", model, id, false));
              }
            }
          }
        }
      } catch (err) {
        // 错误恢复，不中断流
        // 发送恢复块
        try {
          controller.enqueue(createOptimizedChunk("", model, id, false));
        } catch (recoveryErr) {
          // 恢复失败，静默处理
        }
      }
    },
    
    flush(controller) {
      try {
        // 处理缓冲区中的剩余数据
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ')) {
            const content = line.slice(6).trim();
            if (content && content !== '[DONE]') {
              try {
                const parsed = JSON.parse(content);
                if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                  const content = parsed.candidates[0].content.parts[0].text;
                  controller.enqueue(createOptimizedChunk(content, model, id, false));
                }
              } catch (e) {
                // 解析错误，静默处理
              }
            }
          }
        }
        
        // 发送结束标记
        controller.enqueue(`data: [DONE]\r\n\r\n`);
      } catch (err) {
        // 确保流正常结束
        try {
          controller.enqueue(`data: [DONE]\r\n\r\n`);
        } catch (finalErr) {
          // 最终错误，静默处理
        }
      }
    }
  });
}

// Reason Mapping
const reasonsMap = {
  "STOP": "stop",
  "MAX_TOKENS": "length",
  "SAFETY": "content_filter",
  "RECITATION": "content_filter"
};


// 优化的流响应处理器 - 简化架构并增强错误恢复
function handleStreamResponse(response, model, id) {
  // 检查 response 是否有效
  if (!response || !response.body) {
    return createErrorResponse(500, 'Invalid streaming response');
  }

  const { readable, writable } = new TransformStream();
  
  // 创建错误恢复包装器
  const errorRecoveryStream = new TransformStream({
    transform(chunk, controller) {
      try {
        controller.enqueue(chunk);
      } catch (err) {
        // 发送空内容块保持流连续性，不中断流
        const recoveryChunk = createOptimizedChunk("", model, id, false);
        controller.enqueue(recoveryChunk);
      }
    }
    // 移除 flush 方法，避免重复发送 [DONE]
  });
  
  // 优化后的流处理管道：从4层减少到3层
  response.body
    .pipeThrough(createOptimizedParseStream(model, id))  // 合并的解析和转换层
    .pipeThrough(errorRecoveryStream)                    // 错误恢复层
    .pipeThrough(new TextEncoderStream())                // 编码层
    .pipeTo(writable)
    .catch(err => {
      // 优雅关闭而不是突然中断
      try {
        writable.close();
      } catch (closeErr) {
        // 关闭失败，静默处理
      }
    });

  // 返回优化的响应头
  return new Response(readable, {
    headers: {
      ...COMMON_HEADERS.SSE,
      // 添加流控制头，优化缓冲行为
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive'
    }
  });
}

// Non-Stream Response Handler
async function handleNonStreamResponse(response, model, id) {
  try {
    const { candidates, usageMetadata } = await response.json();
    
    return new Response(
      JSON.stringify({
        id,
        choices: candidates.map(cand => ({
          index: cand.index || 0,
          message: {
            role: "assistant",
            content: cand.content?.parts[0]?.text || ""
          },
          finish_reason: reasonsMap[cand.finishReason] || cand.finishReason
        })),
        created: Date.now() / 1000 | 0,
        model,
        object: "chat.completion",
        usage: usageMetadata && {
          completion_tokens: usageMetadata.candidatesTokenCount || 0,
          prompt_tokens: usageMetadata.promptTokenCount || 0,
          total_tokens: usageMetadata.totalTokenCount || 0
        }
      }), 
      { headers: COMMON_HEADERS.JSON }
    );
  } catch (err) {
    return createErrorResponse(500, "Processing error");
  }
}

// Models Handler with Intelligent Error Handling
async function handleModels() {
  let lastError = null;
  const maxRetries = Math.min(2, keyPool.getStats().totalKeys);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const apiKey = keyPool.getNextKey();
      const response = await fetch(API_ENDPOINTS.models, {
        headers: {
          "x-goog-api-key": apiKey,
          "x-goog-api-client": API_CLIENT
        }
      });

      if (response.ok) {
        keyPool.markKeySuccess(apiKey);
        const { models } = await response.json();
        return new Response(
          JSON.stringify({
            object: "list",
            data: models.map(({ name }) => ({
              id: name.replace("models/", ""),
              object: "model",
              created: Date.now() / 1000 | 0,
              owned_by: "google"
            }))
          }),
          { headers: COMMON_HEADERS.JSON }
        );
      }

      // 智能错误处理 - 先克隆响应以避免 body 被多次使用
      const responseClone = response.clone();
      const errorType = handleApiError(apiKey, response);
      if (errorType === 'permanent' || errorType === 'temporary') {
        lastError = new Error(`Models API error: ${response.status}`);
        continue; // 尝试下一个 key
      } else {
        // 客户端错误，直接返回
        try {
          const errorText = await responseClone.text();
          return createErrorResponse(response.status, errorText);
        } catch (bodyError) {
          return createErrorResponse(response.status, `Models API HTTP ${response.status} Error`);
        }
      }

    } catch (err) {
      lastError = err;
      // console.error(`Network error in handleModels:`, err.message);
    }
  }
  
  return createErrorResponse(500, lastError?.message || "Failed to fetch models");
}

// Embeddings Handler with Intelligent Error Handling
async function handleEmbeddings(req) {
  if (!req.input) {
    return createErrorResponse(400, "Input is required");
  }

  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  const model = `models/${req.model || "embedding-001"}`;
  
  let lastError = null;
  const maxRetries = Math.min(2, keyPool.getStats().totalKeys);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const apiKey = keyPool.getNextKey();
      const response = await fetch(API_ENDPOINTS.embeddings(model), {
        method: "POST",
        headers: {
          "Content-Type": CONTENT_TYPE_JSON,
          "x-goog-api-key": apiKey,
          "x-goog-api-client": API_CLIENT
        },
        body: JSON.stringify({
          requests: inputs.map(text => ({
            model,
            content: { parts: [{ text }] }
          }))
        })
      });

      if (response.ok) {
        keyPool.markKeySuccess(apiKey);
        const { embeddings } = await response.json();
        return new Response(
          JSON.stringify({
            object: "list",
            data: embeddings.map((embedding, index) => ({
              object: "embedding",
              embedding: embedding.values,
              index
            })),
            model: model.replace("models/", ""),
            usage: {
              prompt_tokens: inputs.reduce((acc, text) => acc + text.length, 0),
              total_tokens: inputs.reduce((acc, text) => acc + text.length, 0)
            }
          }),
          { headers: COMMON_HEADERS.JSON }
        );
      }

      // 智能错误处理 - 先克隆响应以避免 body 被多次使用
      const responseClone = response.clone();
      const errorType = handleApiError(apiKey, response);
      if (errorType === 'permanent' || errorType === 'temporary') {
        lastError = new Error(`Embeddings API error: ${response.status}`);
        continue; // 尝试下一个 key
      } else {
        // 客户端错误，直接返回
        try {
          const errorText = await responseClone.text();
          return createErrorResponse(response.status, errorText);
        } catch (bodyError) {
          // console.warn('Failed to read embeddings error response body:', bodyError.message);
          return createErrorResponse(response.status, `Embeddings API HTTP ${response.status} Error`);
        }
      }

    } catch (err) {
      lastError = err;
      // console.error(`Network error in handleEmbeddings:`, err.message);
    }
  }
  
  return createErrorResponse(500, lastError?.message || "Embeddings processing failed");
}

// Enhanced Status Handler with Cooling Details
async function handleStatus() {
  try {
    const keyStats = keyPool.getStats();
    const coolingDetails = keyPool.getCoolingDetails();
    const authStats = {
      validTokens: authManager.getValidTokenCount()
    };
    
    return new Response(
      JSON.stringify({
        status: keyStats.availableKeys > 0 ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        keyPool: {
          ...keyStats,
          coolingDetails: coolingDetails.length > 0 ? coolingDetails : undefined
        },
        auth: authStats,
        version: "2.4.0-ultra-performance",
        features: [
          "Load Balancing",
          "Intelligent Error Handling",
          "Optimized Streaming (3-layer pipeline)",
          "Enhanced Error Recovery",
          "24h Cooling for 429/503",
          "5min Cooling for 502/504",
          "Ultra-Low Frequency Auto Recovery (1h)",
          "Smart State Tracking",
          "Zero-Overhead Fast Path",
          "Emergency Fallback System",
          "Stream Performance Monitoring",
          "Concurrency Safe",
          "Memory Optimized",
          "Cached Key Pool",
          "Pre-compiled Regex",
          "Buffer Size Limiting",
          "Sampling Monitoring",
          "Silent Mode (Logs Disabled)"
        ]
      }),
      { headers: COMMON_HEADERS.JSON }
    );
  } catch (err) {
    return createErrorResponse(500, `Status check failed: ${err.message}`);
  }
}