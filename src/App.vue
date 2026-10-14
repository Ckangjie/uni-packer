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

        <!-- 导航菜单列表 -->
        <nav class="sidebar-menu">
          <button
            v-for="item in mainNavTabs"
            :key="item.id"
            :class="['nav-item', { active: currentTab === item.id }]"
            @click="switchTab(item.id)"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.name }}</span>
            <span v-if="item.id === 'workbench' && isBuilding" class="nav-pulse" title="正在打包构建中"></span>
            <span
              v-if="item.id === 'env' && hasEnvError"
              class="nav-badge-warn"
            >异常</span>
          </button>
        </nav>
      </div>

      <!-- 侧边栏底部设置按钮 -->
      <div class="sidebar-footer">
        <button
          :class="['nav-item', 'settings-btn', { active: currentTab === 'settings' }]"
          @click="switchTab('settings')"
        >
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">设置</span>
        </button>
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
            @refresh-env="loadEnvData"
            @navigate-guide="onNavigateGuide"
          />
        </section>

        <!-- 2. 打包构建 + 实时日志 (上下垂直分块工作台) -->
        <section v-show="currentTab === 'workbench'" class="tab-pane tab-workbench">
          <div class="workbench-layout">
            <!-- 上方：应用打包配置分块区域 -->
            <div class="config-section">
              <PackConfigCard
                ref="packConfigCardRef"
                :model-value="packConfig"
                :icon-preview-url="iconPreviewUrl"
                :has-icon-updated="hasIconUpdated"
                :is-building="isBuilding"
                :is-saving="isSavingConfig"
                :is-browsing="isBrowsingDir"
                :is-verifying-cert="isVerifyingCert"
                @update:model-value="val => Object.assign(packConfig, val)"
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

            <!-- 下方：实时终端构建流水线日志与底部产物结果展示 (通栏) -->
            <div class="terminal-section">
              <LogTerminal
                ref="terminalRef"
                :is-building="isBuilding"
                :can-build="canBuild"
                :is-uni-app="packConfig.isUniApp"
                @start-build="onStartBuild"
                @clear="onClearLogs"
              />

              <!-- 打包成功/完成结果展示区 -->
              <div
                v-if="buildResult"
                :class="['card', 'build-result-card', buildResult.isSuccess ? 'success' : 'error']"
              >
                <div class="result-info">
                  <span class="result-icon">{{ buildResult.isSuccess ? '🎉' : '❌' }}</span>
                  <div class="result-content">
                    <div class="result-title">{{ buildResult.isSuccess ? '打包成功！产物已就绪' : (buildResult.message || '打包失败') }}</div>
                  </div>
                </div>
                <div v-if="buildResult.isSuccess" class="result-actions">
                  <button class="btn btn-primary btn-sm" @click="onOpenDistDir(buildResult.apkPath)">
                    📂 打开所在目录
                  </button>
                </div>
                <div v-else class="result-actions">
                  <button class="btn btn-secondary btn-sm" @click="onCopyErrorLog">
                    📋 复制错误日志
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. 配置与环境指南 -->
        <section v-show="currentTab === 'guide'" class="tab-pane">
          <PackGuideCard ref="packGuideCardRef" @copy="onCopyText" />
        </section>

        <!-- 4. 系统设置 -->
        <section v-show="currentTab === 'settings'" class="tab-pane tab-settings">
          <div class="card settings-card">
            <div class="card-title">
              <span>⚙️ 工作台首选项</span>
            </div>

            <div class="settings-group">
              <div class="settings-item">
                <div class="settings-meta">
                  <div class="settings-title">项目历史记忆</div>
                  <div class="settings-desc">清除最近一次载入的 uni-app 工程路径记忆</div>
                </div>
                <button class="btn btn-secondary btn-sm" @click="onClearCache">
                  🧹 清除缓存
                </button>
              </div>

              <div class="settings-item">
                <div class="settings-meta">
                  <div class="settings-title">底层环境探测</div>
                  <div class="settings-desc">重新检查系统 JDK、Android SDK、Gradle 与 AAR</div>
                </div>
                <button class="btn btn-secondary btn-sm" :disabled="isLoadingEnv" @click="loadEnvData">
                  <span v-if="isLoadingEnv" class="spinner"></span>
                  <span>🔄 重新检测</span>
                </button>
              </div>
            </div>
          </div>

          <div class="card settings-card" style="margin-top: 16px;">
            <div class="card-title">
              <span>ℹ️ 关于工作台</span>
            </div>

            <div class="about-grid">
              <div class="about-item">
                <span class="about-label">客户端版本</span>
                <span class="about-val">Desktop v1.0.0 (Portable)</span>
              </div>
              <div class="about-item">
                <span class="about-label">技术架构</span>
                <span class="about-val">Electron 31 + Vue 3 + Vite 5</span>
              </div>
              <div class="about-item">
                <span class="about-label">构建目标</span>
                <span class="about-val">Android 离线打包 (免 Android Studio)</span>
              </div>
            </div>
          </div>
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

