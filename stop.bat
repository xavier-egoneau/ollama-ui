@echo off

echo ===============================
echo 📦 stop ollama
echo ===============================
echo Tentative d'arrêt de Ollama...
powershell -Command "Stop-Process -Name 'ollama' -Force"
echo Ollama est arrêté.
pause