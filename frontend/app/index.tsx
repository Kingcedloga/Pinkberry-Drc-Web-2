import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";

import { EcranDemarrage } from "@/src/components/EcranDemarrage";
import { useAuth } from "@/src/auth";
import { CLE_TEL_REPORTE } from "@/src/prefs";
import { prendreSuite } from "@/src/suite";
import { useTheme } from "@/src/theme-contexte";
import { storage } from "@/src/utils/storage";

export default function Index() {
  useTheme();
  const { user, loading } = useAuth();
  const [reporte, setReporte] = useState<boolean | null>(null);
  // Client revenant d'une connexion (Google notamment) : page visitée avant de se connecter.
  const [suite, setSuite] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    (async () => setReporte(!!(await storage.getItem<string>(CLE_TEL_REPORTE, ""))))();
  }, []);

  const estClient = user?.role === "client";
  const telephoneDabord = estClient && !user?.telephone && !reporte;
  // La page mémorisée n'est lue (et effacée) qu'au moment d'y aller.
  const attendSuite = !loading && reporte !== null && estClient && !telephoneDabord;
  useEffect(() => {
    if (attendSuite) void prendreSuite().then(setSuite);
  }, [attendSuite]);

  if (Platform.OS === "web" && loading) return <Redirect href="/bienvenue" />;
  if (loading || reporte === null || (attendSuite && suite === undefined)) return <EcranDemarrage testID="ecran-chargement" />;

  if (!user) return <Redirect href="/bienvenue" />;
  if (user.role === "admin" || user.role === "superadmin") return <Redirect href="/admin" />;
  if (user.role === "livreur") return <Redirect href="/livreur" />;
  if (!user.telephone && !reporte) return <Redirect href="/telephone" />;
  return <Redirect href={(suite ?? "/menu") as any} />;
}
