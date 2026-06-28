# Image Easy SEO 审计与增长方案

审计日期：2026-06-28  
审计对象：当前项目 `image-easy`  
正式域名证据：`.env.local` 中 `NEXT_PUBLIC_SITE_URL=https://www.image-easy.com`  
本地构建证据：`npm run build` 通过，生成 44 个静态页面；`sitemap.xml` 与 `robots.txt` 可生成。

## 结论

Image Easy 的技术 SEO 底座已经不错：Next.js SSG、多语言 `hreflang`、canonical、sitemap、robots、OG 图片和首页 `SoftwareApplication` 结构化数据都已经具备。真正影响增长的短板不是“搜索引擎能不能抓到”，而是“抓到之后有没有足够的页面、内容、证据和信任信号让 Google 愿意排名”。

当前站点更像一个可用产品壳，而不是一个能获取自然流量的搜索资产。它只有首页、创作页、我的作品页、登录页四类页面，其中 `create` 和 `my-images` 对未登录用户价值有限，Footer 里出现的价格、联系、隐私、条款、日志、状态等入口也还不是实际链接页面。对 Google 来说，站点主题很清楚，但主题深度、商业透明度、原创示例、使用场景覆盖和用户信任还不足。

建议优先级：

1. 先处理索引策略：私有页不要进 sitemap；登录页明确 `noindex`；`create` 要么做成可公开体验的工具页，要么也不要当核心 SEO 页面。
2. 补齐信任和交易页面：Pricing、Privacy、Terms、Contact、About、Status。
3. 把首页改造成“能证明价值”的页面：实际生成案例、模型对比、使用场景、Prompt 示例、FAQ，而不是只讲五个模型。
4. 建立内容集群：模型页、用例页、教程页、对比页、Prompt 模板页、公开示例页。
5. 用 Search Console 和事件数据验证：先看索引覆盖、查询词、页面体验，再按流量和转化滚动迭代。

## Google 机制对照

本报告按 Google 官方搜索文档中的这些机制审计：

- Google Search Essentials：页面要可抓取、可索引、内容对用户有价值。参考：<https://developers.google.com/search/docs/essentials>
- SEO Starter Guide：title、description、站内链接、图片、结构化页面组织要服务用户理解。参考：<https://developers.google.com/search/docs/fundamentals/seo-starter-guide>
- Helpful content：内容要有独特价值、清晰目标用户、实际经验或有用信息，不能只是为了搜索流量批量生成。参考：<https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- AI 内容政策：Google 关注内容质量和是否操纵排名，不是简单按 AI 或人工区分；批量低价值自动化内容有风险。参考：<https://developers.google.com/search/docs/fundamentals/using-gen-ai-content>
- 多语言与 `hreflang`：不同语言版本要互相声明 alternate，canonical 要自洽。参考：<https://developers.google.com/search/docs/specialty/international/localized-versions>
- sitemap：帮助 Google 发现重要 URL，但不保证索引。参考：<https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview>
- 结构化数据：只标记页面真实可见内容，不要给不可见或误导性内容加 schema。参考：<https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data>
- Page Experience / Core Web Vitals：不是唯一排名因素，但会影响体验和竞争环境下的表现。参考：<https://developers.google.com/search/docs/appearance/page-experience>
- Google Images：图片文件、alt、上下文、页面主题和可访问性会影响图片搜索表现。参考：<https://developers.google.com/search/docs/appearance/google-images>

## 当前状态证据

### 页面与路由

当前生产页面文件只有：

- `/[locale]`
- `/[locale]/create`
- `/[locale]/login`
- `/[locale]/my-images`

`npm run build` 输出显示：

- `/[locale]`：SSG，First Load JS 约 107 kB
- `/[locale]/create`：SSG，First Load JS 约 140 kB
- `/[locale]/login`：SSG，First Load JS 约 128 kB
- `/[locale]/my-images`：SSG，First Load JS 约 137 kB
- `/sitemap.xml`、`/robots.txt`：静态生成

### sitemap 与 robots

`sitemap.ts` 当前包含 3 类 SEO 页面：

- `/{locale}`
- `/{locale}/create`
- `/{locale}/my-images`

9 个语言共 27 个 sitemap URL。`/login` 被排除，这个方向是对的。

`robots.txt` 允许所有语言目录，禁止 `/api/`，并声明 sitemap：

- `Sitemap: https://www.image-easy.com/sitemap.xml`

### 多语言

项目支持 9 种语言：

- `en`
- `fr`
- `de`
- `es`
- `it`
- `nl`
- `zh`
- `ja`
- `ko`

