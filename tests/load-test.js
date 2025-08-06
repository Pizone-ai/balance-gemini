/**
 * 负载测试脚本
 * 用于测试 Gemini API 代理服务在高并发情况下的性能表现
 */

const https = require('https');
const { URL } = require('url');

// 负载测试配置
const LOAD_TEST_CONFIG = {
  // 替换为您的 Worker URL
  workerUrl: 'https://your-worker.your-subdomain.workers.dev',
  // 替换为您的认证 token
  authToken: 'your-auth-token',
  // 并发用户数
  concurrentUsers: 10,
  // 每个用户的请求数
  requestsPerUser: 5,
  // 请求间隔（毫秒）
  requestInterval: 1000,
  // 请求超时时间（毫秒）
  timeout: 30000
};

// 测试统计
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  responseTimes: [],
  errors: {},
  startTime: 0,
  endTime: 0
};

/**
 * HTTP 请求工具函数
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 响应对象
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: LOAD_TEST_CONFIG.timeout
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            responseTime: responseTime,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: null,
            responseTime: responseTime,
            success: false,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      reject({
        error: error.message,
        responseTime: responseTime,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      reject({
        error: 'Request timeout',
        responseTime: responseTime,
        success: false
      });
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * 记录请求结果
 * @param {Object} result - 请求结果
 */
function recordResult(result) {
  stats.totalRequests++;
  
  if (result.success) {
    stats.successfulRequests++;
  } else {
    stats.failedRequests++;
    const errorKey = result.error || `HTTP_${result.status}`;
    stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
  }
  
  const responseTime = result.responseTime;
  stats.totalResponseTime += responseTime;
  stats.responseTimes.push(responseTime);
  stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
  stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
}

/**
 * 单个用户的负载测试
 * @param {number} userId - 用户ID
 * @param {Array} testMessages - 测试消息列表
 */
