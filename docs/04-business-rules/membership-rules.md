# Règles Métier Membres

**Doc ID:** DOC-BUSINESS-RULES-MEMBERS  
**Version:** 2.0

---

## 1. Règles d'Enregistrement Membre

| Règle | Description |
|---|---|
| **BR-MEM-001** | Prénom et nom obligatoires |
| **BR-MEM-002** | Email valide si fourni |
| **BR-MEM-003** | Téléphone formatté selon région |
| **BR-MEM-004** | Date de naissance cohérente (âge 0-120 ans) |
| **BR-MEM-005** | Duplicate email détecté avant création |

## 2. Règles de Statut Membre

| Règle | Description |
|---|---|
| **BR-MEM-010** | États : active, inactive, deceased, transferred |
| **BR-MEM-011** | Un membre inactive ne peut pas créer de transactions |
| **BR-MEM-012** | Transfert vers une autre église nécessite un certificat |

## 3. Règles d'Attribution Ministère

| Règle | Description |
|---|---|
| **BR-MEM-020** | Un membre peut appartenir à plusieurs ministères |
| **BR-MEM-021** | Attribution doit être validée par le responsable du ministère |
| **BR-MEM-022** | Historique des attributions conservé |