页面 metadata 和 sitemap 都包含 `hreflang` 和 `x-default`，`x-default` 指向英文版本。

### metadata

`src/lib/page-metadata.ts` 为每个页面生成：

- `title`
- `description`
- canonical
- alternate languages
- Open Graph

首页 title 和 description 来自 `metadata` namespace；其他页面 title 多数由 H1 文案拼接。

### 结构化数据

首页有 `SoftwareApplication` JSON-LD，包含：

- name
- applicationCategory
- applicationSubCategory
- operatingSystem
- description
- offers
- inLanguage
- url

这是好的起点，但还可以补强 Organization、WebSite、BreadcrumbList、FAQPage、HowTo、ImageObject 等。

## 主要问题

### P0：`my-images` 是私有页，却被放进 sitemap

`/my-images` 对未登录用户会跳转登录或显示私有空状态，本质是用户后台页面。Google 不需要索引“我的作品”，也很难从这个页面获得公共价值。

风险：

- sitemap 提交了低价值或私有意图页面。
- Google 可能抓到登录墙、空状态或弱内容。
- 降低 sitemap 中重要页面的信号密度。

建议：

- 从 `sitemap.ts` 移除 `/my-images`。
- 给 `/[locale]/my-images` 添加 `robots: { index: false, follow: false }`。
- 如果想吃“AI image gallery / AI art examples”流量，另建公开 `/gallery`，展示可公开的精选作品，而不是索引用户私有历史。

### P0：登录页没有明确 `noindex`

`/login` 虽然不在 sitemap，但 Header 里有登录链接，Google 仍可能发现。当前 `layout.tsx` 默认 `robots.index=true`，`login` 的 `generateMetadata` 也没有覆盖。

建议：

- `/[locale]/login` 设置 `noindex, follow`。
- 登录页可保留良好 UX，但不应争取搜索排名。

### P0：`create` 页面作为 SEO 页面价值不足

`/create` 在 sitemap 中，但页面是工作台型页面。未登录用户最终看到的是“登录后创作”的门槛；即使 Google 能渲染 JS，它也很难从这个页面获得足够内容。

建议二选一：

1. 把 `/create` 改成公开工具页：用户可以选择模型、输入 prompt、看参数和示例；真正点击生成时再要求登录。
2. 如果必须登录才可访问，则从 sitemap 移除并 `noindex`，另建 `/ai-image-generator` 或 `/tools/ai-image-generator` 作为公开 SEO 工具页。

更推荐第 1 种，因为工具页有转化价值。

### P1：缺少能建立信任的基础页面

Footer 已展示这些文字，但不是链接，也没有页面：

- Pricing
- Contact
- Privacy
- Terms
- Legal
- Status
- Changelog
- Journal

这些页面不仅是“合规装饰”，还影响用户和搜索引擎对商业实体的信任判断。

建议先补：

- `/pricing`
- `/contact`
- `/privacy`
- `/terms`
- `/about`
- `/status`

其中 Privacy 和 Terms 可以 `index` 或 `noindex` 都可，但必须可访问。Pricing、About、Contact 建议 index。

### P1：首页首屏没有实际产品和结果证据

当前首页首屏主张是“五款 AI 图像模型，一个工作台”。这表达清楚，但不够有差异化，也缺少视觉证明。

问题：

- AI 图像产品最重要的是“生成效果”，但首屏没有真实结果图、模型输出对比或交互预览。
- 文案偏产品口号，关键词覆盖较弱，例如 `AI image generator`、`text to image`、`image editor`、`GPT Image 2`、`Seedream 4.5`、`Gemini image`。
- 缺少“为什么比直接去单个模型更好”的证据。

建议改造首屏：

- H1 用明确搜索意图：`AI Image Generator for GPT Image 2, Seedream 4.5 and Gemini Image`
- 副标题说明价值：一个界面比较并使用多个模型，适合产品图、社媒图、参考图重绘、复杂场景。
- 右侧或下方放真实生成结果网格：同一 prompt 在 3 个模型下的结果对比。
- CTA 分成两类：`Start creating` 和 `Compare models`。

### P1：首页内容重复，语义密度不够

`src/app/[locale]/page.tsx` 中“模型选择”和“模型卡片”附近复用了同一组标题和正文；步骤区的 3 个 step 也复用了前面段落。

影响：

- 页面读起来像占位内容。
- H2/H3 不能承接更多长尾搜索意图。
- Google 更难判断页面包含真实、完整、独特的信息。

建议：

