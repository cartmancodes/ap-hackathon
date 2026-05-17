# Backend Pipeline — Cloud Cost Analysis

Cost analysis for running the **Stay-In School** preprocessing pipeline
([`web/scripts/preprocess.py`](web/scripts/preprocess.py), and the [`PENDING.md`](PENDING.md)
ML rebuild) as a **short-running batch job once per week** for **4–5 lakh students**,
using a serverless container/job runtime + object storage for cold data.

- Region basis: **Mumbai (`ap-south-1`) / Central India** (AP government context).
- FX: **₹83 / $1** (approx).
- All figures are **estimates** for planning, not quotes. Cloud list prices change.

---

## 1. Workload characterisation (the actual cost driver)

| Input | Size | Rows |
|---|---|---|
| `data_FIN_YEAR_2023-2024 (1).csv` (322 cols: daily attendance Y/N + FA/SA marks) | **248 MB** | ~408K |
| `data_FIN_YEAR_2024-2025 (1).csv` (label-only year) | 240 MB | ~396K |
| `School Location Master Data (1).csv` | 13 MB | 61K |
| `CHILDSNO_Dropped_2023_24 / 2024_25 .xlsx` ×2 | ~0.2 MB | small |

"4–5 lakh students" matches reality — the FY23 file is ~408K rows (the README's
"1.4M" line is stale).

**Pipeline shape:** stream the big CSV in 25K-row chunks → per-student
attendance/marks feature engineering → rules-based risk (rebuild adds sklearn
LogisticRegression + GradientBoosting) → aggregate to school/mandal/district →
write JSON (rebuild also writes parquet checkpoints).

**Measured output (current 25K-sample prototype):**

| File | Raw | Gzipped |
|---|---|---|
| students.json | 18.1 MB | **1.51 MB** |
| schools.json | 2.90 MB | 0.39 MB |
| mandals.json | 0.27 MB | 0.03 MB |
| districts / meta / state / audit | ~14 KB | ~4 KB |
| **Total per load** | **21.3 MB** | **~1.9 MB** |

At full 400–500K scale, `students.json` grows ~16–20× → a single-file load
would be **~25–30 MB gzipped**. Hence the rebuild's per-district lazy-load
(**~1–2 MB gz per user session**). This payload size is the key input to the
egress cost in §5.

**Per-run resource estimate (full 400–500K, weekly):**

- CPU time: **~3–8 min vectorised** / **~15–40 min as written** (current code uses
  `pandas.iterrows()` over ~250 date columns per student — the dominant runtime risk).
- Memory: **3–4 GB** (chunked read + sklearn). A full non-chunked load OOMs.
- Storage read in-region: ~250–500 MB. Storage write: ~17 MB (now) → ~50–300 MB (rebuild).

---

## 2. Compute cost — serverless options

`4.33` runs/month (weekly). pandas+numpy+pyarrow+scikit-learn exceeds Lambda's
250 MB zip limit ⇒ **container-image Lambda** if using Lambda at all.

### AWS Lambda (container image)

| Item | Calc | Monthly |
|---|---|---|
| Compute @ 4 GB, 600 s/run | 4 × 600 × 4.33 × $0.0000167 | **~$0.17** |
| Worst case @ 10 GB, 900 s | 10 × 900 × 4.33 × $0.0000167 | ~$0.65 |
| ECR image storage (~1.5 GB) | 1.5 × $0.10/GB-mo | ~$0.15 |
| **Subtotal** | | **~$0.3–0.8 / mo** |

**Hard constraint:** Lambda's **15-min wall**. The unvectorised code likely
exceeds it at 400–500K. Either vectorise (fits Lambda) or use a job runtime
(Container Apps / Fargate) with no time limit.

### Azure Container Apps Job (Consumption)

Free grant/month: **180,000 vCPU-s + 360,000 GiB-s**.

