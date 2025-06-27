# Google Maps API Setup Guide

This guide will help you resolve the Google Maps API errors you're seeing and get restaurant recommendations working properly.

## 🚨 Current Issues
Your console shows these errors:
- `ApiTargetBlockedMapError` - API key not authorized for Places API
- `Google Maps JavaScript API has been loaded directly without loading-async` - Suboptimal loading
- `google.maps.places.PlacesService is not available to new customers` - Using deprecated API

## ✅ Solution Steps

### 1. Google Cloud Console Setup

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create or Select Project**
   - Create a new project OR select existing project
   - Note your project name/ID

3. **Enable Required APIs**
   Navigate to "APIs & Services" → "Library" and enable:
   - ✅ **Maps JavaScript API**
   - ✅ **Places API (New)**  
   - ✅ **Geocoding API**

### 2. Create API Key

1. **Go to "Credentials"**
   - APIs & Services → Credentials
   - Click "Create Credentials" → "API Key"

2. **Restrict Your API Key (Important for Security)**
   - Click on your new API key to edit
   - **Application restrictions**: HTTP referrers
   - Add your domains:
     ```
     localhost:*/*
     127.0.0.1:*/*
     your-production-domain.com/*
     ```
   - **API restrictions**: Restrict to specific APIs
   - Select: Maps JavaScript API, Places API, Geocoding API

### 3. Configure Your Project

1. **Create/Update .env file** in your project root:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
   ```

2. **Restart your development server**:
   ```bash
   npm run dev
   ```

### 4. Verify Setup

Check your browser console. You should see:
- ✅ `Google Maps API loaded successfully`
- ✅ `Found X restaurants via Google Maps API`
- ❌ No more `ApiTargetBlockedMapError` errors

## 🔧 Troubleshooting

### Error: "REQUEST_DENIED"
- **Cause**: API key not enabled for Places API
- **Solution**: Enable Places API in Google Cloud Console

### Error: "OVER_QUERY_LIMIT"  
- **Cause**: Exceeded daily quota
- **Solution**: Check quota in Google Cloud Console, upgrade if needed

### Error: "INVALID_REQUEST"
- **Cause**: Malformed request parameters
- **Solution**: Check the console logs for request details

### Error: Still using mock data
- **Cause**: API key not loaded properly
- **Solutions**:
  1. Check .env file exists and has correct variable name
  2. Restart development server
  3. Check browser console for specific error messages

## 💰 Pricing Information

Google Maps Platform pricing (as of 2024):
- **Maps JavaScript API**: $7 per 1,000 loads
- **Places API**: $17 per 1,000 requests  
- **Geocoding API**: $5 per 1,000 requests

**Free tier**: $200 credit per month (≈ 28,500 map loads or 11,750 place searches)

## 🔍 Testing

Once set up, test with:
1. Ask for "restaurants in atlanta"
2. Ask for "chinese restaurants in atlanta"  
3. Check console for successful API calls

## 📞 Support

If you continue having issues:
1. Check the browser console for specific error messages
2. Verify your API key restrictions
3. Confirm all required APIs are enabled
4. Check your billing account is active (if using paid tier)

---

## Alternative: Using Mock Data Only

If you prefer to use mock data during development:
1. Remove or comment out the `VITE_GOOGLE_MAPS_API_KEY` from .env
2. The system will automatically use mock restaurant data
3. You'll see console messages like "Using mock places because Google Maps API key is missing" 