<p align="center">
  <img src="../.github/assets/main-readme-logo.svg" alt="Vocab Bloom Hub 标志" />
</p>

<h1 align="center">Vocab Bloom Hub</h1>
<!-- reviewed: zh · @assassinationss · 2026-09-24 · 32148f5 -->

<p align="center">
  可自行部署的英语词典平台，提供公共 API、管理界面和 SDK。 项目自有数据集包含 300 000 个词条。安装现成数据集，创建自己的词典或分叉副本，同时保留词语来源、许可协议和编辑历史。
</p>

<p align="center">
  <a href="https://vocab-bloom-hub.com/zh"><strong>vocab-bloom-hub.com</strong></a> ·
  <a href="https://vocab-bloom-hub.com/zh/docs">文档</a> ·
  <a href="https://vocab-bloom-hub.com/zh/api">API 参考</a> ·
  <a href="https://vocab-bloom-hub.com/zh/playground">演练场</a>
</p>

<p align="center">
  <a href="../README.md">🇺🇸 EN</a> | <a href="README.ru.md">🇷🇺 RU</a> | <a href="README.es.md">🇪🇸 ES</a> | <a href="README.fr.md">🇫🇷 FR</a> | <a href="README.pt.md">🇵🇹 PT</a> | <a href="README.de.md">🇩🇪 DE</a> | <strong>🇨🇳 ZH</strong> | <a href="README.ar.md">🌐 AR</a>
</p>

<p align="center">
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL" /></a>
  <a href="../LICENSE"><img src="https://img.shields.io/github/license/Fristail27/vocab-bloom-hub" alt="许可证：MIT" /></a>
  <a href="../DATA_LICENSE.md"><img src="https://img.shields.io/badge/data-CC%20BY%204.0-lightgrey" alt="数据：CC BY 4.0" /></a>
  <a href="https://www.npmjs.com/package/@vocab-bloom-hub/client"><img src="https://img.shields.io/npm/v/%40vocab-bloom-hub%2Fclient?logo=npm&label=npm" alt="npm: @vocab-bloom-hub/client" /></a>
  <a href="https://pypi.org/project/vocab-bloom-hub/"><img src="https://img.shields.io/pypi/v/vocab-bloom-hub?logo=pypi&logoColor=white" alt="PyPI: vocab-bloom-hub" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/commits/main"><img src="https://img.shields.io/github/last-commit/Fristail27/vocab-bloom-hub" alt="最近提交" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/issues"><img src="https://img.shields.io/github/issues/Fristail27/vocab-bloom-hub" alt="未关闭的 issue" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/pulls"><img src="https://img.shields.io/github/issues-pr/Fristail27/vocab-bloom-hub" alt="未关闭的 pull request" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/stargazers"><img src="https://img.shields.io/github/stars/Fristail27/vocab-bloom-hub?style=flat" alt="星标" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node >= 22" />
  <img src="https://img.shields.io/badge/yarn-4-2C8EBB?logo=yarn&logoColor=white" alt="Yarn 4" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white" alt="NestJS 12" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/tests-Jest%20%7C%20Playwright-C21325?logo=jest&logoColor=white" alt="Jest 和 Playwright" />
  <a href="../CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="欢迎 PR" /></a>
  <a href="../CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/code%20of%20conduct-Contributor%20Covenant-5E0D73.svg" alt="Contributor Covenant" /></a>
</p>

---

## 📖 这是什么

一个由您自己运行的词典服务器。它自带数据、用于读取数据的 API、用于编辑数据的管理面板，
以及可基于它构建应用的 SDK。一个实例可容纳多部词典 — 数据集 — 并提供其中一部；
其余的可在旁读取。

**词典** — 项目自有的数据集，实例启动时自带的那一部

- 89 000 个英语单词和 26 000 个短语，161 000 个义项，配有定义和例句
- IPA 音标、CEFR 等级、语域和领域标签、屈折形式
- 词头之间的同义词和反义词关联，短语动词与其基础动词相关联
- 翻译成俄语、西班牙语、法语、德语、葡萄牙语、中文和阿拉伯语
- 开放数据：[CC BY 4.0](../DATA_LICENSE.md)，发布在 HuggingFace 上，首次启动时加载到空实例中；
  由语言模型生成，未经人工校验

**更多数据集** — 安装在它旁边，每一部都完整，并遵循其来源的许可协议

