import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '../types'
import { buildGalleryItems } from './taskGrouping'

function task(overrides: Partial<TaskRecord>): TaskRecord {
  return {
    id: overrides.id ?? 'task',
    prompt: overrides.prompt ?? 'prompt',
    params: {
      size: 'auto',
      quality: 'auto',
      output_format: 'png',
      output_compression: null,
      moderation: 'auto',
      n: 1,
    },
    inputImageIds: [],
    outputImages: [],
    status: overrides.status ?? 'done',
    error: null,
    createdAt: overrides.createdAt ?? 0,
    finishedAt: overrides.finishedAt ?? null,
    elapsed: null,
    ...overrides,
  }
}

describe('buildGalleryItems', () => {
  it('groups workbench tasks by run id and keeps regular tasks as cards', () => {
    const items = buildGalleryItems([
      task({ id: 'regular-new', createdAt: 30 }),
      task({ id: 'wb-2', createdAt: 20, sourceMode: 'workbench', workbenchRunId: 'run-a', workbenchPromptTitle: '图2' }),
      task({ id: 'wb-1', createdAt: 10, sourceMode: 'workbench', workbenchRunId: 'run-a', workbenchPromptTitle: '图1' }),
      task({ id: 'regular-old', createdAt: 5 }),
    ])

    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ type: 'task', task: { id: 'regular-new' } })
    expect(items[1]).toMatchObject({
      type: 'workbench-group',
      id: 'workbench-run-a',
      runId: 'run-a',
      total: 2,
      done: 2,
      running: 0,
      error: 0,
      createdAt: 20,
    })
    expect(items[1].type === 'workbench-group' ? items[1].tasks.map((item) => item.id) : []).toEqual(['wb-1', 'wb-2'])
    expect(items[2]).toMatchObject({ type: 'task', task: { id: 'regular-old' } })
  })

  it('summarizes grouped task statuses and preview images', () => {
    const items = buildGalleryItems([
      task({ id: 'running', createdAt: 3, sourceMode: 'workbench', workbenchRunId: 'run-b', status: 'running' }),
      task({ id: 'done', createdAt: 2, sourceMode: 'workbench', workbenchRunId: 'run-b', status: 'done', outputImages: ['img-a', 'img-b'] }),
      task({ id: 'error', createdAt: 1, sourceMode: 'workbench', workbenchRunId: 'run-b', status: 'error' }),
    ])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      type: 'workbench-group',
      total: 3,
      done: 1,
      running: 1,
      error: 1,
      previewImageIds: ['img-a', 'img-b'],
    })
  })
})
