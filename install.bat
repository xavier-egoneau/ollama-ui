@echo off
echo 🔧 Vérification de Node.js...

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ❌ Node.js n'est pas installé.
  echo Merci d'installer Node.js LTS depuis https://nodejs.org/
  pause
  exit /b
)

echo ✅ Node.js est installé.

echo 📦 Installation des dépendances...
npm install

echo 🚀 Lancement de l'application...
npm run dev

pause
