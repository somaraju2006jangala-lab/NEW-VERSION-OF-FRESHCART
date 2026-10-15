import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch {
  // ignore
}

import {
  connectMySql,
  findAdminInDb,
  createAdminInDb,
} from '../server/db.ts';

async function main() {
  const args = process.argv.slice(2);
  const parsedArgs: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      parsedArgs[key] = rest.join('=');
    }
  }

  const email = (parsedArgs.email || process.env.EMPLOYEE_EMAIL || 'employee@freshcart.com').trim().toLowerCase();
  const fullName = (parsedArgs.name || process.env.EMPLOYEE_NAME || 'FreshCart Operations Employee').trim();
  const password = parsedArgs.password || process.env.EMPLOYEE_PASSWORD || 'FreshCartEmployee2026!';
  const customId = parsedArgs.id ? parsedArgs.id.trim() : `emp_${Date.now().toString(36)}`;

  if (!email || !email.includes('@')) {
    console.error('Error: Please specify a valid email address via --email=employee@freshcart.com');
    console.error('Usage: npx tsx scripts/provisionEmployee.ts --email=employee@freshcart.com --name="Employee Name" --password="SecurePassword" [--id=custom_id]');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('Error: Please provide a secure password (min 6 characters) via --password="YourPassword"');
    process.exit(1);
  }

  console.log('[CLI] Connecting to persistent MySQL database...');
  await connectMySql();

  // Check if account already exists
  const existing = await findAdminInDb(email);
  if (existing) {
    console.log(`[CLI] Account with email "${email}" already exists (ID: ${existing.admin_id}, Role: ${existing.role}, Status: ${existing.status}).`);
    if (existing.role !== 'employee') {
      console.warn(`Warning: Existing account has role "${existing.role}".`);
    }
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`[CLI] Hashing password and inserting employee account into database...`);
  const created = await createAdminInDb({
    adminId: customId,
    fullName,
    email,
    passwordHash,
    role: 'employee',
    status: 'active',
    createdBy: 'CLI_PROVISIONING',
  });

  console.log('====================================================');
  console.log('✓ FRESHCART EMPLOYEE PROVISIONED SUCCESSFULLY!');
  console.log('====================================================');
  console.log(`- Employee ID: ${created.admin_id}`);
  console.log(`- Full Name:   ${created.full_name}`);
  console.log(`- Email:       ${created.email}`);
  console.log(`- Role:        ${created.role}`);
  console.log(`- Status:      ${created.status}`);
  console.log('====================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('[CLI] Failed to provision employee:', err?.message);
  process.exit(1);
});
