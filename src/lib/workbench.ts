import type { ApiProfile, ResponsesApiResponse } from '../types'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from './devProxy'
import { getApiErrorMessage } from './imageApiShared'

export type WorkbenchProductType = '保健食品(蓝帽子)' | '普通食品' | '运动器材' | '宠物用品' | '其他'

export interface WorkbenchEcommerceBrief {
  heroCopyDraft: string
  productType: WorkbenchProductType
  brandName: string
  companyName: string
  skuPricing: string
  audienceAnalysis: string
  competitorResearch: string
  imageCount: number
}

export interface WorkbenchSellingPoint {
  targetAudience: string
  painPoint: string
  solution: string
  benefitTranslation: string
  trustEvidence: string
  priority: string
  applicableModule: string
  complianceCheck: string
}

export interface WorkbenchSellingPointPlan {
  missingRequired: string[]
  missingRecommended: string[]
  summary: string
  sellingPoints: WorkbenchSellingPoint[]
  complianceNotes: string[]
}

export interface WorkbenchPromptItem {
  title: string
  purpose: string
  prompt: string
  size?: string
  inputImageIndexes: number[]
}

export interface WorkbenchPromptPlan {
  analysis: string
  artifactMarkdown: string
  selfReviewScore: number | null
  prompts: WorkbenchPromptItem[]
}

export const ECOMMERCE_IMAGE_SET_CORE_PROMPT = [
  'Step 1: 收集信息（必须拿到才能开工）',
  '向用户索要以下材料，缺项标记清楚：',
  '',
  '# 必须有',
  '1. 主图文案初稿（用户已有或口述）：基础素材',
  '2. 产品类型判定：保健食品(蓝帽子) / 普通食品 / 运动器材 / 宠物用品 / 其他：决定套哪套合规规则',
  '3. 品牌名 + 公司全称：品牌信任模块、法律声明署名',
  '4. SKU列表+价格：规格参数表',
  '',
  '# 强烈建议',
  '5. 商机分析/目标人群画像：必卖理由提炼方向',
  '6. 竞品链接/截图：差异化定位',
  '7. 产品实拍图：场景规划更具体',
  '',
  'Step 2: 提炼必卖理由卡片（输出后等用户确认）',
  '从产品信息中提取 3-5条必卖理由，每条含：目标人群 → 痛点 → 解决方案 → 利益翻译 → 信任证据 → 优先级 → 适用模块。',
  '规则：每条必须基于可验证的事实（专利号/检测报告/认证/工艺特点）；优先级 ★★★★★ = 主推核心差异 | ★★★★ = 重要辅助 | ★★★ = 补充；必须经过合规审查：无绝对化用语、无功效暗示、无医疗化表达。',
  '门禁：未获用户明确确认前，禁止进入 Step 3 主图阶段。',
  '',
  'Step 3: 方案生成（必须在 Step 2 用户确认后才能执行）',
  '图1 首图・点击率核心：画面=产品居中 + 背景氛围 + 动效钩子；图内文案≤5行（标题+副标题+卖点+兜底声明）；设计说明=构图重点、字号层级、点击率钩子是什么。',
  '图2 痛点共鸣・用户代入：画面=问题场景 vs 解决方案（对比构图）；图内文案=问句引入 + 对比描述 + 利益点≤5行；设计说明=情绪引导方式、不承诺效果。',
  '图3 差异化优势・竞品区隔：画面=对比实拍（左旧右新）或数据可视化；图内文案=差异化标题 + 对比表 + 证据≤5行；设计说明=真实性要求、视觉引导路径。',
  '图4 场景适配・使用价值：画面=2-3个使用场景并列（三宫格）；图内文案=场景标签 + 一句话利益 + 规格≤5行；设计说明=风格调性、生活化程度。',
  '图5 CTA行动号召：画面=产品全家福 + CTA按钮区域；图内文案=情绪价值语 + 信任背书清单 + 价格 + CTA≤5行；设计说明=CTA跳色处理、价格展示方式。',
  '',
  'Step 3 继续：详情页模块（按需取舍，不必全做）',
  '根据产品需求选择模块组合。每个模块只写三样：画面 / 图内文案 / 设计说明。',
  'M1 首屏痛点共鸣；M2 核心优势展开；M3 配方/工艺深度；M4 使用场景；M5 品牌/资质信任（可选）；M6 规格参数+竞品对比；M7 FAQ（最后一题必须是产品属性界定+免责声明）；M8 购买引导+法律声明（可选）。',
  '注意：M5/M8 根据产品需要决定是否做，不是必须。',
  '',
  'Step 3 继续：自审评分（强制，≥80分才允许输出）',
  '评分表：文案精简度20；图内可放性20；合规性25；结构清晰度15；实用性20。总分 < 80 时必须自行重写，不打扰用户直到合格。',
  '',
  'Step 3 继续：输出',
  '以 Markdown 格式输出完整执行方案，作为 artifact 制品交付（isArtifact=true）。',
].join('\n')

