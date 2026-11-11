import json
import os
import sys
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

import numpy as np
import pandas as pd

BUCKET_NAME = "K_Means_Cluster_Plots"
SUMMARY_FILE = Path("ml_summary.json")


# ---------- helpers ----------

def now_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def quality_label(score):
    if score >= 0.5:
        return "strong separation"
    if score >= 0.25:
        return "reasonable separation"
    return "weak separation (clusters overlap a lot)"


def fmt_duration(seconds):
    minutes, secs = divmod(int(seconds), 60)
    return f"{minutes}m {secs}s" if minutes else f"{secs}s"


def run_context():
    return {
        "run_id": os.getenv("GITHUB_RUN_ID", "Local test"),
        "run_number": os.getenv("GITHUB_RUN_NUMBER", ""),
        "repository": os.getenv("GITHUB_REPOSITORY", ""),
        "server_url": os.getenv("GITHUB_SERVER_URL", "https://github.com"),
        "actor": os.getenv("GITHUB_ACTOR", "local"),
        "branch": os.getenv("GITHUB_REF_NAME", "-"),
        "commit": os.getenv("GITHUB_SHA", "-")[:7],
        "trigger": os.getenv("GITHUB_EVENT_NAME", "manual"),
    }


def load_summary():
    if SUMMARY_FILE.exists():
        try:
            return json.loads(SUMMARY_FILE.read_text())
        except json.JSONDecodeError:
            return None
    return None


# ---------- Supabase reads ----------

def get_latest_run(supabase):
    query = supabase.table("ml_model_runs").select("*")
    try:
        res = query.order("created_at", desc=True).limit(1).execute()
    except Exception:
        res = query.limit(1).execute()   # fallback if there is no created_at column
    return res.data[0] if res.data else None


def get_assignments(supabase, run_id):
    rows, start, page = [], 0, 1000
    while True:
        res = (
            supabase.table("user_clusters")
            .select("username,cluster_id")
            .eq("model_run_id", run_id)
            .range(start, start + page - 1)
            .execute()
        )
        rows.extend(res.data)
        if len(res.data) < page:
            break
        start += page
    return pd.Series(
        {r["username"]: r["cluster_id"] for r in rows}, dtype="int64"
    )


def download_plot(supabase, plot_path):
    return supabase.storage.from_(BUCKET_NAME).download(plot_path)


# ---------- metrics ----------

def centroid_tables(run):
    cols = run["quiz_order"]
    scaled = np.array(run["centroids_scaled"])
    mean = np.array(run["scaler_mean"])
    scale = np.array(run["scaler_scale"])
    original = scaled * scale + mean
    idx = [f"Cluster {i}" for i in range(len(scaled))]
    return (
        pd.DataFrame(original, index=idx, columns=cols),
        pd.DataFrame(scaled, index=idx, columns=cols),
    )


def compute_cluster_metrics(run, assignments):
    """Recompute cluster-quality metrics from live data + stored scaler/centroids."""
    from sklearn.metrics import (
        silhouette_samples, davies_bouldin_score,
        calinski_harabasz_score, pairwise_distances,
    )
    from ml.fetch_data import fetch_scores
    from ml.preprocessing import preprocess_data

    features = preprocess_data(fetch_scores())[run["quiz_order"]]
    common = features.index.intersection(assignments.index)
    features = features.loc[common]
    labels = assignments.loc[common].values

    scaled = (features.values - np.array(run["scaler_mean"])) / np.array(run["scaler_scale"])
    centers = np.array(run["centroids_scaled"])
    k = len(centers)

    samples = silhouette_samples(scaled, labels)
    per_cluster = {}
    for c in range(k):
        mask = labels == c
        if not mask.any():
            continue
        d = np.linalg.norm(scaled[mask] - centers[c], axis=1)
        per_cluster[c] = {
            "size": int(mask.sum()),
            "avg_sil": float(samples[mask].mean()),
            "weak": int((samples[mask] < 0).sum()),
            "avg_dist": float(d.mean()),
            "max_dist": float(d.max()),
            "inertia": float((d ** 2).sum()),
        }

    cd = pairwise_distances(centers)
    iu = np.triu_indices(k, 1)
    closest = int(cd[iu].argmin())
    return {
        "davies_bouldin": float(davies_bouldin_score(scaled, labels)),
        "calinski_harabasz": float(calinski_harabasz_score(scaled, labels)),
        "inertia": float(sum(v["inertia"] for v in per_cluster.values())),
        "weak_total": int((samples < 0).sum()),
        "closest_pair": (int(iu[0][closest]), int(iu[1][closest])),
        "closest_dist": float(cd[iu][closest]),
        "farthest_dist": float(cd[iu].max()),
        "users_matched": int(len(common)),
        "per_cluster": per_cluster,
    }


