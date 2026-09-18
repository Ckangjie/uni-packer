<template>
  <div class="card env-status-card">
    <div class="card-title">
      <span>🛠️ 底层环境检测</span>
      <span :class="['badge', overallBadgeClass]">{{ overallStatusText }}</span>
    </div>

    <div class="status-list">
      <!-- JDK -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">JDK 运行环境 (需 JDK 17)</div>
          <div class="status-detail" :title="envData?.jdk?.path">
            {{ envData?.jdk?.ok ? envData.jdk.path : (envData?.jdk?.error ?? '未检测到 JDK 17，请安装并配置环境变量') }}
          </div>
        </div>
        <div class="status-actions">
          <button
            v-if="!isJdkReady"
            class="btn-action-xs btn-jdk-download"
            title="通过系统默认浏览器打开华为云高速镜像下载 (.msi 一键安装包)"
            @click="handleDownloadJdk"
          >
            🌐 下载 JDK
          </button>
          <button
            v-if="!isJdkReady"
            class="btn-action-xs btn-action-guide"
            title="查看 JDK 17 安装与环境变量配置图文指引"
            @click="handleViewJdkGuide"
          >
            📖 配置文档
          </button>
          <span :class="['badge', isJdkReady ? 'badge-ok' : 'badge-err']">
            {{ isJdkReady ? (envData?.jdk?.version ? `v${envData.jdk.version}` : '就绪') : '异常' }}
          </span>
        </div>
      </div>

      <!-- Android SDK -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">Android SDK (MVP 打包套件)</div>
          <div class="status-detail" :title="sdkDetailText">
            {{ sdkDetailText }}
          </div>
          <div v-if="isDownloadingSdk" class="progress-bar-wrap">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" :style="{ width: `${sdkDownloadPercent}%` }"></div>
            </div>
          </div>
        </div>
        <div class="status-actions">
          <button
            v-if="!isSdkReady && !isDownloadingSdk"
            class="btn-action-xs"
            @click="handleDownloadSdk"
          >
            ⬇️ 一键补全
          </button>
          <span v-if="isDownloadingSdk" class="status-loading-text">
            {{ sdkDownloadPercent }}%
          </span>
          <span :class="['badge', isSdkReady ? 'badge-ok' : 'badge-err']">
            {{ isSdkReady ? '就绪' : '缺失' }}
          </span>
        </div>
      </div>

      <!-- Android 宿主壳工程 -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">Android 宿主壳工程</div>
          <div class="status-detail" :title="envData?.shell?.path">
            {{ envData?.shell?.ok ? envData.shell.path : '未检测到壳工程目录' }}
          </div>
        </div>
        <span :class="['badge', envData?.shell?.ok ? 'badge-ok' : 'badge-err']">
          {{ envData?.shell?.ok ? '就绪' : '缺失' }}
        </span>
      </div>

      <!-- Gradle 命令行 -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">Gradle 命令行</div>
          <div class="status-detail" :title="gradleDetailText">
            {{ gradleDetailText }}
          </div>
          <div v-if="isDownloadingGradle" class="progress-bar-wrap">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" :style="{ width: `${gradleDownloadPercent}%` }"></div>
            </div>
          </div>
        </div>
        <div class="status-actions">
          <button
            v-if="!isGradleReady && !isDownloadingGradle"
            class="btn-action-xs"
            @click="handleDownloadGradle"
          >
            ⬇️ 一键补全
          </button>
          <span v-if="isDownloadingGradle" class="status-loading-text">
            {{ gradleDownloadPercent }}%
          </span>
          <span :class="['badge', isGradleReady ? 'badge-ok' : 'badge-err']">
            {{ isGradleReady ? (envData?.gradle?.isWrapper ? 'Gradle Wrapper' : '已就绪') : '缺失' }}
          </span>
        </div>
      </div>

      <!-- DCloud 基座核心 AAR -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">DCloud 基座核心 AAR</div>
          <div class="status-detail" :title="aarDetailText">
            {{ aarDetailText }}
          </div>
          <div v-if="isDownloadingAar" class="progress-bar-wrap">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" :style="{ width: `${aarDownloadPercent}%` }"></div>
            </div>
          </div>
        </div>
        <div class="status-actions">
          <button
            v-if="!hasAar && !isDownloadingAar"
            class="btn-action-xs"
            @click="handleDownloadAar"
          >
            ⬇️ 一键补全
          </button>
          <span v-if="isDownloadingAar" class="status-loading-text">
            {{ aarDownloadPercent }}%
          </span>
          <span :class="['badge', hasAar ? 'badge-ok' : 'badge-warn']">
            {{ hasAar ? '已就绪' : '需放 AAR' }}
          </span>
        </div>
      </div>

      <!-- 签名证书 SHA1 -->
      <div class="status-item">
        <div class="status-info">
          <div class="status-label">签名证书 SHA1</div>
          <div class="status-detail">
            <span class="copyable" @click="handleCopy(certSha1)">
              {{ certSha1 || '未生成/未就绪' }}
            </span>
          </div>
        </div>
        <span :class="['badge', isCertReady ? 'badge-ok' : 'badge-warn']">
          {{ isCertReady ? '就绪' : '未就绪' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  downloadAarLibsApi,
  listenAarProgress,
  downloadAndroidSdkApi,
  listenSdkProgress,
  downloadGradleWrapperApi,
  listenGradleProgress,
  openUrlApi
} from '@/api/workbench.js'

const props = defineProps({
  envData: {
    type: Object,
    default: () => ({})
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['copy', 'refresh-env', 'navigate-guide'])

const isDownloadingAar = ref(false)
const aarDownloadPercent = ref(0)
const aarDownloadText = ref('')

const isDownloadingSdk = ref(false)
const sdkDownloadPercent = ref(0)
const sdkDownloadText = ref('')

const isDownloadingGradle = ref(false)
const gradleDownloadPercent = ref(0)
const gradleDownloadText = ref('')

let unlistenAar = null
let unlistenSdk = null
let unlistenGradle = null

const isJdkReady = computed(() => {
  return Boolean(props.envData?.jdk?.ok)
})

const isSdkReady = computed(() => {
  return Boolean(props.envData?.sdk?.ok)
})

const sdkDetailText = computed(() => {
  if (isDownloadingSdk.value && sdkDownloadText.value) {
    return sdkDownloadText.value
  }
  if (isSdkReady.value) {
    return props.envData?.sdk?.path || '已就绪'
  }
  return props.envData?.sdk?.error ?? '未检测到 Android SDK，可一键补全'
})

const isGradleReady = computed(() => {
  return Boolean(props.envData?.gradle?.ok)
})

const gradleDetailText = computed(() => {
  if (isDownloadingGradle.value && gradleDownloadText.value) {
    return gradleDownloadText.value
  }
  if (isGradleReady.value) {
    return props.envData?.gradle?.path || (props.envData?.gradle?.isWrapper ? 'Gradle Wrapper (已就绪)' : '已就绪')
  }
  return props.envData?.gradle?.error ?? '未检测到 Gradle，可一键补全 Wrapper'
})

const aarCount = computed(() => {
  return props.envData?.aar?.files?.length ?? 0
})

const hasAar = computed(() => {
  return Boolean(props.envData?.aar?.ok && aarCount.value > 0)
})

const aarDetailText = computed(() => {
  if (isDownloadingAar.value && aarDownloadText.value) {
    return aarDownloadText.value
  }
  if (hasAar.value) {
    return `已检测到 ${aarCount.value} 个核心库 (app/libs/*.aar)`
  }
  return '⚠️ 缺失核心库，可一键自动补全'
})

const certSha1 = computed(() => {
  return props.envData?.cert?.sha1 ?? ''
})

const isCertReady = computed(() => {
  return Boolean(props.envData?.cert?.ok || props.envData?.cert?.sha1)
})

const isAllReady = computed(() => {
  if (props.envData?.overallOk !== undefined) {
    return Boolean(props.envData.overallOk)
  }
  return Boolean(
    props.envData?.jdk?.ok &&
    isSdkReady.value &&
    props.envData?.shell?.ok &&
    isGradleReady.value &&
    hasAar.value
  )
})

const overallStatusText = computed(() => {
  if (props.isLoading) return '检测中...'
  return isAllReady.value ? '核心环境就绪' : '部分环境缺失'
})

const overallBadgeClass = computed(() => {
  if (props.isLoading) return 'badge-warn'
  return isAllReady.value ? 'badge-ok' : 'badge-err'
})

function handleCopy(text) {
  if (text) emit('copy', text)
}

async function handleDownloadAar() {
  if (isDownloadingAar.value) return
  isDownloadingAar.value = true
  aarDownloadPercent.value = 0
  aarDownloadText.value = '准备下载 DCloud 核心库...'
  try {
    const res = await downloadAarLibsApi()
    if (res?.success) {
      emit('refresh-env')
    } else {
      aarDownloadText.value = res?.error ?? '下载失败'
    }
  } catch (err) {
    aarDownloadText.value = err?.message ?? '下载异常'
  } finally {
    setTimeout(() => {
      isDownloadingAar.value = false
      aarDownloadText.value = ''
    }, 2000)
  }
}

async function handleDownloadSdk() {
  if (isDownloadingSdk.value) return
  isDownloadingSdk.value = true
  sdkDownloadPercent.value = 0
  sdkDownloadText.value = '准备下载 Android SDK 套件...'
  try {
    const res = await downloadAndroidSdkApi()
    if (res?.success) {
      emit('refresh-env')
    } else {
      sdkDownloadText.value = res?.error ?? '下载失败'
    }
  } catch (err) {
    sdkDownloadText.value = err?.message ?? '下载异常'
  } finally {
    setTimeout(() => {
      isDownloadingSdk.value = false
      sdkDownloadText.value = ''
    }, 2000)
  }
}

async function handleDownloadGradle() {
  if (isDownloadingGradle.value) return
  isDownloadingGradle.value = true
  gradleDownloadPercent.value = 0
  gradleDownloadText.value = '准备配置 Gradle 极速环境...'
  try {
    const res = await downloadGradleWrapperApi()
    if (res?.success) {
      emit('refresh-env')
    } else {
      gradleDownloadText.value = res?.error ?? '补全失败'
    }
  } catch (err) {
    gradleDownloadText.value = err?.message ?? '补全异常'
  } finally {
    setTimeout(() => {
      isDownloadingGradle.value = false
      gradleDownloadText.value = ''
    }, 2000)
  }
}

function handleDownloadJdk() {
  openUrlApi('https://mirrors.huaweicloud.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10+7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.msi')
}

function handleViewJdkGuide() {
  emit('navigate-guide', 'jdk')
}

onMounted(async () => {
  try {
    unlistenAar = await listenAarProgress((payload) => {
      if (payload) {
        aarDownloadPercent.value = payload.percent ?? 0
        if (payload.text) aarDownloadText.value = payload.text
      }
    })
    unlistenSdk = await listenSdkProgress((payload) => {
      if (payload) {
        sdkDownloadPercent.value = payload.percent ?? 0
        if (payload.text) sdkDownloadText.value = payload.text
      }
    })
    unlistenGradle = await listenGradleProgress((payload) => {
      if (payload) {
        gradleDownloadPercent.value = payload.percent ?? 0
        if (payload.text) gradleDownloadText.value = payload.text
      }
    })
  } catch (err) {
    console.error('监听下载进度失败:', err)
  }
})

onUnmounted(() => {
  if (typeof unlistenAar === 'function') unlistenAar()
  if (typeof unlistenSdk === 'function') unlistenSdk()
  if (typeof unlistenGradle === 'function') unlistenGradle()
})
</script>

<style lang="scss" scoped>
.env-status-card {
  .status-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 12px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--card-border);
    border-radius: 6px;
    gap: 12px;
  }

  .status-info {
    min-width: 0;
    flex: 1;
  }

  .status-label {
    font-size: 12px;
    color: var(--text-bright);
    font-weight: 500;
  }

  .status-detail {
    font-size: 11px;
    color: var(--text-muted);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }

  .status-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-action-xs {
    padding: 2px 8px;
    font-size: 11px;
    background: #2563eb;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.15s ease;
    white-space: nowrap;

    &:hover {
      background: #1d4ed8;
    }

    &.btn-action-guide {
      background: #21262d;
      color: var(--text-bright);
      border: 1px solid var(--card-border);

      &:hover {
        background: #30363d;
        border-color: #8b949e;
      }
    }
  }

  .status-loading-text {
    font-size: 11px;
    color: var(--primary, #3b82f6);
    font-family: monospace;
    font-weight: 600;
  }

  .progress-bar-wrap {
    margin-top: 4px;
    width: 100%;
  }

  .progress-bar-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.2s ease;
  }
}
</style>
