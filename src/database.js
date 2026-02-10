/**
 * Database Setup & Helpers
 * Menggunakan SQLite dengan better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');

// Buat database di root folder
const dbPath = path.join(__dirname, '..', '..', 'donations.db');
const db = new Database(dbPath);

// Inisialisasi tabel
db.exec(`
    CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        donor_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    
    CREATE TABLE IF NOT EXISTS blacklist (
        word TEXT PRIMARY KEY,
        added_by TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_donor_name ON donations(donor_name);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON donations(timestamp);
`);

// Database helper functions - prepared statements untuk performa
const dbHelpers = {
    // Donation operations
    addDonation: db.prepare(`
        INSERT INTO donations (id, donor_name, amount, message, timestamp)
        VALUES (?, ?, ?, ?, datetime('now'))
    `),
    
    getLeaderboard: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT ?
    `),
    
    getRecentDonations: db.prepare(`
        SELECT * FROM donations
        ORDER BY timestamp DESC
        LIMIT ?
    `),
    
    getTotalStats: db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(DISTINCT donor_name) as total_donors,
            COUNT(*) as total_transactions
        FROM donations
    `),
    
    getTopDonor: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT 1
    `),
    
    // Daily stats
    getDailyStats: db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(DISTINCT donor_name) as total_donors,
            COUNT(*) as total_transactions
        FROM donations
        WHERE date(timestamp) = date('now')
    `),
    
    getDailyLeaderboard: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        WHERE date(timestamp) = date('now')
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT ?
    `),
    
    // Weekly stats
    getWeeklyStats: db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(DISTINCT donor_name) as total_donors,
            COUNT(*) as total_transactions
        FROM donations
        WHERE timestamp >= datetime('now', '-7 days')
    `),
    
    getWeeklyLeaderboard: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT ?
    `),
    
    // Settings operations
    getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
    setSetting: db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`),
    
    // Blacklist operations
    addBlacklistWord: db.prepare(`INSERT OR IGNORE INTO blacklist (word, added_by) VALUES (?, ?)`),
    removeBlacklistWord: db.prepare(`DELETE FROM blacklist WHERE word = ?`),
    getBlacklistWords: db.prepare(`SELECT word FROM blacklist`),
    isWordBlacklisted: db.prepare(`SELECT 1 FROM blacklist WHERE word = ?`),
};

// Close database function
function closeDatabase() {
    db.close();
    console.log('💾 Database ditutup');
}

module.exports = {
    db,
    dbHelpers,
    closeDatabase,
};
