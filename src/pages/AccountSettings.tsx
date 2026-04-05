import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonToast,
} from "@ionic/react";
import { lockClosed, personCircle, save } from "ionicons/icons";
import { API_CONFIG } from "../config/api.config";
import { ensureToken } from "../services/auth.service";
import "./AccountSettings.css";

type UserProfile = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

const API_URL = API_CONFIG.BASE_URL;

const AccountSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [presentToast] = useIonToast();

  const loadProfile = async () => {
    try {
      setLoading(true);
      const token = (await ensureToken()) || localStorage.getItem("token") || "";
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.user) {
        throw new Error(data?.message || "Failed to load profile");
      }

      const user = data.user as UserProfile;
      setProfile(user);
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
    } catch (error: any) {
      presentToast({
        message: `Error: ${error?.message || "Failed to load account settings"}`,
        duration: 3000,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const syncUserToStorage = (user: UserProfile) => {
    try {
      const normalized = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      };
      localStorage.setItem("user", JSON.stringify(normalized));
      localStorage.setItem("currentUser", JSON.stringify(normalized));
      window.dispatchEvent(new Event("auth-changed"));
    } catch {
      // ignore storage sync errors
    }
  };

  const handleSaveProfile = async () => {
    const first = firstName.trim();
    const last = lastName.trim();
    const emailValue = email.trim().toLowerCase();

    if (!first || !last || !emailValue) {
      presentToast({
        message: "First name, last name, and email are required.",
        duration: 2500,
        color: "warning",
      });
      return;
    }

    try {
      setSavingProfile(true);
      const token = (await ensureToken()) || localStorage.getItem("token") || "";
      if (!token) throw new Error("Please log in again.");

      const response = await fetch(`${API_URL}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: first,
          lastName: last,
          email: emailValue,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.user) {
        throw new Error(data?.message || "Failed to save profile");
      }

      const updatedUser = data.user as UserProfile;
      setProfile(updatedUser);
      setFirstName(updatedUser.firstName || "");
      setLastName(updatedUser.lastName || "");
      setEmail(updatedUser.email || "");
      syncUserToStorage(updatedUser);

      presentToast({
        message: "Profile updated successfully.",
        duration: 2200,
        color: "success",
      });
    } catch (error: any) {
      presentToast({
        message: `Error: ${error?.message || "Failed to update profile"}`,
        duration: 3200,
        color: "danger",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      presentToast({
        message: "Fill in all password fields.",
        duration: 2500,
        color: "warning",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      presentToast({
        message: "New password and confirmation do not match.",
        duration: 2500,
        color: "warning",
      });
      return;
    }

    try {
      setSavingPassword(true);
      const token = (await ensureToken()) || localStorage.getItem("token") || "";
      if (!token) throw new Error("Please log in again.");

      const response = await fetch(`${API_URL}/user/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      presentToast({
        message: "Password changed successfully.",
        duration: 2300,
        color: "success",
      });
    } catch (error: any) {
      presentToast({
        message: `Error: ${error?.message || "Failed to change password"}`,
        duration: 3200,
        color: "danger",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Account Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding account-settings-content">
        {loading ? (
          <div className="account-loading">
            <IonSpinner name="crescent" />
            <p>Loading account settings...</p>
          </div>
        ) : (
          <div className="account-settings-wrap">
            <IonCard>
              <IonCardContent>
                <h2 className="account-section-title">
                  <IonIcon icon={personCircle} /> Profile
                </h2>
                <IonList lines="none">
                  <IonItem>
                    <IonLabel position="stacked">First Name</IonLabel>
                    <IonInput
                      value={firstName}
                      onIonChange={(e) => setFirstName(String(e.detail.value || ""))}
                    />
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked">Last Name</IonLabel>
                    <IonInput
                      value={lastName}
                      onIonChange={(e) => setLastName(String(e.detail.value || ""))}
                    />
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked">Email</IonLabel>
                    <IonInput
                      type="email"
                      value={email}
                      onIonChange={(e) => setEmail(String(e.detail.value || ""))}
                    />
                  </IonItem>
                </IonList>

                <IonButton
                  expand="block"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="account-save-btn"
                >
                  <IonIcon icon={save} slot="start" />
                  {savingProfile ? "Saving..." : "Save Profile"}
                </IonButton>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardContent>
                <h2 className="account-section-title">
                  <IonIcon icon={lockClosed} /> Change Password
                </h2>
                <IonList lines="none">
                  <IonItem>
                    <IonLabel position="stacked">Current Password</IonLabel>
                    <IonInput
                      type="password"
                      value={currentPassword}
                      onIonChange={(e) => setCurrentPassword(String(e.detail.value || ""))}
                    />
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked">New Password</IonLabel>
                    <IonInput
                      type="password"
                      value={newPassword}
                      onIonChange={(e) => setNewPassword(String(e.detail.value || ""))}
                    />
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked">Confirm New Password</IonLabel>
                    <IonInput
                      type="password"
                      value={confirmPassword}
                      onIonChange={(e) => setConfirmPassword(String(e.detail.value || ""))}
                    />
                  </IonItem>
                </IonList>
                <p className="account-password-help">
                  Use at least 8 characters with uppercase, lowercase, number, and special character.
                </p>

                <IonButton
                  expand="block"
                  color="medium"
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                >
                  <IonIcon icon={lockClosed} slot="start" />
                  {savingPassword ? "Updating..." : "Change Password"}
                </IonButton>
              </IonCardContent>
            </IonCard>

            {profile?.role && (
              <p className="account-role-note">Account type: {profile.role}</p>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AccountSettings;
