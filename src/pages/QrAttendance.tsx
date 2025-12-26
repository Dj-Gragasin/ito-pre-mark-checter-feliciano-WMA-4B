import React, { useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useHistory } from "react-router-dom";
import { API_CONFIG } from "../config/api.config";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonText,
  IonAlert,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonLoading,
  IonToast,
} from "@ionic/react";
import {
  camera,
  close,
  checkmarkCircle,
  listOutline,
  warningOutline,
} from "ionicons/icons";
import "./QrAttendance.css";

const QrAttendance: React.FC = () => {
  const history = useHistory();
  const [today, setToday] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [userName, setUserName] = useState("Member");
  const [firstName, setFirstName] = useState("Member");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "prompt">("prompt");

  useEffect(() => {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setToday(formattedDate);
    loadUserData();
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(result.state as "granted" | "denied" | "prompt");
        
        result.onchange = () => {
          setCameraPermission(result.state as "granted" | "denied" | "prompt");
        };
      }
    } catch (error) {
      console.log("Permission API not supported");
    }
  };

  const loadUserData = async () => {
    try {
      // Try API first
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            const fullName = `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim();
            setUserName(fullName || data.user.email || "Member");
            setFirstName(data.user.firstName || "Member");
            console.log('✅ User loaded from API:', data.user.firstName);
            return;
          }
        }
      }

      // Fallback to localStorage
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const fullName = `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim();
        setUserName(fullName || user.email || "Member");
        setFirstName(user.firstName || user.first_name || "Member");
        console.log('✅ User loaded from localStorage:', user.firstName || user.first_name);
      }
    } catch (err) {
      console.error("Error loading user data:", err);
      setFirstName("Member");
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission("granted");
      return true;
    } catch (error: any) {
      console.error("Camera permission denied:", error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage(
          "❌ Camera access denied.\n\n" +
          "To enable:\n" +
          "1. Click the 🔒 or ⓘ icon in your browser's address bar\n" +
          "2. Allow camera permissions for this site\n" +
          "3. Refresh the page and try again"
        );
      } else if (error.name === 'NotFoundError') {
        setErrorMessage("No camera found on this device.");
      } else {
        setErrorMessage("Could not access camera. Please check your device settings.");
      }
      
      setShowErrorAlert(true);
      setCameraPermission("denied");
      return false;
    }
  };

  const startCamera = async () => {
    try {
      const hasPermission = await requestCameraPermission();
      
      if (!hasPermission) {
        return;
      }

      setIsScanning(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const qrCodeScanner = new Html5Qrcode("qr-reader");
      setHtml5QrCode(qrCodeScanner);

      await qrCodeScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          console.log("✅ QR Code detected:", decodedText);
          handleQRCodeDetected(decodedText);
          qrCodeScanner.stop();
          setIsScanning(false);
        },
        (errorMessage) => {
          // Ignore continuous scanning errors
        }
      );
    } catch (error: any) {
      console.error("❌ Camera error:", error);
      
      let errorMsg = "Could not access camera. ";
      
      if (error.name === 'NotAllowedError') {
        errorMsg += "Please allow camera permissions in your browser settings.";
      } else if (error.name === 'NotFoundError') {
        errorMsg += "No camera detected on this device.";
      } else if (error.name === 'NotReadableError') {
        errorMsg += "Camera is already in use by another application.";
      } else {
        errorMsg += "Please check your browser settings and try again.";
      }
      
      setErrorMessage(errorMsg);
      setShowErrorAlert(true);
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
        setIsScanning(false);
      } catch (error) {
        console.error("Error stopping camera:", error);
      }
    }
  };

  const handleQRCodeDetected = async (qrToken: string) => {
    console.log("🔍 Processing QR Code:", qrToken);
    
    if (!qrToken.includes("ACTIVECORE_GYM")) {
      setErrorMessage("❌ Invalid QR Code. Please scan the gym's attendance QR code.");
      setShowErrorAlert(true);
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          qrToken: "ACTIVECORE_GYM_ATTENDANCE",
          location: 'Main Gym'
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log("✅ Attendance recorded successfully!");
        
        setSuccessMessage(
          `✅ Check-in Successful!\n\n` +
          `📅 ${data.attendance.date}\n` +
          `🕐 ${data.attendance.time}\n` +
          `📍 ${data.attendance.location}\n\n` +
          `Streak: 🔥 ${data.streak} days\n` +
          `Total: 📊 ${data.totalAttendance} days`
        );
        
        setShowSuccessToast(true);
        
        setTimeout(() => {
          history.push('/member/attendance');
        }, 2000);
        
      } else {
        console.error("❌ Check-in failed:", data.message);
        setErrorMessage(data.message);
        setShowErrorAlert(true);
      }
    } catch (error: any) {
      console.error("❌ Check-in error:", error);
      setErrorMessage("Failed to record attendance. Please try again.");
      setShowErrorAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/member" />
          </IonButtons>
          <IonTitle>QR Attendance</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="qrattendance-container" fullscreen>
        <IonLoading
          isOpen={loading}
          message="Recording attendance..."
        />

        {/* Welcome Header */}
        <div className="welcome-header">
          <div className="date-badge">
            <IonIcon icon={camera} />
            <span>{today}</span>
          </div>
          <h1 className="welcome-title">
            Welcome, {firstName}! 👋
          </h1>
          <p className="welcome-subtitle">
            Scan the QR code at the gym entrance to check in
          </p>
        </div>

        {/* Camera Permission Warning */}
        {cameraPermission === "denied" && (
          <IonCard className="warning-card">
            <IonCardContent>
              <div className="warning-content">
                <IonIcon icon={warningOutline} className="warning-icon" />
                <div>
                  <h3 className="warning-title">Camera Permission Required</h3>
                  <p className="warning-text">
                    To scan QR codes, please enable camera access:
                  </p>
                  <ol className="warning-steps">
                    <li>Click the 🔒 icon in your browser's address bar</li>
                    <li>Find "Camera" in permissions</li>
                    <li>Change to "Allow"</li>
                    <li>Refresh this page</li>
                  </ol>
                  <IonButton 
                    size="small" 
                    color="warning"
                    onClick={() => window.location.reload()}
                    className="refresh-btn"
                  >
                    Refresh Page
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Quick Link */}
        <IonCard className="quick-link-card">
          <IonCardContent>
            <IonButton 
              expand="block" 
              fill="solid" 
              color="success"
              onClick={() => history.push('/member/attendance')}
              className="history-btn"
            >
              <IonIcon icon={listOutline} slot="start" />
              View My Attendance History
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* Camera Section */}
        <IonCard className="camera-card">
          <IonCardHeader>
            <IonCardTitle className="card-title">
              <IonIcon icon={camera} />
              Scan Attendance QR Code
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {!isScanning ? (
              <div className="camera-placeholder">
                <div className="qr-frame">
                  <IonIcon icon={camera} className="qr-icon" />
                  <h3>Ready to Check In?</h3>
                  <p>Point your camera at the gym's QR code</p>
                </div>
                
                <IonButton
                  expand="block"
                  size="large"
                  onClick={startCamera}
                  disabled={cameraPermission === "denied"}
                  className="start-camera-btn"
                >
                  <IonIcon icon={camera} slot="start" />
                  {cameraPermission === "denied" ? "Camera Access Denied" : "Start Camera"}
                </IonButton>
              </div>
            ) : (
              <div className="camera-active">
                <div id="qr-reader" className="qr-reader"></div>
                
                <div className="scanning-info">
                  <div className="scan-tip">
                    <p className="scan-tip-text">
                      🎯 Position the QR code within the frame
                    </p>
                    <p className="scan-tip-subtext">
                      The camera will automatically detect the code
                    </p>
                  </div>
                  
                  <IonButton 
                    color="danger" 
                    onClick={stopCamera}
                    expand="block"
                    className="stop-btn"
                  >
                    <IonIcon icon={close} slot="start" />
                    Stop Scanning
                  </IonButton>
                </div>
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* Instructions */}
        <IonCard className="instructions-card">
          <IonCardContent>
            <h3 className="instructions-title">
              <IonIcon icon={checkmarkCircle} />
              How to Check In
            </h3>
            <ol className="instructions-list">
              <li>Tap <strong>"Start Camera"</strong> to activate</li>
              <li>Allow <strong>camera access</strong> when prompted</li>
              <li>Point at the <strong>QR code</strong> at gym entrance</li>
              <li>Wait for <strong>automatic detection</strong></li>
              <li>Success! View your <strong>attendance history</strong></li>
            </ol>
          </IonCardContent>
        </IonCard>

        <IonToast
          isOpen={showSuccessToast}
          onDidDismiss={() => setShowSuccessToast(false)}
          message={successMessage}
          duration={4000}
          position="top"
          color="success"
        />

        <IonAlert
          isOpen={showErrorAlert}
          onDidDismiss={() => setShowErrorAlert(false)}
          header="⚠️ Error"
          message={errorMessage}
          buttons={["OK"]}
        />
      </IonContent>
    </IonPage>
  );
};

export default QrAttendance;