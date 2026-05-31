import { describe, expect, it } from 'vitest'
import { buildWorkbenchUserInput, ECOMMERCE_IMAGE_SET_SYSTEM_PROMPT, parseWorkbenchPromptPlan, parseWorkbenchSellingPointPlan } from './workbench'

describe('parseWorkbenchPromptPlan', () => {
  it('extracts prompt plans from plain JSON or fenced JSON', () => {
    const plan = parseWorkbenchPromptPlan(`\`\`\`json
{
  "analysis": "突出蓝帽子资质和礼赠场景。",
  "prompts": [
    {
      "title": "主图",
      "purpose": "首屏转化",
      "prompt": "A clean ecommerce hero image for Brand A vitamins",
      "size": "1024x1024",
      "inputImageIndexes": [0]
    }
  ]
}
\`\`\``)

    expect(plan.analysis).toContain('蓝帽子')
    expect(plan.prompts).toEqual([
      {
        title: '主图',
        purpose: '首屏转化',
        prompt: 'A clean ecommerce hero image for Brand A vitamins',
        size: '1024x1024',
        inputImageIndexes: [0],
      },
    ])
    expect(plan.artifactMarkdown).toBe('')
    expect(plan.selfReviewScore).toBeNull()
  })

  it('rejects plans without usable prompts', () => {
    expect(() => parseWorkbenchPromptPlan('{"analysis":"ok","prompts":[]}')).toThrow('未生成可用的生图提示词')
  })
})

describe('parseWorkbenchSellingPointPlan', () => {
  it('extracts Step 2 selling point cards', () => {
    const plan = parseWorkbenchSellingPointPlan(`{
      "missingRequired": [],
      "missingRecommended": ["竞品链接/截图"],
      "summary": "主推蓝帽子资质和礼赠可信度。",
      "sellingPoints": [
        {
          "targetAudience": "银发人群子女",
          "painPoint": "担心送礼不够可信",
          "solution": "突出蓝帽子资质与公司全称",
          "benefitTranslation": "送得体面，信息透明",
          "trustEvidence": "蓝帽子标识",
          "priority": "★★★★★",
          "applicableModule": "图1/图5/M5",
          "complianceCheck": "避免功效暗示"
        }
      ],
      "complianceNotes": ["不使用治疗、改善疾病等表达"]
    }`)

    expect(plan.missingRecommended).toEqual(['竞品链接/截图'])
    expect(plan.sellingPoints[0]).toMatchObject({
      targetAudience: '银发人群子女',
      priority: '★★★★★',
      applicableModule: '图1/图5/M5',
    })
    expect(plan.complianceNotes[0]).toContain('治疗')
  })

  it('rejects Step 2 results without usable cards', () => {
    expect(() => parseWorkbenchSellingPointPlan('{"sellingPoints":[]}')).toThrow('未生成可用的必卖理由卡片')
  })
})

describe('buildWorkbenchUserInput', () => {
  it('builds the required ecommerce image set brief', () => {
    const input = buildWorkbenchUserInput({
      heroCopyDraft: '增强免疫力，送父母更安心',
      productType: '保健食品(蓝帽子)',
      brandName: '康元',
      companyName: '康元健康科技有限公司',
      skuPricing: '60粒/瓶，199元；120粒/瓶，329元',
      audienceAnalysis: '银发人群子女，关注送礼体面和资质可信',
      competitorResearch: '竞品强调低价，本品强调资质可信',
      imageCount: 3,
    })

    expect(input).toContain('主图文案初稿：增强免疫力')
    expect(input).toContain('产品类型：保健食品(蓝帽子)')
    expect(input).toContain('品牌名：康元')
    expect(input).toContain('公司全称：康元健康科技有限公司')
    expect(input).toContain('竞品链接/截图说明：竞品强调低价')
    expect(input).toContain('产品实拍图数量：3')
  })

  it('keeps the merged step 3 workflow in the final prompt', () => {
    expect(ECOMMERCE_IMAGE_SET_SYSTEM_PROMPT).toContain('Step 3: 方案生成')
    expect(ECOMMERCE_IMAGE_SET_SYSTEM_PROMPT).toContain('Step 3 继续：详情页模块')
    expect(ECOMMERCE_IMAGE_SET_SYSTEM_PROMPT).toContain('Step 3 继续：自审评分')
    expect(ECOMMERCE_IMAGE_SET_SYSTEM_PROMPT).toContain('Step 3 继续：输出')
  })
})
