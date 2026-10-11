import { useState, useEffect, useRef } from 'react'
import { useRcm, getAssistantReply } from '../context/RcmContext'
import PageShell from '../components/PageShell'
import '../App.css'

export default function AssistantPage() {
  const {
    claims, denials, payments, user,
    assistantPrompt, setAssistantPrompt,
    assistantMessages, setAssistantMessages,
    handleNavigate, toasts, showToast,
  } = useRcm()

  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [assistantMessages, isTyping])

  const handleAssistantSubmit = () => {
    if (!assistantPrompt.trim()) return

    const userMessage = { id: Date.now(), role: 'user', content: assistantPrompt }
    const promptToSend = assistantPrompt
    setAssistantMessages((current) => [...current, userMessage])
    setAssistantPrompt('')
    setIsTyping(true)

    setTimeout(() => {
      const reply = getAssistantReply(promptToSend, claims, denials, payments, user)
      const botMessage = { id: Date.now() + 1, role: 'assistant', content: reply }
      setAssistantMessages((current) => [...current, botMessage])
      setIsTyping(false)
    }, 600)
  }

  const suggestedChips = [
    "What's our AR over 90 days?",
    'Show me top denial codes',
    "What's the denial rate by payer?",
    'Show me collection rate',
    'Compare payer performance',
    "What's our total outstanding AR?",
    'Show claims by status',
    'Which payer has the most denials?',
  ]

  const handleChipClick = (chip) => {
    if (!chip.trim()) return

    const userMessage = { id: Date.now(), role: 'user', content: chip }
    setAssistantMessages((current) => [...current, userMessage])
    setAssistantPrompt('')
    setIsTyping(true)

    setTimeout(() => {
      const reply = getAssistantReply(chip, claims, denials, payments, user)
      const botMessage = { id: Date.now() + 1, role: 'assistant', content: reply }
      setAssistantMessages((current) => [...current, botMessage])
      setIsTyping(false)
    }, 600)
  }

  return (
    <>
      <PageShell title="AI Assistant" subtitle="Ask questions about your revenue cycle data">
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>

        <div className="assistant-view">
          <div className="assistant-shell">
            <div className="assistant-header-block">
              <div className="assistant-title-wrap">
                <span className="assistant-badge">✦</span>
                <div>
                  <h1>AI Assistant</h1>
                  <p>Ask questions about your revenue cycle data in natural language</p>
                </div>
              </div>
            </div>

            <div className="assistant-suggestions">
              {suggestedChips.slice(0, 2).map((chip) => (
                <div key={chip} className="suggestion-bubble" onClick={() => handleChipClick(chip)}>
                  "{chip}"
                </div>
              ))}
            </div>

            <div className="assistant-note">
              I'll provide instant answers with data from your RCM system.
            </div>

            <div className="assistant-chip-row">
              {suggestedChips.map((chip) => (
                <button key={chip} type="button" className="assistant-chip" onClick={() => handleChipClick(chip)}>{chip}</button>
              ))}
            </div>

            <div className="assistant-chat-container">
              {assistantMessages.map((message) => (
                <div
                  key={message.id}
                  className={`message-bubble ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                >
                  {message.content}
                </div>
              ))}
              {isTyping && (
                <div className="message-bubble assistant-message">
                  <span className="typing-dots">...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="assistant-composer">
              <input
                type="text"
                value={assistantPrompt}
                onChange={(event) => setAssistantPrompt(event.target.value)}
                placeholder="Ask about AR, denials, payers, collections..."
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAssistantSubmit()
                }}
              />
              <button type="button" aria-label="Send message" onClick={handleAssistantSubmit}>➤</button>
            </div>

            <div className="assistant-footer-note">
              Supported Intents: AR Aging, Denial Rates, Top Denial Codes, Payer Comparison, Collection Rates, Total AR, Claims by Status
            </div>
          </div>
        </div>
      </PageShell>
    </>
  )
}
