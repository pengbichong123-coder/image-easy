# Launch Measurement Checklist

上线前后按以下清单逐项确认，重点覆盖 Search Console、GA4 和基础环境配置。

## Search Console

- [ ] Verify https://www.image-easy.com in Google Search Console.
- [ ] Submit https://www.image-easy.com/sitemap.xml.
- [ ] Inspect /en, /en/create, /zh, /zh/create.
- [ ] Confirm /en/login and /en/my-images are noindex.

## GA4

- [ ] Connect GA4 property.
- [ ] Confirm Realtime report receives page_view.
- [ ] Confirm custom events appear in DebugView.

## 发布前提醒

- [ ] 确认 R2 bucket、公开访问域名和上传权限已按生产环境配置。
- [ ] 确认生产环境变量已设置，且未依赖本地 `.env` 默认值。
- [ ] 确认生产环境 `NEXT_PUBLIC_APP_URL` 使用 HTTPS 公开域名，并设置 `KIE_CALLBACK_SECRET` 以启用 Kie 回调。
- [ ] 确认数据库 schema 与生产迁移状态同步。
