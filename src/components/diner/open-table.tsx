"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DishPicker, type PickerValues } from "@/components/dish-picker";
import { InviteQr } from "@/components/invite-qr";
import { ItemCard } from "@/components/item-card";
import { MenuList } from "@/components/menu-list";
import {
  addItems,
  requestItemChange,
  requestService,
  resolveRequest,
  updateItem,
  updateParticipant,
  type SessionContext,
} from "@/lib/diner-api";
import { clearSavedSession } from "@/lib/diner-session";
import type { ChangeRequest, DishWithOptions, OrderItem, Payment, PaymentItem, ServiceRequest } from "@/lib/db";
import type { PaymentMethod } from "@/lib/payments";
import { BillTab } from "./bill-tab";
import { RateNote, usePricing } from "@/lib/pricing";
import {
  canDinerEdit,
  describeChange,
  groupBy,
  isOwnItem,
  latestRequestFor,
  parseOptions,
} from "@/lib/order-items";
import type { PricingSettings } from "@/lib/rates";
import { SERVICE_LABEL, type ServiceKind } from "@/lib/tags";

type Props = {
  data: {
    userId: string;
    ctx: SessionContext;
    dishes: DishWithOptions[];
    items: OrderItem[];
    requests: ServiceRequest[];
    changeRequests: ChangeRequest[];
    joinCode: string | null;
    pricing: PricingSettings;
    payments: Payment[];
    paymentItems: PaymentItem[];
    paymentMethods: PaymentMethod[];
    paymentInstructions: string | null;
  };
  reload: () => Promise<void>;
};

type Tab = "menu" | "mine" | "table" | "bill";

/**
 * Lo que se está personalizando: un plato nuevo, uno ya pedido que se edita, o un
 * cambio que se le pide al mesero (`asRequest`) porque cocina ya empezó ese plato.
 */
type Picking = { dish: DishWithOptions; editing?: OrderItem; asRequest?: boolean };

/**
 * La mesa del comensal ya abierta: menú para pedir, su pedido (editable mientras
 * la cocina no empiece) y lo que pide toda la mesa, todo sincronizado en vivo.
 */
