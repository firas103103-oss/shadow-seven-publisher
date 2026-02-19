/**
 * Ollama AI Client — يحل محل Google Gemini
 * متوافق مع OpenAI API (Ollama /v1/chat/completions)
 *
 * المتغيرات البيئية:
 *   VITE_OLLAMA_BASE_URL  → عنوان Ollama (proxy via nginx /ai)
 *   VITE_OLLAMA_MODEL     → اسم النموذج (default: llama3.2:3b)
 */

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || '/ai'
const DEFAULT_MODEL   = import.meta.env.VITE_OLLAMA_MODEL    || 'llama3.2:3b'

// ─────────────────────────────────────────────────────────────
export class GeminiClient {
  constructor (modelName = DEFAULT_MODEL) {
    this.model = modelName
  }

  /* استدعاء LLM بقائمة رسائل (محاكاة base44 InvokeLLM) */
  async invokeLLM ({ messages, temperature = 0.7, max_tokens = 4000 }) {
    try {
      const resp = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens,
          stream: false
        })
      })
      if (!resp.ok) {
        const err = await resp.text()
        throw new Error(`Ollama ${resp.status}: ${err.slice(0,200)}`)
      }
      const data = await resp.json()
      const text = data.choices?.[0]?.message?.content || ''
      return { status: 'success', output: text, usage: data.usage || {} }
    } catch (error) {
      console.error('Ollama invokeLLM error:', error)
      throw new Error(`فشل استدعاء المساعد الذكي: ${error.message}`)
    }
  }

  /* توليد نص بسيط */
  async generateContent (prompt, config = {}) {
    try {
      const resp = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       this.model,
          messages:    [{ role: 'user', content: prompt }],
          temperature: config.temperature ?? 0.7,
          max_tokens:  config.max_tokens  ?? 4000,
          stream:      false
        })
      })
      if (!resp.ok) throw new Error(`Ollama ${resp.status}`)
      const data = await resp.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (error) {
      console.error('Ollama generateContent error:', error)
      throw new Error(`فشل توليد المحتوى: ${error.message}`)
    }
  }

  /* بث streaming */
  async streamContent (prompt, onChunk, config = {}) {
    try {
      const resp = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       this.model,
          messages:    [{ role: 'user', content: prompt }],
          temperature: config.temperature ?? 0.7,
          max_tokens:  config.max_tokens  ?? 4000,
          stream:      true
        })
      })
      if (!resp.ok) throw new Error(`Ollama ${resp.status}`)
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const raw = line.slice(6)
          if (raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) { fullText += content; onChunk(content) }
          } catch { /* skip */ }
        }
      }
      return fullText
    } catch (error) {
      throw new Error(`فشل streaming: ${error.message}`)
    }
  }
}

// ─── instances (backward compat) ────────────────────────────
export const gemini    = new GeminiClient()
export const geminiPro = new GeminiClient(DEFAULT_MODEL)
export default GeminiClient
