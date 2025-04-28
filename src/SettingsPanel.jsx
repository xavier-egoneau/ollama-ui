import { useState, useEffect } from 'react'

function SettingsPanel({
    isOpen,
    assistantName,
    setAssistantName,
    systemPrompt,
    setSystemPrompt,
    model,
    setModel,
    onSaveAssistant,         // <<<<<< IMPORTANT
    assistants,
    currentAssistantId,
    onSelectAssistant,
    onDeleteAssistant, // <<<<< ajoute ici
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

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      <h2>Paramètres</h2>

      <label>Choisir un assistant :</label>
      <select value={currentAssistantId} onChange={(e) => onSelectAssistant(e.target.value)}>
        {assistants.map((assistant) => (
          <option key={assistant.id} value={assistant.id}>
            {assistant.name}
          </option>
        ))}
        <option value="new">➕ Ajouter un nouvel assistant</option>
      </select>

      <label>Nom de l'assistant :</label>
      <input
        type="text"
        value={assistantName}
        onChange={(e) => setAssistantName(e.target.value)}
        placeholder="Nom de l'assistant"
      />

      <label>Modèle :</label>
        <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="" disabled>Sélectionnez un modèle</option> {/* 🔥 Option par défaut */}
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

      <label>Prompt système :</label>
      <textarea
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        placeholder="Prompt système"
      />

<button onClick={onSaveAssistant}>
  {currentAssistantId && currentAssistantId !== 'new' ? 'Modifier Assistant' : 'Créer Assistant'}
</button>

{currentAssistantId && currentAssistantId !== 'new' && (
  <button onClick={onDeleteAssistant} style={{ marginTop: '1rem', backgroundColor: 'red', color: 'white' }}>
    🗑️ Supprimer Assistant
  </button>
)}

    </div>
  )
}

export default SettingsPanel
