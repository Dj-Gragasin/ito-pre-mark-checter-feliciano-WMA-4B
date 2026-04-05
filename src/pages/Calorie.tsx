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

type GoalKey =
  | "maintain_weight"
  | "mild_weight_loss"
  | "weight_loss"
  | "extreme_weight_loss"
  | "mild_weight_gain"
  | "weight_gain";

type GoalComputation = {
  key: GoalKey;
  label: string;
  targetIntake: number;
};

const roundKcal = (value: number) => Math.round(value);

/**
 * WHO/FAO/UNU (adult predictive equations), adopted in FNRI-DOST/PDRI practice.
 * Note: these adult equations are weight-based and do not include height.
 */
const computeFnriBmr = (gender: "male" | "female", age: number, weightKg: number): number => {
  if (gender === "male") {
    if (age <= 30) return 15.3 * weightKg + 679; // 18-30
    if (age <= 60) return 11.6 * weightKg + 879; // 30-60
    return 13.5 * weightKg + 487; // >60
  }

  if (age <= 30) return 14.7 * weightKg + 496; // 18-30
  if (age <= 60) return 8.7 * weightKg + 829; // 30-60
  return 10.5 * weightKg + 596; // >60
};

const clampFnriFloor = (gender: "male" | "female", intake: number): number => {
  const floor = gender === "male" ? 1500 : 1200;
  return Math.max(intake, floor);
};

const Calorie: React.FC = () => {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState<number | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [activity, setActivity] = useState(1.4);
  const [result, setResult] = useState<React.ReactNode | null>(null);

  const calculateCalories = () => {
    if (!age || !weight) {
      setResult(<p style={{ color: "red" }}>⚠️ Please fill all fields correctly.</p>);
      return;
    }

    if (Number(age) < 18) {
      setResult(
        <p style={{ color: "red" }}>
          ⚠️ FNRI-aligned WHO/FAO/UNU equations here are adult equations (18+). Please enter age 18 or above.
        </p>
      );
      return;
    }

    const ageValue = Number(age);
    const weightKg = Number(weight);

    // WHO/FAO/UNU BMR (FNRI-DOST aligned): adult predictive equations are based on body weight and age band.
    // Height is intentionally not part of this method, even if captured by the UI.
    const bmr = computeFnriBmr(gender, ageValue, weightKg);

    // Physical Activity Level (PAL) multipliers aligned with FNRI interpretation:
    // sedentary=1.40, low_active=1.55, active=1.75, very_active=2.00.
    const maintenanceRaw = bmr * Number(activity);
    const maintenanceCalories = roundKcal(maintenanceRaw);

    const goalAdjustments: Array<{ key: GoalKey; label: string; delta: number }> = [
      { key: "maintain_weight", label: "Maintain weight", delta: 0 },
      { key: "mild_weight_loss", label: "Mild weight loss", delta: -250 },
      { key: "weight_loss", label: "Weight loss", delta: -500 },
      { key: "extreme_weight_loss", label: "Extreme weight loss", delta: -750 },
      { key: "mild_weight_gain", label: "Mild weight gain", delta: 250 },
      { key: "weight_gain", label: "Weight gain", delta: 500 },
    ];

    const computedGoals: GoalComputation[] = goalAdjustments.map((goal) => {
      // FNRI safety floors: male >=1500 kcal, female >=1200 kcal.
      const unclampedIntake = maintenanceCalories + goal.delta;
      const targetIntake = roundKcal(clampFnriFloor(gender, unclampedIntake));

      return {
        key: goal.key,
        label: goal.label,
        targetIntake,
      };
    });

    // Exposed values for downstream integration/auditing, matching requested shape.
    const maintainGoal = computedGoals.find((g) => g.key === "maintain_weight")!;
    const computedSummary = {
      bmr: roundKcal(bmr),
      maintenanceCalories,
      targetIntake: maintainGoal.targetIntake,
    };

    setResult(
      <div className="results">
        <div className="card">
          <strong>Basal Metabolic Rate (BMR)</strong>
          <span className="highlight">{computedSummary.bmr} Calories/day</span>
        </div>
        <div className="card">
          <strong>Maintenance calories</strong>
          <span className="highlight">{computedSummary.maintenanceCalories} Calories/day</span>
        </div>
        {computedGoals.map((goal) => (
          <div className="card" key={goal.key}>
            <strong>{goal.label}</strong>
            <span className="highlight">{goal.targetIntake} Calories/day</span>
          </div>
        ))}
        <div className="card">
          <strong>Method note</strong>
          <span>
            FNRI-aligned WHO/FAO/UNU adult equations use age, sex, weight, and PAL. Height is not required in this method.
          </span>
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
                    <IonCol size="12" sizeMd="6">
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
                    <IonCol size="12" sizeMd="6">
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
                  </IonRow>

                  <IonItem lines="full">
                    <IonLabel position="stacked">Activity Level</IonLabel>
                    <IonSelect value={activity} onIonChange={(e) => setActivity(Number(e.detail.value))}>
                      <IonSelectOption value={1.4}>Sedentary (PAL 1.40)</IonSelectOption>
                      <IonSelectOption value={1.55}>Low Active (PAL 1.55)</IonSelectOption>
                      <IonSelectOption value={1.75}>Active (PAL 1.75)</IonSelectOption>
                      <IonSelectOption value={2.0}>Very Active (PAL 2.00)</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  <div className="pal-help">
                    <small>
                      PAL = Physical Activity Level. Choose the value that best matches your typical daily
                      activity: Sedentary (mostly sitting), Low Active (light activity), Active (regular
                      exercise), or Very Active (heavy activity/manual work).
                    </small>
                  </div>

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