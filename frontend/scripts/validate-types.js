#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

const INVALID_PATTERNS = [
  { pattern: '._count', message: 'Usa _count solo si está incluido en la query' },
  { pattern: '.subscription)', message: 'Use .subscription (singular) para relaciones 1:1 o la الأولى con include' },
  { pattern: '.subscriptions[', message: 'Use subscriptions directamente, no con índice' },
  { pattern: 'products[', message: 'Use products[i] solo si es un array incluido' },
  { pattern: 'memberships[', message: 'Use memberships[i] solo si es un array incluido' },
  { pattern: 'customer.', message: 'Verifique que customer esté incluido en la query' },
  { pattern: 'company.', message: 'Verifique que company esté incluido en la query' },
  { pattern: 'plan.', message: 'Verifique que plan esté incluido en la query' },
];

const KNOWN_PROPERTIES = {
  Category: ['id', 'companyId', 'name', 'slug', 'description', 'createdAt', 'updatedAt', '_count'],
  Company: ['id', 'name', 'slug', 'legalName', 'taxId', 'address', 'email', 'phone', 'timezone', 'currency', 'status', 'trialEndsAt', 'createdAt', 'updatedAt', '_count'],
  User: ['id', 'email', 'fullName', 'globalRole', 'isActive', 'createdAt', 'updatedAt', '_count'],
  Plan: ['id', 'code', 'name', 'description', 'priceMonthly', 'priceYearly', 'billingCycle', 'maxUsers', 'maxProducts', 'isActive', 'createdAt', 'updatedAt', '_count'],
  Product: ['id', 'companyId', 'categoryId', 'name', 'sku', 'description', 'salePrice', 'costPrice', 'stockQuantity', 'minStock', 'isActive', 'imageUrl', 'barcode', 'createdAt', 'updatedAt'],
  Customer: ['id', 'companyId', 'name', 'email', 'phone', 'documentType', 'documentValue', 'address', 'isActive', 'createdAt', 'updatedAt'],
  Sale: ['id', 'companyId', 'customerId', 'status', 'totalAmount', 'createdAt', 'updatedAt'],
  Subscription: ['id', 'companyId', 'planId', 'status', 'provider', 'billingCycle', 'startDate', 'endDate', 'autoRenew', 'createdAt', 'updatedAt', '_count'],
};

function scanDirectory(dir, issues) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && !file.startsWith('.')) {
        scanDirectory(fullPath, issues);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');

      for (const { pattern, message } of INVALID_PATTERNS) {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
          const line = content.substring(0, match.index).split('\n').length;
          issues.push({
            file: path.relative(FRONTEND_DIR, fullPath),
            line,
            pattern,
            message,
          });
        }
      }
    }
  }
}

function main() {
  console.log('🔍 Escaneando frontend para inconsistencias...\n');

  const issues = [];
  scanDirectory(path.join(FRONTEND_DIR, 'app'), issues);
  scanDirectory(path.join(FRONTEND_DIR, 'components'), issues);
  scanDirectory(path.join(FRONTEND_DIR, 'lib'), issues);
  scanDirectory(path.join(FRONTEND_DIR, 'types'), issues);

  if (issues.length === 0) {
    console.log('✅ No se encontraron problemas de consistencia');
    return;
  }

  console.log(`⚠️  Se encontraron ${issues.length} posibles problemas:\n`);

  for (const issue of issues) {
    console.log(`📁 ${issue.file}:${issue.line}`);
    console.log(`   ❌ Patrón: ${issue.pattern}`);
    console.log(`   💡 ${issue.message}`);
    console.log();
  }

  console.log('\n📋 Recomendaciones:');
  console.log('1. Verifique que las relaciones estén incluidas en las queries');
  console.log('2. Use _count solo para contar relaciones específicas');
  console.log('3. Verifique los tipos en types/generated.ts');
  console.log('4. Use el SDK compartido en lib/shared/sdk.ts');

  process.exit(1);
}

main();