async function runUserLoad(userId, testMessages) {
  console.log(`👤 用户 ${userId} 开始测试...`);
  
  for (let i = 0; i < LOAD_TEST_CONFIG.requestsPerUser; i++) {
    try {
      const message = testMessages[i % testMessages.length];
      const requestBody = {
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: message }],
        max_tokens: 100,
        temperature: 0.7
      };

      const result = await makeRequest(`${LOAD_TEST_CONFIG.workerUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOAD_TEST_CONFIG.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      recordResult(result);
      
      if (result.success) {
        console.log(`✅ 用户 ${userId} 请求 ${i + 1}: ${result.responseTime}ms`);
      } else {
        console.log(`❌ 用户 ${userId} 请求 ${i + 1}: ${result.error || result.status} (${result.responseTime}ms)`);
      }

      // 请求间隔
      if (i < LOAD_TEST_CONFIG.requestsPerUser - 1) {
        await new Promise(resolve => setTimeout(resolve, LOAD_TEST_CONFIG.requestInterval));
      }

    } catch (error) {
      recordResult(error);
      console.log(`❌ 用户 ${userId} 请求 ${i + 1}: ${error.error} (${error.responseTime}ms)`);
    }
  }
  
  console.log(`👤 用户 ${userId} 测试完成`);
}

/**
 * 计算统计数据
 */
function calculateStats() {
  if (stats.responseTimes.length === 0) {
    return;
  }

  // 排序响应时间用于计算百分位数
  stats.responseTimes.sort((a, b) => a - b);
  
  const count = stats.responseTimes.length;
  stats.averageResponseTime = stats.totalResponseTime / count;
  stats.medianResponseTime = count % 2 === 0
    ? (stats.responseTimes[count / 2 - 1] + stats.responseTimes[count / 2]) / 2
    : stats.responseTimes[Math.floor(count / 2)];
  
  stats.p95ResponseTime = stats.responseTimes[Math.floor(count * 0.95)];
  stats.p99ResponseTime = stats.responseTimes[Math.floor(count * 0.99)];
  
  stats.totalDuration = stats.endTime - stats.startTime;
  stats.requestsPerSecond = stats.totalRequests / (stats.totalDuration / 1000);
  stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
}

/**
 * 显示测试结果
 */
function displayResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 负载测试结果报告');
  console.log('='.repeat(60));
  
  console.log('\n📈 基础统计:');
  console.log(`   总请求数: ${stats.totalRequests}`);
  console.log(`   成功请求: ${stats.successfulRequests}`);
  console.log(`   失败请求: ${stats.failedRequests}`);
  console.log(`   成功率: ${stats.successRate.toFixed(2)}%`);
  console.log(`   测试时长: ${(stats.totalDuration / 1000).toFixed(2)} 秒`);
  console.log(`   请求速率: ${stats.requestsPerSecond.toFixed(2)} 请求/秒`);
  
  console.log('\n⏱️  响应时间统计:');
  console.log(`   平均响应时间: ${stats.averageResponseTime.toFixed(2)} ms`);
  console.log(`   中位数响应时间: ${stats.medianResponseTime.toFixed(2)} ms`);
  console.log(`   最小响应时间: ${stats.minResponseTime} ms`);
  console.log(`   最大响应时间: ${stats.maxResponseTime} ms`);
  console.log(`   95% 响应时间: ${stats.p95ResponseTime} ms`);
  console.log(`   99% 响应时间: ${stats.p99ResponseTime} ms`);
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('\n❌ 错误统计:');
    for (const [error, count] of Object.entries(stats.errors)) {
      console.log(`   ${error}: ${count} 次`);
    }
  }
  
  console.log('\n📊 性能评估:');
  if (stats.successRate >= 99) {
    console.log('   🟢 优秀: 成功率 >= 99%');
  } else if (stats.successRate >= 95) {
    console.log('   🟡 良好: 成功率 >= 95%');
  } else {
    console.log('   🔴 需要改进: 成功率 < 95%');
  }
  
  if (stats.averageResponseTime <= 1000) {
    console.log('   🟢 响应时间优秀: <= 1000ms');
  } else if (stats.averageResponseTime <= 3000) {
    console.log('   🟡 响应时间良好: <= 3000ms');
  } else {
    console.log('   🔴 响应时间需要改进: > 3000ms');
  }
  
  if (stats.requestsPerSecond >= 10) {
    console.log('   🟢 吞吐量优秀: >= 10 请求/秒');
  } else if (stats.requestsPerSecond >= 5) {
    console.log('   🟡 吞吐量良好: >= 5 请求/秒');
  } else {
    console.log('   🔴 吞吐量需要改进: < 5 请求/秒');
  }
}

/**
 * 预热测试
 */
async function warmupTest() {
  console.log('🔥 执行预热测试...');
  
  try {
    const result = await makeRequest(`${LOAD_TEST_CONFIG.workerUrl}/v1/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LOAD_TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (result.success) {
      console.log('✅ 预热测试成功');
      console.log(`   服务状态: ${result.data.status}`);
      console.log(`   可用Keys: ${result.data.keyPool.availableKeys}/${result.data.keyPool.totalKeys}`);
    } else {
      throw new Error(`预热测试失败: ${result.status}`);
    }
  } catch (error) {
    throw new Error(`预热测试失败: ${error.message || error.error}`);
  }
}

/**
 * 压力测试（逐步增加负载）
 */
