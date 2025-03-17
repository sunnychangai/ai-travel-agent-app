# ESLint Configuration

This document describes the enhanced ESLint configuration set up in this project.

## Overview

The project uses a robust ESLint configuration with TypeScript type checking enabled, which helps catch potential issues early in the development process. The configuration follows the recommendations from the official Vite+React template.

## Key Features

1. **Strict Type Checking**
   - Uses `@typescript-eslint/strict-type-checked` for comprehensive type checking
   - Includes `@typescript-eslint/stylistic-type-checked` for code style consistency

2. **React Best Practices**
   - Enforces React recommended patterns via `plugin:react/recommended`
   - Includes JSX runtime support via `plugin:react/jsx-runtime`
   - Includes React Hooks rules via `plugin:react-hooks/recommended`

3. **Import Organization**
   - Uses `plugin:import/recommended` and `plugin:import/typescript`
   - Enforces consistent import ordering and grouping

## Custom Rules

The configuration includes several custom rules tailored for this project:

### TypeScript Rules
- Warnings for `any` types to encourage proper typing
- Specialized rules for unused variables
- Initial warnings (rather than errors) for unsafe type operations to allow gradual adoption

### Import Rules
- Structured import ordering by group (builtin, external, internal, etc.)
- Required newlines between import groups
- Alphabetic ordering of imports

### General Rules
- Limits on max line length (100 characters)
- Requirement for strict equality comparisons
- Console logging restrictions (allows warn/error/info)

## Integration with tsconfig.json

The TypeScript configuration (`tsconfig.json`) has been updated to enable strict mode and additional type checking options to complement the ESLint configuration:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "strictPropertyInitialization": true,
  "noImplicitThis": true,
  "useUnknownInCatchVariables": true,
  "alwaysStrict": true
}
```

## Usage

To run the linter:

```bash
npm run lint
```

VSCode users will see linting errors and warnings directly in the editor if the ESLint extension is installed.

## Gradual Adoption Strategy

Some stricter rules are initially set to "warn" instead of "error" to allow for gradual adoption. As the codebase improves, these can be elevated to errors:

- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/no-unsafe-member-access`
- `@typescript-eslint/no-unsafe-call`
- `@typescript-eslint/no-unsafe-return`
- `@typescript-eslint/no-unsafe-argument`

## Benefits

This configuration provides several benefits:

1. **Earlier Bug Detection**: Catch type-related bugs before runtime
2. **Improved Code Quality**: Enforce consistent coding standards
3. **Better Developer Experience**: Get immediate feedback in your editor
4. **Self-Documenting Code**: Proper typing serves as documentation
5. **Safer Refactoring**: Type checking ensures safer code changes 