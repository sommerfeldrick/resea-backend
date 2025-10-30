import { vi } from 'vitest'

// Mock do process.env e import.meta.env
vi.mock('process.env', () => ({
  VITE_API_URL: 'http://localhost:3001'
}))

// Mock do import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_API_URL: 'http://localhost:3001'
    }
  }
})

// Mock do fetch
global.fetch = vi.fn()

// Mock do localStorage
class LocalStorageMock implements Storage {
  private store: { [key: string]: string } = {}

  get length(): number {
    return Object.keys(this.store).length
  }

  clear(): void {
    this.store = {}
  }

  getItem(key: string): string | null {
    return this.store[key] || null
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value)
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] || null
  }
}

global.localStorage = new LocalStorageMock();
