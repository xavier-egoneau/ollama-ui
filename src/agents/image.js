import { sendPromptToOllama } from '../api.js';

async function translateToEnglish(text) {
  const systemPrompt = "Translate the following prompt into fluent, descriptive English for image generation. Do not explain, just return the translated prompt.";
  const translated = await sendPromptToOllama(text, systemPrompt, 'gemma3:4b');
  return translated.trim();
}

export async function execute({ prompt }) {
  try {
    const translatedPrompt = await translateToEnglish(prompt);

    const response = await fetch('http://127.0.0.1:7860/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: translatedPrompt,
        negative_prompt: "blurry, distorted, low quality, bad anatomy, watermark, text, logo",
        steps: 30,
        cfg_scale: 7,
        sampler_index: "DPM++ 2M Karras",
        width: 512,//768
        height: 512,//768
        seed: -1,
        restore_faces: false,
        tiling: false,
        enable_hr: false,
      }),
    });

    if (!response.ok) return '';

    const data = await response.json();
    return data.images?.[0] || '';
  } catch (err) {
    console.error('[agent:image] Erreur :', err);
    return '';
  }
}