- 模型区：改为“Choose the right model for each job”，加入模型对比表。
- 工作流区：每一步写真实操作说明，而不是复用段落。
- 用例区：产品图、社媒图、海报、参考图编辑、电商图、角色一致性。
- FAQ 区：免费额度、隐私、图片是否保存、支持尺寸、支持模型、商用授权边界。

### P1：缺少“模型页”和“对比页”

你的核心差异点是“多个主流模型整合”。但目前所有模型只在首页卡片里出现，没有独立页面承接搜索意图。

建议新增：

- `/models/gpt-image-2`
- `/models/gpt-image-2-edit`
- `/models/seedream-4-5`
- `/models/seedream-4-5-edit`
- `/models/nano-banana-pro`
- `/compare/gpt-image-2-vs-seedream-4-5`
- `/compare/gpt-image-2-vs-nano-banana-pro`
- `/compare/seedream-4-5-vs-nano-banana-pro`

每页必须有独特内容：

- 模型适合什么任务
- 支持参数
- 输入限制
- 示例 prompt
- 实际输出示例
- 优缺点
- 与其他模型的差异
- 直接跳转创作并预选模型

不要批量生成只有模板差异的薄页面。

### P1：缺少用例页

AI 图像搜索流量很大一部分不是搜模型名，而是搜任务：

- product photo generator
- image to image editor
- AI background changer
- AI poster generator
- AI social media image generator
- AI product photography
- AI character consistency
- AI image prompt examples

建议新增用例集群：

- `/use-cases/product-photos`
- `/use-cases/social-media-images`
- `/use-cases/posters`
- `/use-cases/image-editing`
- `/use-cases/background-change`
- `/use-cases/character-consistency`
- `/use-cases/ecommerce-images`

每个用例页结构：

1. 这个任务适合哪些用户。
2. 推荐模型和参数。
3. 3 到 6 个真实示例。
4. 可复制 prompt 模板。
5. 常见错误和修正方式。
6. CTA：带 query 跳转 `/create?model=...`。

### P1：缺少公开示例页，图片 SEO 没有发挥

这是图片产品，非常适合做图片搜索资产。但当前生成结果只存在用户私有历史或生成结果组件中，没有公开示例。

建议新增：

- `/gallery`
- `/gallery/product-photos`
- `/gallery/posters`
- `/gallery/image-edits`

每个公开图片详情页可以是：

- `/gallery/{slug}`
- 标题：结果主题
- 图片 alt：自然描述，不要堆关键词
- prompt
- model
- aspect ratio
- resolution
- created date
- related examples
- CTA：reuse prompt

结构化数据：

- `ImageObject`
- `BreadcrumbList`

前提是这些图片必须是你有权公开展示的精选内容，不能默认公开用户私有图片。

### P2：标题和 description 太偏品牌，不够关键词化

当前英文首页 title：

- `Image Easy — Five AI image models, one focused interface`

更适合品牌展示，但对新站 SEO 来说，建议更明确匹配搜索意图：

- `Image Easy — AI Image Generator with GPT Image 2, Seedream and Gemini`

首页 description 建议从“no tokens/no dashboards/no clutter”扩展到用户任务：

- `Create and edit images with GPT Image 2, Seedream 4.5 and Gemini image models in one workspace. Generate product photos, social posts, posters and image edits with saved history.`

中文首页 title 可改为：

- `Image Easy — AI 图像生成器，整合 GPT Image 2、Seedream 与 Gemini 图像模型`

### P2：结构化数据还不完整

建议添加：

- 全站 `Organization`：logo、url、sameAs、contactPoint。
- 全站 `WebSite`：name、url、potentialAction 搜索框只有站内搜索时再加。
- 每个公开页面 `BreadcrumbList`。
- 首页/工具页 `SoftwareApplication`：补 `featureList`、`screenshot`、`softwareHelp`、`offers`。
- FAQ 区真实可见时加 `FAQPage`。
- 教程页真实步骤可见时加 `HowTo`。
- 公开 gallery 详情页加 `ImageObject`。

注意：schema 必须对应页面可见内容，不要只为搜索结果加不可见 schema。

### P2：多语言 URL 只翻译了内容，没有翻译搜索意图

当前路径是 `/fr/create`、`/de/create`、`/zh/create`。这在技术上没问题，但对本地化搜索不够强。

建议分两阶段：

1. 短期保留当前路径，先确保每种语言的 title、H1、FAQ、用例页内容符合当地搜索表达。
2. 中期用 `next-intl` 的 `pathnames` 做本地化 slug，例如法语 `/fr/generateur-image-ia`、德语 `/de/ki-bildgenerator`、中文 `/zh/ai-image-generator` 或 `/zh/ai-tuxiang-shengcheng`。

