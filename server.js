import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = 3001;
const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads');

app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// 📸 Route d’upload image
app.post('/upload', (req, res) => {
  try {
    const base64Data = req.body.base64;
    const match = base64Data.match(/^data:image\/png;base64,(.+)$/);
    if (!match) return res.status(400).send('Format base64 invalide');

    const filename = `image-${Date.now()}.png`;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[1], 'base64'));

    res.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error('[UPLOAD] Erreur :', err);
    res.status(500).send('Erreur serveur');
  }
});

// (Optionnel) Ping santé Ollama
app.get('/ping-ollama', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434');
    if (response.ok) return res.send('✅ Ollama prêt');
    throw new Error();
  } catch {
    res.status(503).send('❌ Ollama non disponible');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur unifié dispo sur http://localhost:${PORT}`);
});