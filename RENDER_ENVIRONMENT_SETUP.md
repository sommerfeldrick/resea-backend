# 🚀 Render Environment Setup Guide

## Overview

This guide explains how to configure the multi-provider AI system on Render with secure API key management. Your backend will automatically rotate between 4 AI providers (Gemini, Groq, OpenRouter, Ollama Cloud) for optimal performance and reliability.

---

## 📋 Required Environment Variables

Add these environment variables to your Render service dashboard:

### 1. **Google Gemini API**
- **Variable**: `GEMINI_API_KEY`
- **Value**: Your Google Gemini API key
- **Free Tier**: 250 requests/day, 1M tokens/day
- **Get Key**: https://aistudio.google.com/app/apikeys

### 2. **Groq API**
- **Variable**: `GROQ_API_KEY`
- **Value**: Your Groq API key
- **Free Tier**: 30 requests/minute, 100k tokens/day
- **Speed**: Ultra-fast (276 tokens/sec)
- **Get Key**: https://console.groq.com/keys

### 3. **OpenRouter API**
- **Variable**: `OPENROUTER_API_KEY`
- **Value**: Your OpenRouter API key
- **Free Tier**: $5-10 in free credits
- **Flexibility**: Access to multiple models
- **Get Key**: https://openrouter.ai/keys

### 4. **Ollama Cloud API**
- **Variable**: `OLLAMA_API_KEY`
- **Value**: Your Ollama Cloud API key
- **Free Tier**: 1M tokens/day
- **Important**: Must be cloud-based (not local)
- **Get Key**: https://ollama.ai/settings/keys

### 5. **Optional: Specific Provider Configuration**

```env
# Force use of specific providers (default: all enabled)
ENABLED_PROVIDERS=gemini,groq,openrouter,ollama

# Force specific models (uses free models if not set)
GEMINI_MODEL=gemini-2.0-flash-exp
GROQ_MODEL=llama-3.1-70b-versatile
OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct:free
OLLAMA_MODEL=mistral

# Fallback priority order
PROVIDER_FALLBACK_ORDER=gemini,groq,openrouter,ollama
```

---

## 🔐 How to Add Environment Variables to Render

### **Step 1: Go to Your Service Dashboard**

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click on your backend service (e.g., "resea-backend")
3. Click the **"Environment"** tab in the left sidebar

### **Step 2: Add Each API Key**

1. Click **"+ Add Environment Variable"** button
2. Enter the variable name (e.g., `GEMINI_API_KEY`)
3. Paste the API key value
4. Click **"Save Changes"**

### **Step 3: Verify Environment Variables**

- Your variables appear in the Environment tab
- **Important**: Values are masked for security (shown as `●●●●●`)
- Render automatically passes them to your application

### **Step 4: Redeploy Your Service**

1. Go to the **"Deploys"** tab
2. Click the **three-dot menu** (⋯) on the latest deployment
3. Select **"Redeploy"**
4. Wait for the deployment to complete (usually 2-5 minutes)

---

## ✅ Verification Checklist

After deployment, verify the system works:

### **Check 1: Health Endpoint**

```bash
curl https://your-backend-url.onrender.com/api/ai/health
```

Expected response:
```json
{
  "healthy": true,
  "providers": {
    "gemini": {
      "available": true,
      "enabled": true,
      "rotation": {
        "successRate": "100%",
        "model": "gemini-2.0-flash-exp"
      }
    },
    "groq": {
      "available": true,
      "enabled": true,
      "rotation": {
        "successRate": "100%",
        "model": "llama-3.1-70b-versatile"
      }
    },
    "openrouter": { ... },
    "ollama": { ... }
  },
  "stats": { ... },
  "timestamp": "2024-..."
}
```

### **Check 2: Generate Text**

```bash
curl -X POST https://your-backend-url.onrender.com/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is 2+2?",
    "provider": "auto"
  }'
```

Expected response:
```json
{
  "text": "2 + 2 = 4",
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp",
  "tokensUsed": 45,
  "cost": 0.000000,
  "timestamp": "2024-..."
}
```

### **Check 3: Quality-Based Generation**

```bash
curl -X POST https://your-backend-url.onrender.com/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a research abstract",
    "quality": "quality"
  }'
```

This will use the most capable model from the best available provider.

---

## 🔄 How Model Rotation Works

The system automatically rotates between models based on:

### **1. Rate Limits**
Each provider has different limits:
- **Gemini**: 250 requests/day
- **Groq**: 30 requests/minute
- **OpenRouter**: Limited by credits ($5-10 free)
- **Ollama Cloud**: 1M tokens/day

When a limit is hit, the system automatically falls back to the next provider.

### **2. Success Rate Tracking**
- System tracks success/failure for each model
- Failed models are deprioritized
- Success rates visible in `/api/ai/health` response
- Example: If Gemini has 95% success rate and Groq has 100%, priority shifts to Groq

### **3. Quality-Based Selection**
Users can request specific quality levels:
- **`quality`**: Most powerful models (for research, academic work)
  - Gemini: `gemini-2.0-flash-exp`
  - Groq: `llama-3.1-70b-versatile`
