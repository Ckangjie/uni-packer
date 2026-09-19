const fs = require('fs');

/**
 * JSON 对象区间定位（花括号配对，字符串与注释感知）
 */
function findObjectRange(src, key) {
  const m = new RegExp(`"${key}"\\s*:\\s*`).exec(src);
  if (!m) return null;
  const openIdx = m.index + m[0].length;
  if (src[openIdx] !== '{') return null;

  let depth = 0;
  let inStr = false;
  let strCh = '';
  let inLine = false;
  let inBlock = false;

  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { start: openIdx, end: i };
    }
  }
  return null;
}

/**
 * 容错提取：当 manifest.json 格式含非法字符或损坏时，通过正则尽可能优先解析出可识别的内容
 */
function extractManifestFieldsFallback(raw) {
  if (!raw) return {};
  const result = {};

  // 1. 应用名称 name
  const nameMatch = raw.match(/"name"\s*:\s*"([^"\r\n]+)"/);
  if (nameMatch) result.name = nameMatch[1].trim();

  // 2. 版本号 versionName
  const versionMatch = raw.match(/"versionName"\s*:\s*"([^"\r\n]+)"/);
  if (versionMatch) {
    result.versionName = versionMatch[1].trim();
  } else {
    const vSubMatch = raw.match(/"version"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"\r\n]+)"/s);
    if (vSubMatch) result.versionName = vSubMatch[1].trim();
  }

  // 3. uni-app AppID
  const appidMatch = raw.match(/"appid"\s*:\s*"([^"\r\n]+)"/);
  if (appidMatch) result.appid = appidMatch[1].trim();

  // 4. Android 应用包名 packagename
  const pkgMatch = raw.match(/"(?:packagename|packageName|package)"\s*:\s*"([^"\r\n]+)"/i);
  const pkg = pkgMatch ? pkgMatch[1].trim() : undefined;

  // 5. 桌面图标配置提取
  const icons = {};
  const iconDensities = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi', 'ldpi'];
  for (const d of iconDensities) {
    const iconMatch = raw.match(new RegExp(`"${d}"\\s*:\\s*"([^"\\r\\n]+)"`));
    if (iconMatch) icons[d] = iconMatch[1].trim();
  }

  result['app-plus'] = {
    distribute: {
      android: {
        packagename: pkg,
        icons: Object.keys(icons).length > 0 ? icons : undefined,
      },
    },
  };

  return result;
}

/**
 * 安全解析带注释、尾随逗号及控制字符的 JSON
 */
function parseManifestJson(manifestPath) {
  if (!manifestPath || !fs.existsSync(manifestPath)) return null;
  let raw = '';
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch (e) {
    return null;
  }

  const fallbackData = extractManifestFieldsFallback(raw);

  const clean = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/,\s*([\}\]])/g, '$1');

  try {
    const parsed = JSON.parse(clean);
    return { ...fallbackData, ...parsed };
  } catch (e1) {
    try {
      const sanitized = clean.replace(/[\x00-\x1f]/g, (char) => {
        if (char === '\n') return '\\n';
        if (char === '\r') return '\\r';
        if (char === '\t') return '\\t';
        return '';
      });
      const parsedSanitized = JSON.parse(sanitized);
      return { ...fallbackData, ...parsedSanitized };
    } catch (e2) {
      return fallbackData;
    }
  }
}

module.exports = {
  findObjectRange,
  parseManifestJson,
};
