import React, { useState, useEffect, useRef } from "react";
import styles from "./QuestionPicker.module.css";

interface QuestionPickerProps {
  onQuestionSelect: (question: string) => void;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
}

type LanguageCode = "EN" | "FR" | "NL";

interface Question {
  text: string;
}

interface QuestionCategory {
  name: string;
  icon: string;
  questions: Question[];
}

interface LocalizedContent {
  title: string;
  categories: QuestionCategory[];
}

// Localized content for each language
const localizedQuestions: Record<LanguageCode, LocalizedContent> = {
  EN: {
    title: "Standard Questions",
    categories: [
      {
        name: "Inventory Management",
        icon: "📦",
        questions: [
          { text: "What products do we currently have in our inventory?" },
          { text: "Which products have low stock levels under 30 units?" },
          { text: "Show me all dairy products and their current stock levels" },
          { text: "What products do we get from Fresh Dairy Co.?" },
          { text: "List all products that need immediate restocking" },
          { text: "Show me inventory levels for all meat products" },
        ],
      },
      {
        name: "Sales Analysis",
        icon: "📊",
        questions: [
          { text: "What were our total sales for the last month?" },
          { text: "Show me all sales from the last 7 days" },
          { text: "What was our total revenue for the last month?" },
          { text: "Which products sold the most in the past two weeks?" },
          { text: "Compare this month's sales to last month" },
          { text: "What's our average daily revenue?" },
        ],
      },
      {
        name: "Category Performance",
        icon: "📈",
        questions: [
          {
            text: "How are our different product categories performing in sales?",
          },
          { text: "Show me sales by category for the last 30 days" },
          { text: "Which category generates the most revenue?" },
          { text: "Compare dairy sales versus meat sales for this month" },
          { text: "What's the profit margin for each category?" },
          { text: "Show category performance as a pie chart" },
        ],
      },
      {
        name: "Business Intelligence",
        icon: "🎯",
        questions: [
          { text: "What are our best selling products based on recent sales?" },
          { text: "Which suppliers provide our most profitable products?" },
          { text: "Show me products that might need restocking soon" },
          { text: "What's the average sale amount per transaction?" },
          { text: "Identify slow-moving inventory items" },
          { text: "Which products have the highest profit margins?" },
        ],
      },
      {
        name: "Business Scenarios",
        icon: "💼",
        questions: [
          {
            text: "We're planning a promotion - which products have good stock levels?",
          },
          {
            text: "I need to contact suppliers for restocking - which products are running low?",
          },
          {
            text: "Show me our revenue trends - are we performing well this month?",
          },
          {
            text: "Which products should we feature in our weekly ads based on stock and sales?",
          },
          { text: "Help me plan next month's inventory orders" },
          { text: "What seasonal trends should we prepare for?" },
        ],
      },
      {
        name: "Table Only Examples",
        icon: "📋",
        questions: [
          { text: "Show me all dairy products table only" },
          { text: "List inventory no chart" },
          { text: "What products do we have just table" },
          { text: "Display all suppliers table format" },
          { text: "Show low stock items table only" },
        ],
      },
      {
        name: "Chart Only Examples",
        icon: "📊",
        questions: [
          { text: "Sales by category chart only" },
          { text: "Revenue trends no table" },
          { text: "Product distribution just graph" },
          { text: "Monthly sales comparison chart only" },
          { text: "Inventory levels visualization only" },
        ],
      },
      {
        name: "Specific Charts",
        icon: "📉",
        questions: [
          { text: "Sales by category as a pie chart" },
          { text: "Revenue over time line chart" },
          { text: "Inventory comparison bar graph" },
          { text: "Show category performance pie chart" },
          { text: "Create a donut chart for product distribution" },
          { text: "Display sales trends as area chart" },
        ],
      },
    ],
  },
  FR: {
    title: "Questions Standards",
    categories: [
      {
        name: "Gestion des Stocks",
        icon: "📦",
        questions: [
          {
            text: "Quels produits avons-nous actuellement dans notre inventaire ?",
          },
          {
            text: "Quels produits ont des niveaux de stock faibles sous 30 unités ?",
          },
          {
            text: "Montrez-moi tous les produits laitiers et leurs niveaux de stock actuels",
          },
          { text: "Quels produits obtenons-nous de Fresh Dairy Co. ?" },
          {
            text: "Listez tous les produits qui nécessitent un réapprovisionnement immédiat",
          },
          {
            text: "Montrez-moi les niveaux d'inventaire pour tous les produits de viande",
          },
        ],
      },
      {
        name: "Analyse des Ventes",
        icon: "📊",
        questions: [
          { text: "Quelles ont été nos ventes totales pour le mois dernier ?" },
          { text: "Montrez-moi toutes les ventes des 7 derniers jours" },
          {
            text: "Quel a été notre chiffre d'affaires total pour le mois dernier ?",
          },
          {
            text: "Quels produits se sont le plus vendus ces deux dernières semaines ?",
          },
          { text: "Comparez les ventes de ce mois à celles du mois dernier" },
          { text: "Quel est notre chiffre d'affaires quotidien moyen ?" },
        ],
      },
      {
        name: "Performance des Catégories",
        icon: "📈",
        questions: [
          {
            text: "Comment se portent nos différentes catégories de produits en termes de ventes ?",
          },
          {
            text: "Montrez-moi les ventes par catégorie pour les 30 derniers jours",
          },
          { text: "Quelle catégorie génère le plus de revenus ?" },
          {
            text: "Comparez les ventes de produits laitiers versus les ventes de viande pour ce mois",
          },
          { text: "Quelle est la marge bénéficiaire pour chaque catégorie ?" },
          {
            text: "Montrez la performance des catégories sous forme de graphique en secteurs",
          },
        ],
      },
      {
        name: "Intelligence d'Affaires",
        icon: "🎯",
        questions: [
          {
            text: "Quels sont nos produits les plus vendus basés sur les ventes récentes ?",
          },
          {
            text: "Quels fournisseurs proposent nos produits les plus rentables ?",
          },
          {
            text: "Montrez-moi les produits qui pourraient nécessiter un réapprovisionnement bientôt",
          },
          { text: "Quel est le montant moyen de vente par transaction ?" },
          { text: "Identifiez les articles d'inventaire à rotation lente" },
          {
            text: "Quels produits ont les marges bénéficiaires les plus élevées ?",
          },
        ],
      },
      {
        name: "Scénarios d'Affaires",
        icon: "💼",
        questions: [
          {
            text: "Nous planifions une promotion - quels produits ont de bons niveaux de stock ?",
          },
          {
            text: "Je dois contacter les fournisseurs pour le réapprovisionnement - quels produits sont en rupture ?",
          },
          {
            text: "Montrez-moi nos tendances de revenus - performons-nous bien ce mois ?",
          },
          {
            text: "Quels produits devrions-nous mettre en avant dans nos publicités hebdomadaires basé sur le stock et les ventes ?",
          },
          {
            text: "Aidez-moi à planifier les commandes d'inventaire du mois prochain",
          },
          { text: "Quelles tendances saisonnières devrions-nous préparer ?" },
        ],
      },
      {
        name: "Exemples Tableau Seulement",
        icon: "📋",
        questions: [
          { text: "Montrez-moi tous les produits laitiers tableau seulement" },
          { text: "Listez l'inventaire sans graphique" },
          { text: "Quels produits avons-nous juste tableau" },
          { text: "Affichez tous les fournisseurs format tableau" },
          { text: "Montrez les articles en stock faible tableau seulement" },
        ],
      },
      {
        name: "Exemples Graphique Seulement",
        icon: "📊",
        questions: [
          { text: "Ventes par catégorie graphique seulement" },
          { text: "Tendances des revenus sans tableau" },
          { text: "Distribution des produits juste graphique" },
          { text: "Comparaison des ventes mensuelles graphique seulement" },
          { text: "Visualisation des niveaux d'inventaire seulement" },
        ],
      },
      {
        name: "Graphiques Spécifiques",
        icon: "📉",
        questions: [
          { text: "Ventes par catégorie sous forme de graphique en secteurs" },
          { text: "Revenus dans le temps graphique linéaire" },
          { text: "Graphique à barres de comparaison d'inventaire" },
          {
            text: "Montrez la performance des catégories graphique en secteurs",
          },
          {
            text: "Créez un graphique en beignet pour la distribution des produits",
          },
          {
            text: "Affichez les tendances des ventes sous forme de graphique en aires",
          },
        ],
      },
    ],
  },
  NL: {
    title: "Standaard Vragen",
    categories: [
      {
        name: "Voorraadbeheer",
        icon: "📦",
        questions: [
          { text: "Welke producten hebben we momenteel in onze voorraad?" },
          {
            text: "Welke producten hebben lage voorraadniveaus onder 30 eenheden?",
          },
          {
            text: "Laat me alle zuivelproducten en hun huidige voorraadniveaus zien",
          },
          { text: "Welke producten krijgen we van Fresh Dairy Co.?" },
          {
            text: "Lijst alle producten die onmiddellijke herbevoorrading nodig hebben",
          },
          { text: "Toon me voorraadniveaus voor alle vleesproducten" },
        ],
      },
      {
        name: "Verkoopanalyse",
        icon: "📊",
        questions: [
          { text: "Wat waren onze totale verkopen voor de afgelopen maand?" },
          { text: "Laat me alle verkopen van de afgelopen 7 dagen zien" },
          { text: "Wat was onze totale omzet voor de afgelopen maand?" },
          {
            text: "Welke producten verkochten het meest in de afgelopen twee weken?",
          },
          { text: "Vergelijk de verkopen van deze maand met vorige maand" },
          { text: "Wat is onze gemiddelde dagelijkse omzet?" },
        ],
      },
      {
        name: "Categorieprestaties",
        icon: "📈",
        questions: [
          {
            text: "Hoe presteren onze verschillende productcategorieën qua verkoop?",
          },
          {
            text: "Laat me verkopen per categorie zien voor de afgelopen 30 dagen",
          },
          { text: "Welke categorie genereert de meeste omzet?" },
          {
            text: "Vergelijk zuivelverkopen versus vleesverkopen voor deze maand",
          },
          { text: "Wat is de winstmarge voor elke categorie?" },
          { text: "Toon categorieprestaties als een taartdiagram" },
        ],
      },
      {
        name: "Business Intelligence",
        icon: "🎯",
        questions: [
          {
            text: "Wat zijn onze best verkopende producten gebaseerd op recente verkopen?",
          },
          {
            text: "Welke leveranciers leveren onze meest winstgevende producten?",
          },
          {
            text: "Laat me producten zien die binnenkort herbevoorrading nodig hebben",
          },
          { text: "Wat is het gemiddelde verkoopbedrag per transactie?" },
          { text: "Identificeer langzaam bewegende voorraadartikelen" },
          { text: "Welke producten hebben de hoogste winstmarges?" },
        ],
      },
      {
        name: "Bedrijfsscenario's",
        icon: "💼",
        questions: [
          {
            text: "We plannen een promotie - welke producten hebben goede voorraadniveaus?",
          },
          {
            text: "Ik moet leveranciers contacteren voor herbevoorrading - welke producten raken op?",
          },
          {
            text: "Laat me onze omzettrends zien - presteren we goed deze maand?",
          },
          {
            text: "Welke producten moeten we uitlichten in onze wekelijkse advertenties op basis van voorraad en verkopen?",
          },
          {
            text: "Help me de voorraadbestellingen van volgende maand te plannen",
          },
          { text: "Voor welke seizoenstrends moeten we ons voorbereiden?" },
        ],
      },
      {
        name: "Alleen Tabel Voorbeelden",
        icon: "📋",
        questions: [
          { text: "Laat me alle zuivelproducten alleen tabel zien" },
          { text: "Lijst voorraad geen grafiek" },
          { text: "Welke producten hebben we alleen tabel" },
          { text: "Toon alle leveranciers tabelformaat" },
          { text: "Laat lage voorraadartikelen alleen tabel zien" },
        ],
      },
      {
        name: "Alleen Grafiek Voorbeelden",
        icon: "📊",
        questions: [
          { text: "Verkopen per categorie alleen grafiek" },
          { text: "Omzettrends geen tabel" },
          { text: "Productdistributie alleen grafiek" },
          { text: "Maandelijkse verkoopvergelijking alleen grafiek" },
          { text: "Voorraadniveaus visualisatie alleen" },
        ],
      },
      {
        name: "Specifieke Grafieken",
        icon: "📉",
        questions: [
          { text: "Verkopen per categorie als taartdiagram" },
          { text: "Omzet in de tijd lijndiagram" },
          { text: "Voorraadvergelijking staafdiagram" },
          { text: "Toon categorieprestaties taartdiagram" },
          { text: "Maak een donutdiagram voor productdistributie" },
          { text: "Toon verkooptrends als vlakdiagram" },
        ],
      },
    ],
  },
};