不要急着一次改所有 URL；URL 变更要配 301 和 sitemap 更新。

### P2：图片组件和远程图片策略需要收紧

当前 `next.config.js` 允许所有 `https` 远程图片：

```js
remotePatterns: [
  { protocol: "https", hostname: "**" },
]
```

这对开发方便，但生产不够精细。建议限制到实际图片 CDN 和 kie.ai 结果域名。公开 SEO 图片建议用 `next/image` 或预生成缩略图，确保：

- 图片尺寸稳定，减少 CLS。
- 有描述性 alt。
- 有可缓存缩略图。
- 图片周围有文本上下文。

### P2：OG 图片运行时拉远程字体，社交预览可能不稳定

`src/app/og/route.tsx` 在 Edge runtime 中从 GitHub 拉字体。对 Google 主搜索影响不大，但会影响分享预览稳定性。

建议：

- 把字体文件放到项目内或 public 静态资源。
- 或使用系统字体 fallback，减少外部请求。

### P3：favicon / app icon 缺失风险

构建输出没有显示实际 favicon 文件。Google 搜索结果中的站点图标会影响可信感和点击率。

建议添加：

- `src/app/icon.png` 或 `public/favicon.ico`
- `apple-icon.png`
- manifest 可后续补。

## 缺失页面清单

### 必补信任页

- `/about`：品牌、产品定位、为什么做多模型工作台。
- `/pricing`：免费额度、生成计费、模型成本差异、是否需要信用卡。
- `/contact`：联系邮箱、商务合作、问题反馈。
- `/privacy`：图片、prompt、账号、OAuth、日志、第三方 API 的处理方式。
- `/terms`：使用规则、禁止内容、版权与商用责任。
- `/status`：服务状态，至少先做静态说明页。

### 应补增长页

- `/ai-image-generator`：主关键词工具页。
- `/image-to-image`：参考图编辑页。
- `/text-to-image`：文生图页。
- `/models`：模型总览页。
- `/models/{model}`：每个模型详情页。
- `/compare/{model-a}-vs-{model-b}`：模型对比页。
- `/use-cases/{use-case}`：任务场景页。
- `/prompt-library`：可复制提示词模板。
- `/gallery`：公开精选图集。
- `/blog` 或 `/guides`：教程和评测内容。

### 暂不建议索引的页面

- `/login`
- `/my-images`
- 用户私有历史详情页
- API 路由
- 内部 dev login

## 页面设计改造方案

### 首页

目标：从“产品口号页”改成“能证明价值的工具介绍页”。

建议结构：

1. 首屏：H1 明确关键词 + 真实生成结果对比。
2. 模型选择：用表格展示模型、适合任务、输入、分辨率、优势。
3. 示例结果：同一 prompt 在多个模型下的输出。
4. 用例入口：产品图、社媒、海报、参考图编辑、复杂场景。
5. 工作流：选择模型、写 prompt、调参数、生成、保存历史。
6. Prompt 模板：展示 6 个可复制模板。
7. FAQ：免费额度、隐私、支持格式、生成时间、商用边界。
8. Footer：所有信任页都是真链接。

### 创作页

目标：让它既是产品工作台，也是可索引的工具页。

建议：

- 未登录也展示完整工具界面。
- 点击 Generate 时弹登录，而不是先挡住整个页面。
- 增加“推荐 prompt”和“模型适用建议”。
- 模型卡片增加 use case 标签，例如 Product photos、Edits、Text rendering。
- 参数旁边给简短解释。
- 结果区空状态展示示例图，而不是只有等待提示。
- 给每个模型 query URL 保留可分享入口，例如 `/create?model=seedream-4-5-text-to-image`。

### 我的作品页

目标：私有后台，不承担 SEO。

建议：

- `noindex`。
- 不进 sitemap。
- 如果要做 SEO，另建公开 `/gallery`，不要暴露用户私有作品。

### 模型详情页

目标：承接模型名和模型能力搜索。

建议结构：

1. H1：模型名 + 能力。
2. 简短说明：适合什么任务。
3. 参数表：尺寸、输入图数量、prompt 长度、输出格式。
4. 示例：至少 3 个真实结果。
5. Prompt 模板。
6. 与其他模型对比。
7. FAQ。
8. CTA：使用该模型创作。

### 用例页

目标：承接长尾、高转化任务搜索。

建议结构：

1. H1：任务关键词。
2. 典型用户和结果示例。
3. 推荐模型。
4. 分步骤教程。
5. Prompt 模板。
6. 常见错误和解决方案。
7. 相关用例链接。

## Search Console 应该重点查什么

上线后在 Google Search Console 中优先查：

