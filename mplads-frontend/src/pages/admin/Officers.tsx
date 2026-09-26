import { useEffect, useState } from "react";
import { Search as SearchIcon, ShieldCheck, ShieldOff, Building2, UserPlus } from "lucide-react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { ConfirmDialog, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { getOfficers, updateOfficerStatus, addOfficer } from "../../services/api";
import { DISTRICTS_BY_STATE } from "../../data/geography";
import { formatDate } from "../../lib/format";
import type { OfficerAccount } from "../../types";
import { useToast } from "../../context/ToastContext";

export default function Officers() {
  const { showToast } = useToast();
  const [officers, setOfficers] = useState<OfficerAccount[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<OfficerAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    badgeId: "",
    name: "",
    email: "",
    password: "officer@SIH2026",
    role: "district_officer",
    title: "District Monitoring Officer",
    state: "",
    district: "",
    jurisdiction: "",
  });

  function load() {
    setOfficers(null);
    getOfficers().then(setOfficers);
  }

  useEffect(load, []);

  const filtered = officers?.filter((o) => {
    const matchesSearch =
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.email.toLowerCase().includes(search.toLowerCase()) ||
      o.jurisdiction.toLowerCase().includes(search.toLowerCase()) ||
      o.state.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || o.status === statusFilter;
    const matchesState = !stateFilter || o.state.toLowerCase() === stateFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesState;
  });

  async function toggleStatus(officer: OfficerAccount) {
    setSaving(true);
    const newStatus = officer.status === "Active" ? "Inactive" : "Active";
    const updated = await updateOfficerStatus(officer.id, newStatus);
    setSaving(false);
    setConfirmTarget(null);
    if (updated) {
      setOfficers((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? null);
      showToast(`${officer.name} marked as ${newStatus}.`, "success");
    }
  }

  async function handleAddOfficer() {
    if (!form.name.trim()) {
      showToast("Please provide the officer's full name.", "error");
      return;
    }
    if (!form.state) {
      showToast("Selecting an assigned state is strictly required.", "error");
      return;
    }

    const statePrefix = form.state.slice(0, 2).toUpperCase();
    const distClean = form.district && form.district !== "ALL" ? form.district : "MONITOR";
    const distPrefix = distClean.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
    const finalBadgeId = form.badgeId.trim().toUpperCase() || `OFFICER-${statePrefix}-${distPrefix}-${Math.floor(10 + Math.random() * 90)}`;
    const finalEmail = form.email.trim() || `${finalBadgeId.toLowerCase()}@mplads.gov.in`;

    setSaving(true);
    try {
      const newOfficer = await addOfficer({
        officerId: finalBadgeId,
        name: form.name.trim(),
        email: finalEmail,
        password: form.password.trim() || "officer@SIH2026",
        title: form.title,
        role: form.role,
        district: form.district || "ALL",
        jurisdiction: form.district && form.district !== "ALL" ? `${form.district}, ${form.state}` : `${form.state} (Statewide)`,
        state: form.state,
      });
      setOfficers((prev) => (prev ? [newOfficer, ...prev] : [newOfficer]));
      showToast(`Officer created successfully! Login ID: ${newOfficer.id}`, "success");
      setAddOpen(false);
      setForm({
        badgeId: "",
        name: "",
        email: "",
        password: "officer@SIH2026",
        role: "district_officer",
        title: "District Monitoring Officer",
        state: "",
        district: "",
        jurisdiction: "",
      });
    } catch (err: any) {
      showToast(err.message || "Failed to create officer account.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#0b2545] dark:text-amber-400" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              Officer Roster & State Assignment · अधिकारी प्रबंधन
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage authorized monitoring officers and their state-specific jurisdictional boundaries
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 bg-[#0b2545] hover:bg-[#133966] text-white font-semibold text-xs px-3.5 py-2 rounded shadow-sm transition-all"
        >
          <UserPlus size={15} />
          <span>+ Register Officer Account</span>
        </Button>
      </div>

      {/* Filter Strip */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search officer name, email, jurisdiction..."
              icon={<SearchIcon size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            placeholder="All States"
            options={["", ...Object.keys(DISTRICTS_BY_STATE).sort()].map((s) => ({
              value: s,
              label: s || "All States",
            }))}
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          />
          <Select
            placeholder="All Status"
            options={[
              { value: "", label: "All Status" },
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* Table */}
      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[850px]">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-navy-950 border-b border-gray-100 dark:border-navy-800">
                <th className="py-3 px-4 font-semibold">Officer Name & Role</th>
                <th className="py-3 px-3 font-semibold">Email</th>
                <th className="py-3 px-3 font-semibold">Assigned State</th>
                <th className="py-3 px-3 font-semibold">Jurisdiction Details</th>
                <th className="py-3 px-3 font-semibold">Assigned Projects</th>
                <th className="py-3 px-3 font-semibold">Last Login</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {!filtered &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-navy-800">
                    <td colSpan={8} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {filtered?.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{o.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{o.title}</p>
                  </td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300 font-mono text-[11px]">{o.email}</td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded font-semibold text-[11px] bg-navy-50 dark:bg-navy-800 text-navy-800 dark:text-amber-400 border border-navy-200 dark:border-navy-700">
                      {o.state}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300 max-w-[180px] truncate">{o.jurisdiction}</td>
                  <td className="py-3 px-3 text-gray-700 dark:text-gray-200 font-semibold">{o.projectsAssigned}</td>
                  <td className="py-3 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {o.lastLogin === "Never" ? "Never" : formatDate(o.lastLogin)}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>{o.status}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setConfirmTarget(o)}
                      className="text-xs font-semibold text-[#0b2545] dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                    >
                      {o.status === "Active" ? <ShieldOff size={12} /> : <ShieldCheck size={12} />}
                      {o.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered && filtered.length === 0 && (
          <EmptyState title="No officers found" description="Try adjusting your search criteria or state filter." />
        )}
      </Card>

      {/* Add Officer Modal (Dynamic State & District Selection) */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Register Monitoring Officer Account">
        <div className="space-y-4 text-xs">
          <p className="text-gray-500 dark:text-gray-400 -mt-2">
            Provision a new authorized monitoring officer. State and District assignments strictly enforce statutory data scoping upon officer login.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Officer Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. S. Radhakrishnan"
            />
            <Input
              label="Officer ID / Badge Code"
              value={form.badgeId}
              onChange={(e) => setForm((f) => ({ ...f, badgeId: e.target.value }))}
              placeholder="Auto-generated if blank (e.g. OFFICER-MH-PUNE-01)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Official MoSPI / State Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. officer@mplads.gov.in"
            />
            <Input
              label="Login Password *"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Default: officer@SIH2026"
            />
          </div>

          <Select
            label="Role / Designation *"
            options={[
              { value: "District Monitoring Officer", label: "District Monitoring Officer (District Scoped)" },
              { value: "State Nodal Officer", label: "State Nodal Officer (Statewide Scoped)" },
            ]}
            value={form.title}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                title: e.target.value,
                role: e.target.value.includes("State") ? "state_nodal" : "district_officer",
              }))
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* REQUIRED STATE SELECTION */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Assigned State * <span className="text-red-500 font-bold">(Mandatory)</span>
              </label>
              <select
                value={form.state}
                onChange={(e) => {
                  const newState = e.target.value;
                  const districts = DISTRICTS_BY_STATE[newState] || [];
                  const firstDist = districts[0] || "ALL";
                  setForm((f) => ({
                    ...f,
                    state: newState,
                    district: f.role === "state_nodal" ? "ALL" : firstDist,
                    jurisdiction: f.role === "state_nodal" ? `${newState} (Statewide)` : `${firstDist}, ${newState}`,
                    badgeId: f.badgeId || (newState ? `OFFICER-${newState.slice(0, 2).toUpperCase()}-${firstDist.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}-01` : ""),
                  }));
                }}
                className="w-full rounded border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 outline-none focus:border-[#0b2545] dark:focus:border-amber-400"
              >
                <option value="">-- Select Assigned State (Required) --</option>
                {Object.keys(DISTRICTS_BY_STATE)
                  .sort()
                  .map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            </div>

            {/* DYNAMIC DISTRICT SELECTION */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Assigned District * {form.role === "state_nodal" && <span className="text-gray-400 font-normal">(Statewide)</span>}
              </label>
              <select
                disabled={!form.state || form.role === "state_nodal"}
                value={form.district}
                onChange={(e) => {
                  const newDist = e.target.value;
                  setForm((f) => ({
                    ...f,
                    district: newDist,
                    jurisdiction: newDist === "ALL" ? `${f.state} (Statewide)` : `${newDist}, ${f.state}`,
                    badgeId: `OFFICER-${(f.state || "IN").slice(0, 2).toUpperCase()}-${newDist.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}-01`,
                  }));
                }}
                className="w-full rounded border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 outline-none focus:border-[#0b2545] dark:focus:border-amber-400 disabled:opacity-60"
              >
                {form.role === "state_nodal" ? (
                  <option value="ALL">ALL Districts (Statewide Jurisdiction)</option>
                ) : (
                  <>
                    <option value="">-- Select Assigned District --</option>
                    {(DISTRICTS_BY_STATE[form.state] || []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="ALL">ALL / Other (Statewide)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="p-2.5 rounded bg-blue-50 dark:bg-navy-800/60 border border-blue-100 dark:border-navy-700 text-blue-900 dark:text-blue-200">
            <span className="font-semibold">Security Note:</span> The officer will only see MPLADS projects, financial benchmarks, and anomaly alerts corresponding to their assigned <strong>{form.district && form.district !== "ALL" ? `${form.district}, ${form.state}` : (form.state ? `${form.state} (Statewide)` : "jurisdiction")}</strong>.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-navy-800">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddOfficer} loading={saving} className="bg-[#0b2545] hover:bg-[#133966] text-white">
              Create Officer Account
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && toggleStatus(confirmTarget)}
        title={confirmTarget?.status === "Active" ? "Deactivate this officer?" : "Activate this officer?"}
        description={
          confirmTarget?.status === "Active"
            ? `${confirmTarget?.name} will lose access to their assigned state portal (${confirmTarget?.state}) until reactivated.`
            : `${confirmTarget?.name} will regain access to their assigned state portal.`
        }
        confirmLabel={confirmTarget?.status === "Active" ? "Deactivate" : "Activate"}
        danger={confirmTarget?.status === "Active"}
        loading={saving}
      />
    </div>
  );
}
