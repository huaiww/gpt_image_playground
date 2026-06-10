import type { TaskRecord } from '../types'

export type GalleryTaskItem = {
  type: 'task'
  id: string
  createdAt: number
  task: TaskRecord
}

export type GalleryWorkbenchGroupItem = {
  type: 'workbench-group'
  id: string
  runId: string
  createdAt: number
  tasks: TaskRecord[]
  total: number
  done: number
  running: number
  error: number
  previewImageIds: string[]
}

export type GalleryItem = GalleryTaskItem | GalleryWorkbenchGroupItem

export function buildGalleryItems(tasks: TaskRecord[]): GalleryItem[] {
  const items: GalleryItem[] = []
  const workbenchGroups = new Map<string, TaskRecord[]>()

  for (const task of tasks) {
    if (task.workbenchRunId) {
      const groupTasks = workbenchGroups.get(task.workbenchRunId) ?? []
      groupTasks.push(task)
      workbenchGroups.set(task.workbenchRunId, groupTasks)
    } else {
      items.push({
        type: 'task',
        id: task.id,
        createdAt: task.createdAt,
        task,
      })
    }
  }

  for (const [runId, groupTasks] of workbenchGroups) {
    const orderedTasks = [...groupTasks].sort((a, b) => a.createdAt - b.createdAt)
    const createdAt = Math.max(...orderedTasks.map((task) => task.createdAt))
    items.push({
      type: 'workbench-group',
      id: `workbench-${runId}`,
      runId,
      createdAt,
      tasks: orderedTasks,
      total: orderedTasks.length,
      done: orderedTasks.filter((task) => task.status === 'done').length,
      running: orderedTasks.filter((task) => task.status === 'running').length,
      error: orderedTasks.filter((task) => task.status === 'error').length,
      previewImageIds: orderedTasks.flatMap((task) => task.outputImages ?? []).slice(0, 4),
    })
  }

  return items.sort((a, b) => b.createdAt - a.createdAt)
}
