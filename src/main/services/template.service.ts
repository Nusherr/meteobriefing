import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getTemplatesPath } from '../lib/constants'
import type { BriefingTemplate, TemplateSummary } from '@shared/types'

class TemplateService {
  private ensureDir(): string {
    const dir = getTemplatesPath()
    mkdirSync(dir, { recursive: true })
    return dir
  }

  list(): TemplateSummary[] {
    const dir = this.ensureDir()
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

    return files
      .map((f) => {
        try {
          const data = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as BriefingTemplate
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            slideCount: data.slides.length,
            updatedAt: data.updatedAt
          }
        } catch {
          return null
        }
      })
      .filter((t): t is TemplateSummary => t !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  load(id: string): BriefingTemplate | null {
    const dir = this.ensureDir()
    const filePath = join(dir, `${id}.json`)

    if (!existsSync(filePath)) return null

    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as BriefingTemplate
    } catch {
      return null
    }
  }

  save(template: BriefingTemplate): { id: string } {
    const dir = this.ensureDir()
    template.updatedAt = new Date().toISOString()

    if (!template.createdAt) {
      template.createdAt = template.updatedAt
    }

    const filePath = join(dir, `${template.id}.json`)
    writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8')

    return { id: template.id }
  }

  delete(id: string): void {
    const dir = this.ensureDir()
    const filePath = join(dir, `${id}.json`)

    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }
}

export const templateService = new TemplateService()
