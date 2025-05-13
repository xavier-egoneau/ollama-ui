export async function execute({ prompt }) {
  try {
    // Remplace les "x" ou "X" par "*" (multiplication)
    const cleaned = prompt.replace(/x/gi, '*');

    // Vérifie que l'expression ne contient que des caractères autorisés
    if (!/^[\d+\-*/().\s]+$/.test(cleaned)) {
      throw new Error("L'expression contient des caractères non autorisés.");
    }

    const result = eval(cleaned);
    return `\`\`\`\nRésultat : ${result}\n\`\`\``;
  } catch (error) {
    return `❌ Erreur de calcul : ${error.message}`;
  }
}