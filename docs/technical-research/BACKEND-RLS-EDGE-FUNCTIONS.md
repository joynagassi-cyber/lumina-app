# RLS Policies & Edge Functions — Lumina v2

**Doc ID:** DOC-BACKEND-RLS-EDGE  
**Version:** 2.0  
**Statut:** SPÉCIFICATION COMPLÈTE  
**Dépendances:** ADR-006, Backend-Implementation-Guide.md

---

## 1. Règle Générale RLS

Toutes les tables avec `org_id` ont RLS activé:

```sql
-- Modèle réutilisé pour TOUTES les tables avec org_id
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON <table_name>
  FOR ALL
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);
```

**Exceptions** (tables sans org_id): `organizations`, `user_sessions`.

---

## 2. Policies Spéciales Par Table

### 2.1 Transactions — Immutabilité approved (INV-001 + NB-RULE-03)

```sql
-- Seule une insertion (create) est permise sur status='approved'
CREATE POLICY transaction_read_all ON transactions
  FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY transaction_insert ON transactions
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY transaction_update_draft_only ON transactions
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (
    org_id = current_setting('app.current_org_id')::uuid
    AND (
      NEW.status IN ('draft', 'pending', 'rejected')
      OR NEW.version > OLD.version
    )
  );

-- Suppression interdit INV-001: corrections via compensates_for seulement
CREATE POLICY transaction_delete_disallowed ON transactions
  FOR DELETE
  USING (false);  -- jamais de delete
```

### 2.2 Audit Logs — Lecture seule, jamais de modification

```sql
CREATE POLICY audit_read_only ON audit_logs
  FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY audit_no_insert ON audit_logs
  FOR INSERT
  WITH CHECK (false);  -- insert automatique par trigger edge function

CREATE POLICY audit_no_update ON audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY audit_no_delete ON audit_logs
  FOR DELETE
  USING (false);
```

### 2.3 Pending Operations — Admin uniquement pour validation

```sql
CREATE POLICY pending_ops_pull ON pending_operations
  FOR SELECT
  USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND sync_status IN ('pending', 'sent', 'failed')
  );

CREATE POLICY pending_ops_update_confirmed ON pending_operations
  FOR UPDATE
  USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND sync_status = 'sent'
  )
  WITH CHECK (sync_status = 'confirmed');
```

### 2.4 Users — Un user ne voit que son org

```sql
CREATE POLICY users_isolation ON users
  FOR ALL
  USING (
    org_id = current_setting('app.current_org_id')::uuid
  );

-- Superadmin voit toutes les orgs (policy séparée)
CREATE POLICY superadmin_see_all_users ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'superadmin'
    )
  );
```

### 2.5 Notifications — Isolation user + org

```sql
CREATE POLICY notifications_user_read ON notifications
  FOR SELECT
  USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND user_id = auth.uid()
  );

CREATE POLICY notifications_insert_edge ON notifications
  FOR INSERT
  WITH CHECK (false);  -- Insert uniquement via edge function

CREATE POLICY notifications_mark_read ON notifications
  FOR UPDATE
  USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND user_id = auth.uid()
    AND read_at IS NULL
  )
  WITH CHECK (read_at IS NOT NULL);
```

### 2.6 Archive Entries

```sql
CREATE POLICY archive_search ON archive_entries
  FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY archive_insert ON archive_entries
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY archive_update_active ON archive_entries
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid AND state = 'active')
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY archive_trash_soft ON archive_entries
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid AND state = 'active')
  WITH CHECK (state = 'trashed' AND trash_date = NOW());

CREATE POLICY archive_purge_scheduled ON archive_entries
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid AND state = 'trashed')
  WITH CHECK (state = 'purged' AND purge_date = NOW());
```

---

## 3. Trigger de Détection de Cycles DAG

```sql
-- Détection de cycles dans org_units (hiérarchie)
CREATE OR REPLACE FUNCTION check_org_unit_cycle()
RETURNS TRIGGER AS $$
DECLARE
    ancestor UUID;
BEGIN
    ancestor := NEW.parent_unit_id;
    WHILE ancestor IS NOT NULL LOOP
        IF ancestor = NEW.id THEN
            RAISE EXCEPTION 'Cycle detected in org_units hierarchy';
        END IF;
        SELECT parent_unit_id INTO ancestor
        FROM org_units WHERE id = ancestor;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_cycle
BEFORE INSERT OR UPDATE ON org_units
FOR EACH ROW EXECUTE FUNCTION check_org_unit_cycle();
```

---

## 4. Edge Functions Contracts (InsForge)

### 4.1 validate-transaction

