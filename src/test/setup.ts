import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { db } from '../db/database.ts'

afterEach(async () => {
  cleanup()
  await Promise.all(db.tables.map((table) => table.clear()))
})
