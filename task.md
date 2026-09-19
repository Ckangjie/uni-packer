# 任务清单：打包工具优化（工程切换重置、移除生成证书、别名默认AppID）

- [x] 1. 方案头脑风暴与设计对齐 (Brainstorming & Design)
  - [x] 分析工程切换时包名比对与重置规则
  - [x] 分析打包前必填项校验规则 (AppKey、完整证书信息)
  - [x] 分析‘生成证书’功能各层移除范围 (UI / API / 主进程)
  - [x] 分析证书别名默认回填 uniAPPID 规则
  - [x] 编写并获得用户确认实施计划 (implementation_plan.md)
- [x] 2. 改造工程加载与切换重置机制 (`App.vue` & `main.js`)
  - [x] 切换工程时，新旧包名不一致则重置证书信息与 appKey
  - [x] 证书别名默认填充当前项目的 uni-app AppID
  - [x] 强化打包必填项拦截（AppKey、证书文件、证书密码、别名密码、SHA1）
  - [x] 联动 `canBuild` 响应式全项校验
- [x] 3. 移除“生成证书”功能
  - [x] `PackConfigCard.vue` 移除生成证书按钮、弹窗及相关引用
  - [x] `App.vue` 移除生成证书处理逻辑与状态
  - [x] `workbench.js` / `main.js` 清理未使用的生成证书接口
- [x] 4. 自查自检与验证
  - [x] 语法校验与编译检查（node check + vite build 通过）
  - [x] 验证工程切换重置逻辑
  - [x] 验证打包必填项拦截与默认别名行为
- [x] 5. 应用包名多级提取与只读/可编辑控制
  - [x] 强化 `main.js` 多层级与正则容错提取 `manifest.json` 中的 Android 包名
  - [x] 探测 `unpackage` 目录下打包导出的 `manifest.json` 兜底提取包名
  - [x] 主进程返回 `is_package_extracted` 标记
  - [x] 前端 UI：提取到则包名输入框只读并展示 `已提取 (只读)`；提取不到则可编辑并展示 `未提取 (可编辑)`
  - [x] 编译与自查验证通过
- [x] 6. 环境检测移除证书项 & uni App ID 直接作为证书别名 (方案A)
  - [x] `EnvStatusCard.vue` 移除“签名证书 SHA1”条目及相关计算属性
  - [x] `App.vue` 环境就绪判定与环境数据清理证书依赖
  - [x] `App.vue` & `main.js` 将提取到的 uni App ID 直接赋值为证书别名 `keyAlias`
  - [x] 自查自检与构建验证通过
- [x] 7. 上传证书后输入密码全自动填充别名、别名密码与 SHA1
  - [x] 主进程 `verify_cert`：只要密码正确优先使用证书内部 Entry 真实别名，并同步别名密码
  - [x] `App.vue`：校验成功自动回填别名、密码与 SHA1 并静默保存
  - [x] `PackConfigCard.vue`：输入密码失焦或回车后立即全自动触发提取并填充
  - [x] 自查自检与构建验证通过
- [x] 8. 修复打包按钮置灰不可点击与 Vue 3 响应式断裂问题
  - [x] `LogTerminal.vue`：移除按钮的 `!canBuild` 禁用限制，改为未构建时始终可点并点击触发精准校验反馈
  - [x] `App.vue`：修复 `<PackConfigCard>` 的 `v-model` 导致 `reactive` 对象被覆盖丢失响应式的缺陷
  - [x] `App.vue`：优化 `canBuild` 与 `onStartBuild`，支持别名密码自动回退为证书密码
  - [x] 自查自检与构建验证通过
- [x] 9. 实现按包名缓存与自动回显配置 (方案A)
  - [x] 主进程：实现 `package-cache.json` 读取与写入函数
  - [x] 主进程：`save_project_config` 保存时同步持久化当前包名配置
  - [x] 主进程：`get_project_config` 提取到包名后，优先从包名缓存中回显配置
  - [x] 前端：`App.vue` 优化切换项目时的回显与重置逻辑
  - [x] 自查自检与构建验证通过
- [x] 10. 移除“跳过前端构建”选项，每次执行重新构建
  - [x] `PackConfigCard.vue`：移除跳过前端构建相关 UI 与样式
  - [x] `App.vue`：移除 `skipFeBuild` 状态与参数传递
  - [x] `main.js`：移除 `skip_fe_build` 逻辑，确保构建流水线每次重新构建
  - [x] 自查自检与构建验证通过
- [x] 11. 移除 cert-secrets.json 与 pack-config.json，统一使用 signing-config.json
  - [x] `main.js`：移除 `SECRETS_FILE` 及 `saveKnownPassword`，嗅探密码统一使用内置常用池及现有配置
  - [x] `main.js`：移除全局 `PACK_CONFIG_FILE` 读写，签名信息统一读写 `SIGNING_CONFIG_FILE`
  - [x] 磁盘清理：删除 `config/cert-secrets.json` 和 `config/pack-config.json`
  - [x] 自查自检与构建验证通过
- [x] 12. 工程目录结构调整与备份机制移除
  - [x] 移动 `config/` 与 `docs/` 到 `src/`
  - [x] 删除 `backups/` 目录并移除主进程中所有备份文件生成逻辑
  - [x] 平铺 `desktop/` 内部文件到工程根目录并删除 `desktop/`
  - [x] 修正 `main.js` 中的工作区路径 `WORKSPACE_DIR` 与配置路径 `CONFIG_DIR`
  - [x] 修正 `package.json` 中的 `pack:exe` 脚本
  - [x] 自查自检与构建验证通过





