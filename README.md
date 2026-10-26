# 数字商品商城

一个可直接用 Docker 跑起来的数字商品商城：前台游客下单、自动发货卡密，后台管理订单、商品和卡密。默认是演示模式，付款走模拟流程，不收真实款项，适合先跑通、再接真实支付。

> 本项目为原创实现，未复制任何第三方网站的代码、文案和图片。种子数据均为占位商品和 `DEMO-` 开头的演示卡密，上线前必须替换为真实商品和卡密。

## 📝 项目简介

**面向谁**

想快速搭建一个卖数字商品（会员、验证服务、账号、邮箱 ID、人工服务等）的小商城的开发者和个体经营者：不需要先做一整套账号体系，游客就能下单；付款成功后卡密自动发货，订单随时可查。

**核心链路**

挑选商品 → 加入购物车 → 填写邮箱或手机号 → 支付宝 / 微信支付（演示为模拟支付）→ 支付成功后自动发货 → 凭订单号 + 联系方式在订单查询里查看卡密。

**后台能力**

- 数据概览：订单、商品、卡密的整体情况
- 订单管理：搜索订单、查看详情、未使用卡密退款（需勾选确认未使用）
- 商品管理：新建 / 编辑商品、上下架、库存统计
- 卡密管理：按商品和状态筛选、批量导入（一行一条）
- 后台接口全部要求管理员 JWT 登录，登录失败 5 次锁定 5 分钟，token 有效期 8 小时

**技术特点**

- 前后端分离，前端只通过相对路径 `/api` 访问后端，不写死 localhost，访客浏览器不会连错地址
- 自动发货用 Redis 订单锁 + PostgreSQL `FOR UPDATE SKIP LOCKED`，避免同一订单重复发货、同一条卡密发给两个人
- 退款会把未使用的卡密回滚为可售状态
- 部署只对外暴露 Nginx 一个入口，数据库、缓存、后端和前端都不映射到宿主机端口

## 🐳 Docker 一键体验

要求：Docker + Docker Compose v2。

```bash
git clone https://github.com/xianpan-tech/digital-shop.git
cd digital-shop
cp .env.example .env
# 打开 .env，把 JWT_SECRET、数据库密码等占位值换成你自己的强随机值
docker compose up --build -d
docker compose ps
```

### 访问服务

| 服务 | 地址 | 说明 |
| --- | --- | --- |
| 前台商城 | http://localhost/ | 分类、商品、购物车、结算、订单查询、FAQ |
| 后台管理 | http://localhost/admin | 需管理员登录，见下文 |
| 健康检查 | http://localhost/api/health | 返回 `{"ok":true,"mock":true}` 即为演示模式正常 |

### 创建管理员账号

后台没有默认账号和默认密码，先在后端容器里建一个（密码至少 12 位）：

```bash
docker compose exec backend node src/scripts/create-admin.js 你的邮箱 '你的强密码'
```

然后用这个邮箱和密码登录 http://localhost/admin。

## 📖 系统功能

### 前台

- 首页：分类、商品列表、价格、库存状态（有货 / 低库存 / 缺货）
- 商品详情弹窗：包含内容、使用说明、售后说明
- 购物车抽屉：数量增减、删除、合计
- 结算弹窗：选择支付宝 / 微信支付，填写邮箱或手机号
- 订单查询：输入订单号 + 下单时的邮箱或手机号，验证后查看状态和卡密
- 支付成功页、FAQ 手风琴
- 游客购买：无需注册即可下单

### 后台

- 数据概览、订单搜索与详情、退款
- 商品新建 / 编辑 / 上下架、库存统计
- 卡密筛选与批量导入

### 支付与发货

- 支付宝、微信支付接入结构 + 回调验签占位，演示模式下走模拟支付
- 支付回调验签通过后自动发货；无卡密时订单保持已支付、等待补货，不会误标为已发货
- 卡密类商品即时发货，人工交付类商品由客服后续联系

## 🔐 运行环境

