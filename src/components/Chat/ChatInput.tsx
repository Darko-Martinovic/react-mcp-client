import React from "react";
import { useTranslation } from "react-i18next";
import EmojiPicker from "../EmojiPicker";
import QuestionPicker from "../QuestionPicker";
import SpeechToTextSimple from "../SpeechToText/SpeechToTextSimple";
import styles from "./Chat.module.css";

interface ChatInputProps {
  input: string;
  loading: boolean;
  showEmojiPicker: boolean;
  showQuestionPicker: boolean;
  clearSpeechTrigger: number;
  stopSpeechTrigger: number;
  inputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onEmojiSelect: (emoji: string) => void;
  onQuestionSelect: (question: string) => void;
  onTranscriptUpdate: (transcript: string) => void;
  onToggleEmojiPicker: () => void;
  onToggleQuestionPicker: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  loading,
  showEmojiPicker,
  showQuestionPicker,
  clearSpeechTrigger,
  stopSpeechTrigger,
  inputRef,
  onInputChange,
  onSubmit,
  onEmojiSelect,
  onQuestionSelect,
  onTranscriptUpdate,
  onToggleEmojiPicker,
  onToggleQuestionPicker,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.inputArea}>
      <form onSubmit={onSubmit} className={styles.inputForm}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={t("app.inputPlaceholder") || "Type your message..."}
          disabled={loading}
          className={styles.inputField}
        />
        <button
          type="button"
          onClick={onToggleEmojiPicker}
          className={styles.emojiButton}
          disabled={loading}
        >
          😊
        </button>
        <button
          type="button"
          onClick={onToggleQuestionPicker}
          className={styles.questionButton}
          disabled={loading}
        >
          💡
        </button>
        <SpeechToTextSimple
          onTranscriptUpdate={onTranscriptUpdate}
          clearTrigger={clearSpeechTrigger}
          stopTrigger={stopSpeechTrigger}
          isDisabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={styles.sendButton}
        >
          {loading ? "⏳" : "🚀"}
        </button>
      </form>

      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={onEmojiSelect}
          onClose={() => onToggleEmojiPicker()}
        />
      )}

      {showQuestionPicker && (
        <QuestionPicker
          onQuestionSelect={onQuestionSelect}
          onClose={() => onToggleQuestionPicker()}
        />
      )}
    </div>
  );
};
