/**
 * 流式响应示例
 * 演示如何使用 Gemini API 代理服务的流式响应功能
 */

// 配置信息
const CONFIG = {
  // 替换为您的 Worker URL
  workerUrl: 'https://your-worker.your-subdomain.workers.dev',
  // 替换为您的认证 token
  authToken: 'your-auth-token'
};

/**
 * 发送流式聊天请求
 * @param {string} message - 用户消息
 * @param {Function} onChunk - 处理每个数据块的回调函数
 * @param {string} model - 模型名称
 */
async function sendStreamingMessage(message, onChunk, model = 'gemini-2.5-flash') {
  try {
    const response = await fetch(`${CONFIG.workerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: message }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        stream: true // 启用流式响应
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
              const content = parsed.choices[0].delta.content;
              if (content) {
                onChunk(content, parsed);
              }
            }
          } catch (e) {
            console.warn('解析 JSON 失败:', e.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('流式请求失败:', error);
    throw error;
  }
}

/**
 * 基础流式响应示例
 */
async function basicStreamingExample() {
  console.log('🌊 基础流式响应示例\n');
  
  const question = '请详细解释什么是机器学习，包括其主要类型和应用场景';
  console.log(`❓ 问题: ${question}\n`);
  console.log('🤖 AI 回答:');
  
  let fullResponse = '';
  const startTime = Date.now();
  
  try {
    await sendStreamingMessage(question, (chunk, data) => {
      process.stdout.write(chunk);
      fullResponse += chunk;
    });
    
    const endTime = Date.now();
    console.log(`\n\n⏱️  总响应时间: ${endTime - startTime}ms`);
    console.log(`📝 完整回答长度: ${fullResponse.length} 字符`);
    
  } catch (error) {
    console.error('流式响应失败:', error);
  }
}

/**
 * 实时打字效果示例
 */
async function typewriterEffect() {
  console.log('⌨️  打字机效果示例\n');
  
  const question = '写一首关于编程的短诗';
  console.log(`❓ 问题: ${question}\n`);
  console.log('🤖 AI 创作中...\n');
  
  let fullResponse = '';
  
  try {
    await sendStreamingMessage(question, (chunk, data) => {
      // 模拟打字机效果，每个字符间有小延迟
      for (let i = 0; i < chunk.length; i++) {
        setTimeout(() => {
          process.stdout.write(chunk[i]);
        }, i * 50); // 每个字符延迟 50ms
      }
      fullResponse += chunk;
    });
    
    // 等待打字效果完成
    setTimeout(() => {
      console.log(`\n\n✨ 创作完成！总共 ${fullResponse.length} 字符`);
    }, fullResponse.length * 50 + 1000);
    
  } catch (error) {
    console.error('打字机效果失败:', error);
  }
}

/**
 * 多任务并发流式处理示例
 */
async function concurrentStreamingExample() {
  console.log('🔄 并发流式处理示例\n');
  
  const questions = [
    '用一句话解释什么是区块链',
    '推荐三本编程入门书籍',
    '解释什么是云计算'
  ];
  
  const promises = questions.map((question, index) => {
    return new Promise((resolve) => {
      console.log(`🚀 任务 ${index + 1} 开始: ${question}`);
      let response = '';
      
      sendStreamingMessage(question, (chunk, data) => {
        response += chunk;
      }).then(() => {
        console.log(`✅ 任务 ${index + 1} 完成: ${response.substring(0, 100)}...`);
        resolve({ index: index + 1, question, response });
      }).catch((error) => {
        console.error(`❌ 任务 ${index + 1} 失败:`, error.message);
        resolve({ index: index + 1, question, error: error.message });
      });
    });
  });
  
  try {
    const results = await Promise.all(promises);
    console.log('\n📊 所有任务完成结果:');
    results.forEach(result => {
      if (result.error) {
        console.log(`- 任务 ${result.index}: 失败 (${result.error})`);
      } else {
        console.log(`- 任务 ${result.index}: 成功 (${result.response.length} 字符)`);
      }
    });
  } catch (error) {
    console.error('并发处理失败:', error);
  }
}

/**
 * 流式响应数据分析示例
 */
async function streamAnalysisExample() {
  console.log('📈 流式响应数据分析示例\n');
  
  const question = '请详细介绍 JavaScript 的异步编程概念';
  console.log(`❓ 问题: ${question}\n`);
  
  let chunkCount = 0;
  let totalChars = 0;
  let firstChunkTime = null;
  let lastChunkTime = null;
  const chunkSizes = [];
  const chunkTimes = [];
  
  const startTime = Date.now();
  
  try {
    await sendStreamingMessage(question, (chunk, data) => {
      const now = Date.now();
      
      if (chunkCount === 0) {
        firstChunkTime = now;
        console.log('🎯 首个数据块到达');
      }
      
      chunkCount++;
      totalChars += chunk.length;
      chunkSizes.push(chunk.length);
      chunkTimes.push(now - startTime);
      lastChunkTime = now;
      
      // 显示进度
      process.stdout.write('.');
    });
    
    const endTime = Date.now();
    
    console.log('\n\n📊 流式响应分析报告:');
    console.log(`⏱️  总响应时间: ${endTime - startTime}ms`);
    console.log(`🚀 首块延迟: ${firstChunkTime - startTime}ms`);
    console.log(`📦 数据块数量: ${chunkCount}`);
    console.log(`📝 总字符数: ${totalChars}`);
    console.log(`📏 平均块大小: ${Math.round(totalChars / chunkCount)} 字符`);
    console.log(`🔢 最大块大小: ${Math.max(...chunkSizes)} 字符`);
    console.log(`🔢 最小块大小: ${Math.min(...chunkSizes)} 字符`);
    console.log(`⚡ 平均传输速度: ${Math.round(totalChars / (endTime - startTime) * 1000)} 字符/秒`);
    
  } catch (error) {
    console.error('流式分析失败:', error);
  }
}

/**
 * 错误处理和重连示例
 */
async function errorHandlingStreamExample() {
  console.log('⚠️  流式响应错误处理示例\n');
  
  const question = '这是一个测试消息';
  let retryCount = 0;
  const maxRetries = 3;
  
  async function attemptStream() {
    try {
      console.log(`🔄 尝试 ${retryCount + 1}/${maxRetries + 1}`);
      
      await sendStreamingMessage(question, (chunk, data) => {
        console.log(`收到数据块: ${chunk.substring(0, 50)}...`);
        
        // 模拟随机错误
        if (Math.random() < 0.1 && retryCount < 2) {
          throw new Error('模拟网络中断');
        }
      });
      
      console.log('✅ 流式响应成功完成');
      
    } catch (error) {
      console.error(`❌ 尝试 ${retryCount + 1} 失败:`, error.message);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`⏳ ${2 ** retryCount} 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2 ** retryCount * 1000));
        return attemptStream();
      } else {
        throw new Error(`所有重试都失败了: ${error.message}`);
      }
    }
  }
  
  try {
    await attemptStream();
  } catch (error) {
    console.error('最终失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🌊 Gemini API 代理服务 - 流式响应示例\n');
  console.log('配置信息:');
  console.log(`- Worker URL: ${CONFIG.workerUrl}`);
  console.log(`- Auth Token: ${CONFIG.authToken.substring(0, 10)}...`);
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // 1. 基础流式响应
    console.log('1️⃣ 基础流式响应示例');
    await basicStreamingExample();
    console.log('\n' + '='.repeat(60) + '\n');

    // 2. 打字机效果
    console.log('2️⃣ 打字机效果示例');
    await typewriterEffect();
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待打字效果
    console.log('\n' + '='.repeat(60) + '\n');

    // 3. 并发流式处理
    console.log('3️⃣ 并发流式处理示例');
    await concurrentStreamingExample();
    console.log('\n' + '='.repeat(60) + '\n');

    // 4. 流式数据分析
    console.log('4️⃣ 流式响应数据分析示例');
    await streamAnalysisExample();
    console.log('\n' + '='.repeat(60) + '\n');

    // 5. 错误处理
    console.log('5️⃣ 错误处理和重连示例');
    await errorHandlingStreamExample();

    console.log('\n✨ 所有流式响应示例执行完成！');

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
  sendStreamingMessage,
  basicStreamingExample,
  typewriterEffect,
  concurrentStreamingExample,
  streamAnalysisExample,
  errorHandlingStreamExample
};