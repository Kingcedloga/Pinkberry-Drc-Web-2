import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";

import { EcranDemarrage } from "@/src/components/EcranDemarrage";
import { useAuth } from "@/src/auth";
import { CLE_TEL_REPORTE } from "@/src/prefs";
import { useTheme } from "@/src/theme-contexte";
import { storage } from "@/src/utils/storage";

export default function Index() {
  useTheme();
  const { user, loading } = useAuth();
  const [reporte, setReporte] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => setReporte(!!(await storage.getItem<string>(CLE_TEL_REPORTE, ""))))();
  }, []);

  if (loading || reporte === null) return <EcranDemarrage testID="ecran-chargement" />;

  if (!user) return <Redirect href="/bienvenue" />;
  if (user.role === "admin" || user.role === "superadmin") return <Redirect href="/dashboard" />;
  if (user.role === "livreur") return <Redirect href="/courses" />;
  if (!user.telephone && !reporte) return <Redirect href="/telephone" />;
  return <Redirect href="/accueil" />;
}
