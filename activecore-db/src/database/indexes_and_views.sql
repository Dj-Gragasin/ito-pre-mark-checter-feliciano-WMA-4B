-- ============================================
-- Production Database Indexes
-- Add these to your database for performance
-- ============================================

USE activecore;

-- User Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Payment Indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Attendance Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_time ON attendance(check_in_time);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, check_in_time);

-- QR Token Indexes
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_attendance_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_attendance_tokens(expires_at);

-- Meal Planning Indexes
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_created_at ON meal_plans(created_at);

-- Equipment Management Indexes
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_date ON equipment(purchase_date);
CREATE INDEX IF NOT EXISTS idx_equipment_warranty_end ON equipment(warranty_end);

-- Filipino Dishes Indexes
CREATE INDEX IF NOT EXISTS idx_dishes_name ON filipino_dishes(name);
CREATE INDEX IF NOT EXISTS idx_dishes_category ON filipino_dishes(category);

-- ============================================
-- Create Stored Procedures for Common Queries
-- ============================================

DELIMITER $$

-- Get user subscription status
CREATE PROCEDURE IF NOT EXISTS sp_get_user_subscription(IN p_user_id INT)
BEGIN
    SELECT 
        id, email, first_name, last_name,
        status, subscription_start, subscription_end,
        membership_type, membership_price
    FROM users
    WHERE id = p_user_id;
END $$

-- Check if subscription is active
CREATE PROCEDURE IF NOT EXISTS sp_is_subscription_active(IN p_user_id INT)
BEGIN
    SELECT 
        CASE 
            WHEN subscription_end >= NOW() THEN 1
            ELSE 0
        END as is_active
    FROM users
    WHERE id = p_user_id;
END $$

-- Get all pending payments
CREATE PROCEDURE IF NOT EXISTS sp_get_pending_payments()
BEGIN
    SELECT 
        p.id, p.user_id, u.email, u.first_name, u.last_name,
        p.amount, p.payment_method, p.payment_status, p.created_at
    FROM payments p
    JOIN users u ON p.user_id = u.id
    WHERE p.payment_status = 'pending'
    ORDER BY p.created_at DESC;
END $$

-- Get attendance summary for date range
CREATE PROCEDURE IF NOT EXISTS sp_get_attendance_summary(
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT 
        DATE(check_in_time) as attendance_date,
        COUNT(*) as total_attendees,
        COUNT(DISTINCT user_id) as unique_members,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count
    FROM attendance
    WHERE DATE(check_in_time) BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(check_in_time)
    ORDER BY attendance_date DESC;
END $$

-- Get revenue summary
CREATE PROCEDURE IF NOT EXISTS sp_get_revenue_summary(
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT 
        DATE(payment_date) as payment_date,
        COUNT(*) as transaction_count,
        SUM(amount) as daily_revenue,
        AVG(amount) as average_transaction,
        COUNT(DISTINCT user_id) as unique_payers
    FROM payments
    WHERE payment_status = 'completed'
    AND DATE(payment_date) BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(payment_date)
    ORDER BY payment_date DESC;
END $$

DELIMITER ;

-- ============================================
-- Create Views for Common Queries
-- ============================================

-- Active members view
CREATE OR REPLACE VIEW vw_active_members AS
SELECT 
    id, email, first_name, last_name, role,
    subscription_start, subscription_end, membership_type,
    DATEDIFF(subscription_end, NOW()) as days_remaining
FROM users
WHERE status = 'active'
AND subscription_end >= NOW()
ORDER BY subscription_end DESC;

-- Expired subscriptions view
CREATE OR REPLACE VIEW vw_expired_subscriptions AS
SELECT 
    id, email, first_name, last_name, 
    subscription_end, 
    DATEDIFF(NOW(), subscription_end) as days_expired
FROM users
WHERE subscription_end < NOW()
ORDER BY subscription_end DESC;

-- Expiring soon view (next 7 days)
CREATE OR REPLACE VIEW vw_expiring_soon AS
SELECT 
    id, email, first_name, last_name,
    subscription_end,
    DATEDIFF(subscription_end, NOW()) as days_until_expiry
FROM users
WHERE subscription_end BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
AND status = 'active'
ORDER BY subscription_end ASC;

-- Today's attendance view
CREATE OR REPLACE VIEW vw_today_attendance AS
SELECT 
    a.user_id, u.first_name, u.last_name, u.email,
    a.check_in_time, a.status, a.location
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE DATE(a.check_in_time) = CURDATE()
ORDER BY a.check_in_time DESC;

-- Payment history view
CREATE OR REPLACE VIEW vw_payment_history AS
SELECT 
    p.id, p.user_id, u.email, u.first_name, u.last_name,
    p.amount, p.payment_method, p.payment_status,
    p.payment_date, p.created_at,
    CASE 
        WHEN p.payment_status = 'completed' THEN 'Paid'
        WHEN p.payment_status = 'pending' THEN 'Awaiting Approval'
        ELSE p.payment_status
    END as status_label
FROM payments p
JOIN users u ON p.user_id = u.id
ORDER BY p.created_at DESC;

-- ============================================
-- Backup Strategy
-- ============================================
-- Add to crontab for automated backups:
-- 0 2 * * * mysqldump -u root -p activecore > /backup/activecore_$(date +\%Y\%m\%d_\%H\%M\%S).sql
-- 0 3 * * 0 mysqldump -u root -p activecore | gzip > /backup/activecore_weekly_$(date +\%Y\%m\%d).sql.gz

-- ============================================
-- Maintenance Scripts
-- ============================================

-- Archive old payments (keep last 2 years)
-- BEFORE running: CREATE TABLE payments_archive LIKE payments;
-- ALTER TABLE payments ADD COLUMN archived_at TIMESTAMP;
-- INSERT INTO payments_archive SELECT * FROM payments WHERE payment_date < DATE_SUB(NOW(), INTERVAL 2 YEAR);
-- DELETE FROM payments WHERE payment_date < DATE_SUB(NOW(), INTERVAL 2 YEAR);

-- Optimize tables (run monthly)
-- OPTIMIZE TABLE users;
-- OPTIMIZE TABLE payments;
-- OPTIMIZE TABLE attendance;
-- OPTIMIZE TABLE meal_plans;

-- Analyze tables (run after large imports)
-- ANALYZE TABLE users;
-- ANALYZE TABLE payments;
-- ANALYZE TABLE attendance;
