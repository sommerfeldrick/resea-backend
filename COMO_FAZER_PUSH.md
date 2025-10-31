# 🚀 Instruções para Commit e Push

## Abra um NOVO terminal e execute:

```bash
cd /Users/usuario/Documents/projetos/resea-backend

git add src/routes/search.ts src/server.ts PHASE1_COMPLETE.md

git commit -m "feat: Complete Phase 1 automation"

git push origin main
```

## Ou execute o script Python:

```bash
python3 /Users/usuario/Documents/projetos/resea-backend/git_push.py
```

---

## ✅ Arquivos que serão commitados:

1. **src/routes/search.ts** - Query expansion automática
2. **src/server.ts** - Incremental indexing auto-start
3. **PHASE1_COMPLETE.md** - Documentação completa

---

## 🎯 Mensagem do commit:
```
feat: Complete Phase 1 automation - query expansion and incremental indexing

- Query expansion agora é automática em todas as buscas /hybrid
- Incremental indexing inicia automaticamente quando servidor sobe
- Graceful shutdown para parar sync corretamente
- Documentação completa em PHASE1_COMPLETE.md
```

---

## 🔧 Se o terminal estiver travado:

1. Pressione `Ctrl+C` para cancelar
2. Feche o terminal atual
3. Abra um NOVO terminal
4. Execute os comandos acima

---

## ✅ Após o push:

O código estará no GitHub e pronto para deploy no Render! 🚀
