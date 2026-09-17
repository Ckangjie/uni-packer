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
      <div class="title-actions">
        <button class="btn btn-secondary btn-sm" :disabled="!hasLogs" @click="handleClear">
          🗑️ 清空
        </button>
        <button class="btn btn-secondary btn-sm" :disabled="!hasLogs" @click="handleCopyAll">
          📋 复制全部
        </button>
      </div>
    </div>

    <!-- 结果横幅 -->
    <div v-if="resultInfo" :class="['result-banner', resultInfo.isSuccess ? 'success' : 'error']">
      <div class="result-text">
        <span class="result-icon">{{ resultInfo.isSuccess ? '🎉' : '❌' }}</span>
        <span class="result-msg">{{ resultInfo.message }}</span>
      </div>
      <div v-if="resultInfo.isSuccess" class="result-actions">
        <a
          v-if="resultInfo.downloadUrl"
          :href="resultInfo.downloadUrl"
          target="_blank"
          class="btn btn-primary btn-sm"
        >
          📥 下载 APK
        </a>
        <button class="btn btn-secondary btn-sm" @click="handleOpenDir">
          📂 打开所在目录
        </button>
      </div>
    </div>

    <!-- 终端视口：使用 ref 容器支持批处理插入 -->
    <div ref="terminalRef" class="terminal-window">
      <div v-if="!hasLogs" class="empty-tip">
        等待任务触发... 选择目标 uni-app 工程后点击「🚀 一键开始离线打包」即可查看实时流水线。
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

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

const emit = defineEmits(['clear', 'copy', 'open-dir'])

const terminalRef = ref(null)
const hasLogs = ref(false)

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
}

function handleClear() {
  clearLog()
  emit('clear')
}

function handleCopyAll() {
  if (!terminalRef.value) return
  const fullText = terminalRef.value.innerText
  if (fullText) emit('copy', fullText)
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
  margin-top: 18px;

  .title-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-actions {
    display: flex;
    gap: 6px;
  }

  .btn-sm {
    font-size: 11px;
    padding: 2px 8px;
    height: 24px;
  }

  .result-banner {
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    gap: 12px;

    &.success {
      background: rgba(46, 160, 67, 0.15);
      border: 1px solid rgba(46, 160, 67, 0.3);
      color: #3fb950;
    }

    &.error {
      background: rgba(248, 81, 73, 0.15);
      border: 1px solid rgba(248, 81, 73, 0.3);
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
      gap: 8px;
      flex-shrink: 0;
    }
  }

  .terminal-window {
    background: var(--code-bg);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 12px 14px;
    min-height: 220px;
    max-height: 380px;
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
}
</style>
