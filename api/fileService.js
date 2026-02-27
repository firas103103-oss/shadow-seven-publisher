/**
 * File Upload & Processing — PostgreSQL عبر Backend
 * يستبدل Supabase Storage
 */

import { gemini } from './geminiClient'
import { uploadManuscriptFile } from './backendClient'
import mammoth from 'mammoth'

export class FileService {
  /**
   * رفع ملف إلى Backend (PostgreSQL + تخزين محلي)
   */
  static async uploadFile(file) {
    const result = await uploadManuscriptFile(file, {
      title: file.name.replace(/\.[^.]+$/, ''),
      word_count: 0,
      metadata: {}
    })
    return {
      file_url: result.file_path ? `/api/shadow7/manuscripts/${result.id}` : null,
      file_path: result.file_path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      id: result.id
    }
  }

  /**
   * استخراج النص من الملف
   */
  static async extractDataFromFile(file) {
    let rawContent = ''
    const fileType = file.type || file.name.split('.').pop()

    if (fileType.includes('text/plain') || file.name.endsWith('.txt')) {
      rawContent = await this.extractTextFromTxt(file)
    } else if (fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || file.name.endsWith('.docx')) {
      rawContent = await this.extractTextFromDocx(file)
    } else if (file.name.endsWith('.html') || fileType.includes('text/html')) {
      rawContent = await this.extractTextFromHtml(file)
    } else {
      throw new Error('نوع الملف غير مدعوم. الرجاء استخدام TXT أو DOCX أو HTML')
    }

    const metadata = await this.extractMetadata(rawContent)

    return {
      status: 'success',
      output: {
        raw_content: rawContent,
        title: metadata.title || '',
        author: metadata.author || ''
      }
    }
  }

  static async extractTextFromTxt(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('فشل قراءة الملف'))
      reader.readAsText(file, 'UTF-8')
    })
  }

  static async extractTextFromDocx(file) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  static async extractTextFromHtml(file) {
    const htmlContent = await this.extractTextFromTxt(file)
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')
    doc.querySelectorAll('script, style').forEach(el => el.remove())
    return doc.body.textContent || doc.body.innerText || ''
  }

  static async extractMetadata(text) {
    try {
      const sample = text.substring(0, 2000)
      const prompt = `قم بتحليل هذا النص واستخرج العنوان واسم المؤلف إن وجدا.
أعطني الإجابة بصيغة JSON فقط:
{"title": "عنوان الكتاب", "author": "اسم المؤلف"}

النص:
${sample}`

      const response = await gemini.generateContent(prompt, { temperature: 0.3 })
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) return JSON.parse(jsonMatch[0])
      return { title: '', author: '' }
    } catch {
      return { title: '', author: '' }
    }
  }

  static async deleteFile(filePath) {
    // لا يوجد حذف ملف من Backend حالياً — يمكن إضافته لاحقاً
    return { success: true }
  }
}

export default FileService
