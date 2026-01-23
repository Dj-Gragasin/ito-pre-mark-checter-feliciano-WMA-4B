import React, { useCallback, useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonButton,
  IonButtons,
  IonMenuButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonModal,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonAlert,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  useIonToast,
  IonGrid,
  IonRow,
  IonCol,
} from "@ionic/react";
import { add, create, trash, barbell, alertCircle, close, checkmark } from "ionicons/icons";
import "./EquipmentManagement.css";
import { API_CONFIG } from "../config/api.config";

interface Equipment {
  id: number;
  equipName: string;
  category: string;
  purchaseDate: string;
  status: string;
  lastMaintenance: string;
  nextSchedule: string;
  notes: string;
}

const API_URL = API_CONFIG.BASE_URL;

const EquipmentManagement: React.FC = () => {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [filteredEquipments, setFilteredEquipments] = useState<Equipment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [presentToast] = useIonToast();

  const [formData, setFormData] = useState({
    equipName: "",
    category: "cardio",
    purchaseDate: "",
    status: "operational",
    lastMaintenance: "",
    nextSchedule: "",
    notes: "",
  });

  const loadEquipments = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setEquipments([]);
        setFilteredEquipments([]);
        return;
      }

      const res = await fetch(`${API_URL}/equipment`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.equipments)) {
        setEquipments(data.equipments);
        setFilteredEquipments(data.equipments);
      } else {
        console.error('Failed to load equipments:', data);
        setEquipments([]);
        setFilteredEquipments([]);
      }
    } catch (err) {
      console.error('Failed to load equipments:', err);
      setEquipments([]);
      setFilteredEquipments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterEquipments = useCallback(() => {
    if (!searchText.trim()) {
      setFilteredEquipments(equipments);
      return;
    }

    const filtered = equipments.filter((eq) =>
      eq.equipName.toLowerCase().includes(searchText.toLowerCase()) ||
      eq.category.toLowerCase().includes(searchText.toLowerCase()) ||
      eq.status.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredEquipments(filtered);
  }, [equipments, searchText]);

  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  useEffect(() => {
    filterEquipments();
  }, [filterEquipments]);

  const handleSave = async () => {
    console.log('💾 Attempting to save equipment:', formData);
    
    // ✅ Only validate required fields
    if (!formData.equipName || !formData.equipName.trim()) {
      console.error('❌ Equipment name is empty');
      presentToast({
        message: '⚠️ Equipment name is required',
        duration: 2000,
        color: 'warning'
      });
      return;
    }

    if (!formData.purchaseDate) {
      console.error('❌ Purchase date is empty');
      presentToast({
        message: '⚠️ Purchase date is required',
        duration: 2000,
        color: 'warning'
      });
      return;
    }

    console.log('✅ Validation passed, saving equipment...');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        presentToast({ message: '⚠️ Please login again', duration: 2000, color: 'warning' });
        return;
      }

      const isEdit = Boolean(editingEquipment?.id);
      const url = isEdit ? `${API_URL}/equipment/${editingEquipment!.id}` : `${API_URL}/equipment`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          equipName: formData.equipName,
          category: formData.category,
          purchaseDate: formData.purchaseDate,
          status: formData.status,
          lastMaintenance: formData.lastMaintenance || null,
          nextSchedule: formData.nextSchedule || null,
          notes: formData.notes || '',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        presentToast({
          message: data?.message || '❌ Failed to save equipment',
          duration: 2200,
          color: 'danger',
        });
        return;
      }

      presentToast({
        message: isEdit ? '✅ Equipment updated successfully' : '✅ Equipment added successfully',
        duration: 2000,
        color: 'success',
      });

      resetForm();
      await loadEquipments();
      window.dispatchEvent(new CustomEvent('equipment:updated'));
    } catch (err) {
      console.error('Failed to save equipment:', err);
      presentToast({ message: '❌ Failed to save equipment', duration: 2200, color: 'danger' });
    }
  };

  const handleEdit = (equipment: Equipment) => {
    console.log('✏️ Editing equipment:', equipment);
    setEditingEquipment(equipment);
    setFormData(equipment);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    setEquipmentToDelete(id);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (!equipmentToDelete) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        presentToast({ message: '⚠️ Please login again', duration: 2000, color: 'warning' });
        return;
      }

      const res = await fetch(`${API_URL}/equipment/${equipmentToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        presentToast({ message: data?.message || '❌ Failed to delete equipment', duration: 2200, color: 'danger' });
        return;
      }

      setEquipmentToDelete(null);
      setShowDeleteAlert(false);
      presentToast({ message: '✅ Equipment deleted successfully', duration: 2000, color: 'success' });
      await loadEquipments();
      window.dispatchEvent(new CustomEvent('equipment:updated'));
    } catch (err) {
      console.error('Failed to delete equipment:', err);
      presentToast({ message: '❌ Failed to delete equipment', duration: 2200, color: 'danger' });
    }
  };

  const resetForm = () => {
    setFormData({
      equipName: "",
      category: "cardio",
      purchaseDate: "",
      status: "operational",
      lastMaintenance: "",
      nextSchedule: "",
      notes: "",
    });
    setEditingEquipment(null);
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "success";
      case "maintenance":
        return "warning";
      case "broken":
        return "danger";
      default:
        return "medium";
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Equipment Management</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowModal(true)}>
              <IonIcon icon={add} slot="start" />
              Add
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="equipment-content">
        <div className="equipment-container">
          <IonGrid fixed>
            <IonRow>
              <IonCol size="12">
                <div className="search-section">
                  <IonSearchbar
                    value={searchText}
                    onIonInput={(e) => setSearchText(e.detail.value!)}
                    placeholder="Search equipment..."
                  />
                </div>
              </IonCol>
            </IonRow>

            <IonRow>
              <IonCol size="12" sizeMd="6" sizeLg="3">
                <div className="stat-card">
                  <IonIcon icon={barbell} />
                  <h3>{equipments.length}</h3>
                  <p>Total Equipment</p>
                </div>
              </IonCol>
              <IonCol size="12" sizeMd="6" sizeLg="3">
                <div className="stat-card success">
                  <IonIcon icon={checkmark} />
                  <h3>{equipments.filter((e) => e.status === "operational").length}</h3>
                  <p>Operational</p>
                </div>
              </IonCol>
              <IonCol size="12" sizeMd="6" sizeLg="3">
                <div className="stat-card warning">
                  <IonIcon icon={alertCircle} />
                  <h3>{equipments.filter((e) => e.status === "maintenance").length}</h3>
                  <p>In Maintenance</p>
                </div>
              </IonCol>
              <IonCol size="12" sizeMd="6" sizeLg="3">
                <div className="stat-card danger">
                  <IonIcon icon={alertCircle} />
                  <h3>{equipments.filter((e) => e.status === "broken").length}</h3>
                  <p>Broken</p>
                </div>
              </IonCol>
            </IonRow>

            <IonRow>
              {filteredEquipments.length === 0 ? (
                <IonCol size="12">
                  <div className="empty-state">
                    <IonIcon icon={barbell} />
                    <h3>{loading ? 'Loading Equipment...' : 'No Equipment Found'}</h3>
                    <p>{loading ? 'Please wait' : 'Add your first equipment to get started'}</p>
                    <IonButton expand="block" onClick={() => setShowModal(true)}>
                      <IonIcon icon={add} slot="start" />
                      Add Equipment
                    </IonButton>
                  </div>
                </IonCol>
              ) : (
                filteredEquipments.map((equipment) => (
                  <IonCol key={equipment.id} size="12" sizeMd="6" sizeLg="4">
                    <IonCard className="equipment-card">
                      <IonCardContent>
                        <div className="equipment-header">
                          <h3>{equipment.equipName}</h3>
                          <span className={`status-badge ${getStatusColor(equipment.status)}`}>
                            {equipment.status}
                          </span>
                        </div>
                        <div className="equipment-details">
                          <p><strong>Category:</strong> {equipment.category}</p>
                          <p><strong>Purchase:</strong> {equipment.purchaseDate}</p>
                          {equipment.lastMaintenance && (
                            <p><strong>Last Maintenance:</strong> {equipment.lastMaintenance}</p>
                          )}
                          {equipment.nextSchedule && (
                            <p><strong>Next Schedule:</strong> {equipment.nextSchedule}</p>
                          )}
                          {equipment.notes && <p><strong>Notes:</strong> {equipment.notes}</p>}
                        </div>

                        <IonGrid>
                          <IonRow>
                            <IonCol size="12" sizeMd="6">
                              <IonButton expand="block" size="small" onClick={() => handleEdit(equipment)}>
                                <IonIcon icon={create} slot="start" />
                                Edit
                              </IonButton>
                            </IonCol>
                            <IonCol size="12" sizeMd="6">
                              <IonButton
                                expand="block"
                                size="small"
                                color="danger"
                                onClick={() => handleDelete(equipment.id)}
                              >
                                <IonIcon icon={trash} slot="start" />
                                Delete
                              </IonButton>
                            </IonCol>
                          </IonRow>
                        </IonGrid>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                ))
              )}
            </IonRow>
          </IonGrid>
        </div>

        {/* Add/Edit Modal */}
        <IonModal isOpen={showModal} onDidDismiss={resetForm} className="equipment-modal">
          <IonHeader>
            <IonToolbar>
              <IonTitle>{editingEquipment ? 'Edit Equipment' : 'Add Equipment'}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={resetForm}>
                  <IonIcon icon={close} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="equipment-modal-content">
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Equipment Name *</IonLabel>
                <IonInput
                  value={formData.equipName}
                  onIonInput={(e) => setFormData({ ...formData, equipName: e.detail.value || "" })}
                  placeholder="Enter equipment name"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Category</IonLabel>
                <IonSelect
                  value={formData.category}
                  onIonChange={(e) => setFormData({ ...formData, category: e.detail.value || "cardio" })}
                >
                  <IonSelectOption value="cardio">Cardio</IonSelectOption>
                  <IonSelectOption value="strength">Strength</IonSelectOption>
                  <IonSelectOption value="flexibility">Flexibility</IonSelectOption>
                  <IonSelectOption value="other">Other</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Purchase Date *</IonLabel>
                <IonInput
                  type="date"
                  value={formData.purchaseDate}
                  onIonChange={(e) => setFormData({ ...formData, purchaseDate: e.detail.value || "" })}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Status</IonLabel>
                <IonSelect
                  value={formData.status}
                  onIonChange={(e) => setFormData({ ...formData, status: e.detail.value || "operational" })}
                >
                  <IonSelectOption value="operational">Operational</IonSelectOption>
                  <IonSelectOption value="maintenance">Under Maintenance</IonSelectOption>
                  <IonSelectOption value="broken">Broken</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Last Maintenance (Optional)</IonLabel>
                <IonInput
                  type="date"
                  value={formData.lastMaintenance}
                  onIonChange={(e) => setFormData({ ...formData, lastMaintenance: e.detail.value || "" })}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Next Schedule (Optional)</IonLabel>
                <IonInput
                  type="date"
                  value={formData.nextSchedule}
                  onIonChange={(e) => setFormData({ ...formData, nextSchedule: e.detail.value || "" })}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Notes (Optional)</IonLabel>
                <IonTextarea
                  value={formData.notes}
                  onIonInput={(e) => setFormData({ ...formData, notes: e.detail.value || "" })}
                  placeholder="Additional notes..."
                  rows={4}
                />
              </IonItem>
            </IonList>
          </IonContent>

          <IonFooter>
            <div className="equipment-modal-actions">
              <IonButton expand="block" onClick={handleSave} className="save-btn">
                <IonIcon icon={checkmark} slot="start" />
                {editingEquipment ? 'Update Equipment' : 'Add Equipment'}
              </IonButton>

              <IonButton expand="block" fill="outline" onClick={resetForm}>
                Cancel
              </IonButton>
            </div>
          </IonFooter>
        </IonModal>

        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Delete Equipment"
          message="Are you sure you want to delete this equipment?"
          buttons={[
            { text: "Cancel", role: "cancel" },
            { text: "Delete", handler: confirmDelete },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default EquipmentManagement;