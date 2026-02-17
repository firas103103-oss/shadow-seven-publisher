import { AlertCircle, CheckCircle2, FileX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MAX_FILE_SIZE = 7 * 1024 * 1024; // 7MB
const ALLOWED_TYPES = ['.txt', '.html', '.docx'];
const ALLOWED_MIMES = [
  'text/plain',
  'text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const validateFile = (file) => {
  const errors = [];
  
  if (!file) {
    return { valid: false, errors: ['الرجاء اختيار ملف'] };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`حجم الملف (${(file.size / 1024 / 1024).toFixed(2)} MB) يتجاوز الحد الأقصى المسموح (7 MB)`);
  }
  
  // Check file type
  const extension = '.' + file.name.split('.').pop().toLowerCase();
  const isValidType = ALLOWED_TYPES.includes(extension) && ALLOWED_MIMES.includes(file.type);
  
  if (!isValidType) {
    errors.push(`نوع الملف غير مدعوم. الرجاء استخدام أحد الصيغ التالية: ${ALLOWED_TYPES.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      extension
    }
  };
};

export function FileValidationAlert({ validation }) {
  if (!validation) return null;
  
  if (validation.valid) {
    return (
      <Alert className="bg-emerald-50 border-emerald-200">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertDescription className="text-emerald-800">
          الملف صالح للمعالجة
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Alert variant="destructive" className="bg-red-50 border-red-200">
      <FileX className="h-4 w-4" />
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1">
          {validation.errors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export default { validateFile, FileValidationAlert };