async function stressTest() {
  console.log('\n🚀 执行压力测试...');
  
  const stressLevels = [1, 3, 5, 8, 10];
  const testMessage = '这是一个压力测试消息，请简单回复';
  
  for (const level of stressLevels) {
    console.log(`\n📈 压力级别: ${level} 并发用户`);
    
    const levelStats = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalTime: 0,
      times: []
    };
    
    const promises = [];
    const startTime = Date.now();
    
    for (let i = 0; i < level; i++) {
      const promise = makeRequest(`${LOAD_TEST_CONFIG.workerUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOAD_TEST_CONFIG.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: testMessage }],
          max_tokens: 50
        })
      }).then(result => {
        levelStats.requests++;
        levelStats.times.push(result.responseTime);
        levelStats.totalTime += result.responseTime;
        if (result.success) {
          levelStats.successes++;
        } else {
          levelStats.failures++;
        }
        return result;
      }).catch(error => {
        levelStats.requests++;
        levelStats.failures++;
        levelStats.times.push(error.responseTime || 0);
        return error;
      });
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    const avgResponseTime = levelStats.totalTime / levelStats.requests;
    const successRate = (levelStats.successes / levelStats.requests) * 100;
    const duration = endTime - startTime;
    
    console.log(`   ⏱️  平均响应时间: ${avgResponseTime.toFixed(2)} ms`);
    console.log(`   ✅ 成功率: ${successRate.toFixed(2)}%`);
    console.log(`   🕐 总耗时: ${duration} ms`);
    
    // 短暂休息
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * 主负载测试函数
 */
async function runLoadTest() {
  console.log('🚀 Gemini API 代理服务 - 负载测试');
  console.log('='.repeat(60));
  console.log(`测试目标: ${LOAD_TEST_CONFIG.workerUrl}`);
  console.log(`并发用户: ${LOAD_TEST_CONFIG.concurrentUsers}`);
  console.log(`每用户请求数: ${LOAD_TEST_CONFIG.requestsPerUser}`);
  console.log(`请求间隔: ${LOAD_TEST_CONFIG.requestInterval}ms`);
  console.log(`总请求数: ${LOAD_TEST_CONFIG.concurrentUsers * LOAD_TEST_CONFIG.requestsPerUser}`);
  console.log('='.repeat(60));

  try {
    // 预热测试
    await warmupTest();
    
    // 压力测试
    await stressTest();
    
    console.log('\n🔄 开始主负载测试...');
    
    // 测试消息列表
    const testMessages = [
      '你好，这是一个测试消息',
      '请简单介绍一下人工智能',
      '1+1等于几？',
      '今天天气怎么样？',
      '请推荐一本好书'
    ];
    
    stats.startTime = Date.now();
    
    // 创建并发用户
    const userPromises = [];
    for (let i = 1; i <= LOAD_TEST_CONFIG.concurrentUsers; i++) {
      userPromises.push(runUserLoad(i, testMessages));
    }
    
    // 等待所有用户完成
    await Promise.all(userPromises);
    
    stats.endTime = Date.now();
    
    // 计算和显示结果
    calculateStats();
    displayResults();
    
    // 根据结果决定退出码
    if (stats.successRate >= 95 && stats.averageResponseTime <= 5000) {
      console.log('\n🎉 负载测试通过！');
      process.exit(0);
    } else {
      console.log('\n⚠️  负载测试未达到预期标准');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 负载测试失败:', error.message);
    process.exit(1);
  }
}

/**
 * 快速负载测试（用于 CI/CD）
 */
async function quickLoadTest() {
  console.log('⚡ 快速负载测试模式');
  
  // 降低测试强度
  LOAD_TEST_CONFIG.concurrentUsers = 3;
  LOAD_TEST_CONFIG.requestsPerUser = 2;
  LOAD_TEST_CONFIG.requestInterval = 500;
  
  await runLoadTest();
}

// 命令行参数处理
const args = process.argv.slice(2);
const isQuickMode = args.includes('--quick');

// 如果直接运行此文件，则执行负载测试
if (require.main === module) {
  if (isQuickMode) {
    quickLoadTest().catch(error => {
      console.error('❌ 快速负载测试失败:', error);
      process.exit(1);
    });
  } else {
    runLoadTest().catch(error => {
      console.error('❌ 负载测试失败:', error);
      process.exit(1);
    });
  }
}

// 导出函数供其他模块使用
module.exports = {
  runLoadTest,
  quickLoadTest,
  stressTest,
  warmupTest
};