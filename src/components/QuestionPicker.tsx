import React, { useState, useEffect, useRef } from "react";
import styles from "./QuestionPicker.module.css";

interface QuestionPickerProps {
  onQuestionSelect: (question: string) => void;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
}

interface Question {
  text: string;
  language: "EN" | "FR" | "NL";
}

interface QuestionCategory {
  name: string;
  icon: string;
  questions: Question[];
}

const questionCategories: QuestionCategory[] = [
  {
    name: "Inventory Management",
    icon: "📦",
    questions: [
      {
        text: "What products do we currently have in our inventory?",
        language: "EN",
      },
      {
        text: "Which products have low stock levels under 30 units?",
        language: "EN",
      },
      {
        text: "Show me all dairy products and their current stock levels",
        language: "EN",
      },
      { text: "What products do we get from Fresh Dairy Co.?", language: "EN" },
    ],
  },
  {
    name: "Sales Analysis",
    icon: "📊",
    questions: [
      { text: "What were our total sales for the last month?", language: "EN" },
      { text: "Show me all sales from the last 7 days", language: "EN" },
      {
        text: "What was our total revenue for the last month?",
        language: "EN",
      },
      {
        text: "Which products sold the most in the past two weeks?",
        language: "EN",
      },
    ],
  },
  {
    name: "Category Performance",
    icon: "📈",
    questions: [
      {
        text: "How are our different product categories performing in sales?",
        language: "EN",
      },
      {
        text: "Comment se portent nos différentes catégories de produits en termes de ventes ? Veuillez également inclure un graphique en barres.",
        language: "FR",
      },
      {
        text: "Hoe presteren onze verschillende productcategorieën qua verkoop? Gelieve ook een staafdiagram toe te voegen.",
        language: "NL",
      },
      {
        text: "Show me sales by category for the last 30 days",
        language: "EN",
      },
      { text: "Which category generates the most revenue?", language: "EN" },
      {
        text: "Compare dairy sales versus meat sales for this month",
        language: "EN",
      },
    ],
  },
  {
    name: "Business Intelligence",
    icon: "🎯",
    questions: [
      {
        text: "What are our best selling products based on recent sales?",
        language: "EN",
      },
      {
        text: "Which suppliers provide our most profitable products?",
        language: "EN",
      },
      {
        text: "Show me products that might need restocking soon",
        language: "EN",
      },
      {
        text: "What's the average sale amount per transaction?",
        language: "EN",
      },
    ],
  },
  {
    name: "Business Scenarios",
    icon: "💼",
    questions: [
      {
        text: "We're planning a promotion - which products have good stock levels?",
        language: "EN",
      },
      {
        text: "I need to contact suppliers for restocking - which products are running low?",
        language: "EN",
      },
      {
        text: "Show me our revenue trends - are we performing well this month?",
        language: "EN",
      },
      {
        text: "Which products should we feature in our weekly ads based on stock and sales?",
        language: "EN",
      },
    ],
  },
  {
    name: "Table Only Examples",
    icon: "📋",
    questions: [
      { text: "Show me all dairy products table only", language: "EN" },
      { text: "List inventory no chart", language: "EN" },
      { text: "What products do we have just table", language: "EN" },
    ],
  },
  {
    name: "Chart Only Examples",
    icon: "📊",
    questions: [
      { text: "Sales by category chart only", language: "EN" },
      { text: "Revenue trends no table", language: "EN" },
      { text: "Product distribution just graph", language: "EN" },
    ],
  },
  {
    name: "Specific Charts",
    icon: "📉",
    questions: [
      { text: "Sales by category as a pie chart", language: "EN" },
      { text: "Revenue over time line chart", language: "EN" },
      { text: "Inventory comparison bar graph", language: "EN" },
      { text: "Show category performance pie chart", language: "EN" },
    ],
  },
];

const QuestionPicker: React.FC<QuestionPickerProps> = ({
  onQuestionSelect,
  onClose,
  anchorElement,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<
    "ALL" | "EN" | "FR" | "NL"
  >("ALL");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        anchorElement &&
        !anchorElement.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, anchorElement]);

  const filteredQuestions = questionCategories[activeCategory].questions.filter(
    (question) =>
      selectedLanguage === "ALL" || question.language === selectedLanguage
  );

  const getLanguageFlag = (language: "EN" | "FR" | "NL"): string => {
    switch (language) {
      case "EN":
        return "🇺🇸";
      case "FR":
        return "🇫🇷";
      case "NL":
        return "🇳🇱";
      default:
        return "";
    }
  };

  const handleQuestionClick = (question: string) => {
    onQuestionSelect(question);
    onClose();
  };

  return (
    <div className={styles.questionPicker} ref={pickerRef}>
      <div className={styles.questionPickerHeader}>
        <h4>📝 Standard Questions</h4>
        <div className={styles.languageFilter}>
          <select
            value={selectedLanguage}
            onChange={(e) =>
              setSelectedLanguage(e.target.value as "ALL" | "EN" | "FR" | "NL")
            }
            className={styles.languageSelect}
          >
            <option value="ALL">🌍 All Languages</option>
            <option value="EN">🇺🇸 English</option>
            <option value="FR">🇫🇷 Français</option>
            <option value="NL">🇳🇱 Nederlands</option>
          </select>
        </div>
        <button
          className={styles.questionPickerClose}
          onClick={onClose}
          title="Close"
        >
          ×
        </button>
      </div>

      <div className={styles.questionPickerContent}>
        <div className={styles.categoriesGrid}>
          {questionCategories.map((category, index) => (
            <button
              key={index}
              className={`${styles.categoryButton} ${
                activeCategory === index ? styles.active : ""
              }`}
              onClick={() => setActiveCategory(index)}
              title={category.name}
            >
              <span className={styles.categoryIcon}>{category.icon}</span>
              <span className={styles.categoryName}>{category.name}</span>
            </button>
          ))}
        </div>

        <div className={styles.questionsGrid}>
          <div className={styles.categoryHeader}>
            <span className={styles.categoryHeaderIcon}>
              {questionCategories[activeCategory].icon}
            </span>
            <span className={styles.categoryHeaderName}>
              {questionCategories[activeCategory].name}
            </span>
            <span className={styles.questionCount}>
              ({filteredQuestions.length} question
              {filteredQuestions.length !== 1 ? "s" : ""})
            </span>
          </div>

          <div className={styles.questionsList}>
            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((question, index) => (
                <button
                  key={index}
                  className={styles.questionButton}
                  onClick={() => handleQuestionClick(question.text)}
                  title={`Click to use this question (${question.language})`}
                >
                  <span className={styles.languageFlag}>
                    {getLanguageFlag(question.language)}
                  </span>
                  <span className={styles.questionText}>{question.text}</span>
                </button>
              ))
            ) : (
              <div className={styles.noQuestions}>
                <span className={styles.noQuestionsIcon}>🤷‍♂️</span>
                <span className={styles.noQuestionsText}>
                  No questions available for {selectedLanguage} in this category
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionPicker;
