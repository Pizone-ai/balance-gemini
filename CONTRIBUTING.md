# 贡献指南

感谢您对 Gemini API 智能冷却负载均衡代理项目的关注！我们欢迎各种形式的贡献。

## 🤝 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请：

1. 检查 [Issues](https://github.com/Pizone-ai/balance-gemini/issues) 确认问题未被报告
2. 使用相应的 Issue 模板创建新的 Issue
3. 提供详细的问题描述和复现步骤

### 提交代码

1. **Fork 项目**
   ```bash
   git clone https://github.com/Pizone-ai/balance-gemini.git
   cd balance-gemini
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **进行开发**
   - 遵循现有的代码风格
   - 添加必要的测试
   - 更新相关文档

4. **测试您的更改**
   ```bash
   npm test
   npm run test:load
   ```

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   ```

6. **推送到您的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 使用 PR 模板
   - 详细描述您的更改
   - 链接相关的 Issues

## 📝 代码规范

### 提交信息格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**类型说明：**
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例：**
```
feat(auth): 添加多因素认证支持

- 实现 TOTP 验证
- 添加备用恢复码
- 更新认证流程文档

Closes #123
```

### 代码风格

- 使用 2 个空格缩进
- 使用分号结尾
- 函数和变量使用驼峰命名
- 常量使用大写下划线命名
- 添加适当的注释，特别是复杂逻辑

### 文档要求

- 所有新功能必须包含文档
- API 变更需要更新 README.md
- 重大变更需要更新 DEPLOYMENT_GUIDE.md

## 🧪 测试指南

### 运行测试

```bash
# 运行基础 API 测试
npm test

# 运行负载测试
npm run test:load

# 本地开发测试
npm run dev
```

### 测试覆盖

- 新功能必须包含相应的测试
- 修复 bug 时应添加回归测试
- 保持测试覆盖率在 80% 以上

### 测试环境

测试前请确保：
1. 配置了有效的测试环境变量
2. 网络连接正常
3. 有足够的 API 配额

## 🔧 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- npm 或 yarn
- Cloudflare 账户
- 有效的 Gemini API keys

### 本地开发

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入您的配置
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **运行测试**
   ```bash
   npm test
   ```

### 调试技巧

- 使用 `console.log` 进行调试
- 查看 Cloudflare Workers 日志：`npm run logs`
- 使用 `/v1/status` 端点监控服务状态

## 📋 Pull Request 检查清单

提交 PR 前请确认：

- [ ] 代码遵循项目的编码规范
- [ ] 添加了必要的测试并通过
- [ ] 更新了相关文档
- [ ] 提交信息符合规范
- [ ] 没有引入破坏性变更（如有，请在 PR 中说明）
- [ ] 通过了所有 CI 检查

## 🏷️ 版本发布

### 版本号规则

遵循 [Semantic Versioning](https://semver.org/)：

- **MAJOR**: 不兼容的 API 变更
- **MINOR**: 向后兼容的功能新增
- **PATCH**: 向后兼容的问题修正

### 发布流程

1. 更新 `package.json` 中的版本号
2. 更新 `CHANGELOG.md`
3. 创建 release tag
4. 部署到生产环境

## 🎯 优先级功能

当前我们特别欢迎以下方面的贡献：

- **性能优化**: 减少延迟和内存使用
- **监控增强**: 更详细的指标和告警
- **安全加固**: 安全漏洞修复和增强
- **文档完善**: 使用示例和最佳实践
- **测试覆盖**: 边缘情况和集成测试

## 📞 获取帮助

如果您在贡献过程中遇到问题：

1. 查看现有的 [Issues](https://github.com/yourusername/gemini-api-proxy/issues)
2. 查阅 [文档](./docs/)
3. 在 [Discussions](https://github.com/yourusername/gemini-api-proxy/discussions) 中提问

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！您的贡献让这个项目变得更好。

---

**记住：好的代码是写给人看的，机器只是恰好能执行而已。** 💻✨