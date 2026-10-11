"""Seed the demo user with real claims so the deployed dashboard is not empty.

Idempotent: only inserts data when the demo user has no claims yet, so it is
safe to run on every deploy. Run with:  python backend/seed.py
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import get_connection, init_db  # noqa: E402

DEMO_EMAIL = 'demo@example.com'

# (patient, provider, payer, days_ago, charged, paid, status)
DEMO_CLAIMS = [
    ('Patient #1 (MRN126225)', 'Dr. Robert Taylor (Orthopedic)', 'UnitedHealthcare', 12, 4200.00, 1500.00, 'In Process'),
    ('Patient #2 (MRN126226)', 'Dr. Emily Chen (Cardiology)', 'Blue Cross', 38, 8600.00, 3000.00, 'Submitted'),
    ('Patient #3 (MRN126227)', 'Dr. Marcus Lee (Radiology)', 'Aetna', 55, 1900.00, 0.00, 'Denied'),
    ('Patient #4 (MRN126228)', 'Dr. Robert Taylor (Orthopedic)', 'Cigna', 74, 6400.00, 2400.00, 'Acknowledged'),
    ('Patient #5 (MRN126229)', 'Dr. Sarah Patel (Neurology)', 'UnitedHealthcare', 105, 11250.00, 4000.00, 'Appealed'),
    ('Patient #6 (MRN126230)', 'Dr. Emily Chen (Cardiology)', 'Blue Cross', 140, 3350.00, 3350.00, 'Paid'),
    ('Patient #7 (MRN126231)', 'Dr. Marcus Lee (Radiology)', 'Aetna', 33, 2750.00, 800.00, 'Created'),
    ('Patient #8 (MRN126232)', 'Dr. Sarah Patel (Neurology)', 'Cigna', 88, 5200.00, 1000.00, 'In Process'),
]


def seed() -> None:
    init_db()
    conn = get_connection()
    try:
        user = conn.execute(
            'SELECT id FROM users WHERE email = ?', (DEMO_EMAIL,)
        ).fetchone()

        if not user:
            conn.execute(
                'INSERT INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
                ('Demo User', '+1 (555) 123-4567', DEMO_EMAIL, 'Secret123!', 'user'),
            )
            conn.commit()
            print(f'Created demo user {DEMO_EMAIL}')

        existing = conn.execute(
            'SELECT COUNT(*) AS count FROM claims WHERE user_email = ?', (DEMO_EMAIL,)
        ).fetchone()['count']

        if existing:
            print(f'Demo user already has {existing} claim(s); skipping seed.')
            return

        today = date.today()
        for index, (patient, provider, payer, days_ago, charged, paid, status) in enumerate(DEMO_CLAIMS, start=1):
            dos = (today - timedelta(days=days_ago)).isoformat()
            balance = charged - paid
            conn.execute(
                '''
                INSERT INTO claims (claim_id, patient, provider, payer, dos, charged, paid, balance, status, user_email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    f'CLM-{1000 + index}',
                    patient,
                    provider,
                    payer,
                    dos,
                    charged,
                    paid,
                    balance,
                    status,
                    DEMO_EMAIL,
                ),
            )

        conn.commit()
        print(f'Seeded {len(DEMO_CLAIMS)} claims for {DEMO_EMAIL}')
    finally:
        conn.close()


if __name__ == '__main__':
    seed()
