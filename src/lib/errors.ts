/**
 * Traduce los errores técnicos de la base de datos (códigos como `not_editable`)
 * a mensajes claros en español para mostrar a la persona.
 */

const MESSAGES: Record<string, string> = {
  invalid_tag: "Esta etiqueta o código QR no es válido, o la mesa está desactivada.",
  invalid_seat: "Ese puesto no pertenece a esta mesa.",
  seat_required: "Este restaurante pide indicar tu puesto para pedir.",
  invalid_session: "La mesa ya está cerrada.",
  session_closed: "La mesa ya está cerrada.",
  diner_ordering_disabled: "En este restaurante los pedidos los toma tu mesero.",
  not_editable: "Este plato ya está en preparación y no se puede cambiar. Avisa a tu mesero.",
  invalid_option: "Una de las opciones elegidas ya no está disponible.",
  option_rules: "Revisa las opciones: falta una obligatoria o elegiste de más.",
  invalid_dish: "Uno de los platos ya no está disponible.",
  dish_unavailable: "Este plato ya no está disponible.",
  invalid_items: "Agrega al menos un plato.",
  too_many_items: "Hay demasiados platos en esta mesa. Habla con tu mesero.",
  forbidden: "No tienes permiso para hacer esto.",
  last_owner: "El restaurante debe conservar al menos un dueño.",
  already_member: "Esa persona ya forma parte del equipo.",
  invalid_email: "Escribe un correo válido.",
  auth_required: "Necesitas una sesión para continuar.",
};

/** Devuelve un mensaje en español para un error de Supabase o de la red. */
export function describeError(message: string): string {
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (message.includes(code)) return text;
  }
  if (/anonymous sign-ins are disabled/i.test(message)) {
    return "El acceso como invitado no está activado todavía. El administrador debe activarlo en Supabase.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "No hay conexión. Revisa tu internet e inténtalo de nuevo.";
  }
  return message;
}
