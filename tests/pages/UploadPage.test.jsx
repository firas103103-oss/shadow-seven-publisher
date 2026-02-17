import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UploadPage from '@/Pages/UploadPage';

const UploadPageWithRouter = () => (
  <BrowserRouter>
    <UploadPage />
  </BrowserRouter>
);

describe('Upload Page', () => {
  it('يجب أن يعرض منطقة رفع الملفات', () => {
    render(<UploadPageWithRouter />);
    expect(screen.getByText(/ارفع مخطوطتك|Upload|اسحب|Drop/i)).toBeInTheDocument();
  });

  it('يجب أن يعرض أنواع الملفات المدعومة', () => {
    render(<UploadPageWithRouter />);
    expect(screen.getByText(/TXT|PDF|DOC|DOCX/i)).toBeInTheDocument();
  });

  it('يجب أن يعرض حد الحجم المسموح', () => {
    render(<UploadPageWithRouter />);
    expect(screen.getByText(/50|MB/i)).toBeInTheDocument();
  });

  it('يجب أن يكون هناك زر لاختيار الملف', () => {
    render(<UploadPageWithRouter />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('يجب أن يحتوي على input للملفات', () => {
    const { container } = render(<UploadPageWithRouter />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('يجب أن يعرض معلومات عن المعالجة', () => {
    render(<UploadPageWithRouter />);
    // التحقق من وجود نص يشير إلى معالجة NLP
    const text = screen.getByText(/تحليل|NLP|معالجة|Analysis/i);
    expect(text).toBeInTheDocument();
  });
});
