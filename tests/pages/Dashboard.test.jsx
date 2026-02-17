import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '@/Pages/Dashboard';

const DashboardWithRouter = () => (
  <BrowserRouter>
    <Dashboard />
  </BrowserRouter>
);

describe('Dashboard Page', () => {
  it('يجب أن يعرض عنوان لوحة التحكم', () => {
    render(<DashboardWithRouter />);
    expect(screen.getByText(/لوحة التحكم|Dashboard/i)).toBeInTheDocument();
  });

  it('يجب أن يعرض بطاقات الإحصائيات', () => {
    render(<DashboardWithRouter />);
    
    // البحث عن عناوين الإحصائيات
    const statCards = screen.getAllByRole('heading', { level: 3 });
    expect(statCards.length).toBeGreaterThan(0);
  });

  it('يجب أن يعرض المخطوطات الأخيرة', () => {
    render(<DashboardWithRouter />);
    expect(screen.getByText(/المخطوطات الأخيرة|Recent Manuscripts/i)).toBeInTheDocument();
  });

  it('يجب أن يعرض أزرار الإجراءات السريعة', () => {
    render(<DashboardWithRouter />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('يجب أن يعرض المكونات الأساسية', () => {
    const { container } = render(<DashboardWithRouter />);
    
    // التحقق من وجود الحاويات الرئيسية
    expect(container.querySelector('.grid, .flex')).toBeInTheDocument();
  });
});
