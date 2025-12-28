Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub Repository Setup fuer isbnhunt" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Schritt 1: Entferne altes Remote..." -ForegroundColor Yellow
git remote remove origin

Write-Host ""
Write-Host "Schritt 2: Fuege neues Remote hinzu..." -ForegroundColor Yellow
git remote add origin https://github.com/coding-horstmann/isbnhunt.git

Write-Host ""
Write-Host "Schritt 3: Pruefe Remote-Konfiguration..." -ForegroundColor Yellow
git remote -v

Write-Host ""
Write-Host "Schritt 4: Stage alle Dateien..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "Schritt 5: Erstelle Commit..." -ForegroundColor Yellow
git commit -m "Initial commit - isbnhunt"

Write-Host ""
Write-Host "Schritt 6: Push zu GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Fertig! Repository ist jetzt verbunden." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

