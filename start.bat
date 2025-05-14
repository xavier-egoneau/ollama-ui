@echo off
echo ===============================
echo 📦 Démarrage Assistant IA local
echo ===============================

REM Ouvrir le navigateur automatiquement (si tu veux)
start "" http://localhost:5173

REM Lancer Vite (React UI)
start cmd /k "cd /d %~dp0 && npm run dev"

REM Lancer serveur Express (uploads)
start cmd /k "cd /d %~dp0 && npm run server"

REM Lancer Stable Diffusion AUTOMATIC1111 (adapté à ton chemin)
cd /d "..\stable-diffusion-webui"
start cmd /k "webui-user.bat"

REM 🔁 Démarre Ollama (si installé)
start "" /min cmd /c "ollama serve"

echo ===============================
echo ✅ Tous les services sont lancés !
echo ===============================