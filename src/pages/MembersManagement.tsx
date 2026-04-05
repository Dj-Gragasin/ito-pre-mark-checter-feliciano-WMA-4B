import React, { useCallback, useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonModal,
  IonFooter,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonLabel,
  IonItem,
  IonButtons,
  IonMenuButton,
  useIonToast,
  IonSearchbar,
  IonBadge,
  IonList,
  IonTextarea,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/react';
import {
  add,
  person,
  create,
  trash,
  close,
  checkmark,
  calendar,
  card,
  mail,
  call,
  fitness,
} from 'ionicons/icons';
import './MembersManagement.css';

import { API_CONFIG } from '../config/api.config';

const API_URL = API_CONFIG.BASE_URL;

type PaymentStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

interface Member {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  membershipType: string;
  membershipPrice: number;
  emergencyContact?: string;
  address?: string;
  joinDate: string;
  status: string;
  paymentStatus?: PaymentStatus;
}

const MembersManagement: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalMember, setOriginalMember] = useState<Member | null>(null);
  const [currentMember, setCurrentMember] = useState<Member>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    gender: 'male',
    dateOfBirth: '',
    membershipType: 'monthly',
    membershipPrice: 100,
    emergencyContact: '',
    address: '',
    joinDate: new Date().toISOString().split('T')[0],
    status: 'active',
    paymentStatus: 'pending',
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<Member | null>(null);
  const [paymentData, setPaymentData] = useState({
    membershipType: 'monthly',
    membershipPrice: 100,
    paymentMethod: 'cash',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Add this line
  const [presentToast] = useIonToast();

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/members`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Load members error:', error);
      presentToast({
        message: 'Failed to load members',
        duration: 2000,
        color: 'danger',
      });
    }
  }, [presentToast]);

  const filterMembers = useCallback(() => {
    if (!searchText.trim()) {
      setFilteredMembers(members);
      return;
    }
    const filtered = members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(searchText.toLowerCase()) ||
        m.lastName.toLowerCase().includes(searchText.toLowerCase()) ||
        m.email.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredMembers(filtered);
  }, [members, searchText]);

  useEffect(() => {
    loadMembers();

    const intervalId = window.setInterval(() => {
      loadMembers();
    }, 30000);

    const handleRefreshMembers = () => {
      loadMembers();
    };

    window.addEventListener('focus', handleRefreshMembers);
    window.addEventListener('payments:updated', handleRefreshMembers as EventListener);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleRefreshMembers);
      window.removeEventListener('payments:updated', handleRefreshMembers as EventListener);
    };
  }, [loadMembers]);

  useEffect(() => {
    filterMembers();
  }, [filterMembers]);

  const handleAddMember = () => {
    setIsEditing(false);
    setOriginalMember(null);
    setCurrentMember({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      gender: 'male',
      dateOfBirth: '',
      membershipType: 'monthly',
      membershipPrice: 100,
      emergencyContact: '',
      address: '',
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
      paymentStatus: 'pending',
    });
    setShowModal(true);
  };

  const handleEditMember = (member: Member) => {
    setIsEditing(true);
    setOriginalMember({ ...member });
    // Password should be optional on edit
    setCurrentMember({ ...member, password: '' });
    setShowModal(true);
  };

  const normalizeText = (value: any): string => String(value ?? '').trim();

  const addIfChanged = (payload: any, key: keyof Member, value: any, original: any) => {
    if (typeof value === 'string') {
      const v = normalizeText(value);
      const o = normalizeText(original);
      if (v !== '' && v !== o) payload[key] = v;
      return;
    }
    if (typeof value === 'number') {
      const v = Number(value);
      const o = Number(original);
      if (Number.isFinite(v) && v !== o) payload[key] = v;
      return;
    }
    if (value !== undefined && value !== original) payload[key] = value;
  };

  const handleSaveMember = async () => {
    if (!isEditing) {
      if (
        !normalizeText(currentMember.firstName) ||
        !normalizeText(currentMember.lastName) ||
        !normalizeText(currentMember.email) ||
        !normalizeText(currentMember.phone)
      ) {
        presentToast({ message: 'Fill all required fields', duration: 2000, color: 'warning' });
        return;
      }
      if (!normalizeText(currentMember.password)) {
        presentToast({ message: 'Password is required', duration: 2000, color: 'warning' });
        return;
      }
    } else {
      if (!currentMember.id) {
        presentToast({ message: 'Missing member id', duration: 2000, color: 'danger' });
        return;
      }
      if (!originalMember) {
        presentToast({ message: 'Missing original member data', duration: 2000, color: 'danger' });
        return;
      }
    }

    const original = isEditing ? (originalMember as Member) : null;

    const payload: any = {};

    if (!isEditing) {
      payload.firstName = normalizeText(currentMember.firstName);
      payload.lastName = normalizeText(currentMember.lastName);
      payload.email = normalizeText(currentMember.email);
      payload.phone = normalizeText(currentMember.phone);
      payload.gender = currentMember.gender;
      payload.dateOfBirth = currentMember.dateOfBirth;
      payload.membershipType = currentMember.membershipType;
      payload.membershipPrice = currentMember.membershipPrice;
      payload.emergencyContact = currentMember.emergencyContact;
      payload.address = currentMember.address;
      payload.joinDate = currentMember.joinDate;
      payload.status = currentMember.status;
      payload.password = normalizeText(currentMember.password);
    } else {
      // Partial update: only send changed fields; blank strings won't overwrite
      addIfChanged(payload, 'firstName', currentMember.firstName, original!.firstName);
      addIfChanged(payload, 'lastName', currentMember.lastName, original!.lastName);
      addIfChanged(payload, 'email', currentMember.email, original!.email);
      addIfChanged(payload, 'phone', currentMember.phone, original!.phone);

      // Selects: send if changed (these are never blank)
      if (currentMember.gender && currentMember.gender !== original!.gender) payload.gender = currentMember.gender;
      if (currentMember.status && currentMember.status !== original!.status) payload.status = currentMember.status;

      // Dates: send if changed AND not blank
      addIfChanged(payload, 'dateOfBirth', currentMember.dateOfBirth, original!.dateOfBirth);
      addIfChanged(payload, 'joinDate', currentMember.joinDate, original!.joinDate);

      // Membership: if type changes, also send price
      if (currentMember.membershipType && currentMember.membershipType !== original!.membershipType) {
        payload.membershipType = currentMember.membershipType;
        payload.membershipPrice = currentMember.membershipPrice;
      } else {
        // Allow price change alone if your UI ever supports it
        addIfChanged(payload, 'membershipPrice', currentMember.membershipPrice, original!.membershipPrice);
      }

      addIfChanged(payload, 'emergencyContact', currentMember.emergencyContact, original!.emergencyContact);
      addIfChanged(payload, 'address', currentMember.address, original!.address);

      const pw = normalizeText(currentMember.password);
      if (pw) payload.password = pw;

      if (Object.keys(payload).length === 0) {
        presentToast({ message: 'No changes to update', duration: 2000, color: 'warning' });
        return;
      }
    }

    const url = isEditing ? `${API_URL}/members/${currentMember.id}` : `${API_URL}/members`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      console.log('💾 Saving member:', payload);
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        presentToast({
          message: isEditing 
            ? 'Member updated successfully' 
            : '✅ Member added! Payment record created.',
          duration: 3000,
          color: 'success',
        });
        setShowModal(false);
        await loadMembers();
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('payments:updated'));
      } else {
        const err = await res.json().catch(() => ({ message: 'Save failed' }));
        console.error('❌ Save error:', err);
        presentToast({
          message: err.message || 'Save failed',
          duration: 2500,
          color: 'danger',
        });
      }
    } catch (error) {
      console.error('❌ Save exception:', error);
      presentToast({ 
        message: 'Network error - check if backend is running', 
        duration: 2500, 
        color: 'danger' 
      });
    }
  };

  const handleDeleteMember = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    try {
      const res = await fetch(`${API_URL}/members/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.ok) {
        presentToast({
          message: 'Member deleted successfully',
          duration: 2000,
          color: 'success',
        });
        await loadMembers();
      } else {
        presentToast({
          message: 'Failed to delete member',
          duration: 2000,
          color: 'danger',
        });
      }
    } catch (error) {
      console.error('Delete member error:', error);
      presentToast({
        message: 'Failed to delete member',
        duration: 2000,
        color: 'danger',
      });
    }
  };

  const getMembershipPrice = (type: string): number => {
    switch (type) {
      case 'monthly':
        return 100;
      case 'quarterly':
        return 200;
      case 'annual':
        return 300;
      default:
        return 100;
    }
  };

  const handleMembershipTypeChange = (type: string) => {
    setCurrentMember({
      ...currentMember,
      membershipType: type,
      membershipPrice: getMembershipPrice(type),
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      default:
        // Any legacy/unknown status (e.g. 'suspended') should behave like inactive
        return 'warning';
    }
  };

  const getPaymentStatusColor = (status?: PaymentStatus): string => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'expired':
        return 'danger';
      case 'cancelled':
        return 'medium';
      default:
        return 'medium';
    }
  };

  const handleRecordPayment = (member: Member) => {
    setSelectedMemberForPayment(member);
    setPaymentData({
      membershipType: member.membershipType || 'monthly',
      membershipPrice: member.membershipPrice || 100,
      paymentMethod: 'cash',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!selectedMemberForPayment) return;

    try {
      setIsSubmitting(true);
      console.log('\n💰 ===== RECORDING PAYMENT IN MEMBERS MANAGEMENT =====');
      
      const paymentPayload = {
        userId: selectedMemberForPayment.id,
        membershipType: paymentData.membershipType,
        amount: paymentData.membershipPrice,
        paymentMethod: paymentData.paymentMethod,
        notes: paymentData.notes || ''
      };

      console.log('📝 Payment payload:', paymentPayload);

      const response = await fetch(`${API_URL}/admin/payments/record-cash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(paymentPayload),
      });

      console.log(`📡 Response status: ${response.status}`);

      const result = await response.json();
      console.log('📡 Response body:', result);

      if (response.ok && result.success) {
        console.log('✅ Payment recorded successfully!');
        console.log(`💰 Amount: ₱${paymentData.membershipPrice.toLocaleString()}`);
        console.log('🕒 Payment queued for admin approval');
        
        presentToast({
          message: `✅ Cash payment recorded and queued. Approve it in Pending Payments to activate the account.`,
          duration: 5000,
          color: 'success',
          position: 'top'
        });

        // Close modal first
        setShowPaymentModal(false);
        setSelectedMemberForPayment(null);
        
        // Reload members to show updated status
        console.log('🔄 Reloading members list...');
        await loadMembers();

        // ✅ Dispatch event to Admin Dashboard with more details
        console.log('🔔 Dispatching payments:updated event...');
        const event = new CustomEvent('payments:updated', {
          detail: {
            type: 'payment_recorded',
            memberId: selectedMemberForPayment.id,
            memberName: `${selectedMemberForPayment.firstName} ${selectedMemberForPayment.lastName}`,
            amount: paymentData.membershipPrice,
            method: paymentData.paymentMethod,
            transactionId: result.transactionId,
            paymentStatus: result.paymentStatus,
            timestamp: new Date().toISOString()
          },
        });
        
        window.dispatchEvent(event);
        console.log('✅ Event dispatched with details:', event.detail);
        console.log('===== PAYMENT RECORDING COMPLETE =====\n');

      } else {
        console.error('❌ Payment recording failed:', result);
        throw new Error(result.message || 'Failed to record payment');
      }
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      presentToast({
        message: `❌ Failed to record payment: ${error.message}`,
        duration: 4000,
        color: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentMembershipTypeChange = (type: string) => {
    setPaymentData({
      ...paymentData,
      membershipType: type,
      membershipPrice: getMembershipPrice(type),
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Members Management</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleAddMember}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="members-content">
        <div className="members-container">
          <IonGrid fixed>
            {/* Header Stats */}
            <IonRow>
              <IonCol size="12" sizeMd="4">
                <div className="stat-card">
                  <IonIcon icon={person} />
                  <h3>{members.length}</h3>
                  <p>Total Members</p>
                </div>
              </IonCol>
              <IonCol size="12" sizeMd="4">
                <div className="stat-card success">
                  <IonIcon icon={checkmark} />
                  <h3>{members.filter((m) => m.status === 'active').length}</h3>
                  <p>Active Members</p>
                </div>
              </IonCol>
              <IonCol size="12" sizeMd="4">
                <div className="stat-card warning">
                  <IonIcon icon={calendar} />
                  <h3>{members.filter((m) => m.paymentStatus === 'pending').length}</h3>
                  <p>Pending Payments</p>
                </div>
              </IonCol>
            </IonRow>

            {/* Search Bar */}
            <IonRow>
              <IonCol size="12">
                <IonSearchbar
                  value={searchText}
                  onIonInput={(e) => setSearchText(e.detail.value || '')}
                  placeholder="Search members..."
                  className="members-search"
                />
              </IonCol>
            </IonRow>

            {/* Members */}
            <IonRow>
              {filteredMembers.length === 0 ? (
                <IonCol size="12">
                  <div className="empty-state">
                    <IonIcon icon={person} />
                    <h3>No Members Found</h3>
                    <p>Add your first member to get started</p>
                    <IonButton expand="block" onClick={handleAddMember}>
                      <IonIcon icon={add} slot="start" />
                      Add Member
                    </IonButton>
                  </div>
                </IonCol>
              ) : (
                filteredMembers.map((member) => (
                  <IonCol key={member.id} size="12" sizeMd="6" sizeLg="4">
                    <IonCard className="member-card">
                      <IonCardHeader>
                        <div className="member-header">
                          <div className="member-avatar">
                            <IonIcon icon={person} aria-hidden="true" />
                          </div>
                          <div className="member-info">
                            <IonCardTitle className="member-name">
                              <span className="member-first-name">{member.firstName}</span>
                              <span className="member-last-name">{member.lastName}</span>
                            </IonCardTitle>
                            <div className="member-badges">
                              <IonBadge color={getStatusColor(member.status)}>{String(member.status || '').toUpperCase()}</IonBadge>
                              <IonBadge color={getPaymentStatusColor(member.paymentStatus)}>
                                {String(member.paymentStatus || 'pending').toUpperCase()}
                              </IonBadge>
                            </div>
                          </div>
                        </div>
                      </IonCardHeader>
                      <IonCardContent>
                        <div className="member-details">
                          <div className="detail-item">
                            <IonIcon icon={mail} />
                            <span>{member.email}</span>
                          </div>
                          <div className="detail-item">
                            <IonIcon icon={call} />
                            <span>{member.phone}</span>
                          </div>
                          <div className="detail-item">
                            <IonIcon icon={fitness} />
                            <span>{member.membershipType}</span>
                          </div>
                          <div className="detail-item">
                            <IonIcon icon={card} />
                            <span>₱{member.membershipPrice?.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="member-card-actions">
                          <IonButton
                            expand="block"
                            size="small"
                            fill="solid"
                            color="success"
                            onClick={() => handleRecordPayment(member)}
                          >
                            <IonIcon icon={card} slot="start" />
                            Record
                          </IonButton>
                          <IonButton
                            expand="block"
                            size="small"
                            fill="outline"
                            color="primary"
                            onClick={() => handleEditMember(member)}
                          >
                            <IonIcon icon={create} slot="start" />
                            Edit
                          </IonButton>
                          <IonButton
                            expand="block"
                            size="small"
                            fill="outline"
                            color="danger"
                            onClick={() => member.id && handleDeleteMember(member.id)}
                          >
                            <IonIcon icon={trash} slot="start" />
                            Delete
                          </IonButton>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                ))
              )}
            </IonRow>
          </IonGrid>
        </div>

        {/* Add/Edit Member Modal */}
        <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)} className="members-edit-modal">
          <IonHeader>
            <IonToolbar>
              <IonTitle>{isEditing ? 'Edit Member' : 'Add Member'}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowModal(false)}>
                  <IonIcon icon={close} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="modal-content">
            <IonList>
              <IonItem>
                <IonLabel position="stacked">First Name *</IonLabel>
                <IonInput
                  value={currentMember.firstName}
                  onIonInput={(e) =>
                    setCurrentMember({ ...currentMember, firstName: e.detail.value || '' })
                  }
                  placeholder="Enter first name"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Last Name *</IonLabel>
                <IonInput
                  value={currentMember.lastName}
                  onIonInput={(e) =>
                    setCurrentMember({ ...currentMember, lastName: e.detail.value || '' })
                  }
                  placeholder="Enter last name"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Email *</IonLabel>
                <IonInput
                  type="email"
                  value={currentMember.email}
                  onIonInput={(e) =>
                    setCurrentMember({ ...currentMember, email: e.detail.value || '' })
                  }
                  placeholder="Enter email"
                />
              </IonItem>

              {!isEditing && (
                <IonItem>
                  <IonLabel position="stacked">Password *</IonLabel>
                  <IonInput
                    type="password"
                    value={currentMember.password}
                    onIonInput={(e) =>
                      setCurrentMember({ ...currentMember, password: e.detail.value || '' })
                    }
                    placeholder="Enter password"
                  />
                </IonItem>
              )}

              <IonItem>
                <IonLabel position="stacked">Phone *</IonLabel>
                <IonInput
                  type="tel"
                  value={currentMember.phone}
                  onIonInput={(e) =>
                    setCurrentMember({ ...currentMember, phone: e.detail.value || '' })
                  }
                  placeholder="Enter phone number"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Gender</IonLabel>
                <IonSelect
                  value={currentMember.gender}
                  onIonChange={(e) =>
                    setCurrentMember({ ...currentMember, gender: e.detail.value })
                  }
                >
                  <IonSelectOption value="male">Male</IonSelectOption>
                  <IonSelectOption value="female">Female</IonSelectOption>
                  <IonSelectOption value="other">Other</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Date of Birth</IonLabel>
                <IonInput
                  type="date"
                  value={currentMember.dateOfBirth}
                  onIonInput={(e) =>
                    setCurrentMember({ ...currentMember, dateOfBirth: e.detail.value || '' })
                  }
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Membership Type</IonLabel>
                <IonSelect
                  value={currentMember.membershipType}
                  onIonChange={(e) => handleMembershipTypeChange(e.detail.value)}
                >
                  <IonSelectOption value="monthly">Monthly - ₱100</IonSelectOption>
                  <IonSelectOption value="quarterly">Quarterly - ₱200</IonSelectOption>
                  <IonSelectOption value="annual">Annual - ₱300</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Emergency Contact</IonLabel>
                <IonInput
                  value={currentMember.emergencyContact}
                  onIonInput={(e) =>
                    setCurrentMember({ ...currentMember, emergencyContact: e.detail.value || '' })
                  }
                  placeholder="Enter emergency contact"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Address</IonLabel>
                <IonInput
                  value={currentMember.address}
                  onIonInput={(e) =>
                    setCurrentMember({ ...currentMember, address: e.detail.value || '' })
                  }
                  placeholder="Enter address"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Status</IonLabel>
                <IonSelect
                  value={currentMember.status}
                  onIonChange={(e) =>
                    setCurrentMember({ ...currentMember, status: e.detail.value })
                  }
                >
                  <IonSelectOption value="active">Active</IonSelectOption>
                  <IonSelectOption value="inactive">Inactive</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>
          </IonContent>
          <IonFooter>
            <div className="modal-actions">
              <IonButton expand="block" onClick={handleSaveMember} color="primary">
                <IonIcon icon={checkmark} slot="start" />
                {isEditing ? 'Update Member' : 'Add Member'}
              </IonButton>
              <IonButton expand="block" fill="outline" onClick={() => setShowModal(false)}>
                Cancel
              </IonButton>
            </div>
          </IonFooter>
        </IonModal>

        {/* Record Payment Modal */}
        <IonModal isOpen={showPaymentModal} onDidDismiss={() => setShowPaymentModal(false)} className="members-payment-modal">
          <IonHeader>
            <IonToolbar>
              <IonTitle>Record Payment</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowPaymentModal(false)}>
                  <IonIcon icon={close} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="modal-content">
            {selectedMemberForPayment && (
              <>
                <div style={{ padding: '1rem', background: 'rgba(0, 230, 118, 0.1)', margin: '1rem', borderRadius: '8px' }}>
                  <h3 style={{ margin: 0, color: '#00e676' }}>
                    {selectedMemberForPayment.firstName} {selectedMemberForPayment.lastName}
                  </h3>
                  <p style={{ margin: '0.5rem 0 0', color: '#999' }}>{selectedMemberForPayment.email}</p>
                </div>

                <IonList>
                  <IonItem>
                    <IonLabel position="stacked">Membership Type</IonLabel>
                    <IonSelect
                      value={paymentData.membershipType}
                      onIonChange={(e) => handlePaymentMembershipTypeChange(e.detail.value)}
                    >
                      <IonSelectOption value="monthly">Monthly - ₱100</IonSelectOption>
                      <IonSelectOption value="quarterly">Quarterly - ₱200</IonSelectOption>
                      <IonSelectOption value="annual">Annual - ₱300</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Amount</IonLabel>
                    <IonInput
                      type="number"
                      value={paymentData.membershipPrice}
                      onIonInput={(e) => setPaymentData({ ...paymentData, membershipPrice: parseFloat(e.detail.value || '0') })}
                    />
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Payment Method</IonLabel>
                    <IonSelect
                      value={paymentData.paymentMethod}
                      onIonChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.detail.value })}
                    >
                      <IonSelectOption value="cash">Cash</IonSelectOption>
                      <IonSelectOption value="paypal">PayPal</IonSelectOption>
                      <IonSelectOption value="bank_transfer">Bank Transfer</IonSelectOption>
                      <IonSelectOption value="check">Check</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Notes (Optional)</IonLabel>
                    <IonTextarea
                      value={paymentData.notes}
                      onIonInput={(e) => setPaymentData({ ...paymentData, notes: e.detail.value || '' })}
                      placeholder="Add payment notes..."
                      rows={3}
                    />
                  </IonItem>
                </IonList>
              </>
            )}
          </IonContent>

          <IonFooter>
            <div className="modal-actions">
              <IonButton
                expand="block"
                onClick={handleSavePayment}
                color="success"
                disabled={!selectedMemberForPayment || isSubmitting}
              >
                <IonIcon icon={checkmark} slot="start" />
                {isSubmitting ? 'Recording...' : `Record Payment (₱${paymentData.membershipPrice.toLocaleString()})`}
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => setShowPaymentModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </IonButton>
            </div>
          </IonFooter>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default MembersManagement;