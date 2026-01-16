import React, { useState } from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonRow,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";
import "../Calorie.css";

const CalorieContent: React.FC = () => {
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState<number | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [activity, setActivity] = useState(1.2);
  const [result, setResult] = useState<React.ReactNode | null>(null);

  const calculateCalories = () => {
    if (!age || !weight || !height) {
      setResult(<p style={{ color: "red" }}>⚠️ Please fill all fields correctly.</p>);
      return;
    }

    let bmr =
      gender === "male"
        ? 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + 5
        : 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) - 161;

    const maintain = Math.round(bmr * Number(activity));
    const mildLoss = Math.round(maintain * 0.9);
    const loss = Math.round(maintain * 0.79);
    const extremeLoss = Math.round(maintain * 0.59);
    const mildGain = Math.round(maintain * 1.1);
    const gain = Math.round(maintain * 1.21);

    setResult(
      <div className="results">
        <div className="card"><strong>Maintain weight</strong><span className="highlight">{maintain} Calories/day</span></div>
        <div className="card"><strong>Mild weight loss</strong><span className="highlight">{mildLoss} Calories/day</span></div>
        <div className="card"><strong>Weight loss</strong><span className="highlight">{loss} Calories/day</span></div>
        <div className="card"><strong>Extreme weight loss</strong><span className="highlight">{extremeLoss} Calories/day</span></div>
        <div className="card"><strong>Mild weight gain</strong><span className="highlight">{mildGain} Calories/day</span></div>
        <div className="card"><strong>Weight gain</strong><span className="highlight">{gain} Calories/day</span></div>
      </div>
    );
  };

  return (
    <IonGrid fixed style={{ padding: 0 }}>
      <IonRow className="ion-justify-content-center">
        <IonCol size="12" sizeMd="10" sizeLg="8">
          <IonCard className="container" style={{ margin: 0, maxWidth: '100%' }}>
            <IonCardContent>
              <h2>Calorie Calculator</h2>

              <IonItem lines="full">
                <IonLabel position="stacked">Gender</IonLabel>
                <IonSelect value={gender} onIonChange={(e) => setGender(e.detail.value)}>
                  <IonSelectOption value="male">Male</IonSelectOption>
                  <IonSelectOption value="female">Female</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonRow>
                <IonCol size="12" sizeMd="4">
                  <IonItem lines="full">
                    <IonLabel position="stacked">Age (years)</IonLabel>
                    <IonInput
                      type="number"
                      inputMode="numeric"
                      value={age}
                      onIonInput={(e) => setAge(e.detail.value ? Number(e.detail.value) : "")}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="12" sizeMd="4">
                  <IonItem lines="full">
                    <IonLabel position="stacked">Weight (kg)</IonLabel>
                    <IonInput
                      type="number"
                      inputMode="decimal"
                      value={weight}
                      onIonInput={(e) => setWeight(e.detail.value ? Number(e.detail.value) : "")}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="12" sizeMd="4">
                  <IonItem lines="full">
                    <IonLabel position="stacked">Height (cm)</IonLabel>
                    <IonInput
                      type="number"
                      inputMode="decimal"
                      value={height}
                      onIonInput={(e) => setHeight(e.detail.value ? Number(e.detail.value) : "")}
                    />
                  </IonItem>
                </IonCol>
              </IonRow>

              <IonItem lines="full">
                <IonLabel position="stacked">Activity Level</IonLabel>
                <IonSelect value={activity} onIonChange={(e) => setActivity(Number(e.detail.value))}>
                  <IonSelectOption value={1.2}>Sedentary</IonSelectOption>
                  <IonSelectOption value={1.375}>Light</IonSelectOption>
                  <IonSelectOption value={1.55}>Moderate</IonSelectOption>
                  <IonSelectOption value={1.725}>Active</IonSelectOption>
                  <IonSelectOption value={1.9}>Very Active</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonButton expand="block" onClick={calculateCalories}>Calculate</IonButton>
              {result}
            </IonCardContent>
          </IonCard>
        </IonCol>
      </IonRow>
    </IonGrid>
  );
};

export default CalorieContent;