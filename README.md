# Image Easy

集成多个顶级 AI 图像模型的文生图 / 图生图工作台。技术栈 Next.js 15 + NextAuth + Prisma + PostgreSQL + kie.ai。

## 支持的模型

| 模型 | 提供方 | 类型 | 说明 |
|------|--------|------|------|
| **GPT Image 2** | OpenAI | 文生图 | 最新 GPT-Image-2，文字渲染、真实感业界领先 |
| **GPT Image 2 (Edit)** | OpenAI | 图生图 | 局部重绘、风格化，最多 16 张参考图 |
| **Seedream 4.5** | ByteDance | 文生图 | 4K 高保真、复杂场景 |
| **Seedream 4.5 (Edit)** | ByteDance | 图生图 | 保留主体身份精修 |
| **Nano Banana Pro** | Google | 图生图 | Gemini 3.0 Pro Image，多物体一致性 |

## 快速开始

### 前置条件

- **Node.js 20+** (推荐 22)
- **Docker + Docker Compose** (用于本地 PostgreSQL)
- **kie.ai API Key**: 在 https://kie.ai/api-key 注册获取
- **Google OAuth 凭据**: 在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 创建 OAuth 2.0 Client

### 1. 启动数据库

```bash
docker compose up -d
```

会启动 PostgreSQL 16 在 `localhost:5433`（避开系统已有的 5432）。

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入：

- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: Google OAuth 凭据
- `AUTH_SECRET`: 一个 32+ 字符的随机字符串（生产环境）
- `KIE_API_KEY`: kie.ai 的 API key
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: Google Analytics 4 Measurement ID，例如 `G-XXXXXXXXXX`；不配置则不加载 GA
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME`: Cloudflare R2 存储桶配置
- `R2_PUBLIC_BASE_URL`: R2 自定义域名或公开访问基础 URL；如果使用私有桶和签名 URL，可以留空
- `R2_SIGNED_URL_TTL_SECONDS`: R2 签名下载 URL 的有效期，默认 `3600`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`: Stripe Checkout 和 webhook 服务端密钥
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe 前端 publishable key
- `ENABLE_PAID_CREDITS`: 设置为 `true` 后显示订阅套餐并允许创建 Stripe Checkout
- `STRIPE_PRICE_STARTER_MONTHLY` / `STRIPE_PRICE_CREATOR_MONTHLY` / `STRIPE_PRICE_STUDIO_MONTHLY`: 三个按月订阅 Price ID
- `STRIPE_PRICE_STARTER_ANNUAL` / `STRIPE_PRICE_CREATOR_ANNUAL` / `STRIPE_PRICE_STUDIO_ANNUAL`: 三个年付订阅 Price ID
- `CRON_SECRET`: Vercel Cron 调用年付月度积分发放接口的密钥
- `NEXT_PUBLIC_APP_URL`: 站点公开 URL，生产环境使用 `https://www.image-easy.com`

### 3. 初始化数据库

```bash
npm install
npx prisma db push    # 把 schema 推到数据库
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

### 5. Google OAuth 回调 URL

在你的 Google Cloud Console OAuth Client 里添加：

- Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

## Google OAuth 创建步骤

1. 打开 https://console.cloud.google.com/apis/credentials
2. 创建 OAuth 2.0 Client ID（应用类型：Web application）
3. Authorized JavaScript origins: `http://localhost:3000`
4. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. 复制 Client ID 和 Client Secret 到 `.env`

## kie.ai API Key

1. 打开 https://kie.ai/api-key 注册账号
2. 在 Dashboard 创建 API Key
3. 复制到 `.env` 的 `KIE_API_KEY`

