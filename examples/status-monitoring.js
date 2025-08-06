/**
 * 状态监控示例
 * 演示如何监控 Gemini API 代理服务的状态和健康情况
 */

// 配置信息
const CONFIG = {
  // 替换为您的 Worker URL
  workerUrl: 'https://your-worker.your-subdomain.workers.dev',
  // 替换为您的认证 token
  authToken: 'your-auth-token',
  // 监控间隔（毫秒）
  monitorInterval: 30000 // 30秒
};

/**
 * 获取服务状态
 * @returns {Promise<Object>} 状态信息
 */
async function getServiceStatus() {
  try {
    const response = await fetch(`${CONFIG.workerUrl}/v1/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取状态失败:', error);
    throw error;
  }
}

/**
 * 格式化状态显示
 * @param {Object} status - 状态对象
 */
function formatStatusDisplay(status) {
  const timestamp = new Date(status.timestamp).toLocaleString('zh-CN');
  
  console.log('📊 服务状态报告');
  console.log('='.repeat(50));
  console.log(`🕐 检查时间: ${timestamp}`);
  console.log(`🚦 服务状态: ${getStatusEmoji(status.status)} ${status.status.toUpperCase()}`);
  console.log(`📦 版本信息: ${status.version}`);
  
  // API Key 池状态
  console.log('\n🔑 API Key 池状态:');
  console.log(`  📊 总计: ${status.keyPool.totalKeys} 个`);
  console.log(`  ✅ 可用: ${status.keyPool.availableKeys} 个`);
  console.log(`  ❌ 失效: ${status.keyPool.failedKeys} 个`);
  console.log(`  🧊 冷却: ${status.keyPool.coolingKeys} 个`);
  console.log(`  ⚙️  策略: ${status.keyPool.strategy}`);
  
  // 冷却详情
  if (status.keyPool.coolingDetails && status.keyPool.coolingDetails.length > 0) {
    console.log('\n❄️  冷却详情:');
    status.keyPool.coolingDetails.forEach((detail, index) => {
      console.log(`  ${index + 1}. ${detail.key} - 剩余: ${detail.remainingDisplay}`);
    });
  }
  
  // 认证状态
  console.log('\n🔐 认证状态:');
  console.log(`  🎫 有效令牌: ${status.auth.validTokens} 个`);
  
  // 功能特性
  console.log('\n✨ 功能特性:');
  status.features.forEach(feature => {
    console.log(`  • ${feature}`);
  });
  
  console.log('='.repeat(50));
}

/**
 * 获取状态对应的表情符号
 * @param {string} status - 状态字符串
 * @returns {string} 表情符号
 */
function getStatusEmoji(status) {
  switch (status.toLowerCase()) {
    case 'healthy': return '🟢';
    case 'degraded': return '🟡';
    case 'unhealthy': return '🔴';
    default: return '⚪';
  }
}

/**
 * 健康检查示例
 */
async function healthCheckExample() {
  console.log('🏥 健康检查示例\n');
  
  try {
    const status = await getServiceStatus();
    formatStatusDisplay(status);
    
    // 健康评估
    console.log('\n🔍 健康评估:');
    
    const healthScore = calculateHealthScore(status);
    console.log(`📈 健康评分: ${healthScore}/100`);
    
    if (healthScore >= 90) {
      console.log('✅ 服务状态优秀');
    } else if (healthScore >= 70) {
      console.log('⚠️  服务状态良好，但需要关注');
    } else if (healthScore >= 50) {
      console.log('🟡 服务状态一般，建议检查');
    } else {
      console.log('🔴 服务状态不佳，需要立即处理');
    }
    
    // 提供建议
    const suggestions = generateSuggestions(status);
    if (suggestions.length > 0) {
      console.log('\n💡 改进建议:');
      suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });
    }
    
  } catch (error) {
    console.error('健康检查失败:', error);
  }
}

/**
 * 计算健康评分
 * @param {Object} status - 状态对象
 * @returns {number} 健康评分 (0-100)
 */
function calculateHealthScore(status) {
  let score = 100;
  
  // 基础状态扣分
  if (status.status === 'degraded') score -= 20;
  if (status.status === 'unhealthy') score -= 50;
  
  // API Key 可用性扣分
  const keyAvailability = status.keyPool.availableKeys / status.keyPool.totalKeys;
  if (keyAvailability < 0.5) score -= 30;
  else if (keyAvailability < 0.8) score -= 15;
  
  // 失效 Key 扣分
  const failedRatio = status.keyPool.failedKeys / status.keyPool.totalKeys;
  score -= failedRatio * 20;
  
  // 冷却 Key 扣分
  const coolingRatio = status.keyPool.coolingKeys / status.keyPool.totalKeys;
  score -= coolingRatio * 10;
  
  return Math.max(0, Math.round(score));
}

/**
 * 生成改进建议
 * @param {Object} status - 状态对象
 * @returns {Array<string>} 建议列表
 */
function generateSuggestions(status) {
  const suggestions = [];
  
  if (status.keyPool.failedKeys > 0) {
    suggestions.push('检查并更换失效的 API Keys');
  }
  
  if (status.keyPool.coolingKeys > status.keyPool.totalKeys * 0.5) {
    suggestions.push('考虑增加更多 API Keys 以提高可用性');
  }
  
  if (status.keyPool.availableKeys === 0) {
    suggestions.push('紧急：所有 API Keys 都不可用，请立即检查配置');
  }
  
  if (status.keyPool.totalKeys < 3) {
    suggestions.push('建议配置至少 3 个 API Keys 以确保高可用性');
  }
  
  return suggestions;
}

/**
 * 持续监控示例
 */
async function continuousMonitoringExample() {
  console.log('🔄 持续监控示例');
  console.log(`⏰ 监控间隔: ${CONFIG.monitorInterval / 1000} 秒\n`);
  
  let monitorCount = 0;
  const maxMonitorCycles = 5; // 最多监控 5 次作为示例
  
  const monitorInterval = setInterval(async () => {
    try {
      monitorCount++;
      console.log(`\n📡 监控周期 ${monitorCount}/${maxMonitorCycles}`);
      console.log(`🕐 ${new Date().toLocaleString('zh-CN')}`);
      
      const status = await getServiceStatus();
      
      // 简化显示
      console.log(`🚦 状态: ${getStatusEmoji(status.status)} ${status.status}`);
      console.log(`🔑 可用Keys: ${status.keyPool.availableKeys}/${status.keyPool.totalKeys}`);
      
      if (status.keyPool.coolingKeys > 0) {
        console.log(`❄️  冷却Keys: ${status.keyPool.coolingKeys}`);
      }
      
      // 检查是否需要告警
      const healthScore = calculateHealthScore(status);
      if (healthScore < 70) {
        console.log(`⚠️  健康评分较低: ${healthScore}/100`);
      }
      
      if (monitorCount >= maxMonitorCycles) {
        clearInterval(monitorInterval);
        console.log('\n✅ 监控示例完成');
      }
      
    } catch (error) {
      console.error(`❌ 监控周期 ${monitorCount} 失败:`, error.message);
    }
  }, CONFIG.monitorInterval);
  
  // 等待监控完成
  return new Promise(resolve => {
    setTimeout(() => {
      clearInterval(monitorInterval);
      resolve();
    }, CONFIG.monitorInterval * maxMonitorCycles + 5000);
  });
}

/**
 * 性能基准测试
 */
async function performanceBenchmark() {
  console.log('⚡ 性能基准测试\n');
  
  const testCases = [
    { name: '简单查询', message: '你好' },
    { name: '中等查询', message: '请解释什么是人工智能' },
    { name: '复杂查询', message: '请详细分析机器学习的发展历程、主要算法类型以及在各个行业的应用案例' }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`🧪 测试: ${testCase.name}`);
      
      const startTime = Date.now();
      
      const response = await fetch(`${CONFIG.workerUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: testCase.message }],
          max_tokens: 500
        })
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const responseLength = data.choices[0].message.content.length;
        
        console.log(`  ✅ 响应时间: ${responseTime}ms`);
        console.log(`  📝 响应长度: ${responseLength} 字符`);
        console.log(`  ⚡ 处理速度: ${Math.round(responseLength / responseTime * 1000)} 字符/秒`);
        
        if (data.usage) {
          console.log(`  🎯 Token使用: ${data.usage.total_tokens}`);
        }
      } else {
        console.log(`  ❌ 请求失败: ${response.status}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`  ❌ 测试失败:`, error.message);
    }
  }
}

/**
 * 告警系统示例
 */
async function alertingSystemExample() {
  console.log('🚨 告警系统示例\n');
  
  try {
    const status = await getServiceStatus();
    const alerts = [];
    
    // 检查各种告警条件
    if (status.status !== 'healthy') {
      alerts.push({
        level: 'WARNING',
        message: `服务状态异常: ${status.status}`,
        action: '检查服务配置和网络连接'
      });
    }
    
    if (status.keyPool.availableKeys === 0) {
      alerts.push({
        level: 'CRITICAL',
        message: '所有 API Keys 都不可用',
        action: '立即检查 API Keys 配置和状态'
      });
    } else if (status.keyPool.availableKeys < status.keyPool.totalKeys * 0.3) {
      alerts.push({
        level: 'WARNING',
        message: `可用 API Keys 不足: ${status.keyPool.availableKeys}/${status.keyPool.totalKeys}`,
        action: '考虑添加更多 API Keys 或检查冷却状态'
      });
    }
    
    if (status.keyPool.failedKeys > 0) {
      alerts.push({
        level: 'INFO',
        message: `发现 ${status.keyPool.failedKeys} 个失效的 API Keys`,
        action: '更换失效的 API Keys'
      });
    }
    
    // 显示告警
    if (alerts.length === 0) {
      console.log('✅ 没有发现任何告警');
    } else {
      console.log(`⚠️  发现 ${alerts.length} 个告警:\n`);
      
      alerts.forEach((alert, index) => {
        const emoji = alert.level === 'CRITICAL' ? '🔴' : 
                     alert.level === 'WARNING' ? '🟡' : '🔵';
        
        console.log(`${emoji} 告警 ${index + 1}: [${alert.level}]`);
        console.log(`   消息: ${alert.message}`);
        console.log(`   建议: ${alert.action}\n`);
      });
    }
    
  } catch (error) {
    console.error('告警检查失败:', error);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('📊 Gemini API 代理服务 - 状态监控示例\n');
  console.log('配置信息:');
  console.log(`- Worker URL: ${CONFIG.workerUrl}`);
  console.log(`- Auth Token: ${CONFIG.authToken.substring(0, 10)}...`);
  console.log(`- 监控间隔: ${CONFIG.monitorInterval / 1000} 秒`);
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // 1. 健康检查
    console.log('1️⃣ 健康检查示例');
    await healthCheckExample();
    console.log('\n' + '='.repeat(60) + '\n');

    // 2. 性能基准测试
    console.log('2️⃣ 性能基准测试');
    await performanceBenchmark();
    console.log('='.repeat(60) + '\n');

    // 3. 告警系统
    console.log('3️⃣ 告警系统示例');
    await alertingSystemExample();
    console.log('\n' + '='.repeat(60) + '\n');

    // 4. 持续监控（注释掉以避免长时间运行）
    // console.log('4️⃣ 持续监控示例');
    // await continuousMonitoringExample();

    console.log('\n✨ 所有监控示例执行完成！');
    console.log('\n💡 提示: 取消注释持续监控部分以启用实时监控功能');

  } catch (error) {
    console.error('❌ 示例执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}

// 导出函数供其他模块使用
module.exports = {
  getServiceStatus,
  formatStatusDisplay,
  calculateHealthScore,
  generateSuggestions,
  healthCheckExample,
  continuousMonitoringExample,
  performanceBenchmark,
  alertingSystemExample
};