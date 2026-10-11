from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import get_connection, init_db
from schemas import ClaimCreate, DenialCreate, PaymentCreate, PaymentResponse, ReservationCreate, ReservationResponse, UserCreate, UserLogin

app = FastAPI(title='RevoraX', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

load_dotenv()

JWT_SECRET = os.getenv('JWT_SECRET')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

if not JWT_SECRET:
    raise RuntimeError('JWT_SECRET is missing. Set it in the .env file.')

security = HTTPBearer(auto_error=False)

init_db()


def create_token(user: dict[str, Any]) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=12)
    token_payload = {
        'sub': str(user['id']),
        'email': user['email'],
        'role': user['role'],
        'exp': expiration,
    }
    return jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required')

    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token') from exc

    user_id = payload.get('sub')
    conn = get_connection()
    try:
        user = conn.execute(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            (int(user_id),),
        ).fetchone()
    finally:
        conn.close()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found')

    return {'id': user['id'], 'name': user['name'], 'email': user['email'], 'role': user['role']}


@app.get('/api/health')
def health_check() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/api/auth/signup')
def signup(payload: UserCreate) -> dict[str, Any]:
    conn = get_connection()
    try:
        existing = conn.execute('SELECT id FROM users WHERE email = ?', (payload.email.lower(),)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail='User already exists')

        role = payload.role.lower() if payload.role else 'user'
        if role not in {'user', 'admin'}:
            role = 'user'

        cursor = conn.execute(
            'INSERT INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
            (payload.name.strip(), payload.phone.strip(), payload.email.lower(), payload.password, role),
        )
        conn.commit()
        user = conn.execute(
            'SELECT id, name, phone, email, role FROM users WHERE id = ?', (cursor.lastrowid,)
        ).fetchone()
        token = create_token({'id': user['id'], 'name': user['name'], 'email': user['email'], 'role': user['role']})
        return {'token': token, 'user': {'id': user['id'], 'name': user['name'], 'phone': user['phone'], 'email': user['email'], 'role': user['role']}}
    finally:
        conn.close()


@app.post('/api/auth/login')
def login(payload: UserLogin) -> dict[str, Any]:
    conn = get_connection()
    try:
        user = conn.execute(
            'SELECT id, name, phone, email, password, role FROM users WHERE email = ?',
            (payload.email.lower(),),
        ).fetchone()
        if not user or user['password'] != payload.password:
            raise HTTPException(status_code=401, detail='Invalid email or password')
        token = create_token({'id': user['id'], 'name': user['name'], 'email': user['email'], 'role': user['role']})
        return {'token': token, 'user': {'id': user['id'], 'name': user['name'], 'phone': user['phone'], 'email': user['email'], 'role': user['role']}}
    finally:
        conn.close()


@app.get('/api/me')
def get_me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {'user': current_user}


