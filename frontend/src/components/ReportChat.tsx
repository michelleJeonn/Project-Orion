import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, X } from 'lucide-react'
import { GenesisReport } from '../types'
import { isDemoMode } from '../demoConfig'

const msgEntryStyle = `
  @keyframes msgEntry {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
`
if (typeof document !== 'undefined' && !document.getElementById('report-chat-styles')) {
  const s = document.createElement('style')
  s.id = 'report-chat-styles'
  s.textContent = msgEntryStyle
  document.head.appendChild(s)
}

// ── Design tokens (dark) ────────────────────────────────────────
const C = {
  bg:         'rgba(6,6,10,0.97)',
  panel:      'rgba(255,255,255,0.04)',
  panel2:     'rgba(255,255,255,0.07)',
  border:     'rgba(255,255,255,0.08)',
  border2:    'rgba(255,255,255,0.13)',
  text1:      'rgba(255,255,255,0.90)',
  text2:      'rgba(255,255,255,0.58)',
  text3:      'rgba(255,255,255,0.35)',
  text4:      'rgba(255,255,255,0.22)',
  pink:       'rgba(228,147,206,0.90)',
  pinkDim:    'rgba(228,147,206,0.65)',
  pinkBorder: 'rgba(228,147,206,0.30)',
  pinkPanel:  'rgba(228,147,206,0.07)',
  pinkGlow:   '0 0 12px rgba(228,147,206,0.30)',
}

