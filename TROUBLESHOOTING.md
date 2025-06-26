# Troubleshooting Guide

## "Oops! There was a problem" Error

If you're seeing this error when trying to generate an itinerary, it's most likely due to missing or incorrectly configured environment variables in your deployment.

### Quick Fix Steps

1. **Check Your Vercel Dashboard:**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Navigate to your project
   - Go to Settings → Environment Variables
   - Look for `VITE_OPENAI_API_KEY`

2. **Common Issues & Solutions:**

   **❌ Missing API Key**
   - Error: "The OpenAI API key is not configured"
   - Solution: Add `VITE_OPENAI_API_KEY` to your Vercel environment variables

   **❌ Placeholder API Key**
   - Error: "The OpenAI API key appears to be a placeholder value"
   - Solution: Replace `your_openai_api_key` with your actual OpenAI API key

   **❌ Invalid API Key**
   - Error: "The OpenAI API key appears to be invalid"
   - Solution: Get a new API key from OpenAI and update your environment variables

### Step-by-Step Fix

#### 1. Get an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)
5. **Important:** Save this key somewhere safe - you won't be able to see it again!

#### 2. Add the API Key to Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your travel agent project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Set:
   - **Name:** `VITE_OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (starts with `sk-`)
   - **Environments:** Select all (Production, Preview, Development)
6. Click **Save**

#### 3. Redeploy Your Application

1. Go to your project's **Deployments** tab
2. Click the three dots (**...**) next to your latest deployment
3. Select **Redeploy**
4. Wait for the deployment to complete

### Using the Diagnostic Tool

The error page includes a "Run Diagnostic" button that will test your configuration:

- ✅ **Green checkmarks:** Everything is working
- ❌ **Red X marks:** Something needs to be fixed

### Other Required Environment Variables

Your application also needs these environment variables for full functionality:

```env
# Required for core functionality
VITE_OPENAI_API_KEY=sk-your-openai-api-key

# Optional for enhanced features
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_TRIPADVISOR_API_KEY=your-tripadvisor-api-key

# Required for user accounts (if using authentication)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Getting Other API Keys

**Google Maps API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. Enable the Maps JavaScript API
4. Create credentials (API Key)
5. Restrict the key to your domain for security

**TripAdvisor API Key:**
1. Go to [TripAdvisor Developer Portal](https://developer-tripadvisor.com/)
2. Register for an account
3. Create a new application
4. Get your API key

**Supabase Credentials:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Go to Settings → API
4. Copy your Project URL and anon/public key

### Still Having Issues?

If you're still experiencing problems:

1. **Check the browser console:**
   - Press F12 to open developer tools
   - Look for error messages in the Console tab

2. **Verify your API key:**
   - Make sure it starts with `sk-`
   - Check that you have credits in your OpenAI account
   - Ensure the key hasn't been revoked

3. **Test locally:**
   - Create a `.env` file in your project root
   - Add your environment variables
   - Run `npm run dev` to test locally

4. **Clear cache:**
   - Hard refresh your browser (Ctrl+Shift+R)
   - Clear your browser cache

### Environment Variable Security

**Important Security Notes:**
- Never commit API keys to your code repository
- Use environment variables for all sensitive data
- Regularly rotate your API keys
- Monitor your API usage for unusual activity

### Development vs Production

**For Local Development:**
- Create a `.env` file in your project root
- Add your environment variables there
- The file is automatically ignored by Git

**For Production (Vercel):**
- Always use the Vercel dashboard to set environment variables
- Never hardcode API keys in your source code
- Use different API keys for development and production if possible

### Contact Support

If none of these solutions work, please:
1. Take a screenshot of the error page
2. Include the diagnostic results
3. Check if the issue persists after following all steps above 