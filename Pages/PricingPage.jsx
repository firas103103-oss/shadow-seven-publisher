import { Link } from 'react-router-dom'
import { Check, BookOpen, Zap, Building2 } from 'lucide-react'

const tiers = [
  {
    name: 'Starter',
    price: 49,
    period: 'شهر',
    desc: 'أفراد وفرق صغيرة',
    features: ['3 مخطوطات شهرياً', 'تصدير PDF/EPUB', 'دعم عربي'],
    icon: BookOpen,
    href: '/login',
    cta: 'ابدأ مجاناً',
  },
  {
    name: 'Professional',
    price: 199,
    period: 'شهر',
    desc: 'أعمال نامية',
    features: ['مخطوطات غير محدودة', 'AI Cover Design', 'تحليلات متقدمة', 'دعم أولوية'],
    icon: Zap,
    href: '/login',
    cta: 'جرب الآن',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 499,
    period: 'شهر',
    desc: 'منظمات كبيرة',
    features: ['كل ميزات Pro', 'SSO', 'API مخصص', 'مدير حساب مخصص'],
    icon: Building2,
    href: '/login',
    cta: 'تواصل معنا',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">خطط Shadow Seven</h1>
          <p className="text-xl text-slate-600">منصة نشر محتوى ذكية مدعومة بالذكاء الاصطناعي</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border-2 p-8 bg-white shadow-lg transition hover:shadow-xl ${
                tier.popular ? 'border-indigo-500 scale-105' : 'border-slate-200'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 right-4 px-3 py-1 bg-indigo-500 text-white text-sm rounded-full">
                  الأكثر طلباً
                </span>
              )}
              <tier.icon className="w-12 h-12 text-indigo-600 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{tier.name}</h2>
              <p className="text-slate-600 mb-4">{tier.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">${tier.price}</span>
                <span className="text-slate-600">/{tier.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-slate-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={tier.href}
                className={`block w-full py-3 rounded-lg text-center font-medium ${
                  tier.popular
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-500 mt-12">
          جميع الأسعار بالدولار الأمريكي. تجربة مجانية 14 يوماً.
        </p>
      </div>
    </div>
  )
}
