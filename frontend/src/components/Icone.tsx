import React from "react";
import { View } from "react-native";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowsRightLeftIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ArchiveBoxIcon,
  Cog6ToothIcon,
  CakeIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CubeIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ForwardIcon,
  GiftIcon,
  InformationCircleIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  MapIcon,
  MapPinIcon,
  MinusIcon,
  PaperAirplaneIcon,
  PencilIcon,
  PhoneIcon,
  PhotoIcon,
  PlusIcon,
  ReceiptPercentIcon,
  ShareIcon,
  SunIcon,
  MoonIcon,
  DevicePhoneMobileIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  StarIcon,
  TrashIcon,
  TruckIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  ViewfinderCircleIcon,
  XCircleIcon,
  XMarkIcon,
  HomeIcon,
} from "react-native-heroicons/outline";
import { StarIcon as StarPlein } from "react-native-heroicons/solid";

import { colors } from "@/src/theme";

/**
 * Jeu d'icônes de l'app : Heroicons (SVG inline, tracés arrondis).
 *
 * Deux garde-fous contre les icônes invisibles sur iOS/Safari :
 *  - la couleur est toujours passée explicitement dans `stroke` / `color`
 *    (jamais `currentColor`, que WebKit ne résout pas ici) ;
 *  - chaque icône est enveloppée dans une View aux dimensions fixes, car Safari
 *    réduit parfois un <svg> à zéro dans un conteneur flex.
 */
const REGISTRE = {
  "alert-circle": ExclamationCircleIcon,
  archive: ArchiveBoxIcon,
  download: ArrowDownTrayIcon,
  "arrow-left": ArrowLeftIcon,
  settings: Cog6ToothIcon,
  camera: CameraIcon,
  check: CheckIcon,
  "check-circle": CheckCircleIcon,
  "chevron-down": ChevronDownIcon,
  clock: ClockIcon,
  coffee: CakeIcon,
  crosshair: ViewfinderCircleIcon,
  "dollar-sign": CurrencyDollarIcon,
  "edit-2": PencilIcon,
  eye: EyeIcon,
  "eye-off": EyeSlashIcon,
  "fast-forward": ForwardIcon,
  gift: GiftIcon,
  grid: Squares2X2Icon,
  home: HomeIcon,
  "ice-cream": CakeIcon,
  image: PhotoIcon,
  "image-plus": PhotoIcon,
  info: InformationCircleIcon,
  key: KeyIcon,
  "log-in": ArrowRightStartOnRectangleIcon,
  "log-out": ArrowRightStartOnRectangleIcon,
  mail: EnvelopeIcon,
  map: MapIcon,
  "map-pin": MapPinIcon,
  minus: MinusIcon,
  navigation: PaperAirplaneIcon,
  package: CubeIcon,
  phone: PhoneIcon,
  plus: PlusIcon,
  receipt: ReceiptPercentIcon,
  "refresh-cw": ArrowPathIcon,
  repeat: ArrowsRightLeftIcon,
  scooter: TruckIcon,
  search: MagnifyingGlassIcon,
  share: ShareIcon,
  sun: SunIcon,
  moon: MoonIcon,
  smartphone: DevicePhoneMobileIcon,
  "shopping-bag": ShoppingBagIcon,
  "shopping-cart": ShoppingCartIcon,
  star: StarIcon,
  trash: TrashIcon,
  "trash-2": TrashIcon,
  truck: TruckIcon,
  upload: ArrowUpTrayIcon,
  user: UserIcon,
  "user-plus": UserPlusIcon,
  users: UsersIcon,
  x: XMarkIcon,
  "x-circle": XCircleIcon,
} as const;

const PLEINS: Partial<Record<keyof typeof REGISTRE, any>> = {
  star: StarPlein,
};

export type NomIcone = keyof typeof REGISTRE;

export function Icone({
  name,
  size = 20,
  color = colors.onSurface,
  fill,
  strokeWidth = 1.8,
}: {
  name: NomIcone | string;
  size?: number;
  color?: string | number | unknown;
  fill?: string;
  strokeWidth?: number;
}) {
  const plein = !!fill && fill !== "none";
  const Composant = (plein ? PLEINS[name as NomIcone] : undefined) ?? REGISTRE[name as NomIcone] ?? InformationCircleIcon;
  const couleur = (color as string) ?? colors.onSurface;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Composant
        size={size}
        width={size}
        height={size}
        color={couleur}
        stroke={plein ? "none" : couleur}
        fill={plein ? ((fill as string) ?? couleur) : "none"}
        strokeWidth={strokeWidth}
      />
    </View>
  );
}
