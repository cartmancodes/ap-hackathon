import { useState } from "react";
import { TopBar } from "./components/Layout";
import { useUI } from "./store";
import { useAppData } from "./data";
import { StateView } from "./views/StateView";
import { DistrictView } from "./views/DistrictView";
import { MandalView } from "./views/MandalView";
import { HeadmasterView } from "./views/HeadmasterView";
import { TeacherView } from "./views/TeacherView";
import { LeapIntegration } from "./views/LeapIntegration";
import { ModelAudit } from "./views/ModelAudit";
import { About } from "./views/About";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const { role } = useUI();
  const { data, error } = useAppData();

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar tab={tab} setTab={setTab} />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-5">
        {error && <div className="card p-6 text-red-700">Failed to load data: {String(error)}</div>}
        {!data && !error && (
          <div className="card p-8 text-slate-500 flex items-center justify-center">
            <div className="animate-pulse">Loading dataset…</div>
          </div>
        )}
        {data && tab === "dashboard" && <RoleSwitcher role={role} />}
        {data && tab === "leap" && <LeapIntegration />}
        {data && tab === "audit" && <ModelAudit />}
        {data && tab === "about" && <About />}
      </main>
      <footer className="bg-slate-100 border-t border-slate-200 text-xs text-slate-500 px-6 py-3 text-center">
        Stay-In School prototype · School Education Department, Government of Andhra Pradesh
      </footer>
    </div>
  );
}

function RoleSwitcher({ role }: { role: string }) {
  switch (role) {
    case "state": return <StateView />;
    case "district": return <DistrictAsRoleHome />;
    case "mandal": return <MandalAsRoleHome />;
    case "headmaster": return <HeadmasterView />;
    case "teacher": return <TeacherView />;
    default: return <StateView />;
  }
}

// District-officer home: pre-pick the highest-need district as their default scope
import { useEffect } from "react";
import { useAppData as useData2 } from "./data";

function DistrictAsRoleHome() {
  const { data } = useData2();
  const { selection, drillTo } = useUI();
  useEffect(() => {
    if (!data) return;
    if (!selection.district) {
      const d = [...data.districts].sort((a, b) => b.high_risk - a.high_risk)[0];
      if (d) drillTo({ district: d.district_name });
    }
  }, [data, selection.district, drillTo]);
  if (!selection.district) return null;
  return <DistrictView />;
}

function MandalAsRoleHome() {
  const { data } = useData2();
  const { selection, drillTo } = useUI();
  useEffect(() => {
    if (!data) return;
    if (!selection.mandal) {
      const m = [...data.mandals].sort((a, b) => b.high_risk - a.high_risk)[0];
      if (m) drillTo({ district: m.district_name, mandal: m.mandal_name });
    }
  }, [data, selection.mandal, drillTo]);
  if (!selection.mandal) return null;
  return <MandalView />;
}
