import { supabase } from "@/lib/supabase";

export async function assignCluster(username) {
  const { data: run } = await supabase
    .from("ml_model_runs")
    .select("id, quiz_order, medians, scaler_mean, scaler_scale, centroids_scaled")
    .eq("status", "success")
    .not("centroids_scaled", "is", null)
    .order("created_at", { ascending: false })   // check the column name in the table's Definition tab
    .limit(1)
    .maybeSingle();
  if (!run) return;

  const { data: rows } = await supabase
    .from("user_scores")
    .select("quizname, score, created_at")
    .eq("username", username)
    .order("created_at", { ascending: true });

  const latest = {};                               // latest attempt per quiz wins
  (rows || []).forEach(r => { latest[r.quizname] = Number(r.score); });
  if (!run.quiz_order.some(q => latest[q] !== undefined)) return;

  const x = run.quiz_order.map((q, i) => {
    const v = latest[q] ?? run.medians[i];         // median fill, as in preprocessing.py
    return (v - run.scaler_mean[i]) / run.scaler_scale[i];
  });

  let best = 0, bestDist = Infinity;
  run.centroids_scaled.forEach((c, k) => {
    const d = c.reduce((s, v, i) => s + (v - x[i]) ** 2, 0);
    if (d < bestDist) { bestDist = d; best = k; }
  });

  const { error } = await supabase.from("user_clusters").upsert(
    { username, cluster_id: best, model_run_id: run.id, updated_at: new Date().toISOString() },
    { onConflict: "username" }
  );
  if (error) throw error;
}