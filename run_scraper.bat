@echo off
title carreemploie - Collecte locale (LinkedIn Bypass)
chcp 65001 > nul
echo ==========================================================
echo 🕵️‍♂️ carréemploie - Lancement de la collecte locale
echo ==========================================================
echo.
echo Ce script va exécuter le robot de collecte depuis votre propre
echo connexion internet pour éviter que LinkedIn ne bloque les serveurs.
echo.
echo PRÉREQUIS : Vous devez avoir installé Node.js sur votre PC.
echo.
echo ⏳ Analyse et synchronisation en cours...
echo.
node backend/scraper.js
echo.
echo ==========================================================
echo ✅ Collecte terminée ! Les offres sont synchronisées sur le site.
echo ==========================================================
echo.
pause
