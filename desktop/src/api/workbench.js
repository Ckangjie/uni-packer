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
