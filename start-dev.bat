@echo off
chcp 65001 > nul
title Hotelio Dev

echo ======================================
echo   Hotelio - Demarrage environnement
echo ======================================
echo.

:: Verifier que XAMPP MySQL tourne (port 3306)
netstat -an | find ":3306" | find "LISTENING" > nul 2>&1
if errorlevel 1 (
  echo [!] MySQL n'est pas detecte sur le port 3306.
  echo     Demarrez XAMPP et activez MySQL avant de continuer.
  echo.
  pause
  exit /b 1
)
echo [1/3] MySQL detecte ^(port 3306^) ^✓

:: Demarrer le backend dans une nouvelle fenetre
echo [2/3] Demarrage du backend Node.js...
start "Hotelio Backend :3000" cmd /k "cd /d %~dp0backend && node server.js"
timeout /t 2 /nobreak > nul

:: Verifier que le port 3000 est ouvert
netstat -an | find ":3000" | find "LISTENING" > nul 2>&1
if errorlevel 1 (
  echo     En attente du backend...
  timeout /t 3 /nobreak > nul
)
echo     Backend demarre ^✓

:: Demarrer Expo dans une nouvelle fenetre
echo [3/3] Demarrage d'Expo...
start "Hotelio Expo" cmd /k "cd /d %~dp0 && npx expo start"

echo.
echo ======================================
echo   Tout est lance !
echo   Backend : http://192.168.1.68:3001
echo   Scannez le QR code dans Expo Go
echo ======================================
echo.
echo (Fermez cette fenetre quand vous avez termine)
pause
