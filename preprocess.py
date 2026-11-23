import json
from pathlib import Path
import numpy as np
import pandas as pd

SRC = Path(__file__).parent / "raw"
OUT = Path(__file__).parent / "data"
OUT.mkdir(exist_ok=True)

EDGES = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, np.inf]
LABELS = ["<1", "1-2", "2-5", "5-10", "10-20", "20-50", "50-100", "100-200", "200-500", "500+"]
MIN_GAME_REVIEWS = 150

df = pd.read_parquet(SRC / "recommendations_sample.parquet", columns=["app_id", "hours", "is_recommended", "helpful"])
titles = pd.read_csv(SRC / "game_titles.csv").set_index("app_id")["title"]
df["b"] = pd.cut(df.hours, EDGES, right=False, labels=False).astype(int)
df["rec"] = df.is_recommended.astype(int)

overall = df.groupby("b").agg(n=("rec", "size"), rec=("rec", "sum"), helpful_any=("helpful", lambda s: int((s > 0).sum())))
neg = df[df.rec == 0].groupby("b").agg(n_neg=("rec", "size"), h_neg=("helpful", lambda s: int((s > 0).sum())))
pos = df[df.rec == 1].groupby("b").agg(n_pos=("rec", "size"), h_pos=("helpful", lambda s: int((s > 0).sum())))
ov = overall.join(neg).join(pos).fillna(0).astype(int)

hist_edges = np.round(np.logspace(0, 3, 31), 3)
h = np.histogram(df.hours.clip(lower=1.0, upper=999.9), bins=hist_edges)[0]

counts = df.groupby("app_id").size()
keep = counts[counts >= MIN_GAME_REVIEWS].index
g = df[df.app_id.isin(keep)].groupby(["app_id", "b"]).agg(n=("rec", "size"), r=("rec", "sum")).reset_index()
games = []
for app, sub in g.groupby("app_id"):
    n = [0] * len(LABELS)
    r = [0] * len(LABELS)
    for _, row in sub.iterrows():
        n[int(row.b)] = int(row.n)
        r[int(row.b)] = int(row.r)
    games.append({"id": int(app), "t": str(titles.get(app, app)), "n": n, "r": r})
games.sort(key=lambda d: -sum(d["n"]))

out = {
    "meta": {
        "rows": int(len(df)),
        "games_total": int(df.app_id.nunique()),
        "overall_rate": float(df.rec.mean()),
        "median_hours": float(df.hours.median()),
        "min_game_reviews": MIN_GAME_REVIEWS,
        "games_kept": len(games),
    },
    "labels": LABELS,
    "edges": [e if np.isfinite(e) else None for e in EDGES],
    "overall": [{"label": LABELS[i], "n": int(ov.loc[i, "n"]), "rec": int(ov.loc[i, "rec"]),
                 "n_pos": int(ov.loc[i, "n_pos"]), "h_pos": int(ov.loc[i, "h_pos"]),
                 "n_neg": int(ov.loc[i, "n_neg"]), "h_neg": int(ov.loc[i, "h_neg"])} for i in range(len(LABELS))],
    "hist": {"edges": hist_edges.tolist(), "counts": h.tolist()},
    "games": games,
}
(OUT / "steam_agg.json").write_text(json.dumps(out, separators=(",", ":")))
print(out["meta"], (OUT / "steam_agg.json").stat().st_size)
