# uni-app 多类型工程全自适应打包架构设计规范

## 1. 背景与目标

当前 `uni-pack-desktop` 在进行 Android 离线打包的第一步（构建前端离线资源）时，硬编码执行 `npm run build:app-plus`。当遇到 HBuilderX 标准可视化工程、缺失该 scripts 命令的 CLI 项目或直接导出的离线资源目录时，会导致打包流水线在 Step 1 抛错中断。

本设计的目标是实现**全场景自适应前端构建与资源获取策略**，支持：
1. **各类 CLI 工程**（Vue 2 Webpack / Vue 3 Vite，各种 scripts 命名）。
2. **HBuilderX 可视化工程**（无命令行 scripts，依赖 HBuilderX 发行产物）。
3. **已生成离线资源项目 / 纯资源目录**（直接复用离线资源，无需二次编译）。
4. **HBuilderX CLI 自动唤起**（本机环境具备 HBuilderX 时自动执行静默导出）。
5. **用户主动控制**（在客户端支持一键开启“跳过前端构建，复用已有离线资源”）。

---

## 2. 架构设计与流程

### 2.1 四级降级决策引擎 (`determineBuildStrategy`)

流水线 Step 1 执行时，将通过策略引擎判定当前项目的构建模式：

```
[开始构建 Step 1]
       │
       ▼
[检查：用户是否勾选"跳过前端构建"？] ──(是)──> [查找已有离线资源] ──(找到)──> 【模式：SKIP_BUILD (复用离线资源)】
       │ (否)                                          │ (未找到)
       ▼                                               └─────────> 【报错：未找到可复用的离线资源】
[检查：package.json 是否含 App 构建 scripts？]
       │ 优先级: build:app-plus > build:app > build:app-android > build
       │ (命中任意一个)
       ├─────────────────────────────────────────> 【模式：CLI_BUILD (执行对应包管理命令)】
       │ (未命中任何命令)
       ▼
[检查：项目是否已存在预生成离线资源？]
       │ (命中 unpackage/resources/${appid}/www 等)
       ├─────────────────────────────────────────> 【模式：AUTO_SKIP_BUILD (检测到资源，自动复用)】
       │ (不存在已有资源)
       ▼
[检查：是否安装 HBuilderX CLI？]
       │ (探测到本机 cli.exe)
       ├─────────────────────────────────────────> 【模式：HBUILDERX_CLI (执行 cli.exe publish)】
       │ (未找到 HBuilderX)
       ▼
【报错拦截并输出友好指引】
```

---

## 3. 核心模块与实现细节

### 3.1 离线资源多路径探测器 (`findSourceDist(projectDir, appid)`)
支持以下探测候选路径（按优先级）：
1. `${projectDir}/unpackage/resources/${appid}/www`（HBuilderX 标准本地打包产物）
2. `${projectDir}/dist/build/app-plus`（vue-cli / uni-app 默认输出目录）
3. `${projectDir}/dist/build/app`（vite-cli 常见输出目录）
4. `${projectDir}/dist/build/app-android`
5. `${projectDir}/unpackage/dist/build/app-plus`
6. `${projectDir}/unpackage/dist/build/app`
7. `${projectDir}/www`（直接解压的离线资源包目录）
8. 若 `${projectDir}` 根目录下直接包含 `manifest.json` 与 `index.html`，则认定工程本身即为离线资源目录。

### 3.2 脚本智能嗅探器 (`detectCliBuildScript(projectDir)`)
1. 读取 `package.json` 中的 `scripts` 字段。
2. 依次按优先级匹配下列命令：
   - `build:app-plus`
   - `build:app-android`
   - `build:app`
   - `build`
3. 结合 lockfile（`pnpm-lock.yaml` -> `pnpm.cmd`，`yarn.lock` -> `yarn.cmd`，否则 -> `npm.cmd run`）生成可执行指令。

### 3.3 HBuilderX CLI 嗅探器 (`findHBuilderXCli()`)
1. 支持从系统环境变量 `HBUILDERX_CLI` 或 PATH 中读取。
2. 检索 Windows 常见安装路径：
   - `C:\Program Files\HBuilderX\cli.exe`
   - `C:\Program Files (x86)\HBuilderX\cli.exe`
   - `D:\HBuilderX\cli.exe`
   - `E:\HBuilderX\cli.exe`
   - `D:\Program Files\HBuilderX\cli.exe`
3. 执行参数：
   ```bash
   cli.exe publish --platform APP --type appResource --project "${projectDir}"
   ```

### 3.4 客户端 UI 与交互 (`desktop/src/components/PackConfigCard.vue`)
1. 在打包配置卡片增加【跳过前端构建】Switch/Checkbox，并在鼠标悬浮时提供 Tooltip 提示“直接复用 unpackage/resources 等已有离线资源，跳过 npm/cli 编译”。
2. 打包发起时，将 `skip_fe_build` 状态传递给 Electron 主进程。

---

## 4. 异常处理与友好提示

| 场景 | 处理方式 | 日志输出 |
| :--- | :--- | :--- |
| 用户勾选跳过构建，但无离线资源 | 中断流水线 | ❌ 启用了跳过前端构建，但未在项目中找到任何已有离线资源目录。 |
| 自动命中已有离线资源 | 跳过编译并复用 | 💡 未配置 npm 离线打包脚本，但检测到 HBuilderX 离线资源: ...，已自动复用。 |
| 自动唤起 HBuilderX CLI | 执行静默编译并流式输出 | 🔨 调用本机 HBuilderX CLI 执行离线资源导出... |
| 均未命中且无 HBuilderX | 友好中断并提供操作步骤 | ❌ 无法完成前端资源准备。请在 HBuilderX 中点击【发行】->【原生App-本地打包】->【生成本地打包App资源】，或在 package.json 中配置 build:app 脚本。 |

---

## 5. 验证与自查规范

1. **语法与类型检查**：无未使用变量、正确的 promise/async 流程、Windows 路径安全包裹引号。
2. **现有功能兼容**：原有基于 npm/pnpm/yarn 的 CLI 项目打包不受任何破坏。
3. **离线资源复用测试**：对仅有 `unpackage/resources/${appid}/www` 的标准 HBuilderX 项目测试跳过构建与成功打包。