1. Pages / Indexing：`/en`、`/zh`、`/en/create`、`/en/my-images`、`/en/login` 是否被索引或排除。
2. Sitemaps：提交 `https://www.image-easy.com/sitemap.xml`，确认发现 URL 数与预期一致。
3. URL Inspection：
   - `https://www.image-easy.com/en`
   - `https://www.image-easy.com/en/create`
   - `https://www.image-easy.com/en/my-images`
   - `https://www.image-easy.com/en/login`
   - `https://www.image-easy.com/zh`
4. Performance：看 impressions 高但 CTR 低的 query，用来改 title 和 description。
5. Core Web Vitals：重点看移动端 LCP、CLS、INP。
6. Enhancements：结构化数据是否报错。
7. International Targeting / hreflang 报告如果可用，检查 alternate 是否互相返回。
8. Removals：如果 `/my-images` 或登录页被索引，先 noindex，再等自然移除；紧急时用临时移除。

## 关键词与页面映射

| 搜索意图 | 目标页面 | 页面重点 |
| --- | --- | --- |
| AI image generator | `/ai-image-generator` 或首页 | 多模型生成、免费额度、示例 |
| text to image | `/text-to-image` | 文生图模型、prompt 模板、示例 |
| image to image | `/image-to-image` | 参考图编辑、前后对比 |
| GPT Image 2 generator | `/models/gpt-image-2` | 模型能力、示例、参数 |
| Seedream 4.5 | `/models/seedream-4-5` | 4K、复杂场景、适用任务 |
| Nano Banana Pro / Gemini image | `/models/nano-banana-pro` | 一致性、编辑、4K |
| AI product photo generator | `/use-cases/product-photos` | 电商图、背景、尺寸、模板 |
| AI prompt examples | `/prompt-library` | 可复制模板、按场景筛选 |
| AI image model comparison | `/compare/...` | 对比表、同 prompt 输出 |
| pricing / cost | `/pricing` | 免费额度、模型消耗、限制 |

## 90 天路线图

### 第 1 周：技术索引修正

- 从 sitemap 移除 `/my-images`。
- `/login`、`/my-images` 设置 `noindex`。
- 明确 `/create` 策略：公开工具页或 noindex。
- Footer 中的 Pricing、Contact、Privacy、Terms 改成真实链接。
- 添加 favicon / icon。
- 确认 `www` 与非 `www`、HTTP 与 HTTPS 都 301 到 canonical 域名。

### 第 2 到 3 周：首页和工具页改造

- 首页加入真实生成案例。
- 首页加入模型对比表。
- 首页加入 FAQ。
- `/create` 未登录也展示工具，生成动作再登录。
- 空结果区展示示例，而不是纯空状态。

### 第 4 到 6 周：信任页和模型页

- 上线 About、Pricing、Contact、Privacy、Terms。
- 上线 `/models` 和 5 个模型详情页。
- 每个模型页至少有 3 个真实示例和 5 个 prompt 模板。
- 添加 BreadcrumbList 和更完整的 SoftwareApplication schema。

### 第 7 到 10 周：用例页和公开图库

- 上线 5 到 7 个用例页。
- 上线公开 `/gallery`。
- 每个公开图片有独立详情页、描述性 alt、prompt、模型、相关图。
- 添加 ImageObject schema。

### 第 11 到 13 周：内容增长与数据迭代

- 每周发布 2 到 3 篇教程或对比内容。
- 根据 Search Console 调整 title 和 description。
- 优化 CTR 低的页面。
- 对 impression 高但排名低的 query 补内容区块。
- 建立内部链接：首页 -> 用例 -> 模型 -> 创作页 -> gallery。

## 建议的第一批代码任务

1. 改 `src/app/sitemap.ts`：移除 `/my-images`；保留 `/create` 的前提是把它改成公开工具页。
2. 改 metadata：`login` 和 `my-images` 支持单独 robots 策略。
3. 新增页面骨架：`about`、`pricing`、`contact`、`privacy`、`terms`。
4. 首页新增模型对比表和 FAQ。
5. Footer span 改成真实 `Link`。
6. 新增 icon/favicon。
7. 新增 `Organization`、`WebSite`、`BreadcrumbList` schema。

## 最重要的一句话

现在 Image Easy 的技术 SEO 是“可被 Google 理解”的，但增长 SEO 还缺“可被用户和 Google 信任、比较、引用、点击的内容资产”。先把私有页索引策略修正，再把首页和创作页从极简产品介绍改成有真实示例、模型对比、用例入口和 FAQ 的公开落地页，才会真正产生搜索价值。
