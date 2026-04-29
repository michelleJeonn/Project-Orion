import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, X } from 'lucide-react'
import { GenesisReport } from '../types'
import { isDemoMode } from '../demoConfig'

function parseInline(str: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push(str.slice(last, m.index))
    if (m[0].startsWith('**'))
      out.push(<strong key={m.index} style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{m[2]}</strong>)
    else
      out.push(<code key={m.index} style={{ fontFamily: 'var(--mono)', fontSize: '.62rem', color: 'rgba(255,91,42,.9)', background: 'rgba(255,91,42,.08)', padding: '.1rem .3rem', letterSpacing: '.04em' }}>{m[3]}</code>)
    last = m.index + m[0].length
  }
  if (last < str.length) out.push(str.slice(last))
  return out
}

function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const els: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      const level = line.startsWith('# ') && !line.startsWith('## ') ? 1 : line.startsWith('## ') && !line.startsWith('### ') ? 2 : 3
      const content = line.slice(level + 1)
      els.push(<p key={i} style={{ margin: '.6rem 0 .2rem', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '.9rem', color: 'var(--ink-1)' }}>{content}</p>)
      i++
    } else if (line.startsWith('|')) {
      const rows: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++ }
      const dataRows = rows.filter(r => !/^\|[\s\-|:]+\|$/.test(r))
      const parseCells = (r: string) => r.split('|').slice(1, -1).map(c => c.trim())
      const [head, ...body] = dataRows
      els.push(
        <div key={`t${i}`} style={{ overflowX: 'auto', margin: '.4rem 0', border: '1px solid var(--hair)' }}>
          <table style={{ fontSize: '.62rem', width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hair)' }}>
                {parseCells(head).map((c, j) => (
                  <th key={j} style={{ padding: '.3rem .6rem', textAlign: 'left', color: 'var(--ink-3)', letterSpacing: '.15em', fontWeight: 400, textTransform: 'uppercase' }}>{parseInline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {parseCells(row).map((c, j) => (
                    <td key={j} style={{ padding: '.3rem .6rem', color: 'var(--ink-2)' }}>{parseInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2)); i++
      }
      els.push(
        <ul key={`ul${i}`} style={{ margin: '.3rem 0', padding: 0, listStyle: 'none' }}>
          {items.map((item, j) => (
            <li key={j} style={{ display: 'flex', gap: '.5rem', color: 'var(--ink-2)', padding: '.15rem 0' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: '.88rem', lineHeight: 1.5 }}>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      )
    } else if (!line.trim()) {
      i++
    } else {
      const buf: string[] = []
      while (
        i < lines.length && lines[i].trim() &&
        !lines[i].startsWith('#') && !lines[i].startsWith('|') &&
        !lines[i].startsWith('- ') && !lines[i].startsWith('* ')
      ) { buf.push(lines[i]); i++ }
      els.push(
        <p key={`p${i}`} style={{ margin: '.25rem 0', fontFamily: 'var(--serif)', fontSize: '.88rem', lineHeight: 1.55, color: 'var(--ink-2)' }}>
          {parseInline(buf.join(' '))}
        </p>
      )
    }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{els}</div>
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface ReportChatProps {
  jobId: string
  report: GenesisReport
  onClose?: () => void
}

export function ReportChat({ jobId, report, onClose }: ReportChatProps) {
  const topTarget = report.target_insights[0]?.target_gene ?? 'the top target'
  const suggestedQuestions = [
    'What is the lead compound?',
    `Why was ${topTarget} selected?`,
    'What are the recommended next steps?',
  ]

  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `I've analyzed the **${report.disease_name}** dossier — ${report.targets_analyzed} targets, ${report.molecules_generated} molecules generated, ${report.top_candidates.length} top candidates identified. What would you like to know?`,
  }])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming) return
    setShowSuggestions(false)
    const userMsg: Message = { role: 'user', content }
    const history = messages.filter(m => !m.streaming)
    const allMessages = [...history, userMsg]
    setMessages([...allMessages, { role: 'assistant', content: '', streaming: true }])
    setInput('')
    setIsStreaming(true)
    try {
      if (isDemoMode()) {
        const dummyResponse = "This is a demo mode response. I cannot provide real insight without the backend, but I can confirm that the top candidate passes the Lipinski rule of 5 and shows strong theoretical BBB penetration.";
        const words = dummyResponse.split(/(?= )/); // keep spaces
        let i = 0;
        let accumulated = '';
        
        await new Promise(r => setTimeout(r, 500)); // artificial delay
        
        const timer = setInterval(() => {
          if (i >= words.length) {
            clearInterval(timer);
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: accumulated };
              return updated;
            });
            setIsStreaming(false);
            return;
          }
          accumulated += words[i];
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: true };
            return updated;
          });
          i++;
        }, 50);
        return;
      }
      
      const response = await fetch(`/api/chat/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })) }),
      })
      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              accumulated += parsed.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: true }
                return updated
              })
            }
          } catch { /* skip malformed chunks */ }
        }
      }
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: accumulated }
        return updated
      })
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
        return updated
      })
    } finally {
      if (!isDemoMode()) setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'rgba(6,6,8,0.92)', backdropFilter: 'blur(24px)',
      borderLeft: '1px solid var(--hair)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '.85rem 1.1rem',
        borderBottom: '1px solid var(--hair)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block', boxShadow: '0 0 8px var(--accent)' }}/>
          <div>
            <div className="hud-label">AI RESEARCH CONSULTANT</div>
            <div className="hud-micro" style={{ marginTop: '.15rem', color: 'var(--ink-3)' }}>ASK ABOUT THIS DOSSIER</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-3)', padding: '.3rem',
          }}>
            <X size={14}/>
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.8rem', minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '.6rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'user' ? 'rgba(255,91,42,.2)' : 'rgba(255,255,255,.08)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(255,91,42,.4)' : 'var(--hair)'}`,
            }}>
              {msg.role === 'user'
                ? <User size={11} color="rgba(255,91,42,.9)"/>
                : <Bot size={11} color="var(--ink-3)"/>
              }
            </div>
            <div style={{
              maxWidth: '85%', padding: '.6rem .8rem',
              background: msg.role === 'user' ? 'rgba(255,91,42,.12)' : 'rgba(255,255,255,.05)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(255,91,42,.25)' : 'var(--hair)'}`,
            }}>
              {msg.streaming && !msg.content
                ? <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }} className="hud-micro">
                    <Loader2 size={10} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }}/>
                    COMPOSING…
                  </div>
                : msg.role === 'assistant'
                  ? <ChatMarkdown text={msg.content}/>
                  : <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '.88rem', color: 'var(--ink-1)' }}>{msg.content}</p>
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef}/>
      </div>

      {/* Suggested questions */}
      {showSuggestions && (
        <div style={{ padding: '.75rem 1rem', borderTop: '1px solid var(--hair)', flexShrink: 0 }}>
          <div className="hud-micro" style={{ marginBottom: '.5rem' }}>SUGGESTED QUERIES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            {suggestedQuestions.map(q => (
              <button key={q} onClick={() => sendMessage(q)} style={{
                textAlign: 'left', background: 'transparent',
                border: '1px solid var(--hair)', padding: '.4rem .7rem',
                cursor: 'pointer', fontFamily: 'var(--serif)', fontStyle: 'italic',
                fontSize: '.82rem', color: 'var(--ink-2)',
                transition: 'border-color .2s, color .2s',
              }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--hair)', padding: '.75rem 1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Inquire about targets, molecules, next steps…"
            rows={2}
            disabled={isStreaming}
            style={{
              flex: 1, resize: 'none', maxHeight: 80,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--hair)',
              outline: 'none', padding: '.5rem .7rem',
              color: 'var(--ink-1)', fontFamily: 'var(--serif)', fontSize: '.88rem',
              lineHeight: 1.5, letterSpacing: '.01em',
              opacity: isStreaming ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            style={{
              flexShrink: 0, width: 36, height: 36,
              background: 'rgba(255,91,42,.18)',
              border: '1px solid rgba(255,91,42,.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: (!input.trim() || isStreaming) ? 0.3 : 1,
              transition: 'opacity .2s',
            }}
          >
            <Send size={14} color="var(--accent)"/>
          </button>
        </div>
        <div className="hud-micro" style={{ marginTop: '.4rem', textAlign: 'center', color: 'var(--ink-3)' }}>
          ENTER TO SEND · SHIFT+ENTER FOR NEW LINE
        </div>
      </div>
    </div>
  )
}
