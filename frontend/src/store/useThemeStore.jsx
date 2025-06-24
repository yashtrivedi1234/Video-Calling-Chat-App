import { create } from "zustand";

export const useThemeStore = create((set) => {
  let initialTheme = "coffee";
  if (typeof window !== "undefined") {
    initialTheme = localStorage.getItem("streamify-theme") || "coffee";
  }

  return {
    theme: initialTheme,
    setTheme: (theme) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("streamify-theme", theme);
      }
      set({ theme });
    },
  };
});