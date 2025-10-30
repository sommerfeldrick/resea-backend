#!/bin/bash
# ============================================================
# Deploy Commands - Resea AI Research Assistant
# Hostinger VPS - app.smileai.com.br
# ============================================================

set -e  # Exit on error

echo "🚀 Starting deployment to Hostinger VPS..."

# ============================================================
# 1. PREPARAR VPS
# ============================================================

echo "📦 Step 1: Installing system dependencies..."

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Instalar Nginx
sudo apt install -y nginx

# Instalar PM2
sudo npm install -g pm2

# Instalar Git
sudo apt install -y git

# Instalar Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

echo "✅ System dependencies installed!"

# ============================================================
# 2. CRIAR ESTRUTURA DE DIRETÓRIOS
# ============================================================

echo "📁 Step 2: Creating directory structure..."

sudo mkdir -p /var/www/app.smileai.com.br
sudo mkdir -p /var/www/app.smileai.com.br/backend
sudo mkdir -p /var/www/app.smileai.com.br/frontend
sudo mkdir -p /var/www/app.smileai.com.br/scripts
sudo mkdir -p /var/www/app.smileai.com.br/dist
sudo mkdir -p /var/backups/resea

# Dar permissões
sudo chown -R $USER:$USER /var/www/app.smileai.com.br

echo "✅ Directory structure created!"

# ============================================================
# 3. CLONAR CÓDIGO (ou fazer upload manual)
# ============================================================

echo "📥 Step 3: Downloading application code..."

cd /var/www/app.smileai.com.br

# Opção 1: Se tiver repositório Git
# git clone https://github.com/seu-usuario/resea-ai.git .

# Opção 2: Upload manual via FTP/SFTP
# (pule esta etapa se já fez upload)

echo "✅ Code downloaded!"

# ============================================================
# 4. CONFIGURAR BACKEND
# ============================================================

echo "⚙️ Step 4: Configuring backend..."

cd /var/www/app.smileai.com.br/backend

# Instalar dependências
npm install --production

# Criar arquivo .env
cat > .env << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.smileai.com.br

# API Keys
GEMINI_API_KEY=SUBSTITUA_PELA_SUA_CHAVE

# SSO Integration
MAIN_DOMAIN_API=https://smileai.com.br/api
SSO_SECRET=SUBSTITUA_PELA_CHAVE_SECRETA

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Cache
REDIS_ENABLED=false
EOF

echo "⚠️  IMPORTANTE: Edite /var/www/app.smileai.com.br/backend/.env"
echo "⚠️  e substitua GEMINI_API_KEY e SSO_SECRET!"
echo ""
read -p "Pressione ENTER após editar o .env..."

# Build backend
npm run build

echo "✅ Backend configured!"

# ============================================================
# 5. CONFIGURAR FRONTEND
# ============================================================

echo "⚙️ Step 5: Configuring frontend..."

cd /var/www/app.smileai.com.br

# Instalar dependências
npm install

# Criar .env
cat > .env << 'EOF'
VITE_API_URL=https://app.smileai.com.br/api
VITE_MAIN_DOMAIN=https://smileai.com.br
VITE_SSO_ENABLED=true
EOF

# Build frontend
npm run build

