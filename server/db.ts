import fs from "fs"
import path from "path"

const DATA_DIR = path.join(import.meta.dirname, "data")

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`)
}

export function read<T>(name: string, fallback: T): T {
  ensureDir()
  const fp = filePath(name)
  if (!fs.existsSync(fp)) return fallback
  return JSON.parse(fs.readFileSync(fp, "utf-8"))
}

export function write<T>(name: string, data: T): void {
  ensureDir()
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2))
}
