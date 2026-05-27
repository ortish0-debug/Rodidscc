import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Download, 
  Building2, 
  Workflow, 
  TrendingUp, 
  Contact, 
  ChevronRight,
  RefreshCw,
  Clock,
  Briefcase
} from 'lucide-react';

interface AiAuditPageProps {
  onBackToHome: () => void;
}

export default function AiAuditPage({ onBackToHome }: AiAuditPageProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [savedLeadId, setSavedLeadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Core Audit Questionnaire State
  const [formData, setFormData] = useState({
    companyName: '',
    industry: 'Услуги и Консалтинг',
    revenue: '10-100 млн руб / год',
    employees: '10-50 человек',
    geography: 'Россия',
    bottlenecks: '',
    manualTasks: '',
    currentSystems: [] as string[],
    existingAI: 'Нет',
    aiDetails: '',
    mainGoal: 'Ускорить рутинные процессы',
    expectedEffect: 'Сокращение трудозатрат на 15-30%',
    budget: '500 тыс - 2 млн руб',
    timeline: '3 месяца',
    contactName: '',
    contactEmail: '',
    contactPhone: ''
  });

  const industriesList = [
    'Услуги и Консалтинг',
    'Производство и Промышленность',
    'Интернет-торговля и Ритейл',
    'IT и Диджитал-агентства',
    'Логистика и Транспорт',
    'Строительство и Недвижимость',
    'Финансы, Страхование и Финтех',
    'Другое'
  ];

  const systemsOptions = [
    'Excel / Google Таблицы',
    'CRM-система (Битрикс24 / amoCRM)',
    '1С:Предприятие',
    'ERP / SAP',
    'Trello / Notion / Jira',
    'Мессенджеры (Telegram/WhatsApp для бизнеса)'
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSystemSelection = (system: string) => {
    setFormData(prev => {
      const current = [...prev.currentSystems];
      if (current.includes(system)) {
        return { ...prev, currentSystems: current.filter(s => s !== system) };
      } else {
        return { ...prev, currentSystems: [...current, system] };
      }
    });
  };

  const handleNextStep = () => {
    // Basic validations per step
    if (step === 1 && !formData.companyName.trim()) {
      alert('Пожалуйста, введите название вашей компании.');
      return;
    }
    if (step === 2 && (!formData.bottlenecks.trim() || !formData.manualTasks.trim())) {
      alert('Пожалуйста, коротко опишите рутинные процессы и задачи.');
      return;
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const triggerAuditSubmit = async () => {
    // Contact step final validations
    if (!formData.contactName.trim() || !formData.contactEmail.trim()) {
      alert('Пожалуйста, укажите имя и контактный Email.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setLoadingProgress(10);
    setLoadingStatus('Инициализация сессии аудита...');

    // Progress bar fake tickers to deliver satisfying corporate consulting "wait-time" and fidelity
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 92) {
          clearInterval(interval);
          return 92;
        }
        
        // Dynamic status text updates based on loading steps
        if (prev < 30) {
          setLoadingStatus('Анализируем отраслевые бенчмарки и размеры бизнеса...');
        } else if (prev < 60) {
          setLoadingStatus('Claude 3.5 Sonnet оценивает потенциал автоматизации узких мест...');
        } else if (prev < 80) {
          setLoadingStatus('Рассчитываем финансовый ROI, CAPEX, OPEX и период окупаемости...');
        } else {
          setLoadingStatus('Компилируем стратегический PDF-отчет и подключаем Resend API...');
        }

        return prev + Math.floor(Math.random() * 8) + 2;
      });
    }, 450);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingStatus('Отчет успешно составлен!');

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Ошибка при генерации отчета.');
      }

      const resJson = await response.json();
      setAuditResult(resJson.report);
      if (resJson.leadId) {
        setSavedLeadId(resJson.leadId);
      }
    } catch (err: any) {
      console.error('Audit compilation failure:', err);
      setErrorMessage(err.message || 'Произошла непредвиденная ошибка при запросе к ИИ. Попробуйте отправить повторно.');
    } finally {
      setLoading(false);
    }
  };

  const restartAudit = () => {
    setStep(1);
    setAuditResult(null);
    setSavedLeadId(null);
    setErrorMessage(null);
    setFormData(prev => ({
      ...prev,
      bottlenecks: '',
      manualTasks: '',
      contactName: '',
      contactEmail: '',
      contactPhone: ''
    }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-16 pt-32">
      
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-10 border-b border-white/5 pb-6">
        <div>
          <button 
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white transition-colors mb-3 group cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Вернуться на главную
          </button>
          <h2 className="text-3xl md:text-4xl font-heading italic font-normal text-white">
            Калькулятор окупаемости ИИ (ROI)
          </h2>
          <p className="text-xs font-mono text-neutral-400 mt-1 uppercase tracking-wider">
            РАСЧЕТ ЭКОНОМИЧЕСКОГО ЭФФЕКТА И СКОРОСТИ ВОЗВРАТА ИНВЕСТИЦИЙ В АВТОМАТИЗАЦИЮ
          </p>
        </div>

        {!auditResult && !loading && (
          <div className="flex items-center gap-2 bg-neutral-900 border border-white/5 rounded-xl px-4 py-2 text-xs font-mono text-neutral-400 select-none">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            Шаг {step} из 4
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        
        {/* LOADING PROCESS TICKER SCREEN */}
        {loading && (
          <motion.div 
            key="loading-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="liquid-glass rounded-3xl p-8 md:p-12 flex flex-col items-center text-center justify-center min-h-[450px]"
          >
            <div className="relative mb-8 h-20 w-20 flex items-center justify-center">
              {/* Outer Pulsing Glow */}
              <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping"></div>
              {/* Spinning Accent */}
              <div className="absolute inset-0 rounded-full border-2 border-white/5 border-t-blue-500 animate-spin"></div>
              {/* Centered Spark Icon */}
              <Sparkles className="h-8 w-8 text-blue-400 animate-pulse" />
            </div>

            <h3 className="font-heading italic text-2xl text-white mb-2 font-medium">
              ИИ Экспресс-Оценка в работе
            </h3>
            
            <p className="text-sm text-neutral-400 max-w-[45ch] mb-8 leading-relaxed font-body font-light">
              {loadingStatus}
            </p>

            {/* Custom Premium progress bar */}
            <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-full p-1">
              <div 
                className="h-2.5 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            
            <span className="text-xs font-mono text-neutral-400 mt-3 select-none">
              Готово: {loadingProgress}%
            </span>
          </motion.div>
        )}

        {/* ERROR SCREEN */}
        {!loading && errorMessage && (
          <motion.div 
            key="error-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="liquid-glass rounded-2xl p-8 md:p-12 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-900 text-red-400 flex items-center justify-center mx-auto mb-4 font-mono text-xl font-bold">
              !
            </div>
            <h4 className="text-lg font-heading text-white font-medium mb-2">Не удалось сгенерировать аудит</h4>
            <p className="text-sm text-neutral-400 max-w-[45ch] mx-auto mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={restartAudit}
              className="px-6 py-3 bg-white text-black text-xs font-mono font-bold uppercase tracking-wider rounded-xl hover:bg-neutral-200 transition-colors"
            >
              Попробовать заново
            </button>
          </motion.div>
        )}

        {/* COMPLETED REPORT VIEW SCREEN */}
        {!loading && auditResult && !errorMessage && (
          <motion.div 
            key="report-result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-200 text-sm rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <strong className="font-semibold block mb-0.5">🚀 Анализ успешно завершен!</strong>
                <span className="text-xs block text-emerald-300 font-light">Документ стратегического планирования отправлен на {formData.contactEmail}</span>
              </div>
              
              {savedLeadId && (
                <a 
                  href={`/api/download-audit-pdf?id=${savedLeadId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-500 hover:bg-emerald-600 text-black px-5 py-3 rounded-xl font-bold text-xs font-mono tracking-wider uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all w-full sm:w-auto justify-center"
                >
                  <Download className="h-4 w-4" />
                  Скачать PDF-отчет
                </a>
              )}
            </div>

            {/* Render direct HTML output */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl p-4 md:p-8 text-neutral-800">
              <div dangerouslySetInnerHTML={{ __html: auditResult }} className="prose prose-blue max-w-none text-neutral-700" />
            </div>

            {/* Back action row */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between pt-6 border-t border-white/5">
              <button 
                onClick={restartAudit}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white py-3"
              >
                <RefreshCw className="h-4 w-4" />
                Новый экспресс-аудит
              </button>

              <button 
                onClick={onBackToHome}
                className="w-full sm:w-auto bg-white hover:bg-neutral-200 text-black font-semibold px-8 py-3.5 rounded-xl cursor-pointer shadow-lg active:scale-98 transition-colors text-center"
              >
                Вернуться на главную
              </button>
            </div>
          </motion.div>
        )}

        {/* QUESTIONNAIRE WIZARD SCHEMAS */}
        {!loading && !auditResult && !errorMessage && (
          <motion.div 
            key={`step-${step}`}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="liquid-glass rounded-3xl p-6 md:p-10 border border-white/5"
          >
            {/* Step 1: Company Profile */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-heading text-white italic mb-1 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    Основная информация
                  </h3>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Профиль вашей организации, размер и масштаб для правильной калибровки затрат и рентабельности.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Название компании *
                    </label>
                    <input 
                      type="text"
                      name="companyName"
                      required
                      value={formData.companyName}
                      onChange={handleInputChange}
                      placeholder="Например: ООО Логистик Групп"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Отрасль / Сфера деятельности
                    </label>
                    <div className="relative">
                      <select 
                        name="industry"
                        value={formData.industry}
                        onChange={handleInputChange}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                      >
                        {industriesList.map((ind, idx) => (
                          <option key={idx} value={ind} className="bg-zinc-950 text-white">{ind}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Годовая выручка бизнеса
                    </label>
                    <div className="relative">
                      <select 
                        name="revenue"
                        value={formData.revenue}
                        onChange={handleInputChange}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                      >
                        <option value="до 10 млн руб" className="bg-zinc-950 text-white">до 10 млн руб / год</option>
                        <option value="10-100 млн руб" className="bg-zinc-950 text-white">10 - 100 млн руб / год</option>
                        <option value="100-500 млн руб" className="bg-zinc-950 text-white">100 - 500 млн руб / год</option>
                        <option value="500 млн - 1 млрд руб" className="bg-zinc-950 text-white">500 млн - 1 млрд руб / год</option>
                        <option value="свыше 1 млрд руб" className="bg-zinc-950 text-white">свыше 1 млрд руб / год</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Количество сотрудников
                    </label>
                    <div className="relative">
                      <select 
                        name="employees"
                        value={formData.employees}
                        onChange={handleInputChange}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                      >
                        <option value="до 10 человек" className="bg-zinc-950 text-white">до 10 человек</option>
                        <option value="10-50 человек" className="bg-zinc-950 text-white">10 - 50 человек</option>
                        <option value="50-200 человек" className="bg-zinc-950 text-white">50 - 200 человек</option>
                        <option value="свыше 200 человек" className="bg-zinc-950 text-white">свыше 200 человек</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Географический охват деятельности
                    </label>
                    <input 
                      type="text"
                      name="geography"
                      value={formData.geography}
                      onChange={handleInputChange}
                      placeholder="Например: Россия и СНГ, Москва и область, Ростов-на-Дону"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Operational Bottlenecks */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-heading text-white italic mb-1 flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-blue-500" />
                    Процессы и Инфраструктура
                  </h3>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Характер ручных операций и используемые системы для выявления максимального потенциала автоматизации.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Какие процессы отнимают больше всего времени? *
                    </label>
                    <textarea 
                      name="bottlenecks"
                      required
                      rows={2}
                      value={formData.bottlenecks}
                      onChange={handleInputChange}
                      placeholder="Например: Составление договоров по шаблонам, ручной ввод счетов, ответы на частые вопросы клиентов на сайте..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20 resize-none font-body font-light"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Опишите конкретные ручные задачи сотрудников для ИИ *
                    </label>
                    <textarea 
                      name="manualTasks"
                      required
                      rows={2}
                      value={formData.manualTasks}
                      onChange={handleInputChange}
                      placeholder="Например: Перенос данных из почты в Excel, заполнение личных карточек CRM, распределение писем контрагентов."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20 resize-none font-body font-light"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-2 uppercase tracking-wide">
                      Какие системы уже используются в работе? (Выберите несколько)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {systemsOptions.map((sys, sysIdx) => {
                        const isSelected = formData.currentSystems.includes(sys);
                        return (
                          <button
                            key={sysIdx}
                            type="button"
                            onClick={() => toggleSystemSelection(sys)}
                            className={`px-4 py-3 text-left rounded-xl border text-xs font-mono font-medium transition-all flex items-center justify-between cursor-pointer ${
                              isSelected 
                                ? 'bg-white/10 border-white/40 text-white shadow-inner shadow-white/5' 
                                : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/[0.07] hover:border-white/10'
                            }`}
                          >
                            <span>{sys}</span>
                            <span className={`h-4 w-4 rounded-md border flex items-center justify-center font-bold text-[10px] ${
                              isSelected ? 'bg-white border-white text-black' : 'border-neutral-600'
                            }`}>
                              {isSelected && '✓'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                        Имеете ли вы текущий опыт работы с ИИ?
                      </label>
                      <div className="relative">
                        <select 
                          name="existingAI"
                          value={formData.existingAI}
                          onChange={handleInputChange}
                          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                        >
                          <option value="Нет" className="bg-zinc-950 text-white">Нет, не используем</option>
                          <option value="Да" className="bg-zinc-950 text-white">Да, используем фрагментарно</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40 text-xs">
                          ▼
                        </div>
                      </div>
                    </div>

                    {formData.existingAI === 'Да' && (
                      <div>
                        <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                          Какие инструменты/задачи уже пробовали?
                        </label>
                        <input 
                          type="text"
                          name="aiDetails"
                          value={formData.aiDetails}
                          onChange={handleInputChange}
                          placeholder="Например: ChatGPT в Telegram для текстов"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Business goals and budget */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-heading text-white italic mb-1 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Потребности и Ресурсы
                  </h3>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Планируемые инвестиционные рамки и приоритетные цели для разработки дорожной карты внедрения.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Главная цель внедрения AI
                    </label>
                    <input 
                      type="text"
                      name="mainGoal"
                      value={formData.mainGoal}
                      onChange={handleInputChange}
                      placeholder="Например: Разгрузить сотрудников от Excel баз"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Ожидаемый эффект через 1 год
                    </label>
                    <input 
                      type="text"
                      name="expectedEffect"
                      value={formData.expectedEffect}
                      onChange={handleInputChange}
                      placeholder="Например: Ускорение подготовки договоров в 5 раз"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Комфортный бюджет проекта
                    </label>
                    <div className="relative">
                      <select 
                        name="budget"
                        value={formData.budget}
                        onChange={handleInputChange}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                      >
                        <option value="до 500 тыс руб" className="bg-zinc-950 text-white">до 500 тыс рублей</option>
                        <option value="500 тыс - 2 млн руб" className="bg-zinc-950 text-white">500 тыс — 2 млн рублей</option>
                        <option value="2-5 млн руб" className="bg-zinc-950 text-white">2 млн — 5 млн рублей</option>
                        <option value="свыше 5 млн руб" className="bg-zinc-950 text-white">свыше 5 млн рублей</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Желаемые сроки внедрения
                    </label>
                    <div className="relative">
                      <select 
                        name="timeline"
                        value={formData.timeline}
                        onChange={handleInputChange}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                      >
                        <option value="до 1 месяца" className="bg-zinc-950 text-white">Супер-быстро: до 1 месяца</option>
                        <option value="3 месяца" className="bg-zinc-950 text-white">Комфортно: 3 месяца</option>
                        <option value="6 месяцев" className="bg-zinc-950 text-white">Среднесрочно: 6 месяцев</option>
                        <option value="под ключ по Agile" className="bg-zinc-950 text-white">Глубоко: под ключ по Agile</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Contact details */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-heading text-white italic mb-1 flex items-center gap-2">
                    <Contact className="h-5 w-5 text-blue-500" />
                    Контакты Получателя
                  </h3>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Укажите адреса для отправки прикрепляемого официального стратегического PDF-документа.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Ваше имя (ФИО / Должность) *
                    </label>
                    <input 
                      type="text"
                      name="contactName"
                      required
                      value={formData.contactName}
                      onChange={handleInputChange}
                      placeholder="Иванов Константин Петрович, ИТ-Директор"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20 font-body font-light"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                        Рабочий Email (для отчета) *
                      </label>
                      <input 
                        type="email"
                        name="contactEmail"
                        required
                        value={formData.contactEmail}
                        onChange={handleInputChange}
                        placeholder="k.ivanov@domain.ru"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                        Контактный телефон (необязательно)
                      </label>
                      <input 
                        type="tel"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleInputChange}
                        placeholder="+7 (999) 000-00-00"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20 font-mono"
                      />
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-xs text-neutral-400 leading-normal font-sans">
                    💡 <strong>Конфиденциальность:</strong> Все переданные бизнес-данные являются условными и защищены нашими соглашениями об информационной безопасности. Отчет генерируется мгновенно нашей ИИ-системой.
                  </div>
                </div>
              </div>
            )}

            {/* ACTION FOOTER */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
              
              {/* Reset/Back logic */}
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-5 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-neutral-300 font-semibold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                >
                  ◄ Назад
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="px-5 py-3 rounded-xl border border-white/5 hover:bg-white/5 text-neutral-400 font-semibold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                >
                  Закрыть и выйти
                </button>
              )}

              {/* Progress/Submit logic */}
              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-3 rounded-xl cursor-pointer active:scale-95 transition-all text-xs font-mono uppercase tracking-widest flex items-center gap-1.5 duration-200"
                >
                  Продолжить
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={triggerAuditSubmit}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-8 py-3.5 rounded-xl cursor-pointer shadow-lg shadow-blue-500/10 active:scale-95 transition-all text-xs font-mono uppercase tracking-widest flex items-center gap-2 duration-300 animate-pulse"
                >
                  <Sparkles className="h-4 w-4" />
                  Запустить ИИ-эксперта
                </button>
              )}

            </div>

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
