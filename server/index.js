const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, '..', 'data', 'reports.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize DB schema
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Index for faster queries on container_id + timestamp
    db.run(`CREATE INDEX IF NOT EXISTS idx_container_timestamp ON reports(container_id, timestamp)`);
});

// Get the latest status of all containers reported in the last 48 hours
app.get('/api/status', (req, res) => {
    const query = `
    SELECT container_id, status, timestamp
    FROM reports
    WHERE timestamp >= datetime('now', '-48 hours')
    GROUP BY container_id
    HAVING timestamp = MAX(timestamp)
  `;
    db.all(query, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        const statusMap = {};
        rows.forEach(r => {
            statusMap[r.container_id] = { status: r.status, timestamp: r.timestamp };
        });
        res.json(statusMap);
    });
});

// Get recent history for a specific container
app.get('/api/status/:id', (req, res) => {
    const { id } = req.params;
    db.all(`SELECT status, timestamp FROM reports WHERE container_id = ? ORDER BY timestamp DESC LIMIT 5`, [id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Post a new status for a container
app.post('/api/status/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Full', 'Empty'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be "Full" or "Empty"' });
    }
    db.run(`INSERT INTO reports (container_id, status) VALUES (?, ?)`, [id, status], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, id: this.lastID, container_id: id, status });
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Afvalcontainer status API running on port ${PORT}`);
});
