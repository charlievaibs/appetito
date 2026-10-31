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
  confirmation_mismatch: "Lo que escribiste no coincide con el nombre o el correo de la persona. No se hizo ningún cambio.",
  invalid_link: "Ese enlace o código no es válido, caducó o ya se usó. Pide uno nuevo.",
  invalid_member: "Esa persona no puede atender mesas.",
  unpaid_balance: "La mesa todavía tiene saldo por cobrar. Pásala por caja antes de cerrarla.",
  payments_pending: "Hay pagos esperando confirmación en esta mesa. Confírmalos o rechazalos antes de cerrar.",
  insufficient_cash: "El efectivo recibido no alcanza para cubrir el monto.",
  already_paid: "Eso ya está pagado o esperando confirmación.",
  method_not_accepted: "Este restaurante no acepta ese método de pago.",
  rate_required: "Para cobrar en bolívares hace falta la tasa del día.",
  invalid_invite: "Esa invitación caducó o ya no es válida. Pide a tu mesa que te muestre una nueva.",
  manual_join_disabled: "Este restaurante solo permite entrar con la etiqueta NFC o el QR de la mesa.",
  invalid_code: "Ese código no es correcto. Pídeselo a quien reservó o a tu mesero.",
  seat_taken: "Ese asiento ya está ocupado. Elige otro.",
  edit_directly: "Este plato aún no está en preparación: puedes cambiarlo tú mismo.",
  request_pending: "Ya pediste un cambio para este plato. Espera la respuesta del mesero.",
  invalid_kind: "Ese tipo de aviso no existe.",
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
  // Errores de cuenta de Supabase Auth (llegan en inglés).
  if (/invalid login credentials/i.test(message)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(message)) return "Confirma tu correo: te enviamos un enlace al registrarte.";
  if (/already registered|already been registered/i.test(message)) {
    return "Ese correo ya tiene cuenta. Prueba a iniciar sesión.";
  }
  if (/password should be at least|weak password/i.test(message)) {
    return "La contraseña es demasiado corta o débil (mínimo 8 caracteres).";
  }
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return "El acceso con Google todavía no está activado en este servidor.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Demasiados intentos. Espera un momento y vuelve a probar.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "No hay conexión. Revisa tu internet e inténtalo de nuevo.";
  }
  return message;
}
