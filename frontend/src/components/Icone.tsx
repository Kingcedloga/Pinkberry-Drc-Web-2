import React from "react";
import {
  ArrowLeft,
  Bike,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Coffee,
  Crosshair,
  DollarSign,
  FastForward,
  Gift,
  House,
  IceCreamCone,
  Image as ImageIcone,
  ImagePlus,
  Info,
  Key,
  LayoutGrid,
  LogIn,
  LogOut,
  Mail,
  Map as MapIcone,
  MapPin,
  Minus,
  Navigation,
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  ShoppingBag,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";

import { colors } from "@/src/theme";

/**
 * Jeu d'icônes de l'app : SVG inline (lucide) — pas de police d'icônes, donc
 * aucun risque d'icône invisible sur iOS/Safari. La couleur est toujours
 * explicite (jamais currentColor).
 */
const REGISTRE = {
  "alert-circle": CircleAlert,
  "arrow-left": ArrowLeft,
  camera: Camera,
  check: Check,
  "check-circle": CircleCheck,
  "chevron-down": ChevronDown,
  clock: Clock,
  coffee: Coffee,
  crosshair: Crosshair,
  "dollar-sign": DollarSign,
  "edit-2": Pencil,
  "fast-forward": FastForward,
  gift: Gift,
  grid: LayoutGrid,
  home: House,
  "ice-cream": IceCreamCone,
  image: ImageIcone,
  "image-plus": ImagePlus,
  info: Info,
  key: Key,
  "log-in": LogIn,
  "log-out": LogOut,
  mail: Mail,
  map: MapIcone,
  "map-pin": MapPin,
  minus: Minus,
  navigation: Navigation,
  package: Package,
  phone: Phone,
  plus: Plus,
  receipt: Receipt,
  "refresh-cw": RefreshCw,
  repeat: Repeat,
  scooter: Bike,
  search: Search,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  star: Star,
  trash: Trash2,
  "trash-2": Trash2,
  truck: Truck,
  upload: Upload,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  x: X,
  "x-circle": CircleX,
} as const;

export type NomIcone = keyof typeof REGISTRE;

export function Icone({
  name,
  size = 20,
  color = colors.onSurface,
  fill,
  strokeWidth = 2,
}: {
  name: NomIcone | string;
  size?: number;
  color?: string | number | unknown;
  fill?: string;
  strokeWidth?: number;
}) {
  const Composant = REGISTRE[name as NomIcone] ?? Info;
  return (
    <Composant
      size={size}
      color={color as string}
      fill={fill ?? "none"}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
    />
  );
}
