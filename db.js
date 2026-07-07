const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

// Get database state
function getData() {
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading database:", err);
    return {};
  }
}

// Fallback empty initializer to prevent import errors in other modules
async function waitForInit() {
  return Promise.resolve();
}

module.exports = {
  getData,
  waitForInit
};
