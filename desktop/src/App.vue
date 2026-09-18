<template>
  <div class="desktop-workbench">
    <!-- 左侧固定导航侧边栏 (Clash Verge 风格) -->
    <aside class="workbench-sidebar">
      <div class="sidebar-top">
        <!-- 顶部 Brand 品牌 -->
        <div class="sidebar-brand">
          <div class="brand-badge">APK</div>
          <div class="brand-info">
            <span class="brand-title">UniApp Pack</span>
            <span class="brand-sub">离线打包工作台</span>
          </div>
        </div>

        <!-- 导航菜单列表 (日志已整合至打包构建主工作台) -->
        <nav class="sidebar-menu">
          <button
            v-for="item in navTabs"
            :key="item.id"
            :class="['nav-item', { active: currentTab === item.id }]"
            @click="switchTab(item.id)"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.name }}</span>
            <span v-if="item.id === 'workbench' && isBuilding" class="nav-pulse" title="正在打包构建中"></span>
            <span
              v-if="item.id === 'env' && !isEnvAllReady && !isLoadingEnv"
              class="nav-warn-dot"
              title="部分底层环境未就绪"
            ></span>
          </button>
        </nav>
      </div>

      <!-- 侧边栏底部状态 -->
      <div class="sidebar-footer">
        <div class="env-status-pill" @click="switchTab('env')" title="点击查看环境详情">
          <span :class="['status-dot', isEnvAllReady ? 'dot-ok' : 'dot-warn']"></span>
          <span class="status-label">{{ envStatusText }}</span>
        </div>
        <div class="app-version">Desktop v1.0.0</div>
      </div>
    </aside>

    <!-- 右侧主内容区域 -->
    <main class="workbench-main">
      <!-- 顶部 Header -->
      <header class="main-header">
        <div class="header-left">
          <h2 class="module-title">{{ activeTabInfo.name }}</h2>
          <span class="module-desc">{{ activeTabInfo.desc }}</span>
        </div>

        <div class="header-right">
          <!-- 当前工程标识 -->
          <div v-if="packConfig.projectDir" class="project-pill" :title="packConfig.projectDir">
            <span class="pill-icon">📁</span>
            <span class="pill-name">{{ currentProjectName }}</span>
          </div>

          <!-- 打包构建页快捷操作：打开产物目录 -->
          <button
            v-if="currentTab === 'workbench' && packConfig.projectDir"
            class="btn btn-secondary btn-sm"
            @click="onOpenDistDir()"
          >
            <span>📂 打开产物目录</span>
          </button>

          <!-- 环境检测页操作：刷新 -->
          <button
            v-if="currentTab === 'env'"
            class="btn btn-secondary btn-sm"
            :disabled="isLoadingEnv"
            @click="loadEnvData"
          >
            <span v-if="isLoadingEnv" class="spinner"></span>
            <span>🔄 刷新环境</span>
          </button>
        </div>
      </header>

      <!-- 页面主体容器 (v-show 保持已有输入状态与终端日志输出) -->
      <div class="main-body">
        <!-- 1. 底层环境检测 -->
        <section v-show="currentTab === 'env'" class="tab-pane">
          <EnvStatusCard
            :env-data="envData"
            :is-loading="isLoadingEnv"
            @copy="onCopyText"
          />
        </section>

        <!-- 2. 打包构建 + 实时日志 (双列一体化工作台) -->
        <section v-show="currentTab === 'workbench'" class="tab-pane tab-workbench">
          <div class="workbench-grid">
            <!-- 左侧：应用打包参数与操作 -->
            <div class="config-col">
              <PackConfigCard
                v-model="packConfig"
                :icon-preview-url="iconPreviewUrl"
                :has-icon-updated="hasIconUpdated"
                :is-building="isBuilding"
                :is-saving="isSavingConfig"
                :is-browsing="isBrowsingDir"
                :is-verifying-cert="isVerifyingCert"
                @browse-dir="onBrowseDir"
                @switch-project="onSwitchProject"
                @save="onSaveConfig"
                @start-build="onStartBuild"
                @verify-cert="onVerifyCert"
                @reset-cert="onResetCert"
                @select-cert="onSelectCert"
                @upload-icon="onUploadIcon"
                @copy="onCopyText"
              />
            </div>

            <!-- 右侧：实时终端构建流水线日志 -->
            <div class="terminal-col">
              <LogTerminal
                ref="terminalRef"
                :is-building="isBuilding"
                :result-info="buildResult"
                @clear="onClearLogs"
                @copy="onCopyText"
                @open-dir="onOpenDistDir"
              />
            </div>
          </div>
        </section>

        <!-- 3. 配置与环境指南 -->
        <section v-show="currentTab === 'guide'" class="tab-pane">
          <PackGuideCard @copy="onCopyText" />
        </section>
      </div>

      <!-- 轻量 Toast 提示 -->
      <div v-if="toastMessage" class="toast-tip">
        {{ toastMessage }}
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import EnvStatusCard from './components/EnvStatusCard.vue'
import PackConfigCard from './components/PackConfigCard.vue'
import PackGuideCard from './components/PackGuideCard.vue'
import LogTerminal from './components/LogTerminal.vue'
import { pickDirectory, pickCertFile } from '@/utils/fileDialog.js'
import {
  fetchEnvInfo,
  fetchProjectConfig,
  saveProjectConfig,
  getProjectIconApi,
  uploadProjectIconApi,
  importCertApi,
  verifyAndSaveCertApi,
  openDistDirApi,
  startOfflineBuildApi,
  listenBuildLog,
  listenBuildDone
} from '@/api/workbench.js'

