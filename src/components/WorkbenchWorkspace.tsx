import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeWorkbenchEcommerceSellingPoints, createInputImageFromFile, deleteImageIfUnreferenced, ensureImageCached, submitWorkbenchEcommerceImageSet, useStore } from '../store'
import type { InputImage } from '../types'
import type { WorkbenchProductType, WorkbenchSellingPointPlan } from '../lib/workbench'
import { PhotoIcon, RefreshIcon, TrashIcon, ChevronDownIcon } from './icons'

const PRODUCT_TYPES: WorkbenchProductType[] = ['保健食品(蓝帽子)', '普通食品', '运动器材', '宠物用品', '其他']
const DRAFT_STORAGE_KEY = 'workbench:ecommerce-image-set-draft'

type FormState = {
  heroCopyDraft: string
  productType: WorkbenchProductType
  brandName: string
  companyName: string
  skuPricing: string
  audienceAnalysis: string
  competitorResearch: string
}

type WorkbenchModule = {
  id: string
  title: string
  subtitle: string
  steps: string[]
}

const WORKBENCH_MODULES: WorkbenchModule[] = [
  {
    id: 'ecommerce-image-set',
    title: '电商套图',
    subtitle: 'Step 1-3',
    steps: ['Step 1 收集信息', 'Step 2 必卖理由确认', 'Step 3 方案生成'],
  },
]

const initialForm: FormState = {
  heroCopyDraft: '',
  productType: '普通食品',
  brandName: '',
  companyName: '',
  skuPricing: '',
  audienceAnalysis: '',
  competitorResearch: '',
}

function getMissingRequiredFields(form: FormState) {
  const missing: string[] = []
  if (!form.heroCopyDraft.trim()) missing.push('主图文案初稿')
  if (!form.productType) missing.push('产品类型')
  if (!form.brandName.trim()) missing.push('品牌名')
  if (!form.companyName.trim()) missing.push('公司全称')
  if (!form.skuPricing.trim()) missing.push('SKU列表+价格')
  return missing
}

function getMissingRecommendedFields(form: FormState, images: InputImage[]) {
  const missing: string[] = []
  if (!form.audienceAnalysis.trim()) missing.push('商机分析/目标人群画像')
  if (!form.competitorResearch.trim()) missing.push('竞品链接/截图')
  if (images.length === 0) missing.push('产品实拍图')
  return missing
}