| Scenario | vCPU-s + GiB-s / mo | Monthly |
|---|---|---|
| 2 vCPU / 4 GiB, 40 min weekly | 20,784 + 41,568 | **$0 — inside free grant** |
| 4 vCPU / 8 GiB, 40 min weekly | 41,568 + 83,136 | **$0 — still inside grant** |

**Compute is effectively free** at this cadence, with no runtime wall and a
built-in cron trigger.

---

## 3. Azure Container Apps Job vs AWS Fargate

Both are job/container runtimes with no 15-min limit (the right fit for the
unvectorised code). Mumbai Fargate ≈ $0.0505/vCPU-hr + $0.0055/GB-hr; **no free tier**.

### Cost at this workload (2 vCPU / 4 GB)

| Scenario | AWS Fargate /run | Fargate /mo | Azure CA Job /mo |
|---|---|---|---|
| Vectorised, 8 min | ~$0.016 | **~$0.07** | **$0** (free grant) |
| As-is, 40 min | ~$0.082 | **~$0.36** | **$0** (free grant) |
| Fargate **Spot**, 40 min (~70% off) | ~$0.025 | **~$0.11** | n/a |

### Non-price comparison (this decides it)

| Dimension | Azure Container Apps Job | AWS Fargate |
|---|---|---|
| Compute cost here | **$0** (free grant) | $0.07–0.36/mo |
| Max duration | No hard wall | No hard wall |
| Scheduling | **Built-in cron trigger** | EventBridge Scheduler → ECS RunTask, or AWS Batch |
| Networking | Managed; no NAT/subnet wiring | Needs VPC + subnet; S3 via free Gateway Endpoint |
| Public IPv4 | Not applicable | **$0.005/hr** per public IP (~$0.014/mo at 40 min/wk — negligible) |
| **NAT Gateway footgun** | None | **~$32/mo if task placed in a private subnet** — avoid; use public subnet + S3 gateway endpoint |
| Scale-to-zero | Native | Native (task exits) |
| Image registry | ACR Basic ~$5/mo (or free tier) | ECR ~$0.10/GB-mo (~$0.15 for 1.5 GB) |
| Max resources | 4 vCPU / 8 GiB (Consumption) | 16 vCPU / 120 GB |
| Ops complexity | Lower (managed) | Higher (cluster, task def, IAM, VPC) |

**Verdict:** **Azure Container Apps Job wins** for a weekly 5-lakh batch — $0
compute inside the free grant, built-in cron, no VPC/NAT/IPv4 footgun. Choose
**Fargate** only if you outgrow 4 vCPU / 8 GiB (heavy parallel sklearn training)
or want Spot for large training jobs; it remains cheap ($0.07–0.36/mo) but adds
ECR + scheduler + networking ops.

---

## 4. Storage-only worst case (assume compute is free/provided)

Deliberately pessimistic: **hot tier only** (no lifecycle to cold),
**object versioning ON (×2 storage)**, raw inputs (~500 MB) re-uploaded and
retained **every week**, and the rebuild's heavy outputs (parquet + per-district
JSON ≈ ~300 MB/run) retained **every run**.

Accumulation: (500 MB raw + 300 MB output) × 52 wk ≈ **42 GB/yr**, ×2 versioning
≈ **~84 GB end of year 1**, **~250 GB by year 3**.

| Worst case | AWS S3 Standard (~$0.025/GB-mo) | Azure Blob Hot (~$0.021/GB-mo) |
|---|---|---|
| ~84 GB (yr 1, versioned, hot) | ~$2.10/mo (~₹175) | ~$1.76/mo (~₹146) |
| ~250 GB (yr 3, versioned, hot) | ~$6.25/mo (~₹520) | ~$5.25/mo (~₹436) |
| Same 250 GB, lifecycle → Deep Archive / Azure Archive (~$0.0018/GB) | **~$0.45/mo** | **~$0.45/mo** |
| Request / lifecycle-transition costs (handful of objects/run) | < $0.05/mo | < $0.05/mo |