// 模块标签定义 (环境检测排在首位，构建与日志为工作台)
const navTabs = [
  { id: 'env', name: '环境检测', icon: '⚡', desc: 'Android SDK 与底层运行依赖完备度' },
  { id: 'workbench', name: '打包构建', icon: '📦', desc: '工程配置与实时构建流水线一体化控制台' },
  { id: 'guide', name: '配置指南', icon: '💡', desc: '官方离线打包规范与配置对照' }
]

const currentTab = ref('env')
const isLoadingEnv = ref(false)
const isBuilding = ref(false)
const isSavingConfig = ref(false)
const isBrowsingDir = ref(false)
const isVerifyingCert = ref(false)
const iconPreviewUrl = ref('')
const hasIconUpdated = ref(false)
const toastMessage = ref('')
let toastTimer = null

const terminalRef = ref(null)

let unlistenLog = null
let unlistenDone = null

const envData = reactive({
  jdk: { ok: false, path: '', version: '' },
  sdk: { ok: false, path: '' },
  shell: { ok: false, path: '' },
  gradle: { ok: false, path: '' },
  aar: { ok: false, files: [] },
  cert: { ok: false, sha1: '' },
  overallOk: false
})

let packConfig = reactive({
  projectDir: '',
  appName: '',
  versionName: '',
  packageName: '',
  appId: '',
  storeFile: 'test.keystore',
  storePassword: '',
  keyAlias: 'test',
  keyPassword: '',
  sha1: '',
  appKey: '',
  apkName: '',
  isDefaultCert: true
})

const buildResult = ref(null)

// 派生状态计算
const activeTabInfo = computed(() => {
  return navTabs.find((tab) => tab.id === currentTab.value) ?? navTabs[0]
})

const isEnvAllReady = computed(() => {
  if (envData.overallOk !== undefined) {
    return Boolean(envData.overallOk)
  }
  return Boolean(
    envData?.jdk?.ok &&
    envData?.sdk?.ok &&
    envData?.shell?.ok &&
    envData?.gradle?.ok &&
    (envData?.aar?.files?.length ?? 0) > 0
  )
})

const envStatusText = computed(() => {
  if (isLoadingEnv.value) return '检测中...'
  return isEnvAllReady.value ? '核心环境就绪' : '部分环境缺失'
})

const currentProjectName = computed(() => {
  if (packConfig.appName) return packConfig.appName
  if (packConfig.projectDir) {
    const parts = packConfig.projectDir.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || packConfig.projectDir
  }
  return '未选择项目'
})

function switchTab(tabId) {
  currentTab.value = tabId
}

function showToast(msg) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2200)
}

