# Food AI

**Food AI adalah sistem operasi manajemen F&B** yang menggabungkan knowledge, data operasional, perhitungan bisnis, dashboard, workflow, dan AI.

## Tujuan

Membangun fondasi yang dapat digunakan mulai dari satu outlet sampai bisnis F&B multi-outlet.

Food AI bukan hanya chatbot atau gudang artikel. Sistem harus mampu menghubungkan:

**Data → Perhitungan → Insight → Keputusan → Tindakan → Evaluasi.**

## Arsitektur fondasi

- Identity & Access
- Organization / Brand
- Outlet / Branch
- Role & Permission
- Audit Log
- Master Data
- Inventory
- Purchasing
- Receiving
- Recipe & Standard Recipe
- HPP / Costing
- Menu Engineering
- Sales & Finance
- SOP & Training
- Food Safety
- Halal Compliance
- Analytics & KPI
- AI Analyst
- Forecasting

Dokumentasi fondasi:

- `00-foundation/architecture.md`
- `00-foundation/rbac.md`
- `00-foundation/firebase-data-model.md`
- `10-year-roadmap.md`

## Role utama

- Owner
- Admin
- Manager
- Purchasing
- Warehouse
- Kitchen
- Cashier
- Service
- Finance
- Viewer

Akses tidak ditentukan oleh role saja. Food AI menggunakan **Role + Permission + Scope** agar pengguna hanya dapat mengakses data dan tindakan yang memang menjadi kewenangannya.

## Owner Dashboard

Owner akan memiliki dashboard organisasi yang dapat melihat:

- seluruh outlet
- outlet tertentu
- omzet
- gross profit
- food cost
- inventory
- perubahan harga bahan
- purchasing
- waste
- menu performance
- labor / prime cost
- KPI
- AI insights

## Firebase

Firebase menjadi backend operasional dengan:

- Firebase Authentication
- Cloud Firestore
- Cloud Storage
- Firestore Security Rules
- Cloud Functions / server-side trusted operations bila diperlukan
- App Check bila sesuai dengan arsitektur client

**Security rules adalah sumber otorisasi sebenarnya.** Frontend hanya menyembunyikan UI; frontend tidak boleh menjadi pengaman data.

## Prioritas implementasi

### Phase 1 — Identity & tenancy

Authentication, organization, members, roles, permissions, outlet scope, dan audit foundation.

### Phase 2 — Inventory core

Ingredients, suppliers, warehouses, stock movements, stock opname, waste, dan price history.

### Phase 3 — F&B costing

Recipes, recipe versions, HPP, menu prices, dan price history.

### Phase 4 — Purchasing

Purchase request, approval, purchase order, receiving.

### Phase 5 — Dashboard & AI

Owner dashboard, manager dashboard, operational dashboards, alerts, AI analysis, dan forecasting.

## Prinsip penting

1. Jangan menghapus histori penting; gunakan adjustment/reversal.
2. Perubahan harga harus dapat dilacak.
3. Perubahan stok harus dapat dijelaskan melalui ledger/movement.
4. Perubahan sensitif harus memiliki audit trail.
5. AI tidak boleh melihat data yang tidak boleh dilihat user.
6. Scope outlet harus ditegakkan di backend.
7. Firebase schema dan rules dikembangkan bersama fitur, bukan setelah UI selesai.
