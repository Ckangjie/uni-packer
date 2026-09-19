const bridge = window?.electronBridge ?? {
  invoke: async () => null,
  listen: async () => () => {},
}

/**
 * 唤起原生系统文件夹选择器
 * @param {string} defaultPath 默认展开路径
 * @returns {Promise<string | null>} 选中的文件夹绝对路径或 null
 */
export async function pickDirectory(defaultPath = '') {
  try {
    const res = await bridge.invoke('pick_project_directory', { defaultPath: defaultPath || null })
    if (res && typeof res === 'string' && res.trim()) {
      return res.trim()
    }
    return null
  } catch (error) {
    console.error('唤起系统文件夹选择器失败:', error)
    return null
  }
}

/**
 * 唤起原生系统证书文件选择器
 * @returns {Promise<string | null>} 选中的证书文件绝对路径或 null
 */
export async function pickCertFile() {
  try {
    const res = await bridge.invoke('pick_certificate_file')
    if (res && typeof res === 'string' && res.trim()) {
      return res.trim()
    }
    return null
  } catch (error) {
    console.error('唤起证书选择器失败:', error)
    return null
  }
}