- 英语 Wiktionary（CC BY-SA 4.0）、Open English WordNet（CC BY 4.0）、Princeton WordNet
  3.1（WordNet 许可协议）和 OpenGloss 2.4（CC BY 4.0，标记的单词还适用 WordNet 条款）
- 在服务器上直接下载源文件，或手动上传；服务器负责转换和导入。WordNet 可选用 CMUdict 发音
- 创建空数据集或已安装数据集的分支，设置自己的版本和贡献许可协议；从其他数据集预填单词，或手动声明来源
- 每个单词保留来源名称、版本、链接、声明和多项许可协议。未修改的副本保留原始条款；
  实际修改会添加分支的贡献条款及修改历史
- 各数据集分别读取：主 API 提供一个数据集，`GET /api/v1/words/{word}/datasets`
  和单词页面的标签页展示所有已安装的数据集及各自条款

**API** — `/api/v1`，只读，无需密钥

- 带相关性分级和拼写容错的搜索；单个词头及其附带的全部内容
- 带游标分页的筛选列表、随机词条、一次最多 50 个单词的批量查询
- 一次从实例的每个数据集中读取一个词头、该词的修改历史，以及 `/meta` 中所提供数据集的条款 —
  许可协议、署名和声明
- 按客户端限速，每个响应都经 ETag 缓存，并提供可用于生成客户端的 OpenAPI 文档

**SDK** — 由该 OpenAPI 文档生成

- Node.js / TypeScript：`npm install @vocab-bloom-hub/client`
- Python：`pip install vocab-bloom-hub`（同步、异步、一个 pandas 辅助函数）

**管理面板** — 八种界面语言

- 编辑任一数据集的单词、义项、翻译和关联，无论是否正在提供；每次更改都连同修改前后的值保存在
  历史中，读者可见，一键即可撤回
- 审核读者从单词页面提交的更正
- 对词典的筛选子集批量向语言模型发起请求
- 在数据集卡片上安装、激活、导入、导出和删除数据集；来源有更新文件时以及应用有新版本发布时会有提示

**网站** — 文档、带五种语言及两个 SDK 请求示例的 API 参考、演练场、公共单词页面（包含该词的每个数据集各占一个标签页）

**底层技术** — PostgreSQL（开发时使用 SQLite）、Docker 镜像、启动时执行迁移、
健康探针、Prometheus 指标、JSON 日志。

> [!NOTE]
> 状态：`1.1`，稳定版：`/api/v1` 下的公共 API 遵循语义化版本；不兼容的变更将引入新的主版本。

> [!IMPORTANT]
> **所提供数据集的许可协议约束您所提供的内容。** 项目的数据集采用 CC BY 4.0。来自公共来源的
> 数据集保留该来源的许可协议：Wiktionary 要求相同方式共享（基于它构建的内容仍适用 CC BY-SA 4.0），
> WordNet 则要求其声明随每一份副本一同传播。安装数据集之前请先阅读其卡片上的条款，并在展示数据的
> 任何地方显示 `GET /api/v1/meta` 的 `attribution` — [`datasets.md`](datasets.md)。

---

## ⚡ 快速开始

三种方式，从最快捷到最灵活。三种方式的最终结果都是管理面板、API 和已加载好的词典：
使用 Docker 时位于 <http://localhost:3241> 和 <http://localhost:3240>，
不使用 Docker 时位于 <http://localhost:3000> 和 <http://localhost:3010>。

### 1. 运行已发布的镜像

无需克隆仓库 — 一个文件夹、两个文件、Docker：

```bash
mkdir vocab-bloom-hub && cd vocab-bloom-hub
curl -fsSLO https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/.env.example -o .env
```

打开 `.env` 并设置两个密码：`ADMIN_PASSWORD`（管理员登录密码）和 `POSTGRES_PASSWORD`
（内置数据库的密码）。然后：

```bash
docker compose up -d
```

首次启动会下载并导入词典 — 需要几分钟。在此期间 `GET /api/ready` 返回 `503`，
完成后返回 `200`；然后使用 `.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。

```bash
curl -s localhost:3240/api/ready            # {"status":"ok"}
curl -s localhost:3240/api/v1/words/run     # 词典给出响应

