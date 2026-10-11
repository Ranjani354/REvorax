import re

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    name: str
    phone: str
    email: EmailStr
    password: str
    role: str = 'user'

    @field_validator('name')
    @classmethod
    def validate_name(cls, value: str) -> str:
        if len(value.strip()) < 2:
            raise ValueError('Name must contain at least 2 characters.')
        if not re.fullmatch(r"[A-Za-z][A-Za-z\s'.-]{1,59}", value.strip()):
            raise ValueError('Name can only contain letters, spaces, dots, apostrophes, and hyphens.')
        return value.strip()

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, value: str) -> str:
        cleaned = re.sub(r'[^\d+()]', '', value.strip())
        if len(re.sub(r'\D', '', cleaned)) < 10 or len(re.sub(r'\D', '', cleaned)) > 15:
            raise ValueError('Phone number must contain 10 to 15 digits.')
        return cleaned

    @field_validator('password')
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError('Password must be at least 8 characters long.')
        if not re.search(r'[A-Z]', value):
            raise ValueError('Password must contain at least one uppercase letter.')
        if not re.search(r'[a-z]', value):
            raise ValueError('Password must contain at least one lowercase letter.')
        if not re.search(r'\d', value):
            raise ValueError('Password must contain at least one number.')
        if not re.search(r'[^A-Za-z0-9]', value):
            raise ValueError('Password must contain at least one special character.')
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ReservationCreate(BaseModel):
    guestName: str
    roomType: str
    checkIn: str
    checkOut: str
    guests: int
    status: str = 'Pending'


class ClaimCreate(BaseModel):
    patient: str
    provider: str
    payer: str
    dos: str
    charged: float
    paid: float = 0.0
    balance: float | None = None
    status: str = 'Pending'


class DenialCreate(BaseModel):
    claimId: str
    code: str
    description: str
    amount: float
    deniedDate: str
    rootCause: str
    status: str = 'Open'


class PaymentCreate(BaseModel):
    claim: str
    amount: float
    postedDate: str
    remittanceRef: str | None = None
    payer: str = ''


class PaymentResponse(BaseModel):
    id: int
    paymentId: str
    claim: str
    amount: float
    postedDate: str
    remittanceRef: str | None = None
    payer: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str = 'user'


class ReservationResponse(BaseModel):
    id: int
    guestName: str
    roomType: str
    checkIn: str
    checkOut: str
    guests: int
    status: str
