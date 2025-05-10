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
        <ul>
          {[...new Map(assistantDocuments.map(doc => [typeof doc === 'object' ? doc.id : doc, doc])).values()].map((doc, idx) => {

            const label = typeof doc === 'object' && doc !== null
              ? doc.name || `Document ${doc.id}`
              : `Document ID: ${doc}`
            return <li key={idx}>{label}</li>
          })}
        </ul>

      </div>

      <button onClick={onSaveAssistant} className="save-button">
        {currentAssistantId && currentAssistantId !== 'new' ? 'Modifier Assistant' : 'Créer Assistant'}
      </button>

      {currentAssistantId && currentAssistantId !== 'new' && (
        <button onClick={onDeleteAssistant} className="delete-button">
          🗑️ Supprimer Assistant
        </button>
      )}
    </div>
  )
}

export default SettingsPanel