export const ECOMMERCE_SELLING_POINTS_SYSTEM_PROMPT = [
  '# 角色',
  '你是电商合规视觉策略师。你必须严格执行以下 6 步流程，但本轮只允许执行 Step 1 和 Step 2。',
  '',
  ECOMMERCE_IMAGE_SET_CORE_PROMPT,
  '',
  '# 本轮任务',
  '- 检查 Step 1 必须材料和强烈建议材料，缺项要标记清楚。',
  '- 提炼 3-5 条必卖理由卡片。',
  '- 输出后暂停，等待用户确认或修改意见。',
  '- 禁止生成主图、详情页、Markdown 执行方案或生图 prompt。',
  '',
  '# 输出格式',
  '只输出 JSON，不要输出 Markdown、解释或代码块。格式：',
  '{"missingRequired":["缺项"],"missingRecommended":["缺项"],"summary":"简短策略判断","sellingPoints":[{"targetAudience":"目标人群","painPoint":"痛点","solution":"解决方案","benefitTranslation":"利益翻译","trustEvidence":"信任证据","priority":"★★★★★","applicableModule":"适用模块","complianceCheck":"合规审查结论"}],"complianceNotes":["合规提示"]}',
].join('\n')

export const ECOMMERCE_IMAGE_SET_SYSTEM_PROMPT = [
  '# 角色',
  '你是电商视觉策略师和生图提示词工程师。用户已确认 Step 2 必卖理由卡片，你现在必须执行 Step 3。',
  '',
  ECOMMERCE_IMAGE_SET_CORE_PROMPT,
  '',
  '# 约束',
  '- 只能基于用户提供的信息、用户确认的必卖理由和产品实拍图进行推断，不编造功效、资质、公司信息、竞品信息或价格。',
  '- 如果产品类型是保健食品(蓝帽子)，画面和文案必须更克制，避免医疗化、治愈、保证效果等表达。',
  '- Step 3 必须先输出主图 5 张，再补充详情页模块、自审评分和最终 Markdown 输出。',
  '- Step 4 详情页模块按需取舍，M5/M8 可选；M7 最后一题必须是产品属性界定+免责声明。',
  '- 每张图的 prompt 必须完整、可独立用于生图，包含主体、构图、背景、光线、材质、风格、文字区域、画面/文案/设计说明和电商用途。',
  '- Step 5 自审评分总分必须 >= 80；低于 80 时自行重写后再输出。',
  '',
  '# 输出格式',
  '只输出 JSON，不要输出 Markdown、解释或代码块。格式：',
  '{"analysis":"策略分析","artifactMarkdown":"完整 Markdown 执行方案，包含 isArtifact=true 标记、Step 3 主图5张、Step 4 详情页模块、Step 5 自审评分、Step 6 输出","selfReviewScore":90,"prompts":[{"title":"图1 首图・点击率核心","purpose":"用途","prompt":"完整生图提示词","size":"1024x1024","inputImageIndexes":[0]}]}',
].join('\n')

function stripJsonFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

function normalizePromptItem(input: unknown): WorkbenchPromptItem | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : ''
  if (!prompt) return null
  const title = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : '套图'
  const purpose = typeof record.purpose === 'string' && record.purpose.trim() ? record.purpose.trim() : '电商展示'
  const size = typeof record.size === 'string' && record.size.trim() ? record.size.trim() : undefined
  const inputImageIndexes = Array.isArray(record.inputImageIndexes)
    ? record.inputImageIndexes
      .map((item) => typeof item === 'number' ? Math.trunc(item) : Number(item))
      .filter((item) => Number.isInteger(item) && item >= 0)
    : []

  return { title, purpose, prompt, size, inputImageIndexes }
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean)
}

function normalizeSellingPoint(input: unknown): WorkbenchSellingPoint | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const targetAudience = typeof record.targetAudience === 'string' ? record.targetAudience.trim() : ''
  const painPoint = typeof record.painPoint === 'string' ? record.painPoint.trim() : ''
  const solution = typeof record.solution === 'string' ? record.solution.trim() : ''
  const benefitTranslation = typeof record.benefitTranslation === 'string' ? record.benefitTranslation.trim() : ''
  const trustEvidence = typeof record.trustEvidence === 'string' ? record.trustEvidence.trim() : ''
  const priority = typeof record.priority === 'string' ? record.priority.trim() : ''
  const applicableModule = typeof record.applicableModule === 'string' ? record.applicableModule.trim() : ''
  const complianceCheck = typeof record.complianceCheck === 'string' ? record.complianceCheck.trim() : ''
  if (!targetAudience || !painPoint || !solution || !benefitTranslation) return null

  return {
    targetAudience,
    painPoint,
    solution,
    benefitTranslation,
    trustEvidence,
    priority,
    applicableModule,
    complianceCheck,
  }
}

export function parseWorkbenchSellingPointPlan(text: string): WorkbenchSellingPointPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(text))
  } catch {
    throw new Error('工作台必卖理由结果不是有效 JSON')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('工作台必卖理由结果格式无效')
  const record = parsed as Record<string, unknown>
  const sellingPoints = Array.isArray(record.sellingPoints)
    ? record.sellingPoints.map(normalizeSellingPoint).filter((item): item is WorkbenchSellingPoint => item != null)
    : []
  if (sellingPoints.length === 0) throw new Error('未生成可用的必卖理由卡片')
  return {
    missingRequired: normalizeStringList(record.missingRequired),
    missingRecommended: normalizeStringList(record.missingRecommended),
    summary: typeof record.summary === 'string' ? record.summary.trim() : '',
    sellingPoints,
    complianceNotes: normalizeStringList(record.complianceNotes),
  }
}

export function parseWorkbenchPromptPlan(text: string): WorkbenchPromptPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(text))
  } catch {
    throw new Error('工作台分析结果不是有效 JSON')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('工作台分析结果格式无效')
  const record = parsed as Record<string, unknown>
  const prompts = Array.isArray(record.prompts)
    ? record.prompts.map(normalizePromptItem).filter((item): item is WorkbenchPromptItem => item != null)
    : []
  if (prompts.length === 0) throw new Error('未生成可用的生图提示词')
  return {
    analysis: typeof record.analysis === 'string' ? record.analysis.trim() : '',
    artifactMarkdown: typeof record.artifactMarkdown === 'string' ? record.artifactMarkdown.trim() : '',
    selfReviewScore: typeof record.selfReviewScore === 'number' && Number.isFinite(record.selfReviewScore) ? record.selfReviewScore : null,
    prompts,
  }
}

