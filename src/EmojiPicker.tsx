import React, { useState, useRef, useEffect } from 'react';
import './EmojiPicker.css';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Emoji categories with their emojis
  const emojiCategories = {
    smileys: {
      name: 'Smileys & People',
      icon: '😀',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
        '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
        '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
        '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
        '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
        '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'
      ]
    },
    animals: {
      name: 'Animals & Nature',
      icon: '🐶',
      emojis: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
        '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
        '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
        '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
        '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕'
      ]
    },
    food: {
      name: 'Food & Drink',
      icon: '🍎',
      emojis: [
        '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
        '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
        '🥦', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠',
        '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇',
        '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪'
      ]
    },
    activities: {
      name: 'Activities',
      icon: '⚽',
      emojis: [
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
        '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
        '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️',
        '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺',
        '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🏃'
      ]
    },
    objects: {
      name: 'Objects',
      icon: '💎',
      emojis: [
        '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
        '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
        '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
        '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
        '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴'
      ]
    },
    symbols: {
      name: 'Symbols',
      icon: '❤️',
      emojis: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
        '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
        '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
        '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳'
      ]
    }
  };

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={pickerRef} className="emoji-picker">
      <div className="emoji-picker-header">
        <h4>Pick an emoji</h4>
        <button onClick={onClose} className="emoji-picker-close">
          ×
        </button>
      </div>
      
      <div className="emoji-picker-categories">
        {Object.entries(emojiCategories).map(([key, category]) => (
          <button
            key={key}
            className={`emoji-category-tab ${activeCategory === key ? 'active' : ''}`}
            onClick={() => setActiveCategory(key)}
            title={category.name}
          >
            {category.icon}
          </button>
        ))}
      </div>

      <div className="emoji-picker-content">
        <div className="emoji-category-name">
          {emojiCategories[activeCategory as keyof typeof emojiCategories].name}
        </div>
        
        <div className="emoji-grid">
          {emojiCategories[activeCategory as keyof typeof emojiCategories].emojis.map((emoji, index) => (
            <button
              key={index}
              className="emoji-button"
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
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
