import React, { useEffect } from "react";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import { useTranslation } from "react-i18next";
import styles from "./SpeechToText.module.css";

interface SpeechToTextProps {
  onTranscriptUpdate: (transcript: string) => void;
  language?: string;
  isDisabled?: boolean;
}

const SpeechToText: React.FC<SpeechToTextProps> = ({
  onTranscriptUpdate,
  language = "en-US",
  isDisabled = false,
}) => {
  const { t } = useTranslation();

  const {
    transcript,
    isListening,
    isSupported,
    toggleListening,
    clearTranscript,
    error,
    confidence,
  } = useSpeechToText(language);

  // Update parent component when transcript changes
  useEffect(() => {
    if (transcript.trim()) {
      onTranscriptUpdate(transcript.trim());
    }
  }, [transcript, onTranscriptUpdate]);

  // Clear transcript when listening stops and transcript is sent
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      // Small delay to ensure the transcript is processed
      const timer = setTimeout(() => {
        clearTranscript();
      }, 1000); // Increased delay to 1 second
      return () => clearTimeout(timer);
    }
  }, [isListening, transcript, clearTranscript]);

  if (!isSupported) {
    return (
      <div className={styles.unsupportedContainer}>
        <button
          className={`${styles.micButton} ${styles.unsupported}`}
          title={
            t?.("speech.unsupported") ||
            "Speech recognition not supported in this browser"
          }
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
        className={`${styles.micButton} ${
          isListening ? styles.listening : ""
        } ${isDisabled ? styles.disabled : ""}`}
        onClick={toggleListening}
        disabled={isDisabled}
        title={
          isListening
            ? t?.("speech.stopListening") || "Stop listening"
            : t?.("speech.startListening") || "Start voice input"
        }
      >
        {isListening ? "🔴" : "🎤"}
      </button>

      {/* Status indicator */}
      {isListening && (
        <div className={styles.statusIndicator}>
          <div className={styles.pulseAnimation}></div>
          <span className={styles.statusText}>
            {t?.("speech.listening") || "Listening..."}
          </span>
        </div>
      )}

      {/* Transcript preview (interim results) */}
      {isListening && transcript && (
        <div className={styles.transcriptPreview}>
          <div className={styles.transcriptText}>{transcript}</div>
          {confidence > 0 && (
            <div className={styles.confidenceIndicator}>
              {t?.("speech.confidence") || "Confidence"}:{" "}
              {Math.round(confidence * 100)}%
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className={styles.errorContainer}>
          <span className={styles.errorText}>⚠️ {error}</span>
          <button
            className={styles.errorDismiss}
            onClick={() => clearTranscript()}
            title={t?.("speech.dismissError") || "Dismiss error"}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default SpeechToText;