async function onCopyText(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      showToast('✅ 已复制到剪贴板')
    } else {
      showToast('⚠️ 剪贴板不可用')
    }
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 原生环境探测
async function loadEnvData() {
  isLoadingEnv.value = true
  try {
    const data = await fetchEnvInfo()
    if (data) {
      envData.jdk = data.jdk ?? { ok: false, path: '', version: '' }
      envData.sdk = data.sdk ?? { ok: false, path: '' }
      envData.shell = data.shell ?? { ok: false, path: '' }
      envData.gradle = data.gradle ?? { ok: false, path: '' }
      envData.aar = data.aar ?? { ok: false, files: [] }
      envData.cert = data.cert ?? { ok: false, sha1: '' }
      envData.overallOk = Boolean(data.overall_ok)
      showToast('✅ 底层环境探测已刷新')
    }
  } catch (error) {
    console.error('获取环境状态失败:', error)
    showToast('⚠️ 获取环境状态失败')
  } finally {
    isLoadingEnv.value = false
  }
}

// 载入应用桌面图标
async function loadIcon(targetDir = '') {
  const dir = (targetDir || packConfig.projectDir || '').trim()
  try {
    const iconData = await getProjectIconApi(dir)
    if (iconData) {
      iconPreviewUrl.value = iconData
    } else {
      iconPreviewUrl.value = ''
    }
  } catch (err) {
    console.error('加载图标失败:', err)
    iconPreviewUrl.value = ''
  }
}

// 更换应用图标
async function onUploadIcon(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    const dataUrl = e.target?.result
    if (!dataUrl) return
    try {
      await uploadProjectIconApi({
        projectDir: packConfig.projectDir,
        dataUrl
      })
      hasIconUpdated.value = true
      setTimeout(() => {
        hasIconUpdated.value = false
      }, 3000)
      await loadIcon(packConfig.projectDir)
      showToast('✅ 应用桌面图标已更新并同步')
    } catch (err) {
      console.error('上传图标异常:', err)
      showToast('⚠️ 上传图标失败')
    }
  }
  reader.readAsDataURL(file)
}

// 载入工程配置
async function loadConfigData(targetDir = '') {
  try {
    const pDir = (targetDir || packConfig.projectDir || '').trim()
    const data = await fetchProjectConfig(pDir)
    if (data) {
      if (data.project_dir) {
        packConfig.projectDir = data.project_dir
        localStorage.setItem('uni_pack_project_dir', data.project_dir)
      }
      packConfig.appName = data.app_name ?? ''
      packConfig.versionName = data.version_name ?? ''
      packConfig.packageName = data.package_name ?? ''
      packConfig.appId = data.app_id ?? ''
      packConfig.appKey = data.app_key ?? ''
      packConfig.apkName = data.apk_name ?? ''
      packConfig.storeFile = data.store_file ?? 'test.keystore'
      packConfig.storePassword = data.store_password ?? ''
      packConfig.keyAlias = data.key_alias ?? 'test'
      packConfig.keyPassword = data.key_password ?? ''
      packConfig.sha1 = data.sha1 ?? ''
      packConfig.isDefaultCert = Boolean(data.is_default_cert)
    }

    await loadIcon(packConfig.projectDir)
  } catch (err) {
    console.error('载入工程配置失败:', err)
  }
}

// 原生目录选择
async function onBrowseDir() {
  isBrowsingDir.value = true
  try {
    const dir = await pickDirectory(packConfig.projectDir)
    if (dir) {
      packConfig.projectDir = dir
      await loadConfigData(dir)
      showToast('✅ 已切换至新工程')
    }
  } catch (err) {
    showToast(`⚠️ 唤起选择器失败: ${err?.message ?? '未知错误'}`)
  } finally {
    isBrowsingDir.value = false
  }
}

// 手动输入路径切换
async function onSwitchProject(dir) {
  if (!dir) return
  await loadConfigData(dir)
}

// 保存配置
async function onSaveConfig() {
  isSavingConfig.value = true
  try {
    await saveProjectConfig({
      project_dir: packConfig.projectDir,
      app_name: packConfig.appName,
      version_name: packConfig.versionName,
      package_name: packConfig.packageName,
      app_id: packConfig.appId,
      store_file: packConfig.storeFile,
      store_password: packConfig.storePassword,
      key_alias: packConfig.keyAlias,
      key_password: packConfig.keyPassword,
      sha1: packConfig.sha1,
      app_key: packConfig.appKey,
      apk_name: packConfig.apkName,
      is_default_cert: packConfig.isDefaultCert,
      is_uni_app: true
    })
    showToast('💾 打包配置已成功保存')
  } catch (err) {
    showToast('❌ 保存配置失败')
  } finally {
    isSavingConfig.value = false
  }
}

