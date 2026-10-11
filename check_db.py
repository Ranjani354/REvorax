import sys
sys.path.insert(0, 'C:/Users/ABC/Rcm/backend')
from database import init_db, get_connection

init_db()
conn = get_connection()
users = conn.execute('SELECT * FROM users').fetchall()
print(f'Users in DB: {len(users)}')
for u in users:
    print(f"  - {u['email']} ({u['role']})")

claims = conn.execute('SELECT COUNT(*) FROM claims').fetchone()
reservations = conn.execute('SELECT COUNT(*) FROM reservations').fetchone()
print(f"Claims: {claims[0]}, Reservations: {reservations[0]}")
conn.close()
