export type OnboardingStepId = "inventory" | "antenna" | "usb" | "configure" | "local-wifi" | "verify";

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
};

export type OnboardingGuide = {
  title: string;
  promise: string;
  estimatedMinutes: number;
  steps: OnboardingStep[];
};

export function resourceOnboarding(): OnboardingGuide {
  return {
    title: "Prepara un nodo de recurso",
    promise: "Déjalo listo para recibir y confirmar misiones por LoRa, sin depender de internet.",
    estimatedMinutes: 15,
    steps: [
      {
        id: "inventory",
        blocking: false,
        eyebrow: "Antes de comenzar",
        title: "Reconoce el kit",
        instruction: "Mantén esta guía abierta en el computador. Usaremos el celular del rescatista para probar la red local del nodo.",
        image: "/onboarding/kit-overview.webp",
        imageWidth: 1672,
        imageHeight: 941,
        imageAlt: "Componentes del kit WOKI ordenados sobre una superficie clara",
        facts: [
          "Placa TTGO LoRa32 T3 V1.6.1 de 915 MHz",
          "Antena 915 MHz y cable micro-USB de datos",
          "Celular del rescatista; no requiere una aplicación instalada",
          "La pantalla externa del Centro es opcional",
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
        instruction: "Enrosca la antena suavemente en el conector dorado SMA. Solo después conecta alimentación o USB.",
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
        id: "usb",
        blocking: true,
        eyebrow: "Conexión física",
        title: "Conecta la placa por USB",
        instruction: "Usa un cable micro-USB de datos. El navegador intentará detectar la placa; no se escribirá nada todavía.",
        image: "/onboarding/antenna-first.webp",
        imageWidth: 1536,
        imageHeight: 1024,
        imageAlt: "Placa con antena conectada y cable micro-USB alineado con el puerto",
        facts: [
          "Chrome o Edge permiten detección directa mediante Web Serial",
          "Si no aparece, prueba otro cable: muchos cables solo cargan",
          "La selección del puerto requiere confirmación explícita",
        ],
        action: "Detectar placa USB",
        command: "arduino-cli board list",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/docs/SETUP.md",
        documentationLabel: "Resolver problemas de conexión",
      },
      {
        id: "configure",
        blocking: true,
        eyebrow: "Perfil operativo actual",
        title: "Instala el firmware de recurso",
        instruction: "Este primer corte utiliza el perfil real configurado hoy en el firmware. La interfaz nunca afirmará que terminó hasta que tú confirmes el flasheo.",
        image: "/onboarding/kit-overview.webp",
        imageWidth: 1672,
        imageHeight: 941,
        imageAlt: "Kit WOKI con placas, antenas, cables, celulares y Raspberry Pi",
        facts: [
          "Identificador: GRUA07",
          "Tipo de recurso: GRUA",
          "Zona: NORTE",
          "Red local resultante: RECURSO_GRUA07",
        ],
        action: "Ya instalé el firmware",
        command: "bash lora-emergencia/scripts/flash.sh nodo_recurso <puerto>",
        documentation:
          "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/docs/SETUP.md",
        documentationLabel: "Abrir guía de instalación",
      },
      {
        id: "local-wifi",
        blocking: true,
        eyebrow: "Prueba con el celular",
        title: "Conéctate a la red local",
        instruction: "En el celular del rescatista abre Wi-Fi y elige RECURSO_GRUA07. Esta conexión va directo a la placa y funciona sin internet.",
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
        instruction: "Con el Centro local encendido, envía una asignación a GRUA07. El celular debe alertar; al aceptar, el Centro debe recibir la confirmación LoRa.",
        image: "/onboarding/system-topology.webp",
        imageWidth: 1672,
        imageHeight: 941,
        imageAlt: "Topología WOKI con celulares, nodos LoRa, gateway, Centro y sincronización opcional",
        facts: [
          "La misión aparece en el celular del recurso",
          "Aceptar misión envía ACC por LoRa",
          "El Centro confirma con ACK antes de mostrar éxito",
          "Internet no participa en esta prueba",
        ],
        action: "La confirmación llegó al Centro",
        command: "bash lora-emergencia/scripts/probar_portal.sh",
        documentation: "https://github.com/platanus-hack/platanus-hack-26-co-team-28/blob/main/lora-emergencia/docs/PLAN-DEMO.md",
        documentationLabel: "Abrir checklist operacional",
      },
    ],
  };
}

export function getOnboardingStep(stepId: OnboardingStepId) {
  const step = resourceOnboarding().steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Paso de onboarding desconocido: ${stepId}`);
  return step;
}
