# EmailJS Setup Guide for Feedback Notifications

This guide will help you set up EmailJS to receive feedback notifications from your travel app.

## 1. Create EmailJS Account

1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

## 2. Create Email Service

1. In your EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. Note down your **Service ID** (e.g., `service_abc123`)

## 3. Create Email Template

1. Go to **Email Templates** in your dashboard
2. Click **Create New Template**
3. Use this template structure:

```html
Subject: New Feedback - {{feedback_type}}

From: {{from_name}} ({{from_email}})
User ID: {{user_id}}
Feedback Type: {{feedback_type}}
Date: {{submission_date}}

Message:
{{message}}

---
This feedback was submitted through the AI Travel Agent app.
```

4. Save the template and note down your **Template ID** (e.g., `template_xyz789`)

## 4. Get Public Key

1. Go to **Account** → **General**
2. Find your **Public Key** (e.g., `abc123xyz789`)

## 5. Configure Environment Variables

Add these variables to your `.env` file:

```env
VITE_EMAILJS_SERVICE_ID=your_service_id_here
VITE_EMAILJS_TEMPLATE_ID=your_template_id_here
VITE_EMAILJS_PUBLIC_KEY=your_public_key_here
```

## 6. Test Configuration

1. Start your development server: `npm run dev`
2. Navigate to the feedback page
3. Submit a test feedback
4. Check your email for the notification

## Template Variables

The feedback service sends these variables to your EmailJS template:

- `{{to_email}}` - Always set to `sunnyschangai@gmail.com`
- `{{from_name}}` - User's name (or "Anonymous User")
- `{{from_email}}` - User's email (or "No email provided")
- `{{feedback_type}}` - Type of feedback (Bug Report, Feature Request, etc.)
- `{{message}}` - The feedback message content
- `{{submission_date}}` - When the feedback was submitted
- `{{user_id}}` - User ID from authentication (or "Anonymous")

## Troubleshooting

### Email Not Sending
- Check that all environment variables are set correctly
- Verify your EmailJS service is active
- Check browser console for error messages

### Template Not Working
- Ensure template variables match exactly (case-sensitive)
- Test template in EmailJS dashboard first

### Rate Limits
- Free EmailJS accounts have monthly limits
- Consider upgrading for production use

## Security Notes

- EmailJS public key is safe to expose in client-side code
- Never expose your private key in client-side code
- Consider implementing rate limiting for production

## Production Considerations

1. **Upgrade EmailJS Plan**: Free tier has limited emails per month
2. **Add Rate Limiting**: Prevent spam submissions
3. **Email Validation**: Validate email addresses before sending
4. **Error Handling**: Implement proper error handling for email failures
5. **Monitoring**: Set up monitoring for failed email deliveries

## Alternative: Backend Email Service

For production, consider moving email sending to your backend:
- More secure (API keys not exposed)
- Better error handling and retry logic
- No rate limiting from client-side service
- Can implement queuing for reliability 