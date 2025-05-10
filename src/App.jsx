import { useState, useEffect } from 'react'
import SettingsPanel from './SettingsPanel.jsx'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import ReactMarkdown from 'react-markdown'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-markup.min.js'
import './styles.css'
import { extractTextFromDocument, readTextFromFile } from './documentUtils.js'
import { saveDocument, getDocumentsByIds } from './db.js'

function App() {
  const [prompt, setPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [assistants, setAssistants] = useState([])
  const [currentAssistantId, setCurrentAssistantId] = useState('new')
  const [assistantName, setAssistantName] = useState('')
  const [assistantDocuments, setAssistantDocuments] = useState([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [messagesHistory, setMessagesHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedAssistants = JSON.parse(localStorage.getItem('assistants')) || []
    if (savedAssistants.length > 0) {
      const first = savedAssistants[0]
      setAssistants(savedAssistants)
      setAssistantName(first.name)
      setModel(first.model)
      setSystemPrompt(first.systemPrompt)
      setCurrentAssistantId(first.id)
      setMessagesHistory([{ role: 'system', content: first.systemPrompt }])
      getDocumentsByIds(first.documents || []).then((docs) => {
        setAssistantDocuments(docs)
      })
    }
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (isReady) {
      localStorage.setItem('assistants', JSON.stringify(assistants))
    }
  }, [assistants, isReady])

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen)
  }

  const generateId = () => Date.now().toString()

  const handleSaveAssistant = () => {
    if (!assistantName.trim()) {
      alert('Le nom de l’assistant est obligatoire.')
      return
    }

    const updatedAssistant = {
      id: currentAssistantId === 'new' ? generateId() : currentAssistantId,
      name: assistantName.trim(),
      model: model || '',
      systemPrompt: systemPrompt.trim() || '',
      documents: assistantDocuments.map(doc =>
        typeof doc === 'object' && doc !== null ? doc.id : doc
      )
    }

    const existingIndex = assistants.findIndex(a => a.id === updatedAssistant.id)

    if (existingIndex !== -1) {
      const newAssistants = [...assistants]
      newAssistants[existingIndex] = updatedAssistant
      setAssistants(newAssistants)
    } else {
      const newAssistants = [...assistants, updatedAssistant]
      setAssistants(newAssistants)
    }

    setCurrentAssistantId(updatedAssistant.id)
    setAssistantName(updatedAssistant.name)
    setModel(updatedAssistant.model)
    setSystemPrompt(updatedAssistant.systemPrompt)
    setMessagesHistory([{ role: 'system', content: updatedAssistant.systemPrompt }])
  }

  const handleSelectAssistant = async (id) => {
    if (id === 'new') {
      setAssistantName('')
      setModel('')
      setSystemPrompt('')
      setAssistantDocuments([]) // 🧹 vide les documents précédents
      setCurrentAssistantId('new')
      setMessagesHistory([])
    } else {
      const selected = assistants.find(a => a.id === id)
      if (selected) {
        setAssistantName(selected.name)
        setModel(selected.model)
        setSystemPrompt(selected.systemPrompt)
        setCurrentAssistantId(selected.id)
        setMessagesHistory([{ role: 'system', content: selected.systemPrompt }])
        const docs = await getDocumentsByIds(selected.documents || [])
        setAssistantDocuments(docs.map(doc => ({ ...doc })))
      }
    }
  }

  const handleUploadDocuments = async (files) => {
    const ids = await Promise.all(
      files.map(async (file) => {
        const text = await readTextFromFile(file)
        const doc = { name: file.name, text }
        const id = await saveDocument(doc) // ← correction ici
        return id
      })
    )
    setAssistantDocuments(prev => [...prev, ...ids])
    return ids
  }



  const parseResponse = (content) => {
    const regex = /```(?:\w+)?\n([\s\S]*?)```/g
    let parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, match.index) })
      }
      parts.push({ type: 'code', content: match[1] })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) })
    }

    return parts
  }

  const handleSend = async () => {
    if (!prompt.trim()) return
    setLoading(true)

    let contextText = ''
    if (assistantDocuments?.length) {
      const docs = await getDocumentsByIds(assistantDocuments)
      const texts = docs.map(doc => doc.text || '')
      contextText = texts.filter(Boolean).join('\n\n')
    }

    const enrichedPrompt = contextText ? `${contextText}\n\n${prompt}` : prompt

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: enrichedPrompt },
          ],
          stream: false,
          options: { temperature: 0.7 },
        }),
      })

      const data = await response.json()
      const assistantReply = data.message.content
      setMessagesHistory([...messagesHistory, { role: 'user', content: prompt }, { role: 'assistant', content: assistantReply }])
      setPrompt('')
      setLoading(false)
    } catch (error) {
      console.error('Erreur pendant l’envoi du prompt', error)
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🤖 {assistantName || 'Assistant'}</h1>
       
      </div>
      <div className="flex">
        <div className="chat-history">
          {messagesHistory.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="chat-meta">
                <strong>{msg.role === 'user' ? '👤 Toi' : '🤖 Assistant'}</strong> :
              </div>
              {parseResponse(msg.content).map((part, idx) => (
                part.type === 'code' ? (
                  <div key={idx} className="code-block">
                    <button
                      className="copy-button"
                      onClick={() => navigator.clipboard.writeText(part.content)}
                    >
                      📋 Copier ce code
                    </button>
                    <Editor
                      value={part.content}
                      onValueChange={() => {}}
                      highlight={code => Prism.highlight(code, Prism.languages.markup, 'markup')}
                      padding={10}
                      className="editor"
                    />
                  </div>
                ) : (
                  <ReactMarkdown
                    key={idx}
                    components={{
                      p: ({ node, ...props }) => <p className="chat-content" {...props} />,
                      h1: ({ node, ...props }) => <h1 className="chat-content" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="chat-content" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="chat-content" {...props} />,
                      ul: ({ node, ...props }) => <ul className="chat-content" {...props} />,
                      ol: ({ node, ...props }) => <ol className="chat-content" {...props} />,
                      li: ({ node, ...props }) => <li className="chat-content" {...props} />,
                      code: ({ node, ...props }) => <code className="chat-content" {...props} />,
                      hr: ({ node, ...props }) => <hr className="chat-content" {...props} />,
                    }}
                  >
                    {part.content}
                  </ReactMarkdown>
                )
              ))}
            </div>
          ))}
        </div>
        <SettingsPanel
          isOpen={isSettingsOpen}
          assistantName={assistantName}
          setAssistantName={setAssistantName}
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          model={model}
          setModel={setModel}
          onSaveAssistant={handleSaveAssistant}
          assistants={assistants}
          currentAssistantId={currentAssistantId}
          onSelectAssistant={handleSelectAssistant}
          onDeleteAssistant={() => {
            const updated = assistants.filter(a => a.id !== currentAssistantId)
            setAssistants(updated)
            setCurrentAssistantId('new')
            setAssistantName('')
            setModel('')
            setSystemPrompt('')
            setAssistantDocuments([])
            setMessagesHistory([])
          }}
          assistantDocuments={assistantDocuments}
          setAssistantDocuments={setAssistantDocuments}
          onUploadDocuments={handleUploadDocuments}
        />
      </div>
      <div className="chat-block-input">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ton message ici..."
          className="chat-input"
        />
        <button className="send-button" onClick={handleSend} disabled={loading}>
          {loading ? 'Envoi...' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}

export default App