新注册用户有免费额度可以测试。

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth handlers
│   │   ├── upload/route.ts                # 上传图片到 kie.ai
│   │   ├── generate/route.ts              # 提交生成任务
│   │   ├── generate/[id]/route.ts         # 查询生成任务状态
│   │   └── history/route.ts               # 历史记录 CRUD
│   ├── create/page.tsx                    # 主创作页
│   ├── my-images/page.tsx                 # 历史作品页
│   ├── login/page.tsx                     # 登录页
│   ├── layout.tsx
│   ├── page.tsx                           # 首页
│   └── globals.css
├── components/
│   ├── Header.tsx
│   ├── ModelSelector.tsx
│   ├── ModelParams.tsx
│   ├── PromptInput.tsx
│   ├── ImageUploader.tsx
│   ├── GenerationResult.tsx
│   └── HistoryGrid.tsx
├── lib/
│   ├── auth.ts                            # NextAuth 配置
│   ├── db.ts                              # Prisma client
│   ├── kie.ts                             # kie.ai API 客户端
│   ├── models.ts                          # 模型元数据
│   └── utils.ts
└── types/
prisma/
└── schema.prisma                          # 数据模型
docker-compose.yml                         # PostgreSQL
```

## 数据模型

- **User**: 用户、积分、OAuth 关联
- **Account / Session / VerificationToken**: NextAuth 标准表
- **Upload**: 上传的图片（kie.ai 托管的 URL）
- **Generation**: 生成历史（含 prompt、参数、taskId、结果 URL、状态）

## 关键设计

1. **异步任务模型**：kie.ai 是异步的（提交 → 拿 taskId → 轮询）。客户端先调用 `/api/generate` 创建任务，再轮询 `/api/generate/:id` 获取状态和结果，避免服务端请求被 serverless 执行时长截断。
2. **指数退避轮询**：客户端 2s → 3s → 4.5s ... 上限 10s。
3. **图片上传**：图生图需要参考图，前端用 base64 → kie.ai 临时存储 → 拿到 URL → 传给生成端点。
4. **NextAuth v5 JWT session**：避免每次请求都查 DB。
5. **历史记录自动持久化**：每次生成的参数、结果、状态都进库。

## 部署

### Vercel / Docker

把项目推到 GitHub，然后：

1. Vercel: 导入项目，添加环境变量，部署。
2. Docker: 自己起 Next.js standalone build。

### 生产数据库

把 `DATABASE_URL` 换成生产 PostgreSQL（Neon / Supabase / RDS 都行），跑 `npx prisma db push`。

本项目当前用 `npx prisma db push` / `npm run db:push` 应用 schema 变更；生产环境必须先对生产数据库执行同步，再部署会写入新字段的路由（例如 `Upload.r2Key`、`Asset`、`Generation.resultAssetKeys`、`Generation.storageStatus`、`Generation.storageStartedAt`、`Generation.storageAttemptId`）。

### 环境变量

生产环境除了数据库、Auth 和 kie.ai 配置外，还需要按实际部署方式配置 R2：

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
R2_SIGNED_URL_TTL_SECONDS=3600
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENABLE_PAID_CREDITS=false
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_CREATOR_MONTHLY=
STRIPE_PRICE_STUDIO_MONTHLY=
STRIPE_PRICE_STARTER_ANNUAL=
STRIPE_PRICE_CREATOR_ANNUAL=
STRIPE_PRICE_STUDIO_ANNUAL=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=https://www.image-easy.com
```

- `R2_ACCOUNT_ID`: Cloudflare 账户 ID，用于拼接 R2 S3 API endpoint。
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`: R2 API Token 的访问密钥，不要提交到代码仓库。
- `R2_BUCKET_NAME`: 保存用户上传图和生成结果的 R2 bucket 名称。
- `R2_PUBLIC_BASE_URL`: 如果 bucket 绑定了公开域名，填完整基础 URL；私有 bucket 或只使用签名 URL 时可以留空。
- `R2_SIGNED_URL_TTL_SECONDS`: 私有资源签名 URL 的有效期秒数，未配置时默认 `3600`。
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: Google Analytics 4 Measurement ID；缺省时前端不会注入 GA 脚本。
- `STRIPE_SECRET_KEY`: Stripe secret key，用于服务端创建 Checkout Session。
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook endpoint secret，用于 `/api/stripe/webhook` 验签。
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key，供前端 Stripe 集成使用。
- `ENABLE_PAID_CREDITS`: 生产打开支付时设为 `true`；未开启时价格页只展示限时免费说明。
- `STRIPE_PRICE_*`: Stripe 后台创建 6 个 recurring Price 后，把对应 `price_xxx` 填入。月付为 $9.90 / $29.90 / $69.90；年付为 $99 / $299 / $699。
- `CRON_SECRET`: 保护 `/api/cron/subscription-credits`。年付订阅首月由 Stripe webhook 发放，后续每月由 Vercel Cron 发放。
- `NEXT_PUBLIC_APP_URL`: Checkout success/cancel 回跳的公开站点 URL，生产环境设置为 `https://www.image-easy.com`。

### Stripe webhook 事件

Stripe webhook endpoint 配置为：

```text
https://www.image-easy.com/api/stripe/webhook
```

至少勾选这些事件：

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `invoice.paid`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## License

MIT