@app.get('/api/dashboard')
def dashboard(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    conn = get_connection()
    try:
        total_reservations = conn.execute('SELECT COUNT(*) AS count FROM reservations').fetchone()['count']
        pending = conn.execute("SELECT COUNT(*) AS count FROM reservations WHERE status = 'Pending'").fetchone()['count']
        confirmed = conn.execute("SELECT COUNT(*) AS count FROM reservations WHERE status = 'Confirmed'").fetchone()['count']
        cancelled = conn.execute("SELECT COUNT(*) AS count FROM reservations WHERE status = 'Cancelled'").fetchone()['count']

        # Scope dashboard totals to the same claims the user can see in the
        # claims list, otherwise the dashboard counts every user's claims.
        claim_query = 'SELECT claim_id, dos, charged, paid, balance, status FROM claims'
        claim_values: list[Any] = []
        if current_user['role'] != 'admin':
            claim_query += ' WHERE user_email = ?'
            claim_values.append(current_user['email'])

        claims = conn.execute(claim_query, claim_values).fetchall()

        # Everything starts at zero when there are no claims.
        total_claims = len(claims)

        # Outstanding AR is the sum of every claim balance still owed.
        outstanding_ar = sum(float(claim['balance'] or 0.0) for claim in claims)

        # Collected is the total amount paid across all claims.
        collected_mtd = sum(float(claim['paid'] or 0.0) for claim in claims)

        # Collection rate is the share of outstanding AR that has been collected:
        # collected / (collected + outstanding). Falls back to paid/charged when
        # no balances have been recorded yet, and is 0% when there is no data.
        collection_base = collected_mtd + outstanding_ar
        if collection_base > 0:
            collection_rate = (collected_mtd / collection_base) * 100
        else:
            total_charged = sum(float(claim['charged'] or 0.0) for claim in claims)
            collection_rate = (collected_mtd / total_charged * 100) if total_charged else 0.0

        today = datetime.now().date()
        # Standard AR aging buckets matching the frontend (5 tiers).
        aging_ranges = [
            {'label': '0-30 Days', 'min': 0, 'max': 30},
            {'label': '31-60 Days', 'min': 31, 'max': 60},
            {'label': '61-90 Days', 'min': 61, 'max': 90},
            {'label': '91-120 Days', 'min': 91, 'max': 120},
            {'label': '120+ Days', 'min': 121, 'max': None},
        ]

        def parse_dos(value):
            """Parse a date-of-service string, tolerating multiple formats."""
            if not value:
                return None
            text = str(value).strip()
            for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d-%b-%y', '%d-%b-%Y', '%m-%d-%Y', '%Y/%m/%d'):
                try:
                    return datetime.strptime(text, fmt).date()
                except ValueError:
                    pass
            try:
                return datetime.strptime(text.split('T')[0], '%Y-%m-%d').date()
            except ValueError:
                return None

        aging_buckets: list[dict[str, Any]] = []
        for bucket in aging_ranges:
            bucket_total = 0.0
            bucket_claims = 0
            weighted_progress = 0.0
            for claim in claims:
                dos = parse_dos(claim['dos'])
                if dos is None:
                    continue
                age_days = (today - dos).days
                if age_days < bucket['min']:
                    continue
                if bucket['max'] is not None and age_days > bucket['max']:
                    continue
                balance = float(claim['balance'] or 0.0)
                bucket_total += balance
                bucket_claims += 1
                if bucket['max'] is not None:
                    span = bucket['max'] - bucket['min']
                    progress = span > 0 and (age_days - bucket['min']) / span or 0
                    weighted_progress += balance * min(1.0, progress)
                else:
                    weighted_progress += balance * 0.8
            progress_pct = (weighted_progress / bucket_total * 100) if bucket_total > 0 else 0
            if bucket_total == 0 and bucket_claims > 0:
                progress_pct = 80.0 if bucket['max'] is None else 50.0
            aging_buckets.append({
                'label': bucket['label'],
                'value': f'${bucket_total:,.2f}',
                'amount': bucket_total,
                'progress': progress_pct,
                'claimCount': bucket_claims,
            })

        def fmt_money(value: float) -> str:
            return f'${value:,.2f}'

        return {
            'summary': {
                'total': total_reservations,
                'pending': pending,
                'confirmed': confirmed,
                'cancelled': cancelled,
            },
            'metrics': [
                {'label': 'Outstanding AR', 'value': fmt_money(outstanding_ar), 'trend': '', 'tone': 'danger'},
                {'label': 'Total Collected', 'value': fmt_money(collected_mtd), 'trend': '', 'tone': 'success'},
                {'label': 'Collection Rate', 'value': f'{collection_rate:.1f}%', 'trend': '', 'tone': 'success'},
                {'label': 'Total Claims', 'value': str(total_claims), 'trend': '', 'tone': 'info'},
            ],
            'agingBuckets': aging_buckets,
        }
    finally:
        conn.close()


@app.post('/api/claims')
def create_claim(payload: ClaimCreate, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    conn = get_connection()
    try:
        charged = float(payload.charged)
        paid = float(payload.paid)
        balance = float(payload.balance if payload.balance is not None else charged - paid)
        claim_id = f"CLM-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        cursor = conn.execute(
            '''
            INSERT INTO claims (claim_id, patient, provider, payer, dos, charged, paid, balance, status, user_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (claim_id, payload.patient, payload.provider, payload.payer, payload.dos, charged, paid, balance, payload.status, current_user['email']),
        )
        conn.commit()
        claim = conn.execute(
            'SELECT id, claim_id, patient, provider, payer, dos, charged, paid, balance, status FROM claims WHERE id = ?',
            (cursor.lastrowid,),
        ).fetchone()
        return {
            'id': claim['id'],
            'claimId': claim['claim_id'],
            'patient': claim['patient'],
            'provider': claim['provider'],
            'payer': claim['payer'],
            'dos': claim['dos'],
            'charged': float(claim['charged']),
            'paid': float(claim['paid']),
            'balance': float(claim['balance']),
            'status': claim['status'],
        }
    finally:
        conn.close()


@app.get('/api/claims')
def list_claims(
    status: str | None = None,
    search: str | None = None,
    payer: str | None = None,
    from_date: str | None = Query(default=None, alias='from'),
    to_date: str | None = Query(default=None, alias='to'),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        query = 'SELECT id, claim_id, patient, provider, payer, dos, charged, paid, balance, status FROM claims'
        clauses: list[str] = []
        values: list[Any] = []

        if current_user['role'] != 'admin':
            clauses.append('user_email = ?')
            values.append(current_user['email'])

        if status and status.lower() not in {'all', 'all statuses'}:
            clauses.append('status = ?')
            values.append(status)

        if payer and payer.lower() not in {'all', 'all payers'}:
            clauses.append('payer LIKE ?')
            values.append(f'%{payer}%')

        if search:
            clauses.append('(patient LIKE ? OR provider LIKE ? OR payer LIKE ? OR claim_id LIKE ?)')
            term = f'%{search}%'
            values.extend([term, term, term, term])

        if from_date:
            clauses.append('dos >= ?')
            values.append(from_date)

        if to_date:
            clauses.append('dos <= ?')
            values.append(to_date)

        if clauses:
            query += ' WHERE ' + ' AND '.join(clauses)

        query += ' ORDER BY id DESC'
        rows = conn.execute(query, values).fetchall()

        return [
            {
                'id': row['id'],
                'claimId': row['claim_id'],
                'patient': row['patient'],
                'provider': row['provider'],
                'payer': row['payer'],
                'dos': row['dos'],
                'charged': float(row['charged']),
                'paid': float(row['paid']),
                'balance': float(row['balance']),
                'status': row['status'],
            }
            for row in rows
        ]
    finally:
        conn.close()


@app.put('/api/claims/{claim_id}')
def update_claim(
    claim_id: int,
    payload: ClaimCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        claim = conn.execute(
            'SELECT id, claim_id, patient, provider, payer, dos, charged, paid, balance, status, user_email FROM claims WHERE id = ?',
            (claim_id,),
        ).fetchone()
        if not claim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Claim not found')

        if current_user['role'] != 'admin' and claim['user_email'] != current_user['email']:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='You do not have permission to edit this claim')

        charged = float(payload.charged)
        paid = float(payload.paid)
        balance = float(payload.balance if payload.balance is not None else charged - paid)

        conn.execute(
            '''
            UPDATE claims
            SET patient = ?, provider = ?, payer = ?, dos = ?, charged = ?, paid = ?, balance = ?, status = ?
            WHERE id = ?
            ''',
            (payload.patient, payload.provider, payload.payer, payload.dos, charged, paid, balance, payload.status, claim_id),
        )
        conn.commit()

        updated_claim = conn.execute(
            'SELECT id, claim_id, patient, provider, payer, dos, charged, paid, balance, status FROM claims WHERE id = ?',
            (claim_id,),
        ).fetchone()

        return {
            'id': updated_claim['id'],
            'claimId': updated_claim['claim_id'],
            'patient': updated_claim['patient'],
            'provider': updated_claim['provider'],
            'payer': updated_claim['payer'],
            'dos': updated_claim['dos'],
            'charged': float(updated_claim['charged']),
            'paid': float(updated_claim['paid']),
            'balance': float(updated_claim['balance']),
            'status': updated_claim['status'],
        }
    finally:
        conn.close()


@app.delete('/api/claims/{claim_id}')
def delete_claim(claim_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    conn = get_connection()
    try:
        claim = conn.execute(
            'SELECT id, user_email FROM claims WHERE id = ?',
            (claim_id,),
        ).fetchone()
        if not claim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Claim not found')
        if current_user['role'] != 'admin' and claim['user_email'] != current_user['email']:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='You do not have permission to delete this claim')

        conn.execute('DELETE FROM claims WHERE id = ?', (claim_id,))
        conn.commit()
        return {'status': 'deleted'}
    finally:
        conn.close()


@app.get('/api/denials')
def list_denials(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        query = 'SELECT id, denial_id, claim_id, code, description, amount, denied_date, root_cause, status FROM denials'
        clauses: list[str] = []
        values: list[Any] = []

        if current_user['role'] != 'admin':
            clauses.append('user_email = ?')
            values.append(current_user['email'])

        if clauses:
            query += ' WHERE ' + ' AND '.join(clauses)

        query += ' ORDER BY id DESC'
        rows = conn.execute(query, values).fetchall()

        return [
            {
                'id': row['id'],
                'denialId': row['denial_id'],
                'claimId': row['claim_id'],
                'code': row['code'],
                'description': row['description'],
                'amount': float(row['amount'] or 0),
                'deniedDate': row['denied_date'],
                'rootCause': row['root_cause'],
                'status': row['status'],
            }
            for row in rows
        ]
    finally:
        conn.close()


@app.post('/api/denials')
def create_denial(payload: DenialCreate, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    conn = get_connection()
    try:
        denial_id = f"DNL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        cursor = conn.execute(
            '''
            INSERT INTO denials (denial_id, claim_id, code, description, amount, denied_date, root_cause, status, user_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                denial_id,
                payload.claimId,
                payload.code,
                payload.description,
                float(payload.amount),
                payload.deniedDate,
                payload.rootCause,
                payload.status,
                current_user['email'],
            ),
        )
        conn.commit()
        row = conn.execute(
            'SELECT id, denial_id, claim_id, code, description, amount, denied_date, root_cause, status FROM denials WHERE id = ?',
            (cursor.lastrowid,),
        ).fetchone()
        return {
            'id': row['id'],
            'denialId': row['denial_id'],
            'claimId': row['claim_id'],
            'code': row['code'],
            'description': row['description'],
            'amount': float(row['amount']),
            'deniedDate': row['denied_date'],
            'rootCause': row['root_cause'],
            'status': row['status'],
        }
    finally:
        conn.close()


@app.put('/api/denials/{denial_id}')
def update_denial(
    denial_id: int,
    payload: DenialCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        existing = conn.execute('SELECT id, user_email FROM denials WHERE id = ?', (denial_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Denial not found')
        if current_user['role'] != 'admin' and existing['user_email'] != current_user['email']:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='You do not have permission to edit this denial')

        conn.execute(
            '''
            UPDATE denials
            SET claim_id = ?, code = ?, description = ?, amount = ?, denied_date = ?, root_cause = ?, status = ?
            WHERE id = ?
            ''',
            (payload.claimId, payload.code, payload.description, float(payload.amount), payload.deniedDate, payload.rootCause, payload.status, denial_id),
        )
        conn.commit()
        row = conn.execute(
            'SELECT id, denial_id, claim_id, code, description, amount, denied_date, root_cause, status FROM denials WHERE id = ?',
            (denial_id,),
        ).fetchone()
        return {
            'id': row['id'],
            'denialId': row['denial_id'],
            'claimId': row['claim_id'],
            'code': row['code'],
            'description': row['description'],
            'amount': float(row['amount']),
            'deniedDate': row['denied_date'],
            'rootCause': row['root_cause'],
            'status': row['status'],
        }
    finally:
        conn.close()


@app.delete('/api/denials/{denial_id}')
def delete_denial(denial_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    conn = get_connection()
    try:
        existing = conn.execute('SELECT id, user_email FROM denials WHERE id = ?', (denial_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Denial not found')
        if current_user['role'] != 'admin' and existing['user_email'] != current_user['email']:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='You do not have permission to delete this denial')

        conn.execute('DELETE FROM denials WHERE id = ?', (denial_id,))
        conn.commit()
        return {'status': 'deleted'}
    finally:
        conn.close()


@app.get('/api/payments')
def list_payments(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        query = 'SELECT id, payment_id, claim_id, amount, posted_date, remittance_ref, payer FROM payments'
        clauses: list[str] = []
        values: list[Any] = []

        if current_user['role'] != 'admin':
            clauses.append('payer LIKE ?')
            values.append(f"%{current_user['email']}%")

        if clauses:
            query += ' WHERE ' + ' AND '.join(clauses)

        query += ' ORDER BY id DESC'
        rows = conn.execute(query, values).fetchall()

        return [
            {
                'id': row['id'],
                'paymentId': row['payment_id'],
                'claim': row['claim_id'],
                'amount': row['amount'],
                'postedDate': row['posted_date'],
                'remittanceRef': row['remittance_ref'],
                'payer': row['payer'],
            }
            for row in rows
        ]
    finally:
        conn.close()


@app.post('/api/payments')
def create_payment(payload: PaymentCreate, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    conn = get_connection()
    try:
        from datetime import datetime
        payment_id = f"PMT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        cursor = conn.execute(
            'INSERT INTO payments (payment_id, claim_id, amount, posted_date, remittance_ref, payer, user_email) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (payment_id, payload.claim, payload.amount, payload.postedDate, payload.remittanceRef, payload.payer, current_user['email']),
        )
        conn.commit()
        payment_id_row = cursor.lastrowid
        row = conn.execute(
            'SELECT id, payment_id, claim_id, amount, posted_date, remittance_ref, payer FROM payments WHERE id = ?',
            (payment_id_row,),
        ).fetchone()
        return {
            'id': row['id'],
            'paymentId': row['payment_id'],
            'claim': row['claim_id'],
            'amount': row['amount'],
            'postedDate': row['posted_date'],
            'remittanceRef': row['remittance_ref'],
            'payer': row['payer'],
        }
    finally:
        conn.close()


@app.delete('/api/payments/{payment_id}')
def delete_payment(payment_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    conn = get_connection()
    try:
        conn.execute('DELETE FROM payments WHERE id = ?', (payment_id,))
        conn.commit()
        return {'status': 'deleted'}
    finally:
        conn.close()


@app.get('/api/reservations')
def list_reservations() -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            'SELECT id, guest_name, room_type, check_in, check_out, guests, status FROM reservations ORDER BY id DESC'
        ).fetchall()
        return [
            {
                'id': row['id'],
                'guestName': row['guest_name'],
                'roomType': row['room_type'],
                'checkIn': row['check_in'],
                'checkOut': row['check_out'],
                'guests': row['guests'],
                'status': row['status'],
            }
            for row in rows
        ]
    finally:
        conn.close()


@app.post('/api/reservations', response_model=ReservationResponse)
def create_reservation(payload: ReservationCreate) -> dict[str, Any]:
    conn = get_connection()
    try:
        cursor = conn.execute(
            'INSERT INTO reservations (guest_name, room_type, check_in, check_out, guests, status) VALUES (?, ?, ?, ?, ?, ?)',
            (payload.guestName, payload.roomType, payload.checkIn, payload.checkOut, payload.guests, payload.status),
        )
        conn.commit()
        reservation_id = cursor.lastrowid
        reservation = conn.execute(
            'SELECT id, guest_name, room_type, check_in, check_out, guests, status FROM reservations WHERE id = ?',
            (reservation_id,),
        ).fetchone()
        return {
            'id': reservation['id'],
            'guestName': reservation['guest_name'],
            'roomType': reservation['room_type'],
            'checkIn': reservation['check_in'],
            'checkOut': reservation['check_out'],
            'guests': reservation['guests'],
            'status': reservation['status'],
        }
    finally:
        conn.close()


from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

static_dir = os.path.join(os.path.dirname(__file__), 'static')


@app.get('/{full_path:path}')
async def serve_frontend(full_path: str):
    return FileResponse(os.path.join(static_dir, 'index.html'))

if os.path.isdir(static_dir):
    app.mount('/assets', StaticFiles(directory=os.path.join(static_dir, 'assets')), name='assets')


if __name__ == '__main__':
    import uvicorn

    port = int(os.getenv('PORT', '8000'))
    uvicorn.run('main:app', host='0.0.0.0', port=port)
