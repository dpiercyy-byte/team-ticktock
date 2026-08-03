import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { formatCurrency, relativeTime } from "@/components/ledger/ledger-ui";
import { NextActionLine } from "@/components/ledger/NextActionLine";
import { clientProfileQuery } from "@/lib/crm-client";
import type { PipelineCard } from "@/lib/crm.functions";

export const Route = createFileRoute("/ledger/people/$clientId")({
  head: () => ({
    meta: [
      { title: "Client — Ledger" },
      { name: "description", content: "Contact, properties, projects and activity in one place." },
      { property: "og:title", content: "Client — Ledger" },
      { property: "og:description", content: "One client, everything connected." },
    ],
  }),
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(clientProfileQuery(params.clientId));
  },
  component: ClientProfile,
});

const WON_LOST = ["Won", "Lost"];
const DONE_DELIVERY = ["Completed", "Warranty"];

function ClientProfile() {
  const { clientId } = Route.useParams();
  const { data } = useSuspenseQuery(clientProfileQuery(clientId));
  const { client, properties, projects, recentActivity } = data;

  const open = projects.filter((p) => !WON_LOST.includes(p.salesStage));
  const active = projects.filter(
    (p) => p.salesStage === "Won" && !DONE_DELIVERY.includes(p.deliveryStatus),
  );
  const completed = projects.filter((p) => DONE_DELIVERY.includes(p.deliveryStatus));

  return (
    <LedgerShell>
      <Link
        to="/ledger/people"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold l-muted"
      >
        <ArrowLeft className="h-4 w-4" /> All people
      </Link>

      <header className="mb-5">
        <h1 className="display text-[32px] leading-[1.05] md:text-[40px]">{client.name}</h1>
        {client.leadSource && (
          <p className="mt-1 text-[13px] l-muted">Lead source · {client.leadSource}</p>
        )}
      </header>

      <section className="l-card grid gap-2 p-4">
        {client.phone ? (
          <a
            href={`tel:${client.phone}`}
            className="inline-flex items-center gap-2 text-[14px] font-semibold"
          >
            <Phone className="h-4 w-4 l-muted" /> {client.phone}
          </a>
        ) : (
          <p className="text-[13px] l-muted">No phone on file</p>
        )}
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            className="inline-flex min-w-0 items-center gap-2 text-[14px]"
          >
            <Mail className="h-4 w-4 shrink-0 l-muted" />
            <span className="truncate">{client.email}</span>
          </a>
        )}
        {client.preferredContactMethod && (
          <p className="text-[12px] l-muted">Prefers {client.preferredContactMethod}</p>
        )}
        {client.notes && <p className="mt-1 text-[13px]">{client.notes}</p>}
      </section>

      <Section title="Properties">
        {properties.length === 0 ? (
          <Empty text="No properties on file." />
        ) : (
          <ul className="grid gap-2">
            {properties.map((p) => (
              <li key={p.id} className="l-card px-4 py-3">
                <p className="inline-flex max-w-full items-center gap-1.5 text-[14px] font-semibold">
                  <MapPin className="h-3.5 w-3.5 shrink-0 l-muted" />
                  <span className="truncate">
                    {p.unit ? `${p.unit} – ` : ""}
                    {p.address}
                  </span>
                </p>
                {p.notes && <p className="mt-0.5 text-[12px] l-muted">{p.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Open opportunities · ${open.length}`}>
        {open.length === 0 ? <Empty text="No open opportunities." /> : <Cards cards={open} />}
      </Section>

      <Section title={`Active jobs · ${active.length}`}>
        {active.length === 0 ? <Empty text="No active jobs." /> : <Cards cards={active} />}
      </Section>

      <Section title={`Completed · ${completed.length}`}>
        {completed.length === 0 ? <Empty text="Nothing completed yet." /> : <Cards cards={completed} />}
      </Section>

      <Section title="Recent activity">
        {recentActivity.length === 0 ? (
          <Empty text="No activity yet." />
        ) : (
          <ul className="grid gap-2">
            {recentActivity.map((e) => (
              <li
                key={e.id}
                className="l-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <p className="truncate text-[13px] font-semibold">{e.title}</p>
                <span className="shrink-0 text-[11px] tabular-nums l-muted">
                  {relativeTime(e.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </LedgerShell>
  );
}

function Cards({ cards }: { cards: PipelineCard[] }) {
  return (
    <ul className="grid gap-3">
      {cards.map((c) => (
        <li key={c.id}>
          <Link to="/ledger/jobs/$jobId" params={{ jobId: c.id }} className="l-card block p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <p className="truncate text-[15px] font-bold">{c.projectType}</p>
              {c.estimatedValue > 0 && (
                <span className="shrink-0 text-[14px] font-bold tabular-nums">
                  {formatCurrency(c.estimatedValue)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] l-muted">
              {c.salesStage} · {c.deliveryStatus}
            </p>
            <p className="mt-0.5 truncate text-[12px] l-muted">{c.address}</p>
            <NextActionLine card={c} className="mt-2" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="l-eyebrow mb-3 truncate px-1">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="l-card px-4 py-8 text-center text-[13px] l-muted">{text}</div>;
}
