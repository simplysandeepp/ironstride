import type { DirHandleLike } from '../features/backup/folderBackup.ts'

export type FakeFolder = DirHandleLike & {
  files: Map<string, string>
  /** File names in the order they finished writing. */
  writes: string[]
  permission: PermissionState
  /** What requestPermission answers when the user taps Allow. */
  grantOnRequest: boolean
  failWrites: boolean
}

/** An in-memory stand-in for a folder from the browser's file picker. */
export function createFakeFolder(
  name = 'IronStride Backup',
  permission: PermissionState = 'granted',
): FakeFolder {
  const folder: FakeFolder = {
    name,
    files: new Map(),
    writes: [],
    permission,
    grantOnRequest: true,
    failWrites: false,
    async queryPermission() {
      return folder.permission
    },
    async requestPermission() {
      folder.permission = folder.grantOnRequest ? 'granted' : 'denied'
      return folder.permission
    },
    async getFileHandle(fileName, options) {
      if (!folder.files.has(fileName) && !options?.create) {
        throw new DOMException('A requested file could not be found.', 'NotFoundError')
      }
      return {
        async createWritable() {
          let buffer = ''
          return {
            async write(data: string) {
              if (folder.failWrites) throw new Error('disk full')
              buffer += data
            },
            async close() {
              // Like the real API, the file only changes once the stream closes.
              folder.files.set(fileName, buffer)
              folder.writes.push(fileName)
            },
          }
        },
        async getFile() {
          return { text: async () => folder.files.get(fileName) ?? '' }
        },
      }
    },
  }
  return folder
}