// 恢复默认测试证书
async function onResetCert() {
  packConfig.storeFile = 'test.keystore'
  packConfig.storePassword = '123456'
  packConfig.keyAlias = 'test'
  packConfig.keyPassword = '123456'
  packConfig.sha1 = '7A:D3:2F:5C:8B:4E:9A:1D:6F:2C:5E:8A:4D:7B:1C:3E:9F:6A:2D:5C'
  packConfig.isDefaultCert = true
  await onSaveConfig()
  showToast('🔄 已恢复为默认调试证书 (test.keystore)')
}

// 选择并导入自定义证书
async function onSelectCert() {
  try {
    const filePath = await pickCertFile()
    if (!filePath) return
    const fileName = await importCertApi({
      filePath,
      projectDir: packConfig.projectDir
    })
    packConfig.storeFile = fileName
    packConfig.isDefaultCert = false
    showToast(`✅ 已选择并导入证书: ${fileName}`)
  } catch (err) {
    console.error('选择证书异常:', err)
    showToast(`❌ 选择证书失败: ${err?.message ?? '未知错误'}`)
  }
}

// 校验证书密码与别名
async function onVerifyCert() {
  if (isVerifyingCert.value) return
  if (!packConfig.storePassword?.trim()) {
    return showToast('⚠️ 请输入证书密码 (Store Password)')
  }
  if (!packConfig.keyAlias?.trim()) {
    return showToast('⚠️ 请输入证书别名 (Key Alias)')
  }

  isVerifyingCert.value = true
  try {
    const res = await verifyAndSaveCertApi({
      storeFile: packConfig.storeFile,
      storePassword: packConfig.storePassword.trim(),
      keyAlias: packConfig.keyAlias.trim(),
      projectDir: packConfig.projectDir
    })
    if (res?.success) {
      packConfig.sha1 = res.sha1
      await onSaveConfig()
      showToast('✅ 证书密码与别名校验通过！真实 SHA1 已提取生效')
    } else {
      showToast(`❌ 证书校验失败: ${res?.error || '密码或别名可能不正确'}`)
    }
  } catch (err) {
    console.error('校验证书异常:', err)
    showToast('❌ 校验证书失败，请检查控制台')
  } finally {
    isVerifyingCert.value = false
  }
}

function onClearLogs() {
  terminalRef.value?.clearLog()
  buildResult.value = null
}

// 打开产物目录
async function onOpenDistDir(customPath = '') {
  try {
    let targetDir = customPath
    if (!targetDir) {
      targetDir = packConfig.projectDir ? `${packConfig.projectDir}\\dist` : ''
    } else if (targetDir.toLowerCase().endsWith('.apk')) {
      const lastSlash = Math.max(targetDir.lastIndexOf('/'), targetDir.lastIndexOf('\\'))
      if (lastSlash > 0) {
        targetDir = targetDir.slice(0, lastSlash)
      }
    }
    if (targetDir) {
      await openDistDirApi(targetDir)
    }
  } catch (err) {
    console.error('打开目录异常:', err)
  }
}

// 启动离线打包流水线
async function onStartBuild() {
  if (isBuilding.value) return
  isBuilding.value = true
  buildResult.value = null

  terminalRef.value?.clearLog()
  terminalRef.value?.appendLog('🚀 启动本地纯原生离线打包流水线...\n', 'info')

  try {
    await onSaveConfig()
    await startOfflineBuildApi({
      project_dir: packConfig.projectDir,
      app_name: packConfig.appName,
      apk_name: packConfig.apkName || null,
      package_name: packConfig.packageName,
      app_id: packConfig.appId,
      app_key: packConfig.appKey
    })
  } catch (err) {
    isBuilding.value = false
    const errMsg = err?.message ?? String(err)
    terminalRef.value?.appendLog(`❌ 启动构建流水线失败: ${errMsg}\n`, 'err')
  }
}

