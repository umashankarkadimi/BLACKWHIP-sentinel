import { authFetch } from '../utils';
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Cpu } from 'lucide-react';
import Markdown from 'react-markdown';

export default function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await authFetch('/api/chat/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: messages })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "PAUL ERROR: CONNECTION LOST." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-black dark:bg-black border border-red-500 dark:border-red-500/30 p-4 rounded-full shadow-lg hover:bg-red-500/10 dark:hover:bg-neutral-800 transition-all ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <MessageSquare className="w-6 h-6 text-red-700 dark:text-red-500" />
      </button>

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[550px] bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-xl shadow-2xl flex flex-col backdrop-blur-md overflow-hidden">
          <div className="p-4 border-b border-red-500/20 dark:border-red-500/20 flex justify-between items-center bg-black dark:bg-black/80">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-red-700 dark:text-red-500" />
              <h3 className="font-bold text-neutral-50 dark:text-neutral-50 uppercase tracking-[0.2em] text-[12px]">PAUL OS COPILOT</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:text-red-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-neutral-600 dark:text-neutral-400 font-mono text-[10px] uppercase tracking-widest mt-10">
                PAUL CONNECTION ESTABLISHED.<br/><br/>
                GLOBAL DASHBOARD TELEMETRY SYNCED.<br/>
                READY TO ASSIST.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl p-3 text-sm overflow-hidden ${msg.role === 'user' ? 'bg-red-500/10 dark:bg-red-700/30 border border-red-500/30 dark:border-red-500/30 text-neutral-50 dark:text-neutral-50' : 'bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 text-neutral-300 dark:text-neutral-300 shadow-sm'}`}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <div className="prose  dark:prose-invert  prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&_code]:text-neutral-200 dark:[&_code]:text-neutral-200 [&_code]:bg-red-500/10 dark:[&_code]:bg-red-700/30 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-black dark:[&_pre]:bg-black [&_pre]:border [&_pre]:border-red-500/20 dark:[&_pre]:border-red-500/20 [&_ul]:my-2 [&_li]:my-0.5">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 text-neutral-500 px-4 py-2 rounded-xl text-xs font-mono animate-pulse">
                  PAUL IS PROCESSING...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black/80">
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask Paul about system status..."
                className="w-full bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-lg pl-4 pr-12 py-3 text-sm text-neutral-50 dark:text-neutral-50 font-mono focus:outline-none focus:border-red-500 focus:shadow-sm transition-all placeholder-neutral-400 dark:placeholder-neutral-500"
              />
              <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:text-red-500 disabled:opacity-50 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