# ---------- body sections ----------

def section_cluster(run, cm):
    lines = [
        "1) CLUSTER METRICS",
        "------------------",
        f"Best K: {run['best_k']}",
        f"Silhouette score: {run['silhouette_score']:.4f} "
        f"({quality_label(run['silhouette_score'])})  [higher is better, max 1]",
    ]
    if not cm:
        lines.append("(Detailed metrics could not be recomputed.)")
        return lines

    a, b = cm["closest_pair"]
    total = sum(v["size"] for v in cm["per_cluster"].values())
    lines += [
        f"Davies-Bouldin index: {cm['davies_bouldin']:.4f}  [lower is better]",
        f"Calinski-Harabasz index: {cm['calinski_harabasz']:.2f}  [higher is better]",
        f"Users with negative silhouette (likely misplaced): {cm['weak_total']}",
        f"Closest centroids: Cluster {a} and Cluster {b} (distance {cm['closest_dist']:.3f})",
        f"Farthest centroid distance: {cm['farthest_dist']:.3f}",
        "",
        "Per cluster:",
        f"{'Cluster':<9}{'Users':>7}{'Share':>8}{'AvgSil':>9}{'Weak':>6}{'AvgDist':>9}{'MaxDist':>9}",
    ]
    for c, v in sorted(cm["per_cluster"].items()):
        lines.append(
            f"{c:<9}{v['size']:>7}{v['size'] / total:>8.0%}{v['avg_sil']:>9.3f}"
            f"{v['weak']:>6}{v['avg_dist']:>9.3f}{v['max_dist']:>9.3f}"
        )
    lines.append("(Weak = negative silhouette. Dist = distance to own centroid, scaled space.)")
    return lines


def section_train(run, cm):
    lines = [
        "2) TRAIN METRICS",
        "----------------",
        f"Model run ID: {run['id']}",
        f"Run status in DB: {run.get('status')}",
        f"Created at: {run.get('created_at', 'n/a')}",
        f"Users trained on: {run['total_users']}",
        f"Quizzes (features): {len(run['quiz_order'])}",
        f"Best K chosen: {run['best_k']}",
        f"Silhouette score (stored): {run['silhouette_score']:.4f}",
    ]
    if cm:
        lines.append(f"Total inertia (recomputed): {cm['inertia']:.2f}")
    lines += [
        "",
        "Scaler (StandardScaler) per quiz:",
        f"{'Quiz':<40}{'Mean':>9}{'Std':>9}{'Median':>9}",
    ]
    for q, m, s, med in zip(
        run["quiz_order"], run["scaler_mean"], run["scaler_scale"], run["medians"]
    ):
        lines.append(f"{q[:40]:<40}{m:>9.3f}{s:>9.3f}{med:>9.3f}")
    return lines


def section_training_run(summary):
    if not summary:
        return ["", "(No ml_summary.json found, so per-K results and timings are unavailable.)"]

    p = summary.get("train_params", {})
    lines = [
        "",
        "Training run details:",
        f"  Settings: n_init={p.get('n_init')}, max_iter={p.get('max_iter')}, random_state={p.get('random_state')}",
        f"  Score records fetched: {summary.get('records_fetched')}",
        f"  Best model iterations: {summary.get('best_iterations')} "
        f"(converged: {'yes' if summary.get('converged') else 'NO, hit max_iter'})",
        f"  Total duration: {fmt_duration(summary.get('duration_seconds', 0))}",
        "  Stage timings: "
        + ", ".join(f"{k} {fmt_duration(v)}" for k, v in summary.get("timings", {}).items()),
        "",
        "  Results by K:",
        f"  {'K':<4}{'Silhouette':>11}{'Inertia':>10}{'Iter':>6}{'Sec':>7}",
    ]
    for k, r in sorted(summary.get("k_results", {}).items(), key=lambda x: int(x[0])):
        mark = "  <-- chosen" if int(k) == summary.get("best_k") else ""
        lines.append(
            f"  {k:<4}{r['silhouette']:>11.4f}{r['inertia']:>10.1f}"
            f"{r['iterations']:>6}{r['fit_seconds']:>7.2f}{mark}"
        )
    return lines


