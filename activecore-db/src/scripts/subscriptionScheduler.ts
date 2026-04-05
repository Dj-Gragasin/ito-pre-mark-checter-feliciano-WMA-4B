import { pool } from '../config/db.config';

const GRACE_DAYS = Number(process.env.GRACE_DAYS || '7');

export function startSubscriptionScheduler() {
  console.log(`🔔 Subscription scheduler starting (grace days = ${GRACE_DAYS})`);

  // Run once immediately to ensure state is correct on startup
  runJob().catch(err => console.error('Scheduler startup run failed:', (err as any)?.message || err));

  // Schedule to run roughly every 24 hours using setInterval (in ms)
  const dayMs = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runJob().catch(err => console.error('Scheduled job failed:', (err as any)?.message || err));
  }, dayMs);
}

async function runJob() {
  try {
    console.log('🔔 Subscription scheduler: running job...');

    // Ensure grace_until column exists (Postgres supports IF NOT EXISTS)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_until DATE`);
    } catch (e) {
      // ignore
    }

    // 1) Set or refresh grace_until from subscription_end
    const graceInterval = `${GRACE_DAYS} days`;
    // Postgres does not allow parameter binding for INTERVAL in this form, interpolate safely
    // Avoid comparing DATE columns to empty string (''), which causes a cast/parse error.
    await pool.query(
      `UPDATE users
       SET grace_until = DATE(subscription_end + INTERVAL '${graceInterval}')
       WHERE role = 'member'
         AND subscription_end IS NOT NULL
         AND (grace_until IS NULL OR grace_until <> DATE(subscription_end + INTERVAL '${graceInterval}'))`
    );

    // 2) Deactivate members whose grace_until (or subscription_end) is past.
    await pool.query(
      `UPDATE users SET status = 'inactive', payment_status = 'expired'
       WHERE role = 'member'
         AND COALESCE(grace_until, subscription_end) IS NOT NULL
         AND COALESCE(grace_until, subscription_end) < CURRENT_DATE
         AND (COALESCE(status, '') <> 'inactive' OR COALESCE(payment_status, '') <> 'expired')`
    );

    console.log('🔔 Subscription scheduler: job completed');
  } catch (err: any) {
    console.error('🔴 Subscription scheduler error:', err);
  }
}
