import React, { useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonMenuButton,
} from "@ionic/react";
import "./Calorie.css";

const Calorie: React.FC = () => {
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
        <div className="card">
          <strong>Maintain weight</strong>
          <span className="highlight">{maintain} Calories/day</span>
        </div>
        <div className="card">
          <strong>Mild weight loss</strong>
          <span className="highlight">{mildLoss} Calories/day</span>
        </div>
        <div className="card">
          <strong>Weight loss</strong>
          <span className="highlight">{loss} Calories/day</span>
        </div>
        <div className="card">
          <strong>Extreme weight loss</strong>
          <span className="highlight">{extremeLoss} Calories/day</span>
        </div>
        <div className="card">
          <strong>Mild weight gain</strong>
          <span className="highlight">{mildGain} Calories/day</span>
        </div>
        <div className="card">
          <strong>Weight gain</strong>
          <span className="highlight">{gain} Calories/day</span>
        </div>
      </div>
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Calorie Calculator</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid fixed>
          <IonRow className="ion-justify-content-center">
            <IonCol size="12" sizeMd="8" sizeLg="6">
              <IonCard className="container">
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
                      <IonSelectOption value={1.2}>Sedentary (little or no exercise)</IonSelectOption>
                      <IonSelectOption value={1.375}>Light (exercise 1-3 times/week)</IonSelectOption>
                      <IonSelectOption value={1.55}>Moderate (exercise 4-5 times/week)</IonSelectOption>
                      <IonSelectOption value={1.725}>Active (daily exercise)</IonSelectOption>
                      <IonSelectOption value={1.9}>Very Active (intense exercise 6-7 times/week)</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  <IonButton expand="block" onClick={calculateCalories}>
                    Calculate
                  </IonButton>

                  {result}
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default Calorie;