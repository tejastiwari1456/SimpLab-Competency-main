import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Users,
  ShieldCheck,
  FlaskConical,
  Flame,
  Zap,
} from 'lucide-react';
import { PairLabChatMessage, PairLabUser, PairLabRole } from '../../types/pairLab';

interface PairLabChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: PairLabChatMessage[];
  myUser: PairLabUser | null;
  partnerUser: PairLabUser | null;
  onSendMessage: (text: string) => void;
  isDark?: boolean;
}

export const PairLabChatModal: React.FC<PairLabChatModalProps> = ({
  isOpen,
  onClose,
  messages,
  myUser,
  partnerUser,
  onSendMessage,
  isDark = false,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const quickPrompts = [
    { label: 'Reagents ready for check', text: 'Master Mix assembled: 25 µL total. Please verify and co-sign!' },
    { label: 'Vortex & Spin done', text: 'Tubes vortexed and spun down to pellet droplets. Ready for cycler!' },
    { label: 'Thermocycler armed', text: 'Thermocycler programmed: 55.0°C annealing, 30 cycles. Please authorize launch!' },
    { label: 'Run to Red confirmed', text: 'Checked submarine electrodes: Cathode (-) at wells, Anode (+) at buffer end. Run to Red!' },
    { label: '500 bp Band verified', text: 'Sharp ~500 bp band observed under UV transillumination. Positive diagnostic call.' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl transition-all animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 px-4 py-3 bg-stone-50 dark:bg-stone-950">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Partner Laboratory Comms
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {partnerUser ? `Connected with ${partnerUser.name}` : 'Waiting for partner to join...'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-700 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Tactical Co-op Prompts */}
      <div className="border-b border-stone-100 dark:border-stone-800 p-2.5 bg-blue-50/40 dark:bg-blue-950/20">
        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-1.5 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Quick Coordination Signals
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(qp.text)}
              className="rounded-md border border-blue-200 dark:border-blue-800/80 bg-white dark:bg-stone-800 px-2 py-1 text-[11px] font-medium text-stone-700 dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.senderId === myUser?.id;
          const isSys = msg.isSystem;

          if (isSys) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1 text-[11px] text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700/60 max-w-xs text-center">
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400 dark:text-stone-500 mb-0.5">
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  {isMe ? 'You' : msg.senderName}
                </span>
                <span className="rounded bg-stone-100 dark:bg-stone-800 px-1 py-0.2 text-[9px] uppercase font-bold">
                  {msg.senderRole === 'partner_a' ? 'Partner A' : 'Partner B'}
                </span>
                <span>{msg.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-xs ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-tl-none border border-stone-200 dark:border-stone-700'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={scrollEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="border-t border-stone-200 dark:border-stone-800 p-3 bg-stone-50 dark:bg-stone-950 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message lab partner or suggest next step..."
          className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-xs text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-40 transition shadow-xs"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
