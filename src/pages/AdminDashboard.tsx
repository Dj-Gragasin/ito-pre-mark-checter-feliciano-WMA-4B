import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  useIonRouter,
} from "@ionic/react";
import {
  people,
  barbell,
  card,
  calendar,
  logOut,
  cash,
  checkmarkCircle,
} from "ionicons/icons";
import "./AdminDashboard.css";
import { logout } from "../services/auth.service";

import { API_CONFIG } from "../config/api.config";

const API_URL = API_CONFIG.BASE_URL;

const AdminDashboard: React.FC = () => {
  const [firstName, setFirstName] = useState("Admin");
  const [totalMembers, setTotalMembers] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [totalEquipment, setTotalEquipment] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const router = useIonRouter();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setFirstName(user.firstName);
      } catch (err) {
        console.error("Invalid user data");
      }
    } else {
      router.push("/home", "root", "replace");
    }

    loadDashboardStats();

    const onPaymentUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('\n🔔 ===== PAYMENT UPDATE RECEIVED IN DASHBOARD =====');
      console.log('Event type:', customEvent.detail?.type);
      console.log('Member:', customEvent.detail?.memberName);
      console.log('Amount:', `₱${customEvent.detail?.amount?.toLocaleString()}`);
      console.log('New Total Revenue:', `₱${customEvent.detail?.totalRevenue?.toLocaleString()}`);
      
      console.log('🔄 Refreshing dashboard stats immediately...');
      loadDashboardStats();
    };

    const onEquipmentUpdate = () => {
      console.log('🔄 Equipment updated; refreshing dashboard stats...');
      loadDashboardStats();
    };

    window.addEventListener('payments:updated', onPaymentUpdate);
    window.addEventListener('equipment:updated', onEquipmentUpdate);
    console.log('👂 Admin Dashboard listening for payment events');

    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh dashboard (30s)...');
      loadDashboardStats();
    }, 30000);

    return () => {
      window.removeEventListener('payments:updated', onPaymentUpdate);
      window.removeEventListener('equipment:updated', onEquipmentUpdate);
      clearInterval(interval);
    };
  }, [router]);

  const loadDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('\n📊 ===== LOADING DASHBOARD STATS =====');

      const membersRes = await fetch(`${API_URL}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setTotalMembers(membersData.length);
        setActiveMembers(membersData.filter((m: any) => m.status === 'active').length);
        console.log(`👥 Members: ${membersData.length} total, ${membersData.filter((m: any) => m.status === 'active').length} active`);
      }

      console.log('💰 Fetching payment summary...');
      const summaryRes = await fetch(`${API_URL}/admin/payments/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(`📡 Summary response status: ${summaryRes.status}`);
      
      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        console.log('📊 Summary response:', summary);
        
        if (summary.success) {
          const revenue = Number(summary.totalRevenue) || 0;
          const pending = Number(summary.pendingPayments) || 0;
          const paid = Number(summary.paidPayments) || 0;
          
          console.log(`💰 Total Revenue: ₱${revenue.toLocaleString()}`);
          console.log(`✅ Paid Payments: ${paid}`);
          console.log(`⏳ Pending Payments: ${pending}`);
          
          setTotalRevenue(revenue);
          setPendingPayments(pending);
          
          if (revenue === 0 && paid === 0) {
            console.log('⚠️ No revenue found, checking database directly...');
            const debugRes = await fetch(`${API_URL}/admin/payments/all`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (debugRes.ok) {
              const allPayments = await debugRes.json();
              console.log(`🔍 Debug: Total payments in DB: ${allPayments.length}`);
              allPayments.forEach((p: any, i: number) => {
                console.log(`  ${i+1}. ID: ${p.id}, Amount: ₱${p.amount}, Status: ${p.payment_status}, Date: ${p.payment_date}`);
              });
            }
          }
        } else {
          console.error('❌ Payment summary failed:', summary.message);
        }
      } else {
        const errorText = await summaryRes.text();
        console.error('❌ Failed to fetch payment summary:', errorText);
      }

      // Replace /api/admin/reports/today with /api/admin/attendance/today
      console.log('📡 Fetching today attendance (admin) ...');
      const attendanceRes = await fetch(`${API_URL}/admin/attendance/today`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (attendanceRes.ok) {
        const attendanceData = await attendanceRes.json();
        console.log('📊 Admin attendance response:', attendanceData);
        if (attendanceData.success && Array.isArray(attendanceData.present)) {
          setTodayAttendance(attendanceData.present.length || 0);
        } else {
          // Fallback - if the route returns something different
          setTodayAttendance(attendanceData.present ? attendanceData.present.length : 0);
        }
      } else {
        console.warn('❌ Failed to fetch admin attendance today. Status:', attendanceRes.status);
        setTodayAttendance(0);
      }

      // Equipment count (shared DB)
      try {
        const equipmentRes = await fetch(`${API_URL}/equipment`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const equipmentData = await equipmentRes.json().catch(() => ({}));
        if (equipmentRes.ok && equipmentData?.success && Array.isArray(equipmentData.equipments)) {
          setTotalEquipment(equipmentData.equipments.length);
        } else {
          setTotalEquipment(0);
        }
      } catch {
        setTotalEquipment(0);
      }

      console.log('===== DASHBOARD STATS LOADED =====\n');

    } catch (error) {
      console.error('❌ Error loading dashboard stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/home", "root", "replace");
  };

  const handleNavigation = (path: string) => {
    console.log(`Navigating to: ${path}`);
    router.push(path, "forward", "push");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Admin Dashboard</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleLogout}>
              <IonIcon icon={logOut} slot="start" />
              Logout
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding">
        <div className="dashboard-content-wrapper">
          <IonGrid fixed>
            <IonRow>
              <IonCol size="12">
                <div className="page-header">
                  <div className="welcome-text">
                    <h1>Welcome back, {firstName}! 👋</h1>
                    <p>Here's what's happening in your gym today</p>
                  </div>
                  <div className="quick-stats">
                    <IonIcon icon={checkmarkCircle} />
                    System Active
                  </div>
                </div>
              </IonCol>
            </IonRow>

            <IonRow>
              <IonCol size="12" sizeMd="6" sizeLg="3">
                <IonCard className="dashboard-card" onClick={() => handleNavigation("/members-management")}>
                  <IonCardContent>
                    <IonIcon icon={people} className="card-icon" />
                    <h3 className="card-title">Total Members</h3>
                    <p className="card-stat">{totalMembers}</p>
                    <p className="card-description">{activeMembers} active members</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="6" sizeLg="3">
                <IonCard className="dashboard-card" onClick={() => handleNavigation("/admin-payments")}>
                  <IonCardContent>
                    <IonIcon icon={cash} className="card-icon" />
                    <h3 className="card-title">Total Revenue</h3>
                    <p className="card-stat">₱{totalRevenue.toLocaleString()}</p>
                    <p className="card-description">All-time revenue from paid payments</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="6" sizeLg="3">
                <IonCard className="dashboard-card" onClick={() => handleNavigation("/equipment-management")}>
                  <IonCardContent>
                    <IonIcon icon={barbell} className="card-icon" />
                    <h3 className="card-title">Equipment</h3>
                    <p className="card-stat">{totalEquipment}</p>
                    <p className="card-description">Total equipment items</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="6" sizeLg="3">
                <IonCard className="dashboard-card" onClick={() => handleNavigation("/admin-attendance")}>
                  <IonCardContent>
                    <IonIcon icon={calendar} className="card-icon" />
                    <h3 className="card-title">Today's Attendance</h3>
                    <p className="card-stat">{todayAttendance}</p>
                    <p className="card-description">Members checked in today</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>

            <IonRow>
              <IonCol size="12">
                <section className="progress-section">
                  <div className="progress-header">
                    <h2 className="progress-title">Quick Actions</h2>
                  </div>

                  <IonGrid>
                    <IonRow>
                      <IonCol size="12" sizeMd="6" sizeLg="3">
                        <div className="progress-item action-card" onClick={() => handleNavigation("/members-management")}>
                          <IonIcon icon={people} style={{ fontSize: '2rem', color: '#4a90e2' }} />
                          <h4>Manage Members</h4>
                          <p>Add, edit, or view member details</p>
                        </div>
                      </IonCol>

                      <IonCol size="12" sizeMd="6" sizeLg="3">
                        <div className="progress-item action-card" onClick={() => handleNavigation("/admin-payments")}>
                          <IonIcon icon={card} style={{ fontSize: '2rem', color: '#00e676' }} />
                          <h4>View Payments</h4>
                          <p>{pendingPayments} pending approval</p>
                        </div>
                      </IonCol>

                      <IonCol size="12" sizeMd="6" sizeLg="3">
                        <div className="progress-item action-card" onClick={() => handleNavigation("/admin-attendance")}>
                          <IonIcon icon={calendar} style={{ fontSize: '2rem', color: '#ffc107' }} />
                          <h4>QR Attendance</h4>
                          <p>Generate QR code for check-in</p>
                        </div>
                      </IonCol>

                      <IonCol size="12" sizeMd="6" sizeLg="3">
                        <div className="progress-item action-card" onClick={() => handleNavigation("/equipment-management")}>
                          <IonIcon icon={barbell} style={{ fontSize: '2rem', color: '#ff6b6b' }} />
                          <h4>Equipment</h4>
                          <p>Manage gym equipment inventory</p>
                        </div>
                      </IonCol>
                    </IonRow>
                  </IonGrid>
                </section>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminDashboard;