const QuestionPicker: React.FC<QuestionPickerProps> = ({
  onQuestionSelect,
  onClose,
  anchorElement,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("EN");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load saved language preference on component mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem(
      "questionPicker-language"
    ) as LanguageCode;
    if (savedLanguage && ["EN", "FR", "NL"].includes(savedLanguage)) {
      setSelectedLanguage(savedLanguage);
    }
  }, []);

  // Save language preference when it changes
  const handleLanguageChange = (language: LanguageCode) => {
    setSelectedLanguage(language);
    localStorage.setItem("questionPicker-language", language);
  };

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

  // Reset active category when language changes
  useEffect(() => {
    setActiveCategory(0);
  }, [selectedLanguage]);

  const currentContent = localizedQuestions[selectedLanguage];
  const currentQuestions =
    currentContent.categories[activeCategory]?.questions || [];

  const getLanguageFlag = (language: LanguageCode): string => {
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

  const getLanguageLabel = (language: LanguageCode): string => {
    switch (language) {
      case "EN":
        return "US English";
      case "FR":
        return "Français";
      case "NL":
        return "Nederlands";
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
        <h4>📝 {currentContent.title}</h4>
        <div className={styles.languageFilter}>
          <select
            value={selectedLanguage}
            onChange={(e) =>
              handleLanguageChange(e.target.value as LanguageCode)
            }
            className={styles.languageSelect}
          >
            <option value="EN">
              {getLanguageFlag("EN")} {getLanguageLabel("EN")}
            </option>
            <option value="FR">
              {getLanguageFlag("FR")} {getLanguageLabel("FR")}
            </option>
            <option value="NL">
              {getLanguageFlag("NL")} {getLanguageLabel("NL")}
            </option>
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
          {currentContent.categories.map((category, index) => (
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
              {currentContent.categories[activeCategory]?.icon}
            </span>
            <span className={styles.categoryHeaderName}>
              {currentContent.categories[activeCategory]?.name}
            </span>
            <span className={styles.questionCount}>
              ({currentQuestions.length} question
              {currentQuestions.length !== 1 ? "s" : ""})
            </span>
          </div>

          <div className={styles.questionsList}>
            {currentQuestions.length > 0 ? (
              currentQuestions.map((question, index) => (
                <button
                  key={index}
                  className={styles.questionButton}
                  onClick={() => handleQuestionClick(question.text)}
                  title={`Click to use this question`}
                >
                  <span className={styles.languageFlag}>
                    {getLanguageFlag(selectedLanguage)}
                  </span>
                  <span className={styles.questionText}>{question.text}</span>
                </button>
              ))
            ) : (
              <div className={styles.noQuestions}>
                <span className={styles.noQuestionsIcon}>🤷‍♂️</span>
                <span className={styles.noQuestionsText}>
                  No questions available in this category
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