**Even at full pessimism, byte storage ≤ ~$6/mo**, trivially cut to **<$0.50/mo**
with a 30-day lifecycle rule to cold tier + dropping versioning on raw inputs.
Cold-storage caveat: the job's **input** files must NOT sit in Glacier Deep
Archive (12-hr retrieval would stall the weekly run) — Deep Archive only for old
snapshots you won't re-read.

---

## 5. Egress (data transfer out) — the real worst case

Storage is cheap; **egress to end users is the only line item that grows large.**

### 5.1 Pipeline-internal egress = $0

Storage → compute **in the same region** is free on both AWS and Azure. Keep the
job and the bucket/container co-located. Cross-region or cross-cloud reads incur
egress — don't.

### 5.2 Serving the dashboard JSON to users (the cost driver)

The output JSON is **identical for all users** (precomputed weekly). Cost =
`users × loads/month × payload`. Payloads (measured / projected, gzipped):

- Current prototype, single load: **~1.9 MB**
- Full-scale single-file (no lazy-load): **~25–30 MB** ← avoid
- Full-scale **per-district lazy-load**: **~1–2 MB / session**

Egress pricing (internet, Mumbai / Central India):

- **AWS S3 direct:** first **100 GB/mo free** (global tier), then **~$0.109/GB**.
- **Azure Blob direct:** first **100 GB/mo free**, then **~$0.0875/GB**.
- **CloudFront (India edge):** ~$0.109–0.170/GB; S3→CloudFront origin pull is
  free, so CDN collapses *origin* egress to ~zero — but bytes delivered to users
  are still billed by the CDN. CDN's win is latency + origin protection, not
  fewer total bytes.

### 5.3 Egress scenarios (monthly, 2 MB gz lazy-load payload)

| Scenario | Users | Loads/user/mo | Egress/mo | AWS billable¹ | AWS $/mo | Azure $/mo |
|---|---|---|---|---|---|---|
| Hackathon demo | 20 | 20 | 0.8 GB | 0 GB | **$0** | **$0** |
| District pilot | 500 | 20 | 20 GB | 0 GB | **$0** | **$0** |
| State rollout (light) | 10,000 | 8 | 160 GB | 60 GB | **~$6.5** | **~$5.3** |
| State rollout (heavy) | 50,000 | 20 | **2,000 GB** | 1,900 GB | **~$207** | **~$166** |
| Heavy + no lazy-load (28 MB) | 50,000 | 20 | **28,000 GB** | 27,900 GB | **~$3,040** | **~$2,440** |

¹ After the 100 GB/mo free allowance.

**Takeaways:**

- Compute ≈ **$0**, storage ≤ **~$6/mo** — but egress at state scale can reach
  **hundreds of $/mo**, and **without lazy-load + gzip it is 10–15× worse**
  (last row). Egress is the only thing that can dominate the bill.
- gzip/brotli already give ~6–11:1 on this JSON (measured 21.3 MB → 1.9 MB) —
  **ensure compression is actually served** (Content-Encoding), it is the single
  biggest lever.
- **Per-district lazy-load** (in the rebuild plan) cuts per-session payload
  ~15× vs the single 25–30 MB file — keep it.
- **Client caching:** the JSON only changes once/week. Serve with a long
  `Cache-Control` + a weekly cache-busting version (e.g. `?v=2026W21`). Repeat
  visits in the same week then cost ~$0 egress.
- **CDN** (CloudFront / Azure Front Door): caches the identical static bundle at
  the edge → origin egress ≈ $0, better latency for AP users. Total user-delivered
  bytes are still billed, but at CDN rates with edge caching.
- **Cheapest escape hatch:** the frontend is a static Vite bundle + JSON. Hosting
  it on **Cloudflare Pages / GitHub Pages** (generous/unlimited free egress)
  removes the egress line item entirely — the cloud job only writes artefacts
  that a static host serves.

