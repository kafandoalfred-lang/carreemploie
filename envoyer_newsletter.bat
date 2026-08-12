@echo off
title carreemploie - Campagne d'Emailing Marketing
chcp 65001 > nul
echo ==========================================================
echo 📨 carréemploie - Envoi de la Newsletter Marketing
echo ==========================================================
echo.
echo Ce script va envoyer le message rédigé dans le fichier
echo "backend/newsletter.txt" à tous les inscrits du site.
echo.
echo Consignes :
echo 1. Ouvrez le fichier "backend/newsletter.txt" dans le Bloc-notes.
echo 2. La PREMIÈRE LIGNE de ce fichier correspond au SUJET de l'email.
echo 3. Le RESTE du texte correspond au MESSAGE (vous pouvez utiliser [Nom]).
echo 4. Sauvegardez le fichier avant de continuer.
echo.
echo Appuyez sur une touche pour démarrer l'envoi de la campagne...
pause > nul
echo.
echo ⏳ Envoi en cours...
echo.

set NODE_BIN=node
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set NODE_BIN="C:\Program Files\nodejs\node.exe"
    ) else (
        echo [ERREUR] Node.js n'est pas détecté. Veuillez l'installer depuis https://nodejs.org
        pause
        exit /b
    )
)

%NODE_BIN% backend/send_newsletter.js
echo.
echo ==========================================================
echo ✅ Envoi terminé !
echo ==========================================================
echo.
pause