// 主导航菜单列表
const mainNavTabs = [
  { id: 'env', name: '环境检测', icon: '⚡', desc: 'Android SDK 与底层运行依赖完备度' },
  { id: 'workbench', name: '打包构建', icon: '📦', desc: '工程配置与实时构建流水线一体化控制台' },
  { id: 'guide', name: '配置指南', icon: '💡', desc: '官方离线打包规范与配置对照' }
]

// 底部设置模块定义
const settingsTab = { id: 'settings', name: '系统设置', icon: '⚙️', desc: '工作台首选项与环境缓存管理' }

const allTabs = [...mainNavTabs, settingsTab]

const currentTab = ref('env')
const isLoadingEnv = ref(false)
const isBuilding = ref(false)
const isSavingConfig = ref(false)
const isBrowsingDir = ref(false)
const isVerifyingCert = ref(false)
const packConfigCardRef = ref(null)
const packGuideCardRef = ref(null)
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
  overallOk: false
})

const packConfig = reactive({
  projectDir: '',
  appName: '',
  versionName: '',
  packageName: '',
  isPackageExtracted: false,
  appId: '',
  storeFile: '',
  storePassword: '',
  keyAlias: '',
  keyPassword: '',
  sha1: '',
  appKey: '',
  apkName: '',
  isDefaultCert: false,
  isUniApp: true,
  packType: 'release'
})

const savedConfigSnapshot = ref('')

function extractConfigSnapshot() {
  const { isPackageExtracted, isUniApp, ...rest } = packConfig
  return JSON.stringify(rest)
}

function updateSavedConfigSnapshot() {
  savedConfigSnapshot.value = extractConfigSnapshot()
}

const isConfigSaved = computed(() => {
  if (!savedConfigSnapshot.value) return false
  return savedConfigSnapshot.value === extractConfigSnapshot()
})

const canBuild = computed(() => {
  if (packConfig.isUniApp === false) return false
  const effectiveKeyPassword = packConfig.keyPassword?.trim() || packConfig.storePassword?.trim()
  return Boolean(
    packConfig.projectDir?.trim() &&
    packConfig.packageName?.trim() &&
    packConfig.appKey?.trim() &&
    packConfig.storeFile?.trim() &&
    packConfig.storePassword?.trim() &&
    packConfig.keyAlias?.trim() &&
    effectiveKeyPassword &&
    packConfig.sha1?.trim()
  )
})

const buildResult = ref(null)

