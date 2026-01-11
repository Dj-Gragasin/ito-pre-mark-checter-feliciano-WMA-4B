import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonButtons,
  useIonRouter,
} from "@ionic/react";
import {
  home,
  qrCode,
  calendarOutline,
  calculator,
  restaurant,
  trendingUp,
  barbell,
  logOut,
  card,
  calendar,
  flame,
} from "ionicons/icons";
import "./MemberDashboard.css";

import { API_CONFIG } from "../config/api.config";

const API_URL = API_CONFIG.BASE_URL;

const MemberDashboard: React.FC = () => {
  const [memberName, setMemberName] = useState("John Doe");
  const [firstName, setFirstName] = useState("John");
  const [streak, setStreak] = useState<number>(0); // added
  const [motivation, setMotivation] = useState<string>(''); // added
  const router = useIonRouter();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const fullName = `${user.firstName} ${user.lastName}`;
        setMemberName(fullName);
        setFirstName(user.firstName);
      } catch (err) {
        console.error("Invalid user data in localStorage");
      }
    } else {
      router.push("/home", "root", "replace");
    }

    // Load streak and daily motivation
    loadStreakAndMotivation();
  }, [router]);

  // new helper to fetch attendance stats and pick daily motivation
  const loadStreakAndMotivation = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/attendance/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.stats) {
          setStreak(data.stats.currentStreak || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load attendance stats:', err);
    } finally {
      // Daily motivations list
      const motivations = [
        "One step at a time — your progress matters.",
        "Show up today. Your future self will thank you.",
        "Consistency beats intensity. Keep going!",
        "Small gains every day add up to big results.",
        "Fuel your body. Honor your training.",
        "Today's effort is tomorrow's strength.",
        "Discipline creates freedom — train for it."
      ];
      const idx = new Date().getDate() % motivations.length;
      setMotivation(motivations[idx]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/home", "root", "replace");
  };

  const handleNavigation = (path: string) => {
    console.log(`Navigating to: ${path}`);
    router.push(path, "forward");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Member Dashboard</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleLogout}>
              <IonIcon icon={logOut} slot="start" />
              Logout
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div className="dashboard-container">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="profile-section">
              <div className="profile-avatar">
                <i className="fas fa-user"></i>
              </div>
              <h2 className="profile-name">{memberName}</h2>
              <span className="membership-status">Premium Member</span>
            </div>

            <nav>
              <ul className="nav-menu">
                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => handleNavigation("/member")}
                  >
                    <IonIcon icon={home} />
                    Dashboard
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => handleNavigation("/member/qr")}
                  >
                    <IonIcon icon={qrCode} />
                    QR Attendance
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => handleNavigation("/member/attendance")}
                  >
                    <IonIcon icon={calendarOutline} />
                    My Attendance
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => handleNavigation("/member/calorie")}
                  >
                    <IonIcon icon={calculator} />
                    Calorie Calculator
                  </button>
                </li>
                
                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => handleNavigation("/member/meal-planner")}
                  >
                    <IonIcon icon={restaurant} />
                    Meal Planner
                  </button>
                </li>

                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => handleNavigation("/member/progress")}
                  >
                    <IonIcon icon={trendingUp} />
                    Progress Tracker
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => handleNavigation("/member/muscle-gain")}
                  >
                    <IonIcon icon={barbell} />
                    Muscle Gain Tracker
                  </button>
                </li>
                <li className="nav-item">
                  <button className="nav-link logout-btn" onClick={handleLogout}>
                    <IonIcon icon={logOut} />
                    Logout
                  </button>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="main-content">
            <div className="content-wrapper">
              <header className="page-header">
                <div className="welcome-text">
                  <h1>Welcome back, {firstName}! 👋</h1>
                  <p>Track your fitness journey and achieve your goals</p>
                </div>

                {/* replaced quick-stats with motivation and streak */}
                <div className="hero-motivation">
                  <div className="motivation-text">{motivation}</div>
                  <div className="streak-pill">
                    <IonIcon icon={flame} /> Streak: {streak} days
                  </div>
                </div>
              </header>

              <section className="dashboard-grid">
                <div
                  className="dashboard-card"
                  onClick={() => handleNavigation("/member/qr")}
                >
                  <IonIcon icon={qrCode} className="card-icon" />
                  <h3 className="card-title">QR Attendance</h3>
                  <p className="card-description">Scan to check-in</p>
                </div>

                <div
                  className="dashboard-card"
                  onClick={() => handleNavigation("/member/calorie")}
                >
                  <IonIcon icon={calculator} className="card-icon" />
                  <h3 className="card-title">Calorie Calculator</h3>
                  <p className="card-description">Track your calories</p>
                </div>

                <div
                  className="dashboard-card"
                  onClick={() => handleNavigation("/member/meal-planner")}
                >
                  <IonIcon icon={restaurant} className="card-icon" />
                  <h3 className="card-title">Meal Planner</h3>
                  <p className="card-description">Plan your meals</p>
                </div>

                <div
                  className="dashboard-card"
                  onClick={() => handleNavigation("/member/progress")}
                >
                  <IonIcon icon={trendingUp} className="card-icon" />
                  <h3 className="card-title">Progress Tracker</h3>
                  <p className="card-description">Track your progress</p>
                </div>

                <div
                  className="dashboard-card"
                  onClick={() => handleNavigation("/member/muscle-gain")}
                >
                  <IonIcon icon={barbell} className="card-icon" />
                  <h3 className="card-title">Muscle Gain</h3>
                  <p className="card-description">Build muscle</p>
                </div>
              </section>

              <section className="progress-section">
                <div className="progress-header">
                  <h2 className="progress-title">Daily Motivation</h2>
                  <p className="progress-subtitle">Short reminders to keep you consistent</p>
                </div>

                <div className="progress-grid">
                  {(() => {
                    const allMotivations = [
                      "One step at a time — your progress matters.",
                      "Show up today. Your future self will thank you.",
                      "Consistency beats intensity. Keep going!",
                      "Small gains every day add up to big results.",
                      "Fuel your body. Honor your training.",
                      "Today's effort is tomorrow's strength.",
                      "Discipline creates freedom — train for it."
                    ];
                    const baseIdx = new Date().getDate() % allMotivations.length;
                    const mot1 = allMotivations[baseIdx];
                    const mot2 = allMotivations[(baseIdx + 1) % allMotivations.length];
                    const mot3 = allMotivations[(baseIdx + 2) % allMotivations.length];

                    return (
                      <>
                        <div className="progress-item motivation-card">
                          <IonIcon icon={calendar} style={{ fontSize: '2rem', color: 'var(--primary-color)' }} />
                          <h4>Motivation</h4>
                          <p>{mot1}</p>
                        </div>

                        <div className="progress-item motivation-card">
                          <IonIcon icon={flame} style={{ fontSize: '2rem', color: 'var(--primary-color)' }} />
                          <h4>Tip</h4>
                          <p>{mot2}</p>
                        </div>

                        <div className="progress-item motivation-card">
                          <IonIcon icon={trendingUp} style={{ fontSize: '2rem', color: 'var(--primary-color)' }} />
                          <h4>Goal</h4>
                          <p>{mot3}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </section>

              <section className="progress-section">
                <div className="progress-header">
                  <h2 className="progress-title">Subscription Status</h2>
                </div>
                
                <div className="progress-grid">
                  <div className="progress-item" style={{ gridColumn: '1 / -1' }}>
                    <IonIcon icon={card} style={{ fontSize: '2rem', color: 'var(--primary-color)' }} />
                    <h4>Active Membership</h4>
                    <p>Monthly Plan</p>
                  </div>
                </div>
              </section>

              <IonButton 
                expand="block" 
                color="medium"
                disabled
                style={{ marginTop: '2rem' }}
              >
                <IonIcon icon={card} slot="start" />
                Renew Subscription - Coming Soon
              </IonButton>
            </div>
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MemberDashboard;
