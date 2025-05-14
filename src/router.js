// router.js compatible navigateur (corrigé pour ajouter buildAgentInstructionPrompt)
import agentConfigs from './agents.config.json'

export async function loadAgentConfigs() {
  return agentConfigs;
}

export function extractAgentCommands(text) {
  const regex = /--(\w+)\s+([^\n]+)/g;
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({ agentId: match[1], prompt: match[2], raw: match[0] });
  }

  return matches;
}

export function buildAgentInstructionPrompt(agentConfigs) {
  const lines = Object.entries(agentConfigs).map(
    ([id, cfg]) => `- \`--${id}\` : ${cfg.description}`
  );

  return `
Tu es un assistant intelligent avec des outils internes que tu peux activer si besoin.

Voici les outils disponibles :
${lines.join('\n')}

---

### 🧮 Pour \`--calc\` :
Utilise-le uniquement si tu veux effectuer un calcul. Exemple :
\`\`\`
--calc 7 * (3 + 1)
\`\`\`

---

### 🎨 Pour \`--image\` :

Tu peux générer une image à partir d'une description visuelle précise.  
Un bon prompt pour une image doit idéalement contenir :

- ✅ Un sujet principal (ex : un chat, un paysage, une scène…)
- ✅ Un style (ex : photoréaliste, Ghibli, peinture à l’huile, manga…)
- ✅ Un décor ou une ambiance (ex : forêt enchantée, salon haussmannien…)
- ✅ Une lumière (ex : dorée, tamisée, contre-jour, néon…)
- ✅ Des détails visuels (ex : ultra détaillé, flou artistique, 8K…)

🧠 Tu peux réfléchir à ces éléments pour enrichir ton idée, mais au final tu dois **écrire une seule ligne propre** comme ceci :

\`\`\`
--image [description complète et détaillée]
\`\`\`

---

#### ✅ Exemples corrects :

✔️
\`\`\`
--image un panda en armure dans une forêt de bambous, style Ghibli, lumière dorée, ultra détaillé
\`\`\`

✔️
\`\`\`
--image une ville futuriste vue du ciel, style synthwave, lumière rose et bleue, gratte-ciels lumineux
\`\`\`

✔️
\`\`\`
--image un chat blanc sur un coussin rouge dans un salon haussmannien, style réaliste, lumière du matin
\`\`\`

---

❌ Ne copie jamais "Sujet :", "Style :", etc. dans ta réponse.  
✅ Commence directement par \`--image\` suivi de ton prompt complet.
`.trim();
}




export async function executeAgent(agentId, prompt, config) {
  try {
    const module = await import(`./agents/${agentId}.js`);
    const execute = module.execute;
    if (typeof execute !== 'function') {
      throw new Error(`Agent ${agentId} ne contient pas de fonction exportée 'execute'`);
    }

    let result = await execute({ prompt });

    // 📦 Si l'agent retourne une image
    if (config.outputType === 'image') {
      if (!result || result.trim() === '') {
        return '❌ Aucun contenu image généré';
      }

      // ✅ Cas 1 : agent retourne déjà une balise Markdown image complète
      if (result.includes('![image générée](')) {
        return result;
      }

      // ✅ Cas 2 : base64 ou URL brute → on wrappe proprement
      if (result.startsWith('data:image/') || result.startsWith('/uploads/')) {
        return `![image générée](${result})`;
      }

      // ❌ Si rien ne matche : erreur
      return '❌ Format image inconnu';
    }

    // ✏️ Pour tous les autres types d'agents : retour brut
    return result;

  } catch (error) {
    console.error(`Erreur dans l'agent ${agentId} :`, error);
    return `❌ Erreur dans l'agent ${agentId}`;
  }
}
