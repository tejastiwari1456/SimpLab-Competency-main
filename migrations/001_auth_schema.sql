-- SimLab Competency Hub Database Migration: 001_auth_schema.sql
-- PostgreSQL DDL for Users, Sessions, Auth Events, and Password Resets

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DISABLED')),
  institution VARCHAR(255) DEFAULT '',
  enrollment_code VARCHAR(128),
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  refresh_token_hash VARCHAR(64),
  user_agent TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOGGED_OUT', 'REVOKED', 'EXPIRED')),
  is_revoked BOOLEAN DEFAULT FALSE
);

-- 3. Authentication Audit Events Table
CREATE TABLE IF NOT EXISTS auth_events (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  success BOOLEAN NOT NULL,
  session_id VARCHAR(64),
  ip_address VARCHAR(64),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Performance and Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash_unique ON sessions(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash)
WHERE refresh_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
