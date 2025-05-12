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

export async function generateImage(prompt) {
  try {
    console.log('[generateImage] Prompt envoyé :', prompt);

    const response = await fetch('http://127.0.0.1:7860/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: "blurry, distorted, low quality, bad anatomy, watermark, text, logo",
        steps: 30,
        cfg_scale: 7,
        sampler_index: "DPM++ 2M Karras",
        width: 768,
        height: 768,
        seed: -1, // ou une valeur fixe pour du déterminisme
        restore_faces: false,
        tiling: false,
        enable_hr: false,
      }),
    });

    if (!response.ok) {
      console.error('[generateImage] Erreur HTTP :', response.status, response.statusText);
      return '';
    }

    const data = await response.json();
    console.log('[generateImage] Réponse reçue :', data);

    const base64Image = data.images?.[0];
    if (!base64Image) {
      console.warn('[generateImage] Aucune image générée dans la réponse');
      return '';
    }

    return `data:image/png;base64,${base64Image}`;
  } catch (err) {
    console.error('Erreur dans generateImage:', err);
    return '';
  }
}
