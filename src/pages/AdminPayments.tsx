import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonBadge,
  IonIcon,
  IonSearchbar,
  useIonToast,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonAlert,
} from "@ionic/react";
import {
  cash,
  person,
  informationCircle,
  trash,
} from "ionicons/icons";
import "./AdminPayments.css";

const API_URL = "http://localhost:3002/api";

interface Payment {
  id: number;
  user_id: number;
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
  payment_method: string;
  membership_type: string;
  payment_status: string;
  payment_date: string;
  transaction_id: string;
  subscription_start?: string;
  subscription_end?: string;
  notes?: string;
}

const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<number | null>(null);
  const [presentToast] = useIonToast();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadPayments();
    
    const interval = setInterval(() => {
      loadPayments();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterPayments();
  }, [searchText, payments]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading payment history...');
      
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error('❌ No auth token found');
        presentToast({
          message: "Please login again",
          duration: 2000,
          color: "danger",
        });
        return;
      }

      const response = await fetch(`${API_URL}/admin/payments/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded payments:', data.length);
        
        if (Array.isArray(data)) {
          setPayments(data);
        } else {
          setPayments([]);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Failed response:', response.status, errorText);
        presentToast({
          message: `Failed to load payments: ${response.status}`,
          duration: 3000,
          color: "danger",
        });
        setPayments([]);
      }
    } catch (error: any) {
      console.error("❌ Error loading payments:", error);
      presentToast({
        message: `Error: ${error.message}`,
        duration: 3000,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = payments;

    if (searchText.trim()) {
      filtered = filtered.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(searchText.toLowerCase()) ||
          p.lastName?.toLowerCase().includes(searchText.toLowerCase()) ||
          p.email?.toLowerCase().includes(searchText.toLowerCase()) ||
          p.transaction_id?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    setFilteredPayments(filtered);
  };

  const handleRefresh = async (event: any) => {
    await loadPayments();
    event.detail.complete();
  };

  const handleDeletePayment = (paymentId: number) => {
    setPaymentToDelete(paymentId);
    setShowDeleteAlert(true);
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDelete) return;

    try {
      const response = await fetch(`${API_URL}/admin/payments/${paymentToDelete}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        presentToast({
          message: '✅ Payment record deleted successfully',
          duration: 2000,
          color: 'success',
        });

        await loadPayments();
      } else {
        throw new Error(result.message || 'Failed to delete payment');
      }
    } catch (error: any) {
      console.error('❌ Delete payment error:', error);
      presentToast({
        message: `Failed to delete payment: ${error.message}`,
        duration: 3000,
        color: 'danger',
      });
    } finally {
      setPaymentToDelete(null);
    }
  };

  const getStatusColor = (status: string) => {
    // Default to 'paid' if status is null/undefined
    const normalizedStatus = (status || 'paid').toLowerCase();
    
    switch (normalizedStatus) {
      case "paid":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
        return "danger";
      default:
        return "success"; // Default to success (paid) for any other case
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin" />
          </IonButtons>
          <IonTitle>Payment History</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="payments-content">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="payments-container">
          {/* Info Banner */}
          <IonCard style={{ background: 'rgba(0, 230, 118, 0.1)', border: '1px solid #00e676' }}>
            <IonCardContent>
              <p style={{ margin: 0, color: '#00e676', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IonIcon icon={informationCircle} />
                All payments are shown here. GCash payments are auto-approved. 
                Cash payments are recorded by admin. You can delete old records for cleanup.
              </p>
            </IonCardContent>
          </IonCard>

          {/* Statistics - Only All Transactions */}
          <div className="stats-row" style={{ justifyContent: 'center' }}>
            <div className="stat-card" style={{ maxWidth: '400px' }}>
              <IonIcon icon={person} style={{ fontSize: '3rem' }} />
              <h3 style={{ fontSize: '3rem', margin: '1rem 0' }}>{payments.length}</h3>
              <p style={{ fontSize: '1.2rem' }}>All Transactions</p>
            </div>
          </div>

          {/* Search Only - No Filter Tabs */}
          <div className="filters-section">
            <IonSearchbar
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value!)}
              placeholder="Search payments..."
            />
          </div>

          {/* Payments List */}
          <div className="payments-grid">
            {loading ? (
              <div className="empty-state">
                <p>Loading payments...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="empty-state">
                <IonIcon icon={cash} />
                <h3>No Payments Found</h3>
                <p>There are no payment records yet</p>
              </div>
            ) : (
              filteredPayments.map((payment) => (
                <IonCard key={payment.id} className="payment-card">
                  <IonCardContent>
                    <div className="payment-header">
                      <div>
                        <h3 className="payment-name">
                          <IonIcon icon={person} /> {payment.firstName} {payment.lastName}
                        </h3>
                        <p className="payment-email">{payment.email}</p>
                      </div>
                      <IonBadge color={getStatusColor(payment.payment_status)}>
                        {payment.payment_status ? payment.payment_status.toUpperCase() : 'PAID'}
                      </IonBadge>
                    </div>

                    <div className="payment-details">
                      <div className="payment-row">
                        <span>Amount:</span>
                        <strong>₱{Number(payment.amount || 0).toLocaleString()}</strong>
                      </div>
                      <div className="payment-row">
                        <span>Plan:</span>
                        <strong>{payment.membership_type || 'N/A'}</strong>
                      </div>
                      <div className="payment-row">
                        <span>Method:</span>
                        <strong style={{ 
                          color: payment.payment_method?.toLowerCase().includes('gcash') ? '#00e676' : '#fff' 
                        }}>
                          {payment.payment_method?.toUpperCase() || 'CASH'}
                        </strong>
                      </div>
                      <div className="payment-row">
                        <span>Date:</span>
                        <strong>
                          {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                        </strong>
                      </div>
                      <div className="payment-row">
                        <span>Transaction ID:</span>
                        <strong className="transaction-id">{payment.transaction_id || 'N/A'}</strong>
                      </div>
                      
                      {payment.subscription_start && payment.subscription_end && (
                        <div className="payment-row highlight">
                          <span>Subscription:</span>
                          <strong>
                            {new Date(payment.subscription_start).toLocaleDateString()} - {new Date(payment.subscription_end).toLocaleDateString()}
                          </strong>
                        </div>
                      )}
                      
                      {payment.notes && (
                        <div className="payment-row">
                          <span>Notes:</span>
                          <strong>{payment.notes}</strong>
                        </div>
                      )}
                    </div>

                    {payment.payment_method?.toLowerCase().includes('gcash') && (
                      <div style={{ 
                        marginTop: '1rem', 
                        padding: '0.5rem', 
                        background: 'rgba(0, 230, 118, 0.1)', 
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        color: '#00e676'
                      }}>
                        <IonIcon icon={person} />
                        Auto-approved - Instant access granted
                      </div>
                    )}

                    {/* Delete Button */}
                    <div className="payment-actions" style={{ marginTop: '1rem' }}>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="danger"
                        size="small"
                        onClick={() => handleDeletePayment(payment.id)}
                      >
                        <IonIcon icon={trash} slot="start" />
                        Delete Record
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))
            )}
          </div>
        </div>

        {/* Delete Confirmation Alert */}
        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => {
            setShowDeleteAlert(false);
            setPaymentToDelete(null);
          }}
          header="Delete Payment Record"
          message="Are you sure you want to delete this payment record? This action cannot be undone."
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              cssClass: 'secondary',
            },
            {
              text: 'Delete',
              role: 'destructive',
              handler: confirmDeletePayment,
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminPayments;