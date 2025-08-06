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

// API Key Pool Manager with Intelligent Cooling System
class ApiKeyPool {
  constructor(keys, strategy = 'round-robin') {
    this.keys = keys.filter(key => key && key.trim());
    this.strategy = strategy;
    this.currentIndex = 0;
    this.failedKeys = new Set();           // 永久失效的 keys (401/403)
    this.coolingKeys = new Map();          // 冷却中的 keys {key: 恢复时间戳}
    this.keyFailCount = new Map();         // 每个 key 的失败次数
    this.lastCleanup = 0;                  // 上次清理时间
    this.lastUsed = new Map();
    
    if (this.keys.length === 0) {
      throw new Error('No valid API keys provided');
    }
    
    console.log(`ApiKeyPool initialized with ${this.keys.length} keys, strategy: ${this.strategy}`);
  }
  
  getNextKey() {
    // 定期清理过期的冷却状态（每分钟一次）
    const now = Date.now();
    if (now - this.lastCleanup > 60000) {
      this.cleanupExpiredKeys();
      this.lastCleanup = now;
    }
    
    // 获取当前可用的 keys（排除永久失效和冷却中的）
    const availableKeys = this.keys.filter(key =>
      !this.failedKeys.has(key) && !this.coolingKeys.has(key)
    );
    
    if (availableKeys.length === 0) {
      // 如果没有可用的 key，检查是否有即将恢复的冷却 key
      if (this.coolingKeys.size > 0) {
        const nextAvailableKey = this.getNextCoolingKey();
        if (nextAvailableKey) {
          console.warn(`No available keys, using cooling key: ${nextAvailableKey.substring(0, 10)}...`);
          return nextAvailableKey;
        }
      }
      
      // 最后手段：重置所有状态
      console.error('All keys failed, resetting all states');
      this.resetAllKeys();
      return this.keys[0];
    }
    
    // 从可用 keys 中选择
    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(availableKeys);
      case 'random':
        return this.random(availableKeys);
      default:
        return availableKeys[0];
    }
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
    this.keyFailCount.delete(key); // 清除失败计数
    console.warn(`API Key permanently failed: ${key.substring(0, 10)}...`);
  }
  
  // 临时冷却（429/503/502/504 错误）
  markKeyCooling(key, minutes) {
    const coolUntil = Date.now() + (minutes * 60 * 1000);
    this.coolingKeys.set(key, coolUntil);
    
    const hours = minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60}m` : `${minutes}m`;
    console.warn(`API Key cooling for ${hours}: ${key.substring(0, 10)}...`);
  }
  
  // 标记 key 成功使用（重置失败计数）
  markKeySuccess(key) {
    this.keyFailCount.delete(key);
  }
  
  // 清理过期的冷却状态
  cleanupExpiredKeys() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, coolUntil] of this.coolingKeys.entries()) {
      if (now >= coolUntil) {
        this.coolingKeys.delete(key);
        cleanedCount++;
        console.log(`Key recovered from cooling: ${key.substring(0, 10)}...`);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired cooling keys`);
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
    this.keyFailCount.clear();
    console.log('Reset all key states (failed, cooling, fail counts)');
  }
  
  // 重置失效的 keys（保持向后兼容）
  resetFailedKeys() {
    this.failedKeys.clear();
    console.log('Reset all failed API keys');
  }
  
  // 获取详细统计信息
  getStats() {
    const now = Date.now();
    const activeCooling = [...this.coolingKeys.values()]
      .filter(coolUntil => now < coolUntil).length;
    
    return {
      totalKeys: this.keys.length,
      availableKeys: this.keys.length - this.failedKeys.size - activeCooling,
      failedKeys: this.failedKeys.size,
      coolingKeys: activeCooling,
      strategy: this.strategy
    };
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

// Response Object Pool
const ResponsePool = {
  pool: [],
  maxSize: 100,
  
  acquire() {
    return this.pool.pop() || {
      id: '',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: null
      }],
      created: 0,
      model: '',
      object: "chat.completion.chunk"
    };
  },
  
  release(obj) {
    if (this.pool.length < this.maxSize) {
      obj.id = '';
      obj.created = 0;
      obj.model = '';
      obj.choices[0].index = 0;
      obj.choices[0].delta = {};
      obj.choices[0].finish_reason = null;
      this.pool.push(obj);
    }
  }
};

