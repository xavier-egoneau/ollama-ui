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
    ([id, cfg]) => `- --${id} : ${cfg.description}`
  );

  return `\n\nTu peux utiliser les agents suivants en insérant une ligne comme :\n\n--[Nom de l'agent] [Ton prompt] \n\nExemple d'utilisation: \n\n--image un panda dans la neige\n\nAgents disponibles :\n${lines.join('\n')}`;

}

export async function executeAgent(agentId, prompt, config) {
  try {
    const module = await import(`./agents/${agentId}.js`);
    const execute = module.execute;
    if (typeof execute !== 'function') {
      throw new Error(`Agent ${agentId} ne contient pas de fonction exportée 'execute'`);
    }
    let result = await execute({ prompt });

    if (config.outputType === 'image') {
      // Ajoute le préfixe manquant si nécessaire (corrige aussi le cas vide)
      if (!result || result.trim() === '') {
        return '❌ Aucun contenu image généré';
      }
      if (!result.startsWith('data:image/')) {
        result = `data:image/png;base64,${result}`;
      }
      console.log(`[router] Résultat image injecté :`, result.slice(0, 50) + '...');
      return `![image générée](${result})`;
    }

    return result;
  } catch (error) {
    console.error(`Erreur dans l'agent ${agentId} :`, error);
    return `❌ Erreur dans l'agent ${agentId}`;
  }
}