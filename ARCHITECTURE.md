# 架构设计文档

## 1. 总体架构

项目采用 **Vue 3 + Vite + Pinia** 架构，同时提供 **H5（Web）** 与 **小程序（uni-app）** 两个端。

核心设计原则：

- **UI 层与数据层解耦**：页面组件只调用工具函数与状态源，不直接操作原始存储
- **配置与账目分离**：设置项（AI 凭证、主题、货币）与记账数据（账户、分类、交易）用不同模块管理
- **跨端复用**：同一套 `utils` 通过 `#ifdef` 条件编译适配 uni-app 与浏览器

## 2. 分层结构

```
┌─────────────────────────────────────────┐
│  页面层 pages/*                          │  唯一 UI 入口
├─────────────────────────────────────────┤
│  状态层 stores/*（Pinia）                │  主题/货币/月起始日等
├─────────────────────────────────────────┤
│  工具层 utils/*                          │  纯逻辑，可复用
│  ├── config.ts        配置读写           │
│  ├── backup.ts        账目备份导出       │
│  ├── configBackup.ts  配置备份/剪贴板    │
│  ├── voice/           语音识别引擎       │
│  └── data/            数据建模与导入导出 │
├─────────────────────────────────────────┤
│  存储层 uni.setStorageSync / localStorage│
└─────────────────────────────────────────┘
```

## 3. 目录说明

```
src/
├── pages/            # 页面层
├── stores/           # Pinia 状态
├── utils/            # 工具层
└── components/       # 通用组件
```

## 4. 核心模块

### 4.1 配置管理（`utils/config.ts`）

读写设置项，底层用 `uni.setStorageSync / getStorageSync`（H5 对应 `localStorage`）。

主要存储键：

| 键 | 内容 |
| --- | --- |
| `beecount_ai_config` | AI 服务商、接口地址、模型、API Key |
| `beecount_asr_config` | 语音识别引擎与接口配置 |
| `beecount_xfyun_*` | 讯飞 AppID / APIKey / APISecret |
| `beecount_ocr_*` | OCR 接口地址与 Token |
| `beecount_theme` | 主题（light/dark） |
| `beecount_currency` | 货币 |
| `beecount_month_start_date` | 每月起始日 |

### 4.2 账目备份（`utils/backup.ts`）

- `saveTextFile` / `pickTextFile`：跨端文件存取（H5 下载与选文件、小程序转发/读取）
- 负责交易、分类、账户等账目数据的导出与导入

### 4.3 配置备份（`utils/configBackup.ts`）

与账目备份分离，**只管理设置类配置**。

导出文件结构：

```json
{
  "app": "facai-bookkeeping",
  "type": "config",
  "exportedAt": "2026-10-19T...",
  "config": {
    "beecount_ai_config": "{...}",
    "beecount_theme": "dark"
  }
}
```

主要函数：

| 函数 | 说明 |
| --- | --- |
| `collectConfigFile()` | 收集全部已配置项 |
| `validateConfigFile(raw)` | 校验 `app`/`type`，忽略未知键 |
| `applyConfigFile(file)` | 写入配置并返回条数 |
| `readClipboardText()` | 读取剪贴板（H5 需权限） |
| `writeClipboardText(text)` | 写入剪贴板 |
| `textFingerprint(text)` | 文本指纹，防重复弹窗 |

### 4.4 语音识别（`utils/voice/`）

- `config.ts`：引擎注册表（浏览器原生、讯飞、自定义接口），支持动态切换
- `connector.ts`：统一的连接与结果回调，抽象各引擎差异
- 保存讯飞凭证后会同步把引擎切换为 `xfyun`

### 4.5 数据导入导出（`utils/data/`）

- `transactions/`：交易匹配、规范化、规则、重新计算
- `import/`：支持 JSON、CSV、Excel 等格式解析
- `export/`：支持 CSV、JSON、HTML 等导出

## 5. 状态管理（Pinia）

`stores/settings.ts` 保存主题、货币、每月起始日、AI / 语音 / OCR 配置等。持久化到 `uni.setStorageSync`。

> 注意：主题、货币、每月起始日等存在内存 store 里，**导入配置后需要刷新页面才生效**。

## 6. 渲染与多端

| 端 | 方式 |
| --- | --- |
| H5 | Vue + Vite 标准 SPA |
| 小程序 | uni-app 编译至微信/支付宝等 |

通过 `#ifdef H5` / `#ifndef H5` 条件编译处理端差异（如剪贴板、文件下载）。

## 7. 错误处理

- 所有异步操作有 try/catch
- 第三方接口错误码映射为中文提示
- 语音/AI 接口失败时不影响主流程，仅提示降级

## 8. 可扩展点

| 扩展点 | 方式 |
| --- | --- |
| 新增配置项 | 在 `config.ts` 增加读写并注册到 `configBackup` 白名单 |
| 新增语音引擎 | 注册到 `voice/config.ts` |
| 新增导入格式 | 在 `data/import` 实现并注册 |
