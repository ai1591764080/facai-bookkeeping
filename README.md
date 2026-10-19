# facai-bookkeeping

一个面向报销场景的记账工具，支持 **Web (H5)** 与 **微信小程序** 双端运行，内置 AI 语音听写、OCR 票据识别、配置一键备份等能力。

## 功能特性

| 模块 | 说明 |
| --- | --- |
| 💰 记账 | 记一笔、分类明细、月度报表、AA 分摊明细、预算 |
| 🏦 账户 | 多账户管理（微信、支付宝、信用卡、自定义） |
| 🏷️ 分类 | 自定义分类与预算设置 |
| 🧾 票据 | 导入 PNG/Excel/CSV，OCR 识别发票信息 |
| 🤖 AI 服务 | 语音听写、OCR、模型配置与凭证管理 |
| 🎙️ 语音 | 浏览器原生识别 / 讯飞听写 / 自定义接口 |
| 📋 备份 | 配置导出/导入（含剪贴板自动检测）、账目导出/导入 |
| ⚙️ 设置 | 主题、货币、月份起始日、AI 服务、语音、OCR |

## 技术栈

- **框架**：Vue 3 + TypeScript
- **构建**：Vite（H5）/ uni-app（小程序）
- **状态管理**：Pinia
- **存储**：`uni.setStorageSync`（H5 即 `localStorage`）

## 快速开始

```bash
# 安装依赖
npm install

# 启动 H5 开发服务器
npm run dev:h5
# 访问 http://localhost:5173
```

## 目录结构

```
src/
├── pages/            # 页面
│   ├── index/        # 首页
│   ├── settings/     # 通用设置
│   ├── accounts/     # 账户管理
│   ├── categories/   # 分类管理
│   ├── data/         # 数据导入导出
│   ├── transactions/ # 记账记录
│   ├── ai/           # AI 服务配置
│   ├── voice/        # 语音识别
│   ├── ocr/          # OCR 票据识别
│   └── membership/   # AA 成员分摊
├── stores/           # Pinia 状态
├── utils/
│   ├── config.ts        # 配置项读写
│   ├── backup.ts        # 账目备份/导出
│   ├── configBackup.ts  # 配置备份/剪贴板导入
│   ├── account.ts       # 账户工具
│   ├── voice/           # 语音识别引擎
│   └── data/            # 数据建模与导入导出
```

## 配置备份

设置页底部「⚙️ 配置备份」支持：

- **导出配置**：把 AI 服务、语音凭证、OCR、主题、货币等全部设置导出为 JSON 文件，并自动复制到剪贴板
- **导入配置**：选择 JSON 文件恢复
- **剪贴板导入**：进入设置页会自动检测剪贴板，里面是配置文件就提示导入；也可手动点按钮或按 `Ctrl/⌘+V` 粘贴

> ⚠️ 配置文件包含 API Key 明文，请妥善保管。账目数据请在「我的 → 导出」单独备份。

## License

MIT
