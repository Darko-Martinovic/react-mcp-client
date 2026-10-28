import React from "react";
import { useTranslation } from "react-i18next";
import SpeechToTextSimple from "../SpeechToText/SpeechToTextSimple";
import styles from "./Chat.module.css";

interface ChatInputProps {
  input: string;
  loading: boolean;
  clearSpeechTrigger: number;
  stopSpeechTrigger: number;
  inputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onTranscriptUpdate: (transcript: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  loading,
  clearSpeechTrigger,
  stopSpeechTrigger,
  inputRef,
  onInputChange,
  onSubmit,
  onTranscriptUpdate,
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
    </div>
  );
};
