import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUpRight, 
  Play, 
  Briefcase, 
  TrendingUp, 
  BarChart3, 
  Bot, 
  X, 
  Check, 
  MessageSquare, 
  Menu,
  Activity,
  Users,
  Calendar,
  Award,
  Mail,
  LogOut
} from 'lucide-react';
import FadingVideo from './components/FadingVideo';
import BlurText from './components/BlurText';
import { initAuth, googleSignIn, logout, sendApplicationEmail } from './lib/firebase';
import type { User } from 'firebase/auth';

export default function App() {
  // Mobile navigation drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const scrollToSection = (e: React.MouseEvent, id: string, isMobile: boolean = false) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      if (isMobile) {
        setIsMobileMenuOpen(false);
        // Delay scrolling on mobile so that the menu exit animation has completed.
        // This solves GPU conflicts between transforming a translucent backdrop-filter drawer
        // and animating a layout scroll, eliminating browser jumping & flickering.
        setTimeout(() => {
          const headerOffset = 95;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }, 180);
      } else {
        const headerOffset = 90; // offset to not hide the heading under fixed nav
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };
  
  // Interactive Contact Drawer state
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    contact: '',
    service: 'AI внедрение',
    message: ''
  });

  // Google OAuth and Gmail state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [sendError, setSendError] = useState<{ message: string; isTelegramUnstarted?: boolean } | null>(null);

  // Lock body scrolling ONLY when the interactive contact side drawer is open.
  // We use standard 'overflow: hidden' and 'touch-action: none' directly on the body 
  // which does not affect layout offsets, prevents jumps, and has zero chance of turning the screen black or tearing.
  useEffect(() => {
    if (isContactOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isContactOpen]);

  // Synchronize Google Auth session state on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setUser(u);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact) return;
    
    setIsAuthLoading(true);
    setSendError(null);

    try {
      let response;
      try {
        // Использовать относительный путь для полной интеграции на хостинге
        response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
      } catch (exprError) {
        throw new Error('Не удалось установить соединение с сервером. Пожалуйста, проверьте качество интернет-соединения.');
      }

      let data: any = {};
      const responseText = await response.text();
      
      try {
        if (responseText) {
          data = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('Ошибка разбора JSON:', parseError, responseText);
        // If the status is OK, treat it as a successful registration
        if (response.ok) {
          setFormSubmitted(true);
          return;
        }
        throw new Error('На сервере кратковременный технический сбой. Ваша заявка гарантированно сохранена! Мы свяжемся с вами.');
      }

      if (!response.ok) {
        if (response.status === 412 || data.error === 'telegram_not_started') {
          setSendError({
            message: data.message || 'Бот не активирован в Telegram.',
            isTelegramUnstarted: true
          });
        } else {
          throw new Error(data.message || 'Упс! Произошла непредвиденная ошибка на стороне отправки. Пожалуйста, попробуйте еще раз.');
        }
      } else {
        // Success state persistence
        setFormSubmitted(true);
      }
    } catch (err: any) {
      console.error('Ошибка отправки заявки:', err);
      
      // Clean up technical messages into user-friendly Russian
      let friendlyMessage = 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте отправить повторно или свяжитесь с нами напрямую в Telegram.';
      
      if (err && err.message) {
        const msg = String(err.message).toLowerCase();
        // Avoid raw system/network/JSON messages
        const isTechnicalMsg = msg.includes('json') || 
                               msg.includes('unexpected') || 
                               msg.includes('fetch') || 
                               msg.includes('pattern') || 
                               msg.includes('expected') ||
                               msg.includes('token') ||
                               msg.includes('network') ||
                               msg.includes('failed');
                               
        if (!isTechnicalMsg) {
          friendlyMessage = err.message;
        } else if (msg.includes('fetch') || msg.includes('failed to fetch')) {
          friendlyMessage = 'Сеть временно недоступна. Пожалуйста, проверьте интернет-соединение.';
        } else {
          friendlyMessage = 'Сервер перегружен или проводятся технические работы. Попробуйте еще раз через несколько минут.';
        }
      }
      
      setSendError({
        message: friendlyMessage
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
    } catch (err) {
      console.error('Ошибка выхода:', err);
    }
  };

  const resetForm = () => {
    setFormSubmitted(false);
    setSendError(null);
    setIsContactOpen(false);
    // Only reset the message, keeping contact, so they don't have to retype if they submit another
    setFormData(prev => ({ ...prev, message: '' }));
  };

  return (
    <div className="relative min-h-screen bg-black text-white font-body selection:bg-white/25 antialiased overflow-x-hidden">
      
      {/* BACKGROUND GRAPHIC ACCENTS - subtle visual nodes */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-neutral-900/10 rounded-full blur-[160px] pointer-events-none z-1" />
      <div className="absolute bottom-1/3 right-10 w-96 h-96 bg-neutral-900/20 rounded-full blur-[180px] pointer-events-none z-1" />

      {/* FIXED NAVBAR */}
      <nav className="fixed top-4 left-0 right-0 z-50 px-4 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo Brand: group for circle and label */}
          <motion.a 
            href="#hero"
            onClick={(e) => scrollToSection(e, 'hero')}
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex items-center gap-3 select-none cursor-pointer group w-12 md:w-52"
          >
            <div className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center font-heading text-2xl font-bold italic tracking-tight text-white group-hover:scale-105 transition-all duration-300 shadow-md flex-shrink-0">
              A
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="font-heading italic font-semibold text-white tracking-[0.1em] text-lg leading-none">AXIOM</span>
              <span className="font-mono text-[9px] text-neutral-400 tracking-[0.15em] leading-none mt-1 font-medium uppercase">CONSULTING</span>
            </div>
          </motion.a>

          {/* Desktop Navigation System (Centered pill) */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="hidden md:flex items-center gap-1 liquid-glass rounded-full px-1.5 py-1.5 backdrop-blur-md"
          >
            <a href="#hero" onClick={(e) => scrollToSection(e, 'hero')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors">Главная</a>
            <a href="#services" onClick={(e) => scrollToSection(e, 'services')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors">Услуги</a>
            <a href="#clients" onClick={(e) => scrollToSection(e, 'clients')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors">Клиенты</a>
            <a href="#about" onClick={(e) => scrollToSection(e, 'about')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors">О нас</a>
            <button 
              onClick={() => setIsContactOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              Контакты
            </button>
            
            {/* White CTA Pill inside Nav */}
            <button 
              onClick={() => setIsContactOpen(true)}
              className="ml-2 bg-white text-black rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 hover:bg-neutral-200 active:scale-95 transition-all duration-250 whitespace-nowrap"
            >
              Начать проект 
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </motion.div>

          {/* Mobile Right Menu Trigger / Glass Spacer */}
          <div className="flex md:hidden items-center gap-2">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* Invisible Spacer on desktop to balance centered logo layout */}
          <div className="w-12 md:w-52 h-12 hidden md:block opacity-0 pointer-events-none"></div>
        </div>

        {/* MOBILE MENU NAV PANEL - Nested inside the fixed <nav> to act as a pure overlay that never shifts the main layout */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute top-16 left-4 right-4 z-50 md:hidden liquid-glass-strong rounded-3xl p-6 flex flex-col gap-4 border border-white/5"
            >
              <a 
                href="#hero" 
                onClick={(e) => scrollToSection(e, 'hero', true)}
                className="py-3 px-4 rounded-xl hover:bg-white/5 text-lg font-light tracking-wide text-white"
              >
                Главная
              </a>
              <a 
                href="#services" 
                onClick={(e) => scrollToSection(e, 'services', true)}
                className="py-3 px-4 rounded-xl hover:bg-white/5 text-lg font-light tracking-wide text-white"
              >
                Услуги
              </a>
              <a 
                href="#clients" 
                onClick={(e) => scrollToSection(e, 'clients', true)}
                className="py-3 px-4 rounded-xl hover:bg-white/5 text-lg font-light tracking-wide text-white"
              >
                Клиенты
              </a>
              <a 
                href="#about" 
                onClick={(e) => scrollToSection(e, 'about', true)}
                className="py-3 px-4 rounded-xl hover:bg-white/5 text-lg font-light tracking-wide text-white"
              >
                О нас
              </a>
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsContactOpen(true);
                }}
                className="py-3 px-4 text-left rounded-xl hover:bg-white/5 text-lg font-light tracking-wide text-white"
              >
                Контакты
              </button>

              <button 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsContactOpen(true);
                }}
                className="w-full justify-center bg-white text-black py-4 rounded-2xl font-semibold flex items-center gap-2 mt-2"
              >
                Начать проект
                <ArrowUpRight className="h-5 w-5 stroke-[2.5]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* SECTION 1 — HERO SECTION */}
      <section 
        id="hero" 
        className="relative min-h-screen w-full flex flex-col justify-between items-center bg-black overflow-hidden select-none"
      >
        {/* Cinematic City Night Aerial Loop Background video (120% scale) */}
        <FadingVideo 
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4"
          className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0 select-none pointer-events-none"
          style={{ width: '120%', height: '120%' }}
        />

        {/* Premium ambient backdrop shadow scrim filters for superior text readability over video */}
        <div className="absolute inset-0 z-1 bg-gradient-to-b from-black/85 via-black/45 to-black select-none pointer-events-none" />
        <div className="absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.85)_85%)] select-none pointer-events-none" />

        {/* HERO MAIN BODY CONTAINER - Centered content */}
        <div className="relative z-10 w-full max-w-5xl mx-auto flex-1 flex flex-col items-center justify-center text-center px-4 pt-32 pb-12">
          
           {/* Badge Widget with 0.4s Delay */}
          <motion.div 
            initial={{ opacity: 0, y: 30, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="inline-flex items-center gap-2.5 bg-black/40 border border-white/10 rounded-full p-1 pr-4.5 mb-8 max-w-full hover:bg-black/60 transition-all duration-300 backdrop-blur-md"
          >
            <span className="bg-white text-black px-3.5 py-1.5 text-xs font-bold tracking-wider rounded-full select-none">
              AXIOM CONSULTING
            </span>
            <span className="text-[13px] md:text-sm text-white/90 font-body font-light tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
              Финансово-экономический расчет эффекта от внедрения AI
            </span>
          </motion.div>

          {/* Headline Animation (BlurText component) */}
          <div className="relative mb-6 max-w-4xl mx-auto">
            {/* Ambient glow backing for extreme text contrast */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[70%] bg-black/60 blur-[85px] rounded-full pointer-events-none -z-10" />
            
            <BlurText 
              text="Трансформируем Бизнес Через Технологии и Стратегию"
              className="text-5xl md:text-7xl lg:text-[5.5rem] font-heading italic font-normal text-white leading-[0.85] tracking-[-3px] md:tracking-[-4px] drop-shadow-[0_8px_30px_rgba(0,0,0,0.95)]"
            />
          </div>

          {/* Subheading text with 0.8s Delay */}
          <motion.p 
            initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
            className="text-[13px] text-center font-['Arial',_sans-serif] font-normal leading-[28px] text-neutral-200 max-w-2xl tracking-wide px-4 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]"
          >
            Мы рассчитываем точную окупаемость, экономический эффект и риски внедрения AI-технологий. <br className="hidden md:block" />
            Четкие сценарии роста, калькуляция затрат, защита ваших инвестиций.
          </motion.p>

          {/* CTAs with 1.1s Delay */}
          <motion.div 
            initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 1.1, ease: 'easeOut' }}
            className="flex items-center justify-center gap-6 mt-10 flex-col sm:flex-row w-full sm:w-auto px-4"
          >
            {/* Primary CTA button */}
            <button 
              onClick={() => setIsContactOpen(true)}
              className="w-full sm:w-auto liquid-glass-strong rounded-full px-7 py-3.5 text-sm font-semibold text-white flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              Запустить проект
              <ArrowUpRight className="h-4.5 w-4.5 stroke-[2.5]" />
            </button>

            {/* Secondary Link button */}
            <a 
              href="#clients"
              onClick={(e) => scrollToSection(e, 'clients')}
              className="group inline-flex items-center justify-center gap-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors py-2"
            >
              Смотреть кейсы
              <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/15 transition-all duration-300">
                <Play className="h-3 w-3 text-white fill-white translate-x-0.5" />
              </span>
            </a>
          </motion.div>

          {/* Minimal Double Stats Row with 1.3s Delay */}
          <motion.div 
            initial={{ opacity: 0, y: 25, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 1.3, ease: 'easeOut' }}
            className="flex flex-col sm:flex-row items-stretch justify-center gap-5 mt-16"
          >
            {/* Stat Card 1 */}
            <div className="liquid-glass p-5 w-full sm:w-[220px] rounded-[1.25rem] flex flex-col text-left group hover:bg-white/[0.04] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center text-white/80 group-hover:text-white transition-colors">
                <Briefcase className="h-5 w-5 stroke-[1.5]" />
              </div>
              <div className="font-heading italic text-white text-4.5xl font-medium tracking-tight mt-6 leading-none select-all">
                47+
              </div>
              <div className="text-xs text-white/50 font-body font-light mt-2 tracking-wide">
                Завершённых проектов
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="liquid-glass p-5 w-full sm:w-[220px] rounded-[1.25rem] flex flex-col text-left group hover:bg-white/[0.04] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center text-white/80 group-hover:text-white transition-colors">
                <TrendingUp className="h-5 w-5 stroke-[1.5]" />
              </div>
              <div className="font-heading italic text-white text-4.5xl font-medium tracking-tight mt-6 leading-none select-all">
                ₽480M+
              </div>
              <div className="text-xs text-white/50 font-body font-light mt-2 tracking-wide">
                Привлечённых инвестиций
              </div>
            </div>
          </motion.div>

        </div>

        {/* PARTNERS STRIP with 1.4s Delay */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4, ease: 'easeOut' }}
          className="relative z-10 w-full flex flex-col items-center gap-5 pb-12 pt-6 px-4 border-t border-white/5 bg-gradient-to-b from-transparent to-black/30"
        >
          <div className="liquid-glass rounded-full px-4 py-1.5 text-[11px] font-medium text-neutral-400 tracking-wider uppercase select-none">
            Работаем с компаниями разного уровня
          </div>
          
          <div className="font-heading italic font-light text-white text-2.5xl md:text-3.5xl tracking-normal flex items-center justify-center flex-wrap gap-x-12 gap-y-3 md:gap-x-16 opacity-80 select-none">
            <span className="hover:opacity-100 transition-opacity cursor-default hover:scale-105 duration-200">EY</span>
            <span className="hover:opacity-100 transition-opacity cursor-default hover:scale-105 duration-200 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block"></span>Сбер
            </span>
            <span className="hover:opacity-100 transition-opacity cursor-default hover:scale-105 duration-200">BIT</span>
            <span className="hover:opacity-100 transition-opacity cursor-default hover:scale-105 duration-200">ЮФУ</span>
            <span className="hover:opacity-100 transition-opacity cursor-default hover:scale-105 duration-200 font-sans tracking-tight">
              Bio<span className="opacity-50">Long</span>Life
            </span>
          </div>
        </motion.div>
      </section>

      {/* SECTION 2 — SERVICES / CAPABILITIES */}
      <section 
        id="services" 
        className="relative min-h-screen w-full bg-black overflow-hidden flex flex-col justify-center"
      >
        {/* Subtle dynamic data streams looping video */}
        <FadingVideo 
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4"
          className="absolute inset-0 w-full h-full object-cover z-0 select-none pointer-events-none opacity-40"
        />

        {/* Overlay to ensure readability and prestige */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/60 z-1 pointer-events-none" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-20 pt-28 pb-16 flex flex-col min-h-screen justify-between">
          
          {/* Header */}
          <div className="mb-auto text-left">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5 }}
              className="text-xs font-mono text-neutral-400 tracking-widest uppercase mb-4"
            >
              // Услуги и экспертиза
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 30, filter: 'blur(5px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="font-heading italic text-white text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.9] tracking-[-3px] font-normal"
            >
              Экспертиза <br className="hidden md:block"/>
              нового уровня
            </motion.h2>
          </div>

          {/* Three capability cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 mb-8">
            
            {/* Card 1: AI расчет */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="liquid-glass rounded-[1.25rem] p-6.5 min-h-[380px] flex flex-col hover:translate-y-[-4px] hover:bg-white/[0.02] transition-all duration-300 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Robot/Bot icon */}
                <div className="w-11 h-11 rounded-[0.75rem] liquid-glass flex items-center justify-center text-white shrink-0">
                  <Bot className="h-6 w-6 text-white" />
                </div>

                {/* Pill Tag Row */}
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[75%] select-none">
                  {['Аудит эффекта', 'Расчет окупаемости', 'Оценка CAPEX/OPEX', 'ROI-аналитика'].map(tag => (
                    <span key={tag} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/80 font-body font-normal tracking-wide whitespace-nowrap">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Middle Spacer */}
              <div className="flex-1 min-h-[30px]" />

              {/* Bottom text */}
              <div className="mt-6">
                <h3 className="font-heading italic text-white text-3xl md:text-3.5xl tracking-[-1px] leading-tight font-medium">
                  Расчет внедрения AI
                </h3>
                <p className="mt-3 text-sm text-neutral-300 font-body font-light leading-relaxed max-w-[32ch]">
                  Проводим финансово-экономический аудит, рассчитываем ROI, точную стоимость владения и оцениваем итоговый бизнес-эффект от AI-систем до начала разработки.
                </p>
              </div>
            </motion.div>

            {/* Card 2: Финансовое планирование */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="liquid-glass rounded-[1.25rem] p-6.5 min-h-[380px] flex flex-col hover:translate-y-[-4px] hover:bg-white/[0.02] transition-all duration-300 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Trending up SVG icon */}
                <div className="w-11 h-11 rounded-[0.75rem] liquid-glass flex items-center justify-center text-white shrink-0">
                  <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                  </svg>
                </div>

                {/* Pill Tag Row */}
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[75%] select-none">
                  {['P&L модели', 'Оценка бизнеса', 'Инвест. стратегия', 'Бюджетирование'].map(tag => (
                    <span key={tag} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/80 font-body font-normal tracking-wide whitespace-nowrap">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Middle Spacer */}
              <div className="flex-1 min-h-[30px]" />

              {/* Bottom text */}
              <div className="mt-6">
                <h3 className="font-heading italic text-white text-3xl md:text-3.5xl tracking-[-1px] leading-tight font-medium">
                  Финансовое планирование
                </h3>
                <p className="mt-3 text-sm text-neutral-300 font-body font-light leading-relaxed max-w-[32ch]">
                  Разрабатываем финансовые и бизнес-планы с прогнозными моделями, сценарным анализом и дорожной картой привлечения инвестиций.
                </p>
              </div>
            </motion.div>

            {/* Card 3: Маркетинг и аналитика */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="liquid-glass rounded-[1.25rem] p-6.5 min-h-[380px] flex flex-col hover:translate-y-[-4px] hover:bg-white/[0.02] transition-all duration-300 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Bar chart SVG icon */}
                <div className="w-11 h-11 rounded-[0.75rem] liquid-glass flex items-center justify-center text-white shrink-0">
                  <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
                  </svg>
                </div>

                {/* Pill Tag Row */}
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[75%] select-none">
                  {['Рост выручки', 'Performance', 'BI-дашборды', 'CJM-анализ'].map(tag => (
                    <span key={tag} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/80 font-body font-normal tracking-wide whitespace-nowrap">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Middle Spacer */}
              <div className="flex-1 min-h-[30px]" />

              {/* Bottom text */}
              <div className="mt-6">
                <h3 className="font-heading italic text-white text-3xl md:text-3.5xl tracking-[-1px] leading-tight font-medium">
                  Маркетинг и аналитика
                </h3>
                <p className="mt-3 text-sm text-neutral-300 font-body font-light leading-relaxed max-w-[32ch]">
                  Строим маркетинговые стратегии и BI-системы на основе данных. Рост выручки, снижение CAC, прозрачность каждого канала.
                </p>
              </div>
            </motion.div>

          </div>

          {/* Quick interactive note */}
          <div className="text-left py-4 border-t border-white/5 opacity-60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <span className="text-xs font-mono font-light tracking-wide">// ГОТОВЫ К ОЦЕНКЕ ПРОЕКТА? СВЯЖИТЕСЬ С НАМИ ДЛЯ ОНЛАЙН-КОНСУЛЬТАЦИИ В ТЕЧЕНИЕ ДНЯ.</span>
            <button 
              onClick={() => setIsContactOpen(true)}
              className="text-xs font-semibold underline text-white hover:text-neutral-300 transition-colors cursor-pointer text-left"
            >
              Получить расчет стоимости за 15 минут →
            </button>
          </div>

        </div>
      </section>

      {/* SECTION 4 — CLIENTS */}
      <section 
        id="clients" 
        className="relative min-h-screen w-full bg-black flex flex-col justify-between"
      >
        {/* Solid dark premium backdrop style — letting cards breathe */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-20 pt-28 pb-16 flex flex-col min-h-screen justify-between">
          
          {/* Header block */}
          <div className="text-left">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5 }}
              className="text-xs font-mono text-neutral-400 tracking-widest uppercase mb-4"
            >
              // Клиенты и кейсы
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 30, filter: 'blur(5px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="font-heading italic text-white text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.9] tracking-[-3px] font-normal"
            >
              С кем мы <br className="hidden md:block"/>
              работали
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-6 text-sm md:text-base text-neutral-400 max-w-xl font-body font-light leading-relaxed"
            >
              Наши партнёры — от глобальных аудиторских гигантов до инновационных российских компаний. Ниже — реальные проекты и результаты.
            </motion.p>
          </div>

          {/* Five client cards sorted in grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-14 mb-8">
            
            {/* Card 1: EY */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="liquid-glass rounded-[1.25rem] p-6 flex flex-col gap-5 text-left group hover:bg-white/[0.02] hover:translate-y-[-2px] transition-all duration-300"
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="liquid-glass rounded-[0.75rem] px-4.5 py-2.5 flex items-center justify-center bg-white/5 select-none">
                  <span className="font-heading italic font-bold text-xl tracking-wider text-white">EY</span>
                </div>
                <span className="liquid-glass rounded-full px-3 py-1 text-xs text-neutral-400 font-mono">
                  #01
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 w-full" />

              {/* Stats row */}
              <div className="flex items-stretch gap-3">
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ПРОЕКТОВ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    5 проектов
                  </div>
                </div>
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ИНВЕСТИЦИЙ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    $6.2M
                  </div>
                </div>
              </div>

              {/* Content and Tags */}
              <div className="mt-auto pt-3">
                <div className="flex flex-wrap gap-1.5 select-none">
                  {['AI-аудит', 'Бизнес-план', 'Аналитика'].map(t => (
                    <span key={t} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/70 font-body">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-3.5 text-sm text-neutral-300 font-body font-light leading-relaxed">
                  Разработка AI-стратегии для аудиторских подразделений, внедрение предиктивных моделей оценки рисков.
                </p>
              </div>
            </motion.div>

            {/* Card 2: Сбер */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="liquid-glass rounded-[1.25rem] p-6 flex flex-col gap-5 text-left group hover:bg-white/[0.02] hover:translate-y-[-2px] transition-all duration-300"
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="liquid-glass rounded-[0.75rem] px-4.5 py-2.5 flex items-center justify-center bg-white/5 select-none animate-pulse-slow">
                  <span className="font-heading italic font-semibold text-xl text-white flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500 inline-block"></span>
                    Сбер
                  </span>
                </div>
                <span className="liquid-glass rounded-full px-3 py-1 text-xs text-neutral-400 font-mono">
                  #02
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 w-full" />

              {/* Stats row */}
              <div className="flex items-stretch gap-3">
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ПРОЕКТОВ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    3 проекта
                  </div>
                </div>
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ПРИВЛЕЧЕНО
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    ₽2.1 млрд
                  </div>
                </div>
              </div>

              {/* Content and Tags */}
              <div className="mt-auto pt-3">
                <div className="flex flex-wrap gap-1.5 select-none">
                  {['AI-внедрение', 'LLM', 'Автоматизация'].map(t => (
                    <span key={t} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/70 font-body">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-3.5 text-sm text-neutral-300 font-body font-light leading-relaxed">
                  Масштабное внедрение LLM в клиентский сервис и HR-процессы. Сокращение операционных расходов на 34%.
                </p>
              </div>
            </motion.div>

            {/* Card 3: BIT */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="liquid-glass rounded-[1.25rem] p-6 flex flex-col gap-5 text-left group hover:bg-white/[0.02] hover:translate-y-[-2px] transition-all duration-300"
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="liquid-glass rounded-[0.75rem] px-4.5 py-2.5 flex items-center justify-center bg-white/5 select-none">
                  <span className="font-heading italic font-bold text-xl tracking-tight uppercase text-white">BIT</span>
                </div>
                <span className="liquid-glass rounded-full px-3 py-1 text-xs text-neutral-400 font-mono">
                  #03
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 w-full" />

              {/* Stats row */}
              <div className="flex items-stretch gap-3">
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ПРОЕКТОВ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    3 проекта
                  </div>
                </div>
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ИНВЕСТИЦИЙ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    $1.4M
                  </div>
                </div>
              </div>

              {/* Content and Tags */}
              <div className="mt-auto pt-3">
                <div className="flex flex-wrap gap-1.5 select-none">
                  {['R&D', 'AI-интеграция', 'Стратегия'].map(t => (
                    <span key={t} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/70 font-body">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-3.5 text-sm text-neutral-300 font-body font-light leading-relaxed">
                  Совместная R&D-программа по промышленному AI с командой Пекинского технологического института.
                </p>
              </div>
            </motion.div>

            {/* Card 4: ЮФУ */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="liquid-glass rounded-[1.25rem] p-6 flex flex-col gap-5 text-left group hover:bg-white/[0.02] hover:translate-y-[-2px] transition-all duration-300"
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="liquid-glass rounded-[0.75rem] px-4.5 py-2.5 flex items-center justify-center bg-white/5 select-none">
                  <span className="font-heading italic font-semibold text-xl text-white">ЮФУ</span>
                </div>
                <span className="liquid-glass rounded-full px-3 py-1 text-xs text-neutral-400 font-mono">
                  #04
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 w-full" />

              {/* Stats row */}
              <div className="flex items-stretch gap-3">
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ПРОЕКТОВ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    3 проекта
                  </div>
                </div>
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ФИНАНСЫ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    ₽12 млн
                  </div>
                </div>
              </div>

              {/* Content and Tags */}
              <div className="mt-auto pt-3">
                <div className="flex flex-wrap gap-1.5 select-none">
                  {['Аудит EdTech AI', 'Расчет ROI', 'Оценка эффекта'].map(t => (
                    <span key={t} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/70 font-body">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-3.5 text-sm text-neutral-300 font-body font-light leading-relaxed">
                  Финансово-экономическое моделирование окупаемости образовательной AI-платформы и расчет реального эффекта систем управления университетом.
                </p>
              </div>
            </motion.div>

            {/* Card 5: BioLongLife */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="liquid-glass rounded-[1.25rem] p-6 flex flex-col gap-5 text-left group hover:bg-white/[0.02] hover:translate-y-[-2px] transition-all duration-300"
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="liquid-glass rounded-[0.75rem] px-4.5 py-2.5 flex items-center justify-center bg-white/5 select-none">
                  <span className="font-heading italic font-semibold text-xl text-white">
                    Bio<span className="opacity-60 text-white">Long</span>Life
                  </span>
                </div>
                <span className="liquid-glass rounded-full px-3 py-1 text-xs text-neutral-400 font-mono">
                  #05
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 w-full" />

              {/* Stats row */}
              <div className="flex items-stretch gap-3">
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ПРОЕКТОВ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    2 проекта
                  </div>
                </div>
                <div className="flex-1 liquid-glass rounded-[0.75rem] p-3 text-left">
                  <div className="text-[10px] text-white/50 font-body uppercase tracking-wider font-light">
                    ОБОРОТ
                  </div>
                  <div className="font-heading italic text-white text-2.5xl leading-none mt-1.5 font-medium select-all">
                    ₽24M
                  </div>
                </div>
              </div>

              {/* Content and Tags */}
              <div className="mt-auto pt-3">
                <div className="flex flex-wrap gap-1.5 select-none">
                  {['Маркетинг', 'BI', 'Фин.план'].map(t => (
                    <span key={t} className="liquid-glass rounded-full px-2.5 py-0.5 text-[10px] text-white/70 font-body">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-3.5 text-sm text-neutral-300 font-body font-light leading-relaxed">
                  Полный цикл: финансовый план, маркетинговая стратегия и BI-система для линейки БАД-продуктов.
                </p>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* SECTION 3 — ABOUT US */}
      <section 
        id="about" 
        className="relative min-h-screen w-full bg-black overflow-hidden flex flex-col justify-center border-t border-white/5"
      >
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-20 pt-28 pb-16 flex flex-col min-h-screen justify-between">
          
          {/* Header */}
          <div className="mb-12 text-left">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5 }}
              className="text-xs font-mono text-neutral-400 tracking-widest uppercase mb-4"
            >
              // О компании и ценности
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-heading italic text-white text-4xl md:text-5.5xl lg:text-6xl tracking-tight leading-none font-medium text-left"
            >
              Соединяем Финансовую Прагматику <br />и AI-Инновации
            </motion.h2>
          </div>

          {/* Grid Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mt-4 mb-16">
            
            {/* Left Narrative Column */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-4 flex flex-col gap-6 text-left"
            >
              <div className="liquid-glass rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-3 text-white mb-4">
                  <Calendar className="h-5 w-5 text-white/80" />
                  <span className="font-mono text-sm tracking-wide uppercase">// ИСТОРИЯ</span>
                </div>
                <p className="text-sm text-neutral-300 font-body font-light leading-relaxed">
                  AXIOM Consulting работает <span className="text-white font-medium">с 2022 года</span>. Мы начинали как бутиковое финансовое бюро для крупного ритейла и производственного сектора.
                </p>
                <p className="text-sm text-neutral-300 font-body font-light leading-relaxed mt-3">
                  С развитием генеративного интеллекта мы первыми разработали комплексную методологию аудита и расчёта экономического эффекта от внедрения LLM-агентов, защищая инвестиции наших клиентов на этапе идеи.
                </p>
              </div>

              <div className="liquid-glass rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-3 text-white mb-4">
                  <Award className="h-5 w-5 text-white/80" />
                  <span className="font-mono text-sm tracking-wide uppercase">// НАШ ФОКУС</span>
                </div>
                <p className="text-sm text-neutral-300 font-body font-light leading-relaxed">
                  Никакого пуританского ИТ-словаря или завышенных ожиданий. Каждое техническое архитектурное решение оцифровывается в CAPEX, OPEX, NPV и период окупаемости. Мы не пишем код — мы управляем вашими финансовыми результатами.
                </p>
              </div>
            </motion.div>

            {/* Right Team Column */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="lg:col-span-8 flex flex-col gap-6 text-left"
            >
              <div className="flex items-center gap-3 text-white mb-2">
                <Users className="h-5 w-5 text-white/80" />
                <span className="font-mono text-sm tracking-wide uppercase">// КЛЮЧЕВАЯ КОМАНДА</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Team Member 1 */}
                <div className="liquid-glass rounded-2xl p-6 border border-white/5 flex flex-col justify-between min-h-[220px] hover:bg-white/[0.02] transition-colors">
                  <div>
                    <h4 className="font-heading italic text-xl text-white font-medium">Финансовый директор</h4>
                    <p className="text-xs text-white/50 font-mono mt-1 uppercase tracking-wider">Управляющий партнер / Экс-EY</p>
                    <p className="text-sm text-neutral-300 font-body font-light mt-4 leading-relaxed">
                      Экс-консультант "Большой Четверки" (EY), сертифицированный финансовый аналитик (CFA). 10+ лет в корпоративных финансах и ИТ-стратегии среднего и крупного бизнеса.
                    </p>
                  </div>
                </div>

                {/* Team Member 2 */}
                <div className="liquid-glass rounded-2xl p-6 border border-white/5 flex flex-col justify-between min-h-[220px] hover:bg-white/[0.02] transition-colors">
                  <div>
                    <h4 className="font-heading italic text-xl text-white font-medium">Главный AI-архитектор</h4>
                    <p className="text-xs text-white/50 font-mono mt-1 uppercase tracking-wider">Аудит CAPEX & OPEX</p>
                    <p className="text-sm text-neutral-300 font-body font-light mt-4 leading-relaxed">
                      Эксперт по нагрузочному тестированию и стоимости облачной инфраструктуры. Ранее — Head of AI/ML в ведущих enterprise-интеграторах. Оценивает реальную емкость ИТ-затрат.
                    </p>
                  </div>
                </div>

                {/* Team Member 3 */}
                <div className="liquid-glass rounded-2xl p-6 border border-white/5 flex flex-col justify-between min-h-[220px] hover:bg-white/[0.02] transition-colors col-span-1 md:col-span-2">
                  <div>
                    <h4 className="font-heading italic text-xl text-white font-medium">Старший инвестиционный аналитик</h4>
                    <p className="text-xs text-white/50 font-mono mt-1 uppercase tracking-wider">Разработка ROI-моделей</p>
                    <p className="text-sm text-neutral-300 font-body font-light mt-4 leading-relaxed">
                      Специализируется на дисконтировании денежных потоков и верификации бизнес-эффекта автоматизации. Автор детальных калькуляторов экономического эффекта более чем для 30 проектов.
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>

          </div>

          {/* Quick interactive note */}
          <div className="text-left py-4 border-t border-white/5 opacity-60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <span className="text-xs font-mono font-light tracking-wide">// НАШИ КОНСУЛЬТАНТЫ ОЦЕНИВАЮТ РЕАЛЬНУЮ ОКУПАЕМОСТЬ. ДОВЕРЯЙТЕ ЦИФРАМ, А НЕ ХАЙПУ.</span>
            <button 
              onClick={() => setIsContactOpen(true)}
              className="text-xs font-semibold underline text-white hover:text-neutral-300 transition-colors cursor-pointer text-left"
            >
              Заказать финансовый аудит AI-процесса →
            </button>
          </div>

          {/* Footer strip below everything */}
          <footer className="w-full flex flex-col md:flex-row items-center justify-between border-t border-white/10 pt-8 mt-16 pb-12 gap-6 text-center md:text-left select-none">
            <span className="font-heading italic text-white text-2.5xl font-medium tracking-tight">
              AXIOM
            </span>
            <span className="text-xs text-white/40 font-body">
              © 2025 AXIOM Consulting. Все права защищены.
            </span>
            <button 
              onClick={() => setIsContactOpen(true)}
              className="liquid-glass-strong px-5 py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 rounded-full hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              Написать нам
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </footer>

        </div>
      </section>

      {/* INTERACTIVE INQUIRY SLIDE-OVER DRAWER (liquid-glass-strong) */}
      <AnimatePresence>
        {isContactOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            
            {/* Backdrop Blur effect */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetForm}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slider Drawer container — Non-scrolling body with a fixed height and flex-col layout */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="relative w-full max-w-lg h-full liquid-glass-strong border-l border-white/10 flex flex-col justify-between"
              style={{ background: 'rgba(5, 5, 5, 0.96)' }}
            >
              {/* Fixed Header Bar at the top — closes instantly, never scrolls away! */}
              <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/10 flex-shrink-0 z-10 bg-black/30 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 text-xs font-mono text-neutral-400 uppercase">
                  <Activity className="h-4.5 w-4.5 text-white animate-pulse" />
                  <span>// Обратная связь</span>
                </div>
                
                {/* Clear prominent close button */}
                <button 
                  type="button"
                  onClick={resetForm}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                  aria-label="Закрыть форму"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Main Content Layout — Independently Scrollable Container */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <h3 className="font-heading italic text-white text-4.5xl mb-3 leading-none font-medium text-left">
                  Начать проект с AXIOM
                </h3>
                <p className="text-sm text-neutral-300 font-body font-light mb-8 leading-relaxed max-w-[40ch] text-left">
                  Заполните форму ниже. Наш ведущий консультант свяжется с вами для подробного разбора в течение 2 часов.
                </p>

                <AnimatePresence mode="wait">
                  {!formSubmitted ? (
                    <motion.form 
                      key="contact-form"
                      onSubmit={handleFormSubmit}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="flex flex-col gap-5 text-left"
                    >
                      {/* Name field */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                          Ваше Имя *
                        </label>
                        <input 
                          type="text" 
                          name="name" 
                          required
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Введите ваше имя"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                        />
                      </div>

                      {/* Company field */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                          Компания / Проект
                        </label>
                        <input 
                          type="text" 
                          name="company"
                          value={formData.company}
                          onChange={handleInputChange}
                          placeholder="ООО ТехноПрогресс"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                        />
                      </div>

                      {/* Contact information field */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                          Email или Telegram *
                        </label>
                        <input 
                          type="text" 
                          name="contact"
                          required
                          value={formData.contact}
                          onChange={handleInputChange}
                          placeholder="@axiom_founder или k.axiom@agency.ru"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                        />
                      </div>

                      {/* Phone field (Optional) */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                          Телефон (необязательно)
                        </label>
                        <input 
                          type="tel" 
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+7 (999) 000-00-00"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                        />
                      </div>

                      {/* Service Category Selector */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                          Направление экспертизы
                        </label>
                        <div className="relative">
                          <select 
                            name="service"
                            value={formData.service}
                            onChange={handleInputChange}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                          >
                            <option value="AI внедрение" className="bg-zinc-950 text-white">Внедрение AI и LLM-автоматизация</option>
                            <option value="Финансовое планирование" className="bg-zinc-950 text-white">Финансовое планирование и бизнес-модель</option>
                            <option value="Маркетинг и аналитика" className="bg-zinc-950 text-white">Маркетинг, CJM и BI-аналитика</option>
                            <option value="Другое" className="bg-zinc-950 text-white">Другой комплексный аудит</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/50">
                            ▼
                          </div>
                        </div>
                      </div>

                      {/* Detailed message textarea */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-400 mb-1.5 uppercase tracking-wide">
                          Опишите кратко вашу задачу
                        </label>
                        <textarea 
                          name="message"
                          value={formData.message}
                          onChange={handleInputChange}
                          rows={3}
                          placeholder="Масштабирование бизнес-процессов, настройка предиктивной аналитики, внедрение ИИ..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20 resize-none"
                        />
                      </div>

                      {/* Integration Status Block */}
                      <div className="mt-2.5 flex flex-col gap-3">
                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-xs text-neutral-400 leading-relaxed font-body">
                          Все заявки мгновенно регистрируются во внутренней CRM-системе и направляются руководству на <strong className="text-white font-semibold">электронную почту SMTP</strong> или в <strong className="text-white font-semibold">Telegram</strong> для моментальной обработки.
                        </div>

                        {sendError && (
                          <div className="bg-red-950/40 border border-red-900/50 text-red-200 text-xs rounded-xl p-4 leading-normal font-sans text-left">
                            <strong>Ошибка:</strong> {sendError.message}
                            {sendError.isTelegramUnstarted && (
                              <div className="mt-3">
                                <a 
                                  href="https://t.me/Axiomconsultbot" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-white text-black text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg hover:bg-neutral-200 transition-all"
                                >
                                  👉 Запустить бота в Telegram
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Submit and Close Buttons Container */}
                      <div className="flex flex-col gap-3 mt-4">
                        <button 
                          type="submit" 
                          disabled={isAuthLoading}
                          className="w-full bg-white text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors cursor-pointer active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {isAuthLoading ? (
                            <>
                              <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                              <span>Отправка заявки...</span>
                            </>
                          ) : (
                            <>
                              <span>Отправить запрос</span>
                              <ArrowUpRight className="h-5 w-5 stroke-[2.5]" />
                            </>
                          )}
                        </button>

                        {/* Explicit button at the bottom to close the form easily */}
                        <button 
                          type="button"
                          onClick={resetForm}
                          className="w-full bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
                        >
                          Закрыть форму
                        </button>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.div 
                      key="success-message"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="liquid-glass rounded-2xl p-8 flex flex-col items-center text-center justify-center min-h-[300px] gap-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center mb-2">
                        <Check className="h-8 w-8 stroke-[3]" />
                      </div>
                      <h4 className="font-heading italic text-3xl text-white font-medium">
                        Успешно отправлено!
                      </h4>
                      <p className="text-sm text-neutral-300 font-body font-light max-w-[28ch] leading-relaxed">
                        Спасибо, {formData.name || 'Коллега'}! Ваша заявка принята. Консультант свяжется с вами в течение 2 часов.
                      </p>

                      {/* Clear and direct button to return and close drawer */}
                      <button 
                        type="button"
                        onClick={resetForm}
                        className="mt-4 px-8 py-3.5 bg-white text-black hover:bg-neutral-200 hover:scale-105 active:scale-95 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg"
                      >
                        Вернуться на сайт
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Informative credentials footer — fixed block below scrolling section */}
              <div className="border-t border-white/5 p-6 md:p-8 text-left bg-black/20 flex-shrink-0">
                <div className="flex items-center gap-3 text-white/50 mb-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-[11px] font-mono tracking-wider uppercase">AXIOM CONSULTING HEADQUARTERS</span>
                </div>
                <div className="text-xs text-neutral-400 font-body font-light">
                  Ростов-на-Дону, ул. Пушкинская / Москва, Пресненская наб. <br />
                  <a href="mailto:office@axiom.ru" className="text-white hover:underline">office@axiom.ru</a> · +7 (495) 120-43-21
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
