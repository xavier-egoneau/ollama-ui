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

export function buildAgentInstructionPrompt(agentConfigs, assistantAgentOverrides = {}) {
  const active = [];
  const inactive = [];

  for (const [id, cfg] of Object.entries(agentConfigs)) {
    const override = assistantAgentOverrides[id];
    const enabled = override?.enabled ?? (cfg.enabledByDefault !== false);
    const label = `- \`--${id}\` : ${cfg.description}`;

    if (enabled) {
      const full = cfg.systemInstructions ? `${label}\n\n${cfg.systemInstructions}` : label;
      active.push(full);
    } else {
      inactive.push(label);
    }
  }

  let result = `Tu es un assistant intelligent avec des outils internes. Voici les outils disponibles :\n\n${active.join('\n\n')}`;

  if (inactive.length > 0) {
    result += `\n\n---\n\nLes outils suivants existent mais sont actuellement désactivés. Tu peux les proposer si l'utilisateur souhaite les activer :\n\n${inactive.join('\n')}`;
  }

  return result.trim();
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
