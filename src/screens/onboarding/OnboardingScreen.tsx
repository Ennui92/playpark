import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ZipPicker } from "@/components/ZipPicker";
import { completeSignup } from "@/services/auth";
import { useSession } from "@/contexts/SessionContext";
import { BERLIN_ZIP_SET } from "@/data/berlinZips";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

// Full Berlin PLZ catalogue lives in src/data/berlinZips.ts.


export function OnboardingScreen() {
  const { refreshProfile } = useSession();
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [zip, setZip] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const usernameValid = /^[a-z0-9_]{3,20}$/.test(username);
  // Family/group name is optional now — solo users skip it and we fall
  // back to their display name when we hit the DB. The schema still
  // requires *something* in families.name; we just don't make them type
  // it twice.
  const canSubmit =
    displayName.trim().length >= 1 &&
    usernameValid &&
    !!zip &&
    BERLIN_ZIP_SET.has(zip);

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const display = displayName.trim();
      const group = familyName.trim() || display;
      await completeSignup({
        familyName: group,
        zip,
        displayName: display,
        username: username.trim().toLowerCase(),
      });
      await refreshProfile();
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        Alert.alert("Username taken", "Try a different one.");
      } else {
        Alert.alert("Something went wrong", msg || "Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set up your account.</Text>
          <Text style={styles.sub}>
            A few details so friends can find you and you can broadcast where you're
            headed.
          </Text>

          <Label>Your name</Label>
          <TextInput
            style={styles.input}
            placeholder="e.g. Jess"
            placeholderTextColor={COLORS.textTertiary}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={40}
          />

          <Label>Your neighborhood (PLZ)</Label>
          <ZipPicker value={zip || null} onChange={setZip} />

          <Label>Pick a username</Label>
          <TextInput
            style={styles.input}
            placeholder="jess_b"
            placeholderTextColor={COLORS.textTertiary}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            autoCapitalize="none"
            maxLength={20}
          />
          <Text style={styles.hint}>
            3–20 chars, lowercase letters/numbers/underscore. Friends can find you by this.
          </Text>

          <Label>Group name (optional)</Label>
          <TextInput
            style={styles.input}
            placeholder="e.g. The Chens — if you're broadcasting as a family"
            placeholderTextColor={COLORS.textTertiary}
            value={familyName}
            onChangeText={setFamilyName}
            maxLength={40}
          />
          <Text style={styles.hint}>
            Leave blank if it's just you. Useful if multiple people share one account
            (parents broadcasting together as "the Chens").
          </Text>

          <Button
            title="Get started"
            onPress={submit}
            loading={saving}
            disabled={!canSubmit}
            style={{ marginTop: SPACING.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: SPACING.xl, paddingBottom: SPACING.xxl },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  hint: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: SPACING.xs },
});
