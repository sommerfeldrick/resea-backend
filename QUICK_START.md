# ⚡ Quick Start Guide - Multi-Provider AI System

## 5-Minute Setup

### Step 1: Get API Keys (5 minutes)

| Provider | Link | Limit | Copy & Paste |
|----------|------|-------|--------------|
| **Gemini** | https://aistudio.google.com/app/apikeys | 250 req/day | Key: `AIzaSy...` |
| **Groq** | https://console.groq.com/keys | 30 req/min | Key: `gsk_...` |
| **OpenRouter** | https://openrouter.ai/keys | $5-10 credits | Key: `sk-or-...` |
| **Ollama Cloud** | https://ollama.ai/settings/keys | 1M tokens/day | Key: `...` |

### Step 2: Add to Render (3 minutes)

1. Go to https://dashboard.render.com
2. Click your backend service
3. Click **Environment** tab
4. Click **+ Add Environment Variable**
5. Add these 4 variables:

```
GEMINI_API_KEY          → paste your key here
GROQ_API_KEY            → paste your key here
OPENROUTER_API_KEY      → paste your key here
OLLAMA_API_KEY          → paste your key here
```

6. Click **Save Changes**

### Step 3: Redeploy (3 minutes)

1. Go to **Deploys** tab
2. Click ⋯ on latest deployment
3. Click **Redeploy**
4. Wait 2-5 minutes for deployment

### Step 4: Verify (2 minutes)

```bash
# Check if all providers are working
curl https://your-backend.onrender.com/api/ai/health

# Expected result: all providers show "available": true
```

---

## 🎯 Common Requests

### Generate Text (Simple)
```bash
curl -X POST https://your-backend.onrender.com/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is machine learning?"}'
```

### Generate with Quality Control
```bash
# For research/analysis (highest quality)
curl -X POST https://your-backend.onrender.com/api/ai/generate \
  -d '{"prompt": "...", "quality": "quality"}'

# For quick responses (fastest)
curl -X POST https://your-backend.onrender.com/api/ai/generate \
  -d '{"prompt": "...", "quality": "fast"}'

# Default balanced
curl -X POST https://your-backend.onrender.com/api/ai/generate \
  -d '{"prompt": "..."}'
```

### Check Costs
```bash
curl https://your-backend.onrender.com/api/ai/stats

# All should show: "costToday": 0.00
```

### Monitor Success Rates
```bash
curl https://your-backend.onrender.com/api/ai/health | jq '.providers[] | .rotation.successRate'
```

---

## 🔧 How to Use in Code

### Node.js/Express Example
```typescript
import { generateText, generateTextWithQuality } from './services/ai/aiService.js';

// Simple generation
const response = await generateText('What is AI?');
console.log(response.text);        // The generated text
console.log(response.provider);    // Which provider was used
console.log(response.model);       // Which model was used
console.log(response.cost);        // $0.00 (free tier)

// With quality control
const response2 = await generateTextWithQuality(
  'Write research abstract',
  'quality'  // 'quality' | 'fast' | 'balanced'
);
```

### API Route Example
```typescript
app.post('/api/ai/generate', async (req, res) => {
  const { prompt, quality } = req.body;
  
  try {
    const response = await generateText(prompt, { quality });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🎓 How It Works

```
User Request
    ↓
[AIStrategyRouter]
    ↓
Try Provider 1 (Gemini)
    ├─ Success? → Return response ✓
    └─ Failed/Rate Limited? → Try next
    ↓
Try Provider 2 (Groq)
    ├─ Success? → Return response ✓
    └─ Failed? → Try next
    ↓
Try Provider 3 (OpenRouter)
    ├─ Success? → Return response ✓
    └─ Failed? → Try next
    ↓
Try Provider 4 (Ollama Cloud)
    ├─ Success? → Return response ✓
    └─ Failed? → Error (very unlikely)

All with model rotation based on:
- Success rates
- Quality preference
- Free model availability
```

---

## 💡 Free Tier Limits

| Provider | Daily Limit | Cost |
|----------|-------------|------|
| Gemini | 250 requests | $0.00 |
| Groq | 30 per minute | $0.00 |
| OpenRouter | Limited by $5-10 credits | $0.00 |
| Ollama Cloud | 1M tokens per day | $0.00 |

**You can make ~16,500+ requests/day completely FREE** ✅

---

## ⚠️ Troubleshooting

### Problem: "All providers failed"
1. Check API keys in Render Environment
2. Check `/api/ai/health` endpoint
3. Look for "available": false providers
4. Verify API keys are correct

### Problem: Slow responses
- Use `"quality": "fast"` for instant responses
- Groq (ultra-fast) usually selected automatically

### Problem: Cost showing > $0.00
- Free tier models should cost $0.00
- Check which provider was used in response
- Verify correct API keys in environment

---

## 📱 Monitor Your System

### Create a simple dashboard
```bash
# Every 5 seconds, check system health
watch -n 5 'curl -s https://your-backend.onrender.com/api/ai/health | jq ".providers[] | {provider: .available, successRate: .rotation.successRate}"'
```

### Get real-time stats
```bash
while true; do
  clear
  curl -s https://your-backend.onrender.com/api/ai/stats | jq .
  sleep 5
done
```

---

## 🚀 Next Steps

1. ✅ Deploy to Render (follow this guide)
2. ✅ Test generation endpoint
3. ✅ Monitor costs (should be $0.00)
4. ✅ Check success rates in health endpoint
5. 🔄 Consider rotating API keys monthly

---

## 📚 Full Documentation

- **RENDER_ENVIRONMENT_SETUP.md** - Detailed Render configuration
- **MODEL_SELECTION_STRATEGY.md** - How model selection works
- **MULTI_PROVIDER_AI_COMPLETE.md** - Complete implementation details

---

**You're all set!** 🎉 Your multi-provider AI system is ready to go.

