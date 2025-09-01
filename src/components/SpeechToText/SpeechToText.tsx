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
    console.log("🎤 Button disabled state:", isDisabled);

    if (isListening) {
      console.log("🛑 Calling stopListening");
      stopListening();
    } else {
      console.log("🎤 Calling startListening");
      startListening();
    }
  };

  // Add debug logging for isListening state changes
  useEffect(() => {
    console.log(
      "🎤 SpeechToText component - isListening changed to:",
      isListening
    );

    // Force a re-render by updating a dummy state if needed
    if (isListening) {
      console.log("🎤 LISTENING MODE ACTIVATED - Button should be RED 🔴");
    } else {
      console.log("🎤 STANDBY MODE ACTIVATED - Button should be BLUE 🎤");
    }
  }, [isListening]);

  // Add a counter to force re-renders when isListening changes
  const [renderCounter, setRenderCounter] = React.useState(0);
  useEffect(() => {
    setRenderCounter((prev) => prev + 1);
  }, [isListening]);

  // Update parent component when transcript changes
  useEffect(() => {
    console.log(
      "📝 Transcript changed:",
      transcript,
      "isDisabled:",
      isDisabled
    );
    if (transcript.trim() && !isDisabled) {
      console.log("📝 Calling onTranscriptUpdate with:", transcript.trim());
      onTranscriptUpdate(transcript.trim());
    } else if (isDisabled) {
      console.log("📝 Skipping transcript update - component is disabled");
    }
  }, [transcript, onTranscriptUpdate, isDisabled]);

  // Note: Removed automatic transcript clearing to prevent interference with restart

  if (!isSupported) {
    return (
      <div className={styles.unsupportedContainer}>
        <button
          type="button" // Prevent form submission when inside a form
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
        type="button" // Prevent form submission when inside a form
        key={`mic-button-${renderCounter}`} // Force re-render when state changes
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
        style={{
          // Force visual feedback with !important-like specificity
          backgroundColor: isListening ? "#dc3545 !important" : "#007acc",
          color: "white",
          border: isListening ? "3px solid #ff6b6b" : "2px solid #0056b3",
          boxShadow: isListening
            ? "0 0 15px rgba(220, 53, 69, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.2)"
            : "0 2px 4px rgba(0, 0, 0, 0.1)",
          transform: isListening ? "scale(1.1)" : "scale(1)",
          transition: "all 0.2s ease",
        }}
        data-listening={isListening} // Add data attribute for debugging
        data-render-counter={renderCounter} // Add render counter for debugging
      >
        {(() => {
          const buttonIcon = isListening ? "🔴" : "🎤";
          console.log(
            "🎤 Button render - isListening:",
            isListening,
            "icon:",
            buttonIcon,
            "data-listening:",
            isListening
          );
          return buttonIcon;
        })()}
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
