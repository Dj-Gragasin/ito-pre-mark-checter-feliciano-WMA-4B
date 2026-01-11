import React, { useEffect, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonCard, IonCardContent, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonGrid, IonRow, IonCol,
  IonBadge, IonButton, IonSpinner
} from "@ionic/react";
import { statsChart, calendar, people, cash, trendingUp, refreshOutline } from "ionicons/icons";
import "./AdminReports.css";

import { API_CONFIG } from "../config/api.config";

const API_URL = API_CONFIG.BASE_URL;

type TodayReport = {
  date: string;
  revenueToday: number;
  paymentsToday: number;
  cashPaymentsToday: number;
  gcashPaymentsToday: number;
  attendanceToday: number;
  newMembersToday: number;
  renewalsToday: number;
  activeMembers: number;
};

const AdminReports: React.FC = () => {
  const [reportPeriod, setReportPeriod] = useState<string>("today");
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState<TodayReport | null>(null);

  const loadTodayStats = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading today\'s stats...');
      
      const res = await fetch(`${API_URL}/admin/reports/today`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      
      console.log('Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Raw response data:', data);
        
        // ✅ Handle both response formats
        if (data.success) {
          console.log('✅ Stats loaded successfully');
          console.log('Revenue Today:', data.revenueToday);
          console.log('Payments Today:', data.paymentsToday);
          console.log('Attendance Today:', data.attendanceToday);
          
          setToday({
            date: data.date,
            revenueToday: Number(data.revenueToday) || 0,
            paymentsToday: Number(data.paymentsToday) || 0,
            cashPaymentsToday: Number(data.cashPaymentsToday) || 0,
            gcashPaymentsToday: Number(data.gcashPaymentsToday) || 0,
            attendanceToday: Number(data.attendanceToday) || 0,
            newMembersToday: Number(data.newMembersToday) || 0,
            renewalsToday: Number(data.renewalsToday) || 0,
            activeMembers: Number(data.activeMembers) || 0,
          });
        } else {
          console.error('❌ Response success=false');
          setToday(null);
        }
      } else {
        const errorText = await res.text();
        console.error('❌ Failed to load stats. Status:', res.status, 'Response:', errorText);
        setToday(null);
      }
    } catch (e) {
      console.error("❌ Load reports error:", e);
      setToday(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadTodayStats();
    
    // Listen for payment updates from MembersManagement
    const handlePaymentUpdate = () => {
      console.log('🔔 Payment updated event received! Refreshing stats...');
      loadTodayStats();
    };
    
    window.addEventListener("payments:updated", handlePaymentUpdate);
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh (30s)...');
      loadTodayStats();
    }, 30000);
    
    return () => {
      window.removeEventListener("payments:updated", handlePaymentUpdate);
      clearInterval(interval);
    };
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin" />
          </IonButtons>
          <IonTitle>Reports & Analytics</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={loadTodayStats}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="reports-content">
        <div className="reports-container">
          <div className="period-selector">
            <IonSegment value={reportPeriod} onIonChange={(e) => setReportPeriod(e.detail.value as string)}>
              <IonSegmentButton value="today"><IonLabel>Today</IonLabel></IonSegmentButton>
              <IonSegmentButton value="week"><IonLabel>This Week</IonLabel></IonSegmentButton>
              <IonSegmentButton value="month"><IonLabel>This Month</IonLabel></IonSegmentButton>
            </IonSegment>
          </div>

          <div className="summary-section">
            <h2 className="section-title">
              <IonIcon icon={statsChart} />
              Today's Summary
            </h2>
            <p className="section-subtitle">
              {today?.date ? new Date(today.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : "Loading..."}
            </p>
            {loading && <p style={{ textAlign: 'center', color: '#00e676' }}>🔄 Refreshing data...</p>}
          </div>

          <div className="stats-grid">
            <IonCard className="report-card">
              <IonCardContent>
                <div className="card-icon revenue"><IonIcon icon={cash} /></div>
                <h3 className="card-value">
                  {loading ? <IonSpinner /> : `₱${(today?.revenueToday || 0).toLocaleString()}`}
                </h3>
                <p className="card-label">Revenue Today</p>
                <IonBadge color="warning" style={{ marginTop: 8 }}>
                  {today?.cashPaymentsToday || 0} cash • {today?.gcashPaymentsToday || 0} GCash
                </IonBadge>
              </IonCardContent>
            </IonCard>

            <IonCard className="report-card">
              <IonCardContent>
                <div className="card-icon members"><IonIcon icon={people} /></div>
                <h3 className="card-value">
                  {loading ? <IonSpinner /> : today?.paymentsToday || 0}
                </h3>
                <p className="card-label">Payments Today</p>
              </IonCardContent>
            </IonCard>

            <IonCard className="report-card">
              <IonCardContent>
                <div className="card-icon attendance"><IonIcon icon={calendar} /></div>
                <h3 className="card-value">
                  {loading ? <IonSpinner /> : today?.attendanceToday || 0}
                </h3>
                <p className="card-label">Check-ins Today</p>
              </IonCardContent>
            </IonCard>

            <IonCard className="report-card">
              <IonCardContent>
                <div className="card-icon active"><IonIcon icon={trendingUp} /></div>
                <h3 className="card-value">
                  {loading ? <IonSpinner /> : today?.activeMembers || 0}
                </h3>
                <p className="card-label">Active Members</p>
              </IonCardContent>
            </IonCard>
          </div>

          <div className="breakdown-section">
            <h2 className="section-title">
              <IonIcon icon={statsChart} />
              Detailed Breakdown
            </h2>

            <IonGrid>
              <IonRow>
                <IonCol size="12" sizeMd="6">
                  <IonCard className="breakdown-card">
                    <IonCardContent>
                      <h3>Membership</h3>
                      <div className="breakdown-row">
                        <span>New Members Today</span>
                        <strong>{today?.newMembersToday || 0}</strong>
                      </div>
                      <div className="breakdown-row">
                        <span>Renewals Today</span>
                        <strong>{today?.renewalsToday || 0}</strong>
                      </div>
                      <div className="breakdown-row">
                        <span>Active Members</span>
                        <strong>{today?.activeMembers || 0}</strong>
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonCol>

                <IonCol size="12" sizeMd="6">
                  <IonCard className="breakdown-card">
                    <IonCardContent>
                      <h3>Payments</h3>
                      <div className="breakdown-row">
                        <span>Cash Payments</span>
                        <strong>{today?.cashPaymentsToday || 0}</strong>
                      </div>
                      <div className="breakdown-row">
                        <span>GCash Payments</span>
                        <strong>{today?.gcashPaymentsToday || 0}</strong>
                      </div>
                      <div className="breakdown-row highlight">
                        <span>Total Revenue Today</span>
                        <strong>₱{(today?.revenueToday || 0).toLocaleString()}</strong>
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
            </IonGrid>

            <IonCard style={{ 
              background: 'rgba(0, 230, 118, 0.1)', 
              border: '1px solid rgba(0, 230, 118, 0.3)',
              marginTop: '1rem'
            }}>
              <IonCardContent>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00e676' }}>
                  <IonIcon icon={refreshOutline} />
                  <span style={{ fontSize: '0.9rem' }}>
                    Auto-refreshes every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </IonCardContent>
            </IonCard>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminReports;