// src/components/PrivateRoute.tsx
import React, { useEffect, useState } from 'react';
import { Route, Redirect, RouteProps } from 'react-router-dom';
import { ensureToken } from '../services/auth.service';

interface PrivateRouteProps extends RouteProps {
  role?: 'admin' | 'member';
  component: React.ComponentType<any>;
}

function readRole(): 'admin' | 'member' | undefined {
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const role = (parsed?.role ?? parsed?.user?.role ?? parsed?.data?.role) as unknown;
    const norm = String(role || '').trim().toLowerCase();
    if (norm === 'admin' || norm === 'member') return norm as 'admin' | 'member';
    return undefined;
  } catch {
    return undefined;
  }
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ role, component: Component, ...rest }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [currentRole, setCurrentRole] = useState<'admin' | 'member' | undefined>(readRole());

  useEffect(() => {
    let active = true;

    const hydrateAuth = async () => {
      try {
        await ensureToken();
      } catch {
        // ignore, auth state will be inferred from storage after ensureToken attempt
      } finally {
        if (!active) return;
        setIsAuthenticated(!!localStorage.getItem('token'));
        setCurrentRole(readRole());
        setIsChecking(false);
      }
    };

    hydrateAuth();

    const onAuthChanged = () => {
      if (!active) return;
      setIsAuthenticated(!!localStorage.getItem('token'));
      setCurrentRole(readRole());
    };

    window.addEventListener('auth-changed', onAuthChanged as EventListener);
    return () => {
      active = false;
      window.removeEventListener('auth-changed', onAuthChanged as EventListener);
    };
  }, []);

  return (
    <Route
      {...rest}
      render={props => {
        if (isChecking) {
          return null;
        }

        if (!isAuthenticated) {
          return <Redirect to="/home" />;
        }

        if (role && currentRole && currentRole !== role) {
          return <Redirect to={currentRole === 'admin' ? '/admin' : '/member'} />;
        }

        // If we have a token but can't determine role, send the user home to re-auth.
        if (role && !currentRole) {
          return <Redirect to="/home" />;
        }

        return <Component {...props} />;
      }}
    />
  );
};

export default PrivateRoute;