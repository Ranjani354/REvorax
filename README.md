# RevoraX

This project includes a FastAPI backend with SQLite storage and a React frontend for login, signup, dashboard, and reservation management.

## Backend setup

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Database

The backend uses SQLite and stores users and reservations in the local database file `backend/app.db`.

## Test

```bash
cd c:\Users\ABC\Rcm
python -m pytest backend/tests/test_api.py -q
```
