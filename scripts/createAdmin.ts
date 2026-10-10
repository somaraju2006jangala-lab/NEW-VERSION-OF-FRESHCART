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
  getActiveAdminCount,
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

  const email = (parsedArgs.email || process.env.ADMIN_OWNER_EMAIL || '').trim().toLowerCase();
  const fullName = (parsedArgs.name || process.env.ADMIN_OWNER_NAME || 'Project Owner').trim();
  const password = parsedArgs.password || process.env.ADMIN_OWNER_PASSWORD || '';
  const role = (parsedArgs.role || 'owner').trim().toLowerCase() as 'owner' | 'admin';
  const customId = parsedArgs.id ? parsedArgs.id.trim() : '';

  if (!email || !email.includes('@')) {
    console.error('Error: Please specify a valid email address via --email=your@email.com');
    console.error('Usage: npx tsx scripts/createAdmin.ts --email=admin@freshcart.com --name="Admin Name" --password="SecurePassword" [--role=owner|admin] [--id=custom_id]');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('Error: Please provide a secure password (min 6 characters) via --password="YourPassword"');
    process.exit(1);
  }

  console.log('[CLI] Connecting to persistent MySQL database...');
  await connectMySql();

  // Check if admin already exists
  const existing = await findAdminInDb(email);
  if (existing) {
    console.error(`Error: An admin with email "${email}" already exists (ID: ${existing.admin_id}, Role: ${existing.role}, Status: ${existing.status}).`);
    process.exit(1);
  }

  // Check quota limit if creating active admin
  const activeCount = await getActiveAdminCount();
  if (activeCount >= 5) {
    console.error(`Error: Active administrator limit reached (${activeCount}/5). Cannot create more than 5 active accounts.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const adminId = customId || (role === 'owner' ? `owner_${Date.now().toString(36)}` : `adm_${Date.now().toString(36)}`);

  console.log(`[CLI] Hashing password and inserting ${role} account into database...`);
  const created = await createAdminInDb({
    adminId,
    fullName,
    email,
    passwordHash,
    role,
    status: 'active',
    createdBy: 'CLI_SETUP',
  });

  console.log('====================================================');
  console.log('✓ AUTHORIZED ADMINISTRATOR CREATED SUCCESSFULLY!');
  console.log('====================================================');
  console.log(`- Admin ID:   ${created.admin_id}`);
  console.log(`- Full Name:  ${created.full_name}`);
  console.log(`- Email:      ${created.email}`);
  console.log(`- Role:       ${created.role}`);
  console.log(`- Status:     ${created.status}`);
  console.log(`- Active Admins Count: ${activeCount + 1} / 5`);
  console.log('====================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('[CLI] Failed to create admin:', err?.message);
  process.exit(1);
});