def section_centroids(run, top_n=3):
    original, scaled = centroid_tables(run)
    lines = [
        "4) CENTROID DETAILS",
        "-------------------",
        "Most distinctive quizzes per cluster: quiz | avg score | z-score.",
        "A high positive z means the cluster scores well above average there.",
        "",
    ]
    for name in original.index:
        z = scaled.loc[name].sort_values(ascending=False)
        lines.append(name)
        lines.append("  Strongest:")
        for q in z.index[:top_n]:
            lines.append(f"    {q[:40]:<40} avg {original.loc[name, q]:>7.2f}   z {z[q]:+.2f}")
        lines.append("  Weakest:")
        for q in z.index[::-1][:top_n]:
            lines.append(f"    {q[:40]:<40} avg {original.loc[name, q]:>7.2f}   z {z[q]:+.2f}")
        lines.append("")
    lines.append("Full tables attached: centroids.csv (original scores), centroids_scaled.csv (z-scores).")
    return lines


def section_failure(summary):
    if not summary:
        return [
            "",
            "No ml_summary.json was produced. The job likely failed before",
            "train.py started (install step, import error, or missing env vars).",
        ]
    return [
        "",
        f"Failed during: {summary.get('stage')}",
        f"Error: {summary.get('error')}",
        f"Duration before failure: {fmt_duration(summary.get('duration_seconds', 0))}",
        "",
        "Traceback (last part):",
        summary.get("traceback", "(none)"),
    ]


def build_started_body(ctx, run_url):
    return f"""Your MatchKARO ML model training has started.

Run: #{ctx['run_number']}
Repository: {ctx['repository']}
Triggered by: {ctx['trigger']} ({ctx['actor']})
Branch / commit: {ctx['branch']} / {ctx['commit']}
Started at: {now_utc()}

Track progress:
{run_url}
"""


# ---------- main ----------

def send_email(event):
    username = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_APP_PASSWORD")
    recipient = os.getenv("MAIL_TO")

    if not all([username, password, recipient]):
        raise ValueError("Email credentials are missing!")

    ctx = run_context()
    run_url = (
        f"{ctx['server_url']}/{ctx['repository']}/actions/runs/{ctx['run_id']}"
        if ctx["repository"] else "Not available for local test"
    )

    attachments = []   # (bytes, maintype, subtype, filename)

    if event == "started":
        subject = f"MatchKARO: Training Started #{ctx['run_number']}"
        body = build_started_body(ctx, run_url)
    else:
        outcome = os.getenv("TRAINING_OUTCOME", "unknown").upper()
        subject = f"MatchKARO: Training {outcome} #{ctx['run_number']}"
        summary = load_summary()

        lines = [
            "Your MatchKARO ML model training has finished.",
            "",
            f"Status: {outcome}",
            f"Run: #{ctx['run_number']}",
            f"Repository: {ctx['repository']}",
            f"Triggered by: {ctx['trigger']} ({ctx['actor']})",
            f"Branch / commit: {ctx['branch']} / {ctx['commit']}",
            f"Finished at: {now_utc()}",
        ]

        if outcome == "SUCCESS":
            try:
                from ml.fetch_data import supabase
                run = get_latest_run(supabase)
                if not run:
                    raise RuntimeError("No model run found in ml_model_runs")

                cm = None
                try:
                    cm = compute_cluster_metrics(run, get_assignments(supabase, run["id"]))
                except Exception as e:
                    lines.append(f"(Could not recompute detailed metrics: {e})")

                lines += [
                    "", *section_cluster(run, cm),
                    "", *section_train(run, cm),
                    *section_training_run(summary),
                ]

                lines += ["", "3) CLUSTER IMAGE", "----------------"]
                try:
                    attachments.append(
                        (download_plot(supabase, run["plot_path"]), "image", "png", "cluster_plot.png")
                    )
                    lines.append(f"Attached: cluster_plot.png (stored at {run['plot_path']})")
                except Exception as e:
                    lines.append(f"Plot could not be downloaded: {e}")

                lines += ["", *section_centroids(run)]
                original, scaled = centroid_tables(run)
                attachments.append((original.round(4).to_csv().encode(), "text", "csv", "centroids.csv"))
                attachments.append((scaled.round(4).to_csv().encode(), "text", "csv", "centroids_scaled.csv"))

            except Exception as e:
                lines += ["", f"Could not load run details from Supabase: {e}"]
                lines += section_training_run(summary)
        else:
            lines += section_failure(summary)

        lines += ["", "View workflow details:", run_url]
        body = "\n".join(lines)

    message = EmailMessage()
    message["From"] = username
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)          # must come before add_attachment

    for data, maintype, subtype, filename in attachments:
        message.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
        server.login(username, password)
        server.send_message(message)

    print(f"Email sent: {subject}")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("started", "ended"):
        raise SystemExit("Usage: python -m ml.send_email started|ended")

    send_email(sys.argv[1])

    