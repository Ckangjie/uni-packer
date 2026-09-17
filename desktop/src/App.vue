<template>
  <div class="desktop-workbench">
    <div class="container">
      <!-- 顶部 Header -->
      <header class="app-header">
        <div class="brand">
          <div class="logo-badge">APK</div>
          <div class="title-wrap">
            <h1>uni-app 离线打包工作台 (Desktop)</h1>
            <p>免 Android Studio · 本地秒级构建 · 纯原生桌面控制台</p>
          </div>
        </div>

        <div class="header-actions">
          <button class="btn btn-secondary" :disabled="isLoadingEnv" @click="loadEnvData">
            <span v-if="isLoadingEnv" class="spinner"></span>
            <span>🔄 刷新环境</span>
          </button>
        </div>
      </header>

      <!-- 三列网格卡片流 -->
      <div class="dashboard-grid">
        <!-- 1. 底层环境检测 -->
        <EnvStatusCard
          :env-data="envData"
          :is-loading="isLoadingEnv"
          @copy="onCopyText"
        />

        <!-- 2. 应用打包配置 -->
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

        <!-- 3. 离线打包与环境指引 -->
        <PackGuideCard @copy="onCopyText" />
      </div>

      <!-- 流式构建日志终端 -->
      <LogTerminal
        ref="terminalRef"
        :is-building="isBuilding"
        :result-info="buildResult"
        @clear="onClearLogs"
        @copy="onCopyText"
        @open-dir="onOpenDistDir"
      />

      <!-- 轻量 Toast 提示 -->
      <div v-if="toastMessage" class="toast-tip">
        {{ toastMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
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

const packConfig = reactive({
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

// 纯原生 Rust 底层环境探测
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

// 载入应用桌面图标 (纯原生 Base64 解析，对齐 Web 版展示)
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

// 更换并同步应用桌面图标 (纯原生读写与同步)
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

// 载入工程配置 (原生解析与历史回退，对齐 Web 版体验)
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

    // 载入项目桌面图标
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

// 选择并导入自定义证书文件
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

// 校验并保存证书密码与别名，提取真实 SHA1
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

// 打开产物所在目录
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

// 一键启动离线打包流水线 (纯原生驱动)
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

  // 挂载 Tauri 原生日志与完成事件监听
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
  width: 100%;
  min-height: 100vh;

  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--card-border);

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;

      .logo-badge {
        background: linear-gradient(135deg, #1f6feb, #238636);
        color: #fff;
        font-size: 18px;
        font-weight: 700;
        width: 38px;
        height: 38px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .title-wrap {
        h1 {
          font-size: 18px;
          color: var(--text-bright);
          font-weight: 600;
        }

        p {
          font-size: 12px;
          color: var(--text-muted);
        }
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 320px 1fr 340px;
    gap: 16px;
    align-items: start;

    @media (max-width: 1280px) {
      grid-template-columns: 1fr 1fr;

      > :nth-child(3) {
        grid-column: span 2;
      }
    }

    @media (max-width: 860px) {
      grid-template-columns: 1fr;

      > :nth-child(3) {
        grid-column: span 1;
      }
    }
  }

  .toast-tip {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 35, 45, 0.95);
    color: #fff;
    border: 1px solid var(--card-border);
    padding: 8px 18px;
    border-radius: 20px;
    font-size: 13px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    z-index: 9999;
  }
}
</style>
