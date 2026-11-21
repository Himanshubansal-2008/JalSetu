# JalSetu

> In-class mobile app project: an Operation & Maintenance tool for Gram Panchayats to manage drinking water supply assets, consumables inventory, finances and consumer billing.

---

## 1. Problem Statement

**Development of a handheld/mobile based Operation & Maintenance tool for asset & consumables inventories and finance management in the context of a drinking water supply scheme.**


## 2. Our Solution

JalSetu gives a Gram Panchayat one app to:

1. Record all water-supply assets (pumps, valves, tanks, pipelines, borewells, treatment plants) on a map, with attributes and history.
2. Track consumables (chlorine, filters, spare parts) with low-stock alerts and a simple demand estimate.
3. Record receipts and expenses and view an auto-generated cash book.
4. Manage consumers, generate monthly bills and record payments.

### Requirement Coverage

| # | Requirement from problem statement | Status |
|---|---|---|
| a | Record assets on GIS with attributes | ⬜ Planned |
| b | Store asset details (location, install date, history) | ⬜ Planned |
| c | Consumables inventory, forecast and replenishment | ⬜ Planned (low-stock alert + 3-month average estimate) |
| d | Record receipts credited to GP account | ⬜ Planned |
| e | Record expenditure (repairs, replacements, purchases) | ⬜ Planned |
| f | Consumer list, bills, cash book | ⬜ Planned |
| g | User friendly, GP-level operation | ⬜ Planned |
| h | Local language | ⬜ Partial (English; strings isolated for Marathi/Hindi) |
| i, j, k | Payment gateway, UPI, payment interface | ⬜ Partial (manual payment recording; gateway in future scope) |

Legend: ✅ Done · 🟡 In progress · ⬜ Planned

---

## 3. Features

### Roles
| Role | Who | Can do |
|---|---|---|
| **ADMIN** | Sarpanch / GP Secretary / Clerk | Everything: finance, billing, consumers, stock-in, manage workers, delete |
| **WORKER** | Pump operator / plumber | View and add assets, log repairs, view inventory, stock-out |

Each Gram Panchayat is a separate workspace. All data is scoped by `gpId`, so one GP can never see another GP's data.

### Modules
- **Auth:** signup (creates GP and first admin), login with phone and password (JWT)
- **Assets:** CRUD, map view, GPS location, photo, type-specific attributes, status, event/repair timeline
- **Inventory:** items, stock in/out, reorder level, low-stock badge, consumption-based estimate
- **Finance:** receipts, expenses, cash book with opening and closing balance, monthly summary
- **Consumers and Billing:** consumer register, bulk monthly bill generation, mark paid (Cash/UPI/Cheque), bill PDF
- **Dashboard:** total and faulty assets, low-stock count, income vs expense, pending dues
- **Workers:** admin can add workers and activate/deactivate them

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo), React Navigation, Axios |
| Maps and location | react-native-maps, expo-location |
| Media | expo-image-picker (photos compressed and stored in PostgreSQL) |
| PDF | expo-print, expo-sharing |
| Backend | Node.js, Express |
| Database | PostgreSQL (Neon) with Prisma ORM |
| Auth | bcrypt, jsonwebtoken |
| Hosting | Render (API), Neon (DB) |

## 5. Architecture

```
Mobile App (Expo)  --HTTPS-->  Express API  -->  Prisma  -->  PostgreSQL
```

**Key design decisions**
- Online-only for the MVP (offline mode is future scope).
- Money is stored as integer **paise** to avoid floating-point errors.
- Marking a bill paid and creating its ledger entry happen in one database transaction.
- The cash book is a query over `LedgerEntry`; ledger entries are voided, never hard-deleted.
- Photos are resized and compressed on the phone, then stored as base64 text in the database (no external storage account needed).
- Type-specific asset attributes (pump HP, tank capacity) are stored in a JSON column.

### Data Model
`GramPanchayat`, `User`, `Asset`, `AssetEvent`, `InventoryItem`, `StockTxn`, `LedgerEntry`, `Consumer`, `Bill`

<!-- TODO (Day 7): add ER diagram image here -->

---

## 6. Project Structure

```
JalSetu/
├── mobile/              # Expo app
│   └── src/
│       ├── screens/
│       ├── components/
│       ├── api/
│       ├── store/
│       └── strings.js
└── server/
    ├── prisma/schema.prisma
    └── src/
        ├── routes/
        ├── controllers/
        ├── middleware/
        └── utils/
```

---

## 7. Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Neon free tier works)
- Expo Go app or an Android device/emulator

### Backend
```bash
cd server
npm install
cp .env.example .env      # fill in values below
npx prisma migrate dev
npm run seed              # optional demo data
npm run dev
```

### Mobile
```bash
cd mobile
npm install
# set API_URL in src/api/config.js (use the deployed https URL)
npx expo start
```

### Environment Variables (`server/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing tokens |

### Demo Credentials
<!-- TODO (Day 7): fill after seeding -->
| Role | Phone | Password |
|---|---|---|
| Admin | _TBD_ | _TBD_ |
| Worker | _TBD_ | _TBD_ |

---

## 8. API Overview

<!-- TODO: update as endpoints are built -->
| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login` | Public |
| Assets | `GET/POST /assets`, `GET/PUT/DELETE /assets/:id` | Delete: Admin |
| Asset events | `POST /assets/:id/events` | All |
| Inventory | `/items`, `POST /stock/in` (Admin), `POST /stock/out` (All) | Mixed |
| Finance | `/ledger`, `GET /ledger/cashbook` | Admin |
| Consumers and Bills | `/consumers`, `/bills`, `POST /bills/:id/pay` | Admin |
| Workers | `/users` | Admin |

---

## 9. Progress Tracker

- [ ] **Day 1:** Setup, schema, auth, navigation, deploy
- [ ] **Day 2:** Asset CRUD (API and screens)
- [ ] **Day 3:** Map, GPS, photos, asset timeline
- [ ] **Day 4:** Inventory and low-stock alerts
- [ ] **Day 5:** Finance and cash book
- [ ] **Day 6:** Consumers, billing, payment recording, PDF
- [ ] **Day 7:** Dashboard, polish, APK, demo video, slides

---

## 10. Screenshots

<!-- TODO (Day 7): add screenshots -->
| Login | Dashboard | Asset Map | Cash Book |
|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## 11. Demo Flow

1. Worker logs in (no finance tab), adds a valve on the map, marks it faulty with a photo, uses chlorine and triggers low stock.
2. Admin logs in, sees the worker's entry in asset history, logs a repair expense.
3. Admin generates bills, marks one paid.
4. Cash book shows the receipt and expense automatically; dashboard reflects the totals.
