### MoxCore -LazyCat bot

一个简单的AI Agent，支持懒猫微服算力仓和懒猫应用商店超过3000款应用的庞大API工具池。

### 快速启动

Web UI 安装
```bash
cd ui && pnpm install
```

服务端 安装
```bash
cd core && pnpm install
```

同时启动WebUI和服务端
```bash
cd ui && pnpm dev:all
```

### 默认技能

- 懒猫微服算力仓模式：默认支持懒猫微服算力仓的所有应用，无需额外配置。
- 懒猫应用商店：默认支持懒猫应用商店超过3000款应用的所有API接口，无需额外配置。
- 终端控制：支持终端命令行和对文件和文件夹的读写操作。
- 无头浏览器：默认支持无头浏览器模式，无需额外配置，支持执行联网搜索和网页操作。
- 浏览器控制：支持通过指定路径打开和控制浏览器，执行网页操作。
- ...


### 项目文件夹结构

Core
├── models // 模型管理模块
│   ├── api    //API模式
│   ├── aibox  //算力仓模式
├── skills  //技能模块，兼容openclaw技能商店扩展
├── extensions  //扩展模块，兼容openclaw插件扩展商店扩展
├── server  //服务端模块，负责Agent功能和工具调用等核心逻辑
├── api  //API模块，这里整理所有的API接口
├── tools  //通用工具模块
├── docs  //文档模块
├── ui  //UI模块
│   ├── /src/components/AiChat  //对话模块，负责展示与接收用户输入
│   ├── /src/components/AiModelManager  //模型配置模块，负责展示与配置模型参数
