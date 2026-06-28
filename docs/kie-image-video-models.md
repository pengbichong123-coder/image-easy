# KIE 图片与视频模型开发文档整理

整理时间：2026-06-28  
来源：[KIE 中文文档](https://docs.kie.ai/cn)、[KIE llms.txt](https://docs.kie.ai/llms.txt)

## 通用接入方式

大多数 KIE Market 图片/视频模型使用统一异步任务接口：

| 类型 | 接口 |
| --- | --- |
| Base URL | `https://api.kie.ai` |
| 鉴权 | `Authorization: Bearer YOUR_API_KEY` |
| 创建任务 | `POST /api/v1/jobs/createTask` |
| 查询任务 | `GET /api/v1/jobs/recordInfo?taskId={taskId}` |
| 回调字段 | `callBackUrl` |

统一任务请求通常包含：

```json
{
  "model": "model-name",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {}
}
```

生产环境建议使用 `callBackUrl` 接收完成通知，减少轮询。注意官方字段写法多为 `callBackUrl`，不是常见的 `callbackUrl`。

## 图片模型

| 系列 | 模型列表 | 支持能力 | 专用 API | 开发注意事项 | 模型开发文档链接 |
| --- | --- | --- | --- | --- | --- |
| Seedream | Seedream 3.0、4.0、4.5、5.0 Lite | 文生图、图片编辑、图生图 | 否 | 不同版本使用不同 `model`，如 `bytedance/seedream-v4-text-to-image`、`seedream/4.5-edit`。 | [3.0](https://docs.kie.ai/cn/market/seedream/seedream-v3.md)、[4.0 文生图](https://docs.kie.ai/cn/market/seedream/seedream-v4-text-to-image.md)、[4.0 编辑](https://docs.kie.ai/cn/market/seedream/seedream-v4-edit.md)、[4.5 文生图](https://docs.kie.ai/cn/market/seedream/4-5-text-to-image.md)、[4.5 编辑](https://docs.kie.ai/cn/market/seedream/4-5-edit.md)、[5.0 Lite 文生图](https://docs.kie.ai/cn/market/seedream/5-lite-text-to-image.md)、[5.0 Lite 编辑](https://docs.kie.ai/cn/market/seedream/5-lite-image-to-image.md) |
| Z-image | Z-image | 图片生成 | 否 | 走统一 `createTask`，按页面 schema 传 `input`。 | [Z-image](https://docs.kie.ai/cn/market/z-image/z-image.md) |
| Google | Imagen4 Fast、Imagen4 Ultra、Imagen4、Nano Banana、Nano Banana Edit、Nano Banana Pro、Nano Banana 2 | 文生图、图生图、图片编辑 | 否 | Imagen 和 Nano Banana 是不同模型族；图像输入类模型需确保图片 URL 可访问。 | [Nano Banana 2](https://docs.kie.ai/cn/market/google/nanobanana2.md)、[Imagen4 Fast](https://docs.kie.ai/cn/market/google/imagen4-fast.md)、[Imagen4 Ultra](https://docs.kie.ai/cn/market/google/imagen4-ultra.md)、[Imagen4](https://docs.kie.ai/cn/market/google/imagen4.md)、[Nano Banana Edit](https://docs.kie.ai/cn/market/google/nano-banana-edit.md)、[Nano Banana](https://docs.kie.ai/cn/market/google/nano-banana.md)、[Nano Banana Pro](https://docs.kie.ai/cn/market/google/pro-image-to-image.md) |
| Flux-2 | Pro Text to Image、Pro Image to Image、Flex Text to Image、Flex Image to Image | 文生图、图生图 | 否 | Pro/Flex 分别是不同档位或能力路径，按具体页面的 `model` 接入。 | [Pro 图生图](https://docs.kie.ai/cn/market/flux2/pro-image-to-image.md)、[Pro 文生图](https://docs.kie.ai/cn/market/flux2/pro-text-to-image.md)、[Flex 图生图](https://docs.kie.ai/cn/market/flux2/flex-image-to-image.md)、[Flex 文生图](https://docs.kie.ai/cn/market/flux2/flex-text-to-image.md) |
| Grok Imagine | Text to Image、Image to Image | 文生图、图生图 | 否 | 图生图页面有文件上传/图片输入要求，需提前校验图片大小、格式和可访问性。 | [文生图](https://docs.kie.ai/cn/market/grok-imagine/text-to-image.md)、[图生图](https://docs.kie.ai/cn/market/grok-imagine/image-to-image.md) |
| GPT Image | GPT Image 1.5、GPT Image 2 | 文生图、图生图 | 否 | GPT Image Market 模型和 4o Image 专用 API 是两套接入，不要混用。 | [GPT Image 1.5 文生图](https://docs.kie.ai/cn/market/gpt-image/1-5-text-to-image.md)、[GPT Image 1.5 图生图](https://docs.kie.ai/cn/market/gpt-image/1-5-image-to-image.md)、[GPT Image 2 文生图](https://docs.kie.ai/cn/market/gpt/gpt-image-2-text-to-image.md)、[GPT Image 2 图生图](https://docs.kie.ai/cn/market/gpt/gpt-image-2-image-to-image.md) |
| Topaz | Image Upscale | 图片放大、画质优化 | 否 | 后处理型模型，核心输入是源图片。 | [Image Upscale](https://docs.kie.ai/cn/market/topaz/image-upscale.md) |
| Recraft | Remove Background、Crisp Upscale | 去背景、图片放大 | 否 | 后处理型模型，通常需要传入源图片 URL。 | [Remove Background](https://docs.kie.ai/cn/market/recraft/remove-background.md)、[Crisp Upscale](https://docs.kie.ai/cn/market/recraft/crisp-upscale.md) |
| Ideogram | Character、Character Edit、Character Remix、V3 Text to Image、V3 Edit、V3 Remix | 角色图像生成、角色编辑、重混、文生图 | 否 | Character 系列偏角色一致性/参考图工作流；V3 系列按文生图、编辑、重混分别接入。 | [Character Edit](https://docs.kie.ai/cn/market/ideogram/character-edit.md)、[Character Remix](https://docs.kie.ai/cn/market/ideogram/character-remix.md)、[Character](https://docs.kie.ai/cn/market/ideogram/character.md)、[V3 文生图](https://docs.kie.ai/cn/market/ideogram/v3-text-to-image.md)、[V3 Edit](https://docs.kie.ai/cn/market/ideogram/v3-edit.md)、[V3 Remix](https://docs.kie.ai/cn/market/ideogram/v3-remix.md) |
| Qwen | Qwen Text to Image、Qwen Image to Image、Qwen Image Edit、Qwen2 Text to Image、Qwen2 Image Edit | 文生图、图生图、图片编辑 | 否 | Qwen 与 Qwen2 是独立模型路径，不要只靠系列名路由。 | [Qwen 文生图](https://docs.kie.ai/cn/market/qwen/text-to-image.md)、[Qwen 图生图](https://docs.kie.ai/cn/market/qwen/image-to-image.md)、[Qwen 图片编辑](https://docs.kie.ai/cn/market/qwen/image-edit.md)、[Qwen2 图片编辑](https://docs.kie.ai/cn/market/qwen2/image-edit.md)、[Qwen2 文生图](https://docs.kie.ai/cn/market/qwen2/text-to-image.md) |
| Wan | Wan 2.7 Image、Wan 2.7 Image Pro | 图片生成、图片编辑 | 否 | 与 Wan 视频模型同系列，但能力和输入 schema 不同。 | [Wan 2.7 Image](https://docs.kie.ai/cn/market/wan/2-7-image.md)、[Wan 2.7 Image Pro](https://docs.kie.ai/cn/market/wan/2-7-image-pro.md) |
| 4o Image API | Generate 4o Image、Get Details、Get Download URL | 4o 图片生成、查询、直链下载 | 是 | 不走 Market 统一任务。专用路径：`/api/v1/gpt4o-image/generate`、`/api/v1/gpt4o-image/record-info`、`/api/v1/gpt4o-image/download-url`。生成图保存 14 天，下载 URL 有效期 20 分钟。 | [生成](https://docs.kie.ai/cn/4o-image-api/generate-4-o-image.md)、[详情](https://docs.kie.ai/cn/4o-image-api/get-4-o-image-details.md)、[下载 URL](https://docs.kie.ai/cn/4o-image-api/get-4-o-image-download-url.md) |
| Flux Kontext API | Generate or Edit Image、Get Image Details | Flux Kontext 图像生成、图像编辑、查询 | 是 | 不走 Market 统一任务。专用路径：`/api/v1/flux/kontext/generate`、`/api/v1/flux/kontext/record-info`。 | [生成或编辑](https://docs.kie.ai/cn/flux-kontext-api/generate-or-edit-image.md)、[详情](https://docs.kie.ai/cn/flux-kontext-api/get-image-details.md) |

## 视频模型

| 系列 | 模型列表 | 支持能力 | 专用 API | 开发注意事项 | 模型开发文档链接 |
| --- | --- | --- | --- | --- | --- |
| Grok Imagine | Text to Video、Image to Video、Video Upscale、Video Extend、Video 1.5 Preview | 文生视频、图生视频、视频放大、视频扩展 | 否 | Upscale/Extend 通常需要已有任务或视频来源。 | [文生视频](https://docs.kie.ai/cn/market/grok-imagine/text-to-video.md)、[图生视频](https://docs.kie.ai/cn/market/grok-imagine/image-to-video.md)、[放大](https://docs.kie.ai/cn/market/grok-imagine/upscale.md)、[扩展](https://docs.kie.ai/cn/market/grok-imagine/extend.md)、[1.5 Preview](https://docs.kie.ai/cn/market/grok-imagine/1-5-preview.md) |
| Kling | 2.6 T2V/I2V、V2.5 Turbo Pro、V2.1 Master/Pro/Standard、V3 Turbo、Kling 3.0、motion-control、AI Avatar | 文生视频、图生视频、动作控制、数字人、多镜头视频 | 否 | motion-control 2.6/3.0 有文件上传要求；Kling 3.0 支持多镜头和元素引用；Avatar 输入字段与普通 T2V/I2V 不同。 | [2.6 文生视频](https://docs.kie.ai/cn/market/kling/text-to-video.md)、[2.6 图生视频](https://docs.kie.ai/cn/market/kling/image-to-video.md)、[2.5 Turbo I2V](https://docs.kie.ai/cn/market/kling/v25-turbo-image-to-video-pro.md)、[2.5 Turbo T2V](https://docs.kie.ai/cn/market/kling/v25-turbo-text-to-video-pro.md)、[Avatar Standard](https://docs.kie.ai/cn/market/kling/ai-avatar-standard.md)、[Avatar Pro](https://docs.kie.ai/cn/market/kling/ai-avatar-pro.md)、[2.1 Master I2V](https://docs.kie.ai/cn/market/kling/v2-1-master-image-to-video.md)、[2.1 Master T2V](https://docs.kie.ai/cn/market/kling/v2-1-master-text-to-video.md)、[2.1 Pro](https://docs.kie.ai/cn/market/kling/v2-1-pro.md)、[2.1 Standard](https://docs.kie.ai/cn/market/kling/v2-1-standard.md)、[2.6 Motion Control](https://docs.kie.ai/cn/market/kling/motion-control.md)、[3.0 Motion Control](https://docs.kie.ai/cn/market/kling/motion-control-v3.md)、[Kling 3.0](https://docs.kie.ai/cn/market/kling/kling-3-0.md)、[V3 Turbo T2V](https://docs.kie.ai/cn/market/kling/v3-turbo-text-to-video.md)、[V3 Turbo I2V](https://docs.kie.ai/cn/market/kling/v3-turbo-image-to-video.md) |
| Bytedance | Seedance 2.0、Seedance 2.0 Fast、Seedance 2.0 Mini、Seedance 1.5 Pro、V1 Pro/Fast/Lite T2V/I2V | 文生视频、图生视频 | 否 | Fast/Mini/Pro/Lite 是不同成本和能力档位，不能只按厂商名选择。 | [Seedance 2.0](https://docs.kie.ai/cn/market/bytedance/seedance-2.md)、[2.0 Fast](https://docs.kie.ai/cn/market/bytedance/seedance-2-fast.md)、[2.0 Mini](https://docs.kie.ai/cn/market/bytedance/seedance-2-mini.md)、[1.5 Pro](https://docs.kie.ai/cn/market/bytedance/seedance-1-5-pro.md)、[V1 Pro Fast I2V](https://docs.kie.ai/cn/market/bytedance/v1-pro-fast-image-to-video.md)、[V1 Pro I2V](https://docs.kie.ai/cn/market/bytedance/v1-pro-image-to-video.md)、[V1 Pro T2V](https://docs.kie.ai/cn/market/bytedance/v1-pro-text-to-video.md)、[V1 Lite I2V](https://docs.kie.ai/cn/market/bytedance/v1-lite-image-to-video.md)、[V1 Lite T2V](https://docs.kie.ai/cn/market/bytedance/v1-lite-text-to-video.md) |
| Hailuo | 2.3 Pro/Standard I2V、02 Pro/Standard T2V/I2V | 文生视频、图生视频 | 否 | 2.3 页面出现 1080P 相关能力提示；Standard/Pro 档位需要分开计费与路由。 | [2.3 Pro I2V](https://docs.kie.ai/cn/market/hailuo/2-3-image-to-video-pro.md)、[2.3 Standard I2V](https://docs.kie.ai/cn/market/hailuo/2-3-image-to-video-standard.md)、[Pro T2V](https://docs.kie.ai/cn/market/hailuo/02-text-to-video-pro.md)、[Pro I2V](https://docs.kie.ai/cn/market/hailuo/02-image-to-video-pro.md)、[Standard T2V](https://docs.kie.ai/cn/market/hailuo/02-text-to-video-standard.md)、[Standard I2V](https://docs.kie.ai/cn/market/hailuo/02-image-to-video-standard.md) |
| Wan | 2.2 A14B、2.5、2.6、2.7、Flash、Animate Move、Animate Replace | 文生视频、图生视频、视频转视频、语音转视频、动画、视频编辑、参考生视频 | 否 | Wan 子模型很多，`input` 差异较大，尤其 speech-to-video、video-edit、reference-to-video、animate 类任务。 | [2.6 I2V](https://docs.kie.ai/cn/market/wan/2-6-image-to-video.md)、[2.6 T2V](https://docs.kie.ai/cn/market/wan/2-6-text-to-video.md)、[2.6 V2V](https://docs.kie.ai/cn/market/wan/2-6-video-to-video.md)、[2.2 I2V](https://docs.kie.ai/cn/market/wan/2-2-a14b-image-to-video-turbo.md)、[2.2 T2V](https://docs.kie.ai/cn/market/wan/2-2-a14b-text-to-video-turbo.md)、[2.2 Speech](https://docs.kie.ai/cn/market/wan/2-2-a14b-speech-to-video-turbo.md)、[Animate Move](https://docs.kie.ai/cn/market/wan/2-2-animate-move.md)、[Animate Replace](https://docs.kie.ai/cn/market/wan/2-2-animate-replace.md)、[Flash I2V](https://docs.kie.ai/cn/market/wan/2-6-flash-image-to-video.md)、[Flash V2V](https://docs.kie.ai/cn/market/wan/2-6-flash-video-to-video.md)、[2.5 I2V](https://docs.kie.ai/cn/market/wan/2-5-image-to-video.md)、[2.5 T2V](https://docs.kie.ai/cn/market/wan/2-5-text-to-video.md)、[2.7 T2V](https://docs.kie.ai/cn/market/wan/2-7-text-to-video.md)、[2.7 I2V](https://docs.kie.ai/cn/market/wan/2-7-image-to-video.md)、[2.7 视频编辑](https://docs.kie.ai/cn/market/wan/2-7-videoedit.md)、[2.7 参考生视频](https://docs.kie.ai/cn/market/wan/2-7-r2v.md) |
| Topaz | Video Upscale | 视频放大、画质优化 | 否 | 后处理型模型，依赖源视频。 | [Video Upscale](https://docs.kie.ai/cn/market/topaz/video-upscale.md) |
| Infinitalk | From Audio | 音频驱动视频生成 | 否 | 音频输入是核心，需按页面限制校验音频资源。 | [From Audio](https://docs.kie.ai/cn/market/infinitalk/from-audio.md) |
| HappyHorse | Text to Video、Image to Video、Reference to Video、Video Edit、1.1 系列 | 文生视频、图生视频、参考生视频、视频编辑 | 否 | 参考图和编辑类任务的输入结构与普通 T2V/I2V 差异明显。 | [文生视频](https://docs.kie.ai/cn/market/happyhorse/text-to-video.md)、[图生视频](https://docs.kie.ai/cn/market/happyhorse/image-to-video.md)、[参考生视频](https://docs.kie.ai/cn/market/happyhorse/reference-to-video.md)、[视频编辑](https://docs.kie.ai/cn/market/happyhorse/video-edit.md) |
| Gemini Omni | Gemini Omni Video、Audio、Character | 视频生成、音频生成、角色生成 | 否 | Character 文档提示 `image_urls` 仅支持 1 张图，单张不超过 20MB。 | [Video](https://docs.kie.ai/cn/market/gemini-omni-video.md)、[Audio](https://docs.kie.ai/cn/market/gemini-omni-audio.md)、[Character](https://docs.kie.ai/cn/market/gemini-omni-character.md) |
| OmniHuman 1.5 | OmniHuman 1.5、Human Identification、Subject Detection | 人物视频、主体识别、主体检测 | 否 | 主体识别/检测更像前置分析类任务，可用于视频生成前的素材检查。 | [OmniHuman 1.5](https://docs.kie.ai/cn/market/omnihuman-1-5.md)、[主体识别](https://docs.kie.ai/cn/market/omnihuman-1-5/human-identification.md)、[主体检测](https://docs.kie.ai/cn/market/omnihuman-1-5/subject-detection.md) |
| Volcengine | Video to Video Lip Sync | 视频对口型 | 否 | 需要源视频与口型/音频相关输入，适合单独做输入校验。 | [Video to Video Lip Sync](https://docs.kie.ai/cn/market/volcengine/video-to-video-lip-sync.md) |
| Runway API | Generate AI Video、Extend AI Video、Aleph Video | 视频生成、视频扩展、视频转视频 | 是 | 不走 Market 统一任务。Aleph 是独立 video-to-video 工作流。 | [生成 AI 视频](https://docs.kie.ai/cn/runway-api/generate-ai-video.md)、[获取详情](https://docs.kie.ai/cn/runway-api/get-ai-video-details.md)、[延长视频](https://docs.kie.ai/cn/runway-api/extend-ai-video.md)、[Aleph 生成](https://docs.kie.ai/cn/runway-api/generate-aleph-video.md)、[Aleph 详情](https://docs.kie.ai/cn/runway-api/get-aleph-video-details.md) |
| Veo3.1 API | Generate、Extend、Get 1080P、Get 4K、Details | 视频生成、视频扩展、1080P/4K、查询 | 是 | 专用 API；`model` 可选 `veo3`、`veo3_fast`、`veo3_lite`；文档提示英文 prompt/content policy 限制。 | [生成](https://docs.kie.ai/cn/veo3-api/generate-veo-3-video.md)、[扩展](https://docs.kie.ai/cn/veo3-api/extend-video.md)、[1080P](https://docs.kie.ai/cn/veo3-api/get-veo-3-1080-p-video.md)、[4K](https://docs.kie.ai/cn/veo3-api/get-veo-3-4k-video.md)、[详情](https://docs.kie.ai/cn/veo3-api/get-veo-3-video-details.md) |

## 开发适配建议

1. Market 模型做一个统一适配器：`model + input + callBackUrl` 创建任务，`taskId` 查询结果。
2. 专用 API 独立适配：`4o Image API`、`Flux Kontext API`、`Runway API`、`Veo3.1 API`。
3. 图生图、图生视频、motion-control、avatar、lip-sync、speech-to-video、reference-to-video 都需要独立做输入校验。
4. 后处理类模型，如 Topaz、Recraft、Grok Upscale/Extend，通常需要已有图片、视频或任务结果。
5. 不要只按厂商名路由，应该按具体 `model` 或具体文档页能力路由。

