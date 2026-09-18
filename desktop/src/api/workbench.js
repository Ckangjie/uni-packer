const bridge = window?.electronBridge ?? {
  invoke: async () => null,
  listen: async () => () => {},
}

/**
 * 获取底层环境检测数据 (Electron 主进程检测)
 * @returns {Promise<any>}
 */
export async function fetchEnvInfo() {
  try {
    return await bridge.invoke('get_env_status')
  } catch (err) {
    console.error('获取底层环境失败:', err)
    throw err
  }
}

/**
 * 载入目标工程配置与签名数据
 * @param {string} projectDir 目标项目路径
 * @returns {Promise<any>}
 */
export async function fetchProjectConfig(projectDir = '') {
  try {
    return await bridge.invoke('get_project_config', { projectDir: projectDir || null })
  } catch (err) {
    console.error('载入工程配置失败:', err)
    throw err
  }
}

/**
 * 获取应用桌面图标 Base64 数据流
 * @param {string} projectDir 目标项目路径
 * @returns {Promise<string|null>}
 */
export async function getProjectIconApi(projectDir = '') {
  try {
    return await bridge.invoke('get_project_icon', { projectDir: projectDir || null })
  } catch (err) {
    console.error('读取应用图标失败:', err)
    return null
  }
}

/**
 * 原生保存并同步应用桌面图标
 * @param {object} payload { projectDir, dataUrl }
 * @returns {Promise<void>}
 */
export async function uploadProjectIconApi(payload) {
  try {
    return await bridge.invoke('upload_project_icon', {
      projectDir: payload.projectDir || null,
      dataUrl: payload.dataUrl,
    })
  } catch (err) {
    console.error('更新应用图标失败:', err)
    throw err
  }
}

/**
 * 保存应用配置
 * @param {object} payload 配置对象
 * @returns {Promise<any>}
 */
export async function saveProjectConfig(payload) {
  try {
    return await bridge.invoke('save_project_config', { config: payload })
  } catch (err) {
    console.error('保存工程配置失败:', err)
    throw err
  }
}

/**
 * 导入自定义证书文件并同步到工程目录
 * @param {object} payload { filePath, projectDir }
 * @returns {Promise<string>} 证书文件名
 */
export async function importCertApi(payload) {
  try {
    return await bridge.invoke('import_cert_file', {
      filePath: payload.filePath,
      projectDir: payload.projectDir || null,
    })
  } catch (err) {
    console.error('导入证书失败:', err)
    throw err
  }
}

/**
 * 一键生成专属正式签名证书
 * @param {object} payload { fileName, keyAlias, storePassword, validityYears, dname, projectDir }
 * @returns {Promise<any>}
 */
export async function generateCertApi(payload) {
  try {
    return await bridge.invoke('generate_cert_file', payload)
  } catch (err) {
    console.error('生成证书失败:', err)
    throw err
  }
}

/**
 * 校验并提取证书真实 SHA1
 * @param {object} certPayload
 * @returns {Promise<any>}
 */
export async function verifyAndSaveCertApi(certPayload) {
  try {
    return await bridge.invoke('verify_cert', {
      storeFile: certPayload.storeFile,
      storePassword: certPayload.storePassword,
      keyAlias: certPayload.keyAlias,
      projectDir: certPayload.projectDir || null,
    })
  } catch (err) {
    console.error('校验证书失败:', err)
    throw err
  }
}

/**
 * 打开并定位产物目录
 * @param {string} dirPath
 * @returns {Promise<void>}
 */
export async function openDistDirApi(dirPath = '') {
  try {
    await bridge.invoke('open_directory', { dirPath })
  } catch (err) {
    console.error('打开目录失败:', err)
  }
}

/**
 * 通过系统默认浏览器打开外部网页或下载链接
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function openUrlApi(url) {
  try {
    const ok = await bridge.invoke('open_url', { url })
    if (!ok && typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
    return true
  } catch (err) {
    console.error('打开外部链接失败:', err)
    if (typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
    return false
  }
}

/**
 * 启动离线打包流水线
 * @param {object} params
 * @returns {Promise<void>}
 */
export async function startOfflineBuildApi(params) {
  try {
    await bridge.invoke('start_offline_build', { params })
  } catch (err) {
    console.error('触发打包失败:', err)
    throw err
  }
}

/**
 * 监听实时打包日志流
 * @param {function} callback
 * @returns {Promise<function>}
 */
export function listenBuildLog(callback) {
  return bridge.listen('build-log', (event) => {
    callback?.(event.payload)
  })
}

/**
 * 监听打包完成事件
 * @param {function} callback
 * @returns {Promise<function>}
 */
export function listenBuildDone(callback) {
  return bridge.listen('build-done', (event) => {
    callback?.(event.payload)
  })
}

/**
 * 触发远程下载并补全 DCloud 基座核心 AAR
 * @param {object} payload { url }
 * @returns {Promise<any>}
 */
export async function downloadAarLibsApi(payload = {}) {
  try {
    return await bridge.invoke('download_aar_libs', payload)
  } catch (err) {
    console.error('下载 AAR 失败:', err)
    throw err
  }
}

/**
 * 监听 AAR 下载与解压实时进度
 * @param {function} callback
 * @returns {Promise<function>}
 */
export function listenAarProgress(callback) {
  return bridge.listen('aar_download_progress', (event) => {
    callback?.(event.payload)
  })
}

/**
 * 触发远程下载并补全 Android SDK MVP 基础套件
 * @param {object} payload { url, targetDir }
 * @returns {Promise<any>}
 */
export async function downloadAndroidSdkApi(payload = {}) {
  try {
    return await bridge.invoke('download_android_sdk', payload)
  } catch (err) {
    console.error('下载 Android SDK 失败:', err)
    throw err
  }
}

/**
 * 监听 Android SDK 下载与解压实时进度
 * @param {function} callback
 * @returns {Promise<function>}
 */
export function listenSdkProgress(callback) {
  return bridge.listen('sdk_download_progress', (event) => {
    callback?.(event.payload)
  })
}

/**
 * 触发远程下载或配置 Gradle Wrapper 极速镜像
 * @param {object} payload
 * @returns {Promise<any>}
 */
export async function downloadGradleWrapperApi(payload = {}) {
  try {
    return await bridge.invoke('download_gradle_wrapper', payload)
  } catch (err) {
    console.error('配置/补全 Gradle 失败:', err)
    throw err
  }
}

/**
 * 监听 Gradle 补全与预热实时进度
 * @param {function} callback
 * @returns {Promise<function>}
 */
export function listenGradleProgress(callback) {
  return bridge.listen('gradle_download_progress', (event) => {
    callback?.(event.payload)
  })
}
