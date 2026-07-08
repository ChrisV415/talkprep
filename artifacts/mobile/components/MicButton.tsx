import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Props {
  isListening: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: number;
  color?: string;
  activeColor?: string;
  style?: object;
}

export function MicButton({
  isListening,
  onToggle,
  disabled = false,
  size = 18,
  color = "#9e9189",
  activeColor = "#E05252",
  style,
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isListening) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.28,
            duration: 480,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 480,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      pulseAnim.setValue(1);
    }
    return () => {
      loopRef.current?.stop();
    };
  }, [isListening]);

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={[
        { padding: 6, alignItems: "center", justifyContent: "center" },
        style,
      ]}
      accessibilityLabel={isListening ? "Stop recording" : "Start voice input"}
      accessibilityRole="button"
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Feather
          name={isListening ? "mic-off" : "mic"}
          size={size}
          color={disabled ? color + "55" : isListening ? activeColor : color}
        />
      </Animated.View>
    </Pressable>
  );
}