export function buildWorkbenchUserInput(brief: WorkbenchEcommerceBrief, feedback = ''): string {
  return [
    '请基于以下资料执行当前阶段。',
    '',
    `主图文案初稿：${brief.heroCopyDraft}`,
    `产品类型：${brief.productType}`,
    `品牌名：${brief.brandName}`,
    `公司全称：${brief.companyName}`,
    `SKU列表+价格：${brief.skuPricing}`,
    `商机分析/目标人群画像：${brief.audienceAnalysis || '未提供'}`,
    `竞品链接/截图说明：${brief.competitorResearch || '未提供'}`,
    `产品实拍图数量：${brief.imageCount}`,
    feedback.trim() ? `用户修改意见：${feedback.trim()}` : '',
  ].join('\n')
}

export function buildWorkbenchPromptPlanInput(brief: WorkbenchEcommerceBrief, sellingPointPlan: WorkbenchSellingPointPlan, confirmationNote = ''): string {
  return [
    buildWorkbenchUserInput(brief),
    '',
    '用户已明确确认 Step 2 必卖理由卡片，可以进入 Step 3。',
    confirmationNote.trim() ? `用户确认/补充意见：${confirmationNote.trim()}` : '',
    '',
    '已确认的必卖理由卡片 JSON：',
    JSON.stringify(sellingPointPlan, null, 2),
  ].join('\n')
}

function extractResponsesText(payload: ResponsesApiResponse): string {
  const chunks: string[] = []
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') chunks.push(content.text)
    }
  }
  return chunks.join('\n').trim()
}

async function callWorkbenchResponsesTextApi(opts: {
  profile: ApiProfile
  instructions: string
  inputText: string
  imageDataUrls: string[]
  signal?: AbortSignal
}): Promise<string> {
  const { profile, instructions, inputText, imageDataUrls, signal } = opts
  const proxyConfig = readClientDevProxyConfig()
  const useApiProxy = shouldUseApiProxy(profile.apiProxy, proxyConfig)
  const content: Array<Record<string, string>> = [
    { type: 'input_text', text: inputText },
  ]
  for (const dataUrl of imageDataUrls) {
    content.push({ type: 'input_image', image_url: dataUrl })
  }

  const response = await fetch(buildApiUrl(profile.baseUrl, 'responses', proxyConfig, useApiProxy), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      model: profile.model,
      instructions,
      input: [{ role: 'user', content }],
    }),
    signal,
  })

  if (!response.ok) throw new Error(await getApiErrorMessage(response))
  const payload = await response.json() as ResponsesApiResponse
  const text = extractResponsesText(payload)
  if (!text) throw new Error('工作台分析未返回文本结果')
  return text
}

export async function callWorkbenchSellingPointApi(opts: {
  profile: ApiProfile
  brief: WorkbenchEcommerceBrief
  imageDataUrls: string[]
  feedback?: string
  signal?: AbortSignal
}): Promise<WorkbenchSellingPointPlan> {
  const text = await callWorkbenchResponsesTextApi({
    profile: opts.profile,
    instructions: ECOMMERCE_SELLING_POINTS_SYSTEM_PROMPT,
    inputText: buildWorkbenchUserInput(opts.brief, opts.feedback),
    imageDataUrls: opts.imageDataUrls,
    signal: opts.signal,
  })
  return parseWorkbenchSellingPointPlan(text)
}

export async function callWorkbenchPromptPlanApi(opts: {
  profile: ApiProfile
  brief: WorkbenchEcommerceBrief
  sellingPointPlan: WorkbenchSellingPointPlan
  confirmationNote?: string
  imageDataUrls: string[]
  signal?: AbortSignal
}): Promise<WorkbenchPromptPlan> {
  const text = await callWorkbenchResponsesTextApi({
    profile: opts.profile,
    instructions: ECOMMERCE_IMAGE_SET_SYSTEM_PROMPT,
    inputText: buildWorkbenchPromptPlanInput(opts.brief, opts.sellingPointPlan, opts.confirmationNote),
    imageDataUrls: opts.imageDataUrls,
    signal: opts.signal,
  })
  return parseWorkbenchPromptPlan(text)
}