### 5.4 Egress mitigation playbook (for >60 GB billable)

The output is **100% static, identical for every user, and changes once/week** —
so the bytes are almost infinitely cacheable. Levers, highest leverage first:

| # | Lever | Effect | Effort |
|---|---|---|---|
| 1 | **Free-egress static host** (Cloudflare Pages / Cloudflare proxy) — app is static Vite + JSON | Egress → **$0 at any scale** | Low |
| 2 | **CDN always-free tier** (CloudFront 1 TB/mo free; cache-hit ≈ 99.99% so origin egress ≈ $0) | Light rollout → **$0**; heavy → ~$110–170 | Low |
| 3 | **Zero-egress object store** (Cloudflare R2 / Backblaze B2, S3-compatible) | Egress → **$0**; pay storage/ops only | Low–Med |
| 4 | **Scope payload to jurisdiction** + per-district lazy-load (teacher needs ~10 students, not 500K) | ~15× smaller/session | Med (in rebuild) |
| 5 | **Brotli + columnar encoding** (array-of-arrays / MessagePack vs array-of-objects) | ~2–3× smaller again | Med |
| 6 | **Weekly-immutable caching** (`max-age=604800, immutable` + versioned URLs + ETag/304) | Repeat visits/week → **0 bytes** | Low |

**Recomputed cost for the >60 GB scenarios:**

| Scenario | Direct S3 | + CloudFront (1 TB free) | + R2 / CF Pages |
|---|---|---|---|
| State rollout light (160 GB) | ~$6.5/mo | **$0** | **$0** |
| State rollout heavy (2 TB) | ~$207/mo | ~$110–170/mo | **~$0** (storage/ops only) |
| Heavy + scoped lazy-load + brotli (~0.8–1 TB) | ~$98/mo | **$0** | **~$0** |

**Recommended stack:** Cloudflare Pages (or Cloudflare + R2) for the static
bundle, brotli-compressed, scoped per-district lazy-load, weekly-immutable cache
headers → egress **effectively $0 even at state scale**. If AWS is mandated:
**CloudFront in front of S3** ($0 at light scale via the 1 TB free tier; ~$0 at
heavy scale once scoped lazy-load + brotli bring traffic under 1 TB).

---

## 6. Bottom line

| Component | Realistic monthly | Worst case |
|---|---|---|
| Compute — Azure Container Apps Job | **$0** (free grant) | $0 |
| Compute — AWS Fargate | $0.07–0.36 | ~$0.36 |
| Compute — AWS Lambda (if vectorised) | $0.30–0.80 | ~$0.80 |
| Storage (with lifecycle to cold) | **<$0.50** | ~$6 (hot, versioned, hoarded) |
| **Egress — demo / pilot** | **$0** (under 100 GB free) | $0 |
| **Egress — state rollout** | $5–207 | **~$2,400+** (no lazy-load / no gzip) |

**Recommendations**

1. **Run on Azure Container Apps Job** — $0 compute, no 15-min wall, built-in
   cron, no VPC/NAT footgun. (Fargate is the AWS equivalent at $0.07–0.36/mo if
   AWS is mandated; avoid private-subnet NAT.)
2. Cost is **not** the constraint for compute/storage — engineering constraints
   (Lambda's 15-min wall, packaging, chunked memory) are. Vectorise the
   `iterrows()` loop regardless.
3. **Egress is the only thing that scales with success.** Mandatory: serve
   gzip/brotli, keep per-district lazy-load, set weekly-versioned long-cache
   headers, and front it with a CDN — or host the static bundle on a free-egress
   static host. This turns a potential ~$2,400/mo into <$10/mo.
4. Storage: 30-day lifecycle to cold tier; never put **live input** files in
   Deep Archive (retrieval latency stalls the job).
