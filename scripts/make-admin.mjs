import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString, {
  ssl: 'require',
});

const clerkUserId = 'user_3CPF781dv3P3hA4O4pOLgmhOwqS';

async function main() {
  await sql`
    UPDATE users
    SET role = 'admin', updated_at = NOW()
    WHERE clerk_user_id = ${clerkUserId}
  `;

  console.log('User promoted to admin.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});