export async function sendPromptToOllama(prompt, systemPrompt = '', model = 'mistral', stream = false) {
  try {
    const lowerModel = model.toLowerCase();

    const messages = [];

   if (systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const t0 = performance.now();
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream
      }),
    });

    const t1 = performance.now();
    console.log(`⏱️ [Ollama] Temps de réponse HTTP (${model}) : ${Math.round(t1 - t0)} ms`);

    if (!response.ok) throw new Error('Erreur de communication avec Ollama');

    if (!stream) {
      const json = await response.json();
      return json.message?.content || '';
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let partial = '';
      let output = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        partial += decoder.decode(value, { stream: true });
        const lines = partial.split('\n').filter(Boolean);
        partial = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.replace('data: ', '');
          try {
            const json = JSON.parse(jsonStr);
            const token = json.message?.content || '';
            output += token;
          } catch (err) {
            console.warn('[stream invalid]', jsonStr);
          }
        }
      }

      return output;
    }
  } catch (error) {
    console.error('[sendPromptToOllama] Erreur :', error);
    return '❌ Erreur lors de l’envoi à Ollama.';
  }
}

export async function summarizeDocument(text, model = 'mistral') {
  const systemPrompt = `
Tu es un assistant chargé de résumer un document. Fournis un résumé concis, structuré, clair et fidèle au contenu.
- Ne dépasse pas 300 mots
- Ne donne pas d’opinion
- Utilise un ton neutre
  `.trim();

  try {
    console.log('[summarizeDocument] 📄 Résumé lancé avec modèle :', model);
    const t0 = performance.now();

    const summary = await sendPromptToOllama(text, systemPrompt, model);

    const t1 = performance.now();
    console.log(`⏱️ [summarizeDocument] Terminé en ${Math.round(t1 - t0)} ms`);
    return summary.trim();
  } catch (err) {
    console.error('[summarizeDocument] ❌ Erreur :', err);
    return '';
  }
}


export async function generateImage(prompt) {
  try {
    const payload = {
      prompt,
      negative_prompt: "blurry, distorted, low quality, bad anatomy, watermark, text, logo",
      steps: 30,
      cfg_scale: 7,
      sampler_index: "DPM++ 2M Karras",
      width: 768,
      height: 768,
      seed: -1,
      restore_faces: false,
      tiling: false,
      enable_hr: false,
    };

    console.log('[generateImage] 🎨 Prompt envoyé :', prompt);
    const t0 = performance.now();

    const response = await fetch('http://127.0.0.1:7860/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const t1 = performance.now();
    console.log(`⏱️ [generateImage] Image générée en ${Math.round(t1 - t0)} ms`);

    if (!response.ok) {
      console.error('[generateImage] ❌ Erreur HTTP :', response.status, response.statusText);
      return '';
    }

    const data = await response.json();
    const base64Image = data.images?.[0];

    if (!base64Image) {
      console.warn('[generateImage] ⚠️ Aucune image générée dans la réponse');
      return '';
    }

    return `data:image/png;base64,${base64Image}`;
  } catch (err) {
    console.error('[generateImage] 🚨 Erreur :', err);
    return '';
  }
}
