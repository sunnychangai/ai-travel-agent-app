# Beta Feedback Feature

This feature allows beta users to provide feedback about the AI Travel Agent application with automatic storage and email notifications.

## Implementation

### Mobile Experience
- **Third Tab**: On mobile devices, a "Feedback" tab appears as the third tab alongside "Chat" and "Itinerary"
- **Icon**: Uses MessageSquare icon from Lucide React
- **Full Screen**: Takes up the full mobile screen when active

### Desktop Experience  
- **Header Button**: A "Feedback" button appears in the top right header next to the dropdown menu
- **Modal Dialog**: Opens in a modal dialog overlay when clicked
- **Responsive**: Adjusts to screen size with max-width of 2xl

## Features

### Feedback Form Includes:
1. **Feedback Type** (Required) - Dropdown selection (Bug Report, Feature Request, Improvement, General, Praise)
2. **Your Feedback** (Required) - Detailed message textarea
3. **Name** (Optional) - User's name for personalized responses
4. **Email** (Optional) - Contact email for follow-up

### Backend Integration:
- **Database Storage**: Automatically saves to Supabase `feedback` table
- **Email Notifications**: Sends instant email alerts via EmailJS to `sunnyschangai@gmail.com`
- **User Authentication**: Links feedback to authenticated users when available
- **Error Handling**: Graceful fallback if email service fails

### User Experience:
- **Form Validation** - Requires feedback type and message
- **Loading States** - Shows spinner during submission
- **Success State** - Thank you screen after submission
- **Toast Notifications** - Success/error feedback with detailed messages
- **Auto-close** - Modal closes automatically after successful submission

## Files Created/Modified:

1. **`src/services/feedbackService.ts`** - New service for Supabase and EmailJS integration
2. **`src/components/feedback/FeedbackPage.tsx`** - Updated to use feedback service
3. **`src/components/TravelPlanner/TravelPlannerLayout.tsx`** - Mobile tab integration
4. **`src/components/home.tsx`** - Desktop header button integration
5. **`env.example`** - Added EmailJS configuration variables
6. **`SETUP-EMAILJS.md`** - New setup guide for EmailJS configuration

## Configuration

### Required Environment Variables:
```env
# Supabase (for database storage)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# EmailJS (for email notifications)
VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template_id  
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

### Setup Instructions:
1. **Database**: Ensure Supabase includes the `feedback` table (already in schema)
2. **EmailJS**: Follow `SETUP-EMAILJS.md` for complete EmailJS setup
3. **Environment**: Add configuration variables to your `.env` file

## Usage:

### Mobile:
1. User taps the "Feedback" tab at the bottom
2. Feedback form opens in full screen
3. User fills out form and submits
4. Feedback saves to database and email is sent
5. Success message appears

### Desktop:
1. User clicks "Feedback" button in header
2. Modal dialog opens with feedback form
3. User fills out form and submits  
4. Feedback saves to database and email is sent
5. Modal closes automatically after success

## Database Schema:

The feedback is stored in the `feedback` table with these fields:
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users, nullable)
- `feedback_type` (Text, Required)
- `content` (Text, Required) 
- `created_at` (Timestamp)

## Email Template Variables:

The EmailJS template receives these variables:
- `{{to_email}}` - Always `sunnyschangai@gmail.com`
- `{{from_name}}` - User's name or "Anonymous User"
- `{{from_email}}` - User's email or "No email provided"
- `{{feedback_type}}` - Selected feedback type
- `{{message}}` - Feedback content
- `{{submission_date}}` - Submission timestamp
- `{{user_id}}` - User ID or "Anonymous"

## Error Handling:

- **Database Errors**: User sees friendly error message, technical details logged
- **Email Failures**: Feedback still saves, user informed about email issue
- **Validation Errors**: Prevents submission without required fields
- **Network Issues**: Clear error messages with retry suggestions

## Security:

- **Row Level Security**: Database policies prevent unauthorized access
- **Input Validation**: Form validation prevents malicious input
- **Authentication Context**: Uses existing auth system for user identification
- **Environment Variables**: Sensitive keys properly configured

## Future Enhancements:

- Feedback analytics dashboard
- Admin response system  
- User feedback history
- Rate limiting for production
- Automated feedback categorization
- Integration with support ticket system

## Dependencies:

- `@emailjs/browser` - Client-side email sending
- `@supabase/supabase-js` - Database operations
- Existing shadcn/ui components
- React Context for authentication

## Customization:

The feedback form can be easily customized by:
- Adding new feedback types in the dropdown
- Modifying the feature list checkboxes
- Changing the rating scale
- Adding new form fields
- Integrating with backend API for submission

## API Integration:

Currently uses a simulated API call. To integrate with a real backend:

1. Replace the `setTimeout` in `handleSubmit` with actual API call
2. Add proper error handling
3. Implement feedback storage/routing logic
4. Add authentication if needed

## Styling:

Uses Tailwind CSS classes and shadcn/ui components for consistent styling with the rest of the application. 