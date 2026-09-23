import { useEffect, useState } from "react";
import { UserPlus, Search as SearchIcon, ShieldCheck, ShieldOff } from "lucide-react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { StatusBadge } from "../../components/ui/Badge";
import { ConfirmDialog, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { getOfficers, updateOfficerStatus, addOfficer } from "../../services/api";
import { DISTRICTS_BY_STATE } from "../../data/mockData";
import { formatDate } from "../../lib/format";
import type { OfficerAccount } from "../../types";
import { useToast } from "../../context/ToastContext";

export default function Officers() {
  const { showToast } = useToast();
  const [officers, setOfficers] = useState<OfficerAccount[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<OfficerAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", title: "District Monitoring Officer", state: "", jurisdiction: "" });

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
      o.jurisdiction.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || o.status === statusFilter;
    return matchesSearch && matchesStatus;
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
    if (!form.name.trim() || !form.email.trim() || !form.state) {
      showToast("Please fill in name, email, and state.", "error");
      return;
    }
    setSaving(true);
    const newOfficer = await addOfficer({
      name: form.name,
      email: form.email,
      title: form.title,
      jurisdiction: form.jurisdiction || form.state,
      state: form.state,
    });
    setSaving(false);
    setAddOpen(false);
    setForm({ name: "", email: "", title: "District Monitoring Officer", state: "", jurisdiction: "" });
    setOfficers((prev) => (prev ? [newOfficer, ...prev] : [newOfficer]));
    showToast(`Officer account created for ${newOfficer.name}.`, "success");
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Officers</h2>
        <Button icon={<UserPlus size={15} />} onClick={() => setAddOpen(true)}>
          Add Officer
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search officer name, email, jurisdiction..."
              icon={<SearchIcon size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            placeholder="All Status"
            options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 font-medium">Officer</th>
                <th className="py-3 px-3 font-medium">Email</th>
                <th className="py-3 px-3 font-medium">Jurisdiction</th>
                <th className="py-3 px-3 font-medium">Projects</th>
                <th className="py-3 px-3 font-medium">Alerts Handled</th>
                <th className="py-3 px-3 font-medium">Last Login</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!filtered &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={8} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {filtered?.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-800">{o.name}</p>
                    <p className="text-xs text-gray-400">{o.title}</p>
                  </td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{o.email}</td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{o.jurisdiction}</td>
                  <td className="py-3 px-3 text-gray-700">{o.projectsAssigned}</td>
                  <td className="py-3 px-3 text-gray-700">{o.alertsHandled}</td>
                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                    {o.lastLogin === "Never" ? "Never" : formatDate(o.lastLogin)}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={o.status === "Active" ? "Resolved" : "Delayed"} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setConfirmTarget(o)}
                      className="text-xs font-medium text-navy-700 hover:underline flex items-center gap-1 ml-auto"
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
          <EmptyState title="No officers found" description="Try a different search term or filter." />
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Officer">
        <div className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. V. Nair" />
          <Input label="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="officer@mplads.ai" />
          <Select
            label="Title"
            options={["District Monitoring Officer", "State Nodal Officer"].map((t) => ({ value: t, label: t }))}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Select
            label="State"
            placeholder="Select state"
            options={Object.keys(DISTRICTS_BY_STATE).map((s) => ({ value: s, label: s }))}
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
          />
          <Input
            label="Jurisdiction"
            value={form.jurisdiction}
            onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
            placeholder="e.g. Pune, Maharashtra"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddOfficer} loading={saving}>Create Account</Button>
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
            ? `${confirmTarget?.name} will lose access to the Officer Portal until reactivated.`
            : `${confirmTarget?.name} will regain access to the Officer Portal.`
        }
        confirmLabel={confirmTarget?.status === "Active" ? "Deactivate" : "Activate"}
        danger={confirmTarget?.status === "Active"}
        loading={saving}
      />
    </div>
  );
}
