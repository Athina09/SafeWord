"""Train the tiny on-device behaviour-anomaly model and export it as .tflite for Person A (M2).

Input (4 floats, in this order): typing_cps, time_to_pay_s, hesitation_s, hour_delta
Output: one float in [0, 1] = behaviour anomaly score (sent to the bank as `signals.behaviour_anomaly`).

Needs TensorFlow, which is deliberately not in backend/requirements.txt (large):
    pip install tensorflow
    python data/export_tflite.py
Writes android/assets/behaviour_anomaly.tflite, which react-native-fast-tflite loads.
"""
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "android" / "assets" / "behaviour_anomaly.tflite"
COLS = ["typing_cps", "time_to_pay_s", "hesitation_s", "hour_delta"]


def main():
    try:
        import tensorflow as tf
    except ImportError:
        raise SystemExit("TensorFlow is not installed. Run: pip install tensorflow")

    df = pd.read_csv(HERE / "behaviour.csv")
    x = df[COLS].to_numpy(dtype="float32")
    mean, std = x.mean(0), x.std(0) + 1e-6
    # Normalisation is baked into the graph so the app feeds raw measurements.
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(4,)),
        tf.keras.layers.Normalization(mean=mean, variance=std**2),
        tf.keras.layers.Dense(8, activation="relu"),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    model.fit(x, df["label"].to_numpy(), epochs=15, batch_size=64, validation_split=0.2, verbose=2)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(tf.lite.TFLiteConverter.from_keras_model(model).convert())
    print("wrote", OUT, f"({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
