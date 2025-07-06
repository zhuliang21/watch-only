# Bitcoin zpub 到地址转换器

一个简单的网页工具，用于将Bitcoin zpub转换为第一个地址。

## 功能

- 输入Bitcoin zpub
- 点击按钮生成第一个地址（派生路径：m/0/0）
- 支持原生SegWit地址（P2WPKH）
- 无需CSS，纯HTML+JavaScript实现
- 本地安装依赖，不使用CDN

## 使用方法

1. 安装依赖：
   ```bash
   npm install
   ```

2. 构建项目：
   ```bash
   npm run build
   ```

3. 启动服务器：
   ```bash
   npm start
   ```

4. 在浏览器中打开 `http://localhost:8080`

5. 输入你的zpub，点击"获取第一个地址"按钮

## 技术栈

- HTML5
- JavaScript (ES6+)
- bitcoinjs-lib (用于Bitcoin相关操作)
- Webpack (用于打包)

## 注意事项

- 请确保输入的是有效的Bitcoin zpub
- 生成的地址是派生路径 m/0/0 下的第一个地址
- 所有操作都在本地完成，不会向外部发送任何数据

## 项目结构

```
.
├── index.html          # 主页面
├── src/
│   └── index.js        # 主要逻辑
├── dist/
│   └── bundle.js       # 打包后的JavaScript
├── package.json        # 项目配置
├── webpack.config.js   # Webpack配置
└── README.md           # 说明文档
``` 