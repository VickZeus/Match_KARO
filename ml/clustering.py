import time

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score


def train_kmeans(features):

    # Standardize the feature values
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(features)

    # Determine possible K values
    unique_profiles = len(set(map(tuple, scaled_data)))

    max_k = min(8, len(features) - 1, unique_profiles - 1)

    if max_k < 2:
        raise ValueError("Not enough distinct profiles for clustering.")

    best_model = None
    best_k = None
    best_score = -1
    k_results = {}

    # Test different cluster counts
    for k in range(2, max_k + 1):

        model = KMeans(
            n_clusters=k,
            random_state=42,
            n_init=20
        )

        started = time.time()
        labels = model.fit_predict(scaled_data)
        fit_seconds = time.time() - started

        # Ignore invalid clustering results
        if len(set(labels)) < 2:
            continue

        score = silhouette_score(scaled_data, labels)

        k_results[k] = {
            "silhouette": float(score),
            "inertia": float(model.inertia_),
            "iterations": int(model.n_iter_),
            "fit_seconds": round(fit_seconds, 2),
        }

        print(f"K = {k} | Silhouette Score = {score:.4f}")

        if score > best_score:
            best_score = score
            best_k = k
            best_model = model

    if best_model is None:
        raise ValueError("Unable to find a valid clustering model.")

    # Convert centroids to original score scale
    centroids = scaler.inverse_transform(
        best_model.cluster_centers_
    )

    print("\nBest K:", best_k)
    print("Best Silhouette Score:", round(best_score, 4))

    return {
        "model": best_model,
        "scaler": scaler,
        "labels": best_model.labels_,
        "best_k": best_k,
        "silhouette_score": best_score,
        "centroids": centroids,
        "k_results": k_results
    }