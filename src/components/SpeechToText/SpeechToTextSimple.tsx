import React, { useEffect } from "react";
import { useSpeechToText } from "../../hooks/useSpeechToText_simple";
import { useTranslation } from "react-i18next";
import styles from "./SpeechToText.module.css";

interface SpeechToTextProps {
  onTranscriptUpdate: (transcript: string) => void;
  language?: string;
  isDisabled?: boolean;
  clearTrigger?: number;
  stopTrigger?: number;
}

const SpeechToTextSimple: React.FC<SpeechToTextProps> = ({
  onTranscriptUpdate,
  language = "en-US",
  isDisabled = false,
  clearTrigger = 0,
  stopTrigger = 0,
}) => {
  const { t } = useTranslation();

  const {
    transcript,
    isListening,
    isSupported,
    toggleListening,
    clearTranscript,
    stopListening,
    error,
  } = useSpeechToText(language);

  // Clear transcript when clearTrigger changes
  useEffect(() => {
    if (clearTrigger > 0) {
      clearTranscript();
    }
  }, [clearTrigger, clearTranscript]);

  // Stop listening when stopTrigger changes
  useEffect(() => {
    if (stopTrigger > 0) {
      stopListening();
    }
  }, [stopTrigger, stopListening]);

  // Update parent component when transcript changes
  useEffect(() => {
    if (transcript.trim() && !isDisabled) {
      onTranscriptUpdate(transcript.trim());
    }
  }, [transcript, onTranscriptUpdate, isDisabled]);

  if (!isSupported) {
    return (
      <div className={styles.unsupportedContainer}>
        <button
          type="button"
          className={`${styles.micButton} ${styles.unsupported}`}
          title="Speech recognition not supported"
          disabled
        >
          🎤
        </button>
      </div>
    );
  }

  return (
    <div className={styles.speechContainer}>
      <button
        type="button"
        className={`${styles.micButton} ${
          isListening ? styles.listening : ""
        } ${isDisabled ? styles.disabled : ""}`}
        onClick={toggleListening}
        disabled={isDisabled}
        title={
          isListening ? "Click to stop listening" : "Click to start voice input"
        }
        style={{
          backgroundColor: isListening ? "#dc3545" : "#007acc",
          color: "white",
          border: isListening ? "3px solid #ff6b6b" : "2px solid #0056b3",
          transform: isListening ? "scale(1.1)" : "scale(1)",
          transition: "all 0.3s ease",
        }}
      >
        {isListening ? "🔴" : "🎤"}
      </button>

      {/* Status indicator */}
      {isListening && (
        <div className={styles.statusIndicator}>
          <div className={styles.pulseAnimation}></div>
          <span className={styles.statusText}>Listening...</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className={styles.errorContainer}>
          <span className={styles.errorText}>⚠️ {error}</span>
        </div>
      )}
    </div>
  );
};

export default SpeechToTextSimple;
