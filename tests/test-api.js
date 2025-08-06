/**
 * API 测试脚本
 * 用于测试 Gemini API 代理服务的各项功能
 */

const https = require('https');
const { URL } = require('url');

// 测试配置
const TEST_CONFIG = {
  // 替换为您的 Worker URL
  workerUrl: 'https://your-worker.your-subdomain.workers.dev',
  // 替换为您的认证 token
  authToken: 'your-auth-token',
  // 测试超时时间（毫秒）
  timeout: 30000
};

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

/**
 * HTTP 请求工具函数
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 响应对象
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: TEST_CONFIG.timeout
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            rawData: data
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * 测试用例执行器
 * @param {string} testName - 测试名称
 * @param {Function} testFunction - 测试函数
 */
async function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n🧪 测试: ${testName}`);
  console.log('-'.repeat(50));
  
  try {
    const startTime = Date.now();
    await testFunction();
    const endTime = Date.now();
    
    testResults.passed++;
    console.log(`✅ 通过 (${endTime - startTime}ms)`);
  } catch (error) {
    testResults.failed++;
    console.log(`❌ 失败: ${error.message}`);
    if (error.details) {
      console.log(`   详情: ${error.details}`);
    }
  }
}

/**
 * 断言函数
 * @param {boolean} condition - 条件
 * @param {string} message - 错误消息
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * 测试服务状态端点
 */
async function testStatusEndpoint() {
  const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
      'Content-Type': 'application/json'
    }
  });

  assert(response.status === 200, `状态码应为 200，实际为 ${response.status}`);
  assert(response.data && typeof response.data === 'object', '响应应为 JSON 对象');
  assert(response.data.status, '响应应包含 status 字段');
  assert(response.data.keyPool, '响应应包含 keyPool 字段');
  assert(response.data.auth, '响应应包含 auth 字段');
  assert(response.data.version, '响应应包含 version 字段');

  console.log(`   状态: ${response.data.status}`);
  console.log(`   版本: ${response.data.version}`);
  console.log(`   可用Keys: ${response.data.keyPool.availableKeys}/${response.data.keyPool.totalKeys}`);
}

/**
 * 测试聊天完成端点
 */
async function testChatCompletions() {
  const requestBody = {
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: '请回答：1+1等于几？' }
    ],
    max_tokens: 100,
    temperature: 0.1
  };

  const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  assert(response.status === 200, `状态码应为 200，实际为 ${response.status}`);
  assert(response.data && typeof response.data === 'object', '响应应为 JSON 对象');
  assert(response.data.choices && Array.isArray(response.data.choices), '响应应包含 choices 数组');
  assert(response.data.choices.length > 0, 'choices 数组不应为空');
  assert(response.data.choices[0].message, '第一个选择应包含 message');
  assert(response.data.choices[0].message.content, 'message 应包含 content');

  const content = response.data.choices[0].message.content;
  console.log(`   响应内容: ${content.substring(0, 100)}...`);
  console.log(`   Token使用: ${response.data.usage?.total_tokens || 'N/A'}`);
}

/**
 * 测试流式响应
 */
async function testStreamingResponse() {
  const requestBody = {
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: '请简单介绍一下人工智能' }
    ],
    max_tokens: 200,
    stream: true
  };

  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${TEST_CONFIG.workerUrl}/v1/chat/completions`);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(requestOptions, (res) => {
      assert(res.statusCode === 200, `状态码应为 200，实际为 ${res.statusCode}`);
      assert(res.headers['content-type']?.includes('text/event-stream'), 
             '内容类型应为 text/event-stream');

      let chunkCount = 0;
      let totalContent = '';

      res.on('data', (chunk) => {
        chunkCount++;
        const data = chunk.toString();
        
        // 解析 SSE 数据
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.choices && jsonData.choices[0] && jsonData.choices[0].delta) {
                const content = jsonData.choices[0].delta.content;
                if (content) {
                  totalContent += content;
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      res.on('end', () => {
        assert(chunkCount > 0, '应该接收到至少一个数据块');
        assert(totalContent.length > 0, '应该接收到内容');
        
        console.log(`   接收块数: ${chunkCount}`);
        console.log(`   内容长度: ${totalContent.length} 字符`);
        console.log(`   内容预览: ${totalContent.substring(0, 50)}...`);
        
        resolve();
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

/**
 * 测试模型列表端点
 */
async function testModelsEndpoint() {
  const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/models`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
      'Content-Type': 'application/json'
    }
  });

  assert(response.status === 200, `状态码应为 200，实际为 ${response.status}`);
  assert(response.data && typeof response.data === 'object', '响应应为 JSON 对象');
  assert(response.data.object === 'list', 'object 字段应为 "list"');
  assert(response.data.data && Array.isArray(response.data.data), '响应应包含 data 数组');
  assert(response.data.data.length > 0, 'data 数组不应为空');

  console.log(`   可用模型数量: ${response.data.data.length}`);
  console.log(`   模型示例: ${response.data.data.slice(0, 3).map(m => m.id).join(', ')}`);
}

/**
 * 测试嵌入向量端点
 */
async function testEmbeddingsEndpoint() {
  const requestBody = {
    model: 'embedding-001',
    input: ['测试文本', '另一个测试文本']
  };

  const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  assert(response.status === 200, `状态码应为 200，实际为 ${response.status}`);
  assert(response.data && typeof response.data === 'object', '响应应为 JSON 对象');
  assert(response.data.object === 'list', 'object 字段应为 "list"');
  assert(response.data.data && Array.isArray(response.data.data), '响应应包含 data 数组');
  assert(response.data.data.length === 2, '应返回 2 个嵌入向量');

  const embedding = response.data.data[0];
  assert(embedding.object === 'embedding', '嵌入对象类型应为 "embedding"');
  assert(Array.isArray(embedding.embedding), '嵌入向量应为数组');
  assert(embedding.embedding.length > 0, '嵌入向量不应为空');

  console.log(`   嵌入向量维度: ${embedding.embedding.length}`);
  console.log(`   Token使用: ${response.data.usage?.total_tokens || 'N/A'}`);
}

/**
 * 测试认证失败
 */
async function testAuthenticationFailure() {
  const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/status`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer invalid-token',
      'Content-Type': 'application/json'
    }
  });

  assert(response.status === 403, `状态码应为 403，实际为 ${response.status}`);
  assert(response.data && response.data.error, '响应应包含错误信息');

  console.log(`   错误类型: ${response.data.error.type}`);
  console.log(`   错误消息: ${response.data.error.message}`);
}

/**
 * 测试无效请求
 */
async function testInvalidRequest() {
  const requestBody = {
    model: 'gemini-2.5-flash',
    // 缺少必需的 messages 字段
    max_tokens: 100
  };

  const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  assert(response.status === 400, `状态码应为 400，实际为 ${response.status}`);
  assert(response.data && response.data.error, '响应应包含错误信息');

  console.log(`   错误类型: ${response.data.error.type}`);
  console.log(`   错误消息: ${response.data.error.message}`);
}

/**
 * 测试 CORS 支持
 */
async function testCORSSupport() {
  const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/status`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Authorization, Content-Type'
    }
  });

  assert(response.status === 200, `OPTIONS 请求状态码应为 200，实际为 ${response.status}`);
  assert(response.headers['access-control-allow-origin'], '应包含 CORS 头');
  assert(response.headers['access-control-allow-methods'], '应包含允许的方法');
  assert(response.headers['access-control-allow-headers'], '应包含允许的头部');

  console.log(`   允许的源: ${response.headers['access-control-allow-origin']}`);
  console.log(`   允许的方法: ${response.headers['access-control-allow-methods']}`);
}

/**
 * 性能测试
 */
async function testPerformance() {
  const testCases = [
    { name: '简单查询', content: '你好' },
    { name: '中等查询', content: '请解释什么是机器学习' },
    { name: '复杂查询', content: '请详细分析深度学习的发展历程和主要应用领域' }
  ];

  for (const testCase of testCases) {
    const startTime = Date.now();
    
    const response = await makeRequest(`${TEST_CONFIG.workerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: testCase.content }],
        max_tokens: 200
      })
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    assert(response.status === 200, `${testCase.name} 请求失败`);
    
    const responseLength = response.data.choices[0].message.content.length;
    console.log(`   ${testCase.name}: ${responseTime}ms, ${responseLength} 字符`);
  }
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log('🚀 Gemini API 代理服务 - API 测试套件');
  console.log('='.repeat(60));
  console.log(`测试目标: ${TEST_CONFIG.workerUrl}`);
  console.log(`认证令牌: ${TEST_CONFIG.authToken.substring(0, 10)}...`);
  console.log(`超时时间: ${TEST_CONFIG.timeout}ms`);
  console.log('='.repeat(60));

  // 执行所有测试
  await runTest('服务状态检查', testStatusEndpoint);
  await runTest('聊天完成接口', testChatCompletions);
  await runTest('流式响应', testStreamingResponse);
  await runTest('模型列表', testModelsEndpoint);
  await runTest('嵌入向量', testEmbeddingsEndpoint);
  await runTest('认证失败处理', testAuthenticationFailure);
  await runTest('无效请求处理', testInvalidRequest);
  await runTest('CORS 支持', testCORSSupport);
  await runTest('性能测试', testPerformance);

  // 输出测试结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`📊 总计: ${testResults.total}`);
  console.log(`📈 成功率: ${Math.round(testResults.passed / testResults.total * 100)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 所有测试都通过了！');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置和服务状态');
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行所有测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

// 导出测试函数供其他模块使用
module.exports = {
  runAllTests,
  testStatusEndpoint,
  testChatCompletions,
  testStreamingResponse,
  testModelsEndpoint,
  testEmbeddingsEndpoint,
  testAuthenticationFailure,
  testInvalidRequest,
  testCORSSupport,
  testPerformance
};