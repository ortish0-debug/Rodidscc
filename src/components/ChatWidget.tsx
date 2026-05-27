import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles, User, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessionId, setSessionId] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session ID and cache
  useEffect(() => {
    // Session ID
    let storedSessionId = sessionStorage.getItem('axiom_chat_session_id');
    if (!storedSessionId) {
      storedSessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('axiom_chat_session_id', storedSessionId);
    }
    setSessionId(storedSessionId);

    // Initial message history
    const storedHistory = sessionStorage.getItem('axiom_chat_history');
    if (storedHistory) {
      try {
        setMessages(JSON.parse(storedHistory));
      } catch (e) {
        console.error('Failed parsing chat history from sessionStorage', e);
      }
    } else {
      // If no history exists, set unread to 1 of a pending welcome
      const hasOpened = sessionStorage.getItem('axiom_chat_opened');
      if (!hasOpened) {
        setUnreadCount(1);
      }
    }
  }, []);

  // Sync messages list to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('axiom_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  // Handle auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // First greeting sequence, triggers 1 second after opening-start
  const triggerGreeting = () => {
    sessionStorage.setItem('axiom_chat_opened', 'true');
    setUnreadCount(0);
    
    // Check if greeting already exists to avoid duplication
    if (messages.length === 0) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages([
          {
            role: 'assistant',
            content: `Добро пожаловать в AXIOM Consult! 👋\n\nЯ — AI-ассистент компании. Помогу вам:\n• Оценить потенциал AI для вашего бизнеса\n• Рассчитать предварительный ROI\n• Ответить на вопросы об услугах\n• Записать вас на бесплатную консультацию\n\nС чего начнём?`
          }
        ]);
      }, 1000);
    }
  };

  const handleOpenToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      triggerGreeting();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessageContent = input.trim();
    setInput('');
    
    // Append user message immediately
    const updatedMessages: Message[] = [...messages, { role: 'user', content: userMessageContent }];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          sessionId: sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API responded with ${response.status}`);
      }

      const data = await response.json();
      setIsTyping(false);
      
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        throw new Error('Received empty message content');
      }
    } catch (err) {
      console.error('Failed delivering message to server:', err);
      setIsTyping(false);
      
      // Fallback local response offline message
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Извините, возникла задержка связи с консультантом. Оставьте ваши контакты (Имя, Телефон), и мы перезвоним в течение 15 минут.'
          }
        ]);
      }, 500);
    }
  };

  return (
    <>
      {/* Floating launcher button in right-bottom corner */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              id="axiom-chat-launcher"
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              transition={{ duration: 0.3 }}
              onClick={handleOpenToggle}
              className="group relative flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-950 text-white rounded-full px-5 py-3.5 shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer"
            >
              {/* Pulse ripple circle background */}
              <span className="absolute -inset-0.5 rounded-full bg-blue-500/10 animate-ping opacity-75 group-hover:opacity-100 transition-opacity"></span>
              
              {/* Unread dot badge */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white font-mono text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-neutral-900 shadow-md">
                  {unreadCount}
                </span>
              )}

              <MessageSquare className="h-5 w-5 text-blue-400 group-hover:text-blue-300 group-hover:rotate-6 transition-all duration-300" />
              <span className="text-sm font-semibold tracking-wide font-sans select-none">
                Консультант
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Floating Chat dialog window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="axiom-chat-dialog"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-[380px] h-[520px] max-sm:fixed max-sm:inset-0 max-sm:w-full max-sm:h-full bg-neutral-900 border border-neutral-800 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 max-sm:rounded-none"
            >
              {/* Dialog Header */}
              <div className="bg-neutral-950 border-b border-neutral-800 px-4.5 py-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-8.5 w-8.5 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                    <Bot className="h-4.5 w-4.5 text-blue-400" />
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-neutral-950"></span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide font-sans leading-none">
                      AXIOM Ассистент
                    </h3>
                    <span className="text-[10px] font-mono font-medium text-emerald-400/90 uppercase tracking-widest mt-1 inline-block">
                      Онлайн
                    </span>
                  </div>
                </div>

                <button
                  id="axiom-chat-close"
                  onClick={handleOpenToggle}
                  className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Conversation Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                {messages.length === 0 && !isTyping && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                    <Bot className="h-8 w-8 text-neutral-500 mb-2.5" />
                    <p className="text-xs font-sans text-neutral-400 leading-relaxed max-w-[24ch]">
                      Инициализация защищенного соединения...
                    </p>
                  </div>
                )}

                {messages.map((msg, index) => {
                  const isAssistant = msg.role === 'assistant';
                  return (
                    <div
                      key={index}
                      className={`flex gap-2.5 max-w-[85%] ${
                        isAssistant ? 'self-start' : 'self-end ml-auto'
                      }`}
                    >
                      {isAssistant && (
                        <div className="h-7 w-7 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                          <Bot className="h-3.5 w-3.5 text-blue-400" />
                        </div>
                      )}
                      
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm font-sans leading-relaxed whitespace-pre-wrap ${
                          isAssistant
                            ? 'bg-neutral-800 text-neutral-100 rounded-tl-none'
                            : 'bg-blue-600 text-white rounded-tr-none'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {!isAssistant && (
                        <div className="h-7 w-7 rounded-full bg-blue-900/40 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5 text-blue-300" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pulsating Typing feedback */}
                {isTyping && (
                  <div className="flex items-center gap-2.5 max-w-[85%] self-start">
                    <div className="h-7 w-7 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <div className="rounded-2xl rounded-tl-none bg-neutral-800 px-4 py-3 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Interactive Footer & input bar */}
              <form
                id="axiom-chat-compose-form"
                onSubmit={handleSendMessage}
                className="bg-neutral-950 border-t border-neutral-800 px-3.5 py-3 shrink-0 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 hover:border-blue-500/30 transition-colors focus-within:border-blue-500/50">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Задайте ваш вопрос..."
                    disabled={isTyping}
                    className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 outline-none select-text border-none p-0 focus:ring-0"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className={`rounded-lg p-1.5 transition-colors cursor-pointer shrink-0 ${
                      input.trim() && !isTyping
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'text-neutral-600'
                    }`}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-500 font-sans tracking-tight leading-none text-center">
                  <Sparkles className="h-2.5 w-2.5 text-blue-400/80 shrink-0" />
                  Консультант работает круглосуточно на базе AI
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