// ── Markdown renderer ───────────────────────────────────────────
function parseInline(str: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push(str.slice(last, m.index))
    if (m[0].startsWith('**'))
      out.push(<strong key={m.index} style={{ color: C.text1, fontWeight: 500 }}>{m[2]}</strong>)
    else
      out.push(<code key={m.index} style={{
        fontFamily: 'var(--mono)', fontSize: '.62rem',
        color: C.pink, background: C.pinkPanel,
        padding: '.1rem .3rem', letterSpacing: '.04em', borderRadius: 2,
      }}>{m[3]}</code>)
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
      els.push(<p key={i} style={{ margin: '.6rem 0 .2rem', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '.9rem', color: C.text1 }}>{content}</p>)
      i++
    } else if (line.startsWith('|')) {
      const rows: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++ }
      const dataRows = rows.filter(r => !/^\|[\s\-|:]+\|$/.test(r))
      const parseCells = (r: string) => r.split('|').slice(1, -1).map(c => c.trim())
      const [head, ...body] = dataRows
      els.push(
        <div key={`t${i}`} style={{ overflowX: 'auto', margin: '.5rem 0', border: `1px solid ${C.border}` }}>
          <table style={{ fontSize: '.62rem', width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {parseCells(head).map((c, j) => (
                  <th key={j} style={{ padding: '.3rem .6rem', textAlign: 'left', color: C.text2, letterSpacing: '.15em', fontWeight: 400, textTransform: 'uppercase' }}>{parseInline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                  {parseCells(row).map((c, j) => (
                    <td key={j} style={{ padding: '.3rem .6rem', color: C.text1 }}>{parseInline(c)}</td>
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
            <li key={j} style={{ display: 'flex', gap: '.5rem', padding: '.18rem 0' }}>
              <span style={{ color: C.pink, flexShrink: 0, marginTop: 1 }}>·</span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: '.88rem', lineHeight: 1.55, color: C.text1 }}>{parseInline(item)}</span>
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
        <p key={`p${i}`} style={{ margin: '.2rem 0', fontFamily: 'var(--serif)', fontSize: '.88rem', lineHeight: 1.6, color: C.text1 }}>
          {parseInline(buf.join(' '))}
        </p>
      )
    }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{els}</div>
}

// ── Types ───────────────────────────────────────────────────────
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

// ── Component ───────────────────────────────────────────────────
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
  const inputWrapRef = useRef<HTMLDivElement>(null)

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
        const dummyResponse = "This is a demo mode response. I cannot provide real insight without the backend, but I can confirm that the top candidate passes the Lipinski rule of 5 and shows strong theoretical BBB penetration."
        const words = dummyResponse.split(/(?= )/)
        let i = 0, accumulated = ''
        await new Promise(r => setTimeout(r, 500))
        const timer = setInterval(() => {
          if (i >= words.length) {
            clearInterval(timer)
            setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u })
            setIsStreaming(false)
            return
          }
          accumulated += words[i]
          setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated, streaming: true }; return u })
          i++
        }, 50)
        return
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
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated, streaming: true }; return u })
            }
          } catch { /* skip malformed chunks */ }
        }
      }
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u })
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }; return u })
    } finally {
      if (!isDemoMode()) setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg,
      borderLeft: `1px solid ${C.border}`,
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          {/* live dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: C.pink,
            boxShadow: `0 0 0 3px rgba(120,60,220,0.18), ${C.pinkGlow}`,
          }}/>
          <div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: C.text1,
            }}>
              AI Research Consultant
            </div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: C.text3,
              marginTop: 4,
            }}>
              Ask about this dossier
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onClose && (
            <button
              onClick={onClose}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = C.panel2
                b.style.color = C.text1
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = 'transparent'
                b.style.color = C.text3
              }}
              style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                cursor: 'pointer', color: C.text3,
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <X size={13}/>
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: 14,
        minHeight: 0,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 10,
            animation: 'msgEntry 0.25s ease-out both',
          }}>
            {/* avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'user' ? C.panel : C.pinkPanel,
              border: `1px solid ${msg.role === 'user' ? C.border : C.pinkBorder}`,
            }}>
              {msg.role === 'user'
                ? <User size={12} color={C.text2}/>
                : <Bot size={12} color={C.pink}/>
              }
            </div>

            {/* bubble */}
            <div style={{
              maxWidth: '82%',
              padding: '10px 14px',
              background: msg.role === 'user' ? C.panel : C.pinkPanel,
              border: `1px solid ${msg.role === 'user' ? C.border : C.pinkBorder}`,
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            }}>
              {msg.streaming && !msg.content
                ? <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.20em', textTransform: 'uppercase',
                    color: C.text3,
                  }}>
                    <Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: C.pinkDim }}/>
                    Composing…
                  </div>
                : msg.role === 'assistant'
                  ? <ChatMarkdown text={msg.content}/>
                  : <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '.88rem', color: C.text1, lineHeight: 1.55 }}>
                      {msg.content}
                    </p>
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef}/>
      </div>

      {/* ── Suggested queries ── */}
      {showSuggestions && (
        <div style={{
          padding: '12px 16px 14px',
          borderTop: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.20em',
            textTransform: 'uppercase', color: C.text4,
            marginBottom: 9,
          }}>
            Suggested Queries
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {suggestedQuestions.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                onMouseEnter={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.borderColor = C.pinkBorder
                  b.style.color = C.text1
                  b.style.background = C.pinkPanel
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.borderColor = C.border
                  b.style.color = C.text2
                  b.style.background = 'transparent'
                }}
                style={{
                  textAlign: 'left', background: 'transparent',
                  border: `1px solid ${C.border}`,
                  padding: '9px 14px', cursor: 'pointer', borderRadius: 12,
                  fontFamily: 'var(--serif)', fontStyle: 'italic',
                  fontSize: '.84rem', color: C.text2,
                  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px', flexShrink: 0 }}>
        <div
          ref={inputWrapRef}
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: C.panel,
            border: `1px solid ${C.border2}`,
            borderRadius: 16, padding: '8px 8px 8px 8px',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={() => {
            if (inputWrapRef.current) inputWrapRef.current.style.borderColor = C.pinkBorder
          }}
          onBlurCapture={() => {
            if (inputWrapRef.current) inputWrapRef.current.style.borderColor = C.border2
          }}
        >
          {/* Import context */}
          <button
            title="Import previous conversations or context"
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = C.pinkPanel
              b.style.borderColor = C.pinkBorder
              b.style.color = C.pink
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'transparent'
              b.style.borderColor = C.border
              b.style.color = C.text3
            }}
            style={{
              flexShrink: 0, background: 'transparent', border: `1px solid ${C.border}`,
              cursor: 'pointer', color: C.text3,
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, lineHeight: 1, fontWeight: 300,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            +
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about targets, molecules, next steps…"
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1, resize: 'none', maxHeight: 90,
              background: 'transparent', border: 'none', outline: 'none',
              padding: '4px 0',
              color: C.text1,
              fontFamily: 'var(--serif)', fontSize: '.88rem',
              lineHeight: 1.55, letterSpacing: '.01em',
              opacity: isStreaming ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            style={{
              flexShrink: 0, width: 32, height: 32,
              background: (!input.trim() || isStreaming) ? 'transparent' : C.pinkPanel,
              border: `1px solid ${(!input.trim() || isStreaming) ? C.border : C.pinkBorder}`,
              borderRadius: 10, cursor: (!input.trim() || isStreaming) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, border-color 0.15s',
              opacity: (!input.trim() || isStreaming) ? 0.35 : 1,
            }}
          >
            <Send size={13} color={(!input.trim() || isStreaming) ? C.text3 : C.pink}/>
          </button>
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: C.text4,
          textAlign: 'center', marginTop: 8,
        }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}
