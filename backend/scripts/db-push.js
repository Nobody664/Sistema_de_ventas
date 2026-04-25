#!/usr/bin/env node
const { execSync } = require('child_process');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

console.log('Pushing schema to database...');
console.log('URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));

try {
  execSync(`npx prisma db push --url "${dbUrl}"`, {
    stdio: 'inherit',
    cwd: './backend'
  });
  console.log('Schema pushed successfully!');
} catch (e) {
  console.error('Failed to push schema:', e.message);
  process.exit(1);
}