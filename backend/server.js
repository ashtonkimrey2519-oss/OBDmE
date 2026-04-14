require('dotenv').config();

// ============================================================
// server.js — OBD Code Lookup Backend (Node.js + Express)
// ============================================================
// This is the main entry point for the backend server.
// It loads the CSV data on startup, then exposes REST endpoints
// that the frontend can call to look up OBD error codes.
// ============================================================

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const { loadCSV } = require("./dataLoader");

const app  = express();
const PORT = process.env.PORT || 3000;
// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------
function normalizeOBDCode(rawCode) {
  if (!rawCode || typeof rawCode !== "string") return null;

  // Remove spaces and make uppercase
  let cleaned = rawCode.trim().toUpperCase();

  // Remove any spaces inside (e.g. "P 0420" → "P0420")
  cleaned = cleaned.replace(/\s+/g, "");

  // Case 1: User enters just 4 digits assume "P"
  if (/^\d{4}$/.test(cleaned)) {
    return `P${cleaned}`;
  }

  // Case 2: User enters valid full code
  if (/^[PBCU]\d{4}$/.test(cleaned)) {
    return cleaned;
  }

  // Case 3: User enters something like "0420P"  fix order
  if (/^\d{4}[PBCU]$/.test(cleaned)) {
    return `${cleaned.slice(-1)}${cleaned.slice(0, 4)}`;
  }

  // Case 4: Extract from messy input like "code: p0420"
  const match = cleaned.match(/[PBCU]?\d{4}/);
  if (match) {
    const code = match[0];
    return code.length === 4 ? `P${code}` : code;
  }

  return null;
}
// ---------------------------------------------------------
// Middleware Setup
// ---------------------------------------------------------

// Allow cross-origin requests so the frontend (running on a
// different port or domain) can talk to this server.
app.use(cors());

// Parse incoming JSON request bodies (used for POST routes).
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// ---------------------------------------------------------
// In-memory database
// ---------------------------------------------------------
// We store the CSV data in a plain JS object (like a hashmap)
// keyed by the OBD code (e.g. "P0420") for O(1) lookups.
// This is populated once at startup and never changes.
let codeDatabase = {};

// ---------------------------------------------------------
// Routes
// ---------------------------------------------------------

/**
 * GET /
 * Health check — confirms the server is running.
 * The frontend or professor can hit this to verify deployment.
 */
app.get("/health", (req, res) => {
  res.json({
    status: "running",
    message: "Honda OBD Lookup API is live.",
    totalCodes: Object.keys(codeDatabase).length,
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
/**
 * GET /api/code/:code
 * Look up a single OBD code passed as a URL parameter.
 *
 * Example request:  GET /api/code/P0420
 * Example response:
 * {
 *   "code": "P0420",
 *   "category": "Catalyst System",
 *   "summary": "Catalyst system efficiency below threshold...",
 *   "recommendedShop": "MP Motorwerks"
 * }
 */
app.get("/api/code/:code", (req, res) => {
  // Pull the code from the URL and normalize it to uppercase
  // so "p0420", "P0420", and "p0420" all work the same way.
  //const inputCode = req.params.code.trim().toUpperCase();
  const inputCode = normalizeOBDCode(req.params.code);

  // Validate the format — OBD-II codes are 1 letter + 4 digits.
  const validFormat = /^[PBCU]\d{4}$/.test(inputCode);
  if (!validFormat) {
    return res.status(400).json({
      error: "Invalid code format.",
      message:
        "OBD codes must start with P, B, C, or U followed by 4 digits (e.g. P0420).",
    });
  }

  // Look up the code in our in-memory database.
  const result = codeDatabase[inputCode];

  if (!result) {
    // Code is correctly formatted but not in our database.
    return res.status(404).json({
      error: "Code not found.",
      message: `No data found for code ${inputCode}. This code may not be supported yet.`,
    });
  }

  // Success — return the full record.
  res.json(result);
});

/**
 * POST /api/code
 * Alternative way to look up a code — accepts JSON body instead of URL param.
 * This is useful if the frontend sends data via a form or fetch POST.
 *
 * Request body:  { "code": "P0420" }
 */
app.post("/api/code", (req, res) => {
  const { code } = req.body;

  // Make sure the body actually included a code field.
  if (!code) {
    return res.status(400).json({
      error: "Missing field.",
      message: 'Request body must include a "code" field.',
    });
  }

  //const inputCode = code.trim().toUpperCase();
  const inputCode = normalizeOBDCode(code);

  // Same format validation as the GET route.
  const validFormat = /^[PBCU]\d{4}$/.test(inputCode);
  if (!validFormat) {
    return res.status(400).json({
      error: "Invalid code format.",
      message:
        "OBD codes must start with P, B, C, or U followed by 4 digits (e.g. P0420).",
    });
  }

  const result = codeDatabase[inputCode];

  if (!result) {
    return res.status(404).json({
      error: "Code not found.",
      message: `No data found for code ${inputCode}. This code may not be supported yet.`,
    });
  }

  res.json(result);
});

/**
 * GET /api/codes
 * Returns a list of ALL codes in the database.
 * Useful for the frontend to build a dropdown, autocomplete, or search.
 */
app.get("/api/codes", (req, res) => {
  const allCodes = Object.values(codeDatabase);
  res.json({
    total: allCodes.length,
    codes: allCodes,
  });
});

/**
 * GET /api/categories
 * Returns all unique fault categories (e.g. "Fuel pressure / fuel pump").
 * Helpful if the frontend wants to let users browse by category.
 */
app.get("/api/categories", (req, res) => {
  // Build a unique set of categories from the database.
  const categories = [
    ...new Set(Object.values(codeDatabase).map((entry) => entry.category)),
  ];

  res.json({
    total: categories.length,
    categories,
  });
});

app.get('/api/config', (req, res) => {
  res.json({ mapsApiKey: process.env.MAPS_API_KEY });
});

/**
 * GET /api/codes/category/:category
 * Returns all codes that belong to a specific category.
 *
 * Example: GET /api/codes/category/Fuel%20pressure%20%2F%20fuel%20pump
 */
app.get("/api/codes/category/:category", (req, res) => {
  // Decode the URL-encoded category name (spaces become %20, etc.)
  const targetCategory = decodeURIComponent(req.params.category).toLowerCase();

  // Filter database entries by matching category (case-insensitive).
  const matches = Object.values(codeDatabase).filter(
    (entry) => entry.category.toLowerCase() === targetCategory
  );

  if (matches.length === 0) {
    return res.status(404).json({
      error: "Category not found.",
      message: `No codes found for category "${req.params.category}".`,
    });
  }

  res.json({
    category: matches[0].category,
    total: matches.length,
    codes: matches,
  });
});

/**
 * Catch-all for undefined routes.
 * Returns a clear 404 instead of a silent failure.
 */
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
    message: `No route matches ${req.method} ${req.url}`,
  });
});

// ---------------------------------------------------------
// Startup — load CSV then start the server
// ---------------------------------------------------------
// We load the CSV BEFORE starting the server so the very first
// request is never hit with an empty database.

const csvPath = path.join(__dirname, "engine_codes.csv");

loadCSV(csvPath)
  .then((data) => {
    codeDatabase = data;
    console.log(`✅ Loaded ${Object.keys(data).length} OBD codes from CSV.`);

    app.listen(PORT, () => {
      console.log(`🚗 Honda OBD Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to load CSV data:", err.message);
    process.exit(1); // Exit so the error doesn't go unnoticed
  });
