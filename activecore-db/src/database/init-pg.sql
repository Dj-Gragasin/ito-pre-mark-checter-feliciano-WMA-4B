-- PostgreSQL initialization script for ActiveCore database

-- Drop existing tables (if exists, for clean reinstall)
DROP TABLE IF EXISTS user_rewards CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS qr_attendance_tokens CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    attendance_streak INT DEFAULT 0,
    last_attendance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    check_in_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    location VARCHAR(100) DEFAULT 'Main Gym',
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'late')),
    qr_token_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for attendance
CREATE INDEX idx_attendance_user_date ON attendance(user_id, check_in_time);
CREATE INDEX idx_attendance_date ON attendance(check_in_time);

-- Create QR Attendance Tokens table
CREATE TABLE qr_attendance_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for QR tokens
CREATE INDEX idx_qr_token ON qr_attendance_tokens(token);
CREATE INDEX idx_qr_expires ON qr_attendance_tokens(expires_at);

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    equip_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'cardio',
    purchase_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'broken')),
    last_maintenance DATE,
    next_schedule DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_date ON equipment(purchase_date);

-- Create rewards table
CREATE TABLE rewards (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    required_attendance INT NOT NULL,
    points INT DEFAULT 0,
    category VARCHAR(20) DEFAULT 'product' CHECK (category IN ('product', 'service', 'discount')),
    icon VARCHAR(10) DEFAULT '🎁',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_rewards table (claimed rewards)
CREATE TABLE user_rewards (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    reward_id INT NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
    UNIQUE(user_id, reward_id)
);

-- Insert test users (password: bcrypt hash of 'password')
INSERT INTO users (email, password, first_name, last_name, role) VALUES 
('admin@activecore.com', '$2b$10$xJwq5rkqZ7QY5D8X9yZ9Z.9Y5D8X9yZ9Z.', 'Admin', 'User', 'admin'),
('member@activecore.com', '$2b$10$xJwq5rkqZ7QY5D8X9yZ9Z.9Y5D8X9yZ9Z.', 'Member', 'User', 'member');

-- Insert default rewards
INSERT INTO rewards (title, description, required_attendance, points, category, icon) VALUES
('Free Protein Shake', 'Get a complimentary protein shake from our juice bar', 5, 10, 'product', '🥤'),
('Free Personal Training Session', 'One-on-one session with our certified trainers', 10, 50, 'service', '💪'),
('ActiveCore Water Bottle', 'Premium stainless steel water bottle', 15, 25, 'product', '🍶'),
('20% Off Supplements', 'Discount on all supplement products', 20, 30, 'discount', '💊'),
('Massage Therapy Session', '45-minute relaxation massage session', 25, 75, 'service', '💆'),
('ActiveCore Gym Bag', 'Premium branded gym bag with compartments', 30, 40, 'product', '🎒');

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50),
    membership_type VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
    transaction_id VARCHAR(255) UNIQUE,
    subscription_start DATE,
    subscription_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create meal_plans table
CREATE TABLE IF NOT EXISTS meal_plans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    plan_name VARCHAR(255),
    week_plan JSONB,
    shopping_list JSONB,
    meal_prep_tips JSONB,
    nutrition_tips JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user_meal_preferences table
CREATE TABLE IF NOT EXISTS user_meal_preferences (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    lifestyle VARCHAR(100),
    meal_type VARCHAR(100),
    goal VARCHAR(100),
    diet VARCHAR(100),
    dietary_restrictions JSONB,
    targets JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create filipino_dishes table
CREATE TABLE IF NOT EXISTS filipino_dishes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100),
    calories DECIMAL(8, 2),
    protein DECIMAL(8, 2),
    carbs DECIMAL(8, 2),
    fats DECIMAL(8, 2),
    ingredients JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_price DECIMAL(10, 2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS join_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255);
