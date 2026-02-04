<!-- 文件用途：总结AI工具调用与终端使用实现逻辑 -->
# AI 工具调用与终端使用说明

## 目标与原因

本模块的目标是让 AI 在对话过程中具备可控的工具调用能力，并能将工具调用的过程与结果持久化给前端展示。这样做的原因是：
- 让 AI 能在需要时执行终端命令、读取/写入文件、进行浏览器搜索等任务，提高完成复杂任务的能力
- 将工具执行的步骤与结果以结构化事件形式输出，便于 UI 实时展示与追踪
- 在服务端保存工具过程，方便断线重连后继续显示已执行的工具步骤

## 工具调用的实现逻辑

### 1) 工具定义与注册

工具定义在 [agent-tools.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/tools/agent-tools.ts#L1-L160)，每个工具包含：
- name: 工具名称
- description: 工具用途
- parameters: 参数结构
- execute: 工具执行函数

核心工具注册入口：
- `createAgentTools()`：返回工具列表，其中包含终端工具、文件工具与浏览器工具

### 2) 工具调用调度与循环

工具调用调度在 [agent-runner.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/tools/agent-runner.ts#L1-L104) 中实现：
- `openAiCompatibleChatWithTools` 触发模型返回 tool_calls
- 对 tool_calls 逐个执行：解析参数 -> 触发工具 execute -> 生成 tool 角色消息
- 工具执行过程中通过 `emit` 推送步骤事件（step），由后端转发给前端

### 3) API 层与事件流

工具调用的入口与事件输出在 [ai.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/api/ai.ts#L57-L186)：
- `/api/ai/chat` 为对话入口
- SSE 模式下会实时写入 `tool_start/tool_end/tool_error/step` 事件
- 工具事件会被持久化到 `toolSteps`，并写入消息列表用于前端展示

### 4) 工具协议与模型适配

OpenAI 兼容工具调用协议在 [openai.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/tools/openai.ts#L156-L219)：
- 请求中包含 `tools`
- 响应中解析 `tool_calls`
- 将 tool_call 的输出作为 tool 角色消息送回模型

## AI 如何使用终端

终端能力由 [agent-tools.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/tools/agent-tools.ts#L71-L109) 提供：
- 工具名称：`terminal_exec`
- 通过 `execTool` 执行命令，返回 `stdout/stderr`
- 支持自定义工作目录与超时参数

AI 在工具调用循环中选择 `terminal_exec`，并由 `agent-runner` 调度执行：
- 入口：`runAgentWithTools` 解析工具调用
- 执行：调用 `terminal_exec.execute(...)`
- 输出：回填到 tool 消息与步骤事件

关键文件与职责：
- [agent-tools.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/tools/agent-tools.ts#L71-L109)：终端工具实现
- [agent-runner.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/tools/agent-runner.ts#L66-L99)：工具执行与消息回填
- [ai.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/api/ai.ts#L92-L146)：SSE 输出、持久化与前端展示支持

## 持久化与展示逻辑

- 工具步骤存储在 `ChatMessage.toolSteps` 中，保存于本地数据库
- 事件被写入后端消息存储，并通过 SSE 实时通知前端
- 前端展示逻辑在 UI 中与消息绑定，确保工具过程与消息上下文一致

对应实现文件：
- [models/ai.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/models/ai.ts#L1-L128)
- [ai.ts](file:///Users/ponzs/Desktop/lazycat-game-framework/lzc-bot/core/api/ai.ts#L195-L235)

## 终端工具为何如此设计

- 使用 `exec` 简化命令执行流程，避免引入复杂运行环境
- 统一通过工具调用进入，保证执行过程可追踪、可回放
- 通过步骤事件输出执行进度，便于前端实时展示并记录
