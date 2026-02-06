# Mox 服务 API 文档

## 概览

Core 服务端基于 Express 提供 `/api` 前缀的 REST 与 SSE 接口，默认端口为 `5177`。主要用于 AI 对话、模型/技能列表、设置读写与消息持久化。

## 基础信息

- 基础路径：`/api`
- 默认端口：`5177`
- 请求体：`application/json`，最大 2MB
- CORS：允许 `*`，支持 `GET,PUT,POST,DELETE,OPTIONS`

## 鉴权

当前 API 未实现鉴权逻辑，所有接口可直接访问。

## 数据结构

### AiSettings

```json
{
  "mode": "warehouse | api",
  "boxName": "string",
  "api": {
    "baseUrl": "string",
    "urlPath": "string",
    "apiKey": "string",
    "model": "string"
  },
  "warehouse": {
    "urlTemplate": "string",
    "urlPath": "string",
    "apiKey": "string",
    "model": "string"
  }
}
```

### ChatMessage

```json
{
  "id": "string",
  "role": "system | user | assistant",
  "content": "string",
  "think": "string",
  "toolSteps": [
    {
      "id": "string",
      "kind": "step | tool",
      "name": "string",
      "status": "info | running | done | error",
      "args": "string",
      "output": "string",
      "createdAt": 0
    }
  ],
  "createdAt": 0,
  "error": true
}
```

### SkillInfo

```json
{
  "name": "string",
  "description": "string",
  "homepage": "string",
  "metadata": {},
  "dir": "string"
}
```

## 接口列表

### GET /api/ai/settings

获取 AI 设置。

响应示例：

```json
{
  "mode": "warehouse",
  "boxName": "",
  "api": {
    "baseUrl": "",
    "urlPath": "/v1/chat/completions",
    "apiKey": "",
    "model": ""
  },
  "warehouse": {
    "urlTemplate": "https://ollama-ai.BOXNAME.heiyu.space",
    "urlPath": "/v1/chat/completions",
    "apiKey": "",
    "model": ""
  }
}
```

### PUT /api/ai/settings

保存 AI 设置（部分更新，后端会与默认值合并）。

请求示例：

```json
{
  "mode": "api",
  "api": {
    "baseUrl": "https://api.openai.com",
    "urlPath": "/v1/chat/completions",
    "apiKey": "Bearer xxx",
    "model": "gpt-4.1-mini"
  }
}
```

响应示例：返回合并后的完整 `AiSettings`。

### GET /api/ai/messages

获取历史消息列表。

响应示例：

```json
[
  {
    "id": "1730000000000-abc",
    "role": "user",
    "content": "你好",
    "createdAt": 1730000000000
  }
]
```

### PUT /api/ai/messages

覆盖写入消息列表。

请求示例：

```json
[
  {
    "id": "1730000000000-abc",
    "role": "user",
    "content": "你好",
    "createdAt": 1730000000000
  }
]
```

响应示例：返回保存后的消息列表。

### DELETE /api/ai/messages

清空消息列表。

响应示例：

```json
{ "ok": true }
```

### GET /api/ai/models

根据当前设置查询可用模型列表。

响应示例：

```json
["gpt-4.1-mini", "gpt-4.1"]
```

失败响应：

```json
{ "error": "获取失败" }
```

### GET /api/ai/skills

读取 `skills` 目录下的技能信息列表。

响应示例：

```json
[
  {
    "name": "system-browser",
    "description": "xxx",
    "homepage": "",
    "metadata": {},
    "dir": "/path/to/skills/system-browser"
  }
]
```

### POST /api/ai/chat

触发一次 AI 对话。支持普通 JSON 响应与 SSE 流式输出。

请求体字段：

- `text`：对话内容（推荐）
- `content`：对话内容（兼容字段）

请求示例：

```json
{
  "text": "帮我分析一下这个问题"
}
```

#### 普通 JSON 模式

默认返回结构：

```json
{
  "messages": [
    {
      "id": "1730000000000-abc",
      "role": "user",
      "content": "帮我分析一下这个问题",
      "createdAt": 1730000000000
    },
    {
      "id": "1730000000001-def",
      "role": "assistant",
      "content": "好的，这是分析结果",
      "think": "",
      "toolSteps": [],
      "createdAt": 1730000000001
    }
  ]
}
```

失败响应（HTTP 400/500）：

```json
{
  "error": "未配置模型",
  "messages": []
}
```

#### SSE 流式模式

启用方式：

- 查询参数：`?stream=1`
- 或请求头：`Accept: text/event-stream`

返回事件类型（`data:` 行内 JSON）：

- `{"type":"delta","delta":"..."}`：增量内容
- `{"type":"step","message":"..."}`：工具运行过程信息
- `{"type":"tool_start","id":"...","name":"...","args":{}}`
- `{"type":"tool_end","id":"...","name":"...","output":"..."}`
- `{"type":"tool_error","id":"...","name":"...","output":"..."}`
- `{"type":"done","messages":[...]}`：最终消息列表
- `data: [DONE]`：结束标记

当发生错误时，会返回：

```json
{"type":"error","error":"请求失败","messages":[...]}
```

### 常见错误

- 400：未配置模型 / 未配置 API 基础地址 / 未配置 BoxName / 请输入消息内容
- 500：模型列表拉取失败 / 工具调用或对话请求失败

## 调用示例

```bash
curl -X GET http://localhost:5177/api/ai/settings
```

```bash
curl -X POST http://localhost:5177/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"你好"}'
```

```bash
curl -N http://localhost:5177/api/ai/chat?stream=1 \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"text":"流式对话测试"}'
```
