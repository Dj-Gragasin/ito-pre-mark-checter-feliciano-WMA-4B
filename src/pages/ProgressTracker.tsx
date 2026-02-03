import React, { useMemo, useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonButtons,
  IonMenuButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { calendar, analytics } from 'ionicons/icons';
import './ProgressTracker.css';
import { API_CONFIG } from '../config/api.config';

const API_URL = API_CONFIG.BASE_URL;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ProgressRecord {
  id?: number;
  date: string;
  weight: number;
  bmi: number;
  notes: string;
}

type ReportMode = 'daily' | 'weekly' | 'monthly';

const toLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(NaN);
  // Prefer stable parsing for YYYY-MM-DD (avoid timezone shifting)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T00:00:00`);
  }
  return new Date(dateStr);
};

const formatMonthLabel = (date: Date): string => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date);
};

// ISO week helpers (Monday-start)
const getISOWeekKey = (date: Date): { key: string; label: string; weekStart: Date } => {
  const d = new Date(date.getTime());
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1..Sun=7)
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3);
  const isoWeekYear = d.getFullYear();

  const firstThursday = new Date(isoWeekYear, 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);

  const weekNumber = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const week = String(weekNumber).padStart(2, '0');

  // Compute Monday of this ISO week (from original date)
  const monday = new Date(date.getTime());
  const day2 = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day2);

  const key = `${isoWeekYear}-W${week}`;
  return { key, label: key, weekStart: monday };
};

