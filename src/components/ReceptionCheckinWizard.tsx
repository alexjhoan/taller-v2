import { useState, useCallback, useRef, useMemo } from "react";
import { useSnackbar } from "notistack";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomStepper } from "@/components/ui/CustomStepper";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { useUsers, User } from "@/hooks/useUsers";
import { useCreateOrder } from "@/hooks/useCreateOrder";
import { generateShortUid } from "@/utils/uid";
import { localForage } from "@/services/localForage";
import { formatCOP } from "@/utils/currency";
import {
  Car,
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  CheckCircle2,
  Trash2,
  Wrench,
  FileText,
  Loader2,
  AlertCircle,
  RotateCcw,
  UserPlus,
  Users,
} from "lucide-react";

type Step = 1 | 2 | 3;

const STEPS = [
  { label: "Vehículo y Cliente", description: "Datos del vehículo, cliente y tarjeta de circulación" },
  { label: "Condición del Vehículo", description: "Combustible, observaciones y evidencias fotográficas" },
  { label: "Trabajo a Realizar", description: "Checklist, servicios, repuestos y asignación" },
];

const FUEL_LEVELS: Array<{ value: "E" | "1/4" | "1/2" | "3/4" | "F"; label: string }> = [
  { value: "E", label: "E" },
  { value: "1/4", label: "1/4" },
  { value: "1/2", label: "1/2" },
  { value: "3/4", label: "3/4" },
  { value: "F", label: "F" },
];

interface RegistrationCardData {
  plate?: string;
  make?: string;
  model?: string;
  year?: string;
  color?: string;
  ownerName?: string;
  ownerId?: string;
}

interface EvidenceFile {
  file: File;
  id: string;
  preview: string;
  type: string;
}

interface OcrLine {
  text: string;
  y: number;
  x: number;
}

interface ParsedCard {
  data: RegistrationCardData;
  found: string[];
  missing: string[];
}

const YEAR_MIN = 1950;
const YEAR_MAX = 2035;

const CAR_BRANDS = [
  "MITSUBISHI",
  "TOYOTA",
  "FORD",
  "CHEVROLET",
  "NISSAN",
  "HYUNDAI",
  "KIA",
  "MAZDA",
  "VOLKSWAGEN",
  "RENAULT",
  "FIAT",
  "JEEP",
  "DODGE",
  "CHRYSLER",
  "BMW",
  "MERCEDES BENZ",
  "AUDI",
  "HONDA",
  "SUZUKI",
  "ISUZU",
  "DAIHATSU",
  "PEUGEOT",
  "CITROEN",
  "SEAT",
  "SKODA",
  "VOLVO",
  "LAND ROVER",
  "SSANGYONG",
  "GREAT WALL",
  "CHERY",
  "JAC",
  "DFSK",
  "BAIC",
  "TATA",
  "MAHINDRA",
  "PORSCHE",
  "SUBARU",
];

const COLOR_WORDS = [
  "PLATA",
  "BLANCO",
  "NEGRO",
  "ROJO",
  "AZUL",
  "GRIS",
  "VERDE",
  "AMARILLO",
  "BEIGE",
  "DORADO",
  "CAFE",
  "CAFÉ",
  "MARRON",
  "MARRÓN",
  "CELESTE",
  "NARANJA",
  "VINOTINTO",
  "PERLA",
  "TURQUESA",
  "GUINDA",
  "CREMA",
  "BRONCE",
];

const VEHICLE_TYPE_WORDS = [
  "AUTOMOVIL",
  "PARTICULAR",
  "CAMIONETA",
  "CAMION",
  "SEDAN",
  "PICK",
  "SUV",
  "MOTOCICLETA",
  "CARGO",
  "PASAJEROS",
  "CABINA",
  "VAGON",
];

const toTitleCase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    .replace(/\S*\d\S*/g, (token) => token.toUpperCase());

function cleanLine(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÑÜ0-9\s.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yearFromTrailingToken(text: string): { year: string | null; rest: string } {
  const tokens = text.split(" ").filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (/^\d+([/.\-]\d+)*$/.test(token)) {
      const digits = token.replace(/\D/g, "");
      if (digits.length >= 4) {
        const candidate = digits.slice(-4);
        const n = parseInt(candidate, 10);
        if (n >= YEAR_MIN && n <= YEAR_MAX) {
          const rest = tokens
            .filter((_, idx) => idx !== i)
            .join(" ")
            .trim();
          return { year: candidate, rest };
        }
      }
      return { year: null, rest: text };
    }
    if (/[A-ZÁÉÍÓÚÑÜ]/.test(token)) {
      return { year: null, rest: text };
    }
  }
  return { year: null, rest: text };
}