| 运行环境 | 要求 |
| --- | --- |
| 操作系统 | Linux / macOS / Windows（有 Docker 即可） |
| 容器 | Docker + Docker Compose v2 |
| 对外端口 | 80（Nginx，演示）；生产 HTTPS 再放行 443 |
| 数据库 | PostgreSQL 16（容器内，不对外映射） |
| 缓存 | Redis 7（容器内，不对外映射） |
| Node.js | 20（容器内已固定，前端构建用 npm 镜像源见 Dockerfile 注释） |

## 📺 开发环境与技术栈

### 前端技术栈

| 技术 | 版本 / 说明 |
| --- | --- |
| Next.js | 14.2.35（App Router，已修复 React Server Components 相关安全问题） |
| React | 18.3.1 |
| Tailwind CSS | 3.4 + PostCSS + autoprefixer |
| 图标 | lucide-react |

### 后端技术栈

| 技术 | 版本 / 说明 |
| --- | --- |
| Node.js + Express | 后端接口，端口 4000（仅容器内） |
| PostgreSQL | 16，订单、商品、卡密、用户表 |
| Redis | 7，自动发货订单锁 |
| JWT + bcrypt | 后台登录鉴权与密码校验 |
| Nginx | 1.25-alpine，唯一对外入口，反代 `/` 到前端、`/api/` 到后端 |

### 目录结构

```
digital-shop/
├── README.md
├── docker-compose.yml
├── .env.example
├── nginx/nginx.conf
├── db/
│   ├── init.sql          # 建表
│   └── seed.sql          # 占位商品与 DEMO- 演示卡密
├── frontend/             # Next.js 前端
│   ├── Dockerfile
│   ├── package.json
│   └── app/              # 首页、后台 /admin、支付成功页
└── backend/              # Express 后端
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.js
        ├── db.js
        ├── routes/       # 订单、商品、卡密、后台、登录
        ├── services/     # 自动发货
        ├── payments/     # 支付宝、微信接入结构
        └── scripts/     # create-admin.js
```

## ⚙️ 配置说明

所有配置都在 `.env` 里，仓库里只有 `.env.example`，**不要把真实 `.env` 提交到 Git**。

| 配置项 | 说明 |
| --- | --- |
| `PAYMENT_MOCK` | `true` = 模拟支付（默认，演示用）；`false` = 真实支付，生产必须 |
| `JWT_SECRET` | 后台登录签名密钥，生产必须换成强随机字符串，未配置时后台直接拒绝 |
| `POSTGRES_PASSWORD` / `REDIS_PASSWORD` | 数据库和缓存密码，生产必须换 |
| `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY` | 支付宝生产必填，演示可留空 |
| `WECHAT_APPID` / `WECHAT_MCHID` / `WECHAT_API_KEY` | 微信支付生产必填，演示可留空，证书放 `backend/certs/`（已被 .gitignore 排除） |

生产上线前还必须做完这几件事：

1. `PAYMENT_MOCK=false`，并接通真实支付宝 / 微信验签
2. 清空种子数据里的占位商品，导入真实商品和真实卡密
3. 放行 HTTPS（Nginx 里 443 相关配置目前是注释状态，需配证书后取消注释）
4. 只给自己或可信 IP 开放后台访问，定期换管理员密码

## 🙋 常见问题

**游客可以购买吗？**

可以。下单时填写邮箱或手机号，付款成功后凭订单号在「订单查询」里查看卡密，无需注册。

**付款后多久发货？**

卡密类商品支付成功后自动即时发货，卡密会显示在订单查询结果中；人工交付类商品会有客服主动联系。

**可以退款吗？**

未使用的卡密可以申请退款；已使用或已查看的卡密不支持自动退款，人工服务类请联系客服协商。

**订单号丢了怎么办？**

下单时填写的邮箱或手机号会作为查询凭证，在「订单查询」中输入任意一项即可找回订单并查看卡密。

## 📄 开源协议

本项目采用 MIT License，见 `LICENSE` 文件。
