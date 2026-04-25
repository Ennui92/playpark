import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = "primary", loading, disabled, style }: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        isDisabled && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : COLORS.accent} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "primary" && styles.textPrimary,
            variant === "secondary" && styles.textSecondary,
            variant === "ghost" && styles.textGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: COLORS.accent },
  secondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ghost: { backgroundColor: "transparent" },
  text: { fontSize: FONT_SIZE.md, fontWeight: "700" },
  textPrimary: { color: "#fff" },
  textSecondary: { color: COLORS.textPrimary },
  textGhost: { color: COLORS.accent },
});
