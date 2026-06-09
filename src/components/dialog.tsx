import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

// ─── Branded replacement for React Native's Alert.alert ────────────────────
// Same call signature as Alert.alert(title, message?, buttons?) so call sites
// swap 1:1, but renders an on-brand cream/coral modal instead of the gray
// Android system dialog. Works from anywhere (including non-component code)
// via a module-level emitter wired up by <DialogHost/>, which is mounted
// once at the app root.

export interface DialogButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let emit: ((d: DialogState | null) => void) | null = null;

export function showDialog(
  title: string,
  message?: string,
  buttons?: DialogButton[]
) {
  const b =
    buttons && buttons.length
      ? buttons
      : [{ text: "OK", style: "default" as const }];
  if (emit) emit({ title, message, buttons: b });
  else {
    // Host not mounted yet (shouldn't happen in practice) — fail loud in dev.
    console.warn("[dialog] showDialog called before DialogHost mounted:", title);
  }
}

export function DialogHost() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    emit = setDialog;
    return () => {
      if (emit === setDialog) emit = null;
    };
  }, []);

  function press(btn: DialogButton) {
    setDialog(null);
    // Defer the action a tick so any navigation inside onPress runs after
    // the modal has dismissed (avoids a flash of the modal over the new screen).
    setTimeout(() => btn.onPress?.(), 0);
  }

  const buttons = dialog?.buttons ?? [];
  // 1–2 buttons sit side by side; 3+ stack vertically (rare).
  const stacked = buttons.length > 2;

  return (
    <Modal
      transparent
      visible={!!dialog}
      animationType="fade"
      onRequestClose={() => setDialog(null)}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {!!dialog?.title && <Text style={styles.title}>{dialog.title}</Text>}
          {!!dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}
          <View style={[styles.btnRow, stacked && styles.btnCol]}>
            {buttons.map((b, i) => {
              const destructive = b.style === "destructive";
              const cancel = b.style === "cancel";
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  onPress={() => press(b)}
                  activeOpacity={0.85}
                  style={[
                    styles.btn,
                    stacked && styles.btnStacked,
                    cancel && styles.btnCancel,
                    destructive && styles.btnDestructive,
                    !cancel && !destructive && styles.btnDefault,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      cancel && styles.btnTextCancel,
                      destructive && styles.btnTextDestructive,
                      !cancel && !destructive && styles.btnTextDefault,
                    ]}
                  >
                    {b.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    ...SHADOW.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  btnRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "flex-end",
  },
  btnCol: { flexDirection: "column-reverse", alignItems: "stretch" },
  btn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 88,
  },
  btnStacked: { width: "100%" },
  btnDefault: { backgroundColor: COLORS.accent },
  btnDestructive: { backgroundColor: COLORS.danger },
  btnCancel: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  btnText: { fontSize: FONT_SIZE.md, fontWeight: "700" },
  btnTextDefault: { color: "#fff" },
  btnTextDestructive: { color: "#fff" },
  btnTextCancel: { color: COLORS.textPrimary },
});
