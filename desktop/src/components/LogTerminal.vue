<template>
  <div class="card log-terminal-card">
    <div class="card-title">
      <div class="title-left">
        <span>📋 构建与打包实时日志</span>
        <span v-if="isBuilding" class="badge badge-warn">
          <span class="spinner"></span>
          <span>打包构建中...</span>
        </span>
      </div>
    </div>

    <!-- 终端视口容器 (固定尺寸，绝不影响外层布局) -->
    <div class="terminal-container">
      <!-- 终端视口：使用 ref 容器支持批处理插入 -->
      <div ref="terminalRef" class="terminal-window">
        <div v-if="!hasLogs" class="empty-tip">
          等待任务触发... 选择目标 uni-app 工程后点击「🚀 一键开始离线打包」即可查看实时流水线。
        </div>
      </div>

      <!-- 打包结果横幅：吸附悬浮在构建日志框底部，不影响卡片高度与整体布局 -->
      <transition name="fade-slide">
        <div
          v-if="resultInfo && !isBannerClosed"
          :class="['result-banner', resultInfo.isSuccess ? 'success' : 'error']"
        >
          <div class="result-text">
            <span class="result-icon">{{ resultInfo.isSuccess ? '🎉' : '❌' }}</span>
            <span class="result-msg" :title="resultInfo.message">{{ resultInfo.message }}</span>
          </div>
          <div class="result-actions">
            <a
              v-if="resultInfo.downloadUrl"
              :href="resultInfo.downloadUrl"
              target="_blank"
              class="btn btn-primary btn-sm"
            >
              📥 下载 APK
            </a>
            <button
              v-if="resultInfo.isSuccess"
              class="btn btn-secondary btn-sm"
              @click="handleOpenDir"
            >
              📂 打开所在目录
            </button>
            <button class="btn-close" title="关闭提示" @click="isBannerClosed = true">✕</button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isBuilding: {
    type: Boolean,
    default: false
  },
  resultInfo: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['open-dir'])

const terminalRef = ref(null)
const hasLogs = ref(false)
const isBannerClosed = ref(false)

// 当有新的构建结果时，重置关闭状态，确保横幅展现
watch(
  () => props.resultInfo,
  (newVal) => {
    if (newVal) {
      isBannerClosed.value = false
    }
  }
)

// 高性能日志缓冲机制：每 80ms 或积压 400 条批量刷新一次
let logBuf = []
let logTimer = null

function flushLog() {
  if (logTimer) {
    clearTimeout(logTimer)
    logTimer = null
  }
  if (!logBuf.length || !terminalRef.value) return

  const frag = document.createDocumentFragment()
  for (const item of logBuf) {
    const span = document.createElement('span')
    span.className = `log-line line-${item.type}`
    span.textContent = item.text
    frag.appendChild(span)
  }
  logBuf = []
  terminalRef.value.appendChild(frag)
  terminalRef.value.scrollTop = terminalRef.value.scrollHeight
  hasLogs.value = true
}

function appendLog(text, type = 'normal') {
  logBuf.push({ text, type })
  if (logBuf.length >= 400) {
    flushLog()
    return
  }
  if (!logTimer) {
    logTimer = setTimeout(flushLog, 80)
  }
}

function clearLog() {
  logBuf = []
  if (logTimer) {
    clearTimeout(logTimer)
    logTimer = null
  }
  if (terminalRef.value) {
    terminalRef.value.innerHTML = ''
  }
  hasLogs.value = false
  isBannerClosed.value = false
}

function handleOpenDir() {
  emit('open-dir')
}

defineExpose({
  appendLog,
  clearLog
})
</script>

<style lang="scss" scoped>
.log-terminal-card {
  margin-top: 0;

  .title-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-sm {
    font-size: 11px;
    padding: 3px 10px;
    height: 26px;
  }

  .terminal-container {
    position: relative;
    height: calc(100vh - 210px);
    min-height: 380px;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--code-bg);

    .terminal-window {
      width: 100%;
      height: 100%;
      padding: 12px 14px 56px 14px; // 底部预留 padding 防止长日志被浮动横幅遮挡
      overflow-y: auto;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
      line-height: 1.6;
      user-select: text;

      :deep(.log-line) {
        display: block;
        color: #7ee787;
        white-space: pre-wrap;
        word-break: break-all;

        &.line-err {
          color: #f85149;
        }

        &.line-warn {
          color: #d29922;
        }

        &.line-info {
          color: #58a6ff;
        }
      }

      .empty-tip {
        color: var(--text-muted);
        font-style: italic;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
    }

    .result-banner {
      position: absolute;
      bottom: 10px;
      left: 12px;
      right: 12px;
      z-index: 10;
      padding: 8px 14px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      gap: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(8px);

      &.success {
        background: rgba(22, 38, 27, 0.94);
        border: 1px solid rgba(46, 160, 67, 0.45);
        color: #3fb950;
      }

      &.error {
        background: rgba(43, 20, 22, 0.94);
        border: 1px solid rgba(248, 81, 73, 0.45);
        color: #f85149;
      }

      .result-text {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;

        .result-msg {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .result-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .btn-close {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 2px 6px;
        font-size: 13px;
        line-height: 1;
        border-radius: 4px;
        transition: all 0.2s ease;

        &:hover {
          color: var(--text-bright);
          background: rgba(255, 255, 255, 0.12);
        }
      }
    }
  }

  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .fade-slide-enter-from,
  .fade-slide-leave-to {
    opacity: 0;
    transform: translateY(12px);
  }
}
</style>
