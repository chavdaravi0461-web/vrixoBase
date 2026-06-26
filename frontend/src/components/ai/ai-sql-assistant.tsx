'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNlToSql } from '@/hooks/use-ai';
import { useProjectStore } from '@/stores/project-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, X, ChevronDown, ChevronUp, Bot, User,
  Code, Copy, Check, Loader2, Lightbulb, History,
} from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  explanation?: string;
}

const SUGGESTIONS = [
  'Show me all tables',
  'Count total records in each table',
  'Find recently created records',
  'Create a users table with email and name',
  'Create a products table with price and category',
  'Create an orders table linked to users',
];

interface AiSqlAssistantProps {
  onInsertSql: (sql: string) => void;
  onExecute: (sql: string) => void;
  compact?: boolean;
}

export function AiSqlAssistant({ onInsertSql, onExecute, compact = false }: AiSqlAssistantProps) {
  const [open, setOpen] = useState(!compact);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const nlToSql = useNlToSql(projectId ?? '');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || !projectId) return;

    setInput('');
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: prompt }]);

    try {
      const result = await nlToSql.mutateAsync(prompt);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.explanation || 'Generated SQL query',
          sql: result.sql,
          explanation: result.explanation,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err.message}` },
      ]);
    }
  }, [input, projectId, nlToSql]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className={cn('flex flex-col', compact ? 'h-full' : 'h-full')}>
      {!compact && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 hover:bg-muted/20 transition-colors"
        >
          <div className="p-1 rounded-md bg-gradient-to-br from-brand-500/20 to-violet-500/20">
            <Bot className="h-3.5 w-3.5 text-brand-400" />
          </div>
          <span className="text-xs font-semibold flex-1 text-left">AI SQL Assistant</span>
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={compact ? undefined : { height: 0, opacity: 0 }}
            animate={compact ? undefined : { height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
              {messages.length === 0 && (
                <div className="space-y-1.5 p-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Lightbulb className="h-3 w-3 text-amber-400" />
                    <span>Try these prompts:</span>
                  </div>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      className="block w-full text-left p-2 rounded-lg text-[11px] text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors border border-border/30"
                    >
                      {s}
                    </button>
                  ))}
                  {!projectId && (
                    <p className="text-xs text-muted-foreground/60 mt-4 text-center">
                      Select a project to use the AI assistant
                    </p>
                  )}
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="p-1.5 rounded-full bg-gradient-to-br from-brand-500/20 to-violet-500/20 h-fit mt-1">
                      <Bot className="h-3 w-3 text-brand-400" />
                    </div>
                  )}

                  <div className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-brand-500/20 text-brand-100 rounded-tr-sm'
                      : 'bg-muted/30 rounded-tl-sm border border-border/30',
                  )}>
                    {msg.role === 'user' ? (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="space-y-2">
                        {msg.explanation && (
                          <p className="text-xs leading-relaxed text-foreground/80">{msg.explanation}</p>
                        )}
                        {msg.sql && (
                          <div className="relative group">
                            <div className="p-2 rounded-lg bg-black/40 border border-border/20">
                              <pre className="text-[10px] font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                                {msg.sql}
                              </pre>
                            </div>
                            <div className="flex gap-1 mt-1.5">
                              <button
                                onClick={() => handleCopy(msg.sql!, msg.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-muted/50 hover:bg-muted transition-colors text-muted-foreground"
                              >
                                {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                {copiedId === msg.id ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                onClick={() => onInsertSql(msg.sql!)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-brand-500/20 hover:bg-brand-500/30 transition-colors text-brand-400"
                              >
                                <Code className="h-3 w-3" /> Insert
                              </button>
                              <button
                                onClick={() => onExecute(msg.sql!)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors text-emerald-400"
                              >
                                <Sparkles className="h-3 w-3" /> Execute
                              </button>
                            </div>
                          </div>
                        )}
                        {msg.content && !msg.sql && (
                          <p className="text-xs leading-relaxed text-foreground/80">{msg.content}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="p-1.5 rounded-full bg-muted h-fit mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {nlToSql.isPending && (
                <div className="flex gap-2">
                  <div className="p-1.5 rounded-full bg-gradient-to-br from-brand-500/20 to-violet-500/20">
                    <Bot className="h-3 w-3 text-brand-400" />
                  </div>
                  <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-muted/30 border border-border/30">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Generating SQL...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-2 border-t border-border/30">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what data you need..."
                  rows={1}
                  disabled={nlToSql.isPending || !projectId}
                  className="flex-1 resize-none rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-brand-500/50 min-h-[34px] max-h-20 disabled:opacity-40"
                />
                <Button
                  size="sm"
                  className="h-[34px] shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim() || nlToSql.isPending || !projectId}
                >
                  {nlToSql.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground/40 mt-1">
                Natural language to SQL · Powered by AI
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
