import React, { useEffect, useState } from "react";
import {
  IonApp,
  IonRouterOutlet,
  IonSplitPane,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Route, Redirect } from "react-router-dom";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Theme variables */
import "./theme/variables.css";

/* Import pages */
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import MemberDashboard from "./pages/MemberDashboard";
import MyAttendance from "./pages/MyAttendance";
import Calorie from "./pages/Calorie";
import QrAttendance from "./pages/QrAttendance";
import ProgressTracker from "./pages/ProgressTracker";
import MuscleGainTracker from "./pages/MuscleGainTracker";
import MembersManagement from "./pages/MembersManagement";
import MemberPayment from "./pages/MemberPayment";
import AdminPendingPayments from "./pages/AdminPendingPayments";
import MealPlanner from "./pages/MealPlanner";
import AdminAttendance from "./pages/AdminAttendance";
import EquipmentManagement from "./pages/EquipmentManagement";
import AdminPayments from "./pages/AdminPayments";
import PaymentReturn from "./pages/PaymentReturn";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";

import AppMenu from "./components/AppMenu";

/* Import role-based route */
import PrivateRoute from "./components/PrivateRoute";
import { ensureToken } from "./services/auth.service";

setupIonicReact();

function readAuthState() {
  const token = localStorage.getItem('token');
  let role: string | undefined = undefined;
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (raw) {
      const user = JSON.parse(raw);
      role = (user?.role ?? user?.user?.role ?? user?.data?.role) as string | undefined;
    }
  } catch {
    // ignore
  }
  const roleNorm = String(role || '').trim().toLowerCase();
  const isAuthed = !!token && (roleNorm === 'admin' || roleNorm === 'member');
  return { isAuthed, role: roleNorm };
}

const App: React.FC = () => {
  const [authState, setAuthState] = useState(readAuthState());

  useEffect(() => {
    const onStorage = () => setAuthState(readAuthState());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    // Also update on initial mount in case localStorage changed before React booted
    setAuthState(readAuthState());
  }, []);

  useEffect(() => {
    // Optional dev autologin. Disabled by default to avoid showing the menu on /home.
    if (process.env.NODE_ENV === "development" && process.env.REACT_APP_DEV_AUTOLOGIN === 'true') {
      (async () => {
        try {
          await ensureToken(); // uses default dev email
        } catch (err) {
          console.warn("Dev ensureToken failed", err);
        }
      })();
    }
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <IonSplitPane contentId="main" when={authState.isAuthed}>
          <AppMenu />
          <IonRouterOutlet id="main">
            <Route exact path="/home" component={Home} />

          {/* Protected Admin Routes */}
          <PrivateRoute
            exact
            path="/admin"
            component={AdminDashboard}
            role="admin"
          />

          <PrivateRoute
            exact
            path="/members-management"
            component={MembersManagement}
            role="admin"
          />
          <PrivateRoute
            exact
            path="/admin/payments/pending"
            component={AdminPendingPayments}
            role="admin"
          />
          <Route exact path="/admin-attendance">
            <AdminAttendance />
          </Route>
          <Route path="/equipment-management" component={EquipmentManagement} />
          <Route path="/admin-payments" component={AdminPayments} />

          {/* Protected Member Routes */}
          <PrivateRoute
            exact
            path="/member"
            component={MemberDashboard}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/qr"
            component={QrAttendance}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/attendance"
            component={MyAttendance}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/calorie"
            component={Calorie}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/meal-planner"
            component={MealPlanner}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/progress"
            component={ProgressTracker}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/muscle-gain"
            component={MuscleGainTracker}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/payment"
            component={MemberPayment}
            role="member"
          />

          {/* Payment Routes */}
          <Route path="/payment/success" component={PaymentReturn} />
          <Route path="/payment/failed" component={PaymentReturn} />
          <PrivateRoute
            exact
            path="/member/payment/success"
            component={PaymentSuccess}
            role="member"
          />
          <PrivateRoute
            exact
            path="/member/payment/failed"
            component={PaymentFailed}
            role="member"
          />

            {/* Default redirect */}
            <Route exact path="/" render={() => <Redirect to="/home" />} />
          </IonRouterOutlet>
        </IonSplitPane>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