onMounted(async () => {
  const cachedDir = localStorage.getItem('uni_pack_project_dir') ?? ''
  await loadEnvData()
  await loadConfigData(cachedDir)

  unlistenLog = await listenBuildLog((payload) => {
    if (payload?.text) {
      terminalRef.value?.appendLog(payload.text, payload.type ?? 'normal')
    }
  })

  unlistenDone = await listenBuildDone((payload) => {
    isBuilding.value = false
    if (payload?.success) {
      buildResult.value = {
        isSuccess: true,
        message: `🎉 打包成功！产物已输出至: ${payload.apk_path}`
      }
    } else {
      buildResult.value = {
        isSuccess: false,
        message: `❌ 打包失败: ${payload?.message ?? '请检查日志'}`
      }
    }
  })
})

onUnmounted(() => {
  unlistenLog?.()
  unlistenDone?.()
})
</script>

<style lang="scss" scoped>
.desktop-workbench {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);

  // 1. 左侧固定侧边栏
  .workbench-sidebar {
    width: 220px;
    flex-shrink: 0;
    height: 100vh;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px 12px;

    .sidebar-top {
      display: flex;
      flex-direction: column;
      gap: 20px;

      .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;

        .brand-badge {
          background: linear-gradient(135deg, #1f6feb, #238636);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(31, 111, 235, 0.35);
        }

        .brand-info {
          display: flex;
          flex-direction: column;

          .brand-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-bright);
            letter-spacing: 0.3px;
          }

          .brand-sub {
            font-size: 11px;
            color: var(--text-muted);
          }
        }
      }

      .sidebar-menu {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;

          .nav-icon {
            font-size: 16px;
            line-height: 1;
          }

          .nav-label {
            flex: 1;
          }

          &:hover {
            background: var(--sidebar-hover);
            color: var(--text-bright);
          }

          &.active {
            background: var(--sidebar-active-bg);
            color: var(--sidebar-active-text);
            font-weight: 600;
            border-color: rgba(46, 160, 67, 0.3);

            &::before {
              content: '';
              position: absolute;
              left: 0;
              top: 8px;
              bottom: 8px;
              width: 3px;
              border-radius: 2px;
              background: var(--primary);
            }
          }

          .nav-pulse {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--warning);
            box-shadow: 0 0 0 0 rgba(210, 153, 34, 0.7);
            animation: pulse 1.6s infinite;
          }

          .nav-warn-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--danger);
          }
        }
      }
    }

    .sidebar-footer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid var(--sidebar-border);

      .env-status-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--card-border);
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.07);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;

          &.dot-ok {
            background: #3fb950;
            box-shadow: 0 0 6px rgba(63, 185, 80, 0.6);
          }

          &.dot-warn {
            background: #f85149;
            box-shadow: 0 0 6px rgba(248, 81, 73, 0.6);
          }
        }

        .status-label {
          font-size: 11px;
          color: var(--text-muted);
        }
      }

      .app-version {
        font-size: 11px;
        color: var(--text-muted);
        text-align: center;
      }
    }
  }

  // 2. 右侧主内容区域
  .workbench-main {
    flex: 1;
    min-width: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;

    .main-header {
      height: 56px;
      flex-shrink: 0;
      border-bottom: 1px solid var(--card-border);
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--card-bg);

      .header-left {
        display: flex;
        align-items: baseline;
        gap: 12px;

        .module-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-bright);
        }

        .module-desc {
          font-size: 12px;
          color: var(--text-muted);
        }
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 12px;

        .project-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          font-size: 12px;
          color: var(--text-bright);
          max-width: 280px;

          .pill-icon {
            font-size: 13px;
          }

          .pill-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }

    .main-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;

      .tab-pane {
        max-width: 1280px;
        margin: 0 auto;

        &.tab-workbench {
          max-width: 100%;

          .workbench-grid {
            display: grid;
            grid-template-columns: minmax(440px, 500px) 1fr;
            gap: 16px;
            align-items: start;

            @media (max-width: 1100px) {
              grid-template-columns: 1fr;
            }
          }
        }
      }
    }

    .toast-tip {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(22, 27, 34, 0.95);
      color: #fff;
      border: 1px solid var(--card-border);
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      pointer-events: none;
      z-index: 9999;
    }
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(210, 153, 34, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(210, 153, 34, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(210, 153, 34, 0);
  }
}
</style>