export function OpenTable({ data, reload }: Props) {
  const { formatTotal } = usePricing();
  const { userId, ctx, dishes, items, requests, changeRequests, joinCode, payments, paymentItems, paymentMethods, paymentInstructions } = data;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("menu");
  const [picking, setPicking] = useState<Picking | null>(null);
  const [inviting, setInviting] = useState(false);

  const seatId = ctx.participant?.seatId ?? null;
  const canOrder = ctx.restaurant.orderingMode !== "staff";
  const editCtx = { userId, seatId, orderingMode: ctx.restaurant.orderingMode, policy: ctx.restaurant.changePolicy };
  const myItems = items.filter((i) => isOwnItem(i, userId, seatId));
  const needsSeat = ctx.restaurant.identification === "seat" && !seatId;

  async function confirmPicker(values: PickerValues) {
    if (!picking) return;
    const { dish, editing, asRequest } = picking;
    if (editing && asRequest) {
      await sendChangeRequest(editing, dish, values);
      setPicking(null);
      await reload();
      return;
    }
    if (editing) {
      // Si el plato ya no tiene opciones configurables, no se tocan las que tenía.
      await updateItem(editing.id, {
        quantity: values.quantity,
        note: values.note,
        ...(dish.dish_option_groups.length > 0 ? { optionIds: values.optionIds } : {}),
      });
    } else {
      await addItems(ctx.sessionId, [{ dishId: dish.id, ...values }]);
    }
    setPicking(null);
    await reload();
    if (!editing) setTab("mine");
  }

  /** Pide al mesero un cambio sobre un plato en preparación, con un resumen legible de lo que cambia. */
  async function sendChangeRequest(item: OrderItem, dish: DishWithOptions, values: PickerValues) {
    const names = (ids: string[]) =>
      dish.dish_option_groups.flatMap((g) => g.dish_options).filter((opt) => ids.includes(opt.id)).map((opt) => opt.name);
    const message =
      describeChange(
        { quantity: item.quantity, note: item.note, optionNames: parseOptions(item.options).map((opt) => opt.name) },
        { quantity: values.quantity, note: values.note, optionNames: names(values.optionIds) },
      ) || "Revisar este plato";
    await requestItemChange(
      item.id,
      {
        quantity: values.quantity,
        note: values.note,
        ...(dish.dish_option_groups.length > 0 ? { optionIds: values.optionIds } : {}),
      },
      message,
    );
  }

  async function removeItem() {
    if (!picking?.editing) return;
    if (picking.asRequest) {
      await requestItemChange(picking.editing.id, { quantity: 0 }, "Cancelar el plato");
    } else {
      await updateItem(picking.editing.id, { quantity: 0 });
    }
    setPicking(null);
    await reload();
  }

  function startEdit(item: OrderItem, asRequest = false) {
    // Si el plato salió del menú, se edita con una ficha mínima (cantidad y nota).
    const dish =
      dishes.find((d) => d.id === item.dish_id) ??
      ({
        id: item.dish_id ?? item.id,
        name: item.dish_name,
        emoji: "🍽️",
        description: "",
        price_cents: item.base_price_cents,
        dish_option_groups: [],
      } as unknown as DishWithOptions);
    setPicking({ dish, editing: item, asRequest });
  }

  function leaveTable() {
    clearSavedSession();
    router.replace("/app");
  }

  return (
    <div>
      <header className="rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold leading-tight">{ctx.restaurant.name}</h1>
            <p className="text-sm text-muted">
              {ctx.table.label}
              {ctx.participant?.seatLabel ? ` · ${ctx.participant.seatLabel}` : ""}
              {ctx.participant?.displayName ? ` · ${ctx.participant.displayName}` : ""}
              {ctx.table.reservedBy ? ` · ${ctx.table.reservedBy}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={leaveTable}
            className="text-sm text-muted underline hover:text-foreground"
          >
            Salir de la mesa
          </button>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setInviting(!inviting)}
            aria-expanded={inviting}
            className="text-sm font-medium text-tomato underline"
          >
            {inviting ? "Ocultar invitación" : "Invitar a mi mesa"}
          </button>
          {inviting && (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-line bg-background p-4 text-center">
              <p className="text-sm">Que tus acompañantes escaneen este QR con la cámara:</p>
              <InviteQr sessionId={ctx.sessionId} size={200} />
              {joinCode && (
                <p className="text-sm text-muted">
                  O que escriban el código{" "}
                  <span className="font-mono font-semibold tracking-widest text-foreground">{joinCode}</span> al elegir mesa.
                </p>
              )}
            </div>
          )}
        </div>
        <SeatEditor ctx={ctx} highlight={needsSeat} onSaved={reload} />
      </header>

      <ServiceBar sessionId={ctx.sessionId} requests={requests} onChanged={reload} />

      {!canOrder && (
        <p className="mt-3 rounded-xl bg-tomato/10 px-4 py-3 text-sm">
          En este restaurante tu mesero toma el pedido. Puedes ver el menú y lo que se va pidiendo.
        </p>
      )}
      <div className="mt-4 flex gap-2" role="tablist" aria-label="Secciones de la mesa">
        <TabButton active={tab === "menu"} onClick={() => setTab("menu")}>
          Menú
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          Mi pedido ({myItems.filter((i) => i.status !== "cancelled").length})
        </TabButton>
        <TabButton active={tab === "table"} onClick={() => setTab("table")}>
          Mesa
        </TabButton>
        <TabButton active={tab === "bill"} onClick={() => setTab("bill")}>
          Cuenta
        </TabButton>
      </div>

      <div className="mt-4" role="tabpanel">
        {tab === "menu" && (
          <MenuList
            dishes={dishes}
            onPick={canOrder ? (dish) => setPicking({ dish }) : undefined}
          />
        )}

        {tab === "mine" && (
          <ItemsSection
            items={myItems}
            emptyText={canOrder ? "Aún no has pedido nada. Elige algo del menú." : "Tu mesero tomará tu pedido."}
            renderItem={(item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={canDinerEdit(item, editCtx) ? () => startEdit(item) : undefined}
                request={latestRequestFor(changeRequests, item.id)}
                // Si cocina ya empezó el plato, el cambio se le pide al mesero.
                onRequestChange={
                  canOrder && item.status === "preparing" && !canDinerEdit(item, editCtx)
                    ? () => startEdit(item, true)
                    : undefined
                }
              />
            )}
            footer={
              <>
                <p className="text-sm text-muted">
                  Puedes cambiar un plato (por ejemplo, quitarle un ingrediente) hasta que cocina empiece
                  {ctx.restaurant.changePolicy === "until_ready" ? " a dejarlo listo" : " a prepararlo"}.
                  Después, avisa a tu mesero.
                </p>
                <p className="mt-2 text-lg font-bold">
                  Tu total <span className="text-tomato">{formatTotal(myItems) ?? "se cobra al pagar"}</span>
                </p>
              </>
            }
          />
        )}

        {tab === "bill" && (
          <BillTab
            sessionId={ctx.sessionId}
            userId={userId}
            seatId={seatId}
            items={items}
            payments={payments}
            paymentItems={paymentItems}
            methods={paymentMethods}
            instructions={paymentInstructions}
            onChanged={reload}
          />
        )}

        {tab === "table" && (
          <ItemsSection
            items={items}
            emptyText="Todavía no se ha pedido nada en esta mesa."
            groupKey={(i) => [i.for_name, i.seat_label].filter(Boolean).join(" · ") || "Mesa"}
            renderItem={(item) => <ItemCard key={item.id} item={item} showOwner />}
            footer={
              <p className="text-lg font-bold">
                Total de la mesa <span className="text-tomato">{formatTotal(items) ?? "se cobra al pagar"}</span>
              </p>
            }
          />
        )}
      </div>

      {picking && (
        <DishPicker
          key={picking.editing?.id ?? picking.dish.id}
          dish={picking.dish}
          initial={
            picking.editing
              ? {
                  quantity: picking.editing.quantity,
                  optionIds: selectedOptionIds(picking.dish, picking.editing),
                  note: picking.editing.note ?? "",
                }
              : undefined
          }
          confirmLabel={picking.asRequest ? "Pedir al mesero" : picking.editing ? "Guardar cambios" : "Agregar"}
          onConfirm={confirmPicker}
          onCancel={() => setPicking(null)}
          onRemove={picking.editing ? removeItem : undefined}
        />
      )}

      <RateNote className="mt-6 text-center" />
      <p className="mt-4 text-center text-xs text-muted">
        ¿Eres del restaurante?{" "}
        <Link href="/panel" className="underline">
          Entra al panel
        </Link>
      </p>
    </div>
  );
}

/** Ids de las opciones que ya tenía un plato, para precargarlas al editarlo. */
function selectedOptionIds(dish: DishWithOptions, item: OrderItem): string[] {
  const chosen = new Set(
    (Array.isArray(item.options) ? item.options : []).flatMap((o) =>
      typeof o === "object" && o !== null && !Array.isArray(o) && typeof o.name === "string"
        ? [`${o.group}\u0000${o.name}`]
        : [],
    ),
  );
  return dish.dish_option_groups
    .flatMap((g) => g.dish_options.map((o) => ({ id: o.id, key: `${g.name}\u0000${o.name}` })))
    .filter((o) => chosen.has(o.key))
    .map((o) => o.id);
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-10 flex-1 rounded-full text-sm font-semibold transition-colors ${
        active ? "bg-tomato text-white" : "border border-line bg-card hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

/** Lista de platos (opcionalmente agrupados por persona) con un pie de totales. */
function ItemsSection({
  items,
  emptyText,
  renderItem,
  footer,
  groupKey,
}: {
  items: OrderItem[];
  emptyText: string;
  renderItem: (item: OrderItem) => React.ReactNode;
  footer: React.ReactNode;
  groupKey?: (item: OrderItem) => string;
}) {
  const { formatTotal } = usePricing();
  if (items.length === 0) {
    return <p className="py-10 text-center text-muted">{emptyText}</p>;
  }
  const groups = groupKey ? groupBy(items, groupKey) : [["", items] as [string, OrderItem[]]];
  return (
    <div>
      {groups.map(([name, group]) => (
        <section key={name} className="mb-5" aria-label={name || "Mis platos"}>
          {name && (
            <h2 className="mb-2 flex items-center justify-between font-semibold">
              {name}
              <span className="text-sm font-normal text-muted">{formatTotal(group)}</span>
            </h2>
          )}
          <div className="flex flex-col gap-3">{group.map(renderItem)}</div>
        </section>
      ))}
      <div className="mt-4 rounded-2xl border border-line bg-card p-4">{footer}</div>
    </div>
  );
}

/**
 * Botones para avisar al personal sin esperar a que pase: llamar al mesero o pedir la
 * cuenta. Mientras el aviso está pendiente se muestra como enviado y se puede cancelar.
 */
function ServiceBar({
  sessionId,
  requests,
  onChanged,
}: {
  sessionId: string;
  requests: ServiceRequest[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<ServiceKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(kind: ServiceKind, pending: ServiceRequest | undefined) {
    setBusy(kind);
    setError(null);
    try {
      if (pending) await resolveRequest(pending.id);
      else await requestService(sessionId, kind);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el aviso.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(SERVICE_LABEL) as ServiceKind[]).map((kind) => {
          const pending = requests.find((r) => r.kind === kind);
          return (
            <button
              key={kind}
              type="button"
              disabled={busy !== null}
              onClick={() => void toggle(kind, pending)}
              aria-pressed={pending !== undefined}
              className={`h-11 rounded-full px-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                pending ? "bg-tomato/15 text-tomato" : "border border-line bg-card hover:bg-line"
              }`}
            >
              {pending ? `✓ Avisado · cancelar` : SERVICE_LABEL[kind]}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Permite al comensal indicar (opcional) su puesto y su nombre. */
function SeatEditor({
  ctx,
  highlight,
  onSaved,
}: {
  ctx: SessionContext;
  highlight: boolean;
  onSaved: () => Promise<void>;
}) {
  const [seatId, setSeatId] = useState(ctx.participant?.seatId ?? "");
  const [name, setName] = useState(ctx.participant?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateParticipant(ctx.sessionId, {
        seatId: seatId || undefined,
        displayName: name || undefined,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mt-3" open={highlight}>
      <summary className="cursor-pointer text-sm font-medium text-tomato">
        {highlight ? "Indica tu puesto para poder pedir" : "Mi puesto y mi nombre"}
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="sr-only" htmlFor="seat-select">
          Puesto
        </label>
        <select
          id="seat-select"
          value={seatId}
          onChange={(e) => setSeatId(e.target.value)}
          className="h-10 rounded-xl border border-line bg-background px-3"
        >
          <option value="">Sin indicar</option>
          {ctx.seats.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="name-input">
          Nombre
        </label>
        <input
          id="name-input"
          maxLength={60}
          placeholder="Tu nombre (opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-xl border border-line bg-background px-3"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="h-10 rounded-full bg-tomato px-5 text-sm font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </details>
  );
}