| Champ | Valeur |
|---|---|
| **HTTP Method** | POST |
| **URL** | `/edge/validate-transaction` |
| **Headers** | `Authorization: Bearer <token>`, `x-org-id: <uuid>` |
| **Input** | `{ type: string, amount: number, currency: string, category_id: uuid, description?: string, scope_type?: 'org' \| 'group', scope_target?: uuid }` |
| **Output success** | `{ valid: true, approved_by: 'treasurer' \| 'pastor' \| 'board', workflow_id: string }` |
| **Output error** | `{ valid: false, errors: [{ field: string, code: string, message: string }] }` |
| **Validation BR** | BR-FIN-001 à BR-FIN-005, BR-FIN-010 à BR-FIN-013 |

### 4.2 calculate-bilan

| Champ | Valeur |
|---|---|
| **HTTP Method** | POST |
| **URL** | `/edge/calculate-bilan` |
| **Input** | `{ org_id: uuid, scope: 'org' \| 'group' \| 'all', period_start: ISO8601, period_end: ISO8601, format?: 'org' \| 'group_only' \| 'consolidated' }` |
| **Output** | `{ income: number, expense: number, net_result: number, by_category: Record<string, {income: number, expense: number}>, transactions_count: number, scope: string }` |
| **Optimisation** | Utilise index `idx_transactions_scope`, filtre status='approved' uniquement |

### 4.3 sync-pending

| Champ | Valeur |
|---|---|
| **HTTP Method** | POST |
| **URL** | `/edge/sync-pending` |
| **Input** | `{ operations: Array<{ resource_type: string, resource_id: uuid, action: string, payload: object, timestamp_client: ISO8601, version?: number }> }` |
| **Output success** | `{ confirmed: uuid[], conflicts: Array<{ resource_id: uuid, server_version: number, client_version: number }> }` |
| **Strategy** | Pessimistic lock: vérifie version avant write, LWW pour members/events |

### 4.4 generate-report

| Champ | Valeur |
|---|---|
| **HTTP Method** | POST |
| **URL** | `/edge/generate-report` |
| **Input** | `{ report_type: string, period_start: ISO8601, period_end: ISO8601, format: 'pdf' \| 'csv', org_id: uuid }` |
| **Output** | `{ file_url: string, generated_at: ISO8601 }` |
| **Template** | Handlebars → PDF via puppeteer-core sur Edge |

### 4.5 archive-create

| Champ | Valeur |
|---|---|
| **HTTP Method** | POST |
| **URL** | `/edge/archive-create` |
| **Input** | `{ archived_by: uuid, resource_type: string, resource_id: string, metadata: object, tags?: string[], category?: string, linked_member_id?: uuid }` |
| **Output** | `{ id: uuid, state: 'archived', created_at: ISO8601 }` |
| **Validation** | Vérifie que `resource_type` existe dans manifest.lifecycle.types |

### 4.6 archive-search

| Champ | Valeur |
|---|---|
| **HTTP Method** | POST |
| **URL** | `/edge/archive-search` |
| **Input** | `{ query?: string, resource_type?: string, tags?: string[], state?: string, limit?: number, offset?: number, from_date?: ISO8601, to_date?: ISO8601 }` |
| **Output** | `{ results: Array<{ id, metadata, state, archived_at, resource_type }>, total: number }` |
| **Optimisation** | GIN index sur tags + tsvector full-text search |

### 4.7 authorize (Auth Central)

| Champ | Valeur |
|---|---|
| **HTTP Method** | POST |
| **URL** | `/edge/authorize` |
| **Input** | `{ permission: string, scope_type?: 'org' \| 'group', scope_target?: uuid }` |
| **Output** | `{ authorized: boolean, role: string, permissions: string[] }` |
| **Cache** | JWT cache 5min (Redis ou memory) |

---

## 5. Résumé des Edge Functions

| # | Function | Purpose | Critical Invariants |
|---|---|---|---|
| 1 | `validate-transaction` | Validate + route approval workflow | INV-001, BR-FIN-001, BR-FIN-010-013 |
| 2 | `calculate-bilan` | Server-side balance calculation | BR-FIN-020 |
| 3 | `sync-pending` | Push conflict resolution | INV-008, NB-RULE-06 |
| 4 | `generate-report` | PDF/CSV generation | BR-FIN-022, BR-FIN-023 |
| 5 | `archive-create` | Create archivable entry | Lifecycle state machine |
| 6 | `archive-search` | Full-text + GIN search | Archive metadata flexibility |
| 7 | `authorize` | Server-side permission gate | RBAC manifest-based |

Total: **7 edge functions**. Aucune n'est métier — toutes sont des capacités de la Platform.
