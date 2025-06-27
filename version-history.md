# AI Travel Agent - Version History

## Version 0.1.1 - June 26, 2025
### ✨ New Features
- **Beta Feedback System**: Added comprehensive feedback collection for beta users
  - Mobile: Third tab in bottom navigation
  - Desktop: Feedback button in header with modal
  - Automatic database storage in Supabase
  - Email notifications via EmailJS
  - Support for multiple feedback submissions

### 🐛 Bug Fixes
- Improved storage when user logs back in to pull up last itinerary
- Fixed feedback database permissions and RLS policies
- Resolved submit button visibility issues on mobile
- Fixed scrolling behavior in feedback form
- Corrected database column alignment for feedback submissions

### 🔧 Improvements
- Enhanced form validation and error handling
- Added graceful fallback for anonymous feedback submissions
- Improved success screen with "Submit More Feedback" option
- Better responsive design for feedback interface

---

## Version 0.1.0 - June 24, 2025
### ✨ New Features
- AI Travel Planning: Core travel itinerary generation
- Interactive Chat: Real-time conversation with AI travel agent
- Itinerary Management: Create, edit, and manage travel plans
- Responsive Design: Mobile and desktop optimized interface
- Maps Integration: Google Maps integration for location services

---

## How to Update This File

This file (`version-history.md`) can be edited directly to add new version information. The app will automatically display the updated content on the Version History page.

### Format Guidelines:
- Use `## Version X.X.X - Date` for version headers
- Use `### ✨ New Features`, `### 🐛 Bug Fixes`, `### 🔧 Improvements` for categories
- Use bullet points with descriptive text
- Separate versions with `---`
- Keep the most recent version at the top 