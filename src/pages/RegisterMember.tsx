import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonProgressBar,
  IonList,
  IonItem,
  IonLabel,
  IonText,
  useIonRouter,
} from '@ionic/react';
import Chart from 'chart.js/auto';

import './RegisterMember.css';

type MemberProfile = {
  memberName: string;
  memberEmail: string;
  plan: string;
  memberSince: string;
  nextPayment: string;
  totalWorkouts: string;
  avgDuration: string;
  calories: string;
  attendanceRate: string;
};

const RegisterMember: React.FC = () => {
  const router = useIonRouter();

  const [profile, setProfile] = useState<MemberProfile>({
    memberName: 'John Doe',
    memberEmail: 'john.doe@email.com',
    plan: 'Standard Plan',
    memberSince: 'Jan 2024',
    nextPayment: 'Oct 2025',
    totalWorkouts: '12',
    avgDuration: '45 mins',
    calories: '3000',
    attendanceRate: '85%',
  });

  const membershipProgress = 0.75;

  const workoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fitnessCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const chartsData = useMemo(
    () => ({
      workout: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        values: [3, 4, 2, 5, 4],
      },
      goals: {
        achieved: 70,
        remaining: 30,
      },
    }),
    []
  );

  useEffect(() => {
    setProfile({
      memberName: localStorage.getItem('memberName') || 'John Doe',
      memberEmail: localStorage.getItem('memberEmail') || 'john.doe@email.com',
      plan: localStorage.getItem('memberPlan') || 'Standard Plan',
      memberSince: localStorage.getItem('membershipSince') || 'Jan 2024',
      nextPayment: localStorage.getItem('nextPayment') || 'Oct 2025',
      totalWorkouts: localStorage.getItem('totalWorkouts') || '12',
      avgDuration: localStorage.getItem('avgDuration') || '45 mins',
      calories: localStorage.getItem('caloriesBurned') || '3000',
      attendanceRate: localStorage.getItem('attendanceRate') || '85%',
    });
  }, []);

  useEffect(() => {
    const ctx1 = workoutCanvasRef.current;
    const ctx2 = fitnessCanvasRef.current;

    if (!ctx1 || !ctx2) return;

    const chart1 = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: chartsData.workout.labels,
        datasets: [
          {
            label: 'Workouts',
            data: chartsData.workout.values,
            borderColor: '#00e676',
            backgroundColor: 'rgba(0, 230, 118, 0.12)',
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#cccccc' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { ticks: { color: '#cccccc' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        },
      },
    });

    const chart2 = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Achieved', 'Remaining'],
        datasets: [
          {
            data: [chartsData.goals.achieved, chartsData.goals.remaining],
            backgroundColor: ['#00e676', '#e2e8f0'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#cccccc' } } },
        cutout: '70%',
      },
    });

    return () => {
      chart1.destroy();
      chart2.destroy();
    };
  }, [chartsData]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login', 'root', 'replace');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Member Profile</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleLogout}>Logout</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="member-page">
          <IonGrid fixed>
            <IonRow>
              <IonCol size="12" sizeMd="5" sizeLg="4">
                <IonCard className="profile-sidebar">
                  <IonCardHeader className="profile-header">
                    <div className="profile-avatar" aria-hidden="true">👤</div>
                    <IonCardTitle className="profile-name">{profile.memberName}</IonCardTitle>
                    <IonCardSubtitle className="profile-email">{profile.memberEmail}</IonCardSubtitle>
                  </IonCardHeader>

                  <IonCardContent>
                    <div className="membership-header">
                      <h3>Membership Status</h3>
                      <span className="status-badge status-active">Active</span>
                    </div>

                    <IonProgressBar value={membershipProgress} className="membership-progress" />

                    <IonList className="membership-meta" lines="none">
                      <IonItem className="membership-meta-item">
                        <IonLabel>
                          <div className="meta-label">Plan</div>
                          <div>{profile.plan}</div>
                        </IonLabel>
                      </IonItem>
                      <IonItem className="membership-meta-item">
                        <IonLabel>
                          <div className="meta-label">Member Since</div>
                          <div>{profile.memberSince}</div>
                        </IonLabel>
                      </IonItem>
                      <IonItem className="membership-meta-item">
                        <IonLabel>
                          <div className="meta-label">Next Payment</div>
                          <div>{profile.nextPayment}</div>
                        </IonLabel>
                      </IonItem>
                      <IonItem className="membership-meta-item">
                        <IonLabel>
                          <div className="meta-label">Payment Status</div>
                          <div className="text-success">Paid</div>
                        </IonLabel>
                      </IonItem>
                    </IonList>

                    <div className="profile-actions">
                      <IonButton expand="block" className="btn btn-primary" onClick={() => window.alert('Edit profile: coming soon')}
                      >
                        Edit Profile
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        className="btn btn-secondary"
                        onClick={() => window.alert('Exported!')}
                      >
                        Export Data
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="7" sizeLg="8" className="profile-content">
                <IonCard className="content-section">
                  <IonCardHeader>
                    <IonCardTitle className="section-title">Fitness Overview</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonGrid>
                      <IonRow>
                        <IonCol size="6" sizeMd="3">
                          <div className="stat-card">
                            <div className="stat-value">{profile.totalWorkouts}</div>
                            <div className="stat-label">Total Workouts</div>
                          </div>
                        </IonCol>
                        <IonCol size="6" sizeMd="3">
                          <div className="stat-card">
                            <div className="stat-value">{profile.avgDuration}</div>
                            <div className="stat-label">Avg. Duration</div>
                          </div>
                        </IonCol>
                        <IonCol size="6" sizeMd="3">
                          <div className="stat-card">
                            <div className="stat-value">{profile.calories}</div>
                            <div className="stat-label">Calories Burned</div>
                          </div>
                        </IonCol>
                        <IonCol size="6" sizeMd="3">
                          <div className="stat-card">
                            <div className="stat-value">{profile.attendanceRate}</div>
                            <div className="stat-label">Attendance Rate</div>
                          </div>
                        </IonCol>
                      </IonRow>

                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <div className="chart-container">
                            <h3>Workout Progress</h3>
                            <div className="chart-canvas-wrap">
                              <canvas ref={workoutCanvasRef} />
                            </div>
                          </div>
                        </IonCol>
                        <IonCol size="12" sizeMd="6">
                          <div className="chart-container">
                            <h3>Fitness Goals</h3>
                            <div className="chart-canvas-wrap">
                              <canvas ref={fitnessCanvasRef} />
                            </div>
                          </div>
                        </IonCol>
                      </IonRow>
                    </IonGrid>
                  </IonCardContent>
                </IonCard>

                <IonCard className="content-section">
                  <IonCardHeader>
                    <IonCardTitle className="section-title">Recent Activities</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonText color="medium">
                      No recent activities yet.
                    </IonText>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default RegisterMember;