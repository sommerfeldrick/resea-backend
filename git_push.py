#!/usr/bin/env python3
import subprocess
import os

os.chdir('/Users/usuario/Documents/projetos/resea-backend')

# Add files
subprocess.run(['git', 'add', 'src/routes/search.ts', 'src/server.ts', 'PHASE1_COMPLETE.md'])

# Commit
subprocess.run(['git', 'commit', '-m', 'feat: Complete Phase 1 automation'])

# Push
subprocess.run(['git', 'push', 'origin', 'main'])

print("✅ Commit e push concluídos!")
