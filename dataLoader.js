// This module is responsible for reading the CSV file from disk
// and converting it into a JavaScript object 
// by OBD code for fast lookups.

const fs  = require("fs");
const csv = require("csv-parser");

/**
 * loadCSV(filePath)
 *
 * Reads the engine codes CSV file and builds an inmemory lookup object.
 *
 * @param {string} filePath - Absolute path to the CSV file.
 * @returns {Promise<Object>} - Resolves with an object like:
 *   {
 *     "P0420": {
 *       code: "P0420",
 *       category: "Catalyst System",
 *       summary: "Catalyst system efficiency below threshold...",
 *       recommendedShop: "MP Motorwerks"
 *     },
 *     ...
 *   }
 */
function loadCSV(filePath) {
  return new Promise((resolve, reject) => {
    // Check that the file actually exists before trying to read it.
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`CSV file not found at path: ${filePath}`));
    }

    // This object will hold all the OBD records keyed by code.
    const database = {};

    fs.createReadStream(filePath)
      .pipe(
        csv({
          // Map the raw CSV column headers to cleaner internal keys.
          // If your CSV columns ever change, only update this one place.
          mapHeaders: ({ header }) => {
            const map = {
              Code:                 "code",
              Category:             "category",
              "Honda likely summary": "summary",
              "Recommended Shop":   "recommendedShop",
            };
            // Return the mapped key, or fall back to the original header.
            return map[header] || header;
          },
        })
      )
      .on("data", (row) => {
        // Each "row" is one OBD code record from the CSV.

        // Skip rows that are missing a code (blank/malformed lines).
        if (!row.code || row.code.trim() === "") return;

        // Normalize the code to uppercase so lookups are always consistent.
        const normalizedCode = row.code.trim().toUpperCase();

        // Store the record in the database, keyed by the code.
        database[normalizedCode] = {
          code:            normalizedCode,
          category:        (row.category || "Unknown").trim(),
          summary:         (row.summary  || "No summary available.").trim(),
          recommendedShop: (row.recommendedShop || "No shop recommendation available.").trim(),
        };
      })
      .on("end", () => {
        // All rows have been processed — resolve the promise with the full database.
        if (Object.keys(database).length === 0) {
          return reject(new Error("CSV loaded but no valid records were found."));
        }
        resolve(database);
      })
      .on("error", (err) => {
        // Something went wrong reading the file (permissions, corruption, etc.)
        reject(new Error(`Error reading CSV: ${err.message}`));
      });
  });
}

module.exports = { loadCSV };
