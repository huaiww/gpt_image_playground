import { useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { TaskRecord } from '../types'
import { useStore, reuseConfig, editOutputs, removeTask, ensureImageThumbnailCached, subscribeImageThumbnail } from '../store'
import { buildGalleryItems, type GalleryWorkbenchGroupItem } from '../lib/taskGrouping'
import TaskCard from './TaskCard'

function getWorkbenchGroupStatus(group: GalleryWorkbenchGroupItem) {
  if (group.running > 0) return { label: '生成中', className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' }
  if (group.error > 0) return { label: group.done > 0 ? '部分失败' : '失败', className: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' }
  return { label: '已完成', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' }
}

function useThumbnailSources(imageIds: string[]) {
  const [sources, setSources] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const unsubscribers: Array<() => void> = []
    setSources({})

    for (const imageId of imageIds) {
      const applyThumbnail = (thumbnail: { dataUrl: string }) => {
        if (cancelled) return
        setSources((current) => ({ ...current, [imageId]: thumbnail.dataUrl }))
      }
      unsubscribers.push(subscribeImageThumbnail(imageId, applyThumbnail))
      void ensureImageThumbnailCached(imageId).then((thumbnail) => {
        if (thumbnail) applyThumbnail(thumbnail)
      }).catch(() => {})
    }

    return () => {
      cancelled = true
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [imageIds.join('|')])

  return sources
}

function WorkbenchGroupCard({ group, onClick }: { group: GalleryWorkbenchGroupItem; onClick: () => void }) {
  const previewIds = group.previewImageIds.slice(0, 4)
  const thumbnails = useThumbnailSources(previewIds)
  const status = getWorkbenchGroupStatus(group)
  const completedText = `${group.done}/${group.total}`

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-40 w-full overflow-hidden rounded-xl border border-blue-200/80 bg-white text-left shadow-sm transition hover:border-blue-300 hover:shadow-lg dark:border-blue-500/20 dark:bg-gray-900 dark:hover:border-blue-400/40"
    >
      <div className="grid h-full w-40 min-w-[10rem] grid-cols-2 grid-rows-2 gap-0.5 bg-blue-50 p-1 dark:bg-blue-950/20">
        {previewIds.length > 0 ? previewIds.map((imageId) => (
          <div key={imageId} className="overflow-hidden rounded-md bg-white/80 dark:bg-white/[0.04]">
            {thumbnails[imageId] ? (
              <img src={thumbnails[imageId]} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">加载</div>
            )}
          </div>
        )) : (
          <div className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-2 text-blue-400 dark:text-blue-300">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4-4a2 2 0 012.8 0L12 13l2-2a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">套图分组</span>
          </div>
        )}
        {Array.from({ length: Math.max(0, 4 - previewIds.length) }).map((_, index) => (
          <div key={`empty-${index}`} className="rounded-md bg-white/60 dark:bg-white/[0.03]" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">工作台套图</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{group.total} 个任务 · 完成 {completedText}</div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
        </div>
        <div className="mt-1 min-h-0 flex-1 overflow-hidden text-xs leading-5 text-gray-500 dark:text-gray-400">
          {group.tasks.slice(0, 4).map((task) => (
            <div key={task.id} className="truncate">
              {task.workbenchPromptTitle || '工作台图片'} · {task.status === 'done' ? '已完成' : task.status === 'running' ? '生成中' : '失败'}
            </div>
          ))}
        </div>
        <div className="mt-auto text-xs font-medium text-blue-600 dark:text-blue-300">查看分组</div>
      </div>
    </button>
  )
}

function WorkbenchGroupModal({
  group,
  selectedTaskIds,
  isMac,
  onClose,
  onOpenTask,
  onDeleteTask,
}: {
  group: GalleryWorkbenchGroupItem
  selectedTaskIds: string[]
  isMac: boolean
  onClose: () => void
  onOpenTask: (taskId: string) => void
  onDeleteTask: (task: TaskRecord) => void
}) {
  const status = getWorkbenchGroupStatus(group)

  return createPortal(
    <div data-no-drag-select className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/50" />
      <div
        className="relative z-10 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">工作台套图分组</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {group.total} 个任务 · 已完成 {group.done} · 生成中 {group.running} · 失败 {group.error}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-auto p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.tasks.map((task) => (
              <div key={task.id} className="task-card-wrapper" data-task-id={task.id}>
                <TaskCard
                  task={task}
                  disableSwipe
                  isSelected={selectedTaskIds.includes(task.id)}
                  onClick={(event) => {
                    const isCtrl = isMac ? ('metaKey' in event && event.metaKey) : ('ctrlKey' in event && event.ctrlKey)
                    if (isCtrl) {
                      useStore.getState().toggleTaskSelection(task.id)
                      return
                    }
                    onOpenTask(task.id)
                  }}
                  onReuse={() => reuseConfig(task)}
                  onEditOutputs={() => editOutputs(task)}
                  onDelete={() => onDeleteTask(task)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function TaskGrid() {
  const tasks = useStore((s) => s.tasks)
  const searchQuery = useStore((s) => s.searchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const selectedTaskIds = useStore((s) => s.selectedTaskIds)
  const setSelectedTaskIds = useStore((s) => s.setSelectedTaskIds)
  const clearSelection = useStore((s) => s.clearSelection)
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [selectionBox, setSelectionBox] = useState<{ startPageX: number; startPageY: number; currentPageX: number; currentPageY: number } | null>(null)
  const dragStart = useRef<{ pageX: number; pageY: number } | null>(null)
  const lastClientPoint = useRef<{ x: number; y: number } | null>(null)
  const hasDragged = useRef(false)
  const isDragging = useRef(false)
  const dragScrollIntervalRef = useRef<number | null>(null)
  const dragScrollDirectionRef = useRef<-1 | 1 | null>(null)
  const lastToastTimeRef = useRef(0)
  const suppressClickUntil = useRef(0)
  const startedOnCard = useRef(false)
  const startedWithCtrl = useRef(false)
  const initialSelection = useRef<string[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt)
    const q = searchQuery.trim().toLowerCase()
    
    return sorted.filter((t) => {
      if (filterFavorite && !t.isFavorite) return false
      const matchStatus = filterStatus === 'all' || t.status === filterStatus
      if (!matchStatus) return false
      
      if (!q) return true
      const prompt = (t.prompt || '').toLowerCase()
      const paramStr = JSON.stringify(t.params).toLowerCase()
      return prompt.includes(q) || paramStr.includes(q)
    })
  }, [tasks, searchQuery, filterStatus, filterFavorite])

  const galleryItems = useMemo(() => buildGalleryItems(filteredTasks), [filteredTasks])
  const selectedGroup = useMemo(
    () => galleryItems.find((item): item is GalleryWorkbenchGroupItem => item.type === 'workbench-group' && item.id === selectedGroupId) ?? null,
    [galleryItems, selectedGroupId],
  )

  const handleDelete = (task: typeof tasks[0]) => {
    setConfirmDialog({
      title: '删除记录',
      message: '确定要删除这条记录吗？关联的图片资源也会被清理（如果没有其他任务引用）。',
      action: () => removeTask(task),
    })
  }

  const getPagePoint = (clientX: number, clientY: number) => ({
    pageX: clientX + window.scrollX,
    pageY: clientY + window.scrollY,
  })

  const beginSelection = (target: HTMLElement, clientX: number, clientY: number, isCtrl: boolean) => {
    const point = getPagePoint(clientX, clientY)

    startedOnCard.current = Boolean(target.closest('.task-card-wrapper'))
    startedWithCtrl.current = isCtrl
    initialSelection.current = [...useStore.getState().selectedTaskIds]

    isDragging.current = true
    hasDragged.current = false
    dragStart.current = point
    lastClientPoint.current = { x: clientX, y: clientY }
    document.body.classList.add('select-none')
    document.body.classList.add('drag-selecting')
    setSelectionBox({
      startPageX: point.pageX,
      startPageY: point.pageY,
      currentPageX: point.pageX,
      currentPageY: point.pageY,
    })
  }

  const updateSelectionFromPoint = (pageX: number, pageY: number) => {
    const start = dragStart.current
    if (!start || !gridRef.current) return

    const minX = Math.min(start.pageX, pageX)
    const maxX = Math.max(start.pageX, pageX)
    const minY = Math.min(start.pageY, pageY)
    const maxY = Math.max(start.pageY, pageY)

    const cards = gridRef.current.querySelectorAll('.task-card-wrapper')
    const newSelected = new Set(initialSelection.current)
    const initialSelected = new Set(initialSelection.current)

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const taskId = card.getAttribute('data-task-id')
      if (!taskId) return

      const cardLeft = rect.left + window.scrollX
      const cardRight = rect.right + window.scrollX
      const cardTop = rect.top + window.scrollY
      const cardBottom = rect.bottom + window.scrollY

      const isIntersecting =
        minX < cardRight && maxX > cardLeft && minY < cardBottom && maxY > cardTop

      if (isIntersecting) {
        if (initialSelected.has(taskId)) {
          newSelected.delete(taskId)
        } else {
          newSelected.add(taskId)
        }
      } else if (!initialSelected.has(taskId)) {
        newSelected.delete(taskId)
      }
    })

    setSelectedTaskIds(Array.from(newSelected))
  }

  useEffect(() => {
    const stopDragScroll = () => {
      if (dragScrollIntervalRef.current) {
        clearInterval(dragScrollIntervalRef.current)
        dragScrollIntervalRef.current = null
      }
      dragScrollDirectionRef.current = null
    }

    const startDragScroll = (direction: -1 | 1) => {
      if (dragScrollIntervalRef.current && dragScrollDirectionRef.current === direction) return
      stopDragScroll()
      dragScrollDirectionRef.current = direction
      dragScrollIntervalRef.current = window.setInterval(() => {
        window.scrollBy({ top: direction * 15, behavior: 'instant' })
      }, 16)
    }

    const endSelection = (clearEmptySurfaceClick = false, suppressClick = false) => {
      if (isDragging.current) {
        document.body.classList.remove('select-none')
        document.body.classList.remove('drag-selecting')
      }
      if (isDragging.current && clearEmptySurfaceClick && !hasDragged.current && !startedOnCard.current && !startedWithCtrl.current) {
        clearSelection()
      }
      if (isDragging.current && suppressClick && hasDragged.current) {
        suppressClickUntil.current = Date.now() + 250
      }
      stopDragScroll()
      isDragging.current = false
      dragStart.current = null
      lastClientPoint.current = null
      setSelectionBox(null)
    }

    const getEventElement = (e: MouseEvent) => {
      if (e.target instanceof Element) return e.target
      return document.elementFromPoint(e.clientX, e.clientY)
    }

    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = getEventElement(e)
      if (!target) return
      if (!target.closest('[data-drag-select-surface]')) return
      if (target.closest('[data-input-bar]')) return
      if (target.closest('[data-no-drag-select], [data-lightbox-root]')) return
      if (target.closest('button, a, input, textarea, select')) return

      const isCtrl = isMac ? e.metaKey : e.ctrlKey
      beginSelection(target as HTMLElement, e.clientX, e.clientY, isCtrl)
      e.preventDefault()
    }

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return

      const start = dragStart.current
      const point = getPagePoint(e.clientX, e.clientY)
      lastClientPoint.current = { x: e.clientX, y: e.clientY }
      const distance = Math.hypot(point.pageX - start.pageX, point.pageY - start.pageY)
      if (distance < 6 && !hasDragged.current) return

      hasDragged.current = true
      setSelectionBox({
        startPageX: start.pageX,
        startPageY: start.pageY,
        currentPageX: point.pageX,
        currentPageY: point.pageY,
      })
      updateSelectionFromPoint(point.pageX, point.pageY)
      e.preventDefault()

      const scrollThreshold = 40
      if (e.clientY < scrollThreshold) {
        startDragScroll(-1)
      } else if (e.clientY > window.innerHeight - scrollThreshold) {
        startDragScroll(1)
      } else {
        stopDragScroll()
      }
    }

    const handleDocumentScroll = () => {
      if (!isDragging.current || !dragStart.current || !lastClientPoint.current || !hasDragged.current) return

      const point = getPagePoint(lastClientPoint.current.x, lastClientPoint.current.y)
      const start = dragStart.current
      setSelectionBox({
        startPageX: start.pageX,
        startPageY: start.pageY,
        currentPageX: point.pageX,
        currentPageY: point.pageY,
      })
      updateSelectionFromPoint(point.pageX, point.pageY)
    }

    const handleDocumentWheel = (e: WheelEvent) => {
      if (!isDragging.current) return
      if ((e.buttons & 1) === 0) {
        endSelection()
        return
      }
      if (!hasDragged.current) return
      if (!e.ctrlKey && !e.metaKey) return

      e.preventDefault()
      const now = Date.now()
      if (now - lastToastTimeRef.current > 3000) {
        lastToastTimeRef.current = now
        const keyName = isMac ? '⌘' : 'Ctrl'
        useStore.getState().showToast(`松开 ${keyName} 键使用滚轮，或拖至边缘自动滚动`, 'info')
      }
    }

    const handleDocumentMouseUp = () => {
      endSelection(true, true)
    }

    document.addEventListener('mousedown', handleDocumentMouseDown, true)
    document.addEventListener('mousemove', handleDocumentMouseMove, true)
    document.addEventListener('mouseup', handleDocumentMouseUp, true)
    document.addEventListener('wheel', handleDocumentWheel, { capture: true, passive: false })
    window.addEventListener('scroll', handleDocumentScroll, true)
    return () => {
      stopDragScroll()
      document.removeEventListener('mousedown', handleDocumentMouseDown, true)
      document.removeEventListener('mousemove', handleDocumentMouseMove, true)
      document.removeEventListener('mouseup', handleDocumentMouseUp, true)
      document.removeEventListener('wheel', handleDocumentWheel, true)
      window.removeEventListener('scroll', handleDocumentScroll, true)
    }
  }, [clearSelection, isMac])

  if (!filteredTasks.length) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500">
        {searchQuery || filterFavorite ? (
          <p className="text-sm">没有找到匹配的记录</p>
        ) : (
          <>
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">输入提示词开始生成图片</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div 
      ref={rootRef}
      data-task-grid-root
      className="relative min-h-[50vh]"
    >
      <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
        {galleryItems.map((item) => {
          if (item.type === 'workbench-group') {
            return (
              <div key={item.id} className="task-card-wrapper" data-task-group-id={item.id}>
                <WorkbenchGroupCard
                  group={item}
                  onClick={() => {
                    if (Date.now() < suppressClickUntil.current) return
                    suppressClickUntil.current = 0
                    setSelectedGroupId(item.id)
                  }}
                />
              </div>
            )
          }

          const task = item.task
          return (
            <div key={task.id} className="task-card-wrapper" data-task-id={task.id}>
              <TaskCard
                task={task}
                onClick={(e) => {
                  if (Date.now() < suppressClickUntil.current) {
                    e.preventDefault()
                    return
                  }
                  suppressClickUntil.current = 0
                  const isCtrl = isMac ? e.metaKey : e.ctrlKey
                  if (isCtrl) {
                    useStore.getState().toggleTaskSelection(task.id)
                    return
                  }

                  setDetailTaskId(task.id)
                }}
                onReuse={() => reuseConfig(task)}
                onEditOutputs={() => editOutputs(task)}
                onDelete={() => handleDelete(task)}
                isSelected={selectedTaskIds.includes(task.id)}
              />
            </div>
          )
        })}
      </div>
      {selectedGroup && (
        <WorkbenchGroupModal
          group={selectedGroup}
          selectedTaskIds={selectedTaskIds}
          isMac={isMac}
          onClose={() => setSelectedGroupId(null)}
          onOpenTask={(taskId) => {
            setDetailTaskId(taskId)
          }}
          onDeleteTask={handleDelete}
        />
      )}
      {selectionBox && (
        <div
          className="fixed bg-blue-500/20 border border-blue-500/50 pointer-events-none z-[30]"
          style={{
            left: Math.min(selectionBox.startPageX, selectionBox.currentPageX) - window.scrollX,
            top: Math.min(selectionBox.startPageY, selectionBox.currentPageY) - window.scrollY,
            width: Math.abs(selectionBox.currentPageX - selectionBox.startPageX),
            height: Math.abs(selectionBox.currentPageY - selectionBox.startPageY),
          }}
        />
      )}
    </div>
  )
}
