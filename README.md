# AI Travel Planner

An intelligent travel planning application that helps users create personalized itineraries using AI.

## Features

- AI-powered itinerary generation
- Personalized recommendations based on user preferences
- Interactive chat interface
- Comprehensive travel planning tools
- Real-time itinerary updates

## Environment Variables

This application requires the following environment variables:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_TRIPADVISOR_API_KEY=your_tripadvisor_api_key
```

## Troubleshooting

### "Oops! There was a problem" Error

If you see this error when trying to generate an itinerary, it's likely due to missing or incorrectly configured environment variables in your Vercel deployment.

#### Steps to Fix:

1. **Check Environment Variables in Vercel:**
   - Go to your Vercel dashboard
   - Select your project
   - Navigate to Settings → Environment Variables
   - Ensure all required variables are present and have valid values

2. **Use the Diagnostic Tool:**
   - When you encounter the error, click "Run Diagnostic" to test your API configuration
   - This will help identify which specific configuration is causing the issue

3. **Common Issues:**
   - **Missing API Key**: `VITE_OPENAI_API_KEY` is not set in Vercel
   - **Placeholder Values**: API key is still set to `your_openai_api_key`
   - **Invalid Format**: API key doesn't start with `sk-` or is too short
   - **Network Issues**: Connectivity problems with OpenAI API

4. **How to Add Environment Variables in Vercel:**
   - In your Vercel project dashboard, go to Settings
   - Click on "Environment Variables"
   - Add each variable with its corresponding value
   - Make sure to select the appropriate environments (Production, Preview, Development)
   - Redeploy your application after adding variables

#### Getting API Keys:

- **OpenAI API Key**: Visit [OpenAI Platform](https://platform.openai.com/api-keys) to create an API key
- **Supabase**: Get your URL and anon key from your [Supabase dashboard](https://supabase.com/dashboard)
- **Google Maps API**: Create a key in the [Google Cloud Console](https://console.cloud.google.com/)
- **TripAdvisor API**: Register at [TripAdvisor Developer Portal](https://developer-tripadvisor.com/)

## Development

```bash
npm install
npm run dev
```

## Deployment

This app is designed to be deployed on Vercel. Make sure to configure all environment variables in your Vercel project settings before deployment.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI
- **State Management**: React Context API
- **Backend**: Supabase (optional)
- **Deployment**: Vercel/Netlify (recommended)

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── common/       # Shared components (Button, Card, etc.)
│   ├── TravelPlanner/# Travel planner specific components
│   └── ui/           # UI library components
├── constants/        # Application constants
├── contexts/         # React context providers
├── hooks/            # Custom React hooks
├── pages/            # Page components
├── services/         # API and external services
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ai-travel-planner.git
   cd ai-travel-planner
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration values.

5. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open your browser and navigate to `http://localhost:5173`

## Development Guidelines

### Code Style

- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Use functional components with hooks
- Keep components small and focused on a single responsibility
- Use named exports for better code navigation

### State Management

- Use React Context for global state
- Use local state for component-specific state
- Avoid prop drilling by using context or custom hooks

### Performance Considerations

- Use React.memo for expensive components
- Use useCallback and useMemo for expensive calculations
- Implement virtualization for long lists
- Optimize images and assets

## Deployment

### Build for Production

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `dist/` directory.

### Deployment Platforms

- **Vercel**: Connect your GitHub repository for automatic deployments
- **Netlify**: Connect your GitHub repository or manually upload the `dist/` directory
- **GitHub Pages**: Deploy the `dist/` directory to GitHub Pages

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `