@echo off
echo ========================================
echo GitHub Repository Setup fuer isbnhunt
echo ========================================
echo.

echo Schritt 1: Entferne altes Remote...
git remote remove origin

echo.
echo Schritt 2: Fuege neues Remote hinzu...
git remote add origin https://github.com/coding-horstmann/isbnhunt.git

echo.
echo Schritt 3: Pruefe Remote-Konfiguration...
git remote -v

echo.
echo Schritt 4: Stage alle Dateien...
git add .

echo.
echo Schritt 5: Erstelle Commit...
git commit -m "Initial commit - isbnhunt"

echo.
echo Schritt 6: Push zu GitHub...
git push -u origin main

echo.
echo ========================================
echo Fertig! Repository ist jetzt verbunden.
echo ========================================
pause

