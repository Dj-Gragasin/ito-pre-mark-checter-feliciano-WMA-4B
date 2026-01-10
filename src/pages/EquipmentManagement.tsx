import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonBackButton,
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
} from "@ionic/react";
import { add, create, trash, barbell, alertCircle, close, checkmark } from "ionicons/icons";
import "./EquipmentManagement.css";

interface Equipment {
  id: string;
  equipName: string;
  category: string;
  purchaseDate: string;
  status: string;
  lastMaintenance: string;
  nextSchedule: string;
  notes: string;
}

const EquipmentManagement: React.FC = () => {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [filteredEquipments, setFilteredEquipments] = useState<Equipment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<string | null>(null);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadEquipments();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterEquipments();
  }, [searchText, equipments]);

  const loadEquipments = () => {
    const stored = localStorage.getItem("equipments");
    if (stored) {
      const data = JSON.parse(stored);
      setEquipments(data);
      setFilteredEquipments(data);
    }
  };

  const filterEquipments = () => {
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
  };

  const handleSave = () => {
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

    let updatedEquipments = [...equipments];

    if (editingEquipment) {
      // Editing existing equipment
      updatedEquipments = updatedEquipments.map((eq) =>
        eq.id === editingEquipment.id ? { ...formData, id: eq.id } : eq
      );
      console.log('✏️ Updated equipment:', editingEquipment.id);
      
      presentToast({
        message: '✅ Equipment updated successfully',
        duration: 2000,
        color: 'success'
      });
    } else {
      // Adding new equipment
      const newEquipment: Equipment = {
        ...formData,
        id: Date.now().toString(),
      };
      updatedEquipments.push(newEquipment);
      console.log('➕ Added new equipment:', newEquipment.id, newEquipment);
      
      presentToast({
        message: '✅ Equipment added successfully',
        duration: 2000,
        color: 'success'
      });
    }

    localStorage.setItem("equipments", JSON.stringify(updatedEquipments));
    setEquipments(updatedEquipments);
    resetForm();
    
    // Notify AdminDashboard to refresh
    window.dispatchEvent(new CustomEvent('equipment:updated'));
  };

  const handleEdit = (equipment: Equipment) => {
    console.log('✏️ Editing equipment:', equipment);
    setEditingEquipment(equipment);
    setFormData(equipment);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setEquipmentToDelete(id);
    setShowDeleteAlert(true);
  };

  const confirmDelete = () => {
    if (equipmentToDelete) {
      const updated = equipments.filter((eq) => eq.id !== equipmentToDelete);
      localStorage.setItem("equipments", JSON.stringify(updated));
      setEquipments(updated);
      setEquipmentToDelete(null);
      
      presentToast({
        message: '✅ Equipment deleted successfully',
        duration: 2000,
        color: 'success'
      });
      
      // Notify AdminDashboard to refresh
      window.dispatchEvent(new CustomEvent('equipment:updated'));
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
            <IonBackButton defaultHref="/admin" />
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
          <div className="search-section">
            <IonSearchbar
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value!)}
              placeholder="Search equipment..."
            />
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <IonIcon icon={barbell} />
              <h3>{equipments.length}</h3>
              <p>Total Equipment</p>
            </div>
            <div className="stat-card success">
              <IonIcon icon={checkmark} />
              <h3>{equipments.filter((e) => e.status === "operational").length}</h3>
              <p>Operational</p>
            </div>
            <div className="stat-card warning">
              <IonIcon icon={alertCircle} />
              <h3>{equipments.filter((e) => e.status === "maintenance").length}</h3>
              <p>In Maintenance</p>
            </div>
            <div className="stat-card danger">
              <IonIcon icon={alertCircle} />
              <h3>{equipments.filter((e) => e.status === "broken").length}</h3>
              <p>Broken</p>
            </div>
          </div>

          <div className="equipment-grid">
            {filteredEquipments.length === 0 ? (
              <div className="empty-state">
                <IonIcon icon={barbell} />
                <h3>No Equipment Found</h3>
                <p>Add your first equipment to get started</p>
                <IonButton onClick={() => setShowModal(true)}>
                  <IonIcon icon={add} slot="start" />
                  Add Equipment
                </IonButton>
              </div>
            ) : (
              filteredEquipments.map((equipment) => (
                <IonCard key={equipment.id} className="equipment-card">
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
                    <div className="equipment-actions">
                      <IonButton size="small" onClick={() => handleEdit(equipment)}>
                        <IonIcon icon={create} slot="start" />
                        Edit
                      </IonButton>
                      <IonButton
                        size="small"
                        color="danger"
                        onClick={() => handleDelete(equipment.id)}
                      >
                        <IonIcon icon={trash} slot="start" />
                        Delete
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        <IonModal isOpen={showModal} onDidDismiss={resetForm}>
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
          <IonContent className="ion-padding">
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Equipment Name *</IonLabel>
                <IonInput
                  value={formData.equipName}
                  onIonChange={(e) => setFormData({ ...formData, equipName: e.detail.value || "" })}
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
                  onIonChange={(e) => setFormData({ ...formData, notes: e.detail.value || "" })}
                  placeholder="Additional notes..."
                  rows={4}
                />
              </IonItem>
            </IonList>

            <IonButton
              expand="block"
              onClick={handleSave}
              className="save-btn"
              style={{ marginTop: '1.5rem' }}
            >
              <IonIcon icon={checkmark} slot="start" />
              {editingEquipment ? 'Update Equipment' : 'Add Equipment'}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              onClick={resetForm}
              style={{ marginTop: '0.5rem' }}
            >
              Cancel
            </IonButton>
          </IonContent>
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