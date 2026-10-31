import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Envoltorio Android de Appetito. La app instalada abre la web publicada dentro de un
 * WebView, así que cada despliegue en Vercel llega a todos los móviles sin que nadie
 * tenga que reinstalar. `capacitor-www` solo contiene una pantalla de respaldo sin conexión.
 */
const config: CapacitorConfig = {
  appId: "app.appetito.mobile",
  appName: "Appetito",
  webDir: "capacitor-www",
  server: {
    url: "https://getappetito.vercel.app/app",
    // Solo se puede navegar dentro de nuestro dominio; los enlaces externos se abren fuera.
    allowNavigation: ["getappetito.vercel.app", "*.supabase.co"],
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#16100d",
  },
};

export default config;
