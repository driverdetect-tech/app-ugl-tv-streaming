"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Papa from "papaparse";

const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1ymSKgnlYA2ZsLDcyhejyLaqXZvbJkmra4PAmvGoPlfw/export?format=csv&gid=0";
const POLLING_INTERVAL_MS = 5000;

interface SheetRow {
  ID: string;
  Name: string;
  Phone: string;
  Email: string;
  Status: string;
  Recruiter: string;
  MC: string;
  Comments: string;
  Updated: string;
  _isNew?: boolean;
}

const CARDS_CONFIG = [
  { id: 'CHECKIN', label: 'CHECKED IN' },
  { id: 'HR-INTERVIEW', label: 'HR DEPARTMENT' },
  { id: 'PRE-SCREENING-INTERVIEW', label: 'PRE-SCREENING INTERVIEW' },
  { id: 'ROAD-TEST', label: 'ROAD TEST' },
  { id: 'SAFETY', label: 'SAFETY DEPARTMENT' },
  { id: 'ACCOUNTING', label: 'ACCOUNTING DEPARTMENT' },
];

function getElapsedMinutes(checkinStr: string): number {
  if (!checkinStr) return 0;
  const checkinDate = new Date(checkinStr);
  if (isNaN(checkinDate.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - checkinDate.getTime();
  const minutes = Math.floor(diffMs / 60000);
  return minutes > 0 ? minutes : 0;
}

function formatElapsedTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function getTimeColorClass(minutes: number): string {
  if (minutes >= 45) return 'time-danger';
  if (minutes >= 25) return 'time-warning';
  return 'time-normal';
}

export default function Home() {
  const [data, setData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const prevDataIdsRef = useRef<Set<string>>(new Set());

  // Wait for hydration to show times securely
  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${new Date().getTime()}&_=${Math.random()}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error("Failed to fetch data");

      const csvText = await response.text();

      Papa.parse<SheetRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          let parsedData = results.data;

          if (!isInitial) {
            const prevIds = prevDataIdsRef.current;
            parsedData = parsedData.map(row => {
              const idStr = row.ID?.toString() || JSON.stringify(row);
              if (!prevIds.has(idStr)) {
                return { ...row, _isNew: true };
              }
              return { ...row, _isNew: false };
            });
          }

          const newIds = new Set<string>();
          parsedData.forEach(row => {
            const idStr = row.ID?.toString() || JSON.stringify(row);
            newIds.add(idStr);
          });
          prevDataIdsRef.current = newIds;

          setData(parsedData);
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
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter valid rows for "today"
  let validData = data;
  if (isMounted && currentTime) {
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);

    validData = data.filter(row => {
      if (!row.Updated) return false;
      const datePart = row.Updated.split(' ')[0];
      if (!datePart) return false;
      const [month, day, year] = datePart.split('/');
      if (!month || !day || !year) return false;
      const checkinDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return checkinDate.getTime() >= today.getTime();
    });
  }

  const checkedInCount = validData.filter(d => d.Status === 'CHECKIN').length;
  const inProgressStatuses = ['HR-INTERVIEW', 'PRE-SCREENING-INTERVIEW', 'ROAD-TEST', 'SAFETY', 'ACCOUNTING'];
  const inProgressCount = validData.filter(d => inProgressStatuses.includes(d.Status)).length;
  const checkedOutCount = validData.filter(d => d.Status?.toUpperCase() === 'CHECKED OUT').length;

  let timeString = '--:--:--';
  let amPmPart = '';
  let dateString = '';

  if (isMounted && currentTime) {
    const fullTimeStr = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    const parts = fullTimeStr.split(' ');
    timeString = parts[0];
    amPmPart = parts[1] || '';
    dateString = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  return (
    <main className="container">
      <header className="top-header">
        <div className="header-brand">
          <h1>United<br />Group<br />Holding</h1>
          <p className="subtitle">LIVE QUEUE<br />MANAGEMENT</p>
        </div>

        <div className="header-stats">
          <div className="header-stat-item">
            <div className="stat-icon">➔</div>
            <div className="stat-content">
              <span className="header-stat-value">{checkedInCount}</span>
              <span className="header-stat-label">CHECKED<br />IN</span>
            </div>
          </div>

          <div className="header-stat-item">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <span className="header-stat-value">{inProgressCount}</span>
              <span className="header-stat-label">IN<br />PROGRESS</span>
            </div>
          </div>

          <div className="header-stat-item">
            <div className="stat-icon">←</div>
            <div className="stat-content">
              <span className="header-stat-value">{checkedOutCount}</span>
              <span className="header-stat-label">CHECKED<br />OUT</span>
            </div>
          </div>
        </div>

        <div className="header-clock">
          <div className="clock-time">
            {timeString}
            <span className="clock-am-pm">{amPmPart}</span>
          </div>
          <div className="clock-date">{dateString}</div>
        </div>
      </header>

      {error && (
        <div className="status-card" style={{ padding: '1.5rem', borderColor: 'var(--status-error)', marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--status-error)', margin: 0 }}>Error Loading Data</h3>
          <p style={{ marginTop: '0.5rem' }}>{error}</p>
        </div>
      )}

      {loading && data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading data stream...
        </div>
      ) : (
        <section className="cards-grid">
          {CARDS_CONFIG.map((card, idx) => {
            const cardDrivers = validData.filter(d => d.Status === card.id);
            const sortedDrivers = [...cardDrivers].sort((a, b) => {
              const timeA = new Date(a.Updated).getTime() || 0;
              const timeB = new Date(b.Updated).getTime() || 0;
              return timeA - timeB;
            });

            return (
              <div key={card.id} className="status-card">
                <div className="card-header">
                  <div className="card-number-box">{idx + 1}</div>
                  <div className="card-title-area">
                    <h2 className="card-title">{card.label}</h2>
                    <div className="card-subtitle">{cardDrivers.length} {cardDrivers.length === 1 ? 'driver' : 'drivers'} in queue</div>
                  </div>
                </div>

                <div className="card-body">
                  {sortedDrivers.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No drivers
                    </div>
                  ) : (
                    sortedDrivers.map((driver, driverIdx) => {
                      const minutes = isMounted ? getElapsedMinutes(driver.Updated) : 0;
                      const timeColorClass = getTimeColorClass(minutes);
                      const keyStr = driver.ID ? `${driver.ID}-${driverIdx}` : `row-${driverIdx}`;

                      return (
                        <div key={keyStr} className={`driver-row ${driver._isNew ? 'row-new' : ''}`}>
                          <div className="driver-index">{driverIdx + 1}</div>
                          <div className="driver-name">{driver.Name || '-'}</div>
                          {isMounted && (
                            <div className={`driver-time ${timeColorClass}`}>
                              {formatElapsedTime(minutes)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <footer className="footer-branding">
        Powered by <strong>DriverDetect AI</strong> — AI Based Fully Automated Driver Recruitment
      </footer>
    </main>
  );
}
