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
import { sendPromptToOllama,summarizeDocument } from './api.js'; 
import { extractTextFromPDF } from './pdfUtils.js';


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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const savedAssistants = JSON.parse(localStorage.getItem('assistants')) || []
    if (savedAssistants.length > 0) {
      const first = savedAssistants[0]
      setAssistants(savedAssistants)
      setAssistantName(first.name)
      setModel(first.model)
      setSystemPrompt(first.systemPrompt)
      setCurrentAssistantId(first.id)
      setMessagesHistory(first.history || [{ role: 'system', content: first.systemPrompt }]);
      getDocumentsByIds(first.documents || []).then((docs) => {
        setAssistantDocuments(docs)
      })
    }
    setIsReady(true)
  }, [])

  useEffect(() => {
  if (isReady) {
    const timeout = setTimeout(() => {
      localStorage.setItem('assistants', JSON.stringify(assistants));
    }, 300);
    return () => clearTimeout(timeout);
  }
}, [assistants, isReady]);

  useEffect(() => {
    Prism.highlightAll();
  }, [messagesHistory]);

  useEffect(() => {
    loadAgentConfigs().then(setAgentConfigs).catch(console.error)
  }, [])



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
  setUploading(true);

  const docs = await Promise.all(
    files.map(async (file) => {
      let text = '';

      if (file.name.toLowerCase().endsWith('.pdf')) {
        console.log(`📥 Extraction PDF : ${file.name}`);
        text = await extractTextFromPDF(file);
      } else if (file.name.match(/\.(txt|md|json)$/i)) {
        text = await readTextFromFile(file);
      } else {
        console.warn(`⛔ Document ignoré (non texte) : ${file.name}`);
        return null;
      }

      if (!text || text.trim().length < 50) {
        console.warn(`⚠️ Document vide ou trop court : ${file.name}`);
        return null;
      }

      try {
        const summary = await summarizeDocument(text, model);
        const doc = {
          name: file.name,
          text,
          summary
        };
        const id = await saveDocument(doc);
        return { ...doc, id };
      } catch (err) {
        console.error(`❌ Erreur sur le fichier ${file.name}`, err);
        return null;
      }
    })
  );

  const validDocs = docs.filter(Boolean);

  // 🧠 Mise à jour directe des documents associés en mémoire
  setAssistantDocuments(prev => [...prev, ...validDocs]);

  // ✅ Mise à jour de l’assistant courant en mémoire (pas besoin de "save")
  setAssistants(prev => {
    return prev.map(a =>
      a.id === currentAssistantId
        ? {
            ...a,
            documents: [
              ...(a.documents || []),
              ...validDocs.map(doc => doc.id)
            ]
          }
        : a
    );
  });

  setUploading(false);
  return validDocs.map(doc => doc.id);
};


  const handleNewChat = () => {
    const newHistory = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];
    setMessagesHistory(newHistory);

    // 🔁 Met à jour l'assistant courant pour forcer la sauvegarde
    setAssistants(prev =>
      prev.map(a =>
        a.id === currentAssistantId
          ? { ...a, history: newHistory }
          : a
      )
    );
  }

  
  const handleSend = async () => {
    if (uploading) {
      console.warn('⛔ Documents en cours de traitement. Attendez...');
      return;
    }
    if (!prompt.trim() || loading) return;
    setLoading(true);

    const t0 = performance.now();
    console.log('🕒 [handleSend] START');

    try {
      let contextText = '';
      const t1 = performance.now();

      if (assistantDocuments?.length) {

        console.log('📚 assistantDocuments:', assistantDocuments);
        const docs = await getDocumentsByIds(assistantDocuments);
        console.log('📦 docs récupérés :', docs);

        const texts = docs
          .filter(Boolean)
          .map(doc => doc.summary || doc.text || '');
        contextText = texts.filter(Boolean).join('\n\n');
      }

      const t2 = performance.now();
      console.log(`📄 Documents chargés et concaténés en ${Math.round(t2 - t1)} ms`);

      const enrichedPrompt = contextText ? `${contextText}\n\n${prompt}` : prompt;

      const systemPromptFinal = `${systemPrompt.trim()}\n${buildAgentInstructionPrompt(agentConfigs)}`;
      const t3 = performance.now();
      console.log(`🧠 Prompt final construit en ${Math.round(t3 - t2)} ms`);

      const fetchStart = performance.now();
      const assistantReplyRaw = await sendPromptToOllama(enrichedPrompt, systemPromptFinal, model);
      console.log("----------------------------\r\r"+enrichedPrompt+"\r\r----------------------------\r\r"+systemPromptFinal);
      const fetchEnd = performance.now();
      console.log(`🚀 Requête fetch exécutée en ${Math.round(fetchEnd - fetchStart)} ms`);


      const agentStart = performance.now();
      const agentCommands = extractAgentCommands(assistantReplyRaw);
      let assistantReply = assistantReplyRaw;

      for (const { agentId, prompt: agentPrompt, raw } of agentCommands) {
        const config = agentConfigs[agentId];
        if (!config) continue;

        const tAgent = performance.now();
        const result = await executeAgent(agentId, agentPrompt, config);
        const tAgentEnd = performance.now();

        console.log(`[Agent utilisé] ${agentId} →`, result);
        console.log(`⏱️ Temps agent ${agentId} : ${Math.round(tAgentEnd - tAgent)} ms`);

        const escapedRaw = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escapedRaw, 'g');
        const safeReplacement = `\n\n[Agent ${agentId}]\n${result}\n\n`;
        assistantReply = assistantReply.replace(re, safeReplacement);
      }

      const agentEnd = performance.now();
      console.log(`🤖 Post-traitement agents total : ${Math.round(agentEnd - agentStart)} ms`);

      console.log('[handleSend] assistantReplyRaw:', assistantReplyRaw);
      console.log('[handleSend] agentCommands:', agentCommands);
      console.log('[assistantReply final]', assistantReply);

      setMessagesHistory(prev => [
        ...prev.slice(-28),
        { role: 'user', content: prompt },
        { role: 'assistant', content: assistantReply }
      ]);

      setAssistants(prev =>
        prev.map(a =>
          a.id === currentAssistantId
            ? {
                ...a,
                history: [
                  ...messagesHistory.slice(-28),
                  { role: 'user', content: prompt },
                  { role: 'assistant', content: assistantReply }
                ]
              }
            : a
        )
      );

      const tEnd = performance.now();
      console.log(`✅ handleSend TOTAL : ${Math.round(tEnd - t0)} ms`);

      

      setPrompt('');
      setLoading(false);
    } catch (error) {
      console.error('Erreur pendant la génération', error);
      setMessagesHistory(prev => [
        ...prev.slice(-28),
        { role: 'user', content: prompt },
        { role: 'assistant', content: '❌ Une erreur est survenue. Veuillez réessayer.' }
      ]);

      setAssistants(prev =>
        prev.map(a =>
          a.id === currentAssistantId
            ? {
                ...a,
                history: [
                  ...(a.history || []).slice(-28),
                  { role: 'user', content: prompt },
                  { role: 'assistant', content: '❌ Une erreur est survenue. Veuillez réessayer.' }
                ]
              }
            : a
        )
      );

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
            const contentCleaned = contentSansImage.replace(/<think>[\s\S]*?<\/think>/gi, '');

              return (
                <div key={index} className={`chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                  <div className="chat-meta">
                    <strong>
                      {msg.role === 'user' ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#e3e3e3">
                            <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Z" />
                          </svg> Vous
                        </> 
                      ) : (
                        <>
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#e3e3e3">
                          <path d="M390-120q-51 0-88-35.5T260-241q-60-8-100-53t-40-106q0-21 5.5-41.5T142-480q-11-18-16.5-38t-5.5-42q0-61 40-105.5t99-52.5q3-51 41-86.5t90-35.5q26 0 48.5 10t41.5 27q18-17 41-27t49-10q52 0 89.5 35t40.5 86q59 8 99.5 53T840-560q0 22-5.5 42T818-480q11 18 16.5 38.5T840-400q0 62-40.5 106.5T699-241q-5 50-41.5 85.5T570-120q-25 0-48.5-9.5T480-156q-19 17-42 26.5t-48 9.5Zm130-590v460q0 21 14.5 35.5T570-200q20 0 34.5-16t15.5-36q-21-8-38.5-21.5T550-306q-10-14-7.5-30t16.5-26q14-10 30-7.5t26 16.5q11 16 28 24.5t37 8.5q33 0 56.5-23.5T760-400q0-5-.5-10t-2.5-10q-17 10-36.5 15t-40.5 5q-17 0-28.5-11.5T640-440q0-17 11.5-28.5T680-480q33 0 56.5-23.5T760-560q0-33-23.5-56T680-640q-11 18-28.5 31.5T613-587q-16 6-31-1t-20-23q-5-16 1.5-31t22.5-20q15-5 24.5-18t9.5-30q0-21-14.5-35.5T570-760q-21 0-35.5 14.5T520-710Zm-80 460v-460q0-21-14.5-35.5T390-760q-21 0-35.5 14.5T340-710q0 16 9 29.5t24 18.5q16 5 23 20t2 31q-6 16-21 23t-31 1q-21-8-38.5-21.5T279-640q-32 1-55.5 24.5T200-560q0 33 23.5 56.5T280-480q17 0 28.5 11.5T320-440q0 17-11.5 28.5T280-400q-21 0-40.5-5T203-420q-2 5-2.5 10t-.5 10q0 33 23.5 56.5T280-320q20 0 37-8.5t28-24.5q10-14 26-16.5t30 7.5q14 10 16.5 26t-7.5 30q-14 19-32 33t-39 22q1 20 16 35.5t35 15.5q21 0 35.5-14.5T440-250Z" />
                        </svg> {assistantName || 'Assistant'}
                        </>
                      )}
                    </strong>
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
              {contentCleaned}

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
              
            </div>

            {uploading ? (
              <button className="send-button" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-520q66 0 113-47t47-113v-120H320v120q0 66 47 113t113 47ZM160-80v-80h80v-120q0-61 28.5-114.5T348-480q-51-32-79.5-85.5T240-680v-120h-80v-80h640v80h-80v120q0 61-28.5 114.5T612-480q51 32 79.5 85.5T720-280v120h80v80H160Z"/></svg>
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