// Main Worker Export
export default {
  async fetch(request, env) {
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
          return createErrorResponse(500, 'Service configuration error');
        }
        
        keyPool = new ApiKeyPool(geminiKeys, strategy);
        authManager = new AuthManager(validTokens);
        
        console.log(`Initialized with ${keyPool.getStats().totalKeys} API keys and ${authManager.getValidTokenCount()} auth tokens`);
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
        
        // 智能错误处理
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
          return createErrorResponse(response.status, await response.text());
        }
        
      } catch (err) {
        lastError = err;
        console.error(`Network error with key ${apiKey.substring(0, 10)}...:`, err.message);
        
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
    console.error(`Key permanently failed (${status}): ${apiKey.substring(0, 10)}...`);
    return 'permanent';
  }
  
  if (status === 429) {
    // 频率限制：24小时冷却
    const retryAfter = response.headers.get('Retry-After');
    const coolMinutes = retryAfter ? Math.max(parseInt(retryAfter) / 60, 24 * 60) : 24 * 60;
    keyPool.markKeyCooling(apiKey, coolMinutes);
    console.warn(`Key rate limited (429), cooling for ${coolMinutes/60}h: ${apiKey.substring(0, 10)}...`);
    return 'temporary';
  }
  
  if (status === 503) {
    // 服务不可用：24小时冷却
    keyPool.markKeyCooling(apiKey, 24 * 60);
    console.warn(`Service unavailable (503), cooling for 24h: ${apiKey.substring(0, 10)}...`);
    return 'temporary';
  }
  
  if (status === 502 || status === 504) {
    // 网关错误：5分钟冷却
    keyPool.markKeyCooling(apiKey, 5);
    console.warn(`Gateway error (${status}), cooling for 5min: ${apiKey.substring(0, 10)}...`);
    return 'temporary';
  }
  
  if (status >= 500) {
    // 其他服务器错误：短期冷却
    keyPool.markKeyCooling(apiKey, 10);
    console.warn(`Server error (${status}), cooling for 10min: ${apiKey.substring(0, 10)}...`);
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

// Stream Response Handling
function createChunkResponse(data, stop = false, first = false, state) {
  const response = ResponsePool.acquire();
  response.id = state.id;
  response.created = Date.now() / 1000 | 0;
  response.model = state.model;
  
  const choice = response.choices[0];
  const cand = data.candidates[0];
  choice.index = cand?.index || 0;
  
  if (!stop) {
    const content = first ? "" : (cand?.content?.parts[0]?.text || "");
    choice.delta = {
      role: first ? "assistant" : undefined,
      content
    };
  } else {
    choice.delta = {};
    choice.finish_reason = reasonsMap[cand?.finishReason] || cand?.finishReason;
  }
  
  try {
    const responseStr = JSON.stringify(response);
    const result = `data: ${responseStr}\r\n\r\n`;
    ResponsePool.release(response);
    return result;
  } catch (err) {
    console.error('JSON serialization error:', err);
    ResponsePool.release(response);
    return createErrorChunk(new Error('Failed to serialize response'), state);
  }
}

// Stream Parsing
function createParseStream() {
  const decoder = new TextDecoder();
  let buffer = '';
  
  return new TransformStream({
    transform(chunk, controller) {
      try {
        buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\r\n\r\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const content = line.slice(6).trim();
            if (content && content !== '[DONE]') {
              try {
                const parsed = JSON.parse(content);
                controller.enqueue(parsed);
              } catch (e) {
                console.error('Invalid JSON in stream:', e);
              }
            }
          }
        }
      } catch (err) {
        console.error('Stream processing error:', err);
      }
    },
    flush(controller) {
      if (buffer) {
        const line = buffer.trim();
        if (line.startsWith('data: ')) {
          const content = line.slice(6).trim();
          if (content && content !== '[DONE]') {
            try {
              const parsed = JSON.parse(content);
              controller.enqueue(parsed);
            } catch (e) {
              console.error('Invalid JSON in final chunk:', e);
            }
          }
        }
      }
    }
  });
}

// OpenAI Stream Creation
function createOpenAIStream(model, id) {
  let lastIndex = -1;
  
  return new TransformStream({
    transform(chunk, controller) {
      try {
        const data = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
        
        if (!data.candidates?.[0]) {
          console.error('Invalid response format:', data);
          return;
        }

        const cand = data.candidates[0];
        const index = cand.index || 0;
        
        if (index !== lastIndex) {
          controller.enqueue(createChunkResponse(data, false, true, { model, id }));
          lastIndex = index;
        }
        
        if (cand.content) {
          controller.enqueue(createChunkResponse(data, false, false, { model, id }));
        }
      } catch (err) {
        console.error('Stream transformation error:', err);
        controller.enqueue(createErrorChunk(err, { model, id }));
      }
    },
    flush(controller) {
      try {
        controller.enqueue(`data: [DONE]\r\n\r\n`);
      } catch (err) {
        console.error('Flush error:', err);
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

// Error Chunk Creation
function createErrorChunk(error, state) {
  return createChunkResponse({
    candidates: [{
      index: 0,
      finishReason: "error",
      content: { parts: [{ text: error.message }] }
    }]
  }, false, false, state);
}

// Stream Response Handler
function handleStreamResponse(response, model, id) {
  const { readable, writable } = new TransformStream();
  
  response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(createParseStream())
    .pipeThrough(createOpenAIStream(model, id))
    .pipeThrough(new TextEncoderStream())
    .pipeTo(writable);

  return new Response(readable, { headers: COMMON_HEADERS.SSE });
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

      // 智能错误处理
      const errorType = handleApiError(apiKey, response);
      if (errorType === 'permanent' || errorType === 'temporary') {
        lastError = new Error(`Models API error: ${response.status}`);
        continue; // 尝试下一个 key
      } else {
        // 客户端错误，直接返回
        return createErrorResponse(response.status, await response.text());
      }

    } catch (err) {
      lastError = err;
      console.error(`Network error in handleModels:`, err.message);
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

      // 智能错误处理
      const errorType = handleApiError(apiKey, response);
      if (errorType === 'permanent' || errorType === 'temporary') {
        lastError = new Error(`Embeddings API error: ${response.status}`);
        continue; // 尝试下一个 key
      } else {
        // 客户端错误，直接返回
        return createErrorResponse(response.status, await response.text());
      }

    } catch (err) {
      lastError = err;
      console.error(`Network error in handleEmbeddings:`, err.message);
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
        version: "2.1.0-intelligent-cooling",
        features: [
          "Load Balancing",
          "Intelligent Error Handling",
          "24h Cooling for 429/503",
          "5min Cooling for 502/504",
          "Auto Recovery"
        ]
      }),
      { headers: COMMON_HEADERS.JSON }
    );
  } catch (err) {
    return createErrorResponse(500, `Status check failed: ${err.message}`);
  }
}