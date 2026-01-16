import React, { useState, useEffect } from 'react';
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
  IonSelect,
  IonCard,
  IonCardContent,
  IonSelectOption,
} from '@ionic/react';
import {
  barbell,
  analytics,
} from 'ionicons/icons';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import './MuscleGainTracker.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface MuscleGainRecord {
  date: string;
  measurements: {
    chest: number;
    arms: number;
    shoulders: number;
    back: number;
    legs: number;
  };
  strengthStats: {
    benchPress: number;
    deadlift: number;
    squat: number;
  };
  proteinIntake: number;
  notes: string;
}

const MuscleGainTracker: React.FC = () => {
  const [records, setRecords] = useState<MuscleGainRecord[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [measurements, setMeasurements] = useState({
    chest: '',
    arms: '',
    shoulders: '',
    back: '',
    legs: ''
  });
  const [strengthStats, setStrengthStats] = useState({
    benchPress: '',
    deadlift: '',
    squat: ''
  });
  const [proteinIntake, setProteinIntake] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedChart, setSelectedChart] = useState('measurements');

  useEffect(() => {
    const stored = localStorage.getItem('muscleGainRecords');
    if (stored) {
      setRecords(JSON.parse(stored));
    }
  }, []);

  const handleUpdate = () => {
    if (!validateInputs()) {
      alert('Please fill in all required fields');
      return;
    }

    const newRecord: MuscleGainRecord = {
      date,
      measurements: {
        chest: parseFloat(measurements.chest),
        arms: parseFloat(measurements.arms),
        shoulders: parseFloat(measurements.shoulders),
        back: parseFloat(measurements.back),
        legs: parseFloat(measurements.legs)
      },
      strengthStats: {
        benchPress: parseFloat(strengthStats.benchPress),
        deadlift: parseFloat(strengthStats.deadlift),
        squat: parseFloat(strengthStats.squat)
      },
      proteinIntake: parseFloat(proteinIntake),
      notes
    };

    const updatedRecords = [...records, newRecord].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    setRecords(updatedRecords);
    localStorage.setItem('muscleGainRecords', JSON.stringify(updatedRecords));
    clearForm();
  };

  const validateInputs = () => {
    return (
      measurements.chest &&
      measurements.arms &&
      measurements.shoulders &&
      measurements.back &&
      measurements.legs &&
      strengthStats.benchPress &&
      strengthStats.deadlift &&
      strengthStats.squat &&
      proteinIntake
    );
  };

  const clearForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setMeasurements({
      chest: '',
      arms: '',
      shoulders: '',
      back: '',
      legs: ''
    });
    setStrengthStats({
      benchPress: '',
      deadlift: '',
      squat: ''
    });
    setProteinIntake('');
    setNotes('');
  };

  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete all records?')) {
      setRecords([]);
      localStorage.removeItem('muscleGainRecords');
      clearForm();
    }
  };

  const measurementsChartData = {
    labels: records.map(r => r.date),
    datasets: [
      {
        label: 'Chest (cm)',
        data: records.map(r => r.measurements.chest),
        borderColor: '#FF6B6B',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        tension: 0.4
      },
      {
        label: 'Arms (cm)',
        data: records.map(r => r.measurements.arms),
        borderColor: '#4ECDC4',
        backgroundColor: 'rgba(78, 205, 196, 0.1)',
        tension: 0.4
      },
      {
        label: 'Shoulders (cm)',
        data: records.map(r => r.measurements.shoulders),
        borderColor: '#45B7D1',
        backgroundColor: 'rgba(69, 183, 209, 0.1)',
        tension: 0.4
      }
    ]
  };

  const strengthChartData = {
    labels: records.map(r => r.date),
    datasets: [
      {
        label: 'Bench Press (kg)',
        data: records.map(r => r.strengthStats.benchPress),
        backgroundColor: '#FF6B6B'
      },
      {
        label: 'Deadlift (kg)',
        data: records.map(r => r.strengthStats.deadlift),
        backgroundColor: '#4ECDC4'
      },
      {
        label: 'Squat (kg)',
        data: records.map(r => r.strengthStats.squat),
        backgroundColor: '#45B7D1'
      }
    ]
  };

  const chartOptions: ChartOptions<'line' | 'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff'
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff'
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#ffffff'
        }
      },
      title: {
        display: true,
        text: selectedChart === 'measurements' ? 'Body Measurements Progress' : 'Strength Progress',
        color: '#ffffff',
        font: {
          size: 16
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
          <IonTitle>Muscle Gain Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding muscle-gain-content">
        <IonGrid fixed>
          <IonRow className="form-container">
            <IonCol size="12" sizeMd="6">
              <div className="form-section">
                <div className="form-section-title">
                  <IonIcon icon={barbell} />
                  <span>Body Measurements</span>
                </div>
                <div className="form-section-description">Track your body measurements in centimeters</div>
                <IonItem>
                  <IonLabel position="stacked">Date</IonLabel>
                  <IonInput type="date" value={date} onIonChange={e => setDate(e.detail.value!)} />
                </IonItem>
                {Object.entries(measurements).map(([key, value]) => (
                  <IonItem key={key}>
                    <IonLabel position="stacked">{key.charAt(0).toUpperCase() + key.slice(1)} (cm)</IonLabel>
                    <IonInput
                      type="number"
                      value={value}
                      onIonChange={e =>
                        setMeasurements(prev => ({
                          ...prev,
                          [key]: e.detail.value!,
                        }))
                      }
                      placeholder={`Enter ${key} measurement`}
                    />
                  </IonItem>
                ))}
              </div>
            </IonCol>

            <IonCol size="12" sizeMd="6">
              <div className="form-section">
                <div className="form-section-title">
                  <IonIcon icon={analytics} />
                  <span>Strength Stats</span>
                </div>
                <div className="form-section-description">Record your lifting achievements in kilograms</div>
                {Object.entries(strengthStats).map(([key, value]) => (
                  <IonItem key={key}>
                    <IonLabel position="stacked">{key.replace(/([A-Z])/g, ' $1').trim()} (kg)</IonLabel>
                    <IonInput
                      type="number"
                      value={value}
                      onIonChange={e =>
                        setStrengthStats(prev => ({
                          ...prev,
                          [key]: e.detail.value!,
                        }))
                      }
                      placeholder={`Enter ${key}`}
                    />
                  </IonItem>
                ))}
                <IonItem>
                  <IonLabel position="stacked">Daily Protein Intake (g)</IonLabel>
                  <IonInput
                    type="number"
                    value={proteinIntake}
                    onIonChange={e => setProteinIntake(e.detail.value!)}
                    placeholder="Enter daily protein intake"
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Notes</IonLabel>
                  <IonInput value={notes} onIonChange={e => setNotes(e.detail.value!)} placeholder="Add any notes" />
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
          <div className="charts-container">
            <div className="chart-controls">
              <IonItem>
                <IonLabel>Chart</IonLabel>
                <IonSelect value={selectedChart} onIonChange={(e) => setSelectedChart(e.detail.value)} interface="popover">
                  <IonSelectOption value="measurements">Measurements</IonSelectOption>
                  <IonSelectOption value="strength">Strength</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>
            
            <div className="chart-container">
              {selectedChart === 'measurements' ? (
                <Line data={measurementsChartData} options={chartOptions as ChartOptions<'line'>} />
              ) : (
                <Bar data={strengthChartData} options={chartOptions as ChartOptions<'bar'>} />
              )}
            </div>
          </div>
        )}

        {records.length > 0 && (
          <>
            {/* Desktop/tablet table */}
            <div className="records-table-wrap">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Chest</th>
                      <th>Arms</th>
                      <th>Bench Press</th>
                      <th>Protein</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={index}>
                        <td>{record.date}</td>
                        <td>{record.measurements.chest} cm</td>
                        <td>{record.measurements.arms} cm</td>
                        <td>{record.strengthStats.benchPress} kg</td>
                        <td>{record.proteinIntake} g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile stacked cards */}
            <div className="records-list-wrap">
              <IonGrid>
                <IonRow>
                  {records.map((record, index) => (
                    <IonCol key={index} size="12" sizeMd="6">
                      <IonCard>
                        <IonCardContent>
                          <div style={{ fontWeight: 700, marginBottom: 10 }}>{record.date}</div>
                          <IonGrid style={{ padding: 0 }}>
                            <IonRow>
                              <IonCol size="6">
                                <div style={{ color: '#b0b0b0', fontSize: 12 }}>Chest</div>
                                <div style={{ fontWeight: 700 }}>{record.measurements.chest} cm</div>
                              </IonCol>
                              <IonCol size="6">
                                <div style={{ color: '#b0b0b0', fontSize: 12 }}>Arms</div>
                                <div style={{ fontWeight: 700 }}>{record.measurements.arms} cm</div>
                              </IonCol>
                              <IonCol size="6">
                                <div style={{ color: '#b0b0b0', fontSize: 12 }}>Bench</div>
                                <div style={{ fontWeight: 700 }}>{record.strengthStats.benchPress} kg</div>
                              </IonCol>
                              <IonCol size="6">
                                <div style={{ color: '#b0b0b0', fontSize: 12 }}>Protein</div>
                                <div style={{ fontWeight: 700 }}>{record.proteinIntake} g</div>
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

export default MuscleGainTracker;