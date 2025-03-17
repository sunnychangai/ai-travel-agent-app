# AI Travel Planner

An intelligent travel planning application that helps users create personalized travel itineraries with AI assistance.

## Features

- Interactive chat interface with AI travel assistant
- Dynamic itinerary creation and management
- AI-powered travel suggestions based on user preferences
- Ability to save, share, and export itineraries
- Responsive design for desktop and mobile use

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
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
