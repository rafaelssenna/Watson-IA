import { useEffect } from "react";
import { router } from "expo-router";

// Redirect to persona-edit (single persona configuration)
export default function PersonaScreen() {
  useEffect(() => {
    router.replace("/settings/persona-edit");
  }, []);

  return null;
}
