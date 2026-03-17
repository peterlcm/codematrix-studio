// Test setup file
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client for tests
const prisma = new PrismaClient();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Global test timeout
jest.setTimeout(10000);

// Cleanup after each test
afterAll(async () => {
  // Clean up test data
  await prisma.$disconnect();
});

beforeAll(async () => {
  // Setup test database if needed
});

afterEach(() => {
  // Clear any mocks
  jest.clearAllMocks();
});