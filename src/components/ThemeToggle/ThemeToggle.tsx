import React, { useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./ThemeToggle.module.css";

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    console.log("🎨 ThemeToggle render effect, current theme:", theme);
    console.log(
      "🎨 ThemeToggle icon will show:",
      theme === "light" ? "🌙 (moon)" : "☀️ (sun)"
    );
  }, [theme]);

  const handleClick = () => {
    console.log("🖱️ ThemeToggle clicked!");
    console.log("📊 Current document state:", {
      dataTheme: document.documentElement.getAttribute("data-theme"),
      className: document.documentElement.className,
      currentTheme: theme,
    });
    toggleTheme();
  };

  return (
    <button
      onClick={handleClick}
      className={styles.themeToggle}
      title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
};

export default ThemeToggle;
