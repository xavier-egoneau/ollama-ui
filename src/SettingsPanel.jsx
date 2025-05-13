import { useState, useEffect } from 'react'

function SettingsPanel({
  isOpen,
  assistantName,
  setAssistantName,
  systemPrompt,
  setSystemPrompt,
  model,
  setModel,
  onSaveAssistant,
  assistants,
  currentAssistantId,
  onSelectAssistant,
  onDeleteAssistant,
  assistantDocuments,
  setAssistantDocuments,
  onUploadDocuments,
}) {
  const [models, setModels] = useState([])

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('http://localhost:11434/api/tags')
        const data = await response.json()
        if (data.models) {
          const modelNames = data.models.map(m => m.name)
          setModels(modelNames)
        }
      } catch (error) {
        console.error('Erreur en récupérant les modèles :', error)
      }
    }

    fetchModels()
  }, [])

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    if (onUploadDocuments && files.length > 0) {
      const result = await onUploadDocuments(files)
      const ids = Array.isArray(result) ? result : [result]
      setAssistantDocuments(prev => [...prev, ...ids])
    }
  }


  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      <h2>Paramètres</h2>

      <div className="form-control">
        <label>Choisir un assistant :</label>
        <select value={currentAssistantId} onChange={(e) => onSelectAssistant(e.target.value)}>
          {assistants.map((assistant) => (
            <option key={assistant.id} value={assistant.id}>
              {assistant.name}
            </option>
          ))}
          <option value="new">➕ Ajouter un nouvel assistant</option>
        </select>
      </div>

      <div className="form-control">
        <label>Nom de l'assistant :</label>
        <input
          type="text"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="Nom de l'assistant"
        />
      </div>

      <div className="form-control">
        <label>Modèle :</label>
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="" disabled>Sélectionnez un modèle</option>
          {models.length > 0 ? (
            models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))
          ) : (
            <option disabled>Chargement...</option>
          )}
        </select>
      </div>

      <div className="form-control">
        <label>Prompt système :</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Prompt système"
          rows={4}
          cols={50}
          maxLength={5000}
        />
      </div>

      <div className="form-control">
        <label>Documents associés :</label>
        <input type="file" multiple onChange={handleFileUpload} />
        <ul className="docs">
          {[...new Map(assistantDocuments.map(doc => [typeof doc === 'object' ? doc.id : doc, doc])).values()].map((doc, idx) => {

            const label = typeof doc === 'object' && doc !== null
              ? doc.name || `Document ${doc.id}`
              : `Document ID: ${doc}`
            return <li key={idx}>{label}</li>
          })}
        </ul>

      </div>
      <div className="settings-panel--actions">
        <div className="flex flex-sc">
          <button onClick={onSaveAssistant} className="save-button button button--round">
            {currentAssistantId && currentAssistantId !== 'new' ? (
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
                <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                  <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                </svg>
                Créer Assistant
              </>
            )}
          </button>

          {currentAssistantId && currentAssistantId !== 'new' && (
            <button onClick={onDeleteAssistant} className="delete-button button button--round">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

export default SettingsPanel
