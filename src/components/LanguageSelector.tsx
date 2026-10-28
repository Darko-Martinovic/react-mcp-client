import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getAvailableLanguages } from "../i18n/i18n";
import styles from "./LanguageSelector.module.css";

interface LanguageSelectorProps {
  onLanguageChange?: (language: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onLanguageChange,
}) => {
  const { i18n, t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const languages = getAvailableLanguages();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showDropdown]);

  const handleLanguageChange = async (languageCode: string) => {
    await i18n.changeLanguage(languageCode);
    setShowDropdown(false);

    // Notify parent component about language change
    if (onLanguageChange) {
      onLanguageChange(languageCode);
    }
  };

  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

  return (
    <div ref={dropdownRef} className={styles.languageSelector}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={styles.languageButton}
        title={t("language.selector")}
      >
        <span className={styles.flag}>{currentLanguage.flag}</span>
        <span className={styles.languageName}>{currentLanguage.name}</span>
        <span className={styles.arrow}>▼</span>
      </button>

      {showDropdown && (
        <div className={styles.languageDropdown}>
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`${styles.languageOption} ${
                i18n.language === language.code ? styles.active : ""
              }`}
            >
              <span className={styles.flag}>{language.flag}</span>
              <span className={styles.languageName}>{language.name}</span>
              {i18n.language === language.code && (
                <span className={styles.checkmark}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
