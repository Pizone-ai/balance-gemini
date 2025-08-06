/**
 * 基础使用示例
 * 演示如何使用 Gemini API 代理服务进行基本的聊天对话
 */

// 配置信息
const CONFIG = {
  // 替换为您的 Worker URL
  workerUrl: 'https://your-worker.your-subdomain.workers.dev',
  // 替换为您的认证 token
  authToken: 'your-auth-token'
};

/**
 * 发送聊天请求
 * @param {string} message - 用户消息
 * @param {string} model - 模型名称
 * @returns {Promise<Object>} API 响应
 */
async function sendChatMessage(message, model = 'gemini-2.5-flash') {
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
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('发送消息失败:', error);
    throw error;
  }
}

/**
 * 多轮对话示例
 */
async function multiTurnConversation() {
  console.log('🤖 开始多轮对话示例...\n');

  const messages = [
    { role: 'user', content: '你好，请介绍一下你自己' },
    { role: 'assistant', content: '' }, // 将被 API 响应填充
    { role: 'user', content: '你能帮我写一个简单的 JavaScript 函数吗？' }
  ];

  try {
    // 第一轮对话
    console.log('👤 用户:', messages[0].content);
    
    const response1 = await fetch(`${CONFIG.workerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [messages[0]],
        max_tokens: 500
      })
    });

    const data1 = await response1.json();
    messages[1].content = data1.choices[0].message.content;
    console.log('🤖 助手:', messages[1].content);
    console.log('\n---\n');

    // 第二轮对话
    console.log('👤 用户:', messages[2].content);
    
    const response2 = await fetch(`${CONFIG.workerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: messages,
        max_tokens: 800
      })
    });

    const data2 = await response2.json();
    console.log('🤖 助手:', data2.choices[0].message.content);

  } catch (error) {
    console.error('多轮对话失败:', error);
  }
}

/**
 * 不同模型对比示例
 */
async function compareModels() {
  console.log('🔍 模型对比示例...\n');

  const question = '请用一句话解释什么是人工智能';
  const models = ['gemini-2.5-flash', 'gemini-1.5-pro'];

  for (const model of models) {
    try {
      console.log(`📊 使用模型: ${model}`);
      console.log(`❓ 问题: ${question}`);
      
      const startTime = Date.now();
      const response = await sendChatMessage(question, model);
      const endTime = Date.now();
      
      console.log(`💬 回答: ${response.choices[0].message.content}`);
      console.log(`⏱️  响应时间: ${endTime - startTime}ms`);
      console.log(`📈 Token 使用: ${response.usage?.total_tokens || 'N/A'}`);
      console.log('\n---\n');
      
    } catch (error) {
      console.error(`模型 ${model} 请求失败:`, error.message);
    }
  }
}

/**
 * 错误处理示例
 */
async function errorHandlingExample() {
  console.log('⚠️  错误处理示例...\n');

  // 测试无效的认证 token
  try {
    const response = await fetch(`${CONFIG.workerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('❌ 预期的认证错误:', errorData);
    }
  } catch (error) {
    console.error('网络错误:', error);
  }

  // 测试无效的请求格式
  try {
    const response = await fetch(`${CONFIG.workerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // 缺少必需的 messages 字段
        model: 'gemini-2.5-flash'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('❌ 预期的请求格式错误:', errorData);
    }
  } catch (error) {
    console.error('请求错误:', error);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Gemini API 代理服务 - 基础使用示例\n');
  console.log('配置信息:');
  console.log(`- Worker URL: ${CONFIG.workerUrl}`);
  console.log(`- Auth Token: ${CONFIG.authToken.substring(0, 10)}...`);
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // 1. 简单对话示例
    console.log('1️⃣ 简单对话示例');
    const response = await sendChatMessage('你好，今天天气怎么样？');
    console.log('✅ 响应:', response.choices[0].message.content);
    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 多轮对话示例
    console.log('2️⃣ 多轮对话示例');
    await multiTurnConversation();
    console.log('='.repeat(50) + '\n');

    // 3. 模型对比示例
    console.log('3️⃣ 模型对比示例');
    await compareModels();
    console.log('='.repeat(50) + '\n');

    // 4. 错误处理示例
    console.log('4️⃣ 错误处理示例');
    await errorHandlingExample();

    console.log('\n✨ 所有示例执行完成！');

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
  sendChatMessage,
  multiTurnConversation,
  compareModels,
  errorHandlingExample
};