// App.jsx
// Ce composant principal gère l'interface, la logique des assistants IA, les documents associés, et le dialogue avec l'API (texte ou image).

import { useState, useEffect } from 'react';
import SettingsPanel from './SettingsPanel.jsx';
import ReactMarkdown from 'react-markdown';
import rehypePrism from 'rehype-prism-plus';
import 'prismjs/themes/prism-tomorrow.css';
import './styles.css'
import { extractTextFromDocument, readTextFromFile } from './documentUtils.js'
import { saveDocument, getDocumentsByIds } from './db.js'
import { generateImage } from './api.js';




function App() {
  // États de l'application
  const [prompt, setPrompt] = useState('') // prompt utilisateur
  const [systemPrompt, setSystemPrompt] = useState('') // prompt système (défini par l'utilisateur)
  const [model, setModel] = useState('') // modèle IA utilisé
  const [assistants, setAssistants] = useState([]) // tous les assistants enregistrés
  const [currentAssistantId, setCurrentAssistantId] = useState('new') // ID de l'assistant actif
  const [assistantName, setAssistantName] = useState('') // nom de l'assistant actif
  const [assistantDocuments, setAssistantDocuments] = useState([]) // documents associés à l'assistant
  const [isSettingsOpen, setIsSettingsOpen] = useState(false) // toggle panneau de configuration
  const [isReady, setIsReady] = useState(false) // indicateur que les données sont chargées
  const [messagesHistory, setMessagesHistory] = useState([]) // historique du chat
  const [loading, setLoading] = useState(false) // état de chargement de réponse
  const [outputType, setOutputType] = useState('texte') // mode de réponse : texte ou image

  // Fonction utilitaire pour échapper les caractères spéciaux dans une RegExp
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Initialisation : chargement des assistants enregistrés
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

  // Sauvegarde automatique dans localStorage avec debounce (300ms)
  useEffect(() => {
    if (isReady) {
      const timeout = setTimeout(() => {
        localStorage.setItem('assistants', JSON.stringify(assistants))
      }, 300)
      return () => clearTimeout(timeout)
    }
  }, [assistants, isReady])



  // Ouvre ou ferme le panneau de configuration
  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen)
  }

  // Génère un ID unique (timestamp)
  const generateId = () => Date.now().toString()

  // Sauvegarde ou mise à jour d’un assistant
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

  // Sélectionne un assistant existant ou réinitialise pour un nouveau
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

  // Gère l'upload de fichiers textes locaux
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

  // Découpe les blocs ```code``` dans une réponse texte
    const parseResponse = (content) => {
    const regex = /```(\w+)?\n([\s\S]*?)```/g
    let parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, match.index) })
      }
      const language = match[1] || 'plaintext'
      const code = match[2]
      parts.push({ type: 'code', content: code, language })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) })
    }

    return parts
  }


  // Réinitialise le chat (nouvelle session)
  const handleNewChat = () => {
    setMessagesHistory(systemPrompt ? [{ role: 'system', content: systemPrompt }] : [])
  }

  // Envoie une requête à l'IA (texte ou image)
  const handleSend = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);

    try {
      if (outputType === 'image') {
        const imageDataUrl = await generateImage(prompt);
        const newMessages = [{ role: 'user', content: prompt }];

        newMessages.push({
          role: 'assistant',
          content: imageDataUrl
            ? `![image générée](${imageDataUrl})`
            : `⚠️ Erreur lors de la génération d'image. Veuillez réessayer.`
        });

        setMessagesHistory(prev => [...prev.slice(-28), ...newMessages]);
      } else {
        let contextText = '';
        if (assistantDocuments?.length) {
          const docs = await getDocumentsByIds(assistantDocuments);
          const texts = docs.map(doc => doc.text || '');
          contextText = texts.filter(Boolean).join('\n\n');
        }

        const enrichedPrompt = contextText ? `${contextText}\n\n${prompt}` : prompt;

        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: enrichedPrompt },
            ],
            stream: false
          }),
        });

        if (!response.ok) throw new Error('Erreur de communication avec Ollama');
        const json = await response.json();
        console.log('↩️ Réponse fetch', response);
        console.log('[🧠 Réponse brute du modèle]', json);
        let assistantReply = json.message?.content || '';

        // Si la réponse contient un tag image, on déclenche une génération automatique
        const imagePromptMatch = assistantReply.match(/--image[:\s-]*([^\n]+)/i);
        if (imagePromptMatch) {
          const promptForImage = imagePromptMatch[1].trim();
          const imageDataUrl = await generateImage(promptForImage);

          const replacement = imageDataUrl
            ? `![image générée](${imageDataUrl})`
            : `❌ Erreur : l'image demandée (« ${promptForImage} ») n'a pas pu être générée.`;

          const pattern = new RegExp(`--image[:\\s-]*${escapeRegExp(promptForImage)}`, 'i');
          assistantReply = assistantReply.replace(pattern, replacement);
        }

        setMessagesHistory(prev => [
          ...prev.slice(-28),
          { role: 'user', content: prompt },
          { role: 'assistant', content: assistantReply }
        ]);
      }

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

  // Gère Ctrl+Entrée pour envoyer le prompt
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault()
      handleSend()
    }
  }


  //Interface utilisateur
   return (
    <div className="container">
      <div className="header">
        <h1>🤖 {assistantName || 'Assistant'}</h1>
        <button onClick={handleNewChat} className="save-button">🧹 Nouveau chat</button>
      </div>
      <div className="flex">
        <div className="chat-history">
          {messagesHistory.map((msg, index) => {
            const match = msg.content.match(/\!\[image générée\]\((data:image\/png;base64,[^)]+)\)/);
            const imageSrc = match?.[1];
            const contentSansImage = msg.content.replace(/\!\[image générée\]\((data:image\/png;base64,[^)]+)\)/, '');

            return (
              <div key={index} className={`chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="chat-meta">
                  <strong>{msg.role === 'user' ? '👤 Toi' : '🤖 Assistant'}</strong> :
                </div>

                <ReactMarkdown
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
      </div>

      <div className="chat-block-input">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ton message ici..."
          className="chat-input"
        />
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
          {loading ? 'Envoi...' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}

export default App