# 搜索：匹配的词条，最佳匹配在前
curl -s 'localhost:3240/api/v1/search?search=run&limit=5'
# 同上，并带释义、例句和翻译
curl -s 'localhost:3240/api/v1/search/detailed?search=run&with_meanings=true'
```

> [!TIP]
> 要固定使用某个发布版本而不是 `main` 开发构建，请在 `.env` 中设置 `VBH_TAG=1.2.0`。
> 要在 <http://localhost:3242> 上添加网站（文档、API 参考、演练场、单词页面），请设置
> `COMPOSE_PROFILES=db,site`。

### 2. 从仓库运行

同一个 compose 文件，从源代码构建 — 适用于 fork 或尚未发布的修改：

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
cp .env.example .env                           # 同样的两个密码
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

### 3. 不使用 Docker 运行

直接在机器上以生产模式运行：Node.js 22.13+、Yarn 4（`corepack enable`）和一个
可以连接的 Postgres（[`docs/database.md`](database.md)）。

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
yarn install
printf 'NODE_ENV=production\nDATABASE_URL=postgres://user:password@localhost:5432/vocab_bloom\nADMIN_USERNAME=admin\nADMIN_PASSWORD=change-me\nNEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api\nDICTIONARY_AUTO_IMPORT=true\n' > .env
yarn build && yarn start                       # API :3010，管理面板 :3000；词典在首次启动时自行加载
yarn site:build && yarn start:site             # 网站 :3020，可选，在另一个终端中运行
```

在域名和 TLS 之后，使用 systemd 或 PM2：[`docs/deployment/`](deployment/README.md)。

### 用于开发

无需数据库：没有 `DATABASE_URL` 时服务器使用本地 SQLite 文件，并且每个应用在代码
变更时自动重启。

```bash
printf 'NODE_ENV=development\nADMIN_USERNAME=admin\nADMIN_PASSWORD=change-me\nNEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api\n' > .env
yarn dev                                       # API :3010，管理面板 :3000，网站 :3020
```

> [!IMPORTANT]
> 请在管理面板中使用 _Managing → Datasets → Import_ 加载词典。

贡献者需要的其他一切：[`CONTRIBUTING.md`](../CONTRIBUTING.md)。

### 下一步

- 文档网站，含 API 参考和演练场：
  [vocab-bloom-hub.com](https://vocab-bloom-hub.com/zh/docs)。
- 部署到服务器：[`docs/deployment/`](deployment/README.md) — TLS 和反向代理、
  systemd / PM2、升级。
- 数据库：[`docs/database.md`](database.md) — Postgres 要求、迁移、备份、容量规划。
- 每一项设置：[`docs/environment.md`](environment.md)。
- 指标和日志：[`docs/observability.md`](observability.md) — 一条命令启动 Prometheus 和
  Grafana，或使用您自己的。
- 读取数据：[`docs/api.md`](api.md)，以及 [Node.js](../packages/npm-sdk/README.md) 和
  [Python](../packages/python-sdk/README.md) SDK。

在 PostgreSQL 上，通过 **Managing → Datasets → How to install** 添加其他词典：
默认由服务器下载，也可手动上传。OpenGloss 需要全部六个 Parquet 文件（约 1.32 GB）。
来源、许可协议、分支和转换范围详见 [`datasets.md`](datasets.md)。

---

## 🤝 参与贡献

欢迎贡献。[`CONTRIBUTING.md`](../CONTRIBUTING.md) 介绍了工作流程（分支命名、提交信息、
PR 检查清单）、技术栈和仓库结构、每个脚本、文档索引和路线图；[行为准则](../CODE_OF_CONDUCT.md)
适用于所有交流互动。发现了 bug 或有想法？请开一个
[issue](https://github.com/Fristail27/vocab-bloom-hub/issues/new/choose) — 模板会引导您。

---

## 📄 许可证

- **代码** — [MIT](../LICENSE) © Aleksei Ryzhov (Fristail27)
- **项目的词典数据**（导出文件、公共 API、HuggingFace 数据集）— [CC BY 4.0](../DATA_LICENSE.md)：可自由使用和改编，包括商业用途，需注明出处。
- **其他数据集和引用的材料**保留来源条款：Wiktionary 适用 CC BY-SA 4.0，Open English WordNet
  适用 CC BY 4.0，Princeton WordNet 适用自己的许可协议；OpenGloss 适用 CC BY 4.0，
  标记的单词还适用 WordNet 3.0 条款。自己数据集的贡献许可协议不会替代单词继承的许可协议：
  [`DATA_LICENSE.md`](../DATA_LICENSE.md#datasets-of-other-sources)。

> [!IMPORTANT]
> 项目数据集和 OpenGloss 包含语言模型生成的文本。Wiktionary 和 WordNet 由人工编写。
> 每个数据集都有自己的声明和局限；使用前请阅读 [`data.md`](data.md)。