// 派生状态计算
const activeTabInfo = computed(() => {
  return allTabs.find((tab) => tab.id === currentTab.value) ?? allTabs[0]
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

const hasEnvError = computed(() => {
  return !isEnvAllReady.value
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

function onClearCache() {
  localStorage.removeItem('uni_pack_project_dir')
  packConfig.projectDir = ''
  packConfig.appName = ''
  packConfig.packageName = ''
  packConfig.versionName = ''
  packConfig.appId = ''
  iconPreviewUrl.value = ''
  savedConfigSnapshot.value = ''
  showToast('🧹 已清除工作台历史项目记忆')
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

// 快速跳转至对应指南章节
function onNavigateGuide(section = 'jdk') {
  currentTab.value = 'guide'
  if (section === 'jdk') {
    packGuideCardRef.value?.expandJdkGuide()
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
    const oldPkg = (packConfig.packageName || '').trim()
    const data = await fetchProjectConfig(pDir)
    if (data && data.is_uni_app === false) {
      packConfig.isUniApp = false
      packConfig.projectDir = pDir
      packConfig.appName = ''
      packConfig.versionName = ''
      packConfig.packageName = ''
      packConfig.isPackageExtracted = false
      packConfig.appId = ''
      packConfig.apkName = ''
      iconPreviewUrl.value = ''
      savedConfigSnapshot.value = ''
      return false
    }

    packConfig.isUniApp = true
    if (data) {
      const newPkg = (data.package_name || '').trim()

      if (data.project_dir) {
        packConfig.projectDir = data.project_dir
        localStorage.setItem('uni_pack_project_dir', data.project_dir)
      }
      packConfig.appName = data.app_name ?? ''
      packConfig.versionName = data.version_name ?? ''
      packConfig.packageName = newPkg
      packConfig.isPackageExtracted = Boolean(data.is_package_extracted)
      packConfig.appId = data.app_id ?? ''
      packConfig.apkName = data.apk_name ?? ''

      // 按照包名回显配置（优先使用包名缓存或项目已有配置）
      packConfig.storeFile = data.store_file ?? ''
      packConfig.storePassword = data.store_password ?? ''
      packConfig.keyAlias = (data.key_alias && data.key_alias !== 'test') ? data.key_alias : (data.app_id || '')
      packConfig.keyPassword = data.key_password ?? ''
      packConfig.sha1 = data.sha1 ?? ''
      packConfig.appKey = data.app_key ?? ''
      packConfig.isDefaultCert = Boolean(data.is_default_cert)
      packConfig.packType = data.pack_type || 'release'

      const isDifferentProject = oldPkg && oldPkg !== newPkg
      if (isDifferentProject) {
        if (data.has_package_cache) {
          showToast(`📦 检测到包名【${newPkg}】，已自动恢复历史打包配置`)
        } else {
          showToast('🔄 检测到新项目，未匹配到历史配置')
        }
      }
    }

    await loadIcon(packConfig.projectDir)
    updateSavedConfigSnapshot()
    return true
  } catch (err) {
    console.error('载入工程配置失败:', err)
    return false
  }
}

// 原生目录选择
async function onBrowseDir() {
  isBrowsingDir.value = true
  try {
    const dir = await pickDirectory(packConfig.projectDir)
    if (dir) {
      packConfig.projectDir = dir
      const ok = await loadConfigData(dir)
      if (ok) {
        showToast('✅ 已切换至新工程')
      }
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
  packConfig.projectDir = dir
  await loadConfigData(dir)
}

// 保存配置
async function onSaveConfig(isSilent = false) {
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
      is_uni_app: true,
      pack_type: packConfig.packType || 'release'
    })
    updateSavedConfigSnapshot()
    if (!isSilent) {
      showToast('💾 打包配置已成功保存')
    }
  } catch (err) {
    if (!isSilent) {
      showToast('❌ 保存配置失败')
    }
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

// 选择并导入自定义证书 (全自动探测密码、别名与 SHA1)
async function onSelectCert() {
  try {
    const filePath = await pickCertFile()
    if (!filePath) return
    const res = await importCertApi({
      filePath,
      projectDir: packConfig.projectDir
    })

    const fileName = typeof res === 'string' ? res : (res?.fileName || '')
    packConfig.storeFile = fileName
    packConfig.isDefaultCert = false

    if (res?.autoFilled) {
      packConfig.storePassword = res.storePassword ?? ''
      packConfig.keyAlias = res.keyAlias ?? ''
      packConfig.keyPassword = res.keyPassword ?? res.storePassword ?? ''
      packConfig.sha1 = res.sha1 ?? ''
      await onSaveConfig()
      showToast(`🎉 自动识别成功！别名【${res.keyAlias}】与 SHA1 已提取生效`)
    } else {
      showToast(`✅ 已导入证书: ${fileName}，输入密码即可自动提取别名`)
    }
  } catch (err) {
    console.error('选择证书异常:', err)
    showToast(`❌ 选择证书失败: ${err?.message ?? '未知错误'}`)
  }
}

// 校验证书密码并全自动提取别名、别名密码与 SHA1
async function onVerifyCert() {
  if (isVerifyingCert.value) return
  if (!packConfig.storeFile?.trim()) {
    return showToast('⚠️ 请先上传或选择证书文件')
  }
  if (!packConfig.storePassword?.trim()) {
    return showToast('⚠️ 请输入证书密码')
  }

  isVerifyingCert.value = true
  try {
    const res = await verifyAndSaveCertApi({
      storeFile: packConfig.storeFile,
      storePassword: packConfig.storePassword.trim(),
      keyAlias: packConfig.keyAlias?.trim() || '',
      keyPassword: packConfig.keyPassword?.trim() || '',
      projectDir: packConfig.projectDir
    })
    if (res?.success) {
      packConfig.sha1 = res.sha1
      if (res.keyAlias) {
        packConfig.keyAlias = res.keyAlias
      }
      if (res.keyPassword) {
        packConfig.keyPassword = res.keyPassword
      }
      await onSaveConfig(true)
      showToast(`🎉 证书解析成功！已自动填充别名【${packConfig.keyAlias}】、密码与 SHA1`)
    } else {
      showToast(`❌ 证书校验失败: ${res?.error || '密码可能不正确'}`)
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
    let targetDir = customPath || buildResult.value?.apkPath || ''
    if (!targetDir) {
      const isCustomBase = packConfig.packType === 'custom_base'
      targetDir = packConfig.projectDir
        ? (isCustomBase ? `${packConfig.projectDir}\\unpackage\\debug` : `${packConfig.projectDir}\\dist`)
        : ''
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

// 复制打包失败日志
function onCopyErrorLog() {
  const fullLog = terminalRef.value?.getLogText?.() || ''
  const errorTitle = buildResult.value?.message ? `【失败原因】: ${buildResult.value.message}\n\n` : ''
  const contentToCopy = (errorTitle + fullLog).trim()
  if (!contentToCopy) {
    showToast('⚠️ 暂无日志可复制')
    return
  }
  onCopyText(contentToCopy)
}

// 尝试从当前终端日志恢复构建结果 (避免页面热重载/刷新后状态丢失)
function tryRecoverResultFromLog() {
  if (buildResult.value) return
  const text = terminalRef.value?.getLogText?.() ?? ''
  const match = text.match(/APK 文件已输出:\s*([^\r\n]+)/)
  if (match && match[1]) {
    const outPath = match[1].trim()
    isBuilding.value = false
    buildResult.value = {
      isSuccess: true,
      apkPath: outPath,
      message: `🎉 打包成功！产物已输出至: ${outPath}`
    }
  }
}

// 启动离线打包流水线
async function onStartBuild() {
  if (isBuilding.value) return
  if (!packConfig.projectDir?.trim()) {
    showToast('⚠️ 请先选择目标 uni-app 工程目录')
    return
  }
  if (!packConfig.packageName?.trim()) {
    showToast('⚠️ 打包必须设置应用包名 (PackageName)')
    return
  }
  if (!packConfig.appKey?.trim()) {
    showToast('⚠️ 打包必须设置 DCloud 离线 AppKey')
    return
  }
  if (!packConfig.storeFile?.trim()) {
    showToast('⚠️ 打包必须提供签名证书文件')
    return
  }
  if (!packConfig.storePassword?.trim()) {
    showToast('⚠️ 打包必须提供证书密码')
    return
  }
  if (!packConfig.keyAlias?.trim()) {
    showToast('⚠️ 打包必须提供证书别名')
    return
  }
  if (!packConfig.keyPassword?.trim()) {
    if (packConfig.storePassword?.trim()) {
      packConfig.keyPassword = packConfig.storePassword.trim()
    } else {
      showToast('⚠️ 打包必须提供别名密码')
      return
    }
  }
  if (!packConfig.sha1?.trim()) {
    showToast('⚠️ 打包必须提供证书 SHA1 指纹（请先校验证书）')
    return
  }
  isBuilding.value = true
  buildResult.value = null

  const isCustomBase = packConfig.packType === 'custom_base'
  terminalRef.value?.clearLog()
  terminalRef.value?.appendLog(
    isCustomBase
      ? '🚀 启动本地 uni-app 自定义基座打包流水线...\n'
      : '🚀 启动本地纯原生离线打包流水线...\n',
    'info'
  )

  try {
    if (!isConfigSaved.value) {
      await onSaveConfig(true)
    }
    await startOfflineBuildApi({
      project_dir: packConfig.projectDir,
      app_name: packConfig.appName,
      apk_name: isCustomBase ? 'android_debug.apk' : (packConfig.apkName || null),
      package_name: packConfig.packageName,
      app_id: packConfig.appId,
      app_key: packConfig.appKey,
      pack_type: packConfig.packType || 'release'
    })
  } catch (err) {
    isBuilding.value = false
    const errMsg = err?.message ?? String(err)
    terminalRef.value?.appendLog(`❌ 启动构建流水线失败: ${errMsg}\n`, 'err')
  }
}

onMounted(async () => {
  // 1. 优先立即注册事件监听，保障不错过任何原生消息推送
  unlistenLog = await listenBuildLog((payload) => {
    if (payload?.text) {
      terminalRef.value?.appendLog(payload.text, payload.type ?? 'normal')

      // 双重保障：实时从终端日志流感知产物就绪
      const successMatch = payload.text.match(/APK 文件已输出:\s*([^\r\n]+)/)
      if (successMatch && successMatch[1]) {
        const outPath = successMatch[1].trim()
        isBuilding.value = false
        const isCurrentCustomBase = packConfig.packType === 'custom_base' || outPath.includes('unpackage')
        buildResult.value = {
          isSuccess: true,
          apkPath: outPath,
          message: isCurrentCustomBase
            ? `🎉 自定义基座打包成功！产物已输出至: ${outPath}`
            : `🎉 打包成功！产物已输出至: ${outPath}`
        }
      }
    }
  })

  unlistenDone = await listenBuildDone((payload) => {
    isBuilding.value = false
    if (payload?.success) {
      const isCurrentCustomBase = payload?.is_custom_base || packConfig.packType === 'custom_base'
      buildResult.value = {
        isSuccess: true,
        apkPath: payload.apk_path,
        message: payload.message || (isCurrentCustomBase
          ? `🎉 自定义基座打包成功！产物已输出至: ${payload.apk_path}`
          : `🎉 打包成功！产物已输出至: ${payload.apk_path}`)
      }
    } else {
      buildResult.value = {
        isSuccess: false,
        apkPath: '',
        message: `❌ 打包失败: ${payload?.message ?? '请检查日志'}`
      }
    }
  })

  // 2. 异步检测环境与载入配置
  const cachedDir = localStorage.getItem('uni_pack_project_dir') ?? ''
  await loadEnvData()
  await loadConfigData(cachedDir)

  // 3. 若当前终端已包含构建成功输出，立即恢复结果展示卡片
  setTimeout(tryRecoverResultFromLog, 300)
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
          }

          .nav-pulse {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--warning);
            box-shadow: 0 0 0 0 rgba(210, 153, 34, 0.7);
            animation: pulse 1.6s infinite;
          }

          .nav-badge-warn {
            position: absolute;
            top: 5px;
            right: 8px;
            background: var(--danger);
            color: #ffffff;
            font-size: 10px;
            font-weight: 600;
            line-height: 1.2;
            padding: 1px 6px;
            border-radius: 8px;
            box-shadow: 0 1px 4px rgba(248, 81, 73, 0.4);
            pointer-events: none;
            letter-spacing: 0.5px;
          }
        }
      }
    }

    .sidebar-footer {
      display: flex;
      flex-direction: column;
      padding-top: 12px;
      border-top: 1px solid var(--sidebar-border);

      .settings-btn {
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
        }
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
      overflow-x: hidden;
      padding: 16px 20px;

      .tab-pane {
        width: 100%;
        max-width: 1280px;
        margin: 0 auto;

        &.tab-workbench {
          width: 100%;
          max-width: 100%;

          .workbench-layout {
            display: flex;
            flex-direction: column;
            gap: 14px;
            width: 100%;
            min-width: 0;

            .config-section {
              width: 100%;
              min-width: 0;
            }

            .terminal-section {
              display: flex;
              flex-direction: column;
              gap: 12px;
              width: 100%;
              min-width: 0;

              .build-result-card {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                gap: 12px;
                border-radius: 8px;
                animation: fadeIn 0.3s ease;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;

                &.success {
                  background: rgba(22, 38, 27, 0.7);
                  border: 1px solid rgba(46, 160, 67, 0.45);

                  .result-title {
                    color: #3fb950;
                  }
                }

                &.error {
                  background: rgba(43, 20, 22, 0.7);
                  border: 1px solid rgba(248, 81, 73, 0.45);

                  .result-title {
                    color: #f85149;
                  }
                }

                .result-info {
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  min-width: 0;
                  flex: 1;

                  .result-icon {
                    font-size: 20px;
                    line-height: 1;
                    flex-shrink: 0;
                  }

                  .result-content {
                    min-width: 0;
                    flex: 1;

                    .result-title {
                      font-size: 13px;
                      font-weight: 600;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    }
                  }
                }

                .result-actions {
                  flex-shrink: 0;
                  white-space: nowrap;
                }
              }
            }
          }
        }

        &.tab-settings {
          max-width: 800px;

          .settings-card {
            .settings-group {
              display: flex;
              flex-direction: column;
              gap: 10px;

              .settings-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 14px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid var(--card-border);
                border-radius: 8px;

                .settings-meta {
                  .settings-title {
                    font-size: 13px;
                    color: var(--text-bright);
                    font-weight: 500;
                  }

                  .settings-desc {
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-top: 2px;
                  }
                }
              }
            }

            .about-grid {
              display: flex;
              flex-direction: column;
              gap: 8px;

              .about-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid var(--card-border);
                border-radius: 6px;
                font-size: 12px;

                .about-label {
                  color: var(--text-muted);
                }

                .about-val {
                  color: var(--text-bright);
                  font-family: monospace;
                }
              }
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

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
