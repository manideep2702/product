"use client";

import { useState } from "react";
import { useAlert } from "@/components/ui/alert-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import AdminGuard from "../_components/AdminGuard";

export default function AdminExportPage() {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const { show } = useAlert();
  const router = useRouter();

  const downloadAllData = async (format: "json" | "csv") => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ start, end }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({} as any));
        throw new Error(msg?.error || `Request failed (${res.status})`);
      }
      const allData = await res.json();

      if (format === "json") {
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `admin-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else if (format === "csv") {
        const sections = [
          { name: "Users", data: allData.users },
          { name: "Profiles", data: allData.profiles },
          { name: "Pooja Bookings", data: allData.pooja_bookings },
          { name: "Annadanam Bookings", data: allData.annadanam_bookings },
          { name: "Donations", data: allData.donations },
          { name: "Contact Messages", data: allData.contact_messages },
          { name: "Volunteer Bookings", data: allData.volunteer_bookings },
        ];
        let csvContent = `Admin Data Export - ${new Date().toISOString()}\n`;
        csvContent += `Date Range: ${start || "all"} to ${end || "all"}\n\n`;
        for (const section of sections) {
          csvContent += `\n${section.name}\n`;
          if (Array.isArray(section.data) && section.data.length > 0) {
            const headers = Object.keys(section.data[0]);
            csvContent += headers.join(",") + "\n";
            for (const row of section.data) {
              const values = headers.map((h) => {
                const v = (row as any)[h] ?? "";
                const s = typeof v === "object" ? JSON.stringify(v) : String(v);
                return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
              });
              csvContent += values.join(",") + "\n";
            }
          } else {
            csvContent += "No data\n";
          }
        }
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `admin-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      show({ title: "Export Complete", description: `Downloaded ${format.toUpperCase()} file successfully.`, variant: "success" });
    } catch (e: any) {
      show({ title: "Export Failed", description: e?.message || "Failed to export data", variant: "destructive" });
    }
  };

  return (
    <AdminGuard>
      <main className="min-h-screen p-6 md:p-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold text-center">Export Data</h1>
          <div className="mt-2 flex justify-between">
            <button onClick={() => router.push("/admin")} className="rounded border px-3 py-1.5">Back</button>
          </div>

          <div className="rounded-xl border p-6 space-y-4 bg-card/70 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm" htmlFor="start">Start date</label>
                <input id="start" type="date" className="w-full rounded border px-3 py-2 bg-background" value={start} onChange={(e)=>setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm" htmlFor="end">End date</label>
                <input id="end" type="date" className="w-full rounded border px-3 py-2 bg-background" value={end} onChange={(e)=>setEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => downloadAllData("json")} className="rounded bg-black text-white px-4 py-2">Download JSON</button>
              <button onClick={() => downloadAllData("csv")} className="rounded border px-4 py-2">Download CSV</button>
            </div>
            <p className="text-xs text-muted-foreground">Exports all data (Annadanam, Pooja, Donations, Contact, Volunteers) within the date range.</p>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}


