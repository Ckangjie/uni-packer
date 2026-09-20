# uni-app 离线打包工作台 (UniApp Pack Desktop)

包含桌面端与后续预留后端服务。

## 目录结构

```text
uniapp-pack-desktop/
├── electron/        # Electron 主进程与预加载脚本
├── src/             # Vue 3 前端渲染进程
├── index.html       # 入口页面
└── package.json
```

## 开发与运行

```powershell
# 安装依赖
pnpm i

# 启动前端渲染进程服务
pnpm dev

# 启动 Electron 桌面端
pnpm electron:dev
```

## 常见问题

### Electron 安装失败或缺少可执行文件

在 pnpm 10+ 下默认会忽略依赖的 postinstall 脚本，若运行 `pnpm electron:dev` 提示 `Electron failed to install correctly`，执行以下命令重新触发安装：

```powershell
pnpm rebuild electron
```

如遇网络下载缓慢或超时，可配置国内镜像后重试：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
pnpm rebuild electron
```