function parseCirculationCard(rawLines: OcrLine[]): ParsedCard {
  const data: RegistrationCardData = {};
  const found: string[] = [];
  const missing: string[] = [];

  const cleaned = rawLines
    .map((l) => ({ ...l, text: cleanLine(l.text) }))
    .filter((l) => l.text.length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  console.log("[OCR-PARSE] Líneas limpias y ordenadas por posición (fila y → columna x):");
  console.table(cleaned.map((l) => ({ fila_y: l.y, col_x: l.x, texto: l.text })));

  let placa: string | null = null;
  const placaLine = cleaned.find((l) => l.text.includes("PLACA"));
  if (placaLine) {
    const afterLabel = placaLine.text.split("PLACA").slice(1).join(" ");
    const m = afterLabel.match(/\b(?=[A-Z0-9]{5,8}\b)(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]+\b/);
    if (m) placa = m[0];
    console.log(
      "[OCR-PARSE] · PLACA (etiquetada):",
      placa ? `✓ "${placa}" (fila y=${placaLine.y}: "${placaLine.text}")` : "✗ etiqueta hallada pero sin código válido",
    );
  }
  if (!placa) {
    for (const l of cleaned) {
      const token = l.text.split(" ").find((t) => /^[A-Z]{2,3}\d{2,3}[A-Z]{0,2}$/.test(t) && t.length >= 5);
      if (token) {
        placa = token;
        console.log(`[OCR-PARSE] · PLACA (fallback por formato): ✓ "${token}"`);
        break;
      }
    }
  }
  if (placa) {
    data.plate = placa;
    found.push("placa");
  } else {
    missing.push("placa");
  }

  let cedLineIdx = -1;
  let cedula: string | null = null;
  for (let i = 0; i < cleaned.length; i++) {
    const m = cleaned[i].text.match(/\b([VJEG])\s?-?(\d{6,10})\b/);
    if (m) {
      cedula = `${m[1]}${m[2]}`;
      cedLineIdx = i;
      break;
    }
  }
  console.log(
    "[OCR-PARSE] · CÉDULA:",
    cedula ? `✓ "${cedula}" (fila ancla y=${cleaned[cedLineIdx].y}: "${cleaned[cedLineIdx].text}")` : "✗ no encontrada",
  );

  let marca: string | null = null;
  let modelo: string | null = null;
  let modeloLineY: number | null = null;
  if (cedLineIdx >= 0) {
    const lineText = cleaned[cedLineIdx].text;
    const cedMatch = lineText.match(/\b([VJEG])\s?-?(\d{6,10})\b/);
    const afterCed = cedMatch ? lineText.slice((cedMatch.index ?? 0) + cedMatch[0].length).trim() : "";

    const brandHit = CAR_BRANDS.find((b) => afterCed.includes(b));
    if (brandHit) {
      marca = brandHit;
      console.log(`[OCR-PARSE] · MARCA: ✓ "${brandHit}" (marca conocida en la fila de la cédula)`);
    } else if (afterCed) {
      marca = afterCed.split(" ")[0];
      console.log(`[OCR-PARSE] · MARCA: ✓ "${marca}" (primera palabra tras la cédula)`);
    } else {
      console.log("[OCR-PARSE] · MARCA: ✗ fila de la cédula sin texto adicional");
    }

    if (brandHit) {
      const rest = afterCed.split(brandHit).slice(1).join(" ").trim();
      if (rest && rest.length > 2) {
        modelo = rest;
        modeloLineY = cleaned[cedLineIdx].y;
        console.log(`[OCR-PARSE] · MODELO: ✓ "${modelo}" (resto de la fila de la cédula)`);
      } else {
        console.log(`[OCR-PARSE] · MODELO: resto muy corto ("${rest}"), se ignorará y buscará en fila siguiente`);
      }
    }
    if (!modelo && cedLineIdx + 1 < cleaned.length) {
      const nextLine = cleaned[cedLineIdx + 1];
      const isTypeLine = VEHICLE_TYPE_WORDS.some((w) => nextLine.text.startsWith(w));
      if (isTypeLine) {
        console.log(`[OCR-PARSE] · MODELO: fila siguiente (${nextLine.text}) es tipo de vehículo, se ignora`);
      } else {
        const { year, rest } = yearFromTrailingToken(nextLine.text);
        if (year) data.year = year;
        const cleanModelo = rest.replace(/^[.\s•,;:]+/, "").trim();
        if (cleanModelo && cleanModelo.length >= 2) {
          modelo = cleanModelo;
          modeloLineY = nextLine.y;
          console.log(
            `[OCR-PARSE] · MODELO: ✓ "${modelo}" (fila siguiente a la cédula, y=${nextLine.y})`,
            year ? `· año de la misma fila: "${year}"` : "",
          );
        }
      }
    }
  }
  if (cedula) {
    data.ownerId = cedula;
    found.push("cédula");
  } else {
    missing.push("cédula");
  }
  if (marca) {
    data.make = toTitleCase(marca);
    found.push("marca");
  } else {
    missing.push("marca");
  }

  if (!data.year) {
    for (const l of cleaned) {
      const tokens = l.text.split(" ");
      for (const t of tokens) {
        if (/^\d{4,10}$/.test(t)) {
          const candidate = t.slice(-4);
          const n = parseInt(candidate, 10);
          if (n >= YEAR_MIN && n <= YEAR_MAX) {
            data.year = candidate;
            break;
          }
        }
      }
      if (data.year) {
        found.push("año");
        console.log(`[OCR-PARSE] · AÑO: ✓ "${data.year}" (encontrado en otra fila, y=${l.y})`);
        break;
      }
    }
  } else {
    found.push("año");
    console.log(`[OCR-PARSE] · AÑO: ✓ "${data.year}" (misma fila que el modelo)`);
  }
  if (!data.year) {
    missing.push("año");
    console.log("[OCR-PARSE] · AÑO: ✗ no encontrado");
  }
  if (modelo) {
    data.model = toTitleCase(modelo.replace(/\b(19[5-9]\d|20[0-3]\d)\b/g, "").trim());
    found.push("modelo");
  } else {
    missing.push("modelo");
  }

  const NAME_NOISE_PREFIXES = [
    "IB ",
    "Y ",
    "VR ",
    "MY ",
    "EO ",
    "DE ",
    "EN ",
    "LA ",
    "EL ",
    "LOS ",
    "LAS ",
    "UN ",
    "UNA ",
  ];
  function cleanNameCandidate(t: string): string {
    let s = t;
    for (const p of NAME_NOISE_PREFIXES) {
      if (s.startsWith(p)) s = s.slice(p.length);
    }
    return s;
  }
  function looksLikeName(t: string): boolean {
    const words = t.split(" ").filter((w) => w.length >= 3);
    return words.length >= 2;
  }

  let nombre: string | null = null;
  if (cedLineIdx >= 1) {
    for (let i = cedLineIdx - 1; i >= Math.max(0, cedLineIdx - 2); i--) {
      const t = cleaned[i].text;
      console.log(`[OCR-PARSE] · NOMBRE: evaluando fila y=${cleaned[i].y} → "${t}"`);
      if (/PLACA|CERTIFICADO|CIRCULAC|INTT|NITT|RNT/.test(t)) break;
      if (/^[A-ZÁÉÍÓÚÑÜ\s.]{5,60}$/.test(t)) {
        const cleanedCandidate = cleanNameCandidate(t);
        if (looksLikeName(cleanedCandidate)) {
          nombre = cleanedCandidate;
          break;
        }
      }
    }
  }
  if (nombre) {
    data.ownerName = toTitleCase(nombre);
    found.push("nombre del propietario");
    console.log(`[OCR-PARSE] · NOMBRE: ✓ "${nombre}" (fila solo-letras sobre la cédula)`);
  } else {
    missing.push("nombre del propietario");
    console.log("[OCR-PARSE] · NOMBRE: ✗ no encontrado");
  }

  let color: string | null = null;
  const specsLine = cleaned.find((l) => /\bEJES?\b|\bKGS?\b/.test(l.text));
  if (specsLine) {
    const parts = specsLine.text.split(/\b(?:EJES?|KGS?)\b/);
    const tail = parts[parts.length - 1].replace(/\d+/g, "").trim();
    if (tail.length >= 3) color = tail;
    console.log(
      "[OCR-PARSE] · COLOR (fila de specs):",
      color ? `✓ "${color}" (tras EJES/KGS, y=${specsLine.y})` : "✗ sin texto útil tras EJES/KGS",
    );
  }
  if (!color) {
    for (const l of cleaned) {
      const hit = COLOR_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(l.text));
      if (hit) {
        color = hit;
        console.log(`[OCR-PARSE] · COLOR (fallback por lista): ✓ "${hit}"`);
        break;
      }
    }
  }
  if (color) {
    data.color = toTitleCase(color);
    found.push("color");
  } else {
    missing.push("color");
    console.log("[OCR-PARSE] · COLOR: ✗ no encontrado (la fila KGS/EJES no fue leída por el OCR)");
  }

  console.log("[OCR-PARSE] ── RESULTADO DEL PARSER ──", { found, missing, data });
  return { data, found, missing };
}

