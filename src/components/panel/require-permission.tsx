"use client";

import type { ReactNode } from "react";
import { useCan } from "@/lib/panel-context";
import type { Permission } from "@/lib/roles";

/**
 * Muestra el contenido solo si el rol de la persona tiene el permiso. Es una ayuda
 * de interfaz: aunque alguien llegara a la pantalla, la base de datos rechazaría
 * igualmente cualquier acción no permitida.
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const allowed = useCan(permission);
  if (!allowed) {
    return (
      <p className="py-10 text-center text-muted">
        Tu rol no tiene acceso a esta sección. Si lo necesitas, pídeselo al dueño o al gerente.
      </p>
    );
  }
  return <>{children}</>;
}
