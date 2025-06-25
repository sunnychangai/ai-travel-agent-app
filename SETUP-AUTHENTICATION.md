# Authentication Setup Guide

## Overview

This application now uses **real Supabase authentication** instead of mock authentication. Follow this guide to set up authentication for your travel itinerary app.

## Prerequisites

1. A Supabase account (free tier available)
2. A Supabase project

## Setup Steps

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: Travel Itinerary App
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
4. Wait for project creation (1-2 minutes)

### 2. Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **Anon/Public Key** (under "Project API keys")

### 3. Configure Environment Variables

1. Copy the template file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` file with your actual values:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here

   # API Keys (optional for now)
   VITE_OPENAI_API_KEY=your_openai_api_key
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   VITE_TRIPADVISOR_API_KEY=your_tripadvisor_api_key
   ```

### 4. Configure Supabase Authentication

1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Configure the following:

   **Site URL**: `http://localhost:5173` (for development)
   
   **Redirect URLs**: Add these URLs:
   - `http://localhost:5173/app`
   - `http://localhost:5173/auth`
   - Your production domain when ready

   **Email Auth**: Enabled by default ✅
   
   **Email Confirmation**: You can disable this for development:
   - Go to **Settings** → **Authentication**
   - Uncheck "Enable email confirmations"

### 5. Set Up Database Tables (Already Done)

The app includes a `supabase-schema.sql` file with all necessary tables and Row Level Security (RLS) policies. You can run this in your Supabase SQL editor if needed.

### 6. Test Authentication

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173/auth`

3. Try creating an account and signing in

## Features

### ✅ What's Working Now

- **Real user registration** with Supabase
- **Email/password authentication**
- **Automatic session management**
- **User-specific data storage**
- **Secure password handling**
- **Auth state persistence**

### 🔄 Auth Flow

1. **Sign Up**: Creates user in Supabase
2. **Email Confirmation**: Optional (can be disabled for dev)
3. **Sign In**: Authenticates with Supabase
4. **Auto-redirect**: Takes users to `/app` after login
5. **Session Management**: Automatically handles tokens
6. **Sign Out**: Clears session and redirects

### 🔒 Security Features

- Row Level Security (RLS) on all database tables
- User-specific data access only
- Secure session management
- Password hashing handled by Supabase

## Troubleshooting

### "Supabase is not configured" Error

- Check your `.env` file exists and has correct values
- Restart your development server after changing `.env`
- Verify environment variable names start with `VITE_`

### Authentication Not Working

- Check Supabase project is active
- Verify Site URL and Redirect URLs in Supabase settings
- Check browser console for detailed error messages

### Users Can't Access Their Data

- Verify RLS policies are enabled
- Check that `user_id` fields are properly set
- Review Supabase logs in dashboard

## Next Steps for Production

1. **Update Site URLs** in Supabase for your production domain
2. **Enable email confirmation** for production
3. **Set up custom email templates** (optional)
4. **Configure social auth providers** (Google, GitHub, etc.)
5. **Set up monitoring** and error tracking

## Migration from Mock Auth

The app has been updated to:
- Replace `AuthContext.tsx` mock implementation
- Use real Supabase authentication
- Maintain the same component interfaces
- Add proper error handling
- Include loading states

All existing components that use `useAuth()` will continue to work without changes. 