type AggregatedRow = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  entries: number;
  avgWeight: number;
  avgBmi: number;
  deltaWeight: number;
  deltaBmi: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const ProgressTracker: React.FC = () => {
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState('');
  const [bmi, setBmi] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [notes, setNotes] = useState('');
  const [reportMode, setReportMode] = useState<ReportMode>('daily');

  const loadRecords = async () => {
    const token = localStorage.getItem('token') || '';

    // If not logged in, fall back to local-only storage.
    if (!token) {
      const stored = localStorage.getItem('progressRecords');
      if (stored) setRecords(JSON.parse(stored));
      return;
    }

    try {
      const res = await fetch(`${API_URL}/progress/records`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to load records');
      }
      const nextRecords = Array.isArray(data.records) ? data.records : [];
      setRecords(nextRecords);
      // keep a local cache as a fallback for offline mode
      localStorage.setItem('progressRecords', JSON.stringify(nextRecords));
    } catch (err) {
      const stored = localStorage.getItem('progressRecords');
      if (stored) setRecords(JSON.parse(stored));
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleUpdate = () => {
    if (!weight || !bmi) {
      alert('Please enter both weight and BMI');
      return;
    }

    const newRecord: ProgressRecord = {
      date,
      weight: parseFloat(weight),
      bmi: parseFloat(bmi),
      notes
    };

    const updatedRecords = [...records, newRecord].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Persist to server when logged in; otherwise local-only.
    const token = localStorage.getItem('token') || '';
    if (!token) {
      setRecords(updatedRecords);
      localStorage.setItem('progressRecords', JSON.stringify(updatedRecords));
      clearForm();
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/progress/records`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newRecord),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to save record');
        }

        const nextRecords = Array.isArray(data.records) ? data.records : updatedRecords;
        setRecords(nextRecords);
        localStorage.setItem('progressRecords', JSON.stringify(nextRecords));
        clearForm();
      } catch (e: any) {
        setRecords(updatedRecords);
        localStorage.setItem('progressRecords', JSON.stringify(updatedRecords));
        clearForm();
        alert(`Saved locally only (server sync failed): ${e?.message || 'unknown error'}`);
      }
    })();
  };

  const clearForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setWeight('');
    setBmi('');
    setHeightCm('');
    setNotes('');
  };

  const handleCalculateBmi = () => {
    const w = parseFloat(weight);
    const hcm = parseFloat(heightCm);

    if (!Number.isFinite(w) || w <= 0) {
      alert('Please enter a valid weight (kg) first');
      return;
    }
    if (!Number.isFinite(hcm) || hcm <= 0) {
      alert('Please enter a valid height (cm)');
      return;
    }

    const hm = hcm / 100;
    const bmiValue = w / (hm * hm);
    if (!Number.isFinite(bmiValue)) {
      alert('Unable to calculate BMI from those values');
      return;
    }
    setBmi(bmiValue.toFixed(1));
  };

  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete all records?')) {
      const token = localStorage.getItem('token') || '';
      if (!token) {
        setRecords([]);
        localStorage.removeItem('progressRecords');
        clearForm();
        return;
      }

      (async () => {
        try {
          const res = await fetch(`${API_URL}/progress/records`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            throw new Error(data?.message || 'Failed to delete records');
          }
          setRecords([]);
          localStorage.removeItem('progressRecords');
          clearForm();
        } catch (e: any) {
          alert(`Failed to delete from server: ${e?.message || 'unknown error'}`);
        }
      })();
    }
  };

  const handleDeleteRecord = (index: number) => {
    if (window.confirm('Delete this record?')) {
      const token = localStorage.getItem('token') || '';
      const record = records[index];

      // If server-backed record (has id) and logged in, delete on server.
      if (token && record?.id) {
        (async () => {
          try {
            const res = await fetch(`${API_URL}/progress/records/${record.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
              throw new Error(data?.message || 'Failed to delete record');
            }
            const updatedRecords = records.filter((_, i) => i !== index);
            setRecords(updatedRecords);
            localStorage.setItem('progressRecords', JSON.stringify(updatedRecords));
          } catch (e: any) {
            alert(`Failed to delete from server: ${e?.message || 'unknown error'}`);
          }
        })();
        return;
      }

      // Local-only fallback.
      const updatedRecords = records.filter((_, i) => i !== index);
      setRecords(updatedRecords);
      localStorage.setItem('progressRecords', JSON.stringify(updatedRecords));
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => toLocalDate(a.date).getTime() - toLocalDate(b.date).getTime());
  }, [records]);

  const weeklyRows: AggregatedRow[] = useMemo(() => {
    const buckets = new Map<string, { label: string; items: ProgressRecord[]; start: Date }>();
    for (const record of sortedRecords) {
      const d = toLocalDate(record.date);
      if (Number.isNaN(d.getTime())) continue;
      const wk = getISOWeekKey(d);
      const existing = buckets.get(wk.key);
      if (existing) {
        existing.items.push(record);
      } else {
        buckets.set(wk.key, { label: wk.label, items: [record], start: wk.weekStart });
      }
    }

    const rows: AggregatedRow[] = Array.from(buckets.entries())
      .map(([key, bucket]) => {
        const items = bucket.items;
        const startItem = items[0];
        const endItem = items[items.length - 1];
        const avgWeight = items.reduce((s, r) => s + (Number(r.weight) || 0), 0) / items.length;
        const avgBmi = items.reduce((s, r) => s + (Number(r.bmi) || 0), 0) / items.length;
        const deltaWeight = (Number(endItem.weight) || 0) - (Number(startItem.weight) || 0);
        const deltaBmi = (Number(endItem.bmi) || 0) - (Number(startItem.bmi) || 0);
        return {
          key,
          label: bucket.label,
          startDate: startItem.date,
          endDate: endItem.date,
          entries: items.length,
          avgWeight: round1(avgWeight),
          avgBmi: round1(avgBmi),
          deltaWeight: round1(deltaWeight),
          deltaBmi: round1(deltaBmi),
        };
      })
      .sort((a, b) => toLocalDate(a.startDate).getTime() - toLocalDate(b.startDate).getTime());

    return rows;
  }, [sortedRecords]);

  const monthlyRows: AggregatedRow[] = useMemo(() => {
    const buckets = new Map<string, { label: string; items: ProgressRecord[]; start: Date }>();
    for (const record of sortedRecords) {
      const d = toLocalDate(record.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = formatMonthLabel(new Date(d.getFullYear(), d.getMonth(), 1));
      const existing = buckets.get(key);
      if (existing) {
        existing.items.push(record);
      } else {
        buckets.set(key, { label, items: [record], start: new Date(d.getFullYear(), d.getMonth(), 1) });
      }
    }

    const rows: AggregatedRow[] = Array.from(buckets.entries())
      .map(([key, bucket]) => {
        const items = bucket.items;
        const startItem = items[0];
        const endItem = items[items.length - 1];
        const avgWeight = items.reduce((s, r) => s + (Number(r.weight) || 0), 0) / items.length;
        const avgBmi = items.reduce((s, r) => s + (Number(r.bmi) || 0), 0) / items.length;
        const deltaWeight = (Number(endItem.weight) || 0) - (Number(startItem.weight) || 0);
        const deltaBmi = (Number(endItem.bmi) || 0) - (Number(startItem.bmi) || 0);
        return {
          key,
          label: bucket.label,
          startDate: startItem.date,
          endDate: endItem.date,
          entries: items.length,
          avgWeight: round1(avgWeight),
          avgBmi: round1(avgBmi),
          deltaWeight: round1(deltaWeight),
          deltaBmi: round1(deltaBmi),
        };
      })
      .sort((a, b) => toLocalDate(a.startDate).getTime() - toLocalDate(b.startDate).getTime());

    return rows;
  }, [sortedRecords]);

  const chartData: ChartData<'line'> = useMemo(() => {
    if (reportMode === 'weekly') {
      return {
        labels: weeklyRows.map(r => r.label),
        datasets: [
          {
            label: 'Avg Weight (kg)',
            data: weeklyRows.map(r => r.avgWeight),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.35,
            yAxisID: 'y'
          },
          {
            label: 'Avg BMI',
            data: weeklyRows.map(r => r.avgBmi),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0.35,
            yAxisID: 'y1'
          }
        ]
      };
    }

    if (reportMode === 'monthly') {
      return {
        labels: monthlyRows.map(r => r.label),
        datasets: [
          {
            label: 'Avg Weight (kg)',
            data: monthlyRows.map(r => r.avgWeight),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.35,
            yAxisID: 'y'
          },
          {
            label: 'Avg BMI',
            data: monthlyRows.map(r => r.avgBmi),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0.35,
            yAxisID: 'y1'
          }
        ]
      };
    }

    return {
      labels: sortedRecords.map(r => r.date),
      datasets: [
        {
          label: 'Weight (kg)',
          data: sortedRecords.map(r => r.weight),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'BMI',
          data: sortedRecords.map(r => r.bmi),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    };
  }, [monthlyRows, reportMode, sortedRecords, weeklyRows]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#ffffff',
          font: {
            size: 12
          },
          padding: 20
        }
      },
      title: {
        display: true,
        text: 'Progress Timeline',
        color: '#ffffff',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: 20
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Weight (kg)',
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff',
          font: {
            size: 12
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'BMI',
          color: '#ffffff'
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: '#ffffff',
          font: {
            size: 12
          }
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff',
          font: {
            size: 12
          },
          maxRotation: 45
        }
      }
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Progress Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding progress-tracker-content">
        <IonGrid fixed>
          <IonRow className="form-container">
            <IonCol size="12" sizeMd="6">
              <div className="form-section">
                <div className="form-section-title">
                  <IonIcon icon={calendar} />
                  <span>Date & Weight Details</span>
                </div>
                <IonItem>
                  <IonLabel position="stacked">Date</IonLabel>
                  <IonInput type="date" value={date} onIonChange={e => setDate(e.detail.value!)} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Weight (kg)</IonLabel>
                  <IonInput
                    type="number"
                    value={weight}
                    onIonChange={e => setWeight(e.detail.value!)}
                    placeholder="Enter your weight"
                  />
                </IonItem>
              </div>
            </IonCol>

            <IonCol size="12" sizeMd="6">
              <div className="form-section">
                <div className="form-section-title">
                  <IonIcon icon={analytics} />
                  <span>BMI & Notes</span>
                </div>
                <IonItem>
                  <IonLabel position="stacked">Height (cm)</IonLabel>
                  <IonInput
                    type="number"
                    value={heightCm}
                    onIonChange={e => setHeightCm(e.detail.value!)}
                    placeholder="e.g., 170"
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">BMI</IonLabel>
                  <IonInput
                    type="number"
                    value={bmi}
                    onIonChange={e => setBmi(e.detail.value!)}
                    placeholder="Enter your BMI"
                  />
                </IonItem>

                <div className="bmi-calc-row">
                  <IonButton size="small" fill="outline" onClick={handleCalculateBmi}>
                    Calculate BMI
                  </IonButton>
                  <div className="bmi-calc-hint">Uses Weight (kg) and Height (cm)</div>
                </div>
                <IonItem>
                  <IonLabel position="stacked">Notes</IonLabel>
                  <IonInput value={notes} onIonChange={e => setNotes(e.detail.value!)} placeholder="Add notes" />
                </IonItem>
              </div>
            </IonCol>
          </IonRow>

          <IonRow className="button-container">
            <IonCol size="12" sizeMd="4">
              <IonButton expand="block" onClick={clearForm} fill="outline">
                Clear Form
              </IonButton>
            </IonCol>
            <IonCol size="12" sizeMd="4">
              <IonButton expand="block" onClick={handleUpdate}>
                Update Progress
              </IonButton>
            </IonCol>
            <IonCol size="12" sizeMd="4">
              <IonButton expand="block" onClick={handleDeleteAll} color="danger" fill="outline">
                Delete All
              </IonButton>
            </IonCol>
          </IonRow>
        </IonGrid>

        {records.length > 0 && (
          <>
            <div className="report-segment-wrap">
              <IonSegment
                value={reportMode}
                onIonChange={(e) => setReportMode(e.detail.value as ReportMode)}
              >
                <IonSegmentButton value="daily">Daily</IonSegmentButton>
                <IonSegmentButton value="weekly">Weekly</IonSegmentButton>
                <IonSegmentButton value="monthly">Monthly</IonSegmentButton>
              </IonSegment>
            </div>

            <div className="chart-container">
              <Line data={chartData} options={chartOptions} />
            </div>
          </>
        )}

        {records.length > 0 && (
          <>
            {reportMode === 'daily' ? (
              <>
                {/* Desktop/tablet table */}
                <div className="records-table-wrap">
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Weight (kg)</th>
                          <th>BMI</th>
                          <th>Notes</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRecords.map((record, index) => (
                          <tr key={`${record.date}-${index}`}>
                            <td>{record.date}</td>
                            <td>{record.weight}</td>
                            <td>{record.bmi}</td>
                            <td>{record.notes}</td>
                            <td>
                              <IonButton
                                fill="clear"
                                color="danger"
                                size="small"
                                onClick={() => handleDeleteRecord(index)}
                              >
                                Delete
                              </IonButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Aggregated table */}
                <div className="records-table-wrap">
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Avg Weight</th>
                          <th>Avg BMI</th>
                          <th>Δ Weight</th>
                          <th>Entries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportMode === 'weekly' ? weeklyRows : monthlyRows).map((row) => (
                          <tr key={row.key}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{row.label}</div>
                              <div style={{ color: '#b0b0b0', fontSize: 12 }}>
                                {row.startDate} → {row.endDate}
                              </div>
                            </td>
                            <td>{row.avgWeight} kg</td>
                            <td>{row.avgBmi}</td>
                            <td>{row.deltaWeight >= 0 ? '+' : ''}{row.deltaWeight} kg</td>
                            <td>{row.entries}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Mobile stacked cards */}
            <div className="records-list-wrap">
              <IonGrid>
                <IonRow>
                  {reportMode === 'daily'
                    ? sortedRecords.map((record, index) => (
                        <IonCol key={`${record.date}-${index}`} size="12">
                          <IonCard>
                            <IonCardContent>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700 }}>{record.date}</div>
                                  <div style={{ color: '#b0b0b0', fontSize: 13 }}>{record.notes || '—'}</div>
                                </div>
                                <IonButton
                                  color="danger"
                                  fill="outline"
                                  size="small"
                                  onClick={() => handleDeleteRecord(index)}
                                >
                                  Delete
                                </IonButton>
                              </div>

                              <IonGrid style={{ padding: 0, marginTop: 12 }}>
                                <IonRow>
                                  <IonCol size="6">
                                    <div style={{ color: '#b0b0b0', fontSize: 12 }}>Weight</div>
                                    <div style={{ fontWeight: 700 }}>{record.weight} kg</div>
                                  </IonCol>
                                  <IonCol size="6">
                                    <div style={{ color: '#b0b0b0', fontSize: 12 }}>BMI</div>
                                    <div style={{ fontWeight: 700 }}>{record.bmi}</div>
                                  </IonCol>
                                </IonRow>
                              </IonGrid>
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      ))
                    : (reportMode === 'weekly' ? weeklyRows : monthlyRows).map((row) => (
                        <IonCol key={row.key} size="12">
                          <IonCard>
                            <IonCardContent>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700 }}>{row.label}</div>
                                  <div style={{ color: '#b0b0b0', fontSize: 13 }}>
                                    {row.startDate} → {row.endDate}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ color: '#b0b0b0', fontSize: 12 }}>Δ Weight</div>
                                  <div style={{ fontWeight: 800 }}>
                                    {row.deltaWeight >= 0 ? '+' : ''}{row.deltaWeight} kg
                                  </div>
                                </div>
                              </div>

                              <IonGrid style={{ padding: 0, marginTop: 12 }}>
                                <IonRow>
                                  <IonCol size="4">
                                    <div style={{ color: '#b0b0b0', fontSize: 12 }}>Avg Wt</div>
                                    <div style={{ fontWeight: 700 }}>{row.avgWeight} kg</div>
                                  </IonCol>
                                  <IonCol size="4">
                                    <div style={{ color: '#b0b0b0', fontSize: 12 }}>Avg BMI</div>
                                    <div style={{ fontWeight: 700 }}>{row.avgBmi}</div>
                                  </IonCol>
                                  <IonCol size="4">
                                    <div style={{ color: '#b0b0b0', fontSize: 12 }}>Entries</div>
                                    <div style={{ fontWeight: 700 }}>{row.entries}</div>
                                  </IonCol>
                                </IonRow>
                              </IonGrid>
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      ))}
                </IonRow>
              </IonGrid>
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ProgressTracker;