function ModuleSteps({ steps, open }: { steps: string[]; open: boolean }) {
  return (
    <div className={`overflow-hidden transition-all duration-200 ${open ? 'mt-3 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step} className="rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
            {step}
          </div>
        ))}
      </div>
    </div>
  )
}

function ButtonSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function WorkbenchWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const showToast = useStore((s) => s.showToast)
  const setAppMode = useStore((s) => s.setAppMode)
  const [selectedModuleId, setSelectedModuleId] = useState(WORKBENCH_MODULES[0]?.id ?? '')
  const [openModuleId, setOpenModuleId] = useState<string | null>(WORKBENCH_MODULES[0]?.id ?? null)
  const [form, setForm] = useState<FormState>(initialForm)
  const [productImages, setProductImages] = useState<InputImage[]>([])
  const [sellingPointPlan, setSellingPointPlan] = useState<WorkbenchSellingPointPlan | null>(null)
  const [sellingPointFeedback, setSellingPointFeedback] = useState('')
  const [confirmationNote, setConfirmationNote] = useState('')
  const [artifactMarkdown, setArtifactMarkdown] = useState('')
  const [submittingStep2, setSubmittingStep2] = useState(false)
  const [submittingFinal, setSubmittingFinal] = useState(false)

  const currentModule = useMemo(
    () => WORKBENCH_MODULES.find((module) => module.id === selectedModuleId) ?? WORKBENCH_MODULES[0],
    [selectedModuleId],
  )
  const missingRequiredFields = useMemo(() => getMissingRequiredFields(form), [form])
  const missingRecommendedFields = useMemo(() => getMissingRecommendedFields(form, productImages), [form, productImages])

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as Partial<FormState> & { productImageIds?: string[] }
      setForm({
        heroCopyDraft: typeof parsed.heroCopyDraft === 'string' ? parsed.heroCopyDraft : '',
        productType: PRODUCT_TYPES.includes(parsed.productType as WorkbenchProductType) ? parsed.productType as WorkbenchProductType : '普通食品',
        brandName: typeof parsed.brandName === 'string' ? parsed.brandName : '',
        companyName: typeof parsed.companyName === 'string' ? parsed.companyName : '',
        skuPricing: typeof parsed.skuPricing === 'string' ? parsed.skuPricing : '',
        audienceAnalysis: typeof parsed.audienceAnalysis === 'string' ? parsed.audienceAnalysis : '',
        competitorResearch: typeof parsed.competitorResearch === 'string' ? parsed.competitorResearch : '',
      })
      const imageIds = Array.isArray(parsed.productImageIds) ? parsed.productImageIds.filter((id): id is string => typeof id === 'string') : []
      if (imageIds.length) {
        void Promise.all(imageIds.map(async (id) => {
          const dataUrl = await ensureImageCached(id)
          return dataUrl ? { id, dataUrl } : null
        })).then((images) => {
          setProductImages(images.filter((image): image is InputImage => image != null))
        })
      }
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      ...form,
      productImageIds: productImages.map((image) => image.id),
    }))
  }, [form, productImages])

  const resetGeneratedState = () => {
    setSellingPointPlan(null)
    setArtifactMarkdown('')
  }

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    resetGeneratedState()
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const nextImages: InputImage[] = []
    for (const file of Array.from(files)) {
      const image = await createInputImageFromFile(file)
      if (image) nextImages.push(image)
    }
    if (nextImages.length) {
      resetGeneratedState()
      setProductImages((current) => [...current, ...nextImages])
      showToast(`已添加 ${nextImages.length} 张产品图`, 'success')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (imageId: string) => {
    resetGeneratedState()
    setProductImages((current) => current.filter((image) => image.id !== imageId))
    void deleteImageIfUnreferenced(imageId)
  }

  const handleAnalyzeSellingPoints = async () => {
    const missing = getMissingRequiredFields(form)
    if (missing.length) {
      showToast(`Step 1 缺少必须材料：${missing.join('、')}`, 'error')
      return
    }

    setSubmittingStep2(true)
    setArtifactMarkdown('')
    try {
      const plan = await analyzeWorkbenchEcommerceSellingPoints({
        brief: form,
        productImages,
        feedback: sellingPointFeedback,
      })
      if (plan) {
        setSellingPointPlan(plan)
        showToast('已生成必卖理由卡片，请确认后再进入主图阶段', 'success')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setSubmittingStep2(false)
    }
  }

  const handleConfirmAndGenerate = async () => {
    if (!sellingPointPlan) {
      showToast('请先完成 Step 2 必卖理由卡片', 'error')
      return
    }

    setSubmittingFinal(true)
    try {
      const result = await submitWorkbenchEcommerceImageSet({
        brief: form,
        productImages,
        sellingPointPlan,
        confirmationNote,
      })
      if (result) {
        setArtifactMarkdown(result.plan.artifactMarkdown || result.plan.analysis)
        showToast('已生成执行方案，并开始提交画廊出图任务', 'success')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setSubmittingFinal(false)
    }
  }

  const requiredDone = 5 - missingRequiredFields.length
  const step2Ready = missingRequiredFields.length === 0
  const finalReady = Boolean(sellingPointPlan) && !submittingStep2
  const currentSteps = currentModule?.steps ?? []
  const stepsOpen = currentModule ? openModuleId === currentModule.id : false

  return (
    <main className="safe-area-x mx-auto max-w-7xl pb-20 pt-4 sm:pt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">工作台</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">左侧选择能力模块，右侧进入对应信息录入和执行流程。</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200/70 bg-white/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="space-y-2">
            {WORKBENCH_MODULES.map((module) => {
              const selected = selectedModuleId === module.id
              const open = openModuleId === module.id
              return (
                <div key={module.id} className="rounded-xl border border-transparent">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModuleId(module.id)
                      setOpenModuleId((current) => current === module.id ? null : module.id)
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                      selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{module.title}</div>
                      <div className="mt-1 text-xs opacity-70">{module.subtitle}</div>
                    </div>
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <ModuleSteps steps={module.steps} open={open} />
                </div>
              )
            })}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200/70 bg-white/70 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200/70 pb-4 dark:border-white/[0.08]">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{currentModule?.title ?? '工作台能力'}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">当前模块：{currentModule?.subtitle ?? '未选择'}</p>
              </div>
              <div className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                必须 {requiredDone}/5
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">主图文案初稿 <span className="text-red-500">*</span></span>
                <textarea
                  value={form.heroCopyDraft}
                  onChange={(event) => updateForm('heroCopyDraft', event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">产品类型 <span className="text-red-500">*</span></span>
                <select
                  value={form.productType}
                  onChange={(event) => updateForm('productType', event.target.value as WorkbenchProductType)}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
                >
                  {PRODUCT_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-white text-gray-900">
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">品牌名 <span className="text-red-500">*</span></span>
                <input
                  value={form.brandName}
                  onChange={(event) => updateForm('brandName', event.target.value)}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">公司全称 <span className="text-red-500">*</span></span>
                <input
                  value={form.companyName}
                  onChange={(event) => updateForm('companyName', event.target.value)}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">SKU列表+价格 <span className="text-red-500">*</span></span>
                <textarea
                  value={form.skuPricing}
                  onChange={(event) => updateForm('skuPricing', event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">商机分析/目标人群画像</span>
                <textarea
                  value={form.audienceAnalysis}
                  onChange={(event) => updateForm('audienceAnalysis', event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">竞品链接/截图说明</span>
                <textarea
                  value={form.competitorResearch}
                  onChange={(event) => updateForm('competitorResearch', event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
                />
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">产品实拍图</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <PhotoIcon className="h-3.5 w-3.5" />
                  上传图片
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void handleFiles(event.target.files)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {productImages.map((image, index) => (
                  <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200/70 bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <img src={image.dataUrl} alt={`产品图 ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                      title="移除"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {productImages.length === 0 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 transition hover:border-blue-300 hover:text-blue-500 dark:border-white/[0.12] dark:bg-white/[0.03] dark:text-gray-500"
                  >
                    上传产品图
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
              {missingRequiredFields.length ? `缺少必须材料：${missingRequiredFields.join('、')}` : '必须材料已齐，可以进入 Step 2。'}
              {missingRecommendedFields.length ? ` 建议补充：${missingRecommendedFields.join('、')}。` : ' 建议材料也已补齐。'}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void handleAnalyzeSellingPoints()}
                disabled={!step2Ready || submittingStep2 || submittingFinal}
                className="inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingStep2 && <ButtonSpinner />}
                {submittingStep2 ? '提炼中...' : sellingPointPlan ? '重新提炼必卖理由' : '提炼必卖理由'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/70 bg-white/70 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Step 2 必卖理由卡片</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">这里是门禁。未确认前不会生成主图或提交画廊任务。</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${sellingPointPlan ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'}`}>
                {sellingPointPlan ? (submittingFinal ? '生成中' : '待确认') : '未生成'}
              </span>
            </div>

            {sellingPointPlan ? (
              <div className="space-y-3">
                {sellingPointPlan.summary && (
                  <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
                    {sellingPointPlan.summary}
                  </div>
                )}
                <div className="grid gap-3 xl:grid-cols-2">
                  {sellingPointPlan.sellingPoints.map((point, index) => (
                    <article key={`${point.targetAudience}-${index}`} className="rounded-lg border border-gray-200/70 bg-white/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">理由 {index + 1}</h4>
                        <span className="text-xs text-amber-600 dark:text-amber-300">{point.priority || '未定级'}</span>
                      </div>
                      <dl className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <div><dt className="inline font-semibold">目标人群：</dt><dd className="inline">{point.targetAudience}</dd></div>
                        <div><dt className="inline font-semibold">痛点：</dt><dd className="inline">{point.painPoint}</dd></div>
                        <div><dt className="inline font-semibold">解决方案：</dt><dd className="inline">{point.solution}</dd></div>
                        <div><dt className="inline font-semibold">利益翻译：</dt><dd className="inline">{point.benefitTranslation}</dd></div>
                        <div><dt className="inline font-semibold">信任证据：</dt><dd className="inline">{point.trustEvidence || '需基于现有资料谨慎呈现'}</dd></div>
                        <div><dt className="inline font-semibold">适用模块：</dt><dd className="inline">{point.applicableModule || '主图/详情页'}</dd></div>
                        <div><dt className="inline font-semibold">合规审查：</dt><dd className="inline">{point.complianceCheck || '未发现明显风险'}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
                {sellingPointPlan.complianceNotes.length > 0 && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    合规提示：{sellingPointPlan.complianceNotes.join('；')}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 px-3 py-8 text-center text-sm text-gray-400 dark:border-white/[0.12] dark:text-gray-500">
                补齐 Step 1 必须材料后，点击“提炼必卖理由”。
              </div>
            )}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">修改意见</span>
              <textarea
                value={sellingPointFeedback}
                onChange={(event) => setSellingPointFeedback(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">确认补充说明</span>
              <textarea
                value={confirmationNote}
                onChange={(event) => setConfirmationNote(event.target.value)}
                placeholder="可根据需要填入额外信息，如：仅生成3张产品主图"
                rows={2}
                className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:focus:border-blue-500/50"
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleAnalyzeSellingPoints()}
                disabled={!step2Ready || submittingStep2 || submittingFinal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/70 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]"
              >
                {submittingStep2 ? <ButtonSpinner /> : <RefreshIcon className="h-4 w-4" />}
                {submittingStep2 ? '提炼中...' : '按意见重新提炼'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAndGenerate()}
                disabled={!finalReady || submittingFinal}
                className="inline-flex min-w-[14rem] items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {submittingFinal && <ButtonSpinner />}
                {submittingFinal ? '生成方案中...' : '确认必卖理由并生成主图/详情页'}
              </button>
            </div>
          </div>

          {artifactMarkdown && (
            <div className="rounded-xl border border-gray-200/70 bg-white/70 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Step 3 Artifact</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">画廊任务已创建，出图进度和结果在画廊查看。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAppMode('gallery')}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  查看画廊
                </button>
              </div>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-4 text-xs leading-6 text-gray-100">
                {artifactMarkdown}
              </pre>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
