/**
 * Create or promote an administrator.
 *   npm run create-admin -- owner@bikepick.in "StrongPassword123" "Owner Name"
 */
import crypto from 'node:crypto';
import { config } from 'dotenv';
import { db, insert, nowIso, uid } from '../lib/db';

config({ path: '.env.local' });
config({ path: '.env' });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npm run create-admin -- <email> <password> [full name]');
    process.exit(1);
  }
  if (password.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }

  const existing = await db.get<any>('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing) {
    await db.run('UPDATE users SET role = ?, password_hash = ?, status = ?, updated_at = ? WHERE id = ?', [
      'admin', hashPassword(password), 'active', nowIso(), existing.id,
    ]);
    console.log(`✓ ${email} promoted to admin and password reset.`);
    return;
  }
  await insert('users', {
    id: uid('usr'), email: email.toLowerCase(), full_name: name || 'Administrator',
    password_hash: hashPassword(password), role: 'admin', status: 'active', email_verified: 1,
  });
  console.log(`✓ Admin created: ${email}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
