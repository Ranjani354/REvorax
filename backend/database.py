import os
import sqlite3
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def get_db_path() -> Path:
    if os.environ.get('PYTEST_CURRENT_TEST') is not None or 'pytest' in sys.modules:
        return BASE_DIR / 'rcm_test.db'
    return BASE_DIR / 'rcm.db'


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), timeout=15)
    conn.row_factory = sqlite3.Row
    # WAL keeps writes durable and lets the dev server and tests share the file safely.
    try:
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA busy_timeout=15000')
    except sqlite3.Error:
        pass
    return conn


def ensure_column(table_name: str, column_name: str, column_definition: str) -> None:
    conn = get_connection()
    try:
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        table_names = [row['name'] for row in tables]
        if table_name not in table_names:
            return
        existing = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        if not any(row['name'] == column_name for row in existing):
            conn.execute(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}')
            conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    db_path = get_db_path()
    if ('pytest' in sys.modules or os.environ.get('PYTEST_CURRENT_TEST') is not None) and db_path.exists():
        db_path.unlink()

    conn = get_connection()
    try:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user'
            )
            '''
        )

        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guest_name TEXT NOT NULL,
                room_type TEXT NOT NULL,
                check_in TEXT NOT NULL,
                check_out TEXT NOT NULL,
                guests INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending'
            )
            '''
        )

        is_pytest_run = ('pytest' in sys.modules or os.environ.get('PYTEST_CURRENT_TEST') is not None)

        if not is_pytest_run:
            if conn.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0:
                conn.execute(
                    'INSERT INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
                    ('Demo User', '+1 (555) 123-4567', 'demo@example.com', 'Secret123!', 'user'),
                )
            else:
                conn.execute(
                    'INSERT OR IGNORE INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
                    ('Demo User', '+1 (555) 123-4567', 'demo@example.com', 'Secret123!', 'user'),
                )

        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                claim_id TEXT,
                patient TEXT,
                provider TEXT,
                payer TEXT,
                dos TEXT,
                charged REAL DEFAULT 0,
                paid REAL DEFAULT 0,
                balance REAL DEFAULT 0,
                status TEXT DEFAULT 'Pending',
                user_email TEXT
            )
            '''
        )

        ensure_column('claims', 'user_email', 'TEXT')

        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS denials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                denial_id TEXT,
                claim_id TEXT,
                code TEXT,
                description TEXT,
                amount REAL DEFAULT 0,
                denied_date TEXT,
                root_cause TEXT,
                status TEXT DEFAULT 'Open',
                user_email TEXT
            )
            '''
        )

        # Must run after the denials table exists on older databases.
        ensure_column('denials', 'user_email', 'TEXT')

        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_id TEXT,
                claim_id TEXT,
                amount REAL DEFAULT 0,
                posted_date TEXT,
                remittance_ref TEXT,
                payer TEXT,
                user_email TEXT
            )
            '''
        )

        ensure_column('payments', 'user_email', 'TEXT')

        conn.commit()
    finally:
        conn.close()
