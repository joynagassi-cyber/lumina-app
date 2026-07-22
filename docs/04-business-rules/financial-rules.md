# Règles Métier Financières

**Doc ID:** DOC-BUSINESS-RULES-FINANCE  
**Version:** 2.0

---

## 1. Règles d'Enregistrement

| Règle | Description |
|---|---|
| **BR-FIN-001** | Chaque transaction doit avoir un type (income, expense, transfer) |
| **BR-FIN-002** | Montant strictement positif ou nul (zéro interdit) |
| **BR-FIN-003** | Date ne peut pas être dans le futur |
| **BR-FIN-004** | Catégorie obligatoire, doit exister dans le vocabulaire |
| **BR-FIN-005** | Description minimum 1 caractère si montant > 100 |

## 2. Règles d'Approbation

| Règle | Description |
|---|---|
| **BR-FIN-010** | Transaction < max_auto_approve : approuvée automatiquement |
| **BR-FIN-011** | Transaction >= seuil_large : nécessite double approbation |
| **BR-FIN-012** | Rejet → retour en draft pour modification |
| **BR-FIN-013** | Approbation doit inclure un commentaire (raison) |

## 3. Règles de Reporting

| Règle | Description |
|---|---|
| **BR-FIN-020** | Bilan doit s'équilibrer (Actif = Passif + Résultat) |
| **BR-FIN-021** | Rapport mensal couvre du 1er au dernier du mois |
| **BR-FIN-022** | Export PDF inclut horodatage et signature numérique |
| **BR-FIN-023** | Un rapport archivé ne peut pas être modifié |

## 4. Règles d'Audit

| Règle | Description |
|---|---|
| **BR-FIN-030** | Toute modification logguée avec old_value et new_value |
| **BR-FIN-031** | Logs d'audit conservés minimum 7 ans |
| **BR-FIN-032** | Impossible d'effacer un log d'audit |
| **BR-FIN-033** | Accès aux logs restreint aux admins et auditeurs |
