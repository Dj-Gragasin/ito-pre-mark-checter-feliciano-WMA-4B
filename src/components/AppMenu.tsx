import React, { useEffect, useMemo, useState } from 'react';
import {
  IonAvatar,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonNote,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { useLocation } from 'react-router-dom';
import {
  barbell,
  calendar,
  calculator,
  card,
  cash,
  home,
  logOut,
  people,
  qrCode,
  restaurant,
  statsChart,
  trendingUp,
} from 'ionicons/icons';

type Role = 'admin' | 'member' | undefined;

type MenuItem = {
  title: string;
  path: string;
  icon: string;
};

const ADMIN_ITEMS: MenuItem[] = [
  { title: 'Dashboard', path: '/admin', icon: statsChart },
  { title: 'Members', path: '/members-management', icon: people },
  { title: 'Payments', path: '/admin-payments', icon: cash },
  { title: 'Pending Payments', path: '/admin/payments/pending', icon: card },
  { title: 'Attendance', path: '/admin-attendance', icon: calendar },
  { title: 'Equipment', path: '/equipment-management', icon: barbell },
];

const MEMBER_ITEMS: MenuItem[] = [
  { title: 'Dashboard', path: '/member', icon: home },
  { title: 'QR Attendance', path: '/member/qr', icon: qrCode },
  { title: 'My Attendance', path: '/member/attendance', icon: calendar },
  { title: 'Calorie Calculator', path: '/member/calorie', icon: calculator },
  { title: 'Meal Planner', path: '/member/meal-planner', icon: restaurant },
  { title: 'Progress Tracker', path: '/member/progress', icon: trendingUp },
  { title: 'Muscle Gain', path: '/member/muscle-gain', icon: barbell },
  { title: 'Payment', path: '/member/payment', icon: cash },
];

const readUserFromStorage = (): any => {
  const candidates = ['user', 'currentUser'];
  for (const key of candidates) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return null;
};

const getRole = (): Role => {
  try {
    const user = readUserFromStorage();
    const rawRole = user?.role ?? user?.user?.role ?? user?.data?.role ?? undefined;
    if (!rawRole) return undefined;

    const roleString = String(
      typeof rawRole === 'object' && rawRole !== null ? (rawRole.name ?? rawRole.role ?? '') : rawRole
    )
      .trim()
      .toLowerCase();

    if (roleString === 'admin') return 'admin';
    if (roleString === 'member') return 'member';
    return undefined;
  } catch {
    return undefined;
  }
};

const getDisplayName = (): string => {
  try {
    const user = readUserFromStorage();
    if (!user) return '';
    const first = user?.firstName || user?.first_name || '';
    const last = user?.lastName || user?.last_name || '';
    return `${first} ${last}`.trim();
  } catch {
    return '';
  }
};

const AppMenu: React.FC = () => {
  const router = useIonRouter();
  const location = useLocation();
  const [, forceRender] = useState(0);

  // Force refresh on route changes and storage changes so the menu
  // always reflects the latest auth/user info.
  useEffect(() => {
    forceRender((n) => n + 1);
  }, [location.pathname]);

  useEffect(() => {
    const onStorage = () => forceRender((n) => n + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isAuthenticated = !!localStorage.getItem('token');
  const role = getRole();
  const displayName = getDisplayName();

  const menuItems = useMemo<MenuItem[]>(() => {
    if (!isAuthenticated || !role) return [];
    return role === 'admin' ? ADMIN_ITEMS : MEMBER_ITEMS;
  }, [isAuthenticated, role]);

  const effectiveItems = menuItems.length > 0 ? menuItems : (role === 'admin' ? ADMIN_ITEMS : MEMBER_ITEMS);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    router.push('/home', 'root', 'replace');
  };

  return (
    <IonMenu contentId="main" type="overlay" disabled={!isAuthenticated || !role} className="app-menu">
      <IonHeader>
        <IonToolbar>
          <IonTitle>ActiveCore</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {isAuthenticated && role ? (
          <>
            <IonList inset>
              <IonItem lines="none">
                <IonAvatar slot="start">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--ion-color-primary)',
                      color: 'var(--ion-color-primary-contrast)',
                      fontWeight: 700,
                    }}
                  >
                    {(displayName || role).slice(0, 1).toUpperCase()}
                  </div>
                </IonAvatar>
                <IonLabel>
                  <div style={{ fontWeight: 700 }}>{displayName || 'User'}</div>
                  <IonNote>{role === 'admin' ? 'Administrator' : 'Member'}</IonNote>
                </IonLabel>
              </IonItem>
            </IonList>

            <IonList>
              {effectiveItems.map((item) => (
                <IonMenuToggle key={item.path} autoHide={false}>
                  <IonItem routerLink={item.path} routerDirection="root" detail={false}>
                    <IonIcon icon={item.icon} slot="start" />
                    <IonLabel>{item.title}</IonLabel>
                  </IonItem>
                </IonMenuToggle>
              ))}

              <IonItem button detail={false} onClick={handleLogout}>
                <IonIcon icon={logOut} slot="start" />
                <IonLabel>Logout</IonLabel>
              </IonItem>
            </IonList>
          </>
        ) : (
          <IonList>
            <IonItem routerLink="/home" routerDirection="root" detail={false}>
              <IonIcon icon={home} slot="start" />
              <IonLabel>Home</IonLabel>
            </IonItem>
          </IonList>
        )}
      </IonContent>
    </IonMenu>
  );
};

export default AppMenu;
