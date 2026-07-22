# API Contracts — Contrats d'Interface Lumina

**Doc ID:** DOC-API-CONTRACTS  
**Version:** 2.0

---

## 1. Endpoints Critiques du MVP

### 1.1 Authentification

```
POST /api/v1/auth/login
Body: { email: string, password: string }
Response: { token: string, user: User }

POST /api/v1/auth/logout
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: { success: true }

GET /api/v1/auth/me
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: { user: User, permissions: string[] }
```

### 1.2 Transactions Financières

```
GET /api/v1/finance/transactions
Query: { page?: number, limit?: number, status?: string, date_from?: string, date_to?: string }
Headers: { x-org-id: <uuid> }
Response: { transactions: Transaction[], total: number }

POST /api/v1/finance/transactions
Body: { type: string, amount: number, category: string, description?: string, date?: string }
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: { transaction: Transaction }

PUT /api/v1/finance/transactions/:id/approve
Body: { comment?: string }
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: { transaction: Transaction }

POST /api/v1/finance/transactions/:id/compensate
Body: { reason: string, new_category?: string }
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: { original: Transaction, compensation: Transaction }
```

### 1.3 Bilan Financier

```
GET /api/v1/finance/bilan
Query: { period: "monthly" | "quarterly" | "yearly", year: number, month?: number }
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: {
    period: string,
    total_income: number,
    total_expense: number,
    net_result: number,
    assets: { label: string, value: number }[],
    liabilities: { label: string, value: number }[],
    equity: { label: string, value: number }[]
}
```

### 1.4 Membres

```
GET /api/v1/members
Query: { page?: number, limit?: number, search?: string, department?: string }
Headers: { x-org-id: <uuid> }
Response: { members: Member[], total: number }

POST /api/v1/members
Body: { first_name, last_name, email?, phone?, date_of_birth?, gender?, photo? }
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: { member: Member }

PUT /api/v1/members/:id
Body: { first_name?, last_name?, email?, phone?, date_of_birth?, gender?, photo? }
Headers: { Authorization: Bearer <token>, x-org-id: <uuid> }
Response: { member: Member }
```

## 2. Types de Données Partagés

```typescript
interface Transaction {
    id: string;
    org_id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    currency: string;
    category: string;
    description?: string;
    date: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
    created_by: string;
    approved_by?: string;
    approved_at?: string;
    compensates_for?: string;
    compensated_by?: string;
    created_at: string;
    updated_at: string;
}

interface Member {
    id: string;
    org_id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    photo_url?: string;
    status: 'active' | 'inactive' | 'deceased' | 'transferred';
    ministries: string[];
    created_at: string;
    updated_at: string;
}

interface User {
    id: string;
    org_id: string;
    email: string;
    role: string;
    permissions: string[];
    first_name: string;
    last_name: string;
    created_at: string;
}
```

## 3. Erreurs Standardisées

```typescript
interface APIError {
    code: string;          // 'AUTH_REQUIRED', 'ORG_NOT_FOUND', 'TRANSACTION_IMMUTABLE'
    message: string;       // Message lisible
    details?: Record<string, string[]>;  // Détails spécifiques (ex: validation errors)
    timestamp: string;
}
```
