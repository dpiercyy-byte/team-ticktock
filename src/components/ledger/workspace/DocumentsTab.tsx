import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Link2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { isAcceptableUpload, prepareUpload, withRetry } from "@/lib/image-compress";
import { getAdminToken } from "@/lib/session";
import {
  addProjectDocumentLink,
  deleteProjectDocument,
  uploadProjectDocument,
} from "@/lib/workspace.functions";
import { Empty, SectionTitle, fmtDate } from "./ui";

const KINDS = [
  { value: "estimate", label: "Joist estimate" },
  { value: "agreement", label: "Signed agreement" },
  { value: "drawings", label: "Drawings" },
  { value: "photo", label: "Site photo" },
  { value: "change_order", label: "Change order" },
  { value: "selections", label: "Selections" },
  { value: "inspection", label: "Inspection record" },
  { value: "warranty", label: "Warranty document" },
  { value: "other", label: "Other" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

export type WorkspaceDocument = {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  createdAt: string;
};

export function DocumentsTab({
  projectId,
  documents,
}: {
  projectId: string;
  documents: WorkspaceDocument[];
}) {
  const qc = useQueryClient();
  const addLink = useServerFn(addProjectDocumentLink);
  const upload = useServerFn(uploadProjectDocument);
  const remove = useServerFn(deleteProjectDocument);
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<Kind>("estimate");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ledger", "workspace", projectId] });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return addLink({ data: { token, projectId, kind, title: title.trim(), url: url.trim() } });
    },
    onSuccess: async () => {
      setTitle("");
      setUrl("");
      await invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Could not add link"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return remove({ data: { token, id } });
    },
    onSuccess: invalidate,
  });

  const handleFile = async (file: File) => {
    if (!isAcceptableUpload(file)) {
      toast.error("Only images or PDF allowed");
      return;
    }
    const token = getAdminToken();
    if (!token) return;
    setBusy(true);
    try {
      const prepped = await prepareUpload(file);
      await withRetry(() =>
        upload({
          data: {
            token,
            projectId,
            kind,
            title: title.trim() || prepped.filename,
            mime: prepped.mime as any,
            base64: prepped.base64,
          },
        }),
      );
      setTitle("");
      await invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <section className="l-card grid gap-3 p-4">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link (Joist, Drive…)"
            className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
          />
          <button
            type="button"
            disabled={!url.trim() || !title.trim() || linkMutation.isPending}
            onClick={() => linkMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 text-[12px] font-bold disabled:opacity-50"
            style={{ background: "var(--l-ink)", color: "var(--l-on-ink)" }}
          >
            <Link2 className="h-4 w-4" /> Add
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full text-[13px] font-bold disabled:opacity-50"
          style={{ background: "var(--l-accent)", color: "var(--l-on-ink)" }}
        >
          <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload file"}
        </button>
      </section>

      <div className="mt-4">
        <SectionTitle hint={`${documents.length} item${documents.length === 1 ? "" : "s"}`}>
          Documents
        </SectionTitle>
        {documents.length === 0 ? (
          <Empty>No documents attached yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {documents.map((d) => (
              <li key={d.id} className="l-card flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{d.title}</p>
                  <p className="text-[12px] l-muted">
                    {KINDS.find((k) => k.value === d.kind)?.label ?? d.kind} · {fmtDate(d.createdAt)}
                  </p>
                </div>
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[12px] font-semibold l-accent"
                  >
                    Open
                  </a>
                )}
                <button
                  type="button"
                  aria-label="Delete document"
                  onClick={() => deleteMutation.mutate(d.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 l-red"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
