export type OnboardingStepId = "source" | "inventory" | "antenna" | "master" | "slave" | "local-wifi" | "verify" | "enclosures";

export type OnboardingStep = {
  id: OnboardingStepId;
  blocking: boolean;
  eyebrow: string;
  title: string;
  instruction: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  imageAlt: string;
  facts: string[];
  action: string;
  command?: string;
  documentation?: string;
  documentationLabel?: string;
  resources?: { label: string; href: string }[];
};

export type OnboardingGuide = {
  title: string;
  promise: string;
  estimatedMinutes: number;
  steps: OnboardingStep[];
};

export function resourceOnboarding(): OnboardingGuide {
  return {
    title: "Configura el kit WOKI",
    promise: "Prepara el Maestro y un recurso para operar por LoRa, incluso sin internet.",
    estimatedMinutes: 30,
    steps: [
      {
        id: "source",
        blocking: true,
        eyebrow: "Preparación de la laptop",
        title: "Obtén el proyecto WOKI",
        instruction: "Descarga una copia del repositorio antes de conectar las placas.",
        image: "/onboarding/get-woki-project.png",
        imageWidth: 1672,
        imageHeight: 941,
        imageAlt: "Laptop descargando el proyecto WOKI junto a una placa, antena y cable todavía separados",
        facts: [
          "Usa git clone si ya tienes Git",
          "También puedes descargar y descomprimir el ZIP",
          "Conserva la carpeta completa en la laptop",
        ],
        action: "Ya tengo la carpeta WOKI",
        command: "git clone https://github.com/platanus-hack/platanus-hack-26-co-team-28.git\ncd platanus-hack-26-co-team-28",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28",
        documentationLabel: "Abrir repositorio",
      },
      {
        id: "inventory",
        blocking: false,
        eyebrow: "Antes de comenzar",
        title: "Reconoce el kit",
        instruction: "Confirma que tienes el kit antes de empezar.",
        image: "/onboarding/kit-overview.webp",
        imageWidth: 1672,
        imageHeight: 941,
        imageAlt: "Componentes del kit WOKI ordenados sobre una superficie clara",
        facts: [
          "TTGO LoRa32 T3 V1.6.1 · 915 MHz",
          "Antena 915 MHz y cable micro-USB de datos",
          "Celular del rescatista; no requiere instalar una app",
        ],
        action: "Tengo estas piezas",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/docs/HARDWARE.md",
        documentationLabel: "Revisar hardware compatible",
      },
      {
        id: "antenna",
        blocking: true,
        eyebrow: "Paso de seguridad",
        title: "Conecta primero la antena",
        instruction: "Enrosca la antena en el conector SMA antes de conectar energía o USB.",
        image: "/onboarding/antenna-first.webp",
        imageWidth: 1536,
        imageHeight: 1024,
        imageAlt: "Esquema de la antena conectándose antes que el cable USB",
        facts: [
          "No energices ni transmitas sin antena",
          "No fuerces el conector ni uses herramientas",
          "La antena debe ser para 915 MHz",
        ],
        action: "Antena conectada",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/docs/HARDWARE.md",
        documentationLabel: "Ver advertencias de radio",
      },
      {
        id: "master",
        blocking: true,
        eyebrow: "Laptop del Centro",
        title: "Prepara el LoRa Maestro",
        instruction: "Conecta el Maestro por USB y ejecuta el instalador desde la carpeta WOKI.",
        image: "/onboarding/command-center-wiring.webp",
        imageWidth: 1774,
        imageHeight: 887,
        imageAlt: "Conexión del LoRa Maestro por USB a la laptop del Centro de Comando",
        facts: [
          "Instala Arduino CLI, ESP32, librerías y Python",
          "Flashea el gateway y arranca el Centro real",
          "La sincronización online sigue siendo opcional",
        ],
        action: "Maestro y Centro listos",
        command: "bash lora-emergencia/scripts/instalar_maestro.sh",
        documentation:
          "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/docs/OPERAR-SINCRONIZACION.md",
        documentationLabel: "Abrir guía del Centro",
      },
      {
        id: "slave",
        blocking: true,
        eyebrow: "Nodo de campo",
        title: "Prepara el LoRa Esclavo",
        instruction: "En otra terminal, conecta la placa de recurso y ejecuta su instalador.",
        image: "/onboarding/antenna-first.webp",
        imageWidth: 1536,
        imageHeight: 1024,
        imageAlt: "Placa LoRa Esclavo con la antena instalada antes de conectar el cable USB",
        facts: [
          "Define un ID único, tipo y zona",
          "Flashea el firmware de recurso",
          "Crea la red local RECURSO_<ID>",
        ],
        action: "Esclavo listo",
        command: "bash lora-emergencia/scripts/instalar_esclavo.sh",
        documentation:
          "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/center/CENTRO.md",
        documentationLabel: "Abrir guía del recurso",
      },
      {
        id: "local-wifi",
        blocking: true,
        eyebrow: "Prueba con el celular",
        title: "Conéctate a la red local",
        instruction: "Desde el celular, abre Wi-Fi y elige RECURSO_GRUA07.",
        image: "/onboarding/connect-local-wifi.webp",
        imageWidth: 1693,
        imageHeight: 929,
        imageAlt: "Tres pasos para conectar un celular directamente a la red Wi-Fi del nodo",
        facts: [
          "RECURSO_GRUA07",
          "http://192.168.4.1",
          "Es normal que el celular indique “sin internet”.",
        ],
        action: "Veo el portal del recurso",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/docs/PORTAL-CAUTIVO-E2E.md",
        documentationLabel: "Ver prueba del portal local",
      },
      {
        id: "verify",
        blocking: true,
        eyebrow: "Prueba operacional",
        title: "Verifica el recorrido completo",
        instruction: "Envía una misión a GRUA07 y acéptala desde el celular.",
        image: "/onboarding/system-topology.webp",
        imageWidth: 1672,
        imageHeight: 941,
        imageAlt: "Topología WOKI con celulares, nodos LoRa, gateway, Centro y sincronización opcional",
        facts: [
          "La misión aparece en el celular",
          "Aceptar envía ACC por LoRa",
          "El Centro responde ACK; internet no participa",
        ],
        action: "La confirmación llegó al Centro",
        command: "bash lora-emergencia/scripts/probar_portal.sh",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/docs/PLAN-DEMO.md",
        documentationLabel: "Abrir checklist operacional",
      },
      {
        id: "enclosures",
        blocking: false,
        eyebrow: "Montaje opcional",
        title: "Protege el kit con piezas 3D",
        instruction: "Explora las piezas imprimibles para ordenar el Centro y proteger el nodo de campo.",
        image: "/onboarding/enclosures-assembled.jpg",
        imageWidth: 1672,
        imageHeight: 941,
        imageAlt: "Visualización referencial del Centro WOKI y un nodo de campo ensamblados con piezas impresas en 3D",
        facts: [
          "Centro: marco, pies y bandejas para electrónica y energía",
          "Nodo: bandeja impresa dentro de una caja comercial resistente",
          "Valida medidas y ajustes físicos antes del uso real",
        ],
        action: "Finalizar preparación",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28/tree/main/lora-emergencia/diseno-3d",
        documentationLabel: "Abrir documentación de impresión",
        resources: [
          { label: "Abrir visor 3D", href: "https://woki-lora-enclosures.vercel.app" },
        ],
      },
    ],
  };
}

export function getOnboardingStep(stepId: OnboardingStepId) {
  const step = resourceOnboarding().steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Paso de onboarding desconocido: ${stepId}`);
  return step;
}