# Copiar build para dist
cp -r dist/* /var/www/app.smileai.com.br/dist/

echo "✅ Frontend configured!"

# ============================================================
# 6. CONFIGURAR NGINX
# ============================================================

echo "🌐 Step 6: Configuring Nginx..."

sudo cat > /etc/nginx/sites-available/app.smileai.com.br << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name app.smileai.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.smileai.com.br;

    # SSL Configuration (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/app.smileai.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.smileai.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    root /var/www/app.smileai.com.br/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for streaming
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Logs
    access_log /var/log/nginx/app.smileai.access.log;
    error_log /var/log/nginx/app.smileai.error.log;
}
EOF

# Criar link simbólico
sudo ln -sf /etc/nginx/sites-available/app.smileai.com.br /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx

echo "✅ Nginx configured!"

# ============================================================
# 7. CONFIGURAR SSL (Let's Encrypt)
# ============================================================

echo "🔒 Step 7: Configuring SSL..."

sudo certbot --nginx -d app.smileai.com.br --non-interactive --agree-tos --email seu@email.com

# Testar renovação automática
sudo certbot renew --dry-run

echo "✅ SSL configured!"

# ============================================================
# 8. CONFIGURAR PM2
# ============================================================

echo "🔧 Step 8: Configuring PM2..."

cd /var/www/app.smileai.com.br/backend

# Criar ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'resea-backend',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false
  }]
};
EOF

# Criar diretório de logs
mkdir -p logs

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save

# Configurar para iniciar no boot
pm2 startup
# Execute o comando que o PM2 mostrar

echo "✅ PM2 configured!"

# ============================================================
# 9. CONFIGURAR FIREWALL
# ============================================================

echo "🛡️ Step 9: Configuring firewall..."

sudo apt install -y ufw

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

sudo ufw --force enable

echo "✅ Firewall configured!"

# ============================================================
# 10. CRIAR SCRIPTS DE MANUTENÇÃO
# ============================================================

echo "📝 Step 10: Creating maintenance scripts..."

# Deploy script
cat > /var/www/app.smileai.com.br/scripts/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd /var/www/app.smileai.com.br

# Pull latest code
# git pull origin main

# Backend
echo "📦 Building backend..."
cd backend
npm install --production
npm run build

# Frontend
echo "🎨 Building frontend..."
cd ..
npm install
npm run build
cp -r dist/* /var/www/app.smileai.com.br/dist/

# Restart
echo "🔄 Restarting backend..."
pm2 restart resea-backend

echo "✅ Deployment completed!"
EOF

chmod +x /var/www/app.smileai.com.br/scripts/deploy.sh

# Backup script
cat > /var/www/app.smileai.com.br/scripts/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/resea"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup code
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /var/www/app.smileai.com.br --exclude=node_modules

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/www/app.smileai.com.br/backend/logs

# Keep only last 7 backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_DIR"
EOF

chmod +x /var/www/app.smileai.com.br/scripts/backup.sh

# Agendar backup diário
(crontab -l 2>/dev/null; echo "0 3 * * * /var/www/app.smileai.com.br/scripts/backup.sh") | crontab -

echo "✅ Maintenance scripts created!"

# ============================================================
# 11. VERIFICAÇÕES FINAIS
# ============================================================

echo ""
echo "🧪 Running final checks..."
echo ""

# Check Nginx
echo "Nginx status:"
sudo systemctl status nginx --no-pager | grep Active

# Check PM2
echo ""
echo "PM2 status:"
pm2 status

# Check SSL
echo ""
echo "SSL certificate:"
sudo certbot certificates | grep app.smileai.com.br

# Check firewall
echo ""
echo "Firewall status:"
sudo ufw status

echo ""
echo "============================================================"
echo "✅ DEPLOYMENT COMPLETED!"
echo "============================================================"
echo ""
echo "🌐 Your app is now running at: https://app.smileai.com.br"
echo ""
echo "📊 Next steps:"
echo "1. Teste o site: https://app.smileai.com.br"
echo "2. Verifique logs: pm2 logs resea-backend"
echo "3. Monitore: pm2 monit"
echo ""
echo "📚 Useful commands:"
echo "  pm2 status                    - Check backend status"
echo "  pm2 logs resea-backend        - View logs"
echo "  pm2 restart resea-backend     - Restart backend"
echo "  sudo nginx -t                 - Test Nginx config"
echo "  sudo systemctl reload nginx   - Reload Nginx"
echo "  sudo certbot renew            - Renew SSL"
echo ""
echo "🔄 To deploy updates:"
echo "  /var/www/app.smileai.com.br/scripts/deploy.sh"
echo ""
echo "💾 To backup:"
echo "  /var/www/app.smileai.com.br/scripts/backup.sh"
echo ""
echo "============================================================"
