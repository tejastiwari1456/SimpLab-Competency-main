import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  HelpCircle,
  Minimize2,
  Maximize2,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import { Experiment } from '../../types';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  source?: string;
  timestamp: Date;
}

interface LabMentorChatProps {
  experiment: Experiment;
  isDark?: boolean;
}

export const LabMentorChat: React.FC<LabMentorChatProps> = ({
  experiment,
  isDark = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize or update conversation greeting when experiment changes
  useEffect(() => {
    const initialGreeting: Message = {
      id: `init-${experiment.id}`,
      role: 'assistant',
      content: `Hello! I am your **Lab Mentor** for **${experiment.title}** (${experiment.code}).\n\nI am monitoring your experimental setup, governing formulas (${experiment.keyFormulas.map((f) => f.label).join(', ')}), and task steps. If you get stuck on circuit wiring, meter zero-errors, titration color changes, stopping potential calibration, or graph analysis, ask me below!`,
      source: 'Gemini 3.8 Flash',
      timestamp: new Date(),
    };
    setMessages([initialGreeting]);
  }, [experiment.id, experiment.title, experiment.code]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Contextual quick questions based on active experiment
  const quickQuestions = React.useMemo(() => {
    if (experiment.id === 'exp-ohms-law') {
      return [
        'Why is the ammeter reading 0 V / 0 mA?',
        'How do I calculate resistance from the V-I slope?',
        'Why does higher voltage cause non-linear heating?',
        'How do I connect the voltmeter in parallel?',
      ];
    }
    if (experiment.id === 'exp-titration') {
      return [
        'How do I detect the exact equivalence point?',
        'Why did my solution turn dark magenta instantly?',
        'How do I calculate the unknown HCl molarity?',
        'Why does pH change rapidly near neutralization?',
      ];
    }
    if (experiment.id === 'exp-photoelectric') {
      return [
        'How do I calibrate the stopping potential (V₀)?',
        'Why does red light produce zero photocurrent?',
        'Does increasing light intensity increase stopping potential?',
        'How do I deduce Planck’s constant from the slope?',
      ];
    }
    return [
      'What are the governing equations for this experiment?',
      'How do I record accurate readings without parallax error?',
      'What is the next procedural step I should perform?',
    ];
  }, [experiment.id]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/mentor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId: experiment.id,
          experimentTitle: experiment.title,
          subject: experiment.subject,
          syllabusTag: experiment.syllabusTag,
          apparatusList: experiment.apparatusList,
          keyFormulas: experiment.keyFormulas,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          question: text,
        }),
      });

      const data = await res.json();
      const replyContent =
        data.reply ||
        'I am analyzing your apparatus readings. Double-check your current meter range and step guidelines.';

      const assistantMessage: Message = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        source:
          data.source === 'gemini-3.8-flash'
            ? 'Gemini 3.8 Flash'
            : data.source === 'gemini-3.1-flash-lite'
            ? 'Gemini 3.1 Flash Lite'
            : 'Socratic Lab Engine',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg: Message = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content:
          'I encountered a brief connection issue. In the meantime, verify that all series/parallel connections are secure and that instrument scales are calibrated properly.',
        source: 'Socratic Lab Engine',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    const resetGreeting: Message = {
      id: `init-${Date.now()}`,
      role: 'assistant',
      content: `Conversation reset. How can I assist you with your **${experiment.title}** apparatus or calculations right now?`,
      source: 'Gemini 3.8 Flash',
      timestamp: new Date(),
    };
    setMessages([resetGreeting]);
  };

  return (
    <>
      {/* Small Floating 'Lab Mentor' Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            id="lab-mentor-floating-btn"
            className="group flex items-center gap-2.5 rounded-full bg-stone-900 dark:bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white dark:text-stone-950 shadow-xl ring-2 ring-amber-400/50 hover:bg-stone-800 dark:hover:bg-amber-400 hover:scale-105 active:scale-95 transition-all duration-200"
            title="Open Context-Aware AI Lab Mentor"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Sparkles className="h-4 w-4 text-amber-400 dark:text-stone-950 group-hover:rotate-12 transition-transform" />
            <span className="font-bold tracking-wide">Lab Mentor</span>
            <span className="hidden sm:inline-block rounded-md bg-stone-800 dark:bg-amber-600/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 dark:text-stone-900 border border-amber-400/20">
              AI Support
            </span>
          </button>
        </div>
      )}

      {/* Context-Aware Floating Chat Drawer / Window */}
      {isOpen && (
        <div
          id="lab-mentor-chat-window"
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl transition-all duration-200 ${
            isExpanded
              ? 'w-[92vw] sm:w-[620px] h-[85vh] max-h-[750px]'
              : 'w-[92vw] sm:w-[420px] h-[560px] max-h-[82vh]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 px-4 py-3 bg-stone-50 dark:bg-stone-850/80 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-900 dark:bg-amber-500 text-amber-400 dark:text-stone-950 shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">Lab Mentor</h3>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Gemini 3.8 Flash
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate max-w-[200px] sm:max-w-[260px]">
                  Context: {experiment.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                title="Clear chat and restart"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:inline-flex rounded-lg p-1 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                title={isExpanded ? 'Collapse size' : 'Expand window'}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                title="Close Lab Mentor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Active Experiment Context Strip */}
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-900/90 px-3.5 py-1.5 text-[10px]">
            <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
              <BookOpen className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-stone-900 dark:text-stone-200">{experiment.subject}</span>
              <span>•</span>
              <span className="truncate">{experiment.syllabusTag}</span>
            </div>
            <span className="font-mono text-stone-500 dark:text-stone-400">
              {experiment.keyFormulas[0] ? experiment.keyFormulas[0].formula : ''}
            </span>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-2xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 rounded-br-xs font-medium'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-bl-xs border border-stone-200/80 dark:border-stone-700/80'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>

                <div className="mt-1 flex items-center gap-1.5 px-1 text-[9px] text-stone-500 dark:text-stone-400">
                  <span>{m.role === 'user' ? 'You' : 'Lab Mentor'}</span>
                  {m.source && (
                    <>
                      <span>•</span>
                      <span className="text-amber-700 dark:text-amber-400 font-mono">{m.source}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-850 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 w-fit">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="text-[11px] font-medium animate-pulse">
                  Lab Mentor is analyzing your experimental step...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Guided Prompts */}
          <div className="border-t border-stone-100 dark:border-stone-800 px-3 py-2 bg-stone-50/50 dark:bg-stone-850/40">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
              <HelpCircle className="h-3 w-3 text-amber-500" />
              <span>Suggested Inquiries for {experiment.code}:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendMessage(q)}
                  className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2 py-1 text-[10px] font-medium text-stone-700 dark:text-stone-300 hover:border-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50/50 dark:hover:bg-stone-750 transition-colors text-left disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input Bar */}
          <div className="border-t border-stone-200 dark:border-stone-800 p-3 bg-white dark:bg-stone-900 rounded-b-2xl">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Lab Mentor about circuit wires, pH curve, stopping voltage, or calculations..."
                rows={2}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden disabled:opacity-60 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-stone-900 dark:disabled:hover:bg-amber-500 transition-colors shrink-0"
                title="Send inquiry"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] text-stone-600 dark:text-stone-400 px-1">
              <span>Press <kbd className="rounded bg-stone-100 dark:bg-stone-800 px-1 border border-stone-200 dark:border-stone-700">Enter</kbd> to submit, <kbd className="rounded bg-stone-100 dark:bg-stone-800 px-1 border border-stone-200 dark:border-stone-700">Shift+Enter</kbd> for newline</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">Context-Aware AI</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
