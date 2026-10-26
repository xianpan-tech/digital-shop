-- 占位商品数据（原创文案，仅供演示，上线前请替换为真实商品）
-- 注意：价格为占位，请按你的成本自行调整

INSERT INTO categories (slug, name, sort) VALUES
  ('ai', 'AI 工具', 1),
  ('verify', '验证服务', 2),
  ('accounts', '账号服务', 3),
  ('ids', '邮箱与 ID', 4),
  ('services', '服务咨询', 5)
ON CONFLICT (slug) DO NOTHING;

-- 用 CTE 取分类 id
WITH c AS (SELECT slug, id FROM categories)
INSERT INTO products (category_id, slug, name, description, includes_text, usage_text, after_sales_text, price_cents, stock_type, sort)
SELECT c.id, v.slug, v.name, v.description, v.includes_text, v.usage_text, v.after_sales_text, v.price_cents, v.stock_type, v.sort
FROM c JOIN (VALUES
  ('ai', 'ai-starter', 'AI 会员 - 入门版', '适合轻度使用的入门版 AI 会员，包含基础权益与使用说明。', '基础会员权益 1 份 / 使用说明 1 份', '按说明登录使用，建议单设备使用。', '发货后 24 小时内如无法登录，凭订单截图联系客服处理。', 5900, 'code', 1),
  ('ai', 'ai-standard', 'AI 会员 - 标准版', '适合日常使用的标准版 AI 会员，权益更全面。', '标准会员权益 1 份 / 使用说明 1 份', '单人使用，支持常见功能。', '首登异常 24 小时内可换一次。', 13900, 'code', 2),
  ('ai', 'ai-pro', 'AI 会员 - 进阶版', '适合重度使用的进阶版，额度更高，附详细指南。', '进阶会员权益 1 份 / 详细使用指南', '适合高频使用，按指南查看额度。', '7 天内非人为问题可协助排查。', 29900, 'code', 3),
  ('ai', 'ai-max', 'AI 会员 - 顶配版', '适合团队与高频使用的顶配版，专属客服对接。', '顶配会员权益 1 份 / 专属使用指南', '适合团队 / 高频使用。', '专属客服对接，优先处理。', 49900, 'code', 4),
  ('verify', 'verify-short', '验证服务 - 短时', '一次性短时验证码接收服务，适合快速验证场景。', '一次性验证码接收 1 次', '按页面提示输入手机号获取验证码，尽快使用。', '未收到码可凭订单申请重发一次。', 1000, 'code', 5),
  ('verify', 'verify-long', '验证服务 - 长时', '长时效验证码接收服务，适合需要多次验证的场景。', '长时效验证码接收 1 次', '适合需要多次验证的场景。', '码失效前未使用可联系客服。', 2000, 'code', 6),
  ('accounts', 'account-basic', '账号服务 - 基础成品号', '基础成品账号，含登录信息与改密指南。', '成品账号 1 个 / 登录信息 1 份', '收到后请先改密码并绑定自己的邮箱。', '首登问题 24 小时内可换。', 4000, 'code', 7),
  ('accounts', 'account-large', '账号服务 - 大容量版', '大容量账号，附剩余额度查看说明。', '大容量账号 1 个 / 使用说明 1 份', '按说明查看剩余额度，合理使用。', '额度异常可凭截图核查。', 27900, 'code', 8),
  ('accounts', 'account-telegram', '账号服务 - 即时通讯号', '即时通讯账号，含登录信息。', '即时通讯账号 1 个', '收到后尽快绑定自己的手机号。', '首登异常 24 小时内可换。', 4000, 'code', 9),
  ('accounts', 'account-video', '账号服务 - 视频平台号', '视频平台账号，附频道状态检查说明。', '视频平台账号 1 个 / 说明 1 份', '按说明检查频道状态。', '交付时截图留存，有问题 48 小时内联系。', 349900, 'manual', 10),
  ('ids', 'email-basic', '邮箱 - 基础邮箱', '全新基础邮箱账号，可用于注册与接收验证邮件。', '全新邮箱账号 1 个', '可用于注册和接收验证邮件。', '首登异常 24 小时内可换。', 3000, 'code', 11),
  ('ids', 'apple-us', 'Apple ID - 美区', '美区 Apple ID，仅用于下载应用。', '美区 Apple ID 1 个', '仅用于下载应用，请勿在设置里登录 iCloud。', '首登异常可换。', 3500, 'code', 12),
  ('services', 'service-build', '建站支持服务', '数字商品商城建站支持 1 次，含需求沟通、搭建与上线指导。', '建站支持 1 次 / 需求沟通 + 搭建 + 上线指导', '需提供域名、商品清单、支付方式。', '上线后 7 天内免费修复搭建问题。', 699900, 'manual', 13),
  ('services', 'service-consult', '付费咨询', '一对一付费咨询 1 次，30-60 分钟，附文字总结。', '一对一咨询 1 次 / 文字总结', '提前准备好问题清单。', '可提供文字总结。', 49900, 'manual', 14),
  ('ai', 'ai-demo', 'AI 会员 - 体验版', '体验版 AI 会员，适合先试用再决定。', '体验版权益 1 份 / 使用说明 1 份', '按说明登录体验。', '体验版售出后不支持退款。', 2900, 'code', 15)
) AS v(category_slug, slug, name, description, includes_text, usage_text, after_sales_text, price_cents, stock_type, sort)
ON c.slug = v.category_slug
ON CONFLICT (slug) DO NOTHING;

-- 占位卡密：每个 code 类商品放 5 条演示卡密（上线前必须清空并导入真实卡密）
INSERT INTO inventory_codes (product_id, code_text, status)
SELECT p.id, 'DEMO-' || p.slug || '-' || gs || '-XXXX', 'available'
FROM products p, generate_series(1,5) AS gs
WHERE p.stock_type = 'code'
  AND NOT EXISTS (SELECT 1 FROM inventory_codes ic WHERE ic.product_id = p.id);
