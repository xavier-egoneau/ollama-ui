export async function sendPromptToOllama(prompt, systemPrompt = '', model = 'mistral') {
  try {
    const lowerModel = model.toLowerCase();

    const messages = [];

    // Pour des modèles simples comme gemma, ne pas envoyer un system prompt
    if (lowerModel.includes('mistral') || lowerModel.includes('llama')) {
      if (systemPrompt.trim() !== '') {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });
    } else {
      // Pour des modèles non "chat" comme gemma3, envoyer juste l'utilisateur
      messages.push({ role: 'user', content: prompt });
    }

    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur de communication avec Ollama');
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    console.error('Erreur:', error);
    return 'Erreur lors de l\'envoi à Ollama.';
  }
}