- **`fast`**: Lightweight, quick models (for simple tasks)
  - Gemini: `gemini-2.0-flash-exp` (no lighter option)
  - Groq: `llama-3.1-8b-instruct` (4x faster)
- **`balanced`**: Default, good mix of speed and quality
  - Uses each provider's recommended balanced model

### **4. Fallback Order**
Priority when providers fail:
```
1. Gemini (most capable, 250 req/day limit)
2. Groq (ultra-fast, 30 req/min limit)
3. OpenRouter (flexible, credit-based)
4. Ollama Cloud (always available, 1M tokens/day)
```

---

## 💰 Cost Tracking

The system tracks costs in real-time. All free tier models cost $0.00:

```json
{
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp",
  "tokensUsed": 1245,
  "cost": 0.000000,  // Free tier - $0.00
  "timestamp": "2024-..."
}
```

To monitor your costs:
```bash
curl https://your-backend-url.onrender.com/api/ai/stats
```

Response shows daily usage per provider:
```json
{
  "gemini": {
    "requestsToday": 45,
    "tokensUsedToday": 12450,
    "costToday": 0.00
  },
  "groq": { ... },
  "openrouter": { ... },
  "ollama": { ... }
}
```

---

## 🛠 Troubleshooting

### **Problem: "All AI providers failed"**

**Check 1**: Verify all API keys are set
```bash
# View which environment variables are missing
curl https://your-backend-url.onrender.com/api/ai/health
```

**Check 2**: Verify Render logs
1. Go to your service on Render
2. Click **"Logs"** tab
3. Look for error messages starting with `Error:` or `Failed:`

**Check 3**: Test individual provider connectivity
```bash
# Check if Gemini is working
curl https://your-backend-url.onrender.com/api/ai/health | jq '.providers.gemini'

# Output should show:
# "available": true
```

### **Problem: "Rate limit exceeded"**

This is expected and normal! The system automatically switches to the next provider.

**To monitor rate limiting**:
```bash
curl https://your-backend-url.onrender.com/api/ai/stats
```

Look for `failureCount` - this indicates rate limiting.

### **Problem: Slow Response Times**

**Solution 1**: Use `quality: "fast"` for faster responses
```bash
curl -X POST https://your-backend-url.onrender.com/api/ai/generate \
  -d '{"prompt": "...", "quality": "fast"}'
```

**Solution 2**: Check which provider is being used
```bash
curl https://your-backend-url.onrender.com/api/ai/health | jq '.providers[].rotation.successRate'
```

If Groq has 100% success rate, requests will use Groq (ultra-fast).

---

## 📊 Monitoring Dashboard

Create a simple monitoring dashboard to track:

```bash
# View all stats
curl https://your-backend-url.onrender.com/api/ai/stats | jq .

# View only today's costs
curl https://your-backend-url.onrender.com/api/ai/stats | jq '.[] | .costToday'

# View success rates (0-1 scale)
curl https://your-backend-url.onrender.com/api/ai/health | jq '.providers[] | .rotation.successRate'
```

---

## 🔄 Updating API Keys

If you need to rotate or update an API key:

1. Go to Render dashboard
2. Click your service
3. Click **"Environment"** tab
4. Find the variable (e.g., `GEMINI_API_KEY`)
5. Click the value to edit it
6. Paste the new key
7. Click **"Save Changes"**
8. Click **"Redeploy"** in the Deploys tab

The new key will be active within 2-5 minutes.

---

## 🎯 Best Practices

### **1. Get Free API Keys**
All providers offer generous free tiers - prioritize free keys:
- ✅ Gemini: 250 req/day (free)
- ✅ Groq: 30 req/min (free, ultra-fast)
- ✅ OpenRouter: $5-10 credits (free signup)
- ✅ Ollama Cloud: 1M tokens/day (free, cloud-hosted)

### **2. Monitor Usage**
Check `/api/ai/stats` daily to track:
- Token usage per provider
- Daily costs (all should be $0.00)
- Request counts

### **3. Quality Optimization**
- Use `quality: "fast"` for simple tasks (chat, categorization)
- Use `quality: "quality"` for complex tasks (research, analysis)
- Use `quality: "balanced"` (default) for everything else

### **4. Security**
- ✅ Never hardcode API keys in code
- ✅ Store all keys in Render environment variables
- ✅ Rotate keys periodically (monthly recommended)
- ✅ Use separate API keys for development and production

### **5. Fallback Planning**
Even with 4 providers, have a backup plan:
- Monitor `/api/ai/health` regularly
- Set up alerts for provider failures
- Keep contact info for support (Gemini, Groq, Ollama)

---

## 📚 Related Documentation

- [AI Providers Setup](./docs/AI_PROVIDERS_SETUP.md)
- [Model Selection Strategy](./MODEL_SELECTION_STRATEGY.md)
- [Implementation Guide](./docs/IMPLEMENTATION_COMPLETE.md)
- [API Integration Example](./docs/INTEGRATION_EXAMPLE.md)

---

## ✨ Summary

You now have:

✅ 4 free AI providers configured  
✅ Automatic failover & rotation  
✅ Quality-based model selection  
✅ Real-time cost tracking  
✅ Complete monitoring & health checks  
✅ Secure environment variable setup  

**Your multi-provider AI system is production-ready!** 🎉