export function ReceptionCheckinWizard() {
  const { enqueueSnackbar } = useSnackbar();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<{
    vehicle_plate: string;
    customer_name: string;
    customer_document_id: string;
    customer_phone: string;
    customer_email: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: string;
    vehicle_color: string;
    mileage: string;
    fuel_level: "E" | "1/4" | "1/2" | "3/4" | "F";
    failure_description: string;
    vehicle_details: string;
    checklist: Array<{ id: string; title: string; priority: "ALTA" | "MEDIA" | "BAJA"; completed: boolean }>;
    parts: Array<{ id: string; name: string; quantity: number; unit_price: number | null; approvalStatus?: string }>;
    hide_costs_from_technicians: boolean;
    assigned_user_id: number[];
  }>({
    vehicle_plate: "",
    customer_name: "",
    customer_document_id: "",
    customer_phone: "",
    customer_email: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_color: "",
    mileage: "",
    fuel_level: "1/2",
    failure_description: "",
    vehicle_details: "",
    checklist: [],
    parts: [],
    hide_costs_from_technicians: true,
    assigned_user_id: [],
  });

  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newCheckPriority, setNewCheckPriority] = useState<"ALTA" | "MEDIA" | "BAJA">("MEDIA");
  const [newPartName, setNewPartName] = useState("");
  const [newPartQuantity, setNewPartQuantity] = useState("");
  const [newPartUnitPrice, setNewPartUnitPrice] = useState("");
  const [serviceItems, setServiceItems] = useState<{ id: string; description: string; price: number }[]>([]);
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [plateError, setPlateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Usuarios para asignación
  const { data: users, isLoading: usersLoading } = useUsers();

  // Hook para crear orden en backend
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();

  // Modal de asignación de usuarios
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignFilter, setAssignFilter] = useState<"all" | "mechanic" | "admin">("mechanic");

  // --- Cámara + OCR (tarjeta de circulación) ---
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const validatePlate = (plate: string): boolean => {
    const regex = /^[ABC][0-9]{3}[ABC0-9]?$/;
    return regex.test(plate);
  };

  const handlePlateChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, vehicle_plate: value }));
    setPlateError("");
  }, []);

  const nextStep = useCallback(() => {
    if (!formData.vehicle_plate || !formData.customer_name || !formData.vehicle_make || !formData.vehicle_model) {
      enqueueSnackbar("Complete los campos obligatorios: placa, cliente, marca y modelo", { variant: "error" });
      return;
    }
    setCurrentStep(2);
  }, [formData]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);
  }, []);

  const addEvidenceFiles = useCallback((files: File[]) => {
    const newFiles: EvidenceFile[] = files.map((file) => ({
      file,
      id: "ev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      preview: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? "video" : "image",
    }));
    setEvidenceFiles((prev) => [...prev, ...newFiles]);
    setPendingFiles((prev) => [...prev, ...files]);
  }, []);

  const removeEvidenceFile = useCallback((id: string) => {
    setEvidenceFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const openCameraModal = useCallback(() => {
    setIsCameraModalOpen(true);
    setTimeout(() => startCamera(), 100);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setCameraError("Permiso de cámara denegado. Habilita el permiso en la configuración del navegador.");
        } else if (err.name === "NotFoundError") {
          setCameraError("No se encontró ninguna cámara en este dispositivo.");
        } else if (err.name === "NotReadableError") {
          setCameraError("La cámara está en uso por otra aplicación.");
        } else if (err.name === "OverconstrainedError") {
          setCameraError("No se pudo acceder a la cámara trasera. Intentando con la frontal...");
          setFacingMode("user");
          setTimeout(() => startCamera(), 100);
        } else {
          setCameraError(`Error al acceder a la cámara: ${err.message}`);
        }
      } else {
        setCameraError("Error desconocido al acceder a la cámara.");
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setTimeout(startCamera, 100);
  }, [stopCamera, startCamera]);

  const closeCameraModal = useCallback(() => {
    stopCamera();
    setIsCameraModalOpen(false);
    setCameraError(null);
    setIsProcessingOcr(false);
  }, [stopCamera]);

  const runOcrOnImage = useCallback(async (file: File) => {
    console.log("[OCR] ══════ INICIO DEL PROCESO OCR ══════");
    console.log("[OCR] Imagen recibida:", {
      nombre: file.name,
      tamaño: `${(file.size / 1024).toFixed(1)} KB`,
      tipo: file.type,
    });
    setIsProcessingOcr(true);
    try {
      console.log("[OCR] ▶ PASO 1: importando tesseract.js (dynamic import)...");
      const { createWorker } = await import("tesseract.js");
      console.log("[OCR] ✔ PASO 1 OK: librería tesseract.js cargada en memoria");

      console.log("[OCR] ▶ PASO 2: creando worker OCR (idiomas: spa+eng). Primera vez descarga ~15 MB...");
      const worker = await createWorker("spa+eng");
      console.log("[OCR] ✔ PASO 2 OK: worker listo para reconocer texto");

      console.log("[OCR] ▶ PASO 3: reconociendo texto + posiciones (puede tardar varios segundos)...");
      const { data } = await worker.recognize(file, {}, { text: true, blocks: true });
      console.log("[OCR] ✔ PASO 3 OK: reconocimiento terminado");
      await worker.terminate();
      console.log("[OCR] ✔ Worker liberado de memoria");
      console.log("[OCR] ──── TEXTO CRUDO detectado en la imagen ────");
      console.log(data.text || "(vacío: la imagen no contenía texto legible)");
      console.log(
        "[OCR] Confianza global del reconocimiento:",
        data.confidence != null ? `${Number(data.confidence).toFixed(1)}%` : "N/A",
      );

      const ocrLines: OcrLine[] = [];
      if (data.blocks && data.blocks.length > 0) {
        data.blocks.forEach((block) =>
          block.paragraphs?.forEach((paragraph) =>
            paragraph.lines?.forEach((line) => {
              if (line.text && line.text.trim()) {
                ocrLines.push({
                  text: line.text,
                  y: Math.round(line.bbox?.y0 ?? 0),
                  x: Math.round(line.bbox?.x0 ?? 0),
                });
              }
            }),
          ),
        );
      }
      if (ocrLines.length === 0) {
        console.warn("[OCR] Sin bounding boxes; usando orden de líneas del texto plano");
        (data.text || "").split("\n").forEach((lineText, idx) => {
          if (lineText.trim()) ocrLines.push({ text: lineText, y: idx * 10, x: 0 });
        });
      }
      console.log(`[OCR] ✔ PASO 4 OK: ${ocrLines.length} líneas detectadas con posición`);
      console.table(ocrLines.map((l) => ({ fila_y: l.y, col_x: l.x, texto: l.text.trim() })));

      console.log("[OCR] ▶ PASO 5: ejecutando parser posicional del certificado...");
      const result = parseCirculationCard(ocrLines);

      console.log("[OCR] ▶ PASO 6: llenando formulario con:", result.data);
      setFormData((prev) => ({
        ...prev,
        vehicle_plate: result.data.plate ?? prev.vehicle_plate,
        customer_name: result.data.ownerName ?? prev.customer_name,
        customer_document_id: result.data.ownerId ?? prev.customer_document_id,
        vehicle_make: result.data.make ?? prev.vehicle_make,
        vehicle_model: result.data.model ?? prev.vehicle_model,
        vehicle_year: result.data.year ?? prev.vehicle_year,
        vehicle_color: result.data.color ?? prev.vehicle_color,
      }));

      if (result.found.length > 0) {
        enqueueSnackbar(`OCR: campos detectados → ${result.found.join(", ")}`, { variant: "success" });
      }
      result.missing.forEach((label) => {
        enqueueSnackbar(`OCR no detectó: ${label}. Por favor escríbelo manualmente.`, { variant: "warning" });
      });
      console.log(
        `[OCR] ══════ FIN DEL PROCESO OCR (detectados: ${result.found.length}, faltantes: ${result.missing.length}) ══════`,
      );
    } catch (err) {
      console.error("[OCR] ══════ ERROR EN EL PROCESO OCR ══════", err);
      enqueueSnackbar("OCR no disponible en este momento. Completa los datos manualmente.", { variant: "warning" });
    } finally {
      setIsProcessingOcr(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `circulation-card-${Date.now()}.jpg`, { type: "image/jpeg" });
          addEvidenceFiles([file]);
          closeCameraModal();
          runOcrOnImage(file);
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [addEvidenceFiles, closeCameraModal, runOcrOnImage]);

  const handleCameraCapture = useCallback(
    (file: File) => {
      addEvidenceFiles([file]);
      enqueueSnackbar("Evidencia capturada", { variant: "success" });
    },
    [addEvidenceFiles],
  );

  const addChecklistItem = useCallback((title: string, priority: "ALTA" | "MEDIA" | "BAJA") => {
    if (!title.trim()) return;
    const newItem = { id: "cl-" + Date.now(), title: title.trim(), priority, completed: false };
    setFormData((prev) => ({ ...prev, checklist: [...prev.checklist, newItem] }));
    setNewCheckItem("");
  }, []);

  const toggleChecklistItem = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    }));
  }, []);

  const removeChecklistItem = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((item) => item.id !== id),
    }));
  }, []);

  const addPart = useCallback(() => {
    const trimmedName = newPartName.trim();
    if (!trimmedName) {
      enqueueSnackbar("El nombre del repuesto es obligatorio", { variant: "error" });
      return;
    }
    const parsedQuantity = parseInt(newPartQuantity, 10);
    const quantityValue = Number.isFinite(parsedQuantity) && parsedQuantity >= 1 ? parsedQuantity : 1;
    const parsedPrice = parseFloat(newPartUnitPrice);
    const unitPriceValue = newPartUnitPrice.trim() === "" || !Number.isFinite(parsedPrice) ? null : parsedPrice;
    const newPart = {
      id: "pt-" + Date.now(),
      name: trimmedName,
      quantity: quantityValue,
      unit_price: unitPriceValue,
      approvalStatus: "accepted",
    };
    setFormData((prev) => ({ ...prev, parts: [...prev.parts, newPart] }));
    setNewPartName("");
    setNewPartQuantity("");
    setNewPartUnitPrice("");
  }, [newPartName, newPartQuantity, newPartUnitPrice]);

  const removePart = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      parts: prev.parts.filter((part) => part.id !== id),
    }));
  }, []);

  const addService = useCallback(() => {
    const trimmedDescription = newServiceDescription.trim();
    if (!trimmedDescription) {
      enqueueSnackbar("La descripción del servicio es obligatoria", { variant: "error" });
      return;
    }
    const parsedPrice = parseFloat(newServicePrice);
    const priceValue = newServicePrice.trim() === "" || !Number.isFinite(parsedPrice) ? 0 : parsedPrice;
    setServiceItems((prev) => [
      ...prev,
      { id: "svc-" + Date.now(), description: trimmedDescription, price: priceValue },
    ]);
    setNewServiceDescription("");
    setNewServicePrice("");
  }, [newServiceDescription, newServicePrice]);

  const removeService = useCallback((id: string) => {
    setServiceItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const formatCOP = useCallback((amount: number): string => {
    return amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (formData.checklist.length === 0) {
        enqueueSnackbar("Debe agregar al menos un item al checklist", { variant: "error" });
        return;
      }

      // Validación no bloqueante de repuestos (igual que ReceptionCheckinForm)
      const hasInvalidPart = formData.parts.some((part) => !part.name.trim() || part.quantity < 1);
      if (hasInvalidPart) {
        enqueueSnackbar("Revisa los repuestos: nombre y cantidad son obligatorios", { variant: "warning" });
      }

      setIsSubmitting(true);

      const payload = {
        customer_name: formData.customer_name,
        customer_document_id: formData.customer_document_id || null,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        vehicle_plate: formData.vehicle_plate,
        vehicle_make: formData.vehicle_make,
        vehicle_model: formData.vehicle_model,
        vehicle_year: parseInt(formData.vehicle_year, 10) || new Date().getFullYear(),
        vehicle_color: formData.vehicle_color || null,
        mileage: parseInt(formData.mileage, 10) || 0,
        fuel_level: formData.fuel_level,
        failure_description: formData.failure_description,
        vehicle_details: formData.vehicle_details || null,
        status: "received",
        checklist: JSON.stringify(formData.checklist),
        parts: JSON.stringify(
          formData.parts.map((p) => ({
            name: p.name,
            quantity: p.quantity,
            unit_price: p.unit_price,
            approvalStatus: p.approvalStatus,
          })),
        ),
        service_items: JSON.stringify(serviceItems.map((s) => ({ description: s.description, price: s.price }))),
        assigned_user_id: JSON.stringify(formData.assigned_user_id),
      };

      createOrder(payload, {
        onSuccess: async (response) => {
          const orderId = response?.id;
          enqueueSnackbar("Orden creada exitosamente", { variant: "success" });

          // Subir evidencias pendientes si hay archivos y orderId válido
          if (orderId && pendingFiles.length > 0) {
            try {
              let successCount = 0;
              for (const file of pendingFiles) {
                const formDataUpload = new FormData();
                formDataUpload.append("file", file);
                formDataUpload.append("evidence_type", "reception");
                const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
                const { getApiToken } = await import("@/services/api");
                const token = getApiToken() || "";
                const uploadResponse = await fetch(`${apiBaseUrl}/api/orders/${orderId}/evidence`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                  body: formDataUpload,
                });
                if (uploadResponse.ok) {
                  successCount++;
                } else {
                  console.error("Error subiendo evidencia:", await uploadResponse.text());
                }
              }
              if (successCount > 0) {
                enqueueSnackbar(`${successCount} evidencia(s) subida(s) correctamente`, { variant: "success" });
              }
              if (successCount < pendingFiles.length) {
                enqueueSnackbar(`${pendingFiles.length - successCount} evidencia(s) fallaron`, { variant: "warning" });
              }
            } catch (uploadError) {
              console.error("Error subiendo evidencias:", uploadError);
              enqueueSnackbar("Orden creada pero hubo error subiendo evidencias", { variant: "warning" });
            }
          }

          // Resetear formulario y volver al paso 1 SOLO en éxito
          setFormData({
            vehicle_plate: "",
            customer_name: "",
            customer_document_id: "",
            customer_phone: "",
            customer_email: "",
            vehicle_make: "",
            vehicle_model: "",
            vehicle_year: "",
            vehicle_color: "",
            mileage: "",
            fuel_level: "1/2",
            failure_description: "",
            vehicle_details: "",
            checklist: [],
            parts: [],
            hide_costs_from_technicians: true,
            assigned_user_id: [],
          });
          setServiceItems([]);
          setPendingFiles([]);
          setEvidenceFiles([]);
          setPlateError("");
          setCurrentStep(1);
        },
        onError: async (error: unknown) => {
          // NO resetear formulario en error - mantener datos para que el usuario corrija
          if (error instanceof Error && "status" in error && (error as { status: number }).status === 503) {
            // Modo offline: guardar en cola local
            const { localForage } = await import("@/services/localForage");
            await localForage.addToQueue({
              endpoint: "/api/orders",
              method: "POST",
              body: {
                customer_name: formData.customer_name,
                customer_phone: formData.customer_phone,
                customer_email: formData.customer_email,
                customer_document_id: formData.customer_document_id || null,
                vehicle_plate: formData.vehicle_plate,
                vehicle_make: formData.vehicle_make,
                vehicle_model: formData.vehicle_model,
                vehicle_year: parseInt(formData.vehicle_year, 10) || new Date().getFullYear(),
                vehicle_color: formData.vehicle_color || null,
                mileage: parseInt(formData.mileage, 10) || 0,
                fuel_level: formData.fuel_level,
                failure_description: formData.failure_description,
                vehicle_details: formData.vehicle_details || null,
                status: "received",
                checklist: JSON.stringify(formData.checklist),
                parts: JSON.stringify(
                  formData.parts.map((p) => ({
                    name: p.name,
                    quantity: p.quantity,
                    unit_price: p.unit_price,
                    approvalStatus: p.approvalStatus,
                  })),
                ),
                service_items: JSON.stringify(
                  serviceItems.map((s) => ({ description: s.description, price: s.price })),
                ),
                assigned_user_id: JSON.stringify(formData.assigned_user_id),
              },
            });
            enqueueSnackbar("Sin conexión. Se guardó para enviar luego.", { variant: "warning" });
          } else {
            const apiError = error as { status?: number; statusText?: string; body?: { statusText?: string } };
            const detail = apiError.body?.statusText || apiError.statusText || "Error al registrar la recepción";
            const status = apiError.status ? ` [${apiError.status}]` : "";
            const name = error instanceof Error ? error.name : "Error";
            enqueueSnackbar(`${name}${status}: ${detail}`, { variant: "error" });
            console.error("[checkin]", error);
          }
          // NO resetear formulario ni cambiar step en error
        },
        onSettled: () => {
          setIsSubmitting(false);
        },
      });
    },
    [formData, evidenceFiles, serviceItems, pendingFiles],
  );

  // Filtrar usuarios para el modal
  const filteredUsers = useMemo(() => {
    return users
      ?.filter((u) => u.active === 1 && (assignFilter === "all" || u.role === assignFilter))
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === "mechanic" ? -1 : 1;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
  }, [users, assignFilter, formData.assigned_user_id]);

  // Renderizar lista de usuarios para el modal (evita ternarios inline problemáticos)
  const userListContent = usersLoading ? (
    <div className='flex items-center justify-center py-8'>
      <Loader2 className='h-6 w-6 animate-spin text-brand-600' />
      <span className='ml-2 text-slate-500'>Cargando usuarios...</span>
    </div>
  ) : filteredUsers && filteredUsers.length === 0 ? (
    <p className='text-center text-slate-500 py-4'>No hay usuarios disponibles con este filtro</p>
  ) : (
    <>
      {filteredUsers?.map((user) => {
        const isAssigned = formData.assigned_user_id.includes(user.id);
        return (
          <label
            key={user.id}
            className={`flex items-center gap-3 rounded-lg border p-1 transition-colors cursor-pointer ${
              isAssigned ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:bg-slate-50"
            }`}
          >
            <input
              type='checkbox'
              checked={isAssigned}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  assigned_user_id: e.target.checked
                    ? [...prev.assigned_user_id, user.id]
                    : prev.assigned_user_id.filter((id) => id !== user.id),
                }));
              }}
              className='h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500'
            />
            <div className='flex-1 min-w-0'>
              <p className='font-medium text-slate-800 truncate'>
                {user.first_name} {user.last_name}
              </p>
            </div>
            <CustomBadge variant={user.role === "admin" ? "brand" : "info"} className='whitespace-nowrap'>
              {user.role === "admin" ? "Admin" : "Mecánico"}
            </CustomBadge>
          </label>
        );
      })}
    </>
  );

  return (
    <div className='mx-auto max-w-2xl space-y-6 px-4 pb-8 sm:px-6'>
      <h1 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 pt-4'>Recepción de Vehículo</h1>

      <CustomStepper steps={STEPS} currentStep={currentStep - 1} className='mb-6' />

      <form onSubmit={handleSubmit} className='space-y-6'>
        {currentStep === 1 && (
          <div className='space-y-6 animate-fade-in'>
            <CustomCard className='overflow-hidden'>
              <div className='mb-4 flex items-center gap-2'>
                <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
                  <Car className='h-4 w-4 text-brand-600' />
                </div>
                <h2 className='text-sm font-bold text-slate-800'>Placa del Vehículo</h2>
              </div>
              <div className='flex-1'>
                <div className='flex gap-2'>
                  <div className='flex-1'>
                    <input
                      type='text'
                      value={formData.vehicle_plate}
                      onChange={(e) => handlePlateChange(e.target.value)}
                      placeholder='ABC123'
                      maxLength={10}
                      className='w-full rounded-xl border-2 border-slate-800 bg-amber-300 px-4 py-3.5 text-center text-2xl font-extrabold tracking-[0.2em] text-neutral-900 placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none transition-colors'
                    />
                    {plateError && <p className='mt-2 text-xs font-medium text-red-500'>{plateError}</p>}
                  </div>
                  <CustomButton
                    type='button'
                    variant='secondary'
                    size='sm'
                    leftIcon={<Camera className='h-4 w-4' />}
                    onClick={openCameraModal}
                    className='self-end mb-2'
                  >
                    Cámara
                  </CustomButton>
                </div>
              </div>
            </CustomCard>

            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Datos del Vehículo</h2>
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-3'>
                  <CustomInput
                    label='Marca'
                    name='vehicle_make'
                    value={formData.vehicle_make}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_make: e.target.value }))}
                    placeholder='Toyota'
                  />
                  <CustomInput
                    label='Modelo'
                    name='vehicle_model'
                    value={formData.vehicle_model}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_model: e.target.value }))}
                    placeholder='Corolla'
                  />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <CustomInput
                    label='Color'
                    name='vehicle_color'
                    value={formData.vehicle_color}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_color: e.target.value }))}
                    placeholder='Rojo'
                  />
                  <CustomInput
                    label='Año'
                    name='vehicle_year'
                    value={formData.vehicle_year}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_year: e.target.value }))}
                    placeholder='2020'
                    inputMode='numeric'
                  />
                </div>
                <CustomInput
                  label='Kilometraje'
                  name='mileage'
                  value={formData.mileage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mileage: e.target.value }))}
                  placeholder='45000'
                  inputMode='numeric'
                />
              </div>
            </CustomCard>

            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Datos del Cliente</h2>
              <div className='space-y-4'>
                <CustomInput
                  label='Nombre completo'
                  name='customer_name'
                  value={formData.customer_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customer_name: e.target.value }))}
                  placeholder='Juan Pérez'
                  required
                />
                <div className='grid grid-cols-2 gap-3'>
                  <CustomInput
                    label='Cédula'
                    name='customer_document_id'
                    value={formData.customer_document_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customer_document_id: e.target.value }))}
                    placeholder='V08500870'
                    inputMode='numeric'
                  />
                  <CustomInput
                    label='Teléfono'
                    name='customer_phone'
                    type='tel'
                    value={formData.customer_phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder='+58 412 123 4567'
                    required
                  />
                </div>
                <CustomInput
                  label='Email'
                  name='customer_email'
                  type='email'
                  value={formData.customer_email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customer_email: e.target.value }))}
                  placeholder='juan@email.com'
                />
              </div>
            </CustomCard>

            <CustomCard>
              <div className='flex items-center justify-between'>
                <h2 className='mb-4 text-sm font-bold text-slate-800'>Asignar a</h2>
                <CustomButton
                  type='button'
                  variant='secondary'
                  size='sm'
                  leftIcon={<UserPlus className='h-4 w-4' />}
                  onClick={() => setIsAssignModalOpen(true)}
                >
                  Gestionar
                </CustomButton>
              </div>
              {formData.assigned_user_id.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-2'>
                  {formData.assigned_user_id.map((id) => {
                    const user = users?.find((u) => u.id === id);
                    return user ? (
                      <CustomBadge key={id} variant='info' className='gap-1'>
                        {user.first_name} {user.last_name}
                        <span className='text-xs opacity-70 capitalize'>{user.role}</span>
                      </CustomBadge>
                    ) : null;
                  })}
                </div>
              )}
              {formData.assigned_user_id.length === 0 && (
                <p className='mt-2 text-sm text-slate-400'>Ningún usuario asignado</p>
              )}
            </CustomCard>

            <CustomButton
              type='button'
              size='lg'
              className='w-full'
              onClick={() => nextStep()}
              disabled={
                !formData.vehicle_plate || !formData.customer_name || !formData.vehicle_make || !formData.vehicle_model
              }
            >
              Continuar al Paso 2
            </CustomButton>
          </div>
        )}

        {currentStep === 2 && (
          <div className='space-y-6 animate-fade-in'>
            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Nivel de Combustible</h2>
              <div className='flex gap-1.5 rounded-xl bg-slate-100 p-1.5'>
                {FUEL_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type='button'
                    onClick={() => setFormData((prev) => ({ ...prev, fuel_level: level.value }))}
                    className={`flex-1 rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                      formData.fuel_level === level.value
                        ? "bg-brand-600 text-white shadow"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </CustomCard>

            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Evidencias Fotográficas</h2>
              <EvidenceUploader
                orderId={0}
                selectionOnly
                allowedTypes={["reception"]}
                onFilesSelected={(files) => addEvidenceFiles(files)}
              />
            </CustomCard>

            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Falla reportada</h2>
              <textarea
                value={formData.failure_description}
                onChange={(e) => setFormData((p) => ({ ...p, failure_description: e.target.value }))}
                placeholder='Describe el problema reportado por el cliente...'
                rows={3}
                className='input-field resize-none'
              />
            </CustomCard>

            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Observaciones del Vehículo</h2>
              <textarea
                value={formData.vehicle_details}
                onChange={(e) => setFormData((p) => ({ ...p, vehicle_details: e.target.value }))}
                placeholder='Ej: Rayón en puerta derecha, alerón trasero, llantas de aleación, manchas en tapicería...'
                rows={3}
                className='input-field resize-none'
              />
              <p className='mt-1.5 text-xs text-slate-400'>
                Daños visibles, accesorios, estado general, características especiales...
              </p>
            </CustomCard>

            <div className='flex gap-3'>
              <CustomButton
                type='button'
                variant='secondary'
                size='lg'
                className='flex-1'
                leftIcon={<ChevronLeft className='h-4 w-4' />}
                onClick={() => setCurrentStep(1)}
              >
                Anterior
              </CustomButton>
              <CustomButton
                type='button'
                size='lg'
                className='flex-1'
                rightIcon={<ChevronRight className='h-4 w-4' />}
                onClick={() => setCurrentStep(3)}
              >
                Siguiente
              </CustomButton>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className='space-y-6 animate-fade-in'>
            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Checklist de Trabajo</h2>
              <div className='mb-4 flex gap-2'>
                <input
                  type='text'
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  placeholder='Agregar item de checklist...'
                  className='input-field flex-1'
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChecklistItem(newCheckItem, newCheckPriority);
                    }
                  }}
                />
                <select
                  value={newCheckPriority}
                  onChange={(e) => setNewCheckPriority(e.target.value as "ALTA" | "MEDIA" | "BAJA")}
                  className='input-field w-28'
                >
                  <option value='ALTA'>ALTA</option>
                  <option value='MEDIA'>MEDIA</option>
                  <option value='BAJA'>BAJA</option>
                </select>
                <CustomButton
                  type='button'
                  size='sm'
                  leftIcon={<Plus className='h-3 w-3' />}
                  onClick={() => addChecklistItem(newCheckItem, newCheckPriority)}
                />
              </div>
              {formData.checklist.length > 0 && (
                <div className='space-y-2'>
                  {formData.checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                        item.completed ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-white"
                      }`}
                    >
                      <button
                        type='button'
                        onClick={() => toggleChecklistItem(item.id)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                          item.completed
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white hover:border-slate-400"
                        }`}
                      >
                        {item.completed && <CheckCircle2 className='h-4 w-4' />}
                      </button>
                      <div className='flex-1'>
                        <p
                          className={`text-sm font-medium ${
                            item.completed ? "text-slate-400 line-through" : "text-slate-700"
                          }`}
                        >
                          {item.title}
                        </p>
                      </div>
                      <CustomBadge
                        variant={
                          item.priority === "ALTA" ? "danger" : item.priority === "MEDIA" ? "warning" : "neutral"
                        }
                      >
                        {item.priority}
                      </CustomBadge>
                      <button
                        type='button'
                        onClick={() => removeChecklistItem(item.id)}
                        className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                        title='Eliminar item'
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CustomCard>

            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Servicios (Mano de obra)</h2>
              <div className='space-y-3'>
                {serviceItems.map((item, index) => (
                  <div
                    key={item.id}
                    className='flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5'
                  >
                    <div className='min-w-0 flex-1 basis-full sm:basis-auto'>
                      <CustomInput
                        label={`Servicio ${index + 1}`}
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...serviceItems];
                          updated[index] = { ...updated[index], description: e.target.value };
                          setServiceItems(updated);
                        }}
                        placeholder='Ej: Cambio de aceite y filtro'
                      />
                    </div>
                    <div className='flex items-end gap-2'>
                      <CustomInput
                        label='Precio (COP)'
                        value={item.price.toString()}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          const price = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
                          setServiceItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, price } : i)));
                        }}
                        placeholder='0'
                      />
                      <CustomButton
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => removeService(item.id)}
                        className='text-red-500 hover:bg-red-50'
                        title='Eliminar servicio'
                      >
                        <Trash2 className='h-4 w-4' />
                      </CustomButton>
                    </div>
                  </div>
                ))}
              </div>

              <div className='mt-4 flex gap-2'>
                <div className='min-w-0 flex-1'>
                  <CustomInput
                    label='Nuevo servicio'
                    value={newServiceDescription}
                    onChange={(e) => setNewServiceDescription(e.target.value)}
                    placeholder='Ej: Alineación y balanceo'
                  />
                </div>
                <div className='w-32'>
                  <CustomInput
                    label='Precio'
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    placeholder='0'
                  />
                </div>
                <CustomButton
                  type='button'
                  size='sm'
                  leftIcon={<Plus className='h-3 w-3' />}
                  onClick={addService}
                  className='mb-0.5'
                />
              </div>

              {serviceItems.length > 0 && (
                <div className='mt-4 border-t border-slate-100 pt-4 text-right'>
                  <p className='text-xs font-medium text-slate-400'>Total mano de obra</p>
                  <p className='text-xl font-extrabold text-brand-600'>
                    {formatCOP(serviceItems.reduce((sum, item) => sum + item.price, 0))}
                  </p>
                </div>
              )}
            </CustomCard>

            <CustomCard>
              <h2 className='mb-4 text-sm font-bold text-slate-800'>Repuestos Solicitados</h2>
              <div className='mb-4 flex flex-wrap gap-2'>
                <div className='min-w-0 flex-1 basis-full sm:basis-auto'>
                  <CustomInput
                    label='Repuesto'
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    placeholder='Ej: Filtro de aceite'
                  />
                </div>
                <div className='w-24'>
                  <CustomInput
                    label='Cant.'
                    value={newPartQuantity}
                    onChange={(e) => setNewPartQuantity(e.target.value)}
                    placeholder='1'
                  />
                </div>
                <div className='w-32'>
                  <CustomInput
                    label='Precio c/u'
                    value={newPartUnitPrice}
                    onChange={(e) => setNewPartUnitPrice(e.target.value)}
                    placeholder='0'
                  />
                </div>
                <CustomButton
                  type='button'
                  size='sm'
                  leftIcon={<Plus className='h-3 w-3' />}
                  onClick={addPart}
                  className='mb-0.5'
                />
              </div>

              {formData.parts.length === 0 ? (
                <p className='text-sm text-slate-400'>No hay repuestos solicitados</p>
              ) : (
                <div className='space-y-3'>
                  {formData.parts.map((part) => (
                    <div
                      key={part.id}
                      className='flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5'
                    >
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-bold text-slate-800'>{part.name}</p>
                        <p className='mt-0.5 text-xs font-medium text-slate-400'>
                          Cant: {part.quantity}
                          {part.unit_price !== null && ` · ${formatCOP(part.unit_price)} c/u`}
                        </p>
                      </div>
                      <div className='flex flex-wrap items-center justify-end gap-2'>
                        <CustomBadge variant='success'>Aprobado</CustomBadge>
                        <button
                          type='button'
                          onClick={() => removePart(part.id)}
                          className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                          title='Eliminar repuesto'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CustomCard>

            <div className='flex gap-3'>
              <CustomButton
                type='button'
                variant='secondary'
                className='flex-1'
                leftIcon={<ChevronLeft className='h-4 w-4' />}
                onClick={() => setCurrentStep(2)}
              >
                Anterior
              </CustomButton>
              <CustomButton
                type='submit'
                size='lg'
                className='flex-1'
                leftIcon={<Wrench className='h-5 w-5' />}
                isLoading={isSubmitting || isCreating}
              >
                Registrar Recepción
              </CustomButton>
            </div>
          </div>
        )}
      </form>

      {/* Modal: Cámara para tarjeta de circulación */}
      <CustomDialog
        open={isCameraModalOpen}
        onClose={closeCameraModal}
        title='Foto de la tarjeta de circulación'
        maxWidth='md'
      >
        <div className='space-y-4'>
          {cameraError && (
            <div className='rounded-lg bg-red-50 p-3 text-sm text-red-700' role='alert'>
              {cameraError}
              {cameraError.includes("trasera") && (
                <CustomButton
                  variant='secondary'
                  size='sm'
                  className='mt-2'
                  onClick={() => {
                    setFacingMode("user");
                    startCamera();
                  }}
                >
                  Usar cámara frontal
                </CustomButton>
              )}
            </div>
          )}

          <div className='relative aspect-video overflow-hidden rounded-lg bg-black'>
            <video ref={videoRef} className='h-full w-full object-cover' autoPlay playsInline muted />
            {!cameraStream && !cameraError && (
              <div className='absolute inset-0 flex items-center justify-center text-white'>
                <Loader2 className='h-6 w-6 animate-spin' />
                <span className='ml-2'>Iniciando cámara...</span>
              </div>
            )}
            {cameraError && (
              <div className='absolute inset-0 flex items-center justify-center p-4 text-center text-white'>
                <AlertCircle className='h-8 w-8' />
              </div>
            )}
            {cameraStream && !isProcessingOcr && (
              <div className='pointer-events-none absolute inset-x-8 inset-y-6 rounded-xl border-2 border-dashed border-white/70' />
            )}
          </div>

          <canvas ref={canvasRef} className='hidden' />

          <div className='flex items-center justify-center gap-4'>
            <CustomButton
              variant='secondary'
              size='sm'
              onClick={switchCamera}
              disabled={!cameraStream}
              aria-label='Cambiar cámara'
              className='p-2'
            >
              <RotateCcw className='h-5 w-5' />
            </CustomButton>
            <CustomButton
              type='button'
              size='lg'
              leftIcon={isProcessingOcr ? <Loader2 className='h-5 w-5 animate-spin' /> : <Camera className='h-5 w-5' />}
              onClick={capturePhoto}
              disabled={!cameraStream || isProcessingOcr}
              className='min-w-[160px]'
            >
              {isProcessingOcr ? "Procesando OCR..." : "Capturar"}
            </CustomButton>
            <CustomButton
              variant='secondary'
              size='sm'
              onClick={closeCameraModal}
              aria-label='Cerrar cámara'
              className='p-2'
            >
              <X className='h-5 w-5' />
            </CustomButton>
          </div>

          <p className='text-center text-xs text-slate-400'>
            Coloca la tarjeta de circulación frente a la cámara. Al capturar, el OCR leerá placa, marca, modelo, año,
            color y propietario para llenar el formulario automáticamente.
          </p>
        </div>
      </CustomDialog>

      {/* Modal: Asignar usuarios (mecánicos/admins) */}
      <CustomDialog
        open={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title='Asignar usuarios a la orden'
        maxWidth='lg'
      >
        <div className='space-y-4'>
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Filtrar por rol</label>
            <select
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value as "all" | "mechanic" | "admin")}
              className='input-field'
            >
              <option value='all'>Todos</option>
              <option value='mechanic'>Mecánico</option>
              <option value='admin'>Admin</option>
            </select>
          </div>

          {userListContent}

          <div className='flex justify-end gap-3 pt-4 border-t border-slate-100'>
            <CustomButton variant='secondary' onClick={() => setIsAssignModalOpen(false)}>
              Cancelar
            </CustomButton>
            <CustomButton onClick={() => setIsAssignModalOpen(false)} leftIcon={<CheckCircle2 className='h-4 w-4' />}>
              Guardar
            </CustomButton>
          </div>
        </div>
      </CustomDialog>
    </div>
  );
}
