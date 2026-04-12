# Honda OBD Backend

A Node.js + Express REST API that looks up Honda OBD error codes from a local CSV database.

## Setup

```bash
npm install
npm start
```

Server runs at `http://localhost:3000` by default.

---

## API Endpoints

### `GET /`
Health check. Confirms server is running and shows total codes loaded.

---

### `GET /api/code/:code`
Look up a single OBD code.

**Example:**
```
GET /api/code/P0420
```
**Response:**
```json
{
  "code": "P0420",
  "category": "Catalyst System",
  "summary": "Catalyst system efficiency below threshold...",
  "recommendedShop": "MP Motorwerks"
}
```

---

### `POST /api/code`
Same lookup but via POST with a JSON body (useful for form submissions).

**Request body:**
```json
{ "code": "P0420" }
```

---

### `GET /api/codes`
Returns every code in the database.

---

### `GET /api/categories`
Returns all unique fault categories.

---

### `GET /api/codes/category/:category`
Returns all codes in a specific category.

**Example:**
```
GET /api/codes/category/Fuel%20pressure%20%2F%20fuel%20pump
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400    | Bad input — invalid code format or missing field |
| 404    | Code or category not found in database |

---

## Project Structure

```
obd-backend/
├── server.js         # Express server & route definitions
├── dataLoader.js     # CSV parser & in-memory database builder
├── engine_codes.csv  # OBD code database (Honda)
├── package.json
└── README.md
```
