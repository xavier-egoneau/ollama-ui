// App.jsx (version complète, logique + UI)
import { useState, useEffect } from 'react'
import SettingsPanel from './SettingsPanel.jsx'
import ReactMarkdown from 'react-markdown'
import Prism from 'prismjs';
import rehypePrism from 'rehype-prism-plus';
import 'prismjs/themes/prism-tomorrow.css';
import './styles.min.css'
import remarkGfm from 'remark-gfm';
import { extractTextFromDocument, readTextFromFile } from './documentUtils.js'
import { saveDocument, getDocumentsByIds } from './db.js'
import { loadAgentConfigs, extractAgentCommands, executeAgent, buildAgentInstructionPrompt } from './router.js'


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
  const [outputType, setOutputType] = useState('texte')
  const [agentConfigs, setAgentConfigs] = useState({})

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
      const timeout = setTimeout(() => {
        localStorage.setItem('assistants', JSON.stringify(assistants))
      }, 300)
      return () => clearTimeout(timeout)
    }
  }, [assistants, isReady])

  useEffect(() => {
    Prism.highlightAll();
  }, [messagesHistory]);

  useEffect(() => {
    loadAgentConfigs().then(setAgentConfigs).catch(console.error)
  }, [])

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
      history: messagesHistory,
      documents: assistantDocuments.map(doc => typeof doc === 'object' && doc !== null ? doc.id : doc)
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
      setAssistantDocuments([])
      setCurrentAssistantId('new')
      setMessagesHistory([])
    } else {
      const selected = assistants.find(a => a.id === id)
      if (selected) {
        setAssistantName(selected.name)
        setModel(selected.model)
        setSystemPrompt(selected.systemPrompt)
        setCurrentAssistantId(selected.id)
        setMessagesHistory(selected.history || [{ role: 'system', content: selected.systemPrompt }])
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
        const id = await saveDocument(doc)
        return id
      })
    )
    setAssistantDocuments(prev => [...prev, ...ids])
    return ids
  }

  const handleNewChat = () => {
    setMessagesHistory(systemPrompt ? [{ role: 'system', content: systemPrompt }] : [])
  }

  const handleSend = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);

    try {
      let contextText = '';
      if (assistantDocuments?.length) {
        const docs = await getDocumentsByIds(assistantDocuments);
        const texts = docs.map(doc => doc.text || '');
        contextText = texts.filter(Boolean).join('\n\n');
      }

      const enrichedPrompt = contextText ? `${contextText}\n\n${prompt}` : prompt;

      
      
      const systemPromptFinal = `${systemPrompt.trim()}\n${buildAgentInstructionPrompt(agentConfigs)}`;

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            
            ...(systemPromptFinal ? [{ role: 'system', content: systemPromptFinal }] : []),
            { role: 'user', content: enrichedPrompt },
          ],
          stream: false
        }),
      });

      if (!response.ok) throw new Error('Erreur de communication avec Ollama');
      const json = await response.json();

      const assistantReplyRaw = json.message?.content || '';

      const agentCommands = extractAgentCommands(assistantReplyRaw)
      let assistantReply = assistantReplyRaw

      

      for (const { agentId, prompt: agentPrompt, raw } of agentCommands) {
        const config = agentConfigs[agentId];
        if (!config) continue;

        const result = await executeAgent(agentId, agentPrompt, config);

        const escapedRaw = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escapedRaw, 'g');

        // On injecte le résultat de façon plus propre, sur une ligne dédiée
        const safeReplacement = `\n\n[Agent ${agentId}]\n${result}\n\n`;

        assistantReply = assistantReply.replace(re, safeReplacement);

        // Log de debug (facultatif)
        console.log(`[Agent utilisé] ${agentId} →`, result);
      }


      console.log('[handleSend] assistantReplyRaw:', assistantReplyRaw);
      console.log('[handleSend] agentCommands:', agentCommands);
      console.log('[assistantReply final]', assistantReply);

      setMessagesHistory(prev => [
        ...prev.slice(-28),
        { role: 'user', content: prompt },
        { role: 'assistant', content: assistantReply }
      ])

      setPrompt('');
      setLoading(false);
    } catch (error) {
      console.error('Erreur pendant la génération', error);
      setMessagesHistory(prev => [
        ...prev.slice(-28),
        { role: 'user', content: prompt },
        { role: 'assistant', content: '❌ Une erreur est survenue. Veuillez réessayer.' }
      ])
      setPrompt('');
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🤖 {assistantName || 'Assistant'}</h1>
        <button onClick={handleNewChat} className="newchat-button button button--round"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg></button>
      </div>

      
        <div className="chat-history">
          {messagesHistory
            .filter(msg => msg.role !== 'system') // 👈 filtre les prompts système
            .map((msg, index) => {

            


            const match = msg.content.match(/\!\[image générée\]\((data:image\/png;base64,[^)]+)\)/);
            const imageSrc = match?.[1];
            // Supprimer aussi les balises <think>…</think> si présent
            const contentSansImage = msg.content.replace(/\!\[image générée\]\((data:image\/png;base64,[^)]+)\)/, '');

              return (
                <div key={index} className={`chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                  <div className="chat-meta">
                    <strong>{msg.role === 'user' ? '👤 Toi' : '🤖 Assistant'}</strong> :
                  </div>

                  <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypePrism]}
              components={{
                img: ({ node, ...props }) => {
                  if (!props.src) return null;
                  return (
                    <img
                      src={props.src}
                      alt={props.alt || 'image'}
                      style={{ maxWidth: '100%', borderRadius: '10px', marginTop: '10px' }}
                    />
                  );
                },
              }}
            >
              {contentSansImage}
            </ReactMarkdown>

                  {imageSrc && (
                    <img
                      src={imageSrc}
                      alt="image générée"
                      style={{ maxWidth: '100%', borderRadius: '10px', marginTop: '10px' }}
                    />
                  )}
                </div>
              );
            })}
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
  

      <div className="chat-block-input">
        <div className="chat-block-input-inner">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ton message ici..."
            className="chat-input"
          />
          <div className="flex flex-sc">
            <div style={{ margin: '10px 0' }}>
              <label>
                <input
                  type="radio"
                  value="texte"
                  checked={outputType === 'texte'}
                  onChange={() => setOutputType('texte')}
                />
                Réponse texte
              </label>
              <label style={{ marginLeft: '20px' }}>
                <input
                  type="radio"
                  value="image"
                  checked={outputType === 'image'}
                  onChange={() => setOutputType('image')}
                />
                Image générée
              </label>
            </div>

            <button className="send-button" onClick={handleSend} disabled={loading}>
  {loading ? (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Zm400-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z"/></svg>

    </>
  ) : (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"/></svg>

    </>
  )}
</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
