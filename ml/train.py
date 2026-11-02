
from datetime import datetime, timezone
from io import BytesIO

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

from sklearn.decomposition import PCA

from ml.fetch_data import fetch_scores, supabase
from ml.preprocessing import preprocess_data
from ml.clustering import train_kmeans


BUCKET_NAME = "K_Means_Cluster_Plots"


def generate_cluster_plot(features, result):
    print("\nGenerating cluster visualization...")

    scaler = result["scaler"]
    labels = result["labels"]

    scaled_features = scaler.transform(features)

    pca = PCA(n_components=2)
    points_2d = pca.fit_transform(scaled_features)

    centroids_scaled = scaler.transform(result["centroids"])
    centroids_2d = pca.transform(centroids_scaled)

    plot_data = pd.DataFrame({
        "PC1": points_2d[:, 0],
        "PC2": points_2d[:, 1],
        "Cluster": [f"Cluster {label}" for label in labels]
    })

    sns.set_theme(
        style="darkgrid",
        context="notebook",
        palette="bright"
    )

    fig, ax = plt.subplots(figsize=(11, 8))

    # Black background
    fig.patch.set_facecolor("#000000")
    ax.set_facecolor("#000000")

    # Plot users
    sns.scatterplot(
        data=plot_data,
        x="PC1",
        y="PC2",
        hue="Cluster",
        palette="tab10",
        s=75,
        alpha=0.8,
        edgecolor="white",
        linewidth=0.5,
        ax=ax
    )

    # Plot centroids
    ax.scatter(
        centroids_2d[:, 0],
        centroids_2d[:, 1],
        marker="X",
        s=280,
        color="#FFD54F",
        edgecolor="white",
        linewidth=1.5,
        label="Centroids",
        zorder=5
    )

    # Title and labels
    ax.set_title(
        f"MatchKARO K-Means Clusters (K={result['best_k']})",
        fontsize=17,
        fontweight="bold",
        color="white",
        pad=18
    )

    ax.set_xlabel("Principal Component 1", color="white")
    ax.set_ylabel("Principal Component 2", color="white")

    # White tick labels
    ax.tick_params(colors="white")

    # Subtle grid
    ax.grid(color="#555555", alpha=0.35)

    # Legend styling
    legend = ax.legend(
        title="User Groups",
        frameon=True,
        loc="best",
        facecolor="#151515",
        edgecolor="white"
    )

    legend.get_title().set_color("white")

    for text in legend.get_texts():
        text.set_color("white")

    # Border styling
    for spine in ax.spines.values():
        spine.set_color("#888888")

    fig.tight_layout()

    buffer = BytesIO()

    fig.savefig(
        buffer,
        format="png",
        dpi=180,
        bbox_inches="tight",
        facecolor=fig.get_facecolor()
    )

    plt.close(fig)

    buffer.seek(0)

    return buffer.getvalue()


def upload_cluster_plot(image_data, run_id):
    file_path = f"{run_id}/cluster_plot.png"

    print("\nUploading cluster plot to Supabase...")

    supabase.storage.from_(BUCKET_NAME).upload(
        file_path,
        image_data,
        file_options={
            "content-type": "image/png",
            "upsert": "true"
        }
    )

    print("Plot uploaded successfully:", file_path)

    return file_path


def save_results(features, result):
    run_data = {
        "best_k": result["best_k"],
        "silhouette_score": float(result["silhouette_score"]),
        "total_users": len(features),
        "status": "running"
    }

    run_response = (
        supabase.table("ml_model_runs")
        .insert(run_data)
        .execute()
    )

    run_id = run_response.data[0]["id"]

    try:
        assignments = []

        for username, cluster_id in zip(
            features.index, result["labels"]
        ):
            assignments.append({
                "username": str(username),
                "cluster_id": int(cluster_id),
                "model_run_id": run_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })

        # Update cluster assignments in batches
        batch_size = 500

        for start in range(0, len(assignments), batch_size):
            batch = assignments[start:start + batch_size]

            supabase.table("user_clusters").upsert(
                batch,
                on_conflict="username"
            ).execute()

        # Generate and upload cluster visualization
        image_data = generate_cluster_plot(features, result)

        plot_path = upload_cluster_plot(image_data, run_id)

        # Mark model run successful
        supabase.table("ml_model_runs").update({
            "status": "success",
            "plot_path": plot_path
        }).eq("id", run_id).execute()

        print("\nResults saved successfully!")
        print("Model Run ID:", run_id)
        print("Users updated:", len(assignments))
        print("Plot path:", plot_path)

    except Exception:
        supabase.table("ml_model_runs").update({
            "status": "failed"
        }).eq("id", run_id).execute()

        raise


def main():
    try:
        print("Fetching data...")
        records = fetch_scores()

        print("\nPreprocessing data...")
        features = preprocess_data(records)

        print("\nTraining K-Means...")
        result = train_kmeans(features)

        print("\nSaving results to Supabase...")
        save_results(features, result)

        print("\nML pipeline completed successfully!")

    except Exception as error:
        print("\nPipeline failed:", error)
        raise


if __name__ == "__main__":
    main()
