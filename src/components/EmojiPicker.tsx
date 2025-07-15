import React, { useState, useEffect, useRef } from "react";
import styles from "./EmojiPicker.module.css";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
}

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const emojiCategories: EmojiCategory[] = [
  {
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🤧",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "😎",
      "🤓",
      "🧐",
    ],
  },
  {
    name: "Animals",
    icon: "🐶",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐽",
      "🐸",
      "🐵",
      "🙊",
      "🙉",
      "🙈",
      "🐒",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🐣",
      "🐥",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🐛",
      "🦋",
      "🐌",
      "🐞",
      "🐜",
      "🦟",
      "🦗",
      "🕷",
      "🦂",
      "🐢",
      "🐍",
      "🦎",
      "🦖",
      "🦕",
      "🐙",
      "🦑",
      "🦐",
      "🦞",
      "🦀",
      "🐡",
      "🐠",
      "🐟",
      "🐬",
      "🐳",
      "🐋",
      "🦈",
      "🐊",
      "🐅",
      "🐆",
      "🦓",
      "🦍",
      "🦧",
      "🐘",
      "🦛",
      "🦏",
      "🐪",
      "🐫",
    ],
  },
  {
    name: "Food",
    icon: "🍎",
    emojis: [
      "🍎",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶",
      "🫑",
      "🌽",
      "🥕",
      "🫒",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🥖",
      "🍞",
      "🥨",
      "🥯",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🦴",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
      "🥪",
      "🥙",
      "🧆",
      "🌮",
      "🌯",
      "🫔",
      "🥗",
      "🥘",
      "🫕",
      "🍝",
      "🍜",
      "🍲",
      "🍛",
      "🍣",
      "🍱",
      "🥟",
      "🦪",
      "🍤",
      "🍙",
      "🍚",
      "🍘",
      "🍥",
    ],
  },
  {
    name: "Activities",
    icon: "⚽",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🪃",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛷",
      "⛸",
      "🥌",
      "🎿",
      "⛷",
      "🏂",
      "🪂",
      "🏋‍♀️",
      "🏋‍♂️",
      "🤼‍♀️",
      "🤼‍♂️",
      "🤸‍♀️",
      "🤸‍♂️",
      "⛹‍♀️",
      "⛹‍♂️",
      "🤺",
      "🤾‍♀️",
      "🤾‍♂️",
      "🏌‍♀️",
      "🏌‍♂️",
      "🏇",
      "🧘‍♀️",
      "🧘‍♂️",
      "🏄‍♀️",
      "🏄‍♂️",
      "🏊‍♀️",
      "🏊‍♂️",
      "🤽‍♀️",
      "🤽‍♂️",
      "🚣‍♀️",
      "🚣‍♂️",
      "🧗‍♀️",
      "🧗‍♂️",
      "🚵‍♀️",
      "🚵‍♂️",
      "🚴‍♀️",
      "🚴‍♂️",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
      "🏅",
      "🎖",
    ],
  },
  {
    name: "Travel",
    icon: "🚗",
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🛻",
      "🚚",
      "🚛",
      "🚜",
      "🏍",
      "🛵",
      "🚲",
      "🛴",
      "🛹",
      "🛼",
      "🚁",
      "🛸",
      "🚀",
      "✈️",
      "🛩",
      "🛫",
      "🛬",
      "🪂",
      "⛵",
      "🚤",
      "🛥",
      "🛳",
      "⛴",
      "🚢",
      "⚓",
      "⛽",
      "🚧",
      "🚦",
      "🚥",
      "🗺",
      "🗿",
      "🗽",
      "🗼",
      "🏰",
      "🏯",
      "🏟",
      "🎡",
      "🎢",
      "🎠",
      "⛲",
      "⛱",
      "🏖",
      "🏝",
      "🏜",
      "🌋",
      "⛰",
      "🏔",
      "🗻",
      "🏕",
      "⛺",
      "🏠",
      "🏡",
      "🏘",
      "🏚",
      "🏗",
      "🏭",
      "🏢",
      "🏬",
      "🏣",
      "🏤",
      "🏥",
      "🏦",
    ],
  },
  {
    name: "Objects",
    icon: "⌚",
    emojis: [
      "⌚",
      "📱",
      "📲",
      "💻",
      "⌨",
      "🖥",
      "🖨",
      "🖱",
      "🖲",
      "🕹",
      "🗜",
      "💽",
      "💾",
      "💿",
      "📀",
      "📼",
      "📷",
      "📸",
      "📹",
      "🎥",
      "📽",
      "🎞",
      "📞",
      "☎️",
      "📟",
      "📠",
      "📺",
      "📻",
      "🎙",
      "🎚",
      "🎛",
      "🧭",
      "⏱",
      "⏲",
      "⏰",
      "🕰",
      "⏳",
      "⌛",
      "📡",
      "🔋",
      "🔌",
      "💡",
      "🔦",
      "🕯",
      "🪔",
      "🧯",
      "🛢",
      "💸",
      "💵",
      "💴",
      "💶",
      "💷",
      "🪙",
      "💰",
      "💳",
      "💎",
      "⚖",
      "🪜",
      "🧰",
      "🔧",
      "🔨",
      "⚒",
      "🛠",
      "⛏",
      "🔩",
      "⚙",
      "🧱",
      "⛓",
      "🧲",
      "🔫",
      "💣",
      "🧨",
    ],
  },
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiSelect,
  onClose,
  anchorElement,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
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

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  const currentCategory = emojiCategories[activeCategory];

  return (
    <div className={styles.emojiPicker} ref={pickerRef}>
      <div className={styles.emojiPickerHeader}>
        <h4>Pick an emoji</h4>
        <button
          onClick={onClose}
          className={styles.emojiPickerClose}
          aria-label="Close emoji picker"
        >
          ×
        </button>
      </div>

      <div className={styles.emojiPickerCategories}>
        {emojiCategories.map((category, index) => (
          <button
            key={index}
            onClick={() => setActiveCategory(index)}
            className={`${styles.emojiCategoryTab} ${
              activeCategory === index ? styles.active : ""
            }`}
            title={category.name}
          >
            {category.icon}
          </button>
        ))}
      </div>

      <div className={styles.emojiPickerContent}>
        <div className={styles.emojiCategoryName}>{currentCategory.name}</div>
        <div className={styles.emojiGrid}>
          {currentCategory.emojis.map((emoji, index) => (
            <button
              key={index}
              onClick={() => handleEmojiClick(emoji)}
              className={styles.emojiButton}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;
