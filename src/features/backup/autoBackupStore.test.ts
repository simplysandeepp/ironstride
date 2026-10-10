import { describe, expect, it } from 'vitest'
import { clearFolderHandle, loadFolderHandle, saveFolderHandle } from './autoBackupStore.ts'

describe('autoBackupStore', () => {
  it('remembers, returns and forgets the chosen folder', async () => {
    expect(await loadFolderHandle()).toBeUndefined()
    // A real handle is structured-cloneable; a plain object stands in for it here.
    await saveFolderHandle({ kind: 'directory', name: 'IronStride Backup' })
    expect(await loadFolderHandle()).toEqual({ kind: 'directory', name: 'IronStride Backup' })
    await saveFolderHandle({ kind: 'directory', name: 'Other' })
    expect(await loadFolderHandle()).toEqual({ kind: 'directory', name: 'Other' })
    await clearFolderHandle()
    expect(await loadFolderHandle()).toBeUndefined()
  })
})
