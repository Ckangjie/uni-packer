# 离线打包证书与配置中心 (config)

本目录用于持久化保存离线打包所需的签名证书与关键配置。**换设备时，只需保留并拷贝整个工作台（含此 config 目录），即可实现零配置开箱即用。**

## 目录文件说明

| 文件名 | 说明 |
| :--- | :--- |
| `pack-config.json` | 集中配置文件，仅包含证书签名信息 (`signing`) 与 DCloud 离线 AppKey (`dcloud`) |
| `c57b0f5e5f5a5e0b086fa3dc1e46eba5.keystore` | 当前生效的 Android 正式签名证书 |
| `test.keystore` | 默认备用测试证书 |

## 关键参数备忘

- **证书 SHA1 指纹**：`66:1F:3A:29:E3:52:4A:75:F7:FC:17:03:D5:5F:93:C6:9E:F0:E1:E6`
- **应用包名 (PackageName)**：`com.boil.integral`
- **uni-app AppID**：`__UNI__A87A300`
- **DCloud 开发者中心 AppKey 申请依据**：必须与上述三项完全匹配。
