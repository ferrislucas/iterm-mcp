# Testing for iterm-mcp

This directory contains tests for the iterm-mcp project.

## Testing Framework

We use Jest as our testing framework with TypeScript support via ts-jest. This gives us:

- Excellent TypeScript integration
- Mocking capabilities
- Test watch mode
- Code coverage reports

## Directory Structure

- `test/unit/`: Contains unit tests for individual components
- `test/tsconfig.json`: TypeScript configuration specific to tests

## Running Tests

The following npm scripts are available:

```bash
# Run all tests
yarn test

# Run tests in watch mode (for development)
yarn test:watch

# Run tests with coverage report
yarn test:coverage

# Run e2e tests
yarn e2e
```

## Writing Tests

### General Guidelines

1. Place unit tests in `test/unit/` directory
2. Name test files with the `.test.ts` suffix
3. Use Jest's `describe`, `test`, and `expect` functions
4. Mock external dependencies

### Mocking Dependencies

For classes that use external dependencies (like `node:child_process`), follow this pattern:

```typescript
// Mock the dependencies
jest.mock('node:child_process', () => ({
  exec: jest.fn()
}));

// Create a mockable function for promises
const mockExecPromise = jest.fn();
jest.mock('node:util', () => ({
  promisify: jest.fn().mockReturnValue(mockExecPromise)
}));

// Later in your test...
mockExecPromise.mockResolvedValue({ stdout: 'example output', stderr: '' });
```

## Test Coverage

We aim for good test coverage of all core functionality. Run `yarn test:coverage` to see the current coverage report.

## Troubleshooting

If you encounter issues with ESM modules, make sure your Jest configuration is properly set up for ESM compatibility. The current configuration in `jest.config.cjs` should handle this correctly.
