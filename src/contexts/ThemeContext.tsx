import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem("app-theme") as Theme;
    console.log("🎨 ThemeProvider initializing:", {
      savedTheme,
      defaultTheme: savedTheme || "light",
    });
    return savedTheme || "light";
  });

  const toggleTheme = () => {
    console.log("🔄 Theme toggle requested, current theme:", theme);
    const newTheme: Theme = theme === "light" ? "dark" : "light";
    console.log("🎯 Setting new theme to:", newTheme);
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
    console.log(
      "💾 Theme saved to localStorage:",
      localStorage.getItem("app-theme")
    );
  };

  useEffect(() => {
    console.log("🎨 Theme useEffect triggered, applying theme:", theme);
    // Apply theme to document root in multiple ways for reliability
    const html = document.documentElement;

    // Before changes
    console.log("📊 Before theme application:", {
      currentDataTheme: html.getAttribute("data-theme"),
      currentClassName: html.className,
      computedBgPrimary:
        getComputedStyle(html).getPropertyValue("--bg-primary"),
      computedAccentPrimary:
        getComputedStyle(html).getPropertyValue("--accent-primary"),
    });

    html.setAttribute("data-theme", theme);
    html.className = theme;

    // After changes
    setTimeout(() => {
      console.log("📊 After theme application:", {
        newDataTheme: html.getAttribute("data-theme"),
        newClassName: html.className,
        computedBgPrimary:
          getComputedStyle(html).getPropertyValue("--bg-primary"),
        computedAccentPrimary:
          getComputedStyle(html).getPropertyValue("--accent-primary"),
      });
    }, 100);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
