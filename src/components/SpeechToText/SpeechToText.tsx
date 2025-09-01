import React, { useEffect } from "react";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import { useTranslation } from "react-i18next";
import styles from "./SpeechToText.module.css";

interface SpeechToTextProps {
  onTranscriptUpdate: (transcript: string) => void;
  language?: string;
  isDisabled?: boolean;
  clearTrigger?: number; // Add a trigger prop to clear transcript
  stopTrigger?: number; // Add a trigger prop to stop listening
}

const SpeechToText: React.FC<SpeechToTextProps> = ({
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
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    error,
    confidence,
  } = useSpeechToText(language);

  // Clear transcript when clearTrigger changes
  useEffect(() => {
    if (clearTrigger > 0) {
      console.log(
        "🧹 Clearing speech transcript due to trigger:",
        clearTrigger
      );
      clearTranscript();
    }
  }, [clearTrigger, clearTranscript]);

  // Stop listening when stopTrigger changes
  useEffect(() => {
    if (stopTrigger > 0 && isListening) {
      console.log(
        "🛑 Stopping speech recognition due to trigger:",
        stopTrigger
      );
      stopListening();
    }
  }, [stopTrigger, isListening, stopListening]);

  // Handle manual stop/start
  const handleToggle = () => {
    console.log("🎤 Toggle clicked, currently listening:", isListening);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

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
        console.log("🧹 Auto-clearing transcript after listening stopped");
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
        onClick={handleToggle}
        disabled={isDisabled}
        title={
          isListening
            ? t?.("speech.stopListening") || "Click to stop listening"
            : t?.("speech.startListening") || "Click to start voice input"
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
