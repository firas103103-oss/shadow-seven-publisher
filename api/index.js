/**
 * API Client — PostgreSQL عبر FastAPI (بديل Supabase)
 */

export { authApi, manuscriptsApi, uploadManuscriptFile, getDashboardStats } from './backendClient'
export { gemini, geminiPro, GeminiClient } from './geminiClient'

import { manuscriptsApi, uploadManuscriptFile, getDashboardStats } from './backendClient'
import { gemini } from './geminiClient'

// Backward compatibility
export const apiClient = {
  getManuscripts: (params) => manuscriptsApi.list(params),
  getManuscript: (id) => manuscriptsApi.get(id),
  createManuscript: (data) => manuscriptsApi.create(data),
  updateManuscript: (id, data) => manuscriptsApi.update(id, data),
  deleteManuscript: (id) => manuscriptsApi.delete(id),
  uploadFile: (file) => uploadManuscriptFile(file),
  getDashboardStats
}

export const api = {
  entities: {
    Manuscript: {
      list: manuscriptsApi.list,
      get: manuscriptsApi.get,
      create: manuscriptsApi.create,
      update: manuscriptsApi.update,
      delete: manuscriptsApi.delete,
      filter: async (filters) => {
        const all = await manuscriptsApi.list()
        return all.filter(m => {
          for (const [k, v] of Object.entries(filters)) {
            if (m[k] !== v) return false
          }
          return true
        })
      }
    },
    ComplianceRule: { list: async () => [], create: async () => ({}), update: async () => ({}), delete: async () => {} },
    CoverDesign: { create: async () => ({}) },
    ProcessingJob: { filter: async () => [] }
  },
  integrations: {
    Core: {
      InvokeLLM: async ({ prompt, messages, temperature, max_tokens }) => {
        if (prompt) {
          const result = await gemini.generateContent(prompt, { temperature, max_tokens })
          return { output: result }
        }
        if (messages) {
          return await gemini.invokeLLM({ messages, temperature, max_tokens })
        }
      },
      UploadFile: async ({ file }) => uploadManuscriptFile(file),
      ExtractDataFromUploadedFile: async ({ file }) => {
        if (file) {
          const FileService = (await import('./fileService')).default
          return await FileService.extractDataFromFile(file)
        }
        throw new Error('File required')
      }
    }
  }
}

export default api
