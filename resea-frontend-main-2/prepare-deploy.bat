@echo off
REM ========================================
REM Resea AI - Deployment Preparation Script (Windows)
REM ========================================
REM Este script prepara o aplicativo para deploy no Hostinger
REM Cria ZIPs otimizados do backend e frontend

setlocal enabledelayedexpansion

echo.
echo ================================
echo Resea AI - Preparacao para Deploy
echo ================================
echo.

REM ========================================
REM 1. Verificacoes Iniciais
REM ========================================

echo [1/6] Verificando estrutura do projeto...

if not exist "backend" (
    echo [ERRO] Pasta 'backend' nao encontrada!
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERRO] package.json do frontend nao encontrado!
    pause
    exit /b 1
)

echo [OK] Estrutura do projeto OK
echo.

REM ========================================
REM 2. Preparar Backend
REM ========================================

echo [2/6] Preparando Backend...
cd backend

if not exist "node_modules" (
    echo [INFO] Instalando dependencias do backend...
    call npm install
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias do backend
        cd ..
        pause
        exit /b 1
    )
)

echo [INFO] Compilando TypeScript...
call npm run build
if errorlevel 1 (
    echo [ERRO] Build do backend falhou!
    cd ..
    pause
    exit /b 1
)

if not exist "dist" (
    echo [ERRO] Pasta 'dist' nao foi criada!
    cd ..
    pause
    exit /b 1
)

echo [OK] Backend compilado com sucesso
cd ..
echo.

REM ========================================
REM 3. Preparar Frontend
REM ========================================

echo [3/6] Preparando Frontend...

if not exist "node_modules" (
    echo [INFO] Instalando dependencias do frontend...
    call npm install
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias do frontend
        pause
        exit /b 1
    )
)

echo [INFO] Compilando Frontend (Vite)...
call npm run build
if errorlevel 1 (
    echo [ERRO] Build do frontend falhou!
    pause
    exit /b 1
)

if not exist "dist" (
    echo [ERRO] Pasta 'dist' do frontend nao foi criada!
    pause
    exit /b 1
)

echo [OK] Frontend compilado com sucesso
echo.

REM ========================================
REM 4. Verificar 7-Zip
REM ========================================

echo [4/6] Verificando compactador...

where 7z >nul 2>&1
if errorlevel 1 (
    echo [AVISO] 7-Zip nao encontrado!
    echo.
    echo Por favor, crie os ZIPs manualmente:
    echo 1. Compacte a pasta backend/ como backend.zip
    echo 2. Compacte a pasta dist/ como frontend.zip
    echo.
    pause
    exit /b 0
)

echo [OK] 7-Zip encontrado
echo.

REM ========================================
REM 5. Criar ZIPs
REM ========================================

echo [5/6] Criando arquivos ZIP...

if not exist "deploy-package" mkdir deploy-package

echo [INFO] Criando backend.zip...
cd backend
7z a -tzip ..\deploy-package\backend.zip dist node_modules package.json package-lock.json .env.example -xr!*.log -xr!*.env -xr!node_modules\.cache >nul
cd ..

echo [INFO] Criando frontend.zip...
7z a -tzip deploy-package\frontend.zip dist package.json .env.example -xr!*.log -xr!*.env >nul

echo [INFO] Criando docs.zip...
7z a -tzip deploy-package\docs.zip README.md QUICKSTART.md INTEGRATION_COMPLETE.md NOVAS_FEATURES.md GUIA_API_GRATIS.md INSTALL_VIA_HOSTINGER_FILE_MANAGER.md >nul

echo [OK] ZIPs criados em .\deploy-package\
echo.

REM ========================================
REM 6. Estatisticas
REM ========================================

echo [6/6] Estatisticas dos Pacotes:
echo.

for %%f in (deploy-package\*.zip) do (
    set size=0
    for /f "tokens=*" %%s in ('powershell -command "(Get-Item '%%f').Length / 1MB"') do set size=%%s
    echo   %%~nxf: !size! MB
)

echo.
echo ================================
echo PREPARACAO COMPLETA!
echo ================================
echo.
echo Proximos passos:
echo.
echo 1. Acesse o Gerenciador de Arquivos do Hostinger
echo    URL: https://hpanel.hostinger.com/file-manager
echo.
echo 2. Navegue ate:
echo    /domains/app.smileai.com.br/public_html/
echo.
echo 3. Faca upload dos ZIPs:
echo    - backend.zip  (pasta raiz)
echo    - frontend.zip (pasta raiz)
echo.
echo 4. Extraia os ZIPs no Hostinger
echo.
echo 5. Configure o .env do backend (copie .env.example)
echo.
echo 6. Via SSH, instale dependencias:
echo    cd /domains/app.smileai.com.br/public_html/backend
echo    npm install --production
echo.
echo 7. Inicie o backend com PM2:
echo    pm2 start dist/server.js --name resea-backend
echo.
echo Arquivos criados em: .\deploy-package\
echo.
echo Leia: INSTALL_VIA_HOSTINGER_FILE_MANAGER.md para detalhes
echo.
pause
