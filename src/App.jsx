import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css' // 🔥 joli dark mode
import 'prismjs/components/prism-markup.min.js' // 🔥 pour le texte générique (pas besoin d'un langage spécifique)

import { useState, useEffect } from 'react'
import { sendPromptToOllama } from './api.js'
import SettingsPanel from './SettingsPanel.jsx'

function App() {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [assistantName, setAssistantName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [assistants, setAssistants] = useState([])
  const [currentAssistantId, setCurrentAssistantId] = useState('new')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [messagesHistory, setMessagesHistory] = useState([
    { role: 'system', content: systemPrompt }
  ])

  useEffect(() => {
    const savedAssistants = JSON.parse(localStorage.getItem('assistants')) || []
  
    if (savedAssistants.length > 0) {
      setAssistants(savedAssistants)
      const first = savedAssistants[0]
      setCurrentAssistantId(first.id)
      setAssistantName(first.name)
      setModel(first.model)
      setSystemPrompt(first.systemPrompt)
    } else {
      setAssistants([])
      setCurrentAssistantId('new')
      setAssistantName('')
      setModel('')
      setSystemPrompt('')
    }
  
    setIsReady(true) // 🔥 Déclencher qu'à la fin du chargement
  }, [])
  

  
  useEffect(() => {
    if (isReady) {
      localStorage.setItem('assistants', JSON.stringify(assistants))
    }
  }, [assistants, isReady])
  

  const generateId = () => Date.now().toString()

  const handleSend = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    const result = await sendPromptToOllama(prompt, systemPrompt, model)
    setResponse(result)
    setLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen)
  }

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
    }
  
    const existingIndex = assistants.findIndex(a => a.id === updatedAssistant.id)
  
    if (existingIndex !== -1) {
      // Mise à jour
      const newAssistants = [...assistants]
      newAssistants[existingIndex] = updatedAssistant
      setAssistants(newAssistants)
    } else {
      // Nouvelle création
      const newAssistants = [...assistants, updatedAssistant]
      setAssistants(newAssistants)
    }
  
    // Important : remettre à jour la sélection
    setCurrentAssistantId(updatedAssistant.id)
    setAssistantName(updatedAssistant.name)
    setModel(updatedAssistant.model)
    setSystemPrompt(updatedAssistant.systemPrompt)
  }

  function parseResponse(response) {
    const regex = /```(?:\w+)?\n([\s\S]*?)```/g
    let parts = []
    let lastIndex = 0
    let match
  
    while ((match = regex.exec(response)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: response.substring(lastIndex, match.index),
        })
      }
      parts.push({
        type: 'code',
        content: match[1],
      })
      lastIndex = regex.lastIndex
    }
  
    if (lastIndex < response.length) {
      parts.push({
        type: 'text',
        content: response.substring(lastIndex),
      })
    }
  
    return parts
  }

  
  const handleDeleteAssistant = () => {
    if (!currentAssistantId || currentAssistantId === 'new') return
  
    const confirmed = window.confirm('Supprimer cet assistant ?')
    if (!confirmed) return
  
    const newAssistants = assistants.filter(a => a.id !== currentAssistantId)
    setAssistants(newAssistants)
  
    // Reset pour créer un nouvel assistant
    setCurrentAssistantId('new')
    setAssistantName('')
    setModel('')
    setSystemPrompt('')
  }
  
  const handleSelectAssistant = (id) => {
    if (id === 'new') {
      setAssistantName('')
      setModel('')
      setSystemPrompt('')
      setCurrentAssistantId('new')
    } else {
      const selected = assistants.find(a => a.id === id)
      if (selected) {
        setAssistantName(selected.name)
        setModel(selected.model)
        setSystemPrompt(selected.systemPrompt)
        setCurrentAssistantId(selected.id)
      }
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>{assistantName || 'Assistant'}</h1>
        <button className="settings-button" onClick={toggleSettings}>⚙️</button>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        assistantName={assistantName}
        setAssistantName={setAssistantName}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        model={model}
        setModel={setModel}
        onSaveAssistant={handleSaveAssistant}    // <<<<<< IMPORTANT
        assistants={assistants}
        currentAssistantId={currentAssistantId}
        onSelectAssistant={handleSelectAssistant}
        onDeleteAssistant={handleDeleteAssistant}   // <<<<< ajoute cette ligne
      />

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Ton message ici..."
      />

      <button onClick={handleSend} disabled={loading}>
        {loading ? 'Envoi...' : 'Envoyer'}
      </button>

      <div className="response" style={{ marginTop: '2rem' }}>
        <h2>Réponse :</h2>

        {response && parseResponse(response).map((part, index) => (
          part.type === 'code' ? (
            <div key={index} style={{ marginBottom: '1.5rem' }}>
              <button
                onClick={() => navigator.clipboard.writeText(part.content)}
                style={{
                  marginBottom: '0.5rem',
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                📋 Copier ce code
              </button>

              <Editor
                value={part.content}
                onValueChange={() => {}}
                highlight={code => Prism.highlight(code, Prism.languages.markup, 'markup')}
                padding={10}
                style={{
                  fontFamily: '"Fira Code", "Fira Mono", monospace',
                  fontSize: 14,
                  backgroundColor: '#2d2d2d',
                  color: '#f8f8f2',
                  borderRadius: '8px',
                  minHeight: '100px',
                  pointerEvents: 'none',
                  userSelect: 'text',
                }}
              />
            </div>
          ) : (
            <p key={index} style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
              {part.content}
            </p>
          )
        ))}
      </div>





      <div className="prompt-info" style={{ marginTop: '2rem', backgroundColor: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
        <h2>🔍 Infos Envoyées :</h2>
        <p><strong>Modèle :</strong> {model || 'Non défini'}</p>
        <p><strong>Prompt Système :</strong> {systemPrompt || 'Pas de prompt système.'}</p>
      </div>

    </div>
  )
}

export default App
