"""Stage 5 — generate counsellor artefacts per student.

Three artefacts per student (deterministic; LLM-ready):
  - parent SMS (≤160 chars, supportive, EN + TE)
  - counsellor conversation guide (5-8 talking points, EN + TE)
  - remediation plan (concrete weekly actions, owner, success metric)

Writes one combined file per district (lazy-loaded on the Counsellor view)
and a small index for the frontend.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "_cache"
OUT = Path(__file__).resolve().parents[1] / "app" / "public" / "data" / "counsellor"
OUT.mkdir(exist_ok=True, parents=True)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


# -------------------------- Parent SMS ----------------------------------------
def sms_en(name_first: str, drivers: list[dict]) -> str:
    # Supportive, non-stigmatising wording — uses first driver
    d = drivers[0]["key"] if drivers else "low_attendance"
    base = {
        "low_attendance": f"Hello, this is the school. {name_first} has been missed in class recently. We would value your support — please help us bring them back tomorrow.",
        "recent_decline": f"Hello, {name_first}'s attendance has slipped this month. We are here to help — can we speak this week?",
        "long_streak": f"Hello, {name_first} has been absent for several days. Is everything OK at home? Please reply or visit the school.",
        "patterned_absence": f"Hello, we notice {name_first} misses class on specific days. Can we understand and help?",
        "low_marks": f"Hello, {name_first}'s class teacher would like to set up extra reading support. Are you available this week?",
        "marks_decline": f"Hello, we want to help {name_first} stay on track. Can we discuss a short remedial plan?",
        "migration_risk": f"Hello, if your family is travelling, please let the school know — we can keep {name_first}'s enrolment safe.",
        "financial_stress": f"Hello, {name_first} is welcome at school regardless of fees. Mid-day meals are available daily.",
        "child_labour": f"Hello, please ensure {name_first} attends school — we are here to support the family.",
        "early_marriage": f"Hello, we would like to meet you regarding {name_first}'s schooling — please visit the school this week.",
        "behaviour": f"Hello, the school would like to discuss {name_first}'s recent behaviour — we want to help.",
        "transport": f"Hello, if transport is an issue, please tell the school — we can arrange support for {name_first}.",
        "parent_engagement": f"Hello, your involvement matters. Please come for the next parent meeting — {name_first} will benefit.",
    }
    msg = base.get(d, base["low_attendance"])
    if len(msg) > 160:
        msg = msg[:157].rsplit(" ", 1)[0] + "…"
    return msg


def sms_te(name_first: str, drivers: list[dict]) -> str:
    d = drivers[0]["key"] if drivers else "low_attendance"
    base = {
        "low_attendance": f"నమస్తే, ఇది పాఠశాల నుండి. {name_first} ఇటీవల తరగతిలో కనిపించలేదు. మీ సహకారం అవసరం — రేపు పంపండి.",
        "recent_decline": f"నమస్తే, {name_first} యొక్క హాజరు తగ్గింది. ఈ వారం మాట్లాడగలమా?",
        "long_streak": f"నమస్తే, {name_first} చాలా రోజులుగా రాలేదు. ఇంట్లో అంతా బాగానేనా? దయచేసి స్పందించండి.",
        "patterned_absence": f"నమస్తే, {name_first} నిర్దిష్ట రోజులలో గైరుహాజరవుతుంది. కారణం తెలుసుకోగలమా?",
        "low_marks": f"నమస్తే, {name_first}కు అదనపు సహాయం ఏర్పాటు చేయవచ్చు. ఈ వారం అందుబాటులో ఉన్నారా?",
        "marks_decline": f"నమస్తే, {name_first}కు చిన్న రెమెడియల్ ప్లాన్ గురించి చర్చించగలమా?",
        "migration_risk": f"నమస్తే, ప్రయాణం ఉంటే, పాఠశాలకు తెలియజేయండి — {name_first} నమోదు సురక్షితంగా ఉంటుంది.",
        "financial_stress": f"నమస్తే, ఫీజులతో సంబంధం లేకుండా {name_first} స్వాగతం. మధ్యాహ్న భోజనం ఉంది.",
        "child_labour": f"నమస్తే, దయచేసి {name_first} పాఠశాలకు హాజరుకావాలి — మేము సహాయపడతాం.",
        "early_marriage": f"నమస్తే, {name_first} పాఠశాల విషయంలో మిమ్మల్ని కలవాలనుకుంటున్నాం — ఈ వారం రండి.",
        "behaviour": f"నమస్తే, {name_first} ప్రవర్తన గురించి చర్చించాలి — మేము సహాయపడాలనుకుంటున్నాం.",
        "transport": f"నమస్తే, రవాణా సమస్య ఉంటే, పాఠశాలకు తెలియజేయండి — {name_first} కోసం ఏర్పాటు చేస్తాం.",
        "parent_engagement": f"నమస్తే, మీ భాగస్వామ్యం ముఖ్యం. తదుపరి PTM కి రండి — {name_first}కి ప్రయోజనం.",
    }
    return base.get(d, base["low_attendance"])


# -------------------------- Conversation guide --------------------------------
def conversation_guide(student: dict) -> dict:
    f = student["f"]; syn = student.get("syn") or {}
    drivers = [d["key"] for d in student.get("drv") or student.get("drivers") or []]
    points = []
    # opening / rapport
    points.append({"type": "opening", "en": "Greet warmly. Reassure the family this is supportive, not punitive.",
                   "te": "ఆహ్వానించండి. ఇది శిక్షణ కాదు, సహాయం అని హామీ ఇవ్వండి."})
    if (f.get("attendance_pct") or 100) < 65:
        points.append({"type": "data", "en": f"State the fact gently: 'Your child attended {f.get('attendance_pct', 0):.0f}% of school days this year.' Pause for response.",
                       "te": f"నిజాన్ని మృదువుగా చెప్పండి: 'మీ పిల్లవాడు ఈ సంవత్సరం {f.get('attendance_pct', 0):.0f}% రోజులు మాత్రమే హాజరయ్యారు.'"})
    if (f.get("attendance_delta_30d") or 0) < -10:
        points.append({"type": "data", "en": "Note recent change: 'In the last 30 days, attendance dropped further.' Ask: 'Has something changed at home?'",
                       "te": "ఇటీవలి మార్పును గమనించండి: 'గత 30 రోజుల్లో హాజరు మరింత తగ్గింది.' ఇంట్లో ఏదైనా మార్పు వచ్చిందా అని అడగండి."})
    if (f.get("longest_absence_streak") or 0) >= 7:
        points.append({"type": "data", "en": "Acknowledge the long absence streak — ask about illness, travel, or work obligations.",
                       "te": "దీర్ఘ గైరుహాజరును గుర్తించండి — అనారోగ్యం, ప్రయాణం లేదా పనుల గురించి అడగండి."})
    if syn.get("financial_stress"):
        points.append({"type": "support", "en": "Mention available welfare: scholarships, mid-day meal, uniform support. 'School is free; ask us if anything is a barrier.'",
                       "te": "అందుబాటులో ఉన్న సహాయం: స్కాలర్‌షిప్‌లు, మధ్యాహ్న భోజనం, యూనిఫారం. 'పాఠశాల ఉచితం' అని తెలియజేయండి."})
    if syn.get("child_labour_concern"):
        points.append({"type": "sensitive", "en": "[SENSITIVE] Probe gently for work obligations. Do not accuse. Mention the Right to Education Act protects the child's school time.",
                       "te": "[సున్నితం] పనుల గురించి మెల్లగా అడగండి. ఆరోపించవద్దు. విద్యా హక్కు చట్టం ప్రకారం పిల్లల పాఠశాల సమయం రక్షింపబడుతుంది."})
    if syn.get("early_marriage_concern"):
        points.append({"type": "escalation_required", "en": "[ESCALATION REQUIRED] If marriage plans are mentioned for a minor, inform the mandal officer the same day. Do not promise secrecy.",
                       "te": "[ఎస్కలేషన్ అవసరం] మైనర్ వివాహ ప్రణాళికలు చర్చకు వచ్చితే, అదే రోజు మండల అధికారికి తెలియజేయండి."})
    if syn.get("seasonal_migration_possibility"):
        points.append({"type": "support", "en": "If migration is planned, offer the seasonal-hostel option / transfer certificate handshake with destination school.",
                       "te": "వలస సంబంధం ఉంటే, సీజనల్ హాస్టల్ లేదా బదిలీ సర్టిఫికెట్ సహాయం అందించండి."})
    if syn.get("transport_difficulty"):
        points.append({"type": "support", "en": "Ask about distance and access. Mention transport allowance if eligible.",
                       "te": "దూరం మరియు అందుబాటు గురించి అడగండి. అర్హులైతే రవాణా అలవెన్స్ గురించి చెప్పండి."})
    if (f.get("overall_marks") or 999) < 120 or "low_marks" in drivers:
        points.append({"type": "academic", "en": "Discuss a 4-week reading / numeracy support plan; offer to assign a remedial slot before school.",
                       "te": "4 వారాల పఠన / గణిత మద్దతు ప్రణాళికను చర్చించండి; పాఠశాలకు ముందు రెమెడియల్ స్లాట్ ఇవ్వగలము."})
    # close
    points.append({"type": "close", "en": "End with a written joint plan and the next check-in date. Confirm parent's phone for follow-up SMS.",
                   "te": "ఉమ్మడి ప్రణాళిక మరియు తదుపరి సమావేశ తేదీతో ముగించండి. ఫాలో-అప్ SMS కోసం ఫోన్ నెంబర్ నిర్ధారించండి."})
    return {"points": points,
            "escalation_required": any(p["type"] == "escalation_required" for p in points),
            "sensitive_topics": [p for p in points if p["type"] in ("sensitive", "escalation_required")]}


# -------------------------- Remediation plan ----------------------------------
def remediation_plan(student: dict) -> list[dict]:
    f = student["f"]; syn = student.get("syn") or {}
    plan = []
    if (f.get("attendance_pct") or 100) < 65:
        plan.append({"week": "Week 1", "action": "Home visit + signed attendance compact", "owner": "Teacher", "success": "Student in class ≥4 days the following week"})
        plan.append({"week": "Week 2", "action": "Daily SMS check-in to parent", "owner": "Teacher", "success": "≥3 days attendance"})
    if (f.get("marks_trend") or 0) < -25 or (f.get("overall_marks") or 999) < 120:
        plan.append({"week": "Week 1-4", "action": "Pre-school remedial slot (30 min) thrice weekly", "owner": "Class teacher", "success": "Mock-test score improves ≥10 marks"})
    if syn.get("seasonal_migration_possibility"):
        plan.append({"week": "Week 1", "action": "Verify migration; arrange seasonal-hostel or destination-school handshake", "owner": "Mandal officer", "success": "Documented transfer / hostel placement"})
    if syn.get("child_labour_concern") or syn.get("early_marriage_concern"):
        plan.append({"week": "Week 1", "action": "Counselling session with parent + RTE awareness brief", "owner": "Headmaster", "success": "Family agreement on continued schooling"})
    if syn.get("financial_stress"):
        plan.append({"week": "Week 1", "action": "Confirm welfare entitlement (scholarship / uniform / textbook)", "owner": "Headmaster", "success": "Entitlement disbursed / confirmed in LEAP"})
    if syn.get("transport_difficulty"):
        plan.append({"week": "Week 1", "action": "Assess transport route; raise transport-allowance request", "owner": "Mandal officer", "success": "Allowance request filed in LEAP"})
    plan.append({"week": "Week 4", "action": "Outcome review — attendance/marks delta captured to closed-loop log", "owner": "Headmaster", "success": "Outcome captured; model retraining queue +1"})
    return plan


# -------------------------- Driver --------------------------------------------
def main():
    bundles_dir = Path(__file__).resolve().parents[1] / "app" / "public" / "data" / "bundles"
    out_index = []
    for bundle_file in sorted(bundles_dir.glob("*.json")):
        students = json.loads(bundle_file.read_text())
        artefacts = []
        for s in students:
            name = s.get("name") or f"Student {s['id']}"
            first = name.split()[0]
            artefacts.append({
                "id": s["id"],
                "anon_id": s.get("anon_id"),
                "name": name,
                "school_name": s.get("school_name"),
                "mandal": s.get("mandal"),
                "district": s.get("district"),
                "risk": s.get("risk"),
                "tier": s.get("tier"),
                "drivers": s.get("drv", []),
                "sms_en": sms_en(first, s.get("drv", [])),
                "sms_te": sms_te(first, s.get("drv", [])),
                "guide": conversation_guide(s),
                "plan": remediation_plan(s),
            })
        out = OUT / bundle_file.name
        out.write_text(json.dumps(artefacts, separators=(",", ":")))
        out_index.append({"file": f"counsellor/{out.name}", "count": len(artefacts),
                          "district": artefacts[0]["district"] if artefacts else None})
    (OUT / "index.json").write_text(json.dumps(out_index, indent=2))
    print(f"[stage 5] wrote counsellor artefacts for {len(out_index)} districts")


if __name__ == "__main__":
    main()
