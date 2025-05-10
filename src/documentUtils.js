// documentUtils.js

// Extraire le texte depuis une URL de document (par exemple .txt)
export async function extractTextFromDocument(documentUrl) {
  try {
    const response = await fetch(documentUrl);
    if (!response.ok) throw new Error('Erreur lors de la récupération du document');
    const text = await response.text();
    return text;
  } catch (error) {
    console.error("Erreur lors de l'extraction du document :", error);
    return null;
  }
}

// Lire le texte d’un fichier local uploadé par l’utilisateur
export function readTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsText(file);
  });
}

// Fonction pour générer un résumé (optionnel) — à personnaliser avec un modèle plus avancé
export function summarizeText(text, maxLength = 2000) {
  return text.length > maxLength ? text.slice(0, maxLength) + "\n..." : text;
}
