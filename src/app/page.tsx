"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Papa from "papaparse";

const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1ymSKgnlYA2ZsLDcyhejyLaqXZvbJkmra4PAmvGoPlfw/export?format=csv&gid=0";
const POLLING_INTERVAL_MS = 5000;

// Type for the parsed Google Sheet data
interface SheetRow {
  ID: string;
  Name: string;
  Phone: string;
  Email: string;
  Checkin: string;
  Status: string;
  Recruiter: string;
  MC: string;
  Comments: string;
  _isNew?: boolean; // For tracking newly added rows to animate them
}

export default function Home() {
  const [data, setData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const prevDataIdsRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      // Add a random dummy parameter to bypass Google's Edge caching of public sheets
      const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${new Date().getTime()}&_=${Math.random()}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error("Failed to fetch data");

      const csvText = await response.text();

      Papa.parse<SheetRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn("CSV parsing warnings:", results.errors);
          }

          let parsedData = results.data;

          if (!isInitial) {
            // Identify new rows relative to the previous data to apply animation
            const prevIds = prevDataIdsRef.current;
            parsedData = parsedData.map(row => {
              const idStr = row.ID?.toString() || JSON.stringify(row);
              if (!prevIds.has(idStr)) {
                return { ...row, _isNew: true };
              }
              return { ...row, _isNew: false };
            });
          }

          // Update previous IDs reference
          const newIds = new Set<string>();
          parsedData.forEach(row => {
            const idStr = row.ID?.toString() || JSON.stringify(row);
            newIds.add(idStr);
          });
          prevDataIdsRef.current = newIds;

          setData(parsedData);
          setLastUpdate(new Date());
          if (isInitial) setLoading(false);
        },
        error: (err: Error) => {
          setError(err.message);
          if (isInitial) setLoading(false);
        }
      });
    } catch (err: any) {
      setError(err.message);
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Derived metrics
  const totalRows = data.length;
  const uniqueRecruiters = new Set(data.map(d => d.Recruiter).filter(Boolean)).size;
  const activeRoadTests = data.filter(d => d.Status?.toLowerCase().includes("road test")).length;

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1 className="text-gradient">DriverDetect - Live Streamer</h1>
        </div>
        <div className="live-indicator glass-panel" style={{ padding: '0.5rem 1rem', borderRadius: '50px' }}>
          <div className="indicator-dot"></div>
          {loading ? "Connecting..." : "Live"}
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--status-error)', marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--status-error)' }}>Error Loading Data</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <section className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-value">{totalRows}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-value text-gradient">{uniqueRecruiters}</div>
          <div className="stat-label">Recruiters</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-value">{activeRoadTests}</div>
          <div className="stat-label">Road Tests</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-value" style={{ fontSize: '1.2rem', margin: 'auto' }}>
            {isMounted && lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}
          </div>
          <div className="stat-label">Last Updated</div>
        </div>
      </section>

      {/* Main Data Grid */}
      <section className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Phone / Email</th>
              <th>Checkin</th>
              <th>Status</th>
              <th>Recruiter / MC</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  Loading data stream...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No records found.
                </td>
              </tr>
            ) : (
              data
                .filter((row) => {
                  if (!row.Checkin) return false;

                  // Set target date 
                  const targetDate = new Date();
                  targetDate.setMonth(2, 1);
                  targetDate.setHours(0, 0, 0, 0);

                  // Parse the check-in date manually to avoid cross-browser timezone/format issues
                  // Expected format: "M/D/YYYY H:MM:SS" or "MM/DD/YYYY"
                  const datePart = row.Checkin.split(' ')[0]; // Gets "3/1/2026"
                  if (!datePart) return false;

                  const [month, day, year] = datePart.split('/');
                  if (!month || !day || !year) return false;

                  const checkinDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));

                  return checkinDate >= targetDate;
                })
                .map((row, idx) => {
                  // Using a combination of id and index for key in case IDs duplicate
                  const keyStr = row.ID ? `${row.ID}-${idx}` : `row-${idx}`;
                  return (
                    <tr key={keyStr} className={row._isNew ? "row-new" : ""}>
                      <td>
                        <span className="badge">{row.ID || '-'}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{row.Name || '-'}</td>
                      <td>
                        <div style={{ fontSize: '0.9rem' }}>{row.Phone || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.Email}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{row.Checkin || '-'}</div>
                      </td>
                      <td>
                        {row.Status ? (
                          <span className={`badge ${row.Status.toLowerCase().includes('road test') ? 'badge-active' : ''}`}>
                            {row.Status}
                          </span>
                        ) : '-'}
                      </td>

                      <td>
                        <div style={{ fontWeight: 500 }}>{row.Recruiter || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.MC}</div>
                      </td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.Comments}>
                        {row.Comments || '-'}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
