@echo off
chcp 65001 >nul
cd /d "%~dp0desktop"

echo 🚀 正在启动 uni-app 离线打包工作台 (Electron)...
start "" npx electron .
